@echo off
echo Starting TutorIT Application...
echo.

echo Starting Laravel Backend (Port 8000)...
cd tutorit-backend
start "Laravel Backend" cmd /k "php artisan serve"
cd ..

echo.
echo Starting Node.js Frontend (Port 3000)...
start "Node.js Frontend" cmd /k "node server.js"

echo.
echo Both servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window...
pause > nul 