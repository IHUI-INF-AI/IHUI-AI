// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令策略层的公共类型 —— 三态判定 + 效果分类 + 语法表数据结构。
 *
 * 为什么把"效果"与"结论"分成两套概念:
 *   `verdict` 面向免确认放行(只有 `read-only` 才允许自动执行);
 *   `effects` 面向分类归因(同为非只读的两种命令,一个写文件、一个发网络包,处置手段不同)。
 *   `dangerous` 是"旧危险模式档的等价面"(只对应既有拦截语义),刻意不与 `destructive` 合并 ——
 *   合并会把逃生舱档位(IHUI_YOLO)的既有语义一并改掉,那是另一次决策。
 */

/** 命令产生的副作用类别。 */
export type CommandEffect =
  /** 只读取信息,不改变任何状态 */
  | 'read'
  /** 写文件 / 改写仓库或包管理状态 */
  | 'write'
  /** 出站网络 */
  | 'network'
  /** 改系统状态(权限、进程、设备) */
  | 'system'
  /** 难以撤销的删除 / 覆盖 */
  | 'destructive';

/** 三态结论,默认态是 unknown。 */
export type SyntaxVerdict = 'read-only' | 'mutating' | 'unknown';

/** 选项取值形态。 */
export type OptionArity = 'none' | 'required' | 'optional';

export interface OptionSpec {
  /** 长选项写不带 `--` 的名;短选项写单字符 */
  name: string;
  arity?: OptionArity;
  /** 出现即追加的效果 */
  effects?: readonly CommandEffect[];
  /** 出现即取消只读资格 */
  breaksReadonly?: boolean;
  /** 出现即命中"旧危险模式档"等价面 */
  danger?: boolean;
  /** 永远需要确认 —— 逃生舱也不得静默放行的子集 */
  alwaysConfirm?: boolean;
  /** 命中该选项时的规则标识,供上层展示与测试断言 */
  rule?: string;
}

export interface SubcommandSpec {
  /** 该子命令的效果;省略则继承所属命令的 effect */
  effects?: readonly CommandEffect[];
  options?: readonly OptionSpec[];
  danger?: boolean;
  alwaysConfirm?: boolean;
  /** 必须出现这些选项之一才允许判只读(如 `cargo build --dry-run`) */
  readGuardOptions?: readonly string[];
  /** 出现这些"写语义子动作"作操作数时不再只读(如 `git remote remove`) */
  mutatingOperands?: readonly string[];
  rule?: string;
}

/** 只有"结论取决于操作数内容"时才需要的少量守卫。 */
export type OperandGuard =
  /** 位模式参数:八进制三位/四位或含 `+s` 才判危险(chmod) */
  | { kind: 'permission-mode' }
  /** `of=/dev/...` 形态的写设备目标(dd) */
  | { kind: 'write-to-device' }
  /** 根目录级别的删除目标:`/`、`/*`、`C:\`、`~`(rm / cp -r / chmod -R) */
  | { kind: 'root-target' };

export interface CommandSpec {
  /** 无子命令时的基线效果;`requires-subcommand` 表示必须带子命令才可判定 */
  effect: CommandEffect | 'requires-subcommand';
  /** 是否按"子命令表"求值(false 表示非选项参数一律按操作数处理) */
  structured?: boolean;
  options?: readonly OptionSpec[];
  subcommands?: Readonly<Record<string, SubcommandSpec>>;
  /** 全局选项(出现在子命令之前或之后都算) */
  globalOptions?: readonly OptionSpec[];
  operandGuards?: readonly OperandGuard[];
  /** 操作数是不可静态分析的程序/脚本体(sed/awk/xargs):只读结论一律降级 */
  opaqueOperands?: boolean;
  /** 出现任何非选项操作数即取消只读资格(`hostname foo` 是设置主机名) */
  operandsBreakReadonly?: boolean;
  /** 操作数个数超过该值即视为有输出文件(`uniq IN OUT`) */
  outputOperandIndex?: number;
  danger?: boolean;
  alwaysConfirm?: boolean;
  rule?: string;
}

export interface CommandFinding {
  verdict: SyntaxVerdict;
  effects: readonly CommandEffect[];
  /** 等价于旧危险模式表 —— 命中即需强制拦截 */
  dangerous: boolean;
  /** 归入 destructive 一档(新 API 消费者使用,不改变 matchDangerousCommand 语义) */
  destructive: boolean;
  /** 永远需要确认 —— 逃生舱也不得静默放行的子集 */
  alwaysConfirm: boolean;
  /** 主判据,便于定位"为什么这条命令没被免确认" */
  reason: string;
  /** 命中的规则标识,如 `rm -r` */
  rule?: string;
  basename?: string;
  subcommand?: string;
}

export interface CommandAssessment extends CommandFinding {
  /** 每个复合段的独立结论(聚合前的原始事实) */
  segments: readonly CommandFinding[];
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
