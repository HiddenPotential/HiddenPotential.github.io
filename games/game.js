// Grow the game frame to fit the game, so the page scrolls instead of the frame.
// The arcade (opened with ?solo) sends its height whenever it changes size.
const frame = document.querySelector(".game-frame iframe");
window.addEventListener("message", (ev) => {
  if (ev.source !== frame.contentWindow) return;
  const h = ev.data && ev.data.arcadeHeight;
  if (h > 0) frame.style.height = h + "px";
});
