import { createDb } from '../src/client.js'
import { lessons, learnCategories } from '../src/schema/learn.js'
import { eq } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

// 课程种子数据
// 来源：历史项目 D:\历史项目存档\edu client\data\init_lesson_data.sql
// 原始表: t_lesson (45 条课程数据, id 10001-10045)
const lessonSeeds = [
  // 职业技能认证 - 软件开发方向
  {
    title: 'Python全栈开发工程师认证',
    code: 'CERT-PY-001',
    image: 'https://picsum.photos/seed/python/400/300',
    phrase: 'Python从入门到精通，全面掌握后端开发技能',
    introduction:
      '本课程涵盖Python基础语法、Web开发框架Django/Flask、数据库操作、API开发等核心技能，助您成为全栈开发工程师。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 100,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: 'Java高级开发工程师认证',
    code: 'CERT-JAVA-001',
    image: 'https://picsum.photos/seed/java/400/300',
    phrase: 'Java企业级开发核心技能认证',
    introduction: '深入学习Spring Boot、Spring Cloud微服务架构、分布式系统设计等企业级开发技能。',
    price: '399.00',
    originalPrice: '799.00',
    sortWeight: 99,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: '前端工程师职业认证',
    code: 'CERT-FE-001',
    image: 'https://picsum.photos/seed/frontend/400/300',
    phrase: 'Vue3/React双框架精通',
    introduction: '掌握现代前端开发技术栈，包括Vue3、React18、TypeScript、Webpack/Vite等。',
    price: '349.00',
    originalPrice: '699.00',
    sortWeight: 98,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },

  // 区块链方向
  {
    title: '区块链开发工程师认证',
    code: 'CERT-BC-001',
    image: 'https://picsum.photos/seed/blockchain/400/300',
    phrase: '智能合约与DApp开发',
    introduction: '学习Solidity智能合约开发、以太坊生态系统、Web3.js等区块链核心技术。',
    price: '499.00',
    originalPrice: '999.00',
    sortWeight: 97,
    categoryGroup: '职业技能认证',
    subCategory: '区块链方向',
  },
  {
    title: '数字货币与加密技术',
    code: 'CERT-BC-002',
    image: 'https://picsum.photos/seed/crypto/400/300',
    phrase: '深入理解加密货币原理',
    introduction: '比特币、以太坊底层原理，密码学基础，共识机制详解。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 96,
    categoryGroup: '职业技能认证',
    subCategory: '区块链方向',
  },

  // 物联网方向
  {
    title: '物联网开发工程师认证',
    code: 'CERT-IOT-001',
    image: 'https://picsum.photos/seed/iot/400/300',
    phrase: 'IoT设备开发与云平台对接',
    introduction: '学习嵌入式开发、传感器技术、MQTT协议、物联网云平台等核心技能。',
    price: '399.00',
    originalPrice: '799.00',
    sortWeight: 95,
    categoryGroup: '职业技能认证',
    subCategory: '物联网方向',
  },
  {
    title: '智能家居系统开发',
    code: 'CERT-IOT-002',
    image: 'https://picsum.photos/seed/smarthome/400/300',
    phrase: '打造智能家居生态系统',
    introduction: '从零开始构建智能家居系统，包括硬件选型、软件开发、云端集成。',
    price: '349.00',
    originalPrice: '699.00',
    sortWeight: 94,
    categoryGroup: '职业技能认证',
    subCategory: '物联网方向',
  },

  // 大数据方向
  {
    title: '大数据工程师认证',
    code: 'CERT-BD-001',
    image: 'https://picsum.photos/seed/bigdata/400/300',
    phrase: 'Hadoop+Spark大数据处理',
    introduction: '掌握大数据处理技术栈，包括Hadoop、Spark、Flink、Kafka等。',
    price: '499.00',
    originalPrice: '999.00',
    sortWeight: 93,
    categoryGroup: '职业技能认证',
    subCategory: '大数据方向',
  },
  {
    title: '数据仓库与数据分析',
    code: 'CERT-BD-002',
    image: 'https://picsum.photos/seed/datawarehouse/400/300',
    phrase: '企业级数据仓库建设',
    introduction: '学习数据仓库设计、ETL开发、BI报表开发等数据分析技能。',
    price: '399.00',
    originalPrice: '799.00',
    sortWeight: 92,
    categoryGroup: '职业技能认证',
    subCategory: '大数据方向',
  },

  // 网络安全方向
  {
    title: '网络安全工程师认证',
    code: 'CERT-SEC-001',
    image: 'https://picsum.photos/seed/security/400/300',
    phrase: '渗透测试与安全防护',
    introduction: '学习Web安全、渗透测试、安全加固、应急响应等网络安全技能。',
    price: '499.00',
    originalPrice: '999.00',
    sortWeight: 91,
    categoryGroup: '职业技能认证',
    subCategory: '网络安全方向',
  },
  {
    title: '信息安全管理师',
    code: 'CERT-SEC-002',
    image: 'https://picsum.photos/seed/infosec/400/300',
    phrase: 'ISO27001信息安全管理体系',
    introduction: '学习信息安全管理标准、风险评估、安全策略制定等。',
    price: '399.00',
    originalPrice: '799.00',
    sortWeight: 90,
    categoryGroup: '职业技能认证',
    subCategory: '网络安全方向',
  },

  // 云计算方向
  {
    title: '云计算架构师认证',
    code: 'CERT-CLOUD-001',
    image: 'https://picsum.photos/seed/cloud/400/300',
    phrase: 'AWS/阿里云/腾讯云架构设计',
    introduction: '学习主流云平台架构设计、DevOps实践、容器化部署等。',
    price: '599.00',
    originalPrice: '1199.00',
    sortWeight: 89,
    categoryGroup: '职业技能认证',
    subCategory: '云计算方向',
  },
  {
    title: 'Kubernetes容器编排实战',
    code: 'CERT-CLOUD-002',
    image: 'https://picsum.photos/seed/k8s/400/300',
    phrase: 'K8s从入门到生产实践',
    introduction: 'Docker容器化、Kubernetes集群管理、微服务部署等。',
    price: '449.00',
    originalPrice: '899.00',
    sortWeight: 88,
    categoryGroup: '职业技能认证',
    subCategory: '云计算方向',
  },

  // 软件水平考试
  {
    title: '软考初级-程序员',
    code: 'RUANKAO-CJ-001',
    image: 'https://picsum.photos/seed/ruankao1/400/300',
    phrase: '软考初级程序员备考指南',
    introduction: '全面覆盖软考初级程序员考试大纲，包含理论知识和实践技能。',
    price: '199.00',
    originalPrice: '399.00',
    sortWeight: 87,
    categoryGroup: '软件水平考试',
    subCategory: '软考初级',
  },
  {
    title: '软考初级-网络管理员',
    code: 'RUANKAO-CJ-002',
    image: 'https://picsum.photos/seed/ruankao2/400/300',
    phrase: '软考初级网络管理员通关',
    introduction: '网络基础、网络设备配置、网络安全管理等考点精讲。',
    price: '199.00',
    originalPrice: '399.00',
    sortWeight: 86,
    categoryGroup: '软件水平考试',
    subCategory: '软考初级',
  },
  {
    title: '软考中级-软件设计师',
    code: 'RUANKAO-ZJ-001',
    image: 'https://picsum.photos/seed/ruankao3/400/300',
    phrase: '软考中级软件设计师精讲',
    introduction: '数据结构、算法设计、软件工程、UML建模等核心考点。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 85,
    categoryGroup: '软件水平考试',
    subCategory: '软考中级',
  },
  {
    title: '软考中级-网络工程师',
    code: 'RUANKAO-ZJ-002',
    image: 'https://picsum.photos/seed/ruankao4/400/300',
    phrase: '软考中级网络工程师通关',
    introduction: '计算机网络原理、路由交换技术、网络安全等。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 84,
    categoryGroup: '软件水平考试',
    subCategory: '软考中级',
  },
  {
    title: '软考高级-系统架构设计师',
    code: 'RUANKAO-GJ-001',
    image: 'https://picsum.photos/seed/ruankao5/400/300',
    phrase: '软考高级架构师备考宝典',
    introduction: '系统架构设计、企业应用集成、中间件技术等高级考点。',
    price: '499.00',
    originalPrice: '999.00',
    sortWeight: 83,
    categoryGroup: '软件水平考试',
    subCategory: '软考高级',
  },
  {
    title: '软考高级-信息系统项目管理师',
    code: 'RUANKAO-GJ-002',
    image: 'https://picsum.photos/seed/ruankao6/400/300',
    phrase: '软考高级项目管理师通关',
    introduction: '项目管理知识体系、信息系统管理、案例分析等。',
    price: '499.00',
    originalPrice: '999.00',
    sortWeight: 82,
    categoryGroup: '软件水平考试',
    subCategory: '软考高级',
  },

  // 计算机等级考试
  {
    title: 'NCRE一级MS Office',
    code: 'NCRE-1-001',
    image: 'https://picsum.photos/seed/ncre1/400/300',
    phrase: '计算机一级MS Office全攻略',
    introduction: 'Word、Excel、PowerPoint操作技能及计算机基础知识。',
    price: '99.00',
    originalPrice: '199.00',
    sortWeight: 81,
    categoryGroup: '计算机等级考试',
    subCategory: 'NCRE一级',
  },
  {
    title: 'NCRE二级Python',
    code: 'NCRE-2-001',
    image: 'https://picsum.photos/seed/ncre2/400/300',
    phrase: '计算机二级Python程序设计',
    introduction: 'Python语法基础、数据处理、程序设计等考点精讲。',
    price: '149.00',
    originalPrice: '299.00',
    sortWeight: 80,
    categoryGroup: '计算机等级考试',
    subCategory: 'NCRE二级',
  },
  {
    title: 'NCRE二级C语言',
    code: 'NCRE-2-002',
    image: 'https://picsum.photos/seed/ncre3/400/300',
    phrase: '计算机二级C语言程序设计',
    introduction: 'C语言语法、指针、文件操作、算法设计等。',
    price: '149.00',
    originalPrice: '299.00',
    sortWeight: 79,
    categoryGroup: '计算机等级考试',
    subCategory: 'NCRE二级',
  },
  {
    title: 'NCRE三级网络技术',
    code: 'NCRE-3-001',
    image: 'https://picsum.photos/seed/ncre4/400/300',
    phrase: '计算机三级网络技术精讲',
    introduction: '网络原理、网络设备、网络安全、网络管理等。',
    price: '199.00',
    originalPrice: '399.00',
    sortWeight: 78,
    categoryGroup: '计算机等级考试',
    subCategory: 'NCRE三级',
  },
  {
    title: 'NCRE三级数据库技术',
    code: 'NCRE-3-002',
    image: 'https://picsum.photos/seed/ncre5/400/300',
    phrase: '计算机三级数据库技术精讲',
    introduction: '关系数据库、SQL语言、数据库设计、数据库管理等。',
    price: '199.00',
    originalPrice: '399.00',
    sortWeight: 77,
    categoryGroup: '计算机等级考试',
    subCategory: 'NCRE三级',
  },
  {
    title: 'NCRE四级网络工程师',
    code: 'NCRE-4-001',
    image: 'https://picsum.photos/seed/ncre6/400/300',
    phrase: '计算机四级网络工程师精讲',
    introduction: '高级网络技术、网络规划设计、网络安全等。',
    price: '249.00',
    originalPrice: '499.00',
    sortWeight: 76,
    categoryGroup: '计算机等级考试',
    subCategory: 'NCRE四级',
  },
  {
    title: 'NCRE四级数据库工程师',
    code: 'NCRE-4-002',
    image: 'https://picsum.photos/seed/ncre7/400/300',
    phrase: '计算机四级数据库工程师精讲',
    introduction: '数据库系统原理、数据库设计与管理、数据仓库等。',
    price: '249.00',
    originalPrice: '499.00',
    sortWeight: 75,
    categoryGroup: '计算机等级考试',
    subCategory: 'NCRE四级',
  },

  // AI认证考试
  {
    title: 'Microsoft AI-900认证',
    code: 'AI-MS-001',
    image: 'https://picsum.photos/seed/msai/400/300',
    phrase: 'Azure AI基础认证备考',
    introduction: 'Azure认知服务、机器学习基础、AI解决方案等。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 74,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },
  {
    title: 'Google Cloud AI认证',
    code: 'AI-GCP-001',
    image: 'https://picsum.photos/seed/gcpai/400/300',
    phrase: 'Google Cloud机器学习工程师',
    introduction: 'TensorFlow、Vertex AI、MLOps等Google AI技术栈。',
    price: '399.00',
    originalPrice: '799.00',
    sortWeight: 73,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },
  {
    title: 'AWS机器学习专家认证',
    code: 'AI-AWS-001',
    image: 'https://picsum.photos/seed/awsai/400/300',
    phrase: 'AWS Machine Learning Specialty',
    introduction: 'SageMaker、深度学习、MLOps最佳实践等。',
    price: '449.00',
    originalPrice: '899.00',
    sortWeight: 72,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },
  {
    title: '腾讯云AI从业者认证',
    code: 'AI-TC-001',
    image: 'https://picsum.photos/seed/tcai/400/300',
    phrase: '腾讯云人工智能从业者',
    introduction: '腾讯云AI产品、智能语音、图像识别等。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 71,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },
  {
    title: '华为HCIA-AI认证',
    code: 'AI-HW-001',
    image: 'https://picsum.photos/seed/hwai/400/300',
    phrase: '华为AI初级工程师认证',
    introduction: 'MindSpore框架、华为AI开发平台等。',
    price: '349.00',
    originalPrice: '699.00',
    sortWeight: 70,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },
  {
    title: '阿里云ACA-AI认证',
    code: 'AI-ALI-001',
    image: 'https://picsum.photos/seed/aliai/400/300',
    phrase: '阿里云人工智能助理工程师',
    introduction: '阿里云AI产品、PAI平台、智能语音等。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 69,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },
  {
    title: '百度深度学习工程师认证',
    code: 'AI-BD-001',
    image: 'https://picsum.photos/seed/bdai/400/300',
    phrase: '百度AI认证深度学习方向',
    introduction: 'PaddlePaddle框架、飞桨平台、深度学习实战。',
    price: '349.00',
    originalPrice: '699.00',
    sortWeight: 68,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },
  {
    title: '工信部AI应用工程师',
    code: 'AI-MIIT-001',
    image: 'https://picsum.photos/seed/miitai/400/300',
    phrase: '工信部人工智能应用工程师',
    introduction: '国家级AI认证，涵盖机器学习、深度学习、AI应用等。',
    price: '499.00',
    originalPrice: '999.00',
    sortWeight: 67,
    categoryGroup: 'AI认证考试',
    subCategory: 'AI认证',
  },

  // 通用课程 - AI 应用
  {
    title: 'ChatGPT高效办公：职场AI应用全攻略',
    code: 'AI-GPT-001',
    image: 'https://picsum.photos/seed/chatgpt/400/300',
    phrase: '掌握AI办公神器，效率提升10倍',
    introduction: '学习ChatGPT在文档写作、数据分析、代码编程等场景的实战应用。',
    price: '99.00',
    originalPrice: '199.00',
    sortWeight: 66,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: 'AI Agent智能体开发：AutoGPT原理与实战',
    code: 'AI-AGENT-001',
    image: 'https://picsum.photos/seed/agent/400/300',
    phrase: '从零构建自主AI Agent',
    introduction: '学习LangChain、AutoGPT、BabyAGI等AI Agent开发技术。',
    price: '399.00',
    originalPrice: '799.00',
    sortWeight: 65,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: '大模型微调实战：LoRA/QLoRA技术详解',
    code: 'AI-LLM-001',
    image: 'https://picsum.photos/seed/lora/400/300',
    phrase: '低成本微调大语言模型',
    introduction: '掌握LoRA、QLoRA等高效微调技术，定制专属AI模型。',
    price: '449.00',
    originalPrice: '899.00',
    sortWeight: 64,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: 'Stable Diffusion完全指南：从安装到商业应用',
    code: 'AI-SD-001',
    image: 'https://picsum.photos/seed/sd/400/300',
    phrase: 'AI绘画从入门到精通',
    introduction: '学习Stable Diffusion安装配置、提示词工程、ControlNet等技术。',
    price: '199.00',
    originalPrice: '399.00',
    sortWeight: 63,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: 'AI绘画提示词大师班：从构图到风格',
    code: 'AI-PROMPT-001',
    image: 'https://picsum.photos/seed/prompt/400/300',
    phrase: '掌握AI绘画的核心技能',
    introduction: '系统学习Midjourney、DALL-E、SD等平台的提示词技巧。',
    price: '129.00',
    originalPrice: '259.00',
    sortWeight: 62,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },

  // 通用课程 - 前端开发
  {
    title: 'Vue3从入门到精通实战教程',
    code: 'FE-VUE-001',
    image: 'https://picsum.photos/seed/vue3/400/300',
    phrase: 'Vue3 Composition API深度实战',
    introduction: '全面学习Vue3核心特性、Pinia状态管理、Vue Router等。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 61,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: 'TypeScript高级编程指南',
    code: 'FE-TS-001',
    image: 'https://picsum.photos/seed/ts/400/300',
    phrase: '类型安全的JavaScript开发',
    introduction: '深入学习TypeScript类型系统、泛型、装饰器等高级特性。',
    price: '249.00',
    originalPrice: '499.00',
    sortWeight: 60,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: 'Node.js后端开发实战',
    code: 'BE-NODE-001',
    image: 'https://picsum.photos/seed/nodejs/400/300',
    phrase: '全栈开发必备后端技能',
    introduction: '学习Express/Koa框架、数据库操作、API设计等后端开发技能。',
    price: '349.00',
    originalPrice: '699.00',
    sortWeight: 59,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
  {
    title: 'React18新特性与最佳实践',
    code: 'FE-REACT-001',
    image: 'https://picsum.photos/seed/react/400/300',
    phrase: 'React Hooks深度解析',
    introduction: '学习React18并发特性、Suspense、Server Components等。',
    price: '299.00',
    originalPrice: '599.00',
    sortWeight: 58,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },

  // 通用课程 - DevOps
  {
    title: 'Docker与容器化部署实战',
    code: 'DEVOPS-DOCKER-001',
    image: 'https://picsum.photos/seed/docker/400/300',
    phrase: '容器化DevOps实践',
    introduction: '学习Docker容器化、镜像管理、Docker Compose编排等。',
    price: '249.00',
    originalPrice: '499.00',
    sortWeight: 57,
    categoryGroup: '职业技能认证',
    subCategory: '云计算方向',
  },
  {
    title: 'Git版本控制与团队协作',
    code: 'DEVOPS-GIT-001',
    image: 'https://picsum.photos/seed/git/400/300',
    phrase: '高效团队开发必备技能',
    introduction: '学习Git工作流、分支策略、代码审查、CI/CD集成等。',
    price: '149.00',
    originalPrice: '299.00',
    sortWeight: 56,
    categoryGroup: '职业技能认证',
    subCategory: '软件开发方向',
  },
]

// 一级课程分类
const topLevelCategories = [
  { name: '职业技能认证', sort: 1 },
  { name: '软件水平考试', sort: 2 },
  { name: '计算机等级考试', sort: 3 },
  { name: 'AI认证考试', sort: 4 },
]

export async function seedLessons() {
  console.log(`开始导入 ${lessonSeeds.length} 条课程数据...`)

  // 1. 创建一级课程分类
  const topCategoryIds: Record<string, string> = {}
  for (const cat of topLevelCategories) {
    const [existing] = await db
      .select()
      .from(learnCategories)
      .where(eq(learnCategories.name, cat.name))
    if (existing) {
      topCategoryIds[cat.name] = existing.id
    } else {
      const [inserted] = await db
        .insert(learnCategories)
        .values({
          name: cat.name,
          sort: cat.sort,
          status: 1,
        })
        .returning({ id: learnCategories.id })
      topCategoryIds[cat.name] = inserted.id
    }
  }
  console.log(`一级课程分类创建完成: ${Object.keys(topCategoryIds).length} 个`)

  // 2. 创建二级课程分类
  const subCategoryIds: Record<string, string> = {}
  const subCategoryNames = [
    ...new Set(lessonSeeds.map((l) => `${l.categoryGroup}:${l.subCategory}`)),
  ]
  for (const key of subCategoryNames) {
    const [parentName, subName] = key.split(':')
    const parentId = topCategoryIds[parentName]
    const [existing] = await db
      .select()
      .from(learnCategories)
      .where(eq(learnCategories.name, subName))
    if (existing) {
      subCategoryIds[key] = existing.id
    } else {
      const [inserted] = await db
        .insert(learnCategories)
        .values({
          name: subName,
          pid: parentId,
          sort: 0,
          status: 1,
        })
        .returning({ id: learnCategories.id })
      subCategoryIds[key] = inserted.id
    }
  }
  console.log(`二级课程分类创建完成: ${Object.keys(subCategoryIds).length} 个`)

  // 3. 插入课程数据
  let insertedCount = 0
  for (const lesson of lessonSeeds) {
    const categoryKey = `${lesson.categoryGroup}:${lesson.subCategory}`
    const categoryId = subCategoryIds[categoryKey] ?? null

    await db
      .insert(lessons)
      .values({
        title: lesson.title,
        coverImage: lesson.image,
        intro: lesson.introduction,
        categoryId: categoryId,
        price: lesson.price,
        originalPrice: lesson.originalPrice,
        isFree: lesson.price === '0',
        isPublished: true,
        sort: lesson.sortWeight,
        viewCount: 0,
        signupCount: 0,
        lessonCount: 0,
        status: 1,
      })
      .onConflictDoNothing()
    insertedCount++
  }

  console.log(`课程数据导入完成: ${insertedCount}/${lessonSeeds.length} 条`)
}
