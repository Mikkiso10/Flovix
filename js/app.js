// ── CONFIG ───────────────────────────────────────────────────────────
const TMDB_KEY = "07632b39d2cb8df26330e9f3faef904f";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const PLAYER_MOVIE = (id) => `https://player.videasy.net/movie/${id}`;
const PLAYER_TV    = (id, s, e) => `https://player.videasy.net/tv/${id}/${s}/${e}`;
const MAX_SEARCH_HISTORY = 10;

// ── STATE ─────────────────────────────────────────────────────────────
let heroItems    = [];
let heroIndex    = 0;
let heroTimer    = null;
let searchTimer  = null;
let currentItem  = null;
let currentSeason = 1;

// ── STORAGE HELPERS ───────────────────────────────────────────────────
const Store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },

  // Search history
  getHistory: () => Store.get("search_history") || [],
  addHistory: (query) => {
    let h = Store.getHistory().filter(q => q.toLowerCase() !== query.toLowerCase());
    h.unshift(query);
    Store.set("search_history", h.slice(0, MAX_SEARCH_HISTORY));
  },
  clearHistory: () => Store.set("search_history", []),

  // Watch progress: { progress%, timestamp(s), season, episode, duration }
  getProgress: (mediaType, id) => Store.get(`progress_${mediaType}_${id}`) || null,
  setProgress: (mediaType, id, data) => Store.set(`progress_${mediaType}_${id}`, data),

  // Continue watching list (ordered by last watched)
  getContinue: () => Store.get("continue_watching") || [],
  addContinue: (item) => {
    let list = Store.getContinue().filter(i => !(i.id === item.id && i.media_type === item.media_type));
    list.unshift(item);
    Store.set("continue_watching", list.slice(0, 20));
  },
  removeContinue: (id, mediaType) => {
    Store.set("continue_watching", Store.getContinue().filter(i => !(i.id === id && i.media_type === mediaType)));
  }
};

// ── API ────────────────────────────────────────────────────────────────
async function api(path) {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${TMDB_API}${path}${sep}api_key=${TMDB_KEY}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function posterUrl(p, size) {
  if (!p) return null;
  const s = size || "w500";
  return `${TMDB_IMG}/${s}${p}`;
}

// ── SKELETON / RENDER ─────────────────────────────────────────────────
function renderSkeletons(container, n = 10) {
  container.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div"); s.className = "skeleton";
    container.appendChild(s);
  }
}

function makeCard(item) {
  const isTV   = item.media_type === "tv" || !!item.name;
  const title  = item.title || item.name || "Unknown";
  const year   = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "?";
  const poster = posterUrl(item.poster_path);
  const card   = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    ${poster ? `<img src="${poster}" alt="${title}" loading="lazy"/>` : `<div class="no-poster">🎬</div>`}
    <div class="card-badge">⭐ ${rating}</div>
    <div class="card-overlay">
      <h3>${title}</h3>
      <div class="meta">${year} · ${isTV ? "TV" : "Movie"}</div>
      <button class="card-play-btn">▶ Play</button>
    </div>`;
  card.addEventListener("click", () => openPlayer(item));
  return card;
}

// ── CONTINUE WATCHING ─────────────────────────────────────────────────
function renderContinue() {
  const row   = document.getElementById("continueRow");
  const cards = document.getElementById("continueCards");
  if (!row || !cards) return;

  const list = Store.getContinue();
  if (!list.length) { row.style.display = "none"; return; }
  row.style.display = "";
  cards.innerHTML = "";

  list.forEach(item => {
    const isTV    = item.media_type === "tv";
    const title   = item.title || item.name || "";
    const prog    = Store.getProgress(item.media_type, item.id);
    const pct     = prog ? Math.min(Math.round(prog.progress || 0), 100) : 0;
    const poster  = posterUrl(item.backdrop_path || item.poster_path);
    const subtext = isTV && prog?.season
      ? `S${prog.season} E${prog.episode}`
      : pct ? `${pct}% watched` : "Just started";

    const card = document.createElement("div");
    card.className = "card continue";
    card.innerHTML = `
      <div class="continue-card-inner">
        ${poster ? `<img src="${poster}" alt="${title}" style="width:100%;height:100%;object-fit:cover;border-radius:10px 10px 0 0;"/>` : `<div class="no-poster" style="border-radius:10px 10px 0 0;aspect-ratio:16/9;">🎬</div>`}
        <div class="continue-progress"><div class="continue-progress-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="continue-info">
        <h4>${title}</h4>
        <p>${subtext}</p>
      </div>
      <div class="card-badge">⭐ ${item.vote_average ? Number(item.vote_average).toFixed(1) : "?"}</div>
      <button class="continue-remove" title="Remove">✕</button>`;

    card.querySelector(".continue-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      Store.removeContinue(item.id, item.media_type);
      renderContinue();
    });
    card.addEventListener("click", () => openPlayer(item));
    cards.appendChild(card);
  });
}

// ── HERO ──────────────────────────────────────────────────────────────
function setHero(item, index) {
  const title  = item.title || item.name || "";
  const year   = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "?";
  const isTV   = item.media_type === "tv" || !!item.name;

  document.getElementById("heroTitle").textContent = title;
  document.getElementById("heroDesc").textContent  = item.overview || "";
  document.getElementById("heroTag").textContent   = isTV ? "TV SERIES" : "MOVIE";
  document.getElementById("heroMeta").innerHTML    =
    `<span class="rating">⭐ ${rating}</span><span>${year}</span>${item.original_language ? `<span class="genre-tag">${item.original_language.toUpperCase()}</span>` : ""}`;

  const bg = item.backdrop_path || item.poster_path;
  const bgSize = item.backdrop_path ? "original" : "w780";
  document.getElementById("heroBg").style.backgroundImage =
    bg ? `url(${posterUrl(bg, bgSize)})` : "linear-gradient(135deg,#1a1a2e,#0f3460)";

  document.getElementById("heroPlayBtn").onclick = () => openPlayer(item);
  document.getElementById("heroInfoBtn").onclick = () => openPlayer(item);

  // Update dots
  document.querySelectorAll(".hero-dot").forEach((d, i) => d.classList.toggle("active", i === index));
}

function buildHeroDots() {
  const dotsEl = document.getElementById("heroDots");
  dotsEl.innerHTML = "";
  heroItems.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "hero-dot" + (i === 0 ? " active" : "");
    d.addEventListener("click", () => { heroIndex = i; cycleHero(); resetHeroTimer(); });
    dotsEl.appendChild(d);
  });
}

function cycleHero() {
  if (!heroItems.length) return;
  setHero(heroItems[heroIndex], heroIndex);
  heroIndex = (heroIndex + 1) % heroItems.length;
}

function resetHeroTimer() { clearInterval(heroTimer); heroTimer = setInterval(cycleHero, 8000); }

// ── ROW LOADER ────────────────────────────────────────────────────────
async function loadRow(apiPath, containerId, mediaTypeFallback) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  renderSkeletons(container);
  const data  = await api(apiPath);
  const items = (data?.results || [])
    .filter(i => i.poster_path)
    .map(i => ({ ...i, media_type: i.media_type || mediaTypeFallback }));
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<p style="color:var(--muted);padding:1rem;">Could not load content.</p>`;
    return [];
  }
  items.forEach(item => container.appendChild(makeCard(item)));
  return items;
}

// ── PLAYER MODAL ──────────────────────────────────────────────────────
async function openPlayer(item) {
  currentItem = item;
  const isTV  = item.media_type === "tv" || !!item.name;
  const title = item.title || item.name || "";
  const id    = item.id;

  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalDesc").textContent  = item.overview || "";

  const year   = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "?";
  document.getElementById("modalMeta").innerHTML =
    `<span class="m-rating">⭐ ${rating}</span><span>${year}</span><span>${isTV ? "TV Series" : "Movie"}</span>`;

  document.getElementById("playerModal").classList.add("open");
  document.body.style.overflow = "hidden";
  const iframe = document.getElementById("playerIframe");
  if (iframe) iframe.src = "";
  // Push history state so back button closes the modal
  history.pushState({ modal: true }, "");


  // Add to continue watching
  Store.addContinue(item);

  const epSection = document.getElementById("episodeSection");

  if (isTV) {
    epSection.style.display = "";
    document.getElementById("seasonTabs").innerHTML  = "<span style='color:var(--muted);font-size:.85rem'>Loading seasons...</span>";
    document.getElementById("episodeGrid").innerHTML = "";

    const prog = Store.getProgress("tv", id);
    const startS = prog?.season || 1;
    const startE = prog?.episode || 1;

    const details = await api(`/tv/${id}`);
    const numSeasons = details?.number_of_seasons || 1;
    currentSeason = startS;

    buildSeasonTabs(id, numSeasons, startS);
    await loadEpisodeGrid(id, startS, startE);
    loadIframe(PLAYER_TV(id, startS, startE));
  } else {
    epSection.style.display = "none";
    const prog = Store.getProgress("movie", id);
    const startAt = prog?.timestamp ? `&progress=${Math.floor(prog.timestamp)}` : "";
    loadIframe(PLAYER_MOVIE(id));
  }
}

function buildSeasonTabs(showId, numSeasons, activeSeason) {
  const tabs = document.getElementById("seasonTabs");
  tabs.innerHTML = "";
  for (let s = 1; s <= numSeasons; s++) {
    const btn = document.createElement("button");
    btn.className = "season-tab" + (s === activeSeason ? " active" : "");
    btn.textContent = `Season ${s}`;
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".season-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSeason = s;
      await loadEpisodeGrid(showId, s, null);
    });
    tabs.appendChild(btn);
  }
}

async function loadEpisodeGrid(showId, season, activeEp) {
  const grid = document.getElementById("episodeGrid");
  grid.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:.5rem">Loading episodes...</div>`;

  const data     = await api(`/tv/${showId}/season/${season}`);
  const episodes = data?.episodes || [];
  grid.innerHTML = "";

  if (!episodes.length) {
    grid.innerHTML = `<div style="color:var(--muted);padding:.5rem">No episodes found.</div>`;
    return;
  }

  const prog = Store.getProgress("tv", showId);

  episodes.forEach(ep => {
    const epNum   = ep.episode_number;
    const isActive = epNum === activeEp;
    const thumb   = ep.still_path ? posterUrl(ep.still_path) : null;
    const epProg  = (prog?.season === season && prog?.episode === epNum) ? prog : null;
    const pct     = epProg ? Math.min(Math.round(epProg.progress || 0), 100) : 0;
    const runtime = ep.runtime ? `${ep.runtime}m` : "";

    const row = document.createElement("div");
    row.className = "ep-row" + (isActive ? " active" : "");
    row.innerHTML = `
      <div class="ep-num">${epNum}</div>
      ${thumb
        ? `<img class="ep-thumb" src="${thumb}" alt="E${epNum}" loading="lazy"/>`
        : `<div class="ep-no-thumb">🎬</div>`}
      <div class="ep-info">
        <div class="ep-title">${ep.name || `Episode ${epNum}`}</div>
        ${ep.overview ? `<div class="ep-desc">${ep.overview}</div>` : ""}
        <div style="display:flex;align-items:center;gap:.75rem">
          ${runtime ? `<div class="ep-runtime">${runtime}</div>` : ""}
          ${pct > 0 ? `<div class="ep-progress" style="flex:1"><div class="ep-progress-bar" style="width:${pct}%"></div></div>` : ""}
        </div>
      </div>
      <div class="ep-play-icon">▶</div>`;

    row.addEventListener("click", () => {
      document.querySelectorAll(".ep-row").forEach(r => r.classList.remove("active"));
      row.classList.add("active");
      loadIframe(PLAYER_TV(showId, season, epNum));
      // Save progress entry
      const existing = Store.getProgress("tv", showId) || {};
      Store.setProgress("tv", showId, { ...existing, season, episode: epNum });
      renderContinue();
    });
    grid.appendChild(row);
  });
}

function loadIframe(src) {
  const playerWrap = document.querySelector(".player-wrap");
  playerWrap.innerHTML = `<iframe id="playerIframe" src="${src}" frameborder="0" allowfullscreen allow="autoplay; fullscreen"></iframe>`;
}


function closePlayer() {
  document.getElementById("playerModal").classList.remove("open");
  // Clear iframe if it exists (localhost mode)
  const iframe = document.getElementById("playerIframe");
  if (iframe) iframe.src = "";
  document.body.style.overflow = "";
  renderContinue();
}

// ── SEARCH ────────────────────────────────────────────────────────────
function showDropdown(html) {
  const dd = document.getElementById("searchDropdown");
  dd.innerHTML = html; dd.classList.add("open");
}
function hideDropdown() { document.getElementById("searchDropdown").classList.remove("open"); }

function renderHistoryDropdown() {
  const history = Store.getHistory();
  if (!history.length) { hideDropdown(); return; }
  const items = history.map(q => `
    <div class="dropdown-item" data-query="${q}">
      <div class="di-history">🕐</div>
      <div class="di-info"><div class="di-title">${q}</div></div>
      <div class="di-play">Search</div>
    </div>`).join("");
  showDropdown(`
    <div class="dropdown-section">
      <div class="dropdown-label">Recent Searches</div>
      <button class="clear-history" id="clearHistoryBtn">Clear history</button>
      ${items}
    </div>`);

  document.getElementById("clearHistoryBtn")?.addEventListener("click", (e) => {
    e.stopPropagation(); Store.clearHistory(); hideDropdown();
  });
  document.querySelectorAll(".dropdown-item[data-query]").forEach(el => {
    el.addEventListener("click", () => {
      const q = el.dataset.query;
      document.getElementById("searchInput").value = q;
      doSearch(q);
    });
  });
}

function renderResultsDropdown(results, query) {
  if (!results.length) {
    showDropdown(`<div class="dropdown-no-results">No results for "<strong>${query}</strong>"</div>`);
    return;
  }
  const items = results.slice(0, 8).map(item => {
    const isTV  = item.media_type === "tv" || !!item.name;
    const title = item.title || item.name || "";
    const year  = (item.release_date || item.first_air_date || "").slice(0, 4);
    const poster = posterUrl(item.poster_path);
    return `
      <div class="dropdown-item" data-id="${item.id}" data-type="${item.media_type}">
        ${poster ? `<img src="${poster}" alt="${title}" loading="lazy"/>` : `<div class="di-no-img">🎬</div>`}
        <div class="di-info">
          <div class="di-title">${title}</div>
          <div class="di-meta">${year} · ${isTV ? "TV Show" : "Movie"}</div>
        </div>
        <button class="di-play">▶ Play</button>
      </div>`;
  }).join("");

  showDropdown(`<div class="dropdown-section"><div class="dropdown-label">Results</div>${items}</div>`);

  document.querySelectorAll(".dropdown-item[data-id]").forEach((el, i) => {
    el.addEventListener("click", () => {
      Store.addHistory(query);
      openPlayer(results[i]);
      hideDropdown();
      document.getElementById("searchInput").value = "";
      document.getElementById("searchClear").classList.remove("visible");
    });
  });
}

async function doSearch(query) {
  query = query.trim();
  if (!query) { renderHistoryDropdown(); return; }
  // NOTE: history is saved only on Enter or when user clicks a result

  showDropdown(`<div class="dropdown-no-results" style="padding:1.2rem">Searching...</div>`);

  const data    = await api(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false`);
  const results = (data?.results || []).filter(r => r.poster_path);
  renderResultsDropdown(results, query);
}

// Search input events
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

searchInput.addEventListener("focus", () => {
  if (!searchInput.value.trim()) renderHistoryDropdown();
});
searchInput.addEventListener("input", () => {
  const v = searchInput.value;
  searchClear.classList.toggle("visible", v.length > 0);
  clearTimeout(searchTimer);
  if (!v.trim()) { renderHistoryDropdown(); return; }
  searchTimer = setTimeout(() => doSearch(v), 320);
});
searchInput.addEventListener("keydown", e => {
  if (e.key === "Escape") { hideDropdown(); searchInput.blur(); }
  if (e.key === "Enter" && searchInput.value.trim()) Store.addHistory(searchInput.value.trim());
});

searchClear.addEventListener("click", () => {
  searchInput.value = ""; searchClear.classList.remove("visible");
  hideDropdown(); searchInput.focus();
});

// Close dropdown on outside click
document.addEventListener("click", e => {
  if (!e.target.closest(".nav-search-wrap")) hideDropdown();
});

// ── NAV ───────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const hero = document.getElementById("heroSection");
    const section = btn.dataset.section;

    if (section === "home") {
      hero.style.display = "";
      document.getElementById("mainContent").innerHTML = `
        <section class="row" id="continueRow" style="display:none">
          <h2 class="row-title">Continue Watching</h2>
          <div class="cards continue-cards" id="continueCards"></div>
        </section>
        <section class="row"><h2 class="row-title">Trending Now</h2><div class="cards" id="trendingCards"></div></section>
        <section class="row"><h2 class="row-title">Top Movies</h2><div class="cards" id="topMoviesCards"></div></section>
        <section class="row"><h2 class="row-title">Popular TV Shows</h2><div class="cards" id="topTVCards"></div></section>`;
      init();
    } else if (section === "movies") {
      hero.style.display = "none";
      document.getElementById("mainContent").innerHTML =
        `<section class="row"><h2 class="row-title">Popular Movies</h2><div class="cards" id="moviesAll"></div></section>`;
      loadRow("/movie/popular", "moviesAll", "movie");
    } else if (section === "tv") {
      hero.style.display = "none";
      document.getElementById("mainContent").innerHTML =
        `<section class="row"><h2 class="row-title">Popular TV Shows</h2><div class="cards" id="tvAll"></div></section>`;
      loadRow("/tv/popular", "tvAll", "tv");
    }
  });
});

// Close modal
document.getElementById("modalClose").addEventListener("click", closePlayer);
// modalBackdrop is hidden in fullscreen mode — close via X button or Escape
document.addEventListener("keydown", e => { if (e.key === "Escape") closePlayer(); });

// Nav scroll
window.addEventListener("scroll", () => {
  document.getElementById("nav").classList.toggle("scrolled", window.scrollY > 50);
});

// VidKing progress events
window.addEventListener("message", (event) => {
  try {
    const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    if (msg?.type === "PLAYER_EVENT" && msg.data) {
      const d = msg.data;
      if (!d.id) return;
      const prog = {
        progress:  d.progress || 0,
        timestamp: d.currentTime || 0,
        duration:  d.duration || 0,
        season:    d.season || currentSeason,
        episode:   d.episode || 1,
      };
      Store.setProgress(d.mediaType || "movie", d.id, prog);
      // Update continue watching
      if (currentItem) Store.addContinue(currentItem);
    }
  } catch (_) {}
});

// ── BACK BUTTON ──────────────────────────────────────────────────────
window.addEventListener("popstate", (e) => {
  if (document.getElementById("playerModal").classList.contains("open")) {
    closePlayer();
  }
});

// ── INIT ──────────────────────────────────────────────────────────────
async function init() {
  renderContinue();

  const [trending] = await Promise.all([
    loadRow("/trending/all/week",  "trendingCards",  "movie"),
    loadRow("/movie/popular",    "topMoviesCards",  "movie"),
    loadRow("/tv/popular",        "topTVCards",      "tv"),
  ]);

  // Hero — pick items with good backdrops
  heroItems = trending.filter(i => i.backdrop_path).slice(0, 6);
  if (heroItems.length) {
    buildHeroDots();
    setHero(heroItems[0], 0);
    heroIndex = 1;
    resetHeroTimer();
  }
}

init();
