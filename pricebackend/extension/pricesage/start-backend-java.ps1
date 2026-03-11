$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendJavaDir = Join-Path $projectRoot "backend-java"

if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
  Write-Error "Maven (mvn) is not installed or not on PATH. Install Maven 3.9+ and retry."
  exit 1
}

Set-Location $backendJavaDir
Write-Output "Starting Java backend on http://localhost:5000 ..."
mvn spring-boot:run
