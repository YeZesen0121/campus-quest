param([ValidateSet('Start', 'Status', 'Stop', 'Check')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$env:WSL_UTF8 = '1'
$r6Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$r6Runtime = Join-Path $PSScriptRoot '.runtime'
$r6Logs = Join-Path $r6Runtime 'logs'
New-Item -ItemType Directory -Force -Path $r6Logs | Out-Null
$r6LinuxRoot = (& wsl.exe -d CampusQuest-Dev --exec wslpath -u $r6Root).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve this worktree in WSL.' }
$r6Compose = "$r6LinuxRoot/infra/r6/compose.yml"
$r6ComposeArguments = @('compose', '-p', 'campusquest-r6', '-f', $r6Compose)
$r6ConfigText = & wsl.exe -d CampusQuest-Dev --exec docker @r6ComposeArguments config --format json
if ($LASTEXITCODE -ne 0) { throw 'R6 compose validation failed; the Docker engine must already be available.' }
$r6Config = ($r6ConfigText -join "`n") | ConvertFrom-Json
if ($r6Config.name -ne 'campusquest-r6') { throw 'Refusing a different compose project.' }
$r6AllowedPorts = @(16438, 6478, 9125, 9126, 3318)
foreach ($r6Service in $r6Config.services.PSObject.Properties) {
    $r6Definition = $r6Service.Value
    if ($r6Definition.container_name -ne "campusquest-r6-$($r6Service.Name)") {
        throw 'Container naming escaped R6 ownership.'
    }
    foreach ($r6Port in $r6Definition.ports) {
        if ([int]$r6Port.published -notin $r6AllowedPorts -or $r6Port.host_ip -ne '127.0.0.1') {
            throw 'A published port escaped the R6 allowlist.'
        }
    }
}
foreach ($r6Volume in $r6Config.volumes.PSObject.Properties) {
    if (-not $r6Volume.Value.name.StartsWith('campusquest-r6_', [StringComparison]::Ordinal)) {
        throw 'A volume escaped R6 ownership.'
    }
}
$r6Names = @(& wsl.exe -d CampusQuest-Dev --exec docker ps -a --format '{{.Names}}')
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate container ownership.' }
foreach ($r6Service in $r6Config.services.PSObject.Properties) {
    $r6Name = $r6Service.Value.container_name
    if ($r6Name -notin $r6Names) { continue }
    $r6Project = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' $r6Name
    if ($LASTEXITCODE -ne 0 -or $r6Project.Trim() -ne 'campusquest-r6') {
        throw "Refusing unowned container $r6Name."
    }
}
if ('campusquest-r6-runner' -in $r6Names) {
    $r6Mount = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' campusquest-r6-runner
    if ($LASTEXITCODE -ne 0 -or $r6Mount.Trim() -ne $r6LinuxRoot) {
        throw 'The R6 runner belongs to another source tree.'
    }
}
if ($Action -eq 'Check') {
    Write-Output 'R6_STACK_OWNERSHIP_CHECK=PASS'
    exit 0
}
if ($Action -eq 'Start') {
    $r6Certificates = Join-Path $r6Runtime 'minio-certs'
    New-Item -ItemType Directory -Force -Path $r6Certificates | Out-Null
    if (-not (Test-Path (Join-Path $r6Certificates 'public.crt')) -or -not (Test-Path (Join-Path $r6Certificates 'private.key'))) {
        & wsl.exe -d CampusQuest-Dev --exec openssl req -x509 -newkey rsa:2048 -keyout "$r6LinuxRoot/infra/r6/.runtime/minio-certs/private.key" -out "$r6LinuxRoot/infra/r6/.runtime/minio-certs/public.crt" -days 365 -nodes -subj /CN=localhost -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' *> (Join-Path $r6Logs 'certificate.log')
        if ($LASTEXITCODE -ne 0) { throw 'R6 certificate generation failed.' }
    }
    # Existing runners may be executing tests; Start never recreates them.
    $r6ActionArguments = @('up', '-d', '--no-recreate')
} elseif ($Action -eq 'Stop') {
    # Deliberately no down/remove/volume deletion command exists in this helper.
    $r6ActionArguments = @('stop')
} else {
    $r6ActionArguments = @('ps', '-a')
}
$r6Log = Join-Path $r6Logs ("stack-{0}-{1}.log" -f $Action.ToLowerInvariant(), [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss'))
& wsl.exe -d CampusQuest-Dev --exec docker @r6ComposeArguments @r6ActionArguments *> $r6Log
$r6Exit = $LASTEXITCODE
Get-Content -LiteralPath $r6Log
Write-Output "R6_STACK_EXIT=$r6Exit LOG=$r6Log"
exit $r6Exit
