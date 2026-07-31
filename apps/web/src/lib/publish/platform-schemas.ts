/**
 * 37 平台发布凭据 schema 定义(可视化表单配置)
 * 与 apps/ai-service/app/services/publish/base_adapter.list_all_adapter_classes 对齐
 * authType 分类:
 *   api_key         — HTTP API + 密钥/应用密码(wordpress/medium/wechat/cnblogs/segmentfault/oschina)
 *   oauth           — 开放平台 OAuth 授权(youtube)
 *   browser_cookie  — 浏览器抓 Cookie(其余 30 平台,含 Playwright 适配器)
 *   none            — 无需凭据(保留占位,当前未使用)
 *
 * 平台分组(37 个):
 *   - 国际平台 3:wordpress / medium / youtube
 *   - 视频平台 6:bilibili / douyin / kuaishou / xigua / haokan / shipinhao
 *   - 图文社交 4:wechat / toutiao / weibo / xiaohongshu
 *   - 技术社区 7:zhihu / csdn / juejin / cnblogs / segmentfault / oschina / jianshu
 *   - 六大号 6:baijiahao / qq / dayihao / netease / sohu / sina
 *   - SEO/GEO 第二批 12:baidu_zhidao / baidu_tieba / douban / 36kr / huxiu / tmtmedia / acfun / lofter / zhihu_daily / people / china_news / hupu
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
  // ===== R2:友好 API 平台(HTTP API,不涉风控)=====
  {
    platformId: 'cnblogs',
    platformName: '博客园',
    authType: 'api_key',
    setupGuideUrl: 'https://oauth.cnblogs.com/',
    helpText: '通过博客园 OAuth + Personal Access Token 发布,需在博客园后台申请令牌。',
    fields: [
      {
        name: 'access_token',
        label: 'Access Token',
        type: 'password',
        required: true,
        helpText: '博客园 → 设置 → OAuth 应用 → 申请 Personal Access Token(需博客园账号并通过实名认证)。',
      },
    ],
  },
  {
    platformId: 'segmentfault',
    platformName: '思否',
    authType: 'api_key',
    setupGuideUrl: 'https://segmentfault.com/settings',
    helpText: '通过思否 Access Token 发布文章,需在思否个人设置申请令牌。',
    fields: [
      {
        name: 'access_token',
        label: 'Access Token',
        type: 'password',
        required: true,
        helpText: '思否 → 个人设置 → 开发者 → Access Token → 生成新令牌(需思否账号)。',
      },
    ],
  },
  {
    platformId: 'oschina',
    platformName: '开源中国',
    authType: 'api_key',
    setupGuideUrl: 'https://www.oschina.net/settings',
    helpText: '通过开源中国 Access Token 发布文章,需在个人设置申请令牌。',
    fields: [
      {
        name: 'access_token',
        label: 'Access Token',
        type: 'password',
        required: true,
        helpText: '开源中国 → 个人设置 → 开发者设置 → Access Token → 生成新令牌。',
      },
    ],
  },
  {
    platformId: 'jianshu',
    platformName: '简书',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.jianshu.com/',
    helpText: '通过简书 Cookie 发布文章,需登录 jianshu.com。',
    fields: [
      {
        name: 'cookie',
        label: 'Cookie 字符串',
        type: 'textarea',
        required: true,
        placeholder: 'remember_user_token=xxx; _session_id=xxx; ...',
        helpText: '在 jianshu.com 页面按 F12 → Application → Cookies,复制全部 Cookie 拼成一行(分号分隔)。',
      },
    ],
  },
  // ===== R4:六大号平台(Playwright + 反风控五层防线)=====
  {
    platformId: 'baijiahao',
    platformName: '百家号',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://baijiahao.baidu.com/',
    helpText: '通过百度 Cookie(BDUSS / STOKEN)+ Playwright 发布,需登录 baijiahao.baidu.com 创作者后台。',
    fields: [
      {
        name: 'BDUSS',
        label: 'BDUSS',
        type: 'password',
        required: true,
        helpText: '百度全系登录 Cookie 中的 BDUSS 字段,长期登录令牌(HttpOnly),在 baidu.com 域下复制。',
      },
      {
        name: 'STOKEN',
        label: 'STOKEN',
        type: 'password',
        required: true,
        helpText: '百度 Cookie 中的 STOKEN 字段,二次验证令牌,与 BDUSS 配对使用。',
      },
    ],
  },
  {
    platformId: 'qq',
    platformName: '企鹅号',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://om.qq.com/',
    helpText: '通过腾讯 Cookie(RK / ptcz / pgv_pvid)+ Playwright 发布,需登录 om.qq.com 企鹅号后台。',
    fields: [
      {
        name: 'RK',
        label: 'RK',
        type: 'password',
        required: true,
        helpText: '腾讯全系登录 Cookie 中的 RK 字段,QQ 登录态令牌,在 qq.com 域下复制。',
      },
      {
        name: 'ptcz',
        label: 'ptcz',
        type: 'password',
        required: true,
        helpText: '腾讯 Cookie 中的 ptcz 字段,登录票据,与 RK 配对使用。',
      },
      {
        name: 'pgv_pvid',
        label: 'pgv_pvid',
        type: 'text',
        required: true,
        helpText: '腾讯 Cookie 中的 pgv_pvid 字段,用户访问标识(防伪)。',
      },
    ],
  },
  {
    platformId: 'dayihao',
    platformName: '大鱼号',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://mp.dayu.com/',
    helpText: '通过阿里 Cookie(cna / _csrf_token / unb)+ Playwright 发布,需登录 mp.dayu.com 大鱼号后台。',
    fields: [
      {
        name: 'cna',
        label: 'cna',
        type: 'text',
        required: true,
        helpText: '阿里全系 Cookie 中的 cna 字段,设备指纹标识,在 taobao.com 域下复制。',
      },
      {
        name: '_csrf_token',
        label: '_csrf_token',
        type: 'password',
        required: true,
        helpText: '大鱼号 Cookie 中的 _csrf_token 字段,防 CSRF 校验令牌。',
      },
      {
        name: 'unb',
        label: 'unb (用户 ID)',
        type: 'text',
        required: true,
        helpText: '阿里 Cookie 中的 unb 字段,用户唯一标识(数字 ID)。',
      },
    ],
  },
  {
    platformId: 'netease',
    platformName: '网易号',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://mp.163.com/',
    helpText: '通过网易 Cookie(P_INFO / S_INFO / NTES_SESS)+ Playwright 发布,需登录 mp.163.com 网易号后台。',
    fields: [
      {
        name: 'P_INFO',
        label: 'P_INFO',
        type: 'password',
        required: true,
        helpText: '网易 Cookie 中的 P_INFO 字段,用户基础信息(含账号名),HttpOnly。',
      },
      {
        name: 'S_INFO',
        label: 'S_INFO',
        type: 'text',
        required: true,
        helpText: '网易 Cookie 中的 S_INFO 字段,会话补充信息(含登录时间)。',
      },
      {
        name: 'NTES_SESS',
        label: 'NTES_SESS',
        type: 'password',
        required: true,
        helpText: '网易 Cookie 中的 NTES_SESS 字段,核心会话令牌,与 P_INFO 配对使用。',
      },
    ],
  },
  {
    platformId: 'sohu',
    platformName: '搜狐号',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://mp.sohu.com/',
    helpText: '通过搜狐 Cookie(SUV / IPLOC / sct)+ Playwright 发布,需登录 mp.sohu.com 搜狐号后台。',
    fields: [
      {
        name: 'SUV',
        label: 'SUV',
        type: 'password',
        required: true,
        helpText: '搜狐 Cookie 中的 SUV 字段,用户访问标识(HttpOnly),在 sohu.com 域下复制。',
      },
      {
        name: 'IPLOC',
        label: 'IPLOC',
        type: 'text',
        required: true,
        helpText: '搜狐 Cookie 中的 IPLOC 字段,IP 地理定位标识(用于地域风控)。',
      },
      {
        name: 'sct',
        label: 'sct',
        type: 'password',
        required: true,
        helpText: '搜狐 Cookie 中的 sct 字段,登录态核心令牌(HttpOnly)。',
      },
    ],
  },
  {
    platformId: 'sina',
    platformName: '新浪看点',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://mp.sina.com.cn/',
    helpText: '通过新浪 Cookie(SCF / ALF / SUB)+ Playwright 发布,需登录 mp.sina.com.cn 新浪看点后台。',
    fields: [
      {
        name: 'SCF',
        label: 'SCF',
        type: 'text',
        required: true,
        helpText: '新浪 Cookie 中的 SCF 字段,用户签名信息,在 sina.com.cn 域下复制。',
      },
      {
        name: 'ALF',
        label: 'ALF',
        type: 'text',
        required: true,
        helpText: '新浪 Cookie 中的 ALF 字段,登录过期时间戳(用于自动续期判断)。',
      },
      {
        name: 'SUB',
        label: 'SUB',
        type: 'password',
        required: true,
        helpText: '新浪 Cookie 中的 SUB 字段,核心登录令牌(HttpOnly),失效后需重新登录。',
      },
    ],
  },
  // ===== R3:视频平台(Playwright + 反风控)=====
  {
    platformId: 'xigua',
    platformName: '西瓜视频',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://studio.ixigua.com/',
    helpText: '通过字节 Cookie(sessionid / ttwid)+ Playwright 发布视频,需登录 studio.ixigua.com 创作者后台。',
    fields: [
      {
        name: 'sessionid',
        label: 'sessionid',
        type: 'password',
        required: true,
        helpText: '字节全系 Cookie 中的 sessionid 字段,登录会话令牌,在 ixigua.com 域下复制。',
      },
      {
        name: 'ttwid',
        label: 'ttwid',
        type: 'password',
        required: true,
        helpText: '字节 Cookie 中的 ttwid 字段,设备指纹标识(用于风控追踪)。',
      },
    ],
  },
  {
    platformId: 'haokan',
    platformName: '好看视频',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://haokan.baidu.com/',
    helpText: '通过百度 Cookie(BDUSS / STOKEN)+ Playwright 发布视频,需登录 haokan.baidu.com 创作者后台。',
    fields: [
      {
        name: 'BDUSS',
        label: 'BDUSS',
        type: 'password',
        required: true,
        helpText: '百度全系登录 Cookie 中的 BDUSS 字段,与百家号共用(同账号可发布到百家号+好看视频)。',
      },
      {
        name: 'STOKEN',
        label: 'STOKEN',
        type: 'password',
        required: true,
        helpText: '百度 Cookie 中的 STOKEN 字段,二次验证令牌,与 BDUSS 配对使用。',
      },
    ],
  },
  // ===== R5:SEO/GEO 高权重平台第二批(Playwright + 反风控五层防线)=====
  {
    platformId: 'baidu_zhidao',
    platformName: '百度知道',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://zhidao.baidu.com/',
    helpText: '通过百度 Cookie(BDUSS / STOKEN)+ Playwright 发布问答,与百家号共用凭证。',
    fields: [
      {
        name: 'BDUSS',
        label: 'BDUSS',
        type: 'password',
        required: true,
        helpText: '百度全系登录 Cookie 中的 BDUSS 字段,与百家号共用(同账号可发布到百度知道)。',
      },
      {
        name: 'STOKEN',
        label: 'STOKEN',
        type: 'password',
        required: true,
        helpText: '百度 Cookie 中的 STOKEN 字段,二次验证令牌,与 BDUSS 配对使用。',
      },
    ],
  },
  {
    platformId: 'baidu_tieba',
    platformName: '百度贴吧',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://tieba.baidu.com/',
    helpText: '通过百度 Cookie(BDUSS / STOKEN)+ Playwright 发帖,需在 platform_config 指定目标贴吧名(tieba_kw)。',
    fields: [
      {
        name: 'BDUSS',
        label: 'BDUSS',
        type: 'password',
        required: true,
        helpText: '百度全系登录 Cookie 中的 BDUSS 字段,与百家号共用。',
      },
      {
        name: 'STOKEN',
        label: 'STOKEN',
        type: 'password',
        required: true,
        helpText: '百度 Cookie 中的 STOKEN 字段,二次验证令牌,与 BDUSS 配对使用。',
      },
    ],
  },
  {
    platformId: 'douban',
    platformName: '豆瓣',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.douban.com/',
    helpText: '通过豆瓣 Cookie(db_clnd / ck)+ Playwright 发布日记,需登录 douban.com。',
    fields: [
      {
        name: 'db_clnd',
        label: 'db_clnd',
        type: 'password',
        required: true,
        helpText: '豆瓣登录 Cookie 中的 db_clnd 字段,登录会话令牌(HttpOnly),在 douban.com 域下复制。',
      },
      {
        name: 'ck',
        label: 'ck',
        type: 'text',
        required: true,
        helpText: '豆瓣 Cookie 中的 ck 字段,会话校验令牌,与 db_clnd 配对使用。',
      },
    ],
  },
  {
    platformId: '36kr',
    platformName: '36氪',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.36kr.com/',
    helpText: '通过 36氪 Cookie(_36kr_session / acw_tc)+ Playwright 发布文章,需登录 36kr.com 创作者后台。',
    fields: [
      {
        name: '_36kr_session',
        label: '_36kr_session',
        type: 'password',
        required: true,
        helpText: '36氪 Cookie 中的 _36kr_session 字段,登录会话令牌(HttpOnly),在 36kr.com 域下复制。',
      },
      {
        name: 'acw_tc',
        label: 'acw_tc',
        type: 'text',
        required: true,
        helpText: '36氪 Cookie 中的 acw_tc 字段,阿里云风控追踪标识(防爬虫)。',
      },
    ],
  },
  {
    platformId: 'huxiu',
    platformName: '虎嗅网',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.huxiu.com/',
    helpText: '通过虎嗅 Cookie(huxiu_session / huxiu_token)+ Playwright 发布文章,需登录 huxiu.com。',
    fields: [
      {
        name: 'huxiu_session',
        label: 'huxiu_session',
        type: 'password',
        required: true,
        helpText: '虎嗅 Cookie 中的 huxiu_session 字段,登录会话令牌(HttpOnly),在 huxiu.com 域下复制。',
      },
      {
        name: 'huxiu_token',
        label: 'huxiu_token',
        type: 'text',
        required: true,
        helpText: '虎嗅 Cookie 中的 huxiu_token 字段,API 访问令牌,与 huxiu_session 配对使用。',
      },
    ],
  },
  {
    platformId: 'tmtmedia',
    platformName: '钛媒体',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.tmtpost.com/',
    helpText: '通过钛媒体 Cookie(tmt_session / tmt_token)+ Playwright 发布文章,需登录 tmtpost.com。',
    fields: [
      {
        name: 'tmt_session',
        label: 'tmt_session',
        type: 'password',
        required: true,
        helpText: '钛媒体 Cookie 中的 tmt_session 字段,登录会话令牌(HttpOnly),在 tmtpost.com 域下复制。',
      },
      {
        name: 'tmt_token',
        label: 'tmt_token',
        type: 'text',
        required: true,
        helpText: '钛媒体 Cookie 中的 tmt_token 字段,API 访问令牌,与 tmt_session 配对使用。',
      },
    ],
  },
  {
    platformId: 'acfun',
    platformName: 'AcFun',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.acfun.cn/',
    helpText: '通过 AcFun Cookie(acPasstoken / ac_session)+ Playwright 投稿文章,需登录 acfun.cn。',
    fields: [
      {
        name: 'acPasstoken',
        label: 'acPasstoken',
        type: 'password',
        required: true,
        helpText: 'AcFun Cookie 中的 acPasstoken 字段,登录通行令牌(HttpOnly),在 acfun.cn 域下复制。',
      },
      {
        name: 'ac_session',
        label: 'ac_session',
        type: 'text',
        required: true,
        helpText: 'AcFun Cookie 中的 ac_session 字段,会话校验令牌,与 acPasstoken 配对使用。',
      },
    ],
  },
  {
    platformId: 'lofter',
    platformName: 'LOFTER',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.lofter.com/',
    helpText: '通过网易 Cookie(NTES_SESS / S_INFO)+ Playwright 发布轻博客,与网易号共用凭证。',
    fields: [
      {
        name: 'NTES_SESS',
        label: 'NTES_SESS',
        type: 'password',
        required: true,
        helpText: '网易全系 Cookie 中的 NTES_SESS 字段,核心会话令牌,与网易号共用(同账号可发布到网易号+LOFTER)。',
      },
      {
        name: 'S_INFO',
        label: 'S_INFO',
        type: 'text',
        required: true,
        helpText: '网易 Cookie 中的 S_INFO 字段,会话补充信息(含登录时间),与 NTES_SESS 配对使用。',
      },
    ],
  },
  {
    platformId: 'zhihu_daily',
    platformName: '知乎日报',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://daily.zhihu.com/',
    helpText: '通过知乎 Cookie(z_c0 / d_c0)+ Playwright 投稿,与知乎主站共用凭证。',
    fields: [
      {
        name: 'z_c0',
        label: 'z_c0 (登录令牌)',
        type: 'password',
        required: true,
        helpText: '知乎 Cookie 中的 z_c0 字段,与知乎主站共用(同账号可发布到知乎+知乎日报)。',
      },
      {
        name: 'd_c0',
        label: 'd_c0 (设备标识)',
        type: 'text',
        required: true,
        helpText: '知乎 Cookie 中的 d_c0 字段,设备指纹,与 z_c0 配对使用。',
      },
    ],
  },
  {
    platformId: 'people',
    platformName: '人民网',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.people.com.cn/',
    helpText: '通过人民网 Cookie(people_session / people_token)+ Playwright 发布文章,需登录 people.com.cn 创作者后台。',
    fields: [
      {
        name: 'people_session',
        label: 'people_session',
        type: 'password',
        required: true,
        helpText: '人民网 Cookie 中的 people_session 字段,登录会话令牌(HttpOnly),在 people.com.cn 域下复制。',
      },
      {
        name: 'people_token',
        label: 'people_token',
        type: 'text',
        required: true,
        helpText: '人民网 Cookie 中的 people_token 字段,API 访问令牌,与 people_session 配对使用。',
      },
    ],
  },
  {
    platformId: 'china_news',
    platformName: '中国新闻网',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://www.chinanews.com.cn/',
    helpText: '通过中国新闻网 Cookie(cn_session / cn_token)+ Playwright 发布文章,需登录 chinanews.com.cn 创作者后台。',
    fields: [
      {
        name: 'cn_session',
        label: 'cn_session',
        type: 'password',
        required: true,
        helpText: '中国新闻网 Cookie 中的 cn_session 字段,登录会话令牌(HttpOnly),在 chinanews.com.cn 域下复制。',
      },
      {
        name: 'cn_token',
        label: 'cn_token',
        type: 'text',
        required: true,
        helpText: '中国新闻网 Cookie 中的 cn_token 字段,API 访问令牌,与 cn_session 配对使用。',
      },
    ],
  },
  {
    platformId: 'hupu',
    platformName: '虎扑社区',
    authType: 'browser_cookie',
    setupGuideUrl: 'https://bbs.hupu.com/',
    helpText: '通过虎扑 Cookie(hupu_token / hupu_session)+ Playwright 发帖,需在 platform_config 指定目标版块 ID(hupu_fid)。',
    fields: [
      {
        name: 'hupu_token',
        label: 'hupu_token',
        type: 'password',
        required: true,
        helpText: '虎扑 Cookie 中的 hupu_token 字段,登录令牌(HttpOnly),在 hupu.com 域下复制。',
      },
      {
        name: 'hupu_session',
        label: 'hupu_session',
        type: 'text',
        required: true,
        helpText: '虎扑 Cookie 中的 hupu_session 字段,会话校验令牌,与 hupu_token 配对使用。',
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
