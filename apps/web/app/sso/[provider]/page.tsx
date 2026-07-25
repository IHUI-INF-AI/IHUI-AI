// D 盘历史路径兼容:通用 provider 别名路由
// 将 dt/wx/wechat/feishu/lark/github/google/apple/alipay 等别名映射到 /sso/auth?platform=<canonical>
// output:'export' 模式:generateStaticParams 预生成已知别名,服务端组件渲染静态 HTML + 内联 JS 重定向

const PROVIDER_ALIASES: Record<string, string> = {
  dt: 'dingtalk',
  wx: 'enterpriseWechat',
  wechat: 'wechat',
  feishu: 'feishu',
  lark: 'feishu',
  github: 'github',
  google: 'google',
  apple: 'apple',
  alipay: 'alipay',
}

export function generateStaticParams() {
  return Object.keys(PROVIDER_ALIASES).map((provider) => ({ provider }))
}

interface PageProps {
  params: Promise<{ provider: string }>
}

export default async function SsoProviderCompatPage({ params }: PageProps) {
  const { provider } = await params
  const canonical = PROVIDER_ALIASES[provider] || provider
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var sp=new URLSearchParams(location.search);sp.set('platform','${canonical}');location.replace('/sso/auth?'+sp.toString());})();`,
        }}
      />
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">正在跳转...</p>
      </div>
    </>
  )
}
