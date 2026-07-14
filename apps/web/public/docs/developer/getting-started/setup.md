# 环境配置

## 开发环境要求

### Node.js

- **版本**: >= 18.0.0
- **推荐**: >= 20.0.0
- **下载**: [Node.js官网](https://nodejs.org/)

### 包管理器

- **npm**: >= 9.0.0
- **或使用**: pnpm, yarn

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd ihui-ai-officialsite-interface
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://127.0.0.1:3333
VITE_JAVA_API_BASE_URL=http://127.0.0.1:9206
```

### 4. 启动开发服务器

```bash
npm run dev
```

项目将在 `http://127.0.0.1:8888` 启动。

## API配置

### 获取API密钥

1. 登录开发者平台
2. 进入"API令牌管理"
3. 创建新的API令牌
4. 保存API密钥

### 配置API密钥

在代码中使用：

```typescript
const apiKey = 'YOUR_API_KEY'
const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
}
```

或在环境变量中配置：

```env
VITE_API_KEY=YOUR_API_KEY
```

## 开发工具

### 推荐IDE

- **VS Code** - 推荐
- **WebStorm** - 可选

### 推荐插件

- ESLint
- Prettier
- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)

## 调试

### 浏览器调试

1. 打开浏览器开发者工具
2. 查看Console日志
3. 检查Network请求
4. 使用Vue DevTools

### API调试

使用API在线调试工具：
- 访问 `/api-debug` 页面
- 测试API接口
- 查看请求和响应

---

*最后更新: 2026-01-10*
