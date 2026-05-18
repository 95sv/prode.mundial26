# Prode Mundial 2026

Sitio estático listo para publicar en GitHub Pages, Vercel o cualquier hosting gratuito de HTML/CSS/JS.

La web muestra:

- portada del prode;
- carga de predicciones dentro de la página;
- fixture completo de fase de grupos;
- eliminatorias;
- ranking general;
- predicciones públicas;
- reglas de puntaje.

## Modalidad de carga

El participante ya no usa una plantilla de Google Sheets. Entra a la página, toca **Completar mi predicción** y elige para cada partido:

- gana el primer equipo;
- empate;
- gana el segundo equipo.

No se cargan goles.

## Estructura

```txt
prode-mundial-2026/
├── index.html
├── styles.css
├── app.js
├── config.js
├── apps-script/
│   └── Code.gs
├── data/
│   ├── fixture.js
│   └── eliminatorias.js
├── google-sheets/
│   ├── Partidos_Publicos.csv
│   ├── Predicciones_Publicas.csv
│   ├── Predicciones_Recibidas.csv
│   ├── Ranking.csv
│   ├── Extras_Publicos.csv
│   └── Eliminatorias_Publicas.csv
└── docs/
    ├── GUIA_PUBLICACION.md
    └── APPS_SCRIPT_CARGA_WEB.md
```

## Edición rápida

Abrí `config.js` y reemplazá esta línea:

```js
const PRODE_API_URL = "https://script.google.com/macros/s/PEGAR_ID_DE_TU_DEPLOY/exec";
```

por la URL real del despliegue `/exec` de Google Apps Script.

La configuración principal queda así:

```js
predictionFormUrl: "#cargar-prode",
submitPredictionUrl: PRODE_API_URL,
```

Y los datos públicos se leen desde Apps Script:

```js
sheets: {
  partidosCsvUrl: `${PRODE_API_URL}?view=partidos`,
  prediccionesCsvUrl: `${PRODE_API_URL}?view=predicciones`,
  rankingCsvUrl: `${PRODE_API_URL}?view=ranking`,
  extrasCsvUrl: `${PRODE_API_URL}?view=extras`,
  eliminatoriasCsvUrl: `${PRODE_API_URL}?view=eliminatorias`
}
```

## Apps Script

Usá el archivo:

```text
apps-script/Code.gs
```

Guía paso a paso:

```text
docs/APPS_SCRIPT_CARGA_WEB.md
```

Configuración recomendada del deploy:

```text
Execute as: Me
Who has access: Anyone
```

## Columnas esperadas

### Partidos_Publicos

```csv
id,fase,grupo,fecha_num,fecha,fecha_texto,hora,equipo_a,equipo_b,ciudad,goles_a_real,goles_b_real
```

### Predicciones_Publicas

```csv
participante,id_partido,prediccion
```

Valores posibles de `prediccion`:

```text
A = gana equipo_a
E = empate
B = gana equipo_b
```

### Predicciones_Recibidas

```csv
timestamp,participante,whatsapp,id_partido,prediccion,version
```

Esta hoja es de auditoría interna.

### Ranking opcional

```csv
participante,puntos_partidos,puntos_extras,total
```

Si la hoja `Ranking` está vacía, la web calcula el ranking automáticamente con `Predicciones_Publicas` + resultados reales de `Partidos_Publicos`.

## Puntaje por defecto

- Acierta ganador, perdedor o empate: 1 punto.
- No acierta: 0 puntos.

Podés cambiarlo en `config.js`.

## Privacidad recomendada

- El Google Sheet maestro debe permanecer privado.
- Los participantes no acceden al Sheet.
- La página recibe y muestra solo los datos públicos que entrega Apps Script.
- Antes de la fecha límite, Apps Script puede ocultar predicciones y ranking si `SHOW_PREDICTIONS_BEFORE_DEADLINE` está en `false`.

## Eliminatorias

La página incluye una pestaña **Eliminatorias**. Por defecto usa `data/eliminatorias.js` con placeholders para:

- Dieciseisavos de final;
- Octavos de final;
- Cuartos de final;
- Semifinales;
- Tercer puesto;
- Final.

También podés manejar los cruces desde Google Sheets usando `Eliminatorias_Publicas` y el endpoint:

```js
`${PRODE_API_URL}?view=eliminatorias`
```
