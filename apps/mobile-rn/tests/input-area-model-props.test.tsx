// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// InputArea 模型按钮族(票:HomeScreen 已在传 onOpenModelSelect / selectedModelName /
// onClearModel / onOpenModelConfig 四枚 props,而组件没有这四处声明 ⇒ tsc TS2322、CI 必需作业红)。
//
// 本套件钉的是**装车后的行为**,不是类型:
//  ① 四枚 props 全可选 ⇒ 一枚都不传时,渲染结果必须与补这一族之前逐字一致(用 innerHTML 等值证);
//  ② 按钮真的把点击接到调用方回调上(变异自证:把 onPress 换成空函数,② 这一条当场翻红);
//  ③ 排在「+」之前(HomeScreen 定的序:展开钮 → 模型 → 「+」→ 发送);
//  ④ 样式契约走单一源头:圆角取 chip 档、描边取中性档(墨档描边违反 AGENTS §4),图标必须是矢量;
//  ⑤ 组件内文案一律取 t()(chat.modelAuto / selectModel / clearModel / modelConfig),端内零第二份
//     字面量 ⇒ 渲染必须挂 I18nProvider(useI18n 在 Provider 外即抛,同 use-ui-text-field 那条的处置)。
// 下面的 TEXT 是 zh-CN 词表现值(测试文件按 §19 的口径允许写中文用例串;词表改了本套件会红,
// 这是有意的:界面文案变了必须由改文案的人同时更新取证)。
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, within } from '@testing-library/react'

import { InputArea, type InputAreaProps } from '../src/components/InputArea'
import { I18nProvider } from '../src/i18n'
import { tokens } from '../src/theme/active-tokens'
import { rnRadiusFor } from '@ihui/design-tokens'

/** 大输入框态的最小真实调用形参(与 HomeScreen 那段同形:showVoiceMic + 不传折叠) */
const BASE: InputAreaProps = {
  value: '',
  onChangeText: () => {},
  placeholder: '请输入您的问题,或长按说话',
  onSubmit: () => {},
  showVoiceMic: true,
}

const TEXT = { auto: '自动', select: '选择模型', clear: '清除模型', config: '模型配置' } as const

function renderArea(extra: Partial<InputAreaProps>) {
  return render(
    <I18nProvider>
      <InputArea {...BASE} {...extra} />
    </I18nProvider>,
  )
}

/** RN 替身把 accessibilityRole/accessibilityLabel **原样落到 DOM 属性**(不是真 ARIA role),
 *  所以图标钮这种"无文字"的控件只能按属性取,不能 getByRole。 */
function buttonByLabel(container: HTMLElement, label: string): HTMLElement | undefined {
  for (const el of container.querySelectorAll('button')) {
    if (el.getAttribute('accessibilityLabel') === label) return el as HTMLElement
  }
  return undefined
}

function mustButton(container: HTMLElement, label: string): HTMLElement {
  const el = buttonByLabel(container, label)
  if (!el) throw new Error(`缺 accessibilityLabel="${label}" 的按钮(本用例要求它存在)`)
  return el
}

function mustButtonOf(node: Element | null): HTMLElement {
  if (!node) throw new Error('模型文案没有落在可点控件里(.closest("button") 取到空)')
  return node as HTMLElement
}

/** jsdom 把 style 里的颜色序列化成 rgb(...)。归一化只用浏览器自己那套换算(两边同走一次),
 *  绝不在测试里另抄一份色值表 —— 那就是 §22c 禁的第二份真相。 */
function cssColor(value: string): string {
  const probe = document.createElement('div')
  probe.style.color = value
  return probe.style.color
}

describe('InputArea 模型按钮族', () => {
  it('四枚 props 一枚都不传时:整族不渲染,且 DOM 与"显式传 undefined"逐字节相同', () => {
    const absent = renderArea({})
    const undef = renderArea({
      onOpenModelSelect: undefined,
      selectedModelName: undefined,
      onClearModel: undefined,
      onOpenModelConfig: undefined,
    })
    expect(undef.container.innerHTML).toBe(absent.container.innerHTML)
    // 本族三枚控件一律不存在(旧行为零回归)。查询必须锁在自己的 container 上 ——
    // RTL 的 queryByText 默认打 document.body,同一条里两次 render 会互相串台。
    expect(within(absent.container).queryByText(TEXT.auto)).toBeNull()
    expect(buttonByLabel(absent.container, TEXT.select)).toBeUndefined()
    expect(buttonByLabel(absent.container, TEXT.clear)).toBeUndefined()
    expect(buttonByLabel(absent.container, TEXT.config)).toBeUndefined()
  })

  it('只传 selectedModelName 而不传任何回调时仍然不渲染(新能力必须显式开启)', () => {
    const { container } = renderArea({ selectedModelName: 'GLM-5.2' })
    expect(within(container).queryByText('GLM-5.2')).toBeNull()
    expect(buttonByLabel(container, TEXT.select)).toBeUndefined()
  })

  it('传 onOpenModelSelect:未选模型显示「自动」,点击把它交给调用方(点击必须有回调证据)', () => {
    const onOpenModelSelect = vi.fn()
    const { container } = renderArea({ onOpenModelSelect })
    const label = within(container).getByText(TEXT.auto)
    fireEvent.click(mustButtonOf(label.closest('button')))
    expect(onOpenModelSelect).toHaveBeenCalledTimes(1)
  })

  it('selectedModelName 非空:显示模型名而非「自动」,并给出"已选"的可见状态档', () => {
    const { container } = renderArea({
      onOpenModelSelect: () => {},
      selectedModelName: 'GLM-5.2',
    })
    expect(within(container).queryByText(TEXT.auto)).toBeNull()
    const name = within(container).getByText('GLM-5.2')
    expect(mustButtonOf(name.closest('button'))).toBeDefined()
    // 已选 = 主文字档,未选(下一条)= 次要文字档:两态必须看得出区别
    expect(name.style.color).toBe(cssColor(tokens.text.primary))
  })

  it('未选态文字取次要档(与上一条成对,证明这处状态区别不是巧合)', () => {
    const { container } = renderArea({ onOpenModelSelect: () => {} })
    const auto = within(container).getByText(TEXT.auto)
    expect(auto.style.color).toBe(cssColor(tokens.text.secondary))
  })

  it('清除钮:onClearModel 且"已有所选"才出现,点击调 onClearModel;「自动」态没有可清除对象', () => {
    const onClearModel = vi.fn()
    const auto = renderArea({ onOpenModelSelect: () => {}, onClearModel })
    expect(buttonByLabel(auto.container, TEXT.clear)).toBeUndefined()

    const picked = renderArea({
      onOpenModelSelect: () => {},
      onClearModel,
      selectedModelName: 'Kimi-K3',
    })
    fireEvent.click(mustButton(picked.container, TEXT.clear))
    expect(onClearModel).toHaveBeenCalledTimes(1)
    // 「自动」那一版里没有这枚钮:存在性由"已有所选"决定,不是常驻
    expect(within(auto.container).queryByText('Kimi-K3')).toBeNull()
  })

  it('配置钮:onOpenModelConfig 传入才出现,点击调 onOpenModelConfig;不传则整枚不出现', () => {
    const onOpenModelConfig = vi.fn()
    const withConfig = renderArea({
      onOpenModelSelect: () => {},
      onOpenModelConfig,
      selectedModelName: 'GLM-5.2',
    })
    fireEvent.click(mustButton(withConfig.container, TEXT.config))
    expect(onOpenModelConfig).toHaveBeenCalledTimes(1)

    const withoutConfig = renderArea({ onOpenModelSelect: () => {} })
    expect(buttonByLabel(withoutConfig.container, TEXT.config)).toBeUndefined()
  })

  it('顺序契约:模型钮排在「+」(PlusButton)之前,两者同在大输入框 chrome 行内', () => {
    const { container } = renderArea({ onPlusToggle: () => {}, onOpenModelSelect: () => {} })
    const chip = mustButton(container, TEXT.select)
    const plus = mustButton(container, '展开面板')
    // plus 跟随 chip ⇒ chip 排在「+」之前
    expect(chip.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('样式契约:圆角取 chip 档(rnRadiusFor.chip),描边取中性档且不取墨档,图标是矢量 SVG', () => {
    const { container } = renderArea({ onOpenModelSelect: () => {} })
    const chip = mustButton(container, TEXT.select)
    // RN 替身把 style 摊平成 DOM style;React 给非 unitless 数值补 px
    expect(chip.style.borderRadius).toBe(`${rnRadiusFor.chip}px`)
    expect(chip.style.borderColor).toBe(cssColor(tokens.border.light))
    // 墨档禁入描边(AGENTS §4「描边不得取墨档」)
    for (const ink of [tokens.brand.DEFAULT, tokens.brand.foreground, tokens.text.primary]) {
      expect(chip.style.borderColor).not.toBe(cssColor(ink))
    }
    // 图标必须是 lucide 矢量组件,不得 emoji / 字符当图标
    expect(chip.querySelector('svg')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
