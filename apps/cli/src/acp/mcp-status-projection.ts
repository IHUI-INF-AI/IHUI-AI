// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP server 运行态状态归一化投影 — J3(逆向-复现-超越 WorkBuddy agent-harness)。
 *
 * 逆向来源(WorkBuddy @genie/agent-harness lib/mcp-server/status-projection.js + schemas.js):
 *   projectMcpServerStatus 把 raw status 投影成面向 UI 的归一化状态机:
 *     starting → runtimeStatus:"starting"(尚未决定,不臆断)
 *     available → runtimeStatus:"connected"
 *     其他 + authStatus==="notLoggedIn" → "authenticationRequired"(需用户登录,可行动)
 *     其余 → "failed"
 *   并投影 authStatus / tools(name→projectMcpServerTool)。
 *   三枚举实测:
 *     authStatus ∈ {unknown,unsupported,notLoggedIn,bearerToken,oAuth}
 *     startup    ∈ {starting,ready,failed,cancelled}
 *     connection ∈ {notStarted,starting,connected,authenticationRequired,failed,cancelled,disabled}
 *   边界常量: MCP_SERVER_MAX_TOOLS=2048 / MAX_NAME_CHARS=512 / MAX_ERROR_CHARS=4096。
 *
 * IHUI 差距:mcp-runtime.ts 的 getStatus() 只回原始探测布尔(alive/dead/connected),
 *   无归一化状态机 —— UI 无法区分「需用户行动」(authenticationRequired)与「真的挂了」(failed)。
 *
 * 复现(IHUI):把上述状态机落成纯投影层(不碰文件系统/网络),输入 IHUI getStatus() 快照
 *   + 可选 auth 探测,输出归一化 runtimeStatus / authStatus / actionRequired。
 *
 * 超越(对照 WorkBuddy 缺口):
 *   - WorkBuddy 投影不含「下一步该做什么」;我们补 actionRequired 指令,调用方可直接引导用户。
 *   - 增量状态可解释:携带 consecutiveFailures 透传,而非只给最终布尔。
 */

/** 归一化运行态(对齐 WorkBuddy connection 枚举子集,IHUI 语义) */
export type McpRuntimeStatus =
  | 'starting'
  | 'connected'
  | 'authenticationRequired'
  | 'failed';

/** 认证态(对齐 WorkBuddy authStatus 枚举) */
export type McpAuthStatus =
  | 'unknown'
  | 'unsupported'
  | 'notLoggedIn'
  | 'bearerToken'
  | 'oAuth';

/** 下一步行动指令(超越项:WorkBuddy 未投影) */
export type McpActionRequired =
  | 'none'
  | 'loginRequired'
  | 'checkConfig'
  | 'retryLater';

/** 投影输入:IHUI getStatus() 快照 + 可选认证探测 */
export interface McpStatusInput {
  /** getStatus() 回的 liveness 布尔 */
  alive: boolean;
  dead: boolean;
  connected: boolean;
  consecutiveFailures: number;
  /** 认证探测(可缺省 → 'unknown') */
  authStatus?: McpAuthStatus;
}

/** 投影输出:归一化状态机 + 行动指令 */
export interface McpStatusProjection {
  serverName: string;
  runtimeStatus: McpRuntimeStatus;
  authStatus: McpAuthStatus;
  /** 需用户行动(超越项) */
  actionRequired: McpActionRequired;
  /** 失败累计(透传,可解释) */
  consecutiveFailures: number;
  /** 面向日志/调试的中文一句话(不直接展示给终端用户) */
  detail: string;
}

/** 认证探测缺失时的默认值(不臆断成"已登录") */
const DEFAULT_AUTH: McpAuthStatus = 'unknown';

/**
 * MCP server 运行态状态投影(WorkBuddy projectMcpServerStatus 的 IHUI 复现)。
 *
 * 状态机(与 WorkBuddy 对齐):
 *   dead(被标记死) → failed
 *   !alive(未活) → starting(仍在退避重连,不臆断成失败)
 *   !connected(活但连接未建立) → starting
 *   connected ∧ authStatus==="notLoggedIn" → authenticationRequired(需用户登录)
 *   connected ∧ 其余 → connected
 *
 * 超越:补 actionRequired(actionRequired="loginRequired" 时引导 OAuth 登录、
 *   failed 且 consecutiveFailures 高时引导 checkConfig、starting 引导 retryLater)。
 */
export function projectMcpServerStatus(
  serverName: string,
  input: McpStatusInput,
): McpStatusProjection {
  const authStatus = input.authStatus ?? DEFAULT_AUTH;
  const { alive, dead, connected, consecutiveFailures } = input;

  let runtimeStatus: McpRuntimeStatus;
  let actionRequired: McpActionRequired;
  let detail: string;

  if (dead) {
    runtimeStatus = 'failed';
    actionRequired = 'checkConfig';
    detail = `server 已被标记 dead(consecutiveFailures=${consecutiveFailures}),建议检查配置`;
  } else if (!alive) {
    runtimeStatus = 'starting';
    actionRequired = 'retryLater';
    detail = `server 未活,正在退避重连(consecutiveFailures=${consecutiveFailures})`;
  } else if (!connected) {
    runtimeStatus = 'starting';
    actionRequired = 'retryLater';
    detail = '存活但连接未建立,等待连接完成';
  } else if (authStatus === 'notLoggedIn') {
    runtimeStatus = 'authenticationRequired';
    actionRequired = 'loginRequired';
    detail = '连接已建立但需要用户登录(OAuth)';
  } else {
    runtimeStatus = 'connected';
    actionRequired = 'none';
    detail = '已连接且可用';
  }

  return {
    serverName,
    runtimeStatus,
    authStatus,
    actionRequired,
    consecutiveFailures,
    detail,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
