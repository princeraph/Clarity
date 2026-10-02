# Creates a "Clarity (dev)" desktop shortcut with the Aperture mark icon.
# Run once after cloning: right-click -> Run with PowerShell
#
# "(dev)" because this shortcut runs Clarity from the source folder. The
# installer creates its own "Clarity.lnk" for the installed app, and both used
# to have that exact name: whichever ran last silently replaced the other, so
# the desktop icon launched one version or the other depending on what had been
# run most recently.

$clarityDir = $PSScriptRoot
$iconPath   = "$clarityDir\build\icon.ico"
$vbsPath    = "$clarityDir\Clarity.vbs"

# Use Shell special folder so OneDrive-redirected Desktops work
$desktop  = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktop "Clarity (dev).lnk"

# Generate icon if missing
if (-not (Test-Path $iconPath)) {
    Write-Host "Generating app icon..." -ForegroundColor Cyan
    Push-Location $clarityDir
    node scripts/generate-icon.js
    Pop-Location
}

if (-not (Test-Path $iconPath)) {
    Write-Host "Warning: icon still not found at $iconPath" -ForegroundColor Yellow
    Write-Host "The shortcut will use the default wscript.exe icon." -ForegroundColor Yellow
    $iconLocation = "wscript.exe, 0"
} else {
    $iconLocation = "$iconPath, 0"
}

$shell    = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($linkPath)

$shortcut.TargetPath       = "wscript.exe"
$shortcut.Arguments        = "`"$vbsPath`""
$shortcut.WorkingDirectory = $clarityDir
$shortcut.IconLocation     = $iconLocation
$shortcut.Description      = "Clarity - run from the source folder (development)"

$shortcut.Save()

Write-Host "Shortcut created at $linkPath" -ForegroundColor Green
