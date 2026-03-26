Write-Host "Starting SupplyTrack backend..."
.\venv\Scripts\Activate.ps1
uvicorn main:app --port 8000 --reload
