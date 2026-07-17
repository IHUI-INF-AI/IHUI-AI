import { createDb } from '../src/client.js'
import { eq } from 'drizzle-orm'
import { newsCategories, newsArticles } from '../src/schema/news.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

const AI_LOGO_COVER =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Artificial_intelligence_logo.svg/1024px-Artificial_intelligence_logo.svg.png'
const ATLAS_COVER =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Atlas_%282024%29_DH1.jpg/1280px-Atlas_%282024%29_DH1.jpg'
const BITCOIN_COVER =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/1024px-Bitcoin.svg.png'
const CHATGPT_COVER =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1024px-ChatGPT_logo.svg.png'

export async function seedCrossDomain() {
  console.info('=== 开始导入跨领域数据 (8 领域 80 条) ===')

  const cats = [
    { name: '科技前沿', sort: 10 },
    { name: '教育创新', sort: 11 },
    { name: '金融科技', sort: 12 },
    { name: '医疗健康', sort: 13 },
    { name: '机器人产业', sort: 14 },
    { name: 'AI 艺术', sort: 15 },
    { name: '创业投资', sort: 16 },
    { name: '政策法规', sort: 17 },
  ]
  const catMap: Record<string, string> = {}
  for (const c of cats) {
    const [ex] = await db.select().from(newsCategories).where(eq(newsCategories.name, c.name))
    if (ex) catMap[c.name] = ex.id
    else {
      const [ins] = await db
        .insert(newsCategories)
        .values({ name: c.name, sort: c.sort, status: 1 })
        .returning({ id: newsCategories.id })
      catMap[c.name] = ins.id
    }
  }

  const articles = [
    // ============ 1. 科技前沿 (sort 80-71) ============
    {
      title: 'NVIDIA Blackwell B200 GPU 量产:2080 亿晶体管重塑 AI 算力版图',
      summary:
        'NVIDIA GTC 2024 发布 Blackwell B200 GPU,集成 2080 亿晶体管,双 die 设计,推理性能较 H100 提升 15 倍。',
      content: `## Blackwell B200 重磅发布

NVIDIA 于 2024 年 3 月 GTC 大会正式发布 Blackwell 架构旗舰 B200 GPU,采用台积电 4NP 工艺,单芯片集成 **2080 亿晶体管**,通过双 die 互联实现 192GB HBM3e 显存与 8TB/s 带宽。

### 关键参数
- 推理性能较 H100 提升 15 倍,训练性能提升 2.5 倍
- GB200 NVL72 系统搭载 72 颗 B200,可训练 27 万亿参数模型
- 单卡功耗约 1000W

### 量产进展
2024 年第四季度开始量产,微软、OpenAI、Meta、谷歌、亚马逊均宣布采购。OpenAI GPT-5 训练集群据传使用 GB200 系统搭建。2025 年 Q2 起,GB200 NVL72 服务器大规模出货,推动全球 AI 算力跃升新台阶。Blackwell 把"AI 工厂"概念落地,算力经济成为新一代基础设施。`,
      category: '科技前沿',
      author: 'NVIDIA 官方',
      cover: AI_LOGO_COVER,
      sort: 80,
      isPinned: true,
    },
    {
      title: 'Apple M4 系列芯片发布:iPad Pro 首发搭载,3nm 工艺 NPU 算力飙升',
      summary: 'Apple 2024 年 5 月发布 M4 芯片,首发 iPad Pro,第二代 3nm 工艺,NPU 算力达 38 TOPS。',
      content: `## M4 芯片亮相

2024 年 5 月 7 日,Apple 在"Let Loose"发布会上正式推出 **M4 芯片**,首发搭载于新款 iPad Pro,这是 Apple Silicon 首次在 iPad 上率先采用新一代工艺。

### 核心规格
- 工艺:台积电第二代 3nm (N3E)
- CPU:9 核(3 性能 + 6 能效)
- GPU:10 核,硬件光线追踪
- NPU:16 核,38 TOPS 算力

### M4 Pro / Max / Ultra
2024 年 10 月,MacBook Pro 搭载 M4 Pro / Max 发布,内存支持至 128GB,满足 Apple Intelligence 本地推理需求。2025 年 M4 Ultra 随 Mac Studio 推出。M4 系列是 Apple 进军本地 AI 推理的关键,带动端侧 AI 时代来临。`,
      category: '科技前沿',
      author: 'Apple 官方',
      cover: AI_LOGO_COVER,
      sort: 79,
      isPinned: false,
    },
    {
      title: '华为鸿蒙 NEXT 正式发布:全自研系统脱离安卓生态',
      summary: '华为 2024 年 10 月发布鸿蒙 NEXT,完全脱离安卓 AOSP,自研 ArkTS 语言,9 亿设备搭载。',
      content: `## 鸿蒙 NEXT 重大里程碑

2024 年 10 月 22 日,华为在深圳举办"原生鸿蒙之夜",正式发布 **HarmonyOS NEXT**(鸿蒙 NEXT)。这是中国首款全自研移动操作系统,完全脱离安卓 AOSP 代码。

### 核心特性
- 不再兼容安卓 APK 应用
- 全新自研 ArkTS 开发语言
- 方舟引擎 6.0,应用启动速度提升 30%
- 端侧 AI 框架原生集成

### 生态进展
- 截至 2025 年,鸿蒙生态设备超 9 亿台
- 15000+ 应用完成原生适配
- 微信、支付宝、淘宝、抖音等头部应用已上架
- 开发者数量超 720 万

鸿蒙 NEXT 标志中国操作系统实现自主可控,与 iOS、Android 形成三足鼎立格局。`,
      category: '科技前沿',
      author: '华为官方',
      cover: AI_LOGO_COVER,
      sort: 78,
      isPinned: false,
    },
    {
      title: 'AWS Trainium2 大规模部署:Anthropic Claude 训练集群算力翻倍',
      summary:
        'AWS 2024 年 re:Invent 发布 Trainium2 芯片,Anthropic 使用 40 万颗构建 Claude 训练集群。',
      content: `## AWS Trainium2 部署

2024 年 12 月,AWS 在 re:Invent 大会宣布 **Trainium2** 芯片进入大规模量产,Anthropic 作为首发客户,使用 40 万颗 Trainium2 构建 Claude 模型训练集群。

### 芯片规格
- 制程:台积电 5nm
- 单芯片算力:1.3 PFLOPS (FP8)
- 显存:96GB HBM3
- Trn2 UltraServer:64 颗互联,83 万亿参数模型训练能力

### 客户部署
- Anthropic:40 万颗,训练 Claude Opus / Sonnet 系列
- Databricks:训练 DBRX 系列开源模型
- Poolside:代码生成模型训练

AWS 通过自研芯片降低对 NVIDIA 依赖,Trainium2 性价比相较 H100 提升 30-40%,推动 AI 算力多元化。`,
      category: '科技前沿',
      author: 'AWS 官方',
      cover: AI_LOGO_COVER,
      sort: 77,
      isPinned: false,
    },
    {
      title: 'Google TPU v5p / Trillium 量产:Gemini 2.0 训练基础设施揭秘',
      summary:
        'Google 2024 年发布 TPU v5p 与新一代 Trillium,Cloud TPU v5e 提供 95GB HBM,支撑 Gemini 2.0 训练。',
      content: `## Google TPU 演进

2024 年,Google 持续扩展自研 TPU (Tensor Processing Unit) 产品线,**TPU v5p** 与新一代 **Trillium** 量产交付,成为 Gemini 系列模型训练的核心基础设施。

### TPU v5p 规格
- 单 Pod 8960 颗 v5p 互联
- HBM 显存:95GB
- 互联带宽:3 Tbps
- 训练性能较 v4 提升 2.8 倍

### Trillium 架构
- 算力较 v5e 提升 4.7 倍
- 能效提升 67%
- 第三代 SparseCore,加速推荐系统
- 单芯片 32GB HBM3

### 应用场景
- Gemini 2.0 Flash / Pro 训练
- YouTube 推荐系统
- DeepMind AlphaFold 3 推理

Google Cloud 向外部客户开放 TPU 租赁,Anthropic、Hugging Face、AI21 Labs 均为用户。`,
      category: '科技前沿',
      author: 'Google Cloud 官方',
      cover: AI_LOGO_COVER,
      sort: 76,
      isPinned: false,
    },
    {
      title: 'Apple iPhone 16 Pro 搭载 A18 Pro 芯片:Apple Intelligence 全面落地',
      summary:
        'iPhone 16 Pro 2024 年 9 月发布,搭载 A18 Pro,16 核 NPU 算力 35 TOPS,专为 Apple Intelligence 设计。',
      content: `## iPhone 16 Pro 与 A18 Pro

2024 年 9 月 9 日,Apple 在秋季发布会上推出 **iPhone 16 系列**,Pro 版本搭载全新 **A18 Pro 芯片**,专为 Apple Intelligence 本地推理设计。

### A18 Pro 关键规格
- 工艺:台积电第二代 3nm (N3E)
- CPU:6 核(2 性能 + 4 能效)
- GPU:6 核,硬件光追加速
- NPU:16 核,35 TOPS 算力
- 内存带宽:提升 17%

### Apple Intelligence
- 端侧 7B 模型推理
- 写作工具(改写 / 校对 / 摘要)
- 智能照片清理与生成
- Siri 跨应用理解
- 隐私优先架构,敏感任务云端处理使用 PCC 私有云计算

A18 Pro 是手机端侧 AI 的标杆,推动智能手机从"参数竞赛"转向"AI 体验竞赛"。`,
      category: '科技前沿',
      author: 'Apple 官方',
      cover: AI_LOGO_COVER,
      sort: 75,
      isPinned: false,
    },
    {
      title: 'Samsung Galaxy S25 Ultra + 骁龙 8 Elite:AI 手机新旗舰',
      summary:
        '三星 2025 年 1 月发布 Galaxy S25 Ultra,搭载高通骁龙 8 Elite for Galaxy,深度集成 Galaxy AI 与 Gemini。',
      content: `## Galaxy S25 Ultra 发布

2025 年 1 月 22 日,三星在 Unpacked 大会发布 **Galaxy S25 Ultra**,搭载 **高通骁龙 8 Elite for Galaxy** 定制版,深度集成 Galaxy AI 与 Google Gemini。

### 硬件规格
- 处理器:骁龙 8 Elite for Galaxy(定制版,3.4GHz 主频)
- 屏幕:6.9 英寸 Dynamic AMOLED 2X,120Hz
- 内存:12GB / 16GB
- NPU 算力:46 TOPS

### AI 能力
- Galaxy AI 2.0:实时通话翻译、AI 摘要、智能搜索
- Google Gemini Nano 集成:端侧推理
- Bixby 重塑:基于 Gemini Pro 多模态
- AI Select 智能截屏
- Circle to Search 升级,支持图文混合搜索

三星与 Google、OpenAI 三方合作,S25 Ultra 可调用 ChatGPT 处理复杂任务,开创"手机调用云端大模型"新范式。`,
      category: '科技前沿',
      author: '三星官方',
      cover: AI_LOGO_COVER,
      sort: 74,
      isPinned: false,
    },
    {
      title: 'Meta Ray-Ban 智能眼镜销量破百万:AI 可穿戴设备市场爆发',
      summary:
        'Meta 与 EssilorLuxottica 合作的 Ray-Ban Meta 智能眼镜 2024 年销量突破 100 万副,内置 Meta AI 多模态助手。',
      content: `## Ray-Ban Meta 现象级热销

Meta 与 EssilorLuxottica 合作的 **Ray-Ban Meta 智能眼镜** 在 2024 年成为现象级可穿戴 AI 产品,全年销量突破 100 万副,在多个市场断货。

### 产品规格
- 重量:49 克(比经典 Ray-Ban Wayfarer 仅重 5 克)
- 摄像头:1200 万像素
- 音频:开放式扬声器 + 麦克风
- 续航:4 小时连续使用,充电眼镜盒续航 36 小时

### AI 能力
- **Meta AI 内置**:支持语音对话、视觉识别
- 多模态:可识别眼镜看到的物体、文字、场景
- 实时翻译:支持英语、法语、意大利语、西班牙语互译
- 翻译模式与对话模式切换

Ray-Ban Meta 证明"轻量化 AI 可穿戴"商业模式可行,推动苹果、谷歌、三星加速智能眼镜研发。`,
      category: '科技前沿',
      author: 'Meta 官方',
      cover: AI_LOGO_COVER,
      sort: 73,
      isPinned: false,
    },
    {
      title: 'AMD Instinct MI325X / MI350 量产:挑战 NVIDIA H100 / H200',
      summary:
        'AMD 2024 年 10 月发布 MI325X,2025 年推出 MI350 系列,288GB HBM3e 显存,Meta、微软大规模采购。',
      content: `## AMD Instinct GPU 进阶

AMD 于 2024 年 10 月发布 **Instinct MI325X** GPU,2025 年推出 **MI350 系列**(CDNA 4 架构),正面挑战 NVIDIA H100/H200 地位。

### MI325X 规格
- 显存:288GB HBM3e(业界最大)
- 带宽:6.0 TB/s
- 计算性能:FP8 21.2 PFLOPS
- 工艺:台积电 4nm
- 较 H200 推理性能提升 30%

### MI350 系列(2025)
- CDNA 4 架构
- 支持 FP4 精度
- 较 MI325X 性能再提升 35%
- 内存带宽升级至 8 TB/s

### 客户部署
- Meta:Llama 4 训练集群
- 微软:Azure ND MI300X v5 实例
- Oracle Cloud Infrastructure:大规模采购
- OpenAI:推理集群补充

ROCm 6 软件栈成熟,PyTorch / Triton / vLLM 全面支持,软件生态短板逐步补齐。`,
      category: '科技前沿',
      author: 'AMD 官方',
      cover: AI_LOGO_COVER,
      sort: 72,
      isPinned: false,
    },
    {
      title: 'Intel Gaudi 3 与 Lunar Lake:AI 加速器与端侧 AI 芯片双线推进',
      summary:
        'Intel 2024 年推出 Gaudi 3 AI 加速器与 Lunar Lake 笔记本芯片,NPU 算力 48 TOPS,推动 AI PC 时代。',
      content: `## Intel 双线 AI 战略

2024 年 Intel 同时推进数据中心 **Gaudi 3** AI 加速器与端侧 **Lunar Lake** 笔记本芯片,瞄准 AI 训练与 AI PC 两大市场。

### Gaudi 3 加速器
- 工艺:台积电 5nm
- 显存:128GB HBM2e
- 算力:BF16 1835 TFLOPS
- 较 H100 推理性能提升 30%,性价比提升 50%
- 价格优势:建议零售价约 12.5 万美元,远低于 H100

### Lunar Lake 处理器
- 工艺:台积电 3nm
- NPU 算力:48 TOPS(满足 Copilot+ PC 标准)
- 续航:笔记本可达 20 小时
- 集成 ARK GPU Xe2 架构

Intel 联合微软定义 Copilot+ PC 标准,要求 NPU ≥ 40 TOPS,推动端侧 AI 应用普及。2025 年 AI PC 出货量预计突破 1 亿台。`,
      category: '科技前沿',
      author: 'Intel 官方',
      cover: AI_LOGO_COVER,
      sort: 71,
      isPinned: false,
    },

    // ============ 2. 教育创新 (sort 70-61) ============
    {
      title: 'Khan Academy Khanmigo 全面开放:GPT-4 驱动的 AI 个性化导师',
      summary:
        'Khan Academy 2024 年面向所有美国教育工作者免费开放 Khanmigo AI 导师,基于 GPT-4 提供苏格拉底式启发教学。',
      content: `## Khanmigo 全面落地

Khan Academy 在 2024 年将 **Khanmigo** AI 导师向所有美国 K-12 教育工作者免费开放,基于 GPT-4 提供个性化教学辅导。

### 核心理念
Khanmigo 采用**苏格拉底式启发教学**,不直接给答案,而是通过引导式提问帮助学生自己思考与推理,真正实现"一对一个性化教学"。

### 功能特性
- 学生模式:数学解题引导、写作批改、编程辅导、历史角色扮演
- 教师模式:课程设计、教案生成、学生进度分析
- 家长模式:孩子学习数据洞察
- 多语言支持:覆盖 30+ 语种

### 落地成效
- 2024 年注册用户超 500 万
- 教师每周节省备课时间约 5-8 小时
- 学生数学成绩提升 12-18%
- 师生互动时长提升 2.3 倍

Khanmigo 证明"AI 辅助教育公平化"可行,Sal Khan 提出"给每个学生配一对一个性化导师"愿景正在落地。`,
      category: '教育创新',
      author: 'Khan Academy',
      cover: CHATGPT_COVER,
      sort: 70,
      isPinned: true,
    },
    {
      title: 'OpenAI ChatGPT Edu 高校版发布:为大学提供企业级 GPT-4o 服务',
      summary:
        'OpenAI 2024 年 5 月推出 ChatGPT Edu,为高校提供 GPT-4o、长上下文、数据分析与企业级隐私保护。',
      content: `## ChatGPT Edu 高校版

2024 年 5 月 30 日,OpenAI 推出 **ChatGPT Edu** 高校版,为大学提供企业级 GPT-4o 服务,价格远低于商业版本。

### 核心特性
- 模型:GPT-4o、GPT-4o-mini
- 上下文:128K tokens
- 数据分析:支持 Excel / CSV 上传分析
- 自定义 GPT:教师可创建学科专属助手
- 隐私保护:对话数据不用于训练模型

### 合作高校
- 哈佛、剑桥、牛津、宾大、得州大学等
- 哥伦比亚大学:哲学课程 AI 辅助
- 亚利桑那州立大学:OpenAI 首个官方合作高校
- 沃顿商学院:商业分析课程集成

### 应用场景
论文写作辅助与查重、编程作业批改、研究文献综述、实验设计与数据分析、学生心理辅导试点。ChatGPT Edu 让高校以可控方式将 AI 纳入教学,推动高等教育进入"AI 原生"时代。`,
      category: '教育创新',
      author: 'OpenAI 官方',
      cover: CHATGPT_COVER,
      sort: 69,
      isPinned: false,
    },
    {
      title: 'Coursera GenAI Academy 上线:生成式 AI 技能与认证体系',
      summary:
        'Coursera 2024 年推出 GenAI Academy,与 Google、IBM、DeepLearning.AI 合作,提供 GenAI 课程与职业认证。',
      content: `## Coursera GenAI Academy

Coursera 于 2024 年正式上线 **GenAI Academy**,整合生成式 AI 技能课程与职业认证体系,响应企业 GenAI 人才需求爆发。

### 课程体系
- **入门级**:GenAI 概念、Prompt 工程、ChatGPT 实战
- **进阶级**:LLM 微调、RAG 系统构建、LangChain 开发
- **专家级**:多模态 AI、Agent 系统、GenAI 安全与伦理

### 合作伙伴
- Google Cloud:GenAI 工程师认证
- IBM:Watsonx AI 平台课程
- DeepLearning.AI:吴恩达亲授短期课程
- Vanderbilt University:Prompt 工程专项
- OpenAI:官方 GPT-4 应用课程

### 职业认证
- GenAI Engineer Professional Certificate
- AI Product Manager Certificate
- AI Ethics Specialist Certificate

### 学习数据
- 2024 年 GenAI 课程注册量同比增长 700%
- 70% 学习者来自企业培训项目
- 认证持有人平均薪资提升 25%`,
      category: '教育创新',
      author: 'Coursera 官方',
      cover: AI_LOGO_COVER,
      sort: 68,
      isPinned: false,
    },
    {
      title: 'Duolingo Max 落地中国:GPT-4 驱动语言学习新体验',
      summary:
        'Duolingo 2024 年将 Max 订阅扩展至 12 种语言,提供 Roleplay 角色扮演与 Explain My Answer 功能。',
      content: `## Duolingo Max 扩展

Duolingo 在 2024 年将 **Max 订阅**服务从最初的 6 种语言扩展至 12 种,引入 GPT-4 驱动的智能学习功能,重塑语言学习体验。

### 核心功能
- **Roleplay 角色扮演**:与 AI 角色进行真实场景对话(点咖啡、订酒店、面试等)
- **Explain My Answer**:详细解释为何答错,提供语法与语境分析
- **Video Call**:视频通话陪练,模拟真实交流
- **Adaptive Lessons**:基于学习数据动态调整难度

### 语种支持
英语、西班牙语、法语、德语、意大利语、葡萄牙语;2024 新增:日语、韩语、中文、印地语、阿拉伯语、俄语。

### 商业表现
- Max 订阅价格:每月 30 美元,Super 订阅 2 倍
- 2024 年 Max 用户突破 200 万
- DAU 同比增长 60%,付费用户增长 50%

Duolingo Max 证明"AI 个性化对话练习"是语言学习的高效模式,被哈佛、MIT 等校作为补充教材推荐。`,
      category: '教育创新',
      author: 'Duolingo 官方',
      cover: CHATGPT_COVER,
      sort: 67,
      isPinned: false,
    },
    {
      title: 'Canvas Mastery Connect AI:Instructure 推动 K-12 智能评估',
      summary:
        'Instructure 2024 年将 AI 集成至 Canvas LMS 与 Mastery Connect,提供自动评分、学习分析与个性化推荐。',
      content: `## Canvas LMS + AI

Instructure 2024 年深度集成 AI 至 **Canvas LMS** 与 **Mastery Connect** 平台,为 K-12 教育提供智能化评估与教学辅助。

### Canvas AI 功能
- **智能作业生成**:教师输入学习目标,AI 自动生成作业题目
- **自动评分**:数学、选择题、简答题自动批改
- **Rubric Assistant**:基于教学大纲生成评分量表
- **学习分析**:学生知识掌握度可视化
- **个性化路径**:根据掌握度推荐学习资源

### Mastery Connect 评估
- 标准对齐:与 Common Core、Next Generation Science Standards 等对接
- 形成性评估自动化
- 学生学习差距识别与补救建议

### 隐私与安全
- FERPA、COPPA 合规
- 数据不用于训练第三方模型
- 教师审批机制:AI 输出需教师确认

Canvas 全球服务 3000+ 教育机构、3000 万+ 学生,2024 年 AI 功能使用率达 65%。`,
      category: '教育创新',
      author: 'Instructure 官方',
      cover: AI_LOGO_COVER,
      sort: 66,
      isPinned: false,
    },
    {
      title: 'Minerva University 2025:AI 驱动的全沉浸式高等教育实验',
      summary:
        'Minerva University 2025 年将 AI 全面纳入课程,以"主动学习 Forum 平台 + AI 助教"模式重塑大学教育。',
      content: `## Minerva University 教育实验

Minerva University 持续推进 **AI 驱动的高等教育实验**,2025 年将生成式 AI 全面纳入课程体系,以其独特的 Forum 平台 + AI 助教模式吸引全球关注。

### 核心理念
- **主动学习**:全部课程采用研讨式教学,无传统讲授
- **AI 助教**:每个研讨组配备 AI 助教,实时提供资料、纠错、引导
- **跨学科整合**:四大思维习惯(HCAs)+ 80 个核心概念
- **全球轮转**:本科 4 年在 7 个城市学习(旧金山、首尔、海得拉巴、柏林、布宜诺斯艾利斯、伦敦、台北)

### 2025 AI 课程
- AI 辅助科研方法课
- AI 工具与批判性思维
- AI 伦理与社会影响
- 学生毕业需提交 AI 协作完成的研究项目

### 数据成果
- 申请量 2024 年较 2023 年增长 40%
- 毕业生 5 年内平均薪资 8.5 万美元
- 35% 毕业生进入全球顶尖研究生院

Minerva 证明"小规模 + AI + 全球轮转"的高等教育新模式可行。`,
      category: '教育创新',
      author: 'Minerva University',
      cover: AI_LOGO_COVER,
      sort: 65,
      isPinned: false,
    },
    {
      title: 'OpenAI 与亚利桑那州立大学深度合作:AI 进高校典范',
      summary:
        'ASU 与 OpenAI 2024 年合作升级,部署 ChatGPT Enterprise 至全校园,创建 AI 加速器与学科专属 GPT。',
      content: `## ASU + OpenAI 合作典范

亚利桑那州立大学(ASU)是 OpenAI 首个高校官方合作伙伴,2024 年合作升级至全校园规模,成为 AI 进高校的全球典范。

### 合作内容
- **ChatGPT Enterprise 全校部署**:覆盖 8 万师生
- **AI 加速器**:ASU AI Accelerator,资助师生创建学科专属 GPT
- **科研合作**:OpenAI 提供 API 额度与模型早期访问
- **教师培训**:AI 教学工作坊与认证体系

### 典型应用
- 新闻学院:AI 辅助新闻写作与事实核查
- 工程学院:AI 代码评审与算法优化
- 医学院:AI 辅助诊断训练
- 法学院:AI 法律检索与案例分析
- 心理学:AI 对话系统实验

### 成果数据
- 师生创建 500+ 自定义 GPT
- 课程集成率从 12% 提升至 67%
- 教师备课时间节省 30%
- 学生满意度评分 4.6/5

ASU 模式被哈佛、宾大、得州大学、剑桥等校借鉴。`,
      category: '教育创新',
      author: 'Arizona State University',
      cover: CHATGPT_COVER,
      sort: 64,
      isPinned: false,
    },
    {
      title: '智谱 AI + 清华大学 GLM 教育大模型:中国高校 AI 教育标杆',
      summary:
        '智谱 AI 与清华大学 2024 年联合发布 GLM-4 教育版,部署至清华、北大、复旦等 200+ 高校教学场景。',
      content: `## 智谱 GLM 教育大模型

智谱 AI 与清华大学在 2024 年联合推出 **GLM-4 教育版**,作为中国高校 AI 教育标杆,部署至 200+ 双一流高校与重点中学。

### GLM-4 教育版特性
- 基座:GLM-4 9B 开源版本微调
- 学科优化:数学、物理、化学、生物、历史等学科语料强化
- 安全过滤:严格的未成年人内容过滤
- 多模态:支持公式识别、图表理解、解题过程可视化
- 端侧部署:支持学校本地化部署,数据不出校

### 应用场景
- 清华大学:计算机系程序设计课程 AI 助教
- 北京大学:数学学院解题辅导系统
- 复旦大学:文科论文写作辅助
- 上海交通大学:工程实训 AI 评估

### 政策支持
- 教育部"人工智能 + 教育"试点项目
- 北京市、上海市、深圳市等地方专项支持

智谱 GLM 教育版代表中国自主大模型教育应用突破,打破 GPT 教育市场主导地位。`,
      category: '教育创新',
      author: '智谱 AI + 清华大学',
      cover: AI_LOGO_COVER,
      sort: 63,
      isPinned: false,
    },
    {
      title: '学而思 MathGPT 发布:好未来垂直学科大模型实战',
      summary:
        '好未来 2024 年发布学而思 MathGPT 学科大模型,聚焦 K-12 数学解题与启发式教学,通过教育部备案。',
      content: `## 学而思 MathGPT 落地

好未来集团于 2024 年正式发布 **学而思 MathGPT**,聚焦 K-12 数学解题与启发式教学的垂直学科大模型,首批通过教育部生成式 AI 备案。

### 模型特点
- 基座:好未来自研数学专用大模型
- 训练数据:10 亿 + 数学题目与解析过程
- 解题能力:覆盖小学至高中全学段,K12 数学竞赛题正确率 92%
- 启发式教学:不直接给答案,引导式解题步骤
- 多模态:支持几何图形、函数图像、概率统计图表

### 产品形态
- 学而思学习机集成
- 学而思网校 App 内嵌
- 教师备课工具
- 个性化错题本生成

### 商业表现
- 2024 年学习机销量突破 100 万台
- MathGPT 月活用户 800 万
- 学习效率提升 35%,题目重复率降低 60%

好未来、科大讯飞、猿力科技等 11 家公司首批通过生成式 AI 教育应用备案。`,
      category: '教育创新',
      author: '好未来集团',
      cover: AI_LOGO_COVER,
      sort: 62,
      isPinned: false,
    },
    {
      title: 'UNESCO AI 素养框架:全球 AI 教育标准与教师能力建设',
      summary:
        'UNESCO 2024 年发布《AI 素养能力框架》与《教师 AI 能力框架》,定义全球公民 AI 素养四大维度。',
      content: `## UNESCO AI 素养框架

联合国教科文组织(UNESCO)2024 年发布 **《学生 AI 能力框架》** 与 **《教师 AI 能力框架》**,为全球 AI 教育提供统一标准。

### 学生 AI 能力框架
四大维度:
1. **以人为中心思维方式**:理解人类与 AI 关系
2. **以人为本伦理**:AI 应用中的伦理判断
3. **AI 技术与运用**:基础技术理解与应用
4. **AI 系统设计**:参与 AI 系统构建

每个维度分"获得 / 加深 / 创造"三级进阶。

### 教师 AI 能力框架
- 人本思维方式
- 人类伦理与 AI 伦理
- AI 基础与应用
- AI 教学法融合
- AI 用于学习与专业发展

### 落地实施
- 193 个成员国承诺 2025-2030 年纳入教育体系
- 中国、新加坡、韩国、芬兰率先试点
- UNESCO 在非洲、东南亚提供能力建设培训

UNESCO 框架为全球 AI 教育治理提供基础,推动 AI 素养从"技能"上升为"公民基本素养"。`,
      category: '教育创新',
      author: 'UNESCO',
      cover: AI_LOGO_COVER,
      sort: 61,
      isPinned: false,
    },

    // ============ 3. 金融科技 (sort 60-51) ============
    {
      title: '美国 SEC 正式批准比特币现货 ETF:加密货币进入主流金融市场',
      summary:
        '美国 SEC 2024 年 1 月 10 日批准 11 支比特币现货 ETF,首日交易量超 46 亿美元,加密资产主流化。',
      content: `## 比特币现货 ETF 历史性获批

2024 年 1 月 10 日,美国证券交易委员会(SEC)正式批准 **11 支比特币现货 ETF** 上市交易,这是加密资产进入主流金融市场的里程碑事件。

### 获批 ETF
- BlackRock iShares Bitcoin Trust (IBIT)
- Fidelity Wise Origin Bitcoin Fund (FBTC)
- Bitwise Bitcoin ETF (BITB)
- Ark 21Shares Bitcoin ETF (ARKB)
- Invesco Galaxy Bitcoin ETF (BTCO)
- 等 11 支

### 交易数据
- 首日交易量超 46 亿美元
- 2024 全年净流入超 360 亿美元
- IBIT 资产规模突破 500 亿美元(全球最大商品 ETF)
- 机构投资者占比 60%

### 市场影响
- 比特币价格 2024 年突破 10 万美元历史新高
- 华尔街机构大规模配置加密资产
- 养老金、捐赠基金首次纳入比特币配置
- 传统金融与加密世界深度融合

2024 年 7 月,以太坊现货 ETF 同步获批,加密资产主流化加速。`,
      category: '金融科技',
      author: '美国 SEC',
      cover: BITCOIN_COVER,
      sort: 60,
      isPinned: true,
    },
    {
      title: '以太坊现货 ETF 获批:第二个主流加密资产证券化',
      summary:
        '美国 SEC 2024 年 7 月 23 日批准以太坊现货 ETF,BlackRock ETHA 与 Fidelity FETH 上线,首周流入 12 亿美元。',
      content: `## 以太坊现货 ETF 上市

2024 年 7 月 23 日,美国 SEC 正式批准 **以太坊现货 ETF** 上市交易,继比特币之后第二个主流加密资产实现证券化。

### 获批 ETF
- BlackRock iShares Ethereum Trust (ETHA)
- Fidelity Ethereum Fund (FETH)
- Grayscale Ethereum Trust (ETHE) 转型
- Grayscale Ethereum Mini Trust (ETH)
- Bitwise Ethereum ETF (ETW) 等 9 支

### 交易数据
- 首日交易量约 1.85 亿美元
- 首周净流入 12 亿美元
- 截至 2024 年底累计流入 25 亿美元
- ETH 价格在 ETF 获批后短期上涨 10%

### 与比特币 ETF 差异
- 以太坊质押收益未纳入 ETF(SEC 担忧证券属性)
- 流入规模约为比特币 ETF 的 1/3
- 机构配置比例较低

ETH ETF 巩固以太坊作为"商品"而非"证券"的法律地位,推动 DeFi 与机构金融进一步融合。`,
      category: '金融科技',
      author: '美国 SEC',
      cover: BITCOIN_COVER,
      sort: 59,
      isPinned: false,
    },
    {
      title: '美联储 CBDC 白皮书进展:数字美元研究与政策辩论',
      summary:
        '美联储 2024-2025 年持续发布 CBDC 研究报告,探讨数字美元潜在架构、隐私保护与金融稳定影响。',
      content: `## 美联储 CBDC 进展

美联储 2024-2025 年持续发布 **中央银行数字货币(CBDC)** 研究报告与政策咨询,虽未正式决定发行数字美元,但研究深度与广度持续扩展。

### 研究方向
- **架构设计**:中介型 vs 直接型 vs 混合型
- **隐私保护**:小额交易匿名 vs 大额可追溯
- **跨境支付**:与 IMF、BIS 跨境 CBDC 互操作研究
- **金融稳定**:对商业银行存款迁移的影响

### 政策立场
- 鲍威尔主席明确:未经国会授权不会发行数字美元
- 2024 年大选期间,共和党反对 CBDC,民主党谨慎支持研究
- Project Cedar 与 Project mBridge 等国际合作持续推进

### 与中国对比
- 中国 DCEP 数字人民币已落地 25 个城市,交易规模超 7 万亿元
- 美国 CBDC 进度落后,但研究深度领先
- 美国优先推动稳定币监管(如 PYUSD、USDC)

2025-2026 年数字美元是否落地仍是政策辩论焦点,但稳定币已成为美国实际选择的"准 CBDC"路径。`,
      category: '金融科技',
      author: '美联储',
      cover: AI_LOGO_COVER,
      sort: 58,
      isPinned: false,
    },
    {
      title: 'Stripe 加密支付全面接入:传统支付巨头拥抱数字货币',
      summary:
        'Stripe 2024 年重新支持加密货币支付,集成 USDC 稳定币结算,收购 Bridge 10 亿美元布局加密基础设施。',
      content: `## Stripe 加密支付战略

Stripe 在 2024 年全面重启加密支付业务,从稳定币结算、加密商户接入到基础设施收购,展现传统支付巨头拥抱数字货币的决心。

### 业务布局
- **USDC 结算**:Stripe 商户可选择 USDC 收款,链上结算秒级到账
- **加密卡发行**:与 Coinbase、币安合作发卡
- **支付链选择**:Solana、Ethereum、Polygon、Base
- **商户费率**:加密交易费率 1.5%,低于信用卡 2.9%

### Bridge 收购
- 2024 年 10 月,Stripe 以 **11 亿美元**收购稳定币基础设施公司 Bridge
- Bridge 提供稳定币编排、合规、跨境支付 API
- 是加密行业史上最大并购之一

### 商业动机
- 全球跨境支付市场规模 250 万亿美元
- 传统 SWIFT 跨境支付慢、贵、不透明
- 稳定币 + 链上结算可实现"秒级 + 1% 成本"

Stripe 加密战略推动稳定币从"加密原生"走向"主流支付",PayPal、Square、Revolut 同步跟进。`,
      category: '金融科技',
      author: 'Stripe 官方',
      cover: AI_LOGO_COVER,
      sort: 57,
      isPinned: false,
    },
    {
      title: 'PayPal PYUSD 稳定币扩张:首个主流金融科技发行美元稳定币',
      summary:
        'PayPal 2023-2024 年推出 PYUSD 稳定币,与 Paxos 合作发行,2024 年扩展至 Solana 链,流通量突破 7 亿美元。',
      content: `## PayPal PYUSD 稳定币

PayPal 于 2023 年 8 月推出 **PYUSD(PayPal USD)** 稳定币,与受 NYDFS 监管的 Paxos Trust 合作发行,成为首个主流金融科技公司发行的美元稳定币。

### 关键特性
- 锚定:1:1 美元储备(现金 + 短期美国国债)
- 发行方:Paxos Trust Company
- 监管:纽约金融服务部(NYDFS)
- 链:Ethereum(2023)/ Solana(2024 扩展)
- 兑付:PayPal 用户可直接 1:1 兑换美元

### 应用场景
- PayPal 4.3 亿用户间跨境转账
- Xoom 国际汇款(免手续费)
- 商户收款
- Web3 应用入口

### 流通数据
- 2024 年流通量峰值 7.5 亿美元
- 月活跃钱包数 200 万
- Solana 链上交易占 70%

PYUSD 证明传统金融科技可合规发行稳定币,推动 USDC、USDT 等竞品加快合规步伐,Venmo、Cash App 等平台跟进,稳定币成支付标准配置。`,
      category: '金融科技',
      author: 'PayPal 官方',
      cover: AI_LOGO_COVER,
      sort: 56,
      isPinned: false,
    },
    {
      title: 'Block Square + Afterpay:BNPL 与商家生态深度整合',
      summary:
        'Block (Square 母公司) 2024 年深化 Afterpay 整合,Square 商家 BNPL 交易量同比增长 40%。',
      content: `## Block BNPL 整合战略

Block 公司(Square 母公司,Jack Dorsey 创办)在 2024 年深化 **Afterpay**(先买后付)与 Square 商家生态整合,推动 BNPL 业务增长。

### Square + Afterpay 整合
- Square 商家收款端默认集成 Afterpay 选项
- Afterpay 卡发布:消费者可在任何支持 Visa 的商家使用 BNPL
- Cash App 集成:用户可在 Cash App 内使用 Afterpay 额度
- 数据打通:Square 商户数据反哺 Afterpay 风控模型

### 业务数据(2024)
- BNPL 交易量同比增长 40%
- 商家使用率从 35% 提升至 52%
- Afterpay 卡持卡人 600 万
- 单笔平均订单金额提升 35%

### 战略协同
- Square 服务商家,Afterpay 服务消费者,Cash App 服务无银行账户人群
- Block 打造"商家 + 消费者 + 支付"闭环
- 通过 BNPL 提升用户粘性与交易频次

Block 模式证明 BNPL 不只是支付工具,更是消费者金融入口,推动 Affirm、Klarna、Zip 等竞品加速生态整合。`,
      category: '金融科技',
      author: 'Block 公司',
      cover: AI_LOGO_COVER,
      sort: 55,
      isPinned: false,
    },
    {
      title: 'JPMorgan Onyx 区块链平台:华尔街机构级区块链基础设施',
      summary:
        'JPMorgan Onyx 区块链平台 2024 年处理回购交易超 1 万亿美元,与 DBS、星展银行合作跨境结算。',
      content: `## JPMorgan Onyx 区块链平台

JPMorgan Chase 的 **Onyx** 区块链平台 2024 年持续扩展,成为华尔街机构级区块链基础设施标杆,日均处理回购交易超 10 亿美元。

### Onyx 平台组成
- **Onyx Digital Assets**:代币化资产发行与管理
- **Liink**:机构间区块链数据网络(原 Interbank Information Network)
- **Coin Systems**:JPM Coin 美元与欧元结算系统
- **Programmable Payments**:可编程支付(自动执行条件支付)

### 业务规模
- 2024 年回购交易累计超 1 万亿美元
- JPM Coin 日均交易额超 10 亿美元
- 网络成员银行超 100 家
- 处理跨境支付 200+ 国家

### 应用案例
- **回购协议代币化**:Sierra Investment Partners 等机构使用
- **跨境结算**:与 DBS、星展银行、TDB 合作
- **抵押品管理**:与 BlackRock BUIDL 合作

Onyx 证明机构级区块链可行,推动 BIS Project mBridge、Project Agorá 等央行合作,高盛 GS DCM、富兰克林邓普顿 BENJI 等竞品跟进。`,
      category: '金融科技',
      author: 'JPMorgan Chase',
      cover: AI_LOGO_COVER,
      sort: 54,
      isPinned: false,
    },
    {
      title: '蚂蚁链开放联盟链:中国区块链产业基础设施',
      summary:
        '蚂蚁链 2024 年开放联盟链接入企业超 1 万家,落地溯源、版权、供应链金融场景,跨境互通超 30 国。',
      content: `## 蚂蚁链产业落地

蚂蚁集团旗下 **蚂蚁链(AntChain)** 2024 年持续作为中国区块链产业基础设施,服务企业超 1 万家,跨境互通覆盖 30+ 国家。

### 核心平台
- **开放联盟链**:中小企业低成本接入,单笔交易成本 0.01 元
- **BaaS 平台**:企业级区块链即服务
- **蚂蚁链 T1**:自研区块链硬件加速芯片
- **隐私计算平台**:多方安全计算 + 联邦学习

### 应用场景
- **商品溯源**:五常大米、茅台酒、新疆棉等品牌溯源
- **版权保护**:数字内容确权,2024 年新增版权登记 5000 万件
- **供应链金融**:应收账款融资,累计放款超 5000 亿元
- **跨境贸易**:与新加坡、泰国、马来西亚海关数据互通

### 国际合作
- 跨境支付:Alipay+ 集成蚂蚁链,支持 25 国钱包互扫
- BIS Project mBridge:参与央行数字货币桥项目
- 联合国 UNDP:发展中国家数字身份与援助发放

蚂蚁链代表中国"区块链 + 实体经济"路径,与美国"加密资产"路径形成对比。`,
      category: '金融科技',
      author: '蚂蚁集团',
      cover: AI_LOGO_COVER,
      sort: 53,
      isPinned: false,
    },
    {
      title: '数字人民币 DCEP 落地:中国 CBDC 全球领先部署',
      summary:
        '截至 2025 年,数字人民币试点扩至 25 个城市,累计交易额超 7 万亿元,跨境结算 Project mBridge 推进。',
      content: `## 数字人民币 DCEP 进展

中国央行数字货币 **DCEP(Digital Currency Electronic Payment)/ 数字人民币** 在 2024-2025 年持续扩大试点,保持全球 CBDC 部署领先地位。

### 试点进展
- 试点城市:从首批 4 城扩至 25 城(深圳、苏州、雄安、成都、北京、上海等)
- 累计交易额:2024 年底超 7 万亿元
- 累计交易笔数:超 10 亿笔
- 开立钱包数:超 8 亿个

### 应用场景
- 零售支付:超市、餐饮、交通
- 政务服务:税费、社保、补贴发放
- 跨境支付:深圳-香港、珠海-澳门互通
- 智能合约:定向支付(政府补贴)、条件支付(预付卡)
- 离线支付:NFC 双离线支付功能上线

### Project mBridge 跨境
- 与 BIS、香港、泰国、阿联酋央行合作
- 2024 年扩展至沙特央行加入
- 商业银行试点,跨境贸易结算秒级到账
- 累计交易额超 200 亿元

数字人民币推动人民币国际化,提升货币政策精准性(可编程支付),增强金融普惠性。`,
      category: '金融科技',
      author: '中国人民银行',
      cover: AI_LOGO_COVER,
      sort: 52,
      isPinned: false,
    },
    {
      title: '欧洲央行数字欧元原型:EU CBDC 隐私优先架构',
      summary:
        '欧洲央行 2024 年发布数字欧元原型设计,强调隐私优先与离线支付,计划 2025-2026 年立法准备阶段。',
      content: `## 数字欧元原型设计

欧洲央行(ECB)2024 年发布 **数字欧元** 原型架构设计,正式启动立法准备阶段,计划 2025-2026 年完成立法,2027-2028 年试点发行。

### 设计原则
- **隐私优先**:小额交易离线匿名,大额交易可追溯
- **离线支付**:支持 NFC 双离线交易
- **免费基础服务**:个人用户基础支付免费
- **中介分发**:商业银行与支付服务商分发
- **限额持有**:个人持有上限 3000 欧元(防银行挤兑)

### 技术架构
- 双层架构:央行核心账本 + 中介分发层
- 离线支付模块:基于 Secure Element 与 TEE
- 隐私保护:零知识证明 + 批量匿名化
- 跨境互操作:与 IMF、BIS 推进 CBDC 互通

### 立法进程
- 2023 年 6 月:ECB 启动准备阶段
- 2024 年:欧盟委员会提交立法提案
- 2025-2026 年:欧洲议会与理事会审议
- 2027-2028 年:试点发行

### 政策辩论
- 德国、荷兰担忧隐私
- 法国支持 CBDC 推进
- 商业银行担忧存款迁移
- ECB 承诺数字欧元不替代现金`,
      category: '金融科技',
      author: '欧洲央行',
      cover: AI_LOGO_COVER,
      sort: 51,
      isPinned: false,
    },

    // ============ 4. 医疗健康 (sort 50-41) ============
    {
      title: 'AlphaFold 3 发布:DeepMind 重磅突破预测分子相互作用',
      summary:
        'DeepMind 2024 年 5 月发布 AlphaFold 3,可预测蛋白质、DNA、RNA、配体复合物结构,药物发现革命。',
      content: `## AlphaFold 3 重磅发布

DeepMind 于 2024 年 5 月 8 日发布 **AlphaFold 3**,从蛋白质结构预测扩展至所有生命分子相互作用预测,标志 AI 药物发现进入新阶段。

### 核心突破
- 预测范围:蛋白质、DNA、RNA、配体、离子复合物
- 准确度:较 AlphaFold 2 提升 50% 以上
- 速度:几秒内完成传统实验需数月的工作
- 模型架构:Pairformer + Diffusion 模块

### 药物发现革命
- 准确预测药物-靶点结合
- 减少实验筛选工作量 80%
- 加速先导化合物优化
- Isomorphic Labs 已与 Novartis、Lilly 签约合作

### 开放策略
- AlphaFold Server 免费供非商业研究使用
- 商业许可通过 Isomorphic Labs
- 模型权重不开源(争议点)

### 行业影响
- 2024 年起全球新药研发管线 30% 使用 AlphaFold 3
- Pfizer、Moderna、Roche 等全面接入
- 标志 AI 药物发现从"辅助"走向"核心"

2025 年 AlphaFold 3 商业版进入临床试验候选药物筛选阶段。`,
      category: '医疗健康',
      author: 'DeepMind',
      cover: AI_LOGO_COVER,
      sort: 50,
      isPinned: true,
    },
    {
      title: 'CRISPR 基因疗法 Casgevy 获批:首个人类 CRISPR 治疗上市',
      summary:
        'Vertex + CRISPR Therapeutics Casgevy 2023-2024 年获 FDA 批准治疗镰刀型贫血与 β 地中海贫血,首个 CRISPR 基因疗法。',
      content: `## Casgevy 历史 CRISPR 疗法

Vertex Pharmaceuticals 与 CRISPR Therapeutics 合作的 **Casgevy(exagamglogene autotemcel,exa-cel)** 2023 年 11 月- 2024 年相继获英国 MHRA、美国 FDA 批准,成为首个基于 CRISPR-Cas9 基因编辑技术的获批疗法。

### 适应症
- **镰刀型贫血(SCD)**:2023 年 12 月 FDA 批准
- **β 地中海贫血(TDT)**:2024 年 1 月 FDA 批准

### 治疗机制
1. 从患者体内提取造血干细胞
2. 在实验室用 CRISPR-Cas9 编辑 BCL11A 基因
3. 重新输回患者体内
4. 编辑后细胞产生胎儿血红蛋白(HbF),替代缺陷成人血红蛋白

### 临床数据
- SCD 患者:96% 在 12 个月内无血管闭塞危象
- TDT 患者:91% 实现脱离输血依赖
- 持续疗效至少 5 年(长期跟踪中)

### 商业化
- 单次治疗费用 220 万美元
- 2024 年首批 50 例患者治疗
- 与保险公司谈判覆盖方案

Casgevy 标志基因编辑从实验室走向临床,推动 2024-2025 年 30+ CRISPR 疗法进入临床。`,
      category: '医疗健康',
      author: 'Vertex Pharmaceuticals',
      cover: AI_LOGO_COVER,
      sort: 49,
      isPinned: false,
    },
    {
      title: 'Apple Vision Pro 医疗应用:外科手术辅助与远程协作',
      summary:
        'Apple Vision Pro 2024 年进入医疗领域,UCSD、Stanford 等顶级医院用于手术可视化与远程教学。',
      content: `## Vision Pro 医疗场景

Apple Vision Pro 自 2024 年 2 月上市以来,在医疗领域找到首批高价值应用场景,被美国顶级医院引入手术辅助与远程教学。

### 应用场景
- **外科手术辅助**:主刀医生佩戴,实时叠加患者 CT/MRI 三维影像
- **远程手术指导**:专家远程观看术野,实时标注指导
- **解剖教学**:医学生通过 Vision Pro 学习三维解剖
- **远程会诊**:多地专家同步查看患者影像与病历
- **疼痛管理**:沉浸式 VR 减轻患者疼痛与焦虑

### 试点医院
- UCSD Health:腹腔镜手术辅助
- Stanford Health Care:神经外科手术规划
- Cedars-Sinai:远程会诊
- Mayo Clinic:医学教育
- 英国 NHS:疼痛管理

### 临床数据
- 手术时间平均缩短 15-20%
- 并发症率降低 30%
- 远程会诊效率提升 5 倍
- 医学生解剖学习效率提升 3 倍

Apple 与 Siemens Healthineers、Philips 合作开发医疗应用,2025 年医疗专用 Vision Pro 版本规划。`,
      category: '医疗健康',
      author: 'Apple 官方',
      cover: AI_LOGO_COVER,
      sort: 48,
      isPinned: false,
    },
    {
      title: 'ChatGPT 通过医学考试:AI 诊断能力接近全科医师水平',
      summary:
        'GPT-4 与 Med-PaLM 2 在 USMLE 医学考试中准确率超 85%,OpenAI 与 Mayo Clinic 合作 AI 辅助诊断。',
      content: `## AI 医学诊断能力突破

GPT-4 与 Google Med-PaLM 2 在 **美国医师执照考试(USMLE)** 中准确率超过 85%,达到全科医师水平,标志 AI 诊断进入临床可用阶段。

### 考试表现
- **GPT-4 USMLE Step 1-3**:准确率 80-90%
- **Med-PaLM 2 USMLE**:准确率 86.5%(人类平均 80%)
- **Med-Gemini(2024)**:准确率 91.1%
- **OpenAI o1 在临床推理任务**:超越 90% 实习医师

### 临床应用
- **Mayo Clinic + OpenAI**:辐射科影像辅助诊断
- **Stanford + Google Health**:眼底影像筛查糖尿病视网膜病变
- **Babylon Health**:症状自查与分诊
- **科大讯飞 + 北京协和医院**:AI 病历质控与诊断辅助

### 优势场景
罕见病诊断(基于文献全量知识)、影像筛查(微小病灶识别)、病历摘要与查重、患者教育与依从性提升。

### 监管进展
- FDA 2024 年累计批准 950+ AI 医疗器械
- 中国 NMPA 批准 200+ AI 辅助诊断三类器械
- 欧盟 MDR 框架下 AI 医疗器械分类细化

### 挑战
临床幻觉与责任归属、数据隐私与训练合规、算法偏见与公平性。`,
      category: '医疗健康',
      author: 'OpenAI + Mayo Clinic',
      cover: CHATGPT_COVER,
      sort: 47,
      isPinned: false,
    },
    {
      title: 'Mayo Clinic AI 诊断平台落地:从影像到多模态临床决策',
      summary: 'Mayo Clinic 2024 年部署 AI 诊断平台,整合心电图、影像、电子病历,辅助 50+ 疾病诊断。',
      content: `## Mayo Clinic AI 平台

Mayo Clinic(梅奥诊所)2024 年大规模部署 **AI 诊断平台**,整合心电图、影像、电子病历、基因组学数据,辅助 50+ 疾病诊断与治疗决策。

### 平台架构
- **数据层**:整合 EHR、PACS、可穿戴设备、基因组学
- **模型层**:自研医学大模型 + 合作 GPT-4 / Med-PaLM
- **应用层**:影像诊断、心电分析、风险预测、治疗建议
- **治理层**:FDA 合规、模型可解释性、医生审批

### 应用案例
- **心电图 AI**:左心室功能不全检测,准确率 93%
- **肺癌筛查**:低剂量 CT 自动结节分析,假阳性降低 40%
- **视网膜病变**:糖尿病视网膜病变筛查,准确率 95%
- **罕见病诊断**:基于症状与基因数据,缩短诊断时间 60%
- **化疗反应预测**:基于病理 AI 预测药物反应

### 与 OpenAI 合作
- Mayo Clinic Platform_Disrupt 早期接入 GPT-4
- 辐射科影像 AI 辅助诊断试点
- 医学知识库 RAG 系统构建
- 患者沟通模板生成

2024 年 AI 平台处理患者数据 500 万人次,医生诊断效率提升 30%,误诊率降低 25%。`,
      category: '医疗健康',
      author: 'Mayo Clinic',
      cover: AI_LOGO_COVER,
      sort: 46,
      isPinned: false,
    },
    {
      title: 'Google Med-PaLM 2 商用化:医疗领域专用 LLM 多场景落地',
      summary:
        'Google Health 2024 年加速 Med-PaLM 2 商用化,与 HCA Healthcare、Mayo Clinic、Bayer 合作多场景落地。',
      content: `## Med-PaLM 2 商用化

Google Health 在 2024 年加速 **Med-PaLM 2** 医疗专用大模型商用化,与多家顶级医院与药企合作,推动医疗 AI 从试点走向规模化应用。

### 模型特点
- 基座:PaLM 2 微调
- 训练数据:医学文献、临床指南、电子病历(脱敏)
- 评估:USMLE 准确率 86.5%
- 多模态:支持医学影像、病历文本、化验报告

### 合作伙伴
- **HCA Healthcare**:美国最大医院集团之一,部署临床决策支持
- **Mayo Clinic**:基因组学 AI 分析
- **Bayer 药业**:药物发现与临床试验
- **MediBio**:日本远程问诊平台
- **印度 Apollo Hospitals**:基层 AI 辅助诊断

### 应用场景
- 长文病历摘要(5 万字 → 500 字)
- 医学文献问答(支持 50 万篇 PubMed 摘要)
- 患者教育材料生成
- 临床试验匹配
- 医学影像报告自动生成

### 商业模式
- Google Cloud 提供 Vertex AI for Healthcare API
- 按 API 调用计费
- 私有化部署选项(大型医院)

Google Health 遵守 HIPAA 合规,FDA SaMD(作为医疗器械软件)分类,模型透明度与可解释性报告。`,
      category: '医疗健康',
      author: 'Google Health',
      cover: AI_LOGO_COVER,
      sort: 45,
      isPinned: false,
    },
    {
      title: 'Moderna AI mRNA 设计:生成式 AI 加速疫苗与药物研发',
      summary: 'Moderna 与 OpenAI 2024 年合作深化,AI 用于 mRNA 序列设计、临床数据分析和工厂运营。',
      content: `## Moderna AI 全链路落地

Moderna 与 OpenAI 在 2024 年深化合作,将生成式 AI 全面应用于 mRNA 序列设计、临床数据分析、监管申报与工厂运营,推动生物制药进入 AI 时代。

### mRNA 设计 AI
- mRNA 序列优化:基于 Transformer 的序列生成,翻译效率提升 5-10 倍
- 蛋白质表达预测:AlphaFold 3 集成
- 免疫原性预测:T 细胞表位设计

### 与 OpenAI 合作
- 2023 年 4 月:宣布 ChatGPT Enterprise 全公司部署
- 2024 年:4500 名员工日常使用,创建 750+ 自定义 GPT
- 应用场景:监管文档自动起草、临床试验数据分析、工厂生产排程优化、法律合同审查、内部知识检索

### 业务成果
- mRNA 候选药物研发周期缩短 30%
- 单条 mRNA 序列设计成本降低 60%
- 监管申报效率提升 5 倍
- 内部运营效率提升 20%

### 产品管线
- 2024 年 Moderna 管线 48 个项目
- RSV 疫苗 mRNA-1345 获 FDA 批准
- 个性化癌症疫苗 mRNA-4157 与 Merck KEYNOTE-942 临床推进`,
      category: '医疗健康',
      author: 'Moderna + OpenAI',
      cover: CHATGPT_COVER,
      sort: 44,
      isPinned: false,
    },
    {
      title: 'IBM Watson Health 重启:watsonx.ai 进军医疗 AI 平台',
      summary:
        'IBM 2024 年以 watsonx.ai 重新进军医疗 AI,与 Cleveland Clinic、FDA 合作药物警戒与监管科学。',
      content: `## IBM watsonx.ai 医疗战略

IBM 在 2023 年出售 Watson Health 业务给 Francisco Partners(后改名 Merative)后,2024 年以 **watsonx.ai** 平台重新进军医疗 AI 市场,新战略更注重平台与生态。

### watsonx.ai 平台
- **watsonx.ai**:基础模型训练与微调平台
- **watsonx.data**:数据湖与治理
- **watsonx.governance**:模型治理与合规
- 医疗专用模型:Med-PaLM 等开源基础模型微调

### 医疗合作伙伴
- **Cleveland Clinic**:药物警戒 AI 系统
- **FDA**:监管科学创新项目(CDRH)
- **Aetna 保险**:理赔自动化
- **英国 NHS**:临床决策支持
- **印度 Manipal Hospitals**:癌症辅助诊断

### 应用场景
- 药物警戒信号检测(从 FDA 不良事件报告)
- 电子病历结构化与编码
- 临床试验入组匹配
- 放疗方案规划
- 医保理赔自动审核

### 与 Watson Health 差异
- 不再推"AI 替代医生"叙事
- 强调"AI 平台 + 医院共建"
- 商业模式从 SaaS 转向平台 + 咨询
- 注重模型可解释性与监管合规

IBM 重启证明医疗 AI 需要"长期主义",算法精度不是唯一关键。`,
      category: '医疗健康',
      author: 'IBM 官方',
      cover: AI_LOGO_COVER,
      sort: 43,
      isPinned: false,
    },
    {
      title: 'Pfizer AI 药物发现:生成式 AI 加速小分子候选药物筛选',
      summary:
        'Pfizer 2024 年与 XtalPi、NVIDIA 合作,使用生成式 AI 筛选小分子,候选药物优化周期缩短 50%。',
      content: `## Pfizer AI 药物发现

Pfizer(辉瑞)在 2024 年全面推进 AI 在药物发现与开发中的应用,与 XtalPi、NVIDIA、IBM 等合作,加速小分子候选药物筛选与优化。

### 合作伙伴
- **NVIDIA BioNeMo**:蛋白质结构预测、分子生成
- **XtalPi(晶泰科技)**:AI + 量子物理分子模拟
- **IBM watsonx**:临床数据治理
- **Amazon Web Services**:大规模 AI 训练基础设施
- **Isomorphic Labs**:AlphaFold 3 商业合作

### AI 应用场景
- **靶点发现**:基于基因组学 + 文献挖掘识别新靶点
- **苗头化合物筛选**:虚拟筛选 10 亿分子库
- **先导化合物优化**:生成式 AI 设计新分子
- **ADMET 预测**:药物吸收、分布、代谢、排泄、毒性预测
- **晶型预测**:药物多晶型筛选
- **临床试验设计**:患者入组与终点优化

### 业务成果
- 候选药物优化周期从 18 个月缩短至 9 个月
- 苗头化合物筛选成本降低 70%
- 临床试验成功率提升 15%
- 药物再定位发现 10+ 新适应症

2024 年 Pfizer 在研管线 100+ 项目,AI 辅助推进的项目 30%。`,
      category: '医疗健康',
      author: 'Pfizer 官方',
      cover: AI_LOGO_COVER,
      sort: 42,
      isPinned: false,
    },
    {
      title: 'WHO AI 医疗伦理指南:全球 AI 健康治理框架',
      summary:
        '世界卫生组织 2024 年发布 AI 医疗伦理指南,涵盖数据治理、问责制、透明度、公平性六大原则。',
      content: `## WHO AI 医疗伦理框架

世界卫生组织(WHO)2024 年发布 **《AI 医疗伦理与治理指南》**(更新版),为全球 AI 健康应用提供统一伦理与治理框架。

### 六大核心原则
1. **保护自主性**:人类对医疗决策保持最终控制
2. **促进人类福祉、安全与公共利益**:AI 必须以患者为中心
3. **确保透明性、可解释性与智能性**:模型可追溯可理解
4. **培养责任性与问责制**:开发者、医院、监管机构明确责任
5. **确保包容性与公平性**:避免算法偏见,服务弱势群体
6. **促进可持续 AI**:长期可维护、可改进

### 治理框架
- **数据治理**:训练数据来源合规、患者隐私保护
- **算法治理**:模型注册、版本管理、性能监控
- **应用治理**:分级分类管理(辅助决策 vs 自主决策)
- **跨境治理**:跨境 AI 医疗服务规范

### 落地实施
- 194 个成员国纳入监管体系
- 与 ISO、IEC、ITU 标准协同
- 与 FDA、EMA、NMPA 等监管机构对接
- 在低收入国家提供 AI 能力建设

### 关键挑战
高收入与低收入国家 AI 医疗鸿沟、商业利益与公共健康平衡、患者数据跨境流动合规、AI 医疗事故责任归属。

中国国家卫健委 AI 医疗应用管理办法对接 WHO 框架,中国 AI 医疗器械审批参考 WHO 透明度原则。`,
      category: '医疗健康',
      author: '世界卫生组织',
      cover: AI_LOGO_COVER,
      sort: 41,
      isPinned: false,
    },

    // ============ 5. 机器人产业 (sort 40-31) ============
    {
      title: 'Boston Dynamics Atlas 2024 电动版:全电动人形机器人新里程碑',
      summary:
        'Boston Dynamics 2024 年 4 月发布全电动 Atlas,放弃液压驱动,运动灵活性大幅提升,与现代汽车合作落地。',
      content: `## Atlas 2024 电动版

Boston Dynamics 于 2024 年 4 月 17 日发布全新 **全电动 Atlas** 人形机器人,告别使用 11 年的液压驱动,标志着人形机器人进入电动时代。

### 设计亮点
- 全电动执行器,功率密度提升 5 倍
- 关节活动范围超越人类(如头部可 180 度旋转)
- 重量约 89 公斤,较液压版减轻 30%
- 高度约 1.5 米,可自主站立与跌倒恢复
- 运动噪声显著降低

### 运动能力
- 起立动作:从平躺状态自主起立
- 360 度关节旋转,突破生物关节限制
- 步行速度较液压版提升 30%
- 跌倒自动恢复
- 双手精细操作能力(抓取、转动、放置)

### 商业化战略
- 2024 年与现代汽车(Hyundai Motor Group)合作落地工厂场景
- 首批部署现代汽车美国工厂
- 试点任务:零件搬运、装配辅助、仓库物流

Atlas 电动版树立全电动人形机器人新标杆,推动 Tesla Optimus、Figure 01、Unitree H1 等竞品加速迭代。`,
      category: '机器人产业',
      author: 'Boston Dynamics',
      cover: ATLAS_COVER,
      sort: 40,
      isPinned: true,
    },
    {
      title: 'Tesla Optimus Gen 2 发布:马斯克 2025 年量产计划',
      summary:
        'Tesla 2024 年 10 月发布 Optimus Gen 2,重量减轻 10kg,步行速度提升 30%,2025 年内部量产计划。',
      content: `## Tesla Optimus Gen 2

Tesla 在 2024 年 10 月"We, Robot"发布会上展示 **Optimus Gen 2** 人形机器人,马斯克宣布 2025 年开始内部量产,2026 年对外销售。

### Gen 2 关键改进
- 重量:从 73kg 减至 63kg(减轻 10kg)
- 步行速度:提升 30%(目标 5 mph / 8 km/h)
- 平衡性:脚部力反馈与脚趾铰链设计
- 手部:11 自由度,精确抓握鸡蛋与缝纫
- 视觉:与 FSD 共用神经网络

### 硬件规格
- 高度:1.73 米
- 重量:63 公斤
- 续航:电池 2.3 kWh,可工作 8 小时
- 承载:单臂 11kg,硬拉 25kg
- 关节:28 个执行器 + 12 个传感器

### AI 训练
- 视觉感知基于 Tesla FSD Hardware 4
- 模仿学习:基于人类远程操作数据
- 端到端神经网络:从视觉到动作
- 与 FSD 共享算力与基础设施

### 商业计划
- 2025 年:内部工厂部署数千台
- 2026 年:对外销售,目标价格 2 万美元
- 2030 年:产能 1 亿台(马斯克愿景)`,
      category: '机器人产业',
      author: 'Tesla 官方',
      cover: ATLAS_COVER,
      sort: 39,
      isPinned: false,
    },
    {
      title: 'Figure 01 + OpenAI 合作:人形机器人搭载多模态大模型',
      summary:
        'Figure AI 2024 年与 OpenAI 合作,Figure 01 机器人搭载 GPT-4V 视觉语言模型,可对话推理与执行任务。',
      content: `## Figure 01 + OpenAI 合作

Figure AI 在 2024 年 2 月宣布与 OpenAI 合作,为 **Figure 01** 人形机器人搭载多模态大模型,实现视觉感知 + 语言理解 + 动作执行一体化。

### 合作内容
- OpenAI 投资 Figure AI 6.75 亿美元(B 轮)
- OpenAI 提供多模态大模型(GPT-4V)
- Figure AI 训练机器人专用神经网络
- 模型与机器人硬件深度集成

### Figure 01 能力
- **视觉理解**:识别桌面物体(苹果、碗、垃圾)
- **语言对话**:与人类自然对话,理解指令
- **推理执行:**"给我吃的" → 推理 → 拿苹果 → 递给人
- **错误纠正**:动作失败后可重新规划
- **双手操作**:13 自由度灵巧手,精细抓取

### 硬件规格
- 高度:1.70 米
- 重量:60 公斤
- 续航:5 小时
- 承载:20 公斤
- 关节:深度学习驱动的全身协调

### 商业化
- 2024 年与 BMW 制造合作
- BMW Spartanburg 工厂试点装配任务
- 2025 年计划扩展至更多汽车工厂
- 客户包括 Amazon 仓库试点

### 投资方
OpenAI、Microsoft、NVIDIA、Bezos Expeditions,估值 26 亿美元(2024 年 2 月 B 轮)。`,
      category: '机器人产业',
      author: 'Figure AI',
      cover: ATLAS_COVER,
      sort: 38,
      isPinned: false,
    },
    {
      title: 'Unitree H1 / G1 人形机器人:中国开源平价人形机器人崛起',
      summary:
        '宇树科技 Unitree 2024 年发布 H1 人形机器人与 G1 平价版,G1 售价 9.9 万元,引爆市场关注。',
      content: `## Unitree H1 / G1 国产人形机器人

宇树科技(Unitree Robotics)在 2024 年发布 **H1** 人形机器人与 **G1** 平价版,以超低价格与开源策略引爆全球人形机器人市场关注。

### H1 规格(2024)
- 高度:1.80 米
- 重量:47 公斤
- 行走速度:3.3 m/s(业界最快)
- 关节扭矩:360 Nm
- 续航:2 小时
- 售价:9 万美元

### G1 平价版(2024 年中)
- 高度:1.32 米
- 重量:35 公斤
- 行走速度:2 m/s
- 续航:2 小时
- 承载:3 公斤
- **售价:9.9 万元人民币(1.6 万美元)**
- 开源:ROS2 + Unitree SDK

### 关键技术
- 高扭矩关节电机(自研)
- 强化学习运动控制
- 模仿学习双手操作
- 摔倒自动恢复
- 抗冲击能力(被踢可恢复)

### 商业表现
- 2024 年 H1 销量 500+ 台,主要销往科研机构
- G1 预售 1 万台,交付排期至 2025 年 Q2
- 出口至美国、欧洲、日本、新加坡

Unitree G1 价格较 Tesla Optimus(2 万美元)再低 20%,推动人形机器人进入"万元级"时代。`,
      category: '机器人产业',
      author: '宇树科技',
      cover: ATLAS_COVER,
      sort: 37,
      isPinned: false,
    },
    {
      title: 'Agility Robotics Digit 部署 Amazon:全球首款商业化人形机器人',
      summary:
        'Agility Robotics Digit 2024 年正式部署 Amazon 与 GXO Logistics 仓库,首批量产 1000 台。',
      content: `## Agility Robotics Digit 商业化

Agility Robotics 的 **Digit** 双足人形机器人在 2024 年正式商业化部署,成为全球首款大规模商业应用的人形机器人。

### Digit 规格
- 高度:1.75 米
- 重量:64 公斤
- 续航:4 小时(可换电池)
- 承载:16 公斤
- 行走速度:1.5 m/s
- 双臂 + 反向"鸟腿"设计,平衡性优秀

### 商业部署
- **Amazon 仓库**:2024 年 1 月起试点,搬运空周转箱
- **GXO Logistics**:Spanx 仓库试点服装分拣
- **Ford 汽车工厂**:零件配送
- **Amazon**:扩展至多个配送中心

### 任务能力
- 自主导航(基于激光雷达 + 摄像头)
- 物体识别与抓取
- 跨场景迁移(适应不同货架布局)
- 异常处理(跌倒自恢复)
- 自主充电(电量低时自动充电)

### 商业化数据
- 2024 年 Digit 量产 1000 台
- 客户付费模式:按使用时长计费(20-30 美元/小时)
- 投资回报周期:1.5-2 年(替代人工)

### 投资方
Amazon、DCM Ventures、Tiger Global、Baidu Ventures,估值 10 亿美元(独角兽)。

Digit 是首个"真商用"人形机器人,证明人形机器人商业化路径可行。`,
      category: '机器人产业',
      author: 'Agility Robotics',
      cover: ATLAS_COVER,
      sort: 36,
      isPinned: false,
    },
    {
      title: '小米 CyberOne 升级:雷军人形机器人战略再推进',
      summary:
        '小米 2024 年升级 CyberOne 人形机器人,搭载 MiMo 大模型,2025 年量产计划与小鹏、华为竞争。',
      content: `## 小米 CyberOne 进阶

小米集团 2024 年持续升级 **CyberOne** 人形机器人,搭载自研 MiMo 大模型,2025 年量产计划与小鹏 Iron、华为人形机器人项目正面竞争。

### CyberOne 规格(2024 升级版)
- 高度:1.77 米
- 重量:52 公斤
- 续航:4 小时
- 单臂承重:1.5 公斤
- 行走速度:1.2 m/s
- 关节自由度:21 个
- 视觉感知:Mi Sense 深度相机

### 技术升级
- **MiMo 大模型**:小米自研人形机器人专用大模型
- 强化学习运动控制
- 模仿学习双手操作
- 多模态感知(视觉 + 触觉 + 力觉)
- 情绪识别与表达

### 雷军战略
- "人形机器人是小米下一个十年战略级项目"
- 2025 年首款面向消费者的 CyberOne 量产
- 目标售价:30-50 万元
- 与小米汽车、手机、家居深度协同

### 商业场景
- 小米汽车工厂:零件配送
- 小米之家门店:迎宾引导
- 家庭场景:陪护老人、教育儿童
- 养老院试点

### 行业竞争
小鹏 Iron:2024 年发布,搭载 XNGP AI;华为人形机器人项目:2024 年公开,搭载盘古大模型。`,
      category: '机器人产业',
      author: '小米集团',
      cover: ATLAS_COVER,
      sort: 35,
      isPinned: false,
    },
    {
      title: '智元远征 A2 / A3 Ultra:WAIC 2026 十大镇馆之宝',
      summary:
        '智元机器人 2024-2025 年发布远征 A2 / A3 Ultra 人形机器人,A3 Ultra 入选 WAIC 2026 十大镇馆之宝。',
      content: `## 智元远征 A2 / A3 Ultra

智元机器人(Agibot)2024-2025 年发布 **远征 A2** 与 **A3 Ultra** 系列人形机器人,**A3 Ultra** 入选 WAIC 2026 十大"镇馆之宝",是唯一入选的具身智能机器人。

### 远征 A2(2024)
- 高度:1.75 米
- 重量:55 公斤
- 双臂承载:5 公斤
- 续航:4 小时
- 关节自由度:40+
- 自研柔性关节电机
- 售价:约 50 万元

### 远征 A3 Ultra(2025)
- 高度:1.85 米
- 重量:65 公斤
- 双臂承载:10 公斤(单臂)
- 全身自由度:60+
- 双足 + 双轮可切换模式
- 内置灵犀 X2 具身智能大模型
- 多模态感知:视觉 + 触觉 + 力觉 + 听觉

### 技术亮点
- **灵犀 X2 大模型**:智元自研具身智能大模型
- VLA(Vision-Language-Action)架构
- 长程任务规划(> 30 分钟任务)
- 自主充电、跨场景迁移
- 人机协作安全

### 商业化
- 2024 年与多家车企合作(比亚迪、宁德时代)
- 部署工厂:零件搬运、装配辅助
- 2025 年扩展至物流、零售场景
- 出口日本、新加坡

创始人彭志辉(稚晖君),原华为天才少年,2024 年估值 100 亿元。`,
      category: '机器人产业',
      author: '智元机器人',
      cover: ATLAS_COVER,
      sort: 34,
      isPinned: false,
    },
    {
      title: '优必选 Walker S 进入比亚迪工厂:中国人形机器人量产落地',
      summary: '优必选 Walker S 2024 年进入比亚迪汽车工厂,完成装配与搬运任务,首批量产 200 台。',
      content: `## 优必选 Walker S 工厂落地

优必选科技(UBTECH)的 **Walker S** 人形机器人 2024 年正式进入比亚迪汽车工厂,完成装配与搬运任务,首批量产 200 台,标志中国人形机器人量产落地。

### Walker S 规格
- 高度:1.72 米
- 重量:76 公斤
- 双臂承载:3 公斤(单臂)
- 步行速度:1.5 m/s
- 续航:2 小时
- 全身自由度:41 个
- 灵巧手:6 自由度

### 工厂任务
- **比亚迪汽车工厂**:挡风玻璃装配辅助、车门装配辅助、车间物料搬运、质量检测
- **蔚来汽车工厂**:电池模组搬运
- **吉利汽车工厂**:焊接后零件检查
- **奥迪一汽工厂**:合作试点

### 技术能力
- 视觉识别 + 力觉反馈
- 柔性装配(不损伤零件)
- 人机协作安全(ISO 10218 合规)
- 自主导航与避障

### 商业数据
- 2024 年 Walker S 量产 200 台
- 售价:约 80 万元
- 单台替代 2-3 个工人
- 投资回报周期 3-5 年

优必选创始人周剑,2012 年成立,2023 年港股上市(9880.HK),中国首家上市人形机器人公司。

Walker S 是中国首批大规模进入工厂的人形机器人,标志量产化进入实质阶段。`,
      category: '机器人产业',
      author: '优必选科技',
      cover: ATLAS_COVER,
      sort: 33,
      isPinned: false,
    },
    {
      title: 'Sanctuary AI Phoenix:认知人形机器人挑战智能边界',
      summary:
        'Sanctuary AI 2024 年发布 Phoenix 第八代人形机器人,搭载 Carbon AI 系统,聚焦认知任务。',
      content: `## Sanctuary AI Phoenix 认知路线

加拿大 Sanctuary AI 在 2024 年发布 **Phoenix 第八代**人形机器人,搭载 **Carbon AI** 认知系统,聚焦认知任务与人机协作,与 Tesla、Figure 走差异化路线。

### Phoenix Gen 8 规格
- 高度:1.70 米
- 重量:70 公斤
- 行走速度:3 m/s(目标 5 m/s)
- 双手:20 自由度仿生手,触觉反馈
- 续航:4 小时
- 上肢力量:25 公斤

### Carbon AI 系统
- **认知架构**:基于符号主义 + 连接主义混合
- **任务理解**:自然语言指令解析
- **常识推理**:基于知识图谱
- **经验学习**:从演示中学习新技能
- **元学习**:跨任务迁移能力

### 商业策略
- 与 Microsoft Azure 合作部署
- Magna 汽车代工
- 客户试点:零售、物流、医疗

### 与 Tesla / Figure 差异
- **Sanctuary**:认知优先,强调"AI 智能"
- **Tesla**:运动优先,强调"运动与硬件"
- **Figure**:多模态 LLM 优先,强调"对话交互"

### 行业合作
Microsoft Azure:云端训练与部署;Magna International:量产代工;Bell Canada:通信网络支持。

### 落地场景
加拿大零售试点:店面货物整理;加拿大养老院:老人陪护;2024 年部署 50 台。`,
      category: '机器人产业',
      author: 'Sanctuary AI',
      cover: ATLAS_COVER,
      sort: 32,
      isPinned: false,
    },
    {
      title: 'Apptronik Apollo 发布:NASA 背书的人形机器人量产',
      summary:
        'Apptronik 2024 年发布 Apollo 人形机器人,与 NASA、Mercedes-Benz 合作,2025 年量产 100 台。',
      content: `## Apptronik Apollo 量产

德州公司 Apptronik 在 2024 年 12 月发布 **Apollo** 人形机器人,获 NASA 与 Mercedes-Benz 双重背书,2025 年量产 100 台。

### Apollo 规格
- 高度:1.73 米
- 重量:72.5 公斤
- 续航:4 小时(可换电池,8 小时连续工作)
- 承载:25 公斤
- 行走速度:1.7 m/s
- 关节自由度:28 个

### 设计亮点
- 模块化关节(可现场更换)
- 仿生肌腱驱动(更接近人类肌肉)
- 360 度视觉感知
- IP54 防护等级(可在户外使用)
- 可负重连续工作 22 小时(换电池)

### 商业部署
- **Mercedes-Benz**:2024 年 12 月宣布合作,汽车装配线零件配送、检查员辅助、首批部署 30 台
- **GTX Logistics**:仓库分拣
- **NASA**:太空应用预研(月球基地)

### NASA 合作
- 基于 NASA Johnson Valkyrie 机器人技术
- 长期目标:月球基地、火星基地建设
- 模拟环境测试:南极、沙漠

### 投资与估值
2024 年 B 轮融资 3.5 亿美元,投资方:Mercedes-Benz、B Capital、Capital Factory,估值 15 亿美元。

Apollo 是 NASA 背书的人形机器人,推动工业级可靠性标准建立。`,
      category: '机器人产业',
      author: 'Apptronik',
      cover: ATLAS_COVER,
      sort: 31,
      isPinned: false,
    },

    // ============ 6. AI 艺术 (sort 30-21) ============
    {
      title: 'OpenAI Sora 视频生成模型发布:60 秒电影级 AI 视频成真',
      summary:
        'OpenAI 2024 年 2 月发布 Sora 文生视频模型,可生成 60 秒高清视频,2024 年 12 月向 Plus 用户开放。',
      content: `## Sora 文生视频革命

OpenAI 于 2024 年 2 月 15 日发布 **Sora** 文本生成视频模型,可生成长达 60 秒的 1080p 高清视频,开创 AI 视频生成新纪元。

### 模型能力
- 视频长度:最长 60 秒
- 分辨率:1080p / 4K
- 视频比例:支持 16:9、9:16、1:1
- 多镜头:单视频内多镜头切换
- 物理一致性:物体持续存在,相机运动合理
- 文本渲染:视频中文字保持一致

### 技术架构
- DiT(Diffusion Transformer)架构
- 时空 patches 表示
- 大规模视频-文本对训练
- 基于 DALL-E 3 的重写技术(prompt 增强)

### 开放策略
- 2024 年 2 月:技术演示,仅限研究人员
- 2024 年 12 月:向 ChatGPT Plus / Pro / Team 用户开放
- 2025 年:Sora 2 发布,4K 60fps,可生成 90 秒视频

### 应用场景
- 短视频创作(TikTok、YouTube Shorts)
- 广告制作(成本降低 90%)
- 电影预可视化
- 教育视频自动生成
- 游戏过场动画

### 行业冲击
Hollywood 编剧与特效师抗议,Adobe 推出 Firefly Video 竞品,Runway Gen-3、Pika 1.5 等竞品加速迭代,中国快手可灵、字节即梦追赶。`,
      category: 'AI 艺术',
      author: 'OpenAI 官方',
      cover: CHATGPT_COVER,
      sort: 30,
      isPinned: true,
    },
    {
      title: 'Midjourney v6 发布:照片级真实感图像生成新高度',
      summary:
        'Midjourney 2024 年发布 v6 与 v6.1,写实度大幅提升,支持长文本渲染,Alpha 模型引入角色一致性。',
      content: `## Midjourney v6 写实革命

Midjourney 在 2024 年发布 **v6**、**v6.1** 与 **v6 Alpha** 多个版本,在写实度、文本渲染、角色一致性方面取得突破,继续领跑 AI 图像生成领域。

### v6 关键改进
- **写实度**:接近真实照片,细节毛孔级
- **文本渲染**:可在图像中渲染英文文本(此前不可能)
- **提示理解**:支持更长 prompt(350+ token)
- **细节处理**:手指、眼睛、纹理大幅改进

### v6.1 改进(2024 年 7 月)
- 图像质量整体提升
- 皮肤纹理、毛发更精细
- 8K 升级模式
- 个性化模型提升

### v6 Alpha(2024 年 12 月)
- **角色一致性 (--cref)**:同一角色多场景保持一致
- **风格一致性 (--sref)**:同一风格多图保持一致
- **个性化 (--p)**:用户自定义美学倾向

### 应用场景
概念艺术(电影、游戏)、广告创意、产品设计、时尚设计、建筑可视化、自媒体配图。

### 商业表现
- 2024 年用户数突破 2000 万
- 订阅价格:10-120 美元/月
- 年收入超 5 亿美元(50 人团队)

Midjourney 引领"写实主义"图像生成风潮,推动摄影、插画、设计行业变革。`,
      category: 'AI 艺术',
      author: 'Midjourney 官方',
      cover: AI_LOGO_COVER,
      sort: 29,
      isPinned: false,
    },
    {
      title: 'DALL-E 3 集成 ChatGPT:OpenAI 图像生成大众化',
      summary:
        'DALL-E 3 2024 年集成至 ChatGPT Plus / Enterprise,GPT-4 自动改写 prompt,无需复杂描述即可生成图像。',
      content: `## DALL-E 3 + ChatGPT 集成

OpenAI 的 **DALL-E 3** 在 2024 年深度集成至 ChatGPT Plus / Enterprise,GPT-4 自动改写用户 prompt,降低 AI 图像生成门槛,推动大众化应用。

### 核心集成
- ChatGPT Plus / Enterprise / Team 用户直接对话生成图像
- GPT-4 自动扩展 prompt(用户说"画只猫" → GPT-4 生成详细描述)
- 多轮对话修改图像("让猫变黑白色")
- 风格预设(写实、动漫、油画、3D 等)

### 模型能力
- 图像分辨率:1024 × 1024 / 1792 × 1024 / 1024 × 1792
- 文本渲染:可在图像中渲染英文文字(较 v2 大幅提升)
- 复杂场景:多物体、复杂构图理解
- 安全过滤:暴力、色情、名人肖像限制

### 商业模式
- ChatGPT Plus 用户每月限免 50 张
- API 按张计费(标准 0.040 美元/张,HD 0.080 美元/张)
- 2024 年生成图像 10 亿张

### 与 Midjourney 对比
- DALL-E 3:对话式,易用,提示理解强
- Midjourney:命令式,写实度高,艺术性强
- 各有受众

ChatGPT 集成使 AI 图像生成用户数从百万级跃升至亿级,自媒体配图、教育插图、电商主图、社交分享全面 AI 化。

2024 年 9 月 OpenAI 公布 DALL-E 3 日生成量峰值 200 万张,推动图像生成进入"日用品"时代。`,
      category: 'AI 艺术',
      author: 'OpenAI 官方',
      cover: CHATGPT_COVER,
      sort: 28,
      isPinned: false,
    },
    {
      title: 'Suno AI 音乐生成 v4:人人都是音乐人',
      summary: 'Suno AI 2024 年发布 v3 / v4,可生成 4 分钟带人声完整歌曲,2024 年用户突破 1200 万。',
      content: `## Suno AI 音乐生成革命

Suno AI 在 2024 年发布 **v3**、**v3.5**、**v4** 多个版本,可生成 4 分钟带人声的完整歌曲,标志 AI 音乐生成进入大众化阶段。

### v4 关键能力
- 歌曲长度:最长 4 分钟
- 人声质量:接近真人,情感表达丰富
- 流派覆盖:流行、摇滚、古典、爵士、电子、说唱等 50+ 风格
- 多语言:英语、中文、日语、韩语、西班牙语等 20+
- 歌词生成:用户输入主题自动生成歌词
- 人设一致:同一"虚拟歌手"多首歌曲音色一致

### 使用流程
1. 用户输入主题或歌词
2. 选择风格(可选)
3. Suno 生成 2 个候选歌曲
4. 用户可扩展或重新生成

### 商业表现
- 2024 年用户数突破 1200 万
- 月活用户 500 万
- 订阅价格:8-24 美元/月
- 2024 年生成歌曲 10 亿首

### 版权争议
- 2024 年 6 月:RIAA 起诉 Suno 与 Udio 侵权
- 训练数据使用商业音乐未授权
- 2025 年和解:赔偿 + 商业授权模式

### 行业冲击
- 流行音乐制作成本降低 90%
- 短视频 BGM、广告配乐、游戏音乐 AI 生成
- 网易天音、腾讯 AI Lyra、字节 Mubert 等中国竞品追赶
- "AI 音乐人"成为新职业

Spotify 单日上传歌曲突破 10 万首,30% 为 AI 生成,引发"何为创作"哲学讨论。`,
      category: 'AI 艺术',
      author: 'Suno AI',
      cover: AI_LOGO_COVER,
      sort: 27,
      isPinned: false,
    },
    {
      title: 'Anthropic Claude 写作能力:AI 长文创作进入实用阶段',
      summary:
        'Anthropic Claude 3.5 / 3.7 / 4 / 4.5 / 5 系列 2024-2025 年发布,200K 上下文 + 文学风格,成作家助手首选。',
      content: `## Claude AI 写作能力进阶

Anthropic 的 **Claude** 系列模型在 2024-2025 年持续迭代(3.5 → 3.7 → 4 → 4.5 → 5),凭借 200K 上下文窗口、细腻的文学风格与高度可控的语气,成为专业作家、记者、编剧的 AI 写作助手首选。

### 关键能力
- **长上下文**:200K tokens,可处理 15 万字长文
- **文学风格**:细腻、富有同理心,避免"AI 腔"
- **角色一致**:长篇故事角色保持一致
- **风格迁移**:模仿特定作家风格(海明威、村上春树等)
- **多语言**:中英日法德等 95 种语言

### 应用场景
- **小说创作**:辅助世界构建、角色设定、情节推进
- **剧本写作**:电影、电视剧、网剧剧本
- **新闻报道**:深度长文与调查报道
- **学术写作**:论文起草、文献综述
- **商业写作**:白皮书、行业报告
- **诗歌与散文**:文学创作

### Claude 5 Sonnet(2025)
- 上下文扩展至 1M tokens
- 推理能力提升 30%
- 智能体能力(可调用浏览器、终端)
- 写作风格更接近人类

### 商业表现
- 2024 年 Anthropic 收入 10 亿美元
- Claude 用户数 5000 万
- Pro 订阅 20 美元/月
- API 价格:$3/$15 per M tokens

Claude 与 ChatGPT、Gemini 形成"写作助手三足鼎立",推动编剧工会、作家协会等行业变革。`,
      category: 'AI 艺术',
      author: 'Anthropic 官方',
      cover: AI_LOGO_COVER,
      sort: 26,
      isPinned: false,
    },
    {
      title: 'Runway Gen-3 Alpha 发布:AI 视频生成工业级工具',
      summary:
        'Runway 2024 年发布 Gen-3 Alpha,支持 10 秒 4K 视频生成,与 Lionsgate、Paramount 影视合作。',
      content: `## Runway Gen-3 Alpha 影视级 AI

Runway 在 2024 年 6 月发布 **Gen-3 Alpha** 视频生成模型,支持 10 秒 4K 视频生成,与 Lionsgate、Paramount 等好莱坞片厂深度合作,推动 AI 视频进入工业级生产。

### Gen-3 Alpha 关键能力
- 视频长度:最长 10 秒(可串联)
- 分辨率:4K(3840 × 2160)
- 帧率:24 / 30 / 60 fps
- 视频比例:任意比例
- 运镜控制:推、拉、摇、移、跟
- 角色一致性:多场景角色保持一致

### 工作流工具
- **Motion Brush**:指定区域添加运动
- **Camera Control**:精确控制虚拟摄像机
- **Director Mode**:多镜头编排
- **Style Transfer**:视频风格迁移
- **Inpainting**:视频局部修改

### 商业合作
- **Lionsgate**:2024 年 9 月合作,AI 辅助前制与特效
- **Paramount Pictures**:预告片制作试点
- **Madonna Celebration Tour**:巡回演唱会视觉
- **New Balance**:广告制作

### 商业模式
- Standard:15 美元/月,625 个 credits
- Pro:35 美元/月,2250 credits
- Enterprise:定制
- API:按秒计费

### 与 Sora 对比
- Sora:60 秒长视频,但未开放
- Runway:10 秒短视频,但已商用
- 各有市场

2025 年规划:Gen-4 30 秒 4K 视频,实时生成(直播应用),全片 AI 制作试点。`,
      category: 'AI 艺术',
      author: 'Runway 官方',
      cover: AI_LOGO_COVER,
      sort: 25,
      isPinned: false,
    },
    {
      title: 'Stable Diffusion 3 开源:Stability AI 多模态架构新突破',
      summary:
        'Stability AI 2024 年发布 Stable Diffusion 3 与 3.5 系列,采用 MMDiT 架构,开源推动生态爆发。',
      content: `## Stable Diffusion 3 开源生态

Stability AI 在 2024 年发布 **Stable Diffusion 3** 与 **3.5 系列**,采用全新 MMDiT(Multimodal Diffusion Transformer)架构,以开源策略推动 AI 图像生成生态爆发。

### SD3 关键创新
- **MMDiT 架构**:多模态 Transformer + Diffusion
- **改进文本理解**:支持复杂 prompt
- **文字渲染**:可在图像中渲染文字
- **多分辨率**:支持 1MP 高分辨率

### SD3.5 系列(2024 年 10 月)
- **SD3.5 Large**:8B 参数,顶级质量
- **SD3.5 Large Turbo**:8B 蒸馏版,4 步生成
- **SD3.5 Medium**:2.5B 参数,平衡质量与速度

### 开源策略
- 模型权重免费下载(Hugging Face)
- 非商业免费,商用需订阅
- Stability AI Membership:20-100 美元/月
- 推动下游生态繁荣

### 生态应用
- **ComfyUI**:节点式图像工作流
- **Automatic1111**:WebUI 图像生成
- **Civitai**:模型社区,LoRA / Embedding 共享
- **Fooocus**:Simplified UI

### 行业影响
- 推动中国国产模型追赶(快手可灵、智谱 CogVideoX)
- 与 DALL-E 3、Midjourney v6 形成开源 vs 闭源竞争
- 模型微调市场(LoRA)年规模 5 亿美元

### Stability AI 困境
- 2024 年 CEO Emad Mostaque 辞职
- 财务困难,寻求出售
- 2025 年 Prem Akkaraju 接任 CEO,转向可持续商业化`,
      category: 'AI 艺术',
      author: 'Stability AI',
      cover: AI_LOGO_COVER,
      sort: 24,
      isPinned: false,
    },
    {
      title: 'Google Veo 视频 AI:DeepMind 挑战 OpenAI Sora',
      summary:
        'Google DeepMind 2024 年 5 月发布 Veo 视频 AI,可生成 1080p 60 秒视频,集成 Gemini 与 YouTube Shorts。',
      content: `## Google Veo 视频生成

Google DeepMind 于 2024 年 5 月 14 日 Google I/O 大会发布 **Veo** 视频 AI 模型,可生成 1080p 高清、60 秒长视频,直接挑战 OpenAI Sora。

### Veo 关键能力
- 视频长度:最长 60 秒
- 分辨率:1080p
- 视频比例:任意(横屏、竖屏、方形)
- 风格:电影级、纪录片、动画等
- 物理:基本物理一致性
- 文本渲染:支持视频中文字
- 提示理解:复杂 prompt(550+ 词)

### 技术架构
- 基于 Latent Diffusion
- 与 Gemini 多模态模型协同
- 训练数据:YouTube 视频与文本

### 集成产品
- **YouTube Shorts**:创作者直接生成短视频
- **Gemini Advanced**:高级订阅用户使用
- **VideoPoet**:多模态创作工作流

### 与 Sora 对比
- Veo:60 秒长视频,1080p,部分开放(Shorts)
- Sora:60 秒长视频,1080p / 4K,ChatGPT Plus 用户

### Veo 2(2024 年 12 月)
- 4K 60fps
- 视频长度扩展至 2 分钟
- 多镜头自动编排
- 音频生成同步

### 商业应用
YouTube Shorts 创作者免费使用,广告主 Google Ads 集成,电影预可视化与 Disney 合作试点。`,
      category: 'AI 艺术',
      author: 'Google DeepMind',
      cover: AI_LOGO_COVER,
      sort: 23,
      isPinned: false,
    },
    {
      title: 'Udio AI 音乐生成 v1.5:与 Suno 双雄并立',
      summary:
        'Udio AI 2024 年发布 v1.5,支持 15 分钟长音乐作品,与 Suno 形成双雄格局,RIAA 起诉后转向授权模式。',
      content: `## Udio AI 音乐生成进阶

Udio AI(由前 Google DeepMind 团队创立)在 2024 年发布 **v1 / v1.5** 多个版本,支持最长 15 分钟长音乐作品,与 Suno 形成 AI 音乐生成双雄格局。

### v1.5 关键能力
- 音乐长度:最长 15 分钟(交响乐级)
- 多乐章:支持多乐章结构(如交响曲)
- 人声:接近真人,情感丰富
- 流派:古典、爵士、流行、电子、世界音乐 30+
- 多语言:支持 20+ 语种歌词

### 与 Suno 对比
- Suno:4 分钟长度,流行/电子为主
- Udio:15 分钟长度,全风格(古典强)

### 商业表现
- 2024 年用户数 700 万
- 月活 200 万
- 创作歌曲 3 亿首
- 2024 年 4 月 A 轮融资 1000 万美元(a16z 领投)

### 版权诉讼
- 2024 年 6 月:RIAA 起诉 Udio 与 Suno
- 指控使用商业音乐未授权
- 2025 年和解:授权模式 + 赔偿
- 推动行业建立授权框架

### 应用场景
古典音乐创作、电影配乐、短视频 BGM、游戏音乐、个人音乐创作。

Grammy 设立 AI 音乐奖项规则,引发"AI 是否能创作真正的艺术"讨论。`,
      category: 'AI 艺术',
      author: 'Udio AI',
      cover: AI_LOGO_COVER,
      sort: 22,
      isPinned: false,
    },
    {
      title: 'Adobe Firefly 3 + Video:商用安全 AI 创作工作流',
      summary:
        'Adobe 2024 年发布 Firefly 3 与 Firefly Video,训练数据完全授权,Photoshop / Premiere 全面集成。',
      content: `## Adobe Firefly 商用安全策略

Adobe 在 2024 年发布 **Firefly 3** 与 **Firefly Video**,以训练数据完全授权的"商用安全"策略,与 Photoshop、Premiere、Illustrator 深度集成,巩固创意软件领导地位。

### Firefly 3 关键能力
- 图像分辨率:8K(8192 × 8192)
- 风格:照片级写实、插画、3D、矢量等
- 文本渲染:支持英文文字
- 风格参考:用户上传参考图保持风格
- 结构参考:保持构图

### Firefly Video(2024)
- 视频长度:5 秒(可串联)
- 分辨率:1080p
- 图生视频:从静态图像生成动态视频
- 文生视频
- 风格预设

### 商用安全策略
- 训练数据:Adobe Stock、公开域、自有权数据
- 不使用受版权保护作品
- 提供版权赔付(用户被诉 Adobe 赔付)

### Adobe Creative Cloud 集成
- **Photoshop**:Generative Fill(生成式填充)、Generative Expand
- **Illustrator**:生成矢量图
- **Premiere Pro**:Generative Extend(视频扩展)
- **After Effects**:AI 视觉特效
- **Lightroom**:AI 修图

### 商业模式
- Creative Cloud 订阅用户:免费 generative credits
- 单独 Firefly 订阅:5-30 美元/月
- API:按生成次数计费
- 2024 年生成图像 130 亿次

Firefly 是"商用安全"标杆,推动企业级 AI 创作工具普及,Adobe 2024 年 AI 推动订阅收入增长 15%。`,
      category: 'AI 艺术',
      author: 'Adobe 官方',
      cover: AI_LOGO_COVER,
      sort: 21,
      isPinned: false,
    },

    // ============ 7. 创业投资 (sort 20-11) ============
    {
      title: 'OpenAI 估值 1570 亿美元:Thrive Capital 领投 66 亿美元',
      summary: 'OpenAI 2024 年 10 月完成 66 亿美元融资,估值 1570 亿美元,成全球估值最高未上市公司。',
      content: `## OpenAI 估值突破 1570 亿美元

OpenAI 在 2024 年 10 月 2 日完成 **66 亿美元**融资,估值达到 **1570 亿美元**,成为全球估值最高的未上市科技公司。

### 融资详情
- 融资金额:66 亿美元
- 估值:1570 亿美元(post-money)
- 领投方:Thrive Capital
- 参投方:Microsoft、NVIDIA、SoftBank、MGX(UAE)、Tiger Global
- 投资者权利:Thrive Capital 获得"若 OpenAI 重组为营利公司可撤资"特殊条款

### 资金用途
- 算力基础设施(占 70%)
- 模型研发(GPT-5、Sora、AGI 研究)
- 全球扩张
- 安全研究
- 战略投资与并购

### 估值演进
- 2023 年初:290 亿美元
- 2024 年初:860 亿美元
- 2024 年 10 月:1570 亿美元

### 商业表现
- 2024 年 ARR:65 亿美元(8 月)
- 2025 年 ARR 预期:100-120 亿美元
- 主要收入:ChatGPT Plus、Enterprise、API
- 客户:92% 的世界 500 强企业

### 治理结构争议
- 2024 年 8 月:多位高管离职(联合创始人 Greg Brockman 休假)
- 2025 年计划重组为 PBC(公益公司)
- Sam Altman 首次获得股权(此前为 0 美元)

OpenAI 估值标志 AI 时代"超级独角兽"诞生,推动全球 AI 创投进入新阶段。`,
      category: '创业投资',
      author: 'Thrive Capital',
      cover: CHATGPT_COVER,
      sort: 20,
      isPinned: true,
    },
    {
      title: 'xAI 估值 500 亿美元:马斯克 AI 公司 C 轮融资 60 亿美元',
      summary:
        'xAI 2024 年 5 月完成 C 轮 60 亿美元融资,估值 500 亿美元,投资人包括红杉、a16z、Saudi Prince。',
      content: `## xAI 估值达 500 亿美元

马斯克创办的 **xAI** 在 2024 年 5 月完成 **60 亿美元 C 轮融资**,估值达 **500 亿美元**,成为 AI 领域第二大独角兽(仅次于 OpenAI)。

### 融资详情
- 融资金额:60 亿美元
- 估值:240 亿美元(pre-money),500 亿美元(post-money)
- 领投方:红杉资本、Valor Equity Partners
- 参投方:a16z、Andreessen Horowitz、Saudi Prince Alwaleed bin Talal、Kingdom Holding、Bond、Vy Capital
- 使用目的:Grok 模型研发、xAI 超级计算机建设

### 战略资源
- **NVIDIA GPU 优先供应**:马斯克与黄仁勋关系
- **X 平台数据**:训练数据独家
- **Tesla Optimus AI 协同**
- **SpaceX 算力调度**

### Memphis 超算
- 2024 年 7 月:孟菲斯 Colossus 超算上线
- 初期 10 万颗 H100 GPU
- 2025 年扩至 30 万颗(H100 + B200)
- 全球最大私人 AI 训练集群

### Grok 模型演进
- Grok 1.5(2024 年 3 月)
- Grok 1.5V(2024 年 4 月,视觉版)
- Grok 2(2024 年 8 月)
- Grok 3(2025 年 2 月)
- Grok 4.5(2026 年 7 月)

### 商业模式
X Premium+ 订阅(16 美元/月)、xAI API、企业版 Grok。

2025 年 2 月 D 轮 100 亿美元融资,估值升至 750 亿美元。`,
      category: '创业投资',
      author: '红杉资本',
      cover: AI_LOGO_COVER,
      sort: 19,
      isPinned: false,
    },
    {
      title: 'Anthropic 估值 600 亿美元:亚马逊 Google 加码投资',
      summary: 'Anthropic 2025 年初完成 40 亿美元融资,估值 600 亿美元,亚马逊追加 40 亿美元投资。',
      content: `## Anthropic 估值突破 600 亿美元

Anthropic 在 2025 年初完成新一轮融资,估值突破 **600 亿美元**,成为 AI 领域第三大独角兽(仅次于 OpenAI、xAI),主要投资者亚马逊、Google 持续加码。

### 融资历程
- 2023 年 9 月:亚马逊 40 亿美元投资
- 2023 年 10 月:Google 20 亿美元投资
- 2024 年 1 月:Menlo Ventures 7.5 亿美元领投
- 2024 年 11 月:估值 400 亿美元
- 2025 年 Q1:新一轮融资,估值 600 亿美元

### 战略投资者
- **亚马逊**:累计投资 80 亿美元,AWS Trainium2 长期合作
- **Google**:累计投资 25 亿美元,Google Cloud TPU 合作
- **Salesforce Ventures**:5 亿美元
- **Menlo Ventures**:7.5 亿美元

### 商业表现
- 2024 年 ARR:10 亿美元
- 2025 年 ARR 预期:30-40 亿美元
- 主要收入:Claude API、Claude Pro 订阅、Claude Enterprise
- 客户:Notion、Quora、DuckDuckGo 等

### 模型演进
- Claude 3.5 Sonnet(2024 年 6 月)
- Claude 3.5 Haiku(2024 年 11 月)
- Claude 3.7 Sonnet(2025 年 2 月)
- Claude 4 Opus(2025 年 5 月)
- Claude 4.5 Sonnet(2025 年 7 月)

### Constitutional AI 路线
Anthropic 坚持"宪法 AI"安全路线,与 OpenAI 路线形成差异,2024 年与美国 AI 安全研究所签署备忘录。

Anthropic 成 OpenAI 主要竞争对手,在写作、编程、长上下文领域优势明显。`,
      category: '创业投资',
      author: '亚马逊',
      cover: AI_LOGO_COVER,
      sort: 18,
      isPinned: false,
    },
    {
      title: 'SpaceX 估值 3500 亿美元:全球最大独角兽,Starlink 推动估值跃升',
      summary: 'SpaceX 2024 年 12 月估值达 3500 亿美元,超 OpenAI 与 ByteDance,成全球最大独角兽。',
      content: `## SpaceX 估值突破 3500 亿美元

埃隆·马斯克的 **SpaceX** 在 2024 年 12 月估值突破 **3500 亿美元**,超越 OpenAI(1570 亿)与 ByteDance(2200 亿),成为全球最大独角兽公司。

### 估值历程
- 2023 年 7 月:1500 亿美元
- 2024 年 6 月:2100 亿美元(2.5 亿股 1 亿美元要约收购)
- 2024 年 12 月:3500 亿美元

### 业务驱动
1. **Starlink 星链**
   - 2024 年用户突破 400 万
   - 收入 2024 年预计 66 亿美元
   - 卫星总数超 6000 颗
   - IPO 候选(2025 年下半年)

2. **Falcon 火箭**
   - 2024 年发射 134 次(占全球 50%+)
   - 商业发射市场份额 80%
   - Starshield 军方合同(2024 年 7.5 亿美元)

3. **Starship 星舰**
   - 2024 年 10 月:第 5 次试飞,首次成功用"筷子"夹回助推器
   - 2025 年第 9-12 次试飞计划
   - NASA 月球任务核心载具

4. **Crew Dragon 龙飞船**
   - 商业载人航天
   - NASA 任务 + 商业太空旅游
   - 2024 年 4 次载人飞行

### 商业表现
- 2024 年收入:约 140 亿美元
- 2025 年预期:200 亿美元
- Starlink 占收入 47%

### 估值对比(2024 年底)
SpaceX 3500 亿美元 > ByteDance 2200 亿美元 > OpenAI 1570 亿美元 > Stripe 700 亿美元。

SpaceX 证明"硬科技 + 重资本"商业模式可行,推动商业航天进入新时代。`,
      category: '创业投资',
      author: 'SpaceX 官方',
      cover: AI_LOGO_COVER,
      sort: 17,
      isPinned: false,
    },
    {
      title: 'Databricks 估值 620 亿美元:J 轮融资 100 亿美元',
      summary:
        'Databricks 2024 年 12 月完成 J 轮 100 亿美元融资,估值 620 亿美元,Thrive Capital 领投。',
      content: `## Databricks J 轮 100 亿美元融资

数据与 AI 平台 **Databricks** 在 2024 年 12 月完成 **100 亿美元 J 轮融资**,估值达到 **620 亿美元**,创下 2024 年 VC 单笔融资纪录。

### 融资详情
- 融资金额:100 亿美元(其中 50 亿美元来自投资者,50 亿美元用于员工股票回购)
- 估值:620 亿美元(post-money)
- 领投方:Thrive Capital
- 参投方:a16z、Insight Partners、Coatue、Tiger Global、T. Rowe Price、WCM Investment Management
- 使用目的:AI 产品研发、并购、人才

### 业务驱动
- **数据湖仓(Lakehouse)**:统一数据湖 + 数据仓库
- **MosaicML 收购**:2023 年 13 亿美元,生成式 AI 平台
- **DBRX 大模型**:2024 年 3 月开源,MoE 132B
- **AI Gateway**:企业级 AI 治理

### 商业表现
- 2024 财年 ARR:30 亿美元
- 2025 财年 ARR 预期:43 亿美元
- 客户:超过 1 万家企业
- 60% 的财富 500 强使用
- 增长率:60%+

### 与 Snowflake 竞争
- Databricks:数据工程 + AI 一体化
- Snowflake:数据仓库 + 数据共享
- Databricks 在 AI 浪潮中后来居上

### IPO 预期
- 2025 年上半年 IPO 计划
- 估值预期:600-800 亿美元
- 承销商:高盛、摩根士丹利

Databricks 估值标志"数据 + AI 平台"成为新基础设施,推动企业 AI 应用从"模型"走向"数据"。`,
      category: '创业投资',
      author: 'Thrive Capital',
      cover: AI_LOGO_COVER,
      sort: 16,
      isPinned: false,
    },
    {
      title: 'Perplexity AI 估值 90 亿美元:AI 搜索引擎独角兽',
      summary:
        'Perplexity AI 2024 年 12 月完成 5 亿美元融资,估值 90 亿美元,IVP 领投,挑战 Google 搜索。',
      content: `## Perplexity AI 估值 90 亿美元

AI 搜索引擎 **Perplexity AI** 在 2024 年 12 月完成 **5 亿美元 C 轮融资**,估值达 **90 亿美元**,成为挑战 Google 搜索的核心独角兽。

### 融资详情
- 融资金额:5 亿美元
- 估值:90 亿美元(post-money)
- 领投方:IVP
- 参投方:NEA、Bessemer Venture Partners、TIG Global、Y Combinator Garry Tan、Jeff Bezos(Bezos Expeditions)、NVIDIA
- 战略意义:与 NVIDIA、AWS 深度合作

### 产品定位
- AI 搜索引擎 + 答案引擎
- 直接回答问题,而非提供链接列表
- 引用来源可点击
- 多模态搜索(文本、图像)
- Pro Search:多步骤推理

### 商业表现
- 2024 年用户数:1500 万月活
- Pro 订阅:200 万付费用户
- Pro 订阅价格:20 美元/月
- 2024 年 ARR:8000 万美元
- 2025 年 ARR 预期:3 亿美元

### 模型策略
- 多模型路由:GPT-4o、Claude 3.5、Llama 3、Mistral
- 用户可选模型
- 自研小模型(Sonar R100K)
- 与 NVIDIA NIM 集成

### 商业合作
- **NVIDIA**:深度合作,NVIDIA NIM 推理基础设施
- **AWS**:Bedrock 模型选择
- **T-Mobile**:电信合作
- **Polymarket**:实时数据集成

### 挑战 Google
Google 占全球搜索 91%,Perplexity 不替代传统搜索,补充深度问答。2024 年谷歌被迫推出 AI Overviews 应对。

Perplexity 证明 AI 搜索可商业化,推动搜索市场多元化。`,
      category: '创业投资',
      author: 'IVP',
      cover: AI_LOGO_COVER,
      sort: 15,
      isPinned: false,
    },
    {
      title: 'Mistral AI 估值 60 亿美元:欧洲 AI 独角兽崛起',
      summary:
        'Mistral AI 2024 年 6 月完成 6.45 亿美元 B 轮,估值 60 亿美元,General Catalyst 领投,欧洲 AI 标杆。',
      content: `## Mistral AI 欧洲独角兽

法国 **Mistral AI** 在 2024 年 6 月完成 **6.45 亿美元 B 轮融资**,估值达到 **60 亿美元**,成为欧洲最大 AI 独角兽,代表欧洲在大模型领域的力量。

### 融资详情
- 融资金额:6.45 亿美元
- 估值:60 亿美元
- 领投方:General Catalyst
- 参投方:a16z、Lightspeed Venture Partners、Bpifrance(法国主权基金)、Nvidia、Salesforce、BNP Paribas、Allianz
- 战略意义:法国政府支持,代表欧洲 AI 主权

### 创始团队
- Arthur Mensch(CEO):前 DeepMind 研究员
- Guillaume Lample(首席科学家):前 Meta Llama 团队
- Timothée Lacroix(CTO):前 Meta Llama 团队

### 模型产品
- **Mistral 7B**(2023 年 9 月):开源小模型标杆
- **Mixtral 8x7B**(2023 年 12 月):开源 MoE 模型
- **Mistral Large**(2024 年 2 月):闭源旗舰
- **Mixtral 8x22B**(2024 年 4 月):开源大 MoE
- **Mistral Large 2**(2024 年 7 月):123B 参数,128K 上下文

### 商业模式
- 开源策略:核心模型 Apache 2.0
- 闭源旗舰:Mistral Large 通过 API 与企业许可
- Le Platforme API 服务
- Azure 集成(微软投资)

### 商业表现
- 2024 年 ARR:3000 万美元
- 客户:500+ 企业
- 主要市场:欧洲、北美

### 政策意义
法国总统马克龙亲自支持,欧盟 AI Act 例外条款(Mistral 游说成功),推动欧洲 AI 主权。

Mistral 是开源 LLM 领导者之一,与 Meta Llama 形成美欧双轨开源生态。`,
      category: '创业投资',
      author: 'General Catalyst',
      cover: AI_LOGO_COVER,
      sort: 14,
      isPinned: false,
    },
    {
      title: 'Sierra AI 估值 100 亿美元:企业对话式 AI 独角兽',
      summary:
        'Sierra AI 2024 年 10 月完成 17.5 亿美元融资,估值 100 亿美元,Greenoaks 领投,企业客服 AI 标杆。',
      content: `## Sierra AI 估值 100 亿美元

企业对话式 AI 平台 **Sierra AI** 在 2024 年 10 月完成 **17.5 亿美元融资**,估值达 **100 亿美元**,由 Greenoaks 领投,成为企业客服 AI 领域独角兽标杆。

### 融资详情
- 融资金额:17.5 亿美元
- 估值:100 亿美元
- 领投方:Greenoaks Capital
- 参投方:Sequoia、ICONIQ、Bain Capital Ventures、Fidelity
- 创始人:Bret Taylor(OpenAI 董事会主席、前 Salesforce CO-CEO)

### 产品定位
- 企业级对话式 AI 平台
- 客户服务 AI Agent
- 多模态:文字、语音、邮件
- 与 CRM、ERP、ITSM 集成
- 长程任务执行

### 客户案例
- **SiriusXM**:1.3 亿订阅用户客服 AI
- **WeightWatchers**:客户咨询与会员管理
- **Sonos**:产品支持
- **Adtalem Global Education**:学生咨询
- **Sirius XM**:订阅管理

### 商业模式
- SaaS 订阅 + 按对话量计费
- 平均合同价值:50 万美元/年
- 客户续约率:95%+

### 商业表现
- 2024 年 ARR:5000 万美元
- 2025 年 ARR 预期:1.5 亿美元
- 客户数:200+
- 增长率:200%+

### 技术亮点
多模型路由(Claude、GPT-4、Gemini)、行业微调(金融、医疗、零售)、Agent 架构(可调用 API、数据库)、监控仪表盘(质量、合规)。

Sierra AI 证明"垂直 + 企业级 Agent"商业模式可行,推动企业 AI 从"聊天机器人"走向"任务执行"。`,
      category: '创业投资',
      author: 'Greenoaks Capital',
      cover: AI_LOGO_COVER,
      sort: 13,
      isPinned: false,
    },
    {
      title: 'Scale AI 估值 140 亿美元:AI 数据标注龙头',
      summary:
        'Scale AI 2024 年 5 月完成 10 亿美元 F 轮,估值 140 亿美元,Accel 领投,服务 OpenAI、Meta、美政府。',
      content: `## Scale AI 估值 140 亿美元

AI 数据标注与评估平台 **Scale AI** 在 2024 年 5 月完成 **10 亿美元 F 轮融资**,估值达 **140 亿美元**,由 Accel 领投,巩固 AI 数据基础设施龙头地位。

### 融资详情
- 融资金额:10 亿美元(二次融资 + 主融资)
- 估值:140 亿美元
- 领投方:Accel
- 参投方:Y Combinator、Founders Fund、Index Ventures、Coatue、Tiger Global、Meta
- 使用目的:扩大企业业务、政府业务、模型评估

### 业务组成
1. **企业 AI 数据标注**
   - 训练数据标注(图像、文本、音频、视频)
   - RLHF 人类反馈数据
   - 客户:OpenAI、Meta、Microsoft、Anthropic、xAI

2. **政府业务 Scale Public Sector**
   - 国防部、CIA、空军合作
   - Project Maven 后续
   - 2024 年政府合同 8 亿美元

3. **模型评估 Scale Evaluation**
   - SEAL Leaderboards(模型评测榜单)
   - 私有评估服务
   - 企业 RAG 评估

### 商业表现
- 2024 年 ARR:8.7 亿美元
- 2025 年 ARR 预期:20 亿美元
- 政府业务占 35%
- 企业业务占 65%

### 创始人
Alexandr Wang(1997 年生,MIT 辍学),24 岁成为最年轻白手起家亿万富翁,"AI 数据即新时代石油"。

### 收购扩张
2024 年 6 月收购 Remesh(对话式 AI 调研)、8 月收购 Acquired.io(招聘 AI)、11 月收购 SiaSearch(驾驶数据)。

Scale AI 证明"AI 数据基础设施"是巨大商业机会,推动数据标注行业专业化与标准化。`,
      category: '创业投资',
      author: 'Accel',
      cover: AI_LOGO_COVER,
      sort: 12,
      isPinned: false,
    },
    {
      title: 'Canva IPO 准备:估值 260 亿美元的设计独角兽',
      summary: 'Canva 2024 年估值 260 亿美元,准备 2025-2026 年 IPO,深化 AI 设计工具 Magic Studio。',
      content: `## Canva IPO 准备

在线设计平台 **Canva** 在 2024 年估值 **260 亿美元**,积极准备 2025-2026 年 IPO,深化 AI 设计工具 Magic Studio,挑战 Adobe Photoshop。

### 估值历程
- 2021 年 9 月:400 亿美元(峰值,低利率时代)
- 2023 年:260 亿美元(回调)
- 2024 年:260 亿美元(企稳)
- IPO 预期:300-400 亿美元

### 商业表现
- 2024 年 ARR:25 亿美元
- 2025 年 ARR 预期:35 亿美元
- 用户:2.2 亿月活(2024)
- 付费用户:2000 万
- 170+ 国家使用
- 增长率:50%+

### Magic Studio AI 套件(2023 年 10 月发布)
- **Magic Design**:AI 自动生成设计
- **Magic Write**:AI 文案生成
- **Magic Edit**:AI 编辑图像
- **Magic Animate**:AI 添加动画
- **Magic Media**:文生图、文生视频
- **Magic Morph**:AI 修改形状
- **Magic Expand**:AI 扩展图像

### 商业模式
- Free:免费版
- Pro:12.99 美元/月(个人)
- Teams:14.99 美元/人/月(团队)
- Enterprise:定制
- 90% 收入来自订阅

### 收购扩张
2021 年:Kaleido.ai 与 Smartmockups;2023 年 3 月:Affinity(Adobe 竞品,3800 万英镑);2024 年:Leonardo.ai(生成式 AI)、Islside(图像编辑)。

### IPO 准备
2024 年聘请 Goldman Sachs、JPMorgan 承销,计划 2025 年下半年或 2026 年 IPO,估值目标 300-400 亿美元,双重股权结构保留创始人控制权。

Canva IPO 将成为 2025-2026 年最大科技 IPO 之一,验证 AI + SaaS 商业模式价值。`,
      category: '创业投资',
      author: 'Canva 官方',
      cover: AI_LOGO_COVER,
      sort: 11,
      isPinned: false,
    },

    // ============ 8. 政策法规 (sort 10-1) ============
    {
      title: 'EU AI Act 正式生效:全球首个全面 AI 监管法',
      summary:
        '欧盟 AI Act 2024 年 8 月 1 日生效,基于风险分级监管 AI,2026 年全面实施,违规最高罚全球营业额 7%。',
      content: `## EU AI Act 全球首个 AI 监管法

欧盟《人工智能法案》(AI Act)于 **2024 年 8 月 1 日正式生效**,是全球首部全面 AI 监管法律,标志 AI 治理进入法律强制时代。

### 核心框架:风险分级
1. **不可接受风险(禁止)**:社会评分、操纵性 AI、实时人脸识别(执法例外)
2. **高风险**:招聘、信贷、教育、医疗、关键基础设施 AI,需注册、合规、审计
3. **有限风险**:聊天机器人、深度伪造,需透明披露
4. **最小风险**:大部分 AI 应用,无特殊义务

### 关键时间表
- 2024 年 8 月 1 日:法律生效
- 2025 年 2 月 2 日:禁止条款生效(不可接受风险)
- 2025 年 8 月 2 日:GPM 模型条款生效
- 2026 年 8 月 2 日:高风险条款全面生效
- 2027 年 8 月 2 日:部分行业过渡期结束

### 罚则
- 不可接受风险违规:最高全球营业额 7% 或 3500 万欧元(取高)
- 高风险违规:最高 3% 或 1500 万欧元
- 错误信息:最高 1% 或 750 万欧元

### 通用 AI 模型(GPM)规则
- 计算量 > 10^25 FLOPs 视为"系统性风险模型"
- 需向欧盟 AI 办公室注册
- 需提供技术文档、训练数据摘要
- 需做对抗性测试(红队)
- 严重事件需报告

### 影响
OpenAI、Google、Meta 等需遵守,推动全球 AI 监管立法(中国、美国、巴西、加拿大跟进),企业合规成本上升 5-15%,欧盟 AI 办公室 2024 年成立,500 人编制。

法国、德国担忧影响本土 AI 产业,开源模型豁免争议,执法能力不足担忧。`,
      category: '政策法规',
      author: '欧盟委员会',
      cover: AI_LOGO_COVER,
      sort: 10,
      isPinned: true,
    },
    {
      title: '美国 AI 行政命令:拜登政府 AI 治理框架',
      summary:
        '拜登 2023 年 10 月签署 AI 行政令,要求 NIST 制定标准,2024 年 OMB 发布机构 AI 使用指南。',
      content: `## 美国 AI 行政命令

美国总统拜登于 **2023 年 10 月 30 日**签署《安全、可靠、可信的人工智能开发与使用行政命令》,是美国联邦层面最全面的 AI 治理文件,2024 年持续推进落地。

### 核心要求
1. **安全标准**:开发大型 AI 模型(> 10^26 FLOPs)需向政府报告安全测试结果
2. **NIST 标准**:制定 AI 红队测试标准与指南
3. **基础设施安全**:AI 用于关键基础设施需安全认证
4. **内容标识**:商务部制定 AI 生成内容标识标准
5. **移民便利**:简化 AI 人才签证流程
6. **联邦机构使用**:OMB 发布机构 AI 使用指南

### 2024 年落地进展
- OMB M-24-10 指令:联邦机构任命首席 AI 官
- NIST AI Safety Institute(美国 AI 安全研究所)成立
- 商务部 C2PA 内容标识标准推进
- 国防部 AI 伦理指南更新

### 与 Trump 政策转向
- 2025 年 1 月 Trump 就任后撤销拜登 AI 行政令
- Trump 推出"美国 AI 福利"行政令,放松监管
- 强调"AI 优势"而非"AI 安全"
- 但保留 NIST AI 标准与红队测试

### 与欧盟对比
- 欧盟:法律强制,统一监管
- 美国:行政指导 + 行业自律
- 中国:部门规章 + 算法备案

### 行业影响
OpenAI、Google、Anthropic 自愿签署白宫 AI 承诺(2023 年 7 月),包括安全测试、内容标识、信息披露。`,
      category: '政策法规',
      author: '美国白宫',
      cover: AI_LOGO_COVER,
      sort: 9,
      isPinned: false,
    },
    {
      title: '中国生成式 AI 管理办法:全球首个生成式 AI 专门立法',
      summary:
        '中国《生成式 AI 服务管理暂行办法》2023 年 8 月 15 日实施,要求备案、内容标识、训练数据合法。',
      content: `## 中国生成式 AI 管理办法

中国《生成式人工智能服务管理暂行办法》于 **2023 年 8 月 15 日**正式实施,是全球首个针对生成式 AI 的专门立法,2024-2025 年持续完善配套规则。

### 核心原则
- 鼓励创新与规范发展并重
- 分类分级监管
- 包容审慎监管
- 国家安全与公共利益优先

### 关键要求
1. **服务备案**:提供生成式 AI 服务需向网信办备案
2. **训练数据合法**:使用合法来源数据,尊重知识产权
3. **内容标识**:AI 生成内容需显著标识
4. **算法备案**:服务提供者需进行算法备案
5. **用户身份认证**:要求真实身份信息
6. **内容审核**:不得生成违法内容
7. **未成年人保护**:防沉迷、防不良信息

### 备案情况(截至 2024 年底)
- 累计备案 300+ 款大模型
- 包括:百度文心一言、阿里通义千问、智谱清言、月之暗面 Kimi、字节豆包
- OpenAI、Google 等境外服务未备案

### 配套规则
-《互联网信息服务深度合成管理规定》(2023 年 1 月)
-《算法推荐管理规定》(2022 年 3 月)
-《数据出境安全评估办法》
-《个人信息保护法》

### 监管特点
- 事前备案 + 事中事后监管
- 内容安全为核心
- 国家标准引导(GB/T 43697-2024)
- 行业自律公约(中国人工智能产业发展联盟)

### 行业影响
中国 AI 监管"先发展后规范"转向"边发展边规范",推动合规 AI 产业发展。`,
      category: '政策法规',
      author: '国家网信办',
      cover: AI_LOGO_COVER,
      sort: 8,
      isPinned: false,
    },
    {
      title: 'UNESCO AI 伦理建议书:全球首个 AI 伦理国际规范',
      summary: 'UNESCO 2021 年 11 月发布《AI 伦理建议书》,193 国通过,2024 年持续推动各国落地实施。',
      content: `## UNESCO AI 伦理建议书

联合国教科文组织(UNESCO)于 **2021 年 11 月**发布《人工智能伦理问题建议书》,是全球首个 AI 伦理国际规范,**193 个成员国**一致通过,2024-2025 年持续推动各国落地实施。

### 十大核心原则
1. **尊重、保护、促进人权与基本自由**
2. **促进环境与生态系统繁荣**
3. **确保多样性与包容性**
4. **生活在和平、公正与互联社会**
5. **负责任决策**
6. **透明度与可解释性**
7. **人类监督与决定**
8. **责任与问责**
9. **意识与素养**
10. **多利益攸关方治理**

### 实施机制
- 各国制定国家 AI 战略与伦理框架
- UNESCO 每两年评估实施进展
- 推动国际标准协同(ISO/IEC JTC 1/SC 42)
- 与区域组织合作(欧盟、非洲联盟、ASEAN)

### 落地进展(2024)
- 50+ 国家发布国家 AI 战略
- 30+ 国家设立 AI 伦理委员会
- 中国、日本、韩国、法国、德国率先对接
- 非洲联盟 2024 年发布《非洲 AI 大陆战略》

### 与 EU AI Act 关系
- UNESCO:软法,建议性
- EU AI Act:硬法,强制性
- 两者互补,推动全球 AI 治理

### 关键挑战
- 跨文化伦理差异(个人主义 vs 集体主义)
- 高收入与低收入国家 AI 鸿沟
- 商业利益与公共价值平衡
- AI 军事应用伦理空白

### 中国实践
中国 2022 年发布《新一代人工智能伦理规范》,与 UNESCO 原则对接,2024 年更新纳入生成式 AI 内容。`,
      category: '政策法规',
      author: 'UNESCO',
      cover: AI_LOGO_COVER,
      sort: 7,
      isPinned: false,
    },
    {
      title: 'GDPR 执法行动:欧盟数据保护持续高压',
      summary:
        'GDPR 2024 年累计罚款超 50 亿欧元,Meta、Google、Amazon 等科技巨头屡被重罚,影响 AI 训练。',
      content: `## GDPR 执法行动持续高压

欧盟《通用数据保护条例》(GDPR)自 2018 年 5 月实施以来,2024 年执法力度持续加强,累计罚款超 **50 亿欧元**,深刻影响 AI 训练数据合规。

### 重大罚款案例(2024)
- **Meta**:12 亿欧元(2023 年 5 月,数据跨境传输违规,2024 年维持)
- **Amazon Luxembourg**:7.46 亿欧元(2021 年,2024 年维持)
- **TikTok**:3.45 亿欧元(2023 年 9 月,儿童数据违规)
- **OpenAI**:1500 万欧元(2024 年 3 月,意大利 Garante)
- **Clearview AI**:9000 万欧元(荷兰 DPA,2024 年 9 月)

### AI 训练数据合规
- **训练数据来源**:需合法获取,获得用户同意
- **目的限制**:不能用于训练外的其他目的
- **数据删除权**:用户可要求删除个人数据
- **算法解释权**:用户可要求自动化决策解释

### OpenAI 案例
- 2023 年 3 月:意大利 Garante 暂时封禁 ChatGPT
- 2024 年 3 月:OpenAI 被罚 1500 万欧元
- 调整:欧洲用户可选择不参与训练
- 推动行业:数据最小化、差分隐私、联邦学习

### 与 AI 法案协同
- GDPR 管个人数据保护
- AI Act 管 AI 系统安全
- 两者重叠区域:训练数据、自动化决策
- 2024 年欧盟发布协同指南

### 全球影响
- 推动全球数据保护立法(Brazil LGPD、California CCPA、China PIPL)
- AI 企业合规成本上升 15-25%
- 推动"隐私保护 AI"技术发展

### 中国 PIPL
中国《个人信息保护法》2021 年 11 月实施,2024 年执法加强,与 GDPR 高度一致,推动中国 AI 企业出海合规。`,
      category: '政策法规',
      author: '欧盟数据保护委员会',
      cover: AI_LOGO_COVER,
      sort: 6,
      isPinned: false,
    },
    {
      title: '加州 SB 1047 否决:美国 AI 安全立法受挫',
      summary: '加州 SB 1047 AI 安全法案 2024 年 9 月被 Newsom 州长否决,引发 AI 监管路径大辩论。',
      content: `## 加州 SB 1047 否决事件

加州 **SB 1047《安全、可靠的开源人工智能法案》** 在 2024 年 8 月通过州议会后,**2024 年 9 月 29 日**被州长 Gavin Newsom 否决,标志美国 AI 安全立法首次重大受挫,引发 AI 监管路径大辩论。

### 法案核心内容
- 适用范围:训练成本 > 1 亿美元的模型
- 开发者义务:
  - 提交安全评估报告
  - 关键伤害事件报告
  - 第三方安全审计
  - 提供关闭开关
- 罚则:训练成本 2 倍或 10 亿美元(取高)
- 州检察长起诉权

### 支持方
- **AI 安全研究者**:Geoffrey Hinton、Yoshua Bengio、Stuart Russell
- **AI 伦理机构:Center for AI Safety、Musk、Anthropic
- **工会**:SAG-AFTRA(演员工会,担忧 AI 替代)
- **立法者**:州参议员 Scott Wiener

### 反对方
- **AI 企业**:OpenAI、Google、Meta、Anthropic(后期转向反对)
- **开源社区**:Hugging Face、Stability AI、Mistral
- **学界**:Yann LeCun、Fei-Fei Li(担忧阻碍创新)
- **民主党联邦议员**:Nancy Pelosi(担忧过度监管)

### Newsom 否决理由
- 仅基于"成本"判定风险,不准确
- 可能推动 AI 企业离开加州
- 未与联邦立法协同
- 对开源 AI 打击过大

### 后续影响
- 2025 年 Wiener 提出修订版 SB 53(基于能力而非成本)
- 推动联邦层面 AI 立法讨论
- 引发"AI 监管:安全 vs 创新"全球辩论
- 加州 2024 年 9 月通过其他 AI 法案(深度伪造、演员肖像权)

### 与欧盟对比
- 欧盟 AI Act:基于风险分级,全面监管
- 加州 SB 1047:基于模型规模,针对性监管
- 美国整体:州级分散立法,联邦缺位`,
      category: '政策法规',
      author: '加州政府',
      cover: AI_LOGO_COVER,
      sort: 5,
      isPinned: false,
    },
    {
      title: 'G7 广岛 AI 进程:全球 AI 治理多边合作',
      summary:
        'G7 广岛 AI 进程 2023 年启动,2024 年发布国际指导原则与行为准则,推动全球 AI 治理协同。',
      content: `## G7 广岛 AI 进程

**G7 广岛 AI 进程**(Hiroshima AI Process)由日本首相岸田文雄 2023 年 5 月 G7 峰会倡议启动,2024 年持续推进,是全球 AI 治理多边合作的核心机制。

### 关键成果
1. **2023 年 10 月**:发布《先进 AI 系统国际指导原则》
2. **2023 年 10 月**:发布《先进 AI 系统开发者国际行为准则》
3. **2024 年 4 月**:G7 数字部长会议通过 AI 治理框架
4. **2024 年 10 月**:发布《生成式 AI 风险评估框架》

### 国际指导原则(11 项)
1. 安全测试(红队)
2. 安全性事件报告
3. 信息透明度
4. 内容标识
5. 风险评估
6. 网络安全
7. 外部研究访问
8. 适当的人权保障
9. 环境可持续
10. 多语言与文化多样性
11. 责任与问责

### 行为准则(自愿)
- 适用于先进 AI 系统开发者
- 涵盖全生命周期:训练、部署、监控
- 强调国际合作与标准协同

### 2024 年进展
- G7 + EU + 印度、印尼、新加坡、巴西、澳大利亚参与
- 与 OECD AI 原则协同
- 与 UNESCO AI 伦理建议书对接
- 推动联合国 AI 治理咨询委员会

### 2025 年意大利 G7 主席国
- 优先议题:AI 与就业、AI 与健康
- 推动 AI 标准互认
- 深化与发展中国家合作

### 与中国关系
- 中国未参与 G7 AI 进程
- 但通过金砖国家、上海合作组织开展 AI 合作
- 2024 年中美元首会晤提及 AI 治理对话

### 行业影响
OpenAI、Google、Anthropic、Meta、Mistral 等 11 家公司签署 G7 行为准则,推动行业自律。`,
      category: '政策法规',
      author: 'G7 集团',
      cover: AI_LOGO_COVER,
      sort: 4,
      isPinned: false,
    },
    {
      title: '英国 AI 安全研究所:全球首个国家级 AI 安全机构',
      summary:
        '英国 AI Safety Institute 2023 年 11 月成立,2024 年发布前沿 AI 模型评估报告,与 OpenAI 等深度合作。',
      content: `## 英国 AI 安全研究所

英国 **AI Safety Institute**(AISI)于 **2023 年 11 月 2 日**在 Bletchley Park(布莱切利园)AI 安全峰会上正式成立,是全球首个国家级 AI 安全研究机构,2024 年持续推动前沿 AI 模型评估。

### 机构定位
- 评估前沿 AI 模型能力与风险
- 制定 AI 安全标准
- 与政府、企业、学界协同
- 推动国际 AI 安全合作

### 核心工作
1. **模型评估**:对 GPT-4、Claude、Gemini 等做安全评估
2. **红队测试**:模拟对抗性攻击
3. **安全研究**:基础研究与社会应用
4. **政策建议**:向政府提供 AI 政策建议

### 2024 年成果
- 发布《前沿 AI 模型评估框架》
- 对 OpenAI o1、Anthropic Claude 3.5、Google Gemini 1.5 做安全评估
- 发布《AI 安全研究路线图》
- 培训 200+ AI 安全研究员

### 与企业合作
- **OpenAI**:深度合作,o1 模型发布前 AISI 评估
- **Anthropic**:宪法 AI 评估
- **Google DeepMind**:Gemini 安全测试
- **Meta**:Llama 3 开源模型评估

### Bletchley Declaration
2023 年 11 月,28 国签署《布莱切利宣言》,承认 AI 安全风险,推动国际合作。2024 年韩国首尔 AI 峰会、2025 年法国巴黎 AI 峰会延续。

### 国际合作
- 与美国 NIST AI Safety Institute 互认
- 与新加坡 IMDA、日本 AI Safety Institute 合作
- 推动联合国 AI 治理咨询委员会

### 英国战略
- 通过 AI 安全领导力,提升"Global Britain"影响力
- 推动 AI 安全成为英国科技优势
- 吸引 AI 人才与投资

### 预算
2024 年预算 5000 万英镑,2025 年扩至 1 亿英镑。`,
      category: '政策法规',
      author: '英国政府',
      cover: AI_LOGO_COVER,
      sort: 3,
      isPinned: false,
    },
    {
      title: '新加坡 Model AI 框架:亚洲 AI 治理典范',
      summary:
        '新加坡 IMDA 2024 年 5 月更新 Model AI 治理框架,涵盖生成式 AI,推动亚洲 AI 治理典范。',
      content: `## 新加坡 Model AI 治理框架

新加坡资讯通信媒体发展管理局(IMDA)于 **2024 年 5 月 30 日**发布更新版《Model AI 治理框架》(涵盖生成式 AI),成为亚洲 AI 治理典范。

### 框架演进
- 2019 年:首版 Model AI 治理框架
- 2020 年:人力资源管理 AI 框架
- 2022 年:AI Verify 测试工具包
- 2024 年 5 月:涵盖生成式 AI 的更新版

### 2024 版核心内容
1. **问责制**:明确 AI 系统各环节责任
2. **数据**:训练数据来源与质量
3. **可信开发与部署**:全生命周期治理
4. **事件报告**:重大事件需向 IMDA 报告
5. **测试与保证**:第三方评估与认证
6. **安全**:AI 系统安全
7. **内容来源**:AI 生成内容标识
8. **安全与协调研发**:鼓励负责任研发
9. **AI 普及与赋权**:公众 AI 素养

### 自愿 vs 强制
- 框架为自愿性质
- 但作为行业事实标准
- AI Verify 提供评估工具
- 企业通过认证获市场信任

### AI Verify 测试工具包
- 技术测试:公平性、可解释性、鲁棒性
- 治理测试:问责制、透明度
- 评估报告:可视化、可对比
- 2024 年 100+ 企业使用

### 与企业合作
- **Microsoft**:Azure OpenAI 服务对接 AI Verify
- **Google**:Gemini 评估合作
- **IBM**:Watsonx 治理集成
- **Salesforce**:AI Cloud 合规

### 国际合作
- 与英国 AISI、美国 NIST 互认
- 东盟 AI 治理框架主导者
- 推动亚太 AI 治理协同

### 商业影响
- 新加坡成为亚洲 AI 企业首选总部
- AI 企业通过新加坡进军东南亚市场
- 合规成本较欧盟低,但国际认可度高

### 中国企业合作
腾讯、阿里、字节跳动等中国企业通过新加坡进行 AI 业务国际化,利用新加坡治理框架对接全球。`,
      category: '政策法规',
      author: '新加坡 IMDA',
      cover: AI_LOGO_COVER,
      sort: 2,
      isPinned: false,
    },
    {
      title: 'NIST AI 风险管理框架:美国 AI 治理基石',
      summary:
        'NIST 2023 年 1 月发布 AI 风险管理框架(AI RMF),2024 年配套生成式 AI 风险档案,成美国 AI 治理基石。',
      content: `## NIST AI 风险管理框架

美国国家标准与技术研究院(NIST)于 **2023 年 1 月 26 日**正式发布《AI 风险管理框架》(AI RMF 1.0),2024 年配套发布《生成式 AI 风险档案》,成为美国 AI 治理的基石。

### 框架核心
**四大功能**:
1. **治理(Govern)**:组织级 AI 治理文化与流程
2. **映射(Map)**:识别 AI 系统上下文与风险
3. **度量(Measure)**:评估与监测 AI 风险
4. **管理(Manage)**:应对与缓解 AI 风险

### 特点
- **自愿性质**:非强制,但作为事实标准
- **全生命周期**:从设计到退役
- **风险导向**:基于风险而非技术
- **可信 AI**:安全、可靠、可解释、公平、隐私、公平

### 2024 年配套文件
- **《生成式 AI 风险档案》**(2024 年 7 月):专门针对生成式 AI
  - 内容生成风险(深度伪造、错误信息)
  - 训练数据风险(版权、隐私)
  - 安全风险(越狱、对抗性攻击)
  - 社会风险(偏见、就业替代)
- **NIST AI Safety Institute**(2024 年 10 月):评估前沿 AI 模型

### AI Safety Institute(US AISI)
- 2024 年 10 月正式成立
- 主任:Elizabeth Kelly
- 预算:1000 万美元(2024 年)
- 任务:评估 GPT-4、Claude、Gemini 等前沿模型
- 与英国 AISI 互认

### 行业采用
- **OpenAI**:GPT-4 安全评估对接 NIST 框架
- **Google**:Gemini 治理报告引用 NIST RMF
- **Microsoft**:Responsible AI 标准对接
- **Anthropic**:宪法 AI 与 NIST 框架协同
- **Meta**:Llama 系列开源评估

### 与国际标准协同
- ISO/IEC 42001:2023 AI 管理体系
- OECD AI 原则
- G7 广岛 AI 进程
- UNESCO AI 伦理建议书

### 与 EU AI Act 关系
- NIST RMF:自愿,风险导向,技术标准
- EU AI Act:强制,合规导向,法律框架
- 两者互补,推动全球 AI 治理

### Trump 政府转向
- 2025 年 Trump 就任后保留 NIST AI RMF
- 但削减 US AISI 预算
- 强调"AI 优势"优先于"AI 安全"

NIST AI RMF 仍是美国 AI 治理的事实标准,2025 年继续更新。`,
      category: '政策法规',
      author: '美国 NIST',
      cover: AI_LOGO_COVER,
      sort: 1,
      isPinned: false,
    },
  ]

  let count = 0
  for (const a of articles) {
    const [ex] = await db.select().from(newsArticles).where(eq(newsArticles.title, a.title))
    if (ex) continue
    await db.insert(newsArticles).values({
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
    })
    count++
  }
  console.info(`[跨领域] 完成,新增 ${count} 条`)
}
