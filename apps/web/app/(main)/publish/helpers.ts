/**
 * 发布平台 i18n key 静态映射表:platforms.{p}
 * 覆盖 PLATFORMS 数组全部 14 个枚值,未知值兜底 'platforms.unknown'
 * 用于消除 platforms.{var} 形式的动态拼接
 */
export const PLATFORM_KEY: Record<string, string> = {
  wordpress: 'platforms.wordpress',
  medium: 'platforms.medium',
  youtube: 'platforms.youtube',
  bilibili: 'platforms.bilibili',
  wechat: 'platforms.wechat',
  toutiao: 'platforms.toutiao',
  douyin: 'platforms.douyin',
  kuaishou: 'platforms.kuaishou',
  weibo: 'platforms.weibo',
  zhihu: 'platforms.zhihu',
  csdn: 'platforms.csdn',
  juejin: 'platforms.juejin',
  xiaohongshu: 'platforms.xiaohongshu',
  shipinhao: 'platforms.shipinhao',
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
