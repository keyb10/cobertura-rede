# Google Cloud Run Deployment Guide

This guide explains how to deploy the Network Coverage Checker to Google Cloud Run using a single Docker container.

## Prerequisites
1.  **Google Cloud Platform Account**.
2.  **gcloud CLI** installed and authenticated (`gcloud auth login`).
3.  **Docker** installed locally (optional, but recommended for testing).

## Deployment Steps

### 1. Enable Required Services
Enable the Cloud Run and Container Registry (or Artifact Registry) APIs.
```bash
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

### 2. Set Project ID
Set your GCP Project ID variable.
```bash
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID
```

### 3. Build and Submit the Image
We will use Cloud Build to build the Docker image and store it in Google Container Registry (GCR).
*Note: Run this command from the root `coverage_checker` directory.*

```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/coverage-checker
```

### 4. Deploy to Cloud Run
Deploy the image to Cloud Run. We set the memory to 512MB or 1GB depending on your KML file sizes.

```bash
gcloud run deploy coverage-checker \
  --image gcr.io/$PROJECT_ID/coverage-checker \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi
```

### 5. Access the Application
Once deployed, Cloud Run will provide a URL (e.g., `https://coverage-checker-xyz-uc.a.run.app`).
Open this URL in your browser. The application is now live!

## Troubleshooting
-   **Build Fails**: Check the logs in the Cloud Build console. Ensure `Dockerfile` is in the root and paths to `backend/` and `frontend/` are correct.
-   **Application Error**: Check Cloud Run logs.
    -   If Nginx fails, check `nginx.conf`.
    -   If Backend fails, check if `uvicorn` started correctly.
