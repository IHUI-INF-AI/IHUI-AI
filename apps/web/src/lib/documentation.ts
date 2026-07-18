/**
 * 文档数据 — 等价自旧架构 client/src/data/documentation.ts
 * 导出文档目录树常量，供「文档中心」页面渲染侧边栏与面包屑
 */

export interface DocNode {
  /** 文档 slug（路由参数） */
  slug: string
  /** 文档标题 */
  title: string
  /** 文档描述 */
  description?: string
  /** 图标名（lucide） */
  icon?: string
  /** 排序权重，越小越靠前 */
  sortOrder?: number
  /** 是否新文档标记 */
  isNew?: boolean
  /** 子文档 */
  children?: DocNode[]
}

/** 文档目录树 */
export const DOCUMENTATION_TREE: DocNode[] = [
  {
    slug: 'getting-started',
    title: '快速开始',
    icon: 'Rocket',
    sortOrder: 1,
    children: [
      {
        slug: 'getting-started/introduction',
        title: '产品介绍',
        description: '了解 IHUI-AI 的核心能力与适用场景',
        sortOrder: 1,
      },
      {
        slug: 'getting-started/installation',
        title: '安装与登录',
        description: '账号注册、登录与基础配置',
        sortOrder: 2,
      },
      {
        slug: 'getting-started/first-chat',
        title: '发起第一次对话',
        description: '快速体验 AI 对话功能',
        sortOrder: 3,
        isNew: true,
      },
    ],
  },
  {
    slug: 'guides',
    title: '使用指南',
    icon: 'BookOpen',
    sortOrder: 2,
    children: [
      {
        slug: 'guides/ai-chat',
        title: 'AI 对话',
        description: '多轮对话、上下文管理与模型切换',
        sortOrder: 1,
      },
      {
        slug: 'guides/agents',
        title: '智能体',
        description: '创建与使用自定义智能体',
        sortOrder: 2,
      },
      {
        slug: 'guides/workspace',
        title: '工作空间',
        description: '团队协作与资源管理',
        sortOrder: 3,
      },
      {
        slug: 'guides/mcp',
        title: 'MCP 工具',
        description: '模型上下文协议与工具集成',
        sortOrder: 4,
        isNew: true,
      },
    ],
  },
  {
    slug: 'billing',
    title: '会员与计费',
    icon: 'CreditCard',
    sortOrder: 3,
    children: [
      {
        slug: 'billing/vip',
        title: 'VIP 会员',
        description: '会员等级与权益说明',
        sortOrder: 1,
      },
      {
        slug: 'billing/quota',
        title: '额度说明',
        description: 'AI 额度发放与消耗规则',
        sortOrder: 2,
      },
      {
        slug: 'billing/refund',
        title: '退款政策',
        description: '退款条件与流程',
        sortOrder: 3,
      },
    ],
  },
  {
    slug: 'developer',
    title: '开发者',
    icon: 'Code',
    sortOrder: 4,
    children: [
      {
        slug: 'developer/api',
        title: 'API 文档',
        description: 'OpenAPI 接口规范',
        sortOrder: 1,
      },
      {
        slug: 'developer/sdk',
        title: 'SDK 使用',
        description: '官方 SDK 集成指南',
        sortOrder: 2,
      },
      {
        slug: 'developer/webhook',
        title: 'Webhook',
        description: '事件回调配置',
        sortOrder: 3,
      },
    ],
  },
  {
    slug: 'security',
    title: '安全与合规',
    icon: 'ShieldCheck',
    sortOrder: 5,
    children: [
      {
        slug: 'security/privacy',
        title: '隐私政策',
        description: '数据收集与使用说明',
        sortOrder: 1,
      },
      {
        slug: 'security/gdpr',
        title: 'GDPR 与数据导出',
        description: '数据权利与导出/删除',
        sortOrder: 2,
      },
    ],
  },
  {
    slug: 'faq',
    title: '常见问题',
    icon: 'HelpCircle',
    sortOrder: 99,
  },
]

/** 扁平化文档列表（便于全局检索） */
export const FLAT_DOCUMENTATION: DocNode[] = DOCUMENTATION_TREE.flatMap((node) =>
  node.children?.length ? [node, ...node.children] : [node],
)

/** 按 slug 查询文档节点 */
export function findDocBySlug(slug: string): DocNode | undefined {
  return FLAT_DOCUMENTATION.find((doc) => doc.slug === slug)
}

/** 获取文档的面包屑路径（从根到当前节点） */
export function getDocBreadcrumb(slug: string): DocNode[] {
  for (const root of DOCUMENTATION_TREE) {
    if (root.slug === slug) return [root]
    const child = root.children?.find((c) => c.slug === slug)
    if (child) return [root, child]
  }
  return []
}
