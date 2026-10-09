(() => {
  const shell = document.querySelector('#workspace-shell');
  const switchButton = document.querySelector('#mode-switch');
  const title = document.querySelector('#workspace-title');
  const intro = document.querySelector('#workspace-intro');
  const portalLabel = document.querySelector('#portal-label');
  const welcomeKicker = document.querySelector('#welcome-kicker');
  const welcomeTitle = document.querySelector('#welcome-title');
  const welcomeMeta = document.querySelector('#welcome-meta');
  const statusLabel = document.querySelector('#status-label');
  const statusPill = document.querySelector('#status-pill');
  const orderType = document.querySelector('#order-type');
  const orderTitle = document.querySelector('#order-title');
  const orderId = document.querySelector('#order-id');
  const progressValue = document.querySelector('#progress-value');
  const progressTrack = document.querySelector('#progress-track');
  const milestones = document.querySelector('#milestones');
  const timelineLabel = document.querySelector('#timeline-label');
  const nextTitle = document.querySelector('#next-title');
  const nextDesc = document.querySelector('#next-desc');
  const dialog = document.querySelector('#detail-dialog');
  const formStatus = document.querySelector('#form-status');
  const staffPreview = new URLSearchParams(window.location.search).has('staff');
  switchButton.hidden = !staffPreview;
  let studioMode = false;
  let photoIndex = 3;
  const clientSnapshot = {title:'Личный кабинет', intro:'Здесь собраны актуальный статус работ, фотоотчёт и история обслуживания вашего автомобиля.'};

  const setView = view => {
    document.querySelectorAll('.side-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    const labels = {overview:['BMW M5','G90 · общий обзор'],cars:['Мои автомобили','1 автомобиль в профиле'],history:['История ухода','Заказы и рекомендации']};
    const chosen = labels[view] || labels.overview;
    if (!studioMode) {
      welcomeTitle.innerHTML = `${chosen[0]} <span>${view === 'overview' ? 'G90' : ''}</span>`;
      welcomeMeta.textContent = view === 'overview' ? '2025 · Чёрный сапфир · VIN ···· 8K21' : chosen[1];
      if (view === 'history') { orderType.textContent = 'ПОСЛЕДНИЙ ЗАКАЗ'; orderTitle.innerHTML = 'Оклейка передней части<br>полиуретановой плёнкой'; statusLabel.textContent = 'ИСТОРИЯ ОБСЛУЖИВАНИЯ'; }
      else { orderType.textContent = 'КОМПЛЕКСНАЯ ЗАЩИТА'; orderTitle.innerHTML = 'Подготовка кузова<br>и защитная плёнка'; statusLabel.textContent = 'ТЕКУЩИЙ ЗАКАЗ'; }
    }
  };

  switchButton.addEventListener('click', () => {
    studioMode = !studioMode;
    shell.classList.toggle('studio-mode', studioMode);
    switchButton.innerHTML = studioMode ? 'Студия <span>↔</span> Клиент' : 'Клиент <span>↔</span> Студия';
    title.innerHTML = studioMode ? 'Студия —<br><em>в одном экране.</em>' : clientSnapshot.title;
    intro.textContent = studioMode ? 'Панель команды: загрузка, активные заказы, статусы работ и ближайшие записи.' : clientSnapshot.intro;
    portalLabel.textContent = studioMode ? 'ПАНЕЛЬ СТУДИИ' : 'КЛИЕНТСКИЙ КАБИНЕТ';
    welcomeKicker.textContent = studioMode ? 'СМЕНА · ЧЕТВЕРГ' : 'ВАШ АВТОМОБИЛЬ';
    welcomeTitle.innerHTML = studioMode ? 'FORMA <span>STUDIO</span>' : 'BMW M5 <span>G90</span>';
    welcomeMeta.textContent = studioMode ? '3 поста · 5 мастеров · 4 заказа в работе' : '2025 · Чёрный сапфир · VIN ···· 8K21';
    statusLabel.textContent = studioMode ? 'ЗАКАЗЫ В РАБОТЕ · 04' : 'ТЕКУЩИЙ ЗАКАЗ';
    statusPill.innerHTML = '<i></i> В РАБОТЕ';
    orderType.textContent = studioMode ? 'ЗАГРУЗКА ПОСТОВ · СЕГОДНЯ' : 'КОМПЛЕКСНАЯ ЗАЩИТА';
    orderTitle.innerHTML = studioMode ? 'BMW M5 G90 · Защитная плёнка<br>Mercedes GLE · Полировка' : 'Подготовка кузова<br>и защитная плёнка';
    orderId.innerHTML = studioMode ? 'ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ <span>·</span> 12:42' : 'ЗАКАЗ F-2481 <span>·</span> ПРИЁМКА 08 ОКТ, 10:30';
    progressValue.innerHTML = studioMode ? '04<small> / 06</small>' : '68<small>%</small>';
    progressTrack.style.width = studioMode ? '66%' : '68%';
    timelineLabel.textContent = studioMode ? 'БЛИЖАЙШАЯ ЗАПИСЬ' : 'СЛЕДУЮЩИЙ ЭТАП';
    nextTitle.textContent = studioMode ? 'BMW X5 · приёмка автомобиля' : 'Оклейка передней части';
    nextDesc.textContent = studioMode ? 'Сегодня, 14:30 · мастер Алексей' : 'Мастер Дмитрий · ориентир сегодня, 15:00';
    milestones.innerHTML = studioMode ? '<div class="done"><i>✓</i><span>Новые</span></div><div class="done"><i>02</i><span>Приёмка</span></div><div class="current"><i>03</i><span>В работе</span></div><div><i>04</i><span>Выдача</span></div>' : '<div class="done"><i>✓</i><span>Приёмка</span></div><div class="done"><i>✓</i><span>Подготовка</span></div><div class="current"><i>03</i><span>Оклейка</span></div><div><i>04</i><span>Выдача</span></div>';
    document.querySelector('.care-card h4').textContent = studioMode ? 'Контроль качества' : 'Керамика кузова';
    document.querySelector('.care-card p').textContent = studioMode ? 'Чек-лист финального осмотра перед выдачей автомобиля.' : 'Рекомендуем через 6 месяцев после нанесения защитного слоя.';
    document.querySelectorAll('.side-link').forEach(button => button.classList.remove('active'));
    document.querySelector('[data-view="overview"]').classList.add('active');
  });

  document.querySelectorAll('.side-link').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelector('#details-button').addEventListener('click', () => dialog.showModal());
  document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  document.querySelector('#photo-next').addEventListener('click', () => {
    photoIndex = photoIndex % 12 + 1;
    document.querySelector('.photo-counter').textContent = `${String(photoIndex).padStart(2, '0')} / 12`;
    document.querySelector('.photo-caption b').textContent = ['Подготовка стекла','Контроль кромки плёнки','Чистая зона нанесения','Проверка отражения'][photoIndex % 4];
    document.querySelectorAll('.photo-dots i').forEach((dot, index) => dot.classList.toggle('selected', index === (photoIndex - 1) % 4));
  });
  document.querySelector('#photo-more').addEventListener('click', () => document.querySelector('#photo-next').click());
  document.querySelector('#notify-toggle').addEventListener('click', event => {
    const enabled = event.currentTarget.textContent === 'Настроить';
    event.currentTarget.textContent = enabled ? 'Выключить' : 'Настроить';
    document.querySelector('.timeline-footer').firstElementChild.innerHTML = enabled ? 'Уведомления настроены' : '<i class="online-dot"></i> Уведомления включены';
  });
  document.querySelector('#demo-reset').addEventListener('click', () => {
    if (studioMode) switchButton.click();
    setView('overview');
    photoIndex = 3;
    document.querySelector('.photo-counter').textContent = '03 / 12';
    document.querySelector('.photo-caption b').textContent = 'Подготовка стекла';
    document.querySelectorAll('.photo-dots i').forEach((dot,index) => dot.classList.toggle('selected', index === 2));
  });
  document.querySelector('#booking-form').addEventListener('submit', event => {
    event.preventDefault();
    formStatus.textContent = 'Спасибо! Мы свяжемся с вами, чтобы обсудить автомобиль и подходящие работы.';
  });
  if (staffPreview) switchButton.click();
})();
