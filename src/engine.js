/* ==========================================================================
   LABO-68K — Moteur 68000 (assembleur + CPU) — 100 % JavaScript, sans dépendance
   ========================================================================== */
const M68K = (function () {
  'use strict';
  const MASK = { 1: 0xFF, 2: 0xFFFF, 4: 0xFFFFFFFF };
  const MSB = { 1: 0x80, 2: 0x8000, 4: 0x80000000 };
  const SZ = { B: 1, W: 2, L: 4, S: 1 };
  const tr = (v, s) => (s === 4 ? v >>> 0 : (v & MASK[s]) >>> 0);
  const sx = (v, s) => {
    if (s === 1) { v &= 0xFF; return v & 0x80 ? v - 256 : v; }
    if (s === 2) { v &= 0xFFFF; return v & 0x8000 ? v - 65536 : v; }
    return v | 0;
  };
  const isNeg = (v, s) => ((tr(v, s) & MSB[s]) >>> 0) !== 0;
  const H = (v, n = 8) => '$' + (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
  const hexs = (v, s) => H(tr(v, s), s * 2);

  class AsmError extends Error { constructor(m, line) { super(m); this.line = line; } }
  class RunError extends Error { constructor(m, line) { super(m); this.line = line; } }

  const MNEMS = new Set(('ABCD ADD ADDA ADDI ADDQ ADDX AND ANDI ASL ASR BCHG BCLR BSET BTST BRA BSR CHK CLR CMP CMPA CMPI CMPM DIVS DIVU EOR EORI EXG EXT ILLEGAL JMP JSR LEA LINK LSL LSR MOVE MOVEA MOVEM MOVEQ MULS MULU NEG NEGX NOP NOT OR ORI PEA RESET ROL ROR ROXL ROXR RTE RTR RTS STOP SUB SUBA SUBI SUBQ SUBX SWAP TAS TRAP TRAPV TST UNLK SIMHALT ORG EQU DC DS END DBRA').split(' '));
  const CCS = ['T', 'F', 'HI', 'LS', 'CC', 'HS', 'CS', 'LO', 'NE', 'EQ', 'VC', 'VS', 'PL', 'MI', 'GE', 'LT', 'GT', 'LE'];
  function ccOf(op) {
    if (op === 'DBRA') return { kind: 'DB', cc: 'F' };
    if (MNEMS.has(op)) return null;
    if (op[0] === 'B' && CCS.includes(op.slice(1)) && op !== 'BT' && op !== 'BF') return { kind: 'B', cc: op.slice(1) };
    if (op.startsWith('DB') && CCS.includes(op.slice(2))) return { kind: 'DB', cc: op.slice(2) };
    if (op[0] === 'S' && CCS.includes(op.slice(1))) return { kind: 'S', cc: op.slice(1) };
    return null;
  }
  const isMnem = tok => { const b = tok.toUpperCase().split('.')[0]; return MNEMS.has(b) || !!ccOf(b); };

  /* ---------------- expressions ---------------- */
  function evalExpr(str, sym, line) {
    const s = String(str).trim(); let i = 0;
    const ws = () => { while (s[i] === ' ') i++; };
    function prim() {
      ws(); const c = s[i];
      if (c === '-') { i++; return -prim(); }
      if (c === '+') { i++; return prim(); }
      if (c === '~') { i++; return ~prim(); }
      if (c === '(') { i++; const v = expr(); ws(); if (s[i] !== ')') throw new AsmError('Parenthèse manquante dans « ' + str + ' »', line); i++; return v; }
      const rest = s.slice(i); let m;
      if ((m = /^\$([0-9a-f]+)/i.exec(rest))) { i += m[0].length; return parseInt(m[1], 16); }
      if ((m = /^%([01]+)/.exec(rest))) { i += m[0].length; return parseInt(m[1], 2); }
      if ((m = /^@([0-7]+)/.exec(rest))) { i += m[0].length; return parseInt(m[1], 8); }
      if ((m = /^[0-9]+/.exec(rest))) {
        i += m[0].length;
        if (/^[0-9a-f]/i.test(s.slice(i))) throw new AsmError('Nombre invalide « ' + str + ' » (oubli du $ pour l\'hexadécimal ?)', line);
        return parseInt(m[0], 10);
      }
      if ((m = /^'([^']{1,4})'/.exec(rest))) { i += m[0].length; let v = 0; for (const ch of m[1]) v = v * 256 + (ch.charCodeAt(0) & 0xFF); return v; }
      if ((m = /^[A-Za-z_.][A-Za-z0-9_.]*/.exec(rest))) {
        i += m[0].length; const k = m[0].toUpperCase();
        if (Object.prototype.hasOwnProperty.call(sym, k)) return sym[k];
        throw new AsmError('Étiquette inconnue : « ' + m[0] + ' »', line);
      }
      throw new AsmError('Expression invalide : « ' + str + ' »', line);
    }
    function term() {
      let v = prim();
      for (;;) {
        ws(); const c = s[i];
        if (c === '*') { i++; v = v * prim(); }
        else if (c === '/') { i++; const d = prim(); if (!d) throw new AsmError('Division par zéro dans une expression', line); v = Math.trunc(v / d); }
        else if (c === '&') { i++; v = v & prim(); }
        else if (c === '<' && s[i + 1] === '<') { i += 2; v = v << prim(); }
        else if (c === '>' && s[i + 1] === '>') { i += 2; v = v >> prim(); }
        else return v;
      }
    }
    function expr() {
      let v = term();
      for (;;) {
        ws(); const c = s[i];
        if (c === '+') { i++; v = v + term(); }
        else if (c === '-') { i++; v = v - term(); }
        else if (c === '|') { i++; v = v | term(); }
        else return v;
      }
    }
    if (!s) throw new AsmError('Expression vide', line);
    const v = expr(); ws();
    if (i < s.length) throw new AsmError('Expression invalide : « ' + str + ' »', line);
    return v;
  }

  /* ---------------- opérandes ---------------- */
  const anIdx = t => (t.toUpperCase() === 'SP' ? 7 : +t[1]);
  const regOf = t => { t = t.toUpperCase(); if (t === 'SP') return { t: 'a', n: 7 }; return { t: t[0] === 'D' ? 'd' : 'a', n: +t[1] }; };
  function parseList(t, line) {
    let mask = 0;
    const idx = r => { const g = regOf(r); return (g.t === 'd' ? 0 : 8) + g.n; };
    for (const part of t.split('/')) {
      const rg = part.split('-');
      if (rg.length === 1) mask |= 1 << idx(rg[0]);
      else if (rg.length === 2) {
        let a = idx(rg[0]), b = idx(rg[1]);
        if ((a < 8) !== (b < 8)) throw new AsmError('Plage de registres invalide « ' + part + ' »', line);
        if (a > b) [a, b] = [b, a];
        for (let k = a; k <= b; k++) mask |= 1 << k;
      } else throw new AsmError('Liste de registres invalide « ' + t + ' »', line);
    }
    return mask;
  }
  function mkDisp(e, base, xr, xs) {
    e = (e || '').trim() || '0';
    const B = base.toUpperCase();
    if (B === 'PC') return { m: 'pc', e, x: xr ? regOf(xr) : null, xs: xs && xs.toUpperCase() === 'L' ? 4 : 2 };
    if (xr) return { m: 'idx', r: anIdx(base), e, x: regOf(xr), xs: xs && xs.toUpperCase() === 'L' ? 4 : 2 };
    return { m: 'disp', r: anIdx(base), e };
  }
  function parseOperand(raw, line) {
    const t = raw.trim(), u = t.toUpperCase(); let m;
    if (!t) throw new AsmError('Opérande vide (virgule en trop ?)', line);
    if (t[0] === '#') return { m: 'imm', e: t.slice(1) };
    if (/^D[0-7]$/i.test(t)) return { m: 'dn', r: +t[1] };
    if (/^(A[0-7]|SP)$/i.test(t)) return { m: 'an', r: anIdx(t) };
    if (u === 'CCR') return { m: 'ccr' };
    if (u === 'SR') return { m: 'sr' };
    if (u === 'USP') return { m: 'usp' };
    if ((m = /^\(\s*(A[0-7]|SP)\s*\)$/i.exec(t))) return { m: 'ind', r: anIdx(m[1]) };
    if ((m = /^\(\s*(A[0-7]|SP)\s*\)\+$/i.exec(t))) return { m: 'post', r: anIdx(m[1]) };
    if ((m = /^-\(\s*(A[0-7]|SP)\s*\)$/i.exec(t))) return { m: 'pre', r: anIdx(m[1]) };
    if (/^(D[0-7]|A[0-7]|SP)([\/-](D[0-7]|A[0-7]|SP))+$/i.test(t)) return { m: 'list', mask: parseList(t, line) };
    if ((m = /^\(\s*(A[0-7]|SP|PC)\s*,\s*(D[0-7]|A[0-7]|SP)(?:\.([WL]))?\s*\)$/i.exec(t))) return mkDisp('0', m[1], m[2], m[3]);
    if ((m = /^\(([^(),]*),\s*(A[0-7]|SP|PC)\s*(?:,\s*(D[0-7]|A[0-7]|SP)(?:\.([WL]))?)?\s*\)$/i.exec(t))) return mkDisp(m[1], m[2], m[3], m[4]);
    if ((m = /^(.*?)\(\s*(A[0-7]|SP|PC)\s*(?:,\s*(D[0-7]|A[0-7]|SP)(?:\.([WL]))?)?\s*\)$/i.exec(t))) return mkDisp(m[1], m[2], m[3], m[4]);
    if ((m = /^(.+)\.([WL])$/i.exec(t)) && t[0] !== "'" && !/^[A-Za-z_]/.test(t)) return { m: 'abs', e: m[1] };
    return { m: 'abs', e: t };
  }

  /* ---------------- lignes ---------------- */
  function stripComment(line) {
    if (/^\s*\*/.test(line)) return '';
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === q) q = null; }
      else if (c === "'" || c === '"') q = c;
      else if (c === ';') return line.slice(0, i);
    }
    return line;
  }
  function takeOperandField(s) {
    let depth = 0, q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if ((c === ' ') && depth === 0) {
        let j = i - 1; while (j >= 0 && s[j] === ' ') j--;
        let k = i + 1; while (k < s.length && s[k] === ' ') k++;
        if (s[j] === ',' || s[k] === ',') continue;
        return s.slice(0, i);
      }
    }
    return s;
  }
  function splitOperands(s) {
    const out = []; let depth = 0, cur = '', q = null;
    for (const c of s) {
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim() !== '' || out.length) out.push(cur.trim());
    return out;
  }
  function parseLine(line, no) {
    const raw = stripComment(line).replace(/\t/g, ' ').replace(/\s+$/, '');
    if (!raw.trim()) return null;
    let label = null, rest = raw, m;
    if ((m = /^\s*([A-Za-z_.][\w.]*)\s+EQU\s+(.*)$/i.exec(raw))) return { label: m[1], op: 'EQU', size: null, ops: [m[2].trim()], no };
    if (raw[0] !== ' ' && (m = /^([A-Za-z_.][\w.]*)(:?)/.exec(raw))) {
      if (m[2] === ':' || !isMnem(m[1])) { label = m[1]; rest = raw.slice(m[0].length); }
    } else if ((m = /^\s+([A-Za-z_.][\w.]*):/.exec(raw))) { label = m[1]; rest = raw.slice(m[0].length); }
    else if (raw[0] !== ' ' && /^[^A-Za-z_.\s]/.test(raw)) throw new AsmError('Étiquette invalide en début de ligne', no);
    rest = rest.trim();
    if (!rest) return { label, op: null, no };
    const mm = /^([A-Za-z]+)(?:\.([A-Za-z]+))?(?=\s|$)/.exec(rest);
    if (!mm) throw new AsmError('Instruction illisible : « ' + rest + ' »', no);
    const op = mm[1].toUpperCase();
    let size = mm[2] ? mm[2].toUpperCase() : null;
    if (size && !SZ[size]) throw new AsmError('Taille inconnue « .' + mm[2] + ' » (utilise .B, .W ou .L)', no);
    if (!isMnem(op)) throw new AsmError('Instruction inconnue : « ' + mm[1] + ' »', no);
    const opsStr = takeOperandField(rest.slice(mm[0].length).trim());
    return { label, op, size, ops: opsStr ? splitOperands(opsStr) : [], no, src: line };
  }

  /* ---------------- assembleur ---------------- */
  const ARITY0 = new Set(['NOP', 'RTS', 'RTR', 'RTE', 'RESET', 'TRAPV', 'ILLEGAL', 'SIMHALT']);
  const ARITY1 = new Set(['CLR', 'NEG', 'NEGX', 'NOT', 'TST', 'EXT', 'SWAP', 'JMP', 'JSR', 'PEA', 'BRA', 'BSR', 'TRAP', 'STOP', 'UNLK', 'TAS']);
  const SHIFTS = new Set(['ASL', 'ASR', 'LSL', 'LSR', 'ROL', 'ROR', 'ROXL', 'ROXR']);
  const MEMMODES = new Set(['ind', 'post', 'pre', 'disp', 'idx', 'abs', 'pc']);
  function defSize(op) {
    if (['MOVEQ', 'LEA', 'PEA', 'EXG'].includes(op)) return 4;
    if (op === 'TAS') return 1;
    const c = ccOf(op); if (c && c.kind === 'S') return 1;
    return 2;
  }
  function estLen(p) {
    let n = 2;
    const q = ['MOVEQ', 'ADDQ', 'SUBQ', 'TRAP'].includes(p.op) || SHIFTS.has(p.op);
    if (p.op === 'MOVEM') n += 2;
    for (const o of p.opnds) {
      if (o.m === 'imm' && !q) n += p.s === 4 ? 4 : 2;
      else if (o.m === 'abs') n += (['BRA', 'BSR'].includes(p.op) || (ccOf(p.op) && ccOf(p.op).kind !== 'S')) ? 2 : 4;
      else if (['disp', 'idx', 'pc'].includes(o.m)) n += 2;
    }
    return n;
  }
  function assemble(src, opts = {}) {
    const lines = src.replace(/\r/g, '').split('\n');
    const sym = {}; const ins = []; const data = []; const lineAddr = {};
    let pc = (opts.org ?? 0x1000) >>> 0, pending = [], endExpr = null, start = null;
    const def = (name, v, no) => {
      const k = name.toUpperCase();
      if (Object.prototype.hasOwnProperty.call(sym, k)) throw new AsmError('Étiquette définie deux fois : « ' + name + ' »', no);
      sym[k] = v;
    };
    const flush = () => { for (const [n, no] of pending) def(n, pc, no); pending = []; };
    for (let i = 0; i < lines.length; i++) {
      const p = parseLine(lines[i], i + 1);
      if (!p) continue;
      if (p.op === 'EQU') { if (!p.label) throw new AsmError('EQU sans étiquette', p.no); def(p.label, evalExpr(p.ops[0], sym, p.no), p.no); continue; }
      if (p.label && p.op !== 'ORG') pending.push([p.label, p.no]);
      if (!p.op) continue;
      if (p.op === 'ORG') { pc = evalExpr(p.ops[0], sym, p.no) >>> 0; if (p.label) pending.push([p.label, p.no]); flush(); continue; }
      if (p.op === 'END') { flush(); endExpr = p.ops[0] ? [p.ops[0], p.no] : null; break; }
      if (p.op === 'DC' || p.op === 'DS') {
        const s = SZ[p.size || 'W']; if (s > 1 && (pc & 1)) pc++;
        flush(); p.addr = pc; lineAddr[p.no] = pc;
        if (p.op === 'DS') { p.count = evalExpr(p.ops[0] ?? '', sym, p.no); if (p.count < 0) throw new AsmError('DS négatif', p.no); pc += s * p.count; }
        else {
          p.s = s; let n = 0;
          for (const o of p.ops) {
            if (/^'.*'$|^".*"$/.test(o)) { const L = o.length - 2; n += Math.ceil(L / s) * s; }
            else n += s;
          }
          p.n = n; data.push(p); pc += n;
        }
        continue;
      }
      if (pc & 1) pc++;
      flush();
      p.addr = pc; lineAddr[p.no] = pc;
      p.s = p.size ? SZ[p.size] : defSize(p.op);
      p.opnds = p.ops.map(o => parseOperand(o, p.no));
      p.len = estLen(p); pc += p.len; ins.push(p);
      if (start === null) start = p.addr;
    }
    flush();
    const endAddr = pc;
    const byAddr = new Map(ins.map(x => [x.addr, x]));
    // passe 2
    for (const p of ins) {
      for (const o of p.opnds) if (o.e !== undefined) o.v = evalExpr(o.e, sym, p.no);
      validate(p, byAddr);
    }
    for (const d of data) {
      const bytes = [];
      for (const o of d.ops) {
        if (/^'.*'$|^".*"$/.test(o)) {
          const str = o.slice(1, -1); for (const ch of str) bytes.push(ch.charCodeAt(0) & 0xFF);
          while (bytes.length % d.s) bytes.push(0);
        } else {
          const v = evalExpr(o, sym, d.no);
          for (let k = d.s - 1; k >= 0; k--) bytes.push(Math.floor(tr(v, d.s) / Math.pow(256, k)) & 0xFF);
        }
      }
      d.bytes = bytes;
    }
    if (endExpr) start = evalExpr(endExpr[0], sym, endExpr[1]) >>> 0;
    if (opts.entry && sym[opts.entry.toUpperCase()] !== undefined) start = sym[opts.entry.toUpperCase()];
    if (start === null) start = endAddr;
    return { ins, data, sym, byAddr, start, endAddr, lineAddr };
  }
  function validate(p, byAddr) {
    const op = p.op, o = p.opnds, n = o.length, E = m => { throw new AsmError(m, p.no); };
    const cc = ccOf(op);
    if (['ORG', 'EQU', 'DC', 'DS', 'END'].includes(op)) return;
    if (ARITY0.has(op) && n !== 0) E(op + ' ne prend pas d\'opérande');
    else if (ARITY1.has(op) && n !== 1) E(op + ' attend 1 opérande');
    else if (SHIFTS.has(op)) { if (n < 1 || n > 2) E(op + ' attend 1 ou 2 opérandes'); }
    else if (cc && cc.kind !== 'DB' && n !== 1) E(op + ' attend 1 opérande');
    else if (!ARITY0.has(op) && !ARITY1.has(op) && !SHIFTS.has(op) && !(cc && cc.kind !== 'DB') && n !== 2) E(op + ' attend 2 opérandes (source,destination)');
    if (n === 2 && o[1].m === 'imm') E('Une donnée immédiate ne peut jamais être une destination');
    if (['ADDQ', 'SUBQ'].includes(op) && (o[0].m !== 'imm' || o[0].v < 1 || o[0].v > 8)) E(op + ' : la donnée immédiate doit être entre 1 et 8');
    if (op === 'MOVEQ') { if (o[0].m !== 'imm' || o[1].m !== 'dn') E('Syntaxe : MOVEQ #n,Dn'); if (o[0].v < -128 || o[0].v > 255) E('MOVEQ : la donnée doit tenir sur 8 bits signés (−128 à 127)'); }
    if (op === 'LEA') { if (o[1].m !== 'an') E('LEA : la destination doit être un registre d\'adresse'); if (!MEMMODES.has(o[0].m)) E('LEA : la source doit désigner un emplacement mémoire'); }
    if (SHIFTS.has(op) && n === 2) {
      if (o[1].m !== 'dn') E(op + ' : la destination doit être un registre de donnée');
      if (o[0].m === 'imm' && (o[0].v < 1 || o[0].v > 8)) E(op + ' : le nombre de décalages immédiat doit être entre 1 et 8');
      if (o[0].m !== 'imm' && o[0].m !== 'dn') E(op + ' : le compteur doit être #n ou Dn');
    }
    if (SHIFTS.has(op) && n === 1 && !MEMMODES.has(o[0].m)) E(op + ' sur un registre : précise le nombre (ex : ' + op + '.L #1,D0)');
    if (n === 2 && o[1].m === 'an' && p.s === 1 && ['MOVE', 'MOVEA', 'ADD', 'SUB', 'CMP', 'ADDA', 'SUBA', 'CMPA'].includes(op)) E('Un registre d\'adresse ne s\'utilise pas en .B');
    if (['ADDA', 'SUBA', 'CMPA', 'MOVEA'].includes(op) && o[1].m !== 'an') E(op + ' : la destination doit être An');
    if (cc && cc.kind === 'DB') { if (n !== 2 || o[0].m !== 'dn') E('Syntaxe : ' + op + ' Dn,étiquette'); if (!byAddr.has(o[1].v >>> 0)) E('Cible de ' + op + ' invalide'); }
    if ((op === 'BRA' || op === 'BSR' || (cc && cc.kind === 'B')) && !byAddr.has(o[0].v >>> 0)) E('Cible de branchement invalide (étiquette d\'une instruction attendue)');
    if (['EXT', 'SWAP'].includes(op) && o[0].m !== 'dn') E(op + ' fonctionne uniquement sur un registre de donnée');
    if (op === 'EXT' && p.s === 1) E('EXT : taille .W ou .L');
    if (['MULU', 'MULS', 'DIVU', 'DIVS'].includes(op) && o[1].m !== 'dn') E(op + ' : la destination doit être Dn');
    if (op === 'MOVEM') {
      const isL = x => ['list', 'dn', 'an'].includes(x.m);
      if (!(isL(o[0]) && MEMMODES.has(o[1].m)) && !(MEMMODES.has(o[0].m) && isL(o[1]))) E('MOVEM : il faut une liste de registres et un emplacement mémoire');
      if (isL(o[0]) && o[1].m === 'post') E('MOVEM registres → mémoire n\'accepte pas (An)+');
      if (isL(o[1]) && o[0].m === 'pre') E('MOVEM mémoire → registres n\'accepte pas -(An)');
      if (p.s === 1) E('MOVEM : taille .W ou .L uniquement');
    }
    if (op === 'CLR' && o[0].m === 'an') E('CLR ne fonctionne pas sur An (utilise SUBA.L An,An ou MOVEA.L #0,An)');
    for (const x of o) {
      if (x.m === 'disp' && (x.v < -32768 || x.v > 32767)) E('Déplacement hors limites (16 bits signés)');
      if (x.m === 'idx' && (x.v < -128 || x.v > 127)) E('Déplacement hors limites (8 bits signés avec index)');
    }
  }

  /* ---------------- CPU ---------------- */
  const INIT_SP = 0x00100000;
  class CPU {
    constructor() { this.mem = new Uint8Array(0x1000000); this.reset(); }
    reset() {
      this.D = [0, 0, 0, 0, 0, 0, 0, 0]; this.A = [0, 0, 0, 0, 0, 0, 0, INIT_SP];
      this.pc = 0; this.X = this.N = this.Z = this.V = this.C = 0; this.SRhi = 0x27;
      this.halted = false; this.haltMsg = ''; this.out = ''; this.steps = 0;
      this.hist = null; this.cur = null; this.trace = null; this.writes = new Set();
      this.initSP = INIT_SP;
    }
    load(prog, clearMem = true) {
      if (clearMem) this.mem.fill(0);
      this.reset(); this.prog = prog;
      for (const d of prog.data) d.bytes.forEach((b, k) => { this.mem[(d.addr + k) & 0xFFFFFF] = b; });
      this.pc = prog.start;
    }
    get ccr() { return (this.X << 4) | (this.N << 3) | (this.Z << 2) | (this.V << 1) | this.C; }
    set ccr(v) { this.X = (v >> 4) & 1; this.N = (v >> 3) & 1; this.Z = (v >> 2) & 1; this.V = (v >> 1) & 1; this.C = v & 1; }
    get sr() { return ((this.SRhi << 8) | this.ccr) & 0xFFFF; }
    rb(a) { a &= 0xFFFFFF; const v = this.mem[a]; if (this.trace) this.trace.push({ t: 'r', a, s: 1, v }); return v; }
    chk(a, s, w) { if (s > 1 && (a & 1)) throw new RunError(`Erreur d'adresse : ${w ? 'écriture' : 'lecture'} ${s === 2 ? 'd\'un mot (.W)' : 'd\'un mot long (.L)'} à l'adresse impaire ${H(a, 6)}`); }
    read(a, s) {
      a &= 0xFFFFFF; this.chk(a, s, false); let v = 0;
      for (let k = 0; k < s; k++) v = v * 256 + this.mem[(a + k) & 0xFFFFFF];
      if (this.trace) this.trace.push({ t: 'r', a, s, v });
      return v >>> 0;
    }
    write(a, s, v) {
      a &= 0xFFFFFF; this.chk(a, s, true); v = tr(v, s);
      if (this.trace) this.trace.push({ t: 'w', a, s, v });
      for (let k = s - 1; k >= 0; k--) {
        const ad = (a + k) & 0xFFFFFF;
        if (this.hist) this.hist.mem.push([ad, this.mem[ad]]);
        this.mem[ad] = v & 0xFF; this.writes.add(ad); v = Math.floor(v / 256);
      }
    }
    push(v, s = 4) { this.A[7] = (this.A[7] - s) >>> 0; this.write(this.A[7], s, v); }
    pop(s = 4) { const v = this.read(this.A[7], s); this.A[7] = (this.A[7] + s) >>> 0; return v; }
    loc(o, s) {
      switch (o.m) {
        case 'dn': return { k: 'd', r: o.r };
        case 'an': return { k: 'a', r: o.r };
        case 'imm': return { k: 'i', v: tr(o.v, s) };
        case 'ind': return { k: 'm', a: this.A[o.r] };
        case 'post': { const a = this.A[o.r]; this.A[o.r] = (a + ((s === 1 && o.r === 7) ? 2 : s)) >>> 0; return { k: 'm', a }; }
        case 'pre': { this.A[o.r] = (this.A[o.r] - ((s === 1 && o.r === 7) ? 2 : s)) >>> 0; return { k: 'm', a: this.A[o.r] }; }
        case 'disp': return { k: 'm', a: (this.A[o.r] + o.v) >>> 0 };
        case 'idx': { const xr = o.x.t === 'd' ? this.D[o.x.n] : this.A[o.x.n]; return { k: 'm', a: (this.A[o.r] + o.v + (o.xs === 2 ? sx(xr, 2) : (xr | 0))) >>> 0 }; }
        case 'pc': { let a = o.v; if (o.x) { const xr = o.x.t === 'd' ? this.D[o.x.n] : this.A[o.x.n]; a += o.xs === 2 ? sx(xr, 2) : (xr | 0); } return { k: 'm', a: a >>> 0 }; }
        case 'abs': return { k: 'm', a: o.v >>> 0 };
        case 'ccr': return { k: 'ccr' };
        case 'sr': return { k: 'sr' };
      }
      throw new RunError('Mode d\'adressage non supporté ici');
    }
    get(L, s) {
      switch (L.k) {
        case 'd': return tr(this.D[L.r], s);
        case 'a': return tr(this.A[L.r], s);
        case 'i': return L.v;
        case 'm': return this.read(L.a, s);
        case 'ccr': return this.ccr;
        case 'sr': return this.sr;
      }
    }
    put(L, s, v) {
      v = tr(v, s);
      if (L.k === 'd') this.D[L.r] = s === 4 ? v : ((this.D[L.r] & ~MASK[s]) | v) >>> 0;
      else if (L.k === 'a') this.A[L.r] = v >>> 0;
      else if (L.k === 'm') this.write(L.a, s, v);
      else if (L.k === 'ccr') this.ccr = v & 0x1F;
      else if (L.k === 'sr') { this.ccr = v & 0x1F; this.SRhi = (v >> 8) & 0xFF; }
      else throw new RunError('Destination invalide');
    }
    nz(r, s) { this.N = isNeg(r, s) ? 1 : 0; this.Z = tr(r, s) === 0 ? 1 : 0; }
    logic(r, s) { this.nz(r, s); this.V = 0; this.C = 0; }
    addf(a, b, s, x = 0, isX = false) {
      const sum = tr(a, s) + tr(b, s) + x, r = tr(sum, s);
      this.C = this.X = sum > MASK[s] ? 1 : 0;
      this.V = (isNeg(a, s) === isNeg(b, s) && isNeg(r, s) !== isNeg(a, s)) ? 1 : 0;
      this.N = isNeg(r, s) ? 1 : 0;
      if (isX) { if (r !== 0) this.Z = 0; } else this.Z = r === 0 ? 1 : 0;
      return r;
    }
    subf(d, src, s, x = 0, isCmp = false, isX = false) {
      const r = tr(tr(d, s) - tr(src, s) - x, s);
      const C = tr(src, s) + x > tr(d, s) ? 1 : 0;
      this.C = C; if (!isCmp) this.X = C;
      this.V = (isNeg(src, s) !== isNeg(d, s) && isNeg(r, s) !== isNeg(d, s)) ? 1 : 0;
      this.N = isNeg(r, s) ? 1 : 0;
      if (isX) { if (r !== 0) this.Z = 0; } else this.Z = r === 0 ? 1 : 0;
      return r;
    }
    cond(cc) {
      const { N, Z, V, C } = this;
      switch (cc) {
        case 'T': case 'RA': return true; case 'F': return false;
        case 'HI': return !C && !Z; case 'LS': return !!(C || Z);
        case 'CC': case 'HS': return !C; case 'CS': case 'LO': return !!C;
        case 'NE': return !Z; case 'EQ': return !!Z;
        case 'VC': return !V; case 'VS': return !!V;
        case 'PL': return !N; case 'MI': return !!N;
        case 'GE': return N === V; case 'LT': return N !== V;
        case 'GT': return !Z && N === V; case 'LE': return !!Z || N !== V;
      }
      return false;
    }
    target(o) { if (o.m === 'abs' || o.m === 'pc') return o.v >>> 0; const L = this.loc(o, 4); return L.a; }
    halt(msg) { this.halted = true; this.haltMsg = msg; }
    snapshot() { return { D: this.D.slice(), A: this.A.slice(), pc: this.pc, ccr: this.ccr, SRhi: this.SRhi, halted: this.halted, haltMsg: this.haltMsg, out: this.out, steps: this.steps, mem: [] }; }
    step() {
      if (this.halted) return false;
      const ins = this.prog.byAddr.get(this.pc >>> 0);
      if (!ins) {
        if ((this.pc >>> 0) === this.prog.endAddr) { this.halt('Fin du programme (dernière instruction exécutée).'); return false; }
        throw new RunError(`Le PC (${H(this.pc)}) ne pointe sur aucune instruction`);
      }
      if (this.histOn) { if (!this.histStack) this.histStack = []; this.hist = this.snapshot(); this.histStack.push(this.hist); if (this.histStack.length > 3000) this.histStack.shift(); }
      this.writes = new Set();
      this.cur = ins; this.next = (ins.addr + ins.len) >>> 0; this.pc = this.next;
      try { this.exec(ins); } catch (e) { if (e instanceof RunError && !e.line) e.line = ins.no; throw e; }
      this.steps++;
      return true;
    }
    back() {
      if (!this.histStack || !this.histStack.length) return false;
      const h = this.histStack.pop();
      for (let i = h.mem.length - 1; i >= 0; i--) this.mem[h.mem[i][0]] = h.mem[i][1];
      this.D = h.D; this.A = h.A; this.pc = h.pc; this.ccr = h.ccr; this.SRhi = h.SRhi; this.halted = h.halted; this.haltMsg = h.haltMsg; this.out = h.out; this.steps = h.steps;
      this.hist = null; this.writes = new Set(h.mem.map(x => x[0]));
      return true;
    }
    run(limit = 3000000) {
      const was = this.histOn; this.histOn = false; this.hist = null;
      let n = 0;
      while (!this.halted) {
        this.step();
        if (++n >= limit) { this.histOn = was; throw new RunError(`Arrêt après ${limit.toLocaleString('fr-FR')} instructions : boucle infinie ?`, this.cur && this.cur.no); }
      }
      this.histOn = was;
      return n;
    }
    trap15() {
      const t = this.D[0] & 0xFF;
      const str = (a, len) => { let s = '', k = 0; for (;;) { if (len !== undefined && k >= len) break; const c = this.mem[(a + k) & 0xFFFFFF]; if (len === undefined && c === 0) break; s += String.fromCharCode(c); k++; if (k > 4096) break; } return s; };
      switch (t) {
        case 0: this.out += str(this.A[1], this.D[1] & 0xFFFF) + '\n'; break;
        case 1: this.out += str(this.A[1], this.D[1] & 0xFFFF); break;
        case 3: this.out += String(this.D[1] | 0); break;
        case 6: this.out += String.fromCharCode(this.D[1] & 0xFF); break;
        case 9: this.halt('Arrêt demandé (TRAP #15, tâche 9).'); break;
        case 13: this.out += str(this.A[1]) + '\n'; break;
        case 14: this.out += str(this.A[1]); break;
        case 15: { const b = this.D[2] & 0xFF; this.out += (this.D[1] >>> 0).toString(b >= 2 && b <= 36 ? b : 10).toUpperCase(); break; }
        default: throw new RunError('TRAP #15 : tâche ' + t + ' non supportée par le simulateur (0,1,3,6,9,13,14,15)');
      }
    }
    exec(p) {
      const op = p.op, o = p.opnds; let s = p.s;
      const cc = ccOf(op);
      switch (op) {
        case 'NOP': return;
        case 'SIMHALT': case 'STOP': this.halt('Arrêt du processeur (' + op + ').'); return;
        case 'TRAP': if ((o[0].v & 15) === 15) this.trap15(); else this.halt('TRAP #' + o[0].v + ' : arrêt.'); return;
        case 'MOVE': case 'MOVEA': {
          if (o[1].m === 'ccr' || o[1].m === 'sr') { const v = this.get(this.loc(o[0], 2), 2); this.put(this.loc(o[1], 2), 2, v); return; }
          if (o[0].m === 'ccr' || o[0].m === 'sr') { const v = this.get(this.loc(o[0], 2), 2); this.put(this.loc(o[1], 2), 2, v); return; }
          const v = this.get(this.loc(o[0], s), s);
          if (o[1].m === 'an') { this.A[o[1].r] = s === 2 ? sx(v, 2) >>> 0 : v >>> 0; return; }
          this.put(this.loc(o[1], s), s, v); this.logic(v, s); return;
        }
        case 'MOVEQ': { const v = sx(o[0].v, 1) >>> 0; this.D[o[1].r] = v; this.logic(v, 4); return; }
        case 'LEA': this.A[o[1].r] = this.loc(o[0], 4).a & 0xFFFFFFFF; this.A[o[1].r] >>>= 0; return;
        case 'PEA': this.push(this.loc(o[0], 4).a); return;
        case 'CLR': this.put(this.loc(o[0], s), s, 0); this.N = 0; this.Z = 1; this.V = 0; this.C = 0; return;
        case 'ADD': case 'ADDI': case 'ADDQ': case 'ADDA': case 'SUB': case 'SUBI': case 'SUBQ': case 'SUBA': {
          const isAdd = op.startsWith('ADD');
          if (o[1].m === 'an') {
            const v = this.get(this.loc(o[0], s), s), e = s === 2 ? sx(v, 2) : (v | 0);
            this.A[o[1].r] = (this.A[o[1].r] + (isAdd ? e : -e)) >>> 0; return;
          }
          const S = this.get(this.loc(o[0], s), s), L = this.loc(o[1], s), Dv = this.get(L, s);
          this.put(L, s, isAdd ? this.addf(S, Dv, s) : this.subf(Dv, S, s)); return;
        }
        case 'ADDX': case 'SUBX': {
          const S = this.get(this.loc(o[0], s), s), L = this.loc(o[1], s), Dv = this.get(L, s);
          this.put(L, s, op === 'ADDX' ? this.addf(S, Dv, s, this.X, true) : this.subf(Dv, S, s, this.X, false, true)); return;
        }
        case 'CMP': case 'CMPI': case 'CMPA': case 'CMPM': {
          const S = this.get(this.loc(o[0], s), s);
          if (o[1].m === 'an') { const e = s === 2 ? sx(S, 2) >>> 0 : S; this.subf(this.A[o[1].r], e, 4, 0, true); return; }
          const Dv = this.get(this.loc(o[1], s), s); this.subf(Dv, S, s, 0, true); return;
        }
        case 'TST': this.logic(this.get(this.loc(o[0], s), s), s); return;
        case 'NEG': case 'NEGX': { const L = this.loc(o[0], s), v = this.get(L, s); this.put(L, s, this.subf(0, v, s, op === 'NEGX' ? this.X : 0, false, op === 'NEGX')); return; }
        case 'NOT': { const L = this.loc(o[0], s), r = tr(~this.get(L, s), s); this.put(L, s, r); this.logic(r, s); return; }
        case 'AND': case 'ANDI': case 'OR': case 'ORI': case 'EOR': case 'EORI': {
          const S = this.get(this.loc(o[0], o[1].m === 'ccr' ? 1 : s), s);
          const f = op[0] === 'A' ? (a, b) => a & b : op[0] === 'O' ? (a, b) => a | b : (a, b) => a ^ b;
          if (o[1].m === 'ccr') { this.ccr = f(this.ccr, S) & 0x1F; return; }
          if (o[1].m === 'sr') { this.ccr = f(this.ccr, S & 0xFF) & 0x1F; this.SRhi = f(this.SRhi, (S >> 8) & 0xFF); return; }
          const L = this.loc(o[1], s), r = tr(f(this.get(L, s), S), s); this.put(L, s, r); this.logic(r, s); return;
        }
        case 'EXT': { const r = o[0].r; if (s === 2) { const v = sx(this.D[r], 1) & 0xFFFF; this.D[r] = ((this.D[r] & 0xFFFF0000) | v) >>> 0; this.logic(v, 2); } else { this.D[r] = sx(this.D[r], 2) >>> 0; this.logic(this.D[r], 4); } return; }
        case 'SWAP': { const r = o[0].r, v = this.D[r]; this.D[r] = (((v & 0xFFFF) << 16) | (v >>> 16)) >>> 0; this.logic(this.D[r], 4); return; }
        case 'EXG': { const g = x => x.m === 'dn' ? this.D[x.r] : this.A[x.r], st = (x, v) => { if (x.m === 'dn') this.D[x.r] = v; else this.A[x.r] = v; }; const a = g(o[0]), b = g(o[1]); st(o[0], b); st(o[1], a); return; }
        case 'MULU': case 'MULS': {
          const S = this.get(this.loc(o[0], 2), 2), d = this.D[o[1].r] & 0xFFFF;
          const r = op === 'MULU' ? (S * d) >>> 0 : (sx(S, 2) * sx(d, 2)) >>> 0;
          this.D[o[1].r] = r; this.logic(r, 4); return;
        }
        case 'DIVU': case 'DIVS': {
          const S = this.get(this.loc(o[0], 2), 2);
          if (S === 0) throw new RunError('Division par zéro (exception du 68000)');
          const dv = this.D[o[1].r];
          let q, rm;
          if (op === 'DIVU') { q = Math.floor(dv / S); rm = dv % S; if (q > 0xFFFF) { this.V = 1; this.C = 0; return; } }
          else { const a = dv | 0, b = sx(S, 2); q = Math.trunc(a / b); rm = a - q * b; if (q < -32768 || q > 32767) { this.V = 1; this.C = 0; return; } }
          this.D[o[1].r] = (((rm & 0xFFFF) << 16) | (q & 0xFFFF)) >>> 0;
          this.N = (q & 0x8000) ? 1 : 0; this.Z = (q & 0xFFFF) === 0 ? 1 : 0; this.V = 0; this.C = 0; return;
        }
        case 'BTST': case 'BSET': case 'BCLR': case 'BCHG': {
          const nb = o[0].m === 'imm' ? o[0].v : this.D[o[0].r];
          const isReg = o[1].m === 'dn', sz = isReg ? 4 : 1, bit = nb & (isReg ? 31 : 7);
          const L = this.loc(o[1], sz), v = this.get(L, sz), m = (2 ** bit);
          const was = Math.floor(v / m) & 1; this.Z = was ? 0 : 1;
          if (op === 'BTST') return;
          let r = v;
          if (op === 'BSET' && !was) r = v + m; if (op === 'BCLR' && was) r = v - m; if (op === 'BCHG') r = was ? v - m : v + m;
          this.put(L, sz, r); return;
        }
        case 'BRA': this.pc = o[0].v >>> 0; return;
        case 'BSR': this.push(this.next); this.pc = o[0].v >>> 0; return;
        case 'JMP': this.pc = this.target(o[0]); return;
        case 'JSR': { const t = this.target(o[0]); this.push(this.next); this.pc = t; return; }
        case 'RTS': if ((this.A[7] >>> 0) >= this.initSP) { this.halt('RTS final : retour à l\'appelant, fin du programme.'); return; } this.pc = this.pop(4); return;
        case 'RTR': { this.ccr = this.pop(2) & 0x1F; this.pc = this.pop(4); return; }
        case 'RTE': this.halt('RTE : arrêt.'); return;
        case 'LINK': { this.push(this.A[o[0].r]); this.A[o[0].r] = this.A[7]; this.A[7] = (this.A[7] + sx(o[1].v, 2)) >>> 0; return; }
        case 'UNLK': { this.A[7] = this.A[o[0].r]; this.A[o[0].r] = this.pop(4); return; }
        case 'MOVEM': {
          const isL = x => ['list', 'dn', 'an'].includes(x.m);
          const toMem = isL(o[0]);
          const R = toMem ? o[0] : o[1], M = toMem ? o[1] : o[0];
          const mask = R.m === 'list' ? R.mask : (R.m === 'dn' ? 1 << R.r : 1 << (8 + R.r));
          const getR = i => (i < 8 ? this.D[i] : this.A[i - 8]), setR = (i, v) => { if (i < 8) this.D[i] = v >>> 0; else this.A[i - 8] = v >>> 0; };
          if (toMem) {
            if (M.m === 'pre') { let a = this.A[M.r]; for (let i = 15; i >= 0; i--) if (mask & (1 << i)) { a = (a - s) >>> 0; this.write(a, s, tr(getR(i), s)); } this.A[M.r] = a; }
            else { let a = this.loc(M, s).a; for (let i = 0; i < 16; i++) if (mask & (1 << i)) { this.write(a, s, tr(getR(i), s)); a = (a + s) >>> 0; } }
          } else {
            let a = M.m === 'post' ? this.A[M.r] : this.loc(M, s).a;
            for (let i = 0; i < 16; i++) if (mask & (1 << i)) { const v = this.read(a, s); setR(i, s === 2 ? sx(v, 2) : v); a = (a + s) >>> 0; }
            if (M.m === 'post') this.A[M.r] = a;
          }
          return;
        }
        case 'TAS': { const L = this.loc(o[0], 1), v = this.get(L, 1); this.logic(v, 1); this.put(L, 1, v | 0x80); return; }
        case 'CHK': case 'ILLEGAL': case 'RESET': case 'TRAPV': case 'ABCD': case 'SBCD': this.halt(op + ' non simulé : arrêt.'); return;
      }
      if (SHIFTS.has(op)) return this.shift(p);
      if (cc) {
        if (cc.kind === 'B') { if (this.cond(cc.cc)) this.pc = o[0].v >>> 0; return; }
        if (cc.kind === 'DB') {
          if (this.cond(cc.cc)) return;
          const r = o[0].r, w = ((this.D[r] & 0xFFFF) - 1) & 0xFFFF;
          this.D[r] = ((this.D[r] & 0xFFFF0000) | w) >>> 0;
          if (w !== 0xFFFF) this.pc = o[1].v >>> 0; return;
        }
        if (cc.kind === 'S') { this.put(this.loc(o[0], 1), 1, this.cond(cc.cc) ? 0xFF : 0); return; }
      }
      throw new RunError('Instruction ' + op + ' non supportée par le simulateur');
    }
    shift(p) {
      const op = p.op, o = p.opnds; let s = p.s, cnt, L;
      if (o.length === 1) { s = 2; L = this.loc(o[0], 2); cnt = 1; }
      else { cnt = o[0].m === 'imm' ? o[0].v : (this.D[o[0].r] & 63); L = this.loc(o[1], s); }
      let v = this.get(L, s); const msb = MSB[s]; let C = 0, Vf = 0;
      if (cnt === 0) C = (op === 'ROXL' || op === 'ROXR') ? this.X : 0;
      for (let i = 0; i < cnt; i++) {
        const top = (v & msb) !== 0 ? 1 : 0, low = v & 1;
        switch (op) {
          case 'LSL': case 'ASL': { C = top; const nv = tr(v * 2, s); if (op === 'ASL' && (((nv & msb) !== 0) ? 1 : 0) !== top) Vf = 1; v = nv; this.X = C; break; }
          case 'LSR': C = low; v = v >>> 1; this.X = C; break;
          case 'ASR': C = low; v = ((v >>> 1) | (top ? msb : 0)) >>> 0; this.X = C; break;
          case 'ROL': C = top; v = tr(v * 2 + top, s); break;
          case 'ROR': C = low; v = ((v >>> 1) | (low ? msb : 0)) >>> 0; break;
          case 'ROXL': C = top; v = tr(v * 2 + this.X, s); this.X = C; break;
          case 'ROXR': C = low; v = ((v >>> 1) | (this.X ? msb : 0)) >>> 0; this.X = C; break;
        }
        v = tr(v, s);
      }
      this.put(L, s, v); this.nz(v, s); this.V = op === 'ASL' ? Vf : 0; this.C = C;
    }
  }

  /* ---------------- utilitaires publics ---------------- */
  function runSource(src, setup = {}, opts = {}) {
    const prog = assemble(src, opts);
    const cpu = new CPU(); cpu.load(prog);
    if (setup.D) setup.D.forEach((v, i) => { if (v !== undefined && v !== null) cpu.D[i] = v >>> 0; });
    if (setup.A) setup.A.forEach((v, i) => { if (v !== undefined && v !== null) cpu.A[i] = v >>> 0; });
    if (setup.mem) for (const [a, bytes] of setup.mem) bytes.forEach((b, k) => { cpu.mem[(a + k) & 0xFFFFFF] = b & 0xFF; });
    if (setup.trace) cpu.trace = [];
    cpu.run(opts.limit);
    return cpu;
  }
  // forme canonique d'une instruction (pour corriger des réponses texte)
  function canon(text) {
    try {
      const p = parseLine(' ' + text.trim(), 1); if (!p || !p.op) return null;
      let op = p.op; const c = ccOf(op);
      if (op === 'DBRA') op = 'DBF';
      if (op === 'BHS') op = 'BCC'; if (op === 'BLO') op = 'BCS';
      if (op === 'MOVEA') op = 'MOVE'; if (op === 'ADDA') op = 'ADD'; if (op === 'SUBA') op = 'SUB';
      if (c && c.kind === 'DB' && c.cc === 'HS') op = 'DBCC';
      const s = p.size ? SZ[p.size] : defSize(op);
      const ops = p.ops.map(x => {
        const q = parseOperand(x, 1);
        if (q.m === 'list') return 'L' + q.mask;
        if (q.m === 'dn' && op === 'MOVEM') return 'L' + (1 << q.r);
        if (q.m === 'an' && op === 'MOVEM') return 'L' + (1 << (8 + q.r));
        if (q.e !== undefined) { try { q.v = evalExpr(q.e, {}, 1); } catch (e) { q.v = q.e.toUpperCase(); } delete q.e; }
        if (q.m === 'idx' && !q.xs) q.xs = 2;
        return JSON.stringify(q);
      });
      return op + '.' + s + ' ' + ops.join(',');
    } catch (e) { return null; }
  }
  return { isMnem, assemble, CPU, AsmError, RunError, runSource, evalExpr, parseLine, parseOperand, canon, H, hexs, tr, sx, isNeg, MASK, MSB, INIT_SP, ccOf, CCS, SHIFTS };
})();
if (typeof module !== 'undefined') module.exports = M68K;
