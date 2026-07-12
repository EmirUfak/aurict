[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string[]]$Path,

  [ValidateSet('trusted', 'self-signed')]
  [string]$Mode = 'trusted',

  [string]$ExpectedCertificateThumbprint
)

if ($Mode -eq 'trusted') {
  if (-not $env:SIGNTOOL_PATH) {
    throw 'SIGNTOOL_PATH is required to verify Windows signatures.'
  }

  if (-not (Test-Path -LiteralPath $env:SIGNTOOL_PATH -PathType Leaf)) {
    throw "SignTool was not found at $env:SIGNTOOL_PATH."
  }
} elseif (-not $ExpectedCertificateThumbprint) {
  throw 'ExpectedCertificateThumbprint is required for self-signed verification.'
}

$files = @(
  $Path | ForEach-Object {
    if (-not (Test-Path -LiteralPath $_ -PathType Container)) {
      throw "Signature verification directory does not exist: $_"
    }

    Get-ChildItem -LiteralPath $_ -Filter '*.exe' -File -Recurse
  }
)

if ($files.Count -eq 0) {
  throw 'No Windows executables were found to verify.'
}

foreach ($file in $files) {
  if ($Mode -eq 'trusted') {
    Write-Host "Verifying trusted signature: $($file.FullName)"
    & $env:SIGNTOOL_PATH verify /pa /all /v $file.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "Signature verification failed: $($file.FullName)"
    }
    continue
  }

  $signature = Get-AuthenticodeSignature -FilePath $file.FullName
  if (-not $signature.SignerCertificate) {
    throw "Self-signed signature is missing: $($file.FullName)"
  }

  if ($signature.SignerCertificate.Thumbprint -ne $ExpectedCertificateThumbprint) {
    throw "Self-signed certificate does not match the beta certificate: $($file.FullName)"
  }

  Write-Host "Verified self-signed beta certificate: $($file.FullName)"
}
