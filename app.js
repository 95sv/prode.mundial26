const config = window.PRODE_CONFIG || {};
let partidos = Array.isArray(window.PRODE_FIXTURE) ? [...window.PRODE_FIXTURE] : [];
let eliminatorias = Array.isArray(window.PRODE_KNOCKOUT) ? [...window.PRODE_KNOCKOUT] : [];
let predicciones = [];
let ranking = [];
let extras = [];
let predictionDraft = {};

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

function normalizeOutcome(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (["A", "LOCAL", "EQUIPO_A", "1"].includes(text)) return "A";
  if (["E", "EMPATE", "X", "0"].includes(text)) return "E";
  if (["B", "VISITANTE", "EQUIPO_B", "2"].includes(text)) return "B";
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
    const [sheetMatches, sheetPredictions, sheetRanking, sheetExtras, sheetKnockout] = await Promise.all([
      fetchCsv(sheets.partidosCsvUrl).catch(() => []),
      fetchCsv(sheets.prediccionesCsvUrl).catch(() => []),
      fetchCsv(sheets.rankingCsvUrl).catch(() => []),
      fetchCsv(sheets.extrasCsvUrl).catch(() => []),
      fetchCsv(sheets.eliminatoriasCsvUrl).catch(() => [])
    ]);
    if (sheetMatches.length) partidos = sheetMatches.map(normalizeMatch);
    if (sheetKnockout.length) eliminatorias = sheetKnockout.map(normalizeKnockout);
    predicciones = dedupePredictions(sheetPredictions.map(normalizePrediction).filter((p) => p.participante && p.id_partido));
    extras = sheetExtras;
    ranking = sheetRanking.length ? sheetRanking.map(normalizeRanking).filter((r) => r.participante) : computeRanking();
    renderAll();
  } catch (error) {
    console.error(error);
    renderAll();
  }
}

function normalizeMatch(row) {
  return {
    id: row.id || row.id_partido || row.partido_id || "",
    fase: row.fase || "Grupos",
    grupo: String(row.grupo || "").replace("Grupo ", ""),
    fecha_num: cleanNumber(row.fecha_num) || "",
    fecha: row.fecha || "",
    fecha_texto: row.fecha_texto || "",
    hora: row.hora || "",
    equipo_a: row.equipo_a || row.local || row.equipo_local || "",
    equipo_b: row.equipo_b || row.visitante || row.equipo_visitante || "",
    ciudad: row.ciudad || row.sede || "",
    goles_a_real: cleanNumber(row.goles_a_real ?? row.real_a),
    goles_b_real: cleanNumber(row.goles_b_real ?? row.real_b)
  };
}

function normalizeKnockout(row) {
  return {
    id: row.id || row.id_partido || row.partido_id || "",
    fase: row.fase || "Eliminación directa",
    fecha: row.fecha || row.fecha_texto || "",
    hora: row.hora || "",
    equipo_a: row.equipo_a || row.local || row.equipo_local || "",
    equipo_b: row.equipo_b || row.visitante || row.equipo_visitante || "",
    ciudad: row.ciudad || row.sede || "",
    goles_a_real: cleanNumber(row.goles_a_real ?? row.real_a),
    goles_b_real: cleanNumber(row.goles_b_real ?? row.real_b)
  };
}

function normalizePrediction(row) {
  return {
    participante: row.participante || row.apodo || row.nombre || "",
    id_partido: row.id_partido || row.id || row.partido_id || "",
    prediccion: normalizeOutcome(row.prediccion ?? row.resultado ?? row.outcome ?? row.pronostico),
    pred_a: cleanNumber(row.pred_a ?? row.goles_a ?? row.prediccion_a),
    pred_b: cleanNumber(row.pred_b ?? row.goles_b ?? row.prediccion_b)
  };
}

function dedupePredictions(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = `${item.participante}::${item.id_partido}`;
    map.set(key, item);
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

function getPredictionPoints(prediction) {
  const match = partidos.find((m) => m.id === prediction.id_partido);
  if (!match) return "";
  const realA = match.goles_a_real, realB = match.goles_b_real;
  if (realA === "" || realB === "") return "";
  const realOutcome = getOutcome(realA, realB);
  const predictedOutcome = getPredictionOutcome(prediction);
  if (!predictedOutcome) return "";

  // Compatibilidad con predicciones antiguas por goles exactos.
  if (!prediction.prediccion && prediction.pred_a !== "" && prediction.pred_b !== "") {
    if (Number(realA) === Number(prediction.pred_a) && Number(realB) === Number(prediction.pred_b)) return config.scoring?.exactScore ?? 3;
  }

  return realOutcome === predictedOutcome ? (config.scoring?.outcome ?? 1) : (config.scoring?.miss ?? 0);
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

function formatDeadline() {
  const deadline = new Date(config.deadlineIso || "");
  if (Number.isNaN(deadline.getTime())) return;
  $("#deadline-text").textContent = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(deadline);
  updateCountdown();
}

function updateCountdown() {
  const node = $("#countdown-text"), deadline = new Date(config.deadlineIso || "");
  if (!node || Number.isNaN(deadline.getTime())) return;
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) { node.textContent = "Carga cerrada"; return; }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  node.textContent = `Faltan ${days}d ${hours}h ${minutes}m`;
}

function predictionsAreVisible() {
  if (config.showPredictionsBeforeDeadline) return true;
  const deadline = new Date(config.deadlineIso || "");
  if (Number.isNaN(deadline.getTime())) return false;
  return Date.now() >= deadline.getTime();
}

function setupStaticText() {
  $("#app-title").textContent = config.title || "Prode Mundial 2026";
  $("#app-subtitle").textContent = config.subtitle || "Fixture, predicciones públicas y ranking";
  $("#organizer-name").textContent = config.organizerName || "Santi";
  const formLink = $("#form-link");
  formLink.href = isConfiguredUrl(config.predictionFormUrl) ? config.predictionFormUrl : "#cargar-prode";
  if (config.predictionFormUrl === "#cargar-prode") formLink.removeAttribute("target");
  if (!isConfiguredUrl(config.predictionFormUrl)) formLink.textContent = "Configurar link de carga";
  const whatsapp = $("#whatsapp-link");
  if (isConfiguredUrl(config.whatsappUrl)) { whatsapp.href = config.whatsappUrl; whatsapp.classList.remove("hidden"); }
  const scoring = config.scoring || {};
  const scoreExact = $("#score-exact");
  if (scoreExact) scoreExact.textContent = scoring.exactScore ?? 3;
  $("#score-outcome").textContent = scoring.outcome ?? 1;
  $("#score-miss").textContent = scoring.miss ?? 0;
  $("#score-champion").textContent = scoring.champion ?? 10;
  $("#score-runner-up").textContent = scoring.runnerUp ?? 6;
  $("#score-top-scorer").textContent = scoring.topScorer ?? 6;
  $("#score-revelation").textContent = scoring.revelation ?? 4;
  formatDeadline();
}

function activateView(view) {
  $$(".tab").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("is-active", section.id === `view-${view}`));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupTabs() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => activateView(tab.dataset.view)));
  const formLink = $("#form-link");
  if (formLink) {
    formLink.addEventListener("click", (event) => {
      if ((config.predictionFormUrl || "") === "#cargar-prode") {
        event.preventDefault();
        activateView("cargar");
      }
    });
  }
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
    return `<article class="match-card"><div class="match-meta"><span class="group-pill">Grupo ${match.grupo}</span><span>${formatDate(match.fecha)} · ${match.hora}</span></div><div class="match-teams"><span>${match.equipo_a}</span><span class="score-box">${realScore}</span><span class="team-b">${match.equipo_b}</span></div><p class="match-location">📍 ${match.ciudad}</p></article>`;
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
    const location = match.ciudad ? `<p class="match-location">📍 ${match.ciudad}</p>` : "";
    const hour = match.hora ? ` · ${match.hora}` : "";
    return `<article class="match-card"><div class="match-meta"><span class="group-pill knockout-pill">${match.fase}</span><span>${match.fecha}${hour}</span></div><div class="match-teams"><span>${match.equipo_a}</span><span class="score-box">${realScore}</span><span class="team-b">${match.equipo_b}</span></div>${location}<p class="match-location match-code">Código: ${match.id}</p></article>`;
  }).join("");
  $("#knockout-empty").classList.toggle("hidden", filtered.length > 0);
}

function renderRanking() {
  const body = $("#ranking-body"), empty = $("#ranking-empty");
  const sorted = [...ranking].sort((a, b) => Number(b.total) - Number(a.total) || a.participante.localeCompare(b.participante));
  body.innerHTML = sorted.map((row, index) => `<tr><td class="rank-pos">${index + 1}</td><td>${row.participante}</td><td>${row.puntos_partidos || 0}</td><td>${row.puntos_extras || 0}</td><td><strong>${row.total || 0}</strong></td></tr>`).join("");
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
    return `<tr><td>${escapeHtml(prediction.participante)}</td><td>Grupo ${escapeHtml(match.grupo || "-")}</td><td>${escapeHtml(match.equipo_a || prediction.id_partido)} vs ${escapeHtml(match.equipo_b || "")}</td><td class="pred-score">${escapeHtml(formatPredictionValue(prediction, match))}</td><td class="pred-score">${result}</td><td>${points === "" ? "-" : points}</td></tr>`;
  }).join("");
  empty.textContent = "Todavía no hay predicciones públicas configuradas.";
  empty.classList.toggle("hidden", rows.length > 0);
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
  if (!form) return { ...predictionDraft };
  const data = new FormData(form);
  partidos.forEach((match) => {
    const value = data.get(`draft_${match.id}`);
    if (value) predictionDraft[match.id] = value;
  });
  return { ...predictionDraft };
}

function updatePredictionProgress() {
  const node = $("#prediction-progress");
  if (!node) return;
  const values = getSelectedPredictionValues();
  const selected = Object.keys(values).length;
  node.textContent = `${selected} de ${partidos.length} partidos seleccionados`;
}

function addPredictionHiddenFields(form) {
  form.querySelectorAll(".prediction-hidden-input").forEach((input) => input.remove());
  partidos.forEach((match) => {
    const value = predictionDraft[match.id];
    if (!value) return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = `pred_${match.id}`;
    input.value = value;
    input.className = "prediction-hidden-input";
    form.appendChild(input);
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
    const value = selected[match.id];
    if (!value) return;
    const input = list.querySelector(`input[name="draft_${match.id}"][value="${value}"]`);
    if (input) input.checked = true;
  });

  updatePredictionProgress();
}

function renderPredictionMatch(match) {
  const name = `draft_${match.id}`;
  return `<article class="prediction-match-card">
    <div class="prediction-match-meta"><span>${escapeHtml(formatDate(match.fecha))} · ${escapeHtml(match.hora)}</span><span>${escapeHtml(match.ciudad)}</span></div>
    <div class="prediction-match-title"><strong>${escapeHtml(match.equipo_a)}</strong><span>vs</span><strong>${escapeHtml(match.equipo_b)}</strong></div>
    <div class="outcome-options" role="radiogroup" aria-label="Predicción para ${escapeHtml(match.equipo_a)} vs ${escapeHtml(match.equipo_b)}">
      <label><input type="radio" name="${name}" value="A" /><span>Gana ${escapeHtml(match.equipo_a)}</span></label>
      <label><input type="radio" name="${name}" value="E" /><span>Empate</span></label>
      <label><input type="radio" name="${name}" value="B" /><span>Gana ${escapeHtml(match.equipo_b)}</span></label>
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
    if (target && target.name && target.name.startsWith("draft_")) {
      predictionDraft[target.name.replace(/^draft_/, "")] = target.value;
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
    if (Object.keys(predictionDraft).length !== partidos.length) {
      event.preventDefault();
      const missing = partidos.length - Object.keys(predictionDraft).length;
      status.textContent = `Faltan ${missing} partidos por seleccionar.`;
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

function renderAll() { renderSelects(); renderStats(); renderPredictionForm(); renderFixture(); renderKnockout(); renderRanking(); renderPredictions(); }

document.addEventListener("DOMContentLoaded", () => {
  setupStaticText(); setupTabs(); setupFilters(); setupPredictionSubmit(); loadData(); setInterval(updateCountdown, 60000);
});
