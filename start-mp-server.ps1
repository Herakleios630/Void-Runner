param(
  [int]$Port = 8080,
  [switch]$NoInstall,
  [switch]$StrictPort
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $repoRoot "server"
$packageJson = Join-Path $serverDir "package.json"

if (-not (Test-Path $packageJson)) {
  throw "Konnte server/package.json nicht finden. Starte das Skript aus dem Projekt-Root."
}

function Test-PortAvailable {
  param([int]$CandidatePort)

  try {
    $inUse = Get-NetTCPConnection -State Listen -LocalPort $CandidatePort -ErrorAction SilentlyContinue
    return -not [bool]$inUse
  } catch {
    try {
      $netstat = netstat -ano -p tcp | Select-String -Pattern ":$CandidatePort\s"
      return -not [bool]$netstat
    } catch {
      return $false
    }
  }
}

function Resolve-ServerPort {
  param(
    [int]$PreferredPort,
    [bool]$RequireExactPort
  )

  if ($RequireExactPort) {
    if (-not (Test-PortAvailable -CandidatePort $PreferredPort)) {
      throw "Port $PreferredPort ist bereits belegt. Nutze -Port <frei> oder lasse -StrictPort weg."
    }
    return $PreferredPort
  }

  if (Test-PortAvailable -CandidatePort $PreferredPort) {
    return $PreferredPort
  }

  $maxTries = 20
  for ($i = 1; $i -le $maxTries; $i++) {
    $next = $PreferredPort + $i
    if (Test-PortAvailable -CandidatePort $next) {
      Write-Host "Port $PreferredPort ist belegt, weiche auf Port $next aus."
      return $next
    }
  }

  throw "Kein freier Port in Bereich $PreferredPort-$($PreferredPort + $maxTries) gefunden."
}

function Resolve-NodeExe {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
    return $cmd.Source
  }

  $candidates = @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path $env:LocalAppData "Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.14.1-win-x64\node.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $wingetNode = Get-ChildItem -Path (Join-Path $env:LocalAppData "Microsoft\WinGet\Packages") -Filter "*NodeJS*" -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ChildItem -Path $_.FullName -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue } |
    Select-Object -First 1 -ExpandProperty FullName

  if ($wingetNode -and (Test-Path $wingetNode)) {
    return $wingetNode
  }

  return $null
}

$nodeExe = Resolve-NodeExe
if (-not $nodeExe) {
  throw "Node.js wurde nicht gefunden. Bitte zuerst Node LTS installieren."
}

$resolvedPort = Resolve-ServerPort -PreferredPort $Port -RequireExactPort $StrictPort.IsPresent

$nodeDir = Split-Path -Parent $nodeExe
$env:Path = "$nodeDir;$env:Path"
$npmCmd = Join-Path $nodeDir "npm.cmd"

if (-not (Test-Path $npmCmd)) {
  $npmResolve = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmResolve -and $npmResolve.Source) {
    $npmCmd = $npmResolve.Source
  }
}

$wsPackage = Join-Path $serverDir "node_modules\ws\package.json"
if (-not $NoInstall -and -not (Test-Path $wsPackage)) {
  if (-not (Test-Path $npmCmd)) {
    throw "npm.cmd wurde nicht gefunden. Bitte npm in PATH aufnehmen oder npm manuell ausfuehren."
  }

  Write-Host "Installiere Multiplayer-Server-Abhaengigkeiten..."
  Push-Location $serverDir
  try {
    & $npmCmd install --no-fund --no-audit
  } finally {
    Pop-Location
  }
}

Write-Host "Starte Multiplayer-Server auf Port $resolvedPort ..."
Push-Location $serverDir
try {
  $env:PORT = "$resolvedPort"
  & $nodeExe "server.js"
} finally {
  Pop-Location
}
