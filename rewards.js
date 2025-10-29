// Session rewards — XP, streak, multiplier, hearts, daily quest
let xp=0, level=1, streak=0, mult=1.0, hearts=3, questXP=0;
function levelFor(x){ return Math.max(1, Math.floor(1 + Math.sqrt(x/200))); }
function updateHUD(){
document.querySelector('#hud-xp').textContent = xp;
document.querySelector('#hud-lvl').textContent = level;
document.querySelector('#hud-streak').textContent = streak;
document.querySelector('#hud-mult').textContent = mult.toFixed(1);
document.querySelector('#hud-hearts').textContent = hearts;
document.querySelector('#hud-quest').textContent = `${questXP}/100 XP`;
}
function resetSessionRewards(){ xp=0;level=1;streak=0;mult=1.0;hearts=3;questXP=0;updateHUD(); }
function awardXP(base){ const gained=Math.round(base*mult); xp+=gained; questXP+=gained; level=levelFor(xp); streak=Math.min(streak+1,20); mult=Math.min(1+streak*0.1,3.0); updateHUD(); }
function missPenalty(){ streak=0; mult=1.0; hearts=Math.max(0, hearts-1); updateHUD(); if(hearts===0){ alert('Out of hearts — session complete.'); window.stopQuiz && window.stopQuiz(); } }