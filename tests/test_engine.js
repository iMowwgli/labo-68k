const M = require('../src/engine.js');
let ok = 0, ko = 0;
const eq = (name, a, b) => { if (a === b) ok++; else { ko++; console.log('KO', name, 'got', a, 'expected', b); } };
const H = M.H;
const mem0 = [[0x5000, [0x54,0xAF,0x18,0xB9,0xE7,0x21,0x48,0xC0, 0xC9,0x10,0x11,0xC8,0xD4,0x36,0x1F,0x88, 0x13,0x79,0x01,0x80,0x42,0x1A,0x2D,0x49]]];
const setup = { D: [0xFFFFFFFB, 8, 0x4444FFFE], A: [0x5000, 0x5008, 0x5010], mem: mem0 };
const row = (c, a) => Array.from(c.mem.slice(a, a + 8)).map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
let c;
c = M.runSource(' MOVE.L #$5006,-(A1)', setup); eq('ex1a', row(c, 0x5000), '54 AF 18 B9 00 00 50 06'); eq('ex1a A1', H(c.A[1]), '$00005004');
c = M.runSource(' MOVE.L $5006,2(A0)', setup); eq('ex1b', row(c, 0x5000), '54 AF 48 C0 C9 10 48 C0');
c = M.runSource(' MOVE.W #52,(A0)+', setup); eq('ex1c', row(c, 0x5000), '00 34 18 B9 E7 21 48 C0'); eq('ex1c A0', H(c.A[0]), '$00005002');
c = M.runSource(' MOVE.B -7(A1),2(A1,D0.L)', setup); eq('ex1d', row(c, 0x5000), '54 AF 18 B9 E7 AF 48 C0');
// ex2
const fl = c => '' + c.N + c.Z + c.V + c.C;
const add = (a, b, sz) => { const c = M.runSource(` MOVE.${sz} #${a},D0\n MOVE.${sz} #${b},D1\n ADD.${sz} D0,D1`); return [M.hexs(c.D[1], {B:1,W:2,L:4}[sz]), fl(c)]; };
eq('ex2a', add('$7F', '$7F', 'B').join(), '$FE,1010');
eq('ex2b', add('$7F', '$80', 'B').join(), '$FF,1000');
eq('ex2c', add('$007F', '$0080', 'W').join(), '$00FF,0000');
eq('ex2d', add('$A0101010', '$A0909090', 'L').join(), '$40A0A0A0,0011');
// course examples
eq('c1', add('$7A', '$86', 'B').join(), '$00,0101');
eq('c2', add('$9F00', '$8E00', 'W').join(), '$2D00,0011');
eq('c3', add('$70000000', '$10000000', 'L').join(), '$80000000,1010');
// ex4
const prog = `Main move.l #$52A59382,d7
part1 moveq.l #1,d1
 cmp.w #$7000,d7
 bgt part2
 moveq.l #2,d1
part2 clr.l d2
 move.l #260,d0
loop2 addq.l #1,d2
 subq.b #1,d0
 bne loop2
part3 clr.l d3
 move.l #$99999999,d0
loop3 addq.l #1,d3
 dbra d0,loop3 ; DBRA = DBF
part4 move.l #$12345678,d4
 ror.w #4,d4
 ror.l #8,d4
 swap d4
 rol.b #4,d4
 ror.l #8,d4`;
c = M.runSource(prog);
eq('d1', H(c.D[1]), '$00000002'); eq('d2', H(c.D[2]), '$00000004'); eq('d3', H(c.D[3]), '$0000999A'); eq('d4', H(c.D[4]), '$21348567');
// course 4.x examples
const s2 = { D: [0x0000FFFF, 4, 0xFFFFF000], A: [0x1000, 0x1008, 0x1010], mem: [[0x1000, [0x21,0x45,0x87,0xAF,0xB5,0xF3,0x3C,0x32,0xAD,0x45,0x39,0x98,0x9A,0x9B,0x9C,0x9D,0x03,0x69,0x01,0x00,0x12,0x0A,0x0D,0xC9]]] };
c = M.runSource(' MOVE.L -(A2),-(A2)', s2); eq('4.8', row(c, 0x1008), '9A 9B 9C 9D 9A 9B 9C 9D'); eq('4.8a', H(c.A[2]), '$00001008');
c = M.runSource(' MOVE.B 5(A1),-1(A1,D0.W)', s2); eq('4.9', row(c, 0x1000), '21 45 87 AF B5 F3 9B 32');
c = M.runSource(' MOVE.W 2(A1,D1.L),-6(A2)', s2); eq('4.10', row(c, 0x1008), 'AD 45 9C 9D 9A 9B 9C 9D');
c = M.runSource(' MOVE.W $1000(PC),$100A', s2); eq('4.11', row(c, 0x1008), 'AD 45 21 45 9A 9B 9C 9D');
c = M.runSource(' MOVE.W A1,D2', s2); eq('4.1', H(c.D[2]), '$FFFF1008');
// stack / subroutine / movem
c = M.runSource(`Main moveq.l #15,d1
 moveq.l #25,d2
 jsr GetMin
 move.l d0,d5
 moveq.l #30,d1
 moveq.l #16,d2
 bsr GetMin
 move.l d0,d6
 bra Fin
GetMin cmp.l d1,d2
 ble d2min
 move.l d1,d0
 rts
d2min move.l d2,d0
 rts
Fin nop`);
eq('getmin', c.D[5] + ',' + c.D[6], '15,16');
c = M.runSource(` move.l #1,d1
 move.l #2,d2
 move.l #$3000,a4
 movem.l d1-d2/a4,-(a7)
 clr.l d1
 clr.l d2
 move.l #0,a4
 movem.l (a7)+,d1-d2/a4`);
eq('movem', c.D[1] + ',' + c.D[2] + ',' + H(c.A[4]) + ',' + H(c.A[7]), '1,2,$00003000,$00100000');
// DC / strings / trap
c = M.runSource(` lea msg,a1
 move.b #14,d0
 trap #15
 moveq #3,d0
 move.l #-42,d1
 trap #15
 rts
msg dc.b 'Salut ',0`);
eq('trap', c.out, 'Salut -42');
// div/mul
c = M.runSource(' move.l #100,d0\n divu #7,d0\n move.l #-7,d1\n muls #3,d1');
eq('divu', H(c.D[0]), '$0002000E'); eq('muls', c.D[1] | 0, -21);
// shifts
c = M.runSource(' move.b #$81,d0\n asl.b #1,d0'); eq('asl', fl(c) + c.X, '00111');
c = M.runSource(' move.w #$8000,d0\n asr.w #4,d0'); eq('asr', H(c.D[0]), '$0000F800');
c = M.runSource(' move.l #$80000001,d0\n ror.l #1,d0'); eq('ror', H(c.D[0]), '$C0000000');
// canon
eq('canon1', M.canon('MOVEM.L (A7)+,A1-A4'), M.canon('movem.l (sp)+,a4/a3/a2/a1'));
eq('canon2', M.canon('move.l d0,-(a7)'), M.canon('MOVE.L D0,-(SP)'));
eq('canon3', M.canon('dbra d0,loop'), M.canon('DBF D0,LOOP'));
// errors
try { M.assemble(' move.w d0,#5'); ko++; } catch (e) { ok++; }
try { M.assemble(' addq.l #9,d0'); ko++; } catch (e) { ok++; }
try { M.runSource(' move.w #1,$5001'); ko++; } catch (e) { eq('oddmsg', e instanceof M.RunError, true); }
console.log('OK', ok, 'KO', ko);
