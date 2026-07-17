/**
 * 命令安全护栏 — 危险命令模式匹配 + 只读命令自动批准。
 *
 * 两层防线:
 *   1. 危险命令模式(rm -rf / chmod 777 / git push --force 等)强制拦截,除非 IHUI_YOLO=1
 *   2. 只读命令(ls / cat / git status 等)在 sandbox profile=trusted 时自动放行,免确认
 * 复合命令(含 && || ; |)一律不自动放行,需逐段审查。
 */

export const DANGEROUS_COMMAND_PATTERNS: readonly RegExp[] = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f?|--recursive)\b/i,
  /\bchmod\s+([0-7]{3,4}|u\+s|g\+s|777|666)\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\bchattr\b/i,
  /\bpkill\b/i,
  /\bkill(all)?\s+-9\b/i,
  /\bgit\s+push\s+(-f|--force|--force-with-lease)\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*\b/i,
  /\bgit\s+branch\s+-D\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bmkfs\b/i,
  /\bdd\s+.*of=\/dev\//i,
];

export const READONLY_COMMAND_BASENAMES: readonly string[] = [
  'ls', 'cat', 'pwd', 'date', 'whoami', 'hostname', 'uptime', 'ps',
  'head', 'tail', 'wc', 'sort', 'uniq', 'tr', 'cut',
  'git',
  'grep', 'rg', 'ag',
  'cargo',
  'kubectl',
  'docker',
];

export const GIT_READONLY_SUBCOMMANDS: readonly string[] = [
  'status', 'branch', 'log', 'diff', 'ls-files', 'show', 'rev-parse', 'blame', 'remote', 'config --get',
];

const SUBCOMMAND_ALLOWLIST: Record<string, readonly string[]> = {
  git: GIT_READONLY_SUBCOMMANDS,
  cargo: ['check', 'build --dry-run', 'test --no-run', 'tree'],
  kubectl: ['get', 'logs', 'describe', 'explain'],
  docker: ['ps', 'logs', 'inspect', 'version', 'info', 'images'],
};

const COMPOUND_SEPARATOR = /\s*(?:&&|\|\||;|\|)\s*/;

export function matchDangerousCommand(command: string): RegExp | null {
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) return pattern;
  }
  return null;
}

export function isReadonlyCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (COMPOUND_SEPARATOR.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/);
  const firstToken = tokens[0]!.replace(/^["']|["']$/g, '');
  const basename = firstToken.split(/[/\\]/).pop()!.replace(/\.(exe|cmd|bat|com)$/i, '').toLowerCase();

  if (!READONLY_COMMAND_BASENAMES.includes(basename)) return false;

  const allowedSubs = SUBCOMMAND_ALLOWLIST[basename];
  if (allowedSubs) {
    const sub = tokens[1]?.toLowerCase();
    if (!sub) return false;
    const twoWordSub = tokens[2] ? `${sub} ${tokens[2]!.toLowerCase()}` : sub;
    return allowedSubs.includes(sub) || allowedSubs.includes(twoWordSub);
  }

  return true;
}
