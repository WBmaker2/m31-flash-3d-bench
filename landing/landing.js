// 입체 팝업북 랜딩의 상호작용. 게임은 같은 페이지의 모달 iframe에서 연다.
const PROGRESS_PREFIX = "m31-3d-bench:";

const dialog = document.getElementById("player");
const frame = document.getElementById("player-frame");
const playerName = document.getElementById("player-name");
const external = document.getElementById("player-external");
const playerClose = document.getElementById("player-close");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
let lastTrigger = null;

function openPlayer(href, title, trigger = null) {
  lastTrigger = trigger;
  playerName.textContent = title;
  external.href = href;
  frame.src = href;
  frame.title = title;
  document.body.classList.add("is-modal-open");
  dialog.showModal();
  playerClose?.focus();
}

for (const play of document.querySelectorAll(".play")) {
  const title = play.dataset.title ?? "게임";
  play.setAttribute("aria-label", `${title} 플레이`);
  play.addEventListener("click", (event) => {
    event.preventDefault();
    openPlayer(play.dataset.href, title, play);
  });
}

for (const card of document.querySelectorAll("[data-game]")) {
  card.addEventListener("click", (event) => {
    if (event.target.closest("a, button, summary")) return;
    card.querySelector(".play")?.click();
  });
}

playerClose?.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  frame.src = "about:blank";
  document.body.classList.remove("is-modal-open");
  lastTrigger?.focus?.();
  lastTrigger = null;
  renderProgress();
});

frame.addEventListener("load", () => {
  try {
    const back = frame.contentDocument?.querySelector(".back-link");
    back?.addEventListener("click", (event) => {
      event.preventDefault();
      dialog.close();
    });
  } catch {
    // 다른 출처로 이동한 경우에는 target="_top" 기본 동작을 둔다.
  }
});

for (const button of document.querySelectorAll(".copy")) {
  button.setAttribute("aria-live", "polite");
  button.addEventListener("click", async () => {
    const text = button.dataset.copy ?? "";
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "복사됨";
    } catch {
      button.textContent = "복사 실패";
    }
    setTimeout(() => {
      button.textContent = "명령 복사";
    }, 1800);
  });
}

// 카드에 마우스를 올리면 실제 게임의 다른 각도를 차례로 보여준다.
for (const card of document.querySelectorAll("[data-frames]")) {
  const frames = [...card.querySelectorAll(".frame-img")];
  if (frames.length < 2) continue;
  let index = 0;
  let timer = null;

  const show = (next) => {
    frames[index].classList.remove("is-active");
    index = (next + frames.length) % frames.length;
    frames[index].classList.add("is-active");
  };
  const loadFrames = () => {
    for (const frame of frames) {
      const background = frame.dataset.bg;
      if (background && !frame.style.backgroundImage) {
        frame.style.backgroundImage = `url("${background}")`;
      }
    }
  };
  const start = () => {
    if (!canHover || timer || reduceMotion.matches) return;
    loadFrames();
    timer = setInterval(() => show(index + 1), 1000);
  };
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    show(0);
  };

  card.addEventListener("mouseenter", start);
  card.addEventListener("mouseleave", stop);
  card.addEventListener("click", stop);
}

// 현재 펼친 게임에 맞춰 탭 레일에 표시를 준다.
const tabs = [...document.querySelectorAll(".tab")];
const tabById = new Map(
  tabs
    .map((tab) => {
      const href = tab.getAttribute("href") ?? "";
      return [href.startsWith("#") ? href.slice(1) : "", tab];
    })
    .filter(([id]) => id),
);
const games = [...document.querySelectorAll("article[data-game]")];

function setCurrentTab(id) {
  for (const tab of tabs) tab.removeAttribute("aria-current");
  tabById.get(id)?.setAttribute("aria-current", "true");
}

for (const tab of tabs) {
  tab.title = tab.getAttribute("aria-label") ?? "";
  tab.addEventListener("click", () => {
    const id = (tab.getAttribute("href") ?? "").slice(1);
    if (id) setCurrentTab(id);
  });
}

window.addEventListener(
  "scroll",
  () => {
    if (window.scrollY < 120) setCurrentTab("game-zoo");
  },
  { passive: true },
);

if ("IntersectionObserver" in window && games.length > 0) {
  const ratios = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      let best = null;
      let bestRatio = 0;
      for (const [id, ratio] of ratios) {
        if (ratio > bestRatio) {
          best = id;
          bestRatio = ratio;
        }
      }
      if (best) setCurrentTab(best);
    },
    { rootMargin: "-18% 0px -58% 0px", threshold: [0, 0.15, 0.35, 0.6] },
  );
  for (const game of games) observer.observe(game);
}

function readGameProgress(game) {
  try {
    const raw = window.localStorage.getItem(`${PROGRESS_PREFIX}${game}:progress`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !parsed.data || typeof parsed.data !== "object") return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function summarizeGame(game) {
  const data = readGameProgress(game);
  if (!data) return { levels: 0, stars: 0, maxStars: 0, cleared: 0, score: 0 };
  const entries = Object.values(data);
  return {
    levels: entries.length,
    stars: entries.reduce((sum, entry) => sum + Math.max(0, Math.min(3, Number(entry?.stars) || 0)), 0),
    maxStars: entries.length * 3,
    cleared: entries.filter((entry) => (Number(entry?.stars) || 0) > 0).length,
    score: entries.reduce((sum, entry) => sum + (Number(entry?.bestScore) || 0), 0),
  };
}

function renderProgress() {
  const grid = document.getElementById("progress-grid");
  const summary = document.getElementById("progress-summary");
  if (!grid || !summary) return;

  const cards = [...document.querySelectorAll("[data-game]")].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  );
  const totals = { stars: 0, maxStars: 0, played: 0, cleared: 0, levels: 0, score: 0 };
  let resumeGame = null;
  grid.replaceChildren();

  for (const card of cards) {
    const game = card.dataset.game;
    const title = card.querySelector("h2, h3")?.textContent?.trim() || game;
    const value = summarizeGame(game);
    if (value.levels > 0) totals.played += 1;
    totals.stars += value.stars;
    totals.maxStars += value.maxStars;
    totals.cleared += value.cleared;
    totals.levels += value.levels;
    totals.score += value.score;

    const item = document.createElement("div");
    item.className = value.levels > 0 ? "progress-item" : "progress-item is-empty";
    item.setAttribute("role", "listitem");
    const index = document.createElement("span");
    index.className = "progress-index";
    index.textContent = card.dataset.index ?? "";
    const name = document.createElement("span");
    name.className = "progress-name";
    name.textContent = title;
    const stars = document.createElement("span");
    stars.className = "progress-stars";
    stars.textContent = value.levels > 0 ? `★ ${value.stars}/${value.maxStars}` : "—";
    const meta = document.createElement("span");
    meta.className = "progress-meta";
    meta.textContent =
      value.levels > 0
        ? `${value.cleared}/${value.levels} 단계 · ${value.score}점`
        : "아직 기록 없음";
    item.append(index, name, stars, meta);
    grid.append(item);
    if (!resumeGame && value.levels > 0 && value.stars < value.maxStars) resumeGame = game;
  }

  const resume = document.getElementById("progress-resume");
  if (resume) {
    resume.disabled = !resumeGame;
    resume.dataset.game = resumeGame ?? "";
  }

  summary.textContent =
    totals.played > 0
      ? `플레이한 세계 ${totals.played} / ${cards.length} · 모은 별 ${totals.stars} / ${totals.maxStars} · 클리어한 단계 ${totals.cleared} / ${totals.levels} · 총점 ${totals.score}`
      : "아직 펼친 세계가 없습니다. 첫 세계를 펼치면 이곳에 스탬프가 쌓입니다.";
}

document.getElementById("progress-resume")?.addEventListener("click", (event) => {
  const game = event.currentTarget.dataset.game;
  if (!game) return;
  document.querySelector(`[data-game="${game}"] .play`)?.click();
});

document.getElementById("progress-reset")?.addEventListener("click", () => {
  if (!window.confirm("모든 게임의 진행 기록을 지울까요? 되돌릴 수 없습니다.")) return;
  try {
    const keys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(PROGRESS_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // 저장소를 쓸 수 없으면 화면만 갱신한다.
  }
  renderProgress();
});

const books = [...document.querySelectorAll(".book")];
if ("IntersectionObserver" in window) {
  const bookObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-seen");
        bookObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.12 },
  );
  for (const book of books) bookObserver.observe(book);
} else {
  for (const book of books) book.classList.add("is-seen");
}

renderProgress();
window.addEventListener("focus", renderProgress);
window.__landingReady = true;
