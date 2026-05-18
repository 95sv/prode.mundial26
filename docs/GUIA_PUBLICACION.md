# Guía rápida de publicación

Esta versión del prode se publica como sitio estático y usa Google Apps Script para guardar predicciones en un Google Sheet maestro privado.

## 1. Publicar en GitHub Pages

1. Subí los archivos del proyecto al repositorio.
2. Entrá a `Settings → Pages`.
3. Elegí:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

4. Guardá y esperá el deploy.

La URL queda parecida a:

```text
https://TU-USUARIO.github.io/TU-REPO/
```

## 2. Preparar Google Sheet maestro

Tu Sheet maestro debe tener al menos la hoja:

```text
Partidos_Publicos
```

Con columnas:

```csv
id,fase,grupo,fecha_num,fecha,fecha_texto,hora,equipo_a,equipo_b,ciudad,goles_a_real,goles_b_real
```

El script puede crear automáticamente:

```text
Predicciones_Recibidas
Predicciones_Publicas
```

## 3. Configurar Apps Script

1. Abrí tu Google Sheet maestro.
2. Andá a `Extensiones → Apps Script`.
3. Pegá el contenido de:

```text
apps-script/Code.gs
```

4. Cambiá:

```js
const SPREADSHEET_ID = "PEGAR_ID_DEL_GOOGLE_SHEET_MAESTRO";
```

por el ID real del Sheet.

5. Desplegá como Web App:

```text
Deploy → New deployment → Web app
Execute as: Me
Who has access: Anyone
```

6. Copiá la URL `/exec`.

## 4. Configurar la web

En `config.js`, reemplazá:

```js
const PRODE_API_URL = "https://script.google.com/macros/s/PEGAR_ID_DE_TU_DEPLOY/exec";
```

por la URL real del Apps Script.

## 5. Subir cambios

Desde la terminal en la carpeta del repo:

```bash
git add .
git commit -m "Agregar carga de predicciones desde la web"
git push
```

## 6. Probar

1. Entrá a la web publicada.
2. Tocá `Completar mi predicción`.
3. Completá nombre y todos los partidos.
4. Enviá.
5. Revisá en el Google Sheet maestro si se completaron:

```text
Predicciones_Recibidas
Predicciones_Publicas
```

## Seguridad práctica

- No compartas el Google Sheet maestro con participantes.
- No pongas links sensibles directos en `config.js`.
- Usá Apps Script como intermediario.
- Antes del cierre, no muestres predicciones públicas.
- El ranking se puede calcular desde la web o desde una hoja `Ranking`.
