# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-WEB 服务 wrapper — 由 Windows 服务 "IHUI-WEB" 调用(NSSM 托管)
# 生产模式:next build + next start(2026-08-04 从 next dev 切换)
# 日志: D:\DevEnv\logs\svc-web-nssm.log / svc-web-nssm-err.log(NSSM 捕获)
# =============================================================================
$env:PATH = "D:\DevEnv\runtimes\node;D:\DevEnv\tools\npm-global;$env:PATH"

# =============================================================================
# 2026-08-04 生产修复:公网登录/模型列表失效根因
# apps/web/.env 里 NEXT_PUBLIC_API_BASE_URL=http://localhost:8802 会被注入浏览器端 JS,
# 公网用户访问 aizhs.top 时,所有 API 请求发往"用户自己电脑"的 localhost:8802 → 连接被拒
# → 登录点击无响应、模型选择栏无限转圈。
# 修复:生产环境强制置空,浏览器走同源 /api/* → Next.js rewrites 转发到 8802/8803。
# 注意:必须放在 build 之前设置(编译期内联,真实环境变量优先级高于 .env 文件)。
# =============================================================================
$env:NEXT_PUBLIC_API_BASE_URL = ""
# 生产 WS 必须指向 api.aizhs.top 子域(主域 aizhs.top 对 /v1/ai/capabilities/* 的
# WebSocket 升级失败 000/404,api.aizhs.top 才正确返回 101)。与 .env 保持一致。
$env:NEXT_PUBLIC_WS_BASE_URL = "https://api.aizhs.top"

# 仓库根不再写死(2026-10-12):把仓库路径写死进生产启动脚本,换机/换根后 NSSM 起的服务
# 会指向错误目录、跑错代码。唯一解析实现在 deploy\win\ihui-root-common.ps1;本脚本有两份
# 落点(入库源 deploy\scripts\prod-bundle\svc 与生产实际执行的 deploy\prod-bundle\svc,
# 相差 1 级),写死相对深度必有一份算错 ⇒ 原先改成"逐级向上搜索"。
# 2026-10-28 再改:搜索形态把 $ihuiRootCommon 赋值两次、RHS 是变量拷贝,健康门的 dot-source
# 维只认**单次赋值的静态形态**(Join-Path / 引号字面量 / 盘符绝对路径)⇒ 该维对
# IHUI-WEB / IHUI-API / IHUI-AI-SERVICE 永远"读不出实际落点",三台核心服务长期开不出健康证
# (unattested),真红被假红淹掉。落点本身是确定的:NSSM 的 -File 指向
# <root>\deploy\prod-bundle\svc\run-web.ps1 ⇒ $PSScriptRoot 上溯 3 级即仓库根。
# 入库源 deploy\scripts\prod-bundle\svc 多 1 级,但那份只作副本源、从不执行(门 104 只比
# 字节)⇒ 这里按**执行落点**书写。找不到照样当场 throw,绝不带着错根继续跑。
$ihuiRootCommon = Join-Path $PSScriptRoot '..\..\..\deploy\win\ihui-root-common.ps1'
if (-not (Test-Path -LiteralPath $ihuiRootCommon)) {
    throw "run-web.ps1: 自 $PSScriptRoot 上溯 3 级未命中 deploy\win\ihui-root-common.ps1(实算:$ihuiRootCommon)—— 解析不出仓库根,拒绝启动服务"
}
. $ihuiRootCommon
$Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot

Set-Location (Join-Path $Root 'apps\web')

# ── 蓝绿槽位(2026-10-28 生产席立)──────────────────────────────────────────────
# web 原是单实例停-起,切流空窗 + Next 冷启动期间 8801 无人服务 ⇒ 公网 /api/* 502
# (详见 ihui-deploy.ps1「切流后就绪等待」段的实测归因)。根治办法是双实例蓝绿:
# IHUI-WEB-BLUE(:8851,.next-blue) / IHUI-WEB-GREEN(:8852,.next-green),由 IHUI-WEB-ROUTER
# 常驻 8801 原子切流。三个变量因此必须能被服务级 env 覆盖,而**缺省值与改造前逐字等价**
# (8801 / 0.0.0.0 / .next)⇒ 现有 IHUI-WEB 单实例行为零变化,蓝绿上线失败也能原路退回。
# distDir 之所以能随实例走:apps/web/next.config.ts 里 `distDir = process.env.IHUI_BUILD_DIST
# || staticDistDir`,构建与启动读的是同一个开关 ⇒ 脚本判 BUILD_ID 必须也用 $webDist,
# 否则会出现"判 .next 有产物、实际起的是 .next-blue 空目录"这种自相矛盾的形态。
$webPort = if ($env:IHUI_WEB_PORT) { [int]$env:IHUI_WEB_PORT } else { 8801 }
$webHost = if ($env:IHUI_WEB_HOST) { $env:IHUI_WEB_HOST } else { '0.0.0.0' }
$webDist = if ($env:IHUI_BUILD_DIST) { $env:IHUI_BUILD_DIST } else { '.next' }

# 首次启动(或代码变更后)执行生产构建;构建目录已存在且非空则跳过,直接 start
if (-not (Test-Path "$webDist\BUILD_ID")) {
    Write-Host "[IHUI-WEB] 生产构建中(next build)..."
    & "D:\DevEnv\tools\npm-global\pnpm.cmd" build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[IHUI-WEB] next build 失败,退出码 $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} else {
    Write-Host "[IHUI-WEB] 已存在生产构建产物,跳过 build"
}

# 生产服务端模式启动(next start 提供 rewrites 代理 /api/* → 8802/8803 + 安全响应头)
# 2026-08-04 修复:不用 pnpm start(pnpm 会检查 node_modules 一致性并弹出交互式
# "modules directories will be removed...Proceed?" 提示,在 NSSM 无终端环境下卡死),
# 直接调用 next start 二进制。
# 2026-08-05 安全加固:-H 127.0.0.1 只监听本机(公网仅经 Cloudflare Tunnel 回源,源站物理不可达)
# 2026-10-28 改判(这一条覆盖上一条):2026-10-21 起 EdgeOne 源站已直填本机公网 IP:8801
# (scripts/data/eo-origin-expectation.json rows[face=www.aizhs.top],取代 Cloudflare Tunnel 跨境回源),
# 而只绑 127.0.0.1 让 EdgeOne 回源恒 522 —— 2026-10-28 01:30 部署环 8/8 轮 api/llm fail、
# 判 GATE-ENTRY-BROKEN 并每轮刷 WARN 即此。8802 早已监听 0.0.0.0(防火墙 8801/8802/8803 同一条规则放行),
# 故这里补成同一口径,不是新增暴露面;Cloudflare 隧道仍走 127.0.0.1:8801,不受影响。
& "D:\DevEnv\runtimes\node\node.exe" node_modules/next/dist/bin/next start -H $webHost -p $webPort
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
