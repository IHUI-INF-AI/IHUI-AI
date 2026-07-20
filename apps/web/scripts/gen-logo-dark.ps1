# Generate apps/web/public/images/logo-dark.svg from logo.svg
# Only changes the text fill color from #343434 (dark gray) to #ffffff (white).
# The icon's brand-color gradient (url(#master_svg0_1937_38746)) and the
# butterfly/ribbon shape image embedded as base64 PNG are preserved as-is,
# so the dark mode logo keeps the original brand identity of the icon while
# the text becomes readable on a dark sidebar background.
#
# Usage (from repo root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/web/scripts/gen-logo-dark.ps1
#
# Idempotent: overwrites logo-dark.svg if it already exists.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path "$PSScriptRoot/../../..").Path
$src = Join-Path $repoRoot 'apps/web/public/images/logo.svg'
$dst = Join-Path $repoRoot 'apps/web/public/images/logo-dark.svg'

if (-not (Test-Path $src)) {
  throw "Source logo.svg not found at $src"
}

if (Test-Path $dst) {
  Remove-Item $dst -Force
}

# Read raw bytes, do a single-pass text fill replace, write UTF-8 without BOM.
# (logo.svg is a single-line 1.1MB file, normal Read tools can't open it, hence this script.)
$content = [System.IO.File]::ReadAllText($src)
$content = $content.Replace('fill="#343434"', 'fill="#ffffff"')
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($dst, $content, $utf8)

$len = (Get-Item $dst).Length
Write-Output "logo-dark.svg generated, size=$len bytes (icon preserved, text white)"
