/**
 * useExtensionThirdPartyAuth — 扩展端三方登录 hook(2026-07-26 立)
 *
 * 为 @ihui/ui-react.LoginForm 注入 ThirdPartyConfig,让 popup + sidepanel
 * 跟 web 端 LoginDialog 一样展示 8 个三方登录按钮(Google/Apple/钉钉/
 * 企业微信/微信/GitHub/飞书/支付宝),视觉"一模一样"。
 *
 * 扩展端三方登录的实际执行策略(2026-07-26,简化版):
 *   点击三方按钮 → chrome.tabs.create 打开 web 端登录页对应平台
 *   (https://www.ihui.ai/?from=extension&platform=google)
 *   → web 端走原生 useThirdPartyAuth 流程完成 OAuth
 *   → token 写入扩展 storage(web 端通过 content script 桥接,后续任务)
 *   → 扩展端 popup 重新打开时已登录
 *
 *   本版本只做"打开 web 端 OAuth 页"这一最小动作,token 桥接由后续 task 完成。
 *   视觉/结构上 100% 与 web 端 ThirdPartyLoginButtons 一致(8 个平台 + 同图标 + 同禁用规则)。
 *
 * 平台启用判断(2026-07-26 立,跟 web 端 getPlatformConfig 对齐):
 *   - enabled=false → forceDisabled(灰)
 *   - Apple 暂未上线 → forceDisabled(灰)
 *   - 图标用扩展端本地 /images/oauth-providers/*.svg(/web 是同源,扩展不能跨域)
 *   - 文案:从 chrome.i18n.getMessage 或本地 i18n 拿(这里用 i18n 拿)
 */
import * as React from 'react'
import type {
  ThirdPartyConfig,
  ThirdPartyPlatform,
  ThirdPartyProvider,
} from '@ihui/ui-react'
import { useI18n } from '../i18n'

/** web 端登录页 URL(三方登录的"目的地") */
const WEB_SIGNIN_URL = 'https://www.ihui.ai/'

/** 扩展端本地 oauth-provider 图标(从 web 端 public/images/oauth-providers 复制) */
const ICONS: Record<ThirdPartyPlatform, string> = {
  wechat: '/images/oauth-providers/wechat.svg',
  google: '/images/oauth-providers/google.svg',
  github: '/images/oauth-providers/github.svg',
  feishu: '/images/oauth-providers/feishu.png',
  dingtalk: '/images/oauth-providers/dingtalk.svg',
  enterpriseWechat: '/images/oauth-providers/wecom.svg',
  alipay: '/images/oauth-providers/alipay.svg',
  apple: '/images/oauth-providers/apple.svg',
}

/** i18n key 映射(从 web 端 auth 命名空间) */
const LABEL_KEYS: Record<ThirdPartyPlatform, string> = {
  wechat: 'auth.wechatLogin',
  google: 'auth.googleLogin',
  github: 'auth.githubLogin',
  feishu: 'auth.feishuLogin',
  dingtalk: 'auth.dingtalkLogin',
  enterpriseWechat: 'auth.enterpriseWechat',
  alipay: 'auth.alipayLogin',
  apple: 'auth.appleLogin',
}

/**
 * 检查平台是否启用(2026-07-26 立)
 *
 * 优先读 chrome.storage.local 的 'ihui.thirdparty.enabled' 缓存(由 web 端登录页注入),
 * 缓存不存在时默认全部启用。
 *
 * 简化策略:本次不实现 storage 缓存,默认全启用。
 * Apple 登录 forceDisabled 始终为 true(跟 web 端一致,2026-07-26 之后)。
 */
function isPlatformEnabledDefault(_platform: ThirdPartyPlatform): boolean {
  return true
}

interface UseExtensionThirdPartyAuthReturn {
  /** 构造 ThirdPartyConfig(给 LoginForm 注入) */
  config: ThirdPartyConfig
  /** 单平台点击处理(已封装,可不直接用) */
  startLogin: (platform: ThirdPartyPlatform) => Promise<void>
}

/**
 * 扩展端三方登录 hook(2026-07-26 立)
 *
 * 用法:
 *   const { config } = useExtensionThirdPartyAuth()
 *   <LoginForm ... thirdParty={config} ... />
 */
export function useExtensionThirdPartyAuth(): UseExtensionThirdPartyAuthReturn {
  const { t } = useI18n()
  const [currentPlatform, setCurrentPlatform] = React.useState<ThirdPartyPlatform | null>(null)

  const startLogin = React.useCallback(async (platform: ThirdPartyPlatform) => {
    setCurrentPlatform(platform)
    try {
      // 关闭 popup(避免 OAuth 重定向时留下空白 popup)
      // 然后在新 tab 打开 web 端登录页,带 from + platform 参数
      const url = `${WEB_SIGNIN_URL}?from=extension&platform=${platform}`
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        await chrome.tabs.create({ url })
        // popup 自己关掉
        window.close()
      } else {
        // 兜底:非 chrome 环境(测试用),用 window.open
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } finally {
      // 注意:这里实际上页面已经跳转/关闭,setCurrentPlatform 不一定会执行
      setCurrentPlatform((cur) => (cur === platform ? null : cur))
    }
  }, [])

  /**
   * 8 个平台顺序(跟 web 端 ThirdPartyLoginButtons 一致):
   * 第一排:微信 / Google / GitHub
   * 第二排:飞书 / 钉钉 / 企业微信
   * 第三排:支付宝 / Apple
   */
  const providers: ThirdPartyProvider[] = React.useMemo(
    () => [
      { key: 'wechat', label: t(LABEL_KEYS.wechat), icon: ICONS.wechat },
      { key: 'google', label: t(LABEL_KEYS.google), icon: ICONS.google },
      { key: 'github', label: t(LABEL_KEYS.github), icon: ICONS.github, mono: true },
      { key: 'feishu', label: t(LABEL_KEYS.feishu), icon: ICONS.feishu },
      { key: 'dingtalk', label: t(LABEL_KEYS.dingtalk), icon: ICONS.dingtalk },
      { key: 'enterpriseWechat', label: t(LABEL_KEYS.enterpriseWechat), icon: ICONS.enterpriseWechat },
      { key: 'alipay', label: t(LABEL_KEYS.alipay), icon: ICONS.alipay },
      // Apple 登录 forceDisabled(跟 web 端一致,2026-07-26 之后)
      { key: 'apple', label: t(LABEL_KEYS.apple), icon: ICONS.apple, mono: true, forceDisabled: true },
    ],
    [t],
  )

  const config: ThirdPartyConfig = React.useMemo(
    () => ({
      providers: providers.map((p) => ({
        ...p,
        enabled: isPlatformEnabledDefault(p.key),
      })),
      currentPlatform,
      onLogin: (p) => void startLogin(p),
    }),
    [providers, currentPlatform, startLogin],
  )

  return { config, startLogin }
}
