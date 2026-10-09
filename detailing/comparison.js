(() => {
  const frame = document.querySelector('[data-comparison]');
  const range = frame?.querySelector('.comparison-range');
  if (!frame || !range) return;

  const update = () => frame.style.setProperty('--split', `${range.value}%`);
  range.addEventListener('input', update);
  update();
})();
