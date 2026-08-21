(() => {
  const registrationLinks = Array.from(
    document.querySelectorAll("[data-cra-registration]"),
  );
  const accountLinks = Array.from(
    document.querySelectorAll("[data-cra-account]"),
  );

  const openRegistration = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign("/apply");
  };

  const openCandidateAccount = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign("/me");
  };

  for (const link of registrationLinks) {
    link.href = "/apply";
    link.setAttribute("aria-label", "进入报名页面");
    link.addEventListener("click", openRegistration, true);
  }

  for (const link of accountLinks) {
    link.href = "/me";
    link.setAttribute("aria-label", "查看我的报名");
    link.addEventListener("click", openCandidateAccount, true);
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      const link = target instanceof Element ? target.closest(".cra-hero-links a") : null;
      if (!link) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.open(link.href, "_blank", "noopener,noreferrer");
    },
    true,
  );

  const robotHotspots = Array.from(
    document.querySelectorAll(".cra-robot-hotspot"),
  );
  if (!robotHotspots.length) return;

  const updateRobotHotspot = (event) => {
    let activeHotspot = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const hitPadding = Math.max(18, Math.min(38, window.innerWidth * 0.018));

    for (const hotspot of robotHotspots) {
      const rect = hotspot.getBoundingClientRect();
      if (
        event.clientX < rect.left - hitPadding ||
        event.clientX > rect.right + hitPadding ||
        event.clientY < rect.top - hitPadding ||
        event.clientY > rect.bottom + hitPadding
      ) {
        continue;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(
        event.clientX - centerX,
        event.clientY - centerY,
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        activeHotspot = hotspot;
      }
    }

    for (const hotspot of robotHotspots) {
      hotspot.classList.toggle("is-active", hotspot === activeHotspot);
    }
  };

  window.addEventListener("pointermove", updateRobotHotspot, {
    capture: true,
    passive: true,
  });

  window.addEventListener("blur", () => {
    for (const hotspot of robotHotspots) {
      hotspot.classList.remove("is-active");
    }
  });
})();
