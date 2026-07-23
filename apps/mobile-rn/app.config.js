/**
 * Expo 动态配置(mobile-rn 端)。
 * 读取 app.json 的 extra 字段,注入 react-native-wechat-lib config plugin。
 *
 * 运行时(EAS Build / expo prebuild)会执行本文件,生成原生代码:
 *   - iOS Info.plist + AppDelegate 钩子
 *   - Android AndroidManifest + WXEntryActivity / WXPayEntryActivity
 */
const pkg = require('./package.json')

module.exports = ({ config }) => {
  const appId = config.extra?.WX_APP_APPID
  const universalLink = config.extra?.WX_UNIVERSAL_LINK
  const androidPackage = config.android?.package

  if (!appId || !universalLink || !androidPackage) {
    throw new Error(
      '[app.config] 缺少微信支付配置:app.json 需包含 extra.WX_APP_APPID / extra.WX_UNIVERSAL_LINK / android.package',
    )
  }

  return {
    ...config,
    version: pkg.version,
    plugins: [
      'expo-secure-store',
      ...(config.plugins || []),
      ['./plugins/withWechat', { appId, universalLink, androidPackage }],
    ],
  }
}
