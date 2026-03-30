Write-Host "Starting SupplyTrack backend..."
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --port 8000 --reload
