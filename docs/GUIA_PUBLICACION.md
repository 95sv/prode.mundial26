# Guía de publicación y conexión con Google Sheets

## 1. Crear el Google Sheet

1. Creá una hoja nueva en Google Sheets.
2. Importá los CSV de la carpeta `google-sheets/` o copiá sus encabezados.
3. Dejá estas pestañas con estos nombres exactos:
   - `Partidos_Publicos`
   - `Predicciones_Publicas`
   - `Ranking`
   - `Extras_Publicos`
   - `Participantes`

La web funciona con `Partidos_Publicos` y `Predicciones_Publicas`. `Ranking` es opcional porque la página puede calcularlo sola.

## 2. Carga de predicciones

### Opción recomendada: Google Form

Armá un Google Form con:

- nombre/apodo del participante;
- WhatsApp opcional;
- una pregunta por partido, por ejemplo: `GA01 - México vs Sudáfrica`;
- formato recomendado de respuesta: `2-1`.

Luego vinculá el Form con Google Sheets. Después podés transformar esas respuestas en la pestaña `Predicciones_Publicas`.

### Opción alternativa: carga directa en Google Sheet

Podés compartir una pestaña editable, pero no es lo ideal porque los participantes podrían borrar datos de otros. Si usás esta alternativa, protegé rangos y pedí que cada participante complete solo su bloque.

## 3. Publicar las pestañas como CSV

En Google Sheets:

1. `Archivo` → `Compartir` → `Publicar en la Web`.
2. Elegí la pestaña, por ejemplo `Predicciones_Publicas`.
3. Elegí formato `Valores separados por comas (.csv)` si aparece la opción.
4. Copiá el link publicado.

El link que necesita la web suele tener esta forma:

```txt
https://docs.google.com/spreadsheets/d/e/ID_PUBLICADO/pub?gid=GID_DE_LA_PESTAÑA&single=true&output=csv
```

Pegalo en `config.js`.

## 4. Configurar la web

Abrí `config.js` y completá:

```js
predictionFormUrl: "https://forms.gle/tu-form",
sheets: {
  partidosCsvUrl: "URL_CSV_PARTIDOS",
  prediccionesCsvUrl: "URL_CSV_PREDICCIONES",
  rankingCsvUrl: "",
  extrasCsvUrl: ""
}
```

También ajustá:

```js
deadlineIso: "2026-06-11T11:30:00-03:00"
```

## 5. Publicar en GitHub Pages

1. Creá un repositorio nuevo en GitHub, por ejemplo `prode-mundial-2026`.
2. Subí todos los archivos de esta carpeta.
3. Entrá al repositorio → `Settings` → `Pages`.
4. En `Build and deployment`, elegí:
   - Source: `Deploy from a branch`.
   - Branch: `main`.
   - Folder: `/root`.
5. Guardá.
6. Tu página va a quedar en una URL del estilo:

```txt
https://TU-USUARIO.github.io/prode-mundial-2026/
```

## 6. Publicar en Vercel

1. Entrá a Vercel.
2. Importá el repositorio desde GitHub.
3. Framework preset: `Other`.
4. Build command: dejar vacío.
5. Output directory: dejar vacío o `.`.
6. Deploy.

## 7. Mensaje para WhatsApp

```txt
🏆 Prode Mundial 2026

Ya está abierta la carga de predicciones.
Entrá acá para participar:
LINK_DE_TU_WEB

Fecha límite: 11/06/2026 11:30 hs.
Después del cierre se publican las predicciones de todos y el ranking.
```
