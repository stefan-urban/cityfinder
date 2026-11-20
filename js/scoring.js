// Distance + scoring rules. Pure functions, no DOM.
(function () {
  "use strict";

  const EARTH_RADIUS_KM = 6371.0088;

  const RULES = {
    MAX_POINTS: 1000,
    PERFECT_KM: 20,   // anything this close earns full points
    CUTOFF_KM: 2000,  // at or beyond this distance: 0 points
    DECAY_KM: 500,    // exponential decay length; smaller = harsher

    // Time penalty: no deduction during the grace period, then the round's
    // points shrink linearly down to MIN_TIME_FACTOR at the time limit.
    GRACE_S: 2,
    MIN_TIME_FACTOR: 0.5,
    NO_LIMIT_REF_S: 60, // with "no limit", the penalty bottoms out after this long
  };

  const toRad = (deg) => (deg * Math.PI) / 180;

  /** Great-circle distance in km between two [lon, lat] points (haversine). */
  function distanceKm(a, b) {
    const [lon1, lat1] = a;
    const [lon2, lat2] = b;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /**
   * Smooth exponential decay from MAX_POINTS (at PERFECT_KM) to exactly 0
   * (at CUTOFF_KM). The curve is shifted/rescaled so it hits 0 at the cutoff
   * instead of jumping there.
   */
  function pointsFor(km) {
    const { MAX_POINTS, PERFECT_KM, CUTOFF_KM, DECAY_KM } = RULES;
    if (km == null || !isFinite(km) || km >= CUTOFF_KM) return 0;
    if (km <= PERFECT_KM) return MAX_POINTS;
    const span = CUTOFF_KM - PERFECT_KM;
    const d = km - PERFECT_KM;
    const floor = Math.exp(-span / DECAY_KM);
    const v = (Math.exp(-d / DECAY_KM) - floor) / (1 - floor);
    return Math.round(MAX_POINTS * v);
  }

  /**
   * Multiplier (MIN_TIME_FACTOR..1) for answering after `elapsedS` seconds.
   * `limitS` is the round's time limit in seconds (0 = no limit).
   */
  function timeFactor(elapsedS, limitS) {
    const { GRACE_S, MIN_TIME_FACTOR, NO_LIMIT_REF_S } = RULES;
    const limit = limitS > 0 ? limitS : NO_LIMIT_REF_S;
    if (elapsedS <= GRACE_S || limit <= GRACE_S) return 1;
    const t = Math.min(1, (elapsedS - GRACE_S) / (limit - GRACE_S));
    return 1 - t * (1 - MIN_TIME_FACTOR);
  }

  window.CityFinderScoring = { RULES, distanceKm, pointsFor, timeFactor };
})();
