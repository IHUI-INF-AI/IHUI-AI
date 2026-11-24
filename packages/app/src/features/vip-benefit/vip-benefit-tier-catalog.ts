// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { AppIcon } from '@ihui/types'
import {
  Award,
  Cake,
  CalendarCheck,
  Crown,
  Gift,
  Headset,
  Layers,
  Mail,
  Medal,
  Rocket,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Truck,
} from 'lucide-react-native'

interface TierBenefit {
  icon: AppIcon
  titleKey: string
  descKey: string
}

interface TierCatalog {
  icon: AppIcon
  nameKey: string
  benefits: readonly TierBenefit[]
}

/**
 * 等级权益目录 —— 与端内 pages/member/benefits 的四档目录逐条对应(档名/权益名/权益说明)。
 * 文案一律取 `member.benefits.tier.*` / `member.benefits.b.*` 键(与端内同一套键、值逐字一致);
 * 图标走 lucide,RN 端不再复制端内那批 PNG 资源。
 */
export const TIERS: readonly TierCatalog[] = [
  {
    icon: Star,
    nameKey: 'member.benefits.tier.normal',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD1',
      },
      {
        icon: Sparkles,
        titleKey: 'member.benefits.b.points',
        descKey: 'member.benefits.b.pointsD1',
      },
      { icon: Gift, titleKey: 'member.benefits.b.gift', descKey: 'member.benefits.b.giftD' },
      {
        icon: CalendarCheck,
        titleKey: 'member.benefits.b.sign',
        descKey: 'member.benefits.b.signD',
      },
      { icon: Mail, titleKey: 'member.benefits.b.news', descKey: 'member.benefits.b.newsD' },
    ],
  },
  {
    icon: Medal,
    nameKey: 'member.benefits.tier.silver',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD2',
      },
      {
        icon: Layers,
        titleKey: 'member.benefits.b.pointsMul',
        descKey: 'member.benefits.b.pointsMulD2',
      },
      {
        icon: Cake,
        titleKey: 'member.benefits.b.birthday',
        descKey: 'member.benefits.b.birthdayD',
      },
      {
        icon: Truck,
        titleKey: 'member.benefits.b.shipping',
        descKey: 'member.benefits.b.shippingD2',
      },
      { icon: Ticket, titleKey: 'member.benefits.b.coupon', descKey: 'member.benefits.b.couponD2' },
      {
        icon: CalendarCheck,
        titleKey: 'member.benefits.b.sign',
        descKey: 'member.benefits.b.signD2',
      },
    ],
  },
  {
    icon: Award,
    nameKey: 'member.benefits.tier.gold',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD3',
      },
      {
        icon: Layers,
        titleKey: 'member.benefits.b.pointsMul',
        descKey: 'member.benefits.b.pointsMulD3',
      },
      {
        icon: Cake,
        titleKey: 'member.benefits.b.birthday',
        descKey: 'member.benefits.b.birthdayD3',
      },
      {
        icon: Truck,
        titleKey: 'member.benefits.b.shipping',
        descKey: 'member.benefits.b.shippingD3',
      },
      {
        icon: Headset,
        titleKey: 'member.benefits.b.service',
        descKey: 'member.benefits.b.serviceD',
      },
      { icon: Ticket, titleKey: 'member.benefits.b.coupon', descKey: 'member.benefits.b.couponD3' },
      {
        icon: Rocket,
        titleKey: 'member.benefits.b.preview',
        descKey: 'member.benefits.b.previewD',
      },
    ],
  },
  {
    icon: Crown,
    nameKey: 'member.benefits.tier.diamond',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD4',
      },
      {
        icon: Layers,
        titleKey: 'member.benefits.b.pointsMul',
        descKey: 'member.benefits.b.pointsMulD4',
      },
      {
        icon: Cake,
        titleKey: 'member.benefits.b.birthday',
        descKey: 'member.benefits.b.birthdayD4',
      },
      {
        icon: Truck,
        titleKey: 'member.benefits.b.shipping',
        descKey: 'member.benefits.b.shippingD4',
      },
      {
        icon: Headset,
        titleKey: 'member.benefits.b.service',
        descKey: 'member.benefits.b.serviceD4',
      },
      { icon: Ticket, titleKey: 'member.benefits.b.coupon', descKey: 'member.benefits.b.couponD4' },
      {
        icon: Rocket,
        titleKey: 'member.benefits.b.preview',
        descKey: 'member.benefits.b.previewD4',
      },
      { icon: Trophy, titleKey: 'member.benefits.b.event', descKey: 'member.benefits.b.eventD' },
    ],
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
