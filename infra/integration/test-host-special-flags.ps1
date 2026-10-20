$ErrorActionPreference = 'Stop'
$taskPwsh = (Get-Command pwsh.exe -ErrorAction Stop).Source
$taskRunner = Join-Path $PSScriptRoot 'run.ps1'
$taskReport = Join-Path $PSScriptRoot '../../frontend/test-results/report.json'
$taskOriginalMock = [Environment]::GetEnvironmentVariable('CQ_E2E_MOCK_STORAGE')
$taskOriginalCapture = [Environment]::GetEnvironmentVariable('CQ_E2E_CAPTURE_DIR')
try {
    $env:CQ_E2E_MOCK_STORAGE = '1'
    $env:CQ_E2E_CAPTURE_DIR = '/workspace/infra/integration/.runtime/captures/forwarding-proof'
    & $taskPwsh -NoProfile -File $taskRunner node ../infra/integration/probe-special-flags.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Special world flags did not reach the owned runner.' }
    $taskBefore = if (Test-Path -LiteralPath $taskReport) { (Get-FileHash -LiteralPath $taskReport -Algorithm SHA256).Hash } else { 'absent' }
    $taskOutput = & $taskPwsh -NoProfile -File $taskRunner battery 2>&1
    $taskExit = $LASTEXITCODE
    $taskOutput | Write-Output
    if ($taskExit -ne 2 -or ($taskOutput -join "`n") -notmatch 'Standard battery requires no filters or special-world flags') {
        throw 'Standard battery failed to reject the dedicated worlds before launching.'
    }
    $taskAfter = if (Test-Path -LiteralPath $taskReport) { (Get-FileHash -LiteralPath $taskReport -Algorithm SHA256).Hash } else { 'absent' }
    if ($taskAfter -ne $taskBefore) { throw 'Rejected battery touched its report.' }
    foreach ($taskBadPath in @('/tmp/foreign', '/workspace/infra/integration/.runtime/captures/../foreign', '/workspace/infra/integration/.runtime/captures/a/b')) {
        $env:CQ_E2E_CAPTURE_DIR = $taskBadPath
        $taskOutput = & $taskPwsh -NoProfile -File $taskRunner node ../infra/integration/probe-special-flags.mjs 2>&1
        if ($LASTEXITCODE -eq 0 -or ($taskOutput -join "`n") -notmatch 'Capture directory must be a direct child of the owned integration runtime') {
            throw 'Unsafe capture output was accepted or rejected for an unrelated reason.'
        }
    }
} finally {
    [Environment]::SetEnvironmentVariable('CQ_E2E_MOCK_STORAGE', $taskOriginalMock)
    [Environment]::SetEnvironmentVariable('CQ_E2E_CAPTURE_DIR', $taskOriginalCapture)
}
Write-Output 'INTEGRATION_SPECIAL_FLAG_FORWARDING_AND_REPORT_ISOLATION=PASS; INVALID_CAPTURE_PATHS=3/3'
