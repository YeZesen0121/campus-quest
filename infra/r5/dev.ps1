param([ValidateSet('Check', 'Prepare', 'Status', 'Verify', 'Seed', 'Start', 'Stop')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$env:WSL_UTF8 = '1'
$r5DevRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$r5DevRuntime = Join-Path $PSScriptRoot '.runtime'
$r5DevLogs = Join-Path $r5DevRuntime 'dev-logs'
New-Item -ItemType Directory -Force -Path $r5DevLogs | Out-Null
$r5DevLinuxRoot = (& wsl.exe -d CampusQuest-Dev --exec wslpath -u $r5DevRoot).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the R5 worktree path.' }
$r5DevEnv = Join-Path $r5DevRuntime 'dev.env'
$r5DevState = Join-Path $r5DevRuntime 'dev-ready.json'
$r5DevCompose = @('compose', '-p', 'campusquest-r5-dev', '-f', "$r5DevLinuxRoot/infra/r5/dev-compose.yml")
if (Test-Path -LiteralPath $r5DevEnv) { $r5DevCompose += @('--env-file', "$r5DevLinuxRoot/infra/r5/.runtime/dev.env") }

function Invoke-R5DevDocker([string]$Label, [string[]]$DockerArguments) {
    $r5DevLog = Join-Path $r5DevLogs ("{0}-{1}-{2}.log" -f [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss'), $Label, [Guid]::NewGuid().ToString('N').Substring(0,6))
    & wsl.exe -d CampusQuest-Dev --exec docker @DockerArguments *> $r5DevLog
    $r5DevExit = $LASTEXITCODE
    Get-Content -LiteralPath $r5DevLog
    Write-Output "R5_DEV_EXIT=$r5DevExit LOG=$r5DevLog"
    if ($r5DevExit -ne 0) { throw "R5 dev $Label failed; see the complete log." }
}

function Test-R5DevOwnership {
    $r5DevJson = & wsl.exe -d CampusQuest-Dev --exec docker @r5DevCompose --profile application config --format json
    if ($LASTEXITCODE -ne 0) { throw 'R5 dev compose configuration is invalid.' }
    $r5DevConfig = ($r5DevJson -join "`n") | ConvertFrom-Json
    if ($r5DevConfig.name -ne 'campusquest-r5-dev') { throw 'Unexpected dev project name.' }
    $r5DevNames = @(& wsl.exe -d CampusQuest-Dev --exec docker ps -a --format '{{.Names}}')
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker ownership.' }
    foreach ($r5DevService in $r5DevConfig.services.PSObject.Properties) {
        $r5DevName = "campusquest-r5-dev-$($r5DevService.Name)"
        if ($r5DevService.Value.container_name -ne $r5DevName) { throw 'Dev container name escaped its project.' }
        foreach ($r5DevPort in $r5DevService.Value.ports) {
            if ([int]$r5DevPort.published -notin @(16436,6476,9107) -or $r5DevPort.host_ip -ne '127.0.0.1') {
                throw 'Dev dependency port escaped the loopback allowlist.'
            }
        }
        if ($r5DevName -in $r5DevNames) {
            $r5DevProject = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' $r5DevName
            if ($LASTEXITCODE -ne 0 -or $r5DevProject.Trim() -ne 'campusquest-r5-dev') { throw "Refusing unowned container $r5DevName." }
        }
    }
    foreach ($r5DevVolume in $r5DevConfig.volumes.PSObject.Properties) {
        if (-not $r5DevVolume.Value.name.StartsWith('campusquest-r5-dev_', [StringComparison]::Ordinal)) { throw 'Dev volume escaped its project.' }
    }
    foreach ($r5DevServiceName in @('runner','api','web')) {
        $r5DevSource = @($r5DevConfig.services.$r5DevServiceName.volumes | Where-Object { $_.target -eq '/workspace' })[0].source
        if (-not $r5DevSource.StartsWith("$r5DevLinuxRoot/infra/r5/.runtime/dev-source", [StringComparison]::Ordinal)) { throw 'Dev source is not a private snapshot.' }
    }
    Write-Output 'R5_DEV_OWNERSHIP_CHECK=PASS'
}

function Test-R5DevPorts([hashtable]$Ports) {
    $r5DevSockets = @(& wsl.exe -d CampusQuest-Dev --exec cat /proc/net/tcp /proc/net/tcp6)
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect WSL listeners.' }
    $r5DevListeners = @($r5DevSockets | ForEach-Object {
        $r5DevFields = $_.Trim() -split '\s+'
        if ($r5DevFields.Count -gt 3 -and $r5DevFields[3] -eq '0A') {
            [Convert]::ToInt32(($r5DevFields[1] -split ':')[-1],16)
        }
    })
    foreach ($r5DevPort in $Ports.Keys) {
        $r5DevName = $Ports[$r5DevPort]
        $r5DevRunning = & wsl.exe -d CampusQuest-Dev --exec docker ps --filter "name=^/$r5DevName$" --format '{{.Names}}'
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect dev services.' }
        if ($r5DevRunning -eq $r5DevName) { continue }
        $r5DevWindows = @(Get-NetTCPConnection -State Listen -LocalPort $r5DevPort -ErrorAction SilentlyContinue)
        if ($r5DevWindows.Count -gt 0 -or [int]$r5DevPort -in $r5DevListeners) {
            throw "Dev port $r5DevPort is occupied by another process."
        }
    }
    Write-Output 'R5_DEV_PORT_CHECK=PASS'
}

$r5DevMutex = [Threading.Mutex]::new($false, 'Local\CampusQuestR5DevEnvironment')
if (-not $r5DevMutex.WaitOne(0)) {
    $r5DevMutex.Dispose()
    throw 'Another R5 dev preparation/control command is active.'
}
try {
Test-R5DevOwnership
if ($Action -eq 'Check') { exit 0 }
if ($Action -eq 'Prepare') {
    $r5DevActiveApps = @(& wsl.exe -d CampusQuest-Dev --exec docker ps --filter 'label=com.docker.compose.project=campusquest-r5-dev' --format '{{.Names}}') | Where-Object { $_ -in @('campusquest-r5-dev-api','campusquest-r5-dev-web') }
    if ($r5DevActiveApps) { throw 'Stop this dev API/Web before preparing a new snapshot; test services are independent.' }
    Test-R5DevPorts @{16436='campusquest-r5-dev-postgres';6476='campusquest-r5-dev-redis';9107='campusquest-r5-dev-minio';3306='campusquest-r5-dev-web';8306='campusquest-r5-dev-api'}
    if (Test-Path -LiteralPath $r5DevState) { Remove-Item -LiteralPath $r5DevState }
    $r5DevSnapshotName = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6)
    $r5DevSnapshot = Join-Path $r5DevRuntime "dev-sources/$r5DevSnapshotName"
    New-Item -ItemType Directory -Force -Path $r5DevSnapshot | Out-Null
    $r5DevGit = [Diagnostics.ProcessStartInfo]::new()
    $r5DevGit.FileName = (Get-Command git.exe).Source
    $r5DevGit.Arguments = 'ls-files -co --exclude-standard -z'
    $r5DevGit.WorkingDirectory = $r5DevRoot
    $r5DevGit.UseShellExecute = $false
    $r5DevGit.CreateNoWindow = $true
    $r5DevGit.RedirectStandardOutput = $true
    $r5DevGit.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $r5DevGit.EnvironmentVariables['GIT_OPTIONAL_LOCKS']='0'
    foreach ($r5DevGitVariable in @('GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE')) {
        $r5DevGit.EnvironmentVariables.Remove($r5DevGitVariable)
    }
    $r5DevProcess = [Diagnostics.Process]::Start($r5DevGit)
    $r5DevPaths = $r5DevProcess.StandardOutput.ReadToEnd().Split([char]0) | Where-Object { $_ } | Sort-Object -Unique
    $r5DevProcess.WaitForExit()
    if ($r5DevProcess.ExitCode -ne 0) { throw 'Could not inventory R5 source files.' }
    $r5DevManifest = @()
    foreach ($r5DevRelative in $r5DevPaths) {
        $r5DevSource = [IO.Path]::GetFullPath((Join-Path $r5DevRoot $r5DevRelative))
        if (-not $r5DevSource.StartsWith($r5DevRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Source path escaped the worktree.' }
        if (-not (Test-Path -LiteralPath $r5DevSource -PathType Leaf)) { continue }
        $r5DevDestination = Join-Path $r5DevSnapshot $r5DevRelative
        New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($r5DevDestination)) | Out-Null
        Copy-Item -LiteralPath $r5DevSource -Destination $r5DevDestination
        $r5DevManifest += @{path=$r5DevRelative;sha256=(Get-FileHash -LiteralPath $r5DevDestination -Algorithm SHA256).Hash}
    }
    $r5DevHead = (& git.exe -C $r5DevRoot rev-parse HEAD).Trim()
    $r5DevSnapshotInfo = @{source=$r5DevSnapshot;head=$r5DevHead;created_utc=[DateTime]::UtcNow.ToString('o');files=$r5DevManifest}
    [IO.File]::WriteAllText((Join-Path $r5DevSnapshot 'snapshot-manifest.json'), ($r5DevSnapshotInfo | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    $r5DevLinuxSource = "$r5DevLinuxRoot/infra/r5/.runtime/dev-sources/$r5DevSnapshotName"
    [IO.File]::WriteAllText($r5DevEnv, "CQ_R5_DEV_SOURCE=$r5DevLinuxSource`n", [Text.UTF8Encoding]::new($false))
    $r5DevCompose = @('compose', '-p', 'campusquest-r5-dev', '-f', "$r5DevLinuxRoot/infra/r5/dev-compose.yml", '--env-file', "$r5DevLinuxRoot/infra/r5/.runtime/dev.env")
    Test-R5DevOwnership
    $r5DevCertificates = Join-Path $r5DevRuntime 'dev-certs'
    New-Item -ItemType Directory -Force -Path $r5DevCertificates | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $r5DevCertificates 'public.crt')) -or -not (Test-Path -LiteralPath (Join-Path $r5DevCertificates 'private.key'))) {
        & wsl.exe -d CampusQuest-Dev --exec openssl req -x509 -newkey rsa:2048 -keyout "$r5DevLinuxRoot/infra/r5/.runtime/dev-certs/private.key" -out "$r5DevLinuxRoot/infra/r5/.runtime/dev-certs/public.crt" -days 365 -nodes -subj /CN=localhost -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' *> (Join-Path $r5DevLogs 'certificate.log')
        if ($LASTEXITCODE -ne 0) { throw 'Dev certificate generation failed.' }
    }
    Invoke-R5DevDocker 'dependencies' ($r5DevCompose + @('up','-d','--no-recreate','postgres','redis','minio','minio-init'))
    Invoke-R5DevDocker 'runner' ($r5DevCompose + @('up','-d','--no-deps','--force-recreate','runner'))
    Invoke-R5DevDocker 'prepare' @('exec','campusquest-r5-dev-runner','bash','/workspace/infra/r5/dev-process.sh','prepare')
    Invoke-R5DevDocker 'verify' @('exec','campusquest-r5-dev-runner','bash','/workspace/infra/r5/dev-process.sh','verify')
    [IO.File]::WriteAllText($r5DevState, (@{source=$r5DevLinuxSource;head=$r5DevHead;prepared_utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Write-Output 'R5_DEV_PREPARED=PASS; API/Web remain stopped.'
} elseif ($Action -eq 'Start') {
    if (-not (Test-Path -LiteralPath $r5DevState)) { throw 'Prepare this dev snapshot before starting its API/Web.' }
    Test-R5DevPorts @{3306='campusquest-r5-dev-web';8306='campusquest-r5-dev-api'}
    # Explicit Start recreates only these two owned services so a stopped
    # application cannot retain the source mount from an older snapshot.
    Invoke-R5DevDocker 'start' ($r5DevCompose + @('--profile','application','up','-d','--no-deps','--force-recreate','api','web'))
    Write-Output 'R5_DEV_URL=https://127.0.0.1:3306; API=http://127.0.0.1:8306'
} elseif ($Action -in @('Verify','Seed')) {
    Invoke-R5DevDocker $Action.ToLowerInvariant() @('exec','campusquest-r5-dev-runner','bash','/workspace/infra/r5/dev-process.sh',$Action.ToLowerInvariant())
} elseif ($Action -eq 'Stop') {
    # Stop only this project's application; persistent data and dependencies stay.
    Invoke-R5DevDocker 'stop' ($r5DevCompose + @('--profile','application','stop','api','web'))
} else {
    Invoke-R5DevDocker 'status' ($r5DevCompose + @('--profile','application','ps','-a'))
}
} finally {
    $r5DevMutex.ReleaseMutex()
    $r5DevMutex.Dispose()
}
