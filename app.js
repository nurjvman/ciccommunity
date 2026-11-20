import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- util ----------
const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function toDate(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();          // Firestore Timestamp
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmtDate(d) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// localStorage cache (5 menit) buat hemat Firestore reads
const CACHE_TTL = 5 * 60 * 1000;
function cacheGet(key) {
  try {
    const raw = localStorage.getItem("cic:" + key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function cacheSet(key, data) {
  try { localStorage.setItem("cic:" + key, JSON.stringify({ t: Date.now(), data })); } catch {}
}
async function fetchCol(name, orderField, dir = "asc") {
  const cached = cacheGet(name);
  if (cached) return cached;
  const q = query(collection(db, name), orderBy(orderField, dir));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cacheSet(name, rows);
  return rows;
}

// ---------- countdown ----------
let currentEvent = null;
function renderCountdown() {
  if (!currentEvent) {
    $("#cd-title").textContent = "Belum ada event terdekat";
    $("#cd-timer").classList.add("hidden");
    return;
  }
  const target = toDate(currentEvent.tanggal);
  if (!target) return;
  const diff = target - new Date();
  $("#cd-title").textContent = currentEvent.nama;
  $("#cd-timer").classList.remove("hidden");
  if (diff <= 0) {
    $("#cd-days").textContent = 0; $("#cd-hours").textContent = 0;
    $("#cd-mins").textContent = 0; $("#cd-secs").textContent = 0;
    return;
  }
  const s = Math.floor(diff / 1000);
  $("#cd-days").textContent = Math.floor(s / 86400);
  $("#cd-hours").textContent = Math.floor((s % 86400) / 3600);
  $("#cd-mins").textContent = Math.floor((s % 3600) / 60);
  $("#cd-secs").textContent = s % 60;
}

async function loadCountdown() {
  const events = (await fetchCol("events", "tanggal")).map((e) => ({ ...e, _d: toDate(e.tanggal) })).filter((e) => e._d);
  events.sort((a, b) => a._d - b._d);
  currentEvent = events.find((e) => e._d > new Date()) ?? events[events.length - 1] ?? null;
  renderCountdown();
  setInterval(renderCountdown, 1000);
}

// ---------- jadwal ----------
function deadlineBadge(d) {
  const days = Math.ceil((d - new Date()) / 86400000);
  if (days < 0) return `<span class="badge done">lewat ${-days} hr</span>`;
  if (days === 0) return `<span class="badge urgent">HARI INI</span>`;
  if (days === 1) return `<span class="badge urgent">BESOK</span>`;
  if (days <= 3) return `<span class="badge urgent">H-${days}</span>`;
  return `<span class="badge">H-${days}</span>`;
}

async function loadJadwal() {
  const rows = (await fetchCol("jadwal", "deadline")).map((r) => ({ ...r, _d: toDate(r.deadline) })).filter((r) => r._d);
  rows.sort((a, b) => a._d - b._d);
  const list = $("#jadwal-list");
  if (!rows.length) {
    list.innerHTML = `<li class="empty">Belum ada jadwal.</li>`;
    return;
  }
  list.innerHTML = rows.map((r) => `
    <li>
      <span class="when">${fmtDate(r._d)}</span>
      ${deadlineBadge(r._d)}
      <span class="what">${esc(r.judul)} <small class="muted">· ${esc(r.mk ?? "")}</small></span>
      ${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">zoom ↗</a>` : ""}
    </li>`).join("");
}

// ---------- rangkuman ----------
let allRangkuman = [];

async function loadRangkuman() {
  allRangkuman = await fetchCol("rangkuman", "createdAt", "desc");
  renderRangkuman($("#search").value);
  // isi datalist mata kuliah untuk form
  const mks = [...new Set(allRangkuman.map((r) => r.mk).filter(Boolean))].sort();
  $("#mk-list").innerHTML = mks.map((m) => `<option value="${esc(m)}">`).join("");
}

function renderRangkuman(keyword) {
  const q = (keyword ?? "").toLowerCase().trim();
  const rows = allRangkuman.filter((r) =>
    !q || [r.judul, r.mk, r.isi].join(" ").toLowerCase().includes(q)
  );
  const box = $("#rangkuman-list");
  if (!rows.length) {
    box.innerHTML = `<p class="empty">Belum ada rangkuman${q ? " yang cocok" : ""}.</p>`;
    return;
  }
  box.innerHTML = rows.map((r, i) => `
    <article class="rangkuman-item" data-i="${i}">
      <button class="rangkuman-head" type="button">
        <span>${esc(r.judul)}</span>
        <span class="mk">${esc(r.mk ?? "?")}</span>
      </button>
      <div class="rangkuman-body">
        ${esc(r.isi)}
        ${r.gambar ? `<img src="${r.gambar}" alt="lampiran ${esc(r.judul)}" loading="lazy" />` : ""}
        <p class="rangkuman-meta">ditulis oleh ${esc(r.penulis ?? "anonim")} · ${toDate(r.createdAt) ? fmtDate(toDate(r.createdAt)) : ""}</p>
      </div>
    </article>`).join("");
  box.querySelectorAll(".rangkuman-head").forEach((btn) =>
    btn.addEventListener("click", () => btn.closest(".rangkuman-item").classList.toggle("open"))
  );
}

$("#search").addEventListener("input", (e) => renderRangkuman(e.target.value));

// ---------- auth ----------
const loginModal = $("#login-modal");
const postModal = $("#post-modal");

onAuthStateChanged(auth, (user) => {
  if (user) {
    $("#user-info").textContent = user.email;
    $("#btn-auth").textContent = "Keluar";
    $("#btn-write").classList.remove("hidden");
  } else {
    $("#user-info").textContent = "";
    $("#btn-auth").textContent = "Masuk Kontributor";
    $("#btn-write").classList.add("hidden");
  }
});

$("#btn-auth").addEventListener("click", async () => {
  if (auth.currentUser) {
    await signOut(auth);
    return;
  }
  $("#login-error").textContent = "";
  loginModal.showModal();
});

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-pass").value);
    loginModal.close();
  } catch (err) {
    $("#login-error").textContent = "Login gagal: " + (err.code ?? err.message);
  }
});

document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close())
);

// ---------- tulis rangkuman ----------
$("#btn-write").addEventListener("click", () => {
  if (!auth.currentUser) return;
  $("#post-error").textContent = "";
  postModal.showModal();
});

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > 400 * 1024) return reject(new Error("Gambar kebesaran — maks 400KB (kompres dulu)."));
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Gagal membaca gambar."));
    fr.readAsDataURL(file);
  });
}

$("#post-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const gambar = await readImage($("#post-gambar").files[0]);
    await addDoc(collection(db, "rangkuman"), {
      judul: $("#post-judul").value.trim(),
      mk: $("#post-mk").value.trim(),
      isi: $("#post-isi").value,
      gambar,
      penulis: auth.currentUser.email,
      createdAt: serverTimestamp()
    });
    // reset + refresh
    e.target.reset();
    postModal.close();
    ["rangkuman"].forEach((k) => localStorage.removeItem("cic:" + k));
    await loadRangkuman();
  } catch (err) {
    $("#post-error").textContent = err.message ?? "Gagal posting.";
  } finally {
    btn.disabled = false;
  }
});

// ---------- boot ----------
loadCountdown().catch(console.error);
loadJadwal().catch(console.error);
loadRangkuman().catch(console.error);
