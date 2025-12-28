import React, { useState, useCallback } from 'react';
import { Upload, MapPin, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import MapResult from './components/MapResult';
import * as toGeoJSON from 'togeojson';
import JSZip from 'jszip';
import * as turf from '@turf/turf';
import './App.css'; // Add missing CSS import

function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [geoJsonFeatures, setGeoJsonFeatures] = useState([]);

  // Helper to remove altitude (3D -> 2D)
  const to2D = (coords) => {
    // If it's a single coordinate pair/triplet (array of numbers)
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      return coords.slice(0, 2);
    }
    // If it's an array of coordinates (LineString, Polygon ring)
    if (Array.isArray(coords)) {
      return coords.map(to2D);
    }
    return coords;
  };

  // Helper to flatten GeometryCollections and normalize to 2D
  const normalizeFeatures = (features) => {
    const flat = [];

    const processGeometry = (geometry, properties) => {
      if (!geometry) return;

      if (geometry.type === 'GeometryCollection') {
        if (geometry.geometries) {
          geometry.geometries.forEach(g => processGeometry(g, properties));
        }
      } else {
        // Force 2D coordinates
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

  // Reuse processFile logic
  const processFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (file.name.endsWith('.kmz')) {
        console.log(`[KMZ] Processing file: ${file.name}`);
        reader.onload = async (e) => {
          try {
            console.log('[KMZ] Loading ZIP...');
            const zip = await JSZip.loadAsync(e.target.result);
            console.log('[KMZ] ZIP loaded, files:', Object.keys(zip.files));

            const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
            if (kmlFile) {
              console.log(`[KMZ] Found KML: ${kmlFile}`);
              const kmlText = await zip.file(kmlFile).async('string');
              console.log(`[KMZ] KML extracted, size: ${kmlText.length} chars`);

              const parser = new DOMParser();
              const kmlDom = parser.parseFromString(kmlText, 'text/xml');
              console.log('[KMZ] KML parsed to DOM');

              const geoJson = toGeoJSON.kml(kmlDom);
              console.log(`[KMZ] Converted to GeoJSON, features: ${geoJson.features.length}`);

              geoJson.features.forEach(f => f.properties.source_file = file.name);
              const normalized = normalizeFeatures(geoJson.features);
              console.log(`[KMZ] Normalized features: ${normalized.length}`);

              resolve(normalized);
            } else {
              console.error('[KMZ] ERROR: No KML found in KMZ');
              reject(new Error('No KML found in KMZ'));
            }
          } catch (err) {
            console.error('[KMZ] ERROR:', err.message, err.stack);
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (e) => {
          try {
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(e.target.result, 'text/xml');
            const geoJson = toGeoJSON.kml(kmlDom);
            geoJson.features.forEach(f => f.properties.source_file = file.name);
            resolve(normalizeFeatures(geoJson.features));
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsText(file);
      }
    });
  };

  // Auto-load maps on mount
  const loadedRef = React.useRef(false);

  React.useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadDefaultMaps = async () => {
      try {
        setUploading(true);
        // Use relative path './maps.json' to respect the base URL (e.g. /cobertura-rede/)
        // Add timestamp to prevent caching issues
        console.log("Fetching maps.json...");
        const manifestRes = await fetch(`./maps.json?v=${new Date().getTime()}`);
        if (!manifestRes.ok) throw new Error(`Failed to load manifest: ${manifestRes.status}`);

        const mapUrls = await manifestRes.json();
        console.log("Maps to load:", mapUrls);

        const loadedFiles = [];
        const allFeatures = [];

        for (const url of mapUrls) {
          // Prepend './' to map URLs if they don't have it, to ensure relative fetching
          const safeUrl = url.startsWith('http') || url.startsWith('/') ? url : `./${url}`;

          console.log(`Fetching map: ${safeUrl}`);
          // Also add cache busting for individual KML files just in case
          const res = await fetch(`${safeUrl}?v=${new Date().getTime()}`);
          if (!res.ok) {
            console.error(`Failed to fetch ${safeUrl}: ${res.status}`);
            continue;
          }

          const blob = await res.blob();
          const filename = url.split('/').pop();
          const file = new File([blob], filename, { type: 'application/vnd.google-earth.kml+xml' });

          loadedFiles.push(file);
          const features = await processFile(file);
          allFeatures.push(...features);
        }

        setFiles(prev => {
          // Avoid duplicates if strict mode somehow bypasses ref (rare but safe)
          const newFiles = loadedFiles.filter(nf => !prev.some(pf => pf.name === nf.name));
          return [...prev, ...newFiles];
        });

        setGeoJsonFeatures(prev => {
          // Simple append for features, assuming file check handles the user-facing list
          return [...prev, ...allFeatures];
        });

      } catch (err) {
        console.error("Error auto-loading maps:", err);
      } finally {
        setUploading(false);
      }
    };

    loadDefaultMaps();
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    setFiles(acceptedFiles);
    setUploading(true);
    setError(null);
    setGeoJsonFeatures([]);

    try {
      const allFeatures = [];
      for (const file of acceptedFiles) {
        const features = await processFile(file);
        allFeatures.push(...features);
      }
      setGeoJsonFeatures(allFeatures);
      setUploading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to process files. Please ensure they are valid KML/KMZ.');
      setUploading(false);
      setFiles([]);
    }
  }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!address.trim()) return;

    setChecking(true);
    setResult(null);
    setError(null);

    try {
      // 1. Geocode using Nominatim (OpenStreetMap)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();

      if (!data || data.length === 0) {
        setError('Address not found.');
        setChecking(false);
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const point = turf.point([lon, lat]); // Turf uses [lon, lat]

      // 2. Check Coverage
      let isCovered = false;
      let coveringFeature = null;

      for (const feature of geoJsonFeatures) {
        try {
          const type = feature.geometry.type;

          if (type === 'Polygon' || type === 'MultiPolygon') {
            // 1. Try standard check with rewind
            try {
              const rewound = turf.rewind(feature, { reverse: false, mutate: false });
              if (turf.booleanPointInPolygon(point, rewound)) {
                isCovered = true;
                coveringFeature = feature;
                break;
              }
            } catch (rewindErr) {
              console.warn("Rewind check failed for feature:", rewindErr);
            }

            // 2. Try buffering (fixes self-intersections)
            if (!isCovered) {
              try {
                const buffered = turf.buffer(feature, 0, { units: 'meters' });
                if (buffered) {
                  const bufferedFeatures = buffered.type === 'FeatureCollection' ? buffered.features : [buffered];
                  for (const bf of bufferedFeatures) {
                    if (turf.booleanPointInPolygon(point, bf)) {
                      isCovered = true;
                      coveringFeature = feature;
                      break;
                    }
                  }
                }
              } catch (bufferErr) {
                console.warn("Buffer check failed for feature:", bufferErr);
              }
            }

          } else if (type === 'LineString' || type === 'MultiLineString') {
            // Try treating closed lines as polygons
            try {
              const poly = turf.lineToPolygon(feature);
              if (turf.booleanPointInPolygon(point, poly)) {
                isCovered = true;
                coveringFeature = feature;
                break;
              }
            } catch (lineErr) {
              console.warn("Line to polygon conversion failed:", lineErr);
            }

          } else if (type === 'Point') {
            // Check distance (4km radius)
            try {
              const distance = turf.distance(point, feature, { units: 'kilometers' });
              if (distance <= 4) {
                isCovered = true;
                coveringFeature = feature;
                break;
              }
            } catch (distErr) {
              console.warn("Distance check failed:", distErr);
            }
          }
        } catch (featureErr) {
          console.warn("Error processing feature:", featureErr);
          // Continue to next feature
        }

        if (isCovered) break;
      }

      setResult({
        found: true,
        address: data[0].display_name,
        coordinates: { lat, lon },
        coverage: {
          covered: isCovered,
          source_file: coveringFeature?.properties?.source_file,
          details: coveringFeature?.properties,
          type: coveringFeature?.geometry?.type
        }
      });

    } catch (err) {
      console.error(err);
      setError('Error checking coverage. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Top Search Bar */}
      <div className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            Network Coverage
          </h1>

          <form onSubmit={handleCheck} className="search-form">
            <input
              type="text"
              placeholder="Enter address to check coverage..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={files.length === 0 || uploading}
              className="search-input"
            />
            <button
              type="submit"
              className="search-button"
              disabled={files.length === 0 || uploading || checking || !address}
            >
              {checking ? <Loader2 className="animate-spin" size={16} /> : 'OK'}
            </button>
          </form>
        </div>

        {/* Status Indicator - Below search */}
        <div className="status-indicator">
          <CheckCircle size={14} color="var(--success)" />
          <span>{files.length} maps loaded</span>
        </div>
      </div>

      {/* Fullscreen Map */}
      {/* Map Section */}
      <div className="map-section">
        <div className="map-container">
          {result ? (
            <MapResult
              coordinates={result.coordinates}
              coverageStatus={result.coverage}
              allFeatures={geoJsonFeatures}
            />
          ) : (
            <div className="map-placeholder">
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <Loader2 className="animate-spin" size={48} />
                  <p>Loading coverage maps...</p>
                </div>
              ) : (
                'Enter an address above to check coverage'
              )}
            </div>
          )}
        </div>
        {/* Floating Result Card */}
        {result && (
          <div style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            minWidth: '400px',
            maxWidth: '500px'
          }}>
            <div className={`result-card ${result.coverage.covered ? 'result-success' : 'result-error'}`}
              style={{
                background: result.coverage.covered
                  ? 'rgba(34, 197, 94, 0.95)'
                  : 'rgba(239, 68, 68, 0.95)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                color: 'white'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {result.coverage.covered ? <CheckCircle size={32} color="white" /> : <XCircle size={32} color="white" />}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white' }}>
                    {result.coverage.covered ? 'Covered!' : 'Not Covered'}
                  </h3>
                  <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '0.9rem', color: 'white' }}>
                    {result.coverage.covered
                      ? `This location is within our network.`
                      : `Sorry, this location is outside the coverage area.`}
                  </p>
                  {result.coverage.source_file && (
                    <p style={{ margin: '0.5rem 0 0', opacity: 0.8, fontSize: '0.8rem', color: 'white' }}>
                      Source: {result.coverage.source_file}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            position: 'absolute',
            top: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            minWidth: '400px'
          }}>
            <div className="result-card result-error" style={{
              background: 'rgba(239, 68, 68, 0.95)',
              backdropFilter: 'blur(10px)'
            }}>
              <XCircle size={24} />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}

export default App;
