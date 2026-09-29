// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 推理强度档位轴(D130,2026-09-30 立)—— 对话输入区的"第三轴"。
//
// 为什么不藏进模型弹层的采样面板:采样面板(sampling-params-panel)是**数值**抽屉
// (temperature/top_p/top_k/max_tokens),而推理强度是**离散档位**,两者语义不同轴;
// 票第 2 栏点名的现状是"前端零通道",所以它需要一个自己的落点。
//
// 三条不能省的实现约束:
// ① 档位值域**只从 @ihui/types 取**(`REASONING_EFFORT_ORDER` / `ReasoningEffort`)。
//    端内写第二份 `['minimal','low',...]` 就是第五份档位表,而守门
//    scripts/check-model-capacity-parity.mjs 的 C5/C6 只盯四处已登记落点 ——
//    没登记的那一份漂开时不会有任何东西喊(本仓"新落点天然脱离尺子"同型)。
// ② 置灰判据只调 `reasoningEffortSelectable()`(唯一出口,区分"未知"与"明确不支持"):
//    capabilities 整体缺失 = 未知 ⇒ **不灰**;对象在位而 reasoning !== true ⇒ 灰 + 给原因。
//    这一条沿用 model-tier-utils.ts 的"宁可多显示也不误藏"既有语义。
// ③ 后端钉档回落必须**在这一轴上可见**(票第 8 栏点名的静默失效):
//    载体是已存在的 `done` 帧上新增的可选字段(见 api-client 的 ReasoningEffortNotice),
//    不新增 SSE 事件名 —— 新增事件要动契约两侧 + sse-parse + dispatch 台账,而那些文件
//    在本票之外(并行代理持有),半截接入就是给下游留断链。

'use client'

import { useTranslations } from 'next-intl'

import {
  REASONING_EFFORT_ORDER,
  type ReasoningEffort,
  reasoningEffortSelectable,
} from '@ihui/types'

/** done 帧携带的回落通知(与 @ihui/api-client 的 ReasoningEffortNotice 同形;
 *  这里只声明本组件实际读的三格,避免 web 反向依赖传输层)。 */
export interface ReasoningEffortFallbackNotice {
  requested?: ReasoningEffort | null
  effective?: ReasoningEffort | null
  fallback: boolean
  reason?: string
}

export interface ReasoningEffortAxisProps {
  /** 当前选定档位;undefined = 未选(后端按默认档处理) */
  value?: ReasoningEffort
  /** 选择回调;传 undefined 表示"清除选择,回到默认档" */
  onChange?: (next?: ReasoningEffort) => void
  /** 当前模型的语义能力(驱动置灰) */
  capabilities?: { reasoning?: boolean } | null
  /** 后端钉档回落通知;非空即必须在轴上看得见 */
  notice?: ReasoningEffortFallbackNotice | null
  disabled?: boolean
}

/** 档位 → chat 命名空间下的词表键(五语言同批,见 §19)。 */
const LABEL_KEY = {
  minimal: 'reasoningEffortMinimal',
  low: 'reasoningEffortLow',
  medium: 'reasoningEffortMedium',
  high: 'reasoningEffortHigh',
} as const satisfies Record<ReasoningEffort, string>

export function ReasoningEffortAxis({
  value,
  onChange,
  capabilities,
  notice,
  disabled,
}: ReasoningEffortAxisProps) {
  const t = useTranslations('chat')
  // 未知不误藏:capabilities 缺失 ⇒ 整轴可用;在位且 reasoning!==true ⇒ 逐档置灰并给原因
  const selectable = reasoningEffortSelectable(capabilities)

  return (
    <div
      className="flex flex-col gap-1 px-2 py-1.5"
      data-testid="reasoning-effort-axis"
      data-selectable={selectable ? 'true' : 'false'}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('reasoningEffortLabel')}</span>
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t('reasoningEffortLabel')}>
          {REASONING_EFFORT_ORDER.map((effort) => {
            const active = value === effort
            const blocked = !selectable
            return (
              <button
                key={effort}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={blocked || disabled === true}
                title={blocked ? t('reasoningEffortUnsupported') : undefined}
                data-testid={`reasoning-effort-${effort}`}
                data-disabled={blocked ? 'true' : 'false'}
                className={
                  'rounded-sm px-2 py-0.5 text-xs transition-colors ' +
                  (active
                    ? 'bg-cta font-medium text-cta-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent')
                }
                onClick={() => onChange?.(active ? undefined : effort)}
              >
                {t(LABEL_KEY[effort])}
              </button>
            )
          })}
        </div>
      </div>
      {/* 回落可见:后端把选定档位钉回时,轴上必须显式写出来 —— 静默降档是本票点名的病 */}
      {notice?.fallback ? (
        <p
          className="text-xs text-amber-600 dark:text-amber-400"
          data-testid="reasoning-effort-fallback"
          role="status"
        >
          {t('reasoningEffortFallback', {
            requested: notice.requested ?? '-',
            effective: notice.effective ?? '-',
          })}
        </p>
      ) : !selectable ? (
        <p className="text-xs text-muted-foreground" data-testid="reasoning-effort-unsupported">
          {t('reasoningEffortUnsupported')}
        </p>
      ) : null}
    </div>
  )
}

export default ReasoningEffortAxis
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
