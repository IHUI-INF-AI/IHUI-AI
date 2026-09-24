// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// C 盘污染实地扫描(守门 85)。与 check-c-drive-paths(只看源码字面量)互补:
// 那道门看不见 os.tmpdir() 派生的写入,而实测残正是从那条路来的。

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

/**
 * 本项目产物的识别特征。只按名字判,内容不看 —— 宁可漏报也不误删他人文件;
 * 名字不认识的一律进 foreign 清单交人判断,脚本本身永不删文件。
 */
const OUR_ROOT_PATTERNS = [
  { re: /^IHUI-/i, why: '盘根 IHUI- 前缀(探查脚本 / 构建状态文件)' },
  { re: /^\.empty-tmp\d*$/, why: '盘根 .empty-tmp*(清理实验残骸)' },
  { re: /^\.pnpm-store$/, why: '盘根 pnpm store(在 C:\\ 当 cwd 跑 pnpm 所致)' },
]
const OUR_TMP_PATTERNS = [
  { re: /^ihui-/, why: '临时夹具(测试 / --self-test 残留)' },
  { re: /^next-backup-node\d+/, why: '.next 构建备份($BackupRoot 曾写死 C 盘)' },
  { re: /^probe-.*\.sh$/, why: '现场探查脚本' },
  { re: /^wb-ext-debug\.log$/, why: '扩展调试日志' },
]

/** 明确不属于本项目的盘根条目:只登记不报违规,免得把别人的东西当成我们的债。 */
const FOREIGN_ROOT = new Set([
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  'users',
  '$recycle.bin',
  'system volume information',
  'recovery',
  'boot',
  'perflogs',
  'inetpub',
  'temp',
  'tmp',
  'tools',
  'logs',
  'documents and settings',
])

function classifyRoot(name) {
  for (const p of OUR_ROOT_PATTERNS) if (p.re.test(name)) return p.why
  return null
}

/**
 * 盘根出现"单个字母命名的目录"= MSYS/Git-Bash 把 `/c/...` 当相对路径用的错位指纹。
 * 实测:2026-08-06 一次克隆就是这样在 C 盘里套出 `C:\c`(内含 4 份 origin 浅克隆 379MB
 * 与一份错位的 npm 全局前缀 136MB,共 515MB),`git status` 与其余守门全都不知道。
 * 只认目录:同名文件(如某些工具的 `c` 脚本)不判,宁漏不误报。
 */
function classifyRootEntry(name, isDir) {
  const byName = classifyRoot(name)
  if (byName) return byName
  if (isDir && /^[a-z]$/i.test(name)) return '盘根单字母目录(MSYS 把 /c/... 当相对路径的错位指纹)'
  return null
}

function classifyTmp(name) {
  for (const p of OUR_TMP_PATTERNS) if (p.re.test(name)) return p.why
  return null
}

function dirSizeMB(path) {
  let bytes = 0
  let visited = 0
  let capped = false
  const stack = [path]
  // 守门跑在 pre-commit 链上,体积只作量级参考:访问条目设上限,超限如实标 capped,
  // 绝不假装是精确值(曾按"弹栈次数 400"截断,把一个 5.1G 的 .next 备份报成 164MB)。
  while (stack.length) {
    if (visited++ > 60000) {
      capped = true
      break
    }
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(cur, e.name)
      if (e.isDirectory()) stack.push(full)
      else {
        try {
          bytes += statSync(full).size
        } catch {
          /* 句柄占用/权限不足时按 0 计,不影响"是否存在"的结论 */
        }
      }
    }
  }
  return { sizeMB: Math.round((bytes / 1024 / 1024) * 10) / 10, capped }
}

function scanTargets(target, classify) {
  const hits = []
  if (!existsSync(target)) return hits
  let names
  try {
    names = readdirSync(target)
  } catch {
    return hits
  }
  for (const name of names) {
    const why = classify(name, target)
    if (!why) continue
    const full = join(target, name)
    let kind = 'file'
    try {
      kind = statSync(full).isDirectory() ? 'dir' : 'file'
    } catch {
      /* 竞态删除:仍按命中报告,体积记 0 */
    }
    hits.push({
      path: full,
      kind,
      why,
      ...((kind === 'dir' ? dirSizeMB(full) : { sizeMB: 0, capped: false })),
    })
  }
  return hits
}

/** 盘根只挑"我们的"条目;白名单外的未知条目单列,交人判身份后再定性。 */
function scanDriveRoot(drive) {
  const root = `${drive}\\`
  const hits = []
  const unknown = []
  if (!existsSync(root)) return { hits, unknown }
  let names
  try {
    names = readdirSync(root)
  } catch {
    return { hits, unknown }
  }
  for (const name of names) {
    if (name.endsWith('.sys') || name.toLowerCase() === 'bootmgr' || name === 'BOOTNXT') continue
    let isDir = false
    try {
      isDir = statSync(join(root, name)).isDirectory()
    } catch {
      /* 竞态/权限:按文件处理,单字母规则自然不命中 */
    }
    const why = classifyRootEntry(name, isDir)
    if (why) {
      const full = join(root, name)
      hits.push({
        path: full,
        kind: isDir ? 'dir' : 'file',
        why,
        ...(isDir ? dirSizeMB(full) : { sizeMB: 0, capped: false }),
      })
      continue
    }
    if (!FOREIGN_ROOT.has(name.toLowerCase())) unknown.push(join(root, name))
  }
  return { hits, unknown }
}

/**
 * TEMP 漂移检测:HKCU 声明的 TEMP 与活进程实际拿到的 TEMP 不一致,就是"改了指针
 * 但老进程不认"的那道根因(C 盘残骸天天新增的机制)。读注册表失败时如实报 unknown。
 */
function readHkcuTemp() {
  try {
    const out = execFileSync('reg.exe', ['query', 'HKCU\\Environment', '/v', 'TEMP'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const m = out.match(/TEMP\s+REG_SZ\s+(.+)/)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

function detectTempDrift() {
  const proc = resolve(tmpdir())
  const declared = readHkcuTemp()
  if (!declared) return { status: 'unknown', proc, declared: null }
  if (resolve(declared) === proc) return { status: 'ok', proc, declared }
  return { status: 'drift', proc, declared }
}

export function scanC(options = {}) {
  const drive = options.drive || 'C:'
  const root = scanDriveRoot(drive)
  // 夹具落点一律要扫(落在哪盘都要报);"是不是又掉回 C 盘"由 temp 漂移单独结论回答
  const dirs = ['C:\\tmp', 'C:\\temp', tmpdir()]
  const items = []
  for (const d of new Set(dirs)) items.push(...scanTargets(d, (n) => classifyTmp(n)))
  const ours = [...root.hits, ...items]
  const bytesMB = ours.reduce((s, i) => s + (i.sizeMB || 0), 0)
  return {
    ours,
    unknownRoot: root.unknown,
    temp: detectTempDrift(),
    totalMB: Math.round(bytesMB * 10) / 10,
  }
}

function main(argv) {
  const json = argv.includes('--json')
  const strict = argv.includes('--strict')
  if (argv.includes('--self-test')) return selfTest()
  const r = scanC()
  if (json) {
    console.log(JSON.stringify(r, null, 2))
  } else {
    console.log(`C 盘污染实地扫描:本项目产物 ${r.ours.length} 项,合计约 ${r.totalMB} MB`)
    for (const i of r.ours)
      console.log(
        `  ⚠️  ${i.path}  [${i.why}]${i.sizeMB ? ` ${i.capped ? '≈' : ''}${i.sizeMB}MB` : ''}`,
      )
    if (r.unknownRoot.length) {
      console.log(`\n未识别的盘根条目 ${r.unknownRoot.length} 项(只登记,不定性、不清理):`)
      for (const u of r.unknownRoot.slice(0, 15)) console.log(`  · ${u}`)
      if (r.unknownRoot.length > 15) console.log(`  …另 ${r.unknownRoot.length - 15} 项`)
    }
    console.log(
      r.temp.status === 'ok'
        ? `\nTEMP 一致:进程 ${r.temp.proc}`
        : r.temp.status === 'drift'
          ? `\n❌ TEMP 漂移:注册表=${r.temp.declared},本进程仍=${r.temp.proc}\n   ⇒ 活进程环境块未刷新,夹具会继续落回旧盘。新建终端/重启宿主后自愈。`
          : `\nTEMP 注册表值读不到(离线/权限),仅比对进程 TEMP=${r.temp.proc}`,
    )
    console.log('\n本门只读,不删除任何文件。清理:pnpm c-drive:clean-ours(只删上面列出的本项目产物)')
  }
  if (strict && r.ours.length) return 1
  return 0
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg}: 期望 ${b},实际 ${a}`)
  }

  t('盘根 IHUI- 前缀识别为自有产物', () => eq(classifyRoot('IHUI-probe-tail.ps1') !== null, true, '命中'))
  t('盘根单字母**目录**判为 MSYS 错位指纹(C:\\c 曾藏 515MB 浅克隆)', () =>
    eq(classifyRootEntry('c', true) !== null, true, '未识别 C:\\c 这类错位目录'))
  t('单字母**文件**不判(宁漏不误报)', () => eq(classifyRootEntry('c', false), null, '误判单字母文件'))
  t('多字母目录不因新规则误判', () => eq(classifyRootEntry('Windows', true), null, 'Windows 误判'))
  t('盘根 .pnpm-store 识别', () => eq(classifyRoot('.pnpm-store') !== null, true, '命中'))
  t('系统条目不得判为我们的', () => eq(classifyRoot('Windows'), null, 'Windows 误判'))
  t('Temp 里 ihui- 夹具识别', () => eq(classifyTmp('ihui-origin-Ab12Cd') !== null, true, '命中'))
  t('Temp 里 .next 备份识别', () => eq(classifyTmp('next-backup-node22-20260918-094636') !== null, true, '命中'))
  t('Temp 里他人随机 .tmp 不得命中', () => eq(classifyTmp('8f575ef0-6180-4c22-b1d4-4161278b643b.tmp'), null, '误判'))
  t('scanC 不改文件:跑两次结果一致', () => {
    const a = scanC().ours.length
    const b = scanC().ours.length
    eq(a, b, '两次扫描数量漂移')
  })
  t('夹具落点必须在仓库外(守门自身不得再往 C 塞东西)', () => {
    const d = mkScratch('guard-selftest-')
    try {
      if (d.startsWith(REPO)) throw new Error(`落点回到了仓库内:${d}`)
      if (/^[cC]:[\\/]/.test(d)) throw new Error(`落点仍在 C 盘:${d}`)
    } finally {
      rmScratch(d)
    }
  })

  let failed = 0
  for (const c of cases) {
    try {
      c.fn()
      console.log(`  ✔ ${c.name}`)
    } catch (e) {
      failed++
      console.log(`  ✖ ${c.name}\n    ${e.message}`)
    }
  }
  console.log(`\ncheck-c-drive-pollution 自检:${cases.length - failed}/${cases.length} 通过`)
  return failed ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  classifyRoot,
  classifyRootEntry,
  classifyTmp,
  scanC,
  detectTempDrift,
  FOREIGN_ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
