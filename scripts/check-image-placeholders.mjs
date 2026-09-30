#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/*
 * scripts/check-image-placeholders.mjs
 *
 * 只读量算:图片源站里有多少张图其实是**空文件**(端上表现为灰底占位图),
 * 以及它们分别被哪一处代码要走。立因(2026-09-29 实测):
 *   - `deploy/server-root` 由 `deploy/generate-placeholders.js` 在 2026-08-27 按
 *     `apps/miniapp-taro/src/constants/remote-icons.ts` 里的 URL 字面量逐个创建 0 字节文件,
 *     MANIFEST.txt 自述"均为占位,等待真图替换"。
 *   - `cdn-server.js` 对 0 字节与不存在的路径都回 **HTTP 200 + 占位图**(头 `X-Placeholder`)
 *     ⇒ 全链路(监控/构建/网关/浏览器)没有一个会红,用户看到的是灰块,而账面"图片服务正常"。
 *     同批实测:仓库历史 802 条图片路径 + 全工作树 1021 条 >500B 图片,**两段路径逐字匹配 0 条**
 *     ⇒ 真图不在本机,也不在本仓任何一次提交里(不是"我没找到"——命令与数字写在下面 --report 里)。
 *
 * 定级:**warn / 手动问责,刻意不接提交链**。它判的是**部署机上的文件内容**(gitignored 目录),
 * 提交者结构上满足不了 ⇒ 挂 blocking 就是每台每次被逼 `--no-verify`、连带链上全部检查作废
 * (AGENTS §12e 同型)。`--strict` 才把"仍有空图"算成 exit 1,供人/CN 问责。
 *
 * 用法:
 *   node scripts/check-image-placeholders.mjs              # 人读摘要(默认 exit 0)
 *   node scripts/check-image-placeholders.mjs --json       # 机读
 *   node scripts/check-image-placeholders.mjs --list       # 逐条:空图 URL + 要它的代码位置
 *   node scripts/check-image-placeholders.mjs --strict     # 有空图即 exit 1(问责档)
 *   node scripts/check-image-placeholders.mjs --root <dir> # 换判定面(测试/别的机器)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { catBatch, gitErrText, gitRaw } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const IMG_RE = /\.(png|jpe?g|gif|webp|svg)$/i

function arg(name) {
  return process.argv.includes(name)
}
function argVal(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null
}

const srvRoot = resolve(argVal('--root') || join(ROOT, 'deploy/server-root'))
const registry = join(ROOT, 'apps/miniapp-taro/src/constants/remote-icons.ts')

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    // 不跟随重解析点:本仓 §26 记过"递归穿透 junction = 把 D 盘的量算成 C 盘的债"同族事故
    if (e.isSymbolicLink()) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function fail(msg, code = 2) {
  console.error(`❌ ${msg}`)
  process.exit(code)
}

if (!existsSync(srvRoot))
  fail(`源站目录取不到:${srvRoot}(本机不是部署机?那就是"未判定",不是"没有空图")`)
if (!existsSync(registry)) fail(`登记表取不到:${registry}`)

const src = readFileSync(registry, 'utf8')
// URL 字面量 → 它出现在登记表里的哪一行(只取行号做**本次定位辅助**,不当证据写进台账:§1 明令行号会漂)
const wanted = new Map()
src.split(/\r?\n/).forEach((line, idx) => {
  const re = /(?:aizhsUrl|bspappUrl)\(\s*'([^']+)'/g
  let m
  while ((m = re.exec(line)) !== null) {
    const p = m[1].replace(/^\//, '').replace(/\\/g, '/')
    if (!p) continue
    if (!wanted.has(p)) wanted.set(p, [])
    wanted.get(p).push({ line: idx + 1, text: line.trim().slice(0, 120) })
  }
})

/**
 * 空白画布审计(2026-09-30 立):源站 0 字节文件至少会渲染成灰底占位(看得见);
 * 而 `apps/web/public/**` 里曾有一批"补图"实际是**同一份字节被复制上百份**(实测 184 份 /
 * 每份 174 字节的空白 PNG)—— 页面表现是"图标位什么都没有",账面却是"文件存在、构建通过、
 * 类型检查绿"。判据**不写死任何 md5**:跟踪图片按内容字节分组,同一组 ≥ BLANK_DUPE_MIN 份
 * 即点名(真照片/插画不可能上百份同一字节);组内单文件字节数另报,174 那组在结论行单列,
 * 因为"看不见"与"灰块"是两种症状、处置不同。取材走 face-reader 的 catBatch:内容判
 * **HEAD 面**,工作树滞后不参与判定(与 70/77/83/93/98 同口径);取不到的路径计「未判定」,
 * 不冒充 0,枚举到 0 个跟踪图片判死不记绿。
 */
const BLANK_DUPE_MIN = 5

function blankCanvasAudit() {
  let listed
  try {
    listed = gitRaw(['ls-files', '-z', '--', 'apps', 'packages'], ROOT)
  } catch (e) {
    return { state: 'undetermined', reason: `ls-files 派生失败:${gitErrText(e)}` }
  }
  const images = listed
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => IMG_RE.test(p))
  if (images.length === 0)
    return { state: 'dead', reason: '跟踪图片枚举到 0 个(不读成"没有空白副本")' }

  const specs = images.map((p) => `HEAD:${p}`)
  let blobs
  try {
    blobs = catBatch(ROOT, specs, { maxBuffer: 1 << 29 })
  } catch (e) {
    return { state: 'undetermined', reason: `catBatch 失败:${gitErrText(e)}` }
  }
  const byHash = new Map()
  let undetermined = 0
  for (const p of images) {
    const b = blobs.get(`HEAD:${p}`)
    if (!b || !b.length) {
      undetermined++
      continue
    }
    const h = createHash('md5').update(b).digest('hex')
    if (!byHash.has(h)) byHash.set(h, [])
    byHash.get(h).push({ path: p, size: b.length })
  }
  const dupeGroups = [...byHash.entries()]
    .map(([, members]) => members)
    .filter((m) => m.length >= BLANK_DUPE_MIN)
    .sort((a, b) => b.length - a.length)
  const invisible = dupeGroups
    .filter((m) => m.every((x) => x.size <= 512))
    .map((m) => ({ count: m.length, bytes: m[0].size, sample: m.slice(0, 6).map((x) => x.path) }))
  // 判红(问责档)只认"上百份同一字节"这种无歧义洪水;几份共用一枚小图标是正常设计,不算。
  const BLANK_FLOOD_MIN = 20
  return {
    state: 'ok',
    scanned: images.length,
    undetermined,
    dupeGroups: dupeGroups.map((m) => ({ count: m.length, bytes: m[0].size, sample: m.slice(0, 6).map((x) => x.path) })),
    invisible,
    blankFiles: invisible.filter((g) => g.count >= BLANK_FLOOD_MIN).reduce((a, g) => a + g.count, 0),
  }
}

const blankAudit = blankCanvasAudit()

const all = walk(srvRoot)
const empty = []
const real = []
for (const p of all) {
  if (!IMG_RE.test(p)) continue
  const rel = relative(srvRoot, p).replace(/\\/g, '/')
  const st = statSync(p)
  if (st.size === 0) empty.push(rel)
  else real.push({ rel, size: st.size })
}
const emptySet = new Set(empty)
const missing = [...wanted.keys()].filter((p) => !emptySet.has(p) && !real.some((r) => r.rel === p))
const referencedEmpty = empty.filter((p) => wanted.has(p))
const orphans = real.filter((r) => !wanted.has(r.rel))

const summary = {
  root: srvRoot,
  registryUrls: wanted.size,
  filesOnDisk: all.length,
  imageFiles: empty.length + real.length,
  emptyImages: empty.length,
  realImages: real.length,
  emptyAndReferenced: referencedEmpty.length,
  requestedButNotOnDisk: missing.length,
  realButNotReferenced: orphans.length,
  blankAuditState: blankAudit.state,
  blankCanvasFiles: blankAudit.state === 'ok' ? blankAudit.blankFiles : null,
  blankCopyGroups: blankAudit.state === 'ok' ? blankAudit.dupeGroups.length : null,
  blankAuditUndetermined: blankAudit.state === 'ok' ? blankAudit.undetermined : null,
}

if (arg('--json')) {
  console.log(
    JSON.stringify(
      { summary, emptyReferenced: referencedEmpty, missing: missing.slice(0, 50), blankCanvas: blankAudit },
      null,
      2,
    ),
  )
} else {
  console.log(`源站目录:${summary.root}`)
  console.log(
    `登记表要 ${summary.registryUrls} 张图;盘上图片 ${summary.imageFiles} 个 = 真图 ${summary.realImages} + 空文件 ${summary.emptyImages}` +
      `;其中被代码点名的空图 ${summary.emptyAndReferenced} 张;登记表点名而盘上没有 ${summary.requestedButNotOnDisk} 张`,
  )
  console.log(
    `结论:${summary.emptyAndReferenced > 0 ? `界面上有 ${summary.emptyAndReferenced} 处是灰底占位图(不是报错,是"看起来正常")` : '没有空图占位(全部是真图)'}`,
  )
  if (blankAudit.state === 'ok') {
    console.log(
      `空白画布审计(HEAD 面,判据=同一份字节被复制 ≥${BLANK_DUPE_MIN} 份):扫描 ${blankAudit.scanned} 张跟踪图片 / 未判定 ${blankAudit.undetermined} / 点名 ${blankAudit.blankFiles} 张"看不见的假图"(页面表现=图标位什么都没有,不是灰块),分 ${blankAudit.dupeGroups.length} 组`,
    )
    for (const g of blankAudit.invisible) {
      console.log(`  · ${g.count} 份 × ${g.bytes}B  样例:${g.sample.slice(0, 3).join(' , ')}${g.count > 3 ? ' …' : ''}`)
    }
    if (blankAudit.undetermined)
      console.log(`  ⚠️ ${blankAudit.undetermined} 张内容取不到(计未判定,不冒充 0)`)
  } else {
    console.log(`空白画布审计:未判定 —— ${blankAudit.reason ?? blankAudit.state}(不是"没有")`)
  }
  if (arg('--list')) {
    console.log('\n--- 逐条:空图 ← 谁在要它 ---')
    for (const p of referencedEmpty.slice(0, 400)) {
      const hits = wanted.get(p) || []
      console.log(`  ${p}  ← remote-icons.ts:${hits.map((h) => h.line).join(',')}`)
    }
    if (referencedEmpty.length > 400) console.log(`  …另 ${referencedEmpty.length - 400} 条`)
    if (missing.length) {
      console.log('\n--- 登记表点名、但源站连空文件都没有 ---')
      for (const p of missing.slice(0, 60)) console.log(`  ${p}`)
      if (missing.length > 60) console.log(`  …另 ${missing.length - 60} 条`)
    }
  } else if (summary.emptyAndReferenced) {
    console.log('  逐条清单跑:node scripts/check-image-placeholders.mjs --list')
  }
}

// 恢复路径的诚实说明:本仓没有真图字节,所以"补图"只能来自外部素材交付,不得自造
// (AGENTS §图标:"品牌/平台图标必须是官方真实图标 … 严禁手绘、自造、近似模仿或用字母占位图代替")
if (arg('--strict') && (summary.emptyAndReferenced > 0 || (blankAudit.state === 'ok' && blankAudit.blankFiles > 0))) {
  if (summary.emptyAndReferenced > 0)
    console.error(`\n❌ ${summary.emptyAndReferenced} 张被代码点名的图仍是空文件(问责档判红)`)
  if (blankAudit.state === 'ok' && blankAudit.blankFiles > 0)
    console.error(
      `❌ ${blankAudit.blankFiles} 张已入库图片是"同一份字节复制上百份"的空白画布 —— 页面上是图标位空着,账面上是文件存在;补图只能来自素材交付,不得自造(AGENTS §图标)`,
    )
  process.exit(1)
}
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
