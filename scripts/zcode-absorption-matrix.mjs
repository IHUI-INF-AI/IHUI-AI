// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ZCode 吸收覆盖矩阵对账(2026-09-28 立,第九轮"取证到极致"的尺子)。
 *
 * 为什么需要它:历轮"这条线榨干了吗"全靠台账里的散文数字,而本仓最高频的失效型就是
 * "把没判写成判过了"。本器把两件事变成机器可问的:
 *   ① 上游**每一个**源文件都必须落进**恰好一个**已登记切片(最长前缀匹配);落不进去的
 *      就是"还没看过" —— 逐目录报名,不给"还剩很多"这种含糊话。
 *   ② 凡是声称"读到体/判不抄"的切片,**必须带可兑现的出处指针**(path:line),指针要能在
 *      被审面上问到该文件、行号要 ≤ 实际行数。没有出处的"已读过"等于合格证。
 *
 * 判据(M 系,全在导出纯函数 `decide()` 里,便于构造面证明):
 *   M1 覆盖闭合:有源文件不落任何切片 ⇒ 未分类;`--strict` 判红并逐目录报名。
 *   M2 合格证:`status` 为 deep/rejected 而 `evidence`(rejected 另需 `why`)为空 ⇒ 红。
 *   M3 指针可兑现:`evidence` 写作 `path:line(-line)`;path 不在被审面 ⇒ 红;
 *      行号超出该文件实际行数 ⇒ 红(指针腐烂与写错路径是同一型,见 check-plan-sha-resolvable)。
 *   M4 状态自洽:`unread` 切片却挂着 evidence ⇒ 红(没读却有发现 = 记账方向反了)。
 *   M5 登记表自洽:同一 `path` 登记两次 ⇒ 红(台账副本腐烂,AGENTS §1 同条)。
 *   M6 票挂账:切片声明了 `tickets` 却状态是 deep 且无 evidence ⇒ 由 M2 拦,这里只报数。
 *
 * 三态硬要求:上游克隆不在位 / 不是 git 仓 / git 问不到清单 ⇒ **exit 2 未判定**并点名原因,
 * 绝不记绿也绝不冒红(克隆是 gitignore 的本机文件,在非部署机上判红就是一台恒红门 —— 与
 * 守门 prod-bundle 影子对账"S2 缺运行副本只报数"同一取向)。
 *
 * **本器刻意不接提交链**(不在 guardian-runner,不在 check:all):它判的是"我们读过上游
 * 哪些文件",与本次提交改了什么无关;接进提交链就是每台每次被逼跳门(AGENTS §12e)。
 * 问责入口:`pnpm check:zcode-matrix`(= `--strict`)。
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitBinary, gitRaw, assertRepoRoot } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|swift|java|kt|go)$/i
const DEFAULT_CLONE = '.ihui-agent/tmp/zcode-study/zcode'
const DEFAULT_REGISTRY = 'config/zcode-absorption.json'

const STATUS = ['deep', 'windowed', 'unread', 'rejected', 'na']
const EVIDENCE_RE = /^(.+?):(\d+)(?:-(\d+))?$/

/** 把登记表与文件清单汇成判定;纯函数,不碰磁盘也不碰 git。 */
export function decide({ files, lineCounts, registry }) {
  const errors = []
  const warnings = []
  const slices = Array.isArray(registry?.slices) ? registry.slices : []

  if (!Array.isArray(registry?.slices)) {
    errors.push('M0 登记表没有 slices 数组(读到了文件却解析不出切片 ⇒ 判"未判定"而不是"通过")')
    return { ok: false, undetermined: true, errors, warnings, rows: [], unclassified: {} }
  }

  // M5 同一切片重复登记
  const seenPath = new Map()
  for (const s of slices) {
    const key = String(s?.path ?? '')
    if (!key) {
      errors.push('M5 有一条切片没有 path(整条登记无从匹配)')
      continue
    }
    seenPath.set(key, (seenPath.get(key) || 0) + 1)
    if (!STATUS.includes(String(s?.status ?? ''))) {
      errors.push(`M5 切片 ${key} 的 status="${s?.status}" 不在合法集 [${STATUS.join('|')}]`)
    }
  }
  for (const [p, n] of seenPath) if (n > 1) errors.push(`M5 切片 ${p} 登记了 ${n} 次(台账副本腐烂)`)

  // 逐文件最长前缀归属
  const bySlice = new Map(slices.map((s) => [s.path, 0]))
  const unclassified = {}
  for (const f of files) {
    let best = null
    for (const s of slices) {
      const p = s.path
      if (f === p || f.startsWith(p.endsWith('/') ? p : `${p}/`)) {
        if (best === null || p.length > best.length) best = p
      }
    }
    if (best === null) {
      const top = f.split('/').slice(0, 3).join('/')
      unclassified[top] = (unclassified[top] || 0) + 1
    } else {
      bySlice.set(best, (bySlice.get(best) || 0) + 1)
    }
  }

  const rows = []
  for (const s of slices) {
    const counted = bySlice.get(s.path) || 0
    const evidence = Array.isArray(s.evidence) ? s.evidence : []
    const why = String(s.why ?? '').trim()
    const status = String(s.status ?? '')

    // M2 合格证
    if ((status === 'deep' || status === 'rejected') && evidence.length === 0) {
      errors.push(`M2 切片 ${s.path} 声称 ${status} 却没有任何出处指针(= 把"读过"写成结论)`)
    }
    if (status === 'rejected' && !why) {
      errors.push(`M2 切片 ${s.path} 判"不抄"却没写 why(豁免清单必然腐烂,理由要落在登记表)`)
    }
    // M4 状态自洽
    if (status === 'unread' && (evidence.length > 0 || (s.findings ?? []).length > 0)) {
      errors.push(`M4 切片 ${s.path} 标 unread 却挂着 ${evidence.length} 条出处(记账方向反了)`)
    }
    // M3 指针可兑现
    for (const e of evidence) {
      const m = EVIDENCE_RE.exec(String(e))
      if (!m) {
        errors.push(`M3 切片 ${s.path} 的出处 "${e}" 不是 path:line 形状(无从核验 = 等于没有)`)
        continue
      }
      const [, p, from, to] = m
      if (!(p in lineCounts)) {
        errors.push(`M3 出处指向的文件不在被审面上:${s.path} ← ${e}`)
        continue
      }
      const hi = Number(to ?? from)
      if (hi > lineCounts[p]) {
        errors.push(`M3 行号越界(文件只有 ${lineCounts[p]} 行):${e}`)
      }
    }
    // M8 读量自洽:`read` 是"整文件读到体"的文件数,不得超过该切片现量;
    // 不给 read 而标 deep/windowed ⇒ 警告(头条"真读到体多少"就无从汇总 —— 正是本器存在的理由)
    const readN = Number(s.read ?? 0)
    if (!Number.isFinite(readN) || readN < 0) {
      errors.push(`M8 切片 ${s.path} 的 read="${s.read}" 不是非负整数`)
    } else if (readN > counted) {
      errors.push(`M8 读量超过切片现量:${s.path} 声称读到体 ${readN} 个,面上只有 ${counted} 个`)
    } else if ((status === 'deep' || status === 'windowed') && readN === 0) {
      warnings.push(`M8 ${s.path} 标 ${status} 而整文件读到体 = 0 个(只做过窗口读;汇总头条会把它算进"未读完")`)
    }
    // M10/M11 状态与读量的语义闭合
    if (status === 'deep' && readN < counted) {
      errors.push(`M11 ${s.path} 标 deep(整片读完)却只有 ${readN}/${counted} 个文件读到体 = 状态与读量矛盾`)
    }
    if (status === 'windowed' && counted > 0 && readN === counted) {
      warnings.push(`M10 ${s.path} 已全部读到体(${readN}/${counted}),可把 status 升成 deep 以退出"未读完"口径`)
    }
    // 点名未读文件(供下一波直接派单,不靠散文描述"还剩一些")
    if (Array.isArray(s.remaining) && s.remaining.length) {
      warnings.push(`M9 ${s.path} 报名未读 ${s.remaining.length} 个:${s.remaining.slice(0, 6).join(', ')}${s.remaining.length > 6 ? ' …' : ''}`)
    }
    rows.push({
      path: s.path,
      status,
      files: counted,
      read: readN,
      // M12:`read` 是自报数;"可复核份数"必须逐条落在被审面上(路径存在 + 行数与现量相符)。
      // 两者差额就是 legacy 自报部分,头条必须把它分开报,不得混成一个数。
      verifiedRead: verifiedReadOf(s, lineCounts, errors).length,
      registeredFiles: Number(s.files ?? NaN),
      evidence: evidence.length,
      tickets: Array.isArray(s.tickets) ? s.tickets : [],
    })
    if (Number.isFinite(s.files) && s.files !== counted) {
      warnings.push(`登记数字已漂:${s.path} 写 ${s.files} / 现量 ${counted}(现量为准,请就地改表)`)
    }
    // M7 出处是谁量的:`deep`/`rejected` 是"我们已经看懂了"的声称,若没有主会话本人复验过
    // (registry 里 `verified:"self"`),就只能算代理的读数 ⇒ 报数不判红(它是台账里最常见的
    // "把代理结论当事实"那一型,但判红会让人为了变绿去乱填 verified,反而更糟)。
    if ((status === 'deep' || status === 'rejected') && s.verified !== 'self') {
      warnings.push(`M7 ${s.path} 标 ${status} 但出处未经主会话复验(verified 非 "self")= 代理读数,不得当已证事实派单`)
    }
  }

  // M1 覆盖闭合
  const unclassifiedCount = files.length - rows.reduce((a, r) => a + r.files, 0)
  const total = files.length
  const covered = total - unclassifiedCount
  // 按状态汇总文件数 ——  headline 必须是"真读到体的有多少",不是"归类了多少"
  const byStatus = {}
  let readTotal = 0
  let verifiedReadTotal = 0
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + r.files
    readTotal += r.read || 0
    verifiedReadTotal += r.verifiedRead || 0
  }
  if (unclassifiedCount > 0) byStatus.unregistered = unclassifiedCount
  if (unclassifiedCount > 0) {
    const head = Object.entries(unclassified)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, v]) => `${k}(${v})`)
      .join(', ')
    errors.push(`M1 有 ${unclassifiedCount} 个源文件不落任何切片 = 从未登记为"看过/判过/不适用":${head}`)
  }

  return {
    ok: errors.length === 0,
    undetermined: false,
    errors,
    warnings,
    rows,
    unclassified,
    totals: { total, covered, unclassified: unclassifiedCount, slices: slices.length },
    byStatus,
    readTotal,
    verifiedReadTotal,
  }
}

/**
 * M12 —— "读到体"这件事的可复核面。
 *
 * 为什么需要它(2026-09-29 立):`read` 一直是**自报数**,而本器对"声称读过"从来没有兑现判据 ——
 * 对出处有 M2/M3(路径存在、行号不越界),对读量只有 M8(不超过切片现量)。
 * 后果是本轮实测到的那种情形:代理报了 19 份、更正成 13 份、再下一轮报 5 份却给不出文件清单,
 * 而账面什么都看不出来 —— "把代理结论当事实"在本仓是最高频失效型,头条数字恰好也在这条上。
 *
 * 判据只认结构事实,不猜"有没有真读":清单里每条必须
 * ① 在被审面存在;② 若带 `lines`,必须与面上现量逐字相符;③ 同一路径不得计两次。
 * 三条都不满足的那份**不计入可复核数**,并把原因推进 errors(不静默)。
 * `read` 大于可复核数**不判红** —— 早期轮次确实没有留清单,那是历史状态不是本次故障;
 * 头条因此必须分开报两个数,把差额摆在明面上,而不是让它伪装成已证。
 */
function verifiedReadOf(s, lineCounts, errors) {
  const list = Array.isArray(s.readFiles) ? s.readFiles : []
  const seen = new Set()
  const bad = []
  for (const item of list) {
    const p = typeof item === 'string' ? item : item && typeof item.p === 'string' ? item.p : null
    if (!p) {
      bad.push('有条目没有路径')
      continue
    }
    if (!(p in lineCounts)) {
      bad.push(`面上找不到:${p}`)
      continue
    }
    const claimed = item && typeof item === 'object' ? Number(item.lines) : NaN
    if (Number.isFinite(claimed) && claimed !== lineCounts[p]) {
      bad.push(`行数不符:${p} 写 ${claimed} / 面上 ${lineCounts[p]}`)
      continue
    }
    if (seen.has(p)) {
      bad.push(`路径重复计入:${p}`)
      continue
    }
    seen.add(p)
  }
  for (const b of bad) errors.push(`M12 ${s.path} 清单不可兑现 ⇒ ${b}`)
  return [...seen]
}

function measure(root) {
  const out = gitRaw(['ls-files'], root, { timeout: 120_000 })
  if (out === null) return { err: 'git ls-files 问不到(克隆不可达 / 仓损坏 / 超时)' }
  const files = out.split('\n').filter((f) => f && SOURCE_EXT.test(f))
  if (files.length === 0) return { err: '被审面枚举到 0 个源文件(判死,不记通过)' }
  // 行数用一次 --batch 取内容再数,只取 evidence 用到的文件由调用方决定;这里全量成本过高,
  // 故按 ls-files --json? git 无该行数量出口 ⇒ 用 cat-file --batch 的 size + 估算不可靠,
  // 因此 M3 的行号核验改为"按需":`verifyLineRefs` 单独取被点名文件的内容行数。
  return { files }
}

/** 只对登记表点名的文件取行数(避免全库 cat-file 的耗时)。 */
function lineCountsFor(root, registry) {
  const specs = new Set()
  for (const s of registry?.slices ?? []) {
    for (const e of s?.evidence ?? []) {
      const m = EVIDENCE_RE.exec(String(e))
      if (m) specs.add(m[1])
    }
  }
  if (specs.size === 0) return {}
  const list = [...specs]
  const counts = {}
  const missing = []
  const sep = '\n'
  for (const p of list) {
    const content = gitRaw(['show', `HEAD:${p}`], root, { timeout: 60_000 })
    if (content === null) {
      missing.push(p)
      continue
    }
    counts[p] = content.split(sep).length
  }
  // 问不到的文件也要进表(值给 -1 之外的可判形态):decide() 里 `p in lineCounts` 为假即红
  for (const p of missing) delete counts[p]
  return counts
}

function runSelfTest() {
  const cases = []
  const mk = (over = {}) => ({
    slices: [
      { path: 'packages/a/src', status: 'deep', read: 1, evidence: ['packages/a/src/x.ts:10'], tickets: ['G-1'] },
      { path: 'packages/b/src', status: 'rejected', read: 1, evidence: ['packages/b/src/y.ts:3'], why: '与我方 §3 同型', verified: 'self' },
      { path: 'packages/c/src', status: 'unread' },
    ],
    ...over,
  })
  const files = ['packages/a/src/x.ts', 'packages/b/src/y.ts', 'packages/c/src/z.ts']
  const lines = { 'packages/a/src/x.ts': 50, 'packages/b/src/y.ts': 8 }

  const pass = decide({ files, lineCounts: lines, registry: mk() })
  cases.push(['齐备面应通过', pass.ok && pass.totals.unclassified === 0])

  const gap = decide({ files: [...files, 'packages/d/src/orphan.ts'], lineCounts: lines, registry: mk() })
  cases.push(['M1 未分类必须红', !gap.ok && gap.errors.some((e) => e.startsWith('M1'))])

  const noEvidence = decide({ files, lineCounts: lines, registry: mk({ slices: [{ path: 'packages/a/src', status: 'deep' }] }) })
  cases.push(['M2 声称 deep 而无出处必须红', noEvidence.errors.some((e) => e.includes('M2'))])

  const noWhy = decide({
    files,
    lineCounts: lines,
    registry: { slices: [{ path: 'packages/a/src', status: 'rejected', evidence: ['packages/a/src/x.ts:1'] }] },
  })
  cases.push(['M2 判不抄没写 why 必须红', noWhy.errors.some((e) => e.includes('没写 why'))])

  const dead = decide({ files, lineCounts: lines, registry: mk({ slices: [{ path: 'packages/a/src', status: 'deep', evidence: ['packages/a/src/nope.ts:1'] }] }) })
  cases.push(['M3 指针指向不在面上的文件必须红', dead.errors.some((e) => e.startsWith('M3'))])

  const overflow = decide({ files, lineCounts: lines, registry: mk({ slices: [{ path: 'packages/a/src', status: 'deep', evidence: ['packages/a/src/x.ts:9999'] }] }) })
  cases.push(['M3 行号越界必须红', overflow.errors.some((e) => e.includes('越界'))])

  const flipped = decide({
    files,
    lineCounts: lines,
    registry: { slices: [{ path: 'packages/c/src', status: 'unread', evidence: ['packages/c/src/z.ts:1'] }] },
  })
  cases.push(['M4 标 unread 却挂出处必须红', flipped.errors.some((e) => e.startsWith('M4'))])

  const dup = decide({
    files,
    lineCounts: lines,
    registry: {
      slices: [
        { path: 'packages/a/src', status: 'unread' },
        { path: 'packages/a/src', status: 'unread' },
      ],
    },
  })
  cases.push(['M5 同切片登记两次必须红', dup.errors.some((e) => e.includes('登记了 2 次'))])

  // M12 读到体的清单可复核性 —— 四条成对:兑现 / 路径不存在 / 行数不符 / 重复计入,
  // 外加一条"差额不得被吞":没有清单的早期自报数**不判红**,但可复核数必须是 0。
  const vf = ['packages/a/src/x.ts', 'packages/a/src/y.ts']
  const mkVerified = (readFiles) =>
    decide({
      files: vf,
      lineCounts: { 'packages/a/src/x.ts': 10, 'packages/a/src/y.ts': 20 },
      registry: {
        slices: [
          {
            path: 'packages/a/src',
            status: 'deep',
            read: 2,
            evidence: ['packages/a/src/x.ts:1-3'],
            verified: 'self',
            readFiles,
          },
        ],
      },
    })
  const vGood = mkVerified([{ p: 'packages/a/src/x.ts', lines: 10 }, { p: 'packages/a/src/y.ts', lines: 20 }])
  cases.push(['M12 清单逐条兑现 ⇒ 可复核数=2 且不红', vGood.ok && vGood.rows[0].verifiedRead === 2])
  const vGhost = mkVerified([{ p: 'packages/a/src/x.ts', lines: 10 }, { p: 'packages/a/src/gone.ts', lines: 5 }])
  cases.push(['M12 清单里路径不在面上必须红', !vGhost.ok && vGhost.errors.some((e) => e.startsWith('M12'))])
  const vWrong = mkVerified([{ p: 'packages/a/src/x.ts', lines: 11 }])
  cases.push(['M12 行数与现量不符必须红', vWrong.errors.some((e) => e.includes('行数不符'))])
  const vDup = mkVerified([{ p: 'packages/a/src/x.ts', lines: 10 }, { p: 'packages/a/src/x.ts', lines: 10 }])
  cases.push(['M12 同一路径计两次必须红', vDup.errors.some((e) => e.includes('重复计入'))])
  const vLegacy = mkVerified(undefined)
  cases.push([
    'M12 没有清单的早期自报数不判红,但可复核数必须为 0(差额不得被吞成已证)',
    vLegacy.ok && vLegacy.rows[0].verifiedRead === 0 && vLegacy.rows[0].read === 2,
  ])

  const brokenRegistry = decide({ files, lineCounts: lines, registry: {} })
  cases.push(['登记表解析不出切片应判"未判定"而非通过', brokenRegistry.undetermined === true && !brokenRegistry.ok])

  const drifted = decide({
    files,
    lineCounts: lines,
    registry: { slices: [{ path: 'packages/a/src', status: 'deep', files: 99, evidence: ['packages/a/src/x.ts:2'] }] },
  })
  cases.push(['登记数字漂了要喊出来(警告而非静默)', drifted.warnings.some((w) => w.includes('已漂'))])

  const halfDeep = decide({
    files,
    lineCounts: lines,
    registry: { slices: [{ path: 'packages/a/src', status: 'deep', read: 0, evidence: ['packages/a/src/x.ts:2'], verified: 'self' }] },
  })
  cases.push(['M11 标 deep 却只读到部分必须红(状态与读量矛盾)', halfDeep.errors.some((e) => e.startsWith('M11'))])

  const promotable = decide({
    files,
    lineCounts: lines,
    registry: { slices: [{ path: 'packages/a/src', status: 'windowed', read: 1, evidence: ['packages/a/src/x.ts:2'], verified: 'self' }] },
  })
  cases.push(['M10 已全部读到体要提示可升 deep', promotable.warnings.some((w) => w.startsWith('M10'))])

  const overclaim = decide({
    files,
    lineCounts: lines,
    registry: { slices: [{ path: 'packages/a/src', status: 'windowed', read: 9, evidence: ['packages/a/src/x.ts:2'], verified: 'self' }] },
  })
  cases.push(['M8 读量超过现量必须红', overclaim.errors.some((e) => e.startsWith('M8'))])

  let fail = 0
  for (const [name, ok] of cases) {
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检 ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(runSelfTest())

  const getVal = (flag) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const asJson = argv.includes('--json')
  const strict = argv.includes('--strict')
  const cloneRel = getVal('--root') || DEFAULT_CLONE
  const registryRel = getVal('--registry') || DEFAULT_REGISTRY
  const cloneRoot = resolve(ROOT, cloneRel)
  const registryPath = resolve(ROOT, registryRel)

  const bail = (reason) => {
    console.log(`⚠️ 未判定:${reason}`)
    console.log('   (本器把"问不到"写成未判定,绝不记绿,也不冒红 —— 上游克隆是 gitignore 的本机文件)')
    process.exit(2)
  }

  let registry
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  } catch (e) {
    bail(`登记表 ${registryRel} 读不到或不是合法 JSON:${e.message}`)
  }
  try {
    assertRepoRoot(cloneRoot, '上游克隆')
  } catch (e) {
    bail(`上游克隆 ${cloneRel} 不是可问的 git 仓:${e.message}`)
  }
  if (!gitBinary()) bail('找不到 git 二进制(服务账户 PATH 不通那一型)')

  const measured = measure(cloneRoot)
  if (measured.err) bail(measured.err)

  const lineCounts = lineCountsFor(cloneRoot, registry)
  const result = decide({ files: measured.files, lineCounts, registry })

  if (asJson) {
    console.log(JSON.stringify({ ...result, upstream: registry.upstream ?? null }, null, 2))
    process.exit(result.undetermined ? 2 : result.ok ? 0 : strict ? 1 : 0)
  }

  const u = registry.upstream ?? {}
  console.log(`ZCode 吸收覆盖矩阵 — 上游 ${u.repo ?? '?'} @ ${u.revision ?? '?'}(被审面 git ls-files 现量)`)
  console.log(`切片登记 ${result.totals?.slices ?? 0} 条 / 源文件 ${result.totals?.total ?? '?'} 个 / 已归类 ${result.totals?.covered ?? '?'} / 未归类 ${result.totals?.unclassified ?? '?'}`)
  const order = ['deep', 'windowed', 'rejected', 'na', 'unread', 'unregistered']
  const tally = order
    .filter((k) => result.byStatus?.[k])
    .map((k) => `${k} ${result.byStatus[k]}`)
    .join(' / ')
  console.log(`按状态: ${tally}`)
  const pct = result.totals ? ((result.readTotal / result.totals.total) * 100).toFixed(1) : '0'
  console.log(
    `整文件读到体 ${result.readTotal} / ${result.totals?.total ?? '?'} 个(${pct}%)—— 这一行才是"吃透多少"的唯一口径`,
  )
  // M12 的第二个数:自报数与可复核数必须同时出现。只报前者,读者就会把差额当成已证。
  const vr = result.verifiedReadTotal ?? 0
  console.log(
    `其中可复核(清单逐条落在被审面上、路径存在、行数与现量相符)= ${vr};` +
      `差额 ${result.readTotal - vr} 份属早期自报(无清单)⇒ 不得当已证事实派单 —— ` +
      `本仓"把代理结论当事实"那一型,头条数字也在这条上`,
  )
  console.log('')
  for (const r of [...result.rows].sort((a, b) => b.files - a.files)) {
    const t = r.tickets.length ? ` 票:${r.tickets.join(',')}` : ''
    console.log(`  ${r.status.padEnd(9)} ${String(r.files).padStart(5)} 个  出处 ${String(r.evidence).padStart(2)} 条  ${r.path}${t}`)
  }
  const left = Object.entries(result.unclassified ?? {}).sort((a, b) => b[1] - a[1])
  if (left.length) {
    console.log('')
    console.log(`未归类(从未登记为看过/判过/不适用)—— 派单只认这张表,不认散文:`)
    for (const [k, v] of left) console.log(`  ${String(v).padStart(5)} 个  ${k}`)
  }
  if (result.warnings.length) {
    console.log('')
    for (const w of result.warnings) console.log(`⚠️ ${w}`)
  }
  if (result.errors.length) {
    console.log('')
    for (const e of result.errors) console.log(`❌ ${e}`)
  }
  console.log('')
  console.log(result.ok ? '✅ 覆盖闭合且每条声称都有可兑现出处' : `❌ ${result.errors.length} 条判据不成立`)
  console.log('(本器不在提交链:它判的是"我们读过上游哪些文件",与本次提交内容无关 —— 恒红只会逼人跳门)')
  process.exit(result.ok ? 0 : strict ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (e) {
    console.error(`❌ 脚本自身异常(不等于判据结论):${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
