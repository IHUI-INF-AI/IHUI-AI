// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 操控桥:控件组件把"写入 / 触发"通道交给宿主注册表。
 *
 * 为什么走 globalThis 而不是 import:注册表本体住在 app 端
 * (`apps/mobile-rn/src/lib/ui-field-registry.ts`,它要读 react-navigation 的当前屏名),
 * 而 `@ihui/ui-native` 是下层包,**不得**反向依赖 app(AGENTS §3 包边界)。
 * 于是宿主在 module load 时把 `{ register }` 挂到约定键上,组件侧用**局部结构类型**读取:
 * 拿不到宿主(其他消费方、SSR、未接入桥接的端)就返回 null,组件照常渲染。
 *
 * 键名字面量必须与端内 `RN_FIELD_HOST_GLOBAL_KEY` 一致 —— 漂移的后果是"组件静默不注册",
 * 所以由 ui-native 侧测试直接断言同一个字符串(见 mobile-rn/tests/ui-field-registry.test.ts)。
 */

export type UiFieldKind = 'input' | 'button' | 'form'

/** 与端内 RnFieldSpec 结构同形;全部读值走访问器,快照拿到的永远是"当下" */
export interface UiFieldSpec {
  kind: UiFieldKind
  label(): string
  group?(): string
  value?(): string | undefined
  disabled?(): boolean
  constraint?(): string
  sensitive?(): boolean
  writable?(): boolean
  write?(text: string): void
  press?(): void
  submit?(): void
}

export interface UiFieldHandle {
  readonly id: string
  dispose(): void
}

const FIELD_HOST_KEY = '__IHUI_RN_UI_FIELD_REGISTRY__'

interface GlobalWithFieldHost {
  __IHUI_RN_UI_FIELD_REGISTRY__?: {
    register(spec: UiFieldSpec): UiFieldHandle | null
  }
}

/** 宿主未就位时返回 null:调用方按"没有这个能力"继续渲染,不抛错也不假装注册成功 */
export function registerUiField(spec: UiFieldSpec): UiFieldHandle | null {
  const host = (globalThis as GlobalWithFieldHost)[FIELD_HOST_KEY]
  if (!host || typeof host.register !== 'function') return null
  return host.register(spec)
}

/** 供测试与排查用:确认桥是否接上了 */
export function hasUiFieldHost(): boolean {
  return typeof (globalThis as GlobalWithFieldHost)[FIELD_HOST_KEY]?.register === 'function'
}
