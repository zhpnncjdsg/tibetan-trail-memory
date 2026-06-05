const glow = document.querySelector(".cursor-glow");
const hero = document.querySelector("[data-parallax]");

window.addEventListener("pointermove", (event) => {
  if (!glow) return;
  glow.style.left = `${event.clientX}px`;
  glow.style.top = `${event.clientY}px`;
});

window.addEventListener(
  "scroll",
  () => {
    if (!hero) return;
    const y = Math.min(window.scrollY * 0.12, 70);
    hero.style.setProperty("--hero-shift", `${y}px`);
    const image = hero.querySelector(".hero-image");
    if (image) image.style.transform = `translate3d(0, ${y}px, 0) scale(1.04)`;
  },
  { passive: true }
);
