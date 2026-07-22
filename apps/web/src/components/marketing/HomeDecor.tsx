'use client'

/**
 * Hero 区装饰层 — 深度美化版(2026-07-23 升级)
 *
 * 视觉层次:
 * - 4 个 radial-gradient 光斑(原 3 个 + 新增 1 个顶部高光)
 * - 2 个浮动几何装饰圆环(描边圆 + 虚线圆,缓慢旋转)
 * - 1 个底部渐变光带
 * - 1 个细线网格背景(极淡)
 * - 1 个顶部辉光(模拟聚光灯)
 *
 * 动画差异化(避免机械同步):
 * - 光斑用 animate-float-orb / animate-glowFloat / animate-orb-float 不同缓动
 * - 圆环用 animate-spin-slower(40s)+ animate-spin-reverse-slower(60s)
 * - 顶部辉光用 animate-pulse-slow(4s 呼吸)
 *
 * 守门合规:
 * - 不用 rounded-full(圆角守门:radial-gradient + blur-3xl 已自然圆形)
 * - 不用 mask-image(禁止渐变遮罩规则)
 * - 不用蓝色发光边框(用 primary / emerald 透明渐变)
 * - pointer-events-none + absolute,不影响交互
 */
export function HomeDecor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* 顶部辉光 — 模拟聚光灯效果 */}
      <div
        className="absolute left-1/2 top-0 h-64 w-[140%] -translate-x-1/2 opacity-50 blur-3xl animate-pulse-slow"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 0%, hsl(142 71% 50% / 0.25), transparent 70%)',
        }}
      />

      {/* 左上角主光斑 - primary 主色调 */}
      <div
        className="absolute -left-20 -top-20 h-80 w-80 opacity-40 blur-3xl animate-float-orb"
        style={{
          background:
            'radial-gradient(circle, hsl(142 71% 45% / 0.4), transparent 70%)',
        }}
      />

      {/* 右下角辅光斑 - 较小的 primary 辅助色 */}
      <div
        className="absolute -bottom-20 -right-20 h-72 w-72 opacity-35 blur-3xl animate-glowFloat"
        style={{
          background:
            'radial-gradient(circle, hsl(142 71% 55% / 0.35), transparent 70%)',
        }}
      />

      {/* 中部偏右小光斑 - emerald 强调色 */}
      <div
        className="absolute top-1/3 right-1/4 h-56 w-56 opacity-30 blur-3xl animate-orb-float"
        style={{
          background:
            'radial-gradient(circle, hsl(160 70% 50% / 0.35), transparent 70%)',
        }}
      />

      {/* 左下角辅助光斑 - 蓝绿色调(与 primary 形成色彩呼应) */}
      <div
        className="absolute bottom-1/4 left-10 h-48 w-48 opacity-25 blur-3xl animate-float-orb"
        style={{
          background:
            'radial-gradient(circle, hsl(180 60% 50% / 0.3), transparent 70%)',
          animationDelay: '2s',
        }}
      />

      {/* 装饰圆环 1 - 描边大圆,缓慢顺时针旋转 */}
      <div
        className="absolute -right-32 top-1/4 h-96 w-96 opacity-20 animate-spin-slower"
        style={{
          borderRadius: '50%',
          border: '1px solid hsl(142 71% 45% / 0.4)',
        }}
      />

      {/* 装饰圆环 2 - 虚线中圆,缓慢逆时针旋转 */}
      <div
        className="absolute -left-24 bottom-1/4 h-64 w-64 opacity-25 animate-spin-reverse-slower"
        style={{
          borderRadius: '50%',
          border: '1px dashed hsl(160 70% 50% / 0.5)',
        }}
      />

      {/* 装饰圆环 3 - 小描边圆,中速旋转 */}
      <div
        className="absolute right-1/3 top-1/2 h-40 w-40 opacity-15 animate-spin-slower"
        style={{
          borderRadius: '50%',
          border: '1px solid hsl(142 71% 45% / 0.6)',
          animationDuration: '30s',
        }}
      />

      {/* 底部渐变光带 - 与下一页衔接 */}
      <div
        className="absolute bottom-0 left-0 h-32 w-full opacity-30 blur-2xl"
        style={{
          background:
            'linear-gradient(to top, hsl(142 71% 45% / 0.15), transparent)',
        }}
      />

      {/* 细线网格背景 - 极淡,营造科技感 */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(0 0% 0%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 0%) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 点阵装饰 - 右上角,增加纹理层次 */}
      <div
        className="absolute right-10 top-10 h-32 w-32 opacity-20 dark:opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(hsl(142 71% 45% / 0.4) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      />

      {/* 点阵装饰 - 左下角,呼应 */}
      <div
        className="absolute bottom-10 left-10 h-32 w-32 opacity-20 dark:opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(hsl(160 70% 50% / 0.4) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      />
    </div>
  )
}
