/**
 * 项目内置 MCP 服务器列表（项目自有数据）
 * 数据已从 mcp.so、魔搭 mcps.live 等公开生态整理并集成到本仓库，供后端无配置时展示与使用。
 */
import type { MCPServer } from '@/api/tools/mcp'

export const MCP_CURATED_SERVERS: MCPServer[] = [
  // ----- 文件与存储 -----
  {
    id: 'curated-filesystem',
    name: 'Filesystem',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-filesystem',
    status: 'active',
    description: '安全文件操作与可配置访问控制。Secure file operations with configurable access controls.',
    capabilities: {
      tools: [
        { name: 'read_file', description: 'Read file contents' },
        { name: 'write_file', description: 'Write content to file' },
        { name: 'list_dir', description: 'List directory contents' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-fetch',
    name: 'Fetch',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-fetch',
    status: 'active',
    description: '网页内容抓取与转换，便于 LLM 使用。Web content fetching and conversion for efficient LLM usage.',
    capabilities: {
      tools: [
        { name: 'fetch', description: 'Fetch URL content' },
        { name: 'fetch_convert', description: 'Fetch and convert to markdown' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-qiniu',
    name: '七牛云 MCP',
    protocol: 'stdio',
    url: 'npx -y qiniu-mcp-server',
    status: 'active',
    description: '基于七牛云构建的 MCP Server，访问存储资源、Dora 图片处理等。',
    capabilities: {
      tools: [
        { name: 'storage_list', description: '列出存储资源' },
        { name: 'image_process', description: 'Dora 图片操作' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 代码与仓库 -----
  {
    id: 'curated-github',
    name: 'GitHub',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-github',
    status: 'active',
    description: '仓库管理、文件操作与 GitHub API 集成。Repository management, file operations, and GitHub API integration.',
    capabilities: {
      tools: [
        { name: 'search_repositories', description: 'Search GitHub repositories' },
        { name: 'get_file', description: 'Get file content from repo' },
        { name: 'create_branch', description: 'Create a new branch' },
        { name: 'create_issue', description: 'Create issue' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-gitlab',
    name: 'GitLab',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-gitlab',
    status: 'active',
    description: 'GitLab API 与项目管理。GitLab API, enabling project management.',
    capabilities: {
      tools: [
        { name: 'list_projects', description: 'List projects' },
        { name: 'get_file', description: 'Get file from repo' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 搜索与网页 -----
  {
    id: 'curated-brave-search',
    name: 'Brave Search',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-brave-search',
    status: 'active',
    description: '使用 Brave 搜索 API 进行网页与本地搜索。Web and local search using Brave Search API.',
    capabilities: {
      tools: [{ name: 'brave_web_search', description: 'Search the web with Brave' }],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-perplexity',
    name: 'Perplexity Ask',
    protocol: 'stdio',
    url: 'npx -y perplexity-mcp-server',
    status: 'active',
    description: 'Perplexity API 连接器，在 MCP 内进行网页搜索。Web search without leaving the MCP ecosystem.',
    capabilities: {
      tools: [{ name: 'perplexity_ask', description: 'Ask Perplexity' }],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-zhipu-search',
    name: '智谱 Web 搜索',
    protocol: 'stdio',
    url: 'npx -y zhipu-web-search-mcp',
    status: 'active',
    description: '面向大模型的搜索，集成多引擎，返回标题、URL、摘要等，助力动态知识获取。',
    capabilities: {
      tools: [
        { name: 'web_search', description: '多引擎网页搜索' },
        { name: 'search_compare', description: '多引擎结果对比' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-search1api',
    name: 'Search1API',
    protocol: 'stdio',
    url: 'npx -y search1api-mcp',
    status: 'active',
    description: 'One API for Search, Crawling, and Sitemaps. 搜索、爬取与站点地图一体化。',
    capabilities: {
      tools: [
        { name: 'search', description: 'Search' },
        { name: 'crawl', description: 'Crawl URL' },
        { name: 'sitemap', description: 'Get sitemap' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-serper',
    name: 'Serper MCP',
    protocol: 'stdio',
    url: 'npx -y serper-mcp-server',
    status: 'active',
    description: 'Serper 搜索 API 的 MCP 封装，用于网页搜索。',
    capabilities: {
      tools: [{ name: 'serper_search', description: 'Serper search' }],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-jina',
    name: 'Jina AI MCP Tools',
    protocol: 'stdio',
    url: 'npx -y jina-mcp-tools',
    status: 'active',
    description: '集成 Jina AI Search Foundation APIs。RAG 与搜索能力。',
    capabilities: {
      tools: [
        { name: 'jina_search', description: 'Jina 搜索' },
        { name: 'jina_reader', description: '网页内容提取' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-firecrawl',
    name: 'Firecrawl',
    protocol: 'stdio',
    url: 'npx -y @mendable/firecrawl-mcp-server',
    status: 'active',
    description: 'Official Firecrawl MCP，为 Cursor、Claude 等提供网页抓取。Official web scraping for MCP clients.',
    capabilities: {
      tools: [
        { name: 'firecrawl_scrape', description: 'Scrape URL' },
        { name: 'firecrawl_crawl', description: 'Crawl site' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 浏览器与自动化 -----
  {
    id: 'curated-playwright',
    name: 'Playwright',
    protocol: 'stdio',
    url: 'npx -y @playwright/mcp-server-playwright',
    status: 'active',
    description: '浏览器自动化与网页抓取。Browser automation and web scraping.',
    capabilities: {
      tools: [
        { name: 'playwright_navigate', description: 'Navigate to URL' },
        { name: 'playwright_screenshot', description: 'Take page screenshot' },
        { name: 'playwright_click', description: 'Click element' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-puppeteer',
    name: 'Puppeteer',
    protocol: 'stdio',
    url: 'npx -y puppeteer-mcp-server',
    status: 'active',
    description: 'Browser automation and web scraping. 基于 Puppeteer 的浏览器自动化。',
    capabilities: {
      tools: [
        { name: 'navigate', description: 'Navigate to URL' },
        { name: 'screenshot', description: 'Take screenshot' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-agentql',
    name: 'AgentQL',
    protocol: 'stdio',
    url: 'npx -y agentql-mcp',
    status: 'active',
    description: "Integrates AgentQL's data extraction capabilities. 数据提取与页面结构化。",
    capabilities: {
      tools: [
        { name: 'agentql_query', description: 'Query page with AgentQL' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 数据库 -----
  {
    id: 'curated-postgres',
    name: 'PostgreSQL',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-postgres',
    status: 'active',
    description: '只读数据库访问与 schema 查看。Read-only database access with schema inspection.',
    capabilities: {
      tools: [
        { name: 'query', description: 'Execute read-only SQL query' },
        { name: 'list_tables', description: 'List database tables' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-redis',
    name: 'Redis',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-redis',
    status: 'active',
    description: '通过标准化工具访问 Redis。MCP server for Redis key-value stores.',
    capabilities: {
      tools: [
        { name: 'redis_get', description: 'Get key' },
        { name: 'redis_set', description: 'Set key' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-neon',
    name: 'Neon MCP',
    protocol: 'stdio',
    url: 'npx -y mcp-server-neon',
    status: 'active',
    description: 'MCP server for Neon Management API and databases. Neon 数据库与 API 交互。',
    capabilities: {
      tools: [
        { name: 'neon_list_projects', description: 'List Neon projects' },
        { name: 'neon_query', description: 'Query database' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-milvus',
    name: 'MCP Server for Milvus',
    protocol: 'stdio',
    url: 'npx -y milvus-mcp-server',
    status: 'active',
    description: 'AI 应用与 Milvus 向量库自然语言交互，向量检索、集合管理。Vector search and collection management.',
    capabilities: {
      tools: [
        { name: 'vector_search', description: 'Vector similarity search' },
        { name: 'list_collections', description: 'List collections' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 地图与位置 -----
  {
    id: 'curated-amap',
    name: '高德地图',
    protocol: 'stdio',
    url: 'npx -y @amap/mcp-server-amap',
    status: 'active',
    description: '高德地图官方 MCP Server，地理编码、路径规划、POI 搜索。',
    capabilities: {
      tools: [
        { name: 'geocode', description: '地理编码' },
        { name: 'direction', description: '路径规划' },
        { name: 'search_poi', description: 'POI 搜索' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-baidu-map',
    name: '百度地图',
    protocol: 'stdio',
    url: 'npx -y baidu-map-mcp',
    status: 'active',
    description: '百度地图核心 API 兼容 MCP 协议，国内首家。',
    capabilities: {
      tools: [
        { name: 'place_search', description: '地点搜索' },
        { name: 'route_plan', description: '路线规划' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-google-maps',
    name: 'Google Maps',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-google-maps',
    status: 'active',
    description: '位置服务、路线与地点详情。Location services, directions, place details.',
    capabilities: {
      tools: [
        { name: 'place_search', description: 'Search places' },
        { name: 'directions', description: 'Get directions' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 协作与生产力 -----
  {
    id: 'curated-slack',
    name: 'Slack',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-slack',
    status: 'active',
    description: '频道管理与消息。Channel management and messaging capabilities.',
    capabilities: {
      tools: [
        { name: 'list_channels', description: 'List channels' },
        { name: 'send_message', description: 'Send message' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-flomo',
    name: 'Flomo MCP',
    protocol: 'stdio',
    url: 'npx -y mcp-server-flomo',
    status: 'active',
    description: 'Write notes to Flomo. 将笔记写入 Flomo。',
    capabilities: {
      tools: [
        { name: 'flomo_add', description: 'Add note to Flomo' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-notion',
    name: 'Notion MCP',
    protocol: 'stdio',
    url: 'npx -y notion-mcp-server',
    status: 'active',
    description: 'MCP server to provide Notion content to AI coding agents. 向 Cursor 等提供 Notion 内容。',
    capabilities: {
      tools: [
        { name: 'notion_query', description: 'Query Notion' },
        { name: 'notion_create_page', description: 'Create page' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-figma',
    name: 'Figma Context MCP',
    protocol: 'stdio',
    url: 'npx -y figma-context-mcp',
    status: 'active',
    description: 'Provide Figma layout information to AI coding agents like Cursor. Figma 布局信息供 AI 使用。',
    capabilities: {
      tools: [
        { name: 'figma_get_file', description: 'Get Figma file' },
        { name: 'figma_get_nodes', description: 'Get node tree' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- AI 与生成 -----
  {
    id: 'curated-modelscope',
    name: '魔搭 ModelScope',
    protocol: 'stdio',
    url: 'uvx modelscope-mcp',
    status: 'active',
    description: '魔搭社区 MCP：模型、数据集、AI 应用与论文检索，文生图等。',
    capabilities: {
      tools: [
        { name: 'search_models', description: '搜索模型' },
        { name: 'search_datasets', description: '搜索数据集' },
        { name: 'text_to_image', description: '文生图' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-minimax',
    name: 'MiniMax MCP',
    protocol: 'stdio',
    url: 'npx -y minimax-mcp',
    status: 'active',
    description: 'Official MiniMax MCP：TTS、图像生成、视频生成 API。Text to Speech, image and video generation.',
    capabilities: {
      tools: [
        { name: 'minimax_tts', description: 'Text to speech' },
        { name: 'minimax_image', description: 'Image generation' },
        { name: 'minimax_video', description: 'Video generation' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-everart',
    name: 'EverArt',
    protocol: 'stdio',
    url: 'npx -y everart-mcp',
    status: 'active',
    description: 'AI image generation using various models. 多模型 AI 图像生成。',
    capabilities: {
      tools: [{ name: 'generate_image', description: 'Generate image from prompt' }],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-sequential-thinking',
    name: 'Sequential Thinking',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    status: 'active',
    description: '结构化思考与问题拆解。Dynamic and reflective problem-solving through a structured thinking process.',
    capabilities: {
      tools: [{ name: 'sequential_thought', description: 'Step-by-step reasoning' }],
      resources: [],
      prompts: [],
    },
  },
  // ----- 运维与监控 -----
  {
    id: 'curated-sentry',
    name: 'Sentry',
    protocol: 'stdio',
    url: 'npx -y sentry-mcp-server',
    status: 'active',
    description: 'Retrieving and analyzing issues from Sentry.io. 从 Sentry 获取与分析问题。',
    capabilities: {
      tools: [
        { name: 'sentry_list_issues', description: 'List issues' },
        { name: 'sentry_get_issue', description: 'Get issue details' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-mailtrap',
    name: 'Mailtrap Email MCP',
    protocol: 'stdio',
    url: 'npx -y mailtrap-mcp',
    status: 'active',
    description: 'Send transactional emails via Mailtrap. 通过 Mailtrap 发送事务邮件。',
    capabilities: {
      tools: [{ name: 'send_email', description: 'Send email via Mailtrap' }],
      resources: [],
      prompts: [],
    },
  },
  // ----- 工具与工具类 -----
  {
    id: 'curated-time',
    name: 'Time',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-time',
    status: 'active',
    description: '时间与时区转换。Time and timezone conversion using IANA timezone names.',
    capabilities: {
      tools: [
        { name: 'get_current_time', description: 'Get current time' },
        { name: 'convert_timezone', description: 'Convert timezone' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-weather',
    name: 'Weather MCP',
    protocol: 'stdio',
    url: 'npx -y weather-mcp-server',
    status: 'active',
    description: 'Real-time weather data and forecasts. 实时天气与预报。',
    capabilities: {
      tools: [
        { name: 'get_weather', description: 'Get weather' },
        { name: 'get_forecast', description: 'Get forecast' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-howtocook',
    name: 'HowToCook 做饭指南',
    protocol: 'stdio',
    url: 'npx -y howtocook-mcp',
    status: 'active',
    description: '基于程序员在家做饭指南的 MCP，推荐菜谱、规划膳食，解决今天吃什么。',
    capabilities: {
      tools: [
        { name: 'recommend_recipe', description: '推荐菜谱' },
        { name: 'plan_meal', description: '规划膳食' },
        { name: 'get_recipe', description: '获取菜谱详情' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-chatsum',
    name: 'Chatsum',
    protocol: 'stdio',
    url: 'npx -y mcp-server-chatsum',
    status: 'active',
    description: 'Summarize chat message. 对话消息摘要。',
    capabilities: {
      tools: [{ name: 'summarize_chat', description: 'Summarize chat' }],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-bucket',
    name: 'Bucket Feature Flags',
    protocol: 'stdio',
    url: 'npx -y bucket-mcp',
    status: 'active',
    description: 'Flag features from chat in VS Code, Cursor, Claude Code. 在编辑器中从对话控制功能开关。',
    capabilities: {
      tools: [
        { name: 'get_flags', description: 'Get feature flags' },
        { name: 'set_flag', description: 'Set flag value' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 云与基础设施 -----
  {
    id: 'curated-aws-kb',
    name: 'AWS KB Retrieval',
    protocol: 'stdio',
    url: 'npx -y aws-kb-retrieval-mcp',
    status: 'active',
    description: 'Retrieve information from AWS Knowledge Base (Bedrock Agent Runtime). 从 AWS 知识库检索。',
    capabilities: {
      tools: [
        { name: 'retrieve', description: 'Retrieve from knowledge base' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-edgeone',
    name: 'EdgeOne Pages MCP',
    protocol: 'stdio',
    url: 'npx -y edgeone-pages-mcp',
    status: 'active',
    description: 'Deploy HTML content to EdgeOne Pages and get a public URL. 将 HTML 部署到 EdgeOne 并获取可访问 URL。',
    capabilities: {
      tools: [
        { name: 'deploy', description: 'Deploy to EdgeOne Pages' },
        { name: 'get_url', description: 'Get public URL' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 魔搭 mcps.live 整合 -----
  {
    id: 'curated-officetracker',
    name: 'Officetracker MCP',
    protocol: 'stdio',
    url: 'npx -y officetracker-mcp',
    status: 'active',
    description: '基于 MCP 的办公室出勤数据上下文服务，供 LLM 客户端通过 JSON-RPC 访问。',
    capabilities: {
      tools: [
        { name: 'get_attendance', description: '获取出勤数据' },
        { name: 'get_office_stats', description: '办公室统计' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-strands-sop',
    name: 'Strands Agent SOP MCP',
    protocol: 'stdio',
    url: 'npx -y strands-sop-mcp',
    status: 'active',
    description: '加载内置与外部 SOP，作为可调用提示注册，向 LLM 提供结构化上下文与功能提示。',
    capabilities: {
      tools: [
        { name: 'list_sops', description: 'List SOPs' },
        { name: 'invoke_sop', description: 'Invoke SOP prompt' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-cc-switch',
    name: 'cc-switch MCP',
    protocol: 'stdio',
    url: 'npx -y cc-switch-mcp',
    status: 'active',
    description: '本地 MCP 管理：创建、导入、配置与同步，数据库 SSOT，多应用一致上下文。',
    capabilities: {
      tools: [
        { name: 'list_servers', description: 'List MCP servers' },
        { name: 'switch_server', description: 'Switch active server' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-nvidia-blog',
    name: 'NVIDIA Blog MCP',
    protocol: 'stdio',
    url: 'npx -y nvidia-blog-mcp',
    status: 'active',
    description: 'NVIDIA 官方博客内容的上下文服务，检索、工具调用与提示模板，支持多种传输。',
    capabilities: {
      tools: [
        { name: 'search_blog', description: 'Search NVIDIA blog' },
        { name: 'get_article', description: 'Get article content' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-coop',
    name: 'Co-Op MCP',
    protocol: 'stdio',
    url: 'npx -y coop-mcp',
    status: 'active',
    description: '跨模型协作：资源管理、工具执行与提示渲染，JSON-RPC/HTTP 标准化通信。',
    capabilities: {
      tools: [
        { name: 'list_resources', description: 'List resources' },
        { name: 'call_tool', description: 'Call tool' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-logicapps',
    name: 'LogicApps MCP',
    protocol: 'stdio',
    url: 'npx -y logicapps-mcp',
    status: 'active',
    description: 'Azure Logic Apps 资源、工作流定义的标准化访问，JSON-RPC，Stdio 传输。',
    capabilities: {
      tools: [
        { name: 'list_workflows', description: 'List Logic App workflows' },
        { name: 'get_workflow', description: 'Get workflow definition' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-ssh-sftp',
    name: 'SSH-SFTP MCP',
    protocol: 'stdio',
    url: 'npx -y ssh-sftp-mcp',
    status: 'active',
    description: '远程 SSH 命令执行、SFTP 文件操作与会话管理，供 LLM 通过 JSON-RPC 调用。',
    capabilities: {
      tools: [
        { name: 'ssh_exec', description: 'Execute SSH command' },
        { name: 'sftp_upload', description: 'Upload via SFTP' },
        { name: 'sftp_download', description: 'Download via SFTP' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-alphavantage',
    name: 'AlphaVantage',
    protocol: 'stdio',
    url: 'npx -y alphavantage-mcp',
    status: 'active',
    description: 'Bring enterprise-grade stock market data to agents and LLMs. 企业级股市数据。',
    capabilities: {
      tools: [
        { name: 'quote', description: 'Get stock quote' },
        { name: 'timeseries', description: 'Time series data' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-kospi',
    name: 'KOSPI/KOSDAQ Stock',
    protocol: 'stdio',
    url: 'npx -y kospi-kosdaq-stock-server',
    status: 'active',
    description: 'KOSPI/KOSDAQ 股票数据 MCP server (FastMCP)。',
    capabilities: {
      tools: [
        { name: 'get_stock', description: 'Get stock data' },
        { name: 'search_stock', description: 'Search KOSPI/KOSDAQ' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-blender',
    name: 'Blender MCP',
    protocol: 'stdio',
    url: 'npx -y blender-mcp',
    status: 'active',
    description: 'BlenderMCP 连接 Blender 与 Claude，提示辅助 3D 建模、场景创建与操作。',
    capabilities: {
      tools: [
        { name: 'blender_exec', description: 'Execute in Blender' },
        { name: 'blender_render', description: 'Trigger render' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-gbox',
    name: 'GBOX Android MCP',
    protocol: 'stdio',
    url: 'npx -y gbox-mcp',
    status: 'active',
    description: 'AI Agents 操作电脑与移动设备：Android 开发/测试、桌面浏览器/终端/VSCode 等。',
    capabilities: {
      tools: [
        { name: 'gbox_android', description: 'Android device automation' },
        { name: 'gbox_desktop', description: 'Desktop automation' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 更多：开发与调试 -----
  {
    id: 'curated-mcp-advisor',
    name: 'MCP Advisor',
    protocol: 'stdio',
    url: 'npx -y mcp-advisor',
    status: 'active',
    description: 'Use the right MCP server for your needs. 根据需求推荐与安装合适的 MCP 服务。',
    capabilities: {
      tools: [
        { name: 'recommend', description: 'Recommend MCP servers' },
        { name: 'install_guide', description: 'Get installation guide' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-openrpc',
    name: 'OpenRPC MCP',
    protocol: 'stdio',
    url: 'npx -y openrpc-mcp-server',
    status: 'active',
    description: 'Discover and call JSON-RPC methods. 发现并调用 JSON-RPC 方法。',
    capabilities: {
      tools: [
        { name: 'list_methods', description: 'List JSON-RPC methods' },
        { name: 'call_method', description: 'Call method' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-sqlite',
    name: 'SQLite',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-sqlite',
    status: 'active',
    description: 'Query and manage SQLite databases. 查询与管理 SQLite 数据库。',
    capabilities: {
      tools: [
        { name: 'query', description: 'Execute SQL query' },
        { name: 'list_tables', description: 'List tables' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-memory',
    name: 'Memory',
    protocol: 'stdio',
    url: 'npx -y @modelcontextprotocol/server-memory',
    status: 'active',
    description: 'Persistent memory for LLM context. 为 LLM 提供持久化记忆。',
    capabilities: {
      tools: [
        { name: 'create_entity', description: 'Create memory entity' },
        { name: 'recall', description: 'Recall memories' },
        { name: 'update_entity', description: 'Update memory' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-302-browser',
    name: '302 Browser Use MCP',
    protocol: 'stdio',
    url: 'npx -y 302-browser-use-mcp',
    status: 'active',
    description: '自动创建远程浏览器完成指定任务，基于 Browser Use + Sandbox。',
    capabilities: {
      tools: [
        { name: 'create_browser', description: 'Create remote browser' },
        { name: 'run_task', description: 'Run browser task' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-302-sandbox',
    name: '302 Sandbox MCP',
    protocol: 'stdio',
    url: 'npx -y 302-sandbox-mcp',
    status: 'active',
    description: '创建远程沙盒，执行代码/运行命令/上传下载文件。',
    capabilities: {
      tools: [
        { name: 'create_sandbox', description: 'Create sandbox' },
        { name: 'exec', description: 'Execute command' },
        { name: 'upload', description: 'Upload file' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-pagespeed',
    name: 'PageSpeed MCP',
    protocol: 'stdio',
    url: 'npx -y mcp-server-pagespeed',
    status: 'active',
    description: 'Lighthouse PageSpeed insights for performance analysis. 页面性能分析。',
    capabilities: {
      tools: [
        { name: 'analyze', description: 'Run PageSpeed analysis' },
        { name: 'get_report', description: 'Get performance report' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 更多：文档与写作 -----
  {
    id: 'curated-google-docs',
    name: 'Google Docs MCP',
    protocol: 'stdio',
    url: 'npx -y google-docs-mcp',
    status: 'active',
    description: 'Read and write Google Docs. 读写 Google 文档。',
    capabilities: {
      tools: [
        { name: 'get_document', description: 'Get document content' },
        { name: 'append', description: 'Append to document' },
        { name: 'create_doc', description: 'Create document' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-markdown',
    name: 'Markdown MCP',
    protocol: 'stdio',
    url: 'npx -y mcp-server-markdown',
    status: 'active',
    description: 'Parse and transform Markdown. Markdown 解析与转换。',
    capabilities: {
      tools: [
        { name: 'parse', description: 'Parse markdown' },
        { name: 'to_html', description: 'Convert to HTML' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 更多：向量与 RAG -----
  {
    id: 'curated-pinecone',
    name: 'Pinecone MCP',
    protocol: 'stdio',
    url: 'npx -y pinecone-mcp',
    status: 'active',
    description: 'Vector database for RAG and similarity search. 向量存储与相似度检索。',
    capabilities: {
      tools: [
        { name: 'upsert', description: 'Upsert vectors' },
        { name: 'query', description: 'Query similar vectors' },
        { name: 'list_indexes', description: 'List indexes' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-supabase',
    name: 'Supabase MCP',
    protocol: 'stdio',
    url: 'npx -y supabase-mcp',
    status: 'active',
    description: 'Supabase database and auth. Supabase 数据库与认证。',
    capabilities: {
      tools: [
        { name: 'query', description: 'Query Supabase' },
        { name: 'insert', description: 'Insert row' },
        { name: 'auth_user', description: 'Get auth user' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 更多：多媒体与设计 -----
  {
    id: 'curated-image-gen',
    name: 'Image Generation MCP',
    protocol: 'stdio',
    url: 'npx -y image-gen-mcp',
    status: 'active',
    description: 'Multi-provider image generation (DALL·E, Stable Diffusion, etc.). 多源图像生成。',
    capabilities: {
      tools: [
        { name: 'generate', description: 'Generate image from prompt' },
        { name: 'edit', description: 'Edit image' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-puppeteer-steel',
    name: 'Steel Puppeteer MCP',
    protocol: 'stdio',
    url: 'npx -y steel-puppeteer-mcp',
    status: 'active',
    description: 'Puppeteer-based browser automation. 基于 Puppeteer 的浏览器自动化。',
    capabilities: {
      tools: [
        { name: 'navigate', description: 'Navigate to URL' },
        { name: 'screenshot', description: 'Take screenshot' },
        { name: 'pdf', description: 'Generate PDF' },
      ],
      resources: [],
      prompts: [],
    },
  },
  // ----- 更多：企业与集成 -----
  {
    id: 'curated-galaconnect',
    name: 'GalaConnect MCP',
    protocol: 'stdio',
    url: 'npx -y galachain-mcp',
    status: 'active',
    description: 'Galachain MCP server for use with LLMs. 区块链与 LLM 集成。',
    capabilities: {
      tools: [
        { name: 'get_balance', description: 'Get balance' },
        { name: 'transfer', description: 'Transfer' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-degasser',
    name: 'Degasser Design MCP',
    protocol: 'stdio',
    url: 'npx -y degasser-design-mcp',
    status: 'active',
    description: '脱气塔设计：资源管理、分层工具执行、PHREEQC 与成本评估。',
    capabilities: {
      tools: [
        { name: 'design_tier1', description: 'Tier 1 design' },
        { name: 'cost_estimate', description: 'Cost estimation' },
      ],
      resources: [],
      prompts: [],
    },
  },
  {
    id: 'curated-agentic-reliability',
    name: 'Agentic Reliability MCP',
    protocol: 'stdio',
    url: 'npx -y agentic-reliability-mcp',
    status: 'active',
    description: '多代理框架、运营可靠性、RAG 内存与安全边界的 OSS MCP 后端。',
    capabilities: {
      tools: [
        { name: 'analyze', description: 'Tool analysis' },
        { name: 'healing_intent', description: 'HealingIntent 对接' },
      ],
      resources: [],
      prompts: [],
    },
  },
]
