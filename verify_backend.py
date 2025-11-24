import requests
import os

# 1. Create two sample KML files
kml_1 = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Zone A</name>
    <Placemark>
      <name>Zone A Polygon</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -46.633308,-23.550000,0
              -46.633308,-23.551520,0
              -46.632308,-23.551520,0
              -46.632308,-23.550000,0
              -46.633308,-23.550000,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
"""

kml_2 = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Zone B</name>
    <Placemark>
      <name>Zone B Polygon</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -46.643308,-23.560520,0
              -46.643308,-23.561520,0
              -46.642308,-23.561520,0
              -46.642308,-23.560520,0
              -46.643308,-23.560520,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
"""

with open("zone_a.kml", "w") as f:
    f.write(kml_1)
with open("zone_b.kml", "w") as f:
    f.write(kml_2)

print("Created zone_a.kml and zone_b.kml")

# 2. Upload Files
url = "http://localhost:8000"
files = [
    ('files', ('zone_a.kml', open('zone_a.kml', 'rb'), 'application/vnd.google-earth.kml+xml')),
    ('files', ('zone_b.kml', open('zone_b.kml', 'rb'), 'application/vnd.google-earth.kml+xml'))
]

try:
    r = requests.post(f"{url}/upload", files=files)
    print(f"Upload Status: {r.status_code}")
    print(f"Upload Response: {r.json()}")
except Exception as e:
    print(f"Upload Failed: {e}")
    exit(1)

# 3. Check Coverage (Point Inside Zone A)
# Center of Zone A is roughly -23.551020, -46.632808 (Praça da Sé)
check_payload = {"address": "Praça da Sé, São Paulo"}
try:
    r = requests.post(f"{url}/check-coverage", json=check_payload)
    print(f"Check Zone A Status: {r.status_code}")
    resp = r.json()
    print(f"Check Zone A Response: {resp}")
    
    # Debug info
    print(f"Target Address: {check_payload['address']}")
    print(f"Returned Coords: {resp.get('coordinates')}")
    
    if resp.get('coverage', {}).get('source_file') == 'zone_a.kml':
        print("SUCCESS: Correctly identified Zone A")
    else:
        print("FAILURE: Did not identify Zone A")
except Exception as e:
    print(f"Check Failed: {e}")
