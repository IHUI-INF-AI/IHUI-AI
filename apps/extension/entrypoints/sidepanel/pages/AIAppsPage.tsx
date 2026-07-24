/**
 * AIAppsPage — AI 应用中心首页,列出所有 AI 类功能入口。
 */
import { AppListPage, type AppItem } from '../components/AppListPage'

const WEB_BASE = 'https://ihui.ai'

const items: AppItem[] = [
  { to: '/ai/agents', icon: '🤖', titleKey: 'apps.aiAgents', descKey: 'apps.aiAgentsDesc' },
  { to: '/ai/skills', icon: '⚡', titleKey: 'apps.aiSkills', descKey: 'apps.aiSkillsDesc' },
  { to: '/ai/image-gen', icon: '🎨', titleKey: 'apps.imageGen', descKey: 'apps.imageGenDesc' },
  { to: '/ai/memory', icon: '🧠', titleKey: 'apps.memory', descKey: 'apps.memoryDesc' },
  { to: '/ai/news', icon: '📡', titleKey: 'apps.aiNews', descKey: 'apps.aiNewsDesc' },
  { to: '/ai/models', icon: '🏆', titleKey: 'apps.models', descKey: 'apps.modelsDesc' },
  {
    externalUrl: `${WEB_BASE}/ai-world`,
    icon: '🌍',
    titleKey: 'apps.aiWorld',
    descKey: 'apps.aiWorldDesc',
  },
  {
    externalUrl: `${WEB_BASE}/ai-career`,
    icon: '💼',
    titleKey: 'apps.aiCareer',
    descKey: 'apps.aiCareerDesc',
  },
  {
    externalUrl: `${WEB_BASE}/spec`,
    icon: '📋',
    titleKey: 'apps.spec',
    descKey: 'apps.specDesc',
  },
  {
    externalUrl: `${WEB_BASE}/knowledge-base`,
    icon: '📚',
    titleKey: 'apps.knowledgeBase',
    descKey: 'apps.knowledgeBaseDesc',
  },
  {
    externalUrl: `${WEB_BASE}/knowledge-rag`,
    icon: '🔍',
    titleKey: 'apps.knowledgeRag',
    descKey: 'apps.knowledgeRagDesc',
  },
]

export default function AIAppsPage() {
  return <AppListPage titleKey="apps.aiTitle" items={items} />
}
