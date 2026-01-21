// --- Simple question bank (extendable) ---
let BANK = {
  'General': [
    {q:'Which language runs in a web browser?', opts:['Java','C','Python','JavaScript'], a:3, points:10, hint:"It's the language of the web."},
    {q:'What does CSS stand for?', opts:['Computer Style Sheets','Cascading Style Sheets','Creative Style Syntax','Code Styling System'], a:1, points:10, hint:'Think cascading.'}
  ],
  'Math': [
    {q:'What is 7 * 8?', opts:['54','56','58','63'], a:1, points:8, hint:'7*8=56'}
  ]
};

// --- localStorage keys ---
const BANK_KEY = 'quizBank_v1';
const HS_KEY = 'neon_highscores';

// --- Load bank from localStorage if available ---
const savedBank = localStorage.getItem(BANK_KEY);
if (savedBank) {
  try { BANK = JSON.parse(savedBank); } catch (e) { console.warn('Could not parse saved bank, using default.'); }
}

// --- State ---
let state = { cat: 'General', qIdx: 0, score: 0, lives: 3, timePerQ: 15, secsLeft: 15, running: false, used: {fifty:0,hint:0,skip:0}, timeUpHandled:false };
let questions = [];
const MAX_FIFTY=2, MAX_HINT=2, MAX_SKIP=2;

// DOM refs
const qnum = document.getElementById('qnum');
const scoreEl = document.getElementById('score');
const questionEl = document.getElementById('question');
const optsEl = document.getElementById('opts');
const timeLabel = document.getElementById('timeLabel');
const timerArc = document.getElementById('timerArc');
const livesEl = document.getElementById('lives');
const qtimeEl = document.getElementById('qtime');
const fiftyBtn = document.getElementById('fifty');
const hintBtn = document.getElementById('hintBtn');
const skipBtn = document.getElementById('skip');
const fiftyCount = document.getElementById('fiftyCount');
const hintCount = document.getElementById('hintCount');
const skipCount = document.getElementById('skipCount');
const nextBtn = document.getElementById('nextBtn');
const pauseBtn = document.getElementById('pauseBtn');
const categorySelect = document.getElementById('categorySelect');
const highscoresEl = document.getElementById('highscores');
const clearScores = document.getElementById('clearScores');

const startBtn = document.getElementById('startBtn');
const adminPanel = document.getElementById('adminPanel');
const showAdminLoginBtn = document.getElementById('showAdminLoginBtn');
const addQBtn = document.getElementById('addQBtn');
const closeAdmin = document.getElementById('closeAdmin');

const categoryList = document.getElementById('categoryList');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const newCategoryName = document.getElementById('newCategoryName');
const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');

const questionList = document.getElementById('questionList');
const loadQBtn = document.getElementById('loadQBtn');
const deleteQBtn = document.getElementById('deleteQBtn');
const editQBtn = document.getElementById('editQBtn');

let timerId = null;
let quizRunning = false;

// --- Save bank helper ---
function saveBank() {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(BANK)); } catch(e) { console.warn('save failed', e); }
}

// --- Setup categories ---
function refreshCategoryOptions(){
  categorySelect.innerHTML = '';
  categoryList.innerHTML = '';
  Object.keys(BANK).forEach(cat=>{
    const a = document.createElement('option'); a.value = cat; a.textContent = cat; categorySelect.appendChild(a);
    const b = document.createElement('option'); b.value = cat; b.textContent = cat; categoryList.appendChild(b);
  });
  // restore selected category
  if (BANK[state.cat]) categorySelect.value = state.cat;
}
refreshCategoryOptions();

// --- Helpers ---
function pickQuestions(cat){
  const pool = (BANK[cat] || []).slice();
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  return pool;
}

function startGame(){
  state.qIdx = 0;
  state.score = 0;
  state.lives = 3;
  state.running = true;
  state.used = {fifty:0,hint:0,skip:0};
  state.timeUpHandled = false;
  questions = pickQuestions(state.cat);
  state.timePerQ = parseInt(qtimeEl.textContent)||15;
  state.secsLeft = state.timePerQ;
  updateUI();
  renderQuestion();
  loadHighscores();
  startTimer();
  quizRunning = true;
  startBtn.textContent = 'End Quiz';
}

function endGame(){
  state.running=false;
  quizRunning = false;
  if(timerId) clearInterval(timerId);
  updateTimerArc();
  renderEndOverlay();
  saveHighscore();
  startBtn.textContent = 'Start Quiz ▶';
}

function updateUI(){
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  fiftyCount.textContent = '×'+(MAX_FIFTY - state.used.fifty);
  hintCount.textContent = '×'+(MAX_HINT - state.used.hint);
  skipCount.textContent = '×'+(MAX_SKIP - state.used.skip);
  qnum.textContent = questions.length ? `Q ${state.qIdx+1} / ${questions.length}` : 'Q 0 / 0';
  qtimeEl.textContent = state.timePerQ + 's';
}

function renderQuestion(){
  const q = questions[state.qIdx];
  if(!q){ endGame(); return; }
  state.timeUpHandled = false;
  questionEl.textContent = q.q;
  optsEl.innerHTML = ''; document.getElementById('hint').textContent = '';
  q.opts.forEach((o,i)=>{
    const b = document.createElement('button');
    b.className='opt';
    b.setAttribute('role','listitem');
    b.tabIndex=0;
    b.dataset.idx=i;
    b.innerHTML = `<div style="font-weight:600">${String.fromCharCode(65+i)} - ${o}</div>`;
    b.addEventListener('click',()=>selectOption(i));
    optsEl.appendChild(b);
  });
  updateUI();
  state.secsLeft = state.timePerQ;
  updateTimerArc();
}

// --- Timer ---
function startTimer(){ if(timerId) clearInterval(timerId); timerId = setInterval(()=>{ if(!state.running) return; state.secsLeft -= 0.2; if(state.secsLeft <= 0){ state.secsLeft = 0; handleTimeUp(); } updateTimerArc(); }, 200); }
function updateTimerArc(){ const pct = (state.secsLeft/state.timePerQ)*100; timerArc.setAttribute('stroke-dasharray', `${pct} ${100-pct}`); timeLabel.textContent = Math.ceil(state.secsLeft) + 's'; }
function handleTimeUp(){ if (state.timeUpHandled) return; state.timeUpHandled = true; markWrong(); }

// --- Option handling ---
function selectOption(i){
  const q = questions[state.qIdx];
  disableOptions();
  if(i === q.a){
    markCorrect(i);
  } else {
    markWrong(i);
  }
}
function disableOptions(){ Array.from(optsEl.children).forEach(b=>b.disabled=true); }

function markCorrect(i){
  const btn = optsEl.querySelector(`[data-idx="${i}"]`);
  if(btn) btn.classList.add('correct');
  state.score += questions[state.qIdx].points || 10; updateUI();
  setTimeout(()=> nextQuestion(), 900);
}

function markWrong(i){
  const btn = (typeof i === 'number') ? optsEl.querySelector(`[data-idx="${i}"]`) : null;
  if(btn) btn.classList.add('wrong');
  state.lives = Math.max(0, state.lives - 1);
  updateUI();
  disableOptions();
  const correct = questions[state.qIdx].a;
  const correctBtn = optsEl.querySelector(`[data-idx="${correct}"]`);
  if(correctBtn) correctBtn.classList.add('correct');
  if(state.lives <= 0) setTimeout(()=> endGame(), 1000); else setTimeout(()=> nextQuestion(), 1000);
}

function nextQuestion(){
  state.qIdx++;
  if(state.qIdx >= questions.length){ endGame(); return; }
  renderQuestion();
}

// --- Lifelines ---
fiftyBtn.addEventListener('click', ()=>{
  if(state.used.fifty >= MAX_FIFTY) return;
  state.used.fifty++;
  const q = questions[state.qIdx]; let wrongs = [];
  q.opts.forEach((o,i)=>{ if(i!==q.a) wrongs.push(i); });
  for(let k=0;k<2 && wrongs.length;k++){
    const r = wrongs.splice(Math.floor(Math.random()*wrongs.length),1)[0];
    const btn = optsEl.querySelector(`[data-idx="${r}"]`);
    if(btn){ btn.disabled = true; btn.style.visibility = 'hidden'; }
  }
  updateUI();
});

hintBtn.addEventListener('click', ()=>{
  if(state.used.hint >= MAX_HINT) return;
  state.used.hint++;
  document.getElementById('hint').textContent = questions[state.qIdx].hint || 'No hint available.';
  updateUI();
});

skipBtn.addEventListener('click', ()=>{
  if(state.used.skip >= MAX_SKIP) return;
  state.used.skip++;
  nextQuestion();
  updateUI();
});

// --- Pause / Next ---
pauseBtn.addEventListener('click', ()=>{ state.running = !state.running; pauseBtn.textContent = state.running ? 'Pause ⏸' : 'Resume ▶'; });
nextBtn.addEventListener('click', ()=>{ nextQuestion(); });

// --- Keyboard shortcuts ---
window.addEventListener('keydown', (e)=>{
  if(document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if(['1','2','3','4'].includes(e.key)){
    const idx = parseInt(e.key) - 1;
    const btn = optsEl.querySelector(`[data-idx="${idx}"]`);
    if(btn && !btn.disabled) btn.click();
  }
  if(e.key.toLowerCase()==='h') hintBtn.click();
  if(e.key.toLowerCase()==='f') fiftyBtn.click();
  if(e.key.toLowerCase()==='k') skipBtn.click();
  if(e.key.toLowerCase()==='n') nextBtn.click();
});

// --- Highscores ---
function loadHighscores(){
  const hs = JSON.parse(localStorage.getItem(HS_KEY)||'[]'); highscoresEl.innerHTML='';
  hs.slice(0,8).forEach(s=>{const li=document.createElement('li'); li.textContent = `${s.name} — ${s.score}`; highscoresEl.appendChild(li);});
}
function saveHighscore(){
  const name = prompt('Game over! Enter your name for the high-score board (or Cancel to skip)');
  if(!name) return;
  const hs = JSON.parse(localStorage.getItem(HS_KEY)||'[]');
  hs.push({name,score:state.score,date:new Date().toISOString()});
  hs.sort((a,b)=>b.score-a.score);
  localStorage.setItem(HS_KEY, JSON.stringify(hs.slice(0,20)));
  loadHighscores();
}
clearScores.addEventListener('click', ()=>{ localStorage.removeItem(HS_KEY); loadHighscores(); });

// --- End overlay & confetti ---
function renderEndOverlay(){
  const overlay = document.createElement('div'); overlay.style.position='fixed'; overlay.style.inset=0; overlay.style.display='grid'; overlay.style.placeItems='center'; overlay.style.background='linear-gradient(180deg, rgba(2,6,23,0.7), rgba(2,6,23,0.9))';
  overlay.innerHTML = `<div style="background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent);padding:28px;border-radius:18px;text-align:center;min-width:320px">
    <h2 style="margin:0 0 6px 0">Game Over</h2>
    <div style="font-size:14px;color:var(--muted);">Your score: <strong style="font-size:22px">${state.score}</strong></div>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:center">
      <button id="playAgain" class="btn">Play Again</button>
      <button id="close" class="ghost">Close</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  confettiBurst();
  document.getElementById('playAgain').addEventListener('click', ()=>{ overlay.remove(); startGame(); });
  document.getElementById('close').addEventListener('click', ()=> overlay.remove());
}

function confettiBurst(){
  const canvas = document.createElement('canvas'); canvas.style.position='fixed'; canvas.style.left=0; canvas.style.top=0; canvas.width=innerWidth; canvas.height=innerHeight; canvas.style.pointerEvents='none'; document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d'); const pieces=[]; for(let i=0;i<80;i++){pieces.push({x:innerWidth/2,y:innerHeight/2, vx:(Math.random()-0.5)*8, vy:(Math.random()-1.5)*8, size:4+Math.random()*6, color:["#7c3aed","#06b6d4","#f97316","#10b981"][Math.floor(Math.random()*4)]})}
  let t=0; function loop(){ t++; ctx.clearRect(0,0,canvas.width,canvas.height); pieces.forEach(p=>{p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size)}); if(t<120) requestAnimationFrame(loop); else canvas.remove(); }
  loop();
}

// --- Category & Admin management functions ---
function updateQuestionList(cat) {
  questionList.innerHTML = '';
  if (BANK[cat]) {
    BANK[cat].forEach((q, idx) => {
      let opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${idx+1}. ${q.q}`;
      questionList.appendChild(opt);
    });
  }
}

addCategoryBtn.addEventListener('click', ()=> {
  const name = newCategoryName.value.trim();
  if(!name) return alert('Enter a category name.');
  if(BANK[name]) return alert('Category exists.');
  BANK[name] = [];
  saveBank();
  refreshCategoryOptions();
  newCategoryName.value = '';
  alert('Category added.');
});

deleteCategoryBtn.addEventListener('click', ()=> {
  const cat = categoryList.value;
  if(!cat) return alert('Select a category.');
  if(!confirm(`Delete category "${cat}" and all its questions?`)) return;
  delete BANK[cat];
  saveBank();
  refreshCategoryOptions();
  alert('Category deleted.');
});

// When categoryList changes, update questionList
categoryList.addEventListener('change', (e)=> updateQuestionList(e.target.value));

// Add question via admin to selected category
addQBtn.addEventListener('click', ()=>{
  const cat = categoryList.value;
  if(!cat) return alert('Select a category first.');
  const newQ = {
    q: document.getElementById('adminQ').value.trim(),
    opts: [
      document.getElementById('opt1').value.trim(),
      document.getElementById('opt2').value.trim(),
      document.getElementById('opt3').value.trim(),
      document.getElementById('opt4').value.trim()
    ],
    a: parseInt(document.getElementById('correctIdx').value, 10),
    points: parseInt(document.getElementById('points').value, 10) || 10,
    hint: document.getElementById('hintInput').value.trim() || ''
  };
  if(!newQ.q || newQ.opts.some(o => !o) || isNaN(newQ.a) || newQ.a<0 || newQ.a>3) return alert('Please fill fields correctly and correct index 0-3.');
  BANK[cat].push(newQ);
  saveBank();
  updateQuestionList(cat);

  // If running and same category, insert to current pool right after current question
  if(quizRunning && cat === state.cat){
    const insertPos = Math.min(state.qIdx + 1, questions.length);
    questions.splice(insertPos, 0, newQ);
    alert('Question added and inserted into current quiz (will appear soon).');
    updateUI();
  } else {
    alert(`Question added to "${cat}".`);
  }

  // clear inputs
  document.getElementById('adminQ').value=''; document.getElementById('opt1').value=''; document.getElementById('opt2').value=''; document.getElementById('opt3').value=''; document.getElementById('opt4').value=''; document.getElementById('correctIdx').value=''; document.getElementById('points').value=10; document.getElementById('hintInput').value='';
});

// Load an existing question into form
loadQBtn.addEventListener('click', ()=>{
  const cat = categoryList.value;
  const idx = questionList.value;
  if(!cat || idx === '') return alert('Select category and question.');
  const q = BANK[cat][idx];
  if(!q) return alert('Question not found.');
  document.getElementById('adminQ').value = q.q;
  document.getElementById('opt1').value = q.opts[0] || '';
  document.getElementById('opt2').value = q.opts[1] || '';
  document.getElementById('opt3').value = q.opts[2] || '';
  document.getElementById('opt4').value = q.opts[3] || '';
  document.getElementById('correctIdx').value = q.a;
  document.getElementById('points').value = q.points;
  document.getElementById('hintInput').value = q.hint || '';
  editQBtn.dataset.cat = cat;
  editQBtn.dataset.idx = idx;
});

// Save edits to a loaded question
editQBtn.addEventListener('click', ()=>{
  const cat = editQBtn.dataset.cat;
  const idx = editQBtn.dataset.idx;
  if(!cat || idx === undefined) return alert('Load a question first.');
  const updated = {
    q: document.getElementById('adminQ').value.trim(),
    opts: [
      document.getElementById('opt1').value.trim(),
      document.getElementById('opt2').value.trim(),
      document.getElementById('opt3').value.trim(),
      document.getElementById('opt4').value.trim()
    ],
    a: parseInt(document.getElementById('correctIdx').value, 10),
    points: parseInt(document.getElementById('points').value, 10) || 10,
    hint: document.getElementById('hintInput').value.trim() || ''
  };
  if(!updated.q || updated.opts.some(o => !o) || isNaN(updated.a) || updated.a<0 || updated.a>3) return alert('Please fill fields correctly.');
  BANK[cat][idx] = updated;
  saveBank();
  updateQuestionList(cat);
  alert('Question updated.');
});

// Delete selected question
deleteQBtn.addEventListener('click', ()=>{
  const cat = categoryList.value;
  const idx = questionList.value;
  if(!cat || idx === '') return alert('Select category and question.');
  if(!confirm('Delete this question?')) return;
  BANK[cat].splice(idx, 1);
  saveBank();
  updateQuestionList(cat);
  alert('Question deleted.');
});

// --- Start / End button behavior ---
document.getElementById('qcard').style.display = 'none';
state.cat = categorySelect.value || state.cat;
updateUI();
loadHighscores();

startBtn.addEventListener('click', ()=>{
  if(!quizRunning){
    document.getElementById('qcard').style.display = 'block';
    state.cat = categorySelect.value || state.cat;
    startGame();
  } else {
    if(confirm('Are you sure you want to end the quiz?')){
      document.getElementById('qcard').style.display = 'none';
      state.running = false;
      if(timerId) clearInterval(timerId);
      quizRunning = false;
      startBtn.textContent = 'Start Quiz ▶';
      state.score = 0; updateUI();
    }
  }
});

// When switching category via main selector while running, confirm restart
categorySelect.addEventListener('change',(e)=>{
  const newCat = e.target.value;
  if(quizRunning){
    if(confirm('Changing category will restart the quiz. Continue?')){
      state.cat = newCat;
      startGame();
    } else {
      categorySelect.value = state.cat;
    }
  } else {
    state.cat = newCat;
  }
});

// --- Admin Login (panel hidden until password correct) ---
const adminPassword = 'admin123'; // change as needed
showAdminLoginBtn.addEventListener('click', ()=>{
  const entered = prompt('Enter Admin Password:');
  if(entered === adminPassword){
    adminPanel.style.display = 'block';
    // refresh lists
    refreshCategoryOptions();
    updateQuestionList(categoryList.value || state.cat);
    alert('Admin access granted.');
  } else {
    alert('Incorrect password.');
  }
});
closeAdmin.addEventListener('click', ()=> adminPanel.style.display = 'none');

// Ensure categoryList default
if(!categoryList.value) categoryList.value = Object.keys(BANK)[0] || '';

// Keep the main categorySelect and admin categoryList in sync when admin panel opens or changes
categoryList.addEventListener('change', (e)=> {
  updateQuestionList(e.target.value);
});
