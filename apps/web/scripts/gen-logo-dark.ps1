# Generate apps/web/public/images/logo-dark.svg from logo.svg
# - Changes text fill from #343434 (dark) to #ffffff (white) — big "智汇AI社区"
# - Changes the dark gradient master_svg0_1937_38746 (used for small "IHUI INF.AI" text)
#   from black stops (#000 / #373737 / #000) to white stops (#fff / #d4d4d4 / #fff)
#   so the small text becomes visible on dark sidebar.
# The butterfly icon (base64-embedded PNG via master_svg2_1544_37177) is preserved as-is,
# so the icon's brand color is kept in dark mode.
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

# Read raw, apply text + gradient replacements
$content = [System.IO.File]::ReadAllText($src)

# 1. Big text fill: dark gray → white
$content = $content.Replace('fill="#343434"', 'fill="#ffffff"')

# 2. Gradient stops for the small text ("IHUI INF.AI" line below the big text).
# Original gradient:
#   <stop offset="0%"  stop-color="#000000" stop-opacity="0.20000000298023224"/>
#   <stop offset="49.31506812572479%" stop-color="#373737" stop-opacity="0.6054794788360596"/>
#   <stop offset="99.28571581840515%" stop-color="#000000" stop-opacity="0.20000000298023224"/>
# In dark mode, the dark stops become invisible against a dark sidebar.
# Replace with light stops to keep the small text legible while preserving the
# soft-edges look the gradient provides.
$content = $content.Replace('stop-color="#000000" stop-opacity="0.20000000298023224"', 'stop-color="#ffffff" stop-opacity="0.5"')
$content = $content.Replace('stop-color="#373737" stop-opacity="0.6054794788360596"', 'stop-color="#e5e5e5" stop-opacity="0.95"')

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($dst, $content, $utf8)

$len = (Get-Item $dst).Length
Write-Output "logo-dark.svg generated, size=$len bytes"
Write-Output "  - text fill #343434 -> #ffffff"
Write-Output "  - gradient #000/#373737/#000 -> #ffffff/#e5e5e5/#ffffff"
