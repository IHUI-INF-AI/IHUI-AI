# AI 编程教学资源数据

本目录包含从全网采集的 AI 编程相关教学资源数据，已整理成适合 ihui-ai-edu 平台导入的格式。

## 数据文件说明

### Clawdbot/Moltbot AI助手
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `clawdbot-resources.json` | 完整资源汇总 | 35 |
| `clawdbot-import-articles.json` | 文章导入数据 | 5 |
| `clawdbot-import-resources.json` | 资源导入数据 | 9 |

### MCP (Model Context Protocol)
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `mcp-tutorials.json` | MCP协议开发教程 | 28 |

### Vibe Coding / AI编程
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `vibe-coding-tutorials.json` | AI编程/氛围编程教程 | 35 |

### Cursor Skills & Rules
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `cursor-skills-tutorials.json` | Cursor技能和规则教程 | 25 |

### Claude Code
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `claude-code-tutorials.json` | Claude Code CLI工具教程 | 22 |

### AI Agent 开发
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `ai-agent-tutorials.json` | LangChain/AutoGPT等框架教程 | 20 |

### 提示词工程
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `prompt-engineering-tutorials.json` | Prompt Engineering教程 | 15 |

### 社区资源
| 文件名 | 说明 | 资源数 |
|--------|------|--------|
| `ai-coding-communities.json` | Discord/GitHub社区资源 | 18 |

### 工具对比
| 文件名 | 说明 | 工具数 |
|--------|------|--------|
| `ai-coding-tools-comparison.json` | AI编程工具对比分析 | 8 |

## 资源统计总览

| 类别 | 视频 | 文章 | 官方文档 | 社区资源 | 总计 |
|------|------|------|----------|----------|------|
| Clawdbot | 4 | 12 | 9 | 2 | 27 |
| MCP | 7 | 3 | 5 | 2 | 17 |
| Vibe Coding | 2 | 6 | 0 | 5 | 13 |
| Cursor Skills | 1 | 10 | 0 | 1 | 12 |
| Claude Code | 2 | 7 | 4 | 0 | 13 |
| AI Agent | 1 | 4 | 2 | 0 | 7 |
| 提示词工程 | 1 | 3 | 0 | 1 | 5 |
| **总计** | **18** | **45** | **20** | **11** | **94** |

## 资源来源平台

| 平台 | 资源数量 | 语言 |
|------|----------|------|
| Bilibili (B站) | 8 | 中文 |
| YouTube | 10 | 中/英文 |
| 官方文档 | 20 | 中/英文 |
| 个人博客/技术文章 | 25 | 中文 |
| GitHub | 8 | 中/英文 |
| 学习平台 | 12 | 中文 |
| 技术媒体 | 11 | 中/英文 |

## 数据字段映射

### 文章数据 → content-service

```json
{
  "title": "文章标题",
  "summary": "文章摘要",
  "content": "文章内容(Markdown)",
  "cover": "封面图URL",
  "tags": ["标签1", "标签2"],
  "isOriginal": false,
  "originalUrl": "原文链接",
  "author": "作者",
  "source": "来源平台"
}
```

### 资源数据 → resource-service

```json
{
  "title": "资源标题",
  "type": "video|document|audio",
  "description": "资源描述",
  "tags": ["标签1", "标签2"],
  "externalUrl": "外部链接",
  "format": "mp4|html|pdf"
}
```

## 课程体系

已为每个主题设计完整的课程结构：

### 1. Clawdbot/Moltbot AI助手 (6章节)
- 认识Clawdbot → 环境安装 → AI模型配置 → 消息渠道集成 → 云端部署 → MCP工具

### 2. MCP协议开发 (4章节)
- 认识MCP → 环境配置 → Server开发 → 高级应用

### 3. Vibe Coding AI编程 (5章节)
- 认识Vibe Coding → 工具准备 → 提示词基础 → 第一个项目 → 进阶技能

### 4. Cursor Skills & Rules (4章节)
- Cursor基础 → Rules系统 → Skills开发 → 实战应用

### 5. Claude Code (4章节)
- 安装入门 → 核心功能 → 高级技术 → 工作流程

### 6. AI Agent开发 (4章节)
- Agent基础 → LangChain入门 → RAG应用 → 自主代理

### 7. 提示词工程 (4章节)
- 提示词基础 → 核心技巧 → 应用实践 → 高级应用

## 使用方式

### 方式1：API导入

```bash
# 导入文章
curl -X POST /auth-api/article \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @clawdbot-import-articles.json

# 导入资源
curl -X POST /auth-api/resource \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @clawdbot-import-resources.json
```

### 方式2：后台管理系统

1. 登录管理后台
2. 进入内容管理/资源管理
3. 使用批量导入功能
4. 上传对应的JSON文件

## 数据更新日期

- 采集日期：2026-01-28
- Clawdbot 版本：最新 (已改名为 Moltbot)

## 关键链接

### Clawdbot
- 官方文档：https://docs.clawd.bot
- 社区资源：https://clawbots.com

### MCP
- 官方文档：https://modelcontextprotocol.info/zh-cn/docs/
- MCP目录：https://cursormcp.dev/

### Cursor
- 学习平台：https://learn-cursor.com/
- Cursor Hub：https://cursorhub.org

### Claude Code
- 官方文档：https://code.claude.com/docs/zh-CN/
- 社区教程：https://claudecode.io/zh/guides

### Vibe Coding
- 中文平台：http://www.vibevibe.cn/
- 付费课程：https://vibecoding.hot/handbook

### LangChain
- 中文文档：https://langchain-doc.cn/

### 提示词工程
- SwanLab课程：https://docs.swanlab.cn/course/prompt_engineering_course/

## AI编程工具推荐

| 场景 | 推荐工具 | 理由 |
|------|----------|------|
| 初学者 | Cursor | VS Code熟悉度高，学习曲线平缓 |
| 高级开发者 | Claude Code | 功能强大，命令行高效 |
| 预算有限 | Cline | 完全开源免费，灵活配置 |
| 企业团队 | GitHub Copilot | 企业级安全和支持 |
| 快速原型 | Lovable/Replit | 快速验证想法 |
