# CityFinder

A browser game: each round names a city (all national capitals plus the largest cities with 2M+ inhabitants, at most 5 per country) and you click where you think it is on a blank political world map. Points depend on how far off you are.

## Play locally

Open `index.html` in a browser by double-clicking it. That's all: everything is bundled, with no build step, no server and no internet connection needed.

## Gameplay

- **Pools:** Capitals (200) · Large cities ≥ 2M (134, including big capitals) · Mixed (279). At most 5 cities per country; capitals are always included.
- **Rounds:** 5 / 10 / 15 / 20, and **timer:** 15 s / 30 s / 60 s / none. When time runs out, the current pin is submitted, or the round scores 0 if there is none.
- **Hint:** optionally show the country next to the city name.
- **Controls:** mouse wheel or pinch to zoom, drag to pan, click to place or move the pin. **Double-click** to place the pin and answer in one step, or press Enter to confirm. While the result is shown, click anywhere on the map (or press Enter) for the next city.
- Settings live in the **Options** submenu; the start screen only shows Play.
- **Languages:** English and German (UI, city and country names, number formatting). The game starts in the browser's language and can be switched in Options; an explicit choice is saved together with the other settings.
- **Best scores** are kept per settings combination in `localStorage`.

### Scoring (`js/scoring.js`)

| Distance | Points |
|---|---|
| ≤ 20 km | 1000 |
| 100 km | 849 |
| 250 km | 624 |
| 500 km | 371 |
| 1000 km | 124 |
| ≥ 2000 km | 0 |

It is an exponential decay rescaled to reach exactly 0 at the 2000 km cutoff.

**Time penalty:** answers given within the first 2 seconds keep their full points. After that, the round's points shrink linearly, down to 50% at the time limit. With "No limit", they reach 50% at 60 s.

You can tune all of this with `RULES` in `js/scoring.js`.

## Hosting on a server

The game is purely static. Copy these items to any web server's document root:

```
index.html  css/  js/  data/  vendor/
```

For example, with nginx you only need a `root /var/www/cityfinder;` server block. To test over HTTP locally, run `python -m http.server` in this folder.

## Project layout

```
index.html            markup for the map, HUD, setup and summary screens
css/style.css         styling
js/i18n.js            UI translations (en, de) and language detection
js/scoring.js         distance (haversine) and points formula
js/app.js             map rendering (D3), zoom, game loop, UI
data/cities.js        generated city list
data/world.js         generated country outlines (TopoJSON, 1:50m)
vendor/               d3 7.9.0, topojson-client 3.1.0
tools/build-data.mjs  regenerates data/ from the sources below
```

### Regenerating the data

```
node tools/build-data.mjs ne_10m_populated_places.geojson countries-50m.json
```

Sources (public domain):
- Natural Earth populated places: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_populated_places.geojson (full version; provides the German `NAME_DE`)
- world-atlas: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json

The script's `LARGE_CITY_MIN_POP` controls which non-capital cities are included, and `MAX_PER_COUNTRY` sets the per-country limit. German country names come from `Intl.DisplayNames`, with a few manual overrides in the script.

To add another language, add a block to `STRINGS` in `js/i18n.js`, add a button in the Language option in `index.html`, and add the localized city and country names in the build script.

## License

The game code is released under the [MIT License](LICENSE).

Bundled third-party components keep their own licenses:
- [D3](https://github.com/d3/d3) 7.9.0 (`vendor/d3.min.js`): ISC License
- [topojson-client](https://github.com/topojson/topojson-client) 3.1.0 (`vendor/topojson-client.min.js`): ISC License
- City and country data from [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas) (`data/`): public domain
