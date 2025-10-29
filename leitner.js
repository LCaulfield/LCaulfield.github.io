// Progress schema (per module)
// prog = { [moduleKey]: { [qid]: { box:1..5, seen, correct, wrong, last, boost } } }
const LS_PROG = 'studyquiz/progress/v1';


function loadProgress(){ try{ const raw = JSON.parse(localStorage.getItem(LS_PROG)); return raw || {}; } catch { return {}; } }
function saveProgress(p){ localStorage.setItem(LS_PROG, JSON.stringify(p)); }


function recFor(prog, moduleKey, qid){ const m = prog[moduleKey] ||= {}; return m[qid] ||= { box:1, seen:0, correct:0, wrong:0, last:0 }; }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }


function computeWeight(rec){ const box = rec?.box ?? 1; const base = 6 - clamp(box,1,5); return Math.max(1, base + (rec?.boost?1:0)); }
function weightedPick(weights){ const total = weights.reduce((a,b)=>a+Math.max(0,b),0); if(total<=0) return Math.floor(Math.random()*weights.length); let r=Math.random()*total; for(let i=0;i<weights.length;i++){ r-=Math.max(0,weights[i]); if(r<=0) return i; } return weights.length-1; }


function chooseNextQuestion(bank, prog, moduleKey){
const qs = bank.modules[moduleKey] || [];
const w = qs.map(q => computeWeight( (prog[moduleKey]||{})[q.id] ));
const idx = weightedPick(w);
return qs[idx];
}


function updateProgress(prog, moduleKey, qid, correct){
const r = recFor(prog, moduleKey, qid);
r.seen++; r.last = Date.now();
if(correct){ r.correct++; r.box = clamp(r.box+1,1,5); r.boost = false; }
else { r.wrong++; r.box = 1; r.boost = true; }
}


function moduleStats(bank, prog, moduleKey){
const qs = bank.modules[moduleKey] || [];
const m = prog[moduleKey] || {};
let mastered=0, seen=0, ok=0, bad=0;
for(const q of qs){ const r=m[q.id]; if(r){ seen+=r.seen; ok+=r.correct; bad+=r.wrong; if((r.box||1)>=4) mastered++; }}
const masteryPct = qs.length? Math.round(mastered/qs.length*100) : 0;
return { total: qs.length, mastered, masteryPct, seen, ok, bad, acc: seen? Math.round(ok/seen*100)+'%' : '–' };
}