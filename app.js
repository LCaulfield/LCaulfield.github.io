// DOM helpers
var $ = function(sel){ return document.querySelector(sel); };
var $$ = function(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); };
var LS_BANK = 'studyquiz/bank/v1';

// State
var bank = null; // { modules: { name: Question[] } }
var prog = loadProgress();
var moduleKey = null;
var running=false, target=10, count=0, current=null;

// UI refs
var moduleSelect = $('#module-select');
var moduleLabel = $('#module-label');
var kpiMastery = $('#kpi-mastery');
var barMastery = $('#bar-mastery');
var kpiAccuracy = $('#kpi-accuracy');
var kpiRatio = $('#kpi-ratio');
var kpiSession = $('#kpi-session');
var kpiTotal = $('#kpi-total');
var panel = $('#panel');
var startBtn = $('#start'); var stopBtn = $('#stop');
var targetInput = $('#target');

// Tabs
$$('.tab').forEach(function(btn){
  btn.addEventListener('click', function(){
    $$('.tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    var id = btn.dataset.tab;
    $('#view-quiz').style.display   = id==='quiz'   ? 'grid'  : 'none';
    $('#view-manage').style.display = id==='manage' ? 'grid'  : 'none';
    $('#view-about').style.display  = id==='about'  ? 'block' : 'none';
  });
});

// Load bank.json (with in-file fallback if offline on first visit)
async function loadBank(){
  var cached = localStorage.getItem(LS_BANK);
  if(cached){ try{ return JSON.parse(cached); }catch(e){} }
  try{
    var res = await fetch('bank.json', { cache:'no-store' });
    if(!res.ok) throw new Error('fetch failed');
    var data = await res.json();
    localStorage.setItem(LS_BANK, JSON.stringify(data));
    return data;
  }catch(e){
    // Fallback minimal bank
    return { modules: { 'Module 1 — Foundations': [
      { id:'m1q1', type:'mc', q:'What does HTML stand for?', choices:['Hyperlink and Text Markup Language','HyperText Markup Language','Home Tool Markup Language','HighText Markdown Language'], answer:'HyperText Markup Language', explanation:'HTML defines the structure of web pages.' },
      { id:'m1q2', type:'mc', q:'Which language controls a web page’s visual presentation?', choices:['HTML','CSS','PHP','SQL'], answer:'CSS', explanation:'CSS handles colours, layout, spacing, fonts.' }
    ] } };
  }
}

function refreshModuleLists(){
  var keys = Object.keys(bank.modules);
  if(!moduleKey) moduleKey = keys[0];
  moduleSelect.innerHTML = keys.map(function(k){ return '<option>'+k+'</option>'; }).join('');
  moduleSelect.value = moduleKey;
  $('#m-module').innerHTML = keys.map(function(k){ return '<option>'+k+'</option>'; }).join('');
  $('#m-module').value = moduleKey;
  $('#q-module').innerHTML = keys.map(function(k){ return '<option>'+k+'</option>'; }).join('');
  $('#q-module').value = moduleKey;
  $('#q-count').textContent = 'Questions in ' + moduleKey + ': ' + ((bank.modules[moduleKey]||[]).length);
}

function refreshKPI(){
  moduleLabel.textContent = moduleKey;
  var s = moduleStats(bank, prog, moduleKey);
  kpiMastery.textContent = s.masteryPct + '%';
  barMastery.style.width = s.masteryPct + '%';
  kpiAccuracy.textContent = s.acc;
  kpiRatio.textContent = s.ok + '✓ / ' + s.bad + '✗';
  kpiSession.textContent = count + '/' + target;
  kpiTotal.textContent = s.seen + ' questions answered total';
}

function renderIdle(){ panel.innerHTML = '<div class="muted">Click <b>Start Quiz</b> to begin.</div>'; }

function renderQuestion(q){
  var isMC = q.type==='mc';
  panel.innerHTML = "<div class='card'>\
    <div class='muted xsmall'>Question</div>\
    <div class='strong mt'>"+q.q+"</div>\
    "+( isMC
      ? "<div class='choices mt'>" + q.choices.map(function(c){ return "<button class='choice'>"+c+"</button>"; }).join('') + "</div>"
      : "<input id='answer' class='w100 mt' placeholder='Type your answer'>" )+"\
    <div class='row end mt'><button id='submit' class='primary'>Submit</button></div>\
  </div>";
  if(isMC){
    $$('.choice').forEach(function(btn){
      btn.addEventListener('click', function(){
        $$('.choice').forEach(function(b){ b.classList.remove('primary'); });
        btn.classList.add('primary');
        $('#submit').dataset.answer = btn.textContent;
      });
    });
  }
  $('#submit').addEventListener('click', function(){
    var ans = isMC ? ($('#submit').dataset.answer || '') : ($('#answer').value || '');
    submitAnswer(q, ans);
  });
  if(!isMC){ var a=$('#answer'); if(a) a.focus(); }
}

function renderReview(q, userAnswer, correct){
  panel.innerHTML = "<div class='card'>\
    <div class='row gap' style='align-items:center'>\
      <div class='"+(correct?'answer-good':'answer-bad')+" strong'>"+(correct?'Correct':'Not quite')+"</div>\
      <div class='muted xsmall'>"+(correct?'Moving this card up a box.':'Reset to box 1 — prioritised next.')+"</div>\
    </div>\
    <div class='mt strong'>"+q.q+"</div>\
    <div class='grid two gap mt'>\
      <div class='kpi'><div class='muted xsmall'>Your answer</div><div>"+(userAnswer||'')+"</div></div>\
      <div class='kpi'><div class='muted xsmall'>Correct answer</div><div>"+q.answer+"</div></div>\
    </div>\
    "+(q.explanation? "<div class='muted mt'><b>Why:</b> "+q.explanation+"</div>": '')+"\
    <div class='row end mt'><button id='next' class='primary'>Next</button></div>\
  </div>";
  $('#next').addEventListener('click', nextQuestion);
}

function submitAnswer(q, a){
  var isText = q.type==='text';
  var norm = function(s){ return (s||'').trim().toLowerCase(); };
  var ok=false;
  if(isText){
    var canon = norm(q.answer);
    var alts = (q.altAnswers||[]).map(norm);
    ok = norm(a)===canon || alts.indexOf(norm(a))>=0;
  } else {
    ok = a===q.answer;
  }

  updateProgress(prog, moduleKey, q.id, ok);
  saveProgress(prog);

  if(ok){ awardXP(10); } else { missPenalty(); setTimeout(function(){}, 300); }

  renderReview(q, a, ok); refreshKPI();
}

function nextQuestion(){
  count++; if(count>=target){ stopQuiz(); return; }
  current = chooseNextQuestion(bank, prog, moduleKey);
  renderQuestion(current); refreshKPI();
}

function startQuiz(){
  resetSessionRewards();
  target = Math.max(1, Math.min(100, parseInt(targetInput.value||'10',10)));
  count=0; running=true; startBtn.style.display='none'; stopBtn.style.display='inline-block';
  current = chooseNextQuestion(bank, prog, moduleKey);
  renderQuestion(current); refreshKPI();
}
function stopQuiz(){
  running=false; startBtn.style.display='inline-block'; stopBtn.style.display='none'; current=null; renderIdle(); refreshKPI();
}
window.stopQuiz = stopQuiz; // for rewards missPenalty()

// Manage view wiring
var mModule = $('#m-module');
var mJson = $('#m-json');
$('#m-reset').addEventListener('click',function(){
  if(confirm("Reset progress for '"+mModule.value+"'?")){
    prog[mModule.value] = {}; saveProgress(prog); refreshKPI(); alert('Progress reset.');
  }
});
$('#m-export').addEventListener('click',function(){
  var data = JSON.stringify(bank,null,2); mJson.value = data;
  var blob=new Blob([data],{type:'application/json'});
  var url=URL.createObjectURL(blob); var a=document.createElement('a');
  a.href=url; a.download='study-bank.json'; a.click(); URL.revokeObjectURL(url);
});
$('#m-import').addEventListener('click',function(){
  try{
    var parsed=JSON.parse(mJson.value);
    if(!parsed.modules) throw new Error('Missing modules');
    bank=parsed; localStorage.setItem(LS_BANK, JSON.stringify(bank));
    refreshModuleLists(); alert('Imported.');
  }catch(e){ alert('Import failed: '+e.message); }
});

// Add Question form
var qType = $('#q-type');
var qMC = $('#q-mc');
var qText = $('#q-text');
qType.addEventListener('change',function(){
  var t=qType.value; qMC.style.display = t==='mc'? 'grid':'none'; qText.style.display = t==='text'? 'block':'none';
});
var qModule = $('#q-module');
var qQ = $('#q-q');
var qChoices = function(){ return $$('.q-choice').map(function(i){ return i.value; }).filter(Boolean); };
var qAnsMC = $('#q-answer-mc');
var qAnsText = $('#q-answer-text');
var qAlt = $('#q-alt');
var qExpl = $('#q-expl');
$('#q-add').addEventListener('click',function(){
  var t = qType.value; var mod = qModule.value; var text = (qQ.value||'').trim();
  if(!text){ alert('Enter a question.'); return; }
  var payload = { id: Math.random().toString(36).slice(2)+Date.now().toString(36), type:t, q:text };
  if(t==='mc'){
    var choices=qChoices(); var ans=(qAnsMC.value||'').trim();
    if(!ans||choices.indexOf(ans)<0){ alert('Correct option must match one of the choices.'); return; }
    payload.choices=choices; payload.answer=ans;
  } else {
    payload.answer=(qAnsText.value||'').trim();
    payload.altAnswers=(qAlt.value||'').split('|').map(function(s){ return s.trim(); }).filter(Boolean);
  }
  if((qExpl.value||'').trim()) payload.explanation = qExpl.value.trim();
  (bank.modules[mod] = bank.modules[mod] || []).push(payload);
  localStorage.setItem(LS_BANK, JSON.stringify(bank));
  refreshModuleLists(); alert('Added.');
  qQ.value=''; qAnsMC.value=''; qAnsText.value=''; qAlt.value=''; qExpl.value='';
  $$('.q-choice').forEach(function(i){ i.value=''; });
});

// Module change & controls
moduleSelect.addEventListener('change',function(){ moduleKey = moduleSelect.value; refreshKPI(); refreshModuleLists(); renderIdle(); });
$('#start').addEventListener('click', startQuiz);
$('#stop').addEventListener('click', stopQuiz);
$('#target').addEventListener('change',function(){ target = Math.max(1, Math.min(100, parseInt(targetInput.value||'10',10))); refreshKPI(); });

// Init
(async function init(){
  bank = await loadBank();
  moduleKey = Object.keys(bank.modules)[0];
  refreshModuleLists(); refreshKPI(); renderIdle(); updateHUD();
})();
