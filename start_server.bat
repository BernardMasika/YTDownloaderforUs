@echo off
REM Navigate to the project directory
cd /d "F:\WEB PROJECTS\YTDownloaderforUs"

REM Start the Node.js server in detached mode
start "" /b node server- old using wrapper.js > server.log 2>&1

REM Open the browser on localhost:3000
start http://localhost:3000

REM Optionally add a message
echo Server is running in detached mode. Check server.log for logs.
pause
