// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 插件「接口型工具」层 —— 让清单以**纯数据声明**自己的可调用接口(2026-11-13 立)。
 *
 * 缺口(本票的因,已实测):
 *   此前 `plugin.json` 只有 `tools?: string[]`,它只能**引用宿主已有的工具名**
 *   (`declaration-consumers.ts` 的对账文案原话:"the plugin provides no implementation of its own")。
 *   于是"插件体系"与"整个项目所有接口都能被 AI 无缝调用"这两件事是断开的两条线:
 *   插件装得再多,也贡献不出一个模型真能调的新工具。
 *
 * 本层补的就是这一格,并且**不越既有红线**:
 *   - 装载器仍然**绝不 import 插件代码**(`plugin-entry-channel-lock.test.ts` 的 ②③ 两条形状锁
 *     逐字钉着 loader/manifest-scan 里没有 dynamic import / require / vm / child_process)。
 *     所以接口声明是**数据**:`{ name, method, path, describe, params… }`,不是回调、不是脚本。
 *   - 执行体只有一条腿:`invokeApi`(与 `api-bridge` / HR 工具族**同一个** `fetchApi` 通道),
 *     鉴权是"当前登录会话 + 目标端点自己的 RBAC" —— 桥层不复制任何权限判据,也就不产生第二份真相。
 *   - 危险级别由 **method 决定**,不由清单自述决定:GET→read、POST/PUT/PATCH→write、DELETE→dangerous。
 *     清单写 `access: 'read'` 也只会在更严的一侧生效(`stricterAccess`);放宽永远不被接受。
 *
 * 与 `tools[]` 的分工(两者并存,不是替代):
 *   - `tools: ["read_file"]`      = 我要**涉及/挂钩**宿主已有的这枚工具(hook matcher 可寻址它);
 *   - `interfaces: [{…}]`        = 我要**贡献**一枚新工具,模型可以直接调用它。
 *   对账层(`declaration-consumers.ts`)据此把 `interfaces` 认成有消费者的声明,不再误报
 *   "no-host-implementation"。
 *
 * **为什么只支持 HTTP 端点、不做"本地工具"(2026-11-13 研判结论,已固化)**:
 *   查过四条可能的设计出路,结论是**不做**,理由是每一条都会突破本仓已锁定的红线:
 *     ① 清单里写脚本/命令(`exec`/`script`/`command`/`shell`/`bin`/`main`/`run`/`eval`/`spawn`)
 *        —— `packages/types/src/capability-extensions.ts` 的 `FORBIDDEN_EXECUTABLE_FIELDS`
 *        把这 11 个键在 manifest 的**任何层级**直接判非法;再加一条 `kind:'local'` + 命令字段
 *        就是给同一份清单开后门,与那条禁令自相矛盾。
 *     ② 装载器动态 `import()` 插件 JS —— `plugin-entry-channel-lock.test.ts` 的 ③ 逐字断言
 *        loader.ts / manifest-scan.ts 里没有 dynamic import / require / vm / child_process;
 *        这是**故意**的:clone 一个仓库就 RCE 是已处理过的整型风险(见 mcpTrustProjectServers
 *        的默认关)。放开它等于把那条默认关废掉。
 *     ③ 宿主内置一个"安全表达式求值器"给插件写逻辑 —— 相当于自造一门 DSL 再自证它安全;
 *        边界工作(DNS/文件/时间/随机)一个没堵就是新的逃逸面。收益(省一次 HTTP)远小于代价。
 *     ④ 让插件作者把本地能力包成 HTTP —— 那本来就是本层现在支持的东西,不需要新类型。
 *   **正确的出路(仓库里已存在,不需要本层再做)**:真需要本地能力(读写文件、跑命令、调本机
 *   服务)就让插件**自带一个 MCP server**,走 `apps/cli/src/tools/mcp-runtime.ts` +
 *   `loadMcpTools`(`settings.enableMcp`,另有 `toolHub.mcpAdapter` 走 hub 路径)。那条链早就
 *   解决了"外部实现 + 宿主包装 + 信任闸"三件事,并且有独立的信任模型
 *   (`mcpTrustProjectServers` 默认只信用户全局层)。插件再实现一套本地执行 = 第二份信任模型,
 *   必然与它漂移(§0.6)。
 *   ⇒ 所以 `interfaces[]` 只收 `method`+`path` 形态:本层的能力边界就是"把后端接口变成工具",
 *     不试图成为"插件运行时"。这个取舍写在这里,是为了让后来者**不必重新推导一遍**。
 *
 * 工具名纪律:
 *   - 强制前缀 `plugin__<namespace>__`,与 MCP 的 `mcp__<server>__<tool>` 同族 —— 一旦撞名,
 *     人一眼看得出是谁贡献的,`--disallowed-tools` 也能按来源表达。
 *   - 名字段只允许 `[a-z0-9_]`,其余字符一律拒绝(不是静默替换:静默替换会让两份清单撞名)。
 *   - 与宿主在册工具同名 ⇒ **拒收并点名**,绝不覆盖(`registerTools` 的跨归属冲突规则同向)。
 */

import type { Tool, ToolParameter } from '../tools/index.js';
import { createRouteTool, type RouteParamSpec, type RouteToolSpec } from '../tools/route-tools.js';
import { ROUTING_IDENTITY_KEYS } from '@ihui/types';
import { diagnostic } from './manifest-scan.js';
import {
  DECLARED_METHODS,
  accessOfMethod,
  declaredAccessOf,
  pathParamNamesOf,
  stricterAccess,
  toRouteParams,
  type DeclaredMethod,
} from './interface-params.js';
import type { PluginDiagnostic } from './types.js';

/**
 * 参数映射与危险档判据住在 `interface-params.ts`(2026-11-13 按 AGENTS §3 拆档):
 * 这里是编译流程(名字/方法/路径的合法性 + 拒收码 + 工具产出),那边是纯映射规则。
 * 两边不是第二份实现 —— 本档只 import 那边的函数,不复制任何一行判据。
 */
export type { DeclaredParam } from './interface-params.js';

/**
 * 编译产物的类型别名 —— **插件层内部**用的那一份 `Tool`。
 *
 * 为什么不各处直接 `import type { Tool } from '../tools/index.js'`:插件层有一条既有的形状锁
 * (`plugin-entry-channel-lock.test.ts`)钉着"插件层不硬耦合宿主工具表",那条纪律是对的 ——
 * 装载器不该知道工具表长什么样。类型从本模块转出,消费方(`loader.ts` / `multi-version.ts`)
 * 就只依赖插件层自己的契约面。
 */
export type CompiledInterfaceTool = Tool;

/** 接口型工具名统一前缀(与 `mcp__<server>__` 同族,便于按来源表达 allow/deny)。 */
export const PLUGIN_INTERFACE_PREFIX = 'plugin__';

/** 名字段允许字符:小写字母 / 数字 / 下划线(大写会在规范化时被拒,不做大小写折叠)。 */
const NAME_SEGMENT_RE = /^[a-z][a-z0-9_]{0,63}$/;

/** 清单里一条接口声明(全部字段按 unknown 收,再由本层校验 —— 不信任磁盘字节)。 */
export interface DeclaredInterface {
  name?: unknown;
  method?: unknown;
  path?: unknown;
  description?: unknown;
  /** `read` / `write` / `dangerous`;缺席或写错 ⇒ 按 method 推导(只会更严,不会更松) */
  access?: unknown;
  params?: unknown;
  pathParams?: unknown;
}

/** 单条声明的裁决结果:`tool` 有值即已编译成可调用工具;`reason` 有值即拒收原因。 */
export interface InterfaceCompileOutcome {
  /** 原始声明名(清单里怎么写就怎么回,便于用户对着自己的文件改) */
  declared: string;
  /** 编译成功的工具 */
  tool?: Tool;
  /** 拒收原因(ASCII:要进日志,不得被控制台码页吃掉) */
  reason?: string;
  /** 拒收的稳定判别码(测试与上层按码分档,不读散文) */
  code?: InterfaceRejectCode;
}

/**
 * 拒收判别码(封闭集)。
 *
 * 逐条对应一种"这条声明不可能变成真工具"的情形 —— 把它们分开编码,是为了让日志与测试
 * 都能按码分档,而不是靠读 `reason` 的散文猜。
 */
export const INTERFACE_REJECT_CODES = [
  /** 声明不是普通对象(数组 / 字符串 / null) */
  'not-an-object',
  /** `name` 缺失 / 非字符串 / 不符合 `[a-z][a-z0-9_]*` */
  'name-invalid',
  /** `method` 不在词表内 */
  'method-invalid',
  /** `path` 缺失 / 不以 `/` 开头 / 含空白 / 含 `..` */
  'path-invalid',
  /** 参数声明形态坏(非数组 / 单项不是对象 / 参数名非法) */
  'params-invalid',
  /** 参数名撞上路由身份键(模型可填他人会话 = 越权,不是校验问题) */
  'param-routing-identity',
  /** 与宿主在册工具同名,或与本次另一份清单贡献的工具同名 */
  'name-conflict',
] as const;

export type InterfaceRejectCode = (typeof INTERFACE_REJECT_CODES)[number];

export function compileDeclaredInterface(raw: unknown, takenNames: ReadonlySet<string>): InterfaceCompileOutcome {
  const declared = raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as DeclaredInterface).name === 'string'
    ? String((raw as DeclaredInterface).name)
    : '(unnamed)';

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { declared, code: 'not-an-object', reason: 'interface declaration must be a plain object' };
  }
  const decl = raw as DeclaredInterface;

  // ① 名字:强制 `plugin__<ns>__<tool>` 三段形态。清单可只写 `<ns>__<tool>`,
  //    也可以写全 `plugin__<ns>__<tool>`(幂等,便于用户对照日志里的真实工具名)。
  const rawName = typeof decl.name === 'string' ? decl.name.trim().replace(/^plugin__/, '') : '';
  const segments = rawName.split('__');
  if (segments.length !== 2) {
    return {
      declared,
      code: 'name-invalid',
      reason: `name must be "<namespace>__<tool>" (or "plugin__<namespace>__<tool>"); got "${declared}"`,
    };
  }
  const [namespace, toolSegment] = segments as [string, string];
  if (!NAME_SEGMENT_RE.test(namespace) || !NAME_SEGMENT_RE.test(toolSegment)) {
    return {
      declared,
      code: 'name-invalid',
      reason: 'namespace and tool must match [a-z][a-z0-9_]{0,63} (lowercase; no dots, dashes or spaces)',
    };
  }
  const fullName = `${PLUGIN_INTERFACE_PREFIX}${namespace}__${toolSegment}`;
  if (takenNames.has(fullName)) {
    return {
      declared,
      code: 'name-conflict',
      reason: `tool "${fullName}" is already registered by another owner; rename it or drop the declaration`,
    };
  }

  // ② 方法:必须在词表内。大小写不折叠 —— `get` 与 `GET` 是两个不同输入,折叠等于替用户猜。
  const method = decl.method;
  if (typeof method !== 'string' || !(DECLARED_METHODS as readonly string[]).includes(method)) {
    return {
      declared,
      code: 'method-invalid',
      reason: `method must be one of ${DECLARED_METHODS.join('/')} (uppercase); got ${JSON.stringify(method)}`,
    };
  }

  // ③ 路径:完整路径(含 /api 等前缀),不得含空白或 `..`(白空格会被 URL 规范化吃掉,`..` 可越出挂载点)。
  const path = typeof decl.path === 'string' ? decl.path.trim() : '';
  if (!path.startsWith('/') || /\s/.test(path) || path.includes('..')) {
    return {
      declared,
      code: 'path-invalid',
      reason: 'path must start with "/" and must not contain whitespace or ".." (use the full path with its /api prefix)',
    };
  }

  // ④ 参数:形态坏一律整条拒收(降级成"无参数"= 让模型猜字段名,比不装更误导)。
  const params = toRouteParams(decl.params);
  if (params === null) {
    return { declared, code: 'params-invalid', reason: 'params must be an array of {name, type, description, required?, enum?, items?, properties?}' };
  }

  // ⑤ 路由身份键:模型可填 = 越权(与 `ROUTING_IDENTITY_KEYS` 同源判据,不另抄名单)。
  const identityKeys = new Set<string>(ROUTING_IDENTITY_KEYS);
  for (const p of params) {
    if (identityKeys.has(p.name)) {
      return {
        declared,
        code: 'param-routing-identity',
        reason: `param "${p.name}" is a routing-identity key: the host binds it, the model must not fill it`,
      };
    }
  }

  // ⑥ 路径参数:path 里的 `:x` 由本层自动补成必填 string 参数(用户不必手写,也不会漏写)。
  const declaredPathParams = toRouteParams(decl.pathParams);
  if (declaredPathParams === null) {
    return { declared, code: 'params-invalid', reason: 'pathParams must be an array of param declarations' };
  }
  const declaredPathNames = new Set(declaredPathParams.map((p) => p.name));
  const pathParams: RouteParamSpec[] = [];
  for (const name of pathParamNamesOf(path)) {
    if (identityKeys.has(name)) {
      return {
        declared,
        code: 'param-routing-identity',
        reason: `path param ":${name}" is a routing-identity key: the host binds it, the model must not fill it`,
      };
    }
    const explicit = declaredPathParams.find((p) => p.name === name);
    pathParams.push(explicit ?? { name, type: 'string', description: `${name} 路径参数` });
    declaredPathNames.delete(name);
  }
  if (declaredPathNames.size > 0) {
    // 声明了 path 里不存在的路径参数:不静默丢弃(那会让模型传一个被忽略的字段)。
    return {
      declared,
      code: 'params-invalid',
      reason: `pathParams declares ${[...declaredPathNames].join('/')} but the path has no such placeholder`,
    };
  }

  // ⑦ 危险档:method 推导值与清单自述取更严的一侧(清单只能抬档,不能降档)。
  const access = stricterAccess(accessOfMethod(method as DeclaredMethod), declaredAccessOf(decl.access) ?? 'read');

  const describe =
    typeof decl.description === 'string' && decl.description.trim() !== ''
      ? decl.description.trim()
      : `${method} ${path}`;

  const spec: RouteToolSpec = {
    name: fullName,
    description: describe,
    method: method as DeclaredMethod,
    path,
    ...(pathParams.length > 0 ? { pathParams } : {}),
    ...(params.length > 0 ? { params } : {}),
    access,
  };

  const tool = createRouteTool(spec);
  // 归属标记:与宿主内建工具(`'builtin'`)区分开,`registerTools` 的跨归属同名判据据此报冲突。
  // 归属名取 `plugin:<namespace>` 而不是插件名:同 namespace 的多份清单重连刷新时允许覆盖,
  // 跨 namespace 一律拒绝后到者(与 MCP 的 `mcp:<server>` 同一取向)。
  return { declared, tool: { ...tool, registrationOwner: `plugin:${namespace}` } };
}

/**
 * 批量编译一份清单的 `interfaces`。
 *
 * 顺序敏感:`takenNames` 随编译推进而增长,所以第二份清单贡献同名工具时会在**第二份**被拒
 * (谁先谁后由装载顺序决定 —— 这里不假装有仲裁,与 G-684「扫描顺序不是任何人声明过的意图」
 * 相反取向的正当理由:载体是**同名工具**而非同名插件,而 registerTools 本来就有确定的
 * "保留先到者"规则;本层只是把这条规则提前到编译期并报出来)。
 */
export function compileDeclaredInterfaces(
  raw: unknown,
  takenNames: ReadonlySet<string>,
): { outcomes: InterfaceCompileOutcome[]; tools: Tool[]; taken: string[] } {
  if (raw === undefined) return { outcomes: [], tools: [], taken: [] };
  if (!Array.isArray(raw)) {
    return {
      outcomes: [{ declared: '(interfaces)', code: 'not-an-object', reason: '"interfaces" must be an array of interface declarations' }],
      tools: [],
      taken: [],
    };
  }
  const live = new Set(takenNames);
  const outcomes: InterfaceCompileOutcome[] = [];
  const tools: Tool[] = [];
  const taken: string[] = [];
  for (const item of raw) {
    const outcome = compileDeclaredInterface(item, live);
    outcomes.push(outcome);
    if (outcome.tool) {
      tools.push(outcome.tool);
      live.add(outcome.tool.name);
      taken.push(outcome.tool.name);
    }
  }
  return { outcomes, tools, taken };
}

/** 把编译结果摊成参数表(导出给对账层,免得那边再抄一次取值方式)。 */
export function interfaceToolNames(tools: readonly Tool[]): string[] {
  return tools.map((t) => t.name);
}

/** 供测试与对账层用的参数键集(不含路由身份键;若含,说明上游校验漏了)。 */
export function parameterKeysOf(tool: Tool): string[] {
  return Object.keys(tool.parameters as Record<string, ToolParameter>);
}

/**
 * 装载侧接线:编译一份清单的 `interfaces`,并把拒收项摊成诊断。
 *
 * 为什么这一个函数住在编译层而不是装载器:装载器是 249 行的紧凑档(AGENTS §3),给它加 20 行
 * 接线就把它推过档;而"拒收怎么变成诊断"本来就是编译判据的一部分(判别码 → 文案 → 严重级),
 * 摆在判据旁边才不会被抄第二份。
 *
 * `diagnostic` 由编译层自己 import:**不会**造成循环 —— `manifest-scan.ts` 不 import 本模块。
 */
export function compilePluginInterfaces(
  declarations: readonly unknown[] | undefined,
  file: string,
  pluginName: string,
  takenNames: ReadonlySet<string>,
): { tools: CompiledInterfaceTool[]; outcomes: InterfaceCompileOutcome[]; diagnostics: PluginDiagnostic[] } {
  const compiled = compileDeclaredInterfaces(declarations, takenNames);
  const diagnostics: PluginDiagnostic[] = [];
  for (const outcome of compiled.outcomes) {
    if (!outcome.reason) continue;
    diagnostics.push(
      diagnostic(
        'plugin-interface-rejected',
        file,
        `Interface "${outcome.declared}" was rejected [${outcome.code ?? 'unknown'}]: ${outcome.reason}`,
        { pluginName },
      ),
    );
  }
  return { tools: compiled.tools, outcomes: compiled.outcomes, diagnostics };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
