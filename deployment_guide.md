# Deployment Guide - Network Coverage Checker

## Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **Git**

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd coverage_checker
```

### 2. Backend Setup (FastAPI)
Navigate to the backend directory and set up the Python environment.

```bash
cd backend
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup (React)
Navigate to the frontend directory and install Node dependencies.

```bash
cd ../frontend
npm install
```

## Running the Application

### 1. Start the Backend
In the `backend` directory (with venv activated):
```bash
uvicorn main:app --reload --port 8000
```
The API will be available at `http://localhost:8000`.

### 2. Start the Frontend
In the `frontend` directory:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

## Troubleshooting
- **"Access Denied" on Windows**: Try running terminals as Administrator or use `python -m uvicorn ...` instead of `uvicorn ...`.
- **Geocoding Errors**: If address search fails frequently, the OpenStreetMap rate limit might be reached. Consider waiting a few seconds between requests.
