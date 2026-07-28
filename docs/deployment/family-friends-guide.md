# 家人朋友代部署指南

> **谢谢你帮忙部署这个项目!** 🙏
>
> 这份指南假设你**完全不懂代码**,只要跟着步骤一步步操作就行。每一步都写了"点击哪个按钮",遇到问题直接文末扫码联系。
>
> **预计耗时**:30-60 分钟(主要是等待构建,实际操作 ~15 分钟)
> **费用**:免费(用各平台免费额度,够个人使用)

---

## 这是在做什么?(1 分钟理解)

我们要把一个**网站**放到互联网上,让别人能访问。就像把一个 PPT 放到网盘上分享,但这个"PPT"是一个能用的 AI 网站。

需要放到 3 个"网盘"上:
1. **Vercel** — 放前端(用户看到的网页)
2. **Railway** — 放后端(处理数据的服务器)+ 数据库(存用户信息)
3. **Render** — 放 AI 服务(调用 AI 模型的服务器)

**为什么不放一个地方?** 因为免费版各有专长,分开能用免费额度搭出一个完整系统。

---

## 准备工作(5 分钟)

### 注册 3 个账号

#### 1. 注册 GitHub(代码仓库)

1. 打开 https://github.com/signup
2. 填邮箱、密码、用户名
3. 完成邮箱验证(收邮件点链接)
4. ✅ 完成

> **截图占位**:![GitHub 注册页面](images/github-signup.png)

#### 2. 注册 Vercel(放前端)

1. 打开 https://vercel.com/signup
2. 点 **"Continue with GitHub"**(用 GitHub 账号登录,不用再记新密码)
3. 授权 Vercel 访问你的 GitHub
4. ✅ 完成

> **截图占位**:![Vercel 注册页面](images/vercel-signup.png)

#### 3. 注册 Railway(放后端 + 数据库)

1. 打开 https://railway.app/login
2. 点 **"Login with GitHub"**
3. 授权 Railway 访问你的 GitHub
4. ✅ 完成

> **截图占位**:![Railway 登录页面](images/railway-login.png)

#### 4. 注册 Render(放 AI 服务)

1. 打开 https://render.com/register
2. 点 **"GitHub"** 图标登录
3. 授权 Render 访问你的 GitHub
4. ✅ 完成

> **截图占位**:![Render 注册页面](images/render-register.png)

---

## 步骤 1:Fork 仓库(2 分钟)

"Fork" = 把别人的代码仓库复制一份到你自己的 GitHub 账号下,这样你就有权限部署了。

1. 打开 https://github.com/IHUI-INF-AI/IHUI-AI
2. 点右上角 **"Fork"** 按钮(像个分叉的图标)
3. 页面跳转后,直接点 **"Create fork"** 绿色按钮(不用改任何设置)
4. 等待 3-5 秒,页面会自动跳转到 `https://github.com/你的用户名/IHUI-AI`
5. ✅ 完成

> **截图占位**:![Fork 按钮](images/fork-button.png)
> **截图占位**:![Create fork 确认](images/create-fork.png)

---

## 步骤 2:部署前端到 Vercel(10 分钟)

### 2.1 点击部署按钮

在项目 README 里找到 Vercel 按钮,点击它。或者直接访问:

```
https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/IHUI-AI
```

> **注意**:把上面的 `你的用户名` 替换成你的 GitHub 用户名。

### 2.2 配置项目

1. **Import Project** 页面:
   - 选择你 Fork 的 `IHUI-AI` 仓库
   - 点 **"Import"**

2. **Configure Project** 页面:
   - **Framework Preset**:自动识别为 Next.js(不用改)
   - **Root Directory**:点 "Edit",输入 `apps/web`,点 Select
   - **Build Command**:自动识别(不用改)
   - **Install Command**:自动识别(不用改)

3. **Environment Variables** 区域(重要!):
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: 先留空(等步骤 3 拿到 API 地址再回来填)
   - 点 **"Add"**

4. 点 **"Deploy"** 蓝色按钮

### 2.3 等待构建

- 页面会显示构建日志,耐心等 3-5 分钟
- 看到 **"Congratulations"** 大字 + 烟花动画 = 部署成功 🎉
- **先别关闭页面**,记下 Vercel 给你的域名(类似 `ihui-ai-xxx.vercel.app`)
- 点 "Visit" 看一下,此时页面可能报错(因为后端还没部署),**正常**,继续下一步

> **截图占位**:![Vercel 构建成功](images/vercel-success.png)

---

## 步骤 3:部署后端 API 到 Railway(15 分钟)

### 3.1 点击部署按钮

在项目 README 里找 Railway 按钮,点击。或访问:

```
https://railway.app/new/template?template=https://github.com/你的用户名/IHUI-AI
```

### 3.2 配置项目

1. **Create New Project** 页面:
   - 选择你 Fork 的 `IHUI-AI` 仓库
   - 点 **"Deploy"**

2. Railway 会自动识别 `railway.json`,开始构建
- 等待 2-3 分钟构建完成

### 3.3 添加数据库

1. 在 Railway 项目页面,点 **"+"** (New) 按钮
2. 选 **"Database"** → **"PostgreSQL"**
3. 等待 30 秒,数据库创建完成
4. 同样步骤加一个 **"Redis"** 数据库

> **截图占位**:![Railway 添加数据库](images/railway-add-db.png)

### 3.4 连接数据库到 API 服务

1. 点新建的 **PostgreSQL** 服务
2. 点 **"Connect"** 标签页
3. 复制 **"Postgres Connection URL"**(类似 `postgresql://...`)
4. 回到 **ihui-api** 服务
5. 点 **"Variables"** 标签页
6. 添加变量:
   - Name: `DATABASE_URL`
   - Value: 粘贴刚才复制的连接串
7. 重复同样步骤,把 **Redis** 的连接串加到 `REDIS_URL` 变量

### 3.5 生成密钥

在 **ihui-api** 的 Variables 标签页,添加以下变量(每项都要点 "Add"):

| 变量名 | 值 |
| ------ | -- |
| `JWT_SECRET` | 点 "Generate" 按钮自动生成(或访问 https://generate-secret.vercel.app/ 复制) |
| `CREDENTIALS_ENCRYPTION_KEY` | 同上,生成一个新随机串 |
| `AI_CALLBACK_SECRET` | 同上,再生成一个 |
| `CORS_ORIGIN` | 填你的 Vercel 域名(步骤 2.3 记下的,如 `https://ihui-ai-xxx.vercel.app`) |
| `AI_SERVICE_URL` | 先留空(等步骤 4 拿到 AI 服务地址再填) |

### 3.6 获取 API 域名

1. 在 **ihui-api** 服务,点 **"Settings"** 标签页
2. 找 **"Networking"** 区域,点 **"Generate Domain"**
3. Railway 分配一个域名(类似 `ihui-api-production.up.railway.app`)
4. **记下这个域名**(步骤 5 要用)

> **截图占位**:![Railway 生成域名](images/railway-domain.png)

### 3.7 验证 API

1. 浏览器访问 `https://你的-api-域名/api/health`
2. 应该看到 `{"status":"ok"}` 或类似的 JSON 响应
3. ✅ 后端部署成功

---

## 步骤 4:部署 AI 服务到 Render(10 分钟)

### 4.1 点击部署按钮

在项目 README 找 Render 按钮,点击。或访问:

```
https://render.com/deploy?repo=https://github.com/你的用户名/IHUI-AI
```

### 4.2 配置服务

1. Render 自动读取 `render.yaml`,显示要创建的服务清单:
   - `ihui-web`(我们用 Vercel 部署前端,可以**删除**这个)
   - `ihui-api`(同上,可以**删除**这个)
   - `ihui-ai-service`(这个是我们需要的)
   - `ihui-postgres`(数据库,可以删除,因为 Railway 已有)
   - `ihui-redis`(同上,可删除)

2. **简化操作**:只保留 `ihui-ai-service`,其他都点 **"Delete"**

3. 在 `ihui-ai-service` 配置:
   - **Name**: `ihui-ai-service`(或你喜欢的名字)
   - **Region**: `Oregon` 或 `Frankfurt`(选离你近的)
   - **Branch**: `main`
   - **Plan**: `Free`

4. **Environment Variables** 区域:
   - `DATABASE_URL`:从 Railway PostgreSQL 复制(同步骤 3.4)
   - `REDIS_URL`:从 Railway Redis 复制
   - `API_SERVICE_URL`:填 Railway API 域名(步骤 3.6,如 `https://ihui-api-production.up.railway.app`)
   - `AI_CALLBACK_SECRET`:填步骤 3.5 同名的同一个值(**必须和 API 一致**)
   - `OPENAI_API_KEY`:如果有的话填(可选,不填则 AI 返回模拟响应)

5. 点 **"Apply"** 按钮

### 4.3 等待构建

- Render 会构建 5-10 分钟(第一次构建较慢)
- 构建完成后,服务状态变成 **"Live"**
- **记下 Render 给的域名**(类似 `https://ihui-ai-service.onrender.com`)

> **截图占位**:![Render 部署成功](images/render-live.png)

---

## 步骤 5:连接三个服务(关键!)

现在三个服务都部署好了,但它们互相不知道对方在哪。需要配置环境变量让它们连起来。

### 5.1 回到 Vercel 配置前端

1. 打开 Vercel 项目 → Settings → Environment Variables
2. 找到 `NEXT_PUBLIC_API_URL`,把值改为 Railway API 域名:
   ```
   https://ihui-api-production.up.railway.app
   ```
   (替换为你的实际域名,结尾**不要**加 `/`)
3. 点 **"Save"**
4. 回到 Deployments 标签页 → 点最近一次部署右侧 **"..."** → **"Redeploy"** → 确认
5. 等 2-3 分钟重新构建

### 5.2 回到 Railway 配置 API

1. Railway → ihui-api → Variables
2. 找到 `AI_SERVICE_URL`,把值改为 Render AI 服务域名:
   ```
   https://ihui-ai-service.onrender.com
   ```
3. 服务会自动重启(无需手动操作)

---

## 步骤 6:验证部署 🎉

### 6.1 访问首页

打开浏览器,访问你的 **Vercel 前端域名**(如 `https://ihui-ai-xxx.vercel.app`):

- ✅ 看到首页(有 Logo、导航栏)
- ✅ 中英文切换正常(右上角语言选择)
- ✅ 主题切换正常(右上角太阳/月亮图标)

### 6.2 测试注册登录

1. 点右上角 **"注册"**
2. 填邮箱 + 密码 → 点注册
3. ✅ 注册成功(说明 API + 数据库连通)

### 6.3 测试 AI 对话

1. 登录后,进入 **"AI 对话"** 页面
2. 输入 "你好",点发送
3. ✅ 收到 AI 回复(说明 AI 服务连通)

> 如果收到 "stub response" 或模拟响应 → 说明 AI 服务没配 API Key,回 Render 配 `OPENAI_API_KEY`

### 6.4 测试支付(可选)

1. 进入"个人中心" → "充值"
2. 看到支付页面(微信/支付宝/Stripe 选项)

> 支付需要配置商户号和证书,详细见根目录 `.env.example` 的支付部分

---

## 步骤 7:配置自定义域名(可选)

如果不想用 `ihui-ai-xxx.vercel.app` 这种长域名,可以绑定自己的域名。

### 7.1 Vercel 绑定域名

1. Vercel 项目 → Settings → Domains
2. 输入你的域名(如 `www.yourname.com`)→ Add
3. 按提示去你的域名注册商配置 DNS:
   - 加一条 `CNAME` 记录,指向 `cname.vercel-dns.com`
4. 等 DNS 生效(5-30 分钟),Vercel 自动签发 SSL 证书

### 7.2 用免费域名

- **Freenom**(.tk/.ml/.ga)— 免费注册,但近年不稳定
- **Cloudflare Pages** — 可在 Cloudflare 注册便宜域名(.com ~$9/年)

---

## 常见问题

### Q1:Vercel 构建失败,红色错误

**最常见原因**:内存不足(Next.js 构建需要大内存)

**解决**:
1. Vercel → Settings → Environment Variables
2. 加一条:`NODE_OPTIONS` = `--max-old-space-size=4096`
3. Redeploy

### Q2:Railway 服务一直 "Building" 不结束

**正常**:第一次构建需要 3-5 分钟。如果超过 10 分钟:
1. 点服务 → Deployments 标签 → 看日志
2. 把错误日志截图发给我们(联系方式见文末)

### Q3:前端能打开但"注册"按钮无反应

**原因**:前端没配 `NEXT_PUBLIC_API_URL` 或配错了

**解决**:
1. Vercel → Settings → Environment Variables
2. 检查 `NEXT_PUBLIC_API_URL` 是否等于你的 Railway API 域名
3. 必须 Redeploy 才生效

### Q4:注册时报 "Network Error" 或 "CORS"

**原因**:后端 `CORS_ORIGIN` 没配你的前端域名

**解决**:
1. Railway → ihui-api → Variables
2. `CORS_ORIGIN` 填你的 Vercel 域名(如 `https://ihui-ai-xxx.vercel.app`)
3. 服务自动重启

### Q5:AI 对话报 "stub response"

**原因**:AI 服务没配任何 LLM API Key

**解决**:
1. Render → ihui-ai-service → Environment
2. 至少配一个:`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `STEPFUN_API_KEY`
3. 手动重启服务(Manual Deploy → Clear cache → Deploy)

### Q6:Render 服务 15 分钟后访问很慢

**原因**:Render 免费层 15 分钟无流量自动休眠,唤醒需 50 秒

**解决**:升级 Render Starter($7/月);或用 https://uptimerobot.com 免费 ping(每 10 分钟访问一次,保持唤醒)

### Q7:完全卡住了,不知道哪一步错了

**别急**,截图发给我们:
- 微信客服:`ok502319984`
- 邮箱:502319984@qq.com
- 邮箱:business@aizhs.top

---

## 联系方式

遇到任何问题,或想感谢部署成功:

| 渠道 | 账号 | 响应时间 |
| ---- | ---- | -------- |
| 微信客服 | `ok502319984` | 24h 内 |
| 邮箱 | 502319984@qq.com | 24h 内 |
| 邮箱 | business@aizhs.top | 24h 内 |
| GitHub Issue | https://github.com/IHUI-INF-AI/IHUI-AI/issues | 48h 内 |

---

## 视频教程(即将录制)

- 📹 部署全流程录屏(15 分钟)— 录制中,完成后在此贴链接
- 📹 常见问题排查录屏(10 分钟)— 录制中

---

## 致谢

谢谢你帮我们部署项目。你的支持让这个开源 AI 平台能服务更多人。

如果部署成功,欢迎在 GitHub 给我们点个 ⭐ Star:https://github.com/IHUI-INF-AI/IHUI-AI

—— IHUI-AI 团队
