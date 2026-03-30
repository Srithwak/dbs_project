#!/bin/bash

echo "Starting SupplyTrack backend..."

source ./venv/bin/activate
uvicorn main:app --port 8000 --reload