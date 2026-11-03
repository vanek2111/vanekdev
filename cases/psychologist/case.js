(() => {
const phrases={ru:[
'Здравствуйте, Елизавета. Хотелось бы записаться на консультацию, но пока трудно сформулировать запрос.',
'Здравствуйте, Елизавета. Хотелось бы обсудить конкретную ситуацию и узнать о записи на консультацию.',
'Здравствуйте, Елизавета. Хочу сначала узнать, как проходит консультация и какой формат можно выбрать.'
],en:[
'Hello, Elizaveta. I would like to book a consultation, but I am finding it hard to put my concerns into words.',
'Hello, Elizaveta. I would like to discuss a specific situation and ask about booking a consultation.',
'Hello, Elizaveta. I would first like to learn how a consultation works and which format to choose.'
]};
const field=document.querySelector('#phrase'),status=document.querySelector('#phrase-status');
let selected=0,edited=false,changed=false;
function render(){
 const lang=document.documentElement.lang==='en'?'en':'ru';
 if(!edited)field.value=phrases[lang][selected];
 status.textContent=lang==='en'?(changed?'Message replaced. You can edit it. Nothing is submitted.':'Your text is not sent anywhere.'):(changed?'Фраза заменена. Можно отредактировать её. Отправки нет.':'Текст никуда не отправляется.');
}
field.addEventListener('input',()=>{edited=true;});
document.querySelectorAll('[data-phrase]').forEach(button=>button.addEventListener('click',()=>{
 selected=Number(button.dataset.phrase);edited=false;changed=true;
 document.querySelectorAll('[data-phrase]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
 render();
}));
document.addEventListener('portfolio-language-change',render);render();
})();
