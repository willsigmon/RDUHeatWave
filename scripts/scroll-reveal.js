/**
 * Scroll Reveal + Haptic Feedback
 * Cross-pollinated from the sigstack/allsberryins animation patterns.
 *
 * Usage: Add `data-reveal` to any element. Optional modifiers:
 *   data-reveal="left"   — slide from left
 *   data-reveal="right"  — slide from right
 *   data-reveal="scale"  — scale up
 *   data-reveal (no val)  — default fade-up
 *   data-reveal-delay="200" — ms delay
 *
 * Haptics: Add `data-haptic` to clickable elements.
 *   data-haptic="light" | "medium" | "success" (default: light)
 */
(function () {
  "use strict";

  /* ── Scroll Reveal ─────────────────────────────────────────────── */
  const REVEAL_CSS = document.createElement("style");
  REVEAL_CSS.textContent = `
    [data-reveal] {
      opacity: 0;
      transform: translateY(28px);
      filter: blur(6px);
      transition: opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  filter 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    [data-reveal="left"] { transform: translateX(-28px) translateY(0); }
    [data-reveal="right"] { transform: translateX(28px) translateY(0); }
    [data-reveal="scale"] { transform: scale(0.92) translateY(0); }
    [data-reveal].revealed {
      opacity: 1;
      transform: translateY(0) translateX(0) scale(1);
      filter: blur(0);
    }
    @media (prefers-reduced-motion: reduce) {
      [data-reveal] {
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(REVEAL_CSS);

  function initReveal() {
    var els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var delay = parseInt(entry.target.getAttribute("data-reveal-delay") || "0", 10);
            if (delay > 0) {
              setTimeout(function () { entry.target.classList.add("revealed"); }, delay);
            } else {
              entry.target.classList.add("revealed");
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "-30px" }
    );

    els.forEach(function (el) { observer.observe(el); });
  }

  /* ── Haptic Feedback ───────────────────────────────────────────── */
  var HAPTIC_PATTERNS = {
    light:   [8],
    medium:  [14],
    success: [8, 30, 12],
    nudge:   [6, 20, 6],
    error:   [12, 40, 12, 40, 12],
  };

  function triggerHaptic(kind) {
    if (!navigator.vibrate) return;
    var pattern = HAPTIC_PATTERNS[kind] || HAPTIC_PATTERNS.light;
    navigator.vibrate(pattern);
  }

  function initHaptics() {
    document.addEventListener("click", function (e) {
      var target = e.target.closest("[data-haptic]");
      if (target) {
        triggerHaptic(target.getAttribute("data-haptic") || "light");
      }
    });
  }

  /* ── Boot ──────────────────────────────────────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { initReveal(); initHaptics(); });
  } else {
    initReveal();
    initHaptics();
  }
})();
