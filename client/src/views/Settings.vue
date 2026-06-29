<template>
  <div class="settings-page-root">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${scrollProgress})` }"></div>

    <!-- 深度背景系统 -->
    <div class="settings-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
    </div>

    <div class="settings-container">
      <!-- 页面头部：左对齐、精密灰度、空气感 -->
      <header class="page-header scroll-reveal" data-animation="fadeInUp">
        <div class="page-header__top">
          <button
            type="button"
            class="page-header__nav-btn ripple-btn"
            @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); goBack() }"
          >
            <el-icon><ArrowLeft /></el-icon>
            <span>{{ t('settings.back') }}</span>
          </button>
          <button
            type="button"
            class="page-header__nav-btn ripple-btn"
            @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); goToUser() }"
          >
            <span>{{ t('settings.userCenter') }}</span>
          </button>
        </div>
        <div class="page-header__title-block">
          <span class="page-header__badge">
            <span class="page-header__badge-dot" aria-hidden="true"></span>
            <span class="page-header__badge-text font-edix">Settings</span>
          </span>
          <h1 class="page-header__title">{{ t('settings.page.title') }}</h1>
          <p class="page-header__subtitle">{{ t('settings.page.subtitle') }}</p>
        </div>
      </header>

      <!-- 设置内容 -->
      <div class="settings-content">
        <!-- 个人信息 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="100"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><User /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.personal.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.personal.desc') }}</p>
            </div>
            <span class="section-idx">SEC_01</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.avatar') }}</div>
                <div class="setting-description">{{ t('settings.desc.avatar') }}</div>
              </div>
              <div class="setting-control">
                <div class="avatar-upload">
                  <img
                    :src="userInfo.avatar || defaultAvatar"
                    :alt="t('settings.labels.avatar')"
                    class="avatar-preview"
                    loading="lazy"
                  />
                  <input
                    id="avatar-upload"
                    name="avatar-upload"
                    type="file"
                    ref="avatarInput"
                    @change="handleAvatarChange"
                    accept="image/*"
                    style="display: none"
                  />
                  <button
                    class="upload-btn ripple-btn"
                    @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); triggerAvatarUpload() }"
                  >
                    {{ t('settings.actions.changeAvatar') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.nickname') }}</div>
                <div class="setting-description">{{ t('settings.desc.nickname') }}</div>
              </div>
              <div class="setting-control">
                <input
                  id="user-nickname"
                  name="nickname"
                  v-model="userInfo.nickname"
                  class="setting-input"
                  :placeholder="t('settings.placeholders.nickname')"
                  @blur="updateUserInfoData"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.email') }}</div>
                <div class="setting-description">{{ t('settings.desc.email') }}</div>
              </div>
              <div class="setting-control">
                <input
                  id="user-email"
                  name="email"
                  v-model="userInfo.email"
                  type="email"
                  class="setting-input"
                  :placeholder="t('settings.placeholders.email')"
                  @blur="updateUserInfoData"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.phone') }}</div>
                <div class="setting-description">{{ t('settings.desc.phone') }}</div>
              </div>
              <div class="setting-control">
                <input
                  id="user-phone"
                  name="phone"
                  v-model="userInfo.phone"
                  type="tel"
                  class="setting-input"
                  :placeholder="t('settings.placeholders.phone')"
                  @blur="updateUserInfoData"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 我的服务 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="120"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Service /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.services.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.services.desc') }}</p>
            </div>
            <span class="section-idx">SEC_01A</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.commissionPlan') }}</div>
                <div class="setting-description">{{ t('settings.desc.commissionPlan') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/commission/plan').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.withdrawRecords') }}</div>
                <div class="setting-description">{{ t('settings.desc.withdrawRecords') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/withdraw/records').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.chatHistory') }}</div>
                <div class="setting-description">{{ t('settings.desc.chatHistory') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/chat-history').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.statistics') }}</div>
                <div class="setting-description">{{ t('settings.desc.statistics') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/statistics').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 快捷导航 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="125"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Link /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.navigation.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.navigation.desc') }}</p>
            </div>
            <span class="section-idx">SEC_01B</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.editProfile') }}</div>
                <div class="setting-description">{{ t('settings.desc.editProfile') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/edit-profile').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.businessLicense') }}</div>
                <div class="setting-description">{{ t('settings.desc.businessLicense') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/business-license').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.icpRecord') }}</div>
                <div class="setting-description">{{ t('settings.desc.icpRecord') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/icp-record').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.modelRecord') }}</div>
                <div class="setting-description">{{ t('settings.desc.modelRecord') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/model-record').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.usageRules') }}</div>
                <div class="setting-description">{{ t('settings.desc.usageRules') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/usage-rules').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.appPermission') }}</div>
                <div class="setting-description">{{ t('settings.desc.appPermission') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/app-permission').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.myAIModel') }}</div>
                <div class="setting-description">{{ t('settings.desc.myAIModel') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/my-ai-model').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.recruitment') }}</div>
                <div class="setting-description">{{ t('settings.desc.recruitment') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/recruitment').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.myCompany') }}</div>
                <div class="setting-description">{{ t('settings.desc.myCompany') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/my-company').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.feedback') }}</div>
                <div class="setting-description">{{ t('settings.desc.feedback') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/feedback').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.about') }}</div>
                <div class="setting-description">{{ t('settings.desc.about') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/about').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.privacySettings') }}</div>
                <div class="setting-description">{{ t('settings.desc.privacySettings') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); router.push('/privacy-settings').catch(() => {}) }"
                >
                  {{ t('settings.actions.go') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 安全评分 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="150"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Lock /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.securityScore.title') }}</h2>
              <p class="section-description">{{ t('settings.securityScore.description') }}</p>
            </div>
            <span class="section-idx">SEC_02</span>
          </div>
          <div class="settings-card">
            <SecurityScore />
          </div>
        </div>

        <!-- 账户安全 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="200"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Lock /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.security.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.security.desc') }}</p>
            </div>
            <span class="section-idx">SEC_03</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.changePassword') }}</div>
                <div class="setting-description">{{ t('settings.desc.changePassword') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); showPasswordDialog = true }"
                >
                  {{ t('settings.actions.changePassword') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.loginNotification') }}</div>
                <div class="setting-description">{{ t('settings.desc.loginNotification') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="login-notification"
                    name="loginNotification"
                    type="checkbox"
                    v-model="securitySettings.loginNotification"
                    @change="updateSecuritySettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.loginDuration') }}</div>
                <div class="setting-description">{{ t('settings.desc.loginDuration') }}</div>
              </div>
              <div class="setting-control">
                <select
                  id="login-duration"
                  name="loginDuration"
                  v-model="loginDuration"
                  @change="updateLoginDuration"
                  class="setting-select"
                >
                  <option value="7d">{{ t('settings.options.loginDuration.7d') }}</option>
                  <option value="30d">{{ t('settings.options.loginDuration.30d') }}</option>
                  <option value="90d">{{ t('settings.options.loginDuration.90d') }}</option>
                  <option value="365d">{{ t('settings.options.loginDuration.365d') }}</option>
                  <option value="permanent">
                    {{ t('settings.options.loginDuration.permanent') }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- 通知设置 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="300"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Bell /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.notifications.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.notifications.desc') }}</p>
            </div>
            <span class="section-idx">SEC_04</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.messageNotification') }}</div>
                <div class="setting-description">{{ t('settings.desc.messageNotification') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="message-notification"
                    name="messageNotification"
                    type="checkbox"
                    v-model="messageNotification"
                    @change="updateMessageNotification"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.notificationEnabled') }}</div>
                <div class="setting-description">{{ t('settings.desc.notificationEnabled') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="notification-enabled"
                    name="notificationEnabled"
                    type="checkbox"
                    v-model="notificationSettings.enabled"
                    @change="updateNotificationSettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.emailNotification') }}</div>
                <div class="setting-description">{{ t('settings.desc.emailNotification') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="notification-email"
                    name="notificationEmail"
                    type="checkbox"
                    v-model="notificationSettings.emailEnabled"
                    @change="updateNotificationSettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.pushNotification') }}</div>
                <div class="setting-description">{{ t('settings.desc.pushNotification') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="notification-push"
                    name="notificationPush"
                    type="checkbox"
                    v-model="notificationSettings.pushEnabled"
                    @change="updateNotificationSettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.notificationSound') }}</div>
                <div class="setting-description">{{ t('settings.desc.notificationSound') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="notification-sound"
                    name="notificationSound"
                    type="checkbox"
                    v-model="notificationSettings.soundEnabled"
                    @change="updateNotificationSettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 隐私设置 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="400"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Hide /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.privacy.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.privacy.desc') }}</p>
            </div>
            <span class="section-idx">SEC_05</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.profileVisibility') }}</div>
                <div class="setting-description">{{ t('settings.desc.profileVisibility') }}</div>
              </div>
              <div class="setting-control">
                <select
                  id="profile-visibility"
                  name="publicProfile"
                  v-model="privacySettings.publicProfile"
                  @change="updatePrivacySettingsData"
                  class="setting-select"
                >
                  <option :value="true">{{ t('settings.options.profileVisibility.public') }}</option>
                  <option :value="false">
                    {{ t('settings.options.profileVisibility.private') }}
                  </option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.showEmail') }}</div>
                <div class="setting-description">{{ t('settings.desc.showEmail') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="show-email"
                    name="showEmail"
                    type="checkbox"
                    v-model="privacySettings.showEmail"
                    @change="updatePrivacySettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.showPhone') }}</div>
                <div class="setting-description">{{ t('settings.desc.showPhone') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="show-phone"
                    name="showPhone"
                    type="checkbox"
                    v-model="privacySettings.showPhone"
                    @change="updatePrivacySettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.activityTracking') }}</div>
                <div class="setting-description">{{ t('settings.desc.activityTracking') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="activity-tracking"
                    name="activityTracking"
                    type="checkbox"
                    v-model="privacySettings.activityTracking"
                    @change="updatePrivacySettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 应用设置 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="500"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Setting /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.app.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.app.desc') }}</p>
            </div>
            <span class="section-idx">SEC_06</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.themeMode') }}</div>
                <div class="setting-description">{{ t('settings.desc.themeMode') }}</div>
              </div>
              <div class="setting-control">
                <select
                  id="app-theme"
                  name="appTheme"
                  v-model="appSettings.theme"
                  @change="updateAppSettingsData"
                  class="setting-select"
                >
                  <option value="light">{{ t('settings.options.themeMode.light') }}</option>
                  <option value="dark">{{ t('settings.options.themeMode.dark') }}</option>
                  <option value="auto">{{ t('settings.options.themeMode.auto') }}</option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.language') }}</div>
                <div class="setting-description">{{ t('settings.desc.language') }}</div>
              </div>
              <div class="setting-control">
                <select
                  id="app-language"
                  name="appLanguage"
                  v-model="appSettings.language"
                  @change="updateAppSettingsData"
                  class="setting-select"
                >
                  <option value="zh-CN">{{ t('settings.options.language.zh-CN') }}</option>
                  <option value="zh-TW">{{ t('settings.options.language.zh-TW') }}</option>
                  <option value="en">{{ t('settings.options.language.en') }}</option>
                  <option value="ja">{{ t('settings.options.language.ja') }}</option>
                  <option value="ko">{{ t('settings.options.language.ko') }}</option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.autoSave') }}</div>
                <div class="setting-description">{{ t('settings.desc.autoSave') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="auto-save"
                    name="autoSave"
                    type="checkbox"
                    v-model="appSettings.autoSave"
                    @change="updateAppSettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.mouseFollower') }}</div>
                <div class="setting-description">{{ t('settings.desc.mouseFollower') }}</div>
              </div>
              <div class="setting-control">
                <label class="switch">
                  <input
                    id="mouse-follower"
                    name="mouseFollower"
                    type="checkbox"
                    v-model="appSettings.mouseFollower"
                    @change="updateAppSettingsData"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 主题预设 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="525"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Brush /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('themePreset.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.themePresets.desc') }}</p>
            </div>
            <span class="section-idx">SEC_06B</span>
          </div>
          <div class="settings-card theme-preset-section">
            <ThemePresetPanel />
          </div>
        </div>

        <!-- 主题备份 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="530"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><FolderOpened /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('themeBackup.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.themeBackup.desc') }}</p>
            </div>
            <span class="section-idx">SEC_06C</span>
          </div>
          <div class="settings-card theme-preset-section">
            <ThemeBackupPanel />
          </div>
        </div>

        <!-- 主题快捷键 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="535"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Position /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('themeShortcut.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.themeShortcut.desc') }}</p>
            </div>
            <span class="section-idx">SEC_06D</span>
          </div>
          <div class="settings-card theme-preset-section">
            <ThemeShortcutPanel />
          </div>
        </div>

        <!-- 主题过渡动画 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="540"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><MagicStick /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('themeTransition.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.themeTransition.desc') }}</p>
            </div>
            <span class="section-idx">SEC_06E</span>
          </div>
          <div class="settings-card theme-preset-section">
            <ThemeTransitionPanel />
          </div>
        </div>

        <!-- 主题同步状态 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="545"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Cloudy /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('themeSync.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.themeSync.desc') }}</p>
            </div>
            <span class="section-idx">SEC_06F</span>
          </div>
          <div class="settings-card theme-preset-section">
            <ThemeSyncIndicator />
            <SyncHistoryPanel />
            <SyncSettingsPanel />
          </div>
        </div>

        <!-- 设备管理 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="500"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.deviceManagement.title') }}</h2>
              <p class="section-description">{{ t('settings.deviceManagement.description') }}</p>
            </div>
            <span class="section-idx">SEC_07</span>
          </div>
          <div class="settings-card">
            <DeviceManager />
          </div>
        </div>

        <!-- 安全日志 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="550"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.securityLog.title') }}</h2>
              <p class="section-description">{{ t('settings.securityLog.description') }}</p>
            </div>
            <span class="section-idx">SEC_08</span>
          </div>
          <div class="settings-card">
            <SecurityLog />
          </div>
        </div>

        <!-- 双因素认证 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="575"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Key /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.twoFactor.title') }}</h2>
              <p class="section-description">{{ t('settings.twoFactor.description') }}</p>
            </div>
            <span class="section-idx">SEC_09</span>
          </div>
          <div class="settings-card">
            <TwoFactorAuth />
          </div>
        </div>

        <!-- 登录历史 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="585"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.loginHistory.title') }}</h2>
              <p class="section-description">{{ t('settings.loginHistory.description') }}</p>
            </div>
            <span class="section-idx">SEC_10</span>
          </div>
          <div class="settings-card">
            <LoginHistory />
          </div>
        </div>

        <!-- 会话管理 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="595"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Connection /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sessionManagement.title') }}</h2>
              <p class="section-description">{{ t('settings.sessionManagement.description') }}</p>
            </div>
            <span class="section-idx">SEC_11</span>
          </div>
          <div class="settings-card">
            <SessionManager />
          </div>
        </div>

        <!-- 审计日志导出 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="598"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Download /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.auditExport.title') }}</h2>
              <p class="section-description">{{ t('settings.auditExport.description') }}</p>
            </div>
            <span class="section-idx">SEC_12</span>
          </div>
          <div class="settings-card">
            <AuditExport />
          </div>
        </div>

        <!-- IP白名单 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="599"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Filter /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.ipWhitelist.title') }}</h2>
              <p class="section-description">{{ t('settings.ipWhitelist.description') }}</p>
            </div>
            <span class="section-idx">SEC_13</span>
          </div>
          <div class="settings-card">
            <IPWhitelist />
          </div>
        </div>

        <!-- 安全通知中心 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="600"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><Bell /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.notificationCenter.title') }}</h2>
              <p class="section-description">{{ t('settings.notificationCenter.description') }}</p>
            </div>
            <span class="section-idx">SEC_14</span>
          </div>
          <div class="settings-card">
            <NotificationCenter />
          </div>
        </div>

        <!-- 登录行为分析 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="610"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><TrendCharts /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.loginBehavior.title') }}</h2>
              <p class="section-description">{{ t('settings.loginBehavior.description') }}</p>
            </div>
            <span class="section-idx">SEC_15</span>
          </div>
          <div class="settings-card">
            <LoginBehavior />
          </div>
        </div>

        <!-- 其他 -->
        <div
          class="settings-section glass scroll-reveal"
          data-animation="fadeInUp"
          data-delay="615"
        >
          <div class="section-header">
            <div class="section-icon">
              <el-icon><MoreFilled /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.other.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.other.desc') }}</p>
            </div>
            <span class="section-idx">SEC_16</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.contactSupport') }}</div>
                <div class="setting-description">{{ t('settings.desc.contactSupport') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); showContactDialog = true }"
                >
                  {{ t('settings.actions.contact') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.checkUpdate') }}</div>
                <div class="setting-description">{{ t('settings.desc.checkUpdate') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleCheckUpdate() }"
                  :disabled="isCheckingUpdate"
                >
                  {{ isCheckingUpdate ? t('settings.actions.checking') : t('settings.actions.checkUpdate') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.webVersion') }}</div>
                <div class="setting-description">{{ t('settings.desc.webVersion') }}</div>
              </div>
              <div class="setting-control">
                <span class="version-tag">v{{ appVersion }}</span>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.viewMiniapp') }}</div>
                <div class="setting-description">{{ t('settings.desc.viewMiniapp') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="action-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); showMiniappDialog = true }"
                >
                  {{ t('settings.actions.viewMiniapp') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 危险区域 -->
        <div
          class="settings-section glass danger-zone scroll-reveal"
          data-animation="fadeInUp"
          data-delay="600"
        >
          <div class="section-header">
            <div class="section-icon danger">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="section-info">
              <h2 class="section-title">{{ t('settings.sections.danger.title') }}</h2>
              <p class="section-description">{{ t('settings.sections.danger.desc') }}</p>
            </div>
            <span class="section-idx danger">DANGER</span>
          </div>

          <div class="settings-card">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.logout') }}</div>
                <div class="setting-description">{{ t('settings.desc.logout') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="danger-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleLogout() }"
                >
                  {{ t('settings.actions.logout') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.clearAllData') }}</div>
                <div class="setting-description">{{ t('settings.desc.clearAllData') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="danger-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); openClearDataDialog() }"
                >
                  {{ t('settings.actions.clearData') }}
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-label">{{ t('settings.labels.deleteAccount') }}</div>
                <div class="setting-description">{{ t('settings.desc.deleteAccount') }}</div>
              </div>
              <div class="setting-control">
                <button
                  class="danger-btn ripple-btn"
                  @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); openDeleteAccountDialog() }"
                >
                  {{ t('settings.actions.deleteAccount') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 修改密码对话框 -->
    <Transition name="dialog-fade">
      <div v-if="showPasswordDialog" class="dialog-overlay" @click="showPasswordDialog = false">
        <div class="dialog glass" @click.stop>
          <div class="dialog-header">
            <h3>{{ t('settings.dialogs.changePassword.title') }}</h3>
            <button @click="showPasswordDialog = false" class="close-btn">&times;</button>
          </div>
          <div class="dialog-content">
            <div class="form-group">
              <label>{{ t('settings.dialogs.changePassword.old') }}</label>
              <input
                id="old-password"
                name="oldPassword"
                v-model="passwordForm.oldPassword"
                type="password"
                class="form-input"
                :placeholder="t('settings.dialogs.changePassword.oldPlaceholder')"
              />
            </div>
            <div class="form-group">
              <label>{{ t('settings.dialogs.changePassword.new') }}</label>
              <input
                id="new-password"
                name="newPassword"
                v-model="passwordForm.newPassword"
                type="password"
                class="form-input"
                :placeholder="t('settings.dialogs.changePassword.newPlaceholder')"
                @input="updatePasswordStrength"
              />
              <div v-if="passwordForm.newPassword" class="password-strength">
                <div class="strength-bar">
                  <div
                    class="strength-fill"
                    :style="{
                      width: (passwordStrengthAnalysis.score / 7 * 100) + '%',
                      backgroundColor: passwordStrengthColor
                    }"
                  ></div>
                </div>
                <span class="strength-label" :style="{ color: passwordStrengthColor }">
                  {{ passwordStrengthLabel }}
                </span>
              </div>
              <div v-if="passwordStrengthAnalysis.suggestions.length > 0" class="password-suggestions">
                <span v-for="(suggestion, index) in passwordStrengthAnalysis.suggestions.slice(0, 3)" :key="index">
                  {{ suggestion }}
                </span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ t('settings.dialogs.changePassword.confirm') }}</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                v-model="passwordForm.confirmPassword"
                type="password"
                class="form-input"
                :placeholder="t('settings.dialogs.changePassword.confirmPlaceholder')"
              />
            </div>
          </div>
          <div class="dialog-footer">
            <button
              class="cancel-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); closePasswordDialog() }"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="confirm-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleChangePassword() }"
            >
              {{ t('settings.dialogs.changePassword.confirmAction') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 清除数据对话框 -->
    <Transition name="dialog-fade">
      <div v-if="showClearDataDialog" class="dialog-overlay" @click="closeClearDataDialog">
        <div class="dialog glass" @click.stop>
          <div class="dialog-header">
            <h3>{{ t('settings.dialogs.clearData.title') }}</h3>
            <button @click="closeClearDataDialog" class="close-btn">&times;</button>
          </div>
          <div class="dialog-content">
            <p>{{ t('settings.dialogs.clearData.tip') }}</p>
            <ul>
              <li>{{ t('settings.dialogs.clearData.items.chat') }}</li>
              <li>{{ t('settings.dialogs.clearData.items.settings') }}</li>
              <li>{{ t('settings.dialogs.clearData.items.favorites') }}</li>
              <li>{{ t('settings.dialogs.clearData.items.history') }}</li>
            </ul>
            <p>
              <strong>{{ t('settings.dialogs.clearData.warn') }}</strong>
            </p>
          </div>
          <div class="dialog-footer">
            <button
              class="cancel-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); closeClearDataDialog() }"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="danger-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); clearAllUserData() }"
            >
              {{ t('settings.dialogs.clearData.confirmAction') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除账户对话框 -->
    <Transition name="dialog-fade">
      <div v-if="showDeleteAccountDialog" class="dialog-overlay" @click="closeDeleteAccountDialog">
        <div class="dialog glass" @click.stop>
          <div class="dialog-header">
            <h3>{{ t('settings.dialogs.deleteAccount.title') }}</h3>
            <button @click="closeDeleteAccountDialog" class="close-btn">&times;</button>
          </div>
          <div class="dialog-content">
            <p>{{ t('settings.dialogs.deleteAccount.tip') }}</p>
            <p>
              <strong>{{ t('settings.dialogs.deleteAccount.warn') }}</strong>
            </p>
            <div class="form-group">
              <input
                id="delete-account-password"
                name="deleteAccountPassword"
                v-model="deleteAccountPassword"
                type="password"
                class="form-input"
                :placeholder="t('settings.dialogs.deleteAccount.placeholder')"
              />
            </div>
          </div>
          <div class="dialog-footer">
            <button
              class="cancel-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); closeDeleteAccountDialog() }"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="danger-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); deleteUserAccount() }"
            >
              {{ t('settings.dialogs.deleteAccount.confirmAction') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 联系客服对话框 -->
    <Transition name="dialog-fade">
      <div v-if="showContactDialog" class="dialog-overlay" @click="showContactDialog = false">
        <div class="dialog glass" @click.stop>
          <div class="dialog-header">
            <h3>{{ t('settings.dialogs.contact.title') }}</h3>
            <button @click="showContactDialog = false" class="close-btn">&times;</button>
          </div>
          <div class="dialog-content contact-dialog-content">
            <div class="contact-item">
              <el-icon><Service /></el-icon>
              <div>
                <div class="contact-label">{{ t('settings.dialogs.contact.email') }}</div>
                <div class="contact-value">support@aizhihuishe.com</div>
              </div>
            </div>
            <div class="contact-item">
              <el-icon><Phone /></el-icon>
              <div>
                <div class="contact-label">{{ t('settings.dialogs.contact.phone') }}</div>
                <div class="contact-value">400-888-8888</div>
              </div>
            </div>
            <div class="contact-item">
              <el-icon><Clock /></el-icon>
              <div>
                <div class="contact-label">{{ t('settings.dialogs.contact.hours') }}</div>
                <div class="contact-value">{{ t('settings.dialogs.contact.hoursValue') }}</div>
              </div>
            </div>
          </div>
          <div class="dialog-footer">
            <button
              class="confirm-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); showContactDialog = false }"
            >
              {{ t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 小程序二维码对话框 -->
    <Transition name="dialog-fade">
      <div v-if="showMiniappDialog" class="dialog-overlay" @click="showMiniappDialog = false">
        <div class="dialog glass" @click.stop>
          <div class="dialog-header">
            <h3>{{ t('settings.dialogs.miniapp.title') }}</h3>
            <button @click="showMiniappDialog = false" class="close-btn">&times;</button>
          </div>
          <div class="dialog-content miniapp-dialog-content">
            <img
              src="/images/common/miniapp-qr.png"
              :alt="t('settings.dialogs.miniapp.alt')"
              class="miniapp-qr-image"
              loading="lazy"
            />
            <p class="miniapp-tip">{{ t('settings.dialogs.miniapp.tip') }}</p>
          </div>
          <div class="dialog-footer">
            <button
              class="confirm-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); showMiniappDialog = false }"
            >
              {{ t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * Settings.vue - 系统设置页面 (Premium Industrial Edition)
 *
 * @description 高科技工业风格设置页面
 * @author Architecture Team
 */

import { ref, onMounted, nextTick, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getUserSettings } from '@/api/settings'
import { ArrowLeft, User, Lock, Bell, Setting, Warning, Hide, Monitor, Document, Key, Clock, Connection, Download, Filter, TrendCharts, Brush, FolderOpened, Position, MagicStick, Cloudy, Link, Service, MoreFilled, Phone } from '@element-plus/icons-vue'
import { useSettingsUserInfo } from '@/composables/settings/useSettingsUserInfo'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialog } from '@/composables/useLoginDialog'
import { useSettings } from '@aizhs/shared-logic'
import type { UserInfoData } from '@/api/user'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { useSettingsSecurity } from '@/composables/settings/useSettingsSecurity'
import { useSettingsNotifications } from '@/composables/settings/useSettingsNotifications'
import { useSettingsPrivacy } from '@/composables/settings/useSettingsPrivacy'
import { useSettingsApp } from '@/composables/settings/useSettingsApp'
import { useSettingsDanger } from '@/composables/settings/useSettingsDanger'
import DeviceManager from '@/components/settings/DeviceManager.vue'
import SecurityLog from '@/components/settings/SecurityLog.vue'
import TwoFactorAuth from '@/components/settings/TwoFactorAuth.vue'
import LoginHistory from '@/components/settings/LoginHistory.vue'
import SecurityScore from '@/components/settings/SecurityScore.vue'
import SessionManager from '@/components/settings/SessionManager.vue'
import AuditExport from '@/components/settings/AuditExport.vue'
import IPWhitelist from '@/components/settings/IPWhitelist.vue'
import NotificationCenter from '@/components/settings/NotificationCenter.vue'
import LoginBehavior from '@/components/settings/LoginBehavior.vue'
import ThemePresetPanel from '@/components/settings/ThemePresetPanel.vue'
import ThemeBackupPanel from '@/components/settings/ThemeBackupPanel.vue'
import ThemeShortcutPanel from '@/components/settings/ThemeShortcutPanel.vue'
import ThemeTransitionPanel from '@/components/settings/ThemeTransitionPanel.vue'
import ThemeSyncIndicator from '@/components/settings/ThemeSyncIndicator.vue'
import SyncHistoryPanel from '@/components/settings/SyncHistoryPanel.vue'
import SyncSettingsPanel from '@/components/settings/SyncSettingsPanel.vue'
import { analyzePassword, getPasswordStrengthColor, getPasswordStrengthLabel } from '@/utils/passwordStrength'
import type { PasswordAnalysis } from '@/utils/passwordStrength'

// ============ 高级动效系统 ============
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())
const scrollProgress = ref(0)

// 初始化滚动动画观察器
const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          const animation = el.dataset.animation || 'fadeInUp'

          setTimeout(() => {
            el.classList.add('scroll-animated', `animate-${animation}`)
          }, parseInt(delay))

          observedElements.value.add(el)
        }
      })
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  )

  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 滚动进度计算
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0
  })
}

// 涟漪点击效果
const createRipple = (e: MouseEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const ripple = document.createElement('span')
  const size = Math.max(rect.width, rect.height)

  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  ripple.classList.add('ripple-effect')

  el.appendChild(ripple)

  setTimeout(() => ripple.remove(), 600)
}

// Settings组件
const router = useRouter() as ReturnType<typeof useRouter> & {
  back: () => void
}
const route = useRoute()
const { t } = useI18n()
const { handleResult: _handleResult } = useOperationFeedback()

// shared-logic useSettings: cross-platform settings persistence
const _sharedSettings = useSettings()

// 消息通知开关
const messageNotification = ref(true)

// 初始化消息通知设置
const loadMessageNotification = () => {
  const saved = StorageManager.getItem<string>(STORAGE_KEYS.MESSAGE_NOTIFICATION)
  if (saved !== null) {
    messageNotification.value = saved === 'true'
  }
}

// 更新消息通知设置
const updateMessageNotification = () => {
  StorageManager.setItem(STORAGE_KEYS.MESSAGE_NOTIFICATION, String(messageNotification.value))
}

// 退出登录
const handleLogout = () => {
  ElMessageBox.confirm(t('settings.confirmLogout'), t('common.tip'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning',
  }).then(() => {
    StorageManager.removeItem(STORAGE_KEYS.TOKEN)
    StorageManager.removeItem(STORAGE_KEYS.USER_INFO)
    StorageManager.removeItem(STORAGE_KEYS.DATA)
    authStore.logout?.()
    // 弹窗形式：跳首页 + 弹出登录弹窗，不再跳 /login 路由
    router.push('/').then(() => {
      useLoginDialog().open('login')
    }).catch(() => {
      useLoginDialog().open('login')
    })
  }).catch(() => { /* 用户取消操作，无需处理 */ })
}

// 返回上一页
const goBack = () => {
  router.back()
}

// 跳转到个人中心
const goToUser = () => {
  router.push('/user').catch(() => {})
}

// 默认头像
const defaultAvatar = '/images/common/userIcon.svg'

// 使用 Composables
const authStore = useAuthStore()
const userInfoComposable = useSettingsUserInfo({ defaultAvatar })
const { userInfo, avatarInput, loadUserInfo, updateUserInfoData, triggerAvatarUpload, handleAvatarChange } =
  userInfoComposable

const securityComposable = useSettingsSecurity()
const {
  securitySettings,
  loginDuration,
  showPasswordDialog,
  passwordForm,
  LOGIN_DURATION_OPTIONS: _LOGIN_DURATION_OPTIONS,
  loadSecuritySettings: _loadSecuritySettings,
  updateSecuritySettingsData,
  updateLoginDuration,
  handleChangePassword,
  openPasswordDialog: _openPasswordDialog,
  closePasswordDialog,
} = securityComposable

// 密码强度检测
const passwordStrengthAnalysis = ref<PasswordAnalysis>({
  strength: 'weak',
  score: 0,
  length: 0,
  hasLowercase: false,
  hasUppercase: false,
  hasNumber: false,
  hasSpecialChar: false,
  suggestions: [],
})
const passwordStrengthColor = computed(() => getPasswordStrengthColor(passwordStrengthAnalysis.value.strength))
const passwordStrengthLabel = computed(() => getPasswordStrengthLabel(passwordStrengthAnalysis.value.strength, t))

const updatePasswordStrength = () => {
  passwordStrengthAnalysis.value = analyzePassword(passwordForm.newPassword || '')
}

const notificationsComposable = useSettingsNotifications()
const { notificationSettings, loadNotificationSettings: _loadNotificationSettings, updateNotificationSettingsData } =
  notificationsComposable

const privacyComposable = useSettingsPrivacy()
const { privacySettings, loadPrivacySettings: _loadPrivacySettings, updatePrivacySettingsData } = privacyComposable

const appComposable = useSettingsApp()
const { appSettings, mouseFollowerEnabled: _mouseFollowerEnabled, loadAppSettings: _loadAppSettings, updateAppSettingsData } =
  appComposable

const dangerComposable = useSettingsDanger()
const {
  showClearDataDialog,
  showDeleteAccountDialog,
  deleteAccountPassword,
  clearAllUserData,
  deleteUserAccount,
  openClearDataDialog,
  closeClearDataDialog,
  openDeleteAccountDialog,
  closeDeleteAccountDialog,
} = dangerComposable

// ============ 联系客服 ============
const showContactDialog = ref(false)

// ============ 检查更新 ============
const isCheckingUpdate = ref(false)
const appVersion = ref('1.0.0')
// 检查更新定时器引用，用于组件卸载时清理
let checkUpdateTimer: ReturnType<typeof setTimeout> | null = null

const handleCheckUpdate = () => {
  isCheckingUpdate.value = true
  checkUpdateTimer = setTimeout(() => {
    isCheckingUpdate.value = false
    ElMessage({
      message: t('settings.messages.latestVersion'),
      type: 'success',
    })
  }, 1500)
}

// ============ 小程序入口 ============
const showMiniappDialog = ref(false)

// 加载用户设置（后端未实现时 404，静默使用默认值，不抛出）
const loadUserSettings = async () => {
  try {
    const response = await getUserSettings().catch(() => null)
    if (!response) return
    const res = response as {
      code?: number
      data?: {
        notifications?: Record<string, unknown>
        privacy?: Record<string, unknown>
        preferences?: Record<string, unknown>
      }
    }
    if ((res.code === 200 || res.code === 0 || (res as { success?: boolean }).success === true) && res.data) {
      if (res.data.notifications) Object.assign(notificationSettings, res.data.notifications)
      if (res.data.privacy) Object.assign(privacySettings, res.data.privacy)
      if (res.data.preferences) Object.assign(appSettings, res.data.preferences)
    }
  } catch {
    // 404 或网络错误时静默使用默认设置，不打扰用户
  }
}

onMounted(() => {
  // 从 authStore 加载用户个人信息（头像、昵称等）
  const user = authStore.user as UserInfoData | null
  if (user) {
    loadUserInfo({
      avatar: user.avatar || '',
      nickname: user.nickname || '',
      email: user.email || '',
      phone: user.phone || '',
    })
  }

  loadUserSettings()
  loadMessageNotification()
  initScrollAnimations()

  // 初始化版本号
  appVersion.value = import.meta.env.VITE_APP_VERSION || '1.0.0'

  // 添加事件监听
  window.addEventListener('scroll', handleScroll, { passive: true })

  // 初始滚动进度计算
  handleScroll()

  // 检查是否强制修改密码
  if (route.query.force === '1' || String(StorageManager.getItem(STORAGE_KEYS.PASSWORD_EXPIRED) || '') === 'true') {
    StorageManager.removeItem(STORAGE_KEYS.PASSWORD_EXPIRED)
    nextTick(() => {
      _openPasswordDialog()
    })
  }
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null } })
cleanup.add(() => window.removeEventListener('scroll', handleScroll))
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })
cleanup.add(() => { if (checkUpdateTimer) { clearTimeout(checkUpdateTimer); checkUpdateTimer = null } })
</script>

<style scoped lang="scss">
@use '@/styles/breakpoints' as bp;

$bg-page: var(--el-bg-color-page);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--color-gray-333);

.settings-page-root {
  background: $bg-page;
  color: $text-main;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  font-family: var(--font-family-chinese);
  padding-top: 80px;
  padding-bottom: 60px;

}

// ============ 深度背景系统 ============
.settings-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(80px);
    opacity: 0.12;
    animation: floatOrb 15s ease-in-out infinite;

    &.orb-1 {
      width: 400px;
      height: 400px;
      top: 10%;
      right: 10%;
      background: rgba($brand-primary, 0.3);
    }

    &.orb-2 {
      width: 350px;
      height: 350px;
      bottom: 20%;
      left: 5%;
      background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
      animation-delay: -7s;
    }
  }

}

// ============ 滚动触发动画 ============
.scroll-reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: none;

  &.scroll-animated {
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============ 涟漪效果 ============
.ripple-btn {
  position: relative;
  overflow: hidden;
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(60px, 60px); }
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -20px) scale(1.05); }
  50% { transform: translate(-20px, 30px) scale(0.95); }
  75% { transform: translate(-30px, -10px) scale(1.02); }
}

@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

// ============ 玻璃态样式 ============
.glass {
  background: rgb(var(--el-fill-color-light-rgb, 250, 250, 252), 0.6);
  backdrop-filter: blur(24px);
  border: var(--unified-border);
}

// ============ 主容器 ============
.settings-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 56px;
  position: relative;
  z-index: var(--z-base);
}

// ============ 页面头部（精密灰度、左对齐、空气感）============
.page-header {
  text-align: left;
  margin-bottom: 40px;
  padding: 24px;
  border-bottom: var(--unified-border-bottom);
  transition: border-color 0.15s ease;

  .page-header__top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
  }

  .page-header__nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: transparent;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:hover {
      background: var(--color-black-04);
      border-color: var(--el-border-color);
    }
  }

  .page-header__title-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .page-header__badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    padding: 6px 14px;
    background: var(--el-fill-color-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--el-text-color-secondary);
  }

  .page-header__badge-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--el-text-color-secondary);
    flex-shrink: 0;
    animation: page-header-pulse 2s ease-in-out infinite;
  }

  .page-header__badge-text {
    font-family: EDIX, var(--font-family-sans-serif);
    text-transform: uppercase;
  }

  .page-header__title {
    font-size: clamp(1.75rem, 3.5vw, 2.25rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin: 0;
    color: var(--el-text-color-primary);
  }

  .page-header__subtitle {
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    line-height: 1.5;
    margin: 0;
    color: var(--el-text-color-secondary);
  }
}

@keyframes page-header-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

// ============ 设置内容 ============
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// ============ 设置区块 ============
.settings-section {
  border-radius: var(--global-border-radius);
  overflow: hidden;
  position: relative;

  &.danger-zone {
    border-color: rgb(var(--color-danger-dark), 0.2);

    .section-header {
      border-bottom-color: rgb(var(--color-danger-dark), 0.1);
    }
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px 32px;
  border-bottom: var(--unified-border-bottom);
  position: relative;
  z-index: var(--z-base);

  .section-icon {
    width: 52px;
    height: 52px;
    background: rgba($brand-primary, 0.08);
    color: $brand-primary;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
    transition: all 0.3s;

    &.danger {
      background: rgb(var(--color-danger-dark), 0.1);
      color: var(--color-danger-dark);
    }
  }

  .section-info {
    flex: 1;
    min-width: 0;
  }

  .section-idx {
    font-family: monospace;
    font-size: 12px;
    font-weight: 900;
    color: $brand-primary;
    opacity: 0.4;

    &.danger {
      color: var(--color-danger-dark);
      opacity: 0.6;
    }
  }
}

.section-title {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0 0 4px;
}

.section-description {
  font-size: 0.9rem;
  color: $text-sec;
  margin: 0;
}

// ============ 设置卡片 ============
.settings-card {
  padding: 0;
  position: relative;
  z-index: var(--z-base);
}

.theme-preset-section {
  padding: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: var(--unified-border-bottom);
  transition: background 0.3s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba($brand-primary, 0.02);
  }
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 1rem;
  font-weight: 700;
  color: $text-main;
  margin-bottom: 4px;
}

.setting-description {
  font-size: 0.85rem;
  color: $text-sec;
  line-height: 1.4;
}

.setting-control {
  flex-shrink: 0;
  margin-left: 24px;
}

// ============ 表单元素 ============
.setting-input {
  width: 220px;
  padding: 12px 16px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 0.9rem;
  background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.5);
  transition: all 0.3s;

  &:focus {
    outline: 2px solid rgba($brand-primary, 0.3);
    outline-offset: 2px;
    border-color: $brand-primary;
  }
}

.setting-select {
  width: 180px;
  padding: 12px 16px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 0.9rem;
  background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.5);
  cursor: pointer;
  transition: all 0.3s;

  &:focus {
    outline: 2px solid rgba($brand-primary, 0.3);
    outline-offset: 2px;
    border-color: $brand-primary;
  }
}

// ============ 开关样式 ============
.switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.8);
    border: var(--unified-border);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: var(--global-border-radius-sm, 4px);

    &::before {
      position: absolute;
      content: '';
      height: 22px;
      width: 22px;
      left: 2px;
      bottom: 2px;
      background: var(--el-bg-color);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
    }
  }

  input:checked + .slider {
    background: $brand-primary;
    border-color: $brand-primary;

    &::before {
      transform: translateX(24px);
    }
  }
}

// ============ 按钮样式 ============
.action-btn {
  padding: 12px 24px;
  background: $brand-primary;
  color: var(--el-bg-color);
  border: 2px solid transparent;
  border-radius: var(--global-border-radius);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: $brand-secondary;
    transform: translateY(-2px);
    border-color: rgba($brand-primary, 0.3);
  }
}

.danger-btn {
  padding: 12px 24px;
  background: var(--el-color-danger);
  color: var(--el-color-white);
  border: 2px solid transparent;
  border-radius: var(--global-border-radius);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: var(--el-color-danger-dark-2);
    transform: translateY(-2px);
    border-color: rgb(var(--el-color-danger-rgb), 0.4);
  }
}

// ============ 头像上传 ============
.avatar-upload {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-preview {
  width: 56px;
  height: 56px;
  border-radius: var(--global-border-radius);
  object-fit: cover;
  border: 2px solid $border-light;
  transition: all 0.3s;

  &:hover {
    border-color: $brand-primary;
    transform: scale(1.05);
  }
}

.upload-btn {
  padding: 10px 18px;
  background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.8);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: rgba($brand-primary, 0.08);
    border-color: rgba($brand-primary, 0.3);
  }
}

// ============ 对话框样式 ============
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-black-60);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.dialog {
  width: 90%;
  max-width: 480px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  animation: dialogEnter 0.3s ease-out;
}

@keyframes dialogEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px;
  border-bottom: var(--unified-border-bottom);

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.8);
    border: none;
    border-radius: var(--global-border-radius);
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background: rgba($brand-primary, 0.1);
    }
  }
}

.dialog-content {
  padding: 28px;

  p {
    margin: 0 0 16px;
    line-height: 1.6;
    color: $text-sec;
  }

  ul {
    margin: 16px 0;
    padding-left: 24px;

    li {
      margin: 8px 0;
      color: $text-sec;
    }
  }

  strong {
    color: var(--color-danger-dark);
  }
}

.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 10px;
    font-weight: 600;
    color: $text-main;
  }
}

.form-input {
  width: 100%;
  padding: 14px 18px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 0.95rem;
  background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.5);
  box-sizing: border-box;
  transition: all 0.3s;

  &:focus {
    outline: 2px solid rgba($brand-primary, 0.4);
    outline-offset: 2px;
    border-color: $brand-primary;
  }
}

.password-strength {
  margin-top: 8px;

  .strength-bar {
    height: 4px;
    background: var(--el-fill-color);
    border-radius: var(--global-border-radius);
    overflow: hidden;
    margin-bottom: 4px;

    .strength-fill {
      height: 100%;
      transition: width 0.3s, background-color 0.3s;
      border-radius: var(--global-border-radius);
    }
  }

  .strength-label {
    font-size: 12px;
    font-weight: 500;
  }
}

.password-suggestions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  span {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
    border-radius: var(--global-border-radius);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 28px;
  border-top: var(--unified-border);
  background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.3);
}

.cancel-btn {
  padding: 12px 24px;
  background: transparent;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.8);
  }
}

.confirm-btn {
  padding: 12px 24px;
  background: $brand-primary;
  color: var(--el-bg-color);
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: $brand-secondary;
    transform: translateY(-1px);
  }
}

// ============ 对话框过渡 ============
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;

  .dialog {
    transform: scale(0.95) translateY(20px);
  }
}

// ============ 响应式 ============
@include bp.mobile-only {
  .settings-container {
    padding: 0 24px;
  }

  .page-header {
    margin-bottom: 40px;
    padding-left: 16px;
    padding-right: 16px;

    .page-header__top {
      flex-direction: column;
      gap: 12px;
    }

    .page-header__nav-btn {
      width: 100%;
      justify-content: center;
    }
  }

  .section-header {
    flex-wrap: wrap;
    padding: 20px 24px;

    .section-idx {
      width: 100%;
      order: -1;
      margin-bottom: 12px;
    }
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 24px;
  }

  .setting-control {
    margin-left: 0;
    width: 100%;
  }

  .setting-input,
  .setting-select {
    width: 100%;
  }

  .avatar-upload {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;

    .upload-btn {
      width: 100%;
    }
  }

  .dialog {
    width: 95%;
    margin: 20px;
  }
}

@include bp.tablet-only {
  .settings-container {
    padding: 0 40px;
  }

  .page-header {
    padding-left: 20px;
    padding-right: 20px;
  }
}

// ============ 新增功能样式 ============
.version-tag {
  display: inline-block;
  padding: 6px 14px;
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: 0.03em;
}

.contact-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgb(var(--el-fill-color-rgb, 245, 245, 247), 0.5);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);

  .el-icon {
    font-size: 24px;
    color: var(--el-color-primary);
    flex-shrink: 0;
  }
}

.contact-label {
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.contact-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.miniapp-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.miniapp-qr-image {
  width: 200px;
  height: 200px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  object-fit: contain;
  background: var(--color-white);
}

.miniapp-tip {
  font-size: 0.9rem;
  color: var(--el-text-color-secondary);
  text-align: center;
  margin: 0;
}
</style>
