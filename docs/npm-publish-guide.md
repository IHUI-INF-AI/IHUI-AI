# IHUI-AI npm 包发布指南

> 目的:把核心 packages 发布到 npm,增加曝光、便于集成、建立品牌。本指南详细到 AI agent 可照着执行。
>
> 适用包(均位于 `packages/` 下):`@ihui/types` / `@ihui/sdk` / `@ihui/api-client` / `@ihui/ui-react` / `@ihui/design-tokens`
>
> 发布顺序(按依赖递推):`types` → `design-tokens` → `ui-react` → `sdk` → `api-client`

---

## 1. 为什么发布到 npm

| 价值维度 | 说明 |
| --- | --- |
| 增加曝光 | npm 月活 1700 万开发者,`npm view` / unpkg / jsDelivr 自然流量;SEO 反哺 GitHub star |
| 便于集成 | 用户 `pnpm add @ihui/sdk` 即可用,无需 clone 仓库;CI/CD 友好 |
| 建立品牌 | `@ihui` scope 占位,建立"全栈 AI 平台"心智;对比 Dify/Coze 的 npm 包更显专业 |
| 版本可信 | semver + tag + changelog,用户敢用于生产;Apache 2.0 商业友好 |
| 跨端复用 | 8 端代码同源,SDK 一处发布、多端调用;降低集成摩擦 |

---

## 2. 待发布包清单

| 包名 | 路径 | 依赖 | 首版本 | 备注 |
| --- | --- | --- | --- | --- |
| `@ihui/types` | `packages/types` | 无 | `0.1.0` | 最基础,优先发布 |
| `@ihui/design-tokens` | `packages/design-tokens` | `clsx` / `tailwind-merge` / `cva` | `0.1.0` | 设计令牌,无业务依赖 |
| `@ihui/ui-react` | `packages/ui-react` | `@ihui/design-tokens` + Radix UI | `0.1.0` | React 19 组件库 |
| `@ihui/sdk` | `packages/sdk` | `@ihui/types` | `0.1.0` | JS/TS SDK,API 调用封装 |
| `@ihui/api-client` | `packages/api-client` | `@ihui/types` | `0.1.0` | 完整 API 客户端,1300+ endpoint |

> **scope 策略**:统一用 `@ihui` scope,scoped 包默认私有,发布必须带 `--access public`。

---

## 3. 发布前准备(一次性)

### 3.1 注册 npm 账号

1. 访问 https://www.npmjs.com/signup 注册账号
2. 开启 2FA(Settings → Account Security → Two-Factor Authentication → `auth_and_writes`)
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
npm view @ihui/types
npm view @ihui/design-tokens
npm view @ihui/ui-react
npm view @ihui/sdk
npm view @ihui/api-client
```

期望全部返回 `npm error code E404`(表示未占用,可发布)。

### 3.4 配置 .npmrc

在仓库根目录创建 `.npmrc`:

```ini
# @ihui scope 走默认 registry(公共)
@ihui:registry=https://registry.npmjs.org/

# 关闭 anonymous 认证,确保 scoped 包能发布
always-auth=true

# pnpm 工作区链接(开发态),不影响发布
link-workspace-packages=true
prefer-workspace-packages=true
```

> 用户主目录 `~/.npmrc` 由 `npm login` 自动写入 `//registry.npmjs.org/:_authToken=xxx`,无需手动管理。

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
  "author": "IHUI-AI <502319984@qq.com>",
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
  "description": "IHUI-AI 共享类型定义包 - 8 端同源的 TypeScript 类型契约",
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
  "author": "IHUI-AI <502319984@qq.com>",
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
  "description": "IHUI-AI 设计令牌(8 端共享):cn() 类名合并 + tokens 色板/间距/字号/圆角/阴影/z-index,JS 对象 + CSS 变量双形式",
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
  "author": "IHUI-AI <502319984@qq.com>",
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
  "description": "IHUI-AI React 19 UI 组件库 - 基于 Radix UI + Tailwind 4,8 端共享",
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
  "author": "IHUI-AI <502319984@qq.com>",
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

### 4.5 @ihui/sdk 完整配置

```jsonc
{
  "name": "@ihui/sdk",
  "version": "0.1.0",
  "private": false,
  "description": "IHUI-AI 官方 JavaScript/TypeScript SDK - 176 大模型 + 1300+ API 一键调用",
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
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prepublishOnly": "pnpm run build && pnpm run test"
  },
  "keywords": ["ihui", "ihui-ai", "sdk", "ai", "llm", "openai", "anthropic", "langgraph", "mcp", "a2a"],
  "author": "IHUI-AI <502319984@qq.com>",
  "license": "Apache-2.0",
  "homepage": "https://github.com/IHUI-INF-AI/IHUI-AI#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IHUI-INF-AI/IHUI-AI.git",
    "directory": "packages/sdk"
  },
  "bugs": { "url": "https://github.com/IHUI-INF-AI/IHUI-AI/issues" },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "engines": { "node": ">=18.0.0" },
  "dependencies": {
    "@ihui/types": "^0.1.0"
  }
}
```

### 4.6 @ihui/api-client 完整配置

```jsonc
{
  "name": "@ihui/api-client",
  "version": "0.1.0",
  "private": false,
  "description": "IHUI-AI 完整 API 客户端 - 1300+ endpoint 封装,含熔断器 + WS + 传输层抽象",
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
    "./client": {
      "types": "./dist/client.d.ts",
      "import": "./dist/client.js"
    },
    "./api-error": {
      "types": "./dist/api-error.d.ts",
      "import": "./dist/api-error.js"
    },
    "./utils": {
      "types": "./dist/utils.d.ts",
      "import": "./dist/utils.js"
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
  "keywords": ["ihui", "ihui-ai", "api-client", "http", "fastify", "websocket", "circuit-breaker"],
  "author": "IHUI-AI <502319984@qq.com>",
  "license": "Apache-2.0",
  "homepage": "https://github.com/IHUI-INF-AI/IHUI-AI#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IHUI-INF-AI/IHUI-AI.git",
    "directory": "packages/api-client"
  },
  "bugs": { "url": "https://github.com/IHUI-INF-AI/IHUI-AI/issues" },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "engines": { "node": ">=18.0.0" },
  "dependencies": {
    "@ihui/types": "^0.1.0"
  }
}
```

---

## 5. 构建配置:tsup

### 5.1 安装 tsup

每个待发布的包都需要安装 tsup 作为 devDependency:

```bash
pnpm --filter @ihui/types add -D tsup
pnpm --filter @ihui/design-tokens add -D tsup
pnpm --filter @ihui/ui-react add -D tsup
pnpm --filter @ihui/sdk add -D tsup
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

### 7.1 创建 `.github/workflows/npm-publish.yml`

```yaml
name: npm-publish

on:
  push:
    tags:
      - '@ihui/types@*'
      - '@ihui/design-tokens@*'
      - '@ihui/ui-react@*'
      - '@ihui/sdk@*'
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
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Summary
        run: |
          echo "### Published ${{ steps.pkg.outputs.name }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "View on npm: https://www.npmjs.com/package/${{ steps.pkg.outputs.name }}" >> $GITHUB_STEP_SUMMARY
```

### 7.2 配置 NPM_TOKEN secret

1. 在 npm 网站生成 **Access Token**(Settings → Access Tokens → Generate New Token → **Granular Access Token**)
   - Token name: `github-actions-publish`
   - Expiration: 90 days(到期前手动续)
   - Packages and scopes: **Read and write** → `@ihui` scope
2. GitHub 仓库 Settings → Secrets and variables → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: 粘贴 token

### 7.3 触发发布

**方式 1:手动触发**
```bash
# GitHub 仓库 → Actions → npm-publish → Run workflow → 选 package → Run
```

**方式 2:tag 触发**
```bash
# 本地打 tag
git tag @ihui/types@0.1.0
git push origin @ihui/types@0.1.0
# CI 自动触发,5-8 分钟完成发布
```

### 7.4 npm Trusted Publishers(推荐,免 token)

更安全的方案:npm 端配置 GitHub Actions 为 trusted publisher,无需 NPM_TOKEN:

1. npm 网站 → 包页面 → Settings → Trusted Publishers → Add publisher
2. 填入:`IHUI-INF-AI`(owner)/ `IHUI-AI`(repo)/ `npm-publish.yml`(workflow filename)
3. 删除 workflow 中的 `NODE_AUTH_TOKEN` env,改用 OIDC 自动认证

参考:https://docs.npmjs.com/generating-provenance-statements

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
npm install @ihui/types @ihui/sdk

# 创建 test.mjs 验证
cat > test.mjs <<'EOF'
import * as types from '@ihui/types';
import { IhuiClient } from '@ihui/sdk';
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

# CI 中用 --provenance + trusted publisher 避免 OTP
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

**解决**:确保 workflow 有 `permissions: id-token: write`,且 npm 上配置了 trusted publisher。若不想配置 provenance,删除 `--provenance` flag。

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
pnpm --filter @ihui/sdk update

# 升级后 patch 版本发布
pnpm version patch
npm publish --access public
```

---

## 附录:发布 Checklist

发布前逐项打勾:

- [ ] npm 账号已注册并开启 2FA
- [ ] `@ihui` org 已创建并邀请自己为 developer
- [ ] `.npmrc` 配置正确(`@ihui:registry` + `always-auth=true`)
- [ ] `npm login` + `npm whoami` 验证通过
- [ ] `npm view @ihui/xxx` 返回 404(包名可用)
- [ ] `package.json` 已按 §4 模板修改(`private: false` / `publishConfig` / `files` / `exports`)
- [ ] `workspace:*` 依赖已改为 semver(`^0.1.0`)
- [ ] `tsup.config.ts` 已创建并 `pnpm build` 通过
- [ ] `pnpm typecheck` 全绿
- [ ] `pnpm test` 全绿(若有测试)
- [ ] `npm pack --dry-run` 输出只含 `dist/` + `README.md` + `LICENSE`
- [ ] `README.md` 已创建(包根目录)
- [ ] `LICENSE` 已创建(Apache-2.0 全文)
- [ ] `NPM_TOKEN` 已配置到 GitHub Secrets(若用 CI)
- [ ] `npm publish --access public` 执行成功
- [ ] `npm view @ihui/xxx` 验证返回包元数据
- [ ] unpkg / jsDelivr CDN 可访问
- [ ] 临时项目 `npm install` + `node test.mjs` 验证通过
- [ ] GitHub 仓库 release 已创建并链接到 npm 包
- [ ] Twitter / 微博 / 掘金等渠道同步发布声明
