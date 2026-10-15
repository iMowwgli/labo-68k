/* ==========================================================================
   LABO-68K — Interface
   ========================================================================== */
(function () {
  'use strict';
  const M = M68K, G = GEN, hx = G.hx, ah = G.ah;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const app = $('#app');

  /* ================= état persistant ================= */
  const EXS = ['ex1', 'ex2', 'ex3', 'ex4'];
  const DEF = () => ({ xp: 0, combo: 0, best: 0, st: { ex1: { ok: 0, tot: 0, rec: [] }, ex2: { ok: 0, tot: 0, rec: [] }, ex3: { ok: 0, tot: 0, rec: [] }, ex4: { ok: 0, tot: 0, rec: [] } }, solved: {}, code: {}, exams: [], badges: [], day: { last: null, n: 0 }, acc: 'blue', snd: false, labo: null, ran: false });
  let S = DEF();
  try { const raw = localStorage.getItem('labo68k'); if (raw) S = Object.assign(DEF(), JSON.parse(raw)); } catch (e) { }
  const save = () => { try { localStorage.setItem('labo68k', JSON.stringify(S)); } catch (e) { } };

  /* ================= niveaux & badges ================= */
  const LV = [[0, 'Octet errant'], [80, 'Bit de signe'], [200, 'Registre D0'], [400, 'Pointeur de pile'], [700, 'Maître du CCR'], [1100, 'Dompteur de DBRA'], [1600, 'Briseur de moulinette'], [2300, 'Architecte 68k'], [3200, 'Légende du 20/20']];
  const lvOf = xp => { let i = 0; while (i + 1 < LV.length && xp >= LV[i + 1][0]) i++; return i; };
  const BADGES = [
    ['first', '1ST', 'Premier sang', 'Première bonne réponse'],
    ['c5', '×5', 'Série ×5', '5 bonnes réponses d\'affilée'],
    ['c12', '×12', 'Inarrêtable', '12 d\'affilée'],
    ['ea', 'EA', 'Sniper d\'adresses', '10 bonnes en Ex.1'],
    ['fl', 'NZVC', 'Maître des flags', '10 bonnes en Ex.2'],
    ['crs', 'RTS', 'Par cœur', '15 bonnes en Ex.3'],
    ['trc', 'DBF', 'Traceur', '8 bonnes en Ex.4'],
    ['lab', 'PC', 'Premier run', 'Exécuter un programme au Labo'],
    ['m1', 'OK', 'Moulinette verte', 'Un défi à 100 %'],
    ['m6', '6/12', 'Mi-parcours', '6 défis réussis'],
    ['mall', 'ALL', 'Moulinette brisée', 'Tous les défis réussis'],
    ['e16', '16+', 'Mention', 'Examen blanc ≥ 16/20'],
    ['e20', '20', 'Le 20/20', 'Examen blanc parfait'],
    ['d3', '3J', 'Régulier', '3 jours d\'entraînement d\'affilée'],
  ];
  function grant(id) {
    if (S.badges.includes(id)) return;
    S.badges.push(id); save();
    const b = BADGES.find(x => x[0] === id);
    toast(`<b>Badge débloqué · ${esc(b[2])}</b><br><span class="sub">${esc(b[3])}</span>`);
    sfx('badge'); confetti(60);
  }
  function checkBadges() {
    const st = S.st;
    if (EXS.some(k => st[k].ok > 0)) grant('first');
    if (S.combo >= 5) grant('c5'); if (S.combo >= 12) grant('c12');
    if (st.ex1.ok >= 10) grant('ea'); if (st.ex2.ok >= 10) grant('fl'); if (st.ex3.ok >= 15) grant('crs'); if (st.ex4.ok >= 8) grant('trc');
    const ns = Object.keys(S.solved).length;
    if (ns >= 1) grant('m1'); if (ns >= 6) grant('m6'); if (ns >= G.CH.length) grant('mall');
    if (S.day.n >= 3) grant('d3');
  }
  function touchDay() {
    const d = new Date(); const today = d.toISOString().slice(0, 10);
    if (S.day.last === today) return;
    const y = new Date(d - 864e5).toISOString().slice(0, 10);
    S.day.n = S.day.last === y ? S.day.n + 1 : 1; S.day.last = today;
  }
  function award(ex, ok, base = 10, el, silent) {
    touchDay();
    const s = S.st[ex];
    if (s) { s.tot++; if (ok) s.ok++; s.rec.push(ok ? 1 : 0); if (s.rec.length > 12) s.rec.shift(); }
    if (silent) { save(); return; }
    const lv0 = lvOf(S.xp);
    if (ok) {
      S.combo++; S.best = Math.max(S.best, S.combo);
      const mult = S.combo >= 10 ? 3 : S.combo >= 5 ? 2 : 1;
      const gain = base * mult; S.xp += gain;
      popAt(el, `+${gain} XP${mult > 1 ? ' ×' + mult : ''}`);
      sfx('ok');
      if (S.combo === 5 || S.combo === 10) toast(`<b>Combo ×${S.combo}</b> · l'XP est multipliée par ${S.combo >= 10 ? 3 : 2}`);
    } else { if (S.combo >= 3) toast(`Série de ${S.combo} interrompue. On repart.`); S.combo = 0; sfx('ko'); }
    save(); hud(); checkBadges();
    if (lvOf(S.xp) > lv0) { const L = LV[lvOf(S.xp)]; toast(`<b>Niveau ${lvOf(S.xp) + 1} · ${esc(L[1])}</b>`); confetti(140); sfx('lvl'); }
  }
  function hud() {
    const i = lvOf(S.xp), cur = LV[i][0], nxt = LV[i + 1] ? LV[i + 1][0] : cur + 1000;
    $('#lvnum').textContent = i + 1; $('#lvname').textContent = LV[i][1] + ' · ' + S.xp + ' XP';
    $('#xpbar').style.width = Math.min(100, (S.xp - cur) / (nxt - cur) * 100) + '%';
    const c = $('#combo'); c.textContent = '×' + S.combo; c.classList.toggle('hot', S.combo >= 3);
    $('#sndbtn').style.color = S.snd ? 'var(--acc)' : ''; $('#sndbtn').setAttribute('aria-label', S.snd ? 'Couper le son' : 'Activer le son');
    $$('.sw').forEach(b => b.classList.toggle('on', b.dataset.acc === S.acc));
  }
  function readiness() {
    const W = { ex1: 6, ex2: 4, ex3: 4, ex4: 6 }; let est = 0;
    const per = {};
    for (const k of EXS) { const r = S.st[k].rec; const acc = r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; const conf = Math.min(1, r.length / 6); per[k] = { acc, conf, n: r.length }; est += W[k] * acc * conf; }
    return { est: Math.round(est * 2) / 2, per };
  }

  /* ================= effets ================= */
  function toast(html, ms = 3600) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms); }
  function popAt(el, txt) {
    const p = document.createElement('div'); p.className = 'pop'; p.textContent = txt;
    const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    p.style.left = (r.left + r.width / 2) + 'px'; p.style.top = (r.top - 10) + 'px';
    document.body.appendChild(p); setTimeout(() => p.remove(), 1200);
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = $('#confetti'), cx = cv.getContext('2d'); let parts = [], raf = null;
  function confetti(n = 90) {
    if (reduce) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
    const col = [getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(), '#E3EBF9', '#3BD69C', '#FFC24D'];
    for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, r: Math.random() * 5 + 3, c: col[i % col.length], a: Math.random() * 6, life: 0, hex: Math.random() < .35 ? (Math.random() < .5 ? '$' + hx(Math.random() * 256 | 0, 2) : '1') : null });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); cx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += .15; p.life++; cx.globalAlpha = Math.max(0, 1 - p.life / 120); cx.fillStyle = p.c; if (p.hex) { cx.font = '700 12px JetBrains Mono, monospace'; cx.fillText(p.hex, p.x, p.y); } else { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); } });
    parts = parts.filter(p => p.life < 120 && p.y < innerHeight + 40);
    if (parts.length) raf = requestAnimationFrame(tick); else { raf = null; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  let ac = null;
  function sfx(kind) {
    if (!S.snd) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const seq = { ok: [[660, .06], [990, .09]], ko: [[220, .12]], badge: [[523, .07], [659, .07], [784, .07], [1046, .14]], lvl: [[392, .08], [523, .08], [659, .08], [784, .18]] }[kind] || [[440, .05]];
      let t = ac.currentTime;
      for (const [f, d] of seq) { const o = ac.createOscillator(), g = ac.createGain(); o.type = kind === 'ko' ? 'sawtooth' : 'square'; o.frequency.value = f; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d * .9; }
    } catch (e) { }
  }
  function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  /* ================= coloration syntaxique ================= */
  function commentIdx(l) { if (/^\s*\*/.test(l)) return l.indexOf('*'); let q = null; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === q) q = null; } else if (c === "'" || c === '"') q = c; else if (c === ';') return i; } return -1; }
  function hlOps(s) {
    let out = '', last = 0; const re = /('[^']*'?)|(\$[0-9A-Fa-f]+|%[01]+|\b\d+\b)|\b(D[0-7]|A[0-7]|SP|PC|SR|CCR)(\.[WLwl])?\b/gi; let m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index));
      if (m[1]) out += `<span class="t-str">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="t-num">${esc(m[2])}</span>`;
      else out += `<span class="t-reg">${esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(s.slice(last));
  }
  function hl(line) {
    const ci = commentIdx(line); const code = ci < 0 ? line : line.slice(0, ci), com = ci < 0 ? '' : line.slice(ci);
    let out = '', rest = code; let m;
    if ((m = /^([A-Za-z_.][\w.]*:?)/.exec(code)) && !M.isMnem(m[1].replace(':', ''))) { out += `<span class="t-lab">${esc(m[1])}</span>`; rest = code.slice(m[1].length); }
    if ((m = /^(\s*)([A-Za-z]+(?:\.[A-Za-z])?)/.exec(rest))) { out += esc(m[1]) + `<span class="t-mn">${esc(m[2])}</span>`; rest = rest.slice(m[0].length); }
    out += hlOps(rest);
    if (com) out += `<span class="t-com">${esc(com)}</span>`;
    return out;
  }
  const listing = src => `<div class="listing">${src.split('\n').map(hl).join('\n')}</div>`;

  /* ================= éditeur ================= */
  function makeEditor(host, code, opt = {}) {
    host.innerHTML = `<div class="ed"><div class="gut"></div><div class="edw"><pre aria-hidden="true"></pre><textarea id="${opt.id || 'ed'}" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Code assembleur 68000"></textarea></div></div>`;
    const ta = $('textarea', host), pre = $('pre', host), gut = $('.gut', host);
    const bps = opt.bps || new Set(); let marks = {};
    ta.value = code;
    function render() {
      const lines = ta.value.split('\n');
      pre.innerHTML = lines.map((l, i) => `<span class="ln${marks.cur === i + 1 ? ' cur' : ''}${marks.err === i + 1 ? ' err' : ''}">${hl(l) || ' '}</span>`).join('\n') + '\n\n';
      gut.innerHTML = lines.map((_, i) => `<div class="${bps.has(i + 1) ? 'bp' : ''}" data-l="${i + 1}" title="Point d'arrêt">${i + 1}</div>`).join('') + '<div></div><div></div>';
      sync();
    }
    function sync() { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; }
    ta.addEventListener('input', () => { marks.err = null; render(); opt.onChange && opt.onChange(ta.value); });
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('\t', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { // auto-indentation
        e.preventDefault(); const s = ta.selectionStart; const ls = ta.value.lastIndexOf('\n', s - 1) + 1; const line = ta.value.slice(ls, s);
        const ind = /^\S/.test(line) && line.trim() ? '\t' : (line.match(/^\s*/)[0] || '\t');
        ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input'));
      }
      opt.onKey && opt.onKey(e);
    });
    gut.addEventListener('click', e => { const l = +e.target.dataset.l; if (!l) return; bps.has(l) ? bps.delete(l) : bps.add(l); render(); opt.onBp && opt.onBp(bps); });
    render();
    return {
      get value() { return ta.value; }, set value(v) { ta.value = v; render(); },
      mark(m) { marks = m || {}; render(); if (marks.cur || marks.err) { const l = marks.cur || marks.err; const top = (l - 1) * 21; if (top < ta.scrollTop || top > ta.scrollTop + ta.clientHeight - 60) { ta.scrollTop = top - 80; sync(); } } },
      bps, ta, focus() { ta.focus(); }
    };
  }

  /* ================= routeur ================= */
  const routes = { home: pageHome, guide: pageGuide, ex1: pageEx1, ex2: pageEx2, ex3: pageEx3, ex4: pageEx4, labo: pageLabo, moulinette: pageMoul, exam: pageExam };
  let cleanup = null; let keyHandler = null;
  function go() {
    const r = (location.hash || '#home').slice(1);
    const page = routes[r] ? r : 'home';
    if (cleanup) { cleanup(); cleanup = null; } keyHandler = null;
    $$('#tabs a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + page));
    const on = $('#tabs a.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    routes[page]();
    window.scrollTo(0, 0);
  }
  addEventListener('hashchange', go);
  document.addEventListener('keydown', e => { if (keyHandler) keyHandler(e); });
  const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);

  /* ================= ACCUEIL ================= */
  const DEMO = `Main	move.l	#$52A59382,d7
	cmp.w	#$7000,d7	; signé !
	bgt	part2
	moveq.l	#2,d1
part2	move.l	#260,d0	; = $104
loop2	addq.l	#1,d2
	subq.b	#1,d0	; D0.B = $04
	bne	loop2
part4	move.l	#$12345678,d4
	ror.w	#4,d4
	ror.l	#8,d4
	swap	d4
	rol.b	#4,d4
	ror.l	#8,d4`;
  function pageHome() {
    const R = readiness();
    const exInfo = [['ex1', 'Ex.1', 'Modes d\'adressage', 6, 'Mémoire et registres après une instruction MOVE.'], ['ex2', 'Ex.2', 'Additions & flags', 4, 'Résultat et N Z V C sur 8, 16, 32 bits.'], ['ex3', 'Ex.3', 'Questions de cours', 4, 'Pile, MOVEM, BSR, PC, directives.'], ['ex4', 'Ex.4', 'Traçage de programme', 6, 'CMP/Bcc, boucles SUBQ et DBRA, rotations.']];
    const last = S.exams.slice(-10);
    app.innerHTML = `
    <section class="hero">
      <div class="stack" style="gap:18px">
        <span class="eyebrow">Architecture des ordinateurs · EPITA S3 · Motorola 68000</span>
        <h1>Le labo pour viser <em>20/20</em> en assembleur 68000.</h1>
        <p class="lead">Un vrai simulateur 68000 dans ton navigateur, une moulinette qui teste ton code, et des exercices générés à l'infini au format exact de ton contrôle, avec la correction pas à pas.</p>
        <div class="row"><a class="btn pri" href="#exam">Lancer un examen blanc</a><a class="btn" href="#guide">Lire la méthode</a><a class="btn ghost" href="#labo">Ouvrir le Labo</a></div>
        <div class="row tiny"><span>Raccourcis : <kbd>Entrée</kbd> valider · <kbd>N</kbd> question suivante · <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> exécuter</span></div>
      </div>
      <div class="cpu" aria-label="Simulation en direct">
        <div class="hdr"><span class="live">MC68000 · exécution en direct</span><span id="dstep">pas 0</span></div>
        <div class="cur" id="dcur">—</div>
        <div class="regs" id="dregs" style="grid-template-columns:repeat(2,minmax(0,1fr))"></div>
        <div class="row" style="justify-content:space-between;margin-top:12px"><div class="leds" id="dleds"></div><span class="tiny">C'est l'Ex.4 de ton contrôle</span></div>
      </div>
    </section>
    <section class="stack" style="gap:16px">
      <div class="row" style="justify-content:space-between;align-items:end"><h2>Ta préparation</h2><span class="sub">${S.st.ex1.tot + S.st.ex2.tot + S.st.ex3.tot + S.st.ex4.tot} réponses · meilleure série ×${S.best} · ${S.day.n} jour(s) d'affilée</span></div>
      <div class="grid4">${exInfo.map(([k, n, t, pts, d]) => { const p = R.per[k]; return `
        <a class="card skill" href="#${k}" style="text-decoration:none;color:inherit">
          <div class="top2"><span class="eyebrow">${n}</span><span class="pts">${pts} pts</span></div>
          <h3 style="margin:0">${t}</h3><p class="sub">${d}</p>
          <div class="meter"><i style="width:${Math.round(p.acc * p.conf * 100)}%"></i></div>
          <div class="tiny">${p.n ? `${Math.round(p.acc * 100)} % sur les ${p.n} dernières` : 'Pas encore commencé'}</div>
        </a>`; }).join('')}</div>
      <div class="grid3">
        <div class="card"><span class="eyebrow">Note estimée</span><div class="big" style="margin-top:10px">${R.est.toString().replace('.', ',')}<small> / 20</small></div><p class="sub" style="margin-top:8px">Calculée sur tes 12 dernières réponses par exercice, pondérée par le barème (6 · 4 · 4 · 6). Il faut au moins 6 réponses par exercice pour qu'elle compte à plein.</p></div>
        <div class="card"><span class="eyebrow">Examens blancs</span>${last.length ? spark(last.map(e => e.score)) : '<p class="sub" style="margin-top:10px">Aucun examen passé. Le premier te donne ta vraie position.</p>'}<div class="row" style="margin-top:10px"><a class="btn sm" href="#exam">Passer un examen (1 h)</a></div></div>
        <div class="card"><span class="eyebrow">Moulinette</span><div class="big" style="margin-top:10px">${Object.keys(S.solved).length}<small> / ${G.CH.length} défis</small></div><p class="sub" style="margin-top:8px">Écris de vrais sous-programmes, la moulinette les teste avec des registres pourris pour vérifier que tu sauvegardes tout.</p><div class="row" style="margin-top:10px"><a class="btn sm" href="#moulinette">Relever un défi</a></div></div>
      </div>
      <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Badges</h3><span class="tiny">${S.badges.length} / ${BADGES.length}</span></div>
        <div class="badges">${BADGES.map(b => `<div class="bdg ${S.badges.includes(b[0]) ? 'got' : ''}" title="${esc(b[3])}"><span class="ic">${esc(b[1])}</span><span><b style="display:block;font-weight:600">${esc(b[2])}</b><span class="tiny">${esc(b[3])}</span></span></div>`).join('')}</div>
      </div>
    </section>`;
    // démo live
    const prog = M.assemble(DEMO); const cpu = new M.CPU(); let prev = null;
    const restart = () => { cpu.load(prog); prev = cpu.D.slice(); };
    restart();
    const draw = () => {
      const ins = prog.byAddr.get(cpu.pc);
      $('#dcur').innerHTML = ins ? hl('\t' + ins.op.toLowerCase() + (ins.size ? '.' + ins.size.toLowerCase() : '') + '\t' + ins.ops.join(',')) : '<span class="t-com">; fin, on recommence</span>';
      $('#dstep').textContent = 'pas ' + cpu.steps;
      $('#dregs').innerHTML = [1, 2, 4, 7].map(i => `<div class="reg ${prev && prev[i] !== cpu.D[i] ? 'flash' : ''}"><b>D${i}</b><span>$${hx(cpu.D[i], 8)}</span></div>`).join('');
      $('#dleds').innerHTML = ['X', 'N', 'Z', 'V', 'C'].map(f => `<span class="led ${cpu[f] ? 'on' : ''}"><i></i>${f}</span>`).join('');
      prev = cpu.D.slice();
    };
    draw();
    const timer = setInterval(() => {
      if (cpu.halted) { restart(); draw(); return; }
      try { const ins = prog.byAddr.get(cpu.pc); cpu.step(); if (ins && ins.op === 'BNE' && cpu.pc === ins.opnds[0].v && (cpu.D[0] & 0xFF) > 1) { /* accélère la boucle */ while ((cpu.D[0] & 0xFF) > 1) { cpu.step(); cpu.step(); cpu.step(); } } } catch (e) { restart(); }
      draw();
    }, reduce ? 2000 : 900);
    cleanup = () => clearInterval(timer);
  }
  function spark(v) {
    const w = 260, h = 70, n = v.length, x = i => n === 1 ? w / 2 : 8 + i * (w - 16) / (n - 1), y = s => h - 8 - s / 20 * (h - 16);
    const pts = v.map((s, i) => `${x(i)},${y(s)}`).join(' ');
    return `<div style="margin-top:10px"><div class="big">${v[n - 1].toString().replace('.', ',')}<small> / 20 au dernier</small></div>
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;margin-top:8px" role="img" aria-label="Évolution des notes">
      <line x1="0" x2="${w}" y1="${y(10)}" y2="${y(10)}" stroke="var(--line2)" stroke-dasharray="3 4"/>
      <polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2"/>
      ${v.map((s, i) => `<circle cx="${x(i)}" cy="${y(s)}" r="${i === n - 1 ? 4 : 2.5}" fill="${i === n - 1 ? 'var(--acc)' : 'var(--panel)'}" stroke="var(--acc)"/>`).join('')}</svg></div>`;
  }

  /* ================= GUIDE ================= */
  const REF = [
    ['MOVE', 's,d', 's → d', '-**00'], ['MOVEA', 's,An', 's → An (.W étendu en signe)', '-----'], ['MOVEQ', '#n,Dn', 'n (−128..127) étendu → Dn.L', '-**00'], ['MOVEM', 'liste,-(A7) / (A7)+,liste', 'empile / dépile plusieurs registres', '-----'],
    ['LEA', 's,An', 'adresse effective de s → An', '-----'], ['CLR', 'd', '0 → d', '-0100'], ['ADD/ADDI/ADDQ', 's,d', 's + d → d (ADDQ : 1 à 8)', '*****'], ['SUB/SUBI/SUBQ', 's,d', 'd − s → d', '*****'],
    ['CMP', 's,d', 'd − s, flags seulement', '-****'], ['TST', 'd', 'compare d à 0', '-**00'], ['NEG', 'd', '0 − d → d', '*****'], ['EXT', 'Dn', '.W : octet→mot · .L : mot→long', '-**00'],
    ['SWAP', 'Dn', 'échange les deux moitiés de 16 bits', '-**00'], ['MULU/MULS', 's,Dn', '16 × 16 → 32 bits', '-**00'], ['DIVU/DIVS', 's,Dn', 'Dn / s.W → reste:quotient', '-***0'], ['AND/OR/EOR', 's,d', 'logique', '-**00'],
    ['NOT', 'd', 'complément à 1', '-**00'], ['LSL/LSR', '#n,Dy', 'décalage logique (0 entre)', '***0*'], ['ASL/ASR', '#n,Dy', 'arithmétique (ASR recopie le signe)', '*****'], ['ROL/ROR', '#n,Dy', 'rotation (X intact)', '-**0*'],
    ['BTST/BSET/BCLR', '#n,d', 'teste / met à 1 / à 0 le bit n', '--*--'], ['Bcc / BRA', 'étiquette', 'branche si cc vrai', '-----'], ['DBRA (DBF)', 'Dn,étiq.', 'Dn.W−1 ; boucle si ≠ −1', '-----'], ['BSR/JSR', 'étiquette', 'empile PC de retour, saute', '-----'],
    ['RTS', '', 'dépile le PC', '-----'], ['TRAP #15', '', 'E/S du simulateur (D0 = tâche)', '-----'],
  ];
  function pageGuide() {
    app.innerHTML = `
    <div class="stack" style="gap:22px">
      <div class="stack"><span class="eyebrow">Méthode 20/20</span><h2>Ce que le contrôle demande, et comment ne rien perdre</h2><p class="lead">Le contrôle dure 1 h, 4 exercices, 20 points. Les quatre exercices reviennent toujours sous la même forme : apprends la procédure de chacun, puis entraîne-toi jusqu'à ce qu'elle soit automatique.</p></div>
      <div class="grid2 eq">
        ${gcard('ex1', 'Ex.1 · 6 pts', 'Modes d\'adressage', ['Pour chaque opérande, écris la chaîne : <code>-7(A1)</code> → <code>(A1 − 7)</code> → <code>($5008 − 7)</code> → <code>($5001)</code>.', 'Lis la SOURCE en premier (avec ses effets de bord), puis calcule la DESTINATION avec les registres déjà modifiés.', 'Écris la valeur octet par octet : .B = 1 octet, .W = 2, .L = 4, en big-endian (poids fort à l\'adresse la plus basse).', 'Recopie la ligne mémoire entière et chaque registre modifié sur 32 bits ($00005004).'], ['<b>Pièges</b> : l\'index <code>D0.L = $FFFFFFFB</code> vaut −5. <code>D2.W = $FFFE</code> vaut −2 alors que <code>D2.L</code> est positif. <code>#52</code> est décimal ($34). <code>-(An)</code> décrémente AVANT, <code>(An)+</code> incrémente APRÈS.'])}
        ${gcard('ex2', 'Ex.2 · 4 pts', 'Additions & flags', ['Additionne en hexa sur la taille demandée et tronque : $7F + $7F = $FE sur 8 bits.', '<b>C</b> : la somme non signée dépasse-t-elle $FF / $FFFF / $FFFFFFFF ?', '<b>V</b> : regarde les signes. Positif + positif = négatif, ou négatif + négatif = positif → V = 1. Sinon V = 0.', '<b>N</b> = bit de poids fort du résultat (1er chiffre hexa ≥ 8). <b>Z</b> = résultat nul.'], ['<b>Piège</b> : un positif + un négatif ne déborde JAMAIS (V = 0), même si C = 1. Sur 16 bits, $007F + $0080 = $00FF est positif : N = 0.'])}
        ${gcard('ex3', 'Ex.3 · 4 pts', 'Questions de cours', ['Empiler : <code>MOVE.L D0,-(A7)</code>. Dépiler : <code>MOVE.L (A7)+,D0</code>.', 'Plusieurs registres : <code>MOVEM.L D0-D3/A1,-(A7)</code> puis <code>MOVEM.L (A7)+,D0-D3/A1</code>.', 'Appel : <code>BSR</code> ou <code>JSR</code>. Retour : <code>RTS</code>. Prochaine instruction : <code>PC</code>.', 'Directives : ORG (adresse), EQU (valeur), DC (constantes), DS (réservation).'], ['<b>Piège</b> : précise toujours la taille (.L) quand on te dit « sur 32 bits ». MOVEM avec <code>-(A7)</code> range dans l\'ordre inversé, mais tu écris la liste dans n\'importe quel ordre.'])}
        ${gcard('ex4', 'Ex.4 · 6 pts', 'Traçage de programme', ['<b>CMP.s #x,Dn</b> calcule Dn − x sur la taille .s seulement. Repère si le Bcc est signé (GT GE LT LE) ou non signé (HI HS LO LS).', '<b>SUBQ.B + BNE</b> : le nombre de tours = l\'octet de poids faible de D0 ($104 → 4). S\'il vaut 0 → 256 tours.', '<b>DBRA</b> : tours = D0.W + 1 ($9999 → $999A). Les 16 bits de poids fort sont ignorés.', '<b>Rotations</b> : 1 chiffre hexa = 4 bits. ROR.W #4 ne tourne que le mot de poids faible.'], ['<b>Pièges</b> : D2 et D3 sont des compteurs → répondre sur 32 bits ($00000004). <code>$9382</code> est NÉGATIF en .W : il est plus petit que $7000 en signé.'])}
      </div>
      <div class="grid2 eq">
        <div class="card"><h3>Branchements après <code>CMP src,dst</code></h3><div class="tblwrap"><table class="t"><thead><tr><th>Si dst … src</th><th>Non signé</th><th>Signé</th></tr></thead><tbody>
          <tr><td>&gt;</td><td><code>BHI</code></td><td><code>BGT</code></td></tr><tr><td>≥</td><td><code>BHS</code> = BCC</td><td><code>BGE</code></td></tr><tr><td>&lt;</td><td><code>BLO</code> = BCS</td><td><code>BLT</code></td></tr><tr><td>≤</td><td><code>BLS</code></td><td><code>BLE</code></td></tr><tr><td>= / ≠</td><td colspan="2"><code>BEQ</code> / <code>BNE</code></td></tr></tbody></table></div>
          <p class="tiny" style="margin-top:8px">GT : Z = 0 et N = V · GE : N = V · HI : C = 0 et Z = 0 · LS : C = 1 ou Z = 1</p></div>
        <div class="card"><h3>Modes d'adressage</h3><div class="tblwrap"><table class="t"><thead><tr><th>Syntaxe</th><th>Adresse effective</th></tr></thead><tbody>
          <tr><td><code>Dn</code> / <code>An</code></td><td>le registre lui-même</td></tr><tr><td><code>#n</code></td><td>aucune (donnée immédiate)</td></tr><tr><td><code>(An)</code></td><td>An</td></tr><tr><td><code>(An)+</code></td><td>An, puis An += 1/2/4</td></tr><tr><td><code>-(An)</code></td><td>An −= 1/2/4, puis An</td></tr><tr><td><code>d16(An)</code></td><td>An + d16</td></tr><tr><td><code>d8(An,Xn.W/.L)</code></td><td>An + Xn (signé) + d8</td></tr><tr><td><code>$5006</code></td><td>absolu : $5006</td></tr></tbody></table></div></div>
      </div>
      <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Référence des instructions</h3><input class="field" id="qref" placeholder="Filtrer : DBRA, flags, pile…" style="max-width:260px"></div>
        <div class="tblwrap"><table class="t" id="reft"><thead><tr><th>Instruction</th><th>Opérandes</th><th>Effet</th><th>X N Z V C</th></tr></thead><tbody></tbody></table></div>
        <p class="tiny" style="margin-top:8px">* modifié selon le résultat · - inchangé · 0 / 1 forcé. Source : annexe EASy68K du sujet.</p></div>
    </div>`;
    const body = $('#reft tbody');
    const fill = q => { q = (q || '').toUpperCase(); body.innerHTML = REF.filter(r => !q || r.join(' ').toUpperCase().includes(q)).map(r => `<tr><td><code>${r[0]}</code></td><td><code>${esc(r[1])}</code></td><td>${esc(r[2])}</td><td><code>${r[3].split('').join(' ')}</code></td></tr>`).join(''); };
    fill(); $('#qref').addEventListener('input', e => fill(e.target.value));
  }
  function gcard(k, eb, t, steps, traps) { return `<div class="card gcard"><span class="eyebrow">${eb}</span><h3 style="margin:0">${t}</h3><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>${traps.map(x => `<div class="trap">${x}</div>`).join('')}<div><a class="btn sm pri" href="#${k}">S'entraîner</a></div></div>`; }

  /* ================= composants partagés ================= */
  const memRows = (st, mem, mark) => [0, 8, 16].map(o => `<div class="memrow"><span class="ad">$${hx(st.base + o, 6)}</span><span class="bytes">${mem.slice(o, o + 8).map((b, i) => `<span class="${mark ? mark(o + i) : ''}">${hx(b, 2)}</span>`).join('')}</span></div>`).join('');
  const initPanel = st => `<div class="card stack"><div class="row" style="justify-content:space-between"><span class="eyebrow">Valeurs initiales</span><span class="tiny">réinitialisées à chaque instruction</span></div>
      <div class="regs" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[0, 1, 2].map(i => `<div class="reg"><b>D${i}</b><span>$${hx(st.D[i], 8)}</span></div><div class="reg"><b>A${i}</b><span>$${hx(st.A[i], 8)}</span></div>`).join('')}<div class="reg"><b>PC</b><span>$00006000</span></div></div>
      <div class="memtbl">${memRows(st, st.mem)}</div></div>`;
  const parseBytes = s => { const t = s.trim().replace(/\$/g, '').split(/[\s,]+/).filter(Boolean); if (t.length !== 8 || t.some(x => !/^[0-9a-f]{1,2}$/i.test(x))) return null; return t.map(x => parseInt(x, 16)); };
  const parseHex = s => { const t = String(s).trim().replace(/^\$|^0x/i, ''); if (!/^[0-9a-f]{1,8}$/i.test(t)) return null; return parseInt(t, 16) >>> 0; };
  function chainHTML(ex) { return ex.map(e => `<div class="stack" style="gap:6px"><span class="tiny" style="color:var(--muted)">${e.label}</span><div class="chain">${e.chain.map(c => `<span>${esc(c)}</span>`).join('<i>→</i>')}</div>${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}</div>`).join(''); }
  function regsChangedTxt(r) { return r.regChanged.length ? r.regChanged.map(n => `<code>${n} = $${hx(n[0] === 'D' ? r.D[+n[1]] : r.A[+n[1]], 8)}</code>`).join(' ') : 'Aucun changement'; }

  /* ================= EX.1 ================= */
  let E1 = null;
  function newE1(keepState) { const st = keepState && E1 && E1.k < 4 ? E1.st : G.ex1State(); const k = keepState && E1 && E1.k < 4 ? E1.k + 1 : 1; const g = G.genEx1(st); E1 = { ...g, k, done: false }; }
  function pageEx1() {
    if (!E1) newE1();
    const { st, ins, k } = E1;
    app.innerHTML = `
    <div class="stack" style="gap:18px">
      <div class="row" style="justify-content:space-between;align-items:end"><div class="stack" style="gap:6px"><span class="eyebrow">Exercice 1 · 6 points au contrôle</span><h2>Modes d'adressage</h2><p class="lead">Donne le nouveau contenu de la mémoire et des registres après l'instruction. Comme au contrôle, 4 instructions partagent les mêmes valeurs initiales.</p></div><span class="pill acc">Instruction ${k} / 4</span></div>
      <div class="grid2">
        ${initPanel(st)}
        <div class="card stack" id="e1card">
          <div class="instr" id="e1ins">${hl('\t' + ins).replace(/^\t/, '')}</div>
          <div><label class="lab">Mémoire après l'instruction (modifie les octets qui changent)</label>
            <div class="memin">${[0, 8, 16].map((o, i) => `<span class="ad">$${hx(st.base + o, 6)}</span><input class="field" id="e1m${i}" value="${st.mem.slice(o, o + 8).map(b => hx(b, 2)).join(' ')}" autocomplete="off" spellcheck="false" aria-label="Ligne mémoire $${hx(st.base + o, 6)}">`).join('')}</div></div>
          <div><label class="lab">Registres après l'instruction (32 bits)</label>
            <div class="ansgrid">${['D0', 'A0', 'D1', 'A1', 'D2', 'A2'].map(r => `<div><label class="lab" for="e1r${r}">${r}</label><input class="field" id="e1r${r}" value="$${hx(r[0] === 'D' ? st.D[+r[1]] : st.A[+r[1]], 8)}" autocomplete="off" spellcheck="false"></div>`).join('')}</div></div>
          <div class="row"><button class="btn pri" id="e1go" type="button">Vérifier <kbd>Entrée</kbd></button><button class="btn" id="e1hint" type="button">Indice</button><button class="btn ghost" id="e1next" type="button">Suivante <kbd>N</kbd></button><button class="btn ghost" id="e1lab" type="button">Voir au Labo</button></div>
          <div id="e1fb"></div>
        </div>
      </div>
    </div>`;
    $('#e1go').onclick = check; $('#e1next').onclick = () => { newE1(true); pageEx1(); };
    $('#e1hint').onclick = () => { const ex = G.explain1(st, ins); $('#e1fb').innerHTML = `<div class="fb"><span class="tiny">Indice : calcule d'abord l'adresse effective de chaque opérande.</span>${chainHTML(ex.map(e => ({ ...e, chain: e.chain.slice(0, 2), note: '' })))}</div>`; };
    $('#e1lab').onclick = () => openInLabo(ex1LaboSrc(st, ins));
    keyHandler = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); E1.done ? $('#e1next').click() : check(); } else if ((e.key === 'n' || e.key === 'N') && !typing(e)) { $('#e1next').click(); } };
    function check() {
      if (E1.done) return;
      const r = E1.res; let ok = true;
      [0, 1, 2].forEach(i => { const inp = $('#e1m' + i); const b = parseBytes(inp.value); const good = b && b.every((x, j) => x === r.mem[i * 8 + j]); inp.classList.toggle('ok', !!good); inp.classList.toggle('ko', !good); if (!good) ok = false; });
      ['D0', 'D1', 'D2', 'A0', 'A1', 'A2'].forEach(n => { const inp = $('#e1r' + n); const v = parseHex(inp.value); const exp = n[0] === 'D' ? r.D[+n[1]] : r.A[+n[1]]; const good = v === exp; inp.classList.toggle('ok', good); inp.classList.toggle('ko', !good); if (!good) ok = false; });
      E1.done = true;
      award('ex1', ok, 15, $('#e1go'));
      if (!ok) shake($('#e1card')); else if (S.combo % 5 === 0) confetti(70);
      const ex = G.explain1(st, ins);
      $('#e1fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'ko'}"><div class="verdict">${ok ? 'Exact.' : 'Pas tout à fait.'}</div>${chainHTML(ex)}
        <div class="stack" style="gap:6px"><span class="tiny" style="color:var(--muted)">Réponse attendue</span><div class="memtbl">${memRows(st, r.mem, i => r.memChanged[i] ? 'ch' : '')}</div><div class="sub">Registres : ${regsChangedTxt(r)}</div></div></div>`;
    }
  }
  function ex1LaboSrc(st, ins) {
    const L = ['; Ex.1 : état initial puis l\'instruction (exécute pas à pas)'];
    [0, 1, 2].forEach(i => L.push(`\tmove.l\t#$${hx(st.D[i], 8)},d${i}`));
    [0, 1, 2].forEach(i => L.push(`\tmovea.l\t#$${hx(st.A[i], 8)},a${i}`));
    L.push('\tbra\tgo', '', `\torg\t$${hx(st.base, 4)}`, `\tdc.b\t${st.mem.map(b => '$' + hx(b, 2)).join(',')}`, '', '\torg\t$1100', 'go\t' + ins.toLowerCase());
    return L.join('\n');
  }

  /* ================= EX.2 ================= */
  let E2 = null, E2sub = false;
  function pageEx2() {
    if (!E2) E2 = { q: G.genEx2(E2sub), done: false, fl: { N: 0, Z: 0, V: 0, C: 0 } };
    const { q } = E2; const bits = q.s * 8;
    app.innerHTML = `
    <div class="stack" style="gap:18px">
      <div class="row" style="justify-content:space-between;align-items:end"><div class="stack" style="gap:6px"><span class="eyebrow">Exercice 2 · 4 points au contrôle</span><h2>Additions et flags N Z V C</h2><p class="lead">Donne le résultat sur la taille indiquée et l'état des quatre flags. Touches <kbd>N</kbd><kbd>Z</kbd><kbd>V</kbd><kbd>C</kbd> pour basculer un flag hors du champ de saisie.</p></div>
        <label class="check"><input type="checkbox" id="e2sub" ${E2sub ? 'checked' : ''}> Ajouter des soustractions (bonus)</label></div>
      <div class="grid2 lft">
        <div class="card stack" id="e2card" style="gap:18px">
          <div class="row" style="justify-content:space-between"><span class="pill acc">${bits} bits · .${{ 1: 'B', 2: 'W', 4: 'L' }[q.s]}</span><span class="tiny">${q.op === 'ADD' ? 'Addition' : 'Soustraction (destination − source)'}</span></div>
          <div class="bigop">${q.text} <span style="color:var(--dim)">=</span> ?</div>
          <div><label class="lab" for="e2res">Résultat (hexadécimal, ${q.s * 2} chiffres)</label><input class="field" id="e2res" placeholder="$${'0'.repeat(q.s * 2)}" autocomplete="off" spellcheck="false" style="font-size:18px;max-width:240px"></div>
          <div><label class="lab">Flags</label><div class="flags">${['N', 'Z', 'V', 'C'].map(f => `<button type="button" class="flag ${E2.fl[f] ? 'on' : ''}" data-f="${f}" aria-label="Flag ${f}"><span class="k">${f}</span><span class="v">${E2.fl[f]}</span></button>`).join('')}</div></div>
          <div class="row"><button class="btn pri" id="e2go" type="button">Vérifier <kbd>Entrée</kbd></button><button class="btn" id="e2bin" type="button">Voir en binaire</button><button class="btn ghost" id="e2next" type="button">Suivante</button></div>
          <div id="e2binv"></div>
        </div>
        <div id="e2fb" class="stack"><div class="card flat stack"><span class="eyebrow">Mémo</span><p class="sub"><b>C</b> = retenue non signée · <b>V</b> = débordement signé (même signe en entrée, signe différent en sortie) · <b>N</b> = bit de poids fort · <b>Z</b> = résultat nul.</p><p class="sub">Un chiffre hexa ≥ 8 en tête = nombre négatif en signé.</p></div></div>
      </div>
    </div>`;
    const flip = f => { if (E2.done) return; E2.fl[f] ^= 1; const b = $(`.flag[data-f="${f}"]`); b.classList.toggle('on', !!E2.fl[f]); $('.v', b).textContent = E2.fl[f]; };
    $$('.flag').forEach(b => b.onclick = () => flip(b.dataset.f));
    $('#e2sub').onchange = e => { E2sub = e.target.checked; E2 = null; pageEx2(); };
    $('#e2next').onclick = () => { E2 = null; pageEx2(); setTimeout(() => $('#e2res') && $('#e2res').focus(), 0); };
    $('#e2bin').onclick = () => { const b = (v) => v.toString(2).padStart(bits, '0').replace(/(.{4})(?=.)/g, '$1 '); $('#e2binv').innerHTML = `<div class="bin">  ${b(q.a)}\n${q.op === 'ADD' ? '+' : '−'} ${b(q.b)}</div>`; };
    $('#e2go').onclick = check;
    keyHandler = e => {
      if (e.key === 'Enter') { e.preventDefault(); E2.done ? $('#e2next').click() : check(); return; }
      if (typing(e)) return;
      const k = e.key.toUpperCase(); if (['N', 'Z', 'V', 'C'].includes(k) && !E2.done) { e.preventDefault(); flip(k); } else if (k === 'N' && E2.done) $('#e2next').click();
    };
    function check() {
      if (E2.done) return; E2.done = true;
      const v = parseHex($('#e2res').value); const rok = v !== null && v === q.r && $('#e2res').value.replace(/^\$/, '').trim().length <= q.s * 2;
      $('#e2res').classList.toggle('ok', rok); $('#e2res').classList.toggle('ko', !rok);
      let fok = true; ['N', 'Z', 'V', 'C'].forEach(f => { const g = E2.fl[f] === q[f]; if (!g) fok = false; const b = $(`.flag[data-f="${f}"]`); b.classList.add(g ? 'ok' : 'ko'); });
      const ok = rok && fok; award('ex2', ok, 10, $('#e2go')); if (!ok) shake($('#e2card'));
      $('#e2fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'ko'}"><div class="verdict">${ok ? 'Exact.' : 'Raté, regarde le détail.'}</div>
        <div class="row" style="gap:14px"><span class="mono" style="font-size:20px">$${hx(q.r, q.s * 2)}</span>${['N', 'Z', 'V', 'C'].map(f => `<span class="pill ${E2.fl[f] === q[f] ? 'ok' : 'ko'}">${f} = ${q[f]}</span>`).join('')}</div>
        <div class="explain">${G.explain2(q).map(l => `<div>${l}</div>`).join('')}</div></div>`;
      $('#e2bin').click();
    }
    setTimeout(() => $('#e2res') && $('#e2res').focus(), 0);
  }

  /* ================= EX.3 ================= */
  let E3 = null;
  function pageEx3() {
    if (!E3) E3 = { q: G.genEx3(), done: false };
    const { q } = E3;
    app.innerHTML = `
    <div class="stack" style="gap:18px">
      <div class="stack" style="gap:6px"><span class="eyebrow">Exercice 3 · 4 points au contrôle</span><h2>Questions de cours</h2><p class="lead">Réponds par une instruction, un registre, un flag ou un nombre. Les instructions sont corrigées par un vrai parseur : <code>MOVEM.L (SP)+,A4/A3/A2/A1</code> est accepté pour <code>MOVEM.L (A7)+,A1-A4</code>.</p></div>
      <div class="card stack" id="e3card" style="gap:16px;max-width:860px">
        <span class="pill acc" style="align-self:start">${q.type === 'ins' ? 'Instruction attendue' : q.type === 'num' ? 'Nombre attendu' : 'Réponse courte'}</span>
        <h3 style="font-size:21px;line-height:1.35">${esc(q.q)}</h3>
        <input class="field" id="e3in" placeholder="${q.type === 'ins' ? 'ex : MOVE.L D0,-(A7)' : 'ta réponse'}" autocomplete="off" spellcheck="false" style="font-size:17px">
        <div class="row"><button class="btn pri" id="e3go" type="button">Vérifier <kbd>Entrée</kbd></button><button class="btn" id="e3idk" type="button">Je ne sais pas</button><button class="btn ghost" id="e3next" type="button">Suivante</button></div>
        <div id="e3fb"></div>
      </div>
    </div>`;
    const next = () => { E3 = null; pageEx3(); setTimeout(() => $('#e3in').focus(), 0); };
    $('#e3next').onclick = next; $('#e3go').onclick = () => check(false); $('#e3idk').onclick = () => check(true);
    keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); E3.done ? next() : check(false); } else if ((e.key === 'n' || e.key === 'N') && !typing(e) && E3.done) next(); };
    function check(idk) {
      if (E3.done) return; E3.done = true;
      const ok = !idk && G.check3(q, $('#e3in').value);
      $('#e3in').classList.add(ok ? 'ok' : 'ko'); award('ex3', ok, 8, $('#e3go')); if (!ok) shake($('#e3card'));
      $('#e3fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'ko'}"><div class="verdict">${ok ? 'Exact.' : 'Réponse attendue :'}</div><div class="mono" style="font-size:18px">${esc(q.show)}</div><p class="sub">${esc(q.why)}</p></div>`;
    }
    setTimeout(() => $('#e3in').focus(), 0);
  }

  /* ================= EX.4 ================= */
  let E4 = null;
  function pageEx4() {
    if (!E4) E4 = { g: G.genEx4(), done: false };
    const { g } = E4;
    app.innerHTML = `
    <div class="stack" style="gap:18px">
      <div class="stack" style="gap:6px"><span class="eyebrow">Exercice 4 · 6 points au contrôle</span><h2>Traçage de programme</h2><p class="lead">Donne D1, D2, D3 et D4 après l'exécution, en hexadécimal sur 32 bits. Chaque programme est généré avec les mêmes pièges que le contrôle.</p></div>
      <div class="grid2">
        <div class="stack">${listing(g.prog)}<button class="btn ghost sm" id="e4lab" type="button" style="align-self:start">Exécuter pas à pas au Labo</button></div>
        <div class="card stack" id="e4card">
          <span class="eyebrow">Valeurs des registres après exécution</span>
          <div class="ansgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[1, 2, 3, 4].map(i => `<div><label class="lab" for="e4d${i}">D${i} = $</label><input class="field" id="e4d${i}" placeholder="00000000" autocomplete="off" spellcheck="false" style="font-size:16px"></div>`).join('')}</div>
          <div class="row"><button class="btn pri" id="e4go" type="button">Vérifier <kbd>Entrée</kbd></button><button class="btn ghost" id="e4next" type="button">Nouveau programme</button></div>
          <div id="e4fb"></div>
        </div>
      </div>
    </div>`;
    $('#e4lab').onclick = () => openInLabo(g.prog);
    const next = () => { E4 = null; pageEx4(); };
    $('#e4next').onclick = next; $('#e4go').onclick = check;
    keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); E4.done ? next() : check(); } else if ((e.key === 'n' || e.key === 'N') && !typing(e) && E4.done) next(); };
    function check() {
      if (E4.done) return; E4.done = true; let n = 0;
      [1, 2, 3, 4].forEach((i, k) => { const inp = $('#e4d' + i), v = parseHex(inp.value), good = v === g.ans[k]; inp.classList.add(good ? 'ok' : 'ko'); if (good) n++; });
      const ok = n === 4; award('ex4', ok, 10 + n * 5, $('#e4go')); if (!ok) shake($('#e4card'));
      $('#e4fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'ko'}"><div class="verdict">${n} / 4 registres justes</div>
        ${g.ex.map((x, k) => `<details ${k < 3 || !ok ? 'open' : ''}><summary class="mono" style="cursor:pointer;color:var(--acc)">${x.t} = $${hx(g.ans[k], 8)}</summary><div class="explain" style="margin-top:6px">${x.lines.map(l => `<div>${l}</div>`).join('')}</div></details>`).join('')}</div>`;
    }
  }

  /* ================= LABO ================= */
  const EXAMPLES = {
    'Ex.4 du contrôle S3': `Main	move.l	#$52A59382,d7\npart1	moveq.l	#1,d1\n	cmp.w	#$7000,d7\n	bgt	part2\n	moveq.l	#2,d1\npart2	clr.l	d2\n	move.l	#260,d0\nloop2	addq.l	#1,d2\n	subq.b	#1,d0\n	bne	loop2\npart3	clr.l	d3\n	move.l	#$99999999,d0\nloop3	addq.l	#1,d3\n	dbra	d0,loop3	; DBRA = DBF\npart4	move.l	#$12345678,d4\n	ror.w	#4,d4\n	ror.l	#8,d4\n	swap	d4\n	rol.b	#4,d4\n	ror.l	#8,d4`,
    'Sous-programme GetMin': `Main	moveq.l	#15,d1\n	moveq.l	#25,d2\n	jsr	GetMin		; 15 -> D0\n	moveq.l	#30,d1\n	moveq.l	#16,d2\n	jsr	GetMin		; 16 -> D0\n	bra	Fin\n\nGetMin	cmp.l	d1,d2\n	ble	d2min		; D2 <= D1 (signé)\nd1min	move.l	d1,d0\n	rts\nd2min	move.l	d2,d0\n	rts\n\nFin	nop`,
    'Pile et MOVEM': `	move.l	#$11112222,d0\n	move.l	#$AAAABBBB,d1\n	move.w	#$42,-(a7)\n	move.l	#$53,-(a7)\n	move.w	d0,-(a7)\n	move.l	d1,-(a7)\n	clr.w	d0\n	clr.l	d1\n	move.l	(a7)+,d1\n	move.w	(a7)+,d0\n	move.l	(a7)+,d2\n	move.w	(a7)+,d3\n\n	movem.l	d0-d3/a4,-(a7)	; regarde la pile en mémoire\n	movem.l	(a7)+,d0-d3/a4`,
    'Bonjour avec TRAP #15': `	lea	msg,a1\n	move.b	#14,d0		; tâche 14 : afficher la chaîne\n	trap	#15\n	move.l	#2026,d1\n	move.b	#3,d0		; tâche 3 : afficher D1.L\n	trap	#15\n	rts\n\nmsg	dc.b	'Salut EPITA, promo ',0`,
    'Modes d\'adressage (cours 4.x)': `	move.l	#$0000FFFF,d0\n	moveq.l	#4,d1\n	move.l	#$FFFFF000,d2\n	lea	tab,a0\n	lea	8(a0),a1\n	lea	16(a0),a2\n	move.l	-(a2),-(a2)		; 4.8\n	move.b	5(a1),-1(a1,d0.w)	; 4.9\n	move.w	2(a1,d1.l),-6(a2)	; 4.10\n	rts\n\n	org	$1000\ntab	dc.b	$21,$45,$87,$AF,$B5,$F3,$3C,$32\n	dc.b	$AD,$45,$39,$98,$9A,$9B,$9C,$9D\n	dc.b	$03,$69,$01,$00,$12,$0A,$0D,$C9`,
  };
  let LB = null; // { ed, prog, cpu, memAddr, prev }
  function openInLabo(src) { S.labo = src; save(); LB = null; if (location.hash === '#labo') go(); else location.hash = '#labo'; }
  function pageLabo() {
    const src = S.labo || EXAMPLES['Ex.4 du contrôle S3'];
    app.innerHTML = `
    <div class="stack" style="gap:16px">
      <div class="row" style="justify-content:space-between;align-items:end"><div class="stack" style="gap:6px"><span class="eyebrow">Labo · simulateur 68000</span><h2>Écris, exécute, rembobine</h2></div>
        <select class="field" id="lbex" style="max-width:260px" aria-label="Charger un exemple"><option value="">Charger un exemple…</option>${Object.keys(EXAMPLES).map(k => `<option>${esc(k)}</option>`).join('')}</select></div>
      <div class="labo">
        <div class="stack" style="gap:10px">
          <div class="toolbar">
            <button class="btn pri sm" id="lbrun" type="button">▶ Exécuter <kbd>Ctrl+Entrée</kbd></button>
            <button class="btn sm" id="lbstep" type="button">Pas <kbd>F8</kbd></button>
            <button class="btn sm" id="lbback" type="button">↶ Pas arrière</button>
            <button class="btn sm" id="lbanim" type="button">Animer</button>
            <button class="btn ghost sm" id="lbreset" type="button">Réinitialiser</button>
          </div>
          <div id="lbed"></div>
          <div id="lberr"></div>
          <div class="row" style="justify-content:space-between"><span class="status" id="lbstat">Prêt. Clique dans la marge pour poser un point d'arrêt.</span></div>
          <div><label class="lab">Console (TRAP #15)</label><div class="console" id="lbout"></div></div>
        </div>
        <div class="stack" style="gap:12px">
          <div class="card stack" style="gap:10px">
            <div class="row" style="justify-content:space-between"><span class="eyebrow">Registres</span><span class="mono tiny" id="lbpc"></span></div>
            <div class="regs" id="lbregs" style="grid-template-columns:repeat(2,minmax(0,1fr))"></div>
            <div class="row" style="justify-content:space-between"><div class="leds" id="lbleds"></div><span class="mono tiny" id="lbsr"></span></div>
          </div>
          <div class="card stack" style="gap:10px">
            <div class="row" style="justify-content:space-between"><span class="eyebrow">Mémoire</span><div class="row" style="gap:6px"><input class="field" id="lbaddr" style="width:110px;padding:5px 8px" aria-label="Adresse mémoire"><button class="btn sm ghost" data-go="A0" type="button">A0</button><button class="btn sm ghost" data-go="A7" type="button">Pile</button><button class="btn sm ghost" data-go="data" type="button">Données</button></div></div>
            <div class="memview" id="lbmem"></div>
          </div>
        </div>
      </div>
    </div>`;
    const ed = makeEditor($('#lbed'), src, { id: 'labosrc', onChange: v => { S.labo = v; save(); LB.prog = null; }, onKey: e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } } });
    LB = { ed, prog: null, cpu: new M.CPU(), memAddr: null, prev: null, anim: null };
    const cpu = () => LB.cpu;
    function assemble() {
      $('#lberr').innerHTML = '';
      try { LB.prog = M.assemble(ed.value); LB.cpu.load(LB.prog); LB.cpu.histOn = true; LB.cpu.histStack = []; LB.prev = null; if (LB.memAddr === null) LB.memAddr = LB.prog.data.length ? LB.prog.data[0].addr & ~15 : 0x1000; return true; }
      catch (e) { showErr(e); return false; }
    }
    function showErr(e) { $('#lberr').innerHTML = `<div class="errbar">${e.line ? 'Ligne ' + e.line + ' · ' : ''}${esc(e.message)}</div>`; ed.mark({ err: e.line }); sfx('ko'); stopAnim(); }
    function ensure() { if (!LB.prog) return assemble(); return true; }
    function run() {
      stopAnim(); if (!LB.prog || LB.cpu.halted) { if (!assemble()) return; }
      const c = cpu(); LB.prev = { D: c.D.slice(), A: c.A.slice() }; c.histOn = false; let n = 0;
      try {
        while (!c.halted) {
          c.step(); n++;
          const ins = LB.prog.byAddr.get(c.pc); if (ins && ed.bps.has(ins.no)) { c.histOn = true; $('#lbstat').textContent = `Point d'arrêt ligne ${ins.no}.`; break; }
          if (n > 3000000) throw new M.RunError('Arrêt après 3 000 000 instructions : boucle infinie ?', c.cur && c.cur.no);
        }
      } catch (e) { showErr(e); }
      c.histOn = true;
      if (!S.ran) { S.ran = true; save(); } grant('lab');
      draw();
    }
    function step() { stopAnim(); doStep(); }
    function doStep() {
      if (!ensure()) return false;
      const c = cpu(); if (c.halted) { draw(); return false; }
      LB.prev = { D: c.D.slice(), A: c.A.slice() };
      try { c.step(); } catch (e) { showErr(e); return false; }
      draw(); return !c.halted;
    }
    function back() { stopAnim(); const c = cpu(); LB.prev = { D: c.D.slice(), A: c.A.slice() }; if (!c.back()) { $('#lbstat').textContent = 'Rien à rembobiner.'; return; } draw(); }
    function stopAnim() { if (LB.anim) { clearInterval(LB.anim); LB.anim = null; $('#lbanim').textContent = 'Animer'; } }
    function anim() { if (LB.anim) return stopAnim(); if (!ensure()) return; $('#lbanim').textContent = 'Pause'; LB.anim = setInterval(() => { const c = cpu(); if (!doStep()) stopAnim(); else { const ins = LB.prog.byAddr.get(c.pc); if (ins && ed.bps.has(ins.no)) stopAnim(); } }, 380); }
    function draw() {
      const c = cpu(), p = LB.prev || { D: c.D, A: c.A };
      const nextIns = LB.prog && LB.prog.byAddr.get(c.pc);
      ed.mark({ cur: c.halted ? null : nextIns && nextIns.no });
      $('#lbregs').innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<div class="reg ${p.D[i] !== c.D[i] ? 'flash' : ''}" title="D${i} = ${c.D[i] | 0} (signé)"><b>D${i}</b><span>$${hx(c.D[i], 8)}</span></div><div class="reg ${p.A[i] !== c.A[i] ? 'flash' : ''}"><b>${i === 7 ? 'A7/SP' : 'A' + i}</b><span>$${hx(c.A[i], 8)}</span></div>`).join('');
      $('#lbleds').innerHTML = ['X', 'N', 'Z', 'V', 'C'].map(f => `<span class="led ${c[f] ? 'on' : ''}"><i></i>${f}</span>`).join('');
      $('#lbsr').textContent = 'SR = $' + hx(c.sr, 4); $('#lbpc').textContent = 'PC = $' + hx(c.pc, 8);
      $('#lbout').textContent = c.out || '';
      $('#lbstat').textContent = c.halted ? `Terminé en ${c.steps} instructions. ${c.haltMsg}` : LB.prog ? `${c.steps} instruction(s) exécutée(s). Prochaine : ligne ${nextIns ? nextIns.no : '?'}.` : 'Prêt.';
      drawMem();
    }
    function drawMem() {
      const c = cpu(); const base = (LB.memAddr ?? 0x1000) & 0xFFFFF0; $('#lbaddr').value = '$' + hx(base, 6);
      let out = '';
      for (let r = 0; r < 12; r++) {
        const a = base + r * 8; let line = `<span class="a">${hx(a, 6)}</span>  `; let asc = '';
        for (let k = 0; k < 8; k++) { const ad = (a + k) & 0xFFFFFF, b = c.mem[ad]; const isSp = ad === (c.A[7] & 0xFFFFFF); line += `<span class="${c.writes.has(ad) ? 'ch' : isSp ? 'sp' : ''}">${hx(b, 2)}</span> `; asc += b >= 32 && b < 127 ? esc(String.fromCharCode(b)) : '·'; }
        out += line + ' ' + asc + '\n';
      }
      $('#lbmem').innerHTML = out;
    }
    $('#lbaddr').addEventListener('change', e => { const v = parseHex(e.target.value); if (v !== null) { LB.memAddr = v; drawMem(); } });
    $$('[data-go]').forEach(b => b.onclick = () => { const c = cpu(); const k = b.dataset.go; LB.memAddr = k === 'A0' ? c.A[0] : k === 'A7' ? Math.max(0, c.A[7] - 48) : (LB.prog && LB.prog.data.length ? LB.prog.data[0].addr : 0x1000); drawMem(); });
    $('#lbex').onchange = e => { if (!e.target.value) return; ed.value = EXAMPLES[e.target.value]; S.labo = ed.value; save(); LB.prog = null; LB.memAddr = null; assemble(); draw(); e.target.value = ''; };
    $('#lbrun').onclick = run; $('#lbstep').onclick = step; $('#lbback').onclick = back; $('#lbanim').onclick = anim;
    $('#lbreset').onclick = () => { stopAnim(); assemble(); draw(); };
    keyHandler = e => { if (e.key === 'F8') { e.preventDefault(); step(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !typing(e)) { e.preventDefault(); run(); } };
    assemble(); draw();
    cleanup = () => stopAnim();
  }

  /* ================= MOULINETTE ================= */
  let MC = G.CH[0].id;
  function pageMoul() {
    const ch = G.CH.find(c => c.id === MC);
    app.innerHTML = `
    <div class="stack" style="gap:16px">
      <div class="stack" style="gap:6px"><span class="eyebrow">Moulinette · ${Object.keys(S.solved).length} / ${G.CH.length} défis validés</span><h2>Écris le sous-programme, la moulinette le teste</h2><p class="lead">La moulinette appelle ton étiquette avec <code>JSR</code>, remplit les autres registres de valeurs aléatoires, puis vérifie la sortie, la mémoire, l'équilibre de la pile et que tu n'as rien écrasé.</p></div>
      <div class="moul">
        <div class="chlist" role="list">${G.CH.map(c => `<button type="button" role="listitem" class="chi ${c.id === MC ? 'on' : ''}" data-id="${c.id}"><span class="stack" style="gap:3px"><span class="nm">${esc(c.name)}</span><span class="dots">${[1, 2, 3].map(i => `<i class="${i <= c.lvl ? 'f' : ''}"></i>`).join('')}</span></span>${S.solved[c.id] ? '<span class="done">✓ 100 %</span>' : ''}</button>`).join('')}</div>
        <div class="stack" style="gap:12px">
          <div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(ch.name)}</h3><span class="pill">étiquette <b style="color:var(--t-lab);font-weight:500">${ch.entry}</b></span></div><p>${esc(ch.txt)}</p></div>
          <div id="mced" style="--edh:340px"></div>
          <div class="row"><button class="btn pri" id="mcgo" type="button">Lancer la moulinette <kbd>Ctrl+Entrée</kbd></button><button class="btn" id="mclab" type="button">Déboguer au Labo</button><button class="btn ghost" id="mcrst" type="button">Repartir du modèle</button></div>
          <div class="term" id="mcterm"><div class="l dm">$ moulinette --defi ${ch.id}\nEn attente de ton code…</div></div>
        </div>
      </div>
    </div>`;
    const ed = makeEditor($('#mced'), S.code[ch.id] || ch.tpl, { id: 'moulsrc', onChange: v => { S.code[ch.id] = v; save(); }, onKey: e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runIt(); } } });
    $$('.chi').forEach(b => b.onclick = () => { MC = b.dataset.id; pageMoul(); });
    $('#mcrst').onclick = () => { ed.value = ch.tpl; S.code[ch.id] = ch.tpl; save(); };
    $('#mclab').onclick = () => {
      const t = ch.tests()[0];
      const pre = ['; Harnais de test de la moulinette (1er test)'];
      Object.entries(t.D || {}).forEach(([i, v]) => pre.push(`\tmove.l\t#$${hx(v, 8)},d${i}`));
      Object.entries(t.A || {}).forEach(([i, v]) => pre.push(`\tmovea.l\t#$${hx(v, 8)},a${i}`));
      pre.push(`\tjsr\t${ch.entry}`, '\tsimhalt', '');
      const data = (t.mem || []).map(([a, b]) => `\torg\t$${hx(a, 4)}\n\tdc.b\t${b.map(x => '$' + hx(x, 2)).join(',')}`).join('\n');
      openInLabo(pre.join('\n') + '\n' + ed.value + '\n\n' + data);
    };
    let timers = [];
    function runIt() {
      timers.forEach(clearTimeout); timers = [];
      const r = G.runChallenge(ch, ed.value);
      const term = $('#mcterm'); term.innerHTML = '';
      const line = (cls, txt, d) => timers.push(setTimeout(() => { const l = document.createElement('div'); l.className = 'l ' + cls; l.textContent = txt; term.appendChild(l); term.scrollTop = term.scrollHeight; }, d));
      line('dm', `$ moulinette --defi ${ch.id}`, 0);
      if (r.fatal) { line('kok', '[FATAL] ' + r.fatal, 120); ed.mark({ err: r.line }); sfx('ko'); return; }
      line('hd', `${r.total} tests · registres non utilisés remplis au hasard`, 120);
      r.report.forEach((t, i) => line(t.ok ? 'okk' : 'kok', `${t.ok ? '[ OK ]' : '[ KO ]'} ${t.name}${t.ok ? `  (${t.steps} instr.)` : '\n        ' + t.msg}`, 260 + i * 170));
      const pct = Math.round(r.passed / r.total * 100);
      timers.push(setTimeout(() => {
        line(pct === 100 ? 'okk' : 'kok', `\nRésultat : ${r.passed}/${r.total} · ${pct} %`, 0);
        if (pct === 100) {
          const first = !S.solved[ch.id]; S.solved[ch.id] = true; touchDay();
          if (first) { S.xp += 40 * ch.lvl; popAt($('#mcgo'), `+${40 * ch.lvl} XP`); confetti(120); sfx('lvl'); }
          else sfx('ok');
          save(); hud(); checkBadges();
          const b = $(`.chi[data-id="${ch.id}"]`); if (b && !$('.done', b)) b.insertAdjacentHTML('beforeend', '<span class="done">✓ 100 %</span>');
        } else { sfx('ko'); shake($('#mcterm')); }
      }, 300 + r.report.length * 170));
    }
    $('#mcgo').onclick = runIt;
    cleanup = () => timers.forEach(clearTimeout);
  }

  /* ================= EXAMEN BLANC ================= */
  let EX = null;
  function pageExam() {
    if (!EX) return examIntro();
    if (EX.graded) return examResult();
    examRun();
  }
  function examIntro() {
    app.innerHTML = `
    <div class="stack" style="gap:18px;max-width:880px">
      <div class="stack" style="gap:8px"><span class="eyebrow">Examen blanc · conditions réelles</span><h2>1 heure, 4 exercices, noté sur 20</h2><p class="lead">Un sujet complet généré au format du contrôle S3. Pas de correction pendant l'épreuve. À la fin, ta note, le détail par exercice et la correction pas à pas.</p></div>
      <div class="card"><div class="tblwrap"><table class="t"><thead><tr><th>Exercice</th><th>Contenu</th><th>Barème</th></tr></thead><tbody>
        <tr><td>1</td><td>4 instructions MOVE : mémoire + registres</td><td>6 pts (1,5 par ligne)</td></tr>
        <tr><td>2</td><td>4 additions : résultat + N Z V C</td><td>4 pts (0,5 résultat + 0,5 flags)</td></tr>
        <tr><td>3</td><td>4 questions de cours</td><td>4 pts</td></tr>
        <tr><td>4</td><td>Programme à tracer : D1, D2, D3, D4</td><td>6 pts (1,5 par registre)</td></tr></tbody></table></div>
        <p class="tiny" style="margin-top:10px">Barème estimé à partir du sujet (points par exercice). Ne détaille pas tes calculs, comme au vrai contrôle.</p></div>
      <div class="row"><button class="btn pri" id="exgo" type="button">Commencer l'examen</button><label class="check"><input type="checkbox" id="exshort"> Version courte (20 min)</label></div>
      ${S.exams.length ? `<div class="card"><span class="eyebrow">Historique</span><div class="tblwrap"><table class="t" style="margin-top:8px"><thead><tr><th>Date</th><th>Note</th><th>Ex.1</th><th>Ex.2</th><th>Ex.3</th><th>Ex.4</th></tr></thead><tbody>${S.exams.slice(-8).reverse().map(e => `<tr><td>${esc(e.date)}</td><td class="mono"><b>${String(e.score).replace('.', ',')}</b></td>${e.parts.map(p => `<td class="mono">${String(p).replace('.', ',')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}
    </div>`;
    $('#exgo').onclick = () => { EX = G.genExam(); EX.end = Date.now() + ($('#exshort').checked ? 20 : 60) * 60000; EX.ans = {}; examRun(); };
  }
  function examRun() {
    const { st, e1, e2, e3, e4 } = EX;
    app.innerHTML = `
    <div class="timer"><span class="clock" id="exclock">60:00</span><span class="sub">Les réponses sont gardées si tu changes de page.</span><button class="btn pri" id="exsub" type="button">Rendre la copie</button></div>
    <div class="stack" style="gap:28px">
      <section class="exsec"><div class="hdr"><h3>Exercice 1 <span class="tiny">(6 points)</span></h3><span class="sub">Nouveau contenu de la mémoire et des registres modifiés. Mémoire et registres réinitialisés à chaque instruction.</span></div>
        ${initPanel(st)}
        ${e1.map((g, i) => `<div class="erow"><div class="instr" style="font-size:16px">${hl('\t' + g.ins).replace(/^\t/, '')}</div>
          <div class="memin">${[0, 8, 16].map((o, j) => `<span class="ad">$${hx(st.base + o, 6)}</span><input class="field" data-x="m${i}_${j}" value="${st.mem.slice(o, o + 8).map(b => hx(b, 2)).join(' ')}" autocomplete="off" spellcheck="false" aria-label="Instruction ${i + 1}, ligne $${hx(st.base + o, 6)}">`).join('')}</div>
          <div><label class="lab">Registres modifiés</label><input class="field" data-x="r${i}" placeholder="A1 = $00005004 ou « aucun »" autocomplete="off" spellcheck="false"></div></div>`).join('')}
      </section>
      <section class="exsec"><div class="hdr"><h3>Exercice 2 <span class="tiny">(4 points)</span></h3><span class="sub">Résultat des additions et flags N Z V C.</span></div>
        ${e2.map((q, i) => `<div class="erow e2r"><div class="mono" style="font-size:18px">${q.text} <span class="tiny">(${q.s * 8} bits)</span></div><input class="field" data-x="a${i}" placeholder="$..." autocomplete="off" spellcheck="false"><div class="mini-fl">${['N', 'Z', 'V', 'C'].map(f => `<button type="button" data-fl="${i}${f}" aria-label="Flag ${f}">${f}</button>`).join('')}</div></div>`).join('')}
        <p class="tiny">Un flag allumé (bleu) = 1, éteint = 0.</p>
      </section>
      <section class="exsec"><div class="hdr"><h3>Exercice 3 <span class="tiny">(4 points)</span></h3></div>
        ${e3.map((q, i) => `<div class="erow e3r"><span>${esc(q.q)}</span><input class="field" data-x="q${i}" autocomplete="off" spellcheck="false"></div>`).join('')}
      </section>
      <section class="exsec"><div class="hdr"><h3>Exercice 4 <span class="tiny">(6 points)</span></h3><span class="sub">Valeurs des registres après exécution, hexadécimal 32 bits.</span></div>
        <div class="grid2">${listing(e4.prog)}<div class="card ansgrid" style="grid-template-columns:repeat(2,minmax(0,1fr));align-content:start">${[1, 2, 3, 4].map(i => `<div><label class="lab">D${i} = $</label><input class="field" data-x="d${i}" autocomplete="off" spellcheck="false"></div>`).join('')}</div></div>
      </section>
      <div class="row"><button class="btn pri" id="exsub2" type="button">Rendre la copie</button><button class="btn ghost" id="exquit" type="button">Abandonner</button></div>
    </div>`;
    // restaurer / mémoriser
    $$('[data-x]').forEach(inp => { if (EX.ans[inp.dataset.x] !== undefined) inp.value = EX.ans[inp.dataset.x]; inp.addEventListener('input', () => EX.ans[inp.dataset.x] = inp.value); });
    $$('[data-fl]').forEach(b => { if (EX.ans['f' + b.dataset.fl]) b.classList.add('on'); b.onclick = () => { const k = 'f' + b.dataset.fl; EX.ans[k] = !EX.ans[k]; b.classList.toggle('on', EX.ans[k]); }; });
    const submit = () => { gradeExam(); examResult(); };
    $('#exsub').onclick = submit; $('#exsub2').onclick = submit;
    let armed = false;
    $('#exquit').onclick = e => { if (!armed) { armed = true; e.target.textContent = 'Confirmer l\'abandon'; return; } EX = null; examIntro(); };
    const tickc = () => { const ms = EX.end - Date.now(); if (ms <= 0) { toast('<b>Temps écoulé.</b> Copie ramassée.'); submit(); return; } const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; const c = $('#exclock'); if (!c) return; c.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; c.classList.toggle('warn', ms < 5 * 60000); };
    tickc(); const iv = setInterval(tickc, 1000); cleanup = () => clearInterval(iv);
  }
  function parseRegs(t) {
    t = (t || '').trim(); const out = {};
    if (!t || /^aucun/i.test(t) || /^rien/i.test(t) || t === '-') return out;
    const re = /\b([DA][0-7])\s*[=:]\s*\$?([0-9A-Fa-f]{1,8})\b/g; let m; while ((m = re.exec(t))) out[m[1].toUpperCase()] = parseInt(m[2], 16) >>> 0;
    return out;
  }
  function gradeExam() {
    const { st, e1, e2, e3, e4, ans } = EX; const det = { e1: [], e2: [], e3: [], e4: [] };
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    e1.forEach((g, i) => {
      const r = g.res;
      const memOk = [0, 1, 2].every(j => { const v = ans[`m${i}_${j}`]; const b = parseBytes(v !== undefined ? v : st.mem.slice(j * 8, j * 8 + 8).map(x => hx(x, 2)).join(' ')); return b && b.every((x, k) => x === r.mem[j * 8 + k]); });
      const given = parseRegs(ans['r' + i]); const exp = {}; r.regChanged.forEach(n => exp[n] = n[0] === 'D' ? r.D[+n[1]] : r.A[+n[1]]);
      const claimed = Object.keys(given).filter(k => given[k] !== (k[0] === 'D' ? st.D[+k[1]] : st.A[+k[1]]));
      const regOk = Object.entries(exp).every(([k, v]) => given[k] === v) && claimed.every(k => exp[k] !== undefined);
      const hasMem = r.memChanged.some(Boolean), hasReg = r.regChanged.length > 0;
      const pts = memOk && regOk ? 1.5 : ((memOk && hasMem) || (regOk && hasReg)) && hasMem && hasReg ? 0.75 : 0; p1 += pts; det.e1.push({ memOk, regOk, pts });
    });
    e2.forEach((q, i) => { const v = parseHex(ans['a' + i] || ''); const rok = v === q.r; const fok = ['N', 'Z', 'V', 'C'].every(f => (ans['f' + i + f] ? 1 : 0) === q[f]); const pts = (rok ? .5 : 0) + (fok ? .5 : 0); p2 += pts; det.e2.push({ rok, fok, pts }); });
    e3.forEach((q, i) => { const ok = G.check3(q, ans['q' + i] || ''); if (ok) p3++; det.e3.push({ ok }); });
    [1, 2, 3, 4].forEach((n, k) => { const ok = parseHex(ans['d' + n] || '') === e4.ans[k]; if (ok) p4 += 1.5; det.e4.push({ ok }); });
    const score = Math.round((p1 + p2 + p3 + p4) * 4) / 4;
    EX.graded = { score, parts: [p1, p2, p3, p4], det };
    const d = new Date(); S.exams.push({ date: d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), score, parts: [p1, p2, p3, p4] });
    S.xp += Math.round(score * 5); touchDay();
    // statistiques d'entraînement
    det.e1.forEach(x => award('ex1', x.pts === 1.5, 0, null, true)); det.e2.forEach(x => award('ex2', x.pts === 1, 0, null, true)); det.e3.forEach(x => award('ex3', x.ok, 0, null, true)); det.e4.forEach(x => award('ex4', x.ok, 0, null, true)); checkBadges();
    if (score >= 16) grant('e16'); if (score >= 20) grant('e20');
    save(); hud();
  }
  function examResult() {
    const { st, e1, e2, e3, e4, graded } = EX; const { score, parts, det } = graded;
    const C = 2 * Math.PI * 70, frac = score / 20;
    const mention = score >= 18 ? 'Excellent. Tu es prêt.' : score >= 16 ? 'Très bien. Peaufine les détails.' : score >= 12 ? 'Correct. Retravaille les exercices en rouge.' : score >= 8 ? 'Fragile. Reprends la méthode exercice par exercice.' : 'On reprend les bases : commence par la Méthode 20/20.';
    app.innerHTML = `
    <div class="stack" style="gap:22px">
      <div class="card row" style="gap:26px;align-items:center">
        <svg class="score-ring" viewBox="0 0 170 170" role="img" aria-label="Note ${score} sur 20"><circle cx="85" cy="85" r="70" fill="none" stroke="var(--line2)" stroke-width="12"/><circle id="ring" cx="85" cy="85" r="70" fill="none" stroke="var(--acc)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 85 85)" style="transition:stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)"/><text x="85" y="92" text-anchor="middle" fill="var(--fg)" font-family="Chakra Petch, sans-serif" font-size="38" font-weight="700" id="sc">0</text><text x="85" y="116" text-anchor="middle" fill="var(--muted)" font-size="13" font-family="JetBrains Mono, monospace">/ 20</text></svg>
        <div class="stack" style="gap:10px;flex:1;min-width:220px"><span class="eyebrow">Résultat de l'examen blanc</span><h2>${mention}</h2>
          <div class="grid4">${['Ex.1', 'Ex.2', 'Ex.3', 'Ex.4'].map((n, i) => `<div><div class="tiny">${n}</div><div class="mono" style="font-size:20px">${String(parts[i]).replace('.', ',')}<span class="tiny"> / ${[6, 4, 4, 6][i]}</span></div><div class="meter" style="margin-top:4px"><i style="width:${parts[i] / [6, 4, 4, 6][i] * 100}%"></i></div></div>`).join('')}</div>
          <div class="row"><button class="btn pri" id="exagain" type="button">Nouvel examen</button><a class="btn" href="#guide">Revoir la méthode</a></div></div>
      </div>
      <section class="exsec"><div class="hdr"><h3>Correction · Exercice 1</h3></div>
        ${e1.map((g, i) => `<div class="card stack" style="gap:10px"><div class="row" style="justify-content:space-between"><div class="instr" style="font-size:15px;padding:8px 12px">${esc(g.ins)}</div><span class="pill ${det.e1[i].pts === 1.5 ? 'ok' : 'ko'}">${String(det.e1[i].pts).replace('.', ',')} / 1,5</span></div>${chainHTML(G.explain1(st, g.ins))}<div class="memtbl">${memRows(st, g.res.mem, k => g.res.memChanged[k] ? 'ch' : '')}</div><div class="sub">Registres : ${regsChangedTxt(g.res)} ${det.e1[i].memOk ? '' : '· <span style="color:var(--ko)">mémoire fausse</span>'} ${det.e1[i].regOk ? '' : '· <span style="color:var(--ko)">registres faux</span>'}</div></div>`).join('')}
      </section>
      <section class="exsec"><div class="hdr"><h3>Correction · Exercice 2</h3></div>
        ${e2.map((q, i) => `<div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="mono" style="font-size:17px">${q.text} = $${hx(q.r, q.s * 2)} · N=${q.N} Z=${q.Z} V=${q.V} C=${q.C}</span><span class="pill ${det.e2[i].pts === 1 ? 'ok' : 'ko'}">${String(det.e2[i].pts).replace('.', ',')} / 1</span></div><div class="explain">${G.explain2(q).map(l => `<div>${l}</div>`).join('')}</div></div>`).join('')}
      </section>
      <section class="exsec"><div class="hdr"><h3>Correction · Exercice 3</h3></div>
        ${e3.map((q, i) => `<div class="card stack" style="gap:6px"><div class="row" style="justify-content:space-between"><span>${esc(q.q)}</span><span class="pill ${det.e3[i].ok ? 'ok' : 'ko'}">${det.e3[i].ok ? '1' : '0'} / 1</span></div><span class="mono" style="color:var(--acc)">${esc(q.show)}</span><span class="sub">${esc(q.why)}</span></div>`).join('')}
      </section>
      <section class="exsec"><div class="hdr"><h3>Correction · Exercice 4</h3><button class="btn sm ghost" id="exlab" type="button">Tracer au Labo</button></div>
        <div class="grid2">${listing(e4.prog)}<div class="stack">${e4.ex.map((x, k) => `<div class="card stack" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="mono" style="color:var(--acc)">${x.t} = $${hx(e4.ans[k], 8)}</span><span class="pill ${det.e4[k].ok ? 'ok' : 'ko'}">${det.e4[k].ok ? '1,5' : '0'} / 1,5</span></div><div class="explain">${x.lines.map(l => `<div>${l}</div>`).join('')}</div></div>`).join('')}</div></div>
      </section>
    </div>`;
    $('#exagain').onclick = () => { EX = null; examIntro(); };
    $('#exlab').onclick = () => openInLabo(e4.prog);
    requestAnimationFrame(() => { $('#ring').style.strokeDashoffset = C * (1 - frac); });
    let k = 0; const steps = 30; const iv = setInterval(() => { k++; const v = Math.round(score * k / steps * 4) / 4; const el = $('#sc'); if (el) el.textContent = String(v).replace('.', ','); if (k >= steps) { clearInterval(iv); if (score >= 14) confetti(score >= 18 ? 220 : 120); } }, 40);
    cleanup = () => clearInterval(iv);
  }

  /* ================= démarrage ================= */
  function setAcc(a) { S.acc = a; document.documentElement.dataset.acc = a === 'blue' ? '' : a; if (a === 'blue') delete document.documentElement.dataset.acc; save(); hud(); }
  $$('.sw').forEach(b => b.onclick = () => setAcc(b.dataset.acc));
  $('#sndbtn').onclick = () => { S.snd = !S.snd; save(); hud(); if (S.snd) sfx('ok'); };
  setAcc(S.acc || 'blue');
  const setHH = () => document.documentElement.style.setProperty('--hh', $('.top').offsetHeight + 'px');
  addEventListener('resize', setHH); setHH();
  hud(); go();
})();
