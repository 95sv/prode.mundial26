const SPREADSHEET_ID = "1-Po1tbzR9tTkH-hPXzePaSsKDJ82ZLFzbb1DQ8n96pk";
const DEADLINE_ISO = "2026-06-11T23:59:00-03:00";
const SHOW_PREDICTIONS_BEFORE_DEADLINE = true;

const PUBLIC_SHEETS = {
  partidos: "Partidos_Publicos",
  predicciones: "Predicciones_Publicas",
  ranking: "Ranking",
  extras: "Extras_Publicos",
  eliminatorias: "Eliminatorias_Publicas",
  draft: "Draft"
};

const AUDIT_PREDICTIONS_SHEET = "Predicciones_Recibidas";
const PUBLIC_PREDICTIONS_SHEET = "Predicciones_Publicas";
const PRODE_VERSION = "prode-cuotas-v1";

const AUDIT_HEADERS = [
  "timestamp", "participante", "whatsapp", "id_partido",
  "prediccion", "pred_mas2", "version"
];
const PUBLIC_HEADERS = ["participante", "id_partido", "prediccion", "pred_mas2"];

function doGet(e) {
  try {
    const view = String((e.parameter && e.parameter.view) || "").toLowerCase();
    const sheetName = PUBLIC_SHEETS[view];

    if (!sheetName) {
      return csvOutput([["error"], ["Vista no permitida"]]);
    }

    if (!SHOW_PREDICTIONS_BEFORE_DEADLINE && isBeforeDeadline() && view === "predicciones") {
      return csvOutput([PUBLIC_HEADERS]);
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

    // Junto resultado 1X2 + over por id_partido en un mismo objeto.
    const byMatch = new Map();
    Object.keys(e.parameter).forEach((key) => {
      if (key.startsWith("pred_")) {
        const id = key.replace(/^pred_/, "");
        if (!validIds.has(id)) return;
        const value = normalizeOutcome(e.parameter[key]);
        if (!value) return;
        if (!byMatch.has(id)) byMatch.set(id, { idPartido: id, prediccion: "", pred_mas2: "" });
        byMatch.get(id).prediccion = value;
      } else if (key.startsWith("over_")) {
        const id = key.replace(/^over_/, "");
        if (!validIds.has(id)) return;
        const value = normalizeOver(e.parameter[key]);
        if (!value) return;
        if (!byMatch.has(id)) byMatch.set(id, { idPartido: id, prediccion: "", pred_mas2: "" });
        byMatch.get(id).pred_mas2 = value;
      }
    });

    // Validar: cada partido válido tiene que tener resultado Y over.
    const predictions = [];
    let missingOutcome = 0;
    let missingOver = 0;
    validIds.forEach((id) => {
      const data = byMatch.get(id);
      if (!data || !data.prediccion) missingOutcome += 1;
      if (!data || !data.pred_mas2) missingOver += 1;
      if (data && data.prediccion && data.pred_mas2) predictions.push(data);
    });

    if (missingOutcome > 0 || missingOver > 0) {
      return textOutput(
        `ERROR: faltan predicciones. Resultados pendientes: ${missingOutcome}, Más de 2 goles pendientes: ${missingOver}.`
      );
    }

    const auditSheet = getOrCreateSheet(ss, AUDIT_PREDICTIONS_SHEET, AUDIT_HEADERS);
    ensureSheetHeaders(auditSheet, AUDIT_HEADERS);

    const timestamp = new Date();
    const rows = predictions.map((item) => [
      timestamp,
      participante,
      whatsapp,
      item.idPartido,
      item.prediccion,
      item.pred_mas2,
      PRODE_VERSION
    ]);

    auditSheet.getRange(auditSheet.getLastRow() + 1, 1, rows.length, AUDIT_HEADERS.length).setValues(rows);
    rebuildPublicPredictions(ss);

    return textOutput("OK: predicción guardada correctamente.");
  } catch (err) {
    return textOutput(`ERROR: ${String(err.message || err)}`);
  }
}

function rebuildPublicPredictions(ss) {
  const auditSheet = getOrCreateSheet(ss, AUDIT_PREDICTIONS_SHEET, AUDIT_HEADERS);
  ensureSheetHeaders(auditSheet, AUDIT_HEADERS);
  const publicSheet = getOrCreateSheet(ss, PUBLIC_PREDICTIONS_SHEET, PUBLIC_HEADERS);
  ensureSheetHeaders(publicSheet, PUBLIC_HEADERS);

  const values = auditSheet.getDataRange().getValues();
  if (values.length <= 1) {
    publicSheet.clearContents();
    publicSheet.getRange(1, 1, 1, PUBLIC_HEADERS.length).setValues([PUBLIC_HEADERS]);
    return;
  }

  // Mapeo dinámico por nombre de columna (resiliente a cambios de orden).
  const headerIdx = mapHeaderIndexes(values[0]);
  const iPart = headerIdx["participante"];
  const iPid = headerIdx["id_partido"];
  const iPred = headerIdx["prediccion"];
  const iOver = headerIdx["pred_mas2"];

  const latest = new Map();
  values.slice(1).forEach((row) => {
    const participante = cleanText(row[iPart]);
    const idPartido = cleanText(row[iPid]);
    const prediccion = normalizeOutcome(row[iPred]);
    const predMas2 = iOver !== undefined ? normalizeOver(row[iOver]) : "";
    if (!participante || !idPartido || !prediccion) return;
    latest.set(`${participante}::${idPartido}`, [participante, idPartido, prediccion, predMas2]);
  });

  const rows = Array.from(latest.values()).sort((a, b) => {
    const byParticipant = a[0].localeCompare(b[0], "es", { sensitivity: "base" });
    return byParticipant || a[1].localeCompare(b[1], "es", { numeric: true });
  });

  publicSheet.clearContents();
  publicSheet.getRange(1, 1, 1, PUBLIC_HEADERS.length).setValues([PUBLIC_HEADERS]);
  if (rows.length) {
    publicSheet.getRange(2, 1, rows.length, PUBLIC_HEADERS.length).setValues(rows);
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

// Si la hoja existe con encabezados viejos, agrega los faltantes al final
// (preserva los datos ya cargados).
function ensureSheetHeaders(sheet, requiredHeaders) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeKey);
  const normalizedRequired = requiredHeaders.map(normalizeKey);
  const missing = [];
  normalizedRequired.forEach((h, idx) => {
    if (current.indexOf(h) === -1) missing.push({ original: requiredHeaders[idx], position: idx });
  });
  if (!missing.length) return;
  // Si la hoja está vacía la inicializamos con todos los headers.
  if (sheet.getLastRow() === 0 || (current.length === 1 && !current[0])) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }
  // Agrego columnas faltantes al final, preservando lo existente.
  missing.forEach((m) => {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue(m.original);
  });
}

function mapHeaderIndexes(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => { map[normalizeKey(h)] = i; });
  return map;
}

function emptyCsvForView(view) {
  if (view === "predicciones") return csvOutput([PUBLIC_HEADERS]);
  if (view === "ranking") return csvOutput([["participante", "puntos_partidos", "puntos_extras", "total"]]);
  if (view === "extras") return csvOutput([["participante", "campeon", "subcampeon", "goleador", "revelacion"]]);
  if (view === "eliminatorias") return csvOutput([["id", "fase", "fecha", "hora", "equipo_a", "equipo_b", "ciudad", "goles_a_real", "goles_b_real"]]);
  if (view === "draft") return csvOutput([["posicion", "participante", "seleccion"]]);
  return csvOutput([["id", "fase", "grupo", "fecha", "hora", "equipo_a", "equipo_b", "ciudad", "goles_a_real", "goles_b_real", "cuota_a", "cuota_e", "cuota_b", "mas_2_real"]]);
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

function normalizeOver(value) {
  const text = String(value == null ? "" : value).trim().toUpperCase();
  if (["S", "SI", "SÍ", "YES", "Y", "OVER", "1", "TRUE"].indexOf(text) !== -1) return "S";
  if (["N", "NO", "UNDER", "0", "FALSE"].indexOf(text) !== -1) return "N";
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
  if (escaped.indexOf(",") !== -1 || escaped.indexOf("\n") !== -1 || escaped.indexOf("\r") !== -1 || escaped.indexOf('"') !== -1) {
    return `"${escaped}"`;
  }
  return escaped;
}
