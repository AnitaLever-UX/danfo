/* DANFO — rewards customisation: paint recolours the whole 360 viewer live; wheels and accessories show rendered parts; upgrades change stats. */
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const spin=$('#spin'); if(!spin)return;
const frames=$$('#spin .frames img:not(.variant)'), variant=$('#variant'), hint=$('#spinHint');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

const DATA={
  paint:{yellow:{n:'Danfo Yellow',d:'The classic. Every Lagos commuter knows this colour.',c:0,rgb:null},
         navy:{n:'Midnight Navy',d:'Deep blue gloss for night runs on Third Mainland.',c:600,rgb:[31,74,122]},
         green:{n:'Eko Green',d:'Proudly Lagos. Rich green with a clear-coat shine.',c:600,rgb:[31,122,72]},
         white:{n:'Pearl White',d:'Clean and bright. Shows off every stripe.',c:800,rgb:[233,230,223]},
         black:{n:'Matte Black',d:'Stealth finish. Quiet until the engine speaks.',c:900,rgb:[46,49,54]}},
  wheels:{stock:{n:'Stock steel',d:'Tough black steel wheels. Built for potholes.',c:0,img:null},
          chrome:{n:'Chrome five-spoke',d:'Polished alloys with low-profile tyres. Pure shine.',c:1200,img:'img/spin/w_chrome.webp'},
          gold:{n:'Gold mesh',d:'Antique gold mesh rims. The ultimate flex.',c:1800,img:'img/spin/w_gold.webp'}},
  acc:{none:{n:'No accessory',d:'Clean factory look.',c:0,img:null},
       rack:{n:'Roof rack',d:'Steel rack with strapped bags. Market-day ready.',c:700,img:'img/spin/a_rack.webp'},
       bullbar:{n:'Bull bar',d:'Heavy front guard with twin spotlights.',c:900,img:'img/spin/a_bullbar.webp'},
       lights:{n:'Roof lights',d:'Four LED pods above the windscreen. Own the night.',c:1100,img:'img/spin/a_lights.webp'}},
  up:{none:{n:'Stock engine',d:'Reliable, if a little tired.',c:0,s:[0,0,0]},
      engine:{n:'Engine tune',d:'+8 top speed. Overtake on the bridge.',c:1500,s:[8,0,0]},
      tyres:{n:'Grip tyres',d:'+10 handling. Corners like it is on rails.',c:1000,s:[0,10,0]},
      seats:{n:'Extra seats',d:'+5 passengers. More fares, more coins.',c:800,s:[0,0,5]}}
};
const BASE=[78,70,95];
const sel={paint:'yellow',wheels:'stock',acc:'none',up:'none'};
const owned=new Set(['paint:yellow','wheels:stock','acc:none','up:none']);
let coins=4500, focusCat='paint';

/* ---------- live paint recolour (yellow body pixels only, shading kept) ---------- */
const origSrc=new Map();
frames.forEach(f=>origSrc.set(f,f.getAttribute('src')));
function rgb2hsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,mx?d/mx:0,mx];}
function hsv2rgb(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;let r,g,b;if(h<60)[r,g,b]=[c,x,0];else if(h<120)[r,g,b]=[x,c,0];else if(h<180)[r,g,b]=[0,c,x];else if(h<240)[r,g,b]=[0,x,c];else if(h<300)[r,g,b]=[x,0,c];else[r,g,b]=[c,0,x];return [(r+m)*255,(g+m)*255,(b+m)*255];}
const cache=new Map();
let useFallback=false;
const FALLBACK={navy:'hue-rotate(165deg) saturate(.75) brightness(.72)',green:'hue-rotate(80deg) saturate(.9) brightness(.8)',white:'grayscale(1) brightness(1.35) contrast(.9)',black:'grayscale(1) brightness(.5) contrast(1.1)'};
const WHEELS=[[428,379,33],[288,363,25],[663,401,22]];
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function recolor(src,rgb,protect){
  const key=src+'|'+(rgb?rgb.join(','):'orig')+(protect?'|p':''); if(!rgb)return src; if(cache.has(key))return cache.get(key);
  const p=(async()=>{
    const im=await loadImg(src); const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
    const x=c.getContext('2d'); x.drawImage(im,0,0); let d; try{d=x.getImageData(0,0,c.width,c.height);}catch(e){return null;} const a=d.data;
    const [th,ts,tv]=rgb2hsv(rgb[0],rgb[1],rgb[2]);
    for(let k=0;k<a.length;k+=4){
      if(a[k+3]<10)continue;
      if(protect){const px=(k/4)%c.width,py=((k/4)/c.width)|0,sx=px*1000/c.width,sy=py*450/c.height;if(WHEELS.some(([cx,cy,rr])=>(sx-cx)**2+(sy-cy)**2<rr*rr))continue;}
      const r=a[k],g=a[k+1],b=a[k+2], mx=Math.max(r,g,b), mn=Math.min(r,g,b), v=mx/255, s=mx?(mx-mn)/mx:0;
      if(v<.2||mx===mn)continue;
      if(!(s>=.6||(s>=.15&&v>=.74)))continue;
      let h; const dd=mx-mn; if(mx===r)h=((g-b)/dd)%6; else if(mx===g)h=(b-r)/dd+2; else h=(r-g)/dd+4; h*=60; if(h<0)h+=360;
      if(h<30||h>70)continue;
      const o=hsv2rgb(th,ts*Math.min(1,s/.85),Math.min(1,v*tv/.9));
      a[k]=o[0];a[k+1]=o[1];a[k+2]=o[2];
    }
    x.putImageData(d,0,0);
    return await new Promise(r=>c.toBlob(bl=>r(URL.createObjectURL(bl)),'image/webp',.9));
  })();
  cache.set(key,p); return p;
}
let paintJob=0;
async function applyPaint(){
  const job=++paintJob, rgb=DATA.paint[sel.paint].rgb;
  const urls=await Promise.all(frames.map(f=>recolor(origSrc.get(f),rgb).catch(()=>null)));
  if(job!==paintJob)return;
  if(rgb&&urls.some(u=>!u)){frames.forEach(f=>{f.src=origSrc.get(f);f.style.filter=FALLBACK[sel.paint]||'';});variant.style.filter=FALLBACK[sel.paint]||'';useFallback=true;}
  else{useFallback=false;frames.forEach((f,i)=>{f.src=urls[i];f.style.filter='';});variant.style.filter='';}
  await showVariant();
}
/* the part preview: wheels or accessory, whichever was chosen last, in the front three-quarter view */
let lastPart=null, showBase=true;
const BASE_IMG='img/orig_rewards.webp';
async function showVariant(){
  const item=lastPart?DATA[lastPart][sel[lastPart]]:null;
  if(!item||!item.img){
    let u=useFallback?BASE_IMG:await recolor(BASE_IMG,DATA.paint[sel.paint].rgb,false).catch(()=>null);variant.src=u||BASE_IMG;syncView();return;}
  let url=useFallback?item.img:await recolor(item.img,DATA.paint[sel.paint].rgb,lastPart==='wheels').catch(()=>null); if(!url){url=item.img;}
  variant.src=url;
  if(!atPartsView&&window.danfoShowFrame)window.danfoShowFrame(7,true);
  syncView();
  if(window.gsap&&!reduce)gsap.fromTo(variant,{opacity:0,scale:.97},{opacity:1,scale:1,duration:.35,ease:'power2.out'});
}
/* the build is kept while you turn the bus: the paint is on every angle, and the front-right view (the angle the
   wheels and accessories are rendered for) always shows the full customised bus. Nothing resets until a reload. */
const VIEW_WITH_PARTS='Front right view';
let atPartsView=true;
function syncView(){
  atPartsView=spin.getAttribute('aria-valuetext')===VIEW_WITH_PARTS;
  spin.classList.toggle('has-variant',atPartsView); variant.hidden=!atPartsView;
  const item=lastPart?DATA[lastPart][sel[lastPart]]:null;
  hint.textContent=(item&&item.img&&!atPartsView)?'Tap to rotate · '+item.n+' shows in the front-right view':'Tap to rotate';
}
new MutationObserver(syncView).observe(spin,{attributes:true,attributeFilter:['aria-valuetext']});

/* ---------- tabs ---------- */
const tabs=$$('.ctabs [role="tab"]');
function openTab(tb,focus){tabs.forEach(t=>{const on=t===tb;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;$('#'+t.getAttribute('aria-controls')).hidden=!on;});focusCat=tb.dataset.tab;detail(focusCat);if(focus)tb.focus();}
tabs.forEach((tb,i)=>{tb.addEventListener('click',()=>openTab(tb));tb.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();openTab(tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length],true);}});});

/* ---------- options ---------- */
$$('.cust .opt').forEach(b=>b.addEventListener('click',()=>{
  const cat=b.dataset.cat, id=b.dataset.id; sel[cat]=id;
  $$(`.cust .opt[data-cat="${cat}"]`).forEach(o=>o.setAttribute('aria-checked',o===b));
  if(cat==='paint')applyPaint();
  if(cat==='wheels'||cat==='acc'){lastPart=cat;showVariant();}
  detail(cat); stats();
}));
function stats(){
  const up=DATA.up[sel.up].s;
  BASE.forEach((v,i)=>{const n=Math.min(100,v+up[i]);$('#csb'+i).style.width=n+'%';$('#csb'+i).classList.toggle('up',up[i]>0);$('#csv'+i).textContent=n;});
}
function detail(cat){
  const id=sel[cat], it=DATA[cat][id], key=cat+':'+id, have=owned.has(key);
  $('#cdName').textContent=it.n; $('#cdDesc').textContent=it.d;
  $('#cdCost').innerHTML=have?'Equipped':`<span class="coin-ic" aria-hidden="true"></span>${it.c.toLocaleString()}`;
  const btn=$('#cdBtn'); btn.disabled=have;
  btn.textContent=have?'EQUIPPED':(coins>=it.c?`UNLOCK FOR ${it.c.toLocaleString()} COINS`:'NOT ENOUGH COINS');
  if(!have&&coins<it.c)btn.disabled=true;
  build();
}
$('#cdBtn').addEventListener('click',()=>{
  const cat=focusCat, id=sel[cat], it=DATA[cat][id]; if(coins<it.c)return;
  coins-=it.c; owned.add(cat+':'+id); detail(cat);
  if(window.gsap&&!reduce)gsap.fromTo('#cdCost',{scale:1.15},{scale:1,duration:.3,ease:'back.out(2)'});
});
function build(){
  const lab=c=>DATA[c][sel[c]].n+(owned.has(c+':'+sel[c])?'':' (preview)');
  $('#buildTxt').textContent=`${lab('paint')} · ${lab('wheels')} · ${lab('acc')} · ${lab('up')} — ${coins.toLocaleString()} coins left`;
}
detail('paint'); stats(); showVariant();
/* warm the paint cache quietly once the section is near */
new IntersectionObserver((es,o)=>{if(es[0].isIntersecting){o.disconnect();['navy','green'].forEach(p=>frames.slice(0,2).forEach(f=>recolor(origSrc.get(f),DATA.paint[p].rgb)));}},{rootMargin:'400px'}).observe(spin);
})();
