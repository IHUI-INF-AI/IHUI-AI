<template>
  <section id="contact" class="contact-section">
    <header class="contact-hero ihui-ai-fade-in-top-animation">
      <div class="section-label">CONTACT</div>
      <h2 class="contact-title">{{ t('footer.contactUs') }}</h2>
      <p class="contact-subtitle">{{ t('aboutUs.heroSubtitle') }}</p>
    </header>

    <div class="contact-info-section">
      <div class="contact-cards">
        <div class="contact-card">
          <div class="card-icon">
            <el-icon :size="24"><OfficeBuilding /></el-icon>
          </div>
          <div class="card-content">
            <h3>{{ t('footer.companyName') }}</h3>
          </div>
        </div>
        <div class="contact-card">
          <div class="card-icon">
            <el-icon :size="24"><Location /></el-icon>
          </div>
          <div class="card-content">
            <h3>{{ t('footer.addressLabel') }}</h3>
            <p>{{ t('footer.addressLine1') }}</p>
          </div>
        </div>
        <div class="contact-card">
          <div class="card-icon">
            <el-icon :size="24"><Phone /></el-icon>
          </div>
          <div class="card-content">
            <h3>{{ getSplit('footer.companyContact', 0) }}</h3>
            <p>{{ getSplit('footer.companyContact', 1) }}</p>
          </div>
        </div>
        <div class="contact-card">
          <div class="card-icon">
            <el-icon :size="24"><Message /></el-icon>
          </div>
          <div class="card-content">
            <h3>{{ getSplit('footer.companyEmail', 0) }}</h3>
            <p>{{ getSplit('footer.companyEmail', 1) }}</p>
            <p>{{ t('footer.companyEmail2') }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OfficeBuilding, Location, Phone, Message } from '@/lib/lucide-fallback'
import { replaceAtSymbol } from '@/utils/stringUtils'

const { t } = useI18n()

const getSplit = (key: string, index: number): string => {
  const v = t(key) as unknown
  const s = typeof v === 'string' ? v : ''
  const parts = s.split(':')

  if (index === 0) {
    return parts[0] ?? ''
  }

  if (index === 1) {
    return replaceAtSymbol(parts[1]?.split('|')[0] ?? '')
  }

  if (index === 2) {
    return replaceAtSymbol(parts[1]?.split('|')[1] ?? '')
  }

  return ''
}
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.contact-section {
  scroll-margin-top: 80px;
  padding: 64px 0 80px;
  border-top: var(--unified-border);

  @include bp.min-width(tablet) {
    padding: 96px 0 120px;
  }
}

.section-label {
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: 800;
  letter-spacing: 4px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--el-border-color-extra-light);
    margin-left: 20px;
  }
}

.contact-hero {
  margin-bottom: 48px;

  .contact-title {
    font-size: clamp(32px, 6vw, 56px);
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1;
    margin: 0 0 16px;
    color: var(--el-text-color-primary);
  }

  .contact-subtitle {
    font-size: 16px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
    max-width: 600px;
    margin: 0;
  }
}

.contact-info-section {
  .contact-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
  }

  .contact-card {
    background: var(--el-fill-color-extra-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 24px 20px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    transition: all 0.3s ease;

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      transform: translateY(-4px);
      box-shadow: var(--global-box-shadow);
    }

    .card-icon {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: var(--global-border-radius);
      background: var(--el-color-primary-light-9);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--el-color-primary);
    }

    .card-content {
      flex: 1;
      min-width: 0;

      h3 {
        font-size: 13px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      p {
        font-size: 14px;
        color: var(--el-text-color-primary);
        line-height: 1.6;
        margin: 0;

        & + p {
          margin-top: 4px;
        }
      }
    }
  }
}
</style>
