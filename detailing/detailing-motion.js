(() => {
 const hero=document.querySelector('.hero');
 const video=document.querySelector('.hero-film');
 const button=document.querySelector('.film-toggle');
 if(!hero||!video||!button)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let userPaused=false,visible=true,raf=0,current=0,target=0,last=0;
 const clamp=n=>Math.max(0,Math.min(1,n));
 function tick(time){
  raf=0;const dt=Math.min(64,Math.max(1,time-last));last=time;
  current+=(target-current)*(1-Math.exp(-dt/120));
  const ease=current*current*(3-2*current);
  hero.style.setProperty('--finish',ease.toFixed(4));
  hero.style.setProperty('--sheen',(Math.sin(ease*Math.PI)*.8).toFixed(4));
  if(Math.abs(target-current)>.0005)raf=requestAnimationFrame(tick);
 }
 function update(){
  if(reduced.matches)return;
  target=clamp(-hero.getBoundingClientRect().top/(hero.offsetHeight*.78));
  if(!raf)raf=requestAnimationFrame(tick);
 }
 function label(){
  button.textContent=userPaused?'Видео: включить ▶':'Видео: пауза Ⅱ';
  button.setAttribute('aria-label',userPaused?'Включить фоновое видео':'Приостановить фоновое видео');
  button.setAttribute('aria-pressed',String(userPaused));
 }
 async function playback(){
  if(reduced.matches||navigator.connection?.saveData||document.hidden||!visible||userPaused){video.pause();return;}
  if(!video.getAttribute('src')){video.src=video.dataset.src;video.load();}
  try{await video.play();hero.classList.add('has-film');button.hidden=false;label();}
  catch{userPaused=true;button.hidden=false;label();}
 }
 button.addEventListener('click',()=>{userPaused=!userPaused;label();playback();});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;playback();},{threshold:0}).observe(hero);
 document.addEventListener('visibilitychange',playback);
 reduced.addEventListener('change',()=>{if(reduced.matches){video.pause();hero.classList.remove('has-film');hero.style.removeProperty('--finish');hero.style.removeProperty('--sheen');button.hidden=true;}else{playback();update();}});
 addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});
 video.addEventListener('error',()=>{hero.classList.remove('has-film');button.hidden=true;});
 update();
})();
