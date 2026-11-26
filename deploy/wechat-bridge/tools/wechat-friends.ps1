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

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# ---------- 常量与辅助 ----------

$script:HandledIds = New-Object 'System.Collections.Generic.HashSet[string]'

$AcceptButtonNames = @('通过', '接受', '同意', '添加')
$GroupInvitePattern = '群聊邀请|邀请你加入|群邀请|加入群聊|邀请加入群'
$FriendRequestPattern = '朋友验证|朋友请求|添加朋友|新的朋友|来自朋友|验证消息'

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

function Classify-Kind([string]$text) {
  if ($text -match $GroupInvitePattern) { return 'group-invite' }
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
  $items = @()
  $seenSignatures = New-Object 'System.Collections.Generic.HashSet[string]'

  foreach ($el in $elements) {
    $name = if ($null -ne $el.Cached.Name) { $el.Cached.Name } else { '' }
    $cls = if ($null -ne $el.Cached.ClassName) { $el.Cached.ClassName } else { '' }
    $ctlType = Get-ControlTypeName $el.Cached.ControlType
    $lines = Get-ElementLines $name
    if ($lines.Count -eq 0) { continue }
    $rawCount += 1

    $isAcceptButton = ($ctlType -eq 'Button' -and ($AcceptButtonNames -contains $name.Trim()))
    $rowLines = if ($isAcceptButton) { Get-RowText $el 3 } else { $lines }
    $rowText = ($rowLines -join ' ')
    $kind = Classify-Kind $rowText
    if ($null -eq $kind) { continue }

    # 点击目标：优先行内「通过/接受/同意」按钮；否则取当前行元素本身。
    $target = $el
    $targetName = $name
    $targetType = $ctlType
    $targetClass = $cls
    if (-not $isAcceptButton) {
      try {
        $buttons = $el.FindAll(
          [System.Windows.Automation.TreeScope]::Descendants,
          (New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button)))
        foreach ($b in $buttons) {
          $bName = if ($null -ne $b.Cached.Name) { $b.Cached.Name.Trim() } else { '' }
          if ($AcceptButtonNames -contains $bName) {
            $target = $b
            $targetName = $b.Cached.Name
            $targetType = Get-ControlTypeName $b.Cached.ControlType
            $targetClass = if ($null -ne $b.Cached.ClassName) { $b.Cached.ClassName } else { '' }
            break
          }
        }
      } catch { }
    }

    $pattern = Test-InvokePattern $target
    $clickable = ($null -ne $pattern)
    $signature = New-Signature $kind $targetType $targetClass $targetName
    if ($seenSignatures.Contains($signature)) { continue }
    [void]$seenSignatures.Add($signature)

    $ns = Split-NicknameSource $rowLines $kind
    $requestId = ConvertTo-Base64Url $signature
    $items += [ordered]@{
      requestId = $requestId
      nickname  = $ns.nickname
      source    = $ns.source
      kind      = $kind
      clickable = $clickable
      seenAt    = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      signature = $signature
      element   = $target
    }
  }

  return [ordered]@{ rawCount = $rawCount; items = $items }
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
    $friendScan = Get-FriendRequests $root
    $requests = @()
    foreach ($item in $friendScan.items) {
      $requests += [ordered]@{
        requestId = $item.requestId
        nickname  = $item.nickname
        source    = $item.source
        kind      = $item.kind
        clickable = $item.clickable
        seenAt    = $item.seenAt
      }
    }
    $sw.Stop()
    Write-Payload ([ordered]@{
      ok         = $true
      status     = 'ok'
      reason     = $null
      requests   = $requests
      scannedAt  = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      rawCount   = $friendScan.rawCount
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
