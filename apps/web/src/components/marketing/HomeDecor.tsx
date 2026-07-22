'use client'

/**
 * Hero 区装饰光斑 — 增强视觉层次,打破"纯文字卡片"单调感。
 *
 * 设计:
 * - 3 个 radial-gradient 圆形光斑,使用 primary 色透明渐变
 * - 各自不同的 animate-float-orb / animate-glowFloat 缓动循环
 * - pointer-events-none + absolute,不影响交互
 * - z-index: 0(在 Hero 内容下方,Hero 内容用 relative z-10)
 *
 * 守门:
 * - 不用 mask-image(禁止渐变遮罩规则)
 * - 不用 rounded-full(圆角守门:radial-gradient 配 blur-3xl 已自然呈现圆形)
 * - 不用蓝色发光边框(用 primary 透明渐变)
 * - 不影响布局(pointer-events-none + absolute)
 */
export function HomeDecor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* 左上角光斑 - primary 主色调 */}
      <div
        className="absolute -left-20 -top-20 h-72 w-72 opacity-40 blur-3xl animate-float-orb"
        style={{
          background:
            'radial-gradient(circle, hsl(142 71% 45% / 0.35), transparent 70%)',
        }}
      />
      {/* 右下角光斑 - 较小的 primary 辅助色 */}
      <div
        className="absolute -bottom-16 -right-16 h-64 w-64 opacity-30 blur-3xl animate-glowFloat"
        style={{
          background:
            'radial-gradient(circle, hsl(142 71% 55% / 0.3), transparent 70%)',
        }}
      />
      {/* 中部偏右小光斑 - emerald 强调色 */}
      <div
        className="absolute top-1/3 right-1/4 h-48 w-48 opacity-25 blur-3xl animate-orb-float"
        style={{
          background:
            'radial-gradient(circle, hsl(160 70% 50% / 0.3), transparent 70%)',
        }}
      />
      {/* 顶部细线网格装饰 - 极淡 */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(0 0% 0%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 0%) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  )
}
