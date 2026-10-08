(() => {
  const api=window.formaData.api;
  const authCard=document.querySelector('#auth-card'), portal=document.querySelector('#portal-section'), authForm=document.querySelector('#auth-form');
  const authStatus=document.querySelector('#auth-status');
  let currentAuthMode='login', currentUser=null, vehicles=[], bookings=[];
  const humanError = error => {
    if (error?.name==='TimeoutError' || error?.name==='AbortError') return 'Сервер долго не отвечает. Убедись, что он запущен, и попробуй ещё раз.';
    if (error instanceof TypeError) return 'Нет связи с сервисом. Проверь интернет и попробуй ещё раз.';
    return error?.message || 'Что-то пошло не так. Попробуй ещё раз.';
  };
  const safe = value => String(value??'').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date = value => {const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'':new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(parsed);};
  const statusNames={new:'Новая заявка',confirmed:'Подтверждена',in_progress:'В работе',ready:'Готов к выдаче',completed:'Завершена',cancelled:'Отменена'};
  const renderEmpty=(text)=>`<div class="empty-state">${text}</div>`;
  const carLabel=car=>[car.make,car.model,car.color].filter(Boolean).map(safe).join(' · ');
  function carCard(car){return `<article class="data-row"><span class="data-row-main"><strong>${carLabel(car)}</strong><small>Добавлен ${safe(date(car.created_at)||'в профиль')}</small></span><span class="data-row-side"><span>Автомобиль</span></span></article>`;}
  function bookingCard(item, staff=false){
    const contact=staff?`<small>${safe(item.name)} · ${safe(item.contact)}${item.email?' · '+safe(item.email):''}</small>`:'';
    const statusControl=staff?`<select class="status-select" data-booking-status="${safe(item.public_id)}" aria-label="Изменить статус заявки">${Object.entries(statusNames).map(([value,label])=>`<option value="${value}" ${item.status===value?'selected':''}>${label}</option>`).join('')}</select>`:`<span class="booking-status">${safe(statusNames[item.status]||item.status)}</span>`;
    const linkedVehicle=vehicles.find(car=>car.id===item.vehicle_id);
    const vehicleLabel=item.vehicle_label|| (linkedVehicle?[linkedVehicle.make,linkedVehicle.model,linkedVehicle.color].filter(Boolean).join(' · '):'Автомобиль не указан');
    return `<article class="data-row"><span class="data-row-main"><strong>${safe(item.service)}</strong><small>${safe(vehicleLabel)} · ${safe(item.public_id)} · ${safe(date(item.created_at))}</small>${contact}${item.message?`<small>${safe(item.message)}</small>`:''}</span><span class="data-row-side">${statusControl}</span></article>`;
  }
  function render() {
    const firstName=(currentUser.name||'').trim().split(/\s+/)[0]||'Добро пожаловать';
    document.querySelector('#portal-title').textContent=`Здравствуйте, ${firstName}`;
    document.querySelector('#role-badge').textContent=currentUser.role==='owner'?'ВЛАДЕЛЕЦ FORMA':currentUser.role==='staff'?'КОМАНДА FORMA':'КЛИЕНТ';
    document.querySelector('#portal-kicker').textContent=['staff','owner'].includes(currentUser.role)?'РАБОЧЕЕ ПРОСТРАНСТВО':'ЛИЧНЫЙ КАБИНЕТ';
    document.querySelector('.staff-only').hidden=!['staff','owner'].includes(currentUser.role);
    document.querySelector('#overview-cars').innerHTML=vehicles.length?vehicles.slice(0,3).map(carCard).join(''):renderEmpty('Добавьте автомобиль в профиль — записи и история будут собраны здесь.');
    document.querySelector('#cars-list').innerHTML=vehicles.length?vehicles.map(carCard).join(''):renderEmpty('В профиле пока нет автомобилей. Добавьте первый ниже.');
    document.querySelector('#overview-bookings').innerHTML=bookings.length?bookings.slice(0,3).map(item=>bookingCard(item)).join(''):renderEmpty('Пока нет записей. Выберите услугу и оставьте первую заявку.');
    document.querySelector('#all-bookings').innerHTML=bookings.length?bookings.map(item=>bookingCard(item)).join(''):renderEmpty('История появится здесь после первой записи.');
    const select=document.querySelector('#booking-car');
    select.innerHTML=vehicles.length?vehicles.map(car=>`<option value="${car.id}">${carLabel(car)}</option>`).join('')+'<option value="">Не указывать автомобиль</option>':'<option value="" disabled selected>Добавьте автомобиль в профиль</option>';
  }
  async function openPortal(user) {
    try {
      const [vehicleResult,bookingResult]=await Promise.all([api('vehicles'),api('bookings')]);
      currentUser=user; vehicles=vehicleResult.vehicles; bookings=bookingResult.bookings; render();
      authCard.hidden=true; portal.hidden=false;
      requestAnimationFrame(()=>portal.scrollIntoView({behavior:'smooth',block:'start'}));
      if (['staff','owner'].includes(user.role)) await loadStaff();
    } catch(error) {authCard.hidden=false; portal.hidden=true; authStatus.textContent=humanError(error);}
  }
  function setAuthMode(next) {
    currentAuthMode=next;
    document.querySelectorAll('.auth-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.authMode===next));
    document.querySelectorAll('.register-only').forEach(field=>field.hidden=next!=='register');
    document.querySelector('#auth-submit').innerHTML=next==='login'?'Войти <span>↗</span>':'Создать аккаунт <span>↗</span>';
    document.querySelector('#auth-hint').textContent=next==='login'?'Войдите, чтобы увидеть данные своего автомобиля.':'Пароль должен содержать не менее 10 символов.';
    document.querySelector('#auth-password').autocomplete=next==='login'?'current-password':'new-password';
    document.querySelector('#auth-name').required=next==='register';
    document.querySelector('#auth-phone').required=next==='register';
    authStatus.textContent='';
  }
  document.querySelectorAll('.auth-tab').forEach(tab=>tab.addEventListener('click',()=>setAuthMode(tab.dataset.authMode)));
  const phoneInput=document.querySelector('#auth-phone');
  const formatPhone=value=>{
    let digits=String(value||'').replace(/\D/g,'');
    if(digits.startsWith('7')||digits.startsWith('8'))digits=digits.slice(1);
    digits=digits.slice(0,10);
    if(!digits)return '+7 ';
    const a=digits.slice(0,3),b=digits.slice(3,6),c=digits.slice(6,8),d=digits.slice(8,10);
    return `+7 (${a}${a.length===3?')':''}${b?` ${b}`:''}${c?`-${c}`:''}${d?`-${d}`:''}`;
  };
  phoneInput.addEventListener('focus',()=>{if(!phoneInput.value)phoneInput.value='+7 ';});
  phoneInput.addEventListener('input',()=>{phoneInput.value=formatPhone(phoneInput.value);});
  phoneInput.addEventListener('keydown',event=>{
    if(event.key==='Backspace'&&phoneInput.selectionStart<=3){event.preventDefault();phoneInput.setSelectionRange(3,3);}
  });
  authForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const email=document.querySelector('#auth-email'), password=document.querySelector('#auth-password'), name=document.querySelector('#auth-name');
    if(currentAuthMode==='register'&&name.value.trim().length<2){authStatus.textContent='Введи имя — хотя бы 2 символа.';name.focus();return;}
    if(!email.value.trim()||!email.validity.valid){authStatus.textContent='Проверь адрес электронной почты.';email.focus();return;}
    if(currentAuthMode==='register'&&phoneInput.value.replace(/\D/g,'').length!==11){authStatus.textContent='Введи российский номер полностью: +7 и ещё 10 цифр.';phoneInput.focus();return;}
    if(currentAuthMode==='login'&&!password.value){authStatus.textContent='Введи пароль от аккаунта.';password.focus();return;}
    if(currentAuthMode==='register'&&password.value.length<10){authStatus.textContent='Новый пароль должен содержать не менее 10 символов.';password.focus();return;}
    const button=document.querySelector('#auth-submit'), original=button.innerHTML;
    button.disabled=true;button.innerHTML='Подождите…';authStatus.textContent='';
    const fields=Object.fromEntries(new FormData(authForm));
    try {
      const result=await api(currentAuthMode==='login'?'login':'register',{method:'POST',body:JSON.stringify(fields)});
      if(currentAuthMode==='register'&&result.confirmationRequired){authStatus.textContent='Аккаунт создан. Проверь почту и подтверди адрес, затем войди.';return;}
      await openPortal(result.user);
    } catch(error) {authStatus.textContent=humanError(error);}
    finally {button.disabled=false;button.innerHTML=original;}
  });
  document.querySelector('#logout-button').addEventListener('click',async()=>{try{await api('logout',{method:'POST',body:'{}'});}finally{portal.hidden=true;authCard.hidden=false;authForm.reset();setAuthMode('login');}});
  document.querySelectorAll('[data-portal-view]').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('[data-portal-view]').forEach(item=>item.classList.toggle('active',item===tab));
    document.querySelectorAll('.portal-view').forEach(view=>view.hidden=view.id!==`portal-${tab.dataset.portalView}`);
    if(tab.dataset.portalView==='staff'&&['staff','owner'].includes(currentUser?.role))void loadStaff();
  }));
  document.querySelectorAll('[data-open-view]').forEach(link=>link.addEventListener('click',()=>document.querySelector(`[data-portal-view="${link.dataset.openView}"]`).click()));
  document.querySelector('#car-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,status=document.querySelector('#car-status');status.textContent='Сохраняем…';
    try {await api('vehicles',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();vehicles=(await api('vehicles')).vehicles;render();status.textContent='Автомобиль добавлен в профиль.';}catch(error){status.textContent=error.message;}
  });
  document.querySelector('#portal-booking-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,status=document.querySelector('#booking-status');status.textContent='Отправляем…';
    const data=Object.fromEntries(new FormData(form));
    const wantedDate=data.preferredDate?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${data.preferredDate}T12:00:00`)):'';
    const message=[wantedDate?`Желаемая дата: ${wantedDate}`:'',data.message].filter(Boolean).join('\n');
    const selectedVehicle=vehicles.find(car=>car.id===data.vehicleId);
    const vehicleLabel=selectedVehicle?[selectedVehicle.make,selectedVehicle.model,selectedVehicle.color].filter(Boolean).join(' · '):'';
    try {const result=await api('bookings',{method:'POST',body:JSON.stringify({name:currentUser.name,contact:currentUser.phone,vehicle_id:data.vehicleId||null,vehicleId:data.vehicleId||null,vehicle_label:vehicleLabel,service:data.service,message})});status.textContent=`Заявка ${result.booking.number} сохранена. Студия свяжется с вами.`;form.reset();bookings=(await api('bookings')).bookings;render();}
    catch(error){status.textContent=error.message;}
  });
  const preferredDate=document.querySelector('#booking-date');
  if(preferredDate){const today=new Date();today.setMinutes(today.getMinutes()-today.getTimezoneOffset());preferredDate.min=today.toISOString().slice(0,10);}
  async function loadStaff(){
    const target=document.querySelector('#staff-bookings');target.innerHTML=renderEmpty('Загружаем заявки…');
    try {const result=await api('studio/bookings');target.innerHTML=result.bookings.length?result.bookings.map(item=>bookingCard(item,true)).join(''):renderEmpty('Новых заявок пока нет.');
      target.querySelectorAll('[data-booking-status]').forEach(select=>select.addEventListener('change',async()=>{try{await api(`studio/bookings/${encodeURIComponent(select.dataset.bookingStatus)}`,{method:'PATCH',body:JSON.stringify({status:select.value})});}catch(error){document.querySelector('#global-status').textContent=error.message;}}));
    } catch(error){target.innerHTML=renderEmpty(safe(error.message));}
  }
  document.querySelector('#refresh-staff').addEventListener('click',()=>void loadStaff());
  api('me').then(result=>{if(result.authenticated)void openPortal(result.user);}).catch(error=>{authStatus.textContent=humanError(error);});
})();
