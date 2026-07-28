# scripts/fix-trae-workspace.ps1
# TRAE VM 环境下 pnpm workspace junction 修复脚本
# 问题：TRAE VM 路径虚拟化导致 node_modules/@ihui/* 和 node_modules/@types/node 的 junction 指向 VM 缓存路径，无法解析
# 解决方案：删除断链，用 robocopy 从 pnpm store 复制实际文件

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host '=== TRAE VM Workspace Fix ===' -ForegroundColor Cyan

# 1. Fix @ihui/* workspace packages
$pkgs = @{
  'database'       = 'packages\database'
  'auth'           = 'packages\auth'
  'types'          = 'packages\types'
  'ui'             = 'packages\ui'
  'config'         = 'packages\config'
  'eslint-config'  = 'packages\eslint-config'
  'tsconfig'       = 'packages\tsconfig'
  'sdk'            = 'packages\sdk'
  'api'            = 'apps\api'
  'web'            = 'apps\web'
  'cli'            = 'apps\cli'
  'miniapp-taro'   = 'apps\miniapp-taro'
}

$ihuiDir = "$root\node_modules\@ihui"
if (!(Test-Path $ihuiDir)) { New-Item -ItemType Directory -Path $ihuiDir -Force | Out-Null }

foreach ($name in $pkgs.Keys | Sort-Object) {
  $linkPath = "$ihuiDir\$name"
  $targetPath = "$root\$($pkgs[$name])"
  if (!(Test-Path $targetPath)) { continue }

  if (Test-Path $linkPath) {
    $item = Get-Item $linkPath -Force -ErrorAction SilentlyContinue
    if ($item.LinkType) { [System.IO.Directory]::Delete($linkPath, $false) }
    else { Remove-Item $linkPath -Force -Recurse -ErrorAction SilentlyContinue }
  }
  robocopy $targetPath $linkPath /E /XD node_modules .turbo /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1 | Out-Null
  $ok = Test-Path "$linkPath\package.json"
  Write-Host "  @ihui/$name -> $(if ($ok) {'OK'} else {'FAIL'})" -ForegroundColor $(if ($ok) {'Green'} else {'Red'})
}

# 2. Fix @types/node (broken junction -> copy from pnpm store)
$typesNodeDir = "$root\node_modules\@types\node"
if (Test-Path $typesNodeDir) {
  $item = Get-Item $typesNodeDir -Force -ErrorAction SilentlyContinue
  if ($item.LinkType -and !(Test-Path "$typesNodeDir\package.json")) {
    [System.IO.Directory]::Delete($typesNodeDir, $false)
    $storeNode = Get-ChildItem "$root\node_modules\.pnpm" -Directory -Filter '@types+node@*' |
      Sort-Object Name -Descending | Select-Object -First 1
    if ($storeNode) {
      robocopy "$($storeNode.FullName)\node_modules\@types\node" $typesNodeDir /E /XD node_modules /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1 | Out-Null
      Write-Host "  @types/node -> OK (from $($storeNode.Name))" -ForegroundColor Green
    }
  }
}

# 3. Fix @types/minimatch (empty stub package, create index.d.ts)
$mmDir = "$root\node_modules\@types\minimatch"
if (Test-Path $mmDir) {
  if (!(Test-Path "$mmDir\index.d.ts")) {
    @'
declare module 'minimatch' {
  export interface IMinimatchOptions {
    dot?: boolean; noglobstar?: boolean; nocase?: boolean; matchBase?: boolean
    nocomment?: boolean; nobrace?: boolean; noext?: boolean; nonegate?: boolean
    debug?: boolean; windowsPathsNoEscape?: boolean; preserveMultipleSlashes?: boolean
  }
  export class Minimatch {
    constructor(pattern: string, options?: IMinimatchOptions)
    match(name: string, returnBoolean?: boolean): boolean
    set: string[][]; pattern: string; options: IMinimatchOptions
    regexp: RegExp | null; negate: boolean; comment: boolean; empty: boolean
    makeRe(): RegExp | false
    matchOne(files: string[], pattern: string[], partial?: boolean): boolean
  }
  export function minimatch(name: string, pattern: string, options?: IMinimatchOptions): boolean
  export function filter(pattern: string, options?: IMinimatchOptions): (name: string) => boolean
  export const sep: string
  export const GLOBSTAR: unique symbol
  export default minimatch
}
'@ | Set-Content "$mmDir\index.d.ts" -Encoding UTF8
    Write-Host '  @types/minimatch -> OK (created index.d.ts)' -ForegroundColor Green
  }
}

Write-Host '=== Done ===' -ForegroundColor Cyan
