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

console.log('ALL LOGIC TESTS PASSED');
