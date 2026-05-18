$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

# Generate secure random API key for local devops agent authentication
$apiKey = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Write API key to .env files to secure endpoints and prevent unauthorized session issuance
"VITE_CORAL_API_KEY=$apiKey" | Out-File -FilePath "$scriptDir/examples/commander-x/frontend/.env" -Encoding utf8
"CORAL_API_KEY=$apiKey" | Out-File -FilePath "$scriptDir/examples/commander-x/backend/.env" -Encoding utf8

# Detect the current PowerShell executable (works for both powershell.exe and pwsh)
$psExe = (Get-Process -Id $PID).Path

# Start Backend (in a separate window with robust path-escaping for apostrophes/spaces)
Write-Host "Starting Backend..." -ForegroundColor Cyan
Start-Process $psExe -ArgumentList "-NoExit", "-Command", "`$ErrorActionPreference='Stop'; Set-Location `"$scriptDir/examples/commander-x/backend`"; pip install -r requirements.txt; if (`$LASTEXITCODE -ne 0) { throw 'pip install failed' }; python main.py; if (`$LASTEXITCODE -ne 0) { throw 'Backend failed to start' }"

# Wait for backend to become healthy before starting frontend
Write-Host "Waiting for backend to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
        if ($response.status -eq "ok") {
            Write-Host "Backend is healthy." -ForegroundColor Green
            break
        }
    } catch {
        # Backend not ready yet
    }
    $attempt++
    Start-Sleep -Seconds 1
}
if ($attempt -ge $maxAttempts) {
    Write-Host "WARNING: Backend did not respond within ${maxAttempts}s. Starting frontend anyway." -ForegroundColor Red
}

# Start Frontend (with exit-code checks and proper directory setting)
Write-Host "Starting Frontend..." -ForegroundColor Green
Set-Location "$scriptDir/examples/commander-x/frontend"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
npm run dev
if ($LASTEXITCODE -ne 0) { throw "npm run dev failed with exit code $LASTEXITCODE" }
