import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface CartItem {
  id: string
  title: string
  coverUrl?: string
  price: number
  quantity: number
  selected: boolean
}

export default function Cart() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [list, setList] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const touchStartX = useRef(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = (await api.selectGoods({ page: 1, pageSize: 50 })) as Record<string, unknown>
      const rawList = (res?.list as Record<string, unknown>[]) || []
      setList(
        rawList.map((item, idx) => ({
          id: String(item.id ?? idx),
          title:
            (item.title as string) ||
            (item.name as string) ||
            (item.productName as string) ||
            t('cart.product'),
          coverUrl:
            (item.coverUrl as string) ||
            (item.image as string) ||
            (item.img as string) ||
            (item.pic as string) ||
            '',
          price: Number(item.price ?? item.amount ?? 0),
          quantity: Number(item.quantity ?? item.num ?? item.count ?? 1) || 1,
          selected: true,
        })),
      )
    } catch (e) {
      logger.error('cart', '加载购物车', e)
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

  const onRemove = useCallback(
    (id: string) => {
      Taro.showModal({
        title: t('common.hint'),
        content: tt('cart.deleteConfirm', '确定要删除该商品吗?'),
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (res.confirm) {
            setList((prev) => prev.filter((item) => item.id !== id))
            setSwipedId(null)
            Taro.showToast({ title: t('success.deleted'), icon: 'success' })
          }
        },
      })
    },
    [t, tt],
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

  const onCheckout = useCallback(() => {
    if (totalCount === 0) {
      Taro.showToast({ title: tt('cart.selectFirst', '请选择商品'), icon: 'none' })
      return
    }
    Taro.showToast({ title: t('cart.checkoutToast'), icon: 'none' })
  }, [totalCount, t, tt])

  const handleTouchStart = (e: unknown) => {
    const evt = e as { touches: Array<{ clientX: number }> }
    touchStartX.current = evt.touches[0]?.clientX ?? 0
  }
  const handleTouchEnd = (e: unknown, id: string) => {
    const evt = e as { changedTouches: Array<{ clientX: number }> }
    const endX = evt.changedTouches[0]?.clientX ?? 0
    const delta = endX - touchStartX.current
    if (delta < -30) setSwipedId(id)
    else if (delta > 30) setSwipedId(null)
  }

  if (loading && list.length === 0) {
    return (
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('cart.title')}</Text>
        </View>
        <View className="page-content">
          <Text className="loading-text">{t('cart.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error && list.length === 0) {
    return (
      <View className="page-container">
        <View className="page-header">
          <Text className="page-title">{t('cart.title')}</Text>
        </View>
        <View className="page-content">
          <Text className="empty-text">{tt('cart.loadFailed', '加载失败')}</Text>
          <Text className="btn" onClick={loadData}>
            {t('common.retry')}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('cart.title')}</Text>
      </View>
      <View className="page-content">
        {list.length ? (
          list.map((item) => (
            <View key={item.id} className="cart-item-wrapper">
              <View
                className={`cart-item ${swipedId === item.id ? 'swiped' : ''}`}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, item.id)}
              >
                <View
                  className={`checkbox ${item.selected ? 'checked' : ''}`}
                  onClick={() => onToggleItem(item.id)}
                >
                  {item.selected ? <Text className="checkbox-icon">✓</Text> : null}
                </View>
                {item.coverUrl ? (
                  <Image className="cart-item-cover" src={item.coverUrl} mode="aspectFill" />
                ) : (
                  <View className="cart-item-cover placeholder">
                    <Text className="placeholder-icon">📦</Text>
                  </View>
                )}
                <View className="cart-item-info">
                  <Text className="cart-item-title">{item.title}</Text>
                  <Text className="cart-item-price">¥{item.price.toFixed(2)}</Text>
                  <View className="quantity-control">
                    <Text
                      className={`quantity-btn ${item.quantity <= 1 ? 'disabled' : ''}`}
                      onClick={() => item.quantity > 1 && onQuantityChange(item.id, -1)}
                    >
                      −
                    </Text>
                    <Text className="quantity-value">{item.quantity}</Text>
                    <Text
                      className="quantity-btn"
                      onClick={() => onQuantityChange(item.id, 1)}
                    >
                      +
                    </Text>
                  </View>
                </View>
              </View>
              <View className="cart-item-delete-action" onClick={() => onRemove(item.id)}>
                <Text className="delete-action-text">{t('common.delete')}</Text>
              </View>
            </View>
          ))
        ) : (
          <View className="empty-wrapper">
            <Text className="empty-icon">🛒</Text>
            <Text className="empty-text">{t('cart.empty')}</Text>
          </View>
        )}
      </View>
      {list.length > 0 && (
        <View className="cart-footer">
          <View className={`checkbox ${allSelected ? 'checked' : ''}`} onClick={onToggleAll}>
            {allSelected ? <Text className="checkbox-icon">✓</Text> : null}
          </View>
          <Text className="select-all-label" onClick={onToggleAll}>
            {t('common.all')}
          </Text>
          <View className="footer-total">
            <Text className="total-label">{tt('cart.total', '合计')}:</Text>
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
  )
}
