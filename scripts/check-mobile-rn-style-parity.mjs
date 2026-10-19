#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-mobile-rn-style-parity.mjs — mobile-rn 跨端样式一致性守门(2026-09-03 立)。
 *
 * 背景:web/miniapp-taro 与 mobile-rn 必须视觉一致(除平台独占差异)。miniapp-taro 端
 *       已由 check-miniapp-taro-style-parity.mjs 完成 token 化守门,但 mobile-rn 端
 *       存量页(Uniapp 迁移)仍有大量硬编码 hex,导致两端色值分裂。本脚本采用
 *       基线模式:存量硬编码记录在 scripts/rn-style-parity-baseline.json 中放行,
 *       任何新增硬编码 hex 即 BLOCK,推动存量只减不增,最终与小程序端 token 体系对齐。
 *
 * 取材口径(2026-10-16 迁 scripts/lib/face-reader.mjs,与守门 70/77/83/98 同取向):
 *   · 全量 ⇒ HEAD blob(一次 cat-file --batch;HEAD 无此路径才降级工作树);
 *   · `--staged` ⇒ 索引 blob;取不到 ⇒ Undetermined ⇒ exit 2「无法判定」;
 *   · `--worktree` ⇒ 磁盘(人工排查逃生舱,不得作为提交门禁);
 *   此前本门**纯磁盘读**:共享工作树里他人半编辑态的 hex 会直接把门顶红
 *   (2026-10-16 实测 SearchOverlay 工作树红项),而提交进去的其实是索引那一份 ——
 *   "盘上改对不算修好、盘上改坏也不该拦别人",两头都错。
 *
 * 校验内容:
 *   RULE-1 (BLOCK): src/**(ts/tsx)中出现基线之外的新增 #hex 字面量(必须改用
 *                   @ihui/design-tokens 的 rnLightTokens/rnDarkTokens)。
 *   RULE-2 (WARN) : 基线中已不存在的条目(文件已治理,建议 --update-baseline 收紧基线)。
 *
 * 退出码:0 = 全部通过(含 WARN,不阻塞);1 = 出现 BLOCK 级失败(阻塞);2 = 无法判定。
 *
 * 用法:
 *   node scripts/check-mobile-rn-style-parity.mjs                  # 全量(HEAD 档)
 *   node scripts/check-mobile-rn-style-parity.mjs --staged         # 本次暂存(索引档)
 *   node scripts/check-mobile-rn-style-parity.mjs --worktree       # 人工排查(磁盘档)
 *   node scripts/check-mobile-rn-style-parity.mjs --update-baseline # 治理后收紧基线
 *   node scripts/check-mobile-rn-style-parity.mjs --self-test      # 逻辑自检
 *   node scripts/check-mobile-rn-style-parity.mjs --quiet           # 仅输出失败
 *   node scripts/check-mobile-rn-style-parity.mjs --help            # 帮助
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, sep } from 'node:path'
// 取材层的唯一出口(2026-10-16 迁):批次读 blob、口径标签、面枚举、Undetermined→exit 2
// 全走它,不再散写 git —— 散写按磁盘判正是本门此前两头都错的根子(见头注)。
import {
  Undetermined,
  catBatch,
  readWorktreeFile,
  selectFace,
  gitRaw,
  FACE_LABEL,
  FACE_NOTE,
} from './lib/face-reader.mjs'

/** 跳过开关(guardian 注入;与其余门同形,便于 CI/逃生统一处理)。 */
const SKIP_ENV = 'HUSKY_SKIP_RN_STYLE_PARITY'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码绝对路径) ───
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'apps/mobile-rn/src')
const SRC_REL = 'apps/mobile-rn/src'
const BASELINE_PATH = join(root, 'scripts/rn-style-parity-baseline.json')

// ─── CLI 解析 ───
const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const showHelp = argv.includes('--help') || argv.includes('-h')
const updateBaseline = argv.includes('--update-baseline')
const selfTest = argv.includes('--self-test')
const { face, error: faceErr } = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
})

if (showHelp) {
  console.log(`
check-mobile-rn-style-parity.mjs — mobile-rn 跨端样式一致性守门(2026-09-03)

用法:
  node scripts/check-mobile-rn-style-parity.mjs [选项]

选项:
  --staged             判索引 blob(本次暂存,提交门禁面)
  --worktree           判磁盘(人工排查逃生舱,不作提交门禁)
  --update-baseline    用当前扫描结果重写基线(仅在完成治理、减少硬编码后使用,须全量档)
  --self-test          逻辑自检(阳性对照:红/绿/注释三夹具 + 词法边界)
  --quiet, -q          仅输出失败(BLOCK 级)信息
  --help, -h           显示此帮助

校验内容:
  RULE-1 (BLOCK) src/**(ts/tsx)出现基线之外的新增硬编码 #hex(必须改用 design-tokens)
  RULE-2 (WARN)  基线中已不存在的条目(建议 --update-baseline 收紧)

退出码:
  0 = 通过(含 WARN)
  1 = BLOCK 级失败
  2 = 无法判定(取材面取不到)
`)
  process.exit(0)
}

if (faceErr) {
  console.error(`❌ ${faceErr}`)
  process.exit(2)
}
if (updateBaseline && argv.includes('--staged')) {
  console.error('❌ --update-baseline 不得与 --staged 同用(基线须按全量口径收紧)')
  process.exit(1)
}
if (process.env[SKIP_ENV] === '1') {
  console.log(`⏭ ${SKIP_ENV}=1,跳过 RN 端硬编码 hex 基线守门`)
  process.exit(0)
}

// ─── 工具函数 ───

/** 去 BOM。 */
function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

/** 去除 TS/JS 行注释与块注释(避免把注释里的示例色值当硬编码)。 */
function stripTsComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** 从正文抽 hex(小写去重);注释先剥,注释内的色值不计。 */
function extractHexes(text) {
  const clean = stripTsComments(text)
  const hexes = new Set()
  const re = /#([0-9a-fA-F]{3,8})\b/g
  let m
  while ((m = re.exec(clean)) !== null) hexes.add(m[0].toLowerCase())
  return [...hexes]
}

/** 递归收集目录下所有指定后缀文件(仅 --worktree 面用:磁盘枚举磁盘读)。 */
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, exts, out)
    else if (exts.includes(full.slice(full.lastIndexOf('.') + 1))) out.push(full)
  }
  return out
}

// ─── 判定面取材(2026-10-16 迁 face-reader,枚举也走被审面,清单与内容同轮) ───

/** 按面枚举 apps/mobile-rn/src 下的 ts/tsx,返回**仓库相对路径**(正斜杠)。枚举不产正文,不算散写读内容。 */
function listFaceFiles(f) {
  const isTs = (p) => /\.(ts|tsx)$/.test(p)
  const scoped = (p) => p.startsWith(`${SRC_REL}/`) && isTs(p)
  if (f === 'worktree') {
    return walk(SRC, ['ts', 'tsx'])
      .map((abs) => abs.split(sep).join('/'))
      .filter((abs) => scoped(abs.slice(root.split(sep).join('/').length + 1)))
      .map((abs) => abs.slice(root.split(sep).join('/').length + 1))
  }
  if (f === 'staged') {
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM'], root)
      .split('\n')
      .map((s) => s.trim())
      .filter((p) => p && scoped(p))
  }
  return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', SRC_REL], root)
    .split('\n')
    .map((s) => s.trim())
    .filter((p) => p && scoped(p))
}

/** 一次 cat-file --batch 预取一批 blob 正文 → Map<rel, text|null>。 */
function prefetchFace(f, rels) {
  const uniq = [...new Set(rels)]
  if (uniq.length === 0) return new Map()
  if (f === 'worktree') {
    const out = new Map()
    for (const rel of uniq) out.set(rel, readWorktreeFile(root, rel))
    return out
  }
  const rev = f === 'staged' ? '' : 'HEAD'
  const specs = uniq.map((r) => `${rev}:${r}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 120000 })
  const out = new Map()
  for (let i = 0; i < uniq.length; i++) out.set(uniq[i], got.get(specs[i]) ?? null)
  return out
}

/**
 * 面文本口径:
 *   · worktree ⇒ 磁盘(逃生舱);
 *   · staged ⇒ 索引 blob,取不到 ⇒ Undetermined ⇒ exit 2(不回退磁盘、不静默跳过);
 *   · head ⇒ HEAD blob;HEAD 无此路径(并发会话刚 add 的新文件)⇒ 降级工作树,两面都无 ⇒ null。
 */
function faceText(faceMode, rel, prefetched) {
  if (faceMode === 'worktree') return readWorktreeFile(root, rel)
  const t = prefetched.get(rel)
  if (typeof t === 'string') return t
  if (faceMode === 'staged') {
    throw new Undetermined(
      `${rel}: 索引 blob 取不到 —— --staged 面无法判定(不回退磁盘、不静默跳过)`,
    )
  }
  return readWorktreeFile(root, rel)
}

/** 按面扫一遍 → [{ file(SRC 相对,正斜杠), hexes[] }](无 hex 的文件不入列)。 */
function scanFace(f) {
  const files = listFaceFiles(f)
  const prefetched = prefetchFace(f, files)
  const out = []
  for (const rel of files) {
    const text = faceText(f, rel, prefetched)
    if (text === null) continue // 该面与磁盘都没有 → 不判、不猜(与改判前一致)
    const hexes = extractHexes(stripBom(text))
    if (hexes.length > 0) out.push({ file: rel.slice(`${SRC_REL}/`.length), hexes })
  }
  return out
}

/**
 * RULE-1/2 判据(自检与主流程共用一份实现 —— 自检不复制判据,§22c 同取向)。
 * @returns {{ newHits: {file:string, added:string[]}[], staleFiles: string[], shrunk: {file:string, removed:string[]}[] }}
 */
function diffAgainstBaseline(currentMap, baselineMap) {
  const newHits = []
  for (const [file, hexes] of currentMap) {
    const base = baselineMap.get(file) || new Set()
    const added = [...hexes].filter((h) => !base.has(h))
    if (added.length > 0) newHits.push({ file, added })
  }
  const staleFiles = [...baselineMap.keys()].filter((f) => !currentMap.has(f))
  const shrunk = []
  for (const [file, base] of baselineMap) {
    const cur = currentMap.get(file)
    if (!cur) continue
    const removed = [...base].filter((h) => !cur.has(h))
    if (removed.length > 0) shrunk.push({ file, removed })
  }
  return { newHits, staleFiles, shrunk }
}

// ─── --self-test:阳性对照(红/绿/注释三夹具 + 词法边界,零依赖真仓) ───

function runSelfTest() {
  const fails = []
  const ok = (cond, msg) => {
    if (!cond) fails.push(msg)
  }
  // 夹具 1(红):基线外 hex 必判 BLOCK
  {
    const cur = new Map([['a.tsx', new Set(['#123456'])]])
    const base = new Map([['a.tsx', new Set(['#abcdef'])]])
    const { newHits } = diffAgainstBaseline(cur, base)
    ok(newHits.length === 1 && newHits[0].added.join() === '#123456', '基线外 hex 必须判红')
  }
  // 夹具 2(绿):基线内 hex 必放行
  {
    const cur = new Map([['a.tsx', new Set(['#abcdef'])]])
    const base = new Map([['a.tsx', new Set(['#abcdef'])]])
    const { newHits } = diffAgainstBaseline(cur, base)
    ok(newHits.length === 0, '基线内 hex 必须判绿')
  }
  // 夹具 3(注释):注释里的色值不计 —— 不入 currentMap,自然也无从判红
  {
    const hexes = extractHexes('const a = 1\n// #ff0000\n/* #0f0 */\n')
    ok(hexes.length === 0, '注释内色值不得判红')
    ok(extractHexes("const c = '#abc'").join() === '#abc', '真字面量必须仍被抓到(阳性对照)')
  }
  // 词法边界:hex 串后紧跟非 hex 字母 ⇒ 词界不成立 ⇒ **不收**(与原判据同语义,方向是漏报不是误红);
  // 合法 3-8 位则必收。
  {
    ok(extractHexes("const x = '#12345g'").length === 0, '词界不成立(#12345g)不得判红')
    ok(extractHexes("const x = '#abcdefg'").length === 0, '词界不成立(#abcdefg)不得判红')
    const okHex = extractHexes("const x = '#1234567'")
    ok(okHex.length === 1 && okHex[0] === '#1234567', '合法 7 位 hex 必须被收(词法未变松)')
  }
  // 面旗互斥:两个面旗同给必死(selectFace 出口的判据在本门被真调用)
  {
    const { face: bad, error } = selectFace({ staged: true, worktree: true })
    ok(bad === null && typeof error === 'string', '--staged 与 --worktree 同给必须报错')
    ok(selectFace({ staged: true }).face === 'staged', '--staged 必须选索引面')
    ok(selectFace({}).face === 'head', '缺省面必须是 head(不许默认磁盘)')
  }
  if (fails.length > 0) {
    for (const f of fails) console.error(`[SELF-TEST FAIL] ${f}`)
    return 1
  }
  console.log('[SELF-TEST OK] rn-parity 判据自检通过(红/绿/注释/词法边界/面旗互斥 5 组)')
  return 0
}

// ─── 主校验逻辑 ───

/** @returns {number} exit code */
function main() {
  if (selfTest) return runSelfTest()

  if (!quiet)
    console.log(
      `[check-mobile-rn-style-parity] RN 端硬编码 hex 基线守门… 内容口径:${FACE_LABEL[face]} —— ${FACE_NOTE[face]}`,
    )

  let current
  try {
    current = scanFace(face)
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : (e?.message ?? String(e))
    console.error(`❌ 无法判定(exit 2):${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  const currentMap = new Map(current.map((e) => [e.file, new Set(e.hexes)]))
  const currentCount = current.reduce((n, e) => n + e.hexes.length, 0)

  // ── --update-baseline:用当前结果重写基线(只应由治理提交、全量档调用) ──
  if (updateBaseline) {
    const baseline = {}
    for (const [file, hexes] of [...currentMap.entries()].sort()) {
      baseline[file] = [...hexes].sort()
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
    console.log(`[OK] 基线已更新: ${BASELINE_PATH}(${currentCount} 处硬编码 / ${current.length} 文件)`)
    return 0
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`[FAIL] 基线文件不存在: ${BASELINE_PATH}`)
    console.error('       首次建立基线请运行: node scripts/check-mobile-rn-style-parity.mjs --update-baseline')
    return 1
  }

  let baseline
  try {
    baseline = JSON.parse(stripBom(readFileSync(BASELINE_PATH, 'utf8')))
  } catch (e) {
    console.error(`[FAIL] 基线文件解析失败: ${e.message}`)
    return 1
  }
  const baselineMap = new Map(Object.entries(baseline).map(([f, h]) => [f, new Set(h)]))

  // ── RULE-1:基线之外的新增硬编码 hex -> BLOCK;RULE-2:已治理条目 -> WARN ──
  const { newHits, staleFiles, shrunk } = diffAgainstBaseline(currentMap, baselineMap)

  if (newHits.length > 0) {
    console.error(`[FAIL] RULE-1: ${newHits.length} 个文件出现基线之外的新增硬编码 #hex(必须改用 @ihui/design-tokens):`)
    for (const h of newHits.slice(0, 30))
      console.error(`    ${SRC_REL}/${h.file}: ${h.added.join(' ')}`)
  } else if (!quiet) {
    console.log(`[PASS] RULE-1: 无新增硬编码 #hex(存量 ${currentCount} 处 / ${current.length} 文件,只减不增)`)
  }

  let warnings = 0
  // RULE-2 只在**全量枚举面**(head/worktree)有意义:暂存面只扫本次暂存的子集,
  // "没被暂存"≠"已删除",按子集对整份基线算差集会把每个未暂存文件报成已删除(误导性假 WARN)。
  if (face === 'staged') {
    if (!quiet && (staleFiles.length > 0 || shrunk.length > 0))
      console.log(`[SKIP] RULE-2: 暂存面为子集口径,不判基线差集(${staleFiles.length} 个文件未被暂存是预期而非已删除)`)
  } else if (staleFiles.length > 0 || shrunk.length > 0) {
    warnings = staleFiles.length + shrunk.length
    console.warn(`[WARN] RULE-2: ${staleFiles.length} 个基线文件已删除 / ${shrunk.length} 个文件硬编码已减少,建议运行 --update-baseline 收紧基线:`)
    for (const f of staleFiles.slice(0, 10)) console.warn(`    ${SRC_REL}/${f}(已删除)`)
    for (const s of shrunk.slice(0, 10)) console.warn(`    ${SRC_REL}/${s.file}(已移除: ${s.removed.join(' ')})`)
  }

  if (newHits.length > 0) {
    console.error(`\n❌ RN 端样式一致性守门失败:新增硬编码 hex 将加剧与小程序端的视觉分裂`)
    return 1
  }
  if (!quiet) {
    if (warnings > 0) console.log(`\n✅ RN 端样式一致性守门通过(${warnings} 项 WARN,建议收紧基线)`)
    else console.log('\n✅ RN 端样式一致性守门通过')
  }
  return 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
