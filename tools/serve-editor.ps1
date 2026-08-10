param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 43185
)

$ErrorActionPreference = 'Stop'
$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\outputs'))
$defaultFile = 'representative-greeting-editor.html'
$prefix = "http://127.0.0.1:$Port/"
$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.svg' = 'image/svg+xml; charset=utf-8'
  '.ico' = 'image/x-icon'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = $defaultFile
      }

      $candidate = [System.IO.Path]::GetFullPath((Join-Path $outputRoot $relativePath))
      $insideRoot = $candidate.Equals($outputRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        $candidate.StartsWith($outputRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)

      if (-not $insideRoot -or -not [System.IO.File]::Exists($candidate)) {
        $context.Response.StatusCode = 404
        $payload = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      } else {
        $context.Response.StatusCode = 200
        $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
        $context.Response.ContentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
        $context.Response.Headers['Cache-Control'] = 'no-store'
        $payload = if ($context.Request.HttpMethod -eq 'HEAD') { [byte[]]::new(0) } else { [System.IO.File]::ReadAllBytes($candidate) }
      }

      $context.Response.ContentLength64 = $payload.Length
      if ($payload.Length -gt 0) {
        $context.Response.OutputStream.Write($payload, 0, $payload.Length)
      }
    } catch {
      $context.Response.StatusCode = 500
    } finally {
      $context.Response.OutputStream.Close()
    }
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
