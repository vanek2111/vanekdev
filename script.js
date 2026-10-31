'use strict';
// The document scrolls normally; only the central person is sticky in CSS.
// Projects and sections remain in document flow, including without JavaScript.
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('js');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: .12});
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}
// Mark the project currently crossing the centre of the viewport.
const counter = document.querySelector('.project-counter');
if ('IntersectionObserver' in window) {
  const projectObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        counter.textContent = `${String(Number(entry.target.dataset.project) + 1).padStart(2, '0')} / 03`;
      }
    });
  }, {rootMargin: '-45% 0px -45% 0px', threshold: 0});
  document.querySelectorAll('.project').forEach(project => projectObserver.observe(project));
}


// A sharp poster pose keeps the silhouette clean; the rail still follows scroll.
// One scroll timeline drives the composition and the background film.
(() => {
  const core = document.querySelector('.canvas-core');
  const region = document.querySelector('.canvas-screen');
  const video = document.querySelector('#city-background');
  const toggle = document.querySelector('.background-toggle');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let frozen = false;
  let current = 0;
  let target = 0;
  let lastTime = 0;
  let raf = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => value * value * (3 - 2 * value);
  function updateTarget() {
    const rect = region.getBoundingClientRect();
    target = clamp(-rect.top / Math.max(1, region.offsetHeight - innerHeight));
    if (!raf) raf = requestAnimationFrame(render);
  }
  function render(time) {
    raf = 0;
    const dt = Math.min(64, Math.max(1, time - lastTime));
    lastTime = time;
    current += (target - current) * (1 - Math.exp(-dt / 95));
    if (motion.matches) {
      const travelProgress = clamp((current - .015) / .17);
      const travel = travelProgress ** 3 * (travelProgress * (travelProgress * 6 - 15) + 10);
      document.querySelector('.hero').style.setProperty('--hero-exit', String(smooth(clamp(current * 12))));
      if (innerWidth >= 1100) {
        core.style.setProperty('--character-x', `${travel * 27}vw`);
        core.style.setProperty('--character-y', `${-Math.sin(travel * Math.PI) * 14}px`);
        core.style.setProperty('--character-tilt', `${Math.sin(travel * Math.PI) * -.65}deg`);
      }
      if (!frozen && video.duration && !video.seeking) {
        const frameTime = .04 + (1 - current) * Math.max(0, video.duration - .12);
        if (Math.abs(video.currentTime - frameTime) > .045) video.currentTime = frameTime;
      }
    } else {
      core.style.removeProperty('--character-x');
      core.style.removeProperty('--character-y');
      core.style.removeProperty('--character-tilt');
      core.querySelector('img').style.removeProperty('transform');
    }
    if (Math.abs(target - current) > .00015 || (video.seeking && !frozen)) raf = requestAnimationFrame(render);
  }
  function initializeVideo() {
    video.pause();
    if (!motion.matches || navigator.connection?.saveData) return;
    if (!video.getAttribute('src')) { video.src = video.dataset.src; video.load(); }
    toggle.hidden = false;
    toggle.textContent = window.portfolioLanguage.t(frozen ? 'Фон: по скроллу' : 'Фон: зафиксировать');
    updateTarget();
  }
  video.addEventListener('loadedmetadata', () => {video.currentTime = Math.max(.04, video.duration - .08); updateTarget();});
  video.addEventListener('seeked', () => {if (!frozen && Math.abs(target-current) > .00015) updateTarget();});
  toggle.addEventListener('click', () => {
    frozen = !frozen;
    toggle.textContent = window.portfolioLanguage.t(frozen ? 'Фон: по скроллу' : 'Фон: зафиксировать');
    toggle.setAttribute('aria-pressed', String(frozen));
    updateTarget();
  });
  addEventListener('scroll', updateTarget, {passive:true});
  addEventListener('resize', updateTarget, {passive:true});
  motion.addEventListener('change', initializeVideo);
  initializeVideo();
})();



