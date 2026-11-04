import assert from 'node:assert';
import * as L from '../js/logic.js';
const { classify, beats, applyMove, RANKS } = L;

const id = (rank, suit = 0) => RANKS.indexOf(String(rank)) * 4 + suit;
const cl = (...rs) => classify(rs.map((r, i) => id(r, i % 4)));

// combos
assert.deepStrictEqual(cl(7), { type: 'single', len: 1, key: 4 });
assert.strictEqual(cl(9, 9).type, 'pair');
assert.strictEqual(cl('Q', 'Q', 'Q').type, 'triple');
assert.strictEqual(cl(4, 4, 4, 4), null, 'four of a kind is not a combo');
assert.strictEqual(cl(5, 6, 7, 8).type, 'straight');
assert.strictEqual(cl(5, 6, 7), null, 'straight needs 4');
assert.strictEqual(cl('J', 'Q', 'K', 'A').type, 'straight');
assert.strictEqual(cl('K', 'A', 2, 3), null);
assert.strictEqual(cl('Q', 'K', 'A', 2), null, '2 not allowed in straight');
const shake = cl(4, 4, 4, 9, 9);
assert.strictEqual(shake.type, 'shake'); assert.strictEqual(shake.key, RANKS.indexOf('4'));
assert.strictEqual(cl(4, 4, 9, 9, 9).key, RANKS.indexOf('9'));
const bom = cl(5, 5, 6, 6, 7, 7, 8, 8);
assert.strictEqual(bom.type, 'bom'); assert.strictEqual(bom.len, 4);
assert.strictEqual(cl(5, 5, 6, 6, 7, 7), null, '3 pairs is not a bom');
assert.strictEqual(cl(5, 5, 6, 6, 7, 7, 9, 9), null);

// beats
const S = r => classify([id(r)]);
assert(beats(S(7), S(8)));
assert(!beats(S(8), S(7)));
assert(!beats(S(8), classify([id(8, 1)])), 'equal rank does not beat');
assert(beats(S('A'), S(2)));
assert(!beats(S(2), S('A')));
assert(beats(cl(9, 9), cl('K', 'K')));
assert(!beats(cl(9, 9), cl('K')));
assert(beats(cl(4, 4, 4, 9, 9), cl(5, 5, 5, 3, 3)), 'shake compares by triple');
assert(!beats(cl(5, 5, 5, 3, 3), cl(4, 4, 4, 'A', 'A')));
assert(beats(cl(5, 6, 7, 8), cl(6, 7, 8, 9)));
assert(!beats(cl(5, 6, 7, 8), cl(6, 7, 8, 9, 10)), 'straight length must match');
// bom cuts only 2s
assert(beats(S(2), bom));
assert(beats(cl(2, 2), bom));
assert(beats(cl(2, 2, 2), bom));
assert(!beats(S('A'), bom));
assert(!beats(cl('A', 'A'), bom));
assert(!beats(cl(4, 4, 4, 9, 9), bom));
// bom vs bom
const bom2 = cl(6, 6, 7, 7, 8, 8, 9, 9);
assert(beats(bom, bom2));
assert(!beats(bom2, bom));
// 2 cannot beat bom
assert(!beats(bom, S(2)));

// first play rule
const base = { phase: 'playing', first: true, table: null };
assert(!L.checkPlay(base, [], [id(9)]).ok);
assert(L.checkPlay(base, [], [id(3)]).ok);
assert(L.checkPlay({ ...base, first: false }, [], [id(9)]).ok);

// leader: most 3s, tie -> 3 of spades holder
const hands = { a: [id(3, 0), id(5)], b: [id(3, 1), id(3, 2), id(7)], c: [id(8)] };
assert.strictEqual(L.leaderOf(['a', 'b', 'c'], hands), 'b');
const hands2 = { a: [id(3, 0), id(5)], b: [id(3, 1), id(7)], c: [id(8)] };
assert.strictEqual(L.leaderOf(['a', 'b', 'c'], hands2), 'a');

// murni
assert(L.isMurni([id(3), id(10), id('A')]));
assert(!L.isMurni([id(3), id('J')]));

// dealing
const dh = L.deal(['a', 'b', 'c', 'd']);
const all = [].concat(...Object.values(dh));
assert.strictEqual(new Set(all).size, 52);

// simulate a full 3-player round by hand
let st = {
  phase: 'playing', code: 'TEST', hostId: 'a', order: ['a', 'b', 'c'],
  names: { a: 'Ani', b: 'Budi', c: 'Cici' }, turn: 'a', table: null, passed: [], bombed: [],
  out: [], first: true, round: 1, wins: {}, losses: {}, murni: [], log: []
};
const play = (s, pid, cards, left) => applyMove(s, pid, { type: 'play', cards, combo: classify(cards), handLeft: left });
st = play(st, 'a', [id(3, 0)], 5);
assert.strictEqual(st.turn, 'b'); assert.strictEqual(st.table.by, 'a'); assert.strictEqual(st.first, false);
st = applyMove(st, 'b', { type: 'pass' });
assert.strictEqual(st.turn, 'c');
st = play(st, 'c', [id(2, 0)], 4); // Cici plays a 2
assert.strictEqual(st.turn, 'a');
// Ani bombs the 2
const bomCards = [5, 5, 6, 6, 7, 7, 8, 8].map((r, i) => id(r, i % 2));
st = applyMove(st, 'a', { type: 'play', cards: bomCards, combo: classify(bomCards), handLeft: 2 });
assert(st.log.some(t => t.includes('mem-bom angka 2 milik Cici')), 'bomb is logged');
// b already passed, c bombed: only a left -> round over, a leads
assert.strictEqual(st.table, null); assert.strictEqual(st.turn, 'a'); assert.deepStrictEqual(st.passed, []);
// a plays last cards -> out first
st = play(st, 'a', [id(9, 0), id(9, 1)], 0);
assert.deepStrictEqual(st.out, ['a']);
assert.strictEqual(st.phase, 'playing');
assert.strictEqual(st.turn, 'b');
st = applyMove(st, 'b', { type: 'pass' });
assert.strictEqual(st.turn, 'c');
st = play(st, 'c', [id('K', 0), id('K', 1)], 0);
// only b is left -> game finishes, b is last
assert.strictEqual(st.phase, 'finished');
assert.deepStrictEqual(st.out, ['a', 'c', 'b']);
assert.strictEqual(st.wins.a, 1); assert.strictEqual(st.losses.b, 1);

// newGameState murni
const mh = { a: [id(3), id(4), id(5)], b: [id('J'), id(4)] };
const ms = L.newGameState({ code: 'X', hostId: 'a' }, ['a', 'b'], { a: 'A', b: 'B' }, mh);
assert.strictEqual(ms.phase, 'finished'); assert.deepStrictEqual(ms.out, ['a', 'b']);


// ---------- angka 2 sebagai joker ----------
const { interpret, checkPlay: cp, label } = L;
const cards = (...rs) => rs.map((r, i) => id(r, i % 4));
const best = (sel, state = { first: false, table: null }) => cp(state, [], sel);
const R = r => RANKS.indexOf(String(r));

// 2 melengkapi dos, triple, urutan
let r1 = best(cards('K', 2)); assert(r1.ok); assert.strictEqual(r1.combo.type, 'pair'); assert.strictEqual(r1.combo.key, R('K'));
let r2 = best(cards(9, 9, 2)); assert.strictEqual(r2.combo.type, 'triple'); assert.strictEqual(r2.combo.key, R(9));
let r3 = best(cards(5, 6, 7, 2)); assert.strictEqual(r3.combo.type, 'straight'); assert.strictEqual(r3.combo.key, R(8), 'joker dipakai di ujung atas');
assert.deepStrictEqual(r3.combo.wild, [R(8)]);
assert(label(r3.combo).includes('2 jadi 8'));
let r4 = best(cards(5, 6, 8, 2)); assert.strictEqual(r4.combo.type, 'straight'); assert.strictEqual(r4.combo.key, R(8), 'joker mengisi lubang 7');
let r5 = best(cards('Q', 'K', 'A', 2)); assert.strictEqual(r5.combo.type, 'straight'); assert.strictEqual(r5.combo.key, R('A'), 'joker jadi J, urutan tetap berakhir di As');
assert.strictEqual(best(cards(5, 6, 9, 2)).ok, false, 'lubang terlalu lebar untuk satu joker');
assert.strictEqual(best(cards(5, 6, 7, 2, 2)).combo.key, R(9), 'dua joker memperpanjang urutan ke atas');

// 2 asli tetap 2
assert.strictEqual(best(cards(2, 2)).combo.key, 12); assert.deepStrictEqual(best(cards(2, 2)).combo.wild, []);
assert.strictEqual(best(cards(2)).combo.type, 'single');
assert.strictEqual(best(cards(2, 2, 2, 2)).ok, false, 'empat 2 tanpa kartu lain bukan kombinasi');

// shake shot dan bom dengan joker
const sk = best(cards('K', 'K', 2, 2, 2)); assert.strictEqual(sk.combo.type, 'shake'); assert.strictEqual(sk.combo.key, 12, '2 2 2 + K K jadi shake kepala 2');
const sk2 = best(cards(4, 4, 4, 9, 2)); assert.strictEqual(sk2.combo.type, 'shake'); assert.strictEqual(sk2.combo.key, R(4), 'kepala shake adalah triple 4, joker jadi 9');
const bw = best(cards(5, 5, 6, 6, 7, 7, 8, 2)); assert.strictEqual(bw.combo.type, 'bom'); assert.strictEqual(bw.combo.len, 4);
assert.strictEqual(best(cards(5, 6, 7, 8, 2, 2, 2, 2)).combo.type, 'bom', 'bacaan ambigu memilih bom');

// pembukaan: 2 boleh jadi 3
const open = { first: true, table: null };
assert(cp(open, [], cards(2, 4, 5, 6)).ok, '2 jadi 3 memenuhi aturan kartu pertama');
assert(!cp(open, [], cards(9, 9)).ok);
assert(cp(open, [], cards(3, 2)).ok);

// melawan meja
const tbl = (cs, by = 'x') => ({ first: false, table: { by, ...classify(cs), cards: cs } });
const t7 = tbl(cards(7, 7));
assert(cp(t7, [], cards('K', 2)).ok, 'dos K+2 mengalahkan dos 7');
assert(cp(t7, [], cards(2, 2)).ok, 'dos 2 asli mengalahkan dos 7');
assert(!cp(t7, [], cards(5, 2)).ok, 'dos 5+2 kalah dari dos 7');
const tStraight = tbl(cards(5, 6, 7, 8));
assert(cp(tStraight, [], cards(6, 7, 8, 2)).ok, 'urutan 6 7 8 9 mengalahkan 5 6 7 8');
assert(!cp(tStraight, [], cards(3, 4, 5, 2)).ok);

// bom hanya memotong 2 asli, bukan kombinasi berisi joker
const bomSel = cards(5, 5, 6, 6, 7, 7, 8, 8);
assert(cp(tbl(cards(2, 2)), [], bomSel).ok, 'bom memotong dos 2');
const jokerPair = tbl(cards('A', 2));
jokerPair.table.key = best(cards('A', 2)).combo.key; jokerPair.table.type = 'pair'; jokerPair.table.len = 2;
assert(!cp(jokerPair, [], bomSel).ok, 'dos A+2 bukan 2 asli, tidak bisa dipotong bom');

// applyMove menyimpan joker dan lastMove untuk efek suara
let js = {
  phase: 'playing', code: 'W', hostId: 'a', order: ['a', 'b'], names: { a: 'A', b: 'B' }, turn: 'a', table: null,
  passed: [], bombed: [], out: [], first: false, round: 1, wins: {}, losses: {}, murni: [], log: []
};
const wsel = cards(5, 6, 7, 2); const wchk = cp(js, [], wsel);
js = applyMove(js, 'a', { type: 'play', cards: wsel, combo: wchk.combo, handLeft: 3 });
assert.strictEqual(js.seq, 1); assert.strictEqual(js.lastMove.type, 'straight'); assert.deepStrictEqual(js.table.wild, [R(8)]);
js = applyMove(js, 'b', { type: 'pass' });
assert.strictEqual(js.seq, 2); assert.strictEqual(js.lastMove.kind, 'pass');
assert.strictEqual(interpret(cards(7)).length, 1);


// ---------- pembagian bertingkat: busuk / biasa / hoki ----------
const LV = ['busuk', 'biasa', 'hoki'];
let powBusuk = 0, nBusuk = 0, powBiasa = 0, nBiasa = 0;
for (let t = 0; t < 400; t++) {
  const n = 2 + Math.floor(Math.random() * 3);
  const ids = ['a', 'b', 'c', 'd'].slice(0, n);
  const levels = {}; let hokiCount = 0;
  ids.forEach(i => { let l = LV[Math.floor(Math.random() * 3)]; if (l === 'hoki' && hokiCount >= 3) l = 'biasa'; if (l === 'hoki') hokiCount++; levels[i] = l; });
  if (ids.every(i => levels[i] === 'biasa')) continue; // semua biasa = bagi acak asli, Murni alami boleh terjadi
  const h = L.dealRigged(ids, levels);
  const flat = [].concat(...ids.map(i => h[i]));
  assert.strictEqual(new Set(flat).size, 13 * n, 'tidak ada kartu ganda');
  ids.forEach(i => {
    assert.strictEqual(h[i].length, 13);
    if (levels[i] === 'hoki') assert(L.isMurni(h[i]), 'hoki = Murni');
    else assert(!L.isMurni(h[i]), 'bukan hoki tidak boleh Murni');
    if (levels[i] === 'busuk') { powBusuk += L.handPower(h[i]); nBusuk++; }
    if (levels[i] === 'biasa') { powBiasa += L.handPower(h[i]); nBiasa++; }
  });
  const names = Object.fromEntries(ids.map(i => [i, i]));
  const gs = L.newGameState({ code: 'R', hostId: 'a' }, ids, names, h);
  const hokis = ids.filter(i => levels[i] === 'hoki');
  if (hokis.length) { assert.strictEqual(gs.phase, 'finished'); assert.strictEqual(gs.out[0], hokis[0], 'hoki selalu juara 1'); assert.deepStrictEqual(gs.murni.slice().sort(), hokis.slice().sort()); }
  else assert.strictEqual(gs.phase, 'playing');
}
assert(powBusuk / nBusuk < powBiasa / nBiasa - 3, 'kartu busuk jauh lebih lemah dari biasa');
// semua biasa = bagi normal
const hn = L.dealRigged(['a', 'b', 'c'], {}); assert.strictEqual(new Set([].concat(...Object.values(hn))).size, 39);

console.log('ALL LOGIC TESTS PASSED');
