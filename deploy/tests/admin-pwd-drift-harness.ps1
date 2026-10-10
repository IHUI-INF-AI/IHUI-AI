# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# 行为验证:admin-credential.ps1 的"取值序不变 + 两处漂移可判"语义(全部跑临时文件,绝不碰真实凭据)
# 取证入口:node scripts/run-evidence.mjs? 不 —— 本门是常驻自检,直接跑:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy\tests\admin-pwd-drift-harness.ps1
param([string]$ModulePath = (Join-Path $PSScriptRoot '..\win\admin-credential.ps1'))
$ErrorActionPreference = 'Stop'
. $ModulePath

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) 'ihui-admin-cred-harness'
if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir | Out-Null }
$pwdFile = Join-Path $tmpDir 'admin-pwd-src.txt'
$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function SetPwdFile([string]$content) { [System.IO.File]::WriteAllText($pwdFile, $content, [System.Text.UTF8Encoding]::new($false)) }

Write-Output '[1] env 与文件同值 ⇒ 用 env、不报漂'
SetPwdFile "AAA-same-1`n"
$r1 = Resolve-AdminCredential -EnvValue 'AAA-same-1' -File $pwdFile
T '1a Value 取 env' ($r1.Value -ceq 'AAA-same-1') "Value=$($r1.Value)"
T '1b Source=env' ($r1.Source -eq 'env') "Source=$($r1.Source)"
T '1c Drift=false' ($r1.Drift -eq $false) "Drift=$($r1.Drift)"

Write-Output '[2] 两处不同值 ⇒ 报漂,但取值序仍是 env 优先(不改"用哪把")'
SetPwdFile "BBB-file-2`n"
$r2 = Resolve-AdminCredential -EnvValue 'AAA-env-stale' -File $pwdFile
T '2a Drift=true' ($r2.Drift -eq $true) "Drift=$($r2.Drift)"
T '2b Value 仍是 env 的那把' ($r2.Value -ceq 'AAA-env-stale') "Value=$($r2.Value)"
T '2c 两个指纹都成形且不同' (($r2.EnvFingerprint -match '^len=\d+ sha256=[0-9a-f]{12}$') -and ($r2.FileFingerprint -match '^len=\d+ sha256=[0-9a-f]{12}$') -and ($r2.EnvFingerprint -cne $r2.FileFingerprint)) "$($r2.EnvFingerprint) | $($r2.FileFingerprint)"
T '2d 指纹不含明文' (($r2.EnvFingerprint -notmatch 'AAA') -and ($r2.FileFingerprint -notmatch 'BBB')) '指纹把口令泄进日志了'

Write-Output '[3] 只有 env ⇒ 不报漂(文件侧记 absent)'
$r3 = Resolve-AdminCredential -EnvValue 'CCC-env-only' -File (Join-Path $tmpDir 'not-exist.txt')
T '3a Source=env / Drift=false' (($r3.Source -eq 'env') -and ($r3.Drift -eq $false)) "Source=$($r3.Source) Drift=$($r3.Drift)"
T '3b 文件侧指纹=absent' ($r3.FileFingerprint -eq '(absent)') "FileFingerprint=$($r3.FileFingerprint)"

Write-Output '[4] 只有文件 ⇒ 回落取文件(旧行为一字不变)'
SetPwdFile "DDD-file-only`n"
$r4 = Resolve-AdminCredential -EnvValue $null -File $pwdFile
T '4a Source=file 且 Value=文件值(已 Trim)' (($r4.Source -eq 'file') -and ($r4.Value -ceq 'DDD-file-only')) "Source=$($r4.Source) Value=$($r4.Value)"
T '4b Drift=false' ($r4.Drift -eq $false) "Drift=$($r4.Drift)"

Write-Output '[5] env 为空串 ⇒ 视为缺,回落文件(与旧代码 `-not $adminPwd` 等价)'
$r5 = Resolve-AdminCredential -EnvValue '' -File $pwdFile
T '5a Source=file' ($r5.Source -eq 'file') "Source=$($r5.Source)"
T '5b Drift=false(空串不算一处存量)' ($r5.Drift -eq $false) "Drift=$($r5.Drift)"

Write-Output '[6] 两处都缺 ⇒ none(调用方据此判"无凭据",不得造值)'
$r6 = Resolve-AdminCredential -EnvValue $null -File (Join-Path $tmpDir 'not-exist.txt')
T '6a Source=none / Value=null' (($r6.Source -eq 'none') -and ($null -eq $r6.Value) -and ($r6.Drift -eq $false)) "Source=$($r6.Source) Value=$($r6.Value)"

Write-Output '[7] 文件只有空白 ⇒ 视为缺(不被当成一把口令)'
SetPwdFile "   `n"
$r7 = Resolve-AdminCredential -EnvValue 'EEE-env' -File $pwdFile
T '7a 文件侧缺 ⇒ FileFingerprint=absent 且不报漂' (($r7.FileFingerprint -eq '(absent)') -and ($r7.Drift -eq $false) -and ($r7.Source -eq 'env')) "fileFp=$($r7.FileFingerprint) Drift=$($r7.Drift)"

Write-Output '[8] 指纹自身:稳定、随值变、长度参与'
$f1 = Get-CredentialFingerprint -Value 'xxxx-yyyy'
$f2 = Get-CredentialFingerprint -Value 'xxxx-yyyy'
$f3 = Get-CredentialFingerprint -Value 'xxxx-yyyzz'
$f4 = Get-CredentialFingerprint -Value 'xxxx-yyy'
T '8a 同值同指纹' ($f1 -ceq $f2) "$f1 vs $f2"
T '8b 异值异指纹' ($f1 -cne $f3) "$f1 vs $f3"
T '8c 长度进指纹(前缀相同、长度不同也不同)' ($f1 -cne $f4) "$f1 vs $f4"

Write-Output '[9] 装车锁:调用点必须真的用唯一实现,且 WARN 不许带明文'
$src = Get-Content (Join-Path $PSScriptRoot '..\win\ihui-deploy.ps1') -Raw
T '9a 部署脚本 dot-source 了唯一实现' ($src -match "admin-credential\.ps1") '模块没接线 ⇒ 本票等于没做'
T '9b BackendLogin-Token 调用 Resolve-AdminCredential(env+文件两参都传)' ($src -match 'Resolve-AdminCredential -EnvValue \$env:IHUI_ADMIN_PASSWORD -File \$AdminPwdFile') '取值序没走唯一实现'
T '9c 漂移 WARN 存在且带"不一致"' ($src -match '两处 admin 口令不一致') '漂了不喊 ⇒ 本次修复的判据面不存在'
$warnLines = @($src -split "\r?\n" | Where-Object { $_ -match '两处 admin 口令不一致' })
T '9d WARN 行只记指纹、不记口令(不得出现 .Value / $adminPwd)' (($warnLines.Count -ge 1) -and (($warnLines -join ' ') -notmatch '\.Value|adminPwd')) ($warnLines -join ' ')
T '9e 部署脚本里不再有第二份手写取值序(旧 Get-Content+Trim 形态必须消失)' ($src -notmatch "Get-Content \`$AdminPwdFile") '第二份真相回来了'

if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
Write-Output ''
Write-Output ("RESULT pass={0} fail={1}" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
