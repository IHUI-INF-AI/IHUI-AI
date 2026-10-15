// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mobile-version-code.mjs — 守门:mobile-rn 的 Expo 配置解析必须产出**单调递增且
 * 号段合法**的 android.versionCode / ios.buildNumber。
 *
 * ## 立因(2026-10-12 装机实测,不是预防)
 *
 * app.json 从未声明 android.versionCode(git 全史 `-S versionCode` 检索零命中)⇒ Expo
 * prebuild 默认 versionCode 恒为 1;iOS 同病(无 ios.buildNumber)⇒ CFBundleVersion 恒为 1。
 * 实测后果:CI nightly 包(vc=1)覆盖手机上 vc=4 的构建时,Android 16 降级保护连拒
 * `install -r`、`-r -d`、`cmd package uninstall -k` 后的重装(DELETE_KEEP_DATA 残留
 * 记录仍记旧 vc),唯一出路是全删重装 —— 本地登录态全丢。versionCode 一旦分配出去只会
 * 单调向上走,"重新从 1 开始"不是 Android 接受的选项,所以这个坑每装一次机踩一次。
 *
 * ## 判据(单一真相在 app.config.js,本门只审计不实现)
 *
 * 以 **Expo 同构方式**执行被审面的 app.config.js,再审计其产出的两个值:
 *   1. `android.versionCode`:整数,∈ [FLOOR, CEILING](边界值由 app.config.js 导出,
 *      本门读取而不自带第二份),且 ≤ 当前 UTC 时钟 YYMMDDHH + 1(未来值即构建机时钟
 *      漂移或乱钉号,会让后续全部构建都成降级);
 *   2. `ios.buildNumber`:数字字符串,且与 versionCode 同源。
 *
 * 为什么必须"执行"而不是正则扫描:判据的实质是"构建机跑 prebuild 时会得到什么号",
 * 只有真执行一遍才知道;而执行语义必须复刻 Expo —— mobile-rn 包是 `type:module`,
 * 原生 require 会把 app.config.js 当 ESM 直接挂掉(实测 ReferenceError),所以本门把
 * 面内容落成 scratch 里的 `app.config.cjs` 再以 CJS 载入(与 Expo 的 jiti 同构)。
 *
 * ## 三态口径
 *
 *   · 红(exit 1):配置解析抛错 / 产出的号越界、缺号、未来号、两端不同源;
 *   · 未判定(exit 2):判定面取不到三个输入文件中的任何一个,或本门基础设施(mkScratch/
 *     落盘)失败 —— 不记为通过,也**不冒红**(无条件,没有"宽松档"可开:
 *     "取不到面就放行"等于把拼错的面旗静默折成合格证);
 *   · 绿(exit 0):解析成功且全部断言通过。两个面旗同给 ⇒ 判死。
 *
 * 用法:
 *   node scripts/check-mobile-version-code.mjs             全量(HEAD blob)
 *   node scripts/check-mobile-version-code.mjs --staged    索引 blob(本次提交会带走的那一份)
 *   node scripts/check-mobile-version-code.mjs --worktree  人工排查(盘上内容)
 *   node scripts/check-mobile-version-code.mjs --json      机读结论
 *   node scripts/check-mobile-version-code.mjs --self-test 门内自检
 * 应急跳过:HUSKY_SKIP_MOBILE_VERSION_CODE=1(跳过即放弃"版本号必须单调递增"这条不变量)
 */
import { createRequire } from 'node:module'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch } from './lib/scratch-dir.mjs'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const GATE = 'check-mobile-version-code.mjs'

/** 被审三件:app.json 是基底配置,app.config.js 是动态配置(判据宿主),package.json 供 version 字段。 */
export const VERSION_FILES = [
  'apps/mobile-rn/app.json',
  'apps/mobile-rn/app.config.js',
  'apps/mobile-rn/package.json',
]

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出供镜像测试构造面证明,口径与守门 36/124/93 逐字同形。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/** 纯函数:UTC 时钟 → YYMMDDHH(8 位)。号段形状的唯一推导处,判据与自检共用。 */
export function yymmddhh(now) {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0')
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const hh = String(now.getUTCHours()).padStart(2, '0')
  return Number(`${yy}${mm}${dd}${hh}`)
}

/**
 * 纯函数:审计一次解析产物。floor/ceiling 由被审模块自带(单一真相),本函数不持有常量。
 * @returns {{ok: boolean, problems: string[]}}
 */
export function judgeResolved({ resolved, floor, ceiling, now }) {
  const problems = []
  const vc = resolved?.android?.versionCode
  const bn = resolved?.ios?.buildNumber
  const nowCode = yymmddhh(now)
  if (typeof vc !== 'number' || !Number.isInteger(vc)) {
    problems.push(
      `android.versionCode 缺失或不是整数(实得 ${JSON.stringify(vc)})—— ` +
        'app.json 不声明 + app.config.js 不注入时 Expo 默认恒为 1,覆盖安装必被降级保护拒',
    )
  } else {
    if (vc < floor)
      problems.push(`versionCode ${vc} 低于号段下限 ${floor}(Expo 默认 1 或历史低值,同上)`)
    if (vc > ceiling)
      problems.push(`versionCode ${vc} 超过天花板 ${ceiling}(Android/Play 的 versionCode 上限)`)
    if (vc > nowCode + 1)
      problems.push(
        `versionCode ${vc} 超过当前时钟 ${nowCode}(未来号:构建机时钟漂移或乱钉号,会让后续全部构建都成降级)`,
      )
  }
  if (typeof bn !== 'string' || !/^\d+$/.test(bn)) {
    problems.push(`ios.buildNumber 缺失或不是数字字符串(实得 ${JSON.stringify(bn)})`)
  } else if (typeof vc === 'number' && bn !== String(vc)) {
    problems.push(`ios.buildNumber(${bn}) 与 android.versionCode(${vc}) 不同源`)
  }
  return { ok: problems.length === 0, problems }
}

/**
 * 以 Expo 同构语义执行被审配置:面内容落 scratch 的 `.cjs`(复刻 jiti 的 CJS 执行,
 * mobile-rn 是 type:module,原生 require 会把 .js 当 ESM 挂掉),再以基底 app.json
 * 调用模块。**被审代码抛错 = 判红**(构建同样会炸);本函数自身的基础设施失败直接抛出,
 * 由调用方折成"未判定"。
 *
 * @param {{appJsonText:string, appConfigText:string, packageJsonText:string, env?:Record<string,string|undefined>}} input
 * @returns {{resolved:object, floor:number, ceiling:number}}
 */
export function evaluateFace({ appJsonText, appConfigText, packageJsonText, env = {} }) {
  // §26:夹具唯一落点 = scratch 根(mkScratch 自建目录,退出即摘牌)。
  // 旧写法走 os.tmpdir() —— 活进程 TEMP 可能仍钉 C 盘,正是守门 check-fixture-tmpdir 的 F2 判据。
  const dir = mkScratch('mvc-eval-')
  try {
    writeFileSync(join(dir, 'package.json'), packageJsonText, 'utf8')
    writeFileSync(join(dir, 'app.json'), appJsonText, 'utf8')
    writeFileSync(join(dir, 'app.config.cjs'), appConfigText, 'utf8')
    const req = createRequire(join(dir, 'package.json'))
    // env 注入:模拟"这次构建机上有什么环境变量"。默认路径不设 IHUI_VERSION_CODE。
    // 注入窗口必须覆盖到 mod({config}) **调用**为止 —— 配置函数是调用时读 env 的,
    // req() 一回来就还原会让覆盖口静默失效(实测:S5/S6/S7 三例因此全绿)。
    const key = 'IHUI_VERSION_CODE'
    const had = Object.prototype.hasOwnProperty.call(process.env, key)
    const prev = process.env[key]
    if (env[key] === undefined || env[key] === '') {
      if (had) delete process.env[key]
    } else {
      process.env[key] = env[key]
    }
    try {
      const mod = req(join(dir, 'app.config.cjs'))
      if (typeof mod !== 'function')
        return { loadError: 'app.config.js 未导出函数(Expo 要求 module.exports = ({config}) => …)' }
      const floor = mod.VERSION_CODE_FLOOR
      const ceiling = mod.VERSION_CODE_CEILING
      if (typeof floor !== 'number' || typeof ceiling !== 'number')
        return {
          loadError:
            '配置模块未导出 VERSION_CODE_FLOOR / VERSION_CODE_CEILING(号段边界的单一真相,见 app.config.js 尾部)',
        }
      const base = JSON.parse(appJsonText).expo
      const resolved = mod({ config: base })
      return { resolved, floor, ceiling }
    } finally {
      if (had) process.env[key] = prev
      else delete process.env[key]
    }
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

/** 按判定面取三件内容。任一面取不到 ⇒ 抛 Undetermined(调用方折成 exit 2),不回落另一面。 */
export function readFaceInputs(root, face) {
  if (face === 'worktree') {
    const out = {}
    for (const rel of VERSION_FILES) {
      const t = readWorktreeFile(root, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${rel}`)
      out[rel] = t
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = VERSION_FILES.map((rel) => prefix + rel)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  const out = {}
  for (let i = 0; i < VERSION_FILES.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${VERSION_FILES[i]}`)
    out[VERSION_FILES[i]] = t
  }
  return out
}

/** 门内自检:合成面内容,证明判据的每一枝(含反向枝)都按预期红/绿。 */
export function selfTest() {
  const rows = []
  const t = (name, cond, got) => rows.push({ name, ok: cond === true, got: String(got) })
  const PKG = JSON.stringify({ name: 'ihui-ai-mobile', version: '0.0.5' })
  const APPJSON = JSON.stringify({
    expo: {
      name: 'IHUI AI',
      slug: 'ihui-ai-mobile',
      version: '0.0.5',
      ios: { bundleIdentifier: 'ai.ihui.mobile' },
      android: { package: 'zh.ai.sq' },
      extra: { WX_APP_APPID: 'wx85fa429a9331b5c8', WX_UNIVERSAL_LINK: 'https://aizhs.top/' },
    },
  })
  const BOUNDS =
    'module.exports.VERSION_CODE_FLOOR = 26010100\nmodule.exports.VERSION_CODE_CEILING = 2100000000\n'
  // 合法形态(时间戳硬编码,取自过去时刻 ⇒ 与测试运行时刻无关)
  const OK_CONFIG = `module.exports = ({ config }) => ({ ...config, android: { ...config.android, versionCode: 26101208 }, ios: { ...config.ios, buildNumber: '26101208' } })\n${BOUNDS}`
  const run = (appConfigText, env, appJsonText = APPJSON) => {
    // 被审配置自身抛错(语法错/配置函数抛错)= 构建同样会炸 ⇒ 判红,与 main() 同口径;
    // 不接住的话一个预期内的红会以未捕获异常的形式崩掉整轮自检。
    let r
    try {
      r = evaluateFace({ appJsonText, appConfigText, packageJsonText: PKG, env })
    } catch (e) {
      return { ok: false, problems: [String(e?.message || e)] }
    }
    if (r.loadError) return { ok: false, problems: [r.loadError] }
    return judgeResolved({ ...r, now: new Date() })
  }
  t('S1 合法配置 ⇒ 绿', run(OK_CONFIG).ok === true)
  t('S2 不注入 versionCode(app.json 也不声明)⇒ 红', run(`module.exports = ({ config }) => ({ ...config })\n${BOUNDS}`).ok === false)
  t('S3 硬编码 versionCode=1(Expo 默认值的显式化)⇒ 红', run(`module.exports = ({ config }) => ({ ...config, android: { ...config.android, versionCode: 1 }, ios: { ...config.ios, buildNumber: '1' } })\n${BOUNDS}`).ok === false)
  t('S4 硬编码 versionCode=4(EAS 计数器形态,低于下限)⇒ 红', run(`module.exports = ({ config }) => ({ ...config, android: { ...config.android, versionCode: 4 }, ios: { ...config.ios, buildNumber: '4' } })\n${BOUNDS}`).ok === false)
  const ENV_CONFIG = `module.exports = ({ config }) => { const n = Number(process.env.IHUI_VERSION_CODE || 26101208); return { ...config, android: { ...config.android, versionCode: n }, ios: { ...config.ios, buildNumber: String(n) } } }\n${BOUNDS}`
  t('S5 合法覆盖口 IHUI_VERSION_CODE=26093000 ⇒ 绿', run(ENV_CONFIG, { IHUI_VERSION_CODE: '26093000' }).ok === true)
  t('S6 非法覆盖口 IHUI_VERSION_CODE=1(低于下限)⇒ 红', run(ENV_CONFIG, { IHUI_VERSION_CODE: '1' }).ok === false)
  t('S7 未来号 IHUI_VERSION_CODE=99991231 ⇒ 红', run(ENV_CONFIG, { IHUI_VERSION_CODE: '99991231' }).ok === false)
  t('S8 只注 android 不注 ios.buildNumber ⇒ 红', run(`module.exports = ({ config }) => ({ ...config, android: { ...config.android, versionCode: 26101208 } })\n${BOUNDS}`).ok === false)
  // S9 的判据是"app.json 缺微信配置 ⇒ 配置函数抛错 ⇒ 判红":夹具必须给一份**缺 extra** 的
  // app.json,否则被审函数根本不抛(第一版就栽在带着完整 extra 的 APPJSON 上,三例全绿)。
  const APPJSON_NO_WX = JSON.stringify({
    expo: {
      name: 'IHUI AI',
      slug: 'ihui-ai-mobile',
      version: '0.0.5',
      ios: { bundleIdentifier: 'ai.ihui.mobile' },
      android: { package: 'zh.ai.sq' },
      extra: {},
    },
  })
  const STRICT_CONFIG = `module.exports = ({ config }) => { if (!config.extra?.WX_APP_APPID) throw new Error('[app.config] 缺少微信支付配置'); return { ...config, android: { ...config.android, versionCode: 26101208 }, ios: { ...config.ios, buildNumber: '26101208' } } }\n${BOUNDS}`
  t('S9 app.json 缺微信配置(配置函数抛错)⇒ 红', run(STRICT_CONFIG, undefined, APPJSON_NO_WX).ok === false)
  t('S9b 同配置 + 完整 extra ⇒ 绿(抛错判据不误伤正常仓)', run(STRICT_CONFIG).ok === true)
  t('S10 app.config.js 语法错误 ⇒ 红', run(`module.exports = ({ config }) => ({ ...config,\n${BOUNDS}`).ok === false)
  t('S11 未导号段边界 ⇒ 判不出(loadError),不得冒绿', run(OK_CONFIG.replace(BOUNDS, '')).ok === false)
  t(
    'S12 buildNumber 与 versionCode 不同源(两端各钉一个号)⇒ 红',
    run(`module.exports = ({ config }) => ({ ...config, android: { ...config.android, versionCode: 26101208 }, ios: { ...config.ios, buildNumber: '26101207' } })\n${BOUNDS}`)
      .ok === false,
  )
  return rows
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    const rows = selfTest()
    for (const r of rows) console.info(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ` — ${r.got}`}`)
    const fail = rows.filter((r) => !r.ok).length
    console.info(`[${GATE}] self-test: pass ${rows.length - fail} / fail ${fail}`)
    return fail === 0 ? 0 : 1
  }
  const FACE_SEL = faceFromArgv(args)
  if (FACE_SEL.error) {
    console.error(`[${GATE}] ❌ 无法判定:${FACE_SEL.error}`)
    return 2
  }
  const face = FACE_SEL.face
  const asJson = args.includes('--json')
  let inputs
  try {
    inputs = readFaceInputs(ROOT, face)
  } catch (e) {
    const known = e instanceof Undetermined
    console.error(
      `[${GATE}] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${known ? e.message : (e?.stack ?? e)}`,
    )
    return 2
  }
  let versionCode = null
  let buildNumber = null
  let problems = []
  let evalError = null
  try {
    const r = evaluateFace({
      appJsonText: inputs[VERSION_FILES[0]],
      appConfigText: inputs[VERSION_FILES[1]],
      packageJsonText: inputs[VERSION_FILES[2]],
      env: { IHUI_VERSION_CODE: process.env.IHUI_VERSION_CODE },
    })
    if (r.loadError) {
      evalError = r.loadError
    } else {
      versionCode = r.resolved?.android?.versionCode ?? null
      buildNumber = r.resolved?.ios?.buildNumber ?? null
      problems = judgeResolved({ ...r, now: new Date() }).problems
    }
  } catch (e) {
    // 被审配置自身抛错(JSON 坏/配置函数抛错/语法错)= 构建同样会炸 ⇒ 判红,不是未判定。
    evalError = String(e?.message || e)
  }
  const ok = !evalError && problems.length === 0
  if (asJson) {
    console.info(
      JSON.stringify({
        gate: GATE,
        face,
        ok,
        versionCode,
        buildNumber,
        problems: evalError ? [evalError] : problems,
      }),
    )
    return ok ? 0 : 1
  }
  if (ok) {
    console.info(
      `[${GATE}] ✅ versionCode=${versionCode} / buildNumber=${buildNumber} 号段合法且单调(取材面:${FACE_TXT[face]})`,
    )
    return 0
  }
  for (const p of evalError ? [evalError] : problems) console.error(`  ${p}`)
  console.error(
    '  修复(二选一,不得为消红削判据):① 恢复 app.config.js 的 resolveBuildNumber 注入;② 确需钉号时设 IHUI_VERSION_CODE(8 位正整数,≥26010100)',
  )
  console.error(`[${GATE}] Found ${evalError ? 1 : problems.length} 处版本号缺陷(取材面:${FACE_TXT[face]})`)
  return 1
}

// §22d
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = { judgeResolved, yymmddhh, evaluateFace, selfTest, VERSION_FILES, GATE }
