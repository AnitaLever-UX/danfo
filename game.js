/* DANFO — playable lane demo. Canvas pseudo-3D road, keyboard + touch, HUD, finish state. */
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$('#gameView'), cv=$('#game'), ctx=cv.getContext('2d');
const poster=$('#gameImg'), hud=$('#hud'), ov=$('#gOverlay'), btn=$('#demoBtn'), note=$('#demoNote');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const load=src=>{const i=new Image();i.src=src;return i;};
const bus=load('img/race/player.webp'), plate=load('img/race/plate.webp'), potImg=load('img/race/pot.png');
/* rivals from the game's race screen: name, sprite, colour swatch */
const RIV=[{n:'Chidi',img:load('img/race/red.webp'),c:'#E0362C'},{n:'Bayo',img:load('img/race/purple.webp'),c:'#B07CE8'},{n:'Tunde',img:load('img/race/green.webp'),c:'#1E8F4E'},{n:'LekkiFlash',img:load('img/race/blue.webp'),c:'#3C7DD9'},{n:'Amaka',img:load('img/race/cream.webp'),c:'#E8DCC0'}];
const PW=1344,PH=752; /* measured from the backdrop: where the road meets the bridge, how it angles toward the bottom right, how fast it widens */ /* plate size and its vanishing point */

const RACE_KM=14, RIVALS=5, MAXV=150, BOOSTV=200, CRUISE=95;
/* ---------- commentators: Lapo Baby (street, agbero) and Nepo Baby (soft life), Pidgin ---------- */
const NAMES=RIV.map(r=>r.n.toLowerCase());
const VO={ /* id: [speaker, text] — audio file audio/<id>.mp3 */
  start_n:['N','Welcome to Lagos G P, darlings. Six danfo, one bridge, and plenty soft life.'],
  start_l:['L','Oya! Engines don wake. Make una comot for road!'],
  go_l:['L','Ehen! Danfo don comot like say e owe person money!'],
  clean_n:['N','Clean overtake. Very, very clean.'],
  taken_n:['N','Ah, they took your place. Respond, my dear.'],
  lead_l:['L','Na you be oga for road now!'],
  lead_n:['N','Leading the pack. This is soft life on the bridge.'],
  hit_l:['L','Ah ah! You wan kill person?'],
  hit2_l:['L','Wahala dey o!'],
  hit_n:['N','Oh dear. That one will cost you.'],
  pot_l:['L','Pothole o! Lagos road no dey smile!'],
  pot_n:['N','Mind the craters, darling.'],
  cone_l:['L','Cone don collect beating!'],
  coin_l:['L','Pick am! Money na money!'],
  coin_n:['N','Ka-ching. Coins in the bag.'],
  boost_l:['L','Fire am! Shoot am!'],
  boost_n:['N','Boost on. Fly, my dear.'],
  final_n:['N','Final stretch! The whole bridge is screaming!'],
  final_l:['L','Last last, na who sabi go win!'],
  win_l:['L','You don win! Lagos, shout am!'],
  win_n:['N','Champion of Lagos G P. Soft life unlocked.'],
  lose_n:['N','Good effort. Next time, we go again.'],
  lose_l:['L','No wahala, come back stronger!']
};
Object.assign(VO,{
  halfway_l:['L','Halfway don reach o! Who go carry first?'],long_l:['L','Road still long o, nobody should relax!'],
  bridge_l:['L','We don land the bridge! Hold your steering well well!'],hot_l:['L','Ehen! This race don hot!'],
  press_l:['L','Oya, press am! No dull yourself!'],front_l:['L','You dey front now, no look back!'],
  mid_l:['L','You dey for middle, push am small!'],back_l:['L','You dey back o! Chase dem, chase dem!'],
  km5_l:['L','Five kilometre remain o!'],km1_l:['L','Last one kilometre! Na now o!'],
  crowd_l:['L','You hear the crowd? Lagos dey shout!'],who_l:['L','Who go win? Na the person wey sabi road!'],
  traffic_l:['L','See traffic! Danfo dey find road!']});
RIV.forEach((r,i)=>{VO['lead_'+NAMES[i]]=['L',`${r.n} dey lead the race o!`];});
RIV.forEach((r,i)=>{VO['pass_'+NAMES[i]]=['L',`You don pass ${r.n}! ${r.n}, you dey sleep?`];VO['passed_'+NAMES[i]]=['L',`${r.n} don fly pass you o! Wake up!`];});
const WHO={L:'LAPO BABY',N:'NEPO BABY'};
const clips={}; let voiceBusy=0, lastSpeak=0, muted=false;
try{muted=localStorage.getItem('danfo_mute')==='1';}catch(e){}
function clip(id){if(!clips[id]){const a=new Audio('audio/'+id+'.mp3');a.preload='auto';clips[id]=a;}return clips[id];}
/* priority: 2 = always speak (interrupts), 1 = speak if free, 0 = only if quiet for a while */
function speak(ids,prio=1){
  const id=Array.isArray(ids)?ids[Math.floor(Math.random()*ids.length)]:ids, v=VO[id]; if(!v)return;
  const now=performance.now();
  if(prio<2&&now<voiceBusy)return; if(prio===0&&now-lastSpeak<4000)return;
  Object.values(clips).forEach(a=>{if(!a.paused){a.pause();a.currentTime=0;}});
  showLine(v[1],WHO[v[0]]);
  lastSpeak=now; voiceBusy=now+Math.max(1600,v[1].length*55);
  if(!muted){const a=clip(id);a.volume=1;a.currentTime=0;a.play().then(()=>{duck(.35);}).catch(()=>{});a.onended=()=>{voiceBusy=0;duck(1);};}
}
let lineTimer=0;
function showLine(t,who){const el=$('#gLine');el.dataset.who=who||'LAPO BABY';el.textContent='“'+t+'”';el.classList.add('on');clearTimeout(lineTimer);lineTimer=setTimeout(()=>el.classList.remove('on'),Math.max(1800,t.length*60));}

/* ---------- sound: engine, crowd bed and cheers, effects (Web Audio, no files) ---------- */
let AC=null, master, eng, engF, engG, crowdG, crowdL, crowdR, duckG;
function audioInit(){
  if(AC)return; const C=window.AudioContext||window.webkitAudioContext; if(!C)return;
  AC=new C(); master=AC.createGain(); master.gain.value=muted?0:.9; master.connect(AC.destination);
  duckG=AC.createGain(); duckG.connect(master);
  // engine: two detuned saws through a low-pass
  engF=AC.createBiquadFilter(); engF.type='lowpass'; engF.frequency.value=600; engG=AC.createGain(); engG.gain.value=0;
  eng=[AC.createOscillator(),AC.createOscillator()]; eng[0].type='sawtooth'; eng[1].type='square'; eng[1].detune.value=-1200;
  eng.forEach(o=>{o.frequency.value=40;o.connect(engF);o.start();}); engF.connect(engG); engG.connect(duckG);
  // crowd bed: looping noise shaped into a stadium murmur, one per stand
  const len=AC.sampleRate*2, buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
  let b0=0,b1=0,b2=0; for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=.997*b0+w*.03;b1=.985*b1+w*.06;b2=.95*b2+w*.15;d[i]=(b0+b1+b2)*.5;}
  const mk=pan=>{const src=AC.createBufferSource();src.buffer=buf;src.loop=true;src.playbackRate.value=.9+Math.random()*.2;
    const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=900;bp.Q.value=.5;
    const g=AC.createGain();g.gain.value=.05;const pn=AC.createStereoPanner?AC.createStereoPanner():null;
    src.connect(bp);bp.connect(g);if(pn){pn.pan.value=pan;g.connect(pn);pn.connect(duckG);}else g.connect(duckG);src.start();return g;};
  crowdL=mk(-.7); crowdR=mk(.7);
}
function duck(v){if(AC)duckG.gain.setTargetAtTime(v,AC.currentTime,.08);}
function setMute(m){muted=m;try{localStorage.setItem('danfo_mute',m?'1':'0');}catch(e){}if(AC)master.gain.setTargetAtTime(m?0:.9,AC.currentTime,.05);if(m)Object.values(clips).forEach(a=>a.pause());const b=$('#gMute');if(b){b.setAttribute('aria-pressed',m);b.setAttribute('aria-label',m?'Turn sound on':'Turn sound off');}}
function crowdSwell(side,amt,len=2.2){ if(!AC)return; const t=AC.currentTime;
  (side==='L'?[crowdL]:side==='R'?[crowdR]:[crowdL,crowdR]).forEach(g=>{g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(.05+.32*amt,t,.12);g.gain.setTargetAtTime(.05,t+len*.5,len*.35);});
  // a few whistles and "whoo"s
  for(let k=0;k<Math.round(2+amt*4);k++){const o=AC.createOscillator(),g=AC.createGain(),st=t+Math.random()*len*.6;o.type='sine';const f=900+Math.random()*1400;o.frequency.setValueAtTime(f,st);o.frequency.exponentialRampToValueAtTime(f*(Math.random()<.5?1.6:.6),st+.35);g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(.025*amt,st+.05);g.gain.linearRampToValueAtTime(0,st+.4);
    let n=g; if(AC.createStereoPanner){const pn=AC.createStereoPanner();pn.pan.value=side==='L'?-.6:side==='R'?.6:(Math.random()-.5);g.connect(pn);n=pn;} o.connect(g);n.connect(duckG);o.start(st);o.stop(st+.45);}
}
function groan(){ if(!AC)return; const t=AC.currentTime; [crowdL,crowdR].forEach(g=>{g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(.16,t,.1);g.gain.setTargetAtTime(.05,t+.8,.5);}); }
function blip(f1,f2,dur,type='sine',vol=.08){ if(!AC)return; const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(duckG);o.start(t);o.stop(t+dur+.02); }
function thud(vol=.5){ if(!AC)return; const t=AC.currentTime,len=.35,b=AC.createBuffer(1,AC.sampleRate*len,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=320;const g=AC.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(duckG);s.start(t);blip(110,40,.3,'sine',vol*.6); }
function engineTick(){ if(!AC)return; const t=AC.currentTime, on=running&&!paused&&!(S&&S.done); const v=S?S.v:0;
  eng[0].frequency.setTargetAtTime(38+v*.75+(S&&S.boosting>0?18:0),t,.08); eng[1].frequency.setTargetAtTime(38+v*.75,t,.08);
  engF.frequency.setTargetAtTime(380+v*7,t,.1); engG.gain.setTargetAtTime(on?.045+v*.00025:0,t,.15); }

$('#gMute').addEventListener('click',()=>{audioInit();setMute(!muted);cv.focus({preventScroll:true});}); setMute(muted);
/* ---------- crowd reactions on screen: each stand cheers for its racer ---------- */
const CROWD={L:{ex:.15,c:'#FFD400',chant:'',ct:0},R:{ex:.15,c:'#E8DCC0',chant:'',ct:0}};
const FLAGS={L:[[70,292],[180,288],[300,282],[420,276],[540,270]],R:[[800,265],[900,270],[1020,278],[1140,284],[1270,290]]};
const FLAGC=['#E0362C','#B07CE8','#1E8F4E','#3C7DD9','#E8DCC0'];
function cheer(side,amt,chant,color){
  (side==='both'?['L','R']:[side]).forEach(k=>{const c=CROWD[k];c.ex=Math.max(c.ex,amt);if(chant){c.chant=chant;c.ct=2.2;}if(color)c.c=color;});
  crowdSwell(side==='both'?'B':side,amt);
}

let W=0,H=0,dpr=1,running=false,paused=false,raf=0,last=0;
let S; // game state
function reset(){
  S={t:0,dist:0,v:0,lane:1,laneX:1,coins:0,boost:1,boosting:0,brake:false,obs:[],spawn:0,dash:0,shake:0,flash:0,hitCool:0,
     rivals:Array.from({length:RIVALS},(_,i)=>({d:.02+i*.015,v:96+i*8+Math.random()*5})),pos:RIVALS+1,wasFirst:false,done:false,countdown:3.2,lineT:0,
     rush:0};
}
function size(){
  const r=view.getBoundingClientRect(); dpr=Math.min(2,devicePixelRatio||1);
  W=r.width; H=r.height; cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); geom();
}
/* plate is cover-fitted with its vanishing point kept near the centre; lanes converge on it */
let K=1,OX=0,OY=0,VX=0,VY=0,LF=.4,BS=.7;
/* the road in the backdrop, measured row by row: [picture y, centre x, half-width]. It runs toward the bottom right
   and bends left at the far end where it meets the bridge, so the lanes are built from this, not drawn straight. */
const ROAD=[[252,626,2],[258,646,8],[264,662,18],[272,669,36],[282,671,58],[292,677,80],[322,694,135],[352,711,191],[382,722,245],[412,734,301],[442,748,352],[472,766,411],[502,786,476],[532,804,539]];
function road(yp){
  if(yp<=ROAD[0][0])return [ROAD[0][1],ROAD[0][2]];
  for(let k=1;k<ROAD.length;k++){const a=ROAD[k-1],b=ROAD[k];if(yp<=b[0]){const t=(yp-a[0])/(b[0]-a[0]),e=t*t*(3-2*t)*.35+t*.65;return [a[1]+(b[1]-a[1])*e,a[2]+(b[2]-a[2])*t];}}
  const L=ROAD[ROAD.length-1],d=yp-L[0];return [L[1]+d*.6,L[2]+d*2.1];
}
function geom(){
  const tl=H>W*.9, pP=tl?.62:.84;
  const K0=Math.max(W/PW,H/PH); K=K0*(tl?1:1.18);
  OY=(H-PH*K)*(tl?.5:.3); VY=OY+ROAD[0][0]*K;
  const ypP=(VY+(H-VY)*pP-OY)/K;
  OX=Math.min(0,Math.max(W-PW*K,W/2-road(ypP)[0]*K)); VX=OX+ROAD[0][1]*K;   /* the road's centre at the player's depth sits mid-screen */
  LF=tl?.30:.40; BS=tl?.8:.72;
}
const HZ=()=>VY;
const yAt=p=>VY+(H-VY)*p;
const rAt=p=>road((yAt(p)-OY)/K);
const xAt=(l,p)=>{const r=rAt(p);return OX+r[0]*K+(l-1)*LF*r[1]*K;};   /* every lane follows the road, bend included */
const LW=p=>LF*rAt(p)[1]*K;                                              /* one lane's width at that distance */

/* ---------- input ---------- */
const keys={};
function onKey(e,down){
  if(!running)return;
  const k=e.key.toLowerCase();
  const map={a:'L',arrowleft:'L',d:'R',arrowright:'R',s:'B',arrowdown:'B',' ':'X',escape:'P',p:'P',m:'M'};
  const m=map[k]; if(!m)return;
  e.preventDefault();
  if(down&&!keys[m]){
    if(m==='L')move(-1); if(m==='R')move(1); if(m==='X')doBoost(); if(m==='P')togglePause(); if(m==='M')setMute(!muted);
  }
  keys[m]=down; if(m==='B')S.brake=down;
  lightKeys();
}
addEventListener('keydown',e=>onKey(e,true)); addEventListener('keyup',e=>onKey(e,false));
function lightKeys(){
  const act=keys.L||keys.R?'lane':keys.B?'brake':(S&&S.boosting>0)?'boost':null;
  $$('#keys .krow').forEach(r=>{const on=r.dataset.k===act;r.classList.toggle('on',on);r.querySelectorAll('kbd').forEach(x=>x.classList.toggle('on',on));});
}
function move(d){if(S.countdown>0||S.done||paused)return;S.lane=Math.max(0,Math.min(2,S.lane+d));}
function doBoost(){if(S.countdown>0||S.done||paused)return;if(S.boost>=.34&&S.boosting<=0){S.boost-=.34;S.boosting=1.4;speak('boost_n',0);blip(200,900,.5,'sawtooth',.05);}}
/* touch controls + swipe */
$$('#touch [data-t]').forEach(b=>{
  const t=b.dataset.t;
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(t==='L')move(-1);if(t==='R')move(1);if(t==='X')doBoost();if(t==='B')S.brake=true;});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>{if(t==='B')S.brake=false;}));
});
let sx=null;
cv.addEventListener('pointerdown',e=>{sx=e.clientX;});
cv.addEventListener('pointerup',e=>{if(sx===null)return;const dx=e.clientX-sx;if(Math.abs(dx)>30)move(dx>0?1:-1);sx=null;});

/* ---------- start / stop / pause ---------- */
const touchEl=$('#touch'), coarse=matchMedia('(pointer:coarse)').matches; if(coarse)$('#frame').after(touchEl);
function start(){
  reset(); running=true; paused=false;
  audioInit(); if(AC&&AC.state==='suspended')AC.resume(); Object.keys(VO).forEach(clip);
  setTimeout(()=>{if(running&&S.countdown>2)speak('start_n',2);},250); setTimeout(()=>{if(running&&S.countdown>.4)speak('start_l',2);},2000);
  cheer('both',.5);
  if(coarse)touchEl.classList.add('show');
  view.classList.add('playing'); poster.style.visibility='hidden'; cv.hidden=false; hud.hidden=false;
  btn.querySelector('span').textContent='EXIT DEMO'; note.textContent='A / D or arrows change lane · S brakes · Space boosts · Esc pauses';
  size(); ov.innerHTML=''; ov.hidden=true; last=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  view.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
  cv.focus({preventScroll:true});
}
function stop(){
  touchEl.classList.remove('show');
  running=false; cancelAnimationFrame(raf); view.classList.remove('playing');
  poster.style.visibility=''; cv.hidden=true; hud.hidden=true; ov.hidden=true;
  btn.querySelector('span').textContent='TRY THE DEMO'; note.textContent='';
  Object.keys(keys).forEach(k=>keys[k]=false); lightKeys();
  Object.values(clips).forEach(a=>a.pause()); engineTick();
}
function togglePause(force){
  if(!running||S.done)return;
  paused=force!==undefined?force:!paused;
  if(paused){Object.values(clips).forEach(a=>a.pause());panel('Paused','Scroll back or press resume to keep racing.',[['RESUME',()=>togglePause(false)],['EXIT',stop]]);}
  else{ov.hidden=true;last=performance.now();cv.focus({preventScroll:true});}
}
btn.addEventListener('click',()=>running?stop():start());
new IntersectionObserver(es=>es.forEach(e=>{if(running&&!e.isIntersecting&&!paused&&!S.done)togglePause(true);}),{threshold:.35}).observe(view);
addEventListener('resize',()=>{if(running)size();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!S.done)togglePause(true);});

function panel(title,body,btns,stats){
  ov.hidden=false;
  ov.innerHTML=`<div class="gpanel"><h3>${title}</h3>${stats?`<div class="gstats">${stats.map(s=>`<div><small>${s[0]}</small><b>${s[1]}</b></div>`).join('')}</div>`:''}<p>${body}</p><div class="gbtns"></div></div>`;
  const box=ov.querySelector('.gbtns');
  btns.forEach(([l,fn],i)=>{const b=document.createElement('button');b.type='button';b.className=i===0?'btn small-btn':'gbtn2';b.textContent=l;b.addEventListener('click',fn);box.appendChild(b);});
  box.querySelector('button').focus({preventScroll:true});
}

/* ---------- loop ---------- */
function loop(now){
  raf=requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-last)/1000); last=now;
  if(!paused)update(dt);
  engineTick();
  draw();
}
function update(dt){
  if(S.done)return;
  if(S.countdown>0){
    const before=Math.ceil(S.countdown); S.countdown-=dt; const after=Math.ceil(S.countdown);
    if(after!==before&&after>0)blip(520,520,.18,'square',.06);
    if(S.countdown<=0){speak('go_l',2);blip(1040,1040,.4,'square',.07);cheer('both',.9);}
    S.cd=after>0?String(after):(S.countdown>-.6?'GO':'');
    return;
  }
  S.cd=S.countdown>-.6?'GO':''; S.countdown-=dt;
  S.t+=dt;
  // speed
  const target=S.brake?35:S.boosting>0?BOOSTV:MAXV;
  const acc=S.brake?-140:S.boosting>0?120:(S.v<CRUISE?70:28);
  S.v+=Math.sign(target-S.v)*Math.min(Math.abs(target-S.v),Math.abs(acc)*dt);
  if(S.boosting>0)S.boosting-=dt; else S.boost=Math.min(1,S.boost+dt*.06);
  S.laneX+=(S.lane-S.laneX)*Math.min(1,dt*12);
  const kmps=S.v/3600; S.dist+=kmps*dt*8; // demo time compression x8
  S.dash=(S.dash+S.v*dt*.012)%1; S.rush=(S.rush+S.v*dt*.006)%1;
  S.shake=Math.max(0,S.shake-dt*3); S.flash=Math.max(0,S.flash-dt*2.5); S.hitCool=Math.max(0,S.hitCool-dt);
  // rivals
  S.rivals.forEach(r=>{r.d+=r.v/3600*dt*8;});
  S.pos=1+S.rivals.filter(r=>r.d>S.dist).length;
  /* who passed whom: drives commentary, crowd and the on-screen rival */
  S.rivals.forEach((r,i)=>{const ahead=r.d>S.dist;if(r.ahead===undefined){r.ahead=ahead;return;}
    if(r.ahead&&!ahead){ /* you passed rival i */
      speak('pass_'+NAMES[i],1);
      cheer('L',.85,'DANFO 01!','#FFD400'); showRival(i,'behind');
    }else if(!r.ahead&&ahead){ /* rival i passed you */
      speak('passed_'+NAMES[i],1);
      cheer('R',.85,RIV[i].n.toUpperCase()+'!',RIV[i].c); showRival(i,'overtake');
    }
    r.ahead=ahead;});
  if(S.pos===1&&!S.wasFirst){S.wasFirst=true;speak('lead_l',2);cheer('L',1,'NO. 1!','#FFD400');cheer('R',.5);} if(S.pos>1)S.wasFirst=false;
  if(!S.finalCalled&&S.dist>RACE_KM-1.6){S.finalCalled=true;speak('final_l',2);cheer('both',.8);}
  /* LAPO RUNS THE RACE: milestones, then a running call whenever it has gone quiet, all the way to the finish */
  const once=(key,cond,id,pr=1)=>{if(!S['m_'+key]&&cond){S['m_'+key]=true;speak(id,pr);}};
  once('bridge',S.dist>1.2,'bridge_l');
  once('half',S.dist>RACE_KM/2,'halfway_l',2);
  once('km5',S.dist>RACE_KM-5,'km5_l',2);
  once('km1',S.dist>RACE_KM-1,'km1_l',2);
  const nowT=performance.now();
  if(nowT-lastSpeak>5200&&nowT>voiceBusy&&!S.finalCalled){
    const lead=S.rivals.reduce((a,b)=>a.d>b.d?a:b), li=S.rivals.indexOf(lead);
    const opts=[];
    if(S.pos>1&&S.lastLeader!==li)opts.push('lead_'+NAMES[li],'lead_'+NAMES[li]);
    opts.push(S.pos===1?'front_l':S.pos<=3?'mid_l':'back_l');
    opts.push('hot_l','press_l','crowd_l','who_l');
    if(S.dist<RACE_KM/2)opts.push('long_l');
    if(S.obs.some(o=>o.type==='car'&&o.p>.15&&o.p<.7))opts.push('traffic_l');
    const fresh=opts.filter(o=>!(S.recent||[]).includes(o)), pick=(fresh.length?fresh:opts)[Math.floor(Math.random()*(fresh.length?fresh:opts).length)];
    S.recent=[pick,...(S.recent||[])].slice(0,4); if(pick.startsWith('lead_'))S.lastLeader=li;
    speak(pick,1);
  }
  ['L','R'].forEach(k=>{const c=CROWD[k];c.ex=Math.max(.15,c.ex-dt*.35);c.ct=Math.max(0,c.ct-dt);});
  // spawn
  S.spawn-=dt*(S.v/100);
  if(S.spawn<=0&&S.obs.filter(o=>o.type==='car').length>=3)S.spawn=.4;
  if(S.spawn<=0){
    const r=Math.random(), lane=Math.floor(Math.random()*3);
    const type=r<.36?'car':r<.6?'coin':r<.86?'pot':'cone';
    const onRoad=new Set(S.obs.filter(o=>o.type==='car').map(o=>o.r));
    const rv=()=>{const free=RIV.map((_,i)=>i).filter(i=>!onRoad.has(i));const r=free.length?free[Math.floor(Math.random()*free.length)]:Math.floor(Math.random()*RIV.length);onRoad.add(r);return r;};
    const laneFree=(l,lo,hi)=>!S.obs.some(o=>o.type==='car'&&Math.round(o.lx)===l&&o.p>lo&&o.p<hi);
    const car=(l,p,v,r)=>({type:'car',lane:l,lx:l,p,v,r,hit:false,id:Math.random()*9,brake:0});
    if(type==='coin'){for(let k=0;k<3;k++)S.obs.push({type,lane,p:.02-k*.05,hit:false});}
    else if(type==='car'){
      const r0=rv();
      if(Math.random()<.35&&S.v>60){ /* a rival overtakes you from behind in another lane */
        const others=[0,1,2].filter(l=>l!==S.lane), l=others[Math.floor(Math.random()*others.length)];
        if(laneFree(l,.7,1.3))S.obs.push(car(l,1.0,S.v+30+Math.random()*25,r0));
      }else{
        if(laneFree(lane,-.05,.25))S.obs.push(car(lane,.015,70+Math.random()*45,r0));
        const l2=(lane+1+Math.floor(Math.random()*2))%3;
        if(Math.random()<.3&&laneFree(l2,-.05,.25))S.obs.push(car(l2,.005,70+Math.random()*45,rv()));
      }
    }
    else S.obs.push({type,lane,p:.01,hit:false});
    S.spawn=.55+Math.random()*.55;
  }
  // move obstacles (cars move slower than you)
  S.obs.forEach(o=>{
    if(o.type==='car'){
      /* rivals drive at their own speed: you close in, they pull away, or they overtake you */
      /* don't drive through the car in front: slow to its speed */
      const ahead=S.obs.find(q=>q!==o&&q.type==='car'&&(q.lane===o.lane||Math.round(q.lx)===o.lane)&&q.p<o.p&&o.p-q.p<.24);
      const ov=ahead?Math.min(o.v,ahead.v):o.v;
      const rel=(S.v-ov)/100;
      o.p+=dt*rel*(.22+o.p*o.p*1.3);
      o.brake=Math.max(0,o.brake-dt);
      if(Math.random()<dt*.12)o.brake=.8;
      if(o.p>.15&&o.p<.7&&Math.random()<dt*.08){const nl=o.lane+(Math.random()<.5?-1:1);if(nl>=0&&nl<=2&&!S.obs.some(q=>q!==o&&q.type==='car'&&q.lane===nl&&Math.abs(q.p-o.p)<.12))o.lane=nl;}
      o.lx+=(o.lane-o.lx)*Math.min(1,dt*3);
      if(ahead&&o.p-ahead.p<.16)o.p=ahead.p+.16;
    }else o.p+=dt*(S.v/100)*(.18+o.p*o.p*1.3);
  });
  // collisions
  const PZ=H>W*.9?.62:.84;
  S.obs.forEach(o=>{
    if(o.hit||o.p<PZ-.05||o.p>PZ+.07)return;
    if(Math.abs((o.type==='car'?o.lx:o.lane)-S.laneX)>.45)return;
    o.hit=true;
    if(o.type==='coin'){S.coins+=50;sparkle();pops.push({t:0,txt:'+50'});coinPulse();blip(1300,2100,.18,'triangle',.06);(performance.now()-(S.coinVoT||0)>6000)&&(S.coinVoT=performance.now(),speak('coin_n',1));return;}
    if(S.hitCool>0)return; S.hitCool=.6;
    if(o.type==='pot'){S.v*=.72;S.shake=.6;thud(.35);speak('pot_l',1);groan();}
    else if(o.type==='cone'){S.v*=.62;S.shake=.7;thud(.3);blip(700,300,.15,'square',.05);speak('cone_l',1);}
    else{S.v*=.45;S.shake=1;S.flash=1;S.boosting=0;thud(.7);speak(['hit_l','hit2_l'],2);groan();}
  });
  S.obs=S.obs.filter(o=>o.p<1.18&&o.p>-.03&&!(o.hit&&o.type==='coin'));
  // finish
  if(S.dist>=RACE_KM){S.done=true;finish();}
  updateHud();
}
/* put the rival you just passed (or who just passed you) on screen */
function showRival(i,mode){
  if(S.obs.some(o=>o.type==='car'&&o.r===i))return;
  const p0=mode==='overtake'?1.0:.6;
  const others=[0,1,2].filter(l=>l!==S.lane&&!S.obs.some(o=>o.type==='car'&&Math.round(o.lx)===l&&Math.abs(o.p-p0)<.3));
  if(!others.length)return; const l=others[Math.floor(Math.random()*others.length)];
  if(mode==='overtake')S.obs.push({type:'car',lane:l,lx:l,p:1.0,v:S.v+35,r:i,hit:false,id:Math.random()*9,brake:0});
  else S.obs.push({type:'car',lane:l,lx:l,p:.6,v:Math.max(40,S.v-45),r:i,hit:false,id:Math.random()*9,brake:0});
}
let sparks=[];
function sparkle(){for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,sp=60+Math.random()*180;sparks.push({x:0,y:0,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,l:.7+Math.random()*.3,s:2+Math.random()*3});}}
let pops=[];
function coinPulse(){const el=$('#hCoins');if(!el||!window.gsap||reduce)return;gsap.fromTo(el.parentElement,{scale:1.35,color:'#FFD400'},{scale:1,color:'#F5F6F7',duration:.45,ease:'back.out(2)'});}
function finish(){
  const time=S.t, pos=S.pos;
  let best=bestT; if(!best||time<best){bestT=time;try{localStorage.setItem('danfo_best',time.toFixed(3));}catch(e){}}
  const place=['1st','2nd','3rd','4th','5th','6th'][pos-1];
  if(pos===1){speak('win_l',2);cheer('both',1,'CHAMPION!','#FFD400');}else{speak('lose_l',2);cheer('R',.8,RIV[S.rivals.indexOf(S.rivals.reduce((a,b)=>a.d>b.d?a:b))].n.toUpperCase()+' WINS!',RIV[S.rivals.indexOf(S.rivals.reduce((a,b)=>a.d>b.d?a:b))].c);}
  setTimeout(()=>panel(pos===1?'You won!':'Finish!',pos===1?'Na you run Lagos GP today. Sign up to race real players.':'Good run. Dodge more traffic and save your boost for the last stretch.',[['RACE AGAIN',start],['EXIT',stop]],[['PLACE',place],['TIME',fmt(time)],['COINS',S.coins],['BEST',best&&best<time?fmt(best):fmt(time)]]),500);
}
const fmt=s=>{const m=Math.floor(s/60),r=(s%60).toFixed(1);return m+':'+(r<10?'0':'')+r;};
const mmPath=$('#hMapPath'), mmDot=$('#hMapDot'), gArc=$('#hGauge');
let mmLen=0; try{mmLen=mmPath.getTotalLength();}catch(e){}
let bestT=null; try{bestT=+localStorage.getItem('danfo_best')||null;}catch(e){}
const fmtT=s=>{const m=Math.floor(s/60),r=s%60;return String(m).padStart(2,'0')+':'+r.toFixed(3).padStart(6,'0');};
function updateHud(){
  $('#hPos').textContent=S.pos; $('#hCoins').textContent=S.coins;
  $('#hSpeed').textContent=Math.round(S.v);
  $('#hGear').textContent='GEAR '+Math.max(1,Math.min(6,Math.ceil(S.v/34)));
  $('#hKm').textContent=Math.min(RACE_KM,S.dist).toFixed(1);
  $('#hTime').textContent=fmtT(S.t);
  $('#hBest').textContent=bestT?fmtT(bestT):'--:--.---';
  if(gArc)gArc.style.strokeDashoffset=String(100-Math.min(100,S.v/BOOSTV*100));
  $('#hBoost').style.width=(S.boost*100)+'%';
  $('#hBoostWrap').classList.toggle('on',S.boosting>0);
  if(mmLen){const pt=mmPath.getPointAtLength(mmLen*Math.min(1,S.dist/RACE_KM));mmDot.setAttribute('cx',pt.x);mmDot.setAttribute('cy',pt.y);}
  /* standings */
  const list=[{n:'You',c:'#FFD400',d:S.dist,me:true},...S.rivals.map((r,i)=>({n:RIV[i].n,c:RIV[i].c,d:r.d}))].sort((a,b)=>b.d-a.d);
  $('#hStand').innerHTML=list.map((r,i)=>`<div class="ps${r.me?' me':''}"><span class="pn">${i+1}</span><span class="sw" style="background:${r.c}"></span>${r.n}</div>`).join('');
}
/* ---------- draw ---------- */
function sprite(img,cx,by,w){if(!img.complete||!img.naturalWidth)return 0;const h=w*img.naturalHeight/img.naturalWidth;ctx.drawImage(img,cx-w/2,by-h,w,h);return h;}
/* the stands bounce, flags wave and chants rise when a stand's racer does something */
const lerp=(a,b,t)=>a+(b-a)*t;
const band={L:x=>[lerp(290,262,x/610),lerp(432,282,x/610)],R:x=>[lerp(258,293,(x-730)/614),lerp(272,407,(x-730)/614)]};
function drawCrowd(){
  if(reduce)return;
  const t=S.t+performance.now()/1000*.0001;
  for(const k of ['L','R']){
    const c=CROWD[k], x0=k==='L'?0:730, x1=k==='L'?610:1344, step=5;
    for(let x=x0;x<x1;x+=step){
      const [yt,yb]=band[k](x), hgt=yb-yt+10, near=(yb-yt)/140;
      const dy=c.ex*(1.5+5*near)*Math.abs(Math.sin(performance.now()/1000*(9+c.ex*6)+x*.21));
      if(dy<.3)continue;
      ctx.drawImage(plate,x,yt-10,step+.6,hgt,OX+x*K,OY+(yt-10)*K-dy*K,(step+.6)*K,hgt*K);
    }
    // flags on poles above the heads
    FLAGS[k].forEach(([fx,fy],n)=>{
      const [yt,yb]=band[k](fx), sc=Math.max(.8,(yb-yt)/70)*K, col=k==='L'?'#FFD400':(c.c&&c.ct>0?c.c:FLAGC[n%FLAGC.length]);
      const X=OX+fx*K, Y=OY+fy*K - c.ex*6*sc*Math.abs(Math.sin(performance.now()/180+n));
      const ph=32*sc, fw=22*sc, fh=14*sc, wave=Math.sin(performance.now()/(120-c.ex*60)+n)*(2+c.ex*5)*sc;
      ctx.strokeStyle='rgba(20,20,20,.85)';ctx.lineWidth=Math.max(1,1.4*sc);ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(X,Y-ph);ctx.stroke();
      ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(X,Y-ph);ctx.quadraticCurveTo(X+fw*.5,Y-ph-wave,X+fw,Y-ph+wave*.4);ctx.lineTo(X+fw,Y-ph+fh+wave*.4);ctx.quadraticCurveTo(X+fw*.5,Y-ph+fh-wave,X,Y-ph+fh);ctx.closePath();ctx.fill();
      if(k==='L'){ctx.fillStyle='#080A0D';ctx.font=`800 ${Math.max(6,8*sc)}px Inter, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('01',X+fw*.5,Y-ph+fh*.5);}
    });
    // chant rising from the stand
    if(c.ct>0&&c.chant){
      const a=Math.min(1,c.ct/.6), rise=(2.2-c.ct)*14, fs=Math.max(14,Math.min(30,W*.03));
      ctx.font=`italic 800 ${fs}px 'Barlow Condensed', Impact, sans-serif`;
      const txt=c.chant.length>8?c.chant:c.chant+' '+c.chant, tw=ctx.measureText(txt).width, pad=W*.02+tw/2, rEdge=W>600?W*.77:W;
      const cxp=Math.min(rEdge-pad,Math.max(pad,k==='L'?OX+300*K:OX+1030*K)), cyp=OY+(k==='L'?330:300)*K-rise;
      ctx.globalAlpha=a;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=4;ctx.strokeStyle='rgba(8,10,13,.85)';ctx.strokeText(txt,cxp,cyp);ctx.fillStyle=c.c;ctx.fillText(txt,cxp,cyp);ctx.globalAlpha=1;
    }
  }
}
function draw(){
  ctx.save();
  if(S.shake>0&&!reduce)ctx.translate((Math.random()-.5)*8*S.shake,(Math.random()-.5)*6*S.shake);
  const bobC=reduce?0:Math.sin(S.t*9)*Math.min(1.2,S.v/120);
  ctx.translate(0,bobC);
  // Lagos GP plate: bridge, skyline, crowds, LAGOS GP barriers and kerbs
  if(plate.complete&&plate.naturalWidth){
    ctx.drawImage(plate,OX,OY-2,PW*K,PH*K+4);
    drawCrowd();
    // forward rush: the ground below the horizon streams outwards from the vanishing point
    const sp=Math.min(1,S.v/150);
    if(sp>.05&&!reduce){
      ctx.save();ctx.beginPath();ctx.rect(0,VY+4,W,H);ctx.clip();
      for(const ph of [S.rush,(S.rush+.5)%1]){
        const sc=1+.09*ph;ctx.globalAlpha=.32*sp*Math.sin(Math.PI*ph);
        ctx.drawImage(plate,VX-(VX-OX)*sc,VY-(VY-OY)*sc,PW*K*sc,PH*K*sc);
      }
      ctx.restore();ctx.globalAlpha=1;
    }
  }else{ctx.fillStyle='#1A2027';ctx.fillRect(0,0,W,H);}
  // lane dashes
  ctx.fillStyle='rgba(236,236,228,.78)';
  for(let k=0;k<12;k++){
    const a=((k/12+S.dash)%1), p1=a*a, p2=Math.min(1.15,(a+.03)*(a+.03));
    [.5,1.5].forEach(l=>{
      const x1=xAt(l,p1), x2=xAt(l,p2), w1=LW(p1)*.02+.4, w2=LW(p2)*.02+.4;
      ctx.beginPath();ctx.moveTo(x1-w1,yAt(p1));ctx.lineTo(x1+w1,yAt(p1));ctx.lineTo(x2+w2,yAt(p2));ctx.lineTo(x2-w2,yAt(p2));ctx.fill();
    });
  }
  // road objects, far to near (objects nearer than the player are drawn after it)
  const tallV=H>W*.9, pP=tallV?.62:.84, tags=new Set();
  const drawObj=o=>{ ctx.globalAlpha=Math.min(1,Math.max(0,o.p)/.16); try{ drawObj2(o); } finally{ ctx.globalAlpha=1; } };
  const drawObj2=o=>{
    if(o.p<0)return; const p=Math.min(o.p,1.15), y=yAt(p), x=xAt(o.lane,p);
    if(o.type==='car'){const R=RIV[o.r], w=LW(Math.min(p,1))*BS, cx=xAt(o.lx,p);
      const vib=reduce?0:Math.sin(S.t*22+o.id*3)*Math.max(.4,w*.006);
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(cx,y-w*.02,w*.55,w*.1,0,0,7);ctx.fill();
      ctx.save();ctx.translate(cx,y+vib);
      const h=sprite(R.img,0,0,w);
      /* brake lights */
      if(h&&o.brake>0){[-.4,.4].forEach(fx=>{const g=ctx.createRadialGradient(fx*w,-h*.38,1,fx*w,-h*.38,w*.16);g.addColorStop(0,'rgba(255,60,40,.9)');g.addColorStop(1,'rgba(255,40,30,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(fx*w,-h*.38,w*.16,0,7);ctx.fill();});}
      ctx.restore();
      if(h&&p>.12&&p<.72&&!tags.has(o.r)){tags.add(o.r);const fs=Math.max(9,Math.min(13,W*.013));ctx.font=`700 ${fs}px Inter, sans-serif`;const t=R.n.toUpperCase();const tw=ctx.measureText(t).width+12;
        ctx.fillStyle='rgba(17,21,26,.88)';rr(cx-tw/2,y-h-fs-10,tw,fs+7,4);ctx.fillStyle=R.c;ctx.fillRect(cx-tw/2,y-h-fs-10,3,fs+7);ctx.fillStyle='#F5F6F7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,cx+1,y-h-fs/2-6.5);}
    }
    else if(o.type==='pot'){const w=LW(p)*.62,h=w*.3;if(!o.shape)o.shape=Array.from({length:14},()=>.78+Math.random()*.3);
      const pts=o.shape.map((m,k)=>{const a=k/o.shape.length*Math.PI*2;return [x+Math.cos(a)*w/2*m,y-h/2+Math.sin(a)*h/2*m];});
      const path=()=>{ctx.beginPath();pts.forEach(([px2,py2],k)=>k?ctx.lineTo(px2,py2):ctx.moveTo(px2,py2));ctx.closePath();};
      ctx.save();ctx.translate(x,y-h/2);ctx.scale(1.18,1.25);ctx.translate(-x,-(y-h/2));path();ctx.fillStyle='rgba(120,112,100,.55)';ctx.fill();ctx.restore();   /* broken asphalt rim */
      path();const g=ctx.createRadialGradient(x,y-h*.6,1,x,y-h/2,w/2);g.addColorStop(0,'#020304');g.addColorStop(.7,'#0a0c0e');g.addColorStop(1,'#2a2724');ctx.fillStyle=g;ctx.fill();
      ctx.fillStyle='rgba(150,180,210,.18)';ctx.beginPath();ctx.ellipse(x-w*.08,y-h*.55,w*.22,h*.16,0,0,7);ctx.fill();   /* puddle shine */
      ctx.strokeStyle='rgba(20,20,20,.8)';ctx.lineWidth=Math.max(1,w*.015);ctx.beginPath();ctx.moveTo(x+w*.45,y-h*.4);ctx.lineTo(x+w*.62,y-h*.1);ctx.moveTo(x-w*.42,y-h*.7);ctx.lineTo(x-w*.6,y-h*.95);ctx.stroke();}
    else if(o.type==='cone'){const w=LW(p)*.16,h=w*1.5;ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x,y,w*.7,w*.18,0,0,7);ctx.fill();ctx.fillStyle='#E8742A';ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+w/2,y);ctx.lineTo(x-w/2,y);ctx.fill();ctx.fillStyle='#F5F6F7';ctx.fillRect(x-w*.28,y-h*.5,w*.56,h*.12);}
    else if(o.type==='coin'){const r=LW(p)*.11+1;ctx.fillStyle='rgba(255,212,0,.25)';ctx.beginPath();ctx.arc(x,y-r*2.4,r*1.6,0,7);ctx.fill();ctx.fillStyle='#E9C76A';ctx.beginPath();ctx.ellipse(x,y-r*2.4,r*Math.max(.15,Math.abs(Math.cos(S.t*5+o.lane))),r,0,0,7);ctx.fill();ctx.strokeStyle='#8B6B20';ctx.lineWidth=1.5;ctx.stroke();}
  };
  const sorted=[...S.obs].sort((a,b)=>a.p-b.p);
  sorted.filter(o=>o.p<=pP+.02).forEach(drawObj);
  // player: race danfo #01
  const tall=H>W*.9, p=tall?.62:.84, px=xAt(S.laneX,p), py=yAt(p)+H*.03, bw=LW(p)*BS*1.04;
  const bh=bus.naturalWidth?bw*bus.naturalHeight/bus.naturalWidth:bw*1.15;
  const bob=reduce?0:Math.sin(S.t*18)*Math.min(1.5,S.v/90);
  // yellow underglow (stronger on boost)
  const ug=S.boosting>0?.75:.38; const grd=ctx.createRadialGradient(px,py,2,px,py,bw*.7);grd.addColorStop(0,`rgba(255,212,0,${ug})`);grd.addColorStop(1,'rgba(255,212,0,0)');
  ctx.fillStyle=grd;ctx.beginPath();ctx.ellipse(px,py,bw*.7,bw*.16,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.ellipse(px,py-2,bw*.46,bw*.06,0,0,7);ctx.fill();
  const tilt=(S.lane-S.laneX)*.025;
  ctx.save();ctx.translate(px,py+bob);ctx.rotate(-tilt);
  if(bus.complete&&bus.naturalWidth)ctx.drawImage(bus,-bw/2,-bh,bw,bh); else{ctx.fillStyle='#FFD400';rr(-bw*.4,-bh,bw*.8,bh,6);}
  // brake lights
  const tl=S.brake?1:.3;
  [-.44,.42].forEach(fx=>{const g=ctx.createRadialGradient(fx*bw,-bh*.34,1,fx*bw,-bh*.34,bw*.13*(1+tl));g.addColorStop(0,`rgba(255,70,50,${.85*tl})`);g.addColorStop(1,'rgba(255,40,30,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(fx*bw,-bh*.34,bw*.13*(1+tl),0,7);ctx.fill();});
  ctx.restore();
  sorted.filter(o=>o.p>pP+.02).forEach(drawObj);
  if(S.boosting>0&&!reduce){ctx.strokeStyle='rgba(245,246,247,.35)';ctx.lineWidth=1.2;for(let k=0;k<10;k++){const a=Math.random()*W,yy=yAt(.45+Math.random()*.45);ctx.beginPath();ctx.moveTo(a,yy);ctx.lineTo(a+(a-VX)*.18,yy+(yy-VY)*.18);ctx.stroke();}}
  // sparks
  sparks.forEach(s=>{s.l-=1/60;s.x+=s.vx/60;s.y+=s.vy/60;s.vy+=4;const a=Math.max(0,Math.min(1,s.l*1.5)),z=(s.s||3)*(.6+a*.6),X=px+s.x,Y=py-bh*.9+s.y;
    ctx.fillStyle=`rgba(255,226,120,${a})`;ctx.beginPath();ctx.moveTo(X,Y-z*2);ctx.lineTo(X+z*.5,Y-z*.5);ctx.lineTo(X+z*2,Y);ctx.lineTo(X+z*.5,Y+z*.5);ctx.lineTo(X,Y+z*2);ctx.lineTo(X-z*.5,Y+z*.5);ctx.lineTo(X-z*2,Y);ctx.lineTo(X-z*.5,Y-z*.5);ctx.closePath();ctx.fill();});
  pops.forEach(pp=>{pp.t+=1/60;const a=Math.max(0,1-pp.t/1.1),fs=Math.round(Math.max(22,W*.045));ctx.save();ctx.globalAlpha=a;ctx.font=`italic 800 ${fs}px 'Barlow Condensed', Impact, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const Y=py-bh*1.05-pp.t*70;ctx.lineWidth=5;ctx.strokeStyle='rgba(8,10,13,.85)';ctx.strokeText(pp.txt,px,Y);ctx.fillStyle='#FFD400';ctx.fillText(pp.txt,px,Y);ctx.restore();});
  pops=pops.filter(pp=>pp.t<1.1);
  sparks=sparks.filter(s=>s.l>0);
  ctx.restore();
  // warm golden-hour grade + vignette
  const vg=ctx.createRadialGradient(W/2,H*.55,Math.min(W,H)*.35,W/2,H*.55,Math.max(W,H)*.75);vg.addColorStop(0,'rgba(8,10,13,0)');vg.addColorStop(1,'rgba(8,10,13,.45)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  if(S.flash>0){ctx.fillStyle=`rgba(229,72,77,${S.flash*.25})`;ctx.fillRect(0,0,W,H);}
  if(S.cd){ctx.fillStyle='rgba(8,10,13,.35)';ctx.fillRect(0,0,W,H);ctx.font=`italic 800 ${Math.round(H*.3)}px 'Barlow Condensed', Impact, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=S.cd==='GO'?'#FFD400':'#F5F6F7';ctx.fillText(S.cd,W/2,H*.42);}
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();}
})();
