(() => {
  'use strict';
  document.documentElement.classList.add('maya-motion');
  const cat = document.createElement('button');
  cat.type = 'button'; cat.className = 'library-kitten';
  cat.setAttribute('aria-label','Pomazi Mayu; zadrži za maženje');
  cat.innerHTML = '<img src="./assets/maya.webp" alt="" width="44" height="44" /><span class="css-maya-wrap" aria-hidden="true"><span class="css-cat"><span class="css-cat-shadow"></span><span class="css-cat-tail"></span><span class="css-cat-body"></span><span class="css-cat-head"><span class="css-cat-ears"></span><span class="css-cat-ears second"></span><span class="css-cat-eyes"></span><span class="css-cat-nose"></span></span><span class="css-cat-paws"></span></span></span><span class="maya-hearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></span>';
  let timer, expiry, holdTimer;
  let running = false, showing = false, pressing = false, ignoreClick = false;
  let pressOrigin;
  let lastSpot = null;
  const randomDelay = (min,max) => min + Math.random() * (max-min);
  function schedule(first=false) {
    clearTimeout(timer);
    const frequency = window.studySettings?.get().mayaFrequency ?? 1;
    if (document.hidden || frequency === 0) return;
    const delays = frequency === 2 ? [4000,8000] : [20000,35000];
    timer = setTimeout(appear,first ? randomDelay(...(frequency === 2 ? [1000,3000] : [4000,8000])) : randomDelay(...delays));
  }
  function hide() {
    clearTimeout(expiry); clearTimeout(holdTimer);
    cat.remove(); cat.classList.remove('scurry','hugging');
    running = false; showing = false; pressing = false; ignoreClick = false;
  }
  function freePosition() {
    const width = window.innerWidth, height = window.innerHeight;
    const blocked = [...document.querySelectorAll('button,input,select,textarea,a,summary,[role="button"],[role="switch"],[role="slider"]')]
      .filter(element => element !== cat).map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    for (let attempt=0;attempt<40;attempt++) {
      const gutter = Math.max(32,(width-720)/2+36);
      const x = randomDelay(gutter,Math.max(gutter,width-gutter-44));
      const y = randomDelay(78,Math.max(78,height-124));
      if (!blocked.some(rect => x < rect.right+6 && x+44 > rect.left-6 && y < rect.bottom+6 && y+44 > rect.top-6)) return {x,y};
    }
    return null;
  }
  function place() {
    const spots = [...document.querySelectorAll('[data-cat-spot]')].filter(spot => {
      const rect = spot.getBoundingClientRect();
      return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight-80;
    });
    let point = Math.random() < .75 ? freePosition() : null;
    if (!point && spots.length) {
      const options = spots.filter(spot => spot !== lastSpot);
      const choices = options.length ? options : spots;
      const spot = choices[Math.floor(Math.random()*choices.length)];
      lastSpot = spot;
      const rect = spot.getBoundingClientRect();
      point = {x:rect.right-44,y:rect.bottom-44};
    }
    if (!point) point = freePosition();
    if (!point) return false;
    const gutter = Math.max(32,(window.innerWidth-720)/2+36);
    cat.style.left = `${Math.max(gutter,Math.min(point.x,window.innerWidth-gutter-44))}px`;
    cat.style.top = `${Math.max(4,Math.min(point.y,window.innerHeight-92))}px`;
    document.body.append(cat);
    return true;
  }
  function appear() {
    if (document.hidden || window.studySettings?.get().mayaFrequency === 0) return;
    if (Math.random()<.35) cat.classList.add('css-maya');
    else cat.classList.remove('css-maya');
    if (!place()) return schedule();
    showing = true;
    expiry = setTimeout(() => runAway(),14000);
  }
  function runAway(tapped=false) {
    if (running || !showing) return;
    running = true; pressing = false;
    clearTimeout(expiry); clearTimeout(holdTimer);
    if (tapped) window.studySettings?.play('maya');
    const angle = Math.random()*Math.PI*2;
    const distance = randomDelay(160,260);
    cat.style.setProperty('--maya-dx',`${Math.cos(angle)*distance}px`);
    cat.style.setProperty('--maya-dy',`${Math.sin(angle)*distance}px`);
    cat.classList.add('scurry');
    expiry = setTimeout(() => {hide();schedule();},1100);
  }
  function cuddle() {
    if (!showing || running || !pressing) return;
    running = true; pressing = false; ignoreClick = true;
    clearTimeout(expiry);
    cat.classList.add('hugging');
    window.studySettings?.play('maya');
    expiry = setTimeout(() => {hide();schedule();},1900);
  }
  cat.addEventListener('pointerdown',event => {
    if (running || event.isPrimary === false || event.button !== 0) return;
    pressing = true; ignoreClick = false;
    pressOrigin = {x:event.clientX,y:event.clientY};
    clearTimeout(expiry);
    try { cat.setPointerCapture(event.pointerId); } catch {}
    holdTimer = setTimeout(cuddle,450);
  });
  cat.addEventListener('pointermove',event => {
    if (!pressing || !pressOrigin) return;
    if (Math.hypot(event.clientX-pressOrigin.x,event.clientY-pressOrigin.y)>14) {
      pressing = false; ignoreClick = true; clearTimeout(holdTimer);
      expiry = setTimeout(() => runAway(),2000);
    }
  });
  cat.addEventListener('pointerup',event => {
    clearTimeout(holdTimer);
    try { cat.releasePointerCapture(event.pointerId); } catch {}
    if (pressing && !running) {ignoreClick=true;runAway(true);}
    pressing = false;
  });
  cat.addEventListener('pointercancel',() => {
    clearTimeout(holdTimer); pressing = false; ignoreClick = true;
    if (showing && !running) expiry = setTimeout(() => runAway(),2000);
  });
  cat.addEventListener('contextmenu',event => event.preventDefault());
  cat.addEventListener('click',() => {
    if (ignoreClick) {ignoreClick=false;return;}
    runAway(true);
  });
  document.addEventListener('visibilitychange',() => {hide();schedule();});
  new MutationObserver(() => {
    if (showing && !running && !pressing) place();
  }).observe(document.getElementById('app'),{childList:true});
  window.addEventListener('resize',() => {if (showing && !running && !pressing) place();});
  document.addEventListener('study-settings-change',event => {
    if (event.detail?.mayaFrequency === undefined) return;
    if (event.detail.mayaFrequency === 0) { clearTimeout(timer); hide(); }
    else if (!showing) schedule();
  });
  schedule(true);
})();
