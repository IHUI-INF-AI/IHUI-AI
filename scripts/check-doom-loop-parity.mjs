// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// Doom-loop parity 对账(V3 #54,2026-09-28 立)
//
// 钉的是本仓反复出事的同一型:一份算法被复制到两种语言后各自漂移。
// TS 唯一算法源 = packages/shared/src/agent/doom-loop-detector.ts;
// Python 等价实现 = apps/ai-service/app/core/doom_loop.py(ai-service 主链路
// agent_loop_v2.py 消费)。两侧必须逐项等值:
//   P1 阈值/窗口/冷却/签名截断长度/摘要算法名/状态清单/换策略动作清单
//   P2 装车性:CLI 必须经共享层取判据(薄适配器 + 桥在位);agent.ts 不得
//      再本地抄死循环阈值数字;agent_loop_v2.py 必须真的调用哨兵(摘线即红)
//   P3 动作集合逐项被两条主链路消费(声明了没人执行 = 装饰品,判红)
//
// 三态纪律(口径同守门 70/77/83/98/101/103/118):
//   全量判 **HEAD blob**、--staged 判**索引 blob**、--worktree 仅人工/夹具逃生舱,
//   两面旗同给 ⇒ exit 2;任一被审文件在该面上取不到 ⇒ exit 2「无法判定」
//   (本门立项当枚提交里六文件与接线同笔落地,面缺文件不是"没有违规"而是"还没上车")。
// 判红只针对**结构事实**(等值被打破 / 接线被摘 / 数字被二次抄写),
// 无存量基线 —— 立门实测两侧逐项等值,不存在"与任何提交都无关的恒红面"。
//
// 行内豁免:无(不允许)。P1/P2/P3 都是"两份实现是否同形"的硬事实,豁免即失明。
//
// 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
//    勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_DOOM_LOOP_PARITY,带 stagedTriggers。
//    镜像测试 scripts/tests/check-doom-loop-parity.test.mjs 的 T1 已随接线翻转成"注册后必须成套"。
// —— 本段原写"尚未接进 runner / package.json / CI,注册由主会话单写,skipEnv 预留待写入",
// 那是立项时的实况,已过期;立论(T1 钉住"未注册不得被读成已装车"这个方向)保留。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { maskComments } from './lib/outbound-route-facts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 被审面(全部必须在场;少一份 = 无法判定,不是通过)。 */
export const FILES = {
  tsShared: 'packages/shared/src/agent/doom-loop-detector.ts',
  tsBridge: 'packages/shared/src/utils/doom-loop-detector.ts',
  cliAdapter: 'apps/cli/src/doom-loop-detector.ts',
  cliLoop: 'apps/cli/src/commands/agent.ts',
  pyModule: 'apps/ai-service/app/core/doom_loop.py',
  pyLoop: 'apps/ai-service/app/services/agent_loop_v2.py',
  // D144 P4 的四个额外站点(轮次上限)。它们与六份策略面同等强制:取不到 ⇒ 判
  // "无法判定"而不是"这一档没问题"—— 少读一档就把一档写进了没人看守的格子。
  pyConfig: 'apps/ai-service/app/core/config.py',
  pyRouter: 'apps/ai-service/app/routers/agents.py',
  pyEngine: 'apps/ai-service/app/services/agent_engine.py',
  cliDefaults: 'apps/cli/src/config/defaults.ts',
}

/** 必须逐项等值的标量(数值/字符串)。 */
export const POLICY_NUMBERS = [
  'DOOM_LOOP_WINDOW_SIZE',
  'DOOM_LOOP_REPEAT_THRESHOLD',
  'DOOM_LOOP_COOLDOWN_MS',
  'DOOM_ALERT_ROUNDS_TO_TERMINATE',
  'STUCK_CONSECUTIVE_THRESHOLD',
  'FAILURE_STREAK_STRATEGY_THRESHOLD',
  'ERROR_SIGNATURE_MAX_LEN',
]
// b76-14(2026-09-30):两侧注释互相声称同值的字符串常量必须进本清单 ——
// SERIALIZE_FALLBACK(doom_loop.py:60 注释原文「与 TS SERIALIZE_FALLBACK 同值」)
// 此前只有散文担保(private whitelist 形态),现在进表,由 P1 两侧逐项等值判据看守。
export const POLICY_STRINGS = ['DOOM_LOOP_HASH_ALGORITHM', 'SERIALIZE_FALLBACK']
/** 必须逐项等值(含长度 = "状态数/动作数")的清单。 */
export const POLICY_LISTS = ['DOOM_LOOP_STATES', 'DOOM_LOOP_STRATEGY_ACTIONS']

// ---------------------------------------------------------------------------
// D144 P4:主循环轮次上限 —— 逐档现读 + 差异登记表(带理由与到期日)
// ---------------------------------------------------------------------------

/**
 * 轮次上限的**所有**生效站点。每档一条取值规则,在被审面上现读,不得抄台账。
 * `multi: true` 表示同一文件里该形状出现多次(请求级兜底通常有 2 处),逐值判。
 * 站点枚举到 0 个值 ⇒ 判红(不是"没找到就没问题"):正则跟不上被审代码的新写法,
 * 表现永远是"0 处",而账面读起来像全绿(本仓"扫到 0 先怀疑尺子"记过多次)。
 */
export const ROUND_LIMIT_SITES = [
  {
    id: 'engine-ctor',
    file: 'apps/ai-service/app/services/agent_loop_v2.py',
    pattern: /max_iterations: int = (?:AGENT_MAX_ITERATIONS|(\d+))/,
    expectsConstant: true,
    note: 'AgentLoopV2 构造器默认档(唯一被引擎消费的那一档)',
  },
  {
    id: 'py-config',
    file: 'apps/ai-service/app/core/config.py',
    pattern: /^ {4}max_agent_iterations: int = (\d+)$/m,
    note: 'settings.max_agent_iterations(V1 执行器与 run_stream 读的档)',
  },
  {
    id: 'py-router-fallback',
    file: 'apps/ai-service/app/routers/agents.py',
    pattern: /max_iterations or (\d+)/g,
    multi: true,
    note: 'HTTP 请求级兜底(execute/stream 与 resume 两处)',
  },
  {
    id: 'py-engine-fallback',
    file: 'apps/ai-service/app/services/agent_engine.py',
    pattern: /maxIterations"?\) or (\d+)/g,
    multi: true,
    note: '引擎 JSON-RPC 通路的请求级兜底',
  },
  {
    id: 'cli-default',
    file: 'apps/cli/src/config/defaults.ts',
    pattern: /maxIterations: (\d+)/,
    note: 'CLI(第二个执行体)的默认档',
  },
]

/**
 * 差异登记表 —— 站点值 ≠ `AGENT_MAX_ITERATIONS` 时**必须**在此逐条交代。
 * 每条四件齐备:`site`/`value` 复合键 + `anchor`(登记时的基准档)+ `reason`
 * (为什么天然不同)+ `until`(到期日)。
 * `anchor` 是本表能被复核的关键:登记说的从来不是"这个站点是 8",而是
 * "这个站点是 8 **而引擎档是 10**"。基准一变,旧理由就自动作废(判红),
 * 于是"改一侧不跟另一侧"这条路是堵的 —— 没有 anchor 的登记表会在基准漂移后
 * 继续替新现状发合格证。
 * 每条三件齐备:`reason`(为什么天然不同)+ `until`(到期日)+ `site`/`value` 复合键。
 * 两态判据照 `scripts/sync-miniapp-chrome.mjs` 的 `CHROME_DECLARED_DIVERGENCE`:
 *   ① 值仍不同但未到期 ⇒ 只打"已声明差异",不判红;
 *   ② 到期 ⇒ 红(理由不会自己变好);
 *   ③ 站点值已经等于默认档却还挂着登记 ⇒ 红"清单腐烂"(一条过期登记表会替人
 *      做出"这一档还需要特殊解释"的判断,比没有表更糟)。
 * 键不含行号(行号在任何一次 append 后都会挪位,AGENTS §1 复核通过率 0/27 那一课)。
 */
export const MAX_ITERATION_DIVERGENCE = [
  {
    site: 'py-config',
    value: 8,
    anchor: 10,
    reason:
      'V1 执行器(agent_loop.py agent_executor.run / run_stream)与 a2a、slash_commands 两条链路读的就是这一档;' +
      'D144③ 只归一非流式 execute 的出口,其余三处 V1 消费点本轮不动(拍板口径),故 V1 档继续是 8。',
    until: '2026-12-31',
  },
  {
    site: 'py-router-fallback',
    value: 8,
    anchor: 10,
    reason:
      'HTTP 层的 `req.max_iterations or 8` 是"客户端没填时给多少",与引擎构造器默认档分属两层;' +
      '把它抬到 10 会让所有未显式传轮数的 Web/桌面请求的停止点后移,属可感知的行为变更,另计票。',
    until: '2026-12-31',
  },
  {
    site: 'py-engine-fallback',
    value: 8,
    anchor: 10,
    reason:
      '引擎 JSON-RPC 通路的同名兜底,与 py-router-fallback 同一层(HTTP/ wire 入参缺省),' +
      '口径必须与 routers/agents.py 一致,所以同为 8。',
    until: '2026-12-31',
  },
  {
    site: 'cli-default',
    value: 25,
    anchor: 10,
    reason:
      'CLI 是 ai-service 之外的**第二个执行体**(本地工具循环,一轮成本远低于服务端),' +
      '25 是它的交互预算;与服务端引擎档不同值是有意的,不是漂移。',
    until: '2026-12-31',
  },
  {
    site: 'py-engine-fallback',
    value: 6,
    anchor: 10,
    reason:
      'D144 P4 上线首跑在 HEAD 现读到的第三处引擎兜底档(值 6,与同文件两处 8 并存);它为什么是 6 不在 D144 口径内(本票只归一非流式 execute 的出口、不改任何默认值),故按票面第 1 条『差异至少写明白』登记为待裁项,归属 agent_engine 通路持有者,到期前必须改齐或逐条交代。不得读成已核实的设计差异,更不得为让本门变绿去动那个 6。',
    until: '2026-12-31',
  },
]

/** 引擎规范默认档所在文件与常量名(parity 的另一半:P4 的基准值从这里现读)。 */
export const ROUND_LIMIT_ANCHOR = {
  file: 'apps/ai-service/app/core/doom_loop.py',
  name: 'AGENT_MAX_ITERATIONS',
}

// ---------------------------------------------------------------------------
// 两侧策略面解析(输入必须是**剥注释、保留字符串**的掩码面)
// ---------------------------------------------------------------------------

/**
 * TS 侧:`export const NAME = 42` / `= 'sha256'` / `= [...] as const`。
 * 解析不到某键不在此处判红 —— decide 统一按"缺失 ⇒ 红"处理(判据与解析分层)。
 */
export function parseTsPolicy(maskedSrc) {
  /** @type {Record<string, number|string|Array<string>>} */
  const out = {}
  for (const name of POLICY_NUMBERS) {
    const m = new RegExp(`^export const ${name} = (-?\\d+)\\s*;?\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = Number(m[1])
  }
  for (const name of POLICY_STRINGS) {
    // b76-14:`export` 可省(TS 侧 SERIALIZE_FALLBACK 真形是模块内 const,不导出)。
    const m = new RegExp(`^(?:export\\s+)?const\\s+${name}\\s*=\\s*'([^']*)'\\s*;?\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = m[1]
  }
  for (const name of POLICY_LISTS) {
    const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`, 'm').exec(maskedSrc)
    if (m) {
      out[name] = [...m[1].matchAll(/'([^']*)'/g)].map((s) => s[1])
    }
  }
  return out
}

/** Python 侧:`NAME = 42` / `NAME = 'x'` / `NAME = ['a', 'b']`(单行清单)。 */
export function parsePyPolicy(maskedSrc) {
  /** @type {Record<string, number|string|Array<string>>} */
  const out = {}
  for (const name of POLICY_NUMBERS) {
    const m = new RegExp(`^${name} = (-?\\d+)\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = Number(m[1])
  }
  for (const name of POLICY_STRINGS) {
    // b76-14:py 侧模块私有名允许下划线前缀(SERIALIZE_FALLBACK 的真形是 _SERIALIZE_FALLBACK)。
    const m = new RegExp(`^_?${name}\\s*=\\s*'([^']*)'\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = m[1]
  }
  for (const name of POLICY_LISTS) {
    const m = new RegExp(`^${name} = \\[([^\\]]*)\\]\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = [...m[1].matchAll(/'([^']*)'/g)].map((s) => s[1])
  }
  return out
}

// ---------------------------------------------------------------------------
// D144 P4:轮次上限逐档现读 + 差异登记表(纯函数,构造面可证明)
// ---------------------------------------------------------------------------

/**
 * @param {Record<string, string|null>} contents 被审面内容
 * @param {{ledger?: typeof MAX_ITERATION_DIVERGENCE, today?: string}} [opts]
 *   `today` 是**判据输入**而不是内建时钟:自检要能造"到期前 / 到期后"两臂,
 *   否则过期那一支永远不会被跑到(只在真到期那天红一次,没人会看见)。
 * @returns {{problems:string[],notes:string[],values:Record<string,number[]>,anchor:number|null}}
 */
export function decideRoundLimits(contents, opts = {}) {
  const ledger = opts.ledger ?? MAX_ITERATION_DIVERGENCE
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  /** @type {string[]} */
  const problems = []
  /** @type {string[]} */
  const notes = []
  /** @type {Record<string, number[]>} */
  const values = {}

  const anchorSrc = contents[ROUND_LIMIT_ANCHOR.file]
  if (typeof anchorSrc !== 'string' || anchorSrc.length === 0) {
    return {
      problems: [`P4 基准档文件取不到:${ROUND_LIMIT_ANCHOR.file}(未判定,不得记通过)`],
      notes,
      values,
      anchor: null,
    }
  }
  const anchorMask = maskComments(anchorSrc, 'py')
  const am = new RegExp(`^${ROUND_LIMIT_ANCHOR.name} = (-?\\d+)\\s*$`, 'm').exec(anchorMask)
  if (!am) {
    return {
      problems: [
        `P4 基准档取不到:${ROUND_LIMIT_ANCHOR.name} 必须是 ${ROUND_LIMIT_ANCHOR.file} 里的单行字面量` +
          `(登记表本体读不出来 ⇒ P4 整维失明,不得读成"轮次一致")`,
      ],
      notes,
      values,
      anchor: null,
    }
  }
  const anchor = Number(am[1])

  for (const site of ROUND_LIMIT_SITES) {
    const src = contents[site.file]
    if (typeof src !== 'string' || src.length === 0) {
      problems.push(`P4 站点文件取不到:${site.id}(${site.file})`)
      continue
    }
    const masked = maskComments(src, site.file.endsWith('.py') ? 'py' : 'js')
    // 构造器默认档:登记表必须**被消费**,否则 core/doom_loop.py 里那个常量是装饰品
    if (site.expectsConstant) {
      if (/max_iterations: int = AGENT_MAX_ITERATIONS\b/.test(masked)) {
        values[site.id] = [anchor]
        continue
      }
      const lit = /max_iterations: int = (\d+)/.exec(masked)
      values[site.id] = lit ? [Number(lit[1])] : []
      problems.push(
        `P4 引擎构造器默认档未引用登记表:${site.file} 现为 ` +
          `${lit ? `字面量 ${lit[1]}` : '(解析不到)'} ⇒ 应写 \`max_iterations: int = AGENT_MAX_ITERATIONS\`` +
          `(值不变的接线;只加常量不接主链路 = 本门 P2 反复点名那一型)`,
      )
      continue
    }
    const re = new RegExp(site.pattern.source, 'gm')
    const nums = [...masked.matchAll(re)].map((x) => Number(x[1])).filter((n) => Number.isInteger(n))
    if (nums.length === 0) {
      problems.push(
        `P4 站点枚举到 0 个值:${site.id}(${site.file})—— 取值规则跟不上被审代码就是判据失明,` +
          `不得把"看不见"读成"这一档没问题"`,
      )
      continue
    }
    values[site.id] = nums
    for (const v of new Set(nums)) {
      if (v === anchor) continue
      const ent = ledger.find((e) => e.site === site.id && e.value === v)
      if (!ent) {
        problems.push(
          `P4 未登记的轮次差异:${site.id}=${v} vs 引擎档 ${anchor}(${site.file};${site.note})` +
            `—— 出路只有两条:同一枚提交改齐,或在 MAX_ITERATION_DIVERGENCE 交代 reason+until`,
        )
        continue
      }
      if (!ent.reason || !String(ent.reason).trim()) {
        problems.push(`P4 登记条目缺 reason:${site.id}=${v}(裸标记不构成交代,AGENTS §4 豁免同一条禁令)`)
      }
      if (typeof ent.anchor !== 'number') {
        problems.push(
          `P4 登记条目缺 anchor:${site.id}=${v} —— 每条差异都是"相对某个基准档"登记的,` +
            `不写基准值就无法复核这条理由说的是哪一天的差异`,
        )
      } else if (ent.anchor !== anchor) {
        problems.push(
          `P4 登记条目对着旧基准档写的:${site.id}=${v} 登记时引擎档=${ent.anchor},现读 ${anchor}` +
            `(基准变了 ⇒ 差异不再是被解释过的那个;出路=改齐,或重新交代为什么今天仍必须不同值)`,
        )
      }
      if (!ent.until || String(ent.until) < today) {
        problems.push(
          `P4 登记条目已过期或缺到期日:${site.id}=${v} until=${ent.until || '(空)'}(今天 ${today})` +
            `—— 理由不会自己变好:改齐,或重新交代它为什么今天仍必须不同值`,
        )
      }
    }
  }

  // 反向:每条登记都必须还认得出对应站点(登记表腐烂比没有表更糟)
  for (const ent of ledger) {
    const obs = values[ent.site]
    if (!obs) {
      problems.push(`P4 登记表腐烂:条目 ${ent.site}=${ent.value} 的站点本轮没读到值(改名/搬家?)`)
      continue
    }
    if (obs.includes(anchor)) {
      problems.push(
        `P4 登记表腐烂:${ent.site} 现读已取到引擎档 ${anchor},登记必须摘除` +
          `(留着会替后来人做出"这一档仍需特殊解释"的判断)`,
      )
    } else if (!obs.includes(ent.value)) {
      problems.push(`P4 登记表与实值不符:${ent.site} 登记 ${ent.value},现读 ${obs.join('/')}`)
    }
  }

  notes.push(
    `AGENT_MAX_ITERATIONS: py=${anchor} ` +
      Object.entries(values)
        .map(([k, v]) => `${k}=${v.join('/')}`)
        .join(' '),
  )
  const declared = ledger.filter((e) => values[e.site] && values[e.site].includes(e.value) && e.value !== anchor)
  if (declared.length > 0) {
    notes.push(`已声明差异 ${declared.length} 条:${declared.map((e) => `${e.site}=${e.value}(until ${e.until})`).join('、')}`)
  }
  return { problems, notes, values, anchor }
}

// ---------------------------------------------------------------------------
// 判据(纯函数,构造面即可证明;取材在 runAudit)
// ---------------------------------------------------------------------------

/**
 * @param {{[k in keyof typeof FILES]: string|null}} contents 被审面内容(null=取不到)
 * @returns {{problems:string[], notes:string[], undetermined:string[], policy:Record<string, [unknown, unknown]>|null}}
 */
export function decide(contents) {
  const problems = []
  const notes = []
  const undetermined = Object.values(FILES).filter((f) => {
    const v = contents[f]
    return typeof v !== 'string' || v.length === 0
  })
  if (undetermined.length > 0) return { problems, notes, undetermined, policy: null }

  const tsMask = maskComments(contents[FILES.tsShared], 'js')
  const pyMask = maskComments(contents[FILES.pyModule], 'py')
  const bridgeMask = maskComments(contents[FILES.tsBridge], 'js')
  const adapterMask = maskComments(contents[FILES.cliAdapter], 'js')
  const cliLoopMask = maskComments(contents[FILES.cliLoop], 'js')
  const pyLoopMask = maskComments(contents[FILES.pyLoop], 'py')

  // ---- P1 策略面逐项等值 ----
  const tsPolicy = parseTsPolicy(tsMask)
  const pyPolicy = parsePyPolicy(pyMask)
  /** @type {Record<string, [unknown, unknown]>} */
  const policy = {}
  for (const key of [...POLICY_NUMBERS, ...POLICY_STRINGS, ...POLICY_LISTS]) {
    const a = tsPolicy[key]
    const b = pyPolicy[key]
    policy[key] = [a ?? null, b ?? null]
    if (a === undefined || a === null) {
      problems.push(`P1 TS 侧策略键缺失/形态漂移:${key}(应写为 \`export const ${key} = <字面量>\`)`)
      continue
    }
    if (b === undefined || b === null) {
      problems.push(`P1 Python 侧策略键缺失/形态漂移:${key}(应写为 \`${key} = <字面量>\`)`)
      continue
    }
    const same = Array.isArray(a)
      ? Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i])
      : a === b
    if (!same) {
      problems.push(
        `P1 两侧漂开:${key} TS=${JSON.stringify(a)} vs Python=${JSON.stringify(b)}` +
          `(清单还需长度相等 = 状态数/动作数等值;修法是**同枚提交**改齐两侧,不得只改一边)`,
      )
    }
  }

  // ---- P2 装车性 ----
  if (/\bnode:[a-z_]+/.test(adapterMask) === false) {
    // CLI 适配器必须自带真摘要(node:crypto);丢了它 hashInput 无从计算
    problems.push(`P2 CLI 适配器缺 node:crypto 摘要注入:${FILES.cliAdapter}`)
  }
  if (!adapterMask.includes('@ihui/shared/utils/doom-loop-detector')) {
    problems.push(
      `P2 CLI 适配器未从共享层 import(判据第二份回升风险):${FILES.cliAdapter} 必须 import '@ihui/shared/utils/doom-loop-detector'`,
    )
  }
  if (!bridgeMask.includes('../agent/doom-loop-detector')) {
    problems.push(
      `P2 共享层桥断线:${FILES.tsBridge} 必须 \`export * from '../agent/doom-loop-detector.js'\`(唯一算法源所在目录被搬走/摘线)`,
    )
  }
  if (/from\s+['"]node:|require\(\s*['"]node:|createHash\(/.test(tsMask)) {
    problems.push(
      `P2 共享层混入平台依赖:${FILES.tsShared} 禁止 node 内建/摘要实现(§3 跨端工厂:摘要由各端注入)`,
    )
  }
  // agent.ts 不得再抄第二份数字(立门前这些声明存在;删本地声明改 import 是 V3#54 交付本体)
  const bannedCliCopies = [
    [/const\s+SAMPLER_DOOM_LOOP_THRESHOLD\s*=\s*\d+/, 'SAMPLER_DOOM_LOOP_THRESHOLD'],
    [/const\s+FAILURE_REFLECTION_THRESHOLD\s*=\s*\d+/, 'FAILURE_REFLECTION_THRESHOLD'],
    [/consecutiveDoomAlerts\s*>=\s*\d+/, 'consecutiveDoomAlerts >= <数字>'],
  ]
  for (const [re, label] of bannedCliCopies) {
    if (re.test(cliLoopMask)) {
      problems.push(
        `P2 CLI 二次抄写触发条件:${FILES.cliLoop} 仍声明/比较本地数字 "${label}" —— 阈值唯一来源是共享层常量`,
      )
    }
  }
  for (const [sym, where] of [
    ['STUCK_CONSECUTIVE_THRESHOLD', FILES.cliLoop],
    ['planDoomAlertResponse', FILES.cliLoop],
    ['createFailureStreakTracker', FILES.cliLoop],
    ['createDoomLoopWindow', FILES.cliAdapter],
    ['createStuckSignatureDetector', FILES.cliAdapter],
  ]) {
    const mask = where === FILES.cliLoop ? cliLoopMask : adapterMask
    if (!mask.includes(sym)) {
      problems.push(`P2 共享层判据未被主链路使用:${where} 缺 ${sym}(摘线 = 门对该形态全盲)`)
    }
  }
  for (const sym of ['DoomLoopSentinel(', 'observe_calls(', 'observe_results(']) {
    if (!pyLoopMask.includes(sym)) {
      problems.push(
        `P2 Python 主链路未接哨兵:${FILES.pyLoop} 缺 ${sym} —— "等价实现存在但无人调用"等于没有上提`,
      )
    }
  }
  for (const key of [...POLICY_NUMBERS, ...POLICY_STRINGS, ...POLICY_LISTS]) {
    const re = new RegExp(`^\\s*${key}\\s*=\\s*\\d`, 'm')
    const reList = new RegExp(`^\\s*${key}\\s*=\\s*\\[`, 'm')
    if (re.test(pyLoopMask) || reList.test(pyLoopMask)) {
      problems.push(
        `P2 Python 主链路二次抄写策略数字:${FILES.pyLoop} 重新声明了 ${key}(唯一来源 = core/doom_loop.py)`,
      )
    }
  }

  // ---- P3 动作集合逐项被两侧主链路消费 ----
  const actions = Array.isArray(tsPolicy['DOOM_LOOP_STRATEGY_ACTIONS'])
    ? tsPolicy['DOOM_LOOP_STRATEGY_ACTIONS']
    : []
  for (const action of actions) {
    if (!cliLoopMask.includes(`'${action}'`)) {
      problems.push(
        `P3 动作 "${action}" 在 CLI 主链路无消费点:${FILES.cliLoop} 未处理该动作(声明动作=装饰品,判红)`,
      )
    }
    if (!pyLoopMask.includes(`"${action}"`) && !pyLoopMask.includes(`'${action}'`)) {
      problems.push(
        `P3 动作 "${action}" 在 Python 主链路无消费点:${FILES.pyLoop} 未处理该动作(声明动作=装饰品,判红)`,
      )
    }
  }
  if (actions.length === 0) {
    problems.push('P3 动作清单解析为空 ⇒ 判据失明(策略动作集合缺失,不得把"看不见"读成通过)')
  }

  // ---- P4 轮次上限:逐档现读 + 差异登记表(D144②) ----
  const round = decideRoundLimits(contents)
  for (const p of round.problems) problems.push(p)
  for (const n of round.notes) notes.push(n)

  return { problems, notes, undetermined, policy, roundLimits: round }
}

// ---------------------------------------------------------------------------
// 取材 + CLI
// ---------------------------------------------------------------------------

/**
 * @param {string} root
 * @param {'head'|'staged'|'worktree'} face
 */
export function readFace(root, face, files) {
  if (face === 'worktree') {
    const m = new Map()
    for (const f of files) m.set(f, readWorktreeFile(root, f))
    return m
  }
  const prefix = face === 'head' ? 'HEAD:' : ':'
  const revs = files.map((f) => `${prefix}${f}`)
  const batch = catBatch(root, revs)
  const m = new Map()
  files.forEach((f, i) => m.set(f, batch.get(revs[i]) ?? null))
  return m
}

/**
 * @param {string} root
 * @param {'head'|'staged'|'worktree'} face
 */
export function runAudit(root, face) {
  assertRepoRoot(root, 'doom-loop parity 对账')
  const files = Object.values(FILES)
  const contents = readFace(root, face, files)
  /** @type {Record<string, string|null>} */
  const map = {}
  for (const f of files) map[f] = contents.get(f) ?? null
  return decide(map)
}

function report(res) {
  if (res.undetermined.length > 0) {
    console.error('⚠️ 无法判定:以下被审文件在该判定面上取不到(缺文件 ≠ 通过,也 ≠ 违规):')
    for (const f of res.undetermined) console.error(`   - ${f}`)
    return 2
  }
  if (res.problems.length > 0) {
    console.error(`❌ doom-loop parity 对账发现 ${res.problems.length} 项漂开:`)
    for (const p of res.problems) console.error(`   ${p}`)
    console.error(
      '   出路:同一枚提交把两侧改齐(P1)/把判据接回主链路(P2/P3)。' +
        '**不得**改数字方向迁就单侧,不得新造豁免通道。应急跳过 HUSKY_SKIP_DOOM_LOOP_PARITY=1。',
    )
    return 1
  }
  const keys = res.policy ? Object.keys(res.policy).length : 0
  const rl = res.roundLimits
  console.log(
    `✅ TS 共享层 / CLI 适配器 / agent.ts / Python 等价实现 / agent_loop_v2 五面成套:` +
      `策略键 ${keys} 项逐格等值,主链路两侧均消费(动作集合非装饰品),无第二份数字。` +
      (rl && rl.anchor !== null ? ` 轮次上限 ${Object.keys(rl.values).length} 档现读齐备(差异均已登记并交代)。` : ''),
  )
  for (const n of res.notes) console.log(`   · ${n}`)
  return 0
}

// ---------------------------------------------------------------------------
// --self-test(构造面证明,零 git、零副作用)
// ---------------------------------------------------------------------------

/** 一套"两侧等值 + 接线成套"的最小夹具(字段形状与 decide 输入一致)。 */
function fixtureContents(overrides = {}) {
  const tsShared = [
    `export const DOOM_LOOP_WINDOW_SIZE = 10;`,
    `export const DOOM_LOOP_REPEAT_THRESHOLD = 3;`,
    `export const DOOM_LOOP_COOLDOWN_MS = 0;`,
    `export const DOOM_ALERT_ROUNDS_TO_TERMINATE = 2;`,
    `export const STUCK_CONSECUTIVE_THRESHOLD = 3;`,
    `export const FAILURE_STREAK_STRATEGY_THRESHOLD = 3;`,
    `export const ERROR_SIGNATURE_MAX_LEN = 120;`,
    `export const DOOM_LOOP_HASH_ALGORITHM = 'sha256';`,
    `const SERIALIZE_FALLBACK = '{"__doom_loop_unserializable__":true}';`,
    `export const DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating'] as const;`,
    `export const DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'skip_tool_execution', 'terminate_loop'] as const;`,
    `export function createDoomLoopWindow() { return null }`,
    `export function createStuckSignatureDetector() { return null }`,
    `export function createFailureStreakTracker() { return null }`,
  ].join('\n')
  const tsBridge = `export * from '../agent/doom-loop-detector.js'`
  const cliAdapter = [
    `import { createHash } from 'node:crypto'`,
    `import { createDoomLoopWindow, createStuckSignatureDetector } from '@ihui/shared/utils/doom-loop-detector'`,
    `export { createFailureStreakTracker, planDoomAlertResponse } from '@ihui/shared/utils/doom-loop-detector'`,
  ].join('\n')
  const cliLoop = [
    `import { STUCK_CONSECUTIVE_THRESHOLD, planDoomAlertResponse, createFailureStreakTracker } from '../doom-loop-detector.js'`,
    `if (plan.actions.includes('terminate_loop')) break`,
    `if (plan.actions.includes('inject_reflection')) pushReminder()`,
    `if (plan.actions.includes('skip_tool_execution')) continue`,
  ].join('\n')
  const pyModule = [
    `DOOM_LOOP_WINDOW_SIZE = 10`,
    `DOOM_LOOP_REPEAT_THRESHOLD = 3`,
    `DOOM_LOOP_COOLDOWN_MS = 0`,
    `DOOM_ALERT_ROUNDS_TO_TERMINATE = 2`,
    `STUCK_CONSECUTIVE_THRESHOLD = 3`,
    `FAILURE_STREAK_STRATEGY_THRESHOLD = 3`,
    `ERROR_SIGNATURE_MAX_LEN = 120`,
    `DOOM_LOOP_HASH_ALGORITHM = 'sha256'`,
    `_SERIALIZE_FALLBACK = '{"__doom_loop_unserializable__":true}'`,
    `DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating']`,
    `DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'skip_tool_execution', 'terminate_loop']`,
    `AGENT_MAX_ITERATIONS = 10`,
  ].join('\n')
  const pyLoop = [
    `from ..core.doom_loop import DoomLoopSentinel`,
    `max_iterations: int = AGENT_MAX_ITERATIONS,`,
    `self._doom_sentinel = DoomLoopSentinel()`,
    `actions, reminders = self._doom_sentinel.observe_calls(calls)`,
    `reminders2, fatal = self._doom_sentinel.observe_results(results)`,
    `if "terminate_loop" in actions: return`,
    `if "skip_tool_execution" in actions: skip()`,
    `if "inject_reflection" in actions: inject()`,
  ].join('\n')
  // D144 P4 的四个站点夹具(与真仓 HEAD 现读同形:引擎 10 / 其余四档 8、8、8、25)
  const pyConfig = [`class Settings:`, `    max_agent_iterations: int = 8`, `    # 注释不参与判定`].join('\n')
  const pyRouter = [
    `loop = await _new_v2_loop(`,
    `    max_iterations=max_iterations or 8,`,
    `)`,
  ].join('\n')
  const pyEngine = [
    `max_iterations=int(md.get("maxIterations") or 8),`,
    `max_iterations=int(md.get("maxIterations") or 6), // HEAD 现读第三处兜底档(登记表已交代)`,
    `max_iterations=int(params.get("maxIterations") or 8),`,
  ].join('\n')
  const cliDefaults = [`export const DEFAULTS = {`, `  maxIterations: 25,`, `}`].join('\n')
  return {
    [FILES.tsShared]: tsShared,
    [FILES.tsBridge]: tsBridge,
    [FILES.cliAdapter]: cliAdapter,
    [FILES.cliLoop]: cliLoop,
    [FILES.pyModule]: pyModule,
    [FILES.pyLoop]: pyLoop,
    [FILES.pyConfig]: pyConfig,
    [FILES.pyRouter]: pyRouter,
    [FILES.pyEngine]: pyEngine,
    [FILES.cliDefaults]: cliDefaults,
    ...overrides,
  }
}

export function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (name, cond) => {
    if (cond) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name}`)
    }
  }
  // 1 基线夹具 ⇒ 零问题(阳性:判据对成套夹具不闪红)
  let r = decide(fixtureContents())
  ok('01 成套夹具 ⇒ problems=0(实测:' + r.problems[0] + ')', r.problems.length === 0)
  // 1b b76-14:SERIALIZE_FALLBACK 两侧同值 ⇒ 不红(键真的进了 P1 表并在读)
  ok(
    '01b SERIALIZE_FALLBACK 两侧同值 ⇒ P1 无点名且两侧已解析(b76-14 键已入表)',
    r.problems.every((p) => !p.includes('SERIALIZE_FALLBACK')) &&
      Array.isArray(r.policy.SERIALIZE_FALLBACK) &&
      r.policy.SERIALIZE_FALLBACK[0] === r.policy.SERIALIZE_FALLBACK[1] &&
      r.policy.SERIALIZE_FALLBACK[0] === '{"__doom_loop_unserializable__":true}',
  )
  // 2 单侧阈值漂移 ⇒ P1 点名该键(阳性对照:改掉一侧阈值必红)
  const driftPy = fixtureContents()
  driftPy[FILES.pyModule] = driftPy[FILES.pyModule].replace(
    'DOOM_LOOP_REPEAT_THRESHOLD = 3',
    'DOOM_LOOP_REPEAT_THRESHOLD = 4',
  )
  r = decide(driftPy)
  ok('02 Python 侧阈值 3→4 ⇒ P1 点名 DOOM_LOOP_REPEAT_THRESHOLD',
    r.problems.some((p) => p.startsWith('P1') && p.includes('DOOM_LOOP_REPEAT_THRESHOLD')))
  const driftTs = fixtureContents()
  driftTs[FILES.tsShared] = driftTs[FILES.tsShared].replace(
    'export const STUCK_CONSECUTIVE_THRESHOLD = 3;',
    'export const STUCK_CONSECUTIVE_THRESHOLD = 5;',
  )
  r = decide(driftTs)
  ok('03 TS 侧阈值 3→5 ⇒ P1 点名 STUCK_CONSECUTIVE_THRESHOLD(两侧对称)',
    r.problems.some((p) => p.startsWith('P1') && p.includes('STUCK_CONSECUTIVE_THRESHOLD')))
  // 4 状态数漂移(清单长度)+ 动作漂移
  const driftStates = fixtureContents()
  driftStates[FILES.pyModule] = driftStates[FILES.pyModule].replace(
    "DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating']",
    "DOOM_LOOP_STATES = ['observing', 'reflecting']",
  )
  r = decide(driftStates)
  ok('04 状态数 3→2 ⇒ P1 点名 DOOM_LOOP_STATES',
    r.problems.some((p) => p.startsWith('P1') && p.includes('DOOM_LOOP_STATES')))
  const driftActions = fixtureContents()
  driftActions[FILES.pyModule] = driftActions[FILES.pyModule].replace(
    "DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'skip_tool_execution', 'terminate_loop']",
    "DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'terminate_loop']",
  )
  r = decide(driftActions)
  ok('05 动作数漂移 ⇒ P1 点名 DOOM_LOOP_STRATEGY_ACTIONS',
    r.problems.some((p) => p.startsWith('P1') && p.includes('DOOM_LOOP_STRATEGY_ACTIONS')))
  // 5b/5c b76-14:SERIALIZE_FALLBACK 的正反成对 —— 单侧漂移/单侧缺失都必须点名
  const driftSerializeTs = fixtureContents()
  driftSerializeTs[FILES.tsShared] = driftSerializeTs[FILES.tsShared].replace(
    `const SERIALIZE_FALLBACK = '{"__doom_loop_unserializable__":true}';`,
    `const SERIALIZE_FALLBACK = '{"__doom_loop_unserializable__":  true}';`, // 只差空白:等值判据必须认得出
  )
  r = decide(driftSerializeTs)
  ok('05b TS 侧 SERIALIZE_FALLBACK 值漂移 ⇒ P1 点名(b76-14)',
    r.problems.some((p) => p.startsWith('P1') && p.includes('SERIALIZE_FALLBACK')))
  const dropSerializePy = fixtureContents()
  dropSerializePy[FILES.pyModule] = dropSerializePy[FILES.pyModule].replace(
    `_SERIALIZE_FALLBACK = '{"__doom_loop_unserializable__":true}'`,
    `# 序列化兜底占位串被删了`,
  )
  r = decide(dropSerializePy)
  ok('05c Python 侧 SERIALIZE_FALLBACK 缺失 ⇒ P1 点名"缺失/形态漂移"(b76-14)',
    r.problems.some((p) => p.startsWith('P1') && p.includes('SERIALIZE_FALLBACK')))
  // 6 CLI 二次抄数字 ⇒ 红(回归锁:本地阈值声明不得回来)
  const copyCli = fixtureContents()
  copyCli[FILES.cliLoop] += '\nconst SAMPLER_DOOM_LOOP_THRESHOLD = 3;'
  r = decide(copyCli)
  ok('06 CLI 抄回本地阈值 ⇒ P2 点名二次抄写',
    r.problems.some((p) => p.startsWith('P2') && p.includes('二次抄写')))
  // 7 Python 主链路摘线(去掉 observe_results 调用)⇒ 红
  const unwire = fixtureContents()
  unwire[FILES.pyLoop] = unwire[FILES.pyLoop].replace('observe_results(', 'legacy_noop_(')
  r = decide(unwire)
  ok('07 主链路摘掉 observe_results ⇒ P2 点名"等价实现存在但无人调用"',
    r.problems.some((p) => p.startsWith('P2') && p.includes('observe_results(')))
  // 8 动作无消费点 ⇒ P3 红
  const noConsume = fixtureContents()
  noConsume[FILES.cliLoop] = noConsume[FILES.cliLoop].replace(
    `if (plan.actions.includes('skip_tool_execution')) continue`,
    `// consumer removed`,
  )
  r = decide(noConsume)
  ok('08 CLI 不再处理 skip_tool_execution ⇒ P3 点名装饰品动作',
    r.problems.some((p) => p.startsWith('P3') && p.includes('skip_tool_execution')))
  // 9 共享层混入平台依赖 ⇒ 红
  const dirtyShared = fixtureContents()
  dirtyShared[FILES.tsShared] = `import { createHash } from 'node:crypto'\n` + dirtyShared[FILES.tsShared]
  r = decide(dirtyShared)
  ok('09 共享层 import node:crypto ⇒ P2 点名平台依赖',
    r.problems.some((p) => p.startsWith('P2') && p.includes('平台依赖')))
  // 10 面缺文件 ⇒ 未判定(既不红也不绿)
  r = decide({ ...fixtureContents(), [FILES.pyModule]: null })
  ok('10 面缺 Python 文件 ⇒ undetermined 点名,problems=0',
    r.problems.length === 0 && r.undetermined.length === 1)
  // 11 注释里的漂移数字不得判红(掩码:注释不算代码面)
  const commented = fixtureContents()
  commented[FILES.pyModule] = '# DOOM_LOOP_REPEAT_THRESHOLD = 99\n' + commented[FILES.pyModule]
  r = decide(commented)
  ok('11 注释中的旧阈值不得被读成第二份声明', r.problems.length === 0)
  // 12 字符串形态的旧名出现在代码面 ⇒ 掩码保留字符串,二次抄写判据仍咬
  const strCopy = fixtureContents()
  strCopy[FILES.cliLoop] = '\nconst FAILURE_REFLECTION_THRESHOLD = 2;'
  r = decide(strCopy)
  ok('12 FAILURE_REFLECTION_THRESHOLD 回升 ⇒ P2 点名',
    r.problems.some((p) => p.startsWith('P2') && p.includes('FAILURE_REFLECTION_THRESHOLD')))
  // 13 解析器形状锁:等值两侧解析结果一致
  const tp = parseTsPolicy(maskComments(fixtureContents()[FILES.tsShared], 'js'))
  const pp = parsePyPolicy(maskComments(fixtureContents()[FILES.pyModule], 'py'))
  ok('13 TS/Py 解析器对成套夹具解析出的键集合相同',
    JSON.stringify(Object.keys(tp).sort()) === JSON.stringify(Object.keys(pp).sort()))
  // 14 selectFace 两面旗同给 ⇒ 判死
  const both = selectFace({ staged: true, worktree: true })
  ok('14 --staged 与 --worktree 同给 ⇒ error(不取任一面)', both.error !== null)

  // ---- 15..24 P4 轮次上限(判据 + 生产面正例 + 反例成套) ----
  const TODAY = '2026-10-01'
  const base = fixtureContents()
  // 15 正例(生产面形状):引擎 10 + 四档 8/8/8/25 全部登记 ⇒ 绿,且打印逐档现读
  const p15 = decideRoundLimits(base, { today: TODAY })
  ok(
    '15 P4 成套夹具 ⇒ 零问题且逐档现读被打印',
    p15.problems.length === 0 &&
      p15.notes.some((n) => n.includes('AGENT_MAX_ITERATIONS: py=10')) &&
      p15.notes.some((n) => n.includes('已声明差异')),
  )
  // 16 变异例(票面验收①):py 基准档 10→99 且登记表无对应条目 ⇒ 判红
  const drift99 = fixtureContents()
  drift99[FILES.pyModule] = drift99[FILES.pyModule].replace('AGENT_MAX_ITERATIONS = 10', 'AGENT_MAX_ITERATIONS = 99')
  const p16 = decideRoundLimits(drift99, { ledger: [], today: TODAY })
  ok(
    '16 基准档 10→99 + 空白名单 ⇒ P4 点名未登记差异(阳性对照)',
    p16.problems.some((p) => p.startsWith('P4') && p.includes('未登记的轮次差异')),
  )
  // 17 同一次漂移,但带着**旧基准**写的登记表 ⇒ 仍红(anchor 失效)
  const p17 = decideRoundLimits(drift99, { today: TODAY })
  ok(
    '17 基准档漂移而登记仍写 anchor=10 ⇒ P4 点名"对着旧基准档写的"(登记表不得发合格证)',
    p17.problems.some((p) => p.startsWith('P4') && p.includes('对着旧基准档写的')),
  )
  // 18 到期 ⇒ 红(照 check-exemption-expiry 的 E2 语义)
  const p18 = decideRoundLimits(base, { today: '2027-01-01' })
  ok('18 登记条目到期 ⇒ P4 点名已过期', p18.problems.some((p) => p.startsWith('P4') && p.includes('已过期或缺到期日')))
  // 19 站点已改齐基准而登记还挂着 ⇒ 清单腐烂红
  const paidOff = fixtureContents()
  paidOff[FILES.cliDefaults] = paidOff[FILES.cliDefaults].replace('maxIterations: 25', 'maxIterations: 10')
  const p19 = decideRoundLimits(paidOff, { today: TODAY })
  ok(
    '19 站点值已等于基准却仍挂登记 ⇒ P4 判"登记表腐烂"(不是"少一条差异")',
    p19.problems.some((p) => p.startsWith('P4') && p.includes('登记表腐烂')),
  )
  // 20 构造器写死数字(登记表无人消费)⇒ 红
  const decorative = fixtureContents()
  decorative[FILES.pyLoop] = decorative[FILES.pyLoop].replace(
    'max_iterations: int = AGENT_MAX_ITERATIONS,',
    'max_iterations: int = 10,',
  )
  const p20 = decideRoundLimits(decorative, { today: TODAY })
  ok(
    '20 引擎构造器默认档写死数字 ⇒ P4 点名"未引用登记表"(常量成装饰品)',
    p20.problems.some((p) => p.startsWith('P4') && p.includes('未引用登记表')),
  )
  // 21 站点搬家(正则读不到任何值)⇒ 红,不得静默成"这一档没问题"
  const movedSite = fixtureContents()
  movedSite[FILES.cliDefaults] = 'export const DEFAULTS = { maxTurns: 25 }'
  const p21 = decideRoundLimits(movedSite, { today: TODAY })
  ok('21 站点枚举到 0 个值 ⇒ P4 点名判据失明', p21.problems.some((p) => p.startsWith('P4') && p.includes('枚举到 0 个值')))
  // 22 装车证明:P4 必须挂在主判据 decide() 上(只住在导出函数里 = 提交链上一路绿灯)
  const wired = decide(drift99)
  ok(
    '22 decide() 真的调用 P4(基准漂移经主判据也判红,不是只有函数能判)',
    wired.problems.some((p) => p.startsWith('P4') && p.includes('对着旧基准档写的')) &&
      !wired.problems.some((p) => p.startsWith('P4') && p.includes('未登记的轮次差异')),
  )
  // 23 注释里的轮次数字不得被读成一个站点(掩码面:判据看的是代码)
  const commentedSite = fixtureContents()
  commentedSite[FILES.cliDefaults] = '// 历史草稿:maxIterations: 99\n' + commentedSite[FILES.cliDefaults]
  const p23 = decideRoundLimits(commentedSite, { today: TODAY })
  ok(
    '23 注释里的 maxIterations 不得计成站点值',
    p23.problems.length === 0 && (p23.values['cli-default'] || []).join() === '25',
  )
  // 24 登记条目缺 reason ⇒ 红(半个交代不构成交代)
  const p24 = decideRoundLimits(base, {
    today: TODAY,
    ledger: MAX_ITERATION_DIVERGENCE.map((e) => (e.site === 'cli-default' ? { ...e, reason: '  ' } : e)),
  })
  ok('24 登记条目缺 reason ⇒ P4 点名裸标记', p24.problems.some((p) => p.startsWith('P4') && p.includes('缺 reason')))

  console.log(`\ndoom-loop parity 对账 --self-test:${pass} 通过 / ${fail} 失败(共 ${pass + fail} 条)`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (process.env.HUSKY_SKIP_DOOM_LOOP_PARITY === '1') {
    console.log('⏭️ HUSKY_SKIP_DOOM_LOOP_PARITY=1 ⇒ 跳过 doom-loop parity 对账(应急,须在提交说明写明原因)')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 && argv[rootIdx + 1] ? path.resolve(argv[rootIdx + 1]) : ROOT
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  try {
    const res = runAudit(root, picked.face)
    if (argv.includes('--json')) {
      console.log(JSON.stringify({ face: picked.face, ...res }))
      if (res.undetermined.length > 0) return 2
      return res.problems.length > 0 ? 1 : 0
    }
    return report(res)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定:${e.message}`)
      return 2
    }
    console.error(`❌ 脚本异常(不静默放行):${e?.message ?? e}`)
    return 2
  }
}

export const __test__ = {
  FILES,
  POLICY_NUMBERS,
  POLICY_STRINGS,
  POLICY_LISTS,
  ROUND_LIMIT_SITES,
  ROUND_LIMIT_ANCHOR,
  MAX_ITERATION_DIVERGENCE,
  parseTsPolicy,
  parsePyPolicy,
  decide,
  decideRoundLimits,
  fixtureContents,
  readFace,
  runAudit,
  selfTest,
}

// §22d isDirectRun:被 import(镜像测试)时不得触发 main()。
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
