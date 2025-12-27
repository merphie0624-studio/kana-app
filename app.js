/* 靠岸｜彼岸の島 - v0.1 (pure static) */
const STORAGE = {
  introSeen: "kaoan.introSeen.v1",
  collected: "kaoan.collected.v1",      // { cardId: true }
  notes: "kaoan.notes.v1",              // { cardId: { text, photoDataUrl, updatedAt } }
};

const state = {
  manifest: null,
  cards: [],
  currentCardId: null,
  currentTab: "all",
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function writeJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function showView(id){
  ["#view-intro","#view-today","#view-wall","#view-about"].forEach(v=>$(v).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function nowISO(){ return new Date().toISOString(); }

function getCollected(){ return readJSON(STORAGE.collected, {}); }
function setCollected(obj){ writeJSON(STORAGE.collected, obj); }
function getNotes(){ return readJSON(STORAGE.notes, {}); }
function setNotes(obj){ writeJSON(STORAGE.notes, obj); }

unction markCollected(cardId){
  const c = getCollected();

  // 今天日期 YYYY-MM-DD
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const prev = c[cardId];

  // 第一次出現，或舊資料是 true
  if(!prev || prev === true){
    c[cardId] = {
      firstDate: todayStr,
      count: 1
    };
  }else{
    // 已存在 → 次數 +1，保留第一次日期
    c[cardId].firstDate = prev.firstDate || todayStr;
    c[cardId].count = (prev.count || 0) + 1;
  }

  setCollected(c);
}
function pickRandom(cards){
  const idx = Math.floor(Math.random() * cards.length);
  return cards[idx];
}

async function loadManifest(){
  const res = await fetch("cards_manifest.json", {cache:"no-store"});
  if(!res.ok) throw new Error("manifest load failed");
  const data = await res.json();
  state.manifest = data;
  state.cards = data.cards || [];
}

function seriesLabel(s){
  if(s==="flow") return "Flow";
  if(s==="free") return "Free";
  if(s==="for") return "For";
  return s;
}

function updateStats(){
  const total = state.cards.length;
  const collected = getCollected();
  const got = Object.keys(collected).length;
  const pct = total ? Math.round(got/total*100) : 0;
  $("#stats").textContent = `已收集 ${got} / ${total}（${pct}%）`;
}

function renderGrid(){
  const grid = $("#grid");
  grid.innerHTML = "";
  const collected = getCollected();

  const cards = state.cards.filter(c=>{
    if(state.currentTab==="all") return true;
    return c.series === state.currentTab;
  });

  for(const card of cards){
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.cardId = card.id;

    const img = document.createElement("img");
    img.src = card.image;
    img.alt = `${seriesLabel(card.series)} ${card.number}`;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = `${seriesLabel(card.series)} ${card.number}`;

    tile.appendChild(img);
    tile.appendChild(badge);

    if(!collected[card.id]){
      const lock = document.createElement("div");
      lock.className = "lock";
      lock.textContent = "未抽到";
      tile.appendChild(lock);
    }

    tile.addEventListener("click", ()=>openCardModal(card.id));
    grid.appendChild(tile);
  }
}

function setTab(tab){
  state.currentTab = tab;
  $all(".tab").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab===tab);
    b.setAttribute("aria-selected", b.dataset.tab===tab ? "true" : "false");
  });
  updateStats();
  renderGrid();
}

function openModal(){
  $("#modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal(){
  $("#modal").classList.add("hidden");
  document.body.style.overflow = "";
  state.currentCardId = null;
}

function openCardModal(cardId){
  const card = state.cards.find(c=>c.id===cardId);
  if(!card) return;
  state.currentCardId = cardId;

  $("#modal-img").src = card.image;
  $("#modal-img").alt = `${seriesLabel(card.series)} ${card.number}`;

  const collected = getCollected();
  const isCollected = !!collected[cardId];

  $("#record-locked").classList.toggle("hidden", isCollected);
  $("#record-form").classList.toggle("hidden", !isCollected);

  // Fill existing note
  const notes = getNotes();
  const note = notes[cardId] || {text:"", photoDataUrl:null, updatedAt:null};
  $("#note-text").value = note.text || "";
  renderPhotoPreview(note.photoDataUrl);

  // Meta
  $("#note-meta").textContent = note.updatedAt ? `上次保存：${new Date(note.updatedAt).toLocaleString()}` : "";

  openModal();
}

function renderPhotoPreview(dataUrl){
  const wrap = $("#photo-preview-wrap");
  const img = $("#photo-preview");
  if(dataUrl){
    img.src = dataUrl;
    wrap.classList.remove("hidden");
  }else{
    img.src = "";
    wrap.classList.add("hidden");
  }
}

// Resize image before saving (avoid huge localStorage)
async function fileToResizedDataUrl(file, maxW=900, quality=0.78){
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

  // store as jpeg
  return canvas.toDataURL("image/jpeg", quality);
}

function wireNav(){
  const toToday = ()=>{ showView("#view-today"); };
  const toWall = ()=>{ showView("#view-wall"); updateStats(); renderGrid(); };
  const toAbout = ()=>{ showView("#view-about"); };

  $("#nav-today").addEventListener("click", toToday);
  $("#nav-wall").addEventListener("click", toWall);
  $("#nav-about").addEventListener("click", toAbout);

  $("#nav2-today").addEventListener("click", toToday);
  $("#nav2-wall").addEventListener("click", toWall);
  $("#nav2-about").addEventListener("click", toAbout);

  $("#nav3-today").addEventListener("click", toToday);
  $("#nav3-wall").addEventListener("click", toWall);
  $("#nav3-about").addEventListener("click", toAbout);
}

function wireIntro(){
  $("#btn-into").addEventListener("click", ()=>{
    localStorage.setItem(STORAGE.introSeen, "true");
    showView("#view-today");
  });
}

function showTodayResult(card){
  $("#today-img").src = card.image;
  $("#today-img").alt = `${seriesLabel(card.series)} ${card.number}`;
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const drawDateE1 = $("#drawDate");
  if (drawDateE1) {
    drawDateE1.textContent = `抽到日期：${yyyy}-${mm}-${dd}`;
  }
  
  $("#today-result").classList.remove("hidden");
}

function hideTodayResult(){
  $("#today-result").classList.add("hidden");
}

function draw(series=null){
  const pool = series ? state.cards.filter(c=>c.series===series) : state.cards;
  const card = pickRandom(pool);
  markCollected(card.id);
  state.currentCardId = card.id;
  showTodayResult(card);
}

function wireToday(){
  $("#draw-any").addEventListener("click", ()=>draw(null));
  $all("[data-draw-series]").forEach(btn=>{
    btn.addEventListener("click", ()=>draw(btn.dataset.drawSeries));
  });

  $("#btn-draw-again").addEventListener("click", ()=>draw(null));

  $("#btn-open-wall").addEventListener("click", ()=>{
    showView("#view-wall");
    setTab("all");
  });

  $("#btn-save-note").addEventListener("click", ()=>{
    if(!state.currentCardId) return;
    openCardModal(state.currentCardId);
  });
}

function wireWall(){
  $all(".tab").forEach(b=>{
    b.addEventListener("click", ()=>setTab(b.dataset.tab));
  });

  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-backdrop").addEventListener("click", closeModal);
  window.addEventListener("keydown", (e)=>{
    if(e.key==="Escape" && !$("#modal").classList.contains("hidden")) closeModal();
  });

  $("#note-save").addEventListener("click", ()=>{
    const cardId = state.currentCardId;
    if(!cardId) return;

    const notes = getNotes();
    const existing = notes[cardId] || {};
    notes[cardId] = {
      text: $("#note-text").value || "",
      photoDataUrl: existing.photoDataUrl || null,
      updatedAt: nowISO(),
    };
    setNotes(notes);

    $("#note-meta").textContent = `已保存：${new Date(notes[cardId].updatedAt).toLocaleString()}`;
    alert("已保存。");
  });

  $("#note-clear").addEventListener("click", ()=>{
    const cardId = state.currentCardId;
    if(!cardId) return;
    if(!confirm("要清除這張卡的文字與照片嗎？")) return;

    const notes = getNotes();
    delete notes[cardId];
    setNotes(notes);

    $("#note-text").value = "";
    renderPhotoPreview(null);
    $("#note-meta").textContent = "";
    alert("已清除。");
  });

  $("#photo-input").addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      const dataUrl = await fileToResizedDataUrl(file, 900, 0.78);
      const cardId = state.currentCardId;
      if(!cardId) return;

      const notes = getNotes();
      const existing = notes[cardId] || {text:"", photoDataUrl:null, updatedAt:null};
      existing.photoDataUrl = dataUrl;
      existing.updatedAt = nowISO();
      notes[cardId] = existing;
      setNotes(notes);

      renderPhotoPreview(dataUrl);
      $("#note-meta").textContent = `已保存：${new Date(existing.updatedAt).toLocaleString()}`;
      // reset input so same file can be re-selected
      $("#photo-input").value = "";
    }catch(err){
      console.error(err);
      alert("照片處理失敗，請換一張較小的照片再試一次。");
    }
  });

  $("#photo-remove").addEventListener("click", ()=>{
    const cardId = state.currentCardId;
    if(!cardId) return;

    const notes = getNotes();
    const existing = notes[cardId];
    if(existing){
      existing.photoDataUrl = null;
      existing.updatedAt = nowISO();
      notes[cardId] = existing;
      setNotes(notes);
      renderPhotoPreview(null);
      $("#note-meta").textContent = `已保存：${new Date(existing.updatedAt).toLocaleString()}`;
    }
  });
}

function wireAbout(){
  $("#reset-intro").addEventListener("click", ()=>{
    localStorage.removeItem(STORAGE.introSeen);
    alert("已重置。下一次打開會再看到迎接畫面。");
  });

  $("#export-data").addEventListener("click", ()=>{
    const payload = {
      version: 1,
      exportedAt: nowISO(),
      collected: getCollected(),
      notes: getNotes(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kaoan_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("#import-data").addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(!data || typeof data !== "object") throw new Error("bad json");
      if(data.collected) setCollected(data.collected);
      if(data.notes) setNotes(data.notes);
      alert("已匯入。");
      // refresh wall stats if user goes there
    }catch(err){
      console.error(err);
      alert("匯入失敗：請確認檔案是從這個 App 匯出的 JSON。");
    }finally{
      $("#import-data").value = "";
    }
  });
}

async function boot(){
  await loadManifest();
  wireNav();
  wireIntro();
  wireToday();
  wireWall();
  wireAbout();

  // Decide start view
  const seen = localStorage.getItem(STORAGE.introSeen) === "true";
  if(seen){
    showView("#view-today");
  }else{
    showView("#view-intro");
  }

  // default wall tab
  setTab("all");
  hideTodayResult();
}

boot().catch(err=>{
  console.error(err);
  alert("初始化失敗：請確認 cards_manifest.json 與 cards 資料夾有一起上傳。");
});
