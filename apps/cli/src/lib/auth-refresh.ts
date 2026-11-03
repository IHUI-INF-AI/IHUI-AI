// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Auth Refresh — CLI 侧凭据续期的**唯一单点**(2026-10-26 立)。
 *
 * 立票事实:access token 只有 15 分钟,而 CLI 此前只向 `@ihui/api-client` 注册了
 * `getToken`,且拿的是**进程启动时**解析出的凭据快照。包内 401 拦截器
 * `refreshAccessTokenOnce()` 的第一行就是 `if (!tokenProvider.refreshAccessToken) return null`
 * ⇒ 长会话跑到 15 分钟后每个请求 401,且结构上不可能自愈(表现为"CLI 用一会儿就全失败")。
 *
 * 本模块把两件事各收成一份判据,站点只许调用、不许再抄:
 *
 *  ① `registerCliTokenProvider` —— 全部注册点(`index.ts` / `commands/agent.ts` /
 *     `commands/chat-subcommands.ts` / `acp/server.ts` / `server/agent-core.ts` /
 *     `tools/subagent.ts`)共用同一份 provider 形状:
 *     `getToken` 现读令牌管理器(不再吃启动快照)+
 *     `refreshAccessToken` 接 `token-manager.ensureFreshAccessToken`。
 *
 *  ② `fetchWithCliAuthRefresh` —— 三条自带 fetch 的腿(`commands/http-utils.ts` /
 *     `commands/developer.ts` / `cloud-run.ts`)共用的 401 出口:
 *     401 ⇒ 续期一次、带新 token 重放**恰好一次**。语义与包内 `fetchWithAuthRefresh`
 *     逐条对齐;那个出口是包内私有(未从 `src/index.ts` re-export),而本票不许改
 *     `packages/**`,故在 CLI 侧写这一份最小的。**"什么算 401" 在 CLI 侧只有
 *     `isUnauthorized` 这一处实现**;续期动作复用包内同一枚 `refreshAccessTokenOnce`
 *     (单飞 + 失败冷却 + CAS 都在它里面,这里不复制第二套编排)。
 *
 * 红线:
 *  - 续期失败/无 refresh 凭据 ⇒ 交回**原 401 响应**由调用方报错,绝不返回空数据冒充成功;
 *  - refresh token 明文不得进日志/错误信息/上报体(文案只出 `missingTokenHint` 那一句)。
 */

import {
  getToken as getProviderToken,
  refreshAccessTokenOnce,
  setTokenProvider,
  type TokenProvider,
} from '@ihui/api-client';
import {
  ensureFreshAccessToken,
  getAccessTokenSync,
  missingTokenHint,
} from '../commands/token-manager.js';
import { isMachineCredential } from '../config/credentials.js';

export interface CliTokenProviderSpec {
  /** apps/api 基址:令牌管理器拿它 POST /api/auth/refresh */
  baseUrl: string;
  /**
   * 调用方在启动时解析出的凭据快照(`--api-key` / `IHUI_API_KEY` / `settings.apiKey`
   * 三者按此优先级合并的结果)。它是**判定输入**,不是取值来源 —— 见 `ownsRotation`。
   */
  startupToken?: string | null;
}

/**
 * 「这次续期归不归令牌管理器管」——**在构造时刻判一次**,不做两次。
 *
 * 判两次就会在续期前后给出相反答案(续期之后文件值已经变了),而答案不一致就等于
 * 一会儿换凭据、一会儿不换。取值口径:
 *  - 机器凭据(`ihui_` 前缀)没有 exp/refresh 语义,且文件里的人 JWT 不得挤掉它
 *    ⇒ 与 `token-manager` 的 O12 同一条判据,原样使用、不参与续期;
 *  - 启动快照与文件里的凭据**逐字不同** ⇒ 它来自 `--api-key` / 环境变量这类覆盖源,
 *    文件不是它的真相源 ⇒ 粘住快照(拿文件里那枚去顶掉它 = 换身份重试,越权方向),
 *    也不参与续期;
 *  - 其余情形(快照 == 文件值,或压根没有快照)⇒ 文件就是人凭据的真相源:每次现读,
 *    `ihui login` 之后与续期之后的新 token 立刻生效 —— 这正是"启动快照"那一型的修法。
 */
function ownsSettingsCredential(startupToken: string | null, settingsTokenAtStartup: string | null): boolean {
  if (isMachineCredential(startupToken) || isMachineCredential(settingsTokenAtStartup)) return false;
  if (startupToken !== null && startupToken !== settingsTokenAtStartup) return false;
  return true;
}

/** 由 `CliTokenProviderSpec` 造出 provider(导出供测试做形状锁)。 */
export function createCliTokenProvider(spec: CliTokenProviderSpec): TokenProvider {
  const startupToken = spec.startupToken?.trim() || null;
  const settingsTokenAtStartup = getAccessTokenSync() ?? null;
  const ownsRotation = ownsSettingsCredential(startupToken, settingsTokenAtStartup);

  return {
    getToken(): string | null {
      // 每次现读:续期把新 token 落进 settings.json 后,这一枚必须立刻是新的
      const live = getAccessTokenSync() ?? null;
      return ownsRotation ? (live ?? startupToken) : (startupToken ?? live);
    },
    async refreshAccessToken(): Promise<string | null> {
      if (!ownsRotation) return null;
      const before = getAccessTokenSync() ?? null;
      const next = await ensureFreshAccessToken(spec.baseUrl);
      // 契约翻译:`ensureFreshAccessToken` 的对外契约是"失败时原样交回旧 token,
      // 让上游 API 去报 401";provider 的契约**相反** —— 失败必须给 null。
      // 把"没换到新凭据"读成"续期成功",拦截器就会拿一枚刚被服务端拒过的凭据再重放一次。
      if (!next || next === before) return null;
      return next;
    },
  };
}

/** 注册 CLI 的 token provider(六个注册点的唯一出口)。 */
export function registerCliTokenProvider(spec: CliTokenProviderSpec): void {
  setTokenProvider(createCliTokenProvider(spec));
}

/** 「这个响应是不是未授权」——CLI 侧唯一一份判据;各条腿不得再自己写 `status === 401`。 */
export function isUnauthorized(response: { status: number }): boolean {
  return response.status === 401;
}

/**
 * 401 走到终局(续期没成 / 重放仍被拒)时该喊的那句话。
 * 文案复用 `token-manager.missingTokenHint` 这一既有出口(它会按台账里的原因码
 * 分档:该重登 / 该重试 / 被取消),这里只剥掉给人看时重复的前导 `✗`(调用方自己会带符号)。
 */
export function unauthorizedMessage(baseUrl: string): string {
  return missingTokenHint(baseUrl).replace(/^✗\s*/, '');
}

/** 把 fetch 的三种 headers 形态收敛成一份**新** Record(绝不原地改调用方对象)。 */
function copyHeaderRecord(headers: RequestInit['headers']): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const [key, value] of headers as [string, string][]) out[key] = value;
    return out;
  }
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return { ...(headers as Record<string, string>) };
}

/** 调用方是否**自己写了** Authorization(大小写不敏感)。 */
function hasOwnAuthorization(headers: RequestInit['headers']): boolean {
  return Object.keys(copyHeaderRecord(headers)).some((k) => k.toLowerCase() === 'authorization');
}

/**
 * 装配 Bearer(不原地改调用方 headers)。不变量与包内同名出口一致:
 * **没有 token ⇒ 一个 Authorization 头都不加** —— 绝不塞空 `Bearer `。
 */
function withBearerHeader(headers: RequestInit['headers'], token: string | null): Record<string, string> {
  const out = copyHeaderRecord(headers);
  if (token) out.Authorization = `Bearer ${token}`;
  return out;
}

/**
 * 这份 body 能不能再发一次。不可重放(`ReadableStream` / AsyncIterable 这类一次性介质)
 * ⇒ 既不续期也不重放:重放出去的是空 body,服务端照单收下回 200,那就成了
 * "重发空 body 的假成功",比不修更坏。CLI 三条腿发的都是 JSON 字符串,这一格是护栏。
 */
function isReplayableBody(body: BodyInit | null | undefined): boolean {
  if (body === null || body === undefined) return true;
  if (typeof body === 'string') return true;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true;
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body)) return true;
  return false;
}

export interface CliAuthFetchOptions {
  /**
   * 本趟要用的 access token。
   *  - 缺省 ⇒ 问 provider(`getProviderToken()`,即"当前"凭据);
   *  - 显式给值 ⇒ 用这一份;401 续期成功后的**重放**恒用刷新回来的新 token,不用这里的旧值。
   *
   * 开这个口子而不是让调用方自己写 `headers.Authorization`:写进 headers 的凭据不归本出口
   * 装配,续期回来的新 token 与它不同源,拿它顶掉别人的凭据去重放等于换身份重试。
   */
  accessToken?: string | null;
}

/**
 * CLI 裸 fetch 腿的 401 续期出口(与包内 `fetchWithAuthRefresh` 同一条契约,判序只此一份):
 *  - `status !== 401` ⇒ 原对象逐字返回(响应体不消费,调用方继续读);
 *  - `status === 401` ⇒ `refreshAccessTokenOnce()`(包内单飞 + 冷却 + CAS)
 *    → 拿到新 token 就带新 token **重放恰好一次**;
 *  - 续期返回 null ⇒ 把**原 401 响应**交回调用方,由它按既有语义报错(不静默、不空数据);
 *  - 重放后仍是 401 ⇒ 就地交回,不再续期、不再重放(绝不循环);
 *  - body 不可重放 / 调用方自带 Authorization ⇒ 不续期不重放(那一格的凭据不归本出口管)。
 *
 * @returns 与 `fetch` 同样的 `Response`(失败也返回响应,不抛;抛错语义留给调用方那一条腿)
 */
export async function fetchWithCliAuthRefresh(
  url: string,
  init: RequestInit = {},
  options: CliAuthFetchOptions = {},
): Promise<Response> {
  const ownsAuth = hasOwnAuthorization(init.headers);
  const token = options.accessToken === undefined ? getProviderToken() : options.accessToken;
  const first = await fetch(url, {
    ...init,
    headers: ownsAuth ? copyHeaderRecord(init.headers) : withBearerHeader(init.headers, token),
  });
  if (!isUnauthorized(first)) return first;
  if (!isReplayableBody(init.body)) return first;
  if (ownsAuth) return first;
  const refreshed = await refreshAccessTokenOnce();
  if (!refreshed) return first;
  // 只重放这一次:第二次仍 401 也照样交回(循环重放 = 凭据死循环)
  return fetch(url, { ...init, headers: withBearerHeader(init.headers, refreshed) });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
