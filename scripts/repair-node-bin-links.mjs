#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 重建根 `node_modules/.bin` 里丢失的可执行 shim。
 *
 * 为什么要有这个脚本(2026-09-24 实测):§12e 的既定 remedy 是"跑全量 `pnpm install`",
 * 但本机 `.bin` 被削掉 eslint/tsc 后,`pnpm install` 与 `pnpm install --force` 都在 1.2 秒内
 * 回 "Already up to date" —— pnpm 认为树是好的(根 `node_modules/.modules.yaml` 甚至不存在),
 * 于是**文档给的修法对这个形态完全不起作用**。后果是链式的:
 *   .bin/eslint 缺失 → lint-staged 的 `eslint --fix` 任务报"不是内部或外部命令"
 *   → 每次 commit 的 pre-commit 必红 → 各会话按 §12 合法 `--no-verify`
 *   → 约 110 道守门对**全队**同时失效(本会话实测连续 3 次提交因此跳门)。
 *
 * 判据与动作:只处理**根 package.json 直接依赖**里 `node_modules/<pkg>` 本体完好、
 * 但其 `bin` 声明的某个 shim 文件不存在的情况,按 pnpm 自己的 .CMD 版式补写
 * (`%~dp0\..\ <pkg>\ <binfile>`,靠 node_modules 里的既有符号链接解析)。
 * 包本体缺失 ⇒ 只点名不伪造(那才真需要重装)。全程幂等:存在即跳过。
 *
 * 用法: node scripts/repair-node-bin-links.mjs [--check] [--json]
 *   --check  零副作用,只报缺哪些(供守门/CI 用);有缺失 exit 1
 * 退出码: 0=无需修复/修复完成; 1=有缺失且为 --check,或修复后仍缺; 2=脚本自身异常
 */
import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const CHECK = argv.includes('--check')
const JSONOUT = argv.includes('--json')

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

/** pnpm 的 .CMD 版式(与 node_modules/.bin/prettier.CMD 逐行同构):
 *  NODE_PATH 三段 = <pkgStore>/node_modules/<pkg>/node_modules; <pkgStore>/node_modules/<pkg>; .pnpm/node_modules */
function cmdShim(binRelFromPkg, pkgName, storePkgDir) {
  const s = storePkgDir.replace(/\//g, '\\')
  const np = [
    join(s, 'node_modules', pkgName, 'node_modules'),
    join(s, 'node_modules', pkgName),
    join(ROOT, 'node_modules', '.pnpm', 'node_modules'),
  ].join(';')
  return [
    '@SETLOCAL',
    '@IF NOT DEFINED NODE_PATH (',
    `  @SET "NODE_PATH=${np}"`,
    ') ELSE (',
    `  @SET "NODE_PATH=${np};%NODE_PATH%"`,
    ')',
    '@IF EXIST "%~dp0\\node.exe" (',
    `  "%~dp0\\node.exe"  "%~dp0\\..\\${pkgName.replace(/\//g, '\\')}\\${binRelFromPkg.replace(/\//g, '\\')}" %*`,
    ') ELSE (',
    '  @SET PATHEXT=%PATHEXT:;.JS;=;%',
    `  node  "%~dp0\\..\\${pkgName.replace(/\//g, '\\')}\\${binRelFromPkg.replace(/\//g, '\\')}" %*`,
    ')',
    '',
  ].join('\r\n')
}

/** POSIX sh 版式(供 Git Bash / CI 直接 `node_modules/.bin/eslint` 调用) */
function shShim(binRelFromPkg, pkgName) {
  return [
    '#!/bin/sh',
    'basedir=$(dirname "$(echo "$0" | sed -e \'s,\\\\,/,g\')")',
    `if [ -x "$basedir/node" ]; then`,
    `  "$basedir/node"  "$basedir/../${pkgName}/${binRelFromPkg}" "$@"`,
    '  ret=$?',
    'else',
    `  node  "$basedir/../${pkgName}/${binRelFromPkg}" "$@"`,
    '  ret=$?',
    'fi',
    'exit $ret',
    '',
  ].join('\n')
}

const rootPkg = readJson(join(ROOT, 'package.json'))
if (!rootPkg) {
  console.error('❌ 读不到根 package.json')
  process.exit(2)
}
const deps = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}) }
const missing = []
const repaired = []
const noBody = []
const okCount = { pkgs: 0, bins: 0 }

for (const pkgName of Object.keys(deps)) {
  const link = join(ROOT, 'node_modules', pkgName)
  if (!existsSync(link)) {
    noBody.push(`${pkgName}(包本体不存在)`)
    continue
  }
  const pj = readJson(join(link, 'package.json'))
  if (!pj?.bin) {
    okCount.pkgs++
    continue
  }
  const bins = typeof pj.bin === 'string' ? { [pkgName.split('/').pop()]: pj.bin } : pj.bin
  let storePkgDir
  try {
    storePkgDir = realpathSync(link).replace(/\\/g, '/')
  } catch {
    storePkgDir = link.replace(/\\/g, '/')
  }
  okCount.pkgs++
  for (const [binName, rel] of Object.entries(bins)) {
    if (!rel) continue
    okCount.bins++
    const cmdPath = join(ROOT, 'node_modules', '.bin', `${binName}.CMD`)
    const shPath = join(ROOT, 'node_modules', '.bin', binName)
    const hasCmd = existsSync(cmdPath)
    const hasSh = existsSync(shPath)
    // 两种版式都在才算完整(Windows 走 .CMD,Git Bash/CI 走无扩展 sh)
    if (hasCmd && hasSh) continue
    missing.push(
      `${binName} ← ${pkgName}(${hasCmd ? '' : '.CMD 缺'}${hasCmd && !hasSh ? ' / ' : ''}${hasSh ? '' : 'sh 缺'})`,
    )
    if (CHECK) continue
    if (!hasCmd) writeFileSync(cmdPath, cmdShim(rel, pkgName, storePkgDir), 'utf8')
    if (!hasSh) writeFileSync(shPath, shShim(rel, pkgName), 'utf8')
    repaired.push(binName)
  }
}

if (JSONOUT) {
  console.log(
    JSON.stringify(
      {
        check: CHECK,
        missing,
        repaired,
        noBody,
        rootDeps: Object.keys(deps).length,
        checkedBins: okCount.bins,
      },
      null,
      2,
    ),
  )
} else {
  console.log(
    `根依赖 ${Object.keys(deps).length} 个包 / bin 声明 ${okCount.bins} 个：${CHECK ? '--check' : '修复'} 模式`,
  )
  if (missing.length)
    console.log(
      `  ${CHECK ? '缺失' : '已补写'} ${missing.length} 个 shim:\n   · ${missing.join('\n   · ')}`,
    )
  else console.log('  .bin 完整,无缺失')
  if (noBody.length) console.log(`  包本体缺失(本脚本不伪造,需真装): ${noBody.join(', ')}`)
}

// 修复后再核一遍:仍然缺就 exit 1(绝不"写了就当好了")
if (!CHECK && repaired.length) {
  const still = []
  for (const b of repaired)
    if (!existsSync(join(ROOT, 'node_modules', '.bin', `${b}.CMD`))) still.push(b)
  if (still.length) {
    console.error(`❌ 补写后仍缺: ${still.join(', ')}`)
    process.exit(1)
  }
  console.log(`✅ 已补写 ${repaired.length} 个 shim: ${repaired.join(', ')}`)
}
process.exit(CHECK && missing.length ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
