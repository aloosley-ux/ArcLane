param([ValidateSet('all','backend','native')][string]$Phase='all')
# Run only against this checkout and fresh disposable repositories. Provider suites are offline.
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$env:ARCLANE_TEST_ROOT=$taskRoot
New-Item -ItemType Directory -Force artifacts\mock-gh | Out-Null
rtk proxy rustc --edition 2021 scripts/mock-gh.rs -o artifacts/mock-gh/gh.exe
if($LASTEXITCODE -ne 0){throw 'Offline provider fixture build failed'}
$results=@()
if($Phase -ne 'native'){
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
 $suites=@('native-ui-accept','native-conflict-accept','native-file-insights-accept','native-graph-accept','native-toolbox-accept','native-collab-mock-accept','native-literal-paths-accept','native-repository-state-accept','native-design-review','native-commit-options-accept','native-revision-review-accept','native-operation-workflows-accept','native-sequencer-recovery-accept','native-provider-process-accept','native-workspace-accept','native-diff-productivity-accept','native-ignored-files-accept')
 foreach($suite in $suites){
  $log=Join-Path $taskRoot ('artifacts\final-'+$suite+'.log')
  try{$ErrorActionPreference='Continue';rtk proxy node ('scripts/'+$suite+'.mjs') 2>&1 | Tee-Object -FilePath $log;$code=$LASTEXITCODE}finally{$ErrorActionPreference='Stop'}
  $results+=[pscustomobject]@{suite=$suite;exitCode=$code;log=$log}
  $results | ConvertTo-Json | Set-Content -LiteralPath artifacts\final-native-regressions.json
  if($code -ne 0){throw ($suite+' failed')}
 }
}
