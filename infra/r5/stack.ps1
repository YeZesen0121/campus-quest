param([ValidateSet('Start', 'Status', 'Stop', 'Check')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$env:WSL_UTF8 = '1'
$r5Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$r5Runtime = Join-Path $PSScriptRoot '.runtime'
$r5Logs = Join-Path $r5Runtime 'logs'
New-Item -ItemType Directory -Force -Path $r5Logs | Out-Null
$r5LinuxRoot = (& wsl.exe -d CampusQuest-Dev --exec wslpath -u $r5Root).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve this worktree in WSL.' }
$r5Compose = "$r5LinuxRoot/infra/r5/compose.yml"
$r5ComposeArguments = @('compose', '-p', 'campusquest-r5', '-f', $r5Compose)
$r5ConfigText = & wsl.exe -d CampusQuest-Dev --exec docker @r5ComposeArguments config --format json
if ($LASTEXITCODE -ne 0) { throw 'R5 compose validation failed; the Docker engine must already be available.' }
$r5Config = ($r5ConfigText -join "`n") | ConvertFrom-Json
if ($r5Config.name -ne 'campusquest-r5') { throw 'Refusing a different compose project.' }
$r5AllowedPorts = @(16435, 6475, 9105, 9106, 3315)
foreach ($r5Service in $r5Config.services.PSObject.Properties) {
    $r5Definition = $r5Service.Value
    if ($r5Definition.container_name -ne "campusquest-r5-$($r5Service.Name)") {
        throw 'Container naming escaped R5 ownership.'
    }
    foreach ($r5Port in $r5Definition.ports) {
        if ([int]$r5Port.published -notin $r5AllowedPorts -or $r5Port.host_ip -ne '127.0.0.1') {
            throw 'A published port escaped the R5 allowlist.'
        }
    }
}
foreach ($r5Volume in $r5Config.volumes.PSObject.Properties) {
    if (-not $r5Volume.Value.name.StartsWith('campusquest-r5_', [StringComparison]::Ordinal)) {
        throw 'A volume escaped R5 ownership.'
    }
}
$r5Names = @(& wsl.exe -d CampusQuest-Dev --exec docker ps -a --format '{{.Names}}')
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate container ownership.' }
foreach ($r5Service in $r5Config.services.PSObject.Properties) {
    $r5Name = $r5Service.Value.container_name
    if ($r5Name -notin $r5Names) { continue }
    $r5Project = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' $r5Name
    if ($LASTEXITCODE -ne 0 -or $r5Project.Trim() -ne 'campusquest-r5') {
        throw "Refusing unowned container $r5Name."
    }
}
if ('campusquest-r5-runner' -in $r5Names) {
    $r5Mount = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' campusquest-r5-runner
    if ($LASTEXITCODE -ne 0 -or $r5Mount.Trim() -ne $r5LinuxRoot) {
        throw 'The R5 runner belongs to another source tree.'
    }
}
if ($Action -eq 'Check') {
    Write-Output 'R5_STACK_OWNERSHIP_CHECK=PASS'
    exit 0
}
if ($Action -eq 'Start') {
    $r5Certificates = Join-Path $r5Runtime 'minio-certs'
    New-Item -ItemType Directory -Force -Path $r5Certificates | Out-Null
    if (-not (Test-Path (Join-Path $r5Certificates 'public.crt')) -or -not (Test-Path (Join-Path $r5Certificates 'private.key'))) {
        & wsl.exe -d CampusQuest-Dev --exec openssl req -x509 -newkey rsa:2048 -keyout "$r5LinuxRoot/infra/r5/.runtime/minio-certs/private.key" -out "$r5LinuxRoot/infra/r5/.runtime/minio-certs/public.crt" -days 365 -nodes -subj /CN=localhost -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' *> (Join-Path $r5Logs 'certificate.log')
        if ($LASTEXITCODE -ne 0) { throw 'R5 certificate generation failed.' }
    }
    # Existing runners may be executing tests; Start never recreates them.
    $r5ActionArguments = @('up', '-d', '--no-recreate')
} elseif ($Action -eq 'Stop') {
    # Deliberately no down/remove/volume deletion command exists in this helper.
    $r5ActionArguments = @('stop')
} else {
    $r5ActionArguments = @('ps', '-a')
}
$r5Log = Join-Path $r5Logs ("stack-{0}-{1}.log" -f $Action.ToLowerInvariant(), [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss'))
& wsl.exe -d CampusQuest-Dev --exec docker @r5ComposeArguments @r5ActionArguments *> $r5Log
$r5Exit = $LASTEXITCODE
Get-Content -LiteralPath $r5Log
Write-Output "R5_STACK_EXIT=$r5Exit LOG=$r5Log"
exit $r5Exit
