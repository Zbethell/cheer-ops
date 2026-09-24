<#
.SYNOPSIS
  Prints a batch of credential cards to the Magicard.

.DESCRIPTION
  Cheer Ops writes finished cards into a folder as PNGs, one per card, already
  composited at exactly 642x1014 (2.14 x 3.38in at 300dpi). This sends each one
  to the card printer and moves it into a "printed" subfolder as it goes.

  Printing happens here rather than from the browser because the browser cannot
  be trusted to hold 1:1 scale, and the Magicard driver defaults to landscape
  while the card design is portrait. Those settings are applied explicitly
  below, and a physical test card confirmed the result is exactly 1:1 with the
  artwork reaching all four edges.

  Cards are printed one at a time and the queue is allowed to drain between
  them, so a jam stops the batch instead of feeding twenty cards into a fault.

.PARAMETER Folder
  Where the cards were saved. Defaults to the folder the installer creates.

.PARAMETER Printer
  Target printer. Defaults to the Magicard.

.PARAMETER WhatIf
  List what would print, and send nothing.

.EXAMPLE
  .\print-cards.ps1
.EXAMPLE
  .\print-cards.ps1 -Folder "D:\cards" -WhatIf
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
  [switch]$WhatIf
)

Add-Type -AssemblyName System.Drawing

$EXPECT_W = 642
$EXPECT_H = 1014
$DRAIN_TIMEOUT_SEC = 90

if (-not (Test-Path -LiteralPath $Folder)) {
  Write-Host "No such folder: $Folder" -ForegroundColor Red
  Write-Host "Save a batch from Cheer Ops first, or pass -Folder." -ForegroundColor Yellow
  exit 1
}

$cards = @(Get-ChildItem -LiteralPath $Folder -Filter *.png -File | Sort-Object Name)
if ($cards.Count -eq 0) {
  Write-Host "No cards waiting in $Folder" -ForegroundColor Yellow
  exit 0
}

$printerObj = Get-Printer -Name $Printer -ErrorAction SilentlyContinue
if (-not $printerObj) {
  Write-Host "Printer not found: $Printer" -ForegroundColor Red
  Write-Host "Installed printers:" -ForegroundColor Yellow
  Get-Printer | ForEach-Object { "   $($_.Name)" }
  exit 1
}

Write-Host ""
Write-Host "Printer : $Printer  ($($printerObj.PrinterStatus))"
Write-Host "Folder  : $Folder"
Write-Host "Cards   : $($cards.Count)"
Write-Host ""

# A card that is not exactly 642x1014 did not come from Cheer Ops, and printing
# it would silently rescale someone's credential. Check before sending anything.
$bad = @()
foreach ($c in $cards) {
  try {
    $img = [System.Drawing.Image]::FromFile($c.FullName)
    $w = $img.Width; $h = $img.Height
    $img.Dispose()
    if ($w -ne $EXPECT_W -or $h -ne $EXPECT_H) {
      $bad += [pscustomobject]@{ Name = $c.Name; Size = "${w}x${h}" }
    }
  } catch {
    $bad += [pscustomobject]@{ Name = $c.Name; Size = "unreadable" }
  }
}
if ($bad.Count -gt 0) {
  Write-Host "These files are not ${EXPECT_W}x${EXPECT_H} and will be skipped:" -ForegroundColor Yellow
  $bad | ForEach-Object { "   $($_.Name)  [$($_.Size)]" }
  Write-Host ""
  $skip = $bad.Name
  $cards = @($cards | Where-Object { $skip -notcontains $_.Name })
  if ($cards.Count -eq 0) { Write-Host "Nothing left to print." -ForegroundColor Yellow; exit 1 }
}

if ($WhatIf) {
  Write-Host "Would print, in this order:" -ForegroundColor Cyan
  $i = 1
  foreach ($c in $cards) { "{0,3}. {1}" -f $i, $c.Name; $i++ }
  exit 0
}

$printedDir = Join-Path $Folder "printed"
if (-not (Test-Path -LiteralPath $printedDir)) {
  New-Item -ItemType Directory -Path $printedDir | Out-Null
}

function Wait-ForQueue {
  param([string]$Name, [int]$TimeoutSec)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $jobs = @(Get-PrintJob -PrinterName $Name -ErrorAction SilentlyContinue)
    if ($jobs.Count -eq 0) { return $true }
    $stuck = $jobs | Where-Object { $_.JobStatus -match "Error|Blocked|Offline|PaperOut" }
    if ($stuck) {
      Write-Host "   queue reports: $($stuck.JobStatus -join ', ')" -ForegroundColor Red
      return $false
    }
    Start-Sleep -Milliseconds 700
  }
  return $false
}

$ok = 0; $failed = 0
$n = 0
foreach ($card in $cards) {
  $n++
  Write-Host ("[{0}/{1}] {2}" -f $n, $cards.Count, $card.Name) -NoNewline

  $bmp = $null; $doc = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($card.FullName)
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.DocumentName = "Cheer Ops credential - $($card.BaseName)"
    $doc.PrinterSettings.PrinterName = $Printer
    $doc.PrinterSettings.Copies = 1
    if (-not $doc.PrinterSettings.IsValid) { throw "printer settings invalid" }

    # The driver offers CR80 but defaults to landscape; the design is portrait.
    $cr80 = $doc.PrinterSettings.PaperSizes | Where-Object { $_.PaperName -like "CR80*" } | Select-Object -First 1
    if ($cr80) { $doc.DefaultPageSettings.PaperSize = $cr80 }
    $doc.DefaultPageSettings.Landscape = $false
    # Draw to the physical page, not inside the margins, so the art bleeds.
    $doc.OriginAtMargins = $false

    $handler = {
      param($sender, $e)
      $e.Graphics.InterpolationMode = 'HighQualityBicubic'
      $e.Graphics.PixelOffsetMode = 'HighQuality'
      $b = $e.PageBounds
      $e.Graphics.DrawImage($bmp, (New-Object System.Drawing.Rectangle($b.X, $b.Y, $b.Width, $b.Height)))
      $e.HasMorePages = $false
    }
    $doc.add_PrintPage($handler)
    $doc.Print()
  } catch {
    Write-Host "   FAILED to send: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
    if ($bmp) { $bmp.Dispose() }
    if ($doc) { $doc.Dispose() }
    continue
  }

  $drained = Wait-ForQueue -Name $Printer -TimeoutSec $DRAIN_TIMEOUT_SEC
  $bmp.Dispose(); $doc.Dispose()

  if ($drained) {
    Move-Item -LiteralPath $card.FullName -Destination (Join-Path $printedDir $card.Name) -Force
    Write-Host "   printed" -ForegroundColor Green
    $ok++
  } else {
    Write-Host "   did not clear the queue - stopping so the rest are not fed into a fault" -ForegroundColor Red
    $failed++
    break
  }
}

Write-Host ""
Write-Host "$ok printed, $failed failed." -ForegroundColor $(if ($failed) { "Yellow" } else { "Green" })
if ($ok -gt 0) { Write-Host "Printed cards moved to: $printedDir" }
if ($failed -gt 0) {
  Write-Host "Anything not printed is still in $Folder - fix the printer and run this again." -ForegroundColor Yellow
}
Write-Host "Now mark the batch printed in Cheer Ops." -ForegroundColor Cyan
exit $(if ($failed) { 1 } else { 0 })
