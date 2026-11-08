// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子,需 console 输出结论 */
/**
 * check-cross-end-parity-drift.mjs — 跨端对齐"是否正在倒退"的只读漂移尺(不进提交链)
 *
 * 立因:本仓三条对齐链(web→RN 功能映射 / RN→小程序镜像 / 样式 token 派生)各有对账器,
 * 但**没有任何一处回答"这一轮比上一轮好了还是坏了"**。登记数只能靠人想起来去跑,
 * 于是 2026-10-24→25 一天里镜像从 26 涨到 84 这件事,只有翻提交才看得见。
 * 本尺把"涨/跌"变成机读结论 + 一份快照台账,供 git-guardian 巡检轮派发;
 * 倒退(镜像减少 / 登记表腐烂 / 账本文档与现读脱节)才报警,涨不报。
 *
 * 判据零复算(§0.6):数字全部**取自现成对账器的 --json 输出**,本文件不重算任何一条判据,
 * 只做"上一轮快照 ↔ 本轮现读"的比较(6 把子尺)
 *   · scripts/check-cross-end-screen-coverage.mjs --json  → 共享屏/已镜像/登记表条目/判红数(237)
 *   · scripts/check-web-rn-screen-parity.mjs --json       → web 路由/aligned/unmapped/腐烂数(128)
 *   · scripts/check-miniapp-mirror-fidelity.mjs --json    → 承载对数/手写对数/未还原键数/断链/声明不符(283)
 *     (2026-10-27 接:还原度这条链此前只有 CI 与"人想起来才跑"的尺,守护轮的倒退⇒到人不认识它,
 *      于是"承载页被改回头抄""文案键被删掉""壳断链"三类都在账面上无声)
 *   · scripts/upgrade-miniapp-shell-pages.mjs --json      → 可升级/拒落页数(升级落地)
 *   · scripts/check-web-rn-style-tiers.mjs --json         → RN↔web 同源档位分叉/待裁(RN↔web 样式档)
 *   · scripts/check-miniapp-style-tiers.mjs --json        → 小程序档位 defaulted/literal(小程序样式档)
 *   · docs/engineering/rn-miniapp-parity-matrix.md        → 缺口账本文档自述的三个数(docStale)
 *
 * 明确不覆盖(不得在本尺名下宣称):token 93、props 288、文案 291、薄壳 299、
 * 承载 301、生成物 105、文档数字 173;这七门须各自独立跑,本尺的绿不等于它们绿。
 *
 * 三态(§0.3):任一子对账器取不到结论 ⇒ state=undetermined(不记绿也不冒红);
 * 取到且有倒退维 ⇒ state=regressed;否则 ok。文档数字与现读不等 ⇒ 单列 docStale(可整改:重跑生成命令)。
 *
 * 回归制入口(2026-11-06 接提交链):`--gate` 不读上一轮本机快照,只比仓内基线
 * `scripts/data/cross-end-drift-gate-baseline.json` —— 存量只报数,只有"比基线更坏"才 exit 1。
 * `--push` 只改人读措辞(runner 侧登记为 push 面 blocking);退出码语义两面一致:
 * 0=未恶化 / 1=相对基线恶化 / 2=未判定。基线读不到、某维现读取不到 ⇒ 一律 2,**不折成 0**。
 *
 * Usage:
 *   node scripts/check-cross-end-parity-drift.mjs            # 现读并打印
 *   node scripts/check-cross-end-parity-drift.mjs --json     # 机读
 *   node scripts/check-cross-end-parity-drift.mjs --record   # 同时把本轮写进快照台账(守护轮用)
 *   node scripts/check-cross-end-parity-drift.mjs --gate     # 回归制:比仓内基线(commit 面 advisory)
 *   node scripts/check-cross-end-parity-drift.mjs --gate --push  # 回归制 push 面(恶化即失败)
 *   node scripts/check-cross-end-parity-drift.mjs --self-test
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 裁决台账单源(§0.6):镜像数减少的唯一豁免凭据,判据不在此复算。
import { readVerdicts } from './lib/cross-end-verdicts.mjs'
// 回归制判定单源(§0.6):本文件不自己比基线,只把现读值交给纯函数。
import { describeRegressions, judgeBaseline, readBaseline } from './lib/cross-end-baseline-gate.mjs'
// 取材层(§5a):绝对 git + stdio 接管 + timeout;本文件不自拼裸 git。
import { gitRaw } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const STATE_FILE = join(ROOT, '.ihui-agent', 'state', 'cross-end-parity-last.json')
const DOC_PATH = 'docs/engineering/rn-miniapp-parity-matrix.md'
/** 存量固化基线(回归制:存量只报数,只有"比基线更坏"才在 push 面阻断) */
const GATE_BASELINE_PATH = join(ROOT, 'scripts', 'data', 'cross-end-drift-gate-baseline.json')
const GATE_BASELINE_REL = 'scripts/data/cross-end-drift-gate-baseline.json'
/** 基线时刻的 web↔RN 台账(读基线提交点的那一版,§0.6:不改基线数值,只补键级参照) */
const WEB_RN_MAP_REL = 'scripts/data/web-rn-screen-map.jsonl'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const recordMode = argv.includes('--record')
const selfTest = argv.includes('--self-test')
const gateMode = argv.includes('--gate')
const pushMode = argv.includes('--push')

/**
 * 变坏方向表(提交链判据原文)。'up' = 现读大于基线即恶化;'down' = 小于基线即恶化。
 * 口径纪律:只有"掉下去就是丢东西 / 涨上来就是多欠账"的维才进表;机会窗(conversionUpgradable)
 * 与手工保真数(fidelityHand)不是恶化,不进表 —— 判据不做"看着像坏"的主观判断。
 */
export const GATE_DIRECTIONS = [
  ['mirrored', 'down', '已镜像共享屏数'],
  ['registryEntries', 'down', '镜像登记表条目'],
  ['coverageRed', 'up', '门 128 判红处'],
  ['mapRot', 'up', 'web↔RN 登记表腐烂行'],
  ['aligned', 'down', 'web→RN aligned 行'],
  ['alignedUnique', 'down', 'web→RN 承载面(去重 web 键)'],
  ['unmapped', 'up', 'web 路由未判定数'],
  ['fidelityHosted', 'down', '壳承载对数'],
  ['fidelityMissing', 'up', '镜像页未还原键数'],
  ['fidelityBroken', 'up', '壳承载断链对数'],
  ['fidelityOther', 'up', '声明与承载不符对数'],
  ['fidelityPackAbsent', 'up', '缺整块命名空间的屏数'],
  ['fidelityRetractionInvalid', 'up', '键级撤除台账不成立行'],
  ['fidelityRetractionRot', 'up', '键级撤除台账腐烂行'],
  ['tierRnMissingN', 'up', 'RN 端非档值用量(处)'],
  ['tierRnMissingKinds', 'up', 'RN 端非档值种类'],
  /**
   * 2026-11-07 forkN 拆两栏:判据只对「未登记」那栏判新增/恶化;「已登记」那栏(forkNAllowed /
   * forkKindsAllowed)只进 values 做读数展示,不进判据(登记才是承认差异的合法通道)。
   * 两栏恒等式由尺子自检钉住(forkNAllowed + forkNUnregistered == forkN,种类同理)。
   */
  ['tierRnForkNUnregistered', 'up', 'RN↔web 取异档且未登记允许差异(处)'],
  ['tierRnForkKindsUnregistered', 'up', 'RN↔web 取异档且未登记允许差异(种)'],
  ['tierWebOffN', 'up', 'web 端非档/异档用量(处)'],
  ['tierWebOffKinds', 'up', 'web 端非档/异档种类'],
  ['tierPending', 'up', '待裁分叉允许差异行'],
  ['tierAllowanceExpired', 'up', '已到期未续期的分叉豁免'],
  ['mpTierDefaulted', 'up', '小程序用 Tailwind 默认档的位置数'],
  ['mpTierLiteral', 'up', '小程序裸字面量位置数'],
  ['prefixContradicted', 'up', '门户表与段级豁免互斥路由'],
  ['staleCountAssertions', 'up', '豁免 reason 自述计数腐烂'],
  ['missingExpiry', 'up', '段级豁免缺期/到期'],
  ['duplicateWebKeys', 'up', '同一 web 键多行'],
  ['pendingWebPair', 'up', 'web↔RN 证据不足队列'],
  /**
   * 2026-11-08 拆两栏:判过确认「RN 缺这屏」是**登记动作**,不是恶化 —— 如实把一条 web 路由
   * 登记成 gap,必然让这个数 +1;把它当 'up' 判红,诚实的登记也会翻红,人被逼去定向刷基线
   * (实测 /sag2)。所以本届判据**不认** gap 总量:登记只进 advisories(只报数),
   * 「既有承载是否被削减」由 alignedUnique(down)/aligned(down) 与键级面
   * judgedGapWebRegression(同一 web 键从 aligned/portal 退化为 gap)判。
   */
  ['conversionRefused', 'up', '预演拒绝转壳的页数'],
]

/**
 * 跑一道对账器取 JSON;非零退出也可能带完整结论(判红档),故 stdout 优先、状态另报。
 * 六把尺只读同一面、互不写盘 ⇒ 并发派生;语义与改动前的同步实现逐条对齐(2026-11-07 提速时立):
 * - 尺子不在位 ⇒ ok:false(不进并发);
 * - 退出码非零但 stdout 是 JSON ⇒ 仍 ok:true(判红档的结论要照收);
 * - 抛错/超时/maxBuffer 溢出且没有可解析 stdout ⇒ ok:false(整门因此未判定,不许被并发吞掉)。
 * 子进程统一带 `IHUI_FACE_TREE_SNAPSHOT=1`:一轮只读扫描里 HEAD 树表只物化一次(见 face-reader)。
 */
function runRulerAsync(script, args = ['--json']) {
  // 绝对路径只给测试用(临时夹具,不进仓库);生产一律相对 HERE 的尺子名。
  const cmd = isAbsolute(script) ? script : join(HERE, script)
  if (!existsSync(cmd)) return Promise.resolve({ ok: false, why: `尺子不在位:${script}` })
  return new Promise((resolve) => {
    try {
      execFile(
        process.execPath,
        [cmd, ...args],
        {
          cwd: ROOT,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 10 * 60 * 1000,
          maxBuffer: 1 << 24,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, IHUI_FACE_TREE_SNAPSHOT: '1' },
        },
        (e, stdout) => {
          const out = String(stdout ?? '')
          if (!e) {
            try {
              resolve({ ok: true, json: JSON.parse(out) })
            } catch {
              resolve({ ok: false, why: `${script} 输出不是 JSON` })
            }
            return
          }
          if (out.trim()) {
            try {
              resolve({ ok: true, json: JSON.parse(out), status: e?.code ?? null })
              return
            } catch {
              /* 落到下面 */
            }
          }
          resolve({ ok: false, why: `${script} 跑不动:${String(e?.message ?? e).slice(0, 120)}` })
        },
      )
    } catch (e) {
      // 连派生都没成功(参数/环境级错误):同样折成 ok:false,绝不 resolve 成"没有这把尺"
      resolve({ ok: false, why: `${script} 跑不动:${String(e?.message ?? e).slice(0, 120)}` })
    }
  })
}

/** 从缺口账本文档自述行抽三个数(生成器写的是 `- 共享屏(真相源): **218**` 这种形) */
function docNumbers(md) {
  const pick = (label) => {
    // 标签里的括号是**字面量**(共享屏(真相源)),不转义会被当成分组 ⇒ 永远抽不到数。
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`-\\s*${esc}:\\s*\\*\\*(\\d+)\\*\\*`).exec(md || '')
    return m ? Number(m[1]) : null
  }
  // 缺口行标签以**生产方**(report-rn-miniapp-gaps.mjs 第 137 行)现写为准:它发的是
  // `缺口合计`,而本解析曾读 `缺口(未判定镜像)` —— 消费方读一个生产者从不发射的标签,
  // 结果是 gaps 恒 null、C9 阳性对照恒红(2026-10-26 实测)。旧标签保留为兜底,防历史文档。
  return {
    sharedTotal: pick('共享屏(真相源)'),
    mirrored: pick('已被小程序显式镜像'),
    gaps: pick('缺口合计') ?? pick('缺口(未判定镜像)'),
  }
}

/**
 * 比较纯函数:上一轮快照 ↔ 本轮现读。
 * 倒退维只有这些族,逐条给"能整改的下一步"(§5e-1 可整改性准入):
 *   mirrored-decrease —— 镜像声明被撤 ⇒ 查是哪条标记/登记被删(门 128 R3 同判据)
 *   web-aligned-decrease / web-unmapped-increase —— RN 承载被拆 / 新 web 页无人判过(与上一轮快照比)
 *   registry-rot      —— 登记表条目腐烂/判红 ⇒ 修登记或补标记(门 128 R1)
 *   map-rot           —— web↔RN 登记表腐烂 ⇒ 修 aligned 指向或补 reason(门 check-web-rn-screen-parity)
 *   doc-stale         —— 账本文档数字≠现读 ⇒ 重跑 report-rn-miniapp-gaps --write
 *   mirror-hosted-decrease / mirror-missing-increase —— 承载对数减少 / 未还原键增加(与上一轮快照比)
 *   mirror-chain-broken / mirror-declaration-mismatch —— 引壳而链断 / 声明与承载不是同一屏(绝对值出声:
 *       这两维现读存量都是 0,出现即"新增的产物级缺陷",不是把存量判成人人红(§12e))
 *   conversion-available —— 落地器预演读到手写页可转壳承载(机会窗,不是倒退;带齐两步命令)
 *   style-tier-tierRnMissingN/tierRnForkN/tierWebOffN/tierPending/mpTierDefaulted/mpTierLiteral-increase
 *       —— 三端"同源档位"用量净增(2026-11-03 接;兑现 check-web-rn-style-tiers 头注那句
 *       "净增经 §5e 到人",并补上小程序档位尺此前只有驾驶舱只读档、无人轮间比较那一格)
 * 涨跌只比"本轮有没有变坏",不比绝对值大小,免得把正常增长判成异常。
 */
/**
 * 「上一轮快照之后」写下的 not-applicable 裁决条数 —— 镜像数减少的唯一合法解释。
 * 基线时刻取不到 / 台账读不出 / 行内 at 解析不出 ⇒ 返回 0 ⇒ 照旧判红:
 * 不拿"没读到"当豁免(§0.3),也不给"没证据的撤声明"开路(§0.7 豁免必须验过才免)。
 */
export function notApplicableSince(rows, sinceIso) {
  // 台账 at 只有日精度(2026-10-30),而基线快照是当天凌晨的 ISO 时刻 —— 直接比瞬时会把**当天写的裁决**
  // 判成"早于基线",于是撤假声明永远豁免不掉、哨兵天天报倒退。两边都归一到"日",同日算同期。
  const dayOf = (v) => {
    const t = Date.parse(String(v ?? '').trim())
    return Number.isFinite(t) ? Math.floor(t / 86400000) : NaN
  }
  const sinceDay = dayOf(sinceIso)
  if (!Number.isFinite(sinceDay) || !Array.isArray(rows)) return 0
  return rows.filter((r) => {
    const d = dayOf(r?.at)
    return r && r.verdict === 'not-applicable' && Number.isFinite(d) && d >= sinceDay
  }).length
}

/**
 * 取不到 ⇒ null(未判定),绝不折成 0(§0.3:没判不能写成"没有")。
 * 注意 `Number(null) === 0` —— 直接 Number() 会把"没有基线"读成"基线是零",
 * 于是"本轮第一次量到"被当成"净增"喊出去(实测:旧快照没有新维时 0 → 28 假净增)。
 */
function finiteOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
/**
 * 数组长度即该维计数;未判定标记非空 ⇒ 同样 null(那一维本轮没判,不冒红也不记 0)。
 * 口径来源只有尺子一处(§0.6):本文件不自己解析台账、不自己数"几行坏了"。
 */
function countOrNull(items, undetermined) {
  if (!Array.isArray(items)) return null
  if (Array.isArray(undetermined) && undetermined.length > 0) return null
  return items.length
}

/**
 * judgedGapWeb 拆两栏的纯判据(2026-11-08 立)。
 *
 * 立因:gap 是门许可的**诚实登记档**,登记动作必然让 gap 数 +1;旧判据把它当 'up' 判红,
 * 于是「如实承认某屏 RN 零承载」与「把既有承载拆掉」在读数上无法区分,诚实登记被逼成刷基线。
 *
 * 两个方向明确的面(§0.6:只做差集,不重算"谁是承载"):
 *   登记面 registered = 本轮 gap 键 - 基线 gap 键(只报数,不阻断)
 *   承载面 regression = 本轮 gap 键 ∩ 基线承载键(aligned ∪ portal)⇒ 同一 web 键从承载退化为 gap
 *
 * 取不到键集 ⇒ compared=false(该面本轮不判,不冒红也不记绿,§0.3),由调用方折成"未判定"可追行。
 * @param {{nowGapKeys?:string[]|null, baseGapKeys?:string[]|null, baseCarriedKeys?:string[]|null}} input
 */
export function judgeJudgedGapFaces({ nowGapKeys, baseGapKeys, baseCarriedKeys }) {
  const clean = (v) =>
    Array.isArray(v) ? [...new Set(v.filter((k) => typeof k === 'string' && k.length > 0))] : null
  const now = clean(nowGapKeys)
  const baseGap = clean(baseGapKeys)
  const baseCarried = clean(baseCarriedKeys)
  if (!now || !baseCarried) return { compared: false, registered: [], regression: [] }
  return {
    compared: true,
    // 基线没有 gap 键集时只能报"本轮全部 gap",不假装都是新增。
    registered: baseGap ? now.filter((k) => !baseGap.includes(k)) : now,
    regression: now.filter((k) => baseCarried.includes(k)),
  }
}

/**
 * 最近一次判定的结论(只为自检的坏例归因而存在,不参与任何判定)。
 * 立因:2026-11-05 现读这台尺的 --self-test 坏了 19/24,而 ✗ 行只有名字 ——
 * 「整轮未判定」「该维没触发」「夹具与出口不同形」三种成因在屏幕上长得一模一样,
 * 于是坏了几天没人能一眼定位(§0.9:判据失效的表现永远是安静)。
 */
let lastObserved = null

function judge(arg) {
  const r = judgeImpl(arg)
  lastObserved = r
  return r
}

function judgeImpl({
  coverage,
  webParity,
  fidelity,
  conversion,
  doc,
  prev,
  verdictRows = null,
  styleTiers,
  miniappTiers,
}) {
  const cur = {
    mirrored: coverage?.json?.stats?.mirroredShared ?? null,
    registryEntries: coverage?.json?.stats?.registryEntries ?? null,
    coverageRed: coverage?.json?.red?.length ?? null,
    mapRot: webParity?.json?.rot?.length ?? null,
    aligned: webParity?.json?.aligned ?? null,
    unmapped: webParity?.json?.unmapped ?? null,
    sharedTotal: coverage?.json?.stats?.sharedTotal ?? null,
    // 还原度维(2026-10-27 接):镜像页**真还原**了多少,而不是"声明"了多少。
    // 立因:此前这条链只有 CI 与人工跑的两把尺,守护轮的"倒退⇒到人"完全不认识它 ⇒
    // 承载页被改回手写、文案被删、壳承载断链,都没人自动知道。
    fidelityHosted: fidelity?.json?.hosted ?? null,
    fidelityHand: fidelity?.json?.hand ?? null,
    fidelityMissing: fidelity?.json?.totalMissing ?? null,
    fidelityBroken: fidelity?.json?.broken ?? null,
    fidelityOther: fidelity?.json?.other ?? null,
    // 端词包命名空间维(2026-10-29 立):尺子报 packUndetermined 时这里是 null ⇒ 整轮按未判定走,
    // 绝不把"词包没读到"折成"零缺口"。
    fidelityPackAbsent:
      fidelity?.json?.packUndetermined === true ? null : (fidelity?.json?.packAbsentRows ?? null),
    /**
     * 样式档位四维(2026-11-03 接)。**只在调用方把该器交进来时建这几键**:
     * `cur` 上面有一段"任何 null 键 ⇒ 记进 missing ⇒ 整轮未判定"的通用扫描,
     * 若把这几键无条件塞进去,所有不传 styleTiers 的夹具(以及旧形态调用方)都会当场翻成
     * 未判定 —— 实测自检从 24/24 掉到 19/24,坏的正是 web/conversion 那几例(与本维无关)。
     * 传了而读不到 ⇒ 记 null(该维本轮没判,不冒红也不记 0,§0.3)。
     */
    ...(styleTiers === undefined
      ? {}
      : {
          tierRnMissingN: finiteOrNull(styleTiers?.json?.rn?.missingN),
          // forkN 总量与「已登记」栏只做读数展示(不进 GATE_DIRECTIONS ⇒ 不判红)。
          tierRnForkN: finiteOrNull(styleTiers?.json?.rn?.forkN),
          tierRnForkNAllowed: finiteOrNull(styleTiers?.json?.rn?.forkNAllowed),
          // 判据只认未登记那栏。
          tierRnForkNUnregistered: finiteOrNull(styleTiers?.json?.rn?.forkNUnregistered),
          tierWebOffN: (() => {
            const w = styleTiers?.json?.web
            if (!w) return null
            const a = finiteOrNull(w.missingN)
            const b = finiteOrNull(w.forkN)
            if (a === null && b === null) return null
            return (a ?? 0) + (b ?? 0)
          })(),
          tierPending: finiteOrNull(styleTiers?.json?.forkAllowance?.pending),
        }),
    /**
     * 小程序档位两维(同一条纪律:未交该器就不建键,建了读不到才记 null)。
     * defaulted = 用 Tailwind 默认档而非项目档表的位置数;literal = 裸字面量(含 rpx/任意值)位置数。
     * 这两桶每加一枚,小程序与 RN/web 的同源关系就多一处"改源头不跟随",所以只比轮间变坏。
     */
    ...(miniappTiers === undefined
      ? {}
      : {
          mpTierDefaulted: finiteOrNull(miniappTiers?.json?.defaulted),
          mpTierLiteral: finiteOrNull(miniappTiers?.json?.literal),
        }),
    // 键级撤除台账三维(2026-10-30 立):免掉多少 / 台账里有多少行不成立 / 有多少行已不免除任何东西。
    // 立因:还原度尺判"键在不在页面正文里",判不出可达性 ⇒ 「按后端出处撤掉死分支假绿键」这个正确
    // 动作会把 missing 从 0 顶成 N,而本尺的 mirror-missing-increase 维只会喊"补回文案"——
    // 照做等于把死分支补回去(f526a1a143 撤 6 枚键即此型)。撤除必须被台账记下来并带到期日,
    // 而台账本身坏了/腐烂了也得出声,否则这条免检通道就成了一句空话(§0.7 豁免验过才免且会到期)。
    fidelityRetracted: fidelity?.json?.totalRetracted ?? null,
    fidelityRetractionTotal: fidelity?.json?.retractionTotal ?? null,
    fidelityRetractionInvalid:
      Array.isArray(fidelity?.json?.retractionRefused) &&
      Array.isArray(fidelity?.json?.retractionBad)
        ? fidelity.json.retractionRefused.length + fidelity.json.retractionBad.length
        : null,
    fidelityRetractionRot: Array.isArray(fidelity?.json?.retractionRot)
      ? fidelity.json.retractionRot.length
      : null,
    // 转换机会维(2026-10-27 接):落地器**只读预演**的结论 —— 有页可自动转壳承载时必须被机器看见。
    // 为什么不直接把 apply 挂守护轮:转换还要同批改 `rn-shell-types` 声明件(门 251 C9 判它),
    // 只落页不落声明件会把那道 blocking 门打红(§12e 恒红门),而那一步需要一个按 HEAD 面重生成的
    // 检出档 —— 现无该形态的器物,所以这一维先"喊得响 + 给全两条命令",不自作主张改 99 枚源文件。
    conversionUpgradable: conversion?.json?.upgradable ?? null,
    conversionRefused: conversion?.json?.refused ?? null,
  }
  // 承载面维 + 段级豁免四维(2026-10-30 立):**单独放 extras**,不进 cur。
  // 为什么单独放:cur 的 null 扫描会把"取不到"升级成**整轮未判定**;而这几维取不到时,
  // 该判未判定的只是**本维**(不产出理由、不折成 0),不该把别的维一起拖成未判定(§0.3)。
  // 去重只此一份:承载面(web 键组)计数由尺子算(尺子的 alignedUnique),本文件不自己按 web 键
  // 再去重一次(§0.6 单一真相源)—— 台账行数掉而承载面不掉,那正是"折叠重复行",不是"承载被拆"。
  const extras = {
    alignedUnique: finiteOrNull(webParity?.json?.alignedUnique),
    prefixContradicted: countOrNull(
      webParity?.json?.prefixContradicted,
      webParity?.json?.prefixContradictedUndetermined,
    ),
    staleCountAssertions: countOrNull(webParity?.json?.staleCountAssertions),
    missingExpiry: countOrNull(
      webParity?.json?.missingExpiry,
      webParity?.json?.missingExpiryUndetermined,
    ),
    duplicateWebKeys: finiteOrNull(webParity?.json?.duplicateWebKeys),
    /**
     * web↔RN 功能裁决的两只队列(2026-11-05 接)。
     * 立因:这台尺此前只看 aligned / unmapped ⇒ "配对证据不足,记 pending 放着"这条链变长
     * 完全不在倒退维里 —— 与 T15 点名的"小程序侧有涨跌维而 web→RN 侧没有"是同一种半边瞎。
     * pending 净增 = 又攒下无人判的活;judgedGap 净增 = 判过之后确认 RN 侧真缺这屏。
     */
    pendingWebPair: finiteOrNull(webParity?.json?.pending),
    judgedGapWeb: finiteOrNull(webParity?.json?.judgedGap),
    /**
     * 键级三集合(2026-11-08 立):计数分不清「诚实登记 gap」与「把既有承载拆成 gap」,
     * 差集才分得清。取不到 ⇒ null(该面本轮不判,不折成"没有退化",§0.3)。
     */
    alignedKeys: Array.isArray(webParity?.json?.alignedKeys) ? webParity.json.alignedKeys : null,
    portalKeys: Array.isArray(webParity?.json?.portalKeys) ? webParity.json.portalKeys : null,
    judgedGapKeys: Array.isArray(webParity?.json?.judgedGapKeys)
      ? webParity.json.judgedGapKeys
      : null,
    /** 门户承载行数:与 aligned 一样是"既有承载"的一档,减少同样算承载被拆 */
    portalRows: finiteOrNull(webParity?.json?.portalRows),
    /**
     * 样式档位的「种类数」与到期豁免(2026-11-06 追加):
     * 处数只降一处的改善会被同时新增一种异档值抵消(net 0),只看处数会漏掉"按种扩面"这种恶化;
     * 分叉豁免到期不回红此前只由 style-tiers 自己 exit 1 表达,进提交链后必须单独成维。
     * 只在调用方交入 styleTiers 时才建键(与上面 tier 四维同一条纪律,避免旧夹具翻未判定)。
     */
    ...(styleTiers === undefined
      ? {}
      : {
          tierRnMissingKinds: finiteOrNull(styleTiers?.json?.rn?.missingTier),
          // 同 forkN:种类总量与「已登记」栏只做读数展示,判据只认未登记栏。
          tierRnForkKinds: finiteOrNull(styleTiers?.json?.rn?.fork),
          tierRnForkKindsAllowed: finiteOrNull(styleTiers?.json?.rn?.forkKindsAllowed),
          tierRnForkKindsUnregistered: finiteOrNull(styleTiers?.json?.rn?.forkKindsUnregistered),
          tierWebOffKinds: (() => {
            const w = styleTiers?.json?.web
            if (!w) return null
            const a = finiteOrNull(w.missingTier)
            const b = finiteOrNull(w.fork)
            if (a === null && b === null) return null
            return (a ?? 0) + (b ?? 0)
          })(),
          tierAllowanceExpired: finiteOrNull(styleTiers?.json?.forkAllowance?.expired),
        }),
  }
  const reasons = []
  // 只报数的面(不进 state/reasons/退出码):judgedGap 的**登记动作**走这里,
  // 免得"如实承认缺屏"与"把既有承载拆掉"继续同向判红。
  const advisories = []
  // 派生文档滞后档:点名、可追,但不算倒退(不进 state、不进退出码)。
  const stale = []
  const missing = []
  for (const [k, v] of Object.entries(cur)) if (v === null || v === undefined) missing.push(k)
  if (!coverage.ok) missing.push('coverage')
  if (!webParity.ok) missing.push('webParity')
  if (fidelity && !fidelity.ok) missing.push('fidelity')
  // 转换预演器**发现可转页时退出码就是 1**(preview 语义:有活可干 ⇒ 非零)。
  // 若按 ok=false 处理,这一维会在"最该喊"的那一刻判成未判定 —— 结论只认 stdout 的 JSON,
  // JSON 取不到时上面的 null 扫描已经把 conversionUpgradable 记进 missing(不猜、不冒绿)。
  if (coverage.ok && webParity.ok && (cur.mirrored === null || cur.coverageRed === null)) {
    missing.push('coverage 字段名对不上(汇总行取不到数)')
  }
  if (missing.length > 0)
    return {
      state: 'undetermined',
      cur,
      extras,
      reasons,
      advisories,
      missing,
      why: `取不到输入:${missing.join(',')}(不记绿也不冒红)`,
    }

  if (cur.coverageRed > 0)
    reasons.push({ dim: 'registry-rot', detail: `门 128 判红 ${cur.coverageRed} 处` })
  if (cur.mapRot > 0) reasons.push({ dim: 'map-rot', detail: `web↔RN 登记表腐烂 ${cur.mapRot} 行` })
  // 断链/声明不符:现读存量都是 0 ⇒ 这一维一旦出现就是"新增的产物级缺陷",按绝对值出声不算恒红门。
  // 点名(§5e-1 可整改性准入):这两维的 detail 此前只给"另一把尺子在哪",收信人还得再跑一趟才知道
  // 是哪一屏。fidelity 自己已经算了逐屏 rows,这里只把它现成的 route 抄进正文 —— 取不到就整段不附
  // (§0.3:宁可不点名,不编点名)。到人身份只按 dim 拼(guardian 的 dedupKey),明细抖动不换身份。
  const named = (form) => {
    const rows = fidelity?.json?.rows
    if (!Array.isArray(rows)) return ''
    const hit = rows.filter((r) => r && r.form === form).slice(0, 3)
    if (hit.length === 0) return ''
    return ` ⇒ 点名:${hit.map((r) => `${r.route}${r.why ? `(${String(r.why).slice(0, 60)})` : `(${r.spec})`}`).join(' ｜ ')}`
  }
  if (cur.fidelityBroken > 0)
    reasons.push({
      dim: 'mirror-chain-broken',
      detail: `${cur.fidelityBroken} 对镜像页引了 @rn-shells 而链不成立(壳不在面/壳未消费本屏/取用形态与壳导出对不上 ⇒ 页面渲染不出) ⇒ 出路:node scripts/check-miniapp-mirror-fidelity.mjs 看点名行,再按 repair-cross-end-mirror.mjs 补声明或直接改回同名壳${named('broken')}`,
    })
  if (cur.fidelityOther > 0)
    reasons.push({
      dim: 'mirror-declaration-mismatch',
      detail: `${cur.fidelityOther} 对声明镜像 A 而承载的壳是 B ⇒ 账面"已镜像"而 A 那一屏并没渲染 ⇒ 出路:改标记为真承载的那一屏,或把壳指向声明的那一屏${named('other')}`,
    })
  // 端词包缺整块命名空间(2026-10-29 立):这一型的失效方向最坏 —— 壳承载页由共享源渲染,
  // 还原度尺对 hosted 行"按构造 100%、无键可缺",逐键那把尺又只看页面文本里有没有键(壳页天生没有),
  // 两把尺同时看不见,而用户打开那一屏看到的是**每一句话都取不到词条**。实测存量 16 个命名空间 × 5 语言
  // 是在"还原度 76.5%、断链 0、声明不符 0"一片绿期间撞出来的 ⇒ 现读存量已随本批补齐,按绝对值出声。
  if (cur.fidelityPackAbsent > 0) {
    const rows = fidelity?.json?.rows
    const hitRows = Array.isArray(rows)
      ? rows.filter((r) => Array.isArray(r?.packAbsent) && r.packAbsent.length)
      : []
    // 影响面按承载形态说话(只影响措辞,不影响判据与计数):hosted 屏由共享源渲染,缺命名空间 =
    // 该屏文案全取不到;hand 手写页自有文案仍能渲染,缺的是"未镜像的那块 UI"(键级缺口由
    // mirror-missing 逐键点名),不是整屏白屏。
    const hostedCount = hitRows.filter((r) => r.form === 'hosted').length
    const handCount = hitRows.filter((r) => r.form && r.form !== 'hosted').length
    const impact =
      hostedCount > 0 && handCount > 0
        ? `${hostedCount} 屏 hosted(共享源渲染)⇒ 这些屏全部文案取不到;${handCount} 屏 hand(手写页)⇒ 自有文案仍可渲染,缺的是未镜像的那块 UI(键级缺口由 mirror-missing 逐键点名)`
        : hostedCount > 0
          ? '这些屏 hosted(共享源渲染)⇒ 全部文案取不到'
          : handCount > 0
            ? '这些屏是 hand 手写页 ⇒ 自有文案仍可渲染,缺的是未镜像的那块 UI(键级缺口由 mirror-missing 逐键点名),不是整屏白屏'
            : '承载形态取不到 ⇒ 影响面未判定(勿按整屏白屏理解)'
    const hit = hitRows
      .slice(0, 3)
      .map((r) => `${r.route}(${r.form || '?'}) 缺 ${r.packAbsent.slice(0, 4).join(',')}`)
    reasons.push({
      dim: 'mirror-pack-namespace-missing',
      detail:
        `${cur.fidelityPackAbsent} 屏要的命名空间在本端词包里整块不存在(本端包 ∪ shared 都查无)⇒ ${impact}` +
        ` ⇒ 出路(已由守护 30 分钟一轮自动派发,零人工):node scripts/sync-miniapp-message-keys.mjs --apply` +
        ` —— 它把"计划=0"分三档自报:状态=awaiting-landing(已写盘,缺的是收编那一跳,交 auto-commit-quiet)/` +
        ` undetermined(逐枚点名 ns@lang)/ 基准侧查无(逐字无源可搬 ⇒ 才需要人工定文案,勿代拟译文)` +
        `${hit.length ? ` ⇒ 点名:${hit.join(' ｜ ')}` : ''}`,
    })
  }
  // 撤除台账自身出问题必须出声,否则"有出处的撤除"会退化成一条没人看的免检通道:
  // invalid = 行不成立(缺理由/出处/到期日或已到期)⇒ 那些键照原样算缺口,同时台账该补;
  // rot = 行已不免除任何东西(键补回来了 / 页改了承载形 / 三元组对不上)⇒ §0.7 该删。
  if (cur.fidelityRetractionInvalid > 0)
    reasons.push({
      dim: 'key-retraction-invalid',
      detail:
        `键级撤除台账有 ${cur.fidelityRetractionInvalid} 行不成立(读不出 / 缺 reason|evidence|expires / 出处短于 20 字 / 已到期)` +
        ` ⇒ 这些行**不免除**任何缺口,且当前 missing 已把它们算进去了;出路:补全那几行的出处与到期日,或按 §0.10 撤掉这行` +
        ` ⇒ node scripts/check-miniapp-mirror-fidelity.mjs(❌ 点名行)`,
    })
  if (cur.fidelityRetractionRot > 0)
    reasons.push({
      dim: 'key-retraction-rot',
      detail:
        `键级撤除台账有 ${cur.fidelityRetractionRot} 行现在不免除任何东西(§0.7 清单腐烂:豁免项消失同样算红)` +
        ` ⇒ 要么那一格的裁决早已结清(该删行),要么 (页,屏,键) 三元组被改名而对不上(该改行)` +
        ` ⇒ 出路:node scripts/check-miniapp-mirror-fidelity.mjs(⚠️ 点名行)+ 台账 scripts/data/miniapp-key-retractions.jsonl`,
    })
  // 转换机会:"有页可转"不是倒退,但它是"少养一份端内实现"的窗口,现读到 >0 就出声
  // (身份按维去重 ⇒ 同一批机会不会每 60 分钟刷一封;明细抖动不换身份)。
  if (cur.conversionUpgradable > 0)
    reasons.push({
      dim: 'conversion-available',
      detail:
        `${cur.conversionUpgradable} 枚手写镜像页已可转壳承载(转完这一页就自动跟随共享屏,拒 ${cur.conversionRefused} 枚)⇒ 出路:` +
        '① node scripts/upgrade-miniapp-shell-pages.mjs --apply --cap=5 ② 提交页面后 node scripts/gen-rn-shell-types.mjs --write 再提交声明件' +
        '(两步同批:声明件按 HEAD 面派生,只落页会把门 251 C9 打成红)',
    })

  // 撤下一条「挂错业务对象的假声明」不是丢镜像。只认**上一轮快照之后**写下的 not-applicable 裁决条数
  // (台账取不到 / 时刻解析不出 ⇒ 0,照旧判红 —— 豁免必须"验过才免",§0.7)。
  const lostMirrored = prev && Number.isFinite(prev.mirrored) ? prev.mirrored - cur.mirrored : 0
  const newlyExempted = prev ? notApplicableSince(verdictRows, prev.at) : 0
  if (lostMirrored > 0 && lostMirrored > newlyExempted)
    reasons.push({
      dim: 'mirrored-decrease',
      detail:
        `镜像声明 ${prev.mirrored} → ${cur.mirrored}(净减 ${lostMirrored};同期带证据的新裁决 ${newlyExempted} 条,不足以解释这一减)` +
        '⇒ 查是哪条标记/登记被删(与门 237 R3 同判据);确属撤假声明,就往裁决台账写 not-applicable 并附证据',
    })

  // web→RN 那一侧的同一格(此前只有小程序侧有涨跌维):承载面是"web 有这屏、RN 也有承载"的**一组路由**,
  // 它掉了 = 有人把 RN 承载拆了而账面无声;unmapped 涨了 = 新增 web 页没人判过 RN 侧。
  // 口径改判(2026-10-30):比的是**承载面(去重 web 键)**而不是台账行数 —— 台账把同一 web 键的重复行
  // 折叠掉时行数会掉、承载面不变;照旧比行数会把"归并台账"读成"RN 承载被拆"(假告警,而承载面没变)。
  // 上轮基线没有去重口径(旧快照只有行数)⇒ 本维**未判定**:不产出理由、也不折成"没退"(§0.3);
  // 走 stale 档(可追、点名、不响),下一轮起恢复比较。
  if (prev && !Number.isFinite(prev.alignedUnique) && Number.isFinite(prev.aligned))
    stale.push({
      dim: 'web-aligned-uncompared',
      detail: `上轮基线没有承载面去重口径(旧快照只有台账行数 ${prev.aligned})⇒ 本轮不判"RN 承载被拆"这一维(不产假告警),下一轮起恢复比较`,
    })
  if (
    prev &&
    Number.isFinite(prev.alignedUnique) &&
    Number.isFinite(extras.alignedUnique) &&
    extras.alignedUnique < prev.alignedUnique
  )
    reasons.push({
      dim: 'web-aligned-decrease',
      detail: `web→RN 承载面 ${prev.alignedUnique} → ${extras.alignedUnique}(去重 web 键,净减 ${prev.alignedUnique - extras.alignedUnique})⇒ 出路:node scripts/check-web-rn-screen-parity.mjs 看是哪条路由的承载体没了,再按 scripts/data/web-rn-screen-map.jsonl 恢复 aligned 指向`,
    })
  // 段级豁免四维(2026-10-30 立):门户互斥 / 自述计数腐烂 / 豁免到期 / 同键双行。
  // 立因:这四维是尺子本轮新增的「段级豁免三维」,**此前零告警面**(§0.9「造好没装车」= 没有)——
  // 门户表新长一条 admin/* 路由、或某枚段级豁免过了 reviewBy,尺子会点名但没人喊,盲绿以同形态回来。
  // 口径与段级一致:只喊**净增**(存量只报数、净增才到人,§12e);取不到 ⇒ 该维本轮未判定,不冒红也不记 0。
  for (const [key, dim, label, exit] of [
    [
      'prefixContradicted',
      'web-prefix-contradicted-increase',
      '门户表说 WebView 承载、段级豁免却写成"不承载"的路由',
      'node scripts/check-web-rn-screen-parity.mjs 看「段级互斥」那一段,给这些路由逐条补 status:"portal" 行(台账承认承载),或改段级豁免的措辞 —— 机器只点名,豁免措辞由人裁',
    ],
    [
      'staleCountAssertions',
      'web-stale-count-increase',
      '豁免 reason 自述计数与现读脱节',
      'node scripts/check-web-rn-screen-parity.mjs 看「自述计数 ≠ 现读」那一段,把 reason 里的数字按现读改(不要改口径去迁就文本)',
    ],
    [
      'missingExpiry',
      'web-expiry-missing-increase',
      '段级豁免缺存活期或已到期',
      'node scripts/check-web-rn-screen-parity.mjs 看「段级豁免存活期」那一段,缺期的补 reviewBy、已到期的重新判一次(§0.7 豁免必须会到期)',
    ],
    [
      'duplicateWebKeys',
      'web-duplicate-key-increase',
      '同一 web 键多行(aligned/portal 两个分母同时灌水)',
      'node scripts/check-web-rn-screen-parity.mjs 看「重复 web 键」那一段,按「更具体的判定赢」折成一行',
    ],
    [
      'pendingWebPair',
      'web-pending-increase',
      'web↔RN 配对里「证据不足、无人判成」的队列变长(每一枚都是"两端是否同一功能"没结论)',
      '逐枚读两端取数端点与渲染方,判 aligned/excluded/gap 后走具名出口:node scripts/apply-cross-end-verdicts.mjs --proposals=<裁决件> --apply(本尺不认手改台账;按名推断的弱证据只能开队列,不得猜成 aligned)',
    ],
  ]) {
    const a = finiteOrNull(prev?.[key])
    const b = finiteOrNull(extras[key])
    if (a !== null && b !== null && b > a)
      reasons.push({
        dim,
        detail: `${label} ${a} → ${b}(净增 ${b - a})⇒ 出路:${exit}`,
      })
  }
  /**
   * judgedGap 拆两栏(2026-11-08 立):旧判据把 gap 总量当 'up' 判红,于是「如实登记某屏 RN 零承载」
   * 与「把既有承载拆掉」同向翻红,诚实登记被逼成定向刷基线(实测 /sag2)。
   * 现按键级差集分开判:
   *   · 登记面 —— 本轮新增的 gap 键(只进 advisories 报数,不阻断);
   *   · 承载面 —— 本轮 gap 键里,上一轮快照仍记为 aligned/portal 的那些键(承载被拆 ⇒ 阻断)。
   * 计数面「承载变少」另由 web-aligned-decrease / portalRows 减少两维兜底。
   */
  const prevCarriedKeys =
    prev && (Array.isArray(prev.alignedKeys) || Array.isArray(prev.portalKeys))
      ? [...(prev.alignedKeys ?? []), ...(prev.portalKeys ?? [])]
      : null
  const gapFace = judgeJudgedGapFaces({
    nowGapKeys: extras.judgedGapKeys,
    baseGapKeys: prev?.judgedGapKeys ?? null,
    baseCarriedKeys: prevCarriedKeys,
  })
  if (gapFace.regression.length > 0)
    reasons.push({
      dim: 'web-judged-gap-regression',
      detail: `${gapFace.regression.length} 个 web 键在上一轮快照里仍有承载(aligned/portal),本轮却登记成 gap(${gapFace.regression.slice(0, 12).join('、')})⇒ 这是把既有承载拆掉,不是诚实登记 ⇒ 出路:先恢复那条 aligned/portal 行;确属承载撤销,走裁决台账附证据(node scripts/apply-cross-end-verdicts.mjs)`,
    })
  if (gapFace.registered.length > 0)
    advisories.push({
      dim: 'web-judged-gap-registered',
      detail: `新登记 gap ${gapFace.registered.length} 个(只报数,不阻断):${gapFace.registered.slice(0, 12).join('、')} ⇒ 登记是承认缺口的合法通道;承载是否被拆另由 web-aligned-decrease / alignedUnique 判`,
    })
  else if (
    !gapFace.compared &&
    Number.isFinite(prev?.judgedGapWeb) &&
    Number.isFinite(extras.judgedGapWeb) &&
    extras.judgedGapWeb > prev.judgedGapWeb
  )
    advisories.push({
      dim: 'web-judged-gap-registered',
      detail: `判过确认 RN 缺屏 ${prev.judgedGapWeb} → ${extras.judgedGapWeb}(登记面只报数,不阻断;上轮快照没有键级集合,分不清新增登记与承载被拆,承载面仍由 web-aligned-decrease 判)`,
    })
  if (
    prev &&
    Number.isFinite(prev.portalRows) &&
    Number.isFinite(extras.portalRows) &&
    extras.portalRows < prev.portalRows
  )
    reasons.push({
      dim: 'web-portal-carried-decrease',
      detail: `门户承载行 ${prev.portalRows} → ${extras.portalRows}(净减 ${prev.portalRows - extras.portalRows})⇒ 零开发拿功能的 WebView 承载被拆了一条 ⇒ 出路:node scripts/check-web-rn-screen-parity.mjs 看 portal 行,按 packages/shared/src/constants/web-portal.ts 恢复承载,或改判 gap 并附零承载取证`,
    })

  if (
    prev &&
    Number.isFinite(prev.unmapped) &&
    Number.isFinite(cur.unmapped) &&
    cur.unmapped > prev.unmapped
  )
    reasons.push({
      dim: 'web-unmapped-increase',
      detail: `web 路由未判定 ${prev.unmapped} → ${cur.unmapped}(净增 ${cur.unmapped - prev.unmapped})⇒ 新增页面没人判过 RN 侧承载 ⇒ 出路:node scripts/check-web-rn-screen-parity.mjs 按分组清单逐屏登记(aligned / gap / excluded 三态之一,不许留空)`,
    })

  // 还原度两维只在"上一轮真读到过"时比较(没有基线 = 本轮先记快照,不造倒退也不冒绿)
  if (
    prev &&
    Number.isFinite(prev.fidelityHosted) &&
    Number.isFinite(cur.fidelityHosted) &&
    cur.fidelityHosted < prev.fidelityHosted
  )
    reasons.push({
      dim: 'mirror-hosted-decrease',
      detail: `壳承载对数 ${prev.fidelityHosted} → ${cur.fidelityHosted}(净减 ${prev.fidelityHosted - cur.fidelityHosted})⇒ 有页面从"渲染共享源本体"退回头抄,源头再改它不会跟随 ⇒ 出路:node scripts/check-miniapp-mirror-fidelity.mjs 看是哪几页,恢复 @rn-shells 承载`,
    })
  if (
    prev &&
    Number.isFinite(prev.fidelityMissing) &&
    Number.isFinite(cur.fidelityMissing) &&
    cur.fidelityMissing > prev.fidelityMissing
  )
    reasons.push({
      dim: 'mirror-missing-increase',
      detail: `镜像页未还原的业务文案键 ${prev.fidelityMissing} → ${cur.fidelityMissing}(净增 ${cur.fidelityMissing - prev.fidelityMissing})⇒ 用户在小程序端看不到的条目变多 ⇒ 出路:node scripts/check-miniapp-mirror-fidelity.mjs --top=20 按页点名,补回文案或改回壳承载`,
    })

  /**
   * 样式档位净增三维(2026-11-03 接,补的正是"档位尺说了'净增经到人'而无人接"那一格)。
   * 判序与既有各维同形:两侧都必须 finite 才比(旧快照没有这一维时不得把 undefined 折成 0
   * 再喊"净增 N"—— 那条坑本文件头注已记过一次:0 → 28 假净增)。
   * 存量 445 处不作绝对判:升 blocking 的前置是存量归零(§12e),这里只出声"本轮比上轮坏了"。
   */
  const tierWorse = (key, label, exit) => {
    if (!(prev && Number.isFinite(prev[key]) && Number.isFinite(cur[key]))) return
    if (cur[key] <= prev[key]) return
    reasons.push({
      dim: `style-tier-${key}-increase`,
      detail:
        `${label} ${prev[key]} → ${cur[key]}(净增 ${cur[key] - prev[key]} 处)⇒ 同源档位表又多了一批"值在档表里却写成裸数字/异档"的用法,` +
        `落档腿只改等值位置、不会主动动这些,所以它们不会自己消失 ⇒ 出路:${exit}`,
    })
  }
  const webRnExit =
    'node scripts/check-web-rn-style-tiers.mjs --json 看 rnMissingValues / rnForkValues / forkAllowance.pendingTop,再按维度跑 node scripts/land-web-style-tiers.mjs 与 node scripts/land-rn-style-tiers.mjs 预演'
  tierWorse('tierRnMissingN', 'RN 端非档值用量', webRnExit)
  tierWorse('tierRnForkNUnregistered', 'RN↔web 取异档且未登记的用量', webRnExit)
  tierWorse('tierWebOffN', 'web 端自身非档/异档用量', webRnExit)
  tierWorse(
    'tierPending',
    '待裁分叉允许差异行数',
    'node scripts/check-web-rn-style-tiers.mjs --json 的 forkAllowance.pendingTop(逐族给 n/allowed),裁决出口 node scripts/apply-cross-end-verdicts.mjs --proposals=<裁决件>(该器当前零调度,需按 §11 派单产裁决)',
  )
  tierWorse(
    'mpTierDefaulted',
    '小程序端用 Tailwind 默认档而非项目档表的位置数',
    'node scripts/check-miniapp-style-tiers.mjs --json(defaulted/literal/projectPct)+ node scripts/land-miniapp-style-tiers.mjs 预演',
  )
  tierWorse(
    'mpTierLiteral',
    '小程序端裸字面量(含 rpx/任意值)位置数',
    'node scripts/check-miniapp-style-tiers.mjs --json 的 samples + node scripts/land-miniapp-style-tiers.mjs 预演(hittable 是其中可自动改的子集)',
  )

  const docCur = docNumbers(doc)
  const docMismatch =
    docCur.mirrored !== null && cur.mirrored !== null ? docCur.mirrored !== cur.mirrored : null
  if (docMismatch)
    // 账本是**纯派生文档**:它滞后不代表三端对齐变坏(对齐本身由上面各维量)。混进 reasons
    // 的后果是"文档没跟着重生成"被当成倒退寄邮件给机主(§5e-1 可整改性准入:喊人的那一维必须
    // 是能让人动手修的东西)。这里单独出一档 stale —— 照样逐条点名、照样进 json 与人读面,只是不响警报。
    stale.push({
      dim: 'doc-stale',
      detail: `账本文档自述 ${docCur.mirrored},现读 ${cur.mirrored} ⇒ 重跑 node scripts/report-rn-miniapp-gaps.mjs --write ${DOC_PATH}`,
    })

  return {
    state: reasons.length > 0 ? 'regressed' : 'ok',
    stale,
    advisories,
    cur,
    extras,
    prev: prev ?? null,
    reasons,
    doc: docCur,
  }
}

function readPrev() {
  try {
    const o = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return {
      mirrored: o?.cur?.mirrored ?? o?.mirrored ?? null,
      aligned: o?.cur?.aligned ?? null,
      // 承载面与段级豁免四维(2026-10-30 立):存在 extras 面里(不进 cur,免得"取不到"升级成整轮未判定)。
      alignedUnique: o?.extras?.alignedUnique ?? null,
      prefixContradicted: o?.extras?.prefixContradicted ?? null,
      staleCountAssertions: o?.extras?.staleCountAssertions ?? null,
      missingExpiry: o?.extras?.missingExpiry ?? null,
      duplicateWebKeys: o?.extras?.duplicateWebKeys ?? null,
      pendingWebPair: o?.extras?.pendingWebPair ?? null,
      judgedGapWeb: o?.extras?.judgedGapWeb ?? null,
      // 键级集合(2026-11-08 立):旧快照没有这三项 ⇒ null ⇒ 该面本轮"未判定",不折成 0。
      alignedKeys: Array.isArray(o?.extras?.alignedKeys) ? o.extras.alignedKeys : null,
      portalKeys: Array.isArray(o?.extras?.portalKeys) ? o.extras.portalKeys : null,
      judgedGapKeys: Array.isArray(o?.extras?.judgedGapKeys) ? o.extras.judgedGapKeys : null,
      portalRows: o?.extras?.portalRows ?? null,
      unmapped: o?.cur?.unmapped ?? null,
      fidelityHosted: o?.cur?.fidelityHosted ?? null,
      fidelityMissing: o?.cur?.fidelityMissing ?? null,
      at: o?.at ?? null,
    }
  } catch {
    return null
  }
}

/**
 * 读**基线提交点**那一版 web↔RN 台账的键级集合(2026-11-08 立)。
 *
 * 为什么不用基线文件里的数字反推:计数无法区分「新登记 gap」与「把既有承载键改成 gap」。
 * 为什么不去改基线文件:基线数值是回归制的锚,一个字都不动才是纪律;这里只沿
 * `git log -1 -- scripts/data/cross-end-drift-gate-baseline.json` 找到基线落盘的那个提交,
 * 读同一棵树里的台账,按 status 归三堆(不重算判定,§0.6 只做差集)。
 * 取不到(git 不可用 / 浅克隆 / 台账路径变了)⇒ null ⇒ 调用方把该面记为"未判定",
 * 不折成"没有退化"(§0.3)。
 */
function readBaselineLedger() {
  try {
    const opts = { timeout: 60_000, maxBuffer: 1 << 20 }
    const sha = gitRaw(['log', '-1', '--format=%H', '--', GATE_BASELINE_REL], ROOT, opts).trim()
    if (!sha) return null
    const text = gitRaw(['show', `${sha}:${WEB_RN_MAP_REL}`], ROOT, opts)
    const alignedKeys = new Set()
    const portalKeys = new Set()
    const gapKeys = new Set()
    for (const line of String(text).split(/\r?\n/)) {
      const s = line.trim()
      if (!s) continue
      let row
      try {
        row = JSON.parse(s)
      } catch {
        continue
      }
      if (!row || typeof row.web !== 'string' || !row.web) continue
      if (row.status === 'aligned') alignedKeys.add(row.web)
      else if (row.status === 'portal') portalKeys.add(row.web)
      else if (row.status === 'gap') gapKeys.add(row.web)
    }
    return {
      sha,
      alignedKeys: [...alignedKeys],
      portalKeys: [...portalKeys],
      gapKeys: [...gapKeys],
    }
  } catch {
    return null
  }
}

function selfTestMain() {
  const cases = []
  // 用例体在 push 的那一刻已经调过 judge ⇒ 这里把"当时那次判定"折进条目,不改 27 处调用点。
  const pushRaw = cases.push.bind(cases)
  cases.push = (c) => pushRaw({ ...c, observed: lastObserved })
  const mk = (
    mirrored,
    reds,
    rot,
    aligned = 150,
    unmapped = 270,
    pending = 0,
    judgedGap = 0,
    // 键级集合:登记面/承载面分栏靠它;不传 ⇒ 旧快照形态(只报数,不分栏)。
    keys = null,
  ) => ({
    ok: true,
    json: {
      stats: { mirroredShared: mirrored, registryEntries: 90, sharedTotal: 218 },
      red: new Array(reds).fill({ rule: 'R1' }),
      rot: new Array(rot).fill({ line: 1, why: 'x' }),
      aligned,
      // 尺子出口本就同发去重后的承载面计数(2026-10-30 那格把 web 承载维挪进 extras 时,
      // 夹具没跟上 ⇒ 该维在自检里结构上永不触发,坏例看着像"判过了"其实没判)。
      alignedUnique: aligned,
      unmapped,
      // web↔RN 功能面两只队列(2026-11-05 接维):尺子发的是数字,不是数组 ⇒ 夹具同形给数字。
      pending,
      judgedGap,
      ...(keys || {}),
    },
  })
  /** 还原度尺的结论夹具(字段名与 check-miniapp-mirror-fidelity --json 逐字同形) */
  const mkFid = ({
    hosted = 114,
    hand = 99,
    missing = 646,
    broken = 0,
    other = 0,
    rows = [],
    packAbsentRows = 0,
    packUndetermined = false,
    // 撤除台账四维(2026-10-30 立尺时漏补夹具 ⇒ cur 的 null 扫描把整轮拖成未判定,自检 24→19/24,
    // 且 19 例✗ 一行理由都不出。夹具必须与尺子出口同形:尺子恒发这四键,夹具不给就是假输入。)
    totalRetracted = 0,
    retractionTotal = 0,
    retractionRefused = [],
    retractionBad = [],
    retractionRot = [],
    omitRetractionDims = false,
  } = {}) => ({
    ok: true,
    json: {
      hosted,
      hand,
      totalMissing: missing,
      broken,
      other,
      rows,
      packAbsentRows,
      packUndetermined,
      ...(omitRetractionDims
        ? {}
        : { totalRetracted, retractionTotal, retractionRefused, retractionBad, retractionRot }),
    },
  })
  /** 转换机会预演夹具(与 upgrade-miniapp-shell-pages 的机读档同形;默认"没机会"= 现读真实状态) */
  const mkConv = ({ upgradable = 0, refused = 12 } = {}) => ({
    ok: true,
    json: { upgradable, refused },
  })
  cases.push({
    name: 'T1 持平无腐烂 ⇒ ok',
    pass:
      judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '- 已被小程序显式镜像: **91**',
        prev: { mirrored: 91 },
      }).state === 'ok',
  })
  cases.push({
    name: 'T2 镜像净减 ⇒ regressed/mirrored-decrease',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(89, 0, 0),
        webParity: mk(89, 0, 0),
        doc: '',
        prev: { mirrored: 91 },
      })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'mirrored-decrease')
    })(),
  })
  cases.push({
    name: 'T3 门判红 ⇒ regressed/registry-rot(涨了也照样报红)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(120, 3, 0),
        webParity: mk(120, 0, 0),
        doc: '',
        prev: { mirrored: 91 },
      })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'registry-rot')
    })(),
  })
  cases.push({
    name: 'T4 文档数字与现读不等 ⇒ doc-stale 单列滞后档(带重跑命令,但不算倒退)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '- 已被小程序显式镜像: **79**',
        prev: { mirrored: 91 },
      })
      return (
        j.state === 'ok' &&
        j.stale.some((r) => r.dim === 'doc-stale' && /report-rn-miniapp-gaps/.test(r.detail)) &&
        !j.reasons.some((r) => r.dim === 'doc-stale')
      )
    })(),
  })
  cases.push({
    name: 'T5 子对账器跑不动 ⇒ undetermined,不记绿',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: { ok: false, why: 'x' },
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.state === 'undetermined' && j.missing.includes('coverage')
    })(),
  })
  cases.push({
    name: 'T6 无上一轮快照 ⇒ 不比涨跌,只判当场腐烂(拿 prev 缺失当"没倒退"是错的)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.state === 'ok' && j.prev === null
    })(),
  })
  cases.push({
    name: 'T7 承载对数净减 ⇒ mirror-hosted-decrease(有人把页改回头抄)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ hosted: 110 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91, fidelityHosted: 114, fidelityMissing: 646 },
      })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'mirror-hosted-decrease')
    })(),
  })
  cases.push({
    name: 'T8 未还原文案键净增 ⇒ mirror-missing-increase',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ missing: 700 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91, fidelityHosted: 114, fidelityMissing: 646 },
      })
      return j.reasons.some(
        (r) =>
          r.dim === 'mirror-missing-increase' && /check-miniapp-mirror-fidelity/.test(r.detail),
      )
    })(),
  })
  cases.push({
    name: 'T9 壳承载断链 ⇒ 无需 prev 也出声(产物级缺陷,现读存量为 0 不是恒红门)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ broken: 2 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.reasons.some((r) => r.dim === 'mirror-chain-broken')
    })(),
  })
  cases.push({
    name: 'T10 声明镜像 A 而承载是 B ⇒ mirror-declaration-mismatch',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ other: 1 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.reasons.some((r) => r.dim === 'mirror-declaration-mismatch')
    })(),
  })
  cases.push({
    name: 'T18 产物级缺陷正文自带 route 点名(§5e-1:不能让人再跑一趟尺子才知道是哪屏)',
    pass: (() => {
      const rows = [
        {
          form: 'other',
          route: 'pages/member/integral',
          spec: 'vip/VipScreen.tsx',
          why: '声明 VipScreen 而承载 PointHistoryScreen',
        },
        {
          form: 'broken',
          route: 'pkg-user/x/index',
          spec: 'aigc/AigcScreen.tsx',
          why: '壳在本面不存在',
        },
      ]
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ other: 1, broken: 1, rows }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      const pick = (dim) => j.reasons.find((r) => r.dim === dim)?.detail ?? ''
      return (
        pick('mirror-declaration-mismatch').includes('pages/member/integral') &&
        pick('mirror-chain-broken').includes('pkg-user/x/index')
      )
    })(),
  })
  cases.push({
    name: 'T19 取不到逐屏 rows ⇒ 正文不附点名(宁缺毋造,§0.3)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ other: 1 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      const d = j.reasons.find((r) => r.dim === 'mirror-declaration-mismatch')?.detail ?? ''
      return d.length > 0 && !d.includes('点名:')
    })(),
  })
  cases.push({
    name: 'T21 镜像数减少且同期有带证据的新裁决 ⇒ 不判倒退(撤假声明是纠正)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(87, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91, at: '2026-10-29T21:02:31.548Z' },
        verdictRows: ['w', 'x', 'y', 'z'].map((s) => ({
          shared: `packages/app/src/features/${s}/X${s}Screen.tsx`,
          verdict: 'not-applicable',
          at: '2026-10-30',
        })),
      })
      return !j.reasons.some((r) => r.dim === 'mirrored-decrease')
    })(),
  })
  cases.push({
    name: 'T22 反向对照:同样减少但台账取不到 / 裁决写在基线之前 ⇒ 照旧判红(没读到不等于豁免)',
    pass: (() => {
      const base = {
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(87, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91, at: '2026-10-29T21:02:31.548Z' },
      }
      const noLedger = judge({ ...base, verdictRows: null })
      const staleVerdict = judge({
        ...base,
        verdictRows: [{ shared: 'a/X.tsx', verdict: 'not-applicable', at: '2026-10-28' }],
      })
      const badAt = judge({
        ...base,
        verdictRows: [{ shared: 'a/X.tsx', verdict: 'not-applicable', at: '不是时刻' }],
      })
      const hit = (j) => j.reasons.some((r) => r.dim === 'mirrored-decrease')
      return (
        hit(noLedger) &&
        hit(staleVerdict) &&
        hit(badAt) &&
        notApplicableSince(null, '2026-10-29') === 0
      )
    })(),
  })
  cases.push({
    name: 'T23 账本滞后只出 stale 档 ⇒ state 不因此变红;混有实质倒退时仍 regressed 且 stale 照样点名',
    pass: (() => {
      const doc = '- 已被小程序显式镜像: **256**'
      const onlyStale = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc,
        prev: null,
      })
      const withRot = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 1, 0),
        webParity: mk(91, 0, 0),
        doc,
        prev: null,
      })
      return (
        onlyStale.state === 'ok' &&
        (onlyStale.stale || []).some((r) => r.dim === 'doc-stale') &&
        !(onlyStale.reasons || []).some((r) => r.dim === 'doc-stale') &&
        withRot.state === 'regressed' &&
        (withRot.stale || []).some((r) => r.dim === 'doc-stale')
      )
    })(),
  })
  cases.push({
    name: 'T20 端词包缺整块命名空间 ⇒ 出声且带点名(两把尺都看不见这一型,没人喊就是满屏空白)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({
          packAbsentRows: 2,
          rows: [
            { route: 'pkg-user/pdf-tools-hub/index', packAbsent: ['pdfToolsPage'] },
            { route: 'pkg-shop/pay/result/index', packAbsent: ['payResult', 'team'] },
          ],
        }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      const d = j.reasons.find((r) => r.dim === 'mirror-pack-namespace-missing')?.detail ?? ''
      return (
        d.includes('2 屏') &&
        d.includes('pkg-user/pdf-tools-hub/index') &&
        d.includes('pdfToolsPage') &&
        d.includes('勿代拟译文')
      )
    })(),
  })
  cases.push({
    name: 'T21 词包取不到(packUndetermined) ⇒ 整轮未判定,不把"没读到"折成"零缺口"(§0.3)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ packAbsentRows: 0, packUndetermined: true }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return (
        j.state === 'undetermined' &&
        (j.missing || []).includes('fidelityPackAbsent') &&
        !j.reasons.some((r) => r.dim === 'mirror-pack-namespace-missing')
      )
    })(),
  })
  cases.push({
    name: 'T11 还原度尺跑不动 ⇒ undetermined 且点名 fidelity(不记绿)',
    pass: (() => {
      const j = judge({
        fidelity: { ok: false, why: 'x' },
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.state === 'undetermined' && j.missing.includes('fidelity')
    })(),
  })
  cases.push({
    name: 'T12 上一轮没有还原度快照 ⇒ 不拿它造倒退(第一轮的存量不是"变坏")',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ missing: 99999 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91 },
      })
      return !j.reasons.some((r) => r.dim.startsWith('mirror-')) && j.state === 'ok'
    })(),
  })
  cases.push({
    name: 'T13 预演读到手写页可转 ⇒ conversion-available(机会窗要出声,且给齐两步命令)',
    pass: (() => {
      const j = judge({
        conversion: mkConv({ upgradable: 3 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        fidelity: mkFid(),
        doc: '',
        prev: null,
      })
      const r = j.reasons.find((x) => x.dim === 'conversion-available')
      return (
        j.state === 'regressed' &&
        !!r &&
        /upgrade-miniapp-shell-pages/.test(r.detail) &&
        /gen-rn-shell-types/.test(r.detail)
      )
    })(),
  })
  cases.push({
    name: 'T14 转换预演跑不动 ⇒ 不得当成"没机会"(取不到输入就是未判定)',
    pass: (() => {
      const j = judge({
        conversion: { ok: false, why: 'x' },
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        fidelity: mkFid(),
        doc: '',
        prev: null,
      })
      return j.state === 'undetermined' && j.missing.some((m) => m.startsWith('conversion'))
    })(),
  })
  cases.push({
    name: 'T17 预演"发现可转页"时退出码就是 1 —— 结论仍须照判(否则最该喊的那一刻哑掉)',
    pass: (() => {
      const j = judge({
        conversion: { ok: false, why: 'exit 1', json: { upgradable: 5, refused: 2 } },
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        fidelity: mkFid(),
        doc: '',
        prev: null,
      })
      return (
        j.state === 'regressed' &&
        j.reasons.some((r) => r.dim === 'conversion-available' && /5 枚/.test(r.detail))
      )
    })(),
  })
  cases.push({
    name: 'T15 RN 承载被拆 ⇒ web-aligned-decrease(小程序侧有涨跌维而 web→RN 侧没有,是半边瞎)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 150, 270),
        doc: '',
        // 上一轮快照真发的键是去重后的承载面计数(现读 .ihui-agent/state/cross-end-parity-last.json
        // 里就是 alignedUnique)⇒ 夹具按同一形态给,否则这一维在自检里从未被走到。
        prev: { mirrored: 91, aligned: 160, alignedUnique: 160, unmapped: 270 },
      })
      return (
        j.state === 'regressed' &&
        j.reasons.some(
          (r) => r.dim === 'web-aligned-decrease' && /web-rn-screen-map/.test(r.detail),
        )
      )
    })(),
  })
  cases.push({
    name: 'T16 新 web 页无人判过 ⇒ web-unmapped-increase(留空不是"没缺口")',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 275, 291),
        doc: '',
        prev: { mirrored: 91, aligned: 275, unmapped: 270 },
      })
      return j.reasons.some(
        (r) => r.dim === 'web-unmapped-increase' && /aligned \/ gap \/ excluded/.test(r.detail),
      )
    })(),
  })
  cases.push({
    name: 'T25 web↔RN 无人判成的队列变长 ⇒ web-pending-increase(攒活必须出声,出路给具名出口)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 150, 270, 12, 0),
        doc: '',
        prev: { mirrored: 91, alignedUnique: 150, pendingWebPair: 8 },
      })
      return (
        j.state === 'regressed' &&
        j.reasons.some(
          (r) =>
            r.dim === 'web-pending-increase' &&
            /8 → 12/.test(r.detail) &&
            /apply-cross-end-verdicts/.test(r.detail),
        )
      )
    })(),
  })
  cases.push({
    name: 'T26 如实登记新 gap(承载面一枚未减)⇒ 不判红,只进登记面 advisories',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 150, 270, 0, 3, {
          judgedGapKeys: ['old', 'sag2', 'new'],
          alignedKeys: ['settings'],
          portalKeys: ['admin/x'],
        }),
        doc: '',
        prev: {
          mirrored: 91,
          alignedUnique: 150,
          judgedGapWeb: 1,
          judgedGapKeys: ['old'],
          alignedKeys: ['settings'],
          portalKeys: ['admin/x'],
        },
      })
      const note = (j.advisories || []).find((a) => a.dim === 'web-judged-gap-registered')
      return (
        j.state === 'ok' &&
        !j.reasons.some((r) => r.dim === 'web-judged-gap-regression') &&
        !!note &&
        /sag2/.test(note.detail) &&
        /new/.test(note.detail)
      )
    })(),
  })
  cases.push({
    name: 'T26b 既有承载键被登记成 gap ⇒ web-judged-gap-regression(计数未减也要点名拆承载)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 150, 270, 0, 2, {
          judgedGapKeys: ['old', 'settings'],
          alignedKeys: [],
          portalKeys: ['admin/x'],
        }),
        doc: '',
        prev: {
          mirrored: 91,
          alignedUnique: 150,
          judgedGapWeb: 1,
          judgedGapKeys: ['old'],
          alignedKeys: ['settings'],
          portalKeys: ['admin/x'],
        },
      })
      return (
        j.state === 'regressed' &&
        j.reasons.some(
          (r) => r.dim === 'web-judged-gap-regression' && /settings/.test(r.detail),
        )
      )
    })(),
  })
  cases.push({
    name: 'T27 反向对照:上轮没有这两维的基线 ⇒ 本轮首次量到不得判成净增(没有基线≠基线是零)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 150, 270, 12, 5),
        doc: '',
        prev: { mirrored: 91, alignedUnique: 150 },
      })
      return (
        !j.reasons.some((r) => r.dim === 'web-pending-increase') &&
        !j.reasons.some((r) => r.dim === 'web-judged-gap-regression')
      )
    })(),
  })

  // 回归制(2026-11-06):基线判定四例。存量在基线里 ⇒ ok;比基线更坏 ⇒ regressed;
  // 基线没登记的维不判(不拿"基线缺键"当恶化);现读取不到该维 ⇒ undetermined(不折成 0)。
  const gateBase = { dims: { mirrored: 256, mapRot: 2, tierRnMissingN: 134 } }
  const dirs = [
    ['mirrored', 'down', '镜像'],
    ['mapRot', 'up', '腐烂'],
    ['tierRnMissingN', 'up', '非档'],
    ['unmapped', 'up', '未判'],
  ]
  cases.push({
    name: 'G1 与基线持平 ⇒ ok(存量不造恒红)',
    pass: judgeBaseline({ values: { mirrored: 256, mapRot: 2, tierRnMissingN: 134 }, baseline: gateBase, directions: dirs }).state === 'ok',
  })
  cases.push({
    name: 'G2 镜像比基线少 1 ⇒ regressed(丢声明要拦)',
    pass: (() => {
      const j = judgeBaseline({ values: { mirrored: 255, mapRot: 2, tierRnMissingN: 134 }, baseline: gateBase, directions: dirs })
      return j.state === 'regressed' && j.regressions.some((r) => r.dim === 'mirrored' && r.delta === -1)
    })(),
  })
  cases.push({
    name: 'G3 基线未登记的维(legacy)不参与判定',
    pass: judgeBaseline({ values: { mirrored: 256, mapRot: 2, tierRnMissingN: 134, unmapped: 99 }, baseline: gateBase, directions: dirs }).state === 'ok',
  })
  cases.push({
    name: 'G4 现读该维取不到 ⇒ undetermined(没判不能记绿)',
    pass: judgeBaseline({ values: { mirrored: 256, mapRot: 2 }, baseline: gateBase, directions: dirs }).state === 'undetermined',
  })

  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}`)
    // 坏例必须自带实际结论:2026-11-05 实测这台尺的自检坏了 19/24 却连日无人发现,
    // 半因是✗ 行只有名字 —— 判据取不到/整轮未判定/维没触发,三种成因在"✗ 名字"上长得一模一样。
    if (!c.pass)
      console.log(
        `    ↳ 实际 state=${c.observed?.state ?? '(未取到)'}｜ 维=${
          (c.observed?.reasons ?? []).map((r) => r.dim).join(',') || '(无)'
        }｜ 缺输入=${(c.observed?.missing ?? []).join(',') || '(无)'}`,
      )
  }
  console.log(
    bad === 0
      ? `SELF-TEST PASS ${cases.length}/${cases.length}`
      : `SELF-TEST FAIL ${bad}/${cases.length}`,
  )
  process.exit(bad === 0 ? 0 : 1)
}

async function main() {
  // 六把尺都只读 HEAD 面、互不写盘、互不消费对方输出 ⇒ 并发跑;单把失败仍由 runRulerAsync
  // 折成 ok:false,judge 照旧把整门拖成未判定/判红,不因并发吞掉任何一把的异常。
  /**
   * 样式档位维(2026-11-03 接):`check-web-rn-style-tiers.mjs` 自己的头注写着
   * 「本尺只读,不进提交链;净增经 §5e 到人」—— 而这句话在本轮之前**没有兑现方**:
   * 本哨兵只跑 coverage / screen-parity / fidelity 三把尺,没有一把认识 rn_missing / rn_fork /
   * web_off / pending 这四个读数。后果是"新增 100 处非档字面量"在提交链、驾驶舱、告警三处
   * 全都不出声(§0.9「造好没装车 = 没有」的同一条,§12f「判据失效的表现永远是安静」)。
   * 档位差是**存量 445 处**的现实:绝对值一进来就恒红(§12e),所以这里只比"本轮有没有变坏"。
   *
   * 小程序档位维(同日接):`check-miniapp-style-tiers.mjs` 此前**只出现在驾驶舱的只读档**
   * (parity-auto:258),既不在 runner 也无任何轮间比较 ⇒ 小程序偏离共享档位源
   * (defaulted / literal 两桶)同样静默增长。它自己已经把可比读数交出来
   * (defaulted / literal / projectPct / spaceLiteralHittable),这里只包成涨跌维(§0.6 零复算)。
   */
  const rulerJobs = [
    runRulerAsync('check-cross-end-screen-coverage.mjs'),
    runRulerAsync('check-web-rn-screen-parity.mjs', ['--json', '--full']),
    runRulerAsync('check-miniapp-mirror-fidelity.mjs'),
    // 转换机会只跑**预演**(不带 --apply):器物自己说"落地还要同批改声明件",那一形态未装车,
    // 所以这里只把机会喊出来并给全两条命令,不自作主张改端内源文件。
    runRulerAsync('upgrade-miniapp-shell-pages.mjs'),
    runRulerAsync('check-web-rn-style-tiers.mjs'),
    runRulerAsync('check-miniapp-style-tiers.mjs'),
  ]
  // 文档同取 HEAD 面,与六把尺无数据依赖 ⇒ 同批派生,不再串行等一轮。
  const docJob = new Promise((resolve) => {
    try {
      execFile(
        'git',
        ['show', `HEAD:${DOC_PATH}`],
        {
          cwd: ROOT,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 60000,
          maxBuffer: 1 << 22,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
        (e, stdout) => resolve(e ? '' : String(stdout ?? '')),
      )
    } catch {
      resolve('')
    }
  })
  const [coverage, webParity, fidelity, conversion, styleTiers, miniappTiers] = await Promise.all(rulerJobs)
  const doc = await docJob
  const prev = readPrev()
  // 裁决台账取 HEAD 面(与其余各尺同面同轮,§0.4);取不到 ⇒ null ⇒ 豁免数记 0,不折成"全是新裁决"。
  let verdictRows = null
  try {
    const read = readVerdicts('head', ROOT)
    verdictRows = Array.isArray(read?.rows) ? read.rows : null
  } catch {
    verdictRows = null
  }
  const result = judge({
    coverage,
    webParity,
    fidelity,
    conversion,
    doc,
    prev,
    verdictRows,
    styleTiers,
    miniappTiers,
  })
  result.at = new Date().toISOString()
  if (recordMode) {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(result, null, 2) + '\n', 'utf8')
    result.recorded = true
  }
  /**
   * 回归制(2026-11-06):--gate 不看"绝对存量"(现读 mapRot=2 / 撤除台账腐烂=3 是既有存量),
   * 只比仓内基线。基线读不到 ⇒ undetermined(exit 2),绝不折成"没有恶化"。
   * pushMode 只影响人读措辞与 runner 侧登记档位;本脚本的退出码语义在两面一致:
   * 0=未恶化 / 1=相对基线恶化 / 2=未判定。
   */
  if (gateMode) {
    const read = readBaseline(GATE_BASELINE_PATH)
    const values = { ...(result.cur ?? {}), ...(result.extras ?? {}) }
    const judged = read.ok
      ? judgeBaseline({ values, baseline: read.baseline, directions: GATE_DIRECTIONS })
      : { state: 'undetermined', regressions: [], missing: [], why: read.why }
    result.gate = {
      ...judged,
      face: pushMode ? 'push' : 'commit-advisory',
      baseline: read.ok ? GATE_BASELINE_PATH.replace(/\\/g, '/').replace(`${ROOT.replace(/\\/g, '/')}/`, '') : null,
      docStale: result.stale ?? [],
      values,
      advisories: [],
    }
    /**
     * judgedGap 的两栏在 --gate 面同样要分开(2026-11-08):
     * 基线里的 judgedGapWeb 是**登记动作**的读数,不再进 GATE_DIRECTIONS —— 诚实登记
     * (新增 gap 键,承载面一枚未减)不得判红;真正该红的是「既有承载键被登记成 gap」。
     * 键级参照取基线提交点那版台账(见 readBaselineLedger),基线数值一字未改。
     */
    if (read.ok && result.gate.state !== 'undetermined') {
      const ledger = readBaselineLedger()
      const gapFace = judgeJudgedGapFaces({
        nowGapKeys: result.extras?.judgedGapKeys,
        baseGapKeys: ledger?.gapKeys ?? null,
        baseCarriedKeys: ledger ? [...ledger.alignedKeys, ...ledger.portalKeys] : null,
      })
      const gapBase = finiteOrNull(read.baseline?.dims?.judgedGapWeb)
      const gapNow = finiteOrNull(values.judgedGapWeb)
      if (gapBase !== null && gapNow !== null && gapNow !== gapBase)
        result.gate.advisories.push({
          dim: 'judgedGapWebRegistered',
          detail: `判过确认 RN 缺屏 ${gapBase} → ${gapNow}(登记面只报数,不阻断;承载面由 alignedUnique/aligned 与 judgedGapWebRegression 判)`,
        })
      if (gapFace.compared) {
        if (gapFace.registered.length > 0)
          result.gate.advisories.push({
            dim: 'judgedGapWebRegistered',
            detail: `新登记 gap 键 ${gapFace.registered.length} 个(只报数,不阻断):${gapFace.registered.slice(0, 12).join('、')}`,
          })
        if (gapFace.regression.length > 0) {
          result.gate.regressions.push({
            dim: 'judgedGapWebRegression',
            label: '既有承载键被登记成 gap',
            direction: 'up',
            baseline: 0,
            current: gapFace.regression.length,
            delta: gapFace.regression.length,
            keys: gapFace.regression.slice(0, 12),
          })
          result.gate.state = 'regressed'
        }
      } else {
        result.gate.uncompared =
          '取不到基线提交点的台账键集 ⇒「既有承载键被登记成 gap」这一面本轮未判(不冒红也不记绿)'
      }
      result.gate.ledgerRef = ledger?.sha ?? null
    }
  }
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(gateMode ? `存量读数 STATE=${result.state}(仅报数,退出码以 GATE 为准)` : `STATE=${result.state}`)
    console.log(
      `现读:镜像 ${result.cur?.mirrored ?? '?'} / 登记 ${result.cur?.registryEntries ?? '?'} / web aligned ${result.cur?.aligned ?? '?'}(台账行) / 承载面(去重 web 键) ${result.extras?.alignedUnique ?? '未判定'} / unmapped ${result.cur?.unmapped ?? '?'} / 段级互斥 ${result.extras?.prefixContradicted ?? '未判定'} / 自述计数腐 ${result.extras?.staleCountAssertions ?? '未判定'} / 豁免缺期 ${result.extras?.missingExpiry ?? '未判定'} / 同键双行 ${result.extras?.duplicateWebKeys ?? '未判定'} / 还原度: 承载 ${result.cur?.fidelityHosted ?? '?'} 手写 ${result.cur?.fidelityHand ?? '?'} 未还原键 ${result.cur?.fidelityMissing ?? '?'} 断链 ${result.cur?.fidelityBroken ?? '?'} 声明不符 ${result.cur?.fidelityOther ?? '?'} 本端词包缺命名空间 ${result.cur?.fidelityPackAbsent ?? '未判定'}`,
    )
    if (result.why) console.log(`未判定原因:${result.why}`)
    for (const r of result.reasons || []) console.log(gateMode ? `· [存量] ${r.dim} —— ${r.detail}` : `· ${r.dim} —— ${r.detail}`)
    for (const r of result.stale || [])
      console.log(`(派生文档滞后,不算倒退不喊人) ${r.dim} —— ${r.detail}`)
    for (const r of result.advisories || [])
      console.log(`(登记面,只报数不阻断) ${r.dim} —— ${r.detail}`)
    if (result.gate) {
      console.log(
        `GATE(${result.gate.face} · 基线 ${result.gate.baseline ?? '缺失'}) STATE=${result.gate.state} —— ${describeRegressions(result.gate)}`,
      )
      for (const r of result.gate.regressions || [])
        console.log(`  ✗ ${r.dim}(${r.label}) 基线 ${r.baseline} → 现读 ${r.current}`)
      for (const r of result.gate.advisories || [])
        console.log(`  · [只报数] ${r.dim} —— ${r.detail}`)
      if (result.gate.uncompared) console.log(`  ⚠ ${result.gate.uncompared}`)
      if (result.gate.state === 'undetermined') console.log(`  ⚠ ${result.gate.why}`)
    }
  }
  process.exit(
    gateMode
      ? result.gate.state === 'regressed'
        ? 1
        : result.gate.state === 'undetermined'
          ? 2
          : 0
      : result.state === 'regressed'
        ? 1
        : result.state === 'undetermined'
          ? 2
          : 0,
  )
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (selfTest) selfTestMain()
  else main()
}

export const __test__ = {
  judge,
  notApplicableSince,
  docNumbers,
  DOC_PATH,
  runRulerAsync,
  judgeBaseline,
  judgeJudgedGapFaces,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
