// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, type TtFn } from '@/i18n'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getVipPrivilege, getVipInfo, type VipInfo } from '@/api'
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
  {
    label: 'vip.privilege.matrixModelAccess',
    values: [
      'vip.privilege.matrixBasic',
      'vip.privilege.matrixAdvanced',
      'vip.privilege.matrixAdvanced',
      'vip.privilege.matrixAll',
    ],
  },
  { label: 'vip.privilege.matrixExclusiveService', values: ['×', '×', '✓', '✓'] },
  {
    label: 'vip.privilege.matrixCourseDiscount',
    values: ['vip.privilege.matrixNone', '9', '8', '7'],
  },
  { label: 'vip.privilege.matrixAgentCount', values: ['3', '10', '30', '∞'] },
  {
    label: 'vip.privilege.matrixPrice',
    values: ['vip.privilege.matrixFree', '¥30', '¥88', '¥299'],
  },
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
const MATRIX_FALLBACK = (tt: TtFn): Record<string, string> => ({
  'vip.privilege.matrixDailyChats': tt('vipPrivilege.d1', '每日对话次数'),
  'vip.privilege.matrixModelAccess': tt('vip.details.features.modelAccess', '模型访问'),
  'vip.privilege.matrixBasic': tt('vipPrivilege.d2', '基础'),
  'vip.privilege.matrixAdvanced': tt('vipPrivilege.d3', '进阶'),
  'vip.privilege.matrixAll': tt('common.all', '全部'),
  'vip.privilege.matrixExclusiveService': tt('memberBenefits.d31', '专属客服'),
  'vip.privilege.matrixCourseDiscount': tt('vipPrivilege.d5', '课程折扣(折)'),
  'vip.privilege.matrixNone': tt('devEnter.cover.noWebsite', '无'),
  'vip.privilege.matrixAgentCount': tt('vipPrivilege.d6', '智能体数量'),
  'vip.privilege.matrixPrice': tt('devEnter.modelEdit.priceLabel', '价格'),
  'vip.privilege.matrixFree': tt('common.free', '免费'),
})

const BENEFIT_FALLBACK = (tt: TtFn): Record<string, string> => ({
  'vip.privilege.traderBenefit1': tt('vipPrivilege.d7', '专属市场数据分析工具'),
  'vip.privilege.traderBenefit2': tt('vipPrivilege.d8', '一对一专业指导服务'),
  'vip.privilege.traderBenefit3': tt('vipPrivilege.d9', '实时行情预警推送'),
  'vip.privilege.traderBenefit4': tt('vipPrivilege.d10', '操盘策略专属课程'),
  'vip.privilege.traderBenefit5': tt('vipPrivilege.d11', '优先参与平台活动'),
  'vip.privilege.privateBenefit1': tt('vipPrivilege.d12', '一对一专属顾问'),
  'vip.privilege.privateBenefit2': tt('vipPrivilege.d13', '闭门沙龙参与权'),
  'vip.privilege.privateBenefit3': tt('vipPrivilege.d14', '行业大咖私密交流'),
  'vip.privilege.privateBenefit4': tt('vipPrivilege.d15', '高端资源对接'),
  'vip.privilege.privateBenefit5': tt('vipPrivilege.d16', '定制化解决方案'),
})

export default function PrivilegePage() {
  const tt = useTt()
  const router = useRouter()
  const [list, setList] = useState<Privilege[]>([])
  const [loading, setLoading] = useState(true)
  const [vipInfo, setVipInfo] = useState<VipInfo | null>(null)
  const [popup, setPopup] = useState<PopupType>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [privRes, info] = await Promise.all([getVipPrivilege(), getVipInfo().catch(() => null)])
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
          <Image
            className="level-icon"
            src="/static/images/icons/star-fill.svg"
            mode="aspectFit"
            style={{ width: '32rpx', height: '32rpx' }}
          />
          <View className={`level-badge ${isOpened ? '' : 'closed'}`}>{levelName}</View>
        </View>
        {isOpened && vipInfo?.expireTime ? (
          <Text className="header-expire">
            {tt('vip.privilege.expireTime', '到期时间')}：{vipInfo.expireTime}
          </Text>
        ) : (
          <Text className="header-expire">
            {tt('vip.privilege.openHint', '开通会员享受全部权益')}
          </Text>
        )}
      </View>

      {/* 3 个入口卡片 */}
      <View className="entry-section">
        <View className="entry-card" onClick={() => setPopup('level')}>
          <Image
            className="entry-icon"
            src="/static/images/icons/gem.svg"
            mode="aspectFit"
            style={{ width: '32rpx', height: '32rpx' }}
          />
          <Text className="entry-title">{tt('vip.privilege.levelIntro', '会员等级介绍')}</Text>
        </View>
        <View className="entry-card" onClick={() => setPopup('trader')}>
          <Image
            className="entry-icon"
            src="/static/images/icons/chevron-up.svg"
            mode="aspectFit"
            style={{ width: '32rpx', height: '32rpx' }}
          />
          <Text className="entry-title">{tt('vip.privilege.traderIntro', '操盘手介绍')}</Text>
        </View>
        <View className="entry-card" onClick={() => setPopup('privateAdvisory')}>
          <Image
            className="entry-icon"
            src="/static/images/icons/radio.svg"
            mode="aspectFit"
            style={{ width: '32rpx', height: '32rpx' }}
          />
          <Text className="entry-title">{tt('vip.privilege.privateAdvisory', '私董会权益')}</Text>
        </View>
      </View>

      {/* 权益列表 */}
      <Text className="section-title">{tt('vip.privilege.privilegeList', '专属权益')}</Text>
      <View className="privilege-list">
        {list.map((p) => (
          <View key={p.id} className="privilege-card">
            <Image
              className="privilege-icon"
              src="/static/images/icons/star-fill.svg"
              mode="aspectFit"
              style={{ width: '32rpx', height: '32rpx' }}
            />
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
              <Text className="popup-close" onClick={() => setPopup(null)}>
                ×
              </Text>
            </View>
            <View className="popup-body">
              <View className="matrix">
                <View className="matrix-row header-row">
                  <Text className="matrix-cell label">
                    {tt('vip.privilege.matrixBenefit', '权益')}
                  </Text>
                  <Text className="matrix-cell level-cell">
                    {tt('vip.privilege.levelNormal', '普通')}
                  </Text>
                  <Text className="matrix-cell level-cell">
                    {tt('vip.privilege.levelMonth', '月度')}
                  </Text>
                  <Text className="matrix-cell level-cell">
                    {tt('vip.privilege.levelQuarter', '季度')}
                  </Text>
                  <Text className="matrix-cell level-cell">
                    {tt('vip.privilege.levelYear', '年度')}
                  </Text>
                </View>
                {LEVEL_MATRIX.map((row) => (
                  <View key={row.label} className="matrix-row">
                    <Text className="matrix-cell label">
                      {tt(row.label, MATRIX_FALLBACK(tt)[row.label] || row.label)}
                    </Text>
                    {row.values.map((v, i) => (
                      <Text key={i} className={`matrix-cell ${i === 3 ? 'highlight' : ''}`}>
                        {v.startsWith('vip.privilege.') ? tt(v, MATRIX_FALLBACK(tt)[v] || v) : v}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
              <Text className="matrix-desc">
                {tt(
                  'vip.privilege.matrixDesc',
                  '1元=1点成长值，升级会员享受更高权益。全部课程/算力/自动化智能体/知识库/定制服务等，持续增加功能。',
                )}
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
              <Text className="popup-close" onClick={() => setPopup(null)}>
                ×
              </Text>
            </View>
            <View className="popup-body">
              <Text className="benefit-intro">
                {tt(
                  'vip.privilege.traderDesc',
                  '操盘手是平台认证的专业市场分析角色，享有专属数据工具与一对一指导服务。',
                )}
              </Text>
              <View className="benefit-list">
                {TRADER_BENEFITS.map((key) => (
                  <View key={key} className="benefit-item">
                    <Image
                      className="benefit-check"
                      src="/static/images/icons/check.svg"
                      mode="aspectFit"
                      style={{ width: '24rpx', height: '24rpx' }}
                    />
                    <Text className="benefit-text">
                      {tt(key, BENEFIT_FALLBACK(tt)[key] || key)}
                    </Text>
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
              <Text className="popup-title">
                {tt('vip.privilege.privateAdvisory', '私董会权益')}
              </Text>
              <Text className="popup-close" onClick={() => setPopup(null)}>
                ×
              </Text>
            </View>
            <View className="popup-body">
              <Text className="benefit-intro">
                {tt(
                  'vip.privilege.privateAdvisoryDesc',
                  '私董会是平台最高端会员圈层，汇聚行业大咖，享有一对一顾问与闭门沙龙参与权。',
                )}
              </Text>
              <View className="benefit-list">
                {PRIVATE_BENEFITS.map((key) => (
                  <View key={key} className="benefit-item">
                    <Image
                      className="benefit-check"
                      src="/static/images/icons/check.svg"
                      mode="aspectFit"
                      style={{ width: '24rpx', height: '24rpx' }}
                    />
                    <Text className="benefit-text">
                      {tt(key, BENEFIT_FALLBACK(tt)[key] || key)}
                    </Text>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
