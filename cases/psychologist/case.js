const phrases = [
'Здравствуйте, Елизавета. Хотелось бы записаться на консультацию, но пока трудно сформулировать запрос.',
'Здравствуйте, Елизавета. Хотелось бы обсудить конкретную ситуацию и узнать о записи на консультацию.',
'Здравствуйте, Елизавета. Хочу сначала узнать, как проходит консультация и какой формат можно выбрать.'
];
const field = document.querySelector('#phrase');
document.querySelectorAll('[data-phrase]').forEach(button => button.addEventListener('click', () => {
  field.value = phrases[Number(button.dataset.phrase)];
  document.querySelectorAll('[data-phrase]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#phrase-status').textContent = 'Фраза заменена. Можно отредактировать её. Отправки нет.';
}));
