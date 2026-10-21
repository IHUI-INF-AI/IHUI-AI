<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Spec — 2026-10-21 会话：CI org_create 交接件落地 + release-sdk 双缺陷修复 + 派单面消化

## 0. 背景与依据（不重读，直接引用已核对结论）

- 交接依据：`e:\桌面\查询剩余计划任务_2026-10-21_14-11.md`（上一会话导出，2026-10-21T06:11:44Z）。
- 上一会话遗留两件未完成交接：
  1. CI org_create 两文件已写好但**未落地**；落地后需 `gh workflow run npm-bootstrap.yml -f action=org_create`。
  2. `release-sdk.yml` 两个缺陷未修。
- 用户持续指令（记忆 + 导出原文）：最大化并行子 agent、完美细致完整毫无遗漏、agent 自主完成全部剩余动作、完成后提交 git、直到无任何后续建议才收尾。

## 1. 现场核对结论（todo 1 产出，已现读）

### 1.1 交接件状态
| 文件 | 状态 | 证据 |
|---|---|---|
| `.github/scripts/npm-bootstrap-runner.mjs` | M，+195/-27 | `git diff --stat`；`node --check` 通过（输出 RUNNER-OK） |
| `.github/workflows/npm-bootstrap.yml` | M，+6/-1 | 同上 |
| `.github/scripts/package.json` | `??` untracked | 本地测试残留（playwright ^1.49.1） |
| `.github/scripts/package-lock.json` | `??` untracked | 同上 |

**判定：package.json / package-lock.json 不入库。** 理由：workflow 的 `Install playwright + real Google Chrome` 步骤自带 `npm init -y && npm i playwright@1.49.1`，CI 不依赖入库的 package.json；入库反而会让本地 Node 版本锁进 CI。上一会话未决问题由此结清。

runner 关键接线（已核对，不再读）：
- line 312 `else if (ACTION === 'org_create') await runOrgCreate(page, n)`
- line 389 `async function npmWebLogin(page, attempt)`（trusted_publisher / org_create 共用登录件，§0.6 单源）
- line 495 `runOrgCreate` 复用 `npmWebLogin`
- 头注 line 9 声明 org_create action 用途

workflow 关键改动（已核对）：
- line 14 action 描述追加 `| org_create`
- line 22/46 `otp_code` 描述覆盖 org_create
- line 57-71 CI 安装 playwright + 真 Chrome + xvfb
- line 79 `UNDER_XVFB=1 timeout -s KILL 1500 xvfb-run ... node npm-bootstrap-runner.mjs`
- line 97-117 publish job 用 `secrets.NPM_PUBLISH_TOKEN` 发 ihui-cli

### 1.2 并发环境（决定提交方式的硬约束）
- 索引内**现有 8 个他席 staged 件**（现读）：`apps/api/src/db/learn-extended-queries.ts`、`apps/api/src/routes/learn.ts`、`apps/mobile-rn/src/screens/CourseDetailScreen.tsx`、`apps/mobile-rn/src/screens/VideoPlayerScreen.tsx`、`apps/web/e2e/chat-pane-parallel-stream.spec.ts`、`packages/api-client/src/endpoints/course.ts`、`packages/api-client/src/endpoints/learn.ts`、`packages/types/src/app-content.ts`（+1368/-109）。
- HEAD 最近 3 条均为他方自动愈合提交（`3cb5fd123b` / `1d6bc710ed` / `e2f45ba83e`，14:43 前后）。
- 计划任务 `IHUI-AI git-guardian`、`IHUI-AutoRecovery-HealthCheck` 每 2 分钟活动。
- ⇒ **铁律：只 `pathspec` 声明集提交，绝不 `git add -A` / `git add .`，绝不碰他人 staged 件；禁止 stash。**

### 1.3 派单面现读（todo 5 输入）
`node scripts/plan-tasks.mjs --open --dispatchable --exclude-inflight`
- 口径：「现在可做」26 / 162 行；剔除 待人拍板 8 / 等条件 28 / 归他人 100
- `--exclude-inflight` 暂移 8 行（L5860 / L7156 / L7211 / L7212 / L28826 / L28827 / L28856 / L28867）⇒ **出单 18 行**
- 18 行 = L7207、L7209、L28801、L28831、L28832、L28834、L28836、L28844、L28846、L28848、L28852、L28857、L28859、L28863、L28864、L28865、L28866、L28868

## 2. 缺陷定义

### 缺陷 A — `release-sdk.yml` 缺 `@ihui/types` 构建步骤
- 位置：约 line 330-334，直接 `pnpm --filter @ihui/sdk typecheck` + `build`。
- 根因：`packages/types/package.json` 的 `types` 指向 `./dist/index.d.ts`，而 `git ls-files packages/types/dist` = 0（dist 不入库）⇒ CI 干净检出无 dist ⇒ `sdk` 内 13 处 `import ... from '@ihui/types'` 全部解析失败（与实测「13 errors」吻合）。
- 本机 typecheck 绿是**假绿**（本机 dist 存在），这正是「把未验证写成已验证」的生成机制。
- 修复：在 sdk typecheck 之前插入 `pnpm --filter @ihui/types build`（与 `release-cli.yml` 同构的依赖先行顺序）。

### 缺陷 B — `NPM_TOKEN` 名不副实
- SDK 通道实际可用凭据是已存在的 `secrets.NPM_PUBLISH_TOKEN`（CLI 通道同源，账号 `ihui-ai` 已建成、`ihui-cli@1.0.0` 已发布并回读确认）。
- 方案 **B（选定，不涉及凭据放置）**：改 2 处运行时引用 —— line 200 `NPM_TOKEN: ${{ secrets.NPM_TOKEN }}` → `${{ secrets.NPM_PUBLISH_TOKEN }}`；line 419 `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` → `${{ secrets.NPM_PUBLISH_TOKEN }}`。
- 同步改头注 line 15-18（现文写「SDK 通道缺的是 secrets.NPM_TOKEN 这一枚…未配置时 real 模式 npm gate 判红（设计如此）」—— 改名后该登记已失真，必须同步，否则是虚假登记）。
- **不动** line 221-227 凭据硬闸逻辑、line 391 注释、line 400 报错文案中的变量名语义（它们引用的是环境变量 `NPM_TOKEN`，其**来源**改为 PUBLISH token 即可）。

## 3. 变更清单（精确到文件与动作）

| # | 文件 | 动作 | 提交声明集 |
|---|---|---|---|
| 1 | `.github/scripts/npm-bootstrap-runner.mjs` | 已改好，仅复验 | ✅ |
| 2 | `.github/workflows/npm-bootstrap.yml` | 已改好，仅复验 | ✅ |
| 3 | `.github/scripts/package.json` | **不入库**（保持 untracked） | ❌ |
| 4 | `.github/scripts/package-lock.json` | **不入库**（保持 untracked） | ❌ |
| 5 | `.github/workflows/release-sdk.yml` | 插入 types 构建步骤 + 2 处 secret 改名 + 头注同步 | ✅ |

提交方式：`node scripts/safe-commit.mjs -m "<msg>" -- <file1> <file2>`（五步法，只 add 声明集）。
推送：`node scripts/git-sync-converge.mjs`（遇 F1 状态放大拒绝推进则停下如实上报）。

## 4. 执行步骤与验证

### Phase 1 — 修 release-sdk.yml
1. 编辑三处（见 §2 缺陷 A / B）。
2. 语法校验：`node -e "require('js-yaml')"` 不可用则用 `python -c "import yaml,sys;yaml.safe_load(open(r'...'))"` 或 `npx --yes yaml-lint`；至少保证缩进与 `steps:` 层级正确。
3. 回读确认：`grep -n "NPM_TOKEN\|NPM_PUBLISH_TOKEN\|@ihui/types" .github/workflows/release-sdk.yml` —— 运行时引用只剩 PUBLISH，types 构建位于 typecheck 之前。

### Phase 2 — 落地两个 CI org_create 件
1. `node --check .github/scripts/npm-bootstrap-runner.mjs`（已过，落地前复跑一次）。
2. 水印校验：`node scripts/watermark.mjs verify`（若存在该入口；否则核对文件头 4 行声明完整）。
3. `node scripts/safe-commit.mjs -m "feat(ci): npm-bootstrap 增加 org_create 动作(真 Chrome+xvfb 网页建 org)" -- .github/scripts/npm-bootstrap-runner.mjs .github/workflows/npm-bootstrap.yml`
4. `node scripts/git-sync-converge.mjs`
5. 触发：`gh workflow run npm-bootstrap.yml -f action=org_create`
6. 盯运行：`gh run list --workflow=npm-bootstrap.yml --limit 1` + `gh run watch <id>`；若卡 OTP/reCAPTCHA，取 `rc-live` 分支日志与截图，**如实上报需要机主邮箱验证码**（此为唯一可能的人工点，用户已声明 agent 可自主完成，能自动则自动，卡住则明确上报）。

### Phase 3 — 并行子 agent 消化派单面 18 行 + web 壳续批
- 18 行按主题分组派给 `general-purpose` 子 agent，每组给足上下文（行号、判据、验收命令），要求：只改本任务文件、不动他人 staged 件、完成后报告验证命令输出。
- web 壳 `apiOrThrow` 迁移余 110 枚：分批派发，排除在飞点名文件。
- 所有产出统一由主会话用 `safe-commit` pathspec 落地，禁止子 agent 自行 `git add`。

### Phase 4 — 收口
1. 全量验证（lint / typecheck / 相关单测）现读结果。
2. 提交 + `git-sync-converge` 推送收敛。
3. 台账现读终报：open / dispatchable / 等拍板 / 等条件 / 归他人 / 进行中。
4. 无后续建议方可关闭对话。

## 5. 验收判据（可执行）
- [ ] `node --check .github/scripts/npm-bootstrap-runner.mjs` 退出 0
- [ ] `git diff --cached --name-only` 提交后不含 8 个他席件（提交前后各核一次）
- [ ] `grep -c "secrets.NPM_TOKEN" .github/workflows/release-sdk.yml` == 0（运行时引用层面）
- [ ] `grep -n "@ihui/types" .github/workflows/release-sdk.yml` 显示 build 在 typecheck 之前
- [ ] `gh workflow run npm-bootstrap.yml -f action=org_create` 触发成功并有 run id
- [ ] `git-sync-converge` 返回「推送收敛成功」
- [ ] 台账派单面行数下降且无同主键两态并存

## 6. 需要的批准
- 本 spec 涉及：修改已入库 CI workflow（release-sdk）、提交并推送 2 个交接件、**触发真实 CI 运行**（org_create，可能向 npm 写入组织）。
- 请求批准后进入执行（TodoWrite 跟踪 Phase 1-4）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
