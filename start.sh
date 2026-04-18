#!/usr/bin/env bash
set -e

echo "==========================================="
echo "   Starting SupplyTrack Backend"
echo "==========================================="

# Check for Python 3
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo "ERROR: Python is not installed or not in PATH."
    echo "Please install Python from https://python.org and try again."
    exit 1
fi

# Resolve python command
PYTHON=$(command -v python3 || command -v python)
echo "Found Python: $($PYTHON --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    $PYTHON -m venv venv
fi

# Activate the virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Install / upgrade dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt --quiet

echo "Dependencies installed successfully."
echo ""

# Run the app
echo "Starting server at http://127.0.0.1:8000 ..."
echo "Press CTRL+C to stop the server."
echo ""

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload