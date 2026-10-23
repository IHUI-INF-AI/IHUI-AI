// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/cart/CartScreen.tsx
// 逐元素同形:页头标题 → 商品行(勾选框 | 封面/Package 兜底 | 标题+价格+数量增减 | 删除图标)
// → 空态三分支(加载 / cart.loadFailed+重试 / cart.empty+购物车图标)→ 底部合计栏
// (全选勾选框 + cart.selectAll | cart.total + 合计 | cart.checkout(件数) 主 CTA)。
// 平台特有:依赖 Taro API(showModal/showToast/useDidShow);返回键走原生导航栏,故页内不渲染 BackChevron。
// 字段兜底映射与 RN 端共用 @ihui/api-client normalizeCartGoods(单一真相源,端内不再抄第二份)。
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { normalizeCartGoods, type CartGoods } from '@ihui/api-client'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import './index.css'

interface CartItem {
  id: string
  title: string
  coverUrl: string
  price: number
  quantity: number
  selected: boolean
}

export default function Cart() {
  const { t } = useI18n()
  const [list, setList] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = (await api.selectGoods({ page: 1, pageSize: 50 })) as Record<string, unknown>
      const rawList = (res?.list as CartGoods[] | undefined) ?? []
      setList(
        rawList.map((item) => ({ ...normalizeCartGoods(item, t('cart.product')), selected: true })),
      )
    } catch (e) {
      logger.error('cart', 'load', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => {
    loadData()
  })

  const onQuantityChange = useCallback((id: string, delta: number) => {
    setList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    )
  }, [])

  const onToggleItem = useCallback((id: string) => {
    setList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
  }, [])

  const allSelected = list.length > 0 && list.every((item) => item.selected)
  const onToggleAll = useCallback(() => {
    setList((prev) => prev.map((item) => ({ ...item, selected: !allSelected })))
  }, [allSelected])

  /** 删除确认(与 RN 端 appAlert 同款语义;确认后进删除 + toast) */
  const onRemove = useCallback(
    (id: string) => {
      Taro.showModal({
        title: t('common.hint'),
        content: t('cart.deleteConfirm'),
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (res.confirm) {
            setList((prev) => prev.filter((item) => item.id !== id))
            Taro.showToast({ title: t('success.deleted'), icon: 'success' })
          }
        },
      })
    },
    [t],
  )

  const { totalCount, totalPrice } = useMemo(() => {
    let count = 0
    let price = 0
    list.forEach((item) => {
      if (item.selected) {
        count += item.quantity
        price += item.quantity * item.price
      }
    })
    return { totalCount: count, totalPrice: price }
  }, [list])

  // 平台特有:小程序端结算腿尚未接入微信支付,保持"开发中"提示口径
  const onCheckout = useCallback(() => {
    if (totalCount === 0) {
      Taro.showToast({ title: t('cart.selectFirst'), icon: 'none' })
      return
    }
    Taro.showToast({ title: t('cart.checkoutToast'), icon: 'none' })
  }, [totalCount, t])

  return (
    <ThemeRoot>
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('cart.title')}</Text>
        </View>
        <View className="page-content">
          {list.length ? (
            list.map((item) => (
              <View key={item.id} className="cart-item">
                <View
                  className={`checkbox ${item.selected ? 'checked' : ''}`}
                  onClick={() => onToggleItem(item.id)}
                  hoverClass="opacity-60"
                >
                  {item.selected ? (
                    <LineIcon name="check" size={24} color="var(--color-surface-light)" />
                  ) : null}
                </View>
                {item.coverUrl ? (
                  <Image className="cart-item-cover" src={item.coverUrl} mode="aspectFill" />
                ) : (
                  <View className="cart-item-cover placeholder">
                    <LineIcon name="package" size={44} color="var(--color-muted-foreground)" />
                  </View>
                )}
                <View className="cart-item-info">
                  <Text className="cart-item-title">{item.title}</Text>
                  <Text className="cart-item-price">¥{item.price.toFixed(2)}</Text>
                  <View className="quantity-control">
                    <View
                      className={`quantity-btn ${item.quantity <= 1 ? 'disabled' : ''}`}
                      onClick={() => item.quantity > 1 && onQuantityChange(item.id, -1)}
                    >
                      <LineIcon
                        name="minus"
                        size={28}
                        color={
                          item.quantity <= 1
                            ? 'var(--color-text-tertiary)'
                            : 'var(--color-muted-foreground)'
                        }
                      />
                    </View>
                    <Text className="quantity-value">{item.quantity}</Text>
                    <View className="quantity-btn" onClick={() => onQuantityChange(item.id, 1)}>
                      <LineIcon name="plus" size={28} color="var(--color-muted-foreground)" />
                    </View>
                  </View>
                </View>
                <View
                  className="cart-item-delete"
                  onClick={() => onRemove(item.id)}
                  hoverClass="opacity-60"
                >
                  <LineIcon name="trash-2" size={36} color="var(--color-danger)" />
                </View>
              </View>
            ))
          ) : loading ? (
            <View className="empty-wrapper">
              <Text className="loading-text">{t('cart.loading')}</Text>
            </View>
          ) : error ? (
            <View className="empty-wrapper">
              <Text className="empty-text">{t('cart.loadFailed')}</Text>
              <Text className="btn" onClick={loadData}>
                {t('common.retry')}
              </Text>
            </View>
          ) : (
            <View className="empty-wrapper">
              <LineIcon
                className="empty-icon"
                name="shopping-cart"
                size={80}
                color="var(--color-text-tertiary)"
              />
              <Text className="empty-text">{t('cart.empty')}</Text>
            </View>
          )}
        </View>
        {list.length > 0 && (
          <View className="cart-footer">
            <View
              className={`checkbox ${allSelected ? 'checked' : ''}`}
              onClick={onToggleAll}
              hoverClass="opacity-60"
            >
              {allSelected ? (
                <LineIcon name="check" size={24} color="var(--color-surface-light)" />
              ) : null}
            </View>
            <Text className="select-all-label" onClick={onToggleAll}>
              {t('cart.selectAll')}
            </Text>
            <View className="footer-total">
              <Text className="total-label">{t('cart.total')}:</Text>
              <Text className="total-price">¥{totalPrice.toFixed(2)}</Text>
            </View>
            <Text
              className={`btn checkout-btn ${totalCount === 0 ? 'disabled' : ''}`}
              onClick={onCheckout}
            >
              {t('cart.checkout')}({totalCount})
            </Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
