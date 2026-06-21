$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $root 'dist/copyright-src'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Path $stage | Out-Null

$copyDirs = @(
  'src/components','src/pages','src/pagesA','src/service','src/api','src/mixins','src/store','src/constants','src/static','src/typings'
)
foreach ($d in $copyDirs) {
  $srcPath = Join-Path $root $d
  $dstPath = Join-Path $stage $d
  New-Item -ItemType Directory -Path (Split-Path $dstPath -Parent) -ErrorAction SilentlyContinue | Out-Null
  Copy-Item -Path $srcPath -Destination $dstPath -Recurse -Force
}

# 云函数（排除 uni-id-co）
$cfSrc = Join-Path $root 'src/uniCloud-aliyun/cloudfunctions'
$cfDst = Join-Path $stage 'src/uniCloud-aliyun/cloudfunctions'
New-Item -ItemType Directory -Path (Split-Path $cfDst -Parent) -ErrorAction SilentlyContinue | Out-Null
Copy-Item -Path $cfSrc -Destination $cfDst -Recurse -Force
$uniIdCo = Join-Path $cfDst 'uni-id-co'
if (Test-Path $uniIdCo) { Remove-Item -Recurse -Force $uniIdCo }

# 数据库 schema
$dbSrc = Join-Path $root 'src/uniCloud-aliyun/database'
$dbDst = Join-Path $stage 'src/uniCloud-aliyun/database'
Copy-Item -Path $dbSrc -Destination $dbDst -Recurse -Force

# 顶层 CloudBase 函数
$cbDstRoot = Join-Path $stage 'cloudfunctions'
New-Item -ItemType Directory -Path $cbDstRoot -ErrorAction SilentlyContinue | Out-Null
Copy-Item -Path (Join-Path $root 'cloudfunctions/coze_chatv3_request') -Destination (Join-Path $cbDstRoot 'coze_chatv3_request') -Recurse -Force

# 入口文件与配置
$rootFiles = @('src/App.vue','src/main.js','src/pages.json','src/manifest.json','project.config.json')
foreach ($f in $rootFiles) {
  $srcFile = Join-Path $root $f
  $dstFile = Join-Path $stage $f
  New-Item -ItemType Directory -Path (Split-Path $dstFile -Parent) -ErrorAction SilentlyContinue | Out-Null
  Copy-Item -Path $srcFile -Destination $dstFile -Force
}

$zipPath = Join-Path $root 'docs/源代码提交包.zip'
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -Force
Write-Output "Created ZIP: $zipPath"