#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * i18n 死 key 审计器 — 统一入口(2026-07-27 重构:5 端收敛为 --target 单脚本)
 *
 * 历史:原 5 份独立脚本(scan-{web,extension,miniapp-taro,mobile-rn,desktop}-dead-i18n-keys.mjs)
 *      逻辑高度相似(各端配置 + 调用 _i18n-scan-helpers.mjs 的 main()),
 *      2026-07-27 收敛为本统一入口,5 端配置内聚为 TARGETS 字典;
 *      5 个旧脚本改为 thin wrapper(spawnSync 委托本入口 --target=<端>),向后兼容。
 *
 * 用法:
 *   node scripts/scan-dead-i18n-keys.mjs                              # 默认 target=web
 *   node scripts/scan-dead-i18n-keys.mjs --target miniapp-taro        # 指定目标端
 *   node scripts/scan-dead-i18n-keys.mjs --target web --check         # 烟测模式(= --dry-run,不写报告)
 *   node scripts/scan-dead-i18n-keys.mjs --target web --dry-run       # 只打印统计
 *   node scripts/scan-dead-i18n-keys.mjs --out <path>                 # 自定义输出路径
 *   node scripts/scan-dead-i18n-keys.mjs --exit 1                     # 发现死 key 则 exit 1
 *   node scripts/scan-dead-i18n-keys.mjs --help                       # 帮助
 *
 * 支持目标端(2026-07-27 5 端收敛):
 *   - web          (默认,代码扫描含 web/miniapp-taro/cli/mobile-rn,因 web i18n 跨端共享)
 *   - extension    (代码扫描 apps/extension/{entrypoints,src,lib})
 *   - miniapp-taro (代码扫描仅 apps/miniapp-taro/src)
 *   - mobile-rn    (代码扫描仅 apps/mobile-rn/src)
 *   - cli          (Node.js CLI,代码扫描 apps/cli/src)
 *   - desktop      (Rust/Tauri 包装,无 JS 代码,messages 目录未建立,自动跳过 exit 0)
 *
 * 5 端 thin wrapper(向后兼容,委托本入口):
 *   node scripts/scan-web-dead-i18n-keys.mjs          # → --target=web
 *   node scripts/scan-extension-dead-i18n-keys.mjs    # → --target=extension
 *   node scripts/scan-miniapp-taro-dead-i18n-keys.mjs # → --target=miniapp-taro
 *   node scripts/scan-mobile-rn-dead-i18n-keys.mjs    # → --target=mobile-rn
  # cli 无 thin wrapper,直接用 --target=cli
 *   node scripts/scan-desktop-dead-i18n-keys.mjs      # → --target=desktop
 *
 * 死 key 判定 / 翻译完整性 / 动态 key:见 _i18n-scan-helpers.mjs 注释
 *
 * 判定面(2026-09-28 立,2026-10-16 收到 AGENTS §0.4 三面口径,与守门 70/118 同律):
 *   缺省(= face 'head')⇒ **HEAD blob**:locale JSON、契约文件、参照语料在同一轮经
 *                 `git ls-tree -r HEAD` 枚举 + 一次 `cat-file --batch`(`scripts/lib/face-reader.mjs`
 *                 的 `catBatch`)读满,清单与内容同面同轮。全量档判的是"提交真正带上的那一份",
 *                 不是滞后的共享工作树 —— 2026-10-16 实测:磁盘档因 4 份已随 `a86e4cc821` 摘除、
 *                 盘上却没刷掉的组件残留,把一枚孤儿键 `Menu.d1` 判成绿,而 CI 在干净检出判红
 *                 (失效方向是"本地绿 / CI 红",每次都要有人在 CI 上重新发现一遍)。
 *   --staged      ⇒ **索引 blob**:同一套装配,规格换成 `:<rel>`。提交链门禁档:并行会话**未暂存**
 *                 的磁盘半编辑态结构上进不了索引,所以再也判不红本次提交(立项成因:本步作为批外
 *                 blocking 曾因他人未提交的 apps/web/app/status/page.tsx 红过,各会话唯一出路
 *                 --no-verify,一次绕过约等于链上全部守门作废,§12e/§12f)。
 *                 面上取不到 ⇒ exit 2「未判定」并点名路径,不回退磁盘、不记通过。
 *   --worktree    ⇒ **工作树磁盘**:人工逃生舱,只用于"我就是要看盘上现在什么样"。
 *   两面旗同给 ⇒ exit 2(判据互斥,取哪一面都会把另一面洗成假绿)。
 *
 * 契约键出口:scripts/i18n-contract-keys.json(跨端词包契约键 / 被测试钉住的形状键)。
 * 静态扫描只能看见"本端有没有人取这个词",看不见"这个词是不是契约的一部分";
 * 没有这个出口,唯一的出路就是把 --target all 缩回单端 —— 那等于把其余四端的红点重新藏起来。
 * 逐条依据必须能在判定面里核验(文件存在 / 行号在范围内 / 该行含被引用的标识符),不成立即判红
 * (全量档 = HEAD;--staged 档 = 索引面;两档都是"提交真正会带上的那一份",不是磁盘巧合)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  main as runScan,
  loadContractFile,
  unknownContractTargets,
  panelVerdictOf,
  CONTRACT_FILE_REL,
  headScannableRels,
  scanTexts,
  flatten,
  isInUsedNamespace,
  contractEntriesFor,
  verifyContractEntries,
} from './_i18n-scan-helpers.mjs'
// 判定面取材的唯一出口。本入口自己就要用 `catBatch` 读契约(--staged 档)与 `readWorktreeFile`
// 的语义由 helpers 承担;守门 118 只认"真的调用层读取入口"的文件为 face,故读取写在这里。
import { Undetermined, catBatch, catBatchOids, selectFace, FACE_LABEL } from './lib/face-reader.mjs'
import { deltaParents } from './lib/merge-delta.mjs'

// ROOT 由脚本自身位置推导(§15 / 守门 70 同口径):不再以 process.cwd() 定根,
// 免得"扫哪棵树"跟着调用者站哪儿走。`--root <dir>` 是显式测试/夹具通道(生产不带)。
const rootArgValue = (() => {
  const i = process.argv.indexOf('--root')
  const v = i >= 0 ? process.argv[i + 1] : null
  return v && !v.startsWith('-') ? v : null
})()
const ROOT = rootArgValue
  ? path.resolve(rootArgValue)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

import { TARGETS } from './lib/i18n-scan-targets.mjs'

const TODAY = new Date().toISOString().slice(0, 10)

function parseArgs(argv) {
  const args = {
    dryRun: false,
    exitOnDead: false,
    out: null,
    help: false,
    target: 'web',
    staged: false,
    worktree: false,
    baseline: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    // --check: 烟测模式(= --dry-run),验证脚本能跑,不写报告,exit 0(除非真实错误如 messages 损坏)
    if (a === '--dry-run' || a === '--check') args.dryRun = true
    else if (a === '--exit') {
      args.exitOnDead = argv[++i] === '1'
    } else if (a === '--out') args.out = argv[++i]
    else if (a === '--baseline') args.baseline = argv[++i]
    else if (a === '--staged') args.staged = true
    else if (a === '--worktree') args.worktree = true
    else if (a === '--root')
      i += 1 // 已在模块顶层解析(--root 必须带值,值不参与其余解析)
    else if (a === '--target' || a.startsWith('--target=')) {
      // 同时支持 --target web(空格)和 --target=web(等号)两种形式
      const t = a.startsWith('--target=') ? a.slice('--target='.length) : argv[++i]
      // 'all' 是本轮补的:CI 与 check:all 原先只跑 web 一端 ⇒ 其余四端的红点无人执行
      // (实测 cli 的 76 枚 waiting.* 幻影死键恒红数日无人在意,正因没有一道入口跑它)。
      if (t !== 'all' && !TARGETS[t]) {
        console.error(
          `[scan-dead-i18n-keys] 错误:未知 target '${t}',支持: all, ${Object.keys(TARGETS).join(', ')}`,
        )
        process.exit(1)
      }
      args.target = t
    } else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

function printHelp() {
  console.log(`scan-dead-i18n-keys.mjs — i18n 死 key 审计器(统一入口,5 端收敛)

用法:
  node scripts/scan-dead-i18n-keys.mjs                              # 默认 target=web,判定面=HEAD blob
  node scripts/scan-dead-i18n-keys.mjs --staged --exit 1            # 提交链门禁档:判索引 blob(pre-commit 用)
  node scripts/scan-dead-i18n-keys.mjs --target all --exit 1        # 一次跑完所有有 JS 扫描面的端(推荐入口)
  node scripts/scan-dead-i18n-keys.mjs --target miniapp-taro        # 指定目标端
  node scripts/scan-dead-i18n-keys.mjs --target web --check         # 烟测模式(= --dry-run,不写报告)
  node scripts/scan-dead-i18n-keys.mjs --target web --dry-run       # 只打印统计
  node scripts/scan-dead-i18n-keys.mjs --out <path>                 # 自定义输出路径
  node scripts/scan-dead-i18n-keys.mjs --exit 1                     # 发现死 key 则 exit 1
  node scripts/scan-dead-i18n-keys.mjs --target all --exit 1 \\
    --baseline scripts/data/i18n-dead-key-baseline.json            # 存量棘轮档:只拦超过基线的增量(CI 用)
  node scripts/scan-dead-i18n-keys.mjs --worktree                   # 显式声明磁盘档(人工逃生舱,不作提交门禁)
  node scripts/scan-dead-i18n-keys.mjs --root <dir>                 # 显式仓库根(测试/夹具通道)
  node scripts/scan-dead-i18n-keys.mjs --help                       # 帮助

判定面(2026-09-28 立,2026-10-16 收到 §0.4 三面口径):缺省 ⇒ HEAD blob(git ls-tree -r HEAD 枚举 + 一次
cat-file --batch 读满,清单与内容同面同轮,盘上并行改动不参与判定);--staged ⇒ 索引 blob(提交链门禁);
--worktree ⇒ 工作树磁盘(人工逃生舱)。任何 git 面取不到 ⇒ exit 2 未判定且**不回退磁盘**;两面旗同给 ⇒ exit 2。
退出码:0 通过/跳过;1 --exit 1 下的死 key 或契约声明失效;2 无法判定(未判定,既非通过也非违规)。
逐面板结论(2026-11-01 立):每端 token 形如 「端=ok(死键N)」/「端=exit 1(死键N,基线M)」/
「端=ok(死键N,带--exit1则红)」/「端=ok(跳过:…)」/「端=未判定(exit 2)」,all 档与单档共用同一拼装
实现 —— 死键计数与旗态编进结论本体,不带旗也不得把红端印成裸 ok(旧形态与 all --exit 1 相互矛盾)。

支持 target(5 端):
  web          (默认,代码扫描含 web/miniapp-taro/mobile-rn,因 web i18n 跨端共享)
  cli          (代码扫描 apps/cli/src)
  extension    (代码扫描 apps/extension/{entrypoints,src,lib})
  miniapp-taro (代码扫描仅 apps/miniapp-taro/src)
  mobile-rn    (代码扫描仅 apps/mobile-rn/src)
  desktop      (Rust/Tauri 包装,无 JS 代码,messages 未建立,自动跳过 exit 0)

5 端 thin wrapper(向后兼容,委托本入口 --target=<端>):
  node scripts/scan-web-dead-i18n-keys.mjs          # → --target=web
  node scripts/scan-extension-dead-i18n-keys.mjs    # → --target=extension
  node scripts/scan-miniapp-taro-dead-i18n-keys.mjs # → --target=miniapp-taro
  node scripts/scan-mobile-rn-dead-i18n-keys.mjs    # → --target=mobile-rn
  node scripts/scan-desktop-dead-i18n-keys.mjs      # → --target=desktop

输出:.ihui-agent/tmp/i18n-dead-keys-${TODAY}-<target>.md(默认,web 无 target 后缀;--staged 档不写报告)
排除:node_modules / .next / dist / __tests__ / *.test.ts(x) / *.spec.ts(x) / .d.ts
契约键:${CONTRACT_FILE_REL}(按 target → key → { reason, evidence[] } 登记,依据逐条按判定面核验:全量档 HEAD / --staged 档索引面)
`)
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

// 存量死键基线(2026-10-31,AGENTS §12e):CI 全量档按此只拦新增;提交链/未传时保持零容忍。
// 取不到或形状不合法 ⇒ exit 2 未判定(既不冒绿也不冒红),绝不回落到 0 假装"没有存量"。
let baselineMaxDead = null
if (args.baseline) {
  try {
    const parsed = JSON.parse(readFileSync(path.resolve(ROOT, args.baseline), 'utf8'))
    const map = parsed?.maxDead
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
      throw new Error('缺少 maxDead 对象')
    }
    for (const [k, v] of Object.entries(map)) {
      if (!Number.isInteger(v) || v < 0) throw new Error(`maxDead.${k} 必须是非负整数,实际 ${String(v)}`)
    }
    baselineMaxDead = map
  } catch (e) {
    console.error(
      `[scan-dead-i18n-keys] --baseline 取不到或形状不合法:${e?.message ?? e} ⇒ 未判定(exit 2)`,
    )
    process.exit(2)
  }
}

// 判定面选择(与守门 70/103/118 同一条 selectFace:两面旗同给 = 自相矛盾,判死不取任何一面)
const facePick = selectFace({ staged: args.staged, worktree: args.worktree, def: 'head' })
if (facePick.error) {
  console.error(`[scan-dead-i18n-keys] 无法判定(exit 2,未判定): ${facePick.error}`)
  process.exit(2)
}
const FACE = facePick.face

// 契约声明的 target 名必须真存在:拼错的端名不会被任何一次判定读到,
// 等于把一枚没有读者的豁免永久留在清单里(与守门 90「豁免项若已不存在同样算红」同取向)。
// 预读一次、按判定面取材(与语料同面;逐端循环不再各读一遍 —— 清单与内容同面同轮)。
let contractRaw = null
try {
  if (FACE === 'worktree') {
    contractRaw = loadContractFile(ROOT).raw
  } else {
    const spec = `${FACE === 'staged' ? ':' : 'HEAD:'}${CONTRACT_FILE_REL}`
    const got = catBatch(ROOT, [spec], { maxBuffer: 1 << 29, timeout: 120000 })
    const text = got.get(spec)
    // null = 被审面上确实没有这份声明(与磁盘档"文件不存在 = 没有声明"同一语义);
    // git 派生失败走下面的 catch ⇒ exit 2,两者不混。
    contractRaw = typeof text === 'string' ? JSON.parse(text) : null
  }
} catch (e) {
  if (e instanceof Undetermined) {
    console.error(
      `[scan-dead-i18n-keys] 无法判定(exit 2,未判定): 契约声明在判定面取不到:**不回退磁盘**,${e.message}`,
    )
    process.exit(2)
  }
  throw e
}
const bogusContractTargets = unknownContractTargets(contractRaw, Object.keys(TARGETS))
if (bogusContractTargets.length > 0) {
  console.error(
    `[scan-dead-i18n-keys] ❌ ${CONTRACT_FILE_REL} 登记了未知 target:${bogusContractTargets.join(', ')}` +
      `(可用:${Object.keys(TARGETS).join(', ')})`,
  )
  process.exit(1)
}

const names =
  args.target === 'all'
    ? Object.keys(TARGETS).filter((n) => TARGETS[n].scanTargets.length > 0)
    : [args.target]

if (args.target === 'all' && args.out) {
  console.log('[scan-dead-i18n-keys] --target all 下忽略 --out(各端各写自己的报告,否则会互相覆盖)')
}
/**
 * 合并面归因:某一枚父提交上,**本面死键集里的这些键**是否已经死在该父。
 *
 * 只读「父面与索引面 blob 不同」的文件:同 blob 的文件在父面对每条 key 的静态引用
 * 贡献与结果面逐字相同;而 resultDead 里的键在结果面没有任何静态引用 ⇒ 同 blob 文件
 * 在父面也不会引用它。于是"父面无引用"只需从变更文件判定,不必重扫整棵树。
 * 语言包与契约声明(含依据文件)照读,与结果面同一套 `verifyContractEntries`。
 * 任何一个面读不到 ⇒ 抛 Undetermined,调用方 exit 2;绝不折成空集。
 */
function parentDeadKeys({ rev, name, targetCfg, resultDead }) {
  const rels = headScannableRels(ROOT, targetCfg.scanTargets, rev)
  const pSpecs = rels.map((r) => `${rev}:${r}`)
  const iSpecs = rels.map((r) => `:${r}`)
  const pOids = catBatchOids(ROOT, pSpecs)
  const iOids = catBatchOids(ROOT, iSpecs)
  const changed = []
  for (let i = 0; i < rels.length; i++) {
    const po = pOids.get(pSpecs[i])
    if (!po) throw new Undetermined(`父面 ${rev} 的 ${rels[i]} blob 取不到`)
    if (String(po).toLowerCase() !== String(iOids.get(iSpecs[i]) ?? '').toLowerCase()) changed.push(rels[i])
  }
  let scan = { staticRefs: new Set(), usedNamespaces: new Set() }
  if (changed.length > 0) {
    const got = catBatch(ROOT, changed.map((r) => `${rev}:${r}`), {
      maxBuffer: 1 << 29,
      timeout: 120000,
    })
    const items = []
    for (const r of changed) {
      const t = got.get(`${rev}:${r}`)
      if (typeof t !== 'string') throw new Undetermined(`父面 ${rev} 的 ${r} 正文取不到`)
      items.push({ rel: r, text: t })
    }
    scan = scanTexts(items)
  }
  let leafKeys = new Set()
  const zhSpec = `${rev}:${targetCfg.localeDir}/zh-CN.json`
  const zh = catBatch(ROOT, [zhSpec], { maxBuffer: 1 << 28, timeout: 120000 }).get(zhSpec)
  if (typeof zh === 'string') {
    try {
      leafKeys = flatten(JSON.parse(zh))
    } catch (e) {
      throw new Undetermined(`父面 ${rev} 的语言包损坏:${String(e?.message ?? e).split('\n')[0]}`)
    }
  }
  const dead = new Set()
  for (const k of resultDead) {
    if (leafKeys.has(k) && !scan.staticRefs.has(k) && !isInUsedNamespace(k, scan.usedNamespaces))
      dead.add(k)
  }
  if (dead.size > 0) {
    const cSpec = `${rev}:${CONTRACT_FILE_REL}`
    let cRaw = null
    const cText = catBatch(ROOT, [cSpec], { maxBuffer: 1 << 28, timeout: 120000 }).get(cSpec)
    if (typeof cText === 'string') {
      try {
        cRaw = JSON.parse(cText)
      } catch (e) {
        throw new Undetermined(`父面 ${rev} 的契约声明损坏:${String(e?.message ?? e).split('\n')[0]}`)
      }
    }
    const { entries } = contractEntriesFor(cRaw, name)
    if (entries.size > 0) {
      const evRels = new Set()
      for (const decl of entries.values()) for (const ev of decl.evidence) evRels.add(ev.file)
      const specs = [...evRels].map((r) => `${rev}:${r}`)
      const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: 120000 })
      const { exempted } = verifyContractEntries({
        entries,
        leafKeys,
        deadKeys: dead,
        readHead: (rel) => got.get(`${rev}:${rel}`) ?? null,
        target: name,
        faceLabel: `提交 ${rev}`,
      })
      for (const e of exempted) dead.delete(e.key)
    }
  }
  return dead
}

// 合并未收口时(staged 面有 MERGE_HEAD),死键的锚点必须是**每一枚父提交**:
// 上游带进来的死键不是本次新增;两父都不存在的才是。非合并提交父集只有 HEAD,
// 走原档(判总死键数 vs 基线),行为一字不改。
let mergeParents = []
if (FACE === 'staged') {
  try {
    mergeParents = deltaParents({ root: ROOT, face: 'staged' }).parents.filter(
      (p) => p.label !== 'HEAD',
    )
  } catch (e) {
    console.error(
      `[scan-dead-i18n-keys] 无法判定(exit 2,未判定): 父提交取不到:**不折成空集**,${e?.message ?? e}`,
    )
    process.exit(2)
  }
}

const skipped = Object.keys(TARGETS).filter((n) => TARGETS[n].scanTargets.length === 0)
let worst = 0
const verdicts = []
for (const n of names) {
  const targetCfg = TARGETS[n]
  const outputPattern =
    n === 'web'
      ? `.ihui-agent/tmp/i18n-dead-keys-${TODAY}.md`
      : `.ihui-agent/tmp/i18n-dead-keys-${TODAY}-${n}.md`
  // 判定凭据逐面板独立(一枚对象一端一份,不复用 —— 复用就是本次缺陷的同型隐患)。
  const report = {}
  const merged = mergeParents.length > 0
  let code = runScan({
    name: n,
    messagesPath: `${targetCfg.localeDir}/zh-CN.json`,
    scanTargets: targetCfg.scanTargets,
    outputPattern,
    dryRun: args.dryRun,
    exitOnDead: merged ? false : args.exitOnDead,
    maxDead: baselineMaxDead?.[n] ?? 0,
    out: args.target === 'all' ? null : args.out,
    scriptName: 'scan-dead-i18n-keys',
    face: FACE,
    root: ROOT,
    contractPreload: contractRaw,
    report,
  })
  // 合并面:死键读数里"两父都已死"的部分归因给父提交,只有两父都不存在的才记本次新增。
  // 判据只在新增集上算,基线/threshold 规则不动(maxDead 仍是每端原值)。
  if (merged && code !== 2 && typeof report.deadCount === 'number') {
    const resultDead = report.deadKeys ?? []
    const inherited = new Set()
    try {
      for (const p of mergeParents) {
        const s = parentDeadKeys({ rev: p.rev, name: n, targetCfg, resultDead })
        for (const k of s) inherited.add(k)
      }
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      console.error(`[scan-dead-i18n-keys] ${n} 无法判定(exit 2,未判定): 父面死键取不到:${e.message}`)
      verdicts.push(panelVerdictOf(n, 2, report))
      worst = Math.max(worst, 2)
      continue
    }
    const newDead = resultDead.filter((k) => !inherited.has(k))
    report.inheritedDead = resultDead.length - newDead.length
    report.newDead = newDead.length
    // 结论行按"本次新增"而不是总死键数着色:带 --exit 1 时只有新增才红。
    report.exitOnDead = args.exitOnDead && newDead.length > (baselineMaxDead?.[n] ?? 0)
    const maxDead = baselineMaxDead?.[n] ?? 0
    console.log(
      `[scan-dead-i18n-keys] ${n}:合并面死键 ${resultDead.length} · 归因父提交 ${report.inheritedDead} · 本次新增 ${newDead.length}`,
    )
    if (args.exitOnDead && newDead.length > maxDead) {
      code = 1
      console.error(
        `[scan-dead-i18n-keys] ❌ ${n} 本次新增死 key ${newDead.length} 枚(基线 ${maxDead};已归因父提交 ${report.inheritedDead} 枚):`,
      )
      for (const k of newDead) console.error(`  - ${k}`)
    }
  }
  // 结论拼装只有一份实现(panelVerdictOf,住在公共层):all 档与单档共用,同码同面同输入
  // 必然逐字同值。旧写法 `code===0?'ok':...` 把"死键 43 但没带 --exit 1"印成 `ok`,
  // 与 all --exit 1 的 `exit 1` 互相矛盾(2026-11-01 实测:单档不带旗 = 缺陷本体)。
  verdicts.push(panelVerdictOf(n, code, report))
  // 取最大值而不是"最后一次不等就覆盖":否则前一端 exit 1、后端 exit 0 会把红点吞成绿。
  // 2(未判定)> 1(死 key):任何一端取材失败都拒绝出具"全部已判"合格证,由末行如实点名。
  worst = Math.max(worst, code)
}
// 末行只有一条拼装路径:all 与单端共用同一份逐面板 verdicts 串(旧写法两条分支文案不同形,
// "判定面"后缀只在单端档出现,拿 all 的末行和单档末行并排比必然对不上 —— 同族缺陷第二格)。
console.log(
  `[scan-dead-i18n-keys] ${args.target} → ${verdicts.join(' ')}(判定面:${FACE_LABEL[FACE]})`,
)
if (args.target === 'all' && skipped.length)
  console.log(`[scan-dead-i18n-keys] 无 JS 扫描面,未计入:${skipped.join(', ')}`)
process.exit(worst)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
