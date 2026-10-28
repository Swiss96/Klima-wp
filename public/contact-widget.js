/* KLIMA-WP: Aufmerksamkeit beim ersten echten Scrollen, nur einmal pro Tab. */
(()=>{const el=document.querySelector('[data-kw-contact]');if(!el)return;
let started=false;let timer;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function close(){el.classList.remove('is-tip','is-returning','is-active');}
function start(){if(started)return;started=true;window.removeEventListener('scroll',onScroll);try{sessionStorage.setItem('kw-contact-seen','1')}catch(e){}
if(reduced){el.classList.add('is-tip');timer=setTimeout(close,10000);return;}
el.classList.add('is-active');setTimeout(()=>{el.classList.add('is-returning');el.classList.remove('is-active');el.classList.add('is-tip');timer=setTimeout(close,8000);},2000);
}
function onScroll(){if(window.scrollY>40)start()}
let seen=false;try{seen=sessionStorage.getItem('kw-contact-seen')==='1'}catch(e){}
if(!seen)window.addEventListener('scroll',onScroll,{passive:true});
})();
