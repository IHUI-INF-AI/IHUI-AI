// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话目标(goal)活动行 / 胶囊的"取词 + 措辞"层(miniapp-taro 端内唯一入口,D152 2026-09-29 立)。
 *
 * 这一票的端消费面只到"看得见目标状态":本端**没有** `/goal` 的发起面(手机上没有那条斜杠命令),
 * 所以这里只把下行帧 `goal_updated` 的六档状态与目标原文变成本地化文本,
 * 不给输入口、不给按钮 —— 与 `onTerminalInteraction` 在本端"只标状态、不接代答"同一口径
 * (台账理由见 scripts/data/sse-dispatch-coverage.json 的 miniapp-taro 各条)。
 *
 * 三条不可漂的写法:
 *  ① 状态词汇的唯一来源是 `@ihui/types` 的 `GOAL_STATUSES`(AGENTS §30「状态词汇是一等契约」),
 *     本端不得抄第二份字面量,也不得把 `cleared`(线格式第七值)当第七种落库状态渲染;
 *  ② 取词键拼的是 `chat.goal.status.<档>` 且**逐档验在位** —— 小程序的 t() 对缺键是
 *     **回显键名**(不是回退中文),裸键进界面就是本仓记过的"端内取词缺键回显 toolReadFile"同型;
 *     词包权威在 packages/i18n/messages/shared/,新增键未进离线包时非中文会静默回落,
 *     所以加键后必须重跑 `pnpm --filter @ihui/miniapp-taro gen:i18n`(守门 105 G1 判这一格);
 *  ③ 认不出的档 ⇒ 返回 null(整帧不上屏),绝不"当作 active"—— 把"没认出来"写成"看见了"
 *     是本仓最高频的失效型。
 */
import type { GoalUpdateEvent } from '@ihui/api-client'
import { GOAL_STATUSES, type GoalStatus } from '@ihui/types'

import type { TranslateFn } from './tool-line'

/** 跨端共享命名空间(权威语包:packages/i18n/messages/shared/) */
export const GOAL_STATUS_KEY_PREFIX = 'chat.goal.status.'

/** 线档 → 是否本域六档之一(不清单化:判据现读 @ihui/types 的那一份) */
export function isGoalStatus(value: string): value is GoalStatus {
  return (GOAL_STATUSES as readonly string[]).includes(value)
}

/** 胶囊/活动行的状态文本;认不出的档或词包缺键 ⇒ 空串(调用方据此不渲染,裸键不得进界面) */
export function goalStatusText(status: string, t: TranslateFn): string {
  if (!isGoalStatus(status)) return ''
  const key = `${GOAL_STATUS_KEY_PREFIX}${status}`
  const label = t(key)
  // t() 缺键时**原样回显键名**(见 @ihui/i18n/loader translate),那正是本端要避免的界面形态
  return label === key ? '' : label
}

export interface GoalNotice {
  /** 本地化的档位文案,如「进行中」「额度受限」 */
  label: string
  /** 目标原文(服务端主副本带来,不是本机输入框的残留) */
  objective: string
}

/**
 * 下行帧 → 上屏通知;`status:'cleared'` 与未知档都返回 null(胶囊消失 / 不上屏)。
 *
 * 刻意把"清除"和"认不出来"折成同一个 null:两者对界面是同一件事 —— 没有可显示的目标态。
 * 而它们在服务端是两件事(cleared 是写口成功后的广播,未知档根本进不了本端),
 * 所以判 null 之前不区分、之后也不伪造。
 */
export function describeGoalNotice(evt: GoalUpdateEvent, t: TranslateFn): GoalNotice | null {
  const label = goalStatusText(evt.status, t)
  if (!label) return null
  return { label, objective: evt.objective ?? '' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
