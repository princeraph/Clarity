# Creates a Clarity desktop shortcut with the Aperture mark icon.
# Run once after cloning: right-click -> Run with PowerShell

$clarityDir = "$env:USERPROFILE\Personal-Work\projet-clarity\app"
$iconPath   = "$clarityDir\build\icon.ico"
$vbsPath    = "$clarityDir\Clarity.vbs"

# Use Shell special folder so OneDrive-redirected Desktops work
$desktop  = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktop "Clarity.lnk"

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
$shortcut.Description      = "Clarity - on-device AI task manager"

$shortcut.Save()

Write-Host "Shortcut created at $linkPath" -ForegroundColor Green
