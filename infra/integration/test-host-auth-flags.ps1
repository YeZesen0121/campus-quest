$ErrorActionPreference = 'Stop'
$taskPwsh = (Get-Command pwsh.exe -ErrorAction Stop).Source
$taskRunner = Join-Path $PSScriptRoot 'run.ps1'
$taskReport = Join-Path $PSScriptRoot '../../frontend/test-results/report.json'
$taskFence = [Environment]::GetEnvironmentVariable('CQ_E2E_FENCE')
$taskProbe = [Environment]::GetEnvironmentVariable('CQ_E2E_PROBE')
function Get-ReportFingerprint {
    if (Test-Path -LiteralPath $taskReport) { return (Get-FileHash -LiteralPath $taskReport -Algorithm SHA256).Hash }
    return 'absent'
}
try {
    $env:CQ_E2E_FENCE = '1'
    $env:CQ_E2E_PROBE = '1'
    & $taskPwsh -NoProfile -File $taskRunner node ../infra/integration/probe-auth-flags.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Dedicated authentication flags did not reach the owned runner.' }
    $taskBefore = Get-ReportFingerprint
    $taskOutput = & $taskPwsh -NoProfile -File $taskRunner battery 2>&1
    $taskExit = $LASTEXITCODE
    $taskOutput | Write-Output
    if ($taskExit -ne 2 -or ($taskOutput -join "`n") -notmatch 'Standard battery requires no filters or special-world flags') {
        throw 'Standard battery accepted dedicated authentication flags or failed for an unrelated reason.'
    }
    if ((Get-ReportFingerprint) -ne $taskBefore) { throw 'Rejected battery touched the browser report.' }
} finally {
    [Environment]::SetEnvironmentVariable('CQ_E2E_FENCE', $taskFence)
    [Environment]::SetEnvironmentVariable('CQ_E2E_PROBE', $taskProbe)
}
Write-Output 'INTEGRATION_DEDICATED_AUTH_FLAGS=PASS; STANDARD_BATTERY_REJECTS_SPECIAL_WORLD_BEFORE_REPORT_MUTATION=PASS'
