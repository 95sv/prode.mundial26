// Configuración principal del Prode Mundial 2026.
// Pegá acá tus links de carga y tus CSV publicados de Google Sheets.

window.PRODE_CONFIG = {
  title: "Prode Mundial 2026",
  subtitle: "Fixture, predicciones públicas y ranking en vivo",
  organizerName: "Santi",

  // Editar según el horario real de cierre. Argentina usa -03:00.
  deadlineIso: "2026-06-11T11:30:00-03:00",

  // Link de carga para participantes. Recomendado: Google Form conectado a Google Sheets.
  predictionFormUrl: "https://docs.google.com/spreadsheets/d/1N577OoDfCjiLG7hSqUut-u0KbNZCU7OJPOZ8Nd0Q1JI/copy",


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
    partidosCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8X_vFY_XHugN0h8LxHy_JU-V0bf_qrLLGzh4f8s1uZ8IxYqzMgGle-tOj9S_F22uC7UfL17SlDuSi/pub?gid=1000094583&single=true&output=csv",
    prediccionesCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8X_vFY_XHugN0h8LxHy_JU-V0bf_qrLLGzh4f8s1uZ8IxYqzMgGle-tOj9S_F22uC7UfL17SlDuSi/pub?gid=1377167273&single=true&output=csv",
    rankingCsvUrl: "",
    extrasCsvUrl: ""
  },

  // Recomendado false: oculta predicciones hasta el cierre.
  showPredictionsBeforeDeadline: false
};
