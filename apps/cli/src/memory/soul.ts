/**
 * SoulMemory — 用户偏好/价值观层,存储用户画像(preferences/values/goals)。
 * JSON 持久化到 <workspace>/.trae-cn/memory/soul.json。
 * 平台独占:仅 cli(W2-1 四层记忆第 3 层,对标 OpenClaw Mem semantic memory)。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SoulProfile {
  preferences: string[];
  values: string[];
  goals: string[];
}

function emptyProfile(): SoulProfile {
  return { preferences: [], values: [], goals: [] };
}

export class SoulMemory {
  private readonly filePath: string;
  private profile: SoulProfile;

  constructor(workspacePath: string) {
    this.filePath = path.join(workspacePath, '.trae-cn', 'memory', 'soul.json');
    this.profile = this.load();
  }

  /** 当前画像快照(只读视图)。 */
  get current(): SoulProfile {
    return {
      preferences: [...this.profile.preferences],
      values: [...this.profile.values],
      goals: [...this.profile.goals],
    };
  }

  /** 追加偏好(去重,空串忽略),自动持久化。 */
  addPreference(p: string): void {
    if (p && !this.profile.preferences.includes(p)) {
      this.profile.preferences.push(p);
      this.save();
    }
  }

  /** 追加价值观(去重,空串忽略),自动持久化。 */
  addValue(v: string): void {
    if (v && !this.profile.values.includes(v)) {
      this.profile.values.push(v);
      this.save();
    }
  }

  /** 追加目标(去重,空串忽略),自动持久化。 */
  addGoal(g: string): void {
    if (g && !this.profile.goals.includes(g)) {
      this.profile.goals.push(g);
      this.save();
    }
  }

  /** 部分更新画像(缺省字段保留原值),自动持久化。 */
  update(profile: Partial<SoulProfile>): void {
    this.profile = {
      preferences: profile.preferences ?? this.profile.preferences,
      values: profile.values ?? this.profile.values,
      goals: profile.goals ?? this.profile.goals,
    };
    this.save();
  }

  /** 清空全部画像,自动持久化。 */
  clear(): void {
    this.profile = emptyProfile();
    this.save();
  }

  private load(): SoulProfile {
    if (!fs.existsSync(this.filePath)) return emptyProfile();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Partial<SoulProfile>;
      return {
        preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
        values: Array.isArray(parsed.values) ? parsed.values : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      };
    } catch {
      return emptyProfile();
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.profile, null, 2), 'utf-8');
  }

  /** 文件路径(供外部诊断使用)。 */
  get path(): string {
    return this.filePath;
  }
}
