import { ImageResponse } from 'next/og'

// 智汇 AI Open Graph 动态图片(2026-07-27 P1-4 SEO 资产补全)
// Next.js metadata route 约定:放在 app/ 根目录,自动生成 /opengraph-image.png,
// 覆盖 layout.tsx metadata.openGraph.images(无需修改 layout.tsx)
//
// 路径说明:任务清单写的是 src/app/opengraph-image.tsx,但本项目用 app/ 根目录
// (无 src/app/),Next.js 不会从 src/app/ 加载,所以放在 app/ 下才能生效。
//
// output:'export' 模式:OG 图在构建时生成静态 PNG,ImageResponse 在 Node.js 运行,
// 可用 fetch 加载字体。中文需思源黑体(Noto Sans SC),否则渲染为豆腐块。

export const alt = '智汇 AI — 全栈 AI 平台'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// 构建时从 Google Fonts 加载思源黑体(中文支持)
// 失败则回退默认字体(中文可能不渲染,但构建不中断)
async function loadChineseFont(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&display=swap',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    )
    const css = await cssRes.text()
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?woff2['"]?\)/)
    if (!match?.[1]) return null
    const fontRes = await fetch(match[1])
    return await fontRes.arrayBuffer()
  } catch {
    return null
  }
}

export default async function Image() {
  const fontData = await loadChineseFont()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1E3A5F 0%, #6B21A8 100%)',
          fontFamily: fontData ? 'Noto Sans SC' : 'system-ui, sans-serif',
        }}
      >
        {/* Logo:智字 + 圆角背景 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '88px',
            height: '88px',
            borderRadius: '12px',
            backgroundColor: '#FAF8F3',
            fontSize: '52px',
            fontWeight: 700,
            color: '#1E3A5F',
            marginBottom: '40px',
          }}
        >
          智
        </div>

        {/* 主标题 */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 700,
            color: '#FAF8F3',
            marginBottom: '20px',
            lineHeight: 1.2,
          }}
        >
          智汇 AI — 全栈 AI 平台
        </div>

        {/* 副标题 */}
        <div
          style={{
            fontSize: '32px',
            fontWeight: 400,
            color: '#FAF8F3',
            opacity: 0.85,
            marginBottom: '60px',
          }}
        >
          8 端覆盖 · 9 支付网关 · 5 语言 · 开源
        </div>

        {/* 底部域名 */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 500,
            color: '#FAF8F3',
            opacity: 0.7,
            marginTop: 'auto',
          }}
        >
          ihui.ai
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: 'Noto Sans SC', data: fontData, weight: 700 }] : undefined,
    },
  )
}
