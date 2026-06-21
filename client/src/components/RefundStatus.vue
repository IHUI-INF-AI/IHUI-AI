<template>
  <div class="refund-status">
    <!-- 状态徽章 -->
    <div class="status-header" :class="`status-${currentStatus}`">
      <div class="status-icon">
        <span>{{ statusIcon }}</span>
      </div>
      <div class="status-info">
        <div class="status-title">{{ statusTitle }}</div>
        <div class="status-desc">{{ statusDesc }}</div>
      </div>
    </div>

    <!-- 时间线 -->
    <div class="timeline">
      <h3 class="timeline-title">{{ t('refundStatus.timelineTitle') }}</h3>
      <ol class="timeline-list">
        <li
          v-for="(item, idx) in timeline"
          :key="idx"
          class="timeline-item"
          :class="{ active: isActive(item), rejected: isRejected(item) }"
        >
          <div class="timeline-dot">
            <span v-if="isActive(item)">●</span>
            <span v-else-if="isRejected(item)">×</span>
            <span v-else>✓</span>
          </div>
          <div class="timeline-content">
            <div class="timeline-action">{{ actionLabel(item.action) }}</div>
            <div class="timeline-time">{{ formatTime(item.ts) }}</div>
            <div v-if="item.note" class="timeline-note">{{ item.note }}</div>
            <div v-if="item.operator" class="timeline-operator">{{ t('refundStatus.operator') }}: {{ item.operator }}</div>
          </div>
        </li>
      </ol>
    </div>

    <!-- 凭证 -->
    <div v-if="evidence.length > 0" class="evidence-section">
      <h3 class="section-title">{{ t('refundStatus.evidenceTitle') }}</h3>
      <div class="evidence-list">
        <a
          v-for="ev in evidence"
          :key="ev.id"
          :href="ev.stored_path"
          :download="ev.filename"
          class="evidence-item"
        >
          <span class="evidence-icon">📎</span>
          <span class="evidence-name">{{ ev.filename }}</span>
          <span class="evidence-size">{{ formatSize(ev.size) }}</span>
        </a>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div v-if="canCancel" class="actions">
      <button
        class="cancel-btn ripple-btn"
        @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); $emit('cancel') }"
      >
        <span class="btn-text">{{ t('refundStatus.cancelRefund') }}</span>
        <span class="btn-glow"></span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()

interface TimelineEntry {
  ts: string
  action: string
  operator: string
  note: string
  status_from?: string
}

interface Evidence {
  id: string
  filename: string
  stored_path: string
  size: number
  description?: string
  uploaded_at: string
}

interface Props {
  status: string
  timeline: TimelineEntry[]
  evidence: Evidence[]
  reason?: string
}

const props = withDefaults(defineProps<Props>(), {
  timeline: () => [],
  evidence: () => [],
  reason: '',
})

defineEmits<{
  (e: 'cancel'): void
}>()

const STATUS_CONFIG: Record<string, { icon: string; titleKey: string; descKey: string }> = {
  pending: {
    icon: '⏱',
    titleKey: 'refundStatus.statusPending',
    descKey: 'refundStatus.descPending',
  },
  reviewing: {
    icon: '🔍',
    titleKey: 'refundStatus.statusReviewing',
    descKey: 'refundStatus.descReviewing',
  },
  approved: {
    icon: '✓',
    titleKey: 'refundStatus.statusApproved',
    descKey: 'refundStatus.descApproved',
  },
  rejected: {
    icon: '✕',
    titleKey: 'refundStatus.statusRejected',
    descKey: 'refundStatus.descRejected',
  },
  processing: {
    icon: '💳',
    titleKey: 'refundStatus.statusProcessing',
    descKey: 'refundStatus.descProcessing',
  },
  completed: {
    icon: '✓✓',
    titleKey: 'refundStatus.statusCompleted',
    descKey: 'refundStatus.descCompleted',
  },
  failed: {
    icon: '⚠',
    titleKey: 'refundStatus.statusFailed',
    descKey: 'refundStatus.descFailed',
  },
  cancelled: {
    icon: '⊘',
    titleKey: 'refundStatus.statusCancelled',
    descKey: 'refundStatus.descCancelled',
  },
}

const currentStatus = computed(() => props.status || 'pending')

const statusIcon = computed(() => STATUS_CONFIG[currentStatus.value]?.icon || '·')
const statusTitle = computed(() => {
  const config = STATUS_CONFIG[currentStatus.value]
  return config ? t(config.titleKey) : t('refundStatus.statusUnknown')
})
const statusDesc = computed(() => {
  const config = STATUS_CONFIG[currentStatus.value]
  return config ? t(config.descKey) : ''
})

const canCancel = computed(() => ['pending', 'reviewing'].includes(currentStatus.value))

const ACTION_KEY_MAP: Record<string, string> = {
  create: 'refundStatus.actionCreate',
  evidence_upload: 'refundStatus.actionEvidenceUpload',
  review: 'refundStatus.actionReview',
  cancel: 'refundStatus.actionCancel',
  auto_retry: 'refundStatus.actionAutoRetry',
}

function actionLabel(action: string): string {
  const key = ACTION_KEY_MAP[action]
  return key ? t(key) : action
}

function isActive(item: TimelineEntry): boolean {
  return item.action === 'create' && currentStatus.value === 'pending'
}

function isRejected(item: TimelineEntry): boolean {
  return item.action === 'review' && currentStatus.value === 'rejected'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function createRipple(e: MouseEvent, target: HTMLElement) {
  const ripple = document.createElement('span')
  const rect = target.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  ripple.style.width = ripple.style.height = size + 'px'
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px'
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px'
  ripple.className = 'ripple-effect'
  target.appendChild(ripple)
  setTimeout(() => ripple.remove(), 600)
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as v;

// 设计令牌
v.$text-secondary: var(--el-text-color-secondary);
v.$text-primary: var(--el-text-color-primary);

.refund-status {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-radius: var(--global-border-radius);

  &.status-pending, &.status-reviewing {
    background: var(--el-color-primary-light-9);
    border: var(--unified-border);

    .status-icon { background: var(--color-blue-1890ff); }
  }

  &.status-approved, &.status-completed, &.status-processing {
    background: var(--el-color-success-light-9);
    border: var(--unified-border);

    .status-icon { background: var(--el-color-success); }
  }

  &.status-rejected, &.status-failed {
    background: var(--el-color-danger-light-9);
    border: var(--unified-border);

    .status-icon { background: var(--el-color-danger); }
  }

  &.status-cancelled {
    background: var(--color-black-4);
    border: var(--unified-border);

    .status-icon { background: var(--el-text-color-placeholder); }
  }

  .status-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-bg-color);
    font-size: 24px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .status-info {
    flex: 1;
  }

  .status-title {
    font-size: 18px;
    font-weight: 800;
    color: v.$text-primary;
    margin-bottom: 4px;
  }

  .status-desc {
    font-size: 13px;
    color: v.$text-secondary;
  }
}

.timeline {
  .timeline-title {
    font-size: 14px;
    font-weight: 800;
    margin: 0 0 16px;
    color: v.$text-primary;
  }

  .timeline-list {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 11px;
      top: 16px;
      bottom: 16px;
      width: 2px;
      background: var(--el-border-color);
    }
  }

  .timeline-item {
    position: relative;
    padding-left: 36px;
    padding-bottom: 20px;

    &:last-child {
      padding-bottom: 0;
    }

    .timeline-dot {
      position: absolute;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--el-color-success);
      color: var(--el-bg-color);
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-base);
    }

    &.rejected .timeline-dot {
      background: var(--el-color-danger);
    }

    &.active .timeline-dot {
      background: var(--color-blue-1890ff);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .timeline-action {
      font-size: 14px;
      font-weight: 700;
      color: v.$text-primary;
      margin-bottom: 4px;
    }

    .timeline-time {
      font-size: 12px;
      color: v.$text-secondary;
      margin-bottom: 4px;
    }

    .timeline-note {
      font-size: 13px;
      color: v.$text-primary;
      background: var(--color-black-3);
      padding: 6px 10px;
      border-radius: var(--global-border-radius);
      margin-top: 4px;
    }

    .timeline-operator {
      font-size: 11px;
      color: v.$text-secondary;
      margin-top: 4px;
    }
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
}

.evidence-section {
  .section-title {
    font-size: 14px;
    font-weight: 800;
    margin: 0 0 12px;
  }

  .evidence-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .evidence-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--color-black-3);
    border-radius: var(--global-border-radius);
    text-decoration: none;
    color: v.$text-primary;
    transition: background 0.2s;

    &:hover {
      background: var(--color-black-6);
    }

    .evidence-icon {
      font-size: 18px;
    }

    .evidence-name {
      flex: 1;
      font-size: 13px;
    }

    .evidence-size {
      font-size: 11px;
      color: v.$text-secondary;
    }
  }
}

.actions {
  .cancel-btn {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 44px;
    border-radius: var(--global-border-radius);
    background: transparent;
    color: var(--el-color-danger);
    border: var(--unified-border);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;

    .btn-text {
      position: relative;
      z-index: calc(var(--z-base) + 1);
    }

    &:hover {
      background: var(--el-color-danger);
      color: var(--el-bg-color);
    }
  }
}
</style>
