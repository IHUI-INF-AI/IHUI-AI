<#
.SYNOPSIS
    等待 TCP 端口空闲 (适用于后端/前端开发服务启动前的端口冲突避免).

.DESCRIPTION
    监听指定端口, 占用中时执行指定动作 (-Kill 杀进程 / -Free 等待释放),
    释放后继续. 最多等待 -Timeout 秒.

.PARAMETER Port
    要等待的端口号.

.PARAMETER Timeout
    最多等待秒数 (默认 60).

.PARAMETER Kill
    等待期间发现占用时, 直接 Stop-Process 杀掉 (需要 -Force).

.PARAMETER Force
    Stop-Process 强制.

.EXAMPLE
    powershell -File scripts/Wait-Port.ps1 -Port 8000 -Timeout 90 -Kill
    powershell -File scripts/Wait-Port.ps1 -Port 8888 -Timeout 30
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$Timeout = 60,
    [switch]$Kill,
    [switch]$Force
)

$start = Get-Date
$end = $start.AddSeconds($Timeout)

function Test-PortBusy {
    param([int]$P)
    $conn = Get-NetTCPConnection -LocalPort $P -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

while ((Get-Date) -lt $end) {
    if (-not (Test-PortBusy -P $Port)) {
        Write-Host "[Wait-Port] 端口 $Port 已释放."
        exit 0
    }
    if ($Kill) {
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object {
                if ($Force) { Stop-Process -Id ([int]$_.OwningProcess) -Force -ErrorAction SilentlyContinue }
                else { Stop-Process -Id ([int]$_.OwningProcess) -ErrorAction SilentlyContinue }
            }
        Write-Host "[Wait-Port] 已尝试 kill 端口 $Port 上的进程."
    }
    Start-Sleep -Milliseconds 500
}

Write-Error "[Wait-Port] 等待 $Timeout 秒后, 端口 $Port 仍被占用."
exit 1
