# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#
# 微信 4.x 截图 + Windows OCR 只读探测。
# 只做三件事：找到 Weixin 主窗口、截图、调用 Windows.Media.Ocr 识别中文。
# 不注入、不读内存、不改微信文件；窗口被隐藏时默认报 ok=false，避免凭空弹窗。

param(
  [ValidateSet('status', 'read')]
  [string]$Mode = 'read',
  [string]$ImagePath = '',
  [string]$JsonPath = '',
  [switch]$AutoShow
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public class WeChatOcrWin {
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  public static bool IsVisible(IntPtr h) { return IsWindowVisible(h); }
  public static bool Restore(IntPtr h) { return ShowWindow(h, 9); }

  public static bool Capture(IntPtr h, string path) {
    RECT r;
    if (!GetWindowRect(h, out r)) return false;
    int width = r.Right - r.Left;
    int height = r.Bottom - r.Top;
    if (width <= 0 || height <= 0) return false;
    using (Bitmap bmp = new Bitmap(width, height)) {
      using (Graphics g = Graphics.FromImage(bmp)) {
        IntPtr hdc = g.GetHdc();
        bool ok = PrintWindow(h, hdc, 2);
        g.ReleaseHdc(hdc);
        if (!ok) return false;
      }
      bmp.Save(path, ImageFormat.Png);
    }
    return true;
  }
}
'@

function Get-WindowInfo {
  $proc = Get-Process -Name Weixin -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1
  $h = if ($proc) { [IntPtr]$proc.MainWindowHandle } else { [IntPtr]::Zero }
  if ($h -eq [IntPtr]::Zero) {
    return [ordered]@{ ok = $false; visible = $false; hwnd = 0; title = ''; reason = '未找到 Weixin 主窗口；请先打开微信主窗口（托盘隐藏需手工点开）' }
  }
  if (-not [WeChatOcrWin]::IsVisible($h)) {
    if ($AutoShow) { [void][WeChatOcrWin]::Restore($h); Start-Sleep -Milliseconds 800 }
    else {
      return [ordered]@{
        ok = $false; visible = $false; hwnd = $h.ToInt64(); title = '微信'; reason = '微信主窗口当前被最小化；请还原窗口，或启动时加 -AutoShow'
      }
    }
  }
  return [ordered]@{ ok = $true; visible = $true; hwnd = $h.ToInt64(); title = '微信'; reason = $null }
}

function Write-Payload($payload) {
  $json = $payload | ConvertTo-Json -Depth 8 -Compress
  if ($JsonPath) {
    $parent = Split-Path -Parent $JsonPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($JsonPath, $json, [System.Text.UTF8Encoding]::new($false))
  } else {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    Write-Output $json
  }
}

function Read-OcrLines($path) {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
  function Await($op, $type) {
    $asTask = $asTaskGeneric.MakeGenericMethod($type)
    $t = $asTask.Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
    $t.Result
  }
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $lang = [Windows.Globalization.Language]::new('zh-cn')
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
  if (-not $engine) { throw '系统未安装 zh-cn OCR 语言包' }
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $lines = @()
  foreach ($line in $result.Lines) {
    $words = @($line.Words)
    if ($words.Count -eq 0) { continue }
    $minX = [double]::MaxValue
    $minY = [double]::MaxValue
    $maxR = 0.0
    $maxB = 0.0
    $parts = @()
    foreach ($word in $words) {
      $rect = $word.BoundingRect
      if ($rect.X -lt $minX) { $minX = $rect.X }
      if ($rect.Y -lt $minY) { $minY = $rect.Y }
      if (($rect.X + $rect.Width) -gt $maxR) { $maxR = $rect.X + $rect.Width }
      if (($rect.Y + $rect.Height) -gt $maxB) { $maxB = $rect.Y + $rect.Height }
      $parts += $word.Text
    }
    $text = ($parts -join '').Trim()
    if (-not $text) { continue }
    $lines += [ordered]@{
      text = $text
      x = [Math]::Round($minX, 1)
      y = [Math]::Round($minY, 1)
      w = [Math]::Round($maxR - $minX, 1)
      h = [Math]::Round($maxB - $minY, 1)
    }
  }
  return $lines
}

$info = Get-WindowInfo
if ($Mode -eq 'status') {
  Write-Payload $info
  exit $(if ($info.ok) { 0 } else { 2 })
}

if (-not $info.ok) {
  Write-Payload $info
  exit 2
}

$h = [IntPtr]$info.hwnd
$rectPath = $ImagePath
if (-not $rectPath) {
  $rectPath = Join-Path $env:TEMP 'wechat-ocr-frame.png'
}
$dir = Split-Path -Parent $rectPath
if ($dir -and -not (Test-Path -LiteralPath $dir)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
if (-not [WeChatOcrWin]::Capture($h, $rectPath)) {
  Write-Payload ([ordered]@{ ok = $false; visible = $true; hwnd = $h.ToInt64(); title = '微信'; reason = '截图失败' })
  exit 3
}

Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Image]::FromFile($rectPath)
$width = $bmp.Width
$height = $bmp.Height
$bmp.Dispose()
$lines = Read-OcrLines $rectPath
Write-Payload ([ordered]@{
  ok = $true
  visible = $true
  hwnd = $h.ToInt64()
  title = '微信'
  width = $width
  height = $height
  image = $rectPath
  lines = $lines
})
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
