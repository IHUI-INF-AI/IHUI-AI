// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 验证码弹层的键盘避让锁(2026-10-31 立)。
 *
 * 成因:本屏的输入是一枚隐藏接收器(1×1、opacity 0 —— 见组件内注释),真正给用户看的是
 * 上方 6 个码格。弹层里此前没有任何避让层 ⇒ 键盘弹起正好盖住那 6 格,
 * 用户看不见自己打到第几位,只能凭感觉填。
 *
 * 三条用例:① 渲染归属(码区必须住在避让层之内,不是"层存在即可");
 * ② visible=false 时整层不渲 —— 它是 ① 的反向对照,证明 ① 不是恒真;
 * ③ 形状尺 + 缺陷形态复跑:避让层必须落在 <Modal … </Modal> 之间(RN Modal 是独立原生窗,
 *    挂在它外面的避让层对弹层里的输入无效)。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { VerifyCodeModal } from '../src/components/VerifyCodeModal'

vi.mock('../src/theme/active-tokens', async () => {
  const { rnLightTokens } = await import('@ihui/design-tokens')
  return { tokens: rnLightTokens }
})
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

// vitest 下 import.meta.url 不是 file: 协议 ⇒ 与同端既有测试一致走 __dirname 定位
const SRC = readFileSync(resolve(__dirname, '../src/components/VerifyCodeModal.tsx'), 'utf8')

/**
 * 形状尺:避让层开标签是否落在 <Modal … </Modal> 之间。
 * 匹配带标识符边界(`[\s/>]`),否则 `<KeyboardAvoidingViewX` 这种同名前缀标签会被当成命中 ——
 * 写这条夹具时实测踩过:改名造出来的"坏形态"其实没坏,假阳来自尺子而不是代码。
 */
function avoidInsideModal(text: string): boolean {
  const open = text.indexOf('<Modal')
  const close = text.indexOf('</Modal>')
  const avoid = text.search(/<KeyboardAvoidingView[\s/>]/)
  if (open < 0 || close < 0 || avoid < 0) return false
  return avoid > open && avoid < close
}

function renderModal(visible: boolean) {
  return render(
    <VerifyCodeModal
      visible={visible}
      phone="13800000000"
      onClose={() => {}}
      onSubmit={() => {}}
      onResend={() => {}}
    />,
  )
}

describe('VerifyCodeModal 键盘避让层', () => {
  it('避让层在位,且提示文案与手机号住在它之内', () => {
    const { container } = renderModal(true)
    const avoid = container.querySelector('[data-role="keyboard-avoiding"]')
    expect(avoid).not.toBeNull()
    expect(avoid?.textContent).toContain('verify.getCode')
    expect(avoid?.textContent).toContain('13800000000')
  })

  it('反向对照:visible=false 时整层不渲(证明上一条不是恒真)', () => {
    const { container } = renderModal(false)
    expect(container.querySelector('[data-role="keyboard-avoiding"]')).toBeNull()
  })

  it('避让层住在 <Modal> 内部,且同一把尺喂坏形态必须判不过', () => {
    expect(avoidInsideModal(SRC)).toBe(true)
    // 坏形态一:避让层在 </Modal> 之后(对 RN 独立原生窗无效)
    expect(avoidInsideModal('<Modal><View/></Modal><KeyboardAvoidingView />')).toBe(false)
    // 坏形态二:根本没有避让层 —— 不能被读成"检查过且干净"
    expect(avoidInsideModal('<Modal><View/></Modal>')).toBe(false)
    // 边界对照:同名前缀的别的标签不算命中(尺子若用裸 indexOf 这一条会假绿)
    expect(avoidInsideModal('<Modal><KeyboardAvoidingViewX /></Modal>')).toBe(false)
    // 正向对照:同一条尺必须先能认好形态,否则上面三条都是空过
    expect(avoidInsideModal('<Modal><KeyboardAvoidingView>hi</KeyboardAvoidingView></Modal>')).toBe(
      true,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
