# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ── CloudflaredApi 隧道服务自愈(2026-11-20 立,RP-7 事故后)────────────────────
# 事故:为做一个边缘协议实验,把 CloudflaredApi 的 --edge-ip-version 6 改成 4,`sc stop` 撞
# STOP_PENDING 后再没起来;而 api.aizhs.top / sso.aizhs.top / ssh.aizhs.top 全由这条隧道承载,
# 于是公网入口 1033、SSH 同断 —— 为一个性能实验把唯一的控制入口自己关掉了。
# 本节只做两件幂等的事,不碰 token、不碰任何其它服务:
#   ① 服务存在且非 Running ⇒ 先清僵死进程(PID 非 0 的 StopPending 形态)→ Start-Service;
#   ② binPath 停在 v4 实验值且备份件在位 ⇒ 回滚成备份值(已在跑的再 Restart 一次);
# 全程 try/catch,任何异常只打一行,绝不让部署链因此失败。
# 调用方:deploy/win/ihui-deploy.ps1 在取源之前一行 `& heal-tunnel-service.ps1`。

$ErrorActionPreference = 'Continue'

function Say([string]$m) { Write-Output ("[TUNNEL-HEAL] " + $m) }

try {
    $SvcName    = 'CloudflaredApi'
    $BackupPath = 'D:\DevEnv\logs\cloudflared-binpath.bak'
    $V4Pattern  = '--edge-ip-version\s*4'

    $svc = $null
    try { $svc = Get-Service -Name $SvcName -ErrorAction Stop }
    catch { Say ("no service '" + $SvcName + "' on this host, skip (not a windows prod box)"); return }

    $binPath = ''
    try {
        $binPath = [string](Get-CimInstance Win32_Service -Filter ("Name='" + $SvcName + "'") -ErrorAction Stop).PathName
    } catch { Say ("read binPath failed: " + $_.Exception.Message) }

    $rewritten = $false
    if ($binPath -match $V4Pattern) {
        if (Test-Path -LiteralPath $BackupPath) {
            $orig = (Get-Content -LiteralPath $BackupPath -Raw).Trim()
            if ($orig) {
                & sc.exe config $SvcName binPath= $orig | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $rewritten = $true
                    Say ("binPath reverted to backup (len=" + $orig.Length + ")")
                } else {
                    Say ("binPath revert failed rc=" + $LASTEXITCODE)
                }
            } else { Say 'backup file empty, no revert' }
        } else { Say ("backup missing: " + $BackupPath) }
    }

    $svc.Refresh()
    if ($svc.Status -ne 'Running') {
        if ($svc.Status -eq 'StopPending' -or $svc.Status -eq 'StartPending') {
            $stalePid = 0
            try { $stalePid = [int](Get-CimInstance Win32_Service -Filter ("Name='" + $SvcName + "'")).ProcessId } catch { }
            if ($stalePid -gt 0) {
                try {
                    Stop-Process -Id $stalePid -Force -ErrorAction Stop
                    Start-Sleep -Seconds 2
                    Say ("killed stale pid " + $stalePid)
                } catch { Say ("kill stale pid failed: " + $_.Exception.Message) }
            }
        }
        try {
            Start-Service -Name $SvcName -ErrorAction Stop
            Start-Sleep -Seconds 3
            Say ("started, status=" + (Get-Service -Name $SvcName).Status)
        } catch { Say ("start failed: " + $_.Exception.Message) }
    } elseif ($rewritten) {
        try {
            Restart-Service -Name $SvcName -Force -ErrorAction Stop
            Say 'restarted to apply reverted binPath'
        } catch { Say ("restart failed: " + $_.Exception.Message) }
    } else {
        Say ("already running, no action (status=" + $svc.Status + ")")
    }
} catch {
    Say ("unexpected failure: " + $_.Exception.Message)
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
