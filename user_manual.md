# User Manual - Network Coverage Checker

## Overview
The Network Coverage Checker allows you to verify if a specific location is covered by your network using KMZ/KML map files.

## How to Use

### 1. Upload Coverage Map
1.  Open the application in your browser.
2.  Drag and drop your `.kmz` or `.kml` files into the upload area. You can select multiple files at once.
3.  Wait for the confirmation message showing the number of files loaded.

### 2. Check an Address
1.  Enter the full address (Street, Number, City) in the search bar.
2.  Click the **Search Icon** or press **Enter**.
3.  The system will process the request.

### 3. Interpret Results
-   **Green Checkmark**: The address is **Covered**. The card will show the source file and the region name.
-   **Red X**: The address is **Not Covered** by the uploaded map.
-   **Interactive Map**: A map will appear below the result showing:
    -   **Blue Polygons**: The coverage areas from your files.
    -   **Blue Marker**: The location of the address you searched.
    -   **Popup**: Click on a polygon to see which file it belongs to.
-   **Error**: If the address is not found, check the spelling and try again.

## Tips
-   Ensure your KML/KMZ files are valid and contain Polygon geometries.
-   The address search uses OpenStreetMap. Be specific with city and state for best results.
