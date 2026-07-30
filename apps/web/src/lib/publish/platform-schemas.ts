/**
 * 14 平台发布凭据 schema 定义(可视化表单配置)
 * 与 apps/api/src/routes/publish-routes.ts PLATFORM_REGISTRY 字段名对齐
 * authType 分类:
 *   api_key         — HTTP API + 密钥/应用密码(wordpress/medium/wechat)
 *   oauth           — 开放平台 OAuth 授权(youtube)
 *   browser_cookie  — 浏览器抓 Cookie(其余 10 平台)
 *   none            — 无需凭据(保留占位,当前未使用)
 *
 * AGENTS.md §3:禁 any,用 as const + 精确类型;字段名严格匹配后端契约。
 */

export type CredentialFieldType = 'text' | 'password' | 'textarea' | 'select'
export type CredentialAuthType = 'api_key' | 'oauth' | 'browser_cookie' | 'none'

export interface CredentialSelectOption {
  readonly value: string
  readonly label: string
}

export interface PlatformCredentialField {
  readonly name: string
  readonly label: string
  readonly type: CredentialFieldType
  readonly placeholder?: string
  readonly required: boolean
  readonly helpText?: string
  readonly options?: readonly CredentialSelectOption[]
}

export interface PlatformCredentialSchema {
  readonly platformId: string
  readonly platformName: string
  readonly authType: CredentialAuthType
  readonly setupGuideUrl: string
  readonly helpText: string
  readonly fields: readonly PlatformCredentialField[]
}

export const PLATFORM_AUTH_TYPE_LABELS: Readonly<Record<CredentialAuthType, string>> = {
  api_key: 'API 密钥',
  oauth: 'OAuth 授权',
  browser_cookie: '浏览器 Cookie',
  none: '无需凭据',
} as const

export const PLATFORM_SCHEMAS: readonly PlatformCredentialSchema[] = [
  {
    platformId: 'wordpress',
    platformName: 'WordPress',
    authType: 'api_key',
    setupGuideUrl: 'https://wordpress.org/support/application-passwords/',
    helpText: '通过 WordPress REST API + 应用密码发布,需自建 WordPress 站点。',
    fields: [
      {
        name: 'site_url',
        label: '站点地址',
        type: 'text',
        placeholder: 'https://your-site.com',
        required: true,
        helpText: 'WordPress 站点首页地址,需包含 https:// 前缀,系统会自动拼接 /wp-json/wp/v2 接口路径。',
      },
      {
        name: 'username',
        label: '登录用户名',
        type: 'text',
        placeholder: 'admin',
        required: true,
        helpText: 'WordPress 后台登录用户名(在「用户 → 个人资料」可查,不是昵称)。',
      },
      {
        name: 'app_password',
        label: '应用密码',
        type: 'password',
        required: true,
        helpText: '在 WordPress 后台「用户 → 个人资料 → 应用密码」点击「添加新应用密码」生成,不是登录密码。',
      },
    ],
  },
  {
    platformId: 'medium',
    platformName: 'Medium',
    authType: 'api_key',
    setupGuideUrl: 'https://medium.com/me/settings/security',
    helpText: '通过 Medium Integration Token 发布,需 Medium 账号(推荐用邮箱注册)。' ,
    fields: [
      {
        name: 'integration_token',
        label: '集成令牌',
        type: 'password',
        required: true,
        helpText: '登录 Medium → 右上角头像 → Settings → Security & apps → Integration tokens → 生成新令牌。',
      },
      {
        name: 'author_id',
        label: '作者 ID(可选)',
        type: 'text',
        required: false,
        placeholder: 'd1a2b3c4...',
        helpText: '从个人主页 URL 获取:medium.com/@<author_id>,留空则用默认作者。',
      },
    ],
  },
  {
    platformId: 'youtube',
    platformName: 'YouTube',
    authType: 'oauth',
    setupGuideUrl: 'https://console.cloud.google.com/apis/credentials',
    helpText: '通过 Google OAuth 2.0 + YouTube Data API v3 发布视频,需在 Google Cloud Console 创建凭据。',
    fields: [
      {
        name: 'client_id',
        label: 'OAuth 客户端 ID',
        type: 'text',
        required: true,
        placeholder: 'xxxxx.apps.googleusercontent.com',
        helpText: 'Google Cloud Console → API & Services → Credentials → 创建 OAuth 2.0 Client ID(Web application)。',
      },
      {
        name: 'client_secret',
        label: 'OAuth 客户端密钥',
        type: 'password',
        required: true,
        helpText: '创建 OAuth Client 时一并生成的 Client Secret,只显示一次,请妥善保存。',
      },
      {
        name: 'refresh_token',
        label: 'Refresh Token',
        type: 'password',
        required: true,
        helpText: '通过 OAuth 授权流程获取,用于自动刷新 access_token。配置一次后长期有效,无需重复授权。',
      },
    ],
  },
  {
    platformId: 'bilibili',
    platformName: '哔哩哔哩',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.bilibili.com',
    helpText: '通过 B 站 Cookie 凭据(SESSDATA / bili_jct / buvid3)发布视频,需登录 bilibili.com。',
    fields: [
      {
        name: 'sessdata',
        label: 'SESSDATA',
        type: 'password',
        required: true,
        helpText: 'B 站登录 Cookie 中的 SESSDATA 字段,是会话身份令牌。',
      },
      {
        name: 'bili_jct',
        label: 'bili_jct (CSRF)',
        type: 'password',
        required: true,
        helpText: 'B 站 Cookie 中的 bili_jct 字段,用于防 CSRF 校验,与 SESSDATA 配对。',
      },
      {
        name: 'buvid3',
        label: 'buvid3',
        type: 'text',
        required: true,
        helpText: 'B 站 Cookie 中的 buvid3 字段,设备指纹标识。',
      },
    ],
  },
  {
    platformId: 'wechat',
    platformName: '微信公众号',
    authType: 'api_key',
    setupGuideUrl: 'https://mp.weixin.qq.com/',
    helpText: '通过微信公众平台 AppID/AppSecret + access_token 发布图文,需认证服务号/订阅号。',
    fields: [
      {
        name: 'app_id',
        label: 'AppID',
        type: 'text',
        required: true,
        placeholder: 'wx1234567890abcdef',
        helpText: '微信公众平台 → 设置与开发 → 基本配置 → 公众号开发信息 → AppID。',
      },
      {
        name: 'app_secret',
        label: 'AppSecret',
        type: 'password',
        required: true,
        helpText: '与 AppID 同位置 → AppSecret(点击「重置」后只显示一次,请立即保存)。',
      },
    ],
  },
  {
    platformId: 'toutiao',
    platformName: '今日头条',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://mp.toutiao.com/',
    helpText: '通过头条号 Cookie 发布图文/视频,需登录 mp.toutiao.com 创作者后台。',
    fields: [
      {
        name: 'cookie',
        label: 'Cookie 字符串',
        type: 'textarea',
        required: true,
        placeholder: 'sessionid=xxx; sessionid_ss=xxx; ...',
        helpText: '在 mp.toutiao.com 页面按 F12 → Application → Cookies,复制全部 Cookie 拼成一行(分号分隔)。',
      },
    ],
  },
  {
    platformId: 'douyin',
    platformName: '抖音',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://creator.douyin.com/',
    helpText: '通过抖音创作者后台 Cookie 发布视频,需登录 creator.douyin.com。',
    fields: [
      {
        name: 'cookie',
        label: 'Cookie 字符串',
        type: 'textarea',
        required: true,
        placeholder: 'sessionid=xxx; ttwid=xxx; ...',
        helpText: '在 creator.douyin.com 页面按 F12 → Application → Cookies,复制全部 Cookie。',
      },
    ],
  },
  {
    platformId: 'kuaishou',
    platformName: '快手',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://cp.kuaishou.com/',
    helpText: '通过快手创作者后台 Cookie 发布视频,需登录 cp.kuaishou.com。',
    fields: [
      {
        name: 'cookie',
        label: 'Cookie 字符串',
        type: 'textarea',
        required: true,
        placeholder: 'sessionid=xxx; userId=xxx; ...',
        helpText: '在 cp.kuaishou.com 页面按 F12 → Application → Cookies,复制全部 Cookie。',
      },
    ],
  },
  {
    platformId: 'weibo',
    platformName: '微博',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://weibo.com/',
    helpText: '通过微博 Cookie 发布图文,需登录 weibo.com。',
    fields: [
      {
        name: 'cookie',
        label: 'Cookie 字符串',
        type: 'textarea',
        required: true,
        placeholder: 'SUB=xxx; SUBP=xxx; ...',
        helpText: '在 weibo.com 页面按 F12 → Application → Cookies,复制全部 Cookie。',
      },
    ],
  },
  {
    platformId: 'zhihu',
    platformName: '知乎',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.zhihu.com/',
    helpText: '通过知乎 Cookie(z_c0 / d_c0)+ Playwright 浏览器自动化发布,需登录 zhihu.com。',
    fields: [
      {
        name: 'z_c0',
        label: 'z_c0 (登录令牌)',
        type: 'password',
        required: true,
        helpText: '知乎 Cookie 中的 z_c0 字段,登录后的会话令牌,长期未操作会失效。',
      },
      {
        name: 'd_c0',
        label: 'd_c0 (设备标识)',
        type: 'text',
        required: true,
        helpText: '知乎 Cookie 中的 d_c0 字段,设备指纹,即使未登录也存在。',
      },
    ],
  },
  {
    platformId: 'csdn',
    platformName: 'CSDN',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://blog.csdn.net/',
    helpText: '通过 CSDN Cookie(UserName / UserToken / UserSecret)+ Playwright 发布,需登录 blog.csdn.net。',
    fields: [
      {
        name: 'UserName',
        label: 'UserName',
        type: 'text',
        required: true,
        helpText: 'CSDN Cookie 中的 UserName 字段(注意大小写),博客个人主页 URL 末段就是 UserName。',
      },
      {
        name: 'UserToken',
        label: 'UserToken',
        type: 'password',
        required: true,
        helpText: 'CSDN Cookie 中的 UserToken 字段,发布接口的访问令牌。',
      },
      {
        name: 'UserSecret',
        label: 'UserSecret',
        type: 'password',
        required: true,
        helpText: 'CSDN Cookie 中的 UserSecret 字段,与 UserToken 配对的密钥。',
      },
    ],
  },
  {
    platformId: 'juejin',
    platformName: '掘金',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://juejin.cn/',
    helpText: '通过掘金 Cookie(sessionid / sessionid_ss)+ Playwright 发布,需登录 juejin.cn。',
    fields: [
      {
        name: 'sessionid',
        label: 'sessionid',
        type: 'password',
        required: true,
        helpText: '掘金 Cookie 中的 sessionid 字段,登录会话令牌。',
      },
      {
        name: 'sessionid_ss',
        label: 'sessionid_ss',
        type: 'password',
        required: true,
        helpText: '掘金 Cookie 中的 sessionid_ss 字段,与 sessionid 配对的二级令牌。',
      },
    ],
  },
  {
    platformId: 'xiaohongshu',
    platformName: '小红书',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.xiaohongshu.com/',
    helpText: '通过小红书 Cookie(web_session)+ Playwright 发布图文,需登录 xiaohongshu.com。',
    fields: [
      {
        name: 'web_session',
        label: 'web_session',
        type: 'password',
        required: true,
        helpText: '小红书 Cookie 中的 web_session 字段,登录后的会话令牌。',
      },
    ],
  },
  {
    platformId: 'shipinhao',
    platformName: '微信视频号',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://channels.weixin.qq.com/',
    helpText: '通过视频号 Cookie + Playwright 发布视频,需登录 channels.weixin.qq.com。',
    fields: [
      {
        name: 'cookie',
        label: 'Cookie 字符串',
        type: 'textarea',
        required: true,
        placeholder: 'sessionid=xxx; uin=xxx; ...',
        helpText: '在 channels.weixin.qq.com 页面按 F12 → Application → Cookies,复制全部 Cookie。',
      },
    ],
  },
] as const

/** 按 platformId 查找 schema。未找到返回 undefined。 */
export function getPlatformSchema(platformId: string): PlatformCredentialSchema | undefined {
  return PLATFORM_SCHEMAS.find((s) => s.platformId === platformId)
}

/** 列出所有平台 ID(用于"待配置平台"提示区)。 */
export function getAllPlatformIds(): readonly string[] {
  return PLATFORM_SCHEMAS.map((s) => s.platformId)
}

/** 将 credentials 对象(unknown 值)规范化为 string→string 映射(表单状态)。 */
export function normalizeCredentials(
  raw: Record<string, unknown> | undefined,
): Record<string, string> {
  if (!raw) return {}
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') result[k] = v
    else if (v !== null && v !== undefined) result[k] = String(v)
  }
  return result
}
