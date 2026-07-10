export type CanaryStage = 'off' | 'canary_1pct' | 'canary_5pct' | 'canary_25pct' | 'full';

export interface CanaryConfig {
  name: string;
  currentStage: CanaryStage;
  targetStage: CanaryStage;
  failureThreshold: number;
  cooldownMinutes: number;
  startedAt: Date | null;
  lastPromotedAt: Date | null;
  failureCount: number;
  isActive: boolean;
}

export interface CanaryAuditEntry {
  id: string;
  configName: string;
  action: 'promote' | 'rollback' | 'reset' | 'failure';
  fromStage: CanaryStage;
  toStage: CanaryStage;
  timestamp: Date;
  reason: string;
}

const STAGE_ORDER: CanaryStage[] = ['off', 'canary_1pct', 'canary_5pct', 'canary_25pct', 'full'];
const STAGE_PERCENT: Record<CanaryStage, number> = {
  off: 0,
  canary_1pct: 1,
  canary_5pct: 5,
  canary_25pct: 25,
  full: 100,
};

const configs = new Map<string, CanaryConfig>();
const auditLog: CanaryAuditEntry[] = [];

export async function getCanaryConfig(name: string): Promise<CanaryConfig | null> {
  return configs.get(name) ?? null;
}

export async function listCanaryConfigs(): Promise<CanaryConfig[]> {
  return Array.from(configs.values());
}

export async function createCanary(
  name: string,
  targetStage: CanaryStage = 'full',
  failureThreshold = 5,
  cooldownMinutes = 30,
): Promise<CanaryConfig> {
  const config: CanaryConfig = {
    name,
    currentStage: 'off',
    targetStage,
    failureThreshold,
    cooldownMinutes,
    startedAt: new Date(),
    lastPromotedAt: null,
    failureCount: 0,
    isActive: true,
  };
  configs.set(name, config);
  addAudit(name, 'promote', 'off', 'canary_1pct', 'canary started');
  config.currentStage = 'canary_1pct';
  return config;
}

export async function promoteCanary(name: string): Promise<CanaryConfig> {
  const config = configs.get(name);
  if (!config) throw new Error(`canary config "${name}" not found`);
  if (!config.isActive) throw new Error('canary is not active');

  // 冷却期检查
  if (config.lastPromotedAt) {
    const elapsed = Date.now() - config.lastPromotedAt.getTime();
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (elapsed < cooldownMs) {
      throw new Error(
        `cooldown period not elapsed (${Math.ceil((cooldownMs - elapsed) / 60000)} minutes remaining)`,
      );
    }
  }

  const currentIdx = STAGE_ORDER.indexOf(config.currentStage);
  const targetIdx = STAGE_ORDER.indexOf(config.targetStage);
  if (currentIdx >= targetIdx) throw new Error('already at or beyond target stage');

  const nextStage = STAGE_ORDER[currentIdx + 1]!;
  addAudit(name, 'promote', config.currentStage, nextStage, 'manual promote');
  config.currentStage = nextStage;
  config.lastPromotedAt = new Date();
  config.failureCount = 0;

  if (nextStage === config.targetStage) config.isActive = false;
  return config;
}

export async function rollbackCanary(name: string, reason: string): Promise<CanaryConfig> {
  const config = configs.get(name);
  if (!config) throw new Error(`canary config "${name}" not found`);

  addAudit(name, 'rollback', config.currentStage, 'off', reason);
  config.currentStage = 'off';
  config.isActive = false;
  config.failureCount = 0;
  return config;
}

export async function recordFailure(name: string, reason: string): Promise<CanaryConfig> {
  const config = configs.get(name);
  if (!config) throw new Error(`canary config "${name}" not found`);

  config.failureCount++;
  addAudit(name, 'failure', config.currentStage, config.currentStage, reason);

  if (config.failureCount >= config.failureThreshold) {
    return rollbackCanary(name, `auto-rollback: failure threshold (${config.failureThreshold}) exceeded`);
  }
  return config;
}

export async function resetCanary(name: string): Promise<CanaryConfig> {
  const config = configs.get(name);
  if (!config) throw new Error(`canary config "${name}" not found`);
  config.currentStage = 'off';
  config.failureCount = 0;
  config.isActive = false;
  config.startedAt = null;
  config.lastPromotedAt = null;
  addAudit(name, 'reset', config.currentStage, 'off', 'manual reset');
  return config;
}

export async function getAuditLog(configName?: string): Promise<CanaryAuditEntry[]> {
  if (configName) return auditLog.filter((e) => e.configName === configName);
  return auditLog;
}

export function getCanaryPercentage(stage: CanaryStage): number {
  return STAGE_PERCENT[stage];
}

function addAudit(
  configName: string,
  action: CanaryAuditEntry['action'],
  fromStage: CanaryStage,
  toStage: CanaryStage,
  reason: string,
): void {
  auditLog.unshift({
    id: `${configName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    configName,
    action,
    fromStage,
    toStage,
    timestamp: new Date(),
    reason,
  });
  if (auditLog.length > 1000) auditLog.pop();
}
