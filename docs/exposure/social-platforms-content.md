# IHUI AI 社交平台推广内容汇总

> Status: Draft（草稿，未发布）
> Last updated: 2026-07-27
> Owner: 项目维护者
> Purpose: 5 个社交平台推广内容的统一索引 + 执行计划

---

## 概览

为 IHUI AI v0.2.0 发布准备的 5 平台推广内容草稿，覆盖中英文社交平台。

| 平台 | 草稿位置 | 语言 | 目标受众 | 状态 |
|---|---|---|---|---|
| ProductHunt | `.trae-cn/tmp/producthunt-launch.md` | 英文 | 国际开发者 / 早期采用者 | Draft |
| V2EX | `.trae-cn/tmp/v2ex-post.md` | 中文 | 国内程序员 / 开源社区 | Draft |
| 微博 | `.trae-cn/tmp/weibo-post.md` | 中文 | 国内技术圈 / 大众泛 AI 受众 | Draft |
| Reddit | `.trae-cn/tmp/reddit-post.md` | 英文 | 国际技术社区 / 自托管爱好者 | Draft |
| 知乎 | `.trae-cn/tmp/zhihu-article.md` | 中文 | 国内深度技术读者 / 架构师 | Draft |

> 所有草稿文件位于 `.trae-cn/tmp/`（已 gitignore），本汇总位于 `docs/exposure/`（可 commit）。

---

## 各平台目标受众分析

### ProductHunt
- **受众**: 国际早期采用者、产品猎人、独立开发者、SaaS 创始人
- **画像**: 男性 25-45 岁、英语母语、对新产品高敏感、愿意 upvote + 留评
- **价值**: 国际曝光 + SEO 反链（producthunt.com 高权重）+ 早期用户获取
- **期望产出**: Top 3 Product of the Day → 500+ GitHub stars / 周

### V2EX
- **受众**: 国内程序员、独立开发者、技术决策者
- **画像**: 男性 25-40 岁、中文、对开源项目接受度高、习惯从 V2EX 发现新工具
- **价值**: 国内技术圈口碑 + 高质量 issue 反馈 + 中文社区种子用户
- **期望产出**: 100+ 回复 → 200+ GitHub stars

### 微博
- **受众**: 国内泛技术圈、AI 从业者、媒体记者
- **画像**: 男女混合 22-45 岁、对 AI 话题敏感、转发链长
- **价值**: 大众曝光 + 媒体跟进（36Kr / 极客公园常从微博找选题）+ KOL 转发链
- **期望产出**: 单条 1000+ 转发 → 媒体报道 1-2 篇

### Reddit
- **受众**: 国际技术社区、自托管爱好者、本地 LLM 玩家
- **画像**: 男性 20-40 岁、英语母语、对营销话术高度敏感、对技术深度有要求
- **价值**: 高质量技术反馈 + r/LocalLLaMA 等垂直社区精准触达 + 国际 SEO
- **期望产出**: 200+ upvotes → 300+ GitHub stars + 10+ 技术讨论评论

### 知乎
- **受众**: 国内深度技术读者、架构师、技术决策者
- **画像**: 男性 28-45 岁、长文阅读习惯、对架构细节感兴趣、决策影响力强
- **价值**: 长尾 SEO（知乎文章 Google 收录好）+ 招聘引流 + ToB 信任建立
- **期望产出**: 100+ 赞同 → 50+ GitHub stars + 5+ 企业咨询

---

## 发布时机建议

### 时间线总览（北京时间）

```
T-7 天 (周一)  │ 准备素材：6 张 ProductHunt 图、9 张微博图、3 张知乎架构图
T-3 天 (周四)  │ 预热：微博 1 条"在做点什么"悬念帖（不带链接）
T-2 天 (周五)  │ 预热：知乎发"半年做了个开源项目，下周开源"短想法
T-1 天 (周六)  │ 静默：不发任何内容，养精蓄锐
T+0 (周日)     │ ❌ 不发布（PH 周日流量低）
T+0 (周一)     │ ❌ 不发布（PH 周一竞争激烈）
T+0 (周二)     │ 🚀 主发布日
               │  00:01 PST (北京 16:01) → ProductHunt 提交
               │  10:00 北京 → 微博 1（项目发布）
               │  14:00 北京 → V2EX 帖
               │  20:00 北京 → 知乎长文
T+1 (周三)     │  14:00 北京 → 微博 2（技术深度）
               │  20:00 北京 → Reddit r/programming（美东 8:00 AM 高峰）
T+3 (周五)     │  16:00 北京 → 微博 3（求 Star）
T+7 (下周二)   │ Reddit r/selfhosted（避开 cross-post 检测）
T+10 (下周五)  │ Reddit r/LocalLLaMA（间隔 3 天以上）
```

### 为什么周二主发布

- **ProductHunt**: 周二/周三 PST 0:01 是黄金窗口（周一竞争激烈，周四后流量衰减）
- **V2EX**: 周二程序员活跃度最高（周一开会，周三-周五渐冷）
- **微博**: 周二 10:00 科技媒体选题会刚结束，抓眼球
- **知乎**: 周二晚 20:00 是长文阅读高峰
- **Reddit**: 周三美东 8:00 AM 是 r/programming 流量高峰（对应北京周三 20:00）

---

## 各平台规则提醒

### ProductHunt
- ✅ **12 小时窗口**: PST 0:01 → 12:01 是决定排名的关键期
- ✅ Maker First Comment 必须在 30 分钟内发
- ❌ **禁止 DM 求 upvote**: PH 算法检测协同 upvote，账号会被降权
- ❌ **禁止机器人/付费 upvote**: 直接 ban
- ✅ 6 张 gallery 图必备（1270x760 px）
- ✅ 开源项目天然加分（PH 偏好）

### V2EX
- ✅ **节点选择要准**: /go/programmer > /go/open_source > /go/create
- ✅ 标题前缀 [开源] / [分享创造] 点击率高
- ❌ **同一项目一个月只能发 1 次**（防刷屏）
- ❌ **不要自顶/找人顶**（降权）
- ✅ 正文必须有"自己的话"，纯链接会被折叠

### 微博
- ✅ **9 图横排**视觉冲击最大
- ✅ 1 小时内回复评论（算法加权）
- ✅ 话题标签最多 5 个
- ❌ **短链会被折叠**，曝光降 50%
- ❌ **1 小时内连发 3 条以上会限流**
- ❌ **外站二维码会被打码**（图片审核）
- ✅ 长微博用"长图"功能

### Reddit
- ✅ **"Show Reddit" 前缀**用于展示项目（类似 HN "Show HN"）
- ✅ 坦诚讲技术挑战，Reddit 文化奖励 honest engineering
- ❌ **禁止营销话术**: "game changer" / "revolutionary" / "10x" / "next-gen"
- ❌ **禁止同一天 cross-post 多个 subreddit**（算法降权）
- ✅ subreddit 间隔 3-7 天，内容做微调
- ✅ r/programming 要求 100+ karma 才能发帖

### 知乎
- ✅ **2000 字以上**才能进"长文"推荐池
- ✅ 至少 3 张图（架构图/截图/数据图）
- ✅ 加粗关键句（用户扫读习惯）
- ❌ **开头放外链会被折叠**"广告"提示
- ❌ **纯引流到公众号会降权**
- ✅ 文章末尾必须有问题（提升评论率）
- ✅ 评论 1 小时内回复（算法加权）

---

## 下一步执行计划

### 需要用户登录账号手动发布（不可自动化）

| 平台 | 操作 | 账号要求 | 备注 |
|---|---|---|---|
| ProductHunt | 提交 + 发 Maker Comment + 回复评论 | PH 账号 + Maker 身份 | 需 6 张 gallery 图 |
| V2EX | 选节点发帖 + 回复评论 | V2EX 账号（铜币≥10） | 节点选择需人工判断 |
| 微博 | 发 3 条微博 + 9 图 + 回复评论 | 微博账号 + 实名认证 | 9 图需美工处理 |
| Reddit | 发帖 + 回复评论 | Reddit 账号 100+ karma | r/programming 门槛 |
| 知乎 | 发专栏文章 + 回复评论 | 知乎账号 + 专栏权限 | 长文需配图 |

### 可半自动化的辅助工作

| 任务 | 工具 | 备注 |
|---|---|---|
| ProductHunt gallery 图设计 | Figma / 手工 | 1270x760 px，6 张 |
| 微博 9 图美工 | Canva / 手工 | 1080x1080 px，每条 9 张 |
| 知乎架构图 | Excalidraw / Mermaid | 至少 3 张 |
| 评论回复模板 | 本草稿已含 | 每平台预设应对预案 |
| 发布时机提醒 | Calendar / cron | 按时间线总览设置 |
| 数据统计 | GA + GitHub Insights | 发布后 7 天复盘 |

### 不可自动化的原因

- **账号实名/认证**: 各平台都要求人工 KYC
- **图片审核**: 微博/知乎图片需人工上传
- **评论互动**: 真实回复不能脚本化（会被识别降权）
- **节点/标签选择**: 需人工判断当前社区氛围
- **anti-bot 检测**: Reddit/PH 对自动化发布封号严格

### 建议执行顺序

1. **本周内**: 完成 6 张 ProductHunt 图 + 9 张微博图 + 3 张知乎架构图
2. **下周一**: 草稿终审（请信任的 3-5 位朋友 review 文案）
3. **下周二 16:01 (北京)**: ProductHunt 提交（PST 0:01）
4. **下周二 10:00-20:00**: 微博 1 / V2EX / 知乎依次发布
5. **下周三 20:00**: Reddit r/programming
6. **T+3 周五 16:00**: 微博 3（求 Star）
7. **T+7 / T+10**: Reddit r/selfhosted / r/LocalLLaMA
8. **T+14**: 7 天数据复盘，决定是否做第二轮

---

## 风险与应对

| 风险 | 应对 |
|---|---|
| ProductHunt 排名低 | 重点抓 qualitative feedback，不强求 Top 3 |
| V2EX 被踩 | 准备技术深度补充评论，不防御性回复 |
| 微博限流 | 检查话题标签是否触发 spam 检测，必要时删除重发 |
| Reddit 被踩 | 检查是否触犯 anti-marketing 规则，诚实承认问题 |
| 知乎被折叠 | 检查外链位置，移到文末 |
| Demo 站崩溃 | 准备静态 fallback 页 + CDN 缓存 |

---

## 附录：草稿文件清单

| 文件 | 路径 | 内容 |
|---|---|---|
| ProductHunt | `d:\桌面\项目\IHUI-AI\.trae-cn\tmp\producthunt-launch.md` | 提交字段 + Maker Comment + Launch Day Checklist |
| V2EX | `d:\桌面\项目\IHUI-AI\.trae-cn\tmp\v2ex-post.md` | 标题 + 正文 + 评论应对预案 |
| 微博 | `d:\桌面\项目\IHUI-AI\.trae-cn\tmp\weibo-post.md` | 3 条文案 + 9 图占位 + 话题策略 |
| Reddit | `d:\桌面\项目\IHUI-AI\.trae-cn\tmp\reddit-post.md` | Title + Body + anti-marketing 规则 |
| 知乎 | `d:\桌面\项目\IHUI-AI\.trae-cn\tmp\zhihu-article.md` | 8 节长文 + 架构图占位 |
| 本汇总 | `d:\桌面\项目\IHUI-AI\docs\exposure\social-platforms-content.md` | 平台索引 + 执行计划 |

> 草稿状态: 未发布。所有链接为产品真实链接，发布前需用户确认。
