# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
  以「桌面登录用户」身份执行子进程(2026-10-28 立,补服务身份下 DPAPI 解密必失败的缺口)。
.DESCRIPTION
  立因:IHUI-API 以 LocalSystem 运行 ⇒ 进程 token 是机器账户,CodeArts/Qoder 的
  Local State 密钥是**用户级 DPAPI**(CryptProtectData 默认作用域),SYSTEM 解不开;
  %USERPROFILE%/%APPDATA% 也指向 systemprofile,落点全部找错。
  本脚本在服务身份下用 WTSQueryUserToken(取活动控制台会话的用户主令牌)→
  DuplicateTokenEx → CreateEnvironmentBlock(用户环境块)→ CreateProcessAsUser 启动子进程,
  让子进程以真实用户身份、真实用户环境执行;非服务身份(开发机)则原样直跑,零额外抽象。

  凭据不进命令行、不落盘:stdin/stdout/stderr 全部走继承句柄(调用方 Node 的管道),
  本脚本只做身份切换与退出码透传。

.PARAMETER Exe
  子进程可执行文件绝对路径(通常是 node.exe)。
.PARAMETER ArgJson
  子进程参数数组的 JSON 文本(调用方 JSON.stringify 后传入,避免命令行转义歧义)。
.PARAMETER WorkingDirectory
  子进程工作目录;缺省为当前目录。
.PARAMETER SessionId
  目标会话 id;0 = 自动取活动控制台会话(WTSGetActiveConsoleSessionId)。
.PARAMETER TimeoutSeconds
  子进程最长执行秒数;超时 TerminateProcess 并以退出码 124 返回(默认 25,小于调用方 30s)。
.PARAMETER NoWait
  拉起后立即返回,不等子进程退出(2026-10-28 立:重新打开客户端这类长驻 GUI 进程,
  等它退出会把调用方(depth 30s)挂死;本开关下超时不生效)。
.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File run-as-user.ps1 -Exe C:\node.exe -ArgJson '["a.mjs","--stdin"]'
#>
param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [Parameter(Mandatory = $true)][string]$ArgJson,
    [string]$WorkingDirectory = '',
    [int]$SessionId = 0,
    [int]$TimeoutSeconds = 25,
    [switch]$NoWait
)

$ErrorActionPreference = 'Stop'
$cross = [string][char]0x274C  # ❌:与 scripts/*.mjs 的 `❌ [code] message` 同口径,此处不落非 ASCII 字节
$scriptPath = $MyInvocation.MyCommand.Path

# 找真 pwsh 7/6 可执行文件(用于「本进程编译不了内联 C#,换解释器重跑自己」)
function Find-Pwsh {
    foreach ($var in @('ProgramFiles', 'ProgramFiles(x86)')) {
        $root = [Environment]::GetEnvironmentVariable($var)
        if (-not $root) { continue }
        $psRoot = [System.IO.Path]::Combine($root, 'PowerShell')
        if (-not [System.IO.Directory]::Exists($psRoot)) { continue }
        foreach ($d in [System.IO.Directory]::GetDirectories($psRoot)) {
            $exe = [System.IO.Path]::Combine($d, 'pwsh.exe')
            if ([System.IO.File]::Exists($exe)) { return $exe }
        }
    }
    return ''
}

# 由 pwsh 7 拉起 powershell.exe 时,子进程继承的是 PS7 的 PSModulePath($PSHOME\Modules 可能不在内)
# ⇒ ConvertFrom-Json/Test-Path 等内置模块命令会「找不到」。实测某机器上 powershell.exe 被换成
# 「PS7 二进制 + PS5.1 $PSHOME」的形态,PSModulePath 里没有任何可加载的 PS7 模块目录,
# 连 Add-Type 都不可用。这里按「本进程 $PSHOME + 已知安装根下的 Modules」逐个试,
# 用 Get-Command(内置 Core 命令,永远可用)验证模块解析是否恢复,恢复即停。
function Initialize-ModulePath {
    # 本函数运行在「模块还没加载」的环境里 ⇒ 只用 .NET API 与 Core 命令,不碰 Join-Path/New-Object
    $probe = [System.Collections.ArrayList]::new()
    if ($PSHOME) { [void]$probe.Add([System.IO.Path]::Combine($PSHOME, 'Modules')) }
    foreach ($var in @('ProgramFiles', 'ProgramFiles(x86)')) {
        $root = [Environment]::GetEnvironmentVariable($var)
        if (-not $root) { continue }
        $psRoot = [System.IO.Path]::Combine($root, 'PowerShell')
        if (-not [System.IO.Directory]::Exists($psRoot)) { continue }
        [void]$probe.Add([System.IO.Path]::Combine($psRoot, 'Modules'))
        foreach ($d in [System.IO.Directory]::GetDirectories($psRoot)) {
            [void]$probe.Add([System.IO.Path]::Combine($d, 'Modules'))
        }
    }

    if (Get-Command -Name ConvertFrom-Json -ErrorAction SilentlyContinue) { return }

    $original = "$env:PSModulePath"
    foreach ($candidate in $probe) {
        if (-not [System.IO.Directory]::Exists($candidate)) { continue }
        $env:PSModulePath = if ($original) { "$candidate;$original" } else { $candidate }
        foreach ($module in @('Microsoft.PowerShell.Utility', 'Microsoft.PowerShell.Management')) {
            $path = [System.IO.Path]::Combine($candidate, $module)
            if (-not [System.IO.Directory]::Exists($path)) { continue }
            try { Import-Module $path -ErrorAction Stop } catch { }
        }
        if (Get-Command -Name ConvertFrom-Json -ErrorAction SilentlyContinue) { return }
    }
}

Initialize-ModulePath

# 模块彻底不可用时说清楚,而不是让下游抛一串「The term 'X' is not recognized」
if (-not (Get-Command -Name ConvertFrom-Json -ErrorAction SilentlyContinue)) {
    [Console]::Error.WriteLine("$cross [run-as-user] PowerShell 模块不可用(PSModulePath 里没有可加载的 Utility 模块);请改用 pwsh 7 执行本脚本")
    exit 3
}

function Write-HelperError([string]$code, [string]$message) {
    $one = ($message -replace '\r?\n', ' ').Trim()
    if (-not $one) { $one = '未判定' }
    [Console]::Error.WriteLine("$cross [$code] $one")
}

# Windows 命令行参数转义(CommandLineToArgvW 规则:反斜杠只在引号前加倍)
function Quote-Arg([string]$a) {
    if ($null -eq $a) { $a = '' }
    if ($a -ne '' -and $a -notmatch '[\s"]') { return $a }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    $bs = 0
    foreach ($ch in $a.ToCharArray()) {
        if ($ch -eq '\') { $bs++; continue }
        if ($ch -eq '"') {
            [void]$sb.Append('\' * ($bs * 2 + 1))
            [void]$sb.Append('"')
            $bs = 0
            continue
        }
        if ($bs -gt 0) { [void]$sb.Append('\' * $bs); $bs = 0 }
        [void]$sb.Append($ch)
    }
    if ($bs -gt 0) { [void]$sb.Append('\' * ($bs * 2)) }
    [void]$sb.Append('"')
    return $sb.ToString()
}

function Test-ServiceIdentity {
    $up = "$env:USERPROFILE"
    if ($up -match '\\systemprofile(\\|$)') { return $true }
    if ($up -match '\\ServiceProfiles(\\|$)') { return $true }
    $u = "$env:USERNAME"
    if ($u -and ($u.EndsWith('$') -or $u -in @('SYSTEM', 'LOCAL SERVICE', 'NETWORK SERVICE'))) { return $true }
    return $false
}

$argList = @()
try {
    if ("$ArgJson".Trim()) {
        foreach ($p in (ConvertFrom-Json $ArgJson)) { $argList += [string]$p }
    }
} catch {
    Write-HelperError 'run-as-user' "ArgJson 解析失败: $($_.Exception.Message)"
    exit 3
}
if (-not (Test-Path $Exe)) {
    Write-HelperError 'run-as-user' "可执行文件不存在: $Exe"
    exit 3
}
if (-not $WorkingDirectory) { $WorkingDirectory = (Get-Location).Path }

# ── 非服务身份:原样直跑(stdin/stdout 天然继承,退出码透传)──
if (-not (Test-ServiceIdentity)) {
    Push-Location -LiteralPath $WorkingDirectory
    try {
        if ($NoWait) {
            # 不等待:Start-Process 只负责拉起(客户端这类长驻 GUI)
            Start-Process -FilePath $Exe -ArgumentList $argList -WorkingDirectory $WorkingDirectory | Out-Null
            exit 0
        }
        & $Exe @argList
        $code = $LASTEXITCODE
        if ($null -eq $code) { $code = 0 }
    } catch {
        Write-HelperError 'run-as-user' $_.Exception.Message
        exit 3
    } finally {
        Pop-Location
    }
    exit $code
}

# ── 服务身份:以活动控制台用户的主令牌启动 ──
$cmdLine = (Quote-Arg $Exe)
if ($argList.Count -gt 0) { $cmdLine = $cmdLine + ' ' + (($argList | ForEach-Object { Quote-Arg $_ }) -join ' ') }

$csharp = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class IHUIUserProcess
{
    private const uint TOKEN_ALL_ACCESS = 0x000F01FF;
    private const uint TOKEN_ADJUST_PRIVILEGES = 0x00000020;
    private const uint TOKEN_QUERY = 0x00000008;
    private const uint SE_PRIVILEGE_ENABLED = 0x00000002;
    private const int SecurityImpersonation = 2;
    private const int TokenPrimary = 1;
    private const uint HANDLE_FLAG_INHERIT = 0x00000001;
    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;
    private const int STD_ERROR_HANDLE = -12;
    private const int STARTF_USESTDHANDLES = 0x00000100;
    private const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const uint LOGON_WITH_PROFILE = 0x00000001;
    private const uint WAIT_OBJECT_0 = 0;
    private const uint WAIT_TIMEOUT = 0x00000102;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LUID
    {
        public uint LowPart;
        public int HighPart;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LUID_AND_ATTRIBUTES
    {
        public LUID Luid;
        public uint Attributes;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct TOKEN_PRIVILEGES
    {
        public uint PrivilegeCount;
        public LUID_AND_ATTRIBUTES Privileges;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr hObject, uint dwMask, uint dwFlags);
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);
    [DllImport("kernel32.dll")]
    private static extern uint WTSGetActiveConsoleSessionId();
    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSQueryUserToken(uint SessionId, out IntPtr phToken);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool LookupPrivilegeValue(string lpSystemName, string lpName, out LUID lpLuid);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool AdjustTokenPrivileges(IntPtr TokenHandle, bool DisableAllPrivileges, ref TOKEN_PRIVILEGES NewState, uint BufferLength, IntPtr PreviousState, IntPtr ReturnLength);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool DuplicateTokenEx(IntPtr hExistingToken, uint dwDesiredAccess, IntPtr lpTokenAttributes, int ImpersonationLevel, int TokenType, out IntPtr phNewToken);
    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool CreateEnvironmentBlock(out IntPtr lpEnvironment, IntPtr hToken, bool bInherit);
    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool DestroyEnvironmentBlock(IntPtr lpEnvironment);
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessAsUserW(IntPtr hToken, string lpApplicationName, string lpCommandLine, IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessWithTokenW(IntPtr hToken, uint dwLogonFlags, string lpApplicationName, string lpCommandLine, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);

    private static void EnablePrivileges()
    {
        IntPtr token;
        if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, out token)) return;
        try
        {
            string[] names = new string[] {
                "SeAssignPrimaryTokenPrivilege",
                "SeIncreaseQuotaPrivilege",
                "SeTcbPrivilege",
                "SeImpersonatePrivilege"
            };
            foreach (string name in names)
            {
                LUID luid;
                if (!LookupPrivilegeValue(null, name, out luid)) continue;
                TOKEN_PRIVILEGES tp = new TOKEN_PRIVILEGES();
                tp.PrivilegeCount = 1;
                tp.Privileges.Luid = luid;
                tp.Privileges.Attributes = SE_PRIVILEGE_ENABLED;
                AdjustTokenPrivileges(token, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
            }
        }
        finally { CloseHandle(token); }
    }

    public static int RunAsInteractionUser(string exe, string cmdLine, string cwd, int sessionId, int timeoutMs, bool noWait)
    {
        EnablePrivileges();
        if (sessionId <= 0)
        {
            uint active = WTSGetActiveConsoleSessionId();
            if (active == 0xFFFFFFFF || active == 0)
                throw new Win32Exception(0, "没有活动的交互式会话(桌面用户未登录)");
            sessionId = (int)active;
        }
        IntPtr sessionToken;
        if (!WTSQueryUserToken((uint)sessionId, out sessionToken))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "WTSQueryUserToken 失败(会话 " + sessionId + " 无登录用户,或当前进程缺 SeTcbPrivilege)");

        IntPtr primary = IntPtr.Zero;
        IntPtr env = IntPtr.Zero;
        try
        {
            if (!DuplicateTokenEx(sessionToken, TOKEN_ALL_ACCESS, IntPtr.Zero, SecurityImpersonation, TokenPrimary, out primary))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "DuplicateTokenEx 失败");
            if (!CreateEnvironmentBlock(out env, primary, false))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateEnvironmentBlock 失败");

            STARTUPINFO si = new STARTUPINFO();
            si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
            si.lpDesktop = "winsta0\\default";
            // 2026-10-28 真机实证修正:-NoWait(拉起长驻 GUI,如登录本机后的客户端)时
            // **绝不继承**调用方 std 句柄 —— 子进程会持有 execFileSync 的管道写端,调用方
            // 等 EOF 直到超时(ETIMEDOUT),把"拉起成功"误报成"未能重新拉起"(实测:窗口
            // 已在用户会话打开,API 却报失败)。只有等待子进程输出的路径才需要句柄回传。
            bool inherit = !noWait;
            if (inherit)
            {
                IntPtr hIn = GetStdHandle(STD_INPUT_HANDLE);
                IntPtr hOut = GetStdHandle(STD_OUTPUT_HANDLE);
                IntPtr hErr = GetStdHandle(STD_ERROR_HANDLE);
                if (hIn != IntPtr.Zero) SetHandleInformation(hIn, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
                if (hOut != IntPtr.Zero) SetHandleInformation(hOut, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
                if (hErr != IntPtr.Zero) SetHandleInformation(hErr, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
                si.dwFlags = STARTF_USESTDHANDLES;
                si.hStdInput = hIn;
                si.hStdOutput = hOut;
                si.hStdError = hErr;
            }

            PROCESS_INFORMATION pi;
            uint flags = CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW;
            bool started = CreateProcessAsUserW(primary, exe, cmdLine, IntPtr.Zero, IntPtr.Zero, inherit, flags, env, cwd, ref si, out pi);
            if (!started)
            {
                int firstError = Marshal.GetLastWin32Error();
                // 1314 = 缺 SeAssignPrimaryTokenPrivilege;换 CreateProcessWithTokenW(需 SeImpersonatePrivilege)
                started = CreateProcessWithTokenW(primary, LOGON_WITH_PROFILE, exe, cmdLine, flags, env, cwd, ref si, out pi);
                if (!started)
                    throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcessAsUser 失败(首次错误码 " + firstError + ")");
            }
            CloseHandle(pi.hThread);
            if (noWait)
            {
                // 长驻 GUI(客户端):拉起即返回,不陪它跑到退出
                CloseHandle(pi.hProcess);
                return 0;
            }
            uint wait = WaitForSingleObject(pi.hProcess, (uint)timeoutMs);
            uint code;
            if (wait == WAIT_TIMEOUT)
            {
                TerminateProcess(pi.hProcess, 124);
                WaitForSingleObject(pi.hProcess, 5000);
                CloseHandle(pi.hProcess);
                throw new Win32Exception(0, "子进程超时(" + (timeoutMs / 1000) + "s),已终止");
            }
            GetExitCodeProcess(pi.hProcess, out code);
            CloseHandle(pi.hProcess);
            return (int)code;
        }
        finally
        {
            if (env != IntPtr.Zero) DestroyEnvironmentBlock(env);
            if (primary != IntPtr.Zero) CloseHandle(primary);
            CloseHandle(sessionToken);
        }
    }
}
'@

try {
    Add-Type -TypeDefinition $csharp -Language CSharp -ErrorAction Stop
} catch {
    # 某些机器的 powershell.exe 是「PS7 二进制 + PS5.1 $PSHOME」的形态,$PSHOME 只读且没有 ref 目录
    # ⇒ Add-Type 永远编译不了(Roslyn 找不到 .NET 引用程序集)。此时换真 pwsh 重跑自身,只转一次。
    $compileError = $_.Exception.Message
    if (-not $env:IHUI_RUN_AS_USER_REEXEC -and $scriptPath) {
        $pwsh = Find-Pwsh
        if ($pwsh) {
            $env:IHUI_RUN_AS_USER_REEXEC = '1'
            $retryArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath,
                '-Exe', $Exe, '-ArgJson', $ArgJson, '-SessionId', "$SessionId", '-TimeoutSeconds', "$TimeoutSeconds")
            if ($NoWait) { $retryArgs += '-NoWait' }
            if ($WorkingDirectory) { $retryArgs += @('-WorkingDirectory', $WorkingDirectory) }
            & $pwsh @retryArgs
            exit $LASTEXITCODE
        }
    }
    Write-HelperError 'run-as-user' "内联 P/Invoke 编译失败: $compileError"
    exit 3
}

try {
    $code = [IHUIUserProcess]::RunAsInteractionUser($Exe, $cmdLine, $WorkingDirectory, $SessionId, ($TimeoutSeconds * 1000), [bool]$NoWait)
    exit $code
} catch {
    Write-HelperError 'run-as-user' $_.Exception.Message
    exit 3
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
