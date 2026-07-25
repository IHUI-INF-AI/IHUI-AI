// D 盘历史路径兼容:/sso/wecom → /sso/auth?platform=enterpriseWechat
// output:'export' 模式:服务端组件渲染静态 HTML + 内联 JS 重定向(保留 query params)
export default function SsoWecomCompatPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var sp=new URLSearchParams(location.search);sp.set('platform','enterpriseWechat');location.replace('/sso/auth?'+sp.toString());})();`,
        }}
      />
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">正在跳转到企业微信登录...</p>
      </div>
    </>
  )
}
