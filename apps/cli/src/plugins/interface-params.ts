// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件接口声明的**参数映射与危险档判据**(2026-11-13 自 `interface-tools.ts` 拆出)。
 *
 * 拆因:AGENTS §3 每页 <250 行 —— 编译层把"声明形状校验 + 参数映射 + 危险档 + 接入诊断"
 * 全挤在一档时已 460 行。按「加面先拆档」的纪律,参数映射这一整块(纯函数、零状态、
 * 与编译流程无耦合)先搬出来。判据一条没动,只换了住处。
 *
 * 本档只回答两个问题,且都**只回答一次**(§0.6):
 *   ① 清单里写的参数声明,能不能映射成 `RouteParamSpec`?(形态坏 ⇒ null,由调用方判拒收)
 *   ② 这条声明的危险档是什么?(method 推导 ∧ 清单自述,取更严的一侧)
 *
 * 刻意**不含**的东西:拒收码、诊断产出、工具名规则、编辑期校验 —— 那些住编译层。
 * 这样"参数怎么映射"与"什么算合法声明"可以各自单独被测试与复用。
 */

import type { RouteParamSpec } from '../tools/route-tools.js';

/** 清单里一条参数声明(与 `RouteParamSpec` 同形,但**全部字段可选** —— 清单是数据,不是代码)。 */
export interface DeclaredParam {
  name?: unknown;
  type?: unknown;
  description?: unknown;
  required?: unknown;
  enum?: unknown;
  items?: unknown;
  properties?: unknown;
}

/** 声明的 HTTP 方法词表(与 `RouteToolSpec` 的 `HttpMethod` 逐字一致)。 */
export const DECLARED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type DeclaredMethod = (typeof DECLARED_METHODS)[number];

/** 危险档(DELETE 恒最严;清单只能往上抬,不能往下压)。 */
export function accessOfMethod(method: DeclaredMethod): 'read' | 'write' | 'dangerous' {
  if (method === 'GET') return 'read';
  if (method === 'DELETE') return 'dangerous';
  return 'write';
}

/**
 * 取更严的那一档。顺序 read < write < dangerous。
 *
 * 这是"清单自述不得放宽"的唯一实现:声明值与 method 推导值取 max。
 * (例:POST 端点声明 `access:'read'` ⇒ 结果仍是 `write`。)
 */
export function stricterAccess(
  a: 'read' | 'write' | 'dangerous',
  b: 'read' | 'write' | 'dangerous',
): 'read' | 'write' | 'dangerous' {
  const rank = { read: 0, write: 1, dangerous: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

/** 清单里写的 access 是否可采信(不可信就只用 method 推导值,不猜用户的意图)。 */
export function declaredAccessOf(value: unknown): 'read' | 'write' | 'dangerous' | null {
  return value === 'read' || value === 'write' || value === 'dangerous' ? value : null;
}

/**
 * 把清单里的参数声明收窄成 `RouteParamSpec`;形态坏返回 null(由调用方判 `params-invalid`)。
 *
 * 失效方向:一切"搬不过去"的形态都返回 null 而不是降级 —— 把 `array` 降级成"元素无约束"、
 * 把 `properties` 丢掉,等于让模型传任意结构也照样通过校验(§b76-14 的反例)。
 */
export function toRouteParam(raw: DeclaredParam): RouteParamSpec | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name === '') return null;
  const type = raw.type;
  if (type !== 'string' && type !== 'number' && type !== 'boolean' && type !== 'array' && type !== 'object') {
    return null;
  }
  const spec: RouteParamSpec = {
    name,
    type,
    // 描述缺席时给一句客观说明:模型据此仍能判断"这个是干什么的",而不是看到空白。
    description:
      typeof raw.description === 'string' && raw.description.trim() !== '' ? raw.description : `${name}(${type})`,
  };
  if (raw.required === true) spec.required = true;
  if (Array.isArray(raw.enum)) {
    const values = raw.enum.filter((v): v is string => typeof v === 'string');
    if (values.length > 0) spec.enum = values;
  }
  if (raw.items && typeof raw.items === 'object' && !Array.isArray(raw.items)) {
    const item = toRouteParam(raw.items as DeclaredParam);
    // 元素 schema 搬不过去时**整条参数拒收**(不降级成 any[])
    if (item === null) return null;
    spec.items = item;
  }
  if (raw.properties && typeof raw.properties === 'object' && !Array.isArray(raw.properties)) {
    const props: Record<string, RouteParamSpec> = {};
    for (const [key, value] of Object.entries(raw.properties as Record<string, unknown>)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const sub = toRouteParam({ ...(value as DeclaredParam), name: key });
      if (sub === null) return null;
      props[key] = sub;
    }
    if (Object.keys(props).length > 0) spec.properties = props;
  }
  return spec;
}

/** 参数列表解析:非数组 ⇒ 空(用户没声明参数);数组里任一形态坏 ⇒ null(整条声明拒收)。 */
export function toRouteParams(raw: unknown): RouteParamSpec[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: RouteParamSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const spec = toRouteParam(item as DeclaredParam);
    if (spec === null) return null;
    out.push(spec);
  }
  return out;
}

/**
 * 从 path 里抽路径参数占位 —— **两种形态都认**:
 *   `:id`      —— 仓库既有路由工具族(`route-tools.ts`)的写法,也是 `RouteToolSpec` 的惯例;
 *   `{id}`     —— OpenAPI / FastAPI 的写法,插件作者从 ai-service 或 Swagger 抄过来时最常见。
 *
 * 为什么必须两种都认(2026-11-13 实测发现):原实现只认 `:id`,于是把
 * `path: "/api/crm/contacts/{id}"` 声明进清单时,`{id}` 不被识别成路径参数 ⇒
 * **不进 `required`、不进 schema**,模型看 schema 不知道要传 id,调用时 `{id}` 也原样留在 URL 上
 * —— 得到一个语义不明的 404。这不是"少个便利功能",是把一条声明静默编译成了错的工具。
 */
export function pathParamNamesOf(path: string): string[] {
  const out: string[] = [];
  // 用 Set 去重但保插入序:同一路径里 `:id/.../{id}` 混写时只补一枚参数
  const seen = new Set<string>();
  const push = (name: string): void => {
    if (name === '' || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  };
  // 两种形态一起扫,按出现顺序交错收集 —— 混写时参数顺序才与阅读顺序一致
  const re = /:([A-Za-z0-9_]+)|\{([A-Za-z0-9_]+)\}/g;
  for (const m of path.matchAll(re)) {
    const name = m[1] ?? m[2];
    if (name !== undefined) push(name);
  }
  return out;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
