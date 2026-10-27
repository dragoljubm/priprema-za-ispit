(() => {
  'use strict';

  const STORAGE_KEY = 'study-buddy-history-v1';
  const app = document.getElementById('app');
  const bottomNav = document.getElementById('bottomNav');
  const backButton = document.getElementById('backButton');
  const subtitle = document.getElementById('headerSubtitle');
  const toastEl = document.getElementById('toast');
  const exitDialog = document.getElementById('exitDialog');
  const mixPreview = document.getElementById('mixPreview');
  let previewTrigger = null;
  let dismissedPreviewTrigger = null;

  let data = { subjects: [] };
  let route = 'home';
  let activeSession = null;
  let lastResult = null;
  let detailSessionId = null;
  let detailReturnRoute = 'history';
  let mistakesOnly = false;
  const settingsPanelsOpen = new Set();
  const mayaLabels = ['Nikad :(','Ponekad','Često'];

  function uiIcon(name, extraClass = '') {
    return `<svg class="ui-icon ${extraClass}" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="#ui-${name}"></use></svg>`;
  }

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function displaySubjectName(name) {
    return String(name || '').replace(/\s*[—–-]\s*fizioterapija\s*$/iu, '');
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const historyStatuses = new Set(['correct','wrong','unanswered','neutral']);
  const historyModes = new Set(['mixed','recall','choice','simulation']);
  const textValue = value => typeof value === 'string' ? value : '';
  const countValue = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;

  function normalizeReview(question, index, defaultStatus = 'unanswered') {
    if (!question || typeof question !== 'object' || Array.isArray(question)) return null;
    const normalized = {
      questionId:textValue(question.questionId),number:Math.max(1,countValue(question.number,index+1)),
      question:textValue(question.question),subjectName:textValue(question.subjectName),
      status:historyStatuses.has(question.status) ? question.status : defaultStatus,
      yourAnswer:typeof question.yourAnswer === 'string' ? question.yourAnswer : null,
      correctAnswer:textValue(question.correctAnswer),selfAssessed:question.selfAssessed === true,seen:question.seen === true,
      yourAnswerLetter:letters.includes(question.yourAnswerLetter) ? question.yourAnswerLetter : null,
      correctAnswerLetter:letters.includes(question.correctAnswerLetter) ? question.correctAnswerLetter : null
    };
    if (Array.isArray(question.answers) && question.answers.every(answer => typeof answer === 'string')) {
      normalized.answers = question.answers;
      const validIndex = value => Number.isInteger(value) && value >= 0 && value < question.answers.length;
      normalized.selectedAnswerIndex = validIndex(question.selectedAnswerIndex) ? question.selectedAnswerIndex : null;
      normalized.correctAnswerIndex = validIndex(question.correctAnswerIndex) ? question.correctAnswerIndex : null;
    }
    return normalized;
  }

  function loadHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(history)) return [];
      return history.filter(record => record && typeof record === 'object' && typeof record.id === 'string' && record.id)
        .slice(0,250).map(record => {
          const answered = countValue(record.answered);
          const correct = Math.min(countValue(record.correct),answered);
          return {
            id:record.id,subjectId:textValue(record.subjectId),subjectName:textValue(record.subjectName),
            startedAt:textValue(record.startedAt),endedAt:textValue(record.endedAt),completed:record.completed === true,
            mode:historyModes.has(record.mode) ? record.mode : 'mixed',answered,correct,
            totalQuestions:countValue(record.totalQuestions),accuracy:answered ? Math.round(correct/answered*100) : 0,
            mistakes:Array.isArray(record.mistakes) ? record.mistakes.map((question,index) => normalizeReview(question,index,'wrong')).filter(Boolean) : [],
            ...(Array.isArray(record.questions) ? {questions:record.questions.map((question,index) => normalizeReview(question,index)).filter(Boolean)} : {})
          };
        });
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toastEl.classList.remove('show'), 1700);
  }

  function vibrate(pattern = 18) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  const appRoutes = new Set(['home','history','settings','quiz','result','session-detail']);
  let navigation;

  function applyNavigation(state) {
    let nextRoute = appRoutes.has(state.route) ? state.route : 'home';
    if (nextRoute === 'quiz' && !activeSession) nextRoute = 'home';
    if (nextRoute === 'result' && lastResult?.id !== state.resultId) lastResult = loadHistory().find(record => record.id === state.resultId) || null;
    if (nextRoute === 'result' && !lastResult) nextRoute = 'home';
    if (nextRoute !== state.route) {
      navigation.navigate({...state,route:nextRoute},{replace:true});
      return;
    }
    closeMixPreview();
    if (nextRoute === 'session-detail' && route !== nextRoute) mistakesOnly = false;
    route = nextRoute;
    detailSessionId = typeof state.detailSessionId === 'string' ? state.detailSessionId : null;
    detailReturnRoute = state.detailReturnRoute === 'result' ? 'result' : 'history';
    render();
    window.scrollTo({top:Number.isFinite(state.scrollY) ? Math.max(0,state.scrollY) : 0,behavior:'instant'});
  }

  function setRoute(nextRoute, options = {}) {
    if (!appRoutes.has(nextRoute)) return;
    if (options.detailSessionId !== undefined) detailSessionId = options.detailSessionId;
    navigation.navigate({route:nextRoute,detailSessionId,detailReturnRoute,resultId:lastResult?.id || null,scrollY:0},
      {replace:options.replace === true,root:nextRoute === 'home'});
  }

  function setChrome({ nav = true, back = false, subtitleText = '' } = {}) {
    bottomNav.classList.toggle('hidden', !nav);
    backButton.classList.toggle('hidden', !back);
    document.getElementById('headerBears').classList.toggle('hidden', back);
    subtitle.textContent = displaySubjectName(subtitleText);
    subtitle.classList.toggle('hidden', !subtitleText);

    document.querySelectorAll('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.route === route);
    });
  }

  function renderHome() {
    setChrome({ nav: true, back: false });
    const formats = [
      {id:'all',label:'Sva pitanja'},
      {id:'recall',label:'Pitanja bez ponuđenih odgovora'},
      {id:'choice',label:'Pitanja sa ponuđenim odgovorima'}
    ];
    const groups = [{id:'all',name:'Oba predmeta',questions:data.subjects.flatMap(subject => subject.questions)},...data.subjects];
    const subjectCards = groups.map(subject => `<section class="subject-group ${subject.id === 'all' ? 'combined-group' : ''}" data-subject-group="${escapeHtml(subject.id)}" aria-label="${escapeHtml(subject.name)}">
      <div class="subject-group-header"><span class="subject-bubble" aria-hidden="true"></span><h2>${escapeHtml(subject.name)}</h2></div>
      <div class="subject-options">${formats.map(format => `<button class="subject-option" data-subject-id="${escapeHtml(subject.id)}" data-question-type="${format.id}" type="button" ${format.id !== 'all' && !subject.questions.some(question => question.type === format.id) ? 'disabled' : ''}><span>${format.label}</span>${uiIcon('chevron-right')}</button>`).join('')}</div>
    </section>`).join('');

    app.innerHTML = `
      <div class="library-scene">
        <img src="./assets/library-candles.webp" width="1536" height="1024" alt="Bubu i Dudu čitaju u skrivenoj biblioteci među kristalima." fetchpriority="high" />
        <span class="lamplight" aria-hidden="true"></span>
        <span class="candlelight" aria-hidden="true"></span>
        <span class="dust" aria-hidden="true"></span>
        <span class="scene-embers" aria-hidden="true"></span>
        <span class="crystal-shimmer" aria-hidden="true"></span>
        <div class="scene-cat-spot cat-spot" data-cat-spot></div>
      </div>
      <div class="section-heading"><h1 class="screen-title">Testovi</h1></div>
      <button class="subject-card simulation-card" id="simulationButton" type="button">
        <span class="subject-bubble" aria-hidden="true"></span><div class="subject-copy"><div class="subject-name">Simulacija ispita</div></div><div class="chevron">${uiIcon('chevron-right')}</div>
      </button>
      <div class="subject-groups">${subjectCards}</div>

    `;

    document.getElementById('simulationButton').addEventListener('click', startSimulation);
    app.querySelectorAll('[data-subject-id]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.questionType === 'recall') startRecallSession(button.dataset.subjectId);
        else if (button.dataset.questionType === 'choice') startChoiceSession(button.dataset.subjectId);
        else if (button.dataset.subjectId === 'all') startCombinedSession();
        else startSession(button.dataset.subjectId);
      });
    });
  }

  function startSimulation() {
    const professional = data.subjects.find(s => s.id === 'strucni');
    const legal = data.subjects.find(s => s.id === 'pravni');
    if (!professional || !legal || professional.questions.length < 8 || legal.questions.length < 7) return;
    const questions = [...shuffle(professional.questions).slice(0, 8).map(q => ({...q, subjectName: professional.name})),
      ...shuffle(legal.questions).slice(0, 7).map(q => ({...q, subjectName: legal.name}))];
    startSession('simulation', {id: 'simulation', name: 'Simulacija ispita', questions});
  }

  function startCombinedSession() {
    const questions = data.subjects.flatMap(subject => subject.questions.map(question => ({...question,subjectName:subject.name})));
    startSession('all',{id:'all',name:'Oba predmeta',questions,mode:'mixed'});
  }

  function startRecallSession(scope = 'all') {
    startFilteredSession(scope,'recall');
  }

  function startChoiceSession(scope) {
    startFilteredSession(scope,'choice');
  }

  function startFilteredSession(scope, type) {
    if (!['recall','choice'].includes(type)) return;
    const subjects = scope === 'all' ? data.subjects : data.subjects.filter(subject => subject.id === scope);
    const questions = subjects.flatMap(subject => subject.questions.filter(question => question.type === type)
      .map(question => ({...question,subjectName:subject.name})));
    if (!questions.length) return;
    const label = scope === 'all' ? 'Oba predmeta' : subjects[0].name;
    const format = type === 'recall' ? 'Bez ponuđenih odgovora' : 'Sa ponuđenim odgovorima';
    startSession(`${type}-${scope}`,{id:`${type}-${scope}`,name:`${format} · ${label}`,questions,mode:type});
  }

  function startSession(subjectId, sessionOptions = null) {
    const subject = sessionOptions || data.subjects.find((item) => item.id === subjectId);
    if (!subject || subject.questions.length === 0) return;

    activeSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      subjectId: subject.id,
      subjectName: subject.name,
      questions: shuffle(subject.questions),
      mode: sessionOptions?.mode || (sessionOptions ? 'simulation' : 'mixed'),
      revealed: false,
      finalized: false,
      index: 0,
      answered: 0,
      correct: 0,
      selected: null,
      locked: false,
      mistakes: [],
      responses: [],
      startedAt: new Date().toISOString()
    };
    lastResult = null;
    setRoute('quiz');
  }

  function recallAnswer(question, session) {
    return `
      <div class="recall-answer ${session.revealed ? 'is-revealed' : ''}">
        <div class="revealed-answer" tabindex="0" role="region" aria-label="Tačan odgovor" ${session.revealed ? '' : 'aria-hidden="true" inert'}>${escapeHtml(question.answer)}</div>
        ${session.revealed ? '' : '<button class="secondary-button" id="revealButton" type="button">Prikaži odgovor</button>'}
      </div>
      <div class="self-rating ${session.revealed ? '' : 'rating-pending'}" role="group" aria-label="Samoprocena" ${session.revealed ? '' : 'aria-hidden="true" inert'}>
        <button class="rating-button rating-wrong ${session.selected === false ? 'selected' : ''}" id="rateWrong" type="button" aria-pressed="${session.selected === false}" ${session.locked || !session.revealed ? 'disabled' : ''}>Nisam znala</button>
        <button class="rating-button rating-right ${session.selected === true ? 'selected' : ''}" id="rateRight" type="button" aria-pressed="${session.selected === true}" ${session.locked || !session.revealed ? 'disabled' : ''}>Znala sam</button>
      </div>`;
  }

  function revealAnswer() {
    const s = activeSession;
    if (!s || s.questions[s.index].type !== 'recall' || s.revealed) return;
    s.revealed = true;
    renderQuiz(true);
  }

  function rateAnswer(correct) {
    const s = activeSession;
    if (!s || !s.revealed || s.locked || typeof correct !== 'boolean') return;
    const q = s.questions[s.index];
    if (q.type !== 'recall') return;
    s.selected = s.selected === correct ? null : correct;
    renderQuiz(true);
  }

  function finalizeQuestion() {
    const s = activeSession;
    if (s.finalized) return;
    const q = s.questions[s.index];
    const right = q.type === 'recall' ? s.selected === true : s.selected === q.correctAnswer;
    s.responses.push(questionSnapshot(q, s.index, s.locked ? (right ? 'correct' : 'wrong') : 'unanswered',
      s.locked ? (q.type === 'recall' ? (s.selected ? 'Znala sam' : 'Nisam znala') : q.answers[s.selected]) : null,
      s.locked && q.type === 'choice' ? s.selected : null));
    s.finalized = true;
  }

  function questionSnapshot(question, index, status, yourAnswer = null, selectedIndex = null) {
    return {questionId:question.id, number:index+1, question:question.question,
      subjectName:question.subjectName || '', status, yourAnswer,
      correctAnswer:question.type === 'recall' ? question.answer : question.answers[question.correctAnswer],
      selfAssessed:question.type === 'recall', seen:true,
      ...(question.type === 'choice' ? {answers:[...question.answers],selectedAnswerIndex:selectedIndex,correctAnswerIndex:question.correctAnswer,yourAnswerLetter:selectedIndex === null ? null : letters[selectedIndex],correctAnswerLetter:letters[question.correctAnswer]} : {})};
  }

  function renderQuiz(preservePosition = false) {
    const scrollTop = window.scrollY || 0;
    const focused = document.activeElement;
    const focusSelector = focused?.id === 'revealButton' ? '.revealed-answer'
      : focused?.id === 'confirmButton' ? '#nextButton'
      : focused?.id ? `#${focused.id}`
      : focused?.dataset?.answerIndex !== undefined ? `[data-answer-index="${focused.dataset.answerIndex}"]` : null;
    if (!activeSession) return setRoute('home');
    setChrome({ nav: false, back: true, subtitleText: activeSession.subjectName });

    const s = activeSession;
    const question = s.questions[s.index];
    const accuracy = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
    const progress = ((s.index + (s.locked ? 1 : 0)) / s.questions.length) * 100;

    const answerButtons = (question.answers || []).map((answer, index) => {
      let state = !s.locked && index === s.selected ? 'selected' : '';
      if (s.locked && index === question.correctAnswer) state = 'correct';
      else if (s.locked && index === s.selected && s.selected !== question.correctAnswer) state = 'wrong';
      return `
        <button class="answer ${state}" data-answer-index="${index}" aria-pressed="${index === s.selected}" type="button" ${s.locked ? 'disabled' : ''}>
          <span class="answer-letter">${state === 'correct' ? uiIcon('check') : state === 'wrong' ? uiIcon('close') : letters[index] || index + 1}</span>
          <span class="answer-text">${escapeHtml(answer)}</span>
        </button>
      `;
    }).join('');

    let feedback = '<span></span>';
    if (s.locked && question.type === 'choice') {
      const right = s.selected === question.correctAnswer;
      feedback = `<div class="answer-feedback ${right ? 'good' : 'bad'}"><span class="feedback-symbol">${uiIcon(right ? 'check' : 'close')}</span><strong>${right ? 'Tačno' : 'Netačno'}</strong></div>`;
    } else if (!s.locked && s.selected === null) {
      feedback = `<p class="answer-requirement" id="answerRequirement">${question.type === 'choice' ? 'Izaberi odgovor.' : s.revealed ? 'Izaberi samoprocenu.' : 'Prikaži odgovor.'}</p>`;
    }

    app.innerHTML = `
      <div class="quiz-head">
        <div>
          <div class="quiz-subject">${escapeHtml(question.subjectName || s.subjectName)}</div>
        </div>
        <div class="counter-pill">${s.index + 1} / ${s.questions.length}</div>
      </div>

      <div class="progress-track" aria-hidden="true"><div class="progress-bar" style="width:${progress}%"></div></div>

      <section class="question-card">
        <div class="question-number">PITANJE ${s.index + 1}</div>
        <h1 class="question-text">${escapeHtml(question.question)}</h1>
        <div class="answers">${question.type === 'recall' ? recallAnswer(question, s) : answerButtons}</div>
        <div class="feedback">
          <div class="feedback-status" role="status">${feedback}</div>
          ${!s.locked && s.selected !== null ? '<button class="primary-button full" id="confirmButton" type="button">Potvrdi odgovor</button>' : ''}
          ${s.locked || s.selected === null ? `<button class="primary-button full" id="nextButton" type="button" ${s.locked ? '' : 'disabled aria-describedby="answerRequirement"'}><span>${s.index === s.questions.length - 1 ? 'Završi test' : 'Sledeće pitanje'}</span>${uiIcon(s.locked ? 'arrow-right' : 'lock')}</button>` : ''}
        </div>
      </section>

      <section class="session-footer">
        <div class="accuracy-row">
          <div>
            <div class="accuracy-label">Tačnost</div>
            <div class="accuracy-value">${s.correct} / ${s.answered} · ${s.answered ? accuracy + '%' : '—'}</div>
          </div>
        </div>
        <button class="danger-button full" id="endSessionButton" type="button">Završi test</button>
      </section>
    `;

    if (!s.locked) {
      app.querySelectorAll('[data-answer-index]').forEach((button) => {
        button.addEventListener('click', () => answerQuestion(Number(button.dataset.answerIndex)));
      });
    }
    document.getElementById('revealButton')?.addEventListener('click', revealAnswer);
    document.getElementById('rateRight')?.addEventListener('click', () => rateAnswer(true));
    document.getElementById('rateWrong')?.addEventListener('click', () => rateAnswer(false));
    document.getElementById('confirmButton')?.addEventListener('click', confirmAnswer);
    document.getElementById('nextButton')?.addEventListener('click', nextQuestion);
    document.getElementById('endSessionButton').addEventListener('click', requestSessionExit);
    if (preservePosition) {
      if (focusSelector) app.querySelector?.(focusSelector)?.focus({preventScroll:true});
      window.scrollTo({top:scrollTop,behavior:'instant'});
    }

  }

  function answerQuestion(index) {
    const s = activeSession;
    if (!s || s.locked) return;
    const q = s.questions[s.index];
    if (q.type !== 'choice' || !Number.isInteger(index) || index < 0 || index >= q.answers.length) return;
    s.selected = index;
    renderQuiz(true);
  }

  function confirmAnswer() {
    const s = activeSession;
    if (!s || s.locked || s.selected === null) return;
    const q = s.questions[s.index];
    if (q.type === 'recall' && !s.revealed) return;
    s.locked = true;
    s.answered++;
    const right = q.type === 'recall' ? s.selected : s.selected === q.correctAnswer;
    window.studySettings?.play(right ? 'correct' : 'wrong');
    if (right) { s.correct++; vibrate(15); }
    else {
      s.mistakes.push({questionId: q.id, question: q.question,
        yourAnswer: q.type === 'recall' ? 'Nisam znala' : q.answers[s.selected],
        correctAnswer: q.type === 'recall' ? q.answer : q.answers[q.correctAnswer],
        ...(q.type === 'recall' ? {selfAssessed: true} : {})});
      vibrate([20, 35, 20]);
    }
    renderQuiz(true);
  }

  function nextQuestion() {
    const s = activeSession;
    if (!s || !s.locked) return;
    finalizeQuestion();
    if (s.index >= s.questions.length - 1) return finishSession(true);
    s.index += 1;
    s.selected = null;
    s.locked = false;
    s.revealed = false;
    s.finalized = false;
    renderQuiz();
  }

  function finishSession(completed) {
    const s = activeSession;
    if (!s) return;

    finalizeQuestion();
    const record = {
      id: s.id,
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      startedAt: s.startedAt,
      endedAt: new Date().toISOString(),
      completed: Boolean(completed),
      mode: s.mode,
      answered: s.answered,
      correct: s.correct,
      totalQuestions: s.questions.length,
      accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : 0,
      mistakes: s.mistakes,
      questions: s.responses
    };

    const history = loadHistory();
    history.unshift(record);
    try { saveHistory(history.slice(0, 250)); }
    catch { showToast('Rezultat nije sačuvan. Skladište uređaja nije dostupno.'); }
    lastResult = record;
    activeSession = null;
    setRoute('result',{replace:true});
  }

  function renderResult() {
    if (!lastResult) return setRoute('home');
    setChrome({ nav: false, back: false, subtitleText: 'Rezultat vežbanja' });
    const r = lastResult;

    app.innerHTML = `
      <section class="result-card">
        <img class="result-bears" src="./assets/bears.webp" alt="" width="120" height="98" />
        <div class="eyebrow">${r.completed ? 'Vežbanje završeno' : 'Vežbanje prekinuto'}</div>
        <h1>${escapeHtml(r.subjectName)}</h1>
        <div class="big-score">${r.answered ? r.accuracy + '%' : '—'}</div>
        <div class="score-sub">${r.correct} / ${r.answered} tačno</div>

        <div class="stats-grid">
          <div class="stat"><div class="stat-value">${r.correct}</div><div class="stat-label">Tačno</div></div>
          <div class="stat"><div class="stat-value">${r.mistakes.length}</div><div class="stat-label">Netačno</div></div>
        </div>

        <div class="result-actions">
          <button class="secondary-button full" id="reviewMistakesButton" type="button">Pregled pitanja</button>
          <button class="primary-button full" id="closeResultButton" type="button">Nazad na početak</button>
        </div>
      </section>
    `;

    document.getElementById('reviewMistakesButton')?.addEventListener('click', () => {
      detailSessionId = r.id;
      detailReturnRoute = 'result';
      setRoute('session-detail');
    });
    document.getElementById('closeResultButton').addEventListener('click', () => setRoute('home'));
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('sr-Latn-RS', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  function renderHistory() {
    setChrome({ nav: true, back: false, subtitleText: 'Sačuvani rezultati' });
    const history = loadHistory();

    if (!history.length) {
      app.innerHTML = `
      <div class="section-heading"><h2>Istorija</h2><span>0 vežbanja</span></div>
        <section class="empty-state">
          <h2>Nema sačuvanih rezultata</h2>
        </section>
      `;
      return;
    }

    app.innerHTML = `
      <div class="section-heading"><h2>Istorija</h2><span>${history.length} vežbanja</span></div>
      <section class="history-list">
        ${history.map((item) => `
          <article class="history-card" data-session-id="${escapeHtml(item.id)}" tabindex="0" role="button">
            <div class="history-top">
              <div>
                <div class="history-subject">${escapeHtml(displaySubjectName(item.subjectName))}</div>
                <div class="history-date">${escapeHtml(formatDate(item.endedAt))}</div>
              </div>
              <div class="history-score">${item.answered ? item.accuracy + '%' : '—'}</div>
            </div>
            <div class="history-bottom">
              <span>${item.correct}/${item.answered} tačno</span>
              <span class="history-link">Pregled pitanja ${uiIcon('chevron-right')}</span>
            </div>
          </article>
        `).join('')}
      </section>
    `;

    app.querySelectorAll('[data-session-id]').forEach((card) => {
      const open = () => {
        detailSessionId = card.dataset.sessionId;
        detailReturnRoute = 'history';
        setRoute('session-detail');
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function reviewAnswers(question) {
    if (question.selfAssessed) {
      return `<div class="answer-review">${question.yourAnswer != null ? `<div class="review-row ${question.status === 'wrong' ? 'yours' : 'given'}"><strong>Samoprocena:</strong> ${escapeHtml(question.yourAnswer)}</div>` : ''}<div class="review-row correct"><strong>Tačan odgovor:</strong> ${escapeHtml(question.correctAnswer)}</div></div>`;
    }
    const source = Array.isArray(question.answers) ? null : data.subjects.flatMap(subject => subject.questions).find(item => item.type === 'choice'
      && item.id === question.questionId && item.question === question.question
      && item.answers[item.correctAnswer] === question.correctAnswer);
    const options = Array.isArray(question.answers) ? question.answers : source?.answers;
    if (options?.length) {
      const correct = Number.isInteger(question.correctAnswerIndex) ? question.correctAnswerIndex
        : question.correctAnswerLetter ? letters.indexOf(question.correctAnswerLetter)
        : source?.correctAnswer ?? options.indexOf(question.correctAnswer);
      const selected = Number.isInteger(question.selectedAnswerIndex) ? question.selectedAnswerIndex
        : question.status === 'correct' ? correct
        : question.yourAnswerLetter ? letters.indexOf(question.yourAnswerLetter)
        : question.yourAnswer != null ? options.indexOf(question.yourAnswer) : -1;
      return `<ol class="review-options" aria-label="Ponuđeni odgovori">${options.map((answer,index) => {
        const right = index === correct;
        const chosen = index === selected;
        const label = right && chosen ? 'Tvoj odgovor · tačno' : right ? 'Tačan odgovor' : chosen ? 'Tvoj odgovor' : '';
        return `<li class="review-option ${right ? 'option-correct' : chosen ? 'option-wrong' : ''}"><span class="review-option-letter">${escapeHtml(letters[index] || index+1)}</span><div class="review-option-copy"><div>${escapeHtml(answer)}</div>${label ? `<div class="review-option-label">${uiIcon(right ? 'check' : 'close')}<span>${label}</span></div>` : ''}</div></li>`;
      }).join('')}</ol>`;
    }
    const row = (label, answer, letter, kind, icon) => `<div class="review-choice ${kind}"><div class="review-choice-label">${uiIcon(icon)}<span>${label}</span></div><div class="review-choice-value">${letter ? `<span class="review-choice-letter">${escapeHtml(letter)}</span>` : ''}<span>${escapeHtml(answer)}</span></div></div>`;
    if (question.status === 'correct') {
      return `<div class="answer-review">${row('Tvoj i tačan odgovor',question.yourAnswer ?? question.correctAnswer,question.yourAnswerLetter || question.correctAnswerLetter,'choice-correct','check')}</div>`;
    }
    return `<div class="answer-review">${question.yourAnswer != null ? row('Tvoj odgovor',question.yourAnswer,question.yourAnswerLetter,'choice-wrong','close') : ''}${row('Tačan odgovor',question.correctAnswer,question.correctAnswerLetter,'choice-correct','check')}</div>`;
  }

  function renderSessionDetail() {
    const history = loadHistory();
    const record = history.find((item) => item.id === detailSessionId) || (lastResult?.id === detailSessionId ? lastResult : null);
    if (!record) return setRoute('history');

    setChrome({ nav: false, back: true, subtitleText: record.subjectName });

    const completeReview = Array.isArray(record.questions);
    const questions = completeReview ? record.questions.filter(q => q.status !== 'unanswered' || q.seen === true) : record.mistakes.map((q,index) => ({...q,number:index+1,status:'wrong'}));
    const visible = mistakesOnly ? questions.filter(q => q.status === 'wrong') : questions;
    const labels = {correct:'Tačno',wrong:'Netačno',neutral:'Bez odgovora',unanswered:'Bez odgovora'};
    const reviews = visible.map(q => `
      <article class="mistake-card review-card review-${q.status}">
        <div class="review-heading"><span class="question-number">PITANJE ${q.number}</span><span class="review-status">${uiIcon(q.status === 'correct' ? 'check' : q.status === 'wrong' ? 'close' : 'minus')}<span>${labels[q.status] || ''}</span></span></div>
        ${q.subjectName ? `<div class="review-subject">${escapeHtml(displaySubjectName(q.subjectName))}</div>` : ''}
        <div class="mistake-question">${escapeHtml(q.question)}</div>
        ${reviewAnswers(q)}
      </article>`).join('');
    app.innerHTML = `
      <div class="section-heading">
        <div><div class="eyebrow">Pregled vežbanja</div><h2 style="margin-top:6px">${escapeHtml(displaySubjectName(record.subjectName))}</h2></div>
        <span>${escapeHtml(formatDate(record.endedAt))}</span>
      </div>
      <p class="score-sub">${record.correct}/${record.answered} tačno</p>
      <div class="review-toolbar"><span>${visible.length} ${visible.length % 10 === 1 && visible.length % 100 !== 11 ? 'pitanje' : 'pitanja'}</span><button class="toggle-control" type="button" id="mistakesToggle" role="switch" aria-checked="${mistakesOnly}"><span>Samo greške</span><span class="switch-track" aria-hidden="true"><span class="switch-thumb">${uiIcon('minus','switch-state-off')}${uiIcon('check','switch-state-on')}</span></span></button></div>
      ${!completeReview ? '<p class="legacy-note">Stariji zapis: sačuvane su samo greške.</p>' : ''}
      <section class="mistake-list">${reviews || `<div class="no-mistakes">${mistakesOnly ? 'Nema grešaka.' : 'Nema sačuvanih pitanja.'}</div>`}</section>`;
    document.getElementById('mistakesToggle').addEventListener('click', () => {
      mistakesOnly = !mistakesOnly;
      renderSessionDetail();
    });
  }

  function settingsSummary(title, value = '', id = '') {
    return `<span class="settings-summary-title">${escapeHtml(title)}</span><span class="settings-summary-value" ${id ? `id="${id}"` : ''}>${escapeHtml(value)}</span>${uiIcon('chevron-down')}`;
  }

  function panelState(id) {
    return `data-settings-panel="${id}" ${settingsPanelsOpen.has(id) ? 'open' : ''}`;
  }

  function catRadio() {
    return `<svg class="cat-radio" viewBox="0 0 76 60" aria-hidden="true" shape-rendering="crispEdges">
      <path d="M8 19V5h7l12 11h22L61 5h7v14h4v33h-4v4H8v-4H4V19Z" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>
      <path d="M12 12v8h9M64 12v8h-9" fill="none" stroke="var(--pink)" stroke-width="3"/>
      <rect x="12" y="25" width="52" height="20" rx="2" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
      <g class="cat-reel"><circle cx="25" cy="35" r="6" fill="var(--accent)"/><path d="M25 30v10m-5-5h10" stroke="var(--bg)" stroke-width="2"/></g>
      <g class="cat-reel"><circle cx="51" cy="35" r="6" fill="var(--accent)"/><path d="M51 30v10m-5-5h10" stroke="var(--bg)" stroke-width="2"/></g>
      <path d="M35 33h6l-3 4Z" fill="var(--pink)"/><path d="M29 49h18" stroke="var(--muted)" stroke-width="2"/>
    </svg>`;
  }

  function ambiencePanel() {
    const audio = window.studyAmbience;
    if (!audio) return '';
    const state = audio.get();
    return `<section class="settings-section ambience-section" aria-labelledby="ambienceTitle">
      <div class="cat-player" id="ambiencePlayer">
        ${catRadio()}
        <div class="player-copy"><h2 id="ambienceTitle">Ambijent</h2><div id="playerMixTitle" class="player-mix-title"></div><div class="player-state"><span class="player-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="ambience-status" id="ambienceStatus" role="status"></span></div></div>
        <button id="ambienceToggle" class="player-toggle" aria-label="Pusti ambijent" aria-pressed="false" type="button">${uiIcon('play')}</button>
      </div>
      <details class="settings-subdisclosure" ${panelState('mixes')}><summary>${settingsSummary('Miksevi')}</summary><div class="settings-details">
      <div class="ambience-mode" role="group" aria-label="Način miksa">
        <button type="button" data-mix-mode="preset" aria-pressed="${state.mode === 'preset'}">Gotovi miksevi</button>
        <button type="button" data-mix-mode="custom" aria-pressed="${state.mode === 'custom'}">Tvoj miks</button>
      </div>
      <div class="active-mix" id="activeMix" aria-live="polite"></div>
      <div class="preset-grid ${state.mode === 'custom' ? 'hidden' : ''}" id="presetGrid">${audio.presets.map(preset => `<article class="preset-card">
        <div class="preset-card-top"><button type="button" class="preset-option" data-ambience-preset="${preset.id}" aria-pressed="${state.preset === preset.id}"><span>${preset.name}</span><span class="preset-check">${uiIcon('check')}</span></button>
        <button type="button" class="preset-preview" data-preset-preview="${preset.id}" aria-label="Prikaži nivoe: ${preset.name}" aria-expanded="false" aria-controls="mixPreview">${uiIcon('chevron-down')}</button></div>
      </article>`).join('')}</div>
      <details class="settings-subdisclosure mix-levels" id="mixLevels" ${panelState('levels')}><summary><span id="mixerTitle" class="settings-summary-title">Podesi nivoe</span>${uiIcon('chevron-down')}</summary>
      <div class="ambience-mixer">${audio.sounds.map(sound => `<div class="ambience-layer">
        <div class="setting-row"><label for="ambient-${sound.id}">${sound.name}</label><div class="layer-controls"><output id="ambient-value-${sound.id}" for="ambient-${sound.id}">${state.levels[sound.id]}%</output><button type="button" class="toggle-control switch-only" data-layer-toggle="${sound.id}" role="switch" aria-label="${sound.name}" aria-checked="${state.levels[sound.id] > 0}"><span class="switch-track" aria-hidden="true"><span class="switch-thumb">${uiIcon('minus','switch-state-off')}${uiIcon('check','switch-state-on')}</span></span></button></div></div>
        <input class="ambient-slider" id="ambient-${sound.id}" data-layer-volume="${sound.id}" type="range" min="0" max="100" step="1" value="${state.levels[sound.id]}" aria-label="Jačina: ${sound.name}" />
      </div>`).join('')}</div></details>
      <details class="audio-credits"><summary>${uiIcon('chevron-right')}<span>Zvuci i licence</span></summary><p>Snimci iz <a href="https://github.com/rafaelmardojai/blanket/blob/master/SOUNDS_LICENSING.md" target="_blank" rel="noopener noreferrer">Blanket kolekcije</a>. Ujednačena jačina i MP3 format.</p>
        <ul><li>Lo-fi klavir i Lo-fi sanjarenje — originalna muzika ovog projekta.</li><li>White noise — generisano u projektu.</li>
        <li>Žamor kafića — stephan, <a href="https://soundbible.com/1664-Restaurant-Ambiance.html" target="_blank" rel="noopener noreferrer">Public Domain</a>.</li>
        <li>Voz — SDLx, <a href="https://freesound.org/people/SDLx/sounds/259988/" target="_blank" rel="noopener noreferrer">izvor</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>.</li>
        <li>Grad / prevoz — gezortenplotz, <a href="https://freesound.org/people/gezortenplotz/sounds/44796/" target="_blank" rel="noopener noreferrer">izvor</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>.</li>
        <li>Kamin — ezwa, <a href="https://soundbible.com/1543-Fireplace.html" target="_blank" rel="noopener noreferrer">Public Domain</a>.</li>
        <li>Kiša — alex36917; obrada Porrumentzio, <a href="https://freesound.org/people/alex36917/sounds/524605/" target="_blank" rel="noopener noreferrer">izvor</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</li>
        <li>Potok — gluckose, <a href="https://freesound.org/people/gluckose/sounds/333987/" target="_blank" rel="noopener noreferrer">CC0</a>.</li>
        <li>Noć — Lisa Redfern, <a href="https://soundbible.com/2083-Crickets-Chirping-At-Night.html" target="_blank" rel="noopener noreferrer">Public Domain</a>.</li>
        <li>Vetar — felix.blume; obrada Porrumentzio, <a href="https://freesound.org/people/felix.blume/sounds/217506/" target="_blank" rel="noopener noreferrer">CC0</a>.</li></ul>
      </details></div></details></section>`;
  }

  function closeMixPreview() {
    if (!previewTrigger) return;
    previewTrigger.setAttribute('aria-expanded','false');
    const preset = window.studyAmbience?.presets.find(item => item.id === previewTrigger.dataset.presetPreview);
    if (preset) previewTrigger.setAttribute('aria-label',`Prikaži nivoe: ${preset.name}`);
    previewTrigger = null;
    mixPreview.classList.add('hidden');
    mixPreview.innerHTML = '';
  }

  function showMixPreview(button) {
    closeMixPreview();
    const audio = window.studyAmbience;
    const preset = audio.presets.find(item => item.id === button.dataset.presetPreview);
    if (!preset) return;
    previewTrigger = button;
    button.setAttribute('aria-expanded','true');
    button.setAttribute('aria-label',`Sakrij nivoe: ${preset.name}`);
    mixPreview.innerHTML = `<h2>${escapeHtml(preset.name)}</h2><div class="mix-preview-levels">${audio.sounds.map(sound => {
      const level = preset.levels[sound.id];
      return `<div class="mix-preview-layer ${level ? '' : 'is-muted'}"><div><span>${escapeHtml(sound.name)}</span><span>${level}%</span></div><div class="mix-preview-track" aria-hidden="true"><span style="width:${level}%"></span></div></div>`;
    }).join('')}</div>`;
    mixPreview.classList.remove('hidden');
  }
  const dismissOnInteraction = event => {
    if (event.type === 'pointerdown') dismissedPreviewTrigger = null;
    if (!previewTrigger) return;
    dismissedPreviewTrigger = event.target.closest?.('[data-preset-preview]') === previewTrigger ? previewTrigger : null;
    closeMixPreview();
  };
  document.addEventListener('pointerdown',dismissOnInteraction,{capture:true,passive:true});
  document.addEventListener('click',dismissOnInteraction,true);
  document.addEventListener('keydown',event => {
    dismissedPreviewTrigger = null;
    if (['Enter',' '].includes(event.key) && event.target.closest?.('[data-preset-preview]')) return;
    closeMixPreview();
  },true);
  for (const name of ['wheel','touchmove','scroll']) document.addEventListener(name,closeMixPreview,{capture:true,passive:true});
  window.addEventListener('resize',closeMixPreview,{passive:true});

  function refreshAmbienceControls() {
    if (route !== 'settings' || !window.studyAmbience) return;
    const state = window.studyAmbience.get();
    const playing = state.running && !state.loading && Object.values(state.levels).some(level => level > 0);
    const toggle = document.getElementById('ambienceToggle');
    toggle?.setAttribute('aria-pressed',String(state.running));
    toggle?.setAttribute('aria-label',state.running ? 'Pauziraj ambijent' : 'Pusti ambijent');
    if (toggle) toggle.innerHTML = uiIcon(state.running ? 'pause' : 'play');
    document.getElementById('ambiencePlayer')?.classList.toggle('is-playing',playing);
    const status = document.getElementById('ambienceStatus');
    if (status) status.textContent = state.error || (state.loading ? 'Učitavam…' : playing ? 'Playing' : state.running ? 'Sve je utišano' : 'Paused');
    const name = state.mode === 'custom' ? 'Tvoj miks' : window.studyAmbience.presets.find(preset => preset.id === state.preset)?.name || '';
    const playerTitle = document.getElementById('playerMixTitle');
    if (playerTitle) playerTitle.textContent = name;
    const title = document.getElementById('mixerTitle');
    if (title) title.textContent = state.mode === 'custom' ? 'Podesi svoj miks' : 'Podesi nivoe';
    const current = document.getElementById('activeMix');
    if (current) current.textContent = state.mode === 'custom' ? 'Tvoj miks' : 'Gotov miks';
    app.querySelectorAll('[data-mix-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.mixMode === state.mode)));
    app.querySelectorAll('[data-ambience-preset]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.ambiencePreset === state.preset)));
    app.querySelectorAll('[data-layer-toggle]').forEach(button => button.setAttribute('aria-checked',String(state.levels[button.dataset.layerToggle] > 0)));
    app.querySelectorAll('[data-layer-volume]').forEach(slider => {
      const id = slider.dataset.layerVolume;
      slider.value = state.levels[id];
      document.getElementById(`ambient-value-${id}`).textContent = `${state.levels[id]}%`;
    });
  }

  function refreshSettingsControls() {
    const preferences = window.studySettings.get();
    app.querySelectorAll('[data-theme-id]').forEach(button => {
      const selected = preferences.theme === button.dataset.themeId;
      button.setAttribute('aria-pressed',String(selected));
      button.classList.toggle('selected',selected);
      button.querySelector('.theme-check').innerHTML = selected ? uiIcon('check') : '';
    });
    document.getElementById('themeSummary').textContent = window.studySettings.themes.find(theme => theme.id === preferences.theme).name;
    document.getElementById('nightLightSummary').textContent = preferences.nightLight ? `${preferences.nightLightStrength}%` : 'Ugašeno';
    document.getElementById('mayaSummary').textContent = mayaLabels[preferences.mayaFrequency];
    document.getElementById('nightLightToggle').setAttribute('aria-checked',String(preferences.nightLight));
    document.getElementById('nightLightStrength').disabled = !preferences.nightLight;
    app.querySelectorAll('[data-frequency]').forEach(button => {
      const selected = Number(button.dataset.frequency) === preferences.mayaFrequency;
      button.setAttribute('aria-pressed',String(selected));
      button.classList.toggle('selected',selected);
    });
  }

  function renderSettings() {
    setChrome({nav:true});
    const settings = window.studySettings;
    if (!settings) return;
    const preferences = settings.get();
    app.innerHTML = `
      <div class="section-heading"><h1 class="screen-title">Podešavanja</h1></div>
      ${ambiencePanel()}
      <details class="settings-section settings-disclosure" ${panelState('theme')}>
        <summary>${settingsSummary('Tema',settings.themes.find(theme => theme.id === preferences.theme).name,'themeSummary')}</summary><div class="settings-details">
        <div class="theme-grid">${settings.themes.map(theme => `
          <button class="theme-option ${preferences.theme === theme.id ? 'selected' : ''}" data-theme-id="${theme.id}" aria-pressed="${preferences.theme === theme.id}" type="button">
            <span class="theme-swatches" aria-hidden="true"><i style="background:${theme.bg}"></i><i style="background:${theme.card}"></i><i style="background:${theme.accent}"></i></span>
            <span>${theme.name}</span><span class="theme-check" aria-hidden="true">${preferences.theme === theme.id ? uiIcon('check') : ''}</span>
          </button>`).join('')}</div>
      </div></details>
      <details class="settings-section settings-disclosure" ${panelState('light')}><summary>${settingsSummary('Noćno svetlo',preferences.nightLight ? `${preferences.nightLightStrength}%` : 'Ugašeno','nightLightSummary')}</summary><div class="settings-details">
        <div class="setting-row"><label for="nightLightToggle">Noćno svetlo</label><button id="nightLightToggle" class="toggle-control switch-only" role="switch" aria-checked="${preferences.nightLight}" aria-label="Noćno svetlo" type="button"><span class="switch-track" aria-hidden="true"><span class="switch-thumb">${uiIcon('minus','switch-state-off')}${uiIcon('check','switch-state-on')}</span></span></button></div>
        <div class="slider-label"><label for="nightLightStrength">Jačina</label><output id="nightLightValue" for="nightLightStrength">${preferences.nightLightStrength}%</output></div>
        <input class="night-light-slider" id="nightLightStrength" type="range" min="0" max="100" step="1" value="${preferences.nightLightStrength}" ${preferences.nightLight ? '' : 'disabled'} />
      </div></details>
      <details class="settings-section settings-disclosure" ${panelState('maya')}><summary>${settingsSummary('Mayine posete',mayaLabels[preferences.mayaFrequency],'mayaSummary')}</summary><div class="settings-details">
        <div class="frequency-options" role="group" aria-label="Učestalost poseta">
          ${mayaLabels.map((label,index) => `<button type="button" data-frequency="${index}" aria-pressed="${preferences.mayaFrequency === index}" class="frequency-option ${preferences.mayaFrequency === index ? 'selected' : ''}">${label}</button>`).join('')}
        </div>
      </div></details>`;
    refreshAmbienceControls();
    app.querySelectorAll('[data-settings-panel]').forEach(panel => panel.addEventListener('toggle', () => {
      if (panel.open) settingsPanelsOpen.add(panel.dataset.settingsPanel);
      else settingsPanelsOpen.delete(panel.dataset.settingsPanel);
    }));
    document.getElementById('ambienceToggle')?.addEventListener('click', () => {
      const audio = window.studyAmbience;
      if (audio.get().running) audio.stop(); else void audio.start();
    });
    app.querySelectorAll('[data-mix-mode]').forEach(button => button.addEventListener('click', () => {
      window.studyAmbience.setMode(button.dataset.mixMode);
      const custom = button.dataset.mixMode === 'custom';
      document.getElementById('presetGrid').classList.toggle('hidden',custom);
      document.getElementById('mixLevels').open = custom;
    }));
    app.querySelectorAll('[data-preset-preview]').forEach(button => button.addEventListener('click', () => {
      if (dismissedPreviewTrigger === button) {
        dismissedPreviewTrigger = null;
        return;
      }
      showMixPreview(button);
    }));
    app.querySelectorAll('[data-ambience-preset]').forEach(button => button.addEventListener('click', () => window.studyAmbience.setPreset(button.dataset.ambiencePreset)));
    app.querySelectorAll('[data-layer-toggle]').forEach(button => button.addEventListener('click', () => window.studyAmbience.toggleLayer(button.dataset.layerToggle)));
    app.querySelectorAll('[data-layer-volume]').forEach(slider => slider.addEventListener('input', () => window.studyAmbience.setLevel(slider.dataset.layerVolume,Number(slider.value))));
    app.querySelectorAll('[data-theme-id]').forEach(button => button.addEventListener('click', () => {
      settings.update({theme:button.dataset.themeId}); refreshSettingsControls();
    }));
    document.getElementById('nightLightToggle').addEventListener('click', () => {
      settings.update({nightLight:!settings.get().nightLight}); refreshSettingsControls();
    });
    document.getElementById('nightLightStrength').addEventListener('input', event => {
      const strength = Number(event.target.value);
      settings.update({nightLightStrength:strength});
      document.getElementById('nightLightValue').textContent = `${strength}%`;
      document.getElementById('nightLightSummary').textContent = `${strength}%`;
    });
    app.querySelectorAll('[data-frequency]').forEach(button => button.addEventListener('click', () => {
      settings.update({mayaFrequency:Number(button.dataset.frequency)}); refreshSettingsControls();
    }));
  }

  function renderError() {
    setChrome({ nav: false, back: false, subtitleText: 'Greška pri učitavanju' });
    app.innerHTML = `
      <section class="empty-state">
        <div class="empty-symbol">☁</div>
        <h2>Pitanja nisu učitana</h2>
        <p>Osveži stranicu i pokušaj ponovo.</p>
      </section>
    `;
  }

  function render() {
    if (route === 'home') renderHome();
    else if (route === 'quiz') renderQuiz();
    else if (route === 'result') renderResult();
    else if (route === 'history') renderHistory();
    else if (route === 'settings') renderSettings();
    else if (route === 'session-detail') renderSessionDetail();
  }

  bottomNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-route]');
    if (!button) return;
    setRoute(button.dataset.route);
  });

  function requestSessionExit() {
    if (!activeSession || exitDialog.open) return;
    exitDialog.returnValue = '';
    exitDialog.showModal();
  }

  exitDialog.addEventListener('close', () => {
    if (exitDialog.returnValue === 'confirm' && route === 'quiz' && activeSession) finishSession(false);
  });

  backButton.addEventListener('click', () => navigation.back());

  navigation = window.createStudyNavigation({onNavigate:applyNavigation,onBack:() => {
    const welcome = document.getElementById('mayaWelcome');
    if (welcome?.open) { window.studyWelcome?.dismiss(); return true; }
    if (previewTrigger) { closeMixPreview(); return true; }
    if (exitDialog.open) { exitDialog.close('cancel'); return true; }
    if (route === 'quiz' && activeSession) { requestSessionExit(); return true; }
    return false;
  }});
  navigation.start({route:'home',detailSessionId:null,detailReturnRoute:'history',resultId:null,scrollY:0});

  async function init() {
    try {
      const response = await fetch('./questions.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      if (!Array.isArray(data.subjects)) throw new Error('Invalid question bank');
      data.subjects = data.subjects.map(subject => ({...subject,name:displaySubjectName(subject.name)}));
      render();
    } catch (error) {
      console.error(error);
      renderError();
    }

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./service-worker.js').catch(console.debug);
    }
  }

  if (window.studyAmbience) document.addEventListener('ambience-change', refreshAmbienceControls);
  init();
})();
