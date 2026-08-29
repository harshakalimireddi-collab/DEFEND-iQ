@echo off
cd /d "%~dp0"
echo Starting SOC Beacon Next.js Dev Server (localhost:3000)...
start "SOC-Beacon-Server" cmd /k "npm run dev"

echo Waiting 5 seconds for server initialization...
ping -n 6 127.0.0.1 >nul

echo Starting ngrok Tunnel (port 3000)...
start "ngrok-Tunnel" cmd /k "ngrok http 3000"

exit
