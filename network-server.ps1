$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5501
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$listener.Start()

Write-Host "Serving $root on the local network at http://0.0.0.0:$port/"

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

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()

    while ($reader.ReadLine()) {}

    $requestPath = "index.html"
    if ($requestLine -match "^[A-Z]+\s+([^\s]+)") {
      $requestPath = [Uri]::UnescapeDataString($matches[1].TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }
    }

    $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $requestPath))
    $rootPath = [System.IO.Path]::GetFullPath($root)

    if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($fullPath)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
    } else {
      $body = [System.IO.File]::ReadAllBytes($fullPath)
      $contentType = Get-ContentType $fullPath
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
    }
  } finally {
    $client.Close()
  }
}
