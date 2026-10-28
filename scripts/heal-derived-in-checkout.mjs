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
 *   node scripts/heal-derived-in-checkout.mjs            # 三族都看(离线包 + 四端 ui-routes + 样式派生面)
 *   node scripts/heal-derived-in-checkout.mjs --family i18n|ui-routes|tokens
 *   node scripts/heal-derived-in-checkout.mjs --json     # 结论走 JSON(守护读 summary)
 *   node scripts/heal-derived-in-checkout.mjs --self-test # 样式派生一族的判据自检(纯内存夹具,24 例)
 * 调度器:scripts/git-guardian.mjs 巡检轮的三条腿 `healI18nBundleLeg` / `healUiRoutesLeg` /
 *   `healStyleTokensLeg`(共用派发体 runDerivedHealLeg;30 分钟节流,tokens 可用
 *   IHUI_STYLE_TOKENS_HEAL_INTERVAL_MS 单独调)。头注此前写的 `healDerivedInCheckoutLeg`
 *   全仓不存在(§0.9「已接线而文档不点名」的反面:文档点了一个没接线的名字)。
 * 判机器状态 ⇒ 不进提交链(§12e);在提交链里跑=逼人人等一次检出+生成,那是分钟级。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

/** 一次判定的输入族:离线包、四端 ui-routes、样式派生面(tokens) */
export const FAMILIES = ['i18n', 'ui-routes', 'tokens']

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
  //   ① 检出里跑 → Cannot find module 'fflate';② 主仓里跑 --head 曾要 13 分钟级(每探一个不存在的
  //   候选路径起一个 git 进程)—— 2026-10-27 换成"存在性全集 + 批量读"后实测整轮 12 秒。
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

export function healUiRoutesFamily({ face = 'head', root: _root = ROOT, dir, reader = null }) {
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

/**
 * tokens 一族(2026-10-27 立)—— **样式派生面的自动同步腿**(AGENTS §4「副本一律是派生态」)。
 *
 * 立因(两条现读):
 *   ① 提交链里样式派生腿挂在 pre-commit 的 TOKEN_SYNC_TARGETS(:579 登记 / :734-791 执行),
 *      前提是该文件**被 staged**;而本仓大量落地走对象空间(commit-tree + CAS,不跑钩子)
 *      ⇒ HEAD 上留下一格欠派生。今天它就由人/代理手工补:近两枚提交标题就是
 *      「chore(cross-end): 派生产物按 HEAD 面重生成并落地(检出档)」——同一格补了两次。
 *   ② git-guardian 巡检轮此前**没有任何样式腿**(派发自愈只有 i18n / ui-routes 两族)。
 * 所以这一族不是"再加一道对账门",而是把那一格变成器物自己找窗口跑。
 *
 * 判据面纪律(§0.4):登记表只从**被审面**读(rd 读 HEAD blob),不在本文件抄第二份腿清单
 * (§0.6「同类清单全仓只许一份,第二份必然漂移」);枚举止于 0 条 ⇒ 判未判定,绝不冒绿(§0.3)。
 *
 * 落地前不自证的格,交给"下一轮按 HEAD 面复判"这一格闭环:生成器写回的字节就是派生定义本身,
 * 落进 HEAD 后各对账门(36/93/254…)按 blob 复算必然同值;若某条腿仍判红,下一轮本器的
 * judgeTokensFace(HEAD) 会再点名并重落 —— 自愈,不是静默。**范围/量级**当场拦:
 *   · 同形与否由**该腿自己的校验器**在检出里判(检出刚建时盘==HEAD,worktree 档即 HEAD 档);
 *     不按"生成器输出字节 == HEAD 字节"判 —— 现读实测:app.css 唯一的字节差是 lint-staged 把
 *     accent-color 那条多行选择器折成一行,排版差不承载样式信息,按字节判会造成
 *     "落一枚内容没变的提交 ⇒ 下一枚 pre-commit 又折回去"的循环;
 *   · 校验器红 ⇒ 重生成 ⇒ 复校绿才备 blob;复校仍红 ⇒ 该腿拒落(不落半套、不冒绿);
 *   · 变更集必须逐条落在该腿登记的 file 面内(生成器动了不该动的文件 ⇒ 整批不落);
 *   · 一次写回字节 > MAX_TOKENS_BYTES ⇒ 异常量级,不自动背书。
 */
export const MAX_TOKENS_BYTES = 2_000_000
export const HOOK_REL = 'scripts/lib/pre-commit-hook.js'

/** 字符串位感知的括号配平:从 open 的 '[' 找配对的 ']',跳过 '…' / "…" / `…` 字面量。 */
export function matchBracket(text, open) {
  const t = String(text ?? '')
  let depth = 0
  let q = ''
  for (let i = open; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '\\') i++
      else if (c === q) q = ''
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      q = c
      continue
    }
    if (c === '[' || c === '{' || c === '(') depth++
    else if (c === ']' || c === '}' || c === ')') {
      depth--
      if (depth === 0) return i
      if (depth < 0) return -1
    }
  }
  return -1
}

/**
 * 从 pre-commit-hook.js 正文取 trigger==='tokens' 的派生腿。
 * 返回 { ok, legs, why }:ok=false 一律由调用方落「未判定」——枚举不到腿就等于没有尺子。
 * 字段用逐行 `key: '值'` 形态取(登记表就是这个形制写成的);注释行不参与取值。
 */
export function tokenLegsFrom(text) {
  const t = String(text ?? '')
  const anchor = t.indexOf('const TOKEN_SYNC_TARGETS')
  if (anchor < 0)
    return { ok: false, why: `${HOOK_REL} 正文里没有 TOKEN_SYNC_TARGETS 锚点`, legs: [] }
  const open = t.indexOf('[', anchor)
  if (open < 0) return { ok: false, why: 'TOKEN_SYNC_TARGETS 后面取不到 [', legs: [] }
  const close = matchBracket(t, open)
  if (close < 0)
    return { ok: false, why: 'TOKEN_SYNC_TARGETS 的 [ 配不平(正文形态不是预期)', legs: [] }
  const body = t.slice(open + 1, close)
  const legs = []
  for (const piece of body.split(/\n\s*\},\s*\n/)) {
    const line = (key) => {
      const m = String(piece).match(new RegExp(`^\\s*${key}:\\s*'([^']*)'`, 'm'))
      return m ? m[1] : ''
    }
    if (line('trigger') !== 'tokens') continue
    legs.push({ label: line('label'), file: line('file'), cmd: line('cmd'), check: line('check') })
  }
  if (legs.length === 0)
    return {
      ok: false,
      why: 'TOKEN_SYNC_TARGETS 里枚举到 0 条 trigger=tokens 的腿(不记绿)',
      legs: [],
    }
  const incomplete = legs.filter((l) => !l.file || !l.cmd)
  if (incomplete.length > 0)
    return {
      ok: false,
      why: `腿缺 file 或 cmd:${incomplete.map((l) => l.label || l.cmd || '?').join(' / ')}`,
      legs: [],
    }
  return { ok: true, legs, why: '' }
}

/**
 * 把登记表里的 cmd 换成「在给定目录里可直接执行」的 argv。
 * 检出里没有 pnpm 安装态(依赖是机器态、不入库)⇒ `pnpm --filter <pkg> <script>` 取该包
 * package.json 的 script 体,以包目录为 cwd 直接跑;命令串里出现 shell 结构(&& | >)⇒ 不跑,点名。
 */
export function legArgvAt(
  dir,
  cmd,
  readJson = (p) => JSON.parse(readFileSync(p, 'utf8')),
  listPkgDirs = (base) => {
    try {
      return readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      return []
    }
  },
) {
  const c = String(cmd || '').trim()
  if (/[&|><]|\$\(/.test(c)) return { ok: false, why: `命令串里有 shell 结构,不替它拼:${c}` }
  const tokens = c.split(/\s+/).filter(Boolean)
  let m = c.match(/^node\s+(\S+)(.*)$/)
  if (m)
    return {
      ok: true,
      argv: [process.execPath, join(dir, m[1]), ...m[2].split(/\s+/).filter(Boolean)],
    }
  m = c.match(/^pnpm\s+--filter\s+(\S+)\s+(\S+)(.*)$/)
  if (m) {
    const [, pkgName, scriptName, rest] = m
    const extra = rest.split(/\s+/).filter(Boolean)
    const roots = ['apps', 'packages']
    for (const rootSeg of roots) {
      const dirs = listPkgDirs(join(dir, rootSeg))
      for (const name of dirs) {
        const pkgRel = join(rootSeg, name, 'package.json')
        let pkg = null
        try {
          pkg = readJson(join(dir, pkgRel))
        } catch {
          continue
        }
        if (pkg?.name !== pkgName) continue
        const body = String(pkg?.scripts?.[scriptName] ?? '')
        if (!body)
          return { ok: false, why: `${pkgName} 没有 script ${scriptName}(登记表与包体不同形)` }
        const bm = body.match(/^node\s+(\S+)(.*)$/)
        if (!bm) return { ok: false, why: `${pkgName} 的 ${scriptName} 不是 node 直跑形态:${body}` }
        const pkgCwd = join(dir, rootSeg, name)
        const scriptPath = resolve(pkgCwd, bm[1])
        return {
          ok: true,
          argv: [process.execPath, scriptPath, ...bm[2].split(/\s+/).filter(Boolean), ...extra],
          cwd: pkgCwd,
        }
      }
    }
    return { ok: false, why: `在 ${dir} 里找不到名为 ${pkgName} 的包(登记表指向的包不在面上)` }
  }
  return { ok: false, why: `不认识的命令形态:${tokens.slice(0, 2).join(' ')}` }
}

function runAt(dir, argv, timeoutMs = 20 * 60 * 1000) {
  try {
    execFileSync(argv[0], argv.slice(1), {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_PATH: [join(ROOT, 'node_modules')].join(delimiter) },
    })
    return { ok: true, stdout: '' }
  } catch (e) {
    const why = [e?.stderr, e?.stdout, e?.message, String(e)].find(
      (s) => String(s ?? '').trim().length > 0,
    )
    return { ok: false, why: String(why).trim().slice(0, 220) }
  }
}

/** 只判不修:被审面(只支持 head)上哪几条 tokens 派生腿的校验不过。返回 {state, stale, why}。 */
export const TOKENS_SOURCE_REL = 'packages/design-tokens/src/styles/tokens.css'
/** 机器态(不入库):上一轮判完时样式源头是哪一枚 blob */
export const tokensStatePathOf = (root = ROOT) =>
  join(root, '.ihui-agent', 'state', 'tokens-heal-source-sha.json')

/**
 * 源头 blob sha(HEAD 面)。这一维是**不能省**的:各腿 check 里有一条走的是盘上副本
 * (sync-extension-tokens 那类),于是"HEAD 落后而本机盘已被人手工跑过生成器补好"这一型
 * 会被读成一切正常 ⇒ 永不建检出 ⇒ 样式派生面在 HEAD 上长期欠着,而账面安静(§12f)。
 * 现读法:源头 blob 与上一轮判完时不同 ⇒ 无论 check 报什么,都建检出在 HEAD 等价面上复判。
 */
export function tokensSourceSha(root = ROOT) {
  try {
    return String(git(['rev-parse', '--verify', `HEAD:${TOKENS_SOURCE_REL}`], root)).trim()
  } catch {
    return ''
  }
}

export function judgeTokensFace(face, root, rd, deps = {}) {
  const { sourceSha = tokensSourceSha(root), readState = tokensStateRead, run = runAt } = deps
  if (face !== 'head')
    return { state: 'undetermined', stale: [], why: `tokens 一族只判 HEAD 面(给了 ${face})` }
  if (!/^[0-9a-f]{40}$/.test(sourceSha))
    return { state: 'undetermined', stale: [], why: `样式源头 blob 取不到(${TOKENS_SOURCE_REL})` }
  const last = readState(root)?.sourceSha ?? ''
  if (last !== sourceSha) {
    return {
      state: 'stale',
      stale: [
        {
          label: `源头自上一轮已移动(${String(last).slice(0, 12) || '无记录'}… → ${sourceSha.slice(0, 12)}…)`,
          why: '',
        },
      ],
      why: 'source-moved',
    }
  }
  rd.prefetch([HOOK_REL])
  const hookText = rd.has(HOOK_REL) ? rd.read(HOOK_REL) : null
  if (hookText === null)
    return { state: 'undetermined', stale: [], why: `${HOOK_REL} 在面上取不到` }
  const parsed = tokenLegsFrom(hookText)
  if (!parsed.ok) return { state: 'undetermined', stale: [], why: parsed.why }
  const stale = []
  const unjudged = []
  for (const leg of parsed.legs) {
    if (!leg.check) {
      unjudged.push(`${leg.label || leg.cmd}(无 check 登记)`)
      continue
    }
    const r = run(root, [process.execPath, join(root, 'scripts', leg.check)], 5 * 60 * 1000)
    if (r.ok) continue
    // 校验器"跑了但判红"= 这一条腿确实落后;"跑不起来"(取不到输入/脚本不在位)= 未判定,不重生成猜测
    stale.push({ label: leg.label, why: String(r.why).slice(0, 160) })
  }
  if (unjudged.length > 0)
    return {
      state: 'undetermined',
      stale,
      why: `${unjudged.length} 条腿没有 check 登记,判不出: ${unjudged.join(' / ')}`,
    }
  return { state: stale.length > 0 ? 'stale' : 'clean', stale, why: '' }
}

/** 读上一轮的源头 sha(读不到 = 没有记录 ⇒ 视为需要重判,宁多跑一轮检出) */
export function tokensStateRead(root = ROOT) {
  try {
    return JSON.parse(readFileSync(tokensStatePathOf(root), 'utf8'))
  } catch {
    return null
  }
}

/** 写本轮判完的源头 sha(机器态,失败不改变判定结论,只让下一轮多判一次) */
export function tokensStateWrite(root, sourceSha, extra = {}) {
  try {
    writeFileSync(
      tokensStatePathOf(root),
      JSON.stringify({ sourceSha, at: new Date().toISOString(), ...extra }),
      'utf8',
    )
    return true
  } catch {
    return false
  }
}

/**
 * porcelain 每行固定是「两列状态 + 一个空格 + 路径」(X=索引态、Y=工作树态,任一格可为空格)。
 * 不剥这两列就把 `M apps/x.css` 当路径去比,于是**生成器正确改写了登记文件**也被读成"动了未登记的
 * 文件" —— 2026-10-27 第一次真跑实测:HEAD 上的 app.css 确实落后,却被这把坏尺子判成越界、整族拒落。
 * 三型都要吃到:`M `(仅索引改)、` M`(仅工作树改)、`??`(未跟踪);改名取箭头后的新路径。
 */
export function porcelainPaths(out) {
  const out2 = []
  for (const raw of String(out ?? '').split('\n')) {
    const l = raw.replace(/\r$/, '')
    if (!l.trim()) continue
    const m = l.match(/^[MADRCU?!T ][ MADRCU?!T?] (.*)$/)
    if (!m) continue
    const p = m[1].replace(/^"|"$/g, '')
    const arrow = p.indexOf(' -> ')
    out2.push((arrow >= 0 ? p.slice(arrow + 4) : p).trim())
  }
  return out2
}

/**
 * 在检出里把 tokens 一族补齐。判据是**该腿自己的校验器**,不是"生成器输出字节 == HEAD 字节":
 *   · 检出刚建好时盘 == HEAD ⇒ 校验器(worktree 档)绿 ⇒ 这一腿在 HEAD 上本就同形,零动作;
 *     生成器重跑仍会改字节 —— 那是 lint-staged 把多行选择器折成一行的**排版差**,不承载任何样式
 *     信息(2026-10-27 第一次真跑实测:app.css 的唯一 delta 就是 accent-color 那条选择器被折行)。
 *     按字节判落后会每次源头一动就落一枚"没人改过内容"的提交,下一枚 pre-commit 又给折回去 ⇒  churn。
 *   · 校验器红 ⇒ 跑写回腿 ⇒ 复校 ⇒ 绿才备 blob;复校仍红 ⇒ 整条腿拒落(不落半套、不冒绿);
 *   · 变更集必须逐条落在该腿登记的 file 面内(生成器动了别的文件 ⇒ 拒);
 *   · 一次写回字节 > MAX_TOKENS_BYTES ⇒ 异常量级,不自动背书。
 * deps 全可注入(镜像测试不建真检出、不跑真生成器)。
 */
export function healTokensFamily({
  face = 'head',
  root = ROOT,
  dir,
  reader = null,
  run = runAt,
  status = (cwd, paths) => porcelainPaths(git(['status', '--porcelain', '--', ...paths], cwd)),
  readFile = (abs) => readFileSync(abs, 'utf8'),
  exists = (abs) => existsSync(abs),
  hash = (r, text) => hashText(r, text),
}) {
  const rd = reader || gate105.makeReader(face, root)
  rd.prefetch([HOOK_REL])
  const hookText = rd.has(HOOK_REL) ? rd.read(HOOK_REL) : null
  if (hookText === null)
    return { state: 'refused', files: [], notes: [{ why: `${HOOK_REL} 在被审面取不到` }] }
  const parsed = tokenLegsFrom(hookText)
  if (!parsed.ok) return { state: 'refused', files: [], notes: [{ why: parsed.why }] }
  const notes = []
  const ready = []
  const allowed = new Set(parsed.legs.flatMap((l) => String(l.file).split(/\s+/).filter(Boolean)))
  for (const leg of parsed.legs) {
    if (!leg.check) {
      notes.push({
        rel: leg.label,
        state: 'undetermined',
        why: '该腿没有 check 登记,判不出同形与否 ⇒ 不动手',
      })
      continue
    }
    const checkArgv = [process.execPath, join(dir, 'scripts', leg.check), '--worktree']
    const before = run(dir, checkArgv, 5 * 60 * 1000)
    if (before.ok) {
      notes.push({ rel: leg.label, state: 'clean', changed: [] })
      continue
    }
    const plan = legArgvAt(dir, leg.cmd)
    if (!plan.ok) {
      notes.push({ rel: leg.label, state: 'refused', why: plan.why })
      continue
    }
    const cwd = plan.cwd || dir
    const gen = run(cwd, plan.argv)
    if (!gen.ok) {
      notes.push({ rel: leg.label, state: 'refused', why: `写回腿未跑成:${gen.why}` })
      continue
    }
    const after = run(dir, checkArgv, 5 * 60 * 1000)
    if (!after.ok) {
      notes.push({
        rel: leg.label,
        state: 'refused',
        why: `重生成后校验仍红 ⇒ 这一腿的缺口不是生成器能补的,不落:${String(after.why).slice(0, 160)}`,
      })
      continue
    }
    const changed = status(cwd, String(leg.file).split(/\s+/).filter(Boolean))
    const outOfScope = changed.filter((p) => !allowed.has(p.replace(/\\/g, '/')))
    if (outOfScope.length > 0) {
      notes.push({
        rel: leg.label,
        state: 'refused',
        why: `生成器动了未登记的文件:${outOfScope.join(' / ')}`,
      })
      continue
    }
    for (const p of changed) {
      const rel = p.replace(/\\/g, '/')
      if (!exists(join(dir, rel))) {
        notes.push({ rel: leg.label, state: 'refused', why: `status 报了 ${rel} 而检出里读不到` })
        continue
      }
      const text = readFile(join(dir, rel))
      if (Buffer.byteLength(text) > MAX_TOKENS_BYTES) {
        notes.push({
          rel: leg.label,
          state: 'refused',
          why: `${rel} 体量异常(${Buffer.byteLength(text)} B)`,
        })
        continue
      }
      ready.push({ path: rel, blob: hash(root, text), label: leg.label })
    }
    notes.push({
      rel: leg.label,
      state: changed.length ? 'regenerated' : 'in-sync-after-regen',
      changed,
    })
  }
  const refused = notes.filter((n) => n.state === 'refused')
  if (refused.length > 0) return { state: 'refused', files: [], notes }
  const uniq = [...new Map(ready.map((f) => [f.path, f])).values()]
  return { state: uniq.length > 0 ? 'ready' : 'nothing', files: uniq, notes }
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
    healTokens = healTokensFamily,
    judgeI18n = judgeI18nFace,
    judgeUi = judgeUiRoutesFace,
    judgeTokens = judgeTokensFace,
    land = landBlobs,
    reader = null,
    logger = () => {},
  } = opts

  const judged = []
  // 先按面判一遍:两族都 clean 就根本不建检出(检出 + 生成是分钟级,不能白烧)
  const rd = reader || gate105.makeReader(face, root)
  const i18nStale = families.includes('i18n') ? judgeI18n(face, root, rd) : null
  const uiStale = families.includes('ui-routes') ? judgeUi(face, root, rd) : []
  const tokensVerdict = families.includes('tokens') ? judgeTokens(face, root, rd) : null
  const tokensStale = tokensVerdict?.state === 'stale' ? tokensVerdict.stale : []
  if (tokensVerdict && tokensVerdict.state !== 'stale')
    judged.push({ family: 'tokens', state: tokensVerdict.state, why: tokensVerdict.why ?? '' })
  if (
    (i18nStale === null || i18nStale === 'clean') &&
    uiStale.length === 0 &&
    tokensStale.length === 0
  ) {
    if (tokensVerdict?.state === 'undetermined')
      return {
        state: 'undetermined',
        detail: `另两族同值,但 tokens 一族判不出:${tokensVerdict.why}(没判不猜,§0.3)`,
        judged,
      }
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

  // 本轮**实际交出 blob 的族**(不是"判过的族"):提交信息里的自述必须只覆盖真参与产出的那些腿,
  // 否则"离线包一族在主仓按面生成"这一枚会自称"检出里产出"或自称带 tokens(2026-10-27 由 C3b
  // 那条既有锁撞出 —— 它判的正是"proof 不得自称没发生过的取材面")。
  const roundFamilies = new Set()
  // 检出只为 ui-routes 一族而建:那一族必须在检出里跑生成器并按检出树复量。
  // 离线包一族在主仓按被审面生成(见 healI18nFamily 头注),给它建一次检出要 4-5 分钟 ——
  // 那恰好是把面换掉的窗口(2026-10-27 实测:一轮 4m55s,其中生成只占 12s),白烧 ⇒ 不建。
  const workIn = ({ dir }) => {
    const out = []
    if (i18nStale === 'stale') {
      const r = healI18n({ face, root, dir, reader: null })
      judged.push({ family: 'i18n', state: r.state, why: r.why ?? '' })
      if (r.state === 'ready' && r.files?.length) {
        out.push(...r.files)
        roundFamilies.add('i18n')
      } else if (r.state === 'refused') logger(`⚠️ 检出档·离线包拒落:${r.why}`)
    }
    if (uiStale.length > 0) {
      const r = healUi({ face, root, dir, reader: null })
      judged.push({ family: 'ui-routes', state: r.state, notes: r.notes })
      if (r.files?.length) {
        out.push(...r.files)
        roundFamilies.add('ui-routes')
      }
      for (const n of r.notes ?? [])
        if (n.state === 'refused') logger(`⚠️ 检出档·${n.rel} 拒落:${n.why}`)
    }
    if (tokensStale.length > 0) {
      const r = healTokens({ face, root, dir, reader: null })
      judged.push({
        family: 'tokens',
        state: r.state,
        notes: r.notes,
        staleLegs: tokensStale.map((s) => s.label),
      })
      if (r.files?.length) {
        out.push(...r.files)
        roundFamilies.add('tokens')
      }
      for (const n of r.notes ?? [])
        if (n.state === 'refused') logger(`⚠️ 检出档·样式腿 ${n.rel} 拒落:${n.why}`)
    }
    return out
  }
  const made =
    uiStale.length > 0 || tokensStale.length > 0
      ? withCheckout({ root, logger, work: workIn })
      : { ok: true, dir: null, baseSha: '', result: workIn({ dir: null, baseSha: '' }) }
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
  const usedCheckout = uiStale.length > 0 || tokensStale.length > 0
  const pinIn = roundFamilies.has('i18n') || roundFamilies.has('ui-routes')
  const proofClauses = []
  if (pinIn)
    proofClauses.push(
      '钉族(i18n / ui-routes)落地前复量"产物自述钉 == 门在同一张面上现算的输入哈希",不等的一份都不在本清单里',
    )
  if (roundFamilies.has('tokens'))
    proofClauses.push(
      '样式族(tokens)的同形与否由该腿自己的校验器判,判面就是那枚检出(刚建时盘==HEAD,故等价于 HEAD 档);' +
        '校验红 ⇒ 重生成 ⇒ 复校绿才备 blob,复校仍红 / 越界改文件 / 体量异常 ⇒ 该腿整条不落并逐条点名',
    )
  const r = land({
    root,
    files,
    slot: 'heal-derived-in-checkout',
    baseRef: made.baseSha ?? '',
    msg: LAND_MSG_LINES,
    proof:
      `本枚真交出 blob 的族:${[...roundFamilies].join(' / ') || '(无)'};blob = ` +
      (usedCheckout
        ? '以当前 HEAD 建的 detached 检出里、各端生成器自己产出的字节'
        : '主仓按被审面跑生成器产出的字节(离线包一族的生成器要在主仓依赖面上跑)') +
      '(git hash-object --stdin 写入对象库);' +
      proofClauses.join(';') +
      '。',
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
      `已落 ${files.length} 份(${usedCheckout ? `检出档,baseSha=${String(made.baseSha).slice(0, 12)}` : '主仓按被审面生成,未建检出'})` +
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

/**
 * --self-test:样式派生面一族的判据自检(纯内存夹具,不碰真仓、不建检出、不落 HEAD)。
 * 立因:本门头注此前就写着 `--self-test` 而**没有这条实现** —— 带着这面旗会静默落回主流程
 * (建检出、可能落 HEAD),既是"文档写的出路跑不通"(§0.8),也是"旗号与行为不同形"(§12f)。
 */
export function selfTest() {
  const cases = []
  const P = (name, pass, got = '') =>
    cases.push({ name, pass: !!pass, got: String(got ?? '').slice(0, 140) })
  const SHA = '0'.repeat(40)
  const REG = [
    'const TOKEN_SYNC_TARGETS = [',
    '  {',
    "    label: 'a app.css',",
    "    file: 'apps/a/src/app.css',",
    "    cmd: 'node scripts/sync-a.mjs --quiet',",
    "    trigger: 'tokens',",
    "    check: 'check-a.mjs',",
    '  },',
    '  {',
    "    // 注释里出现的 file: 'x' 与 label: 'y' 都不许被当成本条腿的字段",
    "    label: 'b routes',",
    "    file: 'apps/b/gen.ts',",
    "    cmd: 'node scripts/gen-b.mjs',",
    "    trigger: 'ui-routes',",
    '  },',
    '  {',
    "    label: 'c chrome',",
    "    file: 'apps/c/theme.json apps/c/lib/theme.ts',",
    "    cmd: 'pnpm --filter @ihui/c sync-tokens',",
    "    trigger: 'tokens',",
    "    check: 'check-c.mjs',",
    '  },',
    ']',
  ].join('\n')
  const fakeRd = (text) => ({ has: () => true, read: () => text, prefetch: () => {} })

  const legs = tokenLegsFrom(REG)
  P(
    'S1 只取 trigger=tokens 的腿(ui-routes 那条不入射程)',
    legs.ok && legs.legs.length === 2,
    legs.legs.map((l) => l.label).join('|'),
  )
  P(
    'S2 字段逐行取值,注释行不顶包',
    legs.ok && legs.legs[1].file === 'apps/c/theme.json apps/c/lib/theme.ts',
    legs.legs[1]?.file,
  )
  P(
    'S3 没有 TOKEN_SYNC_TARGETS 锚点 ⇒ 判不出(不冒绿)',
    !tokenLegsFrom('const OTHER = []').ok,
    tokenLegsFrom('const OTHER = []').why,
  )
  P('S4 枚举到 0 条 tokens 腿 ⇒ 判不出', !tokenLegsFrom(REG.replace(/tokens/g, 'ui-routes')).ok, '')
  P(
    'S5 腿缺 cmd 或 file ⇒ 判不出(不跑半套)',
    !tokenLegsFrom(REG.replace("    cmd: 'node scripts/sync-a.mjs --quiet',\n", '')).ok,
    '',
  )

  const bt = "const X = [ { s: ']' }, [1] ]\nTAIL"
  const open = bt.indexOf('[')
  const close = matchBracket(bt, open)
  P(
    'S6 括号配平不被字符串里的 ] 骗走',
    close > 0 && bt[close] === ']' && bt.slice(close + 1) === '\nTAIL',
    `close=${close}`,
  )

  const pp = porcelainPaths('M  apps/a/src/app.css\n M apps/c/theme.json\n?? apps/c/lib/theme.ts')
  P(
    'S7 porcelain 三种状态前缀都剥干净(M / 空格M / ??)',
    JSON.stringify(pp) ===
      JSON.stringify(['apps/a/src/app.css', 'apps/c/theme.json', 'apps/c/lib/theme.ts']),
    pp.join('|'),
  )
  P(
    'S8 porcelain 改名取箭头后的新路径 + 空行与畸形行不吃',
    JSON.stringify(porcelainPaths('R  old/x.css -> new/x.css\n\n??????')) ===
      JSON.stringify(['new/x.css']),
    porcelainPaths('R  o -> n').join('|'),
  )

  const nodePlan = legArgvAt('D:/x', 'node scripts/sync-a.mjs --quiet')
  P(
    'S9 node 形态直接可执行',
    nodePlan.ok &&
      nodePlan.argv[1] === join('D:/x', 'scripts', 'sync-a.mjs') &&
      nodePlan.argv[2] === '--quiet',
    JSON.stringify(nodePlan.argv),
  )
  const pnpmPlan = legArgvAt(
    'D:/x',
    'pnpm --filter @ihui/c sync-tokens',
    () => ({
      name: '@ihui/c',
      scripts: { 'sync-tokens': 'node ../../scripts/sync-c.mjs --quiet' },
    }),
    () => ['c'],
  )
  P(
    'S10 pnpm 形态取包体 script(检出里没有安装态)',
    pnpmPlan.ok &&
      String(pnpmPlan.argv[1]).endsWith('sync-c.mjs') &&
      pnpmPlan.cwd === join('D:/x', 'apps', 'c'),
    JSON.stringify(pnpmPlan.argv?.[1] || pnpmPlan.why),
  )
  P(
    'S11 命令串含 shell 结构 ⇒ 拒跑(不替它拼)',
    !legArgvAt('D:/x', 'node a.mjs && node b.mjs').ok,
    legArgvAt('D:/x', 'node a.mjs && node b.mjs').why,
  )
  P(
    'S12 pnpm 指向面上不存在的包 ⇒ 拒跑',
    !legArgvAt(
      'D:/x',
      'pnpm --filter @ihui/none sync',
      () => ({ name: 'other' }),
      () => ['apps'],
    ).ok,
    '',
  )

  P(
    'S13 非 head 面 ⇒ 判不出',
    judgeTokensFace('staged', 'D:/x', fakeRd(REG)).state === 'undetermined',
    '',
  )
  P(
    'S14 源头 blob sha 取不到 ⇒ 判不出(不猜)',
    judgeTokensFace('head', 'D:/x', fakeRd(REG), { sourceSha: '', readState: () => null }).state ===
      'undetermined',
    '',
  )
  const moved = judgeTokensFace('head', 'D:/x', fakeRd(REG), {
    sourceSha: SHA,
    readState: () => ({ sourceSha: 'f'.repeat(40) }),
  })
  P(
    'S15 源头自上一轮移动 ⇒ stale(盘上补过而 HEAD 欠着的型不静默漏)',
    moved.state === 'stale' && moved.why === 'source-moved',
    `${moved.state}/${moved.why}`,
  )
  const clean = judgeTokensFace('head', 'D:/x', fakeRd(REG), {
    sourceSha: SHA,
    readState: () => ({ sourceSha: SHA }),
    run: () => ({ ok: true }),
  })
  P(
    'S16 源头未动且各腿校验通过 ⇒ clean(零检出)',
    clean.state === 'clean',
    `${clean.state}/${JSON.stringify(clean.stale)}`,
  )
  const oneRed = judgeTokensFace('head', 'D:/x', fakeRd(REG), {
    sourceSha: SHA,
    readState: () => ({ sourceSha: SHA }),
    run: (root, argv) =>
      String(argv[1]).includes('check-a') ? { ok: false, why: 'drift' } : { ok: true },
  })
  P(
    'S17 某条腿校验不过 ⇒ stale 且点名该腿',
    oneRed.state === 'stale' && oneRed.stale.length === 1 && oneRed.stale[0].label === 'a app.css',
    JSON.stringify(oneRed.stale),
  )
  const noCheck = judgeTokensFace(
    'head',
    'D:/x',
    fakeRd(REG.replace("    check: 'check-c.mjs',\n", '')),
    {
      sourceSha: SHA,
      readState: () => ({ sourceSha: SHA }),
      run: () => ({ ok: true }),
    },
  )
  P(
    'S18 有腿没登记 check ⇒ 判不出(有形态没人验就不冒绿)',
    noCheck.state === 'undetermined' && /check 登记/.test(noCheck.why),
    `${noCheck.state}/${noCheck.why}`,
  )

  // —— healTokensFamily(检出里的写回档):同形与否以"该腿校验器"判,不以生成器字节判 ——
  const scriptedRun = (plan) => (cwd, argv) => {
    const base = String(argv[1] || '')
      .split(/[\\/]/)
      .pop()
    const seq = plan[base]
    if (!seq) return { ok: true }
    const v = seq.length > 1 ? seq.shift() : seq[0]
    return v ? { ok: true } : { ok: false, why: '判红' }
  }
  const famDeps = {
    face: 'head',
    root: '/T',
    dir: '/T',
    reader: fakeRd(REG),
    readFile: () => 'BODY',
    exists: () => true,
    hash: () => 'blob',
  }
  const allGreen = healTokensFamily({
    ...famDeps,
    run: scriptedRun({ 'check-a.mjs': [true], 'check-c.mjs': [true] }),
    status: () => [],
  })
  P(
    'S19 校验器都绿 ⇒ 零字节可落(排版差不算落后)',
    allGreen.state === 'nothing' && allGreen.files.length === 0,
    `${allGreen.state}/${allGreen.files.length}`,
  )
  const oneDrift = healTokensFamily({
    ...famDeps,
    run: scriptedRun({ 'check-a.mjs': [false, true], 'check-c.mjs': [true] }),
    status: () => ['apps/a/src/app.css'],
  })
  P(
    'S20 校验红 ⇒ 重生成 ⇒ 复校绿 ⇒ 备 blob 落 HEAD',
    oneDrift.state === 'ready' &&
      oneDrift.files.length === 1 &&
      oneDrift.files[0].path === 'apps/a/src/app.css',
    `${oneDrift.state}/${JSON.stringify(oneDrift.files)}`,
  )
  const stillRed = healTokensFamily({
    ...famDeps,
    run: scriptedRun({ 'check-a.mjs': [false, false], 'check-c.mjs': [true] }),
    status: () => ['apps/a/src/app.css'],
  })
  P(
    'S21 重生成后复校仍红 ⇒ 整条腿拒落(不冒绿、不落半套)',
    stillRed.state === 'refused' && stillRed.files.length === 0,
    `${stillRed.state}`,
  )
  const outScope = healTokensFamily({
    ...famDeps,
    run: scriptedRun({ 'check-a.mjs': [false, true], 'check-c.mjs': [true] }),
    status: () => ['apps/other/x.css'],
  })
  P(
    'S22 生成器动了未登记的文件 ⇒ 拒落(越界即整批不背)',
    outScope.state === 'refused' &&
      /未登记/.test(String(outScope.notes.find((n) => n.state === 'refused')?.why)),
    outScope.state,
  )
  const famNoCheck = healTokensFamily({
    ...famDeps,
    reader: fakeRd(REG.replace("    check: 'check-c.mjs',\n", '')),
    run: scriptedRun({ 'check-a.mjs': [true] }),
    status: () => [],
  })
  P(
    'S23 无 check 登记的腿:不动手且逐条点名',
    famNoCheck.notes.some((n) => n.rel === 'c chrome' && n.state === 'undetermined'),
    JSON.stringify(famNoCheck.notes.map((n) => `${n.rel}:${n.state}`)),
  )
  const famNoHook = healTokensFamily({
    ...famDeps,
    reader: { has: () => false, read: () => null, prefetch: () => {} },
  })
  P(
    'S24 登记表取不到 ⇒ 判不出式拒落(不猜面)',
    famNoHook.state === 'refused' && famNoHook.files.length === 0,
    famNoHook.state,
  )

  return cases
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const cases = selfTest()
    const bad = cases.filter((c) => !c.pass)
    for (const c of cases)
      console.log(`${c.pass ? '✔' : '✖'} ${c.name}${c.pass ? '' : ` —— 实测:${c.got}`}`)
    console.log(`SELF-TEST ${cases.length - bad.length}/${cases.length} 通过`)
    return bad.length === 0 ? 0 : 1
  }
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
  const families = fam ? [fam] : FAMILIES
  const r = healDerivedInCheckout({
    face: sel.face,
    families,
    apply: !argv.includes('--dry-run'),
    logger: (s) => console.log(String(s)),
  })
  // tokens 的"源头自上一轮已移动"这一触发要能结清:只有**真判成**才记源头 sha。
  // refused / undetermined 不记 ⇒ 下一轮照旧重判(失效方向是多跑一次检出,绝不是少跑)。
  // dry-run 判成也记:那一轮确实在检出里对着 HEAD 字节验过同形,不记就会每 30 分钟白建一次检出。
  // 只跑了别的族也不记(否则等于替 tokens 一族签了"我没判过"的合格证)。
  if (families.includes('tokens') && sel.face === 'head' && ['clean', 'landed'].includes(r.state)) {
    const sha = tokensSourceSha(ROOT)
    if (/^[0-9a-f]{40}$/.test(sha)) tokensStateWrite(ROOT, sha, { state: r.state })
  }
  const line = `[heal-derived-in-checkout] 面=${sel.face} state=${r.state} files=${(r.files ?? []).length}`
  if (argv.includes('--json')) console.log(JSON.stringify({ face: sel.face, ...r }))
  else {
    console.log(line)
    console.log(`  ${r.detail}`)
    for (const j of r.judged ?? []) {
      if (Array.isArray(j.notes)) {
        for (const n of j.notes)
          if (n.state !== 'clean' && n.state !== 'regenerated')
            console.log(`   · ${j.family}/${n.rel} —— ${n.state} ${n.why ?? ''}`)
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
  // 样式派生面一族:登记表取材、命令解析、判面与写回档(判据零复制,腿清单只认 pre-commit-hook.js)
  HOOK_REL,
  MAX_TOKENS_BYTES,
  TOKENS_SOURCE_REL,
  tokensStatePathOf,
  tokensSourceSha,
  tokensStateRead,
  tokensStateWrite,
  matchBracket,
  porcelainPaths,
  tokenLegsFrom,
  legArgvAt,
  judgeTokensFace,
  healTokensFamily,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
