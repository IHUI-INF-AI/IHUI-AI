#!/usr/bin/env node
/**
 * add-eduai2-i18n.mjs — 为 5 语言 web messages 注入 eduAi.{map/live/shop/marking} + nav 导航 key
 * 用法: node scripts/add-eduai2-i18n.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MSG_DIR = path.resolve(__dirname, '../packages/i18n/messages/web')

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

const NAV_KEYS = {
  'zh-CN': { eduAiMap: '学习地图', eduAiLive: '直播课堂', eduAiShop: '课程商城', eduAiMarking: 'AI 批改' },
  en: { eduAiMap: 'Learning Map', eduAiLive: 'Live Classes', eduAiShop: 'Course Shop', eduAiMarking: 'AI Marking' },
  ja: { eduAiMap: '学習マップ', eduAiLive: 'ライブ授業', eduAiShop: 'コースショップ', eduAiMarking: 'AI採点' },
  ko: { eduAiMap: '학습 지도', eduAiLive: '라이브 강의', eduAiShop: '강좌 쇼핑', eduAiMarking: 'AI 채점' },
  'zh-TW': { eduAiMap: '學習地圖', eduAiLive: '直播課堂', eduAiShop: '課程商城', eduAiMarking: 'AI 批改' },
}

const EDUAI = {
  'zh-CN': {
    map: {
      title: '学习地图', subtitle: '知识图谱式学习路径,系统掌握 AI 技能',
      maps: '学习地图', topics: '专题课程', search: '搜索专题...',
      viewDetail: '查看详情', loading: '加载中...', empty: '暂无内容', loadFailed: '加载失败',
      prev: '上一页', next: '下一页', page: '第 {page} / {total} 页',
      relatedCourses: '关联课程', noCourses: '暂无关联课程', description: '简介', lessons: '课程数',
    },
    live: {
      title: '直播课堂', subtitle: 'AI 公开课、编程实战与名师讲座',
      allCategories: '全部分类', liveNow: '直播中', upcoming: '预告', ended: '已结束',
      search: '搜索直播...', startTime: '开始时间', viewDetail: '查看详情', loading: '加载中...',
      empty: '暂无直播', loadFailed: '加载失败', prev: '上一页', next: '下一页',
      page: '第 {page} / {total} 页', watch: '进入直播间', description: '直播简介', category: '分类',
      noStream: '暂未开播,敬请期待',
    },
    shop: {
      title: '课程商城', subtitle: '精选 AI 课程,在线购买学习',
      tabAll: '全部课程', tabOrders: '我的订单', buy: '购买', buying: '下单中...',
      orderSuccess: '下单成功', orderFailed: '下单失败', cancelOrder: '取消订单',
      cancelSuccess: '已取消', cancelFailed: '取消失败', status: '状态', orderNo: '订单号',
      createTime: '下单时间', pending: '待支付', paid: '已支付', cancelled: '已取消',
      loading: '加载中...', empty: '暂无课程', ordersEmpty: '暂无订单', loadFailed: '加载失败',
      prev: '上一页', next: '下一页', page: '第 {page} / {total} 页', confirmCancel: '确认取消该订单?',
      confirm: '确认', cancel: '取消',
    },
    marking: {
      title: 'AI 批改', subtitle: 'AI 评分练习答案,给出评语与改进建议',
      subject: '学科(可选)', question: '题目', questionPlaceholder: '输入题目内容,如:用 Python 实现冒泡排序',
      studentAnswer: '学生答案', studentAnswerPlaceholder: '粘贴学生的答案内容...',
      referenceAnswer: '参考答案(可选)', maxScore: '满分', defaultMax: '100',
      gradeBtn: '开始批改', grading: 'AI 批改中...', score: '得分', comment: '评语',
      strengths: '优点', weaknesses: '不足', suggestions: '改进建议', loading: '加载中...',
      empty: '输入题目与答案,开始 AI 批改', loadFailed: '批改失败,请重试', noResult: '暂无批改结果',
    },
  },
  en: {
    map: {
      title: 'Learning Map', subtitle: 'Knowledge-graph learning paths for AI skills',
      maps: 'Learning Maps', topics: 'Topics', search: 'Search topics...',
      viewDetail: 'View detail', loading: 'Loading...', empty: 'No content', loadFailed: 'Load failed',
      prev: 'Prev', next: 'Next', page: 'Page {page} / {total}',
      relatedCourses: 'Related courses', noCourses: 'No related courses', description: 'Description', lessons: 'Lessons',
    },
    live: {
      title: 'Live Classes', subtitle: 'AI open classes, coding practice and expert talks',
      allCategories: 'All categories', liveNow: 'Live now', upcoming: 'Upcoming', ended: 'Ended',
      search: 'Search live...', startTime: 'Start time', viewDetail: 'View detail', loading: 'Loading...',
      empty: 'No live classes', loadFailed: 'Load failed', prev: 'Prev', next: 'Next',
      page: 'Page {page} / {total}', watch: 'Watch live', description: 'Description', category: 'Category',
      noStream: 'Not started yet, stay tuned',
    },
    shop: {
      title: 'Course Shop', subtitle: 'Curated AI courses, buy and learn online',
      tabAll: 'All courses', tabOrders: 'My orders', buy: 'Buy', buying: 'Placing order...',
      orderSuccess: 'Order placed', orderFailed: 'Order failed', cancelOrder: 'Cancel order',
      cancelSuccess: 'Cancelled', cancelFailed: 'Cancel failed', status: 'Status', orderNo: 'Order no.',
      createTime: 'Created', pending: 'Pending', paid: 'Paid', cancelled: 'Cancelled',
      loading: 'Loading...', empty: 'No courses', ordersEmpty: 'No orders', loadFailed: 'Load failed',
      prev: 'Prev', next: 'Next', page: 'Page {page} / {total}', confirmCancel: 'Cancel this order?',
      confirm: 'Confirm', cancel: 'Cancel',
    },
    marking: {
      title: 'AI Marking', subtitle: 'AI grades practice answers with comments and suggestions',
      subject: 'Subject (optional)', question: 'Question', questionPlaceholder: 'Enter the question, e.g. implement bubble sort in Python',
      studentAnswer: 'Student answer', studentAnswerPlaceholder: 'Paste the student answer...',
      referenceAnswer: 'Reference answer (optional)', maxScore: 'Max score', defaultMax: '100',
      gradeBtn: 'Grade', grading: 'AI grading...', score: 'Score', comment: 'Comment',
      strengths: 'Strengths', weaknesses: 'Weaknesses', suggestions: 'Suggestions', loading: 'Loading...',
      empty: 'Enter question and answer to start AI marking', loadFailed: 'Marking failed, retry', noResult: 'No result yet',
    },
  },
}

const FALLBACK = { ja: 'zh-CN', ko: 'zh-CN', 'zh-TW': 'zh-CN' }

function deepClone(o) { return JSON.parse(JSON.stringify(o)) }

for (const locale of LOCALES) {
  const file = path.join(MSG_DIR, `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))

  if (!data.nav) data.nav = {}
  for (const [k, v] of Object.entries(NAV_KEYS[locale] ?? NAV_KEYS['zh-CN'])) {
    data.nav[k] = v
  }

  if (!data.eduAi) data.eduAi = {}
  const src = EDUAI[locale] ?? deepClone(EDUAI[FALLBACK[locale]])
  for (const [ns, obj] of Object.entries(src)) {
    if (!data.eduAi[ns]) data.eduAi[ns] = obj
    else Object.assign(data.eduAi[ns], obj)
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`[OK] ${locale}.json 已注入 eduAi.{map/live/shop/marking} + nav 4 key`)
}
console.log('[DONE]')
