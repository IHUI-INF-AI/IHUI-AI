# 交叉发布指南:dev.to + Hashnode

> 把 `docs/blog/*.md` 自动发布到 dev.to 与 Hashnode 两个技术博客聚合平台,
> 通过 `canonical_url` 回指 `ihui.ai`,在不被搜索引擎判定重复内容的前提下,
> 获取第二/第三流量入口,导流回主站与 GitHub 仓库。

---

## 一、为什么要交叉发布

### 1. 多平台流量红利

- **dev.to**: 全球最大的开发者社区之一,月活开发者 ~1500 万,文章自带 SEO 权重高,
  新文章可在 24h 内进入 Google 索引,适合英文/技术深度内容。
- **Hashnode**: 面向工程师的博客平台,自带开发者读者池,文章自带封面图与 Newsletter 推送,
 适合架构/工程实践/开源项目类内容。

### 2. canonical_url 防重复内容惩罚

Google 对同一内容出现在多个域名会做"重复内容判定"(duplicate content),
原本会降权或只保留一个版本。通过 `<link rel="canonical">` 显式声明原作者:

```
原文: https://ihui.ai/blog/11-mcp-protocol-implementation-guide
转载: https://dev.to/ihui/mcp-protocol-implementation-guide
         → canonical_url 指向 https://ihui.ai/blog/11-mcp-protocol-implementation-guide
```

效果:
- ✅ 搜索引擎把所有 SEO 权重归给 `ihui.ai`
- ✅ dev.to / Hashnode 仍能正常展示文章给读者
- ✅ dev.to / Hashnode 上读者通过 footer 链接回 ihui.ai / GitHub

### 3. 二次曝光不二次写

复用 `docs/blog/*.md` 已写好的中文/英文内容,零额外写作成本即可触达新读者池。

---

## 二、前置准备

### 1. dev.to 账号与 API key

1. 注册账号: https://dev.to/enter
2. 完善个人资料(Bio / 头像 / 关联 GitHub),写一两篇短贴预热账号权重
3. 生成 API key: 打开 https://dev.to/settings/extensions
   - 找到 `DEV Community API Keys` 区块
   - 点击 `Generate a new API key`
   - 描述用途(如 `IHUI-AI cross-publish`)
   - 复制生成的 36 位 UUID

```bash
# 写入环境变量(本机)
$env:DEV_TO_API_KEY = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. Hashnode 账号、Publication 与 Token

1. 注册账号: https://hashnode.com/
2. 创建 Publication: https://hashnode.com/create/publication
   - 取一个有辨识度的名字,如 `IHUI AI Engineering`
   - 绑定一个子域,如 `ihui.hashnode.dev`
3. 获取 publicationId:
   - Publication Dashboard → Settings → Domain
   - 找到 `Publication ID`(UUID 格式)
4. 生成 Personal Access Token: https://hashnode.com/settings/developer
   - `Generate new Personal Access Token`
   - 描述用途(如 `cross-publish`)
   - 复制生成的 token

```bash
$env:HASHNODE_TOKEN = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
$env:HASHNODE_PUBLICATION_ID = "xxxxxxxxxxxxxxxxxxxxxxxx"
```

### 3. 不要把 key 提交到 git

`DEV_TO_API_KEY` / `HASHNODE_TOKEN` / `HASHNODE_PUBLICATION_ID` 仅通过环境变量传入,
脚本不硬编码任何 key。`.env` 已被 `.gitignore` 覆盖。

---

## 三、使用方法

### 1. dev.to

#### 预览(推荐首次跑,确认 payload 正确)

```bash
# 预览所有 15 篇博客的 payload
node scripts/cross-publish-devto.mjs --dry-run

# 预览单篇
node scripts/cross-publish-devto.mjs --file 11-mcp-protocol-implementation-guide.md --dry-run
```

输出示例:

```
══════════════════════════════════════════════════════════════
📦 dev.to 交叉发布 — DRY-RUN 预览
   目标: 15 篇
══════════════════════════════════════════════════════════════
────────────────────────────────────────────────────────────────
📄 11-mcp-protocol-implementation-guide.md
   title:     MCP 协议实现指南:从零构建生产级 AI 工具生态
   tags:      [mcp, modelcontextprotocol, aitools, anthropic]
   canonical: https://ihui.ai/blog/mcp-protocol-implementation-guide
   published: false
   body:      12453 chars
   Payload:
   { "article": { ... } }
...
```

#### 实际发布(默认草稿)

```powershell
$env:DEV_TO_API_KEY = "<你的 key>"
node scripts/cross-publish-devto.mjs
```

每篇文章会以草稿模式发布到 dev.to Dashboard,你审核排版后再点 "Publish"。

#### 直接发布(慎用)

```powershell
$env:DEV_TO_API_KEY = "<你的 key>"
node scripts/cross-publish-devto.mjs --publish --interval 300
```

`--interval 300` 表示每篇间隔 5 分钟,避免反垃圾系统标记。

### 2. Hashnode

#### 预览

```bash
node scripts/cross-publish-hashnode.mjs --dry-run

# 单篇预览
node scripts/cross-publish-hashnode.mjs --file 12-multi-tenant-rls-postgresql-drizzle.md --dry-run
```

#### 实际发布

```powershell
$env:HASHNODE_TOKEN = "<你的 token>"
$env:HASHNODE_PUBLICATION_ID = "<你的 publication ID>"
node scripts/cross-publish-hashnode.mjs
```

Hashnode 默认就是发布模式(没有 dev.to 的草稿中间态),
所以**强烈建议先用 `--file` 单篇发布审核排版**:

```powershell
$env:HASHNODE_TOKEN = "<...>"
$env:HASHNODE_PUBLICATION_ID = "<...>"
node scripts/cross-publish-hashnode.mjs --file 11-mcp-protocol-implementation-guide.md
```

确认 OK 后再批量。

---

## 四、canonical_url 工作原理

dev.to 与 Hashnode 在文章发布时都会在 `<head>` 注入:

```html
<link rel="canonical" href="https://ihui.ai/blog/11-mcp-protocol-implementation-guide" />
```

搜索引擎抓取 dev.to / Hashnode 页面时会看到这个 canonical,从而:

1. 把页面权重归集到 `ihui.ai`(原作者)
2. 不重复索引 dev.to / Hashnode 的副本
3. 不会因为"内容相同"对 ihui.ai 降权

**关键**: **不要关闭 canonical_url**(不要在 dev.to Dashboard 把 canonical 字段删掉,
也不要在 Hashnode 文章编辑器里改 canonical)。一旦关闭,Google 会做内容去重,
随机保留某一个版本,ihui.ai 可能失去原创权重。

---

## 五、15 篇博客推荐发布顺序

按"内容时效性 + 主题热度"分三批:

### 第一批(最新 5 篇,优先发布)

| 序号 | 文件 | 主题 |
|------|------|------|
| 11 | `11-mcp-protocol-implementation-guide.md` | MCP 协议实现(2026 热门话题) |
| 12 | `12-multi-tenant-rls-postgresql-drizzle.md` | 多租户 RLS(企业级硬需求) |
| 13 | `13-langgraph-agent-orchestration-patterns.md` | LangGraph 编排(AI Agent 热点) |
| 14 | `14-litellm-adapter-176-llms-unified.md` | LiteLLM 适配 176 模型(大模型话题) |
| 15 | `15-monorepo-8-platforms-turborepo-pnpm.md` | Monorepo 工程实践(开发者高关注) |

```bash
node scripts/cross-publish-devto.mjs --file 11-mcp-protocol-implementation-guide.md
# 间隔 5-10 分钟
node scripts/cross-publish-devto.mjs --file 12-multi-tenant-rls-postgresql-drizzle.md
# ...
```

### 第二批(架构 / 性能 / 扩展)

| 序号 | 文件 | 主题 |
|------|------|------|
| 01 | `01-8-ends-same-source-architecture.md` | 8 端同源架构 |
| 02 | `02-176-models-unified-dispatch.md` | 176 模型统一调度 |
| 03 | `03-mcp-protocol-integration.md` | MCP 协议集成 |

### 第三批(剩余 7 篇)

| 序号 | 文件 | 主题 |
|------|------|------|
| 04 | `04-rag-knowledge-base-pgvector.md` | RAG + pgvector |
| 05 | `05-open-source-monetization.md` | 开源变现 |
| 06 | `06-mcp-protocol-deep-dive.md` | MCP 协议深挖 |
| 07 | `07-rag-knowledge-base-implementation.md` | RAG 实现 |
| 08 | `08-multi-end-architecture-design.md` | 多端架构设计 |
| 09 | `09-ai-agent-marketplace-design.md` | AI Agent 市场 |
| 10 | `10-open-source-saas-monetization.md` | 开源 SaaS 变现 |

---

## 六、风险与注意事项

### 1. canonical_url 必须保留

> 不开 canonical → Google 视为重复内容 → ihui.ai 失去原创权重。
> 修复方式:在 dev.to Dashboard 编辑文章 → SEO Settings → 重新填 canonical。

### 2. tags 数量限制

- **dev.to**: 最多 4 个,每个 < 30 字符(脚本已自动截断)
- **Hashnode**: 最多 5 个,slug 必须小写英文(脚本已自动转 slug)

脚本会自动丢弃中文 tag 和过长 tag,**保留英文/缩写 tag 优先级最高**。

### 3. 不要批量快速发布

dev.to / Hashnode 都有反垃圾系统,批量快速发布会触发:

- dev.to: 账号临时限制 / 文章自动 unpublish
- Hashnode: 文章进入审核队列 / 账号权重下降

**推荐间隔**:
- 草稿模式:每篇间隔 ≥ 5 秒(`--interval 5`,默认)
- 直接发布:每篇间隔 ≥ 5 分钟(`--interval 300`)
- 批量 15 篇:分 3 天,每天 5 篇

### 4. 草稿模式优先

dev.to 默认 `published: false`,所有文章进草稿,
你登录 dev.to → Dashboard 逐篇检查:
- 排版是否被 dev.to 渲染器破坏(代码块 / 表格)
- footer 链接是否正常显示
- tags 是否被识别为有效标签(dev.to 后台会高亮无效 tag)

确认无误再点 `Publish`。

Hashnode 没有草稿中间态,**先用 `--file` 单篇发布审核**。

### 5. 内容更新时如何同步

`docs/blog/*.md` 内容更新后,需要手动同步到 dev.to / Hashnode:

- dev.to: Dashboard 找到文章 → Edit → 粘贴新 markdown → Save
- Hashnode: Editor → 找到文章 → 更新内容 → Publish

脚本目前只支持"新建发布",不支持"更新已存在文章"(避免覆盖手改的排版)。

### 6. footer 链接格式

每篇文章末尾自动追加:

```markdown
---

*This article was originally published on the [IHUI AI Blog](https://ihui.ai/blog/{slug}). Follow us on [GitHub](https://github.com/IHUI-INF-AI/IHUI-AI) for more AI engineering content.*
```

这是导流回主站与 GitHub 仓库的关键链路,**不要删除**。

---

## 七、脚本参数速查

### `scripts/cross-publish-devto.mjs`

| 参数 | 说明 |
|------|------|
| `--dry-run` | 只预览 payload,不实际发布(无需 API key) |
| `--file <name>` | 只发布单篇(支持完整文件名 / slug / 纯编号) |
| `--publish` | 直接发布(默认草稿模式) |
| `--interval <sec>` | 每篇间隔秒数(默认 5,发布模式建议 300) |

环境变量:
- `DEV_TO_API_KEY`(必填,除非 dry-run)
- `SITE_URL`(可选,默认 `https://ihui.ai`)

### `scripts/cross-publish-hashnode.mjs`

| 参数 | 说明 |
|------|------|
| `--dry-run` | 只预览 GraphQL 变量,不实际发布(无需 token) |
| `--file <name>` | 只发布单篇 |
| `--interval <sec>` | 每篇间隔秒数(默认 5,批量建议 300) |

环境变量:
- `HASHNODE_TOKEN`(必填,除非 dry-run)
- `HASHNODE_PUBLICATION_ID`(必填,除非 dry-run)
- `SITE_URL`(可选,默认 `https://ihui.ai`)

---

## 八、验证清单

发布前/后逐项检查:

- [ ] `node scripts/cross-publish-devto.mjs --dry-run` 输出 15 篇 payload
- [ ] `node scripts/cross-publish-hashnode.mjs --dry-run` 输出 15 篇 GraphQL 变量
- [ ] payload 中 `canonical_url` / `canonicalUrl` 指向 `https://ihui.ai/blog/<slug>`
- [ ] payload 中 footer 包含 `IHUI AI Blog` 与 `GitHub` 两个链接
- [ ] dev.to 草稿模式发布后,Dashboard 可见 15 篇草稿
- [ ] Hashnode 单篇发布后,文章页可见 canonical link
- [ ] `curl -s https://dev.to/ihui/<slug> | grep canonical` 输出 ihui.ai 链接
- [ ] `curl -s https://hashnode.com/post/<id> | grep canonical` 输出 ihui.ai 链接

---

## 九、相关脚本

| 脚本 | 用途 |
|------|------|
| `scripts/cross-publish-devto.mjs` | dev.to 交叉发布(本指南) |
| `scripts/cross-publish-hashnode.mjs` | Hashnode 交叉发布(本指南) |
| `scripts/indexnow-submit.mjs` | ihui.ai 主站 URL 提交到 IndexNow |
| `scripts/notify-indexnow.mjs` | ihui.ai sitemap 推送到 IndexNow |
| `scripts/generate-social-preview.mjs` | 文章社交分享图生成 |
