// Project Causal – AI Quiz SPA
// Vanilla JS to keep it portable. No build step.
// Overview:
// - State: central in-memory quiz state for email, questions, timing, clues, warnings, attempts
// - Navigation: showScreen(id) toggles SPA screens
// - Rendering: renderOverview() and renderQuestion() build quiz UI pieces
// - Timing: startTimer() for global countdown; per-question timing via currentStartedAt
// - Data: fetchQuestions() pulls from Open Trivia DB with error handling
// - Submission: submitQuiz() compiles score, persists attempt, and renders report
// - Clues: applyClue() implements four client-only assistance options
// - Warnings: visibilitychange increments warnings; exceeding max auto-submits
'use strict';

const API_URL = 'https://opentdb.com/api.php?amount=15&type=multiple';

// State
const state = {
  email: '',
  questions: [], // [{question, correct_answer, incorrect_answers, choices:[], visited:false, answerIndex:null}]
  current: 0,
  startedAt: null,
  durationMs: 30 * 60 * 1000, // 30 minutes
  timerInterval: null,
  cluesLeft: 3,
  usedClues: [], // per question id: {type, detail}
  usedClueTypes: {}, // map of type=>true to lock a clue type globally
  warnings: 0,
  maxWarnings: 4,
  perQuestionTimeMs: [], // same length as questions
  currentStartedAt: null,
  attempts: [], // saved attempts for current email
};

// Utils
const decodeHTML = (str) => {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
};

const shuffle = (arr) => arr.map(v => ({v, r: Math.random()})).sort((a,b)=>a.r-b.r).map(({v})=>v);

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const storageKeyFor = (email) => `cf_quiz_${(email||'').trim().toLowerCase()}`;
function clearAttemptsForEmail(email){
  try{
    const norm = (email||'').trim().toLowerCase();
    const exactKey = `cf_quiz_${email||''}`;
    const normKey = storageKeyFor(email);
    // remove normalized and exact keys
    localStorage.removeItem(normKey);
    localStorage.removeItem(exactKey);
    // sweep any case-variant keys just in case
    for(let i=localStorage.length-1;i>=0;i--){
      const k = localStorage.key(i);
      if(k && k.startsWith('cf_quiz_')){
        const suffix = k.slice('cf_quiz_'.length);
        if(suffix.trim().toLowerCase() === norm){
          localStorage.removeItem(k);
        }
      }
    }
  }catch(e){ /* ignore */ }
}

function showScreen(id){
  // Smooth screen switch: fade-out current (keep visible during anim), fade-in next
  const current = document.querySelector('.screen.active');
  const next = qs('#'+id);
  if(!next) return;
  // Prepare next: ensure fade-in restarts
  next.classList.remove('fade-in');
  void next.offsetWidth; // reflow to retrigger animation
  next.classList.add('fade-in');
  next.classList.add('active');
  if(current && current !== next){
    current.classList.add('fade-out');
    setTimeout(()=>{
      current.classList.remove('fade-out');
      current.classList.remove('active');
    }, 300);
  }
  if(id==='dashboard-screen'){
    qs('#dash-email').textContent = state.email;
    const cont = qs('#past-tests-container'); if(cont) cont.classList.add('hidden');
    const listEl = qs('#past-tests'); if(listEl) listEl.innerHTML='';
    const empty = qs('#past-empty'); if(empty) empty.classList.add('hidden');
    const toggleBtn = qs('#btn-view-tests'); if(toggleBtn) toggleBtn.textContent = 'View Past Tests';
  }
}

function renderOverview(){
  const grid = qs('#question-grid');
  grid.innerHTML = '';
  state.questions.forEach((q, idx)=>{
    const btn = document.createElement('button');
    btn.textContent = idx+1;
    if(q.visited) btn.classList.add('visited');
    if(q.answerIndex !== null) btn.classList.add('attempted');
    btn.addEventListener('click', ()=>{
      navigateToQuestion(idx);
    });
    grid.appendChild(btn);
  });
}

function renderQuestion(animate = true){
  const container = qs('.question-area');
  if(animate && container){ container.classList.remove('q-in'); container.classList.add('q-out'); }
  const q = state.questions[state.current];
  q.visited = true;
  renderOverview();
  updateQuickPanel();

  const doUpdate = ()=>{
    qs('#question-meta').textContent = `Question ${state.current+1} of ${state.questions.length}`;
    qs('#question-text').innerHTML = decodeHTML(q.question);

    const ul = qs('#choices');
    ul.innerHTML = '';
    q.choices.forEach((choice, i)=>{
      const li = document.createElement('li');
      if(q.answerIndex === i) li.classList.add('selected');
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.innerHTML = decodeHTML(choice);
      btn.addEventListener('click', ()=>{
        q.answerIndex = i;
        renderQuestion(false); // selecting an option should NOT animate the whole question
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });

    // update nav buttons
    qs('#prev').disabled = state.current === 0;
    qs('#next').disabled = state.current === state.questions.length - 1;

    // show bottom submit only after last question
    const bottomSubmit = qs('#bottom-submit');
    if(bottomSubmit){
      if(state.current === state.questions.length - 1){
        bottomSubmit.classList.remove('hidden');
      } else {
        bottomSubmit.classList.add('hidden');
      }
    }

    if(animate && container){ container.classList.remove('q-out'); container.classList.add('q-in'); }
  };

  if(animate){
    // Apply 0.5s fade-out, then update and 0.3s fade-in with slide
    setTimeout(doUpdate, 500);
  } else {
    doUpdate();
  }
}

async function fetchQuestions(){
  try{
    const res = await fetch(API_URL, { cache: 'no-store' });
    if(!res.ok) throw new Error(`Failed to fetch questions: ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.results) ? data.results : [];
    state.questions = items.map((it, idx)=>{
      const choices = shuffle([it.correct_answer, ...it.incorrect_answers]);
      return {
        id: idx,
        question: it.question,
        correct: it.correct_answer,
        incorrect: it.incorrect_answers,
        choices,
        visited: false,
        answerIndex: null,
      };
    });
  }catch(err){
    console.warn('Live question fetch failed, using fallback set.', err);
    // Fallback local questions to ensure the app still works offline or when blocked
    const fallback = [
      { q: 'What is the capital of France?', c: 'Paris', i: ['Lyon','Marseille','Nice'] },
      { q: 'Which planet is known as the Red Planet?', c: 'Mars', i: ['Venus','Jupiter','Saturn'] },
      { q: 'Who wrote “1984”?', c: 'George Orwell', i: ['Aldous Huxley','Ray Bradbury','J.R.R. Tolkien'] },
      { q: 'What is H2O commonly known as?', c: 'Water', i: ['Hydrogen','Oxygen','Salt'] },
      { q: 'Which language runs in a web browser?', c: 'JavaScript', i: ['Python','C++','Java'] },
    ];
    state.questions = fallback.map((it, idx)=>{
      const choices = shuffle([it.c, ...it.i]);
      return {
        id: idx,
        question: it.q,
        correct: it.c,
        incorrect: it.i,
        choices,
        visited: false,
        answerIndex: null,
      };
    });
  } finally {
    state.perQuestionTimeMs = new Array(state.questions.length).fill(0);
  }
}

function startTimer(){
  const timerEl = qs('#timer');
  const endAt = state.startedAt + state.durationMs;
  function tick(){
    const now = Date.now();
    const remaining = Math.max(0, endAt - now);
    const m = Math.floor(remaining/60000).toString().padStart(2,'0');
    const s = Math.floor((remaining%60000)/1000).toString().padStart(2,'0');
    const timeText = `${m}:${s}`;
    timerEl.textContent = timeText;
    
    // Update quick panel timer as well
    const qpTimer = qs('#qp-time');
    if(qpTimer) {
      qpTimer.textContent = timeText;
    }
    
    if(remaining === 0){
      clearInterval(state.timerInterval);
      submitQuiz('Time up');
    }
  }
  tick();
  state.timerInterval = setInterval(tick, 1000);
}

function stopTimingCurrent(){
  if(state.currentStartedAt!=null){
    const delta = Date.now() - state.currentStartedAt;
    state.perQuestionTimeMs[state.current] += delta;
    state.currentStartedAt = null;
  }
}

function navigateToQuestion(targetIndex, animate = true){
  if(!Array.isArray(state.questions) || state.questions.length===0) return;
  if(targetIndex<0 || targetIndex>=state.questions.length) return;
  stopTimingCurrent();
  state.current = targetIndex;
  state.currentStartedAt = Date.now();
  renderQuestion(animate);
}

function buildReportText({reason, correctCount, scorePct}){
  const lines = [];
  lines.push(`Email: ${state.email}`);
  lines.push(`Total Questions: ${state.questions.length}`);
  lines.push(`Correct Answers: ${correctCount}`);
  lines.push(`Score: ${correctCount}/${state.questions.length} (${scorePct}%)`);
  if(reason) lines.push(`Submission reason: ${reason}`);
  lines.push('');
  state.questions.forEach((q, idx)=>{
    const picked = q.answerIndex !== null ? decodeHTML(q.choices[q.answerIndex]) : '(not answered)';
    const isCorrect = picked === decodeHTML(q.correct);
    const ms = state.perQuestionTimeMs[idx] || 0;
    const mm = Math.floor(ms/60000).toString().padStart(2,'0');
    const ss = Math.floor((ms%60000)/1000).toString().padStart(2,'0');
    lines.push(`${idx+1}. ${decodeHTML(q.question)}`);
    lines.push(`   Your answer: ${picked}`);
    lines.push(`   Correct answer: ${decodeHTML(q.correct)}`);
    lines.push(`   Time spent: ${mm}:${ss}`);
    lines.push(`   Result: ${isCorrect? 'Correct' : 'Incorrect'}`);
    lines.push('');
  });
  return lines.join('\n');
}

async function downloadReportPDF({reason, correctCount, scorePct}){
  const { jsPDF } = window.jspdf || {};
  if(!jsPDF){
    alert('PDF library not loaded.');
    return;
  }
  const doc = new jsPDF({unit:'pt', format:'a4'});
  const margin = 40; const lineHeight = 16; const pageWidth = doc.internal.pageSize.getWidth();
  let x = margin, y = margin;

  const addLine = (text, bold=false)=>{
    doc.setFont('helvetica', bold? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - margin*2);
    lines.forEach((ln)=>{
      if(y > doc.internal.pageSize.getHeight() - margin){ doc.addPage(); y = margin; }
      doc.text(ln, x, y); y += lineHeight;
    });
  };

  addLine(`Email: ${state.email}`, true);
  addLine(`Total Questions: ${state.questions.length}`);
  addLine(`Correct Answers: ${correctCount}`);
  addLine(`Score: ${correctCount}/${state.questions.length} (${scorePct}%)`);
  if(reason) addLine(`Submission reason: ${reason}`);
  y += 8;

  state.questions.forEach((q, idx)=>{
    addLine(`${idx+1}. ${decodeHTML(q.question)}`, true);
    const picked = q.answerIndex !== null ? decodeHTML(q.choices[q.answerIndex]) : '(not answered)';
    const isCorrect = picked === decodeHTML(q.correct);
    const ms = state.perQuestionTimeMs[idx] || 0;
    const mm = Math.floor(ms/60000).toString().padStart(2,'0');
    const ss = Math.floor((ms%60000)/1000).toString().padStart(2,'0');
    addLine(`Your answer: ${picked}`);
    addLine(`Correct answer: ${decodeHTML(q.correct)}`);
    addLine(`Time spent: ${mm}:${ss}`);
    addLine(`Result: ${isCorrect? 'Correct' : 'Incorrect'}`);
    y += 8;
  });

  doc.save(`CausalFunnel-Quiz-Report-${state.email.replace(/[^a-z0-9@._-]/gi,'_')}.pdf`);
}

function saveAttempt(payload){
  try{
    const key = storageKeyFor(state.email);
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push(payload);
    localStorage.setItem(key, JSON.stringify(list));
  }catch(e){ console.warn('Saving attempt failed', e); }
}

function loadAttempts(){
  try{
    const key = storageKeyFor(state.email);
    state.attempts = JSON.parse(localStorage.getItem(key) || '[]');
  }catch(e){ state.attempts = []; }
}

function renderPastTests(){
  const container = qs('#past-tests-container');
  const listEl = qs('#past-tests');
  const empty = qs('#past-empty');
  listEl.innerHTML = '';
  if(!state.attempts || state.attempts.length===0){
    container.classList.remove('hidden');
    empty.classList.remove('hidden');
    return;
  }
  container.classList.remove('hidden');
  empty.classList.add('hidden');
  state.attempts.forEach((a, idx)=>{
    const item = document.createElement('div');
    item.className = 'past-item';
    const date = new Date(a.completedAt).toLocaleString();
    item.innerHTML = `<div class="meta">${date} • Score ${a.correct}/${a.total} (${a.scorePct}%)</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    btn.textContent = 'View Report';
    btn.addEventListener('click', ()=>{
      // render report from attempt object
      renderReportFromAttempt(a);
    });
    item.appendChild(btn);
    listEl.appendChild(item);
  });
}

function renderReportFromAttempt(att){
  // score header
  qs('#score').textContent = `Score: ${att.correct}/${att.total} (${att.scorePct}%)`;
  qs('#email-display').textContent = `Email: ${state.email}`;
  qs('#report-note').textContent = att.reason ? `Submission reason: ${att.reason}` : '';
  // performance summary (Option B)
  const perf = qs('#performance-summary');
  const correct = att.correct;
  if(correct >= 12){
    perf.textContent = 'Excellent! You nailed it.';
  } else if (correct >= 8){
    perf.textContent = 'Good job! Keep pushing for excellence.';
  } else if (correct >= 5){
    perf.textContent = 'Fair attempt. A bit more practice will help.';
  } else {
    perf.textContent = 'Needs improvement. Start with the fundamentals.';
  }

  // list
  const list = qs('#report-list');
  list.innerHTML = '';
  att.items.forEach((it, idx)=>{
    const item = document.createElement('div');
    const isCorrect = it.userAnswer === it.correct;
    const ms = it.timeMs || 0;
    const mm = Math.floor(ms/60000).toString().padStart(2,'0');
    const ss = Math.floor((ms%60000)/1000).toString().padStart(2,'0');
    item.className = `report-item ${isCorrect? 'correct': 'incorrect'}`;
    item.innerHTML = `
      <div class="report-q">${idx+1}. ${decodeHTML(it.question)}</div>
      <div class="report-a">
        <div class="pill"><strong>Your answer:</strong> ${decodeHTML(it.userAnswer || '(not answered)')}</div>
        <div class="pill"><strong>Correct answer:</strong> ${decodeHTML(it.correct)}</div>
        <div class="pill"><strong>Time spent:</strong> ${mm}:${ss}</div>
      </div>
    `;
    list.appendChild(item);
  });
  showScreen('report-screen');
}

function submitQuiz(reason){
  // stop timing on submit
  stopTimingCurrent();

  // compute score
  let correct = 0;
  state.questions.forEach(q=>{
    if(q.answerIndex !== null && decodeHTML(q.choices[q.answerIndex]) === decodeHTML(q.correct)) correct++;
  });
  const scorePct = Math.round((correct/state.questions.length)*100);
  qs('#score').textContent = `Score: ${correct}/${state.questions.length} (${scorePct}%)`;
  qs('#email-display').textContent = `Email: ${state.email}`;
  const note = qs('#report-note');
  note.textContent = reason ? `Submission reason: ${reason}` : '';

  // performance summary (Option B)
  const perf = qs('#performance-summary');
  if(correct >= 12){
    perf.textContent = 'Excellent! You nailed it.';
  } else if (correct >= 8){
    perf.textContent = 'Good job! Keep pushing for excellence.';
  } else if (correct >= 5){
    perf.textContent = 'Fair attempt. A bit more practice will help.';
  } else {
    perf.textContent = 'Needs improvement. Start with the fundamentals.';
  }

  // render report list
  const list = qs('#report-list');
  list.innerHTML = '';
  state.questions.forEach((q, idx)=>{
    const item = document.createElement('div');
    const picked = q.answerIndex !== null ? q.choices[q.answerIndex] : '(not answered)';
    const isCorrect = decodeHTML(picked) === decodeHTML(q.correct);
    const ms = state.perQuestionTimeMs[idx] || 0;
    const mm = Math.floor(ms/60000).toString().padStart(2,'0');
    const ss = Math.floor((ms%60000)/1000).toString().padStart(2,'0');
    item.className = `report-item ${isCorrect? 'correct': 'incorrect'}`;
    item.innerHTML = `
      <div class="report-q">${idx+1}. ${decodeHTML(q.question)}</div>
      <div class="report-a">
        <div class="pill"><strong>Your answer:</strong> ${decodeHTML(picked)}</div>
        <div class="pill"><strong>Correct answer:</strong> ${decodeHTML(q.correct)}</div>
        <div class="pill"><strong>Time spent:</strong> ${mm}:${ss}</div>
      </div>
    `;
    list.appendChild(item);
  });

  // If no attempts, hint the user on dashboard next time
  loadAttempts(); renderPastTests();

  // persist attempt
  const attempt = {
    completedAt: Date.now(),
    reason,
    correct,
    total: state.questions.length,
    scorePct,
    items: state.questions.map((q, idx)=>{
      const picked = q.answerIndex !== null ? decodeHTML(q.choices[q.answerIndex]) : null;
      return {
        question: q.question,
        userAnswer: picked,
        correct: decodeHTML(q.correct),
        timeMs: state.perQuestionTimeMs[idx]||0,
      };
    })
  };
  saveAttempt(attempt);

  // wire download button
  const downloadBtn = qs('#download-report');
  if(downloadBtn){
    downloadBtn.onclick = ()=>{
      downloadReportPDF({reason, correctCount: correct, scorePct});
    };
  }

  showScreen('report-screen');
}

// AI clue logic (client-only, no external LLM calls for privacy/cost). Heuristics:
// - 50/50: eliminate two wrong options
// - Wikipedia Insight: fetch short extract for a keyword from question text
// - Smart Guess: highlight the most plausible choice by naive keyword matching
async function applyClue(type){
  if(state.cluesLeft <= 0) return;
  if(state.usedClueTypes[type]){ alert('This clue has already been used and is now locked for the rest of the test.'); return; }
  const q = state.questions[state.current];
  const output = qs('#ai-output');
  output.textContent = '';
  let message = '';

  if(type === '5050'){
    // Keep correct + one random incorrect
    const correctIdx = q.choices.findIndex(c=>decodeHTML(c)===decodeHTML(q.correct));
    const wrongIdxs = q.choices.map((_,i)=>i).filter(i=>i!==correctIdx);
    const keepWrong = wrongIdxs[Math.floor(Math.random()*wrongIdxs.length)];
    // Filter choices
    q.choices = q.choices.filter((_,i)=> i===correctIdx || i===keepWrong);
    message = 'I removed two unlikely options. Focus on the remaining two.';
    q.answerIndex = null; // reset selection if invalid
    renderQuestion();
  }

  if(type === 'first'){
    // Reveal first letter of the correct answer (ignoring punctuation/spacing)
    const plainCorrect = decodeHTML(q.correct).replace(/[^a-zA-Z0-9]/g,'').trim();
    if(plainCorrect.length>0){
      message = `The correct answer starts with: "${plainCorrect[0].toUpperCase()}"`;
    } else {
      message = 'No hint available for this one. Try another clue!';
    }
  }

  if(type === 'guess'){
    // naive: prefer choice that shares the most rare words with question
    const text = decodeHTML(q.question).toLowerCase();
    const words = text.replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>3);
    let bestIdx = 0, bestScore = -1;
    q.choices.forEach((c, i)=>{
      const w = decodeHTML(c).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ').filter(s=>s.length>3);
      const score = w.reduce((acc,t)=> acc + (words.includes(t)? 2 : 0.2), 0);
      if(score>bestScore){bestScore=score;bestIdx=i}
    });
    message = `My smart guess would be: "${decodeHTML(q.choices[bestIdx])}". Use your judgment!`;
  }

  if(type === 'keywords'){
    const plain = decodeHTML(q.question).toLowerCase().replace(/[^a-z0-9 ]/g,' ');
    const stop = new Set(['the','and','with','from','that','this','which','when','what','were','your','about','into','than','then','have','has','had','who','whom','them','they','their','there','here','been','also','only','after','before','over','under','much','many','some','most','more','less','very','such','like','into','between','among','upon','onto','does','did','doing','because','while','where','how','why','for','not','but','you','are','was','were','its','it','his','her','she','him','he','our','ours','us']);
    const tokens = plain.split(' ').filter(w=>w.length>3 && !stop.has(w));
    const freq = new Map();
    tokens.forEach(t=> freq.set(t, (freq.get(t)||0)+1));
    const top = [...freq.entries()].sort((a,b)=> b[1]-a[1]).slice(0,5).map(([w])=>w);
    message = top.length ? `Context keywords to focus on: ${top.map(w=>`“${w}”`).join(', ')}.` : 'No strong keywords detected; read the question carefully.';
  }

  state.cluesLeft -= 1;
  state.usedClues.push({q: state.current, type});
  state.usedClueTypes[type] = true;
  qs('#clues-left').textContent = `Clues: ${state.cluesLeft}`;
  qs('#clues-remaining').textContent = state.cluesLeft;
  output.textContent = message;
  updateClueButtons();
}

function addWarning(){
  state.warnings += 1;
  qs('#warnings').textContent = `Warnings: ${state.warnings}/${state.maxWarnings}`;
  if(state.warnings >= state.maxWarnings){
    clearInterval(state.timerInterval);
    alert('Cheating detected: Test ended.');
    submitQuiz('Cheating not allowed (max warnings exceeded)');
  } else {
    alert(`Warning ${state.warnings}/${state.maxWarnings}: Please stay on the quiz tab.`);
  }
}

function updateClueButtons(){
  const mapping = {
    '5050': '#clue-5050',
    'first': '#clue-first',
    'guess': '#clue-guess',
    'keywords': '#clue-keywords',
  };
  Object.entries(mapping).forEach(([type, sel])=>{
    const el = qs(sel);
    if(!el) return;
    const used = !!state.usedClueTypes[type];
    el.disabled = used || state.cluesLeft<=0;
    // add/remove used tag
    const tagSel = '.used-tag';
    const existing = el.querySelector(tagSel);
    if(used){
      if(!existing){
        const span = document.createElement('span');
        span.className = 'used-tag';
        span.textContent = 'Used';
        el.appendChild(span);
      }
      el.classList.add('used-line'); // yellow horizontal line
    } else {
      if(existing) existing.remove();
      el.classList.remove('used-line'); // remove if reset
    }
  });
}


function resetApp(){
  state.email = '';
  state.questions = [];
  state.current = 0;
  state.startedAt = null;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.cluesLeft = 3;
  state.usedClues = [];
  state.usedClueTypes = {};
  state.warnings = 0;
  state.currentStartedAt = null;
  qs('#clues-left').textContent = `Clues: ${state.cluesLeft}`;
  qs('#clues-remaining').textContent = state.cluesLeft;
  if(typeof updateClueButtons === 'function') updateClueButtons();
  qs('#warnings').textContent = `Warnings: ${state.warnings}/${state.maxWarnings}`;
}

// Event wiring
function wire(){
  // toggle quick panel instead of shrinking question area
  qs('#toggle-overview').addEventListener('click', ()=>{
    const p = qs('#quick-panel');
    const layout = qs('.quiz-layout');
    const sidebar = qs('#overview');
    const isOpening = p.classList.contains('hidden');
    p.classList.toggle('hidden');
    updateQuickPanel();
    // If opening, ensure sidebar width expands a bit
    if(isOpening){
      layout.style.gridTemplateColumns = '350px 1fr';
    } else {
      layout.style.gridTemplateColumns = '';
    }
  });
  qs('#close-quick-panel').addEventListener('click', ()=>{
    const layout = qs('.quiz-layout');
    qs('#quick-panel').classList.add('hidden');
    layout.style.gridTemplateColumns = '';
  });

  // keyboard navigation <- and ->
  window.addEventListener('keydown', (e)=>{
    if(!qs('#quiz-screen').classList.contains('active')) return;
    if(e.key === 'ArrowLeft'){
      if(state.current>0){ navigateToQuestion(state.current - 1); }
    } else if(e.key === 'ArrowRight'){
      if(state.current < state.questions.length-1){ navigateToQuestion(state.current + 1); }
    }
  });

  qs('#start-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = qs('#email').value.trim();
    if(!email){
      alert('Please enter a valid email');
      return;
    }
    // On login: clear any stored attempts for a truly fresh start
    clearAttemptsForEmail(email);
    state.attempts = [];
    state.email = email;
    showScreen('dashboard-screen');
  });

  // Dashboard actions
  qs('#btn-new-test').addEventListener('click', async ()=>{
    await fetchQuestions();
    if(state.questions.length===0){ alert('Failed to load questions. Please try again.'); return; }
    state.startedAt = Date.now();
    showScreen('quiz-screen');
    renderOverview();
    startTimer();
    // Trigger question render with animation on first load
    navigateToQuestion(0, true);
  });
  qs('#btn-view-tests').addEventListener('click', (e)=>{
    const cont = qs('#past-tests-container');
    const listEl = qs('#past-tests');
    const empty = qs('#past-empty');
    const btn = e.currentTarget;
    if(cont.classList.contains('hidden')){
      loadAttempts();
      renderPastTests();
      btn.textContent = 'Hide Past Tests';
    } else {
      cont.classList.add('hidden');
      if(listEl) listEl.innerHTML='';
      if(empty) empty.classList.add('hidden');
      btn.textContent = 'View Past Tests';
    }
  });
  qs('#btn-logout').addEventListener('click', ()=>{
    const confirmLogout = confirm('Are you sure you want to logout? This will clear past tests for this email.');
    if(!confirmLogout) return;
    const prevEmail = state.email;
    if(prevEmail){ clearAttemptsForEmail(prevEmail); }
    resetApp();
    state.attempts = [];
    state.email = '';
    const past = qs('#past-tests-container'); if(past) past.classList.add('hidden');
    const toggleBtn = qs('#btn-view-tests'); if(toggleBtn) toggleBtn.textContent = 'View Past Tests';
    showScreen('start-screen');
    // Ensure quiz UI is fully hidden and no timer is running
    const layout = qs('.quiz-layout'); if(layout) layout.style.gridTemplateColumns = '';
    const quick = qs('#quick-panel'); if(quick) quick.classList.add('hidden');
    const bottomSubmit = qs('#bottom-submit'); if(bottomSubmit) bottomSubmit.classList.add('hidden');
    const emailInput = qs('#email'); if(emailInput) emailInput.value = '';
  });

  qs('#prev').addEventListener('click', ()=>{
    if(state.current>0){ navigateToQuestion(state.current - 1); }
  });
  qs('#next').addEventListener('click', ()=>{
    if(state.current < state.questions.length-1){ navigateToQuestion(state.current + 1); }
  });

  // top submit stays hidden; wire bottom submit
  const bottomSubmit = qs('#bottom-submit');
  if(bottomSubmit){
    bottomSubmit.addEventListener('click', ()=>{
      if(confirm('Submit the quiz now?')) submitQuiz('Manual submit');
    });
  }

  // keep top submit available as a fallback (hidden by default)
  qs('#submit-quiz').addEventListener('click', ()=>{
    if(confirm('Submit the quiz now?')) submitQuiz('Manual submit');
  });

  // per-question timing is started on navigation

  // AI modal
  const modal = qs('#ai-modal');
  qs('#ask-ai').addEventListener('click', ()=>{
    if(state.cluesLeft<=0){ alert('No clues left.'); return; }
    qs('#ai-output').textContent='';
    modal.classList.remove('hidden');
  });
  qs('#close-modal').addEventListener('click', ()=>modal.classList.add('hidden'));
  modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.add('hidden'); });
  qs('#clue-5050').addEventListener('click', async ()=>{ await applyClue('5050'); });
  qs('#clue-first').addEventListener('click', async ()=>{ await applyClue('first'); });
  qs('#clue-guess').addEventListener('click', async ()=>{ await applyClue('guess'); });
  qs('#clue-keywords').addEventListener('click', async ()=>{ await applyClue('keywords'); });

  // Retake -> go to dashboard
  qs('#retake').addEventListener('click', ()=>{
    resetApp();
    showScreen('dashboard-screen');
  });

  // Back to dashboard button on report
  qs('#back-dashboard').addEventListener('click', ()=>{
    showScreen('dashboard-screen');
  });

  // cheating detection: tab visibility
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden && qs('#quiz-screen').classList.contains('active')){
      addWarning();
    }
  });
}

function updateQuickPanel(){
  const visited = state.questions.filter(q=>q.visited).length;
  const attempted = state.questions.filter(q=>q.answerIndex!==null).length;
  const remaining = state.questions.length - attempted;
  qs('#qp-visited').textContent = visited;
  qs('#qp-attempted').textContent = attempted;
  qs('#qp-remaining').textContent = remaining;
  
  // Fix timer in overview panel - get current timer value
  const timerEl = qs('#timer');
  if(timerEl) {
    qs('#qp-time').textContent = timerEl.textContent;
  }
}

function applyTheme(name){
  const root = document.documentElement;
  if(name==='ocean'){
    root.style.setProperty('--bg-radial','#0b3752');
    root.style.setProperty('--bg-grad-1','#06121d');
    root.style.setProperty('--bg-grad-2','#0b2236');
    root.style.setProperty('--primary','#4fd1ff');
    root.style.setProperty('--accent','#78a8ff');
    root.style.setProperty('--btn-primary-1','#37b6ff');
    root.style.setProperty('--btn-primary-2','#1176d1');
    root.style.setProperty('--btn-danger-1','#ff7a7a');
    root.style.setProperty('--btn-danger-2','#e64e4e');
    root.style.setProperty('--timer-grad-1','#4fd1ff');
    root.style.setProperty('--timer-grad-2','#78a8ff');
    root.style.setProperty('--sel-grad-1','#0f2742');
    root.style.setProperty('--sel-grad-2','#0b1b31');
  }else if(name==='sunset'){
    root.style.setProperty('--bg-radial','#3a1420');
    root.style.setProperty('--bg-grad-1','#1b0d14');
    root.style.setProperty('--bg-grad-2','#2a0f18');
    root.style.setProperty('--primary','#ff8a6a');
    root.style.setProperty('--accent','#ffbb6a');
    root.style.setProperty('--btn-primary-1','#ff9a76');
    root.style.setProperty('--btn-primary-2','#ff6a3a');
    root.style.setProperty('--btn-danger-1','#ff6b6b');
    root.style.setProperty('--btn-danger-2','#e84a4a');
    root.style.setProperty('--timer-grad-1','#ff8a6a');
    root.style.setProperty('--timer-grad-2','#ffbb6a');
    root.style.setProperty('--sel-grad-1','#3a1a20');
    root.style.setProperty('--sel-grad-2','#2a0f18');
  }else{ // aurora default
    root.style.setProperty('--bg-radial','#152040');
    root.style.setProperty('--bg-grad-1','#0b1020');
    root.style.setProperty('--bg-grad-2','#0e1430');
    root.style.setProperty('--primary','#6dd6ff');
    root.style.setProperty('--accent','#b388ff');
    root.style.setProperty('--btn-primary-1','#42b4ff');
    root.style.setProperty('--btn-primary-2','#2682ff');
    root.style.setProperty('--btn-danger-1','#ff7a7a');
    root.style.setProperty('--btn-danger-2','#e64e4e');
    root.style.setProperty('--timer-grad-1','#42b4ff');
    root.style.setProperty('--timer-grad-2','#b388ff');
    root.style.setProperty('--sel-grad-1','#0f2342');
    root.style.setProperty('--sel-grad-2','#0d1a33');
  }
}

function wireThemeButtons(){
  document.querySelectorAll('[data-theme]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      applyTheme(btn.getAttribute('data-theme'));
    });
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  // If user prefers reduced motion, they can still enable animations by adding
  // body.allow-animations externally. Default behavior respects OS setting.
  wire();
  wireThemeButtons();
});


