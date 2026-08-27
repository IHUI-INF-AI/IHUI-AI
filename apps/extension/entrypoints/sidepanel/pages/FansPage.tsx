/**
 * FansPage — 我的粉丝(/me/fans,2026-08-21 立)。
 * 展示关注当前用户的粉丝列表,数据来自 GET /api/follows/followers。
 */
import { Heart } from 'lucide-react'
import { getFans } from '@ihui/api-client'
import { FollowListPage } from '../components/FollowListPage'

export default function FansPage() {
  return (
    <FollowListPage
      titleKey="apps.fans"
      emptyKey="page.follow.emptyFans"
      icon={Heart}
      fetchList={getFans}
    />
  )
}
