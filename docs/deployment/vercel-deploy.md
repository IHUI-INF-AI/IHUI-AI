# Vercel 部署详细指南

> **部署目标**:前端 Web(Next.js 16 静态导出)
> **免费额度**:100GB 流量/月 · 100h 构建时间/月 · 全球 CDN
> **配置文件**:`apps/web/vercel.json`

---

## 1. 前置条件

- GitHub 账号(已 Fork [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) 仓库)
- Vercel 账号(https://vercel.com/signup,用 GitHub 登录)
- 后端 API 域名(从 Railway 或 Render 部署后获得)

---

## 2. 部署步骤

### 2.1 创建项目

1. 登录 https://vercel.com → 点 **"Add New"** → **"Project"**
2. 在 "Import Git Repository" 列表找到你 Fork 的 `IHUI-AI` 仓库
3. 点 **"Import"**

> **截图占位**:![Import 仓库](images/vercel-import.png)

### 2.2 配置项目(关键)

在 "Configure Project" 页面:

| 配置项 | 值 | 说明 |
| ------ | -- | ---- |
| Framework Preset | Next.js | 自动识别 |
| Root Directory | `apps/web` | **必填**,点 Edit 输入 |
| Build Command | `pnpm --filter @ihui/web... build` | 自动从 vercel.json 读取 |
| Install Command | `pnpm install --frozen-lockfile` | 自动从 vercel.json 读取 |
| Output Directory | `out` | Next.js 静态导出目录,自动读取 |

### 2.3 配置环境变量

在 "Environment Variables" 区域添加:

| Name | Value | 必填 | 说明 |
| ---- | ----- | ---- | ---- |
| `NEXT_PUBLIC_API_URL` | `https://你的-api-域名` | ✅ | 后端 API 公网 URL(Railway/Render) |
| `NEXT_PUBLIC_APP_NAME` | `IHUI AI` | 否 | 应用名,已有默认值 |
| `NEXT_TELEMETRY_DISABLED` | `1` | 否 | 关闭遥测,已有默认值 |
| `NODE_OPTIONS` | `--max-old-space-size=4096` | 推荐 | 防止构建 OOM |

> **重要**:`NEXT_PUBLIC_*` 变量在构建时**静态编译进产物**,修改后必须 **Redeploy** 才生效(运行时改不生效)。

### 2.4 部署

1. 点 **"Deploy"** 蓝色按钮
2. 等待构建(3-5 分钟)
3. 看到 "Congratulations" + 烟花 = 成功 🎉
4. 点 "Visit" 访问,或点 "Continue to Dashboard"

> **截图占位**:![Vercel 部署成功](images/vercel-deploy-success.png)

---

## 3. 部署后配置

### 3.1 获取 Vercel 域名

1. 项目首页 → 点 "Visit" 右侧的域名
2. 默认域名格式:`ihui-ai-xxx-你的用户名.vercel.app`
3. 记下这个域名,配置后端 `CORS_ORIGIN` 时要用

### 3.2 更新环境变量

部署后如果需要改环境变量(如后端域名变了):

1. 项目 → Settings → Environment Variables
2. 修改对应变量的 Value
3. **必须 Redeploy**:Deployments → 最近部署 → "..." → Redeploy

### 3.3 自动部署配置

Vercel 默认绑定 GitHub,你 Fork 的仓库有新 commit 时自动触发部署:
- 项目 → Settings → Git → Integration 开启
- Production Branch: `main`

---

## 4. 自定义域名

### 4.1 添加域名

1. 项目 → Settings → Domains
2. 输入你的域名(如 `www.yourname.com`)→ Add

### 4.2 配置 DNS

在域名注册商(如 Cloudflare、阿里云、GoDaddy)添加 DNS 记录:

| 类型 | 主机记录 | 记录值 |
| ---- | -------- | ------ |
| CNAME | www | `cname.vercel-dns.com` |
| A | @ | `76.76.21.21`(可选,根域名) |

### 4.3 验证

- DNS 生效后(5-30 分钟),Vercel 自动签发 SSL 证书
- 项目 → Domains → 看到绿色 ✅ = 配置成功

---

## 5. 常见错误排查

### 5.1 构建失败:`next build` OOM

**日志特征**:
```
<--- Last few GCs --->
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**解决**:
1. Settings → Environment Variables → 添加 `NODE_OPTIONS` = `--max-old-space-size=4096`
2. 如果仍失败,改为 `--max-old-space-size=8192`(Vercel Pro 才支持)
3. Redeploy

### 5.2 构建失败:`pnpm: command not found`

**原因**:Vercel 未识别 pnpm。

**解决**:
1. 确认仓库根目录有 `package.json` 且包含 `"packageManager": "pnpm@9.15.0"` 字段
2. 确认 Root Directory 设置为 `apps/web`
3. 如果仍失败,在 vercel.json 加 `"installCommand": "npm i -g pnpm && pnpm install"`

### 5.3 部署成功但页面空白

**原因 1**:`NEXT_PUBLIC_API_URL` 未配置或错误 → 静态导出时 API 调用失败

**解决**:
1. Settings → Environment Variables → 检查 `NEXT_PUBLIC_API_URL`
2. 值必须以 `https://` 开头,**结尾不要**加 `/`
3. Redeploy

**原因 2**:后端 CORS 拒绝前端请求

**解决**:
1. 在 Railway/Render 后端服务配置 `CORS_ORIGIN` = 你的 Vercel 域名
2. 重启后端服务

### 5.4 页面显示但样式错乱

**原因**:Next.js 静态导出 + Vercel 路由配置冲突

**解决**:
1. 确认 `outputDirectory` 是 `out`(不是 `.next`)
2. 确认未在 vercel.json 加 `rewrites` 规则(静态导出不支持)

### 5.5 自定义域名 HTTPS 证书未签发

**解决**:
1. 等待 30 分钟(DNS 传播)
2. Domains → 点域名 → 看错误提示
3. 确认 DNS 记录正确(用 https://dnschecker.org 验证)
4. 如仍失败,删除域名重新 Add

---

## 6. 性能优化

### 6.1 开启 ISR(增量静态再生)

`apps/web/next.config.ts` 中,部分页面可改为 `revalidate` 模式(但 Vercel 静态导出不支持 ISR,需去掉 `output: 'export'` 才能用)。

### 6.2 图片优化

Vercel 自动启用 `next/image` 优化,但静态导出模式下禁用。建议用 `<img>` + `loading="lazy"`。

### 6.3 边缘函数

如需边缘计算(如地理位置路由),改用 Vercel Edge Functions(在 `app/api/` 路由加 `export const runtime = 'edge'`)。

---

## 7. 升级到 Pro

免费层够个人使用,以下场景建议升级 Pro($20/月):

- 商业项目(需 SLA)
- 构建频繁超 100h/月
- 需要更大内存(8GB)
- 需要 Edge Functions 高并发
- 需要团队协作

升级:Settings → Billing → Upgrade to Pro

---

## 相关文档

- [一键部署总览](./one-click-deploy.md)
- [Railway 部署指南](./railway-deploy.md)
- [家人朋友代部署指南](./family-friends-guide.md)
- [Vercel 官方文档](https://vercel.com/docs)
- [Next.js 静态导出文档](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
