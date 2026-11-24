// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D55② extension 端渲染级取证:onPermission 决策徽章必须走共享唯一取词入口。
//
// 与 mobile-rn `apps/mobile-rn/tests/agent-runtime-permission-decision.test.tsx`、
// miniapp-taro `src/components/__tests__/agent-runtime-permission-decision.test.ts`
// 同族(该端 vitest environment 为 'node' 且未装 jsdom,无法用 @testing-library/react;
// 但既有先例 agent-runtime-panel.test.tsx 以 `renderToStaticMarkup` 做渲染级测试 ——
// I18nProvider 的 locale 初值同步为 'zh-CN'、取词器与真实 shared+extension 合并词包均不
// 依赖 effect,故本用例是真组件 + 真词包,不是取词函数单测)。
//
// 三层判定(缺一层就是假绿):
//  ① 渲染层 —— 真 PermissionDecisionBadge + 真 I18nProvider(词值全部来自
//     packages/i18n/messages/shared 真实词包,测试内不写字面映射);
//  ② 取值层 —— 15 值步骤决策集与 allow/ask/deny 权限矩阵**两条都不中时必须原样返回**
//     (审批语境把未知值猜成"已放行"会直接误导用户的授权决定);
//  ③ 回显层 —— 缺键喷键名(`stepDecision.` 前缀出现在界面)一律拦红;
//     旧端内自建映射的漂移词值(「已拦截」)也不得再出现 —— 那正是本票收口的第二真相源。
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'

// 与 agent-runtime-panel.test.tsx 同款:面板模块顶层 import api-client,
// node 环境下必须桩掉(本用例不触发任何网络路径)。
vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn(),
  sendToolApprovalResponse: vi.fn(),
  getWorkspacePermissionDefault: vi.fn(() => Promise.resolve({ success: false })),
}))

import { PermissionDecisionBadge } from '../entrypoints/sidepanel/components/AgentRuntimePanel'
import { I18nProvider } from '../src/i18n'

/** 真实 shared 词包(只读取,不在测试里重述词值) */
interface StepDecisionPack {
  stepDecision: {
    perm: Record<string, string>
    decision: Record<string, string>
  }
}
const pack = sharedZhCN as StepDecisionPack
const DENY_WORD = pack.stepDecision.perm.deny
const ALLOW_WORD = pack.stepDecision.perm.allow
const ASK_WORD = pack.stepDecision.perm.ask
const AUTO_SKIP_WORD = pack.stepDecision.decision.autoSkipApproval
/** 收敛前 extension 端内 DECISION_KEY 走 agent.decisionDeny 的漂移词值(取证对照用) */
const LEGACY_DRIFT_WORD = '已拦截'

function renderBadge(decision: string): string {
  return renderToStaticMarkup(
    <I18nProvider>
      <PermissionDecisionBadge decision={decision} />
    </I18nProvider>,
  )
}

describe('AgentRuntimePanel 权限决策徽章(extension):不直显枚举、不猜语义、不喷键名', () => {
  it('词包自检:deny / auto_skip_approval 的中文词值确实来自真实 shared 包', () => {
    expect(DENY_WORD).toBe('已拒绝')
    expect(AUTO_SKIP_WORD).toBe('自动批准(免审批)')
  })

  it('步骤决策取值 auto_skip_approval → 「自动批准(免审批)」,原始枚举与键名都不出现', () => {
    const html = renderBadge('auto_skip_approval')
    expect(html).toContain(AUTO_SKIP_WORD)
    expect(html).not.toContain('auto_skip_approval')
    expect(html).not.toContain('stepDecision.')
  })

  it('权限矩阵取值 deny → 共享词值「已拒绝」;旧端内漂移词「已拦截」不得回潮', () => {
    const html = renderBadge('deny')
    expect(html).toContain(DENY_WORD)
    expect(html).not.toContain(LEGACY_DRIFT_WORD)
    expect(html).not.toContain('deny')
    expect(html).not.toContain('stepDecision.')
  })

  it('权限矩阵取值 ask / allow → 走同一条共享链路的兄弟值同样取到词', () => {
    expect(renderBadge('ask')).toContain(ASK_WORD)
    expect(renderBadge('allow')).toContain(ALLOW_WORD)
  })

  it('未知取值 maybe_allow → 原样显示,绝不猜成语义态', () => {
    const html = renderBadge('maybe_allow')
    expect(html).toContain('maybe_allow')
    expect(html).not.toContain(ALLOW_WORD) // 猜成"已放行"即误导授权决定
    expect(html).not.toContain(AUTO_SKIP_WORD)
    expect(html).not.toContain('stepDecision.')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
