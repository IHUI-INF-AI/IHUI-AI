#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-ui-spec-mirror.mjs —— 「RN 壳 ↔ 小程序壳」的 spec 接线对账(2026-10-28 立)。
 *
 * 为什么要有它(现读):三端对齐的地基是 `packages/shared/src/ui/*-spec.ts` —— 组件的**取值档**
 * 收在一处,两端壳只做"档 → 本端承载类"的映射。改 spec 一处,两端同时变,这是"自动同步"的
 * 真正杠杆点。但**接线是分头做的**:
 *   · RN 壳(`packages/ui-native/src/*.tsx`):9 个组件已接 spec(badge/card/dialog/input/sheet/switch/tabs/tooltip/vip-badge);
 *   · 小程序壳(`apps/miniapp-taro/src/components/*.tsx`):17 个组件已接 spec(Avatar/NavBar/InputArea/…),
 *     但**与 RN 同名的 7 个一个都没接**(badge/card/input/sheet/switch/tabs/tooltip)。
 * 后果不是"值今天不一样"——今天的值大多碰巧相同(手抄对了),而是**明天改 spec 时 RN 会跟、小程序不会跟**,
 * 于是 spec 单源当场退化成两份真相。这正是"自动同步"链条上唯一还断着的那一环。
 *
 * 为什么现有门看不见:
 *   · 门 128 的 rn 腿是 `packages/app/src/components` + `packages/app/src/features` + `apps/mobile-rn/src/components`
 *     —— **不含 `packages/ui-native`**,所以 ui-native ↔ miniapp 这一对在门 128 射程外;
 *   · `packages/shared/src/ui/__tests__/card-wiring.test.ts` 一族判的是 **web 壳 ↔ RN 壳**,小程序不在其中;
 *   · 门 93 只核**颜色**令牌,不看组件几何档。
 * ⇒ 这一对是全仓门的盲区,而它正是"小程序对齐 RN"的主链。
 *
 * 判什么(只判**接线**,不判值 —— 值的一致性归门 128 与各 spec 的 wiring 测试):
 *   同一 spec 的**两端消费面必须相等**。消费面 = 该 spec 的导出名(spec 源码里 `export const` / `export type`
 *   现场导出,不是手抄清单)出现在壳源码里的那批(注释已遮蔽 —— 注释里提一嘴不算接线)。
 *   - 两端消费面相等且非空 ⇒ 绿(spec 改一处,两端同时跟随);
 *   - 两端消费面不等 ⇒ 红,并逐条点名差集(谁接了、谁没接);
 *   - 两端都没接 ⇒ **不在射程**,只报数(那是"这个组件族还没下沉契约",不是断链);
 *   - spec 本身不存在 ⇒ 只报数。
 *
 * 取材面(§0.4):默认 HEAD blob;`--staged` 判索引;`--worktree` 判磁盘;两面旗同给 ⇒ exit 2 未判定。
 * 判据零复算(§0.6):导出面现场从 spec 源码解析;壳清单与内容走 `lib/face-reader` 的取材面出口
 * (listFaceFiles / catBatch / hideComments),不另写一份 git 取数。
 *
 * 退出码:0 = 无断链;1 = 有断链(逐条点名);2 = 未判定(取不到面 / 输入缺失)。
 *
 * Usage:
 *   node scripts/check-ui-spec-mirror.mjs             # 判定面=HEAD blob
 *   node scripts/check-ui-spec-mirror.mjs --staged
 *   node scripts/check-ui-spec-mirror.mjs --worktree
 *   node scripts/check-ui-spec-mirror.mjs --json
 *   node scripts/check-ui-spec-mirror.mjs --self-test  # 判据自检(纯内存夹具)
 */
/* eslint-disable no-console -- 只读报告器,必须打印结论表 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  catBatch,
  hideComments,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import {
  parseWaivers,
  todayIso,
  waiverVerdict,
  WAIVER_LEDGER_REL,
} from './lib/ui-mirror-waivers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RN_DIR = 'packages/ui-native/src'
const MP_DIR = 'apps/miniapp-taro/src/components'
const SPEC_DIR = 'packages/shared/src/ui'

/** kebab → Pascal:bottom-action-bar ⇒ BottomActionBar(小程序壳的命名口径)。 */
export function pascalOf(kebab) {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

/** spec 的导出面:现场从源码解析 `export const X` / `export type X`(不手抄清单)。 */
export function exportNamesOf(specSrc) {
  const names = new Set()
  const re = /export\s+(?:const|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g
  let m
  while ((m = re.exec(String(specSrc))) !== null) names.add(m[1])
  return names
}

/**
 * 消费面:spec 导出名里,哪些真的出现在壳源码中。
 * 注释先遮蔽 —— 注释里写一句"这里该用 CARD_PADDING_PX"不算接线(否则头注一改就假绿)。
 */
export function consumedNamesOf(shellSrc, exportNames) {
  const body = hideComments(String(shellSrc))
  const hit = new Set()
  for (const name of exportNames) {
    const re = new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`)
    if (re.test(body)) hit.add(name)
  }
  return hit
}

/** 两集合差集(有序,便于逐条点名)。 */
export function diffOf(left, right) {
  return [...left].filter((x) => !right.has(x)).sort()
}

/**
 * 一对壳的判定。纯函数,可被自检直接调用。
 * @returns {{state:'linked'|'broken'|'out-of-scope'|'no-spec', onlyRn:string[], onlyMp:string[]}}
 */
export function judgePair({ exportNames, rnSrc, mpSrc }) {
  const rn = consumedNamesOf(rnSrc, exportNames)
  const mp = consumedNamesOf(mpSrc, exportNames)
  if (rn.size === 0 && mp.size === 0) return { state: 'out-of-scope', onlyRn: [], onlyMp: [] }
  const onlyRn = diffOf(rn, mp)
  const onlyMp = diffOf(mp, rn)
  if (onlyRn.length === 0 && onlyMp.length === 0) return { state: 'linked', onlyRn: [], onlyMp: [] }
  return { state: 'broken', onlyRn, onlyMp }
}

/**
 * 对判定结果执行**具名豁免**(判序单源 = `lib/ui-mirror-waivers.mjs`,与 gen-ui-mirror 同一把尺)。
 * 只作用在「RN 消费而小程序没消费」这一侧 —— 小程序多的名字没有豁免通道(那是本端自造的第二份真相)。
 * 三种结局:全免 ⇒ linked(带 waived 计数);到期/清单腐烂 ⇒ 仍是 broken 并把原因写进 notes;
 * 部分免 ⇒ broken 只点剩余名。
 */
export function waiveRow(pair, verdict, waivers, today = todayIso()) {
  if (verdict.state !== 'broken') return { ...verdict, waived: [], notes: [] }
  const v = waiverVerdict(pair, verdict.onlyRn, waivers, today)
  const remaining = verdict.onlyRn.filter((name) => !v.used.includes(name))
  const notes = []
  if (v.expired.length) notes.push(`豁免已到期: ${v.expired.join(', ')}`)
  if (v.rot.length) notes.push(`豁免清单腐烂: ${v.rot.join(', ')}`)
  if (!notes.length && remaining.length === 0 && verdict.onlyMp.length === 0)
    return { state: 'linked', onlyRn: [], onlyMp: [], waived: v.used, notes: [] }
  return { state: 'broken', onlyRn: remaining, onlyMp: verdict.onlyMp, waived: v.used, notes }
}

function faceRev(face, rel) {
  if (face === 'staged') return `:${rel}`
  return `HEAD:${rel}`
}

/** 取一面上的若干文件内容(HEAD/staged 走 catBatch,worktree 直接读盘)。 */
export function readFaceTexts(face, rels) {
  const out = new Map()
  if (face === 'worktree') {
    for (const rel of rels) {
      try {
        out.set(rel, readWorktreeFile(ROOT, rel))
      } catch {
        out.set(rel, null)
      }
    }
    return out
  }
  const revs = rels.map((rel) => faceRev(face, rel))
  const got = catBatch(ROOT, revs, { maxBuffer: 512 * 1024 * 1024 })
  for (const rel of rels) out.set(rel, got.get(faceRev(face, rel)) ?? null)
  return out
}

/** 枚举射程内的组件对:RN 壳文件 → spec 路径 + 小程序壳路径。 */
export function collectPairs(face) {
  const rnFiles = listFaceFiles(ROOT, face, { paths: [RN_DIR] })
  const pairs = []
  for (const rel of rnFiles) {
    if (!rel.endsWith('.tsx') && !rel.endsWith('.ts')) continue
    const base = rel.slice(RN_DIR.length + 1).replace(/\.tsx?$/, '')
    if (base.includes('/')) continue
    const specRel = `${SPEC_DIR}/${base}-spec.ts`
    const mpRel = `${MP_DIR}/${pascalOf(base)}.tsx`
    pairs.push({ base, rnRel: rel, specRel, mpRel })
  }
  return pairs
}

export function audit(face) {
  const pairs = collectPairs(face)
  // 三类输入同面同轮(§0.4:清单与内容同面同轮):RN 壳、spec、小程序壳,加上**豁免台账**,
  // 一份都不从别的面取 —— 判 HEAD 时读磁盘台账,就是「HEAD 缺豁免、盘上已补好」那型假绿的成因。
  const texts = readFaceTexts(face, [
    ...new Set([
      ...pairs.map((p) => p.rnRel),
      ...pairs.map((p) => p.specRel),
      ...pairs.map((p) => p.mpRel),
      WAIVER_LEDGER_REL,
    ]),
  ])
  const ledger = parseWaivers(texts.get(WAIVER_LEDGER_REL))
  const rows = []
  if (!ledger.ok)
    rows.push({
      base: WAIVER_LEDGER_REL,
      state: 'ledger-error',
      onlyRn: [],
      onlyMp: [],
      waived: [],
      notes: [ledger.error],
    })
  const waivers = ledger.ok ? ledger.waivers : []
  for (const pair of pairs) {
    const specSrc = texts.get(pair.specRel)
    const mpSrc = texts.get(pair.mpRel)
    const rnSrc = texts.get(pair.rnRel)
    if (specSrc === null || rnSrc === null) {
      rows.push({ ...pair, state: 'no-spec', onlyRn: [], onlyMp: [], waived: [], notes: [] })
      continue
    }
    if (mpSrc === null) {
      rows.push({
        ...pair,
        state: 'no-miniapp-file',
        onlyRn: [],
        onlyMp: [],
        waived: [],
        notes: [],
      })
      continue
    }
    const exportNames = exportNamesOf(specSrc)
    if (exportNames.size === 0) {
      rows.push({ ...pair, state: 'no-spec', onlyRn: [], onlyMp: [], waived: [], notes: [] })
      continue
    }
    rows.push({
      ...pair,
      ...waiveRow(pair.base, judgePair({ exportNames, rnSrc, mpSrc }), waivers),
    })
  }
  return rows
}

/** 自检:纯内存夹具,不碰仓库。 */
export function selfTest() {
  const cases = []
  const spec = 'export const A_PX = 12\nexport const B_TIER = "lg"\nexport type CTier = "sm"\n'
  cases.push([
    '两端消费面相同 ⇒ linked',
    judgePair({
      exportNames: exportNamesOf(spec),
      rnSrc: 'import { A_PX } from "x"\nA_PX',
      mpSrc: 'import { A_PX } from "x"\nA_PX',
    }).state,
    'linked',
  ])
  cases.push([
    '只有 RN 消费 ⇒ broken(点名 RN 独有的)',
    judgePair({ exportNames: exportNamesOf(spec), rnSrc: 'A_PX B_TIER', mpSrc: '' }).state,
    'broken',
  ])
  cases.push([
    '两端都没消费 ⇒ out-of-scope(不判红)',
    judgePair({ exportNames: exportNamesOf(spec), rnSrc: 'x', mpSrc: 'y' }).state,
    'out-of-scope',
  ])
  cases.push([
    '注释里提到不算接线',
    judgePair({ exportNames: exportNamesOf(spec), rnSrc: '/* A_PX */', mpSrc: '' }).state,
    'out-of-scope',
  ])
  cases.push([
    'RN 独有项被点名',
    judgePair({ exportNames: exportNamesOf(spec), rnSrc: 'A_PX', mpSrc: '' }).onlyRn.join(','),
    'A_PX',
  ])
  cases.push([
    '小程序独有项被点名',
    judgePair({ exportNames: exportNamesOf(spec), rnSrc: '', mpSrc: 'B_TIER' }).onlyMp.join(','),
    'B_TIER',
  ])
  cases.push(['kebab→Pascal', pascalOf('bottom-action-bar'), 'BottomActionBar'])
  cases.push(['导出面现场解析', [...exportNamesOf(spec)].sort().join(','), 'A_PX,B_TIER,CTier'])

  // 具名豁免族(判序 import lib 单源,本面不写第二份)
  const rnOnly = judgePair({ exportNames: exportNamesOf(spec), rnSrc: 'A_PX B_TIER', mpSrc: '' })
  const goodWaiver = [
    {
      pair: 'demo',
      names: ['A_PX', 'B_TIER'],
      reason: '本端承载不允许照抄这一消费形,理由已在台账里写清',
      reviewBy: '2099-01-01',
    },
  ]
  const waived = waiveRow('demo', rnOnly, goodWaiver, '2026-10-28')
  cases.push(['未过期豁免全中 ⇒ linked', waived.state, 'linked'])
  cases.push(['豁免名逐条可查(不静默)', waived.waived.join(','), 'A_PX,B_TIER'])
  cases.push([
    '到期豁免回队列 ⇒ 仍 broken',
    waiveRow('demo', rnOnly, goodWaiver, '2099-06-01').state,
    'broken',
  ])
  cases.push([
    '被审面不再命中 ⇒ 清单腐烂仍 broken',
    waiveRow(
      'demo',
      judgePair({ exportNames: exportNamesOf(spec), rnSrc: 'A_PX B_TIER', mpSrc: 'A_PX' }),
      goodWaiver,
      '2026-10-28',
    ).state,
    'broken',
  ])
  cases.push([
    '小程序独有侧没有豁免通道',
    waiveRow(
      'demo',
      judgePair({ exportNames: exportNamesOf(spec), rnSrc: 'A_PX', mpSrc: 'B_TIER' }),
      [
        {
          pair: 'demo',
          names: ['B_TIER'],
          reason: '试图给本端自造的第二份真相开免',
          reviewBy: '2099-01-01',
        },
      ],
      '2026-10-28',
    ).state,
    'broken',
  ])

  let failed = 0
  for (const [name, actual, expected] of cases) {
    if (actual !== expected) {
      failed += 1
      console.error(`✗ ${name}: 期望 ${expected},实得 ${actual}`)
    }
  }
  console.log(
    failed === 0
      ? `✅ 自检 ${cases.length}/${cases.length} 通过`
      : `✗ 自检失败 ${failed}/${cases.length}`,
  )
  return failed === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()

  let face
  try {
    const { face: picked, error } = selectFace({
      staged: argv.includes('--staged'),
      worktree: argv.includes('--worktree'),
      def: 'head',
    })
    if (error) throw new Error(error)
    face = picked
  } catch (error) {
    console.error(`🟡 未判定:${error.message}`)
    return 2
  }

  const rows = audit(face)
  const ledgerError = rows.find((r) => r.state === 'ledger-error')
  if (ledgerError) {
    console.error(
      `🟡 未判定:${WAIVER_LEDGER_REL} 在 ${face} 面解析不了 —— ${ledgerError.notes.join('; ')}`,
    )
    return 2
  }
  const broken = rows.filter((r) => r.state === 'broken')
  const outOfScope = rows.filter((r) => r.state === 'out-of-scope')
  const noSpec = rows.filter((r) => r.state === 'no-spec')
  const noMp = rows.filter((r) => r.state === 'no-miniapp-file')

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face, rows, broken: broken.length }, null, 2))
  } else {
    console.log(`\n🔗 RN 壳 ↔ 小程序壳 · spec 接线对账(判定面:${face})\n${'─'.repeat(72)}`)
    for (const row of rows) {
      const icon =
        row.state === 'linked'
          ? '✅'
          : row.state === 'broken'
            ? '🔴'
            : row.state === 'no-miniapp-file'
              ? '·'
              : '⏭'
      const waivedNote = row.waived?.length ? ` · 已验豁免 ${row.waived.length} 名` : ''
      const detail =
        row.state === 'broken'
          ? `RN 独有:[${row.onlyRn.join(', ')}] 小程序独有:[${row.onlyMp.join(', ')}]${
              row.notes?.length ? ` —— ${row.notes.join('; ')}` : ''
            }`
          : row.state === 'linked'
            ? `两端消费面一致${waivedNote}`
            : row.state === 'no-spec'
              ? '无 spec 契约(不在射程)'
              : '小程序无同名壳(不在射程)'
      console.log(`${icon} ${row.base.padEnd(20)} ${detail}`)
    }
    console.log('─'.repeat(72))
    console.log(
      `射程对 ${rows.length} · ✅已接线 ${rows.length - broken.length - outOfScope.length - noSpec.length - noMp.length}` +
        ` · 🔴断链 ${broken.length} · ⏭不在射程 ${outOfScope.length + noSpec.length + noMp.length}`,
    )
    if (broken.length > 0) {
      console.log(
        '🔴 断链 = 改 spec 时 RN 会跟、小程序不会跟 ⇒ spec 单源在这条链上退化成了两份真相。',
      )
    }
  }
  return broken.length > 0 ? 1 : 0
}

const invokedDirectly = (() => {
  try {
    return pathToFileURL(process.argv[1] ?? '').href === import.meta.url
  } catch {
    return false
  }
})()

if (invokedDirectly) process.exitCode = main(process.argv.slice(2))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
