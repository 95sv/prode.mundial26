
const PRODE_API_URL = "https://script.google.com/macros/s/AKfycbwRKXQ4AOGisMLSykCedBmlMrUCPwNQDtKl2K6HlrEb9cTIMkP_-ekIlH_RJCl33qlwFw/exec";

window.PRODE_CONFIG = {
  title: "Prode 26",
  subtitle: "Seguí el ranking en vivo y los próximos partidos del Mundial Canadá · México · Estados Unidos 2026.",
  organizerName: "Santi",


deadlineIso: "2026-06-11T23:59:00-03:00",


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
    eliminatoriasCsvUrl: PRODE_API_URL + "?view=eliminatorias",
    draftCsvUrl: PRODE_API_URL + "?view=draft"
  },

  showPredictionsBeforeDeadline: true
};
