import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/user/'] },
    sitemap: 'https://ihui.ai/sitemap.xml',
  }
}
