/**
 * 精选 MCP 列表数据 — 等价自旧架构 client/src/data/mcp-curated.ts
 * 导出官方精选的 MCP（Model Context Protocol）服务器列表，供 MCP 市场展示
 */

export interface McpServer {
  /** 唯一标识 */
  id: string
  /** 展示名称 */
  name: string
  /** 简短描述 */
  description: string
  /** 维护方 */
  publisher: string
  /** 仓库地址 */
  repository?: string
  /** 安装命令标识（npx 包名 / 二进制名） */
  package: string
  /** 传输协议 */
  transport: 'stdio' | 'sse' | 'http'
  /** 分类 */
  category: McpCategory
  /** 标签 */
  tags: string[]
  /** 是否官方维护 */
  official?: boolean
  /** 是否推荐 */
  featured?: boolean
  /** 所需权限范围 */
  scopes?: string[]
}

export type McpCategory =
  | 'filesystem'
  | 'search'
  | 'database'
  | 'devtools'
  | 'productivity'
  | 'web'
  | 'communication'
  | 'other'

/** 精选 MCP 服务器列表 */
export const CURATED_MCP_LIST: McpServer[] = [
  {
    id: 'mcp-filesystem',
    name: 'Filesystem',
    description: '提供本地文件系统读写、目录浏览能力，支持限定根目录范围。',
    publisher: 'Anthropic',
    repository: 'https://github.com/modelcontextprotocol/servers',
    package: '@modelcontextprotocol/server-filesystem',
    transport: 'stdio',
    category: 'filesystem',
    tags: ['文件', '读写', '本地'],
    official: true,
    featured: true,
    scopes: ['fs:read', 'fs:write'],
  },
  {
    id: 'mcp-fetch',
    name: 'Fetch',
    description: '抓取指定 URL 的网页内容并转为 Markdown，供模型理解。',
    publisher: 'Anthropic',
    repository: 'https://github.com/modelcontextprotocol/servers',
    package: '@modelcontextprotocol/server-fetch',
    transport: 'stdio',
    category: 'web',
    tags: ['网页', '抓取', 'markdown'],
    official: true,
    featured: true,
    scopes: ['net:fetch'],
  },
  {
    id: 'mcp-brave-search',
    name: 'Brave Search',
    description: '通过 Brave 搜索引擎进行网络搜索，返回结构化结果。',
    publisher: 'Brave',
    repository: 'https://github.com/modelcontextprotocol/servers',
    package: '@modelcontextprotocol/server-brave-search',
    transport: 'stdio',
    category: 'search',
    tags: ['搜索', '网络', 'brave'],
    official: true,
    featured: true,
    scopes: ['search:web'],
  },
  {
    id: 'mcp-postgres',
    name: 'PostgreSQL',
    description: '只读访问 PostgreSQL 数据库，支持执行查询与 schema 探索。',
    publisher: 'Anthropic',
    repository: 'https://github.com/modelcontextprotocol/servers',
    package: '@modelcontextprotocol/server-postgres',
    transport: 'stdio',
    category: 'database',
    tags: ['数据库', 'postgres', 'sql', '只读'],
    official: true,
    scopes: ['db:query'],
  },
  {
    id: 'mcp-sqlite',
    name: 'SQLite',
    description: '操作本地 SQLite 数据库，支持查询、写入与 schema 管理。',
    publisher: 'Anthropic',
    package: '@modelcontextprotocol/server-sqlite',
    transport: 'stdio',
    category: 'database',
    tags: ['数据库', 'sqlite', 'sql'],
    official: true,
  },
  {
    id: 'mcp-github',
    name: 'GitHub',
    description: '操作 GitHub 仓库：创建 issue、PR、搜索代码、读取文件等。',
    publisher: 'GitHub',
    package: '@modelcontextprotocol/server-github',
    transport: 'stdio',
    category: 'devtools',
    tags: ['github', 'git', '代码', 'issue', 'pr'],
    featured: true,
    scopes: ['repo:read', 'repo:write'],
  },
  {
    id: 'mcp-gitlab',
    name: 'GitLab',
    description: '操作 GitLab 项目：issue、MR、流水线、仓库文件。',
    publisher: 'modelcontextprotocol',
    package: '@modelcontextprotocol/server-gitlab',
    transport: 'stdio',
    category: 'devtools',
    tags: ['gitlab', 'git', '代码', 'mr'],
  },
  {
    id: 'mcp-puppeteer',
    name: 'Puppeteer',
    description: '通过 Puppeteer 控制浏览器，执行页面自动化与截图。',
    publisher: 'Anthropic',
    package: '@modelcontextprotocol/server-puppeteer',
    transport: 'stdio',
    category: 'web',
    tags: ['浏览器', '自动化', '截图', 'puppeteer'],
    official: true,
  },
  {
    id: 'mcp-memory',
    name: 'Memory',
    description: '基于知识图谱的长期记忆，跨会话保存实体与关系。',
    publisher: 'Anthropic',
    package: '@modelcontextprotocol/server-memory',
    transport: 'stdio',
    category: 'productivity',
    tags: ['记忆', '知识图谱', '长期'],
    official: true,
  },
  {
    id: 'mcp-slack',
    name: 'Slack',
    description: '与 Slack 工作区交互：发送消息、读取频道、搜索历史。',
    publisher: 'Slack',
    package: '@modelcontextprotocol/server-slack',
    transport: 'stdio',
    category: 'communication',
    tags: ['slack', '消息', '频道'],
    scopes: ['slack:read', 'slack:write'],
  },
  {
    id: 'mcp-google-drive',
    name: 'Google Drive',
    description: '搜索与读取 Google Drive 中的文件内容。',
    publisher: 'Anthropic',
    package: '@modelcontextprotocol/server-google-drive',
    transport: 'stdio',
    category: 'productivity',
    tags: ['google', 'drive', '文件', '云盘'],
    official: true,
    scopes: ['drive:read'],
  },
  {
    id: 'mcp-time',
    name: 'Time',
    description: '获取当前时间与时区转换，支持自定义格式。',
    publisher: 'Anthropic',
    package: '@modelcontextprotocol/server-time',
    transport: 'stdio',
    category: 'other',
    tags: ['时间', '时区', '日期'],
    official: true,
  },
]

/** MCP 分类标签映射 */
export const MCP_CATEGORY_LABELS: Record<McpCategory, string> = {
  filesystem: '文件系统',
  search: '搜索',
  database: '数据库',
  devtools: '开发工具',
  productivity: '效率工具',
  web: '网络',
  communication: '通信协作',
  other: '其他',
}

/** 按 ID 查询 MCP */
export function findMcpById(id: string): McpServer | undefined {
  return CURATED_MCP_LIST.find((item) => item.id === id)
}

/** 按分类筛选 MCP */
export function findMcpsByCategory(category: McpCategory): McpServer[] {
  return CURATED_MCP_LIST.filter((item) => item.category === category)
}

/** 获取推荐的 MCP 列表 */
export function getFeaturedMcps(): McpServer[] {
  return CURATED_MCP_LIST.filter((item) => item.featured)
}
