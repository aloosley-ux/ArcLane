param([ValidateSet('focused','package','backend','native')][string]$Phase='focused')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force artifacts | Out-Null
$env:ARCLANE_CLI=(Resolve-Path src-tauri/target/release/arclane-cli.exe).Path
$env:ARCLANE_DATA_DIR=Join-Path (Get-Location) ('artifacts\cli-data-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $env:ARCLANE_DATA_DIR | Out-Null
function Run-Checked($command,$arguments,$log){
 try{$ErrorActionPreference='Continue'; & rtk proxy $command @arguments 2>&1 | Tee-Object -FilePath ('artifacts\'+$log);$code=$LASTEXITCODE}finally{$ErrorActionPreference='Stop'}
 if($code -ne 0){throw ($command+' failed with exit '+$code)}
}
if($Phase -eq 'focused'){
 foreach($suite in @('accept-diff-media','accept-discard-undo','accept-compare','accept-file-inspection','accept-advanced-git','accept-revision-review','accept-literal-paths')){Run-Checked python @('scripts/'+$suite+'.py') ($suite+'.log')}
}elseif($Phase -eq 'package'){
 Run-Checked npx @('tauri','build','--no-bundle') 'run3-build.log'
 New-Item -ItemType Directory -Force Build | Out-Null
 Copy-Item -LiteralPath src-tauri/target/release/arclane.exe -Destination Build/Arclane.exe -Force
 $exe=Get-Item Build/Arclane.exe
 $latest=(Get-ChildItem src,src-tauri/src -File -Recurse | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1)
 if($exe.LastWriteTimeUtc -lt $latest.LastWriteTimeUtc){throw 'Executable older than source'}
 [pscustomobject]@{sourceHead=(& rtk git rev-parse HEAD);sha256=(Get-FileHash Build/Arclane.exe -Algorithm SHA256).Hash;size=$exe.Length;builtUtc=$exe.LastWriteTimeUtc;latestSource=$latest.FullName;latestSourceUtc=$latest.LastWriteTimeUtc} | ConvertTo-Json | Set-Content artifacts/run3-provenance.json
}else{Run-Checked powershell @('-NoProfile','-File','scripts/verify-sprint.ps1','-Phase',$Phase) ('run3-'+$Phase+'.log')}
