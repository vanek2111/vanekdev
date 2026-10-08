(() => {
  const menuButton=document.querySelector('#menu-toggle');
  const mainNav=document.querySelector('#main-nav');
  if(menuButton&&mainNav){
    const closeMenu=()=>{menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Открыть меню');mainNav.classList.remove('is-open');};
    menuButton.addEventListener('click',()=>{
      const isOpen=menuButton.getAttribute('aria-expanded')==='true';
      menuButton.setAttribute('aria-expanded',String(!isOpen));
      menuButton.setAttribute('aria-label',isOpen?'Открыть меню':'Закрыть меню');
      mainNav.classList.toggle('is-open',!isOpen);
    });
    mainNav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  }
  const form = document.querySelector('#booking-form');
  if (!form) return;
  const status = document.querySelector('#form-status');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = 'Отправляем запрос…';
    const values = Object.fromEntries(new FormData(form));
    try {
      const result = await window.formaData.api('bookings', {
        method: 'POST',
        body: JSON.stringify({name: values.name, contact: values.contact, car: values.car, website: values.website, service: 'Консультация по детейлингу'})
      });
      status.textContent = `Запрос ${result.booking.number} принят. Мы свяжемся с вами.`;
      form.reset();
    } catch (error) {
      status.textContent = error.message || 'Сервис временно недоступен. Попробуйте чуть позже.';
    }
  });
})();
