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

function run({ apply, cap = DEFAULT_CAP, headless = false } = {}) {
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

export const __test__ = { assembleBlobs, writePackText, run, DEFAULT_CAP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
