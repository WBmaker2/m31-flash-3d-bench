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
