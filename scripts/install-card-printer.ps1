<#
.SYNOPSIS
  One-time setup on the card-printing PC.

.DESCRIPTION
  Creates the cards folder, puts a shortcut in Startup so the printer watcher
  runs whenever the machine is logged in, and starts it now.

  After this, whoever prints cards only has to click Save in Cheer Ops. Nothing
  else. No scripts, no folders, no PowerShell.

  Run this once per machine, and only on the PC the Magicard is attached to.
  It needs no administrator rights - everything it touches belongs to the
  current user.

.PARAMETER Folder
  Where Cheer Ops will save cards. Whoever prints must pick this same folder the
  first time they hit Save; the browser remembers it afterwards. A shortcut to it
  is placed on the Desktop.

.PARAMETER Printer
  Target printer.

.PARAMETER Uninstall
  Remove the Startup shortcut and stop the watcher.

.EXAMPLE
  .\install-card-printer.ps1
.EXAMPLE
  .\install-card-printer.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  # Deliberately not the Desktop. A redirected Desktop (OneDrive Known Folder
  # Move, which this organisation uses) is a synced folder: every card would
  # upload, and OneDrive can hold a file open while it syncs, which is the exact
  # condition the watcher treats as "still being written". The installer puts a
  # shortcut on the Desktop so it is still easy to find.
  [string]$Folder  = (Join-Path $env:USERPROFILE "Cheer Ops Cards"),
  [string]$Printer = "Magicard 300 (V2)",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$startup      = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "Cheer Ops Card Printer.lnk"
$watcher      = Join-Path $PSScriptRoot "watch-and-print.ps1"

function Stop-Watcher {
  # Identified by the script in its command line: several PowerShell windows may
  # be open and the others must not be touched.
  $running = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*watch-and-print.ps1*" }
  foreach ($p in $running) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "  stopped running watcher (pid $($p.ProcessId))"
  }
  return @($running).Count
}

if ($Uninstall) {
  Write-Host ""
  Write-Host "Removing the Cheer Ops card printer" -ForegroundColor Cyan
  if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath -Force
    Write-Host "  removed the Startup shortcut"
  } else {
    Write-Host "  no Startup shortcut was installed"
  }
  $desktopLink = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "Cheer Ops Cards.lnk"
  if (Test-Path -LiteralPath $desktopLink) {
    Remove-Item -LiteralPath $desktopLink -Force
    Write-Host "  removed the Desktop shortcut"
  }
  Stop-Watcher | Out-Null
  Write-Host ""
  Write-Host "Done. Cards will no longer print automatically." -ForegroundColor Green
  Write-Host "The folder and any cards in it were left alone: $Folder"
  exit 0
}

if (-not (Test-Path -LiteralPath $watcher)) {
  Write-Host "Cannot find watch-and-print.ps1 beside this script." -ForegroundColor Red
  Write-Host "All three .ps1 files must be in the same folder." -ForegroundColor Yellow
  exit 1
}

# Anything downloaded from the web carries a Mark-of-the-Web tag, and PowerShell
# refuses to run tagged scripts without prompting. The watcher starts from a
# Startup shortcut where there is nobody to answer that prompt, so the tag is
# cleared from all three now.
foreach ($f in "install-card-printer.ps1", "watch-and-print.ps1", "print-cards.ps1") {
  $full = Join-Path $PSScriptRoot $f
  if (Test-Path -LiteralPath $full) { Unblock-File -LiteralPath $full -ErrorAction SilentlyContinue }
}

Write-Host ""
Write-Host "Setting up the Cheer Ops card printer" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath $Folder)) {
  New-Item -ItemType Directory -Path $Folder -Force | Out-Null
  Write-Host "  created $Folder"
} else {
  Write-Host "  folder already exists: $Folder"
}

# Deliberately not $printer: PowerShell variable names are case-insensitive, so
# that would overwrite the $Printer parameter with the printer object and the
# shortcut would be built with an object where the printer name belongs.
$printerObj = Get-Printer -Name $Printer -ErrorAction SilentlyContinue
if ($printerObj) {
  Write-Host "  found printer: $Printer ($($printerObj.PrinterStatus))"
} else {
  Write-Host "  WARNING: printer '$Printer' is not installed on this PC." -ForegroundColor Yellow
  Write-Host "           Setup will continue; cards will queue until it is connected." -ForegroundColor Yellow
  Write-Host "           Printers currently installed:" -ForegroundColor DarkGray
  Get-Printer | ForEach-Object { Write-Host "             $($_.Name)" -ForegroundColor DarkGray }
}

# A shortcut rather than the folder itself, so the cards never sit in a synced
# location. GetFolderPath, not $env:USERPROFILE\Desktop: with OneDrive Known
# Folder Move the visible Desktop is inside the OneDrive tree, and the profile
# path is a leftover nobody ever sees.
$desktop = [Environment]::GetFolderPath("DesktopDirectory")
if ($desktop -and (Test-Path -LiteralPath $desktop)) {
  $folderLink = Join-Path $desktop "Cheer Ops Cards.lnk"
  $wsF = New-Object -ComObject WScript.Shell
  $scF = $wsF.CreateShortcut($folderLink)
  $scF.TargetPath = $Folder
  $scF.Description = "Cards saved from Cheer Ops print from here"
  $scF.Save()
  Write-Host "  put a shortcut on the Desktop: $folderLink"
} else {
  Write-Host "  could not find the Desktop; open the folder directly: $Folder" -ForegroundColor Yellow
}

Stop-Watcher | Out-Null

# -ExecutionPolicy Bypass because the default policy blocks unsigned local
# scripts, which is what this is, and the alternative is changing the policy
# machine-wide.
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = (Get-Command powershell.exe).Source
$sc.Arguments  = "-ExecutionPolicy Bypass -WindowStyle Minimized -File `"$watcher`" -Folder `"$Folder`" -Printer `"$Printer`""
$sc.WorkingDirectory = $PSScriptRoot
$sc.Description = "Prints Canadian Cheer credential cards saved from Cheer Ops"
$sc.Save()
Write-Host "  installed Startup shortcut: $shortcutPath"

Start-Process -FilePath $sc.TargetPath -ArgumentList $sc.Arguments -WindowStyle Minimized
Start-Sleep -Seconds 2
$now = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*watch-and-print.ps1*" }
if ($now) { Write-Host "  watcher is running now (pid $(@($now)[0].ProcessId))" -ForegroundColor Green }
else { Write-Host "  WARNING: the watcher did not start; run watch-and-print.ps1 by hand to see why" -ForegroundColor Yellow }

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host ""
Write-Host "What happens now:" -ForegroundColor Cyan
Write-Host "  1. In Cheer Ops, open Credentials, then Print cards."
Write-Host "  2. Click Build cards, check the photos look right, then Save."
Write-Host "  3. The first time only, choose this folder:"
Write-Host "       $Folder"
Write-Host "       (there is a 'Cheer Ops Cards' shortcut on the Desktop)"
Write-Host "  4. The cards print. Then click Mark printed in Cheer Ops."
Write-Host ""
Write-Host "To undo all of this:  .\install-card-printer.ps1 -Uninstall" -ForegroundColor DarkGray
