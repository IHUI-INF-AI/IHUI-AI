# AI智能对话分享H5页面

> **来源**: 整合自 `H:\历史项目存档\zhs_app-ZZ\share-h5\`
> **迁移日期**: 2026-06-25
> **状态**: 已整合至 IHUI-AI `client/h5/`，原项目可封存

这是一个独立的H5项目，用于显示AI智能对话的分享内容。

## 功能特性

- 📱 响应式设计，适配移动端和PC端
- 🎨 美观的UI界面
- 🖼️ 支持图片、视频、音频等多种媒体类型
- 💭 思考过程展示（可展开/收起）
- 🔗 一键复制分享链接
- 📊 显示智汇值消耗信息

## 技术栈

- Vue 3
- Vite
- Vue Router
- Axios
- SCSS

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发

```bash
npm run dev
```

访问 http://localhost:3001

### 构建

```bash
npm run build
```

构建产物在 `dist` 目录

### 预览构建结果

```bash
npm run preview
```

## 项目结构

```
h5/
├── src/
│   ├── api/              # API接口
│   │   └── share.js      # 分享内容接口
│   ├── pages/            # 页面组件
│   │   ├── SharePage.vue # 分享主页
│   │   └── ErrorPage.vue # 错误页
│   ├── router/           # 路由配置
│   │   └── index.js
│   ├── utils/            # 工具函数
│   │   ├── request.js    # axios 请求封装
│   │   └── uni-adapter.js # uni-app API 适配
│   ├── App.vue           # 根组件
│   ├── main.js           # 入口文件
│   └── style.css         # 全局样式
├── .env.production.example  # 生产环境配置模板
├── .gitignore
├── index.html            # HTML模板
├── package.json
├── vite.config.js        # Vite配置
└── README.md
```

## 使用说明

### 访问分享页面

分享链接格式：`https://your-domain.com/share?code=分享码`

或：`https://your-domain.com/?code=分享码`

### API配置

在 `src/utils/request.js` 中配置API基础URL：

```javascript
const BASE_URLS = {
  1: 'https://kou.aizhs.top',
  2: 'https://bsm.aizhs.top/prod-api/ai',
  3: 'https://zca.aizhs.top',
  4: 'https://bsm.aizhs.top/prod-api',
  5: 'https://kou.aizhs.top'
}
```

### 环境变量

部署前复制 `.env.production.example` 为 `.env.production` 并填入实际值：

```env
VITE_API_BASE_URL=https://<BACKEND_DOMAIN>
VITE_MAIN_PROJECT_URL=https://<FRONTEND_DOMAIN>
VITE_WECHAT_APPID=wx27028e276ffdbc5d
```

真实生产凭证见 `docs/PRODUCTION_CREDENTIALS.md`（gitignored）。

## 部署

### Nginx配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/h5/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker部署

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 注意事项

1. 确保API接口在白名单中（`src/utils/request.js`）
2. 分享接口不需要认证，已配置在白名单中
3. 图片、视频等资源需要支持跨域访问
4. 微信小程序 AppID `wx27028e276ffdbc5d` 已硬编码在 `.env.production.example`

## 历史项目对应关系

| 历史路径 | 当前路径 | 状态 |
|---|---|---|
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\api\share.js` | `client/h5/src/api/share.js` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\pages\SharePage.vue` | `client/h5/src/pages/SharePage.vue` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\pages\ErrorPage.vue` | `client/h5/src/pages/ErrorPage.vue` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\router\index.js` | `client/h5/src/router/index.js` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\utils\request.js` | `client/h5/src/utils/request.js` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\utils\uni-adapter.js` | `client/h5/src/utils/uni-adapter.js` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\App.vue` | `client/h5/src/App.vue` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\main.js` | `client/h5/src/main.js` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\src\style.css` | `client/h5/src/style.css` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\package.json` | `client/h5/package.json` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\vite.config.js` | `client/h5/vite.config.js` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\index.html` | `client/h5/index.html` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\.gitignore` | `client/h5/.gitignore` | ✅ 1:1 迁移 |
| `H:\历史项目存档\zhs_app-ZZ\share-h5\.env.production` | `client/h5/.env.production.example` | ✅ 脱敏迁移（占位符） |

## License

MIT
