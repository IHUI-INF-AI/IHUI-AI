#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-no-nested-git-sites-durability.mjs —— 门 208 两把豁免台账的**存续对账**(台账行不许静默消失)。
 *
 * 立门因由:scripts/data/no-nested-git-sites.jsonl 是守门 208 的第二把豁免载体
 * (每处现场一行 rel/owner/why/expires,枚 5daba796e0),旧 JSON 台账
 * no-nested-git-exemptions.json 仍在(整文件覆盖形态,曾实测被并发会话拿空副本洗回
 * entries:[])。两把台账目前缺的正是与活文档受守门 71 保护同型的缺口:
 * **登记行被洗掉(整行/整文件消失)没有任何东西报警**。本门补这一格。
 *
 * 判据(§0.4 三面纪律):
 *   - 被审面:全量档 = HEAD blob,--staged = 索引 blob,--worktree 仅人工逃生舱;
 *     两面旗同给 ⇒ exit 2;取不到被审面 ⇒ exit 2 显式「未判定」,绝不静默回落另一面。
 *   - HEAD 面读同一批文件。**HEAD 面上每一条未到期(expires >= 今天,ISO 字典序比较)的
 *     登记行,在被审面上必须仍存在**(按 rel 逐字等值匹配;同 rel 多条以「至少一条存活」计)。
 *     缺失 ⇒ 红,逐条点名 rel + owner + expires。到期行允许被摘除。
 *   - 被审面文件不存在但 HEAD 面有未到期行 ⇒ 同样红(整文件被删也是「洗掉」)。
 *   - HEAD 面本来就没有登记行 ⇒ 绿(没有东西要保护,不是恒红门)。
 *   - HEAD 面读不出(坏 JSON/缺字段/坏行)⇒ fail-closed,exit 2 未判定,不记绿也不冒红(§0.3)。
 *
 * 单源纪律(§0.6/§22c):行式台账的行解析(含坏行收集、rel 归一)一律复用
 * scripts/check-no-nested-git.mjs 的 loadNamedSites / loadNamedExemptions(经 __test__ import),
 * 本门不抄第二份「什么算一条合格登记行」。
 *
 * 边界声明:两把台账的数据形态是行式/条目式可增量合并;本门只守「已登记未到期行不得
 * 静默消失」,**现场存续本身仍由门 208 在判红那一刻现算,本门不判现场在不在**。
 * 注册状态以 scripts/guardian-runner.mjs 注册条目现值为准(本头注不预支注册事实)。
 *
 * 退出码:0 绿 / 1 红 / 2 未判定。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadNamedExemptions, loadNamedSites } from './check-no-nested-git.mjs'
import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..')
const GATE_LABEL = '[check-no-nested-git-sites-durability]'

/** 被对账的两把台账(仓库相对路径)。 */
export const SITES_REL = 'scripts/data/no-nested-git-sites.jsonl'
export const EXEMPTIONS_REL = 'scripts/data/no-nested-git-exemptions.json'

export function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

/** 面选择包装:两面旗同给 ⇒ 未判定(main 落 exit 2,§0.4)。 */
export function pickFace(staged, worktree) {
  const picked = selectFace({ staged, worktree })
  if (picked.error) return { face: null, undetermined: true, reason: picked.error }
  return { face: picked.face, undetermined: false, reason: '' }
}

/**
 * 把某一面上两把台账的 blob 文本解析成统一登记行(纯逻辑 + scratch 临时文件,不碰 git)。
 * 行式与 JSON 两把都走门 208 的单一解析实现(§0.6);任何 error/坏行都进 `unreadable`
 * (严重度由调用方定:HEAD 面任何 unreadable ⇒ exit 2;被审面 unreadable 只作上下文 ——
 * 行读不出来 = 该行不在,存续判据自然咬住,不另行放行)。
 * @returns {{rows:Array<{rel:string,owner:string,expires:string,why:string,via:string}>, unreadable:string[]}}
 */
export function parseLedgerTexts({ sitesText, exemptionsText }) {
  const rows = []
  const unreadable = []
  const box = mkScratch('nnsg-durability-')
  try {
    if (sitesText !== null && sitesText !== undefined) {
      const f = join(box, 'sites.jsonl')
      writeFileSync(f, sitesText, 'utf8')
      const r = loadNamedSites(f)
      for (const e of r.entries) rows.push({ ...e, via: '行式现场登记' })
      if (r.error) unreadable.push(`${SITES_REL}: ${r.error}`)
      for (const b of r.bad ?? []) unreadable.push(`${SITES_REL} 坏行:${b}`)
    }
    if (exemptionsText !== null && exemptionsText !== undefined) {
      const f = join(box, 'exemptions.json')
      writeFileSync(f, exemptionsText, 'utf8')
      const r = loadNamedExemptions(f)
      for (const e of r.entries) rows.push({ ...e, via: 'JSON 台账' })
      if (r.error) unreadable.push(`${EXEMPTIONS_REL}: ${r.error}`)
      for (const b of r.bad ?? []) unreadable.push(`${EXEMPTIONS_REL} 条目形态不合格:${b}`)
    }
  } finally {
    rmScratch(box)
  }
  return { rows, unreadable }
}

/** HEAD 面读出可用性:任何 unreadable(坏 JSON/缺字段/坏行)⇒ 不可用 ⇒ main 落 exit 2(fail-closed)。 */
export function headFaceUsable(headCollect) {
  return (headCollect?.unreadable ?? []).length === 0
}

/**
 * 存续判定(纯函数):HEAD 面每一条未到期登记行必须能在被审面的 rel 集合里找到。
 * 同 rel 多条以「至少一条存活」计;被审面 rel 集合为空(文件被删/全坏)⇒ 全部判缺。
 * @returns {{ok:boolean, missing:Array<{rel,owner,expires,via}>, activeCount:number, faceCount:number}}
 */
export function durabilityVerdict({ headRows, faceRows, today }) {
  const t = today ?? isoToday()
  const active = (headRows ?? []).filter((e) => e && String(e.expires ?? '') >= t)
  const faceRels = new Set((faceRows ?? []).map((e) => e.rel))
  const missing = active.filter((e) => !faceRels.has(e.rel))
  return {
    ok: missing.length === 0,
    missing,
    activeCount: active.length,
    faceCount: (faceRows ?? []).length,
  }
}

/** 单一 blob 取材:一次 catBatch,层抛 ⇒ null ⇒ 调用方落「未判定」(§0.3,不回落另一面)。 */
function readSpecs(specs) {
  try {
    return catBatch(ROOT, specs, { timeout: 120000 })
  } catch {
    return null
  }
}

/** 自检:构造内存输入(不跑真 git),覆盖任务点名的七例 + JSON 台账正例。 */
export function selfTest() {
  const FUTURE = '2099-01-01'
  const PAST = '2000-01-01'
  const row = (rel, expires) => JSON.stringify({ rel, owner: '甲', why: '演练现场', expires })
  const HEAD_TEXT = [row('.worktrees/wt-demo', FUTURE), row('outputs/demo', PAST)].join('\n')
  const cases = [
    {
      n: '① HEAD 有未到期行、被审面缺失 ⇒ 红',
      head: HEAD_TEXT,
      face: row('outputs/demo', PAST),
      faceEx: null,
      red: true,
    },
    {
      n: '② 被审面保留该行 ⇒ 绿',
      head: HEAD_TEXT,
      face: HEAD_TEXT,
      faceEx: null,
      red: false,
    },
    {
      n: '③ 到期行被摘 ⇒ 绿(到期行允许被摘除)',
      head: row('outputs/demo', PAST),
      face: '',
      faceEx: null,
      red: false,
    },
    {
      n: '④ HEAD 面无任何行 ⇒ 绿(没有东西要保护,不是恒红门)',
      head: '',
      face: '',
      faceEx: '{"entries":[]}',
      red: false,
    },
    {
      n: '⑦ 被审面整文件消失且 HEAD 有未到期行 ⇒ 红(整文件被删也是洗掉)',
      head: HEAD_TEXT,
      face: null,
      faceEx: null,
      red: true,
    },
    {
      n: '⑧ JSON 台账的未到期行同样受保护(被审面 entries 被洗空 ⇒ 红)',
      head: null,
      face: null,
      headEx: JSON.stringify({ entries: [{ rel: '.worktrees/wt-json', owner: '乙', why: 'x', expires: FUTURE }] }),
      faceEx: '{"entries":[]}',
      red: true,
    },
  ]
  let fails = 0
  let total = 0
  const check = (n, cond) => {
    total++
    if (cond) console.log(`✓ ${n}`)
    else {
      fails++
      console.log(`✗ ${n}`)
    }
  }
  for (const c of cases) {
    const head = parseLedgerTexts({ sitesText: c.head, exemptionsText: c.headEx ?? null })
    const face = parseLedgerTexts({ sitesText: c.face, exemptionsText: c.faceEx ?? null })
    const v = durabilityVerdict({ headRows: head.rows, faceRows: face.rows, today: '2026-10-20' })
    const isRed = !v.ok
    check(`${c.n} —— 实得 ${isRed ? '红' : '绿'}(missing=${v.missing.length})`, isRed === c.red)
  }
  // ⑤ HEAD 面坏 JSON ⇒ fail-closed(exit 2 路径的判据半边)
  const badHead = parseLedgerTexts({ sitesText: null, exemptionsText: '{not-json' })
  check(
    `⑤ HEAD 面坏 JSON ⇒ unreadable 非空(headFaceUsable=false ⇒ main 落 exit 2 未判定)`,
    badHead.unreadable.length > 0 && !headFaceUsable(badHead),
  )
  // 坏行也是 unreadable(HEAD 面 fail-closed 的另一半)
  const badLine = parseLedgerTexts({ sitesText: '{"rel": ".x"}', exemptionsText: null })
  check('⑤b HEAD 面 jsonl 坏行(缺 owner/why/到期日)⇒ unreadable 非空', badLine.unreadable.length > 0)
  // ⑥ 两面旗同给 ⇒ 未判定(main 落 exit 2)
  const both = pickFace(true, true)
  check('⑥ 两面旗同给 ⇒ 未判定(exit 2,不回落任一面)', both.undetermined && both.reason !== '')
  // 反证:判据被掏空(恒绿)必须至少咬掉一条正例
  const hollow = durabilityVerdict({
    headRows: [{ rel: '.worktrees/wt-demo', owner: '甲', expires: FUTURE }],
    faceRows: [],
    today: '2026-10-20',
  })
  check('反证:保护行夹具确有牙(恒绿实现咬不住)', !hollow.ok)
  if (fails) console.log(`❌ 自检 ${total - fails}/${total} 例(${fails} 例失败)`)
  else console.log(`✅ 自检 ${total}/${total} 例全过`)
  return fails ? 1 : 0
}

/** CLI 主体:返回退出码(0 绿 / 1 红 / 2 未判定)。 */
export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info(`用法: node scripts/${'check-no-nested-git-sites-durability.mjs'} [--staged|--worktree|--self-test]`)
    console.info('门 208 两把豁免台账的存续对账:HEAD 面未到期登记行在被审面必须仍在,被洗掉即红。')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()

  const pick = pickFace(argv.includes('--staged'), argv.includes('--worktree'))
  if (pick.undetermined) {
    console.error(`${GATE_LABEL} ⏭ 未判定:${pick.reason} ⇒ 不记绿也不冒红(§0.3/§0.4)`)
    return 2
  }
  const faceName =
    pick.face === 'staged' ? '索引 blob' : pick.face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'

  // ① HEAD 面(保护集来源)——一次 batch 取两把台账
  const headSpecs = [`HEAD:${SITES_REL}`, `HEAD:${EXEMPTIONS_REL}`]
  const headMap = readSpecs(headSpecs)
  if (headMap === null) {
    console.error(`${GATE_LABEL} ⏭ 未判定:取材层取不到 HEAD 面 blob ⇒ 不记绿也不冒红(§0.3)`)
    return 2
  }
  const headSitesText = headMap.get(headSpecs[0]) ?? null
  const headExemptionsText = headMap.get(headSpecs[1]) ?? null
  const headCollect = parseLedgerTexts({ sitesText: headSitesText, exemptionsText: headExemptionsText })
  if (!headFaceUsable(headCollect)) {
    console.error(`${GATE_LABEL} ⏭ 未判定:HEAD 面台账读不出(fail-closed,不冒充「没有登记行」):`)
    for (const r of headCollect.unreadable) console.error(`   - ${r}`)
    return 2
  }

  // ② 被审面 —— 与 HEAD 面同轮同基准,绝不回落另一个面
  let faceSitesText
  let faceExemptionsText
  if (pick.face === 'staged') {
    const specs = [`:${SITES_REL}`, `:${EXEMPTIONS_REL}`]
    const faceMap = readSpecs(specs)
    if (faceMap === null) {
      console.error(`${GATE_LABEL} ⏭ 未判定:取材层取不到索引面 blob ⇒ 不记绿也不冒红(§0.3)`)
      return 2
    }
    faceSitesText = faceMap.get(specs[0]) ?? null
    faceExemptionsText = faceMap.get(specs[1]) ?? null
  } else if (pick.face === 'worktree') {
    // 人工逃生舱:唯一允许读盘的一档;基线(保护集)仍取 HEAD blob
    try {
      faceSitesText = readWorktreeFile(ROOT, SITES_REL)
      faceExemptionsText = readWorktreeFile(ROOT, EXEMPTIONS_REL)
    } catch (e) {
      console.error(`${GATE_LABEL} ⏭ 未判定:工作树面取不到(${e?.message ?? e})`)
      return 2
    }
  } else {
    faceSitesText = headSitesText
    faceExemptionsText = headExemptionsText
  }
  const faceCollect = parseLedgerTexts({ sitesText: faceSitesText, exemptionsText: faceExemptionsText })

  const today = isoToday()
  const v = durabilityVerdict({ headRows: headCollect.rows, faceRows: faceCollect.rows, today })

  if (v.ok) {
    console.info(
      `${GATE_LABEL} ✅ 台账存续对账通过:HEAD 面 ${v.activeCount} 条未到期登记行在被审面(${faceName})全部仍在` +
        `(被审面现存 ${v.faceCount} 条;到期行允许被摘,现场存续由门 208 现算)`
    )
    return 0
  }

  console.error(
    `${GATE_LABEL} ❌ 台账被洗掉:HEAD 面 ${v.activeCount} 条未到期登记行中有 ${v.missing.length} 条在被审面(${faceName})消失 —— ` +
      `登记行静默消失 = 豁免凭据无源,与活文档受保护同型的缺口,本次判定红:`
  )
  for (const m of v.missing) {
    console.error(`   · [${m.via}] rel=${m.rel} —— owner: ${m.owner};到期 ${m.expires}`)
  }
  if (faceCollect.unreadable.length > 0) {
    console.error(`  ℹ 被审面另有读不出的台账内容(坏行/坏 JSON,读不出 = 该行不在):`)
    for (const r of faceCollect.unreadable) console.error(`     - ${r}`)
  }
  console.error(
    `  处置:① 摘行有正当理由(现场真消失/到期)⇒ 正常,但请让它经过一次提交而不是被并发会话整文件洗掉 —— 在本枚提交里显式带上有意摘除的说明;\n` +
      `        ② 无意洗掉(整文件覆盖回旧副本是本台账的实测事故形态)⇒ 把 HEAD 面的登记行原样带回再提交。`
  )
  return 1
}

/** §22d 直接运行守卫:被 import(镜像测试/其他门)时不自跑。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`${GATE_LABEL} 异常: ${e?.message ?? e}`)
      process.exit(2)
    })
}

export const __test__ = {
  ROOT,
  SITES_REL,
  EXEMPTIONS_REL,
  isoToday,
  pickFace,
  parseLedgerTexts,
  headFaceUsable,
  durabilityVerdict,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
