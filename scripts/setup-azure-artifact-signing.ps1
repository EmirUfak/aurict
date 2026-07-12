[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Endpoint,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$SigningAccountName,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$CertificateProfileName
)

$clientToolsRoot = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\ArtifactSigningClientTools'
if (-not (Test-Path -LiteralPath $clientToolsRoot -PathType Container)) {
  throw "Azure Artifact Signing Client Tools were not found at $clientToolsRoot."
}

if (-not $env:RUNNER_TEMP) {
  throw 'RUNNER_TEMP is required to prepare Azure Artifact Signing.'
}

if (-not $env:GITHUB_ENV) {
  throw 'GITHUB_ENV is required to export Azure Artifact Signing paths.'
}

$workspace = Join-Path $env:RUNNER_TEMP "aurict-artifact-signing-$([guid]::NewGuid().ToString('N'))"
if ($workspace -match '\s') {
  throw "Azure Artifact Signing workspace must not contain whitespace: $workspace"
}

New-Item -ItemType Directory -Force -Path $workspace | Out-Null
Copy-Item -Path (Join-Path $clientToolsRoot 'bin\*') -Destination $workspace -Recurse -Force

$dlibs = @(Get-ChildItem -LiteralPath $workspace -Filter 'Azure.CodeSigning.Dlib.dll' -File -Recurse)
if ($dlibs.Count -ne 1) {
  throw "Expected exactly one Azure.CodeSigning.Dlib.dll, found $($dlibs.Count)."
}

$signTools = @(Get-ChildItem -LiteralPath $workspace -Filter 'signtool.exe' -File -Recurse)
if ($signTools.Count -ne 1) {
  throw "Expected exactly one signtool.exe, found $($signTools.Count)."
}

$metadataPath = Join-Path $workspace 'metadata.json'
@{
  Endpoint = $Endpoint
  CodeSigningAccountName = $SigningAccountName
  CertificateProfileName = $CertificateProfileName
} | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding utf8

Add-Content -LiteralPath $env:GITHUB_ENV -Value "AZURE_CODE_SIGNING_DLIB=$($dlibs[0].FullName)"
Add-Content -LiteralPath $env:GITHUB_ENV -Value "AZURE_METADATA_JSON=$metadataPath"
Add-Content -LiteralPath $env:GITHUB_ENV -Value "SIGNTOOL_PATH=$($signTools[0].FullName)"

Write-Host 'Azure Artifact Signing client prepared for Electron Forge.'
