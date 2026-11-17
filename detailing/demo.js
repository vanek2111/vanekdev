(() => {
  'use strict';
  // This page intentionally has no data client, authentication or server requests.
  const cars = [
    { id: 'demo-bmw', name: 'BMW M5', detail: 'G90 · 2025 · чёрный сапфир', date: '12 ноября 2026' },
    { id: 'demo-porsche', name: 'Porsche 911', detail: '992 · 2023 · серебристый', date: '3 октября 2026' }
  ];
  const bookings = [
    { id: 'DEMO-003', car: 'BMW M5 · G90', service: 'Защитная плёнка на кузов', date: '17 ноября 2026', status: 'in_progress', label: 'В работе', note: 'Согласованы капот, передний бампер и зеркала. Идёт установка плёнки.' },
    { id: 'DEMO-002', car: 'Porsche 911 · 992', service: 'Детейлинг-мойка', date: '20 ноября 2026', status: 'confirmed', label: 'Подтверждена', note: 'Пример будущей записи на обслуживание.' },
    { id: 'DEMO-001', car: 'BMW M5 · G90', service: 'Полировка кузова', date: '12 ноября 2026', status: 'completed', label: 'Завершена', note: 'Коррекция лака и рекомендации по дальнейшему уходу.' }
  ];
  const carCard = car => `<article class="data-row"><div class="data-row-main"><strong>${car.name}</strong><small>${car.detail}</small><small>Добавлен ${car.date}</small></div><div class="data-row-side">Демоавтомобиль</div></article>`;
  const bookingCard = item => `<article class="data-row"><div class="data-row-main"><strong>${item.service}</strong><small>${item.car} · ${item.id}</small><small>${item.date}</small><small>${item.note}</small></div><div class="data-row-side"><span class="booking-status" data-status="${item.status}">${item.label}</span></div></article>`;
  document.querySelector('#overview-cars').innerHTML = cars.map(carCard).join('');
  document.querySelector('#cars-list').innerHTML = cars.map(carCard).join('');
  document.querySelector('#overview-bookings').innerHTML = bookings.slice(0,2).map(bookingCard).join('');
  document.querySelector('#all-bookings').innerHTML = bookings.map(bookingCard).join('');
  const tabs = [...document.querySelectorAll('[data-portal-view]')];
  function showView(name) {
    if (!['overview','cars','requests'].includes(name)) return;
    tabs.forEach(tab => { const active = tab.dataset.portalView === name; tab.classList.toggle('active',active); tab.setAttribute('aria-pressed',String(active)); });
    document.querySelectorAll('.portal-view').forEach(view => { view.hidden = view.id !== 'portal-' + name; });
  }
  tabs.forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.portalView)));
  document.querySelectorAll('[data-open-view]').forEach(button => button.addEventListener('click', () => { showView(button.dataset.openView); tabs.find(tab => tab.dataset.portalView === button.dataset.openView)?.focus(); }));
  showView('overview');
})();
