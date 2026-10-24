// 화면(HTML) 연결. 상태를 화면에 반영한다.
export function createHud(handlers = {}) {
  const el = {
    boardName: document.getElementById("board-name"),
    status: document.getElementById("status-line"),
    statTurn: document.getElementById("stat-turn"),
    statValue: document.getElementById("stat-value"),
    scoreList: document.getElementById("score-list"),
    question: document.getElementById("question-text"),
    choices: document.getElementById("choices"),
    btnRoll: document.getElementById("btn-roll"),
    btnLevels: document.getElementById("btn-levels"),
    btnReset: document.getElementById("btn-reset"),
  };

  function setBoard(board) {
    el.boardName.textContent = board.label;
  }

  function setScores(players, turn) {
    el.scoreList.replaceChildren();
    players.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = index === turn ? "score-row is-turn" : "score-row";
      const name = document.createElement("span");
      name.className = "score-name";
      name.style.setProperty("--chip", `#${player.color.toString(16).padStart(6, "0")}`);
      name.textContent = player.name;
      const score = document.createElement("b");
      score.textContent = `${player.score}점 · ${player.position}칸`;
      row.append(name, score);
      el.scoreList.append(row);
    });
  }

  function setQuestion(question) {
    el.choices.replaceChildren();
    if (!question) {
      el.question.textContent = "";
      return;
    }
    el.question.textContent = `${question.a} + ${question.b} = ?`;
    question.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choice = String(choice);
      button.textContent = `${choice}`;
      button.title = `${index + 1}번 보기`;
      button.addEventListener("click", () => handlers.onChoice?.(choice));
      el.choices.append(button);
    });
  }

  function setStats({ turnName, value }) {
    el.statTurn.textContent = turnName;
    el.statValue.textContent = value > 0 ? `${value}` : "-";
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnRoll?.addEventListener("click", () => handlers.onRoll?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());
  el.btnReset?.addEventListener("click", () => handlers.onReset?.());

  return { el, setBoard, setScores, setQuestion, setStats, setMessage };
}
