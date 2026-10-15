# Parse positional arguments directly: an advanced PowerShell parameter named
# Mode would otherwise consume pytest/alembic's -m option as its abbreviation.
$ErrorActionPreference = 'Stop'
if ($args.Count -lt 1) { Write-Output 'Usage: run.ps1 MODE COMMAND_ARGUMENTS...'; exit 2 }
$Mode = [string]$args[0]
if ($Mode -notin @('backend', 'python', 'frontend', 'node', 'tsx', 'playwright', 'visual')) {
    Write-Output 'Unknown R5 runner mode.'
    exit 2
}
$CommandArguments = @($args | Select-Object -Skip 1)
$env:WSL_UTF8 = '1'
$r5ExpectedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$r5Mount = & wsl.exe -d CampusQuest-Dev --exec docker inspect --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' campusquest-r5-runner
if ($LASTEXITCODE -ne 0) { throw 'The R5 runner is not available.' }
$r5ExpectedMount = & wsl.exe -d CampusQuest-Dev --exec wslpath -u $r5ExpectedRoot
if ($LASTEXITCODE -ne 0 -or $r5Mount.Trim() -ne $r5ExpectedMount.Trim()) {
    throw 'R5 runner source mount does not match this worktree.'
}
$r5FlagArguments = @()
foreach ($r5Flag in @('CQ_E2E', 'CQ_E2E_MENTOR_WORLD', 'CQ_S3_SMOKE', 'CQ_EVIDENCE_SCAN_SMOKE', 'CQ_COMPOSITION_SMOKE', 'CQ_VISUAL', 'CQ_E2E_FIXED_LABELS')) {
    $r5Value = [Environment]::GetEnvironmentVariable($r5Flag)
    if ([string]::IsNullOrEmpty($r5Value)) { continue }
    if ($r5Value -notin @('0', '1')) { throw "Test flag $r5Flag must be 0 or 1." }
    $r5FlagArguments += @('--env', "$r5Flag=$r5Value")
}
# Export filenames as raw UTF-8/NUL bytes. PowerShell's text pipeline would
# corrupt unusual names; this native Git call is read-only against this worktree.
$r5ManifestDirectory = Join-Path $PSScriptRoot '.runtime/git-manifests'
New-Item -ItemType Directory -Force -Path $r5ManifestDirectory | Out-Null
$r5ManifestName = [Guid]::NewGuid().ToString('N') + '.files'
$r5ManifestPath = Join-Path $r5ManifestDirectory $r5ManifestName
$r5GitInfo = [Diagnostics.ProcessStartInfo]::new()
$r5GitInfo.FileName = (Get-Command git.exe -ErrorAction Stop).Source
$r5GitInfo.Arguments = 'ls-files -z --cached'
$r5GitInfo.WorkingDirectory = $r5ExpectedRoot
$r5GitInfo.UseShellExecute = $false
$r5GitInfo.CreateNoWindow = $true
$r5GitInfo.RedirectStandardOutput = $true
$r5GitInfo.RedirectStandardError = $true
$r5GitInfo.EnvironmentVariables['GIT_OPTIONAL_LOCKS'] = '0'
foreach ($r5GitVariable in @('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE')) {
    $r5GitInfo.EnvironmentVariables.Remove($r5GitVariable)
}
$r5GitProcess = [Diagnostics.Process]::Start($r5GitInfo)
$r5ManifestStream = [IO.File]::Create($r5ManifestPath)
try { $r5GitProcess.StandardOutput.BaseStream.CopyTo($r5ManifestStream) }
finally { $r5ManifestStream.Dispose() }
$r5GitError = $r5GitProcess.StandardError.ReadToEnd()
$r5GitProcess.WaitForExit()
if ($r5GitProcess.ExitCode -ne 0) { throw "Could not inventory R5 tracked files: $r5GitError" }
$r5GitProcess.Dispose()
$r5FlagArguments += @('--env', "CQ_R5_GIT_MANIFEST=/workspace/infra/r5/.runtime/git-manifests/$r5ManifestName")
& wsl.exe -d CampusQuest-Dev --exec docker exec @r5FlagArguments campusquest-r5-runner bash /workspace/infra/r5/launch.sh $Mode @CommandArguments
$r5Exit = $LASTEXITCODE
Write-Output "R5_DOCKER_EXEC_EXIT=$r5Exit"
exit $r5Exit
