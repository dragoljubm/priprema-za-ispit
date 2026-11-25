(() => {
  'use strict';
  // Keep previous entries and put new messages first. Each ID is permanent.
  const messages = [
    { id: 'video-2026-11-25', date: '2026-11-25', text: 'Imam video za tebe! :3', driveId: '15BOb7xQvoWfrLGSb9U8Tm-WVX0nl7EoE' }
  ];
  const storageKey = message => 'study-buddy-maya:' + message.id;
  function seen(message) {
    try { return localStorage.getItem(storageKey(message)) === 'seen'; } catch { return false; }
  }
  const dialog = document.getElementById('mayaWelcome');
  if (!dialog) return;
  const preview = new URLSearchParams(window.location.search).get('welcome') === 'preview';
  const messageText = document.getElementById('mayaWelcomeMessage');
  const history = document.getElementById('mayaHistory');
  const historyList = document.getElementById('mayaHistoryList');
  const historyButton = document.getElementById('mayaHistoryButton');
  const play = document.getElementById('mayaPlay');
  const close = document.getElementById('mayaClose');
  const video = document.getElementById('mayaVideo');
  const driveLink = document.getElementById('mayaDriveLink');
  const pending = preview ? messages[0] : messages.find(message => !seen(message));
  let current;
  let replaying;
  const arrivalMs=250,textMs=200,readingMs=700;
  dialog.style.setProperty('--tea-arrival',`${arrivalMs}ms`);
  dialog.style.setProperty('--tea-text-time',`${textMs}ms`);
  let shown=false,ready=false,remaining=arrivalMs+textMs+readingMs,deadline=0,unlockTimer;
  function arm() {
    deadline=performance.now()+remaining;
    unlockTimer=setTimeout(()=>{
      ready=true;
      dialog.dataset.ready='true';
      play.disabled = close.disabled = false;
      try { if (!preview) localStorage.setItem(storageKey(current), 'seen'); } catch {}
      document.removeEventListener('visibilitychange',visibility);
    },remaining);
  }
  function greet() {
    if (shown || !pending || document.hidden) return;
    shown = true;
    openMessage(pending, false);
  }

  function openMessage(message, replay) {
    current = message;
    replaying = replay;
    messageText.textContent = message.text;
    play.hidden = !message.driveId;
    if (message.driveId) driveLink.href = 'https://drive.google.com/file/d/' + message.driveId + '/view';
    ready = false;
    remaining = arrivalMs + textMs + readingMs;
    play.disabled = close.disabled = true;
    dialog.dataset.ready = 'false';
    dialog.showModal();
    document.addEventListener('visibilitychange', visibility);
    arm();
  }

  function dismiss() {
    if (!dialog.open || !ready) return;
    const rect = dialog.getBoundingClientRect();
    const x = rect.left + rect.width/2, y = rect.top + rect.height/2;
    dialog.close();
    video.querySelector('.maya-player')?.remove();
    video.hidden = true;
    if (replaying) history.showModal();
    const petals = document.createElement('div');
    petals.className = 'welcome-petals';
    petals.setAttribute('aria-hidden','true');
    for (let index=0;index<144;index++) {
      const heart = document.createElement('span');
      heart.className = 'welcome-petal';
      heart.innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24"><use href="#ui-heart"></use></svg>';
      const dx = (Math.random()-.5)*window.innerWidth*.95;
      const sway = 18+Math.random()*34;
      const fall = (window.innerHeight - y + 60) * (.4 + Math.random() * .6);
      const values = {
        x:`${x}px`,y:`${y}px`,size:`${8+Math.random()*13}px`,
        duration:`${4.5+Math.random()*2}s`,delay:`${Math.random()*.35}s`,opacity:.35+Math.random()*.55,
        'burst-x':`${dx*.7}px`,'burst-y':`${-70-Math.random()*160}px`,turn:`${(Math.random()-.5)*100}deg`,
        'drift-a':`${dx+sway}px`,'drift-b':`${dx-sway}px`,'end-x':`${dx}px`,fall:`${fall}px`
      };
      for (const [name,value] of Object.entries(values)) heart.style.setProperty(`--petal-${name}`,value);
      petals.append(heart);
    }
    document.body.append(petals);
    setTimeout(() => petals.remove(),7500);
    window.studySettings?.play('maya');
  }
  function visibility() {
    if(!shown){greet();return;}
    if(!dialog.open || ready)return;
    if(document.hidden) {
      remaining=Math.max(0,deadline-performance.now());
      clearTimeout(unlockTimer);
      dialog.classList.add('welcome-paused');
    } else {
      dialog.classList.remove('welcome-paused');
      arm();
    }
  }
  window.studyWelcome={dismiss};
  const dateFormat = new Intl.DateTimeFormat('sr-Latn', { dateStyle: 'medium', timeZone: 'UTC' });
  for (const message of messages) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = message.text;
    const date = document.createElement('time');
    date.dateTime = message.date;
    date.textContent = dateFormat.format(new Date(message.date));
    button.append(date);
    button.addEventListener('click', () => {
      history.close();
      openMessage(message, true);
    });
    item.append(button);
    historyList.append(item);
  }
  historyButton.addEventListener('click', () => history.showModal());
  close.addEventListener('click', dismiss);
  dialog.addEventListener('click', event => { if (event.target === dialog) dismiss(); });
  play.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.title = 'Video sa Google Drive-a';
    frame.allowFullscreen = true;
    frame.src = 'https://drive.google.com/file/d/' + current.driveId + '/preview';
    const player = document.createElement('div');
    player.className = 'maya-player';
    player.append(frame);
    video.prepend(player);
    video.hidden = false;
    frame.focus();
    play.hidden = true;
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  if (pending) document.addEventListener('visibilitychange',visibility);
  greet();
})();
