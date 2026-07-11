import { createDb } from '../src/client.js'
import { liveCategories } from '../src/schema/live.js'
import { eq } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

// AI 行业分类种子数据
// 来源：历史项目 D:\历史项目存档\edu client\scripts\update_live_categories.sql
// 原始表: t_category (15 个一级分类 + 82 个二级分类 = 97 条)
// 注意: liveCategories 表使用 pid 字段表示父子关系，level 由层级决定

// 一级分类
const level1Categories = [
  // AI 核心领域
  { name: '大语言模型(LLM)', sort: 1 },
  { name: 'AI绘画与视觉', sort: 2 },
  { name: 'AI音视频', sort: 3 },
  { name: 'AI编程开发', sort: 4 },
  { name: 'AI基础技术', sort: 5 },
  // 行业 AI+
  { name: 'AI+医疗健康', sort: 6 },
  { name: 'AI+金融科技', sort: 7 },
  { name: 'AI+智能制造', sort: 8 },
  { name: 'AI+零售电商', sort: 9 },
  { name: 'AI+教育培训', sort: 10 },
  { name: 'AI+法律政务', sort: 11 },
  { name: 'AI+农业科技', sort: 12 },
  { name: 'AI+交通出行', sort: 13 },
  { name: 'AI+能源环保', sort: 14 },
  { name: 'AI+文化创意', sort: 15 },
]

// 二级分类（parentName 指向一级分类名称）
const level2Categories = [
  // 大语言模型(LLM) 下属 (7个)
  { name: 'ChatGPT应用实战', parentName: '大语言模型(LLM)', sort: 1 },
  { name: 'Claude技术解析', parentName: '大语言模型(LLM)', sort: 2 },
  { name: '国产大模型', parentName: '大语言模型(LLM)', sort: 3 },
  { name: '提示词工程', parentName: '大语言模型(LLM)', sort: 4 },
  { name: 'Agent智能体', parentName: '大语言模型(LLM)', sort: 5 },
  { name: 'RAG检索增强', parentName: '大语言模型(LLM)', sort: 6 },
  { name: '微调与训练', parentName: '大语言模型(LLM)', sort: 7 },

  // AI绘画与视觉 下属 (7个)
  { name: 'Stable Diffusion', parentName: 'AI绘画与视觉', sort: 1 },
  { name: 'Midjourney', parentName: 'AI绘画与视觉', sort: 2 },
  { name: 'DALL-E图像生成', parentName: 'AI绘画与视觉', sort: 3 },
  { name: 'ControlNet控制', parentName: 'AI绘画与视觉', sort: 4 },
  { name: 'ComfyUI工作流', parentName: 'AI绘画与视觉', sort: 5 },
  { name: 'AI商业设计', parentName: 'AI绘画与视觉', sort: 6 },
  { name: 'LoRA模型训练', parentName: 'AI绘画与视觉', sort: 7 },

  // AI音视频 下属 (6个)
  { name: 'AI语音合成(TTS)', parentName: 'AI音视频', sort: 1 },
  { name: 'AI语音识别(ASR)', parentName: 'AI音视频', sort: 2 },
  { name: 'AI视频生成', parentName: 'AI音视频', sort: 3 },
  { name: 'AI音乐创作', parentName: 'AI音视频', sort: 4 },
  { name: '数字人与虚拟主播', parentName: 'AI音视频', sort: 5 },
  { name: 'AI视频剪辑', parentName: 'AI音视频', sort: 6 },

  // AI编程开发 下属 (6个)
  { name: 'AI辅助编程', parentName: 'AI编程开发', sort: 1 },
  { name: 'AI代码审查', parentName: 'AI编程开发', sort: 2 },
  { name: 'LLM应用开发', parentName: 'AI编程开发', sort: 3 },
  { name: '向量数据库', parentName: 'AI编程开发', sort: 4 },
  { name: 'AI模型部署', parentName: 'AI编程开发', sort: 5 },
  { name: 'AI测试自动化', parentName: 'AI编程开发', sort: 6 },

  // AI基础技术 下属 (6个)
  { name: '深度学习基础', parentName: 'AI基础技术', sort: 1 },
  { name: '机器学习算法', parentName: 'AI基础技术', sort: 2 },
  { name: '计算机视觉(CV)', parentName: 'AI基础技术', sort: 3 },
  { name: '自然语言处理(NLP)', parentName: 'AI基础技术', sort: 4 },
  { name: '推荐系统', parentName: 'AI基础技术', sort: 5 },
  { name: '强化学习', parentName: 'AI基础技术', sort: 6 },

  // AI+医疗健康 下属 (5个)
  { name: 'AI辅助诊断', parentName: 'AI+医疗健康', sort: 1 },
  { name: '医学影像分析', parentName: 'AI+医疗健康', sort: 2 },
  { name: '药物研发AI', parentName: 'AI+医疗健康', sort: 3 },
  { name: '健康管理AI', parentName: 'AI+医疗健康', sort: 4 },
  { name: '医疗机器人', parentName: 'AI+医疗健康', sort: 5 },

  // AI+金融科技 下属 (5个)
  { name: '智能风控', parentName: 'AI+金融科技', sort: 1 },
  { name: '量化交易', parentName: 'AI+金融科技', sort: 2 },
  { name: 'AI智能投顾', parentName: 'AI+金融科技', sort: 3 },
  { name: '金融智能客服', parentName: 'AI+金融科技', sort: 4 },
  { name: '保险科技AI', parentName: 'AI+金融科技', sort: 5 },

  // AI+智能制造 下属 (5个)
  { name: '工业质检AI', parentName: 'AI+智能制造', sort: 1 },
  { name: '智能仓储物流', parentName: 'AI+智能制造', sort: 2 },
  { name: '预测性维护', parentName: 'AI+智能制造', sort: 3 },
  { name: '工业机器人', parentName: 'AI+智能制造', sort: 4 },
  { name: '数字孪生', parentName: 'AI+智能制造', sort: 5 },

  // AI+零售电商 下属 (5个)
  { name: '智能推荐系统', parentName: 'AI+零售电商', sort: 1 },
  { name: '虚拟试衣试妆', parentName: 'AI+零售电商', sort: 2 },
  { name: '智能客服机器人', parentName: 'AI+零售电商', sort: 3 },
  { name: '供应链AI优化', parentName: 'AI+零售电商', sort: 4 },
  { name: '智能定价策略', parentName: 'AI+零售电商', sort: 5 },

  // AI+教育培训 下属 (5个)
  { name: '智能备课系统', parentName: 'AI+教育培训', sort: 1 },
  { name: 'AI批改作业', parentName: 'AI+教育培训', sort: 2 },
  { name: '个性化学习', parentName: 'AI+教育培训', sort: 3 },
  { name: '虚拟教师助手', parentName: 'AI+教育培训', sort: 4 },
  { name: '教育数据分析', parentName: 'AI+教育培训', sort: 5 },

  // AI+法律政务 下属 (5个)
  { name: '智能法律咨询', parentName: 'AI+法律政务', sort: 1 },
  { name: '合同审核AI', parentName: 'AI+法律政务', sort: 2 },
  { name: '智慧政务', parentName: 'AI+法律政务', sort: 3 },
  { name: '司法辅助AI', parentName: 'AI+法律政务', sort: 4 },
  { name: '合规风险检测', parentName: 'AI+法律政务', sort: 5 },

  // AI+农业科技 下属 (5个)
  { name: '智能灌溉', parentName: 'AI+农业科技', sort: 1 },
  { name: '病虫害识别', parentName: 'AI+农业科技', sort: 2 },
  { name: '产量预测', parentName: 'AI+农业科技', sort: 3 },
  { name: '农业机器人', parentName: 'AI+农业科技', sort: 4 },
  { name: '精准农业', parentName: 'AI+农业科技', sort: 5 },

  // AI+交通出行 下属 (5个)
  { name: '自动驾驶', parentName: 'AI+交通出行', sort: 1 },
  { name: '智能交通管理', parentName: 'AI+交通出行', sort: 2 },
  { name: '物流配送AI', parentName: 'AI+交通出行', sort: 3 },
  { name: '出行规划AI', parentName: 'AI+交通出行', sort: 4 },
  { name: '车联网AI', parentName: 'AI+交通出行', sort: 5 },

  // AI+能源环保 下属 (5个)
  { name: '智能电网', parentName: 'AI+能源环保', sort: 1 },
  { name: '能耗优化', parentName: 'AI+能源环保', sort: 2 },
  { name: '环境监测AI', parentName: 'AI+能源环保', sort: 3 },
  { name: '碳排放管理', parentName: 'AI+能源环保', sort: 4 },
  { name: '新能源预测', parentName: 'AI+能源环保', sort: 5 },

  // AI+文化创意 下属 (5个)
  { name: 'AI写作创作', parentName: 'AI+文化创意', sort: 1 },
  { name: 'AI游戏开发', parentName: 'AI+文化创意', sort: 2 },
  { name: '虚拟偶像', parentName: 'AI+文化创意', sort: 3 },
  { name: 'AI影视特效', parentName: 'AI+文化创意', sort: 4 },
  { name: '文化遗产数字化', parentName: 'AI+文化创意', sort: 5 },
]

export async function seedAiCategories() {
  const total = level1Categories.length + level2Categories.length
  console.log(
    `开始导入 ${total} 条 AI 分类数据 (一级: ${level1Categories.length}, 二级: ${level2Categories.length})...`,
  )

  // 1. 插入一级分类
  const level1IdMap: Record<string, string> = {}
  for (const cat of level1Categories) {
    const [existing] = await db
      .select()
      .from(liveCategories)
      .where(eq(liveCategories.name, cat.name))
    if (existing) {
      level1IdMap[cat.name] = existing.id
    } else {
      const [inserted] = await db
        .insert(liveCategories)
        .values({
          name: cat.name,
          pid: null,
          sort: cat.sort,
          status: 1,
        })
        .returning({ id: liveCategories.id })
      level1IdMap[cat.name] = inserted.id
    }
  }
  console.log(`一级分类导入完成: ${Object.keys(level1IdMap).length} 个`)

  // 2. 插入二级分类（关联一级分类的 id）
  let level2Count = 0
  for (const cat of level2Categories) {
    const parentId = level1IdMap[cat.parentName]
    if (!parentId) {
      console.warn(`未找到一级分类 "${cat.parentName}"，跳过二级分类 "${cat.name}"`)
      continue
    }

    await db
      .insert(liveCategories)
      .values({
        name: cat.name,
        pid: parentId,
        sort: cat.sort,
        status: 1,
      })
      .onConflictDoNothing()
    level2Count++
  }
  console.log(`二级分类导入完成: ${level2Count} 个`)
  console.log(`AI 分类数据导入完成: 共 ${level1Categories.length + level2Count} 条`)
}
