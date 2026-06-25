/**
 * 首页与新闻中心共用的新闻数据源
 * 平台新闻、外部 AI 资讯同一份数据，两处展示一致
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getinformationListnews } from '@/api/knowledge/knowledge/knowledge-planet'
import { getProxiedImageUrl } from '@/utils/imageProxy'
import { logger } from '@/utils/logger'

export interface PlatformNewsItem {
  news_id: number
  title: string
  summary?: string
  content?: string
  publish_time?: string
  cover_image?: string
}

export interface ExternalNewsItem {
  id: string
  title: string
  summary?: string
  time?: string
  publishTime?: string
  cover?: string
  url?: string
}

// 模块级 ref，首页和新闻中心共用同一份数据
const platformNews = ref<PlatformNewsItem[]>([])
const externalNews = ref<ExternalNewsItem[]>([])

// 行业资讯（来自 /information/list 接口，与小程序端一致）
const industryNewsFromApi = ref<ExternalNewsItem[]>([])
const industryNewsLoading = ref(false)
const industryNewsNoMore = ref(false)
const industryNewsError = ref(false)
const lastIndustryInsertTime = ref<string | null>(null)

export function useNews() {
  const { t } = useI18n()
  const loading = ref(false)

  function formatDate(dateString: string | undefined | null): string {
    if (!dateString) return t('return.home_page3.未知时间')
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      if (diff < 0) return dateString
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      if (days === 0) return t('return.home_page3.今天1')
      if (days === 1) return t('return.home_page3.昨天2')
      if (days < 7) return `${days}天前`
      if (days < 30) return `${Math.floor(days / 7)}周前`
      if (days < 365) return `${Math.floor(days / 30)}个月前`
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch (error) {
      logger.warn('Date formatting failed:', { dateString, error })
      return dateString || '未知时间'
    }
  }

  function getDefaultPlatformNews(): PlatformNewsItem[] {
    return [
      { news_id: 1, title: t('title.home_page3.智汇AI平台全新5'), summary: '智汇AI平台正式发布2.0版本，新增图像识别、语音交互、视频分析等多模态AI能力，为用户提供更全面的AI解决方案', publish_time: new Date(Date.now() - 2 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop', true) },
      { news_id: 2, title: t('title.home_page3.AI智汇社用户突6'), summary: 'AI智汇社注册用户数突破10万大关，社区内AI应用、工具分享、技术讨论等内容日益丰富，成为AI爱好者的聚集地', publish_time: new Date(Date.now() - 5 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop', true) },
      { news_id: 3, title: t('title.home_page3.智汇AI开放平台7'), summary: '智汇AI开放平台正式上线，提供完整的API接口和SDK，支持第三方开发者快速接入AI能力，构建自己的AI应用', publish_time: new Date(Date.now() - 7 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&h=250&fit=crop', true) },
      { news_id: 4, title: t('title.home_page3.智汇AI推出企业8'), summary: '智汇AI企业版正式发布，提供私有化部署、数据安全保障、专属技术支持等服务，帮助企业快速实现AI转型', publish_time: new Date(Date.now() - 10 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=250&fit=crop', true) },
      { news_id: 5, title: t('title.home_page3.AI智汇社举办首9'), summary: 'AI智汇社成功举办首届AI创新大赛，吸引了数百名开发者参与，涌现出众多优秀的AI应用和创新方案', publish_time: new Date(Date.now() - 14 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=250&fit=crop', true) },
      { news_id: 6, title: t('title.home_page3.智汇AI新增5010'), summary: '智汇AI平台新增50+专业AI工具，涵盖内容创作、数据分析、图像处理、代码生成等多个领域，满足用户多样化需求', publish_time: new Date(Date.now() - 18 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=250&fit=crop', true) },
      { news_id: 7, title: t('title.home_page3.智汇AI与多家高11'), summary: '智汇AI与清华大学、北京大学等知名高校签署合作协议，共同推进AI人才培养和科研合作，为AI产业发展贡献力量', publish_time: new Date(Date.now() - 21 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=250&fit=crop', true) },
      { news_id: 8, title: t('title.home_page3.AI智汇社推出V12'), summary: 'AI智汇社正式推出VIP会员体系，会员可享受无限Token使用、优先体验新功能、专属客服支持等多项特权', publish_time: new Date(Date.now() - 25 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=250&fit=crop', true) },
      { news_id: 9, title: t('title.home_page3.智汇AI平台性能13'), summary: '智汇AI平台完成重大性能优化，通过算法优化和服务器升级，整体响应速度提升300%，用户体验显著改善', publish_time: new Date(Date.now() - 28 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop', true) },
      { news_id: 10, title: t('title.home_page3.智汇AI发布AI14'), summary: '智汇AI发布一站式AI模型训练平台，提供可视化训练界面、自动化调参、模型评估等功能，让AI开发更简单', publish_time: new Date(Date.now() - 32 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1555255707-c07966088b7b?w=400&h=250&fit=crop', true) },
      { news_id: 11, title: t('title.home_page3.AI智汇社社区活15'), summary: 'AI智汇社社区活跃度持续攀升，日均发帖量突破1000条，用户互动频繁，形成了良好的社区氛围', publish_time: new Date(Date.now() - 35 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=250&fit=crop', true) },
      { news_id: 12, title: t('title.home_page3.智汇AI获得A轮16'), summary: '智汇AI成功完成A轮融资，获得数千万资金支持，将用于产品研发、团队扩张和市场拓展，加速平台发展', publish_time: new Date(Date.now() - 40 * 86400000).toISOString(), cover_image: getProxiedImageUrl('https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=250&fit=crop', true) },
    ]
  }

  function getDefaultExternalNews(): ExternalNewsItem[] {
    return [
      { id: '1', title: '字节跳动否认"豆包AI眼镜即将出货"', summary: '针对市场传闻，字节跳动官方予以否认，称暂无明确销售计划', time: '1小时前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop', true), url: 'https://news.sina.com.cn/zx/ds/2026-01-06/doc-inhfiehx1622793.shtml' },
      { id: '2', title: t('title.home_page3.Meta以20亿'), summary: '此举被视为Meta在AI领域的重要布局，但资本市场反应冷淡，股价下跌', time: '3小时前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1676299080923-6c98c0f4e48d?w=400&h=250&fit=crop', true), url: 'https://news.sina.com.cn/zx/ds/2026-01-06/doc-inhfiehx1622793.shtml' },
      { id: '3', title: t('title.home_page3.OpenAI向美1'), summary: '以每年1美元的象征性价格，旨在提升政府效率', time: '5小时前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop', true), url: 'https://news.sina.com.cn/zx/ds/2025-08-07/doc-infkcfih0176169.shtml' },
      { id: '4', title: t('title.home_page3.DeepSeek2'), summary: '暴露了通用大模型在推理能力上的普遍缺陷', time: '1天前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1676299080923-6c98c0f4e48d?w=400&h=250&fit=crop', true), url: 'https://news.sina.com.cn/zx/ds/2025-08-07/doc-infkcfih0176169.shtml' },
      { id: '5', title: t('title.home_page3.苹果开发类Cha3'), summary: '标志着苹果在AI助手开发进入新阶段', time: '2天前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop', true), url: 'https://news.sina.com.cn/zx/ds/2025-09-27/doc-infrwpwy0113940.shtml' },
      { id: '6', title: t('title.home_page3.夸克AI眼镜迎首4'), summary: '新增"大模型多意图理解与执行"功能，可智能处理复合指令', time: '3天前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1676299080923-6c98c0f4e48d?w=400&h=250&fit=crop', true), url: 'https://news.softunis.com/49878.html' },
      { id: '7', title: 'AI商业化进入深水区，企业竞逐"Token经济学"', summary: '企业正通过技术创新实现Token成本的显著优化，以赢得规模化应用的市场先机', time: '4天前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop', true), url: 'https://news.softunis.com/49878.html' },
      { id: '8', title: 'Instagram负责人：AI时代"眼见未必实"', summary: '指出随着合成影像逼真，现实与虚构混淆，平台需进化以适应新环境', time: '5天前', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1676299080923-6c98c0f4e48d?w=400&h=250&fit=crop', true), url: 'https://news.softunis.com/49878.html' },
    ]
  }

  // 首次使用时给外部新闻填默认值，与首页一致
  if (externalNews.value.length === 0) {
    externalNews.value = getDefaultExternalNews()
  }

  /** 平台新闻：不再请求 api/v1/news/list，仅使用默认数据 */
  function loadPlatformNews(_options?: { pageNum?: number; pageSize?: number; category_id?: number }) {
    if (platformNews.value.length === 0) {
      platformNews.value = getDefaultPlatformNews()
    }
  }

  async function loadExternalNews() {
    try {
      const storageModule = await import('@/services/news-storage').catch(() => null)
      if (!storageModule?.getNewsList) {
        return
      }
      const { getNewsList: getLocalNewsList } = storageModule
      const [aiRes, techRes] = await Promise.all([
        getLocalNewsList({ category: 'ai', limit: 1000, orderBy: 'publish_time', order: 'desc' }).catch(() => ({ list: [] })),
        getLocalNewsList({ category: 'tech', limit: 1000, orderBy: 'publish_time', order: 'desc' }).catch(() => ({ list: [] })),
      ])
      const all = [...(aiRes?.list || []), ...(techRes?.list || [])]
      const unique = all.filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i)
      unique.sort((a, b) => new Date(b.publish_time || 0).getTime() - new Date(a.publish_time || 0).getTime())
      if (unique.length > 0) {
        externalNews.value = unique.map(n => ({
          id: n.id,
          title: n.title,
          summary: n.summary || n.title || '暂无摘要信息',
          time: formatDate(n.publish_time),
          publishTime: n.publish_time,
          cover: n.cover_image ? (typeof window !== 'undefined' ? getProxiedImageUrl(n.cover_image.startsWith('http') ? n.cover_image : (n.cover_image.startsWith('/') ? `${window.location.origin}${n.cover_image}` : n.cover_image)) : n.cover_image) : getProxiedImageUrl('https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop', true),
          url: n.source_url,
        }))
      }
    } catch (error) {
      logger.warn('Failed to load industry news', error)
    }
  }

  /**
   * 将 sourceTime（如 "Fri Feb 06 19:10:50 CST 2026"）转为 ISO 字符串供 entry-date 解析
   */
  function normalizeSourceTimeToIso(sourceTime: string): string {
    if (!sourceTime || typeof sourceTime !== 'string') return ''
    const s = sourceTime.trim()
    let d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear()
      if (y >= 1970 && y <= 2100) return d.toISOString()
    }
    const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
    const cstMatch = s.match(/\w{3}\s+(\w{3})\s+(\d{1,2})\s+[\d:]+\s+\w+\s+(\d{1,4})/)
    if (cstMatch) {
      const month = months[cstMatch[1]] ?? cstMatch[1]
      const day = String(cstMatch[2]).padStart(2, '0')
      let year = String(cstMatch[3] || new Date().getFullYear())
      if (year.length <= 2) year = '20' + year.padStart(2, '0')
      if (month && day && year) {
        d = new Date(`${year}-${month}-${day}T12:00:00.000Z`)
        if (!Number.isNaN(d.getTime())) return d.toISOString()
      }
    }
    const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T12:00:00.000Z`)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
    return ''
  }

  /** 资讯列表 API 项：兼容后端 { code, data, msg } 及项字段 sourceCreator/sourceTime 等 */
  interface InformationListItem {
    insertTime?: string
    insertTimeStr?: string
    sourceTime?: string
    title?: string
    name?: string
    content?: string
    summary?: string
    sourceName?: string
    sourceCreator?: string
    id?: string | number
    url?: string
    cover?: string
    coverImage?: string
    image?: string
    [key: string]: any
  }

  /**
   * 从 /information/list 加载行业资讯（复刻自 Ai-WXMiniVue 新闻列表）
   * 接口返回格式：{ code: 200, data: [...], msg: "success" }，项含 sourceCreator、sourceTime 等
   */
  async function loadIndustryNewsFromApi(insertTime?: string, append = false) {
    if (industryNewsLoading.value) return
    if (!append && industryNewsNoMore.value) industryNewsNoMore.value = false
    if (append && industryNewsNoMore.value) return
    industryNewsLoading.value = true
    if (!append) industryNewsError.value = false
    try {
      const res = await getinformationListnews(insertTime || '', '0', 'ARTF_INTG')
      const raw = res && typeof res === 'object' ? (res as Record<string, unknown>) : null
      if (!raw) {
        if (!append) industryNewsFromApi.value = []
        industryNewsNoMore.value = true
        industryNewsLoading.value = false
        return
      }
      const list =
        Array.isArray(raw.data) ? raw.data
        : Array.isArray(raw.list) ? raw.list
        : Array.isArray(raw.rows) ? raw.rows
        : Array.isArray(res) ? res
        : []
      if (list.length === 0) {
        if (!append) industryNewsFromApi.value = []
        industryNewsNoMore.value = true
        industryNewsLoading.value = false
        return
      }
      const mapped: ExternalNewsItem[] = list.map((item: InformationListItem, idx: number) => {
        const title = String(item.title ?? item.name ?? '')
        const rawContent = item.content ? String(item.content).replace(/<[^>]*>/g, '').trim() : (item.summary ? String(item.summary) : '')
        const summary = rawContent ? rawContent.substring(0, 150) : title
        const timeStr = item.sourceTime ?? item.insertTimeStr ?? item.insertTime ?? ''
        const normalizedIso = normalizeSourceTimeToIso(timeStr || (item.insertTime ?? ''))
        const publishTime = normalizedIso || (typeof item.insertTime === 'string' ? item.insertTime : new Date().toISOString())
        const coverUrl = item.cover ?? item.image ?? item.coverImage
        return {
          id: item.id != null ? String(item.id) : `industry_${Date.now()}_${idx}`,
          title: title || '无标题',
          summary: summary || title,
          time: timeStr,
          publishTime,
          cover: coverUrl
            ? (typeof window !== 'undefined' ? getProxiedImageUrl(String(coverUrl), true) : String(coverUrl))
            : undefined,
          url: item.url,
        }
      })
      if (append) {
        industryNewsFromApi.value = [...industryNewsFromApi.value, ...mapped]
      } else {
        industryNewsFromApi.value = mapped
      }
      const last = list[list.length - 1] as InformationListItem
      lastIndustryInsertTime.value = (last?.insertTime ?? last?.sourceTime ?? null) as string | null
      if (list.length < 10) industryNewsNoMore.value = true
    } catch (e) {
      logger.warn('Industry news API failed to load', e)
      if (!append) {
        industryNewsFromApi.value = []
        industryNewsNoMore.value = true
        industryNewsError.value = true
      }
    } finally {
      industryNewsLoading.value = false
    }
  }

  return {
    platformNews,
    externalNews,
    industryNewsFromApi,
    industryNewsLoading,
    industryNewsNoMore,
    industryNewsError,
    lastIndustryInsertTime,
    loadPlatformNews,
    loadExternalNews,
    loadIndustryNewsFromApi,
    formatDate,
    loading,
    getDefaultPlatformNews,
    getDefaultExternalNews,
  }
}
