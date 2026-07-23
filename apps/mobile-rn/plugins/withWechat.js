/**
 * react-native-wechat-lib Expo Config Plugin(mobile-rn 端)。
 *
 * 作用:EAS Build / expo prebuild 时自动配置微信支付所需的原生代码,无需 eject:
 *   iOS:
 *     - Info.plist 补 LSApplicationQueriesSchemes(wechat)+ CFBundleURLTypes(微信 URL Scheme)
 *     - AppDelegate 注入 WXApi handleOpenURL + handleOpenUniversalLink 钩子
 *   Android:
 *     - AndroidManifest.xml 声明 WXEntryActivity / WXPayEntryActivity
 *     - 写入 .wxapi.WXEntryActivity.java / .wxapi.WXPayEntryActivity.java
 *
 * 参数(由 app.config.js 从 app.json extra 读取注入):
 *   - appId          微信开放平台移动应用 AppID
 *   - universalLink  iOS UniversalLink(需与 associatedDomains 的 applinks: 域名一致)
 *   - androidPackage Android applicationId(= config.android.package)
 */
const { withInfoPlist, withAndroidManifest, withDangerousMod, withAppDelegate } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const SCHEMES = ['weixin', 'wechat', 'weixinULAPI']

/** iOS:补 LSApplicationQueriesSchemes + CFBundleURLTypes */
function withWechatInfoPlist(config, { appId }) {
  return withInfoPlist(config, (mod) => {
    const plist = mod.modResults
    // LSApplicationQueriesSchemes:确保包含 weixin/wechat/weixinULAPI
    const existing = new Set(plist.LSApplicationQueriesSchemes || [])
    for (const s of SCHEMES) existing.add(s)
    plist.LSApplicationQueriesSchemes = [...existing]
    // CFBundleURLTypes:微信 URL Scheme(微信 SDK 通过 URL Scheme 回调 app)
    const types = plist.CFBundleURLTypes || []
    if (!types.some((t) => (t.CFBundleURLName || '') === 'weixin')) {
      types.push({
        CFBundleURLName: 'weixin',
        CFBundleURLSchemes: [appId],
      })
      plist.CFBundleURLTypes = types
    }
    return mod
  })
}

/** iOS:AppDelegate 注入 WXApi 钩子(ObjC++) */
function withWechatAppDelegate(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'objcpp') return mod
    let src = mod.modResults.contents
    // 1. 顶部 import(去重)
    if (!src.includes('#import "WXApi.h"')) {
      src = src.replace(
        /(#import .*?$)/m,
        `$1\n#import "WXApi.h"\n#import <React/RCTLinkingManager.h>`,
      )
    }
    // 2. application:openURL:options: 追加 WXApi handleOpenURL
    if (!src.includes('WXApi handleOpenURL')) {
      const openUrlPattern =
        /(-\s*\(BOOL\)application:\(UIApplication \*\)application\s+openURL:\(NSURL \*\)url\s+options:\(NSDictionary<UIApplicationOpenURLOptionsKey,id> \*\)options\s*\{[\s\S]*?\})/
      const openUrlHook = `
  // 微信 SDK:URL Scheme 回调
  if ([WXApi handleOpenURL:url delegate:self]) {
    return YES;
  }`
      if (openUrlPattern.test(src)) {
        src = src.replace(openUrlPattern, (m, p1) => p1.replace(/\}\s*$/, `${openUrlHook}\n}`))
      }
    }
    // 3. application:continueUserActivity:restorationHandler: 追加 WXApi handleOpenUniversalLink
    if (!src.includes('WXApi handleOpenUniversalLink')) {
      const continuePattern =
        /(-\s*\(BOOL\)application:\(UIApplication \*\)application\s+continueUserActivity:\(NSUserActivity \*\)userActivity\s+restorationHandler:.*?\{[\s\S]*?\})/
      const continueHook = `
  // 微信 SDK:Universal Link 回调(支付完成后回到 app)
  if ([WXApi handleOpenUniversalLink:userActivity delegate:self]) {
    return YES;
  }`
      if (continuePattern.test(src)) {
        src = src.replace(continuePattern, (m, p1) => p1.replace(/\}\s*$/, `${continueHook}\n}`))
      }
    }
    mod.modResults.contents = src
    return mod
  })
}

/** Android:写入 WXEntryActivity.java + WXPayEntryActivity.java */
function withWechatAndroidJava(config, { androidPackage }) {
  const pkgPath = androidPackage.replace(/\./g, '/')
  const wxEntryJava = `package ${androidPackage}.wxapi;

import android.content.Intent;
import android.os.Bundle;
import com.wechatlib.WeChatLibModule;

public class WXEntryActivity extends android.app.Activity {
  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    WeChatLibModule.handleIntent(getIntent());
    finish();
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WeChatLibModule.handleIntent(getIntent());
    finish();
  }
}
`
  const wxPayEntryJava = `package ${androidPackage}.wxapi;

import android.content.Intent;
import android.os.Bundle;
import com.wechatlib.WeChatLibModule;

public class WXPayEntryActivity extends android.app.Activity {
  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    WeChatLibModule.handleIntent(getIntent());
    finish();
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WeChatLibModule.handleIntent(getIntent());
    finish();
  }
}
`
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      // Expo prebuild 时,android 项目根在 modConfig._modSourcePath 或 modConfig.platformProjectRoot
      const projRoot =
        modConfig._modSourcePath ||
        modConfig.platformProjectRoot ||
        modConfig.modRequest?.platformProjectRoot ||
        ''
      if (!projRoot) {
        console.warn(
          '[withWechat] 跳过 WXEntryActivity 生成:无法获取项目根路径,modConfig keys:',
          Object.keys(modConfig),
        )
        return modConfig
      }
      const wxapiDir = path.join(projRoot, 'app', 'src', 'main', 'java', pkgPath, 'wxapi')
      fs.mkdirSync(wxapiDir, { recursive: true })
      fs.writeFileSync(path.join(wxapiDir, 'WXEntryActivity.java'), wxEntryJava)
      fs.writeFileSync(path.join(wxapiDir, 'WXPayEntryActivity.java'), wxPayEntryJava)
      return modConfig
    },
  ])
}

/** Android:AndroidManifest.xml 声明 WXEntryActivity / WXPayEntryActivity */
function withWechatAndroidManifest(config, { androidPackage }) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults
    const application = manifest.manifest.application[0]
    if (!application.activity) application.activity = []
    const activities = application.activity
    const has = (name) => activities.some((a) => a.$['android:name'] === name)
    // WXEntryActivity(微信分享/登录回调)
    if (!has('.wxapi.WXEntryActivity')) {
      activities.push({
        $: {
          'android:name': '.wxapi.WXEntryActivity',
          'android:exported': 'true',
          'android:launchMode': 'singleTask',
          'android:taskAffinity': androidPackage,
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        },
      })
    }
    // WXPayEntryActivity(微信支付回调)
    if (!has('.wxapi.WXPayEntryActivity')) {
      activities.push({
        $: {
          'android:name': '.wxapi.WXPayEntryActivity',
          'android:exported': 'true',
          'android:launchMode': 'singleTop',
        },
      })
    }
    return mod
  })
}

module.exports = function withWechat(config, props) {
  const { appId, universalLink, androidPackage } = props || {}
  if (!appId) throw new Error('[withWechat] 缺少 appId(微信开放平台 AppID)')
  if (!universalLink) throw new Error('[withWechat] 缺少 universalLink(iOS UniversalLink)')
  if (!androidPackage) throw new Error('[withWechat] 缺少 androidPackage(android.package)')
  config = withWechatInfoPlist(config, { appId })
  config = withWechatAppDelegate(config)
  config = withWechatAndroidManifest(config, { androidPackage })
  config = withWechatAndroidJava(config, { androidPackage })
  return config
}
