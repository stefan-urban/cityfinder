// UI translations. Static markup uses data-i18n / data-i18n-title / data-i18n-aria
// attributes; dynamic text calls CityFinderI18n.t(key, params).
(function () {
  "use strict";

  const STRINGS = {
    en: {
      "app.tagline": "How well do you know where the world's cities are?",
      "menu.play": "Play",
      "menu.options": "⚙ Options",
      "menu.best": "Your best with these settings: {score}",

      "options.title": "Options",
      "options.back": "Back",
      "options.cities": "Cities",
      "options.rounds": "Rounds",
      "options.timer": "Time per round",
      "options.noLimit": "No limit",
      "options.showCountry": "Show the country as a hint",
      "options.language": "Language",
      "options.rules": "Each guess scores up to 1000 points, decreasing with distance; guesses 2000 km or more away score 0. Answer within 2 seconds for full points, after that the score shrinks with time (down to half at the time limit).",
      "options.done": "Done",
      "options.poolCount": "{count} cities in this pool",

      "pool.capitals": "Capitals",
      "pool.large": "Large cities",
      "pool.mixed": "Mixed",

      "summary.rounds": "{n} rounds",
      "summary.perCity": "{s} s per city",
      "summary.noLimit": "no time limit",
      "summary.hint": "country hint",
      "summary.noHint": "no hint",

      "hud.find": "Find",
      "hud.fullPoints": "full points",
      "hud.round": "Round",
      "hud.score": "Score",
      "hud.quit": "Quit",
      "hud.quitTitle": "Back to menu",

      "game.hintStart": "Click to place your pin · double-click to answer instantly",
      "game.hintMove": "Click to move your pin · double-click to answer",
      "game.confirm": "Confirm guess",
      "game.next": "Next city →",
      "game.results": "See results →",
      "game.timeUp": "Time's up!",
      "game.noGuess": "No guess",
      "game.away": "{km} away",
      "game.tooFar": "{km} away – too far",
      "game.timePenalty": "{s} · −{points} for time",
      "game.noTimePenalty": "{s} · no time penalty",

      "map.label": "World map",
      "zoom.in": "Zoom in",
      "zoom.out": "Zoom out",
      "zoom.reset": "Reset view",

      "end.title": "Game over",
      "end.first": "First game with these settings!",
      "end.newBest": "New best! (previous: {score})",
      "end.best": "Best with these settings: {score}",
      "end.city": "City",
      "end.distance": "Distance",
      "end.time": "Time",
      "end.points": "Points",
      "end.again": "Play again",
      "end.menu": "Menu",
    },

    de: {
      "app.tagline": "Wie gut weißt du, wo die Städte der Welt liegen?",
      "menu.play": "Spielen",
      "menu.options": "⚙ Einstellungen",
      "menu.best": "Dein Rekord mit diesen Einstellungen: {score}",

      "options.title": "Einstellungen",
      "options.back": "Zurück",
      "options.cities": "Städte",
      "options.rounds": "Runden",
      "options.timer": "Zeit pro Runde",
      "options.noLimit": "Kein Limit",
      "options.showCountry": "Land als Hinweis anzeigen",
      "options.language": "Sprache",
      "options.rules": "Jeder Tipp bringt bis zu 1000 Punkte, je nach Entfernung weniger; ab 2000 km gibt es 0 Punkte. Innerhalb der ersten 2 Sekunden gibt es volle Punkte, danach sinkt die Wertung mit der Zeit (bis auf die Hälfte am Zeitlimit).",
      "options.done": "Fertig",
      "options.poolCount": "{count} Städte in dieser Auswahl",

      "pool.capitals": "Hauptstädte",
      "pool.large": "Großstädte",
      "pool.mixed": "Gemischt",

      "summary.rounds": "{n} Runden",
      "summary.perCity": "{s} s pro Stadt",
      "summary.noLimit": "ohne Zeitlimit",
      "summary.hint": "mit Länderhinweis",
      "summary.noHint": "ohne Hinweis",

      "hud.find": "Finde",
      "hud.fullPoints": "volle Punkte",
      "hud.round": "Runde",
      "hud.score": "Punkte",
      "hud.quit": "Beenden",
      "hud.quitTitle": "Zurück zum Menü",

      "game.hintStart": "Klicken, um die Nadel zu setzen · Doppelklick antwortet sofort",
      "game.hintMove": "Klicken, um die Nadel zu verschieben · Doppelklick zum Antworten",
      "game.confirm": "Tipp bestätigen",
      "game.next": "Nächste Stadt →",
      "game.results": "Zum Ergebnis →",
      "game.timeUp": "Zeit abgelaufen!",
      "game.noGuess": "Kein Tipp",
      "game.away": "{km} entfernt",
      "game.tooFar": "{km} entfernt – zu weit",
      "game.timePenalty": "{s} · −{points} für Zeit",
      "game.noTimePenalty": "{s} · kein Zeitabzug",

      "map.label": "Weltkarte",
      "zoom.in": "Hineinzoomen",
      "zoom.out": "Herauszoomen",
      "zoom.reset": "Ansicht zurücksetzen",

      "end.title": "Spiel vorbei",
      "end.first": "Erstes Spiel mit diesen Einstellungen!",
      "end.newBest": "Neuer Rekord! (bisher: {score})",
      "end.best": "Rekord mit diesen Einstellungen: {score}",
      "end.city": "Stadt",
      "end.distance": "Entfernung",
      "end.time": "Zeit",
      "end.points": "Punkte",
      "end.again": "Nochmal spielen",
      "end.menu": "Menü",
    },
  };

  const LANGUAGES = Object.keys(STRINGS);
  const LOCALES = { en: "en-US", de: "de-DE" };
  let lang = "en";

  /** First supported language from the browser's preferences, else English. */
  function detectLanguage() {
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    for (const p of prefs) {
      const base = String(p).toLowerCase().split("-")[0];
      if (LANGUAGES.includes(base)) return base;
    }
    return "en";
  }

  function t(key, params) {
    const s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
    return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : s;
  }

  function setLanguage(l) {
    lang = LANGUAGES.includes(l) ? l : "en";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll("[data-i18n-title]").forEach((n) => { n.title = t(n.dataset.i18nTitle); });
    document.querySelectorAll("[data-i18n-aria]").forEach((n) => { n.setAttribute("aria-label", t(n.dataset.i18nAria)); });
  }

  const getLanguage = () => lang;
  const locale = () => LOCALES[lang];
  const formatNumber = (n, opts) => n.toLocaleString(LOCALES[lang], opts);

  window.CityFinderI18n = { LANGUAGES, detectLanguage, setLanguage, getLanguage, locale, formatNumber, t };
})();
