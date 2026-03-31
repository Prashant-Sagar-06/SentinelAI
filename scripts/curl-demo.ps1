[Diagnostics.CodeAnalysis.SuppressMessageAttribute(
  'PSAvoidUsingPlainTextForPassword',
  '',
  Justification = 'This script uses PSCredential (Get-Credential) and does not accept plaintext password parameters.'
)]
param(
  [string]$BaseUrl = "https://your-backend-url",
  [string]$Email = "demo@soc.local",
  [pscredential]$Credential
)

$ErrorActionPreference = 'Stop'

if (-not $BaseUrl -or $BaseUrl -eq 'https://your-backend-url') {
  throw 'Missing -BaseUrl. Example: ./scripts/curl-demo.ps1 -BaseUrl https://your-backend-url'
}

function Write-Step([string]$msg) {
  Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

Write-Step "Health (no auth)"
curl.exe -sS "$BaseUrl/health" | Out-Host

if (-not $Credential) {
  $Credential = Get-Credential -UserName $Email -Message 'SentinelAI demo user'
}

$Email = $Credential.UserName
$PasswordPlain = $Credential.GetNetworkCredential().Password

Write-Step "Register (idempotent-ish; may 409 if already exists)"
$registerBody = @{ email = $Email; password = $PasswordPlain; role = 'analyst' } | ConvertTo-Json
try {
  curl.exe -sS -X POST "$BaseUrl/api/auth/register" -H "content-type: application/json" -d $registerBody | Out-Host
} catch {
  Write-Host "Register call failed (ok to ignore if user exists)." -ForegroundColor Yellow
}

Write-Step "Login"
$loginBody = @{ email = $Email; password = $PasswordPlain } | ConvertTo-Json
$loginJson = curl.exe -sS -X POST "$BaseUrl/api/auth/login" -H "content-type: application/json" -d $loginBody
$token = ($loginJson | ConvertFrom-Json).token
if (-not $token) { throw "No token returned from login" }
Write-Host "Token acquired (length=$($token.Length))"

Write-Step "Create a log event (requires auth)"
$eventBody = @{
  timestamp = (Get-Date).ToUniversalTime().ToString('o')
  source = 'curl-demo'
  event_type = 'login_attempt'
  status = 'failed'
  actor = @{ user = 'demo' }
  network = @{ ip = '185.23.12.58'; user_agent = 'curl-demo' }
  attributes = @{ attempts = 42 }
  tags = @('demo','curl')
} | ConvertTo-Json -Depth 5
curl.exe -sS -X POST "$BaseUrl/api/logs" -H "content-type: application/json" -H "authorization: Bearer $token" -d $eventBody | Out-Host

Write-Step "System health (requires auth)"
curl.exe -sS "$BaseUrl/api/system-health" -H "authorization: Bearer $token" | Out-Host

Write-Step "Query logs (requires auth)"
curl.exe -sS "$BaseUrl/api/logs?limit=5" -H "authorization: Bearer $token" | Out-Host
