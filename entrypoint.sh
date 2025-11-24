#!/bin/bash

# Start Uvicorn in background
# We bind to 0.0.0.0:8000 so Nginx can reach it via 127.0.0.1:8000
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start Nginx in foreground
# Cloud Run injects $PORT, which Nginx is configured to listen on
# We need to substitute $PORT in nginx.conf before starting
envsubst '$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

nginx -g 'daemon off;'
