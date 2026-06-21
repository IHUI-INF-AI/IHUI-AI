/**
 * 前端定时任务调度器
 * 使用浏览器API实现定时任务，不依赖后端
 */

import { executeCrawlAndSave } from './news-crawler'
import { cleanOldNews } from './news-storage'
import { SCHEDULE_CONFIG } from '@/scripts/news-crawler/config'
import { logError, getErrorLogs, generateStatisticsReport } from './news-crawler'
import { logger } from '@/utils/logger'

const STORAGE_KEY_LAST_CRAWL = 'news_crawler_last_crawl'
const STORAGE_KEY_SCHEDULE_ENABLED = 'news_crawler_schedule_enabled'
const STORAGE_KEY_LAST_CLEAN = 'news_crawler_last_clean'

// 清理配置：保留最近N天的新闻
const CLEANUP_CONFIG = {
  daysToKeep: 30, // 保留30天的新闻
  cleanInterval: 7, // 每7天执行一次清理
}

let scheduleInterval: number | null = null
let isRunning = false

/**
 * 计算下次执行时间（毫秒）
 */
function getNextCrawlTime(): number {
  const now = new Date()
  const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  
  // 早上8点
  const morning = new Date(beijingTime)
  morning.setHours(SCHEDULE_CONFIG.morning.hour, SCHEDULE_CONFIG.morning.minute, 0, 0)
  
  // 晚上8点
  const evening = new Date(beijingTime)
  evening.setHours(SCHEDULE_CONFIG.evening.hour, SCHEDULE_CONFIG.evening.minute, 0, 0)

  // 如果今天早上8点已过，使用晚上8点
  if (beijingTime.getTime() > morning.getTime() && beijingTime.getTime() < evening.getTime()) {
    return evening.getTime() - beijingTime.getTime()
  }
  // 如果今天晚上8点已过，使用明天早上8点
  else if (beijingTime.getTime() > evening.getTime()) {
    const nextMorning = new Date(morning)
    nextMorning.setDate(nextMorning.getDate() + 1)
    return nextMorning.getTime() - beijingTime.getTime()
  }
  // 否则使用今天早上8点
  else {
    return morning.getTime() - beijingTime.getTime()
  }
}

/**
 * 执行清理任务
 */
async function runCleanupTask(): Promise<void> {
  try {
    logError('info', '调度器', `开始清理 ${CLEANUP_CONFIG.daysToKeep} 天前的旧新闻...`)
    const deletedCount = await cleanOldNews(CLEANUP_CONFIG.daysToKeep)
    logError('info', '调度器', `清理完成，deleted ${deletedCount} old news items`, 
      `保留天数: ${CLEANUP_CONFIG.daysToKeep}`)
    localStorage.setItem(STORAGE_KEY_LAST_CLEAN, Date.now().toString())
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError('error', '调度器', `清理任务执行失败`, errorMessage)
  }
}

/**
 * 检查是否需要执行清理
 */
function shouldRunCleanup(): boolean {
  const lastClean = localStorage.getItem(STORAGE_KEY_LAST_CLEAN)
  if (!lastClean) {
    // 首次运行，执行清理
    return true
  }

  const lastCleanTime = parseInt(lastClean, 10)
  const daysSinceLastClean = (Date.now() - lastCleanTime) / (1000 * 60 * 60 * 24)

  // 如果距离上次清理已超过配置的间隔天数，执行清理
  return daysSinceLastClean >= CLEANUP_CONFIG.cleanInterval
}

/**
 * 执行抓取任务
 */
async function runCrawlTask(): Promise<void> {
  if (isRunning) {
    logError('warning', '调度器', '任务正在运行，跳过本次执行')
    return
  }

  isRunning = true
  try {
    logError('info', '调度器', '开始执行新闻抓取任务')
    const result = await executeCrawlAndSave()
    logError('info', '调度器', `抓取任务完成`, 
      `抓取: ${result.crawled} 条, 保存: ${result.saved} 条`)
    localStorage.setItem(STORAGE_KEY_LAST_CRAWL, Date.now().toString())

    if (shouldRunCleanup()) {
      logError('info', '调度器', '触发自动清理任务')
      runCleanupTask().catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logError('error', '调度器', '清理任务执行失败', errorMessage)
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError('error', '调度器', '任务执行失败', errorMessage)
  } finally {
    isRunning = false
  }
}

/**
 * 启动定时任务
 */
export function startScheduler(): void {
  // 开发环境默认禁用新闻爬虫，避免大量网络请求错误
  // 如果需要在开发环境启用，可以在 localStorage 中设置 news_crawler_schedule_enabled = 'true'
  if (import.meta.env.DEV) {
    const devEnabled = localStorage.getItem(STORAGE_KEY_SCHEDULE_ENABLED)
    if (devEnabled !== 'true') {
      // 开发环境静默跳过，不输出日志避免控制台噪声
      return
    }
  }

  if (scheduleInterval !== null) {
    logError('warning', '调度器', '定时任务已在运行')
    return
  }

  logError('info', '调度器', '正在启动定时任务...')

  const enabled = localStorage.getItem(STORAGE_KEY_SCHEDULE_ENABLED)
  if (enabled === 'false') {
    logError('warning', '调度器', '定时任务已禁用')
    return
  }

  const lastCrawl = localStorage.getItem(STORAGE_KEY_LAST_CRAWL)
  if (lastCrawl) {
    const lastCrawlTime = parseInt(lastCrawl, 10)
    const hoursSinceLastCrawl = (Date.now() - lastCrawlTime) / (1000 * 60 * 60)
    
    if (hoursSinceLastCrawl >= 12) {
      logError('info', '调度器', '距离上次抓取已超过12小时，立即执行一次')
      void runCrawlTask()
    } else if (shouldRunCleanup()) {
      logError('info', '调度器', '触发自动清理任务')
      runCleanupTask().catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logError('error', '调度器', '清理任务执行失败', errorMessage)
      })
    }
  } else {
    logError('info', '调度器', '首次运行，立即执行一次')
    void runCrawlTask()
  }

  scheduleInterval = window.setInterval(() => {
    const nextTime = getNextCrawlTime()
    
    if (nextTime < 60 * 1000) {
      void runCrawlTask()
    }
  }, 60 * 1000)

  const nextTime = getNextCrawlTime()
  const nextDate = new Date(Date.now() + nextTime)
  logError('info', '调度器', `定时任务已启动，下次执行时间: ${nextDate.toLocaleString('zh-CN')}`)
}

/**
 * 停止定时任务
 */
export function stopScheduler(): void {
  if (scheduleInterval !== null) {
    clearInterval(scheduleInterval)
    scheduleInterval = null
    logError('info', '调度器', '定时任务已停止')
  }
}

/**
 * 启用定时任务
 */
export function enableScheduler(): void {
  localStorage.setItem(STORAGE_KEY_SCHEDULE_ENABLED, 'true')
  startScheduler()
}

/**
 * 禁用定时任务
 */
export function disableScheduler(): void {
  localStorage.setItem(STORAGE_KEY_SCHEDULE_ENABLED, 'false')
  stopScheduler()
}

/**
 * 检查定时任务是否启用
 */
export function isSchedulerEnabled(): boolean {
  const enabled = localStorage.getItem(STORAGE_KEY_SCHEDULE_ENABLED)
  return enabled !== 'false'
}

/**
 * 获取最后执行时间
 */
export function getLastCrawlTime(): Date | null {
  const lastCrawl = localStorage.getItem(STORAGE_KEY_LAST_CRAWL)
  if (lastCrawl) {
    return new Date(parseInt(lastCrawl, 10))
  }
  return null
}

/**
 * 获取最后清理时间
 */
export function getLastCleanTime(): Date | null {
  const lastClean = localStorage.getItem(STORAGE_KEY_LAST_CLEAN)
  if (lastClean) {
    return new Date(parseInt(lastClean, 10))
  }
  return null
}

/**
 * 手动触发清理
 */
export async function triggerManualCleanup(daysToKeep: number = CLEANUP_CONFIG.daysToKeep): Promise<number> {
  logger.info(`[Manual cleanup started ${daysToKeep} day old news...`)
  const deletedCount = await cleanOldNews(daysToKeep)
  localStorage.setItem(STORAGE_KEY_LAST_CLEAN, Date.now().toString())
  logger.info(`[Manual cleanup completed，deleted ${deletedCount} old news items`)
  return deletedCount
}

/**
 * 获取清理配置
 */
export function getCleanupConfig() {
  return { ...CLEANUP_CONFIG }
}

/**
 * 设置清理配置
 */
export function setCleanupConfig(config: { daysToKeep?: number; cleanInterval?: number }) {
  if (config.daysToKeep !== undefined) {
    CLEANUP_CONFIG.daysToKeep = config.daysToKeep
  }
  if (config.cleanInterval !== undefined) {
    CLEANUP_CONFIG.cleanInterval = config.cleanInterval
  }
  logger.info('[Cleanup config updated:', CLEANUP_CONFIG)
}

/**
 * 手动触发一次抓取
 */
export async function triggerManualCrawl(): Promise<{ crawled: number; saved: number }> {
  logError('info', '调度器', '手动触发新闻抓取任务')
  return await executeCrawlAndSave()
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus() {
  return {
    isRunning: scheduleInterval !== null,
    isTaskRunning: isRunning,
    lastCrawlTime: getLastCrawlTime(),
    lastCleanTime: getLastCleanTime(),
    nextCrawlTime: scheduleInterval !== null ? new Date(Date.now() + getNextCrawlTime()) : null,
    enabled: isSchedulerEnabled(),
    cleanupConfig: getCleanupConfig(),
  }
}

/**
 * 获取错误日志
 */
export function getSchedulerErrorLogs(level?: 'error' | 'warning' | 'info', limit?: number) {
  return getErrorLogs(level, limit)
}

/**
 * 生成统计报告
 */
export function generateSchedulerReport(): string {
  const schedulerStatus = getSchedulerStatus()
  
  let report = '=== 新闻调度器状态报告 ===\n\n'
  
  report += '调度器状态:\n'
  report += `- 运行状态: ${schedulerStatus.isRunning ? '运行中' : '已停止'}\n`
  report += `- 任务状态: ${schedulerStatus.isTaskRunning ? '执行中' : '空闲'}\n`
  report += `- 启用状态: ${schedulerStatus.enabled ? '已启用' : '已禁用'}\n`
  report += `- 最后抓取: ${schedulerStatus.lastCrawlTime ? schedulerStatus.lastCrawlTime.toLocaleString('zh-CN') : '从未'}\n`
  report += `- 最后清理: ${schedulerStatus.lastCleanTime ? schedulerStatus.lastCleanTime.toLocaleString('zh-CN') : '从未'}\n`
  report += `- 下次抓取: ${schedulerStatus.nextCrawlTime ? schedulerStatus.nextCrawlTime.toLocaleString('zh-CN') : '未计划'}\n`
  
  report += '\n清理配置:\n'
  report += `- 保留天数: ${schedulerStatus.cleanupConfig.daysToKeep} 天\n`
  report += `- 清理间隔: ${schedulerStatus.cleanupConfig.cleanInterval} 天\n`
  
  report += '\n' + generateStatisticsReport()
  
  return report
}

/**
 * 打印调度器状态
 */
export function printSchedulerStatus(): void {
  logger.info(generateSchedulerReport())
}
