param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 43185
)

$ErrorActionPreference = 'Stop'
$editorUrl = "http://127.0.0.1:$Port/representative-greeting-editor.html"
$serverFile = Join-Path $PSScriptRoot 'serve-editor.ps1'

function Test-EditorReady {
  try {
    $request = [System.Net.HttpWebRequest]::Create($editorUrl)
    $request.Method = 'HEAD'
    $request.Timeout = 700
    $response = $request.GetResponse()
    $status = [int]$response.StatusCode
    $response.Close()
    return $status -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-EditorReady)) {
  Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$serverFile`"",
    '-Port', $Port
  ) | Out-Null

  $ready = $false
  for ($attempt = 0; $attempt -lt 25; $attempt += 1) {
    Start-Sleep -Milliseconds 200
    if (Test-EditorReady) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Error 'Editor server did not become ready.'
    exit 1
  }
}

exit 0
