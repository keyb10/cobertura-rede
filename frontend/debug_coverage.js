import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import * as turf from '@turf/turf';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const kmzPath = path.join(__dirname, 'public/maps/Cobertura MAncha IHS SP.kmz');

// --- LOGIC FROM App.jsx ---

const to2D = (coords) => {
      if (Array.isArray(coords) && typeof coords[0] === 'number') {
            return coords.slice(0, 2);
      }
      if (Array.isArray(coords)) {
            return coords.map(to2D);
      }
      return coords;
};

const normalizeFeatures = (features) => {
      const flat = [];

      const processGeometry = (geometry, properties) => {
            if (!geometry) return;

            if (geometry.type === 'GeometryCollection') {
                  if (geometry.geometries) {
                        geometry.geometries.forEach(g => processGeometry(g, properties));
                  }
            } else {
                  const newGeometry = { ...geometry };
                  if (newGeometry.coordinates) {
                        newGeometry.coordinates = to2D(newGeometry.coordinates);
                  }

                  flat.push({
                        type: 'Feature',
                        properties: properties,
                        geometry: newGeometry
                  });
            }
      };

      features.forEach(f => {
            if (f.geometry) {
                  processGeometry(f.geometry, f.properties);
            }
      });

      return flat;
};

// --- END LOGIC ---

async function debug() {
      try {
            console.log("Loading KMZ...");
            const data = fs.readFileSync(kmzPath);
            const zip = await JSZip.loadAsync(data);
            const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
            const kmlText = await zip.file(kmlFile).async('string');
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, 'text/xml');
            const geoJson = kml(kmlDom);
            console.log(`Raw features: ${geoJson.features.length}`);

            const normalized = normalizeFeatures(geoJson.features);
            console.log(`Normalized features: ${normalized.length}`);

            // Test Specific Address: Hospital Francisco Morato
            console.log("Geocoding 'Hospital Francisco Morato'...");
            const address = "Hospital Francisco Morato";
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data_nominatim = await response.json();

            if (!data_nominatim || data_nominatim.length === 0) {
                  console.error("Address not found via API");
                  return;
            }

            const lat = parseFloat(data_nominatim[0].lat);
            const lon = parseFloat(data_nominatim[0].lon);
            console.log(`Geocoded to: ${lat}, ${lon}`);
            const point = turf.point([lon, lat]);

            // Check against ALL polygons
            let isCovered = false;

            for (const feature of normalized) {
                  if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                        const rewound = turf.rewind(feature, { reverse: false, mutate: false });
                        if (turf.booleanPointInPolygon(point, rewound)) {
                              console.log(`SUCCESS: Covered by feature with properties: ${JSON.stringify(feature.properties)}`);
                              isCovered = true;
                              break;
                        }

                        // Try buffer
                        try {
                              const buffered = turf.buffer(rewound, 0, { units: 'meters' });
                              const bufferedFeatures = buffered.type === 'FeatureCollection' ? buffered.features : [buffered];
                              for (const bf of bufferedFeatures) {
                                    if (turf.booleanPointInPolygon(point, bf)) {
                                          console.log(`SUCCESS (Buffered): Covered by feature`);
                                          isCovered = true;
                                          break;
                                    }
                              }
                        } catch (e) { }
                  }
                  if (isCovered) break;
            }

            if (!isCovered) {
                  console.log("FINAL RESULT: NOT COVERED");
            }

      } catch (err) {
            console.error(err);
      }
}

debug();
