# Prode Mundial 2026

Sitio estático listo para publicar en GitHub Pages, Vercel o cualquier hosting gratuito de HTML/CSS/JS.

La web muestra:

- portada del prode;
- fixture completo de fase de grupos;
- ranking general;
- predicciones públicas;
- reglas de puntaje;
- botón para cargar predicción en Google Form o Google Sheet.

## Estructura

```txt
prode-mundial-2026/
├── index.html
├── styles.css
├── app.js
├── config.js
├── data/
│   └── fixture.js
├── google-sheets/
│   ├── Partidos_Publicos.csv
│   ├── Predicciones_Publicas.csv
│   ├── Ranking.csv
│   ├── Extras_Publicos.csv
│   ├── Participantes.csv
│   └── Respuestas_Form_Estructura.csv
└── docs/
    └── GUIA_PUBLICACION.md
```

## Edición rápida

Abrí `config.js` y cambiá:

```js
predictionFormUrl: "https://forms.gle/TU-LINK",
```

Cuando tengas publicadas las pestañas públicas de Google Sheets, pegá las URLs CSV:

```js
sheets: {
  partidosCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=0&single=true&output=csv",
  prediccionesCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=123&single=true&output=csv",
  rankingCsvUrl: "",
  extrasCsvUrl: ""
}
```

Si dejás `rankingCsvUrl` vacío, la web calcula el ranking automáticamente con `Predicciones_Publicas` + resultados reales de `Partidos_Publicos`.

## Columnas esperadas

### Partidos_Publicos

```csv
id,fase,grupo,fecha_num,fecha,fecha_texto,hora,equipo_a,equipo_b,ciudad,goles_a_real,goles_b_real
```

### Predicciones_Publicas

```csv
participante,id_partido,pred_a,pred_b
```

### Ranking opcional

```csv
participante,puntos_partidos,puntos_extras,total
```

## Puntaje por defecto

- Resultado exacto: 3 puntos.
- Acierta ganador o empate: 1 punto.
- No acierta: 0 puntos.

Podés cambiarlo en `config.js`.

## Privacidad recomendada

No publiques teléfonos, mails ni la hoja cruda de respuestas. Publicá solamente hojas limpias como:

- `Partidos_Publicos`
- `Predicciones_Publicas`
- `Ranking`
- `Extras_Publicos`
