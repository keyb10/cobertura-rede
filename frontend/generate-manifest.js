import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mapsDir = path.join(__dirname, 'public/maps');
const manifestPath = path.join(__dirname, 'public/maps.json');

// Ensure directory exists
if (!fs.existsSync(mapsDir)) {
      console.error('Maps directory not found:', mapsDir);
      process.exit(1);
}

// Read files
const files = fs.readdirSync(mapsDir);

// Filter for KML/KMZ
const mapFiles = files
      .filter(file => file.toLowerCase().endsWith('.kml') || file.toLowerCase().endsWith('.kmz'))
      .map(file => `maps/${file}`);

// Write manifest
fs.writeFileSync(manifestPath, JSON.stringify(mapFiles, null, 2));

console.log(`Manifest generated with ${mapFiles.length} maps:`);
mapFiles.forEach(f => console.log(`- ${f}`));
