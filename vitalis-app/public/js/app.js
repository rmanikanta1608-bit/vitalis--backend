let userLat = null;
let userLng = null;

const gate = document.getElementById("gate");
const appRoot = document.getElementById("appRoot");

async function init() {
  // 1. Require a signed-in session; bounce to login otherwise.
  let me;
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) {
      window.location.href = "/login.html";
      return;
    }
    me = (await res.json()).user;
  } catch {
    window.location.href = "/login.html";
    return;
  }

  gate.style.display = "none";
  appRoot.style.display = "block";

  document.getElementById("userName").textContent = me.name.split(" ")[0];
  document.getElementById("userInitial").textContent = me.name.trim().charAt(0).toUpperCase();

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login.html";
  });

  // 2. Quick-tap symptom chips
  const chipWords = ["Chest pain", "Road traffic accident", "Fracture", "Burns", "Snake bite", "Child high fever", "Seizure", "Severe bleeding"];
  const chipRow = document.getElementById("chipRow");
  chipWords.forEach((w) => {
    const c = document.createElement("button");
    c.className = "chip";
    c.textContent = w;
    c.onclick = () => {
      document.getElementById("symptomInput").value = w;
      runSearch();
    };
    chipRow.appendChild(c);
  });

  // 3. Symptom suggestions for the search box
  try {
    const res = await fetch("/api/triage/suggestions", { credentials: "include" });
    const data = await res.json();
    const datalist = document.getElementById("symptomSuggestions");
    (data.suggestions || []).forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      datalist.appendChild(opt);
    });
  } catch {
    /* non-fatal */
  }

  // 4. Device geolocation, used to sort hospitals by distance
  const locStatus = document.getElementById("locStatus");
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        locStatus.textContent = "Location found — hospitals sorted by distance from you.";
      },
      () => {
        locStatus.textContent = "Location unavailable — showing distance from central Hyderabad instead.";
      },
      { timeout: 6000 }
    );
  } else {
    locStatus.textContent = "Location not supported — showing distance from central Hyderabad instead.";
  }

  document.getElementById("findBtn").addEventListener("click", runSearch);
  document.getElementById("symptomInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
  document.getElementById("emergencyBtn").addEventListener("click", runEmergencySearch);
}

async function runEmergencySearch() {
  const results = document.getElementById("results");
  const btn = document.getElementById("emergencyBtn");

  btn.disabled = true;
  btn.textContent = "Locating nearest hospital…";

  let data;
  try {
    const res = await fetch("/api/triage/nearest-emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lat: userLat === null ? undefined : userLat,
        lng: userLng === null ? undefined : userLng,
      }),
    });
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    data = await res.json();
  } catch {
    btn.disabled = false;
    btn.textContent = "🚨 It's an emergency — find the nearest hospital now";
    return;
  }

  btn.disabled = false;
  btn.textContent = "🚨 It's an emergency — find the nearest hospital now";

  document.getElementById("matchTitle").textContent = "Nearest emergency-ready hospitals";
  document.getElementById("deptChip").textContent = "24×7 Emergency";
  document.getElementById("aidCard").style.display = "none";

  const marker = document.getElementById("gaugeMarker");
  marker.style.left = "83.3%";
  marker.style.borderColor = "var(--emergency)";
  const gc = document.getElementById("gaugeCaption");
  gc.textContent = "Emergency priority — showing every nearby hospital with 24×7 emergency care, closest first.";
  gc.style.color = "var(--emergency)";

  const candidates = data.hospitals || [];
  document.getElementById("hospitalSub").textContent =
    candidates.length + " emergency hospital(s) sorted by distance from you" +
    (data.usedFallbackLocation ? " (using central Hyderabad — location wasn't available)." : ".");

  renderHospitalCards(candidates, null, null);

  results.classList.add("show");
  results.scrollIntoView({ behavior: "smooth" });
}

async function runSearch() {
  const query = document.getElementById("symptomInput").value;
  const results = document.getElementById("results");
  const findBtn = document.getElementById("findBtn");

  if (!query.trim()) return;

  findBtn.disabled = true;
  findBtn.textContent = "Searching…";

  let data;
  try {
    const res = await fetch("/api/triage/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        query,
        lat: userLat === null ? undefined : userLat,
        lng: userLng === null ? undefined : userLng,
      }),
    });
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    data = await res.json();
  } catch {
    findBtn.disabled = false;
    findBtn.textContent = "Find help";
    return;
  }

  findBtn.disabled = false;
  findBtn.textContent = "Find help";

  const match = data.match;

  if (!match) {
    results.classList.add("show");
    document.getElementById("matchTitle").textContent = "No confident match found";
    document.getElementById("deptChip").textContent = "";
    document.getElementById("aidCard").style.display = "none";
    document.getElementById("hcards").innerHTML =
      '<div class="empty-state">Try one of the quick-tap examples above, or describe the symptom more simply (e.g. "chest pain" rather than a full sentence). If this is a real emergency, call 108 now.</div>';
    document.getElementById("hospitalSub").textContent = "";
    results.scrollIntoView({ behavior: "smooth" });
    return;
  }

  document.getElementById("aidCard").style.display = "block";
  document.getElementById("matchTitle").textContent =
    'Matched: "' + match.keyword.charAt(0).toUpperCase() + match.keyword.slice(1) + '"';
  document.getElementById("deptChip").textContent = match.dept;

  const urgencyPos = { Routine: 16.6, Urgent: 50, Emergency: 83.3 };
  const marker = document.getElementById("gaugeMarker");
  marker.style.left = urgencyPos[match.urgency] + "%";
  marker.style.borderColor =
    match.urgency === "Emergency" ? "var(--emergency)" : match.urgency === "Urgent" ? "var(--urgent)" : "var(--routine)";
  const captionColor =
    match.urgency === "Emergency" ? "var(--emergency)" : match.urgency === "Urgent" ? "var(--urgent)" : "var(--routine)";
  const gc = document.getElementById("gaugeCaption");
  gc.textContent =
    match.urgency + " priority — recommended department: " + match.dept + (match.secondary ? " (also consider " + match.secondary + ")" : "");
  gc.style.color = captionColor;

  const aidCard = document.getElementById("aidCard");
  aidCard.className = "aid-card level-" + match.urgency.toLowerCase();
  document.getElementById("aidDo").textContent = match.aidDo;
  document.getElementById("aidDont").textContent = match.aidDont;
  document.getElementById("aidEscalate").textContent = match.escalate;

  const candidates = data.hospitals || [];
  document.getElementById("hospitalSub").textContent =
    candidates.length + " hospital(s) matched to " + match.dept + ", sorted by distance from you.";

  renderHospitalCards(candidates, match.dept, match.secondary);

  results.classList.add("show");
  results.scrollIntoView({ behavior: "smooth" });
}

function renderHospitalCards(candidates, matchDept, matchSecondary) {
  const hcards = document.getElementById("hcards");
  hcards.innerHTML = "";
  candidates.forEach((h) => {
    const el = document.createElement("div");
    el.className = "hcard";
    const matchedTags = h.specialties
      .map((sp) => {
        const isMatch = sp === matchDept || sp === matchSecondary;
        return '<span class="stag' + (isMatch ? " match" : "") + '">' + sp + "</span>";
      })
      .join("");
    el.innerHTML = `
      <div class="hcard-top">
        <div>
          <div class="hcard-name">${h.name}</div>
          <div class="hcard-meta">${h.area} · ${h.type}</div>
        </div>
        <div class="hcard-dist">${h.distanceKm} km away</div>
      </div>
      <div class="badges">
        <span class="badge ${h.emergency ? "on" : ""}">${h.emergency ? "24×7 Emergency" : "No 24×7 ER"}</span>
        <span class="badge ${h.trauma ? "on" : ""}">${h.trauma ? "Trauma Center" : "No Trauma Center"}</span>
      </div>
      <div class="specialty-tags">${matchedTags}</div>
      <div class="hcard-actions">
        <a href="tel:${h.phone}">Call hospital</a>
        <a class="primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}">Get directions</a>
      </div>
    `;
    hcards.appendChild(el);
  });
}

init();
