// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 敏感数据脱敏 — 防止 API key / token / 密码泄露到 LLM 或审计日志。
 *
 * 灵感来源:参考行业 Agent 框架的 secrets sanitizer 设计(10 类正则 + RegexSet 预过滤 + URL query + 用户路径)。
 * 策略(参考行业 Agent 框架实践):
 *   - 10 类正则匹配常见敏感模式:OpenAI/Anthropic/StepFun/Agnes key、Bearer token、password/api_key 赋值、
 *     AWS access key、Authorization Basic、GitHub token、GitLab/Slack vendor token、Google API key、
 *     PEM 私钥、JWT
 *   - URL query 参数脱敏:`?access_token=xxx` / `?api_key=xxx` 等 12 类敏感参数
 *   - 用户路径脱敏:绝对路径中的 $HOME / username → ~ / <user>
 *   - 替换为 ***REDACTED***,保留前 4 字符便于定位
 *   - 不依赖外部库,纯字符串处理
 */

import * as os from 'node:os';

// ===================== 1. 10 类敏感正则模式 =====================

const SENSITIVE_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // 1. OpenAI / Anthropic / StepFun / Agnes API key: sk-xxx (20+ 字符)
  { pattern: /\b(sk-[A-Za-z0-9_\-]{8})[A-Za-z0-9_\-]{12,}\b/g, replacement: '$1***REDACTED***' },
  // 2. Bearer token: Bearer xxx
  { pattern: /(Bearer\s+[A-Za-z0-9_\-\.]{4})[A-Za-z0-9_\-\.]{8,}/gi, replacement: '$1***REDACTED***' },
  // 3. password=xxx / password: xxx / "password":"xxx"
  { pattern: /(password\s*[:=]\s*"?)([^\s"',]{2})[^\s"',]{4,}/gi, replacement: '$1$2***REDACTED***' },
  // 4. api_key=xxx / api_key: xxx(与 password 阈值一致:前缀 2 字符 + 后缀至少 4 字符)
  { pattern: /(api[_-]?key\s*[:=]\s*"?)([A-Za-z0-9_\-]{2})[A-Za-z0-9_\-]{4,}/gi, replacement: '$1$2***REDACTED***' },
  // 5. AWS access key: AKIA... / ASIA... (前缀 4 + 16 位)
  { pattern: /\b((?:AKIA|ASIA)[A-Z0-9]{4})[A-Z0-9]{12,}\b/g, replacement: '$1***REDACTED***' },
  // 6. Authorization: Basic xxx
  { pattern: /(Authorization\s*:\s*Basic\s+)[A-Za-z0-9+/=]{8,}/gi, replacement: '$1***REDACTED***' },
  // 7. GitHub Token: ghp_/gho_/ghu_/ghs_/ghr_/github_pat_
  { pattern: /\b((?:gh[opusr]_|github_pat_)[A-Za-z0-9_]{4})[A-Za-z0-9_]{16,}\b/g, replacement: '$1***REDACTED***' },
  // 8. Vendor Token: GitLab glpat- / Slack xox[abp]- / Slack xapp-
  { pattern: /\b((?:glpat-|xox[abp]-|xapp-)[A-Za-z0-9\-]{4})[A-Za-z0-9\-]{6,}\b/g, replacement: '$1***REDACTED***' },
  // 9. Google API Key: AIza + 35 字符
  { pattern: /\b(AIza[A-Za-z0-9_\-]{4})[A-Za-z0-9_\-]{31,}\b/g, replacement: '$1***REDACTED***' },
  // 10. JWT: eyJ{8+}.{8+}.{8+} (保留 header+payload 前 4 字符可见)
  { pattern: /\b(eyJ[A-Za-z0-9_\-]{4})[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\b/g, replacement: '$1***REDACTED***.***REDACTED***.***REDACTED***' },
  // 11. PEM 私钥: -----BEGIN [RSA |EC |OPENSSH |]PRIVATE KEY----- ... -----END ... (多行匹配)
  { pattern: /(-{5}BEGIN[A-Z ]*PRIVATE KEY-{5}[\s\S]{0,4096}?-{5}END[A-Z ]*PRIVATE KEY-{5})/g, replacement: '***REDACTED-PRIVATE-KEY***' },
];

// ===================== 2. URL query 敏感参数脱敏 =====================

/** 敏感 query 参数名(大小写不敏感) */
const SENSITIVE_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'access_token', 'api_key', 'apikey', 'auth', 'authorization',
  'code', 'password', 'passwd', 'refresh_token', 'secret',
  'token', 'client_secret', 'private_key',
]);

/** 将 URL 中敏感 query 参数的 value 脱敏 */
export function redactUrl(input: string): string {
  // 匹配完整 URL(http/https/ftp/file)+ query 部分,大小写不敏感
  return input.replace(/((?:https?|ftp|file):\/\/[^\s"'<>#?]*\?)([^\s"'<>#]*)/gi, (_m, prefix: string, query: string) => {
    if (!query) return prefix;
    // 逐个 & 分隔的 k=v 重写
    const parts = query.split('&').map((kv) => {
      const eq = kv.indexOf('=');
      if (eq === -1) return kv;
      const key = kv.slice(0, eq);
      const keyLower = decodeURIComponent(key).toLowerCase();
      if (SENSITIVE_QUERY_PARAMS.has(keyLower)) {
        return `${key}=***REDACTED***`;
      }
      return kv;
    });
    return prefix + parts.join('&');
  });
}

// ===================== 3. 用户路径脱敏 =====================

let homeCache: string | null | undefined;
let userCache: string | null | undefined;

/** 获取 $HOME(优先缓存,避免重复系统调用) */
function getHome(): string | null {
  if (homeCache !== undefined) return homeCache;
  try {
    homeCache = os.homedir() || null;
  } catch {
    homeCache = null;
  }
  return homeCache;
}

/** 获取当前用户名(优先缓存) */
function getUser(): string | null {
  if (userCache !== undefined) return userCache;
  try {
    const info = os.userInfo();
    userCache = info.username || null;
  } catch {
    userCache = null;
  }
  return userCache;
}

/**
 * 脱敏用户绝对路径中的 home / username。
 * - $HOME → ~(POSIX 风格)/ ~ (Windows C:\Users\<name> → ~)
 * - username → <user>
 * 参考行业 Agent 框架的 redact_user_paths 设计。
 */
export function redactUserPaths(input: string): string {
  let result = input;
  const home = getHome();
  if (home && home.length > 3) {
    // 大小写不敏感匹配(Windows 路径大小写不敏感)
    const homeRe = new RegExp(escapeRegExp(home), 'gi');
    result = result.replace(homeRe, '~');
  }
  const user = getUser();
  if (user && user.length > 1) {
    // 仅在路径上下文中替换(避免误伤普通单词)— 前后是 / 或 \ 或 Users/
    const userRe = new RegExp(`((?:[/\\\\]Users[/\\\\])|(/home/))${escapeRegExp(user)}`, 'gi');
    result = result.replace(userRe, '$1<user>');
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===================== 4. 顶层脱敏函数 =====================

/** 完整脱敏:10 类正则 + URL query + 用户路径 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let result = text;
  // 1) 先脱敏 URL query(避免后续正则破坏 URL 结构)
  result = redactUrl(result);
  // 2) 10 类正则
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    // 重置 lastIndex(防止 g flag 在多次调用间累积)
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  // 3) 用户路径
  result = redactUserPaths(result);
  return result;
}

/** 递归脱敏对象的所有字符串字段(深度优先) */
export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = redactSecrets(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string' ? redactSecrets(item)
          : (item && typeof item === 'object' ? redactObject(item as Record<string, unknown>) : item),
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ===================== 5. 键名档 + 大文本档深脱敏(G-701) =====================

/**
 * G-701:未登记工具的入参在 REPL `/tool` 回看与 TUI 卡片上是"逐键打印"的,
 * 而上面 `redactObject` 只递归套**值形状**规则 —— 形状不像凭据的明文凭据
 * (典型:`{"api_key": "abc"}`,值是普通串、键名才是凭据语义)整类失明。
 * 键名档与形状档是**并集不是替换**:`redactObject` 的行为一字未动(它有自己的既有用例),
 * 新出口在其形状匹配之上叠两档:
 *   ① 键名档 —— 键名命中封闭词根集 ⇒ 整个值替换为 `[redacted]`(不再看值形状);
 *   ② 大文本档 —— `content`/`old_string`/`new_string` 这类写文件/编辑入参只印 `[N chars]`,
 *      回看只需认出"是哪一次调用",整段正文既无用又可能内嵌凭据。
 * 参考上游 zcode `app-tool-transcript.ts` 的 `SENSITIVE_KEY_PATTERN` + `LARGE_TEXT_KEYS` 设计。
 */

/**
 * 键名档敏感词根(封闭常量:不得在别处再抄一份判据,新增词根须回到本票验收口径)。
 * 语义逐词根:token(含 accessToken/refresh_token)、secret、password、api_key/apiKey/api-key、
 * authorization、credential、cookie。大小写不敏感;无 g 旗标,`test` 无 lastIndex 累积问题。
 */
const SENSITIVE_KEY_PATTERN = /token|secret|password|api[_-]?key|authorization|credential|cookie/i;

/** 大文本档键名(封闭集合,精确匹配,不做模糊包含 —— 误把普通串压成字符数比漏印更难排查) */
const LARGE_TEXT_KEYS: ReadonlySet<string> = new Set(['content', 'old_string', 'new_string']);

/** 键名档命中后的占位值(与形状档的 `***REDACTED***` 刻意不同形:一眼可辨是"键名整值遮蔽") */
const KEYED_REDACTED_PLACEHOLDER = '[redacted]';

/** 递归单元:按 (键名, 值) 决定遮蔽形态;键名档优先,其后并集走形状档与大文本档 */
function redactValueKeyed(key: string, value: unknown): unknown {
  // ① 键名档:键名带凭据语义 ⇒ 整值遮蔽。值为嵌套对象/数组时同样遮蔽为字符串占位,
  //    不得继续序列化 —— 否则原始键名与值会随结构原样回到回看输出里。
  if (SENSITIVE_KEY_PATTERN.test(key)) return KEYED_REDACTED_PLACEHOLDER;
  if (typeof value === 'string') {
    // ② 大文本档:只印字符数(非字符串值的 content 不在此档,继续按形状档/递归处理)
    if (LARGE_TEXT_KEYS.has(key)) return `[${value.length} chars]`;
    // ③ 形状档(并集的下半):与 redactObject 同一份 10 类正则 + URL query + 用户路径出口
    return redactSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'string'
        ? redactSecrets(item)
        : item && typeof item === 'object' && !Array.isArray(item)
          ? redactObjectDeepKeyed(item as Record<string, unknown>)
          : item,
    );
  }
  if (value && typeof value === 'object') {
    return redactObjectDeepKeyed(value as Record<string, unknown>);
  }
  return value;
}

/**
 * 递归深脱敏(键名档 ∪ 形状档 ∪ 大文本档)。
 * 与 `redactObject` 的区别只在上半:多出键名档与大文本档;非敏感键的字符串值仍走同一
 * `redactSecrets` 出口,普通无凭据对象逐字不变(防止把可读回看输出打废)。
 */
export function redactObjectDeepKeyed(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = redactValueKeyed(key, value);
  }
  return result;
}

// ===================== 6. 仅用于测试的辅助 =====================

/** 重置 home/user 缓存(仅测试用) */
export function _resetPathCachesForTest(): void {
  homeCache = undefined;
  userCache = undefined;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
