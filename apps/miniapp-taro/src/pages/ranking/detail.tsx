import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import * as api from '@/api'
import { DrawerComponent } from '@/components'
import { useI18n } from '@/i18n'
import './detail.css'

/** 排行榜详情数据(字段从列表项中筛选,后端无单条详情接口时走列表 find) */
interface RankingDetail {
  id?: string | number
  logo?: string
  name?: string
  intro?: string
  attention?: string
  category?: string
  price?: string
  status?: number | string
  subCategory?: string
  productForm?: string
  org?: string
  url?: string
  imgs?: string
  icon?: string
  content?: string
}

/** 排行榜原始列表项(后端字段命名不统一,pick 函数兼容多命名) */
interface RankingRawItem {
  id?: string | number
  [key: string]: unknown
}

interface RankingListResponse {
  list: RankingRawItem[]
  total?: number
}

/** 取字段值,兼容后端返回的多种命名 */
const pick = (obj: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

/** 状态码映射:2→已发布 / 4→测试中 / 6→已下线 / 其他→未知 */
const STATUS_MAP: Record<string, { key: string; fallback: string }> = {
  '2': { key: 'ranking.statusPublished', fallback: '已发布' },
  '4': { key: 'ranking.statusTesting', fallback: '测试中' },
  '6': { key: 'ranking.statusOffline', fallback: '已下线' },
}

/** 抽屉模式:menu=历史菜单 / fenlei=分类 */
type DrawerMode = 'menu' | 'fenlei'

export default function RankingDetailPage() {
  const { t } = useI18n()
  /** i18n 兜底:key 未命中时返回 fallback */
  const tt = useCallback(
    (k: string, fb: string) => (t(k) === k ? fb : t(k)),
    [t],
  )

  const router = useRouter()
  const [data, setData] = useState<RankingDetail>({})
  const [loading, setLoading] = useState(true)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('menu')
  const [relatedList, setRelatedList] = useState<RankingRawItem[]>([])

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) {
      setLoading(false)
      return
    }
    try {
      // 优先尝试 /ranking/detail 单条接口,失败则降级到列表 find
      let raw: Record<string, unknown> = {}
      try {
        const res = (await api.get('/ranking/detail', { id })) as
          | Record<string, unknown>
          | undefined
        const candidate = (res?.detail || res?.data || res) as
          | Record<string, unknown>
          | undefined
        if (candidate && typeof candidate === 'object' && Object.keys(candidate).length > 0) {
          raw = candidate
        }
      } catch {
        // 单条接口不存在,降级到列表 find
      }
      if (Object.keys(raw).length === 0) {
        const res = (await api.getRankingList()) as RankingListResponse | undefined
        const list = res?.list || []
        const item = list.find((it) => String(it.id) === String(id))
        raw = (item || {}) as Record<string, unknown>
        setRelatedList(list.filter((it) => String(it.id) !== String(id)).slice(0, 20))
      } else {
        // 单条接口成功,同时拉取列表用于抽屉
        try {
          const res = (await api.getRankingList()) as RankingListResponse | undefined
          setRelatedList(
            (res?.list || []).filter((it) => String(it.id) !== String(id)).slice(0, 20),
          )
        } catch {
          // ignore
        }
      }
      const statusVal = raw.status ?? raw.state
      setData({
        id: raw.id as string | number,
        logo: pick(raw, ['logo', 'avatar', 'icon', 'field1']),
        name: pick(raw, ['name', 'title']),
        intro: pick(raw, ['intro', 'desc', 'description', 'summary']),
        attention: pick(raw, ['attention', 'viewCount', 'collectCount']),
        category: pick(raw, ['category', 'cate']) || '通用助手',
        price: pick(raw, ['price']) || '免费',
        status: statusVal as number | string | undefined,
        subCategory: pick(raw, ['subCategory', 'sub_category', 'subcategory']),
        productForm: pick(raw, ['productForm', 'product_form', 'form']),
        org: pick(raw, ['organization', 'org', 'company', 'orgName']),
        url: pick(raw, ['officialWebsite', 'url', 'website', 'officialUrl', 'link']),
        imgs: pick(raw, ['imgs', 'images', 'img', 'cover']),
        icon: pick(raw, ['icon', 'field1']),
        content: pick(raw, ['context', 'content', 'detail', 'details', 'body']),
      })
    } catch (e) {
      logger.error('ranking/detail', '获取详情', e)
      Taro.showToast({ title: tt('ranking.detail.loadFailed', '获取详情失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [router.params.id, tt])

  useDidShow(load)

  /** 复制官方网址到剪贴板 */
  const onCopyUrl = useCallback(
    (url: string) => {
      if (!url) return
      Taro.setClipboardData({
        data: url,
        success: () => Taro.showToast({ title: tt('success.copied', '已复制'), icon: 'success' }),
      })
    },
    [tt],
  )

  /** 返回上一页 */
  const backPage = useCallback(() => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.redirectTo({ url: '/pages/ranking/index' })
    })
  }, [])

  const openDrawer = useCallback((mode: DrawerMode) => {
    setDrawerMode(mode)
    setDrawerVisible(true)
  }, [])

  const closeDrawer = useCallback(() => setDrawerVisible(false), [])

  /** 状态文本(2→已发布 / 4→测试中 / 6→已下线 / 其他→未知) */
  const statusText = useMemo(() => {
    const code = String(data.status ?? '')
    const cfg = STATUS_MAP[code]
    if (cfg) return tt(cfg.key, cfg.fallback)
    return tt('ranking.statusUnknown', '未知')
  }, [data.status, tt])

  /** imgs 逗号分隔取第一张,无则取 icon */
  const firstImg = data.imgs ? data.imgs.split(',')[0] : data.icon || ''

  /** 导航栏标题:detailData.title/name/"详情页" */
  const navTitle = data.name || tt('ranking.detailTitle', '详情页')

  if (loading) {
    return (
      <View className="detail-page">
        <View className="detail-nav">
          <View className="detail-nav-back" onClick={backPage}>
            <Text>{'‹'}</Text>
          </View>
          <Text className="detail-nav-title">{tt('ranking.detailTitle', '详情页')}</Text>
        </View>
        <Text className="loading-text">{tt('common.loading', '加载中...')}</Text>
      </View>
    )
  }

  return (
    <View className="detail-page">
      {/* 导航栏(对标原项目:title=detailData.title/name/"详情页", showMenu=true, showFenLei=true) */}
      <View className="detail-nav">
        <View className="detail-nav-back" onClick={backPage}>
          <Text>{'‹'}</Text>
        </View>
        <Text className="detail-nav-title">{navTitle}</Text>
        <View className="detail-nav-actions">
          <View className="detail-nav-btn" onClick={() => openDrawer('fenlei')}>
            <Text>{tt('ranking.fenlei', '分类')}</Text>
          </View>
          <View className="detail-nav-btn" onClick={() => openDrawer('menu')}>
            <Text>{tt('ranking.menu', '菜单')}</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="detail-body">
        {/* row-1:Logo + 标题 + 简介(排名/机构/关注度) */}
        <View className="tech-card head-card">
          {data.logo ? <Image className="logo" src={data.logo} mode="aspectFill" /> : null}
          <View className="head-info">
            <Text className="title text-neon">{data.name || '-'}</Text>
            {data.intro ? <Text className="desc">{data.intro}</Text> : null}
            <View className="head-meta">
              {data.org ? (
                <Text className="head-meta-item">
                  {tt('ranking.detail.org', '所属机构')}: {data.org}
                </Text>
              ) : null}
              {data.attention ? (
                <Text className="head-meta-item">
                  {tt('ranking.detail.attention', '关注度')}: {data.attention}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* row-2:4 列横向信息(关注度/类别/价格/状态) */}
        <View className="info-row">
          <View className="info-cell">
            <Text className="info-label">{tt('ranking.detail.attention', '关注度')}</Text>
            <Text className="info-value">{data.attention || '-'}</Text>
          </View>
          <View className="info-cell">
            <Text className="info-label">{tt('ranking.detail.category', '类别')}</Text>
            <Text className="info-value">{data.category || '-'}</Text>
          </View>
          <View className="info-cell">
            <Text className="info-label">{tt('ranking.detail.price', '价格')}</Text>
            <Text className="info-value">{data.price || '-'}</Text>
          </View>
          <View className="info-cell">
            <Text className="info-label">{tt('ranking.detail.status', '状态')}</Text>
            <Text className="info-value">{statusText}</Text>
          </View>
        </View>

        {/* row-common:细分类别/产品形式/所属机构 */}
        <View className="tech-card field-card">
          <View className="field-item">
            <Text className="field-label">{tt('ranking.detail.subCategory', '细分类别')}</Text>
            <Text className="field-value">{data.subCategory || '-'}</Text>
          </View>
          <View className="field-item">
            <Text className="field-label">{tt('ranking.detail.productForm', '产品形式')}</Text>
            <Text className="field-value">{data.productForm || '-'}</Text>
          </View>
          <View className="field-item">
            <Text className="field-label">{tt('ranking.detail.org', '所属机构')}</Text>
            <Text className="field-value">{data.org || '-'}</Text>
          </View>
        </View>

        {/* 官方网址(点击复制 + "点击复制"提示) */}
        {data.url ? (
          <View className="tech-card field-card" onClick={() => onCopyUrl(data.url!)}>
            <View className="field-item">
              <Text className="field-label">{tt('ranking.detail.url', '官方网址')}</Text>
              <Text className="field-value link-value">{data.url}</Text>
            </View>
            <Text className="copy-hint">{tt('ranking.detail.copyHint', '点击复制')}</Text>
          </View>
        ) : null}

        {/* 图片展示:imgs 逗号分隔取第1张 或 icon */}
        {firstImg ? (
          <View className="tech-card img-card">
            <Image className="cover" src={firstImg} mode="widthFix" />
          </View>
        ) : null}

        {/* 详细介绍文本:context */}
        {data.content ? (
          <View className="tech-card content-card">
            <Text className="content-title text-neon-accent">
              {tt('ranking.detail.contentTitle', '详细介绍')}
            </Text>
            <Text className="content-text">{data.content}</Text>
          </View>
        ) : null}

        <View className="detail-bottom-spacer" />
      </ScrollView>

      {/* 侧边栏抽屉(showMenu/showFenLei 触发,对标原项目 DrawerComponent) */}
      <DrawerComponent visible={drawerVisible} onClose={closeDrawer}>
        <View className="drawer-content">
          <Text className="drawer-title">
            {drawerMode === 'fenlei'
              ? tt('ranking.fenlei', '分类')
              : tt('ranking.menu', '菜单')}
          </Text>
          {relatedList.length ? (
            <ScrollView scrollY className="drawer-list">
              {relatedList.map((it) => {
                const raw = it as Record<string, unknown>
                const name = pick(raw, ['name', 'title'])
                return (
                  <View
                    key={String(it.id)}
                    className="drawer-item"
                    onClick={() => {
                      const itemId = it.id
                      if (itemId === undefined) return
                      closeDrawer()
                      Taro.redirectTo({ url: `/pages/ranking/detail?id=${itemId}` })
                    }}
                  >
                    <Text className="drawer-item-text">{name || '-'}</Text>
                  </View>
                )
              })}
            </ScrollView>
          ) : (
            <Text className="drawer-empty">{tt('ranking.empty', '暂无数据')}</Text>
          )}
        </View>
      </DrawerComponent>
    </View>
  )
}
