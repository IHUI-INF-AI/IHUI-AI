# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
#requires -Version 7
<#
.SYNOPSIS
  本机 Qoder 登录态捕获(号池一键导入工具的捕获段,2026-10-23 立)。
.DESCRIPTION
  扫描 %APPDATA% 下 com.qoder.app.* / com.qodercn.app.* 数据目录(mtime 新→旧),
  用 Local State 的 os_crypt.encrypted_key(DPAPI)解出 AES-256 密钥,解密
  auth.v1.dat(v10 + nonce12 + ct+tag16,AES-256-GCM)得到会话 JSON;
  附带 auth.machine-id、qoder-data.v1.json 的 deviceId、安装目录
  build-manifest.json 的 productVersion、runtime-info.exe 的机器指纹
  (machineToken/machineCode/machineType,best-effort)。
  输出 { sessions: [...] } JSON(与桌面端 CapturedQoderSession 字段对齐),
  含明文凭证 —— 只在本机内存/管道使用,勿落盘勿入仓。
.PARAMETER OutFile
  可选:把会话 JSON 写文件(默认只写 stdout,由调用方管道捕获)。
.EXAMPLE
  pwsh -NoProfile -File qoder-capture.ps1
  pwsh -NoProfile -File qoder-capture.ps1 -OutFile session.json
#>
param(
    [string]$OutFile = ""
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ConvertFrom-Json 把 ISO 时间转成 DateTime,直接字符串化会丢时区(Kind=Utc 的
# "2026-11-22T03:31:28Z" 会变成 "11/22/2026 03:31:28"),下游 Node 按本地时区
# 解析 ⇒ 到期时间偏 8 小时。捕获段统一固化成 UTC ISO。
function ConvertTo-IsoUtc($v) {
    if ($null -eq $v) { return '' }
    if ($v -is [datetime]) {
        return $v.ToUniversalTime().ToString(
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            [System.Globalization.CultureInfo]::InvariantCulture
        )
    }
    return "$v".Trim()
}

# ── 1. Qoder 数据目录(mtime 新→旧;国际版 com.qoder.app.* / 国内版 com.qodercn.app.*)──
$base = $env:APPDATA
if (-not $base) { Write-Error 'APPDATA 未设置(非 Windows 交互会话?)'; exit 2 }
$dirs = Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'com.qoder.app.*' -or $_.Name -like 'com.qodercn.app.*' } |
    Sort-Object LastWriteTime -Descending
if (-not $dirs) { Write-Error "未找到 Qoder 数据目录($base 下 com.qoder[cn].app.*);请先在本机登录 Qoder 客户端"; exit 2 }

$sessions = New-Object System.Collections.ArrayList
foreach ($dir in $dirs) {
    $rawPath = Join-Path $dir.FullName 'auth.v1.dat'
    $statePath = Join-Path $dir.FullName 'Local State'
    if (-not (Test-Path $rawPath) -or -not (Test-Path $statePath)) { continue }

    # ── 2. Local State → AES-256 密钥(Chromium v10 同构:base64,剥 5B DPAPI 前缀)──
    try {
        $ls = Get-Content $statePath -Raw | ConvertFrom-Json
        $enc = [Convert]::FromBase64String($ls.os_crypt.encrypted_key)
    } catch {
        Write-Warning "$($dir.Name): Local State 读取/解析失败,跳过"
        continue
    }
    if ([Text.Encoding]::ASCII.GetString($enc[0..4]) -ne 'DPAPI') {
        Write-Warning "$($dir.Name): encrypted_key 缺 DPAPI 前缀,跳过"
        continue
    }
    try {
        $key = [System.Security.Cryptography.ProtectedData]::Unprotect($enc[5..($enc.Length - 1)], $null, 'CurrentUser')
    } catch {
        Write-Warning "$($dir.Name): DPAPI 解密失败(须以登录 Qoder 的同一 Windows 用户运行),跳过"
        continue
    }

    # ── 3. auth.v1.dat:v10(3B) + nonce(12B) + ct + tag(16B) ──
    try {
        $raw = [IO.File]::ReadAllBytes($rawPath)
        if ([Text.Encoding]::ASCII.GetString($raw[0..2]) -ne 'v10') { Write-Warning "$($dir.Name): auth.v1.dat 非 v10 格式,跳过"; continue }
        $nonce = $raw[3..14]
        $ctAndTag = $raw[15..($raw.Length - 1)]
        $ct = $ctAndTag[0..($ctAndTag.Length - 17)]
        $tag = $ctAndTag[($ctAndTag.Length - 16)..($ctAndTag.Length - 1)]
        $aes = [System.Security.Cryptography.AesGcm]::new($key)
        $plain = [byte[]]::new($ct.Length)
        $aes.Decrypt($nonce, $ct, $tag, $plain)
        $session = [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
    } catch {
        Write-Warning "$($dir.Name): auth.v1.dat 解密失败,跳过"
        continue
    }

    $token = "$($session.token)".Trim()
    if (-not $token) { Write-Warning "$($dir.Name): 会话缺 token,跳过"; continue }

    # uid 真源 = session.user.id(opaque token 实证);解析不出 ⇒ 跳过(不推无名号)
    $uid = ""
    if ($session.user) { $uid = "$($session.user.id)".Trim() }
    if (-not $uid) {
        if ($session.userId) { $uid = "$($session.userId)".Trim() }
        elseif ($session.uid) { $uid = "$($session.uid)".Trim() }
    }
    if (-not $uid) { Write-Warning "$($dir.Name): 会话解析不出 uid(user.id 缺失),跳过"; continue }

    $machineId = ""
    $midPath = Join-Path $dir.FullName 'auth.machine-id'
    if (Test-Path $midPath) { $machineId = (Get-Content $midPath -Raw).Trim() }

    $deviceId = ""
    $dataPath = Join-Path $dir.FullName 'qoder-data.v1.json'
    if (Test-Path $dataPath) {
        try { $deviceId = "$((Get-Content $dataPath -Raw | ConvertFrom-Json).deviceId)".Trim() } catch {}
    }

    # ── 4. 安装目录:productVersion + runtime-info.exe 机器指纹(best-effort)──
    # 2026-10-23 修:本机 Qoder CN 装在 G:\Qoder CN(非 LOCALAPPDATA/Program Files),
    # 且 build-manifest.json 在 .qoder-versions\<ver>\resources\ 下(多版本并存,取最高版);
    # runtime-info.exe --account-stdin 需要 stdin 喂 {uid,token} 才产出机器指纹(裸跑无输出)。
    $version = ""; $machineToken = ""; $machineCode = ""; $machineType = ""
    $roots = New-Object System.Collections.ArrayList
    if ($env:QODER_INSTALL_DIR) { [void]$roots.Add($env:QODER_INSTALL_DIR) }
    [void]$roots.Add('G:\Qoder CN')
    if ($env:LOCALAPPDATA) {
        [void]$roots.Add((Join-Path $env:LOCALAPPDATA 'Programs\Qoder CN'))
        [void]$roots.Add((Join-Path $env:LOCALAPPDATA 'Programs\Qoder'))
    }
    foreach ($pf in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($pf) {
            [void]$roots.Add((Join-Path $pf 'Qoder CN'))
            [void]$roots.Add((Join-Path $pf 'Qoder'))
        }
    }
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        $mf = Join-Path $root 'build-manifest.json'
        if (-not $version -and (Test-Path $mf)) {
            try { $version = "$((Get-Content $mf -Raw | ConvertFrom-Json).productVersion)".Trim() } catch {}
        }
        if (-not $version) {
            # 多版本安装形态:<root>\.qoder-versions\<ver>\resources\build-manifest.json,取版本号最高者
            try {
                $vmf = Get-ChildItem (Join-Path $root '.qoder-versions\*\resources\build-manifest.json') -ErrorAction Stop |
                    Sort-Object { [version]$_.Directory.Parent.Name } -Descending | Select-Object -First 1
                if ($vmf) { $version = "$((Get-Content $vmf.FullName -Raw | ConvertFrom-Json).productVersion)".Trim() }
            } catch {}
        }
        $exe = Join-Path $root 'resources\umid\runtime-info.exe'
        if (-not (Test-Path $exe)) {
            $exe = Join-Path $root '.qoder-versions\*\resources\umid\runtime-info.exe'
            $exe = (Get-Item $exe -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1).FullName
        }
        if (-not $machineToken -and $exe -and (Test-Path $exe)) {
            try {
                # --account-stdin 需要 stdin 喂 {uid,token}(实测:裸跑无输出)
                $acctJson = @{ uid = "$uid"; token = "$token" } | ConvertTo-Json -Compress
                $line = $acctJson | & $exe --account-stdin 2>$null | Select-Object -Last 1
                if ($line) {
                    $v = $line | ConvertFrom-Json
                    $machineToken = "$($v.machineToken)".Trim()
                    $machineCode = "$($v.machineCode)".Trim()
                    $machineType = "$($v.machineType)".Trim()
                }
            } catch {}
        }
    }

    $phone = ""; $nick = ""; $uname = ""
    if ($session.user) {
        $phone = "$($session.user.phone)".Trim()
        $nick = "$($session.user.nickname)".Trim()
        $uname = "$($session.user.name)".Trim()
    }
    $edition = if ($dir.Name -like 'com.qodercn.*') { 'cn' } else { 'intl' }

    [void]$sessions.Add([ordered]@{
        appDir                = $dir.FullName
        edition               = $edition
        # 会话原文(含凭证):供「登录本机」重封 auth.v1.dat 用;提取器会剔凭证后存成 sessionTemplate
        rawSession            = $session
        uid                   = $uid
        accessToken           = $token
        refreshToken          = "$($session.refreshToken)".Trim()
        expiresAt             = ConvertTo-IsoUtc $session.expiresAt
        refreshTokenExpiresAt = ConvertTo-IsoUtc $session.refreshTokenExpiresAt
        machineId             = $machineId
        deviceId              = $deviceId
        version               = $version
        machineToken          = $machineToken
        machineCode           = $machineCode
        machineType           = $machineType
        phone                 = $phone
        nickname              = $nick
        name                  = $uname
    })
}

if ($sessions.Count -eq 0) { Write-Error '未解出任何 Qoder 会话(登录态缺失或全部解密失败)'; exit 1 }
$json = @{ sessions = @($sessions) } | ConvertTo-Json -Depth 20
if ($OutFile) {
    $json | Out-File -FilePath $OutFile -Encoding utf8NoBOM
    Write-Output "SAVED=$OutFile"
} else {
    Write-Output $json
}
