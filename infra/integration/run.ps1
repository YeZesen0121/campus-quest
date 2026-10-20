# Parse positional arguments directly: an advanced PowerShell parameter named
# Mode would otherwise consume pytest/alembic's -m option as its abbreviation.
$ErrorActionPreference = 'Stop'
if ($args.Count -lt 1) { Write-Output 'Usage: run.ps1 MODE COMMAND_ARGUMENTS...'; exit 2 }
$Mode = [string]$args[0]
if ($Mode -notin @('backend', 'python', 'frontend', 'node', 'tsx', 'playwright', 'visual', 'battery')) {
    Write-Output 'Unknown INTEGRATION runner mode.'
    exit 2
}
$CommandArguments = @($args | Select-Object -Skip 1)
$env:WSL_UTF8 = '1'
$integrationExpectedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$integrationResources = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'resources.json') -Raw | ConvertFrom-Json
$integrationOwner = Get-Content -LiteralPath (Join-Path $PSScriptRoot '.runtime/owner.json') -Raw | ConvertFrom-Json
if (-not [string]::Equals([IO.Path]::GetFullPath($integrationOwner.windows_root), $integrationExpectedRoot, [StringComparison]::OrdinalIgnoreCase) -or $integrationOwner.id -ne $integrationResources.id) {
    throw 'INTEGRATION source ownership guard rejected this worktree.'
}
$integrationMount = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' campusquest-integration-runner
if ($LASTEXITCODE -ne 0) { throw 'The INTEGRATION runner is not available.' }
$integrationExpectedMount = & wsl.exe -d CampusQuest-Dev --exec wslpath -u $integrationExpectedRoot
if ($LASTEXITCODE -ne 0 -or $integrationMount.Trim() -ne $integrationExpectedMount.Trim()) {
    throw 'INTEGRATION runner source mount does not match this worktree.'
}
$integrationActualOwner = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{index .Config.Labels "cq.integration.id"}}' campusquest-integration-runner
if ($LASTEXITCODE -ne 0 -or $integrationActualOwner.Trim() -ne $integrationOwner.id) {
    throw 'INTEGRATION container ownership guard rejected the runner.'
}
$integrationFlagArguments = @()
foreach ($integrationFlag in @('CQ_E2E', 'CQ_E2E_MENTOR_WORLD', 'CQ_E2E_FENCE', 'CQ_E2E_PROBE', 'CQ_S3_SMOKE', 'CQ_EVIDENCE_SCAN_SMOKE', 'CQ_COMPOSITION_SMOKE', 'CQ_VISUAL', 'CQ_E2E_FIXED_LABELS')) {
    $integrationValue = [Environment]::GetEnvironmentVariable($integrationFlag)
    if ([string]::IsNullOrEmpty($integrationValue)) { continue }
    if ($integrationValue -notin @('0', '1')) { throw "Test flag $integrationFlag must be 0 or 1." }
    $integrationFlagArguments += @('--env', "$integrationFlag=$integrationValue")
}
# Export filenames as raw UTF-8/NUL bytes. PowerShell's text pipeline would
# corrupt unusual names; this native Git call is read-only against this worktree.
$integrationManifestDirectory = Join-Path $PSScriptRoot '.runtime/git-manifests'
New-Item -ItemType Directory -Force -Path $integrationManifestDirectory | Out-Null
$integrationManifestName = [Guid]::NewGuid().ToString('N') + '.files'
$integrationManifestPath = Join-Path $integrationManifestDirectory $integrationManifestName
$integrationGitInfo = [Diagnostics.ProcessStartInfo]::new()
$integrationGitInfo.FileName = (Get-Command git.exe -ErrorAction Stop).Source
$integrationGitInfo.Arguments = 'ls-files -z --cached'
$integrationGitInfo.WorkingDirectory = $integrationExpectedRoot
$integrationGitInfo.UseShellExecute = $false
$integrationGitInfo.CreateNoWindow = $true
$integrationGitInfo.RedirectStandardOutput = $true
$integrationGitInfo.RedirectStandardError = $true
$integrationGitInfo.EnvironmentVariables['GIT_OPTIONAL_LOCKS'] = '0'
foreach ($integrationGitVariable in @('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE')) {
    $integrationGitInfo.EnvironmentVariables.Remove($integrationGitVariable)
}
$integrationGitProcess = [Diagnostics.Process]::Start($integrationGitInfo)
$integrationManifestStream = [IO.File]::Create($integrationManifestPath)
try { $integrationGitProcess.StandardOutput.BaseStream.CopyTo($integrationManifestStream) }
finally { $integrationManifestStream.Dispose() }
$integrationGitError = $integrationGitProcess.StandardError.ReadToEnd()
$integrationGitProcess.WaitForExit()
if ($integrationGitProcess.ExitCode -ne 0) { throw "Could not inventory INTEGRATION tracked files: $integrationGitError" }
$integrationGitProcess.Dispose()
$integrationGitInfo.Arguments = 'rev-parse HEAD'
$integrationHeadProcess = [Diagnostics.Process]::Start($integrationGitInfo)
$integrationHead = $integrationHeadProcess.StandardOutput.ReadToEnd().Trim()
$integrationHeadError = $integrationHeadProcess.StandardError.ReadToEnd()
$integrationHeadProcess.WaitForExit()
if ($integrationHeadProcess.ExitCode -ne 0 -or $integrationHead -notmatch '^[0-9a-f]{40}$') { throw "Could not bind native head: $integrationHeadError" }
$integrationHeadProcess.Dispose()
$integrationFlagArguments += @('--env', "CQ_INTEGRATION_HEAD=$integrationHead")
$integrationFlagArguments += @('--env', "CQ_INTEGRATION_GIT_MANIFEST=/workspace/infra/integration/.runtime/git-manifests/$integrationManifestName")
& wsl.exe -d CampusQuest-Dev --exec docker exec @integrationFlagArguments campusquest-integration-runner bash /workspace/infra/integration/launch.sh $Mode @CommandArguments
$integrationExit = $LASTEXITCODE
Write-Output "INTEGRATION_DOCKER_EXEC_EXIT=$integrationExit"
exit $integrationExit
