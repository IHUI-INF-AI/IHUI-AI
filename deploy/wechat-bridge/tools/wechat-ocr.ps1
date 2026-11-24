# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#
# 微信 4.x 截图 + Windows OCR 只读探测。
# 只做三件事：找到 Weixin 主窗口、截图、调用 Windows.Media.Ocr 识别中文。
# 不注入、不读内存、不改微信文件；窗口隐藏时 -AutoShow 会从托盘找回并还原，否则报 ok=false。

param(
  [ValidateSet('status', 'read', 'search', 'click', 'switch')]
  [string]$Mode = 'read',
  [string]$ImagePath = '',
  [string]$JsonPath = '',
  [string]$Title = '',
  [int]$X = 0,
  [int]$Y = 0,
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
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern IntPtr SetActiveWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  // 微信 4.2 主窗口类名是 Qt51514QWindowIcon（早期文档写的 mmui::MainWindow 已过时）。
  // 托盘隐藏后 Get-Process.MainWindowHandle 为 0，必须用 EnumWindows 找隐藏主窗，
  // 且要按尺寸过滤掉「微信」小弹窗，否则会把 294×387 的通知窗当主窗截图。
  public static IntPtr FindMain() {
    IntPtr best = IntPtr.Zero;
    int bestArea = 0;
    bool bestVisible = false;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      StringBuilder cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      string c = cls.ToString();
      if (!c.StartsWith("Qt51514QWindowIcon") && c != "mmui::MainWindow") return true;
      StringBuilder title = new StringBuilder(256);
      GetWindowText(h, title, 256);
      if (title.ToString() != "微信") return true;
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      int w = r.Right - r.Left;
      int hgt = r.Bottom - r.Top;
      if (w < 600 || hgt < 500) return true;
      int area = w * hgt;
      bool vis = IsWindowVisible(h);
      if (vis) {
        if (!bestVisible || area > bestArea) { best = h; bestArea = area; bestVisible = true; }
      } else if (!bestVisible && area > bestArea) {
        best = h; bestArea = area;
      }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  public static bool IsVisible(IntPtr h) { return IsWindowVisible(h); }
  public static bool IsMinimized(IntPtr h) { return IsIconic(h); }
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

  public static void MakeAware() { SetProcessDPIAware(); }

  public static int[] Rect(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return new int[] { 0, 0, 0, 0 };
    return new int[] { r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top };
  }

  public static int[] Fit(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return new int[] { 0, 0, 0, 0 };
    int screenW = GetSystemMetrics(0);
    int screenH = GetSystemMetrics(1);
    int left = r.Left;
    int top = r.Top;
    int targetW = 1240;
    int targetH = 1120;
    if (left + targetW > screenW) left = 20;
    if (top + targetH > screenH) top = 20;
    if (r.Right - r.Left != targetW || r.Bottom - r.Top != targetH || left != r.Left || top != r.Top) {
      SetWindowPos(h, IntPtr.Zero, left, top, targetW, targetH, 0x0004);
      GetWindowRect(h, out r);
    }
    return new int[] { r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top };
  }

  public static string Focus(IntPtr h, bool topMost) {
    uint pid;
    uint tid = GetWindowThreadProcessId(h, out pid);
    uint cur = GetCurrentThreadId();
    AttachThreadInput(cur, tid, true);
    ShowWindow(h, 9);
    if (topMost) SetWindowPos(h, new IntPtr(-1), 0, 0, 0, 0, 0x0040 | 0x0001 | 0x0002);
    SetForegroundWindow(h);
    SetActiveWindow(h);
    SetFocus(h);
    AttachThreadInput(cur, tid, false);
    System.Threading.Thread.Sleep(600);
    StringBuilder title = new StringBuilder(256);
    GetWindowText(GetForegroundWindow(), title, 256);
    return title.ToString();
  }

  public static void Untop(IntPtr h) {
    SetWindowPos(h, new IntPtr(-2), 0, 0, 0, 0, 0x0040 | 0x0001 | 0x0002);
  }

  public static bool CaptureRect(IntPtr h, string path) {
    int[] r = Rect(h);
    if (r[2] <= 0 || r[3] <= 0) return false;
    System.Drawing.Bitmap bmp = new System.Drawing.Bitmap(r[2], r[3]);
    using (System.Drawing.Graphics g = System.Drawing.Graphics.FromImage(bmp)) {
      g.CopyFromScreen(r[0], r[1], 0, 0, new System.Drawing.Size(r[2], r[3]));
    }
    bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
    bmp.Dispose();
    return true;
  }

  public static bool Click(int x, int y) {
    if (!SetCursorPos(x, y)) return false;
    System.Threading.Thread.Sleep(200);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    System.Threading.Thread.Sleep(80);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
    return true;
  }

  public static void Paste() {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(0x56, 0, 0, UIntPtr.Zero);
    keybd_event(0x56, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }

  public static void Clear() {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(0x41, 0, 0, UIntPtr.Zero);
    keybd_event(0x41, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
    System.Threading.Thread.Sleep(120);
    keybd_event(0x08, 0, 0, UIntPtr.Zero);
    keybd_event(0x08, 0, 2, UIntPtr.Zero);
    keybd_event(0x08, 0, 0, UIntPtr.Zero);
    keybd_event(0x08, 0, 2, UIntPtr.Zero);
  }

  public static void CtrlF() {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(0x46, 0, 0, UIntPtr.Zero);
    keybd_event(0x46, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }

  public static void Esc() {
    keybd_event(0x1B, 0, 0, UIntPtr.Zero);
    keybd_event(0x1B, 0, 2, UIntPtr.Zero);
  }
}
'@

# DPI 感知必须在取窗口矩形之前：否则 175% 缩放下 GetWindowRect 只返回逻辑尺寸，
# 截图和 OCR、点击坐标都会缩水，窗口看起来"被遮挡"。
[void][WeChatOcrWin]::MakeAware()

function Get-WindowInfo {
  $h = [WeChatOcrWin]::FindMain()
  if ($h -eq [IntPtr]::Zero) {
    $proc = Get-Process -Name Weixin -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } |
      Select-Object -First 1
    if ($proc) { $h = [IntPtr]$proc.MainWindowHandle }
  }
  if ($h -eq [IntPtr]::Zero) {
    return [ordered]@{ ok = $false; visible = $false; hwnd = 0; title = ''; reason = '未找到微信主窗口；请先登录并打开微信主窗口（托盘隐藏需手工点开）' }
  }
  if (-not [WeChatOcrWin]::IsVisible($h) -or [WeChatOcrWin]::IsMinimized($h)) {
    if ($AutoShow) {
      [void][WeChatOcrWin]::Restore($h)
      Start-Sleep -Milliseconds 800
    } else {
      return [ordered]@{
        ok = $false; visible = $false; hwnd = $h.ToInt64(); title = '微信'; reason = '微信主窗口当前未显示；请打开窗口，或启动时加 -AutoShow'
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

if ($Mode -eq 'click') {
  if (-not $info.ok) { Write-Payload $info; exit 2 }
  $h = [IntPtr]$info.hwnd
  $fg = [WeChatOcrWin]::Focus($h, $true)
  $clicked = [WeChatOcrWin]::Click($X, $Y)
  Start-Sleep -Milliseconds 900
  [WeChatOcrWin]::Untop($h)
  Write-Payload ([ordered]@{ ok = $clicked; x = $X; y = $Y; foreground = $fg })
  exit $(if ($clicked) { 0 } else { 3 })
}

if ($Mode -eq 'search') {
  if (-not $info.ok) { Write-Payload $info; exit 2 }
  if (-not $Title) {
    Write-Payload ([ordered]@{ ok = $false; reason = 'search 模式必须提供 -Title' })
    exit 2
  }
  $h = [IntPtr]$info.hwnd
  [void][WeChatOcrWin]::Focus($h, $true)
  Start-Sleep -Milliseconds 200
  [void][WeChatOcrWin]::Fit($h)
  $rect = [WeChatOcrWin]::Rect($h)
  $left = $rect[0]
  $top = $rect[1]
  $width = $rect[2]
  $height = $rect[3]
  # 搜索控件固定在窗口左上：宽窗收成放大镜图标时中心约 (277,95)，窄窗搜索框也覆盖该点。
  $searchX = $left + 277
  $searchY = $top + 95
  [void][WeChatOcrWin]::Click($searchX, $searchY)
  Start-Sleep -Milliseconds 4000
  Set-Clipboard -Value $Title
  [WeChatOcrWin]::Paste()
  Start-Sleep -Milliseconds 1500

  $rectPath = $ImagePath
  if (-not $rectPath) { $rectPath = Join-Path $env:TEMP 'wechat-ocr-search.png' }
  $dir = Split-Path -Parent $rectPath
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not [WeChatOcrWin]::CaptureRect($h, $rectPath)) {
    [WeChatOcrWin]::Untop($h)
    Write-Payload ([ordered]@{ ok = $false; reason = '截图失败' })
    exit 3
  }
  $lines = Read-OcrLines $rectPath
  [WeChatOcrWin]::Untop($h)
  Write-Payload ([ordered]@{
    ok = $true
    left = $left
    top = $top
    width = $width
    height = $height
    image = $rectPath
    typed = $Title
    searchX = $searchX
    searchY = $searchY
    lines = $lines
  })
  exit 0
}

if ($Mode -eq 'switch') {
  if (-not $info.ok) { Write-Payload $info; exit 2 }
  if (-not $Title) {
    Write-Payload ([ordered]@{ ok = $false; reason = 'switch 模式必须提供 -Title' })
    exit 2
  }
  $h = [IntPtr]$info.hwnd
  [void][WeChatOcrWin]::Focus($h, $true)
  Start-Sleep -Milliseconds 200
  [void][WeChatOcrWin]::Fit($h)
  $rect = [WeChatOcrWin]::Rect($h)
  $left = $rect[0]
  $top = $rect[1]
  $width = $rect[2]
  $height = $rect[3]
  $needle = ($Title -replace '[^\p{L}\p{N}]', '').ToLower()
  $matchKey = if ($needle.Length -gt 6) { $needle.Substring(0, 6) } else { $needle }

  # 先看当前聊天标题和左侧会话列表：能直接点到的会话不走搜索，避免点开网页搜索结果。
  $listPath = Join-Path $env:TEMP 'wechat-ocr-switch-list.png'
  $listLine = $null
  if ([WeChatOcrWin]::Capture($h, $listPath)) {
    $listLines = Read-OcrLines $listPath
    $headerLine = $listLines | Where-Object { $_.x -gt ($width * 0.08) -and $_.y -lt ($height * 0.12) } |
      Where-Object {
        $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
        $norm -eq $matchKey -or ($norm.StartsWith($matchKey) -and $norm.Length -le ($matchKey.Length + 6))
      } | Select-Object -First 1
    $current = [bool]$headerLine
    if ($current) {
      [WeChatOcrWin]::Untop($h)
      Write-Payload ([ordered]@{ ok = $true; opened = $true; method = 'current'; typed = $Title; image = $listPath; lines = $listLines })
      exit 0
    }
    $listLine = $listLines | Where-Object {
      $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
      $_.x -lt ($width * 0.32) -and $_.y -gt ($height * 0.08) -and $norm.Contains($matchKey)
    } | Sort-Object y | Select-Object -First 1
    # 微信可以处在「只显示聊天」的单栏模式：左侧会话列表不可见，先点返回键回到列表再找。
    $hasHeader = $listLines | Where-Object {
      $_.x -gt ($width * 0.08) -and $_.x -lt ($width * 0.65) -and $_.y -lt ($height * 0.12)
    } | Select-Object -First 1
    if (-not $listLine -and $hasHeader) {
      [void][WeChatOcrWin]::Click($left + 143, $top + 83)
      Start-Sleep -Milliseconds 900
      [void][WeChatOcrWin]::Capture($h, $listPath)
      $listLines = Read-OcrLines $listPath
      $listLine = $listLines | Where-Object {
        $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
        $_.x -lt ($width * 0.32) -and $_.y -gt ($height * 0.08) -and $norm.Contains($matchKey)
      } | Sort-Object y | Select-Object -First 1
    }
  }
  if ($listLine) {
    $hitX = $left + [int][Math]::Round([Math]::Min($listLine.x + $listLine.w / 2, $width * 0.3))
    $hitY = $top + [int][Math]::Round($listLine.y + $listLine.h / 2)
    [void][WeChatOcrWin]::Click($hitX, $hitY)
    Start-Sleep -Milliseconds 1500
    [WeChatOcrWin]::Untop($h)
    $rectPath = $ImagePath
    if (-not $rectPath) { $rectPath = Join-Path $env:TEMP 'wechat-ocr-switch.png' }
    $dir = Split-Path -Parent $rectPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [void][WeChatOcrWin]::Capture($h, $rectPath)
    $lines = Read-OcrLines $rectPath
    Write-Payload ([ordered]@{
      ok = $true; opened = $true; method = 'list'; image = $rectPath; listImage = $listPath
      typed = $Title; hitX = $hitX; hitY = $hitY; lines = $lines
    })
    exit 0
  }

  $searchX = $left + 277
  $searchY = $top + 95
  [void][WeChatOcrWin]::Click($searchX, $searchY)
  Start-Sleep -Milliseconds 4000
  Set-Clipboard -Value $Title
  [WeChatOcrWin]::Paste()
  Start-Sleep -Milliseconds 1800

  $probePath = Join-Path $env:TEMP 'wechat-ocr-switch-probe.png'
  if (-not [WeChatOcrWin]::CaptureRect($h, $probePath)) {
    [WeChatOcrWin]::Untop($h)
    Write-Payload ([ordered]@{ ok = $false; reason = '搜索截图失败' })
    exit 3
  }
  $probeLines = Read-OcrLines $probePath
  # 只取「搜索网络结果」标题之下的行，避开输入框和「最近在搜」历史；OCR 有 0/O、1/l 混淆，先归一化。
  $label = $probeLines | Where-Object { $_.text -match '搜索.*结果|网络结果' } | Sort-Object y | Select-Object -First 1
  $minY = if ($label) { $label.y + 18 } else { $height * 0.2 }
  $resultLine = $probeLines | Where-Object {
    $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
    $_.y -gt $minY -and $_.x -lt ($width * 0.55) -and $norm.Contains($matchKey)
  } | Sort-Object y | Select-Object -First 1
  if (-not $resultLine) {
    [WeChatOcrWin]::Untop($h)
    Write-Payload ([ordered]@{ ok = $false; reason = '未找到目标会话搜索结果'; image = $probePath; lines = $probeLines })
    exit 4
  }
  $hitX = $left + [int][Math]::Round($resultLine.x + [Math]::Min(80, $resultLine.w / 2))
  $hitY = $top + [int][Math]::Round($resultLine.y + $resultLine.h / 2)
  [void][WeChatOcrWin]::Click($hitX, $hitY)
  Start-Sleep -Milliseconds 2200
  [WeChatOcrWin]::Untop($h)

  $rectPath = $ImagePath
  if (-not $rectPath) { $rectPath = Join-Path $env:TEMP 'wechat-ocr-switch.png' }
  $dir = Split-Path -Parent $rectPath
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not [WeChatOcrWin]::Capture($h, $rectPath)) {
    Write-Payload ([ordered]@{ ok = $false; reason = '切换后截图失败'; image = $probePath; hitX = $hitX; hitY = $hitY })
    exit 3
  }
  $lines = Read-OcrLines $rectPath
  Write-Payload ([ordered]@{
    ok = $true
    left = $left
    top = $top
    width = $width
    height = $height
    image = $rectPath
    probe = $probePath
    typed = $Title
    hitX = $hitX
    hitY = $hitY
    opened = [bool]($lines | Where-Object {
      $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
      $_.y -lt ($height * 0.12) -and ($norm -eq $matchKey -or ($norm.StartsWith($matchKey) -and $norm.Length -le ($matchKey.Length + 6)))
    })
    lines = $lines
  })
  exit 0
}

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
$rect = [WeChatOcrWin]::Rect($h)
Write-Payload ([ordered]@{
  ok = $true
  visible = $true
  hwnd = $h.ToInt64()
  title = '微信'
  left = $rect[0]
  top = $rect[1]
  width = $width
  height = $height
  image = $rectPath
  lines = $lines
})
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠