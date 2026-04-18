Write-Host "==========================================="
Write-Host "   Starting SupplyTrack Backend"
Write-Host "==========================================="

# Check for Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Python is not installed or not in PATH."
    Write-Host "Please install Python from https://python.org and try again."
    exit 1
}

Write-Host "Found Python: $(python --version)"

# Create virtual environment if it doesn't exist
if (-not (Test-Path ".\venv")) {
    Write-Host ""
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

# Activate the virtual environment
Write-Host ""
Write-Host "Activating virtual environment..."
.\venv\Scripts\Activate.ps1

# Install / upgrade dependencies
Write-Host ""
Write-Host "Installing dependencies..."
pip install -r requirements.txt --quiet

Write-Host "Dependencies installed successfully."
Write-Host ""

# Run the app
Write-Host "Starting server at http://127.0.0.1:8000 ..."
Write-Host "Press CTRL+C to stop the server."
Write-Host ""

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
