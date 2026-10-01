// Shared map for Shop and Art. Leaflet is loaded only the first time a map is
// needed. Pins come from lat/lng in the data, never from runtime geocoding.
import { h, reducedMotion } from './dom.js';
import { directionsUrl, hasCoords } from './format.js';

const ASSETS = '/assets/fam/';
const TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const DEFAULT_VIEW = { center: [40.7231, -73.9969], zoom: 13 };

let leaflet = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leaflet) {
    leaflet = new Promise((resolve, reject) => {
      document.head.append(h('link', { rel: 'stylesheet', href: `${ASSETS}leaflet.css` }));
      const script = h('script', { src: `${ASSETS}leaflet.js` });
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        leaflet = null;
        reject(new Error('Leaflet failed to load'));
      };
      document.head.append(script);
    });
  }
  return leaflet;
}

// places: [{ id, name, address, placeId, lat, lng, pin, sub }]
// onSelect(id) runs when someone taps a pin.
export async function createMap(el, { label, places, onSelect, wheelZoom = false }) {
  const L = await loadLeaflet();
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
  L.tileLayer(TILES, { subdomains: 'abcd', maxZoom: 20, attribution: ATTRIBUTION }).addTo(map);

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
