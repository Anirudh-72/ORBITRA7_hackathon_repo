@echo off
echo Building the ORBITRA7 frontend...
cd role5_frontend
call npm run build
cd ..

echo.
echo Starting the ORBITRA7 FastAPI Backend and Frontend...
python -m uvicorn backend.main:app --port 8000 --host 0.0.0.0
