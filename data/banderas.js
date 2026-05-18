// Mapeo de nombres de selecciones (tal como aparecen en el fixture) a banderas emoji.
// Si una bandera no renderiza en algun sistema operativo, el código del país queda como fallback visual.
window.PRODE_BANDERAS = {
  // CONMEBOL
  "Argentina": "🇦🇷",
  "Brasil": "🇧🇷",
  "Colombia": "🇨🇴",
  "Ecuador": "🇪🇨",
  "Paraguay": "🇵🇾",
  "Uruguay": "🇺🇾",

  // CONCACAF (incluye anfitriones)
  "Canadá": "🇨🇦",
  "Curazao": "🇨🇼",
  "Estados Unidos": "🇺🇸",
  "Haití": "🇭🇹",
  "México": "🇲🇽",
  "Panamá": "🇵🇦",

  // UEFA
  "Alemania": "🇩🇪",
  "Austria": "🇦🇹",
  "Bélgica": "🇧🇪",
  "Bosnia-Herz.": "🇧🇦",
  "Croacia": "🇭🇷",
  "Escocia": "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "España": "🇪🇸",
  "Francia": "🇫🇷",
  "Inglaterra": "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "Italia": "🇮🇹",
  "Noruega": "🇳🇴",
  "Países Bajos": "🇳🇱",
  "Portugal": "🇵🇹",
  "R. Checa": "🇨🇿",
  "Suecia": "🇸🇪",
  "Suiza": "🇨🇭",
  "Turquía": "🇹🇷",

  // AFC
  "Arabia Saudita": "🇸🇦",
  "Australia": "🇦🇺",
  "Catar": "🇶🇦",
  "Irak": "🇮🇶",
  "Japón": "🇯🇵",
  "Jordania": "🇯🇴",
  "Nueva Zelanda": "🇳🇿",
  "Rep. de Corea": "🇰🇷",
  "RI de Irán": "🇮🇷",
  "Uzbekistán": "🇺🇿",

  // CAF
  "Argelia": "🇩🇿",
  "Cabo Verde": "🇨🇻",
  "Congo": "🇨🇩",
  "Costa de Marfil": "🇨🇮",
  "Egipto": "🇪🇬",
  "Ghana": "🇬🇭",
  "Marruecos": "🇲🇦",
  "Senegal": "🇸🇳",
  "Sudáfrica": "🇿🇦",
  "Túnez": "🇹🇳"
};

// Alias por si los CSV o Apps Script devuelven el nombre con otra ortografía.
window.PRODE_BANDERAS_ALIAS = {
  "EE.UU.": "Estados Unidos",
  "EEUU": "Estados Unidos",
  "USA": "Estados Unidos",
  "Mexico": "México",
  "Canada": "Canadá",
  "Corea del Sur": "Rep. de Corea",
  "Corea": "Rep. de Corea",
  "Irán": "RI de Irán",
  "Iran": "RI de Irán",
  "Qatar": "Catar",
  "República Checa": "R. Checa",
  "Chequia": "R. Checa",
  "Bosnia y Herzegovina": "Bosnia-Herz.",
  "Bosnia": "Bosnia-Herz.",
  "Curaçao": "Curazao",
  "Haiti": "Haití",
  "Sud Africa": "Sudáfrica",
  "Sudafrica": "Sudáfrica",
  "Tunez": "Túnez",
  "Turquia": "Turquía",
  "Uzbekistan": "Uzbekistán",
  "Holanda": "Países Bajos",
  "Republica de Corea": "Rep. de Corea",
  "Republica Checa": "R. Checa",
  "Costa Marfil": "Costa de Marfil"
};