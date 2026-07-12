[CmdletBinding()]
param()

if (-not $env:RUNNER_TEMP) {
  throw 'RUNNER_TEMP is required to prepare a self-signed Windows certificate.'
}

if (-not $env:GITHUB_ENV) {
  throw 'GITHUB_ENV is required to export self-signed Windows certificate paths.'
}

$certificatePath = Join-Path $env:RUNNER_TEMP 'hoprel-beta.pfx'
$passwordBytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($passwordBytes)
$random.Dispose()
$password = [Convert]::ToHexString($passwordBytes)
$securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force

$certificate = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject 'CN=Hoprel by Aurict Beta' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears(1)

Export-PfxCertificate `
  -Cert "Cert:\CurrentUser\My\$($certificate.Thumbprint)" `
  -FilePath $certificatePath `
  -Password $securePassword | Out-Null

if (-not (Test-Path -LiteralPath $certificatePath -PathType Leaf)) {
  throw 'Self-signed Windows certificate export failed.'
}

Add-Content -LiteralPath $env:GITHUB_ENV -Value "WINDOWS_CERTIFICATE_FILE=$certificatePath"
Add-Content -LiteralPath $env:GITHUB_ENV -Value "WINDOWS_CERTIFICATE_PASSWORD=$password"
Add-Content -LiteralPath $env:GITHUB_ENV -Value "WINDOWS_CERTIFICATE_THUMBPRINT=$($certificate.Thumbprint)"

Write-Host 'Ephemeral self-signed Windows certificate prepared for this beta build.'
