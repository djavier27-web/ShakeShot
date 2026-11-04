// Sound effect Remi Shake Shot. Semua bunyi dibuat langsung dengan WebAudio,
// jadi tidak ada file audio yang perlu diunduh dan tidak ada masalah hak cipta.
let ctx=null, master=null, noiseBuf=null, muted=false;
try{ muted=localStorage.getItem('rss-mute')==='1'; }catch(e){}

function ensure(){
  if(ctx) return ctx;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return null;
  ctx=new AC();
  master=ctx.createGain(); master.gain.value=0.55;
  const comp=ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const d=noiseBuf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  return ctx;
}
// Browser baru boleh bersuara setelah ada sentuhan atau klik pertama.
function unlock(){
  const c=ensure(); if(c&&c.state==='suspended') c.resume();
}
['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,unlock,{passive:true}));

function tone(freq,t0,dur,{type='sine',gain=0.2,to=null,attack=0.005}={}){
  const c=ctx, o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t0);
  if(to) o.frequency.exponentialRampToValueAtTime(to,t0+dur);
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(gain,t0+attack);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0+dur+0.05);
}
function noise(t0,dur,{filter='bandpass',freq=2000,q=1,gain=0.2,to=null}={}){
  const c=ctx, s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
  s.buffer=noiseBuf; s.loop=true;
  f.type=filter; f.frequency.setValueAtTime(freq,t0); f.Q.value=q;
  if(to) f.frequency.exponentialRampToValueAtTime(to,t0+dur);
  g.gain.setValueAtTime(gain,t0);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0,Math.random()*0.5); s.stop(t0+dur+0.05);
}

const SOUNDS={
  // satu kartu dipilih atau dilepas di tangan
  tick(t){ tone(900,t,0.05,{type:'triangle',gain:0.12}); },
  untick(t){ tone(620,t,0.05,{type:'triangle',gain:0.1}); },
  // kartu dibagikan: rentetan sabetan kartu
  deal(t){ for(let i=0;i<10;i++) noise(t+i*0.06,0.05,{freq:3200+i*80,q:1.2,gain:0.16}); },
  // kartu dipasang ke meja
  card(t){ noise(t,0.07,{freq:1700,q:0.9,gain:0.28}); tone(150,t,0.12,{gain:0.3,to:60}); },
  // angka 2 asli: tegas dan terang
  two(t){ SOUNDS.card(t); tone(1320,t+0.03,0.35,{gain:0.14}); tone(1760,t+0.03,0.3,{gain:0.08}); },
  // urutan: naik tangga
  run(t){ SOUNDS.card(t); [523,587,659,784].forEach((f,i)=>tone(f,t+0.05+i*0.06,0.14,{type:'triangle',gain:0.14})); },
  // shake shot: maraca dikocok lalu dihentak
  shake(t){
    for(let i=0;i<9;i++) noise(t+i*0.045+(i%2)*0.01,0.05,{filter:'highpass',freq:5500,q:0.7,gain:0.2});
    SOUNDS.card(t+0.45); tone(330,t+0.45,0.25,{type:'triangle',gain:0.14});
  },
  // bom: ledakan
  bom(t){
    tone(130,t,0.8,{gain:0.5,to:28,type:'sine'});
    noise(t,0.9,{filter:'lowpass',freq:900,to:90,gain:0.55});
    for(let i=0;i<6;i++) noise(t+0.05+i*0.07,0.05,{filter:'highpass',freq:3000,gain:0.14});
  },
  // joker 2 dipakai: kilau
  wild(t){ [1568,2093,2637,3136].forEach((f,i)=>tone(f,t+i*0.05,0.4,{gain:0.09})); },
  pass(t){ tone(340,t,0.18,{type:'triangle',gain:0.12,to:230}); },
  // putaran dibersihkan, meja kosong
  sweep(t){ noise(t,0.3,{filter:'bandpass',freq:500,to:3500,q:0.8,gain:0.14}); },
  // giliranmu
  turn(t){ tone(660,t,0.22,{gain:0.2}); tone(990,t+0.11,0.35,{gain:0.2}); },
  // seseorang kartunya habis
  out(t){ [523,659,784].forEach((f,i)=>tone(f,t+i*0.09,0.22,{type:'triangle',gain:0.16})); },
  win(t){
    [523,659,784,1047].forEach((f,i)=>tone(f,t+i*0.12,0.3,{type:'triangle',gain:0.2}));
    [523,659,784,1047].forEach(f=>tone(f,t+0.55,0.9,{type:'triangle',gain:0.1}));
  },
  lose(t){ [392,330,262,196].forEach((f,i)=>tone(f,t+i*0.2,0.35,{type:'triangle',gain:0.18,to:f*0.92})); },
  finish(t){ [440,392,349].forEach((f,i)=>tone(f,t+i*0.12,0.25,{type:'triangle',gain:0.14})); },
  murni(t){ SOUNDS.win(t); SOUNDS.wild(t+0.1); },
  error(t){ tone(160,t,0.12,{type:'square',gain:0.08}); tone(140,t+0.14,0.14,{type:'square',gain:0.08}); }
};

function play(name,delay=0){
  if(muted) return;
  const c=ensure(); if(!c||!SOUNDS[name]) return;
  if(c.state==='suspended') c.resume();
  try{ SOUNDS[name](c.currentTime+0.01+delay); }catch(e){}
}
function setMuted(v){
  muted=!!v;
  try{ localStorage.setItem('rss-mute',muted?'1':'0'); }catch(e){}
}
const isMuted=()=>muted;

export {play,setMuted,isMuted,unlock};
