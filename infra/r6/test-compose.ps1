$ErrorActionPreference = 'Stop'
$env:WSL_UTF8 = '1'
$r6Compose = (Join-Path $PSScriptRoot 'compose.yml')
$r6Path = (& wsl.exe -d CampusQuest-Dev --exec wslpath -u $r6Compose).Trim()
$r6Raw = & wsl.exe -d CampusQuest-Dev --exec docker compose -f $r6Path config --format json
if ($LASTEXITCODE -ne 0) { throw 'R6 compose cannot be loaded.' }
$r6Config = ($r6Raw -join "`n") | ConvertFrom-Json
if ($r6Config.name -ne 'campusquest-r6') { throw 'Wrong project' }
$r6Expected = @{postgres=16438; redis=6478; minio=9125; 'minio-e2e'=9126; clamav=3318}
foreach ($r6Service in $r6Config.services.PSObject.Properties) {
    if ($r6Service.Value.container_name -ne "campusquest-r6-$($r6Service.Name)") { throw 'Foreign container' }
    foreach ($r6Port in $r6Service.Value.ports) {
        if ([int]$r6Port.published -ne $r6Expected[$r6Service.Name] -or $r6Port.host_ip -ne '127.0.0.1') { throw 'Foreign port' }
    }
}
foreach ($r6Volume in $r6Config.volumes.PSObject.Properties) {
    if (-not $r6Volume.Value.name.StartsWith('campusquest-r6_')) { throw 'Foreign volume' }
}
if ($r6Config.services.runner.environment.DATABASE_URL -ne 'postgresql+asyncpg://test:test@127.0.0.1:16438/campusquest_test_r6') { throw 'Wrong DB' }
Write-Output 'R6_COMPOSE_CONTRACT=PASS'
