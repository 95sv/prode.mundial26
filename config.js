// Configuración principal del Prode Mundial 2026.
// En esta versión, la carga de predicciones se hace desde la propia página.
// El formulario envía los datos a Google Apps Script, que guarda todo en tu Google Sheet maestro privado.

const PRODE_API_URL = "https://script.google.com/macros/s/AKfycbzJOaxkaAHyLKCCFWL_b0wkDpL1K6DZ_NvhJjHH867b9T2f-A7J-dw-wt7tCPjrQUJ90g/exec";

window.PRODE_CONFIG = {
  title: "Prode Mundial 2026",
  subtitle: "Fixture, predicciones públicas y ranking en vivo",
  organizerName: "Santi",

  // Editar según el horario real de cierre. Argentina usa -03:00.
  deadlineIso: "2026-06-11T11:30:00-03:00",

  // La carga queda dentro de la web.
  predictionFormUrl: "#cargar-prode",

  // Endpoint de Apps Script para guardar predicciones.
  submitPredictionUrl: PRODE_API_URL,

  // Opcional: link a grupo/contacto de WhatsApp.
  whatsappUrl: "",

  // Para predicción simple solo se usa outcome: acierta ganador/empate.
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
    rankingCsvUrl: `${PRODE_API_URL}?view=ranking`,
    extrasCsvUrl: `${PRODE_API_URL}?view=extras`,
    eliminatoriasCsvUrl: `${PRODE_API_URL}?view=eliminatorias`
  },

  // Recomendado false: oculta predicciones hasta el cierre.
  showPredictionsBeforeDeadline: false
};
