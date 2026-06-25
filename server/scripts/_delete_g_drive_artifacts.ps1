$ErrorActionPreference = 'Continue'
# 2026-06-25 扩展: 增加 G:\Users 清理 (rewrite_edu_models.py 误存)
$paths = @(
    'G:\1\pw-output',
    'G:\dev\stdout',
    'G:\tmp\ro.css',
    'G:\tmp\refund_evidence',
    'G:\Users'
)

function Remove-EmptyDirectoryTree {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        # 自底向上删除空目录
        Get-ChildItem -LiteralPath $Path -Recurse -Force -Directory -ErrorAction SilentlyContinue |
            Sort-Object { ($_.FullName.Split('\').Count) } -Descending |
            ForEach-Object {
                try {
                    if ((Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
                        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
                        Write-Host "DELETED-EMPTY: $($_.FullName)"
                    }
                } catch {
                    # 静默跳过
                }
            }
        # 最后尝试删除根路径
        if (Test-Path -LiteralPath $Path) {
            $entries = Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue
            if ($entries.Count -eq 0) {
                Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
                Write-Host "DELETED: $Path"
            } else {
                Write-Host "NON-EMPTY-SKIPPED: $Path ($($entries.Count) 项)"
            }
        }
    } catch {
        Write-Host "FAILED: $Path -- $($_.Exception.Message)"
    }
}

foreach ($p in $paths) {
    if (Test-Path -LiteralPath $p) {
        if ((Get-Item -LiteralPath $p).PSIsContainer) {
            Remove-EmptyDirectoryTree -Path $p
        } else {
            try {
                Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
                Write-Host "DELETED: $p"
            } catch {
                Write-Host "FAILED: $p -- $($_.Exception.Message)"
            }
        }
    } else {
        Write-Host "NOT-EXIST: $p"
    }
}
