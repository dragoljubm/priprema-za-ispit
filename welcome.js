(() => {
  'use strict';
  const key = 'study-buddy-maya-welcome-v2';
  const dialog = document.getElementById('mayaWelcome');
  if (!dialog) return;
  const preview = new URLSearchParams(window.location.search).get('welcome') === 'preview';
  try { if (!preview && localStorage.getItem(key) === 'seen') return; } catch {}
  let shown = false;
  function greet() {
    if (shown || document.hidden) return;
    dialog.showModal();
    shown = true;
    try { if (!preview) localStorage.setItem(key,'seen'); } catch {}
    document.removeEventListener('visibilitychange',greet);
  }
  dialog.addEventListener('click',() => {
    if (!dialog.open) return;
    const rect = dialog.getBoundingClientRect();
    const x = rect.left + rect.width/2, y = rect.top + rect.height/2;
    dialog.close();
    const petals = document.createElement('div');
    petals.className = 'welcome-petals';
    petals.setAttribute('aria-hidden','true');
    for (let index=0;index<144;index++) {
      const heart = document.createElement('span');
      heart.className = 'welcome-petal';
      heart.innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24"><use href="#ui-heart"></use></svg>';
      const dx = (Math.random()-.5)*window.innerWidth*.95;
      const sway = 18+Math.random()*34;
      const values = {
        x:`${x}px`,y:`${y}px`,size:`${8+Math.random()*13}px`,
        duration:`${4.5+Math.random()*2}s`,delay:`${Math.random()*.35}s`,opacity:.35+Math.random()*.55,
        'burst-x':`${dx*.7}px`,'burst-y':`${-70-Math.random()*160}px`,turn:`${(Math.random()-.5)*100}deg`,
        'drift-a':`${dx+sway}px`,'drift-b':`${dx-sway}px`,'end-x':`${dx}px`,fall:`${window.innerHeight-y+60}px`
      };
      for (const [name,value] of Object.entries(values)) heart.style.setProperty(`--petal-${name}`,value);
      petals.append(heart);
    }
    document.body.append(petals);
    setTimeout(() => petals.remove(),7500);
    window.studySettings?.play('maya');
  });
  document.addEventListener('visibilitychange',greet);
  greet();
})();
