// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { AgentRuntimePanelLabels } from '@ihui/types'

/**
 * RN 端文案接线(与 ShareScreen 及既有运行时面板用例共用同一份映射)。
 *
 * 共享层 `AgentRuntimePanel` 不自取词:静态文案由端侧解析后传入,
 * 动态命名空间(stepDecision / permissionTier / taskStatus)由 `t` 直接注入。
 * 本函数只做「键 → 本端词值」的搬运,不含任何 UI。
 */
export function agentRuntimePanelLabels(t: (key: string) => string): AgentRuntimePanelLabels {
  return {
    title: t('agent.runtimeTitle'),
    clear: t('agent.runtimeClear'),
    plan: t('agent.runtimePlan'),
    permission: t('agent.runtimePermission'),
    permissionTool: t('agent.runtimePermissionTool'),
    permissionLevel: t('agent.runtimePermissionLevel'),
    permissionMode: t('agent.runtimePermissionMode'),
    output: t('agent.runtimeOutput'),
    error: t('agent.runtimeError'),
    empty: t('agent.runtimeEmpty'),
    placeholder: t('agent.runtimeInputPlaceholder'),
    stop: t('agent.runtimeStop'),
    send: t('agent.runtimeSend'),
  }
}
