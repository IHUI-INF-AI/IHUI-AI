<template>
  <main class="sa-dashboard" role="main" aria-labelledby="sa-dashboard-title">
    <header class="sa-header">
      <div>
        <h1 id="sa-dashboard-title" class="sa-title">{{ t('securityAudit.title') }}</h1>
        <p class="sa-subtitle">{{ t('securityAudit.subtitle') }}</p>
      </div>
      <div v-if="state.score" class="sa-risk" :aria-label="t('securityAudit.riskScoreAria', { score: state.score.total })">
        <span class="sa-risk-label">{{ t('securityAudit.riskLabel') }}</span>
        <span :class="['sa-risk-score', `sa-risk-${state.score.label}`]">
          {{ state.score.total }}
        </span>
        <span class="sa-risk-tag">{{ riskLabel(state.score.label) }}</span>
      </div>
    </header>

    <section class="sa-config" aria-labelledby="sa-config-title">
      <h2 id="sa-config-title" class="sa-section-title">{{ t('securityAudit.configTitle') }}</h2>
      <div class="sa-config-grid">
        <div class="sa-field">
          <label for="sa-user-id" class="sa-label">{{ t('securityAudit.userId') }}</label>
          <input
            id="sa-user-id"
            v-model="userId"
            type="text"
            class="sa-input"
            :placeholder="t('securityAudit.userIdPlaceholder')"
          />
        </div>
        <div class="sa-field sa-actions">
          <button type="button" class="sa-btn sa-btn-primary" @click="onRefreshAll">
            <span class="sa-btn-text">{{ t('securityAudit.refreshAll') }}</span>
          </button>
          <button type="button" class="sa-btn sa-btn-secondary" @click="onSimulateFailure">
            <span class="sa-btn-text">{{ t('securityAudit.simulateFailure') }}</span>
          </button>
        </div>
      </div>
    </section>

    <div class="sa-cols">
      <section
        class="sa-panel sa-policies"
        aria-labelledby="sa-policies-title"
        :aria-busy="state.loading ? 'true' : 'false'"
      >
        <div class="sa-panel-head">
          <h2 id="sa-policies-title" class="sa-section-title">{{ t('securityAudit.policiesTitle') }}</h2>
          <span class="sa-panel-meta">{{ t('securityAudit.policiesCount', { count: state.policies.length }) }}</span>
        </div>
        <div v-if="state.policies.length === 0" class="sa-state">{{ t('securityAudit.loadingPolicies') }}</div>
        <ul v-else class="sa-policy-list">
          <li v-for="p in state.policies" :key="p.action" class="sa-policy-item">
            <div class="sa-policy-main">
              <span class="sa-policy-label">{{ p.label }}</span>
              <span class="sa-policy-key">{{ p.action }}</span>
            </div>
            <div class="sa-policy-meta">
              <span>{{ t('securityAudit.cooldown', { seconds: p.cooldown_seconds }) }}</span>
              <span>{{ p.max_per_window }} / {{ Math.round(p.window_seconds / 60) }}m</span>
              <span class="sa-chip">{{ p.channels.join(' / ') }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section
        class="sa-panel sa-authz"
        aria-labelledby="sa-authz-title"
        :aria-busy="state.loading ? 'true' : 'false'"
      >
        <div class="sa-panel-head">
          <h2 id="sa-authz-title" class="sa-section-title">{{ t('securityAudit.authzTitle') }}</h2>
          <span class="sa-panel-meta">DENY: {{ denyCount }}</span>
        </div>
        <div v-if="state.authzEvents.length === 0" class="sa-state">{{ t('securityAudit.noAuthz') }}</div>
        <ul v-else class="sa-event-list">
          <li
            v-for="ev in state.authzEvents.slice(0, 10)"
            :key="ev.event_id"
            :class="['sa-event-item', `sa-event-${ev.decision}`]"
          >
            <div class="sa-event-row">
              <span class="sa-event-action">{{ ev.action }}</span>
              <span :class="['sa-event-decision', `sa-decision-${ev.decision}`]">
                {{ ev.decision }}
              </span>
            </div>
            <div class="sa-event-detail">
              <span>{{ ev.principal_user_id }} → {{ ev.resource_type }}/{{ ev.resource_id }}</span>
              <span v-if="ev.reason" class="sa-event-reason">· {{ ev.reason }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section
        class="sa-panel sa-behavior"
        aria-labelledby="sa-behavior-title"
        :aria-busy="state.loading ? 'true' : 'false'"
      >
        <div class="sa-panel-head">
          <h2 id="sa-behavior-title" class="sa-section-title">{{ t('securityAudit.behaviorTitle') }}</h2>
          <span class="sa-panel-meta">{{ t('securityAudit.behaviorCount', { count: state.behaviorEvents.length }) }}</span>
        </div>
        <div v-if="state.behaviorEvents.length === 0" class="sa-state">{{ t('securityAudit.noBehavior') }}</div>
        <ul v-else class="sa-event-list">
          <li
            v-for="ev in state.behaviorEvents.slice(0, 10)"
            :key="ev.event_id"
            :class="['sa-event-item', ev.success ? 'sa-event-ok' : 'sa-event-fail']"
          >
            <div class="sa-event-row">
              <span class="sa-event-action">{{ ev.kind }}</span>
              <span :class="['sa-event-decision', ev.success ? 'sa-decision-allow' : 'sa-decision-deny']">
                {{ ev.success ? 'success' : 'fail' }}
              </span>
            </div>
            <div class="sa-event-detail">
              <span>IP: {{ ev.ip || '—' }}</span>
              <span>· {{ formatTime(ev.ts) }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section
        class="sa-panel sa-findings"
        aria-labelledby="sa-findings-title"
        :aria-busy="state.loading ? 'true' : 'false'"
      >
        <div class="sa-panel-head">
          <h2 id="sa-findings-title" class="sa-section-title">{{ t('securityAudit.findingsTitle') }}</h2>
          <span class="sa-panel-meta">CRITICAL: {{ criticalCount }}</span>
        </div>
        <div v-if="state.findings.length === 0" class="sa-state">{{ t('securityAudit.noFindings') }}</div>
        <ul v-else class="sa-finding-list">
          <li
            v-for="f in state.findings.slice(0, 10)"
            :key="f.anomaly_id"
            :class="['sa-finding-item', `sa-sev-${f.severity}`]"
          >
            <div class="sa-finding-head">
              <span class="sa-finding-type">{{ f.anomaly_type }}</span>
              <span :class="['sa-finding-sev', `sa-sev-tag-${f.severity}`]">{{ f.severity }}</span>
              <span class="sa-finding-score">{{ f.risk_score }}</span>
            </div>
            <p class="sa-finding-msg">{{ f.message }}</p>
            <div class="sa-finding-time">{{ formatTime(f.ts) }}</div>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="state.error" class="sa-state sa-state-error" role="alert">
      <span aria-hidden="true">!</span>
      <span>{{ state.error }}</span>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { computed, onMounted, ref } from 'vue'
import { useSecurityAudit } from '@/composables/useSecurityAudit'
import { useA11y } from '@/composables/useA11y'
import { ElMessage } from 'element-plus'
import { formatDateTime } from '@/utils/format'

const {
  state,
  fetchPolicies,
  fetchAuthzEvents,
  fetchBehaviorEvents,
  fetchFindings,
  fetchScore,
  simulateBehavior,
} = useSecurityAudit()
const { announce } = useA11y()

const userId = ref('u_p9_demo')

const denyCount = computed(
  () => state.authzEvents.filter((e) => e.decision === 'deny').length,
)
const criticalCount = computed(
  () => state.findings.filter((f) => f.severity === 'critical').length,
)

const riskLabel = (label: string) => {
  const map: Record<string, string> = {
    ok: t('securityAudit.riskOk'),
    elevated: t('securityAudit.riskElevated'),
    warning: t('securityAudit.riskWarning'),
    critical: t('securityAudit.riskCritical'),
  }
  return map[label] || label
}

const formatTime = (ts: number) => formatDateTime(ts * 1000)

const onRefreshAll = async () => {
  try {
    await Promise.all([
      fetchPolicies(),
      fetchAuthzEvents(100),
      fetchBehaviorEvents(userId.value, 100),
      fetchFindings(userId.value, 100),
      fetchScore(userId.value),
    ])
    announce(t('securityAudit.refreshed'), { politeness: 'polite' })
  } catch (e) {
    console.error('[SecurityAudit] 刷新失败', e)
    announce('刷新失败，请重试', { politeness: 'assertive' })
  }
}

const onSimulateFailure = async () => {
  try {
    for (let i = 0; i < 10; i++) {
      await simulateBehavior({
        user_id: userId.value,
        kind: 'login_fail',
        ip: `10.0.0.${i + 1}`,
        success: false,
      })
    }
    await onRefreshAll()
    announce(t('securityAudit.simulatedFailures'), { politeness: 'assertive' })
  } catch (e) {
    console.error('[SecurityAudit] 模拟失败', e)
    ElMessage.error(t('common.errors.simulateFailed'))
  }
}

onMounted(() => {
  onRefreshAll()
})
</script>

<style scoped lang="scss">
@layer components {
  .sa-dashboard {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: clamp(16px, 3vw, 32px);
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 2vw, 24px);
    color: var(--el-text-color-primary);
  }

  .sa-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding: 24px;
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
  }

  .sa-title {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 700;
    margin: 0;
    color: var(--el-text-color-primary);
  }

  .sa-subtitle {
    font-size: 14px;
    color: var(--el-text-color-regular);
    margin: 4px 0 0;
    opacity: 0.75;
  }

  .sa-risk {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 12px 18px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
  }

  .sa-risk-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .sa-risk-score {
    font-size: 28px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;
  }

  .sa-risk-tag {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    color: var(--el-text-color-regular);
  }

  .sa-risk-ok .sa-risk-tag {
    color: var(--el-color-success);
    border-color: var(--el-color-success);
  }

  .sa-risk-elevated .sa-risk-tag {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning);
  }

  .sa-risk-warning .sa-risk-tag {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning);
  }

  .sa-risk-critical .sa-risk-tag {
    color: var(--el-color-danger);
    border-color: var(--el-color-danger);
  }

  .sa-section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--el-text-color-primary);
  }

  .sa-config {
    padding: 20px 24px;
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
  }

  .sa-config-grid {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    gap: 16px;
    align-items: end;
  }

  .sa-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .sa-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .sa-input {
    height: 36px;
    padding: 0 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-family: inherit;
  }

  .sa-input:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
    border-color: var(--el-color-primary);
  }

  .sa-actions {
    flex-flow: row wrap;
    gap: 8px;
  }

  .sa-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .sa-btn:hover {
    border-color: var(--border-unified-color-hover);
  }

  .sa-btn-primary {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
    border-color: var(--el-text-color-primary);
  }

  .sa-cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: clamp(16px, 2vw, 24px);
  }

  .sa-panel {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 20px;
    display: flex;
    flex-direction: column;
    min-height: 280px;
  }

  .sa-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sa-panel-meta {
    font-size: 12px;
    color: var(--el-text-color-regular);
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }

  .sa-state {
    padding: 24px;
    text-align: center;
    color: var(--el-text-color-regular);
    font-size: 14px;
    border: 1px dashed var(--border-unified-color);
    border-radius: var(--global-border-radius);
  }

  .sa-state-error {
    color: var(--el-text-color-primary);
    border: var(--unified-border);
    background: var(--el-fill-color-light);
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .sa-state-error span[aria-hidden] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: var(--unified-border);
    color: var(--el-color-danger);
    border-radius: var(--global-border-radius);
    font-weight: 700;
  }

  .sa-policy-list,
  .sa-event-list,
  .sa-finding-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 360px;
    overflow-y: auto;
  }

  .sa-policy-item,
  .sa-event-item,
  .sa-finding-item {
    padding: 10px 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    font-size: 13px;
  }

  .sa-policy-main,
  .sa-event-row,
  .sa-finding-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sa-policy-label {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .sa-policy-key {
    font-size: 12px;
    color: var(--el-text-color-regular);
    opacity: 0.75;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }

  .sa-policy-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .sa-chip {
    display: inline-block;
    padding: 1px 6px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-primary);
  }

  .sa-event-detail {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .sa-event-reason {
    color: var(--el-color-danger);
    font-weight: 500;
  }

  .sa-event-decision,
  .sa-finding-sev {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    font-weight: 600;
    text-transform: uppercase;
  }

  .sa-decision-allow {
    color: var(--el-color-success);
    border-color: var(--el-color-success);
  }

  .sa-decision-deny {
    color: var(--el-color-danger);
    border-color: var(--el-color-danger);
  }

  .sa-decision-uncertain {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning);
  }

  .sa-event-item.sa-event-deny {
    border-color: var(--el-color-danger);
  }

  .sa-event-item.sa-event-fail {
    border-color: var(--el-color-warning);
  }

  .sa-finding-type {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .sa-sev-tag-warning {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning);
  }

  .sa-sev-tag-critical {
    color: var(--el-color-danger);
    border-color: var(--el-color-danger);
  }

  .sa-finding-item.sa-sev-critical {
    border-color: var(--el-color-danger);
  }

  .sa-finding-item.sa-sev-warning {
    border-color: var(--el-color-warning);
  }

  .sa-finding-score {
    font-weight: 700;
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;
  }

  .sa-finding-msg {
    margin: 6px 0 4px;
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .sa-finding-time {
    font-size: 12px;
    color: var(--el-text-color-regular);
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }
}
</style>
