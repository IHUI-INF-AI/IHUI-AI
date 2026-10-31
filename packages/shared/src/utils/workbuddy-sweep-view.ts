// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WorkBuddy「自动做任务」巡检态判据 —— 三端(web / mobile-rn / miniapp-taro)唯一真相源。
//
// 在修什么(2026-10-31 立):同一套判定曾被抄成三份,并已实测漂移三处 ——
// ① tone 档位:web 把 cron-blocked 与 dry-run 并成一个 `'warn'`、RN 用 `'blocked'`/`'dry'` 分开、
//    小程序用 `'warn'`;② 未知态追加错误详情的连接符:web `': '`、RN 与小程序 `' · '`;
// ③ ISO 截断在小程序同一文件里写了两遍。三抄零判据 = AGENTS §0.6/§22c 立项的那一型。
// 本文件是判据侧唯一实现;**类名/颜色/i18n 键名一律留在各端可扫描文件里**(§跨端样式同步铁律:
// 数值进 shared、类名留各端),各端只做「tone → 本端呈现」映射。
//
// 纯度纪律(守门 126 check-shared-nonde-node-purity.mjs):零 i18n、零 React、零平台 API、
// 零 `node:` 内建导入 —— 只允许纯函数与类型。
//
// 契约(apps/ai-service `GET /api/checkin/scheduler/status` 的 `wb_tasks`,2026-10-31 冻结):
// - `enabled`  ⇒ **观测态**:这条 job 现在真注册在进程里(不再是"两门与"的推断);
// - `tasks_enabled` / `cron_enabled` ⇒ 两门配置意图原值;
// - `not_running_reason` ⇒ 'tasks_gate_off' | 'cron_gate_off' | 'scheduler_not_started'
//   | 'job_not_registered' | null;`enabled=true` 时恒为 null;
// - `live_run` / `sweep_minutes` / `claim_path_configured` / `activity_path_configured` /
//   `last_sweep` 与顶层 `next_run_wb_tasks` 不变。
// 取值表与接口形态一律 import 自 `@ihui/types`(它镜像后端 `_wb_tasks_not_running_reason`
// 与 `status()`),本文件不抄第二份;三端只消费这里的判定与自己的文案映射。

// `not_running_reason` 的取值表住在 `@ihui/types`(与后端 `_wb_tasks_not_running_reason` 同源),
// 本文件只做类型投影与再导出 —— 再抄一份字面量就是 §0.6 禁的那一型(两份清单必然漂移)。
import {
  CHECKIN_WB_TASKS_NOT_RUNNING_REASONS,
  type CheckinSchedulerStatusResponse,
  type CheckinWbTasksNotRunningReason,
  type CheckinWbTasksStatus,
} from '@ihui/types'

/** `wb_tasks.not_running_reason` 的取值(`null`/`undefined` = 服务端没给原因,与"没有原因"不同义)。 */
export type WbSweepNotRunningReason = CheckinWbTasksNotRunningReason | null

/** 巡检态档位:五个结论档 + 两个未判定态。颜色/样式按档位映射,文案按 messageKey 映射。 */
export type WbSweepTone =
  'loading' | 'on' | 'dry' | 'cron-blocked' | 'tasks-off' | 'not-registered' | 'unknown'

/** 文案语义键(与各端 i18n 键一一对应,由端内映射表注入;当前与 tone 同集)。 */
export type WbSweepMessageKey = WbSweepTone

/** 判据输入的 `wb_tasks` 形态 = 契约类型本身(后端字段漂移时这里先报错,不靠本地抄一份)。 */
export type WbSweepTasksSnapshot = CheckinWbTasksStatus

/** 判据输入的响应形态 = 契约里判据真正读到的那两块(顶层 `next_run_wb_tasks` + `wb_tasks`)。 */
export type WbSweepStatusSnapshot = Pick<
  CheckinSchedulerStatusResponse,
  'next_run_wb_tasks' | 'wb_tasks'
>

/** 机读判定结果:呈现层据此选颜色、选文案键、决定是否追加详情。 */
export interface WbSweepViewDecision {
  tone: WbSweepTone
  messageKey: WbSweepMessageKey
  /** `sweep_minutes` 原值(有 `wb_tasks` 就是数,不猜);loading/unknown 无此数 ⇒ null。 */
  minutes: number | null
  /** 下次巡检时间(截到分钟);仅在「这条 job 真在跑」的档位给值。 */
  next: string | null
  /** 领奖/上报路径缺一 ⇒ 只上报不领奖,必须单独说明。 */
  pathsMissing: boolean
  /** 未判定的原始详情(如请求错误原文),呈现层用 WB_SWEEP_DETAIL_SEPARATOR 追加,不粉饰。 */
  detail: string | null
}

/** 详情/分段连接符唯一取值:此前 web 用 `': '`、另两端用 `' · '`,同一句话三种长相就是漂移。 */
export const WB_SWEEP_DETAIL_SEPARATOR = ' · '

/**
 * 已知 `not_running_reason` 清单 = `@ihui/types` 那张表的再导出(测试与端内对账用)。
 * 判据 switch 必须逐档接住它,新增档位忘了接线由同集用例喊出来。
 */
export const WB_SWEEP_NOT_RUNNING_REASONS = CHECKIN_WB_TASKS_NOT_RUNNING_REASONS

/** 七个档位的封闭集(端内映射表必须逐档覆盖,少一档编译期即红;测试据此遍历)。 */
export const WB_SWEEP_TONES = [
  'loading',
  'on',
  'dry',
  'cron-blocked',
  'tasks-off',
  'not-registered',
  'unknown',
] as const satisfies readonly WbSweepTone[]

/**
 * ISO → 「截到分钟」的唯一截断实现:纯字符串截断,不走 `toLocaleString`。
 * 后者按设备时区/语言变体输出,同一份回执在不同机器上不可对账,且会造成 SSR/CSR hydration 抖动。
 */
export function formatWbIsoMinute(iso: string | null | undefined): string | null {
  if (typeof iso !== 'string' || iso.length === 0) return null
  return iso.slice(0, 16).replace('T', ' ')
}

/** 用同一连接符拼接非空分段(上一轮回执的「时间 · 战果 · 未完原因」也走这里,不再各端手拼)。 */
export function joinWbSweepParts(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(WB_SWEEP_DETAIL_SEPARATOR)
}

function decide(
  tone: WbSweepTone,
  extra: Partial<Omit<WbSweepViewDecision, 'tone' | 'messageKey'>> = {},
): WbSweepViewDecision {
  return {
    tone,
    messageKey: tone,
    minutes: null,
    next: null,
    pathsMissing: false,
    detail: null,
    ...extra,
  }
}

/**
 * 巡检态 → 机读判定(纯函数,三端渲染与用例共用一份;判序不许改,理由逐条写在分支上)。
 *
 * ① `sweep === undefined` = 还没取到 ⇒ loading(不是"未启用",也不是"状态未知")。
 * ② 没有 `wb_tasks` ⇒ unknown。**绝不降级成"未启用"**:服务端版本较旧不返回这块视图时,
 *    把它写成"未启用"就是把"没人告诉我"说成"告我没跑"(AGENTS §0.3)。
 * ③ `enabled` 为真 ⇒ `live_run` 分 on / dry。此时 `not_running_reason` 恒为 null,不参与判定。
 * ④ `enabled` 为假 ⇒ 按 `not_running_reason` 分四档;reason 缺失或不认识时**只保留一条**能确证
 *    的旧推断(`tasks_enabled ∧ ¬cron_enabled` ⇒ 被总闸拦),其余一律落 unknown。
 *    理由:旧服务端没给这个字段属"未判定",而两门原值只证得出"总闸拦住了它"这一件事;
 *    把 `tasks_enabled=false` 也当证据报"未启用",在观测态契约下等于替服务端编原因。
 */
export function deriveWbSweepView(
  sweep: WbSweepStatusSnapshot | null | undefined,
  sweepError: string | null,
): WbSweepViewDecision {
  if (sweep === undefined) return decide('loading')

  const wt = sweep?.wb_tasks
  if (!wt) {
    return decide('unknown', { detail: sweepError || null })
  }

  const pathsMissing = !wt.claim_path_configured || !wt.activity_path_configured
  const minutes = typeof wt.sweep_minutes === 'number' ? wt.sweep_minutes : null
  const next = formatWbIsoMinute(sweep?.next_run_wb_tasks)

  // ③ 观测态为真:这条 job 现在真注册在进程里,只有"写侧/只读"两种跑法。
  if (wt.enabled) {
    if (!wt.live_run) return decide('dry', { minutes, next, pathsMissing })
    return decide('on', { minutes, next, pathsMissing })
  }

  // ④ 观测态为假:先问服务端给的原因,再谈旧服务端的推断。
  switch (wt.not_running_reason) {
    case 'tasks_gate_off':
      return decide('tasks-off', { pathsMissing })
    case 'cron_gate_off':
      return decide('cron-blocked', { pathsMissing })
    case 'scheduler_not_started':
    case 'job_not_registered':
      // 两门意图都开、观测却没跑起来 = "配置已开却没跑":出路只有一条 —— 重启 ai-service
      // (服务内 start() 有 `if self._started: return` 短路,改完 .env 不会热加载)。
      return decide('not-registered', { pathsMissing })
    default:
      // undefined / null / 不认识的新值 ⇒ 不替服务端编原因。
      if (wt.tasks_enabled === true && wt.cron_enabled === false) {
        return decide('cron-blocked', { pathsMissing })
      }
      return decide('unknown', { pathsMissing })
  }
}

/** 端内注入的翻译出口形态(web 的 `t`、RN/小程序的 `t(key, params)` 都满足)。 */
export type WbSweepTranslate = (key: string, params?: Record<string, string | number>) => string

/**
 * 判定 → 本端文案(仍不含任何 i18n 取值:`messageKeys` 由各端逐档登记自己的键)。
 * 只有 `on` 档的文案自带节拍 `{minutes}`;其它档把数字塞进去会在测试里长成 `key(30)` 这种
 * 无意义形态,故不传。端内若要把节拍写进别的档,请自行调 `t` 而不是改这里。
 */
export function composeWbSweepText(
  decision: WbSweepViewDecision,
  messageKeys: Record<WbSweepMessageKey, string>,
  t: WbSweepTranslate,
): string {
  const key = messageKeys[decision.messageKey]
  const base =
    decision.messageKey === 'on' && decision.minutes !== null
      ? t(key, { minutes: decision.minutes })
      : t(key)
  return decision.detail ? joinWbSweepParts([base, decision.detail]) : base
}

export const __test__ = {
  deriveWbSweepView,
  composeWbSweepText,
  formatWbIsoMinute,
  joinWbSweepParts,
  WB_SWEEP_TONES,
  WB_SWEEP_NOT_RUNNING_REASONS,
  WB_SWEEP_DETAIL_SEPARATOR,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
