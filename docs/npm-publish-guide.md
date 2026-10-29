<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI npm 包发布指南

> **先读这一节 —— 本指南此前是"待执行 how-to",下列事实为 2026-10-18 实测,与正文冲突时以本节为准。**
>
> | 事项 | 实测结论 |
> | --- | --- |
> | 是否已发布 | `ihui-cli@1.0.0` **已发布**(2026-10-19,`latest=1.0.0`,安装实测通过);`@ihui-ai/sdk` 仍 404 未发布 |
> | 发布凭据 | ✅ 本地已有 granular token `ihui-cli-publish`(`bypass_2fa: true`,All packages,read-write,到期 2027-01-17),写在用户级 `~/.npmrc` 的 `//registry.npmjs.org/:_authToken`;备份在仓库外 `D:\DevEnv\secrets\npm-token-ihui-cli-2026-10-19.txt`。**这是 CLI 与 SDK 的唯一发布通道**(不启用 2FA,故不用 OIDC) |
> | OIDC 免 token 发布 | ⛔ **已放弃(用户定案)**:不启用 2FA、不登记 Trusted Publisher。原卡点:npm 要求包设置类操作做 WebAuthn step-up,网页提交后强制跳 `/settings/<user>/tfa` 的 `Add your security key`,无邮箱 OTP 分支 |
> | 当前可用的发布方式 | ✅ 唯一通道:**granular token(`bypass_2fa`)**。本地 `npm publish ./npm-dist --access public`;CI 由 `release-cli.yml` 回退 `secrets.NPM_PUBLISH_TOKEN` 发布(无 provenance)。`cli-v*` 的 OIDC 步骤会失败后自动回退,属预期行为 |
> | `@ihui` scope | `ihui-cli` 是 **unscoped 包名**,与 `@ihui` scope 归属无关,不存在"scope 被占用"问题;`@ihui` scope 只影响 `@ihui-ai/sdk` 等 SDK 包(发布前仍需 `npm org ls ihui` 确认) |
> | 本指南适用包 | npm 侧当前有两个目标:CLI 发 **`ihui-cli`**(unscoped,单文件 bundle,见 §11);SDK 只发 **`@ihui-ai/sdk`**。`@ihui/types` / `@ihui/api-client` / `@ihui/ui-react` / `@ihui/design-tokens` 仍是 `private: true` 的内部包(理由见 §4.6) |
> | 发布通道 | 不是本文件 §7 提议的 `npm-publish.yml`,而是已存在的 **`.github/workflows/release-sdk.yml`**(`sdk-v*` tag)与 **`release-cli.yml`**(`cli-v*` tag,已切 OIDC) |
> | 仓库 registry 陷阱 | 根 `.npmrc` 写的是 `registry=https://registry.npmmirror.com`(**第三方镜像**)。项目级 `.npmrc` 优先级高于 `setup-node` 写的用户级配置 → 缺 `publishConfig.registry` 的包会**把代码推给镜像站**。`@ihui-ai/sdk` / `ihui-cli` 已显式锁 `registry.npmjs.org` |
> | 已完成的可安装性修复 | `@ihui-ai/sdk`:`main`/`types`/`exports` → `dist`、`files` 白名单、`license: Apache-2.0`、`@ihui/types` 降为 devDependency、`prepack` 构建+附带 `LICENSE`/`NOTICE`。tarball 由 **253 文件 / 1.39MB(含 java/go/dotnet/python 四棵源码树、src、tests、`.turbo` 日志、tsbuildinfo)** 降到 **76 文件 / 0.23MB(dist + LICENSE + NOTICE + README)**。已用真实 tarball 装入干净工程验证:`npm i` 成功、`import` 成功、`tsc --noEmit`(skipLibCheck:true)**exit 0** |
>
> **⛔ 最终决策(2026-10-19,用户明确指示):永久不启用 2FA / 不绑定任何 WebAuthn 认证器,因此不登记 Trusted Publisher。**
> 该结论已定案 —— 后续任何 agent 会话**不得再提议、不得再询问**扫码绑定安全密钥、Windows Hello、USB key 或 TOTP 等 2FA 方案。
> npm 发布永久走 **granular token(`bypass_2fa`)** 这条通道,本地与 CI 均已验证可用(CI 由 `NPM_PUBLISH_TOKEN` 回退发布,代价是没有 Sigstore provenance)。
> 此路不通的实测证据保留在 §7.2(仅供追溯,不是待办)。
>
> 仍缺的东西(与非 2FA 路径无关):
> - SDK 侧仍需 `NPM_TOKEN`;PyPI 项目 `ihui-ai` + `PYPI_TOKEN`;若要发 Java/.NET,还需 Sonatype 账号 / GPG 与一个**尚不存在**的 NuGet workflow。
> - token 运维:`ihui-cli-publish` 到期日 **2027-01-17**,到期前需在 npm 网页 Tokens 页重新生成一个 granular token(同样勾 `Bypass 2FA`,无需任何认证器),替换 `~/.npmrc` 与 CI secret `NPM_PUBLISH_TOKEN`。
>
> ✅ 已不需要人工代办的:npm 账号 2FA 现状(`mode: auth-and-writes`,不绑认证器)、`ihui-cli` 首版 bootstrap(2026-10-19 已发 `1.0.0`)、发布凭据(内置浏览器网页表单创建的 granular token 已落盘并实测写权限)。

---

> 目的:把核心 packages 发布到 npm,增加曝光、便于集成、建立品牌。本指南详细到 AI agent 可照着执行。
>
> 适用包(均位于 `packages/` 下):`@ihui/types` / `@ihui-ai/sdk` / `@ihui/api-client` / `@ihui/ui-react` / `@ihui/design-tokens`
>
> 发布顺序(按依赖递推):`types` → `design-tokens` → `ui-react` → `sdk` → `api-client`
>
> ⚠️ 上面这条"5 包全发"是原始设想,**当前对外只发两个包:`ihui-cli`(CLI,unscoped,不依赖 `@ihui/*`)与 `@ihui-ai/sdk`**(其余 4 个保持 private,理由见 §4.6 与 §11)。

---

## 1. 为什么发布到 npm

| 价值维度 | 说明 |
| --- | --- |
| 增加曝光 | npm 月活 1700 万开发者,`npm view` / unpkg / jsDelivr 自然流量;SEO 反哺 GitHub star |
| 便于集成 | 用户 `pnpm add @ihui-ai/sdk` 即可用,无需 clone 仓库;CI/CD 友好 |
| 建立品牌 | `@ihui` scope 占位,建立"全栈 AI 平台"心智;对比 Dify/Coze 的 npm 包更显专业 |
| 版本可信 | semver + tag + changelog,用户敢用于生产;Apache 2.0 商业友好 |
| 跨端复用 | 9 端代码同源,SDK 一处发布、多端调用;降低集成摩擦 |

---

## 2. 待发布包清单

| 包名 | 路径 | 依赖 | 首版本 | 备注 |
| --- | --- | --- | --- | --- |
| `@ihui/types` | `packages/types` | 无 | `0.1.0` | 最基础,优先发布 |
| `@ihui/design-tokens` | `packages/design-tokens` | `clsx` / `tailwind-merge` / `cva` | `0.1.0` | 设计令牌,无业务依赖 |
| `@ihui/ui-react` | `packages/ui-react` | `@ihui/design-tokens` + Radix UI | `0.1.0` | React 19 组件库 |
| `@ihui-ai/sdk` | `packages/sdk` | `@ihui/types` | `0.1.0` | JS/TS SDK,API 调用封装 |
| `@ihui/api-client` | `packages/api-client` | `@ihui/types` | `0.1.0` | 完整 API 客户端,4561 路由 |

> **scope 策略**:统一用 `@ihui` scope,scoped 包默认私有,发布必须带 `--access public`。

---

## 3. 发布前准备(一次性)

### 3.1 注册 npm 账号

1. 访问 https://www.npmjs.com/signup 注册账号
2. ~~开启 2FA(Settings → Account Security → Two-Factor Authentication → `auth_and_writes`)~~ —— ⛔ **不做**。用户 2026-10-19 定案:永久不启用 2FA(AGENTS.md §0 第 11 条)。发布凭据改用 granular token 并勾 `Bypass 2FA`,见 §7.2
3. 在 npm 上创建 `@ihui` organization:https://www.npmjs.com/org/create
   - org name: `ihui`
   - 选择 **Free**( unlimited public packages,仅私有权益收费)

### 3.2 本地登录

```bash
# 全局登录(会打开浏览器)
npm login

# 验证登录成功
npm whoami
# 期望输出: 你的 npm 用户名

# 验证 org 创建成功
npm org ls ihui
```

### 3.3 检查包名可用性

```bash
# 逐个检查(404 = 可用,200 = 已占用)
npm view ihui-cli            # unscoped,已发布 1.0.0(2026-10-19),回读 200
npm view @ihui/types
npm view @ihui/design-tokens
npm view @ihui/ui-react
npm view @ihui-ai/sdk
npm view @ihui/api-client
```

期望 `@ihui/*` 全部返回 `npm error code E404`(表示未占用,可发布);`ihui-cli` 已发布,回读 200 属正常。

### 3.4 registry 配置(⚠️ 本仓库有真实陷阱)

仓库根**已存在**被 git 跟踪的 `.npmrc`,内容是:

```ini
registry=https://registry.npmmirror.com   # ← 第三方镜像,不是 npm 官方
```

npm 的配置优先级里**项目级 `.npmrc` 高于用户级**,所以 GitHub Actions 里 `setup-node` 的
`registry-url` 压不过它。不带显式 registry 的 `npm publish` 会**把包 PUT 到 npmmirror**。

正确做法(**已在 `@ihui-ai/sdk` / `ihui-cli` 落地**,不要再依赖命令行习惯):

```jsonc
// packages/<pkg>/package.json —— 包级锁死,优先级最高,任何环境都生效
"publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }
```

如仍想在仓库根兜底,可加一行 scope 级覆盖(与 publishConfig 双保险):

```ini
# 追加到根 .npmrc(注意:根 .npmrc 会同时影响 pnpm 安装行为,改前先确认不会拖慢国内安装)
@ihui:registry=https://registry.npmjs.org/
```

> 旧版本节推荐的 `always-auth=true` 已被 npm 9+ 废弃(会被忽略并 warn),不要照抄。
> `link-workspace-packages` / `prefer-workspace-packages` 属于 pnpm 配置,本仓库放在
> `pnpm-workspace.yaml` 与根 `.npmrc`,与发布无关。

---

## 4. package.json 修改模板(逐包)

### 4.1 通用规则(所有包)

**修改前(开发态,workspace 内消费)**:
```jsonc
{
  "name": "@ihui/xxx",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  }
}
```

**修改后(可发布,dist 产物)**:
```jsonc
{
  "name": "@ihui/xxx",
  "version": "0.1.0",
  "private": false,
  "description": "IHUI-AI xxx 包 - 一句话描述",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "sideEffects": false,
  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prepublishOnly": "pnpm run build && pnpm run test",
    "prepack": "pnpm run build"
  },
  "keywords": [
    "ihui",
    "ihui-ai",
    "ai",
    "llm",
    "langgraph",
    "mcp",
    "a2a",
    "fullstack",
    "open-source"
  ],
  "author": "IHUI-AI <[REDACTED-EMAIL]>",
  "license": "Apache-2.0",
  "homepage": "https://github.com/IHUI-INF-AI/IHUI-AI#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IHUI-INF-AI/IHUI-AI.git",
    "directory": "packages/xxx"
  },
  "bugs": {
    "url": "https://github.com/IHUI-INF-AI/IHUI-AI/issues"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### 4.2 @ihui/types 完整配置

`packages/types/package.json`:

```jsonc
{
  "name": "@ihui/types",
  "version": "0.1.0",
  "private": false,
  "description": "IHUI-AI 共享类型定义包 - 9 端同源的 TypeScript 类型契约",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./user": {
      "types": "./dist/user.d.ts",
      "import": "./dist/user.js"
    },
    "./api": {
      "types": "./dist/api.d.ts",
      "import": "./dist/api.js"
    },
    "./ai": {
      "types": "./dist/ai.d.ts",
      "import": "./dist/ai.js"
    },
    "./message-repair": {
      "types": "./dist/message-repair.d.ts",
      "import": "./dist/message-repair.js"
    },
    "./workspace": {
      "types": "./dist/workspace.d.ts",
      "import": "./dist/workspace.js"
    },
    "./api-contracts": {
      "types": "./dist/api-contracts.d.ts",
      "import": "./dist/api-contracts.js"
    },
    "./orchestration": {
      "types": "./dist/orchestration.d.ts",
      "import": "./dist/orchestration.js"
    }
  },
  "sideEffects": false,
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prepublishOnly": "pnpm run build && pnpm run test"
  },
  "keywords": ["ihui", "ihui-ai", "ai", "llm", "typescript", "types", "shared-types", "fullstack"],
  "author": "IHUI-AI <[REDACTED-EMAIL]>",
  "license": "Apache-2.0",
  "homepage": "https://github.com/IHUI-INF-AI/IHUI-AI#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IHUI-INF-AI/IHUI-AI.git",
    "directory": "packages/types"
  },
  "bugs": { "url": "https://github.com/IHUI-INF-AI/IHUI-AI/issues" },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "engines": { "node": ">=18.0.0" }
}
```

### 4.3 @ihui/design-tokens 完整配置

```jsonc
{
  "name": "@ihui/design-tokens",
  "version": "0.1.0",
  "private": false,
  "description": "IHUI-AI 设计令牌(9 端共享):cn() 类名合并 + tokens 色板/间距/字号/圆角/阴影/z-index,JS 对象 + CSS 变量双形式",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./styles/tokens.css": "./dist/styles/tokens.css"
  },
  "sideEffects": ["**/*.css"],
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "pnpm run build"
  },
  "keywords": ["ihui", "design-tokens", "design-system", "tailwind", "css-variables", "react-native"],
  "author": "IHUI-AI <[REDACTED-EMAIL]>",
  "license": "Apache-2.0",
  "homepage": "https://github.com/IHUI-INF-AI/IHUI-AI#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IHUI-INF-AI/IHUI-AI.git",
    "directory": "packages/design-tokens"
  },
  "bugs": { "url": "https://github.com/IHUI-INF-AI/IHUI-AI/issues" },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "engines": { "node": ">=18.0.0" },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5"
  }
}
```

### 4.4 @ihui/ui-react 完整配置

```jsonc
{
  "name": "@ihui/ui-react",
  "version": "0.1.0",
  "private": false,
  "description": "IHUI-AI React 19 UI 组件库 - 基于 Radix UI + Tailwind 4,9 端共享",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "sideEffects": ["**/*.css"],
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "pnpm run build"
  },
  "keywords": ["ihui", "react", "ui", "components", "radix-ui", "tailwind", "shadcn", "design-system"],
  "author": "IHUI-AI <[REDACTED-EMAIL]>",
  "license": "Apache-2.0",
  "homepage": "https://github.com/IHUI-INF-AI/IHUI-AI#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IHUI-INF-AI/IHUI-AI.git",
    "directory": "packages/ui-react"
  },
  "bugs": { "url": "https://github.com/IHUI-INF-AI/IHUI-AI/issues" },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "engines": { "node": ">=18.0.0" },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "dependencies": {
    "@ihui/design-tokens": "^0.1.0",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-switch": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.2",
    "@radix-ui/react-tooltip": "^1.1.6",
    "@radix-ui/react-checkbox": "^1.1.3",
    "@tanstack/react-table": "^8.20.5",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.460.0"
  }
}
```

> **关键变更**:`workspace:*` → `^0.1.0`,确保 npm 端能解析依赖。

### 4.5 @ihui-ai/sdk 完整配置(**已落地,与仓库实际一致**)

`packages/sdk/package.json` 现状 —— 这不是模板,是已提交的实际内容:

```jsonc
{
  "name": "@ihui-ai/sdk",
  "version": "0.1.0",
  "description": "IHUI AI (智汇AI) 官方 TypeScript SDK — 对话 / 图像 / 音频 / 视频 / 知识库 / 记忆 / Agent 全能力客户端",
  "license": "Apache-2.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "engines": { "node": ">=18.0.0" },
  "files": ["dist", "README.md", "LICENSE", "NOTICE"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "prepack": "node scripts/prepack.mjs"
  },
  "dependencies": {},
  "devDependencies": {
    "@ihui/tsconfig": "workspace:*",
    "@ihui/types": "workspace:*",   // 纯类型引用 → devDep,发行包不需要它
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IHUI-INF-AI/IHUI-AI.git",
    "directory": "packages/sdk"
  },
  "bugs": { "url": "https://github.com/IHUI-INF-AI/IHUI-AI/issues" }
}
```

与 §4.1 通用模板的**有意偏差**(照抄模板会发坏包):

| 模板写法 | SDK 实际 | 为什么 |
| --- | --- | --- |
| `main: "./dist/index.cjs"` + `exports.require` | 只有 `import`,无 `require` | 构建器是 `tsc`,只产 ESM。声明一个不存在的 `.cjs` 入口,CJS 消费者 `require('@ihui-ai/sdk')` 直接 `ERR_MODULE_NOT_FOUND` |
| `build: "tsup"` | `build: "tsc -p tsconfig.json"` | 不为此新增 devDependency(会改 `pnpm-lock.yaml`);`tsc` 已能产出 `dist/*.js` + `*.d.ts` + `.map`,实测 72 个产物文件足够 |
| `prepublishOnly: "build && test"` | `prepack: "node scripts/prepack.mjs"` | `prepublishOnly` 只在 `npm publish` 跑,`npm pack` / 私有镜像同步都不跑;`prepack` 两种路径都覆盖,并且顺带把根 `LICENSE`/`NOTICE` 复制进包目录(§4 分发要求)+ 自检"入口指 dist / 无 workspace 依赖 / files 含 dist",任一不满足直接 exit 1 拒绝出包 |
| `files: [dist, README.md, LICENSE, CHANGELOG.md]` | `[dist, README.md, LICENSE, NOTICE]` | 本仓库无 CHANGELOG.md(变更记录统一在 `docs/CHANGELOG.md`,AGENTS.md §1 禁止另立计划/变更文件);NOTICE 是 Apache-2.0 第 4 条要求随副本分发的 |

> **`LICENSE` / `NOTICE` 为什么不提交进 `packages/sdk/`**:由 `prepack` 从仓库根复制,
> 已在 `packages/sdk/.gitignore` 忽略。提交副本 = 法律文本第二真相源,迟早与根文件漂移。
> 注意 npm 的行为:`files` 白名单**优先于** ignore 规则,所以被 gitignore 的生成物照样能打进 tarball(已实测)。

### 4.6 @ihui/api-client —— **决策:不对外发布,保持 `private: true`**

> 本节旧版给出的"`private: false` + tsup + dist 入口"模板**没有执行,也不该执行**。记录决策与依据,
> 防止下一轮又被"看起来更开放"地翻掉。

`@ihui/api-client` 是**内部传输层**,不是对外产品:

1. **消费方式**:9 端经 workspace 按源码直接 `import { ... } from '@ihui/api-client/endpoints/xxx'`,
   依赖 AGENTS.md §3 的"所有 API 调用必须走 `@ihui/api-client`"约束。它是**仓库内规范**,不是对外契约。
2. **对外契约已由 `@ihui-ai/sdk` 承担**:同一份 REST 面发两个高度重叠的 npm 包,只会让外部使用者困惑。
3. **翻了也发不出去**:它的 `dependencies` 是 `{ "@ihui/types": "workspace:*" }`,而 `@ihui/types` 仍是
   `private: true`。去 private 只会把失败从"入口不可用"推到"安装 404"。
4. **入口指 `src` 在仓库内是对的**:`packages/` 下 16 个包**全部**是 `main/types → ./src/index.ts`
   的"source package"约定,由 `turbo` 的 `dev.dependsOn: ["^build"]` 串构建。单独把 api-client 翻成
   `dist` 会打破这个一致性,并让 `pnpm dev` 必须先构建该包,收益为零。
5. **它并非"缺构建"**:`build: "tsc"` 实测可用(`pnpm --filter @ihui/api-client build` exit 0,
   `packages/api-client/dist/` 正常产出 `.js` + `.d.ts` + `.map`),只是不用于发布。

**若将来确实要发布**(例如开放第三方集成方直连 REST):需要一并处理 ①`@ihui/types` 的发布
(见 `docs/RELEASE.md` "SDK 类型面遗留问题"),②补 `license` / `repository` / `publishConfig.registry` /
`files`(现在这 4 项全缺),③决定 100 个 `src/**` 与 14 个 `tests/**` 是否要排除 —— 当前没有 `files`
字段,`npm pack` 实测打出 **510 文件 / 3.01MB**,含 `src/`、`tests/`、`scripts/`、`eslint.config.js`、
`.turbo/turbo-*.log`、`tsconfig.tsbuildinfo`。

> **通用陷阱(与 private 无关,值得单独记)**:npm 打包**只认包目录自己的 ignore 文件**,
> 仓库根的 `.gitignore`(`dist/`、`.turbo/`、`tsconfig.tsbuildinfo`)**对 `npm pack` 不生效**。
> 所以"被 gitignore 了"绝不等于"不会进 tarball" —— 必须靠 `files` 白名单。本次体检中
> `@ihui/api-client` 与 `@ihui-ai/sdk` 都实打实把 `.turbo/*.log` 和 `tsconfig.tsbuildinfo` 打了进去。

---

## 5. 构建配置:tsup

### 5.1 安装 tsup

每个待发布的包都需要安装 tsup 作为 devDependency:

```bash
pnpm --filter @ihui/types add -D tsup
pnpm --filter @ihui/design-tokens add -D tsup
pnpm --filter @ihui/ui-react add -D tsup
pnpm --filter @ihui-ai/sdk add -D tsup
pnpm --filter @ihui/api-client add -D tsup
```

### 5.2 tsup.config.ts(通用模板)

每个包根目录创建 `tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,                  // 生成 .d.ts
  sourcemap: true,            // 生成 .map
  clean: true,                // 构建前清空 dist
  treeshake: true,            // 死代码消除
  target: 'es2020',
  platform: 'node',
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.js' : '.cjs',
  }),
  // 保留 import.meta.url 等 ESM 语义
  preserveNodeExternals: false,
  // external: 显式声明不打包的依赖
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@ihui/types',
    '@ihui/design-tokens',
  ],
});
```

### 5.3 多入口包的 tsup 配置(types / api-client)

`packages/types/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/user.ts',
    'src/api.ts',
    'src/ai.ts',
    'src/message-repair.ts',
    'src/workspace.ts',
    'src/api-contracts.ts',
    'src/orchestration.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.js' : '.cjs',
  }),
});
```

### 5.4 ui-react 特殊配置(含 CSS)

`packages/ui-react/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  // React 组件库外部化
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@ihui/design-tokens',
    '@radix-ui/react-slot',
    '@radix-ui/react-dialog',
    '@radix-ui/react-label',
    '@radix-ui/react-select',
    '@radix-ui/react-switch',
    '@radix-ui/react-tabs',
    '@radix-ui/react-tooltip',
    '@radix-ui/react-checkbox',
    '@tanstack/react-table',
    'class-variance-authority',
    'lucide-react',
  ],
  // 不注入 React import(让用户自己控制)
  injectStyle: false,
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.js' : '.cjs',
  }),
});
```

### 5.5 design-tokens 特殊配置(含 CSS 资源)

`packages/design-tokens/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync } from 'node:fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  external: ['class-variance-authority', 'clsx', 'tailwind-merge'],
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.js' : '.cjs',
  }),
  // 构建后拷贝 CSS 资源到 dist
  async onSuccess() {
    mkdirSync('dist/styles', { recursive: true });
    copyFileSync('src/styles/tokens.css', 'dist/styles/tokens.css');
    console.log('✓ Copied tokens.css → dist/styles/tokens.css');
  },
});
```

---

## 6. 发布流程

### 6.1 首次发布(以 @ihui/types 为例)

```bash
# 1. 切到包目录
cd packages/types

# 2. 验证 package.json 已按 §4.2 修改
cat package.json | grep -E '"version"|"private"|"publishConfig"'

# 3. 本地构建 + 测试
pnpm install
pnpm run build
pnpm run test

# 4. 预览即将发布的文件
npm pack --dry-run
# 检查输出只包含 dist/ README.md LICENSE,不能含 src/ tests/ 等

# 5. 发布(scoped 包必须 --access public)
npm publish --access public

# 6. 验证发布成功
npm view @ihui/types
# 期望返回包元数据,包含 versions: [ '0.1.0' ]
```

### 6.2 后续包发布

按依赖顺序:
```bash
# 1. design-tokens(无 @ihui 依赖)
cd packages/design-tokens && npm publish --access public

# 2. ui-react(依赖 @ihui/design-tokens,需等 1 发布后)
cd packages/ui-react && npm publish --access public

# 3. sdk(依赖 @ihui/types,需等首次发布后)
cd packages/sdk && npm publish --access public

# 4. api-client(依赖 @ihui/types)
cd packages/api-client && npm publish --access public
```

### 6.3 版本升级(semver)

```bash
# patch: bug 修复(0.1.0 → 0.1.1)
pnpm version patch
git push --follow-tags
npm publish

# minor: 新功能向后兼容(0.1.0 → 0.2.0)
pnpm version minor
git push --follow-tags
npm publish

# major: 破坏性变更(0.1.0 → 1.0.0)
pnpm version major
git push --follow-tags
npm publish

# 预发布版本
pnpm version prerelease --preid beta   # 0.1.0 → 0.1.1-beta.0
npm publish --tag beta                  # 用 beta tag,不污染 latest
```

### 6.4 pnpm 工作区批量发布(可选)

在根目录 `package.json` 加 script:

```jsonc
{
  "scripts": {
    "publish:all": "pnpm -r --filter='./packages/*' run prepublishOnly && pnpm -r --filter='./packages/*' exec npm publish --access public"
  }
}
```

> **不推荐**:建议按依赖顺序逐个发布,便于排错。

---

## 7. CI 自动发布(GitHub Actions)

> **⚠️ 先别照抄本节。** 本节下面这段 `npm-publish.yml` 是当初的**提案,从未落地**
> (`ls .github/workflows/` 查无此文件)。真实在跑的发布通道是:
>
> | 通道 | 触发 tag | 发什么 | 状态 |
> | --- | --- | --- | --- |
> | `release-sdk.yml` | `sdk-v*` | npm `@ihui-ai/sdk` + PyPI `ihui-ai` + Maven + Go | 存在;2026-09-20 修掉"4 个 job 的 `if:` 在 push 事件下恒 false → 只 dry-run 不发布"的门控缺陷,并补齐 tarball 自检 / `twine check` 前置 / 发布后 registry 回读 |
> | `release-cli.yml` | `cli-v*` | npm `ihui-cli` + 6 二进制 + GHCR 镜像 | 存在;发布物已收口为单文件 bundle;首版 `1.0.0` 已 bootstrap 完成。npm 发布走 **token 通道**(OIDC 步骤失败后自动回退 `NPM_PUBLISH_TOKEN`,见 §11) |
> | `release-on-tag.yml` | `v*` | 只建 GitHub Release 页面 | 与包发布无关 |
>
> 下面 §7.1 保留提案原文仅作设计参考;**要发布请看 §7.5「实际发布步骤」**。

### 7.1 创建 `.github/workflows/npm-publish.yml`(提案,未采用)

```yaml
name: npm-publish

on:
  push:
    tags:
      - '@ihui/types@*'
      - '@ihui/design-tokens@*'
      - '@ihui/ui-react@*'
      - '@ihui-ai/sdk@*'
      - '@ihui/api-client@*'
  workflow_dispatch:
    inputs:
      package:
        description: 'Package to publish (types|design-tokens|ui-react|sdk|api-client)'
        required: true
        type: choice
        options:
          - types
          - design-tokens
          - ui-react
          - sdk
          - api-client

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          scope: '@ihui'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Resolve package name
        id: pkg
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "name=@ihui/${{ inputs.package }}" >> $GITHUB_OUTPUT
            echo "path=packages/${{ inputs.package }}" >> $GITHUB_OUTPUT
          else
            TAG="${GITHUB_REF#refs/tags/}"
            PKG_NAME="${TAG%@*}"
            PKG_PATH="packages/${PKG_NAME#@ihui/}"
            echo "name=$PKG_NAME" >> $GITHUB_OUTPUT
            echo "path=$PKG_PATH" >> $GITHUB_OUTPUT
          fi

      - name: Build
        run: pnpm --filter ${{ steps.pkg.outputs.name }} run build

      - name: Typecheck
        run: pnpm --filter ${{ steps.pkg.outputs.name }} run typecheck

      - name: Test
        run: pnpm --filter ${{ steps.pkg.outputs.name }} run test
        continue-on-error: true # 部分包无测试

      - name: Publish
        run: |
          cd ${{ steps.pkg.outputs.path }}
          npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}

      - name: Summary
        run: |
          echo "### Published ${{ steps.pkg.outputs.name }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "View on npm: https://www.npmjs.com/package/${{ steps.pkg.outputs.name }}" >> $GITHUB_STEP_SUMMARY
```

### 7.2 首版 bootstrap(已完成)+ Trusted Publisher(已终止,不再推进)

> ⛔ **2026-10-19 用户定案:不启用 2FA,不登记 Trusted Publisher。本节第 2 步仅作历史记录,不是待办,不得再询问用户绑定任何认证器。**

CLI(`ihui-cli`)的首版已用 granular token 发布完成;OIDC 链路保留在 workflow 里**仅作前向兼容**(失败即回退 token),不构成"以后启用 2FA"的路线 —— 用户已定案永久不启用,不存在该分支。
npm 只允许给**已存在**的包登记 trusted publisher,所以首版必须人工发一次 —— 这一步**已于 2026-10-19 完成**。

**第 1 步:首版 bootstrap —— ✅ 已完成**

```bash
# 等效命令(首版已于 2026-10-19 发布,此处仅留作复现记录)
pnpm --filter ihui-cli build:npm        # esbuild 单文件 bundle → apps/cli/npm-dist/
cd apps/cli && npm publish ./npm-dist --access public
npm view ihui-cli version --registry=https://registry.npmjs.org/   # 回读 = 1.0.0
npm view ihui-cli dist-tags --registry=https://registry.npmjs.org/ # 回读 = { latest: '1.0.0' }
```

当前状态:`ihui-cli@1.0.0` 在 npm 上可安装,`latest = 1.0.0`;本机凭据是 granular token
`ihui-cli-publish`(`bypass_2fa: true`,All packages,read-write,到期 2027-01-17),`npm dist-tag add`
实测写权限可用(无 OTP、无 403)。

**第 2 步:登记 Trusted Publisher —— ⛔ 已终止(用户明确不要 2FA,不再尝试)**

> 以下内容仅为 2026-10-19 实测记录,供日后追溯;不作为待办,任何 agent 不得据此再次提示用户绑定认证器。

npmjs.com → `ihui-cli` 包页面 → **Settings** → **Trusted Publishing** → Add publisher:

| 字段 | 值 |
| --- | --- |
| Repository owner | `IHUI-INF-AI` |
| Repository name | `IHUI-AI` |
| Workflow filename | `release-cli.yml` |
| Environment | 留空 |
| Allowed actions | 勾选 `Allow npm publish` |

2026-10-19 用内置浏览器实测到的真实卡点:

1. 表单可正常填写并点 `Set up`,随后跳转 `npm | Confirm Password to Continue`;
2. 输入账号密码后**不出现邮箱 OTP 输入框**,而是直接落到 `/settings/ihui-ai/tfa`;
3. 该页面只有 `Security key` 一个单选项 + `Continue`;点 `Continue` 进入 `Add your security key`
   (`Enter your security key name *` + `Add security key`),必须当场完成 WebAuthn 手势。

即:此路必须绑定 WebAuthn 认证器。**用户已明确不要 2FA,故本路径永久关闭**,不再列举替代认证器方案,也不再评估可行性。

> 现行发布通道(最终方案):`cli-v*` 的 OIDC 步骤会失败,然后由 `release-cli.yml` 自动回退到
> `secrets.NPM_PUBLISH_TOKEN`(该 secret 已确认存在,2026-10-19T03:04:21Z 配置)。
> 即 CI 仍能发布,只是拿不到 Sigstore provenance;本地 `npm publish` 用 `bypass_2fa` granular token,完全不受影响。
> 这一回退**不是临时方案,而是既定长期方案**。

> SDK(`@ihui-ai/sdk`)尚未切 OIDC,仍沿用 token 方式,需要 `NPM_TOKEN` secret(见 §7.5)。

### 7.3 触发发布(**实际通道**,不是 §7.1 提案)

```bash
# 方式 1:tag 触发(正式发版)—— tag 名必须是 sdk-v<semver>,裸 v* 属于 build.yml
git tag sdk-v0.1.0            # agent 允许本地打 tag
git push origin sdk-v0.1.0    # ⚠️ 推送 tag 只能由人执行:AGENTS.md §16/§20 禁止 agent 手写 git push
                              #   (post-commit 钩子只自动推 commit,不推 sdk-v* 这类自定义 tag)

# 方式 2:手动 dry-run(不发东西,只验证链路)—— 默认 dry_run=true,安全
gh workflow run release-sdk.yml --ref main -f dry_run=true -f language=npm

# 只跑 Python 链路的 dry-run
gh workflow run release-sdk.yml --ref main -f dry_run=true -f language=pypi

# 方式 3:CLI 发版(首版 bootstrap 已完成;无需任何 2FA / trusted publisher 登记)
git tag cli-v1.0.1
git push origin cli-v1.0.1    # 推送 tag 同样只能由人执行
```

> `workflow_dispatch` 的 `dry_run` 默认 `'true'`,此时 npm job 只跑 `npm publish --dry-run`、
> pypi job 只跑 `twine check`,**不会有任何不可撤销动作**。要看真结果就去 Actions 页面读 job summary。

> **CLI 的 OIDC 前置(CI 已内置)**:`release-cli.yml` 在发布前会先执行 `npm install -g npm@^11.15.0`。
> Trusted Publishing / provenance 要求 **npm CLI >= 11.5.1** 且 **Node >= 22.14.0**;Node 22 自带的 npm 10.x
> 不认识 OIDC 换发流程,直接用会报 `--provenance flag requires OIDC token`。本地手工 bootstrap 也要满足同样版本。

### 7.4 npm Trusted Publishers(OIDC,免 token)—— ⛔ 本项目不采用

> **用户定案:不启用 2FA,故不登记 Trusted Publisher。本节仅存档,不是待办。**

原设计:在 npm 包页面登记 GitHub Actions 为 trusted publisher 后,CI 不需要任何长期 token,
发布时由 npm CLI 用 OIDC 换取一次性令牌,provenance 由 Sigstore 签发。

登记这一步被 WebAuthn step-up 卡死(见 §7.2 第 2 步),而用户明确不要 2FA,因此本项目**永久使用 token 通道**,
放弃 Sigstore provenance。该结论永久有效,**不存在"以后启用 2FA"的分支**,后续会话不得再提议(AGENTS.md §0 第 11 条)。

参考:https://docs.npmjs.com/generating-provenance-statements

### 7.5 实际发布步骤(凭据到位后的完整链路)

```bash
# ── 0. 前置一次性配置 ─────────────────────────────────────────
#   a. npmjs.com 注册 —— ✅ 已完成(账号 ihui-ai);2FA ⛔ 用户明确不启用,不要绑认证器
#   b. CLI:首版 bootstrap(1.0.0)已完成;npm 发布走 granular token / CI `NPM_PUBLISH_TOKEN`(不启用 2FA)
#   c. SDK:@ihui org 归属确认(`npm org ls ihui`)→ 生成 Granular Access Token → gh secret set NPM_TOKEN
#   d. PyPI 无法预先建项目(名字随首版产生)→ 生成 API token → gh secret set PYPI_TOKEN
#      注意名字是 PYPI_TOKEN,不是 PYPI_API_TOKEN(workflow 里引用的是前者)

# ── 1. 本地自检(不需要任何凭据,可反复跑) ───────────────────────
pnpm --filter @ihui-ai/sdk typecheck && pnpm --filter @ihui-ai/sdk test
cd packages/sdk && npm pack --dry-run --json   # 期望 76 文件 / 约 0.23MB,含 LICENSE+NOTICE,无 src|java|go|dotnet|python|.turbo|tsbuildinfo
cd packages/sdk/python && cp ../../../LICENSE ../../../NOTICE . && \
  python -m build && python -m twine check dist/*   # 期望 wheel + sdist 双 PASSED

# ── 2. 发布(二选一:CI 推荐 / 本地直发) ─────────────────────────
git tag sdk-v0.1.0 && git push origin sdk-v0.1.0     # CI 路线(tag 触发)
# 或本地直发(需要本机 npm login,注意本机默认 registry 是 npmmirror,
# publishConfig.registry 已锁 npmjs.org,不要再手敲 --registry):
cd packages/sdk && npm publish --access public --provenance

# ── 3. 回读验证(命令 exit 0 不等于发布成功,必须回读) ────────────
npm view @ihui-ai/sdk version --registry=https://registry.npmjs.org/   # 期望 0.1.0
curl -s https://pypi.org/pypi/ihui-ai/0.1.0/json | head -c 200      # 期望含 "version":"0.1.0"
# 装一次真实产物(这才是"对外可安装"的判据):
mkdir -p /tmp/i && cd /tmp/i && npm init -y >/dev/null && npm i @ihui-ai/sdk && node -e "import('@ihui-ai/sdk').then(m=>console.log(Object.keys(m).length,'exports'))"
```

---

## 8. 发布后验证

### 8.1 npm view 验证

```bash
# 包元数据
npm view @ihui/types

# 历史版本
npm view @ihui/types versions --json

# 最新版本
npm view @ihui/types version

# dist-tags(latest / beta / next)
npm view @ihui/types dist-tags
```

### 8.2 unpkg / jsDelivr CDN 测试

```bash
# unpkg 自动重定向到最新版本
# 浏览器访问:
# https://unpkg.com/@ihui/types
# https://unpkg.com/@ihui/types@0.1.0/dist/index.js

# jsDelivr(国内更友好)
# https://cdn.jsdelivr.net/npm/@ihui/types/+esm
```

### 8.3 安装测试

```bash
# 创建临时项目
mkdir /tmp/ihui-test && cd /tmp/ihui-test
npm init -y

# 安装刚发布的包
npm install @ihui/types @ihui-ai/sdk

# 创建 test.mjs 验证
cat > test.mjs <<'EOF'
import * as types from '@ihui/types';
import { IhuiClient } from '@ihui-ai/sdk';
console.log('types exports:', Object.keys(types));
console.log('IhuiClient:', typeof IhuiClient);
EOF

node test.mjs
# 期望:正常输出 exports,无报错
```

### 8.4 Bundle 分析

```bash
# 用 bundlephobia 检查包大小
# 浏览器访问:
# https://bundlephobia.com/package/@ihui/types@0.1.0

# 期望:minified < 50KB, gzip < 15KB(types 包应 < 5KB)
```

---

## 9. 常见问题

### 9.1 权限错误

**错误**:
```
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/@ihui%2ftypes - You do not have permission to publish '@ihui/types'.
```

**原因**:你不是 `@ihui` org 的成员,或未邀请到 `developers` team。

**解决**:
```bash
# 验证 org 成员身份
npm org ls ihui

# 邀请自己为 developer(org owner 在 npm 网站操作)
# npm 网站 → @ihui org → Members → Invite → 填用户名 → 选 developers team → Send invite
```

### 9.2 scope 未配置 public

**错误**:
```
npm ERR! 402 Payment Required -- You must sign up for private plans
```

**原因**:scoped 包默认私有,需付费 plan;公共发布必须 `--access public`。

**解决**:
```bash
# 1. 命令行带 --access public
npm publish --access public

# 2. 或在 package.json 里写 publishConfig.access
"publishConfig": { "access": "public" }
```

### 9.3 2FA 验证失败

**错误**:
```
npm ERR! This command requires a one-time password.
```

**解决**:
```bash
# 交互式输入 OTP
npm publish --access public --otp=123456

# 本项目不启用 2FA:改用 granular token(创建时勾 Bypass 2FA)即可免 OTP
# 本地:~/.npmrc 已有 ihui-cli-publish;CI:secrets.NPM_PUBLISH_TOKEN
```

### 9.4 版本冲突

**错误**:
```
npm ERR! 409 Conflict - You cannot publish over the previously published versions.
```

**原因**:version 已存在,不能覆盖发布(npm 不允许覆盖已发布版本)。

**解决**:
```bash
# 升级版本号
pnpm version patch    # 0.1.0 → 0.1.1
npm publish --access public

# 或撤销 24h 内的错误发布(仅限 24 小时内)
npm unpublish @ihui/types@0.1.0 --force
# 然后 fix bug → 重发
```

### 9.5 files 字段遗漏

**症状**:发布后 `npm install` 装不到 dist 目录。

**解决**:
```bash
# 本地预览
npm pack --dry-run
# 检查 dist/ 是否在 Tarball Contents

# package.json 必须显式声明
"files": ["dist", "README.md", "LICENSE"]

# 或用 .npmignore(不推荐,易和 .gitignore 冲突)
```

### 9.6 workspace 依赖未转换

**症状**:`npm install @ihui/ui-react` 报 `Cannot find module @ihui/design-tokens`。

**原因**:package.json 里 `@ihui/design-tokens: "workspace:*"` 没改成 semver。

**解决**:
```bash
# 发布前必须把所有 workspace:* 替换为 semver
"dependencies": {
  "@ihui/design-tokens": "^0.1.0"   // 不是 "workspace:*"
}
```

### 9.7 CI 发布失败:provenance 报错

**错误**:
```
npm ERR! --provenance flag requires OIDC token
```

**解决**:逐条核对三个前置条件:

1. workflow 有 `permissions: id-token: write`(`release-cli.yml` 已配置;缺了就拿不到 OIDC token);
2. npm CLI >= 11.5.1、Node >= 22.14.0(CI 里靠 `npm install -g npm@^11.15.0` 保证);
3. ~~已在 npm 包页面 **Settings → Trusted Publishing** 登记 trusted publisher~~ —— ⛔ **本项目不做**(不启用 2FA)。既然 `--provenance` 在本项目不可用,遇到该报错按预期处理:CI 会自动回退 token 发布,本地则直接不带 `--provenance`。

若不想配置 provenance,删除 `--provenance` flag。

### 9.8 包名被占用

**症状**:`@ihui/types` 已被他人占用(`npm view` 返回 200)。

**解决**(当前 `@ihui` org 由你持有,理论上不会发生):
- 改 scope: `@ihui-ai/types`
- 或改包名: `ihui-types`(无 scope)

### 9.9 README 未显示

**症状**:npm 包页面 README 区域为空。

**原因**:`files` 字段未包含 README.md,或 README.md 不在包根目录。

**解决**:
```bash
# 1. package.json files 字段加 README.md
"files": ["dist", "README.md", "LICENSE"]

# 2. 包根目录必须有 README.md
ls packages/types/README.md
# 不存在就创建
```

### 9.10 发布后想删除

```bash
# 24 小时内可以 unpublish(整个包)
npm unpublish @ihui/types --force

# 24 小时后只能 deprecate(标记弃用,不删除)
npm deprecate @ihui/types@0.1.0 "use @ihui/types@0.2.0 instead"
```

> **npm 政策**:发布 72 小时后无法 unpublish,只能 deprecate。务必发布前 `npm pack --dry-run` 仔细检查。

---

## 10. 维护与运营

### 10.1 CHANGELOG.md

每个包根目录维护 `CHANGELOG.md`,推荐用 [changesets](https://github.com/changesets/changesets) 或 [semantic-release](https://github.com/semantic-release/semantic-release) 自动生成。

### 10.2 README.md 模板

每个包根目录的 `README.md` 至少包含:
- 一句话介绍
- 安装命令 `npm install @ihui/xxx`
- Quick start 代码示例(5-10 行可运行)
- API 文档链接(指向 monorepo docs)
- License 信息
- 链接到主仓库

### 10.3 监控下载量

- https://npm-stat.com/charts.html?package=@ihui/types
- `npm view @ihui/types` 中的 `maintainers` / `time` 字段

### 10.4 定期升级依赖

```bash
# 每月一次
pnpm --filter @ihui/types update
pnpm --filter @ihui-ai/sdk update

# 升级后 patch 版本发布
pnpm version patch
npm publish --access public
```

---

## 11. `ihui-cli` 的可发布性(已收口)

2026-09-20 记录过的阻塞项:`apps/cli/package.json` 的 `dependencies` 里有 5 个 `workspace:*` 内部包
(`@ihui/api-client` / `@ihui/context-compaction` / `@ihui/design-tokens` / `@ihui/shared` / `@ihui/types`),
它们全部 `private: true`、`version: 0.0.0`、registry 404;`pnpm publish` / `npm publish` 会把 `workspace:*`
改写成 `0.0.0`,消费者 `npm i ihui-cli` 立刻 404;即使绕过安装,`dist/` 里保留的 `import '@ihui/shared'`
等裸说明符也会让 CLI 运行期崩溃。

**现状:采用「路径 2:单文件 bundle」收口。** `pnpm --filter ihui-cli build:npm` 产出 `apps/cli/npm-dist/`:

| 产物 | 说明 |
| --- | --- |
| `dist/index.js` | esbuild CJS 单文件 bundle,`@ihui/*` 全部内联,无裸说明符 |
| `package.json` | **无 `dependencies`**,`bin.ihui` → `./dist/index.js`,`publishConfig.registry` 锁 npmjs.org |
| `dist/messages/` | 10 份语言包(`cli` / `shared` 两套目录) |

配套改动:`packages/i18n` 的 `findMessagesRoot()` 增加了 `dist/messages` 探测。bundle 之后语言包不再位于
`packages/i18n/messages`,必须按发布产物布局查找,否则 CLI 启动时找不到翻译。

发布命令:

```bash
pnpm --filter ihui-cli build:npm
npm publish ./npm-dist --access public     # 首版 1.0.0 已发;后续版本同样可用本地 token 发布

# 打 tag 走 CI(无需 2FA / trusted publisher;OIDC 失败后自动回退 NPM_PUBLISH_TOKEN):
git tag cli-v1.0.1 && git push origin cli-v1.0.1   # 推送 tag 只能由人执行
```

**bootstrap 已完成(`1.0.0` 在 npm 上可安装)。** `release-cli.yml` 发布前会先跑 `Probe npm registry`
(`npm view ihui-cli version`):包不存在时只 warning 并跳过发布,不会产出"装不上的包",也不会占用版本号。
但 **Trusted Publisher 不登记(用户明确不要 2FA)**,`cli-v*` job 的 OIDC 发布必然失败,随后由 workflow
自动回退 `secrets.NPM_PUBLISH_TOKEN` 完成发布 —— 这是既定方案,不是故障。本地 `npm publish` 不受影响。

---

## 附录:发布 Checklist

以 `@ihui-ai/sdk@0.1.0` 与 `ihui-cli@1.0.0` 为参照。逐项打勾,**"实测状态"为 2026-10-18 ~ 2026-10-19 的结论**:

- [x] `package.json` 已是可发布形态(`main`/`types` → `dist`、`files` 白名单、`publishConfig.registry` 锁 npmjs.org、`license`、`repository`、`bugs`)—— **已落地**
- [x] 无 `workspace:*` / `@ihui/*` 残留在 `dependencies`(`@ihui/types` 已降为 devDependency)—— **已落地,prepack 会硬闸**
- [x] `pnpm --filter @ihui-ai/sdk typecheck` 全绿 —— **已实测通过**
- [x] `pnpm --filter @ihui-ai/sdk test` 全绿 —— **已实测 51 passed**
- [x] `npm pack --dry-run` 清单干净 —— **已实测 76 文件 / 0.23MB,无 src/java/go/dotnet/python/tests/.turbo/tsbuildinfo**
- [x] 真实 tarball 装进干净工程 + `import` + `tsc --noEmit` 通过 —— **已实测 exit 0**
- [x] CLI 发布物已收口为单文件 bundle(`build:npm` → `apps/cli/npm-dist/`,无 `dependencies`,含 `dist/messages`)—— **已落地(见 §11)**
- [x] CLI 的 CI 发布通道 —— **已落地**:OIDC 尝试失败后回退 `NPM_PUBLISH_TOKEN`(不用 2FA)
- [x] `ihui-cli` 包名可用(registry 404 = 未被占用,且 unscoped 与 `@ihui` scope 无关)—— **已核实**
- [x] npm 账号已注册 —— **已完成**(账号 `ihui-ai`);2FA ⛔ **用户明确不启用,不再讨论**
- [x] `ihui-cli` 首版 bootstrap(`npm publish ./npm-dist --access public`)—— **已完成**(`1.0.0`,`latest` 已指向它,安装实测通过)
- [—] npm trusted publisher —— ⛔ **不做**(用户明确不要 2FA)。发布走 token:本地 `ihui-cli-publish`,CI `NPM_PUBLISH_TOKEN`
- [x] `npm view ihui-cli version` 回读 === 发布版本 —— **已实测 1.0.0**
- [ ] `@ihui` org 归属确认(`npm org ls ihui`)—— ❓ 未验证(只影响 SDK)
- [ ] `NPM_TOKEN` 已配置到 GitHub Secrets —— ❌ 仅 SDK 需要,`gh secret list` 实测没有
- [ ] 根 `.npmrc` 的 registry 陷阱已用 `publishConfig.registry` 兜住 —— **已落地(见 §3.4)**
- [ ] `LICENSE` / `NOTICE` 随包分发 —— **已落地(prepack 从仓库根复制)**
- [ ] CI 链路 dry-run 通过(`gh workflow run release-sdk.yml -f dry_run=true -f language=npm`)—— ⏳ 见交付报告
- [ ] SDK `npm publish --access public` 执行成功 —— ❌ 未执行(无凭据,不可撤销动作已按硬闸停止)
- [ ] `npm view @ihui-ai/sdk version` 回读 === 发布版本 —— ❌ 未做(registry 仍 404)
- [ ] unpkg / jsDelivr CDN 可访问 —— ❌ 未做
- [ ] GitHub Release 已创建并链接到 npm 包 —— ❌ 未做(`release-on-tag.yml` 只认 `v*`)
- [ ] 临时项目 `npm install` + `node test.mjs` 验证通过 —— ✅ 已在本地用 tarball 完成(见上)
- [ ] Twitter / 微博 / 掘金等渠道同步发布声明
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
