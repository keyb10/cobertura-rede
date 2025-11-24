import geopandas as gpd
from shapely.geometry import Point
import fiona
import os
import zipfile
import tempfile
from fastapi import UploadFile

# Enable KML driver for fiona
fiona.drvsupport.supported_drivers['KML'] = 'rw'

async def parse_kml_kmz(file: UploadFile):
    """
    Parses an uploaded KML or KMZ file and returns a GeoDataFrame.
    """
    filename = file.filename
    content = await file.read()
    
    # Create a temporary directory to handle file processing
    with tempfile.TemporaryDirectory() as tmpdirname:
        file_path = os.path.join(tmpdirname, filename)
        with open(file_path, "wb") as f:
            f.write(content)
            
        if filename.lower().endswith('.kmz'):
            # Unzip KMZ to extract KML
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(tmpdirname)
                # Find the KML file inside (usually doc.kml)
                kml_files = [f for f in os.listdir(tmpdirname) if f.lower().endswith('.kml')]
                if not kml_files:
                    raise ValueError("No KML file found inside KMZ")
                file_path = os.path.join(tmpdirname, kml_files[0])
        
        # Read KML with geopandas
        try:
            gdf = gpd.read_file(file_path, driver='KML')
            return gdf
        except Exception as e:
            raise ValueError(f"Failed to parse KML/KMZ: {e}")

def check_coverage(lat: float, lon: float, gdf: gpd.GeoDataFrame):
    """
    Checks if a point (lat, lon) is inside any polygon in the GeoDataFrame.
    Returns the row(s) containing the point.
    """
    point = Point(lon, lat) # Note: Point takes (x, y) -> (lon, lat)
    
    # Check if point is within any geometry
    # We assume the KML is in WGS84 (EPSG:4326) which is standard for KML
    
    # Filter for polygons containing the point
    containing_polys = gdf[gdf.geometry.contains(point)]
    
    if not containing_polys.empty:
        # Return the first match's details including source_file
        match = containing_polys.iloc[0]
        details = match.to_dict()
        
        # Ensure geometry is not sent to JSON (it's not serializable)
        if 'geometry' in details:
            del details['geometry']
            
        return {
            "covered": True,
            "source_file": details.get('source_file', 'Unknown'),
            "details": details
        }
    
    return {"covered": False}
