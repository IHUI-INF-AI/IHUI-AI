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
 *  1) 每轮上限 `--cap`(默认 5 枚):造页会改包体,一次灌 96 枚会把主包顶过微信 2MB 硬上限
 *     (现读主包余量只有几百 KB,config 注释里那笔同名相撞的账还在)⇒ 逐轮推进可回退,一把梭不可回退。
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
  insertJsonMembers,
  insertRegistryEntry,
  mergeJsonMembers,
  planBatch,
} from './gen-miniapp-mirror.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const R = (...p) => join(ROOT, ...p)
const TMP = join(ROOT, '.ihui-agent', 'tmp', 'land-cross-end-shell-pages')
const MP_CONFIG = 'apps/miniapp-taro/src/app.config.ts'
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
// 缺口账本(漂移尺 doc-stale 那一维的正文)—— 落完页必须按新 HEAD 再刷一次,否则每批都留一格旧数叫人来看
const PARITY_DOC = 'docs/engineering/rn-miniapp-parity-matrix.md'
const DEFAULT_CAP = 5

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
    const r = insertConfigPage(cfg, p.subRoot, p.page)
    if (!r.ok) return { ok: false, why: `app.config 插路由 ${p.route}:${r.why}` }
    cfg = r.text
  }
  files.push({ path: MP_CONFIG, blob: hashBytes(cfg) })

  const reg0 = headOf(REGISTRY)
  if (typeof reg0 !== 'string') return { ok: false, why: `HEAD 面取不到 ${REGISTRY} ⇒ 未判定,整批不落` }
  let reg = reg0
  for (const p of planned) {
    const r = insertRegistryEntry(reg, p.registryEntry)
    if (!r.ok) return { ok: false, why: `registry 插条目 ${p.registryEntry.shared}:${r.why}` }
    reg = r.text
  }
  files.push({ path: REGISTRY, blob: hashBytes(reg) })

  const packs = new Map()
  for (const p of planned) {
    for (const lb of p.langBlocks) {
      if (!packs.has(lb.packRel)) {
        const t0 = headOf(lb.packRel)
        if (typeof t0 !== 'string') return { ok: false, why: `HEAD 面取不到词包 ${lb.packRel} ⇒ 未判定,整批不落` }
        packs.set(lb.packRel, t0)
      }
      const r = writePackText(packs.get(lb.packRel), lb.groups, lb.members)
      if (!r.ok) return { ok: false, why: `词包 ${lb.packRel}(${p.route}):${r.why}` }
      packs.set(lb.packRel, r.text)
    }
  }
  for (const [rel, text] of packs) files.push({ path: rel, blob: hashBytes(text) })
  return { ok: true, files, packs: packs.size }
}

/** 新源文件必须带溯源水印(§5c):在临时件上注入后取字节,不动工作树的真文件 */
function watermarkBytesOf(name, text) {
  mkdirSync(TMP, { recursive: true })
  const p = join(TMP, `${name.replace(/[\\/]/g, '_')}.tsx`)
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
  const fresh = gen.text
  if (!/\[IHUI-AI-PROVENANCE\]:/.test(fresh)) {
    return { state: 'undetermined', why: '产文缺水位横幅 ⇒ 不落(落了就是洗载荷)' }
  }
  let headText = null
  try {
    headText = headOf(PARITY_DOC)
  } catch {
    return { state: 'undetermined', why: `HEAD 面取不到 ${PARITY_DOC}` }
  }
  if (headText === null || headText === undefined) return { state: 'undetermined', why: `HEAD 面取不到 ${PARITY_DOC}` }
  if (headText === fresh) return { state: 'clean' }
  const landed = landOf(fresh, (fresh.match(/镜像[^\n]*/) || ['?'])[0].slice(0, 40))
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
 * run 的最外层包装:页面批 + 账本自刷。
 * 账本只在真落地档(--apply 且非 headless)刷 —— 预演档不该动 HEAD。
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
  return foldDocResult(r, doc)
}

function runPages({ apply, cap = DEFAULT_CAP, headless = false } = {}) {
  const { planned, refused, undetermined } = planBatch(ROOT, { form: 'shell' })
  if (!planned) return { state: 'undetermined', why: '批量计划读不到 planned 集' }
  if (planned.length === 0) {
    return {
      state: 'clean',
      planned: 0,
      refused: refused?.length ?? 0,
      undetermined: undetermined?.length ?? 0,
      note: '本轮没有可产的屏(缺口要么已落、要么被造页器按三腿判据拒/未判定)',
    }
  }
  const batch = planned.slice(0, cap)
  const built = assembleBlobs(batch, { headOf: headBlob, watermarkOf: (n, t) => hashBytes(watermarkBytesOf(n, t)) })
  if (!built.ok) return { state: 'blocked', why: built.why, planned: planned.length }

  if (!apply || headless) {
    return {
      state: 'pending',
      planned: planned.length,
      batch: batch.map((p) => p.route),
      blobs: built.files.length,
      note: apply ? 'headless 档:只算不落' : '预演模式:加 --apply 落地',
    }
  }
  const manifest = join(ROOT, '.ihui-agent', 'tmp', 'land-cross-end-shell-pages', 'blobs.json')
  mkdirSync(dirname(manifest), { recursive: true })
  writeFileSync(manifest, JSON.stringify({ files: built.files }, null, 1), 'utf8')
  const msg = [
    `chore(cross-end): 自动落 ${batch.length} 枚小程序壳承载页(共 ${planned.length} 枚待产)`,
    '',
    `器物:node scripts/land-cross-end-shell-pages.mjs --apply(cap=${cap},每轮上限,防一次灌爆主包)`,
    '形制:端内零布局零样式 —— 渲染源 = packages/app 共享屏(经 src/rn-compat),数据与交互 = 同名 RN 壳。',
    '接缝:app.config 路由行 + 跨端登记表 + 词包(两档:全新命名空间按行插,已在册转并键档,不覆盖既有值)。',
    '内容构造法:全部 blob = git show HEAD:<file> ⊕ 本批行,由造页器自己的插入函数产;工作树一字节未读',
    `(那是为了不在他人未提交改动上落我的行 —— §12 防吞现场;旁路落地不自跑钩子,故守门 251/128/237 在下一轮提交或巡检里复量)。`,
    '',
    `页面:${batch.map((p) => `${p.spec} → ${p.route}`).join('; ')}`,
  ].join('\n')
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
    const ok = /CAS 成功|提交面回读/.test(out)
    return {
      state: ok ? 'landed' : 'undetermined',
      planned: planned.length,
      batch: batch.map((p) => p.route),
      blobs: built.files.length,
      note: ok ? 'CAS 成功且按被审面回读在树' : `落地器输出未自证成功,末行:${out.split('\n').filter(Boolean).slice(-1)[0] ?? ''}`,
    }
  } catch (error) {
    return { state: 'undetermined', why: `落地失败:${String(error?.message ?? error).slice(0, 160)}`, planned: planned.length }
  }
}

/** 自检:用**真 HEAD 面**当底 + 构造屏计划,证明三件事:齐则出 blob、面取不到则整批不落、重复插则自拒 */
function selfTest() {
  const stamp = (name, text) => hashBytes(`${text}\n// selftest:${name}\n`)
  const fakePlan = (route) => ({
    spec: `packages/app/src/features/${route}/${route}Screen.tsx`,
    route: `pkg-user/${route}/index`,
    subRoot: 'pkg-user',
    page: `${route}/index`,
    pageRel: `apps/miniapp-taro/src/pkg-user/${route}/index.tsx`,
    pageText: `// 镜像 packages/app/src/features/${route}/${route}Screen.tsx\nexport default function P(){return null}\n`,
    registryEntry: {
      shared: `packages/app/src/features/${route}/${route}Screen.tsx`,
      rn: `apps/mobile-rn/src/screens/${route}Screen.tsx`,
      miniapp: `pkg-user/${route}/index`,
    },
    langBlocks: [],
  })
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
      name: '账本自刷:产文缺水位横幅 ⇒ 未判定,一枚都不落(落了就是洗载荷,§5c)',
      want: 'undetermined/0',
      got: () => {
        let calls = 0
        const r = syncParityDoc({
          generate: () => ({ ok: true, text: '镜像 120 / 共享屏 218\n' }),
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
      cap: capArg ? Number(capArg.slice(6)) : DEFAULT_CAP,
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
    }
    process.exit(r.state === 'clean' || r.state === 'pending' || r.state === 'landed' ? 0 : r.state === 'blocked' ? 1 : 2)
  }
}

export const __test__ = { assembleBlobs, writePackText, run, runPages, syncParityDoc, foldDocResult, PARITY_DOC, DEFAULT_CAP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
