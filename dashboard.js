// ═══════════════════════════════════════════
//  HELPIFY DASHBOARD — dashboard.js
// ═══════════════════════════════════════════

if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
}

// const API_AUTH = "http://localhost:8080/api/auth";
// const API_ORDERS = "http://localhost:8080/api/orders";
// setInterval(loadOrders, 5000);
const API_AUTH = "https://helpify-backend-iv27.onrender.com/api/auth";
const API_ORDERS = "https://helpify-backend-iv27.onrender.com/api/orders";
let currentUser = null;
let allOrders = [];
let activeFilter = "all";

// ─── INIT ───────────────────────────────────
window.onload = async function () {
    await checkSession();   // already you have
    await loadOrders();     // already you have
    setupScrollSpy();
};

// ─── SESSION ────────────────────────────────
async function checkSession() {
    const token = localStorage.getItem("token");

    if (!token) {
        redirect();
        return;
    }

    try {
        const res = await fetch(`${API_AUTH}/me`, {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (!res.ok) {
            localStorage.removeItem("token");
            redirect();
            return;
        }

        currentUser = await res.json();
        populateUser(currentUser);

    } catch {
        redirect();
    }
}

function redirect() { window.location.href = "login.html"; }

// ─── POPULATE USER ──────────────────────────
function populateUser(u) {
    const name = u.username || "User";
    const email = u.email || "";
    const initial = name.charAt(0).toUpperCase();

    document.getElementById("sbAv").textContent = initial;
    document.getElementById("sbName").textContent = name;
    document.getElementById("sbEmail").textContent = email;
    document.getElementById("heroName").textContent = name + " 👋";
    document.getElementById("profileAv").textContent = initial;
    document.getElementById("profileName").textContent = name;
    document.getElementById("profileEmail").textContent = email;
    document.getElementById("editName").value = name;
    document.getElementById("editEmail").value = email;
}

// ─── LOAD ORDERS ────────────────────────────
async function loadOrders() {
    try {
        const res = await fetch(API_ORDERS, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });

        if (!res.ok) throw new Error();

        allOrders = await res.json();
        console.log("ORDERS:", allOrders);

        renderFeed();
        renderActivity();
        renderHistory();
        updateStats();

    } catch {
        showToast("⚠️ Could not load orders");
    }
}

// ─── STATS ──────────────────────────────────
function updateStats() {
    const mine = allOrders.filter(o => o.postedBy === currentUser.email || o.userEmail === currentUser.email);
    const completed = mine.filter(o => o.status === "COMPLETED" || o.status === "DELIVERED");
    const active = allOrders.filter(o => o.status === "POSTED");
    const totalPaid = completed.reduce((sum, o) => sum + ((o.reward || 20)), 0);

    set("statRequests", mine.length || 0);
    set("statDelivered", completed.length || 0);
    set("statPaid", `₹${totalPaid}`);
    set("statActive", active.length || 0);

    // feed badge
    set("feedCount", active.length);

    // quick action subs
    set("qaFeedSub", `${active.length} active request${active.length !== 1 ? "s" : ""} open`);
    set("qaHistSub", `${mine.length} total request${mine.length !== 1 ? "s" : ""}`);

    // history stats
    set("hsTotalReq", mine.length);
    set("hsTotalPaid", `₹${totalPaid}`);
    set("hsCompleted", completed.length);

    // profile mini stats
    set("pmReq", mine.length);
    set("pmDone", completed.length);
    set("pmPaid", `₹${totalPaid}`);
    set("pmActive", active.length);
}

function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─── FEED ───────────────────────────────────
function renderFeed() {
    const list = document.getElementById("feedList");
    list.innerHTML = "";

    let orders = [...allOrders];
    if (activeFilter !== "all") {
        orders = orders.filter(o => {
            const loc = `${o.location || ""} ${o.gate || ""}`.toLowerCase();
            return loc.includes(activeFilter.toLowerCase().replace("gate ", "gate"));
        });
    }

    // Sort by amount descending (higher reward = top)
    orders.sort((a, b) => (b.reward || 20) - (a.reward || 20));

    if (!orders.length) {
        list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No requests yet</div>
        <div class="empty-sub">Be the first to post a pickup request</div>
      </div>`;
        return;
    }

    orders.forEach(o => {
        const timeAgo = getTimeAgo(o.createdAt);
        const amount = o.reward || 20;
        const isPrio = amount >= 40;

        let actions = "";
        let contactInfo = ""; // 👈 NEW

        // ================= ACTION BUTTONS =================
        if (o.status === "POSTED") {
            actions = `<button class="fc-btn fc-btn-accept" onclick="acceptOrder('${o.id}')">Accept →</button>`;
        }

        else if (o.status === "ACCEPTED") {

            // 👑 IF I ACCEPTED
            if (o.acceptedBy === currentUser.email) {
                actions = `
                <button class="fc-btn fc-btn-deliver" onclick="completeOrder('${o.id}')">✓ Deliver</button>
                <button class="fc-btn fc-btn-cancel" onclick="cancelOrder('${o.id}')">✕ Cancel</button>
            `;

                // 🔥 SHOW CREATOR DETAILS
                contactInfo = `
                <div class="fc-contact creator">
                    <div>👤 ${o.postedByName || "User"}</div>
                    <div>📞 ${o.postedByPhone || "N/A"}</div>
                    <a class="fc-call" href="tel:${o.postedByPhone}">Call</a>
                </div>
            `;
            }

            // 👑 IF I CREATED
            else if (o.postedBy === currentUser.email) {

                actions = `<span class="fc-accepted-by">✓ Accepted by ${o.acceptedByName || "someone"}</span>`;

                // 🔥 SHOW DELIVERY GUY DETAILS
                contactInfo = `
                <div class="fc-contact deliverer">
                    <div>🚀 ${o.acceptedByName || "Delivery Partner"}</div>
                    <div>📞 ${o.acceptedByPhone || "N/A"}</div>
                    <a class="fc-call" href="tel:${o.acceptedByPhone}">Call</a>
                </div>
            `;
            }

            // 👀 OTHERS
            else {
                actions = `<span class="fc-accepted-by">✓ Accepted by ${o.acceptedByName || "someone"}</span>`;
            }
        }

        else if (o.status === "DELIVERED") {
            actions = `<span class="act-pill pill-done">✓ Delivered</span>`;
        }

        else if (o.status === "CANCELLED") {
            actions = `<span class="act-pill status-cancelled">✕ Cancelled</span>`;
        }

        // ================= CARD =================
        const card = document.createElement("div");
        card.className = `feed-card${isPrio ? " priority" : ""} fade-in`;

        card.innerHTML = `
        <div class="fc-top">
            <div class="fc-title">
                ${platformEmoji(o.platform)} ${o.title || "Pickup"}
                ${isPrio ? '<span class="fc-prio-tag">⚡ Priority</span>' : ""}
            </div>
            <div class="fc-price">₹${amount}</div>
        </div>

        <div class="fc-meta">
            ${o.location || o.gate || "—"} · ${o.platform || "—"} · ${statusLabel(o.status)}
        </div>

        ${contactInfo} 

        <div class="fc-actions">
            ${actions}
            <div class="fc-time">⏱ ${timeAgo}</div>
        </div>
    `;

        list.appendChild(card);
    });
}

function filterFeed(btn, gate) {
    document.querySelectorAll(".fpill").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = gate;
    renderFeed();
}

// ─── ACTIVITY (RECENT — MY ORDERS) ──────────
function renderActivity() {
    const list = document.getElementById("activityList");
    const myOrders = allOrders
        .filter(o => o.postedBy === currentUser.email || o.userEmail === currentUser.email)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    document.getElementById("actCount").textContent = myOrders.length ? `${myOrders.length} orders` : "";

    if (!myOrders.length) {
        list.innerHTML = `<div class="empty-state" style="padding:24px">
      <div class="empty-icon">🕊️</div>
      <div class="empty-title">No activity yet</div>
      <div class="empty-sub">Post your first request below</div>
    </div>`;
        return;
    }

    list.innerHTML = myOrders.map(o => {
        const pillClass = statusPillClass(o.status);
        const pillLabel = statusLabel(o.status);
        return `
      <div class="act-item">
        <div class="act-icon" style="background:${iconBg(o.status)}">
          ${platformEmoji(o.platform)}
        </div>
        <div class="act-body">
          <div class="act-title">${o.title || o.orderName || "Pickup"}</div>
          <div class="act-meta">${o.location || o.gate || "—"} · ${getTimeAgo(o.createdAt)}</div>
        </div>
        <span class="act-pill ${pillClass}">${pillLabel}</span>
      </div>`;
    }).join("");
}

// ─── HISTORY ────────────────────────────────
function renderHistory() {
    const list = document.getElementById("histList");
    const myOrders = allOrders
        .filter(o => o.postedBy === currentUser.email || o.userEmail === currentUser.email)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!myOrders.length) {
        list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📪</div>
      <div class="empty-title">No history yet</div>
      <div class="empty-sub">Your completed requests will show here</div>
    </div>`;
        return;
    }

    list.innerHTML = myOrders.map(o => {
        const amount = o.reward || 20;
        const sc = statusBadgeClass(o.status);
        const sl = statusLabel(o.status);
        const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

        return `
      <div class="hi">
        <div class="hi-icon" style="background:${iconBg(o.status)}">${platformEmoji(o.platform)}</div>
        <div>
          <div class="hi-label">${o.title || o.orderName || "Pickup"}</div>
          <div class="hi-sub">${o.location || o.gate || "—"} · ${o.platform || "—"}</div>
          <span class="hi-status-badge ${sc}">${sl}</span>
        </div>
        <div class="hi-right">
          <div class="hi-amount">₹${amount}</div>
          <div class="hi-date">${dateStr}</div>
        </div>
      </div>`;
    }).join("");
}

// ─── CREATE ORDER ────────────────────────────
async function submitRequest() {
    const title = document.getElementById("orderName").value.trim();
    const location = document.getElementById("orderRoom").value.trim();
    const platform = document.getElementById("orderPlatform").value;
    const gate = document.getElementById("orderGate").value;
    const selChip = document.querySelector(".r-chip.sel .chip-val");
    const amount = selChip ? parseInt(selChip.textContent.replace("₹", "")) : 20;

    if (!title) { showToast("⚠️ Enter an order name"); return; }
    if (!location) { showToast("⚠️ Enter your hostel/room"); return; }

    const btn = document.getElementById("postBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Posting…';

    try {
        const res = await fetch(API_ORDERS, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({
                title,
                location,
                platform,
                gate,
                reward: amount,
                status: "POSTED"
            })
        });
        if (!res.ok) throw new Error();

        showToast("🚀 Request posted!");
        document.getElementById("orderName").value = "";
        document.getElementById("orderRoom").value = "";
        await loadOrders();
        smoothTo("s-feed");
    } catch {
        showToast("❌ Failed to post request");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Post Request →";
    }
}

// ─── ACCEPT / COMPLETE / CANCEL ─────────────
async function acceptOrder(id) {
    await orderAction(id, "accept", "🎉 Accepted!", "❌ Failed to accept");
}
async function completeOrder(id) {
    await orderAction(id, "complete", "✅ Delivered!", "❌ Could not complete");
}
async function cancelOrder(id) {
    await orderAction(id, "cancel", "Order cancelled", "Cancel failed");
}

async function orderAction(id, action, successMsg, failMsg) {
    try {
        const res = await fetch(`${API_ORDERS}/${id}/${action}`, {
            method: "PUT",
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });
        if (!res.ok) throw new Error();
        showToast(successMsg);
        await loadOrders();
    } catch {
        showToast(failMsg);
    }
}

// ─── PROFILE SAVE ────────────────────────────
async function saveProfile() {
    showToast("✓ Profile saved");
}

// ─── LOGOUT ─────────────────────────────────
function logoutUser() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// ─── REWARD CHIPS ───────────────────────────
function selReward(el) {
    document.querySelectorAll(".r-chip").forEach(c => c.classList.remove("sel"));
    el.classList.add("sel");
}

// ─── SCROLL HELPERS ─────────────────────────
function smoothTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupScrollSpy() {
    const content = document.getElementById("mainContent");
    const sections = ["s-overview", "s-create", "s-feed", "s-history", "s-profile"];
    const navItems = document.querySelectorAll(".sb-item");

    const labels = {
        "s-overview": "overview",
        "s-create": "post request",
        "s-feed": "feed",
        "s-history": "history",
        "s-profile": "profile"
    };

    content.addEventListener("scroll", () => {
        let current = sections[0];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el && content.scrollTop >= el.offsetTop - 100) current = id;
        });

        navItems.forEach((item, i) => {
            item.classList.toggle("active", sections[i] === current);
        });

        const sub = document.getElementById("topSub");
        if (sub && labels[current]) sub.textContent = labels[current];
    });
}

// ─── TOAST ──────────────────────────────────
function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
}

// ─── SIDEBAR ────────────────────────────────
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sbOverlay").classList.toggle("show");
}
function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sbOverlay").classList.remove("show");
}

// ─── HELPERS ────────────────────────────────
function getTimeAgo(dateStr) {
    if (!dateStr) return "—";
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} day ago`;
}

function platformEmoji(platform) {
    const map = {
        zomato: "🍕", swiggy: "🥡", blinkit: "🛒",
        amazon: "📦", flipkart: "🎁", other: "📬"
    };
    return map[(platform || "").toLowerCase()] || "📦";
}

function statusLabel(status) {
    const map = {
        POSTED: "🟣 Posted", ACCEPTED: "🔵 Accepted",
        COMPLETED: "🟢 Done", DELIVERED: "🟢 Done", CANCELLED: "🔴 Cancelled"
    };
    return map[status] || status || "—";
}

function statusPillClass(status) {
    const map = {
        POSTED: "pill-pending", ACCEPTED: "pill-accepted",
        COMPLETED: "pill-done", DELIVERED: "pill-done", CANCELLED: ""
    };
    return map[status] || "";
}

function statusBadgeClass(status) {
    const map = {
        POSTED: "status-posted", ACCEPTED: "status-accepted",
        COMPLETED: "status-completed", DELIVERED: "status-completed",
        CANCELLED: "status-cancelled"
    };
    return map[status] || "";
}

function iconBg(status) {
    const map = {
        POSTED: "rgba(124,111,255,.12)", ACCEPTED: "rgba(0,212,255,.1)",
        COMPLETED: "rgba(184,255,87,.1)", DELIVERED: "rgba(184,255,87,.1)",
        CANCELLED: "rgba(255,95,135,.08)"
    };
    return map[status] || "rgba(255,255,255,.05)";
}
















// new changes

// async function loadStats() {
//     try {
//         const res = await fetch(`${API_ORDERS}/stats`, {
//             headers: {
//                 Authorization: "Bearer " + localStorage.getItem("token")
//             }
//         });

//         if (!res.ok) throw new Error("Failed to fetch stats");

//         const stats = await res.json();

//         document.getElementById("statRequests").innerText = stats.totalRequests ?? 0;
//         document.getElementById("statDelivered").innerText = stats.delivered ?? 0;
//         document.getElementById("statPaid").innerText = "₹" + (stats.earnings ?? 0);
//         document.getElementById("statActive").innerText = stats.active ?? 0;

//     } catch (err) {
//         console.error("STATS ERROR:", err);
//     }
// }

// stats fetching logic
