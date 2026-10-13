// 🥚 Shhh... secret easter eggs live here!
//
//  1. Konami code  ↑ ↑ ↓ ↓ ← → ← → B A   → cheat code mode
//  2. Click the photo 5 times             → costume change
//  3. Click the spinning star             → star burst
//  4. Type "ice cream" anywhere           → it's raining ice cream
//  5. Double-click the logo (top left)    → paper airplane
//  6. Click the heart in the footer       → floating hearts
//  (+ a secret message in the browser console for curious coders)

(function () {
  const TOTAL = 6;
  const found = new Set();
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Helpers ─────────────────────────────────────────────
  let toastTimer;
  function toast(text) {
    let t = document.querySelector(".egg-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "egg-toast";
      t.setAttribute("role", "status");
      document.body.append(t);
    }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function discover(id, message) {
    found.add(id);
    const count = found.size === TOTAL
      ? `🏆 You found ALL ${TOTAL} easter eggs! You're a legend.`
      : `🥚 ${message} (${found.size}/${TOTAL} found)`;
    toast(count);
    if (found.size === TOTAL) setTimeout(() => rain(["🏆", "🥚", "⭐", "🎉"], 50), 300);
  }

  // Emoji that fall from the top of the screen.
  function rain(emojis, count = 30) {
    if (calm) return;
    for (let i = 0; i < count; i++) {
      const e = document.createElement("span");
      e.className = "egg-fall";
      e.textContent = emojis[i % emojis.length];
      e.style.left = Math.random() * 100 + "vw";
      e.style.fontSize = 18 + Math.random() * 26 + "px";
      e.style.animationDuration = 2 + Math.random() * 2.5 + "s";
      e.style.animationDelay = Math.random() * 1.2 + "s";
      e.addEventListener("animationend", () => e.remove());
      document.body.append(e);
    }
  }

  // Emoji that shoot out from a point.
  function burst(x, y, emojis, count = 14, up = false) {
    if (calm) return;
    for (let i = 0; i < count; i++) {
      const e = document.createElement("span");
      e.className = "egg-burst";
      e.textContent = emojis[i % emojis.length];
      const angle = up
        ? -Math.PI / 2 + (Math.random() - 0.5) * 1.2
        : (Math.PI * 2 * i) / count;
      const dist = up ? 120 + Math.random() * 160 : 60 + Math.random() * 70;
      e.style.left = x + "px";
      e.style.top = y + "px";
      e.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      e.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      e.addEventListener("animationend", () => e.remove());
      document.body.append(e);
    }
  }

  const center = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };

  // ── 1. Konami code ──────────────────────────────────────
  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kPos = 0;

  // ── 4. Typed secret word ────────────────────────────────
  const secret = "ice cream";
  let typed = "";

  document.addEventListener("keydown", (ev) => {
    if (ev.target.closest("input, textarea, [contenteditable]")) return;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;

    kPos = key === konami[kPos] ? kPos + 1 : key === konami[0] ? 1 : 0;
    if (kPos === konami.length) {
      kPos = 0;
      document.body.classList.add("cheat-mode");
      rain(["🎉", "🎊", "⭐", "🌈", "✨"], 60);
      setTimeout(() => document.body.classList.remove("cheat-mode"), 6000);
      discover("konami", "CHEAT CODE ACTIVATED! +30 lives");
    }

    if (key.length === 1) {
      typed = (typed + key).slice(-secret.length);
      if (typed === secret) {
        typed = "";
        rain(["🍦", "🍨", "🍧"], 40);
        discover("icecream", "Did someone say ICE CREAM?!");
      }
    }
  });

  // ── 2. Click the photo 5 times ──────────────────────────
  const avatar = document.getElementById("avatar");
  const frame = document.querySelector(".photo-frame");
  const costumes = ["😎", "🤓", "🤖", "👽", "🦖", "🐍", "🥷", "😄"];
  let clicks = 0, costume = 0, clickTimer;
  frame.addEventListener("click", () => {
    frame.classList.remove("wiggle");
    void frame.offsetWidth; // restart the animation
    frame.classList.add("wiggle");
    clicks++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => (clicks = 0), 1500);
    if (clicks >= 5) {
      clicks = 0;
      frame.classList.add("flip");
      setTimeout(() => frame.classList.remove("flip"), 700);
      if (!avatar.querySelector("img")) {
        setTimeout(() => (avatar.textContent = costumes[costume++ % costumes.length]), 300);
      }
      discover("avatar", "Costume change!");
    }
  });

  // ── 3. The spinning star ────────────────────────────────
  const star = document.querySelector(".doodle.star");
  star.addEventListener("click", () => {
    burst(...center(star), ["⭐", "✨", "🌟"], 16);
    discover("star", "You caught a shooting star!");
  });

  // ── 5. Double-click the logo ────────────────────────────
  document.getElementById("brand").addEventListener("dblclick", (ev) => {
    ev.preventDefault();
    if (!calm) {
      const plane = document.createElement("span");
      plane.className = "egg-plane";
      plane.textContent = "✈️";
      plane.addEventListener("animationend", () => plane.remove());
      document.body.append(plane);
    }
    discover("plane", "Paper airplane launched! ✈️");
  });

  // ── 6. Footer heart ─────────────────────────────────────
  const footer = document.getElementById("footer-text");
  const [before, after] = footer.textContent.split("♥");
  const heart = Object.assign(document.createElement("button"), {
    className: "egg-heart", textContent: "♥", ariaLabel: "heart",
  });
  footer.replaceChildren(before, heart, after);
  heart.addEventListener("click", (ev) => {
    burst(...center(ev.currentTarget), ["💖", "💛", "💙", "💚", "💜"], 12, true);
    discover("heart", "Thanks for the love!");
  });

  // ── Bonus: console message ──────────────────────────────
  console.log(
    "%c👋 Hey, curious coder!",
    "font: bold 20px sans-serif; color: #e0553d;"
  );
  console.log(
    "There are 6 easter eggs hidden on this page. Can you find them all?\nHint: try the famous ↑ ↑ ↓ ↓ code... 🎮"
  );
})();
