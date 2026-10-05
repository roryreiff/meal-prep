(() => {
  const LS = {
    grocery: "mealprep.grocery.v1",
    prep: "mealprep.prep.v1",
    ratings: "mealprep.ratings.v1",
    plate: "mealprep.plate.v1",
  };

  const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function byDayOrder(a, b) {
    const ia = DAY_ORDER.indexOf(a.day);
    const ib = DAY_ORDER.indexOf(b.day);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }

    const titles = {
    menu: ["This week", null],
    grocery: ["Grocery list", "Sprouts · check as you shop"],
    prep: ["Sunday prep", "~90 minutes · check off as you go"],
    calc: ["Macro calculator", "Weigh · estimate · hit ~600 cal / 45g+ protein"],
    ratings: ["Ratings", "Thumbs + notes so favorites rotate back in"],
  };

  let DATA = null;
  let plate = []; // [{id|custom, name, g, cal, protein, carbs, fat}]

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function weekKey(data) {
    return (data && data.weekLabel) || "default";
  }

  function groceryState(data) {
    const all = loadJSON(LS.grocery, {});
    const k = weekKey(data);
    if (!all[k]) all[k] = {};
    return { all, k, checked: all[k] };
  }
  function setGroceryChecked(data, id, on) {
    const { all, k, checked } = groceryState(data);
    checked[id] = !!on;
    all[k] = checked;
    saveJSON(LS.grocery, all);
  }

  function prepState(data) {
    const all = loadJSON(LS.prep, {});
    const k = weekKey(data);
    if (!all[k]) all[k] = {};
    return { all, k, checked: all[k] };
  }
  function setPrepChecked(data, idx, on) {
    const { all, k, checked } = prepState(data);
    checked[idx] = !!on;
    all[k] = checked;
    saveJSON(LS.prep, all);
  }

  function ratingsState() {
    return loadJSON(LS.ratings, {});
  }
  function setRating(mealKey, patch) {
    const all = ratingsState();
    all[mealKey] = { ...(all[mealKey] || {}), ...patch, updated: Date.now() };
    saveJSON(LS.ratings, all);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mealKey(d) {
    return `${d.day}|${d.name}`;
  }

  /* ---------- NAV ---------- */
  function showView(name) {
    $$(".view").forEach((v) => v.classList.remove("active"));
    $(`#view-${name}`).classList.add("active");
    $$(".nav button").forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    const [t, sub] = titles[name];
    $("#header-title").textContent = t;
    $("#header-sub").textContent =
      sub || (DATA ? `${DATA.weekLabel} · ${DATA.household.join(", ")}` : "");
    if (name === "calc") renderCalc();
    if (name === "ratings") renderRatings();
  }

  /* ---------- MENU ---------- */
  function renderMenu() {
    const root = $("#view-menu");
    const ratings = ratingsState();
    const dinners = [...DATA.dinners].sort(byDayOrder)
      .map((d) => {
        const r = ratings[mealKey(d)] || {};
        const thumb =
          r.vote === "up" ? " 👍" : r.vote === "down" ? " 👎" : "";
        return `
        <article class="card ${d.anchor ? "anchor" : ""}">
          <div class="card-top">
            <span class="day-badge ${d.anchor ? "anchor" : ""}">${esc(d.day)} ${esc(d.date)}${d.anchor ? " · slow cook" : ""}</span>
            <span class="macros-pill">~${d.cal} cal · ${d.protein}g protein</span>
          </div>
          <h3 class="meal-name">${esc(d.name)}${thumb}</h3>
          <p class="meal-desc">${esc(d.desc)}</p>
          ${d.side ? `<p class="meal-desc" style="margin-top:6px"><strong style="color:var(--sageD)">Side:</strong> ${esc(d.side)}</p>` : ""}
          <p class="est-note">Estimate for Rory's plate (veggie side included). Weigh with Macros tab for precision.</p>
        </article>`;
      })
      .join("");

    const chloe = [...DATA.chloeLunches].sort(byDayOrder)
      .map(
        (c) =>
          `<div class="chip"><strong>${esc(c.day)} ${esc(c.date)}</strong>${esc(c.items)}</div>`
      )
      .join("");

    const breakfasts = DATA.breakfasts
      .map((b) => `<div class="chip">${esc(b)}</div>`)
      .join("");

    const creamis = DATA.creami
      .map(
        (c) =>
          `<div class="chip"><strong>${esc(c.name)}</strong>${esc(c.desc)}</div>`
      )
      .join("");

    root.innerHTML = `
      <div class="banner">${esc(DATA.notes)}</div>
      <h2 class="section-title">Dinners</h2>
      ${dinners}
      <h2 class="section-title">Chloe's lunches (Mon–Thu)</h2>
      <div class="chip-list">${chloe}</div>
      <h2 class="section-title">Breakfasts</h2>
      <div class="chip-list">${breakfasts}</div>
      <h2 class="section-title">Grown-up lunches</h2>
      <div class="chip">${esc(DATA.lunches)}</div>
      <h2 class="section-title">Ninja Creami</h2>
      <div class="chip-list">${creamis}</div>
      <p class="est-note" style="margin-top:12px">Blend Sunday · freeze ~24h · spin from Monday evening.</p>
    `;
  }

  /* ---------- GROCERY ---------- */
  function renderGrocery() {
    const root = $("#view-grocery");
    const { checked } = groceryState(DATA);
    let total = 0;
    let done = 0;
    const sections = DATA.grocery
      .map((sec, si) => {
        const rows = sec.items
          .map((item, ii) => {
            const id = `${si}-${ii}`;
            total++;
            const on = !!checked[id];
            if (on) done++;
            return `
            <label class="check-row ${on ? "done" : ""}">
              <input type="checkbox" data-gid="${id}" ${on ? "checked" : ""} />
              <span class="label">${esc(item)}</span>
            </label>`;
          })
          .join("");
        return `<div class="grocery-section"><h3>${esc(sec.section)}</h3>${rows}</div>`;
      })
      .join("");

    root.innerHTML = `
      <div class="toolbar">
        <button type="button" class="btn secondary" id="groc-uncheck">Clear checks</button>
        <button type="button" class="btn secondary" id="groc-checkall">Check all</button>
      </div>
      <div class="progress">${done} of ${total} checked · Sprouts (Whole Foods backup)</div>
      ${sections}
    `;

    root.onchange = (e) => {
      const t = e.target;
      if (t.matches('input[type="checkbox"][data-gid]')) {
        setGroceryChecked(DATA, t.dataset.gid, t.checked);
        renderGrocery();
      }
    };
    $("#groc-uncheck").onclick = () => {
      const { all, k } = groceryState(DATA);
      all[k] = {};
      saveJSON(LS.grocery, all);
      renderGrocery();
    };
    $("#groc-checkall").onclick = () => {
      const { all, k } = groceryState(DATA);
      const checkedAll = {};
      DATA.grocery.forEach((sec, si) =>
        sec.items.forEach((_, ii) => (checkedAll[`${si}-${ii}`] = true))
      );
      all[k] = checkedAll;
      saveJSON(LS.grocery, all);
      renderGrocery();
    };
  }

  /* ---------- PREP ---------- */
  function renderPrep() {
    const root = $("#view-prep");
    const { checked } = prepState(DATA);
    let done = 0;
    const rows = DATA.prep
      .map((p, i) => {
        const on = !!checked[i];
        if (on) done++;
        return `
        <label class="prep-row ${on ? "done" : ""}">
          <input type="checkbox" data-pid="${i}" ${on ? "checked" : ""} />
          <span class="prep-time">${esc(p.t)}</span>
          <span class="prep-step">${esc(p.step)}</span>
        </label>`;
      })
      .join("");

    root.innerHTML = `
      <div class="toolbar">
        <button type="button" class="btn secondary" id="prep-reset">Reset steps</button>
      </div>
      <div class="progress">${done} of ${DATA.prep.length} done</div>
      <div class="timeline">${rows}</div>
      <p class="est-note">${esc(DATA.prepNote || "")}</p>
    `;

    root.onchange = (e) => {
      const t = e.target;
      if (t.matches('input[type="checkbox"][data-pid]')) {
        setPrepChecked(DATA, Number(t.dataset.pid), t.checked);
        renderPrep();
      }
    };
    $("#prep-reset").onclick = () => {
      const { all, k } = prepState(DATA);
      all[k] = {};
      saveJSON(LS.prep, all);
      renderPrep();
    };
  }

  /* ---------- CALC ---------- */
  function componentOptions(selected) {
    const comps = DATA.components;
    return Object.keys(comps)
      .sort((a, b) => comps[a].name.localeCompare(comps[b].name))
      .map(
        (id) =>
          `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(comps[id].name)}</option>`
      )
      .join("");
  }

  function macrosFor(id) {
    return DATA.components[id];
  }

  function scale(m, g) {
    const f = g / 100;
    return {
      cal: m.cal * f,
      protein: m.protein * f,
      carbs: m.carbs * f,
      fat: m.fat * f,
    };
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function renderPlateLines() {
    if (!plate.length) {
      return `<div class="empty">Add components to build your plate.</div>`;
    }
    return plate
      .map((p, i) => {
        const s = scale(p, p.g);
        return `
        <div class="plate-line" data-pi="${i}">
          <div>
            <strong>${esc(p.name)}</strong><br/>
            <span style="color:var(--muted)">${p.g}g · ${Math.round(s.cal)} cal · ${round1(s.protein)}g P</span>
          </div>
          <button type="button" class="rm" data-rm="${i}">Remove</button>
        </div>`;
      })
      .join("");
  }

  function plateTotals() {
    return plate.reduce(
      (acc, p) => {
        const s = scale(p, p.g);
        acc.cal += s.cal;
        acc.protein += s.protein;
        acc.carbs += s.carbs;
        acc.fat += s.fat;
        return acc;
      },
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  function barPct(val, target) {
    return Math.min(140, Math.round((val / target) * 100));
  }

  function renderCalc() {
    const root = $("#view-calc");
    const firstId = Object.keys(DATA.components)[0];
    const t = DATA.targets;
    const tot = plateTotals();
    const calPct = barPct(tot.cal, t.calories);
    const proPct = barPct(tot.protein, t.protein);

    root.innerHTML = `
      <div class="tabs-mini" role="tablist">
        <button type="button" class="on" data-mode="batch">From batch</button>
        <button type="button" data-mode="custom">Custom batch</button>
      </div>

      <div class="card calc-card" id="mode-batch">
        <label for="comp-select">Component <span class="est-tag">per 100g est.</span></label>
        <select id="comp-select">${componentOptions(firstId)}</select>

        <div class="macro-edit" id="macro-fields">
          <div class="field"><input type="number" id="m-cal" step="0.1" /><span class="unit">cal</span></div>
          <div class="field"><input type="number" id="m-pro" step="0.1" /><span class="unit">protein</span></div>
          <div class="field"><input type="number" id="m-carb" step="0.1" /><span class="unit">carbs</span></div>
          <div class="field"><input type="number" id="m-fat" step="0.1" /><span class="unit">fat</span></div>
        </div>

        <label for="grams">Grams on the plate</label>
        <input type="number" id="grams" min="1" step="1" value="150" inputmode="decimal" />

        <div id="live-macros" class="progress" style="margin-top:-4px"></div>
        <button type="button" class="btn" id="add-comp" style="width:100%">Add to plate</button>
      </div>

      <div class="card calc-card" id="mode-custom" style="display:none">
        <p class="est-note" style="margin-top:0;margin-bottom:10px">Enter the whole recipe's macros and the finished cooked weight. We'll compute per-gram values.</p>
        <label for="c-name">Batch name</label>
        <input type="text" id="c-name" placeholder="e.g. Sunday chuck roast" />
        <div class="calc-grid">
          <div>
            <label for="c-cal">Total calories</label>
            <input type="number" id="c-cal" step="1" />
          </div>
          <div>
            <label for="c-pro">Total protein (g)</label>
            <input type="number" id="c-pro" step="0.1" />
          </div>
          <div>
            <label for="c-carb">Total carbs (g)</label>
            <input type="number" id="c-carb" step="0.1" />
          </div>
          <div>
            <label for="c-fat">Total fat (g)</label>
            <input type="number" id="c-fat" step="0.1" />
          </div>
        </div>
        <label for="c-batch">Total cooked batch weight (g)</label>
        <input type="number" id="c-batch" step="1" placeholder="e.g. 1200" />
        <label for="c-plate">Grams on your plate</label>
        <input type="number" id="c-plate" step="1" value="150" />
        <div id="custom-live" class="progress"></div>
        <button type="button" class="btn" id="add-custom" style="width:100%">Add to plate</button>
      </div>

      <h2 class="section-title">Your plate</h2>
      <div class="card" id="plate-list">${renderPlateLines()}</div>

      <div class="totals">
        <div class="totals-row">
          <div><div class="n" id="t-cal">${Math.round(tot.cal)}</div><div class="l">cal</div></div>
          <div><div class="n" id="t-pro">${round1(tot.protein)}</div><div class="l">protein</div></div>
          <div><div class="n" id="t-carb">${round1(tot.carbs)}</div><div class="l">carbs</div></div>
          <div><div class="n" id="t-fat">${round1(tot.fat)}</div><div class="l">fat</div></div>
        </div>
        <div class="target-bar">
          <div class="bar-meta"><span>Calories vs ${t.calories}</span><span id="cal-label">${Math.round(tot.cal)} / ${t.calories}</span></div>
          <div class="bar-bg"><div class="bar-fill ${tot.cal > t.calories ? "over" : ""}" style="width:${Math.min(100, calPct)}%"></div></div>
          <div class="bar-meta" style="margin-top:8px"><span>Protein vs ${t.protein}g+</span><span id="pro-label">${round1(tot.protein)} / ${t.protein}g</span></div>
          <div class="bar-bg"><div class="bar-fill ${tot.protein >= t.protein ? "" : ""}" style="width:${Math.min(100, proPct)}%;background:${tot.protein >= t.protein ? "var(--sage)" : "var(--terra)"}"></div></div>
        </div>
        <div class="toolbar" style="margin-top:12px;margin-bottom:0">
          <button type="button" class="btn secondary" id="clear-plate">Clear plate</button>
          <button type="button" class="btn secondary" id="load-dinner">Load tonight's plate</button>
        </div>
      </div>
      <p class="est-note">All macros are estimates (USDA-style references). Edit per-100g values above if your batch differs.</p>
    `;

    const fillFromSelect = () => {
      const id = $("#comp-select").value;
      const m = macrosFor(id);
      $("#m-cal").value = m.cal;
      $("#m-pro").value = m.protein;
      $("#m-carb").value = m.carbs;
      $("#m-fat").value = m.fat;
      updateLive();
    };
    const updateLive = () => {
      const g = Number($("#grams").value) || 0;
      const m = {
        cal: Number($("#m-cal").value) || 0,
        protein: Number($("#m-pro").value) || 0,
        carbs: Number($("#m-carb").value) || 0,
        fat: Number($("#m-fat").value) || 0,
      };
      const s = scale(m, g);
      $("#live-macros").textContent = `${g}g → ~${Math.round(s.cal)} cal · ${round1(s.protein)}g P · ${round1(s.carbs)}g C · ${round1(s.fat)}g F`;
    };
    fillFromSelect();
    $("#comp-select").onchange = fillFromSelect;
    ["m-cal", "m-pro", "m-carb", "m-fat", "grams"].forEach((id) => {
      $(`#${id}`).oninput = updateLive;
    });

    $$(".tabs-mini button").forEach((b) => {
      b.onclick = () => {
        $$(".tabs-mini button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        const mode = b.dataset.mode;
        $("#mode-batch").style.display = mode === "batch" ? "" : "none";
        $("#mode-custom").style.display = mode === "custom" ? "" : "none";
      };
    });

    $("#add-comp").onclick = () => {
      const id = $("#comp-select").value;
      const name = macrosFor(id).name;
      const g = Number($("#grams").value) || 0;
      if (g <= 0) return;
      plate.push({
        id,
        name,
        g,
        cal: Number($("#m-cal").value) || 0,
        protein: Number($("#m-pro").value) || 0,
        carbs: Number($("#m-carb").value) || 0,
        fat: Number($("#m-fat").value) || 0,
      });
      saveJSON(LS.plate, plate);
      renderCalc();
    };

    const updateCustomLive = () => {
      const batch = Number($("#c-batch").value) || 0;
      const plateG = Number($("#c-plate").value) || 0;
      const cal = Number($("#c-cal").value) || 0;
      const pro = Number($("#c-pro").value) || 0;
      if (!batch) {
        $("#custom-live").textContent = "Enter batch weight to see per-100g.";
        return;
      }
      const per100 = {
        cal: (cal / batch) * 100,
        protein: (pro / batch) * 100,
        carbs: ((Number($("#c-carb").value) || 0) / batch) * 100,
        fat: ((Number($("#c-fat").value) || 0) / batch) * 100,
      };
      const s = scale(per100, plateG);
      $("#custom-live").textContent = `Per 100g: ${round1(per100.cal)} cal · ${round1(per100.protein)}g P → plate ${plateG}g: ~${Math.round(s.cal)} cal · ${round1(s.protein)}g P`;
    };
    ["c-cal", "c-pro", "c-carb", "c-fat", "c-batch", "c-plate"].forEach((id) => {
      $(`#${id}`).oninput = updateCustomLive;
    });
    updateCustomLive();

    $("#add-custom").onclick = () => {
      const batch = Number($("#c-batch").value) || 0;
      const plateG = Number($("#c-plate").value) || 0;
      if (batch <= 0 || plateG <= 0) return;
      const per100 = {
        cal: ((Number($("#c-cal").value) || 0) / batch) * 100,
        protein: ((Number($("#c-pro").value) || 0) / batch) * 100,
        carbs: ((Number($("#c-carb").value) || 0) / batch) * 100,
        fat: ((Number($("#c-fat").value) || 0) / batch) * 100,
      };
      const name = ($("#c-name").value || "Custom batch").trim();
      plate.push({ id: "custom", name, g: plateG, ...per100 });
      saveJSON(LS.plate, plate);
      renderCalc();
    };

    $("#plate-list").onclick = (e) => {
      const btn = e.target.closest("[data-rm]");
      if (!btn) return;
      plate.splice(Number(btn.dataset.rm), 1);
      saveJSON(LS.plate, plate);
      renderCalc();
    };

    $("#clear-plate").onclick = () => {
      plate = [];
      saveJSON(LS.plate, plate);
      renderCalc();
    };

    $("#load-dinner").onclick = () => {
      // Pick dinner for today's weekday, or first if weekend mismatch — use local day name
      const jsDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const today = jsDays[new Date().getDay()];
      const ordered = [...DATA.dinners].sort(byDayOrder);
      let dinner = ordered.find((d) => d.day === today) || ordered[0];
      if (!dinner.plate || !dinner.plate.length) dinner = ordered.find((d) => d.plate && d.plate.length) || dinner;
      plate = (dinner.plate || []).map((p) => {
        const m = macrosFor(p.id);
        return {
          id: p.id,
          name: m.name,
          g: p.g,
          cal: m.cal,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
        };
      });
      saveJSON(LS.plate, plate);
      renderCalc();
    };
  }

  /* ---------- RATINGS ---------- */
  function renderRatings() {
    const root = $("#view-ratings");
    const ratings = ratingsState();
    const cards = [...DATA.dinners].sort(byDayOrder)
      .map((d) => {
        const key = mealKey(d);
        const r = ratings[key] || {};
        return `
        <article class="card rating-card" data-key="${esc(key)}">
          <div class="card-top">
            <span class="day-badge">${esc(d.day)} ${esc(d.date)}</span>
            <span class="macros-pill">~${d.cal} cal · ${d.protein}g</span>
          </div>
          <h3 class="meal-name">${esc(d.name)}</h3>
          <div class="rate-row">
            <button type="button" class="rate-btn up ${r.vote === "up" ? "on" : ""}" data-vote="up" aria-label="Thumbs up">👍</button>
            <button type="button" class="rate-btn down ${r.vote === "down" ? "on" : ""}" data-vote="down" aria-label="Thumbs down">👎</button>
            <input class="rate-note" type="text" placeholder="Note (optional)" value="${esc(r.note || "")}" data-note />
          </div>
        </article>`;
      })
      .join("");

    const favs = [...DATA.dinners].sort(byDayOrder).filter((d) => (ratings[mealKey(d)] || {}).vote === "up");
    const favBlock = favs.length
      ? `<div class="banner">Favorites this week: ${favs.map((d) => esc(d.name)).join(" · ")}</div>`
      : `<div class="banner">Rate meals so we can rotate favorites into future weeks.</div>`;

    root.innerHTML = favBlock + cards;

    root.onclick = (e) => {
      const btn = e.target.closest(".rate-btn");
      if (!btn) return;
      const card = btn.closest("[data-key]");
      const key = card.dataset.key;
      const vote = btn.dataset.vote;
      const cur = (ratingsState()[key] || {}).vote;
      setRating(key, { vote: cur === vote ? null : vote });
      renderRatings();
    };
    root.onchange = (e) => {
      if (!e.target.matches("[data-note]")) return;
      const card = e.target.closest("[data-key]");
      setRating(card.dataset.key, { note: e.target.value });
    };
    // also save on input debounce-ish via change is fine; add blur save
    root.oninput = (e) => {
      if (!e.target.matches("[data-note]")) return;
      const card = e.target.closest("[data-key]");
      setRating(card.dataset.key, { note: e.target.value });
    };
  }

  /* ---------- BOOT ---------- */
  function appBase() {
    // Works at / and under /meal-prep/ (GitHub Pages project site).
    let path = location.pathname;
    if (!path.endsWith("/") && !/\.[a-zA-Z0-9]+$/.test(path)) {
      path = path + "/";
      try {
        history.replaceState(null, "", path + location.search + location.hash);
      } catch (_) {}
    }
    if (path.endsWith("/")) return path;
    return path.replace(/\/[^/]*$/, "/");
  }

  async function boot() {
    const BASE = appBase();
    try {
      const res = await fetch(BASE + "data/week.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load week.json (${res.status})`);
      DATA = await res.json();
    } catch (err) {
      document.body.innerHTML = `<p style="padding:24px;font-family:sans-serif">Could not load data/week.json. Serve this folder over HTTP (not file://).<br/><code>${esc(err.message)}</code></p>`;
      return;
    }

    plate = loadJSON(LS.plate, []);

    $$(".nav button").forEach((b) => {
      b.addEventListener("click", () => showView(b.dataset.view));
    });

    renderMenu();
    renderGrocery();
    renderPrep();
    showView("menu");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(BASE + "sw.js", { scope: BASE }).catch(() => {});
    }
  }

  boot();
})();
