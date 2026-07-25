/**
 * 发布平台 i18n key 静态映射表:platforms.${p} — 用于消除 `t(`platforms.${var}`)` 动态拼接
 * 覆盖 PLATFORMS 数组全部 14 个枚值,未知值兜底 'platforms.unknown'
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
