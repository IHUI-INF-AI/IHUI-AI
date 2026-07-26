# 安全策略

## 报告漏洞

如果你发现安全漏洞,请负责任地披露:

### 报告方式

- **邮箱**: 502319984@qq.com
- **GitHub**: 私下报告给 [@IHUI-INF-AI](https://github.com/IHUI-INF-AI)

### 请包含

- 漏洞类型(如 SQL 注入、XSS、IDOR、认证绕过)
- 受影响的文件/路由
- 复现步骤
- 影响范围
- 建议的修复方案(可选)

### 响应时间

- **确认收到**: 24 小时内
- **初步评估**: 72 小时内
- **修复发布**: 严重漏洞 7 天内,普通漏洞 30 天内

## 已知安全机制

IHUI-AI 已内置多层安全防护:

### 认证与授权

- JWT + Refresh Token 双 token 机制
- 基于角色的访问控制(RBAC)
- 管理员路由 preHandler 统一校验(roleId >= 1)
- 行级安全(RLS)策略

### 数据安全

- AES-256-GCM 加密敏感字段
- PostgreSQL RLS 行级安全
- API key 不入库(只存哈希)
- 请求参数 Zod 校验

### API 安全

- 速率限制(用户级 + IP 级)
- CORS 白名单
- Helmet 安全头
- SQL 注入防护(Drizzle ORM 参数化查询)

### 守门脚本

项目有 30+ 个 pre-commit 钩子,包括:
- API key 泄露检测
- 路由一致性校验
- 权限校验
- IDOR 检测

## 安全更新

安全补丁会通过 GitHub Release 发布,严重漏洞会在 Discussions 公告。

## 致谢

报告者(如愿意)会在下一个 Release 的致谢区列出。
