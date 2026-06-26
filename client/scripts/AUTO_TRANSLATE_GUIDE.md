# AI 自动翻译操作手册 (2026-06-26 新增)

> 配套脚本: `client/scripts/auto-translate-i18n.ts` (含 mock 试运行 + 小批量参数)
> 配套工具: `client/scripts/rollback-auto-translate.mjs` (备份回滚) + `client/scripts/verify-translation-quality.ts` (质量验证)

## 1. 三种运行模式

| 模式 | 命令 | API key | 写回文件 | 用途 |
|------|------|---------|----------|------|
| **dry-run** | `--dry-run` | 不需要 | 否 | 预览要翻译多少项, 看分类 |
| **mock** | `--mock` | 不需要 | **是** | 本地伪翻译, 端到端验证脚本 |
| **正式** | 默认 (无 flag) | **需要** | **是** | 调用真实 AI API |

## 2. mock 试运行报告 (2026-06-26 验证完成)

> 已用 mock 模式跑通端到端流程, 验证脚本可正常备份/翻译/写回/回滚.
> 真实 AI 翻译需用户手动提供 `I18N_AI_API_KEY`, 详见 §3.

### 2.1 验证命令

```bash
cd client
npx tsx scripts/auto-translate-i18n.ts --mock --limit=10 --modules=home --report=scripts/reports/mock-trial-home.log
```

### 2.2 实际运行结果 (2026-06-26 09:49)

```
🌐 AI 自动翻译 i18n 脚本
   模式: 🧪 mock (本地伪翻译, 走通备份/写回/验证全流程)
   模型: deepseek-chat  批次: 30  Base: https://api.deepseek.com/v1

📚 加载 zh-CN 原文...
   zh-CN 共 430 个 module
🔎 扫描目标语言待翻译项...
   --modules 过滤: home
   --limit 限制: 前 10 项
   zh-TW      1 文件, 10 待翻译项
   en         1 文件, 0 待翻译项
   ja         1 文件, 0 待翻译项
   ko         1 文件, 0 待翻译项

📊 扫描完成: 4 文件, 共 10 个待翻译项
   占位符 [ZH:]: 0
   值=键名:     0
   残留中文:    10

💾 备份目录: scripts\reports\auto-translate-backup-2026-06-26T09-49-55
🌐 翻译 zh-TW -> Traditional Chinese  (10 项)
   [zh-TW batch 1/1] ✅ 成功 10 跳过 0
📝 写回文件...
   ✅ src\locales\modules\zh-TW\home.json  (+10 keys)

📋 翻译报告
   扫描文件:     4
   待翻译项:     10
   成功翻译:     10
   写回文件:     1
   备份目录:     scripts\reports\auto-translate-backup-2026-06-26T09-49-55
```

### 2.3 mock 翻译规则 (用于识别)

| 语言 | 翻译格式 | 示例 |
|------|----------|------|
| en | `[MOCK-EN] <原文>` | `[MOCK-EN] 模型` |
| ja | `<原文> [MOCK-JA]` | `模型 [MOCK-JA]` |
| ko | `[MOCK-KO] <原文>` | `[MOCK-KO] 模型` |
| zh-TW | `繁體<原文>` | `繁體模型` |

> mock 翻译一眼可识别 (含 `MOCK` / `繁體` 标记), 不会污染真实数据.

### 2.4 回滚验证

```bash
node scripts/rollback-auto-translate.mjs --latest
# 输出: 恢复文件: 1 (zh-TW\home.json)
# 验证: 文件已恢复原始繁体内容
```

## 3. 真实 AI 翻译操作步骤

### 3.1 准备 API key

```bash
# 方式 1: 环境变量 (推荐, 不入仓)
export I18N_AI_API_KEY='sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
export I18N_AI_BASE_URL='https://api.deepseek.com/v1'  # 默认值, 可不设
export I18N_AI_MODEL='deepseek-chat'                   # 默认值, 可不设
export I18N_AI_BATCH_SIZE=30                            # 默认值, 可不设

# 方式 2: .env.local (本地开发, 入 .gitignore)
# I18N_AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# I18N_AI_BASE_URL=https://api.deepseek.com/v1
```

### 3.2 步骤 1: 预览 (dry-run)

```bash
cd client
npx tsx scripts/auto-translate-i18n.ts --dry-run --report=scripts/reports/dry-run-pre.log
# 期望输出: 扫描多少文件, 多少项, 分布如何
# 不写回任何文件
```

### 3.3 步骤 2: 小批量试运行 (10 项, 1 module)

```bash
# 仅翻译 home 模块的 en 语言, 前 10 项
npx tsx scripts/auto-translate-i18n.ts \
  --limit=10 \
  --modules=home \
  --locales=en \
  --report=scripts/reports/real-trial-home-en.log
```

### 3.4 步骤 3: 验证翻译结果

```bash
# 检查覆盖率
npx tsx scripts/verify-translation-quality.ts --sample=20

# 检查残留中文
npm run check:i18n:chinese

# 抽样对比
cat scripts/reports/verify-translation-*.json | jq '.samples'
```

### 3.5 步骤 4: 全量翻译 (按 module 分批)

```bash
# 一次性翻译所有 zh-CN 缺失项
npx tsx scripts/auto-translate-i18n.ts --report=scripts/reports/real-translate-all.log

# 或分批: 先 zh-TW, 再 en, ja, ko
npx tsx scripts/auto-translate-i18n.ts --locales=zh-TW --report=scripts/reports/real-translate-zhTW.log
sleep 5
npx tsx scripts/auto-translate-i18n.ts --locales=en --report=scripts/reports/real-translate-en.log
sleep 5
npx tsx scripts/auto-translate-i18n.ts --locales=ja --report=scripts/reports/real-translate-ja.log
sleep 5
npx tsx scripts/auto-translate-i18n.ts --locales=ko --report=scripts/reports/real-translate-ko.log
```

### 3.6 步骤 5: 全量验证

```bash
npm run check:i18n:chinese         # 残留中文应为 0
npm run check:i18n:keys -- --all   # 各语言 key 应完整
npx tsx scripts/verify-translation-quality.ts --sample=50
```

## 4. 高级参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--limit=N` | 限制总翻译项数 (含 placeholder/中文/值=键名) | `--limit=100` |
| `--modules=mod1,mod2` | 仅翻译指定 module (文件名去 .json) | `--modules=home,vip,common` |
| `--locales=zh-TW,en,ja,ko` | 仅翻译指定语言 (默认全 4 语言) | `--locales=en` |
| `--mock` | 启用 mock 模式 (不调 API) | `--mock` |
| `--dry-run` | 仅预览, 不写回 | `--dry-run` |
| `--report=PATH` | 把日志同时写入文件 (适合 CI/无 TTY 环境) | `--report=out.log` |

## 5. 安全保证

### 5.1 三层防护

1. **自动备份**: 每次翻译前自动备份到 `scripts/reports/auto-translate-backup-{ts}/`
2. **写回验证**: 写回后立即验证 JSON 有效性, 失败回滚该文件
3. **批次隔离**: 批次间延迟 1 秒, 单 key 失败跳过不中断

### 5.2 回滚机制

```bash
# 列出所有备份
node scripts/rollback-auto-translate.mjs

# 回滚最新备份
node scripts/rollback-auto-translate.mjs --latest

# 回滚指定备份
node scripts/rollback-auto-translate.mjs auto-translate-backup-2026-06-26T09-49-55

# 回滚前会自动备份当前文件到 pre-rollback-{ts}/
```

### 5.3 .gitignore 保护

已在 `.gitignore` 中忽略:
- `client/scripts/reports/auto-translate-backup-*/` (翻译前快照)
- `client/scripts/reports/pre-rollback-*/` (回滚前快照)
- `client/scripts/reports/verify-translation-*.json` (验证报告)

> 防止翻译工具运行时的临时数据污染仓库.

## 6. 常见问题

### 6.1 翻译后 i18n 键名裸露
**原因**: 翻译 key 是新增的, 目标语言 JSON 中还没有此 key
**解决**: 脚本会自动从 zh-CN 取原文, 翻译后写回, 无需手动

### 6.2 翻译结果不理想
**原因**: AI 模型对某些行业术语理解偏差
**解决**: 
1. 调高 batch size 减少上下文割裂: `BATCH_SIZE=10`
2. 改用更强模型: `I18N_AI_MODEL=gpt-4o`
3. 关键术语在 prompt 中明确说明 (TODO: 在 auto-translate-i18n.ts:buildPrompt 扩展)

### 6.3 翻译时 API 报错
**症状**: `❌ AI API HTTP 429: rate limit exceeded`
**解决**:
1. 减小 batch size: `I18N_AI_BATCH_SIZE=10`
2. 增大批次延迟: 修改 `BATCH_DELAY_MS = 3000`
3. 检查 API key 余额

### 6.4 翻译后某些语言没生效
**检查**:
1. 是否在 `client/src/locales/index.ts` 的 `asyncModules` / `coreModules` 中注册该 module
2. 是否清除了 Vite 缓存: `rm -rf node_modules/.vite && npm run dev`
3. 是否刷新了浏览器 / 清除了 localStorage

### 6.5 想跳过某些 key 不翻译
**当前**: 不支持, 翻译项由脚本自动识别 (placeholder + 中文残留 + 值=键名)
**未来**: 可在 `scripts/auto-translate-i18n.ts` 中加 `--exclude=key1,key2` 参数

## 7. CI 集成 (2026-06-26 已新增)

`.github/workflows/i18n-quality.yml` 会在 PR 阶段:
- 跑 `check:i18n:keys` 检测新增缺失
- 跑 `verify-translation-quality.ts` 检测翻译质量
- PR 评论自动贴覆盖率退化指标

`workflow_dispatch` 触发时可手动选模式:
- `check`: 增量检查 (默认)
- `all`: 全量检查
- `baseline`: 更新基线 (确认现有缺失为已知)

## 8. 与 `clean-orphan-i18n` 的协作

- `auto-translate-i18n`: 把"残留中文 / [ZH:占位] / 值=键名"翻译成目标语言
- `clean-orphan-i18n`: 删除"zh-CN 定义但源码未引用"的孤儿键

两者互补: 前者保证**翻译完整度**, 后者保证**键引用完整度**.
建议配合使用:
1. 先 `npm run i18n:clean-orphan -- --apply` 清理孤儿键
2. 再 `npm run i18n:auto-translate` 翻译剩余项

## 9. 自检清单 (首次使用前)

- [ ] 确认 DeepSeek API key 已配置 (`echo $I18N_AI_API_KEY | head -c 10`)
- [ ] 确认 `scripts/reports/auto-translate-backup-*` 目录在 .gitignore
- [ ] 跑过 `--dry-run` 预览翻译项数
- [ ] 跑过 `--mock` 验证端到端流程
- [ ] 确认 `node scripts/rollback-auto-translate.mjs` 列出备份正常
- [ ] 阅读本手册 §5.1 三层防护 / §5.2 回滚机制
- [ ] 准备一个空 module (如 `home`) 试翻译, 验证效果再批量
