// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE_SOURCE = readFileSync(join(__dirname, '../src/pkg-ai/ai/agent-detail.tsx'), 'utf8')
const PANEL_SOURCE = readFileSync(
  join(__dirname, '../../../packages/app/src/features/agent-runtime/AgentRuntimePanel.tsx'),
  'utf8',
)

/** 去掉注释后再做"零平台 API"断言,避免把说明文字里的 API 名当成调用 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const LABEL_KEYS = [
  'runtimeTitle',
  'runtimeClear',
  'runtimePlan',
  'runtimePermission',
  'runtimePermissionTool',
  'runtimePermissionLevel',
  'runtimePermissionMode',
  'runtimeOutput',
  'runtimeError',
  'runtimeEmpty',
  'runtimeInputPlaceholder',
  'runtimeStop',
  'runtimeSend',
] as const

describe('agent-detail 运行时面板(两端同源共享件)', () => {
  it('页面从共享层具体子路径导入,且端内私有实现已删除', () => {
    expect(PAGE_SOURCE).toContain(
      "import AgentRuntimePanel from '@ihui/rn-app/features/agent-runtime/AgentRuntimePanel'",
    )
    expect(PAGE_SOURCE).not.toContain("from '@/components/AgentRuntimePanel'")
    // 阴性对照:端内私有面板若被恢复,本断言立即变红
    expect(() =>
      readFileSync(join(__dirname, '../src/components/AgentRuntimePanel.tsx'), 'utf8'),
    ).toThrow()
  })

  it('页面真传 13 个文案键 + t + colorScheme(共享层不自取词、不自带平台能力)', () => {
    for (const key of LABEL_KEYS) {
      // 阴性对照:删掉任一 label 键,本断言变红(共享层拿不到该文案)
      expect(PAGE_SOURCE).toContain(`t('ai.agentDetail.${key}')`)
    }
    expect(PAGE_SOURCE).toContain('t={t}')
    expect(PAGE_SOURCE).toContain('colorScheme={resolvedTheme}')
  })

  it('共享组件零平台 API:无存储读写、无导航、无端内 i18n', () => {
    const code = stripComments(PANEL_SOURCE)
    expect(code).not.toMatch(/\bTaro\b/)
    expect(code).not.toMatch(/getStorageSync|setStorageSync|AsyncStorage/)
    expect(code).not.toMatch(/navigateTo|redirectTo/)
    expect(code).not.toMatch(/useI18n|from '@\/i18n'|\bwx\./)
    // 阴性对照:注入面被拆掉(标签不再由 props 进入)则本断言变红
    expect(code).toMatch(/labels\.(title|clear|plan|permission|output|error|empty|stop|send)/)
    expect(code).toMatch(/t\(\s*`stepDecision\./)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
