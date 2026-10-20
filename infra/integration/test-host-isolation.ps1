$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskOwnerPath = Join-Path $PSScriptRoot '.runtime/owner.json'
$taskOwnerBytes = [IO.File]::ReadAllBytes($taskOwnerPath)
$taskPwsh = (Get-Command pwsh.exe -ErrorAction Stop).Source
$taskManifestDirectory = Join-Path $PSScriptRoot '.runtime/git-manifests'
$taskBefore = @(Get-ChildItem -LiteralPath $taskManifestDirectory -File -ErrorAction SilentlyContinue).Count
try {
    $taskOwner = Get-Content -LiteralPath $taskOwnerPath -Raw | ConvertFrom-Json
    $taskOwner.windows_root = 'C:/foreign-worktree'
    [IO.File]::WriteAllText($taskOwnerPath, ($taskOwner | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    $taskOutput = & $taskPwsh -NoProfile -File (Join-Path $PSScriptRoot 'run.ps1') node -e 'console.log("COMMAND_REACHED")' 2>&1
    $taskExit = $LASTEXITCODE
    $taskText = $taskOutput -join "`n"
    if ($taskExit -eq 0 -or $taskText -notmatch 'INTEGRATION source ownership guard rejected' -or $taskText -match 'COMMAND_REACHED') {
        throw "Foreign worktree marker was allowed: exit=$taskExit $taskText"
    }
    $taskAfter = @(Get-ChildItem -LiteralPath $taskManifestDirectory -File -ErrorAction SilentlyContinue).Count
    if ($taskAfter -ne $taskBefore) { throw 'Rejected source wrote a Git manifest.' }
} finally {
    [IO.File]::WriteAllBytes($taskOwnerPath, $taskOwnerBytes)
}
Write-Output 'INTEGRATION_HOST_SOURCE_REJECTION=PASS; original owner bytes restored'

$taskForeignRoot = Join-Path $PSScriptRoot ('.runtime/foreign-source-' + [Guid]::NewGuid().ToString('N'))
$taskForeignInfra = Join-Path $taskForeignRoot 'infra/integration'
$taskForeignRuntime = Join-Path $taskForeignInfra '.runtime'
New-Item -ItemType Directory -Path $taskForeignRuntime -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'run.ps1') -Destination $taskForeignInfra
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'resources.json') -Destination $taskForeignInfra
$taskForeignOwner = [Text.Encoding]::UTF8.GetString($taskOwnerBytes) | ConvertFrom-Json
$taskForeignOwner.windows_root = $taskForeignRoot
[IO.File]::WriteAllText((Join-Path $taskForeignRuntime 'owner.json'), ($taskForeignOwner | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$taskOutput = & $taskPwsh -NoProfile -File (Join-Path $taskForeignInfra 'run.ps1') node -e 'console.log("COMMAND_REACHED")' 2>&1
$taskExit = $LASTEXITCODE
$taskText = $taskOutput -join "`n"
if ($taskExit -eq 0 -or $taskText -notmatch 'source mount does not match this worktree' -or $taskText -match 'COMMAND_REACHED') {
    throw "Foreign source mount was allowed: exit=$taskExit $taskText"
}
if (Test-Path (Join-Path $taskForeignRuntime 'git-manifests')) { throw 'Foreign mount wrote a manifest.' }
Write-Output 'INTEGRATION_HOST_MOUNT_REJECTION=PASS; no source commands executed'
