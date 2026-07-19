import { createDb } from '../src/client.js'
import { eq } from 'drizzle-orm'
import { liveCategories, liveChannels, liveLecturers } from '../src/schema/live.js'
import { examCategories, examPapers, examQuestions } from '../src/schema/exam.js'
import { newsCategories, newsArticles } from '../src/schema/news.js'
import { askCategories } from '../src/schema/ask-extra.js'
import { asks, circles } from '../src/schema/community.js'
import { resources, resourceCategories } from '../src/schema/resource.js'
import { upsertByUnique } from './_utils/upsert-by-unique.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

// ============================================================================
// 真实 AI 资讯(2026-07 WebSearch 抓取)
// 数据来源:
//   - sohu.com (2026-07-15): GPT-5.6 vs Gemini 3.5 Pro vs Claude Sonnet 5 横向对比
//   - dutchstartup.ai (2026-07-13): Major model releases and price cuts dominate AI market
//   - blog.jls42.org (2026-07-15): OpenAI bolsters GPT-5.6 with GPT-Red
//   - m.sohu.com (2026-07-09): 7月AI扎堆:DeepSeek V4/Grok 4.5/Gemini 3 Pro/GPT-5.6
//   - renovateqr.com (2026-06-08): AI Models in June 2026 - Claude Opus 4.8
//   - m.guanhai.com.cn (2026-07-17): 2.8万亿!全球参数最大的开源模型 Kimi K3 发布
//   - csdn.net (2026-07-10): AI技术前沿动态简报 - 腾讯混元 Hy3、ICML 2026
//   - thenextgentechinsider.com (2026-07-07): SWE-Together Launches Interactive Coding-Agent Benchmark
//   - communeify.com (2026-06-29): Ornith-1.0 开源 Agentic Coding 模型
//   - baai.ac.cn (2026-02-12): Feeling AI CodeBrain-1 全球 Terminal-Bench 2.0 第二
//   - naturalnews.com (2026-05-26): Qwen3.7-Max 自主 agent 任务
//   - 7days-ai (2026-07-09): GPT-5.6 系列发布与定价
//   - tldl.io (2026-07-13): Latest AI Model Releases 指南
//   - brianletort.ai (2026-07-11): AI Stack Weekly Issue 12 W28
//   - q4km.ai (2026-07-07): July 17 AI Showdown: Gemini 3.5 Pro vs DeepSeek V4
//   - vc.ru (2026-07-12): Главные LLM июля 2026
//   - tokenfind.cn (2026-07-09): 2026年7月AI大模型发布潮实测
//   - ifeng.com (2026-07-17): 2026世界人工智能大会(WAIC 2026)今日开幕
//   - sh.bendibao.com (2026-07-16): 2026世界人工智能大会直播入口
//   - toutiao.com (2026-07-17): CSDN 深度探访 WAIC 2026 / 京东 Aidol 创造营
//   - m.guanhai.com.cn (2026-07-15): DeepSeek 完成 500 亿元融资
//   - zdnet.com (2026-07-08): SpaceX 600 亿美元收购 Cursor
//   - 0daydown.com (2026-07): AI Engineering Fundamentals: Build Real LLM Apps in Python
//   - udemy.com (2026-07): Ultimate AWS Certified Generative AI Developer Professional
//   - codeintra.com (2026-07-07): Certified AI Engineer Masterclass: Build AI Agents 2026
//   - dev.to (2026-06-29): The AI Agent Interview Master Guide: 26 Questions 2026
//   - careerservices.upenn.edu (2026-06-25): 45+ AI Engineer Interview Questions 2026
//   - csdn.net (2026-07-15): AI Agent 工程师顶尖大厂修炼手册
//   - xm.sce.tsinghua.edu.cn (2026-04~07): 清华大学 大模型工程师学习班
// ============================================================================

async function seedLive() {
  console.info('[直播] 开始导入 AI 主题直播频道...')

  // 1. 直播分类 (使用 upsertByUnique 工具, 替代 if(ex)/else insert 模式)
  const cats = [
    { name: 'AI 前沿发布', sort: 1 },
    { name: 'AI 学术研究', sort: 2 },
    { name: 'AI 工程师实战', sort: 3 },
    { name: 'AI 产业应用', sort: 4 },
  ]
  const catMap: Record<string, string> = {}
  for (const c of cats) {
    const result = await upsertByUnique(db, {
      table: liveCategories,
      uniqueBy: { column: liveCategories.name, value: c.name },
      insertValues: { name: c.name, sort: c.sort, status: 1 },
      updateValues: { sort: c.sort, status: 1 },
    })
    catMap[c.name] = String(result.id)
  }

  // 2. 讲师
  const lecturers = [
    {
      name: 'AI 前沿观察',
      title: 'AI 行业分析师',
      avatar: 'https://api.dicebear.com/9.x/initials/svg?seed=AI',
    },
    {
      name: '王立铭',
      title: 'AI 科学家',
      avatar: 'https://api.dicebear.com/9.x/initials/svg?seed=WLM',
    },
    {
      name: 'TechCrunch 中文',
      title: '科技媒体',
      avatar: 'https://api.dicebear.com/9.x/initials/svg?seed=TC',
    },
  ]
  const lectMap: Record<string, string> = {}
  for (const l of lecturers) {
    // R82 升级:upsertByUnique 替代 if (ex) ... else insert,返回 id 直接写入 map
    const { id } = await upsertByUnique(db, {
      table: liveLecturers,
      uniqueBy: { column: liveLecturers.name, value: l.name },
      insertValues: { ...l, status: 1 },
    })
    lectMap[l.name] = String(id)
  }

  // 3. 直播频道(2026-07 真实热点)
  const channels = [
    {
      title: 'GPT-5.6 Sol 首发深度解读:三档分层如何重塑 AI 编程?',
      intro:
        'OpenAI 于 2026 年 7 月 9 日正式发布 GPT-5.6 系列,Sol/Terra/Luna 三档分层,本场直播拆解 Sol 在 Coding Agent Index 上 80 分领先的实战表现。',
      category: 'AI 前沿发布',
      lecturer: 'AI 前沿观察',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      isLive: true,
      sort: 100,
    },
    {
      title: 'Claude Sonnet 5 智能体能力实战:从 0 到 1 搭建 Agent 工作流',
      intro:
        'Anthropic 在 7 月 1 日发布 Claude Sonnet 5,号称迄今为止最具智能体能力的中端模型。本场演示 Sonnet 5 在 BrowseComp、OSWorld-Verified 等智能体评测中的突破。',
      category: 'AI 工程师实战',
      lecturer: '王立铭',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      isLive: true,
      sort: 99,
    },
    {
      title: 'Kimi K3 2.8 万亿参数开源大模型深度拆解',
      intro:
        '月之暗面 7 月 17 日在 WAIC 2026 发布 Kimi K3,2.8 万亿参数,原生视觉理解,100 万 token 上下文。本场剖析它在编程、视觉、长程任务上的综合表现。',
      category: 'AI 前沿发布',
      lecturer: 'AI 前沿观察',
      cover: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
      isLive: true,
      sort: 98,
    },
    {
      title: 'Gemini 3.5 Pro 前端代码生成王者:从设计稿到生产级 UI',
      intro:
        'Google DeepMind 7 月 17 日发布 Gemini 3.5 Pro,2M 上下文 + 全新"深度思考"模式,SVG 生成与前端页面一次成型。本场展示实际项目对比 Fable 5 的优势。',
      category: 'AI 工程师实战',
      lecturer: '王立铭',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      isLive: false,
      sort: 97,
    },
    {
      title: 'ICML 2026 杰出论文精读:扩散语言模型的灵活性陷阱与 A3C 时间检验奖',
      intro:
        'ICML 2026 在首尔公布年度奖项,清华-阿里《The Flexibility Trap》与 MIT-Yale 扩散采样研究获杰出论文奖,DeepMind A3C 时隔十年再获时间检验奖。',
      category: 'AI 学术研究',
      lecturer: 'AI 前沿观察',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      isLive: false,
      sort: 96,
    },
    {
      title: '腾讯混元 Hy3 开源实战:295B MoE 在办公自动化场景的真实表现',
      intro:
        '腾讯 7 月 6 日发布混元 Hy3,Apache 2.0 协议开源,256K 上下文,WorkBuddy 任务解决率从 72% 提升到 90%。本场演示金融建模与前端设计场景。',
      category: 'AI 产业应用',
      lecturer: 'TechCrunch 中文',
      cover:
        'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
      isLive: false,
      sort: 95,
    },
    {
      title: 'WAIC 2026 主论坛现场直播:理查德·萨顿强化学习主旨演讲',
      intro:
        '2026 WAIC 主论坛 7 月 17 日 14:00 启幕,强化学习之父理查德·萨顿做主旨演讲,凯文·凯利、约书亚·本吉奥、姚期智同台,主题"智能伙伴 共创未来"。',
      category: 'AI 前沿发布',
      lecturer: 'AI 前沿观察',
      cover:
        'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
      isLive: true,
      sort: 94,
    },
    {
      title: 'Grok 4.5 + Cursor 编码实战:在 1.5 万亿参数模型上做 Code Review',
      intro:
        'xAI 7 月 8 日发布 Grok 4.5,SpaceX 600 亿美元收购 Cursor 后首次深度整合。本场展示 Grok 4.5 在大型 Next.js / Docker 项目重构中的实战表现。',
      category: 'AI 工程师实战',
      lecturer: '王立铭',
      cover: 'https://x.ai/images/news/grok-4-5-og.png',
      isLive: false,
      sort: 93,
    },
    {
      title: 'DeepSeek V4 峰谷定价 + DSpark 加速:从 V3 迁移到 V4 实战',
      intro:
        '7 月 24 日 V3 API ID 永久停用。本场演示 V4 峰谷定价最优利用策略(19:00 - 次日 9:00 调用),DSpark 框架部署,V4-Flash 缓存命中 0.14 元 / 1M tokens。',
      category: 'AI 工程师实战',
      lecturer: 'TechCrunch 中文',
      cover: 'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg',
      isLive: true,
      sort: 92,
    },
    {
      title: '智元远征 A3 Ultra 人形机器人:WAIC 2026 十大镇馆之宝',
      intro:
        '智元机器人全尺寸人形机器人远征 A3 Ultra 入选 WAIC 2026 十大"镇馆之宝",唯一入选的具身智能机器人。本场直击 208 款具身智能终端,300+ 台真机演示。',
      category: 'AI 产业应用',
      lecturer: 'AI 前沿观察',
      cover: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
      isLive: false,
      sort: 91,
    },
  ]

  let count = 0
  for (const ch of channels) {
    // R82 升级:onConflictDoNothing 替代 if (ex) continue,基于 live_channels_title_uniq 唯一索引
    const { id, action } = await upsertByUnique(db, {
      table: liveChannels,
      uniqueBy: { column: liveChannels.title, value: ch.title },
      insertValues: {
        title: ch.title,
        coverImage: ch.cover,
        intro: ch.intro,
        categoryId: catMap[ch.category] ?? null,
        lecturerId: lectMap[ch.lecturer] ?? null,
        lecturerName: ch.lecturer,
        isLive: ch.isLive,
        isPublished: true,
        viewCount: Math.floor(Math.random() * 5000) + 500,
        sort: ch.sort,
        status: 1,
        startTime: new Date(Date.now() - Math.random() * 30 * 86400 * 1000),
      },
    })
    if (action === 'inserted') count++
    void id
  }
  console.info(`[直播] 完成,新增 ${count} 条`)
}

async function seedExam() {
  console.info('[考试] 开始导入 AI 题库...')

  // 1. 试卷分类
  const cats = [
    { name: 'AI 基础概念', sort: 1 },
    { name: '大模型与 LLM', sort: 2 },
    { name: 'AI 智能体与 Agent', sort: 3 },
    { name: 'AI 编程与工具', sort: 4 },
  ]
  const catMap: Record<string, string> = {}
  for (const c of cats) {
    // R82 升级:upsertByUnique 替代 if (ex) ... else insert
    const { id } = await upsertByUnique(db, {
      table: examCategories,
      uniqueBy: { column: examCategories.name, value: c.name },
      insertValues: { name: c.name, sort: c.sort, status: 1 },
    })
    catMap[c.name] = String(id)
  }

  // 2. 试卷(基于真实 2026-07 热点)
  const papers = [
    {
      title: '2026 年 7 月 AI 大模型旗舰横评:GPT-5.6 / Claude Sonnet 5 / Gemini 3.5 Pro / Kimi K3',
      description:
        '覆盖 OpenAI、Anthropic、Google、Moonshot 四大厂商 7 月发布的旗舰模型核心参数、定价、推理能力、Agent 表现。',
      category: '大模型与 LLM',
      duration: 30,
      difficulty: 4,
      questions: [
        {
          type: 'single_choice',
          title: 'OpenAI GPT-5.6 系列三款模型中,主打"日常主力"且价格仅为旗舰一半的是?',
          options: [
            { key: 'A', text: 'Sol' },
            { key: 'B', text: 'Terra' },
            { key: 'C', text: 'Luna' },
            { key: 'D', text: 'Codex' },
          ],
          answer: 'B',
          analysis:
            'GPT-5.6 系列采用天体命名分层:Sol 旗舰($5/$30 per M)、Terra 均衡($2.50/$15,价格砍半)、Luna 轻量($1/$6)。Terra 性能与 GPT-5.5 相当但价格减半,主攻企业批量场景。',
          score: '10',
        },
        {
          type: 'single_choice',
          title: '2026 年 7 月 17 日在上海 WAIC 大会发布的全球最大开源模型是?',
          options: [
            { key: 'A', text: 'DeepSeek V4' },
            { key: 'B', text: '腾讯混元 Hy3' },
            { key: 'C', text: 'Kimi K3' },
            { key: 'D', text: 'Qwen3.7-Max' },
          ],
          answer: 'C',
          analysis:
            '月之暗面 Kimi K3 在 2026 WAIC 大会发布,参数规模达 2.8 万亿,是目前全球参数最大的开源模型,原生支持视觉理解,具备 100 万 token 上下文窗口。',
          score: '10',
        },
        {
          type: 'multi_choice',
          title: 'Anthropic Claude Sonnet 5 在 2026 年 7 月的关键能力包括哪些?',
          options: [
            { key: 'A', text: '可制定计划、调用浏览器和终端等工具自主运行' },
            { key: 'B', text: '在智能体评测 BrowseComp 与 OSWorld-Verified 显著优于 Sonnet 4.6' },
            { key: 'C', text: '部分任务能力接近 Opus 4.8' },
            { key: 'D', text: '完全开源免费,无任何 API 定价' },
          ],
          answer: ['A', 'B', 'C'],
          analysis:
            'Claude Sonnet 5 由 Anthropic 在 7 月 1 日发布,官方称"迄今为止最具智能体能力的 Sonnet 模型",可在浏览器/终端自主运行,部分任务接近 Opus 4.8 能力。但 D 错误:Sonnet 5 入门价 $3,9 月后涨价 50%。',
          score: '15',
        },
        {
          type: 'judgment',
          title:
            'Google Gemini 3.5 Pro 推迟两个月发布是因为 DeepMind 选择了"质量优先于速度"的预训练策略。',
          options: [
            { key: 'true', text: '正确' },
            { key: 'false', text: '错误' },
          ],
          answer: true,
          analysis:
            '据 Geeky Gadgets 报道,DeepMind 放弃了原有的 2.5 Pro 基座,转而对 Gemini 3.5 Pro 进行全新预训练,发布时间从 6 月推迟至 7 月 17 日,体现质量优先决策。',
          score: '10',
        },
        {
          type: 'single_choice',
          title: 'OpenAI 内部使用的自动化红队模型 GPT-Red 主要用于?',
          options: [
            { key: 'A', text: '替代人类客服' },
            { key: 'B', text: '加固 GPT-5.6 抗 prompt injection 攻击' },
            { key: 'C', text: '生成营销文案' },
            { key: 'D', text: '训练图像生成模型' },
          ],
          answer: 'B',
          analysis:
            'GPT-Red 是 OpenAI 2026 年 7 月 15 日披露的内部自动化红队模型,采用 self-play 强化学习,帮助 GPT-5.6 抗 prompt injection,直接攻击成功率从 13% 提升到 84%,但永不对外公开。',
          score: '10',
        },
      ],
    },
    {
      title: 'AI 智能体与 Agentic Coding 实战能力测验',
      description:
        '聚焦 Qwen3.7-Max、Ornith-1.0、CodeBrain-1 等智能体模型在长程任务、自主编码、Terminal-Bench 2.0 等基准上的表现。',
      category: 'AI 智能体与 Agent',
      duration: 25,
      difficulty: 4,
      questions: [
        {
          type: 'single_choice',
          title: 'Qwen3.7-Max 在自主 agent 任务中最令人瞩目的能力是?',
          options: [
            { key: 'A', text: '35 小时不间断执行,完成 1000+ 工具调用' },
            { key: 'B', text: '只能处理图像,不能处理文本' },
            { key: 'C', text: '完全免费,无 API 费用' },
            { key: 'D', text: '只能运行在本地 CPU 上' },
          ],
          answer: 'A',
          analysis:
            'Qwen 团队披露 Qwen3.7-Max 在 35 小时的 kernel 优化任务中完成 1000+ 工具调用,实现 10 倍加速。',
          score: '10',
        },
        {
          type: 'single_choice',
          title: '在 Terminal-Bench 2.0 排名中,CodeBrain-1 来自哪家公司?',
          options: [
            { key: 'A', text: 'OpenAI' },
            { key: 'B', text: 'Anthropic' },
            { key: 'C', text: 'Feeling AI(中国)' },
            { key: 'D', text: 'Google' },
          ],
          answer: 'C',
          analysis:
            'Feeling AI 凭借 CodeBrain-1 在 Terminal-Bench 2.0 中以 72.9% 跃居全球第二,仅次于 OpenAI 5.3-Codex 的官配 Simple Codex,是中国 AI 在 Agentic 自主编码领域的突破。',
          score: '10',
        },
        {
          type: 'multi_choice',
          title: 'Ornith-1.0 开源 Agentic Coding 模型家族包含哪些版本?',
          options: [
            { key: 'A', text: '9B-Dense' },
            { key: 'B', text: '31B-Dense' },
            { key: 'C', text: '35B-MoE' },
            { key: 'D', text: '397B-MoE' },
          ],
          answer: ['A', 'B', 'C', 'D'],
          analysis:
            'Ornith-1.0 由 DeepReinforce 团队开源,基于 Gemma 4 + Qwen 3.5 后训练,推出 9B/31B/35B/397B 四个版本,覆盖从边缘设备到旗舰推理。',
          score: '15',
        },
        {
          type: 'judgment',
          title:
            'SWE-Together 是 2026 年发布的 AI 编码 agent 交互式评测基准,采用 pass@1 和 pass² 等指标。',
          options: [
            { key: 'true', text: '正确' },
            { key: 'false', text: '错误' },
          ],
          answer: true,
          analysis:
            'SWE-Together 于 2026 年 7 月发布,包含 109 个真实软件工程任务,通过 pass@1、pass²、token 消耗、稳定性等指标评估 agent 的多轮调试与长程推理能力。Claude-Opus-4.8 暂列榜首(pass@1 52%)。',
          score: '10',
        },
      ],
    },
    {
      title: 'AI 产业趋势与开源生态综合测验',
      description:
        '覆盖腾讯混元 Hy3、DeepSeek V4、Qwen3.7-Max、CodeBrain-1 等中国 AI 生态 2026 年关键进展。',
      category: '大模型与 LLM',
      duration: 20,
      difficulty: 3,
      questions: [
        {
          type: 'single_choice',
          title: '腾讯混元 Hy3 采用了什么协议开源?',
          options: [
            { key: 'A', text: 'GPL v3' },
            { key: 'B', text: 'MIT' },
            { key: 'C', text: 'Apache 2.0' },
            { key: 'D', text: '商业专有' },
          ],
          answer: 'C',
          analysis:
            '腾讯混元 Hy3 在 2026 年 7 月 6 日发布,采用 Apache 2.0 协议开源,295B 总参数 / 21B 激活参数,256K 上下文,3.8B 多令牌预测层。',
          score: '10',
        },
        {
          type: 'single_choice',
          title: 'DeepSeek V4 推出的"峰谷定价"中,高峰时段是?',
          options: [
            { key: 'A', text: '每天 0-6 点' },
            { key: 'B', text: '每天 9-12 点、14-18 点' },
            { key: 'C', text: '每天 18-24 点' },
            { key: 'D', text: '周末全天' },
          ],
          answer: 'B',
          analysis:
            'DeepSeek V4 峰谷定价:高峰为早 9-12 点、下午 14-18 点,API 价格是平时的 2 倍,平时保持 V4 原价。官方称是为了调配资源提升服务稳定性。',
          score: '10',
        },
        {
          type: 'multi_choice',
          title: 'Cerebras 在 2026 年 7 月公布的欧洲算力扩张计划包括?',
          options: [
            { key: 'A', text: '2026 年底前启用首批欧洲数据中心算力' },
            { key: 'B', text: '推进法国和北欧地区数据中心建设' },
            { key: 'C', text: '2027 年底欧洲总算力容量扩展至 200 MW' },
            { key: 'D', text: '完全停用美国本土算力' },
          ],
          answer: ['A', 'B', 'C'],
          analysis:
            'Cerebras 7 月 9 日宣布欧洲扩张:2026 年底启用首批算力、推进法国/北欧建设、2027 年底达 200 MW,部分算力将支持 OpenAI 工作负载。',
          score: '15',
        },
      ],
    },
  ]

  let paperCount = 0
  let questionCount = 0
  for (const p of papers) {
    // R82 升级:upsertByUnique 替代 if (ex) ... else insert
    const { id: paperId, action: paperAction } = await upsertByUnique(db, {
      table: examPapers,
      uniqueBy: { column: examPapers.title, value: p.title },
      insertValues: {
        title: p.title,
        description: p.description,
        categoryId: catMap[p.category] ?? null,
        totalScore: String(p.questions.reduce((s, q) => s + Number(q.score), 0)),
        passScore: '60',
        duration: p.duration,
        isPublished: true,
        difficulty: p.difficulty,
        questionCount: p.questions.length,
        status: 1,
      },
    })
    if (paperAction === 'inserted') paperCount++
    for (let i = 0; i < p.questions.length; i++) {
      const q = p.questions[i]
      // R82 升级:upsertByUnique 替代 if (qex) continue
      const { id: qId, action: qAction } = await upsertByUnique(db, {
        table: examQuestions,
        uniqueBy: { column: examQuestions.title, value: q.title },
        insertValues: {
          paperId: String(paperId),
          type: q.type,
          title: q.title,
          options: q.options,
          answer: q.answer,
          analysis: q.analysis,
          score: q.score,
          difficulty: p.difficulty,
          sortOrder: i + 1,
        },
      })
      if (qAction === 'inserted') questionCount++
      void qId
    }
  }
  console.info(`[考试] 完成,新增 ${paperCount} 张试卷 / ${questionCount} 道题`)
}

async function seedNews() {
  console.info('[资讯/文章] 开始导入 2026-07 真实 AI 资讯...')

  const cats = [
    { name: 'AI 模型发布', sort: 1 },
    { name: 'AI 学术前沿', sort: 2 },
    { name: 'AI 产业动态', sort: 3 },
    { name: 'AI 安全与治理', sort: 4 },
  ]
  const catMap: Record<string, string> = {}
  for (const c of cats) {
    // R82 升级:upsertByUnique 替代 if (ex) ... else insert
    const { id } = await upsertByUnique(db, {
      table: newsCategories,
      uniqueBy: { column: newsCategories.name, value: c.name },
      insertValues: { name: c.name, sort: c.sort, status: 1 },
    })
    catMap[c.name] = String(id)
  }

  const articles = [
    {
      title: 'GPT-5.6 系列正式上线:三档分层定价,Sol 编程能力领先所有模型',
      summary:
        'OpenAI 于 2026 年 7 月 9 日发布 GPT-5.6 系列三款模型 Sol/Terra/Luna,采用天体命名分层,Sol 在 Coding Agent Index 以 80 分领先,价格仅约 Fable 5 的三分之一。',
      content: `# GPT-5.6 系列正式上线

OpenAI 于 2026 年 7 月 9 日正式发布 GPT-5.6 系列三款模型,分别为旗舰版 Sol、均衡版 Terra 与轻量版 Luna。

## 三档分层定价

- **Sol**(旗舰):$5 / 1M input tokens,$30 / 1M output tokens
- **Terra**(均衡):$2.50 / 1M input,$15 / 1M output,价格砍半
- **Luna**(轻量):$1 / 1M input,$6 / 1M output

三款模型上下文窗口均为 1.05M tokens,最大输出 128K tokens。

## 性能表现

- Sol 在 Artificial Analysis Intelligence Index 得分 59 分,仅比 Claude Fable 5 低 1 分,成本仅约三分之一
- Sol 在 Coding Agent Index 以 80 分领先所有模型
- Token 使用效率比前代提升 54%

## 生态整合

OpenAI 将独立运行的 Codex 应用正式并入 ChatGPT 桌面客户端,Chat、Work、Codex 三大功能统一入口。同步推出 ChatGPT Work 智能体,可跨邮箱、日历、Slack、云盘、CRM 连续工作。`,
      category: 'AI 模型发布',
      author: 'AI 前沿观察',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      sort: 100,
      isPinned: true,
    },
    {
      title: 'Claude Sonnet 5 发布:最具智能体能力的中端模型,3 美元起入门',
      summary:
        'Anthropic 于 7 月 1 日发布 Claude Sonnet 5,智能体搜索评测 BrowseComp 与计算机使用评测 OSWorld-Verified 显著优于 Sonnet 4.6,部分任务接近 Opus 4.8。',
      content: `# Claude Sonnet 5

Anthropic 在 2026 年 6 月 30 日发布 Claude Sonnet 5,官方称其为"迄今为止最具智能体能力的 Sonnet 模型"。

## 核心能力

- 制定计划、调用浏览器和终端等工具,以自主方式运行
- 在智能体评测 BrowseComp、OSWorld-Verified 中显著优于 Sonnet 4.6
- 部分任务上接近 Opus 4.8

## 定价策略

- 入门价仅 3 美元,卡在精准位置:向上能力逼近 Opus 4.8 和 GPT-5.5,向下价格接近 Gemini 3.5 Flash
- 推广期至 8 月 31 日,9 月后将涨价 50%

## 三家策略对比

- OpenAI:三档分层覆盖全市场
- 谷歌:"重练地基"押注前端能力
- Anthropic:用极致性价比抢占智能体赛道`,
      category: 'AI 模型发布',
      author: 'AI 前沿观察',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      sort: 99,
      isPinned: true,
    },
    {
      title: 'Kimi K3 重磅发布:2.8 万亿参数,全球最大开源模型',
      summary:
        '月之暗面在 2026 WAIC 大会发布 Kimi K3,2.8 万亿参数,100 万 token 上下文,原生支持视觉理解,综合智能水平仅次于 Claude Fable 5 与 GPT-5.6 Sol。',
      content: `# Kimi K3 全球最大开源模型

2026 年 7 月 17 日,2026 世界人工智能大会(WAIC)在上海开幕,月之暗面发布新一代模型 Kimi K3,参数规模达 2.8 万亿,这是目前全球参数最大的开源模型。

## 核心能力

- 原生支持视觉理解
- 100 万词元上下文窗口
- 面向软件工程、知识工作、深度研究、多模态理解等复杂任务优化
- 综合智能水平仅次于 Claude Fable 5 与 GPT-5.6 Sol 两个前沿闭源模型

## 应用场景

- 数字作品生成:结合 3D 推理、编程和视觉能力
- 金融研究、产业分析:对公司文件、行业数据组织分析
- 软件工程:前端工程、游戏开发、基础设施优化、科研编程

完整权重即将发布,模型架构、训练和评测细节将随模型技术报告陆续公布。`,
      category: 'AI 模型发布',
      author: '央视新闻',
      cover: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
      sort: 98,
      isPinned: true,
    },
    {
      title: 'Gemini 3.5 Pro 7 月 17 日发布:2M 上下文,前端代码生成王者',
      summary:
        '谷歌 DeepMind 放弃原 2.5 Pro 基座,全新预训练 Gemini 3.5 Pro,主打"质量优先于速度",SVG 与前端页面一次生成,精度极高。',
      content: `# Gemini 3.5 Pro

谷歌 DeepMind 放弃了原有的 2.5 Pro 基座,转而对 Gemini 3.5 Pro 进行全新预训练,发布时间从原定的 6 月推迟至 7 月 17 日,这一决策被外界解读为谷歌在质量与速度之间主动选择前者。

## 核心参数

- 200 万 Token 上下文窗口
- 全新"深度思考"推理模式
- 面向复杂智能体工作流的系统,围绕动作执行、子智能体、编程、多模态生成和长时程任务构建

## 核心优势

Gemini 3.5 Pro 最突出的能力是前端与视觉代码生成。SVG 生成能力大幅增强,复杂矢量图形可一次生成且精度更高,前端页面完成度极高。开发者圈子里"mogging"(彻底压制)一词开始流行。

但是在硬核推理、仓库级软件工程以及长链路任务上,Gemini 3.5 Pro 依然无法撼动 Fable 5 的地位。

谷歌同时基于同一底座推出图像模型 Nano Banana Pro,对标 OpenAI 的 GPT-Image 2。`,
      category: 'AI 模型发布',
      author: 'AI 前沿观察',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      sort: 97,
      isPinned: false,
    },
    {
      title: 'OpenAI 推出 GPT-Red:自动化红队加固 GPT-5.6 抗 prompt injection',
      summary:
        'GPT-Red 是 OpenAI 内部自动化红队模型,采用 self-play 强化学习,帮助 GPT-5.6 抗 prompt injection,直接攻击成功率从 13% 提升到 84%,永不对外公开。',
      content: `# GPT-Red

2026 年 7 月 15 日,OpenAI 推出 GPT-Red,这是一个内部自动化红队模型,用于持续探测 GPT-5.6 等模型的 prompt injection 漏洞。

## 工作原理

- 通过 self-play 强化学习训练
- 攻击者在模型成功诱导出不良行为时获得奖励
- 防御者模型族学习在不损害原始任务的前提下抵抗攻击

## 性能数据

- 在学术场景中(GPT-Red 攻击成功率 84% vs 人类红队 13%)
- 集成到 GPT-5.6 训练后,失败率较四个月前的最佳生产模型降低 6 倍
- 残余失败率 0.05%

## 实战案例

- 办公室自动售货机 agent:成功让 GPT-5.6 把高价商品降价到 0.5 美元
- Codex CLI agent:在 10 个数据外泄场景中比简单 prompt baseline 更有效且 token 更省

模型严格内部使用,永不公开部署。`,
      category: 'AI 安全与治理',
      author: 'OpenAI 官方',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      sort: 96,
      isPinned: false,
    },
    {
      title: '腾讯混元 Hy3 正式开源:295B MoE,Apache 2.0 协议,办公任务解决率提升至 90%',
      summary:
        '腾讯 7 月 6 日发布混元 Hy3,采用混合专家架构,295B 总参数 / 21B 激活参数,256K 上下文,WorkBuddy 任务解决率从 72% 提升到 90%,已接入 WorkBuddy、元宝、ima 等业务。',
      content: `# 腾讯混元 Hy3

2026 年 7 月 6 日,腾讯正式发布混元 Hy3 模型,采用 MoE 架构,总参数 2950 亿、激活参数 210 亿,支持 256K 上下文长度,采用快慢思考融合的设计。

## 性能提升

- 幻觉率从 12.5% 降至 5.4%
- 多轮问题率从 17.4% 降至 7.9%
- WorkBuddy 办公场景任务解决率从 72% 提升到 90%,平均耗时缩短 34%
- 业务 RAG 场景幻觉率较预览版下降 44%,常识错误率降低 12.3%

## 开源与定价

- Apache 2.0 协议开源
- 输入定价 1 元/百万 Token
- 输出定价 4 元/百万 Token

## 业务接入

已接入腾讯 WorkBuddy、元宝、ima 等业务。在编程、办公、金融、前端设计、游戏开发等生产力场景进步显著,工具调用稳定性达到生产级标准。`,
      category: 'AI 产业动态',
      author: '腾讯混元',
      cover:
        'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
      sort: 95,
      isPinned: false,
    },
    {
      title: 'ICML 2026 杰出论文揭晓:扩散语言模型灵活性陷阱与 A3C 时间检验奖',
      summary:
        '清华-阿里《The Flexibility Trap》与 MIT-Yale 扩散采样研究获杰出论文奖,DeepMind A3C 时隔十年再获时间检验奖。',
      content: `# ICML 2026 奖项

第 43 届国际机器学习大会(ICML 2026)于 7 月 6 日至 11 日在韩国首尔举行,共评出 10 篇获奖论文,涵盖 2 篇杰出论文奖、1 篇杰出立场论文奖、5 篇荣誉提名及 1 篇时间检验奖。

## 杰出论文

- 清华大学与阿里巴巴合作《The Flexibility Trap: Rethinking the Value of Arbitrary Order in Diffusion Language Models》:探讨扩散式语言模型任意顺序生成的局限性,提出简洁的 JustGRPO 方法
- 麻省理工学院与耶鲁大学:扩散模型高精度采样的算法研究

## 时间检验奖

DeepMind 等提出的《Asynchronous Methods for Deep Reinforcement Learning》(A3C 算法)。A3C 时隔十年获时间检验奖,印证异步强化学习框架对后续研究的基础性贡献。

## 关注焦点

获奖论文反映出机器学习研究的两大持续焦点:扩散范式在语言模型与生成采样中的理论深化,以及强化学习经典方法的长期影响力。`,
      category: 'AI 学术前沿',
      author: '机器之心',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      sort: 94,
      isPinned: false,
    },
    {
      title: 'CodeBrain-1 跻身全球 Terminal-Bench 2.0 第二:中国 AI 在 Agentic 编码领域突破',
      summary:
        'Feeling AI 凭借 CodeBrain-1 在 Terminal-Bench 2.0 中以 72.9% 跃居全球第二,仅次 OpenAI 5.3-Codex,中国 AI 在 Agentic 复杂任务规划与自主编码领域工程化能力已达世界顶尖。',
      content: `# CodeBrain-1

Feeling AI 凭借 CodeBrain-1 在权威榜单 Terminal-Bench 2.0 中强势突围,以 72.9% 跃升全球第二,仅次于 OpenAI 5.3-Codex。

## 技术架构

CodeBrain 具备动态规划与策略调整能力,作为"进化大脑",原创跨模态分层架构包含三层核心:

- **InteractBrain**:理解、记忆与规划
- **InteractSkill**:能力执行
- **InteractRender**:渲染呈现

## 性能对比

- OpenAI 5.3-Codex + Simple Codex:77.3%
- Feeling AI CodeBrain-1:72.9%
- Anthropic Claude Opus 4.6:65.4%

## 业务影响

- MemBrain1.0 在 LoCoMo/LongMemEval/PersonaMem-v2 等记忆基准评测中拿下 SOTA
- KnowMeBench Level III 评测结果大幅提升超 300%
- 在 AI 技术圈和资本押注的新风口 Agentic Memory 方向先打出第一张牌

强大的记忆能力以及适配模型原生的层级化记忆系统,意味着 Agentic AI 正从模型能力逐步走向用户体验层面的范式跃迁。`,
      category: 'AI 学术前沿',
      author: '新智元',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      sort: 93,
      isPinned: false,
    },
    {
      title: 'Grok 4.5 正式发布:马斯克联手 Cursor,半价 Claude 的编码黑马',
      summary:
        'xAI 于 2026 年 7 月 8 日发布 Grok 4.5,在 Cursor 代码数据上做特训,SWE-Bench Pro 64.7% 排名第四,价格 $2/$6 per M tokens,号称"半价 Claude" 的编码黑马。',
      content: `# Grok 4.5 编码黑马

xAI 在 2026 年 7 月 8 日发布 Grok 4.5,由 SpaceX AI 团队打造,基于 1.5 万亿参数的 V9 基础模型。

## 核心数据

- **价格**:$2 / 1M input,$6 / 1M output tokens(约为 Claude Opus 4.8 的一半)
- **上下文**:256K tokens
- **SWE-Bench Pro**:64.7%(位列所有模型第 4)
- **Token 效率**:完成同等任务消耗仅 Opus 的 1/4

## 训练特色

- 与 Cursor 联合特训(代码数据深度优化)
- 接入 X (Twitter) 实时数据,人设最跳脱
- 不在 EU 首发,后续补

## 实战体感

- 写 Next.js 前端重构、Docker-compose 配置时主力
- 思路活,代码完成度高
- 缺点:中文表现稍逊,查实时信息严重依赖 X

马斯克同时宣布 SpaceX AI 今年每月都将发布从头训练的完整新模型,预示以 600 亿美元收购 Cursor 后 AI 版图加速整合。`,
      category: 'AI 模型发布',
      author: 'xAI 官方',
      cover: 'https://x.ai/images/news/grok-4-5-og.png',
      sort: 92,
      isPinned: true,
    },
    {
      title: 'DeepSeek V4 正式版上线:峰谷定价 + DSpark 加速 85%,国内大模型性价比之王',
      summary:
        'DeepSeek V4 于 2026 年 7 月 17 日正式 GA,引入"峰谷分时计费"(9-12、14-18 高峰价格 2 倍),联合北大发布 DSpark 推理加速框架,V4-Flash 单用户生成速度提升 60% 至 85%。',
      content: `# DeepSeek V4 峰谷定价

DeepSeek V4 正式版于 2026 年 7 月 17 日上线,同步引入"峰谷分时计费"模式,这是大型语言模型厂商首创。

## 定价策略

| 时段 | 时段名称 | V4 Pro 价格 | V4 Flash 价格 |
|---|---|---|---|
| 9:00-12:00、14:00-18:00(北京时间) | 高峰 | ¥6 / ¥12 per M | ¥2 / ¥4 per M |
| 其他时段 | 谷值 | ¥3 / ¥6 per M | ¥1 / ¥2 per M |

缓存命中情况下,V4-Flash 输入价格低至 ¥0.14 / 1M tokens。

## DSpark 推理加速

DeepSeek 联合北大发布 DSpark 推理加速框架:

- V4-Flash 单用户生成速度提升 **60% 至 85%**
- V4-Pro 提升 **57% 至 78%**
- 昇腾 910B / 950 深度适配,私有化部署方案成熟

## 迁移截止

- 旧版 \`deepseek-chat\` / \`deepseek-reasoner\` API ID 永久停用:**2026 年 7 月 24 日 15:59 UTC**
- 迁移目标:\`deepseek-v4-pro\` 与 \`deepseek-v4-flash\`

## 商业影响

DeepSeek 完成 500 亿元融资,首次对外发布开源技术成果。V4 系列具备 OpenAI / Anthropic 兼容 API,支持自托管。`,
      category: 'AI 模型发布',
      author: 'DeepSeek 官方',
      cover: 'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg',
      sort: 91,
      isPinned: true,
    },
    {
      title: 'WAIC 2026 在上海开幕:9 位图灵奖诺奖得主参会,凯文·凯利畅谈具身智能',
      summary:
        '2026 世界人工智能大会于 7 月 17 日在上海世博/张江/西岸"三地四馆"启幕,持续 4 天,强化学习之父理查德·萨顿主旨演讲,凯文·凯利参加荣耀"从数字屏幕到具身智能"分论坛。',
      content: `# WAIC 2026 全球 AI 盛会

2026 世界人工智能大会暨人工智能全球治理高级别会议(WAIC 2026)于 7 月 17 日至 20 日在上海"三地四馆"(世博、张江、西岸)同步启幕。

## 大会规模

- 1100+ 家企业参展
- 300+ 款 AI 新品全球首发
- 展览面积首次突破 10 万平方米
- 3000+ 项展品集中亮相
- 140+ 场论坛,1400+ 位中外嘉宾
- 9 位图灵奖、诺贝尔奖得主参会

## 顶级嘉宾

- **理查德·萨顿**(强化学习之父):主旨演讲
- **约书亚·本吉奥**(深度学习三巨头):推介联合国 AI 治理工作框架
- **吉勒斯·布拉萨德**(2025 图灵奖)、**奥马尔·M·亚吉**(2025 诺贝尔奖):探讨 AI4S 新范式
- **凯文·凯利**:参加荣耀"从数字屏幕到具身智能"分论坛
- **姚期智**(图灵奖):首届"WAIC Academic"大会主席

## 主题日

- **Day 1 智能新生**:Agent、多模态、推理模型、世界模型、AI for Science
- **Day 2 奇点之光**:空间智能、自动驾驶、人形机器人
- **Day 3 伙伴同行**:Multi-Agent"无人公司"、Token 经济、太空算力
- **Day 4 共创未来**:SAIL 奖、青年优秀论文奖、未来城市与未来职业

## 标志性展品

- 华为 Atlas 950 超节点,最大支持 8192 张昇腾 950DT 芯片
- 东方算芯 DF1000:全球首颗软件定义近存计算 3D 芯片
- 全球首款 AI 智能体手机(努比亚)
- 智元机器人远征 A3 Ultra 全尺寸人形机器人(入选十大"镇馆之宝")
- 208 款具身智能终端、300+ 台真机亮相

## 政策礼包

- 算力"先用后付"+ 三个"一百万"(算力、Token、语料)
- 浦东"模速空间"、徐汇"模力社区":最高 100% 租金减免
- AI4S"百团百项":5 亿元专项基金`,
      category: 'AI 产业动态',
      author: '观察者网',
      cover:
        'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
      sort: 90,
      isPinned: true,
    },
    {
      title: 'SK hynix 完成 265 亿美元 IPO:HBM4 内存成 AI 时代最大赢家',
      summary:
        'SK hynix 于 2026 年 7 月 10 日完成史上最大外国公司赴美 IPO,募资 265 亿美元超额认购 7 倍,首日上涨 13%,HBM4 内存 4 个月内销售额突破 10 亿美元。',
      content: `# SK hynix 历史性 IPO

SK hynix 于 2026 年 7 月 10 日完成美国 IPO,募资 265 亿美元,首日上涨 13%。

## 关键数据

- **募资规模**:265 亿美元(原指示价 166 美元下方,7 倍超额认购)
- **首日表现**:+13%
- **HBM4 销售**:4 个月内达 10 亿美元
- **三星 Q2 营业利润**:指引 ~89.4 万亿韩元(同比 +1,810%)

## 产业意义

Brian Letort 在 AI Stack Weekly W28 指出,能力商品化、工具栈整合,利润持续涌向**内存与电力**。HBM4 成为新一代 AI 训练芯片的必备组件,NVIDIA、AMD、AWS 均已锁定产能。

## Meta 加拿大 Alberta 1GW 园区

Meta 承诺 130 亿加元(约 95 亿美元)建设 Alberta 1 GW AI 数据中心,但因当地电网无法承载多 GW AI 负载,Meta **必须自行建设燃气发电**。这一决策凸显 AI 算力扩张已触及能源天花板。

## NVIDIA 视角

AI Stack Weekly 观点:"硬件 GPU 性能每两年翻倍,超过摩尔定律"——黄仁勋法则继续在 AI 时代生效。`,
      category: 'AI 产业动态',
      author: 'TechCrunch 中文',
      cover: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/02-strategy.png',
      sort: 89,
      isPinned: false,
    },
    {
      title: 'Claude Code 重大更新:Artifacts 集成 MCP,CLI v2.1.207 强化安全',
      summary:
        'Anthropic 于 7 月 15 日为 Claude Code 推出 Artifacts 调用 MCP 连接器的能力(per-visitor 权限模型),CLI v2.1.207-210 强化屏幕阅读器、转写精简与安全加固。',
      content: `# Claude Code Artifacts + MCP

Anthropic 在 2026 年 7 月 15 日为 Claude Code 推出两项重要更新。

## 1. Artifacts 调用 MCP 连接器

Claude Code 的 Artifacts 现在可以调用 MCP (Model Context Protocol) 连接器,构建拉取实时数据的 dashboard 与应用。

- 每个 artifact 构建一次,每次查看时拉取实时数据
- 使用**当前访问者**的 MCP 连接器,而非创建者
- 解决企业级数据访问的权限隔离难题

**可用计划**:Pro / Max / Team / Enterprise,**不支持**公开共享 artifacts。

## 2. CLI v2.1.207 - v2.1.210

四个版本集中更新:

- **屏幕阅读器支持**:无障碍体验改进
- **精简转写**:Token 消耗降低
- **硬化安全**:默认拒绝未授权操作
- **改进错误信息**:调试效率提升

## 与 GPT-Red 协同

Anthropic 同步推出与 OpenAI GPT-Red 对标的内部安全加固,采用 red-blue self-play,验证 Claude 在 prompt injection 下的鲁棒性提升。`,
      category: 'AI 模型发布',
      author: 'Anthropic 官方',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      sort: 88,
      isPinned: false,
    },
    {
      title: '智谱 GLM-5.2 开源:1M context,Apache-2.0,Function Call 达生产级',
      summary:
        '智谱 AI 于 2026 年 7 月上旬开源 GLM-5.2,1M 超长上下文,工具调用达生产级标准,Artificial Analysis 指数显示其与 Opus 4.8 统计无显著差异,成为国产开源第一梯队。',
      content: `# 智谱 GLM-5.2 开源

智谱 AI 在 2026 年 7 月上旬正式开源 GLM-5.2,这是中国大模型生态的又一里程碑。

## 核心参数

- **架构**:Dense Transformer + MoE 增强
- **上下文窗口**:1M tokens
- **Function Call**:达到生产级标准(成功率 99.2%)
- **Apache-2.0 协议**:免费商用

## 性能数据

- **Artificial Analysis Intelligence Index**:与 Opus 4.8 统计上无显著差异(单任务成本 $1.28 vs $1.94)
- **代码能力**:国产开源第一梯队
- **昇腾芯片适配成熟**:政企项目高频选型

## LangChain/NVIDIA 研究

研究显示,**harness tuning** 单独可将开源模型提升至接近 Opus 质量,成本约 1/10。GLM-5.2 已成为该结论的最佳实证。

## 业务接入

阿里、字节、京东等大厂已开始在内部 AI 工具链中集成 GLM-5.2 作为 GPT-5.6 / Claude 的替代方案。`,
      category: 'AI 模型发布',
      author: '智谱 AI',
      cover:
        'https://raw.githubusercontent.com/zai-org/GLM-5/refs/heads/main/resources/bench_52.png',
      sort: 87,
      isPinned: false,
    },
    {
      title: 'Microsoft 发布 MAI 系列:MAI-Thinking-1 推理模型与 MAI-Image-2.5 图像模型',
      summary:
        'Microsoft 于 2026 年 7 月发布 7 款 MAI 系列 AI 模型,MAI-Thinking-1 专注推理,MAI-Image-2.5 强化图像处理,均通过 Azure 提供,逐步摆脱对 OpenAI 单一依赖。',
      content: `# Microsoft MAI 系列

Microsoft 于 2026 年 7 月一次性发布 7 款 MAI 系列 AI 模型,正式向自有 AI 能力转型。

## 关键模型

- **MAI-Thinking-1**:专注推理,主打多步逻辑与数学
- **MAI-Image-2.5**:图像处理与生成
- 另有 5 款模型覆盖语音、多模态等场景

## 战略意图

Microsoft 减少对 OpenAI 的依赖,MAI 系列将逐步在 Microsoft 365 Copilot、Bing、Azure AI Foundry 中替换部分 OpenAI 模型调用。

## 定价与可用性

- 通过 Azure AI Foundry 提供
- 定价略低于同类闭源模型
- 企业客户可与 Azure 现有服务深度集成`,
      category: 'AI 产业动态',
      author: 'Microsoft 官方',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      sort: 86,
      isPinned: false,
    },
    {
      title: 'AI 工程师成 LinkedIn 2026 Jobs on the Rise 第一:大模型岗位需求井喷',
      summary:
        'LinkedIn 2026 Jobs on the Rise 报告显示 AI Engineer 成为全球增长最快岗位第一名,AI 产品经理、ML Engineer、Prompt Engineer 紧随其后,DataRobot 预测 2026 年 AI 岗位增长 40%。',
      content: `# AI 工程师需求井喷

LinkedIn 在 2026 年 7 月发布的 **Jobs on the Rise** 报告中,**AI Engineer** 位列**全球增长最快岗位第一名**。

## 增长最快的 AI 相关岗位

1. **AI Engineer**:#1 全球
2. **AI 产品经理**:#3
3. **ML Engineer**:#5
4. **Prompt Engineer**:#8
5. **AI 安全/治理专家**:#12

## 关键技能

- LLM API 集成(OpenAI、Anthropic、Google)
- RAG 系统设计
- Agent 框架(LangGraph、LangChain、CrewAI)
- 提示词工程
- AWS Bedrock / Azure AI Foundry

## 薪资区间(美国)

- AI Engineer:$180K - $400K
- Senior AI Engineer:$250K - $500K+
- AI Architect:$300K - $600K+

## 课程与认证

- AWS Certified Generative AI Developer - Professional
- AI Engineering Fundamentals(Lukas Lechner, 7/2026)
- Certified AI Engineer Masterclass 2026(7/7/2026 发布)
- 清华大学 大模型工程师学习班(4-7 月)

LinkedIn 报告同时指出,**AI 工程师将可能是十年内需求最高的工程岗位**。`,
      category: 'AI 产业动态',
      author: 'LinkedIn',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      sort: 85,
      isPinned: false,
    },
  ]

  let count = 0
  for (const a of articles) {
    // R82 升级:onConflictDoNothing 替代 if (ex) continue,基于 news_articles_title_uniq 唯一索引
    const { id, action } = await upsertByUnique(db, {
      table: newsArticles,
      uniqueBy: { column: newsArticles.title, value: a.title },
      insertValues: {
        title: a.title,
        summary: a.summary,
        content: a.content,
        coverImage: a.cover,
        categoryId: catMap[a.category] ?? null,
        authorName: a.author,
        isPublished: true,
        isPinned: a.isPinned,
        viewCount: Math.floor(Math.random() * 10000) + 1000,
        sort: a.sort,
        status: 1,
        publishedAt: new Date(),
      },
    })
    if (action === 'inserted') count++
    void id
  }
  console.info(`[资讯/文章] 完成,新增 ${count} 条`)
}

async function seedAsks() {
  console.info('[问答] 开始导入 AI 主题问答...')

  // 1. 问答分类
  const cats = [
    { name: '大模型选型', sort: 1, show: true },
    { name: 'AI 编程', sort: 2, show: true },
    { name: 'Agent 开发', sort: 3, show: true },
    { name: '提示工程', sort: 4, show: true },
  ]
  const catMap: Record<string, string> = {}
  for (const c of cats) {
    // R82 升级:upsertByUnique 替代 if (ex) ... else insert
    const { id } = await upsertByUnique(db, {
      table: askCategories,
      uniqueBy: { column: askCategories.name, value: c.name },
      insertValues: {
        name: c.name,
        sortOrder: c.sort,
        isShow: true,
        isShowIndex: c.show,
        level: 1,
      },
    })
    catMap[c.name] = String(id)
  }

  // 2. 用户(问答需要 userId 引用)。查 admin 用户
  const [adminUser] = await db.execute(`SELECT id FROM users WHERE email = 'admin@ihui.ai' LIMIT 1`)
  const userId = (adminUser as unknown as { id: string }[])?.id
  if (!userId) {
    console.info('[问答] 跳过:未找到 admin 用户')
    return
  }

  const questions = [
    {
      title: 'GPT-5.6 Sol 和 Claude Sonnet 5 哪个更适合做 Coding Agent?',
      content:
        '我正在搭建一个企业级 Coding Agent,需要长程多文件编辑能力。GPT-5.6 Sol 在 Coding Agent Index 上 80 分领先,但 Claude Sonnet 5 智能体能力也很强。怎么选?',
      category: '大模型选型',
      tags: ['GPT-5.6', 'Claude Sonnet 5', 'Coding Agent', '2026'],
      answers: 3,
      isResolved: true,
    },
    {
      title: 'Gemini 3.5 Pro 真的能"一次生成"完整的前端页面吗?',
      content:
        '看了一些 demo,Gemini 3.5 Pro 在前端代码生成上似乎非常强,一次能出 SVG 和复杂 UI。实际项目使用中,代码质量如何?能直接上生产吗?',
      category: '大模型选型',
      tags: ['Gemini 3.5 Pro', '前端', '代码生成'],
      answers: 5,
      isResolved: true,
    },
    {
      title: 'Kimi K3 2.8 万亿参数能在本地部署吗?硬件门槛多少?',
      content:
        'Kimi K3 2.8 万亿参数虽然是开源,但这个体量本地基本不可能跑起来吧?有没有量化或蒸馏版本?部署一套最小可用环境需要什么硬件?',
      category: '大模型选型',
      tags: ['Kimi K3', '本地部署', '硬件'],
      answers: 2,
      isResolved: false,
    },
    {
      title: '如何使用 Claude Code + MCP 搭建定制化 RAG 系统?',
      content:
        'Claude Code 现在支持 Artifacts 调用 MCP 连接器(2026 年 7 月 15 日更新),想做 per-visitor 而不是 per-creator 的权限模型。具体怎么搭?',
      category: 'AI 编程',
      tags: ['Claude Code', 'MCP', 'RAG', 'Artifacts'],
      answers: 4,
      isResolved: true,
    },
    {
      title: 'Ornith-1.0 9B-Dense 真的能在消费级 GPU 上跑 Agentic Coding 吗?',
      content:
        'DeepReinforce 团队开源的 Ornith-1.0 系列里 9B-Dense 版本号称可以"punch above its weight class",实际在 RTX 4090 或 3090 上能跑多复杂的多文件任务?',
      category: 'AI 编程',
      tags: ['Ornith-1.0', 'Agentic Coding', '消费级 GPU'],
      answers: 6,
      isResolved: true,
    },
    {
      title: 'CodeBrain-1 的 dynamic planning 是怎么实现的?',
      content:
        'Feeling AI 的 CodeBrain-1 在 Terminal-Bench 2.0 全球第二,声称具备"动态规划与策略调整能力"。有没有公开的论文或代码解释其工作原理?',
      category: 'Agent 开发',
      tags: ['CodeBrain-1', '动态规划', 'Agent'],
      answers: 1,
      isResolved: false,
    },
    {
      title: 'DeepSeek V4 峰谷定价对自建应用成本影响有多大?',
      content:
        'DeepSeek V4 推出峰谷定价,高峰(9-12、14-18)价格是平时的 2 倍。我的应用主要在 19-23 点用,这样能省多少?非高峰有 SLA 保证吗?',
      category: '大模型选型',
      tags: ['DeepSeek V4', '峰谷定价', '成本'],
      answers: 3,
      isResolved: true,
    },
    {
      title: 'Grok 4.5 vs GPT-5.6 Terra:7 月 8 日同日发布,日常开发该选哪个?',
      content:
        'Grok 4.5($2/$6) 和 GPT-5.6 Terra($2.5/$15) 同日 7 月 8 日发布,价格接近但都是"性价比"档。日常写代码、文档、邮件处理,选哪个更稳?',
      category: '大模型选型',
      tags: ['Grok 4.5', 'GPT-5.6 Terra', '性价比', '2026-07'],
      answers: 4,
      isResolved: false,
    },
    {
      title: 'Cursor + Grok 4.5 是否已成为最强 AI 编程组合?',
      content:
        'SpaceX 600 亿美元收购 Cursor 后,xAI 立刻用 Cursor 数据特训 Grok 4.5。在 SWE-Bench Pro 上 Grok 4.5 64.7% 排名第四,这个组合是不是当前最强 AI 编程?',
      category: 'AI 编程',
      tags: ['Cursor', 'Grok 4.5', 'AI 编程', 'SpaceX'],
      answers: 5,
      isResolved: true,
    },
    {
      title: 'WAIC 2026 必看重点:从具身智能到 AI 治理的 4 天议程',
      content:
        'WAIC 2026 7 月 17-20 日在上海举办,4 个主题日分别关注什么?普通开发者和创业者最值得关注的分论坛是哪几场?',
      category: 'AI 编程',
      tags: ['WAIC 2026', '具身智能', 'AI 治理', '上海'],
      answers: 2,
      isResolved: true,
    },
    {
      title: '智谱 GLM-5.2 在企业 RAG 系统中能完全替代 Opus 4.8 吗?',
      content:
        'LangChain/NVIDIA 研究显示 GLM-5.2 与 Opus 4.8 统计无显著差异(单任务 $1.28 vs $1.94),harness tuning 后可近 Opus 质量 1/10 成本。生产环境真能平替吗?',
      category: '大模型选型',
      tags: ['GLM-5.2', 'Opus 4.8', 'RAG', 'harness'],
      answers: 3,
      isResolved: false,
    },
    {
      title: 'AI 工程师 2026 面试必考:ReAct / MCP / A2A / LangGraph 26 问',
      content:
        'dev.to 总结的 26 道 AI Agent 面试题 2026 版,涵盖 ReAct、MCP 协议、A2A、记忆系统、Agentic RAG、多 Agent 协作等。准备跳槽的同学有哪些高频坑?',
      category: 'Agent 开发',
      tags: ['AI 工程师', '面试', 'MCP', 'A2A', 'LangGraph'],
      answers: 7,
      isResolved: true,
    },
    {
      title: 'HBM4 内存为何成为 AI 算力新的稀缺品?SK hynix IPO 反映了什么?',
      content:
        'SK hynix 7 月 10 日完成 265 亿美元 IPO,HBM4 4 个月卖了 10 亿美元。Brian Letort 说利润涌向内存和电力,这对 AI 工程师有什么影响?',
      category: 'AI 编程',
      tags: ['HBM4', 'SK hynix', 'AI 算力', '2026-07'],
      answers: 2,
      isResolved: true,
    },
    {
      title: '腾讯混元 Hy3 与 DeepSeek V4 选哪个:企业 AI 中台落地对比',
      content:
        '腾讯混元 Hy3(7-6 开源,Apache 2.0)与 DeepSeek V4(7-17 GA,峰谷定价)是国内企业 AI 中台最常见选择。功能、性能、生态、成本怎么选?',
      category: '大模型选型',
      tags: ['混元 Hy3', 'DeepSeek V4', '企业 AI 中台'],
      answers: 4,
      isResolved: true,
    },
  ]

  let count = 0
  for (const q of questions) {
    // R82 升级:upsertByUnique 替代 if (ex) continue,基于 asks_title_uniq 唯一索引
    const { id, action } = await upsertByUnique(db, {
      table: asks,
      uniqueBy: { column: asks.title, value: q.title },
      insertValues: {
        userId,
        title: q.title,
        content: q.content,
        tags: q.tags,
        viewCount: Math.floor(Math.random() * 3000) + 200,
        answerCount: q.answers,
        likeCount: Math.floor(Math.random() * 100) + 5,
        isResolved: q.isResolved,
        status: 1,
      },
    })
    if (action === 'inserted') count++
    void id
  }
  console.info(`[问答] 完成,新增 ${count} 条`)
}

async function seedCircles() {
  console.info('[社区] 开始导入 AI 主题圈子...')

  const circlesData = [
    {
      name: 'GPT-5.6 Sol 实战社区',
      slug: 'gpt-5-6-sol-practice',
      description:
        '聚焦 OpenAI GPT-5.6 Sol 的 Coding Agent 实战应用,涵盖长程编码、多文件编辑、Codex 集成等场景。',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      members: 12580,
    },
    {
      name: 'Claude Sonnet 5 Agent 开发者',
      slug: 'claude-sonnet-5-agents',
      description:
        '围绕 Anthropic Claude Sonnet 5 的智能体能力,讨论 BrowseComp、OSWorld、自主工作流等话题。',
      cover:
        'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
      members: 8920,
    },
    {
      name: 'Kimi K3 开源生态',
      slug: 'kimi-k3-open-source',
      description: '月之暗面 Kimi K3 2.8 万亿参数开源模型的部署、量化、微调、企业应用讨论区。',
      cover: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
      members: 6420,
    },
    {
      name: '国产开源大模型',
      slug: 'china-open-source-llm',
      description:
        'DeepSeek V4 / 腾讯混元 Hy3 / Qwen3.7-Max / Kimi K3 等中国开源大模型的深度交流。',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      members: 18760,
    },
    {
      name: 'Agentic Coding 工程师',
      slug: 'agentic-coding-engineers',
      description:
        '聚焦 AI Coding Agent:Claude Code、Cursor、Codex、CodeBrain-1、Ornith-1.0 的工程实践与对比评测。',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      members: 9430,
    },
    {
      name: 'Grok 4.5 + Cursor 极客圈',
      slug: 'grok-45-cursor-hackers',
      description:
        'SpaceX 600 亿美元收购 Cursor 后,Grok 4.5 + Cursor 成为最强 AI 编程组合。讨论实战、调优、Code Review 技巧。',
      cover: 'https://x.ai/images/news/grok-4-5-og.png',
      members: 5380,
    },
    {
      name: 'WAIC 2026 全球 AI 大会',
      slug: 'waic-2026',
      description:
        '2026 世界人工智能大会(7-17 至 7-20,上海)专题讨论区,涵盖主旨演讲、展览、发布、具身智能、AI 治理等。',
      cover:
        'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
      members: 11200,
    },
    {
      name: 'AI 工程师面试互助',
      slug: 'ai-engineer-interview-2026',
      description:
        'LinkedIn 2026 Jobs on the Rise AI 工程师 #1。讨论 Anthropic、OpenAI、Scale AI、Sierra、xAI、Databricks、Perplexity 真实面试题。',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      members: 14650,
    },
    {
      name: 'DeepSeek V4 开发者联盟',
      slug: 'deepseek-v4-developers',
      description:
        '聚焦 DeepSeek V4 峰谷定价、DSpark 加速框架、V3 → V4 迁移实战(7-24 截止)、OpenRouter 排名讨论。',
      cover: 'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg',
      members: 16280,
    },
    {
      name: 'MCP 与 A2A 协议工程师',
      slug: 'mcp-a2a-engineers',
      description:
        'Model Context Protocol (MCP) 与 Agent-to-Agent (A2A) 协议开发者社区,围绕 Claude Code Artifacts + MCP 集成、LangGraph Agent 通信展开。',
      cover:
        'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
      members: 4820,
    },
  ]

  let count = 0
  for (const c of circlesData) {
    // R82 升级:onConflictDoNothing 替代 if (ex) continue,基于 circles.slug 原生 unique 约束
    const { id, action } = await upsertByUnique(db, {
      table: circles,
      uniqueBy: { column: circles.slug, value: c.slug },
      insertValues: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        coverImage: c.cover,
        memberCount: c.members,
        postCount: Math.floor(c.members * 0.05),
        isPublished: true,
        status: 1,
      },
    })
    if (action === 'inserted') count++
    void id
  }
  console.info(`[社区] 完成,新增 ${count} 个圈子`)
}

async function seedResources() {
  console.info('[知识库] 开始补充 2026-07 最新 AI 知识条目...')

  const catName = 'AI 前沿动态'
  const [exCat] = await db
    .select()
    .from(resourceCategories)
    .where(eq(resourceCategories.name, catName))
  let catId: string
  if (exCat) catId = exCat.id
  else {
    const [ins] = await db
      .insert(resourceCategories)
      .values({ name: catName, sort: 99, status: 1 })
      .returning({ id: resourceCategories.id })
    catId = ins.id
  }

  const resourcesData = [
    {
      title: 'GPT-5.6 系列官方技术报告(2026-07-09)',
      intro:
        'OpenAI 发布的 GPT-5.6 三档分层模型(Sol/Terra/Luna)技术详解,包含 Coding Agent Index 80 分领先的多基准评测数据。',
      url: 'https://openai.com/index/gpt-5-6-technical-report',
      type: 'doc',
    },
    {
      title: 'Claude Sonnet 5 智能体评测白皮书',
      intro:
        'Anthropic 官方发布,涵盖 BrowseComp、OSWorld-Verified 等智能体基准对比 Sonnet 4.6 与 Opus 4.8 的实测数据。',
      url: 'https://www.anthropic.com/news/claude-sonnet-5-agent-benchmarks',
      type: 'doc',
    },
    {
      title: 'Kimi K3 2.8 万亿参数开源模型技术报告',
      intro:
        '月之暗面官方披露 Kimi K3 的训练方法、架构创新、软硬件协同优化,2.8 万亿参数规模下综合智能水平接近 Claude Fable 5 与 GPT-5.6 Sol。',
      url: 'https://www.moonshot.cn/blog/kimi-k3-tech-report',
      type: 'doc',
    },
    {
      title: 'GPT-Red 自动化红队训练方法论',
      intro:
        'OpenAI 内部 GPT-Red 模型如何通过 self-play 强化学习发现并加固 prompt injection 漏洞,直接攻击成功率从 13% 提升到 84%。',
      url: 'https://openai.com/index/gpt-red-automated-red-teaming',
      type: 'article',
    },
    {
      title: 'SWE-Together 交互式 AI 编码 Agent 基准',
      intro:
        '2026 年 7 月发布的 AI 编码 agent 评测基准,109 个真实软件工程任务,采用 pass@1、pass²、token 消耗、稳定性等指标。',
      url: 'https://togetherbench.com/',
      type: 'link',
    },
    {
      title: 'Grok 4.5 官方技术报告(SpaceX AI,2026-07-08)',
      intro:
        'xAI 发布的 Grok 4.5 技术报告,基于 1.5 万亿参数 V9 基座 + Cursor 联合特训,SWE-Bench Pro 64.7%,价格 $2/$6 per M tokens。',
      url: 'https://x.ai/blog/grok-4-5',
      type: 'doc',
    },
    {
      title: 'DeepSeek V4 峰谷定价与 DSpark 加速框架白皮书',
      intro:
        'DeepSeek V4 峰谷定价策略详解(9-12、14-18 高峰 ×2 价格),联合北大发布 DSpark 推理加速 60-85%,V3 → V4 迁移截止 7-24。',
      url: 'https://api-docs.deepseek.com/news/v4-peak-pricing',
      type: 'doc',
    },
    {
      title: 'WAIC 2026 大会完整议程与嘉宾名单(2026-07-17~20)',
      intro:
        '世界人工智能大会 2026 官方完整议程,涵盖主旨演讲(理查德·萨顿、约书亚·本吉奥、姚期智)、凯文·凯利具身智能分论坛、1100+ 企业展览。',
      url: 'https://www.worldaic.com.cn/',
      type: 'link',
    },
    {
      title: 'Claude Code Artifacts + MCP 集成开发指南(2026-07-15)',
      intro:
        'Anthropic 7 月 15 日更新:Artifacts 调用 MCP 连接器,per-visitor 权限模型,适用于 Pro/Max/Team/Enterprise 计划,CLI v2.1.207-210。',
      url: 'https://docs.anthropic.com/en/docs/claude-code/artifacts-mcp',
      type: 'doc',
    },
    {
      title: 'AI Agent 工程师面试 26 问通关手册(dev.to 2026-06)',
      intro:
        '2026 大厂 AI Agent 工程师面试 26 问完整指南,涵盖 ReAct、MCP 协议、A2A、记忆系统、Agentic RAG、多 Agent 协作、LangGraph、CrewAI。',
      url: 'https://dev.to/avinash247/ai-agent-interview-26-real-world-questions-expert-answers-for-2026-3fbo',
      type: 'article',
    },
    {
      title: 'AWS Certified Generative AI Developer - Professional 学习路径',
      intro:
        'AWS Bedrock + SageMaker + Flows 完整 GenAI 开发认证课程,24 小时视频,303 个讲座,2026-07 更新,涵盖 RAG、Agent、多模态、安全治理。',
      url: 'https://www.udemy.com/course/ultimate-aws-certified-generative-ai-developer-professional/',
      type: 'doc',
    },
    {
      title: '智谱 GLM-5.2 开源模型与 Hugging Face 部署指南',
      intro:
        'GLM-5.2 Apache-2.0 协议开源,1M 上下文,Function Call 达生产级,Artificial Analysis 指数与 Opus 4.8 统计无显著差异。',
      url: 'https://huggingface.co/zhipu-ai/GLM-5.2',
      type: 'doc',
    },
    {
      title: 'Kimi K3 2.8 万亿参数开源模型部署与量化实践',
      intro:
        '月之暗面 Kimi K3 完整权重即将发布,2.8 万亿参数原生视觉理解,100 万 token 上下文,综合智能仅次于 Claude Fable 5 与 GPT-5.6 Sol。',
      url: 'https://www.moonshot.cn/blog/kimi-k3-deployment',
      type: 'article',
    },
  ]

  let count = 0
  for (const r of resourcesData) {
    // R82 升级:onConflictDoNothing 替代 if (ex) continue,基于 resources_title_uniq 唯一索引
    const { id, action } = await upsertByUnique(db, {
      table: resources,
      uniqueBy: { column: resources.title, value: r.title },
      insertValues: {
        title: r.title,
        intro: r.intro,
        coverImage: r.title.includes('GPT')
          ? 'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill'
          : r.title.includes('Claude')
            ? 'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg'
            : r.title.includes('Kimi')
              ? 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png'
              : r.title.includes('Grok')
                ? 'https://x.ai/images/news/grok-4-5-og.png'
                : r.title.includes('DeepSeek')
                  ? 'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg'
                  : r.title.includes('混元') || r.title.includes('Hunyuan')
                    ? 'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover'
                    : r.title.includes('GLM') || r.title.includes('智谱')
                      ? 'https://raw.githubusercontent.com/zai-org/GLM-5/refs/heads/main/resources/bench_52.png'
                      : 'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
        categoryId: catId,
        fileUrl: r.url,
        fileType: r.type,
        fileSize: 0,
        isPublished: true,
        viewCount: Math.floor(Math.random() * 5000) + 500,
        downloadCount: Math.floor(Math.random() * 1000) + 100,
        sort: 200 + count,
        status: 1,
      },
    })
    if (action === 'inserted') count++
    void id
  }
  console.info(`[知识库] 完成,新增 ${count} 条`)
}

export async function seedAiFresh2026() {
  console.info('=== 开始导入 2026-07 真实 AI 资讯数据 ===')
  const startTime = Date.now()

  // 每步独立计时 + 单步容错隔离: 一步失败不影响其他步,便于定位问题
  // (此前串行 await 任一抛错则整个 seedAiFresh2026 失败,无法定位是直播/考试/资讯/问答/社区/资源哪一步)
  const steps: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: '直播 (live)', fn: seedLive },
    { name: '考试 (exam)', fn: seedExam },
    { name: '资讯 (news)', fn: seedNews },
    { name: '问答 (asks)', fn: seedAsks },
    { name: '社区 (circles)', fn: seedCircles },
    { name: '资源 (resources)', fn: seedResources },
  ]
  let successCount = 0
  let failedCount = 0
  for (const step of steps) {
    const stepStart = Date.now()
    process.stdout.write(`  → ${step.name} ... `)
    try {
      await step.fn()
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
      console.info(`✓ ${elapsed}s`)
      successCount++
    } catch (err) {
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
      console.info(`✗ ${elapsed}s (失败: ${(err as Error).message ?? err})`)
      failedCount++
    }
  }
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.info(
    `=== 2026-07 真实 AI 资讯数据导入完成: 成功 ${successCount}/${steps.length}, 失败 ${failedCount}, 耗时 ${totalElapsed}s ===`,
  )
}
