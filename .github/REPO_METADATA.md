# GitHub 仓库元数据配置清单(用户在 GitHub UI 手动设置)

> 目的:提升 GitHub 内搜索权重 + 社交平台分享卡片点击率。
> 一次性配置,5 分钟完成。所有项均在 GitHub repo 主页右侧 "About" 齿轮 + Settings 里设置。

---

## 1. About 描述(About 齿轮 → Description)

精简版(推荐,220 字符以内):

```
全栈 AI 操作系统 — 8 端同源 / 176 模型 / LangGraph+MCP+A2A / Apache 2.0 开源 · 在线 Demo: ihui.ai
```

完整版(若想堆关键词,330 字符):

```
🚀 开源 AI 商业级一体化超级平台 · 8 端全覆盖(web/api/ai-service/cli/desktop/extension/mobile/miniapp)· 176 模型 · LangGraph+MCP+A2A 三栈 · 340 表 · 1300+ API · Apache 2.0 · ihui.ai
```

---

## 2. Topics 标签(About 齿轮 → Topics)

GitHub 限制 20 个 topics。以下精选 20 个高频检索词(覆盖国际+国内+技术栈+对标词):

```
ai  ai-agent  ai-platform  rag  mcp  langgraph  langchain  llm  chatgpt  claude  dify-alternative  coze-alternative  self-hosted  open-source  apache-2.0  nextjs  fastify  tauri  react-native  monorepo
```

**为什么选这 20 个**:
- `ai` / `ai-agent` / `ai-platform` / `rag` / `mcp` / `langgraph` / `langchain` / `llm` — AI 领域高频搜索词
- `chatgpt` / `claude` — 模型关键词,用户搜 chatgpt/claude 替代品时能命中
- `dify-alternative` / `coze-alternative` — 直接对标词,搜 "dify alternative" 的用户能找到
- `self-hosted` / `open-source` / `apache-2.0` — 自托管/开源用户必搜词
- `nextjs` / `fastify` / `tauri` / `react-native` / `monorepo` — 技术栈词,开发者按栈筛选时能命中

---

## 3. Website URL(About 齿轮 → Website)

```
https://ihui.ai
```

---

## 4. Social Preview(repo → Settings → Social preview)

上传 `.github/social-preview.png`(1280x640 PNG)。

生成方式(二选一):

```bash
# 方案 A(推荐,本地生成)
pnpm add -Dw sharp
node scripts/generate-social-preview.mjs

# 方案 B(免安装,在线转换)
# 把 .github/social-preview.svg 用 https://convertio.co/svg-png/ 转 PNG,尺寸 1280x640
```

上传步骤:GitHub repo → Settings → Social preview → Edit → Upload → Save。

**为什么重要**:用户在 Twitter/LinkedIn/微信/Telegram 分享 repo 链接时,社交平台会抓取 social preview 作为卡片图。没有 social preview = 卡片只有 GitHub 默认灰色 logo = 点击率低 50%+。

---

## 5. Release v1.0(repo → Releases → Draft a new release)

当前仓库 0 release,严重拉低 GitHub 搜索权重(GitHub 算法偏好有 release 的项目)。

操作:
1. 进入 repo → Releases → Draft a new release
2. Choose a tag → 输入 `v1.0.0` → Create new tag: v1.0.0 on publish
3. Release title: `v1.0.0 — 全栈 AI 操作系统正式发布`
4. Description:复制 `.github/RELEASE_NOTES_v1.0.md` 全部内容
5. 勾选 "Set as the latest release"
6. Publish release

**为什么重要**:
- GitHub 搜索结果对有 latest release 的仓库权重更高
- Release 页面是 GitHub 用户评估项目活跃度的关键信号
- star 数 < 100 的项目,release 是少数能快速提升可信度的信号之一

---

## 6. 置顶 Issue / Welcome Issue(可选,推荐)

创建一个置顶 Issue(`Welcome to IHUI-AI — Start Here!`),内容:
- 项目一句话介绍
- 5 分钟快速开始链接
- 在线 Demo 链接
- 文档链接
- Star / Fork / Watch 呼吁
- 联系方式

然后 Pin this issue。新访客进 repo 第一眼就看到引导,提升 star 转化率。

---

## 7. Discussions 开启(repo → Settings → General → Features → Discussions)

勾选 Discussions,创建 3 个默认分类:
- Announcements(公告)
- Q&A(问答)
- Ideas(功能建议)

**为什么**:Discussions 是 GitHub 社区信号,GitHub 算法对有 Discussions 活跃的仓库权重更高。也是 star 转化为长期用户的关键入口。

---

## 配置完成后自检

```bash
# 验证 social-preview.png 已生成
ls -la .github/social-preview.png

# 验证 FUNDING.yml 已就位
cat .github/FUNDING.yml

# 验证 release notes 模板已就位
cat .github/RELEASE_NOTES_v1.0.md
```

打开 https://github.com/IHUI-INF-AI/IHUI-AI 检查:
- [ ] About 描述已更新为精简版
- [ ] Topics 显示 20 个标签
- [ ] Website 显示 ihui.ai
- [ ] Social preview 显示自定义卡片(非默认 GitHub logo)
- [ ] Releases 显示 v1.0.0(latest)
- [ ] About 右侧显示 "Sponsor" 按钮
- [ ] Discussions tab 可见
