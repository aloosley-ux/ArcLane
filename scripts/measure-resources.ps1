$ErrorActionPreference='Stop'
$root='C:\AI\REA\Experiments\Arclane'
$exe=Join-Path $root 'Build\Arclane.exe'
$profile=Join-Path $root 'artifacts\resource-profile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$fixture=Get-ChildItem 'C:\AI\REA\Experiments\Forge-Testbed' -Directory -Filter 'forge-history-pages-*'|Sort-Object LastWriteTime -Descending|Select-Object -First 1 -ExpandProperty FullName
[IO.File]::WriteAllText((Join-Path $profile 'repos.json'),(ConvertTo-Json -InputObject @($fixture) -Compress))
$env:ARCLANE_DATA_DIR=$profile
function TreeSnapshot([int]$rootPid){
 $procs=Get-CimInstance Win32_Process
 $ids=@($rootPid)
 $cursor=0
 while($cursor -lt $ids.Count) {
   $parent=$ids[$cursor]
   $children=@($procs|Where-Object {$_.ParentProcessId -eq $parent}|Select-Object -ExpandProperty ProcessId)
   foreach($child in $children){if($child -notin $ids){$ids+= $child}}
   $cursor++
 }
 $alive=@(Get-Process -Id $ids -ErrorAction SilentlyContinue)
 [PSCustomObject]@{
   ids=$ids
   processCount=$alive.Count
   privateMB=[math]::Round(($alive|Measure-Object -Property PrivateMemorySize64 -Sum).Sum /1MB,1)
   workingMB=[math]::Round(($alive|Measure-Object -Property WorkingSet64 -Sum).Sum /1MB,1)
   cpuSeconds=[math]::Round(($alive|Measure-Object -Property CPU -Sum).Sum,3)
   names=@($alive|Group-Object ProcessName|ForEach-Object {"$($_.Name) x$($_.Count)"})
 }
}
$app=$null
try{
 $app=Start-Process $exe -PassThru
 for($i=0;$i -lt 50;$i++){Start-Sleep -Milliseconds 200;$app.Refresh();if($app.MainWindowHandle -ne [IntPtr]::Zero){break}}
 if($app.HasExited){throw 'Native Arclane exited'}
 Start-Sleep -Seconds 3
 $before=TreeSnapshot $app.Id
 Start-Sleep -Seconds 8
 $after=TreeSnapshot $app.Id
 $cpuDelta=[math]::Round(($after.cpuSeconds-$before.cpuSeconds)*1000,1)
 $info=[PSCustomObject]@{
   processCount=$after.processCount
   processNames=$after.names
   mainProcessId=$app.Id
   privateMemoryMB=$after.privateMB
   sumWorkingSetMB=$after.workingMB
   eightSecondCpuMs=$cpuDelta
   method='All live descendant processes by Win32_Process parent PID; sums include WebView2 subprocesses, but process working sets can share pages.'
   fixture=$fixture
 }
 $info | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $root 'artifacts\resource-measurement.json') -Encoding UTF8
 $info|ConvertTo-Json -Depth 4
}finally{
 if($app -and -not $app.HasExited) {
   [void]$app.CloseMainWindow()
   if(-not $app.WaitForExit(3500)){$app.Kill()}
 }
 Remove-Item Env:ARCLANE_DATA_DIR -ErrorAction SilentlyContinue
}
