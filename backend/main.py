from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.geospatial import parse_kml_kmz, check_coverage
from services.geocoding import get_coordinates
import geopandas as gpd
import pandas as pd
from typing import List
import json

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for the latest uploaded coverage map
active_coverage_map: gpd.GeoDataFrame = None
active_filenames: List[str] = []

class CheckRequest(BaseModel):
    address: str

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    global active_coverage_map, active_filenames
    
    gdfs = []
    filenames = []
    
    try:
        for file in files:
            gdf = await parse_kml_kmz(file)
            # Add source file column
            gdf['source_file'] = file.filename
            gdfs.append(gdf)
            filenames.append(file.filename)
        
        if not gdfs:
             raise HTTPException(status_code=400, detail="No valid files processed")

        # Merge all GDFs
        active_coverage_map = pd.concat(gdfs, ignore_index=True)
        active_filenames = filenames
        
        return {
            "status": "loaded", 
            "files": filenames, 
            "total_features": len(active_coverage_map)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/check-coverage")
async def check_address(request: CheckRequest):
    global active_coverage_map
    
    if active_coverage_map is None:
        raise HTTPException(status_code=400, detail= "No coverage file uploaded. Please upload a KML/KMZ first.")
    
    # 1. Geocode
    coords = get_coordinates(request.address)
    if not coords:
        return {"found": False, "message": "Address not found"}
    
    lat, lon = coords
    
    # 2. Check Coverage
    result = check_coverage(lat, lon, active_coverage_map)
    
    return {
        "found": True,
        "address": request.address,
        "coordinates": {"lat": lat, "lon": lon},
        "coverage": result,
        "loaded_files": active_filenames
    }

@app.get("/coverage-map")
async def get_coverage_map():
    global active_coverage_map
    if active_coverage_map is None:
        raise HTTPException(status_code=400, detail="No coverage map loaded")
    
    # Convert to GeoJSON
    # We only need geometry and source_file for visualization
    # Simplify geometry if needed for performance, but for now raw is fine
    return json.loads(active_coverage_map[['geometry', 'source_file']].to_json())
