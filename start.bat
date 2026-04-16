@echo off
setlocal

echo ===========================================
echo    Starting SupplyTrack Backend
echo ===========================================

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python from https://python.org and try again.
    pause
    exit /b 1
)

echo Found Python:
python --version

REM Install dependencies using the same Python that is in PATH
echo.
echo Installing dependencies...
python -m pip install -r requirements.txt --quiet

if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo Dependencies installed successfully.
echo.

REM Run uvicorn using the same Python (avoids version mismatch)
echo Starting server at http://127.0.0.1:8000 ...
echo Press CTRL+C to stop the server.
echo.

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause
