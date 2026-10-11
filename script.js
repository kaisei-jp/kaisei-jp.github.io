const header = document.querySelector("[data-header]");
const menuButton = document.querySelector("[data-menu-button]");
const nav = document.querySelector("[data-nav]");
const navLinks = nav.querySelectorAll("a");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const setMenuOpen = (isOpen) => {
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "关闭导航" : "打开导航");
  nav.classList.toggle("is-open", isOpen);
  document.body.classList.toggle("menu-open", isOpen);
};

menuButton.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});

window.addEventListener(
  "scroll",
  () => header.classList.toggle("is-scrolled", window.scrollY > 24),
  { passive: true },
);

const revealItems = document.querySelectorAll(".reveal");

if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" },
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    revealObserver.observe(item);
  });
}

document.querySelector("[data-year]").textContent = new Date().getFullYear();
