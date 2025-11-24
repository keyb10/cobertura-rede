from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# Initialize Nominatim API
# user_agent is required by Nominatim policy
geolocator = Nominatim(user_agent="coverage_checker_app")

def get_coordinates(address: str):
    """
    Converts an address string to (latitude, longitude).
    Returns None if address not found or error.
    """
    try:
        location = geolocator.geocode(address)
        if location:
            return location.latitude, location.longitude
        return None
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding error: {e}")
        return None
