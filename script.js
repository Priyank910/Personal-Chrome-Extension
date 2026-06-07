/* =====================================================================
   AURA — Cosmic Command Center  |  script.js
   Particle field · Parallax · 3D tilt · Focused feature set
   ===================================================================== */
(function () {
  'use strict';

  /* ─── Storage ─── */
  const Store = {
    _c: typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local,
    async get(k) {
      if (this._c) {
        try {
          return new Promise(r => {
            chrome.storage.local.get([k], d => {
              if (chrome.runtime?.lastError) {
                console.warn("Storage read error:", chrome.runtime.lastError);
                r(null);
              } else {
                r(d ? d[k] : null);
              }
            });
          });
        } catch (e) {
          console.warn("Storage API inaccessible:", e);
          return null;
        }
      }
      try { return JSON.parse(localStorage.getItem(k)); } catch { return localStorage.getItem(k); }
    },
    async set(k, v) {
      if (this._c) {
        try {
          return new Promise(r => {
            chrome.storage.local.set({ [k]: v }, () => {
              if (chrome.runtime?.lastError) {
                console.warn("Storage write error:", chrome.runtime.lastError);
              }
              r();
            });
          });
        } catch (e) {
          console.warn("Storage API inaccessible:", e);
          return;
        }
      }
      localStorage.setItem(k, JSON.stringify(v));
    }
  };

  /* ─── Helpers ─── */
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/`/g, '&#96;');
  }

  function uid() {
    return Math.random().toString(36).substring(2, 11);
  }

  function fmtDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function shortUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      return url;
    }
  }

  /* ─── DOM ─── */
  const $ = s => document.querySelector(s);
  const DOM = {
    canvas:         $('#particle-canvas'),
    onboardOvl:     $('#onboarding-overlay'),
    onboardName:    $('#onboarding-name'),
    onboardSave:    $('#onboarding-save'),
    greeting:       $('#greeting'),
    heroName:       $('#hero-name'),
    clockHM:        $('#clock-hm'),
    clockSec:       $('#clock-sec'),
    clockAMPM:      $('#clock-ampm'),
    dayName:        $('#day-name'),
    fullDate:       $('#full-date'),
    searchInput:    $('#search-input'),
    searchResults:  $('#search-results'),
    favTrack:       $('#favorites-track'),
    notesList:      $('#notes-list'),
    notesEmpty:     $('#notes-empty'),
    addNoteBtn:     $('#add-note-btn'),
    noteOvl:        $('#note-modal-overlay'),
    noteTitle:      $('#note-modal-title'),
    noteTitleIn:    $('#note-title-input'),
    noteBodyIn:     $('#note-body-input'),
    noteCancel:     $('#note-modal-cancel'),
    noteSave:       $('#note-modal-save'),
    noteDelete:     $('#note-modal-delete'),
    jokeSetup:      $('#joke-setup'),
    jokePunch:      $('#joke-punchline'),
    jokeRefresh:    $('#joke-refresh'),
    weatherIcon:    $('#weather-icon'),
    weatherTemp:    $('#weather-temp'),
    weatherCity:    $('#weather-city'),
    favOvl:         $('#fav-modal-overlay'),
    favTitle:       $('#fav-modal-title'),
    favNameIn:      $('#fav-name-input'),
    favUrlIn:       $('#fav-url-input'),
    favCancel:      $('#fav-modal-cancel'),
    favSave:        $('#fav-modal-save'),
    settingsBtn:    $('#settings-btn'),
    settingsOvl:    $('#settings-modal-overlay'),
    settingsName:   $('#settings-name'),
    settingsCancel: $('#settings-cancel'),
    settingsSave:   $('#settings-save'),

    // Settings Extensions
    aiModelSelect:  $('#settings-ai-model'),
    customModelCon: $('#custom-model-container'),
    customModelIn:  $('#settings-custom-model'),
    orKeyIn:        $('#settings-or-key'),

    // AI Chat Drawer (Comet)
    aiDrawer:       $('#ai-drawer'),
    aiClearBtn:     $('#ai-clear-btn'),
    aiCloseBtn:     $('#ai-close-btn'),
    aiModelSelectDr:$('#ai-drawer-model-select'),
    aiChatMsgs:     $('#ai-chat-messages'),
    aiChatIn:       $('#ai-chat-input'),
    aiChatSend:     $('#ai-chat-send'),
  };

  /* ─── State ─── */
  let userName = '';
  let favorites = [];
  let notes = [];
  let editFavIdx = -1;
  let editNoteId = null;

  // Aura Extended State
  let orKey = '';
  let aiModel = 'google/gemini-2.5-flash';
  let customModelName = '';
  let aiChatHistory = [];
  let aiAbortController = null;


  /* =================================================================
     PARTICLE FIELD
     ================================================================= */
  class ParticleField {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.mouse = { x: -9999, y: -9999 };
      this.mouseActive = false;
      this.colors = [
        'rgba(0,212,255,',   // cyan
        'rgba(168,85,247,',  // violet
        'rgba(244,114,182,', // pink
        'rgba(96,165,250,',  // blue
        'rgba(52,211,153,',  // emerald
      ];
      this._resize();
      this._spawn();
      this._bindEvents();
      this._loop();
    }

    _resize() {
      this.w = this.c.width = window.innerWidth;
      this.h = this.c.height = window.innerHeight;
    }

    _spawn() {
      const count = Math.min(Math.floor((this.w * this.h) / 11000), 200);
      this.particles = [];
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x:  Math.random() * this.w,
          y:  Math.random() * this.h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          sz: Math.random() * 1.8 + 0.5,
          col: this.colors[Math.floor(Math.random() * this.colors.length)],
          op:  Math.random() * 0.45 + 0.15,
          ps:  Math.random() * 0.018 + 0.004,
          po:  Math.random() * Math.PI * 2,
        });
      }
    }

    _bindEvents() {
      window.addEventListener('resize', () => { this._resize(); this._spawn(); });
      document.addEventListener('mousemove', e => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouseActive = true;
      });
      document.addEventListener('mouseleave', () => { this.mouseActive = false; });
    }

    _loop() {
      this.ctx.clearRect(0, 0, this.w, this.h);
      const t = performance.now() * 0.001;

      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = this.w + 10;
        if (p.x > this.w + 10) p.x = -10;
        if (p.y < -10) p.y = this.h + 10;
        if (p.y > this.h + 10) p.y = -10;

        // Mouse repulsion
        if (this.mouseActive) {
          const dx = p.x - this.mouse.x;
          const dy = p.y - this.mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 140 && d > 0) {
            const force = (140 - d) / 140 * 0.6;
            p.x += (dx / d) * force;
            p.y += (dy / d) * force;
          }
        }

        const pulse = Math.sin(t * p.ps * 10 + p.po) * 0.12 + p.op;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
        this.ctx.fillStyle = p.col + Math.max(0.05, pulse).toFixed(3) + ')';
        this.ctx.fill();
      }

      // Constellation lines near mouse
      if (this.mouseActive) {
        const near = [];
        for (const p of this.particles) {
          const dx = p.x - this.mouse.x;
          const dy = p.y - this.mouse.y;
          if (dx * dx + dy * dy < 50000) near.push(p);
        }
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i < near.length; i++) {
          for (let j = i + 1; j < near.length; j++) {
            const a = near[i], b = near[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 14000) {
              const alpha = (1 - d2 / 14000) * 0.1;
              this.ctx.strokeStyle = `rgba(0,212,255,${alpha.toFixed(3)})`;
              this.ctx.beginPath();
              this.ctx.moveTo(a.x, a.y);
              this.ctx.lineTo(b.x, b.y);
              this.ctx.stroke();
            }
          }
        }
      }

      requestAnimationFrame(() => this._loop());
    }
  }

  /* =================================================================
     PARALLAX ENGINE
     ================================================================= */
  const parallax = {
    tx: 0, ty: 0, cx: 0, cy: 0,
    layers: [],

    init() {
      this.layers = document.querySelectorAll('[data-depth]');
      document.addEventListener('mousemove', e => {
        const hw = window.innerWidth / 2;
        const hh = window.innerHeight / 2;
        this.tx = (e.clientX - hw) / hw;
        this.ty = (e.clientY - hh) / hh;
      });
      this._tick();
    },

    _tick() {
      this.cx += (this.tx - this.cx) * 0.04;
      this.cy += (this.ty - this.cy) * 0.04;

      this.layers.forEach(el => {
        const f = parseFloat(el.dataset?.depth || el.getAttribute('data-depth')) || 0;
        const x = this.cx * f * 12;
        const y = this.cy * f * 10;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });

      requestAnimationFrame(() => this._tick());
    }
  };

  /* =================================================================
     3D TILT (Favorites)
     ================================================================= */
  function attachTilt(card) {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      const ry = (nx - 0.5) * 22;
      const rx = (ny - 0.5) * -22;
      card.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.1)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  }

  /* =================================================================
     CLOCK + GREETING
     ================================================================= */
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function greetText(h) {
    if (h >= 5 && h < 12) return 'Good Morning,';
    if (h >= 12 && h < 17) return 'Good Afternoon,';
    if (h >= 17 && h < 21) return 'Good Evening,';
    return 'Good Night,';
  }

  function tickClock() {
    const now = new Date();
    const h = now.getHours();
    const h12 = h % 12 || 12;
    DOM.clockHM.textContent = `${h12}:${String(now.getMinutes()).padStart(2,'0')}`;
    DOM.clockSec.textContent = String(now.getSeconds()).padStart(2,'0');
    DOM.clockAMPM.textContent = h >= 12 ? 'PM' : 'AM';
    DOM.dayName.textContent = DAYS[now.getDay()];
    DOM.fullDate.textContent = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    DOM.greeting.textContent = greetText(h);
  }

  /* =================================================================
     USER / ONBOARDING
     ================================================================= */
  async function initUser() {
    userName = (await Store.get('aura_user')) || '';
    if (!userName) {
      DOM.onboardOvl.classList.remove('hidden');
      DOM.onboardName.focus();
    } else {
      DOM.heroName.textContent = userName;
    }
  }

  function saveUser(name) {
    userName = name.trim() || 'Traveler';
    Store.set('aura_user', userName);
    DOM.heroName.textContent = userName;
    DOM.onboardOvl.classList.add('hidden');
  }

  DOM.onboardSave.addEventListener('click', () => saveUser(DOM.onboardName.value));
  DOM.onboardName.addEventListener('keydown', e => { if (e.key === 'Enter') saveUser(DOM.onboardName.value); });

  /* =================================================================
     FAVORITES
     ================================================================= */
  const DEF_FAVS = [
    { name: 'Google',   url: 'https://google.com' },
    { name: 'YouTube',  url: 'https://youtube.com' },
    { name: 'GitHub',   url: 'https://github.com' },
    { name: 'Gmail',    url: 'https://mail.google.com' },
    { name: 'Twitter',  url: 'https://x.com' },
    { name: 'Reddit',   url: 'https://reddit.com' },
    { name: 'ChatGPT',  url: 'https://chatgpt.com' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
  ];

  const NODE_COLORS = [
    { a: 'rgba(0,212,255,0.22)',   b: 'rgba(0,212,255,0.35)'   },
    { a: 'rgba(168,85,247,0.22)',  b: 'rgba(168,85,247,0.35)'  },
    { a: 'rgba(244,114,182,0.22)', b: 'rgba(244,114,182,0.35)' },
    { a: 'rgba(52,211,153,0.22)',  b: 'rgba(52,211,153,0.35)'  },
    { a: 'rgba(251,146,60,0.22)',  b: 'rgba(251,146,60,0.35)'  },
    { a: 'rgba(96,165,250,0.22)',  b: 'rgba(96,165,250,0.35)'  },
    { a: 'rgba(248,113,113,0.22)', b: 'rgba(248,113,113,0.35)' },
    { a: 'rgba(163,230,53,0.22)',  b: 'rgba(163,230,53,0.35)'  },
  ];

  function favIcon(url) {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; }
    catch { return ''; }
  }

  function renderFavs(list) {
    const data = list || favorites;
    DOM.favTrack.innerHTML = '';

    data.forEach((fav, i) => {
      const col = NODE_COLORS[i % NODE_COLORS.length];
      const node = document.createElement('a');
      node.className = 'fav-node';
      node.href = /^https?:\/\//i.test(fav.url) ? fav.url : '#';
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
      node.style.setProperty('--node-accent', col.a);
      node.style.setProperty('--node-glow', col.b);

      const ico = favIcon(fav.url);
      node.innerHTML = `
        <div class="fav-actions">
          <button class="fav-act edit" data-i="${i}" title="Edit">✎</button>
          <button class="fav-act" data-i="${i}" title="Delete">✕</button>
        </div>
        <div class="fav-icon">${ico ? `<img src="${ico}" alt="${esc(fav.name)}" loading="lazy"/>` : '<span style="font-size:1.2rem">🌐</span>'}</div>
        <span class="fav-label">${esc(fav.name)}</span>
      `;

      attachTilt(node);
      DOM.favTrack.appendChild(node);
    });

    // Add button node
    const addNode = document.createElement('button');
    addNode.className = 'fav-add-node';
    addNode.innerHTML = '+';
    addNode.title = 'Add Favorite';
    addNode.addEventListener('click', () => openFavModal(-1));
    DOM.favTrack.appendChild(addNode);

    // Action handlers
    DOM.favTrack.querySelectorAll('.fav-act.edit').forEach(b => {
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openFavModal(+b.dataset.i); });
    });
    DOM.favTrack.querySelectorAll('.fav-act:not(.edit)').forEach(b => {
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); deleteFav(+b.dataset.i); });
    });
  }

  async function loadFavs() {
    const s = await Store.get('aura_favs');
    favorites = s && Array.isArray(s) ? s : [...DEF_FAVS];
    renderFavs();
  }

  function saveFavs() { Store.set('aura_favs', favorites); }

  function openFavModal(idx) {
    editFavIdx = idx;
    if (idx >= 0) {
      DOM.favTitle.textContent = 'Edit Favorite';
      DOM.favNameIn.value = favorites[idx].name;
      DOM.favUrlIn.value = favorites[idx].url;
    } else {
      DOM.favTitle.textContent = 'Add Favorite';
      DOM.favNameIn.value = '';
      DOM.favUrlIn.value = '';
    }
    DOM.favOvl.classList.remove('hidden');
    setTimeout(() => DOM.favNameIn.focus(), 120);
  }

  function closeFavModal() { DOM.favOvl.classList.add('hidden'); editFavIdx = -1; }

  function commitFav() {
    const name = DOM.favNameIn.value.trim();
    let url = DOM.favUrlIn.value.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (editFavIdx >= 0) favorites[editFavIdx] = { name, url };
    else favorites.push({ name, url });
    saveFavs();
    renderFavs();
    closeFavModal();
  }

  function deleteFav(i) { favorites.splice(i, 1); saveFavs(); renderFavs(); }

  DOM.favCancel.addEventListener('click', closeFavModal);
  DOM.favSave.addEventListener('click', commitFav);
  DOM.favOvl.addEventListener('click', e => { if (e.target === DOM.favOvl) closeFavModal(); });
  DOM.favUrlIn.addEventListener('keydown', e => { if (e.key === 'Enter') commitFav(); });

  /* =================================================================
     SEARCH — Google Redirection
     ================================================================= */
  let srIdx = -1;

  /* ── Home dropdown (favorites + Google search suggestion) ── */
  function doSearch(q) {
    const t = q.trim().toLowerCase();
    DOM.searchResults.innerHTML = '';
    srIdx = -1;
    if (!t) { DOM.searchResults.classList.add('hidden'); return; }

    const hits = favorites
      .map((f, i) => ({ ...f, _i: i }))
      .filter(f => f.name.toLowerCase().includes(t) || f.url.toLowerCase().includes(t));

    hits.forEach(h => {
      const el = document.createElement('div');
      el.className = 'sr-item';
      el.dataset.url = h.url;
      const ic = favIcon(h.url);
      el.innerHTML = `${ic ? `<img src="${ic}" alt=""/>` : '<span>🌐</span>'}
        <span class="sr-name">${esc(h.name)}</span>
        <span class="sr-url">${esc(shortUrl(h.url))}</span>`;
      el.addEventListener('click', e => {
        e.preventDefault();
        window.open(h.url, '_blank', 'noopener,noreferrer');
      });
      DOM.searchResults.appendChild(el);
    });

    // Google Search this query
    const web = document.createElement('div');
    web.className = 'sr-web';
    web.innerHTML = `<svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      Search Google for "<strong>${esc(q.trim())}</strong>"`;
    web.addEventListener('click', () => {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;
    });
    DOM.searchResults.appendChild(web);

    DOM.searchResults.classList.remove('hidden');
  }

  DOM.searchInput.addEventListener('input', e => doSearch(e.target.value));

  DOM.searchInput.addEventListener('keydown', e => {
    const items = DOM.searchResults.querySelectorAll('.sr-item, .sr-web');
    if (!items.length) {
      if (e.key === 'Enter') {
        const q = DOM.searchInput.value.trim();
        if (q) {
          window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        }
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); srIdx = Math.min(srIdx + 1, items.length - 1); markActive(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); srIdx = Math.max(srIdx - 1, 0); markActive(items); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (srIdx >= 0) items[srIdx].click();
      else {
        const q = DOM.searchInput.value.trim();
        if (q) {
          window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        }
      }
    }
    else if (e.key === 'Escape') { DOM.searchResults.classList.add('hidden'); DOM.searchInput.blur(); }
  });

  function markActive(items) { items.forEach((it, i) => it.classList.toggle('active', i === srIdx)); }

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-dock')) DOM.searchResults.classList.add('hidden');
  });



  /* =================================================================
     NOTES
     ================================================================= */
  async function loadNotes() {
    const s = await Store.get('aura_notes');
    notes = s && Array.isArray(s) ? s : [];
    renderNotes();
  }

  function saveNotes() { Store.set('aura_notes', notes); }

  function renderNotes() {
    DOM.notesList.innerHTML = '';
    if (!notes.length) { DOM.notesEmpty.classList.remove('hidden'); return; }
    DOM.notesEmpty.classList.add('hidden');

    [...notes].sort((a, b) => b.up - a.up).forEach(n => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.innerHTML = `
        <div class="note-card-title">${esc(n.title || 'Untitled')}</div>
        <div class="note-card-preview">${esc(n.body || '')}</div>
        <div class="note-card-date">${fmtDate(n.up)}</div>`;
      card.addEventListener('click', () => openNoteModal(n.id));
      DOM.notesList.appendChild(card);
    });
  }

  function openNoteModal(id) {
    if (id) {
      const n = notes.find(x => x.id === id);
      if (!n) return;
      editNoteId = id;
      DOM.noteTitle.textContent = 'Edit Note';
      DOM.noteTitleIn.value = n.title;
      DOM.noteBodyIn.value = n.body;
      DOM.noteDelete.classList.remove('hidden');
    } else {
      editNoteId = null;
      DOM.noteTitle.textContent = 'New Note';
      DOM.noteTitleIn.value = '';
      DOM.noteBodyIn.value = '';
      DOM.noteDelete.classList.add('hidden');
    }
    DOM.noteOvl.classList.remove('hidden');
    setTimeout(() => DOM.noteTitleIn.focus(), 120);
  }

  function closeNoteModal() { DOM.noteOvl.classList.add('hidden'); editNoteId = null; }

  function commitNote() {
    const title = DOM.noteTitleIn.value.trim();
    const body = DOM.noteBodyIn.value.trim();
    if (!title && !body) return;
    const now = Date.now();
    if (editNoteId) {
      const n = notes.find(x => x.id === editNoteId);
      if (n) { n.title = title; n.body = body; n.up = now; }
    } else {
      notes.push({ id: uid(), title: title || 'Untitled', body, cr: now, up: now });
    }
    saveNotes(); renderNotes(); closeNoteModal();
  }

  function deleteNote() {
    if (!editNoteId) return;
    notes = notes.filter(x => x.id !== editNoteId);
    saveNotes(); renderNotes(); closeNoteModal();
  }

  DOM.addNoteBtn.addEventListener('click', () => openNoteModal(null));
  DOM.noteCancel.addEventListener('click', closeNoteModal);
  DOM.noteSave.addEventListener('click', commitNote);
  DOM.noteDelete.addEventListener('click', deleteNote);
  DOM.noteOvl.addEventListener('click', e => { if (e.target === DOM.noteOvl) closeNoteModal(); });

  /* =================================================================
     JOKES (JokeAPI v2)
     ================================================================= */
  async function fetchJoke() {
    DOM.jokeSetup.textContent = 'Loading a joke…';
    DOM.jokeSetup.classList.add('joke-loading');
    DOM.jokePunch.textContent = '';
    DOM.jokePunch.classList.remove('show');

    try {
      const r = await fetch('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist&type=twopart,single');
      if (!r.ok) throw 0;
      const d = await r.json();
      DOM.jokeSetup.classList.remove('joke-loading');

      if (d.type === 'twopart') {
        DOM.jokeSetup.textContent = d.setup;
        DOM.jokePunch.textContent = d.delivery;
        setTimeout(() => DOM.jokePunch.classList.add('show'), 900);
      } else {
        DOM.jokeSetup.textContent = d.joke;
      }
    } catch {
      DOM.jokeSetup.classList.remove('joke-loading');
      const fb = [
        { s: 'Why do programmers prefer dark mode?', p: 'Because light attracts bugs.' },
        { s: "What's a programmer's favorite place?", p: 'Foo Bar.' },
        { s: 'Why do Java devs wear glasses?', p: "Because they can't C#." },
        { s: 'How many programmers to change a lightbulb?', p: "None — that's a hardware problem." },
        { s: 'Why was the JavaScript dev sad?', p: "He didn't Node how to Express himself." },
      ];
      const j = fb[Math.floor(Math.random() * fb.length)];
      DOM.jokeSetup.textContent = j.s;
      DOM.jokePunch.textContent = j.p;
      setTimeout(() => DOM.jokePunch.classList.add('show'), 900);
    }
  }

  DOM.jokeRefresh.addEventListener('click', fetchJoke);

  /* =================================================================
     WEATHER (wttr.in)
     ================================================================= */
  async function loadWeather() {
    try {
      const pos = await new Promise((ok, no) => {
        if (!navigator.geolocation) return no();
        navigator.geolocation.getCurrentPosition(ok, no, { timeout: 5000 });
      });
      const { latitude: lat, longitude: lon } = pos.coords;
      const d = await Cache.fetch('weather_cache', `https://wttr.in/${lat},${lon}?format=j1`, 15 * 60 * 1000);
      applyWeather(d);
    } catch {
      try {
        const d = await Cache.fetch('weather_cache_ip', 'https://wttr.in/?format=j1', 15 * 60 * 1000);
        applyWeather(d);
      } catch {
        DOM.weatherIcon.textContent = '🌤';
        DOM.weatherTemp.textContent = '';
        DOM.weatherCity.textContent = 'Weather unavailable';
      }
    }
  }

  function applyWeather(d) {
    const c = d.current_condition[0];
    const a = d.nearest_area[0];
    DOM.weatherIcon.textContent = wEmoji(c.weatherCode);
    DOM.weatherTemp.textContent = `${c.temp_C}°`;
    DOM.weatherCity.textContent = a.areaName[0].value;
  }

  function wEmoji(code) {
    const c = +code;
    if (c === 113) return '☀️';
    if (c === 116) return '⛅';
    if (c === 119 || c === 122) return '☁️';
    if ([143,248,260].includes(c)) return '🌫️';
    if ([176,263,266,293,296,299,302,305,308,353,356,359].includes(c)) return '🌧️';
    if ([179,182,185,227,230,281,284,311,314,317,320,323,326,329,332,335,338,362,365,368,371,374,377].includes(c)) return '🌨️';
    if ([200,386,389,392,395].includes(c)) return '⛈️';
    return '🌤️';
  }

  /* =================================================================
     EXTENDED SETTINGS & CACHE
     ================================================================= */
  async function loadSettings() {
    aiModel = (await Store.get('aura_ai_model')) || 'google/gemini-2.5-flash';
    customModelName = (await Store.get('aura_custom_model')) || '';
    
    const storedOrKey = await Store.get('aura_or_key');
    orKey = storedOrKey ? storedOrKey.trim() : '';

    const chatData = await Store.get('aura_ai_chat');
    aiChatHistory = Array.isArray(chatData) ? chatData : [];

    // Sync settings modal UI values
    DOM.aiModelSelect.value = aiModel;
    DOM.aiModelSelectDr.value = aiModel;
    DOM.customModelIn.value = customModelName;
    DOM.orKeyIn.value = orKey;

    if (aiModel === 'custom') {
      DOM.customModelCon.classList.remove('hidden-field');
    } else {
      DOM.customModelCon.classList.add('hidden-field');
    }
  }

  function saveSettings() {
    aiModel = DOM.aiModelSelect.value;
    customModelName = DOM.customModelIn.value.trim();
    
    const keyVal = DOM.orKeyIn.value.trim();
    orKey = keyVal;

    Store.set('aura_ai_model', aiModel);
    Store.set('aura_custom_model', customModelName);
    Store.set('aura_or_key', orKey);

    DOM.settingsOvl.classList.add('hidden');

    // Keep side drawer select in sync
    if (DOM.aiModelSelectDr) DOM.aiModelSelectDr.value = aiModel;
  }

  DOM.settingsBtn.addEventListener('click', async () => {
    await loadSettings();
    DOM.settingsName.value = userName;
    DOM.settingsOvl.classList.remove('hidden');
    setTimeout(() => DOM.settingsName.focus(), 120);
  });

  DOM.settingsCancel.addEventListener('click', () => DOM.settingsOvl.classList.add('hidden'));
  DOM.settingsOvl.addEventListener('click', e => { if (e.target === DOM.settingsOvl) DOM.settingsOvl.classList.add('hidden'); });
  DOM.settingsSave.addEventListener('click', () => {
    const n = DOM.settingsName.value.trim();
    if (n) { userName = n; Store.set('aura_user', userName); DOM.heroName.textContent = userName; }
    saveSettings();
  });

  DOM.aiModelSelect.addEventListener('change', e => {
    if (e.target.value === 'custom') {
      DOM.customModelCon.classList.remove('hidden-field');
    } else {
      DOM.customModelCon.classList.add('hidden-field');
    }
  });

  /* ─── Cached Fetch Utility ─── */
  const Cache = {
    async get(key, ttlMs) {
      const data = await Store.get('cache_' + key);
      if (data && data.expiry > Date.now()) {
        return data.value;
      }
      return null;
    },
    async set(key, value, ttlMs) {
      await Store.set('cache_' + key, {
        value: value,
        expiry: Date.now() + ttlMs
      });
    },
    async fetch(key, url, ttlMs, options = {}) {
      const cached = await this.get(key, ttlMs);
      if (cached) return cached;
      try {
        const r = await fetch(url, options);
        if (!r.ok) throw new Error('Fetch failed');
        const text = await r.text();
        let value = text;
        try { value = JSON.parse(text); } catch {}
        await this.set(key, value, ttlMs);
        return value;
      } catch (e) {
        console.error('Fetch failed for cached resource: ' + url, e);
        const data = await Store.get('cache_' + key);
        if (data) return data.value;
        throw e;
      }
    }
  };


  /* =================================================================
     AI ASSISTANT DRAWER (Comet)
     ================================================================= */
  function setupAiDrawerListeners() {
    DOM.aiCloseBtn.addEventListener('click', closeAiDrawer);
    DOM.aiClearBtn.addEventListener('click', clearAiChatHistory);
    DOM.aiChatSend.addEventListener('click', handleAiDrawerSubmit);

    DOM.aiChatIn.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAiDrawerSubmit();
      }
    });

    DOM.aiModelSelectDr.addEventListener('change', e => {
      aiModel = e.target.value;
      DOM.aiModelSelect.value = aiModel;
      Store.set('aura_ai_model', aiModel);
    });
  }

  function openAiDrawer(query = '') {
    DOM.aiDrawer.classList.remove('hidden-drawer');

    // Sync dropdown
    DOM.aiModelSelectDr.value = aiModel;

    // Render history
    renderAiChat();

    if (query) {
      DOM.aiChatIn.value = '';
      streamAiResponse(query);
    } else {
      setTimeout(() => DOM.aiChatIn.focus(), 150);
    }
  }

  function closeAiDrawer() {
    DOM.aiDrawer.classList.add('hidden-drawer');
  }

  function clearAiChatHistory() {
    if (!confirm('Clear chat history?')) return;
    aiChatHistory = [];
    Store.set('aura_ai_chat', aiChatHistory);
    renderAiChat();
  }

  function handleAiDrawerSubmit() {
    const prompt = DOM.aiChatIn.value.trim();
    if (!prompt) return;
    DOM.aiChatIn.value = '';
    streamAiResponse(prompt);
  }

  function addMessage(role, content, isHtml = false) {
    const msg = document.createElement('div');
    msg.className = `ai-message ${role}`;

    if (isHtml) msg.innerHTML = content;
    else msg.textContent = content;

    DOM.aiChatMsgs.appendChild(msg);
    DOM.aiChatMsgs.scrollTop = DOM.aiChatMsgs.scrollHeight;
    return msg;
  }

  function renderAiChat() {
    DOM.aiChatMsgs.innerHTML = '';

    // System welcome
    addMessage('system', 'Greetings Traveler. I am Aura AI. Select a model, type a prompt, or run an AI query from search to stream insights.', true);

    aiChatHistory.forEach(m => {
      const msgEl = addMessage(m.role, '');
      if (m.role === 'assistant') renderMarkdown(msgEl, m.content);
      else msgEl.textContent = m.content;
    });
    DOM.aiChatMsgs.scrollTop = DOM.aiChatMsgs.scrollHeight;
  }

  async function streamAiResponse(prompt) {
    if (!orKey) {
      addMessage('assistant', 'Please configure your OpenRouter API Key in Settings to stream insights from Aura.', true);
      return;
    }

    const activeModel = aiModel === 'custom' ? customModelName : aiModel;
    if (!activeModel) {
      addMessage('assistant', 'Specify a custom model code or choose predefined one in Settings.', true);
      return;
    }

    if (aiAbortController) {
      aiAbortController.abort();
    }
    aiAbortController = new AbortController();
    const signal = aiAbortController.signal;

    // Add user question
    addMessage('user', prompt);
    const msgEl = addMessage('assistant', '✦');
    msgEl.classList.add('ai-streaming');

    const chatMsgs = aiChatHistory.map(m => ({ role: m.role, content: m.content }));
    chatMsgs.push({ role: 'user', content: prompt });

    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aura-newtab.ext',
          'X-Title': 'Aura NewTab Extension'
        },
        body: JSON.stringify({
          model: activeModel,
          messages: chatMsgs,
          stream: true,
          max_tokens: 1500
        }),
        signal
      });

      if (!r.ok) {
        const errorText = await r.text();
        throw new Error(errorText || 'Server error ' + r.status);
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantText = '';
      let partialLine = '';

      let isDone = false;
      while (true) {
        if (isDone) break;
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialLine + chunk).split('\n');
        partialLine = lines.pop(); // remainder

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.slice(6);
            if (dataStr === '[DONE]') {
              isDone = true;
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              const text = data.choices[0]?.delta?.content || '';
              if (text) {
                assistantText += text;
                renderMarkdown(msgEl, assistantText);
                DOM.aiChatMsgs.scrollTop = DOM.aiChatMsgs.scrollHeight;
              }
            } catch (e) {}
          }
        }
      }

      // Finish streaming state
      msgEl.classList.remove('ai-streaming');
      aiChatHistory.push({ role: 'user', content: prompt });
      aiChatHistory.push({ role: 'assistant', content: assistantText });

      if (aiChatHistory.length > 30) aiChatHistory = aiChatHistory.slice(-30);
      await Store.set('aura_ai_chat', aiChatHistory);

    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error(e);
      msgEl.classList.remove('ai-streaming');
      msgEl.classList.add('error');
      msgEl.textContent = 'Connection timeout or parsing error: ' + e.message;
    }
  }

  function renderMarkdown(el, text) {
    // 1. Escape HTML special chars first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Extract fenced code blocks (handling closed and unclosed)
    const codeBlocks = [];
    
    // First, match fully closed code blocks
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      const placeholder = `__AURA_CODEBLOCK_${codeBlocks.length}__`;
      codeBlocks.push(code.trim());
      return placeholder;
    });

    // Next, check if there is an unclosed code block at the end (for streaming support)
    const lastIndex = html.lastIndexOf('```');
    if (lastIndex >= 0) {
      const code = html.slice(lastIndex + 3);
      const placeholder = `__AURA_CODEBLOCK_${codeBlocks.length}__`;
      codeBlocks.push(code.trim());
      html = html.slice(0, lastIndex) + placeholder;
    }

    // 3. Extract inline code
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = `__AURA_INLINE_${inlineCodes.length}__`;
      inlineCodes.push(code);
      return placeholder;
    });

    // Pre-process: ensure list items have double newlines before/after them if they touch normal text
    let lines = html.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const isPrevList = /^(?:\*|-|\d+\.)\s+/.test(lines[i-1].trim());
      const isCurrList = /^(?:\*|-|\d+\.)\s+/.test(lines[i].trim());
      if (isCurrList && !isPrevList && lines[i-1].trim() !== '') {
        lines[i] = '\n' + lines[i];
      } else if (!isCurrList && isPrevList && lines[i].trim() !== '') {
        lines[i] = '\n' + lines[i];
      }
    }
    html = lines.join('\n');

    // 4. Bold text
    html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');

    // 5. Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 6. List items (Numbered and Bullets)
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li data-ordered="true">$1</li>');
    html = html.replace(/^(?:\*|-)\s+(.+)$/gm, '<li data-ordered="false">$1</li>');

    // Wrap contiguous <li data-ordered="true"> groups in <ol>
    html = html.replace(/(?:<li data-ordered="true">[\s\S]*?<\/li>(?:[^\S\r\n]*\r?\n(?!\r?\n)[^\S\r\n]*)?)+/g, (match) => {
      return `<ol>${match.trim().replace(/ data-ordered="true"/g, '')}</ol>`;
    });

    // Wrap contiguous <li data-ordered="false"> groups in <ul>
    html = html.replace(/(?:<li data-ordered="false">[\s\S]*?<\/li>(?:[^\S\r\n]*\r?\n(?!\r?\n)[^\S\r\n]*)?)+/g, (match) => {
      return `<ul>${match.trim().replace(/ data-ordered="false"/g, '')}</ul>`;
    });

    // 7. Paragraphs
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => {
      p = p.trim();
      if (!p) return '';
      // Skip wrapping if it's a structural element
      if (p.startsWith('<ul>') || p.startsWith('<ol>') || p.startsWith('<li>') || p.startsWith('<h2>') || p.startsWith('<h3>') || p.startsWith('<h1>') || p.startsWith('__AURA_CODEBLOCK_')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    // 8. Restore inline code
    inlineCodes.forEach((code, index) => {
      html = html.replace(`__AURA_INLINE_${index}__`, `<code>${code}</code>`);
    });

    // 9. Restore fenced code blocks
    codeBlocks.forEach((code, index) => {
      html = html.replace(`__AURA_CODEBLOCK_${index}__`, `<pre><code>${code}</code></pre>`);
    });

    el.innerHTML = html;
  }

  /* =================================================================
     INIT & BOOT
     ================================================================= */
  async function boot() {
    try { new ParticleField(DOM.canvas); } catch (e) { console.error("Particles init failed:", e); }
    try { parallax.init(); } catch (e) { console.error("Parallax init failed:", e); }

    try { await loadSettings(); } catch (e) { console.error("Settings load failed:", e); }
    try { await initUser(); } catch (e) { console.error("User init failed:", e); }
    try { await loadFavs(); } catch (e) { console.error("Favorites load failed:", e); }
    try { await loadNotes(); } catch (e) { console.error("Notes load failed:", e); }

    try {
      tickClock();
      setInterval(tickClock, 1000);
    } catch (e) { console.error("Clock load failed:", e); }

    try { fetchJoke(); } catch (e) { console.error("Joke fetch failed:", e); }
    try { loadWeather(); } catch (e) { console.error("Weather load failed:", e); }

    try { setupAiDrawerListeners(); } catch (e) { console.error("AI Drawer listeners load failed:", e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
