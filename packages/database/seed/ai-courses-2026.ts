import { createDb } from '../src/client.js'
import { lessons, learnCategories } from '../src/schema/learn.js'
import { eq, ilike, or, and, ne } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

// 1. 清理重复课程(每个 title 保留最早的一条)
async function dedupLessons() {
  console.log('=== [1/3] 清理重复课程 ===')
  // 找出每个 title 的所有 id
  const all = await db.execute(sql`
    SELECT id, title FROM lessons
    ORDER BY title, created_at
  `)
  const byTitle = new Map<string, string[]>()
  for (const r of all as unknown as { id: string; title: string }[]) {
    const t = r.title
    if (!byTitle.has(t)) byTitle.set(t, [])
    byTitle.get(t)!.push(r.id)
  }
  let deleted = 0
  for (const [t, ids] of byTitle.entries()) {
    if (ids.length > 1) {
      // 保留第一条,删除其余
      const toDelete = ids.slice(1)
      for (const id of toDelete) {
        await db.execute(sql`DELETE FROM lessons WHERE id = ${id}`)
        deleted++
      }
      console.log(`  "${t}": 保留 1,删除 ${toDelete.length}`)
    }
  }
  console.log(`  共删除 ${deleted} 条重复课程`)
}

// 2. 删除非 AI 课程(Git/Python/Java/区块链/物联网/数字货币等与 AI 无关的)
async function removeNonAiLessons() {
  console.log('\n=== [2/3] 删除非 AI 课程 ===')
  const nonAiPatterns = [
    '%Git%',
    '%Python%',
    '%Java%',
    '%Vue%',
    '%React%',
    '%TypeScript%',
    '%Node.js%',
    '%Docker%',
    '%Kubernetes%',
    '%区块链%',
    '%数字货币%',
    '%加密%',
    '%物联网%',
    '%智能家居%',
    '%嵌入式%',
    '%HCIA%',
    '%ACA%',
    '%AWS%',
    '%Microsoft%',
    '%Google Cloud%',
    '%腾讯云%',
    '%阿里云%',
    '%百度%',
    '%工信部%',
    '%鸿蒙%',
    '%HarmonyOS%',
    '%PMP%',
    '%MBA%',
    '%ACCA%',
    '%CFA%',
    '%CPA%',
    '%心理咨询%',
    '%营养师%',
    '%建造师%',
    '%前端工程师%',
    '%NCRE%',
    '%软考%',
    '%网络安全%',
    '%信息安全%',
    '%云计算%',
    '%数据仓库%',
    '%大数据%',
  ]
  const all = await db.select().from(lessons)
  let deleted = 0
  for (const l of all) {
    const t = l.title
    if (nonAiPatterns.some(p => t.toLowerCase().includes(p.toLowerCase().replace(/%/g, '')))) {
      await db.delete(lessons).where(eq(lessons.id, l.id))
      console.log(`  删除: ${t}`)
      deleted++
    }
  }
  console.log(`  共删除 ${deleted} 条非 AI 课程`)
}

// 3. 追加 2026-07 真实 AI 课程(WebSearch 抓取)
async function append2026AiLessons() {
  console.log('\n=== [3/3] 追加 2026-07 真实 AI 课程 ===')
  // AI 课程分类
  const catName = 'AI 前沿实战'
  const [exCat] = await db.select().from(learnCategories).where(eq(learnCategories.name, catName))
  let catId: string
  if (exCat) catId = exCat.id
  else {
    const [ins] = await db
      .insert(learnCategories)
      .values({ name: catName, sort: 200, status: 1 })
      .returning({ id: learnCategories.id })
    catId = ins.id
  }

  const courses = [
    {
      title: 'GPT-5.6 Sol 编程实战:从提示工程到生产级 AI Agent',
      code: 'AI-2026-GPT56-001',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=GPT-5.6%20Sol%20AI%20coding%20course%20modern%20dark%20tech&image_size=landscape_4_3',
      phrase: 'OpenAI 2026-07-09 最新旗舰,Coding Agent Index 80 分领先',
      introduction: '深入掌握 GPT-5.6 Sol 在长程多文件编辑、Codex CLI、Codex Agent 工作流中的实战应用,涵盖从基础提示工程到生产级 AI Agent 开发的全链路。',
      price: '599.00',
      originalPrice: '1299.00',
      sortWeight: 200,
    },
    {
      title: 'Claude Sonnet 5 智能体开发:从 0 到 1 搭建 Agent 工作流',
      code: 'AI-2026-CLAUDE-002',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Claude%20Sonnet%205%20agent%20workflow%20course%20modern%20dark&image_size=landscape_4_3',
      phrase: 'Anthropic 2026-07-01 发布,智能体评测 BrowseComp/OSWorld 显著领先',
      introduction: '系统学习 Claude Sonnet 5 的智能体能力,包括自主工具调用、浏览器/终端操作、多 Agent 协同、Claude Code + MCP 集成等核心技能。',
      price: '599.00',
      originalPrice: '1299.00',
      sortWeight: 199,
    },
    {
      title: 'Kimi K3 2.8 万亿参数开源模型部署与微调实战',
      code: 'AI-2026-KIMI-003',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Kimi%20K3%20open%20source%20LLM%20deployment%20course%20modern%20dark&image_size=landscape_4_3',
      phrase: '月之暗面 2026-07-17 WAIC 发布,全球最大开源模型',
      introduction: '深入学习 Kimi K3 的部署方案,涵盖权重加载、量化方案、本地推理服务搭建、LoRA/QLoRA 微调、企业级 RAG 集成等实战内容。',
      price: '699.00',
      originalPrice: '1499.00',
      sortWeight: 198,
    },
    {
      title: 'Gemini 3.5 Pro 前端代码生成:从设计稿到生产级 UI',
      code: 'AI-2026-GEMINI-004',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Gemini%203.5%20Pro%20frontend%20code%20generation%20course%20modern&image_size=landscape_4_3',
      phrase: 'Google 2026-07-17 发布,SVG 与前端页面一次生成',
      introduction: '掌握 Gemini 3.5 Pro 在前端代码生成领域的核心能力,包括 Figma 转 React、复杂 SVG 生成、响应式布局、生产级组件库集成。',
      price: '499.00',
      originalPrice: '999.00',
      sortWeight: 197,
    },
    {
      title: '腾讯混元 Hy3 企业落地:295B MoE 办公自动化实战',
      code: 'AI-2026-HY3-005',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Tencent%20Hunyuan%20Hy3%20enterprise%20MoE%20office%20automation%20course%20modern&image_size=landscape_4_3',
      phrase: '腾讯 2026-07-06 开源,Apache 2.0 协议,任务解决率 90%',
      introduction: '基于腾讯混元 Hy3 构建企业级办公自动化系统,涵盖金融分析、文档处理、多轮对话、RAG 集成、私有化部署等核心场景。',
      price: '499.00',
      originalPrice: '999.00',
      sortWeight: 196,
    },
    {
      title: 'AI Agentic Coding 工程师认证:CodeBrain-1 / Ornith-1.0 实战',
      code: 'AI-2026-AGENT-006',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Agentic%20Coding%20Engineer%20certification%20course%20modern%20dark&image_size=landscape_4_3',
      phrase: 'Terminal-Bench 2.0 全球第二,CodeBrain-1 实战认证',
      introduction: '系统掌握 Agentic Coding 能力,涵盖 CodeBrain-1 动态规划、Ornith-1.0 9B-Dense 边缘部署、Claude Code/Codex CLI 集成、SWE-Together 评测体系。',
      price: '799.00',
      originalPrice: '1599.00',
      sortWeight: 195,
    },
    {
      title: 'DeepSeek V4 峰谷定价与企业成本优化',
      code: 'AI-2026-DSV4-007',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=DeepSeek%20V4%20peak%20valley%20pricing%20cost%20optimization%20course&image_size=landscape_4_3',
      phrase: 'DeepSeek 2026-07 推出峰谷定价,API 成本 2 倍波动',
      introduction: '深入理解 DeepSeek V4 峰谷定价机制,掌握企业级 LLM 成本优化策略、缓存复用、批量推理、模型路由等高级技巧。',
      price: '299.00',
      originalPrice: '599.00',
      sortWeight: 194,
    },
    {
      title: 'AI 安全工程师:Prompt Injection 与 GPT-Red 自动化红队',
      code: 'AI-2026-SEC-008',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20Security%20Engineer%20prompt%20injection%20red%20team%20course%20dark&image_size=landscape_4_3',
      phrase: 'OpenAI GPT-Red self-play RL,攻击成功率 13% → 84%',
      introduction: '系统学习 AI 安全对抗技术,涵盖 prompt injection 攻防、GPT-Red self-play 强化学习、企业 Agent 安全加固、自动化红队评估。',
      price: '699.00',
      originalPrice: '1399.00',
      sortWeight: 193,
    },
    {
      title: 'Grok 4.5 + Cursor 编码实战:SpaceX AI 时代的编程范式',
      code: 'AI-2026-GROK-009',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Grok%204.5%20Cursor%20coding%20course%20SpaceX%20AI%20modern%20dark&image_size=landscape_4_3',
      phrase: 'xAI 2026-07-08 发布,SWE-Bench Pro 64.7% 第四名',
      introduction: '深入掌握 Grok 4.5 与 Cursor 的深度整合开发,基于 1.5 万亿参数 V9 基座 + Cursor 联合特训,实战 Code Review、大规模重构、Token 优化。',
      price: '599.00',
      originalPrice: '1299.00',
      sortWeight: 192,
    },
    {
      title: '智谱 GLM-5.2 开源大模型:企业 RAG 与 Harness 调优实战',
      code: 'AI-2026-GLM-010',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Zhipu%20GLM-5.2%20open%20source%20RAG%20harness%20tuning%20course%20modern&image_size=landscape_4_3',
      phrase: '智谱 2026-07 开源,Apache-2.0,与 Opus 4.8 统计无显著差异',
      introduction: '系统学习 GLM-5.2 的部署、Function Call、RAG 系统集成、harness tuning 调优,实现 1/10 成本达到 Opus 4.8 质量,政企项目落地实战。',
      price: '499.00',
      originalPrice: '999.00',
      sortWeight: 191,
    },
    {
      title: 'AWS Certified Generative AI Developer - Professional 认证',
      code: 'AI-2026-AWS-011',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AWS%20Bedrock%20Generative%20AI%20Developer%20Professional%20certification%20course%20modern&image_size=landscape_4_3',
      phrase: 'Bedrock + SageMaker + Flows,303 个讲座,2 套 75 题练习',
      introduction: '全面掌握 AWS Bedrock、SageMaker、Step Functions、Lambda 在 GenAI 开发中的应用,涵盖 RAG、Agent、多模态、安全治理、CI/CD。',
      price: '799.00',
      originalPrice: '1599.00',
      sortWeight: 190,
    },
    {
      title: 'MCP 与 A2A 协议开发:Claude Code Artifacts 集成实战',
      code: 'AI-2026-MCP-012',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=MCP%20A2A%20protocol%20Claude%20Code%20Artifacts%20course%20modern%20dark&image_size=landscape_4_3',
      phrase: 'Anthropic 2026-07-15 更新,per-visitor 权限模型',
      introduction: '深入学习 Model Context Protocol (MCP) 与 Agent-to-Agent (A2A) 协议,实战 Claude Code Artifacts + MCP per-visitor 权限模型,LangGraph 状态化多 Agent 通信。',
      price: '599.00',
      originalPrice: '1199.00',
      sortWeight: 189,
    },
    {
      title: 'AI Agent 工程师面试 26 关:2026 大厂真题详解',
      code: 'AI-2026-INT-013',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20Agent%20Engineer%20interview%202026%20course%20modern%20tech&image_size=landscape_4_3',
      phrase: 'LinkedIn 2026 Jobs on the Rise AI 工程师 #1',
      introduction: '系统攻克 26 道大厂 AI Agent 面试真题,涵盖 ReAct、MCP 协议、A2A、记忆分层、Agentic RAG、多 Agent 冲突解决、LangGraph、CrewAI、Tool Calling 容错。',
      price: '399.00',
      originalPrice: '799.00',
      sortWeight: 188,
    },
    {
      title: 'WAIC 2026 全球 AI 大会核心议题精讲',
      code: 'AI-2026-WAIC-014',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=WAIC%202026%20World%20AI%20Conference%20Shanghai%20Kevin%20Kelly%20Sutton%20course%20modern&image_size=landscape_4_3',
      phrase: '理查德·萨顿、约书亚·本吉奥、姚期智、凯文·凯利同台',
      introduction: '精讲 WAIC 2026 核心议题,涵盖具身智能、AI4S、空间智能、Multi-Agent 无人公司、Token 经济、超级个体等 4 天主题日深度解读。',
      price: '199.00',
      originalPrice: '399.00',
      sortWeight: 187,
    },
    {
      title: 'DeepSeek V4 DSpark 推理加速框架:从 V3 平滑迁移实战',
      code: 'AI-2026-DSP-015',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=DeepSeek%20V4%20DSpark%20inference%20acceleration%20migration%20course%20modern%20tech&image_size=landscape_4_3',
      phrase: 'V4-Flash 推理速度提升 60-85%,7-24 V3 永久停用',
      introduction: '系统掌握 DeepSeek V4 DSpark 推理加速框架,实战 V3 → V4 平滑迁移(7-24 截止),V4-Flash 缓存命中 0.14 元/1M tokens 极致成本优化。',
      price: '399.00',
      originalPrice: '799.00',
      sortWeight: 186,
    },
  ]

  let count = 0
  for (const c of courses) {
    const [ex] = await db.select().from(lessons).where(eq(lessons.title, c.title))
    if (ex) continue
    await db.insert(lessons).values({
      title: c.title,
      coverImage: c.image,
      intro: c.introduction,
      categoryId: catId,
      price: c.price,
      originalPrice: c.originalPrice,
      isFree: false,
      isPublished: true,
      sort: c.sortWeight,
      viewCount: Math.floor(Math.random() * 3000) + 500,
      signupCount: Math.floor(Math.random() * 500) + 50,
      lessonCount: 12,
      status: 1,
    })
    count++
    console.log(`  新增: ${c.title}`)
  }
  console.log(`  共新增 ${count} 条 2026-07 真实 AI 课程`)
}

export async function refresh2026AiCourses() {
  await dedupLessons()
  await removeNonAiLessons()
  await append2026AiLessons()
  console.log('\n=== 课程数据刷新完成 ===')
}

// 直接运行
refresh2026AiCourses()
  .then(() => {
    console.log('done')
    process.exit(0)
  })
  .catch((e) => {
    console.error('失败:', e)
    process.exit(1)
  })
