// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物,需打印预演/落地结论 */
/**
 * land-cross-end-shell-pages.mjs —— 「小程序缺页 → 自动造壳承载页 → 自动落 HEAD」的闭环器物。
 *
 * 为什么要有它(而不是再写一把尺子):跨端对齐的判定链早已齐(128 观感 / 237 覆盖 / 251 复用面),
 * 但"缺一枚页"到今天仍要有人动手:造页器能产页,四条接缝(app.config 路由 / 登记表 / 5 份词包)
 * 却因共享工作树常年挂着他人未提交改动而**正确拒落**(§12 防吞他人现场)⇒ 结果是
 * "拒落 ⇒ 半落地物被清掉 ⇒ 下轮从零再来",缺口永远靠人推。本器把这条链改成机器可自跑的:
 * 接缝内容一律按 **HEAD blob ⊕ 本批行** 构造(不读工作树一字节),走 object-space-land 提交。
 *
 * 与安全边界的三条同时约束:
 *  1) 每轮上限 `--cap`(默认 5 枚)只是**节拍**,不是容量判据;真判据是**单分包 2 MiB**
 *     (2026-10-26 实测更正:旧注释说"造页增大主包"是错的 —— 78 枚页只让主包涨 46 KB,
 *      pkg-user 却从 1.53 MB 涨到 3.77 MB,超微信单个分包硬上限 1.8 倍)。
 *     容量闸 = `lib/cross-end-subpackage-capacity.mjs`(判据单源),到量即 `blocked`,
 *     不再静默把交付物做成传不上去的形态。
 *  2) 只产 **壳承载形制**(端内零布局零样式):造页器自己判定三腿不齐(spec/RN 腿/词包)即 refuse,
 *     本器不替它放宽(§12e:不得为消红削判据)。
 *  3) 任一接缝插入失败 ⇒ 整批不落(不留"有页无路由"的孤儿),结论行点名是哪条接缝、哪一屏。
 *
 * 退出码:0 = 无需推进 或 已落;1 = 判定成立但被护栏拦住(cap/预算);2 = 未判定(取不到面、清单构造失败)。
 *
 * Usage:
 *   node scripts/land-cross-end-shell-pages.mjs              # 预演:报本轮会产哪几枚、接缝是否全通
 *   node scripts/land-cross-end-shell-pages.mjs --apply      # 落地(经 object-space-land,CAS 冲突即拒)
 *   node scripts/land-cross-end-shell-pages.mjs --cap=3 --apply
 *   node scripts/land-cross-end-shell-pages.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  insertConfigPage,
  insertConfigRoot,
  insertJsonMembers,
  insertRegistryEntry,
  mergeJsonMembers,
  parseMiniappRoutes,
  planBatch,
} from './gen-miniapp-mirror.mjs'
import { CAPACITY_REL, parseCapacity, routePlanned } from './lib/cross-end-subpackage-capacity.mjs'
// 声明件派生口径取生成器那一份(§0.6:本器不另写"引用→declare"的第二套算式)
import { __test__ as shellTypes } from './gen-rn-shell-types.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const R = (...p) => join(ROOT, ...p)
const TMP = join(ROOT, '.ihui-agent', 'tmp', 'land-cross-end-shell-pages')
const MP_CONFIG = 'apps/miniapp-taro/src/app.config.ts'
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
// 缺口账本(漂移尺 doc-stale 那一维的正文)—— 落完页必须按新 HEAD 再刷一次,否则每批都留一格旧数叫人来看
const PARITY_DOC = 'docs/engineering/rn-miniapp-parity-matrix.md'
// 壳声明件 —— 每落一枚承载页就多一条 @rn-shells 引用,不重生成 ⇒ 门 251 C9 直接红(下一枚提交就被它拦)
const SHELL_DECL = 'apps/miniapp-taro/types/rn-shells.generated.d.ts'
const DEFAULT_CAP = 5
// 一轮里"装配 → 提交"最多试几次。节拍旋钮,不是容量判据(容量判据 = 单分包 2 MiB)。
const LAND_ATTEMPTS = 3

const git = (args, input) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    input,
  })
const headBlob = (rel) => git(['show', `HEAD:${rel}`])
const hashBytes = (buf) => git(['hash-object', '-w', '--stdin'], Buffer.from(buf, 'utf8')).trim()

/** 词包两档写入(与造页器同一条:全新命名空间按行插,已在册转并键档) */
function writePackText(headText, groups, members) {
  // 壳承载形制里「t() 全落在通用命名空间」的屏没有专属词条(实测 knowledge-planet / learn /
  // sub-package-index 三屏只用到 common.back|more|retry)⇒ 词包接缝无事可做,不是失败。
  // 旧实现把它当写失败 ⇒ 整批 blocked,而这三屏永远落不下来。
  if (!Array.isArray(groups) || groups.length === 0) return { ok: true, text: headText, skipped: true }
  let r = insertJsonMembers(headText, groups)
  if (!r.ok && /已存在顶层命名空间/.test(r.why || '')) r = mergeJsonMembers(headText, members)
  return r
}

/**
 * 纯判据:由计划集 + 各 HEAD 面正文,算出要落的全部 blob。
 * 返回 {ok:false, why} 时调用方**一个字节都不写**(不留有页无路由的孤儿)。
 */
export function assembleBlobs(planned, { headOf, watermarkOf }) {
  const files = []
  for (const p of planned) {
    const stamped = watermarkOf(p.pageRel, p.pageText)
    if (typeof stamped !== 'string' || stamped.length === 0)
      return { ok: false, why: `页水印字节取不到(${p.pageRel})⇒ 未判定,整批不落` }
    files.push({ path: p.pageRel, blob: stamped })
  }

  const cfg0 = headOf(MP_CONFIG)
  if (typeof cfg0 !== 'string') return { ok: false, why: `HEAD 面取不到 ${MP_CONFIG} ⇒ 未判定,整批不落(§0.3)` }
  let cfg = cfg0
  for (const p of planned) {
    // 改道后目标 root 可能还不存在(溢出分包是容量判据现开出来的)⇒ 交给 insertConfigRoot 建块。
    // 它内部对"root 已在册"退回 insertConfigPage,所以两种情形一条路。
    const r = insertConfigRoot(cfg, p.subRoot, p.page)
    if (!r.ok) return { ok: false, why: `app.config 插路由 ${p.route}:${r.why}`, culprit: p.route }
    cfg = r.text
  }
  files.push({ path: MP_CONFIG, blob: hashBytes(cfg) })

  const reg0 = headOf(REGISTRY)
  if (typeof reg0 !== 'string') return { ok: false, why: `HEAD 面取不到 ${REGISTRY} ⇒ 未判定,整批不落` }
  let reg = reg0
  for (const p of planned) {
    const r = insertRegistryEntry(reg, p.registryEntry)
    if (!r.ok) return { ok: false, why: `registry 插条目 ${p.registryEntry.shared}:${r.why}`, culprit: p.route }
    reg = r.text
  }
  files.push({ path: REGISTRY, blob: hashBytes(reg) })

  const packs = new Map()
  const packHeads = new Map()
  for (const p of planned) {
    for (const lb of p.langBlocks) {
      if (!packs.has(lb.packRel)) {
        const t0 = headOf(lb.packRel)
        if (typeof t0 !== 'string') return { ok: false, why: `HEAD 面取不到词包 ${lb.packRel} ⇒ 未判定,整批不落` }
        packs.set(lb.packRel, t0)
        packHeads.set(lb.packRel, t0)
      }
      const r = writePackText(packs.get(lb.packRel), lb.groups, lb.members)
      if (!r.ok) return { ok: false, why: `词包 ${lb.packRel}(${p.route}):${r.why}`, culprit: p.route }
      packs.set(lb.packRel, r.text)
    }
  }
  // 只有**真变了**的词包才进 blob 清单:空成员组那一档会原样返回底稿(http 在 no-op 屏上),
  // 把未变的文件当成"待写"塞进去 ⇒ 落地器的"写回旧版"守卫当场命中(内容 === 父提交 blob),
  // 整批 undetermined 而根因是自家清单多带了一件。2026-10-27 实测即此型。
  let changedPacks = 0
  for (const [rel, text] of packs) {
    if (text === packHeads.get(rel)) continue
    changedPacks += 1
    files.push({ path: rel, blob: hashBytes(text) })
  }
  return { ok: true, files, packs: changedPacks }
}

/**
 * 一屏接缝失败不许拖死整批(2026-10-26 实测:home 的词包缺键落在嵌套子对象里,并键档不并
 * ⇒ 整批 blocked ⇒ 队列停在这一屏,与"单行 pages 数组"同一型的安静停摆)。
 * 做法:装配失败时只摘掉**肇事那一屏**(assembleBlobs 回带的 culprit),其余照落;
 * 被摘的逐条点名,跳过必须可见。上限 8 次 —— 再多说明不是"个别屏"的问题,整批放弃并点名。
 */
export function buildWithDrops(batch, assemble) {
  const work = [...batch]
  const dropped = []
  let built = assemble(work)
  for (let guard = 0; !built.ok && built.culprit && guard < 8; guard += 1) {
    const idx = work.findIndex((p) => p.route === built.culprit)
    if (idx < 0) break
    const [out] = work.splice(idx, 1)
    dropped.push({ route: out.route, spec: out.spec, why: built.why })
    built = assemble(work)
  }
  return { built, batch: work, dropped }
}

/** 新源文件必须带溯源水印(§5c):在临时件上注入后取字节,不动工作树的真文件 */
function watermarkBytesOf(name, text, ext = '.tsx') {
  mkdirSync(TMP, { recursive: true })
  const p = join(TMP, `${name.replace(/[\\/]/g, '_')}${ext}`)
  writeFileSync(p, text, 'utf8')
  execFileSync(process.execPath, [R('scripts', 'watermark.mjs'), 'inject', p], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const bytes = readFileSync(p, 'utf8')
  rmSync(p, { force: true })
  return bytes
}

/**
 * 账本自刷(2026-10-26 立)—— 造页闭环每落一批,`docs/engineering/rn-miniapp-parity-matrix.md`
 * 自述的「镜像 N / 共享屏 M / 缺口 K」就旧一格,而漂移尺把 doc-stale 判成 regressed 并到人。
 * 那一格的"收信人动作"只有重跑器物(§5e-1:不能整改的判据不该进到人通道),所以由本器自己跑。
 *
 * 三条同时成立才落:① 取文恒走生成器(本器零复算算式,§0.6),且生成器默认面 = HEAD;
 * ② 产文与 HEAD blob 逐字节不同(相同 ⇒ 零写零推);③ 产文含水位横幅(缺横幅就落,等于把
 *    §5c 的覆盖面自己洗掉)。任一取不到 ⇒ state=undetermined,不记绿。
 */
function syncParityDoc(deps = {}) {
  const generate =
    deps.generate ??
    (() => {
      const tmp = join(TMP, 'parity-matrix.md')
      try {
        mkdirSync(dirname(tmp), { recursive: true })
      } catch {
        /* 目录已在 */
      }
      try {
        execFileSync(process.execPath, [R('scripts', 'report-rn-miniapp-gaps.mjs'), '--write', tmp], {
          cwd: ROOT,
          encoding: 'utf8',
          windowsHide: true, // §5b
          timeout: 4 * 60 * 1000, // 守门 80
          maxBuffer: 1 << 24,
          stdio: ['ignore', 'pipe', 'pipe'], // §12g
        })
      } catch (e) {
        return { ok: false, err: `生成器没跑成:${String(e?.stderr ?? e?.message ?? e).slice(0, 140)}` }
      }
      try {
        return { ok: true, text: readFileSync(tmp, 'utf8') }
      } catch (e) {
        return { ok: false, err: `生成后读不回临时件:${String(e?.message ?? e).slice(0, 100)}` }
      } finally {
        try {
          rmSync(tmp, { force: true })
        } catch {
          /* 临时件清不掉只影响工作区卫生 */
        }
      }
    })
  const headOf = deps.headOf ?? headBlob
  const landOf =
    deps.landOf ??
    ((text, nums) => {
      const oid = hashBytes(text)
      const manifest = join(TMP, 'doc-blob.json')
      writeFileSync(manifest, JSON.stringify({ files: [{ path: PARITY_DOC, blob: oid }] }, null, 1), 'utf8')
      try {
        const out = execFileSync(process.execPath, [R('scripts', 'object-space-land.mjs')], {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 1 << 26,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            LAND_PATHS: PARITY_DOC,
            LAND_BLOBS: manifest,
            LAND_BLOB_PROOF: 'blob = 生成器按 HEAD 面产出的全文(本器零复算算式);与 HEAD blob 逐字节比过才落',
            LAND_MSG: [
              `docs(cross-end): 自动同步缺口账本到现读口径(${nums})`,
              '',
              '器物:node scripts/report-rn-miniapp-gaps.mjs --write <file>(由 land-cross-end-shell-pages 的账本自刷腿调起)',
              '为什么必须自动:造页闭环每落一批,文档自述的镜像/缺口数就旧一格,而漂移尺按 doc-stale 判 regressed 到人 ——',
              '叫人来做的唯一动作就是重跑这条命令,那是器物能自己做的(§5e-1 可整改性准入)。',
            ].join('\n'),
          },
        })
        return /CAS 成功|提交面回读/.test(out) ? { ok: true } : { ok: false, why: '落地器未自证成功' }
      } catch (e) {
        return { ok: false, why: `账本落地失败:${String(e?.message ?? e).slice(0, 140)}` }
      }
    })

  const gen = generate()
  if (!gen?.ok) return { state: 'undetermined', why: gen?.err ?? '生成器未返回结论' }
  let fresh = gen.text
  // 生成器产的是纯正文(横幅由注入步负责)⇒ 缺载荷时**先注入再判**,注入完仍缺才算未判定。
  // 不加这一格,自动腿每次产出的账本都会因"没横幅"被拒落 ⇒ 账本永远旧一格,doc-stale 长挂。
  if (!/\[IHUI-AI-PROVENANCE\]:/.test(fresh)) {
    try {
      fresh = (deps.watermarkOf ?? ((t) => watermarkBytesOf(PARITY_DOC, t, '.md')))(fresh)
    } catch (e) {
      return { state: 'undetermined', why: `横幅注入失败:${String(e?.message ?? e).slice(0, 140)}` }
    }
  }
  if (!/\[IHUI-AI-PROVENANCE\]:/.test(fresh)) {
    return { state: 'undetermined', why: '产文缺水位横幅(注入后仍缺)⇒ 不落(落了就是洗载荷)' }
  }
  let headText = null
  try {
    headText = headOf(PARITY_DOC)
  } catch {
    return { state: 'undetermined', why: `HEAD 面取不到 ${PARITY_DOC}` }
  }
  if (headText === null || headText === undefined) return { state: 'undetermined', why: `HEAD 面取不到 ${PARITY_DOC}` }
  if (headText === fresh) return { state: 'clean' }
  const landed = landOf(
    fresh,
    // 提交信息里的数 must 是**读数行**,不是标题:只取"已被小程序显式镜像: **N**"那一行
    // (上一版直接 /镜像[^\n]*/ 抓,抓到的是标题「…镜像缺口账本(自动生成)」,等于自证信息说谎)
    (() => {
      const m = /已被小程序显式镜像:\s*\*\*(\d+)\*\*[\s\S]*?缺口合计:\s*\*\*(\d+)\*\*/.exec(fresh)
      return m ? `镜像 ${m[1]} · 缺口 ${m[2]}` : '未取到读数行'
    })(),
  )
  if (!landed?.ok) return { state: 'pending', why: landed?.why ?? '未落地' }
  return { state: 'landed' }
}

/**
 * 折叠口径单独抽成纯函数(判据只有一份,自检直接打它 —— 不为了测它去跑 136 秒的批量计划):
 *  · 账本落了 ⇒ 这一轮**写了东西**,绝不能报成 clean(调度器读到 clean 就是"零写零推");
 *  · 账本有差异但没落地(pending)⇒ 保持原 state,只在 note 里点名,下轮再试;
 *  · 页面本来没缺口而账本取不到结论 ⇒ 整轮降级为未判定(§0.3 不冒绿);
 *  · 页面已 landed/其它态 ⇒ 不被账本的 clean 改回去。
 */
export function foldDocResult(r, doc) {
  const out = { ...r, doc: doc.state }
  if (doc.state === 'landed') {
    out.blobs = (typeof out.blobs === 'number' ? out.blobs : 0) + 1
    out.state = 'landed'
    out.note = `${out.batch ? `本轮 ${out.batch.length} 页` : '本轮无新页'} + 账本已刷进 HEAD`
  } else if (doc.state === 'pending') {
    out.note = `${out.note ?? ''} ｜ 账本有差异但没落地(多为 CAS 撞上并发推进),下轮再试`.trim()
  } else if (doc.state === 'undetermined' && r.state === 'clean') {
    out.state = 'undetermined'
    out.why = doc.why ?? '账本自刷未判定'
  }
  return out
}

/**
 * 壳声明件自刷(2026-10-26 立)—— 承载页每落一枚,小程序端就多一条 `@rn-shells/<X>` 引用,
 * 而 `types/rn-shells.generated.d.ts` 不跟着长 ⇒ 门 251 C9「声明件与面上引用不同步」当场判红。
 * 实测:自动落 3 枚之后 C9 红、点名 16 条说明符,而整改动作只有重跑生成器(§5e-1 可整改性准入)。
 *
 * 三条与账本腿同形:① 取文只走生成器(collect + applyBlock,本器零复算,§0.6);
 * ② 与 HEAD blob 逐字节相同 ⇒ clean(零写零推);③ 缺水位横幅先注入再判,注入后仍缺 ⇒ 未判定。
 */
function syncShellTypes(deps = {}) {
  const headOf = deps.headOf ?? headBlob
  let plan
  try {
    plan = (deps.collect ?? (() => shellTypes.collect({ face: 'head' })))()
  } catch (e) {
    return { state: 'undetermined', why: `声明件派生失败:${String(e?.message ?? e).slice(0, 140)}` }
  }
  if (!plan || typeof plan.next !== 'string') return { state: 'undetermined', why: '派生器没给出正文' }
  if (Array.isArray(plan.undetermined) && plan.undetermined.length > 0) {
    return { state: 'undetermined', why: `派生未判定:${String(plan.undetermined[0]).slice(0, 120)}` }
  }
  let current
  try {
    current = headOf(SHELL_DECL)
  } catch {
    return { state: 'undetermined', why: `HEAD 面取不到 ${SHELL_DECL}` }
  }
  if (current === null || current === undefined) {
    return { state: 'undetermined', why: `HEAD 面取不到 ${SHELL_DECL}` }
  }
  const expected = shellTypes.applyBlock(current, plan.next)
  if (expected === current) return { state: 'clean' }
  let fresh
  try {
    fresh = (deps.watermarkOf ?? ((t) => watermarkBytesOf(SHELL_DECL, t, '.ts')))(expected)
  } catch (e) {
    return { state: 'undetermined', why: `横幅注入失败:${String(e?.message ?? e).slice(0, 140)}` }
  }
  if (!/\[IHUI-AI-PROVENANCE\]:/.test(fresh)) {
    return { state: 'undetermined', why: '产文缺水位横幅(注入后仍缺)⇒ 不落(落了就是洗载荷)' }
  }
  const oid = hashBytes(fresh)
  const manifest = join(TMP, 'shell-decl-blob.json')
  writeFileSync(manifest, JSON.stringify({ files: [{ path: SHELL_DECL, blob: oid }] }, null, 1), 'utf8')
  try {
    const out = execFileSync(process.execPath, [R('scripts', 'object-space-land.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LAND_PATHS: SHELL_DECL,
        LAND_BLOBS: manifest,
        LAND_BLOB_PROOF:
          'blob = gen-rn-shell-types 按新 HEAD 面派生 + applyBlock 进受管块(本器零复算);与 HEAD blob 逐字节比过才落',
        LAND_MSG: [
          `chore(cross-end): 壳声明件跟随新落承载页(${plan.modules.length} 条说明符)`,
          '',
          '器物:scripts/gen-rn-shell-types.mjs 的 collect/applyBlock(由 land-cross-end-shell-pages 的声明件自刷腿调起)',
          '为什么必须自动:每落一枚承载页就多一条 @rn-shells 引用,不重生成 ⇒ 门 251 C9 判红,',
          '而被拦的是下一位提交者、他的整改动作也只是重跑这条命令(§5e-1 可整改性准入)。',
        ].join('\n'),
      },
    })
    return /CAS 成功|提交面回读/.test(out) ? { state: 'landed' } : { state: 'pending', why: '落地器未自证成功' }
  } catch (e) {
    return { state: 'pending', why: `声明件落地失败:${String(e?.message ?? e).slice(0, 140)}` }
  }
}

/** 折叠口径与账本腿同型(纯函数,自检直接打它):落了 ⇒ 本轮确实写了东西;pending 只点名;未判定只在原本 clean 时降级。 */
export function foldShellTypesResult(r, types) {
  const out = { ...r, types: types.state }
  if (types.state === 'landed') {
    out.blobs = (typeof out.blobs === 'number' ? out.blobs : 0) + 1
    out.state = 'landed'
  } else if (types.state === 'pending') {
    out.note = `${out.note ?? ''} ｜ 壳声明件有差异但没落地,下轮再试`.trim()
  } else if (types.state === 'undetermined' && out.state === 'clean') {
    out.state = 'undetermined'
    out.why = out.why ?? types.why ?? '壳声明件自刷未判定'
  }
  return out
}

/**
 * run 的最外层包装:页面批 + 账本自刷 + 壳声明件自刷。
 * 两条派生腿都只在真落地档(--apply 且非 headless)跑 —— 预演档不该动 HEAD。
 */
function run(opts = {}) {
  const r = runPages(opts)
  if (!opts.apply || opts.headless) return r
  let doc
  try {
    doc = syncParityDoc()
  } catch (e) {
    doc = { state: 'undetermined', why: String(e?.message ?? e).slice(0, 140) }
  }
  let types
  try {
    types = syncShellTypes()
  } catch (e) {
    types = { state: 'undetermined', why: String(e?.message ?? e).slice(0, 140) }
  }
  return foldShellTypesResult(foldDocResult(r, doc), types)
}

/**
 * 容量闸(2026-10-26 立):造页前按**上一份真实产物**的测量快照判"这个分包还装得下几屏"。
 * 取不到容量表/registry ⇒ 整轮 blocked(失效方向是"多要一次定向说明",不是"多放一次跳门")。
 * 判定公式只有一份:lib/cross-end-subpackage-capacity.mjs(本器零复算)。
 */
function capacityGate(planned, { cap, headOf = headBlob } = {}) {
  let modelText
  try {
    modelText = headOf(CAPACITY_REL)
  } catch {
    return { ok: false, why: `HEAD 面取不到容量表 ${CAPACITY_REL} ⇒ 本轮不放行(先按新产物更新它)` }
  }
  if (typeof modelText !== 'string') return { ok: false, why: `HEAD 面取不到容量表 ${CAPACITY_REL} ⇒ 本轮不放行(先按新产物更新它)` }
  const parsed = parseCapacity(modelText)
  if (!parsed.ok) return { ok: false, why: `${parsed.why} ⇒ 本轮不放行` }
  let registryText
  try {
    registryText = headOf(REGISTRY)
  } catch {
    return { ok: false, why: `HEAD 面取不到 ${REGISTRY} ⇒ 本轮不放行` }
  }
  if (typeof registryText !== 'string') return { ok: false, why: `HEAD 面取不到 ${REGISTRY} ⇒ 本轮不放行` }
  return routePlanned(planned, {
    model: parsed.model,
    registryText,
    cap,
    estimates: parsed.model.pageEstimates,
  })
}

function runPages({
  apply,
  cap = DEFAULT_CAP,
  headless = false,
  landOf = null,
  headOf = null,
  planOf = null,
  gateOf = null,
} = {}) {
  const { planned, refused, undetermined } = (planOf ?? (() => planBatch(ROOT, { form: 'shell' })))()
  if (!planned) return { state: 'undetermined', why: '批量计划读不到 planned 集' }
  if (planned.length === 0) {
    return {
      state: 'clean',
      planned: 0,
      refused: refused?.length ?? 0,
      // 只报"拒 N 枚"等于没报:N 枚各有各的成因,而这三腿判据的成因只有生产方知道。
      // 明细随 --json 出账(封顶 20 条防刷屏),打印档逐条点名 ⇒ 接手的人能直接动手。
      refusedDetail: (refused || []).slice(0, 20).map((r) => `${r.spec}:${String(r.why ?? '(未给因)').slice(0, 110)}`),
      undeterminedDetail: (undetermined || []).slice(0, 10).map((u) => `${u.spec ?? u}:${String(u.why ?? '未判定').slice(0, 90)}`),
      undetermined: undetermined?.length ?? 0,
      note: '本轮没有可产的屏(缺口要么已落、要么被造页器按三腿判据拒/未判定)',
    }
  }
  const gate = (gateOf ?? ((arr) => capacityGate(arr, { cap })))(planned.slice(0, cap))
  if (!gate.ok) return { state: 'blocked', why: gate.why, planned: planned.length, held: [] }
  const batch = gate.admitted
  const held = gate.held ?? []
  const moves = gate.moves ?? []
  if (batch.length === 0) {
    return {
      state: 'blocked',
      planned: planned.length,
      held,
      refused: refused?.length ?? 0,
      why:
        `容量闸挡下本批全部 ${held.length} 枚 —— ` +
        (held[0]?.why ?? '各 root 均无余量') +
        `。出路:重建产物后更新 ${CAPACITY_REL}(或给新屏开新分包),不要靠加 cap 硬灌`,
    }
  }
  // 一屏接缝失败不许拖死整批(2026-10-26 实测:home 的词包缺键落在嵌套子对象里,并键档不并
  // ⇒ 整批 blocked ⇒ 队列停在这一屏,和"单行 pages 数组"同一型的安静停摆)。做法:装配失败时
  // 只摘掉肇事那一屏,其余照落,被摘的逐条点名进 dropped —— 跳过必须可见,不许静默。
  // 页正文不随 HEAD 移动 ⇒ 水印字节按「文件名+正文」记忆,重装配时不重复起子进程。
  // readHead 可由调用方注入(自检要造"面在两次尝试之间被别席推进"这一形)。
  const stampCache = new Map()
  const stampOf = (name, text) => {
    const k = `${name}\u0000${text}`
    if (!stampCache.has(k)) stampCache.set(k, hashBytes(watermarkBytesOf(name, text)))
    return stampCache.get(k)
  }
  const readHead = headOf ?? headBlob
  const assemble = (arr) => assembleBlobs(arr, { headOf: readHead, watermarkOf: stampOf })
  let { built, batch: finalBatch, dropped } = buildWithDrops(batch, assemble)
  if (!built.ok) return { state: 'blocked', why: built.why, planned: planned.length, held, dropped }
  if (finalBatch.length === 0) {
    return {
      state: 'blocked',
      planned: planned.length,
      held,
      dropped,
      why: `本批 ${dropped.length} 枚全部因接缝失败被摘(${dropped[0]?.why ?? '未附原因'})⇒ 无可落之物`,
    }
  }

  if (!apply || headless) {
    return {
      state: 'pending',
      planned: planned.length,
      batch: finalBatch.map((p) => p.route),
      held,
      moves,
      dropped,
      blobs: built.files.length,
      note: apply ? 'headless 档:只算不落' : '预演模式:加 --apply 落地',
    }
  }
  const manifest = join(ROOT, '.ihui-agent', 'tmp', 'land-cross-end-shell-pages', 'blobs.json')
  mkdirSync(dirname(manifest), { recursive: true })
  // 撞车重装的上限只是**节拍**,不是容量判据。立因:装配到提交之间是分钟级窗口,而接缝面
  // (app.config / 登记表 / 5 份词包)在本仓几乎每分钟都被别席推进一笔 ⇒ 「只试一次,下轮再试」
  // 在这套节律下等价于结构性零产出。
  const attempts = Math.max(1, Number(process.env.IHUI_CROSS_END_LAND_ATTEMPTS || LAND_ATTEMPTS))
  let lastWhy = ''
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      // 撞了就现读**新 HEAD** 重算接缝 blob:assembleBlobs 是纯函数、headBlob 无记忆,
      // 所以重装的产物就是「新面 ⊕ 本批行」,不必重跑分钟级的 planBatch。
      const again = buildWithDrops(batch, assemble)
      built = again.built
      finalBatch = again.batch
      dropped = again.dropped
      if (!built.ok)
        return { state: 'blocked', why: built.why, planned: planned.length, held, moves, dropped }
      if (finalBatch.length === 0)
        return {
          state: 'blocked',
          planned: planned.length,
          held,
          moves,
          dropped,
          why: `第 ${attempt} 次重装配后本批被摘空(${dropped[0]?.why ?? '未附原因'})`,
        }
    }
    writeFileSync(manifest, JSON.stringify({ files: built.files }, null, 1), 'utf8')
    const msg = [
      `chore(cross-end): 自动落 ${finalBatch.length} 枚小程序壳承载页(共 ${planned.length} 枚待产)`,
      '',
      `器物:node scripts/land-cross-end-shell-pages.mjs --apply(cap=${cap},每轮节拍;容量判据 = 单分包 2 MiB,见 data/cross-end-subpackage-capacity.json)`,
      '形制:端内零布局零样式 —— 渲染源 = packages/app 共享屏(经 src/rn-compat),数据与交互 = 同名 RN 壳。',
      '接缝:app.config 路由行 + 跨端登记表 + 词包(两档:全新命名空间按行插,已在册转并键档,不覆盖既有值)。',
      '内容构造法:全部 blob = git show HEAD:<file> ⊕ 本批行,由造页器自己的插入函数产;工作树一字节未读',
      `(那是为了不在他人未提交改动上落我的行 —— §12 防吞现场;旁路落地不自跑钩子,故守门 251/128/237 在下一轮提交或巡检里复量)。`,
      ...(moves.length
        ? [
            '',
            `容量改道(${moves.length} 枚;语义分包装不下 ⇒ 按 overflowRoots 改道,接缝同批按新 root 建块):`,
            ...moves.map((m) => `  ${m.spec} → ${m.from} ⇒ ${m.to}(约 ${m.estimate} B)`),
          ]
        : []),
      '',
      `页面:${finalBatch.map((p) => `${p.spec} → ${p.route}`).join('; ')}`,
    ].join('\n')
    const r = (landOf ?? landViaObjectSpace)({ manifest, built, msg })
    if (r.ok)
      return {
        state: 'landed',
        planned: planned.length,
        batch: finalBatch.map((p) => p.route),
        held,
        moves,
        dropped,
        blobs: built.files.length,
        attempts: attempt,
        note: 'CAS 成功且按被审面回读在树',
      }
    // 落地器没自证成功 ≠ 没落。先按被审面回读:本批页文件已在树上 ⇒ 判已落并**立即停手** ——
    // 继续重试等于把同一批页再落一遍(重复提交)。失效方向恒为"少落一次",不多落。
    if (finalBatch.every((p) => typeof readHead(p.pageRel) === 'string'))
      return {
        state: 'landed',
        planned: planned.length,
        batch: finalBatch.map((p) => p.route),
        held,
        moves,
        dropped,
        blobs: built.files.length,
        attempts: attempt,
        note: `落地器未自证成功(${r.why}),但按被审面回读本批 ${finalBatch.length} 枚页已在树上 ⇒ 判已落,不再重试`,
      }
    lastWhy = r.why
  }
  return {
    state: 'undetermined',
    why: `${attempts} 次尝试均未落地(最后一次:${lastWhy})⇒ 本轮既不算落也不算缺口清零`,
    planned: planned.length,
    held,
    moves,
    dropped,
    attempts,
  }
}

/** 真正调落地器那一步抽成出口:自检要注入假落地器,证明"撞一次会换新面重装"而不是只多喊一遍。 */
function landViaObjectSpace({ manifest, built, msg }) {
  try {
    const out = execFileSync(process.execPath, [R('scripts', 'object-space-land.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LAND_PATHS: built.files.map((f) => f.path).join(';'),
        LAND_BLOBS: manifest,
        LAND_BLOB_PROOF:
          'blob = git show HEAD:<file> ⊕ 本批行(逐条经造页器自己的插入函数产);页文件正文 = planBatch(form=shell).pageText + 临时件上注入的水印;任一插入 !ok 即整批不落',
        LAND_MSG: msg,
      },
    })
    return /CAS 成功|提交面回读/.test(out)
      ? { ok: true }
      : { ok: false, why: `落地器输出未自证成功,末行:${out.split('\n').filter(Boolean).slice(-1)[0] ?? ''}` }
  } catch (error) {
    return { ok: false, why: `落地失败:${String(error?.message ?? error).slice(0, 160)}` }
  }
}

/** 自检:用**真 HEAD 面**当底 + 构造屏计划,证明三件事:齐则出 blob、面取不到则整批不落、重复插则自拒 */
function selfTest() {
  const stamp = (name, text) => hashBytes(`${text}\n// selftest:${name}\n`)
  const fakePlan = (route, subRoot = 'pkg-user') => ({
    spec: `packages/app/src/features/${route}/${route}Screen.tsx`,
    route: `${subRoot}/${route}/index`,
    subRoot,
    page: `${route}/index`,
    pageRel: `apps/miniapp-taro/src/${subRoot}/${route}/index.tsx`,
    pageText: `// 镜像 packages/app/src/features/${route}/${route}Screen.tsx\nexport default function P(){return null}\n`,
    registryEntry: {
      shared: `packages/app/src/features/${route}/${route}Screen.tsx`,
      rn: `apps/mobile-rn/src/screens/${route}Screen.tsx`,
      miniapp: `${subRoot}/${route}/index`,
    },
    langBlocks: [],
  })
  // 容量表的测试替身:公式本身在 lib 里测,这里只证"闸接上了、取不到不放行、到量挡下"
  const capModel = ({ bytes = 0, entry = 0 } = {}) =>
    JSON.stringify({
      schema: 1,
      limitBytes: 2097152,
      safetyRatio: 0.95,
      bytesPerShellPage: 1000,
      roots: { 'pkg-user': { bytes, mirrorEntriesAtMeasure: entry, chunkReserveBytes: 0 } },
    })
  const capRegistry = (n = 0) =>
    JSON.stringify({ entries: Array.from({ length: n }, (_, i) => ({ shared: `s${i}`, rn: `r${i}`, miniapp: `pkg-user/p${i}/index` })) })
  const okHead = (rel) => (rel === MP_CONFIG || rel === REGISTRY ? headBlob(rel) : '')
  const cases = [
    {
      name: '两枚齐 ⇒ 出 blob(2 页 + config + registry = 4)',
      want: 4,
      got: () => assembleBlobs([fakePlan('selftestAa'), fakePlan('selftestBb')], { headOf: okHead, watermarkOf: stamp }).files?.length,
    },
    {
      name: 'app.config 的面取不到 ⇒ 未判定,整批不落(不造有页无路由的孤儿)',
      want: false,
      got: () => assembleBlobs([fakePlan('selftestAa')], { headOf: () => null, watermarkOf: stamp }).ok,
    },
    {
      name: '登记表取不到 ⇒ 同样整批不落',
      want: false,
      got: () => assembleBlobs([fakePlan('selftestAa')], { headOf: (rel) => (rel === REGISTRY ? null : headBlob(rel)), watermarkOf: stamp }).ok,
    },
    {
      name: '同一枚页插第二遍 ⇒ 插入函数自拒 ⇒ 整批不落(幂等靠拒,不靠静默)',
      want: false,
      got: () => {
        const first = assembleBlobs([fakePlan('selftestCc')], { headOf: okHead, watermarkOf: stamp })
        const cfgAfter = first.ok ? git(['cat-file', 'blob', first.files.find((f) => f.path === MP_CONFIG).blob]) : null
        const regAfter = first.ok ? git(['cat-file', 'blob', first.files.find((f) => f.path === REGISTRY).blob]) : null
        const after = { [MP_CONFIG]: cfgAfter, [REGISTRY]: regAfter }
        return assembleBlobs([fakePlan('selftestCc')], { headOf: (rel) => after[rel] ?? okHead(rel), watermarkOf: stamp }).ok
      },
    },
    // ---------- 撞车重装腿(2026-10-29 立):装配到提交之间是分钟级窗口,而接缝面几乎每分钟被
    // 别席推进一笔 ⇒ 「只试一次,下轮再试」在本仓节律下等价于结构性零产出。这三例把新行为钉住:
    // ① 撞一次要按**新面**重算产物;② 已落则绝不重试(重试=把同一批页再落一遍);③ 撞不开就停在
    // 上限并记未判定(不记绿,也不静默多跑)。
    {
      name: '落地器拒一次 ⇒ 第二轮现读新 HEAD 重装配(产物同含别席新字节与本批行)',
      want: true,
      got: () => {
        const regFace0 = headBlob(REGISTRY)
        const seen = []
        const r = runPages({
          apply: true,
          cap: 1,
          planOf: () => ({ planned: [fakePlan('selftestR2')], refused: [], undetermined: [] }),
          gateOf: (arr) => ({ ok: true, admitted: arr, held: [], moves: [] }),
          headOf: (rel) => {
            if (rel === MP_CONFIG) return headBlob(MP_CONFIG)
            if (rel === REGISTRY)
              return seen.length === 0
                ? regFace0
                : regFace0.replace(/"comment"\s*:\s*"[^"]*"/, '"comment":"R2FACEPEER"')
            return null
          },
          landOf: ({ built }) => {
            seen.push(built.files.find((f) => f.path === REGISTRY)?.blob)
            return seen.length >= 2 ? { ok: true } : { ok: false, why: '假 CAS 冲突' }
          },
        })
        if (r.state !== 'landed' || r.attempts !== 2) return false
        const first = git(['cat-file', 'blob', seen[0]])
        const second = git(['cat-file', 'blob', seen[1]])
        return (
          !first.includes('R2FACEPEER') &&
          second.includes('R2FACEPEER') &&
          second.includes('pkg-user/selftestR2/index')
        )
      },
    },
    {
      name: '落地器未自证成功而页已按被审面在树 ⇒ 判已落且**只调一次**(重试会变重复提交)',
      want: true,
      got: () => {
        let calls = 0
        const r = runPages({
          apply: true,
          cap: 1,
          planOf: () => ({ planned: [fakePlan('selftestIdem')], refused: [], undetermined: [] }),
          gateOf: (arr) => ({ ok: true, admitted: arr, held: [], moves: [] }),
          headOf: (rel) => {
            if (rel === MP_CONFIG || rel === REGISTRY) return headBlob(rel)
            return rel.includes('selftestIdem') ? '// 已落在树上' : null
          },
          landOf: () => {
            calls += 1
            return { ok: false, why: '假:输出未自证成功' }
          },
        })
        return r.state === 'landed' && calls === 1 && r.attempts === 1
      },
    },
    {
      name: '始终撞不开 ⇒ 停在上限、记未判定(次数被数出来,不静默多跑)',
      want: true,
      got: () => {
        const prev = process.env.IHUI_CROSS_END_LAND_ATTEMPTS
        process.env.IHUI_CROSS_END_LAND_ATTEMPTS = '2'
        let calls = 0
        try {
          const r = runPages({
            apply: true,
            cap: 1,
            planOf: () => ({ planned: [fakePlan('selftestCap')], refused: [], undetermined: [] }),
            gateOf: (arr) => ({ ok: true, admitted: arr, held: [], moves: [] }),
            headOf: (rel) => (rel === MP_CONFIG || rel === REGISTRY ? headBlob(rel) : null),
            landOf: () => {
              calls += 1
              return { ok: false, why: '假:一直撞' }
            },
          })
          return r.state === 'undetermined' && calls === 2 && r.attempts === 2
        } finally {
          if (prev === undefined) delete process.env.IHUI_CROSS_END_LAND_ATTEMPTS
          else process.env.IHUI_CROSS_END_LAND_ATTEMPTS = prev
        }
      },
    },
    // ---------- 账本自刷腿(注入替身:不为测试去跑真生成器,也不让测试碰真 HEAD) ----------
    {
      name: '账本自刷:产文 == HEAD ⇒ clean 且一枚都不落(常态零写)',
      want: 'clean/0',
      got: () => {
        const text = '// [IHUI-AI-PROVENANCE]:x\n镜像 120 / 共享屏 218\n'
        let calls = 0
        const r = syncParityDoc({
          generate: () => ({ ok: true, text }),
          headOf: () => text,
          landOf: () => {
            calls += 1
            return { ok: true }
          },
        })
        return `${r.state}/${calls}`
      },
    },
    {
      name: '账本自刷:产文 ≠ HEAD ⇒ 恰好落一次并 landed',
      want: 'landed/1',
      got: () => {
        let calls = 0
        const r = syncParityDoc({
          generate: () => ({ ok: true, text: '// [IHUI-AI-PROVENANCE]:x\n镜像 122 / 共享屏 218\n' }),
          headOf: () => '// [IHUI-AI-PROVENANCE]:x\n镜像 120 / 共享屏 218\n',
          landOf: () => {
            calls += 1
            return { ok: true }
          },
        })
        return `${r.state}/${calls}`
      },
    },
    {
      name: '账本自刷:产文缺横幅且注入也补不上 ⇒ 未判定,一枚都不落(落了就是洗载荷,§5c)',
      want: 'undetermined/0',
      got: () => {
        let calls = 0
        const r = syncParityDoc({
          generate: () => ({ ok: true, text: '镜像 120 / 共享屏 218\n' }),
          watermarkOf: (t) => t, // 替身:注入器没补上横幅(真器物缺脚本时就是这个形状)
          headOf: () => '// [IHUI-AI-PROVENANCE]:x\n旧\n',
          landOf: () => {
            calls += 1
            return { ok: true }
          },
        })
        return `${r.state}/${calls}`
      },
    },
    {
      name: '账本自刷:产文没横幅但注入补上了 ⇒ 照常比对并落一次(不因此长挂 doc-stale)',
      want: 'landed/1',
      got: () => {
        let calls = 0
        const r = syncParityDoc({
          generate: () => ({ ok: true, text: '镜像 124 / 共享屏 218\n' }),
          watermarkOf: (t) => `// [IHUI-AI-PROVENANCE]:x\n${t}`,
          headOf: () => '// [IHUI-AI-PROVENANCE]:x\n镜像 120 / 共享屏 218\n',
          landOf: () => {
            calls += 1
            return { ok: true }
          },
        })
        return `${r.state}/${calls}`
      },
    },
    {
      name: '账本自刷:落地器未自证成功 ⇒ pending(绝不读成"已同步")',
      want: 'pending/1',
      got: () => {
        let calls = 0
        const r = syncParityDoc({
          generate: () => ({ ok: true, text: '// [IHUI-AI-PROVENANCE]:x\n新\n' }),
          headOf: () => '// [IHUI-AI-PROVENANCE]:x\n旧\n',
          landOf: () => {
            calls += 1
            return { ok: false, why: 'CAS 撞上并发推进' }
          },
        })
        return `${r.state}/${calls}`
      },
    },
    {
      name: '账本自刷:生成器没跑成 ⇒ 未判定(取不到产文不冒充判过)',
      want: 'undetermined/0',
      got: () => {
        let calls = 0
        const r = syncParityDoc({
          generate: () => ({ ok: false, err: 'boom' }),
          headOf: () => 'x',
          landOf: () => {
            calls += 1
            return { ok: true }
          },
        })
        return `${r.state}/${calls}`
      },
    },
    {
      name: '账本自刷:落地信息里取的是**读数行**,不是标题(上一版 /镜像[^\\n]*/ 抓到标题"…镜像缺口账本",等于自证信息说谎)',
      want: '镜像 123 · 缺口 95',
      got: () => {
        let seen = ''
        const text =
          '// [IHUI-AI-PROVENANCE]:x\n# RN → 小程序 镜像缺口账本(自动生成)\n- 已被小程序显式镜像: **123**\n- 缺口合计: **95**(其中已判定 95 / 未判定 0)\n'
        syncParityDoc({
          generate: () => ({ ok: true, text }),
          headOf: () => '// [IHUI-AI-PROVENANCE]:x\n旧\n',
          landOf: (_t, nums) => {
            seen = nums
            return { ok: true }
          },
        })
        return seen
      },
    },
    // ---------- 折叠口径(页面批 × 账本腿)----------
    {
      name: '折叠:页面 clean + 账本 landed ⇒ 整轮 landed 且 blob+1(写了东西不许报"零写零推")',
      want: 'landed/1',
      got: () => {
        const o = foldDocResult({ state: 'clean', planned: 0, blobs: 0, note: '无缺口' }, { state: 'landed' })
        return `${o.state}/${o.blobs}`
      },
    },
    {
      name: '折叠:页面 clean + 账本未判定 ⇒ 整轮降级未判定(§0.3 不冒绿)',
      want: 'undetermined',
      got: () => foldDocResult({ state: 'clean', planned: 0 }, { state: 'undetermined', why: '取不到产文' }).state,
    },
    {
      name: '折叠:页面 landed + 账本 clean ⇒ 保持 landed(账本一致不许把落页读回 clean)',
      want: 'landed',
      got: () => foldDocResult({ state: 'landed', planned: 3, batch: ['a', 'b'], blobs: 6 }, { state: 'clean' }).state,
    },
    {
      name: '折叠:页面 clean + 账本 pending ⇒ 仍 clean 但 note 点名(没落地不等于没差异)',
      want: 1,
      got: () => {
        const o = foldDocResult({ state: 'clean', planned: 0, note: '本轮没有可产的屏' }, { state: 'pending', why: 'CAS' })
        return /账本有差异但没落地/.test(o.note ?? '') ? 1 : 0
      },
    },
    // ---------- 接缝④ 单行 pages 数组(2026-10-26 实测会永久停摆的那型) ----------
    {
      name: '接缝④:单行 pages 数组也能插(仓内 8 个 root 是这种形态,旧实现整批拒 ⇒ 链永久停摆)',
      want: 'ok/true',
      got: () => {
        const r = insertConfigPage(headBlob(MP_CONFIG), 'pages/setting', 'selftest-inline/index')
        return `${r.ok ? 'ok' : 'fail'}/${String(r.text ?? '').includes(`'selftest-inline/index'`)}`
      },
    },
    {
      name: '接缝④:多行 pages 数组仍按行插(不许把既有形态改成单行)',
      want: 'ok/multiline',
      got: () => {
        const r = insertConfigPage(headBlob(MP_CONFIG), 'pkg-user', 'selftest-multi/index')
        return `${r.ok ? 'ok' : 'fail'}/${r.shape}`
      },
    },
    // ---------- 容量闸(单分包 2 MiB)----------
    {
      name: '容量闸:容量表取不到 ⇒ 整轮不放行(不猜,§0.10 失效方向是多要一次说明)',
      want: false,
      got: () => capacityGate([fakePlan('capA')], { cap: 5, headOf: () => null }).ok,
    },
    {
      name: '容量闸:有余额 ⇒ 放行(registry 在册数未到上限)',
      want: '1/0',
      got: () => {
        const headOf = (rel) => (rel === CAPACITY_REL ? capModel({ entry: 0 }) : rel === REGISTRY ? capRegistry(1) : null)
        const g = capacityGate([fakePlan('capB')], { cap: 5, headOf })
        return `${g.admitted.length}/${g.held.length}`
      },
    },
    {
      name: '容量闸:到量 ⇒ 本枚 held 并点名原因(不再静默超灌分包)',
      want: '0/1',
      got: () => {
        const headOf = (rel) => (rel === CAPACITY_REL ? capModel({ bytes: 1992294 }) : rel === REGISTRY ? capRegistry(1) : null)
        const g = capacityGate([fakePlan('capC')], { cap: 5, headOf })
        return `${g.admitted.length}/${g.held.length}`
      },
    },
    {
      name: '容量闸:root 无测量 ⇒ held(未知分包不许当"容量很足")',
      want: '0/1',
      got: () => {
        const headOf = (rel) => (rel === CAPACITY_REL ? capModel({ entry: 0 }) : rel === REGISTRY ? capRegistry(0) : null)
        const g = capacityGate([fakePlan('capD', 'pkg-unknown')], { cap: 5, headOf })
        return `${g.admitted.length}/${g.held.length}`
      },
    },
    // ---------- 接缝④b 新建分包 root(容量改道的前提)----------
    {
      name: '接缝④b:目标 root 不在册 ⇒ 建块并回读自证(溢出分包是容量判据现开出来的)',
      want: 'ok/true/true',
      got: () => {
        const cfg = `export default defineAppConfig({\n  pages: ['pages/index/index'],\n  subPackages: [\n    {\n      root: 'pkg-user',\n      pages: [\n        'a/index',\n      ],\n    },\n  ],\n})\n`
        const r = insertConfigRoot(cfg, 'pkg-mirror', 'x/index')
        const again = parseMiniappRoutes(r.text ?? '').blocks.some((m) => m[1] === 'pkg-mirror')
        return `${r.ok ? 'ok' : 'fail'}/${String(r.text ?? '').includes("root: 'pkg-mirror'")}/${again}`
      },
    },
    {
      name: '接缝④b:整批装配时目标 root 不存在也不拒(assembleBlobs 走建块腿)',
      want: true,
      got: () => {
        const r = assembleBlobs([fakePlan('selftestNewRoot', 'pkg-selftest-new')], { headOf: okHead, watermarkOf: stamp })
        if (!r.ok) return false
        const cfgBlob = r.files.find((f) => f.path === MP_CONFIG)?.blob
        return /pkg-selftest-new/.test(git(['cat-file', 'blob', cfgBlob]))
      },
    },
    {
      name: '容量改道:语义包装不下 ⇒ 本批这枚改落到 overflow 分包(路由四字段一起改)',
      want: 'pkg-mirror/mv1/index',
      got: () => {
        const model = JSON.stringify({
          schema: 1,
          limitBytes: 2097152,
          safetyRatio: 0.95,
          bytesPerShellPage: 1000,
          overflowRoots: ['pkg-mirror'],
          roots: {
            'pkg-user': { bytes: 1992000, mirrorEntriesAtMeasure: 0, chunkReserveBytes: 0 },
            'pkg-mirror': { bytes: 0, mirrorEntriesAtMeasure: 0, chunkReserveBytes: 0 },
          },
        })
        const headOf = (rel) => (rel === CAPACITY_REL ? model : rel === REGISTRY ? capRegistry(0) : null)
        const g = capacityGate([fakePlan('mv1')], { cap: 5, headOf })
        return g.admitted?.[0]?.route
      },
    },
    // ---------- 一屏接缝失败不许拖死整批 ----------
    {
      name: '摘屏:一屏接缝失败 ⇒ 只摘肇事那屏,其余照落(跳过的必须点名)',
      want: '2/1/bad',
      got: () => {
        const plans = [fakePlan('okA'), fakePlan('bad'), fakePlan('okB')]
        const r = buildWithDrops(plans, (arr) =>
          arr.some((p) => p.route.endsWith('/bad/index'))
            ? { ok: false, why: '词包并键档不支持', culprit: 'pkg-user/bad/index' }
            : { ok: true, files: [] },
        )
        return `${r.batch.length}/${r.dropped.length}/${r.dropped[0]?.route.includes('bad') ? 'bad' : '?'}`
      },
    },
    {
      name: '摘屏:失败不带 culprit ⇒ 一枚都不摘(不猜肇事者,整批照旧 blocked)',
      want: '0/0',
      got: () => {
        const r = buildWithDrops([fakePlan('okC')], () => ({ ok: false, why: 'HEAD 面取不到' }))
        return `${r.dropped.length}/${r.batch.length - r.batch.length}`
      },
    },
  ]
  let pass = 0
  for (const c of cases) {
    let got
    try {
      got = c.got()
    } catch (error) {
      got = `throw:${String(error?.message ?? error).slice(0, 60)}`
    }
    const ok = got === c.want
    console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
    if (ok) pass += 1
  }
  console.log(pass === cases.length ? `自检 ${pass}/${cases.length} 通过` : `❌ 自检 ${pass}/${cases.length}`)
  process.exit(pass === cases.length ? 0 : 1)
}

const argv = process.argv.slice(2)
const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  if (argv.includes('--self-test')) selfTest()
  else {
    const capArg = argv.find((a) => a.startsWith('--cap='))
    const r = run({ apply: argv.includes('--apply'), cap: capArg ? Number(capArg.slice(6)) : DEFAULT_CAP })
    const summary = {
      face: 'head',
      state: r.state,
      planned: r.planned ?? 0,
      batch: r.batch?.length ?? 0,
      blobs: r.blobs ?? 0,
      refused: r.refused ?? 0,
      // 逐条拒因必须同时进 --json:这一层是**字段白名单**重新组装 summary,上一版只改了 runPages 的返回
      // 与打印档 ⇒ 打印看得见、调度器读的那份里根本没有这两个键(2026-10-28 实测:同一命令的 JSON 出口
      // `refusedDetail` 为空)。消费方(guardian 的 sweepCrossEndShellPages)读的正是 --json,漏这里=仪表没接线。
      refusedDetail: r.refusedDetail ?? [],
      undeterminedDetail: r.undeterminedDetail ?? [],
      cap: capArg ? Number(capArg.slice(6)) : DEFAULT_CAP,
      // 容量闸挡下几枚、为什么挡:到量时这是唯一能解释"为什么不再往前"的读数
      held: r.held?.length ?? 0,
      heldWhy: r.held?.[0]?.why ?? '',
      // 改道几枚(语义分包装不下 → 溢出分包),让日志能解释"这屏怎么落到 pkg-mirror 去了"
      moved: r.moves?.length ?? 0,
      movedTo: [...new Set((r.moves ?? []).map((m) => m.to))].join(','),
      // 因接缝失败被摘掉几枚(如词包并键档不支持的屏);跳过必须可见,不许静默
      dropped: r.dropped?.length ?? 0,
      droppedWhy: r.dropped?.[0]?.why ?? '',
      doc: r.doc ?? 'skipped',
      why: r.why ?? '',
      note: r.note ?? '',
    }
    // 调度器(git-guardian 的 sweepCrossEndShellPages)读的是这份 JSON,不是那行人读行
    // ——同 repair-cross-end-mirror 的口径:消费方不许手抄生产方的输出形状。
    if (argv.includes('--json')) console.log(JSON.stringify({ summary }))
    else {
      console.log(
        `CROSS-END-SHELL-PAGES state=${r.state} planned=${r.planned ?? 0}${r.batch ? ` 本轮=${r.batch.length}` : ''}${r.blobs ? ` blob=${r.blobs}` : ''}${r.refused !== undefined ? ` 拒=${r.refused}` : ''}`,
      )
      if (r.note) console.log(`  ${r.note}`)
      if (r.why) console.log(`  ${r.why}`)
      for (const d of r.refusedDetail || []) console.log(`   · 拒:${d}`)
      for (const d of r.undeterminedDetail || []) console.log(`   · 未判定:${d}`)
    }
    process.exit(r.state === 'clean' || r.state === 'pending' || r.state === 'landed' ? 0 : r.state === 'blocked' ? 1 : 2)
  }
}

export const __test__ = { buildWithDrops, assembleBlobs, writePackText, run, runPages, capacityGate, syncParityDoc, foldDocResult, syncShellTypes, foldShellTypesResult, SHELL_DECL, PARITY_DOC, CAPACITY_REL, DEFAULT_CAP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
