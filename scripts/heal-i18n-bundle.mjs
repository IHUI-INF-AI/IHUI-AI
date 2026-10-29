// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * heal-i18n-bundle.mjs —— 小程序离线语言包的「无人重跑就永远是旧的」这一格的出口(守门 105 G5 的写回腿)
 *
 * 立因(2026-10-27 实测):守门 105 是 blocking 且**每次提交都跑**,判据里 G5 拿产物自述钉与被审面
 * 现算的输入哈希比 —— 四端 ui-routes 那份钉在 2026-10-10 就配了写回出口 `--heal-ui-routes`,
 * 而**语言包这一维从来没有**:改一份 `packages/i18n/messages/**.json`(或改生成器本身)并经旁路落地
 * (commit-tree+CAS 不跑钩子)之后,HEAD 上的产物钉就落后,下一枚**毫不相干**的提交被 105 拦下,
 * 而链路上没有任何器物会自己去重跑 `pnpm gen:i18n`。只判不修的 blocking 门 = 恒红门 = 逼人 --no-verify
 * 连带废掉全部守门(§12e/§12f;AGENTS「blocking 门必须自带修复出口」)。
 *
 * 三态与纪律(与 --heal-ui-routes 同型,判定权不归本器):
 *   clean      —— 面上钉与现算输入哈希相等 ⇒ 零写盘、零提交(健康仓上本器什么都不动)。
 *   written    —— 生成了新字节但**未落地**(没给 --apply):只写工作区,交给人/收编器,绝不自己推进 HEAD。
 *   landed     —— 生成 + 经 object-space-land 落 HEAD(给 --apply 才走这一档),落完**按被审面复量**才算数。
 *   refused    —— 拒绝动手并点名:在飞副本闸命中(工作树副本 ≠ 面副本 ⇒ 那是别席现场,不许覆盖 §12)/
 *                 面上取不到产物或输入 / 生成器非零退出 / 量级异常(见 MAX_CHANGED_BYTES)。
 *   undetermined —— 取不到判定所需的面(既不记绿也不冒红,§0.3)。
 * 本器**永远不做**的事:① 不产出"绿"这个结论(转达判定要靠守门 105 自己复跑);② 不 `git add`;
 * ③ 不覆盖别人的在飞改动;④ 不造面上不存在的文件。
 *
 * 用法:
 *   node scripts/heal-i18n-bundle.mjs                 # HEAD 面复检;陈旧则写工作区(不落地)
 *   node scripts/heal-i18n-bundle.mjs --apply         # 陈旧则写工作区并落 HEAD(供守护派发)
 *   node scripts/heal-i18n-bundle.mjs --json          # 结论走 stdout 的 JSON(守护读 summary,不手抄散文)
 * 调度器:scripts/git-guardian.mjs 巡检轮 `healI18nBundle()`(30 分钟节流)。判机器状态 ⇒ 不进提交链(§12e)。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FACE_LABEL, Undetermined, catBatchOids, selectFace } from './lib/face-reader.mjs'
import { PIN_BEGIN, digestInputs, parsePin } from './lib/generated-input-pin.mjs'
// 判据只有一份:输入清单构造来自 lib/i18n-bundle-inputs.mjs,而"门怎么看这个面"直接复用守门 105 的
// makeReader/readPinInputs(§22c:第二份实现必然与第一份漂,2026-10-27 那起 G5 恒红就是这么来的)。
import { __test__ as gate105 } from './check-miniapp-generated.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 生成器的全部落点(7 份):钉/清单/内联包 + 四份 CDN 载荷。少一维就是半个闭环。 */
export const TARGET_PATHS = [
  'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts',
  'apps/miniapp-taro/src/i18n/generated/remote-locale-manifest.gen.ts',
  'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts',
  'apps/miniapp-taro/src/assets/remote-locales/en.b64.txt',
  'apps/miniapp-taro/src/assets/remote-locales/ja.b64.txt',
  'apps/miniapp-taro/src/assets/remote-locales/ko.b64.txt',
  'apps/miniapp-taro/src/assets/remote-locales/zh-TW.b64.txt',
]

/**
 * 量级闸:一次写回的**字节增量**上限。
 * 依据(现读):HEAD 上 remote-locales.gen.ts ≈ 547 KB、zh-cn-pack ≈ 135 KB,四份 CDN 载荷各 ≈ 70 KB,
 * 合计 ≈ 955 KB;一次正常改译文的波动在 KB 级。取 2.5 MB ≈ 整包重写一遍再翻一倍的余量 ——
 * 超过它就不是"补一次生成"而是"整棵树换了口径",必须让人看见(与 105 healUiRoutes 的 MAX_HEAL_CHANGED_LINES 同型)。
 */
export const MAX_CHANGED_BYTES = 2_500_000

/** 面 → git 规格前缀(索引面 `:path`,HEAD 面 `HEAD:path`);磁盘面不走这条路 */
const specPrefix = (face) => (face === 'staged' ? ':' : 'HEAD:')

function gitRun(args, cwd = ROOT) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true, // §5b:漏了这个,守护(计划任务,session 0)下会弹控制台窗
    timeout: 120000, // 守门 80:热路径派生一律带上限
    maxBuffer: 1 << 24,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git 必须显式接管 stdio
  })
}

/**
 * 面上某路径的 blob oid(取不到 ⇒ null)。走 `rev-parse <spec>`,不读磁盘。
 * 用 --verify 形态:路径不存在时 git 退非零 ⇒ 抛错由调用方折成 null,绝不"猜一个 oid"。
 */
export function faceOidOf(face, rel, { root = ROOT, run = gitRun } = {}) {
  try {
    return (
      String(run(['rev-parse', '--verify', '--quiet', `${specPrefix(face)}${rel}`], root)).trim() ||
      null
    )
  } catch {
    return null
  }
}

/** 磁盘某文件的「入库后 oid」(与索引/HEAD 同一套过滤器算,才是可比的) */
export function diskOidOf(rel, { root = ROOT, run = gitRun } = {}) {
  const abs = resolve(root, rel)
  if (!existsSync(abs)) return null
  try {
    return String(run(['hash-object', '-w', '--', rel], root)).trim() || null
  } catch {
    return null
  }
}

/**
 * 该不该动手:把「面上的钉 vs 面上现算的输入哈希」折成三档。
 * 判定与守门 105 的 G5 共用同一份 readPinInputs(同面、同规则、同哈希实现)——
 * 本器判出的 stale 与门判出的 stale 必须是同一个事实,否则就是一台"器物自说自话"的第二把尺。
 */
export function judgeStaleness({ face = 'head', root = ROOT, reader = null } = {}) {
  const rd = reader || gate105.makeReader(face, root)
  const bundleRel = gate105.I18N_BUNDLE
  if (!rd.has(bundleRel))
    return { state: 'undetermined', why: `${FACE_LABEL[face]} 取不到产物 ${bundleRel}` }
  // git 面的取材层要求"先 prefetch 再 read"(守门 105 的 reader 契约,绕开即 Undetermined)——
  // 清单必须由同一条规则算,不能在这里再列一遍路径(§0.6)。
  const inputRels = gate105.bundleInputRels(gate105.REMOTE_LOCALES, (rel) => rd.has(rel))
  rd.prefetch([bundleRel, ...inputRels])
  const bundleText = rd.read(bundleRel)
  if (typeof bundleText !== 'string')
    return { state: 'undetermined', why: `${bundleRel} 读不回字节` }
  const pin = parsePin(bundleText)
  if (!pin.present)
    return { state: 'undetermined', why: `${bundleRel} 没有自述钉(absent)⇒ 无从判新旧` }
  if (pin.malformed)
    return { state: 'undetermined', why: `${bundleRel} 的钉读不出来:${pin.reason}` }
  const computed = digestInputs(gate105.readPinInputs(rd))
  if (computed.digest === pin.digest) {
    return {
      state: 'clean',
      pinned: pin.digest,
      computed: computed.digest,
      inputs: computed.perInput.length,
    }
  }
  return {
    state: 'stale',
    pinned: pin.digest,
    computed: computed.digest,
    inputs: computed.perInput.length,
  }
}

/**
 * 某路径最近 limit 枚提交里出现过的 blob oid(取不到 ⇒ null,由调用方判"证明不了")。
 * 一次 cat-file --batch 取满,不逐份派生 git(§12g;守门 118「少扫不红」同型:批量截断即抛)。
 */
export function historicBlobOids(rel, { root = ROOT, run = gitRun, limit = 40 } = {}) {
  let shas
  try {
    shas = String(run(['log', `-n${limit}`, '--format=%H', '--', rel], root))
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return null
  }
  if (shas.length === 0) return new Set()
  const specs = shas.map((s) => `${s}:${rel}`)
  try {
    const m = catBatchOids(root, specs, { timeout: 60000 })
    const out = new Set()
    for (const v of m.values()) if (v) out.add(v)
    return out
  } catch {
    return null
  }
}

/**
 * 盘上那份是不是**生成器吐出来的**(而不是人手写着的现场)?
 * 立因(2026-10-27 现读):本机工作树里这 7 份的盘上 oid **不在该路径 91 枚历史版本里**,
 * 按"盘上=历史旧版才算滞后"这把尺会永远判成在飞 ⇒ 本腿在这台机上永不干活。
 * 而派生文件的真实现场不是"别人正在写它",是"有人重跑过生成器没落库"—— 那种字节可由生成器原样再产一次,
 * 覆盖不丢任何信息。所以判据按**结构特征**认,而不是按"入过库没有"认:
 *   · `.gen.ts` ⇒ 必须同时有「GENERATED FILE — DO NOT EDIT」横幅与自述钉块,缺一按人改处理;
 *   · `.b64.txt` ⇒ 必须是单个 base64 token(这文件没有任何可手编辑的语义,形态一坏就是人动过)。
 * 认识不了的形态一律回落 in-flight(失效方向恒为"不动手")。
 */
export function isMachineGenerated(rel, { root = ROOT } = {}) {
  let text
  try {
    text = readFileSync(resolve(root, rel), 'utf8')
  } catch (e) {
    return { ok: false, why: `盘上那份读不回来(${String(e?.code ?? e.message).slice(0, 30)})` }
  }
  if (rel.endsWith('.gen.ts')) {
    const banner = /GENERATED FILE[^\n]*DO NOT EDIT/.test(text)
    const pin = text.includes(PIN_BEGIN)
    return banner && pin
      ? { ok: true, why: '横幅 + 自述钉齐全 ⇒ 生成器输出,不是手写现场' }
      : { ok: false, why: `自称产物却缺${banner ? '' : '横幅'}${pin ? '' : '钉'}` }
  }
  if (rel.endsWith('.b64.txt')) {
    return /^[A-Za-z0-9+/]+={0,2}\s*$/u.test(text)
      ? { ok: true, why: 'CDN 载荷是单个 base64 token,无人手编辑语义' }
      : { ok: false, why: '载荷形态不是单个 base64 token ⇒ 按人改处理' }
  }
  return { ok: false, why: '不在本器认识的生成物形态里' }
}

/**
 * 「盘上副本 ≠ 面上副本」这一格有**三种**成因,只有最后一种该让路:
 *  ① **滞后副本**:旁路落地(commit-tree+CAS)只推进 HEAD/索引、不写工作树,于是工作树留着这一路径
 *     **曾经有过的某个版本**。本仓多会话共写,派生产物的工作树副本常年如此 —— 以"≠"作让路条件
 *     等于天天让路、器物永不干活(AGENTS 护栏③ 为同类问题收窄过一轮,依据完全一样:**脏的不是判据面**)。
 *  ② **未落库的生成器输出**:盘上那份从没入过库,但结构上就是生成器吐的(见 isMachineGenerated)
 *     ⇒ 覆盖它不丢任何信息,重跑一次即原样再生。
 *  ③ **在飞改写**:盘上那份既 ≠ 面、也不在历史里、又不是生成器形态 ⇒ 那是别席正写着的内容,不许覆盖(§12)。
 * 取不到历史 / 读不回盘上字节 ⇒ 一律保守算 ③(宁可不动手)。
 */
export function classifyCopyDelta({
  rel,
  face = 'head',
  root = ROOT,
  run = gitRun,
  historyOf = historicBlobOids,
  machineGenerated = isMachineGenerated,
} = {}) {
  const faceOid = faceOidOf(face, rel, { root, run })
  const disk = diskOidOf(rel, { root, run })
  const onDisk = existsSync(resolve(root, rel))
  // 「面上取不到」有两种成因:路径真不在面上 / 派生 git 这一轮没跑成。两者都由 null 进来,
  // 而**只要盘上还有字节**,本器就必须按"证明不了 ⇒ 不动手"处理(§0.3:没判不冒绿,更不冒进)。
  if (faceOid === null) {
    if (!onDisk) return { kind: 'absent-both', faceOid, disk }
    return {
      kind: 'in-flight',
      faceOid,
      disk,
      why: `${FACE_LABEL[face]} 面取不到该路径(或派生 git 没跑成)⇒ 无从比对,保守让路`,
    }
  }
  if (disk === null)
    return {
      kind: 'in-flight',
      faceOid,
      disk,
      why: '盘上没有这一份(或哈希取不到)⇒ 无法证明不是别人现场',
    }
  if (faceOid === disk) return { kind: 'equal', faceOid, disk }
  const hist = historyOf(rel, { root, run })
  if (hist !== null && hist.has(disk))
    return { kind: 'lagging-copy', faceOid, disk, why: '盘上那份是该路径历史里出现过的旧版' }
  const mg = machineGenerated(rel, { root })
  if (mg.ok)
    return { kind: 'generated-copy', faceOid, disk, why: `${mg.why}(且不在该路径历史版本里)` }
  return {
    kind: 'in-flight',
    faceOid,
    disk,
    why:
      hist === null
        ? `历史 blob 集取不到 ⇒ 证明不了"只是滞后";${mg.why}`
        : `盘上那份不在历史里,也不是生成器形态:${mg.why}`,
  }
}

/**
 * 在飞副本闸(§12:绝不替别人覆盖现场)。任一目标文件被判成 ③ ⇒ 那一轮整体拒绝。
 * 为什么整体而不是"跳过那一份":离线包 7 份是**一次生成的同一批字节**(钉/清单/载荷互相引用 version),
 * 落一半就是造出一份自相矛盾的产物 —— 与"逐屏摘掉"的造页闭环不同,那一维各屏互相独立,这一维不独立。
 */
export function findInFlight({
  face = 'head',
  paths = TARGET_PATHS,
  root = ROOT,
  run = gitRun,
  classify = classifyCopyDelta,
} = {}) {
  const busy = []
  const lagging = []
  const generated = []
  for (const rel of paths) {
    const d = classify({ rel, face, root, run })
    if (d.kind === 'in-flight') busy.push({ rel, faceOid: d.faceOid, disk: d.disk, why: d.why })
    else if (d.kind === 'lagging-copy') lagging.push({ rel, faceOid: d.faceOid, disk: d.disk })
    else if (d.kind === 'generated-copy') generated.push({ rel, faceOid: d.faceOid, disk: d.disk })
  }
  return { busy, lagging, generated }
}

/** 默认生成器:在**同一个面**上重跑(绝不让 worktree 面烘进别人未提交的字节) */
function defaultRunGenerator(face, root) {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'gen-i18n-compressed.mjs')
  const flag = face === 'staged' ? '--staged' : '--head'
  try {
    execFileSync(process.execPath, [script, flag], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15 * 60 * 1000, // 闭包尺在 git 面上要逐份补读,慢是慢,但必须有界
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, why: String(e?.stderr ?? e?.message ?? e).slice(0, 220) }
  }
}

/**
 * LAND_PATHS 的分隔符是 `;`(object-space-land.mjs 的 env 契约:"以 ; 分隔的仓库相对路径清单")。
 * 写成 comma 的现场实测:落地器把整串当**一条**路径 ⇒「清单里缺这些声明路径」整轮 refused,
 * 而守护日志里那只是一行 ⚠️。两边各写一遍字面约定,坏的那一边永远静默 ⇒ 约定只留一处出口。
 */
export const LAND_PATHS_SEP = ';'

/** 落地 env 的构造(纯函数,镜像测试对它做 round-trip 断言) */
export function landEnv({ paths, manifest, msg, proof }) {
  return {
    LAND_PATHS: paths.join(LAND_PATHS_SEP),
    LAND_BLOBS: manifest,
    LAND_BLOB_PROOF: proof,
    LAND_MSG: msg,
  }
}

/** 默认落地器:object-space-land(blob 档 + CAS),与造页闭环同一条通路 */
function defaultLand({ paths, oids, msg, root = ROOT, proof }) {
  const tmp = join(root, '.ihui-agent', 'tmp', 'heal-i18n-bundle', `blobs-${process.pid}.json`)
  mkdirSync(dirname(tmp), { recursive: true })
  writeFileSync(
    tmp,
    JSON.stringify({ files: paths.map((p) => ({ path: p, blob: oids[p] })) }, null, 1),
    'utf8',
  )
  try {
    const out = execFileSync(
      process.execPath,
      [join(dirname(fileURLToPath(import.meta.url)), 'object-space-land.mjs')],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...landEnv({ paths, manifest: tmp, msg, proof }) },
      },
    )
    return /CAS 成功|提交面回读/.test(String(out))
      ? { ok: true, out: String(out) }
      : { ok: false, why: '落地器未自证成功' }
  } catch (e) {
    return { ok: false, why: String(e?.stderr ?? e?.message ?? e).slice(0, 260) }
  } finally {
    try {
      rmSync(tmp, { force: true })
    } catch {
      /* 临时件清不掉只影响工作区卫生 */
    }
  }
}

const LAND_MSG_LINES = [
  'chore(miniapp): 离线语言包自走重生成 —— 补守门 105 G5 的写回出口(此前只有人肉 pnpm gen:i18n)',
  '',
  '器物:node scripts/heal-i18n-bundle.mjs --apply(由 git-guardian 巡检轮 healI18nBundle 派发,30 分钟节流)',
  '为什么必须自动:105 是 blocking 且每次提交都跑;输入 packages/i18n/messages/** 或生成器本身一改,',
  '  产物钉就落后 ⇒ 下一枚毫不相干的提交被拦,而链路上没有任何器物会自己去重跑生成器',
  '  (AGENTS「blocking 门必须自带修复出口」/§12e 恒红门禁令)。',
  '字节来源:gen-i18n-compressed.mjs 在**被审面**上重跑产物,本器零复算算式;落地前逐份比过在飞副本闸。',
].join('\n')

/** 盘上新产物的自述钉(默认经守门 105 的磁盘面 reader 读,判据不另起一套取材) */
export function freshPinOf(
  root = ROOT,
  { readerOf = (r) => gate105.makeReader('worktree', r), bundleRel = gate105.I18N_BUNDLE } = {},
) {
  const rd = readerOf(root)
  return parsePin(String(rd.read(bundleRel) ?? ''))
}

/**
 * 一轮闭环。deps 全可注入(镜像测试不碰真 git/真生成器/真 HEAD)。
 * @returns {{state:string, detail:string, changed?:number, paths?:string[]}}
 */
export function healI18nBundle(opts = {}) {
  const {
    face = 'head',
    root = ROOT,
    apply = false,
    judge = judgeStaleness,
    runGenerator = defaultRunGenerator,
    land = defaultLand,
    inFlight = findInFlight,
    maxChangedBytes = MAX_CHANGED_BYTES,
    oidOfDisk = diskOidOf,
    oidOfFace = faceOidOf,
    pinOfFresh = (r) => freshPinOf(r),
  } = opts

  const verdict = judge({ face, root })
  if (verdict.state === 'undetermined') return { state: 'undetermined', detail: verdict.why }
  if (verdict.state === 'clean') {
    return {
      state: 'clean',
      detail: `钉与现算同值(${verdict.pinned?.slice(0, 12)}…,${verdict.inputs} 份输入)⇒ 零写盘`,
    }
  }

  const busyRes = inFlight({ face, root })
  const busy = Array.isArray(busyRes) ? busyRes : busyRes.busy
  if (busy.length > 0) {
    return {
      state: 'refused',
      detail:
        `在飞副本闸:${busy.map((b) => `${b.rel}(面 ${String(b.faceOid).slice(0, 8)}… ≠ 盘 ${String(b.disk).slice(0, 8)}…:${b.why ?? '不同形'})`).join('; ')}` +
        ' ⇒ 整轮拒绝(离线包 7 份是同一次生成的同一批字节,落一半会造出自相矛盾的产物);先收敛这些文件的未提交差异',
    }
  }
  const lag = Array.isArray(busyRes) ? [] : (busyRes.lagging ?? [])
  const gen2 = Array.isArray(busyRes) ? [] : (busyRes.generated ?? [])
  const lagNote =
    lag.length + gen2.length === 0
      ? ''
      : ` 盘上 ≠ 面的 ${lag.length + gen2.length} 份里:滞后副本 ${lag.length} 份(= 该路径历史旧版)、` +
        `未落库的生成器输出 ${gen2.length} 份(横幅+钉/载荷形态可原样再生)⇒ 都不构成让路,一律以面为准重写。`

  const gen = runGenerator(face, root)
  if (!gen?.ok)
    return {
      state: 'refused',
      detail: `生成器未跑成:${gen?.why ?? '(无返回)'} ⇒ 不落地,不把"没生成"洗成"已修"`,
    }

  // 复量:**盘上新产物的自述钉** ↔ **被审面现算的输入哈希**(= 上面 verdict.computed,零再取)。
  // 为什么不"再判一次门":门读的是面,而这一刻面(HEAD/索引)还没变,变的只有盘上那份新字节 ——
  // 再判一次只会读回旧钉,量不出"这一轮到底修没修好",那等于自证了个空(§0.9 判据必须有牙)。
  const freshPin = pinOfFresh(root)
  if (!freshPin.present) {
    return {
      state: 'refused',
      detail: `重跑出来的 ${gate105.I18N_BUNDLE} 没有自述钉 ⇒ 不落一份"说不清自己从哪来"的产物`,
    }
  }
  if (freshPin.digest !== verdict.computed) {
    return {
      state: 'refused',
      detail:
        `重跑后新钉(${freshPin.digest.slice(0, 12)}…)≠ 面上现算输入哈希(${verdict.computed.slice(0, 12)}…)` +
        ' ⇒ 生成器与门的输入口径不同形,不落半套,交人工查(把这一格留给人正是本器"绝不冒绿"的失效方向)',
    }
  }

  const oids = {}
  let changed = 0
  for (const rel of TARGET_PATHS) {
    const before = oidOfFace(face, rel, { root })
    const after_oid = oidOfDisk(rel, { root })
    if (after_oid === null) {
      return { state: 'refused', detail: `生成后读不回 ${rel} 的磁盘字节 ⇒ 不落地` }
    }
    if (before !== after_oid) {
      oids[rel] = after_oid
      const size = existsSync(resolve(root, rel)) ? readFileSync(resolve(root, rel)).length : 0
      changed += size
    }
  }
  const paths = Object.keys(oids)
  if (paths.length === 0)
    return {
      state: 'written',
      changed: 0,
      paths: [],
      detail: `重跑产物与面上逐字节相同 ⇒ 零改动。${lagNote}`,
    }
  if (changed > maxChangedBytes) {
    return {
      state: 'refused',
      changed,
      paths,
      detail:
        `写回量 ${changed} 字节 > 上限 ${maxChangedBytes} ⇒ **不落 HEAD**(异常量级必须让人看见,不自动背书)。` +
        `工作区里那 ${paths.length} 份新字节请人工核对后回滚(git checkout -- <path>)。${lagNote}`,
    }
  }
  if (!apply) {
    return {
      state: 'written',
      changed,
      paths,
      detail: `已写工作区 ${paths.length} 份(${changed} 字节),未落地(没给 --apply)。${lagNote}`,
    }
  }
  const proof =
    `blob = gen-i18n-compressed.mjs 在 ${FACE_LABEL[face]} 面上重跑后、由 git hash-object 按同一套过滤器算出的落点字节;` +
    '本器零复算算式;落地前已逐份过在飞副本闸,并复量到新产物自述钉 == 面上现算输入哈希'
  const landed = land({ paths, oids, msg: LAND_MSG_LINES, root, proof })
  if (!landed?.ok) {
    return {
      state: 'refused',
      changed,
      paths,
      detail: `落地器未成功:${landed?.why ?? '(无返回)'} —— 工作区已写,HEAD 未动。${lagNote}`,
    }
  }
  return {
    state: 'landed',
    changed,
    paths,
    detail: `已落 HEAD(${paths.length} 份,${changed} 字节)。${lagNote}`,
  }
}

function main(argv) {
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    process.exit(2)
  }
  if (argv.includes('--worktree')) {
    console.error(
      '❌ 本器不接受 worktree 面:在飞副本闸要求「盘 ↔ 面」两个副本可比,worktree 当面等于自删这道闸',
    )
    process.exit(2)
  }
  const face = sel.face
  const apply = argv.includes('--apply')
  const json = argv.includes('--json')
  const r = healI18nBundle({ face, apply })
  const line = `[heal-i18n-bundle] 面=${face}(${FACE_LABEL[face]}) state=${r.state} changed=${r.changed ?? 0} paths=${(r.paths ?? []).length}`
  if (json) console.log(JSON.stringify({ face, apply, ...r }))
  else {
    console.log(line)
    console.log(`  ${r.detail}`)
  }
  // 退出码:clean/landed/written = 0(动作层不是判据);refused = 3(让派发方看得见"我没干成");undetermined = 2
  process.exit(r.state === 'refused' ? 3 : r.state === 'undetermined' ? 2 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    console.log(`[heal-i18n-bundle] 未判定:${e.message}`)
    process.exit(2)
  }
}

export const __test__ = {
  TARGET_PATHS,
  MAX_CHANGED_BYTES,
  faceOidOf,
  diskOidOf,
  historicBlobOids,
  isMachineGenerated,
  classifyCopyDelta,
  judgeStaleness,
  findInFlight,
  healI18nBundle,
  freshPinOf,
  landEnv,
  LAND_PATHS_SEP,
  specPrefix,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
