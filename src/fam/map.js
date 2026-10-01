// Shared map for Shop and Art. The map libraries load only the first time a map
// is needed. Pins come from lat/lng in the data, never from runtime geocoding.
//
// Basemap: OpenFreeMap's Positron style (light gray vector tiles, no API key,
// no sign-up), drawn by MapLibre GL inside Leaflet. If the phone has no WebGL2
// or OpenFreeMap doesn't answer, it falls back to OpenStreetMap's raster tiles
// shown in grayscale (also keyless).
import { h, reducedMotion } from './dom.js';
import { directionsUrl, hasCoords } from './format.js';

const ASSETS = '/assets/fam/';
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_ATTRIBUTION =
  '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const RASTER = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const RASTER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const STYLE_TIMEOUT_MS = 12000;
const DEFAULT_VIEW = { center: [40.7231, -73.9969], zoom: 13 };

const loadCss = (href) => document.head.append(h('link', { rel: 'stylesheet', href }));
const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const script = h('script', { src });
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${src} failed to load`));
    document.head.append(script);
  });

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

// Resolves to { L, vector } where vector says whether MapLibre is available.
let libs = null;
export function loadMapLibs() {
  if (!libs) {
    libs = (async () => {
      const vector = hasWebGL2();
      loadCss(`${ASSETS}leaflet.css`);
      if (vector) loadCss(`${ASSETS}maplibre-gl.css`);
      const [, gl] = await Promise.all([
        loadScript(`${ASSETS}leaflet.js`),
        vector ? loadScript(`${ASSETS}maplibre-gl.js`).then(() => true, () => false) : false,
      ]);
      const bridged = gl && (await loadScript(`${ASSETS}leaflet-maplibre-gl.js`).then(() => true, () => false));
      return { L: window.L, vector: !!(bridged && window.L.maplibreGL) };
    })();
    libs.catch(() => (libs = null));
  }
  return libs;
}

function addBasemap(L, map, el, vector) {
  const raster = () => {
    el.classList.add('map--raster');
    L.tileLayer(RASTER, { maxZoom: 19, attribution: RASTER_ATTRIBUTION }).addTo(map);
  };
  if (!vector) return raster();

  let layer;
  try {
    layer = L.maplibreGL({ style: STYLE, attributionControl: { customAttribution: STYLE_ATTRIBUTION } }).addTo(map);
  } catch {
    return raster();
  }
  const gl = layer.getMaplibreMap();
  let settled = false;
  const fallBack = () => {
    if (settled) return;
    settled = true;
    map.removeLayer(layer);
    raster();
  };
  const timer = setTimeout(fallBack, STYLE_TIMEOUT_MS);
  // Once OpenFreeMap's style has arrived the service is up; errors after that
  // (a single missing tile) are not worth abandoning the vector map for.
  gl.once('style.load', () => {
    settled = true;
    clearTimeout(timer);
  });
  gl.on('error', () => {
    if (!settled) {
      clearTimeout(timer);
      fallBack();
    }
  });
}

// places: [{ id, name, address, placeId, lat, lng, pin, sub }]
// onSelect(id) runs when someone taps a pin.
export async function createMap(el, { label, places, onSelect, wheelZoom = false }) {
  const { L, vector } = await loadMapLibs();
  const still = reducedMotion();
  el.setAttribute('aria-label', label);
  const map = L.map(el, {
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    scrollWheelZoom: wheelZoom,
    zoomAnimation: !still,
    fadeAnimation: !still,
    markerZoomAnimation: !still,
  });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  addBasemap(L, map, el, vector);

  const markers = new Map();
  for (const p of places.filter(hasCoords)) {
    const icon = L.divIcon({
      className: 'pin-hit',
      html: `<span class="pin pin--${p.pin || 'solid'}"></span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -14],
    });
    const marker = L.marker([p.lat, p.lng], { icon, title: p.name, riseOnHover: true });
    const popup = h(
      'div',
      { class: 'popup' },
      h('p', { class: 'popup__name' }, p.name),
      p.sub && h('p', { class: 'popup__sub' }, p.sub),
      h(
        'a',
        { class: 'pill pill--small', href: directionsUrl(p), target: '_blank', rel: 'noopener', 'aria-label': `Directions to ${p.name}` },
        'Directions'
      )
    );
    marker.bindPopup(popup, { maxWidth: 260, autoPanPadding: [16, 16], className: 'fam-popup' });
    marker.on('click', () => onSelect?.(p.id));
    marker.on('add', () => marker.getElement()?.setAttribute('aria-label', `${p.name}, map pin`));
    markers.set(p.id, marker);
  }

  let visible = new Set(markers.keys());
  const fit = () => {
    const pts = [...visible].map((id) => markers.get(id).getLatLng());
    if (!pts.length) map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom, { animate: false });
    else if (pts.length === 1) map.setView(pts[0], 16, { animate: false });
    else map.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 16, animate: false });
  };

  const api = {
    has: (id) => markers.has(id),
    // Show only these ids and fit the map to them.
    show(ids) {
      visible = new Set([...ids].filter((id) => markers.has(id)));
      map.closePopup();
      for (const [id, m] of markers) {
        if (visible.has(id)) m.addTo(map);
        else m.remove();
      }
      fit();
    },
    focus(id) {
      const m = markers.get(id);
      if (!m || !visible.has(id)) return;
      const target = m.getLatLng();
      const zoom = Math.max(map.getZoom(), 16);
      // Open the popup once the pan settles so its auto-pan sees the final view.
      if (map.getZoom() === zoom && map.getCenter().distanceTo(target) < 1) return m.openPopup();
      map.once('moveend', () => m.openPopup());
      map.setView(target, zoom, { animate: !still });
    },
    resize() {
      map.invalidateSize();
      fit();
    },
  };
  api.show(visible);
  return api;
}
