param([ValidateSet('Start', 'Status', 'Stop', 'Check')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$env:WSL_UTF8 = '1'
$integrationRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$integrationResources = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'resources.json') -Raw | ConvertFrom-Json
$integrationOwner = Get-Content -LiteralPath (Join-Path $PSScriptRoot '.runtime/owner.json') -Raw | ConvertFrom-Json
if (-not [string]::Equals([IO.Path]::GetFullPath($integrationOwner.windows_root), $integrationRoot, [StringComparison]::OrdinalIgnoreCase) -or $integrationOwner.id -ne $integrationResources.id) {
    throw 'INTEGRATION source ownership guard rejected this worktree.'
}
$integrationRuntime = Join-Path $PSScriptRoot '.runtime'
$integrationLogs = Join-Path $integrationRuntime 'logs'
New-Item -ItemType Directory -Force -Path $integrationLogs | Out-Null
$integrationLinuxRoot = (& wsl.exe -d CampusQuest-Dev --exec wslpath -u $integrationRoot).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve this worktree in WSL.' }
$integrationCompose = "$integrationLinuxRoot/infra/integration/compose.yml"
$integrationComposeArguments = @('compose', '--env-file', "$integrationLinuxRoot/infra/integration/.runtime/stack.env", '-p', 'campusquest-integration', '-f', $integrationCompose)
$integrationConfigText = & wsl.exe -d CampusQuest-Dev --exec docker @integrationComposeArguments config --format json
if ($LASTEXITCODE -ne 0) { throw 'INTEGRATION compose validation failed; the Docker engine must already be available.' }
$integrationConfig = ($integrationConfigText -join "`n") | ConvertFrom-Json
if ($integrationConfig.name -ne 'campusquest-integration') { throw 'Refusing a different compose project.' }
$integrationAllowedPorts = @(16440, 6480, 9135, 9136, 3320)
foreach ($integrationService in $integrationConfig.services.PSObject.Properties) {
    $integrationDefinition = $integrationService.Value
    if ($integrationDefinition.container_name -ne "campusquest-integration-$($integrationService.Name)") {
        throw 'Container naming escaped INTEGRATION ownership.'
    }
    if ($integrationDefinition.labels.'cq.integration.id' -ne $integrationOwner.id -or $integrationDefinition.labels.'cq.integration.source' -ne $integrationLinuxRoot) {
        throw 'Compose source labels escaped INTEGRATION ownership.'
    }
    foreach ($integrationPort in $integrationDefinition.ports) {
        if ([int]$integrationPort.published -notin $integrationAllowedPorts -or $integrationPort.host_ip -ne '127.0.0.1') {
            throw 'A published port escaped the INTEGRATION allowlist.'
        }
    }
}
foreach ($integrationVolume in $integrationConfig.volumes.PSObject.Properties) {
    if (-not $integrationVolume.Value.name.StartsWith('campusquest-integration_', [StringComparison]::Ordinal)) {
        throw 'A volume escaped INTEGRATION ownership.'
    }
}
$integrationNames = @(& wsl.exe -d CampusQuest-Dev --exec docker ps -a --format '{{.Names}}')
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate container ownership.' }
foreach ($integrationService in $integrationConfig.services.PSObject.Properties) {
    $integrationName = $integrationService.Value.container_name
    if ($integrationName -notin $integrationNames) { continue }
    $integrationProject = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' $integrationName
    if ($LASTEXITCODE -ne 0 -or $integrationProject.Trim() -ne 'campusquest-integration') {
        throw "Refusing unowned container $integrationName."
    }
    $integrationActualOwner = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{index .Config.Labels "cq.integration.id"}}' $integrationName
    if ($LASTEXITCODE -ne 0 -or $integrationActualOwner.Trim() -ne $integrationOwner.id) {
        throw "Refusing different integration owner on $integrationName."
    }
}
if ('campusquest-integration-runner' -in $integrationNames) {
    $integrationMount = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' campusquest-integration-runner
    if ($LASTEXITCODE -ne 0 -or $integrationMount.Trim() -ne $integrationLinuxRoot) {
        throw 'The INTEGRATION runner belongs to another source tree.'
    }
}
if ($Action -eq 'Check') {
    Write-Output 'INTEGRATION_STACK_OWNERSHIP_CHECK=PASS'
    exit 0
}
if ($Action -eq 'Start') {
    $integrationCertificates = Join-Path $integrationRuntime 'minio-certs'
    New-Item -ItemType Directory -Force -Path $integrationCertificates | Out-Null
    if (-not (Test-Path (Join-Path $integrationCertificates 'public.crt')) -or -not (Test-Path (Join-Path $integrationCertificates 'private.key'))) {
        & wsl.exe -d CampusQuest-Dev --exec openssl req -x509 -newkey rsa:2048 -keyout "$integrationLinuxRoot/infra/integration/.runtime/minio-certs/private.key" -out "$integrationLinuxRoot/infra/integration/.runtime/minio-certs/public.crt" -days 365 -nodes -subj /CN=localhost -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' *> (Join-Path $integrationLogs 'certificate.log')
        if ($LASTEXITCODE -ne 0) { throw 'INTEGRATION certificate generation failed.' }
    }
    # Existing runners may be executing tests; Start never recreates them.
    $integrationActionArguments = @('up', '-d', '--no-recreate')
} elseif ($Action -eq 'Stop') {
    # Deliberately no down/remove/volume deletion command exists in this helper.
    $integrationActionArguments = @('stop')
} else {
    $integrationActionArguments = @('ps', '-a')
}
$integrationLog = Join-Path $integrationLogs ("stack-{0}-{1}.log" -f $Action.ToLowerInvariant(), [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss'))
& wsl.exe -d CampusQuest-Dev --exec docker @integrationComposeArguments @integrationActionArguments *> $integrationLog
$integrationExit = $LASTEXITCODE
Get-Content -LiteralPath $integrationLog
Write-Output "INTEGRATION_STACK_EXIT=$integrationExit LOG=$integrationLog"
exit $integrationExit
