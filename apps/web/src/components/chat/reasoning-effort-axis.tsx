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
import { ChevronDown, RefreshCw } from 'lucide-react'
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
  /**
   * 该模型**上游声明**的推理档位子集(2026-11-21 D136;来源 /llm/models 的
   * `reasoning_efforts`,ai-service 只认上游枚举与人工声明)。
   * 三态:未传 = 未声明(按通用四档呈现,不误藏);空数组 = 上游明确不支持;非空 = 只画这几档。
   */
  efforts?: ReasoningEffort[]
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

/** 头行小动作的共用基座(与工具栏图标按钮同档 24×24,不做第三套尺寸)。 */
const HEAD_ACTION_CLASS =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground ' +
  'transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40'

export function ReasoningEffortAxis({
  value,
  onChange,
  capabilities,
  notice,
  disabled,
  modelName,
  onRefreshModels,
  refreshingModels,
  efforts,
}: ReasoningEffortAxisProps) {
  const t = useTranslations('chat')
  // 未知不误藏:capabilities 缺失 ⇒ 整轴可用;在位且 reasoning!==true ⇒ 逐档置灰并给原因
  const selectable = reasoningEffortSelectable(capabilities)
  // 滑轨默认展开:档位是本卡片的正文,收起只留给"刚选完想省点高度"的场景
  const [expanded, setExpanded] = React.useState(true)

  // 该画哪几档(2026-11-21 D136):
  //  · `efforts` 未传 ⇒ 未声明。画通用四档(上游 OpenAI 兼容面覆盖最广的交集),扩展档
  //    (xhigh/max/ultra)仍可经 API 直写 —— 契约值域不动,只是不给"点了多半不生效"的旋钮;
  //  · `efforts: []` ⇒ 上游明确不支持(`support_thinking: false`),轴关掉并给原因;
  //  · 非空 ⇒ 只画该模型**真能切**的那几档,可能少于四档,也可能多到七档(上游真支持时)。
  // 顺序一律取契约层 `REASONING_EFFORT_ORDER` 过滤,端内不另排第二份序。
  const tiers = React.useMemo<readonly ReasoningEffort[]>(
    () =>
      efforts === undefined
        ? REASONING_EFFORT_ORDER.slice(0, 4)
        : REASONING_EFFORT_ORDER.filter((tier) => efforts.includes(tier)),
    [efforts],
  )
  const activeIndex = value ? tiers.indexOf(value) : -1
  /** 已选档位不在该模型支持集内(换模型后的遗留值):不画滑块,并显式说明会被调整 */
  const outsideLevels = value !== undefined && activeIndex < 0
  const railDisabled = !selectable || tiers.length === 0
  /** 只有一档时没有"切换"这件事,轨道不画(留头行胶囊即可) */
  const showRail = expanded && tiers.length > 1

  /** 第 i 档在轨道上的百分比位置(首档压左端、末档压右端) */
  const percentOf = (index: number) => (tiers.length > 1 ? (index / (tiers.length - 1)) * 100 : 100)

  /** 键盘左右切换(radiogroup 的常规约定;未选档时从端点起步) */
  const moveByKeyboard = (delta: 1 | -1) => {
    if (!onChange || railDisabled || tiers.length === 0) return
    const from = activeIndex >= 0 ? activeIndex : delta > 0 ? -1 : tiers.length
    const next = Math.min(tiers.length - 1, Math.max(0, from + delta))
    onChange(tiers[next])
  }

  return (
    <div
      className="rounded-lg border border-stroke-subtle bg-card px-3 py-2.5 transition-colors"
      data-testid="reasoning-effort-axis"
      data-selectable={selectable && tiers.length > 0 ? 'true' : 'false'}
      data-declared={efforts !== undefined ? 'true' : 'false'}
    >
      {/* 头行(用户附图样式):模型名 · 当前档位(品牌紫胶囊) · 折叠 · 刷新模型列表 */}
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-body font-medium">
          {modelName ?? t('reasoningEffortLabel')}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-label font-semibold leading-none transition-colors',
            value
              ? 'bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300'
              : 'bg-muted text-muted-foreground',
          )}
          data-testid="reasoning-effort-current"
          data-outside-levels={outsideLevels ? 'true' : undefined}
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
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
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

      {showRail && (
        <div className="mt-2 px-3">
          <div
            className={cn(
              'relative h-5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60',
              railDisabled && 'opacity-60',
            )}
            role="radiogroup"
            tabIndex={0}
            aria-label={t('reasoningEffortLabel')}
            data-testid="reasoning-effort-track"
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                moveByKeyboard(1)
                return
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                moveByKeyboard(-1)
                return
              }
              if ((event.key === 'Home' || event.key === 'End') && onChange && !railDisabled) {
                event.preventDefault()
                onChange(event.key === 'Home' ? tiers[0] : tiers[tiers.length - 1])
              }
            }}
          >
            {/* 贯通紫轨道(参考样式:整条常亮,不是进度条);内阴影让它像一条实体滑轨 */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 rounded-full bg-violet-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]"
            />
            {/* 档位坐标层:左右各缩进 16px,让首末两档的圆点/滑块落在胶囊内部,
                不被两端的半圆端头吃掉,也给 18px 滑块留出呼吸位(参考图里首末点也是内缩的) */}
            <div className="absolute inset-y-0 left-4 right-4">
              {/* 档位圆点:每档一枚,当前档被白色滑块盖住 */}
              {tiers.map((effort, index) => (
                <span
                  key={`dot-${effort}`}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60"
                  style={{ left: `${percentOf(index)}%` }}
                />
              ))}
              {/* 当前档滑块:未选档时不画(不给一个假装选中的位置);移动带过渡 */}
              {activeIndex >= 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)] ring-1 ring-black/10 transition-[left] duration-200 ease-out"
                  style={{ left: `${percentOf(activeIndex)}%` }}
                  data-testid="reasoning-effort-knob"
                />
              )}
              {/* 每档一枚透明点击热区:选中/再点清除(既有语义,判据钉着这一条) */}
              {tiers.map((effort, index) => {
                const active = value === effort
                const blocked = railDisabled || disabled === true
                return (
                  <button
                    key={effort}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t(LABEL_KEY[effort])}
                    disabled={blocked}
                    data-testid={`reasoning-effort-${effort}`}
                    data-disabled={railDisabled ? 'true' : 'false'}
                    onClick={() => onChange?.(active ? undefined : effort)}
                    className={cn(
                      'absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/10',
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
          className="mt-1.5 text-label text-amber-600 dark:text-amber-400"
          data-testid="reasoning-effort-fallback"
          role="status"
        >
          {t('reasoningEffortFallback', {
            requested: notice.requested ?? '-',
            effective: notice.effective ?? '-',
          })}
        </p>
      ) : railDisabled ? (
        <p
          className="mt-1.5 text-label text-muted-foreground"
          data-testid="reasoning-effort-unsupported"
        >
          {t('reasoningEffortUnsupported')}
        </p>
      ) : outsideLevels ? (
        <p
          className="mt-1.5 text-label text-muted-foreground"
          data-testid="reasoning-effort-outside-levels"
        >
          {t('reasoningEffortFallback', {
            requested: value ? t(LABEL_KEY[value]) : '-',
            effective: t('reasoningEffortDefault'),
          })}
        </p>
      ) : null}
    </div>
  )
}

export default ReasoningEffortAxis
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
