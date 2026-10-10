# Run acceptance against this checkout's packaged executable, never another branch's EXE.
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$env:ARCLANE_TEST_ROOT = $taskRoot
if (-not (Test-Path -LiteralPath 'Build\Arclane.exe')) { throw 'Package the application with Tauri first.' }
New-Item -ItemType Directory -Force artifacts\mock-gh | Out-Null
rtk proxy rustc --edition 2021 scripts/mock-gh.rs -o artifacts/mock-gh/gh.exe
if ($LASTEXITCODE -ne 0) { throw 'Mock provider build failed.' }
$suites = @('native-ui-accept','native-conflict-accept','native-file-insights-accept','native-graph-accept','native-toolbox-accept','native-collab-mock-accept','native-literal-paths-accept','native-repository-state-accept','native-design-review')
$results = @()
foreach ($suite in $suites) {
    $log = Join-Path $taskRoot ('artifacts\redesign-' + $suite + '.log')
    # Windows PowerShell treats harmless native stderr warnings as errors.
    # Capture them, and determine failure from the test process exit code.
    try {
        $ErrorActionPreference = 'Continue'
        rtk proxy node ('scripts/' + $suite + '.mjs') 2>&1 | Tee-Object -FilePath $log
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = 'Stop' }
    $results += [pscustomobject]@{suite=$suite;exitCode=$code;log=$log}
    if ($code -ne 0) { $results | ConvertTo-Json | Set-Content -LiteralPath artifacts\redesign-regressions.json; throw "$suite failed; inspect $log" }
}
$results | ConvertTo-Json | Set-Content -LiteralPath artifacts\redesign-regressions.json
Get-FileHash -LiteralPath Build\Arclane.exe
