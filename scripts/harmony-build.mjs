#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * harmony-build.mjs — 鸿蒙(HarmonyOS NEXT)发布链的**产物侧唯一出口**(2026-11-06 立,Y-3 ③)
 *
 * 立因:发布矩阵里鸿蒙那一列此前写死 `MISSING + 一句散文`,既不是量出来的、也随时会腐烂
 * (产物真落地了它还是红的 = 假红;判据取不到输入时它也"判过"了 = §0.3 违规)。本器把那一句
 * 散文拆成**可重跑的五格读数**,每格三态(found / missing / unjudged),缺什么点名什么、
 * 谁解锁点名是谁,出路一律给一条真跑得通的命令(§0.8)。
 *
 * 五格(新增一档必须同批在册 HARMONY_AXES + OWNER 表,否则镜像用例翻红):
 *   1 产物工程配置   oh-package.json5 / build-profile.json5 / hvigorfile.ts / *.ets
 *   2 RN 鸿蒙运行时   react-native-harmony / @rnoh / @react-native-oh* 依赖位
 *   3 构建工具链     DevEco SDK / hvigorw(env → PATH → 已知安装位,只测存在性)
 *   4 签名材料与凭据 密钥目录里的鸿蒙件(.cer/.p7b/.keystore + AGC appId)
 *   5 商店端点形态   probe-store-channel 的 CHANNELS.harmony 是否已在册(离线读表,零出网)
 *
 * 纪律:
 *   - **默认只读 + dry-run**:不发一条网络请求、不写一个文件、不派生构建进程;
 *     真构建只在 `--execute` 且工具链那格 FOUND 时才动,结构上没有上传腿(上传属
 *     scripts/submit-store-*.mjs 那一族,鸿蒙端点形态未核实 ⇒ 本器不许代生猜的 URL)。
 *   - 严禁下载 SDK / 装工具链 / 改 CI:本器只**量**在不在,不在就点名"缺哪份、谁给"。
 *   - 凭据只在出口侧脱敏(路径基名/字节/字段名/指纹),值不入 stdout(§5d)。
 *
 * 用法:
 *   node scripts/harmony-build.mjs                  # 只读体检(默认 --check)
 *   node scripts/harmony-build.mjs --json           # 机器读
 *   node scripts/harmony-build.mjs --plan           # dry-run:打印真到齐后跑的那几条命令
 *   node scripts/harmony-build.mjs --execute        # 真构建(前置不齐 ⇒ exit 1 点名,不试)
 *   node scripts/harmony-build.mjs --self-test      # 判据自检(零副作用)
 * 退出码:0 五格全 found / 1 存在 missing(点名)/ 2 存在 unjudged 或本器自身取不到输入
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, storeCredential, STORE_VENDORS } from './lib/rn-release-credentials.mjs'
import { CHANNELS } from './probe-store-channel.mjs'
import { foldStatus } from './release-mobile-rn.mjs'

const ROOT = join(import.meta.dirname, '..')
const RN_DIR = join(ROOT, 'apps', 'mobile-rn')

/** 五格清单:矩阵列、门链、用例都从这里取名字,不允许别处再抄一份(§0.6)。 */
export const HARMONY_AXES = Object.freeze([
  '产物工程配置',
  'RN 鸿蒙运行时依赖',
  '构建工具链(DevEco/hvigor)',
  '签名材料与商店凭据',
  '商店端点形态',
])

/** 每格缺件时的**机主面**动作与验证命令:缺件必须落在人身上,不许写成"等条件"。 */
export const HARMONY_OWNER_PLAYBOOK = Object.freeze({
  '产物工程配置': {
    owner: '机主 X 面(决策)+ 产物工程票(实现)',
    action: '裁决鸿蒙是否进发布面;进则立 RN for Harmony 适配工程票,产出落 apps/mobile-rn/harmony/',
    verify: 'node scripts/harmony-build.mjs --json | node -e "let s=\'\';process.stdin.on(\'data\',d=>s+=d).on(\'end\',()=>console.log(JSON.parse(s).axes.find(a=>a.k===\'产物工程配置\').status))"',
  },
  'RN 鸿蒙运行时依赖': {
    owner: '产物工程票(实现)',
    action: '在 apps/mobile-rn/package.json 装 react-native-harmony(RNOH)或其 fork;装前需机主确认镜像源',
    verify: 'node scripts/harmony-build.mjs --json(该格转 found 即通)',
  },
  '构建工具链(DevEco/hvigor)': {
    owner: '机主 X 面(安装动作不代做:禁下载 SDK、禁装工具链是边界)',
    action: '装 DevEco Studio(含 HarmonyOS SDK)后,把 SDK 根交给本器:env IHUI_DEVECO_SDK_HOME=<SDK 根>,或让 hvigorw 在 PATH 上;本器候选位 D:\\DevEnv\\Huawei、C:\\Program Files\\Huawei\\DevEco Studio',
    verify: 'node scripts/harmony-build.mjs --json(构建工具链格)或 where.exe hvigorw',
  },
  '签名材料与商店凭据': {
    owner: '机主 X 面(AGC 控制台)',
    action: 'AGC 建鸿蒙应用取 appId;「证书管理」申请发布证书(.cer)+ Profile(.p7b)+ 私钥(.keystore);四件放密钥目录(§5d 网盘同步目录 `密钥/模型|华为`同侧,不入仓不入聊天),命名含「鸿蒙/harmony/ohos」以便本器匹配',
    verify: 'node scripts/release-mobile-rn.mjs --json(store-harmony 腿的「开发者凭据」格)',
  },
  '商店端点形态': {
    owner: '机主 X 面(文档正文需登录)',
    action: '从 AppGallery Connect「鸿蒙应用发布 API」文档取**已核实**的查询类端点形态,补进 scripts/probe-store-channel.mjs 的 CHANNELS.harmony(只登记形态,判据不改)',
    verify: 'node scripts/probe-store-channel.mjs --vendor harmony --json',
  },
})

const SKIP_DIRS = /^(node_modules|\.git|dist|build|out|\.expo|\.hvigor|oh_modules)$/

function walkHits(dir, { depth = 0, maxDepth = 3, hits = [], fs = { existsSync, readFileSync, readdirSync } } = {}) {
  if (depth > maxDepth || !fs.existsSync(dir)) return hits
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return hits
  }
  for (const d of entries) {
    if (SKIP_DIRS.test(d.name)) continue
    const p = join(dir, d.name)
    if (d.isDirectory()) walkHits(p, { depth: depth + 1, maxDepth, hits, fs })
    else hits.push(p)
  }
  return hits
}

/** 只读存在性探针:PATH 上找 hvigorw(不安装、不下载)。取不到 PATH ⇒ 未判定,不是"没有"。 */
function findOnPath(name, env, fs = { existsSync }) {
  const pathVar = env.PATH || env.Path || env.path
  if (!pathVar) return null
  const found = pathVar
    .split(';')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .flatMap((seg) => [join(seg, `${name}.bat`), join(seg, `${name}.cmd`), join(seg, name)])
    .filter((p) => fs.existsSync(p))
  return found.length ? found[0] : false
}

/** 五格 ↔ 解锁方表 的成套尺:新增一档而 playbook 未同批登记 ⇒ 返回该档名(用例与自检共用一把尺)。 */
export function axesPlaybookDrift(axes = HARMONY_AXES, playbook = HARMONY_OWNER_PLAYBOOK) {
  return axes.filter((k) => !playbook[k])
}

function readDeps(fs, files) {
  const deps = new Set()
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'))
      for (const table of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        for (const name of Object.keys(j?.[table] ?? {})) deps.add(name)
      }
    } catch {
      /* 取不到 ⇒ 由调用侧按未判定处理,这里不冒充"无依赖" */
    }
  }
  return deps
}

/**
 * 五格现读(纯函数,可注入 fs/env/root ⇒ 用例喂假根而不碰真仓)。
 * 返回值 axes 逐格 {k,status,detail,gap?},gap 只在非 found 时给出并必须点名缺件。
 */
export function harmonyAxes({ root = ROOT, env = process.env, fs = { existsSync, readFileSync, readdirSync }, vendorId = 'harmony', credentialProbe = (v) => storeCredential(v), channels = CHANNELS } = {}) {
  const rnDir = join(root, 'apps', 'mobile-rn')
  const axes = []

  // 1 产物工程配置
  {
    const dirs = [join(rnDir, 'harmony'), rnDir]
    let scanned = 0
    const hits = []
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        continue
      }
      scanned++
      for (const f of walkHits(d, { fs })) {
        const base = f.split(/[\\/]/).pop()
        if (/^(oh-package\.json5|build-profile\.json5|hvigorfile\.ts)$/.test(base) || /\.ets$/.test(base)) hits.push(base)
      }
      if (hits.length) break
    }
    axes.push(
      scanned === 0
        ? { k: HARMONY_AXES[0], status: STATUS.UNJUDGED, detail: `工程根取不到(${dirs.join(' / ')} 均不可读)⇒ 不判"无鸿蒙工程",判未判定` }
        : hits.length
          ? { k: HARMONY_AXES[0], status: STATUS.FOUND, detail: `命中 ${hits.length} 件:${[...new Set(hits)].slice(0, 6).join(', ')}` }
          : { k: HARMONY_AXES[0], status: STATUS.MISSING, detail: `已扫 ${scanned} 个可读目录(深 3 层,跳过 node_modules/oh_modules/build)零命中 ⇒ 无鸿蒙产物工程`, gap: 'apps/mobile-rn/harmony/ 下无 oh-package.json5 / build-profile.json5 / hvigorfile.ts / *.ets' },
    )
  }

  // 2 RN 鸿蒙运行时依赖
  {
    const pkg = join(rnDir, 'package.json')
    if (!fs.existsSync(pkg)) {
      axes.push({ k: HARMONY_AXES[1], status: STATUS.UNJUDGED, detail: `${pkg.replace(/\\/g, '/')} 取不到 ⇒ 不判"无 RNOH 依赖"` })
    } else {
      const deps = readDeps(fs, [pkg])
      const hit = [...deps].filter((n) => /react-native-harmony|@rnoh|@react-native-oh/i.test(n))
      axes.push(
        hit.length
          ? { k: HARMONY_AXES[1], status: STATUS.FOUND, detail: `依赖在册:${hit.join(', ')}` }
          : { k: HARMONY_AXES[1], status: STATUS.MISSING, detail: `package.json ${deps.size} 枚依赖里零 RNOH 族(react-native-harmony / @rnoh / @react-native-oh*)`, gap: '无 react-native-harmony 运行时依赖 ⇒ 现有 RN 源码跑不到鸿蒙宿主' },
      )
    }
  }

  // 3 构建工具链
  {
    const envHit = ['IHUI_DEVECO_SDK_HOME', 'DEVECO_SDK_HOME', 'HOS_SDK_HOME'].filter((k) => env[k] && fs.existsSync(env[k]))
    const knownRoots = ['D:\\DevEnv\\Huawei', 'C:\\Program Files\\Huawei\\DevEco Studio', 'D:\\Program Files\\Huawei\\DevEco Studio'].filter((p) => fs.existsSync(p))
    const pathHit = findOnPath('hvigorw', env, fs)
    if (envHit.length || knownRoots.length || pathHit) {
      axes.push({ k: HARMONY_AXES[2], status: STATUS.FOUND, detail: `SDK 位=${envHit.map((k) => `${k}=${env[k]}`).join(',') || knownRoots.join(',')} hvigorw=${pathHit === false ? '不在 PATH(用 SDK 根内工具)' : pathHit || '经 SDK 根解析'}` })
    } else {
      axes.push({ k: HARMONY_AXES[2], status: STATUS.MISSING, detail: `env(IHUI_DEVECO_SDK_HOME/DEVECO_SDK_HOME/HOS_SDK_HOME)未设 ∧ PATH 无 hvigorw ∧ 已知安装位零命中(${knownRoots.length || 'D:\\DevEnv\\Huawei, C:\\Program Files\\Huawei\\DevEco Studio'})`, gap: '本机无 DevEco SDK / hvigorw ⇒ 机器无从代生产物(本器按边界不下载、不装)' })
    }
  }

  // 4 签名材料与商店凭据(复用凭据层同一把尺,零复算)
  {
    const vendor = STORE_VENDORS.find((v) => v.id === vendorId)
    if (!vendor) {
      axes.push({ k: HARMONY_AXES[3], status: STATUS.UNJUDGED, detail: `STORE_VENDORS 里没有 ${vendorId} 档 ⇒ 无法判凭据面` })
    } else {
      const cred = credentialProbe(vendor)
      axes.push({
        k: HARMONY_AXES[3],
        status: cred.status,
        detail: cred.status === STATUS.FOUND ? `密钥目录命中鸿蒙件:${cred.value.map((v) => `${v.path.split(/[\\/]/).pop()}(${v.bytes}B,字段=${v.fields.join('/') || '二进制'})`).join(' | ')}` : cred.detail,
        ...(cred.status === STATUS.FOUND ? {} : { gap: `缺 AGC 鸿蒙 appId + 发布证书 .cer + Profile .p7b + 私钥 .keystore(密钥目录内按「鸿蒙|harmony|ohos」命名即可被匹配;值不入仓不入聊天)` }),
      })
    }
  }

  // 5 商店端点形态(离线读表,零出网)
  {
    const ch = channels[vendorId]
    axes.push(
      ch
        ? { k: HARMONY_AXES[4], status: STATUS.FOUND, detail: `CHANNELS.${vendorId} 在册:${ch.label}` }
        : { k: HARMONY_AXES[4], status: STATUS.MISSING, detail: `probe-store-channel 的 CHANNELS 表零 ${vendorId} 条目(现枚举 ${Object.keys(channels).join(', ') || '空表'})⇒ 发布 API 端点形态未核实`, gap: '无已核实的鸿蒙发布 API 端点形态 ⇒ 不许拿猜的 URL 建上传腿(§0.8)' },
    )
  }

  return axes
}

/** 五格 → 一条腿的三态 + 逐格缺件与解锁方(矩阵列与门链共用这一个出口)。 */
export function harmonyLeg(opts = {}) {
  const axes = harmonyAxes(opts)
  const status = foldStatus(axes.map((a) => a.status))
  const gaps = axes.filter((a) => a.status !== STATUS.FOUND).map((a) => `${a.k}[${a.status}]:${a.gap ?? a.detail}`)
  const blockers = axes.filter((a) => a.status !== STATUS.FOUND).map((a) => ({ axis: a.k, status: a.status, gap: a.gap ?? a.detail, ...(HARMONY_OWNER_PLAYBOOK[a.k] ? { owner: HARMONY_OWNER_PLAYBOOK[a.k].owner, action: HARMONY_OWNER_PLAYBOOK[a.k].action, verify: HARMONY_OWNER_PLAYBOOK[a.k].verify } : {}) }))
  return { axes, status, gaps, blockers }
}

/** 真到齐后要跑的那几条(只打印,不执行;形态取自 DevEco/hvigor 公开用法,不含任何上传动作)。 */
export function planHarmonyBuild({ _bundleName = 'zh.ai.sq', outDir = 'apps/mobile-rn/harmony' } = {}) {
  return [
    `cd ${outDir} && hvigorw clean --no-daemon`,
    `cd ${outDir} && hvigorw assembleHap --mode module -p product=default -p buildMode=release --no-daemon`,
    `# 产物:hvigor 输出的 *.hap / *.app 落 ${outDir}/build/outputs/default/,上传腿另走 scripts/submit-store-huawei.mjs(端点形态核实后才接)`,
    `# 登记:node scripts/register-app-version-latest.mjs --platform harmony --store harmony --version <ver> --build <code>`,
  ]
}

function renderReport(leg, { plan } = {}) {
  const ICON = { ready: 'PASS', blocked: 'BLOCKED', unjudged: 'UNKNOWN' }
  let out = `\n[${ICON[leg.status]}] harmony-artifact 鸿蒙产物腿(五格现读)\n`
  for (const a of leg.axes) out += `      ${a.status === STATUS.FOUND ? '-' : '!'} ${a.k}: ${a.detail}\n`
  if (leg.status !== 'ready') {
    out += `      缺件与解锁方:\n`
    for (const b of leg.blockers) out += `        - ${b.axis} ⇒ 谁:${b.owner ?? '未点名'}\n          做什么:${b.action ?? b.gap}\n          怎么验:${b.verify ?? '(未点名)'}\n`
    out += `      出路:按上表逐格补齐后重跑 node scripts/harmony-build.mjs --check(本器不下载 SDK、不装工具链)\n`
  }
  if (plan) {
    out += `\n[dry-run] 五格齐备后的构建命令(本轮一条也未执行):\n`
    for (const c of planHarmonyBuild()) out += `      ${c}\n`
  }
  return out
}

function selfTest() {
  const cases = []
  const eq = (name, got, want) => cases.push({ name, pass: JSON.stringify(got) === JSON.stringify(want), got, want })
  eq('五格清单与在册 playbook 成套(新增一档未登记 ⇒ 红)', axesPlaybookDrift(), [])
  eq('变异对照:新增一档而未登记 ⇒ 同一把尺必须翻红', axesPlaybookDrift([...HARMONY_AXES, '新格未登记'], HARMONY_OWNER_PLAYBOOK), ['新格未登记'])
  const stubCred = () => ({ status: STATUS.MISSING, detail: '桩:密钥目录未见鸿蒙件(自检不出网、不读真目录)' })
  const emptyFs = { existsSync: () => true, readFileSync: () => JSON.stringify({ dependencies: {} }), readdirSync: () => [] }
  const axes = harmonyAxes({ root: 'X:/none', env: {}, fs: emptyFs, credentialProbe: stubCred })
  eq('五格齐出(枚举不为 0)', axes.length, HARMONY_AXES.length)
  eq('零命中判 missing 不记绿', axes.filter((a) => a.status === STATUS.MISSING).length >= 3, true)
  eq('每格必有 detail(空串冒充"没这一步" ⇒ 红)', axes.every((a) => typeof a.detail === 'string' && a.detail.length > 0), true)
  eq('非 found 格必点名缺件', axes.filter((a) => a.status !== STATUS.FOUND).every((a) => !!a.gap), true)
  const brokenFs = { existsSync: () => false, readFileSync: () => { throw new Error('nope') }, readdirSync: () => { throw new Error('nope') } }
  eq('取不到输入 ⇒ 该格未判定(不判"无")', harmonyAxes({ root: 'X:/none', env: {}, fs: brokenFs, credentialProbe: () => ({ status: STATUS.UNJUDGED, detail: '桩:取不到' }) }).filter((a) => a.status === STATUS.UNJUDGED).length >= 2, true)
  eq('fold:unjudged 压过 missing', foldStatus([STATUS.MISSING, STATUS.UNJUDGED]), 'unjudged')
  eq('plan 里零上传动作(结构上无上传腿)', planHarmonyBuild().some((c) => /curl|Invoke-WebRequest|upload|PUT https/i.test(c)), false)
  const fail = cases.filter((c) => !c.pass).length
  for (const c of cases) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}${c.pass ? '' : ` got=${JSON.stringify(c.got)} want=${JSON.stringify(c.want)}`}`)
  console.log(`SELF-TEST cases=${cases.length} fail=${fail}`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help')) {
    console.info('用法:node scripts/harmony-build.mjs [--check|--json|--plan|--execute|--self-test]')
    return 0
  }
  const leg = harmonyLeg()
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ leg: 'harmony-artifact', status: leg.status, axes: leg.axes, blockers: leg.blockers, generatedAt: new Date().toISOString() }, null, 2))
  } else {
    console.log(renderReport(leg, { plan: argv.includes('--plan') || argv.length === 0 }))
  }
  if (argv.includes('--execute')) {
    if (leg.status !== 'ready') {
      console.log(`\n拒跑:鸿蒙产物腿判 ${leg.status},缺件 ${leg.blockers.length} 条 ⇒ 本器不试、不下载 SDK、不装工具链`)
      return 1
    }
    for (const c of planHarmonyBuild()) {
      if (c.startsWith('#')) continue
      const [file, ...args] = c.split(' && ').pop().split(/\s+/)
      const r = execFileSync(file, args, { cwd: join(RN_DIR, 'harmony'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 900000 })
      console.log(`$ ${c}\n${String(r).slice(0, 4000)}`)
    }
    return 0
  }
  if (leg.status === 'ready') return 0
  return leg.status === 'unjudged' ? 2 : 1
}

export const __test__ = { HARMONY_AXES, HARMONY_OWNER_PLAYBOOK, axesPlaybookDrift, harmonyAxes, harmonyLeg, planHarmonyBuild, foldStatus }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
