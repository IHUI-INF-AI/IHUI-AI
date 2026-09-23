<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Admin 特权判定与能力映射(O13b · 2026-09-21)

> 范围:`apps/api` 服务端特权判定。本文只写代码里**真实存在**的东西;不存在的一律标
> "待补"。守门:`scripts/check-admin-gate-consistency.mjs`(guardian-runner id **53**,
> 当前 **warn** 级)。机器凭据防提权的测试证据:`apps/api/tests/auth-open-capability-parity.test.ts`
> 的 `O13b 机器凭据提权闸` 段 + `apps/api/tests/require-permission.test.ts`。

## 1. 现状盘点(2026-09-21 全量扫描,可复算)

扫描口径:`grep -rEn "roleId\s*(>=|<=|===|!==|>|<)\s*[0-9]" apps/api/src`(排除 `__tests__`);
封装类按符号出现统计。

| 形态 | 数量 | 说明 |
| --- | --- | --- |
| 裸 roleId 数值比较(`>= 1` / `> 0` / `=== 1` / `< 1` …) | **75 行 / 35 文件**(集中封装 require-permission.ts 1 行 + 存量 74 行 / 34 文件全部登记进守门白名单) | 守门代码行口径(剔注释)为 37 处;白名单按 grep 基线登记,上限只减不增 |
| `requireAdmin`(plugins/require-permission.ts 集中定义)使用面 | **694 处 / 201 文件**(绝大多数是 admin 路由文件 import + `addHook('preHandler', requireAdmin)`) | 集中封装,合法形态 |
| 本地重定义 `requireAdmin`(boolean 版) | **2 处**:`routes/earnings-routes.ts:137`、`routes/security.ts:74` | 同一语义两套判定,守门 RULE-2 存量豁免、禁止回升 |
| `requirePermission` / `requireAnyPermission` 引用 | 9 文件(rbac/edu 等细粒度面) | 走 RBAC 表 |
| `ADMIN_ROLE_ID` 常量比较(`roleId < ADMIN_ROLE_ID` 等) | 99 处 | 主要分布在各文件 import 该常量的等价判定;`routes/admin.ts:124` 的**统一 preHandler**(authenticate + requireActiveUser + roleId 闸门)是 admin/* 族真正的挂载点 |
| 判定来源 `request.jwtPayload?.roleId` | 102 处 / 39 文件 | **API Key 请求没有 jwtPayload** —— authenticate 机器分支刻意不写该字段,读它的判定时 `?? 0` 兜底 ⇒ 机器凭据恒不达标 |
| 判定来源 `request.user?.roleId` | **0 处**(apps/api 不存在 `request.user` 特权读取;请求身份 decorator 集合 = `userId` / `jwtPayload` / `apiKey` / `internalUserRoleId` / `openCapability` / `capability`) | internal-service-token 链路的 `internalUserRoleId`(plugins/internal-service-token.ts:89)是**另一类内部凭据**,非 API Key |
| 端外(web/desktop/cli/miniapp) | `apps/web` HasPermi.tsx / admin layout / Sidebar、`apps/cli` login.ts、`packages/database/seed/*` | 纯客户端展示判定 / seed 数据,不构成服务端特权面,不在守门范围 |

## 2. 机器凭据提权面自证(测试结论,非注释宣称)

`apps/api/tests/auth-open-capability-parity.test.ts`(19 用例全绿,2026-09-21 实测):

1. **B.1** `authenticate()` open-capability 分支:返回 payload `roleId === 0`,且该路径
   **不读归属人角色**(verifyAccessToken / getUserStatus 均未被调用)⇒ "归属人
   roleId >= 1"在代码路径上无法传播;`request.jwtPayload` 保持 undefined。
2. **B.2a** `requireAdmin` + 能力标记的 API Key(归属人为管理员)⇒ **403**(实测拒绝,
   不是 200 —— **无真实提权缺陷**,require-permission.ts 未做修改)。
   **B.2b** 纯 API Key 打 admin 端点(无标记、无 JWT,真实形态)⇒ **401**。
   **B.2c** `requireAnyPermission` 机器分支不走管理员通配,落到
   `checkAnyPermission('admin-owner', [...])` 的 RBAC 归属人校验(RBAC 拒绝 ⇒ 403)。
3. **B.3** `requireCapability('publish:operate')`(platform 域)运行期 **403 +
   `M2M_FORBIDDEN`**(isM2MAllowed,capability-catalog.ts:1124)。既有引用:
   `open-capability-registry.test.ts:82`(登记表无 platform/不可开放 scope)、
   `:88`(编译期字面量联合护栏 `@ts-expect-error publish:operate`)。

三道闸叠加:**类型层**(platform scope 不属 `OpenableCapabilityScope` 联合)→
**登记层**(registry 拒收)→ **运行层**(`isM2MAllowed` ⇒ 403)。

## 3. Admin 端点 → 能力/权限映射表

| Admin 面(真实存在) | 现判定形态 | 应映射 | 机器凭据为何不该有 |
| --- | --- | --- | --- |
| `routes/admin.ts` 挂载的 `/admin/*` 全族(统一 preHandler:roleId>=1) | 集中闸门 | **无 capability**(平台内部面;catalog 中 `publish:operate`、`ops:execute` 均 dataClass=platform) | 属主改不了的角色体系:API Key 归属人即使是管理员,roleId 恒 0(B.1) |
| `routes/admin/relay-*`(频道/密钥池/计费等运维,约 30+ 文件 requireAdmin) | requireAdmin | 待补(若将来开放,须新立非 platform scope + RBAC 权限点,而非 roleId 通道) | relay 密钥池含上游厂商凭据,机器自举=凭据套娃 |
| `rbac.ts` 角色权限管理 | `requirePermission('rbac:manage')` | RBAC 权限点 `rbac:manage`(非 platform) | 改权限体系本身必须人持凭证(2FA/审计面) |
| `edu-ai-management.ts` / `admin-auth-edu-routes.ts` | roleId 混判 + requireAdmin | catalog 已登记 `edu:read` / `edu:write`(domain=platform,归属人链路走 internal-service-token,**不走 API Key**) | 学生数据属主是租户,机器凭据无 user-scoped 语义 |
| 资金面 `finance.ts` / `withdrawal-routes.ts` / `admin-saas-quota.ts` | 裸 roleId<1 + requireAdmin | 待补(收敛到 requirePermission + 金额双人确认流) | 资金写操作对齐 §5 测试隔离与审计链要求,不接受无人归属调用 |
| `earnings-routes.ts` / `security.ts` 本地 boolean 版 requireAdmin | 重复实现 | 迁移到集中封装后删除(守门 RULE-2 白名单只减不增) | 两套判定=审计盲区 |

## 4. 守门:check-admin-gate-consistency.mjs

- **拦什么**:集中封装之外新增文件的裸 roleId 数值比较;白名单文件比较条数**增长**;
  集中封装之外新定义本地 `requireAdmin`;catalog 中 dataClass=platform 条目误标
  `thirdPartyEligible: true`。`--staged` 只判暂存区文件(pre-commit 模式)。
- **放过什么**:白名单内存量条数(34 文件 / 74 处 grep 基线,收敛一个删一个);
  注释行与字符串模板外形态;`internalUserRoleId` 链路(internal-service-token 属另一
  凭据体系,不在本守门判据内,收敛另案);web/cli 端客户端展示判定。
- **局限(如实声明)**:计数是行级文本判据,不做 AST —— `1 <= user.roleId` 反转写法、
  动态属性名(`obj['roleId'] >= 1`)与跨行表达式判不到;platform scope 清单复用
  `check-capability-catalog.mjs` 的 `parseCatalogEntries`(同一手写解析器,漂移由
  scripts/tests 第 8 用例哨兵兜底)。

## 5. O13b 收敛清单(距"机械可证清零"还差什么)

1. 34 个白名单文件逐个迁移到 `requirePermission(...)`/`requireAdmin` 或新立 RBAC
   权限点,每迁一个删除对应白名单条目(守门保证不回涨)。
2. 删除 2 处本地 boolean 版 `requireAdmin`(RULE-2 白名单清零)。
3. `internalUserRoleId`(X-Internal-Service-Token 链路)与 `jwtPayload.roleId` 双通道
   判定并入同一封装函数,补对应提权测试(现 parity 套件只覆盖 API Key 通道)。
4. 守门 id 53 观察一轮后升 blocking;届时 admin/* 统一 preHandler(`routes/admin.ts`)
   改为从 `plugins/require-permission.ts` re-export,消灭 ADMIN_ROLE_ID 的第二处定义点。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
