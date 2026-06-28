const config = window.PRODE_CONFIG || {};
let partidos = Array.isArray(window.PRODE_FIXTURE) ? [...window.PRODE_FIXTURE] : [];
let eliminatorias = Array.isArray(window.PRODE_KNOCKOUT) ? [...window.PRODE_KNOCKOUT] : [];
let predicciones = [];
let ranking = [];
let predictionDraft = {};       // resultado 1X2 por id_partido (A/E/B)
let predictionOverDraft = {};   // más de 2 goles por id_partido (S/N)

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function normalizeKey(key) {
  return String(key || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function cleanNumber(value) {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Devuelve la bandera emoji para una selección dada.
function flagFor(team) {
  const raw = String(team || "").trim();
  if (!raw) return "";
  const iso = window.PRODE_ISO?.[raw]
    || window.PRODE_ISO?.[window.PRODE_BANDERAS_ALIAS?.[raw] || ""];
  if (iso) {
    return `<img class="team__flag-img" loading="lazy" width="40" height="30" alt="${escapeHtml(raw)}" src="https://flagcdn.com/h40/${iso}.png" srcset="https://flagcdn.com/h80/${iso}.png 2x">`;
  }
  if (/^(ganador|perdedor|clasificado)\b/i.test(raw)) return "🎯";
  return "🏳️";
}
// Bloque visual de un equipo (bandera + nombre). `side` = "a" o "b".
function teamBlock(team, side = "a") {
  const flag = flagFor(team);
  const sideClass = side === "b" ? " team--b" : "";
  return `<span class="team${sideClass}"><span class="team__flag" aria-hidden="true">${flag}</span><span class="team__name">${escapeHtml(team)}</span></span>`;
}

// Pinta de dorado la última palabra del título (estilo branding FWC26).
function applyTitleAccent(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  const words = value.split(/\s+/);
  if (words.length === 1) return escapeHtml(value);
  const last = words.pop();
  return `${escapeHtml(words.join(" "))} <span class="accent">${escapeHtml(last)}</span>`;
}

function normalizeOutcome(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (["A", "LOCAL", "EQUIPO_A", "1"].includes(text)) return "A";
  if (["E", "EMPATE", "X", "0"].includes(text)) return "E";
  if (["B", "VISITANTE", "EQUIPO_B", "2"].includes(text)) return "B";
  return "";
}

// Normaliza la predicción "Más de 2 goles" (Over 2.5) a "S" o "N".
function normalizeOver(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (["S", "SI", "SÍ", "YES", "Y", "OVER", "1", "TRUE"].includes(text)) return "S";
  if (["N", "NO", "UNDER", "0", "FALSE"].includes(text)) return "N";
  return "";
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') { cell += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeKey);
  return rows.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => item[header] = values[index] === undefined ? "" : values[index].trim());
    return item;
  });
}

function isConfiguredUrl(url) {
  return typeof url === "string" && url.trim() && !url.includes("PEGAR") && !url.includes("TU-");
}

async function fetchCsv(url) {
  if (!isConfiguredUrl(url)) return [];
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar CSV: ${response.status}`);
  return parseCsv(await response.text());
}

async function loadData() {
  try {
    const sheets = config.sheets || {};
    const [sheetMatches, sheetPredictions, sheetRanking, sheetKnockout, sheetDraft] = await Promise.all([
      fetchCsv(sheets.partidosCsvUrl).catch(() => []),
      fetchCsv(sheets.prediccionesCsvUrl).catch(() => []),
      fetchCsv(sheets.rankingCsvUrl).catch(() => []),
      fetchCsv(sheets.eliminatoriasCsvUrl).catch(() => []),
      fetchCsv(sheets.draftCsvUrl).catch(() => [])
    ]);
    if (sheetMatches.length) partidos = sheetMatches.map(normalizeMatch);
    if (sheetKnockout.length) eliminatorias = sheetKnockout.map(normalizeKnockout);
    predicciones = dedupePredictions(sheetPredictions.map(normalizePrediction).filter((p) => p.participante && p.id_partido));
    ranking = sheetRanking.length ? sheetRanking.map(normalizeRanking).filter((r) => r.participante) : computeRanking();
    if (sheetDraft.length) loadDraftFromSheet(sheetDraft);
    renderAll();
  } catch (error) {
    console.error(error);
    renderAll();
  }
}

function normalizeMatch(row) {
  const id = row.id || row.id_partido || row.partido_id || "";
  const fromFixture = (window.PRODE_FIXTURE || []).find((m) => m.id === id);
  // Las cuotas pueden venir desde la hoja (cuota_a / cuota_e / cuota_b) o del fixture.js como fallback.
  const cuotaFromSheet = (row.cuota_a !== undefined && row.cuota_a !== "")
    || (row.cuota_e !== undefined && row.cuota_e !== "")
    || (row.cuota_b !== undefined && row.cuota_b !== "");
  const cuotas = cuotaFromSheet
    ? { a: cleanNumber(row.cuota_a), e: cleanNumber(row.cuota_e), b: cleanNumber(row.cuota_b) }
    : fromFixture?.cuotas;
  return {
    id: id,
    fase: row.fase || "Grupos",
    grupo: row.grupo || "",
    fecha_num: row.fecha_num || "",
    fecha: fromFixture?.fecha || row.fecha || "",
    fecha_texto: fromFixture?.fecha_texto || row.fecha_texto || "",
    hora: fromFixture?.hora || row.hora || "",
    equipo_a: row.equipo_a || row.local || row.equipo_local || "",
    equipo_b: row.equipo_b || row.visitante || row.equipo_visitante || "",
    ciudad: row.ciudad || row.sede || "",
    goles_a_real: cleanNumber(row.goles_a_real ?? row.goles_local),
    goles_b_real: cleanNumber(row.goles_b_real ?? row.goles_visitante),
    mas_2_real: normalizeOver(row.mas_2_real ?? row.mas2_real ?? row.over_real ?? ""),
    cuotas: cuotas
  };
}

function normalizeKnockout(row) {
  return {
    id: row.id || row.id_partido || "",
    fase: row.fase || "",
    fecha: row.fecha || row.fecha_texto || "",
    hora: row.hora || "",
    equipo_a: row.equipo_a || row.local || row.equipo_local || "",
    equipo_b: row.equipo_b || row.visitante || row.equipo_visitante || "",
    ciudad: row.ciudad || row.sede || "",
    goles_a_real: cleanNumber(row.goles_a_real ?? row.goles_local),
    goles_b_real: cleanNumber(row.goles_b_real ?? row.goles_visitante)
  };
}

function normalizePrediction(row) {
  return {
    participante: row.participante || row.apodo || row.nombre || "",
    id_partido: row.id_partido || row.id || row.partido_id || "",
    prediccion: normalizeOutcome(row.prediccion || row.resultado || row.pronostico || ""),
    pred_mas2: normalizeOver(row.pred_mas2 ?? row.mas2 ?? row.over ?? row.pred_over ?? ""),
    pred_a: cleanNumber(row.pred_a ?? row.goles_a ?? row.pron_a),
    pred_b: cleanNumber(row.pred_b ?? row.goles_b ?? row.pron_b)
  };
}

function dedupePredictions(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.participante}::${row.id_partido}`;
    map.set(key, row);
  });
  return Array.from(map.values());
}

function normalizeRanking(row) {
  return {
    participante: row.participante || row.apodo || row.nombre || "",
    puntos_partidos: cleanNumber(row.puntos_partidos) || 0,
    puntos_extras: cleanNumber(row.puntos_extras) || 0,
    total: cleanNumber(row.total) || 0
  };
}

function getOutcome(a, b) {
  if (a === "" || b === "") return null;
  if (Number(a) > Number(b)) return "A";
  if (Number(a) < Number(b)) return "B";
  return "E";
}

function getPredictionOutcome(prediction) {
  if (prediction.prediccion) return prediction.prediccion;
  return getOutcome(prediction.pred_a, prediction.pred_b);
}

function getOutcomeLabel(outcome, match = {}) {
  if (outcome === "A") return `Gana ${match.equipo_a || "equipo A"}`;
  if (outcome === "B") return `Gana ${match.equipo_b || "equipo B"}`;
  if (outcome === "E") return "Empate";
  return "Sin predicción";
}

function formatPredictionValue(prediction, match = {}) {
  if (prediction.prediccion) return getOutcomeLabel(prediction.prediccion, match);
  if (prediction.pred_a !== "" && prediction.pred_b !== "") return `${prediction.pred_a} - ${prediction.pred_b}`;
  return "-";
}

// Calcula el "Más de 2 goles" real a partir de los goles del partido.
// Devuelve "S", "N" o "" si todavía no hay datos.
function computeMatchOver(match) {
  if (!match) return "";
  if (match.mas_2_real === "S" || match.mas_2_real === "N") return match.mas_2_real;
  const realA = match.goles_a_real, realB = match.goles_b_real;
  if (realA === "" || realB === "") return "";
  return (Number(realA) + Number(realB)) > 2 ? "S" : "N";
}

// Devuelve el desglose de puntos: { outcomePts, overPts, total } o "" si todavía no se jugó.
function getPredictionPointsDetail(prediction) {
  const match = partidos.find((m) => m.id === prediction.id_partido);
  if (!match) return "";
  const realA = match.goles_a_real, realB = match.goles_b_real;
  if (realA === "" || realB === "") return "";

  const realOutcome = getOutcome(realA, realB);
  const predictedOutcome = getPredictionOutcome(prediction);
  const realOver = computeMatchOver(match);
  const predOver = prediction.pred_mas2;

  const scoring = config.scoring || {};
  const outcomeFactor = scoring.outcomeFactor ?? 100;
  const goalsBonus = scoring.goalsBonus ?? 100;
  const missPts = scoring.miss ?? 0;

  // Acierto 1X2: cuota del resultado real * outcomeFactor.
  // Si no tengo la cuota cargada uso scoring.outcome (esquema legado) como fallback.
  let outcomePts = missPts;
  if (predictedOutcome && realOutcome && predictedOutcome === realOutcome) {
    const cuotas = match.cuotas;
    let cuota = null;
    if (cuotas) {
      if (realOutcome === "A") cuota = Number(cuotas.a);
      else if (realOutcome === "E") cuota = Number(cuotas.e);
      else if (realOutcome === "B") cuota = Number(cuotas.b);
    }
    if (Number.isFinite(cuota) && cuota > 0) {
      outcomePts = Math.round(cuota * outcomeFactor);
    } else {
      outcomePts = scoring.outcome ?? 1;
    }
  }

  // Acierto Más de 2 goles: +goalsBonus si acertó S/N.
  let overPts = 0;
  if (predOver && realOver && predOver === realOver) {
    overPts = goalsBonus;
  }

  return { outcomePts, overPts, total: outcomePts + overPts };
}

// Versión que devuelve solo el total (compatibilidad con código existente).
function getPredictionPoints(prediction) {
  const detail = getPredictionPointsDetail(prediction);
  if (detail === "") return "";
  return detail.total;
}

function computeRanking() {
  const totals = new Map();
  predicciones.forEach((prediction) => {
    const participant = prediction.participante;
    const points = getPredictionPoints(prediction);
    if (!totals.has(participant)) totals.set(participant, { participante: participant, puntos_partidos: 0, puntos_extras: 0, total: 0 });
    if (points !== "") {
      const row = totals.get(participant);
      row.puntos_partidos += Number(points);
      row.total = row.puntos_partidos + row.puntos_extras;
    }
  });
  return Array.from(totals.values()).sort((a, b) => b.total - a.total || a.participante.localeCompare(b.participante));
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function predictionsAreVisible() {
  if (config.showPredictionsBeforeDeadline) return true;
  const deadline = new Date(config.deadlineIso || "");
  if (Number.isNaN(deadline.getTime())) return false;
  return Date.now() >= deadline.getTime();
}

function setupStaticText() {
  $("#app-title").innerHTML = applyTitleAccent(config.title || "Prode Mundial 2026");
  $("#app-subtitle").textContent = config.subtitle || "Fixture, predicciones públicas y ranking";
  $("#organizer-name").textContent = config.organizerName || "Santi";
  const formLink = $("#form-link");
  if (formLink) {
    formLink.href = isConfiguredUrl(config.predictionFormUrl) ? config.predictionFormUrl : "#cargar-prode";
    if (config.predictionFormUrl === "#cargar-prode") formLink.removeAttribute("target");
    if (!isConfiguredUrl(config.predictionFormUrl)) formLink.textContent = "Configurar link de carga";
  }
  const whatsapp = $("#whatsapp-link");
  if (whatsapp && isConfiguredUrl(config.whatsappUrl)) { whatsapp.href = config.whatsappUrl; whatsapp.classList.remove("hidden"); }
  const scoring = config.scoring || {};
  const factorEl = $("#score-outcome-factor");
  if (factorEl) factorEl.textContent = scoring.outcomeFactor ?? 100;
  const bonusEl = $("#score-over-bonus");
  if (bonusEl) bonusEl.textContent = scoring.goalsBonus ?? scoring.over25Bonus ?? 100;
  // IDs legados: solo escribimos si todavía existen en el DOM.
  const scoreExact = $("#score-exact");
  if (scoreExact) scoreExact.textContent = scoring.exactScore ?? 3;
  const scoreOutcome = $("#score-outcome");
  if (scoreOutcome) scoreOutcome.textContent = scoring.outcome ?? 1;
  const scoreMiss = $("#score-miss");
  if (scoreMiss) scoreMiss.textContent = scoring.miss ?? 0;
  const scoreChampion = $("#score-champion");
  if (scoreChampion) scoreChampion.textContent = scoring.champion ?? 10;
  const scoreRunnerUp = $("#score-runner-up");
  if (scoreRunnerUp) scoreRunnerUp.textContent = scoring.runnerUp ?? 6;
  const scoreTopScorer = $("#score-top-scorer");
  if (scoreTopScorer) scoreTopScorer.textContent = scoring.topScorer ?? 6;
  const scoreRevelation = $("#score-revelation");
  if (scoreRevelation) scoreRevelation.textContent = scoring.revelation ?? 4;
}

function activateView(view) {
  $$(".tab").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("is-active", section.id === `view-${view}`));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupTabs() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => activateView(tab.dataset.view)));
}

function setupFilters() {
  const formGroupFilter = $("#prediction-form-group-filter");
  const formSearch = $("#prediction-form-search");
  if (formGroupFilter) formGroupFilter.addEventListener("change", renderPredictionForm);
  if (formSearch) formSearch.addEventListener("input", renderPredictionForm);
  $("#group-filter").addEventListener("change", renderFixture);
  $("#fixture-search").addEventListener("input", renderFixture);
  $("#knockout-phase-filter").addEventListener("change", renderKnockout);
  $("#knockout-search").addEventListener("input", renderKnockout);
  $("#player-filter").addEventListener("change", renderPredictions);
  $("#prediction-group-filter").addEventListener("change", renderPredictions);
  $("#prediction-search").addEventListener("input", renderPredictions);
  $("#refresh-ranking").addEventListener("click", loadData);
}

function fillSelect(select, values, firstLabel = "Todos") {
  const current = select.value;
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = firstLabel.toLowerCase().includes("grupo") ? (value.startsWith("Grupo") ? value : `Grupo ${value}`) : value;
    select.appendChild(option);
  });
  select.value = values.includes(current) ? current : "";
}

function fillPlainSelect(select, values, firstLabel = "Todos") {
  const current = select.value;
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = values.includes(current) ? current : "";
}

function renderFixture() {
  const group = $("#group-filter").value;
  const search = $("#fixture-search").value.trim().toLowerCase();
  const filtered = partidos.filter((match) => {
    const text = `${match.equipo_a} ${match.equipo_b} ${match.ciudad} ${match.fecha}`.toLowerCase();
    return (!group || match.grupo === group) && (!search || text.includes(search));
  });
  $("#fixture-list").innerHTML = filtered.map((match) => {
    const realScore = match.goles_a_real !== "" && match.goles_b_real !== "" ? `${match.goles_a_real} - ${match.goles_b_real}` : "vs";
    const cuota = match.cuotas;
    const cuotasHtml = cuota ? `
      <div class="odds-row" title="Cuotas: ${escapeHtml(cuota.casa || "")}">
        <span class="odd"><em>1</em><strong>${cuota.a}</strong></span>
        <span class="odd"><em>X</em><strong>${cuota.e}</strong></span>
        <span class="odd"><em>2</em><strong>${cuota.b}</strong></span>
      </div>` : "";
    return `<article class="match-card">
      <div class="match-meta"><span class="group-pill">Grupo ${match.grupo}</span><span>${formatDate(match.fecha)} · ${match.hora}</span></div>
      <div class="match-teams">${teamBlock(match.equipo_a, "a")}<span class="score-box">${realScore}</span>${teamBlock(match.equipo_b, "b")}</div>
      ${cuotasHtml}
      <p class="match-location">📍 ${escapeHtml(match.ciudad)}</p>
    </article>`;
  }).join("");
}

function renderKnockout() {
  const phase = $("#knockout-phase-filter").value;
  const search = $("#knockout-search").value.trim().toLowerCase();
  const filtered = eliminatorias.filter((match) => {
    const text = `${match.id} ${match.fase} ${match.equipo_a} ${match.equipo_b} ${match.ciudad} ${match.fecha}`.toLowerCase();
    return (!phase || match.fase === phase) && (!search || text.includes(search));
  });
  $("#knockout-list").innerHTML = filtered.map((match) => {
    const realScore = match.goles_a_real !== "" && match.goles_b_real !== "" ? `${match.goles_a_real} - ${match.goles_b_real}` : "vs";
    const location = match.ciudad ? `<p class="match-location">📍 ${escapeHtml(match.ciudad)}</p>` : "";
    const hour = match.hora ? ` · ${match.hora}` : "";
    return `<article class="match-card"><div class="match-meta"><span class="group-pill knockout-pill">${escapeHtml(match.fase)}</span><span>${escapeHtml(match.fecha)}${hour}</span></div><div class="match-teams">${teamBlock(match.equipo_a, "a")}<span class="score-box">${realScore}</span>${teamBlock(match.equipo_b, "b")}</div>${location}<p class="match-location match-code">Código: ${match.id}</p></article>`;
  }).join("");
  $("#knockout-empty").classList.toggle("hidden", filtered.length > 0);
}

function renderRanking() {
  const body = $("#ranking-body"), empty = $("#ranking-empty");
  const sorted = [...ranking].sort((a, b) => Number(b.total) - Number(a.total) || a.participante.localeCompare(b.participante));
  body.innerHTML = sorted.map((row, index) => `<tr><td class="rank-pos">${index + 1}</td><td>${escapeHtml(row.participante)}</td><td>${row.puntos_partidos || 0}</td><td>${row.puntos_extras || 0}</td><td><strong>${row.total || 0}</strong></td></tr>`).join("");
  empty.classList.toggle("hidden", sorted.length > 0);
}

function renderPredictions() {
  const body = $("#predictions-body"), empty = $("#predictions-empty"), visible = predictionsAreVisible();
  $("#predictions-visibility-note").textContent = visible ? "Predicciones públicas disponibles." : "Las predicciones se muestran después del cierre para evitar copias.";
  if (!visible) { body.innerHTML = ""; empty.textContent = "Las predicciones quedan ocultas hasta el cierre."; empty.classList.remove("hidden"); return; }
  const player = $("#player-filter").value, group = $("#prediction-group-filter").value, search = $("#prediction-search").value.trim().toLowerCase();
  const rows = predicciones.map((prediction) => ({ prediction, match: partidos.find((m) => m.id === prediction.id_partido) || {}, points: getPredictionPoints(prediction) })).filter(({ prediction, match }) => {
    const text = `${prediction.participante} ${match.equipo_a || ""} ${match.equipo_b || ""} ${match.grupo || ""}`.toLowerCase();
    return (!player || prediction.participante === player) && (!group || match.grupo === group) && (!search || text.includes(search));
  });
  body.innerHTML = rows.map(({ prediction, match, points }) => {
    const result = match.goles_a_real !== "" && match.goles_b_real !== "" ? `${match.goles_a_real} - ${match.goles_b_real}` : "Pendiente";
    const teamA = match.equipo_a ? `${flagFor(match.equipo_a)} ${escapeHtml(match.equipo_a)}` : escapeHtml(prediction.id_partido);
    const teamB = match.equipo_b ? `${escapeHtml(match.equipo_b)} ${flagFor(match.equipo_b)}` : "";
    const realOver = computeMatchOver(match);
    const overCell = formatOverCell(prediction.pred_mas2, realOver);
    return `<tr><td>${escapeHtml(prediction.participante)}</td><td>Grupo ${escapeHtml(match.grupo || "-")}</td><td>${teamA} <span class="vs-sep">vs</span> ${teamB}</td><td class="pred-score">${escapeHtml(formatPredictionValue(prediction, match))}</td><td class="pred-score">${overCell}</td><td class="pred-score">${result}</td><td>${points === "" ? "-" : points}</td></tr>`;
  }).join("");
  empty.textContent = "Todavía no hay predicciones públicas configuradas.";
  empty.classList.toggle("hidden", rows.length > 0);
}

// Devuelve la celda "predicción / resultado" para Más de 2 goles. Ej.: "S / —" o "N / S".
function formatOverCell(predOver, realOver) {
  const left = predOver === "S" ? "Sí" : predOver === "N" ? "No" : "-";
  const right = realOver === "S" ? "Sí" : realOver === "N" ? "No" : "—";
  return `${left} / ${right}`;
}

function renderStats() {
  const players = new Set(predicciones.map((p) => p.participante).filter(Boolean));
  $("#stat-matches").textContent = partidos.length + eliminatorias.length;
  $("#stat-players").textContent = players.size;
  $("#stat-predictions").textContent = predictionsAreVisible() ? predicciones.length : 0;
}

function renderSelects() {
  const groups = Array.from(new Set(partidos.map((m) => m.grupo).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const players = Array.from(new Set(predicciones.map((p) => p.participante).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const phases = Array.from(new Set(eliminatorias.map((m) => m.fase).filter(Boolean)));
  fillSelect($("#group-filter"), groups, "Todos los grupos");
  fillSelect($("#prediction-group-filter"), groups, "Todos los grupos");
  const formGroupFilter = $("#prediction-form-group-filter");
  if (formGroupFilter) fillSelect(formGroupFilter, groups, "Todos los grupos");
  fillSelect($("#player-filter"), players, "Todos los participantes");
  fillPlainSelect($("#knockout-phase-filter"), phases, "Todas las fases");
}

function isDeadlineClosed() {
  const deadline = new Date(config.deadlineIso || "");
  return !Number.isNaN(deadline.getTime()) && Date.now() >= deadline.getTime();
}

function getSelectedPredictionValues() {
  const form = $("#prediction-form");
  if (!form) return { outcomes: { ...predictionDraft }, overs: { ...predictionOverDraft } };
  const data = new FormData(form);
  partidos.forEach((match) => {
    const value = data.get(`draft_${match.id}`);
    if (value) predictionDraft[match.id] = value;
    const overValue = data.get(`over_${match.id}`);
    if (overValue) predictionOverDraft[match.id] = overValue;
  });
  return { outcomes: { ...predictionDraft }, overs: { ...predictionOverDraft } };
}

function updatePredictionProgress() {
  const node = $("#prediction-progress");
  if (!node) return;
  getSelectedPredictionValues();
  const selectedOutcomes = Object.keys(predictionDraft).length;
  const selectedOvers = Object.keys(predictionOverDraft).length;
  // Cada partido aporta 2 selecciones (resultado + más de 2 goles)
  node.textContent = `${selectedOutcomes} de ${partidos.length} resultados · ${selectedOvers} de ${partidos.length} más de 2 goles`;
}

function addPredictionHiddenFields(form) {
  form.querySelectorAll(".prediction-hidden-input").forEach((input) => input.remove());
  partidos.forEach((match) => {
    const outcomeValue = predictionDraft[match.id];
    if (outcomeValue) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = `pred_${match.id}`;
      input.value = outcomeValue;
      input.className = "prediction-hidden-input";
      form.appendChild(input);
    }
    const overValue = predictionOverDraft[match.id];
    if (overValue) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = `over_${match.id}`;
      input.value = overValue;
      input.className = "prediction-hidden-input";
      form.appendChild(input);
    }
  });
}

function renderPredictionForm() {
  const list = $("#prediction-form-list");
  if (!list) return;
  const selected = getSelectedPredictionValues();
  const groupFilter = $("#prediction-form-group-filter")?.value || "";
  const search = ($("#prediction-form-search")?.value || "").trim().toLowerCase();
  const filtered = partidos.filter((match) => {
    const text = `${match.grupo} ${match.equipo_a} ${match.equipo_b} ${match.ciudad} ${match.fecha_texto}`.toLowerCase();
    return (!groupFilter || match.grupo === groupFilter) && (!search || text.includes(search));
  });

  const groups = Array.from(new Set(filtered.map((match) => match.grupo))).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  list.innerHTML = groups.map((group) => {
    const matches = filtered.filter((match) => match.grupo === group);
    return `<details class="prediction-group" open><summary>Grupo ${escapeHtml(group)} <span>${matches.length} partidos</span></summary>${matches.map(renderPredictionMatch).join("")}</details>`;
  }).join("");

  partidos.forEach((match) => {
    const outcomeValue = selected.outcomes[match.id];
    if (outcomeValue) {
      const input = list.querySelector(`input[name="draft_${match.id}"][value="${outcomeValue}"]`);
      if (input) input.checked = true;
    }
    const overValue = selected.overs[match.id];
    if (overValue) {
      const input = list.querySelector(`input[name="over_${match.id}"][value="${overValue}"]`);
      if (input) input.checked = true;
    }
  });

  updatePredictionProgress();
}

function renderPredictionMatch(match) {
  const name = `draft_${match.id}`;
  const overName = `over_${match.id}`;
  const cuota = match.cuotas;
  const odd = (val) => (val !== undefined && val !== null && val !== "")
    ? `<small class="opt-odd">${val}</small>`
    : "";
  return `<article class="prediction-match-card">
    <div class="prediction-match-meta"><span>${escapeHtml(formatDate(match.fecha))} · ${escapeHtml(match.hora)}</span><span>${escapeHtml(match.ciudad)}</span></div>
    <div class="prediction-match-title">${teamBlock(match.equipo_a, "a")}<span class="vs">VS</span>${teamBlock(match.equipo_b, "b")}</div>
    <div class="outcome-options" role="radiogroup" aria-label="Predicción para ${escapeHtml(match.equipo_a)} vs ${escapeHtml(match.equipo_b)}">
      <label><input type="radio" name="${name}" value="A" /><span><span class="opt-line">${flagFor(match.equipo_a)}<span>Gana ${escapeHtml(match.equipo_a)}</span></span>${odd(cuota?.a)}</span></label>
      <label><input type="radio" name="${name}" value="E" /><span><span class="opt-line">Empate</span>${odd(cuota?.e)}</span></label>
      <label><input type="radio" name="${name}" value="B" /><span><span class="opt-line"><span>Gana ${escapeHtml(match.equipo_b)}</span>${flagFor(match.equipo_b)}</span>${odd(cuota?.b)}</span></label>
    </div>
    <div class="over-options" role="radiogroup" aria-label="Más de 2 goles para ${escapeHtml(match.equipo_a)} vs ${escapeHtml(match.equipo_b)}">
      <span class="over-options__label">Más de 2 goles</span>
      <label><input type="radio" name="${overName}" value="S" /><span>Sí</span></label>
      <label><input type="radio" name="${overName}" value="N" /><span>No</span></label>
    </div>
  </article>`;
}

function setupPredictionSubmit() {
  const form = $("#prediction-form");
  if (!form) return;
  const submitUrl = config.submitPredictionUrl || config.predictionSubmitUrl || "";
  const status = $("#prediction-form-status");
  const button = $("#prediction-submit-button");
  const frame = $("#prediction-submit-frame");
  let submitted = false;

  if (isConfiguredUrl(submitUrl)) {
    form.action = submitUrl;
  } else {
    status.textContent = "Falta configurar submitPredictionUrl en config.js.";
    button.disabled = true;
  }

  if (isDeadlineClosed()) {
    status.textContent = "La carga de predicciones ya está cerrada.";
    button.disabled = true;
    form.classList.add("is-disabled");
  }

  form.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.name) {
      if (target.name.startsWith("draft_")) {
        predictionDraft[target.name.replace(/^draft_/, "")] = target.value;
      } else if (target.name.startsWith("over_")) {
        predictionOverDraft[target.name.replace(/^over_/, "")] = target.value;
      }
    }
    updatePredictionProgress();
  });
  form.addEventListener("submit", (event) => {
    getSelectedPredictionValues();
    if (!isConfiguredUrl(submitUrl)) {
      event.preventDefault();
      status.textContent = "Falta configurar submitPredictionUrl en config.js.";
      return;
    }
    if (isDeadlineClosed()) {
      event.preventDefault();
      status.textContent = "La carga de predicciones ya está cerrada.";
      return;
    }
    const missingOutcomes = partidos.length - Object.keys(predictionDraft).length;
    const missingOvers = partidos.length - Object.keys(predictionOverDraft).length;
    if (missingOutcomes > 0 || missingOvers > 0) {
      event.preventDefault();
      const parts = [];
      if (missingOutcomes > 0) parts.push(`${missingOutcomes} resultados`);
      if (missingOvers > 0) parts.push(`${missingOvers} predicciones de Más de 2 goles`);
      status.textContent = `Faltan ${parts.join(" y ")} por completar.`;
      return;
    }
    addPredictionHiddenFields(form);
    submitted = true;
    status.textContent = "Enviando predicción... Si se guardó correctamente, vas a ver el mensaje de confirmación en unos segundos.";
    button.disabled = true;
  });

  if (frame) {
    frame.addEventListener("load", () => {
      if (!submitted) return;
      status.textContent = "Predicción enviada. Si necesitás corregir algo, avisale al organizador por WhatsApp.";
      button.disabled = false;
      submitted = false;
    });
  }
}

function renderHomeNextMatch() {
  const container = $("#home-next-match");
  if (!container) return;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const unplayedGroups = partidos
    .filter((m) => m.fecha >= today && m.goles_a_real === "" && m.goles_b_real === "")
    .map(m => ({ ...m, _src: "grupo" }));

  const unplayedKnockout = eliminatorias
    .filter((m) => m.fecha && m.fecha >= today && m.goles_a_real === "" && m.goles_b_real === "")
    .map(m => ({ ...m, _src: "eliminatoria" }));

  const all = [...unplayedGroups, ...unplayedKnockout].sort((a, b) => {
    const ka = a.fecha + (a.hora || "");
    const kb = b.fecha + (b.hora || "");
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  if (!all.length) {
    container.innerHTML = `<p class="empty-state">No hay partidos próximos.</p>`;
    return;
  }
  const nextDate = all[0].fecha;
  const dayMatches = all.filter((m) => m.fecha === nextDate);
  container.innerHTML = dayMatches.map((match) => {
    const isKnockout = match._src === "eliminatoria";
    const pillClass = isKnockout ? "group-pill knockout-pill" : "group-pill";
    const pillText = isKnockout ? escapeHtml(match.fase) : `Grupo ${escapeHtml(match.grupo)}`;
    const cuota = match.cuotas;
    const cuotasHtml = cuota ? `
      <div class="odds-row">
        <span class="odd"><em>1</em><strong>${cuota.a}</strong></span>
        <span class="odd"><em>X</em><strong>${cuota.e}</strong></span>
        <span class="odd"><em>2</em><strong>${cuota.b}</strong></span>
      </div>` : "";
    return `<article class="match-card home-next-match-card">
      <div class="match-meta"><span class="${pillClass}">${pillText}</span><span>${formatDate(match.fecha)} · ${escapeHtml(match.hora)}</span></div>
      <div class="match-teams">${teamBlock(match.equipo_a, "a")}<span class="score-box">vs</span>${teamBlock(match.equipo_b, "b")}</div>
      ${cuotasHtml}
      ${match.ciudad ? `<p class="match-location">📍 ${escapeHtml(match.ciudad)}</p>` : ""}
    </article>`;
  }).join("");
}

function renderHomeRanking() {
  const body = $("#home-ranking-body");
  if (!body) return;
  const sorted = [...ranking].sort((a, b) => Number(b.total) - Number(a.total) || a.participante.localeCompare(b.participante));
  body.innerHTML = sorted.map((row, i) => `<tr><td class="rank-pos">${i + 1}</td><td>${escapeHtml(row.participante)}</td><td>${row.puntos_partidos || 0}</td><td>${row.puntos_extras || 0}</td><td><strong>${row.total || 0}</strong></td></tr>`).join("");
  const empty = $("#home-ranking-empty");
  if (empty) empty.classList.toggle("hidden", sorted.length > 0);
}

// ============================================================
// FASE FINAL — Draft System
// ============================================================
const QUALIFIED_TEAMS = [
  "Argentina", "Brasil", "Francia", "Alemania", "España", "Inglaterra",
  "Italia", "Países Bajos", "Portugal", "Bélgica", "Croacia", "Japón",
  "México", "Estados Unidos", "Canadá", "Colombia", "Uruguay", "Ecuador",
  "Senegal", "Marruecos", "Nigeria", "Ghana", "Corea del Sur", "Australia",
  "Serbia", "Suiza", "Polonia", "Dinamarca", "Suecia", "Austria", "República Checa", "Escocia"
];

let draftState = {
  active: false,
  currentPick: 1,
  selections: [],
  availableTeams: [...QUALIFIED_TEAMS]
};

function loadDraftFromSheet(sheetDraft) {
  draftState.selections = [];
  draftState.availableTeams = [...QUALIFIED_TEAMS];
  
  sheetDraft.forEach(row => {
    const position = cleanNumber(row.posicion);
    const player = row.participante || "";
    const team = row.seleccion || "";
    
    if (position && player && team) {
      draftState.selections.push({ position, player, team });
      draftState.availableTeams = draftState.availableTeams.filter(t => t !== team);
    }
  });
  
  draftState.selections.sort((a, b) => a.position - b.position);
  draftState.currentPick = draftState.selections.length + 1;
  draftState.active = draftState.currentPick <= 32 && draftState.selections.length < 32;
}

function renderDraft() {
  renderDraftStatus();
  renderDraftRanking();
  renderDraftCountries();
  renderDraftSelections();
}

function renderDraftStatus() {
  const statusEl = $("#draft-status");
  if (!statusEl) return;
  if (draftState.active) {
    statusEl.textContent = `Draft activo — Turno del puesto #${draftState.currentPick}`;
    statusEl.style.background = "rgba(31, 203, 107, 0.2)";
  } else {
    statusEl.textContent = "El draft comenzará cuando finalicen los 72 partidos de grupos.";
    statusEl.style.background = "rgba(31, 203, 107, 0.1)";
  }
}

function renderDraftRanking() {
  const listEl = $("#draft-ranking-list");
  if (!listEl) return;
  if (!ranking.length) {
    listEl.innerHTML = '<p class="empty-state">El ranking se calculará automáticamente una vez finalizada la fase de grupos.</p>';
    return;
  }
  const top32 = ranking.slice(0, 32);
  listEl.innerHTML = top32.map((player, index) => {
    const position = index + 1;
    const isTop3 = position <= 3;
    const selectedTeam = draftState.selections.find(s => s.position === position);
    return `
      <div class="draft-rank-item${selectedTeam ? ' selected' : ''}">
        <div class="draft-rank-position${isTop3 ? ' top-3' : ''}">${position}</div>
        <div class="draft-rank-name">${escapeHtml(player.participante)}</div>
        <div class="draft-rank-points">${player.total || 0} pts</div>
        ${selectedTeam ? `<div class="draft-country-status">✓ ${selectedTeam.team}</div>` : ''}
      </div>`;
  }).join('');
}

function renderDraftCountries() {
  const listEl = $("#draft-countries-list");
  if (!listEl) return;
  if (!draftState.active) {
    listEl.innerHTML = '<p class="empty-state">Las selecciones se mostrarán una vez que comience el draft.</p>';
    return;
  }
  listEl.innerHTML = draftState.availableTeams.map(team => {
    const isSelected = draftState.selections.some(s => s.team === team);
    return `
      <div class="draft-country-item${isSelected ? ' selected' : ''}" data-team="${escapeHtml(team)}">
        <div class="draft-country-flag">⚽</div>
        <div class="draft-country-name">${escapeHtml(team)}</div>
        <div class="draft-country-status">${isSelected ? 'Seleccionado' : 'Disponible'}</div>
      </div>`;
  }).join('');
}

function renderDraftSelections() {
  const listEl = $("#draft-selections-list");
  if (!listEl) return;
  if (!draftState.selections.length) {
    listEl.innerHTML = '<p class="empty-state">Aún no se han realizado selecciones.</p>';
    return;
  }
  listEl.innerHTML = draftState.selections.map(sel => `
    <div class="draft-selection-item">
      <div class="draft-selection-position">#${sel.position}</div>
      <div class="draft-selection-player">${escapeHtml(sel.player)}</div>
      <div class="draft-selection-country">${escapeHtml(sel.team)}</div>
    </div>`).join('');
}

function initDraft() {
  draftState.active = true;
  draftState.currentPick = 1;
  draftState.selections = [];
  draftState.availableTeams = [...QUALIFIED_TEAMS];
  renderDraft();
}

function makeDraftPick(position, player, team) {
  if (!draftState.active) return false;
  if (position !== draftState.currentPick) return false;
  if (!draftState.availableTeams.includes(team)) return false;
  draftState.selections.push({ position, player, team });
  draftState.availableTeams = draftState.availableTeams.filter(t => t !== team);
  draftState.currentPick++;
  if (draftState.currentPick > 32) draftState.active = false;
  renderDraft();
  return true;
}

// Bracket — Llaves de eliminación
const BRACKET_ROUNDS = [
  { title: "Dieciseisavos", ids: ["D01","D02","D03","D04","D05","D06","D07","D08","D09","D10","D11","D12","D13","D14","D15","D16"] },
  { title: "Octavos", ids: ["O01","O02","O03","O04","O05","O06","O07","O08"] },
  { title: "Cuartos", ids: ["C01","C02","C03","C04"] },
  { title: "Semifinal", ids: ["S01","S02"] },
  { title: "Final", ids: ["F01"], isFinal: true },
];
const BRACKET_THIRD = { title: "3er Puesto", ids: ["TP01"] };

function bracketMatchHtml(match) {
  if (!match) return `<div class="bracket-match"><div class="bracket-match-team bracket-match-placeholder">Por definir</div></div>`;
  const a = match.equipo_a || "Por definir";
  const b = match.equipo_b || "Por definir";
  const hasResult = match.goles_a_real !== "" && match.goles_a_real !== undefined && match.goles_a_real !== null && match.goles_b_real !== "" && match.goles_b_real !== undefined && match.goles_b_real !== null;
  const winnerA = hasResult && Number(match.goles_a_real) > Number(match.goles_b_real);
  const winnerB = hasResult && Number(match.goles_b_real) > Number(match.goles_a_real);
  return `<div class="bracket-match">
    <div class="bracket-match-team${winnerA ? " is-winner" : ""}">${flagFor(a)}<span>${escapeHtml(a)}</span>${hasResult ? `<span class="bracket-match-score">${match.goles_a_real}</span>` : ""}</div>
    <div class="bracket-match-team${winnerB ? " is-winner" : ""}">${flagFor(b)}<span>${escapeHtml(b)}</span>${hasResult ? `<span class="bracket-match-score">${match.goles_b_real}</span>` : ""}</div>
  </div>`;
}

function renderBracket() {
  const container = $("#home-bracket");
  if (!container) return;
  if (!eliminatorias.length) { container.innerHTML = '<p class="empty-state">Las llaves se mostrarán cuando estén configuradas las eliminatorias.</p>'; return; }
  const byId = {};
  eliminatorias.forEach(m => { byId[m.id] = m; });
  let html = "";
  BRACKET_ROUNDS.forEach(round => {
    const isFinal = round.isFinal;
    html += `<div class="bracket-round${isFinal ? " bracket-final-round" : ""}"><div class="bracket-round-title">${round.title}</div>`;
    round.ids.forEach(id => { html += bracketMatchHtml(byId[id]); });
    html += "</div>";
  });
  const tpMatch = byId[BRACKET_THIRD.ids[0]];
  html += `<div class="bracket-round"><div class="bracket-round-title">${BRACKET_THIRD.title}</div>${bracketMatchHtml(tpMatch)}</div>`;
  container.innerHTML = html;
}

function renderAll() { renderSelects(); renderStats(); renderPredictionForm(); renderFixture(); renderKnockout(); renderRanking(); renderPredictions(); renderHomeNextMatch(); renderHomeRanking(); renderDraft(); renderBracket(); }

document.addEventListener("DOMContentLoaded", () => {
  setupStaticText(); setupTabs(); setupFilters(); setupPredictionSubmit();
  renderAll();
  loadData();
});