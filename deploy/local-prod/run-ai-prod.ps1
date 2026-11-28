# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 本机生产 ai-service 启动器（8803）。由 ensure-prod-stack.ps1 在缺位时调用。
#
# 为什么单独一份：这个网关是所有 LLM 能力的单点——问数、对话、改写都走它。
# 它不在栈里时，这些功能不会报错，只会静默回落，看起来像「功能没做」。
# 这里用它与 apps/ai-service 自己的 .env 启动，只监听环回地址。

$ErrorActionPreference = 'Stop'

# 自隐藏兜底：不管调用方用什么方式拉起（Start-Process 只要带 -RedirectStandard* 就会强制新建
# 控制台），先把自己已经拿到的那个控制台窗口藏掉，桌面上不再留下 pwsh 黑框。
# GetConsoleWindow 为 0 表示本就没有控制台（CreateNoWindow），直接跳过。
try {
  if (-not ('IHUI.ConsoleHide' -as [type])) {
    Add-Type -Namespace IHUI -Name ConsoleHide -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
  }
  $h = [IHUI.ConsoleHide]::GetConsoleWindow()
  if ($h -ne [IntPtr]::Zero) { [void][IHUI.ConsoleHide]::ShowWindow($h, 0) }
} catch { }

$Root = 'C:\IHUI-AI'
$AiDir = Join-Path $Root 'apps\ai-service'
$Python = Join-Path $AiDir '.venv\Scripts\python.exe'
$PythonW = Join-Path $AiDir '.venv\Scripts\pythonw.exe'
if (Test-Path -LiteralPath $PythonW) { $Python = $PythonW }
$LogDir = Join-Path $Root 'logs'
$Port = 8803

if (-not (Test-Path -LiteralPath $Python)) {
    throw "run-ai-prod.ps1: sidecar Python 未找到：$Python"
}
if (-not (Test-Path -LiteralPath (Join-Path $AiDir 'app\main.py'))) {
    throw "run-ai-prod.ps1: 找不到 app/main.py：$AiDir"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    exit 0
}

$out = Join-Path $LogDir 'ai-prod.out.log'
$err = Join-Path $LogDir 'ai-prod.err.log'

# 为什么不用 Start-Process -WindowStyle Hidden：
# 1) 同时给 -RedirectStandardOutput/Error 时，Start-Process 走 UseShellExecute=false，
#    WindowStyle 被忽略，子进程仍会拿到一个可见控制台；
# 2) .venv\Scripts\python.exe 只是跳板，它再拉起的 base python 会自建控制台，
#    于是「隐藏启动」也会弹出一个标题为 python.exe 路径的黑框。
# 这里改用 .venv 的 pythonw.exe（本身无控制台）+ cmd.exe 文件重定向 + CreateNoWindow：
# 控制台从根上不会被创建；重定向由 cmd 持有，本脚本退出后日志照旧持续写入。
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = "$env:ComSpec"
$psi.Arguments = '/d /c ""{0}" -m uvicorn app.main:app --host 127.0.0.1 --port {1} 1>>"{2}" 2>>"{3}""' -f $Python, $Port, $out, $err
$psi.WorkingDirectory = $AiDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
[void][System.Diagnostics.Process]::Start($psi)

for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Seconds 2
    try {
        $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
        if ($status.status -eq 'ok') { exit 0 }
    } catch {
        # 还在加载依赖，继续等；40 轮约 80 秒，超过就交给看门狗下一轮。
    }
}
exit 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
