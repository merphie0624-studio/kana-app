/* kana-app: mobile-first single page, vanilla JS */

const STORAGE_KEY = "kana_records_v2";
const INTRO_SEEN_KEY = "kana_intro_seen_v2";

const views = {
  intro: document.getElementById("view-intro"),
  today: document.getElementById("view-today"),
  wall: document.getElementById("view-wall"),
  about: document.getElementById("view-about"),
};

function showView(name){
  Object.values(views).forEach(v => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function $(id){ return document.getElementById(id); }

const toastEl = $("toast");
function toast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(()=> toastEl.classList.add("hidden"), 1200);
}

/* --------- data ---------- */

async function loadManifest(){
  // cards_manifest.json should exist in repo root
  const res = await fetch("cards_manifest.json", { cache: "no-store" });
  if(!res.ok) throw new Error("cards_manifest.json not found");
  const data = await res.json();
  if(!Array.isArray(data.cards)) throw new Error("manifest format invalid");
  return data.cards;
}

function loadStore(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { draws:{}, notes:{}, photos:{}, emoji:{} };
    const obj = JSON.parse(raw);
    return {
      draws: obj.draws || {},
      notes: obj.notes || {},
      photos: obj.photos || {},
      emoji: obj.emoji || {},
    };
  }catch{
    return { draws:{}, notes:{}, photos:{}, emoji:{} };
  }
}
function saveStore(store){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

/* --------- intro + boat ---------- */

const btnInto = $("btn-into");
const boatLayer = $("boat-layer");

async function playBoatThenEnter(){
  // 船「不要太快看不到」：用 2.6s + 0.5s buffer
  boatLayer.classList.remove("hidden");
  boatLayer.classList.add("play");
  // 同時讓 intro 文字稍微淡出（像退潮）
  views.intro.querySelector(".paper.intro")?.classList.add("fade-out-soft");

  await new Promise(r => setTimeout(r, 3100));
  boatLayer.classList.remove("play");
  boatLayer.classList.add("hidden");
}

function markIntroSeen(){
  localStorage.setItem(INTRO_SEEN_KEY, "1");
}
function resetIntroSeen(){
  localStorage.removeItem(INTRO_SEEN_KEY);
}

/* --------- UI wiring ---------- */

function bindNav(){
  // desktop nav
  $("nav-today")?.addEventListener("click", ()=> showView("today"));
  $("nav-wall")?.addEventListener("click", ()=> { showView("wall"); renderWall(); });
  $("nav-about")?.addEventListener("click", ()=> showView("about"));

  $("nav2-today")?.addEventListener("click", ()=> showView("today"));
  $("nav2-wall")?.addEventListener("click", ()=> { showView("wall"); renderWall(); });
  $("nav2-about")?.addEventListener("click", ()=> showView("about"));

  $("nav3-today")?.addEventListener("click", ()=> showView("today"));
  $("nav3-wall")?.addEventListener("click", ()=> { showView("wall"); renderWall(); });
  $("nav3-about")?.addEventListener("click", ()=> showView("about"));

  // mobile drawer
  const burgerIds = ["burger","burger2","burger3"];
  burgerIds.forEach(id=>{
    $(id)?.addEventListener("click", openDrawer);
  });
  $("drawer-close")?.addEventListener("click", closeDrawer);
  $("drawer-backdrop")?.addEventListener("click", closeDrawer);

  document.querySelectorAll(".drawer-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const go = btn.getAttribute("data-go");
      closeDrawer();
      if(go==="today") showView("today");
      if(go==="wall"){ showView("wall"); renderWall(); }
      if(go==="about") showView("about");
    });
  });
}

function openDrawer(){
  const d = $("drawer");
  d?.classList.remove("hidden");
  d?.setAttribute("aria-hidden","false");
}
function closeDrawer(){
  const d = $("drawer");
  d?.classList.add("hidden");
  d?.setAttribute("aria-hidden","true");
}

/* --------- draw logic ---------- */

let MANIFEST = [];
let store = loadStore();

const drawAnyBtn = $("draw-any");
const todayResult = $("today-result");
const todayImg = $("today-img");
const todayMeta = $("today-meta");
const resultActions = $("result-actions");

const btnSaveNote = $("btn-save-note");
const btnOpenWall = $("btn-open-wall");
const btnDrawAgain = $("btn-draw-again");

function pickRandom(list){
  return list[Math.floor(Math.random()*list.length)];
}

function recordDraw(cardId){
  const d = todayISO();
  if(!store.draws[cardId]){
    store.draws[cardId] = { first: d, last: d, count: 1 };
  }else{
    store.draws[cardId].last = d;
    store.draws[cardId].count = (store.draws[cardId].count || 0) + 1;
  }
  saveStore(store);
}

function renderTodayResult(card){
  todayImg.src = card.image;
  todayImg.onload = () => {}; // keep
  todayResult.classList.remove("hidden");

  const rec = store.draws[card.id];
  const first = rec?.first || todayISO();
  const last  = rec?.last  || todayISO();
  const count = rec?.count || 1;
  todayMeta.textContent = `抽到日期：${todayISO()} ｜ 第一次相遇：${first} ｜ 最近一次：${last} ｜ 相遇次數：${count}`;

  // 「抽完等一下再浮現三個按鈕」
  resultActions.classList.add("hidden");
  setTimeout(()=> resultActions.classList.remove("hidden"), 700);

  // 記住目前卡
  window.__CURRENT_CARD__ = card;
}

async function doDraw(series=null){
  const pool = series ? MANIFEST.filter(c => c.series === series) : MANIFEST.slice();
  if(pool.length === 0){
    toast("這個系列目前還沒有卡");
    return;
  }
  // 小小停頓，讓抽卡感不要太突兀
  toast("…");
  await new Promise(r=>setTimeout(r, 220));

  const card = pickRandom(pool);
  recordDraw(card.id);
  renderTodayResult(card);
}

function bindDrawButtons(){
  drawAnyBtn?.addEventListener("click", ()=> doDraw(null));

  document.querySelectorAll("[data-draw-series]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const s = btn.getAttribute("data-draw-series");
      doDraw(s);
    });
  });

  btnOpenWall?.addEventListener("click", ()=>{
    showView("wall");
    renderWall();
  });

  btnDrawAgain?.addEventListener("click", ()=>{
    // 重新抽，先把結果收起一瞬
    todayResult.classList.add("hidden");
    setTimeout(()=> doDraw(null), 180);
  });

  btnSaveNote?.addEventListener("click", ()=>{
    const card = window.__CURRENT_CARD__;
    if(!card) return;
    // 直接打開 modal（等同「回饋這張卡」）
    openModal(card.id);
  });
}

/* --------- wall ---------- */

const grid = $("grid");
const stats = $("stats");
let currentTab = "all";

function countCollected(){
  const ids = Object.keys(store.draws || {});
  return ids.length;
}

function renderStats(){
  const total = MANIFEST.length;
  const got = countCollected();
  const pct = total ? Math.round((got/total)*100) : 0;
  stats.textContent = `已收集 ${got} / ${total}（${pct}%）`;
}

function makeTile(card){
  const got = !!store.draws[card.id];
  const div = document.createElement("div");
  div.className = "tile";
  div.setAttribute("data-id", card.id);

  const img = document.createElement("img");
  img.alt = card.title || card.id;

  if(got){
    img.src = card.image;
  }else{
    // 未抽到：顯示背面金樹
    img.src = "assets/tree-gold.png";
    const lock = document.createElement("div");
    lock.className = "locked-label";
    lock.textContent = "未抽到";
    div.appendChild(lock);
  }

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = card.badge || card.seriesLabel || card.series || "";
  div.appendChild(img);
  div.appendChild(badge);

  div.addEventListener("click", ()=> openModal(card.id));
  return div;
}

function renderWall(){
  renderStats();

  // tabs
  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("active", tab.getAttribute("data-tab") === currentTab);
  });

  const list = MANIFEST.filter(c=>{
    if(currentTab === "all") return true;
    return c.series === currentTab;
  });

  grid.innerHTML = "";
  list.forEach(card => grid.appendChild(makeTile(card)));

  // 你之前「故事牆無法滑動」：確保 panel 可滾
  document.querySelector("#view-wall .panel")?.scrollTo({ top: 0, behavior: "instant" });
}

function bindTabs(){
  document.querySelectorAll(".tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      currentTab = tab.getAttribute("data-tab");
      renderWall();
    });
  });
}

/* --------- modal / notes / emoji / photo ---------- */

const modal = $("modal");
const modalImg = $("modal-img");
const modalClose = $("modal-close");
const modalBackdrop = $("modal-backdrop");
const recordLocked = $("record-locked");
const recordForm = $("record-form");

const noteText = $("note-text");
const photoInput = $("photo-input");
const photoPreviewWrap = $("photo-preview-wrap");
const photoPreview = $("photo-preview");
const photoRemove = $("photo-remove");

const noteSave = $("note-save");
const noteClear = $("note-clear");
const noteMeta = $("note-meta");

const emojiRow = $("emoji-row");

let currentModalId = null;

function openModal(cardId){
  currentModalId = cardId;
  const card = MANIFEST.find(c=>c.id===cardId);
  if(!card) return;

  modalImg.src = card.image;

  const got = !!store.draws[cardId];
  recordLocked.classList.toggle("hidden", got);
  recordForm.classList.toggle("hidden", !got);

  // load saved note/photo/emoji
  noteText.value = store.notes[cardId] || "";

  // emoji active
  const e = store.emoji[cardId] || "";
  emojiRow?.querySelectorAll(".emoji-btn").forEach(b=>{
    b.classList.toggle("active", b.getAttribute("data-emoji") === e);
  });

  const p = store.photos[cardId];
  if(p){
    photoPreviewWrap.classList.remove("hidden");
    photoPreview.src = p;
  }else{
    photoPreviewWrap.classList.add("hidden");
    photoPreview.src = "";
  }

  // meta
  const rec = store.draws[cardId];
  if(rec){
    noteMeta.textContent = `心情：${store.emoji[cardId] || "—"} ｜ 第一次相遇：${rec.first} ｜ 最近一次：${rec.last} ｜ 相遇次數：${rec.count || 1}`;
  }else{
    noteMeta.textContent = "";
  }

  modal.classList.remove("hidden");
}

function closeModal(){
  modal.classList.add("hidden");
  currentModalId = null;
}

function bindModal(){
  modalClose?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  // emoji click -> float animation + saved
  emojiRow?.querySelectorAll(".emoji-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(!currentModalId) return;
      const em = btn.getAttribute("data-emoji");
      store.emoji[currentModalId] = em;
      saveStore(store);

      emojiRow.querySelectorAll(".emoji-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      // 「按自己回饋應該有反應」：飄起來
      const floater = document.createElement("div");
      floater.className = "float-emoji";
      floater.textContent = em;
      document.body.appendChild(floater);
      setTimeout(()=> floater.remove(), 900);

      toast("已記下");
      // refresh meta
      const rec = store.draws[currentModalId];
      if(rec){
        noteMeta.textContent = `心情：${em} ｜ 第一次相遇：${rec.first} ｜ 最近一次：${rec.last} ｜ 相遇次數：${rec.count || 1}`;
      }
    });
  });

  noteSave?.addEventListener("click", ()=>{
    if(!currentModalId) return;
    store.notes[currentModalId] = noteText.value || "";
    saveStore(store);

    // 「保存要有反應」：toast + 按鈕短暫變字
    const old = noteSave.textContent;
    noteSave.textContent = "已保存 ✓";
    toast("已保存");
    setTimeout(()=> noteSave.textContent = old, 850);
  });

  noteClear?.addEventListener("click", ()=>{
    if(!currentModalId) return;
    delete store.notes[currentModalId];
    delete store.photos[currentModalId];
    delete store.emoji[currentModalId];
    saveStore(store);

    noteText.value = "";
    photoPreviewWrap.classList.add("hidden");
    photoPreview.src = "";
    emojiRow?.querySelectorAll(".emoji-btn").forEach(b=>b.classList.remove("active"));
    toast("已清除");
    // refresh meta
    const rec = store.draws[currentModalId];
    if(rec){
      noteMeta.textContent = `心情：— ｜ 第一次相遇：${rec.first} ｜ 最近一次：${rec.last} ｜ 相遇次數：${rec.count || 1}`;
    }
  });

  photoInput?.addEventListener("change", async ()=>{
    if(!currentModalId) return;
    const file = photoInput.files?.[0];
    if(!file) return;

    const dataUrl = await shrinkImageToDataURL(file, 1280, 0.86);
    store.photos[currentModalId] = dataUrl;
    saveStore(store);

    photoPreviewWrap.classList.remove("hidden");
    photoPreview.src = dataUrl;
    toast("照片已加入");
    photoInput.value = "";
  });

  photoRemove?.addEventListener("click", ()=>{
    if(!currentModalId) return;
    delete store.photos[currentModalId];
    saveStore(store);

    photoPreviewWrap.classList.add("hidden");
    photoPreview.src = "";
    toast("照片已移除");
  });
}

function shrinkImageToDataURL(file, maxSize, quality){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = ()=>{
      img.onload = ()=>{
        let { width:w, height:h } = img;
        const scale = Math.min(1, maxSize / Math.max(w,h));
        w = Math.round(w*scale);
        h = Math.round(h*scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* --------- about export/import ---------- */

function bindAbout(){
  $("reset-intro")?.addEventListener("click", ()=>{
    resetIntroSeen();
    toast("已重置迎接畫面");
  });

  $("export-data")?.addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(store, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kana-records-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("import-data")?.addEventListener("change", async ()=>{
    const f = $("import-data").files?.[0];
    if(!f) return;
    const text = await f.text();
    try{
      const obj = JSON.parse(text);
      store = {
        draws: obj.draws || {},
        notes: obj.notes || {},
        photos: obj.photos || {},
        emoji: obj.emoji || {},
      };
      saveStore(store);
      toast("已匯入");
      renderWall();
    }catch{
      toast("匯入失敗：檔案格式不正確");
    }finally{
      $("import-data").value = "";
    }
  });
}

/* --------- boot ---------- */

(async function boot(){
  bindNav();
  bindDrawButtons();
  bindTabs();
  bindModal();
  bindAbout();

  // intro logic
  const seen = localStorage.getItem(INTRO_SEEN_KEY) === "1";
  if(!seen){
    showView("intro");
  }else{
    showView("today");
  }

  btnInto?.addEventListener("click", async ()=>{
    // 船跑太快問題：先播放船 2.6s，再進今天
    await playBoatThenEnter();
    markIntroSeen();
    showView("today");
  });

  // load manifest
  try{
    MANIFEST = await loadManifest();

    // normalize fields (兼容你不同版本的 manifest)
    MANIFEST = MANIFEST.map(c => ({
      id: c.id || c.key,
      series: (c.series || c.category || "").toLowerCase(),
      image: c.image || c.img || c.path,
      title: c.title || c.name || c.id,
      badge: c.badge || (c.series ? c.series[0].toUpperCase()+c.series.slice(1) : ""),
      seriesLabel: c.seriesLabel || "",
    })).filter(c => c.id && c.image);

    // first render if already in wall
    if(!views.wall.classList.contains("hidden")) renderWall();

  }catch(err){
    console.error(err);
    toast("卡片清單讀取失敗（cards_manifest.json）");
  }
})();
