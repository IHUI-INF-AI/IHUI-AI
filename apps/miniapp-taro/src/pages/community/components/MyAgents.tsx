// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MyAgents — 我的AI APP 横向滚动列表 + "我的AI员工"入口(小程序端适配层)
 *
 * UI 已单源化到 features/agent-screen/AgentMyApps;
 * 本文件只保留小程序端登录/付费/来源拦截与跳转。
 */
import { useTt } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'
import Taro from '@tarojs/taro'
import { onToast } from '@/host/on-toast'
import { getUserInfo } from '@/utils/auth'
import { AgentMyApps } from '@ihui/rn-app/features/agent-screen/AgentMyApps'

export interface MyAgent {
  id: string
  agentName: string
  agentAvatar: string
  /** 可选:智能体类型 3/5 为付费模型,点击时跳过跳转 */
  type?: number
  /** 可选:来源标识,如 'n8n' 跳转专用页面 */
  source?: string
  agentId?: string
}

export interface MyAgentsProps {
  myAgents: MyAgent[]
}

export default function MyAgents({ myAgents }: MyAgentsProps) {
  const tt = useTt()
  const { resolvedTheme } = useTheme()

  function goToTeam() {
    Taro.navigateTo({ url: '/pages/tools/ai_group/index' })
  }

  function navigateTo(agent: MyAgent, idx: number) {
    const userData = getUserInfo()
    if (!userData) {
      onToast(tt('ai.aiAssistant.pleaseLogin', '请先登录'), { kind: 'error' })
      return
    }
    if (agent.type === 3 || agent.type === 5) {
      return
    }
    const targetUrl =
      agent.source === 'n8n' ? '/pages/tools/ai_assistant_n8n' : '/pages/tools/ai_assistant'
    const agentId = agent.agentId || agent.id
    Taro.navigateTo({
      url: `${targetUrl}?modelNamea=${encodeURIComponent(agent.agentName)}&pitcha=${idx}&agentId=${encodeURIComponent(agentId)}&type=${agent.type ?? ''}`,
    })
  }

  return (
    <AgentMyApps
      items={myAgents}
      title={tt('communityMyAgents.mine1', '我的AI APP')}
      moreText={tt('communityMyAgents.mine2', '我的AI员工')}
      onItemClick={(item, index) => navigateTo(item as MyAgent, index)}
      onMore={goToTeam}
      showMore
      colorScheme={resolvedTheme}
      defaultAvatar={null}
      emptyText={null}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
