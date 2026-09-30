#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌‌​​‌‌​​‌‌‌‌​‌​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 盘根卫生守门(warn,巡检档)— 判"项目产物是否外流到盘根"与"worktree 是否落在合法落点"。
 *
 * 立因(2026-09-30 G 盘清理收口):用户明确"除了项目主文件夹外不允许有任何东西出去"。
 * 本轮实测:盘根残留 13 个 IHUI-AI-wt-* 陈旧检出(452MB)、.pytest_tmp_* 168MB、tmp-check 等,
 * 而仓内既有 check-root-dir-clean 只判**仓库根一级**,盘根(G:\)与 worktree 登记面无人看守
 * ⇒ 清完必回潮。本尺子补这两格。
 *
 * 为什么 warn(不进提交链):判的是**机器/磁盘状态**,提交者结构上满足不了 —— 挂 blocking
 * 就是每台每次被逼 --no-verify,连带废掉全部守门(§12e;check-host-timezone /
 * check-service-binary-paths 同一定级逻辑)。出口 = git-guardian 每 30 分钟巡检 + 到人;
 * 手动问责:`node scripts/check-disk-root-hygiene.mjs --strict`。
 *
 * 两维判据:
 *   H1 盘根白名单对账 —— 扫 G:\ 一级(非递归),条目必须落在 config/disk-root-allowlist.json
 *      的声明集合内;未列入逐条点名。声明式封闭集合:新增合法条目必须显式改配置并随 commit
 *      提交(= 显式审批),同 check-root-dir-clean 的白名单哲学。
 *   H2 worktree 落点对账 —— `git worktree list --porcelain` 现读登记面,主工作树豁免,
 *      落在 sanctionedPrefixes 之外的登记 worktree 逐条点名待回收(prunable 的顺带点名)。
 *      2026-09-30 起 worktree 落点 = G:\IHUI-AI\.worktrees\(AGENTS §12d)。
 *
 * 用法:
 *   node scripts/check-disk-root-hygiene.mjs              # 报告档(违规仍 exit 0)
 *   node scripts/check-disk-root-hygiene.mjs --strict     # 问责档(违规 exit 1)
 *   node scripts/check-disk-root-hygiene.mjs --self-test  # 自检
 * 测试通道:--root <dir>(替身盘根)、--wt-file <file>(替身 porcelain 输出)、--config <file>。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

function parseArgv(argv) {
  const out = { _: [] }
  const BOOLS = new Set(['self-test', 'strict', 'json'])
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      if (BOOLS.has(key)) {
        out[key] = true
      } else {
        out[key] = argv[i + 1]
        i++
      }
    } else out._.push(argv[i])
  }
  return out
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** 规范化路径便于前缀比较:统一 / 分隔、去尾分隔符。 */
function normPath(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '')
}

/** H1:盘根一级条目对账。返回违规数组。 */
export function auditDiskRoot(rootDir, allowlist) {
  const violations = []
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    return [{ kind: 'undetermined', entry: rootDir, why: '盘根不可读(不存在或不是目录)' }]
  }
  const allow = new Set(allowlist)
  for (const entry of readdirSync(rootDir)) {
    if (!allow.has(entry)) violations.push({ kind: 'stray-root-entry', entry, path: join(rootDir, entry) })
  }
  return violations
}

/** H2:worktree 登记面对账。porcelain 文本现读,主工作树与合法前缀豁免。返回违规数组。 */
export function auditWorktreeRegistry(porcelainText, policy) {
  const violations = []
  const prefixes = (policy?.sanctionedPrefixes ?? []).map(normPath)
  const exempt = new Set((policy?.exemptPaths ?? []).map(normPath))
  const blocks = porcelainText.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  for (const block of blocks) {
    const m = block.match(/^worktree\s+(.+)$/m)
    if (!m) continue
    const wt = normPath(m[1])
    if (exempt.has(wt)) continue
    if (prefixes.some((p) => wt === p || wt.startsWith(p + '/'))) continue
    const prunable = /prunable/i.test(block)
    violations.push({ kind: 'worktree-outside-sanctioned-root', path: m[1], prunable })
  }
  return violations
}

/** 取当前仓的 worktree porcelain 面;取不到 ⇒ null(判"无法判定",不冒红也不记绿)。
 *  stdio 三态是本仓实测铁律(2026-09-30):git 子进程不吃 stdin ⇒ stdin 必须 'ignore',
 *  否则交互会话下 spawnSync 报 EBUSY(check-root-dir-clean 同型调用已带同参)。 */
function currentWorktreePorcelain() {
  try {
    return execFileSync('git', ['worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return null
  }
}

export function selfTest() {
  const cases = []
  const t = (name, fn) => {
    try {
      fn()
      cases.push(`  ✅ ${name}`)
    } catch (e) {
      cases.push(`  ❌ ${name}\n      ${e.message}`)
      process.exitCode = 1
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }

  t('H1 白名单内条目不点名', () => {
    const v = auditDiskRoot('/probe-root-fake', ['a', 'b'])
    // /probe-root-fake 不存在 ⇒ 必须判"无法判定",不是空通过
    assert(v.length === 1 && v[0].kind === 'undetermined', '不可读盘根必须判 undetermined')
  })

  t('H1 未列入条目逐条点名', () => {
    const v = auditDiskRoot(join(REPO_ROOT, 'scripts', 'tests', 'fixtures'), ['check-root-dir-clean'])
    // fixtures 目录里凡不在白名单的一级条目都该被点名(该目录非空 ⇒ 至少 1 条)
    assert(v.every((x) => x.kind === 'stray-root-entry'), '只应产出 stray-root-entry')
  })

  t('H1 空盘根 ⇒ 0 违规(空不是 undetermined)', () => {
    // 构造:用 repo 内一个可控空目录不可行,改用语义反向 —— 白名单含全部条目时 0 违规
    const dir = join(REPO_ROOT, 'config')
    const entries = readdirSync(dir)
    const v = auditDiskRoot(dir, entries)
    assert(v.length === 0, `白名单全覆盖时违规应为 0,实得 ${v.length}`)
  })

  t('H2 主工作树豁免', () => {
    const txt = 'worktree G:/IHUI-AI\nHEAD abc\nbranch refs/heads/main\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    assert(v.length === 0, `主工作树应豁免,实得 ${JSON.stringify(v)}`)
  })

  t('H2 合法落点(.worktrees)内豁免', () => {
    const txt = 'worktree G:\\IHUI-AI\\.worktrees\\wt-demo\nHEAD abc\ndetached\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    assert(v.length === 0, `合法落点应豁免,实得 ${JSON.stringify(v)}`)
  })

  t('H2 落点外登记逐条点名(prunable 单列)', () => {
    const txt = 'worktree G:/IHUI-AI-wt-b674\nHEAD abc\ndetached prunable\n\nworktree G:/tmp-probe/wt-x\nHEAD def\ndetached\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    assert(v.length === 2, `应点名 2 处,实得 ${v.length}`)
    assert(v.some((x) => x.prunable) && v.some((x) => !x.prunable), 'prunable 标记必须逐条区分')
  })

  t('H2 大小写与分隔符不构成隐身(Windows 路径同义形态)', () => {
    const txt = 'worktree g:/ihui-ai-wt-x\nHEAD abc\ndetached\n\n'
    const v = auditWorktreeRegistry(txt, { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: ['G:\\IHUI-AI\\.worktrees\\'] })
    // g:/ihui-ai-wt-x 与豁免前缀 G:/IHUI-AI 不同路径(前者是盘根残壳),必须点名
    assert(v.length === 1, `同义形态不得误豁免,实得 ${JSON.stringify(v)}`)
  })

  t('H2 空登记面 ⇒ 0 违规', () => {
    const v = auditWorktreeRegistry('', { exemptPaths: ['G:\\IHUI-AI'], sanctionedPrefixes: [] })
    assert(v.length === 0, '空面不是违规')
  })

  console.log(cases.join('\n'))
  console.log(`\n自检:pass ${cases.filter((c) => c.includes('✅')).length} / fail ${cases.filter((c) => c.includes('❌')).length}`)
}

async function main() {
  const argv = parseArgv(process.argv.slice(2))
  if (argv['self-test']) {
    selfTest()
    return
  }

  const json = !!argv.json
  const configPath = argv.config ? resolve(argv.config) : join(REPO_ROOT, 'config', 'disk-root-allowlist.json')
  const confAll = readJson(configPath)
  const roots = argv.root ? [resolve(argv.root)] : Object.keys(confAll?.roots ?? {})
  if (!roots.length) {
    console.error('❌ 取不到盘根声明(config/disk-root-allowlist.json 缺 roots)⇒ 无法判定')
    process.exitCode = 2
    return
  }

  const all = []
  for (const root of roots) {
    const conf = argv.root ? { allow: readdirSync(root), note: '测试通道:替身盘根全量放行' } : confAll.roots[root]
    if (!conf) {
      console.error(`❌ config 缺 ${root} 的声明 ⇒ 无法判定`)
      process.exitCode = 2
      return
    }
    for (const v of auditDiskRoot(root, conf.allow)) all.push({ root, ...v })
  }

  const policy = confAll.worktreePolicy
  const porcelain = argv['wt-file'] ? readFileSync(argv['wt-file'], 'utf8') : currentWorktreePorcelain()
  // 输出顺序铁律:盘根维度先出结果,porcelain 取不到只降级它自己那一维 ——
  // 不许让一维"无法判定"把另一维已量到的违规整个吞掉(那等于把"没看清"写成"没问题")。
  let wtUndetermined = porcelain == null
  const wtViolations = wtUndetermined ? [] : auditWorktreeRegistry(porcelain, policy)
  const verdict = wtUndetermined ? 'undetermined' : all.length || wtViolations.length ? 'red' : 'green'

  if (json) {
    // 机器可读档(git-guardian 巡检消费):纯 JSON,不混人读行(混入 = parse 必败)。
    console.log(
      JSON.stringify({
        verdict,
        counts: { diskRootStray: all.length, worktreeOutside: wtViolations.length, worktreeUndetermined: wtUndetermined },
        violations: [...all, ...wtViolations],
      }),
    )
    if (argv.strict && verdict !== 'green') process.exitCode = 1
    return
  }

  console.log('── 盘根卫生(warn 尺子,巡检档)──')
  for (const v of all) {
    console.log(`  🚨 盘根外流: ${v.root}${sep}${v.entry}${v.why ? ` (${v.why})` : ''}`)
  }
  for (const v of wtViolations) {
    console.log(`  🚨 worktree 落点外: ${v.path}${v.prunable ? ' (prunable,登记项可 prune)' : ''} ⇒ 按 §12d 回收`)
  }
  if (wtUndetermined) {
    console.log('  ⚠️ git worktree list 取不到 ⇒ worktree 维度判"无法判定"(不冒红也不记绿)')
  }
  if (!all.length && !wtViolations.length && !wtUndetermined) {
    console.log('  ✅ 盘根白名单对账 0 违规;worktree 登记面全部落在合法落点')
  }
  console.log(`\n读数:盘根外流 ${all.length} / worktree 落点外 ${wtViolations.length}${wtUndetermined ? ' / worktree 维度未判定' : ''}`)
  if (argv.strict && (all.length || wtViolations.length || wtUndetermined)) {
    console.error('\n--strict:存在违规或未判定 ⇒ exit 1(问责档;未判定不出合格证)')
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('❌ 尺子自身异常:', e && e.message)
    process.exit(2)
  })
}
