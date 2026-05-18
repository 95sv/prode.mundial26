# Carga de predicciones desde la página

Esta versión ya no manda al participante a una plantilla de Google Sheets. La página muestra un formulario propio y envía las predicciones a Google Apps Script.

## Flujo

```text
Participante
↓
Página web del prode
↓
Formulario interno: gana A / empate / gana B
↓
Apps Script
↓
Google Sheet maestro privado
```

## 1. Crear o preparar el Google Sheet maestro

El Google Sheet maestro debe tener, como mínimo, esta hoja:

- `Partidos_Publicos`

Columnas mínimas esperadas:

```csv
id,fase,grupo,fecha,hora,equipo_a,equipo_b,ciudad,goles_a_real,goles_b_real
```

El script crea automáticamente estas hojas si no existen:

- `Predicciones_Recibidas`
- `Predicciones_Publicas`

`Predicciones_Recibidas` guarda el historial completo de envíos.

`Predicciones_Publicas` se reconstruye automáticamente tomando la última predicción de cada participante para cada partido.

## 2. Configurar Apps Script

1. Abrí el Google Sheet maestro.
2. Andá a `Extensiones → Apps Script`.
3. Pegá el contenido de `apps-script/Code.gs`.
4. Cambiá esta línea:

```js
const SPREADSHEET_ID = "PEGAR_ID_DEL_GOOGLE_SHEET_MAESTRO";
```

Por el ID real del Google Sheet maestro.

5. Revisá la fecha de cierre:

```js
const DEADLINE_ISO = "2026-06-11T11:30:00-03:00";
```

6. Guardá.

## 3. Desplegar Apps Script como Web App

En Apps Script:

```text
Deploy → New deployment → Web app
```

Configuración recomendada:

```text
Execute as: Me
Who has access: Anyone
```

Copiá la URL que termina en `/exec`.

## 4. Configurar `config.js`

En la web, abrí `config.js` y reemplazá:

```js
const PRODE_API_URL = "https://script.google.com/macros/s/PEGAR_ID_DE_TU_DEPLOY/exec";
```

por la URL real de Apps Script.

La carga queda dentro de la web:

```js
predictionFormUrl: "#cargar-prode",
submitPredictionUrl: PRODE_API_URL,
```

Y los datos públicos se leen desde el mismo Apps Script:

```js
sheets: {
  partidosCsvUrl: `${PRODE_API_URL}?view=partidos`,
  prediccionesCsvUrl: `${PRODE_API_URL}?view=predicciones`,
  rankingCsvUrl: `${PRODE_API_URL}?view=ranking`,
  extrasCsvUrl: `${PRODE_API_URL}?view=extras`,
  eliminatoriasCsvUrl: `${PRODE_API_URL}?view=eliminatorias`
}
```

## 5. Probar

1. Subí la web a GitHub.
2. Entrá a la página.
3. Tocá `Completar mi predicción`.
4. Completá nombre y todos los partidos.
5. Enviá.
6. En tu Google Sheet deberían aparecer filas en `Predicciones_Recibidas` y `Predicciones_Publicas`.

## Notas de seguridad

- El Google Sheet maestro debe permanecer privado.
- Los participantes no acceden al Sheet.
- Los participantes no pueden editar fixture, fechas, equipos ni fórmulas.
- Antes de la fecha límite, Apps Script no devuelve predicciones públicas si `SHOW_PREDICTIONS_BEFORE_DEADLINE` está en `false`.
- Cualquier dato que la web muestre o entregue por Apps Script debe considerarse público.
