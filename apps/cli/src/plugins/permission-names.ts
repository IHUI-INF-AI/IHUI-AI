// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 声明式权限名录入层 —— 对侧 33 条权限名的**归属表**(goal-b49/W6 立)。
 *
 * 取证锚点(现读一次,只取键名,未取任何对方源码正文):
 *   `G:/Qoder CN/resources/extensions/catalog.v1.json` → 10 枚插件的 `manifest.permissions`
 *   去重 = **33 条点分权限名**(与取证册 `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/`
 *   `Q1-qoder-cn-main-bundle.md` §3 #8 的计数一致)。对侧把它们**原样声明**给宿主,
 *   没有任何"这条权限能碰到哪一类数据"的运行期切分。
 *
 * 本层的职责边界(只有一件事,越界即返工):
 *   **名字 → 我方已登记 scope 的归属**。它**不判定**能不能拿到数据 —— 判定只有
 *   `capability-catalog.extensionDataClassGrant()` 一处(AGENTS §0.6 单一真相源;
 *   本票禁则「不得新增第二把权限判据尺」)。所以:
 *     - 有归属(scope 非 null):把点分名换成正牌 scope 后交给那把尺,结论由尺给;
 *     - 无归属(scope = null):名字**原样透传**给那把尺 ⇒ 目录里查无此 scope ⇒
 *       落进 `grant.unregistered` 并被逐条点名,数据类集合为空(**默认拒**)。
 *   两条路径共用同一把尺,本层永不产出 `allowed`。
 *
 * 为什么 11 条留 `null` 而不是"找个最像的塞进去":
 *   归属表一旦为了好看而映射,就等于**扩大授权面**(AGENTS §24 红线「不得伪装成修复」)。
 *   凭据读取(`auth.readUserToken`)、企业策略、网络代理配置、纯 UI reveal 在我方能力目录里
 *   没有对位条目 ⇒ 按默认拒处理,并把理由写在下面,交后手按真需求决定是否立 scope。
 *
 * 一格边界(免得被误读成"归属了就等于能对第三方开放"):本层只解决**数据类**这一维的前一跳。
 * 「机器凭据能不能碰该 scope」是能力目录的另一把闸(`isM2MAllowed`:platform 域 / 未登记 /
 * 非 thirdPartyEligible ⇒ 不放行),本席一行未动 —— 例如 `extensions.manage` 归到
 * `connectors:write`,而该 scope 正在"非第三方可申请"名单里,那道闸照旧生效。
 */

import { API_KEY_PERMISSION_SET, extensionDataClassGrant, type ExtensionDataClassGrant } from '@ihui/types';

/** 一条声明名的归属:正牌 scope 或 `null`(无对位条目 ⇒ 默认拒)。 */
export interface DeclaredPermissionTarget {
  readonly scope: string | null;
  readonly why: string;
}

/**
 * 33 条对侧声明名的归属表。键 = 对侧原样名(点分小写),值 = 我方归属。
 * 键集就是本层的词表面(穷尽性判据第一处键集,见 `tests/plugin-permission-names.test.ts`)。
 */
export const DECLARED_PERMISSION_NAMES = {
  'files.readSessionResource': { scope: 'files:read', why: '读会话内的文件资源 = 我方文件读面' },
  'files.readSessionArtifacts': { scope: 'files:read', why: '读会话产物文件,同一读面' },
  'files.writeSessionResource': { scope: 'files:write', why: '写会话资源 = 我方文件写面' },
  'files.stageLocal': { scope: 'files:write', why: '本地文件落盘/暂存属写面' },
  'chat.createSession': { scope: 'chat:write', why: '建会话是写操作' },
  'chat.continueSession': { scope: 'chat:write', why: '续写会话' },
  'chat.sendToSourceSession': { scope: 'chat:write', why: '向源会话投递消息' },
  'chat.attachAnnotation': { scope: 'chat:write', why: '给会话挂注解属写' },
  'chat.interruptTurn': { scope: 'chat:write', why: '打断轮次改变会话状态,归写面' },
  'chat.interactions': { scope: 'chat:write', why: '写入交互消息' },
  'chat.writeSessionPresentation': { scope: 'chat:write', why: '名带 write,写呈现态' },
  'chat.observeTurn': { scope: 'chat:read', why: '观察轮次进度 = 只读' },
  'chat.readTurnOutput': { scope: 'chat:read', why: '读轮次输出' },
  'chat.readSessionMetadata': { scope: 'chat:read', why: '读会话元数据' },
  'chat.readSessionResult': { scope: 'chat:read', why: '读会话结果' },
  'auth.readState': { scope: 'user:read', why: '读自身登录态 = 我方用户读面' },
  'extensions.read': { scope: 'connectors:read', why: '扩展/连接器目录的读面' },
  'extensions.manage': { scope: 'connectors:write', why: '安装/启停连接器属写面' },
  'mcp.registerInProcess': { scope: 'mcp:connect', why: '进程内注册 MCP 服务 = 连接面' },
  'workspace.read': { scope: 'workspace:read', why: '工作区读' },
  'workspace.readProjects': { scope: 'workspace:read', why: '列项目 = 工作区读' },
  'workspace.readSessionLocation': { scope: 'workspace:read', why: '读会话落点路径 = 工作区读' },
  'auth.readUserToken': { scope: null, why: '凭据读取不在我方能力面内(密钥不入能力目录),刻意不归属' },
  'telemetry.write': { scope: null, why: '无遥测写入 scope;stats:read 是聚合读,不构成对位' },
  'node.callService': { scope: null, why: '无「进程内服务直调」scope,归属会凭空造一条授权面' },
  'enterprisePolicy.read': { scope: null, why: '无企业策略 scope' },
  'configuration.write': { scope: null, why: '宿主设置归 apps/cli 本地存储,不在能力目录' },
  'workspace.writeIndexSetting': { scope: null, why: '我方只有 workspace:read,无写档' },
  'network.readProxy': { scope: null, why: '无网络/代理配置 scope' },
  'chat.revealSession': { scope: null, why: '纯 UI 聚焦动作,无数据面;映射会白给一个数据类' },
  'chat.revealLocalSession': { scope: null, why: '同上:本地会话聚焦,无数据面' },
  'session.provideResources': { scope: null, why: '对应贡献档 sessionResources 在本宿主 no-host,无落点可归属' },
  'chat.provideMentions': { scope: null, why: '对应贡献档 chatMentionProviders 在本宿主 no-host,无落点可归属' },
} as const satisfies Record<string, DeclaredPermissionTarget>;

/** 已登记的声明名(词表面;消费方与判据都从这里取,不再另抄名单)。 */
export const DECLARED_PERMISSION_NAME_LIST: readonly string[] = Object.keys(DECLARED_PERMISSION_NAMES);

/** 归属为「无对位条目」的声明名(默认拒那一族;逐条点名用,不代表本层下了拒判)。 */
export const UNMAPPED_PERMISSION_NAMES: readonly string[] = DECLARED_PERMISSION_NAME_LIST.filter(
  (name) => DECLARED_PERMISSION_NAMES[name as keyof typeof DECLARED_PERMISSION_NAMES].scope === null,
);

/**
 * 单个声明名 → 正牌 scope。
 * - 已是正牌 scope(`API_KEY_PERMISSION_SET` 在册)⇒ 原样返回(不查别名表,免得别名规则反噬正牌名);
 * - 在册别名 ⇒ 返回其归属 scope;
 * - 其余(含归属为 null 的 11 条)⇒ **原样透传**,由 `extensionDataClassGrant` 落 `unregistered`。
 *   透传不是"放行":这条路不给任何数据类,并且把名字喊出来(AGENTS §0.3)。
 */
export function resolveDeclaredPermissionName(name: string): string {
  if (API_KEY_PERMISSION_SET.has(name)) return name;
  const entry = (DECLARED_PERMISSION_NAMES as Record<string, DeclaredPermissionTarget | undefined>)[name];
  return entry && entry.scope !== null ? entry.scope : name;
}

/**
 * 清单里的 `permissions` 读成字符串数组 —— 权限维唯一的读取口径(贡献审计与激活审计共用一份,
 * 两处各写一个 filter 就是第二把尺的雏形,§0.6)。非数组 / 空串一律按"未声明"处理,由默认拒兜住。
 */
export function readPermissionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/** 批量归属(保序、不去重:去重会把"同一权限声明两次"这种形态抹平,那是静默的一种)。 */
export function resolveDeclaredPermissionNames(names: readonly string[]): string[] {
  return names.map(resolveDeclaredPermissionName);
}

/**
 * **本层唯一的取数出口**:先做名字归属,再交给能力目录那把尺判定。
 *
 * 装载器(contribution-audit / activation-events)都调这一个函数,不再各自直连
 * `extensionDataClassGrant` —— 那样等于两处各接一次口径,别名腿会被漏掉(§0.6 第二份必然漂移)。
 */
export function permissionGrantOf(permissions: readonly string[]): ExtensionDataClassGrant {
  return extensionDataClassGrant({ permissions: resolveDeclaredPermissionNames(permissions) });
}

/**
 * 清单级权限归一化(goal-b49/X2):把扩展 manifest 的 `permissions` 按**同一张归属表**
 * (`resolveDeclaredPermissionName`)换成正牌 scope,其余字段逐字原样。
 *
 * 纯函数:不改入参对象;非对象 / 无 `permissions` / 非数组 ⇒ **原对象原样返回** ——
 * 形态错由 `validateExtensionManifest` 自己报(invalid_type),本层不抢它的判据(§0.6)。
 * 数组里的非字符串项原样保留,不 filter:过滤会挪动下标,校验器点名的 `permissions[i]` 就错位了。
 */
export function normalizeExtensionManifestPermissions(manifest: unknown): unknown {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return manifest;
  const record = manifest as Record<string, unknown>;
  if (!Array.isArray(record.permissions)) return manifest;
  const list = record.permissions as unknown[];
  const permissions = list.map((p) => (typeof p === 'string' ? resolveDeclaredPermissionName(p) : p));
  return { ...record, permissions };
}

/**
 * 扩展安装校验器的结构契约 —— 与 `@ihui/types` 的 `validateExtensionManifest` 同形
 * (`apps/cli/src/skills/packaging/manifest-gate.ts` 的 `ExtensionManifestValidatorLike` 是它的一处消费)。
 * 本层不 import 该校验器(它住 packages/types,本票不动跨端面),只描述调用形状。
 * `manifest` 只在 `ok: true` 时有值,类型放宽到 unknown —— 本层不透解校验器的规范化结果。
 */
export interface ExtensionManifestValidatorContract {
  (
    raw: unknown,
    ctx: { isRegisteredScope(scope: string): boolean },
  ):
    | { ok: true; manifest?: unknown }
    | { ok: false; errors: { path: string; code: string; message: string }[] };
}

/**
 * 安装通道适配器:让它认点分声明名别名(goal-b49/X2 的「别名那一格」)。
 *
 * 事实(现读):`validateExtensionManifest` 只认 `API_KEY_PERMISSION_SET` 正牌 scope
 * (`!PERMISSION_SET.has(scope) || !ctx.isRegisteredScope(scope)` ⇒ `permission_not_registered`),
 * 而本仓的归属表 `DECLARED_PERMISSION_NAMES` 只被装载面(contribution/activation)消费 ——
 * 同一份权限名在**装载通道认别名、安装通道不认**,两处口径不一致(§0.6)。
 *
 * 适配器在**进校验器之前**做同一次归属(复用 `resolveDeclaredPermissionName`,零第二把尺):
 *   - 正牌 scope     ⇒ 原样(不走别名表,免得别名规则反噬);
 *   - 在册别名       ⇒ 换成正牌 scope 后通过;
 *   - 未知 / 归属 null ⇒ 原样透传 ⇒ 校验器照旧逐条报 `permission_not_registered`(fail-closed,不扩权)。
 *
 * 接线点是调用侧一行:`createExtensionManifestGate(createAliasAwareManifestValidator(validateExtensionManifest))`。
 * 该调用点住 `commands/skill-package.ts`(不在本票射程),故本票只交出口与用例,接线随票面交主席。
 */
export function createAliasAwareManifestValidator(
  validator: ExtensionManifestValidatorContract,
): ExtensionManifestValidatorContract {
  return (raw, ctx) => validator(normalizeExtensionManifestPermissions(raw), ctx);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
