# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#
# 微信 4.x UIA 只读探测脚本（自研，自成一体，不依赖 wechat-ocr.ps1）。
# 采集硬约束：moments/status/dump 只读，不点击、不 SetFocus、不 SetCursorPos / mouse_event、
# 不开关窗口、不杀进程、不重启 8848。翻页只允许对 MMUIRenderSubWindowHW 子窗
# SendMessage WM_MOUSEWHEEL（后台消息，不抢焦点、不移动鼠标）。
# open 模式例外：仅在朋友圈未打开时，向主窗 PostMessage 鼠标消息点击「发现」→「朋友圈」；
# 不 ShowWindow / 不 SetForegroundWindow / 不 SetFocus / 不移动系统鼠标。
# 导航失败时直接返回 ok=false 与原因，不把未进入朋友圈伪装成已采集。
#
# 输出 JSON（-OutFile，UTF8 无 BOM）：
#   ok, mode='uia', driver='uia', pages, maxPages, stopReason, limitReached,
#   occludedBy, reason, window{main,render,class}, pageSignatures[], total,
#   elapsedMs, items[]
# item: page, index, name(原文保留换行), lines[], controlType, className,
#       bounds{x,y,w,h}, children[]（仅一层：controlType/name/className/lines）

param(
  [ValidateSet('moments', 'status', 'dump', 'open')]
  [string]$Mode = 'moments',
  [ValidateRange(1, 30)]
  [int]$MaxPages = 30,
  [string]$OutFile = '',
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

# ---------- Win32 只读互操作：只枚举/读取矩形/类名/标题 + 后台滚轮消息 ----------
# 刻意不导入 ShowWindow / SetForegroundWindow / SetActiveWindow / SetFocus /
# SetWindowPos / SetCursorPos / mouse_event / keybd_event 等任何输入注入或窗口开关 API。
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public class WeChatUiaWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }

  public static void MakeAware() { SetProcessDPIAware(); }

  static bool IsWeChatClass(string c) {
    return c.StartsWith("Qt51514QWindowIcon") || c == "mmui::MainWindow";
  }

  // 微信 4.2 主窗口类名 Qt51514QWindowIcon，标题「微信」；按面积过滤掉小通知弹窗。
  public static IntPtr FindMain() {
    IntPtr best = IntPtr.Zero;
    int bestArea = 0;
    bool bestVisible = false;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      StringBuilder cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      if (!IsWeChatClass(cls.ToString())) return true;
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

  // 朋友圈若为独立顶层窗口，标题「朋友圈」；主窗内嵌时返回 Zero。
  public static IntPtr FindByTitle(string wanted) {
    IntPtr best = IntPtr.Zero;
    int bestArea = 0;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      StringBuilder cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      if (!IsWeChatClass(cls.ToString())) return true;
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

  public static string ClassNameOf(IntPtr h) {
    StringBuilder cls = new StringBuilder(256);
    GetClassName(h, cls, 256);
    return cls.ToString();
  }

  public static string TitleOf(IntPtr h) {
    StringBuilder title = new StringBuilder(256);
    GetWindowText(h, title, 256);
    return title.ToString();
  }

  public static int[] Rect(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return new int[] { 0, 0, 0, 0 };
    return new int[] { r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top };
  }

  public static bool IsVisible(IntPtr h) { return IsWindowVisible(h); }
  public static bool IsMinimized(IntPtr h) { return IsIconic(h); }

  // 微信 4.2 的 Qt 内容画在 MMUIRenderSubWindowHW 子窗里；取面积最大的那个。
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

  // 后台滚轮：对子窗 SendMessage WM_MOUSEWHEEL。delta 负数=向下滚。
  // 不移动鼠标、不抢焦点、不激活窗口。
  public static void BackgroundWheel(IntPtr parent, int screenX, int screenY, int delta) {
    IntPtr target = FindRenderChild(parent);
    if (target == IntPtr.Zero) target = parent;
    long wp = (long)(short)delta << 16;
    long lp = ((long)(ushort)(short)screenY << 16) | (ushort)(short)screenX;
    SendMessage(target, 0x020A, (IntPtr)wp, (IntPtr)lp);
  }

  // 后台点击：只向主窗 PostMessage 鼠标消息，不移动系统鼠标、不 SetFocus、不激活、不开关窗口。
  // 仅用于导航：从聊天页切到朋友圈；业务采集仍只读 UIA 控件树。
  public static bool BackgroundClick(IntPtr parent, int screenX, int screenY) {
    int[] rect = Rect(parent);
    int x = screenX - rect[0];
    int y = screenY - rect[1];
    long lp = ((long)(ushort)(short)y << 16) | (ushort)(short)x;
    bool ok = PostMessage(parent, 0x0201, (IntPtr)1, (IntPtr)lp);
    System.Threading.Thread.Sleep(80);
    ok = PostMessage(parent, 0x0202, IntPtr.Zero, (IntPtr)lp) && ok;
    return ok;
  }

  // 诊断遮挡：目标点最上层窗口根级不属于微信时，返回其标题或类名；否则空串。
  public static string CoveringWindow(IntPtr expected, int screenX, int screenY) {
    POINT p; p.X = screenX; p.Y = screenY;
    IntPtr hit = WindowFromPoint(p);
    if (hit == IntPtr.Zero) return "";
    IntPtr hitRoot = GetAncestor(hit, 2);
    IntPtr expectedRoot = GetAncestor(expected, 2);
    if (hitRoot == expectedRoot) return "";
    StringBuilder title = new StringBuilder(256);
    StringBuilder cls = new StringBuilder(256);
    GetWindowText(hitRoot, title, 256);
    GetClassName(hitRoot, cls, 256);
    string name = title.ToString();
    return string.IsNullOrEmpty(name) ? cls.ToString() : name;
  }
}
'@

[void][WeChatUiaWin]::MakeAware()

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# ---------- UIA 缓存与序列化辅助 ----------

function New-CacheRequest {
  # 缓存 ControlType/Name/BoundingRectangle/ClassName，避免跨进程反复取属性造成卡顿。
  # 元素保持 Full 引用：None 模式下缓存元素在 CacheRequest 释放后底层句柄失效，
  # 复用到下一轮 FindAll 会抛 SafeHandle null。
  $cr = New-Object System.Windows.Automation.CacheRequest
  $cr.Add([System.Windows.Automation.AutomationElement]::ControlTypeProperty)
  $cr.Add([System.Windows.Automation.AutomationElement]::NameProperty)
  $cr.Add([System.Windows.Automation.AutomationElement]::BoundingRectangleProperty)
  $cr.Add([System.Windows.Automation.AutomationElement]::ClassNameProperty)
  $cr.AutomationElementMode = [System.Windows.Automation.AutomationElementMode]::Full
  return $cr
}

function Get-ElementLines([string]$name) {
  if ([string]::IsNullOrEmpty($name)) { return @() }
  return @($name -split "`r`n|`r|`n" | ForEach-Object { $_.TrimEnd() })
}

function Get-ControlTypeName($controlType) {
  if ($null -eq $controlType) { return '' }
  return ($controlType.ProgrammaticName -replace '^ControlType\.', '')
}

# 节点角色归类：把封面空白项、分区标记（评论区/余下N条/下一条动态/全文）与
# 真实动态正文、评论单元格区分开，避免非动态节点被当成朋友圈正文。
#   moment    —— 动态正文卡片（内容/九宫格图/元信息行）
#   comment   —— 动态下的评论单元格
#   cover     —— 空白封面 ListItem（无任何文字，仅限 ListItem）
#   marker    —— 分区/折叠/导航标记节点（评论区/余下N条/下一条动态/全文…）
#   container —— 无文字的非 ListItem 容器（Group/BoxView 等）
#   other     —— 其它未归类控件
function Get-ItemRole([string]$name, [string]$className, [string]$controlType) {
  $n = if ($null -ne $name) { $name.Trim() } else { '' }
  $c = if ($null -ne $className) { $className } else { '' }
  if ($n -match '^(评论区|余下\s*\d+\s*条|下一条动态|全文|收起|展开\s*全部)$') { return 'marker' }
  if ($c -match 'TimelineCommentCell') { return 'comment' }
  if ([string]::IsNullOrWhiteSpace($n)) {
    if ($controlType -eq 'ListItem') { return 'cover' }
    return 'container'
  }
  if ($c -match 'Timeline') { return 'moment' }
  return 'other'
}

function Convert-UiaChild($el) {
  $name = if ($null -ne $el.Cached.Name) { $el.Cached.Name } else { '' }
  $cls = if ($null -ne $el.Cached.ClassName) { $el.Cached.ClassName } else { '' }
  return [ordered]@{
    controlType = (Get-ControlTypeName $el.Cached.ControlType)
    name        = $name
    className   = $cls
    lines       = (Get-ElementLines $name)
  }
}

function Convert-Rect($r) {
  $parts = @($r.X, $r.Y, $r.Width, $r.Height) | ForEach-Object {
    if ([double]::IsNaN($_) -or [double]::IsInfinity($_)) { 0 } else { [int][Math]::Round($_) }
  }
  return [ordered]@{ x = $parts[0]; y = $parts[1]; w = $parts[2]; h = $parts[3] }
}

function Convert-UiaItem($el, [int]$page, [int]$index) {
  $name = if ($null -ne $el.Cached.Name) { $el.Cached.Name } else { '' }
  $cls = if ($null -ne $el.Cached.ClassName) { $el.Cached.ClassName } else { '' }
  $ctlType = Get-ControlTypeName $el.Cached.ControlType
  $role = Get-ItemRole $name $cls $ctlType
  $r = $el.Cached.BoundingRectangle
  $children = @()
  try {
    $crChild = New-CacheRequest
    $actChild = $crChild.Activate()
    try {
      $childEls = $el.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition)
    } finally { $actChild.Dispose() }
    foreach ($c in $childEls) { $children += (Convert-UiaChild $c) }
  } catch {
    # 子树读取失败不影响父条目：children 留空，错误进入顶层 reason。
  }
  return [ordered]@{
    page        = $page
    index       = $index
    role        = $role
    name        = $name
    lines       = (Get-ElementLines $name)
    controlType = $ctlType
    className   = $cls
    bounds      = (Convert-Rect $r)
    children    = $children
  }
}

function Find-MomentList($root) {
  # 朋友圈时间线列表在 4.2 的类名是 mmui::TimeLineListView；找不到就判定朋友圈未打开。
  $cr = New-CacheRequest
  $act = $cr.Activate()
  try {
    $listCond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::List)
    $lists = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $listCond)
  } finally { $act.Dispose() }
  foreach ($l in $lists) {
    $cls = if ($null -ne $l.Cached.ClassName) { $l.Cached.ClassName } else { '' }
    if ($cls -match 'TimeLine') { return $l }
  }
  return $null
}

function Find-ButtonByName($root, [string]$name) {
  $cr = New-CacheRequest
  $act = $cr.Activate()
  try {
    $cond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Button)
    $buttons = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
  } finally { $act.Dispose() }
  foreach ($b in $buttons) {
    if ($null -ne $b.Cached.Name -and $b.Cached.Name -eq $name) { return $b }
  }
  return $null
}

function Get-ElementCenter($el) {
  $r = $el.Cached.BoundingRectangle
  if ($null -eq $r) { return $null }
  $x = [double]$r.X; $y = [double]$r.Y; $w = [double]$r.Width; $h = [double]$r.Height
  if ([double]::IsNaN($x) -or [double]::IsNaN($y) -or $w -le 0 -or $h -le 0) { return $null }
  return @{ x = [int][Math]::Round($x + $w / 2); y = [int][Math]::Round($y + $h / 2) }
}

# 后台导航：只在朋友圈未打开时，向主窗 PostMessage 鼠标消息点击「发现」→「朋友圈」。
# 不 ShowWindow、不 SetForegroundWindow、不 SetFocus、不移动系统鼠标；窗口保持原可见性。
function Open-Moments($main, $root) {
  $clicked = @()
  $existing = Find-MomentList $root
  if ($null -ne $existing) { return [ordered]@{ opened = $true; clicked = $clicked; reason = '朋友圈已打开' } }
  $discover = Find-ButtonByName $root '发现'
  if ($null -eq $discover) { return [ordered]@{ opened = $false; clicked = $clicked; reason = '未找到「发现」导航按钮' } }
  $center = Get-ElementCenter $discover
  if ($null -eq $center) { return [ordered]@{ opened = $false; clicked = $clicked; reason = '「发现」按钮无有效坐标' } }
  [void][WeChatUiaWin]::BackgroundClick($main, $center.x, $center.y)
  $clicked += "发现@$($center.x),$($center.y)"
  Start-Sleep -Milliseconds 1200
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($main)
  $existing = Find-MomentList $root
  if ($null -ne $existing) { return [ordered]@{ opened = $true; clicked = $clicked; reason = '后台点击「发现」后进入朋友圈' } }
  $moments = Find-ButtonByName $root '朋友圈'
  if ($null -eq $moments) { return [ordered]@{ opened = $false; clicked = $clicked; reason = '「发现」页未出现「朋友圈」入口' } }
  $center = Get-ElementCenter $moments
  if ($null -eq $center) { return [ordered]@{ opened = $false; clicked = $clicked; reason = '「朋友圈」入口无有效坐标' } }
  [void][WeChatUiaWin]::BackgroundClick($main, $center.x, $center.y)
  $clicked += "朋友圈@$($center.x),$($center.y)"
  Start-Sleep -Milliseconds 1200
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($main)
  $existing = Find-MomentList $root
  if ($null -ne $existing) { return [ordered]@{ opened = $true; clicked = $clicked; reason = '后台点击「朋友圈」后进入时间线' } }
  return [ordered]@{ opened = $false; clicked = $clicked; reason = '后台点击后仍未定位到 TimeLineListView' }
}

function Get-ListItems($scope) {
  $cr = New-CacheRequest
  $act = $cr.Activate()
  try {
    $cond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::ListItem)
    $els = $scope.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
  } finally { $act.Dispose() }
  return @($els) | Sort-Object `
    @{ Expression = { $_.Cached.BoundingRectangle.Top } },
    @{ Expression = { $_.Cached.BoundingRectangle.Left } }
}

function Get-PageElements($root, [bool]$listItemOnly) {
  $cr = New-CacheRequest
  $act = $cr.Activate()
  try {
    if ($listItemOnly) {
      $cond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::ListItem)
      $els = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
    } else {
      $els = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition)
    }
  } finally { $act.Dispose() }
  $sorted = @($els) | Sort-Object `
    @{ Expression = { $_.Cached.BoundingRectangle.Top } },
    @{ Expression = { $_.Cached.BoundingRectangle.Left } }
  return $sorted
}

function Get-PageSignature($pageItems) {
  $text = ($pageItems | ForEach-Object { $_.name }) -join "`n"
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $hash = $sha1.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
  } finally { $sha1.Dispose() }
}

function Write-Payload($payload) {
  $json = $payload | ConvertTo-Json -Depth 10
  if ($OutFile) {
    $parent = Split-Path -Parent $OutFile
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($OutFile, $json, [System.Text.UTF8Encoding]::new($false))
  } elseif (-not $Quiet) {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    Write-Output $json
  }
}

# ---------- 主流程 ----------
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$payload = $null
try {
  $main = [WeChatUiaWin]::FindMain()
  if ($main -eq [IntPtr]::Zero) {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok            = $false
      mode          = 'uia'
      driver        = 'uia'
      pages         = 0
      maxPages      = $MaxPages
      stopReason    = 'error'
      limitReached  = $false
      occludedBy    = $null
      reason        = '未找到微信主窗口；请先登录并展开微信主窗口（托盘隐藏需手工点开）'
      window        = [ordered]@{ main = 0; render = 0; class = ''; visible = $false }
      pageSignatures= @()
      total         = 0
      elapsedMs     = $sw.ElapsedMilliseconds
      items         = @()
    })
    exit 2
  }

  $mainRect = [WeChatUiaWin]::Rect($main)
  $render = [WeChatUiaWin]::FindRenderChild($main)
  $mainClass = [WeChatUiaWin]::ClassNameOf($main)
  $mainVisible = [WeChatUiaWin]::IsVisible($main)
  $windowInfo = [ordered]@{
    main    = $main.ToInt64()
    render  = $render.ToInt64()
    class   = $mainClass
    visible = [bool]$mainVisible
  }

  # open：只在朋友圈未打开时做后台导航；不切前台、不移动鼠标。
  if ($Mode -eq 'open') {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($main)
    if ($null -eq $root) { throw 'UIA FromHandle 返回空主窗根元素' }
    $nav = Open-Moments $main $root
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok             = [bool]$nav.opened
      mode           = 'uia'
      driver         = 'uia'
      pages          = 0
      maxPages       = $MaxPages
      stopReason     = $(if ($nav.opened) { 'no-more-data' } else { 'no-content' })
      limitReached   = $false
      occludedBy     = $null
      reason         = $nav.reason
      navigation     = $nav
      window         = $windowInfo
      pageSignatures = @()
      total          = 0
      elapsedMs      = $sw.ElapsedMilliseconds
      items          = @()
    })
    exit $(if ($nav.opened) { 0 } else { 3 })
  }

  # status：只回报窗口几何与句柄，不遍历 UIA 树。
  if ($Mode -eq 'status') {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok             = $true
      mode           = 'uia'
      driver         = 'uia'
      pages          = 0
      maxPages       = $MaxPages
      stopReason     = 'no-more-data'
      limitReached   = $false
      occludedBy     = $null
      reason         = 'status 模式：仅探测窗口，未遍历控件树'
      window         = $windowInfo
      pageSignatures = @()
      total          = 0
      elapsedMs      = $sw.ElapsedMilliseconds
      items          = @()
    })
    exit 0
  }

  # 候选窗口：独立「朋友圈」顶层窗优先，但只有在其上能定位到 mmui::TimeLine
  # List 时才采用；定位不到立即回退主窗内嵌页。残留隐藏朋友圈窗树为空，不能直接判死。
  $momentsWin = [WeChatUiaWin]::FindByTitle('朋友圈')
  $candidateHwnds = @()
  if ($momentsWin -ne [IntPtr]::Zero -and $momentsWin -ne $main) { $candidateHwnds += $momentsWin }
  $candidateHwnds += $main

  $occludedBy = $null
  $probeX = 0
  $probeY = 0

  # dump：整树快照取主窗，避免命中残留隐藏朋友圈窗。
  if ($Mode -eq 'dump') {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($main)
    if ($null -eq $root) { throw 'UIA FromHandle 返回空主窗根元素' }
    $els = Get-PageElements $root $false
    $items = @()
    $idx = 0
    foreach ($el in $els) { $items += (Convert-UiaItem $el 1 $idx); $idx++ }
    $mainRectDump = [WeChatUiaWin]::Rect($main)
    $dumpOccluded = [WeChatUiaWin]::CoveringWindow($main,
      $mainRectDump[0] + [int][Math]::Round($mainRectDump[2] * 0.5),
      $mainRectDump[1] + [int][Math]::Round($mainRectDump[3] * 0.55))
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok             = $true
      mode           = 'uia'
      driver         = 'uia'
      pages          = 1
      maxPages       = $MaxPages
      stopReason     = 'no-more-data'
      limitReached   = $false
      occludedBy     = $dumpOccluded
      reason         = 'dump 模式：整棵后代控件树快照（未翻页）'
      window         = $windowInfo
      pageSignatures = @((Get-PageSignature $items))
      total          = $items.Count
      elapsedMs      = $sw.ElapsedMilliseconds
      items          = $items
    })
    exit 0
  }

  # 逐个候选探测：元素数 + 是否带时间线列表；取第一个带时间线列表的候选作为目标。
  $target = [IntPtr]::Zero
  $root = $null
  $momentList = $null
  $probeLog = @()
  foreach ($cand in $candidateHwnds) {
    $candRoot = $null
    $candAll = @()
    $candList = $null
    try {
      $candRoot = [System.Windows.Automation.AutomationElement]::FromHandle($cand)
      if ($null -ne $candRoot) {
        $candAll = Get-PageElements $candRoot $false
        $candList = Find-MomentList $candRoot
      }
    } catch {
      $candRoot = $null
      $candList = $null
    }
    $probeLog += [ordered]@{
      hwnd            = $cand.ToInt64()
      elements        = $candAll.Count
      hasTimelineList = ($null -ne $candList)
    }
    if ($null -ne $candList) {
      $target = $cand
      $root = $candRoot
      $momentList = $candList
      break
    }
  }

  if ($target -ne [IntPtr]::Zero) {
    $tRect = [WeChatUiaWin]::Rect($target)
    $probeX = $tRect[0] + [int][Math]::Round($tRect[2] * 0.5)
    $probeY = $tRect[1] + [int][Math]::Round($tRect[3] * 0.55)
    $occludedBy = [WeChatUiaWin]::CoveringWindow($target, $probeX, $probeY)
  }

  $momentListFound = $null -ne $momentList
  $allEmpty = (@($probeLog | Where-Object { $_.elements -gt 0 }).Count -eq 0)
  $noContent = -not $momentListFound
  $probeSummary = ($probeLog | ForEach-Object {
    "句柄$($_.hwnd) 元素$($_.elements) 时间线=$($_.hasTimelineList)"
  }) -join '；'
  if ($allEmpty) {
    $noContentReason = "微信主窗口隐藏或 UIA 树为空（窗口未在桌面露出）；后台只读模式不开关窗口，请先展开微信窗口后再采集。候选探测：$probeSummary"
  } else {
    $noContentReason = "朋友圈未打开：候选窗口均未定位到 TimeLineListView 时间线列表；后台只读模式不会点击导航。候选探测：$probeSummary"
  }

  $pageCount = 0
  $items = @()
  $signatures = @()
  $lastSignature = $null
  $stalled = $false

  for ($page = 1; $page -le $MaxPages -and -not $noContent; $page++) {
    $pageEls = Get-ListItems $momentList
    $pageItems = @()
    $idx = 0
    foreach ($el in $pageEls) {
      $pageItems += (Convert-UiaItem $el $page $idx)
      $idx++
    }
    $signature = Get-PageSignature $pageItems

    if ($page -eq 1 -and $pageItems.Count -eq 0) {
      $noContent = $true
      $noContentReason = '朋友圈未打开，或当前版本 UIA 树中定位不到 ListItem；后台只读模式不会点击导航，请先在微信里打开朋友圈后再采集'
      break
    }

    if ($page -gt 1 -and $signature -eq $lastSignature) {
      $stalled = $true
      break
    }

    $pageCount = $page
    $items += $pageItems
    $signatures += $signature
    $lastSignature = $signature

    if ($page -lt $MaxPages) {
      # 唯一允许的翻页动作：后台 WM_MOUSEWHEEL，不移动鼠标、不抢焦点。
      [WeChatUiaWin]::BackgroundWheel($target, $probeX, $probeY, -600)
      Start-Sleep -Milliseconds 1200
    }
  }

  if ($noContent) {
    $stopReason = 'no-content'
    $ok = $false
    $limitReached = $false
    $reason = $noContentReason
  } elseif ($stalled) {
    if ($occludedBy) {
      $stopReason = 'occluded'
      $reason = "后台滚轮没有改变页面：朋友圈被「$occludedBy」窗口遮挡，请把微信露出后再采集"
    } else {
      $stopReason = 'scroll-stalled'
      $reason = '后台滚轮没有改变页面，可能已到朋友圈底部或当前版本不响应滚轮消息'
    }
    $ok = $true
    $limitReached = $false
  } elseif ($pageCount -ge $MaxPages) {
    $stopReason = 'page-limit'
    $ok = $true
    $limitReached = $true
    $reason = "已抓满 MaxPages=$MaxPages 页上限"
  } else {
    $stopReason = 'no-more-data'
    $ok = $true
    $limitReached = $false
    $reason = '遍历提前结束，可能已到底部'
  }

  $sw.Stop()
  Write-Payload ([ordered]@{
    ok             = $ok
    mode           = 'uia'
    driver         = 'uia'
    pages          = $pageCount
    maxPages       = $MaxPages
    stopReason     = $stopReason
    limitReached   = $limitReached
    occludedBy     = $(if ($occludedBy) { $occludedBy } else { $null })
    reason         = $reason
    window         = $windowInfo
    pageSignatures = $signatures
    total          = $items.Count
    elapsedMs      = $sw.ElapsedMilliseconds
    items          = $items
  })
  exit 0
} catch {
  $sw.Stop()
  $errMsg = $_.Exception.Message
  Write-Payload ([ordered]@{
    ok             = $false
    mode           = 'uia'
    driver         = 'uia'
    pages          = 0
    maxPages       = $MaxPages
    stopReason     = 'error'
    limitReached   = $false
    occludedBy     = $null
    reason         = "UIA 采集异常：$errMsg"
    window         = $(if ($windowInfo) { $windowInfo } else { [ordered]@{ main = 0; render = 0; class = '' } })
    pageSignatures = @()
    total          = 0
    elapsedMs      = $sw.ElapsedMilliseconds
    items          = @()
  })
  exit 6
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
