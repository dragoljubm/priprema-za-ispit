(() => {
  'use strict';
  const key = 'study-buddy-maya-welcome-v1';
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
  dialog.querySelector('button').addEventListener('click',() => dialog.close());
  dialog.addEventListener('click',event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener('visibilitychange',greet);
  greet();
})();
