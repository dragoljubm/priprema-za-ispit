(() => {
  'use strict';
  const themes = [
    {id:'forest', name:'Šuma', bg:'#0e1915', card:'#1c3027', accent:'#acc3a0'},
    {id:'plum', name:'Šljiva', bg:'#19151e', card:'#2c2433', accent:'#c3acce'},
    {id:'ink', name:'Noć', bg:'#0b1018', card:'#18212e', accent:'#cdbb91'},
    {id:'charcoal', name:'Ugalj', bg:'#191817', card:'#2c2926', accent:'#d8b58b'},
    {id:'rosewood', name:'Bordo', bg:'#21171b', card:'#35262d', accent:'#d2a7af'},
    {id:'moonstone', name:'Mesečina', bg:'#191b24', card:'#2b2e3d', accent:'#bec6da'},
    {id:'cocoa', name:'Med i kakao', bg:'#211b18', card:'#342a24', accent:'#dcbe81'},
    {id:'blueberry', name:'Borovnica', bg:'#1c1930', card:'#2e2944', accent:'#b5abe1'}
  ];
  const defaults = {theme:'forest', sound:true, mayaFrequency:1, mayaFrequencyVersion:2, nightLight:false, nightLightStrength:35};
  let preferences = {...defaults};
  try {
    const saved = JSON.parse(localStorage.getItem('study-buddy-settings-v1') || '{}');
    if (themes.some(t => t.id === saved.theme)) preferences.theme = saved.theme;
    if ([0,1,2].includes(saved.mayaFrequency)) {
      preferences.mayaFrequency = saved.mayaFrequencyVersion === 2 ? saved.mayaFrequency : saved.mayaFrequency === 0 ? 1 : 2;
    }
    if (typeof saved.nightLight === 'boolean') preferences.nightLight = saved.nightLight;
    if (Number.isFinite(saved.nightLightStrength) && saved.nightLightStrength >= 0 && saved.nightLightStrength <= 100) preferences.nightLightStrength = saved.nightLightStrength;
  } catch {}
  function applyTheme() {
    const theme = themes.find(t => t.id === preferences.theme);
    const style = document.documentElement.style;
    for (const [key,value] of Object.entries({bg:theme.bg, surface:theme.card, 'surface-strong':theme.card,
      accent:theme.accent, 'accent-strong':theme.accent, 'accent-soft':theme.card, line:theme.accent+'45',
      text:'#f1e9db', muted:'#bcb6b0'})) style.setProperty('--'+key,value);
    style.setProperty('--night-light-opacity', preferences.nightLight ? String(preferences.nightLightStrength / 100 * .45) : '0');
    document.documentElement.dataset.theme = theme.id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.bg);
  }
  let audio;
  function play(kind='correct') {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      if (kind === 'maya') {
        [[0,720,1100,820,.16],[.14,880,1360,680,.23]].forEach(([offset,low,high,tail,duration]) => {
          const voice = audio.createOscillator();
          const gain = audio.createGain();
          const start = audio.currentTime + offset;
          voice.type = 'sine';
          voice.frequency.setValueAtTime(low,start);
          voice.frequency.exponentialRampToValueAtTime(high,start+.055);
          voice.frequency.exponentialRampToValueAtTime(tail,start+duration);
          gain.gain.setValueAtTime(0,start);
          gain.gain.linearRampToValueAtTime(.026,start+.02);
          gain.gain.exponentialRampToValueAtTime(.001,start+duration);
          voice.connect(gain); gain.connect(audio.destination);
          voice.onended = () => { voice.disconnect(); gain.disconnect(); };
          voice.start(start); voice.stop(start+duration+.025);
        });
        return;
      }
      const notes = kind === 'wrong' ? [220,185] : [523.25,659.25];
      notes.forEach((frequency,index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * .1;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency,start);
        gain.gain.setValueAtTime(0,start);
        gain.gain.linearRampToValueAtTime(.045,start+.015);
        gain.gain.exponentialRampToValueAtTime(.001,start+.18);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start+.2);
      });
    } catch {}
  }
  function update(patch) {
    if (themes.some(t => t.id === patch.theme)) preferences.theme = patch.theme;
    if ([0,1,2].includes(patch.mayaFrequency)) preferences.mayaFrequency = patch.mayaFrequency;
    if (typeof patch.nightLight === 'boolean') preferences.nightLight = patch.nightLight;
    if (Number.isFinite(patch.nightLightStrength) && patch.nightLightStrength >= 0 && patch.nightLightStrength <= 100) preferences.nightLightStrength = patch.nightLightStrength;
    try { localStorage.setItem('study-buddy-settings-v1',JSON.stringify(preferences)); } catch {}
    applyTheme();
    document.dispatchEvent(new CustomEvent('study-settings-change', {detail:patch}));
  }
  window.studySettings = {themes, get:() => ({...preferences}), update, play};
  applyTheme();
})();
