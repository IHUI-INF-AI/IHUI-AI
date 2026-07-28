/**
 * OPML 2.0 订阅源大纲(2026-07-26 立,补齐订阅协议矩阵):
 * 遵循 [OPML 2.0 规范](https://opml.org/spec2.opml)。
 *
 * 把所有 IHUI AI 订阅源聚合成一份 OPML 索引,用户可一键导入到
 * Feedly / Inoreader / NetNewsWire / Reeder 等阅读器。
 *
 * 4 大分组:
 *   1. 主订阅源(RSS / Atom / JSON Feed)
 *   2. 实时推送(WebSub Hub)
 *   3. 搜索引擎专用(image-sitemap / news-sitemap)
 *   4. 5 语言版本(GEO 分发)
 *
 * 路由:/opml
 * 缓存:6 小时(OPML 是静态大纲,变更频率低)
 */

// 2026-07-26:Next.js output:'export' 静态导出模式要求所有 Route Handler
// 必须显式声明 force-static,否则构建报错。
export const dynamic = 'force-static'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://aizhs.top'
const BUILD_DATE = new Date().toUTCString()

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 一个 outline 节点
function outline(
  type: string,
  text: string,
  xmlUrl: string,
  htmlUrl: string,
  description: string,
  language: string,
): string {
  return `      <outline type="${escapeAttr(type)}" text="${escapeAttr(text)}" title="${escapeAttr(text)}" xmlUrl="${escapeAttr(xmlUrl)}" htmlUrl="${escapeAttr(htmlUrl)}" description="${escapeAttr(description)}" language="${escapeAttr(language)}" version="RSS2" />`
}

function group(title: string, description: string, children: string[]): string {
  return `    <outline text="${escapeAttr(title)}" title="${escapeAttr(title)}" description="${escapeAttr(description)}">
${children.join('\n')}
    </outline>`
}

export async function GET() {
  // === 1. 主订阅源 ===
  const mainFeeds = group(
    '主订阅源 / Main Feeds',
    '智汇 AI 主订阅源:产品页、对比页、用例页、GEO 文件',
    [
      outline(
        'rss',
        '智汇 AI RSS 2.0',
        `${SITE_URL}/rss.xml`,
        `${SITE_URL}/`,
        '智汇 AI(IHUI AI)全栈 AI 操作系统主 RSS 订阅',
        'zh-cn',
      ),
      outline(
        'atom',
        '智汇 AI Atom 1.0',
        `${SITE_URL}/atom.xml`,
        `${SITE_URL}/`,
        '智汇 AI(IHUI AI)Atom 订阅',
        'zh-cn',
      ),
      outline(
        'json',
        '智汇 AI JSON Feed 1.1',
        `${SITE_URL}/feed.json`,
        `${SITE_URL}/`,
        '智汇 AI(IHUI AI)JSON Feed 订阅',
        'zh-cn',
      ),
    ],
  )

  // === 2. 实时推送 ===
  const websubGroup = group(
    '实时推送 / WebSub',
    'WebSub (PubSubHubbub) Hub,订阅后可实时接收 feed 更新通知',
    [
      outline(
        'websub',
        '智汇 AI WebSub Hub',
        `${SITE_URL}/websub`,
        `${SITE_URL}/`,
        'WebSub Hub 端点,可向此 URL 发起 hub.mode=subscribe 订阅',
        'zh-cn',
      ),
    ],
  )

  // === 3. 搜索引擎专用 ===
  const searchGroup = group(
    '搜索引擎 / Sitemaps',
    'sitemap 文件供 Google / Bing / 神马 / 搜狗 / 360 抓取',
    [
      outline(
        'sitemap',
        '智汇 AI 主 sitemap',
        `${SITE_URL}/sitemap.xml`,
        `${SITE_URL}/`,
        '智汇 AI 主站点地图,40+ 核心公开页 + 5 语言 hreflang',
        'zh-cn',
      ),
      outline(
        'sitemap',
        '智汇 AI 图片 sitemap',
        `${SITE_URL}/image-sitemap.xml`,
        `${SITE_URL}/`,
        '智汇 AI 图片站点地图,Google Images 抓取专用',
        'zh-cn',
      ),
      outline(
        'sitemap-news',
        '智汇 AI 新闻 sitemap',
        `${SITE_URL}/news-sitemap.xml`,
        `${SITE_URL}/`,
        '智汇 AI 新闻站点地图,Google News 收录',
        'zh-cn',
      ),
    ],
  )

  // === 4. 5 语言版本 ===
  const langFeeds = [
    {
      lang: 'zh-CN',
      title: '智汇 AI 简体中文',
      desc: '简体中文主订阅源',
    },
    {
      lang: 'zh-TW',
      title: '智匯 AI 繁體中文',
      desc: '繁體中文訂閱源',
    },
    {
      lang: 'en',
      title: 'IHUI AI English',
      desc: 'English feed',
    },
    {
      lang: 'ja',
      title: 'IHUI AI 日本語',
      desc: '日本語フィード',
    },
    {
      lang: 'ko',
      title: 'IHUI AI 한국어',
      desc: '한국어 피드',
    },
  ]
  const i18nGroup = group(
    '多语言 / i18n',
    '5 语言订阅源,适配各 GEO 区域',
    langFeeds.map((l) =>
      outline(
        'json',
        l.title,
        `${SITE_URL}/feed.json?lang=${l.lang}`,
        `${SITE_URL}/${l.lang === 'zh-CN' ? 'zh-cn' : l.lang === 'zh-TW' ? 'zh-tw' : l.lang}`,
        l.desc,
        l.lang === 'zh-CN'
          ? 'zh-cn'
          : l.lang === 'zh-TW'
            ? 'zh-tw'
            : l.lang === 'en'
              ? 'en-us'
              : l.lang === 'ja'
                ? 'ja-jp'
                : 'ko-kr',
      ),
    ),
  )

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>智汇 AI 订阅源大纲 / IHUI AI Subscription Outline</title>
    <dateCreated>${BUILD_DATE}</dateCreated>
    <dateModified>${BUILD_DATE}</dateModified>
    <ownerName>IHUI AI Team</ownerName>
    <ownerEmail>contact@aizhs.top</ownerEmail>
    <docs>http://opml.org/spec2.opml</docs>
  </head>
  <body>
${mainFeeds}
${websubGroup}
${searchGroup}
${i18nGroup}
  </body>
</opml>`

  return new Response(opml, {
    headers: {
      'Content-Type': 'text/x-opml; charset=utf-8',
      'Cache-Control': 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400',
      'Content-Disposition': 'inline; filename="ihui-ai.opml"',
      'X-Build-Date': BUILD_DATE,
    },
  })
}
