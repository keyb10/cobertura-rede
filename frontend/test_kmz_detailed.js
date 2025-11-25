import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from 'togeojson';
import * as turf from '@turf/turf';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const kmzPath = path.join(__dirname, 'public/maps/Cobertura MAncha IHS SP.kmz');

// Same normalization logic from App.jsx
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

async function testKMZ() {
      try {
            console.log("=== TESTING KMZ FILE ===\n");

            // 1. Load and extract KMZ
            console.log("1. Loading KMZ file...");
            const data = fs.readFileSync(kmzPath);
            const zip = await JSZip.loadAsync(data);

            console.log("2. Files in KMZ:");
            Object.keys(zip.files).forEach(name => {
                  console.log(`   - ${name}`);
            });

            const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
            if (!kmlFile) {
                  console.error("ERROR: No KML found in KMZ!");
                  return;
            }

            console.log(`\n3. Extracting KML: ${kmlFile}`);
            const kmlText = await zip.file(kmlFile).async('string');
            console.log(`   KML size: ${kmlText.length} characters`);

            // 2. Parse KML
            console.log("\n4. Parsing KML...");
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, 'text/xml');

            // Check for parsing errors
            const parseError = kmlDom.getElementsByTagName('parsererror');
            if (parseError.length > 0) {
                  console.error("ERROR: XML parsing failed!");
                  console.error(parseError[0].textContent);
                  return;
            }

            console.log("   XML parsed successfully");

            // 3. Convert to GeoJSON
            console.log("\n5. Converting to GeoJSON...");
            let geoJson;
            try {
                  geoJson = toGeoJSON.kml(kmlDom);
                  console.log(`   Raw features: ${geoJson.features.length}`);
            } catch (err) {
                  console.error("ERROR: toGeoJSON.kml() failed!");
                  console.error(err.message);
                  console.error(err.stack);
                  return;
            }

            // 4. Normalize
            console.log("\n6. Normalizing features...");
            const normalized = normalizeFeatures(geoJson.features);
            console.log(`   Normalized features: ${normalized.length}`);

            // 5. Show feature types
            const types = {};
            normalized.forEach(f => {
                  const type = f.geometry.type;
                  types[type] = (types[type] || 0) + 1;
            });
            console.log("\n7. Feature types:");
            Object.entries(types).forEach(([type, count]) => {
                  console.log(`   ${type}: ${count}`);
            });

            // 6. Test with Hospital Francisco Morato
            console.log("\n8. Testing coverage for 'Hospital Francisco Morato'...");
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent("Hospital Francisco Morato")}`);
            const geocodeData = await response.json();

            if (!geocodeData || geocodeData.length === 0) {
                  console.error("ERROR: Address not found via Nominatim");
                  return;
            }

            const lat = parseFloat(geocodeData[0].lat);
            const lon = parseFloat(geocodeData[0].lon);
            console.log(`   Geocoded to: [${lon}, ${lat}]`);

            const point = turf.point([lon, lat]);

            let isCovered = false;
            let coveringFeature = null;

            for (const feature of normalized) {
                  try {
                        const type = feature.geometry.type;

                        if (type === 'Polygon' || type === 'MultiPolygon') {
                              const rewound = turf.rewind(feature, { reverse: false, mutate: false });
                              if (turf.booleanPointInPolygon(point, rewound)) {
                                    isCovered = true;
                                    coveringFeature = feature;
                                    break;
                              }

                              // Try buffer
                              try {
                                    const buffered = turf.buffer(feature, 0, { units: 'meters' });
                                    const bufferedFeatures = buffered.type === 'FeatureCollection' ? buffered.features : [buffered];
                                    for (const bf of bufferedFeatures) {
                                          if (turf.booleanPointInPolygon(point, bf)) {
                                                isCovered = true;
                                                coveringFeature = feature;
                                                break;
                                          }
                                    }
                              } catch (e) { }
                        }

                        if (isCovered) break;
                  } catch (err) {
                        console.warn(`   Warning: Error checking feature: ${err.message}`);
                  }
            }

            console.log(`\n9. RESULT: ${isCovered ? 'COVERED ✓' : 'NOT COVERED ✗'}`);
            if (isCovered && coveringFeature) {
                  console.log(`   Source: ${JSON.stringify(coveringFeature.properties)}`);
            }

      } catch (err) {
            console.error("\n=== FATAL ERROR ===");
            console.error(err.message);
            console.error(err.stack);
      }
}

testKMZ();
