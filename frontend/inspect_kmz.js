import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const kmzPath = path.join(__dirname, 'public/maps/Cobertura MAncha IHS SP.kmz');

async function inspect() {
      try {
            const data = fs.readFileSync(kmzPath);
            const zip = await JSZip.loadAsync(data);
            const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));

            if (!kmlFile) {
                  console.error('No KML found in KMZ');
                  return;
            }

            const kmlText = await zip.file(kmlFile).async('string');
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, 'text/xml');
            const geoJson = kml(kmlDom);

            console.log(`Found ${geoJson.features.length} features`);

            geoJson.features.forEach((f, i) => {
                  console.log(`Feature ${i}: Type=${f.geometry.type}`);
                  if (f.geometry.type === 'GeometryCollection') {
                        f.geometry.geometries.forEach((g, j) => {
                              console.log(`  Sub-geometry ${j}: Type=${g.type}`);
                              if (g.coordinates && g.coordinates.length > 0) {
                                    console.log(`  Sample Coord: ${JSON.stringify(g.coordinates[0])}`);
                              }
                        });
                  } else if (f.geometry.coordinates) {
                        // Sample first coordinate
                        let sample = f.geometry.coordinates;
                        while (Array.isArray(sample[0])) {
                              sample = sample[0];
                        }
                        console.log(`  Sample Coord: ${JSON.stringify(sample)}`);
                  }
            });

      } catch (err) {
            console.error(err);
      }
}

inspect();
