// Dashboard admin: lihat semua meja, pilih pemain, atur tingkat kartunya (busuk / biasa / hoki).
// Pengaturan disimpan di games/<kode>/rig/cfg dan dibaca saat host membagikan kartu berikutnya.
import {connectDb} from './db.js';
import {SUITS,RANKS,rankOf,suitOf,isRed,dealRigged,newGameState,isMurni} from './logic.js';

// Hash SHA-256 dari "username:password". Password tidak tersimpan polos di kode.
const ADMIN_HASH='1572fb5facec57f3a4a31b4474fdfb05c17eaf9f8e7b961be1b2d75470535ef7';
const MAX_HOKI=3; // tangan Murni butuh 13 kartu tanpa J, Q, K; dari 40 kartu hanya muat 3 tangan

const $=s=>document.querySelector(s);
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LEVELS=[['busuk','Busuk'],['biasa','Biasa'],['hoki','Hoki']];
const ss={get(k){try{return sessionStorage.getItem(k);}catch(e){return null;}},set(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}};

let db=null, authed=ss.get('rss-admin')==='1', errMsg='';
let rooms=[], sel=null, G=null, P={}, H={}, RIG={}, unsubs=[], roomsUnsub=null;

async function sha(t){
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function toast(t){
  const el=document.createElement('div'); el.className='toast'; el.textContent=t;
  $('#toastHost').appendChild(el); setTimeout(()=>el.remove(),2600);
}

async function login(){
  const u=$('#user').value.trim(), p=$('#pass').value;
  let h=''; try{ h=await sha(u+':'+p); }catch(e){ $('#err').textContent='Halaman ini harus dibuka lewat https atau localhost.'; return; }
  if(h===ADMIN_HASH){ ss.set('rss-admin','1'); authed=true; start(); }
  else{ await new Promise(r=>setTimeout(r,700)); $('#err').textContent='Username atau password salah.'; }
}
function logout(){
  ss.set('rss-admin','0'); authed=false; unsubAll(); if(roomsUnsub){roomsUnsub();roomsUnsub=null;} sel=null; render();
}

function unsubAll(){ unsubs.forEach(u=>{try{u();}catch(e){}}); unsubs=[]; G=null; P={}; H={}; RIG={}; }
function pickRoom(code){
  unsubAll(); sel=code;
  unsubs.push(db.doc('games/'+code).onSnapshot(s=>{ G=s.exists?s.data():null; render(); },()=>{}));
  unsubs.push(db.collection('games/'+code+'/players').onSnapshot(q=>{ P={}; q.docs.forEach(d=>{P[d.id]=d.data();}); render(); },()=>{}));
  unsubs.push(db.collection('games/'+code+'/hands').onSnapshot(q=>{ H={}; q.docs.forEach(d=>{H[d.id]=d.data().cards||[];}); render(); },()=>{}));
  unsubs.push(db.doc('games/'+code+'/rig/cfg').onSnapshot(s=>{ RIG=s.exists?(s.data().levels||{}):{}; render(); },()=>{}));
  render();
}

const playerIds=()=>Object.keys(P).sort((a,b)=>P[a].t-P[b].t);
const levelOf=id=>RIG[id]==='hoki'||RIG[id]==='busuk'?RIG[id]:'biasa';

async function setLevel(id,lv){
  if(lv==='hoki'&&levelOf(id)!=='hoki'&&playerIds().filter(x=>levelOf(x)==='hoki').length>=MAX_HOKI){ toast('Maksimal '+MAX_HOKI+' pemain hoki per meja.'); return; }
  const levels=Object.assign({},RIG,{[id]:lv});
  try{ await db.doc('games/'+sel+'/rig/cfg').set({levels,t:Date.now()}); }
  catch(e){ toast('Gagal menyimpan. Coba lagi.'); }
}
async function resetAll(){
  try{ await db.doc('games/'+sel+'/rig/cfg').set({levels:{},t:Date.now()}); toast('Semua pemain kembali Biasa.'); }
  catch(e){ toast('Gagal reset.'); }
}
async function redeal(){
  const ids=playerIds();
  if(ids.length<2||ids.length>4){ toast('Butuh 2 sampai 4 pemain.'); return; }
  if(G&&G.phase==='playing'&&!confirm('Ronde sedang berjalan. Bagikan ulang sekarang dan hapus permainan ini?')) return;
  try{
    const hands=dealRigged(ids,RIG); const names={}; ids.forEach(i=>{names[i]=P[i].name;});
    for(const id of ids) await db.doc('games/'+sel+'/hands/'+id).set({cards:hands[id]});
    const base=Object.assign({},G,{code:sel,hostId:G.hostId});
    await db.doc('games/'+sel).set(newGameState(base,ids,names,hands));
    toast('Kartu dibagikan ulang.');
  }catch(e){ toast('Gagal membagikan kartu.'); }
}

function cardTxt(c){ return RANKS[rankOf(c)]+SUITS[suitOf(c)]; }
function handHTML(id){
  const h=(H[id]||[]).slice().sort((a,b)=>a-b);
  if(!h.length||G.phase==='lobby') return '<div class="handtxt">Belum ada kartu.</div>';
  return '<div class="handtxt">'+h.map(c=>'<span'+(isRed(c)?' class="r"':'')+'>'+esc(cardTxt(c))+'</span>').join(' ')+(isMurni(h)?' · Murni':'')+'</div>';
}
function ago(t){
  if(!t) return '';
  const m=Math.round((Date.now()-t)/60000);
  return m<1?'baru saja':m<60?m+' mnt':m<1440?Math.round(m/60)+' jam':Math.round(m/1440)+' hari';
}
const PH={lobby:'Lobi',playing:'Main',finished:'Selesai'};

function loginHTML(){
  return '<div class="topbar"><div class="brand"><i>♠</i> Admin</div></div>'
   +'<div class="panel loginbox"><h2 style="margin-bottom:14px">Masuk admin</h2>'
   +'<label class="lbl" for="user">Username</label><input class="txt" id="user" autocomplete="username" autocapitalize="none">'
   +'<div style="height:12px"></div><label class="lbl" for="pass">Password</label><input class="txt" id="pass" type="password" autocomplete="current-password">'
   +'<div style="height:16px"></div><button class="btn primary" id="bLogin" style="width:100%">Masuk</button><p class="err" id="err">'+esc(errMsg)+'</p></div>';
}
function roomHTML(){
  if(!sel) return '<div class="panel"><p class="muted" style="margin:0">Pilih satu meja di sebelah kiri.</p></div>';
  if(!G) return '<div class="panel"><p class="muted" style="margin:0">Memuat meja '+esc(sel)+'…</p></div>';
  const ids=playerIds(), hokis=ids.filter(i=>levelOf(i)==='hoki').length;
  const rows=ids.map(id=>{
    const lv=levelOf(id);
    return '<div class="prow"><div class="top"><span class="nm">'+esc(P[id].name)+'</span>'+(id===G.hostId?'<span class="badge">Host</span>':'')+'</div>'
     +'<div class="seg" data-id="'+esc(id)+'">'+LEVELS.map(([k,t])=>'<button class="'+k+(lv===k?' on':'')+'" data-lv="'+k+'">'+t+'</button>').join('')+'</div>'
     +handHTML(id)+'</div>';
  }).join('');
  return '<div class="panel"><h2>Meja <span class="mono">'+esc(sel)+'</span> <span class="badge" style="vertical-align:middle">'+esc(PH[G.phase]||G.phase)+'</span></h2>'
   +(ids.length?rows:'<p class="muted">Belum ada pemain.</p>')
   +'<p class="note" style="margin-top:14px"><b>Busuk</b>: kartu paling lemah (tanpa 2 dan As). <b>Biasa</b>: acak. <b>Hoki</b>: tangan Murni, pasti menang di ronde itu. Berlaku saat kartu dibagikan berikutnya (hoki maksimal '+MAX_HOKI+' orang per meja).'
   +(hokis?' Sekarang ada '+hokis+' pemain hoki.':'')+'</p>'
   +'<div class="admrow"><button class="btn primary" id="bRedeal"'+(ids.length<2?' disabled':'')+'>Bagikan ulang sekarang</button><button class="btn ghost" id="bReset">Reset semua ke Biasa</button></div></div>';
}
function dashHTML(){
  const list=rooms.map(r=>'<li><button data-room="'+esc(r.id)+'"'+(r.id===sel?' class="on"':'')+'><span class="code">'+esc(r.id)+'</span><span class="badge'+(r.phase==='playing'?' go':'')+'">'+esc(PH[r.phase]||r.phase||'')+'</span><span class="sub">'+esc(ago(r.created))+'</span></button></li>').join('');
  return '<div class="topbar"><div class="brand"><i>♠</i> Dashboard Admin</div><button class="btn ghost small" id="bOut">Keluar</button></div>'
   +'<div class="adm"><div class="panel"><h2>Meja ('+rooms.length+')</h2>'+(rooms.length?'<ul class="roomlist">'+list+'</ul>':'<p class="muted" style="margin:0">Belum ada meja.</p>')+'</div>'+roomHTML()+'</div>';
}

function render(){
  const app=$('#app'); if(!app) return;
  if(!authed){ app.innerHTML=loginHTML(); $('#bLogin').onclick=login; $('#pass').onkeydown=e=>{ if(e.key==='Enter') login(); }; return; }
  if(!db){ app.innerHTML='<div class="topbar"><div class="brand"><i>♠</i> Admin</div></div><div class="panel" style="margin-top:18px">'+esc(errMsg||'Menyambung ke server…')+'</div>'; return; }
  app.innerHTML=dashHTML();
  $('#bOut').onclick=logout;
  app.querySelectorAll('[data-room]').forEach(b=>{ b.onclick=()=>pickRoom(b.dataset.room); });
  app.querySelectorAll('.seg').forEach(seg=>{ seg.onclick=e=>{ const b=e.target.closest('button'); if(b) setLevel(seg.dataset.id,b.dataset.lv); }; });
  const rd=$('#bRedeal'); if(rd) rd.onclick=redeal;
  const rs=$('#bReset'); if(rs) rs.onclick=resetAll;
}

function watchRooms(){
  roomsUnsub=db.collection('games').onSnapshot(q=>{
    rooms=q.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>(b.created||0)-(a.created||0)).slice(0,40);
    render();
  },()=>{ errMsg='Gagal membaca daftar meja.'; render(); });
}
async function start(){
  render();
  if(!db){
    try{ db=(await connectDb()).db; }catch(e){ console.error(e); errMsg='Tidak bisa terhubung ke server. Cek js/firebase-config.js dan Anonymous Auth.'; render(); return; }
  }
  watchRooms(); render();
}
if(authed) start(); else render();
