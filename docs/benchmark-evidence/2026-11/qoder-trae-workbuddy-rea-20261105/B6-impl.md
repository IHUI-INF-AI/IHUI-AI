<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# B6 实施记录 — 子进程网络出口管控（DNS 域名裁决 + env 出口）

## 1. 现场读数

- 开工 HEAD：`244862bacbdc1a94faa12c8abf79565672058ff0`；交付时 HEAD：`14e02e57f52337bef3a932d2b23571a84d3c6e1f`
  （他席那一枚只动 `file-access-policy.ts` 一族，现读 `git diff --stat 244862b..HEAD -- apps/cli/src/sandbox/index.ts` = 空 ⇒ 我的基线 blob 未被挪动）。
- 对侧取证复核（现读，非转述）：`docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W1-workbuddy-main.md`
  第 69 行（表项 17「网络出口双引擎分工」：`network_policy={enabled,default:"allow",deny_ips,deny_domains}`，tsbx 只做 DNS hook 域名拦截、TCP 恒放行，连接决策交 Rust LocalProxy）
  与第 104 行（③ 行：本仓对位 = 零）。
- 本仓缺口复核（现读）：`git show HEAD:apps/cli/src/sandbox/index.ts | grep -icE "network|egress|proxy|dns"` = **0**；
  `apps/cli/src/tools/fetch-url-egress.ts:9` 仍是 `NO DNS preflight. Only hosts that ARE IP literals are judged` ⇒ 智能体经 Bash/终端派生的子进程网络流量此前无人管。
- 借力的既有纪律（现读行号）：`sandbox/permission-axis-runtime.ts:250-288`（三态 + `reason`/`hint` 形态）、
  `tools/command-policy/evaluate.ts:14-24`（三态 verdict，默认态 unknown）、`sandbox/glob-pattern.ts:26-37`（`*` 单层 / `**` 递归的唯一 glob 原语）、
  `packages/shared/src/utils/ip-literal.ts:35-55` + `:254`（`DENIED_CIDRS` 与 `isPrivateOrReservedIp` 网段真源）。
- 他席在飞（不代修）：`apps/cli/src/skills/packaging/index.ts` 处于暂存删除态 ⇒ `apps/cli/src/commands/skill-package.ts` 报 7 条 TS2307/TS7006/TS18046，全仓 typecheck 现读错误文件枚举 = 只有这一个。

## 2. 落了什么

新建 `apps/cli/src/sandbox/egress/` 一族（7 个文件，全部零 IO 裁决 + 显式注入面）：

| 文件 | 行 | 职责 |
| --- | --- | --- |
| `policy.ts` | 221 | 声明式规则形状 + 按名裁决 `judgeEgressTarget`，`decision = allow \| deny \| unjudged`；域名折成**逆序标签路径**后 import `glob-pattern.ts` 匹配（`*` 单层 / `**` 递归，**没有第二份 glob→正则**）；内网网段 import `isPrivateOrReservedIp`（**没有第二份 CIDR 表**） |
| `builtin-rules.ts` | 55 | 内置行**派生**自 ssrf-guard 既有 `DENIED_HOST_NAMES` / `DENIED_HOST_SUFFIXES`（名单加长本表自动跟长）；含"根层单列族"（`com/example/**` 不吃 `com/example`，同 `file-access-policy.ts` 那一道实测） |
| `policy-source.ts` | 97 | env → 生效策略的取值装配（分工同 `permission-axis-runtime.ts`）：内置表**永远在场**、机主点名的 deny 行天生 enforce、认不出的取值落**更严一侧** + warning |
| `dns-adjudicator.ts` | 242 | 只做域名裁决，**不实现 TCP**；取词 `tokenize` 默认复用 `tools/command-policy/tokenizer.ts`（唯一分词器），解析 `resolver` 为注入面 ⇒ 测试与 CI 全程零网络；解析器未接线/抛错/返回 null/枚举到 0 条地址 ⇒ 四种"护栏自身故障"形态各自落 `unjudged` 并点名 |
| `env-inject.ts` | 224 | 结论落成子进程出口：`IHUI_EGRESS_DECISION` / `IHUI_EGRESS_DENIED_HOSTS` / `IHUI_EGRESS_UNJUDGED(_REASONS)` / `IHUI_EGRESS_LEDGER_STATE(_REASON)`；只有声明了 `IHUI_EGRESS_PROXY_URL` 才点 HTTP(S)_PROXY + NO_PROXY 那条腿（没代理进程就不假装执法）；键名刻意避开自家凭据 deny 表后缀，且顺序固定"先剥凭据、后并出口" |
| `audit-ledger.ts` | 168 | 逐条留痕 `<repo>/.ihui-agent/state/egress-decisions.jsonl`（现读默认路径 = `G:\IHUI-AI\.ihui-agent\state\egress-decisions.jsonl`）；写前过形状锁 `ledgerViolation`（禁列键名 + 值不得含 `//`、`?`、`@`、Bearer ⇒ 凭据与查询串进不去），不合格**整批不落**并点名；取不到仓库根/写失败 ⇒ `unjudged`，不静默丢 |
| `tests/sandbox-egress-dns.test.ts` | 250 | 14 例（见下） |

消费者（真接线，非"以后再接"）= `apps/cli/src/sandbox/index.ts` 两条 spawn 出口。before/after（HEAD blob 行号 → 工作树行号）：

- `import` 段：30（`isPosixProcessGroupAlive` 之后）→ **33** 新增 `import { applyEgressEnvExit, buildEgressEnvExit, reportEgressWarnings } from './egress/env-inject.js'`
- `runSandboxed`：930 `const filteredEnv = buildFilteredEnv(blockedEnvVars)` → **934-963**（934 问出口、935 出声、936-959 命中 enforce 档 deny 就按既有 `blocked` 形态返回而不拉起进程、963 `applyEgressEnvExit(buildFilteredEnv(...), egressExit)`）
- `runSandboxedAsync`：1053 同一行 → **1085-1114**（同构）
- 两个 `spawnOpts` 本体未动：现读仍 `stdio: ['ignore','pipe','pipe']` + `windowsHide: true`（§12g / §5b 齐备；本票不新增 spawn）
- `git diff --stat HEAD -- apps/cli/src/sandbox/index.ts` = `1 file changed, 64 insertions(+), 3 deletions(-)`

超越轴（相对对侧，逐条可验）：

1. 对方要真驱动 / 真代理进程才能验；这里裁决与取词都是**可注入 fake 的纯函数**，14 例全部在 CI 里直接断言，零网络。
2. 对方钩子坏了是 `catch {}` 静默降级；这里"护栏自身故障"单列一态：取不到规则表 / 解析器未接线 / 解析器抛错 / 枚举到 0 条地址 / 台账目录取不到 / 台账写失败 ⇒ 各自 `unjudged` + ASCII 原因码 + 下一步，既不冒绿也不冒红。
3. 对方只有 DNS/TCP 两引擎；这里补了第三件对方没有的东西：**裁决逐条落台账**（对齐 §5e-3"量得到"），且台账自带凭据形状锁。
4. 默认档不制造恒红门（§12e）：内置行 advisory（出声 + 留痕），enforce 只由机主显式点名或 `IHUI_EGRESS_ENFORCE=1` 触发 —— 免得把"本地 curl 自己的 dev server"这类既有工作流一刀切死。

## 3. 验证末行现读

```
$ cd apps/cli && npx vitest run tests/sandbox-egress-dns.test.ts
 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  619ms

$ npx vitest run tests/sandbox-egress-dns.test.ts tests/sandbox tests/sandbox-index.test.ts tests/sandbox.test.ts tests/sandbox-command-allowlist.test.ts
 Test Files  11 passed (11)
      Tests  160 passed (160)

$ npx vitest run tests/child-env-boundary.test.ts tests/g-465-env-report-surface.test.ts tests/mcp-child-env-allowlist.test.ts \
    tests/permission-axis-runtime.test.ts tests/file-access-policy.test.ts tests/sandbox-profile.test.ts \
    tests/sandbox-profile-single-source.test.ts tests/sandbox-strict-default-on-missing-config.test.ts tests/sandbox-output-encoding.test.ts
 Test Files  9 passed (9)
      Tests  136 passed (136)

$ npx vitest run tests/builtins.test.ts tests/terminal.test.ts tests/auto-background.test.ts tests/background-registry.test.ts
 Test Files  4 passed (4)
      Tests  103 passed (103)

$ npx vitest run tests/egress-guard.test.ts tests/fetch-url-egress.test.ts tests/goal-verification-egress.test.ts
 Test Files  3 passed (3)
      Tests  60 passed (60)

$ npx tsc --noEmit -p apps/cli/tsconfig.json   # 触及面
（错误文件枚举现读 = 1 个：apps/cli/src/commands/skill-package.ts，共 7 条，他席在飞；我的 egress/*、sandbox/index.ts、用例文件 0 条）

$ node scripts/watermark.mjs verify <8 个触及文件>
[watermark:verify] 判定面=worktree(显式点名=工作树) 覆盖 8/8 个指定文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 仅隐写 0 个, 跳过 0 个, ...
纳入口径的文件均已携带完整溯源水印。
```

14 例覆盖：三态成对（deny / allow / unjudged）+ 取值认不出落更严；内网网段正反对照（7 内网 vs 3 公网）+ 声明序例外；通配不越层（`*.example.com` 不吃 `a.b.example.com`、`**.example.com` 不吃 `example.com` 本身）；取词只留主机名（注入分词器与**默认分词器**双跑，`user:secret@…?token=abc` 一个字段都进不去）；变量化参数 ⇒ `target-unexpandable`；地址证据四态（内网 deny / 公网 allow / null / 0 条 / 抛错 / 未接线）+ deny 命中即止绝不再问 DNS；env 出口形态（含"没声明代理就不点腿"与坏 URL 点名）；出口标记不被自家凭据表剥掉；留痕行形状 + 反向牙（把 URL 塞进 target ⇒ 整批拒写）；台账写失败/取不到目录/0 行三态分档；**接线锁 ⑧**：`runSandboxed('curl https://egress-wired.test/x')` 现读 `blocked=true`、`stdout=''`、`exitCode=null`（副作用没发生）+ 正向对照 `echo b6-egress-ok` 照常执行 + 台账真落盘并含该 deny 行（用例只写 `.ihui-agent/tmp/` 下临时件，`finally` 清理）。

`any` 现读 = 0 命中；每文件行数（221/55/97/242/224/168/250）均 ≤250。

默认台账路径的实跑证据（非夹具）：`.ihui-agent/state/egress-decisions.jsonl` 现读 4 行，全部由既有 `tests/sandbox*` 用例里真跑的
`curl`/`node -e fetch` 命令经 `runSandboxed` 写出（形如
`{"ts":"2026-11-04T20:15:43.753Z","pid":30080,"target":"example.com","decision":"allow","layer":"default","reason":"default-allow","enforcement":"advisory","enforced":false}`），
逐行只有主机名 + ASCII 原因码，无 path/query/凭据字段 ⇒ 出口默认落盘真的在动，不是"造好没装车"。

## 4. 未竟（带解锁条件）

1. **TCP 连接级判定腿**（对侧的 LocalProxy 那一引擎）。本票刻意不起常驻代理进程。
   解锁条件 = 有一个常驻载体（nssm 服务或 guardian 派生的 worker）监听本机端口；载具就位后只需设 `IHUI_EGRESS_PROXY_URL=http://127.0.0.1:<port>`，`env-inject.ts` 会立刻把 HTTP(S)_PROXY/NO_PROXY 两条腿点上（代码路径已有，用例 ⑥ 已断言），无需再改判据。**没有载体时这条腿自动不点，不假装在执法。**
2. **生产 `DomainResolver` 适配器**（真 `node:dns` 解析）。当前生产面 `addressProof` 默认关 ⇒ 只按名字与 IP 字面量判；一旦设 `IHUI_EGRESS_ADDRESS_PROOF=1`，未接线的解析器会让每个默认放行的域名落 `unjudged` + 点名（这是设计，不是缺陷）。
   解锁条件 = 在派生点接一个**异步**解析缓存（`node:dns/promises` + TTL 表）并把同步快照喂进 `buildEgressEnvExit({ resolver })`；`runSandboxed` 是同步面，所以适配器必须先有旁路预解析（或由代理腿代替），否则只能给 `runSandboxedAsync`/工具层异步路径用。
3. **无 scheme 的裸域名取词**（`git clone host:path`、`nc host 22`、`--targethost foo.internal` 这类）。当前取词保守地只认「带 scheme 的 http(s) URL」+「裸 IP 字面量」+「变量化且名字像 URL 的参数」，避免把 `10:30`、`a/b.c` 误判成出口目标。
   解锁条件 = 与 `tools/command-policy/syntax-table.ts` 的"网络类命令 + 操作数位"联动定位（即由命令判据告诉我们哪个 token 是目的地），而不是在本票里凭猜扩面。
4. **桌面端（Tauri）同源策略腿**：W1 ③ 行的对位清单含 `apps/desktop`，该目录在本票禁改清单内 ⇒ 未动。解锁条件 = 另开票（`apps/desktop/src-tauri/**` 的 Rust 侧网络出口与本仓 env 出口对账）。
5. **AGENTS.md / README 点名与 PROJECT_PLAN 登记**：按边界由主席统一落地。本票未 commit、未 push、未动两份活文档。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
