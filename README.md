# AniAgenda 2 📺

App web para seguir tu temporada de anime: lo que estás viendo, lo que ya viste, tus favoritos y tus listas propias, más un calendario semanal con alertas. Los datos vienen de la API pública de [AniList](https://anilist.co), así que no necesitas cuenta ni clave.

Son archivos estáticos (HTML, CSS y JS), sin instalar nada ni compilar. Funcionan en cualquier hosting estático, incluso en una subcarpeta como `https://usuario.github.io/aniagenda/`.

## Navegación (5 secciones)

| Sección | Qué hay |
|---|---|
| **Inicio** | Tu lista **Viendo esta temporada** (temporada actual, por ejemplo Otoño 2026), el botón **¿Qué veo hoy?**, el aviso “Hoy sale…” y el catálogo de la temporada ordenado por popularidad, con filtros por tipo. |
| **Mis listas** | Pestañas **Viendo**, **Pendientes**, **Vistos** (tu historial con fecha de término), **Favoritos** y tus **listas personalizadas**. Incluye buscador dentro de tus listas, filtros por tipo y por tus etiquetas, y orden. |
| **Calendario** | Semana de lunes a domingo con la hora local de cada episodio. El día de hoy aparece resaltado. Puedes ver solo tus animes o **todos los que están en emisión**. |
| **Buscar** | Todo el catálogo de AniList, con filtros por tipo. |
| **Perfil** | **Estadísticas** y **Alertas y ajustes** (notificaciones, instalar la app, respaldo). |

## Funciones

- **Temporada → Vistos automático**: cuando llegas al último episodio o tocas **Terminado**, el anime pasa a **Vistos** con la fecha de hoy. Sale una celebración 🎉 y te pide que lo puntúes.
- **Favoritos** 💖: toca el corazón en cualquier anime (tarjeta, póster o ficha).
- **Clasificación por tipo**, en español:
  - Demografía: Shounen, Shoujo, Seinen, Josei, Infantil.
  - Géneros: Acción, Aventura, Comedia, Romance, *Comedia romántica* (cuando tiene Comedia y Romance), Fantasía, Isekai, Recuentos de la vida, Deportes, Misterio, Terror, Suspenso, Mecha, Música, Sci-fi, Sobrenatural, Drama, Psicológico, Mahou shoujo, Escolar, Histórico y Ecchi.
  - Puedes agregar **etiquetas propias** (por ejemplo `#maratón`) y filtrar por ellas.
- **Puntuación del 1 al 10** con un solo toque. Se ve en cada tarjeta.
- **Notas y comentarios** por anime: notas generales o ligadas a un episodio (“Ep 5: me encantó la pelea”). Llevan fecha y hora, y puedes editarlas o eliminarlas (con *Deshacer*).
- **Listas personalizadas**: puedes crearlas, renombrarlas y eliminarlas (con *Deshacer*). Cada una tiene nombre, emoji y color, y un anime puede estar en varias.
- **Extras**:
  - **¿Qué veo hoy?** te sugiere al azar algo de tus Pendientes.
  - **Volver a ver** lleva la cuenta de cuántas veces has visto un anime.
  - Fechas de inicio y fin que puedes editar.
  - **Estadísticas**: anime vistos, episodios, horas estimadas, puntuación promedio, género y demografía favoritos, y gráficas por género, puntuación y estado.
- **Contador +1 ep**, cuenta regresiva al próximo episodio, alertas y exportar/importar respaldo.

Lo más avanzado (notas, etiquetas, listas, fechas) está en la **ficha de cada anime**, en secciones que se abren y cierran. Así la pantalla principal no se satura.

## Tus datos y la actualización desde la versión 1

- Todo se guarda en tu navegador (`localStorage`), con el esquema versionado (`aniagenda.v2`, `version: 2`).
- Al abrir la v2 por primera vez, tus datos de la v1 (`aniagenda.v1`) **se migran solos**. Se conservan tu lista, estados, episodios y puntuaciones. Los terminados pasan a Vistos con fecha aproximada (marcada con *), que puedes corregir. La clave v1 se queda como respaldo.
- **Perfil → Alertas y ajustes → Exportar / Importar**. Importar acepta respaldos v1 y v2, y los fusiona sin borrar tus notas, listas ni favoritos.

## Cómo abrirla en tu computadora

```bash
cd anime-app
python3 -m http.server 8090
```

Después abre <http://localhost:8090>. Si haces doble clic en `index.html` (`file://`), el service worker y las notificaciones no van a funcionar.

## Cómo instalarla en tu teléfono

Para instalarla, la app tiene que estar publicada con **HTTPS**. Puedes usar:

1. **Netlify Drop**: entra a <https://app.netlify.com/drop> y arrastra la carpeta `anime-app`.
2. **GitHub Pages**: sube el contenido de la carpeta a un repositorio (por ejemplo `aniagenda`) y activa *Settings → Pages*. Todas las rutas son relativas (`./`), así que funciona en `https://usuario.github.io/aniagenda/`.

Luego abre el enlace en el teléfono:

- **Android (Chrome)**: en *Perfil → Alertas y ajustes* toca **Instalar app**, o abre el menú ⋮ y elige **Instalar app**.
- **iPhone (Safari)**: toca **Compartir** y luego **Agregar a inicio**. Para recibir notificaciones en iOS se necesita iOS 16.4 o más reciente y que la app esté agregada al inicio.

## Límites de las alertas (importante)

- Las alertas **solo llegan mientras la app está abierta** (en una pestaña o instalada y sin que el sistema la haya cerrado). Revisa cada 30 segundos.
- Si cierras el navegador o el teléfono suspende la app, **no llegan**. Al volver verás el aviso “Hoy sale…”. Para recibirlas con la app cerrada haría falta un servidor de *push*, y esta versión no lo tiene.
- Los horarios son los de la emisión en Japón según AniList, convertidos a tu zona horaria (America/Mexico_City). Crunchyroll y otros servicios pueden publicar el episodio más tarde.

## Otros límites

- Los datos viven solo en ese navegador y dispositivo. Para pasarlos a otro, usa Exportar / Importar.
- Las **horas estimadas** se calculan con la duración por episodio de AniList (24 min si no la tiene).
- Cada temporada muestra hasta 100 animes (los más populares).
- AniList limita cuántas consultas se pueden hacer por minuto. La app espera y reintenta sola. Si aun así falla, toca **Reintentar**.

## Archivos

```
index.html      estructura y navegación (5 secciones)
styles.css      diseño (tema oscuro, móvil primero)
app.js          lógica: AniList, temporada, listas, notas, estadísticas, calendario, alertas, migración v1→v2
sw.js           service worker (caché aniagenda-v2, clic en notificaciones)
manifest.json   datos para instalar la PWA (start_url y scope "./")
icons/          íconos de la app
screenshots/    capturas de ejemplo (no van en el zip)
```
