const express = require("express");
const hospitals = require("../data/hospitals.json");
const symptoms = require("../data/symptoms.json");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// All triage endpoints require the user to be signed in.
router.use(requireAuth);

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchSymptom(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return null;
  let best = null;
  let bestScore = 0;
  symptoms.forEach((s) => {
    let score = 0;
    if (s.keyword === q) score = 100;
    else if (s.keyword.includes(q) || q.includes(s.keyword)) score = 60;
    else {
      const qWords = q.split(/\s+/);
      const kWords = s.keyword.split(/\s+/);
      const overlap = qWords.filter((w) => kWords.includes(w)).length;
      score = overlap * 20;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });
  return bestScore > 0 ? best : null;
}

function nearestHospitals({ dept, secondary, urgency, trauma, lat, lng, limit = 5 }) {

  // First try hospitals matching the required specialty
  let candidates = hospitals.filter((h) => {
    const specialties = Array.isArray(h.specialties) ? h.specialties : [];

    return (
      specialties.includes(dept) ||
      (secondary && specialties.includes(secondary))
    );
  });

  // If no specialty match is found, use all valid nearby facilities
  if (candidates.length === 0) {
    candidates = hospitals.filter(
      (h) =>
        typeof h.lat === "number" &&
        typeof h.lng === "number"
    );
  }

  // For emergency cases, prefer emergency-marked hospitals
  if (urgency === "Emergency") {
    const emergencyHospitals = candidates.filter((h) => h.emergency);

    if (emergencyHospitals.length > 0) {
      candidates = emergencyHospitals;
    }
  }

  // For trauma cases, prefer trauma-marked hospitals
  if (trauma) {
    const traumaHospitals = candidates.filter((h) => h.trauma);

    if (traumaHospitals.length > 0) {
      candidates = traumaHospitals;
    }
  }

  const withDistance = candidates.map((h) => ({
    ...h,
    distanceKm: Number(
      haversine(lat, lng, h.lat, h.lng).toFixed(1)
    ),
  }));

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistance.slice(0, limit);
}
function nearestEmergencyHospitals({ lat, lng, limit = 5 }) {

  // Prefer facilities explicitly marked as emergency
  let candidates = hospitals.filter((h) => h.emergency);

  // If no emergency flag exists, fall back to nearest valid facilities
  if (candidates.length === 0) {
    candidates = hospitals.filter(
      (h) =>
        typeof h.lat === "number" &&
        typeof h.lng === "number"
    );
  }

  const withDistance = candidates.map((h) => ({
    ...h,
    distanceKm: Number(
      haversine(lat, lng, h.lat, h.lng).toFixed(1)
    ),
  }));

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistance.slice(0, limit);
}

// GET /api/triage/suggestions -> list of symptom keywords, for the search datalist
router.get("/suggestions", (req, res) => {
  const list = symptoms.map((s) => s.keyword.charAt(0).toUpperCase() + s.keyword.slice(1));
  res.json({ suggestions: list });
});

// POST /api/triage/search  { query, lat, lng }
router.post("/search", (req, res) => {
  const { query, lat, lng } = req.body || {};

  const match = matchSymptom(query);
  if (!match) {
    return res.json({ match: null });
  }

  const userLat = typeof lat === "number" ? lat : 17.385;
  const userLng = typeof lng === "number" ? lng : 78.4867;

  const nearby = nearestHospitals({
    dept: match.dept,
    secondary: match.secondary,
    urgency: match.urgency,
    trauma: match.trauma,
    lat: userLat,
    lng: userLng,
  });

  res.json({ match, hospitals: nearby, usedFallbackLocation: typeof lat !== "number" });
});

// POST /api/triage/nearest-emergency  { lat, lng }
// For the "I'm in an emergency right now" button — skips symptom matching
// entirely and just returns the closest hospitals with 24x7 emergency care.
router.post("/nearest-emergency", (req, res) => {
  const { lat, lng } = req.body || {};

  const userLat = typeof lat === "number" ? lat : 17.385;
  const userLng = typeof lng === "number" ? lng : 78.4867;

  const nearby = nearestEmergencyHospitals({ lat: userLat, lng: userLng });

  res.json({ hospitals: nearby, usedFallbackLocation: typeof lat !== "number" });
});

module.exports = router;
