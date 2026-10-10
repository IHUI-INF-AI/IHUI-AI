# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# 健康门禁 admin 凭据的解析与"两处漂移"对照(2026-10-10 立)
#
# 为什么必须有这一份:口令有两个存放点,而 deploy/win/ihui-deploy.ps1 的取值序是
# **服务环境块优先**(env:IHUI_ADMIN_PASSWORD → 回落文件),所以某一处陈旧时
# **另一处再新也轮不到它**,而症状完全无声:门禁把 llm 维度按"未知"放行(等于盲的),
# 且每轮部署白烧 1-2 次失败登录(耗账号侧「剩余 N 次即锁定」预算)。
# 2026-10-10 实测:env 块的值为陈旧值(登录 HTTP 401),回落文件的值可用(HTTP 200),
# 推定口令那次变更后 env 未同步(全程无声)。修法是 §5e 事务式同步,但**发现它**需要
# 一把常驻尺子 —— 就是本模块:两处都在且指纹不同 ⇒ 调用方记 WARN(不动任何凭据)。
#
# 设计约束(照抄别重新发明):
#   · 只报"是否漂"与**指纹**(长度 + SHA-256 前 12 位,与 scripts/check-credential-health.mjs
#     同一口径)。调用方把指纹写进日志是许可的,**打印口令明文是禁止的**。
#   · 取值优先级一字不改:env 非空串 ⇒ 用 env;否则落到文件。漂移只加一条 WARN,
#     不改"用哪把"——"用哪把"属凭据边界决策,不在本模块。
#   · 两版本通用语法(deploy 面无 #requires 豁免、由 PS7 部署环与 5.1 取证会话共用,
#     见 AGENTS §27 的适用面例外):不用 `?:` / `??` / `-not (x -isnot …)` 之类的新语法。
# =============================================================================

function Get-CredentialFingerprint {
    param([string]$Value)
    if ($null -eq $Value) { return '(null)' }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Value)
        $hex = ([System.BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()
        return ('len={0} sha256={1}' -f ([string]$Value).Length, $hex.Substring(0, 12))
    } finally { $sha.Dispose() }
}

function Resolve-AdminCredential {
    # 返回对象字段:Value(明文,仅供登录用) / Source('env'|'file'|'none') / Drift(bool)
    #               / EnvFingerprint / FileFingerprint(指纹,可安全写日志)
    param([string]$EnvValue, [string]$File)
    # 与改动前的等价判据逐字对齐:env 空串视为缺(旧代码 `if (-not $adminPwd)` 对 '' 为假),
    # 但空格串旧代码会当值用 ⇒ 这里保持"非空即用",不 Trim(异常值由上面的漂移 WARN 显形)。
    $envPwd = $EnvValue
    if ($null -eq $envPwd) { $envPwd = $null }
    elseif ($envPwd -eq '') { $envPwd = $null }
    $filePwd = $null
    if ($File -and (Test-Path -LiteralPath $File)) {
        try { $filePwd = (Get-Content -LiteralPath $File -Raw).Trim() } catch { $filePwd = $null }
        if ($null -ne $filePwd -and $filePwd -eq '') { $filePwd = $null }
    }
    $source = 'none'
    $value = $null
    if ($envPwd) { $source = 'env'; $value = $envPwd }
    elseif ($filePwd) { $source = 'file'; $value = $filePwd }
    $drift = $false
    if ($envPwd -and $filePwd -and ($envPwd -cne $filePwd)) { $drift = $true }
    $envFp = '(absent)'
    if ($envPwd) { $envFp = Get-CredentialFingerprint -Value $envPwd }
    $fileFp = '(absent)'
    if ($filePwd) { $fileFp = Get-CredentialFingerprint -Value $filePwd }
    return [pscustomobject]@{
        Value           = $value
        Source          = $source
        Drift           = $drift
        EnvFingerprint  = $envFp
        FileFingerprint = $fileFp
    }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
