import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getVipPrivilege, getVipInfo, type VipInfo } from '@/api'
import { useI18n } from '@/i18n'
import './privilege.css'

interface Privilege {
  id: string
  title: string
  desc: string
}

type PopupType = 'level' | 'trader' | 'privateAdvisory' | null

/** 等级对比矩阵数据（硬编码，无需额外 API） */
const LEVEL_MATRIX = [
  { label: 'vip.privilege.matrixDailyChats', values: ['10', '100', '300', '∞'] },
  { label: 'vip.privilege.matrixModelAccess', values: ['vip.privilege.matrixBasic', 'vip.privilege.matrixAdvanced', 'vip.privilege.matrixAdvanced', 'vip.privilege.matrixAll'] },
  { label: 'vip.privilege.matrixExclusiveService', values: ['×', '×', '✓', '✓'] },
  { label: 'vip.privilege.matrixCourseDiscount', values: ['vip.privilege.matrixNone', '9', '8', '7'] },
  { label: 'vip.privilege.matrixAgentCount', values: ['3', '10', '30', '∞'] },
  { label: 'vip.privilege.matrixPrice', values: ['vip.privilege.matrixFree', '¥30', '¥88', '¥299'] },
]

const TRADER_BENEFITS = [
  'vip.privilege.traderBenefit1',
  'vip.privilege.traderBenefit2',
  'vip.privilege.traderBenefit3',
  'vip.privilege.traderBenefit4',
  'vip.privilege.traderBenefit5',
]

const PRIVATE_BENEFITS = [
  'vip.privilege.privateBenefit1',
  'vip.privilege.privateBenefit2',
  'vip.privilege.privateBenefit3',
  'vip.privilege.privateBenefit4',
  'vip.privilege.privateBenefit5',
]

/** 矩阵/权益项中文 fallback(i18n 缺失时显示) */
const MATRIX_FALLBACK: Record<string, string> = {
  'vip.privilege.matrixDailyChats': '每日对话次数',
  'vip.privilege.matrixModelAccess': '模型访问',
  'vip.privilege.matrixBasic': '基础',
  'vip.privilege.matrixAdvanced': '进阶',
  'vip.privilege.matrixAll': '全部',
  'vip.privilege.matrixExclusiveService': '专属客服',
  'vip.privilege.matrixCourseDiscount': '课程折扣(折)',
  'vip.privilege.matrixNone': '无',
  'vip.privilege.matrixAgentCount': '智能体数量',
  'vip.privilege.matrixPrice': '价格',
  'vip.privilege.matrixFree': '免费',
}

const BENEFIT_FALLBACK: Record<string, string> = {
  'vip.privilege.traderBenefit1': '专属市场数据分析工具',
  'vip.privilege.traderBenefit2': '一对一专业指导服务',
  'vip.privilege.traderBenefit3': '实时行情预警推送',
  'vip.privilege.traderBenefit4': '操盘策略专属课程',
  'vip.privilege.traderBenefit5': '优先参与平台活动',
  'vip.privilege.privateBenefit1': '一对一专属顾问',
  'vip.privilege.privateBenefit2': '闭门沙龙参与权',
  'vip.privilege.privateBenefit3': '行业大咖私密交流',
  'vip.privilege.privateBenefit4': '高端资源对接',
  'vip.privilege.privateBenefit5': '定制化解决方案',
}

export default function PrivilegePage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }
  const router = useRouter()
  const [list, setList] = useState<Privilege[]>([])
  const [loading, setLoading] = useState(true)
  const [vipInfo, setVipInfo] = useState<VipInfo | null>(null)
  const [popup, setPopup] = useState<PopupType>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [privRes, info] = await Promise.all([
        getVipPrivilege(),
        getVipInfo().catch(() => null),
      ])
      setList((privRes.list || []) as Privilege[])
      if (info) setVipInfo(info)
    } catch {
      // 静默失败，列表留空
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())

  /** 进入页面时根据 ?type= 自动弹起对应弹窗 */
  useEffect(() => {
    const type = router.params.type
    if (type === 'level' || type === 'trader' || type === 'privateAdvisory') {
      setPopup(type)
    }
  }, [router.params.type])

  const goUpgrade = useCallback(() => {
    Taro.navigateTo({ url: '/pages/vip/index' })
  }, [])

  const levelName = (() => {
    if (!vipInfo || !vipInfo.level) return tt('vip.privilege.notOpened', '未开通会员')
    const name = vipInfo.name
    if (name) return name
    const map: Record<number, string> = {
      1: tt('vip.privilege.levelMonth', '月度会员'),
      2: tt('vip.privilege.levelQuarter', '季度会员'),
      3: tt('vip.privilege.levelYear', '年度会员'),
    }
    return map[vipInfo.level] || tt('vip.privilege.levelNormal', '普通会员')
  })()

  const isOpened = !!(vipInfo && vipInfo.level)

  return (
    <View className="page">
      {/* 顶部会员等级展示区 */}
      <View className="header">
        <Text className="header-title">{tt('vip.privilege.title', '会员权益')}</Text>
        <View className="header-level-row">
          <Text className="level-icon">★</Text>
          <View className={`level-badge ${isOpened ? '' : 'closed'}`}>{levelName}</View>
        </View>
        {isOpened && vipInfo?.expireTime ? (
          <Text className="header-expire">
            {tt('vip.privilege.expireTime', '到期时间')}：{vipInfo.expireTime}
          </Text>
        ) : (
          <Text className="header-expire">{tt('vip.privilege.openHint', '开通会员享受全部权益')}</Text>
        )}
      </View>

      {/* 3 个入口卡片 */}
      <View className="entry-section">
        <View className="entry-card" onClick={() => setPopup('level')}>
          <Text className="entry-icon">◆</Text>
          <Text className="entry-title">{tt('vip.privilege.levelIntro', '会员等级介绍')}</Text>
        </View>
        <View className="entry-card" onClick={() => setPopup('trader')}>
          <Text className="entry-icon">▲</Text>
          <Text className="entry-title">{tt('vip.privilege.traderIntro', '操盘手介绍')}</Text>
        </View>
        <View className="entry-card" onClick={() => setPopup('privateAdvisory')}>
          <Text className="entry-icon">●</Text>
          <Text className="entry-title">{tt('vip.privilege.privateAdvisory', '私董会权益')}</Text>
        </View>
      </View>

      {/* 权益列表 */}
      <Text className="section-title">{tt('vip.privilege.privilegeList', '专属权益')}</Text>
      <View className="privilege-list">
        {list.map((p) => (
          <View key={p.id} className="privilege-card">
            <Text className="privilege-icon">★</Text>
            <View className="privilege-body">
              <Text className="privilege-title">{p.title}</Text>
              <Text className="privilege-desc">{p.desc}</Text>
            </View>
          </View>
        ))}
        {!loading && !list.length ? (
          <View className="empty-state">
            <Text>{tt('vip.privilege.empty', '暂无权益')}</Text>
          </View>
        ) : null}
      </View>

      {/* 底部升级按钮 */}
      <View className="bottom-bar">
        <Button className="upgrade-btn" onClick={goUpgrade}>
          {tt('vip.privilege.upgrade', '立即升级')}
        </Button>
      </View>

      {/* 弹窗1: 会员等级介绍 */}
      {popup === 'level' && (
        <View className="popup-mask" onClick={() => setPopup(null)}>
          <View className="popup-card" onClick={(e) => e.stopPropagation()}>
            <View className="popup-header">
              <Text className="popup-title">{tt('vip.privilege.levelIntro', '会员等级介绍')}</Text>
              <Text className="popup-close" onClick={() => setPopup(null)}>×</Text>
            </View>
            <View className="popup-body">
              <View className="matrix">
                <View className="matrix-row header-row">
                  <Text className="matrix-cell label">{tt('vip.privilege.matrixBenefit', '权益')}</Text>
                  <Text className="matrix-cell level-cell">{tt('vip.privilege.levelNormal', '普通')}</Text>
                  <Text className="matrix-cell level-cell">{tt('vip.privilege.levelMonth', '月度')}</Text>
                  <Text className="matrix-cell level-cell">{tt('vip.privilege.levelQuarter', '季度')}</Text>
                  <Text className="matrix-cell level-cell">{tt('vip.privilege.levelYear', '年度')}</Text>
                </View>
                {LEVEL_MATRIX.map((row) => (
                  <View key={row.label} className="matrix-row">
                    <Text className="matrix-cell label">{tt(row.label, MATRIX_FALLBACK[row.label] || row.label)}</Text>
                    {row.values.map((v, i) => (
                      <Text key={i} className={`matrix-cell ${i === 3 ? 'highlight' : ''}`}>
                        {v.startsWith('vip.privilege.') ? tt(v, MATRIX_FALLBACK[v] || v) : v}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
              <Text className="matrix-desc">
                {tt('vip.privilege.matrixDesc', '1元=1点成长值，升级会员享受更高权益。全部课程/算力/自动化智能体/知识库/定制服务等，持续增加功能。')}
              </Text>
            </View>
            <View className="popup-footer">
              <Button className="popup-action-btn" onClick={goUpgrade}>
                {tt('vip.privilege.goOpen', '去开通')}
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 弹窗2: 操盘手介绍 */}
      {popup === 'trader' && (
        <View className="popup-mask" onClick={() => setPopup(null)}>
          <View className="popup-card" onClick={(e) => e.stopPropagation()}>
            <View className="popup-header">
              <Text className="popup-title">{tt('vip.privilege.traderIntro', '操盘手介绍')}</Text>
              <Text className="popup-close" onClick={() => setPopup(null)}>×</Text>
            </View>
            <View className="popup-body">
              <Text className="benefit-intro">
                {tt('vip.privilege.traderDesc', '操盘手是平台认证的专业市场分析角色，享有专属数据工具与一对一指导服务。')}
              </Text>
              <View className="benefit-list">
                {TRADER_BENEFITS.map((key) => (
                  <View key={key} className="benefit-item">
                    <Text className="benefit-check">✓</Text>
                    <Text className="benefit-text">{tt(key, BENEFIT_FALLBACK[key] || key)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View className="popup-footer">
              <Button className="popup-action-btn" onClick={goUpgrade}>
                {tt('vip.privilege.goOpen', '去开通')}
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 弹窗3: 私董会介绍 */}
      {popup === 'privateAdvisory' && (
        <View className="popup-mask" onClick={() => setPopup(null)}>
          <View className="popup-card" onClick={(e) => e.stopPropagation()}>
            <View className="popup-header">
              <Text className="popup-title">{tt('vip.privilege.privateAdvisory', '私董会权益')}</Text>
              <Text className="popup-close" onClick={() => setPopup(null)}>×</Text>
            </View>
            <View className="popup-body">
              <Text className="benefit-intro">
                {tt('vip.privilege.privateAdvisoryDesc', '私董会是平台最高端会员圈层，汇聚行业大咖，享有一对一顾问与闭门沙龙参与权。')}
              </Text>
              <View className="benefit-list">
                {PRIVATE_BENEFITS.map((key) => (
                  <View key={key} className="benefit-item">
                    <Text className="benefit-check">✓</Text>
                    <Text className="benefit-text">{tt(key, BENEFIT_FALLBACK[key] || key)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View className="popup-footer">
              <Button className="popup-action-btn" onClick={goUpgrade}>
                {tt('vip.privilege.goOpen', '去开通')}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
