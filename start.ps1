$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

# Start Backend (in a separate window with proper error gating via &&)
Write-Host "Starting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$ErrorActionPreference='Stop'; Set-Location '$scriptDir/examples/commander-x/backend'; pip install -r requirements.txt; if (`$LASTEXITCODE -ne 0) { throw 'pip install failed' }; python main.py; if (`$LASTEXITCODE -ne 0) { throw 'Backend failed to start' }"

# Start Frontend (with exit-code checks)
Write-Host "Starting Frontend..." -ForegroundColor Green
Set-Location "$scriptDir/examples/commander-x/frontend"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
npm run dev
if ($LASTEXITCODE -ne 0) { throw "npm run dev failed with exit code $LASTEXITCODE" }
