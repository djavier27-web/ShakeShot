// Aturan permainan Remi Shake Shot. Fungsi murni, tanpa DOM dan tanpa database.
const SUITS=['♠','♣','♦','♥'];
const RANKS=['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const rankOf=c=>c>>2, suitOf=c=>c&3;
const isRed=c=>suitOf(c)>=2;
const SUIT_NAME=['sekop','keriting','wajik','hati'];

function classify(ids){
  const n=ids.length; if(!n) return null;
  const rs=ids.map(rankOf).sort((a,b)=>a-b);
  const cnt={}; rs.forEach(r=>{cnt[r]=(cnt[r]||0)+1;});
  const keys=Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  const counts=keys.map(k=>cnt[k]);
  if(n===1) return {type:'single',len:1,key:rs[0]};
  if(keys.length===1){
    if(n===2) return {type:'pair',len:2,key:rs[0]};
    if(n===3) return {type:'triple',len:3,key:rs[0]};
    return null;
  }
  const consec=a=>a.every((v,i)=>i===0||v===a[i-1]+1);
  const top=keys[keys.length-1];
  if(n===5 && keys.length===2 && counts.slice().sort().join()==='2,3'){
    return {type:'shake',len:5,key:keys.find(k=>cnt[k]===3)};
  }
  if(n>=4 && counts.every(c=>c===1) && top<=11 && consec(keys)) return {type:'straight',len:n,key:top};
  if(keys.length>=4 && counts.every(c=>c===2) && top<=11 && consec(keys)) return {type:'bom',len:keys.length,key:top};
  return null;
}
function label(c){
  const r=k=>RANKS[k];
  if(c.type==='single') return 'Kartu '+r(c.key);
  if(c.type==='pair') return 'Dos '+r(c.key);
  if(c.type==='triple') return 'Triple '+r(c.key);
  if(c.type==='shake') return 'Shake shot kepala '+r(c.key);
  if(c.type==='straight') return 'Urutan '+c.len+' kartu sampai '+r(c.key);
  if(c.type==='bom') return 'Bom '+c.len+' pasang sampai '+r(c.key);
  return '';
}
function beats(prev,next){
  if(!next) return false;
  if(!prev) return true;
  if(next.type==='bom'){
    if(prev.type==='bom') return next.len>prev.len || (next.len===prev.len && next.key>prev.key);
    return (prev.type==='single'||prev.type==='pair'||prev.type==='triple') && prev.key===12;
  }
  if(prev.type!==next.type) return false;
  if(next.type==='straight' && next.len!==prev.len) return false;
  return next.key>prev.key;
}
function shuffle(a){
  a=a.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function deal(ids){
  const deck=shuffle([...Array(52).keys()]); const hands={};
  ids.forEach((id,i)=>{hands[id]=deck.slice(i*13,i*13+13).sort((a,b)=>a-b);});
  return hands;
}
const isMurni=h=>!h.some(c=>rankOf(c)>=8&&rankOf(c)<=10);
function leaderOf(ids,hands){
  const threes=id=>hands[id].filter(c=>rankOf(c)===0).length;
  const mx=Math.max(...ids.map(threes));
  const tied=ids.filter(id=>threes(id)===mx);
  if(tied.length===1) return tied[0];
  const sp=tied.find(id=>hands[id].includes(0)); // 3 of spades = card id 0
  return sp||tied[0];
}
function newGameState(base,ids,names,hands){
  const s={
    phase:'playing',code:base.code,hostId:base.hostId,order:ids,names,
    turn:null,table:null,passed:[],bombed:[],out:[],first:true,
    round:(base.round||0)+1,wins:base.wins||{},losses:base.losses||{},murni:[],log:[]
  };
  const m=ids.filter(id=>isMurni(hands[id]));
  if(m.length){
    s.phase='finished'; s.murni=m;
    s.out=m.concat(ids.filter(id=>!m.includes(id)));
    s.log=['Murni! '+m.map(id=>names[id]).join(' & ')+' langsung menang.'];
    tally(s); return s;
  }
  s.turn=leaderOf(ids,hands);
  s.log=[names[s.turn]+' jalan pertama'];
  return s;
}
function tally(s){
  const w=s.out[0], l=s.out[s.out.length-1];
  s.wins[w]=(s.wins[w]||0)+1;
  if(l!==w) s.losses[l]=(s.losses[l]||0)+1;
}
function nextAfter(s,from,pred){
  const n=s.order.length, i=s.order.indexOf(from);
  for(let k=1;k<=n;k++){const id=s.order[(i+k)%n]; if(pred(id)) return id;}
  return null;
}
function applyMove(st,pid,act){
  const s=JSON.parse(JSON.stringify(st));
  const nm=id=>s.names[id]||'Pemain';
  const log=t=>{s.log=(s.log||[]).concat(t).slice(-6);};
  if(act.type==='pass'){
    s.passed.push(pid); log(nm(pid)+' pass');
  }else{
    const prev=s.table, c=act.combo;
    if(c.type==='bom' && prev && prev.type!=='bom'){
      const b=prev.by;
      if(!s.out.includes(b) && !s.passed.includes(b)) s.passed.push(b);
      if(!s.bombed.includes(b)) s.bombed.push(b);
      log(nm(pid)+' mem-bom angka 2 milik '+nm(b));
    }
    s.table={by:pid,type:c.type,len:c.len,key:c.key,cards:act.cards};
    s.first=false;
    log(nm(pid)+' pasang '+label(c));
    if(act.handLeft===0){ s.out.push(pid); log(nm(pid)+' kartunya habis (juara '+s.out.length+')'); }
  }
  const alive=s.order.filter(id=>!s.out.includes(id));
  if(alive.length<=1){
    if(alive.length===1) s.out.push(alive[0]);
    s.phase='finished'; s.turn=null; tally(s);
    log('Permainan selesai');
    return s;
  }
  const waiting=alive.filter(id=>!s.passed.includes(id)&&id!==s.table.by);
  if(!waiting.length){
    const by=s.table.by;
    const lead=!s.out.includes(by)?by:nextAfter(s,by,id=>!s.out.includes(id));
    s.table=null; s.passed=[]; s.bombed=[]; s.turn=lead;
    log('Putaran baru, '+nm(lead)+' membuka');
  }else{
    s.turn=nextAfter(s,pid,id=>!s.out.includes(id)&&!s.passed.includes(id)&&id!==s.table.by);
  }
  return s;
}
function checkPlay(s,hand,sel){
  if(!sel.length) return {ok:false,msg:'Pilih kartu dulu.'};
  const combo=classify(sel);
  if(!combo) return {ok:false,msg:'Kartu yang dipilih belum membentuk kombinasi.'};
  if(s.first && !sel.some(c=>rankOf(c)===0)) return {ok:false,combo,msg:'Kartu pertama harus memuat angka 3.'};
  if(s.table && !beats(s.table,combo)){
    const t=s.table;
    if(combo.type==='bom') return {ok:false,combo,msg:'Bom hanya bisa memotong angka 2.'};
    if(combo.type!==t.type) return {ok:false,combo,msg:'Harus '+(t.type==='single'?'satu kartu':t.type==='pair'?'dos':t.type==='triple'?'triple':t.type==='shake'?'shake shot':t.type==='straight'?'urutan '+t.len+' kartu':'bom')+' yang lebih tinggi.'};
    if(combo.type==='straight' && combo.len!==t.len) return {ok:false,combo,msg:'Urutan harus '+t.len+' kartu.'};
    return {ok:false,combo,msg:'Belum cukup tinggi untuk mengalahkan meja.'};
  }
  return {ok:true,combo,msg:label(combo)};
}

export {SUITS,RANKS,SUIT_NAME,rankOf,suitOf,isRed,classify,label,beats,shuffle,deal,isMurni,leaderOf,newGameState,tally,nextAfter,applyMove,checkPlay};
