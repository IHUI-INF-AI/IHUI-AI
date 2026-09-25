#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:产物预算门 A8(2026-09-25 立,规格 .ihui-agent/tmp/zcode-absorb/MECHANISM-SPEC-3.md §1)
 *
 * 全仓 130+ 道门里**没有一道量过我们真正交付出去的产物**。唯一量尺寸的地方是
 * `scripts/release-desktop-local.mjs:93`,打印完继续发布 —— 无上限、无退出码。
 * 于是"小程序主包 2,054,751 B / 上限 2,097,152 B,余量 42,401 B(≈2%)"这个数一直是
 * 人工算在计划文档里的:一次无关的 UI 提交就能吃掉那 42KB 而全程绿灯
 * (`pnpm --filter @ihui/miniapp-taro build` exit 0 也照样过,直到上传微信才炸)。
 * 本票是 AGENTS 末段 O62附 那句"同源对账门全部只核源码，没有一道看产物"的可执行出口。
 *
 * 判据:
 *   AB1 尺寸预算 —— 一张 BUDGET 表(键=target,值=上限字节 + 告警水位)。
 *       miniapp 档按微信**主包**口径累加:分包(root 及其**嵌套**子路径)与
 *       plugin/plugin-private **不计入主包数**,单列并如实打印。累加范围错一位
 *       就会把 42KB 的余量报成 800KB(或反向),所以口径由 classifyEntry() 单点决定。
 *   AB2 悬空 map 引用 —— 只拦"`//# sourceMappingURL=` 在而目标 .map 不在"的半成品态。
 *       **刻意不是**"清除 sourcemap":规格已实测我方 `sourcesContent` 命中 0、
 *       web 侧 `productionBrowserSourceMaps:false`,把"清除"立成判据主体会造一台
 *       在完好仓库上无事可判的门。
 *
 * 退出码按**机器态 vs 内容态**三态分流(与守门 104 同一取向,不得回退):
 *   0 = 产物在预算内,**或**产物根本不在磁盘上(未判定 —— 逐条喊出原因与构建命令,绝不静默记绿)
 *   1 = 内容态缺陷:超硬上限 / 破告警水位 / 命中已启用的 AB2 判据
 *   2 = 无法判定:未知 --target(不得回落默认档)/ 主包清单读不出 —— 既不冒红也不记绿
 *
 * ⚠ 为什么产物缺失必须是 0 而不是 1:本门判的是**磁盘上的构建产物**,提交者结构上
 *   无法保证磁盘上有新鲜产物。挂进提交链 blocking 的结果是每一次提交都被拦,而恒红门
 *   的唯一结局是逼人 `--no-verify`,连带把其余 130+ 道守门一起作废(AGENTS §12e)。
 *   ⇒ 定级为**提交链 warn + CI blocking**(CI 上产物必然存在,在 CI 判红才是有效问责)。
 *
 * ⚠ 新鲜度:本门与工作树/HEAD 无关(不适用"判 HEAD blob"那套取材面)。结论行必须
 *   打印产物 mtime 与年龄,并明写"这可能是上一次构建的产物",否则会把陈旧产物当本次交付。
 *   全程只读,**不 acquire 构建锁**(scripts/deploy-lock.mjs),也不为取数触发构建。
 *
 * 用法:
 *   node scripts/check-artifact-budget.mjs --target miniapp [--artifact <path>] [--json]
 *   node scripts/check-artifact-budget.mjs --self-test
 * 接线(由主会话统一做):guardian-runner(warn)+ 根 package.json `check:artifact-budget`
 *   + CI build 之后一步(blocking)。紧急跳过 HUSKY_SKIP_ARTIFACT_BUDGET=1。
 * 镜像测试:node --test scripts/tests/check-artifact-budget.test.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 静态 import(不是 await import):夹具闭包收集器 scripts/lib/scratch-module-closure.mjs 只认
// 顶层 `from './x'` 形态,动态 import 的那一跳**不会被拷进演练仓**,自测就在演练仓里静默失效。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NUM = new Intl.NumberFormat('en-US')

/** 告警水位:到这个比例即判红(CI 侧),给的是"还剩多少余量"而不是只有一个硬崩。 */
const DEFAULT_WARN_PCT = 90

/**
 * 预算表 —— 一处改,判据与打印同时动(不得把上限散进 if)。
 * `limitBytes: null` 的档是**未校准档**:只报数不判红,理由写在 `uncalibratedReason`,
 * 输出与 --json 里都会如实标 `calibrated:false`("判据存在而永不调用 = 没有",
 * 但"判据没校准却冒充红线"同样是假绿 —— 两头都得喊出来)。
 */
const BUDGET = {
  miniapp: {
    label: '微信小程序主包',
    artifactRel: 'apps/miniapp-taro/dist',
    // 微信侧硬限制,不是我们定的:主包 2 MiB。
    limitBytes: 2_097_152,
    warnPct: DEFAULT_WARN_PCT,
    mainPackageScoped: true,
    ab2Judged: true,
    buildHint: 'pnpm --filter @ihui/miniapp-taro build',
    basis: '微信平台硬上限 2,097,152 B(2 MiB)',
  },
  'desktop-installer': {
    label: '桌面端 NSIS 安装包',
    artifactRel: 'apps/desktop/src-tauri/target/release/bundle/nsis',
    // 依据:薄壳安装包实测 6,147,635 / 6,169,910 / 6,171,153 B(PROJECT_PLAN 三次记录),
    // 上限取约 2x 头部余量 —— 一旦"资产又塞回壳里"就是量级跳变,本档要抓的就是那一跳。
    limitBytes: 12 * 1024 * 1024,
    warnPct: 85,
    mainPackageScoped: false,
    ab2Judged: true,
    buildHint: 'pnpm --filter @ihui/desktop tauri build(需 ~/.tauri 更新签名密钥)',
    basis: '实测 ~6.17 MB 薄壳包,取 2x 余量;非平台硬限',
  },
  'web-static': {
    label: 'web 静态导出产物',
    artifactRel: 'apps/web/out',
    limitBytes: null,
    warnPct: DEFAULT_WARN_PCT,
    mainPackageScoped: false,
    ab2Judged: false,
    buildHint: 'pnpm --filter @ihui/web build:static',
    uncalibratedReason:
      '现测 962,226,170 B / 5453 文件(营销站全量静态资产,含图片与 vendor 库),' +
      '无平台侧硬上限可依据 ⇒ 立红线属替人做决策。本档只报数,校准需先定' +
      '"哪些目录算交付面"并清掉 vendor 里的 2 处悬空 map 引用。',
  },
  extension: {
    label: '浏览器扩展产物',
    artifactRel: 'apps/extension/.output/chrome-mv3',
    limitBytes: null,
    warnPct: DEFAULT_WARN_PCT,
    mainPackageScoped: false,
    ab2Judged: false,
    buildHint: 'pnpm --filter @ihui/extension build',
    uncalibratedReason:
      '现测 4,168,785 B;Chrome 商店 128 MB 是**受理**上限而非尺寸判据,' +
      '与该量级差 30 倍 ⇒ 按它判红等于不判。待有真实交付约束再校准。',
  },
}

const TARGET_NAMES = Object.keys(BUDGET)

class UnknownTargetError extends Error {}
class UndeterminedError extends Error {}

/** 未知/缺失 target 一律抛,绝不回落默认档(本仓刚在 sync-lost-commit-tags 上被静默兜底咬过)。 */
function resolveTarget(name) {
  if (typeof name !== 'string' || name === '') {
    throw new UnknownTargetError(`缺少 --target;可选:${TARGET_NAMES.join(' | ')}`)
  }
  if (!Object.hasOwn(BUDGET, name)) {
    throw new UnknownTargetError(
      `未知 --target "${name}";可选:${TARGET_NAMES.join(' | ')}(不得回落默认档)`,
    )
  }
  return BUDGET[name]
}

/** 统一成 POSIX 风格的仓库相对路径,分包口径全靠它。 */
function toPosix(rel) {
  return rel.split(sep).join('/')
}

function isUnder(rel, root) {
  return rel === root || rel.startsWith(`${root}/`)
}

/**
 * 主包口径的唯一判点。微信"主包"**不含**分包与独立分包,也不含 plugin 目录;
 * 而本仓分包 root 有 `pages/member` 这类**嵌套**形态,只按顶层目录名排除就会把
 * 分包体积算进主包(反之把分包读成主包则余量报大 —— 两个方向都是假结论)。
 */
function classifyEntry(relPosix, subRoots) {
  for (const s of subRoots) {
    if (isUnder(relPosix, s.root))
      return { bucket: s.independent ? 'independent' : 'sub', root: s.root }
  }
  for (const p of ['plugin', 'plugin-private']) {
    if (isUnder(relPosix, p)) return { bucket: 'plugin', root: p }
  }
  return { bucket: 'main', root: null }
}

/**
 * 从**产物自身**的 app.json 读分包清单(不是从 src 配置读 —— 本门审的是交付物,
 * 源码里改了没构建出来不算)。两种键名都要认:Taro/微信在两处都写过。
 */
function parseSubPackageRoots(appJsonText) {
  let json
  try {
    json = JSON.parse(appJsonText)
  } catch (e) {
    throw new UndeterminedError(`app.json 解析失败:${e?.message ?? e}`)
  }
  const raw = json.subpackages ?? json.subPackages
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new UndeterminedError('app.json 的 subpackages 不是数组')
  return raw.map((item, i) => {
    if (!item || typeof item.root !== 'string' || item.root === '') {
      throw new UndeterminedError(`app.json subpackages[${i}] 缺 root 字段`)
    }
    return { root: item.root.replace(/^\/+|\/+$/g, ''), independent: item.independent === true }
  })
}

/** 递归量磁盘。遇重解析点**不跟随**(§26:穿透会把别人的体积报成本产物的债)。 */
function walkArtifactDir(dir, base = dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue
    const abs = join(dir, ent.name)
    if (ent.isDirectory()) walkArtifactDir(abs, base, out)
    else if (ent.isFile()) out.push({ rel: toPosix(relative(base, abs)), abs })
  }
  return out
}

/** 纯函数:给定 (rel,size,mtime) 列表 + 分包清单,算出各桶与主包数。 */
function accumulateBuckets(entries, subRoots, scoped) {
  const buckets = {
    main: { bytes: 0, files: 0 },
    sub: {},
    independent: {},
    plugin: { bytes: 0, files: 0 },
  }
  let total = { bytes: 0, files: 0, newestMtimeMs: 0 }
  for (const e of entries) {
    total = {
      bytes: total.bytes + e.size,
      files: total.files + 1,
      newestMtimeMs: Math.max(total.newestMtimeMs, e.mtimeMs),
    }
    const { bucket, root } = scoped
      ? classifyEntry(e.rel, subRoots)
      : { bucket: 'main', root: null }
    if (bucket === 'main') {
      buckets.main.bytes += e.size
      buckets.main.files += 1
    } else if (bucket === 'plugin') {
      buckets.plugin.bytes += e.size
      buckets.plugin.files += 1
    } else {
      const k = root
      const cur = buckets[bucket][k] ?? { bytes: 0, files: 0 }
      buckets[bucket][k] = { bytes: cur.bytes + e.size, files: cur.files + 1 }
    }
  }
  return { buckets, total }
}

/**
 * 纯函数:预算结论。
 * over=破硬上限 / over-water=破告警水位 / ok / uncalibrated=该档不判。
 * 破水位与破上限都算失败(规格验收要求余量只剩 42KB 时即判红),但文案必须分得清,
 * 否则读的人以为已经上传不了 —— 那是两回事。
 */
function judgeBudget(measuredBytes, limitBytes, warnPct) {
  if (limitBytes === null || limitBytes === undefined) {
    return { status: 'uncalibrated', usedPct: null, marginBytes: null }
  }
  const usedPct = Number(((measuredBytes / limitBytes) * 100).toFixed(2))
  const marginBytes = limitBytes - measuredBytes
  if (measuredBytes > limitBytes) return { status: 'over', usedPct, marginBytes }
  if (measuredBytes >= (limitBytes * warnPct) / 100)
    return { status: 'over-water', usedPct, marginBytes }
  return { status: 'ok', usedPct, marginBytes }
}

/** 纯函数:AB2 —— 只找"引用在、目标不在"。注入 IO,便于不碰磁盘就自证。 */
function findDanglingSourceMaps({ scriptFiles, readText, existsSibling }) {
  const dangling = []
  let resolved = 0
  let remote = 0
  for (const file of scriptFiles) {
    let text
    try {
      text = readText(file)
    } catch {
      continue
    }
    for (const m of text.matchAll(/[#@]\s*sourceMappingURL=([^\s'"?#]+)/g)) {
      const url = m[1]
      if (/^(https?:|data:|webpack-internal:)/.test(url)) {
        remote += 1
        continue
      }
      if (existsSibling(file, url)) resolved += 1
      else dangling.push({ file, url })
    }
  }
  return { dangling, resolved, remote }
}

const SOURCE_LIKE = /\.(js|cjs|mjs|css)$/
const MAX_SCAN_BYTES = 5 * 1024 * 1024

function measureAb2(artifactDir, entries) {
  const scanned = []
  let skipped = 0
  for (const e of entries) {
    if (!SOURCE_LIKE.test(e.rel)) continue
    let size = 0
    try {
      size = statSync(e.abs).size
    } catch {
      skipped += 1
      continue
    }
    if (size > MAX_SCAN_BYTES) {
      skipped += 1
      continue
    }
    scanned.push(e.rel)
  }
  const byRel = new Map(entries.map((e) => [e.rel, e]))
  const r = findDanglingSourceMaps({
    scriptFiles: scanned,
    readText: (rel) => readFileSync(byRel.get(rel).abs, 'utf8'),
    existsSibling: (rel, url) => existsSync(resolve(dirname(byRel.get(rel).abs), url)),
  })
  return { ...r, scanned: scanned.length, skippedLargeOrUnreadable: skipped }
}

function fmtBytes(n) {
  return `${NUM.format(n)} B`
}

function isoLocal(ms) {
  const d = new Date(ms)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 主判定。返回结论对象;退出码由 decideExit() 单独算(便于自测直接喂构造输入)。 */
function evaluate({ target, artifactPath }) {
  const spec = resolveTarget(target)
  const dir = resolve(ROOT, artifactPath ?? spec.artifactRel)
  const base = {
    target,
    label: spec.label,
    artifact: artifactPath ?? spec.artifactRel,
    artifactAbs: dir,
    limitBytes: spec.limitBytes,
    warnPct: spec.warnPct,
    calibrated: spec.limitBytes !== null && spec.limitBytes !== undefined,
    buildHint: spec.buildHint,
    basis: spec.basis ?? null,
    uncalibratedReason: spec.uncalibratedReason ?? null,
    scoped: spec.mainPackageScoped,
  }

  // —— 机器态:产物根本不在磁盘上 ⇒ 未判定,exit 0,但原因必须喊出来 ——
  if (!existsSync(dir)) {
    return {
      ...base,
      exists: false,
      undetermined: true,
      undeterminedKind: 'machine-state',
      reason: `产物目录不存在:${base.artifact}`,
      action: `先跑 \`${spec.buildHint}\` 再来量本门`,
    }
  }

  let entries
  try {
    entries = walkArtifactDir(dir)
  } catch (e) {
    throw new UndeterminedError(`读取产物目录失败(${dir}):${e?.message ?? e}`)
  }
  if (entries.length === 0) {
    return {
      ...base,
      exists: true,
      undetermined: true,
      undeterminedKind: 'machine-state',
      reason: '产物目录为空(构建未产出任何文件)',
      action: `先跑 \`${spec.buildHint}\``,
    }
  }

  let subRoots = []
  if (spec.mainPackageScoped) {
    const appJson = join(dir, 'app.json')
    if (!existsSync(appJson)) {
      throw new UndeterminedError(
        `主包口径要求 ${base.artifact}/app.json(分包清单的唯一真相),它不在 —— 没有它就分不清主包与分包,` +
          '只能猜,而猜错的口径比不判更坏(会把 42KB 报成 800KB,或反向)',
      )
    }
    subRoots = parseSubPackageRoots(readFileSync(appJson, 'utf8'))
  }

  const { buckets, total } = accumulateBuckets(
    entries
      .map((e) => {
        let st
        try {
          st = statSync(e.abs)
        } catch {
          return null
        }
        return { rel: e.rel, size: st.size, mtimeMs: st.mtimeMs }
      })
      .filter(Boolean),
    subRoots,
    spec.mainPackageScoped,
  )
  const measuredBytes = spec.mainPackageScoped ? buckets.main.bytes : total.bytes
  const verdict = judgeBudget(measuredBytes, spec.limitBytes, spec.warnPct)
  const ab2 = measureAb2(dir, entries)
  const ab2Fail = spec.ab2Judged && ab2.dangling.length > 0

  return {
    ...base,
    exists: true,
    undetermined: false,
    fileCount: total.files,
    newestMtimeMs: total.newestMtimeMs,
    newestMtime: isoLocal(total.newestMtimeMs),
    ageHours: Number(((Date.now() - total.newestMtimeMs) / 3_600_000).toFixed(1)),
    measuredBytes,
    totalBytes: total.bytes,
    ...verdict,
    subPackageRoots: subRoots.map((s) => s.root),
    buckets: spec.mainPackageScoped ? buckets : undefined,
    ab2: { ...ab2, judged: spec.ab2Judged },
    ab2Fail,
    fail: verdict.status === 'over' || verdict.status === 'over-water' || ab2Fail,
  }
}

function decideExit(r) {
  if (r.undetermined) return 0
  return r.fail ? 1 : 0
}

function printHuman(r) {
  console.log(`\n产物预算门 · target=${r.target}(${r.label})`)
  console.log(`  落点: ${r.artifact}`)
  if (r.undetermined) {
    console.log(`  未判定:${r.reason}`)
    console.log(`  下一步:${r.action}`)
    console.log(
      '  说明:本门按磁盘产物判,"产物不在"属机器态而非内容缺陷 ⇒ exit 0,不冒红也不静默记绿。',
    )
    return
  }
  console.log(
    `  产物最新 mtime: ${r.newestMtime}(距今 ${r.ageHours} 小时)—— ⚠ 本门判磁盘产物,与工作树/HEAD 无关,` +
      '这可能是上一次构建的产物。',
  )
  console.log(`  文件数: ${NUM.format(r.fileCount)}`)
  if (r.scoped) {
    console.log(
      `  主包口径: 已按 app.json 排除 ${r.subPackageRoots.length} 个分包 root(嵌套 root 同样排除)`,
    )
  }
  const head = r.calibrated
    ? `  AB1 尺寸: ${r.scoped ? '主包' : '产物'} 实测 ${fmtBytes(r.measuredBytes)} / 上限 ${fmtBytes(r.limitBytes)} / 余量 ${fmtBytes(r.marginBytes)}(已用 ${r.usedPct}%,告警水位 ${r.warnPct}%)`
    : `  AB1 尺寸: 实测 ${fmtBytes(r.measuredBytes)} —— 该档未校准,只报数不判红`
  console.log(head)
  if (!r.calibrated && r.uncalibratedReason) console.log(`     未校准依据: ${r.uncalibratedReason}`)
  if (r.calibrated && r.basis) console.log(`     上限依据: ${r.basis}`)
  if (r.scoped && r.buckets) {
    const sub = Object.entries(r.buckets.sub)
    const ind = Object.entries(r.buckets.independent)
    console.log(
      `  合计 ${fmtBytes(r.totalBytes)} = 主包 ${fmtBytes(r.buckets.main.bytes)}` +
        ` + 分包 ${fmtBytes(sub.reduce((a, [, v]) => a + v.bytes, 0))}` +
        ` + 独立分包 ${fmtBytes(ind.reduce((a, [, v]) => a + v.bytes, 0))}` +
        ` + plugin ${fmtBytes(r.buckets.plugin.bytes)}`,
    )
    for (const [k, v] of [...sub, ...ind.map(([k2, v2]) => [`(独立)${k2}`, v2])]) {
      console.log(`     - ${k}: ${fmtBytes(v.bytes)} / ${v.files} 文件`)
    }
  }
  const ab2line =
    `  AB2 悬空 map 引用: ${r.ab2.dangling.length} 处(扫 ${r.ab2.scanned} 个 .js/.cjs/.mjs/.css,` +
    `已随产物带出 ${r.ab2.resolved} 处,外链 ${r.ab2.remote} 处,跳过大文件/不可读 ${r.ab2.skippedLargeOrUnreadable} 个)`
  console.log(ab2line)
  for (const d of r.ab2.dangling.slice(0, 10)) console.log(`     - ${d.file} -> ${d.url}`)
  if (r.ab2.dangling.length > 10) console.log(`     … 另有 ${r.ab2.dangling.length - 10} 处`)
  if (!r.ab2.judged && r.ab2.dangling.length > 0) {
    console.log(
      '     本档 AB2 未启用判红(立门批次只覆盖 miniapp + desktop-installer),以上仅如实计数。',
    )
  }
  const verdictText = {
    ok: '✅ 结论:在预算内',
    'over-water': `⛔ 结论:破告警水位(${r.warnPct}%)—— 尚未超硬上限,但余量只剩 ${fmtBytes(r.marginBytes)}`,
    over: `⛔ 结论:超硬上限 ${fmtBytes(-r.marginBytes)}`,
    uncalibrated: r.ab2Fail
      ? '⛔ 结论:尺寸未校准(不计),命中 AB2 悬空 map 引用'
      : 'ℹ️ 结论:尺寸未校准档,只报数',
  }[r.status]
  console.log(verdictText)
}

function parseArgs(argv) {
  const out = { target: null, artifact: null, json: false, selfTest: false, staged: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--target') out.target = argv[++i] ?? ''
    else if (a.startsWith('--target=')) out.target = a.slice('--target='.length)
    else if (a === '--artifact') out.artifact = argv[++i] ?? ''
    else if (a.startsWith('--artifact=')) out.artifact = a.slice('--artifact='.length)
    else if (a === '--json') out.json = true
    else if (a === '--self-test') out.selfTest = true
    // 提交链会向每道门自动下发 --staged。本门量的是**磁盘上的构建产物**,与工作树/索引无关,
    // 没有"按暂存收窄"这回事 ⇒ 接受并忽略(口径恒全量),照守门 78 的同款处理。
    // 不接会怎样:抛 UnknownTargetError → exit 2,而它 mode=warn ⇒ 每次提交都计一条"警告",
    // 且这条警告的真实含义是"这道门从没跑起来过",不是"产物有情况"——把不可执行伪装成检测结果,
    // 比恒红更坏(恒红至少逼人去看)。实测登记见 PROJECT_PLAN G-176。
    else if (a === '--staged') out.staged = true
    else throw new UnknownTargetError(`未知参数:${a}`)
  }
  return out
}

// ── 自测:纯函数 + 构造面,不碰真仓产物(只能跑一次的取证等于没取证)──────────────
function selfTest() {
  const lines = []
  let fails = 0
  const ck = (name, cond, extra = '') => {
    lines.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ` :: ${extra}` : ''}`)
    if (!cond) fails += 1
  }

  // T1 未知 target 必须抛,不得回落默认档
  try {
    resolveTarget('nope')
    ck('T1a 未知 target 抛错', false)
  } catch (e) {
    ck('T1a 未知 target 抛错', e instanceof UnknownTargetError && /nope/.test(e.message))
  }
  try {
    resolveTarget('')
    ck('T1b 缺 target 抛错', false)
  } catch (e) {
    ck('T1b 缺 target 抛错', e instanceof UnknownTargetError)
  }
  ck(
    'T1c 已知 target 全放行',
    TARGET_NAMES.every((t) => !!resolveTarget(t).label),
  )

  // T2 主包口径:嵌套 root / 独立分包 / plugin 都不得进主包
  const roots = [
    { root: 'pkg-ai', independent: false },
    { root: 'pages/member', independent: false },
    { root: 'pkg-adv', independent: true },
  ]
  const c = (rel) => classifyEntry(rel, roots).bucket
  ck('T2a 顶层分包不计主包', c('pkg-ai/app.js') === 'sub')
  ck('T2b 嵌套分包不计主包', c('pages/member/index.js') === 'sub')
  ck('T2c 独立分包单列而非主包', c('pkg-adv/a.js') === 'independent')
  ck('T2d plugin 目录不计主包', c('plugin/index.js') === 'plugin')
  ck('T2e 主包页仍计主包', c('pages/index/index.js') === 'main')
  ck(
    'T2f root 同名前缀不得误判',
    c('pkg-ai-x/a.js') === 'main' && c('pages/members/a.js') === 'main',
  )

  // T3 分包清单解析:两种键名 + 缺 root 判"无法判定"
  ck(
    'T3a 小写 subpackages 可解析',
    JSON.stringify(parseSubPackageRoots('{"subpackages":[{"root":"pkg-ai/"}]}')) ===
      '[{"root":"pkg-ai","independent":false}]',
  )
  ck(
    'T3b 大写 subPackages 可解析',
    parseSubPackageRoots('{"subPackages":[{"root":"a"}]}')[0].root === 'a',
  )
  ck('T3c 无分包字段=空清单(全算主包)', parseSubPackageRoots('{"pages":[]}').length === 0)
  try {
    parseSubPackageRoots('{"subpackages":[{"pages":[]}]}')
    ck('T3d 缺 root 判无法判定', false)
  } catch (e) {
    ck('T3d 缺 root 判无法判定', e instanceof UndeterminedError)
  }
  try {
    parseSubPackageRoots('{oops')
    ck('T3e 坏 JSON 判无法判定', false)
  } catch (e) {
    ck('T3e 坏 JSON 判无法判定', e instanceof UndeterminedError)
  }

  // T4 累加:构造面直接钉"分包超大而主包很小 ⇒ 主包数不受影响"
  const made = (rel, size) => ({ rel, size, mtimeMs: 0 })
  const acc = accumulateBuckets(
    [
      made('a.js', 1000),
      made('pkg-ai/huge.js', 900_000),
      made('pkg-adv/x.js', 10),
      made('plugin/p.js', 20),
    ],
    roots,
    true,
  )
  ck('T4a 主包只含主包文件', acc.buckets.main.bytes === 1000, `实得 ${acc.buckets.main.bytes}`)
  ck('T4b 分包体积单列', acc.buckets.sub['pkg-ai'].bytes === 900_000)
  ck('T4c 合计含全部四桶', acc.total.bytes === 901_030, `实得 ${acc.total.bytes}`)
  const accAll = accumulateBuckets([made('a.js', 5), made('pkg-ai/b', 6)], [], false)
  ck('T4d 非分包档按总量', accAll.buckets.main.bytes === 11)

  // T5 预算结论三态(变异自证锚点:把 measured > limit 短路时 T5c 必红)
  ck('T5a 预算内=ok', judgeBudget(100, 1000, 90).status === 'ok')
  ck('T5b 恰到水位=over-water', judgeBudget(900, 1000, 90).status === 'over-water')
  ck(
    'T5c 超上限=over',
    judgeBudget(1001, 1000, 90).status === 'over',
    JSON.stringify(judgeBudget(1001, 1000, 90)),
  )
  ck('T5d 恰好等于上限不算超', judgeBudget(1000, 1000, 90).status === 'over-water')
  ck('T5e 未校准档不判', judgeBudget(9, null, 90).status === 'uncalibrated')
  ck('T5f 未判定退出码 0', decideExit({ undetermined: true, fail: true }) === 0)
  ck('T5g 内容态失败退出码 1', decideExit({ undetermined: false, fail: true }) === 1)

  // T6 AB2 只拦"引用在而目标不在"
  const ab2 = findDanglingSourceMaps({
    scriptFiles: ['a.js', 'b.js', 'c.js', 'd.js'],
    readText: (f) =>
      ({
        'a.js': 'x\n//# sourceMappingURL=a.js.map\n',
        'b.js': '/*# sourceMappingURL=missing.js.map */',
        'c.js': '//# sourceMappingURL=https://cdn/x.js.map',
        'd.js': '//# sourceMappingURL=data:application/json;base64,AA',
      })[f],
    existsSibling: (f, url) => f === 'a.js' && url === 'a.js.map',
  })
  ck('T6a 悬空引用被识别', ab2.dangling.length === 1 && ab2.dangling[0].file === 'b.js')
  ck('T6b 成对存在不计红', ab2.resolved === 1)
  ck('T6c 外链/data URI 不算悬空', ab2.remote === 2)

  // T7 真磁盘端到端:在临时夹具里造一份带分包的产物,量"分包不进主包"。
  // 期望值一律由**写入的字节数**算出,不硬抄 —— 硬抄的常量会在格式化/改文案时
  // 变成一支无牙的红(本门第一版就在这里把 app.json 长度猜成 50B,实为 76B)。
  const scratch = mkScratch('artifact-budget-selftest-')
  try {
    const d = join(scratch, 'dist')
    const appJsonText = JSON.stringify({
      pages: ['pages/index/index'],
      subpackages: [{ root: 'pkg-ai', pages: [] }],
    })
    const subJs = 'y'.repeat(50)
    mkdirSync(join(d, 'pkg-ai'), { recursive: true })
    mkdirSync(join(d, 'pages', 'index'), { recursive: true })
    writeFileSync(join(d, 'app.json'), appJsonText)
    writeFileSync(join(d, 'pages', 'index', 'index.js'), 'x')
    writeFileSync(join(d, 'pkg-ai', 'big.js'), subJs)
    const appJsonBytes = Buffer.byteLength(appJsonText)
    const expectedMain = appJsonBytes + 1 // app.json 自身 + 主包页 1B
    const onDisk = walkArtifactDir(d).map((e) => ({
      rel: e.rel,
      size: statSync(e.abs).size,
      mtimeMs: 0,
    }))
    const scopedMain = accumulateBuckets(
      onDisk,
      parseSubPackageRoots(readFileSync(join(d, 'app.json'), 'utf8')),
      true,
    )
    ck(
      'T7a 真磁盘夹具:分包 50B 不进主包',
      scopedMain.buckets.main.bytes === expectedMain,
      `实得 ${scopedMain.buckets.main.bytes} / 期望 ${expectedMain}`,
    )
    ck(
      'T7b 真磁盘夹具:分包单独成桶',
      scopedMain.buckets.sub['pkg-ai'].bytes === Buffer.byteLength(subJs),
    )
    ck('T7c 真磁盘夹具:app.json 自身算在主包内', scopedMain.buckets.main.files === 2)
    ck(
      'T7d 真磁盘夹具:合计 = 主包 + 分包(两数都必须出现)',
      scopedMain.total.bytes === expectedMain + Buffer.byteLength(subJs),
    )
  } finally {
    rmScratch(scratch)
  }

  console.log(lines.join('\n'))
  console.log(`产物预算门 --self-test:${lines.length} 条断言,失败 ${fails}`)
  return fails === 0 ? 0 : 1
}

async function main() {
  const argv = parseArgs(process.argv.slice(2))
  if (argv.selfTest) {
    process.exitCode = await selfTest()
    return
  }
  if (process.env.HUSKY_SKIP_ARTIFACT_BUDGET === '1') {
    console.log(
      `⏭  HUSKY_SKIP_ARTIFACT_BUDGET=1 — 跳过产物预算门(${argv.target ?? '未指定 target'})`,
    )
    return
  }
  let result
  try {
    result = evaluate({ target: argv.target, artifactPath: argv.artifact || null })
  } catch (e) {
    if (e instanceof UnknownTargetError) {
      console.error(`⛔ 用法错误:${e.message}`)
      console.error(`   可选 target:${TARGET_NAMES.join(' | ')}`)
      process.exitCode = 2
      return
    }
    if (e instanceof UndeterminedError) {
      console.error(`❓ 无法判定(${argv.target}):${e.message}`)
      console.error('   本门不冒红也不记绿 —— 判据要求的输入取不到时,结论一律"未判定"。')
      process.exitCode = 2
      return
    }
    throw e
  }
  if (argv.json) console.log(JSON.stringify(result, null, 2))
  else printHuman(result)
  process.exitCode = decideExit(result)
}

export const __test__ = {
  BUDGET,
  TARGET_NAMES,
  UnknownTargetError,
  UndeterminedError,
  resolveTarget,
  classifyEntry,
  parseSubPackageRoots,
  accumulateBuckets,
  judgeBudget,
  findDanglingSourceMaps,
  walkArtifactDir,
  evaluate,
  decideExit,
  toPosix,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
