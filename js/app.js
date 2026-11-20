(function () {
  "use strict";

  const { distanceKm, pointsFor, timeFactor, RULES } = window.CityFinderScoring;
  const i18n = window.CityFinderI18n;
  const t = i18n.t;
  const CITIES = window.CITYFINDER_CITIES;
  const WORLD = window.CITYFINDER_WORLD;

  // Light political-map palette; neighbouring countries get different colours.
  const PALETTE = ["#f6d8b0", "#cfe8b4", "#f6c9cb", "#cbdaf2", "#faeaa6", "#dccbee", "#c3e6e1"];

  const POOLS = {
    capitals: { label: "pool.capitals", filter: (c) => c.cap === 1 },
    large: { label: "pool.large", filter: (c) => c.pop >= 2_000_000 },
    mixed: { label: "pool.mixed", filter: () => true },
  };

  // Localised city / country names (data carries English n/c and German nd/cd).
  const cityName = (c) => (i18n.getLanguage() === "de" ? c.nd : c.n) || c.n;
  const countryName = (c) => (i18n.getLanguage() === "de" ? c.cd : c.c) || c.c;
  const fmt = (n) => i18n.formatNumber(n);
  const fmt1 = (n) => i18n.formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // ---------------------------------------------------------------- storage
  const STORAGE_KEY = "cityfinder.v1";
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }
  function saveStore() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* ignore */ }
  }
  const store = loadStore();
  store.best = store.best || {};
  const settings = Object.assign({ pool: "mixed", rounds: 10, timer: 30, showCountry: true }, store.settings);
  // Language: an explicit choice (settings.lang) wins, otherwise follow the browser.
  const currentLang = () => settings.lang || i18n.detectLanguage();
  // "v2": scoring includes the time penalty, so older best scores aren't comparable.
  const bestKey = () => `v2|${settings.pool}|${settings.rounds}|${settings.timer}|${settings.showCountry ? "hint" : "nohint"}`;

  // ---------------------------------------------------------------- dom
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $("hud"), actionBar: $("action-bar"), setup: $("setup"), summary: $("summary"),
    targetName: $("target-name"), targetCountry: $("target-country"),
    prompt: document.querySelector(".prompt-card"),
    promptLabel: document.querySelector(".prompt-label"),
    resultTime: $("result-time"),
    timer: $("timer"), timerFill: $("timer-fill"),
    roundLabel: $("round-label"), scoreLabel: $("score-label"),
    hint: $("hint"), result: $("result"), resultDistance: $("result-distance"), resultPoints: $("result-points"),
    confirmBtn: $("confirm-btn"), nextBtn: $("next-btn"),
    mainMenu: $("main-menu"), optionsMenu: $("options-menu"), settingsSummary: $("settings-summary"),
    optionsBtn: $("options-btn"), optionsBack: $("options-back"), optionsDone: $("options-done"),
    startBtn: $("start-btn"), quitBtn: $("quit-btn"), againBtn: $("again-btn"), menuBtn: $("menu-btn"),
    showCountry: $("show-country"), poolNote: $("pool-note"), bestLabel: $("best-label"),
    summaryScore: $("summary-score"), summaryMax: $("summary-max"), summaryBest: $("summary-best"), summaryRows: $("summary-rows"),
  };

  // ---------------------------------------------------------------- map
  const svg = d3.select("#map");
  const zoomLayer = svg.append("g");
  const gBase = zoomLayer.append("g");
  const gOverlay = zoomLayer.append("g");

  const sphere = { type: "Sphere" };
  const projection = d3.geoNaturalEarth1();
  const geoPath = d3.geoPath(projection);

  const countries = topojson.feature(WORLD, WORLD.objects.countries).features;
  const colorIndex = assignColors(topojson.neighbors(WORLD.objects.countries.geometries));

  const sphereEl = gBase.append("path").attr("class", "sphere").datum(sphere);
  const graticuleEl = gBase.append("path").attr("class", "graticule").datum(d3.geoGraticule10());
  const countryEls = gBase.append("g")
    .selectAll("path")
    .data(countries)
    .join("path")
    .attr("class", "country")
    .attr("fill", (d, i) => PALETTE[colorIndex[i]]);

  let width = 0;
  let height = 0;
  let zoomK = 1;

  const zoom = d3.zoom()
    .scaleExtent([1, 80])
    .clickDistance(5)
    .on("start", (e) => { if (e.sourceEvent && e.sourceEvent.type === "mousedown") svg.classed("panning", true); })
    .on("zoom", (e) => {
      zoomLayer.attr("transform", e.transform);
      if (e.transform.k !== zoomK) { zoomK = e.transform.k; scaleOverlay(); }
    })
    .on("end", () => svg.classed("panning", false));
  svg.call(zoom).on("dblclick.zoom", null);

  /** Greedy graph colouring so neighbouring countries differ. */
  function assignColors(neighbors) {
    const P = PALETTE.length;
    const colors = new Array(neighbors.length).fill(-1);
    const order = d3.range(neighbors.length).sort((a, b) => neighbors[b].length - neighbors[a].length);
    for (const i of order) {
      const used = new Set(neighbors[i].map((j) => colors[j]));
      let pick = i % P;
      for (let t = 0; t < P; t++) {
        const cand = (i + t) % P;
        if (!used.has(cand)) { pick = cand; break; }
      }
      colors[i] = pick;
    }
    return colors;
  }

  function layout() {
    const rect = svg.node().getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const pad = 10;
    projection.fitExtent([[pad, pad], [width - pad, height - pad]], sphere);
    sphereEl.attr("d", geoPath);
    graticuleEl.attr("d", geoPath);
    countryEls.attr("d", geoPath);
    zoom.extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]);
    drawOverlay();
  }

  // Overlay: guess marker, actual marker, connecting great-circle line.
  const overlay = { guess: null, actual: null, label: "" };

  function drawOverlay() {
    gOverlay.selectAll("*").remove();
    if (overlay.guess && overlay.actual) {
      gOverlay.append("path")
        .attr("class", "guess-line")
        .datum({ type: "LineString", coordinates: [overlay.guess, overlay.actual] })
        .attr("d", geoPath);
    }
    if (overlay.actual) {
      const p = projection(overlay.actual);
      gOverlay.append("circle").attr("class", "marker-ring").datum(p).attr("cx", p[0]).attr("cy", p[1]);
      gOverlay.append("circle").attr("class", "marker actual").datum(p).attr("cx", p[0]).attr("cy", p[1]);
      gOverlay.append("text").attr("class", "city-label").datum(p).text(overlay.label);
    }
    if (overlay.guess) {
      const p = projection(overlay.guess);
      gOverlay.append("circle").attr("class", "marker guess").datum(p).attr("cx", p[0]).attr("cy", p[1]);
    }
    scaleOverlay();
  }

  /** Keep markers and labels a constant on-screen size regardless of zoom. */
  function scaleOverlay() {
    const k = zoomK;
    gOverlay.selectAll(".marker").attr("r", 6.5 / k);
    gOverlay.selectAll(".marker-ring").attr("r", 13 / k);
    gOverlay.selectAll(".city-label")
      .attr("x", (p) => p[0] + 16 / k)
      .attr("y", (p) => p[1] + 5 / k)
      .attr("font-size", 15 / k)
      .style("stroke-width", 3.5 / k);
  }

  function resetZoom(animate = true) {
    const target = animate ? svg.transition().duration(600) : svg;
    target.call(zoom.transform, d3.zoomIdentity);
  }

  function zoomToPoints(points) {
    const xy = points.map((p) => projection(p));
    const [x0, x1] = d3.extent(xy, (d) => d[0]);
    const [y0, y1] = d3.extent(xy, (d) => d[1]);
    const dx = Math.max(x1 - x0, 160);
    const dy = Math.max(y1 - y0, 160);
    const k = Math.max(1, Math.min(10, 0.55 / Math.max(dx / width, dy / height)));
    const t = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(900).call(zoom.transform, t);
  }

  /** Place (or move) the guess pin at the event's map position. Returns true on success. */
  function placeGuess(event) {
    if (state.phase !== "guessing") return false;
    const [x, y] = d3.pointer(event, zoomLayer.node());
    const p = projection.invert([x, y]);
    if (!p || !isFinite(p[0]) || !isFinite(p[1])) return false;
    const back = projection(p);
    if (!back || Math.hypot(back[0] - x, back[1] - y) > 1) return false; // clicked outside the globe
    overlay.guess = p;
    drawOverlay();
    el.confirmBtn.disabled = false;
    el.hint.textContent = t("game.hintMove");
    return true;
  }

  // Ignore map clicks for a moment after the result appears, so the tail of a
  // double/triple click doesn't skip straight past the result.
  const RESULT_CLICK_DELAY_MS = 500;

  svg.on("click", (event) => {
    if (state.phase === "guessing") {
      // event.detail is the browser's click count: 2 = second click of a double-click,
      // which places the pin there and locks in the answer immediately.
      if (placeGuess(event) && event.detail >= 2) submitGuess(false);
    } else if (state.phase === "result") {
      // Any click on the map (not a drag) continues to the next city.
      if (performance.now() - state.resultShownAt > RESULT_CLICK_DELAY_MS) nextRound();
    }
  });
  svg.on("dblclick", (event) => event.preventDefault());

  $("zoom-in").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 2));
  $("zoom-out").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.5));
  $("zoom-reset").addEventListener("click", () => resetZoom());

  // ---------------------------------------------------------------- game
  const state = { phase: "setup", rounds: [], index: 0, score: 0, timerEnd: 0, raf: 0 };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startGame() {
    const pool = CITIES.filter(POOLS[settings.pool].filter);
    state.rounds = shuffle(pool).slice(0, settings.rounds).map((city) => ({ city, guess: null, km: null, points: 0 }));
    state.index = 0;
    state.score = 0;
    el.setup.classList.add("hidden");
    el.summary.classList.add("hidden");
    el.hud.classList.remove("hidden");
    el.actionBar.classList.remove("hidden");
    startRound();
  }

  function startRound() {
    const { city } = state.rounds[state.index];
    state.phase = "guessing";
    el.targetName.textContent = cityName(city);
    el.targetCountry.textContent = settings.showCountry ? countryName(city) : "";
    el.roundLabel.textContent = `${state.index + 1} / ${state.rounds.length}`;
    el.scoreLabel.textContent = fmt(state.score);

    overlay.guess = null;
    overlay.actual = null;
    overlay.label = "";
    drawOverlay();
    resetZoom();

    el.hint.textContent = t("game.hintStart");
    el.hint.classList.remove("hidden");
    el.result.classList.add("hidden");
    el.confirmBtn.classList.remove("hidden");
    el.confirmBtn.disabled = true;
    el.nextBtn.classList.add("hidden");

    startTimer();
  }

  function startTimer() {
    cancelAnimationFrame(state.raf);
    el.timerFill.classList.remove("warn", "danger");
    el.timer.classList.toggle("hidden", !settings.timer);
    state.roundStart = performance.now();
    const total = settings.timer * 1000;
    const tick = () => {
      const elapsed = performance.now() - state.roundStart;
      const grace = elapsed < RULES.GRACE_S * 1000;
      el.prompt.classList.toggle("grace", grace);
      if (settings.timer) {
        const left = total - elapsed;
        const f = Math.max(0, Math.min(1, left / total));
        el.timerFill.style.transform = `scaleX(${f})`;
        el.timerFill.classList.toggle("warn", f < 0.34 && f >= 0.15);
        el.timerFill.classList.toggle("danger", f < 0.15);
        el.promptLabel.textContent = grace ? `${t("hud.find")} · ${t("hud.fullPoints")}` : `${t("hud.find")} · ${Math.max(0, Math.ceil(left / 1000))} s`;
        if (left <= 0) { submitGuess(true); return; }
      } else {
        el.promptLabel.textContent = grace ? `${t("hud.find")} · ${t("hud.fullPoints")}` : `${t("hud.find")} · ${Math.floor(elapsed / 1000)} s`;
      }
      state.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function formatKm(km) {
    if (km < 1) return "< 1 km";
    if (km < 10) return `${fmt1(km)} km`;
    return `${fmt(Math.round(km))} km`;
  }

  function submitGuess(timedOut = false) {
    if (state.phase !== "guessing") return;
    cancelAnimationFrame(state.raf);
    state.phase = "result";
    state.resultShownAt = performance.now();

    const round = state.rounds[state.index];
    const actual = [round.city.lon, round.city.lat];
    round.guess = overlay.guess;
    round.km = round.guess ? distanceKm(round.guess, actual) : null;
    round.seconds = timedOut ? settings.timer : (performance.now() - state.roundStart) / 1000;
    round.basePoints = pointsFor(round.km);
    round.factor = timeFactor(round.seconds, settings.timer);
    round.points = Math.round(round.basePoints * round.factor);
    state.score += round.points;
    el.prompt.classList.remove("grace");

    overlay.actual = actual;
    overlay.label = cityName(round.city);
    drawOverlay();
    zoomToPoints(round.guess ? [round.guess, actual] : [actual]);

    if (!round.guess) {
      el.resultDistance.textContent = timedOut ? t("game.timeUp") : t("game.noGuess");
    } else if (round.km >= RULES.CUTOFF_KM) {
      el.resultDistance.textContent = t("game.tooFar", { km: formatKm(round.km) });
    } else {
      el.resultDistance.textContent = t("game.away", { km: formatKm(round.km) });
    }
    const penalty = round.basePoints - round.points;
    const secs = `${fmt1(round.seconds)} s`;
    if (!round.guess) el.resultTime.textContent = "";
    else if (penalty > 0) el.resultTime.textContent = t("game.timePenalty", { s: secs, points: fmt(penalty) });
    else if (round.basePoints > 0) el.resultTime.textContent = t("game.noTimePenalty", { s: secs });
    else el.resultTime.textContent = secs;
    el.promptLabel.textContent = t("hud.find");
    el.resultPoints.textContent = `+${fmt(round.points)}`;
    el.resultPoints.classList.toggle("zero", round.points === 0);
    el.scoreLabel.textContent = fmt(state.score);

    el.hint.classList.add("hidden");
    el.result.classList.remove("hidden");
    el.confirmBtn.classList.add("hidden");
    el.nextBtn.classList.remove("hidden");
    el.nextBtn.textContent = state.index + 1 < state.rounds.length ? t("game.next") : t("game.results");
    el.nextBtn.focus();
  }

  function nextRound() {
    if (state.phase !== "result") return;
    state.index++;
    if (state.index < state.rounds.length) startRound();
    else showSummary();
  }

  function showSummary() {
    state.phase = "summary";
    const max = state.rounds.length * RULES.MAX_POINTS;
    el.summaryScore.textContent = fmt(state.score);
    el.summaryMax.textContent = fmt(max);

    const key = bestKey();
    const prev = store.best[key];
    if (prev == null || state.score > prev) {
      store.best[key] = state.score;
      saveStore();
      el.summaryBest.textContent = prev == null ? t("end.first") : t("end.newBest", { score: fmt(prev) });
    } else {
      el.summaryBest.textContent = t("end.best", { score: fmt(prev) });
    }

    el.summaryRows.replaceChildren(...state.rounds.map((r, i) => {
      const tr = document.createElement("tr");
      const td = (text, cls) => {
        const c = document.createElement("td");
        if (cls) c.className = cls;
        c.textContent = text;
        tr.appendChild(c);
        return c;
      };
      td(String(i + 1));
      const name = td(cityName(r.city) + " ");
      const sub = document.createElement("span");
      sub.className = "country-sub";
      sub.textContent = countryName(r.city);
      name.appendChild(sub);
      td(r.km == null ? "—" : formatKm(r.km), "num");
      td(r.guess ? `${fmt1(r.seconds)} s` : "—", "num");
      td(String(r.points), r.points === 0 ? "num zero" : "num");
      return tr;
    }));

    el.hud.classList.add("hidden");
    el.actionBar.classList.add("hidden");
    el.summary.classList.remove("hidden");
    el.againBtn.focus();
  }

  function showMenu() {
    cancelAnimationFrame(state.raf);
    state.phase = "setup";
    overlay.guess = overlay.actual = null;
    drawOverlay();
    resetZoom();
    el.hud.classList.add("hidden");
    el.actionBar.classList.add("hidden");
    el.summary.classList.add("hidden");
    el.setup.classList.remove("hidden");
    showMainMenu();
  }

  function showMainMenu() {
    el.optionsMenu.classList.add("hidden");
    el.mainMenu.classList.remove("hidden");
    renderSetup();
    el.startBtn.focus();
  }

  function showOptions() {
    el.mainMenu.classList.add("hidden");
    el.optionsMenu.classList.remove("hidden");
    renderSetup();
  }

  // ---------------------------------------------------------------- setup ui
  function renderSetup() {
    document.querySelectorAll(".segmented").forEach((group) => {
      const key = group.dataset.setting;
      group.querySelectorAll("button").forEach((b) => {
        const value = key === "lang" ? currentLang() : settings[key];
        b.classList.toggle("active", String(value) === b.dataset.value);
      });
    });
    el.showCountry.checked = settings.showCountry;
    const count = CITIES.filter(POOLS[settings.pool].filter).length;
    el.poolNote.textContent = t("options.poolCount", { count });
    const best = store.best[bestKey()];
    el.bestLabel.textContent = best != null ? t("menu.best", { score: fmt(best) }) : "";
    el.settingsSummary.textContent = [
      t(POOLS[settings.pool].label),
      t("summary.rounds", { n: settings.rounds }),
      settings.timer ? t("summary.perCity", { s: settings.timer }) : t("summary.noLimit"),
      settings.showCountry ? t("summary.hint") : t("summary.noHint"),
    ].join(" · ");
  }

  document.querySelectorAll(".segmented").forEach((group) => {
    group.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const key = group.dataset.setting;
      settings[key] = key === "pool" || key === "lang" ? b.dataset.value : Number(b.dataset.value);
      store.settings = settings;
      saveStore();
      if (key === "lang") i18n.setLanguage(currentLang());
      renderSetup();
    });
  });
  el.showCountry.addEventListener("change", () => {
    settings.showCountry = el.showCountry.checked;
    store.settings = settings;
    saveStore();
    renderSetup();
  });

  el.startBtn.addEventListener("click", startGame);
  el.optionsBtn.addEventListener("click", showOptions);
  el.optionsBack.addEventListener("click", showMainMenu);
  el.optionsDone.addEventListener("click", showMainMenu);
  el.confirmBtn.addEventListener("click", () => submitGuess(false));
  el.nextBtn.addEventListener("click", nextRound);
  el.quitBtn.addEventListener("click", showMenu);
  el.againBtn.addEventListener("click", startGame);
  el.menuBtn.addEventListener("click", showMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
    if (state.phase === "guessing" && overlay.guess) { e.preventDefault(); submitGuess(false); }
    else if (state.phase === "result") { e.preventDefault(); nextRound(); }
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });

  i18n.setLanguage(currentLang());
  layout();
  renderSetup();
})();
