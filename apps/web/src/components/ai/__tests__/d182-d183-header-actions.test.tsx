// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D182「AI 面板头部 a11y 组名+工作面全屏+门槛态」/ D183「会话头部一键创建 Draft PR」
// 合围证明(2026-09-29 立,对标竞品 chatSession.headerActions)。
// AISidePanel 体量为仓内之最,仓内惯例(d73-side-panel-pane-mount.test.tsx)不整体挂载,
// 本文件三层合围:
//   行为层:真跑 ai-panel store —— 全屏为会话级开关;persist merge 强制复位:
//           localStorage 旧残留 workAreaFullscreen:true ⇒ rehydrate 后回 false
//           (open/floatMinimized 同被强制,width 用户拖拽偏好仍保留);
//   锚点层:宿主 ai-side-panel.tsx 消费点(头部动作组 role=group+组名 / 全屏按钮双态 aria /
//           门槛隐藏(无会话不渲染,能用才显示) / display:none 让位工作面 + createPortal 退出键 /
//           draft:true 请求体) + API 侧 draft 透传链(schema 可选布尔 + GitHubClient POST body);
//   词包层:aiChat.headerActions 五语言直锁。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { useAiPanelStore } from '@/stores/ai-panel'

function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

const host = readRepo('src/components/ai/ai-side-panel.tsx')
const apiRoute = readRepo('../api/src/routes/workspace-ai.ts')
const apiService = readRepo('../api/src/services/workspace-ai-service.ts')

const MESSAGES_ROOT = resolve(process.cwd(), '../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

type HeaderActions = Record<string, string>

function readLocale(locale: (typeof LOCALES)[number]): {
  aiChat: { headerActions: HeaderActions }
} {
  return JSON.parse(readFileSync(resolve(MESSAGES_ROOT, `${locale}.json`), 'utf-8')) as {
    aiChat: { headerActions: HeaderActions }
  }
}

describe('D182 行为层:ai-panel store 会话级全屏状态', () => {
  it('初始 workAreaFullscreen=false;setWorkAreaFullscreen(true/false) 真实翻转', () => {
    expect(useAiPanelStore.getState().workAreaFullscreen).toBe(false)
    useAiPanelStore.getState().setWorkAreaFullscreen(true)
    expect(useAiPanelStore.getState().workAreaFullscreen).toBe(true)
    useAiPanelStore.getState().setWorkAreaFullscreen(false)
    expect(useAiPanelStore.getState().workAreaFullscreen).toBe(false)
  })

  it('persist merge 强制会话级复位:localStorage 旧残留 workAreaFullscreen:true ⇒ rehydrate 后回 false', async () => {
    window.localStorage.setItem(
      'ihui-ai-panel',
      JSON.stringify({
        state: { workAreaFullscreen: true, open: false, floatMinimized: true, width: 401 },
        version: 5,
      }),
    )
    await useAiPanelStore.persist.rehydrate()
    const s = useAiPanelStore.getState()
    expect(s.workAreaFullscreen).toBe(false)
    expect(s.open).toBe(true)
    expect(s.floatMinimized).toBe(false)
    // merge 只强制会话级键:用户拖拽宽度偏好仍被保留
    expect(s.width).toBe(401)
  })
})

describe('D182 锚点层:头部动作组/全屏按钮/门槛态/portal 退出键都在宿主里', () => {
  it('头部动作组:role=group + 组名(panelGroupButtons)+ data-testid(读屏可报"面板组按钮")', () => {
    expect(host).toContain('role="group"')
    expect(host).toContain("aria-label={tc('headerActions.panelGroupButtons')}")
    expect(host).toContain('data-testid="ai-panel-header-actions-group"')
  })

  it('全屏按钮:进入/退出双态 aria-label + 门槛隐藏(无活动会话=任务未开始时整钮不渲染)', () => {
    expect(host).toContain('data-testid="ai-panel-workspace-fullscreen"')
    expect(host).toContain("tc('headerActions.enterWorkspaceFullscreen')")
    expect(host).toContain("tc('headerActions.exitWorkspaceFullscreen')")
    expect(host).toContain('{!floatMode && !workspaceUnavailable && (')
    expect(host).not.toContain('disabled={workspaceUnavailable}')
    expect(host).toContain('const workspaceUnavailable = !storeConversationId')
  })

  it('全屏态:面板 inline display:none 让位工作面(优先级高于 min-[768px]:block)+ portal 退出按钮挂 #work-area-portal-root', () => {
    expect(host).toContain("{ display: 'none' }")
    expect(host).toContain("import { createPortal } from 'react-dom'")
    expect(host).toContain('createPortal(')
    expect(host).toContain("document.getElementById('work-area-portal-root') ?? document.body")
    expect(host).toContain('data-testid="work-area-fullscreen-exit"')
  })
})

describe('D183 锚点层:一键 Draft PR(前端头部按钮 + 后端 draft 透传链)', () => {
  it('前端:创建按钮 + handler + draft:true 请求体 + 成功/失败 toast 都在宿主', () => {
    expect(host).toContain('data-testid="ai-panel-create-draft-pr"')
    expect(host).toContain('handleCreateDraftPR')
    expect(host).toContain('draft: true,')
    expect(host).toContain("tc('headerActions.createDraftPullRequest')")
    expect(host).toContain("tc('headerActions.createDraftPullRequestOk')")
    expect(host).toContain("tc('headerActions.createDraftPullRequestFailed')")
    // 门槛隐藏:无活动会话时整钮不渲染(创建中例外保留转圈反馈)
    expect(host).toContain('{!floatMode && (!workspaceUnavailable || creatingDraftPR) && (')
  })

  it('后端路由:createPRSchema 接受可选 draft 布尔(缺省不破坏既有调用方)', () => {
    expect(apiRoute).toContain('draft: z.boolean().optional(),')
  })

  it('后端服务:GitHubClient.createPR POST body 透传 draft(缺省 false)', () => {
    expect(apiService).toContain('draft?: boolean')
    expect(apiService).toContain('draft: params.draft ?? false,')
  })
})

describe('D182/D183 词包五语言直锁(aiChat.headerActions)', () => {
  const EXPECTED: Record<(typeof LOCALES)[number], HeaderActions> = {
    'zh-CN': {
      panelGroupButtons: '面板组按钮',
      enterWorkspaceFullscreen: '全屏显示工作面',
      exitWorkspaceFullscreen: '退出工作面全屏',
      createDraftPullRequest: '创建 Draft PR',
      createDraftPullRequestOk: 'Draft PR 已创建',
      createDraftPullRequestFailed: '创建 Draft PR 失败',
    },
    'zh-TW': {
      panelGroupButtons: '面板組按鈕',
      enterWorkspaceFullscreen: '全螢幕顯示工作面',
      exitWorkspaceFullscreen: '退出工作面全螢幕',
      createDraftPullRequest: '建立 Draft PR',
      createDraftPullRequestOk: 'Draft PR 已建立',
      createDraftPullRequestFailed: '建立 Draft PR 失敗',
    },
    en: {
      panelGroupButtons: 'Panel action buttons',
      enterWorkspaceFullscreen: 'Enter workspace fullscreen',
      exitWorkspaceFullscreen: 'Exit workspace fullscreen',
      createDraftPullRequest: 'Create Draft PR',
      createDraftPullRequestOk: 'Draft PR created',
      createDraftPullRequestFailed: 'Failed to create Draft PR',
    },
    ja: {
      panelGroupButtons: 'パネルアクションボタン',
      enterWorkspaceFullscreen: 'ワークスペースを全画面表示',
      exitWorkspaceFullscreen: 'ワークスペースの全画面を終了',
      createDraftPullRequest: 'Draft PR を作成',
      createDraftPullRequestOk: 'Draft PR を作成しました',
      createDraftPullRequestFailed: 'Draft PR の作成に失敗しました',
    },
    ko: {
      panelGroupButtons: '패널 작업 버튼',
      enterWorkspaceFullscreen: '작업 공간 전체 화면 표시',
      exitWorkspaceFullscreen: '작업 공간 전체 화면 종료',
      createDraftPullRequest: 'Draft PR 만들기',
      createDraftPullRequestOk: 'Draft PR가 생성되었습니다',
      createDraftPullRequestFailed: 'Draft PR 생성 실패',
    },
  }

  it('五语言六键逐一逐字一致(防某包漏插/翻译机踩键)', () => {
    for (const locale of LOCALES) {
      expect(readLocale(locale).aiChat.headerActions, locale).toEqual(EXPECTED[locale])
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
