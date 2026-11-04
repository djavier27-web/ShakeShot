import {SUITS,RANKS,SUIT_NAME,rankOf,suitOf,isRed,label,deal,newGameState,applyMove,checkPlay} from './logic.js';
import {connectDb} from './db.js';


// ---------------- UI ----------------
const $=s=>document.querySelector(s);
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PALETTE=['#F3B53B','#7ED0C2','#F08A6B','#B7A1F2','#9ACB6B','#EE87B4'];
const colorOf=id=>{let h=0;for(const ch of String(id))h=(h*31+ch.charCodeAt(0))>>>0;return PALETTE[h%PALETTE.length];};
const store={
  get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set(k,v){try{localStorage.setItem(k,v);}catch(e){}}
};

let db=null, me=null, myName=store.get('rss-name')||'', code=null;
let G=null, P={}, H={}, gotGame=false, unsubs=[], selected=new Set(), queue=Promise.resolve(), loadTimer=null, errMsg='', canWrite=null;
let showRules=false;

const PIPL=18,PIPM=50,PIPR=82;
const PIPS={
  2:[[PIPM,12],[PIPM,88]],
  3:[[PIPM,12],[PIPM,50],[PIPM,88]],
  4:[[PIPL,12],[PIPR,12],[PIPL,88],[PIPR,88]],
  5:[[PIPL,12],[PIPR,12],[PIPM,50],[PIPL,88],[PIPR,88]],
  6:[[PIPL,12],[PIPR,12],[PIPL,50],[PIPR,50],[PIPL,88],[PIPR,88]],
  7:[[PIPL,12],[PIPR,12],[PIPM,31],[PIPL,50],[PIPR,50],[PIPL,88],[PIPR,88]],
  8:[[PIPL,12],[PIPR,12],[PIPM,31],[PIPL,50],[PIPR,50],[PIPM,69],[PIPL,88],[PIPR,88]],
  9:[[PIPL,12],[PIPR,12],[PIPL,37],[PIPR,37],[PIPM,50],[PIPL,63],[PIPR,63],[PIPL,88],[PIPR,88]],
  10:[[PIPL,12],[PIPR,12],[PIPM,25],[PIPL,37],[PIPR,37],[PIPL,63],[PIPR,63],[PIPM,75],[PIPL,88],[PIPR,88]]
};
function cardHTML(c,extra){
  const r=RANKS[rankOf(c)], s=SUITS[suitOf(c)];
  let face='';
  if(r==='A') face='<div class="pips"><span class="pip ace" style="left:50%;top:50%">'+s+'</span></div>';
  else if(r==='J'||r==='Q'||r==='K') face='<div class="face"><i class="a">'+s+'</i><span>'+r+'</span><i class="b">'+s+'</i></div>';
  else{
    const rows=PIPS[Number(r)]||[];
    face='<div class="pips">'+rows.map(p=>'<span class="pip'+(p[1]>50?' flip':'')+'" style="left:'+p[0]+'%;top:'+p[1]+'%">'+s+'</span>').join('')+'</div>';
  }
  return '<div class="card'+(isRed(c)?' red':'')+(extra||'')+'" data-id="'+c+'" role="img" aria-label="'+r+' '+SUIT_NAME[suitOf(c)]+'">'
    +'<div class="cn"><b>'+r+'</b><i>'+s+'</i></div>'+face+'<div class="cn br"><b>'+r+'</b><i>'+s+'</i></div></div>';
}
const backHTML=()=>'<div class="card back"></div>';
const avatar=(id,name)=>'<span class="avatar" style="background:'+colorOf(id)+'">'+esc((name||'?').trim().charAt(0).toUpperCase())+'</span>';

function toast(t){
  const el=document.createElement('div'); el.className='toast'; el.textContent=t;
  $('#toastHost').appendChild(el); setTimeout(()=>el.remove(),2600);
}
function enqueue(fn){
  const p=queue.then(fn);
  queue=p.catch(()=>{});
  return p;
}
function randCode(){
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='';
  for(let i=0;i<4;i++) s+=a[Math.floor(Math.random()*a.length)];
  return s;
}

function connectionHint(e){
  const code=(e&&(e.code||e.message))||'tidak-diketahui';
  const hints={
    'config-belum-diisi':'js/firebase-config.js masih berisi placeholder ISI_... Salin konfigurasi web app dari Firebase Console.',
    'auth/operation-not-allowed':'Anonymous Authentication belum aktif. Firebase Console > Authentication > Sign-in method > Anonymous > Enable.',
    'auth/admin-restricted-operation':'Anonymous Authentication belum aktif. Firebase Console > Authentication > Sign-in method > Anonymous > Enable.',
    'auth/configuration-not-found':'Authentication belum diaktifkan. Firebase Console > Authentication > Get started, lalu aktifkan Anonymous.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.':'apiKey di js/firebase-config.js salah. Salin ulang dari Firebase Console.',
    'auth/invalid-api-key':'apiKey di js/firebase-config.js salah. Salin ulang dari Firebase Console.',
    'auth/unauthorized-domain':'Domain situs ini belum diizinkan. Firebase Console > Authentication > Settings > Authorized domains > tambahkan domain Vercel kamu.',
    'auth/network-request-failed':'Koneksi internet bermasalah atau diblokir. Coba muat ulang.'
  };
  return 'Tidak bisa terhubung ke server ('+code+'). '+(hints[code]||'Buka konsol browser (F12 > Console) untuk detail errornya, lalu cek js/firebase-config.js, Anonymous Auth, dan Firestore.');
}

async function init(){
  render();
  let connErr=null;
  try{
    const c=await connectDb();
    db=c.db; me=c.uid;
  }catch(e){ console.error(e); connErr=e; }
  if(!db){ errMsg=connectionHint(connErr); render(); return; }
  const saved=store.get('rss-code');
  if(saved&&myName){ joinGame(saved,true); }
  else render();
}

function unsubscribeAll(){ unsubs.forEach(u=>{try{u();}catch(e){}}); unsubs=[]; clearTimeout(loadTimer); }
function subscribe(c){
  unsubscribeAll(); G=null; P={}; H={}; gotGame=false; selected=new Set(); code=c;
  const fail=e=>{ errMsg='Koneksi ke meja terputus ('+(e&&e.code||'error')+'). Muat ulang halaman untuk menyambung lagi.'; render(); };
  unsubs.push(db.doc('games/'+c).onSnapshot(s=>{ gotGame=true; G=s.exists?s.data():null; clearTimeout(loadTimer); render(); },fail));
  unsubs.push(db.collection('games/'+c+'/players').onSnapshot(q=>{ P={}; q.docs.forEach(d=>{P[d.id]=d.data();}); render(); },fail));
  unsubs.push(db.collection('games/'+c+'/hands').onSnapshot(q=>{ H={}; q.docs.forEach(d=>{H[d.id]=d.data().cards||[];}); render(); },fail));
  loadTimer=setTimeout(()=>{ if(!gotGame){ errMsg='Belum bisa menjangkau meja. Cek koneksi, lalu tunggu sebentar.'; render(); } },10000);
}

async function createGame(){
  const name=$('#nameInput').value.trim();
  if(!name){ setErr('Isi namamu dulu.'); return; }
  myName=name; store.set('rss-name',name);
  try{
    let c='',tries=0;
    do{ c=randCode(); tries++; }while((await db.doc('games/'+c).get()).exists && tries<6);
    await db.doc('games/'+c).set({phase:'lobby',code:c,hostId:me,round:0,wins:{},losses:{},created:Date.now()});
    await db.doc('games/'+c+'/players/'+me).set({name,t:Date.now()});
    store.set('rss-code',c); errMsg=''; subscribe(c);
  }catch(e){ setErr('Gagal membuat meja. Pastikan kamu punya akses Contributor ke halaman ini.'); }
}
async function joinGame(c,silent){
  c=(c||'').trim().toUpperCase();
  const name=silent?myName:$('#nameInput').value.trim();
  if(!silent){
    if(!name){ setErr('Isi namamu dulu.'); return; }
    if(c.length!==4){ setErr('Kode meja terdiri dari 4 huruf atau angka.'); return; }
  }
  myName=name; store.set('rss-name',name);
  try{
    const g=await db.doc('games/'+c).get();
    if(!g.exists){ if(silent){ store.set('rss-code',''); render(); } else setErr('Kode meja tidak ditemukan.'); return; }
    const pl=await db.collection('games/'+c+'/players').get();
    const ids=pl.docs.map(d=>d.id);
    const mine=ids.includes(me);
    if(!mine){
      if(g.data().phase!=='lobby'){ if(silent){ store.set('rss-code',''); render(); } else setErr('Permainan di meja ini sudah berjalan.'); return; }
      if(ids.length>=4){ if(silent){ store.set('rss-code',''); render(); } else setErr('Meja sudah penuh (maksimal 4 pemain).'); return; }
    }
    await db.doc('games/'+c+'/players/'+me).set({name,t:mine?(pl.docs.find(d=>d.id===me).data().t):Date.now()});
    store.set('rss-code',c); errMsg=''; subscribe(c);
  }catch(e){ if(!silent) setErr('Gagal bergabung. Pastikan kamu punya akses Contributor ke halaman ini.'); else render(); }
}
function leave(){
  unsubscribeAll(); code=null; G=null; P={}; H={}; selected=new Set(); store.set('rss-code',''); errMsg=''; render();
}

function startGame(){
  return enqueue(async()=>{
    const ids=Object.keys(P).sort((a,b)=>P[a].t-P[b].t);
    if(ids.length<2||ids.length>4){ toast('Butuh 2 sampai 4 pemain.'); return; }
    const hands=deal(ids); const names={};
    ids.forEach(id=>{names[id]=P[id].name;});
    for(const id of ids) await db.doc('games/'+code+'/hands/'+id).set({cards:hands[id]});
    const base=Object.assign({},G,{code,hostId:G.hostId});
    await db.doc('games/'+code).set(newGameState(base,ids,names,hands));
    selected=new Set();
  }).catch(()=>toast('Gagal membagikan kartu. Coba lagi.'));
}
function backToLobby(){
  return enqueue(async()=>{
    const s=Object.assign({},G,{phase:'lobby',turn:null,table:null,passed:[],bombed:[],out:[],first:true,log:[],murni:[]});
    delete s.order; delete s.names;
    await db.doc('games/'+code).set(s);
  }).catch(()=>toast('Gagal kembali ke lobi.'));
}
function myHand(){ return (H[me]||[]).slice().sort((a,b)=>a-b); }

function playSelected(){
  const hand=myHand(); const sel=[...selected].filter(c=>hand.includes(c)).sort((a,b)=>a-b);
  const chk=checkPlay(G,hand,sel);
  if(!chk.ok||G.turn!==me){ toast(chk.msg); return; }
  const left=hand.filter(c=>!sel.includes(c));
  const next=applyMove(G,me,{type:'play',cards:sel,combo:chk.combo,handLeft:left.length});
  selected=new Set();
  enqueue(async()=>{
    await db.doc('games/'+code+'/hands/'+me).set({cards:left});
    await db.doc('games/'+code).set(next);
  }).catch(()=>toast('Gagal memasang kartu. Coba lagi.'));
  render();
}
function passTurn(){
  if(G.turn!==me||!G.table) return;
  const next=applyMove(G,me,{type:'pass'});
  selected=new Set();
  enqueue(()=>db.doc('games/'+code).set(next)).catch(()=>toast('Gagal pass. Coba lagi.'));
  render();
}

function setErr(t){ const e=$('#err'); if(e) e.textContent=t; }

// ---------------- render ----------------
function rulesHTML(){
  return '<div class="rules-body">'
  +'<div><b>Tujuan.</b> Habiskan kartu di tanganmu lebih dulu. Yang habis duluan menang, yang terakhir masih memegang kartu kalah.</div>'
  +'<div><b>Urutan kartu.</b> 3 paling rendah, lalu naik sampai As, dan <b>2 paling tinggi</b>. Lambang tidak berpengaruh, hanya angkanya.</div>'
  +'<div><b>Mulai.</b> Pemain dengan angka 3 terbanyak jalan pertama. Kalau seimbang, pemilik 3 sekop jalan duluan. Kartu pertama harus memuat angka 3. Kalau tidak punya kartu kerajaan (J, Q, K) sama sekali, kamu <b>Murni</b> dan langsung menang.</div>'
  +'<div><b>Jenis kartu yang boleh dipasang.</b><ul>'
  +'<li>Satu kartu</li><li>Dos: dua kartu angka sama</li><li>Triple: tiga kartu angka sama</li>'
  +'<li>Urutan: minimal 4 kartu berurutan (tanpa angka 2)</li>'
  +'<li>Shake shot: satu triple ditambah satu dos. Yang dibandingkan adalah angka triple-nya ("kepala")</li>'
  +'<li>Bom: minimal 4 pasang berurutan. Hanya bisa memotong angka 2 (satu kartu, dos, atau triple)</li></ul></div>'
  +'<div><b>Giliran.</b> Pasang jenis yang sama dengan angka lebih tinggi, atau pass. Pemain yang sudah pass tidak bisa masuk lagi sampai putaran berikutnya. Kalau semua pass, pemasang terakhir membuka putaran baru dengan kombinasi apa saja.</div>'
  +'<div class="assume">Dua hal ini saya tafsirkan sendiri: pemain yang angka 2-nya kena bom dilewati sampai putaran itu selesai, dan "Murni" berarti tidak ada J, Q, K di tangan pembagian awal.</div>'
  +'</div>';
}

function render(){
  const app=$('#app'); if(!app) return;
  if(!code){ app.innerHTML=entryHTML(); bindEntry(); return; }
  if(errMsg&&!G){ app.innerHTML=shell('<div class="loading">'+esc(errMsg)+'<br><br><button class="btn" id="bLeave">Kembali</button></div>'); $('#bLeave').onclick=leave; return; }
  if(!gotGame||!G){
    app.innerHTML=shell('<div class="loading">'+(gotGame?'Meja tidak ditemukan.':'Menyambung ke meja '+esc(code)+'…')+'<br><br><button class="btn ghost" id="bLeave">Keluar</button></div>');
    $('#bLeave').onclick=leave; return;
  }
  if(G.phase==='lobby'){ app.innerHTML=lobbyHTML(); bindLobby(); return; }
  if(!G.order||!G.order.includes(me)){
    app.innerHTML=shell('<div class="loading">Kamu bukan pemain di meja ini.<br><br><button class="btn" id="bLeave">Keluar</button></div>');
    $('#bLeave').onclick=leave; return;
  }
  const oldHand=document.getElementById('hand'); const keepScroll=oldHand?oldHand.scrollLeft:0;
  app.innerHTML=tableHTML(); bindTable();
  const newHand=document.getElementById('hand'); if(newHand) newHand.scrollLeft=keepScroll;
}
function shell(inner){
  return '<div class="topbar"><div class="brand"><i>♠</i> Remi Shake Shot</div></div>'+inner;
}

function entryHTML(){
  const fan=[0,25,43,47,48].map(c=>cardHTML(c)).join('');
  const warn=errMsg?'<p class="err">'+esc(errMsg)+'</p>':'';
  const ro=canWrite===false?'<p class="note">Aksesmu saat ini hanya melihat. Minta pemilik halaman menjadikanmu Contributor supaya bisa bermain.</p>':'';
  return '<div class="topbar"><div class="brand"><i>♠</i> Remi Shake Shot</div></div>'
  +'<div class="entry"><div class="hero"><div class="fan">'+fan+'</div>'
  +'<h1>Remi<br><em>Shake</em> Shot</h1>'
  +'<p>Kartu remi untuk 2 sampai 4 orang. Buat meja, kirim kodenya ke teman, lalu mulai main bareng.</p></div>'
  +'<div class="panel"><label class="lbl" for="nameInput">Namamu</label>'
  +'<input class="txt" id="nameInput" maxlength="14" autocomplete="off" placeholder="Misal: Budi" value="'+esc(myName)+'">'
  +'<div style="height:16px"></div><button class="btn primary" id="bCreate" style="width:100%">Buat meja baru</button>'
  +'<div class="sep">atau gabung</div>'
  +'<div class="row"><input class="txt" id="codeInput" maxlength="4" autocomplete="off" placeholder="KODE"><button class="btn" id="bJoin">Gabung</button></div>'
  +'<p class="err" id="err"></p>'+warn+ro
  +'<details class="rules"'+(showRules?' open':'')+'><summary>Aturan main</summary>'+rulesHTML()+'</details></div></div>';
}
function bindEntry(){
  const c=$('#bCreate'); if(!c) return;
  const ready=!!db;
  c.disabled=!ready; $('#bJoin').disabled=!ready;
  c.onclick=createGame;
  $('#bJoin').onclick=()=>joinGame($('#codeInput').value,false);
  $('#codeInput').onkeydown=e=>{ if(e.key==='Enter') joinGame($('#codeInput').value,false); };
  $('#nameInput').onkeydown=e=>{ if(e.key==='Enter'&&!$('#codeInput').value) createGame(); };
  const d=document.querySelector('details.rules'); if(d) d.ontoggle=()=>{showRules=d.open;};
}

function lobbyHTML(){
  const ids=Object.keys(P).sort((a,b)=>P[a].t-P[b].t);
  const isHost=G.hostId===me;
  const list=ids.map(id=>'<li>'+avatar(id,P[id].name)+'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(P[id].name)+(id===me?' <span class="muted">(kamu)</span>':'')+'</span>'
    +(id===G.hostId?'<span class="tag host">Host</span>':'')+'</li>').join('');
  const wins=Object.keys(G.wins||{}).length?'<p class="note">Permainan sebelumnya: '+(G.round||0)+' ronde.</p>':'';
  return '<div class="topbar"><div class="brand"><i>♠</i> Remi Shake Shot</div><button class="btn ghost small" id="bLeave">Keluar</button></div>'
  +'<div class="lobby"><div class="muted" style="letter-spacing:.14em;text-transform:uppercase;font-size:12px">Kode meja</div>'
  +'<div class="codebig">'+esc(code)+'</div>'
  +'<p class="note">Kirim link halaman ini ke temanmu, lalu minta mereka memasukkan kode di atas. Pemain harus punya akses Contributor.</p>'
  +'<ul class="plist">'+list+'</ul>'+wins
  +(isHost
    ?'<button class="btn primary" id="bStart" '+(ids.length<2?'disabled':'')+' style="width:100%">'+(ids.length<2?'Menunggu pemain lain…':'Bagikan kartu dan mulai')+'</button><p class="note" style="margin-top:8px">'+ids.length+' dari 4 pemain</p>'
    :'<p class="muted">Menunggu host memulai permainan…</p>')
  +'<details class="rules" style="text-align:left"'+(showRules?' open':'')+'><summary>Aturan main</summary>'+rulesHTML()+'</details></div>';
}
function bindLobby(){
  $('#bLeave').onclick=leave;
  const s=$('#bStart'); if(s) s.onclick=startGame;
  const d=document.querySelector('details.rules'); if(d) d.ontoggle=()=>{showRules=d.open;};
}

function statusBadge(id){
  const i=G.out.indexOf(id);
  if(i>=0){
    if(G.phase==='finished'&&i===G.out.length-1&&G.out.length>1) return '<span class="badge bad">Kalah</span>';
    return '<span class="badge win">Juara '+(i+1)+'</span>';
  }
  if(G.turn===id) return '<span class="badge go">Giliran</span>';
  if(G.bombed&&G.bombed.includes(id)) return '<span class="badge bad">Kena bom</span>';
  if(G.passed&&G.passed.includes(id)) return '<span class="badge">Pass</span>';
  return '';
}
function tableHTML(){
  const order=G.order, myIdx=order.indexOf(me);
  const others=[]; for(let k=1;k<order.length;k++) others.push(order[(myIdx+k)%order.length]);
  const opps=others.map(id=>{
    const n=(H[id]||[]).length, done=G.out.includes(id);
    const backs=Array.from({length:Math.min(n,8)}).map(backHTML).join('');
    return '<div class="opp'+(G.turn===id?' turn':'')+(done?' done':'')+'">'+avatar(id,G.names[id])
      +'<div class="nm">'+esc(G.names[id])+'</div>'
      +'<div class="meta"><div class="backs">'+backs+'</div><div style="display:flex;align-items:center;gap:8px">'+statusBadge(id)+'<span class="count" title="Sisa kartu">'+n+'</span></div></div></div>';
  }).join('');

  let mid;
  if(G.table){
    const t=G.table;
    mid='<div><div class="who"><b>'+esc(G.names[t.by])+'</b> memasang</div><div class="played">'+t.cards.slice().sort((a,b)=>a-b).map(c=>cardHTML(c)).join('')+'</div><div class="combo-name">'+esc(label(t))+'</div></div>';
  }else{
    const lead=G.turn?esc(G.names[G.turn]):'';
    mid='<div class="empty-mid"><b>Meja kosong</b>'+(G.phase==='finished'?'Permainan selesai.':(G.turn===me?'Kamu yang membuka. Pasang kombinasi apa saja'+(G.first?', harus memuat angka 3.':'.'):lead+' yang membuka.'))+'</div>';
  }
  const log=(G.log||[]).slice(-3).map(t=>'<span>'+esc(t)+'</span>').join('');

  const hand=myHand();
  const myTurn=G.turn===me&&G.phase==='playing';
  const sel=[...selected].filter(c=>hand.includes(c)).sort((a,b)=>a-b);
  const chk=sel.length?checkPlay(G,hand,sel):null;
  const cards=hand.map(c=>cardHTML(c,selected.has(c)?' sel':'')).join('');
  const done=G.out.includes(me);
  let statusTxt,statusCls='';
  if(done) statusTxt='Kartumu sudah habis. Juara '+(G.out.indexOf(me)+1)+'!';
  else if(myTurn){ statusTxt='Giliranmu'; statusCls=' go'; }
  else if(G.phase==='finished') statusTxt='Permainan selesai';
  else statusTxt='Menunggu '+esc(G.names[G.turn]||'');
  let hint='',hcls='';
  if(myTurn){
    if(chk){ hint=chk.msg; hcls=chk.ok?' good':' bad'; }
    else hint=G.table?'Pilih kartu yang lebih tinggi dari meja, atau pass.':(G.first?'Kamu jalan pertama. Pilih kartu yang memuat angka 3.':'Pilih kartu untuk dibuka.');
  }
  const sc=(G.wins&&G.wins[me])||0;
  const over=G.phase==='finished'?finishHTML():'';
  return '<div class="topbar"><div class="brand"><i>♠</i> Remi Shake Shot</div>'
    +'<div class="chips"><span class="chip mono">Meja '+esc(code)+'</span><span class="chip">Ronde '+(G.round||1)+'</span><button class="btn ghost small" id="bLeave">Keluar</button></div></div>'
    +'<div class="opps">'+opps+'</div>'
    +'<div class="mid">'+mid+'</div>'
    +'<div class="eventlog">'+log+'</div>'
    +'<div class="me"><div class="me-head"><div class="status'+statusCls+'">'+statusTxt+'</div><div class="note">'+esc(myName)+' &middot; menang '+sc+'x &middot; sisa '+hand.length+' kartu</div></div>'
    +'<div class="hand'+(myTurn?'':' locked')+'" id="hand">'+cards+'</div>'
    +'<div class="actions"><button class="btn primary" id="bPlay" '+(myTurn&&chk&&chk.ok?'':'disabled')+'>Pasang'+(chk&&chk.ok?' · '+esc(label(chk.combo)):'')+'</button>'
    +'<button class="btn" id="bPass" '+(myTurn&&G.table?'':'disabled')+'>Pass</button>'
    +'<button class="btn ghost" id="bClear" '+(sel.length?'':'disabled')+'>Batal pilih</button></div>'
    +'<div class="hint'+hcls+'">'+esc(hint)+'</div></div>'+over;
}
function finishHTML(){
  const rows=G.out.map((id,i)=>{
    const last=i===G.out.length-1&&G.out.length>1;
    return '<li class="'+(last?'last':'')+'"><span class="pos">'+(i+1)+'</span>'+avatar(id,G.names[id])
      +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(G.names[id])+(id===me?' <span class="muted">(kamu)</span>':'')+'</span>'
      +'<span class="tot">'+(last?'Kalah · ':'')+'menang '+((G.wins&&G.wins[id])||0)+'x</span></li>';
  }).join('');
  const w=G.out[0];
  const isHost=G.hostId===me;
  const murni=G.murni&&G.murni.length?'<p class="note">Murni! Tidak ada kartu kerajaan di tangan.</p>':'';
  return '<div class="overlay"><div class="result"><div class="muted" style="font-size:12px;letter-spacing:.12em;text-transform:uppercase">Ronde '+(G.round||1)+' selesai</div>'
    +'<h2>'+(w===me?'Kamu menang':esc(G.names[w])+' menang')+'</h2>'+murni
    +'<ul class="rank">'+rows+'</ul>'
    +(isHost?'<div class="actions"><button class="btn primary" id="bAgain">Main lagi</button><button class="btn ghost" id="bLobby">Ke lobi</button></div>'
            :'<p class="note">Menunggu host memulai ronde berikutnya…</p><div class="actions"><button class="btn ghost" id="bLeave2">Keluar</button></div>')
    +'</div></div>';
}
function bindTable(){
  $('#bLeave').onclick=leave;
  const l2=$('#bLeave2'); if(l2) l2.onclick=leave;
  const again=$('#bAgain'); if(again) again.onclick=startGame;
  const lob=$('#bLobby'); if(lob) lob.onclick=backToLobby;
  const hand=$('#hand'); const keep=hand?hand.scrollLeft:0;
  if(hand){
    hand.scrollLeft=keep;
    hand.onclick=e=>{
      const el=e.target.closest('.card'); if(!el) return;
      const id=Number(el.dataset.id);
      if(selected.has(id)) selected.delete(id); else selected.add(id);
      const sl=hand.scrollLeft; render(); const h2=$('#hand'); if(h2) h2.scrollLeft=sl;
    };
  }
  $('#bPlay').onclick=playSelected;
  $('#bPass').onclick=passTurn;
  $('#bClear').onclick=()=>{ selected=new Set(); render(); };
}

init();
