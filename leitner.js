// Progress schema (per module)
// prog = { [moduleKey]: { [qid]: { box:1..5, seen, correct, wrong, last, boost } } }
const LS_PROG = 'studyquiz/progress/v1';

function loadProgress(){
  try { var raw = JSON.parse(localStorage.getItem(LS_PROG)); return raw || {}; }
  catch(e){ return {}; }
}
function saveProgress(p){ localStorage.setItem(LS_PROG, JSON.stringify(p)); }

function ensureModule(prog, moduleKey){
  if(!prog[moduleKey]) prog[moduleKey] = {};
  return prog[moduleKey];
}
function ensureRec(prog, moduleKey, qid){
  var m = ensureModule(prog, moduleKey);
  if(!m[qid]) m[qid] = { box:1, seen:0, correct:0, wrong:0, last:0 };
  return m[qid];
}
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

function computeWeight(rec){
  var box = (rec && typeof rec.box !== 'undefined') ? rec.box : 1;
  var base = 6 - clamp(box,1,5);
  return Math.max(1, base + (rec && rec.boost ? 1 : 0));
}
function weightedPick(weights){
  var total = weights.reduce(function(a,b){ return a + Math.max(0,b); }, 0);
  if(total <= 0) return Math.floor(Math.random()*weights.length);
  var r = Math.random()*total;
  for(var i=0; i<weights.length; i++){
    r -= Math.max(0, weights[i]);
    if(r <= 0) return i;
  }
  return weights.length-1;
}

function chooseNextQuestion(bank, prog, moduleKey){
  var qs = (bank.modules[moduleKey] || []);
  var m = prog[moduleKey] || {};
  var w = qs.map(function(q){ return computeWeight(m[q.id]); });
  var idx = weightedPick(w);
  return qs[idx];
}

function updateProgress(prog, moduleKey, qid, correct){
  var r = ensureRec(prog, moduleKey, qid);
  r.seen++; r.last = Date.now();
  if(correct){ r.correct++; r.box = clamp(r.box+1,1,5); r.boost = false; }
  else { r.wrong++; r.box = 1; r.boost = true; }
}

function moduleStats(bank, prog, moduleKey){
  var qs = bank.modules[moduleKey] || [];
  var m = prog[moduleKey] || {};
  var mastered=0, seen=0, ok=0, bad=0;
  for(var i=0;i<qs.length;i++){
    var q = qs[i], r = m[q.id];
    if(r){
      seen+=r.seen; ok+=r.correct; bad+=r.wrong;
      if((r.box||1) >= 4) mastered++;
    }
  }
  var masteryPct = qs.length ? Math.round(mastered/qs.length*100) : 0;
  return { total: qs.length, mastered: mastered, masteryPct: masteryPct,
           seen: seen, ok: ok, bad: bad, acc: seen ? (Math.round(ok/seen*100)+'%') : '–' };
}

// Expose (same names the app expects)
window.loadProgress = loadProgress;
window.saveProgress = saveProgress;
window.chooseNextQuestion = chooseNextQuestion;
window.updateProgress = updateProgress;
window.moduleStats = moduleStats;
