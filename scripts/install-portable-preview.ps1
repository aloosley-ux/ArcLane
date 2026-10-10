param(
    [Parameter(Mandatory=$true)][string]$Source,
    [string]$Target=(Join-Path $env:LOCALAPPDATA 'ArcLane-Preview'),
    [switch]$DesktopShortcut
)
# Run only after a verified Tauri release build.
# Never touches Git repositories, user settings or running processes.
$ErrorActionPreference='Stop'
$sourcePath=(Resolve-Path -LiteralPath $Source).Path
if ((Get-Item -LiteralPath $sourcePath).Extension -ne '.exe') {throw 'Source must be an ArcLane .exe'}
if (-not (Test-Path -LiteralPath $Target)) {New-Item -Path $Target -ItemType Directory -Force|Out-Null}
$destination=Join-Path (Resolve-Path -LiteralPath $Target).Path 'Arclane.exe'
if ([IO.Path]::GetFullPath($sourcePath) -eq [IO.Path]::GetFullPath($destination)) {throw 'Source and destination are the same'}
if (Test-Path -LiteralPath $destination) {
    try {$stream=[IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$stream.Dispose()}
    catch {throw 'ArcLane is running or its executable is locked. Close it and retry.'}
    Copy-Item -LiteralPath $destination -Destination ($destination+'.previous') -Force
}
Copy-Item -LiteralPath $sourcePath -Destination $destination -Force
$expected=(Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
$actual=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
if ($actual -ne $expected){throw 'File checksum mismatch after copying executable'}
if ($DesktopShortcut) {
    $desktop=[Environment]::GetFolderPath('Desktop')
    $shortcut=Join-Path $desktop 'ArcLane.lnk'
    $shell=New-Object -ComObject WScript.Shell
    $link=$shell.CreateShortcut($shortcut)
    $link.TargetPath=$destination
    $link.WorkingDirectory=(Split-Path -Parent $destination)
    $link.IconLocation=$destination+',0'
    $link.Description='ArcLane — local Git workspace'
    $link.Save()
}
Write-Output ('PASS Portable ArcLane: '+$destination)
Write-Output ('PASS SHA256: '+$actual)
if ($DesktopShortcut){Write-Output 'PASS ArcLane desktop shortcut'}
