// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Git 入参形状白名单 —— G-786 的**唯一判据实现**(cache.ts 与 marketplace.ts 共用这一份)。
 *
 * 关的是哪一格(实测可达路径):
 *   远端 marketplace manifest 里 `"url":"--upload-pack=…"` / `"url":"ext::sh -c …"` 会被
 *   `installer.ts` 原样递给 `cache.ts::performClone`,而旧实现在 argv 里**既没有 `--` 分隔、
 *   也没有前导横杠拒绝、更没有 scheme 校验** ⇒ 位置参数位上的串被 git 当**选项**解析;
 *   `ext::` 那一族在启用该 transport 的 git 构建下等于执行外部命令。
 *   症状没有编译期信号、typecheck/lint 全绿,只有真装一次才发现 —— 与守门 72/78 同族。
 *
 * 三条设计约束(不得"顺手"改掉):
 *   1. **判据只有一份**:两处消费面(marketplace 的形态守卫、cache 的 clone 咽喉点)都 import 本模块,
 *      不得在各自文件里再抄一遍正则/白名单 —— "两处算同一件事必漂移"是本仓记过最多次的失败型。
 *   2. **拒绝必须结构化**:每个拒绝都带稳定 `reasonCode` 与 `field`,调用方**不得靠错误文案**做流程
 *      判断(AGENTS §5"不依赖错误文本做流程判断"、守门 67/135 同一条禁令)。
 *   3. **判据与"本机 git 是否启用 ext::"无关**:要拒的是"前导 `-`"和"非白名单 scheme"这两个**形状**事实,
 *      不是"这台机的 git 会不会真去执行" —— 环境实测不构成放宽理由。
 *
 * 放行口径(默认最小):
 *   - `https://` —— 生产唯一默认放行档;
 *   - `http://`  —— **仅回环**(`localhost` / `127.0.0.1` / `::1` / `ip6-localhost`),且**仅在测试钩子在位时**
 *      (G-797 收紧:旧措辞"回环 http 放行(测试用)"过宽 —— 远端 manifest 写 `http://127.0.0.1:PORT/evil.git`
 *      就能让**受害者自己的 git** 去连本机任意服务(SSRF-into-git;本机常挂着 api / ai-service / dev server)。
 *      生产路径因此只允许 https 与结构解析通过的 ssh/scp-like;回环 http 的放行条件由调用方以
 *      `loopbackTestHook` 显式注入,缺省 = 不放行(**fail-closed**,新增调用点不会因为忘了传参而放宽)。
 *   - `ssh://` 与 scp-like `user@host:path` —— 按**结构**解析放行(不是按前缀猜),两段的字符集各自受审;
 *   - 其余一切(`git://` / `file://` / `ext::` / 裸路径 / 相对路径 / 空串)—— 拒。
 *
 * 另:被拒的值**不进 Error.message**(manifest 里的 URL 可能带 `https://user:token@host` 这类内嵌凭据,
 * 而 message 会被上层写进日志);结构化字段里只留 redact 后的短预览。
 */

/** 放行的 URL 形态(可用于诊断输出,不参与判红) */
export type GitUrlKind = 'https' | 'loopbackHttp' | 'sshUrl' | 'scpLike';

/** url 维度的稳定拒绝码 */
export type GitUrlRejectReason =
  | 'urlNotString'
  | 'urlEmpty'
  | 'urlLeadingDash'
  | 'urlWhitespace'
  | 'urlHostMissing'
  | 'urlSchemeUnsupported'
  | 'urlCredentialsInUrl'
  | 'urlLoopbackHttpNeedsTestHook'
  | 'urlMalformed';

/** ref 维度的稳定拒绝码 */
export type GitRefRejectReason = 'refNotString' | 'refLeadingDash' | 'refControlChar';

/** sha 维度的稳定拒绝码 */
export type GitShaRejectReason = 'shaNotString' | 'shaMalformed';

export type GitUrlVerdict =
  | { ok: true; kind: GitUrlKind; host: string }
  | { ok: false; reasonCode: GitUrlRejectReason; detail: string };

export type GitRefVerdict =
  | { ok: true; present: boolean }
  | { ok: false; reasonCode: GitRefRejectReason; detail: string };

export type GitShaVerdict =
  | { ok: true; present: boolean }
  | { ok: false; reasonCode: GitShaRejectReason; detail: string };

/** 任何 git 入参维度的拒绝码合集(供错误对象携带) */
export type GitInputRejectReason = GitUrlRejectReason | GitRefRejectReason | GitShaRejectReason;

/** 允许按结构解析放行的 scheme(URL 协议名,不含冒号) */
const ALLOWED_URL_SCHEMES: ReadonlyMap<string, 'https' | 'loopbackHttp' | 'sshUrl'> = new Map([
  ['https', 'https'],
  ['http', 'loopbackHttp'],
  ['ssh', 'sshUrl'],
]);

/** 回环主机名(http 只放这一小撮;用途是本地测试夹具,不是生产安装面) */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', 'ip6-localhost', '::1', '0:0:0:0:0:0:0:1']);

/** scp-like `user@host:path` —— 只捕获两段,路径/主机的字符集各自单独审(见下方 checks) */
const SCP_LIKE_RE = /^[A-Za-z0-9._+-]+@([A-Za-z0-9._-]+):(.+)$/;

/**
 * scp-like 的 path 段字符集:不允许空白、**不允许前导 `-`**(首字符类刻意不含 `-`,否则
 * `git@host:--upload-pack=…` 会作为"合法路径"通过 —— 判据写完必须拿它应当红的那一面喂一次)、
 * 不允许 `:`(那等于再套一层 transport 语法)。
 */
const SCP_PATH_RE = /^[A-Za-z0-9._~/][A-Za-z0-9._~@+/=-]*$/;

/** 合法 commit SHA:4–64 位十六进制(sha1 是 40、sha256 是 64,git 允许的缩写不短于 4) */
const SHA_RE = /^[0-9a-fA-F]{4,64}$/;

/**
 * 把任意值压成"可进诊断、不含凭据、不含控制字符"的短预览。
 * 为什么必须做:`https://user:token@host/x.git` 的 userinfo 段是凭据,而 detail 会随错误对象被上层打印。
 */
function previewOf(value: unknown): string {
  const raw = typeof value === 'string' ? value : String(value);
  const stripped = raw
    .replace(/\/\/[^/@\s]*@/, '//***@')
    .replace(/[\u0000-\u001f\u007f]/g, '?');
  return stripped.length > 80 ? `${stripped.slice(0, 80)}…` : stripped;
}

/** IPv6 主机在 URL 里带方括号(`[::1]`),比较回环前先剥掉 */
function stripIpv6Brackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function isLoopbackHost(host: string): boolean {
  if (LOOPBACK_HOSTS.has(host)) return true;
  // 127.0.0.0/8 整段都是回环,不只 127.0.0.1
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/**
 * 审 url 的形状。**纯函数、零副作用、不碰进程** —— 咽喉点 `performClone` 在任何派生之前调它。
 *
 * `loopbackTestHook`(G-797):回环 `http://` 只在调用方**显式声明**"此刻处于测试夹具环境"时放行。
 * 这个量刻意由调用方注入而不是在本函数里读 `process.env`:① 保持纯函数与可构造面证明(注入 false/true
 * 各一条用例就是判据的牙,不需要真去改环境);② 键名只有一个主人(`cache.ts` 那两个既有测试钩子),
 * 这里再读一遍就是第二份真相;③ 缺省不放行 —— 新增调用点忘了传参只会更严,不会更松。
 */
export function evaluateGitUrl(raw: unknown, opts: { loopbackTestHook?: boolean } = {}): GitUrlVerdict {
  if (typeof raw !== 'string') {
    return { ok: false, reasonCode: 'urlNotString', detail: previewOf(raw) };
  }
  if (raw.length === 0) {
    return { ok: false, reasonCode: 'urlEmpty', detail: '' };
  }
  // 位置参数位上的前导横杠 = git 选项注入。这一条必须在任何解析之前判:
  // 它和"是不是合法 URL"无关,`--upload-pack=/bin/sh` 拿去 new URL() 只会得到一个假"malformed"。
  if (raw.startsWith('-')) {
    return { ok: false, reasonCode: 'urlLeadingDash', detail: previewOf(raw) };
  }

  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch {
    parsed = null;
  }

  if (parsed !== null) {
    const protocol = parsed.protocol.replace(/:$/, '').toLowerCase();
    const kind = ALLOWED_URL_SCHEMES.get(protocol);
    if (kind === undefined) {
      // ext::sh -c … 走到这里(protocol='ext'),file://、git:// 同视。
      return { ok: false, reasonCode: 'urlSchemeUnsupported', detail: protocol || '(none)' };
    }
    const host = stripIpv6Brackets(parsed.hostname.toLowerCase());
    if (host.length === 0) {
      return { ok: false, reasonCode: 'urlHostMissing', detail: previewOf(raw) };
    }
    // 空白不进 argv 是无害的,但带空白的"URL"要么是伪造形态、要么是 ext:: 的残渣 —— 一律拒。
    if (/\s/.test(raw)) {
      return { ok: false, reasonCode: 'urlWhitespace', detail: previewOf(raw) };
    }
    /**
     * G-798:内嵌凭据的 userinfo 段一律不进这一档 URL。
     * 判据取的是" userinfo 存不存在",不是"看着像不像密钥":这一段会被原样递进 `git` 的 **argv**,
     * 而 argv 在 Windows 上可被任意进程枚举(WMI/命令行审计都能看到),
     * 于是"把 token 写在 URL 里"等于把凭据发给整台机的观察者。
     * `ssh://` 那一档**刻意只禁密码不禁用户名**:`ssh://git@host/…` 与 scp-like `git@host:path`
     * 里的 `git` 是登录名而不是凭据,禁掉就是把 SSH 通道整条封死(现仓既有测试正拿它当放行档)。
     */
    const hasUser = parsed.username.length > 0
    const hasPass = parsed.password.length > 0
    if ((kind === 'https' || kind === 'loopbackHttp') && (hasUser || hasPass)) {
      return {
        ok: false,
        reasonCode: 'urlCredentialsInUrl',
        detail: `${protocol}: userinfo(改用凭据助手 / credential helper,不要把口令写进 URL)`,
      }
    }
    if (kind === 'sshUrl' && hasPass) {
      return {
        ok: false,
        reasonCode: 'urlCredentialsInUrl',
        detail: 'ssh: userinfo 口令段(ssh 只提供登录名,口令请走密钥/agent)',
      }
    }
    if (kind === 'loopbackHttp' && !isLoopbackHost(host)) {
      return { ok: false, reasonCode: 'urlSchemeUnsupported', detail: `http:${previewOf(host)}` };
    }
    if (kind === 'loopbackHttp' && opts.loopbackTestHook !== true) {
      // G-797:回环不等于"安全"。远端 manifest 指本机端口时,是**受害者自己的 git** 去发这个请求,
      // 而本机常驻着 api / ai-service / dev server 等监听面 —— 放行等于把 SSRF 的靶子换成由攻击者挑选。
      return {
        ok: false,
        reasonCode: 'urlLoopbackHttpNeedsTestHook',
        detail: `http:${previewOf(host)}`,
      };
    }
    return { ok: true, kind, host };
  }

  // 解析不成 URL:只剩 scp-like 这一条放行通道,且两段都得单独过审。
  const scp = SCP_LIKE_RE.exec(raw);
  if (scp === null) {
    return { ok: false, reasonCode: 'urlMalformed', detail: previewOf(raw) };
  }
  const host = stripIpv6Brackets((scp[1] ?? '').toLowerCase());
  const repoPath = scp[2] ?? '';
  if (host.length === 0 || host.startsWith('-') || host.startsWith('.') || !/^[A-Za-z0-9.-]+$/.test(host)) {
    return { ok: false, reasonCode: 'urlMalformed', detail: `scp-host:${previewOf(host)}` };
  }
  if (!SCP_PATH_RE.test(repoPath)) {
    return { ok: false, reasonCode: 'urlMalformed', detail: `scp-path:${previewOf(repoPath)}` };
  }
  return { ok: true, kind: 'scpLike', host };
}

/**
 * 审 `--branch` 的取值:前导横杠同样能在选项位上被 git 认成参数(`--branch -x` 之后 `-x` 仍是可解析项)。
 * 空 / 缺省 = 未给分支,放行且 `present:false`(performClone 的 `if (ref)` 与此一致)。
 */
export function evaluateGitRef(raw: unknown): GitRefVerdict {
  if (raw === undefined || raw === null) return { ok: true, present: false };
  if (typeof raw !== 'string') return { ok: false, reasonCode: 'refNotString', detail: previewOf(raw) };
  if (raw.length === 0) return { ok: true, present: false };
  if (raw.startsWith('-')) return { ok: false, reasonCode: 'refLeadingDash', detail: previewOf(raw) };
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return { ok: false, reasonCode: 'refControlChar', detail: previewOf(raw) };
  return { ok: true, present: true };
}

/**
 * 审 SHA。它进的是 `fetch … <sha>` / `checkout <sha>` 的位置参数位,与 url 同一族注入面。
 * 十六进制闭集是这里最强的判据:`git checkout -- <sha>` 在本机实测**不能**加 `--`
 * (`--` 之后的串被当 pathspec,rc=1),所以这一维靠值域闭合而不是靠分隔符。
 */
export function evaluateGitSha(raw: unknown): GitShaVerdict {
  if (raw === undefined || raw === null) return { ok: true, present: false };
  if (typeof raw !== 'string') return { ok: false, reasonCode: 'shaNotString', detail: previewOf(raw) };
  if (raw.length === 0) return { ok: true, present: false };
  if (!SHA_RE.test(raw)) return { ok: false, reasonCode: 'shaMalformed', detail: previewOf(raw) };
  return { ok: true, present: true };
}

/**
 * 咽喉点拒绝时抛的结构化错误。
 * message **刻意不含**入参原文(见 previewOf 的理由),流程判断只读 `field` / `reasonCode`。
 */
export class GitCloneInputRejectedError extends Error {
  /**
   * 稳定分档码(G-809):调用方按**这个字符串**分流,而不是 `instanceof` ——
   * 同一个类在"源码 + dist"两份模块下不是同一个构造函数,instanceof 会假负,
   * 于是安全拒绝被降级成"刷新失败"。仓内已有同形态先例(`readMcpRefreshKind`)。
   */
  readonly code = 'git_clone_input_rejected';
  readonly field: 'url' | 'ref' | 'sha';
  readonly reasonCode: GitInputRejectReason;
  readonly detail: string;

  constructor(field: 'url' | 'ref' | 'sha', reasonCode: GitInputRejectReason, detail: string) {
    super(`git clone 入参未过形状白名单:${field}/${reasonCode}(G-786,判据见 apps/cli/src/plugins/url-shape.ts)`);
    this.name = 'GitCloneInputRejectedError';
    this.field = field;
    this.reasonCode = reasonCode;
    this.detail = detail;
  }
}

/**
 * 一次审全三个维度,url 优先(它是最外层也最致命的那一格)。
 * `performClone` 只调这一个出口;任何新增 git 派生点都必须先过它。
 */
export function assertGitCloneInputs(
  input: { url: unknown; ref?: unknown; sha?: unknown },
  opts: { loopbackTestHook?: boolean } = {},
): void {
  const urlVerdict = evaluateGitUrl(input.url, opts);
  if (!urlVerdict.ok) {
    throw new GitCloneInputRejectedError('url', urlVerdict.reasonCode, urlVerdict.detail);
  }
  const refVerdict = evaluateGitRef(input.ref);
  if (!refVerdict.ok) {
    throw new GitCloneInputRejectedError('ref', refVerdict.reasonCode, refVerdict.detail);
  }
  const shaVerdict = evaluateGitSha(input.sha);
  if (!shaVerdict.ok) {
    throw new GitCloneInputRejectedError('sha', shaVerdict.reasonCode, shaVerdict.detail);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
