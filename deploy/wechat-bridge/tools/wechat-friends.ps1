# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​‌​​‌‌‌​‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​‌‌‌​‍‍​

#
# 微信 4.x 好友 / 群邀请 UIA 脚本（自研，自成一体，不依赖第三方包）。
# 硬约束：Scan / SelfTest 只读，不点击、不 SetFocus、不切页、不改选中态；
# 不做 DLL 注入、不读微信进程内存、不改微信文件。Accept 是唯一写动作，
# 且必须先用同一套枚举重新取到控件，控件名与扫描时完全一致才 Invoke。
#
# 模式：
#   -Scan     默认。只读枚举「新的朋友」待处理申请与群聊邀请，stdout 只输出 JSON。
#   -Accept -RequestId <id>  二次校验后通过申请；校验失败一律不点。
#   -SelfTest 只枚举并打印 UIA 树摘要，不点、不切页。
#
# requestId 无状态自还原：base64url 编码「kind|controlType|className|name」，
# Accept 时解码后在当前枚举结果里精确匹配；脚本不维护任何外部存储。
# 注意：本脚本顶层 param 含 [switch]$Scan，函数内局部变量不得再用 $scan（PowerShell
# 变量名大小写不敏感，会被绑定到 switch 参数导致类型转换错误）。

param(
  [switch]$Scan,
  [switch]$Accept,
  [switch]$SelfTest,
  [string]$RequestId = ''
)

$ErrorActionPreference = 'Stop'

# ---------- Win32 只读互操作：只枚举窗口 / 读标题类名矩形，不注入、不开关窗口 ----------
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public class WeChatFriendsWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  public static void MakeAware() { SetProcessDPIAware(); }

  static bool IsWeChatClass(string c) {
    return c.StartsWith("Qt51514QWindowIcon") || c == "mmui::MainWindow";
  }

  // 微信 4.2 主窗口类名 Qt51514QWindowIcon，标题「微信」；按面积过滤小通知弹窗。
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
}
'@

[void][WeChatFriendsWin]::MakeAware()

# 仅用于「点开通讯录 → 新的朋友」这个导航动作：Qt 的列表单元常不暴露 Invoke，
# 只能按中心点左键单击。除导航外任何写动作仍走 InvokePattern，不走坐标点击。
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WeChatFriendsClick {
  [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  public static bool IsForeground(IntPtr h) { return GetForegroundWindow() == h; }
  public static void At(int x, int y) {
    SetCursorPos(x, y);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
  // 导航前的一次性前台化：Qt 在后台时对 ListItem 的 Invoke/Select 会「返回成功但不切页」
  public static void Activate(IntPtr h) {
    ShowWindow(h, 9); // SW_RESTORE
    SetForegroundWindow(h);
  }
}
'@

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# ---------- 常量与辅助 ----------

$script:HandledIds = New-Object 'System.Collections.Generic.HashSet[string]'

$AcceptButtonNames = @('通过', '接受', '同意')
$GroupInvitePattern = '群聊邀请|邀请你加入|群邀请|加入群聊|邀请加入群|邀请你加入群聊'
$FriendRequestPattern = '朋友验证|朋友请求|添加朋友|新的朋友|来自朋友|验证消息|请求添加|添加你为朋友|加你为好友|好友请求'

# 通讯录里的导航入口（点进去才是列表）：它们本身不是申请。
# 2026-11-26 实测踩过：扫描把「新的朋友」这个入口行当成一条申请上报，昵称必然为空。
$NavEntryNames = @('新的朋友', '群聊', '标签', '公众号', '服务号', '通讯录管理')
$NavEntryClassPattern = 'ContactsCellGroupView'

function Write-Stderr([string]$message) {
  [Console]::Error.WriteLine('[wechat-friends] ' + $message)
}

function New-CacheRequest {
  $cr = New-Object System.Windows.Automation.CacheRequest
  $cr.Add([System.Windows.Automation.AutomationElement]::ControlTypeProperty)
  $cr.Add([System.Windows.Automation.AutomationElement]::NameProperty)
  $cr.Add([System.Windows.Automation.AutomationElement]::BoundingRectangleProperty)
  $cr.Add([System.Windows.Automation.AutomationElement]::ClassNameProperty)
  $cr.AutomationElementMode = [System.Windows.Automation.AutomationElementMode]::Full
  return $cr
}

function Get-ControlTypeName($controlType) {
  if ($null -eq $controlType) { return '' }
  return ($controlType.ProgrammaticName -replace '^ControlType\.', '')
}

function Get-ElementLines([string]$name) {
  if ([string]::IsNullOrEmpty($name)) { return @() }
  return @($name -split "`r`n|`r|`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Test-InvokePattern($el) {
  if ($null -eq $el) { return $null }
  try {
    $pattern = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    if ($null -ne $pattern) { return $pattern }
  } catch {
    return $null
  }
  return $null
}

function ConvertTo-Base64Url([string]$text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $b64 = [Convert]::ToBase64String($bytes)
  return ($b64 -replace '\+', '-' -replace '/', '_' -replace '=', '')
}

function ConvertFrom-Base64Url([string]$b64url) {
  if ([string]::IsNullOrWhiteSpace($b64url)) { return $null }
  $b64 = $b64url.Trim() -replace '-', '+' -replace '_', '/'
  switch ($b64.Length % 4) {
    2 { $b64 += '==' }
    3 { $b64 += '=' }
  }
  try {
    $bytes = [Convert]::FromBase64String($b64)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
  } catch {
    return $null
  }
}

# 签名：kind|controlType|className|name；name 内允许出现竖线，只按前三个竖线切分。
function New-Signature([string]$kind, [string]$controlType, [string]$className, [string]$name) {
  return ($kind + '|' + $controlType + '|' + $className + '|' + $name)
}

function Split-Signature([string]$signature) {
  if ([string]::IsNullOrEmpty($signature)) { return $null }
  $parts = $signature -split '\|', 4
  if ($parts.Count -ne 4) { return $null }
  if ($parts[0] -ne 'friend' -and $parts[0] -ne 'group-invite') { return $null }
  return [ordered]@{
    kind        = $parts[0]
    controlType = $parts[1]
    className   = $parts[2]
    name        = $parts[3]
  }
}

function Get-AllElements($root) {
  $cr = New-CacheRequest
  $act = $cr.Activate()
  try {
    $els = $root.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition)
  } finally {
    $act.Dispose()
  }
  $sorted = @($els) | Sort-Object `
    @{ Expression = { $_.Cached.BoundingRectangle.Top } },
    @{ Expression = { $_.Cached.BoundingRectangle.Left } }
  return $sorted
}

# 向上回溯最多 $levels 层父节点，收集行内文本，用于从按钮还原昵称 / 来源。
function Get-RowText($el, [int]$levels = 3) {
  $current = $el
  $collected = New-Object 'System.Collections.Generic.List[string]'
  for ($i = 0; $i -lt $levels -and $null -ne $current; $i++) {
    try {
      $name = $current.Cached.Name
      if (-not [string]::IsNullOrWhiteSpace($name)) {
        foreach ($line in (Get-ElementLines $name)) {
          if (-not $collected.Contains($line)) { $collected.Add($line) }
        }
      }
      $current = $current.Parent
    } catch {
      break
    }
  }
  return @($collected)
}

function Test-NavEntry($el) {
  try {
    $name = ([string]$el.Cached.Name).Trim()
    $cls = [string]$el.Cached.ClassName
    if ($NavEntryNames -contains $name -and $cls -match $NavEntryClassPattern) { return $true }
  } catch { }
  return $false
}

# 找到通讯录里的「新的朋友」入口行；找不到返回 $null。
function Find-NavEntry($root) {
  $elements = Get-AllElements $root
  foreach ($el in $elements) {
    try {
      $name = ([string]$el.Cached.Name).Trim()
      $cls = [string]$el.Cached.ClassName
      if ($name -eq '新的朋友' -and $cls -match $NavEntryClassPattern) { return $el }
    } catch { }
  }
  return $null
}

# 打开「新的朋友」页：这是导航动作，不点任何「通过」。返回是否发生了导航。
function Open-NewFriendsPage($root, $main) {
  $nav = Find-NavEntry $root
  if ($null -eq $nav) { return $false }
  # 先前台化：Qt 在后台时 ListItem 的 Invoke/Select 会返回成功但不切页（2026-11-26 实测）
  try { [WeChatFriendsClick]::Activate($main); Start-Sleep -Milliseconds 300 } catch { }
  # 1) SelectionItem 优先（Qt 分组行实测三模式齐全，Select 是最贴近用户点击的语义）
  try {
    $sel = $nav.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    if ($null -ne $sel) { $sel.Select(); Start-Sleep -Milliseconds 500 }
  } catch { }
  # 2) 再补一次 Invoke
  $pat = Test-InvokePattern $nav
  if ($null -ne $pat) {
    try { $pat.Invoke(); return $true } catch { }
  }
  # 3) 最后退路：中心点左键（仅导航）
  try {
    $rect = $nav.Cached.BoundingRectangle
    if ($rect.Width -le 2 -or $rect.Height -le 2) { return $false }
    [WeChatFriendsClick]::At([int]($rect.X + $rect.Width / 2), [int]($rect.Y + $rect.Height / 2))
    return $true
  } catch {
    return $false
  }
}

function Classify-Kind([string]$text) {  if ($text -match $GroupInvitePattern) { return 'group-invite' }
  if ($text -match $FriendRequestPattern) { return 'friend' }
  return $null
}

function Split-NicknameSource([string[]]$lines, [string]$kind) {
  $nickname = ''
  $source = ''
  foreach ($line in $lines) {
    if ($AcceptButtonNames -contains $line) { continue }
    if ($line -match $GroupInvitePattern -or $line -match $FriendRequestPattern) {
      if (-not $source) { $source = $line }
      continue
    }
    if (-not $nickname) { $nickname = $line }
  }
  if (-not $source) {
    $fallback = $lines | Where-Object { $_ -match $GroupInvitePattern -or $_ -match $FriendRequestPattern } | Select-Object -First 1
    if ($fallback) { $source = $fallback }
  }
  return [ordered]@{ nickname = $nickname; source = $source }
}

# 枚举候选条目。返回 @{ rawCount=...; items=@(...) }；items 内每项含
# requestId/nickname/source/kind/clickable/seenAt/signature/element。
function Get-FriendRequests($root) {
  $elements = Get-AllElements $root
  $rawCount = 0
  $historyCount = 0
  $entryExcluded = 0
  $items = @()
  $seenSignatures = New-Object 'System.Collections.Generic.HashSet[string]'

  foreach ($el in $elements) {
    $name = if ($null -ne $el.Cached.Name) { $el.Cached.Name } else { '' }
    $cls = if ($null -ne $el.Cached.ClassName) { $el.Cached.ClassName } else { '' }
    $ctlType = Get-ControlTypeName $el.Cached.ControlType
    $lines = Get-ElementLines $name
    if ($lines.Count -eq 0) { continue }
    $rawCount += 1
    if ($name -match '已添加|已通过|已拒绝|已过期') { $historyCount += 1 }

    $isAcceptButton = ($ctlType -eq 'Button' -and ($AcceptButtonNames -contains $name.Trim()))
    $rowLines = if ($isAcceptButton) { Get-RowText $el 3 } else { $lines }
    $rowText = ($rowLines -join ' ')
    $kind = Classify-Kind $rowText
    # 按钮才是最强信号：行内有「通过/接受」但文案没命中关键词时，仍按好友申请上报，
    # 否则真实申请（文案各版本不同）会被静默丢掉。历史行、导航行都没有按钮，不会误报。
    if ($null -eq $kind -and $isAcceptButton) { $kind = 'friend' }
    if ($null -eq $kind) { continue }
    # 导航入口（「新的朋友」「群聊」这类）没有「通过/接受」按钮，一律不是申请
    if (-not $isAcceptButton -and (Test-NavEntry $el)) { $entryExcluded += 1; continue }

    # 只有行内真的存在「通过/接受/同意」按钮才算申请；没有按钮的行不上报，
    # 否则会把导航入口、历史已处理行都当成待处理申请。
    $acceptButton = if ($isAcceptButton) { $el } else { $null }
    if ($null -eq $acceptButton) {
      try {
        $buttons = $el.FindAll(
          [System.Windows.Automation.TreeScope]::Descendants,
          (New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button)))
        foreach ($b in $buttons) {
          $bName = if ($null -ne $b.Cached.Name) { $b.Cached.Name.Trim() } else { '' }
          if ($AcceptButtonNames -contains $bName) {
            $acceptButton = $b
            break
          }
        }
      } catch { }
    }
    if ($null -eq $acceptButton) { continue }

    $target = $acceptButton
    $targetName = if ($null -ne $target.Cached.Name) { $target.Cached.Name } else { '' }
    $targetType = Get-ControlTypeName $target.Cached.ControlType
    $targetClass = if ($null -ne $target.Cached.ClassName) { $target.Cached.ClassName } else { '' }

    $pattern = Test-InvokePattern $target
    $clickable = ($null -ne $pattern)
    $signature = New-Signature $kind $targetType $targetClass $targetName
    if ($seenSignatures.Contains($signature)) { continue }
    [void]$seenSignatures.Add($signature)

    $ns = Split-NicknameSource $rowLines $kind
    $requestId = ConvertTo-Base64Url $signature
    $items += [ordered]@{
      requestId      = $requestId
      nickname       = $ns.nickname
      nicknameSource = $(if ($ns.nickname) { 'control' } else { 'unavailable' })
      source         = $ns.source
      kind           = $kind
      clickable      = $clickable
      seenAt         = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      signature      = $signature
      element        = $target
    }
  }

  return [ordered]@{
    rawCount      = $rawCount
    historyCount  = $historyCount
    entryExcluded = $entryExcluded
    elementCount  = @($elements).Count
    items         = $items
  }
}

function Write-Payload($payload) {
  $json = $payload | ConvertTo-Json -Depth 12
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  Write-Output $json
}

# ---------- 主流程 ----------

$mode = 'Scan'
if ($Accept) { $mode = 'Accept' }
elseif ($SelfTest) { $mode = 'SelfTest' }
elseif ($Scan) { $mode = 'Scan' }

$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
  $main = [WeChatFriendsWin]::FindMain()
  if ($main -eq [IntPtr]::Zero) {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $false
      status    = 'failed'
      reason    = '本机不可达'
      detail    = '未找到标题为「微信」、面积大于 600x500 的微信主窗口；请先登录并展开微信主窗口（托盘隐藏需手工点开）'
      requests  = @()
      rawCount  = 0
      scannedAt = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    })
    exit 2
  }

  $root = [System.Windows.Automation.AutomationElement]::FromHandle($main)
  if ($null -eq $root) { throw 'UIA FromHandle 返回空主窗根元素' }

  $mainRect = [WeChatFriendsWin]::Rect($main)
  $windowInfo = [ordered]@{
    hwnd      = $main.ToInt64()
    class     = [WeChatFriendsWin]::ClassNameOf($main)
    title     = [WeChatFriendsWin]::TitleOf($main)
    visible   = [bool][WeChatFriendsWin]::IsVisible($main)
    minimized = [bool][WeChatFriendsWin]::IsMinimized($main)
    rect      = [ordered]@{ x = $mainRect[0]; y = $mainRect[1]; w = $mainRect[2]; h = $mainRect[3] }
  }

  # ---------- SelfTest：只枚举摘要，不点、不切页 ----------
  if ($mode -eq 'SelfTest') {
    $elements = @()
    $elementCount = 0
    $sample = @()
    $treeError = ''
    try {
      $elements = Get-AllElements $root
      $elementCount = $elements.Count
      $limit = [Math]::Min(60, $elementCount)
      for ($i = 0; $i -lt $limit; $i++) {
        $el = $elements[$i]
        $name = if ($null -ne $el.Cached.Name) { $el.Cached.Name } else { '' }
        $cls = if ($null -ne $el.Cached.ClassName) { $el.Cached.ClassName } else { '' }
        $hasInvoke = ($null -ne (Test-InvokePattern $el))
        $sample += [ordered]@{
          controlType = (Get-ControlTypeName $el.Cached.ControlType)
          name        = $name
          className   = $cls
          hasInvoke   = $hasInvoke
        }
      }
    } catch {
      $treeError = $_.Exception.Message
    }
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok           = $true
      status       = 'ok'
      mode         = 'selftest'
      reason       = $(if ($treeError) { 'UIA 树枚举部分失败：' + $treeError } else { 'SelfTest 只读枚举，未点击、未切页' })
      window       = $windowInfo
      elementCount = $elementCount
      sample       = $sample
      elapsedMs    = $sw.ElapsedMilliseconds
    })
    exit 0
  }

  # ---------- Scan：只读枚举 ----------
  if ($mode -eq 'Scan') {
    # 先把「新的朋友」页打开（导航，不点任何「通过」），否则枚举到的只是通讯录入口行
    $navigated = Open-NewFriendsPage $root $main
    if ($navigated) {
      Start-Sleep -Milliseconds 800
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($main)
    }
    $friendScan = Get-FriendRequests $root
    $requests = @()
    foreach ($item in $friendScan.items) {
      $requests += [ordered]@{
        requestId      = $item.requestId
        nickname       = $item.nickname
        nicknameSource = $item.nicknameSource
        source         = $item.source
        kind           = $item.kind
        clickable      = $item.clickable
        seenAt         = $item.seenAt
      }
    }
    $sw.Stop()
    # 窗口在托盘/最小化/被遮挡时 UIA 读不到子树，这时报「0 条待处理」会骗人，必须报失败并给出原因。
    if ($friendScan.elementCount -lt 5) {
      Write-Payload ([ordered]@{
        ok           = $false
        status       = 'failed'
        reason       = 'window-hidden-or-empty'
        detail       = "微信主窗口不可见或 UIA 子树为空（元素数=$($friendScan.elementCount)，visible=$($windowInfo.visible)）；请在微信里点开主窗口后重试"
        requests     = @()
        scannedAt    = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        rawCount     = $friendScan.rawCount
        historyCount = $friendScan.historyCount
        entered      = [bool]$navigated
        navigated    = [bool]$navigated
        window       = $windowInfo
        elapsedMs    = $sw.ElapsedMilliseconds
      })
      exit 11
    }
    Write-Payload ([ordered]@{
      ok         = $true
      status     = 'ok'
      reason     = $null
      requests   = $requests
      scannedAt  = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      rawCount   = $friendScan.rawCount
      historyCount = $friendScan.historyCount
      entryExcluded = $friendScan.entryExcluded
      entered    = [bool]$navigated
      navigated  = [bool]$navigated
      window     = $windowInfo
      elapsedMs  = $sw.ElapsedMilliseconds
    })
    exit 0
  }

  # ---------- Accept：二次校验后才 Invoke ----------
  if ([string]::IsNullOrWhiteSpace($RequestId)) {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $false
      status    = 'failed'
      reason    = 'request-id-required'
      errorCode = 'request-id-required'
      requestId = ''
    })
    exit 4
  }

  if ($script:HandledIds.Contains($RequestId)) {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $true
      status    = 'already-handled'
      reason    = 'already-handled'
      errorCode = $null
      requestId = $RequestId
    })
    exit 0
  }

  $signatureText = ConvertFrom-Base64Url $RequestId
  $signature = Split-Signature $signatureText
  if ($null -eq $signature) {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $false
      status    = 'failed'
      reason    = 'not-found'
      errorCode = 'not-found'
      requestId = $RequestId
    })
    exit 5
  }

  # 先跑同一套枚举，在当前界面里精确定位签名一致的控件。
  $friendScan = Get-FriendRequests $root
  $match = $null
  foreach ($item in $friendScan.items) {
    if ($item.signature -eq $signatureText) { $match = $item; break }
  }

  # 当前不在「新的朋友」页时先导航一次再匹配（导航不点任何申请）
  if ($null -eq $match) {
    if (Open-NewFriendsPage $root $main) {
      Start-Sleep -Milliseconds 800
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($main)
      $friendScan = Get-FriendRequests $root
      foreach ($item in $friendScan.items) {
        if ($item.signature -eq $signatureText) { $match = $item; break }
      }
    }
  }

  if ($null -eq $match) {
    # 找不到或控件名/类型/类名已变化：一律视为 stale-request，宁可不点。
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $false
      status    = 'failed'
      reason    = 'stale-request'
      errorCode = 'stale-request'
      requestId = $RequestId
    })
    exit 6
  }

  $pattern = Test-InvokePattern $match.element
  if ($null -eq $pattern) {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $false
      status    = 'failed'
      reason    = 'not-clickable'
      errorCode = 'not-clickable'
      requestId = $RequestId
    })
    exit 7
  }

  try {
    $pattern.Invoke()
  } catch {
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $false
      status    = 'failed'
      reason    = ($_.Exception.Message -replace "`r?`n", ' ')
      errorCode = 'invoke-failed'
      requestId = $RequestId
    })
    exit 8
  }

  # 关键校验：Qt 在后台时会「Invoke 返回成功但不生效」，所以点完必须回读一次，
  # 只有该条申请真的从列表消失才算通过；否则做一次受控的坐标点击兜底。
  $clickPath = 'invoke'
  Start-Sleep -Milliseconds 1200
  $post = Get-FriendRequests ([System.Windows.Automation.AutomationElement]::FromHandle($main))
  $still = $null
  foreach ($item in $post.items) { if ($item.signature -eq $signatureText) { $still = $item; break } }
  if ($null -ne $still) {
    $clickPath = 'invoke-ineffective'
    try {
      [WeChatFriendsClick]::Activate($main)
      Start-Sleep -Milliseconds 300
      if (-not [WeChatFriendsClick]::IsForeground($main)) { throw '窗口未能前台化' }
      $rect = $still.element.Current.BoundingRectangle
      if ($rect.Width -le 2 -or $rect.Height -le 2) { throw '按钮矩形无效' }
      $cx = [int]($rect.X + $rect.Width / 2)
      $cy = [int]($rect.Y + $rect.Height / 2)
      $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
      if ($cx -lt $screen.X -or $cy -lt $screen.Y -or $cx -gt ($screen.X + $screen.Width) -or $cy -gt ($screen.Y + $screen.Height)) {
        throw '按钮中心不在可见屏幕内'
      }
      [WeChatFriendsClick]::At($cx, $cy)
      $clickPath = 'click'
      Start-Sleep -Milliseconds 1200
      $post = Get-FriendRequests ([System.Windows.Automation.AutomationElement]::FromHandle($main))
      $still = $null
      foreach ($item in $post.items) { if ($item.signature -eq $signatureText) { $still = $item; break } }
    } catch {
      $clickPath = 'click-failed:' + ($_.Exception.Message -replace "`r?`n", ' ')
    }
  }

  if ($null -ne $still) {
    # 点了但条目仍在：如实报「点击无效」，不重试、不谎报成功。
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok        = $false
      status    = 'failed'
      reason    = 'click-ineffective'
      errorCode = 'click-ineffective'
      requestId = $RequestId
      nickname  = $match.nickname
      clickPath = $clickPath
      elapsedMs = $sw.ElapsedMilliseconds
    })
    exit 10
  }

  [void]$script:HandledIds.Add($RequestId)
  $sw.Stop()
  Write-Payload ([ordered]@{
    ok        = $true
    status    = 'accepted'
    requestId = $RequestId
    reason    = $null
    errorCode = $null
    nickname  = $match.nickname
    kind      = $match.kind
    clickPath = $clickPath
  })
  exit 0
} catch {
  $sw.Stop()
  $detail = $_.Exception.Message
  Write-Stderr $detail
  Write-Payload ([ordered]@{
    ok        = $false
    status    = 'failed'
    reason    = '本机不可达'
    detail    = $detail
    requests  = @()
    rawCount  = 0
    scannedAt = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  })
  exit 9
}
