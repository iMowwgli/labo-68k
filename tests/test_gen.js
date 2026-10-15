global.M68K = require('../src/engine.js');
const G = require('../src/gen.js');
let ko = 0;
// Ex1 : 300 générations
for (let i = 0; i < 300; i++) { const g = G.genEx1(); G.explain1(g.st, g.ins); if (!g.res.changed) { ko++; console.log('nochange', g.ins); } }
const g = G.genEx1(); console.log(g.ins, g.res.regChanged, JSON.stringify(G.explain1(g.st, g.ins)));
// explain exam instr
const st = { D: [0xFFFFFFFB, 8, 0x4444FFFE], A: [0x5000, 0x5008, 0x5010], base: 0x5000, mem: [0x54,0xAF,0x18,0xB9,0xE7,0x21,0x48,0xC0,0xC9,0x10,0x11,0xC8,0xD4,0x36,0x1F,0x88,0x13,0x79,0x01,0x80,0x42,0x1A,0x2D,0x49] };
console.log(JSON.stringify(G.explain1(st, 'MOVE.B -7(A1),2(A1,D0.L)')));
// Ex2
for (let i = 0; i < 200; i++) { const q = G.genEx2(true); G.explain2(q); }
console.log(G.explain2(G.solve2('ADD', 0x7F, 0x7F, 1)));
// Ex3
for (const f of G.QGEN) { const q = f(); const ok = G.check3(q, q.show.replace(/ \(.*\)$/, '')); if (!ok) { ko++; console.log('Q3 KO', q.q, q.show); } }
const q = G.QGEN[2](); console.log(q.q, G.check3(q, q.show), G.check3(q, 'movem.l (sp)+,' + q.show.split(',')[1].split('-').reverse().join('-')));
// Ex4
for (let i = 0; i < 60; i++) G.genEx4();
const e4 = G.genEx4(); console.log(e4.prog); console.log(e4.ans.map(v => v.toString(16))); console.log(JSON.stringify(e4.ex, null, 1));
// exam
G.genExam();
// challenges: reference solutions
const SOL = {
  abs: 'Abs tst.l d0\n bpl .ok\n neg.l d0\n.ok rts',
  max: 'Max move.l d1,d0\n cmp.l d2,d0\n bge .f\n move.l d2,d0\n.f rts',
  strlen: 'StrLen move.l a0,-(a7)\n moveq #0,d0\n.l tst.b (a0)+\n beq .e\n addq.l #1,d0\n bra .l\n.e move.l (a7)+,a0\n rts',
  sum: 'Sum movem.l d1/d2/a0,-(a7)\n moveq #0,d0\n subq.w #1,d1\n.l move.w (a0)+,d2\n ext.l d2\n add.l d2,d0\n dbra d1,.l\n movem.l (a7)+,d1/d2/a0\n rts',
  popcnt: 'BitCount movem.l d0/d2,-(a7)\n moveq #0,d1\n moveq #31,d2\n.l lsr.l #1,d0\n bcc .n\n addq.l #1,d1\n.n dbra d2,.l\n movem.l (a7)+,d0/d2\n rts',
  bswap: 'ByteSwap ror.w #8,d0\n swap d0\n ror.w #8,d0\n rts',
  upper: 'ToUpper movem.l d0/a0,-(a7)\n.l move.b (a0),d0\n beq .e\n cmp.b #\'a\',d0\n blo .n\n cmp.b #\'z\',d0\n bhi .n\n sub.b #32,d0\n move.b d0,(a0)\n.n addq.l #1,a0\n bra .l\n.e movem.l (a7)+,d0/a0\n rts',
  count: 'CountChar move.l a0,-(a7)\n moveq #0,d0\n.l tst.b (a0)\n beq .e\n cmp.b (a0)+,d1\n bne .l\n addq.l #1,d0\n bra .l\n.e move.l (a7)+,a0\n rts',
  fact: 'Fact movem.l d1/d2,-(a7)\n and.l #$FFFF,d0\n move.l d0,d2\n moveq #1,d0\n moveq #1,d1\n.l cmp.w d2,d1\n bhi .e\n mulu d1,d0\n addq.w #1,d1\n bra .l\n.e movem.l (a7)+,d1/d2\n rts',
  pal: 'IsPal movem.l a0/a1,-(a7)\n move.l a0,a1\n.f tst.b (a1)+\n bne .f\n subq.l #1,a1\n.l cmp.l a0,a1\n bls .y\n move.b -(a1),d0\n cmp.b (a0)+,d0\n bne .n\n bra .l\n.y moveq #1,d0\n bra .e\n.n moveq #0,d0\n.e movem.l (a7)+,a0/a1\n rts',
  strcpy: 'StrCpy movem.l a0/a1,-(a7)\n.l move.b (a0)+,(a1)+\n bne .l\n movem.l (a7)+,a0/a1\n rts',
  atoi: 'Atoi movem.l d1/d2/a0,-(a7)\n moveq #0,d0\n.l moveq #0,d1\n move.b (a0)+,d1\n beq .e\n sub.b #\'0\',d1\n move.l d0,d2\n lsl.l #3,d0\n add.l d2,d0\n add.l d2,d0\n add.l d1,d0\n bra .l\n.e movem.l (a7)+,d1/d2/a0\n rts',
};
for (const ch of G.CH) {
  const r = G.runChallenge(ch, SOL[ch.id]);
  if (r.fatal || r.passed !== r.total) { ko++; console.log('CH KO', ch.id, r.fatal, r.report.filter(x => !x.ok)); }
  const r2 = G.runChallenge(ch, ch.tpl); // template must assemble
  if (r2.fatal) { ko++; console.log('TPL fatal', ch.id, r2.fatal); }
}
console.log('KO', ko);
