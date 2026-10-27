// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * heal-derived-in-checkout.mjs —— 派生产物的**按面重生成**出口(2026-10-27 立)
 *
 * 为什么"在盘上跑生成器"这一档不够(两条实测,同一根因):
 *   · 离线包自愈腿第一次真跑就 refused:生成器读的是工作树,而本仓工作树常年 ≠ HEAD
 *     (旁路落地只推进 HEAD/索引,不写工作树 —— AGENTS §5b④ 记的那条"落地欠回写"债)。
 *   · 四端 ui-routes 的写回档把 web 与小程序两份判成"磁盘钉 ≠ 面上现算钉"而拒落,
 *     差的正是 `apps/web/app/(main)/admin/monitor/wallboard/page.tsx`、`apps/miniapp-taro/src/constants/storage.ts`
 *     这类**输入的工作树副本**。拒落是对的(不许把别人的未提交/滞后字节烘进派生件),
 *     但那时守门 105 的 G5 是 blocking 且每次提交都跑 ⇒ 红会留给下一枚毫不相干的提交(§12e 恒红门)。
 *
 * 所以正确出路不是"更敢覆盖",而是**让生成器看的和门判的是同一份东西**:
 *   ① 以当前 HEAD 建一枚 detached 检出(§12h 规定的落点 `.worktrees/`,深度 1 在门 208 射程外);
 *   ② 检出里的生成器读的就是 HEAD 的字节 ⇒ 产出的自述钉按构造等于面上现算;
 *   ③ 复量:新钉 digest 必须等于门那侧在同一张面上现算的 digest,不等 ⇒ 不落(器物不自证空转);
 *   ④ 只落 blob 到 HEAD(object-space-land),**不写主工作树一个字**(别人的现场归别人);
 *   ⑤ 检出用完即摘(detached、零新提交 ⇒ §12h 的"未合并检出不许静默删"不适用:没有未合并内容)。
 *
 * 三态与纪律(与另两条腿一致):
 *   clean —— 面上钉与现算同值 ⇒ 零动作(绝大多数轮次)
 *   landed —— 重生成 + 复量 + 落 HEAD
 *   refused —— 建检出失败 / 生成器失败 / 复量不等 / 落地器没自证成功 ⇒ 一律点名,**绝不冒绿**
 *   undetermined —— 面上取不到产物或输入(§0.3:没判不猜)
 *
 * 用法:
 *   node scripts/heal-derived-in-checkout.mjs            # 两族都看(离线包 + 四端 ui-routes)
 *   node scripts/heal-derived-in-checkout.mjs --family i18n|ui-routes
 *   node scripts/heal-derived-in-checkout.mjs --json     # 结论走 JSON(守护读 summary)
 *   node scripts/heal-derived-in-checkout.mjs --self-test
 * 调度器:scripts/git-guardian.mjs 巡检轮 `healDerivedInCheckoutLeg`(30 分钟节流)。
 * 判机器状态 ⇒ 不进提交链(§12e);在提交链里跑=逼人人等一次检出+生成,那是分钟级。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FACE_LABEL, Undetermined, selectFace } from './lib/face-reader.mjs'
import { digestInputs, parsePin } from './lib/generated-input-pin.mjs'
import { classifyCopyDelta, mayOverwrite } from './lib/derived-copy-state.mjs'
import { hashText } from './lib/land-derived-blobs.mjs'
import { landBlobs } from './lib/land-derived-blobs.mjs'
/** 离线包一次生成的全部落点(7 份):钉/清单/内联包互相引用 version,4 份 CDN 载荷与钉同批 ⇒ 必须一次带走 */
export const I18N_OUTPUTS = [
  'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts',
  'apps/miniapp-taro/src/i18n/generated/remote-locale-manifest.gen.ts',
  'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts',
  'apps/miniapp-taro/src/assets/remote-locales/en.b64.txt',
  'apps/miniapp-taro/src/assets/remote-locales/ja.b64.txt',
  'apps/miniapp-taro/src/assets/remote-locales/ko.b64.txt',
  'apps/miniapp-taro/src/assets/remote-locales/zh-TW.b64.txt',
]
import { __test__ as gate105 } from './check-miniapp-generated.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 检出落点:仓库根直属 `.worktrees/`(§12h),门 208 对深度 1 的 linked worktree 是有意豁免 */
export const CHECKOUT_SLOT = 'derived-heal'
export const checkoutPathOf = (root = ROOT, slot = CHECKOUT_SLOT) => join(root, '.worktrees', slot)

/** 一次判定的输入族:离线包(1 份产物)与四端 ui-routes(4 份产物) */
export const FAMILIES = ['i18n', 'ui-routes']

/** 离线包一次重生成的量级上限:整包重写 ≈ 955 KB,留一倍余量;超过就是口径异常,不自动背书 */
export const MAX_I18N_BYTES = 2_500_000

function git(args, cwd = ROOT, opts = {}) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true, // §5b:守护在 session 0,漏了会弹控制台窗
    timeout: opts.timeout ?? 5 * 60 * 1000, // 守门 80:热路径派生一律带上限
    maxBuffer: opts.maxBuffer ?? 1 << 24,
    // 带 input 必须三通道全 pipe(§12g 样板);否则 stdin 写不进去
    stdio: opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    ...(opts.input === undefined ? {} : { input: opts.input }),
  })
}

/**
 * 建 detached 检出并交给 work 使用;**保证**收尾摘除(异常也摘)。
 * 已有同名检出 ⇒ 先摘旧的(它只可能是上一轮崩溃的残留:本器从不往里提交)。
 */
export function withHeadCheckout({
  root = ROOT,
  slot = CHECKOUT_SLOT,
  work,
  run = git,
  logger = () => {},
}) {
  const dir = checkoutPathOf(root, slot)
  // 先把这一轮钉在**一枚具体提交**上:后面"面上现算"的期望值与检出里的字节必须同源。
  // 现场(2026-10-27):一枚 chore(cross-end) 插在本器"判面 → 建检出 → 生成"之间,
  // 于是对着旧面算的期望值比对新面产出的字节 ⇒ 本来正确的产物被误判成"钉不等"而整轮拒落。
  let baseSha = ''
  try {
    baseSha = String(run(['rev-parse', 'HEAD'], root)).trim()
  } catch {
    return { ok: false, why: 'HEAD sha 取不到 ⇒ 这一轮没法钉在同一枚提交上,不动手(§0.3)' }
  }
  if (!/^[0-9a-f]{40}$/.test(baseSha))
    return { ok: false, why: `HEAD sha 形态不对:${baseSha.slice(0, 20)}` }
  const remove = () => {
    try {
      run(['worktree', 'remove', '--force', dir], root, { timeout: 5 * 60 * 1000 })
    } catch {
      try {
        rmSync(dir, { recursive: true, force: true })
        run(['worktree', 'prune'], root)
      } catch (e) {
        logger(
          `⚠️ 检出残留摘不掉(${String(e?.message ?? e).slice(0, 80)})——不影响本轮结论,交下轮或人工`,
        )
      }
    }
  }
  remove() // 先扫残留
  try {
    run(['worktree', 'add', '--detach', dir, baseSha], root, {
      timeout: 10 * 60 * 1000,
      maxBuffer: 1 << 25,
    })
  } catch (e) {
    return {
      ok: false,
      why: `建 HEAD 检出失败:${String(e?.stderr ?? e?.message ?? e).slice(0, 200)}`,
    }
  }
  try {
    return { ok: true, dir, baseSha, result: work({ dir, root, baseSha }) }
  } finally {
    remove()
  }
}

/** 在检出里跑一份生成器(它按自己的位置推仓库根,所以 cwd 必须是检出) */
function runGeneratorIn(dir, generatorRel, args = [], timeoutMs = 20 * 60 * 1000) {
  const script = join(dir, generatorRel)
  if (!existsSync(script)) return { ok: false, why: `检出里没有生成器 ${generatorRel}` }
  try {
    execFileSync(process.execPath, [script, ...args], {
      cwd: dir,
      // 检出里没有 node_modules(pnpm 依赖是机器态、不入库)⇒ 借主仓依赖面,否则
      // 生成器第一行 require('fflate') 就炸(2026-10-27 第一次真跑实测)。依赖不参与产物字节,
      // 产物只由"检出里那棵源码树"决定 ⇒ 借机器态不破坏"同面同轮"这条判据。
      env: {
        ...process.env,
        NODE_PATH: [
          join(ROOT, 'apps', 'miniapp-taro', 'node_modules'),
          join(ROOT, 'packages', 'i18n', 'node_modules'),
          join(ROOT, 'node_modules'),
        ].join(delimiter),
      },
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true }
  } catch (e) {
    const why = [e?.stderr, e?.stdout, e?.message, String(e)].find(
      (s) => String(s ?? '').trim().length > 0,
    )
    return { ok: false, why: String(why).trim().slice(0, 240) }
  }
}

/**
 * 离线包族:面上现算钉 ↔ 检出里重生成的钉。
 * 7 份落点一次带走(钉/清单/内联包 + 4 份 CDN 载荷 —— 它们是同一次生成的同一批字节,落一半会自相矛盾)。
 */
export function healI18nFamily({ face = 'head', root = ROOT, dir, reader = null }) {
  // 离线包这一族**不能在检出里生成**:生成器要 require('fflate')(pnpm 把依赖装在端内,
  // 检出里没有 node_modules),且它还要读承载页闭包。2026-10-27 实测两格:
  //   ① 检出里跑 → Cannot find module 'fflate';② 主仓里跑 --head(读 git 对象)→ 13 分钟级。
  // 所以这一族走"主仓 + 被审面"重跑,并在动手前过在飞副本闸(盘上那份必须可由生成器再生,
  // 否则是别席现场)—— 与检出档同一条判据 lib/derived-copy-state.mjs。
  const rd = reader || gate105.makeReader(face, root)
  const bundleRel = gate105.I18N_BUNDLE
  if (!rd.has(bundleRel))
    return { state: 'undetermined', why: `${FACE_LABEL[face]} 取不到 ${bundleRel}` }
  rd.prefetch([bundleRel, ...gate105.bundleInputRels(gate105.REMOTE_LOCALES, (rel) => rd.has(rel))])
  const faceText = rd.read(bundleRel)
  const facePin = parsePin(String(faceText ?? ''))
  if (!facePin.present || facePin.malformed) {
    return {
      state: 'undetermined',
      why: `面上产物的钉${facePin.present ? '读不出' : '不存在'}⇒ 无从判新旧`,
    }
  }
  const computed = digestInputs(gate105.readPinInputs(rd))
  if (computed.digest === facePin.digest) return { state: 'clean', digest: computed.digest }

  // 在飞副本闸:7 份落点里任何一份是"别席正写着的内容"就整轮拒(离线包是一次生成的同一批字节,落一半自相矛盾)
  const busy = []
  for (const rel of I18N_OUTPUTS) {
    const d = classifyCopyDelta({ rel, face, root })
    if (!mayOverwrite(d)) busy.push(`${rel.split('/').pop()}(${d.kind}:${d.why ?? '不同形'})`)
  }
  if (busy.length > 0) return { state: 'refused', why: `在飞副本闸:${busy.join('; ')}` }

  void dir
  const gen = runGeneratorInFace(root, 'scripts/gen-i18n-compressed.mjs', face)
  if (!gen.ok)
    return { state: 'refused', why: `主仓 ${FACE_LABEL[face]} 面生成器未跑成:${gen.why}` }

  const fresh = parsePin(String(readFileSync(join(root, bundleRel), 'utf8')))
  if (!fresh.present)
    return { state: 'refused', why: '重跑出来的产物没有自述钉 ⇒ 不落一份说不清自己从哪来的文件' }
  if (fresh.digest !== computed.digest) {
    return {
      state: 'refused',
      why: `新钉(${String(fresh.digest).slice(0, 12)}…)≠ 面上现算(${computed.digest.slice(0, 12)}…)⇒ 生成器与门不同形,不落半套`,
    }
  }
  const out = []
  let bytes = 0
  for (const rel of I18N_OUTPUTS) {
    const abs = join(root, rel)
    if (!existsSync(abs)) return { state: 'refused', why: `生成后读不回 ${rel}` }
    const text = readFileSync(abs, 'utf8')
    bytes += Buffer.byteLength(text)
    out.push({ path: rel, blob: hashText(root, text) })
  }
  if (bytes > MAX_I18N_BYTES) {
    return {
      state: 'refused',
      why: `一次重生成写回 ${bytes} 字节 > 上限 ${MAX_I18N_BYTES} ⇒ 异常量级,不自动背书`,
    }
  }
  return { state: 'ready', files: out, digest: computed.digest }
}

/** 在**主仓**里按被审面重跑离线包生成器(检出里跑不了:见 healI18nFamily 头注) */
function runGeneratorInFace(root, generatorRel, face, timeoutMs = 25 * 60 * 1000) {
  const script = join(root, generatorRel)
  if (!existsSync(script)) return { ok: false, why: `仓里没有生成器 ${generatorRel}` }
  const flag = face === 'staged' ? '--staged' : '--head'
  try {
    execFileSync(process.execPath, [script, flag], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true }
  } catch (e) {
    const why = [e?.stderr, e?.stdout, e?.message, String(e)].find(
      (s) => String(s ?? '').trim().length > 0,
    )
    return { ok: false, why: String(why).trim().slice(0, 240) }
  }
}

/**
 * 四端 ui-routes 族:每端"产物 ↔ 它的生成器"一对。
 * 判据不另写一份:直接借守门 105 的 ui-routes 对账规格(UI_ROUTES_ARTIFACTS),
 * 面上现算钉由它自己的 parse 出口给,免得两边各算一把尺。
 */
/**
 * 四端 ui-routes 的输入预取(单点出口):先按门 105 的规格列清单统一 prefetch,再逐份读。
 *
 * 立因(2026-10-27 实测):本文件两处调用 `prefetchUiInputs`,而全仓没有任何定义或 import ——
 * `node scripts/heal-derived-in-checkout.mjs` 走到 judgeUiRoutesFace 就 ReferenceError,整条
 * ui-routes 自愈腿从未真正跑起来过(守护那轮只留一行失败,失效方向是安静,§12f)。
 * 输入清单规则不在本文件重写一份:规格与 inputRels 都取门 105 的出口(§0.6)。
 */
export function prefetchUiInputs(reader) {
  const specs = gate105.UI_ROUTES_ARTIFACTS
  // 两段式取材(与门 105 同一条,顺序不可换):taro 的输入集要 app.config 求值后才能补齐,
  // 所以先把「四份产物 + 各生成器直接输入」预取进来,再走 inputRels 二段补列。
  reader.prefetch([
    ...specs.map((a) => a.rel),
    gate105.RN_NAVIGATOR,
    gate105.RN_LINKING,
    gate105.EXT_SIDEPANEL,
    gate105.TARO_APP_CONFIG,
  ])
  const rels = new Set()
  for (const art of specs) for (const rel of art.inputRels(reader)) rels.add(rel)
  reader.prefetch([...rels])
  return specs
}

export function healUiRoutesFamily({ face = 'head', root = ROOT, dir, reader = null }) {
  // 同 healI18nFamily:期望值与生成器读的是同一棵检出树(不可变),并发推进活 HEAD 不会误杀
  const rd = reader || gate105.makeReader('worktree', dir)
  const specs = prefetchUiInputs(rd)
  const ready = []
  const skipped = []
  for (const art of specs) {
    const faceText = rd.has(art.rel) ? rd.read(art.rel) : null
    if (faceText === null) {
      skipped.push({
        rel: art.rel,
        state: 'undetermined',
        why: `${FACE_LABEL[face]} 面上没有该产物`,
      })
      continue
    }
    const want = gate105.uiRoutesFaceDigest(art, rd) // rd = 检出树(worktree 面)
    if (!want?.digest) {
      skipped.push({
        rel: art.rel,
        state: 'undetermined',
        why: '面上现算输入哈希取不到(清单/字节缺位)',
      })
      continue
    }
    const nowPin = parsePin(faceText)
    if (nowPin.present && nowPin.digest === want.digest) {
      skipped.push({ rel: art.rel, state: 'clean' })
      continue
    }
    const gen = runGeneratorIn(dir, art.generator)
    if (!gen.ok) {
      skipped.push({ rel: art.rel, state: 'refused', why: `生成器未跑成:${gen.why}` })
      continue
    }
    const abs = join(dir, art.rel)
    if (!existsSync(abs)) {
      skipped.push({ rel: art.rel, state: 'refused', why: '生成后检出里没有该产物' })
      continue
    }
    const text = readFileSync(abs, 'utf8')
    const fresh = parsePin(text)
    if (!fresh.present || fresh.digest !== want.digest) {
      skipped.push({
        rel: art.rel,
        state: 'refused',
        why: `检出里新钉(${fresh.present ? String(fresh.digest).slice(0, 12) : '不可读'}…)≠ 面上现算(${want.digest.slice(0, 12)}…)`,
      })
      continue
    }
    const blob = String(
      git(['hash-object', '-w', '--stdin'], dir, { maxBuffer: 1 << 26, input: text }),
    ).trim()
    ready.push({ path: art.rel, blob })
  }
  return { state: ready.length > 0 ? 'ready' : 'nothing', files: ready, notes: skipped }
}

const LAND_MSG_LINES = [
  'chore(cross-end): 派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路',
  '',
  '器物:node scripts/heal-derived-in-checkout.mjs(由 git-guardian 巡检轮 healDerivedInCheckoutLeg 派发,30 分钟节流)',
  '为什么不能在盘上跑生成器:本仓旁路落地只推进 HEAD/索引、不写工作树 ⇒ 工作树常年 ≠ HEAD,',
  '  生成器读工作树烘出来的钉与面上现算不等 ⇒ 写回档只能拒落(拒落是对的),但 105 的 G5 是 blocking,',
  '  红会留给下一枚毫不相干的提交(§12e)。所以这里以 HEAD 建 detached 检出、在检出里生成、复量后只落 blob,',
  '  **主工作树一字节不动**(别人的现场归别人)。',
  '字节来源:检出里各端自己的生成器产物;落库前逐份复量"新钉 == 面上现算输入哈希",不等不落。',
].join('\n')

/**
 * 一轮闭环。deps 全可注入(镜像测试不建真检出、不跑真生成器、不落真 HEAD)。
 */
export function healDerivedInCheckout(opts = {}) {
  const {
    face = 'head',
    root = ROOT,
    families = FAMILIES,
    apply = true,
    withCheckout = withHeadCheckout,
    healI18n = healI18nFamily,
    healUi = healUiRoutesFamily,
    judgeI18n = judgeI18nFace,
    judgeUi = judgeUiRoutesFace,
    land = landBlobs,
    reader = null,
    logger = () => {},
  } = opts

  const judged = []
  // 先按面判一遍:两族都 clean 就根本不建检出(检出 + 生成是分钟级,不能白烧)
  const rd = reader || gate105.makeReader(face, root)
  const i18nStale = families.includes('i18n') ? judgeI18n(face, root, rd) : null
  const uiStale = families.includes('ui-routes') ? judgeUi(face, root, rd) : []
  if ((i18nStale === null || i18nStale === 'clean') && uiStale.length === 0) {
    return {
      state: 'clean',
      detail: `${face} 面上离线包钉与${uiStale.length ? '' : '四端 ui-routes 钉'}都与现算同值 ⇒ 零检出、零写盘、零落地`,
      judged,
    }
  }
  if (i18nStale === 'undetermined') {
    return {
      state: 'undetermined',
      detail: `${FACE_LABEL[face]} 取不到离线包产物或它的钉读不出 ⇒ 不重生成(不猜)`,
    }
  }

  let roundSha = ''
  const made = withCheckout({
    root,
    logger,
    work: ({ dir, baseSha }) => {
      roundSha = baseSha ?? ''
      const out = []
      if (i18nStale === 'stale') {
        const r = healI18n({ face, root, dir, reader: null })
        judged.push({ family: 'i18n', state: r.state, why: r.why ?? '' })
        if (r.state === 'ready') out.push(...r.files)
        else if (r.state === 'refused') logger(`⚠️ 检出档·离线包拒落:${r.why}`)
      }
      if (uiStale.length > 0) {
        const r = healUi({ face, root, dir, reader: null })
        judged.push({ family: 'ui-routes', state: r.state, notes: r.notes })
        if (r.files?.length) out.push(...r.files)
        for (const n of r.notes ?? [])
          if (n.state === 'refused') logger(`⚠️ 检出档·${n.rel} 拒落:${n.why}`)
      }
      return out
    },
  })
  if (!made?.ok) return { state: 'refused', detail: made?.why ?? '检出未建成', judged }
  const files = made.result ?? []
  if (files.length === 0) {
    const anyRefused = judged.some((j) => j.state === 'refused')
    return {
      state: anyRefused ? 'refused' : 'clean',
      detail: anyRefused ? '检出里生成/复量未通过(逐条已点名)⇒ 不落' : '检出档:面上已同值,无需落地',
      judged,
    }
  }
  if (!apply) {
    return {
      state: 'written',
      files: files.map((f) => f.path),
      detail: `检出里备好 ${files.length} 份(未落地:没给 --apply 档)`,
      judged,
    }
  }
  const r = land({
    root,
    files,
    slot: 'heal-derived-in-checkout',
    baseRef: made.baseSha ?? '',
    msg: LAND_MSG_LINES,
    proof:
      'blob = 以当前 HEAD 建的 detached 检出里、各端生成器自己产出的字节(git hash-object --stdin 写入对象库);' +
      '每一份落地前都复量到"产物自述钉 == 门在同一张面上现算的输入哈希",不等的一份都不在本清单里(逐条点名)',
  })
  if (!r?.ok) {
    return {
      state: 'refused',
      detail: `落地器未成功:${String(r?.why ?? '(无返回)').slice(0, 220)}`,
      judged,
    }
  }
  return {
    state: 'landed',
    files: files.map((f) => f.path),
    gatesRed: !!r.gatesRed,
    detail:
      `已落 ${files.length} 份(检出档,baseSha=${String(made.baseSha).slice(0, 12)})` +
      (r.gatesRed
        ? ' —— **落地器复跑受影响判据仍红**:本器这一格已收口,红在别的维,原样贴在下条日志里'
        : ''),
    judged,
  }
}

/** 只判不修:面上离线包钉新不新(clean / stale / undetermined) */
export function judgeI18nFace(face, root, rd) {
  const bundleRel = gate105.I18N_BUNDLE
  if (!rd.has(bundleRel)) return 'undetermined'
  rd.prefetch([bundleRel, ...gate105.bundleInputRels(gate105.REMOTE_LOCALES, (rel) => rd.has(rel))])
  const pin = parsePin(String(rd.read(bundleRel) ?? ''))
  if (!pin.present || pin.malformed) return 'undetermined'
  const computed = digestInputs(gate105.readPinInputs(rd))
  return computed.digest === pin.digest ? 'clean' : 'stale'
}

/** 只判不修:面上哪几端 ui-routes 的钉落后(返回 rel 清单) */
export function judgeUiRoutesFace(face, root, rd) {
  const specs = prefetchUiInputs(rd)
  const out = []
  for (const art of specs) {
    const text = rd.has(art.rel) ? rd.read(art.rel) : null
    if (text === null) continue // 面上没有 = 判定侧的 file-absent 未判定,本器不造文件
    const pin = parsePin(text)
    const want = gate105.uiRoutesFaceDigest(art, rd)
    if (!want?.digest) continue
    if (pin.present && pin.digest === want.digest) continue
    out.push(art.rel)
  }
  return out
}

function main(argv) {
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    return 2
  }
  if (argv.includes('--worktree')) {
    console.error(
      '❌ 本器只按 HEAD/索引判:盘上字节正是它要绕开的滞后副本,worktree 当面等于自删这道闸',
    )
    return 2
  }
  const familyIdx = argv.findIndex((a) => a === '--family')
  const fam =
    familyIdx >= 0
      ? argv[familyIdx + 1]
      : (argv.find((a) => a.startsWith('--family=')) ?? '').slice(9)
  if (fam && !FAMILIES.includes(fam)) {
    console.error(`❌ --family 只认 ${FAMILIES.join(' / ')},给了 "${fam}"`)
    return 2
  }
  const r = healDerivedInCheckout({
    face: sel.face,
    families: fam ? [fam] : FAMILIES,
    apply: !argv.includes('--dry-run'),
    logger: (s) => console.log(String(s)),
  })
  const line = `[heal-derived-in-checkout] 面=${sel.face} state=${r.state} files=${(r.files ?? []).length}`
  if (argv.includes('--json')) console.log(JSON.stringify({ face: sel.face, ...r }))
  else {
    console.log(line)
    console.log(`  ${r.detail}`)
    for (const j of r.judged ?? []) {
      if (j.family === 'ui-routes' && Array.isArray(j.notes)) {
        for (const n of j.notes)
          if (n.state !== 'clean') console.log(`   · ${n.rel} —— ${n.state} ${n.why ?? ''}`)
      } else if (j.state !== 'clean' && j.state !== 'ready')
        console.log(`   · ${j.family} —— ${j.state} ${j.why ?? ''}`)
    }
  }
  // clean/landed/written = 0;refused = 3(让派发方看得见"我没干成");undetermined = 2
  return r.state === 'refused' ? 3 : r.state === 'undetermined' ? 2 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`[heal-derived-in-checkout] 未判定:${e.message}`)
      process.exit(2)
    }
    throw e
  }
}

export const __test__ = {
  FAMILIES,
  I18N_OUTPUTS,
  MAX_I18N_BYTES,
  CHECKOUT_SLOT,
  checkoutPathOf,
  withHeadCheckout,
  healI18nFamily,
  healUiRoutesFamily,
  healDerivedInCheckout,
  // 只判不修的两把尺(与写回档共用同一条 readPinInputs / uiRoutesFaceDigest 出口)
  judgeI18nFace,
  judgeUiRoutesFace,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
