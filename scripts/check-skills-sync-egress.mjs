// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:skills 同步网络出海口(BUG-NEW-02)。
//
// 背景:`apps/ai-service/app/skills/**` 是**纯同步** Python 面(无 async def / await / to_thread)。
// 在这层直接 `requests.<method>(...)` / `urllib.request.urlopen(...)` 等于把阻塞 I/O 摆到调用者
// 的执行路径上;当前调用链不在事件循环内、且每处都带显式 timeout,所以是 P2 存量债,不是 P1 事故。
//
// 本门先把**出海口**钉住:
//   · 存量 11 处登记进基线,逐点注明「不在事件循环内、有显式 timeout」的理由;
//   · **新增裸调用一律红**(新增出海口 = 新增阻塞面 + 新增超时遗漏风险);
//   · 存量被清掉 ⇒ 绿,并按「棘轮下调」提示(清债是收益,不反过来钉红)。
//   统一出口 `skills/_net.py` 待 BUG-0015 的 A1 批次落地后再动:那是对 6 个技能脚本的重构,
//   与 typecheck 批次混在一起不好归因。
//
// 判定方式:
//   按 (文件, 调用种类) 统计**行级命中数**。命中数 > 基线条数 ⇒ 红,并点名多出来的那几行;
//   命中数 < 基线 ⇒ 绿 + 下调提示。基线按「文件 + 种类 + 序号」对齐,**不钉死行号**,
//   所以删掉 `urllib3.disable_warnings()` 这类无关行导致的行号平移不会误红。
//
// 用法:
//   node scripts/check-skills-sync-egress.mjs                  # 判工作树(默认面)
//   node scripts/check-skills-sync-egress.mjs --root <dir>     # 判指定根(镜像测试用)
//   node scripts/check-skills-sync-egress.mjs --list           # 打印基线
// 退出码:0 绿 / 1 有新增裸调用 / 2 无法判定。

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.resolve(HERE, '..')
const SKILLS_REL = ['apps', 'ai-service', 'app', 'skills']
const SKIP_DIRS = new Set(['__pycache__', '.git', 'node_modules'])

const REQUESTS_CALL_RE = /\brequests\.(get|post|put|patch|delete|head|options|request)\s*\(/
const URLOPEN_CALL_RE = /\burlopen\s*\(/
const TIMEOUT_RE = /\btimeout\s*=\s*([^,)]+)/

/** 存量基线:11 处逐点登记。`line` 仅供人工核对,判定不依赖行号。 */
const BASELINE = [
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/imgchr_uploader.py',
    line: 35,
    kind: 'requests.post',
    timeout: 'timeout=30',
    reason: 'upload_image() 同步体;不在事件循环内;显式 timeout=30',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/csdn_publish.py',
    line: 199,
    kind: 'urlopen',
    timeout: 'timeout=30',
    reason: '同步发布函数;不在事件循环内;显式 timeout=30',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/csdn_publish.py',
    line: 217,
    kind: 'urlopen',
    timeout: 'timeout=30',
    reason: '同步请求函数;不在事件循环内;显式 timeout=30',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/csdn_publish.py',
    line: 247,
    kind: 'urlopen',
    timeout: 'timeout=30',
    reason: '同步请求函数;不在事件循环内;显式 timeout=30',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/csdn_publish.py',
    line: 304,
    kind: 'urlopen',
    timeout: 'timeout=60',
    reason: '同步请求函数;不在事件循环内;显式 timeout=60',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/wechat_publish.py',
    line: 53,
    kind: 'urlopen',
    timeout: 'timeout=30',
    reason: '同步 GET;不在事件循环内;显式 timeout=30',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/wechat_publish.py',
    line: 64,
    kind: 'urlopen',
    timeout: 'timeout=30',
    reason: '同步 POST;不在事件循环内;显式 timeout=30',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/lib/wechat_publish.py',
    line: 90,
    kind: 'urlopen',
    timeout: 'timeout=60',
    reason: '同步上传;不在事件循环内;显式 timeout=60',
  },
  {
    file: 'apps/ai-service/app/skills/content_engine/full_audit.py',
    line: 580,
    kind: 'urlopen',
    timeout: 'timeout=30',
    reason: '同步审计循环;不在事件循环内;显式 timeout=30',
  },
  {
    file: 'apps/ai-service/app/skills/koubo_workflow/tools/hot_topic_coverage_gate.py',
    line: 115,
    kind: 'urlopen',
    timeout: 'timeout=20',
    reason: '同步覆盖门;不在事件循环内;显式 timeout=20',
  },
  {
    file: 'apps/ai-service/app/skills/koubo_workflow/tools/topic_pool.py',
    line: 50,
    kind: 'urlopen',
    timeout: 'timeout=timeout',
    reason: '同步 _get();不在事件循环内;显式 timeout=timeout(默认 20)',
  },
]

function toKey(entry) {
  return `${entry.file}::${entry.kind}`
}

/** 递归列出 `.py` 文件(跳过缓存/依赖目录)。 */
function walkPyFiles(dir, out = []) {
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      if (SKIP_DIRS.has(dirent.name)) continue
      walkPyFiles(path.join(dir, dirent.name), out)
    } else if (dirent.isFile() && dirent.name.endsWith('.py')) {
      out.push(path.join(dir, dirent.name))
    }
  }
  return out
}

/**
 * 采集出海口。返回 `{ ok: true, sites }` 或 `{ ok: false, reason }`。
 * 忽略整行注释(`#` 开头),避免把示例写进注释就误红。
 */
function collectSites(root, baseline = BASELINE) {
  const skillsDir = path.join(root, ...SKILLS_REL)
  if (!existsSync(skillsDir)) {
    return { ok: false, reason: `找不到待判目录: ${skillsDir}` }
  }

  const sites = []
  for (const absFile of walkPyFiles(skillsDir)) {
    const relFile = path.relative(root, absFile).split(path.sep).join('/')
    const lines = readFileSync(absFile, 'utf8').split(/\r?\n/)
    lines.forEach((text, index) => {
      const stripped = text.trimStart()
      if (stripped.startsWith('#')) return

      const requestsMatch = REQUESTS_CALL_RE.exec(text)
      if (requestsMatch) {
        sites.push({
          file: relFile,
          line: index + 1,
          kind: `requests.${requestsMatch[1]}`,
          timeout: (TIMEOUT_RE.exec(text)?.[1] ?? '').trim(),
        })
      }
      if (URLOPEN_CALL_RE.test(text)) {
        sites.push({
          file: relFile,
          line: index + 1,
          kind: 'urlopen',
          timeout: (TIMEOUT_RE.exec(text)?.[1] ?? '').trim(),
        })
      }
    })
  }

  // 只统计基线里出现过的文件/种类之外的新增面;但基线本身也要能对上文件(缺文件=无法判定)。
  const baselineFiles = new Set(baseline.map((entry) => entry.file))
  const presentFiles = new Set(sites.map((site) => site.file))
  const missingBaselineFiles = [...baselineFiles].filter((file) => !presentFiles.has(file))

  return { ok: true, sites, missingBaselineFiles }
}

function groupByKey(items) {
  const groups = new Map()
  for (const item of items) {
    const key = toKey(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}

/** 对比实际命中与基线;返回 violations(新增)与 decreases(存量下调)。 */
function compareSites(sites, baseline = BASELINE) {
  const actual = groupByKey(sites)
  const allowed = groupByKey(baseline)
  const violations = []
  const decreases = []

  for (const [key, items] of actual) {
    const base = allowed.get(key) ?? []
    if (items.length > base.length) {
      violations.push({ key, extra: items.slice(base.length) })
    } else if (items.length < base.length) {
      decreases.push({ key, removed: base.length - items.length })
    }
  }
  for (const [key, base] of allowed) {
    if (!actual.has(key)) decreases.push({ key, removed: base.length })
  }

  return { violations, decreases }
}

function describeSite(site) {
  const timeout = site.timeout ? ` (timeout=${site.timeout})` : ' (无显式 timeout)'
  return `${site.file}:${site.line} ${site.kind}${timeout}`
}

function printBaseline() {
  console.log(`skills 同步出海口基线:${BASELINE.length} 处`)
  for (const entry of BASELINE) {
    console.log(`  ${entry.file}:${entry.line} ${entry.kind} — ${entry.reason}`)
  }
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, list: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--list') {
      options.list = true
    } else if (arg === '--root') {
      const value = argv[i + 1]
      if (!value) return { error: '--root 缺少目录参数' }
      options.root = path.resolve(value)
      i += 1
    } else {
      return { error: `未知参数: ${arg}` }
    }
  }
  return options
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.error) {
    console.error(`[skills-sync-egress] ❌ 无法判定:${options.error}`)
    return 2
  }
  if (options.list) {
    printBaseline()
    return 0
  }

  const collected = collectSites(options.root, BASELINE)
  if (!collected.ok) {
    console.error(`[skills-sync-egress] ❌ 无法判定:${collected.reason}`)
    return 2
  }

  const { violations, decreases } = compareSites(collected.sites, BASELINE)

  if (collected.missingBaselineFiles.length > 0) {
    console.error('[skills-sync-egress] ❌ 无法判定:基线登记的文件已不存在,基线需同步更新:')
    for (const file of collected.missingBaselineFiles) console.error(`  - ${file}`)
    return 2
  }

  if (violations.length > 0) {
    const extraCount = violations.reduce((sum, item) => sum + item.extra.length, 0)
    console.error(
      `[skills-sync-egress] ❌ 发现 ${extraCount} 处新增裸同步网络调用(基线外,当前 ${collected.sites.length} 处):`,
    )
    for (const violation of violations) {
      for (const site of violation.extra) console.error(`  ❌ 新增 ${describeSite(site)}`)
    }
    console.error('  修法二选一:')
    console.error('    ① 改用统一出口 skills/_net.py(BUG-0015 A1 落地后再做,别与 typecheck 批次混账);')
    console.error('    ② 确实必须在技能层直连 ⇒ 登记进 BASELINE,并写明「不在事件循环内、有显式 timeout」。')
    return 1
  }

  const extraNote =
    decreases.length > 0
      ? `;存量下调 ${decreases.reduce((sum, item) => sum + item.removed, 0)} 处(棘轮:清债是收益)`
      : ''
  console.log(
    `[skills-sync-egress] ✅ ${collected.sites.length}/${BASELINE.length} 处基线内,0 处新增${extraNote}`,
  )
  for (const decrease of decreases) {
    console.log(`  ↓ ${decrease.key} 减少 ${decrease.removed} 处(基线可随之收紧)`)
  }
  return 0
}

export const __test__ = { BASELINE, collectSites, compareSites, toKey }

if (path.resolve(process.argv[1] ?? '') === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
