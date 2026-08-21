import {
  g as e,
  C as t,
  _ as s,
  a as i,
  D as n,
  I as r,
  S as a,
  c as o,
  m as l,
  b as h,
  d as c,
  N as d,
  A as u,
  P as m,
  E as p,
  e as g,
  W as f,
  V as v,
  M as w,
  f as y,
  h as x,
  i as b,
  j as S,
  U as L,
  k as P,
  l as M,
  n as C,
  o as T,
  R as z,
  O as _,
  p as E,
  G as R,
  B,
  q as A,
  r as D,
  s as k,
  t as I,
  L as O,
  u as U,
  v as F,
  T as q,
  w as V,
  x as N,
  y as j,
  z as H,
  F as Y,
} from "./cra-home-vendors.js";
e.registerPlugin(t);
const G = "production",
  W = window.matchMedia("(prefers-reduced-motion)").matches,
  X = Object.freeze({
    NAME: G,
    IS_PROD: !0,
    IS_DEV: !1,
    PREFERS_REDUCED_MOTION: W,
  }),
  K = Object.freeze({
    LOADING: "is-loading",
    READY: "is-ready",
    LOADED: "is-loaded",
    FIRST_LOADED: "is-first-loaded",
  }),
  Z = Object.freeze({
    RESIZE_END: "resizeEnd",
    PAGE_LOADED: "pageLoaded",
    DOM_ADDED: "domAdded",
  }),
  J = Object.freeze({
    EAGER: [
      { family: "Neuemontreal", style: "normal", weight: "400" },
      { family: "Neuemontreal", style: "normal", weight: "500" },
      { family: "Ryhmesdisplay", style: "normal", weight: "300" },
    ],
  });
(t.create("myEaseSmooth", "0.33,0,0,1"),
  t.create("myEaseSmooth2", "0.10, 0.69, 0.39, 1.03"),
  t.create("myEaseSmooth3", "0.8, 0.2, 0.1, 0.8"),
  t.create("myEaseSmooth4", "0.215, 0.61, 0.355, 1"),
  t.create("preloader", "0.65, 0, 0, 1"));
const Q = 0.89,
  ee = 1.29,
  te = 1.89,
  se = "myEaseSmooth",
  ie = "Expo.easeInOut",
  ne = "myEaseSmooth2",
  re = "preloader",
  ae = document.documentElement,
  oe = document.body;
(e.registerPlugin(n, r), e.registerPlugin(a));
const le = "is-scroll-top",
  he = "is-scrolling-up";
const ce =
  /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  ) ||
  ("MacIntel" === navigator.platform && navigator.maxTouchPoints > 1);
class de extends s {
  static get settings() {
    return { CLASS_STICKY: "is-sticky" };
  }
  constructor(e) {
    (super(e),
      (this.$el = this.el),
      (this.$navItem = document.querySelectorAll("[nav__item]")),
      (this.isSticky = !1),
      (this.stickyIsLocked = !1),
      (this.scrollTop = !1),
      (this.events = {
        mousemove: { wrap: "setSticky" },
        mouseenter: { wrap: "lockSticky" },
        mouseleave: { wrap: "unlockSticky" },
      }));
  }
  init() {
    (window.addEventListener("resizeEnd", (this.onResize = () => this.close())),
      ce ? this.mobileMenu() : this.menu());
  }
  mobileMenu() {
    const t = document.querySelector(".burger-w"),
      s = document.querySelector(".burger__bg"),
      i = document.querySelector(".burger__open").querySelectorAll("path"),
      n = document.querySelector(".burger__close").querySelectorAll("path"),
      r = document.querySelectorAll(".header_link"),
      o = document.querySelector(".footer__legal-w");
    ((this.tlMobileMenu = e
      .timeline({
        paused: !0,
        reversed: !0,
        defaults: { duration: 0.8, ease: se },
        onReverseComplete: () => {
          this.call("start", null, "Scroll");
        },
      })
      .to(s, { opacity: 1, scale: 50 })
      .fromTo(
        i,
        { scale: 1, transformOrigin: "center center" },
        { scale: 0, stagger: 0.05, duration: 0.4 },
        "<",
      )
      .fromTo(
        n,
        { scale: 0, transformOrigin: "center center" },
        { scale: 1, stagger: 0.05, duration: 0.4 },
        "<.1",
      )
      .to(t, { borderColor: "rgba(37, 37, 37, 1)" }, "<")
      .fromTo(
        r,
        { yPercent: 100, opacity: 0 },
        { yPercent: 0, opacity: 1, stagger: 0.05 },
        ">-.8",
      )
      .fromTo(
        o,
        { xPercent: -10, opacity: 0 },
        { xPercent: 0, opacity: 1 },
        ">-.6",
      )),
      t.addEventListener("click", () => {
        (this.call("stop", null, "Scroll"),
          this.tlMobileMenu.reversed()
            ? this.tlMobileMenu.timeScale(1).play()
            : this.tlMobileMenu.timeScale(1.5).reverse());
      }));
    let l = null;
    r.forEach((e) => {
      e.addEventListener("click", () => {
        (l && l.classList.remove("active"),
          (l = e),
          e.classList.add("active"),
          this.call("start", null, "Scroll"),
          this.tlMobileMenu.timeScale(1.5).reverse());
      });
    });
  }
  menu() {
    const t = document.querySelector(".header__nav"),
      s = document.querySelector(".header__indicator"),
      i = document.querySelectorAll(".header_link");
    (e.set(s, {
      opacity: 0,
      scale: 0,
      filter: "blur(8px)",
      transformOrigin: "left center",
    }),
      i.forEach((t) => {
        (t.addEventListener("mouseenter", () => {
          (e.killTweensOf(s),
            e.killTweensOf(t),
            e.to(s, {
              left: t.offsetLeft,
              width: t.offsetWidth,
              opacity: 1,
              scale: 1,
              transformOrigin: "50% 50%",
              filter: "blur(0px)",
              duration: 0.4,
              ease: ne,
            }),
            e.to(t, { scale: 0.95, duration: 0.4, ease: se }));
        }),
          t.addEventListener("mouseleave", () => {
            e.to(t, { scale: 1, duration: 0.4, ease: se });
          }));
      }),
      t.addEventListener("mouseleave", () => {
        (e.to(s, { filter: "blur(8px)", delay: 0.1 }),
          e.to(s, {
            opacity: 0,
            scale: 1.2,
            transformOrigin: "50% 50%",
            duration: 0.2,
            ease: se,
            delay: 0.2,
          }));
      }));
  }
  bindKeyEvents() {
    window.addEventListener(
      "keyup",
      (this.onKeyDown = (e) => {
        "Escape" === e.key && this.close();
      }),
    );
  }
  unbindKeyEvents() {
    window.removeEventListener("keyup", this.onKeyDown);
  }
  setSticky(e = !0) {
    ((e = !1 !== e),
      this.isSticky === e ||
        this.stickyIsLocked ||
        (this.$el.setAttribute("aria-hidden", !e),
        this.$el.classList.toggle(de.settings.CLASS_STICKY, e),
        (this.isSticky = e)));
  }
  lockSticky() {
    (this.setSticky(), (this.stickyIsLocked = !0));
  }
  unlockSticky() {
    this.stickyIsLocked = !1;
  }
  close() {}
  destroy() {
    ce && this.close();
  }
}
const ue = (e, t, s = !1) => {
    let i = null;
    return (...n) => {
      clearTimeout(i);
      (s && !i && e(...n),
        (i = setTimeout(() => {
          ((i = null), s || e(...n));
        }, t)));
    };
  },
  me = l({ width: window.innerWidth, height: window.innerHeight }),
  pe = l({ width: window.innerWidth, height: window.innerHeight });
(window.addEventListener("resize", () => {
  (me.setKey("width", window.innerWidth),
    me.setKey("height", window.innerHeight));
}),
  window.addEventListener(
    "resize",
    ue(() => {
      (pe.setKey("width", window.innerWidth),
        pe.setKey("height", window.innerHeight));
    }, 200),
  ));
const ge = (e, t, s) => e * (1 - s) + t * s;
const fe = "fonts" in document;
function ve(e, t) {
  for (const [s, i] of Object.entries(t))
    switch (s) {
      case "family":
        if (Se(e[s]) !== i) return !1;
        break;
      case "weight":
        if (e[s] != i) return !1;
        break;
      default:
        if (e[s] !== i) return !1;
    }
  return !0;
}
function we(e, t) {
  const s = Se(e.family);
  return (
    Se(s) === t ||
      (t.endsWith(Se(s)) && (t.match(e.weight) || t.match(e.style))),
    !0
  );
}
function ye(e) {
  Array.isArray(e) || (e = [e]);
  const t = new Set();
  return (
    e.forEach((e) => {
      if (e)
        switch (typeof e) {
          case "string":
            return void t.add(
              ...(function (e) {
                const t = [];
                for (const s of document.fonts) we(s, e) && t.push(s);
                return t;
              })(e),
            );
          case "object":
            return void t.add(
              ...(function (e) {
                const t = [];
                for (const s of document.fonts) ve(s, e) && t.push(s);
                return t;
              })(e),
            );
        }
      throw new TypeError(
        "Expected font query to be font shorthand or font reference",
      );
    }),
    [...t]
  );
}
async function xe(e, t = !1) {
  if (0 === (e.size ?? e.length))
    throw new TypeError("Expected at least one font");
  return await (async function (e, t = !1) {
    t && console.group("[loadFonts:API]", e.length, "/", document.fonts.size);
    const s = [];
    for (const i of e)
      i instanceof FontFace
        ? (document.fonts.has(i) || document.fonts.add(i), s.push(be(i)))
        : s.push(...ye(i).map((e) => be(e)));
    return (t && console.groupEnd(), await Promise.all(s));
  })([...e], t);
}
async function be(e) {
  return await ("unloaded" === e.status ? e.load() : e.loaded).then(
    (e) => e,
    (t) => e,
  );
}
function Se(e) {
  return e.replace(/['"]+/g, "");
}
async function Le(e) {
  const t = ye(e);
  return await Promise.all(t.map((e) => e.loaded));
}
e.registerPlugin(h);
e.registerPlugin(a);
e.registerPlugin(a);
e.registerPlugin(h);
e.registerPlugin(n, r);
const Pe = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      AnchorsNav: class extends s {
        constructor(e) {
          (super(e),
            (this.events = { click: { link: "onClick" } }),
            (this.$list = this.$("list")[0]),
            (this.$links = Array.from(this.$("link"))));
        }
        onClick(e) {
          (e.preventDefault(),
            e.stopPropagation(),
            this.call(
              "scrollTo",
              { target: e.currentTarget.getAttribute("href"), offset: 0 },
              "Scroll",
            ));
        }
      },
      Button: class extends s {
        constructor(e) {
          (super(e),
            (this.buttons = [...document.querySelectorAll("[data-magnetic]")]));
        }
        init() {
          ce || this.animate();
        }
        animate() {
          this.raf = window.requestAnimationFrame(() => this.animate());
          let t = performance.now();
          ((this.deltaTime = t - this.lastTime),
            (this.lastTime = t),
            (this.mouseX = window.mouse[0]),
            (this.mouseY = window.mouse[1]),
            this.buttons.forEach((t) => {
              const s = t.querySelector(".button__text"),
                i = t.getBoundingClientRect(),
                n = this.mouseX - (i.x + i.width / 2),
                r = this.mouseY - (i.y + i.height / 2),
                a = Math.sqrt(n * n + r * r),
                o = Math.atan2(r, n),
                l = Math.min(a, 10),
                h = l * Math.cos(o),
                c = l * Math.sin(o);
              this.mouseX > i.x - 10 &&
              this.mouseX < i.x + (i.width + 10) &&
              this.mouseY > i.y - 10 &&
              this.mouseY < i.y + (i.height + 10)
                ? e
                    .timeline()
                    .to(t, { duration: 0.6, x: h, y: c })
                    .to(
                      s,
                      {
                        duration: 0.8,
                        ease: "power1.easeOut",
                        scale: 0.95,
                        x: 0.4 * h,
                        y: 0.4 * c,
                      },
                      "<",
                    )
                : e
                    .timeline()
                    .to(t, { duration: 0.6, x: 0, y: 0 })
                    .to(
                      s,
                      {
                        duration: 0.8,
                        ease: "power1.easeOut",
                        scale: 1,
                        x: 0,
                        y: 0,
                      },
                      "<",
                    );
            }));
        }
        cancel() {
          this.raf && window.cancelAnimationFrame(this.raf);
        }
        destroy() {
          this.cancel();
        }
      },
      Carousel: class extends s {
        constructor(t) {
          (super(t),
            (this.$container = this.$("container")[0]),
            (this.$prevButton = this.$("prev")[0] || null),
            (this.$nextButton = this.$("next")[0] || null),
            (this.$controls = this.$("controls")[0] || null),
            (this.type = this.getData("type") || "default"),
            (this.length = this.$("item").length),
            (this.events = { click: { prev: "prev", next: "next" } }),
            (this.onProgress = this.onProgress.bind(this)),
            e.set(".swiper-w", { overflow: "visible" }));
        }
        init() {
          if ("gallery" !== this.type || this.length <= 1 || !ce) return;
          const e = {
            modules: [d, m, u],
            speed: 800,
            a11y: !0,
            centeredSlides: !1,
            slidesPerView: "auto",
            navigation: {
              nextEl: this.$nextButton,
              prevEl: this.$prevButton,
            },
            allowTouchMove: !1,
            slidePerGroup: 1,
            breakpoints: {
              480: { slidesPerView: 1 },
              991: { slidesPerView: 2 },
            },
          };
          ((this.carousel = new c(this.$container, e)),
            this.carousel.on("progress", this.onProgress));
        }
        prev() {
          this.carousel.slideTo(this.carousel.realIndex);
        }
        next() {
          this.carousel.slideTo(this.carousel.realIndex);
        }
        compute(e) {
          return e.getBoundingClientRect();
        }
        onProgress(e, t) {
          this.el.style.setProperty("--progress", t);
        }
        destroy() {
          var e;
          (super.destroy(), null == (e = this.carousel) || e.destroy(!0, !0));
        }
      },
      Cursor: class extends s {
        constructor(e) {
          (super(e),
            (this.mouse = [0, 0]),
            (this.mouseLerp = [0, 0]),
            (this.lerpOffset = { value: 0 }),
            (this.isFixed = "string" == typeof this.getData("fixed")),
            (this.cursorSlideRatio = 10),
            (this.deltaTime = 0),
            (this.deltaTimeRatio = 120),
            (this.lastTime = 0),
            (this.$cursorInner = this.$("cursorInner")[0]),
            (this.bcr = { top: 0, left: 0 }),
            (this.id = this.el.getAttribute("data-module-cursor")));
        }
        init() {}
        updateOffset(e) {
          ((this.bcr.top = e.top + window.scrollInstance.scroll),
            (this.bcr.left = e.left));
        }
        display() {
          ce ||
            (this.cancel(),
            this.animate(),
            this.el.classList.add("is-visible"),
            null != this.callbackGsap && this.callbackGsap.kill(),
            e.to(this.lerpOffset, { value: 0.3, duration: 0.1 }));
        }
        hide() {
          ce ||
            (null != this.delayCallbackClass && this.delayCallbackClass.kill(),
            this.el.classList.remove("is-visible"),
            (this.callbackGsap = e.to(this.lerpOffset, {
              value: 0,
              duration: 0.05,
              onComplete: () => {
                this.cancel();
              },
            })));
        }
        animate() {
          this.raf = window.requestAnimationFrame(() => this.animate());
          let e = performance.now();
          ((this.deltaTime = e - this.lastTime),
            (this.lastTime = e),
            (this.mouse = [
              window.mouse[0] - this.bcr.left,
              window.mouse[1] - this.bcr.top,
            ]),
            (this.mouseLerp[0] = ge(
              this.mouseLerp[0],
              this.mouse[0],
              1 -
                Math.pow(
                  this.lerpOffset.value,
                  this.deltaTime / this.deltaTimeRatio,
                ),
            )),
            (this.mouseLerp[1] = ge(
              this.mouseLerp[1],
              this.mouse[1],
              1 -
                Math.pow(
                  this.lerpOffset.value,
                  this.deltaTime / this.deltaTimeRatio,
                ),
            )));
          let t = this.mouseLerp[1];
          if (
            (null == window.scrollInstance.scroll ||
              this.isFixed ||
              (t += window.scrollInstance.scroll),
        "hero" === this.id)
          ) {
            const e = 180,
              s = (window.mouse[0] / window.innerWidth / 2) * e - 45;
            ((this.el.style.transform = `translate3d(${this.mouseLerp[0]}px,${t}px,0)`),
              (this.$cursorInner.style.transform = `rotate(${s}deg) translate3d(${(this.mouse[0] - this.mouseLerp[0]) / this.cursorSlideRatio}px,${(this.mouse[1] - this.mouseLerp[1]) / this.cursorSlideRatio}px,0)`));
          } else
            ((this.el.style.transform = `translate3d(${this.mouseLerp[0]}px,${t}px,0)`),
              (this.$cursorInner.style.transform = `translate3d(${(this.mouse[0] - this.mouseLerp[0]) / this.cursorSlideRatio}px,${(this.mouse[1] - this.mouseLerp[1]) / this.cursorSlideRatio}px,0)`));
        }
        cancel() {
          this.raf && window.cancelAnimationFrame(this.raf);
        }
        destroy() {
          this.cancel();
        }
      },
      CursorZone: class extends s {
        constructor(e) {
          (super(e),
            ce ||
              (this.events = {
                mouseenter: { zone: "enter" },
                mouseleave: { zone: "leave" },
                mousemove: { zone: "move" },
              }),
            (this.isDisplayed = !1),
            (this.id = this.el.getAttribute("data-module-cursor-zone")),
            (this.$zone = this.$("zone")[0]));
        }
        init() {
          ((this.bindResize = this.resize.bind(this)),
            window.addEventListener("resize", this.bindResize));
        }
        ready() {
          (this.resize(),
            e.delayedCall(6, () => {
              this.resize();
            }),
            e.delayedCall(10, () => {
              this.resize();
            }));
        }
        enter() {
          ((this.isDisplayed = !0),
            (this.bcr = this.$zone.getBoundingClientRect()),
            this.call("updateOffset", this.bcr, "Cursor", this.id),
            this.call("display", {}, "Cursor", this.id));
        }
        move(e) {
          this.isDisplayed || this.enter();
        }
        leave() {
          this.call("hide", {}, "Cursor", this.id);
        }
        resize() {
          (null != this.resizeTimeout && this.resizeTimeout.kill(),
            (this.resizeTimeout = e.delayedCall(0.3, () => {
              this.resizeDebounce();
            })));
        }
        resizeDebounce() {
          ((this.bcr = this.$zone.getBoundingClientRect()),
            ce || this.call("updateOffset", this.bcr, "Cursor", this.id));
        }
        destroy() {
          window.removeEventListener("resize", this.bindResize);
        }
      },
      Header: de,
      Gallery: class extends s {
        constructor(e) {
          (super(e),
            (this.$draggableContainer = this.$("container")[0]),
            (this.$sliderInner = this.$("slider")[0]),
            (this.$sliderItems = this.$("slide")),
            (this.$sliderImages = this.$("img")),
            (this.$dragCursor = this.$("cursor")[0]),
            (this.$dragCursorInner = this.$("cursorInner")[0]));
        }
        init() {
          ce || this.initSlider();
        }
        initSlider() {
          const t = this.$sliderItems[0].offsetWidth,
            s = this.$sliderItems.length,
            i = t * s,
            r = 90 - (i - window.innerWidth + t);
          this.$sliderInner.style.width = `${i}px`;
          let a = window.innerWidth / 2,
            o = window.innerHeight,
            l = 0,
            h = 0;
          let c = 0,
            d = 0;
          this.animationFrameId;
          const u = this.$dragCursor.offsetHeight / 2,
            m = this.$dragCursor.offsetWidth / 2;
          let p = this.$sliderInner.getBoundingClientRect().left;
          ((this.scaleStrength = 1.75),
            e.set(this.$dragCursor, { x: a - m, y: o - u, opacity: 0 }));
          let g = 0,
            f = null;
          const v = () => {
            const i = -this.$sliderInner.getBoundingClientRect().left;
            ((g = Math.min(s - 1, Math.round(i / t))),
              this.$sliderItems.forEach((t, s) => {
                const i = t.querySelector("img"),
                  n = s === g,
                  r = s === f;
                e.to(i, { opacity: n || r ? 1 : 0.2, duration: 1 });
              }));
          };
          (e.set(this.$sliderImages, { opacity: 0.2 }),
            (() => {
              const e = () => {
                ((f = null), v());
              };
              (this.$draggableContainer.addEventListener("mouseleave", e),
                this.$sliderItems.forEach((t, s) => {
                  (t.addEventListener("mouseenter", () => {
                    ((f = s), v());
                  }),
                    t.addEventListener("mouseleave", () => {
                      f === s && e();
                    }));
                }));
            })(),
            v());
          let w = 0;
          const y = (e) => {
              const t = performance.now();
              if (t - w >= 16) {
                const s = this.$draggableContainer.getBoundingClientRect();
                ((a = e.clientX - s.left),
                  (o = e.clientY - s.top + window.scrollY),
                  (w = t));
              }
            },
            x = () => {
              if (!this.$draggableContainer.matches(":hover"))
                return void (this.animationFrameId = void 0);
              ((l += 0.17 * (a - l)),
                (h += 0.17 * (o - h)),
                (Math.abs(l - c) > 0.5 || Math.abs(h - d) > 0.5) &&
                  (e.to(this.$dragCursor, {
                    x: l - m,
                    y: h - u - window.scrollY,
                    ease: "none",
                    duration: 0.15,
                    force3D: !0,
                  }),
                  (c = l),
                  (d = h)));
              const t = this.$sliderInner.getBoundingClientRect().left,
                s = t - p;
              ((this.scaleFactor = Math.abs(
                Math.round(this.scaleStrength * s) / 100,
              )),
                (this.normalizedScale = Math.min(
                  Math.max(this.scaleFactor, 0),
                  1,
                )),
                v(),
                (p = t),
                (this.animationFrameId = requestAnimationFrame(x)));
            };
          ((this.handleMouseEnter = () => {
            (this.$dragCursor.classList.add("moving"),
              e.to(this.$dragCursor, { opacity: 1, duration: 0.2 }),
              e.to(this.$dragCursorInner, {
                scale: 1,
                duration: 0.4,
                ease: "power4",
              }),
              (oe.style.cursor = "none"),
              this.$draggableContainer.addEventListener("mousemove", y),
              this.animationFrameId || x());
          }),
            (this.handleMouseLeave = () => {
              (this.$dragCursor.classList.remove("moving", "is-on"),
                e.to(this.$dragCursorInner, {
                  scale: 0,
                  delay: 0.1,
                  duration: 0.3,
                  ease: "power4",
                }),
                (oe.style.cursor = "auto"),
                this.$draggableContainer.removeEventListener("mousemove", y));
            }),
            (this.handleMouseDown = () => {
              (this.$dragCursor.classList.add("down", "is-on"),
                e.to(this.$dragCursorInner, {
                  scale: 0.8,
                  duration: 0.4,
                  ease: "power4",
                }),
                this.$draggableContainer.removeEventListener(
                  "mousemove",
                  this.handleMouseDown,
                ));
            }),
            (this.handleMouseUp = () => {
              (this.$dragCursor.classList.remove("down", "is-on"),
                e.to(this.$dragCursorInner, {
                  scale: 1,
                  duration: 0.4,
                  ease: "power4",
                }),
                this.$draggableContainer.removeEventListener(
                  "mousemove",
                  this.handleMouseDown,
                ));
            }),
            ce ||
              (n.create(this.$sliderInner, {
                type: "x",
                bounds: { minX: r, maxX: 0 },
                inertia: !0,
                cursor: "none",
                edgeResistance: 0.95,
                snap: {
                  x: function (s) {
                    const i = e.utils.snap(t - 0.05 * t, s);
                    return Math.max(r, Math.min(0, i));
                  },
                },
                onDrag: () => {},
                onThrowUpdate: () => {
                  e.to(this.$sliderItems, {
                    scale: 1 - this.normalizedScale / 10,
                    force3D: !0,
                  });
                },
                onThrowComplete: () => {
                  e.to(this.$sliderItems, { scale: 1, force3D: !0 });
                },
                onDragStart: () => {
                  (this.$draggableContainer.classList.add("down"),
                    e.to(this.$dragCursorInner, {
                      scale: 0.8,
                      duration: 0.4,
                      ease: "power4",
                    }),
                    e.to(this.$sliderItems, {
                      scaleY: 0.95,
                      duration: 0.8,
                      stagger: 0.05,
                      ease: se,
                    }),
                    e.to(this.$sliderImages, {
                      scale: 1.05,
                      stagger: 0.05,
                      duration: 0.8,
                      ease: se,
                    }));
                },
                onDragEnd: () => {
                  (this.$draggableContainer.classList.remove("down"),
                    e.to(this.$dragCursorInner, {
                      scale: 1,
                      duration: 0.4,
                      ease: "power4",
                    }),
                    e.to(this.$sliderItems, {
                      scaleY: 1,
                      duration: 0.8,
                      stagger: 0.05,
                      ease: se,
                    }),
                    e.to(this.$sliderImages, {
                      scale: 1,
                      stagger: 0.05,
                      duration: 0.8,
                      ease: se,
                    }),
                    v());
                },
              }),
              this.$draggableContainer.addEventListener(
                "mouseenter",
                this.handleMouseEnter,
              ),
              this.$draggableContainer.addEventListener(
                "mouseleave",
                this.handleMouseLeave,
              ),
              this.$draggableContainer.addEventListener(
                "mousedown",
                this.handleMouseDown,
              ),
              this.$draggableContainer.addEventListener(
                "mouseup",
                this.handleMouseUp,
              )));
        }
        destroy() {
          (cancelAnimationFrame(this.animationFrameId),
            this.$draggableContainer.removeEventListener(
              "mouseenter",
              this.handleMouseEnter,
            ),
            this.$draggableContainer.removeEventListener(
              "mouseleave",
              this.handleMouseLeave,
            ),
            this.$draggableContainer.removeEventListener(
              "mousemove",
              this.handleMouseMove,
            ),
            this.$draggableContainer.removeEventListener(
              "mousedown",
              this.handleMouseDown,
            ),
            this.$draggableContainer.removeEventListener(
              "mouseup",
              this.handleMouseUp,
            ),
            super.destroy());
        }
      },
      Intro: class extends s {
        constructor(e) {
          super(e);
          const readMarginLeft = (selector) => {
            const element = document.querySelector(selector);
            return element
              ? Number.parseFloat(window.getComputedStyle(element).marginLeft) || 0
              : 0;
          };
          ((this.$el = this.el),
            (this.heroTitle01ML = 0.8 * readMarginLeft(".hero__title-w._01")),
            (this.heroTitle02ML = 2 * readMarginLeft(".hero__title-w._02")),
            (this.heroTitle03ML = 1.1 * readMarginLeft(".hero__title-w._03")),
            (this.heroTitle04ML = 0.9 * readMarginLeft(".hero__title-w._04")));
        }
        init() {
          Le(J.EAGER).then((e) => this.onFontsLoaded(e));
        }
        onFontsLoaded(e) {
          document.fonts.ready.then(() => {
            this.revealIntro();
          });
        }
        revealIntro() {
          const t = document.querySelectorAll(".hero__title");
          let s = document.querySelectorAll(".hero__desc"),
            i = document.querySelectorAll(".hero__subtitle");
          new h(s, { type: "lines", linesClass: "single-line" });
          document
            .querySelectorAll(".hero__desc .single-line")
            .forEach((line) => {
              const inner = document.createElement("div");
              inner.className = "single-line-inner";
              while (line.firstChild) inner.append(line.firstChild);
              line.append(inner);
            });
          let n = document.querySelectorAll(
            ".hero__desc .single-line-inner",
          );
          const r = () => {
            const t = e.timeline({ defaults: { ease: re, duration: ee } });
            return (
              t
                .from(".hero__title-w._01", { marginLeft: this.heroTitle01ML })
                .from(
                  ".hero__title-w._02",
                  { marginLeft: this.heroTitle02ML },
                  "<",
                )
                .from(
                  ".hero__title-w._03",
                  { marginLeft: this.heroTitle03ML },
                  "<",
                )
                .from(
                  ".hero__title-w._04",
                  { marginLeft: this.heroTitle04ML },
                  "<",
                ),
              t
            );
          };
          ((this.masterTl = e.timeline({ onComplete: () => {} })),
            this.masterTl.add(
              void t.forEach((t) => {
                const s = e.timeline({ delay: 2 });
                return (
                  s.fromTo(
                    t,
                    {
                      "will-change": "transform",
                      transformOrigin: "50% 50%",
                      yPercent: 100,
                      skewY: -5,
                      rotateY: 10,
                      scale: 1.15,
                      filter: "blur(8px)",
                      opacity: 0,
                    },
                    {
                      duration: te,
                      ease: ie,
                      yPercent: 0,
                      skewY: 0,
                      rotateY: 0,
                      scale: 1,
                      filter: "blur(0px)",
                      opacity: 1,
                    },
                  ),
                  s
                );
              }),
            ),
            ce ||
              this.masterTl
                .add(
                  e
                    .timeline({})
                    .fromTo(
                      ".header",
                      { yPercent: -200 },
                      { yPercent: 0, duration: ee, ease: se },
                    ),
                  "<2.4",
                )
                .add(r(), "<1.2")
                .add(
                  (function () {
                    const t = e.timeline({});
                    return (
                      t
                        .fromTo(
                          i,
                          { marginTop: "-3.8rem", opacity: 0 },
                          {
                            duration: Q,
                            ease: se,
                            marginTop: "-4.8rem",
                            opacity: 1,
                          },
                        )
                        .from(
                          n,
                          {
                            yPercent: 115,
                            ease: se,
                            duration: Q,
                            clearProps: "all",
                          },
                          "<",
                        ),
                      t
                    );
                  })(),
                  "<.8",
                ));
        }
        killTimeline() {
          var e;
          null == (e = this.masterTl) || e.kill();
        }
        destroy() {
          (super.destroy(), this.killTimeline());
        }
      },
      Load: class extends s {
        constructor(e) {
          super(e);
        }
        init() {
          ((this.load = new i({ enterDelay: 300, transitions: {} })),
            this.load.on("loading", (e, t) => {
              window.gl.destroy();
            }),
            this.load.on("loaded", (e, t, s) => {
              (this.call("destroy", t, "app"), this.call("update", s, "app"));
            }),
            this.load.on("ready", (e, t) => {
              (document.documentElement.setAttribute("lang", "zh-CN"),
                window.gl.add());
            }));
        }
      },
      Mouse: class extends s {
        constructor(e) {
          super(e);
        }
        init() {
          ce ||
            ((this.bindMousemove = this.mousemove.bind(this)),
            window.addEventListener("mousemove", this.bindMousemove),
            (window.mouse = [0.07 * me.value.width, 0.89 * me.value.height]));
        }
        mousemove(e) {
          window.mouse = [e.clientX, e.clientY];
        }
      },
      Preloader: class extends s {
        constructor(e) {
          (super(e),
            (this.preloader = document.getElementById("preloader")),
            (this.preloaderOuter = document.getElementById("preloaderOuter")),
            (this.cube = document.getElementById("cubeInner")));
        }
        init() {
          (this.call("stop", null, "Scroll"),
            history.scrollRestoration &&
              ((history.scrollRestoration = "manual"), window.scrollTo(0, 0)),
            ae.classList.add("is-loading"),
            "home" === oe.querySelector("main").dataset.template
              ? this.launch()
              : (ae.classList.remove("is-loading"), this.preloader.remove()));
        }
        launch() {
          (e.set(this.preloader, { opacity: 1 }),
            this.loadData().then(() => {
              this.animate();
            }));
        }
        loadData() {
          return new Promise((t) => {
            this.animation = e.timeline({
              onComplete: () => {
                (setTimeout(() => {
                  (this.preloader.remove(),
                    ae.classList.remove("is-loading"),
                    this.call("start", null, "Scroll"));
                }, 5500),
                  t());
              },
            });
          });
        }
        animate() {
          (this.animation.from(".cube-container", {
            width: 0,
            height: 0,
            duration: 1.2,
            ease: re,
          }),
            this.animation.to(
              this.cube,
              {
                rotateX: 90,
                rotateY: -90,
                rotateZ: 90,
                duration: 1.2,
                ease: re,
                onComplete: () => {
                  document.body.setAttribute("data-theme", "light");
                },
              },
              "-=0.2",
            ),
            this.animation.fromTo(
              this.preloaderOuter,
              {
                clipPath:
                  "polygon(\n                    0% 0%, \n                    0% 100%, \n                    calc(50% - 0rem) 100%, /* Left edge of the square */\n                    calc(50% - 0rem) calc(50% - 0rem), /* Top-left corner of the square */\n                    calc(50% + 0rem) calc(50% - 0rem), /* Top-right corner of the square */\n                    calc(50% + 0rem) calc(50% + 0rem), /* Bottom-right corner of the square */\n                    calc(50% - 0rem) calc(50% + 0rem), /* Bottom-left corner of the square */\n                    calc(50% - 0rem) 100%, /* Left edge of the square */\n                    100% 100%, \n                    100% 0%\n                )",
              },
              {
                clipPath:
                  "polygon(\n                        0% 0%, \n                        0% 100%, \n                        calc(50% - 3rem) 100%, /* Left edge of the square */\n                        calc(50% - 3rem) calc(50% - 3rem), /* Top-left corner of the square */\n                        calc(50% + 3rem) calc(50% - 3rem), /* Top-right corner of the square */\n                        calc(50% + 3rem) calc(50% + 3rem), /* Bottom-right corner of the square */\n                        calc(50% - 3rem) calc(50% + 3rem), /* Bottom-left corner of the square */\n                        calc(50% - 3rem) 100%, /* Left edge of the square */\n                        100% 100%, \n                        100% 0%\n                    )",
                duration: 1.2,
                ease: re,
              },
              "<.4",
            ),
            this.animation.to(
              this.preloaderOuter,
              {
                clipPath:
                  "polygon(\n                    0% 0%, \n                    0% 100%, \n                    calc(0% - 0rem) 100%, /* Left edge of the square */\n                    calc(0% - 0rem) calc(0% - 0rem), /* Top-left corner of the square */\n                    calc(100% + 0rem) calc(0% - 0rem), /* Top-right corner of the square */\n                    calc(100% + 0rem) calc(100% + 0rem), /* Bottom-right corner of the square */\n                    calc(0% - 0rem) calc(100% + 0rem), /* Bottom-left corner of the square */\n                    calc(0% - 0rem) 100%, /* Left edge of the square */\n                    100% 100%, \n                    100% 0%\n                )",
                duration: 1.2,
                ease: re,
              },
              "<.8",
            ),
            this.animation.fromTo(
              this.preloader,
              {
                clipPath:
                  "polygon(\n                            0% 0%, \n                            0% 100%, \n                            calc(50% - 0rem) 100%, /* Left edge of the square */\n                            calc(50% - 0rem) calc(50% - 0rem), /* Top-left corner of the square */\n                            calc(50% + 0rem) calc(50% - 0rem), /* Top-right corner of the square */\n                            calc(50% + 0rem) calc(50% + 0rem), /* Bottom-right corner of the square */\n                            calc(50% - 0rem) calc(50% + 0rem), /* Bottom-left corner of the square */\n                            calc(50% - 0rem) 100%, /* Left edge of the square */\n                            100% 100%, \n                            100% 0%\n                        )",
              },
              {
                clipPath:
                  "polygon(\n                    0% 0%, \n                    0% 100%, \n                    calc(0% - 0rem) 100%, /* Left edge of the square */\n                    calc(0% - 0rem) calc(0% - 0rem), /* Top-left corner of the square */\n                    calc(100% + 0rem) calc(0% - 0rem), /* Top-right corner of the square */\n                    calc(100% + 0rem) calc(100% + 0rem), /* Bottom-right corner of the square */\n                    calc(0% - 0rem) calc(100% + 0rem), /* Bottom-left corner of the square */\n                    calc(0% - 0rem) 100%, /* Left edge of the square */\n                    100% 100%, \n                    100% 0%\n                )",
                duration: 1.2,
                ease: re,
              },
              "<.1",
            ));
        }
      },
      Scroll: class extends s {
        static get settings() {
          return {
            CLASS_SCROLL_TOP: "is-scroll-top",
            CLASS_SCROLL_UP: "is-scrolling-up",
            CLASS_SCROLL_DOWN: "is-scrolling-down",
          };
        }
        constructor(e) {
          (super(e),
            (this.scrollDirection = 1),
            (this.lastProgress = 0),
            (this.lastDirectionChange = 0),
            (this.orientation = this.getData("orientation") || "vertical"),
            (this.initialColorTheme = "light"),
            (this.currentBg = this.initialColorTheme),
            (this.previousBg = null),
            (this.onResizeBind = this.onResize.bind(this)),
            (this.onScrollBind = this.onScroll.bind(this)));
        }
        init() {
          ((window.scrollInstance = {
            velocity: 0,
            direction: "down",
            progress: 0,
            scroll: 0,
          }),
            ae.scrollTop < 80 ? ae.classList.add(le) : ae.classList.remove(le),
            this.bindEvents(),
            (this.locomotiveScroll = new o({
              lenisOptions: {
                orientation: this.orientation,
                gestureOrientation: this.orientation,
                syncTouch: !0,
                autoRaf: !1,
              },
              autoResize: !0,
              autoStart: !1,
              scrollCallback: this.onScrollBind,
              modularInstance: this,
              initCustomTicker: (t) => {
                e.ticker.add(t, !1, !0);
              },
              destroyCustomTicker: (t) => {
                e.ticker.remove(t);
              },
            })),
            (this.scrollbar = document.querySelector("[data-scrollbar]")),
            this.scrollbar.classList.contains("active")
              ? this.customScrollbar(!0)
              : this.customScrollbar());
        }
        destroy() {
          (this.unbindEvents(),
            this.locomotiveScroll.destroy(),
            ae.classList.remove(he));
        }
        bindEvents() {
          window.addEventListener("resize", this.onResizeBind);
        }
        unbindEvents() {
          window.removeEventListener("resize", this.onResizeBind);
        }
        onScroll({
          scroll: e,
          limit: t,
          velocity: s,
          direction: i,
          progress: n,
        }) {
          const r = e < 10;
          (ae.classList.toggle(le, r),
            n > this.lastProgress
              ? 1 !== this.scrollDirection &&
                ((this.lastDirectionChange = e),
                (this.scrollDirection = 1),
                ae.style.setProperty(
                  "--scroll-direction",
                  this.scrollDirection,
                ),
                ae.classList.remove(he))
              : -1 !== this.scrollDirection &&
                ((this.lastDirectionChange = e),
                (this.scrollDirection = -1),
                ae.style.setProperty(
                  "--scroll-direction",
                  this.scrollDirection,
                ),
                ae.classList.add(he)),
            (window.scrollInstance = {
              scroll: e,
              limit: t,
              velocity: s,
              direction: this.scrollDirection,
              progress: n,
            }),
            (this.lastProgress = n),
            this.call("setSticky", !r && i < 0, "Header"),
            a.update());
        }
        onResize() {
          var e;
          null == (e = this.locomotiveScroll) || e.resize();
        }
        scrollTo(e) {
          var t;
          let { target: s, ...i } = e;
          ((i = Object.assign({ duration: 1 }, i)),
            null == (t = this.locomotiveScroll) || t.scrollTo(s, i));
        }
        update() {
          var e;
          null == (e = this.locomotiveScroll) || e.update();
        }
        stop() {
          this.locomotiveScroll.stop();
        }
        start() {
          this.locomotiveScroll.start();
        }
        customScrollbar(t) {
          (t && a.killAll(), this.scrollbar.classList.add("active"));
          let s = this.scrollbar.getBoundingClientRect().height,
            i = document.querySelector(
              "[data-scrollbar] [data-scrollbar-thumb]",
            ),
            r = i.getBoundingClientRect().height,
            o = document
              .querySelector("[data-module-scroll]")
              .getBoundingClientRect().height,
            l = this.locomotiveScroll,
            h = this.scrollbar;
          document.querySelector('[data-scrollbar-thumb-height="variable"]') &&
            (e.set(i, { height: (s / o) * s }), (r = (s / o) * s));
          let c = e.to(i, {
            y: s - r,
            ease: "none",
            scrollTrigger: { start: "0%", end: "max", scrub: !0 },
          });
          n.create(i, {
            type: "y",
            bounds: this.scrollbar,
            inertia: !1,
            onDrag() {
              let t = e.utils.normalize(this.minY, this.maxY, this.y);
              (l.scrollTo((o - s) * t, { immediate: !0 }),
                h.setAttribute("data-scrollbar-drag", "true"));
            },
            onRelease() {
              let t = e.utils.normalize(this.minY, this.maxY, this.y);
              (c.scrollTrigger.enable(),
                c.progress(t),
                h.setAttribute("data-scrollbar-drag", "false"));
            },
          });
        }
        toggleColorTheme(e) {
          const { target: t, way: s } = e;
          if ("enter" === s)
            this.currentBg !== t.dataset.theme &&
              ((this.previousBg = this.currentBg),
              (this.currentBg = t.dataset.theme),
              (oe.dataset.theme = this.currentBg));
          else if ("leave" === s) {
            const e = this.previousBg || this.initialColorTheme;
            oe.dataset.theme !== e &&
              ((oe.dataset.theme = e), (this.currentBg = e));
          }
        }
      },
      Spirit: class extends s {
        constructor(t) {
          (super(t),
            e.set(".spirit-visual__desc01,.spirit-visual__desc02,.spirit-visual__desc03", {
              opacity: 0.2,
            }),
            ce
              ? (e.set(".spirit-visual__shape01", { opacity: 0.2 }),
                e.set(".spirit-visual__shape02,.spirit-visual__shape03", { opacity: 0 }))
              : (e.set(".spirit-visual__shape01,.spirit-visual__shape02,.spirit-visual__shape03", {
                  opacity: 0.2,
                }),
                e.set(".spirit-visual__mask-w", { opacity: 0 })));
        }
        init() {
          ce ? this.initMobileTimeline() : this.initTimeline();
        }
        initMobileTimeline() {
          ((this.spiritTl = e
            .timeline({ defaults: { duration: 6, ease: se } })
            .to(".spirit-visual__shape01, .spirit-visual__desc01", { opacity: 1 })
            .to({}, { duration: 3 })
            .to(".spirit-visual__shape02, .spirit-visual__desc02", { opacity: 1 })
            .to(".spirit-visual__desc01", { opacity: 0.2 }, "<")
            .to({}, { duration: 3 })
            .to(".spirit-visual__shape03, .spirit-visual__desc03", { opacity: 1 })
            .to(".spirit-visual__desc02", { opacity: 0.2 }, "<")
            .to({}, { duration: 3 })),
            a.create({
              trigger: "#associationSpiritSticky",
              start: "0% 0%",
              end: "350% 100%",
              pin: !0,
              anticipatePin: 1,
              scrub: !0,
              animation: this.spiritTl,
              invalidateOnRefresh: !0,
            }),
            (this.spiritOutTl = e
              .timeline({ defaults: { duration: 4, ease: se } })
              .to(".spirit-visual__mask-w", { opacity: 1 }, "<")),
            a.create({
              trigger: "#join-us",
              start: "0% 0%",
              end: "+=350% 75%",
              anticipatePin: 1,
              scrub: !0,
              animation: this.spiritOutTl,
              invalidateOnRefresh: !0,
            }));
        }
        initTimeline() {
          ((this.spiritTl = e
            .timeline({ defaults: { duration: 4, ease: se } })
            .to(".spirit-visual__shape01, .spirit-visual__desc01", { opacity: 1 })
            .to({}, { duration: 2 })
            .to(".spirit-visual__shape02, .spirit-visual__desc02", { opacity: 1 })
            .to(".spirit-visual__desc01", { opacity: 0.2 }, "<")
            .to({}, { duration: 2 })
            .to(".spirit-visual__shape03, .spirit-visual__desc03", { opacity: 1 })
            .to(".spirit-visual__desc02", { opacity: 0.2 }, "<")
            .to({}, { duration: 2 })),
            a.create({
              trigger: "#associationSpiritSticky",
              start: "0% 0%",
              end: "250% 100%",
              pin: !0,
              anticipatePin: 1,
              scrub: 1,
              animation: this.spiritTl,
              invalidateOnRefresh: !0,
            }),
            (this.spiritOutTl = e
              .timeline({ defaults: { duration: 4, ease: se } })
              .to(".association-spirit-w", {
                clipPath: "inset(0% 8rem 58rem round 0rem 0rem 2.4rem 2.4rem",
              })
              .to(".spirit-visual__mask-w", { opacity: 1 }, "<")),
            a.create({
              trigger: "#join-us",
              start: "0% 0%",
              end: "+=250% 75%",
              anticipatePin: 1,
              scrub: 1,
              animation: this.spiritOutTl,
              invalidateOnRefresh: !0,
            }));
        }
        onInview(e) {
          let t;
          if (e.target) t = e.target;
          else {
            if (!e.targetEl) return;
            t = e.targetEl;
          }
          t.dataset.moduleVideoInview === this.moduleID &&
            ("enter" === e.way
              ? console.log("enter")
              : "leave" === e.way && console.log("leave"));
        }
        onScrollProgress(e) {
          var t;
          ((this.progress = e),
            (this.itemsProgress.current = ((e = 0, t = 1, s) =>
              Math.min(t, Math.max(e, s)))(
              0,
              1,
              map(e, this.itemsProgress.from, this.itemsProgress.to, 0.1, 1),
            )),
            null == (t = this.dotTl) || t.progress(this.itemsProgress.current));
        }
        killTimeline() {
          var e;
          null == (e = this.spiritTl) || e.kill();
        }
        destroy() {
          (super.destroy(), this.killTimeline());
        }
      },
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
class Me {
  constructor() {
    ((this.gl = new Ie()),
      (this.instance = new g(
        0,
        this.gl.sizes.width / this.gl.sizes.height,
        0.1,
        10,
      )),
      (this.instance.position.z = 10),
      (this.instance.aspect = this.gl.sizes.width / this.gl.sizes.height),
      (this.instance.fov =
        2 *
        Math.atan(this.gl.sizes.height / 2 / this.instance.position.z) *
        (180 / Math.PI)),
      this.instance.updateProjectionMatrix());
  }
  resize() {
    ((this.instance.aspect = this.gl.sizes.width / this.gl.sizes.height),
      (this.instance.fov =
        2 *
        Math.atan(this.gl.sizes.height / 2 / this.instance.position.z) *
        (180 / Math.PI)),
      this.instance.updateProjectionMatrix());
  }
}
class Ce {
  constructor() {
    ((this.gl = new Ie()),
      (this.instance = new f({
        powerPreference: "high-performance",
        alpha: !0,
        precision: "lowp",
      })),
      this.instance.domElement.addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          enableGlFallback("context-lost");
        },
        { once: !0 },
      ),
      this.instance.setPixelRatio(this.gl.sizes.pixelRatio),
      this.instance.setSize(this.gl.sizes.width, this.gl.sizes.height));
  }
  add() {
    const e = document.querySelector("#container");
    e && e.appendChild(this.instance.domElement).classList.add("gl");
  }
  update() {
    for (const e in this.gl.world.scenes)
      this.gl.world.scenes[e].renderPipeline();
    (this.instance.setRenderTarget(null),
      this.instance.render(this.gl.scene, this.gl.camera.instance));
  }
  resize() {
    (this.instance.setPixelRatio(this.gl.sizes.pixelRatio),
      this.instance.setSize(this.gl.sizes.width, this.gl.sizes.height));
  }
}
class Te {
  constructor(e) {
    ((this.gl = new Ie()),
      (this.dom = e),
      (this.isMouseHolding = !1),
      (this.isMouseMoved = !1),
      (this.width =
        this.dom == document ? window.innerWidth : this.dom.offsetWidth),
      (this.height =
        this.dom == document ? window.innerHeight : this.dom.offsetHeight),
      (this.default = new v()),
      (this.normalized = { current: new v(), previous: new v() }),
      (this.direction = new v()),
      (this.pace = { default: 0, separated: new v() }),
      (this.pace = { default: 0, separated: new v() }),
      (this.drag = {
        start: new v(),
        distance: 0,
        side: "left",
        pace: { default: 0, separated: new v() },
      }),
      this.dom.addEventListener("mousemove", this.mousemove.bind(this)),
      this.dom.addEventListener("touchmove", this.touchmove.bind(this)),
      this.dom.addEventListener("mousedown", this.down.bind(this)),
      this.dom.addEventListener("touchstart", this.down.bind(this)),
      this.dom.addEventListener("mouseup", this.up.bind(this)),
      this.dom.addEventListener("touchend", this.up.bind(this)));
  }
  mousemove(e) {
    if (this.dom == document)
      ((this.isMouseMoved = !0),
        (this.default.x = e.clientX),
        (this.default.y = e.clientY),
        (this.normalized.current.x = (e.clientX / this.width) * 2 - 1),
        (this.normalized.current.y = (-e.clientY / this.height) * 2 + 1),
        this.isMouseHolding &&
          ((this.drag.distance = this.drag.start.distanceTo(this.default)),
          this.drag.start.x < this.default.x
            ? (this.drag.side = "right")
            : (this.drag.side = "left")));
    else {
      if (e.target != this.dom) return;
      ((this.isMouseMoved = !0),
        (this.default.x = e.offsetX),
        (this.default.y = e.offsetY),
        (this.normalized.current.x = (e.offsetX / this.width) * 2 - 1),
        (this.normalized.current.y = (-e.offsetY / this.height) * 2 + 1),
        this.isMouseHolding &&
          ((this.drag.distance.default = this.drag.start.distanceTo(
            this.default,
          )),
          (this.drag.distance.separated.x = this.default.x - this.drag.start.x),
          (this.drag.distance.separated.y = this.default.y - this.drag.start.y),
          this.drag.start.x < this.default.x
            ? (this.drag.side = "right")
            : (this.drag.side = "left")));
    }
  }
  touchmove(e) {
    e.touches &&
      ((this.isMouseMoved = !0),
      (this.default.x = e.touches[0].clientX),
      (this.default.y = e.touches[0].clientY),
      (this.normalized.current.x = (e.touches[0].clientX / this.width) * 2 - 1),
      (this.normalized.current.y =
        (-e.touches[0].clientY / this.height) * 2 + 1),
      this.isMouseHolding &&
        ((this.drag.distance.default = this.drag.start.distanceTo(
          this.default,
        )),
        (this.drag.distance.separated.x = this.default.x - this.drag.start.x),
        (this.drag.distance.separated.y = this.default.y - this.drag.start.y),
        this.drag.start.x < this.default.x
          ? (this.drag.side = "right")
          : (this.drag.side = "left")));
  }
  touchmove(e) {
    e.touches &&
      ((this.isMouseMoved = !0),
      (this.normalized.current.x = (e.touches[0].pageX / this.width) * 2 - 1),
      (this.normalized.current.y =
        (-e.touches[0].pageY / this.height) * 2 + 1));
  }
  down(e) {
    ((this.isMouseHolding = !0),
      this.drag.start.copy(this.default),
      e.touches &&
        ((this.normalized.current.x =
          (e.touches[0].pageX / this.width) * 2 - 1),
        (this.normalized.current.y =
          (-e.touches[0].pageY / this.height) * 2 + 1)));
  }
  up(e) {
    this.isMouseHolding = !1;
  }
  resize() {
    ((this.width =
      this.dom == document ? window.innerWidth : this.dom.offsetWidth),
      (this.height =
        this.dom == document ? window.innerHeight : this.dom.offsetHeight));
  }
  update() {
    ((this.pace.default = this.normalized.current.distanceTo(
      this.normalized.previous,
    )),
      (this.pace.separated.x =
        this.normalized.current.x - this.normalized.previous.x),
      (this.pace.separated.y =
        this.normalized.current.y - this.normalized.previous.y),
      this.direction
        .subVectors(this.normalized.current, this.normalized.previous)
        .normalize(),
      this.isMouseHolding
        ? ((this.drag.pace.default = this.normalized.current.distanceTo(
            this.normalized.previous,
          )),
          (this.drag.pace.separated.x =
            this.normalized.current.x - this.normalized.previous.x),
          (this.drag.pace.separated.y =
            this.normalized.current.y - this.normalized.previous.y))
        : ((this.drag.pace.default = 0),
          (this.drag.pace.separated.x = 0),
          (this.drag.pace.separated.y = 0)),
      this.normalized.previous.copy(this.normalized.current));
  }
  createEasedMovement(e) {
    let t = new v();
    return {
      value: t,
      update: (s) => {
        ((t.x = w.damp(t.x, this.default.x, e, s)),
          (t.y = w.damp(t.y, this.default.y, e, s)));
      },
    };
  }
  createEasedNormalized(e) {
    let t = new v();
    return {
      value: t,
      update: (s, i) => {
        ((t.x = w.damp(t.x, this.normalized.current.x, e, s)),
          (t.y = w.damp(t.y, i || this.normalized.current.y, e, s)));
      },
    };
  }
  createEasedDirection(e) {
    let t = new v();
    return {
      value: t,
      update: (s) => {
        ((t.x = w.damp(t.x, this.direction.x, e, s)),
          (t.y = w.damp(t.y, this.direction.y, e, s)));
      },
    };
  }
  createEasedPace(e) {
    let t = { default: 0, separated: new v() };
    return {
      value: t,
      update: (s) => {
        ((t.default = w.damp(t.default, this.pace.default, e, s)),
          (t.separated.x = w.damp(t.separated.x, this.pace.separated.x, e, s)),
          (t.separated.y = w.damp(t.separated.y, this.pace.separated.y, e, s)));
      },
    };
  }
  createEasedDrag(e) {
    let t = { distance: 0, pace: { default: 0, separated: new v() } };
    return {
      value: t,
      update: (s) => {
        ((t.distance = w.damp(t.distance, this.drag.distance, e, s)),
          (t.pace.default = w.damp(
            t.pace.default,
            this.drag.pace.default,
            e,
            s,
          )),
          (t.pace.separated.x = w.damp(
            t.pace.separated.x,
            this.drag.pace.separated.x,
            e,
            s,
          )),
          (t.pace.separated.y = w.damp(
            t.pace.separated.y,
            this.drag.pace.separated.y,
            e,
            s,
          )));
      },
    };
  }
}
class ze {
  constructor(t) {
    (e.registerPlugin(a),
      (this.id = "objects"),
      (this.params = t),
      (this.id = "clouds"),
      (this.isRendering = !1),
      (this.gl = new Ie()),
      (this.scene = new y()),
      (this.scene.environment = this.gl.assets.hdri),
      (this.easedMouse = {
        normalizedBoolean: this.gl.mouse.createEasedNormalized(0.075),
        normalizedCursor: this.gl.mouse.createEasedNormalized(0.05),
        normalizedCamera: this.gl.mouse.createEasedNormalized(0.025),
        paceBoolean: this.gl.mouse.createEasedPace(0.025),
        paceCursor: this.gl.mouse.createEasedPace(0.0125),
      }),
      (this.ratio = this.params.dom.clientHeight / this.gl.sizes.height),
      (this.progress = 0),
      (this.camera = new g(
        27.5,
        this.gl.sizes.width / this.gl.sizes.height,
        0.1,
        1e3,
      )),
      (this.camera.position.z = 6),
      (this.renderPlane = {
        mesh: new x(
          new b(1, 1),
          new S({
            transparent: !0,
            uniforms: {
              tDiffuse: new L(null),
              tMatcap: new L(this.gl.assets.textures.matcap),
              uScale: new L(new v(this.gl.sizes.width, this.gl.sizes.height)),
              uPosition: new L(new v(0, 0)),
              uResolution: new L(
                new v(this.gl.sizes.width, this.gl.sizes.height),
              ),
              uCameraAspect: new L(this.gl.sizes.width / this.gl.sizes.height),
              uCameraFov: new L(this.camera.fov),
              uCameraPosition: new L(this.camera.position),
              uCameraMatrix: new L(this.camera.matrix),
              uMouseBooleanPosition: new L(new v()),
              uMouseCursorPosition: new L(new v()),
              uPaceBoolean: new L(0),
              uPaceCursor: new L(0),
              uSphereLeftAPosition: new L(new P()),
              uSphereLeftAScale: new L(0),
              uSphereLeftATransition: new L(1),
              uSphereLeftBPosition: new L(new P()),
              uSphereLeftBScale: new L(0),
              uSphereLeftBTransition: new L(1),
              uSphereLeftCPosition: new L(new P()),
              uSphereLeftCScale: new L(0),
              uSphereLeftCTransition: new L(1),
              uSphereRightAPosition: new L(new P()),
              uSphereRightAScale: new L(0),
              uSphereRightATransition: new L(1),
              uSphereRightBPosition: new L(new P()),
              uSphereRightBScale: new L(0),
              uSphereRightBTransition: new L(1),
              uSphereCursorPosition: new L(new P()),
              uSphereCursorScale: new L(0.25),
              uSphereCursorTransition: new L(1),
              uParallaxLeft: new L(2.5),
              uParallaxRight: new L(7.5),
              uTime: new L(0),
              uOpacity: new L(0.9),
            },
            vertexShader:
              "\n            varying vec2 vUv;\n\n            uniform vec2 uPosition;\n            uniform vec2 uScale;\n            uniform vec2 uResolution;\n\n            void main() {\n              vec2 pos = position.xy * 2.0;\n\n              // Scale\n              pos.x *= uScale.x / uResolution.x;\n              pos.y *= uScale.y / uResolution.y;\n\n              // Position\n              pos.x += - 1.0 + uPosition.x / uResolution.x * 2. + uScale.x / uResolution.x;\n              pos.y -= uPosition.y / uResolution.y * 2.0;\n              \n              gl_Position = vec4(pos.xy, 0.0, 1.0);\n            \n              // Varyings\n              vUv = uv;\n            }\n          ",
            fragmentShader:
              "\n            precision highp float;\n\n            // Varyings\n            varying vec2 vUv;\n\n            // Textures\n            uniform sampler2D tDiffuse;\n            uniform sampler2D tMatcap;\n\n            // Camera\n            uniform float uCameraAspect;\n            uniform float uCameraFov;\n            uniform vec3 uCameraPosition;\n            uniform mat4 uCameraMatrix;\n            \n            // Mouse\n            uniform vec2 uMouseBooleanPosition;\n            uniform vec2 uMouseCursorPosition;\n            uniform float uPaceBoolean;\n            uniform float uPaceCursor;\n\n            // Objects\n            uniform vec3 uSphereLeftAPosition;\n            uniform float uSphereLeftAScale;\n            uniform float uSphereLeftATransition;\n            uniform vec3 uSphereLeftBPosition;\n            uniform float uSphereLeftBScale;\n            uniform float uSphereLeftBTransition;\n            uniform vec3 uSphereLeftCPosition;\n            uniform float uSphereLeftCScale;\n            uniform float uSphereLeftCTransition;\n            uniform vec3 uSphereRightAPosition;\n            uniform float uSphereRightAScale;\n            uniform float uSphereRightATransition;\n            uniform vec3 uSphereRightBPosition;\n            uniform float uSphereRightBScale;\n            uniform float uSphereRightBTransition;\n            uniform vec3 uSphereCursorPosition;\n            uniform float uSphereCursorScale;\n            uniform float uSphereCursorTransition;\n\n            // Utils\n            uniform float uParallaxLeft;\n            uniform float uParallaxRight;\n            uniform float uTime;\n            uniform float uOpacity;            \n\n            // // // // // // // // // // // // // // // // // // \n            // // // // // // // // // // // // // // // // // // \n            // // // // // // // // // // // // // // // // // // \n            // FUNCTIONS\n\n            float opSmoothSubtraction( float d1, float d2, float k ) {\n              float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );\n              return mix( d2, -d1, h ) + k*h*(1.0-h);\n            }\n\n            // // // // // // // // // // // // // // // // // // \n            // // // // // // // // // // // // // // // // // // \n            // // // // // // // // // // // // // // // // // // \n            // OBJECTS & SCENE\n\n            // ---\x3e Functions\n            float smin( float a, float b, float k ) {\n              k *= 1.0;\n              float r = exp2(-a/k) + exp2(-b/k);\n              return -k*log2(r);\n            }\n\n            // ---\x3e Objects\n\n            float sdSphere( vec3 p, float s ) {\n              return length(p)-s;\n            }\n\n            // ---\x3e Scene\n\n            float scene(vec3 p) {    \n\n              /* \n                Main Objects\n              */\n\n              // Left\n              float sphereLeftA = sdSphere(\n                vec3(\n                  p.x - uSphereLeftAPosition.x,\n                  p.y - uSphereLeftAPosition.y - (uSphereLeftATransition) * uParallaxLeft,\n                  p.z - uSphereLeftAPosition.z\n                ),\n                uSphereLeftAScale * (1.0 - abs(uSphereLeftATransition))\n              );\n\n              float sphereLeftB = sdSphere(\n                vec3(\n                  p.x - uSphereLeftBPosition.x,\n                  p.y - uSphereLeftBPosition.y - (uSphereLeftBTransition) * uParallaxLeft,\n                  p.z - uSphereLeftBPosition.z\n                ), \n                uSphereLeftBScale * (1.0 - abs(uSphereLeftBTransition))\n              );\n\n              float sphereLeftC = sdSphere(\n                vec3(\n                  p.x - uSphereLeftCPosition.x,\n                  p.y - uSphereLeftCPosition.y - (uSphereLeftCTransition) * uParallaxLeft,\n                  p.z - uSphereLeftCPosition.z\n                ),\n                uSphereLeftCScale * (1.0 - abs(uSphereLeftCTransition))\n              );\n\n              float leftCloud = smin(smin(sphereLeftA, sphereLeftB, 0.1), sphereLeftC, 0.1);\n\n              // Right\n              float sphereRightA = sdSphere(\n                vec3(\n                  p.x - uSphereRightAPosition.x,\n                  p.y - uSphereRightAPosition.y - (uSphereRightATransition) * uParallaxRight,\n                  p.z - uSphereRightAPosition.z\n                ),\n                uSphereRightAScale * (1.0 - abs(uSphereRightATransition))\n              );\n\n              float sphereRightB = sdSphere(\n                vec3(\n                  p.x - uSphereRightBPosition.x,\n                  p.y - uSphereRightBPosition.y - (uSphereRightBTransition) * uParallaxRight,\n                  p.z - uSphereRightBPosition.z\n                ),\n                uSphereRightBScale * (1.0 - abs(uSphereRightBTransition))\n              );\n\n              float rightCloud = smin(sphereRightA, sphereRightB, 0.1);\n\n              /* \n                Cursor\n              */\n\n              float sphereCursor = sdSphere(\n                vec3(\n                  p.x - uSphereCursorPosition.x, \n                  p.y - uSphereCursorPosition.y, \n                  p.z\n                ), \n                uSphereCursorScale * (1.0 - abs(uSphereCursorTransition))\n              );\n              // vec3 booleanPosition = vec3(p.x - uMouseBooleanPosition.x, p.y - uMouseBooleanPosition.y, p.z);\n              // float sphereBoolean = sdSphere(booleanPosition, 0.5 * uPaceBoolean);\n\n              // float sphereTest = sdSphere(vec3(p.x - 4.0, p.y, p.z), 1.0);\n\n              /* \n                Return\n              */\n\n              // return min(opSmoothSubtraction(sphereBoolean, smin(leftCloud, rightCloud, 0.1), 0.1), sphereCursor);\n              // return opSmoothSubtraction(sphereCursorBoolean, smin(leftCloud, rightCloud, 0.1), 0.25);\n              // return sphereCursorBoolean;\n              return smin(sphereCursor, smin(leftCloud, rightCloud, 0.1), 0.1);\n              // return sphereTest;\n            }\n\n\n            // // // // // // // // // // // // // // // // // // \n            // // // // // // // // // // // // // // // // // // \n            // // // // // // // // // // // // // // // // // // \n            // RENDERER\n\n            vec3 calculate_normal(in vec3 p) {\n              const vec3 small_step = vec3(0.001, 0., 0.);\n\n              float gradient_x = scene(p + small_step.xyy) - scene(p - small_step.xyy);\n              float gradient_y = scene(p + small_step.yxy) - scene(p - small_step.yxy);\n              float gradient_z = scene(p + small_step.yyx) - scene(p - small_step.yyx);\n\n              vec3 normal = vec3(gradient_x, gradient_y, gradient_z);\n\n              return normalize(normal);\n            }\n\n            vec2 matcap(vec3 eye, vec3 normal) {\n              vec3 reflected = reflect(eye, normal);\n              float m = 2.8284271247461903 * sqrt( reflected.z + 1.0 );\n              return reflected.xy / m + 0.5;\n            }\n\n            vec4 ray_march(in vec3 ro, in vec3 rd) {\n                float total_distance_traveled = 0.0;\n                const int NUMBER_OF_STEPS = 50;\n                const float MINIMUM_HIT_DISTANCE = 0.01;\n                const float MAXIMUM_TRACE_DISTANCE = 10.;\n\n                for (int i = 0; i < NUMBER_OF_STEPS; ++i) {\n                  vec3 current_position = ro + total_distance_traveled * rd;\n                  \n                  // ---\x3e SCENE\n\n                  float distance_to_closest = scene(current_position);  \n                  \n                  // // // // // // // // // // // // // // // // // // // // \n                  // SHADING COLOR\n\n                  if (distance_to_closest < MINIMUM_HIT_DISTANCE) {\n                    // ---\x3e Normal\n                    vec3 normal = calculate_normal(current_position); \n                    \n                    // ---\x3e Lighting\n                    // vec3 light_position = vec3(5., -5., 5.);\n                    \n                    // vec3 direction_to_light = normalize(current_position - light_position);\n\n                    // float diffuse_intensity = max(0., dot(normal, direction_to_light));\n\n                    // ---\x3e Matcap\n                    vec2 matcapUV = matcap(rd, normal);\n                    vec4 matcapTexture = texture(tMatcap, matcapUV);\n\n                    // ---\x3e Depth\n                    float depth = (1.0 - pow(total_distance_traveled, 1.1) / 45.) * 1.2;\n                    depth = clamp(depth, 0.0, 1.0);\n                \n                    // ---\x3e Return color\n                    // return vec4(vec3(depth), 1.0);\n                    // return vec4(vec3(1., 1., 1.) * diffuse_intensity, 1.) ;\n                    // return vec4(matcapUV, 0.0, 1.0);\n                    // return vec4(normal.rgb, 1.0);\n                    return vec4(matcapTexture.rgb * depth, 1.0);\n\n                    break;\n                  }\n            \n                  // // // // // // // // // // // // // // // // // // // // \n\n                  if (total_distance_traveled > MAXIMUM_TRACE_DISTANCE) {\n                    break;\n                  }\n                  \n                  total_distance_traveled += distance_to_closest;\n                }\n                \n                // // // // // // // // // // // // // // // // // // // // \n                // BACKGROUND\n                \n                return vec4(0.0);\n            }\n            \n            void main() {\n              // ---\x3e Diffuse\n              vec4 textureDiffuse = texture(tDiffuse, vUv);\n\n              // ---\x3e UV\n              vec2 uv0 = vUv * 2.0 - 1.0;\n              uv0.x *= uCameraAspect;\n              \n              // ---\x3e Camera \n              float tanFov = tan(radians(uCameraFov) * 0.5);\n              vec3 ro = uCameraPosition;\n              vec3 rd = normalize(vec3(uv0 * tanFov, -1.));\n              rd = normalize((uCameraMatrix * vec4(rd, 0.0)).xyz);\n\n              vec4 shaded_color = ray_march(ro, rd);\n\n              // --\x3e Top Gradient\n              float topGradient = smoothstep(1.0, 0.5 + (0.49 * (1.0 - abs(uSphereLeftATransition))), vUv.y);\n\n              // ---\x3e Output to screen\n              // gl_FragColor = vec4(shaded_color.rgb, shaded_color.a) + textureDiffuse;\n              gl_FragColor = vec4(shaded_color.rgb, shaded_color.a * uOpacity);\n              // gl_FragColor = ;\n            }\n          ",
          }),
        ),
      }),
      (this.renderPlane.mesh.frustumCulled = !1),
      (this.renderPlane.mesh.matrixAutoUpdate = !1),
      (this.bounds = {}),
      (this.renderTarget = new M(
        this.gl.sizes.width * this.gl.sizes.pixelRatio,
        this.gl.sizes.height * this.gl.sizes.pixelRatio,
        { samples: 1 },
      )),
      (this.globalPositionOffset = { y: -0.8 }),
      (this.sphereLeftA = new x(new C(1, 8, 8), new T({ color: 16711680 }))),
      (this.positionLeftA = new P(-1.7, 1.1 + this.globalPositionOffset.y, 0)),
      (this.scaleLeftA = 0.7),
      (this.scaleLeftATransition = 1),
      this.scene.add(this.sphereLeftA),
      (this.sphereLeftB = new x(new C(1, 8, 8), new T({ color: 16711680 }))),
      (this.positionLeftB = new P(-0.75, 1.8 + this.globalPositionOffset.y, 0)),
      (this.scaleLeftB = 0.4),
      (this.scaleLeftBTransition = 1),
      this.scene.add(this.sphereLeftB),
      (this.sphereLeftC = new x(new C(1, 8, 8), new T({ color: 16711680 }))),
      (this.positionLeftC = new P(
        -1.2,
        1.65 + this.globalPositionOffset.y,
        -2,
      )),
      (this.scaleLeftC = 0.5),
      (this.scaleLeftCTransition = 1),
      this.scene.add(this.sphereLeftC),
      (this.sphereRightA = new x(new C(1, 8, 8), new T({ color: 16711680 }))),
      (this.positionRightA = new P(
        2.1,
        0.125 + this.globalPositionOffset.y,
        0,
      )),
      (this.scaleRightA = 0.7),
      (this.scaleRightATransition = 1),
      this.scene.add(this.sphereRightA),
      (this.sphereRightB = new x(new C(1, 8, 8), new T({ color: 16711680 }))),
      (this.positionRightB = new P(
        0.975,
        -0.05 + this.globalPositionOffset.y,
        0,
      )),
      (this.scaleRightB = 0.4),
      (this.scaleRightBTransition = 1),
      this.scene.add(this.sphereRightB),
      this.setIsRendering(),
      this.getBounds(),
      this.getMouseShift(),
      this.setScroll(),
      this.setRaycaster(),
      this.transition());
  }
  setRaycaster() {
    ((this.raycaster = new z()),
      (this.intersected = null),
      (this.isIntersecting = !1),
      (this.previousIsIntersecting = !1),
      (this.raycaterEasedPoint = new P(0, 0, 0)),
      (this.raycastPlane = new x(new b(10, 10), new T({ color: 65280 }))),
      this.scene.add(this.raycastPlane));
  }
  setOrbitControls() {
    ((this.controls = new _(this.camera, this.params.dom)),
      (this.controls.enableDamping = !0),
      (this.controls.enableZoom = !1));
  }
  resize() {
    (this.renderTarget.setSize(
      this.gl.sizes.width * this.gl.sizes.pixelRatio,
      this.gl.sizes.height * this.gl.sizes.pixelRatio,
    ),
      (this.ratio = this.params.dom.clientHeight / this.gl.sizes.height));
  }
  updateCameraAspect() {
    const e =
        this.renderPlane.mesh.material.uniforms.uScale.value.x /
        this.renderPlane.mesh.material.uniforms.uScale.value.y,
      t = (Math.PI / 180) * 27.5,
      s = 2 * Math.atan(Math.tan(t / 2) / e) * (180 / Math.PI);
    ((this.camera.fov = s),
      (this.camera.aspect = e),
      this.camera.updateProjectionMatrix(),
      (this.renderPlane.mesh.material.uniforms.uCameraFov.value =
        this.camera.fov),
      (this.renderPlane.mesh.material.uniforms.uCameraAspect.value =
        this.camera.aspect));
  }
  setIsRendering() {
    a.create({
      trigger: this.params.dom,
      start: "top bottom",
      end: "bottom top",
      invalidateOnRefresh: !0,
      onEnter: () => {
        this.isRendering = !0;
      },
      onEnterBack: () => {
        this.isRendering = !0;
      },
      onLeave: () => {
        this.isRendering = !1;
      },
      onLeaveBack: () => {
        this.isRendering = !1;
      },
    });
  }
  getBounds() {
    ((this.bounds = this.params.dom.getBoundingClientRect()),
      this.renderPlane.mesh.material.uniforms.uResolution.value.set(
        this.gl.sizes.width,
        this.gl.sizes.height,
      ),
      (this.renderPlane.mesh.material.uniforms.uPosition.value.x =
        this.bounds.left),
      this.renderPlane.mesh.material.uniforms.uScale.value.set(
        this.bounds.width,
        this.bounds.height,
      ));
  }
  setScroll() {
    e.fromTo(
      this.renderPlane.mesh.material.uniforms.uPosition.value,
      { y: () => Math.max(this.gl.sizes.height, this.bounds.height) },
      {
        y: () => -Math.max(this.gl.sizes.height, this.bounds.height),
        ease: "none",
        scrollTrigger: {
          invalidateOnRefresh: !0,
          scrub: !0,
          trigger: this.params.dom,
          start: () =>
            `center-=${Math.max(this.gl.sizes.height, this.bounds.height)} top+=${this.gl.sizes.height / 2}`,
          end: () =>
            `center+=${Math.max(this.gl.sizes.height, this.bounds.height)} top+=${this.gl.sizes.height / 2}`,
          refreshPriority: -99,
          onRefresh: () => {
            (this.getBounds(), this.updateCameraAspect());
          },
        },
      },
    );
  }
  getMouseShift() {
    a.create({
      trigger: this.params.dom,
      start: () => `top-=${this.params.dom.clientHeight} center`,
      end: () => `bottom+=${this.params.dom.clientHeight} center`,
      invalidateOnRefresh: !0,
      onUpdate: (e) => {
        this.progress = 2 * e.progress - 1;
      },
    });
  }
  renderPipeline() {
    this.isRendering &&
      (this.gl.renderer.instance.setRenderTarget(this.renderTarget),
      this.gl.renderer.instance.render(this.scene, this.camera),
      (this.renderPlane.mesh.material.uniforms.tDiffuse.value =
        this.renderTarget.texture));
  }
  transition() {
    ((this.timeline = e.timeline({
      scrollTrigger: {
        trigger: this.params.dom,
        start: () =>
          `top-=${this.gl.sizes.width / this.gl.sizes.height < 1 ? this.gl.sizes.width / 2 : this.gl.sizes.width / 8} center`,
        end: () =>
          `bottom+=${this.gl.sizes.width / this.gl.sizes.height < 1 ? this.gl.sizes.width / 2 : this.gl.sizes.width / 8} center`,
        scrub: !0,
        invalidateOnRefresh: !0,
        refreshPriority: -99,
      },
    })),
      this.timeline.fromTo(
        [
          this.renderPlane.mesh.material.uniforms.uSphereLeftATransition,
          this.renderPlane.mesh.material.uniforms.uSphereLeftBTransition,
          this.renderPlane.mesh.material.uniforms.uSphereLeftCTransition,
          this.renderPlane.mesh.material.uniforms.uSphereRightATransition,
          this.renderPlane.mesh.material.uniforms.uSphereRightBTransition,
          this.renderPlane.mesh.material.uniforms.uSphereCursorTransition,
        ],
        { value: -1 },
        { value: 0, ease: "power2.out" },
      ),
      this.timeline.fromTo(
        [
          this.renderPlane.mesh.material.uniforms.uSphereLeftATransition,
          this.renderPlane.mesh.material.uniforms.uSphereLeftBTransition,
          this.renderPlane.mesh.material.uniforms.uSphereLeftCTransition,
          this.renderPlane.mesh.material.uniforms.uSphereRightATransition,
          this.renderPlane.mesh.material.uniforms.uSphereRightBTransition,
          this.renderPlane.mesh.material.uniforms.uSphereCursorTransition,
        ],
        { value: 0 },
        { value: 1, ease: "power2.in" },
      ),
      e.set(
        [
          this.renderPlane.mesh.material.uniforms.uSphereLeftATransition,
          this.renderPlane.mesh.material.uniforms.uSphereLeftBTransition,
          this.renderPlane.mesh.material.uniforms.uSphereLeftCTransition,
          this.renderPlane.mesh.material.uniforms.uSphereRightATransition,
          this.renderPlane.mesh.material.uniforms.uSphereRightBTransition,
          this.renderPlane.mesh.material.uniforms.uSphereCursorTransition,
        ],
        { value: -1 },
      ));
  }
  update() {
    if (this.isRendering) {
      const t = Math.max(
        Math.min(
          this.gl.mouse.normalized.current.y / this.ratio - 3 * this.progress,
          1,
        ),
        -1,
      );
      (this.easedMouse.normalizedBoolean.update(this.gl.time.delta, t),
        this.easedMouse.normalizedCursor.update(this.gl.time.delta, t),
        this.easedMouse.normalizedCamera.update(this.gl.time.delta, t),
        this.easedMouse.paceBoolean.update(this.gl.time.delta),
        this.easedMouse.paceCursor.update(this.gl.time.delta),
        this.sphereLeftA.position.copy(this.positionLeftA),
        (this.sphereLeftA.position.y -= 0.05 * Math.sin(this.gl.time.elapsed)),
        (this.sphereLeftA.position.z -= 0.1 * Math.cos(this.gl.time.elapsed)),
        this.sphereLeftA.scale.set(
          this.scaleLeftA,
          this.scaleLeftA,
          this.scaleLeftA,
        ));
      let s = 0.05 + 0.05 * Math.cos(this.gl.time.elapsed);
      ((this.sphereLeftA.scale.x += s),
        (this.sphereLeftA.scale.y += s),
        (this.sphereLeftA.scale.z += s),
        (this.renderPlane.mesh.material.uniforms.uSphereLeftAPosition.value =
          this.sphereLeftA.position),
        (this.renderPlane.mesh.material.uniforms.uSphereLeftAScale.value =
          this.sphereLeftA.scale.x),
        this.sphereLeftB.position.copy(this.positionLeftB),
        (this.sphereLeftB.position.y -= 0.05 * Math.cos(this.gl.time.elapsed)),
        this.sphereLeftB.scale.set(
          this.scaleLeftB,
          this.scaleLeftB,
          this.scaleLeftB,
        ),
        (this.renderPlane.mesh.material.uniforms.uSphereLeftBPosition.value =
          this.sphereLeftB.position),
        (this.renderPlane.mesh.material.uniforms.uSphereLeftBScale.value =
          this.sphereLeftB.scale.x),
        this.sphereLeftC.position.copy(this.positionLeftC),
        (this.sphereLeftC.position.y -=
          0.05 * Math.sin(1.5 * this.gl.time.elapsed)),
        (this.sphereLeftC.position.z -= 0.25 * Math.cos(this.gl.time.elapsed)),
        this.sphereLeftC.scale.set(
          this.scaleLeftC,
          this.scaleLeftC,
          this.scaleLeftC,
        ),
        (this.renderPlane.mesh.material.uniforms.uSphereLeftCPosition.value =
          this.sphereLeftC.position),
        (this.renderPlane.mesh.material.uniforms.uSphereLeftCScale.value =
          this.sphereLeftC.scale.x),
        this.sphereRightA.position.copy(this.positionRightA),
        (this.sphereRightA.position.y -= 0.05 * Math.sin(this.gl.time.elapsed)),
        (this.sphereRightA.position.z -= 0.15 * Math.cos(this.gl.time.elapsed)),
        this.sphereRightA.scale.set(
          this.scaleRightA,
          this.scaleRightA,
          this.scaleRightA,
        ));
      let i = 0.05 + 0.05 * Math.sin(this.gl.time.elapsed);
      ((this.sphereRightA.scale.x += i),
        (this.sphereRightA.scale.y += i),
        (this.sphereRightA.scale.z += i),
        (this.renderPlane.mesh.material.uniforms.uSphereRightAPosition.value =
          this.sphereRightA.position),
        (this.renderPlane.mesh.material.uniforms.uSphereRightAScale.value =
          this.sphereRightA.scale.x),
        this.sphereRightB.position.copy(this.positionRightB),
        (this.sphereRightB.position.x -=
          0.15 * Math.sin(this.gl.time.elapsed) - 0.15),
        (this.sphereRightB.position.z -= 0.15 * Math.sin(this.gl.time.elapsed)),
        this.sphereRightB.scale.set(
          this.scaleRightB,
          this.scaleRightB,
          this.scaleRightB,
        ),
        (this.renderPlane.mesh.material.uniforms.uSphereRightBPosition.value =
          this.sphereRightB.position),
        (this.renderPlane.mesh.material.uniforms.uSphereRightBScale.value =
          this.sphereRightB.scale.x),
        this.raycaster.setFromCamera(
          {
            x: this.easedMouse.normalizedCursor.value.x,
            y: this.easedMouse.normalizedCursor.value.y,
          },
          this.camera,
        ),
        (this.intersectedPlane = this.raycaster.intersectObject(
          this.raycastPlane,
        )),
        (this.intersectedObjects = this.raycaster.intersectObjects([
          this.sphereLeftA,
          this.sphereLeftB,
          this.sphereRightA,
          this.sphereRightB,
        ])),
        this.intersectedPlane.length &&
          (this.renderPlane.mesh.material.uniforms.uSphereCursorPosition.value =
            this.intersectedPlane[0].point),
        this.intersectedObjects.length
          ? (this.isIntersecting = !0)
          : (this.isIntersecting = !1),
        this.isIntersecting != this.previousIsIntersecting &&
          (this.isIntersecting
            ? e.to(this.renderPlane.mesh.material.uniforms.uSphereCursorScale, {
                value: 0.4,
                duration: 1,
                ease: "expo.out",
                overwrite: !0,
              })
            : e.to(this.renderPlane.mesh.material.uniforms.uSphereCursorScale, {
                value: 0,
                duration: 0.5,
                overwrite: !0,
              })),
        (this.previousIsIntersecting = this.isIntersecting),
        (this.camera.position.x =
          0.5 * this.easedMouse.normalizedCamera.value.x),
        (this.camera.position.y =
          0.5 * this.easedMouse.normalizedCamera.value.y),
        this.camera.lookAt(0, 0, 0),
        (this.renderPlane.mesh.material.uniforms.uTime.value =
          this.gl.time.elapsed),
        (this.renderPlane.mesh.material.uniforms.uMouseBooleanPosition.value =
          this.easedMouse.normalizedBoolean.value),
        (this.renderPlane.mesh.material.uniforms.uMouseCursorPosition.value =
          this.easedMouse.normalizedCursor.value),
        (this.renderPlane.mesh.material.uniforms.uPaceBoolean.value =
          10 * this.easedMouse.paceBoolean.value.default),
        (this.renderPlane.mesh.material.uniforms.uPaceCursor.value =
          25 * Math.pow(this.easedMouse.paceCursor.value.default, 1.5)));
    }
  }
}
class _e {
  constructor(t) {
    (e.registerPlugin(a),
      (this.params = t),
      (this.id = "robot-showcase"),
      (this.gl = new Ie()),
      (this.isRevealEnded = !1),
      (this.isRendering = !1),
      (this.scene = new y()),
      (this.scene.environment = this.gl.assets.hdri),
      (this.camera = new g(45, 1, 0.1, 1e3)),
      (this.camera.position.y = 2),
      (this.camera.position.z = 58),
      (this.camera.zoom = 1.15),
      (this.renderPlane = {
        mesh: new x(
          new b(1, 1),
          new S({
            transparent: !0,
            uniforms: {
              uScale: new L(new v(this.gl.sizes.width, this.gl.sizes.height)),
              uPosition: new L(new v(0, 0)),
              uResolution: new L(
                new v(this.gl.sizes.width, this.gl.sizes.height),
              ),
              tDiffuse: new L(null),
              uDisplacementStrength: new L(45e-5),
              uCameraAspect: new L(this.camera.aspect),
              uLightColor: new L(new E(13625599)),
              uTransitionToInteractive: new L(0),
              uMouseEffect: new L(0),
              uVideoEnded: new L(!1),
              tRobotShowcaseDiffuse: new L(
                this.gl.assets.textures.robotShowcase.diffuse,
              ),
              tRobotShowcaseMovec: new L(
                this.gl.assets.textures.robotShowcase.movec,
              ),
              tRobotShowcaseNormal: new L(
                this.gl.assets.textures.robotShowcase.normal,
              ),
              tRobotShowcaseReveal: new L(
                this.gl.assets.videos.robotShowcase.reveal,
              ),
              uMouse: new L(new v(0, 0)),
            },
            vertexShader:
              "\n            varying vec2 vUv;\n\n            uniform vec2 uScale;\n            uniform vec2 uPosition;\n            uniform vec2 uResolution;\n\n            void main() {\n              vec2 pos = position.xy * 2.0;\n\n              // Scale\n              pos.x *= uScale.x / uResolution.x;\n              pos.y *= uScale.y / uResolution.y;\n\n              // Position\n              pos.x += - 1.0 + uPosition.x / uResolution.x * 2. + uScale.x / uResolution.x;\n              pos.y -= uPosition.y / uResolution.y * 2.0;\n              \n              gl_Position = vec4(pos.xy, 0.0, 1.0);\n            \n              // Varyings\n              vUv = uv;\n            }\n          ",
            fragmentShader:
              "\n            varying vec2 vUv;\n\n            uniform sampler2D tDiffuse;\n\n            uniform float uDisplacementStrength;\n            uniform float uCameraAspect;\n            uniform float uTransitionToInteractive;\n            uniform float uMouseEffect;\n            uniform vec3 uLightColor;\n            uniform vec2 uMouse;\n            uniform bool uVideoEnded;\n\n            uniform sampler2D tRobotShowcaseDiffuse;\n            uniform sampler2D tRobotShowcaseMovec;\n            uniform sampler2D tRobotShowcaseNormal;\n            uniform sampler2D tRobotShowcaseReveal;\n            \n            vec2 getSubUv (vec2 uv, float index){\n                // calculating normalized index relative to number of columns in the grid. 4 in our case\n                float ind = index/4.0;\n            \n                // Shrinks the UV coordinates to fit one cell of the 4x4 grid.\n                // Dividing by 4 maps the UV range of (0, 1) for the entire texture to (0, 0.25) for each cell.\n                vec2 uv1 = uv/4.0;\n            \n                // Offsets the y coordinate upward by 3/4 of the texture height to start from the top row (the grid is 4x4, so rows are 1/4 tall).\n                uv1.y += 3.0/4.0;\n            \n                // Horizontal offset\n                // fract(ind) * 4.0 isolates the fractional part of ind to determine the column within the grid (0 to 3).\n                // floor(...) / 4.0 maps this to the range (0, 0.25, 0.5, 0.75), corresponding to each column's start position.\n                uv1.x += floor(fract(ind)* 4.0)/4.0;\n            \n                // Vertical offset\n                // Divides ind by 4.0 to calculate the row index, then adjusts y downward by the appropriate amount (0, 0.25, 0.5, or 0.75).\n                uv1.y -= floor(fract(ind/4.0)*4.0)/4.0;\n            \n                return uv1;\n            }\n            \n            // blending of textures with next frame texture\n            vec4 getMap(sampler2D map, float blend, vec2 uv, vec2 nextUv, vec2 displacement, vec2 displacementNext){\n            \n                // Get the diffuse texture color\n                vec4 diffuse = texture2D(map, uv + displacement * blend);\n                // float alphaTexture = texture2D(alpha, uv).r; // alpha value of the current frame\n                // diffuse.a = alphaTexture; // Set the alpha value of the current frame\n            \n                // Get the diffuse texture color of the next frame\n                vec4 diffuseNext = texture2D(map, nextUv - (displacementNext * (1.0 - blend)));\n                // float alphaTextureNext = texture2D(alpha, nextUv).r; // alpha value of the next frame\n                // diffuseNext.a = alphaTextureNext; // Set the alpha value of the next frame\n            \n                // Mix the two textures based on the blend factor\n                return mix(diffuse, diffuseNext, blend);\n            }\n            \n            // calculating displacement of the texture based on the displacement map\n            vec2 getDisplacement(sampler2D map, vec2 uv, float strength){\n                // Get the displacement data from the texture\n                vec4 tData = texture2D(map, uv);\n                // Convert the displacement data to a vec2 in the range (-1, 1)\n                vec2 displacement = tData.rg;\n                // Normalize the displacement to the range (-1, 1) and scale it by the strength factor\n                displacement = (displacement - 0.5) * 2.0;\n                displacement *= strength;// scale the displacement\n                return displacement;\n            }\n            \n            vec3 getMotionVectorMap(vec4 transformedPosition){\n                vec4 mv = transformedPosition;\n                vec3 color = abs(mv.xyz);\n                return color;\n            }\n\n            vec2 rotateUV(vec2 uv, float angle, vec2 pivot) {\n              float s = sin(angle);\n              float c = cos(angle);\n          \n              // Translate UV to pivot\n              uv -= pivot;\n          \n              // Apply rotation matrix\n              uv = mat2(c, -s, s, c) * uv;\n          \n              // Translate back\n              uv += pivot;\n          \n              return uv;\n            }\n\n            vec3 coolWarmLight(vec3 color) {\n              float brightness = max(max(color.r, color.g), color.b);\n              float warmSeparation = min(color.r - color.b, color.g - color.b);\n              float redGreenBalance = 1.0 - smoothstep(0.18, 0.46, abs(color.r - color.g));\n              float warmMask = smoothstep(0.055, 0.19, warmSeparation)\n                * smoothstep(0.38, 0.78, brightness)\n                * redGreenBalance;\n              float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));\n              vec3 coolWhite = clamp(vec3(luminance * 0.94, luminance * 1.02, luminance * 1.13), 0.0, 1.0);\n              return mix(color, coolWhite, warmMask * 0.9);\n            }\n            \n            void main() {\n              /* \n                Corrected UV\n              */\n              float aspect = uCameraAspect;\n              vec2 correctedUV = vUv;\n              correctedUV.y -= 0.5;\n              correctedUV.y *= aspect;\n              correctedUV.y += 0.5;\n\n              correctedUV.x *= 0.9;\n              correctedUV.x += 0.05;\n              correctedUV.y *= 0.9;\n              correctedUV.y += 0.05;\n              // correctedUV.x += uMouse.x * 0.05;\n\n              correctedUV = rotateUV(correctedUV, uMouse.y * uMouse.x * 0.05, vec2(0.5, 0.5));\n\n             /* \n               Mask\n             */\n             vec2 maskUV = vUv;\n             maskUV.y -= 0.5;\n             maskUV.y *= aspect;\n             maskUV.y += 0.5;\n\n             float mask = step(maskUV.y, 1.0) - step(maskUV.y, 0.0);\n\n              /* \n                Diffuse\n              */\n              vec2 textureUV = vUv;\n              // textureUV = rotateUV(textureUV, uMouse.y * uMouse.x * 0.05, vec2(0.5, 0.5));\n              // textureUV.x *= 0.9;\n              // textureUV.x += 0.05;\n              // textureUV.y *= 0.9;\n              // textureUV.y += 0.05;\n              // textureUV.x += uMouse.x * 0.05;\n\n              vec4 textureDiffuse = texture2D(tDiffuse, textureUV);\n\n              // Movement\n\n            \n              /* \n                Mouse\n              */\n              vec2 mouse = uMouse;\n              mouse.xy /= 2.;\n              mouse.xy += 0.5;\n            \n              /* \n                Index\n              */\n              float index = mix(0.0, 15.0, mouse.x * uMouseEffect);\n\n              /* \n                Video\n              */\n              vec4 textureReveal;\n\n              if (!uVideoEnded) {\n                textureReveal = texture2D(tRobotShowcaseReveal, correctedUV);\n                textureReveal.rgb = coolWarmLight(textureReveal.rgb);\n              } else {\n                textureReveal = vec4(0.0);\n              }\n            \n              /* \n                Blend\n              */\n              float blend = fract(index);\n            \n              vec2 subUv = getSubUv(correctedUV, index);\n              vec2 subUvNext = getSubUv(correctedUV, index + 1.0);\n            \n              vec2 displacement = getDisplacement(tRobotShowcaseMovec, subUv, uDisplacementStrength);\n              vec2 displacementNext = getDisplacement(tRobotShowcaseMovec, subUvNext, uDisplacementStrength);\n            \n              vec4 diffuseMap = getMap(tRobotShowcaseDiffuse, blend, subUv, subUvNext, displacement, displacementNext);\n              diffuseMap.rgb = coolWarmLight(diffuseMap.rgb);\n              vec4 normalMap = getMap(tRobotShowcaseNormal, blend, subUv, subUvNext, displacement, displacementNext) * 2.0 - 1.0;\n              \n              float light = max(dot(normalMap.xyz, normalize(vec3(-uMouse.x, 0.0, -1.0))), 0.0) * uMouseEffect;\n              float cursor = 1.0 - clamp(distance(vUv, 0.5 + uMouse * 0.5) * 2.5, 0.0, 1.0);\n            \n              diffuseMap.rgb += mix(vec3(0.0), uLightColor, light * cursor) * 0.2;\n              vec4 color = vec4(vec3(mix(diffuseMap.rgb * mask, textureDiffuse.rgb, textureDiffuse.a)), 1.0);\n\n              float fade = smoothstep(1.0, 0.75, vUv.y) * smoothstep(0.0, 0.25, vUv.y);\n            \n              if (!uVideoEnded) {\n                gl_FragColor = mix(textureReveal, color, uTransitionToInteractive);\n              } else {\n                gl_FragColor = color;\n              }\n              // gl_FragColor.rgb = textureReveal.rgb;\n              gl_FragColor.a = fade; // Fade\n              \n              \n            }\n          ",
          }),
        ),
      }),
      (this.bounds = {}),
      (this.renderTarget = new M(
        this.gl.sizes.width * this.gl.sizes.pixelRatio,
        this.gl.sizes.width * this.gl.sizes.pixelRatio,
        { samples: 1 },
      )),
      (this.easedMouse = {
        normalized: this.gl.mouse.createEasedNormalized(0.015),
      }),
      (this.easedMouseEffect = 0),
      (this.ratio = this.params.dom.clientHeight / this.gl.sizes.height),
      (this.progress = 0),
      (this.raycastDOM = [...document.querySelectorAll("[data-gl-raycast]")]),
      (this.raycastGroup = new R()),
      this.scene.add(this.raycastGroup),
      (this.raycastA = new x(new B(11.9, 4.88, 11.8), new T({ color: 65280 }))),
      (this.raycastA.name = "a"),
      this.raycastA.position.set(-13.38, 2.59, 6.19),
      (this.raycastA.visible = !1),
      this.raycastGroup.add(this.raycastA),
      (this.raycastB = new x(new B(33.6, 7.49, 16.8), new T({ color: 65280 }))),
      (this.raycastB.name = "b"),
      this.raycastB.position.set(-10.76, 8.45, -10.8),
      (this.raycastB.visible = !1),
      this.raycastGroup.add(this.raycastB),
      (this.raycastC = new x(new B(21.7, 4.01, 16.8), new T({ color: 255 }))),
      (this.raycastC.name = "c"),
      this.raycastC.position.set(-4.79, 2.59, -10.8),
      (this.raycastC.visible = !1),
      this.raycastGroup.add(this.raycastC),
      (this.raycastD = new x(new B(17, 11.6, 16.8), new T({ color: 65280 }))),
      (this.raycastD.name = "d"),
      this.raycastD.position.set(17.4, 6.37, -10.8),
      (this.raycastD.visible = !1),
      this.raycastGroup.add(this.raycastD),
      (this.trees = new R()),
      (this.trees.position.y = 0.5),
      this.scene.add(this.trees),
      (this.treesShadows = new R()),
      this.treesShadows.position.copy(this.trees.position),
      this.scene.add(this.treesShadows),
      (this.treesTargetScales = [1.25, 1.025, 1, 1.15, 0.75]),
      (this.shadowMaterial = new T({
        color: 13160703,
        transparent: !0,
        alphaMap: this.gl.assets.textures.trees.shadow,
      })),
      (this.treeA = new x(
        this.gl.assets.models.tree.geometry.clone(),
        new T({
          map: this.gl.assets.textures.trees.a,
          alphaMap: this.gl.assets.textures.trees.alpha,
          transparent: !0,
          alphaTest: 0.25,
        }),
      )),
      this.treeA.position.set(-13.45, 0, 15.98),
      (this.treeA.rotation.y = -0.4),
      this.treeA.scale.set(0, 0, 0),
      this.trees.add(this.treeA),
      (this.treeAShadow = new x(
        this.gl.assets.models.shadow.geometry.clone(),
        this.shadowMaterial,
      )),
      this.treeAShadow.position.copy(this.treeA.position),
      this.treeAShadow.scale.set(0, 0, 0),
      this.treesShadows.add(this.treeAShadow),
      (this.treeB = new x(
        this.gl.assets.models.tree.geometry.clone(),
        new T({
          map: this.gl.assets.textures.trees.b,
          alphaMap: this.gl.assets.textures.trees.alpha,
          transparent: !0,
          side: A,
          alphaTest: 0.75,
        }),
      )),
      this.treeB.position.set(-10.8, 0, 14.629),
      (this.treeB.rotation.y = -1.28),
      this.treeB.scale.set(0, 0, 0),
      this.trees.add(this.treeB),
      (this.treeBShadow = new x(
        this.gl.assets.models.shadow.geometry.clone(),
        this.shadowMaterial,
      )),
      this.treeBShadow.position.copy(this.treeB.position),
      this.treeBShadow.scale.set(0, 0, 0),
      this.treesShadows.add(this.treeBShadow),
      (this.treeC = new x(
        this.gl.assets.models.tree.geometry.clone(),
        new T({
          map: this.gl.assets.textures.trees.c,
          alphaMap: this.gl.assets.textures.trees.alpha,
          transparent: !0,
          side: A,
          alphaTest: 0.75,
        }),
      )),
      this.treeC.position.set(13.25, 0, 7.11),
      (this.treeC.rotation.y = -0.62),
      this.treeC.scale.set(0, 0, 0),
      this.trees.add(this.treeC),
      (this.treeCShadow = new x(
        this.gl.assets.models.shadow.geometry.clone(),
        this.shadowMaterial,
      )),
      this.treeCShadow.position.copy(this.treeC.position),
      this.treeCShadow.scale.set(0, 0, 0),
      this.treesShadows.add(this.treeCShadow),
      (this.treeD = new x(
        this.gl.assets.models.tree.geometry.clone(),
        new T({
          map: this.gl.assets.textures.trees.d,
          alphaMap: this.gl.assets.textures.trees.alpha,
          transparent: !0,
          side: A,
          alphaTest: 0.75,
        }),
      )),
      this.treeD.position.set(14.665, 0, 9.97),
      (this.treeD.rotation.y = 1.7),
      this.treeD.scale.set(0, 0, 0),
      this.trees.add(this.treeD),
      (this.treeDShadow = new x(
        this.gl.assets.models.shadow.geometry.clone(),
        this.shadowMaterial,
      )),
      this.treeDShadow.position.copy(this.treeD.position),
      this.treeDShadow.scale.set(0, 0, 0),
      this.treesShadows.add(this.treeDShadow),
      (this.treeE = new x(
        this.gl.assets.models.tree.geometry.clone(),
        new T({
          map: this.gl.assets.textures.trees.e,
          alphaMap: this.gl.assets.textures.trees.alpha,
          transparent: !0,
          side: A,
          alphaTest: 0.75,
        }),
      )),
      this.treeE.position.set(17.93, 0, 6.01),
      (this.treeE.rotation.y = -0.34),
      this.treeE.scale.set(0, 0, 0),
      this.trees.add(this.treeE),
      (this.treeEShadow = new x(
        this.gl.assets.models.shadow.geometry.clone(),
        this.shadowMaterial,
      )),
      this.treeEShadow.position.copy(this.treeE.position),
      this.treeEShadow.scale.set(0, 0, 0),
      this.treesShadows.add(this.treeEShadow),
      this.setRaycaster(),
      this.reveal(),
      this.setIsRendering(),
      this.getBounds(),
      this.getMouseShift(),
      this.setScroll(),
      this.gl.isDebug && this.setDebug());
  }
  setOrbitControls() {
    ((this.controls = new _(this.camera, this.params.dom)),
      (this.controls.enableDamping = !0),
      (this.controls.enableZoom = !1));
  }
  reveal() {
    a.create({
      trigger: this.params.dom,
      start: "center bottom",
      end: "bottom bottom",
      onEnter: () => {
        (console.log(
          this.renderPlane.mesh.material.uniforms.uVideoEnded.value,
        ),
          this.gl.assets.videosDOM.robotShowcase.reveal.play(),
          this.gl.assets.videosDOM.robotShowcase.reveal.addEventListener(
            "ended",
            () => {
              (e.to(
                this.renderPlane.mesh.material.uniforms
                  .uTransitionToInteractive,
                {
                  value: 1,
                  duration: 0.5,
                  onComplete: () => {
                    ((this.isRevealEnded = !0),
                      (this.renderPlane.mesh.material.uniforms.uVideoEnded.value =
                        !0),
                      e.to(
                        this.renderPlane.mesh.material.uniforms.uMouseEffect,
                        { value: 1, duration: 2 },
                      ));
                  },
                },
              ),
                this.trees.children.forEach((t, s) => {
                  e.to(t.scale, {
                    x: this.treesTargetScales[s],
                    y: this.treesTargetScales[s],
                    z: this.treesTargetScales[s],
                    duration: 1.25,
                    ease: "expo.out",
                    delay: 0.05 * s,
                  });
                }),
                this.treesShadows.children.forEach((t, s) => {
                  e.to(t.scale, {
                    x: this.treesTargetScales[s],
                    y: this.treesTargetScales[s],
                    z: this.treesTargetScales[s],
                    duration: 1.25,
                    ease: "expo.out",
                    delay: 0.05 * s,
                  });
                }));
            },
          ));
      },
    });
  }
  setRaycaster() {
    ((this.raycaster = new z()),
      (this.intersected = null),
      (this.isIntersecting = !1),
      (this.previousIsIntersecting = !1));
  }
  resize() {
    (this.renderTarget.setSize(
      this.gl.sizes.width * this.gl.sizes.pixelRatio,
      this.gl.sizes.width * this.gl.sizes.pixelRatio,
    ),
      (this.ratio = this.params.dom.clientHeight / this.gl.sizes.height));
  }
  updateCameraAspect() {
    const e =
        this.renderPlane.mesh.material.uniforms.uScale.value.x /
        this.renderPlane.mesh.material.uniforms.uScale.value.y,
      t = (Math.PI / 180) * 45,
      s = 2 * Math.atan(Math.tan(t / 2) / e) * (180 / Math.PI);
    ((this.camera.fov = s),
      (this.camera.aspect = e),
      this.camera.updateProjectionMatrix(),
      (this.renderPlane.mesh.material.uniforms.uCameraAspect.value =
        this.camera.aspect));
  }
  setIsRendering() {
    a.create({
      trigger: this.params.dom,
      start: () => `top-=${this.gl.sizes.height / 2} bottom`,
      end: () => `bottom+=${this.gl.sizes.height / 2} top`,
      invalidateOnRefresh: !0,
      onEnter: () => {
        this.isRendering = !0;
      },
      onEnterBack: () => {
        this.isRendering = !0;
      },
      onLeave: () => {
        this.isRendering = !1;
      },
      onLeaveBack: () => {
        this.isRendering = !1;
      },
    });
  }
  getBounds() {
    ((this.bounds = this.params.dom.getBoundingClientRect()),
      this.renderPlane.mesh.material.uniforms.uResolution.value.set(
        this.gl.sizes.width,
        this.gl.sizes.height,
      ),
      (this.renderPlane.mesh.material.uniforms.uPosition.value.x =
        this.bounds.left),
      this.renderPlane.mesh.material.uniforms.uScale.value.set(
        this.bounds.width,
        this.bounds.height,
      ));
  }
  setScroll() {
    e.fromTo(
      this.renderPlane.mesh.material.uniforms.uPosition.value,
      { y: () => Math.max(this.gl.sizes.height, this.bounds.height) },
      {
        y: () => -Math.max(this.gl.sizes.height, this.bounds.height),
        ease: "none",
        scrollTrigger: {
          invalidateOnRefresh: !0,
          scrub: !0,
          trigger: this.params.dom,
          start: () =>
            `center-=${Math.max(this.gl.sizes.height, this.bounds.height)} top+=${this.gl.sizes.height / 2}`,
          end: () =>
            `center+=${Math.max(this.gl.sizes.height, this.bounds.height)} top+=${this.gl.sizes.height / 2}`,
          refreshPriority: -99,
          onRefresh: () => {
            (this.getBounds(), this.updateCameraAspect());
          },
        },
      },
    );
  }
  getMouseShift() {
    a.create({
      trigger: this.params.dom,
      start: () => `top-=${this.params.dom.clientHeight} center`,
      end: () => `bottom+=${this.params.dom.clientHeight} center`,
      invalidateOnRefresh: !0,
      onUpdate: (e) => {
        this.progress = 2 * e.progress - 1;
      },
    });
  }
  renderPipeline() {
    this.isRendering &&
      (this.gl.renderer.instance.setRenderTarget(this.renderTarget),
      this.gl.renderer.instance.render(this.scene, this.camera),
      (this.renderPlane.mesh.material.uniforms.tDiffuse.value =
        this.renderTarget.texture));
  }
  setDebug() {
    (this.gl.debug.gui
      .add(
        this.renderPlane.mesh.material.uniforms.uDisplacementStrength,
        "value",
      )
      .min(-0.005)
      .max(0.005)
      .step(1e-5)
      .name("Product Displacement Stength"),
      this.gl.debug.gui
        .add(this.treeA.rotation, "y")
        .min(-Math.PI)
        .max(Math.PI)
        .step(0.01)
        .name("Tree A"),
      this.gl.debug.gui
        .add(this.treeB.rotation, "y")
        .min(-Math.PI)
        .max(Math.PI)
        .step(0.01)
        .name("Tree B"),
      this.gl.debug.gui
        .add(this.treeC.rotation, "y")
        .min(-Math.PI)
        .max(Math.PI)
        .step(0.01)
        .name("Tree C"),
      this.gl.debug.gui
        .add(this.treeD.rotation, "y")
        .min(-Math.PI)
        .max(Math.PI)
        .step(0.01)
        .name("Tree D"),
      this.gl.debug.gui
        .add(this.treeE.rotation, "y")
        .min(-Math.PI)
        .max(Math.PI)
        .step(0.01)
        .name("Tree E"));
  }
  update() {
    this.isRendering &&
      (this.easedMouse.normalized.update(
        this.gl.time.delta,
        Math.max(
          Math.min(
            this.gl.mouse.normalized.current.y / this.ratio -
              3 * this.progress,
            1,
          ),
          -1,
        ),
      ),
      (this.camera.position.x = w.lerp(
        4.3758,
        -4.9872,
        (0.5 + 0.5 * this.easedMouse.normalized.value.x) *
          this.renderPlane.mesh.material.uniforms.uMouseEffect.value,
      )),
      (this.camera.rotation.y = w.lerp(
        w.degToRad(4.34359),
        w.degToRad(-4.95),
        (0.5 + 0.5 * this.easedMouse.normalized.value.x) *
          this.renderPlane.mesh.material.uniforms.uMouseEffect.value,
      )),
      this.gl.sizes.width > 1024 &&
        (this.camera.rotation.z =
          -this.easedMouse.normalized.value.y *
          this.easedMouse.normalized.value.x *
          0.05),
      (this.renderPlane.mesh.material.uniforms.uMouse.value =
        this.easedMouse.normalized.value),
      this.raycastDOM.length > 0 &&
        this.raycastDOM.forEach((e, t) => {
          const s = new P();
          this.raycastGroup.children[t].getWorldPosition(s);
          s.project(this.camera);
          const i = s.x * this.gl.sizes.width * 0.5,
            n = -s.y * this.gl.sizes.height * 0.5;
          e.style.transform = `translateX(${i}px) translateY(${n}px)`;
        }),
      this.raycaster.setFromCamera(
        {
          x: this.gl.mouse.normalized.current.x,
          y:
            this.gl.mouse.normalized.current.y / this.ratio -
            3 * this.progress,
        },
        this.camera,
      ),
      (this.intersectedObjects = this.raycaster.intersectObjects([
        this.raycastA,
        this.raycastB,
        this.raycastC,
        this.raycastD,
      ])),
      this.intersectedObjects.length && this.isRevealEnded
        ? (this.isIntersecting = this.intersectedObjects[0].object.name)
        : (this.isIntersecting = !1),
      this.isIntersecting != this.previousIsIntersecting &&
        (this.raycastDOM.forEach((e, t) => {
          e.classList.remove("gl-raycast-active");
        }),
        this.isIntersecting &&
          document
            .querySelector(`[data-gl-raycast="${this.isIntersecting}"]`)
            .classList.add("gl-raycast-active")),
      (this.previousIsIntersecting = this.isIntersecting));
  }
}
class Ee {
  constructor() {
    ((this.gl = new Ie()), (this.selectors = []), (this.scenes = []));
  }
  add() {
    (this.gl.renderer.add(),
      (this.selectors = document.querySelectorAll("[data-gl]")),
      this.selectors.forEach((e, t) => {
        "clouds" === e.dataset.gl
          ? this.scenes.push(new ze({ dom: e }))
          : "robot-showcase" === e.dataset.gl &&
            this.scenes.push(new _e({ dom: e }));
      }));
    for (const e in this.scenes)
      this.gl.scene.add(this.scenes[e].renderPlane.mesh);
  }
  destroy() {
    this.gl.isDebug &&
      console.log("Before destroy:", this.gl.renderer.instance.info);
    for (const e in this.scenes)
      (this.gl.scene.remove(this.scenes[e].renderPlane.mesh),
        this.scenes[e].renderTarget && this.scenes[e].renderTarget.dispose(),
        this.scenes[e].renderPlane.mesh.geometry.dispose(),
        this.scenes[e].renderPlane.mesh.material.dispose(),
        this.scenes[e].scene &&
          this.scenes[e].scene.traverse((t) => {
            if ((this.scenes[e].scene.remove(t.name), t.isMesh))
              if ((t.geometry.dispose(), t.material.isMaterial))
                this.cleanMaterial(t.material);
              else for (const e of t.material) this.cleanMaterial(e);
          }));
    ((this.selectors = []),
      (this.scenes = []),
      this.gl.renderer.instance.setRenderTarget(null),
      this.gl.renderer.instance.clear(),
      this.gl.isDebug &&
        console.log("After destroy:", this.gl.renderer.instance.info));
  }
  cleanMaterial(e) {
    e.dispose();
    for (const t of Object.keys(e)) {
      const s = e[t];
      s && "object" == typeof s && "minFilter" in s && s.dispose();
    }
  }
  resize() {
    for (const e in this.scenes) this.scenes[e].resize();
  }
  update() {
    for (const e in this.scenes) this.scenes[e].update();
  }
}
class Re {
  constructor() {
    ((this.callbacks = {}), (this.callbacks.base = {}));
  }
  on(e, t) {
    if (void 0 === e || "" === e) return (console.warn("wrong names"), !1);
    if (void 0 === t) return (console.warn("wrong callback"), !1);
    return (
      this.resolveNames(e).forEach((e) => {
        const s = this.resolveName(e);
        (this.callbacks[s.namespace] instanceof Object ||
          (this.callbacks[s.namespace] = {}),
          this.callbacks[s.namespace][s.value] instanceof Array ||
            (this.callbacks[s.namespace][s.value] = []),
          this.callbacks[s.namespace][s.value].push(t));
      }),
      this
    );
  }
  off(e) {
    if (void 0 === e || "" === e) return (console.warn("wrong name"), !1);
    return (
      this.resolveNames(e).forEach((e) => {
        const t = this.resolveName(e);
        if ("base" !== t.namespace && "" === t.value)
          delete this.callbacks[t.namespace];
        else if ("base" === t.namespace)
          for (const s in this.callbacks)
            this.callbacks[s] instanceof Object &&
              this.callbacks[s][t.value] instanceof Array &&
              (delete this.callbacks[s][t.value],
              0 === Object.keys(this.callbacks[s]).length &&
                delete this.callbacks[s]);
        else
          this.callbacks[t.namespace] instanceof Object &&
            this.callbacks[t.namespace][t.value] instanceof Array &&
            (delete this.callbacks[t.namespace][t.value],
            0 === Object.keys(this.callbacks[t.namespace]).length &&
              delete this.callbacks[t.namespace]);
      }),
      this
    );
  }
  trigger(e, t) {
    if (void 0 === e || "" === e) return (console.warn("wrong name"), !1);
    const s = t instanceof Array ? t : [];
    let i = this.resolveNames(e);
    if (((i = this.resolveName(i[0])), "base" === i.namespace))
      for (const n in this.callbacks)
        this.callbacks[n] instanceof Object &&
          this.callbacks[n][i.value] instanceof Array &&
          this.callbacks[n][i.value].forEach(function (e) {
            e.apply(this, s);
          });
    else if (this.callbacks[i.namespace] instanceof Object) {
      if ("" === i.value) return (console.warn("wrong name"), this);
      this.callbacks[i.namespace][i.value].forEach(function (e) {
        e.apply(this, s);
      });
    }
    return null;
  }
  resolveNames(e) {
    let t = e;
    return (
      (t = t.replace(/[^a-zA-Z0-9 ,/.]/g, "")),
      (t = t.replace(/[,/]+/g, " ")),
      (t = t.split(" ")),
      t
    );
  }
  resolveName(e) {
    const t = {},
      s = e.split(".");
    return (
      (t.original = e),
      (t.value = s[0]),
      (t.namespace = "base"),
      s.length > 1 && "" !== s[1] && (t.namespace = s[1]),
      t
    );
  }
}
class Be extends Re {
  constructor() {
    (super(),
      (this.clock = new D()),
      (this.elapsed = 0),
      (this.delta = 0),
      e.ticker.add(this.tick.bind(this)));
  }
  tick() {
    ((this.delta = 100 * Math.min(this.clock.getDelta(), 1 / 30)),
      (this.elapsed = this.clock.getElapsedTime()),
      this.trigger("tick"));
  }
}
class Ae extends Re {
  constructor() {
    (super(),
      (this.width = window.innerWidth),
      (this.height = window.innerHeight),
      (this.pixelRatio = Math.min(window.devicePixelRatio, 1.5)),
      window.addEventListener("resize", () => {
        ((this.width = window.innerWidth),
          (this.height = window.innerHeight),
          (this.pixelRatio = Math.min(window.devicePixelRatio, 1.5)),
          this.trigger("resize"));
      }));
  }
}
class De {
  constructor() {
    ((this.gui = new k({ width: 300, closed: !0 })),
      (this.stats = new I()),
      this.stats.showPanel(0),
      document.body.appendChild(this.stats.dom));
  }
}
function enableGlFallback(reason) {
  document.documentElement.classList.add("gl-fallback");
  if (reason) document.documentElement.dataset.glFallback = reason;
}
class $e {
  constructor() {
    ((this.gl = new Ie()),
      (this.loadingManager = new O()),
      (this.ready = new Promise((resolve) => {
        this.loadingManager.onLoad = resolve;
      })),
      (this.loadingManager.onError = (url) => {
        enableGlFallback("asset-error");
        console.warn("WebGL asset failed to load:", url);
      }),
      (this.rgbeLoader = new U(this.loadingManager)),
      (this.gltfLoader = new F(this.loadingManager)),
      (this.models = { tree: null }),
      (this.textures = {
        matcap: new q(this.loadingManager).load(
          window.gl_assets.cloudsScene.textures.matcap,
        ),
        robotShowcase: {
          diffuse: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.diffuse,
          ),
          movec: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.movec,
          ),
          normal: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.normal,
          ),
        },
        trees: {
          a: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.trees.a,
          ),
          b: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.trees.b,
          ),
          c: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.trees.c,
          ),
          d: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.trees.d,
          ),
          e: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.trees.e,
          ),
          alpha: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.trees.alpha,
          ),
          shadow: new q(this.loadingManager).load(
            window.gl_assets.robotShowcaseScene.textures.trees.shadow,
          ),
        },
      }),
      (this.textures.robotShowcase.diffuse.minFilter = V),
      (this.textures.robotShowcase.diffuse.magFilter = V),
      (this.textures.robotShowcase.movec.minFilter = V),
      (this.textures.robotShowcase.movec.magFilter = V),
      (this.textures.robotShowcase.normal.minFilter = V),
      (this.textures.robotShowcase.normal.magFilter = V),
      (this.textures.robotShowcase.movec.colorSpace = N),
      (this.textures.robotShowcase.diffuse.colorSpace = N),
      (this.textures.robotShowcase.normal.colorSpace = N),
      (this.textures.matcap.minFilter = V),
      (this.textures.matcap.magFilter = V));
    for (const e in this.textures.trees)
      ((this.textures.trees[e].minFilter = V),
        (this.textures.trees[e].magFilter = V),
        (this.textures.trees[e].colorSpace = N),
        (this.textures.trees[e].flipY = !1));
    ((this.videosDOM = {
      robotShowcase: { reveal: document.querySelector(".gl-reveal-video") },
    }),
      this.videosDOM.robotShowcase.reveal.addEventListener(
        "error",
        () => enableGlFallback("video-error"),
        { once: !0 },
      ),
      (this.videos = {
        robotShowcase: { reveal: new j(this.videosDOM.robotShowcase.reveal) },
      }),
      (this.videos.robotShowcase.reveal.minFilter = V),
      (this.hdri = null),
      this.load());
  }
  load() {
    (this.gltfLoader.load(
      window.gl_assets.robotShowcaseScene.models.tree,
      (e) => {
        this.models.tree = e.scene.children[0];
      },
    ),
      this.gltfLoader.load(
        window.gl_assets.robotShowcaseScene.models.shadow,
        (e) => {
          this.models.shadow = e.scene.children[0];
        },
      ));
  }
  loadVideo() {
    return new Promise((e) => {
      const t = setInterval(() => {
        this.videosDOM.robotShowcase.reveal.readyState >= 4 &&
          (e(), clearInterval(t));
      }, 100);
    });
  }
}
let ke = null;
class Ie {
  constructor(e) {
    if (ke) return ke;
    ((ke = this),
      (this.urlParams = new URLSearchParams(window.location.search)),
      (this.isLoaded = !1),
      (this.isDebug = this.urlParams.has("debug")),
      (this.params = e),
      (this.canvas = null),
      (this.time = new Be()),
      (this.sizes = new Ae()),
      (this.mouse = new Te(document)),
      (this.scene = new y()),
      (this.camera = new Me()),
      (this.assets = new $e()),
      this.sizes.on("resize", () => {
        this.resize();
      }));
  }
  load() {
    return new Promise((e) => {
      Promise.all([this.loadDOM(), this.loadAssets()]).then(() => {
        e();
      });
    });
  }
  init() {
    (this.isDebug && (this.debug = new De()),
      (this.canvas = document.querySelector(this.params.canvas)),
      (this.world = new Ee()),
      (this.renderer = new Ce()),
      e.ticker.add(this.update.bind(this), !1, !0),
      this.world.add(),
      this.addToGlobalFunctions(),
      (this.isLoaded = !0));
  }
  loadAssets() {
    this.assets.loadingManager.onProgress = (e, t, s) => {
      this.isDebug &&
        console.log(
          "Loading file: " + e + ".\nLoaded " + t + " of " + s + " files.",
        );
    };
    return this.assets.ready;
  }
  loadDOM() {
    return new Promise((e) => {
      (window.addEventListener("load", () => {}), e());
    });
  }
  addToGlobalFunctions() {
    window.gl = {
      add: this.world.add.bind(this.world),
      destroy: this.world.destroy.bind(this.world),
    };
  }
  update() {
    this.isLoaded &&
      (this.isDebug && this.debug.stats.begin(),
      this.renderer.update(),
      this.world.update(),
      this.mouse.update(),
      this.isDebug && this.debug.stats.end());
  }
  resize() {
    (this.mouse.resize(),
      this.isLoaded &&
        (this.camera.resize(), this.renderer.resize(), this.world.resize()));
  }
}
const Oe = new H({ modules: Pe });
if (ce) {
  ae.classList.add("is-mobile");
  document.querySelectorAll("[data-scroll-speed]").forEach((e) => {
    e.removeAttribute("data-scroll-speed");
  });
}
function Ue() {
  (history.scrollRestoration &&
    ((history.scrollRestoration = "manual"), window.scrollTo(0, 0)),
    (function () {
      const e = new CustomEvent(Z.RESIZE_END);
      (window.addEventListener(
        "resize",
        ue(
          () => {
            window.dispatchEvent(e);
          },
          200,
          !1,
        ),
      ),
        window.addEventListener("resize", Fe));
    })(),
    Fe(),
    Oe.init(Oe),
    ae.classList.add(K.LOADED, K.READY, K.FIRST_LOADED),
    ae.classList.remove(K.LOADING),
    fe &&
      xe(J.EAGER, X.IS_DEV).then((e) => {
        ae.classList.add("fonts-loaded");
      }),
    void 0);
}
function Fe() {
  updateViewportUnits();
}
function qe() {
  const e = document.getElementById("mainStyles");
  e
    ? e.sheet
      ? Ue()
      : e.addEventListener("load", () => {
          Ue();
        }, { once: !0 })
    : console.warn('The "mainStyles" stylesheet not found');
}
((window.updateViewportUnits = () => {
  (ae.style.setProperty(
    "--vw",
    0.01 * document.documentElement.clientWidth + "px",
  ),
    ae.style.setProperty(
      "--vh",
      0.01 * document.documentElement.clientHeight + "px",
    ));
}),
  updateViewportUnits());
const Ve = "./assets/webgl";
window.gl_assets = {
  cloudsScene: {
    textures: {
      matcap: Ve + "/textures/cloud-matcap.png",
    },
  },
  robotShowcaseScene: {
    textures: {
      diffuse:
        window.innerWidth > 1024
          ? Ve + "/textures/robot-showcase-diffuse-desktop.webp"
          : Ve + "/textures/robot-showcase-diffuse-mobile.webp",
      movec:
        window.innerWidth > 1024
          ? Ve + "/textures/robot-showcase-motion-desktop.webp"
          : Ve + "/textures/robot-showcase-motion-mobile.webp",
      normal:
        window.innerWidth > 1024
          ? Ve + "/textures/robot-showcase-normal-desktop.webp"
          : Ve + "/textures/robot-showcase-normal-mobile.webp",
      trees: {
        a: Ve + "/textures/tree-diffuse-a.webp",
        b: Ve + "/textures/tree-diffuse-b.webp",
        c: Ve + "/textures/tree-diffuse-c.webp",
        d: Ve + "/textures/tree-diffuse-d.webp",
        e: Ve + "/textures/tree-diffuse-e.webp",
        alpha: Ve + "/textures/tree-alpha-mask.webp",
        shadow: Ve + "/textures/tree-shadow.webp",
      },
    },
    models: {
      tree: Ve + "/models/tree.glb",
      shadow: Ve + "/models/tree-shadow.glb",
    },
  },
};
let Ne = null;
function je() {
  return new Promise((e) => {
    "complete" === document.readyState
      ? e()
      : window.addEventListener("load", () => {
          e();
        });
  });
}
Y.isWebGL2Available()
  ? ((Ne = new Ie({ canvas: "canvas.gl" })),
    (() => {
      let settled = !1;
      const fail = (reason) => {
        if (settled) return;
        settled = !0;
        enableGlFallback(reason);
        qe();
      };
      const timeout = window.setTimeout(() => fail("load-timeout"), 7000);
      Promise.all([Ne.load(), je()])
        .then(() => {
          if (settled) return;
          settled = !0;
          window.clearTimeout(timeout);
          if (document.documentElement.classList.contains("gl-fallback")) qe();
          else (qe(), Ne.init());
        })
        .catch(() => fail("initialization-error"));
    })())
  : (document.documentElement.classList.add("gl-fallback"),
    je().then(() => {
      qe();
    }));
