// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RecentAgents — 最近使用的智能体横向滚动列表(小程序端适配层)
 *
 * UI 已单源化到 features/agent-screen/AgentRecentUsed;
 * 本文件只保留小程序端登录/付费/来源拦截与跳转。
 */
import { useTt } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'
import Taro from '@tarojs/taro'
import { onToast } from '@/host/on-toast'
import { getUserInfo } from '@/utils/auth'
import { AgentRecentUsed } from '@ihui/rn-app/features/agent-screen/AgentRecentUsed'

export interface RecentAgent {
  id: string
  agentName: string
  agentAvatar: string
  /** 可选:智能体类型 3/5 为付费模型,点击时跳过跳转 */
  type?: number
  /** 可选:来源标识,如 'n8n' 跳转专用页面 */
  source?: string
  agentId?: string
}

export interface RecentAgentsProps {
  recentAgents: RecentAgent[]
}

export default function RecentAgents({ recentAgents }: RecentAgentsProps) {
  const tt = useTt()
  const { resolvedTheme } = useTheme()

  function navigateTo(agent: RecentAgent, idx: number) {
    const userData = getUserInfo()
    if (!userData) {
      onToast(tt('ai.aiAssistant.pleaseLogin', '请先登录'), { kind: 'error' })
      return
    }
    if (agent.type === 3 || agent.type === 5) {
      return
    }
    // XUI-018:旧 /pages/tools/* 路由已删除,改用 pkg-ai 分包在册路径。
    const targetUrl =
      agent.source === 'n8n' ? '/pkg-ai/ai-assistant-n8n/index' : '/pkg-ai/ai-assistant/index'
    const agentId = agent.agentId || agent.id
    Taro.navigateTo({
      url: `${targetUrl}?modelNamea=${encodeURIComponent(agent.agentName)}&pitcha=${idx}&agentId=${encodeURIComponent(agentId)}&type=${agent.type ?? ''}`,
    })
  }

  return (
    <AgentRecentUsed
      items={recentAgents}
      title={tt('communityRecentAgents.text1', '最近使用')}
      onItemClick={(item, index) => navigateTo(item as RecentAgent, index)}
      colorScheme={resolvedTheme}
      defaultAvatar={null}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
