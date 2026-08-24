const express = require("express");
const hospitals = require("../data/hospitals.json");
const symptoms = require("../data/symptoms.json");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// All triage endpoints require the user to be signed in.
router.use(requireAuth);


/* =========================================================
   DISTANCE CALCULATION
========================================================= */

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in KM

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


/* =========================================================
   CHECK VALID HOSPITAL COORDINATES
========================================================= */

function hasValidCoordinates(hospital) {
  return (
    Number.isFinite(hospital.lat) &&
    Number.isFinite(hospital.lng) &&
    hospital.lat >= -90 &&
    hospital.lat <= 90 &&
    hospital.lng >= -180 &&
    hospital.lng <= 180
  );
}


/* =========================================================
   SYMPTOM MATCHING
========================================================= */

function matchSymptom(query) {
  const q = (query || "").trim().toLowerCase();

  if (!q) return null;

  let best = null;
  let bestScore = 0;

  symptoms.forEach((s) => {
    let score = 0;

    const keyword = (s.keyword || "").toLowerCase();

    if (keyword === q) {
      score = 100;
    } else if (keyword.includes(q) || q.includes(keyword)) {
      score = 60;
    } else {
      const qWords = q.split(/\s+/);
      const kWords = keyword.split(/\s+/);

      const overlap = qWords.filter((word) =>
        kWords.includes(word)
      ).length;

      score = overlap * 20;
    }

    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });

  return bestScore > 0 ? best : null;
}


/* =========================================================
   ADD DISTANCE AND SORT
========================================================= */

function addDistanceAndSort(candidates, lat, lng, limit = 5) {
  const validHospitals = candidates.filter(hasValidCoordinates);

  const withDistance = validHospitals.map((hospital) => ({
    ...hospital,
    distanceKm: Number(
      haversine(
        lat,
        lng,
        hospital.lat,
        hospital.lng
      ).toFixed(1)
    ),
  }));

  withDistance.sort(
    (a, b) => a.distanceKm - b.distanceKm
  );

  // Debug: check hospital ranking in terminal
  console.log("\n===== HOSPITAL DISTANCE RESULTS =====");
  console.log("User location:", {
    lat,
    lng,
  });

  withDistance.forEach((hospital, index) => {
    console.log(
      `${index + 1}. ${hospital.name} - ${hospital.distanceKm} km`
    );
  });

  console.log("=====================================\n");

  return withDistance.slice(0, limit);
}


/* =========================================================
   FIND HOSPITALS FOR SYMPTOM
========================================================= */

function nearestHospitals({
  dept,
  secondary,
  urgency,
  trauma,
  lat,
  lng,
  limit = 5,
}) {
  console.log("\nSearching hospitals...");
  console.log("Department:", dept);
  console.log("Secondary:", secondary);
  console.log("Urgency:", urgency);
  console.log("Trauma:", trauma);

  // Step 1: Find hospitals matching specialty
  let candidates = hospitals.filter((hospital) => {
    const specialties = Array.isArray(hospital.specialties)
      ? hospital.specialties
      : [];

    return (
      specialties.includes(dept) ||
      (secondary &&
        specialties.includes(secondary))
    );
  });

  console.log(
    "Specialty matched hospitals:",
    candidates.map((h) => h.name)
  );

  // Step 2: If no specialty match, use all valid hospitals
  if (candidates.length === 0) {
    console.log(
      "No specialty match found. Using all hospitals."
    );

    candidates = hospitals.filter(
      hasValidCoordinates
    );
  }

  // Step 3: For emergency cases, prefer emergency hospitals
  if (urgency === "Emergency") {
    const emergencyHospitals = candidates.filter(
      (hospital) => hospital.emergency === true
    );

    if (emergencyHospitals.length > 0) {
      candidates = emergencyHospitals;

      console.log(
        "Emergency hospitals:",
        candidates.map((h) => h.name)
      );
    }
  }

  // Step 4: For trauma cases, prefer trauma hospitals
  if (trauma === true) {
    const traumaHospitals = candidates.filter(
      (hospital) => hospital.trauma === true
    );

    if (traumaHospitals.length > 0) {
      candidates = traumaHospitals;

      console.log(
        "Trauma hospitals:",
        candidates.map((h) => h.name)
      );
    }
  }

  return addDistanceAndSort(
    candidates,
    lat,
    lng,
    limit
  );
}


/* =========================================================
   FIND NEAREST EMERGENCY HOSPITALS
========================================================= */

function nearestEmergencyHospitals({
  lat,
  lng,
  limit = 5,
}) {
  console.log("\n===== EMERGENCY HOSPITAL SEARCH =====");

  console.log("Received location:", {
    lat,
    lng,
  });

  // Get all hospitals marked as emergency
  let candidates = hospitals.filter(
    (hospital) =>
      hospital.emergency === true &&
      hasValidCoordinates(hospital)
  );

  console.log(
    "Emergency hospitals found:",
    candidates.map((h) => ({
      name: h.name,
      lat: h.lat,
      lng: h.lng,
    }))
  );

  // Fallback if no emergency hospitals exist
  if (candidates.length === 0) {
    console.log(
      "No emergency hospitals found. Falling back to all valid hospitals."
    );

    candidates = hospitals.filter(
      hasValidCoordinates
    );
  }

  return addDistanceAndSort(
    candidates,
    lat,
    lng,
    limit
  );
}


/* =========================================================
   GET SYMPTOM SUGGESTIONS
========================================================= */

router.get("/suggestions", (req, res) => {
  const list = symptoms
    .filter(
      (symptom) =>
        symptom.keyword &&
        typeof symptom.keyword === "string"
    )
    .map(
      (symptom) =>
        symptom.keyword.charAt(0).toUpperCase() +
        symptom.keyword.slice(1)
    );

  res.json({
    suggestions: list,
  });
});


/* =========================================================
   SEARCH HOSPITAL BY SYMPTOM

   POST /api/triage/search

   Body:
   {
     query: "chest pain",
     lat: 17.385,
     lng: 78.4867
   }
========================================================= */

router.post("/search", (req, res) => {
  const { query, lat, lng } = req.body || {};

  console.log("\n===== SYMPTOM SEARCH =====");
  console.log("Query:", query);
  console.log("Received latitude:", lat);
  console.log("Received longitude:", lng);

  const match = matchSymptom(query);

  if (!match) {
    console.log("No symptom match found.");

    return res.json({
      match: null,
      hospitals: [],
    });
  }

  // Check whether browser sent valid location
  const hasUserLocation =
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  // Default location: Central Hyderabad
  const userLat = hasUserLocation
    ? lat
    : 17.385;

  const userLng = hasUserLocation
    ? lng
    : 78.4867;

  console.log(
    hasUserLocation
      ? "Using user's actual location."
      : "Using fallback location: Central Hyderabad."
  );

  console.log("Matched symptom:", match.keyword);
  console.log("Matched department:", match.dept);

  const nearby = nearestHospitals({
    dept: match.dept,
    secondary: match.secondary,
    urgency: match.urgency,
    trauma: match.trauma,
    lat: userLat,
    lng: userLng,
  });

  res.json({
    match,
    hospitals: nearby,
    usedFallbackLocation: !hasUserLocation,
  });
});


/* =========================================================
   FIND NEAREST EMERGENCY HOSPITAL

   POST /api/triage/nearest-emergency

   Body:
   {
     lat: 17.385,
     lng: 78.4867
   }
========================================================= */

router.post("/nearest-emergency", (req, res) => {
  const { lat, lng } = req.body || {};

  console.log("\n===== EMERGENCY REQUEST =====");
  console.log("Received latitude:", lat);
  console.log("Received longitude:", lng);

  const hasUserLocation =
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  // Fallback location: Central Hyderabad
  const userLat = hasUserLocation
    ? lat
    : 17.385;

  const userLng = hasUserLocation
    ? lng
    : 78.4867;

  console.log(
    hasUserLocation
      ? "Using user's actual GPS location."
      : "WARNING: GPS location unavailable. Using central Hyderabad."
  );

  const nearby = nearestEmergencyHospitals({
    lat: userLat,
    lng: userLng,
  });

  res.json({
    hospitals: nearby,
    usedFallbackLocation: !hasUserLocation,
  });
});


module.exports = router;
