// D 盘历史路径兼容:/sso/dingtalk → /sso/auth?platform=dingtalk
// output:'export' 模式:服务端组件渲染静态 HTML + 内联 JS 重定向(保留 query params)
export default function SsoDingtalkCompatPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var sp=new URLSearchParams(location.search);sp.set('platform','dingtalk');location.replace('/sso/auth?'+sp.toString());})();`,
        }}
      />
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">正在跳转到钉钉登录...</p>
      </div>
    </>
  )
}
