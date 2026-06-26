<template>
  <div class="contact-us-page">
    <div class="story-bg">
      <div class="gradient-layer"></div>
      <div class="noise-texture"></div>
    </div>

    <div class="container">
      <nav class="story-nav ihui-ai-fade-in-top-animation">
        <el-button link @click="goHome" class="back-link">
          <el-icon><ArrowLeft /></el-icon> {{ t('common.portalNav.protocolExit') }}
        </el-button>
        <span class="version-tag">CONTACT</span>
      </nav>

      <header class="story-hero ihui-ai-fade-in-top-animation">
        <h1 class="reveal-text">{{ t('footer.contactUs') }}</h1>
        <p class="mission-statement">{{ t('aboutUs.heroSubtitle') }}</p>
      </header>

      <section class="contact-info-section ihui-ai-fade-in-top-animation">
        <div class="section-label">CONTACT INFO</div>
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
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, OfficeBuilding, Location, Phone, Message } from '@/lib/lucide-fallback'
import { replaceAtSymbol } from '@/utils/stringUtils'

const router = useRouter()
const { t } = useI18n()

const goHome = () => router.push('/')
const _goToRoute = (path: string) => router.push(path)

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

.contact-us-page {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.story-bg {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);

  .gradient-layer {
    position: absolute;
    top: -20%;
    right: -10%;
    width: 80%;
    height: 80%;
    background: rgb(var(--el-color-primary-rgb), 0.015);
    filter: blur(100px);
  }

  .noise-texture {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.05;
    pointer-events: none;
  }
}

.container {
  position: relative;
  z-index: var(--z-base);
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 40px;

  @include bp.tablet-down {
    padding: 0 24px;
  }
}

.story-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 0;

  .back-link {
    color: var(--el-text-color-secondary);
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 800;

    &:hover {
      color: var(--el-text-color-primary);
    }
  }

  .version-tag {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    border: var(--unified-border);
    padding: 2px 8px;
  }
}

.story-hero {
  padding: 80px 0 120px;

  h1 {
    font-size: clamp(40px, 8vw, 80px);
    font-weight: 900;
    letter-spacing: -4px;
    line-height: 0.9;
    margin-bottom: 24px;
    color: var(--el-text-color-primary);
  }

  .mission-statement {
    font-size: 20px;
    color: var(--el-text-color-regular);
    max-width: 600px;
    line-height: 1.6;
  }
}

.section-label {
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: 800;
  letter-spacing: 4px;
  margin-bottom: 40px;
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

.contact-info-section {
  margin-bottom: 160px;

  .contact-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 24px;
  }

  .contact-card {
    background: var(--el-fill-color-extra-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 28px 24px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    transition: border-color 0.3s ease, transform 0.3s ease;

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      
      }

    .card-icon {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
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
        font-size: 14px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        margin: 0 0 8px;
      }

      p {
        font-size: 15px;
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

.story-footer {
  padding: 80px 0;
  border-top: var(--unified-border);

  .quick-nav {
    display: flex;
    justify-content: center;
    gap: 60px;

    button {
      background: none;
      border: none;
      color: var(--el-text-color-placeholder);
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      cursor: pointer;
      transition: color 0.3s;

      &:hover {
        color: var(--el-text-color-primary);
      }
    }
  }
}
</style>
