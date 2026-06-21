<template>
  <div class="third-party-login">
    <div class="divider">
      <span class="divider-text">{{ t('login.thirdParty.or') }}</span>
    </div>

    <div class="third-party-buttons">


      <!-- 支付宝登录 -->
      <el-button
        class="third-party-btn alipay-btn"
        @click="handleAlipayLogin"
      >
        <div class="btn-content">
          <img src="/images/loginSANFANG/支付宝支付.svg" :alt="t('login.thirdParty.alipay')" class="btn-icon" loading="lazy" />
          <span>{{ t('login.thirdParty.alipayLogin') }}</span>
        </div>
      </el-button>

      <!-- 飞书登录 -->
      <el-button
        class="third-party-btn feishu-btn"
        @click="handleFeishuLogin"
      >
        <div class="btn-content">
          <img src="/images/loginSANFANG/飞书.svg" :alt="t('login.thirdParty.feishu')" class="btn-icon" loading="lazy" />
          <span>{{ t('login.thirdParty.feishuLogin') }}</span>
        </div>
      </el-button>
    </div>

    <!-- 第三方登录说明 -->
    <div class="third-party-notice">
      <p class="notice-text">
        {{ t('login.thirdParty.notice') }}
        <el-button type="primary" link @click="showPrivacyPolicy">{{
          t('login.thirdParty.privacyPolicy')
        }}</el-button>
        {{ t('login.agreement.and') }}
        <el-button type="primary" link @click="showTermsOfService">{{
          t('login.thirdParty.termsOfService')
        }}</el-button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ALIPAY_AUTH_URL } from '@/constants/alipay'
import { FEISHU_AUTH_URL } from '@/constants/feishu'

const { t } = useI18n()

/** 支付宝登录：直接跳转官方授权页 */
const handleAlipayLogin = () => {
  window.location.href = ALIPAY_AUTH_URL
}

/** 飞书登录：固定跳转官方授权页 */
const handleFeishuLogin = () => {
  window.location.href = FEISHU_AUTH_URL
}

// 显示隐私政策
const showPrivacyPolicy = () => {
  // 打开隐私政策页面
  window.open('/privacy-policy', '_blank')
}

// 显示服务条款
const showTermsOfService = () => {
  // 打开服务条款页面
  window.open('/terms-of-service', '_blank')
}

</script>

<style scoped lang="scss">
.third-party-login {
  margin-top: 32px;
}

.divider {
  position: relative;
  text-align: center;
  margin-bottom: 24px;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--border-unified-color);
  }

  .divider-text {
    background-color: var(--el-bg-color);
    padding: 0 16px;
    color: var(--el-text-color-placeholder);
    font-size: 14px;
  }
}

.third-party-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.third-party-btn {
  width: 100%;
  height: 44px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background-color: var(--el-bg-color);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: var(--el-border-color-darker);
  }

  .btn-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
  }

  .btn-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  span {
    font-size: 14px;
    font-weight: 500;
  }
}

.alipay-btn {
  &:hover {
    border-color: var(--color-brand-blue);
    color: var(--color-brand-blue);
  }
}

.feishu-btn {
  &:hover {
    border-color: var(--color-brand-blue-2);
    color: var(--color-brand-blue-2);
  }
}

.third-party-notice {
  margin-top: 24px;
  text-align: center;

  .notice-text {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    line-height: 1.5;
    margin: 0;

    .el-button {
      font-size: 12px;
      padding: 0;
      height: auto;
      vertical-align: baseline;
    }
  }
}

@media (width <= 768px) {
  .third-party-login {
    margin-top: 24px;
  }

  .third-party-btn {
    height: 40px;

    .btn-icon {
      width: 18px;
      height: 18px;
    }

    span {
      font-size: 13px;
    }
  }
}

// 暗色模式适配
:global(html.dark) {
  .divider-text {
    background-color: var(--el-bg-color);
  }

  .third-party-btn {
    background-color: var(--el-bg-color);
    border-color: var(--el-border-color);
  }
}
</style>
