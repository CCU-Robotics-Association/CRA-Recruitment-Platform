(() => {
  const exhibitionSection = document.querySelector(".s.is--architecture");
  if (exhibitionSection) {
    exhibitionSection.id = "exhibition";
  }

  const navigationItems = [
    { label: "Show", href: "#exhibition" },
    { label: "Robot", href: "#history" },
    { label: "Us", href: "#values" },
    { label: "End", href: "#contact" },
  ];

  const navigationLinks = document.querySelectorAll(
    "#headerNav [data-anchors-nav='link']",
  );

  navigationItems.forEach(({ label, href }, index) => {
    const link = navigationLinks[index];
    if (!link) return;

    link.setAttribute("href", href);
    link.setAttribute("aria-label", label);

    const text = link.querySelector("[nav__item]");
    if (text) {
      text.textContent = label;
    }
  });
})();

(() => {
  const logo = document.querySelector(".header__logo svg");
  if (!logo) return;

  // The supplied glyph order is W / C / W after the three hexagons.
  // Preserve the original C and remove only the two W paths.
  const originalElements = Array.from(logo.children);
  [originalElements[3], originalElements[5]].forEach((letter) => letter?.remove());

  const namespace = "http://www.w3.org/2000/svg";
  const letters = [
    {
      path:
        "M137 0V1464H731Q950 1464 1082 1353Q1214 1242 1214 1049Q1214 895 1145.5 803.5Q1077 712 952 680V676Q1029 661 1080.5 606.5Q1132 552 1153.5 481.5Q1175 411 1187 330Q1199 249 1200.5 181Q1202 113 1210 65.5Q1218 18 1235 12V0H1036Q1022 13 1017.5 64.5Q1013 116 1014 180.5Q1015 245 1003.5 318.5Q992 392 968.5 452Q945 512 887 552Q829 592 741 592H322V0ZM322 1300V756H688Q743 756 783 759.5Q823 763 873 779Q923 795 954.5 822.5Q986 850 1008 902.5Q1030 955 1030 1028Q1030 1101 1008 1153.5Q986 1206 954.5 1233.5Q923 1261 873 1277Q823 1293 783 1296.5Q743 1300 688 1300Z",
      transform:
        "matrix(0.002966890674 -0.005171407331 -0.002967408373 -0.005172340448 48.509768835196 19.917472587374)",
    },
    {
      path: "M985 367H340L211 0H20L561 1464H766L1305 0H1114ZM401 530H926L666 1294H662Z",
      transform:
        "matrix(0.005933760501 0 -0.002967398128 -0.005172348786 22.048437848386 45.859919218956)",
    },
  ];

  letters.forEach(({ path, transform }) => {
    const letter = document.createElementNS(namespace, "path");
    letter.setAttribute("d", path);
    letter.setAttribute("fill", "currentColor");
    letter.setAttribute("transform", transform);
    logo.appendChild(letter);
  });
})();

(() => {
  const valuesSection = document.querySelector("#valuesSticky");
  const historySection = document.querySelector("#history");
  const parent = valuesSection?.parentNode;

  if (!valuesSection || !historySection || !parent || historySection.parentNode !== parent) {
    return;
  }

  const valuesPosition = document.createComment("values-section-position");
  const historyPosition = document.createComment("history-section-position");

  parent.replaceChild(valuesPosition, valuesSection);
  parent.replaceChild(historyPosition, historySection);
  parent.replaceChild(historySection, valuesPosition);
  parent.replaceChild(valuesSection, historyPosition);
})();

(() => {
  const homeLink = document.querySelector(".header__logo");
  if (homeLink) {
    homeLink.setAttribute("href", "#hero");
    homeLink.setAttribute("aria-label", "返回页面顶部");
    homeLink.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        document.querySelector("#hero")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      },
      true,
    );
  }

  const registrationEntry = document.querySelector(".header__cta .button__text-inner");
  if (registrationEntry) {
    registrationEntry.textContent = "报名入口";
  }

  const coordinates = document.querySelector("#contact .gps__label");
  if (coordinates) {
    coordinates.textContent = "125.33\u00b0 E, 43.84\u00b0 N";
  }

  const footer = document.querySelector("footer");
  const footerSignature = footer?.querySelector(".footer__legal-w > div");
  if (footerSignature) {
    footerSignature.textContent = "CCU Robotics Association@2026";
    footerSignature.classList.add("cra-footer-signature");
  }

  const contactTitle = document.querySelector("#contact .cta__label");
  if (contactTitle) {
    contactTitle.textContent = "\u52a0\u5165\u6211\u4eec";
  }

  const contactCursorInner = document.querySelector(
    "#contact .cursor.is--contact .cursor_inner",
  );
  if (contactCursorInner && !contactCursorInner.querySelector(".cra-contact-label")) {
    const contactLabel = document.createElement("span");
    contactLabel.className = "cra-contact-label";
    contactLabel.textContent = "\u62a5\u540d \u2197";
    contactCursorInner.appendChild(contactLabel);
  }

  const registrationPath = "/apply";
  const registrationLinks = [
    document.querySelector(".header__cta a"),
    document.querySelector("#contact .cta-w"),
  ].filter(Boolean);

  const enterRegistrationPage = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(registrationPath);
  };

  registrationLinks.forEach((link) => {
    link.setAttribute("href", registrationPath);
    link.setAttribute("aria-label", "\u8fdb\u5165\u62a5\u540d\u9875\u9762");
    link.addEventListener("click", enterRegistrationPage, true);
  });

  const title = document.querySelector(".hero__title-w._01 .hero__title");
  if (title) {
    title.textContent = "机器人协会";
  }

  const subtitle = document.querySelector(".hero__title-w._01 .hero__subtitle._01");
  if (subtitle) {
    subtitle.textContent = "CCU Robotics Association";
  }

  const recruitmentTitle = document.querySelector(".hero__title-w._02 .hero__title");
  if (recruitmentTitle) {
    recruitmentTitle.textContent = "招新面试";
  }

  const recruitmentSubtitle = document.querySelector(".hero__title-w._02 .hero__subtitle._02");
  if (recruitmentSubtitle) {
    recruitmentSubtitle.textContent = "Recruitment Interview";
  }

  const registrationTitle = document.querySelector(".hero__title-w._03 .hero__title");
  if (registrationTitle) {
    registrationTitle.textContent = "报名";
  }

  const registrationSubtitle = document.querySelector(".hero__title-w._03 .hero__subtitle._03");
  if (registrationSubtitle) {
    registrationSubtitle.textContent = "Registration";
  }

  const platformTitle = document.querySelector(".hero__title-w._04 .hero__title");
  if (platformTitle) {
    platformTitle.textContent = "线上平台";
  }

  const platformSubtitle = document.querySelector(".hero__title-w._04 .hero__subtitle");
  if (platformSubtitle) {
    platformSubtitle.textContent = "Online Platform";
  }

  const description = document.querySelector(".hero__title-w._03 .hero__desc");
  if (description) {
    description.classList.add("cra-hero-links");
    description.innerHTML = `
      <span>如果你想了解更多信息，欢迎</span>
      <span>继续向下看 <span aria-hidden="true">↓</span></span>
      <a href="https://ccu-robotics-association.github.io/" target="_blank" rel="noopener noreferrer">协会官网 <span aria-hidden="true">↗</span></a>
      <a href="https://github.com/CCU-Robotics-Association" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      <a href="https://gitee.com/ccu-robotics-association_1" target="_blank" rel="noopener noreferrer">Gitee <span aria-hidden="true">↗</span></a>
    `;
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

  const architectureSection = document.querySelector(".s.is--architecture");
  if (architectureSection && !architectureSection.querySelector(".cra-lab-stage")) {
    const labStage = document.createElement("div");
    labStage.className = "cra-lab-stage";

    const labForeground = document.createElement("img");
    labForeground.src = "./assets/webgl/lab/laboratory-foreground.png";
    labForeground.alt = "";
    labForeground.className = "cra-lab-foreground";
    labForeground.setAttribute("aria-hidden", "true");

    labStage.appendChild(labForeground);

    const robotHotspots = [
      ["Dobot", "is-dobot"],
      ["Spider", "is-spider"],
      ["Ugot", "is-ugot"],
      ["NAO Robot", "is-nao"],
    ].map(([label, modifier]) => {
      const hotspot = document.createElement("div");
      hotspot.className = `cra-robot-hotspot ${modifier}`;
      hotspot.innerHTML = `
        <div class="cra-robot-label">
          <button class="button is--dark disabled" type="button" tabindex="-1">
            <div class="button__text">
              <div class="button__text-inner">${label}</div>
            </div>
          </button>
        </div>
      `;
      labStage.appendChild(hotspot);
      return hotspot;
    });

    architectureSection.appendChild(labStage);

    const updateRobotHotspot = (event) => {
      let activeHotspot = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      const hitPadding = Math.max(
        18,
        Math.min(38, window.innerWidth * 0.018),
      );

      for (const hotspot of robotHotspots) {
        const rect = hotspot.getBoundingClientRect();
        if (
          event.clientX >= rect.left - hitPadding &&
          event.clientX <= rect.right + hitPadding &&
          event.clientY >= rect.top - hitPadding &&
          event.clientY <= rect.bottom + hitPadding
        ) {
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
  }

  ["Dobot", "Spider", "Ugot", "NAO Robot"].forEach((label, index) => {
    const raycastLabel = document.querySelectorAll(
      "[data-gl-raycast] .button__text-inner",
    )[index];
    if (raycastLabel) raycastLabel.textContent = label;
  });

  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "FZ QingKe BenYueSong";
      src: url("./fonts/FZQKBYSJW.TTF") format("truetype");
      font-style: normal;
      font-weight: 400;
      font-display: swap;
    }

    @font-face {
      font-family: "FZ ZhuZi A Old Mincho";
      src: url("./fonts/FZFWZhuZiAOldMinchoD.TTF") format("truetype");
      font-style: normal;
      font-weight: 400;
      font-display: swap;
    }

    .hero__title-w._01 .hero__title,
    .hero__title-w._02 .hero__title,
    .hero__title-w._03 .hero__title,
    .hero__title-w._04 .hero__title {
      font-family: "FZ ZhuZi A Old Mincho", "Songti SC", "STSong", SimSun, serif !important;
      font-weight: 100 !important;
      font-size: 10rem !important;
    }

    .hero__title-w._01 .hero__subtitle._01 {
      z-index: 4 !important;
      inset: -1.2rem auto auto 50% !important;
      margin: 0 !important;
      transform: translate(-50%, -100%) !important;
      font-size: 1.4rem;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .hero__title-w._02 .hero__subtitle._02,
    .hero__title-w._03 .hero__subtitle._03,
    .hero__title-w._04 .hero__subtitle {
      z-index: 4 !important;
      inset: auto auto -1.6rem 50% !important;
      margin: 0 !important;
      transform: translateX(-50%) !important;
      font-size: 1.4rem;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .hero__title-w._03 .hero__subtitle._03 {
      left: 10rem !important;
    }

    .hero__desc.cra-hero-links {
      z-index: 5;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.65rem;
      pointer-events: auto;
    }

    .hero__intro-w {
      z-index: 3;
    }

    .cursor,
    .cursor * {
      pointer-events: none !important;
    }

    .cursor__area {
      pointer-events: auto !important;
      cursor: none !important;
    }

    .cra-lab-stage {
      position: absolute;
      left: 50%;
      bottom: 13.5vh;
      z-index: 2;
      width: 63vw;
      aspect-ratio: 2129 / 738;
      transform: translateX(-50%);
      pointer-events: none;
      user-select: none;
    }

    .cra-lab-foreground {
      display: block;
      width: 100%;
      height: 100%;
      max-width: none;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
    }

    .architecture-w [data-gl-raycast] {
      display: none !important;
    }

    .cra-robot-hotspot {
      position: absolute;
      z-index: 3;
      pointer-events: none;
    }

    .cra-robot-hotspot.is-dobot {
      left: 23.5%;
      top: 61%;
      width: 8%;
      height: 26%;
    }

    .cra-robot-hotspot.is-spider {
      left: 36%;
      top: 72%;
      width: 8%;
      height: 18%;
    }

    .cra-robot-hotspot.is-ugot {
      left: 50%;
      top: 69%;
      width: 7%;
      height: 25%;
    }

    .cra-robot-hotspot.is-nao {
      left: 58%;
      top: 61%;
      width: 6%;
      height: 28%;
    }

    .cra-robot-label {
      position: absolute;
      left: 50%;
      top: 0;
      opacity: 0;
      transform: translate(-50%, -105%) scale(0.9);
      transform-origin: 50% 100%;
      transition:
        opacity 0.2s ease,
        transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
      pointer-events: none;
      white-space: nowrap;
    }

    .cra-robot-hotspot:hover .cra-robot-label,
    .cra-robot-hotspot.is-active .cra-robot-label {
      opacity: 1;
      transform: translate(-50%, -115%) scale(1);
    }

    .hero__desc.cra-hero-links a {
      position: relative;
      z-index: 10;
      color: inherit;
      text-decoration: none;
      border-bottom: 1px solid currentColor;
      padding-bottom: 0.1rem;
      pointer-events: auto !important;
      cursor: pointer;
    }

    .cra-values-title {
      font-family: "FZ ZhuZi A Old Mincho", "Songti SC", "STSong", SimSun, serif !important;
      font-weight: 100 !important;
      line-height: 1.18 !important;
    }

    .cra-values-title > span {
      display: block !important;
      white-space: nowrap;
    }

    .values__subtitle,
    .values__desc,
    .values__desc > span {
      font-family: "FZ ZhuZi A Old Mincho", "Songti SC", "STSong", SimSun, serif !important;
      font-weight: 100 !important;
    }

    .values__desc > span {
      display: block !important;
    }

    #contact .cta__label {
      font-family: "FZ ZhuZi A Old Mincho", "Songti SC", "STSong", SimSun, serif !important;
      font-weight: 100 !important;
    }

    footer .social-w,
    footer .raise-w,
    footer .footer__form-w,
    footer .footer__legal-w .legal__link {
      display: none !important;
    }

    footer .footer__legal-w {
      grid-template-columns: 1fr !important;
    }

    footer .cra-footer-signature {
      display: block !important;
    }

    #contact.s.is--cta {
      overflow: clip !important;
    }

    #contact .cursor.is--contact .cursor_inner > svg {
      display: none !important;
    }

    #contact .cra-contact-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-family: "FZ ZhuZi A Old Mincho", "Songti SC", "STSong", SimSun, serif !important;
      font-size: 1.55rem;
      font-weight: 100;
      line-height: 1;
      white-space: nowrap;
      opacity: 0;
      transform: scale3d(0, 0, 1);
      transition:
        opacity 0.3s cubic-bezier(0.215, 0.61, 0.355, 1),
        transform 0.3s cubic-bezier(0.215, 0.61, 0.355, 1);
    }

    html:not(.lenis-stopped) #contact .cursor.is--contact.is-visible .cra-contact-label,
    html.is-mobile #contact .cursor.is--contact .cra-contact-label {
      opacity: 1;
      transform: scale3d(1, 1, 1);
      transition-delay: 0.15s;
      transition-duration: 0.6s;
    }

    @media screen and (max-width: 479px) {
      .hero__title-w._01 .hero__title,
      .hero__title-w._02 .hero__title,
      .hero__title-w._03 .hero__title,
      .hero__title-w._04 .hero__title {
        font-size: 5.2rem !important;
      }

      .hero__title-w._01 .hero__subtitle._01 {
        top: -0.8rem !important;
        bottom: auto !important;
        font-size: 1.1rem;
      }

      .hero__title-w._02 .hero__subtitle._02,
      .hero__title-w._03 .hero__subtitle._03,
      .hero__title-w._04 .hero__subtitle {
        bottom: -1.2rem !important;
        font-size: 1.1rem;
      }

      .hero__title-w._03 .hero__subtitle._03 {
        left: 5.2rem !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
