$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$exe=Join-Path $root 'Build\Arclane.exe'
if(-not (Test-Path $exe)){throw 'Build Arclane.exe before native acceptance'}
$repo='C:\AI\REA\Experiments\Forge-Testbed\forge-visual-benchmark'
$profile=Join-Path $root 'artifacts\native-accept-profile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
[IO.File]::WriteAllText((Join-Path $profile 'repos.json'),(ConvertTo-Json -InputObject @($repo) -Compress))
$prior=$env:ARCLANE_DATA_DIR
$env:ARCLANE_DATA_DIR=$profile
$proc=$null
try{
  $proc=Start-Process -FilePath $exe -PassThru
  $window=$null
  for($i=0;$i -lt 70;$i++){
    Start-Sleep -Milliseconds 200
    $proc.Refresh()
    if($proc.HasExited){throw "Arclane exited unexpectedly: $($proc.ExitCode)"}
    if($proc.MainWindowHandle -ne [IntPtr]::Zero){$window=$proc.MainWindowTitle;break}
  }
  if($null -eq $window){throw 'Native application failed to create its main window'}
  if($window -notlike '*Arclane*'){throw "Unexpected application title: $window"}
  Write-Output "PASS Native Windows window: $window"
  Start-Sleep -Seconds 2
  $proc.Refresh()
  $cpuStart=$proc.TotalProcessorTime.TotalMilliseconds
  Start-Sleep -Seconds 8
  $proc.Refresh()
  $cpuIdleMs=[math]::Round($proc.TotalProcessorTime.TotalMilliseconds-$cpuStart,1)
  $ramMb=[math]::Round($proc.WorkingSet64/1MB,1)
  if($proc.HasExited){throw 'App exited while idle'}
  Write-Output ("PASS Native process remained alive; RAM {0} MB; eight-second CPU {1} ms" -f $ramMb,$cpuIdleMs)
  $evidence=[PSCustomObject]@{
    passed=2
    timestamp=(Get-Date).ToString('o')
    windowTitle=$window
    processId=$proc.Id
    mainProcessWorkingSetMb=$ramMb
    eightSecondMainProcessCpuMs=$cpuIdleMs
    limitations='Main process only; WebView2 child-process RAM/CPU is not included.'
    fixture=$repo
  }
  $evidence | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $root 'artifacts\native-acceptance.json') -Encoding UTF8
}finally{
  if($proc -and -not $proc.HasExited){
    [void]$proc.CloseMainWindow()
    if(-not $proc.WaitForExit(2500)){$proc.Kill()}
  }
  if($null -eq $prior){Remove-Item Env:ARCLANE_DATA_DIR -ErrorAction SilentlyContinue}else{$env:ARCLANE_DATA_DIR=$prior}
}
