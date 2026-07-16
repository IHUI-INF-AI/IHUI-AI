Add-Type -AssemblyName System.Drawing
$iconSizes = @(16, 32, 48, 64, 128, 256)
foreach ($s in $iconSizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
  $fontSize = [Math]::Max(6, [int]($s * 0.4))
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s)
  $g.DrawString('IHUI', $font, [System.Drawing.Brushes]::White, $rect, $sf)
  $g.Dispose()
  $path = "g:\IHUI-AI\apps\desktop\src-tauri\icons\${s}x${s}.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Copy-Item -Force 'g:\IHUI-AI\apps\desktop\src-tauri\icons\128x128.png' 'g:\IHUI-AI\apps\desktop\src-tauri\icons\128x128@2x.png'

$iconBmp = New-Object System.Drawing.Bitmap(64, 64)
$g2 = [System.Drawing.Graphics]::FromImage($iconBmp)
$g2.SmoothingMode = 'AntiAlias'
$g2.TextRenderingHint = 'AntiAliasGridFit'
$g2.Clear([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
$font2 = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf2 = New-Object System.Drawing.StringFormat
$sf2.Alignment = [System.Drawing.StringAlignment]::Center
$sf2.LineAlignment = [System.Drawing.StringAlignment]::Center
$rect2 = New-Object System.Drawing.RectangleF(0, 0, 64, 64)
$g2.DrawString('IHUI', $font2, [System.Drawing.Brushes]::White, $rect2, $sf2)
$g2.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($iconBmp.GetHicon())
$fs = [System.IO.File]::Create('g:\IHUI-AI\apps\desktop\src-tauri\icons\icon.ico')
$icon.Save($fs)
$fs.Close()
$iconBmp.Dispose()

# macOS icns: Tauri macOS build 需要;此处提供 PNG 备用(实际 macOS 打包会失败,Windows 不需要)
Copy-Item -Force 'g:\IHUI-AI\apps\desktop\src-tauri\icons\256x256.png' 'g:\IHUI-AI\apps\desktop\src-tauri\icons\icon.icns'

# 透明 PNG(用于 Linux 等)
$bmp3 = New-Object System.Drawing.Bitmap(512, 512)
$g3 = [System.Drawing.Graphics]::FromImage($bmp3)
$g3.SmoothingMode = 'AntiAlias'
$g3.TextRenderingHint = 'AntiAliasGridFit'
$g3.Clear([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
$font3 = New-Object System.Drawing.Font('Segoe UI', 180, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$rect3 = New-Object System.Drawing.RectangleF(0, 0, 512, 512)
$g3.DrawString('IHUI', $font3, [System.Drawing.Brushes]::White, $rect3, $sf2)
$g3.Dispose()
$bmp3.Save('g:\IHUI-AI\apps\desktop\src-tauri\icons\icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp3.Dispose()

Write-Host 'ALL_ICONS_OK'
Get-ChildItem g:\IHUI-AI\apps\desktop\src-tauri\icons | Select-Object Name, Length
