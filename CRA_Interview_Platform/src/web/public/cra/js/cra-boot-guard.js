(() => {
  const root = document.documentElement;
  const timeout = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 1200
    : 10000;

  window.setTimeout(() => {
    if (!root.classList.contains("is-loading")) return;

    root.classList.add(
      "is-loaded",
      "is-ready",
      "is-first-loaded",
      "gl-fallback",
    );
    root.classList.remove("is-loading");
    root.dataset.glFallback ||= "boot-timeout";

    if (document.body) document.body.dataset.theme = "light";
    document.getElementById("preloader")?.remove();
  }, timeout);
})();
