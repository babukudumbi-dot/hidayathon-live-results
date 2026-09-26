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

// 1. 3D 4-House Cubes Championship Graph Renderer
function renderPodium() {
  const container = document.getElementById('podium-container');
  if (!container || state.houses.length === 0) return;

  // Dynamically calculate heights based on house points
  const maxPoints = Math.max(...state.houses.map(h => h.points), 1);
  const minHeight = 140; // minimum height in px
  const maxHeight = 310; // maximum height in px

  container.innerHTML = state.houses.map(house => {
    const cfg = HOUSE_CONFIG[house.name] || {};
    const isFirst = house.rank === 1;
    const isSecond = house.rank === 2;
    const isThird = house.rank === 3;
    const isFourth = house.rank === 4;

    const cubeColorClass = `cube-${house.name.toLowerCase()}`;
    
    // Scale height proportionally to points (with a base height so 0/low pts still look 3D)
    const heightPx = maxPoints > 0 
      ? Math.round(minHeight + (house.points / maxPoints) * (maxHeight - minHeight))
      : minHeight;

    const rankMedal = isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : '🎖️';
    const rankBadgeClass = isFirst ? 'badge-gold' : isSecond ? 'badge-silver' : isThird ? 'badge-bronze' : 'bg-slate-800 text-slate-300 border border-slate-700';
    const rankTitle = isFirst ? '1ST PLACE' : isSecond ? '2ND PLACE' : isThird ? '3RD PLACE' : '4TH PLACE';

    return `
      <div class="cube-graph-card ${isFirst ? 'z-20 -mt-5' : 'z-10'}">
        <!-- Floating Top Header: Crown/Medal, Rank, House Name, Points -->
        <div class="mb-4 text-center transition-transform duration-300 hover:scale-105 flex flex-col items-center">
          <!-- House Icon / Rank Badge -->
          <div class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${cfg.bgBadge} border-2 ${cfg.border} shadow-xl mb-2 relative">
            <span class="text-2xl sm:text-3xl">${rankMedal}</span>
            ${isFirst ? '<span class="absolute -top-3.5 -right-2 text-2xl animate-bounce" title="Championship Leader">👑</span>' : ''}
          </div>

          <!-- Rank Pill -->
          <div class="mb-1">
            <span class="px-2.5 py-1 rounded-full text-xs font-black tracking-wider uppercase ${rankBadgeClass} shadow-sm">
              ${rankTitle}
            </span>
          </div>

          <!-- House Name -->
          <h4 class="font-display font-black text-lg sm:text-xl text-white uppercase tracking-wide">
            ${house.name}
          </h4>

          <!-- Live Points Counter -->
          <div class="font-display font-black text-2xl sm:text-3xl font-mono text-amber-300 tracking-tight flex items-baseline gap-1 mt-0.5">
            ${house.points} <span class="text-xs text-slate-300 font-sans font-bold">PTS</span>
          </div>
        </div>

        <!-- 3D Isometric Cube Pillar -->
        <div class="cube-3d-wrap ${cubeColorClass}">
          <div class="cube-3d-pillar" style="height: ${heightPx}px;">
            <!-- Top Face (Glossy 3D top surface) -->
            <div class="cube-face-top flex items-center justify-center">
              <span class="w-6 h-1 rounded-full bg-white/40"></span>
            </div>

            <!-- Front Face (Graph surface with scale lines, points, and medals) -->
            <div class="cube-face-front">
              <div class="flex items-center justify-between text-xs font-bold text-white/90">
                <span class="font-mono text-amber-300">#${house.rank}</span>
                <span class="text-xs uppercase tracking-wider text-white/80">${house.name}</span>
              </div>

              <!-- Center Big Points Display -->
              <div class="text-center my-auto py-2">
                <span class="font-display font-black text-3xl sm:text-4xl text-white font-mono tracking-tight drop-shadow-md">
                  ${house.points}
                </span>
                <div class="text-xs font-bold text-white/80 uppercase tracking-widest -mt-1">
                  POINTS
                </div>
              </div>

              <!-- Medal Counter Tally on Front -->
              <div class="pt-2 border-t border-white/20 grid grid-cols-3 gap-1 text-center text-xs font-bold text-white">
                <span title="Gold Medals">🥇 ${house.gold}</span>
                <span title="Silver Medals">🥈 ${house.silver}</span>
                <span title="Bronze Medals">🥉 ${house.bronze}</span>
              </div>
            </div>

            <!-- Side Face (Shaded side for 3D volume) -->
            <div class="cube-face-side"></div>
          </div>

          <!-- 3D Ambient Floor Glow -->
          <div class="cube-floor-glow"></div>
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
              <div class="w-10 h-10 rounded-xl ${cfg.bgBadge} border flex items-center justify-center font-bold text-base shadow">
                <i class="fa-solid ${cfg.icon}"></i>
              </div>
              <div>
                <h4 class="font-display font-black text-lg text-white tracking-wide uppercase">
                  ${house.name}
                </h4>
                <p class="text-xs text-slate-300 font-medium">${house.motto}</p>
              </div>
            </div>
            <span class="px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-700 font-mono font-black text-xs sm:text-sm ${house.rank === 1 ? 'text-amber-400 border-amber-500/50' : 'text-slate-300'}">
              RANK #${house.rank}
            </span>
          </div>

          <!-- Total Points Display -->
          <div class="my-4 bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 flex items-baseline justify-between">
            <span class="text-sm font-semibold text-slate-300">Championship Score</span>
            <div class="text-right">
              <span class="font-display font-black text-3xl sm:text-4xl text-white font-mono tracking-tight">${house.points}</span>
              <span class="text-sm font-bold text-slate-400 ml-1">pts</span>
            </div>
          </div>
        </div>

        <!-- Medals Tally -->
        <div class="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-1.5 text-center text-xs sm:text-sm">
          <div class="bg-slate-950/50 rounded-lg py-2 px-1 border border-slate-800/60">
            <div class="text-amber-400 text-xs font-bold">🥇 Gold</div>
            <div class="font-mono font-bold text-sm sm:text-base text-slate-100 mt-0.5">${house.gold}</div>
          </div>
          <div class="bg-slate-950/50 rounded-lg py-2 px-1 border border-slate-800/60">
            <div class="text-slate-200 text-xs font-bold">🥈 Silver</div>
            <div class="font-mono font-bold text-sm sm:text-base text-slate-100 mt-0.5">${house.silver}</div>
          </div>
          <div class="bg-slate-950/50 rounded-lg py-2 px-1 border border-slate-800/60">
            <div class="text-amber-500 text-xs font-bold">🥉 Bronze</div>
            <div class="font-mono font-bold text-sm sm:text-base text-slate-100 mt-0.5">${house.bronze}</div>
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
        <div class="flex items-center justify-between text-sm font-semibold">
          <div class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded-full ${cfg.barBg}"></span>
            <span class="text-slate-200 font-display font-bold uppercase">${house.name} HOUSE</span>
          </div>
          <span class="font-mono text-slate-200 font-bold">${house.points} pts</span>
        </div>
        <div class="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800">
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
      <span class="inline-flex items-center gap-2 mx-4">
        <span class="text-base">${medal}</span>
        <strong class="text-white text-sm">${e.eventName} (${e.category} ${e.gender}):</strong>
        <span class="text-slate-200 font-semibold text-sm">${e.athleteName}</span>
        <span class="px-2 py-0.5 text-xs rounded-md font-bold ${cfg.bgBadge || 'bg-slate-800 text-slate-300'}">${e.house}</span>
        <span class="text-amber-400 font-mono font-bold text-sm">+${e.points} pts</span>
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
          <div class="bg-[#0b101f]/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all hover:-translate-y-1 shadow-md flex flex-col justify-between">
            <div>
              <!-- Event Header -->
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="px-2.5 py-1 rounded bg-[#060911] border border-slate-800 text-xs font-mono font-bold text-slate-300">
                  ${event.resultId}
                </span>
                <span class="px-3 py-1 rounded-full text-xs font-black ${cfg.bgBadge || 'bg-slate-800 text-slate-300 border border-slate-700'}">
                  ${event.house}
                </span>
              </div>

              <!-- Event Name & Division -->
              <h4 class="font-display font-black text-lg text-white mb-1">
                ${event.eventName}
              </h4>
              <p class="text-sm text-slate-300 font-medium mb-4">
                ${event.category} &bull; ${event.gender}
              </p>

              <!-- Athlete & Chest No -->
              <div class="bg-[#060911]/80 rounded-xl p-3.5 border border-slate-800/80 mb-3 space-y-1.5">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-400 font-medium">Athlete:</span>
                  <strong class="text-white font-bold">${event.athleteName}</strong>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-400 font-medium">Chest No:</span>
                  <span class="font-mono text-amber-400 font-bold">${event.chestNo}</span>
                </div>
              </div>
            </div>

            <!-- Footer: Position & Points -->
            <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span class="text-sm font-bold ${isPodium ? 'text-amber-300' : 'text-slate-400'}">
                ${medal}
              </span>
              <span class="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-black text-sm">
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
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 font-medium">No events found matching criteria.</td></tr>`;
    } else {
      tableBody.innerHTML = state.filteredEvents.map(e => {
        const cfg = HOUSE_CONFIG[e.house] || {};
        const medal = e.position.startsWith('1') ? '🥇 1st' : 
                      e.position.startsWith('2') ? '🥈 2nd' : 
                      e.position.startsWith('3') ? '🥉 3rd' : 
                      e.position || '-';

        return `
          <tr class="hover:bg-slate-800/50 transition-colors">
            <td class="py-3.5 px-4 font-mono text-slate-300 text-sm font-semibold">${e.resultId}</td>
            <td class="py-3.5 px-4 font-bold text-white text-sm sm:text-base">${e.eventName}</td>
            <td class="py-3.5 px-4 text-slate-300 text-sm">${e.category} (${e.gender})</td>
            <td class="py-3.5 px-4 text-slate-100 font-bold text-sm sm:text-base">${e.athleteName}</td>
            <td class="py-3.5 px-4 font-mono text-amber-400 font-bold text-sm">${e.chestNo}</td>
            <td class="py-3.5 px-4">
              <span class="px-2.5 py-1 rounded-md text-xs font-black ${cfg.bgBadge || 'bg-slate-800 text-slate-300'}">
                ${e.house}
              </span>
            </td>
            <td class="py-3.5 px-4 text-center font-bold text-amber-300 text-sm">${medal}</td>
            <td class="py-3.5 px-4 text-right font-mono font-bold text-amber-400 text-sm sm:text-base">+${e.points}</td>
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
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400 font-medium">Category matrix data syncing...</td></tr>`;
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
      <tr class="${isTotal ? 'bg-[#060911] font-black text-amber-300' : 'hover:bg-slate-800/50'} transition-colors">
        <td class="py-3.5 px-4 font-bold ${isTotal ? 'text-amber-400 font-display text-sm sm:text-base' : 'text-slate-100 text-sm'}">
          ${row.category}
        </td>
        <td class="py-3.5 px-4 text-slate-300 text-sm">
          ${row.gender}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-blue-300 text-sm sm:text-base bg-blue-950/30 border-x border-slate-800/80">
          ${row.bluePts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-green-300 text-sm sm:text-base bg-green-950/30 border-r border-slate-800/80">
          ${row.greenPts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-red-300 text-sm sm:text-base bg-red-950/30 border-r border-slate-800/80">
          ${row.redPts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-yellow-300 text-sm sm:text-base bg-amber-950/30 border-r border-slate-800/80">
          ${row.yellowPts}
        </td>
        <td class="py-3.5 px-4 text-center font-mono font-black text-white text-sm sm:text-base">
          ${row.totalPts}
        </td>
        <td class="py-3.5 px-4 text-center">
          ${row.leading && row.leading !== '-' ? `
            <span class="px-2.5 py-1 rounded-md text-xs font-black ${leadingCfg.bgBadge || 'bg-slate-800 text-slate-300'} shadow-sm">
              👑 ${row.leading}
            </span>
          ` : '<span class="text-slate-400 font-semibold">-</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// 7. Stadium / TV Screen Mode - 3D 4-House Cubes Graph
function renderStadiumOverlay() {
  const container = document.getElementById('stadium-podium-container');
  if (!container || state.houses.length === 0) return;

  const maxPoints = Math.max(...state.houses.map(h => h.points), 1);
  const minHeight = 160;
  const maxHeight = 340;

  container.innerHTML = state.houses.map(h => {
    const cfg = HOUSE_CONFIG[h.name] || {};
    const isLeader = h.rank === 1;
    const isSecond = h.rank === 2;
    const isThird = h.rank === 3;
    const medal = isLeader ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : '🎖️';
    const cubeColorClass = `cube-${h.name.toLowerCase()}`;
    const heightPx = maxPoints > 0 
      ? Math.round(minHeight + (h.points / maxPoints) * (maxHeight - minHeight))
      : minHeight;

    return `
      <div class="cube-graph-card ${isLeader ? 'z-20 -mt-6' : 'z-10'}">
        <div class="mb-4 text-center flex flex-col items-center">
          <div class="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${cfg.bgBadge} border-2 ${cfg.border} shadow-2xl mb-2 relative">
            <span class="text-3xl sm:text-4xl">${medal}</span>
            ${isLeader ? '<span class="absolute -top-4 -right-2 text-3xl animate-bounce">👑</span>' : ''}
          </div>
          <span class="px-3.5 py-1 rounded-full text-xs sm:text-sm font-black tracking-wider uppercase mb-1.5 ${isLeader ? 'badge-gold' : 'bg-slate-800 text-slate-200 border border-slate-700'}">
            RANK #${h.rank}
          </span>
          <h2 class="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-wide">
            ${h.name}
          </h2>
          <div class="font-display font-black text-3xl sm:text-4xl font-mono text-amber-400 tracking-tight mt-1">
            ${h.points} <span class="text-sm text-slate-300 font-sans font-bold">PTS</span>
          </div>
        </div>

        <!-- 3D Cube Column -->
        <div class="cube-3d-wrap ${cubeColorClass}">
          <div class="cube-3d-pillar" style="height: ${heightPx}px;">
            <div class="cube-face-top flex items-center justify-center">
              <span class="w-8 h-1.5 rounded-full bg-white/40"></span>
            </div>
            <div class="cube-face-front">
              <div class="flex items-center justify-between text-xs font-bold text-white/90">
                <span class="font-mono text-amber-300 text-sm">#${h.rank}</span>
                <span class="text-xs uppercase tracking-wider text-white/80">${h.name}</span>
              </div>
              <div class="text-center my-auto py-2">
                <span class="font-display font-black text-4xl sm:text-5xl text-white font-mono tracking-tight drop-shadow-md">
                  ${h.points}
                </span>
                <div class="text-xs font-bold text-white/80 uppercase tracking-widest">
                  POINTS
                </div>
              </div>
              <div class="pt-2 border-t border-white/25 grid grid-cols-3 gap-1 text-center text-xs sm:text-sm font-bold text-white">
                <span title="Gold">🥇 ${h.gold}</span>
                <span title="Silver">🥈 ${h.silver}</span>
                <span title="Bronze">🥉 ${h.bronze}</span>
              </div>
            </div>
            <div class="cube-face-side"></div>
          </div>
          <div class="cube-floor-glow"></div>
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
