// Apps Script para Prode Mundial 2026.
// Funciona como API pública controlada: entrega datos públicos por GET y recibe predicciones por POST.
// El Google Sheet maestro puede permanecer privado.

const SPREADSHEET_ID = "PEGAR_ID_DEL_GOOGLE_SHEET_MAESTRO";
const DEADLINE_ISO = "2026-06-11T11:30:00-03:00";
const SHOW_PREDICTIONS_BEFORE_DEADLINE = false;

const PUBLIC_SHEETS = {
  partidos: "Partidos_Publicos",
  predicciones: "Predicciones_Publicas",
  ranking: "Ranking",
  extras: "Extras_Publicos",
  eliminatorias: "Eliminatorias_Publicas"
};

const AUDIT_PREDICTIONS_SHEET = "Predicciones_Recibidas";
const PUBLIC_PREDICTIONS_SHEET = "Predicciones_Publicas";

function doGet(e) {
  try {
    const view = String((e.parameter && e.parameter.view) || "").toLowerCase();
    const sheetName = PUBLIC_SHEETS[view];

    if (!sheetName) {
      return csvOutput([["error"], ["Vista no permitida"]]);
    }

    if (!SHOW_PREDICTIONS_BEFORE_DEADLINE && isBeforeDeadline() && view === "predicciones") {
      return csvOutput([["participante", "id_partido", "prediccion"]]);
    }

    if (!SHOW_PREDICTIONS_BEFORE_DEADLINE && isBeforeDeadline() && view === "ranking") {
      return csvOutput([["participante", "puntos_partidos", "puntos_extras", "total"]]);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return emptyCsvForView(view);
    }

    const values = sheet.getDataRange().getDisplayValues();
    return csvOutput(values);
  } catch (err) {
    return csvOutput([["error"], [String(err.message || err)]]);
  }
}

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return textOutput("ERROR: no se recibieron datos.");
    }

    if (!SHOW_PREDICTIONS_BEFORE_DEADLINE && !isBeforeDeadline()) {
      return textOutput("ERROR: el plazo para cargar predicciones ya cerró.");
    }

    const participante = cleanText(e.parameter.participante);
    const whatsapp = cleanText(e.parameter.whatsapp || "");

    if (!participante) {
      return textOutput("ERROR: falta nombre o apodo.");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const validIds = getValidMatchIds(ss);
    const predictions = [];

    Object.keys(e.parameter).forEach((key) => {
      if (!key.startsWith("pred_")) return;
      const idPartido = key.replace(/^pred_/, "");
      const prediccion = normalizeOutcome(e.parameter[key]);
      if (!validIds.has(idPartido)) return;
      if (!prediccion) return;
      predictions.push({ idPartido, prediccion });
    });

    if (predictions.length !== validIds.size) {
      return textOutput(`ERROR: faltan predicciones. Recibidas ${predictions.length} de ${validIds.size}.`);
    }

    const auditSheet = getOrCreateSheet(ss, AUDIT_PREDICTIONS_SHEET, [
      "timestamp", "participante", "whatsapp", "id_partido", "prediccion", "version"
    ]);

    const timestamp = new Date();
    const rows = predictions.map((item) => [
      timestamp,
      participante,
      whatsapp,
      item.idPartido,
      item.prediccion,
      "resultado-simple-v1"
    ]);

    auditSheet.getRange(auditSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    rebuildPublicPredictions(ss);

    return textOutput("OK: predicción guardada correctamente.");
  } catch (err) {
    return textOutput(`ERROR: ${String(err.message || err)}`);
  }
}

function rebuildPublicPredictions(ss) {
  const auditSheet = getOrCreateSheet(ss, AUDIT_PREDICTIONS_SHEET, [
    "timestamp", "participante", "whatsapp", "id_partido", "prediccion", "version"
  ]);
  const publicSheet = getOrCreateSheet(ss, PUBLIC_PREDICTIONS_SHEET, [
    "participante", "id_partido", "prediccion"
  ]);

  const values = auditSheet.getDataRange().getValues();
  if (values.length <= 1) {
    publicSheet.clearContents();
    publicSheet.getRange(1, 1, 1, 3).setValues([["participante", "id_partido", "prediccion"]]);
    return;
  }

  const latest = new Map();
  values.slice(1).forEach((row) => {
    const participante = cleanText(row[1]);
    const idPartido = cleanText(row[3]);
    const prediccion = normalizeOutcome(row[4]);
    if (!participante || !idPartido || !prediccion) return;
    latest.set(`${participante}::${idPartido}`, [participante, idPartido, prediccion]);
  });

  const rows = Array.from(latest.values()).sort((a, b) => {
    const byParticipant = a[0].localeCompare(b[0], "es", { sensitivity: "base" });
    return byParticipant || a[1].localeCompare(b[1], "es", { numeric: true });
  });

  publicSheet.clearContents();
  publicSheet.getRange(1, 1, 1, 3).setValues([["participante", "id_partido", "prediccion"]]);
  if (rows.length) {
    publicSheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

function getValidMatchIds(ss) {
  const sheet = ss.getSheetByName(PUBLIC_SHEETS.partidos);
  if (!sheet) throw new Error(`No existe la hoja ${PUBLIC_SHEETS.partidos}`);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return new Set();
  const headers = values[0].map(normalizeKey);
  const idIndex = headers.indexOf("id");
  if (idIndex === -1) throw new Error("La hoja Partidos_Publicos debe tener una columna id.");
  return new Set(values.slice(1).map((row) => cleanText(row[idIndex])).filter(Boolean));
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function emptyCsvForView(view) {
  if (view === "predicciones") return csvOutput([["participante", "id_partido", "prediccion"]]);
  if (view === "ranking") return csvOutput([["participante", "puntos_partidos", "puntos_extras", "total"]]);
  if (view === "extras") return csvOutput([["participante", "campeon", "subcampeon", "goleador", "revelacion"]]);
  if (view === "eliminatorias") return csvOutput([["id", "fase", "fecha", "hora", "equipo_a", "equipo_b", "ciudad", "goles_a_real", "goles_b_real"]]);
  return csvOutput([["id", "fase", "grupo", "fecha", "hora", "equipo_a", "equipo_b", "ciudad", "goles_a_real", "goles_b_real"]]);
}

function isBeforeDeadline() {
  return new Date().getTime() < new Date(DEADLINE_ISO).getTime();
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function cleanText(value) {
  return String(value == null ? "" : value).trim().slice(0, 120);
}

function normalizeOutcome(value) {
  const text = String(value == null ? "" : value).trim().toUpperCase();
  if (["A", "LOCAL", "EQUIPO_A", "1"].includes(text)) return "A";
  if (["E", "EMPATE", "X", "0"].includes(text)) return "E";
  if (["B", "VISITANTE", "EQUIPO_B", "2"].includes(text)) return "B";
  return "";
}

function csvOutput(values) {
  const csv = values.map((row) => row.map(escapeCsv).join(",")).join("\n");
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

function textOutput(value) {
  return ContentService.createTextOutput(String(value)).setMimeType(ContentService.MimeType.TEXT);
}

function escapeCsv(value) {
  const text = String(value == null ? "" : value);
  const escaped = text.replace(/"/g, '""');
  if (escaped.includes(",") || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}
