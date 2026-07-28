# IHUI AI 提示词库 v0.3.0

> **200+ 精选 AI 提示词，覆盖 20 个职业场景，即插即用，让 AI 真正为你工作。**
>
> 💰 **定价**: ¥99 (个人版) | ¥299 (团队版) | ¥999 (企业版)
> 📅 **发布日期**: 2026-07-27
> 🏷️ **版本**: v0.3.0

---

## 📦 产品概览

**IHUI AI 提示词库** 是一套精心策划的 AI 提示词数字产品，专为创业者、内容创作者、营销人员、产品经理、开发者等专业人士打造。每个提示词都经过精心设计，包含完整的变量、示例和使用场景，让你无需从零开始，立即获得专业级 AI 输出。

### ✨ 核心亮点

- 🎯 **210+ 精选提示词**: 涵盖 20 个职业分类
- 🚀 **即插即用**: 完整的 prompt_template，只需替换变量即可使用
- 📋 **结构化设计**: 每个 prompt 包含 use_case、variables、example_input、example_output
- 🌐 **多平台兼容**: 支持 ChatGPT / Claude / Gemini / 文心一言 / 通义千问 / 智谱清言 / Kimi / DeepSeek / Doubao 等
- 💼 **专业级输出**: 由行业专家审核，确保专业性和实用性
- 🔄 **持续更新**: 购买后 1 年内免费更新

---

## 📊 数据统计

| 指标 | 数值 |
|------|------|
| 🎯 提示词总数 | **210+** |
| 📚 分类总数 | **20** |
| 📏 平均 token 数 | ~950 |
| 📊 总 token 数 | ~199,500 |
| 🎓 难度分布 | 初级 30 / 中级 90 / 高级 90 |
| 🌐 语言 | 中文 (zh-CN) |
| 📄 格式 | JSON + Markdown |

---

## 📚 20 大分类

| # | 分类 | 图标 | 提示词数 | 说明 |
|---|------|------|---------|------|
| 01 | 编程开发 | 💻 | 11 | 代码生成、Code Review、重构、调试、API、架构 |
| 02 | 内容创作 | ✍️ | 11 | 文章、文案、剧本、故事、SEO、社媒 |
| 03 | 市场营销 | 📢 | 11 | 营销策划、品牌、广告、社媒、SEO、KOL |
| 04 | 商业战略 | 🎯 | 11 | 商业计划、市场分析、SWOT、战略规划 |
| 05 | 教育培训 | 📚 | 11 | 课程设计、教案、学习计划、教学方案 |
| 06 | 个人效率 | ⚡ | 11 | 时间管理、目标设定、习惯、决策 |
| 07 | 创意写作 | 🎨 | 11 | 小说、诗歌、剧本、歌词、IP 故事 |
| 08 | 数据分析 | 📊 | 11 | 数据分析、可视化、Excel、SQL、Python |
| 09 | 客户服务 | 🎧 | 11 | 客服话术、邮件、投诉处理、FAQ |
| 10 | 研究分析 | 🔬 | 11 | 文献综述、研究报告、调研、论文 |
| 11 | HR 招聘 | 👥 | 11 | 职位描述、简历筛选、面试、绩效 |
| 12 | 法律合规 | ⚖️ | 10 | 合同审查、法律风险、隐私、知识产权 |
| 13 | 财务会计 | 💰 | 10 | 财报分析、预算、成本、税务、投资 |
| 14 | 产品管理 | 📦 | 10 | PRD、用户研究、路线图、竞品分析 |
| 15 | 设计创意 | 🎨 | 11 | UI/UX、品牌、Logo、配色、设计系统 |
| 16 | 项目管理 | 📋 | 11 | 项目规划、敏捷、风险、复盘、OKR |
| 17 | 运营增长 | 📈 | 10 | AARRR、内容运营、社群、增长黑客 |
| 18 | 健康医疗 | 🏥 | 10 | 营养、健身、心理、慢病、中医 |
| 19 | 电商零售 | 🛍️ | 10 | 详情页、活动、直播、定价、会员 |
| 20 | 旅游生活 | ✈️ | 10 | 旅行、美食、家居、亲子、婚礼 |

---

## 🚀 快速开始

### 1. 选择分类

根据你的需求，从 20 个分类中选择合适的分类文件，例如：
- 想写营销文案 → `03-marketing-sales.json`
- 想分析数据 → `08-data-analysis.json`
- 想做产品规划 → `14-product-management.json`

### 2. 选择 prompt

打开分类 JSON 文件，浏览 prompts 数组，找到适合你需求的 prompt。

### 3. 替换变量

将 `prompt_template` 中的 `{variable_name}` 替换为实际值。例如：

```
原 prompt: 你是一位营销专家，请为 {product} 设计营销方案...
替换后: 你是一位营销专家，请为 IHUI AI 写作助手 设计营销方案...
```

### 4. 复制到 AI 工具

将替换后的 prompt 复制到任意 AI 工具（ChatGPT、Claude、智谱清言等）。

### 5. 获得专业输出

AI 会根据 prompt 模板生成专业级内容，包含完整的结构、表格、案例等。

---

## 📁 文件结构

```
ihui-ai-prompt-library-v0.3.0/
├── README.md                  # 本文件 - 产品介绍
├── PROMPT_CATALOG.md          # 完整 prompt 目录
├── index.json                 # 索引文件（产品元信息）
├── manifest.json              # 文件清单 + SHA256 校验（打包生成）
└── prompts/                   # 20 个分类 prompt 文件
    ├── 01-coding-development.json
    ├── 02-content-creation.json
    ├── 03-marketing-sales.json
    ├── 04-business-strategy.json
    ├── 05-education-learning.json
    ├── 06-personal-productivity.json
    ├── 07-creative-writing.json
    ├── 08-data-analysis.json
    ├── 09-customer-service.json
    ├── 10-research-analysis.json
    ├── 11-hr-recruitment.json
    ├── 12-legal-compliance.json
    ├── 13-finance-accounting.json
    ├── 14-product-management.json
    ├── 15-design-creative.json
    ├── 16-project-management.json
    ├── 17-operations-growth.json
    ├── 18-healthcare-wellness.json
    ├── 19-ecommerce-retail.json
    └── 20-travel-lifestyle.json
```

---

## 📋 Prompt 结构说明

每个 prompt 都遵循统一的结构：

```json
{
  "id": "171",
  "title": "用户增长策略",
  "description": "设计 AARRR 漏斗全链路用户增长策略。",
  "use_case": "产品冷启动、用户增长、留存提升、变现优化。",
  "prompt_template": "你是一位增长黑客专家，请基于 AARRR 模型...{product}...{stage}...",
  "variables": ["product", "stage", "dau", "goal", "budget", "timeframe"],
  "example_input": "product=IHUI AI\nstage=成长期\ndau=5 万\n...",
  "example_output": "## 诊断 北极星 DAU / 漏斗 6 阶段... ## 获客 6 渠道...",
  "tags": ["growth", "aarr", "user-acquisition"],
  "difficulty": "advanced",
  "estimated_tokens": 1000
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一 ID (1-210) |
| `title` | string | 标题 |
| `description` | string | 简短描述 |
| `use_case` | string | 适用场景 |
| `prompt_template` | string | 完整 prompt 模板（含变量占位符） |
| `variables` | array | 变量列表 |
| `example_input` | string | 示例输入 |
| `example_output` | string | 示例输出 |
| `tags` | array | 标签 |
| `difficulty` | string | 难度: beginner / intermediate / advanced |
| `estimated_tokens` | number | 预估 token 数 |

---

## 🎯 使用场景

### 个人用户

- **内容创作者**: 用内容创作 + 创意写作 prompts 快速产出优质内容
- **营销人员**: 用市场营销 + 运营增长 prompts 设计专业营销方案
- **产品经理**: 用产品管理 + 项目管理 prompts 规划产品迭代
- **开发者**: 用编程开发 + 数据分析 prompts 提升开发效率
- **创业者**: 用商业战略 + 财务会计 prompts 完善商业计划

### 企业团队

- **市场部**: 营销策划、品牌推广、社媒运营
- **产品部**: PRD 撰写、用户研究、竞品分析
- **研发部**: 代码审查、架构设计、技术文档
- **HR 部门**: 招聘、面试、绩效、培训
- **客服部门**: 话术规范、投诉处理、服务流程
- **法务部门**: 合同审查、合规管理、风险评估

---

## 💰 定价方案

| 版本 | 价格 | 授权 | 主要特性 |
|------|------|------|---------|
| **个人版** | ¥99 | 单用户 | 200+ prompts、20 分类、JSON 格式、1 年免费更新 |
| **团队版** | ¥299 | 最多 10 用户 | 个人版全部特性、团队授权、优先支持 |
| **企业版** | ¥999 | 不限用户 | 团队版全部特性、定制 prompts、商业再分发 |

### 购买方式

- **GitHub Release**: 下载 v0.3.0 release 资产
- **官网**: https://aizhs.top
- **联系**: support@aizhs.top

---

## 🌐 兼容的 AI 工具

### 国际

- ✅ ChatGPT (GPT-3.5 / GPT-4 / GPT-4o)
- ✅ Claude (Claude 3 / Claude 3.5)
- ✅ Gemini (Gemini Pro / Gemini Advanced)
- ✅ Microsoft Copilot
- ✅ Perplexity

### 国内

- ✅ 文心一言 (ERNIE Bot)
- ✅ 通义千问 (Qwen)
- ✅ 智谱清言 (GLM)
- ✅ Kimi (Moonshot)
- ✅ DeepSeek
- ✅ 豆包 (Doubao)
- ✅ 讯飞星火

### 其他

- ✅ 任何支持 prompt 输入的 AI 工具

---

## ⚠️ 重要提示

### 健康医疗类

- 所有健康医疗类 prompts (分类 18) 仅供参考
- **不能替代**医生诊断或专业医疗建议
- 疾病请及时就医，用药请遵医嘱

### 法律合规类

- 所有法律合规类 prompts (分类 12) 仅供参考
- **不能替代**专业律师意见
- 重要法律事务请咨询专业律师

### 财务会计类

- 所有财务会计类 prompts (分类 13) 仅供参考
- **不能替代**专业会计师或财务顾问
- 重要财务决策请咨询专业人士

---

## 📝 许可证

### 个人版 (¥99)

- ✅ 个人使用
- ✅ 1 年免费更新
- ❌ 不得分享、转售、再分发
- ❌ 不得用于商业培训

### 团队版 (¥299)

- ✅ 团队内使用（最多 10 人）
- ✅ 1 年免费更新
- ✅ 优先支持
- ❌ 不得对外转售

### 企业版 (¥999)

- ✅ 不限用户内部使用
- ✅ 1 年免费更新
- ✅ 定制 prompts
- ✅ 商业再分发（需保留版权）

---

## 🔄 更新日志

### v0.3.0 (2026-07-27)

- 🎉 首次发布
- ✨ 210+ 提示词
- 📚 20 个分类
- 📄 JSON + Markdown 格式

---

## 📞 联系我们

- 🏠 **官网**: https://aizhs.top
- 📧 **邮箱**: support@aizhs.top
- 🐙 **GitHub**: https://github.com/ihui-ai/ihui-ai
- 💬 **微信**: ihui-ai (备注: 提示词库)

---

## 🙏 致谢

感谢所有为这套提示词库贡献智慧的专家和早期用户。你们的反馈让产品变得更好。

---

**© 2026 IHUI AI. 保留所有权利。**

> 购买即表示同意以上许可协议。如需商业授权或定制需求，请联系 support@aizhs.top。
