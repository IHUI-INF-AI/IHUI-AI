// AI 资讯落地页 API 客户端
// 本文件已拆分为子模块(types / http / news / comparison / feed / trends / leaderboard),
// 对外 API 通过再导出保持兼容。

export type {
  AiNewsArticle,
  AiLiveChannel,
  AiFundingItem,
  ComparisonRow,
  ComparisonModel,
  ComparisonTable,
  AiFeedTimelineItem,
  TrendNotification,
  TrendChartPoint,
  TrendChartData,
  LeaderboardCategory,
  ModelCapabilities,
  LeaderboardEntry,
} from './ai-news-api/types'
export { fetchAiNewsArticles, fetchAiLiveChannels } from './ai-news-api/news'
export { getComparisonTable, getFundingItems } from './ai-news-api/comparison'
export {
  fetchAiFeedItems,
  fetchAiFeedNotifications,
  fetchAiFeedHot,
  fetchAiFeedSources,
} from './ai-news-api/feed'
export { fetchAiTrendChart } from './ai-news-api/trends'
export {
  fetchLeaderboard,
  fetchLeaderboardEntry,
  fetchAllLeaderboardEntries,
} from './ai-news-api/leaderboard'
