// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 8 条单端槽位裁决落锁:
 *  - ChangePwd inputMaxLength:RN 与小程序都有密码输入框能力,RN 未接 20 上限 ⇒ 真下沉为 20;
 *  - ChangePwd errorVisibility:共享屏默认 'on-change',小程序显式传同值 ⇒ 仅显式默认值,
 *    RN 必须继续依赖默认(不伪造显式传参)。
 * 阴性对照:摘掉 inputMaxLength={MAX_PWD_LEN} ⇒ 首条断言必红;
 * 给 RN 补 errorVisibility="on-change" ⇒ 第二条断言必红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { render, waitFor } from '@testing-library/react'

const captured = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app', () => ({
  ChangePwdScreen: (props: Record<string, unknown>) => {
    captured.props = props
    return createElement('div', { 'data-testid': 'shared-change-pwd' })
  },
}))

vi.mock('@ihui/api-client', () => ({ updatePassword: vi.fn() }))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn(), navigate: vi.fn() }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ locale: 'zh-CN', t: (key: string) => key }),
}))
vi.mock('../src/host/use-host-ports', () => ({
  useHostPorts: () => ({ onNavigate: vi.fn(), onToast: vi.fn() }),
}))
vi.mock('../src/components/BottomPops', () => ({ appAlert: vi.fn() }))

import ChangePwdScreen from '../src/screens/ChangePwdScreen'

describe('RN ChangePwdScreen 8 条裁决落锁', () => {
  beforeEach(() => {
    captured.props = null
  })

  it('inputMaxLength 真下沉为 20', async () => {
    render(createElement(ChangePwdScreen))
    await waitFor(() => expect(captured.props).not.toBeNull())
    expect(captured.props?.inputMaxLength).toBe(20)
  })

  it('errorVisibility 不伪造显式默认值(保持依赖共享屏默认 on-change)', async () => {
    render(createElement(ChangePwdScreen))
    await waitFor(() => expect(captured.props).not.toBeNull())
    expect(captured.props?.errorVisibility).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
