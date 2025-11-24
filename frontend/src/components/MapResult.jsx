import React from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to update map view when center changes
function ChangeView({ center, zoom }) {
    const map = useMap();
    map.setView(center, zoom);
    return null;
}

function MapResult({ coordinates, coverageStatus, allFeatures }) {
    const position = [coordinates.lat, coordinates.lon];

    const onEachFeature = (feature, layer) => {
        if (feature.properties && feature.properties.source_file) {
            layer.bindPopup(`Source: ${feature.properties.source_file}`);
        }
    };

    const pointToLayer = (feature, latlng) => {
        return L.circleMarker(latlng, {
            radius: 4,
            fillColor: "#3b82f6",
            color: "#2563eb",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        });
    };

    const style = (feature) => {
        return {
            fillColor: '#3b82f6',
            weight: 2,
            opacity: 1,
            color: '#2563eb',
            dashArray: '3',
            fillOpacity: 0.3
        };
    };

    // Prepare GeoJSON data from allFeatures
    const geoJsonData = {
        type: "FeatureCollection",
        features: allFeatures || []
    };

    return (
        <div style={{ height: '400px', width: '100%', marginTop: '1rem', borderRadius: '1rem', overflow: 'hidden' }}>
            <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
                <ChangeView center={position} zoom={15} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {geoJsonData.features.length > 0 && (
                    <GeoJSON
                        data={geoJsonData}
                        style={style}
                        pointToLayer={pointToLayer}
                        onEachFeature={onEachFeature}
                    />
                )}
                <Marker position={position}>
                    <Popup>
                        {coverageStatus.covered ? "Covered Location" : "Not Covered"}
                    </Popup>
                </Marker>
                {/* Visual aid for coverage radius if covered by a Point */}
                {coverageStatus.covered && coverageStatus.type === 'Point' && (
                    <L.Circle center={position} radius={4000} pathOptions={{ color: 'green', fillOpacity: 0.1 }} />
                )}
            </MapContainer>
        </div>
    );
}

export default MapResult;
