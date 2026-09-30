param(
    [string]$Domain = 'thermosync.com.br'
)

$ErrorActionPreference = 'Stop'
$certificateAuthorityName = 'TermoSync Local Development CA'
$projectRoot = Split-Path -Parent $PSScriptRoot
$certificateDirectory = Join-Path $projectRoot 'frontend\.cert'
$pfxPath = Join-Path $certificateDirectory 'thermosync.pfx'
$passwordPath = Join-Path $certificateDirectory 'passphrase'

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-Administrator {
    $arguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"{0}"' -f $PSCommandPath),
        '-Domain', ('"{0}"' -f $Domain)
    )

    $process = Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -Wait -PassThru
    exit $process.ExitCode
}

if (-not (Test-IsAdministrator)) {
    Write-Host 'Solicitando permissao de administrador para configurar o dominio local...'
    Request-Administrator
}

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$entry = "127.0.0.1`t$Domain"
$escapedDomain = [Regex]::Escape($Domain)
$domainPattern = "^\s*(?:127\.0\.0\.1|::1)\s+$escapedDomain(?:\s|$)"
$existingLines = Get-Content -LiteralPath $hostsPath -ErrorAction Stop

if ($existingLines -notmatch $domainPattern) {
    Add-Content -LiteralPath $hostsPath -Value $entry -Encoding Ascii
    Write-Host "Dominio $Domain registrado no Windows."
} else {
    Write-Host "Dominio $Domain ja estava registrado."
}

Clear-DnsClientCache

# Reutiliza a configuracao existente quando o PFX e a raiz publica continuam validos.
if ((Test-Path -LiteralPath $pfxPath) -and (Test-Path -LiteralPath $passwordPath)) {
    try {
        $existingPassword = ConvertTo-SecureString `
            -String (Get-Content -LiteralPath $passwordPath -Raw) `
            -AsPlainText `
            -Force
        $existingPfx = Get-PfxData -FilePath $pfxPath -Password $existingPassword
        $existingServer = $existingPfx.EndEntityCertificates | Select-Object -First 1
        $existingRoot = $existingPfx.OtherCertificates |
            Where-Object { $_.Subject -eq "CN=$certificateAuthorityName" } |
            Select-Object -First 1
        $trustedRoot = if ($existingRoot) {
            Get-ChildItem Cert:\LocalMachine\Root |
                Where-Object { $_.Thumbprint -eq $existingRoot.Thumbprint } |
                Select-Object -First 1
        }
        $domainMatches = $existingServer.DnsNameList.Unicode -contains $Domain

        if ($domainMatches -and $existingServer.NotAfter -gt (Get-Date).AddDays(30) -and $trustedRoot) {
            Write-Host "HTTPS confiavel ja esta configurado. Acesse https://${Domain}"
            exit 0
        }
    } catch {
        Write-Host 'O certificado existente esta invalido e sera recriado.'
    }
}

# Cria uma autoridade local e um certificado TLS exclusivo para o dominio.
$rootCertificate = Get-ChildItem Cert:\LocalMachine\My |
    Where-Object { $_.Subject -eq "CN=$certificateAuthorityName" -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if (-not $rootCertificate) {
    $rootCertificate = New-SelfSignedCertificate `
        -Type Custom `
        -Subject "CN=$certificateAuthorityName" `
        -FriendlyName $certificateAuthorityName `
        -CertStoreLocation 'Cert:\LocalMachine\My' `
        -KeyAlgorithm RSA `
        -KeyLength 4096 `
        -HashAlgorithm SHA256 `
        -KeyExportPolicy NonExportable `
        -KeyUsage CertSign, CRLSign, DigitalSignature `
        -KeyUsageProperty Sign `
        -TextExtension @('2.5.29.19={critical}{text}ca=true&pathlength=0') `
        -NotAfter (Get-Date).AddYears(10)
}

$serverCertificate = Get-ChildItem Cert:\LocalMachine\My |
    Where-Object {
        $_.Subject -eq "CN=$Domain" -and
        $_.Issuer -eq $rootCertificate.Subject -and
        $_.EnhancedKeyUsageList.ObjectId.Value -contains '1.3.6.1.5.5.7.3.1' -and
        $_.EnhancedKeyUsageList.ObjectId.Value -notcontains '1.3.6.1.5.5.7.3.2' -and
        $_.NotAfter -gt (Get-Date).AddDays(30)
    } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if (-not $serverCertificate) {
    $serverCertificate = New-SelfSignedCertificate `
        -DnsName $Domain `
        -Subject "CN=$Domain" `
        -FriendlyName "TermoSync HTTPS - $Domain" `
        -Signer $rootCertificate `
        -CertStoreLocation 'Cert:\LocalMachine\My' `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -KeyExportPolicy Exportable `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -Type Custom `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.1') `
        -NotAfter (Get-Date).AddYears(3)
}

New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null
$temporaryRootPath = Join-Path $certificateDirectory 'termosync-root.cer'
Export-Certificate -Cert $rootCertificate -FilePath $temporaryRootPath -Force | Out-Null

$trustedRoot = Get-ChildItem Cert:\LocalMachine\Root |
    Where-Object { $_.Thumbprint -eq $rootCertificate.Thumbprint } |
    Select-Object -First 1

if (-not $trustedRoot) {
    Import-Certificate -FilePath $temporaryRootPath -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
}

$password = ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))
$securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force
Export-PfxCertificate -Cert $serverCertificate -FilePath $pfxPath -Password $securePassword -Force | Out-Null
Set-Content -LiteralPath $passwordPath -Value $password -Encoding Ascii -NoNewline
Remove-Item -LiteralPath $temporaryRootPath -Force

# O Vite usa o PFX; as chaves temporarias nao precisam permanecer no store pessoal.
$temporaryThumbprints = @(
    $serverCertificate.Thumbprint
    $rootCertificate.Thumbprint
)

foreach ($thumbprint in $temporaryThumbprints) {
    & certutil.exe -delstore My $thumbprint | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Nao foi possivel remover a credencial temporaria $thumbprint."
    }
}

Write-Host "HTTPS confiavel configurado. Acesse https://${Domain}"
