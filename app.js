/* 靠岸｜彼岸の島 - app.js (pure static) */

const STORAGE = {
  introSeen: "kaoan.introSeen.v2",
  collected: "kaoan.collected.v2", // { [cardId]: { firstDate: "YYYY-MM-DD", count: number } }
  notes: "kaoan.notes.v2",         // { [cardId]: { text, photoDataUrl, mood, updatedAt } }
};

const BACK_IMAGE = "assets/life_tree_gold.png"; // 先預留：之後你放金色生命樹圖到 assets/ 這裡就會自動生效

const MOODS = [
  { key: "heart", label: "🤍 被接住" },
  { key: "sprout", label: "🌱 有一點點" },
  { key: "calm", label: "😌 放鬆了" },
  { key: "paw", label: "🐾 抱一下" },
];

const state = {
  manifest: null,
  cards: [],
  currentCardId: null,
  currentTab: "all",
};

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showView(id) {
  ["#view-intro", "#view-today", "#view-wall", "#view-about"].forEach(v => $(v)?.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
}

function nowISO() { return new Date().toISOString(); }
function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getCollected() { return readJSON(STORAGE.collected, {}); }
function setCollected(obj) { writeJSON(STORAGE.collected, obj); }
function getNotes() { return readJSON(STORAGE.notes, {}); }
function setNotes(obj) { writeJSON(STORAGE.notes, obj); }

function markCollected(cardId) {
  const c = getCollected();
  const todayStr = todayYMD();
  const prev = c[cardId];

  if (!prev || prev === true) {
    c[cardId] = { firstDate: todayStr, count: 1 };
  } else {
    c[cardId].firstDate = prev.firstDate || todayStr;
    c[cardId].count = (prev.count || 0) + 1;
  }
  setCollected(c);
  return c[cardId];
}

function pickRandom(cards) {
  const idx = Math.floor(Math.random() * cards.length);
  return cards[idx];
}

async function loadManifest() {
  const res = await fetch("cards_manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error("manifest load failed");
  const data = await res.json();
  state.manifest = data;
  state.cards = data.cards || [];
}

function seriesLabel(s) {
  if (s === "flow") return "Flow";
  if (s === "free") return "Free";
  if (s === "for") return "For";
  return s;
}

function updateStats() {
  const total = state.cards.length;
  const collected = getCollected();
  const got = Object.keys(collected).length;
  const pct = total ? Math.round((got / total) * 100) : 0;
  const el = $("#stats");
  if (el) el.textContent = `已收集 ${got} / ${total}（${pct}%）`;
}

function renderGrid() {
  const grid = $("#grid");
  if (!grid) return;
  grid.innerHTML = "";

  const collected = getCollected();
  const cards = state.cards.filter(c => {
    if (state.currentTab === "all") return true;
    return c.series === state.currentTab;
  });

  for (const card of cards) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.cardId = card.id;

    const img = document.createElement("img");
    const isCollected = !!collected[card.id];

    // ✅ 未抽到 → 顯示背面（不偷看正面）
    img.src = isCollected ? card.image : BACK_IMAGE;
    img.alt = isCollected
      ? `${seriesLabel(card.series)} ${card.number}`
      : `未抽到（卡背）`;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = `${seriesLabel(card.series)} ${card.number}`;

    tile.appendChild(img);
    tile.appendChild(badge);

    if (!isCollected) {
      const lock = document.createElement("div");
      lock.className = "lock";
      lock.textContent = "未抽到";
      tile.appendChild(lock);
    }

    tile.addEventListener("click", () => openCardModal(card.id));
    grid.appendChild(tile);
  }
}

function setTab(tab) {
  state.currentTab = tab;
  $all(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
  });
  updateStats();
  renderGrid();
}

/* Modal controls */
function openModal() {
  $("#modal")?.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#modal")?.classList.add("hidden");
  document.body.style.overflow = "";
  state.currentCardId = null;
}

function ensureMoodUI() {
  // 只在第一次開 modal 時建立一次情緒列
  const head = document.querySelector(".record-head");
  if (!head) return;
  if (document.querySelector("#mood-row")) return;

  const moodRow = document.createElement("div");
  moodRow.id = "mood-row";
  moodRow.className = "mood-row";

  MOODS.forEach(m => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mood-btn";
    btn.dataset.mood = m.key;
    btn.textContent = m.label;

    btn.addEventListener("click", () => {
      const cardId = state.currentCardId;
      if (!cardId) return;

      // 單選：點新的就覆蓋
      const notes = getNotes();
      const existing = notes[cardId] || { text: "", photoDataUrl: null, mood: null, updatedAt: null };
      existing.mood = m.key;
      existing.updatedAt = nowISO();
      notes[cardId] = existing;
      setNotes(notes);

      // UI 更新
      document.querySelectorAll(".mood-btn").forEach(x => x.classList.toggle("active", x.dataset.mood === m.key));
      const meta = $("#note-meta");
      if (meta) meta.textContent = `已保存：${new Date(existing.updatedAt).toLocaleString()}`;
    });

    moodRow.appendChild(btn);
  });

  // 插在 record-head 後面
  head.insertAdjacentElement("afterend", moodRow);
}

function openCardModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;

  state.currentCardId = cardId;

  const collected = getCollected();
  const isCollected = !!collected[cardId];

  // modal 卡圖：未抽到也要顯示背面
  const modalImg = $("#modal-img");
  if (modalImg) {
    modalImg.src = isCollected ? card.image : BACK_IMAGE;
    modalImg.alt = isCollected ? `${seriesLabel(card.series)} ${card.number}` : `未抽到（卡背）`;
  }

  $("#record-locked")?.classList.toggle("hidden", isCollected);
  $("#record-form")?.classList.toggle("hidden", !isCollected);

  ensureMoodUI();

  // Fill existing note
  const notes = getNotes();
  const note = notes[cardId] || { text: "", photoDataUrl: null, mood: null, updatedAt: null };

  const noteText = $("#note-text");
  if (noteText) noteText.value = note.text || "";

  renderPhotoPreview(note.photoDataUrl);

  // mood highlight
  document.querySelectorAll(".mood-btn").forEach(x => x.classList.toggle("active", x.dataset.mood === note.mood));

  // Meta
  const meta = $("#note-meta");
  if (meta) meta.textContent = note.updatedAt ? `上次保存：${new Date(note.updatedAt).toLocaleString()}` : "";

  openModal();
}

function renderPhotoPreview(dataUrl) {
  const wrap = $("#photo-preview-wrap");
  const img = $("#photo-preview");
  if (!wrap || !img) return;

  if (dataUrl) {
    img.src = dataUrl;
    wrap.classList.remove("hidden");
  } else {
    img.src = "";
    wrap.classList.add("hidden");
  }
}

// Resize image before saving (avoid huge localStorage)
async function fileToResizedDataUrl(file, maxW = 900, quality = 0.78) {
  const blobUrl = URL.createObjectURL(file);
  const img = new Image();
  img.src = blobUrl;
  await img.decode();

  const ratio = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(blobUrl);

  return canvas.toDataURL("image/jpeg", quality);
}

/* Navigation */
function wireNav() {
  const toToday = () => showView("#view-today");
  const toWall = () => {
    showView("#view-wall");
    updateStats();
    renderGrid();
  };
  const toAbout = () => showView("#view-about");

  $("#nav-today")?.addEventListener("click", toToday);
  $("#nav-wall")?.addEventListener("click", toWall);
  $("#nav-about")?.addEventListener("click", toAbout);

  $("#nav2-today")?.addEventListener("click", toToday);
  $("#nav2-wall")?.addEventListener("click", toWall);
  $("#nav2-about")?.addEventListener("click", toAbout);

  $("#nav3-today")?.addEventListener("click", toToday);
  $("#nav3-wall")?.addEventListener("click", toWall);
  $("#nav3-about")?.addEventListener("click", toAbout);
}

function wireIntro() {
  $("#btn-into")?.addEventListener("click", () => {
    localStorage.setItem(STORAGE.introSeen, "true");
    showView("#view-today");
  });
}

/* Today */
function showTodayResult(card, collectedMeta) {
  const todayImg = $("#today-img");
  if (todayImg) {
    todayImg.src = card.image;
    todayImg.alt = `${seriesLabel(card.series)} ${card.number}`;
  }

  const drawDateEl = $("#drawDate");
  if (drawDateEl) {
    const todayStr = todayYMD();
    const firstDate = collectedMeta?.firstDate || todayStr;
    const count = collectedMeta?.count || 1;

    // ✅ 顯示「抽到日期」＋「第幾次相遇」＋「第一次日期」
    if (count > 1) {
      drawDateEl.textContent = `抽到日期：${todayStr}｜第 ${count} 次相遇（第一次：${firstDate}）`;
    } else {
      drawDateEl.textContent = `抽到日期：${todayStr}｜第一次相遇：${firstDate}`;
    }
  }

  $("#today-result")?.classList.remove("hidden");
}

function hideTodayResult() {
  $("#today-result")?.classList.add("hidden");
}

function draw(series = null) {
  const pool = series ? state.cards.filter(c => c.series === series) : state.cards;
  if (!pool.length) return;
  const card = pickRandom(pool);
  const meta = markCollected(card.id);
  state.currentCardId = card.id;
  showTodayResult(card, meta);
}

function wireToday() {
  $("#draw-any")?.addEventListener("click", () => draw(null));

  $all("[data-draw-series]").forEach(btn => {
    btn.addEventListener("click", () => draw(btn.dataset.drawSeries));
  });

  $("#btn-draw-again")?.addEventListener("click", () => draw(null));

  $("#btn-open-wall")?.addEventListener("click", () => {
    showView("#view-wall");
    setTab("all");
  });

  // ✅ 「回應這張卡」：直接帶你去故事牆，並打開該卡的寫下視窗
  $("#btn-save-note")?.addEventListener("click", () => {
    if (!state.currentCardId) return;
    showView("#view-wall");
    setTab("all");
    // 等畫面切換後再開 modal（避免手機上開不起來）
    setTimeout(() => openCardModal(state.currentCardId), 50);
  });
}

/* Wall */
function wireWall() {
  $all(".tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

  $("#modal-close")?.addEventListener("click", closeModal);
  $("#modal-backdrop")?.addEventListener("click", closeModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal")?.classList.contains("hidden")) closeModal();
  });

  $("#note-save")?.addEventListener("click", () => {
    const cardId = state.currentCardId;
    if (!cardId) return;

    const notes = getNotes();
    const existing = notes[cardId] || { text: "", photoDataUrl: null, mood: null, updatedAt: null };

    notes[cardId] = {
      text: $("#note-text")?.value || "",
      photoDataUrl: existing.photoDataUrl || null,
      mood: existing.mood || null,
      updatedAt: nowISO(),
    };
    setNotes(notes);

    const meta = $("#note-meta");
    if (meta) meta.textContent = `已保存：${new Date(notes[cardId].updatedAt).toLocaleString()}`;
    alert("已保存。");
  });

  $("#note-clear")?.addEventListener("click", () => {
    const cardId = state.currentCardId;
    if (!cardId) return;
    if (!confirm("要清除這張卡的文字與照片嗎？")) return;

    const notes = getNotes();
    delete notes[cardId];
    setNotes(notes);

    if ($("#note-text")) $("#note-text").value = "";
    renderPhotoPreview(null);

    document.querySelectorAll(".mood-btn").forEach(x => x.classList.remove("active"));
    const meta = $("#note-meta");
    if (meta) meta.textContent = "";

    alert("已清除。");
  });

  $("#photo-input")?.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const dataUrl = await fileToResizedDataUrl(file, 900, 0.78);
      const cardId = state.currentCardId;
      if (!cardId) return;

      const notes = getNotes();
      const existing = notes[cardId] || { text: "", photoDataUrl: null, mood: null, updatedAt: null };

      existing.photoDataUrl = dataUrl;
      existing.updatedAt = nowISO();
      notes[cardId] = existing;
      setNotes(notes);

      renderPhotoPreview(dataUrl);

      const meta = $("#note-meta");
      if (meta) meta.textContent = `已保存：${new Date(existing.updatedAt).toLocaleString()}`;

      // reset input so same file can be re-selected
      $("#photo-input").value = "";
    } catch (err) {
      console.error(err);
      alert("照片處理失敗，請換一張較小的照片再試一次。");
    }
  });

  $("#photo-remove")?.addEventListener("click", () => {
    const cardId = state.currentCardId;
    if (!cardId) return;

    const notes = getNotes();
    const existing = notes[cardId];
    if (existing) {
      existing.photoDataUrl = null;
      existing.updatedAt = nowISO();
      notes[cardId] = existing;
      setNotes(notes);

      renderPhotoPreview(null);

      const meta = $("#note-meta");
      if (meta) meta.textContent = `已保存：${new Date(existing.updatedAt).toLocaleString()}`;
    }
  });
}

/* About */
function wireAbout() {
  $("#reset-intro")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE.introSeen);
    alert("已重置。下一次打開會再看到迎接畫面。");
  });

  $("#export-data")?.addEventListener("click", () => {
    const payload = {
      version: 2,
      exportedAt: nowISO(),
      collected: getCollected(),
      notes: getNotes(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kaoan_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("#import-data")?.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") throw new Error("bad json");
      if (data.collected) setCollected(data.collected);
      if (data.notes) setNotes(data.notes);
      alert("已匯入。");
    } catch (err) {
      console.error(err);
      alert("匯入失敗：請確認檔案是從這個 App 匯出的 JSON。");
    } finally {
      $("#import-data").value = "";
    }
  });
}

/* Boot */
async function boot() {
  await loadManifest();

  wireNav();
  wireIntro();
  wireToday();
  wireWall();
  wireAbout();

  // Decide start view
  const seen = localStorage.getItem(STORAGE.introSeen) === "true";
  showView(seen ? "#view-today" : "#view-intro");

  // default wall tab
  setTab("all");
  hideTodayResult();
}

boot().catch(err => {
  console.error(err);
  alert("初始化失敗：請確認 cards_manifest.json 與 cards 資料夾有一起上傳。");
});
