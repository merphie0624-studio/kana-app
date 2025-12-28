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

  // iOS Safari 對 behavior:"instant" 不穩，改成穩定寫法
  try { window.scrollTo(0, 0); } catch {}
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

let boatPlayedThisOpen = false;

// 船動畫時間（要跟你 CSS 的動畫時間一致）
// 你如果用我給你的 CSS：5.8s
const BOAT_MS = 5800;

// 讓船「進到 Intro 就先跑一次」，但只跑一次
async function playBoatOnceAtIntro(){
  if(!boatLayer || boatPlayedThisOpen) return;
  boatPlayedThisOpen = true;

  // 確保可見並播放
  boatLayer.classList.remove("hidden");
  boatLayer.classList.add("play");

  // 跑完之後淡出（不要突然消失）
  await new Promise(r => setTimeout(r, BOAT_MS + 150));
  boatLayer.classList.remove("play");

  // 這裡不強制 hidden，讓它留在那（若你想完全消失可改回 hidden）
  boatLayer.classList.add("hidden");
}

function markIntroSeen(){
  localStorage.setItem(INTRO_SEEN_KEY, "1");
}
function resetIntroSeen(){
  localStorage.removeItem(INTRO_SEEN_KEY);
}

/* --------- drawer (global) ---------- */

function ensureDrawerGlobal(){
  const drawer = $("drawer");
  if(!drawer) return;

  // 重要：drawer 原本在 view-today 內，
  // 切到 wall/about 時 view-today 被 hidden (display:none)，drawer 也一起沒了
  // → 我們把 drawer 移到 body，讓任何 view 都能開
  if(drawer.parentElement !== document.body){
    document.body.appendChild(drawer);
  }
}

function openDrawer(){
  const d = $("drawer");
  if(!d) return;
  d.classList.remove("hidden");
  d.setAttribute("aria-hidden","false");
}

function closeDrawer(){
  const d = $("drawer");
  if(!d) return;
  d.classList.add("hidden");
  d.setAttribute("aria-hidden","true");
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
    $(id)?.addEventListener("click", ()=>{
      ensureDrawerGlobal();
      openDrawer();
    });
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
  todayResult.classList.remove("hidden");

  const rec = store.draws[card.id];
  const first = rec?.first || todayISO();
  const last  = rec?.last  || todayISO();
  const count = rec?.count || 1;
  todayMeta.textContent =
    `抽到日期：${todayISO()} ｜ 第一次相遇：${first} ｜ 最近一次：${last} ｜ 相遇次數：${count}`;

  // 抽完先「停一下」再浮現按鈕（你要的手感）
  if(resultActions){
    resultActions.classList.add("hidden");
    setTimeout(()=> resultActions.classList.remove("hidden"), 900); // 比 700 再更有「停下來」的感覺
  }

  window.__CURRENT_CARD__ = card;
}

async function doDraw(series=null){
  const pool = series ? MANIFEST.filter(c => c.series === series) : MANIFEST.slice();
  if(pool.length === 0){
    toast("這個系列目前還沒有卡");
    return;
  }

  // 小停頓
  toast("…");
  await new Promise(r=>setTimeout(r, 260));

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
  if(stats) stats.textContent = `已收集 ${got} / ${total}（${pct}%）`;
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
    // 未抽到：顯示背面（你現在先用 tree-gold.png）
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

  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("active", tab.getAttribute("data-tab") === currentTab);
  });

  const list = MANIFEST.filter(c=>{
    if(currentTab === "all") return true;
    return c.series === currentTab;
  });

  if(!grid) return;
  grid.innerHTML = "";
  list.forEach(card => grid.appendChild(makeTile(card)));

  // 防止「故事牆卡住不動」：確保 scroll-panel 可滾，並回到頂部
  const p = document.querySelector("#view-wall .scroll-panel");
  if(p) p.scrollTop = 0;
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
  recordLocked?.classList.toggle("hidden", got);
  recordForm?.classList.toggle("hidden", !got);

  // load saved note/photo/emoji
  if(noteText) noteText.value = store.notes[cardId] || "";

  // emoji active
  const e = store.emoji[cardId] || "";
  emojiRow?.querySelectorAll(".emoji-btn").forEach(b=>{
    b.classList.toggle("active", b.getAttribute("data-emoji") === e);
  });

  const p = store.photos[cardId];
  if(photoPreviewWrap && photoPreview){
    if(p){
      photoPreviewWrap.classList.remove("hidden");
      photoPreview.src = p;
    }else{
      photoPreviewWrap.classList.add("hidden");
      photoPreview.src = "";
    }
  }

  // meta
  const rec = store.draws[cardId];
  if(noteMeta){
    if(rec){
      noteMeta.textContent =
        `心情：${store.emoji[cardId] || "—"} ｜ 第一次相遇：${rec.first} ｜ 最近一次：${rec.last} ｜ 相遇次數：${rec.count || 1}`;
    }else{
      noteMeta.textContent = "";
    }
  }

  modal?.classList.remove("hidden");
}

function closeModal(){
  modal?.classList.add("hidden");
  currentModalId = null;
}

function bindModal(){
  modalClose?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeModal();
  });

  // emoji click -> float animation + save
  emojiRow?.querySelectorAll(".emoji-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(!currentModalId) return;
      const em = btn.getAttribute("data-emoji");
      store.emoji[currentModalId] = em;
      saveStore(store);

      emojiRow.querySelectorAll(".emoji-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      // 飄起來
      const floater = document.createElement("div");
      floater.className = "float-emoji";
      floater.textContent = em;
      document.body.appendChild(floater);
      setTimeout(()=> floater.remove(), 900);

      toast("已記下");

      // refresh meta
      const rec = store.draws[currentModalId];
      if(noteMeta && rec){
        noteMeta.textContent =
          `心情：${em} ｜ 第一次相遇：${rec.first} ｜ 最近一次：${rec.last} ｜ 相遇次數：${rec.count || 1}`;
      }
    });
  });

  noteSave?.addEventListener("click", ()=>{
    if(!currentModalId) return;
    store.notes[currentModalId] = noteText?.value || "";
    saveStore(store);

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

    if(noteText) noteText.value = "";
    if(photoPreviewWrap && photoPreview){
      photoPreviewWrap.classList.add("hidden");
      photoPreview.src = "";
    }
    emojiRow?.querySelectorAll(".emoji-btn").forEach(b=>b.classList.remove("active"));
    toast("已清除");

    const rec = store.draws[currentModalId];
    if(noteMeta && rec){
      noteMeta.textContent =
        `心情：— ｜ 第一次相遇：${rec.first} ｜ 最近一次：${rec.last} ｜ 相遇次數：${rec.count || 1}`;
    }
  });

  photoInput?.addEventListener("change", async ()=>{
    if(!currentModalId) return;
    const file = photoInput.files?.[0];
    if(!file) return;

    const dataUrl = await shrinkImageToDataURL(file, 1280, 0.86);
    store.photos[currentModalId] = dataUrl;
    saveStore(store);

    if(photoPreviewWrap && photoPreview){
      photoPreviewWrap.classList.remove("hidden");
      photoPreview.src = dataUrl;
    }
    toast("照片已加入");
    photoInput.value = "";
  });

  photoRemove?.addEventListener("click", ()=>{
    if(!currentModalId) return;
    delete store.photos[currentModalId];
    saveStore(store);

    if(photoPreviewWrap && photoPreview){
      photoPreviewWrap.classList.add("hidden");
      photoPreview.src = "";
    }
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
    const input = $("import-data");
    const f = input?.files?.[0];
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
      if(input) input.value = "";
    }
  });
}

/* --------- boot ---------- */

(async function boot(){
  // drawer 必須先全域化，否則 wall/about 看不到
  ensureDrawerGlobal();

  bindNav();
  bindDrawButtons();
  bindTabs();
  bindModal();
  bindAbout();

  // intro logic
  const seen = localStorage.getItem(INTRO_SEEN_KEY) === "1";
  if(!seen){
    showView("intro");
    // ✅ 一進 Intro 就先跑船一次（你要的「先停下來」）
    // 讓畫面先穩住 200ms 再跑，更有質感
    setTimeout(()=> { playBoatOnceAtIntro(); }, 200);
  }else{
    showView("today");
  }

  // 點「靠岸」：不再跑船（船已經跑過了）
  btnInto?.addEventListener("click", ()=>{
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

    // 如果當下就在 wall 就渲染
    if(!views.wall.classList.contains("hidden")) renderWall();

  }catch(err){
    console.error(err);
    toast("卡片清單讀取失敗（cards_manifest.json）");
  }
})();
