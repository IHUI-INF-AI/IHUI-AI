// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 79 号票「权限双轴化 · 前端接线」本席判据(2026-10-25 立):
//   ① 选值后下发的 payload 含两轴 —— 值取 @ihui/types 的成员常量,不抄字面量;
//   ② 未选 / 清空 ⇒ 一条双轴字段都不发(缺省留给后端裁决器);
//   ③ 刷新后从 localStorage 恢复 —— 真跑生产 hook + 真控件,不是只测纯函数;
//   ④ 值域来自单一真源 —— 真源增删成员,控件跟着变(用导入的常量断言)。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ReactNode } from 'react'

import { NextIntlClientProvider } from 'next-intl'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  APPROVAL_POLICIES,
  APPROVAL_PRESETS,
  APPROVAL_PRESET_IDS,
  SANDBOX_MODES,
  type AxisPair,
} from '@ihui/types'

import { useAiPanelStore } from '@/stores/ai-panel'
import { effectiveAxisPair, resolveRequestAxes } from '@/lib/permission-axes'
import {
  PERMISSION_AXES_STORAGE_KEY,
  readStoredPermissionAxes,
  usePermissionAxesPersistence,
  writeStoredPermissionAxes,
} from '@/lib/permission-axes-prefs'
import { PermissionAxesPicker } from '../permission-axes-picker'

const messages = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json'), 'utf-8'),
) as { chat: { permission: Record<string, string> } }

function renderWith(children: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="zh-CN"
      messages={{ chat: { permission: messages.chat.permission } }}
    >
      {children}
    </NextIntlClientProvider>,
  )
}

/** 生产挂载点(PermissionModePopover)里那一次接线,这里原样复用同一个 hook */
function PickerWithPersistence() {
  usePermissionAxesPersistence()
  return <PermissionAxesPicker />
}

/** 从契约成员集里取两个"非默认"档,避免测试自己抄字面量。 */
function contractPair(): AxisPair {
  return {
    sandboxMode: SANDBOX_MODES[SANDBOX_MODES.length - 1]!,
    approvalPolicy: APPROVAL_POLICIES[APPROVAL_POLICIES.length - 1]!,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  useAiPanelStore.setState({
    permissionAxes: null,
    activeWorkspace: null,
    pendingPermissionMode: null,
  })
})

afterEach(cleanup)

describe('79 双轴前端接线 · 值域单一真源', () => {
  it('两个选择器的档位清单逐字来自 @ihui/types(SANDBOX_MODES × APPROVAL_POLICIES)', () => {
    renderWith(<PermissionAxesPicker />)
    for (const sandbox of SANDBOX_MODES) {
      expect(screen.getByTestId(`permission-axes-sandbox-${sandbox}`)).toBeTruthy()
    }
    for (const policy of APPROVAL_POLICIES) {
      expect(screen.getByTestId(`permission-axes-approval-${policy}`)).toBeTruthy()
    }
    // 两端一起:真源加一档,控件就多一个可点档位,不需要改这个断言
    expect(screen.getAllByRole('radio')).toHaveLength(
      SANDBOX_MODES.length + APPROVAL_POLICIES.length,
    )
  })
})

describe('79 双轴前端接线 · 选值随请求下发', () => {
  it('分别选两轴 ⇒ store 落一对契约值,请求 payload 含 sandboxMode/approvalPolicy', () => {
    renderWith(<PermissionAxesPicker />)
    const expected = contractPair()
    fireEvent.click(screen.getByTestId(`permission-axes-sandbox-${expected.sandboxMode}`))
    fireEvent.click(screen.getByTestId(`permission-axes-approval-${expected.approvalPolicy}`))

    const axes = useAiPanelStore.getState().permissionAxes
    expect(axes).toEqual(expected)
    // 发流侧唯一取值实现产出的就是这两个 camel 字段
    expect(resolveRequestAxes(axes, 'default')).toEqual(expected)

    // 装上没装车 = 没有:宿主确实把这份产出 spread 进 streamChat 的参数
    const sendMessage = readFileSync(
      resolve(process.cwd(), 'src/hooks/use-chat/send-message.ts'),
      'utf-8',
    )
    expect(sendMessage).toContain('resolveRequestAxes(')
    expect(sendMessage).toContain('...currentAxes,')

    // 预设按钮的值同样直接取契约对象本身
    const presetId = APPROVAL_PRESET_IDS[APPROVAL_PRESET_IDS.length - 1]!
    fireEvent.click(screen.getByTestId(`permission-axes-preset-${presetId}`))
    expect(useAiPanelStore.getState().permissionAxes).toEqual(APPROVAL_PRESETS[presetId])
  })
})

describe('79 双轴前端接线 · 缺省不下发', () => {
  it('清空(跟随单轴)⇒ store 回 null、本机记忆被清掉、请求里一条双轴字段都不发', () => {
    renderWith(<PickerWithPersistence />)
    fireEvent.click(screen.getByTestId(`permission-axes-sandbox-${contractPair().sandboxMode}`))
    expect(useAiPanelStore.getState().permissionAxes).not.toBeNull()

    fireEvent.click(screen.getByTestId('permission-axes-follow'))
    expect(useAiPanelStore.getState().permissionAxes).toBeNull()
    // 缺省由服务端"两轴都缺省才接管"决定,前端不钉默认
    expect(resolveRequestAxes(null, 'bypass-permissions')).toEqual({})
    // 展示侧仍按契约映射显示"后端将采用的档位",不假装没设置
    expect(effectiveAxisPair(null, 'bypass-permissions')).toEqual(APPROVAL_PRESETS.fullAccess)
    // 清空即 removeItem:旧授权档不得在下次冷启动复活
    expect(window.localStorage.getItem(PERMISSION_AXES_STORAGE_KEY)).toBeNull()
  })
})

describe('79 双轴前端接线 · 刷新后恢复', () => {
  it('冷启动读回本机记忆(真 hook + 真控件),改选后写回同一键', async () => {
    // 键名沿用仓内 ihui_ 前缀风格
    expect(PERMISSION_AXES_STORAGE_KEY).toMatch(/^ihui_[a-z_]+$/)

    const remembered = contractPair()
    writeStoredPermissionAxes(remembered)
    expect(readStoredPermissionAxes()).toEqual(remembered)

    renderWith(<PickerWithPersistence />)
    await waitFor(() => expect(useAiPanelStore.getState().permissionAxes).toEqual(remembered))
    expect(
      screen
        .getByTestId(`permission-axes-sandbox-${remembered.sandboxMode}`)
        .getAttribute('aria-checked'),
    ).toBe('true')

    // 改选沙箱另一档 ⇒ 记忆同步更新(写穿),下次刷新恢复到新的一对
    const nextSandbox = SANDBOX_MODES.find((mode) => mode !== remembered.sandboxMode)!
    fireEvent.click(screen.getByTestId(`permission-axes-sandbox-${nextSandbox}`))
    await waitFor(() =>
      expect(readStoredPermissionAxes()).toEqual({
        sandboxMode: nextSandbox,
        approvalPolicy: remembered.approvalPolicy,
      }),
    )

    // 真挂载点在常驻的权限弹层上(否则刷新后没人读回,记忆只是摆设)
    const popover = readFileSync(
      resolve(process.cwd(), 'src/components/ai/permission-mode-popover.tsx'),
      'utf-8',
    )
    expect(popover).toContain('usePermissionAxesPersistence()')
  })

  it('存储漂移(半对 / 坏 JSON / 认不出)一律不恢复,不猜档', () => {
    window.localStorage.setItem(
      PERMISSION_AXES_STORAGE_KEY,
      JSON.stringify({ sandboxMode: SANDBOX_MODES[0] }),
    )
    expect(readStoredPermissionAxes()).toBeNull()
    window.localStorage.setItem(PERMISSION_AXES_STORAGE_KEY, '{not-json')
    expect(readStoredPermissionAxes()).toBeNull()
    window.localStorage.setItem(
      PERMISSION_AXES_STORAGE_KEY,
      JSON.stringify({ sandboxMode: SANDBOX_MODES[0], approvalPolicy: 'yolo' }),
    )
    expect(readStoredPermissionAxes()).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
