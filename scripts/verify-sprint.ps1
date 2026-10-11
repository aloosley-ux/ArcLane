param([ValidateSet('all','backend','native')][string]$Phase='all')
# Run only against this checkout and fresh disposable repositories. Provider suites are offline.
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$env:ARCLANE_TEST_ROOT=$taskRoot
$cli=Join-Path $taskRoot 'src-tauri\target\release\arclane-cli.exe'
if(Test-Path -LiteralPath $cli){$env:ARCLANE_CLI=$cli}
New-Item -ItemType Directory -Force artifacts\mock-gh | Out-Null
rtk proxy rustc --edition 2021 scripts/mock-gh.rs -o artifacts/mock-gh/gh.exe
if($LASTEXITCODE -ne 0){throw 'Offline provider fixture build failed'}
$results=@()
if($Phase -ne 'native'){
 rtk proxy cargo build --manifest-path src-tauri/Cargo.toml --bin terminal-lifecycle-fixture
 if($LASTEXITCODE -ne 0){throw 'Terminal lifecycle fixture build failed'}
 rtk proxy cargo test --manifest-path src-tauri/Cargo.toml --bin arclane terminal::tests -- --test-threads=1
 if($LASTEXITCODE -ne 0){throw 'Terminal lifecycle backend tests failed'}
 rtk proxy node --experimental-strip-types scripts/test-terminal-session-state.mjs
 if($LASTEXITCODE -ne 0){throw 'Terminal session synchronization tests failed'}
 foreach($script in (Get-ChildItem -LiteralPath scripts -Filter 'accept-*.py' | Sort-Object Name)){
  $log=Join-Path $taskRoot ('artifacts\final-'+$script.BaseName+'.log')
  try{$ErrorActionPreference='Continue';rtk proxy python $script.FullName 2>&1 | Tee-Object -FilePath $log;$code=$LASTEXITCODE}finally{$ErrorActionPreference='Stop'}
  $results+=[pscustomobject]@{suite=$script.Name;exitCode=$code;log=$log}
  $results | ConvertTo-Json | Set-Content -LiteralPath artifacts\final-backend-regressions.json
  if($code -ne 0){throw ($script.Name+' failed')}
 }
}
if($Phase -ne 'backend'){
 if(-not (Test-Path -LiteralPath Build\Arclane.exe)){throw 'Package Windows executable first'}
 $results=@()
 $failedNative=@()
 $suites=@('native-ui-accept','native-conflict-accept','native-file-insights-accept','native-graph-accept','native-toolbox-accept','native-collab-mock-accept','native-literal-paths-accept','native-repository-state-accept','native-design-review','native-commit-options-accept','native-revision-review-accept','native-operation-workflows-accept','native-sequencer-recovery-accept','native-provider-process-accept','native-workspace-accept','native-worktree-workflows-accept','native-agent-workspaces-accept','native-diff-productivity-accept','native-ignored-files-accept','native-diff-media-accept','native-discard-undo-accept','native-window-bounds-accept')
 foreach($suite in $suites){
  $log=Join-Path $taskRoot ('artifacts\final-'+$suite+'.log')
  try{$ErrorActionPreference='Continue';rtk proxy node ('scripts/'+$suite+'.mjs') 2>&1 | Tee-Object -FilePath $log;$code=$LASTEXITCODE}finally{$ErrorActionPreference='Stop'}
  $results+=[pscustomobject]@{suite=$suite;exitCode=$code;log=$log}
  $results | ConvertTo-Json | Set-Content -LiteralPath artifacts\final-native-regressions.json
  if($code -ne 0){$failedNative+=$suite;Write-Warning ($suite+' failed; continuing to collect remaining native regressions')}
 }
 if($failedNative.Count){throw ('Native regressions failed: '+($failedNative -join ', '))}
}
