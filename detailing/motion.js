(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const elements = document.querySelectorAll('[data-motion]');
  if (!elements.length || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('motion-ready');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' });

  elements.forEach((element, index) => {
    element.style.setProperty('--motion-delay', `${(index % 3) * 65}ms`);
    observer.observe(element);
  });
})();
