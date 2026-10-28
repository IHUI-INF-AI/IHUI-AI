// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件路径安全的唯一判定层 —— realpath errno 封闭集 + 符号链接可达性判定。
 *
 * 立票(G-705,2026-09-29):`installer.ts` 原先有两处 fail-open ——
 *   ① `isPathUnsafe` 的 `catch { /* realpath 失败,跳过 symlink 检查 *\/ }`
 *   ② `copyDirRecursive` 里 realpath 失败 `continue`
 * 两处都把**"判不了"**当成了**"没问题"**。这条链路处理的是**第三方来源**的插件:
 * 符号链接越界检查一旦在 EPERM / EACCES / ELOOP 上放行,就是"我没看见"被记账成"检查通过",
 * 而失效表现永远是安静(安装成功、旧副本被换掉、越界内容已落盘)。
 *
 * 现在的判据(封闭集,不是兜底):
 *   - **只有明确缺失**才允许降级:`{ENOENT, ENOTDIR, EISDIR}` —— 这三个码的含义是
 *     "该路径(或其某个父段)确实不存在 / 不是目录",不存在的东西不可能被复制到插件里;
 *   - **其它一切**判 unsafe:EPERM / EACCES / ELOOP / ENAMETOOLONG / 任何未知码 /
 *     取不到码 / 抛出物不是 Error —— 一律按"可达性无法判定 = 拒装"处置。
 *     方向是刻意选的不误放:一次误拒的代价是"这个人装不上,换个环境再装",
 *     一次误放的代价是"别人的目录被复制进插件目录并在下次装载时被当代码执行"。
 *
 * 三条实现纪律(照抄本仓既有规矩,不重新发明):
 *   1. **一处实现**:errno 封闭集与判定函数只住在本文件,`installer.ts` 只消费结论;
 *      别处再抄一份列表 = 两处必漂移(AGENTS §4 / 守门 131 同一课)。
 *   2. **不依赖错误文本判流程**:码从 `err.code` 取(含被 `cause` 包了一层的那种形态,
 *      本仓的包装写法见 `installer.ts` 的 `saveInstallRegistryChecked`),取不到就算未知 ⇒ unsafe。
 *      不做 `message.includes('EACCES')` 那类字符串归因。
 *   3. **判据必须覆盖门自己产出的形态**:realpath 的失败可能落在"根"那一步,也可能落在
 *      "链接目标"那一步,两处的诊断信息不同,所以 `stage` 是一等字段;而调用方要拿结论
 *      分流(降级 / 拒装 / 继续拷贝),所以返回的是**结构化结论**而不是抛穿(抛穿整条安装
 *      链就丢了"是哪条链接、哪个码、哪一步")。
 *
 * 测试缝:`setRealpathProbeForTests`。它是**函数注入**,不是环境变量开关 ——
 * 环境变量开关会让"把 realpath 关掉"变成一个可被配置出来的生产形态,
 * 而这条判据守的恰恰是"配置/环境之外还得有个真判定"。生产代码不传即走 `node:fs`。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ==================== errno 封闭集(唯一一份) ====================

/**
 * 允许按"明确缺失"降级的 realpath errno。
 *
 * - `ENOENT`  —— 路径不存在(悬空链接就是这一码,本机实测:指向已删除目录的 junction
 *   `fs.realpathSync` 抛 ENOENT;两个互相指向的符号链接抛 ELOOP,不在此列 ⇒ 判 unsafe)。
 * - `ENOTDIR` —— 路径的某个父段不是目录。
 * - `EISDIR`  —— 把目录当文件 stat(目标形态与预期不符,内容不可能被当成链接目标复制)。
 *
 * **封闭集**:成员只有这三个。加第四个必须先给出"它同样意味着内容明确不存在"的证据,
 * 不得为了"让某个环境装上"就地扩表 —— 那等于把 fail-open 换个写法搬回来。
 */
const SKIPPABLE_REALPATH_ERRNOS: ReadonlySet<string> = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);

/** 沿 `cause` 链向上找错误码的最大层数(包装层数是有界的,不做无界递归,也不只看第一层)。 */
const MAX_CAUSE_DEPTH = 5;

// ==================== 错误码提取与分类 ====================

/** realpath 的实现签名(默认 `fs.realpathSync`;测试可注入)。 */
export type RealpathProbe = (target: string) => string;

/** 抛出物的最小结构形状:能带 `code`,能带 `cause`(Error 与普通对象都算)。 */
interface ErrorLike {
  readonly code?: unknown;
  readonly cause?: unknown;
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null;
}

/**
 * 取错误码:先看抛出物自身的 `code`,再沿 `cause` 向上找(至多 MAX_CAUSE_DEPTH 层)。
 * 取不到(非对象 / 无字符串码 / 链路断裂)一律 `null` —— 调用方必须把 null 当"未知"处置,
 * 不得把 null 读成"没有错误码所以大概是无所谓的那一类"。
 */
function errnoCodeOf(err: unknown): string | null {
  let cursor: unknown = err;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (!isErrorLike(cursor)) return null;
    const code = cursor.code;
    if (typeof code === 'string' && code.length > 0) return code;
    cursor = cursor.cause;
  }
  return null;
}

/** 一次失败的可读归因(用于诊断文本,不参与判定分支)。 */
function describeThrown(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'string') return `string: ${err}`;
  return `非 Error 抛出物(${typeof err})`;
}

/** realpath 失败的分类结论(不导出:只有本模块产出、只有 __test__ 暴露给单测)。 */
interface RealpathFailureVerdict {
  /** 'missing' = 封闭集内的明确缺失,允许降级;'unsafe' = 判不了,按不安全处置 */
  readonly kind: 'missing' | 'unsafe';
  /** 取到的错误码(null = 未知,未知一律落 unsafe,不并入 missing) */
  readonly errno: string | null;
  /** 诊断原文:码 + 抛出物形态 + 原始消息,足够让人判断该去哪一台机器上重试 */
  readonly summary: string;
}

/**
 * 把一次 realpath(同族 fs 调用)失败分类成"明确缺失"或"判不了"。
 *
 * 这是本仓该型的**唯一**判据入口:任何"realpath/lstat/stat 失败了,要不要跳过检查"的判断
 * 都必须经过它,不得在别处再写一遍 `code === 'ENOENT' || ...`。
 */
function classifyRealpathFailure(err: unknown): RealpathFailureVerdict {
  const errno = errnoCodeOf(err);
  const summary = `errno=${errno ?? '(未知)'} · ${describeThrown(err)}`;
  if (errno !== null && SKIPPABLE_REALPATH_ERRNOS.has(errno)) {
    return { kind: 'missing', errno, summary };
  }
  return { kind: 'unsafe', errno, summary };
}

// ==================== 符号链接可达性判定 ====================

/** 失败发生在哪一步(两处的点名信息不同,所以 stage 是一等字段)。 */
export type ContainmentStage = 'root' | 'target';

/** 一次"链接目标是否落在根内"的结构化结论(四态,不并桶)。 */
type SymlinkContainmentVerdict =
  | { readonly status: 'contained'; readonly realRoot: string; readonly realTarget: string }
  | {
      readonly status: 'escape';
      readonly realRoot: string;
      readonly realTarget: string;
      readonly message: string;
    }
  | {
      /** 明确缺失(封闭集内)⇒ 调用方可以按改动前的行为降级。绝不与 'unsafe' 合并计数。 */
      readonly status: 'degraded-missing';
      readonly stage: ContainmentStage;
      readonly errno: string;
      readonly message: string;
    }
  | {
      /** 判不了 ⇒ 调用方必须拒装/不放行,并把 message 原样交给用户。 */
      readonly status: 'unsafe';
      readonly stage: ContainmentStage;
      readonly errno: string | null;
      readonly message: string;
    };

interface SymlinkContainmentInput {
  /** 符号链接自身路径(只用于诊断点名) */
  readonly linkPath: string;
  /** 链接目标(必须是已解析的绝对路径) */
  readonly targetPath: string;
  /** 允许范围根目录 */
  readonly rootPath: string;
}

/**
 * 判定"linkPath 的真实目标是否落在 rootPath 内"。
 *
 * 顺序:先解析根、再解析目标(与改动前一致 —— 旧代码也是先 realpath(root) 后 realpath(target)),
 * 任一步抛错就按封闭集分类。**这一步绝不把"取不到"写成"通过"**:
 * `degraded-missing` 与 `unsafe` 是两个不同的 status,调用方分流动作不同。
 */
function checkSymlinkContainment(
  input: SymlinkContainmentInput,
  probe: RealpathProbe = activeRealpathProbe(),
): SymlinkContainmentVerdict {
  let realRoot: string;
  try {
    realRoot = probe(input.rootPath);
  } catch (err) {
    const verdict = classifyRealpathFailure(err);
    const message =
      `无法解析范围根目录,符号链接可达性判不了:${input.rootPath}` +
      `(链接 ${input.linkPath} → 目标 ${input.targetPath}):: ${verdict.summary}`;
    if (verdict.kind === 'missing' && verdict.errno !== null) {
      return { status: 'degraded-missing', stage: 'root', errno: verdict.errno, message };
    }
    return { status: 'unsafe', stage: 'root', errno: verdict.errno, message };
  }

  let realTarget: string;
  try {
    realTarget = probe(input.targetPath);
  } catch (err) {
    const verdict = classifyRealpathFailure(err);
    const message =
      `无法解析符号链接的真实目标:${input.linkPath} → ${input.targetPath}` +
      `(范围根 ${input.rootPath}):: ${verdict.summary}`;
    if (verdict.kind === 'missing' && verdict.errno !== null) {
      return { status: 'degraded-missing', stage: 'target', errno: verdict.errno, message };
    }
    return { status: 'unsafe', stage: 'target', errno: verdict.errno, message };
  }

  const rel = path.relative(realRoot, realTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return {
      status: 'escape',
      realRoot,
      realTarget,
      message: `符号链接逃逸:${input.linkPath} → ${input.targetPath}(真实目标 ${realTarget} 不在 ${realRoot} 内)`,
    };
  }
  return { status: 'contained', realRoot, realTarget };
}

// ==================== realpath 实现(默认 node:fs;测试可注入) ====================

const nodeRealpathProbe: RealpathProbe = (target: string) => fs.realpathSync(target);

/**
 * 注入位。**只由 `__test__.setRealpathProbeForTests` 写**,生产路径永远走默认实现。
 * 做成模块内私有变量而不是导出的可写对象,是为了让"生产面改判据"必须显式调用带
 * ForTests 后缀的出口 —— 一眼就能在 review 里看出来。
 */
let injectedRealpathProbe: RealpathProbe | null = null;

function activeRealpathProbe(): RealpathProbe {
  return injectedRealpathProbe ?? nodeRealpathProbe;
}

/**
 * 测试专用:替换 realpath 实现(传 null 还原 `node:fs`)。
 *
 * 用途是构造"链接目标存在但 realpath 抛 EACCES/EPERM/ELOOP"这类**不能靠真权限**复现的现场。
 * 调用方**必须**在 finally / afterEach 里复位,否则后续用例会继承注入实现。
 */
function setRealpathProbeForTests(probe: RealpathProbe | null): void {
  injectedRealpathProbe = probe;
}

/** 供镜像/单测读取的常量视图(不在别处再抄一份名单;测试用它做"名单未漂移"的对账)。 */
export const __test__ = {
  skippableRealpathErrnos: SKIPPABLE_REALPATH_ERRNOS,
  errnoCodeOf,
  classifyRealpathFailure,
  checkSymlinkContainment,
  setRealpathProbeForTests,
};

export { classifyRealpathFailure, checkSymlinkContainment };
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
