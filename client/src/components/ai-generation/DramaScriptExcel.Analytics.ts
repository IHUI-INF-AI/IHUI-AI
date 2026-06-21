/**
 * 数据分析仪表板模块
 * 
 * 功能：
 * 1. 生成质量分析
 * 2. 成本统计
 * 3. 效率分析
 * 4. 趋势图表数据
 */

import type { SceneFragment, Character } from './DramaScriptExcel.types'

// ========== 类型定义 ==========

export interface AnalyticsSummary {
  // 基础统计
  totalFragments: number
  completedFragments: number
  failedFragments: number
  pendingFragments: number
  generatingFragments: number
  
  // 质量统计
  averageQualityScore: number
  minQualityScore: number
  maxQualityScore: number
  qualityDistribution: QualityDistribution
  
  // 效率统计
  totalDuration: number  // 总视频时长（秒）
  averageDuration: number  // 平均视频时长（秒）
  averageGenerationTime: number  // 平均生成时间（估算）
  successRate: number  // 成功率（百分比）
  retryRate: number  // 重试率（百分比）
  
  // 成本统计
  estimatedCost: CostEstimate
  
  // 角色统计
  characterStats: CharacterStats[]
  
  // 场景统计
  sceneStats: SceneStats[]
  
  // 时间趋势
  timeTrend: TimeTrendData[]
  
  // 生成时间
  analyzedAt: string
}

export interface QualityDistribution {
  excellent: number  // 90-100
  good: number  // 70-89
  average: number  // 50-69
  poor: number  // 0-49
  unrated: number  // 未评分
}

export interface CostEstimate {
  promptTokens: number
  videoGenerations: number
  imageGenerations: number
  totalTokens: number
  estimatedCostUSD: number
  estimatedCostCNY: number
}

export interface CharacterStats {
  character: string
  fragmentCount: number
  averageQuality: number
  totalDuration: number
  successRate: number
}

export interface SceneStats {
  scene: string
  fragmentCount: number
  averageQuality: number
  totalDuration: number
}

export interface TimeTrendData {
  date: string
  fragmentsCreated: number
  fragmentsCompleted: number
  averageQuality: number
  totalDuration: number
}

export interface EfficiencyMetrics {
  fragmentsPerHour: number
  averagePromptLength: number
  averageDescriptionLength: number
  retryEfficiency: number  // 重试成功率
  firstAttemptSuccessRate: number
}

export interface QualityBreakdown {
  clarity: { average: number; trend: 'up' | 'down' | 'stable' }
  colorSaturation: { average: number; trend: 'up' | 'down' | 'stable' }
  motionSmoothness: { average: number; trend: 'up' | 'down' | 'stable' }
  characterConsistency: { average: number; trend: 'up' | 'down' | 'stable' }
}

// ========== 核心分析函数 ==========

/**
 * 生成完整的分析报告
 */
export function generateAnalyticsSummary(
  fragments: SceneFragment[],
  characters: Character[]
): AnalyticsSummary {
  const now = new Date().toISOString()
  
  // 基础统计
  const totalFragments = fragments.length
  const completedFragments = fragments.filter(f => f.status === 'completed').length
  const failedFragments = fragments.filter(f => f.status === 'failed').length
  const pendingFragments = fragments.filter(f => f.status === 'pending').length
  const generatingFragments = fragments.filter(f => f.status === 'generating').length
  
  // 质量统计
  const qualityStats = calculateQualityStats(fragments)
  
  // 效率统计
  const efficiencyStats = calculateEfficiencyStats(fragments)
  
  // 成本估算
  const costEstimate = estimateCosts(fragments)
  
  // 角色统计
  const characterStats = calculateCharacterStats(fragments, characters)
  
  // 场景统计
  const sceneStats = calculateSceneStats(fragments)
  
  // 时间趋势
  const timeTrend = calculateTimeTrend(fragments)
  
  return {
    totalFragments,
    completedFragments,
    failedFragments,
    pendingFragments,
    generatingFragments,
    
    averageQualityScore: qualityStats.average,
    minQualityScore: qualityStats.min,
    maxQualityScore: qualityStats.max,
    qualityDistribution: qualityStats.distribution,
    
    totalDuration: efficiencyStats.totalDuration,
    averageDuration: efficiencyStats.averageDuration,
    averageGenerationTime: efficiencyStats.averageGenerationTime,
    successRate: efficiencyStats.successRate,
    retryRate: efficiencyStats.retryRate,
    
    estimatedCost: costEstimate,
    characterStats,
    sceneStats,
    timeTrend,
    
    analyzedAt: now,
  }
}

/**
 * 计算质量统计
 */
function calculateQualityStats(fragments: SceneFragment[]): {
  average: number
  min: number
  max: number
  distribution: QualityDistribution
} {
  const completedWithScore = fragments.filter(
    f => f.status === 'completed' && f.qualityScore !== undefined
  )
  
  if (completedWithScore.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      distribution: {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0,
        unrated: fragments.length,
      },
    }
  }
  
  const scores = completedWithScore.map(f => f.qualityScore!)
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  
  // 计算分布
  const distribution: QualityDistribution = {
    excellent: scores.filter(s => s >= 90).length,
    good: scores.filter(s => s >= 70 && s < 90).length,
    average: scores.filter(s => s >= 50 && s < 70).length,
    poor: scores.filter(s => s < 50).length,
    unrated: fragments.filter(f => f.qualityScore === undefined).length,
  }
  
  return { average, min, max, distribution }
}

/**
 * 计算效率统计
 */
function calculateEfficiencyStats(fragments: SceneFragment[]): {
  totalDuration: number
  averageDuration: number
  averageGenerationTime: number
  successRate: number
  retryRate: number
} {
  const completed = fragments.filter(f => f.status === 'completed')
  const withDuration = completed.filter(f => f.videoDuration !== undefined)
  
  // 总时长和平均时长
  const totalDuration = withDuration.reduce((sum, f) => sum + (f.videoDuration || 0), 0)
  const averageDuration = withDuration.length > 0 
    ? totalDuration / withDuration.length 
    : 0
  
  // 估算平均生成时间（基于创建时间和更新时间）
  let totalGenerationTime = 0
  let validGenerationCount = 0
  
  for (const fragment of completed) {
    const created = new Date(fragment.createdAt).getTime()
    const updated = new Date(fragment.updatedAt).getTime()
    const generationTime = (updated - created) / 1000  // 秒
    
    if (generationTime > 0 && generationTime < 3600) {  // 排除异常值
      totalGenerationTime += generationTime
      validGenerationCount++
    }
  }
  
  const averageGenerationTime = validGenerationCount > 0
    ? totalGenerationTime / validGenerationCount
    : 0
  
  // 成功率
  const totalAttempts = fragments.filter(
    f => f.status === 'completed' || f.status === 'failed'
  ).length
  const successRate = totalAttempts > 0
    ? (completed.length / totalAttempts) * 100
    : 0
  
  // 重试率
  const fragmentsWithRetry = fragments.filter(
    f => (f.retryCount || 0) > 0
  ).length
  const retryRate = fragments.length > 0
    ? (fragmentsWithRetry / fragments.length) * 100
    : 0
  
  return {
    totalDuration,
    averageDuration,
    averageGenerationTime,
    successRate,
    retryRate,
  }
}

/**
 * 估算成本
 */
function estimateCosts(fragments: SceneFragment[]): CostEstimate {
  // 估算参数（可根据实际API定价调整）
  const PROMPT_COST_PER_1K_TOKENS = 0.03  // USD
  const VIDEO_GENERATION_COST = 0.5  // USD per video
  const IMAGE_GENERATION_COST = 0.02  // USD per image
  const USD_TO_CNY = 7.2
  
  // 估算token数
  let totalPromptTokens = 0
  let videoGenerations = 0
  let imageGenerations = 0
  
  for (const fragment of fragments) {
    // 估算提示词token（每4个字符约1个token）
    const promptLength = (fragment.videoPrompt?.length || 0) + 
      (fragment.firstFramePrompt?.length || 0) +
      (fragment.description?.length || 0)
    totalPromptTokens += Math.ceil(promptLength / 4)
    
    // 视频生成次数
    if (fragment.videoUrl || fragment.status === 'completed') {
      videoGenerations++
    }
    
    // 首帧图片生成次数
    if (fragment.firstFramePrompt) {
      imageGenerations++
    }
    
    // 加上重试次数
    videoGenerations += fragment.retryCount || 0
  }
  
  // 计算总成本
  const promptCost = (totalPromptTokens / 1000) * PROMPT_COST_PER_1K_TOKENS
  const videoCost = videoGenerations * VIDEO_GENERATION_COST
  const imageCost = imageGenerations * IMAGE_GENERATION_COST
  const totalCostUSD = promptCost + videoCost + imageCost
  
  return {
    promptTokens: totalPromptTokens,
    videoGenerations,
    imageGenerations,
    totalTokens: totalPromptTokens,
    estimatedCostUSD: Math.round(totalCostUSD * 100) / 100,
    estimatedCostCNY: Math.round(totalCostUSD * USD_TO_CNY * 100) / 100,
  }
}

/**
 * 计算角色统计
 */
function calculateCharacterStats(
  fragments: SceneFragment[],
  _characters: Character[]
): CharacterStats[] {
  const characterMap = new Map<string, SceneFragment[]>()
  
  // 按角色分组
  for (const fragment of fragments) {
    if (fragment.character) {
      if (!characterMap.has(fragment.character)) {
        characterMap.set(fragment.character, [])
      }
      characterMap.get(fragment.character)!.push(fragment)
    }
  }
  
  // 计算每个角色的统计
  const stats: CharacterStats[] = []
  
  characterMap.forEach((frags, character) => {
    const completed = frags.filter(f => f.status === 'completed')
    const withScore = completed.filter(f => f.qualityScore !== undefined)
    
    const averageQuality = withScore.length > 0
      ? Math.round(withScore.reduce((sum, f) => sum + (f.qualityScore || 0), 0) / withScore.length)
      : 0
    
    const totalDuration = completed.reduce((sum, f) => sum + (f.videoDuration || 0), 0)
    
    const successRate = frags.length > 0
      ? (completed.length / frags.length) * 100
      : 0
    
    stats.push({
      character,
      fragmentCount: frags.length,
      averageQuality,
      totalDuration,
      successRate,
    })
  })
  
  // 按片段数量排序
  return stats.sort((a, b) => b.fragmentCount - a.fragmentCount)
}

/**
 * 计算场景统计
 */
function calculateSceneStats(fragments: SceneFragment[]): SceneStats[] {
  const sceneMap = new Map<string, SceneFragment[]>()
  
  // 按场景分组
  for (const fragment of fragments) {
    if (fragment.scene) {
      if (!sceneMap.has(fragment.scene)) {
        sceneMap.set(fragment.scene, [])
      }
      sceneMap.get(fragment.scene)!.push(fragment)
    }
  }
  
  // 计算每个场景的统计
  const stats: SceneStats[] = []
  
  sceneMap.forEach((frags, scene) => {
    const completed = frags.filter(f => f.status === 'completed')
    const withScore = completed.filter(f => f.qualityScore !== undefined)
    
    const averageQuality = withScore.length > 0
      ? Math.round(withScore.reduce((sum, f) => sum + (f.qualityScore || 0), 0) / withScore.length)
      : 0
    
    const totalDuration = completed.reduce((sum, f) => sum + (f.videoDuration || 0), 0)
    
    stats.push({
      scene,
      fragmentCount: frags.length,
      averageQuality,
      totalDuration,
    })
  })
  
  // 按片段数量排序
  return stats.sort((a, b) => b.fragmentCount - a.fragmentCount)
}

/**
 * 计算时间趋势
 */
function calculateTimeTrend(fragments: SceneFragment[]): TimeTrendData[] {
  const dateMap = new Map<string, SceneFragment[]>()
  
  // 按日期分组
  for (const fragment of fragments) {
    const date = fragment.createdAt.split('T')[0]  // 取日期部分
    if (!dateMap.has(date)) {
      dateMap.set(date, [])
    }
    dateMap.get(date)!.push(fragment)
  }
  
  // 计算每天的统计
  const trend: TimeTrendData[] = []
  
  dateMap.forEach((frags, date) => {
    const completed = frags.filter(f => f.status === 'completed')
    const withScore = completed.filter(f => f.qualityScore !== undefined)
    
    const averageQuality = withScore.length > 0
      ? Math.round(withScore.reduce((sum, f) => sum + (f.qualityScore || 0), 0) / withScore.length)
      : 0
    
    const totalDuration = completed.reduce((sum, f) => sum + (f.videoDuration || 0), 0)
    
    trend.push({
      date,
      fragmentsCreated: frags.length,
      fragmentsCompleted: completed.length,
      averageQuality,
      totalDuration,
    })
  })
  
  // 按日期排序
  return trend.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 计算效率指标
 */
export function calculateEfficiencyMetrics(fragments: SceneFragment[]): EfficiencyMetrics {
  const completed = fragments.filter(f => f.status === 'completed')
  
  // 计算每小时生成的片段数（基于时间范围）
  let fragmentsPerHour = 0
  if (fragments.length >= 2) {
    const timestamps = fragments.map(f => new Date(f.createdAt).getTime())
    const minTime = Math.min(...timestamps)
    const maxTime = Math.max(...timestamps)
    const hours = (maxTime - minTime) / (1000 * 60 * 60)
    
    if (hours > 0) {
      fragmentsPerHour = Math.round((completed.length / hours) * 10) / 10
    }
  }
  
  // 平均提示词长度
  const promptLengths = fragments
    .filter(f => f.videoPrompt)
    .map(f => f.videoPrompt.length)
  const averagePromptLength = promptLengths.length > 0
    ? Math.round(promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length)
    : 0
  
  // 平均描述长度
  const descLengths = fragments
    .filter(f => f.description)
    .map(f => f.description.length)
  const averageDescriptionLength = descLengths.length > 0
    ? Math.round(descLengths.reduce((a, b) => a + b, 0) / descLengths.length)
    : 0
  
  // 重试效率（重试后成功的比例）
  const retriedFragments = fragments.filter(f => (f.retryCount || 0) > 0)
  const retriedAndCompleted = retriedFragments.filter(f => f.status === 'completed')
  const retryEfficiency = retriedFragments.length > 0
    ? (retriedAndCompleted.length / retriedFragments.length) * 100
    : 100
  
  // 首次尝试成功率
  const firstAttemptSuccess = completed.filter(f => (f.retryCount || 0) === 0)
  const firstAttemptSuccessRate = completed.length > 0
    ? (firstAttemptSuccess.length / fragments.filter(f => f.status === 'completed' || f.status === 'failed').length) * 100
    : 0
  
  return {
    fragmentsPerHour,
    averagePromptLength,
    averageDescriptionLength,
    retryEfficiency,
    firstAttemptSuccessRate,
  }
}

/**
 * 计算质量细分
 */
export function calculateQualityBreakdown(fragments: SceneFragment[]): QualityBreakdown {
  const withReport = fragments.filter(
    f => f.status === 'completed' && f.qualityReport
  )
  
  if (withReport.length === 0) {
    return {
      clarity: { average: 0, trend: 'stable' },
      colorSaturation: { average: 0, trend: 'stable' },
      motionSmoothness: { average: 0, trend: 'stable' },
      characterConsistency: { average: 0, trend: 'stable' },
    }
  }
  
  // 计算各项平均值
  const clarity = withReport.map(f => f.qualityReport!.clarity)
  const colorSaturation = withReport.map(f => f.qualityReport!.colorSaturation)
  const motionSmoothness = withReport.map(f => f.qualityReport!.motionSmoothness)
  const characterConsistency = withReport.map(f => f.qualityReport!.characterConsistency)
  
  const avgClarity = Math.round(clarity.reduce((a, b) => a + b, 0) / clarity.length)
  const avgColor = Math.round(colorSaturation.reduce((a, b) => a + b, 0) / colorSaturation.length)
  const avgMotion = Math.round(motionSmoothness.reduce((a, b) => a + b, 0) / motionSmoothness.length)
  const avgConsistency = Math.round(characterConsistency.reduce((a, b) => a + b, 0) / characterConsistency.length)
  
  // 计算趋势（比较前半部分和后半部分）
  const half = Math.floor(withReport.length / 2)
  
  function getTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 4) return 'stable'
    
    const firstHalf = values.slice(0, half)
    const secondHalf = values.slice(half)
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const diff = avgSecond - avgFirst
    if (diff > 5) return 'up'
    if (diff < -5) return 'down'
    return 'stable'
  }
  
  return {
    clarity: { average: avgClarity, trend: getTrend(clarity) },
    colorSaturation: { average: avgColor, trend: getTrend(colorSaturation) },
    motionSmoothness: { average: avgMotion, trend: getTrend(motionSmoothness) },
    characterConsistency: { average: avgConsistency, trend: getTrend(characterConsistency) },
  }
}

/**
 * 获取问题摘要
 */
export function getIssuesSummary(fragments: SceneFragment[]): {
  totalIssues: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  topIssues: Array<{ type: string; count: number; description: string }>
} {
  const issues: Array<{ type: string; severity: string; description: string }> = []
  
  for (const fragment of fragments) {
    if (fragment.qualityReport?.issues) {
      for (const issue of fragment.qualityReport.issues) {
        issues.push({
          type: issue.type,
          severity: issue.severity,
          description: issue.description,
        })
      }
    }
  }
  
  // 按类型统计
  const byType: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  const issueDescriptionCount: Record<string, number> = {}
  
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1
    issueDescriptionCount[issue.description] = (issueDescriptionCount[issue.description] || 0) + 1
  }
  
  // 获取最常见的问题
  const topIssues = Object.entries(issueDescriptionCount)
    .map(([description, count]) => {
      const issue = issues.find(i => i.description === description)
      return {
        type: issue?.type || 'unknown',
        count,
        description,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  return {
    totalIssues: issues.length,
    byType,
    bySeverity,
    topIssues,
  }
}

/**
 * 导出分析报告为JSON
 */
export function exportAnalyticsReport(
  fragments: SceneFragment[],
  characters: Character[]
): string {
  const summary = generateAnalyticsSummary(fragments, characters)
  const efficiency = calculateEfficiencyMetrics(fragments)
  const qualityBreakdown = calculateQualityBreakdown(fragments)
  const issuesSummary = getIssuesSummary(fragments)
  
  const report = {
    summary,
    efficiency,
    qualityBreakdown,
    issuesSummary,
    generatedAt: new Date().toISOString(),
  }
  
  return JSON.stringify(report, null, 2)
}

/**
 * 生成图表数据（用于前端渲染）
 */
export function generateChartData(fragments: SceneFragment[]): {
  qualityPieChart: { name: string; value: number }[]
  statusPieChart: { name: string; value: number }[]
  qualityLineChart: { date: string; value: number }[]
  characterBarChart: { name: string; fragments: number; quality: number }[]
  durationHistogram: { range: string; count: number }[]
} {
  // 质量分布饼图
  const qualityStats = calculateQualityStats(fragments)
  const qualityPieChart = [
    { name: '优秀 (90-100)', value: qualityStats.distribution.excellent },
    { name: '良好 (70-89)', value: qualityStats.distribution.good },
    { name: '一般 (50-69)', value: qualityStats.distribution.average },
    { name: '较差 (0-49)', value: qualityStats.distribution.poor },
    { name: '未评分', value: qualityStats.distribution.unrated },
  ].filter(item => item.value > 0)
  
  // 状态分布饼图
  const statusCounts = {
    completed: fragments.filter(f => f.status === 'completed').length,
    failed: fragments.filter(f => f.status === 'failed').length,
    pending: fragments.filter(f => f.status === 'pending').length,
    generating: fragments.filter(f => f.status === 'generating').length,
  }
  const statusPieChart = [
    { name: '已完成', value: statusCounts.completed },
    { name: '失败', value: statusCounts.failed },
    { name: '待处理', value: statusCounts.pending },
    { name: '生成中', value: statusCounts.generating },
  ].filter(item => item.value > 0)
  
  // 质量趋势折线图
  const timeTrend = calculateTimeTrend(fragments)
  const qualityLineChart = timeTrend
    .filter(t => t.averageQuality > 0)
    .map(t => ({
      date: t.date,
      value: t.averageQuality,
    }))
  
  // 角色统计柱状图
  const characterStats = calculateCharacterStats(fragments, [])
  const characterBarChart = characterStats.slice(0, 10).map(c => ({
    name: c.character,
    fragments: c.fragmentCount,
    quality: c.averageQuality,
  }))
  
  // 视频时长分布直方图
  const durations = fragments
    .filter(f => f.videoDuration !== undefined)
    .map(f => f.videoDuration!)
  
  const durationHistogram = [
    { range: '0-3秒', count: durations.filter(d => d <= 3).length },
    { range: '3-5秒', count: durations.filter(d => d > 3 && d <= 5).length },
    { range: '5-10秒', count: durations.filter(d => d > 5 && d <= 10).length },
    { range: '10-15秒', count: durations.filter(d => d > 10 && d <= 15).length },
    { range: '15秒以上', count: durations.filter(d => d > 15).length },
  ].filter(item => item.count > 0)
  
  return {
    qualityPieChart,
    statusPieChart,
    qualityLineChart,
    characterBarChart,
    durationHistogram,
  }
}
