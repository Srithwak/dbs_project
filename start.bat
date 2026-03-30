@echo off
echo Starting SupplyTrack backend...
call .\venv\Scripts\activate.bat
uvicorn app.main:app --port 8000 --reload
