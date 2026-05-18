// Configuración principal del Prode Mundial 2026.
// Pegá acá tus links de carga y tus CSV publicados de Google Sheets.
const PRODE_API_URL = "https://script.google.com/macros/s/AKfycbw07VoXUkmhUG13IK0VCIPdJRQ34uivBtVUGkSZpO-Q9i429_YQzPLe9dECkQvhAKn-zg/exec"
window.PRODE_CONFIG = {
  title: "Prode Mundial 2026",
  subtitle: "Fixture, predicciones públicas y ranking en vivo",
  organizerName: "Santi",

  // Editar según el horario real de cierre. Argentina usa -03:00.
  deadlineIso: "2026-06-11T11:30:00-03:00",

  // Link de carga para participantes. Recomendado: Google Form conectado a Google Sheets.
  predictionFormUrl: "https://docs.google.com/spreadsheets/d/1e1yr8AM2vNCozJMkyKwsq7dknYoPcCWmEnFwmn1zZRA/copy",


  // Opcional: link a grupo/contacto de WhatsApp.
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
    partidosCsvUrl: `${PRODE_API_URL}?view=partidos`,
    prediccionesCsvUrl: `${PRODE_API_URL}?view=predicciones`,
    rankingCsvUrl: "",
    extrasCsvUrl: ""
  },

  // Recomendado false: oculta predicciones hasta el cierre.
  showPredictionsBeforeDeadline: false
};
