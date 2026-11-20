// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 推理强度档位轴(D130,2026-09-30 立;2026-11-20 用户定档重做视觉)—— 对话输入区的"第三轴"。
//
// 为什么不藏进模型弹层的采样面板:采样面板(sampling-params-panel)是**数值**抽屉
// (temperature/top_p/top_k/max_tokens),而推理强度是**离散档位**,两者语义不同轴;
// 票第 2 栏点名的现状是"前端零通道",所以它需要一个自己的落点。
//
// 2026-11-20 用户指令(附图):档位控件改成一枚独立卡片 —— 头行"模型名 + 当前档位(品牌紫)
// + 折叠箭头 + 恢复默认",下行一条贯通紫色滑轨、每个档位一枚小圆点、当前档位落在白色滑块上;
// 同时整枚卡片从模型弹层**底栏**上移到弹层**顶部**(见 model-selector 的 header 段)。
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

import * as React from 'react'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  REASONING_EFFORT_ORDER,
  type ReasoningEffort,
  reasoningEffortSelectable,
} from '@ihui/types'

import { Tooltip, TooltipProvider } from '@/components/feedback'
import { cn } from '@/lib/utils'

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
  /** 卡片头行左侧的当前模型名(2026-11-20 用户附图样式);缺省回退到轴标题 */
  modelName?: string
  /** 卡片头行右侧那枚圆钮 = 刷新模型列表(2026-11-21 用户定档:原「恢复默认」撤掉,
   *  把弹层里独立的「刷新模型列表」行移植到这里);缺省则不渲染该钮 */
  onRefreshModels?: () => void
  /** 刷新进行中(钮转圈并置灰,与弹层原行同一姿态) */
  refreshingModels?: boolean
}

/** 档位 → chat 命名空间下的词表键(五语言同批,见 §19)。 */
const LABEL_KEY = {
  minimal: 'reasoningEffortMinimal',
  low: 'reasoningEffortLow',
  medium: 'reasoningEffortMedium',
  high: 'reasoningEffortHigh',
  xhigh: 'reasoningEffortXhigh',
  max: 'reasoningEffortMax',
  ultra: 'reasoningEffortUltra',
} as const satisfies Record<ReasoningEffort, string>

/** 头行右侧两个小动作的共用基座(与工具栏图标按钮同档 24×20,不做第三套尺寸)。 */
const HEAD_ACTION_CLASS =
  'inline-flex h-6 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground ' +
  'transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none ' +
  'focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40'

export function ReasoningEffortAxis({
  value,
  onChange,
  capabilities,
  notice,
  disabled,
  modelName,
  onRefreshModels,
  refreshingModels,
}: ReasoningEffortAxisProps) {
  const t = useTranslations('chat')
  // 未知不误藏:capabilities 缺失 ⇒ 整轴可用;在位且 reasoning!==true ⇒ 逐档置灰并给原因
  const selectable = reasoningEffortSelectable(capabilities)
  // 滑轨默认展开:档位是本卡片的正文,收起只留给"刚选完想省点高度"的场景
  const [expanded, setExpanded] = React.useState(true)

  // 档位序仍只取契约层那一份(REASONING_EFFORT_ORDER),端内不另排一份;
  // 但**只呈现上游真能切换的那几档**(2026-11-21 用户质疑"上游有这么多档吗"):
  // 契约层 wire 值域是 7 档(与 ai-service known_efforts 逐名等值),其中 xhigh/max/ultra
  // 属扩展档 —— 主流网关只认 minimal/low/medium/high,点上去也是被后端钉回,属于"给用户
  // 一个点了不生效的旋钮"。所以滑轨只画前四档,扩展档仍可经 API 直写(显示时照常出档位名)。
  const tiers = REASONING_EFFORT_ORDER.slice(0, 4)
  const activeIndex = value ? tiers.indexOf(value) : -1
  /** 第 i 档在轨道上的百分比位置(首档压左端、末档压右端,两端各留 10px 给滑块出头) */
  const percentOf = (index: number) => (tiers.length > 1 ? (index / (tiers.length - 1)) * 100 : 100)

  return (
    <div
      className="rounded-lg border border-stroke-subtle bg-card px-2 py-1.5"
      data-testid="reasoning-effort-axis"
      data-selectable={selectable ? 'true' : 'false'}
    >
      {/* 头行(用户附图样式):模型名 · 当前档位(品牌紫) · 折叠 · 刷新模型列表 */}
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-body font-medium">
          {modelName ?? t('reasoningEffortLabel')}
        </span>
        <span
          className={cn(
            'shrink-0 text-label font-semibold',
            value ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground',
          )}
          data-testid="reasoning-effort-current"
        >
          {value ? t(LABEL_KEY[value]) : t('reasoningEffortDefault')}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={t('reasoningEffortLabel')}
          data-testid="reasoning-effort-toggle"
          className={HEAD_ACTION_CLASS}
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {/* 本件是独立可挂的展示件(单测裸渲染、弹层内也自成一体):自带 Provider,
            不依赖宿主的 Tooltip 上下文 —— 缺了它 Radix 会当场抛"must be used within
            TooltipProvider",而这条在真机(Host 有全局 Provider)反而不复现。 */}
        {onRefreshModels ? (
          <TooltipProvider>
            <Tooltip content={refreshingModels ? t('modelRefreshRunning') : t('modelRefresh')}>
              <button
                type="button"
                onClick={onRefreshModels}
                disabled={disabled === true || refreshingModels === true}
                aria-label={refreshingModels ? t('modelRefreshRunning') : t('modelRefresh')}
                data-testid="reasoning-effort-refresh-models"
                className={HEAD_ACTION_CLASS}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshingModels && 'animate-spin')} />
              </button>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      {expanded && (
        <div className="mt-1.5 px-3 pb-0.5">
          <div
            className="relative h-5"
            role="radiogroup"
            aria-label={t('reasoningEffortLabel')}
            data-testid="reasoning-effort-track"
          >
            {/* 贯通紫轨道(参考样式:整条常亮,不是进度条) */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-violet-500"
            />
            {/* 档位坐标层:左右各缩进 12px,让首末两档的圆点/滑块落在胶囊内部,
                不被两端的半圆端头吃掉(参考图里首末点也是内缩的);滑块半径 10px < 12px */}
            <div className="absolute inset-y-0 left-3 right-3">
              {/* 档位圆点:每档一枚,当前档被白色滑块盖住 */}
              {tiers.map((effort, index) => (
                <span
                  key={`dot-${effort}`}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45"
                  style={{ left: `${percentOf(index)}%` }}
                />
              ))}
              {/* 当前档滑块:未选档时不画(不给一个假装选中的位置) */}
              {activeIndex >= 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm ring-1 ring-black/5"
                  style={{ left: `${percentOf(activeIndex)}%` }}
                  data-testid="reasoning-effort-knob"
                />
              )}
              {/* 每档一枚透明点击热区:选中/再点清除(既有语义,判据钉着这一条) */}
              {tiers.map((effort, index) => {
                const active = value === effort
                const blocked = !selectable
                return (
                  <button
                    key={effort}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t(LABEL_KEY[effort])}
                    disabled={blocked || disabled === true}
                    data-testid={`reasoning-effort-${effort}`}
                    data-disabled={blocked ? 'true' : 'false'}
                    onClick={() => onChange?.(active ? undefined : effort)}
                    className={cn(
                      'absolute top-0 h-5 w-5 -translate-x-1/2 rounded-sm',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      blocked || disabled === true
                        ? 'cursor-not-allowed'
                        : 'cursor-pointer hover:bg-foreground/5',
                    )}
                    style={{ left: `${percentOf(index)}%` }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 回落可见:后端把选定档位钉回时,轴上必须显式写出来 —— 静默降档是本票点名的病 */}
      {notice?.fallback ? (
        <p
          className="mt-1 text-label text-amber-600 dark:text-amber-400"
          data-testid="reasoning-effort-fallback"
          role="status"
        >
          {t('reasoningEffortFallback', {
            requested: notice.requested ?? '-',
            effective: notice.effective ?? '-',
          })}
        </p>
      ) : !selectable ? (
        <p
          className="mt-1 text-label text-muted-foreground"
          data-testid="reasoning-effort-unsupported"
        >
          {t('reasoningEffortUnsupported')}
        </p>
      ) : null}
    </div>
  )
}

export default ReasoningEffortAxis
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
