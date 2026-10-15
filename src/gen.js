/* ==========================================================================
   LABO-68K — Générateurs d'exercices (format du contrôle S3) + défis moulinette
   ========================================================================== */
const GEN = (function () {
  'use strict';
  const M = M68K;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const hx = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
  const SZN = { 1: 'B', 2: 'W', 4: 'L' };
  const SN = { B: 1, W: 2, L: 4 };
  const ah = v => '$' + hx(v, (v >>> 0) > 0xFFFF ? 6 : 4);
  const rnd32 = () => Math.floor(Math.random() * 4294967296) >>> 0;
  const sgn = v => (v < 0 ? '− ' + (-v) : '+ ' + v);

  /* ================= EXERCICE 1 : modes d'adressage ================= */
  function ex1State() {
    const base = pick([0x2000, 0x3000, 0x4000, 0x5000, 0x6000, 0x7000]);
    const d0 = Math.random() < 0.6 ? (-rnd(1, 9)) >>> 0 : rnd(2, 9);
    const d1 = rnd(1, 9);
    const hiw = pick([0x4444, 0x1111, 0x2222, 0x7777, 0xAAAA, 0x5555, rnd(0x1000, 0xEFFF)]);
    const d2 = ((hiw * 0x10000) + (Math.random() < 0.6 ? 0x10000 - rnd(2, 12) : rnd(2, 12))) >>> 0;
    const mem = Array.from({ length: 24 }, () => rnd(0, 255));
    return { D: [d0 >>> 0, d1, d2], A: [base, base + 8, base + 16], base, mem };
  }
  function imm(st, s) {
    const r = Math.random();
    if (s === 'B') return r < 0.5 ? '#' + rnd(10, 99) : '#$' + hx(rnd(0, 255), 2);
    if (s === 'W') return r < 0.45 ? '#' + rnd(10, 999) : '#$' + hx(rnd(0, 0xFFFF), 4);
    return r < 0.4 ? '#$' + hx(st.base + rnd(0, 23), 4) : '#$' + hx(rnd32(), 8);
  }
  const absA = st => '$' + hx(st.base + rnd(0, 22), 4);
  const TPL1 = [
    (st, s) => `MOVE.${s} ${imm(st, s)},-(A${rnd(1, 2)})`,
    (st, s) => `MOVE.${s} ${absA(st)},${rnd(-8, 10)}(A${rnd(0, 2)})`,
    (st, s) => `MOVE.${s} ${imm(st, s)},(A${rnd(0, 2)})+`,
    (st, s) => `MOVE.${s} ${rnd(-9, 9)}(A${rnd(0, 2)}),${rnd(-6, 6)}(A${rnd(0, 2)},D${rnd(0, 1)}.${pick(['W', 'L'])})`,
    (st, s) => `MOVE.${s} (A${rnd(0, 2)})+,${rnd(-8, 8)}(A${rnd(0, 2)})`,
    (st, s) => `MOVE.${s} -(A${rnd(1, 2)}),(A${rnd(0, 2)})+`,
    (st, s) => `MOVE.${s} D${rnd(0, 2)},${rnd(-6, 6)}(A${rnd(0, 2)},D${rnd(0, 2)}.W)`,
    (st, s) => { const a = rnd(1, 2); return `MOVE.${s} -(A${a}),-(A${a})`; },
    (st, s) => `MOVE.${s} ${rnd(-8, 10)}(A${rnd(0, 2)}),D${rnd(0, 2)}`,
    (st, s) => `MOVE.${s} ${absA(st)},D${rnd(0, 2)}`,
    (st, s) => `MOVE.${s} (A${rnd(0, 2)}),${absA(st)}`,
    (st, s) => `CLR.${s} ${rnd(-8, 10)}(A${rnd(0, 2)})`,
    (st, s) => `MOVE.${s} D${rnd(0, 2)},-(A${rnd(1, 2)})`,
    (st, s) => `MOVE.${s} ${rnd(-4, 4)}(A${rnd(0, 2)},D1.W),(A${rnd(0, 2)})`,
    (st, s) => `MOVE.${s} ${rnd(-6, 6)}(A${rnd(0, 2)},D0.L),(A${rnd(0, 2)})+`,
    (st) => `MOVEA.W ${rnd(-8, 10)}(A${rnd(0, 2)}),A${rnd(0, 2)}`,
    (st) => `LEA ${rnd(-8, 8)}(A${rnd(0, 2)},D${rnd(0, 1)}.L),A${rnd(0, 2)}`,
  ];
  function setupOf(st, trace) { return { D: st.D, A: st.A, mem: [[st.base, st.mem]], trace }; }
  function genEx1(st) {
    st = st || ex1State();
    for (let tries = 0; tries < 400; tries++) {
      const t = pick(TPL1);
      const s = pick(['B', 'W', 'W', 'L', 'L']);
      const ins = t(st, s);
      try {
        const cpu = M.runSource(' ' + ins, setupOf(st, true));
        const okMem = cpu.trace.every(e => e.a >= st.base && e.a + e.s <= st.base + 24);
        if (!okMem) continue;
        const res = solve1(st, ins, cpu);
        if (!res.changed) continue;
        return { st, ins, res };
      } catch (e) { /* invalide (adresse impaire, etc.) → on retire */ }
    }
    return { st, ins: 'MOVE.W #52,(A0)+', res: solve1(st, 'MOVE.W #52,(A0)+') };
  }
  function solve1(st, ins, cpu) {
    cpu = cpu || M.runSource(' ' + ins, setupOf(st, false));
    const mem = Array.from(cpu.mem.slice(st.base, st.base + 24));
    const D = cpu.D.slice(0, 3), A = cpu.A.slice(0, 3);
    const regChanged = [];
    D.forEach((v, i) => { if (v !== st.D[i]) regChanged.push('D' + i); });
    A.forEach((v, i) => { if (v !== st.A[i]) regChanged.push('A' + i); });
    const memChanged = mem.map((b, i) => b !== st.mem[i]);
    return { mem, D, A, regChanged, memChanged, changed: regChanged.length > 0 || memChanged.some(Boolean) };
  }
  function explain1(st, ins) {
    const prog = M.assemble(' ' + ins); const p = prog.ins[0];
    const cpu = new M.CPU(); cpu.load(prog);
    st.D.forEach((v, i) => cpu.D[i] = v); st.A.forEach((v, i) => cpu.A[i] = v);
    st.mem.forEach((b, k) => cpu.mem[st.base + k] = b);
    const sz = p.op === 'LEA' ? 4 : p.s;
    const out = [];
    const single = p.opnds.length === 1;
    p.opnds.forEach((o, i) => {
      const A = cpu.A, D = cpu.D;
      const chain = [p.ops[i].toUpperCase()]; let note = '';
      switch (o.m) {
        case 'imm': chain.push('#$' + hx(M.tr(o.v, sz), sz * 2)); if (!/^\$/.test(o.e.trim())) note = `${o.e.trim()} en décimal = $${hx(M.tr(o.v, sz), sz * 2)} sur ${sz * 8} bits`; break;
        case 'dn': chain.push(`D${o.r}.${SZN[sz]}`); break;
        case 'an': chain.push(`A${o.r}`); break;
        case 'ind': chain.push(`(${ah(A[o.r])})`); break;
        case 'post': chain.push(`(A${o.r})`, `(${ah(A[o.r])})`); note = `Après l'accès : A${o.r} = ${ah(A[o.r])} + ${sz} = ${ah(A[o.r] + sz)}`; break;
        case 'pre': chain.push(`(A${o.r} − ${sz})`, `(${ah(A[o.r])} − ${sz})`, `(${ah(A[o.r] - sz)})`); note = `A${o.r} est décrémenté AVANT l'accès : A${o.r} = ${ah(A[o.r] - sz)}`; break;
        case 'disp': chain.push(`(A${o.r} ${sgn(o.v)})`, `(${ah(A[o.r])} ${sgn(o.v)})`, `(${ah(A[o.r] + o.v)})`); break;
        case 'idx': {
          const xr = o.x.t === 'd' ? D[o.x.n] : A[o.x.n];
          const xv = o.xs === 2 ? M.sx(xr, 2) : (xr | 0);
          const xn = (o.x.t === 'd' ? 'D' : 'A') + o.x.n + '.' + (o.xs === 2 ? 'W' : 'L');
          chain.push(`(A${o.r} + ${xn} ${sgn(o.v)})`, `(${ah(A[o.r])} ${sgn(xv)} ${sgn(o.v)})`, `(${ah(A[o.r] + xv + o.v)})`);
          note = `${xn} = $${hx(M.tr(xr, o.xs), o.xs * 2)} = ${xv} en signé (l'index est TOUJOURS signé)`;
          break;
        }
        case 'abs': chain.push(`(${ah(o.v)})`); break;
      }
      const L = cpu.loc(o, sz);
      const isSrc = i === 0 && !single;
      if (isSrc && p.op !== 'LEA' && L.k !== 'i') { const v = cpu.get(L, sz); chain.push('#$' + hx(v, sz * 2)); }
      if (p.op === 'LEA' && i === 0) { chain.push('adresse ' + ah(L.a)); note = 'LEA charge l\'ADRESSE effective, sans lire la mémoire'; }
      out.push({ label: single ? 'Destination' : (i === 0 ? 'Source' : 'Destination'), chain, note });
    });
    if (p.op === 'MOVEA' && p.s === 2) out.push({ label: 'Attention', chain: ['MOVEA.W étend le signe sur 32 bits avant d\'écrire dans An'], note: '' });
    return out;
  }

  /* ================= EXERCICE 2 : additions et flags ================= */
  function operand(s) {
    const m = M.MASK[s], msb = M.MSB[s], r = Math.random();
    if (r < 0.18) return msb - 1 - rnd(0, 3);
    if (r < 0.34) return msb + rnd(0, 15);
    if (r < 0.44) return m - rnd(0, 3);
    if (r < 0.52) return rnd(1, 15);
    if (s === 4 && r < 0.8) { const d = () => pick('0123456789ABCDEF'.split('')); const z = pick(['0', '1', '9', 'F']); return parseInt(d() + z + d() + z + d() + z + d() + z, 16) >>> 0; }
    if (s === 2 && r < 0.7) { return parseInt(pick(['00', '7F', '80', 'FF', '0F', 'F0', '40', 'C0']) + hx(rnd(0, 255), 2), 16); }
    return Math.floor(Math.random() * (m + 1)) >>> 0;
  }
  function genEx2(withSub) {
    const s = pick([1, 1, 2, 2, 4, 4]);
    const op = withSub && Math.random() < 0.4 ? 'SUB' : 'ADD';
    const a = operand(s), b = operand(s);
    return solve2(op, a, b, s);
  }
  function solve2(op, a, b, s) {
    const cpu = new M.CPU();
    const r = op === 'ADD' ? cpu.addf(b, a, s) : cpu.subf(a, b, s);
    return { op, a, b, s, r, N: cpu.N, Z: cpu.Z, V: cpu.V, C: cpu.C, text: `$${hx(a, s * 2)} ${op === 'ADD' ? '+' : '−'} $${hx(b, s * 2)}` };
  }
  function explain2(q) {
    const { a, b, s, r } = q, bits = s * 8, max = M.MASK[s], lo = -(2 ** (bits - 1)), hi = 2 ** (bits - 1) - 1;
    const sa = M.sx(a, s), sb = M.sx(b, s), sr = M.sx(r, s);
    const L = [];
    if (q.op === 'ADD') {
      const us = a + b;
      L.push(`<b>Non signé</b> : ${a} + ${b} = ${us} ${us > max ? `&gt; ${max} → retenue, <b>C = 1</b>` : `≤ ${max} → pas de retenue, <b>C = 0</b>`}`);
      const ss = sa + sb;
      L.push(`<b>Signé</b> : (${sa}) + (${sb}) = ${ss} ${ss < lo || ss > hi ? `hors de [${lo} ; ${hi}] → <b>V = 1</b>` : `dans [${lo} ; ${hi}] → <b>V = 0</b>`}`);
      const pa = sa >= 0, pb = sb >= 0;
      if (pa === pb) L.push(`Astuce : deux nombres ${pa ? 'positifs' : 'négatifs'} → V = 1 seulement si le résultat est ${pa ? 'négatif' : 'positif'}.`);
      else L.push('Astuce : un positif + un négatif ne peut JAMAIS déborder → V = 0 d\'office.');
    } else {
      L.push(`<b>Non signé</b> : ${a} − ${b} ${b > a ? '→ emprunt, <b>C = 1</b>' : '→ pas d\'emprunt, <b>C = 0</b>'}`);
      const ss = sa - sb;
      L.push(`<b>Signé</b> : (${sa}) − (${sb}) = ${ss} ${ss < lo || ss > hi ? '→ <b>V = 1</b>' : '→ <b>V = 0</b>'}`);
    }
    L.push(`Résultat sur ${bits} bits : <b>$${hx(r, s * 2)}</b> → bit de poids fort = ${q.N} → <b>N = ${q.N}</b>, ${r === 0 ? 'nul → <b>Z = 1</b>' : 'non nul → <b>Z = 0</b>'}`);
    return L;
  }

  /* ================= EXERCICE 3 : questions de cours ================= */
  const listTxt = (t, a, b) => (b - a >= 1 ? `${t}${a}-${t}${b}` : `${t}${a}`);
  const QGEN = [
    () => { const r = pick(['D', 'A']) + rnd(0, 6), s = pick(['W', 'L']); return { q: `Quelle instruction permet d'empiler le registre ${r} sur ${s === 'W' ? 16 : 32} bits ?`, type: 'ins', ans: [`MOVE.${s} ${r},-(A7)`, `MOVEM.${s} ${r},-(A7)`], show: `MOVE.${s} ${r},-(A7)`, why: 'Empiler = pré-décrémenter A7 puis écrire : mode -(A7). La taille (.W/.L) est celle demandée.' }; },
    () => { const r = pick(['D', 'A']) + rnd(0, 6), s = pick(['W', 'L']); return { q: `Quelle instruction permet de dépiler le registre ${r} sur ${s === 'W' ? 16 : 32} bits ?`, type: 'ins', ans: [`MOVE.${s} (A7)+,${r}`, `MOVEM.${s} (A7)+,${r}`], show: `MOVE.${s} (A7)+,${r}`, why: 'Dépiler = lire à A7 puis post-incrémenter : mode (A7)+.' }; },
    () => { const t = pick(['A', 'D']), a = rnd(0, 4), b = a + rnd(1, 3); const s = pick(['W', 'L']); return { q: `Quelle instruction permet de dépiler les registres ${Array.from({ length: b - a + 1 }, (_, k) => t + (a + k)).join(', ')} sur ${s === 'W' ? 16 : 32} bits ?`, type: 'ins', ans: [`MOVEM.${s} (A7)+,${listTxt(t, a, b)}`], show: `MOVEM.${s} (A7)+,${listTxt(t, a, b)}`, why: 'Plusieurs registres → MOVEM. L\'ordre de la liste n\'a aucune importance : D0-D3/A1 = A1/D3/D2/D1/D0.' }; },
    () => { const a = rnd(0, 3), b = a + rnd(1, 3), c = rnd(0, 5); const s = pick(['W', 'L']); return { q: `Quelle instruction permet d'empiler les registres D${a} à D${b} et A${c} sur ${s === 'W' ? 16 : 32} bits ?`, type: 'ins', ans: [`MOVEM.${s} D${a}-D${b}/A${c},-(A7)`], show: `MOVEM.${s} D${a}-D${b}/A${c},-(A7)`, why: 'MOVEM vers -(A7). Le 68000 empile dans l\'ordre inversé (A7…A0, D7…D0) pour que le dépilage dans l\'ordre classique rende les bonnes valeurs.' }; },
    () => ({ q: 'Quelle instruction permet d\'appeler un sous-programme ?', type: 'text', ans: ['BSR', 'JSR', 'BSR OU JSR', 'JSR OU BSR', 'BSR/JSR', 'JSR/BSR'], show: 'BSR (ou JSR)', why: 'BSR/JSR empilent l\'adresse de retour (32 bits) puis sautent au sous-programme.' }),
    () => ({ q: 'Quelle instruction permet de sortir d\'un sous-programme ?', type: 'text', ans: ['RTS'], show: 'RTS', why: 'RTS dépile l\'adresse de retour et la charge dans le PC.' }),
    () => ({ q: 'Quel registre contient l\'adresse de la prochaine instruction à exécuter ?', type: 'text', ans: ['PC', 'LEPC', 'COMPTEURPROGRAMME', 'PROGRAMCOUNTER'], show: 'PC', why: 'Le compteur programme (Program Counter).' }),
    () => ({ q: 'Quel registre est le pointeur de pile ?', type: 'text', ans: ['A7', 'SP', 'A7SP', 'SPA7'], show: 'A7 (alias SP)', why: 'A7 = SSP en mode superviseur, USP en mode utilisateur.' }),
    () => ({ q: 'Quel flag indique un dépassement en arithmétique SIGNÉE ?', type: 'text', ans: ['V'], show: 'V (Overflow)', why: 'V = deux positifs donnant un négatif, ou deux négatifs donnant un positif.' }),
    () => ({ q: 'Quel flag indique une retenue (dépassement NON signé) ?', type: 'text', ans: ['C'], show: 'C (Carry)', why: 'C = 1 si l\'addition non signée dépasse la taille.' }),
    () => ({ q: 'Quel flag recopie le bit de poids fort du résultat ?', type: 'text', ans: ['N'], show: 'N (Negative)', why: 'N = bit de signe du résultat.' }),
    () => ({ q: 'Quel registre de 8 bits contient X, N, Z, V et C et reste accessible en mode utilisateur ?', type: 'text', ans: ['CCR'], show: 'CCR', why: 'Le CCR = les 8 bits de poids faible du SR.' }),
    () => { const n = rnd(2, 40); return { q: `Avec D7.W = ${n} au départ, combien de fois s'exécute le corps d'une boucle terminée par DBRA D7,LOOP ?`, type: 'num', ans: [n + 1], show: String(n + 1), why: 'DBRA décrémente puis boucle tant que D7.W ≠ −1 : n + 1 tours.' }; },
    () => { const n = rnd(2, 20), s = pick(['B', 'W', 'L']); return { q: `Combien d'octets réserve la directive DS.${s} ${n} ?`, type: 'num', ans: [n * SN[s]], show: String(n * SN[s]), why: `.${s} = ${SN[s]} octet(s) × ${n}.` }; },
    () => { const r = rnd(0, 7); return { q: `Quelle instruction échange les 16 bits de poids fort et de poids faible de D${r} ?`, type: 'ins', ans: [`SWAP D${r}`], show: `SWAP D${r}`, why: 'SWAP travaille uniquement sur un registre de donnée.' }; },
    () => { const r = rnd(0, 7); return { q: `Quelle instruction étend le signe de D${r}.W sur 32 bits ?`, type: 'ins', ans: [`EXT.L D${r}`], show: `EXT.L D${r}`, why: 'EXT.W : octet → mot. EXT.L : mot → mot long.' }; },
    () => { const r = rnd(0, 7); return { q: `Quelle instruction met D${r} à zéro sur 32 bits ?`, type: 'ins', ans: [`CLR.L D${r}`, `MOVEQ #0,D${r}`, `MOVE.L #0,D${r}`], show: `CLR.L D${r}`, why: 'CLR.L (ou MOVEQ #0, plus rapide).' }; },
    () => ({ q: 'Après CMP.L D0,D1, quelle instruction branche à NEXT si D1 > D0 en comparaison NON signée ?', type: 'ins', ans: ['BHI NEXT'], show: 'BHI NEXT', why: 'Non signé : HI / HS / LO / LS. Signé : GT / GE / LT / LE. CMP src,dst compare dst à src.' }),
    () => ({ q: 'Après CMP.W D0,D1, quelle instruction branche à NEXT si D1 > D0 en comparaison SIGNÉE ?', type: 'ins', ans: ['BGT NEXT'], show: 'BGT NEXT', why: 'GT = Greater Than (signé).' }),
    () => ({ q: 'Après CMP.B D0,D1, quelle instruction branche à NEXT si D1 ≤ D0 en comparaison NON signée ?', type: 'ins', ans: ['BLS NEXT'], show: 'BLS NEXT', why: 'LS = Lower or Same (non signé).' }),
    () => ({ q: 'Après CMP.L D0,D1, quelle instruction branche à NEXT si D1 < D0 en comparaison SIGNÉE ?', type: 'ins', ans: ['BLT NEXT'], show: 'BLT NEXT', why: 'LT = Less Than (signé).' }),
    () => ({ q: 'Quelle directive indique l\'adresse à partir de laquelle le code est assemblé ?', type: 'text', ans: ['ORG'], show: 'ORG', why: 'ORG n\'est pas une instruction : elle ne produit aucun code machine.' }),
    () => ({ q: 'Quelle directive place des constantes en mémoire ?', type: 'text', ans: ['DC'], show: 'DC (Define Constant)', why: 'DS réserve, DC remplit.' }),
    () => ({ q: 'Quelle directive réserve de l\'espace mémoire sans l\'initialiser ?', type: 'text', ans: ['DS'], show: 'DS (Define Storage)', why: 'DS.W 3 réserve 6 octets.' }),
    () => ({ q: 'Quelle directive attribue une valeur à une étiquette ?', type: 'text', ans: ['EQU'], show: 'EQU', why: 'MAX EQU 17 : l\'assembleur remplace MAX par 17.' }),
    () => ({ q: 'MOVEM.L D0/A4,-(A0) : quel registre est copié en premier ?', type: 'text', ans: ['A4'], show: 'A4', why: 'Avec -(An), MOVEM utilise l\'ordre inversé : A7…A0 puis D7…D0.' }),
    () => ({ q: 'Après MOVE.B D0,-(A7), de combien d\'octets A7 a-t-il diminué ?', type: 'num', ans: [2], show: '2', why: 'Piège : la pile reste alignée sur des mots. Un octet empilé via A7 décrémente de 2.' }),
    () => ({ q: 'Combien de fils d\'adresse considère-t-on pour le 68000 dans le cours ?', type: 'num', ans: [24], show: '24', why: '24 fils → 16 Mio adressables. Les 8 bits de poids fort de An sont ignorés.' }),
    () => ({ q: 'Peut-on lire un mot (.W) à une adresse impaire ? (oui/non)', type: 'text', ans: ['NON', 'N', 'NO'], show: 'Non', why: 'Mots et mots longs : adresse paire obligatoire, sinon erreur d\'adresse. Les octets : n\'importe où.' }),
    () => ({ q: 'Combien d\'opérandes au maximum pour une instruction 68000 ?', type: 'num', ans: [2], show: '2', why: 'Source à gauche, destination à droite.' }),
    () => ({ q: 'Quel est le nombre minimal d\'octets d\'une instruction en mémoire ?', type: 'num', ans: [2], show: '2', why: 'Une instruction = au moins 1 mot de 16 bits, au plus 5 mots (10 octets).' }),
    () => { const r = rnd(0, 6), s = pick(['B', 'W', 'L']); return { q: `MOVE.${s} D0,(A${r})+ : de combien A${r} est-il incrémenté ?`, type: 'num', ans: [SN[s]], show: String(SN[s]), why: '.B → +1, .W → +2, .L → +4 (sauf A7 en .B : +2).' }; },
    () => ({ q: 'Quelle instruction charge l\'adresse de l\'étiquette TAB dans A0 ?', type: 'ins', ans: ['LEA TAB,A0', 'MOVEA.L #TAB,A0', 'MOVE.L #TAB,A0'], show: 'LEA TAB,A0', why: 'LEA = Load Effective Address. MOVE ne peut pas avoir An en destination (il faut MOVEA).' }),
    () => ({ q: 'Quel flag est le seul modifié par BTST ?', type: 'text', ans: ['Z'], show: 'Z', why: 'Z = NOT(bit testé).' }),
    () => ({ q: 'Quelle valeur de MOVEQ est permise ? Donne la valeur maximale.', type: 'num', ans: [127], show: '127', why: 'MOVEQ : donnée 8 bits signée (−128 à 127), étendue sur 32 bits.' }),
  ];
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s.'’"]/g, '').replace(/^LE|^LA/, '');
  function genEx3() { const g = pick(QGEN)(); return g; }
  function check3(q, input) {
    const t = (input || '').trim();
    if (!t) return false;
    if (q.type === 'num') {
      let v; try { v = M.evalExpr(t.replace(/\s/g, ''), {}, 0); } catch (e) { return false; }
      return q.ans.includes(v);
    }
    if (q.type === 'ins') {
      const c = M.canon(t.replace(/\bSP\b/gi, 'A7'));
      return !!c && q.ans.some(a => M.canon(a) === c);
    }
    const n = norm(t);
    return q.ans.some(a => norm(a) === n);
  }

  /* ================= EXERCICE 4 : traçage de programme ================= */
  const CCS1 = ['GT', 'GE', 'LT', 'LE', 'HI', 'HS', 'LO', 'LS', 'EQ', 'NE', 'PL', 'MI'];
  const SIGNED = ['GT', 'GE', 'LT', 'LE'];
  const ROT_OPS = [
    () => `ror.w #${pick([4, 8])},d4`, () => `ror.l #${pick([4, 8])},d4`, () => `rol.l #${pick([4, 8])},d4`, () => `rol.w #${pick([4, 8])},d4`,
    () => 'swap d4', () => `rol.b #4,d4`, () => `ror.b #4,d4`, () => `lsl.w #${pick([4, 8])},d4`, () => `lsr.l #${pick([4, 8])},d4`,
    () => 'not.b d4', () => 'ext.w d4', () => `asr.w #4,d4`, () => 'swap d4', () => `lsl.l #4,d4`,
  ];
  function genEx4() {
    const d7 = rnd32();
    const s1 = pick(['W', 'W', 'B', 'L']);
    const cc = pick(CCS1);
    const immv = s1 === 'B' ? pick([0x70, 0x80, 0x10, 0x7F, 0xF0, 0x40]) : s1 === 'W' ? pick([0x7000, 0x8000, 0x1000, 0xC000, 0x0400, 0x7FFF]) : pick([0x40000000, 0x80000000, 0x10000000, 0x7FFFFFFF]);
    const p1 = rnd(1, 4), p2 = p1 + rnd(1, 4);
    // partie 2
    const s2 = Math.random() < 0.75 ? 'b' : 'w';
    let n2;
    if (s2 === 'b') n2 = Math.random() < 0.15 ? pick([256, 512, 768]) : rnd(257, 900);
    else n2 = Math.random() < 0.5 ? rnd(65537, 66000) : rnd(3, 400);
    const n2txt = Math.random() < 0.5 ? String(n2) : '$' + hx(n2, 0);
    // partie 3
    const lw = Math.random() < 0.15 ? 0xFFFF : Math.random() < 0.3 ? 0 : rnd(0x10, 0xFFFE);
    const v3 = ((rnd(0, 0xFFFF) * 0x10000) + lw) >>> 0;
    const v3txt = Math.random() < 0.25 && lw < 30000 ? String(lw) : '$' + hx(v3, 8);
    const v3real = /^\$/.test(v3txt) ? v3 : lw;
    // partie 4
    const hexd = '0123456789ABCDEF'.split('').sort(() => Math.random() - 0.5).slice(0, 8).join('');
    const nops = rnd(4, 6); const ops4 = []; for (let k = 0; k < nops; k++) ops4.push(pick(ROT_OPS)());
    const prog = [
      `Main     move.l  #$${hx(d7, 8)},d7`,
      `part1    moveq.l #${p1},d1`,
      `         cmp.${s1.toLowerCase()}   #$${hx(immv, SN[s1] * 2)},d7`,
      `         b${cc.toLowerCase()}     part2`,
      `         moveq.l #${p2},d1`,
      `part2    clr.l   d2`,
      `         move.l  #${n2txt},d0`,
      `loop2    addq.l  #1,d2`,
      `         subq.${s2}  #1,d0`,
      `         bne     loop2`,
      `part3    clr.l   d3`,
      `         move.l  #${v3txt},d0`,
      `loop3    addq.l  #1,d3`,
      `         dbra    d0,loop3      ; DBRA = DBF`,
      `part4    move.l  #$${hexd},d4`,
      ...ops4.map(x => `         ${x}`),
    ].join('\n');
    const cpu = M.runSource(prog);
    const ans = [cpu.D[1], cpu.D[2], cpu.D[3], cpu.D[4]];
    // explication
    const sz = SN[s1], dv = M.tr(d7, sz), iv = M.tr(immv, sz);
    const tmp = new M.CPU(); tmp.subf(dv, iv, sz, 0, true); const taken = tmp.cond(cc);
    const signed = SIGNED.includes(cc);
    const ex = [];
    ex.push({ t: 'D1', lines: [
      `CMP.${s1} #$${hx(iv, sz * 2)},D7 compare <b>D7.${s1} = $${hx(dv, sz * 2)}</b> à $${hx(iv, sz * 2)} (D7.${s1} − $${hx(iv, sz * 2)}).`,
      signed ? `B${cc} est <b>signé</b> : ${M.sx(dv, sz)} vs ${M.sx(iv, sz)}.` : (['HI', 'HS', 'LO', 'LS'].includes(cc) ? `B${cc} est <b>non signé</b> : ${dv} vs ${iv}.` : `B${cc} teste un flag : N=${tmp.N} Z=${tmp.Z} V=${tmp.V} C=${tmp.C}.`),
      `Condition ${taken ? 'VRAIE → saut à part2, D1 garde ' + p1 : 'FAUSSE → pas de saut, MOVEQ #' + p2 + ' s\'exécute'} → <b>D1 = $${hx(ans[0], 8)}</b>`,
    ] });
    const m2 = s2 === 'b' ? 0xFF : 0xFFFF, c2 = (n2 & m2) || (m2 + 1);
    ex.push({ t: 'D2', lines: [
      `${n2txt} = $${hx(n2, 0)} → SUBQ.${s2.toUpperCase()} ne regarde que D0.${s2.toUpperCase()} = $${hx(n2 & m2, s2 === 'b' ? 2 : 4)}.`,
      (n2 & m2) === 0 ? `D0.${s2.toUpperCase()} = 0 : le premier SUBQ donne $${s2 === 'b' ? 'FF' : 'FFFF'} (≠ 0) → on fait le tour complet : ${m2 + 1} tours.` : `La boucle tourne ${c2} fois (on sort quand D0.${s2.toUpperCase()} atteint 0).`,
      `<b>D2 = $${hx(ans[1], 8)}</b> (${c2} en décimal)`,
    ] });
    const lw3 = v3real & 0xFFFF;
    ex.push({ t: 'D3', lines: [
      `DBRA ne regarde que D0.W = $${hx(lw3, 4)} = ${lw3}.`,
      `Le corps s'exécute D0.W + 1 = ${lw3 + 1} fois${lw3 === 0xFFFF ? ' ($FFFF = 65535 : 65536 tours, piège classique)' : ''}.`,
      `<b>D3 = $${hx(ans[2], 8)}</b>`,
    ] });
    // trace partie 4
    const p4 = M.assemble(` move.l #$${hexd},d4\n` + ops4.map(x => ' ' + x).join('\n'));
    const c4 = new M.CPU(); c4.load(p4); const tl = [];
    while (!c4.halted) { const before = c4.pc; if (!c4.step()) break; const ins = p4.byAddr.get(before); tl.push(`${ins.op.padEnd(5)}${ins.size ? '.' + ins.size : ''} ${ins.ops.join(',')} → D4 = $${hx(c4.D[4], 8)}`); }
    ex.push({ t: 'D4', lines: tl.map(x => `<code>${x.toUpperCase()}</code>`).concat(['Rappel : une rotation .B/.W ne touche que l\'octet / le mot de poids faible. 1 chiffre hexa = 4 bits.']) });
    return { prog, ans, ex };
  }

  /* ================= DÉFIS MOULINETTE ================= */
  const strBytes = s => [...s].map(c => c.charCodeAt(0)).concat([0]);
  const garbage = () => rnd32();
  const words = ['bonjour', 'EPITA', 'kayak', 'radar', 'assembleur', 'Motorola 68000', 'abc', '', 'x', 'Hello World', 'laval', 'S3 archi', 'ressasser'];
  const CH = [
    { id: 'abs', name: 'Valeur absolue', lvl: 1, entry: 'Abs', out: ['D0'],
      txt: 'Remplace D0.L (signé) par sa valeur absolue. Tous les autres registres doivent être conservés.',
      tpl: 'Abs\n        ; D0.L = |D0.L|\n\n        rts',
      tests: () => [5, -5, 0, -1, 2147483647, -2147483647, rnd(-100000, 100000)].map(v => ({ name: `Abs(${v})`, D: { 0: v >>> 0 }, exp: { D0: Math.abs(v) >>> 0 } })) },
    { id: 'max', name: 'Maximum signé', lvl: 1, entry: 'Max', out: ['D0'],
      txt: 'D0.L ← le plus grand de D1.L et D2.L, en comparaison SIGNÉE. D1 et D2 sont conservés.',
      tpl: 'Max\n        ; D0.L = max(D1.L, D2.L) signé\n\n        rts',
      tests: () => [[3, 9], [9, 3], [-4, 2], [2, -4], [-7, -8], [5, 5], [0x7FFFFFFF, -1]].map(([a, b]) => ({ name: `Max(${a}, ${b})`, D: { 1: a >>> 0, 2: b >>> 0 }, exp: { D0: Math.max(a, b) >>> 0 } })) },
    { id: 'strlen', name: 'StrLen', lvl: 2, entry: 'StrLen', out: ['D0'],
      txt: 'A0 pointe sur une chaîne terminée par un octet nul. Renvoie sa longueur dans D0.L. A0 doit être conservé (utilise un autre registre ou sauvegarde-le).',
      tpl: 'StrLen\n        ; A0 = adresse de la chaîne\n        ; D0.L = longueur\n\n        rts',
      tests: () => words.slice(0, 8).map(w => ({ name: `StrLen("${w}")`, A: { 0: 0x3000 }, mem: [[0x3000, strBytes(w)]], exp: { D0: w.length } })) },
    { id: 'sum', name: 'Somme d\'un tableau', lvl: 2, entry: 'Sum',
      out: ['D0'], txt: 'A0 pointe sur un tableau de mots SIGNÉS (16 bits), D1.W contient le nombre d\'éléments (≥ 1). Renvoie la somme sur 32 bits dans D0.L. A0 et D1 conservés.',
      tpl: 'Sum\n        ; A0 = tableau de .W signés, D1.W = taille\n        ; D0.L = somme\n\n        rts',
      tests: () => [[1, 2, 3], [-5, 5, -10], [32767, 32767], [-32768], Array.from({ length: 10 }, () => rnd(-1000, 1000))].map(t => ({ name: `Sum([${t.join(',')}])`, A: { 0: 0x3000 }, D: { 1: t.length }, mem: [[0x3000, t.flatMap(v => [(v >> 8) & 255, v & 255])]], exp: { D0: t.reduce((a, b) => a + b, 0) >>> 0 } })) },
    { id: 'popcnt', name: 'Bits à 1', lvl: 2, entry: 'BitCount', out: ['D1'],
      txt: 'Compte le nombre de bits à 1 de D0.L et le renvoie dans D1.L. D0 doit être conservé. (Indice : LSR/BTST et le flag C.)',
      tpl: 'BitCount\n        ; D1.L = nombre de bits à 1 dans D0.L\n\n        rts',
      tests: () => [0, 1, 0xFFFFFFFF, 0x80000000, 0x12345678, rnd32()].map(v => ({ name: `BitCount($${hx(v, 8)})`, D: { 0: v }, exp: { D1: v.toString(2).split('').filter(c => c === '1').length } })) },
    { id: 'bswap', name: 'Inverser les octets', lvl: 2, entry: 'ByteSwap', out: ['D0'],
      txt: 'Inverse l\'ordre des 4 octets de D0.L : $11223344 devient $44332211. (Indice : ROR.W, SWAP.)',
      tpl: 'ByteSwap\n        ; D0.L : $AABBCCDD -> $DDCCBBAA\n\n        rts',
      tests: () => [0x11223344, 0xAABBCCDD, 0, 0x000000FF, rnd32()].map(v => ({ name: `ByteSwap($${hx(v, 8)})`, D: { 0: v }, exp: { D0: parseInt(hx(v, 8).match(/../g).reverse().join(''), 16) >>> 0 } })) },
    { id: 'upper', name: 'Majuscules', lvl: 2, entry: 'ToUpper', out: [],
      txt: 'A0 pointe sur une chaîne terminée par 0. Convertis en place les lettres a-z en A-Z (le reste ne change pas). Tous les registres conservés.',
      tpl: 'ToUpper\n        ; A0 = chaîne à convertir en place\n\n        rts',
      tests: () => ['bonjour', 'EPITA s3', 'motorola 68000!', 'aZ{`', ''].map(w => ({ name: `ToUpper("${w}")`, A: { 0: 0x3000 }, mem: [[0x3000, strBytes(w)]], expMem: [[0x3000, strBytes(w.replace(/[a-z]/g, c => c.toUpperCase()))]] })) },
    { id: 'count', name: 'Compter un caractère', lvl: 2, entry: 'CountChar', out: ['D0'],
      txt: 'A0 pointe sur une chaîne terminée par 0, D1.B contient un caractère. Renvoie dans D0.L le nombre d\'occurrences de ce caractère.',
      tpl: 'CountChar\n        ; A0 = chaîne, D1.B = caractère\n        ; D0.L = nombre d\'occurrences\n\n        rts',
      tests: () => [['assembleur', 's'], ['kayak', 'k'], ['EPITA', 'z'], ['', 'a'], ['aaaa', 'a']].map(([w, c]) => ({ name: `CountChar("${w}", '${c}')`, A: { 0: 0x3000 }, D: { 1: (0xABCDEF00 | c.charCodeAt(0)) >>> 0 }, mem: [[0x3000, strBytes(w)]], exp: { D0: [...w].filter(x => x === c).length } })) },
    { id: 'fact', name: 'Factorielle', lvl: 3, entry: 'Fact', out: ['D0'],
      txt: 'D0.W contient n (0 ≤ n ≤ 9). Renvoie n! dans D0.L. Piège : MULU multiplie deux MOTS de 16 bits. Multiplie dans l\'ordre croissant (1×2×…×n) : 8! = 40320 tient encore sur 16 bits, 9×8×7×6×5×4×3 non.',
      tpl: 'Fact\n        ; D0.W = n, D0.L = n!\n\n        rts',
      tests: () => [0, 1, 2, 5, 7, 9].map(n => ({ name: `Fact(${n})`, D: { 0: (0x12340000 | n) >>> 0 }, exp: { D0: [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880][n] } })) },
    { id: 'pal', name: 'Palindrome', lvl: 3, entry: 'IsPal', out: ['D0'],
      txt: 'A0 pointe sur une chaîne terminée par 0. D0.L ← 1 si c\'est un palindrome, 0 sinon. (La chaîne vide est un palindrome.)',
      tpl: 'IsPal\n        ; A0 = chaîne\n        ; D0.L = 1 si palindrome, sinon 0\n\n        rts',
      tests: () => ['kayak', 'radar', 'EPITA', 'ab', 'a', '', 'ressasser', 'abca'].map(w => ({ name: `IsPal("${w}")`, A: { 0: 0x3000 }, mem: [[0x3000, strBytes(w)]], exp: { D0: w === [...w].reverse().join('') ? 1 : 0 } })) },
    { id: 'strcpy', name: 'Copie de chaîne', lvl: 3, entry: 'StrCpy', out: [],
      txt: 'Copie la chaîne pointée par A0 (terminée par 0, octet nul compris) vers l\'adresse A1. A0 et A1 doivent être conservés.',
      tpl: 'StrCpy\n        ; A0 = source, A1 = destination\n\n        rts',
      tests: () => ['Hello', 'EPITA S3', '', 'Motorola'].map(w => ({ name: `StrCpy("${w}")`, A: { 0: 0x3000, 1: 0x3800 }, mem: [[0x3000, strBytes(w)], [0x3800, [0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55]]], expMem: [[0x3800, strBytes(w)]] })) },
    { id: 'atoi', name: 'Atoi', lvl: 3, entry: 'Atoi', out: ['D0'],
      txt: 'A0 pointe sur une chaîne de chiffres décimaux terminée par 0 (valeur ≤ 999999). Renvoie la valeur dans D0.L. (×10 = ×8 + ×2, ou MULU tant que ça tient.)',
      tpl: 'Atoi\n        ; A0 = "1234",0  ->  D0.L = 1234\n\n        rts',
      tests: () => ['0', '7', '42', '1234', '65535', '999999', String(rnd(100, 99999))].map(w => ({ name: `Atoi("${w}")`, A: { 0: 0x3000 }, mem: [[0x3000, strBytes(w)]], exp: { D0: parseInt(w, 10) } })) },
  ];
  function runChallenge(ch, src) {
    const report = []; let passed = 0;
    let prog;
    try { prog = M.assemble(src, { entry: ch.entry }); }
    catch (e) { return { fatal: `Erreur d'assemblage ligne ${e.line ?? '?'} : ${e.message}`, line: e.line, report, passed: 0, total: 0 }; }
    if (prog.sym[ch.entry.toUpperCase()] === undefined) return { fatal: `L'étiquette « ${ch.entry} » est introuvable : la moulinette appelle JSR ${ch.entry}.`, report, passed: 0, total: 0 };
    const tests = ch.tests();
    for (const t of tests) {
      const cpu = new M.CPU(); cpu.load(prog);
      const init = { D: [], A: [] };
      for (let i = 0; i < 8; i++) { init.D[i] = t.D && t.D[i] !== undefined ? t.D[i] : garbage(); }
      for (let i = 0; i < 7; i++) { init.A[i] = t.A && t.A[i] !== undefined ? t.A[i] : (0x00400000 + rnd(0, 0xFFFF) * 2) >>> 0; }
      cpu.D = init.D.map(v => v >>> 0); for (let i = 0; i < 7; i++) cpu.A[i] = init.A[i] >>> 0;
      (t.mem || []).forEach(([a, bytes]) => bytes.forEach((b, k) => cpu.mem[a + k] = b));
      let err = null;
      try { cpu.run(2000000); } catch (e) { err = (e.line ? `ligne ${e.line} : ` : '') + e.message; }
      if (!err && !/^RTS final/.test(cpu.haltMsg)) err = 'le programme ne se termine pas par RTS (' + cpu.haltMsg + ')';
      const fails = [];
      if (!err) {
        for (const [r, v] of Object.entries(t.exp || {})) { const got = r[0] === 'D' ? cpu.D[+r[1]] : cpu.A[+r[1]]; if ((got >>> 0) !== (v >>> 0)) fails.push(`${r} attendu $${hx(v, 8)} (${v | 0}), obtenu $${hx(got, 8)} (${got | 0})`); }
        for (const [a, bytes] of (t.expMem || [])) { const got = Array.from(cpu.mem.slice(a, a + bytes.length)); if (got.join() !== bytes.join()) fails.push(`mémoire en $${hx(a, 4)} : attendu ${bytes.map(b => hx(b, 2)).join(' ')}, obtenu ${got.map(b => hx(b, 2)).join(' ')}`); }
        const keep = []; for (let i = 0; i < 8; i++) keep.push('D' + i); for (let i = 0; i < 7; i++) keep.push('A' + i);
        for (const r of keep) { if (ch.out.includes(r)) continue; const got = r[0] === 'D' ? cpu.D[+r[1]] : cpu.A[+r[1]], was = r[0] === 'D' ? init.D[+r[1]] : init.A[+r[1]]; if ((got >>> 0) !== (was >>> 0)) fails.push(`${r} a été modifié ($${hx(was, 8)} → $${hx(got, 8)}) : sauvegarde-le avec MOVEM.L ...,-(A7) / MOVEM.L (A7)+,...`); }
        if ((cpu.A[7] >>> 0) !== M.INIT_SP) fails.push('pile déséquilibrée (A7 ne revient pas à sa valeur de départ)');
      }
      const ok = !err && !fails.length; if (ok) passed++;
      report.push({ name: t.name, ok, msg: err || fails.join(' · '), steps: cpu.steps });
    }
    return { report, passed, total: tests.length };
  }

  /* ================= EXAMEN BLANC ================= */
  function genExam() {
    const st = ex1State(); const e1 = []; const seen = new Set();
    while (e1.length < 4) { const g = genEx1(st); if (seen.has(g.ins)) continue; seen.add(g.ins); e1.push(g); }
    const e2 = [solve2('ADD', ...[operand(1), operand(1)], 1), solve2('ADD', operand(1), operand(1), 1), solve2('ADD', operand(2), operand(2), 2), solve2('ADD', operand(4), operand(4), 4)];
    const pool = QGEN.slice(); const e3 = [];
    const fixed = [0, 2, 4, 6]; fixed.forEach(i => e3.push(pool[i]()));
    if (Math.random() < 0.5) e3[2] = QGEN[5](); if (Math.random() < 0.5) e3[0] = QGEN[3]();
    const e4 = genEx4();
    return { st, e1, e2, e3, e4 };
  }

  return { rnd, pick, hx, ah, ex1State, genEx1, solve1, explain1, genEx2, solve2, explain2, genEx3, check3, QGEN, genEx4, CH, runChallenge, genExam };
})();
if (typeof module !== 'undefined') module.exports = GEN;
