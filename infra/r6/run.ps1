# Parse positional arguments directly: an advanced PowerShell parameter named
# Mode would otherwise consume pytest/alembic's -m option as its abbreviation.
$ErrorActionPreference = 'Stop'
if ($args.Count -lt 1) { Write-Output 'Usage: run.ps1 MODE COMMAND_ARGUMENTS...'; exit 2 }
$Mode = [string]$args[0]
if ($Mode -notin @('backend', 'python', 'frontend', 'node', 'tsx', 'playwright', 'visual')) {
    Write-Output 'Unknown R6 runner mode.'
    exit 2
}
$CommandArguments = @($args | Select-Object -Skip 1)
$env:WSL_UTF8 = '1'
$r6ExpectedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$r6Mount = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' campusquest-r6-runner
if ($LASTEXITCODE -ne 0) { throw 'The R6 runner is not available.' }
$r6ExpectedMount = & wsl.exe -d CampusQuest-Dev --exec wslpath -u $r6ExpectedRoot
if ($LASTEXITCODE -ne 0 -or $r6Mount.Trim() -ne $r6ExpectedMount.Trim()) {
    throw 'R6 runner source mount does not match this worktree.'
}
$r6FlagArguments = @()
foreach ($r6Flag in @('CQ_E2E', 'CQ_E2E_MENTOR_WORLD', 'CQ_S3_SMOKE', 'CQ_EVIDENCE_SCAN_SMOKE', 'CQ_COMPOSITION_SMOKE', 'CQ_VISUAL', 'CQ_E2E_FIXED_LABELS')) {
    $r6Value = [Environment]::GetEnvironmentVariable($r6Flag)
    if ([string]::IsNullOrEmpty($r6Value)) { continue }
    if ($r6Value -notin @('0', '1')) { throw "Test flag $r6Flag must be 0 or 1." }
    $r6FlagArguments += @('--env', "$r6Flag=$r6Value")
}
# Export filenames as raw UTF-8/NUL bytes. PowerShell's text pipeline would
# corrupt unusual names; this native Git call is read-only against this worktree.
$r6ManifestDirectory = Join-Path $PSScriptRoot '.runtime/git-manifests'
New-Item -ItemType Directory -Force -Path $r6ManifestDirectory | Out-Null
$r6ManifestName = [Guid]::NewGuid().ToString('N') + '.files'
$r6ManifestPath = Join-Path $r6ManifestDirectory $r6ManifestName
$r6GitInfo = [Diagnostics.ProcessStartInfo]::new()
$r6GitInfo.FileName = (Get-Command git.exe -ErrorAction Stop).Source
$r6GitInfo.Arguments = 'ls-files -z --cached'
$r6GitInfo.WorkingDirectory = $r6ExpectedRoot
$r6GitInfo.UseShellExecute = $false
$r6GitInfo.CreateNoWindow = $true
$r6GitInfo.RedirectStandardOutput = $true
$r6GitInfo.RedirectStandardError = $true
$r6GitInfo.EnvironmentVariables['GIT_OPTIONAL_LOCKS'] = '0'
foreach ($r6GitVariable in @('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE')) {
    $r6GitInfo.EnvironmentVariables.Remove($r6GitVariable)
}
$r6GitProcess = [Diagnostics.Process]::Start($r6GitInfo)
$r6ManifestStream = [IO.File]::Create($r6ManifestPath)
try { $r6GitProcess.StandardOutput.BaseStream.CopyTo($r6ManifestStream) }
finally { $r6ManifestStream.Dispose() }
$r6GitError = $r6GitProcess.StandardError.ReadToEnd()
$r6GitProcess.WaitForExit()
if ($r6GitProcess.ExitCode -ne 0) { throw "Could not inventory R6 tracked files: $r6GitError" }
$r6GitProcess.Dispose()
$r6FlagArguments += @('--env', "CQ_R6_GIT_MANIFEST=/workspace/infra/r6/.runtime/git-manifests/$r6ManifestName")
& wsl.exe -d CampusQuest-Dev --exec docker exec @r6FlagArguments campusquest-r6-runner bash /workspace/infra/r6/launch.sh $Mode @CommandArguments
$r6Exit = $LASTEXITCODE
Write-Output "R6_DOCKER_EXEC_EXIT=$r6Exit"
exit $r6Exit
