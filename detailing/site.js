(() => {
  const form = document.querySelector('#booking-form');
  if (!form) return;
  const status = document.querySelector('#form-status');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = 'Отправляем запрос…';
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch('./api/bookings', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin',
        body: JSON.stringify({name: values.name, contact: values.contact, car: values.car, service: 'Консультация по детейлингу'})
      });
      const result = await response.json();
      if (!response.ok) {
        status.textContent = response.status === 401 ? 'Чтобы записаться онлайн, войдите в личный кабинет или создайте аккаунт.' : (result.error || 'Не удалось отправить запрос. Попробуйте ещё раз.');
        if (response.status === 401) window.location.href = `account.html?next=booking`;
        return;
      }
      status.textContent = `Запрос ${result.booking.number} принят. Мы свяжемся с вами.`;
      form.reset();
    } catch {
      status.textContent = 'Сервис временно недоступен. Попробуйте чуть позже.';
    }
  });
})();
