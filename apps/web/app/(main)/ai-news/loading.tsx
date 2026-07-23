/**
 * ai-news 页面骨架屏。
 *
 * Server Component(page.tsx)并行获取 6 组数据期间显示,
 * 与 page.tsx 的 8 个组件结构对应,减少感知加载时间。
 * 纯视觉占位,无 i18n 需求。
 */

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-skeleton-pulse rounded-xl border bg-card ${className}`}
      aria-hidden
    />
  )
}

export default function AiNewsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6">
      {/* Hero */}
      <SkeletonCard className="h-[140px] md:h-[160px]" />
      {/* Leaderboard */}
      <SkeletonCard className="h-[400px]" />
      {/* ApiRelaysSection */}
      <SkeletonCard className="h-[200px]" />
      {/* LiveChannelsBlock */}
      <SkeletonCard className="h-[280px]" />
      {/* AiFeedTimeline */}
      <SkeletonCard className="h-[500px]" />
      {/* HotRanking + FundingSection */}
      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonCard className="h-[240px]" />
        <SkeletonCard className="h-[240px]" />
      </div>
      {/* CtaSection */}
      <SkeletonCard className="h-[120px]" />
    </div>
  )
}
