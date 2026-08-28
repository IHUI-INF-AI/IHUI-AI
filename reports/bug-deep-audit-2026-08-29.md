# IHUI-AI 深度 Bug 分析报告

- 审计时间:2026-08-29 00:15 ~ 00:55(跨越 8/28 夜)
- 审计范围:全仓 8 端 + 15 包(apps/api、apps/web、apps/ai-service、apps/mobile-rn、apps/miniapp-taro、apps/desktop、apps/extension、apps/cli、packages/*)
- 审计方式:6 项静态守门脚本 + 全量 typecheck + 定向深度代码审查(积分/支付/流式/WS/鉴权/i18n/上传路由)
- 审计工具:并行子代理(2 个因账号 429 中断,与项目记忆"本账号不可并行 agent"一致)→ 全部转为本地脚本 + 人工证据核验

---

## 一、执行摘要(先看结论)

1. **全仓唯一的门禁红灯 = miniapp-taro 正在被一个活跃的外部进程实时改写**(i18n 批量改造),工作区 255 个文件未提交,typecheck 全仓失败。
2. 除 miniapp-taro 外,其余 7 端 + 全部包 **typecheck 全绿**,6 项守门脚本全绿,关键业务模块(积分原子性、支付幂等、流式连接清理、WebSocket 清理)经深查**未发现缺陷**。
3. **未发现已提交的历史性 P0 bug**;本次所有 P0/P1 均源自**未提交的工作区改造半成品**与**防御性安全配置**。
4. 工程整体质量高(见 §四 已验证无问题清单),本次审计的核心价值 = 定位并量化了唯一危险点 + 给出修复路径。

---

## 二、P0 — 阻断级(2 项)

### P0-1 并发改写进程 + 未提交半成品改造(miniapp-taro,255 文件)

**位置**:`apps/miniapp-taro/src/**`(components/、pages/ 大量文件)+ `packages/i18n/messages/miniapp-taro/*.json`(5 语言各 +755 行)

**证据链(本机实测)**:

- 存在 node 进程持续写盘:0:48~0:50 间 `src/` 文件 LastWriteTime 持续刷新(AgentListPanel.tsx、DrawerComponent.tsx、VipBenefitsPopup.tsx、adapters/* 等),未随审计结束而停止。
- 类型检查输出**不稳定**:同一命令连续两次运行,输出 md5 不同;错误总数在 103 ↔ 279 ↔ 308 之间波动,行号漂移。
- 消息文件写入时间(23:39)与 typecheck 结束时间(23:39)重合,证明检查读到的是**被截断的中间状态**(曾出现"已 import 的 `t` 仍报未定义"的矛盾,实为读到写入中文件)。
- git status:255 个文件 M、1 个新增未跟踪目录 `apps/miniapp-taro/scripts/i18n-migration/`(改造 codemod)。

**风险**:

- 若在改造未完成时提交/发布,小程序端 35+ 页面运行时 ReferenceError 白屏(见 P0-2)。
- 多人/多会话同仓并发写源码,互相覆盖,改造永远无法收敛。

**修复建议**:

1. 先确认并**终止/等待**改写进程(检查是否有第二个 WorkBuddy/IDE 会话在跑 i18n 迁移)。
2. 同一仓库**禁止并行开启第二个改造会话**。
3. 改造收敛后重跑 `pnpm typecheck` 全仓至 0 错误再提交。

---

### P0-2 中间态确定性错误类别(多次快照稳定出现,非单次偶然)

改造中间态的 tsc 错误中,以下类别在多次快照**反复出现**,任何一类残留都会造成运行时故障:

| 类别                                                                                                                                                      | 规模(快照区间) | 位置示例                                                                                                                                                                                          | 运行时影响                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| TS2304 未定义标识符(`t`/`tt`/`useRouter`/`useShareAppMessage`/`useShareTimeline`/`useReachBottom`/`usePullDownRefresh`/`useDidShow`/`getCurrentInstance`) | 68~284 处      | pages/course/detail.tsx、pages/exam/_、pages/order/_、pages/pay/_、pages/study/_、pages/live/_、pages/news/_、pages/favorites/_、pages/following/_、pages/member/_、pages/circle/_、pages/share/* | **ReferenceError → 页面白屏/崩溃**(Taro hooks 必须从 `@tarojs/taro` import)                 |
| TS2305 `@/i18n` 无导出 `tList` + TS6133                                                                                                                   | 10 处          | components/CourseRating.tsx、pages/about/business-license、pages/ai/chat.tsx                                                                                                                      | `tList is not a function`(实际应 `const { tList } = useI18n()`)                             |
| TS2300 `useDidShow` 重复声明                                                                                                                              | 4~5 处         | pages/community、pages/member/index.tsx、pages/member/benefits.tsx、pages/share/index.tsx                                                                                                         | 同名双重绑定,行为不确定                                                                     |
| TS2554 `t()` 参数签名误用(把 fallback 当 params 传)                                                                                                       | 4 处           | `t('key', '字符串')`(t 第二参应为 `Record<string,string                                                                                                                                           | number>`)                                                                                   | params 为字符串 → 插值异常 |
| **i18n key 缺失**(`t('ns.key')` 引用的 key 在 5 语言包均不存在)                                                                                           | 109~114 处     | ErrorView.p1、FilterDropdown.p1、InvitePoster.p1、ModelConfigDialog.q1~~q5、ModelTypeButtonGroup.m1~~m3、NavBar.z1、QrCodeShare.p1/p2、VipBenefitsPopup.z1~z3 等                                  | `translate()` 缺 key 时**回退返回 key 原文**(loader.ts:43),用户看到 "ErrorView.p1" 等裸 key |

**根因**:i18n 迁移 codemod(pass 脚本)机械替换硬编码中文为 `t('<组件名>.p<序号>')`,存在三个缺陷:① 未同步补 import(或补错成员 `tList`);② 生成的占位 key 未全部写入消息文件;③ 未感知 Taro hooks 应从 `@tarojs/taro` 导入。

**修复建议**(改造完成后按序执行):

1. `pnpm typecheck` 清零所有 TS 错误。
2. 用脚本核验全部 `t('ns.key')` 引用存在于 5 语言包(可复用本报告的审计脚本思路:`tmp/audit-i18n-keys.mjs`)。
3. 缺失 key 回填译文或调整代码引用。
4. 小程序端**改源码必重编译**(项目铁律),真机预览首页/课程详情/AI 对话等关键页回归。
5. 过 pre-commit 全部门禁后再提交。

---

## 三、P1/P2 — 风险与建议(3 项)

### P1-1 静态文件路由对 SVG/任意类型开放 CORS `*`(防御性,当前未激活)

**位置**:`apps/web/app/uploads/[[...path]]/route.ts`、`apps/web/app/cdn/[[...path]]/route.ts`(均为 2026-08-27~28 新增/修改)

**证据**:两个路由对命中文件统一返回 `Access-Control-Allow-Origin: *` + 按扩展名返回 MIME(含 `image/svg+xml`)。

**现状**:`apps/api/uploads/public/` 与 `deploy/server-root/` 当前 **0 个 SVG**、0 个 html,故存储型 XSS 面**未激活**;路径穿越防护经验证**有效**(逐段拒绝 `''`/`..`/`/`/`\` 开头 + resolve 后严格前缀校验,Windows 分隔符场景已覆盖)。

**风险**:若未来允许上传 SVG(或 json/csv/zip 等),同源 top-level 加载 SVG 可执行内嵌脚本(读同源 Cookie/调同源 API);`*` 使任意站点可读取上传目录内文件。

**建议**(低优先级):对非公开静态资源收紧 CORS(去 `*` 或仅开放图片类型);若必须支持 SVG 上传,用 `Content-Disposition: attachment` 或转 PNG 落库。

### P1-2 登录限流 dev/prod 差异(有意为之,提示风险)

**位置**:`apps/api/src/routes/auth.ts:597`(2026-08-28 修改)

**证据**:`rateLimit: NODE_ENV !== 'production' ? { max: 200, timeWindow: '1 minute' } : { max: 5, timeWindow: '1 minute' }`。

**判断**:注释明确为 E2E 623 用例并发登录导致 dev 429 而放宽,账号锁定机制(recordLoginFailure/getLockRemainingMs)独立生效可兜底爆破,非缺陷。但注意:**dev 模式下 200 次/分钟对公网可达的 dev 实例偏松**,若 dev 暴露公网(如隧道)存在爆破面。

### P2-1 改造验收清单(沉淀为团队约定)

miniapp-taro i18n 改造(或任何批量 codemod)完成前必须满足:

- [ ] `pnpm typecheck` 全仓 0 错误(连续 2 次输出一致,排除写盘竞态)
- [ ] i18n key 全覆盖审计(5 语言无缺失)
- [ ] 小程序编译通过(改源码必重编译)
- [ ] 真机/模拟器回归:首页 AI 对话、课程详情、订单、支付、会员中心
- [ ] pre-commit 全部门禁绿(含 5 个全量守门:rounded-full/rounded-overflow/tailwind-conflict/native-title-tooltip/no-divider)

---

## 四、已验证无问题的区域(深查证据,避免重复排查)

| 模块                             | 审计结论           | 关键证据                                                                                                                                                                                                                                            |
| -------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 积分系统(apps/api)               | ✅ 无超扣/丢失更新 | `adjustPoints` 原子 UPDATE + spend 带 `WHERE points >= amount` 余额校验 + 事务包裹流水(DB 级串行,防 lost update);`ensureUserPoints` 并发插入冲突回退查询                                                                                            |
| 支付幂等                         | ✅ 无重复扣款面    | Redis SET NX 锁 + **fail-closed**(Redis 不可用不放行并发)+ processing 锁 10min 短 TTL(防异常后永久锁死回调)+ completed 24h 缓存                                                                                                                     |
| llm_gateway 流式                 | ✅ 无连接泄漏      | `async for` + `try/finally` 显式 `aclose()` 兜底 `close()`(客户端断连时 GeneratorExit 也执行 finally);api_key 错误信息脱敏;usage 缺失时 token_counter 估算兜底                                                                                      |
| WebSocket 全家(ws-ai 等 11 插件) | ✅ 无连接泄漏      | 每用户连接数上限(16)+ 超限 close(4005)+ close handler 清理 + heartbeat 定时器 clearInterval                                                                                                                                                         |
| Web 轮询组件                     | ✅ 无定时器泄漏    | use-ai-helpers 轮询 ref + unmount cleanup;ChatWindow 轮询 `return () => clearInterval(timer)` + 消息 id 去重防重复                                                                                                                                  |
| 鉴权/越权                        | ✅ 未发现 IDOR     | 全仓扫描 `request.body/query.userId` 仅 interactions.ts follow/status(目标用户 ID 读操作,带 UUID 正则校验);其余均用 token 内 `request.userId`                                                                                                       |
| 上传路由路径穿越                 | ✅ 防护有效        | 逐段校验 + resolve 后前缀校验,`..`/绝对段/含分隔符段全拒                                                                                                                                                                                            |
| 静态守门(6 项)                   | ✅ 全绿            | api-key-leak 0 泄露;i18n-keys 1290 文件/13443 键/5 语言 parity OK;db-schema-drift 651 TS 表 vs 652 migration 0 缺失;sanitizer-bypass 通过;safeParse 3867 路由/2658 处调用 0 silent-ignore;api-routes 4404 后端路由 vs 1507 前端调用全对应(2 处豁免) |
| 类型检查(其余 7 端)              | ✅ 全绿            | api/web/mobile-rn/desktop/extension/cli + 全部 packages 均 0 错误                                                                                                                                                                                   |

---

## 五、结论

**当前仓库唯一需要立刻处理的问题是 miniapp-taro 的 i18n 改造并发写盘 + 未完成状态**(P0-1/P0-2)。这是"进行中的工作"而非"已上线的缺陷",但**处于随时可被错误提交的险境**:255 个未提交文件 + typecheck 红灯,一旦带病提交,小程序端将出现大面积白屏与裸 key 文案。

其余端与核心业务模块经深度审计未发现新的实质缺陷——工程在积分/支付/流式/WS/安全等高风险维度均有规范实现与守门覆盖。

**下一步(按序执行)**:

1. 终止/等待改造进程,同仓不并行会话;
2. 改造收敛后跑 P2-1 验收清单;
3. 提交后小程序重编译 + 真机回归。

---

## 六、修复执行结果(2026-08-29 01:20~01:40,全部完成)

改造进程于 01:12 前后自行收敛(近 2 分钟无 src 写入、tsc 输出连续两次一致),执行修复如下:

### 已修复:代码级误伤(2 处,codemod 破坏功能)

| 位置                                       | 原缺陷                                                                                                                                                               | 修复方式                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/constants/remote-icons.ts`            | 10 个**图片路径**被替换为 `bspappUrl(t('constantsRemoteicons.qX'))`(原路径如 `user/删除.png`、`tabbar/coursePlanet/微信图片_20250419152536.png` 丢失,图标将加载失败) | `git checkout` 还原为 HEAD(路径常量无需 i18n)                                                      |
| `src/platform/pay.ts`                      | **模板字符串插值被破坏**:`` `支付宝支付待确认(${resultCode})` `` 被改成 `` `支付宝支付待确{t('platformPay.p2')}{resultCode})` ``(用户将看到字面量 `{t(...)}`)        | `git checkout` 还原                                                                                |
| `src/stores/tests/storage-adapter.test.ts` | 测试桩文案被 i18n 化(测试不需要 i18n)                                                                                                                                | `git checkout` 还原                                                                                |
| `src/utils/miniapp-login.ts:84`            | 模板字符串 `用{t('utilsMiniapplogin.p1')}` 插值破坏                                                                                                                  | Edit 修复为 `t(...) + t('utilsMiniapplogin.p1')`(新增 `utilsMiniapplogin.alipayUser`='支付宝' key) |

### 已修复:i18n key 缺失(77 个,5 语言全量回填)

- 从 `git show HEAD:file` 逐文件提取**权威中文原文**(音色名/部门名/赛道关键词/错误消息/弹窗文案等,已人工核对数组位置错配);
- 回填 `packages/i18n/messages/miniapp-taro/{zh-CN,en,ja,ko,zh-TW}.json` 各 +77 key;
- 校验:`t('ns.key')` 引用 1443 处,**5 语言缺失 0**;JSON 全部合法;`check:i18n-keys` 守门仍绿(1290 文件/13443 键/parity OK)。

### 验证结果(全部通过)

| 验证项                                                | 结果                                      |
| ----------------------------------------------------- | ----------------------------------------- |
| `apps/miniapp-taro` tsc --noEmit                      | ✅ 0 错误(连续两次输出一致)               |
| 全仓 `typecheck:full`(24 包 TS + e2e + mypy 322 文件) | ✅ 全部通过                               |
| i18n key 全覆盖审计                                   | ✅ 0 缺失                                 |
| `check:i18n-keys` 守门                                | ✅ 通过                                   |
| `taro build --type weapp` 编译                        | ✅ 成功(built in 1m32s,产物 dist/ 已忽略) |

### 遗留(非缺陷,供决策)

- 工作区仍含 296 个未提交改动(改造主体 255 + 既有改动 + 本次修复),**pre-commit 门禁全绿后即可提交**(提交前建议过 `check:all` + 5 个 UI 守门);
- 真机/模拟器回归(首页 AI 对话、课程详情、订单、支付、会员中心)建议在提交后执行一次;
- P1-1 SVG/CORS、P1-2 dev 限流两项为防御性/有意配置,无需处理。

_执行:WorkBuddy · 2026-08-29 01:40_

_报告生成:WorkBuddy · 2026-08-29 · 证据全部本机实测(tsc/守门脚本/进程与文件写入时间戳/git diff)_
