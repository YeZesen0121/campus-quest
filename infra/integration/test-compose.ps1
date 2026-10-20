$ErrorActionPreference = 'Stop'
$env:WSL_UTF8 = '1'
$integrationCompose = (Join-Path $PSScriptRoot 'compose.yml')
$integrationPath = (& wsl.exe -d CampusQuest-Dev --exec wslpath -u $integrationCompose).Trim()
$integrationEnvPath = (& wsl.exe -d CampusQuest-Dev --exec wslpath -u (Join-Path $PSScriptRoot '.runtime/stack.env')).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve private runtime env.' }
$integrationRaw = & wsl.exe -d CampusQuest-Dev --exec docker compose --env-file $integrationEnvPath -f $integrationPath config --format json
if ($LASTEXITCODE -ne 0) { throw 'INTEGRATION compose cannot be loaded.' }
$integrationConfig = ($integrationRaw -join "`n") | ConvertFrom-Json
if ($integrationConfig.name -ne 'campusquest-integration') { throw 'Wrong project' }
$integrationExpected = @{postgres=16440; redis=6480; minio=9135; 'minio-e2e'=9136; clamav=3320}
foreach ($integrationService in $integrationConfig.services.PSObject.Properties) {
    if ($integrationService.Value.container_name -ne "campusquest-integration-$($integrationService.Name)") { throw 'Foreign container' }
    foreach ($integrationPort in $integrationService.Value.ports) {
        if ([int]$integrationPort.published -ne $integrationExpected[$integrationService.Name] -or $integrationPort.host_ip -ne '127.0.0.1') { throw 'Foreign port' }
    }
}
foreach ($integrationVolume in $integrationConfig.volumes.PSObject.Properties) {
    if (-not $integrationVolume.Value.name.StartsWith('campusquest-integration_')) { throw 'Foreign volume' }
}
$integrationDb = [Uri]$integrationConfig.services.runner.environment.DATABASE_URL
if ($integrationDb.Scheme -ne 'postgresql+asyncpg' -or $integrationDb.Host -ne '127.0.0.1' -or $integrationDb.Port -ne 16440 -or $integrationDb.AbsolutePath -ne '/campusquest_test_integration' -or $integrationDb.UserInfo -notlike 'test:?*') { throw 'Wrong DB target or missing private credentials' }
Write-Output 'INTEGRATION_COMPOSE_CONTRACT=PASS'
