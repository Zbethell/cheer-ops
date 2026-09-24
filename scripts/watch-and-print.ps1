<#
.SYNOPSIS
  Watches the card folder and prints anything Cheer Ops saves into it.

.DESCRIPTION
  A browser cannot start a program on the machine - browsers forbid it, and no
  setting changes that. So instead of asking whoever is printing to run a script,
  this runs quietly in the background on the card-printing PC and prints whatever
  turns up. From their side the job is one button in Cheer Ops: Save.

  Set it up once with install-card-printer.ps1 and it starts with Windows.

  Files are polled rather than watched through FileSystemWatcher: polling cannot
  miss an event, needs no event plumbing, and a three second delay is nothing
  next to the time a card takes to print. Each file is checked for stability
  first, because the browser writes it in pieces and half a card is still a
  wasted card.

  The printing itself is handed to print-cards.ps1, so there is one copy of the
  page setup and one place to change it.

.PARAMETER Folder
  The folder Cheer Ops saves into.

.PARAMETER Printer
  Target printer.

.PARAMETER PollSeconds
  How often to look. Three seconds is responsive without being busy.

.PARAMETER WhatIf
  Report what would print and send nothing. For checking the setup without
  spending blank cards.

.EXAMPLE
  .\watch-and-print.ps1
.EXAMPLE
  .\watch-and-print.ps1 -Folder "D:\cards" -WhatIf
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
  [int]$PollSeconds = 3,
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$printScript = Join-Path $PSScriptRoot "print-cards.ps1"
if (-not (Test-Path -LiteralPath $printScript)) {
  Write-Host "Cannot find print-cards.ps1 beside this script." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath $Folder)) {
  New-Item -ItemType Directory -Path $Folder -Force | Out-Null
  Write-Host "Created $Folder"
}

$logFile = Join-Path $Folder "print-log.txt"
function Log {
  param([string]$Message, [string]$Colour = "Gray")
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line -ForegroundColor $Colour
  try { Add-Content -LiteralPath $logFile -Value $line -Encoding utf8 } catch { }
}

# A file is ready when its size has stopped changing and nothing else holds it
# open. The browser writes cards one after another, so this also keeps a batch
# together instead of printing the first card before the rest have landed.
function Test-Stable {
  param([System.IO.FileInfo]$File)
  try {
    $first = $File.Length
    Start-Sleep -Milliseconds 800
    $File.Refresh()
    if ($File.Length -ne $first -or $File.Length -eq 0) { return $false }
    $stream = [System.IO.File]::Open($File.FullName, 'Open', 'Read', 'None')
    $stream.Close()
    return $true
  } catch {
    return $false   # still being written, or locked
  }
}

Write-Host ""
Write-Host "Cheer Ops card printer" -ForegroundColor Cyan
Write-Host "Watching : $Folder"
Write-Host "Printer  : $Printer"
Write-Host "Log      : $logFile"
Write-Host ""
if ($WhatIf) { Write-Host "DRY RUN - nothing will actually print." -ForegroundColor Yellow; Write-Host "" }
Write-Host "Leave this window open. Cards saved from Cheer Ops will print automatically."
Write-Host "Close it to stop." -ForegroundColor DarkGray
Write-Host ""
Log "watcher started" "Cyan"

$warnedAboutPrinter = $false

while ($true) {
  try {
    $waiting = @(Get-ChildItem -LiteralPath $Folder -Filter *.png -File -ErrorAction SilentlyContinue)

    if ($waiting.Count -gt 0) {
      # Let the whole batch finish landing before starting the run.
      $stable = @($waiting | Where-Object { Test-Stable $_ })
      if ($stable.Count -eq $waiting.Count) {

        # Not $printer: variable names are case-insensitive here, so that would
        # clobber the $Printer parameter and every later run would be handed an
        # object instead of the printer's name.
        $printerObj = Get-Printer -Name $Printer -ErrorAction SilentlyContinue
        if (-not $printerObj) {
          if (-not $warnedAboutPrinter) {
            Log "printer '$Printer' not found - cards are waiting, they will print when it is back" "Yellow"
            $warnedAboutPrinter = $true
          }
        } else {
          $warnedAboutPrinter = $false
          Log "$($stable.Count) card(s) waiting, printing$(if ($WhatIf) { ' (dry run)' })" "Cyan"
          try {
            if ($WhatIf) {
              & $printScript -Folder $Folder -Printer $Printer -WhatIf
              # Nothing was printed, so nothing moved; do not spin on the same
              # files for ever.
              Log "dry run only - files left in place, pausing 15s" "DarkGray"
              Start-Sleep -Seconds 15
            } else {
              & $printScript -Folder $Folder -Printer $Printer
            }
            Log "batch finished" "Green"
          } catch {
            Log "print run failed: $($_.Exception.Message)" "Red"
            # Leave the files where they are; the next pass will try again once
            # whatever went wrong is fixed.
            Start-Sleep -Seconds 20
          }
        }
      }
    }
  } catch {
    Log "watcher error: $($_.Exception.Message)" "Red"
    Start-Sleep -Seconds 10
  }

  Start-Sleep -Seconds $PollSeconds
}
