/**
 * FollowingPage — 我的关注(/me/following,2026-08-21 立)。
 * 展示当前用户关注的用户列表,数据来自 GET /api/follows/following。
 */
import { getFollowing } from '@ihui/api-client'
import { FollowListPage } from '../components/FollowListPage'

export default function FollowingPage() {
  return (
    <FollowListPage
      titleKey="apps.following"
      emptyKey="page.follow.emptyFollowing"
      icon="👥"
      fetchList={getFollowing}
    />
  )
}
