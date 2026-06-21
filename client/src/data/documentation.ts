import { t } from '@/utils/i18n'

/**
 * 文档数据结构
 * 所有文档使用Markdown格式
 */

import { logger } from '@/utils/logger'

export interface DocNode {
  id: string
  label: string
  path?: string // 文档文件路径（相对于docs目录）
  content?: string // 直接内容（如果path不存在）
  children?: DocNode[]
}

/**
 * 文档树数据
 */
export const docTreeData: {
  user: DocNode[]
  developer: DocNode[]
  enterpriseService: DocNode[]
} = {
  user: [
    {
      id: 'user-getting-started',
      label: t('text.documentation.快速开始1'),
      children: [
        {
          id: 'user-introduction',
          label: t('text.documentation.平台介绍2'),
          path: 'user/getting-started/introduction.md',
        },
        {
          id: 'user-register',
          label: t('text.documentation.注册与登录3'),
          path: 'user/getting-started/register.md',
        },
        {
          id: 'user-profile',
          label: t('text.documentation.个人中心4'),
          path: 'user/getting-started/profile.md',
        },
      ],
    },
    {
      id: 'user-features',
      label: t('text.documentation.功能使用5'),
      children: [
        {
          id: 'user-ai-chat',
          label: t('text.documentation.AI对话6'),
          path: 'user/features/ai-chat.md',
        },
        {
          id: 'user-agents',
          label: t('text.documentation.智能体使用7'),
          path: 'user/features/agents.md',
        },
        {
          id: 'user-wallet',
          label: t('text.documentation.钱包功能8'),
          path: 'user/features/wallet.md',
        },
        {
          id: 'user-payment',
          label: t('text.documentation.支付功能9'),
          path: 'user/features/payment.md',
        },
        {
          id: 'user-customer-service',
          label: t('text.documentation.客服系统10'),
          path: 'user/features/customer-service.md',
        },
      ],
    },
    {
      id: 'user-guides',
      label: t('text.documentation.使用指南11'),
      children: [
        {
          id: 'user-video-generation',
          label: t('text.documentation.视频生成12'),
          path: 'user/guides/video-generation.md',
        },
        {
          id: 'user-data-export',
          label: t('text.documentation.数据导出13'),
          path: 'user/guides/data-export.md',
        },
        {
          id: 'user-tech-service',
          label: t('text.documentation.技术服务预约14'),
          path: 'user/guides/tech-service.md',
        },
      ],
    },
    {
      id: 'user-faq',
      label: t('text.documentation.常见问题15'),
      path: 'user/faq.md',
    },
  ],
  developer: [
    {
      id: 'dev-incentive-program',
      label: '开发者激励计划',
      children: [
        {
          id: 'dev-incentive-overview',
          label: '计划概述',
          path: 'developer/incentive-program/overview.md',
        },
        {
          id: 'dev-incentive-publish',
          label: '智能体发布指南',
          path: 'developer/incentive-program/publish-guide.md',
        },
        {
          id: 'dev-incentive-monetization',
          label: '开发者变现指南',
          path: 'developer/incentive-program/monetization.md',
        },
        {
          id: 'dev-incentive-course',
          label: '开发陪跑课程',
          path: 'developer/incentive-program/course.md',
        },
        {
          id: 'dev-incentive-platform',
          label: '平台功能介绍',
          path: 'developer/incentive-program/platform-intro.md',
        },
      ],
    },
    {
      id: 'dev-getting-started',
      label: t('text.documentation.快速开始16'),
      children: [
        {
          id: 'dev-introduction',
          label: t('text.documentation.开发者平台介绍17'),
          path: 'developer/getting-started/introduction.md',
        },
        {
          id: 'dev-setup',
          label: t('text.documentation.环境配置18'),
          path: 'developer/getting-started/setup.md',
        },
        {
          id: 'dev-authentication',
          label: t('text.documentation.身份认证19'),
          path: 'developer/getting-started/authentication.md',
        },
      ],
    },
    {
      id: 'dev-api',
      label: t('text.documentation.API文档20'),
      children: [
        {
          id: 'dev-api-overview',
          label: t('text.documentation.API概览21'),
          path: 'developer/api/overview.md',
        },
        {
          id: 'dev-api-chat',
          label: t('text.documentation.对话API22'),
          path: 'developer/api/chat.md',
        },
        {
          id: 'dev-api-models',
          label: t('text.documentation.模型API23'),
          path: 'developer/api/models.md',
        },
        {
          id: 'dev-api-agents',
          label: t('text.documentation.智能体API24'),
          path: 'developer/api/agents.md',
        },
        {
          id: 'dev-api-files',
          label: t('text.documentation.文件API25'),
          path: 'developer/api/files.md',
        },
        {
          id: 'dev-api-error',
          label: t('text.documentation.错误处理26'),
          path: 'developer/api/error-handling.md',
        },
      ],
    },
    {
      id: 'dev-sdk',
      label: t('text.documentation.SDK文档27'),
      children: [
        {
          id: 'dev-sdk-javascript',
          label: 'JavaScript SDK',
          path: 'developer/sdk/javascript.md',
        },
        {
          id: 'dev-sdk-python',
          label: 'Python SDK',
          path: 'developer/sdk/python.md',
        },
        {
          id: 'dev-sdk-curl',
          label: t('text.documentation.cURL示例28'),
          path: 'developer/sdk/curl.md',
        },
      ],
    },
    {
      id: 'dev-integration',
      label: t('text.documentation.集成指南29'),
      children: [
        {
          id: 'dev-integration-webhook',
          label: t('text.documentation.Webhook集30'),
          path: 'developer/integration/webhook.md',
        },
        {
          id: 'dev-integration-oauth',
          label: t('text.documentation.OAuth集成31'),
          path: 'developer/integration/oauth.md',
        },
        {
          id: 'dev-integration-third-party',
          label: t('text.documentation.第三方登录32'),
          path: 'developer/integration/third-party-login.md',
        },
      ],
    },
    {
      id: 'dev-best-practices',
      label: t('text.documentation.最佳实践33'),
      path: 'developer/best-practices.md',
    },
    {
      id: 'dev-troubleshooting',
      label: t('text.documentation.故障排查34'),
      path: 'developer/troubleshooting.md',
    },
  ],
  enterpriseService: [
    {
      id: 'enterprise-overview',
      label: '企业服务概述',
      children: [
        {
          id: 'enterprise-whitepaper',
          label: 'AI智汇社项目白皮书',
          path: 'enterprise-service/whitepaper.md',
        },
        {
          id: 'enterprise-intro',
          label: '智汇AI社介绍',
          path: 'enterprise-service/ai-community-intro.md',
        },
      ],
    },
    {
      id: 'enterprise-principles',
      label: '企业AI化服务原理',
      children: [
        {
          id: 'enterprise-decision-maker',
          label: '企业AI化决策者社群',
          path: 'enterprise-service/decision-maker-community.md',
        },
        {
          id: 'enterprise-human-ai-collaboration',
          label: '人机协作组织',
          path: 'enterprise-service/human-ai-collaboration.md',
        },
      ],
    },
  ],
}

/**
 * 加载文档内容
 */
export async function loadDocContent(doc: DocNode): Promise<string> {
  if (doc.content) {
    return doc.content
  }

  if (!doc.path) {
    throw new Error(t('error.documentation.文档路径不存在'))
  }

  try {
    // 从public/docs目录加载（Vite会自动处理public目录）
    const response = await fetch(`/docs/${doc.path}`)
    if (response.ok) {
      const content = await response.text()
      if (content && content.trim().length > 0) {
        return content
      }
    }

    // 如果文件不存在或内容为空，返回默认内容
    return getDefaultDocContent(doc)
  } catch (err) {
    logger.warn('Failed to load documentation file, using default content:', err)
    return getDefaultDocContent(doc)
  }
}

/**
 * 获取默认文档内容
 */
function getDefaultDocContent(doc: DocNode): string {
  return `# ${doc.label}

> 文档内容正在完善中，敬请期待。

## 概述

本文档将详细介绍 ${doc.label} 的相关内容。

## 内容

文档内容正在编写中...

---

*最后更新: ${new Date().toLocaleDateString('zh-CN')}*
`
}
