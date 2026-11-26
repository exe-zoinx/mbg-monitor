// Basemap definitions. All keyless: Esri ArcGIS Online raster tiles are public
// (no API key, no token) and OpenStreetMap standard tiles are keyless too.
// CARTO basemaps were dropped — they now serve an "API key required" placeholder
// tile to unkeyed clients.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const BASEMAPS = {
  dark: {
    label: 'Gelap',
    base: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: '&copy; <a href="https://www.esri.com" style="color:#8b949e">Esri</a>, HERE, Garmin, OpenStreetMap contributors',
    maxZoom: 16,
  },
  light: {
    label: 'Terang',
    base: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: '&copy; <a href="https://www.esri.com" style="color:#8b949e">Esri</a>, HERE, Garmin, OpenStreetMap contributors',
    maxZoom: 16,
  },
  sat: {
    label: 'Satelit',
    base: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Imagery &copy; <a href="https://www.esri.com" style="color:#8b949e">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 17,
  },
};

// Last-resort fallback if Esri is unreachable (e.g. blocked network).
export const FALLBACK_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const BASEMAP_IDS = Object.keys(BASEMAPS);
