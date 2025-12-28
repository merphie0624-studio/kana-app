/* kana-app: mobile-first single page app (no framework) */

const STORAGE_KEY = "kana_records_v1";
const INTRO_SEEN_KEY = "kana_intro_seen_v1";

// IMPORTANT:
// If you have a gold tree back image, put it at: assets/tree-gold.png
// For locked/uncollected cards (wall), we show the back side:
// If you already have a back image in cards/, set it here:
const FALLBACK_BACK_IMAGE = "assets/tree-gold.png"; // optional

const views = {
  intro: document.getElementById("view-intro"),
  today: document.getElementById("view-today"),
  wall: document.getElementById("view-wall"),
  about: document.getElementById("view-about"),
};

const introPaper = document.getElementById("introPaper");
const btnInto = document.getElementById("btn-into");

const drawAny = document.getElementById("draw-any");
const todayImg = document.getElementById("today-img");
const drawDateEl = document.getElementById("drawDate");
const todayResult = document.getElementById("today-result");
const todayLoading = document.getElementById("today-loading");
const resultActions = document.getElementById("result-actions");

const btnSaveNote = document.getElementById("btn-save-note");
const btnOpenWall = document.getElementById("btn-open-wall");
const btnDrawAgain = document.getElementById("btn-draw-again");

const gridEl = document.getElementById("grid");
const statsEl = document.getElementById("stats");

const tabs = Array.from(document.querySelectorAll(".tab"));

const modal = document.getElementById("modal");
const modalImg = document.getElementById("modal-img");
const modalClose = document.getElementById("modal-close");
const modalBackdrop = document.getElementById("modal-backdrop");

const recordLocked = document.getElementById("record-locked");
const recordForm = document.getElementById("record-form");
const noteText = document.getElementById("note-text");
const noteMeta = document.getElementById("note-meta");
const noteSave = document.getElementById("note-save");
const noteClear = document.getElementById("note-clear");

const photoInput = document.getElementById("photo-input");
const photoPreviewWrap = document.getElementById("photo-preview-wrap");
const photoPreview = document.getElementById("photo-preview");
const photoRemove = document.getElementById("photo-remove");

const exportBtn = document.getElementById("export-data");
const importInput = document.getElementById("import-data");
const resetIntroBtn = document.getElementById("reset-intro");

const drawer = document.getElementById("drawer");
const hamburger = document.getElementById("hamburger");
const hamburger2 = document.getElementById("hamburger2");
const hamburger3 = document.getElementById("hamburger3");
const drawerClose = document.getElementById("drawer-close");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const navStory = document.getElementById("nav-story");
const navToday = document.getElementById("nav-today");
const navWall = document.getElementById("nav-wall");
const navAbout = document.getElementById("nav-about");

let cards = [];
let activeTab = "all";
let lastDrawnCardId = null;

// ----- Utilities
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJSONParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function loadRecords() {
  return safeJSONParse(localStorage.getItem(STORAGE_KEY) || "{}", {});
}

function saveRecords(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function markIntroSeen() {
  localStorage.setItem(INTRO_SEEN_KEY, "1");
}

function resetIntroSeen() {
  localStorage.removeItem(INTRO_SEEN_KEY);
}

function isIntroSeen() {
  return localStorage.getItem(INTRO_SEEN_KEY) === "1";
}

function showView(name) {
  Object.values(views).forEach(v => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
  // scroll top for app-like feel
  views[name].scrollTop = 0;
}

function openDrawer() {
  drawer.classList.remove("hidden");
}
function closeDrawer() {
  drawer.classList.add("hidden");
}

function openModal() {
  modal.classList.remove("hidden");
}
function closeModal() {
  modal.classList.add("hidden");
}

// ----- Cards loading
async function loadCardsManifest() {
  const res = await fetch("cards_manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error("cards_manifest.json 讀取失敗");
  const data = await res.json();
  // Expected: { cards: [ {id, series, title?, img } ... ] } or array
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.cards)) return data.cards;
  throw new Error("cards_manifest.json 格式不符合");
}

function cardFrontSrc(card) {
  // try common keys
  return card.img || card.image || card.front || card.src;
}

function cardBackSrc(card) {
  // if manifest has back, use it, else fallback
  return card.back || card.backImg || FALLBACK_BACK_IMAGE;
}

function isCollected(cardId, records) {
  return Boolean(records[cardId] && records[cardId].firstSeen);
}

function ensureRecord(cardId, records) {
  if (!records[cardId]) records[cardId] = {};
  return records[cardId];
}

// ----- Intro sequence (boat then paper)
function runIntroSequence() {
  // After ~2.6s sail animation, show the paper
  setTimeout(() => {
    introPaper.classList.remove("hidden");
  }, 2600);
}

// ----- Drawing logic
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function filterBySeries(series) {
  if (series === "all") return cards;
  return cards.filter(c => String(c.series).toLowerCase() === series);
}

async function drawCard(series = "all") {
  const pool = filterBySeries(series);
  if (!pool.length) return;

  // loading
  todayResult.classList.add("hidden");
  resultActions.classList.add("hidden");
  todayLoading.classList.remove("hidden");

  // pick
  const card = pickRandom(pool);
  lastDrawnCardId = String(card.id);

  // record firstSeen/drawCount
  const records = loadRecords();
  const rec = ensureRecord(lastDrawnCardId, records);

  const now = todayISO();
  rec.drawCount = (rec.drawCount || 0) + 1;
  rec.lastSeen = now;
  if (!rec.firstSeen) rec.firstSeen = now;

  saveRecords(records);

  // wait 5 seconds (as requested)
  await sleep(5000);

  // show result
  todayImg.src = cardFrontSrc(card);
  const drawInfo = `抽到日期：${now}　｜　第一次相遇：${rec.firstSeen}`;
  drawDateEl.textContent = drawInfo;

  todayLoading.classList.add("hidden");
  todayResult.classList.remove("hidden");

  // buttons appear AFTER the "停一下"
  resultActions.classList.remove("hidden");
}

function bindSeriesChips() {
  document.querySelectorAll(".series-chip").forEach(btn => {
    const s = btn.getAttribute("data-series");
    if (!s) return;
    btn.addEventListener("click", () => {
      drawCard(s);
    });
  });
}

// ----- Wall rendering
function computeStats(records) {
  const total = cards.length;
  const collected = cards.filter(c => isCollected(String(c.id), records)).length;
  const pct = total ? Math.round((collected / total) * 100) : 0;
  return { total, collected, pct };
}

function renderWall() {
  const records = loadRecords();

  const { total, collected, pct } = computeStats(records);
  statsEl.textContent = `已收集 ${collected} / ${total}（${pct}%）`;

  const filtered = filterBySeries(activeTab);
  gridEl.innerHTML = "";

  filtered.forEach(card => {
    const id = String(card.id);
    const collected = isCollected(id, records);

    const item = document.createElement("button");
    item.type = "button";
    item.className = "grid-item";
    item.setAttribute("aria-label", `卡片 ${id}`);

    const img = document.createElement("img");
    img.alt = "卡片";
    img.src = collected ? cardFrontSrc(card) : cardBackSrc(card);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = `${card.series ?? ""} ${card.no ?? card.index ?? card.title ?? ""}`.trim() || `#${id}`;

    item.appendChild(img);
    item.appendChild(badge);

    if (!collected) {
      const tag = document.createElement("div");
      tag.className = "lockedTag";
      tag.textContent = "未抽到";
      item.appendChild(tag);
    }

    item.addEventListener("click", () => {
      openCardModal(id);
    });

    gridEl.appendChild(item);
  });
}

// ----- Modal record
let modalCardId = null;

function openCardModal(cardId) {
  modalCardId = String(cardId);
  const card = cards.find(c => String(c.id) === modalCardId);
  if (!card) return;

  const records = loadRecords();
  const collected = isCollected(modalCardId, records);

  modalImg.src = collected ? cardFrontSrc(card) : cardBackSrc(card);

  // show/hide record form
  if (!collected) {
    recordLocked.classList.remove("hidden");
    recordForm.classList.add("hidden");
  } else {
    recordLocked.classList.add("hidden");
    recordForm.classList.remove("hidden");

    const rec = ensureRecord(modalCardId, records);

    noteText.value = rec.text || "";
    if (rec.photo) {
      photoPreview.src = rec.photo;
      photoPreviewWrap.classList.remove("hidden");
    } else {
      photoPreviewWrap.classList.add("hidden");
      photoPreview.src = "";
    }

    noteMeta.textContent = metaText(rec);
  }

  openModal();
}

function metaText(rec) {
  const parts = [];
  if (rec.mood) parts.push(`心情：${rec.mood}`);
  if (rec.firstSeen) parts.push(`第一次相遇：${rec.firstSeen}`);
  if (rec.lastSeen) parts.push(`最近一次：${rec.lastSeen}`);
  if (rec.drawCount) parts.push(`相遇次數：${rec.drawCount}`);
  return parts.join("　｜　");
}

// mood pick
document.querySelectorAll(".mood").forEach(btn => {
  btn.addEventListener("click", () => {
    const mood = btn.getAttribute("data-mood");
    if (!modalCardId) return;

    const records = loadRecords();
    const rec = ensureRecord(modalCardId, records);
    rec.mood = mood;
    rec.lastEdited = todayISO();
    saveRecords(records);

    noteMeta.textContent = metaText(rec);
  });
});

noteSave.addEventListener("click", () => {
  if (!modalCardId) return;

  const records = loadRecords();
  const rec = ensureRecord(modalCardId, records);

  rec.text = (noteText.value || "").trim();
  rec.lastEdited = todayISO();

  saveRecords(records);
  noteMeta.textContent = metaText(rec);
});

noteClear.addEventListener("click", () => {
  if (!modalCardId) return;

  const records = loadRecords();
  const rec = ensureRecord(modalCardId, records);

  delete rec.text;
  delete rec.photo;
  delete rec.mood;
  rec.lastEdited = todayISO();

  saveRecords(records);

  noteText.value = "";
  photoPreviewWrap.classList.add("hidden");
  photoPreview.src = "";
  noteMeta.textContent = metaText(rec);
});

photoInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !modalCardId) return;

  const dataUrl = await resizeImageToDataURL(file, 1280);

  const records = loadRecords();
  const rec = ensureRecord(modalCardId, records);
  rec.photo = dataUrl;
  rec.lastEdited = todayISO();
  saveRecords(records);

  photoPreview.src = dataUrl;
  photoPreviewWrap.classList.remove("hidden");
  noteMeta.textContent = metaText(rec);

  // reset input
  photoInput.value = "";
});

photoRemove.addEventListener("click", () => {
  if (!modalCardId) return;

  const records = loadRecords();
  const rec = ensureRecord(modalCardId, records);
  delete rec.photo;
  rec.lastEdited = todayISO();
  saveRecords(records);

  photoPreviewWrap.classList.add("hidden");
  photoPreview.src = "";
  noteMeta.textContent = metaText(rec);
});

async function resizeImageToDataURL(file, maxSide) {
  const img = await fileToImage(file);
  const { width, height } = img;

  let targetW = width;
  let targetH = height;

  if (Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height);
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toDataURL("image/jpeg", 0.85);
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// ----- Navigation helpers
function goIntro() {
  showView("intro");
}
function goToday() {
  showView("today");
}
function goWall() {
  showView("wall");
  renderWall();
}
function goAbout() {
  showView("about");
}

// ----- Buttons wiring
btnInto.addEventListener("click", () => {
  markIntroSeen();
  goToday();
});

drawAny.addEventListener("click", () => drawCard("all"));

btnDrawAgain.addEventListener("click", () => drawCard("all"));

btnOpenWall.addEventListener("click", () => {
  goWall();
  if (lastDrawnCardId) {
    // open modal for last drawn
    setTimeout(() => openCardModal(lastDrawnCardId), 200);
  }
});

btnSaveNote.addEventListener("click", () => {
  // Requirement: "回應這張卡" must go to the correct writing place
  // => open modal with record form directly for last drawn
  if (!lastDrawnCardId) return;
  goWall();
  setTimeout(() => openCardModal(lastDrawnCardId), 200);
});

tabs.forEach(t => {
  t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    activeTab = t.getAttribute("data-tab") || "all";
    renderWall();
  });
});

// Modal close
modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

// Drawer
[hamburger, hamburger2, hamburger3].forEach(btn => {
  if (!btn) return;
  btn.addEventListener("click", openDrawer);
});
drawerClose.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

navStory.addEventListener("click", () => { closeDrawer(); goIntro(); });
navToday.addEventListener("click", () => { closeDrawer(); goToday(); });
navWall.addEventListener("click", () => { closeDrawer(); goWall(); });
navAbout.addEventListener("click", () => { closeDrawer(); goAbout(); });

// About tools
resetIntroBtn.addEventListener("click", () => {
  resetIntroSeen();
  alert("已重置。重新整理後會看到迎接畫面。");
});

exportBtn.addEventListener("click", () => {
  const data = loadRecords();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kana-records.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const incoming = safeJSONParse(text, null);
  if (!incoming || typeof incoming !== "object") {
    alert("匯入失敗：檔案不是有效的 JSON");
    return;
  }
  saveRecords(incoming);
  alert("匯入成功。");
  e.target.value = "";
});

// ----- Boot
(async function boot() {
  // Intro always runs; if already seen, go today directly
  showView("intro");
  runIntroSequence();

  try {
    cards = await loadCardsManifest();
  } catch (err) {
    console.error(err);
    alert("cards_manifest.json 讀取失敗，請確認檔案存在且格式正確。");
    cards = [];
  }

  bindSeriesChips();

  if (isIntroSeen()) {
    // still show intro briefly then jump (app-like)
    setTimeout(() => goToday(), 450);
  }

  // Ensure intro paper shows even if animation blocked
  setTimeout(() => introPaper.classList.remove("hidden"), 3200);
})();
