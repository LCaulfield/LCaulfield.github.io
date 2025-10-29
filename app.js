// DOM helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const LS_BANK = 'studyquiz/bank/v1';


// State
let bank = null; // { modules: { name: Question[] } }
let prog = loadProgress();
let moduleKey = null;
let running=false, target=10, count=0, current=null;

// UI refs
const moduleSelect = $('#module-select');
const moduleLabel = $('#module-label');
const kpiMastery = $('#kpi-mastery');
const barMastery = $('#bar-mastery');
const kpiAccuracy = $('#kpi-accuracy');
const kpiRatio = $('#kpi-ratio');
const kpiSession = $('#kpi-session');
const kpiTotal = $('#kpi-total');
const panel = $('#panel');
const startBtn = $('#start'); const stopBtn = $('#stop');
const targetInput = $('#target');

// Tabs
$$('.tab').forEach(btn=>btn.addEventListener('click',()=>{
$$('.tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
const id = btn.dataset.tab; $('#view-quiz').style.display = id==='quiz'?'grid':'none'; $('#view-manage').style.display = id==='manage'?'grid':'none'; $('#view-about').style.display = id==='about'?'block':'none';
}));

// Load bank.json (with in-file fallback if offline on first visit)
async function loadBank(){
const cached = localStorage.getItem(LS_BANK);
if(cached){ try{ return JSON.parse(cached); }catch{ /* ignore */ } }
try{
const res = await fetch('bank.json', { cache:'no-store' });
if(!res.ok) throw new Error('fetch failed');
const data = await res.json();
localStorage.setItem(LS_BANK, JSON.stringify(data));
return data;
}catch{
// Fallback minimal bank
return { modules: { 'Module 1 — Foundations': [
{ id:'m1q1', type:'mc', q:'What does HTML stand for?', choices:['Hyperlink and Text Markup Language','HyperText Markup Language','Home Tool Markup Language','HighText Markdown Language'], answer:'HyperText Markup Language', explanation:'HTML defines the structure of web pages.' },
{ id:'m1q2', type:'mc', q:'Which language controls a web page’s visual presentation?', choices:['HTML','CSS','PHP','SQL'], answer:'CSS', explanation:'CSS handles colours, layout, spacing, fonts.' }
] } };
}
}

function refreshModuleLists(){
const keys = Object.keys(bank.modules);
if(!moduleKey) moduleKey = keys[0];
moduleSelect.innerHTML = keys.map(k=>`<option>${k}</option>`).join('');
moduleSelect.value = moduleKey;
document.querySelector('#m-module').innerHTML = keys.map(k=>`<option>${k}</option>`).join('');
document.querySelector('#m-module').value = moduleKey;
document.querySelector('#q-module').innerHTML = keys.map(k=>`<option>${k}</option>`).join('');
document.querySelector('#q-module').value = moduleKey;
// NEW: CSV target module selector
const csvSel = document.querySelector('#csv-module');
if(csvSel){ csvSel.innerHTML = keys.map(k=>`<option>${k}</option>`).join(''); csvSel.value = moduleKey; }
document.querySelector('#q-count').textContent = `Questions in ${moduleKey}: ${(bank.modules[moduleKey]||[]).length}`;
}

function refreshKPI(){
moduleLabel.textContent = moduleKey;
const s = moduleStats(bank, prog, moduleKey);
kpiMastery.textContent = s.masteryPct + '%';
barMastery.style.width = s.masteryPct + '%';
kpiAccuracy.textContent = s.acc;
kpiRatio.textContent = `${s.ok}✓ / ${s.bad}✗`;
kpiSession.textContent = `${count}/${target}`;
kpiTotal.textContent = `${s.seen} questions answered total`;
}

function renderIdle(){ panel.innerHTML = `<div class="muted">Click <b>Start Quiz</b> to begin.</div>`; }


function renderQuestion(q){
const isMC = q.type==='mc';
panel.innerHTML = `<div class='card'>
<div class='muted xsmall'>Question</div>
<div class='strong mt'>${q.q}</div>
${ isMC ? `<div class='choices mt'>${q.choices.map(c=>`<button class='choice'>${c}</button>`).join('')}</div>`
: `<input id='answer' class='w100 mt' placeholder='Type your answer'>` }
<div class='row end mt'><button id='submit' class='primary'>Submit</button></div>
</div>`;
if(isMC){ $$('.choice').forEach(btn=>btn.addEventListener('click',()=>{ $$('.choice').forEach(b=>b.classList.remove('primary')); btn.classList.add('primary'); $('#submit').dataset.answer = btn.textContent; })); }
$('#submit').addEventListener('click', ()=>{
const ans = isMC ? ($('#submit').dataset.answer || '') : ($('#answer').value || '');
submitAnswer(q, ans);
});
if(!isMC) $('#answer').focus();
}

function renderReview(q, userAnswer, correct){
panel.innerHTML = `<div class='card'>
<div class='row gap' style='align-items:center'>
<div class='${correct?'answer-good':'answer-bad'} strong'>${correct?'Correct':'Not quite'}</div>
<div class='muted xsmall'>${ correct? 'Moving this card up a box.' : 'Reset to box 1 — prioritised next.' }</div>
</div>
<div class='mt strong'>${q.q}</div>
<div class='grid two gap mt'>
<div class='kpi'><div class='muted xsmall'>Your answer</div><div>${(userAnswer||'').toString()}</div></div>
<div class='kpi'><div class='muted xsmall'>Correct answer</div><div>${q.answer}</div></div>
</div>
${ q.explanation? `<div class='muted mt'><b>Why:</b> ${q.explanation}</div>`:''}
<div class='row end mt'><button id='next' class='primary'>Next</button></div>
</div>`;
$('#next').addEventListener('click', nextQuestion);
}

function submitAnswer(q, a){
const isText = q.type==='text';
const norm = s => (s||'').trim().toLowerCase();
let ok=false;
if(isText){ const canon = norm(q.answer); const alts=(q.altAnswers||[]).map(norm); ok = norm(a)===canon || alts.includes(norm(a)); }
else { ok = a===q.answer; }


updateProgress(prog, moduleKey, q.id, ok);
saveProgress(prog);


if(ok){ awardXP(10); } else { missPenalty(); setTimeout(()=>{}, 300); }


renderReview(q, a, ok); refreshKPI();
}

function nextQuestion(){
count++; if(count>=target){ stopQuiz(); return; }
current = chooseNextQuestion(bank, prog, moduleKey);
renderQuestion(current); refreshKPI();
}


function startQuiz(){
resetSessionRewards();
target = Math.max(1, Math.min(100, parseInt(targetInput.value||'10')));
count=0; running=true; startBtn.style.display='none'; stopBtn.style.display='inline-block';
current = chooseNextQuestion(bank, prog, moduleKey);
renderQuestion(current); refreshKPI();
}
function stopQuiz(){
running=false; startBtn.style.display='inline-block'; stopBtn.style.display='none'; current=null; renderIdle(); refreshKPI();
}
window.stopQuiz = stopQuiz; // for rewards missPenalty()

function parseCSV(text, delim){
const d = delim || ',';
const lines = (text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
if(!lines.length) return [];
const looksHeader = /^type\s*,/i.test(lines[0].toLowerCase());
const rows = looksHeader ? lines.slice(1) : lines;
return rows.map(line => line.split(d)).map(cols => ({
type: (cols[0]||'').trim(),
q: (cols[1]||'').trim(),
choices: [cols[2],cols[3],cols[4],cols[5]].map(x=>x?x.trim():null).filter(Boolean),
answer: (cols[6]||'').trim(),
alt: (cols[7]||'').trim(),
expl: (cols[8]||'').trim(),
}));
}
function csvRowsToQuestions(rows){
return rows.map(r => {
const id = Math.random().toString(36).slice(2)+Date.now().toString(36);
if(r.type === 'mc'){
return { id, type:'mc', q:r.q, choices:r.choices||[], answer:r.answer, explanation:r.expl||undefined };
} else {
const alt = (r.alt||'').split('|').map(s=>s.trim()).filter(Boolean);
return { id, type:'text', q:r.q, answer:r.answer, altAnswers:alt, explanation:r.expl||undefined };
}
});
}

// Manage view wiring
const mModule = $('#m-module');
const mJson = $('#m-json');
$('#m-reset').addEventListener('click',()=>{ if(confirm(`Reset progress for '${mModule.value}'?`)){ prog[mModule.value] = {}; saveProgress(prog); refreshKPI(); alert('Progress reset.'); }});
$('#m-export').addEventListener('click',()=>{ const data = JSON.stringify(bank,null,2); mJson.value = data; const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='study-bank.json'; a.click(); URL.revokeObjectURL(url); });
$('#m-import').addEventListener('click',()=>{ try{ const parsed=JSON.parse(mJson.value); if(!parsed.modules) throw new Error('Missing modules'); bank=parsed; localStorage.setItem(LS_BANK, JSON.stringify(bank)); refreshModuleLists(); alert('Imported.'); }catch(e){ alert('Import failed: '+e.message);} });

const csvModule = document.querySelector('#csv-module');
const csvDelim = document.querySelector('#csv-delim');
const csvInput = document.querySelector('#csv-input');
const csvParseBtn = document.querySelector('#csv-parse');
if(csvParseBtn){
csvParseBtn.addEventListener('click', ()=>{
try{
const rows = parseCSV(csvInput.value, csvDelim.value === '\\t' ? '\t' : csvDelim.value);
const qs = csvRowsToQuestions(rows);
const key = csvModule.value;
(bank.modules[key] ||= []).push(...qs);
localStorage.setItem(LS_BANK, JSON.stringify(bank));
refreshModuleLists();
alert(`Imported ${qs.length} question(s) into '${key}'.`);
}catch(e){ alert('CSV import failed: ' + e.message); }
});
}

// Add Question form
const qType = $('#q-type');
const qMC = $('#q-mc');
const qText = $('#q-text');
qType.addEventListener('change',()=>{ const t=qType.value; qMC.style.display = t==='mc'? 'grid':'none'; qText.style.display = t==='text'? 'block':'none'; });
const qModule = $('#q-module');
const qQ = $('#q-q');
const qChoices = () => $$('.q-choice').map(i=>i.value).filter(Boolean);
const qAnsMC = $('#q-answer-mc');
const qAnsText = $('#q-answer-text');
const qAlt = $('#q-alt');
const qExpl = $('#q-expl');
$('#q-add').addEventListener('click',()=>{
const t = qType.value; const mod = qModule.value; const text = (qQ.value||'').trim(); if(!text){ alert('Enter a question.'); return; }
const payload = { id: Math.random().toString(36).slice(2)+Date.now().toString(36), type:t, q:text };
if(t==='mc'){ const choices=qChoices(); const ans=(qAnsMC.value||'').trim(); if(!ans||!choices.includes(ans)){ alert('Correct option must match one of the choices.'); return; } payload.choices=choices; payload.answer=ans; }
else { payload.answer=(qAnsText.value||'').trim(); payload.altAnswers=(qAlt.value||'').split('|').map(s=>s.trim()).filter(Boolean); }
if((qExpl.value||'').trim()) payload.explanation = qExpl.value.trim();
(bank.modules[mod] ||= []).push(payload);
localStorage.setItem(LS_BANK, JSON.stringify(bank));
refreshModuleLists(); alert('Added.'); qQ.value=''; qAnsMC.value=''; qAnsText.value=''; qAlt.value=''; qExpl.value=''; $$('.q-choice').forEach(i=>i.value='');
});


// Module change
moduleSelect.addEventListener('change',()=>{ moduleKey = moduleSelect.value; refreshKPI(); refreshModuleLists(); renderIdle(); });
$('#start').addEventListener('click', startQuiz);
$('#stop').addEventListener('click', stopQuiz);
$('#target').addEventListener('change',()=>{ target = Math.max(1, Math.min(100, parseInt(targetInput.value||'10'))); refreshKPI(); });


// Init
(async function init(){
bank = await loadBank();
moduleKey = Object.keys(bank.modules)[0];
refreshModuleLists(); refreshKPI(); renderIdle(); updateHUD();
})();