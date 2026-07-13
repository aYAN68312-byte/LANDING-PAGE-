$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5500
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://+:5500/")
$listener.Start()

Write-Host "Serving $root at http://localhost:$port/"

function Get-ContentType($path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css" { "text/css; charset=utf-8"; break }
    ".js" { "application/javascript; charset=utf-8"; break }
    ".png" { "image/png"; break }
    ".jpg" { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".svg" { "image/svg+xml"; break }
    default { "application/octet-stream" }
  }
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))

    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $requestPath))
    $rootPath = [System.IO.Path]::GetFullPath($root)

    if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($fullPath)) {
      $context.Response.StatusCode = 404
      $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
    } else {
      $context.Response.StatusCode = 200
      $context.Response.ContentType = Get-ContentType $fullPath
      $buffer = [System.IO.File]::ReadAllBytes($fullPath)
    }

    $context.Response.ContentLength64 = $buffer.Length
    $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $context.Response.OutputStream.Close()
  } catch {
    if ($context -and $context.Response) {
      $context.Response.StatusCode = 500
      $context.Response.OutputStream.Close()
    }
  }
}
