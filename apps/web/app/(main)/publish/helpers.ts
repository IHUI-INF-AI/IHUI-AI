/**
 * 发布平台 i18n key 静态映射表:platforms.{p}
 * 覆盖 PLATFORM_SCHEMAS 数组全部 37 个枚值,未知值兜底 'platforms.unknown'
 * 用于消除 platforms.{var} 形式的动态拼接
 *
 * 平台分组:
 *   - 国际 3:wordpress / medium / youtube
 *   - 视频 6:bilibili / douyin / kuaishou / xigua / haokan / shipinhao
 *   - 图文社交 4:wechat / toutiao / weibo / xiaohongshu
 *   - 技术社区 7:zhihu / csdn / juejin / cnblogs / segmentfault / oschina / jianshu
 *   - 六大号 6:baijiahao / qq / dayihao / netease / sohu / sina
 *   - SEO/GEO 第二批 12:baidu_zhidao / baidu_tieba / douban / 36kr / huxiu / tmtmedia / acfun / lofter / zhihu_daily / people / china_news / hupu
 */
export const PLATFORM_KEY: Record<string, string> = {
  // 国际平台
  wordpress: 'platforms.wordpress',
  medium: 'platforms.medium',
  youtube: 'platforms.youtube',
  // 视频平台
  bilibili: 'platforms.bilibili',
  douyin: 'platforms.douyin',
  kuaishou: 'platforms.kuaishou',
  xigua: 'platforms.xigua',
  haokan: 'platforms.haokan',
  shipinhao: 'platforms.shipinhao',
  // 图文社交
  wechat: 'platforms.wechat',
  toutiao: 'platforms.toutiao',
  weibo: 'platforms.weibo',
  xiaohongshu: 'platforms.xiaohongshu',
  // 技术社区
  zhihu: 'platforms.zhihu',
  csdn: 'platforms.csdn',
  juejin: 'platforms.juejin',
  cnblogs: 'platforms.cnblogs',
  segmentfault: 'platforms.segmentfault',
  oschina: 'platforms.oschina',
  jianshu: 'platforms.jianshu',
  // 六大号
  baijiahao: 'platforms.baijiahao',
  qq: 'platforms.qq',
  dayihao: 'platforms.dayihao',
  netease: 'platforms.netease',
  sohu: 'platforms.sohu',
  sina: 'platforms.sina',
  // SEO/GEO 第二批平台
  baidu_zhidao: 'platforms.baidu_zhidao',
  baidu_tieba: 'platforms.baidu_tieba',
  douban: 'platforms.douban',
  '36kr': 'platforms.36kr',
  huxiu: 'platforms.huxiu',
  tmtmedia: 'platforms.tmtmedia',
  acfun: 'platforms.acfun',
  lofter: 'platforms.lofter',
  zhihu_daily: 'platforms.zhihu_daily',
  people: 'platforms.people',
  china_news: 'platforms.china_news',
  hupu: 'platforms.hupu',
}

/**
 * 发布内容格式 i18n key 静态映射表:new.contentFormat{F}
 * 用于消除 new.contentFormat{f} 首字母大写形式的动态拼接
 * 未知值兜底 'new.contentFormatUnknown'
 */
export const CONTENT_FORMAT_KEY: Record<string, string> = {
  md: 'new.contentFormatMd',
  docx: 'new.contentFormatDocx',
  html: 'new.contentFormatHtml',
  pdf: 'new.contentFormatPdf',
  image: 'new.contentFormatImage',
  video: 'new.contentFormatVideo',
}
