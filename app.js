/**
 * HIDAYATHON 2.O LIVE SPORTS MEET 2026 - 27
 * Real-Time Google Sheets Sync & Podium Dashboard Engine
 */

const SPREADSHEET_ID = "1rRUeY6iOaWIT7OPGMbJG6JnrYv7nOwUPiB8tHmOTep8";
const GID_SCOREBOARD = "0";
const GID_EVENTS = "427537611";
const REFRESH_INTERVAL_SEC = 15;

// State management
let state = {
  houses: [
    { name: 'BLUE', fullName: 'Blue House', color: 'blue', rank: 1, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: 'Valiant Titans' },
    { name: 'GREEN', fullName: 'Green House', color: 'green', rank: 2, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: 'Fierce Falcons' },
    { name: 'RED', fullName: 'Red House', color: 'red', rank: 3, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: 'Blazing Warriors' },
    { name: 'YELLOW', fullName: 'Yellow House', color: 'yellow', rank: 4, points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, motto: 'Golden Knights' },
  ],
  previousLeader: null,
  categoryMatrix: [],
  events: [],
  filteredEvents: [],
  currentView: 'cards', // 'cards' or 'table'
  lastUpdated: null,
  countdown: REFRESH_INTERVAL_SEC,
  timerInterval: null,
  isSyncing: false,
};

// House color configurations
const HOUSE_CONFIG = {
  BLUE: {
    name: 'Blue House',
    bgBadge: 'bg-blue-600/20 text-blue-400 border-blue-500/40',
    border: 'border-blue-500',
    barBg: 'bg-blue-600',
    text: 'text-blue-400',
    icon: 'fa-water',
    accent: '#2563eb'
  },
  GREEN: {
    name: 'Green House',
    bgBadge: 'bg-green-600/20 text-green-400 border-green-500/40',
    border: 'border-green-500',
    barBg: 'bg-green-600',
    text: 'text-green-400',
    icon: 'fa-clover',
    accent: '#16a34a'
  },
  RED: {
    name: 'Red House',
    bgBadge: 'bg-red-600/20 text-red-400 border-red-500/40',
    border: 'border-red-500',
    barBg: 'bg-red-600',
    text: 'text-red-400',
    icon: 'fa-fire',
    accent: '#dc2626'
  },
  YELLOW: {
    name: 'Yellow House',
    bgBadge: 'bg-amber-600/20 text-yellow-300 border-amber-500/40',
    border: 'border-amber-500',
    barBg: 'bg-amber-500',
    text: 'text-yellow-300',
    icon: 'fa-sun',
    accent: '#d97706'
  }
};

// -------------------------------------------------------------
// JSONP Google Sheet Data Fetcher
// -------------------------------------------------------------
function fetchSheetJSONP(gid) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gvizCallback_' + Math.floor(Math.random() * 10000000);
    const script = document.createElement('script');
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout fetching sheet gid=${gid}`));
    }, 12000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(response) {
      cleanup();
      if (response && response.table) {
        resolve(response.table);
      } else {
        reject(new Error(`Invalid response structure for gid=${gid}`));
      }
    };

    script.src = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&gid=${gid}&_t=${Date.now()}`;
    script.onerror = function() {
      cleanup();
      reject(new Error(`Network error loading script for gid=${gid}`));
    };

    document.body.appendChild(script);
  });
}

// -------------------------------------------------------------
// Data Parsing
// -------------------------------------------------------------
function parseScoreboardData(table) {
  if (!table || !table.rows) return;

  const rows = table.rows;
  
  // Rows 6 to 9 represent the 4 houses in the standings table
  // Columns: [0: None, 1: Rank, 2: House, 3: Gold, 4: Silver, 5: Bronze, 6: Total Medals, 7: Total Points]
  const parsedHouses = {};
  
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].c || [];
    const cell2 = r[2] ? String(r[2].v || '').trim().toUpperCase() : '';
    
    if (['BLUE', 'GREEN', 'RED', 'YELLOW'].includes(cell2)) {
      const rank = parseInt(r[1]?.v) || 0;
      const gold = parseInt(r[3]?.v) || 0;
      const silver = parseInt(r[4]?.v) || 0;
      const bronze = parseInt(r[5]?.v) || 0;
      const totalMedals = parseInt(r[6]?.v) || (gold + silver + bronze);
      const points = parseFloat(r[7]?.v) || 0;
      
      parsedHouses[cell2] = {
        name: cell2,
        fullName: HOUSE_CONFIG[cell2]?.name || `${cell2} House`,
        rank: rank,
        points: points,
        gold: gold,
        silver: silver,
        bronze: bronze,
        totalMedals: totalMedals
      };
    }
  }

  // Update state houses if parsed successfully
  if (Object.keys(parsedHouses).length === 4) {
    state.houses = state.houses.map(h => ({
      ...h,
      ...(parsedHouses[h.name] || {})
    }));
  }

  // Parse Category & Gender Points Matrix (Rows 12 to 22)
  const matrix = [];
  for (let i = 11; i < rows.length; i++) {
    const r = rows[i].c || [];
    const category = r[1]?.v ? String(r[1].v).trim() : '';
    const gender = r[2]?.v ? String(r[2].v).trim() : '';
    
    if (category && gender && category !== 'Category') {
      const bluePts = parseFloat(r[3]?.v) || 0;
      const greenPts = parseFloat(r[4]?.v) || 0;
      const redPts = parseFloat(r[5]?.v) || 0;
      const yellowPts = parseFloat(r[6]?.v) || 0;
      const totalPts = parseFloat(r[7]?.v) || (bluePts + greenPts + redPts + yellowPts);
      const leading = r[8]?.v ? String(r[8].v).trim() : '-';

      matrix.push({
        category,
        gender,
        bluePts,
        greenPts,
        redPts,
        yellowPts,
        totalPts,
        leading
      });
    }
  }
  state.categoryMatrix = matrix;
}

function parseEventsData(table) {
  if (!table || !table.rows) return;

  const events = [];
  const rows = table.rows;

  // Row 0 is header: Result ID, Athlete Name, House, Category, Gender, Event, Position, Points, Chest No
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i].c || [];
    const resultId = r[0]?.v ? String(r[0].v).trim() : '';
    const athleteName = r[1]?.v ? String(r[1].v).trim() : '';
    const house = r[2]?.v ? String(r[2].v).trim().toUpperCase() : '';
    const category = r[3]?.v ? String(r[3].v).trim() : '';
    const gender = r[4]?.v ? String(r[4].v).trim() : '';
    const eventName = r[5]?.v ? String(r[5].v).trim() : '';
    const position = r[6]?.v !== undefined && r[6]?.v !== null ? String(r[6].v).trim() : '';
    const points = r[7]?.v !== undefined && r[7]?.v !== null ? parseFloat(r[7].v) : null;
    const chestNo = r[8]?.v !== undefined && r[8]?.v !== null ? String(r[8].v).trim() : '';

    if (resultId || eventName) {
      events.push({
        resultId: resultId || `EVT-${String(i).padStart(3, '0')}`,
        athleteName: athleteName || 'TBD',
        house: house || 'Unassigned',
        category: category || '-',
        gender: gender || '-',
        eventName: eventName || 'Scheduled Event',
        position: position,
        points: points !== null ? points : (position === '1' ? 5 : position === '2' ? 3 : position === '3' ? 1 : 0),
        chestNo: chestNo || '-'
      });
    }
  }

  state.events = events;

  // Cross-check: If Scoreboard points are all 0 but Event_Results has points entered,
  // dynamically calculate standings from Event_Results as a fallback!
  const totalScoreboardPts = state.houses.reduce((acc, h) => acc + h.points, 0);
  const eventsWithPoints = events.filter(e => e.points && e.points > 0);

  if (totalScoreboardPts === 0 && eventsWithPoints.length > 0) {
    console.log("Dynamically aggregating house points from Event_Results...");
    const houseAgg = {
      BLUE: { points: 0, gold: 0, silver: 0, bronze: 0 },
      GREEN: { points: 0, gold: 0, silver: 0, bronze: 0 },
      RED: { points: 0, gold: 0, silver: 0, bronze: 0 },
      YELLOW: { points: 0, gold: 0, silver: 0, bronze: 0 }
    };

    events.forEach(e => {
      if (houseAgg[e.house]) {
        houseAgg[e.house].points += (e.points || 0);
        if (e.position === '1' || e.position.toLowerCase().includes('1st')) houseAgg[e.house].gold++;
        else if (e.position === '2' || e.position.toLowerCase().includes('2nd')) houseAgg[e.house].silver++;
        else if (e.position === '3' || e.position.toLowerCase().includes('3rd')) houseAgg[e.house].bronze++;
      }
    });

    state.houses = state.houses.map(h => {
      const agg = houseAgg[h.name] || {};
      return {
        ...h,
        points: agg.points || 0,
        gold: agg.gold || 0,
        silver: agg.silver || 0,
        bronze: agg.bronze || 0,
        totalMedals: (agg.gold || 0) + (agg.silver || 0) + (agg.bronze || 0)
      };
    });
  }

  // Sort houses by points descending (then gold medals, then total medals)
  sortHouseStandings();
}

function sortHouseStandings() {
  state.houses.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    return b.totalMedals - a.totalMedals;
  });

  // Assign ranks
  state.houses.forEach((h, idx) => {
    h.rank = idx + 1;
  });

  // Confetti trigger when leader changes!
  if (state.houses.length > 0) {
    const currentLeader = state.houses[0].name;
    if (state.previousLeader && state.previousLeader !== currentLeader && state.houses[0].points > 0) {
      triggerConfetti();
    }
    state.previousLeader = currentLeader;
  }
}

// -------------------------------------------------------------
// UI Renderers
// -------------------------------------------------------------
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

// 1. Olympic Podium Renderer
function renderPodium() {
  const container = document.getElementById('podium-container');
  if (!container || state.houses.length < 3) return;

  const h1 = state.houses[0]; // 1st Place
  const h2 = state.houses[1]; // 2nd Place
  const h3 = state.houses[2]; // 3rd Place

  // Podium order visually: 2nd place (left), 1st place (center elevated), 3rd place (right)
  const podiumOrder = [
    { house: h2, rank: 2, height: 'h-48 sm:h-64', medal: '🥈', badge: 'badge-silver', title: '2ND PLACE' },
    { house: h1, rank: 1, height: 'h-64 sm:h-80', medal: '🥇', badge: 'badge-gold', title: 'CHAMPION / 1ST' },
    { house: h3, rank: 3, height: 'h-40 sm:h-52', medal: '🥉', badge: 'badge-bronze', title: '3RD PLACE' }
  ];

  container.innerHTML = podiumOrder.map(item => {
    const cfg = HOUSE_CONFIG[item.house.name] || {};
    const isFirst = item.rank === 1;

    return `
      <div class="flex flex-col items-center justify-end ${isFirst ? '-mt-6 z-20' : 'z-10'}">
        <!-- Floating House Trophy / Crest -->
        <div class="mb-3 text-center transition-transform duration-300 hover:scale-105">
          <div class="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl ${cfg.bgBadge} border-2 ${cfg.border} shadow-lg shadow-${cfg.accent}/30 mb-2 relative">
            <span class="text-2xl sm:text-3xl">${item.medal}</span>
            ${isFirst ? '<span class="absolute -top-3 -right-2 text-xl animate-bounce">👑</span>' : ''}
          </div>
          <h4 class="font-display font-black text-sm sm:text-lg text-white uppercase tracking-wide">
            ${item.house.name}
          </h4>
          <div class="text-xs sm:text-sm font-black font-mono text-amber-300">
            ${item.house.points} <span class="text-[10px] text-slate-400 font-sans font-semibold">PTS</span>
          </div>
        </div>

        <!-- 3D Podium Pedestal Block -->
        <div class="w-full ${item.height} podium-pedestal podium-${item.rank} flex flex-col items-center justify-between p-3 sm:p-5 text-center">
          <div class="pt-1">
            <span class="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase ${item.badge} shadow-md">
              ${item.title}
            </span>
          </div>

          <div class="font-display font-black text-4xl sm:text-6xl text-white/30 tracking-tighter">
            #${item.rank}
          </div>

          <!-- Medal Counters -->
          <div class="w-full pt-2 border-t border-slate-700/60 flex items-center justify-around text-[10px] sm:text-xs text-slate-300">
            <span title="Gold Medals">🥇 <strong>${item.house.gold}</strong></span>
            <span title="Silver Medals">🥈 <strong>${item.house.silver}</strong></span>
            <span title="Bronze Medals">🥉 <strong>${item.house.bronze}</strong></span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 2. House Summary Cards
function renderHouseCards() {
  const container = document.getElementById('house-cards-grid');
  if (!container) return;

  container.innerHTML = state.houses.map(house => {
    const cfg = HOUSE_CONFIG[house.name] || {};
    const cardClass = `house-card-${house.name.toLowerCase()}`;

    return `
      <div class="house-card ${cardClass} border rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <!-- Header: Rank badge & House Name -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl ${cfg.bgBadge} border flex items-center justify-center font-bold text-base">
                <i class="fa-solid ${cfg.icon}"></i>
              </div>
              <div>
                <h4 class="font-display font-black text-lg text-white tracking-wide uppercase">
                  ${house.name}
                </h4>
                <p class="text-[11px] text-slate-400 font-medium">${house.motto}</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-700 font-mono font-black text-xs ${house.rank === 1 ? 'text-amber-400 border-amber-500/50' : 'text-slate-300'}">
              RANK #${house.rank}
            </span>
          </div>

          <!-- Total Points Display -->
          <div class="my-4 bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/80 flex items-baseline justify-between">
            <span class="text-xs font-semibold text-slate-400">Championship Score</span>
            <div class="text-right">
              <span class="font-display font-black text-3xl text-white font-mono tracking-tight">${house.points}</span>
              <span class="text-xs font-bold text-slate-400 ml-1">pts</span>
            </div>
          </div>
        </div>

        <!-- Medals Tally -->
        <div class="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-center text-xs">
          <div class="bg-slate-950/40 rounded-lg py-1.5 px-1 border border-slate-800/50">
            <div class="text-amber-400 text-xs font-bold">🥇 Gold</div>
            <div class="font-mono font-bold text-sm text-slate-200 mt-0.5">${house.gold}</div>
          </div>
          <div class="bg-slate-950/40 rounded-lg py-1.5 px-1 border border-slate-800/50">
            <div class="text-slate-300 text-xs font-bold">🥈 Silver</div>
            <div class="font-mono font-bold text-sm text-slate-200 mt-0.5">${house.silver}</div>
          </div>
          <div class="bg-slate-950/40 rounded-lg py-1.5 px-1 border border-slate-800/50">
            <div class="text-amber-600 text-xs font-bold">🥉 Bronze</div>
            <div class="font-mono font-bold text-sm text-slate-200 mt-0.5">${house.bronze}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 3. Progress Bars Comparison
function renderProgressBars() {
  const container = document.getElementById('points-progress-bars');
  const label = document.getElementById('highest-score-label');
  if (!container) return;

  const maxPoints = Math.max(...state.houses.map(h => h.points), 1);
  const leader = state.houses[0];
  const runnerUp = state.houses[1];

  if (label && leader && runnerUp) {
    const diff = leader.points - runnerUp.points;
    label.textContent = diff > 0 
      ? `Leader ${leader.name} leads by +${diff} pts` 
      : 'All houses tied for 1st place';
  }

  container.innerHTML = state.houses.map(house => {
    const cfg = HOUSE_CONFIG[house.name] || {};
    const percentage = Math.max((house.points / maxPoints) * 100, 4);

    return `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs font-semibold">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full ${cfg.barBg}"></span>
            <span class="text-slate-200 font-display font-bold uppercase">${house.name} HOUSE</span>
          </div>
          <span class="font-mono text-slate-300 font-bold">${house.points} pts</span>
        </div>
        <div class="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800">
          <div class="${cfg.barBg} h-full rounded-full transition-all duration-700 shadow-sm" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// 4. Live Results Marquee Ticker
function renderTicker() {
  const ticker = document.getElementById('results-ticker');
  if (!ticker) return;

  const declaredEvents = state.events.filter(e => e.position && ['1', '2', '3', '1st', '2nd', '3rd'].includes(e.position.toLowerCase()));

  if (declaredEvents.length === 0) {
    ticker.innerHTML = `
      <span>🏃‍♂️ Hidayathon 2.O Annual Sports Meet in progress &bull; Live results updating directly from scoring table &bull; Stay tuned for upcoming race and field finishes!</span>
    `;
    return;
  }

  const items = declaredEvents.slice(0, 15).map(e => {
    const medal = e.position.startsWith('1') ? '🥇' : e.position.startsWith('2') ? '🥈' : '🥉';
    const cfg = HOUSE_CONFIG[e.house] || {};
    return `
      <span class="inline-flex items-center gap-1.5 mx-4">
        <span>${medal}</span>
        <strong class="text-white">${e.eventName} (${e.category} ${e.gender}):</strong>
        <span class="text-slate-200">${e.athleteName}</span>
        <span class="px-1.5 py-0.2 text-[10px] rounded font-bold ${cfg.bgBadge || 'bg-slate-800 text-slate-300'}">${e.house}</span>
        <span class="text-amber-400 font-mono font-bold">+${e.points} pts</span>
      </span>
    `;
  }).join('&bull;');

  ticker.innerHTML = items + ' &bull; ' + items; // Duplicate for smooth looping
}

// 5. Live Events Filter & Renderer
function renderEvents() {
  applyEventFilters();

  const cardsContainer = document.getElementById('events-container-cards');
  const tableBody = document.getElementById('events-table-body');
  const countBadge = document.getElementById('events-count-badge');
  const countText = document.getElementById('results-count-text');

  if (countBadge) countBadge.textContent = state.events.length;
  if (countText) countText.textContent = `Showing ${state.filteredEvents.length} of ${state.events.length} events`;

  // Render Cards
  if (cardsContainer) {
    if (state.filteredEvents.length === 0) {
      cardsContainer.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
          <i class="fa-solid fa-person-running text-3xl mb-3 text-slate-600"></i>
          <p class="font-semibold text-sm">No event results matching current filters.</p>
          <button onclick="resetFilters()" class="mt-3 text-xs text-amber-400 hover:underline">Reset filters</button>
        </div>
      `;
    } else {
      cardsContainer.innerHTML = state.filteredEvents.map(event => {
        const cfg = HOUSE_CONFIG[event.house] || {};
        const isPodium = ['1', '2', '3', '1st', '2nd', '3rd'].includes(event.position.toLowerCase());
        const medal = event.position.startsWith('1') ? '🥇 1st Place' : 
                      event.position.startsWith('2') ? '🥈 2nd Place' : 
                      event.position.startsWith('3') ? '🥉 3rd Place' : 
                      event.position ? `Pos: ${event.position}` : 'Scheduled';

        return `
          <div class="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all hover:-translate-y-1 shadow-md flex flex-col justify-between">
            <div>
              <!-- Event Header -->
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                  ${event.resultId}
                </span>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cfg.bgBadge || 'bg-slate-800 text-slate-300 border border-slate-700'}">
                  ${event.house}
                </span>
              </div>

              <!-- Event Name & Division -->
              <h4 class="font-display font-bold text-base text-white mb-1">
                ${event.eventName}
              </h4>
              <p class="text-xs text-slate-400 font-medium mb-4">
                ${event.category} &bull; ${event.gender}
              </p>

              <!-- Athlete & Chest No -->
              <div class="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 mb-3 space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-400">Athlete:</span>
                  <strong class="text-slate-100 font-semibold">${event.athleteName}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-400">Chest No:</span>
                  <span class="font-mono text-amber-400 font-bold">${event.chestNo}</span>
                </div>
              </div>
            </div>

            <!-- Footer: Position & Points -->
            <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span class="text-xs font-bold ${isPodium ? 'text-amber-300' : 'text-slate-400'}">
                ${medal}
              </span>
              <span class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-black text-xs">
                +${event.points} PTS
              </span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Table
  if (tableBody) {
    if (state.filteredEvents.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-500">No events found matching criteria.</td></tr>`;
    } else {
      tableBody.innerHTML = state.filteredEvents.map(e => {
        const cfg = HOUSE_CONFIG[e.house] || {};
        const medal = e.position.startsWith('1') ? '🥇 1st' : 
                      e.position.startsWith('2') ? '🥈 2nd' : 
                      e.position.startsWith('3') ? '🥉 3rd' : 
                      e.position || '-';

        return `
          <tr class="hover:bg-slate-800/40 transition-colors">
            <td class="py-3 px-4 font-mono text-slate-400 text-xs">${e.resultId}</td>
            <td class="py-3 px-4 font-bold text-white">${e.eventName}</td>
            <td class="py-3 px-4 text-slate-300">${e.category} (${e.gender})</td>
            <td class="py-3 px-4 text-slate-200 font-semibold">${e.athleteName}</td>
            <td class="py-3 px-4 font-mono text-amber-400 font-bold">${e.chestNo}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bgBadge || 'bg-slate-800 text-slate-300'}">
                ${e.house}
              </span>
            </td>
            <td class="py-3 px-4 text-center font-bold text-amber-300">${medal}</td>
            <td class="py-3 px-4 text-right font-mono font-bold text-amber-400">+${e.points}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

function applyEventFilters() {
  const searchQuery = (document.getElementById('event-search-input')?.value || '').toLowerCase().trim();
  const filterHouse = document.getElementById('filter-house')?.value || 'ALL';
  const filterCategory = document.getElementById('filter-category')?.value || 'ALL';
  const filterGender = document.getElementById('filter-gender')?.value || 'ALL';
  const filterPosition = document.getElementById('filter-position')?.value || 'ALL';

  state.filteredEvents = state.events.filter(e => {
    // Search query
    if (searchQuery) {
      const matchSearch = e.athleteName.toLowerCase().includes(searchQuery) ||
                          e.eventName.toLowerCase().includes(searchQuery) ||
                          e.chestNo.toLowerCase().includes(searchQuery) ||
                          e.resultId.toLowerCase().includes(searchQuery);
      if (!matchSearch) return false;
    }

    // House
    if (filterHouse !== 'ALL' && e.house !== filterHouse) return false;

    // Category
    if (filterCategory !== 'ALL' && e.category !== filterCategory) return false;

    // Gender
    if (filterGender !== 'ALL' && e.gender !== filterGender) return false;

    // Position
    if (filterPosition !== 'ALL') {
      if (filterPosition === 'DECLARED') {
        if (!e.position || e.position === '-') return false;
      } else {
        if (!e.position.startsWith(filterPosition)) return false;
      }
    }

    return true;
  });
}

function resetFilters() {
  const s = document.getElementById('event-search-input');
  const h = document.getElementById('filter-house');
  const c = document.getElementById('filter-category');
  const g = document.getElementById('filter-gender');
  const p = document.getElementById('filter-position');

  if (s) s.value = '';
  if (h) h.value = 'ALL';
  if (c) c.value = 'ALL';
  if (g) g.value = 'ALL';
  if (p) p.value = 'ALL';

  renderEvents();
}
window.resetFilters = resetFilters;

// 6. Category & Gender Matrix Renderer
let matrixGenderFilter = 'ALL';

function renderMatrix() {
  const tbody = document.getElementById('matrix-table-body');
  if (!tbody) return;

  if (state.categoryMatrix.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">Category matrix data syncing...</td></tr>`;
    return;
  }

  const filteredMatrix = state.categoryMatrix.filter(row => {
    if (row.category.toUpperCase().includes('TOTAL')) return true;
    if (matrixGenderFilter === 'BOYS') return row.gender.toLowerCase() === 'boys';
    if (matrixGenderFilter === 'GIRLS') return row.gender.toLowerCase() === 'girls';
    return true;
  });

  tbody.innerHTML = filteredMatrix.map(row => {
    const isTotal = row.category.toUpperCase().includes('TOTAL');
    const leadingCfg = HOUSE_CONFIG[row.leading] || {};

    return `
      <tr class="${isTotal ? 'bg-slate-950 font-black text-amber-300' : 'hover:bg-slate-800/40'} transition-colors">
        <td class="py-3.5 px-4 font-bold ${isTotal ? 'text-amber-400 font-display text-sm' : 'text-slate-100'}">
          ${row.category}
        </td>
        <td class="py-3.5 px-4 text-slate-400">
          ${row.gender}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-blue-400 bg-blue-950/20 border-x border-slate-800/60">
          ${row.bluePts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-green-400 bg-green-950/20 border-r border-slate-800/60">
          ${row.greenPts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-red-400 bg-red-950/20 border-r border-slate-800/60">
          ${row.redPts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-yellow-400 bg-amber-950/20 border-r border-slate-800/60">
          ${row.yellowPts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-black text-white">
          ${row.totalPts}
        </td>
        <td class="py-3.5 px-4 text-center">
          ${row.leading && row.leading !== '-' ? `
            <span class="px-2 py-0.5 rounded text-[10px] font-black ${leadingCfg.bgBadge || 'bg-slate-800 text-slate-300'}">
              👑 ${row.leading}
            </span>
          ` : '<span class="text-slate-500">-</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// 7. Stadium / TV Screen Mode
function renderStadiumOverlay() {
  const container = document.getElementById('stadium-podium-container');
  if (!container || state.houses.length === 0) return;

  container.innerHTML = state.houses.map(h => {
    const cfg = HOUSE_CONFIG[h.name] || {};
    const isLeader = h.rank === 1;

    return `
      <div class="bg-slate-900 border-2 ${isLeader ? 'border-amber-500 shadow-2xl shadow-amber-500/30 ring-4 ring-amber-500/20' : 'border-slate-800'} rounded-3xl p-6 sm:p-8 flex flex-col justify-between items-center text-center">
        <div>
          <span class="px-4 py-1.5 rounded-full text-sm font-black font-mono tracking-wider ${isLeader ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">
            RANK #${h.rank}
          </span>
          <div class="my-6">
            <i class="fa-solid ${cfg.icon} text-5xl sm:text-6xl ${cfg.text}"></i>
          </div>
          <h2 class="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-wide">
            ${h.name}
          </h2>
          <p class="text-slate-400 text-sm font-semibold mt-1">${h.fullName}</p>
        </div>

        <div class="w-full my-6 py-5 bg-slate-950 rounded-2xl border border-slate-800">
          <span class="text-xs uppercase tracking-wider text-slate-500 block font-bold">Total Points</span>
          <span class="font-display font-black text-5xl sm:text-6xl text-amber-400 font-mono tracking-tight">${h.points}</span>
        </div>

        <div class="w-full grid grid-cols-3 gap-2 text-center text-xs">
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <span class="text-amber-400 block font-bold">🥇</span>
            <strong class="text-white text-base">${h.gold}</strong>
          </div>
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <span class="text-slate-300 block font-bold">🥈</span>
            <strong class="text-white text-base">${h.silver}</strong>
          </div>
          <div class="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <span class="text-amber-600 block font-bold">🥉</span>
            <strong class="text-white text-base">${h.bronze}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Live Sync Engine & Auto-refresh
// -------------------------------------------------------------
async function syncLiveData() {
  if (state.isSyncing) return;
  state.isSyncing = true;

  const syncIcon = document.getElementById('sync-icon');
  if (syncIcon) syncIcon.classList.add('fa-spin');

  try {
    // Parallel fetch of Scoreboard and Event_Results
    const [scoreboardTable, eventsTable] = await Promise.all([
      fetchSheetJSONP(GID_SCOREBOARD),
      fetchSheetJSONP(GID_EVENTS)
    ]);

    parseScoreboardData(scoreboardTable);
    parseEventsData(eventsTable);

    state.lastUpdated = new Date();
    renderAll();

    // Cache locally
    try {
      localStorage.setItem('hidayathon_cache', JSON.stringify({
        houses: state.houses,
        events: state.events,
        matrix: state.categoryMatrix,
        time: state.lastUpdated.getTime()
      }));
    } catch (err) {}

  } catch (error) {
    console.warn("Live sync error, loading from local cache if available:", error);
    loadCache();
  } finally {
    state.isSyncing = false;
    state.countdown = REFRESH_INTERVAL_SEC;
    if (syncIcon) syncIcon.classList.remove('fa-spin');
  }
}

function loadCache() {
  try {
    const cached = localStorage.getItem('hidayathon_cache');
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
    const timerElem = document.getElementById('countdown-timer');
    if (timerElem) timerElem.textContent = `${state.countdown}s`;

    if (state.countdown <= 0) {
      syncLiveData();
    }
  }, 1000);
}

function updateSyncTimestamp() {
  const elem = document.getElementById('last-updated-text');
  if (!elem) return;

  if (state.lastUpdated) {
    const timeStr = state.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    elem.textContent = `Last synced at ${timeStr}`;
  } else {
    elem.textContent = 'Synced just now';
  }
}

// -------------------------------------------------------------
// Interactive Celebration Confetti
// -------------------------------------------------------------
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

// -------------------------------------------------------------
// Event Listeners & UI Binding
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Try loading cache first for instant paint
  loadCache();

  // Initial Sync
  syncLiveData();
  startAutoRefresh();

  // Refresh Button
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    syncLiveData();
  });

  // Search and Filter Listeners
  document.getElementById('event-search-input')?.addEventListener('input', renderEvents);
  document.getElementById('filter-house')?.addEventListener('change', renderEvents);
  document.getElementById('filter-category')?.addEventListener('change', renderEvents);
  document.getElementById('filter-gender')?.addEventListener('change', renderEvents);
  document.getElementById('filter-position')?.addEventListener('change', renderEvents);
  document.getElementById('reset-filters-btn')?.addEventListener('click', resetFilters);

  // View Switcher (Cards / Table)
  const viewCardBtn = document.getElementById('view-card-btn');
  const viewTableBtn = document.getElementById('view-table-btn');
  const cardsContainer = document.getElementById('events-container-cards');
  const tableContainer = document.getElementById('events-container-table');

  viewCardBtn?.addEventListener('click', () => {
    viewCardBtn.classList.add('bg-slate-800', 'text-amber-400');
    viewCardBtn.classList.remove('text-slate-400');
    viewTableBtn.classList.remove('bg-slate-800', 'text-amber-400');
    viewTableBtn.classList.add('text-slate-400');
    cardsContainer.classList.remove('hidden');
    tableContainer.classList.add('hidden');
  });

  viewTableBtn?.addEventListener('click', () => {
    viewTableBtn.classList.add('bg-slate-800', 'text-amber-400');
    viewTableBtn.classList.remove('text-slate-400');
    viewCardBtn.classList.remove('bg-slate-800', 'text-amber-400');
    viewCardBtn.classList.add('text-slate-400');
    tableContainer.classList.remove('hidden');
    cardsContainer.classList.add('hidden');
  });

  // Tab Navigation (Events vs Matrix vs Source)
  const tabEventsBtn = document.getElementById('tab-events-btn');
  const tabMatrixBtn = document.getElementById('tab-matrix-btn');
  const tabDashboardBtn = document.getElementById('tab-dashboard-link-btn');

  const contentEvents = document.getElementById('events-tab-content');
  const contentMatrix = document.getElementById('matrix-tab-content');
  const contentDashboard = document.getElementById('dashboard-tab-content');

  function switchTab(activeBtn, activeContent) {
    [tabEventsBtn, tabMatrixBtn, tabDashboardBtn].forEach(btn => {
      btn.classList.remove('border-amber-500', 'text-amber-400');
      btn.classList.add('border-transparent', 'text-slate-400');
    });
    [contentEvents, contentMatrix, contentDashboard].forEach(cnt => cnt.classList.add('hidden'));

    activeBtn.classList.add('border-amber-500', 'text-amber-400');
    activeBtn.classList.remove('border-transparent', 'text-slate-400');
    activeContent.classList.remove('hidden');
  }

  tabEventsBtn?.addEventListener('click', () => switchTab(tabEventsBtn, contentEvents));
  tabMatrixBtn?.addEventListener('click', () => switchTab(tabMatrixBtn, contentMatrix));
  tabDashboardBtn?.addEventListener('click', () => switchTab(tabDashboardBtn, contentDashboard));

  // Matrix Gender Toggle Buttons
  const matrixAllBtn = document.getElementById('matrix-gender-all');
  const matrixBoysBtn = document.getElementById('matrix-gender-boys');
  const matrixGirlsBtn = document.getElementById('matrix-gender-girls');

  function setMatrixGender(filter, activeBtn) {
    matrixGenderFilter = filter;
    [matrixAllBtn, matrixBoysBtn, matrixGirlsBtn].forEach(b => {
      b?.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
      b?.classList.add('text-slate-400');
    });
    activeBtn?.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
    activeBtn?.classList.remove('text-slate-400');
    renderMatrix();
  }

  matrixAllBtn?.addEventListener('click', () => setMatrixGender('ALL', matrixAllBtn));
  matrixBoysBtn?.addEventListener('click', () => setMatrixGender('BOYS', matrixBoysBtn));
  matrixGirlsBtn?.addEventListener('click', () => setMatrixGender('GIRLS', matrixGirlsBtn));

  // Stadium Mode
  const stadiumBtn = document.getElementById('stadium-btn');
  const stadiumOverlay = document.getElementById('stadium-overlay');
  const closeStadiumBtn = document.getElementById('close-stadium-btn');

  stadiumBtn?.addEventListener('click', () => {
    stadiumOverlay.classList.remove('hidden');
    stadiumOverlay.classList.add('flex');
    renderStadiumOverlay();
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  closeStadiumBtn?.addEventListener('click', () => {
    stadiumOverlay.classList.add('hidden');
    stadiumOverlay.classList.remove('flex');
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Keyboard shortcut 'F' for Stadium mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') {
      if (document.activeElement?.tagName !== 'INPUT') {
        stadiumBtn?.click();
      }
    } else if (e.key === 'Escape') {
      closeStadiumBtn?.click();
    }
  });

  // Share Modal
  const shareBtn = document.getElementById('share-btn');
  const shareModal = document.getElementById('share-modal');
  const closeShareModal = document.getElementById('close-share-modal');
  const shareUrlInput = document.getElementById('share-url-input');
  const copyShareUrlBtn = document.getElementById('copy-share-url-btn');
  const whatsappShareBtn = document.getElementById('whatsapp-share-btn');

  shareBtn?.addEventListener('click', () => {
    const url = window.location.href;
    if (shareUrlInput) shareUrlInput.value = url;
    if (whatsappShareBtn) {
      const leader = state.houses[0]?.name || 'Sports Meet';
      const msg = encodeURIComponent(`🏆 Hidayathon 2.O Live Results & Standings!\nCheck the latest scores: ${url}`);
      whatsappShareBtn.href = `https://api.whatsapp.com/send?text=${msg}`;
    }
    shareModal.classList.remove('hidden');
  });

  closeShareModal?.addEventListener('click', () => {
    shareModal.classList.add('hidden');
  });

  copyShareUrlBtn?.addEventListener('click', () => {
    if (shareUrlInput) {
      navigator.clipboard.writeText(shareUrlInput.value);
      copyShareUrlBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      setTimeout(() => {
        copyShareUrlBtn.innerHTML = '<i class="fa-solid fa-copy"></i> <span>Copy</span>';
      }, 2000);
    }
  });
});
