<template>
  <div class="login-behavior">
    <div class="behavior-header">
      <h3 class="behavior-title">{{ t('settings.loginBehavior.title') }}</h3>
      <p class="behavior-desc">{{ t('settings.loginBehavior.description') }}</p>
    </div>

    <div v-if="!behavior" class="no-data">
      <el-empty :description="t('settings.loginBehavior.noData')" />
    </div>

    <template v-else>
      <div class="behavior-overview">
        <div class="overview-item">
          <span class="overview-label">{{ t('settings.loginBehavior.totalLogins') }}</span>
          <span class="overview-value">{{ behavior.totalLogins }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">{{ t('settings.loginBehavior.avgInterval') }}</span>
          <span class="overview-value">{{ formatInterval(behavior.avgLoginInterval) }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">{{ t('settings.loginBehavior.devices') }}</span>
          <span class="overview-value">{{ behavior.commonDevices.length }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">{{ t('settings.loginBehavior.locations') }}</span>
          <span class="overview-value">{{ behavior.commonLocations.length }}</span>
        </div>
      </div>

      <div class="behavior-section">
        <h4>{{ t('settings.loginBehavior.loginTime') }}</h4>
        <div class="time-chart">
          <div class="chart-bar" v-for="hour in 24" :key="hour">
            <div
              class="bar-fill"
              :style="{ height: getHourHeight(hour - 1) + '%' }"
              :title="`${hour - 1}:00 - ${getHourCount(hour - 1)} 次`"
            ></div>
            <span class="bar-label">{{ hour - 1 }}</span>
          </div>
        </div>
        <div class="peak-hours" v-if="peakHours.length > 0">
          <span class="peak-label">{{ t('settings.loginBehavior.peakHours') }}:</span>
          <el-tag v-for="h in peakHours" :key="h.hour" size="small" class="peak-tag">
            {{ h.hour }}:00 ({{ h.count }})
          </el-tag>
        </div>
      </div>

      <div class="behavior-section">
        <h4>{{ t('settings.loginBehavior.commonDevices') }}</h4>
        <div class="device-list">
          <div v-if="behavior.commonDevices.length === 0" class="empty-list">
            {{ t('settings.loginBehavior.noDevices') }}
          </div>
          <div
            v-for="device in behavior.commonDevices"
            :key="device.deviceId"
            class="device-item"
          >
            <div class="device-icon">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="device-info">
              <span class="device-name">{{ device.deviceName }}</span>
              <span class="device-count">{{ t('settings.loginBehavior.loginCount', { count: device.loginCount }) }}</span>
            </div>
            <div class="device-status">
              <el-tag v-if="device.trusted" type="success" size="small">
                {{ t('settings.loginBehavior.trusted') }}
              </el-tag>
              <el-button v-else text size="small" @click="handleTrustDevice(device.deviceId)">
                {{ t('settings.loginBehavior.trust') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="behavior-section">
        <h4>{{ t('settings.loginBehavior.commonLocations') }}</h4>
        <div class="location-list">
          <div v-if="behavior.commonLocations.length === 0" class="empty-list">
            {{ t('settings.loginBehavior.noLocations') }}
          </div>
          <div
            v-for="(location, index) in behavior.commonLocations"
            :key="index"
            class="location-item"
          >
            <div class="location-icon">
              <el-icon><Location /></el-icon>
            </div>
            <div class="location-info">
              <span class="location-name">{{ formatLocation(location) }}</span>
              <span class="location-count">{{ t('settings.loginBehavior.loginCount', { count: location.loginCount }) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="behavior-analysis" v-if="analysis">
        <h4>{{ t('settings.loginBehavior.riskAnalysis') }}</h4>
        <div class="risk-meter">
          <div class="risk-bar">
            <div
              class="risk-fill"
              :style="{ width: analysis.riskScore + '%' }"
              :class="analysis.riskLevel"
            ></div>
          </div>
          <span class="risk-score" :class="analysis.riskLevel">
            {{ analysis.riskScore }}
          </span>
        </div>
        <div class="risk-level" :class="analysis.riskLevel">
          {{ t(`settings.loginBehavior.riskLevel.${analysis.riskLevel}`) }}
        </div>

        <div v-if="analysis.anomalies.length > 0" class="anomalies">
          <h5>{{ t('settings.loginBehavior.anomalies') }}</h5>
          <ul>
            <li v-for="(anomaly, index) in analysis.anomalies" :key="index">
              {{ anomaly }}
            </li>
          </ul>
        </div>

        <div v-if="analysis.recommendations.length > 0" class="recommendations">
          <h5>{{ t('settings.loginBehavior.recommendations') }}</h5>
          <ul>
            <li v-for="(rec, index) in analysis.recommendations" :key="index">
              {{ rec }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Monitor, Location } from '@element-plus/icons-vue'
import { LoginBehaviorService, type LoginBehavior, type BehaviorAnalysis } from '@/utils/loginBehaviorService'
import { DeviceService } from '@/utils/deviceService'

const { t } = useI18n()

const behavior = ref<LoginBehavior | null>(null)
const analysis = ref<BehaviorAnalysis | null>(null)

const peakHours = computed(() => {
  if (!behavior.value) return []
  return LoginBehaviorService.getMostCommonHours()
})

const getHourCount = (hour: number): number => {
  if (!behavior.value) return 0
  return behavior.value.commonHours.filter(h => h === hour).length
}

const getHourHeight = (hour: number): number => {
  if (!behavior.value || behavior.value.commonHours.length === 0) return 0
  const count = getHourCount(hour)
  const maxCount = Math.max(...Array.from({ length: 24 }, (_, i) => getHourCount(i)))
  return maxCount > 0 ? (count / maxCount) * 100 : 0
}

const formatInterval = (ms: number): string => {
  if (!ms) return '-'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return t('settings.loginBehavior.days', { count: days })
  }
  return t('settings.loginBehavior.hours', { count: hours })
}

const formatLocation = (location: { country?: string; region?: string; city?: string }): string => {
  const parts = [location.city, location.region, location.country].filter(Boolean)
  return parts.join(', ') || t('settings.loginBehavior.unknown')
}

const handleTrustDevice = (deviceId: string) => {
  LoginBehaviorService.markDeviceTrusted(deviceId)
  loadData()
}

const loadData = () => {
  behavior.value = LoginBehaviorService.getBehavior()

  if (behavior.value) {
    const currentDeviceId = DeviceService.getDeviceId() || ''
    analysis.value = LoginBehaviorService.analyzeBehavior(currentDeviceId)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.login-behavior {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.behavior-header {
  margin-bottom: 20px;

  .behavior-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .behavior-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.no-data {
  padding: 40px 0;
}

.behavior-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.overview-item {
  text-align: center;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);

  .overview-label {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }

  .overview-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--el-color-primary);
  }
}

.behavior-section {
  margin-bottom: 24px;

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--el-text-color-primary);
  }
}

.time-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 80px;
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  margin-bottom: 12px;

  .chart-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;

    .bar-fill {
      width: 100%;
      background: var(--el-color-primary-light-5);
      border-radius: var(--global-border-radius) 2px 0 0;
      transition: height 0.3s;
      cursor: pointer;

      &:hover {
        background: var(--el-color-primary);
      }
    }

    .bar-label {
      font-size: 10px;
      color: var(--el-text-color-placeholder);
      margin-top: 4px;
    }
  }
}

.peak-hours {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .peak-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .peak-tag {
    margin: 0;
  }
}

.device-list, .location-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-list {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.device-item, .location-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.device-icon, .location-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: var(--global-border-radius);
}

.device-info, .location-info {
  flex: 1;

  .device-name, .location-name {
    display: block;
    font-size: 14px;
    color: var(--el-text-color-primary);
    margin-bottom: 2px;
  }

  .device-count, .location-count {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.behavior-analysis {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);

  h4 {
    margin-bottom: 16px;
  }

  h5 {
    font-size: 13px;
    font-weight: 500;
    margin: 12px 0 8px;
    color: var(--el-text-color-primary);
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      margin-bottom: 4px;
    }
  }
}

.risk-meter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;

  .risk-bar {
    flex: 1;
    height: 8px;
    background: var(--el-fill-color);
    border-radius: var(--global-border-radius);
    overflow: hidden;

    .risk-fill {
      height: 100%;
      transition: width 0.3s;

      &.low { background: var(--el-color-success); }
      &.medium { background: var(--el-color-warning); }
      &.high { background: var(--el-color-danger); }
      &.critical { background: var(--el-color-danger-dark-2); }
    }
  }

  .risk-score {
    font-size: 20px;
    font-weight: 600;

    &.low { color: var(--el-color-success); }
    &.medium { color: var(--el-color-warning); }
    &.high { color: var(--el-color-danger); }
    &.critical { color: var(--el-color-danger-dark-2); }
  }
}

.risk-level {
  font-size: 14px;
  font-weight: 500;

  &.low { color: var(--el-color-success); }
  &.medium { color: var(--el-color-warning); }
  &.high { color: var(--el-color-danger); }
  &.critical { color: var(--el-color-danger-dark-2); }
}

.anomalies {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-color-warning-light-9);
  border-radius: var(--global-border-radius);
}

.recommendations {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-color-info-light-9);
  border-radius: var(--global-border-radius);
}
</style>
