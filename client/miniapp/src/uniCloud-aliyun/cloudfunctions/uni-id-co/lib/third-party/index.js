const WxAccount = require('./weixin/account/index')
const QQAccount = require('./qq/account/index')
const AppleAccount = require('./apple/account/index')

const createApi = require('./share/create-api')

module.exports = {
  initWeixin: function () {
    const oauthConfig = this.configUtils.getOauthConfig({ provider: 'weixin' })
    return createApi(WxAccount, {
      appId: oauthConfig.appid,
      secret: oauthConfig.appsecret
    })
  },
  initQQ: function () {
    const oauthConfig = this.configUtils.getOauthConfig({ provider: 'qq' })
    return createApi(QQAccount, {
      appId: oauthConfig.appid,
      secret: oauthConfig.appsecret
    })
  },
  initApple: function () {
    const oauthConfig = this.configUtils.getOauthConfig({ provider: 'apple' })
    return createApi(AppleAccount, {
      bundleId: oauthConfig.bundleId
    })
  }
}
