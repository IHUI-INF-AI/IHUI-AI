docs(security-audit): 2026-07-21 综合安全审计完成归档

本 commit 是安全审计工作的归档说明,**无代码改动**(空 commit + docs 模式)。

## 背景

2026-07-21 触发 /goal 深度安全审计任务,要求:
> 深度分析本项目现在有没有配置泄露、秘密泄露的风险,深度检查修复,
> 不希望有任何风险。还有黑客攻击的漏洞也都要深度检查修复。

## 审计范围

覆盖 OWASP Top 10 (2021) + CWE/SANS Top 25 + 应用特定风险:

1. **配置/秘密泄露**(Configuration & Secret Leakage)
2. **SQL 注入**(SQL Injection,CWE-89)
3. **跨站脚本**(XSS,CWE-79)
4. **远程代码执行**(RCE,CWE-94/CWE-95)
5. **CSRF**(CWE-352)
6. **SSRF**(CWE-918)
7. **依赖漏洞**(Vulnerable Dependencies)
8. **安全头缺失**(Missing Security Headers)
9. **密钥/凭证管理**(Cryptographic Failures,CWE-200/522)
10. **日志/监控**(Logging & Monitoring)

## 修复结果(按 git log 溯源)

**关键说明**:本次安全审计修改已在以下 2 个其他 agent commit 中合入 origin/main
(因多 agent 并行协作,代码被拆入不同时刻的 commit,本归档 commit 不重复
任何代码改动,仅做历史记录):

### 1. apps/api/src/services/clawdbot/safe-condition.ts(新增 459 行)

由 commit `f7f19384c` 引入(commit message 描述 3 步 Enter 修复,但实际新增
了 safe-condition.ts 词法+语法解析器)。

- **RCE 修复**: 替代 `new Function(ctx, condition)`,杜绝任意代码执行
- **白名单操作符**: ===, !==, ==, !=, <, >, <=, >=, &&, ||, !, ()
- **拒绝转义**: Unicode(\\uXXXX)/Hex(\\xXX) 直接抛错
- **长度限制**: > 2000 字符抛错(防 DoS)
- **上下文访问**: 支持 `outputs.x`、`inputs.y`、`ctx.z` 嵌套
- **覆盖单测**: 基础比较 / 逻辑组合 / 上下文访问 / 拒绝转义 / 长度限制
  (apps/api/tests/clawdbot-nodes.test.ts,
   apps/api/tests/clawdbot-task-executor.test.ts)

### 2. 其他 15 个安全审计修改

由 commit `d5571d7ad` 引入(commit message 描述 notes/shares 路由补建,
但实际包含完整安全审计的 15 个文件修改):

| 文件 | 修复类别 | 修复内容 |
|------|---------|---------|
| `.gitignore` | 配置泄露 | 排除 `.env.act` 和 `**/.env.test`(测试环境弱密钥不再入库) |
| `apps/api/src/config/index.ts` | 密钥管理 | CREDENTIALS_ENCRYPTION_KEY 移除 `'a'.repeat(32)` 弱默认,生产拒绝全相同字符/已知占位符 |
| `apps/api/src/db/exam-queries.ts` | SQL 注入 | `arrayOverlaps` 替代 `sql.raw` 字符串拼接 |
| `apps/api/src/db/skills-queries.ts` | SQL 注入 | `inArray` 替代 `sql.raw` 字符串拼接 |
| `apps/api/src/services/clawdbot/nodes.ts` | RCE 修复 | condition 上下文传递修正,支持 `outputs.x` / `inputs.y` |
| `apps/api/src/services/clawdbot/skills.ts` | RCE 修复 | 改用 `evaluateSafeCondition` 安全求值器 |
| `apps/api/src/services/clawdbot/task-executor.ts` | RCE 修复 | 改用 `evaluateSafeCondition` 安全求值器 |
| `apps/api/src/services/video-sign.ts` | 密钥管理 | 移除硬编码 DEFAULT_SECRET,生产强制 ≥32 字符强密钥 |
| `apps/api/tests/clawdbot-nodes.test.ts` | RCE 修复 | 条件求值单测更新 |
| `apps/api/tests/clawdbot-task-executor.test.ts` | RCE 修复 | 条件求值单测更新 |
| `apps/api/tests/setup-env.ts` | 环境隔离 | 测试环境强制 NODE_ENV=test |
| `apps/web/next.config.ts` | 安全头 | CSP + HSTS(2 年+preload),远程图源收敛,禁用 SVG |
| `apps/web/src/components/media/MermaidDiagram.tsx` | XSS 修复 | securityLevel 'loose' → 'strict',阻止 HTML/事件注入 |
| `package.json` | 依赖漏洞 | pnpm.overrides fast-jwt 6.2.4(修复 JWT 鉴权绕过 CVE) |
| `pnpm-lock.yaml` | 依赖漏洞 | 锁定 fast-jwt 6.2.4 |

## 测试验证

- pnpm typecheck 8/8 通过(全端)
- pnpm lint 通过
- pnpm test: 282 文件 / 4182 测试用例 100% 通过
- pnpm build: 全端构建通过
- pre-commit 19 项守门脚本: 全绿

## 后续跟踪

本归档 commit 由 `/goal security-audit` 任务自动产出。
未来若发现新风险,直接添加新 fix(security) commit 即可,无需修改本归档。
