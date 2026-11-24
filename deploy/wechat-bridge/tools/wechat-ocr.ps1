# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#
# 微信 4.x 截图 + Windows OCR 只读探测。
# 只做三件事：找到 Weixin 主窗口、截图、调用 Windows.Media.Ocr 识别中文。
# 不注入、不读内存、不改微信文件；普通 read 默认后台 PrintWindow，不置顶、不抢焦点。
# 隐藏/最小化时 -Background 先放到 z-order 底部显示再截图，随后恢复隐藏；-AutoShow 才还原窗口。
# 朋友圈 -Background 复用已打开窗口；对 MMUIRenderSubWindowHW 子窗发滚轮可后台翻页。
# 前台模式用 UI Automation 找「发现」页签再点朋友圈；后台模式不点导航、不抢焦点。

param(
  [ValidateSet('status', 'read', 'search', 'click', 'switch', 'ocr', 'windows', 'moments')]
  [string]$Mode = 'read',
  [string]$ImagePath = '',
  [string]$JsonPath = '',
  [string]$Title = '',
  [int]$X = 0,
  [int]$Y = 0,
  [int]$MaxPages = 3,
  [switch]$AutoShow,
  [switch]$Background
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
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

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

  // 后台截图状态：0=隐藏，1=已显示，2=最小化。截图前只把隐藏/最小化窗口放到 z-order 底部再显示，
  // 不激活、不置顶、不抢焦点；用户当前窗口仍在最前。
  public static int BackgroundState(IntPtr h) {
    if (IsIconic(h)) return 2;
    if (!IsWindowVisible(h)) return 0;
    return 1;
  }
  public static void ShowBehind(IntPtr h) {
    ShowWindow(h, 4);
    SetWindowPos(h, new IntPtr(1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
    System.Threading.Thread.Sleep(500);
  }
  public static void FinishBackground(IntPtr h, int state) {
    if (state == 0) ShowWindow(h, 0);
    else if (state == 2) ShowWindow(h, 6);
  }

  // 微信 4.x 朋友圈可能是独立窗口，标题为「朋友圈」；主窗口内嵌时找不到就退回主窗口。
  public static IntPtr FindByTitle(string wanted) {
    IntPtr best = IntPtr.Zero;
    int bestArea = 0;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      StringBuilder cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      string c = cls.ToString();
      if (!c.StartsWith("Qt51514QWindowIcon") && c != "mmui::MainWindow") return true;
      StringBuilder title = new StringBuilder(256);
      GetWindowText(h, title, 256);
      if (title.ToString() != wanted) return true;
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      int w = r.Right - r.Left;
      int hgt = r.Bottom - r.Top;
      if (w < 400 || hgt < 300) return true;
      int area = w * hgt;
      if (area > bestArea) { best = h; bestArea = area; }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  // 诊断用：列出所有标题「微信」的 Qt 窗口及矩形/可见/最小化状态，排查多候选窗选错。
  public static string Candidates() {
    StringBuilder sb = new StringBuilder();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      StringBuilder cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      StringBuilder title = new StringBuilder(256);
      GetWindowText(h, title, 256);
      if (title.ToString() != "微信") return true;
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      int w = r.Right - r.Left;
      int ht = r.Bottom - r.Top;
      sb.Append(h.ToInt64()).Append('|').Append(cls.ToString()).Append('|').Append(w).Append('x').Append(ht)
        .Append('|').Append(IsWindowVisible(h) ? "vis" : "hidden")
        .Append('|').Append(IsIconic(h) ? "min" : "normal").Append('\n');
      return true;
    }, IntPtr.Zero);
    return sb.ToString();
  }

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
    if (IsIconic(h)) { ShowWindow(h, 9); System.Threading.Thread.Sleep(400); }
    if (left + targetW > screenW) left = 20;
    if (top + targetH > screenH) top = 20;
    if (r.Right - r.Left != targetW || r.Bottom - r.Top != targetH || left != r.Left || top != r.Top) {
      SetWindowPos(h, new IntPtr(-1), left, top, targetW, targetH, 0x0004 | 0x0010);
      System.Threading.Thread.Sleep(350);
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

  // 只举到最前、不抢焦点、不改尺寸；用于后台 PrintWindow 截图，避免 PrintWindow 在窗口被遮挡时返回黑图。
  public static void ShowTop(IntPtr h) {
    ShowWindow(h, 4);
    SetWindowPos(h, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
    System.Threading.Thread.Sleep(250);
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

  // 会话列表可能因上次点击停在中间：滚轮向上到顶，保证目标行可见（delta 正数=向上）。
  public static void Wheel(int x, int y, int delta) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(150);
    mouse_event(0x0800, 0, 0, (uint)delta, UIntPtr.Zero);
    System.Threading.Thread.Sleep(120);
  }

  // 微信 4.2 的 Qt 内容实际画在 MMUIRenderSubWindowHW 子窗里；直接对它 SendMessage
  // WM_MOUSEWHEEL 可以在后台滚动朋友圈，不需要 SetCursorPos/Focus/前台，也不会抢焦点。
  public static IntPtr FindRenderChild(IntPtr parent) {
    IntPtr best = IntPtr.Zero;
    int bestArea = 0;
    EnumChildWindows(parent, delegate(IntPtr h, IntPtr l) {
      StringBuilder cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      if (cls.ToString() != "MMUIRenderSubWindowHW") return true;
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      int area = (r.Right - r.Left) * (r.Bottom - r.Top);
      if (area > bestArea) { best = h; bestArea = area; }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  public static bool BackgroundWheel(IntPtr h, int screenX, int screenY, int delta) {
    if (h == IntPtr.Zero) return false;
    IntPtr target = FindRenderChild(h);
    if (target == IntPtr.Zero) target = h;
    long wp = ((long)(ushort)delta) << 16;
    long lp = ((long)(ushort)screenY << 16) | (ushort)screenX;
    SendMessage(target, 0x020A, (IntPtr)wp, (IntPtr)lp);
    System.Threading.Thread.Sleep(120);
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

  // 群聊发送人昵称比正文小、颜色更浅。OCR 只给文字框，这里在框内采样，
  // 返回“背景中位亮度 + 文字相对背景的对比度”。驱动用对比度区分昵称/正文。
  public static double[] InkStats(Bitmap bmp, int x, int y, int w, int h) {
    if (bmp == null) return new double[] { -1, -1 };
    int left = Math.Max(0, x);
    int top = Math.Max(0, y);
    int right = Math.Min(bmp.Width, x + w);
    int bottom = Math.Min(bmp.Height, y + h);
    if (right - left < 2 || bottom - top < 2) return new double[] { -1, -1 };
    int step = Math.Max(1, Math.Min(2, Math.Min(w, h) / 8));
    int[] luma = new int[((right - left + step - 1) / step) * ((bottom - top + step - 1) / step)];
    int n = 0;
    for (int yy = top; yy < bottom; yy += step) {
      for (int xx = left; xx < right; xx += step) {
        Color c = bmp.GetPixel(xx, yy);
        luma[n++] = (int)(0.2126 * c.R + 0.7152 * c.G + 0.0722 * c.B);
      }
    }
    if (n < 4) return new double[] { -1, -1 };
    int[] sample = new int[n];
    Array.Copy(luma, sample, n);
    Array.Sort(sample);
    double median = sample[sample.Length / 2];
    int[] deviations = new int[n];
    for (int i = 0; i < n; i++) deviations[i] = (int)Math.Abs(sample[i] - median);
    Array.Sort(deviations);
    int take = Math.Max(1, n / 5);
    double sum = 0;
    for (int i = deviations.Length - take; i < deviations.Length; i++) sum += deviations[i];
    return new double[] { median, sum / take };
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
    if ($Background) {
      # 后台模式只允许 PrintWindow 截当前窗口，不还原、不置顶、不抢焦点。
      return [ordered]@{ ok = $true; visible = $false; hwnd = $h.ToInt64(); title = '微信'; reason = $null }
    }
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

# 4.2 左侧导航是纯图标，OCR 识别不到「朋友圈」文字；用 UI Automation 找「发现」页签，
# 再在发现页里找朋友圈入口。仅在显式前台模式使用，后台轮询不调用。
function Find-UiaButton($windowHandle, $name) {
  try {
    Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
    Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
    $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$windowHandle)
    $byName = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::NameProperty,
      $name
    )
    $byButton = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Button
    )
    $and = New-Object System.Windows.Automation.AndCondition($byName, $byButton)
    $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $and)
    if (-not $element) { return $null }
    $rect = $element.Current.BoundingRectangle
    if ($rect.Width -le 0 -or $rect.Height -le 0) { return $null }
    return [ordered]@{ x = $rect.X; y = $rect.Y; width = $rect.Width; height = $rect.Height }
  } catch {
    return $null
  }
}

function Write-Payload($payload) {  $json = $payload | ConvertTo-Json -Depth 8 -Compress
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

function Read-OcrLines($path) {  Add-Type -AssemblyName System.Runtime.WindowsRuntime
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
  $sampleBitmap = $null
  try { $sampleBitmap = [System.Drawing.Bitmap]::new($path) } catch { $sampleBitmap = $null }
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
    $contrast = -1.0
    if ($sampleBitmap) {
      try {
        $stats = [WeChatOcrWin]::InkStats(
          $sampleBitmap,
          [int][Math]::Floor($minX),
          [int][Math]::Floor($minY),
          [int][Math]::Ceiling($maxR - $minX),
          [int][Math]::Ceiling($maxB - $minY)
        )
        if ($stats[1] -gt 0) { $contrast = [Math]::Round($stats[1], 1) }
      } catch {
        $contrast = -1.0
      }
    }
    $lines += [ordered]@{
      text = $text
      x = [Math]::Round($minX, 1)
      y = [Math]::Round($minY, 1)
      w = [Math]::Round($maxR - $minX, 1)
      h = [Math]::Round($maxB - $minY, 1)
      contrast = $contrast
    }
  }
  if ($sampleBitmap) { $sampleBitmap.Dispose() }
  return $lines
}

function Find-ListLine($lines, $key, $ascii, $w, $hgt) {
  return $lines | Where-Object {
    $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
    $_.x -lt ($w * 0.32) -and $_.y -gt ($hgt * 0.08) -and
      ($norm.Contains($key) -or ($ascii -and $norm.Contains($ascii)))
  } | Sort-Object y | Select-Object -First 1
}

# 微信 4.2 的朋友圈不是独立顶层窗口，而是主窗内嵌页：左栏仍显示「发现」导航，
# 右侧才是动态流。不能只靠 FindByTitle('朋友圈') 判断；后台模式复用主窗时，
# 用「左栏有朋友圈 + 右侧有正文/全文」确认当前确实停在内嵌朋友圈页。
function Test-EmbeddedMomentsPage($lines, $w, $hgt) {
  if (-not $lines -or $lines.Count -eq 0 -or $w -le 0 -or $hgt -le 0) { return $false }
  # 左侧「朋友圈」有时被红点/未读角标干扰，OCR 会读成「DO号」；此时用「发现」
  # 加右侧动态流作为等价证据，避免把已经打开的内嵌朋友圈误判成未打开。
  $nav = $lines | Where-Object {
    $_.text -match '^(朋友圈|发现)$' -and $_.x -lt ($w * 0.28) -and $_.y -gt ($hgt * 0.05)
  } | Select-Object -First 1
  if (-not $nav) { return $false }
  $feed = @($lines | Where-Object {
    $_.x -gt ($w * 0.35) -and $_.y -gt ($hgt * 0.1) -and
      (($_.text -replace '\s', '').Length -ge 2)
  })
  if ($feed.Count -ge 2) { return $true }
  return [bool]($lines | Where-Object {
    $_.text -match '^全文$' -and $_.x -gt ($w * 0.35)
  } | Select-Object -First 1)
}

# 深色主题 + 小字号下 Windows OCR 会漏掉会话标题（实测 1240×1120 原图只识别到正文，
# 2 倍放大后「微信ClawBot」标题才出现）。列表/搜索结果判定用放大副本来补这一档。
function Read-OcrLinesScaled($path, [double]$scale = 2.0) {
  $src = [System.Drawing.Image]::FromFile($path)
  if ($src.Width * $scale -gt 4000 -or $src.Height * $scale -gt 4000) { $scale = 1.0 }
  if ($scale -le 1.0) { $src.Dispose(); return (Read-OcrLines $path) }
  $bmp = [System.Drawing.Bitmap]::new([int]($src.Width * $scale), [int]($src.Height * $scale))
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $bmp.Width, $bmp.Height)
  $g.Dispose()
  $src.Dispose()
  $scaledPath = Join-Path $env:TEMP 'wechat-ocr-scaled.png'
  $bmp.Save($scaledPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $lines = Read-OcrLines $scaledPath
  foreach ($line in $lines) {
    $line.x = [Math]::Round($line.x / $scale, 1)
    $line.y = [Math]::Round($line.y / $scale, 1)
    $line.w = [Math]::Round($line.w / $scale, 1)
    $line.h = [Math]::Round($line.h / $scale, 1)
  }
  return $lines
}

if ($Mode -eq 'ocr') {
  if (-not $ImagePath -or -not (Test-Path -LiteralPath $ImagePath)) {
    Write-Payload ([ordered]@{ ok = $false; reason = 'ocr 模式必须提供存在的 -ImagePath' })
    exit 2
  }
  $bmp = [System.Drawing.Image]::FromFile($ImagePath)
  $w = $bmp.Width
  $hgt = $bmp.Height
  $bmp.Dispose()
  $lines = Read-OcrLines $ImagePath
  Write-Payload ([ordered]@{ ok = $true; image = $ImagePath; width = $w; height = $hgt; lines = $lines })
  exit 0
}

if ($Mode -eq 'windows') {
  $raw = [WeChatOcrWin]::Candidates()
  $list = @($raw -split "`n" | Where-Object { $_.Trim() })
  Write-Payload ([ordered]@{ ok = $true; candidates = $list })
  exit 0
}

$info = Get-WindowInfo

if ($Mode -eq 'moments') {
  if (-not $info.ok) { Write-Payload $info; exit 2 }
  $h = [IntPtr]$info.hwnd
  $bgState = 0
  $mhState = 0
  if ($Background) {
    $bgState = [WeChatOcrWin]::BackgroundState($h)
    if ($bgState -ne 1) { [WeChatOcrWin]::ShowBehind($h) }
    $rect = [WeChatOcrWin]::Rect($h)
  } else {
    [void][WeChatOcrWin]::Focus($h, $true)
    [void][WeChatOcrWin]::Fit($h)
    $rect = [WeChatOcrWin]::Rect($h)
  }
  $left = $rect[0]
  $top = $rect[1]
  $width = $rect[2]
  $height = $rect[3]
  if ($width -lt 600 -or $height -lt 500) {
    if (-not $Background) { [WeChatOcrWin]::Untop($h) }
    if ($Background) { [WeChatOcrWin]::FinishBackground($h, $bgState) }
    Write-Payload ([ordered]@{ ok = $false; reason = "微信窗口尺寸异常 ${width}x${height}" })
    exit 5
  }
  $mh = [WeChatOcrWin]::FindByTitle('朋友圈')
  $embedded = $false
  if ($mh -ne [IntPtr]::Zero) {
    # 用户已经手动打开朋友圈时直接用，不再要求识别左侧导航。
    if ($Background) {
      $mhState = [WeChatOcrWin]::BackgroundState($mh)
      if ($mhState -ne 1) { [WeChatOcrWin]::ShowBehind($mh) }
    } else {
      [void][WeChatOcrWin]::Focus($mh, $true)
    }
    Start-Sleep -Milliseconds 500
  } elseif ($Background) {
    # 后台模式不点导航、不移动鼠标：先看主窗是不是已经停在内嵌朋友圈页。
    # 4.2 的朋友圈嵌在主窗里，没有独立「朋友圈」窗口，不能直接判失败。
    $mainPath = Join-Path $env:TEMP 'wechat-ocr-moments-main-bg.png'
    $mainLines = @()
    if ([WeChatOcrWin]::Capture($h, $mainPath)) {
      $mainLines = Read-OcrLines $mainPath
      if ($mainLines.Count -eq 0) { $mainLines = Read-OcrLinesScaled $mainPath 2 }
    }
    if (Test-EmbeddedMomentsPage $mainLines $width $height) {
      $mh = $h
      $embedded = $true
    } else {
      [WeChatOcrWin]::FinishBackground($h, $bgState)
      Write-Payload ([ordered]@{
        ok = $false
        reason = '朋友圈未打开；后台模式不会自动点左侧导航（会移动鼠标/抢焦点）。请先在微信里打开朋友圈，再后台遍历；需要自动导航请去掉 -Background。'
        width = $width
        height = $height
        background = $true
      })
      exit 4
    }
  } else {
    $mainPath = Join-Path $env:TEMP 'wechat-ocr-moments-main.png'
    if (-not [WeChatOcrWin]::Capture($h, $mainPath)) {
      [WeChatOcrWin]::Untop($h)
      Write-Payload ([ordered]@{ ok = $false; reason = '朋友圈入口截图失败' })
      exit 3
    }
    $mainLines = Read-OcrLines $mainPath
    $navLine = $mainLines | Where-Object {
      $_.text -match '^朋友圈$' -and $_.x -lt ($width * 0.2) -and $_.y -gt ($height * 0.1)
    } | Select-Object -First 1
    if (-not $navLine) {
      $mainLines = Read-OcrLinesScaled $mainPath 2
      $navLine = $mainLines | Where-Object {
        $_.text -match '^朋友圈$' -and $_.x -lt ($width * 0.2) -and $_.y -gt ($height * 0.1)
      } | Select-Object -First 1
    }
    if (-not $navLine) {
      # 4.2 左侧导航只有图标，没有「朋友圈」文字；先点 UI Automation 的「发现」页签。
      $discover = Find-UiaButton $h '发现'
      if (-not $discover) {
        [WeChatOcrWin]::Untop($h)
        Write-Payload ([ordered]@{
          ok = $false
          reason = '没有识别到左侧「发现」页签（UIA 未返回按钮）；请确认微信主窗口已展开'
          width = $width
          height = $height
          image = $mainPath
        })
        exit 4
      }
      [void][WeChatOcrWin]::Click(
        [int][Math]::Round($discover.x + $discover.width / 2),
        [int][Math]::Round($discover.y + $discover.height / 2)
      )
      Start-Sleep -Milliseconds 1800
      if (-not [WeChatOcrWin]::Capture($h, $mainPath)) {
        [WeChatOcrWin]::Untop($h)
        Write-Payload ([ordered]@{ ok = $false; reason = '发现页截图失败' })
        exit 3
      }
      $mainLines = Read-OcrLines $mainPath
      $navLine = $mainLines | Where-Object { $_.text -match '朋友圈' } | Select-Object -First 1
      if (-not $navLine) {
        $mainLines = Read-OcrLinesScaled $mainPath 2
        $navLine = $mainLines | Where-Object { $_.text -match '朋友圈' } | Select-Object -First 1
      }
    }
    if (-not $navLine) {
      [WeChatOcrWin]::Untop($h)
      Write-Payload ([ordered]@{
        ok = $false
        reason = '已点开「发现」页，但没有识别到「朋友圈」入口；请确认微信主窗口已展开'
        width = $width
        height = $height
        image = $mainPath
      })
      exit 4
    }
    $hitX = $left + [int][Math]::Round($navLine.x + $navLine.w / 2)
    $hitY = $top + [int][Math]::Round($navLine.y + $navLine.h / 2)
    [void][WeChatOcrWin]::Click($hitX, $hitY)
    Start-Sleep -Milliseconds 1800
    $mh = [WeChatOcrWin]::FindByTitle('朋友圈')
    if ($mh -eq [IntPtr]::Zero) {
      $mh = $h
      $embedded = $true
    } else {
      [void][WeChatOcrWin]::Focus($mh, $true)
      Start-Sleep -Milliseconds 500
    }
  }
  # 后台也能真正翻页：微信 4.2 的 Qt 内容画在 MMUIRenderSubWindowHW 子窗里，
  # 对子窗 SendMessage WM_MOUSEWHEEL 不需要前台、不移动鼠标、不抢焦点。
  # 每一页 OCR 后比对文本签名，滚不动就停，避免把同一页重复算成多页。
  $pageCount = [Math]::Min([Math]::Max($MaxPages, 1), 30)
  $pages = @()
  $lastSignature = $null
  $scrollStalled = $false
  for ($page = 1; $page -le $pageCount; $page++) {
    $pagePath = if ($ImagePath) {
      [System.IO.Path]::Combine(
        [System.IO.Path]::GetDirectoryName($ImagePath),
        ("{0}-page{1}.png" -f [System.IO.Path]::GetFileNameWithoutExtension($ImagePath), $page)
      )
    } else {
      Join-Path $env:TEMP "wechat-ocr-moments-page$page.png"
    }
    if (-not [WeChatOcrWin]::Capture($mh, $pagePath)) { break }
    $pageRect = [WeChatOcrWin]::Rect($mh)
    $pageWidth = $pageRect[2]
    $pageHeight = $pageRect[3]
    $lines = Read-OcrLines $pagePath
    if ($lines.Count -eq 0) {
      $lines = Read-OcrLinesScaled $pagePath 2
    }
    $signature = (@($lines | ForEach-Object { $_.text }) -join "`n")
    if ($page -gt 1 -and $signature -eq $lastSignature) {
      $scrollStalled = $true
      break
    }
    $pages += [ordered]@{
      page = $page
      image = $pagePath
      width = $pageWidth
      height = $pageHeight
      lines = $lines
    }
    $lastSignature = $signature
    if ($page -lt $pageCount) {
      [void][WeChatOcrWin]::BackgroundWheel(
        $mh,
        ($pageRect[0] + [int][Math]::Round($pageWidth * 0.5)),
        ($pageRect[1] + [int][Math]::Round($pageHeight * 0.55)),
        -600
      )
      Start-Sleep -Milliseconds 1200
    }
  }
  if ($Background) {
    if (-not $embedded -and $mh -ne $h -and $mh -ne [IntPtr]::Zero) {
      [WeChatOcrWin]::FinishBackground($mh, $mhState)
    }
    [WeChatOcrWin]::FinishBackground($h, $bgState)
  } else {
    if (-not $embedded) { [WeChatOcrWin]::Esc() }
    [WeChatOcrWin]::Untop($h)
  }
  if ($pages.Count -eq 0) {
    Write-Payload ([ordered]@{ ok = $false; reason = '朋友圈窗口截图/OCR 没有产出任何页面' })
    exit 6
  }
  $reason = if ($scrollStalled) {
    '后台滚轮没有改变页面，可能已到朋友圈底部或当前版本不响应'
  } elseif ($Background) {
    '后台已抓取多页；图片、点赞、评论可能缺失'
  } elseif ($pages.Count -lt $pageCount) {
    '前台遍历提前结束'
  } else {
    $null
  }
  Write-Payload ([ordered]@{
    ok = $true
    title = '朋友圈'
    method = 'sidebar'
    embedded = $embedded
    background = [bool]$Background
    partial = [bool]($scrollStalled -or ($pages.Count -lt $pageCount))
    reason = $reason
    width = $width
    height = $height
    maxPages = $pageCount
    pages = $pages
  })
  exit 0
}

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
  Start-Sleep -Milliseconds 500
  [void][WeChatOcrWin]::Fit($h)
  $rect = [WeChatOcrWin]::Rect($h)
  if ($rect[2] -lt 600 -or $rect[3] -lt 500) {
    [void][WeChatOcrWin]::Restore($h)
    Start-Sleep -Milliseconds 800
    [void][WeChatOcrWin]::Fit($h)
    $rect = [WeChatOcrWin]::Rect($h)
  }
  $left = $rect[0]
  $top = $rect[1]
  $width = $rect[2]
  $height = $rect[3]
  $needle = ($Title -replace '[^\p{L}\p{N}]', '').ToLower()
  if ($width -lt 600 -or $height -lt 500) {
    [WeChatOcrWin]::Untop($h)
    Write-Payload ([ordered]@{ ok = $false; reason = "微信窗口尺寸异常 ${width}x${height}"; left = $left; top = $top })
    exit 5
  }
  $matchKey = if ($needle.Length -gt 6) { $needle.Substring(0, 6) } else { $needle }
  # 中文标题被 OCR 丢字时（「微信ClawBot」常被识别成「GClawBot」），用 ASCII 尾段兜底匹配。
  $asciiKey = (($Title -replace '[^\x00-\x7F]', '') -replace '[^\p{L}\p{N}]', '').ToLower()
  if ($asciiKey.Length -lt 3) { $asciiKey = '' }

  # 先看当前聊天标题和左侧会话列表：能直接点到的会话不走搜索，避免点开网页搜索结果。
  $listPath = Join-Path $env:TEMP 'wechat-ocr-switch-list.png'
  $listLine = $null
  [WeChatOcrWin]::Wheel($left + 300, $top + 300, -600)
  Start-Sleep -Milliseconds 400
  if ([WeChatOcrWin]::Capture($h, $listPath)) {
    $listLines = Read-OcrLines $listPath
    $headerLine = $listLines | Where-Object { $_.x -gt ($width * 0.08) -and $_.y -lt ($height * 0.12) } |
      Where-Object {
        $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
        $norm -eq $matchKey -or ($norm.StartsWith($matchKey) -and $norm.Length -le ($matchKey.Length + 6)) -or ($asciiKey -and $norm.Contains($asciiKey))
      } | Select-Object -First 1
    if (-not $headerLine) {
      $scaledLines = Read-OcrLinesScaled $listPath 2
      if ($scaledLines.Count -gt 0) {
        $listLines = $scaledLines
        $headerLine = $listLines | Where-Object { $_.x -gt ($width * 0.08) -and $_.y -lt ($height * 0.12) } |
          Where-Object {
            $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
            $norm -eq $matchKey -or ($norm.StartsWith($matchKey) -and $norm.Length -le ($matchKey.Length + 6)) -or ($asciiKey -and $norm.Contains($asciiKey))
          } | Select-Object -First 1
      }
    }
    $current = [bool]$headerLine
    if ($current) {
      [WeChatOcrWin]::Untop($h)
      Write-Payload ([ordered]@{ ok = $true; opened = $true; method = 'current'; typed = $Title; image = $listPath; lines = $listLines })
      exit 0
    }
    $listLine = Find-ListLine $listLines $matchKey $asciiKey $width $height
    # 微信可以处在「只显示聊天」的单栏模式：左侧会话列表不可见，先点返回键回到列表再找。
    $hasHeader = $listLines | Where-Object {
      $_.x -gt ($width * 0.08) -and $_.x -lt ($width * 0.65) -and $_.y -lt ($height * 0.12)
    } | Select-Object -First 1
    if (-not $listLine -and $hasHeader) {
      [void][WeChatOcrWin]::Click($left + 143, $top + 83)
      Start-Sleep -Milliseconds 1200
      [WeChatOcrWin]::Wheel($left + 300, $top + 300, 900)
      Start-Sleep -Milliseconds 400
      [void][WeChatOcrWin]::Capture($h, $listPath)
      $listLines = Read-OcrLines $listPath
      $listLine = Find-ListLine $listLines $matchKey $asciiKey $width $height
    }
    # 会话列表可能很长且停在上次点击的位置：先向上翻到顶，再向下逐屏找。
    for ($i = 0; $i -lt 6 -and -not $listLine; $i++) {
      [WeChatOcrWin]::Wheel($left + 300, $top + 300, 900)
      Start-Sleep -Milliseconds 500
      if (-not [WeChatOcrWin]::Capture($h, $listPath)) { break }
      $listLines = Read-OcrLines $listPath
      $listLine = Find-ListLine $listLines $matchKey $asciiKey $width $height
    }
    for ($i = 0; $i -lt 8 -and -not $listLine; $i++) {
      [WeChatOcrWin]::Wheel($left + 300, $top + 300, -900)
      Start-Sleep -Milliseconds 500
      if (-not [WeChatOcrWin]::Capture($h, $listPath)) { break }
      $listLines = Read-OcrLines $listPath
      $listLine = Find-ListLine $listLines $matchKey $asciiKey $width $height
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
    $_.y -gt $minY -and $_.x -lt ($width * 0.55) -and ($norm.Contains($matchKey) -or ($asciiKey -and $norm.Contains($asciiKey)))
  } | Sort-Object y | Select-Object -First 1
  if (-not $resultLine) {
    [WeChatOcrWin]::Untop($h)
    Write-Payload ([ordered]@{ ok = $false; reason = '未找到目标会话搜索结果'; image = $probePath; listImage = $listPath; listLines = $listLines; lines = $probeLines })
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
  $opened = [bool]($lines | Where-Object {
    $norm = ($_.text -replace '[^\p{L}\p{N}]', '').ToLower() -replace '0', 'o' -replace '1', 'l'
    $_.y -lt ($height * 0.12) -and ($norm -eq $matchKey -or ($norm.StartsWith($matchKey) -and $norm.Length -le ($matchKey.Length + 6)) -or ($asciiKey -and $norm.Contains($asciiKey)))
  })
  if (-not $opened) {
    Write-Payload ([ordered]@{ ok = $false; reason = '已点击搜索结果但未打开目标会话'; image = $rectPath; probe = $probePath; hitX = $hitX; hitY = $hitY; lines = $lines })
    exit 4
  }
  [WeChatOcrWin]::Untop($h)
  Write-Payload ([ordered]@{
    ok = $true
    left = $left
    top = $top
    width = $width
    height = $height
    image = $rectPath
    probe = $probePath
    method = 'search'
    typed = $Title
    hitX = $hitX
    hitY = $hitY
    opened = $true
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
$pre = [WeChatOcrWin]::Rect($h)
if (-not $Background -and $pre[2] -gt 1600) { [void][WeChatOcrWin]::Fit($h) }
$rectPath = $ImagePath
if (-not $rectPath) {
  $rectPath = Join-Path $env:TEMP 'wechat-ocr-frame.png'
}
$dir = Split-Path -Parent $rectPath
if ($dir -and -not (Test-Path -LiteralPath $dir)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
if ($Background) {
  # 后台模式不调用 ShowTop/Untop；隐藏/最小化时只放到底部显示，截图后恢复隐藏状态。
  $bgState = [WeChatOcrWin]::BackgroundState($h)
  if ($bgState -ne 1) { [WeChatOcrWin]::ShowBehind($h) }
  $captured = [WeChatOcrWin]::Capture($h, $rectPath)
  [WeChatOcrWin]::FinishBackground($h, $bgState)
} else {
  [WeChatOcrWin]::ShowTop($h)
  $captured = [WeChatOcrWin]::Capture($h, $rectPath)
  [WeChatOcrWin]::Untop($h)
}
if (-not $captured) {
  Write-Payload ([ordered]@{ ok = $false; visible = $false; hwnd = $h.ToInt64(); title = '微信'; reason = '后台截图失败；窗口可能被最小化或 DWM 未提供可读表面' })
  exit 3
}

Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Image]::FromFile($rectPath)
$width = $bmp.Width
$height = $bmp.Height
$bmp.Dispose()
$lines = Read-OcrLines $rectPath
$rect = [WeChatOcrWin]::Rect($h)
# 宽窗列表+聊天布局下，标题「微信ClawBot」在深色背景上常被正常 OCR 漏掉；
# 正常帧找不到标题时，额外给一份 2 倍放大的行，让驱动只补标题、不把列表行当消息。
$headerSeen = $lines | Where-Object {
  $_.y -lt ($height * 0.09) -and $_.x -gt ($width * 0.06) -and $_.x -lt ($width * 0.55) -and
  $_.text -notmatch '搜索|凶'
} | Select-Object -First 1
# 4.x 群昵称常常只有 17px 高、颜色又淡，正常 OCR 会整行漏掉；群标题命中人数标记时
# 额外跑一遍 2 倍放大 OCR，驱动只在群聊里用它补发送人，不把放大后的列表行当正文。
$groupHeaderSeen = $lines | Where-Object {
  $_.y -lt ($height * 0.12) -and $_.x -gt ($width * 0.06) -and $_.x -lt ($width * 0.55) -and
  $_.text -match '[（(]\s*\d{1,4}\s*[）)]'
} | Select-Object -First 1
$groupScaledLines = if ($groupHeaderSeen) { @(Read-OcrLinesScaled $rectPath 2) } else { @() }
if (-not $headerSeen) {
  $payload = [ordered]@{
    ok = $true
    visible = [bool]$info.visible
    hwnd = $h.ToInt64()
    title = '微信'
    left = $rect[0]
    top = $rect[1]
    width = $width
    height = $height
    image = $rectPath
    lines = $lines
    linesScaled = (Read-OcrLinesScaled $rectPath 2)
  }
  Write-Payload $payload
  exit 0
}
Write-Payload ([ordered]@{
  ok = $true
  visible = [bool]$info.visible
  hwnd = $h.ToInt64()
  title = '微信'
  left = $rect[0]
  top = $rect[1]
  width = $width
  height = $height
  image = $rectPath
  lines = $lines
  linesScaled = $groupScaledLines
})
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
