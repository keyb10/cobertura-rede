import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, MapPin, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import MapResult from './components/MapResult';
import * as toGeoJSON from 'togeojson';
import JSZip from 'jszip';
import * as turf from '@turf/turf';

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
    if (typeof coords[0] === 'number') {
      return coords.slice(0, 2);
    }
    return coords.map(to2D);
  };

  // Helper to flatten GeometryCollections and normalize to 2D
  const normalizeFeatures = (features) => {
    const flat = [];

    const processGeometry = (geometry, properties) => {
      if (geometry.type === 'GeometryCollection') {
        geometry.geometries.forEach(g => processGeometry(g, properties));
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
        reader.onload = async (e) => {
          try {
            const zip = await JSZip.loadAsync(e.target.result);
            const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
            if (kmlFile) {
              const kmlText = await zip.file(kmlFile).async('string');
              const parser = new DOMParser();
              const kmlDom = parser.parseFromString(kmlText, 'text/xml');
              const geoJson = toGeoJSON.kml(kmlDom);
              geoJson.features.forEach(f => f.properties.source_file = file.name);
              resolve(normalizeFeatures(geoJson.features));
            } else {
              reject(new Error('No KML found in KMZ'));
            }
          } catch (err) {
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
        const manifestRes = await fetch('./maps.json');
        if (!manifestRes.ok) return; // No manifest, skip

        const mapUrls = await manifestRes.json();
        const loadedFiles = [];
        const allFeatures = [];

        for (const url of mapUrls) {
          // Prepend './' to map URLs if they don't have it, to ensure relative fetching
          const safeUrl = url.startsWith('http') || url.startsWith('/') ? url : `./${url}`;

          const res = await fetch(safeUrl);
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.google-earth.kml+xml': ['.kml'],
      'application/vnd.google-earth.kmz': ['.kmz']
    },
    multiple: true
  });

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
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          if (turf.booleanPointInPolygon(point, feature)) {
            isCovered = true;
            coveringFeature = feature;
            break;
          }
        } else if (feature.geometry.type === 'Point') {
          // Check distance (4km radius)
          const distance = turf.distance(point, feature, { units: 'kilometers' });
          if (distance <= 4) {
            isCovered = true;
            coveringFeature = feature;
            break;
          }
        }
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
    <div className="container">
      <div className="glass-card">
        <h1>Network Coverage</h1>

        {/* Upload Section */}
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <Loader2 className="animate-spin" size={48} />
              <p>Processing coverage maps...</p>
            </div>
          ) : files.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <CheckCircle size={48} color="var(--success)" />
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{files.length} Files Loaded</p>
              <div style={{ fontSize: '0.9rem', opacity: 0.7, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {files.map(f => <span key={f.name}>{f.name}</span>)}
              </div>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '1rem' }}>Click or drag to replace</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <Upload size={48} color="var(--accent-primary)" />
              <p style={{ fontSize: '1.2rem' }}>Drag & drop KML/KMZ files here</p>
              <p style={{ color: 'var(--text-secondary)' }}>or click to select files</p>
            </div>
          )}
        </div>

        {/* Search Section */}
        <form onSubmit={handleCheck} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Enter address to check coverage..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={files.length === 0 || uploading}
          />
          <button
            type="submit"
            style={{
              position: 'absolute',
              right: '8px',
              top: '8px',
              bottom: '8px',
              padding: '0 1.5rem'
            }}
            disabled={files.length === 0 || uploading || checking || !address}
          >
            {checking ? <Loader2 className="animate-spin" /> : <MapPin />}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="result-card result-error">
            <XCircle size={24} />
            <span>{error}</span>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div className={`result-card ${result.coverage.covered ? 'result-success' : 'result-error'}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {result.coverage.covered ? <CheckCircle size={32} /> : <XCircle size={32} />}
              <div>
                <h3 style={{ margin: 0 }}>{result.coverage.covered ? 'Covered!' : 'Not Covered'}</h3>
                <p style={{ margin: '0.5rem 0 0', opacity: 0.8 }}>
                  {result.coverage.covered
                    ? `This location is within our network.`
                    : `Sorry, this location is outside the coverage area.`}
                  <br />
                  {result.coverage.source_file && <small>Source: {result.coverage.source_file}</small>}
                  {result.coverage.details?.Name && <><br /><small>Region: {result.coverage.details.Name}</small></>}
                </p>
              </div>
            </div>

            {/* Map Visualization */}
            <MapResult
              coordinates={result.coordinates}
              coverageStatus={result.coverage}
              allFeatures={geoJsonFeatures}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
