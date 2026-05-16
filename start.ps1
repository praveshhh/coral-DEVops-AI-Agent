# Start Backend
Write-Host "Starting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd examples/commander-x/backend; pip install -r requirements.txt; python main.py"

# Start Frontend
Write-Host "Starting Frontend..." -ForegroundColor Green
cd examples/commander-x/frontend
npm install
npm run dev
