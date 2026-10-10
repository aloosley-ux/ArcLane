# Packaged window acceptance: creates its OWN profile and process; never controls
# the user's installed ArcLane instance or their repositories.
param([string]$Exe=(Join-Path (Split-Path $PSScriptRoot -Parent) 'Build\Arclane.exe'))
$ErrorActionPreference='Stop'
if (!(Test-Path -LiteralPath $Exe)) {throw "Packaged EXE not found: $Exe"}
$profile=Join-Path $env:TEMP ('ArcLane-Window-Accept-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $profile -Force|Out-Null
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class ArcLaneWindowNative{
 [StructLayout(LayoutKind.Sequential)]public struct POINT{public int x;public int y;}
 [StructLayout(LayoutKind.Sequential)]public struct RECT{public int left;public int top;public int right;public int bottom;}
 [StructLayout(LayoutKind.Sequential)]public struct PLACEMENT{
 public int length;public int flags;public int showCmd;public POINT min;public POINT max;public RECT normal;
 }
 [DllImport("user32.dll")]public static extern bool GetWindowPlacement(IntPtr hwnd,ref PLACEMENT info);
 [DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr hwnd,int show);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr hwnd);
}
'@
Add-Type -AssemblyName UIAutomationClient
$oldData=$env:ARCLANE_DATA_DIR
$oldWeb=$env:WEBVIEW2_USER_DATA_FOLDER
$p=$null
try {
 $env:ARCLANE_DATA_DIR=$profile
 $env:WEBVIEW2_USER_DATA_FOLDER=Join-Path $profile 'webview2'
 $watch=[Diagnostics.Stopwatch]::StartNew()
 $p=Start-Process -FilePath $Exe -WorkingDirectory (Split-Path -Parent $Exe) -PassThru
 $h=[IntPtr]::Zero
 for($attempt=0;$attempt -lt 80;$attempt++){
    $p.Refresh()
    if($p.HasExited){throw 'ArcLane exited during packaged cold startup'}
    if($p.MainWindowHandle -ne [IntPtr]::Zero){$h=$p.MainWindowHandle;break}
    Start-Sleep -Milliseconds 100
 }
 if($h -eq [IntPtr]::Zero){throw 'No native window visible after cold startup'}
 $startupMs=[Math]::Round($watch.Elapsed.TotalMilliseconds)
 $window=[System.Windows.Automation.AutomationElement]::FromHandle($h)
 if($null -eq $window -or $window.Current.ControlType.ProgrammaticName -ne 'ControlType.Window'){throw 'Native Windows UIAutomation did not identify a window'}
 if($window.Current.Name -notmatch 'Arclane'){throw ('Unexpected UIA window title: '+$window.Current.Name)}
 Write-Output ('PASS native cold window + UIAutomation title at '+$startupMs+'ms')
 $state=New-Object ArcLaneWindowNative+PLACEMENT;$state.length=[Runtime.InteropServices.Marshal]::SizeOf($state)
 if(-not [ArcLaneWindowNative]::GetWindowPlacement($h,[ref]$state)){throw 'Cannot inspect window placement'}
 [void][ArcLaneWindowNative]::ShowWindow($h,6)
 Start-Sleep -Milliseconds 350
 if(-not [ArcLaneWindowNative]::GetWindowPlacement($h,[ref]$state) -or $state.showCmd -ne 2){throw ('Minimize not reflected in real Windows placement: '+$state.showCmd)}
 Write-Output 'PASS native minimize via actual Win32 window placement'
 [void][ArcLaneWindowNative]::ShowWindow($h,9)
 Start-Sleep -Milliseconds 450
 if(-not [ArcLaneWindowNative]::GetWindowPlacement($h,[ref]$state) -or $state.showCmd -eq 2 -or -not [ArcLaneWindowNative]::IsWindowVisible($h)){throw 'Restore failed Windows window-state checks'}
 $p.Refresh();if($p.HasExited){throw 'App exited after restore'}
 Write-Output 'PASS native restore, visible window, surviving process'
 Write-Output ('PASS startup working set '+[Math]::Round($p.WorkingSet64/1MB,1)+' MB')
}finally{
 $env:ARCLANE_DATA_DIR=$oldData;$env:WEBVIEW2_USER_DATA_FOLDER=$oldWeb
 if($null -ne $p -and -not $p.HasExited){
  [void]$p.CloseMainWindow()
  if(-not $p.WaitForExit(6000)){throw 'Fixture app refused graceful shutdown; left untouched for inspection'}
 }
 # Keep evidence/profile for diagnosis; no mass cleanup.
}
