/* DRIFT — DriftHead2Head.com */
(() => {
  "use strict";

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------------------------------------------------------------
     Hero video: respect reduced motion, offer a pause control
     --------------------------------------------------------------- */
  const heroVideo = document.querySelector(".hero__video");
  const heroToggle = document.querySelector(".hero__toggle");
  function setHeroPlaying(play) {
    if (!heroVideo) return;
    if (play) heroVideo.play().catch(() => {});
    else heroVideo.pause();
    if (heroToggle) {
      heroToggle.setAttribute("aria-pressed", String(!play));
      heroToggle.setAttribute("aria-label", play ? "Pause background video" : "Play background video");
    }
  }
  if (heroVideo) {
    if (reduceMotion.matches) { heroVideo.removeAttribute("autoplay"); setHeroPlaying(false); }
    heroToggle?.addEventListener("click", () => setHeroPlaying(heroVideo.paused));
  }

  /* Videos that should only run while on screen */
  const inviewVideos = document.querySelectorAll("video.js-inview");
  if (inviewVideos.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !reduceMotion.matches) e.target.play().catch(() => {});
        else e.target.pause();
      }
    }, { threshold: 0.25 });
    inviewVideos.forEach((v) => io.observe(v));
  }

  /* ---------------------------------------------------------------
     Trailer dialog (YouTube, privacy-enhanced; loaded only on open)
     --------------------------------------------------------------- */
  const dialog = document.getElementById("trailer");
  const frame = dialog?.querySelector(".player__frame");
  function openTrailer() {
    if (!dialog || !frame) return;
    const id = frame.dataset.youtube;
    frame.innerHTML =
      `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" ` +
      `title="DRIFT trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    if (heroVideo && !heroVideo.paused) heroVideo.dataset.resume = "1", heroVideo.pause();
    dialog.showModal();
  }
  document.querySelectorAll("[data-trailer]").forEach((b) => b.addEventListener("click", openTrailer));
  dialog?.addEventListener("close", () => {
    frame.innerHTML = "";
    if (heroVideo?.dataset.resume) { delete heroVideo.dataset.resume; heroVideo.play().catch(() => {}); }
  });
  dialog?.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  /* ---------------------------------------------------------------
     Signup form (Netlify Forms compatible: POST urlencoded to "/")
     --------------------------------------------------------------- */
  const form = document.querySelector(".signup__form");
  if (form) {
    const status = form.querySelector(".signup__status");
    const email = form.querySelector('input[type="email"]');
    const submit = form.querySelector('button[type="submit"]');
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!email.checkValidity()) {
        status.dataset.state = "error";
        status.textContent = "Enter an email address like name@example.com.";
        email.focus();
        return;
      }
      submit.disabled = true;
      status.dataset.state = "";
      status.textContent = "Saving…";
      try {
        const res = await fetch(form.getAttribute("action") || "/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!res.ok) throw new Error(String(res.status));
        status.dataset.state = "ok";
        status.textContent = "You're on the list. We'll email you when DRIFT launches.";
        form.reset();
      } catch {
        status.dataset.state = "error";
        status.textContent = "We couldn't save your email. Check your connection and try again.";
      } finally {
        submit.disabled = false;
      }
    });
  }

  /* ---------------------------------------------------------------
     The race: a three-lane DRIFT board, two cars, scrubbed by scroll
     --------------------------------------------------------------- */
  const race = document.getElementById("race");
  const svg = document.getElementById("race-svg");
  if (!race || !svg) return;

  const TRACKS = {
    wide: {
      w: 1600, h: 900,
      d: "M 300 700 C 150 700 110 580 170 480 C 230 380 190 270 290 200 C 390 130 560 150 640 230 C 720 310 810 330 900 265 C 1000 195 1120 130 1260 165 C 1420 205 1480 360 1405 470 C 1345 560 1210 560 1130 615 C 1050 670 1050 760 940 785 C 820 810 700 735 560 740 C 430 745 410 700 300 700 Z",
    },
    tall: {
      w: 900, h: 1600,
      d: "M 450 1440 C 260 1440 170 1330 195 1180 C 220 1040 150 950 170 800 C 190 640 130 520 200 385 C 270 240 430 180 570 225 C 725 275 760 420 690 540 C 625 650 650 740 735 830 C 830 930 815 1090 715 1170 C 640 1230 690 1340 625 1400 C 580 1440 520 1440 450 1440 Z",
    },
  };
  const LANE = 44;
  const STEP = 3;
  const LANES = [
    { key: "blue", color: "#2f9bff", off: LANE },
    { key: "yellow", color: "#f5ce34", off: 0 },
    { key: "pink", color: "#f2468f", off: -LANE },
  ];
  const CARS = [
    { num: "07", color: "#2a5bff", lane: 0, sign: 1 },
    { num: "02", color: "#e3262e", lane: 2, sign: -1 },
  ];

  const board = document.getElementById("race-board");
  const smokeLayer = document.getElementById("smoke");
  const carLayer = document.getElementById("cars");
  const leader = document.getElementById("race-leader");
  const meter = document.getElementById("race-meter");
  const captions = race.querySelectorAll(".race__captions li");

  let geo = null;      // sampled geometry for the current track
  let mode = null;
  let boardURL = null;

  function sampleTrack(d) {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.style.visibility = "hidden";
    svg.appendChild(p);
    const L = p.getTotalLength();
    const n = Math.floor(L / STEP);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const s = (i / n) * L;
      const a = p.getPointAtLength(s);
      pts.push({ x: a.x, y: a.y });
    }
    p.remove();

    // tangents, normals, outward direction
    let cx = 0, cy = 0;
    pts.forEach((q) => { cx += q.x; cy += q.y; });
    cx /= n; cy /= n;
    let vote = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      let tx = b.x - a.x, ty = b.y - a.y;
      const m = Math.hypot(tx, ty) || 1;
      tx /= m; ty /= m;
      const q = pts[i];
      q.tx = tx; q.ty = ty; q.nx = -ty; q.ny = tx;
      q.ang = Math.atan2(ty, tx);
      const out = Math.hypot(q.x + q.nx * 10 - cx, q.y + q.ny * 10 - cy);
      const inn = Math.hypot(q.x - q.nx * 10 - cx, q.y - q.ny * 10 - cy);
      vote += out > inn ? 1 : -1;
    }
    const o = vote >= 0 ? 1 : -1; // multiply normal by o to point outward
    pts.forEach((q) => { q.nx *= o; q.ny *= o; });
    return { L, n, pts, step: L / n };
  }

  const off = (q, k) => [q.x + q.nx * k, q.y + q.ny * k];
  const fmt = (v) => Math.round(v * 10) / 10;

  function polyline(g, k) {
    let s = "";
    for (let i = 0; i < g.n; i++) {
      const [x, y] = off(g.pts[i], k);
      s += (i ? "L" : "M") + fmt(x) + " " + fmt(y);
    }
    return s + "Z";
  }

  function cumulative(g, k) {
    const cum = new Float32Array(g.n + 1);
    let prev = off(g.pts[0], k);
    for (let i = 1; i <= g.n; i++) {
      const cur = off(g.pts[i % g.n], k);
      cum[i] = cum[i - 1] + Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      prev = cur;
    }
    return cum;
  }

  function boardSVG(g, w, h) {
    const half = LANE / 2 - 3;
    const space = LANE * 0.95;
    const perSpace = Math.max(1, Math.round(space / g.step));
    let body = "";

    // dark band under the lanes so the board reads against the asphalt
    body += `<path d="${polyline(g, 0)}" fill="none" stroke="#0b0f14" stroke-opacity=".75" stroke-width="${LANE * 3 + 22}" stroke-linejoin="round"/>`;

    LANES.forEach((lane, li) => {
      let marks = "";
      let dots = "";
      for (let i = 0, k = 0; i < g.n; i += perSpace, k++) {
        const q = g.pts[i];
        const [x1, y1] = off(q, lane.off - half);
        const [x2, y2] = off(q, lane.off + half);
        marks += `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`;
        if ((k + li) % 3 === 0) {
          const mid = g.pts[(i + Math.floor(perSpace / 2)) % g.n];
          const [dx, dy] = off(mid, lane.off);
          dots += `<circle cx="${fmt(dx)}" cy="${fmt(dy)}" r="${LANE * 0.2}"/>`;
        }
      }
      body += `<g stroke="${lane.color}" fill="none" stroke-width="3.2" stroke-linecap="round">` +
        `<path d="${polyline(g, lane.off - half)}"/>` +
        `<path d="${polyline(g, lane.off + half)}"/>` +
        `<path d="${marks}" stroke-width="2.6"/></g>` +
        `<g fill="${lane.color}" fill-opacity=".9">${dots}</g>`;
    });

    // checkered start / finish across all three lanes
    const q0 = g.pts[0];
    const rows = 8, cell = (LANE * 3) / rows;
    let checks = "";
    for (let c = 0; c < 2; c++) {
      for (let r = 0; r < rows; r++) {
        if ((r + c) % 2) continue;
        checks += `<rect x="${fmt(-cell * (c + 1) + cell)}" y="${fmt(-LANE * 1.5 + r * cell)}" width="${fmt(cell)}" height="${fmt(cell)}"/>`;
      }
    }
    const deg = (q0.ang * 180) / Math.PI;
    body += `<g transform="translate(${fmt(q0.x)} ${fmt(q0.y)}) rotate(${fmt(deg)})" fill="#ebe7de">` +
      `<rect x="${fmt(-cell)}" y="${-LANE * 1.5}" width="${fmt(cell * 2)}" height="${LANE * 3}" fill="#06080b"/>${checks}</g>`;

    return `<svg xmlns="${SVGNS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
      `<defs><filter id="chalk" x="-2%" y="-2%" width="104%" height="104%">` +
      `<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="t"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="t" scale="4" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      `<feGaussianBlur in="d" stdDeviation="4" result="g"/>` +
      `<feComponentTransfer in="g" result="glow"><feFuncA type="linear" slope=".7"/></feComponentTransfer>` +
      `<feMerge><feMergeNode in="glow"/><feMergeNode in="d"/></feMerge></filter></defs>` +
      `<g filter="url(#chalk)">${body}</g></svg>`;
  }

  function carMarkup(car) {
    const c = car.color;
    return `<g class="tok" data-num="${car.num}">` +
      `<path d="M21 -8 L130 -44 L130 44 L21 8Z" fill="url(#beam)"/>` +
      `<ellipse cx="-26" cy="0" rx="16" ry="18" fill="url(#tail)"/>` +
      `<rect x="-27" y="-13" width="5" height="26" rx="1.5" fill="#0c0e11" stroke="${c}" stroke-width="1.4"/>` +
      `<rect x="-22" y="-11" width="44" height="22" rx="6" fill="#1d2127" stroke="${c}" stroke-width="1.6"/>` +
      `<rect x="-22" y="-11" width="44" height="5" rx="2" fill="${c}" opacity=".85"/>` +
      `<path d="M4 -9 L12 -8 L12 8 L4 9Z" fill="#6b7d90"/>` +
      `<rect x="-14" y="-8" width="4" height="16" rx="1" fill="#3a4654"/>` +
      `<rect x="19.5" y="-9.5" width="2.5" height="5" fill="#fff8dc"/><rect x="19.5" y="4.5" width="2.5" height="5" fill="#fff8dc"/>` +
      `<rect x="-22.5" y="-9.5" width="2" height="4.5" fill="#ff3030"/><rect x="-22.5" y="5" width="2" height="4.5" fill="#ff3030"/>` +
      `<text x="-4" y="1" transform="rotate(90 -4 1)" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="11" fill="#fff">${car.num}</text>` +
      `</g>`;
  }

  function build() {
    const r = race.querySelector(".race__stage").getBoundingClientRect();
    const next = r.width / r.height < 0.9 ? "tall" : "wide";
    if (next === mode) return;
    mode = next;
    const T = TRACKS[mode];
    svg.setAttribute("viewBox", `0 0 ${T.w} ${T.h}`);
    const g = sampleTrack(T.d);

    if (boardURL) URL.revokeObjectURL(boardURL);
    boardURL = URL.createObjectURL(new Blob([boardSVG(g, T.w, T.h)], { type: "image/svg+xml" }));
    board.setAttribute("href", boardURL);
    board.setAttribute("width", T.w);
    board.setAttribute("height", T.h);

    smokeLayer.innerHTML = "";
    carLayer.innerHTML = "";
    g.cars = CARS.map((car) => {
      const k = LANES[car.lane].off;
      const d = polyline(g, k);
      const cum = cumulative(g, k);
      const puffs = [
        { w: 46, len: 620, op: 0.08 },
        { w: 30, len: 360, op: 0.14 },
        { w: 16, len: 170, op: 0.26 },
      ].map((p) => {
        const el = document.createElementNS(SVGNS, "path");
        el.setAttribute("d", d);
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", "#e4e8ee");
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-width", p.w);
        el.setAttribute("stroke-opacity", p.op);
        smokeLayer.appendChild(el);
        return { el, ...p };
      });
      carLayer.insertAdjacentHTML("beforeend", carMarkup(car));
      const tok = carLayer.lastElementChild;
      return { ...car, k, cum, puffs, tok, yaw: 0 };
    });
    geo = g;
    current = -1; // force redraw
  }

  function headingAt(g, i) {
    return g.pts[((Math.round(i) % g.n) + g.n) % g.n].ang;
  }
  function wrapAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  const START = 34; // cars line up just past the checkered line
  const CAR_SCALE = 1.4;
  function draw(t, settle) {
    const g = geo;
    if (!g) return;
    const swing = 0.022 * Math.sin(t * Math.PI * 4); // they trade the lead twice, then meet at the line
    const pos = {};
    g.cars.forEach((car) => {
      const s = START + g.L * (t + car.sign * swing);
      const fi = s / g.step;
      const i0 = Math.floor(fi), f = fi - i0;
      const a = g.pts[((i0 % g.n) + g.n) % g.n], b = g.pts[(((i0 + 1) % g.n) + g.n) % g.n];
      const [ax, ay] = off(a, car.k), [bx, by] = off(b, car.k);
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f;

      // drift: nose rotates into the corner in proportion to how hard the track bends
      const look = 12;
      const bend = wrapAngle(headingAt(g, fi + look) - headingAt(g, fi - look));
      const target = Math.max(-0.6, Math.min(0.6, bend * 1.5));
      car.yaw = settle ? target : car.yaw + (target - car.yaw) * 0.18;
      const ang = Math.atan2(by - ay, bx - ax) + car.yaw;
      car.tok.setAttribute("transform", `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt((ang * 180) / Math.PI)}) scale(${CAR_SCALE})`);

      // smoke: trails that end at the rear wheels; thicker the harder it's drifting
      const laneL = car.cum[g.n];
      const ls = car.cum[((i0 % g.n) + g.n) % g.n] + f * (laneL / g.n);
      const lap = Math.floor(i0 / g.n);
      const travelled = lap * laneL + ls;
      const intensity = 0.35 + Math.min(1, Math.abs(car.yaw) / 0.6) * 0.65;
      car.puffs.forEach((p) => {
        const len = Math.min(p.len * intensity, Math.max(0, travelled - 30));
        p.el.setAttribute("stroke-dasharray", `${fmt(len)} ${fmt(laneL * 2)}`);
        p.el.setAttribute("stroke-dashoffset", fmt(-(ls - 30 - len)));
      });
      pos[car.num] = s;
    });

    const gap = pos["07"] - pos["02"];
    let lead, label;
    if (t < 0.015) { lead = ""; label = "Lights out"; }
    else if (t > 0.985) { lead = ""; label = "Photo finish"; }
    else if (Math.abs(gap) < g.L * 0.006) { lead = ""; label = "Side by side"; }
    else { lead = gap > 0 ? "07" : "02"; label = `${lead} leads`; }
    if (leader.textContent !== label) leader.textContent = label;
    leader.dataset.lead = lead;
    meter.style.transform = `scaleX(${t.toFixed(4)})`;

    const ci = Math.min(captions.length - 1, Math.floor(t * captions.length));
    captions.forEach((li, i) => li.classList.toggle("is-on", i === ci));
  }

  let target = 0, current = -1, rafId = 0, visible = false, lastT = 0;
  function progress() {
    const r = race.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  }
  function tick(now) {
    rafId = 0;
    target = progress();
    const dt = lastT ? Math.min(100, now - lastT) : 16.7;
    lastT = now;
    const snap = reduceMotion.matches || current < 0;
    const k = 1 - Math.pow(0.86, dt / 16.7); // same feel at any frame rate
    const next = snap ? target : current + (target - current) * k;
    const moving = Math.abs(next - current) > 0.00005;
    current = next;
    draw(current, snap);
    if (visible && (moving || Math.abs(target - current) > 0.00005)) rafId = requestAnimationFrame(tick);
    else lastT = 0;
  }
  function kick() { if (!rafId) rafId = requestAnimationFrame(tick); }

  build();
  draw(progress(), true);
  addEventListener("scroll", () => { if (visible) kick(); }, { passive: true });
  addEventListener("resize", () => { build(); kick(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(race);
  } else {
    visible = true;
  }
})();
