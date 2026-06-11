
const PRODE_API_URL = "https://script.google.com/macros/s/AKfycbzK9H4XYcgodfd8pHaFAJ6Sh4GvWiDMFkE88tBhwm7Sn5oT-zqNPTrNuKtGy4YwHE-3ZA/exec";

window.PRODE_CONFIG = {
  title: "Prode Mundial 2026",
  subtitle: "Fixture, predicciones públicas y ranking en vivo",
  organizerName: "Santi",


  deadlineIso: "2026-06-11T16:00:00-03:00",


  predictionFormUrl: "#cargar-prode",

  submitPredictionUrl: PRODE_API_URL,

  whatsappUrl: "",

 
  scoring: {
    exactScore: 3,
    outcome: 1,
    miss: 0,
    champion: 10,
    runnerUp: 6,
    topScorer: 6,
    revelation: 4
  },

  sheets: {
    partidosCsvUrl: PRODE_API_URL + "?view=partidos",
    prediccionesCsvUrl: PRODE_API_URL + "?view=predicciones",
    rankingCsvUrl: PRODE_API_URL + "?view=ranking",
    extrasCsvUrl: PRODE_API_URL + "?view=extras",
    eliminatoriasCsvUrl: PRODE_API_URL + "?view=eliminatorias"
  },

  showPredictionsBeforeDeadline: true
};
