<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# PROJECT_PLAN 历史归档(2026-09-14 批次)

> 从 PROJECT_PLAN.md 归档的 2 个已完成段落(P1 e2e 长期红根治 / P0 中转站全链路集成收官),原文完整迁移。git 历史(归档前 commit)含完整原文作为版本化兜底;本文件为本地工作参考(.ihui-agent/ 不入 git)。

<!-- 目录 -->
1. P1 e2e(Playwright)workflow 长期红根治(2026-09-13 立,平台独占:apps/web/e2e + playwright.config.ts + .github/workflows/e2e.yml)
2. P0 中转站全链路集成收官——凭据契约与模型名归一化(2026-09-13 立,跨端:apps/api + apps/ai-service + apps/web + apps/cli + docs + scripts)

---

## P1 e2e(Playwright)workflow 长期红根治(2026-09-13 立,平台独占:apps/web/e2e + playwright.config.ts + .github/workflows/e2e.yml)

> 诊断(2026-09-13 收尾审计,证据:GitHub Actions API runs?branch=main):e2e 在 main 上至少自 2026-08-20 起连续 400+ 次全红(failure/cancelled/startup_failure,近 100 次零 success),与近期任何提交无关。根因三层:
> ① **时长硬顶**:647 用例(82 spec)× CI workers=1(`playwright.config.ts` 钉死保确定性)× ~6.5s/例 ≈ 70+ 分钟,加 CI `retries: 2` 对失败例放大,远超 `e2e.yml` 的 `timeout-minutes: 30` → 次次 30.3 分钟整点被 runner 取消(cancelled);
> ② **存量坏测试**:超时前进度线显示首 79 例约 19% 失败/超时(×/T 标记),线性外推全量约 120 例坏——只拉长超时也无法绿;
> ③ **保守设定未按 CI 复评**:workers=1 源于本地 10 并发压垮 Turbopack dev server 的教训(2026-08-29 实锤),但 CI 跑的是 `next start` 生产服务器,该约束不必然适用于 CI。
>
> 修复路线(按序,验收=e2e 回绿且连续 3 次 main push 稳定绿):

- [x] ✅(2026-09-13) 1. 全量 triage:**647 用例 = 517 过(80%)/56 败(8.7%)/5 flaky/69 skip**(本地隔离栈:临时库 ihui_e2e 257 迁移+seed / api 8822 / web 8821 / 2 workers,46.6 分钟)。前置工程:①`next.config.ts` rewrites 53 处 destination 环境变量化(`IHUI_API_PROXY_TARGET`/`IHUI_AI_PROXY_TARGET`,默认 8802/8803 不变,commit a511893033)——rewrites 在 build 期冻结进 routes-manifest.json,必须构建时传;②`.gitignore` 补 `.next-e2e*/`(commit 3128e8e63d)——Tailwind 4 自动源检测扫描未忽略的构建产物目录,从 minified JS 抽出含控制字符(U+0005/07/19)的坏 candidate 注入 globals.css → Lightning CSS parse 非确定性失败(与 2026-08-05 .next-bak-* 内存爆炸同根因);③本地 playwright 浏览器升 1234。**56 失败集中于 18 个 spec**,三类:**A 环境依赖**(隔离库无业务种子,knowledge-base/im-channels/model-selector-SSR 等,CI 同样无种子→CI 上也红)/**B 真实 UI 回归**(chat-mode-badge×11 agent-progress-trigger 渲染空、login-dialog 不弹×10、page-indicator 几何 24px≠36px 疑 Button 档位回归、ai-panel-env-info 按钮缺失)/**C 视觉像素差**(icon-text-alignment 3.3px delta、sidebar-visual)。清单文件 `.ihui-agent/tmp/triage-summary.json` + 全量 JSON `triage-report.json`。
- [x] ✅(2026-09-14) 2. 按类修复坏例至本地全绿:**647 例 = 581 passed / 0 failed / 1 flaky(ide-editor 终端面板,重试过)/ 65 skipped,13.6m**(隔离栈:web 8821 = `.next-e2e` 构建产物 + `JWT_SECRET` 对齐 8822 CI 测试 secret;api 8822 = ihui_e2e + Redis db15;2 workers)。修复分三层:**①spec 校准(DOM/i18n/环境演进,15 个 spec)**——chat-mode-badge(断言改 aria-label,iconOnly 变体无文本 span,全站唯一 AgentProgressTrigger 实例)、login×2(waitForAppHydrated 等初始化)、page-indicator-geometry(校准到 v15 最终形态 24×10/10×10/138px)、icon-text-alignment(测量排除 aria-hidden 装饰指示符)、ai-panel-env-info+floating-panel(状态化 aria-label + context-usage-ring 补 testid)、sidebar-height-verify(按 aria-label 匹配)、remember-password(删死键)、phase-21-timeline-sse(prod 无 `__IHUI_LANGUAGE_STORE__`,改 persist 直写+重渲染)、prompt-templates(弹层治理后 role=menu + 模板名 i18n 已简化"总结任务"→"总结")、model-selector(trigger 锚点改 `.model-selector-text` 防误匹配"模型市场"+ position 点击绕窄面板重叠)、dialog-position-regression(**移除 8801 生产硬编码改走 baseURL** + 移动端走 关面板→菜单→登录 真实路径)。**②产品修复(根因)**——GlobalShell AI 面板 `dynamic loading` 等宽占位根治 CLS 0.21(next/dynamic 内部自带 Suspense 吞挂起,外层 Suspense 永不渲染);4 个 portal 弹层(add-menu/context-usage-ring/slash-palette/permission-history)补 `z-popover`(挂 body 且 z-auto 被营销首页 hero z-10 压住,菜单可见但点击被拦)。**③测试基建**——新增 `seed-e2e-knowledge`(幂等 8 条公开知识条目)+ global-setup 挂载,隔离库重建后 knowledge_base 空表不再导致 knowledge-base 4 例恒红。提交 `0cbd01e6`(20 文件)。**遗留**:AI 面板 300px 窄面板下输入 toolbar 模型按钮(18px 图标态)被「构建任务」浮动按钮 svg path 覆盖,真实用户仅约 2px 边缘可点,UI 重叠待产品侧修复;本地复用隔离库时 `E2E_SKIP_SEED=1`(global-setup 的 seed:test-users 经 dotenv 默认连 `apps/api/.env` 即 ihui_dev,本地操作需 env 显式覆盖)。
- [ ] 3. CI 复评:实测 CI 生产服务器下 2-4 workers 稳定性;`timeout-minutes` 按实测全量时长 ×1.5 重设,消除 30min 硬顶。
- [ ] 4. 观察期:连续 3 次 main push e2e 稳定绿后收官。

> 备注:main 无分支保护,e2e 非必需门禁;HEAD `8d54a432d8` 其余 7 个 workflow(CI/CI (Monorepo)/Real DB Integration Tests/Build Docker/Knip/Mirror to CN/OpenAPI Check)全 success,业务合并门禁不受 e2e 阻塞。

<!-- 已归档占位与水印尾行见文件末尾 -->

## P0 中转站全链路集成收官——凭据契约与模型名归一化(2026-09-13 立,跨端:apps/api + apps/ai-service + apps/web + apps/cli + docs + scripts)

> 起因:生产实测发现两类中转站对外交付缺陷——① 对外 API 文档/UI 把 Bearer 写成 `sk-xxx`,而实际鉴权只认公开标识 `ihui_xxx`(生产实测 `Bearer sk_...` → 401);② 客户端传小写模型名 `minimax-m3` 时号池按 `model_id` 精确 eq 查不到 → 落到默认 provider → 上游 422。

- [x] ✅(2026-09-13) **1. 模型名归一化四层防护(入站改写 + 漏归一写入点 + 计费分组键)**:共享归一化工具 `packages/shared/src/constants/model-names.ts`(`OFFICIAL_MODEL_NAMES` + `normalizeModelId` + `toOfficialModelName`)、Python 同源 `apps/ai-service/app/core/model_naming.py`、脚本端 `scripts/lib/model-names.mjs`;`v1-public.ts` 入站改写(流式/非流式两条路径均走 `resolvedModel`);DB 表达式唯一索引 `(config_id, LOWER(model_id))` 防大小写双条目。`packages/shared/src/constants/__tests__/model-names.test.ts` 9 例。
- [x] ✅(2026-09-13) **2. ai-service 入站归一补全(含越权修复)**:`/llm/complete` 与 `/llm/complete/stream` 入口补官方名改写(新增 `to_official_model_name`,与 TS 对称;model 为可选字段时保持 None);`_is_restricted_model` 改大小写不敏感——原实现精确匹配小写集合,客户端传 `GPT-4o` 可绕过「受限模型仅管理员可用」的 403,而下游 `_model_to_provider_code` 会 lower() 解析到 openai 真实付费 key,构成非管理员越权消费付费额度;`token6688_catalog` 元数据查询改 `LOWER()` 比较;`v1-realtime` 白名单与 provider 前缀判定、`relay-param-ops` 规则匹配改归一比较;`recordCall` 写 `llm_call_logs` 统一为归一值防统计分裂。
- [x] ✅(2026-09-13) **3. 凭据前缀契约一致性收口**:修复 8 个 UI 页面/文档把 Bearer/API Key 写成 `sk-xxx` / `sk-ihui-xxx` / `sk-your-api-key`(覆盖 `apps/web` 9 文件 + `docs` 6 文件 + `apps/cli/README.md`),统一为 `ihui_xxx`;`sk_xxx` 仅保留于 `X-Api-Secret` 语境。
- [x] ✅(2026-09-13) **4. 防回归守门 + 三端同源测试**:新增 `scripts/check-api-credential-prefix.mjs`(20 条规则自检,全量扫描 3452 文件 1.3s,豁免 `X-Api-Secret` 文案、脱敏展示 `sk-***`、BYOK 上游自有 key、上游厂商 `sk-ant-/sk-step-` 等),接入 pre-commit blocking(`HUSKY_SKIP_CREDENTIAL_PREFIX_GUARD=1` 紧急跳过),`npm run check:api-credential-prefix` 手动入口;新增 `apps/ai-service/tests/test_model_naming.py`(25 例)锁定 TS/Python/脚本三端 `OFFICIAL_MODEL_NAMES` 逐字一致 + 两个归一函数行为边界。

- [x] ✅(2026-09-13) **5. 远端「三模式计费」提交引入的两处回归修复 + 取整语义收口(commit `15636cf8f8f`)**:
  - **回归一(分组倍率键被回退)**:`923bfa9d740` 把 `e6d76acebe7` 的 `getUserModelMultiplier(userId, dbModelId)` 覆盖回原始 `model`,导致与同函数 `aiPricing`/`aiModelConfigModels`/`getCurrentTierMultiplier` 不同键空间——客户端大小写与分组覆盖配置不一致时静默取不到覆盖(少收/多收)。已恢复为 `dbModelId`。
  - **回归二(目录去重键被弱化)**:同一提交把 relay 公开目录去重键由 `normalizeModelId` 换成 `toLowerCase()`,与 `/v1/models` 口径不一致,DB 存量大小写/前缀差异会导致对外目录双条目。已恢复 `normalizeModelId`。
  - **取整语义收口**:`roundCents`(保留 6 位小数)是既定设计(成本列已 `integer→numeric(18,6)`,整数取整下低价调用恒为 0 形成免费敞口),但配套测试断言与一处文档注释未同步,致 `apps/api` 9 项测试红。已按新语义更新断言(12.5/0.3/2.5/7.8/22.8/0.8/3.3/0.5/20.1/44.3/0.7/0.2)与 `platformFeeCents` 文档口径(`Math.round → roundCents`);该 9 处与远端 `301a0b2316a` 独立修复**逐值等价**,rebase 时已采用远端版本去重。
  - **溯源水印补齐**:`20260913160000_multimodal_billing.sql` / `20260913170000_cost_cents_numeric.sql`(远端提交漏带水印,守门 [47] 每次提交都会自动改写)。
  - 验证:`apps/api` tsc 0 错(tsconfig 覆写 `@ihui/*` 指向本分支源码)、全量 vitest 385 文件 6317 用例全通过、relay 三组 + v1-messages 61/61、eslint 0 error、prettier 通过、78 项守门全通过。

> 遗留(需用户侧动作):**生产蓝绿部署为 GitHub Actions 手动触发**(`blue-green-deploy.yml` 仅 `workflow_dispatch`),本轮修复已在 main(三仓对齐),但生产进程尚未重建,故线上小写 `minimax-m3` 仍 503。需在 GitHub Actions 手动跑一次 Blue-Green Deploy(environment=production),部署后小写 `minimax-m3` 应转为 200。补偿验证:apps/api tsc 0 error、mypy 4 文件 0 问题、ruff check 通过、eslint 0 error、prettier 通过、pytest 25/25、vitest 61/61。commit `e6d76acebe7`(第一批)+ 本轮。

<!-- 已归档占位与水印尾行见文件末尾 -->
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
