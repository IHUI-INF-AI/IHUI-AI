// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 79 号票「权限双轴化前端」合围(2026-10-23 立):sandbox_mode × approval_policy。
//
// 三层各钉一件事,缺一层这套判据就可以被"看着绿"地架空:
//   ① 行为层 —— 真挂 PermissionAxesPicker(真词包,不 mock next-intl),点档位后
//      store 里落下的轴值必须**等于契约层的预设对象本身**(@ihui/types 的 APPROVAL_PRESETS),
//      而不是测试里抄的一份字面量;
//   ② 请求层 —— 发流侧拿到的字段由 resolveRequestAxes 产出,断言的是后端认识的那两个
//      camel 名(sandboxMode / approvalPolicy),并直锁宿主真把这份产出 spread 进 streamChat;
//   ③ 互斥层 —— 单轴映射走 PERMISSION_MODE_TO_AXIS(原生档 → 精确等价;acceptEdits /
//      manual → null ⇒ 一条都不发),且切单轴必须把显式双轴清回 null(否则后端按优先序
//      继续用旧双轴,界面与实际分叉)。
//
// 词包取材面 = 工作树 JSON:本票新增的 18 个键与实现同批落盘;若把键删掉,
// 本文件在 render 阶段就会因缺键抛错(不是静默 fallback)。

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { NextIntlClientProvider } from 'next-intl'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  APPROVAL_POLICIES,
  APPROVAL_PRESETS,
  SANDBOX_MODES,
  SANDBOX_MODE_DEFAULT,
  APPROVAL_POLICY_DEFAULT,
  PERMISSION_MODE_TO_AXIS,
} from '@ihui/types'

import { useAiPanelStore } from '@/stores/ai-panel'
import {
  axisPairOrDefaults,
  effectiveAxisPair,
  resolveRequestAxes,
} from '@/lib/permission-axes'
import { PermissionAxesPicker } from '../permission-axes-picker'

const messages = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json'), 'utf-8'),
) as { chat: { permission: Record<string, string> } }

function packKey(key: string): string {
  const value = messages.chat.permission[key]
  if (typeof value !== 'string') throw new Error(`词包缺键 chat.permission.${key}`)
  return value
}

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

function renderPicker() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={{ chat: { permission: messages.chat.permission } }}>
      <PermissionAxesPicker />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  useAiPanelStore.setState({ permissionAxes: null, activeWorkspace: null, pendingPermissionMode: null })
})

afterEach(cleanup)

describe('79 权限双轴 · 两轴默认值', () => {
  it('未显式选择 ⇒ store 仍为 null(跟随单轴);面板默认落在契约默认档,不是端内字面量', () => {
    renderPicker()
    expect(useAiPanelStore.getState().permissionAxes).toBeNull()

    // 默认档取自 @ihui/types:read-only × on-request
    const defaults = axisPairOrDefaults(null, null)
    expect(defaults.sandboxMode).toBe(SANDBOX_MODE_DEFAULT)
    expect(defaults.approvalPolicy).toBe(APPROVAL_POLICY_DEFAULT)
    expect(
      screen
        .getByTestId(`permission-axes-sandbox-${SANDBOX_MODE_DEFAULT}`)
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen
        .getByTestId(`permission-axes-approval-${APPROVAL_POLICY_DEFAULT}`)
        .getAttribute('aria-checked'),
    ).toBe('true')
    // 无单轴可映射 ⇒ 状态行必须明说"不发双轴",不得假装
    expect(screen.getByTestId('permission-axes-status').textContent).toBe(packKey('axesUnmapped'))
    // 档位清单来自契约(3 × 4),端内没有第二份数组
    expect(screen.getAllByRole('radio')).toHaveLength(SANDBOX_MODES.length + APPROVAL_POLICIES.length)
  })
})

describe('79 权限双轴 · 切换后请求带上正确字段', () => {
  it('点两轴芯片 ⇒ store 落显式对;发起请求时 sandboxMode/approvalPolicy 与之逐字一致', () => {
    renderPicker()
    fireEvent.click(screen.getByTestId('permission-axes-sandbox-workspace-write'))
    fireEvent.click(screen.getByTestId('permission-axes-approval-never'))

    const axes = useAiPanelStore.getState().permissionAxes
    expect(axes).toEqual({ sandboxMode: 'workspace-write', approvalPolicy: 'never' })

    // 发流侧拿到的就是这两个 camel 字段(api-client 的 sandboxMode / approvalPolicy)
    expect(resolveRequestAxes(axes, 'default')).toEqual({
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
    })
    // 预设三档直接取契约对象本身,不在端内重抄
    fireEvent.click(screen.getByTestId('permission-axes-preset-auto'))
    expect(useAiPanelStore.getState().permissionAxes).toEqual(APPROVAL_PRESETS.auto)

    // 宿主真把这份产出 spread 进 streamChat(造好没装车 = 没有)
    const sendMessage = readSource('src/hooks/use-chat/send-message.ts')
    expect(sendMessage).toContain('resolveRequestAxes(')
    expect(sendMessage).toContain('...currentAxes,')
    expect(screen.getByTestId('permission-axes-status').textContent).toBe(packKey('axesOverride'))
  })
})

describe('79 权限双轴 · 与旧单轴互斥 / 映射', () => {
  it('单轴按 PERMISSION_MODE_TO_AXIS 派生;无等价档一条不发;切单轴清空显式双轴', () => {
    // 映射只认契约表(bypass ⇄ Full Access 预设;acceptEdits 为 null 不伪造)
    expect(PERMISSION_MODE_TO_AXIS.bypassPermissions).toEqual(APPROVAL_PRESETS.fullAccess)
    expect(resolveRequestAxes(null, 'bypass-permissions')).toEqual({
      sandboxMode: 'danger-full-access',
      approvalPolicy: 'never',
    })
    expect(resolveRequestAxes(null, 'accept-edits')).toEqual({})
    expect(resolveRequestAxes(null, 'manual')).toEqual({})
    expect(effectiveAxisPair(null, 'accept-edits')).toBeNull()

    // 显式双轴优先于单轴(与后端 resolve_axis_resolution 同序)
    expect(resolveRequestAxes(APPROVAL_PRESETS.auto, 'plan')).toEqual(APPROVAL_PRESETS.auto)

    // 互斥:点"跟随单轴"清回 null
    useAiPanelStore.getState().setPermissionAxes({ ...APPROVAL_PRESETS.fullAccess })
    renderPicker()
    fireEvent.click(screen.getByTestId('permission-axes-follow'))
    expect(useAiPanelStore.getState().permissionAxes).toBeNull()

    // 互斥的另一半:两条单轴切换路径都必须清显式双轴(弹层 + 斜杠命令共用)
    const popover = readSource('src/components/ai/permission-mode-popover.tsx')
    expect(popover.match(/setPermissionAxes\(null\)/g) ?? []).toHaveLength(2)
    expect(popover).toContain('<PermissionAxesPicker')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
