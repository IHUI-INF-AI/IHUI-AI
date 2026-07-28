import { ImageResponse } from 'next/og'

export const alt = 'IHUI AI'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-static'

export default async function Image() {
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
          fontFamily: 'system-ui, sans-serif',
        }}
      >
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
          IHUI
        </div>
        <div
          style={{
            fontSize: '64px',
            fontWeight: 700,
            color: '#FAF8F3',
            marginBottom: '20px',
            lineHeight: 1.2,
          }}
        >
          IHUI AI - Full-Stack AI Platform
        </div>
        <div
          style={{
            fontSize: '32px',
            fontWeight: 400,
            color: '#FAF8F3',
            opacity: 0.85,
            marginBottom: '60px',
          }}
        >
          8 Platforms · 100+ LLMs · Open Source
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 500,
            color: '#FAF8F3',
            opacity: 0.7,
            marginTop: 'auto',
          }}
        >
          aizhs.top
        </div>
      </div>
    ),
    { ...size },
  )
}
