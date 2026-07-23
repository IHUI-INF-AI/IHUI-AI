import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getRankingList } from '@/api'
import { useI18n } from '@/i18n'
import './detail.css'

// 排行榜详情数据(字段从列表项中筛选,后端无单条详情接口)
interface RankingDetail {
  id?: string | number
  logo?: string
  name?: string
  desc?: string
  attention?: string | number
  category?: string
  price?: string
  status?: string
  subCategory?: string
  productForm?: string
  org?: string
  url?: string
  imgs?: string
  content?: string
}

// 排行榜原始列表项(后端字段命名不统一,pick 函数兼容多命名)
interface RankingRawItem {
  id?: string | number
  [key: string]: unknown
}

// 排行榜列表响应(对标后端 GET /ranking 返回结构)
interface RankingListResponse {
  list: RankingRawItem[]
  total?: number
  myRank?: number
}

// 取字段值,兼容后端返回的多种命名
const pick = (obj: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

export default function RankingDetailPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [data, setData] = useState<RankingDetail>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) {
      setLoading(false)
      return
    }
    try {
      const res = (await getRankingList()) as RankingListResponse
      const list = res?.list || []
      const item = list.find((it) => String(it.id) === String(id)) || ({} as RankingRawItem)
      const raw: Record<string, unknown> = item
      setData({
        id: raw.id as string | number,
        logo: pick(raw, ['logo', 'icon', 'avatar']),
        name: pick(raw, ['name', 'title']),
        desc: pick(raw, ['desc', 'description', 'intro', 'summary']),
        attention: pick(raw, ['attention', 'follow', 'hot', 'views']),
        category: pick(raw, ['category', 'cate', 'type']),
        price: pick(raw, ['price', 'cost']),
        status: pick(raw, ['status', 'state']),
        subCategory: pick(raw, ['subCategory', 'sub_category', 'subcategory']),
        productForm: pick(raw, ['productForm', 'product_form', 'form']),
        org: pick(raw, ['org', 'company', 'organization', 'orgName']),
        url: pick(raw, ['url', 'website', 'officialUrl', 'link']),
        imgs: pick(raw, ['imgs', 'images', 'img', 'cover']),
        content: pick(raw, ['content', 'detail', 'details', 'body']),
      })
    } catch (e) {
      logger.error('ranking/detail', '获取详情', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [router.params.id, t])

  useDidShow(load)

  // 复制官方网址到剪贴板
  const onCopyUrl = useCallback(
    (url: string) => {
      if (!url) return
      Taro.setClipboardData({
        data: url,
        success: () => Taro.showToast({ title: t('success.copied'), icon: 'success' }),
      })
    },
    [t],
  )

  // imgs 逗号分隔取第一张
  const firstImg = data.imgs ? data.imgs.split(',')[0] : ''

  if (loading) {
    return (
      <View className="detail-page">
        <Text className="loading-text">{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View className="detail-page">
      {/* 第一行:Logo + 标题和简介 */}
      <View className="tech-card head-card">
        {data.logo ? (
          <Image className="logo" src={data.logo} mode="aspectFill" />
        ) : null}
        <View className="head-info">
          <Text className="title text-neon">{data.name || '-'}</Text>
          {data.desc ? <Text className="desc">{data.desc}</Text> : null}
        </View>
      </View>

      {/* 第二行:4 列横向信息 */}
      <View className="info-row">
        <View className="info-cell">
          <Text className="info-label">关注度</Text>
          <Text className="info-value">{data.attention || '-'}</Text>
        </View>
        <View className="info-cell">
          <Text className="info-label">类别</Text>
          <Text className="info-value">{data.category || '-'}</Text>
        </View>
        <View className="info-cell">
          <Text className="info-label">价格</Text>
          <Text className="info-value">{data.price || '-'}</Text>
        </View>
        <View className="info-cell">
          <Text className="info-label">状态</Text>
          <Text className="info-value">{data.status || '-'}</Text>
        </View>
      </View>

      {/* 细分类别 / 产品形式 / 所属机构 */}
      <View className="tech-card field-card">
        <View className="field-item">
          <Text className="field-label">细分类别</Text>
          <Text className="field-value">{data.subCategory || '-'}</Text>
        </View>
        <View className="field-item">
          <Text className="field-label">产品形式</Text>
          <Text className="field-value">{data.productForm || '-'}</Text>
        </View>
        <View className="field-item">
          <Text className="field-label">所属机构</Text>
          <Text className="field-value">{data.org || '-'}</Text>
        </View>
      </View>

      {/* 官方网址(点击复制) */}
      {data.url ? (
        <View className="tech-card field-card" onClick={() => onCopyUrl(data.url!)}>
          <View className="field-item">
            <Text className="field-label">官方网址</Text>
            <Text className="field-value link-value">{data.url}</Text>
          </View>
          <Text className="copy-hint">点击复制</Text>
        </View>
      ) : null}

      {/* 图片 */}
      {firstImg ? (
        <View className="tech-card img-card">
          <Image className="cover" src={firstImg} mode="widthFix" />
        </View>
      ) : null}

      {/* 详细介绍 */}
      {data.content ? (
        <View className="tech-card content-card">
          <Text className="content-title text-neon-accent">详细介绍</Text>
          <Text className="content-text">{data.content}</Text>
        </View>
      ) : null}
    </View>
  )
}
