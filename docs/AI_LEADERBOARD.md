# 大模型排行榜 + API 中转站 + 一键导入

> 路径:`/ai-news` 页面 · 2026-07-22 立
> 参考:[arena.ai/leaderboard](https://arena.ai/leaderboard) Elo + Bootstrap CI 评分体系

## 1. 大模型排行榜

### 1.1 功能概述

- **8 大分类 + 总榜**:LLM(通用/代码/推理)/ 生图 / 视频 / 多模态 / 语音 / 嵌入 / Agent / 总榜
- **Arena 评分体系**:Elo 评分 + Bootstrap CI(置信区间)+ 排名变化 + 胜率 + 投票数
- **能力雷达图**:5 维 SVG 雷达图(coding / math / reasoning / creative / chinese)
- **表格列**:排名 / 排名变化 / 模型名 / 厂商 / Arena 评分 / 上下文窗口 / 最大输出 / 输入价 / 输出价 / License / 发布时间
- **核心亮点**:移至详情弹窗,表格行不再显示(避免两行布局)

### 1.2 数据来源

- 数据库表:`model_leaderboard`(`packages/database/src/schema/model-leaderboard.ts`)
- API 路由:`GET /api/model-leaderboard?category=<overall|llm|image|video|multimodal|audio|embedding|agent>&subcategory=<general|coding|reasoning>`
- Seed 数据:`packages/database/seed/leaderboard-seed.ts`(89 条,arena.ai 2026-07 真实数据)
- 前端 API 客户端:`apps/web/src/lib/ai-news-api.ts` → `fetchAllLeaderboardEntries()`

### 1.3 详情弹窗(ModelDetailDialog)

点击表格行打开,包含:
- **核心参数**:Arena 评分 / 排名 / 排名变化 / 胜率 / 投票数 / 上下文窗口 / 最大输出 / 输入价 / 输出价 / 发布时间 / License
- **能力雷达图**:5 维 SVG 雷达图
- **核心亮点**:模型一句话亮点
- **官方资源**:厂商官方 API Key 申请链接 + 官方文档链接
- **一键导入**:跳转到 `/settings/llm?prefill=<base64>`,预填 Provider 表单

## 2. 官方 API Key + 一键导入

### 2.1 厂商平台映射表

文件:`apps/web/app/(main)/ai-news/components/vendor-platforms.ts`

覆盖 18 个厂商:Anthropic / OpenAI / Google / Meta / Moonshot / Alibaba / Z.ai / MiniMax / Bytedance / SpaceXAI / Microsoft / ElevenLabs / Voyage AI / Cohere / BAAI / Reve / Alibaba-ATH

每个厂商映射:
- `officialKeyUrl`:官方 API Key 申请地址
- `docsUrl`:官方 API 文档地址
- `defaultBaseUrl`:默认 baseURL(用于预填)
- `providerCode`:项目内 Provider code(对应 PlatformTemplate)
- `apiFormat`:API 格式(`openai_chat` / `anthropic_messages` / `gemini_native`)
- `note`:厂商说明(注册门槛、国内是否可直连等)

### 2.2 一键导入流程

1. 用户在排行榜详情弹窗点击「一键导入」按钮
2. 前端用 `encodePrefill(payload)` 把 `{providerCode, name, baseUrlOverride, apiFormat, modelName, vendor}` 编码为 base64
3. `router.push('/settings/llm?prefill=<base64>')` 跳转
4. `/settings/llm/page.tsx` 用 `useSearchParams` 读取 `?prefill=` 参数
5. `decodePrefill(encoded)` 解码为 `Partial<ProviderFormState>`
6. 自动打开 `ProviderFormDialog`,把 `prefill` 传入
7. `ProviderFormDialog` 的 `useEffect` 检测到 `prefill` 存在时,用预填数据覆盖默认表单( apiKey 留空,需用户手动填入)
8. 用户填入 API Key 后提交,Provider 落库

## 3. API 中转站

### 3.1 公司平台性质(推荐)

文件:`apps/web/app/(main)/ai-news/components/api-relays.ts` → `COMPANY_RELAYS`

| 中转站 | 官网 | 特点 | 计费 |
|---|---|---|---|
| OpenRouter | https://openrouter.ai/ | 聚合 200+ 模型,统一 OpenAI 格式 | 按 token,部分免费额度 |
| SiliconFlow 硅基流动 | https://siliconflow.cn/ | 国内主流开源模型,国内直连快 | 按 token,部分免费 |
| Together AI | https://www.together.ai/ | 海外开源模型,支持微调 | 按 token,免费试用 |
| Fireworks AI | https://fireworks.ai/ | 海外开源模型,低延迟 | 按 token,免费试用 |
| DeepInfra | https://deepinfra.com/ | 海外开源模型,价格低 | 按 token,送新用户额度 |

每个中转站卡片有「导入」按钮,点击后跳转到 `/settings/llm?prefill=`,预填 `providerCode=openai` + `baseUrlOverride=<中转站 baseUrl>` + `name=<中转站名> 中转`。

### 3.2 个人运行性质(风险提示)

个人中转站通常以"低价转售官方 API"为卖点,但存在风险:

**风险:**
1. 可能违反官方 Terms of Service(OpenAI / Anthropic 等明确禁止 API 转售)
2. Key 有被滥用风险(对话记录可能被记录、Key 可能被二次出售)
3. 稳定性差,运营者可能随时停服跑路,余额无法追回
4. 数据安全无保障,敏感对话内容可能泄露
5. 部分中转站混合多用户 Key,可能导致限流 / 封号

**使用建议:**
1. 优先选择有公司主体的平台(如上方公司平台列表)
2. 个人中转站仅建议用于测试 / 学习,不要用于生产环境
3. 使用个人中转站时,不要提交敏感数据(公司代码、个人信息等)
4. 充值金额控制在可承受损失范围内,避免大额预存
5. 留意中转站是否提供 Key 自助管理、用量查询、对账功能

> 本项目不列具体个人中转站链接,只提供风险提示与辨别建议。

## 4. i18n

5 语言同步(`apps/web/messages/<locale>.json` 的 `aiNews` 命名空间):

| 子命名空间 | 键数 | 用途 |
|---|---|---|
| `leaderboard` | 4 | 排行榜标题/副标题/空态 |
| `detailDialog` | 21 | 详情弹窗字段标签 + 官方资源 + 一键导入 |
| `apiRelays` | 7 | API 中转站区块标题/类型/导入/风险/建议 |
| 其他(hero/comparison/live/articles/feed/hotRanking/trendChart/funding/cta) | 60+ | 资讯页其他模块 |

## 5. 守门

- `scripts/check-i18n-keys.mjs`:5 语言 key parity(阻塞)
- `scripts/scan-i18n-zh-residue.mjs zh-TW`:zh-TW 简体字残留(opencc,阻塞)
- `scripts/scan-i18n-zh-residue.mjs ko`:ko 中文残留(字符范围,阻塞)
