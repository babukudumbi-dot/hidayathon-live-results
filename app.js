/**
 * HIDAYATHON 2.O LIVE SPORTS MEET 2026–27
 * GitHub Pages static build — charcoal + volt theme, 4 house cubes
 */

const SPREADSHEET_ID = "1rRUeY6iOaWIT7OPGMbJG6JnrYv7nOwUPiB8tHmOTep8";
const GID_SCOREBOARD = "0";
const GID_EVENTS = "427537611";
const REFRESH_INTERVAL_SEC = 15;

let state = {
  houses: [
    { name: "BLUE", fullName: "Blue House", color: "blue", rank: 1, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: "Valiant Titans" },
    { name: "GREEN", fullName: "Green House", color: "green", rank: 2, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: "Fierce Falcons" },
    { name: "RED", fullName: "Red House", color: "red", rank: 3, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: "Blazing Warriors" },
    { name: "YELLOW", fullName: "Yellow House", color: "yellow", rank: 4, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: "Golden Knights" },
  ],
  previousLeader: null,
  categoryMatrix: [],
  events: [],
  filteredEvents: [],
  currentView: "cards",
  lastUpdated: null,
  countdown: REFRESH_INTERVAL_SEC,
  timerInterval: null,
  isSyncing: false,
};

const HOUSE_CONFIG = {
  BLUE: {
    name: "Blue House",
    bgBadge: "background:rgba(59,130,246,0.2);color:#60a5fa;border:1px solid rgba(59,130,246,0.4)",
    barBg: "background:#3b82f6",
    accent: "#3b82f6",
    icon: "fa-water",
  },
  GREEN: {
    name: "Green House",
    bgBadge: "background:rgba(34,197,94,0.2);color:#4ade80;border:1px solid rgba(34,197,94,0.4)",
    barBg: "background:#22c55e",
    accent: "#22c55e",
    icon: "fa-clover",
  },
  RED: {
    name: "Red House",
    bgBadge: "background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.4)",
    barBg: "background:#ef4444",
    accent: "#ef4444",
    icon: "fa-fire",
  },
  YELLOW: {
    name: "Yellow House",
    bgBadge: "background:rgba(234,179,8,0.2);color:#fde047;border:1px solid rgba(234,179,8,0.4)",
    barBg: "background:#eab308",
    accent: "#eab308",
    icon: "fa-sun",
  },
};

function fetchSheetJSONP(gid) {
  return new Promise((resolve, reject) => {
    const callbackName = "gvizCallback_" + Math.floor(Math.random() * 1e7);
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout fetching sheet gid=" + gid));
    }, 12000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function (response) {
      cleanup();
      if (response && response.table) resolve(response.table);
      else reject(new Error("Invalid response for gid=" + gid));
    };

    script.src =
      "https://docs.google.com/spreadsheets/d/" +
      SPREADSHEET_ID +
      "/gviz/tq?tqx=responseHandler:" +
      callbackName +
      "&gid=" +
      gid +
      "&_t=" +
      Date.now();
    script.onerror = function () {
      cleanup();
      reject(new Error("Network error gid=" + gid));
    };
    document.body.appendChild(script);
  });
}

function parseScoreboardData(table) {
  if (!table || !table.rows) return;
  const rows = table.rows;
  const parsedHouses = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].c || [];
    const cell2 = r[2] ? String(r[2].v || "").trim().toUpperCase() : "";
    if (["BLUE", "GREEN", "RED", "YELLOW"].includes(cell2)) {
      const gold = parseInt(r[3]?.v) || 0;
      const silver = parseInt(r[4]?.v) || 0;
      const bronze = parseInt(r[5]?.v) || 0;
      parsedHouses[cell2] = {
        name: cell2,
        fullName: HOUSE_CONFIG[cell2]?.name || cell2 + " House",
        rank: parseInt(r[1]?.v) || 0,
        points: parseFloat(r[7]?.v) || 0,
        gold,
        silver,
        bronze,
        totalMedals: parseInt(r[6]?.v) || gold + silver + bronze,
      };
    }
  }

  if (Object.keys(parsedHouses).length === 4) {
    state.houses = state.houses.map((h) => ({ ...h, ...(parsedHouses[h.name] || {}) }));
  }

  const matrix = [];
  for (let i = 11; i < rows.length; i++) {
    const r = rows[i].c || [];
    const category = r[1]?.v ? String(r[1].v).trim() : "";
    const gender = r[2]?.v ? String(r[2].v).trim() : "";
    if (category && gender && category !== "Category") {
      const bluePts = parseFloat(r[3]?.v) || 0;
      const greenPts = parseFloat(r[4]?.v) || 0;
      const redPts = parseFloat(r[5]?.v) || 0;
      const yellowPts = parseFloat(r[6]?.v) || 0;
      matrix.push({
        category,
        gender,
        bluePts,
        greenPts,
        redPts,
        yellowPts,
        totalPts: parseFloat(r[7]?.v) || bluePts + greenPts + redPts + yellowPts,
        leading: r[8]?.v ? String(r[8].v).trim() : "-",
      });
    }
  }
  state.categoryMatrix = matrix;
}

function parseEventsData(table) {
  if (!table || !table.rows) return;
  const events = [];
  const rows = table.rows;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i].c || [];
    const resultId = r[0]?.v ? String(r[0].v).trim() : "";
    const athleteName = r[1]?.v ? String(r[1].v).trim() : "";
    const house = r[2]?.v ? String(r[2].v).trim().toUpperCase() : "";
    const category = r[3]?.v ? String(r[3].v).trim() : "";
    const gender = r[4]?.v ? String(r[4].v).trim() : "";
    const eventName = r[5]?.v ? String(r[5].v).trim() : "";
    const position = r[6]?.v !== undefined && r[6]?.v !== null ? String(r[6].v).trim() : "";
    const points =
      r[7]?.v !== undefined && r[7]?.v !== null
        ? parseFloat(r[7].v)
        : position.startsWith("1")
          ? 5
          : position.startsWith("2")
            ? 3
            : position.startsWith("3")
              ? 1
              : 0;
    const chestNo = r[8]?.v !== undefined && r[8]?.v !== null ? String(r[8].v).trim() : "";

    if (resultId || eventName) {
      events.push({
        resultId: resultId || "EVT-" + String(i).padStart(3, "0"),
        athleteName: athleteName || "TBD",
        house: house || "Unassigned",
        category: category || "-",
        gender: gender || "-",
        eventName: eventName || "Scheduled Event",
        position,
        points,
        chestNo: chestNo || "-",
      });
    }
  }

  state.events = events;

  const totalScoreboardPts = state.houses.reduce((a, h) => a + h.points, 0);
  const eventsWithPoints = events.filter((e) => e.points && e.points > 0);

  if (totalScoreboardPts === 0 && eventsWithPoints.length > 0) {
    const houseAgg = {
      BLUE: { points: 0, gold: 0, silver: 0, bronze: 0 },
      GREEN: { points: 0, gold: 0, silver: 0, bronze: 0 },
      RED: { points: 0, gold: 0, silver: 0, bronze: 0 },
      YELLOW: { points: 0, gold: 0, silver: 0, bronze: 0 },
    };
    events.forEach((e) => {
      if (houseAgg[e.house]) {
        houseAgg[e.house].points += e.points || 0;
        const p = e.position.toLowerCase();
        if (p.startsWith("1")) houseAgg[e.house].gold++;
        else if (p.startsWith("2")) houseAgg[e.house].silver++;
        else if (p.startsWith("3")) houseAgg[e.house].bronze++;
      }
    });
    state.houses = state.houses.map((h) => {
      const agg = houseAgg[h.name] || {};
      return {
        ...h,
        points: agg.points || 0,
        gold: agg.gold || 0,
        silver: agg.silver || 0,
        bronze: agg.bronze || 0,
        totalMedals: (agg.gold || 0) + (agg.silver || 0) + (agg.bronze || 0),
      };
    });
  }

  sortHouseStandings();
}

function sortHouseStandings() {
  state.houses.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    return b.totalMedals - a.totalMedals;
  });
  state.houses.forEach((h, idx) => {
    h.rank = idx + 1;
  });
  if (state.houses.length > 0) {
    const currentLeader = state.houses[0].name;
    if (state.previousLeader && state.previousLeader !== currentLeader && state.houses[0].points > 0) {
      triggerConfetti();
    }
    state.previousLeader = currentLeader;
  }
}

function rankLabel(rank) {
  if (rank === 1) return "1ST PLACE";
  if (rank === 2) return "2ND PLACE";
  if (rank === 3) return "3RD PLACE";
  return "4TH PLACE";
}

function rankShort(rank) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return "4th";
}

function cubeHtml(house, large) {
  const maxPoints = Math.max(...state.houses.map((h) => h.points), 1);
  const minH = large ? 180 : 150;
  const maxH = large ? 360 : 300;
  const height = Math.round(minH + (house.points / maxPoints) * (maxH - minH));
  const cfg = HOUSE_CONFIG[house.name] || {};
  const isFirst = house.rank === 1;
  const rankBadgeClass = isFirst
    ? "badge-gold"
    : "bg-surface2 text-muted border";
  const rankBadgeStyle = isFirst
    ? ""
    : "background:#222;color:#8d8d8d;border:1px solid #2c2c2c";

  return (
    '<div class="cube-graph-card ' +
    (isFirst ? "z-20 -mt-4" : "z-10") +
    '">' +
    '<div class="mb-4 text-center flex flex-col items-center">' +
    '<div class="relative mb-2 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2" style="border-color:' +
    cfg.accent +
    ";color:" +
    cfg.accent +
    ';background:#222">' +
    '<span class="font-display text-lg sm:text-xl font-black">' +
    rankShort(house.rank) +
    "</span>" +
    (isFirst
      ? '<span class="absolute -top-3 -right-2 text-xl animate-bounce" style="color:#ccff00">👑</span>'
      : "") +
    "</div>" +
    '<span class="mb-1 px-2.5 py-1 rounded-full text-sm font-black tracking-wider uppercase ' +
    rankBadgeClass +
    '" style="' +
    rankBadgeStyle +
    '">' +
    rankLabel(house.rank) +
    "</span>" +
    '<h4 class="font-display font-black text-xl sm:text-2xl text-fg uppercase tracking-wide">' +
    house.name +
    "</h4>" +
    '<div class="font-display font-black text-2xl sm:text-3xl tabular-nums mt-1" style="color:#ccff00">' +
    house.points +
    ' <span class="text-sm font-bold text-muted">PTS</span></div>' +
    "</div>" +
    '<div class="cube-3d-wrap cube-' +
    house.name.toLowerCase() +
    '">' +
    '<div class="cube-3d-pillar" style="height:' +
    height +
    'px">' +
    '<div class="cube-face-top"></div>' +
    '<div class="cube-face-front">' +
    '<div class="relative z-10 flex items-center justify-between text-sm font-bold text-white">' +
    '<span class="font-mono" style="color:#ccff00">#' +
    house.rank +
    "</span>" +
    '<span class="uppercase tracking-wider">' +
    house.name +
    "</span></div>" +
    '<div class="relative z-10 my-auto py-2 text-center">' +
    '<div class="font-display font-black text-3xl sm:text-4xl tabular-nums text-white">' +
    house.points +
    "</div>" +
    '<div class="text-sm font-bold tracking-widest text-white/80 uppercase">Points</div></div>' +
    '<div class="relative z-10 grid grid-cols-3 gap-1 border-t border-white/20 pt-2 text-center text-sm font-bold text-white">' +
    "<span>G " +
    house.gold +
    "</span><span>S " +
    house.silver +
    "</span><span>B " +
    house.bronze +
    "</span></div>" +
    "</div>" +
    '<div class="cube-face-side"></div>' +
    "</div>" +
    '<div class="cube-floor-glow"></div>' +
    "</div></div>"
  );
}

function renderPodium() {
  const container = document.getElementById("podium-container");
  if (!container || !state.houses.length) return;
  container.innerHTML = state.houses.map((h) => cubeHtml(h, false)).join("");
}

function renderHouseCards() {
  const container = document.getElementById("house-cards-grid");
  if (!container) return;
  container.innerHTML = state.houses
    .map((house) => {
      const cfg = HOUSE_CONFIG[house.name] || {};
      return (
        '<div class="house-card house-card-' +
        house.name.toLowerCase() +
        ' p-5">' +
        '<div class="flex items-center justify-between mb-3">' +
        "<div><h4 class=\"font-display font-black text-lg text-fg tracking-wide uppercase\">" +
        house.name +
        '</h4><p class="text-sm font-medium text-muted">' +
        house.motto +
        "</p></div>" +
        '<span class="px-3 py-1 rounded-lg bg-bg border font-mono font-black text-sm" style="border-color:#2c2c2c;color:#ccff00">RANK #' +
        house.rank +
        "</span></div>" +
        '<div class="my-3 bg-bg rounded-xl p-3.5 border flex items-baseline justify-between" style="border-color:#2c2c2c">' +
        '<span class="text-base font-semibold text-muted">Championship Score</span>' +
        '<span class="font-display font-black text-3xl tabular-nums text-fg">' +
        house.points +
        '<span class="text-sm text-muted ml-1">pts</span></span></div>' +
        '<div class="grid grid-cols-3 gap-1.5 text-center text-base">' +
        '<div class="bg-bg rounded-lg py-2 border" style="border-color:#2c2c2c"><div class="text-sm font-bold" style="color:#ccff00">Gold</div><div class="font-mono font-bold tabular-nums">' +
        house.gold +
        "</div></div>" +
        '<div class="bg-bg rounded-lg py-2 border" style="border-color:#2c2c2c"><div class="text-sm font-bold text-muted">Silver</div><div class="font-mono font-bold tabular-nums">' +
        house.silver +
        "</div></div>" +
        '<div class="bg-bg rounded-lg py-2 border" style="border-color:#2c2c2c"><div class="text-sm font-bold" style="color:#eab308">Bronze</div><div class="font-mono font-bold tabular-nums">' +
        house.bronze +
        "</div></div></div></div>"
      );
    })
    .join("");
}

function renderProgressBars() {
  const container = document.getElementById("points-progress-bars");
  const label = document.getElementById("highest-score-label");
  if (!container) return;
  const maxPoints = Math.max(...state.houses.map((h) => h.points), 1);
  const leader = state.houses[0];
  const runnerUp = state.houses[1];
  if (label && leader && runnerUp) {
    const diff = leader.points - runnerUp.points;
    label.textContent =
      diff > 0 ? "Leader " + leader.name + " leads by +" + diff + " pts" : "Houses tied for 1st";
  }
  container.innerHTML = state.houses
    .map((house) => {
      const cfg = HOUSE_CONFIG[house.name] || {};
      const percentage = Math.max((house.points / maxPoints) * 100, 4);
      return (
        '<div class="space-y-1.5"><div class="flex items-center justify-between text-base font-semibold">' +
        '<span class="font-display font-bold text-fg uppercase">' +
        house.name +
        " House</span>" +
        '<span class="font-mono font-bold tabular-nums">' +
        house.points +
        " pts</span></div>" +
        '<div class="w-full bg-bg rounded-full h-3.5 p-0.5 border" style="border-color:#2c2c2c">' +
        '<div class="h-full rounded-full transition-all duration-700" style="width:' +
        percentage +
        "%;" +
        cfg.barBg +
        '"></div></div></div>'
      );
    })
    .join("");
}

function renderTicker() {
  const ticker = document.getElementById("results-ticker");
  if (!ticker) return;
  const declared = state.events.filter((e) =>
    ["1", "2", "3", "1st", "2nd", "3rd"].includes(e.position.toLowerCase())
  );
  if (!declared.length) {
    ticker.innerHTML =
      "<span>Hidayathon 2.O in progress · Live results update from the scoring table · Stay tuned for finishes</span>";
    return;
  }
  const items = declared
    .slice(0, 15)
    .map((e) => {
      const place = e.position.startsWith("1") ? "Gold" : e.position.startsWith("2") ? "Silver" : "Bronze";
      return (
        '<span class="inline-flex items-center gap-2 mx-6">' +
        place +
        " · <strong>" +
        e.eventName +
        "</strong> (" +
        e.category +
        " " +
        e.gender +
        ") · " +
        e.athleteName +
        ' · <span class="px-2 py-0.5 text-sm rounded-md font-bold" style="' +
        (HOUSE_CONFIG[e.house]?.bgBadge || "") +
        '">' +
        e.house +
        '</span> · <span class="font-mono font-bold" style="color:#ccff00">+' +
        e.points +
        " pts</span></span>"
      );
    })
    .join("");
  ticker.innerHTML = items + items;
}

function positionLabel(position) {
  if (position.startsWith("1")) return "1st Place";
  if (position.startsWith("2")) return "2nd Place";
  if (position.startsWith("3")) return "3rd Place";
  return position || "Scheduled";
}

function houseBadge(house) {
  const cfg = HOUSE_CONFIG[house];
  return (
    '<span class="px-2.5 py-1 rounded-md text-sm font-black" style="' +
    (cfg?.bgBadge || "background:#222;color:#8d8d8d") +
    '">' +
    house +
    "</span>"
  );
}

function renderEvents() {
  applyEventFilters();
  const cardsContainer = document.getElementById("events-container-cards");
  const tableBody = document.getElementById("events-table-body");
  const countBadge = document.getElementById("events-count-badge");
  const countText = document.getElementById("results-count-text");
  if (countBadge) countBadge.textContent = state.events.length;
  if (countText)
    countText.textContent =
      "Showing " + state.filteredEvents.length + " of " + state.events.length + " events";

  if (cardsContainer) {
    if (!state.filteredEvents.length) {
      cardsContainer.innerHTML =
        '<div class="col-span-full py-12 text-center text-muted bg-surface rounded-2xl border" style="border-color:#2c2c2c"><p class="font-semibold text-base">No event results matching current filters.</p></div>';
    } else {
      cardsContainer.innerHTML = state.filteredEvents
        .map((event) => {
          return (
            '<div class="bg-surface border rounded-2xl p-5 flex flex-col justify-between" style="border-color:#2c2c2c">' +
            '<div><div class="flex items-center justify-between gap-2 mb-3">' +
            '<span class="px-2.5 py-1 rounded bg-bg border text-sm font-mono font-bold text-muted" style="border-color:#2c2c2c">' +
            event.resultId +
            "</span>" +
            houseBadge(event.house) +
            '</div><h4 class="font-display font-black text-lg text-fg mb-1">' +
            event.eventName +
            '</h4><p class="text-base text-muted font-medium mb-4">' +
            event.category +
            " · " +
            event.gender +
            '</p><div class="bg-bg rounded-xl p-3.5 border mb-3 space-y-1.5 text-base" style="border-color:#2c2c2c">' +
            '<div class="flex justify-between"><span class="text-muted">Athlete</span><strong class="text-fg">' +
            event.athleteName +
            '</strong></div><div class="flex justify-between"><span class="text-muted">Chest No</span><span class="font-mono font-bold" style="color:#ccff00">' +
            event.chestNo +
            "</span></div></div></div>" +
            '<div class="pt-3 border-t flex items-center justify-between" style="border-color:#2c2c2c">' +
            '<span class="text-base font-bold" style="color:#ccff00">' +
            positionLabel(event.position) +
            '</span><span class="px-3 py-1 rounded-lg text-base font-mono font-black" style="background:rgba(204,255,0,0.15);border:1px solid rgba(204,255,0,0.3);color:#ccff00">+' +
            event.points +
            " PTS</span></div></div>"
          );
        })
        .join("");
    }
  }

  if (tableBody) {
    if (!state.filteredEvents.length) {
      tableBody.innerHTML =
        '<tr><td colspan="8" class="text-center py-8 text-muted font-medium">No events found matching criteria.</td></tr>';
    } else {
      tableBody.innerHTML = state.filteredEvents
        .map((e) => {
          return (
            '<tr class="hover:bg-surface2">' +
            '<td class="py-3.5 px-4 font-mono text-muted text-base">' +
            e.resultId +
            '</td><td class="py-3.5 px-4 font-bold text-fg">' +
            e.eventName +
            '</td><td class="py-3.5 px-4 text-muted">' +
            e.category +
            " (" +
            e.gender +
            ')</td><td class="py-3.5 px-4 font-bold">' +
            e.athleteName +
            '</td><td class="py-3.5 px-4 font-mono font-bold" style="color:#ccff00">' +
            e.chestNo +
            '</td><td class="py-3.5 px-4">' +
            houseBadge(e.house) +
            '</td><td class="py-3.5 px-4 text-center font-bold" style="color:#ccff00">' +
            positionLabel(e.position) +
            '</td><td class="py-3.5 px-4 text-right font-mono font-bold" style="color:#ccff00">+' +
            e.points +
            "</td></tr>"
          );
        })
        .join("");
    }
  }
}

function applyEventFilters() {
  const searchQuery = (document.getElementById("event-search-input")?.value || "").toLowerCase().trim();
  const filterHouse = document.getElementById("filter-house")?.value || "ALL";
  const filterCategory = document.getElementById("filter-category")?.value || "ALL";
  const filterGender = document.getElementById("filter-gender")?.value || "ALL";
  const filterPosition = document.getElementById("filter-position")?.value || "ALL";

  state.filteredEvents = state.events.filter((e) => {
    if (searchQuery) {
      const match =
        e.athleteName.toLowerCase().includes(searchQuery) ||
        e.eventName.toLowerCase().includes(searchQuery) ||
        e.chestNo.toLowerCase().includes(searchQuery) ||
        e.resultId.toLowerCase().includes(searchQuery);
      if (!match) return false;
    }
    if (filterHouse !== "ALL" && e.house !== filterHouse) return false;
    if (filterCategory !== "ALL" && e.category !== filterCategory) return false;
    if (filterGender !== "ALL" && e.gender !== filterGender) return false;
    if (filterPosition !== "ALL") {
      if (filterPosition === "DECLARED") {
        if (!e.position || e.position === "-") return false;
      } else if (!e.position.startsWith(filterPosition)) return false;
    }
    return true;
  });
}

function resetFilters() {
  const s = document.getElementById("event-search-input");
  const h = document.getElementById("filter-house");
  const c = document.getElementById("filter-category");
  const g = document.getElementById("filter-gender");
  const p = document.getElementById("filter-position");
  if (s) s.value = "";
  if (h) h.value = "ALL";
  if (c) c.value = "ALL";
  if (g) g.value = "ALL";
  if (p) p.value = "ALL";
  renderEvents();
}
window.resetFilters = resetFilters;

let matrixGenderFilter = "ALL";

function renderMatrix() {
  const tbody = document.getElementById("matrix-table-body");
  if (!tbody) return;
  if (!state.categoryMatrix.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center py-6 text-muted font-medium">Category matrix data syncing…</td></tr>';
    return;
  }
  const filtered = state.categoryMatrix.filter((row) => {
    if (row.category.toUpperCase().includes("TOTAL")) return true;
    if (matrixGenderFilter === "BOYS") return row.gender.toLowerCase() === "boys";
    if (matrixGenderFilter === "GIRLS") return row.gender.toLowerCase() === "girls";
    return true;
  });
  tbody.innerHTML = filtered
    .map((row) => {
      const isTotal = row.category.toUpperCase().includes("TOTAL");
      return (
        '<tr class="' +
        (isTotal ? "bg-bg font-black" : "hover:bg-surface2") +
        '" style="' +
        (isTotal ? "color:#ccff00" : "") +
        '">' +
        '<td class="py-3.5 px-4 font-bold">' +
        row.category +
        '</td><td class="py-3.5 px-4 text-muted">' +
        row.gender +
        '</td><td class="py-3.5 px-4 text-center font-mono font-bold tabular-nums text-blue-400" style="background:rgba(59,130,246,0.1)">' +
        row.bluePts +
        '</td><td class="py-3.5 px-4 text-center font-mono font-bold tabular-nums text-green-400" style="background:rgba(34,197,94,0.1)">' +
        row.greenPts +
        '</td><td class="py-3.5 px-4 text-center font-mono font-bold tabular-nums text-red-400" style="background:rgba(239,68,68,0.1)">' +
        row.redPts +
        '</td><td class="py-3.5 px-4 text-center font-mono font-bold tabular-nums text-yellow-400" style="background:rgba(234,179,8,0.1)">' +
        row.yellowPts +
        '</td><td class="py-3.5 px-4 text-center font-mono font-black tabular-nums">' +
        row.totalPts +
        '</td><td class="py-3.5 px-4 text-center">' +
        (row.leading && row.leading !== "-"
          ? houseBadge(String(row.leading).toUpperCase())
          : '<span class="text-muted">—</span>') +
        "</td></tr>"
      );
    })
    .join("");
}

function renderStadiumOverlay() {
  const container = document.getElementById("stadium-podium-container");
  if (!container || !state.houses.length) return;
  container.innerHTML = state.houses.map((h) => cubeHtml(h, true)).join("");
}

function renderAll() {
  renderPodium();
  renderHouseCards();
  renderProgressBars();
  renderTicker();
  renderEvents();
  renderMatrix();
  renderStadiumOverlay();
  updateSyncTimestamp();
}

async function syncLiveData() {
  if (state.isSyncing) return;
  state.isSyncing = true;
  const syncIcon = document.getElementById("sync-icon");
  if (syncIcon) syncIcon.classList.add("fa-spin");
  try {
    const [scoreboardTable, eventsTable] = await Promise.all([
      fetchSheetJSONP(GID_SCOREBOARD),
      fetchSheetJSONP(GID_EVENTS),
    ]);
    parseScoreboardData(scoreboardTable);
    parseEventsData(eventsTable);
    state.lastUpdated = new Date();
    renderAll();
    try {
      localStorage.setItem(
        "hidayathon_cache_v2",
        JSON.stringify({
          houses: state.houses,
          events: state.events,
          matrix: state.categoryMatrix,
          time: state.lastUpdated.getTime(),
        })
      );
    } catch (e) {}
  } catch (error) {
    console.warn("Live sync error, loading cache:", error);
    loadCache();
  } finally {
    state.isSyncing = false;
    state.countdown = REFRESH_INTERVAL_SEC;
    if (syncIcon) syncIcon.classList.remove("fa-spin");
  }
}

function loadCache() {
  try {
    const cached = localStorage.getItem("hidayathon_cache_v2");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.houses) state.houses = parsed.houses;
      if (parsed.events) state.events = parsed.events;
      if (parsed.matrix) state.categoryMatrix = parsed.matrix;
      renderAll();
    }
  } catch (e) {}
}

function startAutoRefresh() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.countdown = REFRESH_INTERVAL_SEC;
  state.timerInterval = setInterval(() => {
    state.countdown--;
    const timerElem = document.getElementById("countdown-timer");
    if (timerElem) timerElem.textContent = state.countdown + "s";
    if (state.countdown <= 0) syncLiveData();
  }, 1000);
}

function updateSyncTimestamp() {
  const elem = document.getElementById("last-updated-text");
  if (!elem) return;
  if (state.lastUpdated) {
    elem.textContent =
      "Last synced at " +
      state.lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } else {
    elem.textContent = "Synced just now";
  }
}

function triggerConfetti() {
  if (typeof confetti === "function") {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCache();
  syncLiveData();
  startAutoRefresh();

  document.getElementById("refresh-btn")?.addEventListener("click", () => syncLiveData());
  document.getElementById("event-search-input")?.addEventListener("input", renderEvents);
  document.getElementById("filter-house")?.addEventListener("change", renderEvents);
  document.getElementById("filter-category")?.addEventListener("change", renderEvents);
  document.getElementById("filter-gender")?.addEventListener("change", renderEvents);
  document.getElementById("filter-position")?.addEventListener("change", renderEvents);
  document.getElementById("reset-filters-btn")?.addEventListener("click", resetFilters);

  const viewCardBtn = document.getElementById("view-card-btn");
  const viewTableBtn = document.getElementById("view-table-btn");
  const cardsContainer = document.getElementById("events-container-cards");
  const tableContainer = document.getElementById("events-container-table");

  viewCardBtn?.addEventListener("click", () => {
    viewCardBtn.style.background = "#222";
    viewCardBtn.style.color = "#ccff00";
    viewTableBtn.style.background = "transparent";
    viewTableBtn.style.color = "";
    viewTableBtn.classList.add("text-muted");
    cardsContainer?.classList.remove("hidden");
    tableContainer?.classList.add("hidden");
  });

  viewTableBtn?.addEventListener("click", () => {
    viewTableBtn.style.background = "#222";
    viewTableBtn.style.color = "#ccff00";
    viewCardBtn.style.background = "transparent";
    viewCardBtn.style.color = "";
    viewCardBtn.classList.add("text-muted");
    tableContainer?.classList.remove("hidden");
    cardsContainer?.classList.add("hidden");
  });

  const tabEventsBtn = document.getElementById("tab-events-btn");
  const tabMatrixBtn = document.getElementById("tab-matrix-btn");
  const tabDashboardBtn = document.getElementById("tab-dashboard-link-btn");
  const contentEvents = document.getElementById("events-tab-content");
  const contentMatrix = document.getElementById("matrix-tab-content");
  const contentDashboard = document.getElementById("dashboard-tab-content");

  function switchTab(activeBtn, activeContent) {
    [tabEventsBtn, tabMatrixBtn, tabDashboardBtn].forEach((btn) => {
      if (!btn) return;
      btn.style.borderColor = "transparent";
      btn.style.color = "";
      btn.classList.add("text-muted");
      btn.classList.remove("text-primary");
    });
    [contentEvents, contentMatrix, contentDashboard].forEach((c) => c?.classList.add("hidden"));
    if (activeBtn) {
      activeBtn.style.borderColor = "#ccff00";
      activeBtn.style.color = "#ccff00";
      activeBtn.classList.remove("text-muted");
    }
    activeContent?.classList.remove("hidden");
  }

  tabEventsBtn?.addEventListener("click", () => switchTab(tabEventsBtn, contentEvents));
  tabMatrixBtn?.addEventListener("click", () => switchTab(tabMatrixBtn, contentMatrix));
  tabDashboardBtn?.addEventListener("click", () => switchTab(tabDashboardBtn, contentDashboard));

  const matrixAllBtn = document.getElementById("matrix-gender-all");
  const matrixBoysBtn = document.getElementById("matrix-gender-boys");
  const matrixGirlsBtn = document.getElementById("matrix-gender-girls");

  function setMatrixGender(filter, activeBtn) {
    matrixGenderFilter = filter;
    [matrixAllBtn, matrixBoysBtn, matrixGirlsBtn].forEach((b) => {
      if (!b) return;
      b.style.background = "transparent";
      b.style.color = "";
      b.classList.add("text-muted");
    });
    if (activeBtn) {
      activeBtn.style.background = "#ccff00";
      activeBtn.style.color = "#111";
      activeBtn.classList.remove("text-muted");
    }
    renderMatrix();
  }

  matrixAllBtn?.addEventListener("click", () => setMatrixGender("ALL", matrixAllBtn));
  matrixBoysBtn?.addEventListener("click", () => setMatrixGender("BOYS", matrixBoysBtn));
  matrixGirlsBtn?.addEventListener("click", () => setMatrixGender("GIRLS", matrixGirlsBtn));

  const stadiumBtn = document.getElementById("stadium-btn");
  const stadiumOverlay = document.getElementById("stadium-overlay");
  const closeStadiumBtn = document.getElementById("close-stadium-btn");

  stadiumBtn?.addEventListener("click", () => {
    stadiumOverlay?.classList.remove("hidden");
    stadiumOverlay?.classList.add("flex");
    renderStadiumOverlay();
    document.documentElement.requestFullscreen?.().catch(() => {});
  });

  closeStadiumBtn?.addEventListener("click", () => {
    stadiumOverlay?.classList.add("hidden");
    stadiumOverlay?.classList.remove("flex");
    document.exitFullscreen?.().catch(() => {});
  });

  document.addEventListener("keydown", (e) => {
    if ((e.key === "f" || e.key === "F") && document.activeElement?.tagName !== "INPUT") {
      stadiumBtn?.click();
    } else if (e.key === "Escape") {
      closeStadiumBtn?.click();
      document.getElementById("share-modal")?.classList.add("hidden");
      document.getElementById("share-modal")?.classList.remove("flex");
    }
  });

  const shareBtn = document.getElementById("share-btn");
  const shareModal = document.getElementById("share-modal");
  const closeShareModal = document.getElementById("close-share-modal");
  const shareUrlInput = document.getElementById("share-url-input");
  const copyShareUrlBtn = document.getElementById("copy-share-url-btn");
  const whatsappShareBtn = document.getElementById("whatsapp-share-btn");

  shareBtn?.addEventListener("click", () => {
    const url = window.location.href;
    if (shareUrlInput) shareUrlInput.value = url;
    if (whatsappShareBtn) {
      const msg = encodeURIComponent("Hidayathon 2.O Live Results & Standings!\n" + url);
      whatsappShareBtn.href = "https://api.whatsapp.com/send?text=" + msg;
    }
    shareModal?.classList.remove("hidden");
    shareModal?.classList.add("flex");
  });

  closeShareModal?.addEventListener("click", () => {
    shareModal?.classList.add("hidden");
    shareModal?.classList.remove("flex");
  });

  copyShareUrlBtn?.addEventListener("click", () => {
    if (shareUrlInput) {
      navigator.clipboard.writeText(shareUrlInput.value);
      copyShareUrlBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      setTimeout(() => {
        copyShareUrlBtn.innerHTML = '<i class="fa-solid fa-copy"></i> <span>Copy</span>';
      }, 2000);
    }
  });
});
