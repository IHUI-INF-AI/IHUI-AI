// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skill tool (L5669①: on-demand body fetch for two-level progressive disclosure
 * + the 428 prerequisite gate).
 *
 * Two-level progressive disclosure: the system prompt carries only the catalog
 * (name + description + path); bodies are NOT injected. The model calls this
 * tool by name to fetch the body on demand.
 *
 * Precondition gate: at entry, check whether the session already loaded the
 * skill successfully; otherwise validate frontmatter `prerequisites` (commands
 * on PATH, env vars non-empty). Missing prerequisites return the stable code 428
 * (Precondition Required) instead of the body; no throw, no execution.
 *
 * After compaction wipes the returned body, the session loaded-mark is reset by
 * resetLoadedSkills(); the model must call this tool again through the gate.
 *
 * G-175 coverage extension (2026-10-24): a successful load also augments the
 * allowed-tools SHADOW surface for this skill (record-only, never enforced) --
 * explicit single-skill loads bypass formatSkillsForPrompt, so without this the
 * skill's declared whitelist would never be observed against real tool calls.
 */
import { SKILL_INVOCATION_TOOL_NAME, getAllowedTools } from '../skills/index.js';
import { augmentShadowSurfaceForSkill } from '../skills/allowed-tools-shadow.js';
import {
  checkSkillPrerequisites,
  findSessionSkill,
  isSkillLoaded,
  listSessionSkills,
  markSkillLoaded,
} from '../skills/session.js';
import type { Tool, ToolResult } from './index.js';

/** Stable precondition-gate code (HTTP 428 Precondition Required) for model/upper layers. */
export const SKILL_PRECONDITION_CODE = 428;
/** Stable structured error type (matched by code, not by prose). */
export const SKILL_PRECONDITION_ERROR_TYPE = 'skill_precondition_required';

function renderLoadedSkill(skill: {
  name: string;
  description: string;
  source: string;
  body: string;
}): string {
  const lines = [
    `# Skill: ${skill.name}`,
    skill.description ? `description: ${skill.description}` : '',
    `path: ${skill.source}`,
    '',
    skill.body.trim(),
  ].filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === '')));
  return lines.join('\n').trim();
}

function notFoundResult(name: string): ToolResult {
  const known = listSessionSkills()
    .map((s) => s.name)
    .sort();
  const hint = known.length > 0
    ? ` Available skills: ${known.join(', ')}`
    : ' No skills are registered in this session.';
  return {
    success: false,
    output: '',
    error: `[skill_not_found] no skill named "${name}" in the session catalog.${hint}`,
    errorType: 'skill_not_found',
  };
}

const skillTool: Tool = {
  name: SKILL_INVOCATION_TOOL_NAME,
  description:
    'Load a skill body by name: resolve it in the session catalog, pass the prerequisite '
    + 'command/env checks, then return the full instructions; idempotent when already loaded '
    + 'this session. Returns stable code 428 when prerequisites are unmet; satisfy them and retry.',
  dangerLevel: 'read',
  parameters: {
    name: { type: 'string', description: 'Skill name (case-insensitive, match the catalog name)' },
  },
  required: ['name'],
  async execute(args): Promise<ToolResult> {
    const raw = String(args.name ?? '').trim();
    if (!raw) {
      return {
        success: false,
        output: '',
        error: 'Missing required parameter: name (the skill to load).',
        errorType: 'invalid_arguments',
      };
    }
    const skill = findSessionSkill(raw);
    if (!skill) return notFoundResult(raw);

    if (!isSkillLoaded(skill.name)) {
      const missing = checkSkillPrerequisites(skill);
      if (missing.commands.length > 0 || missing.env.length > 0) {
        const parts = [
          missing.commands.length > 0 ? `missing commands: ${missing.commands.join(', ')}` : '',
          missing.env.length > 0 ? `missing env: ${missing.env.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('; ');
        return {
          success: false,
          output: '',
          error:
            `[${SKILL_PRECONDITION_CODE} Precondition Required] skill "${skill.name}" prerequisites not met: ${parts}. `
            + 'Satisfy them (install the command / export the variable), then call Skill again.',
          errorType: SKILL_PRECONDITION_ERROR_TYPE,
        };
      }
      markSkillLoaded(skill.name);
    }

    // G-175 扩面(2026-10-24):显式单点加载把该技能的 allowed-tools 并入影子面 ——
    // 只记不挡(见 allowed-tools-shadow.ts 文件头三条口径),同名同表幂等,不动自动面。
    augmentShadowSurfaceForSkill({ name: skill.name, allowed: getAllowedTools(skill.frontmatter) });

    return { success: true, output: renderLoadedSkill(skill) };
  },
};

export const SKILL_TOOLS: Tool[] = [skillTool];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
