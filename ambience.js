(() => {
  'use strict';
  const STORAGE_KEY = 'study-buddy-ambience-v1';
  const sounds = [
    {id:'lofi-piano', name:'Lo-fi klavir', src:'./assets/audio/lofi-piano.mp3'},
    {id:'lofi-dream', name:'Lo-fi sanjarenje', src:'./assets/audio/lofi-dream.mp3'},
    {id:'white', name:'White noise', src:'./assets/audio/white-noise.mp3'},
    {id:'cafe', name:'Žamor kafića', src:'./assets/audio/coffee-shop.mp3'},
    {id:'train', name:'Voz', src:'./assets/audio/train.mp3'},
    {id:'city', name:'Grad / prevoz', src:'./assets/audio/city.mp3'},
    {id:'fireplace', name:'Kamin', src:'./assets/audio/fireplace.mp3'},
    {id:'rain', name:'Kiša', src:'./assets/audio/rain.mp3'},
    {id:'stream', name:'Potok', src:'./assets/audio/stream.mp3'},
    {id:'night', name:'Noć', src:'./assets/audio/summer-night.mp3'},
    {id:'wind', name:'Vetar', src:'./assets/audio/wind.mp3'}
  ];
  const presets = [
    {id:'library', name:'Biblioteka', levels:{fireplace:24,cafe:8,white:3}},
    {id:'cave', name:'Skrivena pećina', levels:{stream:24,wind:7}},
    {id:'rainy', name:'Kišna noć', levels:{rain:28,night:8,wind:3}},
    {id:'forest', name:'Šumski mir', levels:{night:20,stream:9,wind:6}},
    {id:'hearth', name:'Uz ognjište', levels:{fireplace:34,wind:4}},
    {id:'spring', name:'Prolećna kiša', levels:{rain:22,stream:6,wind:4}},
    {id:'whisper', name:'Šapat šume', levels:{wind:14,night:11}},
    {id:'source', name:'Pećinski izvor', levels:{stream:28,wind:3}},
    {id:'study', name:'Kasno učenje', levels:{white:12,cafe:7,night:4}},
    {id:'quiet', name:'Tiha noć', levels:{night:9,wind:3}},
    {id:'cafe-study', name:'Kafić za učenje', levels:{cafe:28,city:5,white:3}},
    {id:'night-train', name:'Noćni voz', levels:{train:25,rain:6,white:3}},
    {id:'commute', name:'Na putu', levels:{train:22,city:8}},
    {id:'city-morning', name:'Gradsko jutro', levels:{city:20,cafe:12}},
    {id:'white-focus', name:'Čist fokus', levels:{white:18}},
    {id:'rain-cafe', name:'Kiša u kafiću', levels:{cafe:24,rain:12}},
    {id:'lofi-study', name:'Lo-fi za učenje', levels:{'lofi-piano':26,white:3}},
    {id:'lofi-dreaming', name:'Lo-fi sanjarenje', levels:{'lofi-dream':24,night:5}},
    {id:'lofi-cafe', name:'Lo-fi kafić', levels:{'lofi-piano':22,cafe:12}},
    {id:'lofi-rain', name:'Lo-fi uz kišu', levels:{'lofi-dream':22,rain:12}},
    {id:'lofi-train', name:'Lo-fi putovanje', levels:{'lofi-piano':20,train:12}},
    {id:'lofi-night', name:'Lo-fi pred spavanje', levels:{'lofi-dream':16,night:6,white:3}}
  ];
  for (const preset of presets) for (const sound of sounds) if (!(sound.id in preset.levels)) preset.levels[sound.id] = 0;
  let levels = {...presets[0].levels};
  let mode = 'preset';
  let presetId = 'library';
  let customLevels = {...levels};
  let remembered = Object.fromEntries(sounds.map(sound => [sound.id,levels[sound.id] || 25]));
  const validLevel = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const sound of sounds) {
      if (validLevel(saved.levels?.[sound.id])) { levels[sound.id] = saved.levels[sound.id]; if (levels[sound.id] > 0) remembered[sound.id] = levels[sound.id]; }
      if (validLevel(saved.remembered?.[sound.id]) && saved.remembered[sound.id] > 0) remembered[sound.id] = saved.remembered[sound.id];
    }
    const matching = presets.find(preset => sounds.every(sound => preset.levels[sound.id] === levels[sound.id]));
    mode = ['preset','custom'].includes(saved.mode) ? saved.mode : matching ? 'preset' : 'custom';
    presetId = presets.some(preset => preset.id === saved.presetId) ? saved.presetId : matching?.id || 'library';
    customLevels = {...levels};
    for (const sound of sounds) if (validLevel(saved.customLevels?.[sound.id])) customLevels[sound.id] = saved.customLevels[sound.id];
    if (mode === 'preset') levels = {...presets.find(preset => preset.id === presetId).levels};
    else levels = {...customLevels};
  } catch {}
  let running = false;
  let loading = false;
  let error = '';
  let context;
  let master;
  let generation = 0;
  const buffers = new Map();
  const sources = new Map();
  const pending = new Map();
  function selectedPreset() {
    return mode === 'preset' ? presetId : 'custom';
  }
  function get() { return {levels:{...levels},preset:selectedPreset(),mode,running,loading,error}; }
  function emit() { document.dispatchEvent(new CustomEvent('ambience-change')); }
  function save() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify({levels,remembered,mode,presetId,customLevels})); } catch {}
  }
  function release(id) {
    const entry = sources.get(id);
    if (!entry) return;
    sources.delete(id);
    const now = context.currentTime;
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setTargetAtTime(0,now,.08);
    entry.source.onended = () => {entry.source.disconnect();entry.gain.disconnect();};
    entry.source.stop(now+.4);
  }
  function stop() {
    generation++;
    running = false; loading = false;
    for (const id of [...sources.keys()]) release(id);
    emit();
  }
  function load(sound) {
    if (buffers.has(sound.id)) return Promise.resolve(buffers.get(sound.id));
    if (!pending.has(sound.id)) {
      const task = fetch(sound.src).then(response => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).then(buffer => {
        buffers.set(sound.id,buffer); return buffer;
      }).finally(() => pending.delete(sound.id));
      pending.set(sound.id,task);
    }
    return pending.get(sound.id);
  }
  async function reconcile() {
    if (!running) return;
    const current = ++generation;
    const enabled = sounds.filter(sound => levels[sound.id] > 0);
    for (const id of [...sources.keys()]) {
      if (levels[id] === 0) release(id);
      else sources.get(id).gain.gain.setTargetAtTime(levels[id]/100,context.currentTime,.12);
    }
    loading = enabled.some(sound => !buffers.has(sound.id));
    emit();
    try {
      await Promise.all(enabled.map(load));
      if (current !== generation || !running) return;
      for (const sound of enabled) {
        if (sources.has(sound.id)) continue;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffers.get(sound.id);
        source.loop = true;
        gain.gain.setValueAtTime(0,context.currentTime);
        gain.gain.setTargetAtTime(levels[sound.id]/100,context.currentTime,.18);
        source.connect(gain); gain.connect(master);
        source.start();
        sources.set(sound.id,{source,gain});
      }
      loading = false; emit();
    } catch (cause) {
      if (current !== generation) return;
      stop();
      error = 'Zvuk nije učitan. Pokušaj ponovo.';
      emit();
    }
  }
  async function start() {
    if (running) return;
    error = '';
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      if (!context) {
        context = new Audio(); master = context.createGain();
        master.gain.value = .5; master.connect(context.destination);
      }
      running = true;
      const current = ++generation;
      emit();
      await context.resume();
      if (current !== generation || !running) return;
      if (context.state !== 'running') throw new Error('Playback blocked');
      await reconcile();
    } catch (cause) {
      stop(); error = 'Zvuk nije pokrenut. Pokušaj ponovo.'; emit();
    }
  }
  function setLevel(id,value) {
    if (!sounds.some(sound => sound.id === id) || !validLevel(value)) return;
    mode = 'custom';
    levels[id] = Math.round(value);
    customLevels = {...levels};
    if (value > 0) remembered[id] = levels[id];
    error = ''; save(); emit();
    if (running) void reconcile();
  }
  function toggleLayer(id) {
    if (!sounds.some(sound => sound.id === id)) return;
    setLevel(id,levels[id] > 0 ? 0 : remembered[id]);
  }
  function setPreset(id) {
    const preset = presets.find(candidate => candidate.id === id);
    if (!preset) return;
    mode = 'preset'; presetId = preset.id;
    levels = {...preset.levels};
    for (const sound of sounds) if (levels[sound.id] > 0) remembered[sound.id] = levels[sound.id];
    error = ''; save(); emit();
    if (running) void reconcile();
  }
  function setMode(nextMode) {
    if (nextMode === 'preset') return setPreset(presetId);
    if (nextMode !== 'custom') return;
    mode = 'custom'; levels = {...customLevels}; error = '';
    for (const sound of sounds) if (levels[sound.id] > 0) remembered[sound.id] = levels[sound.id];
    save(); emit();
    if (running) void reconcile();
  }
  window.studyAmbience = {sounds,presets,get,start,stop,setLevel,toggleLayer,setPreset,setMode};
  window.addEventListener('pagehide',stop);
})();
