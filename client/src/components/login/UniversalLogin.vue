<template>
  <div class="login-page-container">
    <div class="login-content login-page" :class="{ 'dark-mode': isDarkMode }">
      <!-- 登录表单 -->

      <div class="login-brand">
        <!-- Welcome 图片单独一在- 根据暗色模式切换 -->
        <img v-if="showWelcomeImage" ref="welcomeImgRef" :src="welcomeImageSrc" :alt="t('login.subtitle')"
          class="welcome-svg" :class="{ loaded: welcomeImageLoaded }" @error="handleWelcomeImageError"
          @load="handleWelcomeImageLoad" loading="lazy" />
      </div>

      <!-- 安全提示 -->
      <el-alert v-if="showSecurityAlert" :title="securityAlertMessageSquare" type="warning" :closable="false" show-icon
        class="security-alert" transition="slide-up" />

      <!-- 表单加载状在-->
      <div v-if="loading" class="login-loading-overlay">
        <el-icon class="loading-icon">
          <Loader2 />
        </el-icon>
        <span class="loading-text">{{ t('auth.loading') }}</span>
      </div>

      <!-- 表单区域 -->
      <div class="form-area">
        <!-- 账号密码登录表单 -->
        <div v-if="activeTab === 'account'" class="form-container account-form-container"
          @keydown.tab.exact.capture="handleAccountFormTabKeydown">
          <el-form id="account-login-form" :model="accountForm" :rules="accountRules" ref="accountFormRef"
            class="login-form" autocomplete="on" @submit.prevent="handleLoginButtonClick">
            <el-form-item prop="username" class="username-form-item">
              <div class="username-input-wrapper" style="position: relative; width: 100%;">
                <el-input id="account-username" name="account-username" v-model="accountForm.username" :placeholder="isRegisterMode
                  ? t('register.placeholders.username')
                  : t('auth.usernameOrPhoneOrEmail')
                  " maxlength="50" clearable autocomplete="username" @input="handleUsernameInputChange"
                  @focus="handleUsernameFocus" @blur="handleUsernameBlur" @dblclick="handleUsernameDoubleClick">
                  <template #prefix>
                    <el-icon class="input-icon">
                      <User />
                    </el-icon>
                  </template>
                </el-input>
                <!-- 历史账号下拉在-->
                <div v-if="showHistoryAccounts && filteredHistoryAccounts.length > 0" class="history-dropdown"
                  @mousedown.prevent>
                  <div v-for="account in filteredHistoryAccounts" :key="account" class="history-item"
                    @click="selectHistoryAccount(account)">
                    <el-icon class="history-icon">
                      <Clock />
                    </el-icon>
                    <span>{{ account }}</span>
                  </div>
                </div>
              </div>
            </el-form-item>

            <!-- 注册模式：手机号和验证码 -->
            <template v-if="isRegisterMode">
              <el-form-item prop="phone">
                <el-input id="account-phone" name="account-phone" v-model="accountForm.phone"
                  :placeholder="t('register.placeholders.phone')" maxlength="11" clearable>
                  <template #prefix>
                    <el-icon class="input-icon">
                      <PhoneIcon />
                    </el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item prop="code">
                <div class="code-input-group">
                  <el-input id="account-code" name="account-code" v-model="accountForm.code"
                    :placeholder="t('register.placeholders.code')" maxlength="6" clearable>
                    <template #prefix>
                      <el-icon class="input-icon">
                        <PhoneIcon />
                      </el-icon>
                    </template>
                  </el-input>
                  <el-button type="primary" plain @click="sendRegisterCode" :disabled="registerCodeCountdown > 0"
                    class="code-button">
                    {{
                      registerCodeCountdown > 0
                        ? t('register.code.countdown', { seconds: registerCodeCountdown })
                        : t('register.code.send')
                    }}
                  </el-button>
                </div>
              </el-form-item>
            </template>

            <el-form-item prop="password">
              <el-input id="account-password" name="account-password" v-model="accountForm.password"
                :type="passwordVisible ? 'text' : 'password'" :placeholder="isRegisterMode ? t('register.placeholders.password') : t('auth.passwordHint')
                  " maxlength="20" clearable :autocomplete="isRegisterMode ? 'new-password' : 'current-password'"
                @input="handlePasswordInput"
                @keyup.enter="isRegisterMode ? handleAccountRegister() : handleAccountLogin()">
                <template #prefix>
                  <el-icon class="input-icon">
                    <Lock />
                  </el-icon>
                </template>
                <template #suffix>
                  <label class="password-eye-container" @click.stop>
                    <input type="checkbox" :checked="passwordVisible" @change="togglePasswordVisibility"
                      tabindex="-1" />
                    <svg class="eye" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512">
                      <path
                        d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z">
                      </path>
                    </svg>
                    <svg class="eye-slash" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512">
                      <path
                        d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z">
                      </path>
                    </svg>
                  </label>
                </template>
              </el-input>
              <div class="password-hint" :class="{ 'has-strength': passwordStrength.show }" style="display: none">
                <span class="hint-text">{{ t('auth.passwordHint') }}</span>
              </div>
              <div v-if="passwordStrength.show" class="password-strength-indicator">
                <div class="strength-bar">
                  <div class="strength-fill" :class="passwordStrength.level"
                    :style="{ width: passwordStrength.width + '%' }"></div>
                </div>
                <span class="strength-text" :class="passwordStrength.level">
                  {{ passwordStrength.text }}
                </span>
              </div>
            </el-form-item>

            <!-- 注册模式：确认密在-->
            <el-form-item v-if="isRegisterMode" prop="confirmPassword">
              <el-input id="account-confirm-password" name="account-confirm-password"
                v-model="accountForm.confirmPassword" :type="passwordVisible ? 'text' : 'password'"
                :placeholder="t('register.placeholders.confirmPassword')" maxlength="20" clearable
                @keyup.enter="handleAccountRegister">
                <template #prefix>
                  <el-icon class="input-icon">
                    <Lock />
                  </el-icon>
                </template>
                <template #suffix>
                  <label class="password-eye-container" @click.stop>
                    <input type="checkbox" :checked="passwordVisible" @change="togglePasswordVisibility"
                      tabindex="-1" />
                    <svg class="eye" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512">
                      <path
                        d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z">
                      </path>
                    </svg>
                    <svg class="eye-slash" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512">
                      <path
                        d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z">
                      </path>
                    </svg>
                  </label>
                </template>
              </el-input>
            </el-form-item>

            <!-- 注册模式：协议同在-->
            <el-form-item v-if="isRegisterMode" class="agreement-item">
              <CustomCheckbox v-model="accountAgreement">
                {{ t('register.agreement.prefix') }}
                <router-link to="/terms-of-service" class="agreement-link">
                  {{ t('routes.termsOfService') }}
                </router-link>
                {{ t('register.agreement.and') }}
                <router-link to="/privacy-policy" class="agreement-link">
                  {{ t('routes.privacyPolicy') }}
                </router-link>
              </CustomCheckbox>
            </el-form-item>

            <!-- 验证码（如果Login failed次数过多在-->
            <el-form-item v-if="showCaptcha" prop="captcha">
              <CaptchaInput id="account-captcha" v-model="accountForm.captcha" @refresh="handleCaptchaRefresh" />
            </el-form-item>

            <!-- 使用flex布局 -->
            <el-row class="form-actions-row">
              <el-col :span="12">
                <label class="custom-checkbox">
                  <input id="account-remember-me" name="account-remember-me" type="checkbox"
                    v-model="accountForm.rememberMe" />
                  <span class="checkmark"></span>
                  <span class="remember-me-text">{{ t('auth.autoLogin') }}</span>
                </label>
              </el-col>
              <el-col :span="12" class="text-right account-form-actions">
                <span class="switch-to-sso-link" @click="handleSSOOrUserLoginClick">
                  {{ isEnterpriseLoginMode ? t('auth.userLogin') : t('auth.ssoLogin') }}
                </span>
                <span v-if="!isEnterpriseLoginMode" class="switch-to-phone-link" @click="switchTab('phone')">
                  {{ t('auth.phoneLogin') }}
                </span>
                <span class="forgot-password" @click="handleForgotPassword">
                  {{ t('auth.forgotPassword') }}
                </span>
              </el-col>
            </el-row>
          </el-form>
        </div>

        <!-- 手机验证码登录表在-->
        <div v-if="activeTab === 'phone'" class="form-container phone-form-container">
          <el-form :model="phoneForm" ref="phoneFormRef" class="login-form" autocomplete="on"
            @submit.prevent="handlePhoneLogin">
            <div class="phone-background-bar unified-input-base">
              <span class="country-code-text" :key="`country-text-${currentLanguage}`"
                @click="handleCountryCodeTextClick" style="cursor: pointer;">
                {{ isChineseLanguage ? selectedCountryCode.name : selectedCountryCode.nameEn }}
                {{ selectedCountryCode.dialCode }}
              </span>
              <el-select id="phone-country-code" name="phone-country-code" ref="countryCodeSelectRef"
                :key="`country-select-${currentLanguage}`" v-model="selectedCountryCode" value-key="dialCode"
                class="country-code-select-inline" filterable :filter-method="filterCountryCodes"
                @change="handleCountryCodeChange" @visible-change="handleCountryCodeDropdownVisible"
                popper-class="country-code-popper" :teleported="true" :default-first-option="false"
                :suffix-icon="LinearCaretDown" :placeholder="t('auth.selectCountryCode')" :popper-options="{
                  placement: 'bottom-start',
                  strategy: 'fixed',
                  modifiers: [{
                    name: 'offset',
                    options: { offset: [0, 8] }
                  }, {
                    name: 'computeStyles',
                    options: {
                      adaptive: false,
                      gpuAcceleration: false
                    }
                  }],
                }" style="position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;">
                <el-option v-for="option in countryCodeOptions"
                  :key="`${option.dialCode || option.value}-${currentLanguage}`" :label="option.label"
                  :value="option.country">
                  <span class="country-option">
                    <span class="country-name">
                      {{ isChineseLanguage ? option.country.name : option.country.nameEn }}
                    </span>
                    <span class="country-dial">{{ option.dialCode || option.value }}</span>
                  </span>
                </el-option>
                <template #empty>
                  <span></span>
                </template>
              </el-select>

              <div class="phone-input-wrapper" style="position: relative; width: 100%">
                <el-input id="phone-number" name="phone-number" v-model="phoneForm.phoneNumber" maxlength="15"
                  :placeholder="t('auth.phonePlaceholder')" :aria-label="t('auth.phoneLabel')"
                  class="phone-input-with-code-btn" autocomplete="tel" @input="handlePhoneInputChange"
                  @focus="handlePhoneFocus" @blur="handlePhoneBlur" @dblclick="handlePhoneDoubleClick"
                  @keyup.enter="handlePhoneLogin">
                  <template #suffix>
                    <button v-if="canSendCode" type="button" :disabled="sendingCode || countdown > 0"
                      @click="sendVerificationCode" class="code-button-inline" :class="{ 'is-loading': sendingCode }">
                      <span v-if="sendingCode">{{ t('auth.sendingCode') }}</span>
                      <span v-else-if="countdown > 0">
                        {{ t('auth.retryAfterSeconds', { seconds: countdown }) }}
                      </span>
                      <span v-else>{{ getVerificationCodeText }}</span>
                    </button>
                  </template>
                </el-input>
                <!-- 历史手机号下拉窗 -->
                <div v-if="showHistoryPhones && filteredHistoryPhones.length > 0" class="history-dropdown"
                  @mousedown.prevent>
                  <div v-for="phone in filteredHistoryPhones" :key="phone" class="history-item"
                    @click="selectHistoryPhone(phone)">
                    <el-icon class="history-icon">
                      <Clock />
                    </el-icon>
                    <span>{{ phone }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="verification-code-background-bar">
              <div class="verification-code-inputs">
                <input v-for="(digit, index) in verificationCodeInputs" :key="index" :id="`verification-code-${index}`"
                  :name="`verification-code-${index}`" :aria-label="`${t('auth.captchaLabel')} ${Number(index) + 1}`" :ref="(el: HTMLInputElement | null) => {
                    if (el) verificationCodeInputRefs[index] = el as HTMLInputElement
                  }
                    " v-model="verificationCodeInputs[index]" link inputmode="numeric" maxlength="1"
                  class="verification-code-digit unified-input-base" @input="handleVerificationCodeInput(index, $event)"
                  @keydown="handleVerificationCodeKeydown(index, $event)" @paste="handleVerificationCodePaste($event)"
                  @focus="handleVerificationCodeFocus(index)" />
              </div>
            </div>
            <div v-if="codeSendStatus.message" :class="['code-status', codeSendStatus.type]">
              {{ codeSendStatus.message }}
            </div>

            <!-- 使用flex布局 -->
            <el-row class="form-actions-row">
              <el-col :span="12">
                <label class="custom-checkbox">
                  <input id="phone-remember-me" name="phone-remember-me" type="checkbox"
                    v-model="phoneForm.rememberMe" />
                  <span class="checkmark"></span>
                  <span class="remember-me-text">{{ t('auth.autoLogin') }}</span>
                </label>
              </el-col>
              <el-col :span="12" class="text-right">
                <span class="switch-to-sso-link" @click="handleSSOOrUserLoginClick">
                  {{ isEnterpriseLoginMode ? t('auth.userLogin') : t('auth.ssoLogin') }}
                </span>
                <span class="switch-to-account-link" @click="switchTab('account')">
                  {{ accountPasswordLoginText }}
                </span>
              </el-col>
            </el-row>
          </el-form>
        </div>

        <!-- 登录操作区域：第三方登录、按钮、协议文在- 独立于表单容在-->
        <div class="login-actions-container">
          <!-- 第三方登录图标容器（包含快捷登录标题在-->
          <div class="third-party-login-icons">
            <div class="quick-login-title">
              <span class="title-line"></span>
              <span class="title-text">{{ quickLoginText }}</span>
              <span class="title-line"></span>
            </div>
            <div class="third-party-icons-wrapper">

              <!-- 其他第三方登录图在-->
              <div v-for="method in enabledThirdPartyMethods" :key="method.key" class="third-party-icon"
                :data-tooltip="getTooltipText(method.key)" @click="handleThirdPartyLoginClick(method.key)">
                <img v-if="method.iconUrl" :src="isDarkMode && method.darkIconUrl ? method.darkIconUrl : method.iconUrl"
                  :srcset="activeTab === 'account'
                    ? getIconSrcSet(
                      isDarkMode && method.darkIconUrl ? method.darkIconUrl : method.iconUrl
                    )
                    : undefined
                    " :loading="activeTab === 'account' ? 'lazy' : undefined"
                  :decoding="activeTab === 'account' ? 'async' : undefined" :alt="method.name" class="platform-icon-img"
                  @error="handleIconError" />
                <span class="platform-name">{{ method.name }}</span>
              </div>
            </div>
          </div>

          <!-- 统一登录按钮：包裹层处理键盘 Enter 事件(移除 role=button 避免与 el-button 重复,消除无障碍重叠) -->
          <div class="login-button-wrap" @click="onLoginButtonClick"
            @keydown.enter="onLoginButtonClick">
            <el-button type="primary" class="login-button" :loading="loading" :disabled="loginCooldown > 0"
              :aria-label="loginCooldown > 0 ? t('auth.waitSeconds', { seconds: loginCooldown }) : t('auth.login_register')"
              :form="activeTab === 'account' ? 'account-login-form' : undefined"
              :native-type="activeTab === 'account' ? 'submit' : 'button'" tabindex="-1">
              {{
                loginCooldown > 0
                  ? t('auth.waitSeconds', { seconds: loginCooldown })
                  : t('auth.login_register')
              }}
            </el-button>
          </div>

          <!-- 服务协议和隐私政策说在- 根据当前标签页显示不同的协议 -->
          <div class="login-agreement-text">
            <div class="agreement-line-1">
              <label class="custom-checkbox agreement-checkbox">
                <input :id="activeTab === 'account' ? 'account-login-agreement' : 'phone-login-agreement'" :name="activeTab === 'account' ? 'account-login-agreement' : 'phone-login-agreement'
                  " type="checkbox" v-model="currentAgreement" />
                <span class="checkmark"></span>
              </label>
              <span class="agreement-text-content">
                <span>{{ t('auth.loginAgreement.prefix') }}</span>
                <router-link to="/terms-of-service" class="agreement-link">{{
                  t('routes.termsOfService')
                }}</router-link>
                <span>{{ t('auth.loginAgreement.and') }}</span>
                <router-link to="/privacy-policy" class="agreement-link">{{
                  t('routes.privacyPolicy')
                }}</router-link>
                <span>{{ t('auth.loginAgreement.suffix') }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 密码重置对话在-->
      <PasswordReset v-model="showPasswordResetDialog" @success="handlePasswordResetSuccess" />



      <!-- 微信扫码登录对话在-->
      <el-dialog v-model="showWechatQrDialog" width="fit-content" :show-close="false" :close-on-click-modal="true"
        :close-on-press-escape="true" class="wechat-qr-dialog" align-center append-to-body>
        <div id="wechat-qrcode-container"></div>
      </el-dialog>

      <!-- 微信登录绑定手机号弹在-->
      <PhoneBindingDialog v-model="showWechatPhoneBindDialog" :union-id="wechatBindInfo.unionId"
        :open-id="wechatBindInfo.openId" :platform-type="wechatBindInfo.platformType"
        @bind-success="handleWechatPhoneBindSuccess" @bind-cancel="handleWechatPhoneBindCancel" />

      <!-- 账号密码注册成功后绑定手机号弹窗（与手机登录表单一致的手机在验证码） -->
      <PhoneBindingDialog v-model="showBindPhoneAfterRegisterDialog" @bind-success="handleBindPhoneAfterRegisterSuccess"
        @bind-cancel="handleBindPhoneAfterRegisterCancel" />

      <!-- 账号绑定弹窗 -->
      <AccountBindDialog v-model="showAccountBindDialog" :is-register-mode="isRegisterMode" :loading="loading"
        :uuid="bindDialogUuid" :need-pwd="bindDialogNeedPwdRef" :initial-data="bindDialogInitialData"
        @confirm="handleBindDialogConfirm" @cancel="handleBindDialogCancel" />

      <!-- 协议确认弹窗 -->
      <el-dialog v-model="showAgreementConfirmDialog" :title="t('auth.agreementDialogTitle')" width="400px"
        :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false"
        class="agreement-confirm-dialog-wrapper" center append-to-body>
        <div class="agreement-confirm-dialog-container" id="agreement-confirm-dialog-container">
          <div class="agreement-confirm-content">
            <p class="agreement-confirm-text">
              {{ t('auth.agreementDialogText') }}
            </p>
            <div class="agreement-confirm-links">
              <router-link to="/terms-of-service" class="agreement-link-item" target="_blank">
                {{ t('routes.termsOfService') }}
              </router-link>
              <span class="agreement-confirm-separator">{{ t('auth.loginAgreement.and') }}</span>
              <router-link to="/privacy-policy" class="agreement-link-item" target="_blank">
                {{ t('routes.privacyPolicy') }}
              </router-link>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="agreement-confirm-footer">
            <el-button class="agreement-cancel-button" size="large" :disabled="false"
              @click="handleAgreementDialogCancel">
              {{ t('auth.cancel') }}
            </el-button>
            <el-button type="primary" class="agreement-agree-button" size="large" :disabled="false"
              @click="handleAgreementDialogConfirm">
              {{ t('auth.agree') }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 未查到账号时：设置邮箱与密码后注册并登录 -->
      <el-dialog v-model="showSetEmailPasswordDialog" :title="t('auth.setEmailPasswordDialogTitle')" width="400px"
        class="set-email-password-dialog" center append-to-body :close-on-click-modal="false"
        @closed="setEmailPasswordForm.email = ''; setEmailPasswordForm.password = ''; setEmailPasswordForm.confirmPassword = ''">
        <el-form ref="setEmailPasswordFormRef" :model="setEmailPasswordForm" :rules="setEmailPasswordRules"
          label-position="top" @submit.prevent="handleSetEmailPasswordSubmit">
          <el-form-item :label="t('auth.setEmailPasswordDialogEmailLabel')" prop="email">
            <el-input v-model="setEmailPasswordForm.email" type="email" :placeholder="t('register.placeholders.email')"
              maxlength="64" clearable autocomplete="email" />
          </el-form-item>
          <el-form-item :label="t('auth.setEmailPasswordDialogPasswordLabel')" prop="password">
            <el-input v-model="setEmailPasswordForm.password" :type="passwordVisible ? 'text' : 'password'"
              :placeholder="t('register.placeholders.password')" maxlength="20" clearable autocomplete="new-password"
              show-password />
          </el-form-item>
          <el-form-item :label="t('auth.setEmailPasswordDialogConfirmPasswordLabel')" prop="confirmPassword">
            <el-input v-model="setEmailPasswordForm.confirmPassword" :type="passwordVisible ? 'text' : 'password'"
              :placeholder="t('register.placeholders.confirmPassword')" maxlength="20" clearable
              autocomplete="new-password" show-password />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showSetEmailPasswordDialog = false">{{ t('auth.cancel') }}</el-button>
          <el-button type="primary" :loading="setEmailPasswordLoading" @click="handleSetEmailPasswordSubmit">
            {{ t('auth.setEmailPasswordDialogSubmit') }}
          </el-button>
        </template>
      </el-dialog>
    </div>
    <!-- 底部品牌跑马灯容在-->
    <div class="brand-marquee-container">
      <div class="brand-marquee">
        <div class="marquee-track" ref="marqueeTrackRef" :class="{ 'dragging': isDragging }"
          @mousedown="handleMarqueeMouseDown" @touchstart="handleMarqueeTouchStart">
          <div class="marquee-item" v-for="i in 10" :key="i">
            <img :src="getMarqueeImageSrc(i)" :alt="getMarqueeImageAlt(i)" class="marquee-image"
              @error="handleImageError($event, i)" @load="handleImageLoad($event, i)" loading="lazy">
          </div>
          <!-- 复制一份用于无缝滚在-->
          <div class="marquee-item" v-for="i in 10" :key="`copy-${i}`">
            <img :src="getMarqueeImageSrc(i)" :alt="getMarqueeImageAlt(i)" class="marquee-image"
              @error="handleImageError($event, i)" @load="handleImageLoad($event, i)" loading="lazy">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { logger } from '../../utils/logger'
import { ref, reactive, computed, onMounted, nextTick, watch, defineComponent, h } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { type FormInstance } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useI18n } from 'vue-i18n'
import CustomCheckbox from '../ui/CustomCheckbox.vue'
import AccountBindDialog from './components/AccountBindDialog.vue'
import PhoneBindingDialog from './PhoneBindingDialog.vue'

import { User, Lock, Loader2, Clock } from '@/lib/lucide-fallback'
// LoginDuration 类型暂时不需在

// 品牌跑马灯图片导入（与首页同步，使用在0个）
import kouziIcon from '@/assets/images/kouzi-icon.png'
import bbxIcon from '@/assets/images/bbxlogo.svg'
import brand4Icon from '@/assets/images/brand4.svg'
import openaiIcon from '@/assets/images/openai.png'
import brand6Icon from '@/assets/images/智谱清言@1x.png'
import brand7Icon from '@/assets/images/gork.png'
import brand8Icon from '@/assets/images/8@1x.png'
import brand9Icon from '@/assets/images/ali.png'
import brand10Icon from '@/assets/images/TX.png'
import brand11Icon from '@/assets/images/华为.svg'

// 品牌跑马灯相在
const marqueeTrackRef = ref<HTMLElement | null>(null)
let marqueeAnimationId: number | null = null

// 跑马灯拖拽相关状态（与首页同步）
const isDragging = ref(false)
const dragStartX = ref(0)
const dragCurrentX = ref(0)
const dragOffset = ref(0)
let isMouseDown = false
let isTouchStart = false
// rAF 节流id（与首页同步）
let marqueeDragRafId: number | null = null
const loginRafIds = new Set<number>()

// 类型定义
interface VueI18nGlobal {
  global: {
    locale: {
      value: string
    }
  }
}

// DOM 类型定义已移在src/types/platform.d.ts 全局类型文件在
// 这些类型在所有构建平台（web、h5、alipay、electron）中都可使用

interface ApiResponseData {
  token?: string
  accessToken?: string
  access_token?: string
  refreshToken?: string
  refresh_token?: string
  expires_in?: number
  expiresIn?: number
  userInfo?: UserInfo
  user?: UserInfo
  thirdPartyAccounts?: {
    accessToken?: string
    refreshToken?: string
  }
  message?: string
}

interface UserInfo {
  id?: string
  uuid?: string
  username?: string
  email?: string
  phone?: string
  nickname?: string
  avatar?: string
  gender?: number
  birthday?: string
  signature?: string
  status?: number
  isVip?: boolean
  inviteCode?: string
  createTime?: string
  updateTime?: string
}

interface ExtendedApiResponse {
  code?: number
  success?: boolean
  data?: ApiResponseData
  token?: string
  refreshToken?: string
  expires_in?: number
  expiresIn?: number
  userInfo?: UserInfo
  user?: UserInfo
  message?: string
}

const LinearCaretDown = defineComponent({
  name: 'LinearCaretDown',
  setup(): () => ReturnType<typeof h> {
    return () =>
      h('svg', { width: 14, height: 14, viewBox: '0 0 16 16' }, [
        h('path', {
          d: 'M4 6l4 4 4-4',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.5,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      ])
  },
})

// 手机图标组件 - 优化渲染清晰度，拉长高度
const PhoneIcon = defineComponent({
  name: 'PhoneIcon',
  setup(): () => ReturnType<typeof h> {
    return () =>
      h(
        'svg',
        {
          width: 24,
          height: 28, // 增加高度，让手机图标更高
          viewBox: '0 0 1024 1024',
          xmlns: 'http://www.w3.org/2000/svg',
          preserveAspectRatio: 'xMidYMid meet', // 保持宽高比，垂直方向会拉在
          style: {
            shapeRendering: 'geometricPrecision', // 提高渲染精度
            imageRendering: 'crisp-edges', // 边缘清晰
          },
        },
        [
          h('path', {
            d: 'M291.372365 98.323185c-90.579635 0-164.271663 73.692028-164.271662 164.271663v498.810304c0 90.579635 73.692028 164.271663 164.271662 164.271663h442.454333c90.579635 0 164.271663-73.692028 164.271663-164.271663v-498.810304c0-90.579635-73.692028-164.271663-164.271663-164.271663h-442.454333m0-57.555035h442.454333c122.511888 0 221.826698 99.31481 221.826698 221.826698v498.810304c0 122.511888-99.31481 221.826698-221.826698 221.826698h-442.454333c-122.511888 0-221.826698-99.31481-221.826698-221.826698v-498.810304c0-122.511888 99.31481-221.826698 221.826698-221.826698z',
            fill: 'currentColor',
            'shape-rendering': 'geometricPrecision', // 提高渲染精度
            'stroke-width': '0', // 确保填充清晰
          }),
          h('path', {
            d: 'M393.29274 726.632319m37.17096 0l165.470726 0q37.17096 0 37.17096 37.17096l0 0q0 37.17096-37.17096 37.17096l-165.470726 0q-37.17096 0-37.17096-37.17096l0 0q0-37.17096 37.17096-37.17096Z',
            fill: 'currentColor',
            'shape-rendering': 'geometricPrecision', // 提高渲染精度
            'stroke-width': '0', // 确保填充清晰
          }),
        ]
      )
  },
})
const router = useRouter()
const route = useRoute()

// ========== i18n 初始在- 全面重构 ==========
// 必须在所有其他代码之前初始化 i18n
const { t, te, locale: i18nLocale } = useI18n()

// 统一封装 locale 访问/写入，兼容被外部写成字符串的场景
const getLocaleValue = () => (typeof i18nLocale === 'string' ? i18nLocale : i18nLocale?.value)

const setLocaleValue = (val: string) => {
  if (typeof i18nLocale === 'string') {
    ; (i18nLocale as unknown as { value?: string }).value = val
    interface VueI18nGlobal {
      global?: {
        locale?: { value?: string } | string
      }
    }
    const i18nGlobal = (window as { __VUE_I18N__?: VueI18nGlobal }).__VUE_I18N__
    const gl = i18nGlobal?.global?.locale
    if (gl && i18nGlobal?.global) {
      if (typeof gl === 'string') {
        i18nGlobal.global.locale = val
      } else if (typeof gl === 'object') {
        ; (gl as { value?: string }).value = val
      }
    }
    return
  }

  if (i18nLocale && typeof (i18nLocale as { value?: string }).value !== 'undefined') {
    ; (i18nLocale as { value: string }).value = val
  }
}

// 提供在Ref 接口一致的对象，供后续 locale.value 使用
const locale = {
  get value(): string {
    return getLocaleValue() || 'zh-CN'
  },
  set value(val: string) {
    setLocaleValue(val)
  },
} as { value: string }

const { showSuccess, showError, showWarning, showInfo } = useOperationFeedback()

// 集成后端 UserAuth API
const userAuth = useUserAuth()

// 项目切换管理
const { availableProjects } = useLoginProject()

// 企业登录（总管理端）跳转地址（统一使用8888端口），仅计算并缓存，暂不直接跳在
const adminRedirectUrl = ref<string>('')

// 确保 locale 正确初始在- 从全局 i18n 实例同步
const ensureLocaleSync = (): void => {
  try {
    // 尝试从全局 i18n 实例获取current locale（可能是字符串，也可能是 ref在
    interface VueI18nGlobal {
      __VUE_I18N__?: {
        global?: {
          locale?: string | { value?: string }
        }
      }
    }
    const i18nGlobal = (window as VueI18nGlobal).__VUE_I18N__
    const globalLocaleSource = i18nGlobal?.global?.locale
    const globalLocale =
      typeof globalLocaleSource === 'string' ? globalLocaleSource : globalLocaleSource?.value

    if (globalLocale && globalLocale !== locale.value) {
      locale.value = globalLocale
    }

    // 如果 locale 仍然为空或无效，设置为默认值zh-CN，并尝试回写全局
    if (!locale.value || locale.value === '') {
      locale.value = 'zh-CN'
      if (globalLocaleSource && i18nGlobal?.global) {
        if (typeof globalLocaleSource === 'string') {
          i18nGlobal.global.locale = 'zh-CN'
        } else if (typeof globalLocaleSource === 'object') {
          ; (globalLocaleSource as { value?: string }).value = 'zh-CN'
        }
      }
    }
  } catch (e) {
    // 如果出错，使用默认值
    if (import.meta.env.DEV) {
      logger.debug('[UniversalLogin] Failed to sync locale, using default value', e)
    }
    if (!locale.value || locale.value === '') {
      locale.value = 'zh-CN'
    }
  }
}

// 立即执行一次同在
ensureLocaleSync()

// 账号密码登录文本 - 使用 computed 确保响应式更在
// 明确依赖 locale.value 在t 函数，确保Language switched时自动更在
const accountPasswordLoginText = computed(() => {
  // 确保 locale 同步
  ensureLocaleSync()

  // 明确读取 locale.value 以确保响应式追踪
  const currentLocale = locale.value || 'zh-CN'

  // 检查翻在key 是否存在
  const translationKey = 'auth.accountPasswordLogin'
  const teFunc = typeof te === 'function' ? te : () => true
  if (!teFunc(translationKey)) {
    logger.warn(`[UniversalLogin] Translation key not found ${translationKey}, current locale: ${currentLocale}`)
    return t('auth.accountPasswordLogin')
  }

  // 获取翻译
  const tFunc = typeof t === 'function' ? t : (key: string) => key
  const translation = tFunc(translationKey)

  // 调试输出（开发环境）
  if (import.meta.env.DEV) {
    logger.info('[UniversalLogin] i18n state:', {
      locale: currentLocale,
      translationKey,
      translation,
      translationExists: teFunc(translationKey),
    })
  }

  return translation
})

// 快捷登录文本 - 使用 computed 确保响应式更在
const quickLoginText = computed(() => {
  ensureLocaleSync()
  return t('auth.quickLogin')
})

// 获取验证码文在- 使用 computed 确保响应式更在
const getVerificationCodeText = computed(() => {
  ensureLocaleSync()
  return t('auth.getVerificationCode')
})

import PasswordReset from '@/components/auth/PasswordReset.vue'
import GoogleLogin from '@/features/third-party-login/components/GoogleLogin.vue'
import AppleLogin from '@/features/third-party-login/components/AppleLogin.vue'
import { FormValidator } from '@/utils/formValidation'
import { InputValidator } from '@/utils/security'
import { useLoginProject } from '@/composables/login/useLoginProject'

// 历史账号记录管理
const HISTORY_ACCOUNT_KEY = 'login_history_accounts'
const HISTORY_PHONE_KEY = 'login_history_phones'
const MAX_HISTORY_COUNT = 10 // 最多保在0条历史记在

// 获取历史账号列表
const getHistoryAccounts = (): string[] => {
  try {
    const history = StorageManager.getItem<string[]>(HISTORY_ACCOUNT_KEY)
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

// 保存账号到历史记在
const saveHistoryAccount = (account: string): void => {
  if (!account || account.trim() === '') return

  try {
    const history = getHistoryAccounts()
    const filtered = history.filter(item => item !== account)
    filtered.unshift(account.trim())
    const limited = filtered.slice(0, MAX_HISTORY_COUNT)
    StorageManager.setItem(HISTORY_ACCOUNT_KEY, limited)
    initHistoryAccounts()
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn('[UniversalLogin] Failed to save account history', error)
    }
  }
}

// 获取历史手机号列在
const getHistoryPhones = (): string[] => {
  try {
    const history = StorageManager.getItem<string[]>(HISTORY_PHONE_KEY)
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

// 保存手机号到历史记录
const saveHistoryPhone = (phone: string): void => {
  if (!phone || phone.trim() === '') return

  try {
    const history = getHistoryPhones()
    // 移除重复在
    const filtered = history.filter(item => item !== phone)
    // 添加到最前面
    filtered.unshift(phone.trim())
    // 限制数量
    const limited = filtered.slice(0, MAX_HISTORY_COUNT)
    StorageManager.setItem(HISTORY_PHONE_KEY, limited)
  } catch (error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          t('auth.saveHistoryPhoneFailed'),
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch(error => {
        // Dev environment warning
        if (import.meta.env.DEV) {
          logger.warn('[UniversalLogin] Failed to save phone number history (log record failed)', error)
        }
      })
  }
}
import { register, type RegisterRequest } from '@/api/auth/auth'
import { unifiedLogin, unifiedRegister, isValidSource, type LoginSource } from '@/api/unified/unified-auth'
import request from '@/utils/request'
import { LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { AuthFlowService } from '@/services/auth-flow.service'
import { useUserAuth } from '@/composables/useUserAuth'
import {
  sendVerificationCode as apiSendVerificationCode,
  sendPhoneLoginCode,
  verifyPhoneCode,
  completePhoneLogin,
  type UserInfoData,
} from '@/api/user/user'
import CaptchaInput from './components/CaptchaInput.vue'
import { useAuthStore } from '@/stores/auth'
import { StorageManager } from '@/utils/storage'
import { RememberMeService } from '@/utils/rememberMeService'
import { ALIPAY_AUTH_URL } from '@/constants/alipay'
import { FEISHU_AUTH_URL } from '@/constants/feishu'
import { DINGTALK_AUTH_URL } from '@/constants/dingtalk'
import { WECOM_AUTH_URL } from '@/constants/wecom'
import { ElMessage } from 'element-plus'
import { useLoginAnalytics } from '@/composables/useAnalytics'
import {
  countryCodes,
  getDefaultCountryCode,
  getCountryByDialCode,
  type CountryCode,
} from '@/utils/countryCodes'
// sessionManager不再使用，已移除导入

// 欢迎图片加载状态管在
const welcomeImageLoaded = ref(false)

const handleWelcomeImageLoad = (event: Event): void => {
  welcomeImageLoaded.value = true
  const img = event.target as HTMLImageElement
  img.classList.add('loaded')
}

// 项目选择器已删除，相关代码已清理

// 顶层定义 authStore，避免函数内部重复创在
const authStore = useAuthStore()
const { trackLoginPageView, trackLoginClick, trackLoginSuccess, trackLoginFail } = useLoginAnalytics()

// 类型断言辅助函数
const getAuthUser = () => authStore.user as UserInfoData | null

// 导入第三方登录图在
// 第三方图标统一在/images 目录加载

// 第三方登录方法配在
interface ThirdPartyMethod {
  key: string
  name: string
  enabled: boolean
  component: unknown
  iconUrl?: string
  darkIconUrl?: string // 暗色模式图标URL
}


const thirdPartyMethods: ThirdPartyMethod[] = [
  {
    key: 'wechat',
    name: t('auth.wechatLogin'),
    enabled: true,
    component: null,
    iconUrl: '/images/loginSANFANG/微信.svg',
  },
  {
    key: 'alipay',
    name: t('auth.alipayLogin'),
    enabled: true,
    component: null,
    iconUrl: '/images/loginSANFANG/支付宝支付.svg',
  },
  {
    key: 'google',
    name: t('auth.googleLogin'),
    enabled: true,
    component: GoogleLogin,
    iconUrl: '/images/loginSANFANG/谷歌.svg',
  },
  {
    key: 'apple',
    name: t('auth.appleLogin'),
    enabled: true,
    component: AppleLogin,
    iconUrl: '/images/loginSANFANG/apple.svg',
  },
  {
    key: 'feishu',
    name: t('auth.feishuLogin'),
    enabled: true,
    component: null,
    iconUrl: '/images/loginSANFANG/飞书.svg',
  },
  {
    key: 'dingtalk',
    name: t('auth.dingtalkLogin'),
    enabled: true,
    component: null,
    iconUrl: '/images/loginSANFANG/钉钉.svg',
  },
  {
    key: 'wecom',
    name: t('auth.wecomLogin'),
    enabled: true,
    component: null,
    iconUrl: '/images/loginSANFANG/企业微信.svg',
  },
]

// 处理图标加载错误
// 已移除错误回退逻辑，统一在public/images 加载

// 生成高分辨率 srcset，优先使在@2x 图，减少放大时的模糊
const getIconSrcSet = (url: string): string => {
  try {
    if (!url) return ''
    // 在@1x.png 替换在@2x.png 作为 2x 资源；如果不在@1x，保持原在
    const hiRes = url.replace(/@1x(\.[a-z]+)$/i, '@2x$1')
    if (hiRes !== url) {
      return `${url} 1x, ${hiRes} 2x`
    }
    return ''
  } catch {
    return ''
  }
}

// 获取启用的第三方登录方法（响应式更新在
const enabledThirdPartyMethods = computed(() => {
  return thirdPartyMethods.filter(method => method.enabled)
})

// 获取提示框文在
const getTooltipText = (key: string): string => {
  return t(`login.thirdParty.tooltip.${key}`)
}

const activeTab = ref<'account' | 'phone'>('phone')

// 当前是否为「企业登录」流程（账号密码表单 + source=admin）：此状态下底部链接显示「用户登录」可切回用户登录
const isEnterpriseLoginMode = computed(() => {
  return activeTab.value === 'account' && (route.query.source as string) === 'admin'
})

// 登录/注册模式切换
const props = defineProps<{
  mode?: 'login' | 'register'
  projectSelectorProps?: {
    isMobile: boolean
    currentSource: string | null
    availableProjects: Array<{ key: string; name: string }>
    selectedProject: string | null
    selectProject: (key: string) => void
    selectProjectText: string
  }
}>()
const isRegisterMode = ref(props.mode === 'register' || false)

// 历史账号记录（提前定义，供方法使用）
const historyAccounts = ref<string[]>([])
const showHistoryAccounts = ref(false)
const historyAccountQuery = ref('')

// 历史手机号记在
const historyPhones = ref<string[]>([])
const showHistoryPhones = ref(false)
const historyPhoneQuery = ref('')

// 初始化历史记录（提前定义，供方法使用在
const initHistoryAccounts = (): void => {
  historyAccounts.value = getHistoryAccounts()
}

// 过滤历史账号（提前定义，供方法使用）
const filteredHistoryAccounts = computed(() => {
  if (!historyAccountQuery.value) {
    return historyAccounts.value
  }
  return historyAccounts.value.filter((account: string) =>
    account.toLowerCase().includes(historyAccountQuery.value.toLowerCase())
  )
})

// 处理用户名输入框双击
const handleUsernameDoubleClick = (): void => {
  initHistoryAccounts()
  if (historyAccounts.value.length > 0) {
    showHistoryAccounts.value = true
    historyAccountQuery.value = ''
    nextTick(() => {
      const inputElement = document.getElementById('account-username')
      if (inputElement) {
        inputElement.focus()
      }
    })
  } else {
    showHistoryAccounts.value = false
  }
}

// 处理手机号输入框双击
const handlePhoneDoubleClick = (): void => {
  initHistoryPhones()
  if (historyPhones.value.length > 0) {
    showHistoryPhones.value = true
    historyPhoneQuery.value = ''
    nextTick(() => {
      const inputElement = document.getElementById('phone-number')
      if (inputElement) {
        inputElement.focus()
      }
    })
  } else {
    showHistoryPhones.value = false
  }
}

// 处理用户名输在
const handleUsernameInputChange = (val: string): void => {
  historyAccountQuery.value = val || ''
  showHistoryAccounts.value =
    historyAccounts.value.length > 0 && (val === '' || filteredHistoryAccounts.value.length > 0)
}

// 处理用户名输入框聚焦
const handleUsernameFocus = (): void => {
  initHistoryAccounts()
  showHistoryAccounts.value = historyAccounts.value.length > 0
  historyAccountQuery.value = accountForm.username || ''
}

// 处理用户名输入框失焦
const handleUsernameBlur = (_evt?: FocusEvent): void => {
  window.setTimeout(() => {
    const relatedTarget = _evt?.relatedTarget as HTMLElement | null
    if (relatedTarget && relatedTarget.closest('.history-dropdown')) {
      return
    }
    showHistoryAccounts.value = false
  }, 200)
}

// 账号密码表单
const accountFormRef = ref<FormInstance | undefined>(undefined)
const accountForm = reactive({
  username: '',
  password: '',
  rememberMe: false,
  captcha: '',
  // 注册相关字段
  phone: '',
  code: '',
  confirmPassword: '',
  email: '', // 邮箱字段
})
const accountAgreement = ref(false) // 注册协议同意
const registerCodeCountdown = ref(0) // 注册验证码倒计在
let registerCodeCountdownTimer: number | null = null // 注册验证码倒计时定时器

// 密码显示/隐藏状在
const passwordVisible = ref(false)

// 切换密码显示/隐藏
const togglePasswordVisibility = (): void => {
  passwordVisible.value = !passwordVisible.value
}

// 在账号登录表单内在Tab 时，若焦点在密码框且已显示验证码，则强制跳到验证码输入框（解在Element Plus Tab 顺序跳过验证码）
// 使用 capture 阶段确保在Element Plus 或其它逻辑之前拦截；用 activeElement 判断焦点是否在密码区
function handleAccountFormTabKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || e.shiftKey || !showCaptcha.value) return
  const active = document.activeElement as HTMLElement | null
  const target = (e.target as HTMLElement) || active
  const isInPassword = active?.closest?.('#account-password') ?? target?.closest?.('#account-password')
  if (!isInPassword) return
  e.preventDefault()
  e.stopPropagation()
  const focusCaptcha = (): void => {
    // id 可能在根容器或内在input 上（Element Plus inheritAttrs 行为在
    const byId = document.getElementById('account-captcha')
    let toFocus: HTMLInputElement | null =
      byId instanceof HTMLInputElement
        ? byId
        : byId?.querySelector?.<HTMLInputElement>('input') ?? null
    if (!toFocus) {
      const form = document.getElementById('account-login-form')
      toFocus = form?.querySelector?.<HTMLInputElement>('.captcha-input input') ?? null
    }
    if (toFocus) {
      toFocus.focus()
      return
    }
    // CaptchaInput 组件内部已处理焦点，无需手动聚焦
  }
  focusCaptcha()
  const id = requestAnimationFrame(() => {
    loginRafIds.delete(id)
    focusCaptcha()
  })
  loginRafIds.add(id)
}

const initHistoryPhones = (): void => {
  historyPhones.value = getHistoryPhones()
}

// 过滤历史手机在
const filteredHistoryPhones = computed(() => {
  if (!historyPhoneQuery.value) {
    return historyPhones.value
  }
  return historyPhones.value.filter((phone: string) => phone.includes(historyPhoneQuery.value))
})

// 选择历史账号
const selectHistoryAccount = (account: string): void => {
  accountForm.username = account
  showHistoryAccounts.value = false
  historyAccountQuery.value = ''
  accountFormRef.value?.focus?.()
}

// 选择历史手机在
const selectHistoryPhone = (phone: string): void => {
  phoneForm.phoneNumber = phone
  showHistoryPhones.value = false
  historyPhoneQuery.value = ''
  phoneFormRef.value?.focus?.()
}

// 处理手机号输在
const handlePhoneInputChange = (val: string): void => {
  autoDetectCountryCode()
  historyPhoneQuery.value = val || ''
  showHistoryPhones.value =
    historyPhones.value.length > 0 && (val === '' || filteredHistoryPhones.value.length > 0)
}

// 处理手机号输入框聚焦
const handlePhoneFocus = (): void => {
  initHistoryPhones()
  showHistoryPhones.value = historyPhones.value.length > 0
  historyPhoneQuery.value = phoneForm.phoneNumber
}

// 处理手机号输入框失焦
const handlePhoneBlur = (_evt?: FocusEvent): void => {
  autoDetectCountryCode()
  window.setTimeout(() => {
    const relatedTarget = _evt?.relatedTarget as HTMLElement | null
    if (relatedTarget && relatedTarget.closest('.history-dropdown')) {
      return
    }
    showHistoryPhones.value = false
  }, 200)
}

// 处理验证码输在
const handleVerificationCodeInput = (index: number, event: Event): void => {
  const target = event.target as HTMLInputElement
  let value = target.value

  // 只允许数在
  value = value.replace(/\D/g, '')

  if (value.length > 1) {
    // 如果输入多个字符，只取第一在
    value = value.charAt(0)
  }

  verificationCodeInputs.value[index] = value

  // 同步在phoneForm.verificationCode
  phoneForm.verificationCode = verificationCodeInputs.value.join('')

  // 如果输入了数字且不是最后一个输入框，自动跳转到下一在
  if (value && index < 5) {
    nextTick(() => {
      verificationCodeInputRefs.value[index + 1]?.focus()
    })
  }

  // 如果所有输入框都已填满，自动提交（可选）
  if (phoneForm.verificationCode.length === 6) {
    // 可以在这里添加自动提交逻辑，或者让用户手动点击登录按钮
  }
}

// 处理验证码键盘事在
const handleVerificationCodeKeydown = (index: number, event: KeyboardEvent): void => {
  // 处理退格键
  if (event.key === 'Backspace' && !verificationCodeInputs.value[index] && index > 0) {
    event.preventDefault()
    verificationCodeInputRefs.value[index - 1]?.focus()
  }

  // 处理左右箭头在
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    verificationCodeInputRefs.value[index - 1]?.focus()
  }

  if (event.key === 'ArrowRight' && index < 5) {
    event.preventDefault()
    verificationCodeInputRefs.value[index + 1]?.focus()
  }

  // 处理回车在
  if (event.key === 'Enter' && phoneForm.verificationCode.length === 6) {
    handlePhoneLogin()
  }
}

// 处理验证码粘在
const handleVerificationCodePaste = (event: ClipboardEvent): void => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/\D/g, '').slice(0, 6)

  // 填充输入在
  for (let i = 0; i < 6; i++) {
    verificationCodeInputs.value[i] = digits[i] || ''
  }

  // 同步在phoneForm.verificationCode
  phoneForm.verificationCode = verificationCodeInputs.value.join('')

  // 聚焦到最后一个已填写的输入框或第一个空输入在
  const lastFilledIndex = digits.length - 1
  const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5
  nextTick(() => {
    verificationCodeInputRefs.value[focusIndex]?.focus()
  })
}

// 处理验证码输入框聚焦
const handleVerificationCodeFocus = (index: number): void => {
  // 聚焦时选中当前输入框的内容
  nextTick(() => {
    verificationCodeInputRefs.value[index]?.select()
  })
}

// 增强的验证规在- 包含安全检在
const accountRules = reactive({
  username: [
    { required: true, message: t('auth.usernameOrPhoneOrEmail'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        // XSS检在
        if (FormValidator.containsXSS(value)) {
          callback(new Error(t('auth.validation.unsafeChars')))
          return
        }
        // 清理输入
        const sanitized = FormValidator.sanitizeInput(value)
        if (sanitized !== value) {
          accountForm.username = sanitized
        }
        // 格式验证：用户名、手机号或邮在
        const isUsername = /^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/.test(value)
        const isPhone = InputValidator.isValidPhone(value)
        const isEmail = InputValidator.isValidEmail(value)
        if (!isUsername && !isPhone && !isEmail) {
          callback(new Error(t('auth.validation.invalidUsernameOrPhoneOrEmail')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        // XSS检在
        if (FormValidator.containsXSS(value)) {
          callback(new Error(t('auth.validation.passwordUnsafeChars')))
          return
        }

        // 获取当前登录来源（user/sms=官网，admin/edu-*=跨项目）
        const currentSource = route.query.source as string
        const isCrossProjectLogin =
          currentSource && currentSource !== 'main' && currentSource !== 'user' && currentSource !== 'sms'

        // 跨项目登录时使用宽松的密码验证（子项目可能有不同的密码规则）
        if (isCrossProjectLogin) {
          // 跨项目登录：只做基本长度检在
          if (value.length < 1) {
            callback(new Error(t('auth.validation.passwordRequired')))
            return
          }
          callback()
          return
        }

        // 官网登录：严格的密码验证
        // 长度检在
        if (value.length < 8) {
          callback(new Error(t('auth.validation.passwordMinLength')))
          return
        }
        if (value.length > 20) {
          callback(new Error(t('auth.validation.passwordMaxLength')))
          return
        }
        // 密码强度检在- 必须包含字母、数字和特殊符号
        const hasLetter = /[a-zA-Z]/.test(value)
        const hasNumber = /\d/.test(value)
        const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)

        if (!hasLetter) {
          callback(new Error(t('auth.validation.passwordRequireLetter')))
          return
        }
        if (!hasNumber) {
          callback(new Error(t('auth.validation.passwordRequireNumber')))
          return
        }
        if (!hasSpecialChar) {
          callback(new Error(t('auth.validation.passwordRequireSpecial')))
          return
        }

        // 额外的密码强度检在
        const strengthResult = InputValidator.validatePasswordStrength(value)
        if (!strengthResult.valid) {
          callback(new Error(t('auth.passwordStrengthInsufficient')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  // 图形验证码（账号登录旁图片，多为 1在 位，与手机短信验证码无关在
  captcha: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!showCaptcha.value) {
          callback()
          return
        }
        const v = (value ?? '').trim()
        if (!v) {
          callback(new Error(t('auth.captchaPlaceholder')))
          return
        }
        // 1在 位数字或字母，兼容总管理端一位数/两位数图形验证码
        if (!/^[a-zA-Z0-9]{1,6}$/.test(v)) {
          callback(new Error(t('auth.imageCaptchaFormatError')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  // 仅注册模式校验（登录时跳过，避免未填写的注册项导致“请填写完整”）
  phone: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!isRegisterMode.value) {
          callback()
          return
        }
        if (!(value ?? '').trim()) {
          callback(new Error(t('auth.phonePlaceholder')))
          return
        }
        if (!/^1[3-9]\d{9}$/.test((value ?? '').trim())) {
          callback(new Error(t('auth.phoneFormatError')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  code: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!isRegisterMode.value) {
          callback()
          return
        }
        const v = (value ?? '').trim()
        if (!v) {
          callback(new Error(t('auth.captchaPlaceholder')))
          return
        }
        if (v.length < 4 || v.length > 6) {
          callback(new Error(t('auth.captchaLengthError')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!isRegisterMode.value) {
          callback()
          return
        }
        if (!(value ?? '').trim()) {
          callback(new Error(t('auth.confirmPasswordPlaceholder')))
          return
        }
        if (value !== accountForm.password) {
          callback(new Error(t('auth.passwordMismatch')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
})

// 手机号表在
const phoneFormRef = ref<FormInstance | undefined>(undefined)
const selectedCountryCode = ref<CountryCode>(getDefaultCountryCode())
const filteredCountryCodes = ref<CountryCode[]>(countryCodes)

// 确保 locale 同步后再计算选项
const countryCodeOptions = computed(() => {
  // 确保 locale 同步
  ensureLocaleSync()
  // 使用响应式的计算属在
  const isChinese = isChineseLanguage.value

  return filteredCountryCodes.value.map((country: CountryCode) => ({
    value: country.dialCode,
    label: `${isChinese ? country.name : country.nameEn} ${country.dialCode}`,
    country,
    dialCode: country.dialCode,
  }))
})

// 创建一个响应式的计算属性来获取current locale状在
const currentLanguage = computed(() => {
  ensureLocaleSync()
  return locale.value || 'zh-CN'
})

const isChineseLanguage = computed(() => {
  const lang = currentLanguage.value
  return lang === 'zh-CN' || lang === 'zh-TW'
})

// 监听语言变化，强制更新国家区号显在
watch(
  () => locale.value,
  (newLocale, oldLocale) => {
    if (newLocale !== oldLocale && newLocale) {
      // 确保 locale 同步
      ensureLocaleSync()
      // 强制触发响应式更在- 通过重新设置 selectedCountryCode
      nextTick(() => {
        const currentDialCode = selectedCountryCode.value.dialCode
        const country = countryCodes.find(c => c.dialCode === currentDialCode)
        if (country) {
          // 创建新对象以触发响应式更在
          selectedCountryCode.value = { ...country }
        }
        // 强制刷新 filteredCountryCodes 以触在countryCodeOptions 重新计算
        filteredCountryCodes.value = [...filteredCountryCodes.value]
      })
    }
  },
  { immediate: true, deep: true }
)

// 同时监听全局 i18n 实例的语言变化
if (typeof window !== 'undefined') {
  try {
    const i18nGlobal = (window as { __VUE_I18N__?: VueI18nGlobal }).__VUE_I18N__
    if (i18nGlobal?.global?.locale) {
      watch(
        () => i18nGlobal.global.locale.value,
        newLocale => {
          if (newLocale && newLocale !== locale.value) {
            locale.value = newLocale
            ensureLocaleSync()
            // 强制更新
            nextTick(() => {
              const currentDialCode = selectedCountryCode.value.dialCode
              const country = countryCodes.find(c => c.dialCode === currentDialCode)
              if (country) {
                selectedCountryCode.value = { ...country }
              }
              filteredCountryCodes.value = [...filteredCountryCodes.value]
            })
          }
        },
        { immediate: true }
      )
    }
  } catch (_e) {
    logger.debug('[UniversalLogin] Failed to initialize country code', _e)
  }
}

// 国家代码过滤函数
const filterCountryCodes = (query: string): void => {
  if (!query) {
    filteredCountryCodes.value = countryCodes
    return
  }
  const lowerQuery = query.toLowerCase()
  filteredCountryCodes.value = countryCodes.filter(
    country =>
      country.name.toLowerCase().includes(lowerQuery) ||
      country.nameEn.toLowerCase().includes(lowerQuery) ||
      country.dialCode.includes(query) ||
      country.code.toLowerCase().includes(lowerQuery)
  )
}
const phoneForm = reactive({
  phoneNumber: '',
  verificationCode: '',
  rememberMe: false,
})

// 登录协议同意状在
const loginAgreement = ref(false) // 账号密码登录协议同意
const phoneLoginAgreement = ref(false) // 手机号登录协议同在
const currentAgreement = ref(false) // 当前活跃协议状在

// 监听activeTab变化，同步currentAgreement
watch(
  () => activeTab.value,
  newTab => {
    currentAgreement.value = newTab === 'account' ? loginAgreement.value : phoneLoginAgreement.value
  },
  { immediate: true }
)

// 监听currentAgreement变化，同步到对应协议变量
watch(
  () => currentAgreement.value,
  newValue => {
    if (activeTab.value === 'account') {
      loginAgreement.value = newValue
    } else {
      phoneLoginAgreement.value = newValue
    }
  }
)

// 协议确认弹窗状在
const showAgreementConfirmDialog = ref(false) // 协议确认弹窗显示状在
const pendingAgreementType = ref<'account' | 'phone' | 'register' | null>(null) // 等待确认的操作类在

// 未查到账号时：设置邮箱与密码弹窗（登在注册按钮 在无账号则弹窗补全信息后注册并登录在
const showSetEmailPasswordDialog = ref(false)
const pendingRegisterAccount = ref('') // 当前输入的手机号/账号，用于注册时在username
const setEmailPasswordFormRef = ref<FormInstance | null>(null)
const setEmailPasswordLoading = ref(false)
const setEmailPasswordForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
})
const setEmailPasswordRules = {
  email: [
    { required: true, message: () => t('auth.pleaseEnterEmail'), trigger: 'blur' },
    { type: 'email', message: () => t('auth.pleaseEnterCorrectEmail'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: () => t('auth.validation.passwordRequired'), trigger: 'blur' },
    { min: 6, max: 20, message: () => t('auth.passwordLength6to20'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: () => t('auth.pleaseConfirmPassword'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (e?: Error) => void) => {
        if (value !== setEmailPasswordForm.password) {
          callback(new Error(t('auth.passwordsDoNotMatch')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

// 6位验证码输入框数在
const verificationCodeInputs = ref<string[]>(['', '', '', '', '', ''])
const verificationCodeInputRefs = ref<(HTMLInputElement | null)[]>([])

// 检查手机号登录表单是否完整
const _isPhoneFormComplete = computed(() => {
  const phoneNumber = phoneForm.phoneNumber?.trim() || ''
  const verificationCode = verificationCodeInputs.value.join('')
  return phoneNumber.length >= 6 && verificationCode.length === 6 && phoneLoginAgreement.value
})

// 生成手机号登录按钮的提示文本
// 检查账号密码登录表单是否完在
const _isAccountFormComplete = computed(() => {
  const username = accountForm.username?.trim() || ''
  const password = accountForm.password?.trim() || ''
  return username.length > 0 && password.length >= 8 && loginAgreement.value
})

// 登录按钮提示文字 - 根据当前标签页检查对应字在
const _currentLoginTooltipText = computed(() => {
  const missingItems: string[] = []

  if (activeTab.value === 'account') {
    // 账号密码登录模式：检查用户名和密在
    const username = accountForm.username?.trim() || ''
    const password = accountForm.password?.trim() || ''

    if (username.length === 0) {
      missingItems.push(t('auth.missingAccount'))
    }
    if (password.length < 6) {
      missingItems.push(t('auth.missingPassword'))
    }
    if (!loginAgreement.value) {
      missingItems.push(t('auth.missingServiceAgreement'))
    }
  } else {
    // 手机验证码登录模式：检查手机号和验证码
    const phoneNumber = phoneForm.phoneNumber?.trim() || ''
    if (phoneNumber.length < 6) {
      missingItems.push(t('auth.missingPhone'))
    }

    const verificationCode = verificationCodeInputs.value.join('')
    if (verificationCode.length !== 6) {
      missingItems.push(t('auth.missingCode'))
    }

    if (!phoneLoginAgreement.value) {
      missingItems.push(t('auth.missingServiceAgreement'))
    }
  }

  if (missingItems.length === 0) {
    return ''
  }

  if (missingItems.length === 1) {
    return t('auth.pleaseCompleteFirst', { item: missingItems[0] })
  } else {
    return t('auth.pleaseCompleteMultiple', { items: missingItems.join(', ') })
  }
})


// Login status - use userAuth loading state
const loading = computed(() => userAuth.loading.value)
const loginCooldown = ref(0) // Login cooldown（防暴力破解在
let loginCooldownTimer: number | null = null

// Login failed计数（用于触发验证码在
const loginFailureCount = ref(0)
const showCaptcha = ref(false)
const captchaKey = ref<string>('')

// 处理验证码刷新事件（在CaptchaInput 组件接收 uuid在
const handleCaptchaRefresh = (uuid: string) => {
  captchaKey.value = uuid
}

// 验证码发送状在
const sendingCode = ref(false)
const countdown = ref(0)
let countdownTimer: number | null = null

// 密码强度指示在
const passwordStrength = reactive({
  show: false,
  level: 'weak' as 'weak' | 'medium' | 'strong',
  width: 0,
  text: '',
})

// 安全提示
const showSecurityAlert = ref(false)
const securityAlertMessageSquare = ref('')

// 验证码发送状在
const codeSendStatus = reactive({
  message: '',
  type: 'info' as 'success' | 'error' | 'info' | 'warning',
})

// 国家区号选择器引在
const countryCodeSelectRef = ref<{ focus?: () => void; blur?: () => void } | null>(null)

// 处理国家代码变更
const handleCountryCodeChange = (value: CountryCode | string): void => {
  // 如果传入的是字符串（dialCode），则查找对应的国家
  if (typeof value === 'string') {
    const country = countryCodes.find(c => c.dialCode === value)
    if (country) {
      selectedCountryCode.value = country
    }
  } else if (value && typeof value === 'object' && 'dialCode' in value) {
    // 如果传入的是 CountryCode 对象，直接使在
    selectedCountryCode.value = value as CountryCode
  }
}

// 处理国家代码下拉框显在隐藏事件
// 当下拉框显示时，调整定位在country-code-text，左侧对在
const handleCountryCodeDropdownVisible = (visible: boolean): void => {
  if (visible) {
    nextTick(() => {
      // 查找下拉框的 popper 元素
      const popper = document.querySelector('.country-code-popper') as HTMLElement
      const countryCodeText = document.querySelector('.country-code-text') as HTMLElement

      if (popper && countryCodeText) {
        const textRect = countryCodeText.getBoundingClientRect()
        // 设置下拉框位置：左侧在country-code-text 左侧对齐
        popper.style.position = 'fixed'
        popper.style.top = `${textRect.bottom + 8}px`
        popper.style.left = `${textRect.left}px`
        popper.style.transform = 'none'
        popper.style.marginLeft = '0'
        popper.style.marginTop = '0'
        // 确保下拉框宽度合在
        popper.style.minWidth = '200px'
      }
    })
    // 使用 setTimeout 确保在Element Plus 完成定位后再调整
    setTimeout(() => {
      const popper = document.querySelector('.country-code-popper') as HTMLElement
      const countryCodeText = document.querySelector('.country-code-text') as HTMLElement

      if (popper && countryCodeText) {
        const textRect = countryCodeText.getBoundingClientRect()
        popper.style.position = 'fixed'
        popper.style.top = `${textRect.bottom + 8}px`
        popper.style.left = `${textRect.left}px`
        popper.style.transform = 'none'
        popper.style.marginLeft = '0'
        popper.style.marginTop = '0'
      }
    }, 50)
  }
}

// 处理国家代码文本点击事件 - 触发下拉框显在
const handleCountryCodeTextClick = (): void => {
  if (countryCodeSelectRef.value) {
    interface SelectInstance {
      toggleMenu?: () => void
      focus?: () => void
      blur?: () => void
    }
    const selectInstance = countryCodeSelectRef.value as SelectInstance | null
    // 尝试多种方式触发下拉在
    if (selectInstance?.toggleMenu) {
      selectInstance.toggleMenu()
    } else if (selectInstance?.focus) {
      selectInstance.focus()
      nextTick(() => {
        const selectEl = (selectInstance as { $el?: HTMLElement } | null)?.$el || (selectInstance as HTMLElement | null)
        if (selectEl) {
          const wrapper = selectEl.querySelector?.('.el-select__wrapper') as HTMLElement | null
          if (wrapper) {
            wrapper.click()
          } else {
            selectEl.click?.()
          }
        }
      })
    } else {
      nextTick(() => {
        const selectEl = (selectInstance as { $el?: HTMLElement } | null)?.$el || (selectInstance as HTMLElement | null)
        if (selectEl) {
          const wrapper = selectEl.querySelector?.('.el-select__wrapper') as HTMLElement | null
          if (wrapper) {
            wrapper.click()
          } else {
            selectEl.click?.()
          }
        }
      })
    }
  }
}

// 获取完整手机号（包含国家代码在
const getFullPhoneNumber = (): string => {
  if (!phoneForm.phoneNumber) return ''
  // 如果用户已经输入了国家代码，直接返回
  if (phoneForm.phoneNumber.startsWith('+')) {
    return phoneForm.phoneNumber
  }
  // 移除可能的空格和特殊字符
  const cleanPhone = phoneForm.phoneNumber.replace(/\s+/g, '')
  // 否则拼接国家代码
  return `${selectedCountryCode.value.dialCode}${cleanPhone}`
}

// 自动检测并设置国家代码
const autoDetectCountryCode = (): void => {
  if (!phoneForm.phoneNumber) return

  // 如果输入在开头，尝试解析国家代码
  if (phoneForm.phoneNumber.startsWith('+')) {
    // 尝试匹配已知的国家代码（1-4位数字）
    for (let i = 4; i >= 1; i--) {
      const potentialCode = phoneForm.phoneNumber.substring(0, 1 + i)
      const country = getCountryByDialCode(potentialCode)
      if (country) {
        selectedCountryCode.value = country
        // 移除国家代码，只保留手机在
        phoneForm.phoneNumber = phoneForm.phoneNumber.substring(potentialCode.length)
        return
      }
    }
  }
}

// 计算是否可以发送验证码（支持国际手机号在
// 验证手机号是否符合当前区号的号段规则
const validatePhoneByCountryCode = (phone: string, countryCode: CountryCode): boolean => {
  if (!phone || phone.trim() === '') return false

  // 移除国家代码前缀（如果用户已经输入）和空在
  const phoneWithoutCode = phone.replace(/^\+\d+/, '').replace(/\s+/g, '')

  // 检查是否全为数在
  if (!/^\d+$/.test(phoneWithoutCode)) return false

  // 根据不同国家代码验证手机号格在
  const dialCode = countryCode.dialCode.replace(/^\+/, '')

  switch (dialCode) {
    case '86': // 中国
      // 中国手机号：11位，在开头，第二位是3-9
      return /^1[3-9]\d{9}$/.test(phoneWithoutCode)
    case '1': // 美国/加拿在
      // 美国/加拿大：10位数在
      return /^\d{10}$/.test(phoneWithoutCode)
    case '44': // 英国
      // 英国在0-11位数字，通常在开头（去掉0后是10位）
      return /^\d{10,11}$/.test(phoneWithoutCode)
    case '81': // 日本
      // 日本在0-11位数在
      return /^\d{10,11}$/.test(phoneWithoutCode)
    case '82': // 韩国
      // 韩国在0-11位数在
      return /^\d{10,11}$/.test(phoneWithoutCode)
    case '852': // 香港
      // 香港在位数在
      return /^\d{8}$/.test(phoneWithoutCode)
    case '853': // 澳门
      // 澳门在位数在
      return /^\d{8}$/.test(phoneWithoutCode)
    case '886': // 台湾
      // 台湾在-10位数在
      return /^\d{9,10}$/.test(phoneWithoutCode)
    default:
      // 其他国家的通用验证在-15位数在
      return phoneWithoutCode.length >= 6 && phoneWithoutCode.length <= 15
  }
}

const canSendCode = computed(() => {
  if (!phoneForm.phoneNumber || phoneForm.phoneNumber.trim() === '') return false

  // 使用当前选中的国家代码验证手机号
  return validatePhoneByCountryCode(phoneForm.phoneNumber, selectedCountryCode.value)
})

// SSO 登录：接通官网登录表单，在此输入账号密码后获在token，携在token 跳转总管理端首页
const handleSSOLogin = async (): Promise<void> => {
  activeTab.value = 'account'
  showCaptcha.value = true
  await nextTick()

  loginFailureCount.value = 0
  passwordStrength.show = false
  showSecurityAlert.value = false
  verificationCodeInputs.value = ['', '', '', '', '', '']
  phoneForm.verificationCode = ''
  if (accountFormRef.value) accountFormRef.value.clearValidate(undefined)
  if (phoneFormRef.value) phoneFormRef.value.clearValidate(undefined)

  const projectInfo = availableProjects.value.find(p => p.key === 'admin')
  const adminBaseUrl = (projectInfo?.url ?? '').replace(/\/$/, '')
  const redirectTarget = adminBaseUrl ? `${adminBaseUrl}/index` : ''
  // 仅缓存企业登录目标地址，暂不触发跨项目跳转
  adminRedirectUrl.value = redirectTarget

  const currentQuery = { ...route.query } as Record<string, string>
  currentQuery.source = 'admin'
  await router.replace({
    path: '/login',
    query: currentQuery,
  } as unknown as Parameters<typeof router.replace>[0])
}

/**
 * 企业登录（总管理端）：独立完成认证与跳在
 * 调用 POST /api/auth/login，成功则写登录态并跳转在adminRedirectUrl 在route.query.redirect
 */
const handleEnterpriseLogin = async (
  account: string,
  password: string,
  captchaCode: string,
  captchaUuid: string
): Promise<void> => {
  try {
    const response = await unifiedLogin('admin', {
      phone: account,
      password,
      code: captchaCode,
      uuid: captchaUuid,
    })

  if (!response.success) {
    const msgStr = (response.message || response.msg || '').trim()
    const looksLikeNotRegistered =
      msgStr.includes('not registered') ||
      msgStr.includes('click below to register') ||
      msgStr.includes(t('auth.userNotRegistered'))
    const displayMsg = looksLikeNotRegistered
      ? t('auth.adminLoginNotRegisteredHint')
      : msgStr || t('auth.loginFailed')
    showError(displayMsg)
    return
  }

  const data = response.data
  const token =
    (data?.token as string) ||
    (data?.accessToken as string) ||
    (data?.access_token as string)
  const refreshToken =
    (data?.refreshToken as string) ||
    (data?.refresh_token as string) ||
    ''
  const expiresInSeconds =
    (data?.expiresIn as number) ||
    (data?.expires_in as number) ||
    AuthFlowService.calculateExpiresInSeconds()
  const userData =
    (data?.user as Record<string, unknown>) ||
    (data?.userInfo as Record<string, unknown>)

  if (!token) {
    showError(t('auth.loginFailedNoToken'))
    return
  }

  saveHistoryAccount(account)

  if (accountForm.rememberMe && refreshToken) {
    RememberMeService.setRememberMePreference(true)
    RememberMeService.saveRefreshToken(refreshToken)
    RememberMeService.saveAccountCredentials(account, refreshToken)
  }

  const userForStore = userData || { uuid: '', id: '', username: account }
  if (!(userForStore as Record<string, unknown>).uuid && !(userForStore as Record<string, unknown>).id) {
    (userForStore as Record<string, unknown>).uuid = (userForStore as Record<string, unknown>).id || ''
  }

  ElMessage.success(t('auth.loginSuccess'))

  // 跳转方式与教育平台保持一致，但企业登录改为“新开窗口”：
  // 1. 优先使用缓存在adminRedirectUrl（由 handleSSOLogin 拼接在
  // 2. 否则使用 query.redirect，并进行多次 decode
  // 3. 若仍为空且为企业/跨项目来源，用总管理端默认地址，确保企业登录后一定会跳转
  let redirectUrl = adminRedirectUrl.value || (route.query.redirect as string) || ''
  if (redirectUrl && !adminRedirectUrl.value) {
    let prevDecoded = ''
    while (redirectUrl !== prevDecoded) {
      prevDecoded = redirectUrl
      try {
        redirectUrl = decodeURIComponent(redirectUrl)
      } catch {
        break
      }
    }
  }

  const source = (route.query.source as string) || 'admin'
  const isCrossProjectSource = source && ['admin', 'edu-web', 'edu-admin'].includes(source)

  // 企业登录时若没有 redirect，使用总管理端默认首页，避免登录成功但不跳在
  if (source === 'admin' && !redirectUrl) {
    const projectInfo = availableProjects.value.find(p => p.key === 'admin')
    const adminBaseUrl = (projectInfo?.url ?? '').replace(/\/$/, '')
    redirectUrl = adminBaseUrl ? `${adminBaseUrl}/index` : ''
  }

  // 企业登录：跨项目且有 redirect 时，使用与教育平台相同的参数拼接方式在
  // 但通过 window.open 在新窗口中跳转；否则留在当前页，不在官网内完成登录跳在
  if (isCrossProjectSource && redirectUrl) {
    try {
      const redirectUrlObj = new URL(redirectUrl)

      if (token) {
        // 同时提供 token 在access_token 两种字段，兼容不同后端约在
        redirectUrlObj.searchParams.set('token', token)
        redirectUrlObj.searchParams.set('access_token', token)
      }
      if (refreshToken) {
        redirectUrlObj.searchParams.set('refreshToken', refreshToken)
      }
      if (expiresInSeconds) {
        // 同时提供 expiresIn 在expires_in
        redirectUrlObj.searchParams.set('expiresIn', String(expiresInSeconds))
        redirectUrlObj.searchParams.set('expires_in', String(expiresInSeconds))
      }
      if (userForStore) {
        redirectUrlObj.searchParams.set(
          'userInfo',
          encodeURIComponent(JSON.stringify(userForStore as Record<string, unknown>))
        )
      }

      const finalUrl = redirectUrlObj.toString()
      logger.info('[handleEnterpriseLogin] New window cross-project redirect', { url: finalUrl })
      window.open(finalUrl, '_blank')
      return
    } catch (error) {
      logger.error('[handleEnterpriseLogin] Failed to build enterprise login redirect URL, falling back to default redirect', { error })
    }
  }

  // Non cross-project or not in redirect, don't redirect within website, just stay on current page
  logger.warn('[handleEnterpriseLogin] Missing valid cross-project redirect address, staying on current login page', {
    source,
    redirectUrl,
  })
  } catch (error) {
    logger.error('[handleEnterpriseLogin] 登录失败', { error })
    showError(t('auth.loginFailed'))
  }
}

// 切换登录方式并同在source 别名：user=账号密码登录，sms=手机号短信登在
const switchTab = async (tab: 'account' | 'phone'): Promise<void> => {
  activeTab.value = tab
  loginFailureCount.value = 0
  showCaptcha.value = false
  passwordStrength.show = false
  showSecurityAlert.value = false
  verificationCodeInputs.value = ['', '', '', '', '', '']
  phoneForm.verificationCode = ''
  if (accountFormRef.value) {
    accountFormRef.value.clearValidate(undefined)
  }
  if (phoneFormRef.value) {
    phoneFormRef.value.clearValidate(undefined)
  }
  // 跳转别名：账号密码登在user，手机号短信登录=sms（保留其在query在
  const sourceAlias = tab === 'account' ? 'user' : 'sms'
  const nextQuery = { ...route.query, source: sourceAlias }
  await router.replace({
    path: '/login',
    query: nextQuery as Record<string, string | string[]>,
  } as unknown as Parameters<typeof router.replace>[0])
}

// 企业登录/用户登录切换：企业模式下点击切回手机登录，否则执行企业登在
const handleSSOOrUserLoginClick = (): void => {
  if (isEnterpriseLoginMode.value) {
    switchTab('phone')
  } else {
    handleSSOLogin()
  }
}

// handleUsernameInput已移除，清理逻辑已合并到handleUsernameInputChange在

// 处理密码输入
const handlePasswordInput = (value: string): void => {
  if (!value) {
    passwordStrength.show = false
    return
  }

  passwordStrength.show = true
  const strengthResult = InputValidator.validatePasswordStrength(value)
  passwordStrength.level = strengthResult.strength

  // 设置宽度和文在
  switch (strengthResult.strength) {
    case 'weak':
      passwordStrength.width = 33
      passwordStrength.text = t('auth.passwordStrengthWeakText')
      break
    case 'medium':
      passwordStrength.width = 66
      passwordStrength.text = t('auth.passwordStrengthMediumText')
      break
    case 'strong':
      passwordStrength.width = 100
      passwordStrength.text = t('auth.passwordStrengthStrongText')
      break
  }
}


// 密码重置对话在
const showPasswordResetDialog = ref(false)



// 微信二维码登录弹在
const showWechatQrDialog = ref(false)

// 微信登录绑定手机号弹在
const showWechatPhoneBindDialog = ref(false)
// 账号密码注册成功后绑定手机号弹窗（手机号+验证码，与登录页手机表单一致）
const showBindPhoneAfterRegisterDialog = ref(false)
const wechatBindInfo = reactive({
  unionId: '',
  openId: '',
  platformType: '',
})

// 微信登录message监听器（确保只添加一次）
let wechatMessageHandler: ((e: globalThis.MessageEvent) => void) | null = null
let isWechatMessageListenerAdded = false

type WechatCallbackPayload = {
  // 旧版：仅携带 code/openid/unionId 在
  unionId?: string
  openid?: string
  'platform-type'?: string
  code?: string | number

  // 新版：后端回调页通过 postMessage 直接给出用户主体数据
  uuid?: string
  nickname?: string
  avatar?: string
  gender?: number
  status?: number
  isVip?: number | boolean
  inviteCode?: string
  createdAt?: number | string
  updatedAt?: number | string
  authInfo?: { userUuid?: string; phone?: string; email?: string;[k: string]: unknown }
  thirdPartyAccounts?: {
    accessToken?: string
    refreshToken?: string
    [k: string]: unknown
  }

  // 可能存在的敏感字段（前端不应落库/展示在
  passwordHashByAuth?: unknown
  passwordSaltByAuth?: unknown

  [k: string]: unknown
}

const _tryParseJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    // atob 需要补在padding
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)

    // 优先尝试直接解析（大部分 JWT payload 在ASCII/UTF-8 兼容在
    try {
      const raw = atob(padded)
      const directParsed = JSON.parse(raw) as unknown
      if (directParsed && typeof directParsed === 'object') return directParsed as Record<string, unknown>
    } catch {
      // ignore and fallback to unicode-safe decode
    }

    // unicode-safe fallback
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const _normalizeWechatCallbackToUserInfo = (
  data: WechatCallbackPayload,
  jwtPayload?: Record<string, unknown> | null
): UserInfo => {
  const uuid = String(
    data.uuid ||
    data.authInfo?.userUuid ||
    (jwtPayload?.uuid as string) ||
    (jwtPayload?.userUuid as string) ||
    (jwtPayload?.sub as string) ||
    ''
  )
  const toIso = (v: unknown) => {
    if (typeof v === 'number') return new Date(v).toISOString()
    if (typeof v === 'string') {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) return new Date(n).toISOString()
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
    return new Date().toISOString()
  }
  const now = new Date().toISOString()
  const nickname =
    String(
      data.nickname ||
      (data.thirdPartyAccounts as { nickname?: string } | undefined)?.nickname ||
      (jwtPayload?.nickname as string) ||
      (jwtPayload?.name as string) ||
      ''
    ) || t('universalLogin.defaultUser')
  const phone = String(
    data.authInfo?.phone || (jwtPayload?.phone as string) || (jwtPayload?.mobile as string) || ''
  )
  const email = String(data.authInfo?.email || (jwtPayload?.email as string) || '')
  return {
    id: uuid,
    uuid,
    username: String(nickname || phone || email || ''),
    email,
    phone,
    avatar: String((data as { avatar?: string }).avatar || ''),
    nickname,
    gender: typeof data.gender === 'number' ? data.gender : 0,
    birthday: '',
    signature: '',
    status: typeof data.status === 'number' ? data.status : 1,
    isVip: Boolean(data.isVip),
    inviteCode: String(data.inviteCode || ''),
    createTime: data.createdAt != null ? toIso(data.createdAt) : now,
    updateTime: data.updatedAt != null ? toIso(data.updatedAt) : now,
  } as unknown as UserInfo
}

// 添加微信登录message监听在
const addWechatMessageListener = (): void => {
  if (isWechatMessageListenerAdded) {
    return
  }

  wechatMessageHandler = async (e: globalThis.MessageEvent) => {
    logger.debug('Received message event', { origin: e.origin, data: e.data })

    // 安全校验1：只接收指定域名/地址的消息（防止恶意网站伪造消息）
    const allowedOrigin = '*'
    if (allowedOrigin !== '*' && e.origin !== allowedOrigin) {
      logger.warn('Received message from untrusted domain, blocked', { origin: e.origin })
      return
    }

    // 统一成对象：支持 postMessage 发字符串 JSON
    let raw: unknown = e.data
    if (typeof e.data === 'string') {
      try {
        raw = JSON.parse(e.data as string) as unknown
      } catch {
        logger.warn('WeChat message is not JSON string, ignored', { data: e.data })
        return
      }
    }
    if (raw === null || typeof raw !== 'object') {
      logger.warn('Invalid message data format', { raw })
      return
    }

    const loginData = raw as WechatCallbackPayload
    // Ignore WeChat JS-SDK status messages (wxQRcodeReady / wxReady, etc.), don't redirect or close popup
    if ((loginData as { type?: string }).type === 'status') {
      logger.debug('Ignoring WeChat SDK status message', { status: (loginData as { status?: string }).status })
      return
    }

    // 只处理真正的微信登录回调（必须包在code 在unionId 在openid在
    const hasLoginData = loginData.code != null || loginData.unionId || loginData.openid || loginData.thirdPartyAccounts
    if (!hasLoginData) {
      logger.debug('Ignoring non-login callback message', { loginData })
      return
    }

    logger.info('[WeChat Login] Received login callback data', loginData)

    // 提取关键信息
    const unionId = loginData.unionId
    const openid = loginData.openid
    const platformType = loginData['platform-type']
    const code = loginData.code != null ? String(loginData.code) : undefined

    logger.debug('WeChat login callback code', { code })

    // code是字符串类型 "40101" 表示需要绑定手机号
    if (code === '40101') {
      logger.info('[WeChat Login] Phone binding required, opening phone binding dialog', { unionId, openid, platformType })

      // 保存微信登录信息
      wechatBindInfo.unionId = unionId || ''
      wechatBindInfo.openId = openid || ''
      wechatBindInfo.platformType = platformType || ''

      // 关闭微信登录二维码对话框
      showWechatQrDialog.value = false

      // 打开手机绑定弹窗
      showWechatPhoneBindDialog.value = true
      return
    }

    // 新版：回调页直接 postMessage 用户数据（包在thirdPartyAccounts.accessToken在
    const token = String(loginData?.thirdPartyAccounts?.accessToken || '')
    const refreshToken = String(loginData?.thirdPartyAccounts?.refreshToken || '')
    if (token) {
      try {
        logger.info('[WeChat Login] Token detected, starting login process', {
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
          uuid: loginData.uuid,
          phone: loginData.authInfo?.phone,
        })

        // 直接使用原始 loginData 传递给 AuthFlowService
        // AuthFlowService.normalizeUserInfo 会正确提在userMargin、authInfo 等信在
        const processResult = await AuthFlowService.processLoginResponse(
          token,
          refreshToken,
          loginData as Record<string, unknown>
        )

        if (processResult.success) {
          if (refreshToken) {
            RememberMeService.setRememberMePreference(true)
            RememberMeService.saveRefreshToken(refreshToken)
          }
          RememberMeService.resetAutoLoginRecord()
          logger.info('[WeChat Login] Login successful, preparing to redirect to home')
          AuthFlowService.showSuccess(t('auth.wechatLoginSuccess'))
          showWechatQrDialog.value = false
          router.push('/').catch(() => {
            window.location.href = '/'
          })
        } else {
          throw new Error(t('error.universal_login.登录状态保存失在'))
        }
      } catch (err) {
        logger.error('[WeChat Login] Login callback processing failed', err)
        showError(t('universalLogin.wechatCallbackFailed'))
        showWechatQrDialog.value = false
      }
      return
    }

    // 旧版/兜底：没在token 的情况下，仍然跳转首页（但不会有登录态）
    logger.info('[WeChat Login] Login successful (no token), redirecting to home')
    router.push('/').catch(() => {
      window.location.href = '/'
    })

    // 关闭微信登录对话在
    showWechatQrDialog.value = false
  }

  window.addEventListener('message', wechatMessageHandler, false)
  isWechatMessageListenerAdded = true
  logger.info('[WeChat Login] message listener added')
}

// 移除微信登录message监听在
const removeWechatMessageListener = (): void => {
  if (wechatMessageHandler && isWechatMessageListenerAdded) {
    window.removeEventListener('message', wechatMessageHandler)
    isWechatMessageListenerAdded = false
    wechatMessageHandler = null
    logger.info('[WeChat Login] message listener removed')
  }
}

// 微信登录绑定手机号成功回在
const handleWechatPhoneBindSuccess = async (data: {
  phone: string
  code: string
  token?: string
  refreshToken?: string
  userInfo?: Record<string, unknown>
}): Promise<void> => {
  logger.info('[WeChat Login] Phone binding successful', {
    phone: data.phone,
    hasToken: !!data.token,
    hasRefreshToken: !!data.refreshToken,
    hasUserInfo: !!data.userInfo,
  })

  // 如果返回在token，直接使在AuthFlowService 处理登录
  if (data.token) {
    try {
      const processResult = await AuthFlowService.processLoginResponse(
        data.token,
        data.refreshToken || '', // 使用返回在refreshToken
        data.userInfo || {}
      )

      if (processResult.success) {
        AuthFlowService.showSuccess(t('auth.wechatLoginSuccess'))
        showWechatPhoneBindDialog.value = false
        wechatBindInfo.unionId = ''
        wechatBindInfo.openId = ''
        wechatBindInfo.platformType = ''

        if (tryShowAccountBindDialogThenRedirect((getAuthUser() as unknown as Record<string, unknown>) || (data.userInfo as Record<string, unknown>))) return
        router.push('/').catch(() => { window.location.href = '/' })
      } else {
        showError(t('error.universal_login.登录状态保存失在'))
      }
    } catch (err) {
      logger.error('[WeChat Login] Failed to process login after phone binding', { err })
      showError(t('auth.loginFailed'))
    }
  } else {
    // 没有 token，提示用户重新登在
    showSuccess(t('auth.bindPhoneSuccess'))
    showWechatPhoneBindDialog.value = false
    // 清空绑定信息
    wechatBindInfo.unionId = ''
    wechatBindInfo.openId = ''
    wechatBindInfo.platformType = ''
  }
}

// 微信登录绑定手机号取消回在
const handleWechatPhoneBindCancel = (): void => {
  logger.info('[WeChat Login] User cancelled phone binding')
  showWechatPhoneBindDialog.value = false
  // 清空绑定信息
  wechatBindInfo.unionId = ''
  wechatBindInfo.openId = ''
  wechatBindInfo.platformType = ''
}

// 账号密码注册成功后绑定手机号弹窗 - 绑定成功（已登录用户补全手机号，在token 回传在
const handleBindPhoneAfterRegisterSuccess = async (_data: {
  phone: string
  code: string
  token?: string
  refreshToken?: string
  userInfo?: Record<string, unknown>
}): Promise<void> => {
  try {
    showBindPhoneAfterRegisterDialog.value = false
    if (_data.token) {
      await AuthFlowService.processLoginResponse(
        _data.token,
        _data.refreshToken || '',
        _data.userInfo || {}
      )
    }
    if (tryShowAccountBindDialogThenRedirect()) return
    router.push('/').catch(() => { window.location.href = '/' })
  } catch (error) {
    logger.error('[handleBindPhoneAfterRegisterSuccess] 绑定手机号失败', { error })
    showError(t('auth.loginFailed'))
  }
}

const handleBindPhoneAfterRegisterCancel = (): void => {
  showBindPhoneAfterRegisterDialog.value = false
  router.push('/').catch(() => { window.location.href = '/' })
}

// 初始化微信登录二维码
const initWechatQrCode = (): void => {
  try {
    // 检查微信登录JS是否已加在
    if ((window as unknown as Record<string, unknown>).WxLogin) {
      // 已加载，直接初始化二维码
      createWechatQrCode()
      return
    }

    // 添加message监听器（只添加一次）
    addWechatMessageListener()

    // 动态加载微信登录JS（使用HTTPS在
    const script = document.createElement('script')
    script.src = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js'
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      logger.info('[WeChat Login] JS loaded successfully')
      createWechatQrCode()
    }
    script.onerror = () => {
      logger.error('[WeChat Login] Component loading failed')
      showError(t('universalLogin.wechatLoadFailed'))
    }
    document.head.appendChild(script)
  } catch (error) {
    logger.error('Failed to initialize WeChat QR code:', error)
    showError(t('universalLogin.wechatInitFailed'))
  }
}

// 创建微信二维在
const createWechatQrCode = (): void => {
  try {
    // 清除之前的微信登录实在
    const container = document.getElementById('wechat-qrcode-container')
    if (container) {
      container.innerHTML = ''
    }

    const wechatRedirectUri = import.meta.env.VITE_WECHAT_PC_REDIRECT_URI || '/prod-api/ai/login/wechat/pc/wxCode'
    const wechatAppId = import.meta.env.VITE_WECHAT_APP_ID || ''

    const WxLoginCtor = (window as { WxLogin?: new (config: unknown) => unknown }).WxLogin
    if (WxLoginCtor) {
      const _wxLogin = new WxLoginCtor({
      self_redirect: true,
      id: 'wechat-qrcode-container',
      appid: wechatAppId,
      scope: 'snsapi_login',
      redirect_uri: encodeURIComponent(wechatRedirectUri),
      state: Date.now().toString(),
      style: 'black',
      href: '',
      fastlogin: 1, // 快捷登录参数（无下划线格式）
      onReady: (isReady: boolean) => {
        logger.debug('WeChat QR code loading status', { isReady })
      },
      onQRcodeReady: () => {
        logger.info('[WeChat Login] QR code loaded')
      },
      onLoginSuccess: (_res: unknown) => {
        logger.debug('WeChat login success callback', _res)
      },
      onLoginError: (err: unknown) => {
        logger.warn('WeChat login error callback', err)
      }
    })
    }
    // message监听器已在initWechatQrCode中添加，这里不需要重复添在

  } catch (error) {
    logger.error('Failed to create WeChat QR code', { error })
    showError(t('universalLogin.wechatQrFailed'))
  }
}

// 账号绑定弹窗（仅登录页展示）
const showAccountBindDialog = ref(false)
// 补全邮箱/密码后关闭弹窗时需跳转首页
const redirectToHomeAfterAccountBindDialog = ref(false)

/** 判断当前用户是否需要补全邮在密码（未填邮箱或 needPwd=1在*/
const needAccountBind = (user: Record<string, unknown> | null | undefined): boolean => {
  if (!user) return false
  const email = user?.email != null ? String(user.email) : ''
  const needPwd = Number(user?.needPwd ?? (user as Record<string, unknown>)?.need_pwd ?? 0) || 0
  return email === '' || needPwd === 1
}

// 打开绑定弹窗时写入的 needPwd（与 needAccountBind 同源，保证弹窗内密码框是否可填与判断一致）
const bindDialogNeedPwdRef = ref(1)

/** 若需要补全邮在密码则打开账号绑定弹窗并返在true，否则返在false（调用方据此决定是否跳转首页在*/
const tryShowAccountBindDialogThenRedirect = (user?: Record<string, unknown> | null): boolean => {
  const u = user ?? (getAuthUser() as Record<string, unknown> | null)
  if (!needAccountBind(u)) return false
  const rawNeedPwd = u?.needPwd ?? (u as Record<string, unknown>)?.need_pwd
  const needPwd = rawNeedPwd !== undefined && rawNeedPwd !== null ? Number(rawNeedPwd) : 1
  bindDialogNeedPwdRef.value = Number.isFinite(needPwd) ? needPwd : 1
  redirectToHomeAfterAccountBindDialog.value = true
  sessionStorage.setItem('__account_bind_dialog_open__', '1')
  showAccountBindDialog.value = true
  return true
}

// 账号绑定弹窗使用的用在uuid在api/login/pwd/modify/password 接口必传在
const bindDialogUuid = computed(() => {
  if (authStore.isLoggedIn && authStore.user) {
    const u = authStore.user as Record<string, unknown>
    return (u.uuid ?? u.id ?? '') as string
  }
  return ''
})

// 账号绑定弹窗的初始数据（已登录时优先在authStore 用户信息；needPwd 来自打开弹窗时写入的 ref在
const bindDialogInitialData = computed(() => {
  const needPwd = bindDialogNeedPwdRef.value
  if (authStore.isLoggedIn && authStore.user) {
    const u = authStore.user as Record<string, unknown>
    return {
      email: (u.email != null && u.email !== '') ? String(u.email) : (accountForm.email || ''),
      username: (u.phone ?? u.nickname ?? accountForm.username) as string || '',
      password: accountForm.password || '',
      needPwd,
    }
  }
  return {
    email: accountForm.email || '',
    username: accountForm.username || '',
    password: accountForm.password || '',
    needPwd,
  }
})


// ========== 二维码位置更新系统已移除 ==========
// 二维码面板已移至页面中间，使在fixed 定位，无需动态计算位在

// 处理忘记密码
const handleForgotPassword = (): void => {
  showPasswordResetDialog.value = true
}

// 密码重置成功回调
const handlePasswordResetSuccess = (): void => {
  showSuccess(t('auth.resetPasswordSuccess'))
  showPasswordResetDialog.value = false
  // 可以切换到账号密码登在
  activeTab.value = 'account'
  accountForm.username = ''
  accountForm.password = ''
}



// 发送注册验证码
const sendRegisterCode = async (): Promise<void> => {
  if (!accountForm.phone) {
    showWarning(t('auth.phonePlaceholder'))
    return
  }

  if (!InputValidator.isValidPhone(accountForm.phone)) {
    showWarning(t('auth.phoneFormatError'))
    return
  }

  try {
    await apiSendVerificationCode({
      type: 'phone',
      target: accountForm.phone,
    })
    showSuccess(t('auth.codeSentSuccess'))

    // 开始倒计在
    registerCodeCountdown.value = 60
    if (registerCodeCountdownTimer) {
      clearInterval(registerCodeCountdownTimer)
    }
    registerCodeCountdownTimer = window.setInterval(() => {
      registerCodeCountdown.value--
      if (registerCodeCountdown.value <= 0) {
        if (registerCodeCountdownTimer) {
          clearInterval(registerCodeCountdownTimer)
          registerCodeCountdownTimer = null
        }
      }
    }, 1000)
  } catch (error: unknown) {
    showError((error instanceof Error ? error.message : String(error)) || t('auth.codeSendFailed'))
  }
}

// 统一登录按钮点击：当前是账号/SSO 则账号密码登录，是手机则手机验证码登在
const onLoginButtonClick = (): void => {
  if (loginCooldown.value > 0) return
  if (activeTab.value === 'account') {
    handleLoginButtonClick()
  } else {
    handlePhoneLogin()
  }
}

// 处理登录按钮点击 - 直接执行登录/注册，账号绑定弹窗由首页根据需决定是否展示
const handleLoginButtonClick = async (): Promise<void> => {
  trackLoginClick('password')
  const agreementChecked = isRegisterMode.value ? accountAgreement.value : loginAgreement.value
  if (!agreementChecked) {
    // 显示协议确认弹窗
    pendingAgreementType.value = isRegisterMode.value ? 'register' : 'account'
    showAgreementConfirmDialog.value = true
    return
  }

  if (isRegisterMode.value) {
    await handleAccountRegister()
  } else {
    await handleAccountLogin()
  }
}

// 协议确认弹窗 - 取消
const handleAgreementDialogCancel = (): void => {
  showAgreementConfirmDialog.value = false
  pendingAgreementType.value = null
}

// 协议确认弹窗 - 确认同意
const handleAgreementDialogConfirm = (): void => {
  // 关闭弹窗
  showAgreementConfirmDialog.value = false

  // 根据操作类型自动勾选对应的协议复选框
  if (pendingAgreementType.value === 'account') {
    loginAgreement.value = true
    currentAgreement.value = true
  } else if (pendingAgreementType.value === 'phone') {
    phoneLoginAgreement.value = true
    currentAgreement.value = true
  } else if (pendingAgreementType.value === 'register') {
    accountAgreement.value = true
  }

  // 1秒后自动执行对应的登在注册操作
  const operationType = pendingAgreementType.value
  pendingAgreementType.value = null

  setTimeout(() => {
    if (operationType === 'account') {
      handleLoginButtonClick()
    } else if (operationType === 'phone') {
      handlePhoneLogin()
    } else if (operationType === 'register') {
      handleLoginButtonClick()
    }
  }, 1000)
}

// 未查到账号时：设置邮箱与密码弹窗 - 提交注册并登在
const handleSetEmailPasswordSubmit = async (): Promise<void> => {
  if (!setEmailPasswordFormRef.value) return
  try {
    await setEmailPasswordFormRef.value.validate()
  } catch {
    return
  }
  const account = pendingRegisterAccount.value.trim()
  if (!account) {
    showError(t('auth.usernameOrPhoneOrEmail'))
    return
  }
  setEmailPasswordLoading.value = true
  try {
    const registerResponse = await register({
      username: account,
      email: setEmailPasswordForm.email.trim(),
      password: setEmailPasswordForm.password,
      confirmPassword: setEmailPasswordForm.confirmPassword,
    })
    const raw = registerResponse as unknown as Record<string, unknown>
    const code = (raw?.code as number | string) ?? 0
    const data = raw?.data as Record<string, unknown> | undefined
    const isSuccess = (code === 200 || code === '200' || raw?.success === true) && (data || raw?.token)
    if (!isSuccess) {
      const msg = (raw?.message ?? raw?.msg ?? t('auth.registerFailed')) as string
      showError(msg)
      return
    }
    let token = ''
    let refreshTokenValue = ''
    let userInfo: Record<string, unknown> | undefined
    if (data && typeof data === 'object') {
      const thirdPartyAccounts = data.thirdPartyAccounts as Record<string, unknown> | undefined
      token =
        (thirdPartyAccounts?.accessToken as string) ||
        (data.accessToken as string) ||
        (data.token as string) ||
        ''
      refreshTokenValue = (thirdPartyAccounts?.refreshToken as string) || (data.refreshToken as string) || ''
      userInfo = (data.user as Record<string, unknown>) || data as Record<string, unknown>
    } else {
      token = (raw.token as string) || (raw.accessToken as string) || ''
      refreshTokenValue = (raw.refreshToken as string) || ''
      userInfo = (raw.user as Record<string, unknown>) || undefined
    }
    if (!token) {
      showError(t('auth.registerResponseMissingToken'))
      return
    }
    const processResult = await AuthFlowService.processLoginResponse(
      token,
      refreshTokenValue,
      userInfo
    )
    if (!processResult.success) {
      showError(t('auth.registerSuccessButLoginFailed'))
      return
    }
    showSetEmailPasswordDialog.value = false
    AuthFlowService.showSuccess(t('auth.registerAndLoginSuccess'))
    await nextTick()
    const source = route.query.source as string
    const redirectUrl = route.query.redirect as string
    if (source && ['admin', 'edu-web', 'edu-admin'].includes(source) && redirectUrl) {
      await AuthFlowService.redirectAfterLogin({
        source,
        redirectUrl,
        token,
        refreshToken: refreshTokenValue,
        expiresIn: AuthFlowService.calculateExpiresInSeconds(),
        userInfo,
      })
    } else {
      await AuthFlowService.redirectAfterLogin()
    }
  } catch (err) {
    logger.error('[handleSetEmailPasswordSubmit] Registration failed', err)
    showError(err instanceof Error ? err.message : t('auth.registerFailed'))
  } finally {
    setEmailPasswordLoading.value = false
  }
}

// 处理账号绑定弹窗确认
const handleBindDialogConfirm = async (data: { email: string; username: string; password: string }): Promise<void> => {
  accountForm.username = data.username
  accountForm.password = data.password
  accountForm.email = data.email

  showAccountBindDialog.value = false
  sessionStorage.removeItem('__account_bind_dialog_open__')

  if (redirectToHomeAfterAccountBindDialog.value) {
    redirectToHomeAfterAccountBindDialog.value = false
    router.push('/').catch(() => { window.location.href = '/' })
    return
  }

  if (isRegisterMode.value) {
    await handleAccountRegister()
  } else {
    await handleAccountLogin()
  }
}

// 处理账号绑定弹窗取消
const handleBindDialogCancel = (): void => {
  showAccountBindDialog.value = false
  sessionStorage.removeItem('__account_bind_dialog_open__')
  if (redirectToHomeAfterAccountBindDialog.value) {
    redirectToHomeAfterAccountBindDialog.value = false
    router.push('/').catch(() => { window.location.href = '/' })
  }
}

// 账号密码注册
const handleAccountRegister = async (): Promise<void> => {
  if (!accountFormRef.value) return

  try {
    // 验证表单
    await accountFormRef.value.validate()

    // 验证用户协议（注册模式使在accountAgreement，登录模式使在loginAgreement在
    const agreementChecked = isRegisterMode.value ? accountAgreement.value : loginAgreement.value
    if (!agreementChecked) {
      showWarning(t('auth.confirmAgreement'))
      return
    }

    // 验证密码确认
    if (accountForm.password !== accountForm.confirmPassword) {
      showError(t('auth.passwordMismatch'))
      return
    }

    // loading state is managed by userAuth

    // 清理输入
    const username = FormValidator.sanitizeInput(accountForm.username)
    const password = accountForm.password
    const email = accountForm.email || `${username}@example.com`

    // 获取当前Registration source（优先使用用户选择的项目，否则使用URL参数在
    const selectedSource = props.projectSelectorProps?.selectedProject
    const urlSource = route.query.source as string
    const currentRegisterSource: LoginSource = isValidSource(selectedSource || '')
      ? (selectedSource as LoginSource)
      : isValidSource(urlSource || '')
        ? (urlSource as LoginSource)
        : 'main'

    if (import.meta.env.DEV) {
      logger.info('[handleAccountRegister] Registration source:', currentRegisterSource)
      logger.info('[handleAccountRegister] selectedProject:', selectedSource)
      logger.info('[handleAccountRegister] urlSource:', urlSource)
    }

    // 根据来源调用对应的后端注册API
    const response = await unifiedRegister(currentRegisterSource, {
      username,
      password,
      email,
      phone: accountForm.phone,
      code: accountForm.code,
      captcha: accountForm.captcha,
      uuid: captchaKey.value,
      inviteCode: undefined, // 如果需要邀请码，可以从表单获取
    })

    // 如果后端 API 调用失败，抛出错在
    if (!response.success) {
      throw new Error(response.message || t('auth.registerFailed'))
    }

    if (response.code === 200 || response.success) {
      const registerData = response.data

      // 兼容多种响应格式
      let token: string = ''
      let refreshTokenValue: string = ''
      let userInfo: unknown = null

      // 判断响应格式
      if (registerData && typeof registerData === 'object') {
        // 提取 token（支持多种格式）
        const registerDataObj = registerData as {
          token?: string
          accessToken?: string
          access_token?: string
          refreshToken?: string
          refresh_token?: string
          user?: unknown
          userInfo?: unknown
        }
        token = registerDataObj.token || registerDataObj.accessToken || registerDataObj.access_token || ''
        refreshTokenValue = registerDataObj.refreshToken || registerDataObj.refresh_token || ''
        userInfo = registerDataObj.user || registerDataObj.userInfo
      }

      // 如果注册成功且有token，使在AuthFlowService 统一处理
      if (token) {
        saveHistoryAccount(username)

        const processResult = await AuthFlowService.processLoginResponse(
          token,
          refreshTokenValue,
          userInfo as Record<string, unknown> | undefined
        )

        if (processResult.success) {
          AuthFlowService.showSuccess(t('auth.registerAndLoginSuccess'))
          await nextTick()
          // 注册成功后立即在登录页弹出「绑定手机号+验证码」弹窗（与手机登录表单一致）
          showBindPhoneAfterRegisterDialog.value = true
          return
        }
        return
      }

      // 如果没有token，显示成功消息并跳转到登录页
      showSuccess(t('auth.registerSuccess'))
      router.push('/login')
    }
  } catch (error: unknown) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          t('auth.registerFailed'),
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch(() => { logger.warn('[UniversalLogin] Failed to record registration error log') })
    showError(error instanceof Error ? error.message : t('auth.registerFailedRetry'))
  } finally {
    // loading state is managed by userAuth
  }
}

// 开始登录冷在
const startLoginCooldown = (seconds: number): void => {
  loginCooldown.value = seconds
  if (loginCooldownTimer) {
    clearInterval(loginCooldownTimer)
  }
  loginCooldownTimer = window.setInterval(() => {
    loginCooldown.value--
    if (loginCooldown.value <= 0) {
      if (loginCooldownTimer) {
        clearInterval(loginCooldownTimer)
        loginCooldownTimer = null
      }
    }
  }, 1000)
}

// 处理账号密码登录（手机号+密码在
const handleAccountLogin = async (): Promise<void> => {
  if (!accountFormRef.value) {
    await nextTick()
    if (!accountFormRef.value) {
      showError(t('auth.formNotReady'))
      return
    }
  }

  // 登录模式：仅做手动校验，不再调用 el-form.validate/validateField，避免隐藏项或规则导致“请填写完整信息在
  const account = (accountForm.username ?? '').trim()
  const password = (accountForm.password ?? '').trim()
  const isSSOAdmin = route.query.source === 'admin'

  if (!loginAgreement.value) {
    showWarning(t('auth.confirmAgreement'))
    return
  }
  if (!account) {
    showWarning(t('auth.usernameOrPhoneOrEmail'))
    return
  }
  if (!password) {
    showWarning(t('auth.validation.passwordRequired'))
    return
  }
  if (showCaptcha.value) {
    const cap = (accountForm.captcha ?? '').trim()
    accountForm.captcha = cap
    if (!cap) {
      showWarning(t('auth.captchaPlaceholder'))
      return
    }
    // 图形验证码：1在 位数字或字母，兼容总管理端一位数/两位在
    if (!/^[a-zA-Z0-9]{1,6}$/.test(cap)) {
      showWarning(t('auth.imageCaptchaFormatError'))
      return
    }
  }
  if (!isSSOAdmin) {
    // 允许手机号 / 邮箱 / 用户名（字母数字下划线，4-50位）登录，不再强制手机号格式
    const isPhone = /^1[3-9]\d{9}$/.test(account)
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)
    const isUsername = /^[a-zA-Z0-9_]{4,50}$/.test(account)
    if (!isPhone && !isEmail && !isUsername) {
      showWarning(t('auth.pleaseEnterCorrectPhone'))
      return
    }
  }

  logger.info('[handleAccountLogin] Preparing to login', { isSSOAdmin, accountLen: account.length })

  const captchaCode = showCaptcha.value ? (accountForm.captcha || '') : ''
  const captchaUuid = showCaptcha.value ? (captchaKey.value || '') : ''

  try {
    if (isSSOAdmin) {
      await handleEnterpriseLogin(account, password, captchaCode, captchaUuid)
      return
    }

    // 官网账号密码登录：走 /api/login/pwd/login（代理到 Python 后端在
    const loginPayload: Record<string, string> = { phone: account, password, code: captchaCode, uuid: captchaUuid }
    const response = await request.post(LOGIN_PWD_PATHS.login, loginPayload, {
      headers: { 'platform-type': 'web' },
    })

    logger.info('[handleAccountLogin] Login response', response.data)

    const resData = (response.data as unknown as Record<string, unknown>) || {}
    const resCode = (resData?.code as number | string) ?? 0
    const msg = (resData?.msg || resData?.message || '') as string

    if (resCode === 200 || resCode === '200') {
      // 登录成功 - 兼容 data 或直在data 在token/user 多种结构
      const rawData = resData?.data as Record<string, unknown> | undefined
      const userData = (rawData?.user as Record<string, unknown>) || rawData
      const thirdPartyAccounts = userData?.thirdPartyAccounts as Record<string, unknown> | undefined
      const token =
        (thirdPartyAccounts?.accessToken as string) ||
        (userData?.accessToken as string) ||
        (userData?.access_token as string) ||
        (userData?.token as string) ||
        (rawData?.accessToken as string) ||
        (rawData?.access_token as string) ||
        (rawData?.token as string)
      const refreshToken =
        (thirdPartyAccounts?.refreshToken as string) ||
        (userData?.refreshToken as string) ||
        (userData?.refresh_token as string) ||
        (rawData?.refreshToken as string) ||
        (rawData?.refresh_token as string)

      logger.debug('[handleAccountLogin] Parsing result', { hasToken: !!token, hasUserData: !!userData })

      if (token) {
        saveHistoryAccount(account)

        const userForStore = userData || { uuid: '', id: '', username: account }
        if (!userForStore.uuid && !userForStore.id) {
          (userForStore as Record<string, unknown>).uuid = (userForStore as Record<string, unknown>).id || ''
        }
        if (rawData && ('needPwd' in rawData || 'need_pwd' in rawData)) {
          const v = (rawData as Record<string, unknown>).needPwd ?? (rawData as Record<string, unknown>).need_pwd
          ;(userForStore as Record<string, unknown>).needPwd = v
          ;(userForStore as Record<string, unknown>).need_pwd = v
        }

        await authStore.thirdPartyLogin({
          token,
          refreshToken: refreshToken || '',
          user: userForStore as Record<string, unknown>,
          loginType: 'password',
        })

        if (accountForm.rememberMe && refreshToken) {
          RememberMeService.setRememberMePreference(true)
          RememberMeService.saveRefreshToken(refreshToken)
          RememberMeService.saveAccountCredentials(account, refreshToken)
        }

        const loggedInUser = getAuthUser()
        logger.debug('[handleAccountLogin] Post-login verification', {
          uuid: loggedInUser?.uuid,
          isLoggedIn: authStore.isLoggedIn,
        })

        trackLoginSuccess('password')
        ElMessage.success(t('auth.loginSuccess'))

        // SSO：若为总管理端登录，携在token 跳转总管理端首页
        const source = route.query.source as string
        let redirectUrl = route.query.redirect as string
        if (redirectUrl) {
          let prev = ''
          while (redirectUrl !== prev) {
            prev = redirectUrl
            try {
              redirectUrl = decodeURIComponent(redirectUrl)
            } catch {
              break
            }
          }
        }
        const isCrossProject = source && ['admin', 'edu-web', 'edu-admin'].includes(source)
        if (isCrossProject && redirectUrl) {
          await AuthFlowService.redirectAfterLogin({
            source,
            redirectUrl,
            token,
            refreshToken: refreshToken || '',
            expiresIn: AuthFlowService.calculateExpiresInSeconds(),
            userInfo: userForStore as Record<string, unknown>,
          })
          return
        }

        if (tryShowAccountBindDialogThenRedirect(loggedInUser as unknown as Record<string, unknown>)) return
        // 企业登录（source=admin）且在redirect 时不跳转，留在当前页
        if (!isCrossProject) {
          router.push('/')
        }
      } else {
        showError(t('auth.loginFailedNoToken'))
      }
    } else {
      trackLoginFail('password', msg || t('auth.loginFailed'))
      const msgStr = (msg || '').trim()
      const resCode = (resData?.code as number | string) ?? 0
      const isAdminSource = route.query.source === 'admin'
      const looksLikeNotRegistered =
        msgStr.includes('not registered') ||
        msgStr.includes('click below to register') ||
        msgStr.includes(t('auth.userNotRegistered')) ||
        msgStr.includes(t('auth.userDoesNotExist')) ||
        msgStr.includes(t('auth.accountDoesNotExist')) ||
        msgStr.toLowerCase().includes('not found') ||
        resCode === 404 ||
        resCode === 4001
      if (!isAdminSource && looksLikeNotRegistered) {
        // 官网登录/注册：未查到账号则弹出设置邮箱与密码弹窗，补全后注册并登在
        pendingRegisterAccount.value = account
        setEmailPasswordForm.email = ''
        setEmailPasswordForm.password = ''
        setEmailPasswordForm.confirmPassword = ''
        showSetEmailPasswordDialog.value = true
      } else {
        // 总管理端或非「未注册」类错误：仅展示提示
        const displayMsg =
          isAdminSource && looksLikeNotRegistered
            ? t('auth.adminLoginNotRegisteredHint')
            : msgStr || t('auth.loginFailed')
        showError(displayMsg)
      }
    }
  } catch (error) {
    logger.error('[handleAccountLogin] Login exception', error)
    let errorMsg = error instanceof Error ? error.message : t('auth.loginFailed')
    trackLoginFail('password', errorMsg)
    const isAdminSource = route.query.source === 'admin'
    const looksLikeNotRegistered =
      errorMsg.includes('not registered') ||
      errorMsg.includes('click below to register') ||
      errorMsg.includes(t('auth.userNotRegistered')) ||
      errorMsg.includes(t('auth.userDoesNotExist')) ||
      errorMsg.includes(t('auth.accountDoesNotExist')) ||
      errorMsg.toLowerCase().includes('not found')
    if (!isAdminSource && looksLikeNotRegistered) {
      pendingRegisterAccount.value = (accountForm.username ?? '').trim()
      setEmailPasswordForm.email = ''
      setEmailPasswordForm.password = ''
      setEmailPasswordForm.confirmPassword = ''
      showSetEmailPasswordDialog.value = true
    } else {
      if (isAdminSource && looksLikeNotRegistered) {
        errorMsg = t('auth.adminLoginNotRegisteredHint')
      }
      showError(errorMsg)
    }
  }
}

// 处理手机验证码登在
const handlePhoneLogin = async (): Promise<void> => {
  trackLoginClick('sms')
  if (!phoneLoginAgreement.value) {
    // 显示协议确认弹窗
    pendingAgreementType.value = 'phone'
    showAgreementConfirmDialog.value = true
    return
  }

  if (!phoneFormRef.value) return

  // 验证表单
  try {
    await phoneFormRef.value.validate()
  } catch {
    return
  }

  try {
    // loading状态由userAuth管理

    // 获取完整手机号（包含国家代码在
    const fullPhoneNumber = getFullPhoneNumber()

    // 合并6个验证码输入框的在
    const verificationCode = verificationCodeInputs.value.join('')
    phoneForm.verificationCode = verificationCode

    // 第二步：验证验证码并获取临时密钥
    let verifyResponse: Awaited<ReturnType<typeof verifyPhoneCode>>
    try {
      verifyResponse = await verifyPhoneCode({
        phone: fullPhoneNumber,
        code: verificationCode,
      })
    } catch (error) {
      logger.error('[handlePhoneLogin] Failed to verify verification code', error)
      throw error
    }

    if (!verifyResponse.success || !verifyResponse.data) {
      logger.error('[handlePhoneLogin] Invalid verification response:', {
        success: verifyResponse.success,
        data: verifyResponse.data,
        message: verifyResponse.message,
        code: verifyResponse.code,
      })
      throw new Error(verifyResponse.message || 'Verification code check failed')
    }

    const tempKey = verifyResponse.data as string
    if (!tempKey || tempKey.trim() === '') {
      logger.error('[handlePhoneLogin] Temporary key is empty')
      throw new Error(t('error.universal_login.Temp key is empty请重2'))
    }
    logger.info('[handlePhoneLogin] Got temp key successfully:', tempKey)

    // 第三步：使用临时密钥完成登录/注册（仅手机在验证码，不再携带第三方绑定信息）
    logger.info('[handlePhoneLogin] Step 3: Complete login/register with temporary key')

    const loginData = {
      phone: fullPhoneNumber,
      tempKey: tempKey,
    }

    const response = await completePhoneLogin(loginData)

    // 检查响应是否成在- 修复：code 可能是字符串 "200" 或数在200
    const codeNum = typeof response.code === 'string' ? parseInt(response.code, 10) : response.code
    const isSuccess = (codeNum === 200 || response.success === true) && response.data
    logger.debug('[handlePhoneLogin] Response success status', { isSuccess, code: codeNum, success: response.success })

    if (isSuccess) {
      const loginData = response.data
      logger.debug('[Phone/Third-party Binding Login] Backend returned:', JSON.stringify(response, null, 2))

      // ===== 优化：使在AuthFlowService 统一处理Login response =====
      // 1. 提取 token 和用户信息（保留响应格式兼容逻辑在
      let token: string = ''
      let refreshTokenValue: string = ''
      let userInfo: Record<string, unknown> | undefined

      if (loginData && typeof loginData === 'object') {
        const loginDataObj = loginData as unknown as Record<string, unknown>
        logger.debug('[handlePhoneLogin] loginData keys:', Object.keys(loginDataObj))

        // 新格式：用户对象包含 thirdPartyAccounts
        if ('thirdPartyAccounts' in loginDataObj && loginDataObj.thirdPartyAccounts) {
          const thirdPartyAccounts = loginDataObj.thirdPartyAccounts as Record<string, unknown>
          token = (thirdPartyAccounts.accessToken as string) || ''
          refreshTokenValue = (thirdPartyAccounts.refreshToken as string) || ''
          userInfo = loginDataObj as Record<string, unknown>
        }
        // UserToken 格式
        else if ('tokenType' in loginDataObj || 'expiresIn' in loginDataObj) {
          token = (loginDataObj.token as string) || ''
          refreshTokenValue = (loginDataObj.refreshToken as string) || ''
        }
        // LoginResponseData 格式
        else if ('token' in loginDataObj || 'accessToken' in loginDataObj) {
          token = (loginDataObj.token as string) || (loginDataObj.accessToken as string) || ''
          refreshTokenValue = (loginDataObj.refreshToken as string) || ''
          userInfo = (loginDataObj.userInfo || loginDataObj.user) as Record<string, unknown> | undefined
          // 接口可能在根级别返回 needPwd，合并进 userInfo 以便 store 与绑定弹窗使在
          if ('needPwd' in loginDataObj || 'need_pwd' in loginDataObj) {
            const rootNeedPwd = (loginDataObj as Record<string, unknown>).needPwd ?? (loginDataObj as Record<string, unknown>).need_pwd
            userInfo = { ...(userInfo || {}), needPwd: rootNeedPwd, need_pwd: rootNeedPwd }
          }
        } else {
          throw new Error(t('auth.invalidResponseFormat'))
        }
      } else {
        throw new Error(t('auth.loginResponseMissingToken'))
      }

      if (!token) {
        throw new Error(t('auth.loginResponseMissingToken'))
      }

      logger.debug('[handlePhoneLogin] Extracting Token:', token ? 'extracted' : 'not found')

      // 2. 使用 AuthFlowService 统一处理Login response（原子化存储 + 自动获取用户信息在
      const processResult = await AuthFlowService.processLoginResponse(
        token,
        refreshTokenValue,
        userInfo
      )

      if (!processResult.success) {
        throw new Error(t('auth.loginStatusUpdateFailed'))
      }

      // 3. 重置失败计数
      loginFailureCount.value = 0

      // 4. 等待 Vue 响应式更在
      await nextTick()

      // 5. 验证登录状在
      if (!authStore.isLoggedIn || !authStore.token) {
        logger.error('[handlePhoneLogin] Login status verification failed')
        showError(t('auth.loginStatusUpdateFailed'))
        return
      }

      logger.info('[handlePhoneLogin] Login successful, preparing to redirect')

      trackLoginSuccess('sms')
      AuthFlowService.showSuccess()

      // 7. 保存历史手机号记在
      if (phoneForm.phoneNumber?.trim()) {
        saveHistoryPhone(phoneForm.phoneNumber.trim())
        initHistoryPhones()
      }

      // 8. 保存"记住在设置（使用安全的 token 方案在
      if (phoneForm.rememberMe && authStore.refreshToken) {
        RememberMeService.setRememberMePreference(true)
        RememberMeService.saveRefreshToken(authStore.refreshToken)
        await RememberMeService.savePhoneCredentials(
          getFullPhoneNumber(),
          selectedCountryCode.value.dialCode,
          authStore.refreshToken
        )
      } else {
        await RememberMeService.clearCredentials()
      }

      // 9. 处理重定在
      const source = route.query.source as string
      let redirectUrl = route.query.redirect as string

      // 解码 redirectUrl
      if (redirectUrl) {
        let prevDecoded = ''
        while (redirectUrl !== prevDecoded) {
          prevDecoded = redirectUrl
          try {
            redirectUrl = decodeURIComponent(redirectUrl)
          } catch {
            break
          }
        }
      }

      // 教育系统项目自动使用远程服务在
      if ((source === 'edu-web' || source === 'edu-admin') && !redirectUrl) {
        const remoteUrls: Record<string, string> = {
          'edu-web': 'https://user-edu.aizhs.top',
          'edu-admin': 'https://admin-edu.aizhs.top',
        }
        redirectUrl = `${remoteUrls[source]}/index`
      }

      // 在admin/edu-web/edu-admin 才跨项目跳转；user/sms 为官网登录，不跳总管理端
      const isCrossProjectSource = source && ['admin', 'edu-web', 'edu-admin'].includes(source)
      if (isCrossProjectSource && redirectUrl) {
        await AuthFlowService.redirectAfterLogin({
          source,
          redirectUrl,
          token: authStore.token as string,
          refreshToken: refreshTokenValue,
          expiresIn: AuthFlowService.calculateExpiresInSeconds(),
          userInfo: processResult.userInfo || undefined,
        })
        return
      }

      if (tryShowAccountBindDialogThenRedirect(processResult.userInfo as Record<string, unknown>)) return
      // 企业登录（admin/edu-*）且在redirect 时不跳转，留在当前页
      if (!isCrossProjectSource) {
        await AuthFlowService.redirectAfterLogin()
      }
      logger.info('[handlePhoneLogin] Redirect complete')

    } else {
      trackLoginFail('sms', (response as { message?: string }).message || t('auth.loginFailed'))
      logger.error('[handlePhoneLogin] Login failed', {
        code: response.code,
        success: response.success,
        message: (response as { message?: string }).message
      })
      const loginResponseMessage = (response as { message?: string } | ExtendedApiResponse).message
      const errorMessageSquare =
        typeof loginResponseMessage === 'string' ? loginResponseMessage : ''
      const isAccountNotFound =
        errorMessageSquare.includes(t('auth.userDoesNotExist')) ||
        errorMessageSquare.includes(t('auth.accountDoesNotExist')) ||
        errorMessageSquare.includes(t('auth.userNotRegistered')) ||
        errorMessageSquare.includes('not found') ||
        response.code === 404 ||
        response.code === 4001

      if (isAccountNotFound) {
        // 账号不存在，尝试注册
        try {
          showInfo(t('auth.accountNotExistsRegistering'))

          const fullPhoneNumber = getFullPhoneNumber()

          // 生成一个默认密码（使用手机号后6在+ 时间戳后4位，确保安全性）
          const defaultPassword = `${fullPhoneNumber.slice(-6)}${Date.now().toString().slice(-4)}`

          // 注册账号（使用手机验证码注册在
          interface ExtendedRegisterRequest extends RegisterRequest {
            phone?: string
            code?: string
          }
          const registerResponse = await register({
            username: fullPhoneNumber, // 使用手机号作为用户名
            password: defaultPassword, // 使用生成的默认密在
            confirmPassword: defaultPassword,
            email: `${fullPhoneNumber}@example.com`,
            ...(phoneForm.verificationCode
              ? { phone: fullPhoneNumber, code: phoneForm.verificationCode }
              : {}),
          } as ExtendedRegisterRequest)

          if (registerResponse.success) {
            // 注册成功，自动登在- 优化版本，使在AuthFlowService
            const registerData = registerResponse as unknown as Record<string, unknown>
            let token: string = ''
            let refreshToken: string = ''
            let userInfo: Record<string, unknown> | undefined

            if (registerData && typeof registerData === 'object') {
              if ('token' in registerData || 'accessToken' in registerData) {
                token = (registerData.token as string) || (registerData.accessToken as string) || ''
                refreshToken = (registerData.refreshToken as string) || ''
                userInfo = registerData.user as Record<string, unknown> | undefined
              } else if ('tokenType' in registerData) {
                token = (registerData.token as string) || ''
              }
            }

            if (token) {
              // 使用 AuthFlowService 统一处理Login response
              const processResult = await AuthFlowService.processLoginResponse(
                token,
                refreshToken,
                userInfo
              )

              if (processResult.success) {
                AuthFlowService.showSuccess(t('auth.registerAndLoginSuccess'))
                await nextTick()
                router.push('/')
              } else {
                showError(t('auth.registerSuccessButLoginFailed'))
              }
              return // 注册并登录成功，直接返回
            } else {
              throw new Error(t('auth.registerResponseMissingToken'))
            }
          } else {
            const registerResponseMessage = (
              registerResponse as { message?: string } | ExtendedApiResponse
            ).message
            throw new Error(
              typeof registerResponseMessage === 'string'
                ? registerResponseMessage
                : t('auth.registerFailed')
            )
          }
        } catch (registerError: unknown) {
          const registerErrorMessage = registerError instanceof Error ? registerError.message : ''
          showError(registerErrorMessage || t('register.registerFailed'))
          return
        }
      }

      // 其他Login failed原因
      loginFailureCount.value++
      if (loginFailureCount.value >= 5) {
        startLoginCooldown(300)
      }
      const phoneLoginResponseMessage = (response as { message?: string } | ExtendedApiResponse)
        .message
      showError(
        typeof phoneLoginResponseMessage === 'string'
          ? phoneLoginResponseMessage
          : t('auth.loginFailedCheckCode')
      )
    }
  } catch (error: unknown) {
    logger.error('[handlePhoneLogin] Login process error', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : t('universalLogin.noStack'),
      error
    })
    trackLoginFail('sms', error instanceof Error ? error.message : String(error))
    const errorMessageSquare = (error instanceof Error ? error.message : '') || ''
    const isAccountNotFound =
      errorMessageSquare.includes(t('auth.userDoesNotExist')) ||
      errorMessageSquare.includes(t('auth.accountDoesNotExist')) ||
      errorMessageSquare.includes(t('auth.userNotRegistered')) ||
      errorMessageSquare.includes('not found') ||
      errorMessageSquare.includes('404')

    if (isAccountNotFound) {
      // 账号不存在，尝试注册
      try {
        const fullPhoneNumber = getFullPhoneNumber()
        showInfo(t('auth.accountNotExistsRegistering'))

        // 生成一个默认密码（使用手机号后6在+ 时间戳后4位，确保安全性）
        const defaultPassword = `${fullPhoneNumber.slice(-6)}${Date.now().toString().slice(-4)}`

        interface ExtendedRegisterRequest extends RegisterRequest {
          phone?: string
          code?: string
        }
        const registerResponse = await register({
          username: fullPhoneNumber,
          password: defaultPassword,
          confirmPassword: defaultPassword,
          email: `${fullPhoneNumber}@example.com`,
          ...(phoneForm.verificationCode
            ? { phone: fullPhoneNumber, code: phoneForm.verificationCode }
            : {}),
        } as ExtendedRegisterRequest)

        if (registerResponse.success) {
          // 注册成功，自动登在- 优化版本，使在AuthFlowService
          const registerData = registerResponse as unknown as Record<string, unknown>
          let token: string = ''
          let refreshToken: string = ''
          let userInfo: Record<string, unknown> | undefined

          if (registerData && typeof registerData === 'object') {
            if ('token' in registerData || 'accessToken' in registerData) {
              token = (registerData.token as string) || (registerData.accessToken as string) || ''
              refreshToken = (registerData.refreshToken as string) || ''
              userInfo = registerData.user as Record<string, unknown> | undefined
            } else if ('tokenType' in registerData) {
              token = (registerData.token as string) || ''
            }
          }

          if (token) {
            // 使用 AuthFlowService 统一处理Login response
            const processResult = await AuthFlowService.processLoginResponse(
              token,
              refreshToken,
              userInfo
            )

            if (processResult.success) {
              AuthFlowService.showSuccess(t('auth.registerAndLoginSuccess'))
              await nextTick()
              if (tryShowAccountBindDialogThenRedirect(userInfo)) return
              router.push('/')
            }
            return
          }
        } else {
          showError(registerResponse.message || t('register.registerFailed'))
          return
        }
      } catch (registerError: unknown) {
        showError(
          (registerError instanceof Error ? registerError.message : String(registerError)) ||
          t('register.registerFailed')
        )
        return
      }
    }

    // 其他错误
    loginFailureCount.value++

    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          t('auth.loginFailed'),
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch(() => { logger.warn('[UniversalLogin] Failed to record login error log') })

    const errorMessage = error instanceof Error ? error.message : ''
    showError(errorMessage || t('auth.loginFailedRetry'))

    if (loginFailureCount.value >= 5) {
      startLoginCooldown(300)
    }
  } finally {
    // loading state is managed by userAuth
  }
}

// 发送验证码
const sendVerificationCode = async (): Promise<void> => {
  if (!phoneFormRef.value) return

  // 只验证手机号
  try {
    await (phoneFormRef.value as FormInstance).validateField('phoneNumber')
  } catch {
    showError(t('auth.phoneFormatError'))
    return
  }

  // 检查手机号是否为空
  if (!phoneForm.phoneNumber || phoneForm.phoneNumber.trim() === '') {
    showError(t('auth.phonePlaceholder'))
    return
  }

  try {
    sendingCode.value = true
    codeSendStatus.message = ''
    codeSendStatus.type = 'info'

    // 获取完整手机号（包含国家代码在
    const fullPhoneNumber = getFullPhoneNumber()

    if (!fullPhoneNumber || fullPhoneNumber.length < 8) {
      showError(t('auth.phoneFormatError'))
      sendingCode.value = false
      return
    }

    // 调用发送验证码API - 使用生产环境API /api/ai/login/pwd/smsVerify
    // 根据登录/注册模式传递对应的模板ID在-登录在-注册
    const tempId = isRegisterMode.value ? 2 : 1 // 注册模式=2，登录模在1
    const response = await sendPhoneLoginCode(fullPhoneNumber, tempId)

    // ⚠️ 重要：检查响应，如果 code 在401，说明需在token，不应该显示成功
    if (response.code === 401) {
      codeSendStatus.message = response.message || t('auth.sendVerificationCodeFailed')
      codeSendStatus.type = 'error'
      showError(response.message || t('auth.sendVerificationCodeFailed'))
      sendingCode.value = false
      return
    }

    logger.debug('Verification code API response:', response)

    // 判断是否成功：code 在200 在0 表示成功，或在success 字段在true
    const isResponseSuccess = response.code === 200 || response.code === 0 || response.msg === 'success'

    if (isResponseSuccess) {
      // 使用翻译文本，如果翻译失败则使用默认中文提示
      const verificationCodeSentText = t('auth.verificationCodeSent')
      codeSendStatus.message = verificationCodeSentText && verificationCodeSentText !== 'auth.verificationCodeSent'
        ? verificationCodeSentText
        : t('universalLogin.codeSentSms')
      codeSendStatus.type = 'success'
      const codeSentSuccessText = t('auth.codeSentSuccess')
      showSuccess(codeSentSuccessText && codeSentSuccessText !== 'auth.codeSentSuccess'
        ? codeSentSuccessText
        : t('universalLogin.codeSendSuccess'))

      // 开始倒计在
      countdown.value = 60
      if (countdownTimer) {
        clearInterval(countdownTimer)
      }

      countdownTimer = window.setInterval(() => {
        if (countdown.value > 0) {
          countdown.value--
        } else {
          if (countdownTimer) {
            clearInterval(countdownTimer)
            countdownTimer = null
          }
          codeSendStatus.message = ''
        }
      }, 1000)
    } else {
      const responseMessage = (response as { message?: string } | ExtendedApiResponse).message
      const messageStr = typeof responseMessage === 'string' ? responseMessage : ''

      // 过滤掉无意义在"success" 消息，使用有意义的错误提在
      const isUselessMessage = !messageStr || messageStr.toLowerCase() === 'success' || messageStr === '成功'
      const sendFailedRetryText = t('auth.sendFailedRetry')
      const fallbackMessage = sendFailedRetryText && sendFailedRetryText !== 'auth.sendFailedRetry'
        ? sendFailedRetryText
        : t('universalLogin.sendFailed')

      codeSendStatus.message = isUselessMessage ? fallbackMessage : messageStr
      codeSendStatus.type = 'error'

      // 根据错误类型显示不同的提在
      const verificationCodeSendFailedText = t('auth.verificationCodeSendFailed')
      const defaultErrorMessage = verificationCodeSendFailedText && verificationCodeSendFailedText !== 'auth.verificationCodeSendFailed'
        ? verificationCodeSendFailedText
        : t('universalLogin.codeSendFailed')

      let errorMessageSquare = isUselessMessage ? defaultErrorMessage : messageStr
      if (messageStr) {
        if (messageStr.includes('频繁') || messageStr.includes('太快')) {
          const sendTooFrequentText = t('auth.sendTooFrequent')
          errorMessageSquare = sendTooFrequentText && sendTooFrequentText !== 'auth.sendTooFrequent'
            ? sendTooFrequentText
            : t('universalLogin.sendTooFrequent')
          countdown.value = 60
        } else if (messageStr.includes('无效') || messageStr.includes('格式')) {
          const phoneFormatIncorrectText = t('auth.phoneFormatIncorrect')
          errorMessageSquare = phoneFormatIncorrectText && phoneFormatIncorrectText !== 'auth.phoneFormatIncorrect'
            ? phoneFormatIncorrectText
            : t('universalLogin.phoneFormatError')
        }
      }

      showError(errorMessageSquare)
    }
  } catch (error: unknown) {
    codeSendStatus.message = t('auth.sendFailed')
    codeSendStatus.type = 'error'

    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          t('auth.sendVerificationCodeFailed'),
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch(() => { logger.warn('[UniversalLogin] Failed to record verification code send error log') })

    let errorMessageSquare = t('auth.verificationCodeSendFailed')
    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage) {
      if (errorMessage.includes(t('universalLogin.network')) || errorMessage.includes('Network')) {
        errorMessageSquare = t('auth.networkConnectionFailed')
      } else if (errorMessage.includes(t('universalLogin.timeout')) || errorMessage.includes('timeout')) {
        errorMessageSquare = t('auth.requestTimeout')
      } else {
        errorMessageSquare = errorMessage
      }
    }

    showError(errorMessageSquare)
  } finally {
    sendingCode.value = false
  }
}

// ==================== 二维码相关状态和函数 ====================
// 先定义所有状在
const currentQrCodeUrl = ref('')
const currentQrCodeMethod = ref<string>('')
const qrCodeStatus = ref<
  'pending' | 'scanning' | 'scanned' | 'confirming' | 'success' | 'failed' | 'expired'
>('pending')
const qrCodeCountdown = ref(0)
const qrCodePollTimer = ref<NodeJS.Timeout | null>(null)
const qrCodeCountdownTimer = ref<NodeJS.Timeout | null>(null)

const handleIconError = (event: Event): void => {
  const img = event.target as HTMLImageElement
  // 已经降级到 logo.svg 或 empty.svg, 直接隐藏
  if (img.src.includes('logo.svg') || img.src.includes('empty.svg')) {
    img.style.display = 'none'
    return
  }
  import('@/utils/logger')
    .then(({ logger }) => {
      logger.error(t('auth.thirdPartyIconLoadFailed'), new Error(t('auth.iconLoadFailed')), {
        src: img.src,
        alt: img.alt,
      })
      logger.warn(t('auth.ensureIconExists'))
      // 降级到 logo.svg, 避免连续触发 onerror
      img.src = '/images/logo.svg'
    })
    .catch(() => {
      logger.warn('[UniversalLogin] Failed to record icon load error log')
      img.src = '/images/logo.svg'
    })
}

// 处理第三方登录图标点在
const handleThirdPartyLoginClick = async (methodKey: string): Promise<void> => {
  const method = thirdPartyMethods.find(m => m.key === methodKey)
  if (!method || !method.enabled) {
    const methodName = typeof method?.name === 'string' ? method.name : methodKey
    showWarning(t('auth.thirdPartyMethodUnavailable', { method: methodName }))
    return
  }

  // 微信登录点击事件
  if (methodKey === 'wechat') {

    // 显示微信登录二维码对话框
    showWechatQrDialog.value = true

    // 等待DOM更新后初始化微信登录二维在
    nextTick(() => {
      initWechatQrCode()
    })
    return
  }

  // 支付宝登录：直接跳转官方授权在
  if (methodKey === 'alipay') {
    window.location.href = ALIPAY_AUTH_URL
    return
  }

  // 清理之前的二维码
  try {
    if (qrCodePollTimer.value !== null && qrCodePollTimer.value !== undefined) {
      clearInterval(qrCodePollTimer.value)
      qrCodePollTimer.value = null
    }
    if (qrCodeCountdownTimer.value !== null && qrCodeCountdownTimer.value !== undefined) {
      clearInterval(qrCodeCountdownTimer.value)
      qrCodeCountdownTimer.value = null
    }
  } catch (error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          t('auth.clearTimerFailed'),
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch(() => { logger.warn('[UniversalLogin] Failed to record timer cleanup error log') })
  }
  currentQrCodeUrl.value = ''
  currentQrCodeMethod.value = ''
  qrCodeStatus.value = 'pending'
  qrCodeCountdown.value = 0

  // 其他登录方式（Google、Apple、飞书等）直接跳转到OAuth授权页面
  try {
    let authUrl = ''

    if (methodKey === 'google') {
      const { initiateGoogleOAuth } = await import('@/features/third-party-login/api/google')
      authUrl = await initiateGoogleOAuth()
    } else if (methodKey === 'apple') {
      const { initiateAppleOAuth } = await import('@/features/third-party-login/api/apple')
      authUrl = await initiateAppleOAuth()
    } else if (methodKey === 'feishu') {
      authUrl = FEISHU_AUTH_URL
    } else if (methodKey === 'dingtalk') {
      authUrl = DINGTALK_AUTH_URL
    } else if (methodKey === 'wecom') {
      authUrl = WECOM_AUTH_URL
    } else {
      showWarning(t('auth.thirdPartyMethodUnavailable', { method: methodKey }))
      return
    }

    // 跳转到OAuth授权页面
    if (authUrl) {
      window.location.href = authUrl
    }
  } catch (error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          `初始在{methodKey}Login failed`,
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch(() => { logger.warn('[UniversalLogin] Failed to record third-party login init error log') })
    const errorMsg = error instanceof Error ? error.message : String(error)
    showError(errorMsg || t('auth.thirdPartyLoginFailedRetry'))
  }
}

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null } })
cleanup.add(() => { if (registerCodeCountdownTimer) { clearInterval(registerCodeCountdownTimer); registerCodeCountdownTimer = null } })
cleanup.add(() => { if (loginCooldownTimer) { clearInterval(loginCooldownTimer); loginCooldownTimer = null } })
cleanup.add(() => {
  try {
    if (qrCodePollTimer.value !== null && qrCodePollTimer.value !== undefined) {
      clearInterval(qrCodePollTimer.value)
      qrCodePollTimer.value = null
    }
    if (qrCodeCountdownTimer.value !== null && qrCodeCountdownTimer.value !== undefined) {
      clearInterval(qrCodeCountdownTimer.value)
      qrCodeCountdownTimer.value = null
    }
  } catch (error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          t('auth.clearQrCodeTimerFailed'),
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch((e) => { console.warn('[UniversalLogin] logger 加载失败', e) })
  }
})
cleanup.add(() => removeWechatMessageListener())

// 监听"记住在复选框变化
watch(
  () => accountForm.rememberMe,
  async (newValue: boolean) => {
    if (!newValue) {
      // 取消"记住在时清除保存的凭据
      const credentials = await RememberMeService.getCredentials()
      if (credentials?.type === 'account') {
        await RememberMeService.clearCredentials()
      }
    }
  }
)

watch(
  () => phoneForm.rememberMe,
  async (newValue: boolean) => {
    if (!newValue) {
      // 取消"记住在时清除保存的凭据
      const credentials = await RememberMeService.getCredentials()
      if (credentials?.type === 'phone') {
        await RememberMeService.clearCredentials()
      }
    }
  }
)

// 窗口大小变化监听在
const _resizeObserver: ResizeObserver | null = null
const _resizeHandler: (() => void) | null = null

// 初始化：检查是否需要显示验证码和自动登在
onMounted(async () => {
  trackLoginPageView()
  initHistoryAccounts()
  initHistoryPhones()

  // 调试：检查历史记在
  if (import.meta.env.DEV) {
    const storedHistory = getHistoryAccounts()
    logger.debug('[UniversalLogin] Component mounted, initializing history', {
      historyAccountsCount: historyAccounts.value.length,
      historyAccounts: historyAccounts.value,
      storedHistoryCount: storedHistory.length,
      storedHistory: storedHistory,
      historyPhonesCount: historyPhones.value.length,
      storageKey: HISTORY_ACCOUNT_KEY,
    })

    // 如果没有历史记录，添加测试数据（仅开发环境）
    if (historyAccounts.value.length === 0) {
      logger.debug('[UniversalLogin] No history, login once to generate history')
    }
  }

  // 跨项目登录时默认使用账号密码登录模式（user/sms=官网不强制切 tab在
  const currentSource = route.query.source as string
  const isCrossProjectLogin = currentSource && currentSource !== 'main' && currentSource !== 'user' && currentSource !== 'sms'
  if (isCrossProjectLogin) {
    activeTab.value = 'account'
  }

  // 从localStorage恢复失败计数（可选，根据安全需求）
  const storedFailureCount = StorageManager.getItem<number>('loginFailureCount') || 0
  if (storedFailureCount >= 3) {
    loginFailureCount.value = storedFailureCount
    showCaptcha.value = true
  }

  // 总管理端（admin）默认显示验证码
  const checkAndShowCaptchaForAdmin = async () => {
    const selectedSource = props.projectSelectorProps?.selectedProject
    const urlSource = route.query.source as string
    const currentSource = selectedSource || urlSource || ''

    // 如果是总管理端（admin），始终显示验证在
    if (currentSource === 'admin') {
      if (!showCaptcha.value) {
        showCaptcha.value = true
      }
    }
  }

  // 初始化时检查是否需要显示验证码
  try { await checkAndShowCaptchaForAdmin() } catch (e) { console.error(e) }

  // 监听项目选择变化，如果是总管理端，自动显示验证码
  watch(
    () => props.projectSelectorProps?.selectedProject,
    async (newProject) => {
      if (newProject === 'admin') {
        showCaptcha.value = true // 始终显示，不需要检在
      }
    },
    { immediate: true }
  )

  // 监听路由参数变化（支持URL参数方式选择项目在
  watch(
    () => route.query.source,
    async (newSource) => {
      if (newSource === 'admin') {
        showCaptcha.value = true // 始终显示，不需要检在
      }
    },
    { immediate: true }
  )

  // 监听 activeTab 变化，如果是总管理端且切换到账号登录，自动显示验证码
  watch(
    () => activeTab.value,
    async (newTab) => {
      if (newTab === 'account') {
        const selectedSource = props.projectSelectorProps?.selectedProject
        const urlSource = route.query.source as string
        const currentSource = selectedSource || urlSource || ''
        if (currentSource === 'admin') {
          showCaptcha.value = true // 始终显示，不需要检在
        }
      }
    },
    { immediate: true }
  )

  // 二维码面板已移至页面中间，使在fixed 定位，无需动态计算位在

  // 二维码面板已移至页面中间，使在fixed 定位，无需监听位置变化

  // 监听 locale 变化，确保Language switched时组件正确更在
  watch(
    () => locale.value,
    (newLocale, oldLocale) => {
      // 确保 locale 同步
      ensureLocaleSync()

      if (import.meta.env.DEV) {
        logger.info('[UniversalLogin] Language switched:', {
          from: oldLocale,
          to: newLocale,
          translation: t('auth.accountPasswordLogin'),
        })
      }

      // 强制触发组件更新
      nextTick(() => {
        // Language switched后，确保所有翻译文本都更新
      })
    },
    { immediate: true, deep: true }
  )

  // 在组件挂载时再次确保 locale 同步
  nextTick(() => {
    ensureLocaleSync()
    if (import.meta.env.DEV) {
      logger.info('[UniversalLogin] Component mounted, current locale:', locale.value)
      logger.info('[UniversalLogin] Translation result:', accountPasswordLoginText.value)
    }
  })

  // 迁移旧的不安全凭据（如果存在在
  await RememberMeService.migrateOldCredentials()

  // 使用新的安全方案恢复"记住在凭据
  const rememberMeCredentials = await RememberMeService.getCredentials()

  if (rememberMeCredentials) {
    if (rememberMeCredentials.type === 'account') {
      // 恢复账号登录的显示信在
      accountForm.username = rememberMeCredentials.username || ''
      accountForm.rememberMe = true
      // 注意：不恢复密码，用户需要重新输入或使用自动登录

      logger.info('[UniversalLogin] Restored account login remember-me credentials')

      if (!RememberMeService.canAttemptAutoLogin()) {
        logger.warn('[UniversalLogin] Auto-login conditions not met')
        return
      }

      const refreshToken = rememberMeCredentials.refreshToken || RememberMeService.getRefreshToken()
      if (!refreshToken) {
        logger.warn('[UniversalLogin] refreshToken does not exist, skipping auto-login')
        return
      }

      try {
        if (!authStore.refreshTokenAction) {
          logger.warn('[UniversalLogin] refreshTokenAction method does not exist, skipping auto-login')
          return
        }
        const refreshResult = await authStore.refreshTokenAction(refreshToken)

        if (refreshResult) {
          logger.info('[UniversalLogin] Auto-login with refreshToken successful')
          AuthFlowService.showSuccess()
          await nextTick()
          if (tryShowAccountBindDialogThenRedirect()) return
          await AuthFlowService.redirectAfterLogin()
          return
        } else {
          const failureCount = RememberMeService.getAutoLoginFailureCount()
          const remaining = 5 - failureCount
          const lockTime = RememberMeService.getLockRemainingTime()
          if (lockTime > 0) {
            const hours = Math.floor(lockTime / (60 * 60 * 1000))
            const minutes = Math.floor((lockTime % (60 * 60 * 1000)) / (60 * 1000))
            const timeStr = hours > 0 ? t('universalLogin.hoursMinutes', { hours, minutes }) : t('universalLogin.minutesOnly', { minutes })
            showWarning(t('auth.autoLoginLockedWithTime', { time: timeStr }))
          } else if (remaining > 0) {
            showWarning(t('auth.autoLoginFailedWithRemaining', { count: remaining }))
          } else {
            showWarning(t('auth.autoLoginLocked'))
          }
          await RememberMeService.clearCredentials()
          accountForm.rememberMe = false
        }
      } catch (error) {
        const failureCount = RememberMeService.getAutoLoginFailureCount()
        const remaining = 5 - failureCount
        const lockTime = RememberMeService.getLockRemainingTime()
        if (lockTime > 0) {
          const hours = Math.floor(lockTime / (60 * 60 * 1000))
          const minutes = Math.floor((lockTime % (60 * 60 * 1000)) / (60 * 1000))
          const timeStr = hours > 0 ? t('universalLogin.hoursMinutes', { hours, minutes }) : t('universalLogin.minutesOnly', { minutes })
          showWarning(t('auth.autoLoginLockedWithTime', { time: timeStr }))
        } else if (remaining > 0) {
          showWarning(t('auth.autoLoginFailedWithRemaining', { count: remaining }))
        } else {
          showWarning(t('auth.autoLoginLocked'))
        }
        logger.warn('[UniversalLogin] Auto-login failed, token may be expired', { error })
        await RememberMeService.clearCredentials()
        accountForm.rememberMe = false
      }
    } else if (rememberMeCredentials.type === 'phone') {
      // 恢复手机号登录的显示信息
      activeTab.value = 'phone'
      if (rememberMeCredentials.countryCode) {
        selectedCountryCode.value =
          getCountryByDialCode(rememberMeCredentials.countryCode) || selectedCountryCode.value
      }
      if (rememberMeCredentials.phone) {
        phoneForm.phoneNumber = rememberMeCredentials.phone
          .replace(selectedCountryCode.value.dialCode, '')
          .replace(/^\+/, '')
      }
      phoneForm.rememberMe = true

      logger.info('[UniversalLogin] Restored phone login remember-me credentials')

      if (!RememberMeService.canAttemptAutoLogin()) {
        logger.warn('[UniversalLogin] Auto-login conditions not met')
        return
      }

      const refreshToken2 = rememberMeCredentials.refreshToken || RememberMeService.getRefreshToken()
      if (!refreshToken2) {
        logger.warn('[UniversalLogin] refreshToken does not exist, skipping auto-login')
        return
      }

      try {
        if (!authStore.refreshTokenAction) {
          logger.warn('[UniversalLogin] refreshTokenAction method does not exist, skipping auto-login')
          return
        }
        const refreshResult = await authStore.refreshTokenAction(refreshToken2)

        if (refreshResult) {
          logger.info('[UniversalLogin] Auto-login with refreshToken successful')
          AuthFlowService.showSuccess()
          await nextTick()
          if (tryShowAccountBindDialogThenRedirect()) return
          await AuthFlowService.redirectAfterLogin()
          return
        } else {
          const failureCount = RememberMeService.getAutoLoginFailureCount()
          const remaining = 5 - failureCount
          const lockTime = RememberMeService.getLockRemainingTime()
          if (lockTime > 0) {
            const hours = Math.floor(lockTime / (60 * 60 * 1000))
            const minutes = Math.floor((lockTime % (60 * 60 * 1000)) / (60 * 1000))
            const timeStr = hours > 0 ? t('universalLogin.hoursMinutes', { hours, minutes }) : t('universalLogin.minutesOnly', { minutes })
            showWarning(t('auth.autoLoginLockedWithTime', { time: timeStr }))
          } else if (remaining > 0) {
            showWarning(t('auth.autoLoginFailedWithRemaining', { count: remaining }))
          } else {
            showWarning(t('auth.autoLoginLocked'))
          }
          await RememberMeService.clearCredentials()
          phoneForm.rememberMe = false
        }
      } catch (error) {
        const failureCount = RememberMeService.getAutoLoginFailureCount()
        const remaining = 5 - failureCount
        const lockTime = RememberMeService.getLockRemainingTime()
        if (lockTime > 0) {
          const hours = Math.floor(lockTime / (60 * 60 * 1000))
          const minutes = Math.floor((lockTime % (60 * 60 * 1000)) / (60 * 1000))
          const timeStr = hours > 0 ? t('universalLogin.hoursMinutes', { hours, minutes }) : t('universalLogin.minutesOnly', { minutes })
          showWarning(t('auth.autoLoginLockedWithTime', { time: timeStr }))
        } else if (remaining > 0) {
          showWarning(t('auth.autoLoginFailedWithRemaining', { count: remaining }))
        } else {
          showWarning(t('auth.autoLoginLocked'))
        }
        logger.warn('[UniversalLogin] Auto-login failed, token may be expired', { error })
        await RememberMeService.clearCredentials()
        phoneForm.rememberMe = false
      }
    }
  }
})
// 使用全局 dark mode store 来判断暗色模在
import { useDarkModeStore } from '@/stores/darkMode'
const darkModeStore = useDarkModeStore()
// 确保 dark mode store 已初始化
if (typeof window !== 'undefined') {
  // 确保主题已应用（即时应用，无过渡延迟在
  darkModeStore.setThemeMode(darkModeStore.themeMode, 'user', true)
}
const isDarkMode = computed(() => darkModeStore.isDarkMode)

// Welcome 图片路径 - 根据暗色模式切换
const welcomeImgRef = ref<HTMLImageElement | null>(null)
const showWelcomeImage = ref(true) // 控制图片是否显示
const welcomeImageLoadAttempts = ref(0) // 跟踪加载尝试次数
const maxLoadAttempts = 2 // 最多尝在次（原始路径 + 一次回退在

const welcomeImageSrc = computed(() => {
  const baseUrl = import.meta.env.BASE_URL || '/'
  return isDarkMode.value ? `${baseUrl}images/baiwelcome.svg` : `${baseUrl}images/welcome.svg`
})

const handleWelcomeImageError = (event: Event) => {
  const img = event.target as HTMLImageElement

  // 如果加载的是empty.svg（全局错误处理设置的），直接隐藏图在
  if (img.src.includes('empty.svg') || img.dataset.__fallbackApplied === '1') {
    showWelcomeImage.value = false
    // 阻止全局错误处理再次设置empty.svg
    if (img.dataset) {
      img.dataset.__fallbackApplied = '1'
    }
    return
  }

  // 如果已经尝试过回退，或者尝试次数过多，隐藏图片
  if (welcomeImageLoadAttempts.value >= maxLoadAttempts) {
    showWelcomeImage.value = false
    // 阻止全局错误处理设置empty.svg
    if (img.dataset) {
      img.dataset.__fallbackApplied = '1'
    }
    return
  }

  welcomeImageLoadAttempts.value++

  // 如果加载失败，尝试切换到另一个主题的图片
  const baseUrl = import.meta.env.BASE_URL || '/'
  if (isDarkMode.value && img.src.includes('baiwelcome.svg')) {
    img.src = `${baseUrl}images/welcome.svg`
  } else if (!isDarkMode.value && img.src.includes('welcome.svg')) {
    img.src = `${baseUrl}images/baiwelcome.svg`
  } else {
    // 如果回退路径也失败，隐藏图片
    showWelcomeImage.value = false
    // 阻止全局错误处理设置empty.svg
    if (img.dataset) {
      img.dataset.__fallbackApplied = '1'
    }
  }
}

// 监听暗色模式变化，强制更新图片路在
watch(
  isDarkMode,
  () => {
    // 重置状在
    welcomeImageLoadAttempts.value = 0
    showWelcomeImage.value = true
    // 强制更新图片路径
    nextTick(() => {
      if (welcomeImgRef.value) {
        welcomeImgRef.value.src = welcomeImageSrc.value
      }
    })
  },
  { immediate: true }
)

// 移动端检在- 用于控制欢迎文字显示
// 立即检测屏幕宽度，避免初始渲染时显在
const getInitialWidth = (): number => {
  if (typeof window !== 'undefined') {
    return window.innerWidth
  }
  return 1920 // SSR时的默认值
}
const screenWidth = ref(getInitialWidth())

// 更新屏幕宽度的函在
const updateScreenWidth = (): void => {
  if (typeof window !== 'undefined') {
    screenWidth.value = window.innerWidth
  }
}

// 保存 resize 处理函数引用以便清理
let resizeHandler: (() => void) | null = null
// 防抖定时在
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

// 在组件挂载时再次确认屏幕宽度并添加监听器
onMounted(() => {
  // 确保主题在组件挂载时被正确应在
  if (typeof window !== 'undefined') {
    const store = darkModeStore as { initDarkMode?: () => void; applyTheme?: () => void }
    if (store.initDarkMode) {
      store.initDarkMode()
    } else if (store.applyTheme) {
      store.applyTheme()
    }
  }
  // 确保在挂载时更新一在
  updateScreenWidth()
  // 使用 nextTick 确保 DOM 更新后再检在
  nextTick(() => {
    updateScreenWidth()
    // 强制更新图片路径
    if (welcomeImgRef.value) {
      welcomeImgRef.value.src = welcomeImageSrc.value
    }
    // 延迟执行，确保登录容器已经渲染完成并有正确的尺寸
    // 多次尝试，确保获取到正确的宽在
    setTimeout(() => {
      updateBrandMarqueeSpacing()
    }, 0)
    setTimeout(() => {
      updateBrandMarqueeSpacing()
    }, 100)
    setTimeout(() => {
      updateBrandMarqueeSpacing()
    }, 300)
  })
  // 监听窗口大小变化
  resizeHandler = () => {
    updateScreenWidth()
    // 使用防抖，避免频繁调在
    if (resizeTimeout) {
      clearTimeout(resizeTimeout)
    }
    resizeTimeout = setTimeout(() => {
      updateBrandMarqueeSpacing()
    }, 150)
  }
  if (typeof window !== 'undefined' && resizeHandler) {
    window.addEventListener('resize', resizeHandler)
  }

  // 初始化跑马灯拖拽功能和自动滚动（与首页同步）
  initMarqueeDrag()
  // 延迟启动动画，确保DOM和图片都已加载完在
  setTimeout(() => {
    startMarqueeAnimation()
  }, 500)
})

// 动态更新品牌跑马灯容器的位置，使其显示在登录内容区域的左侧，屏幕底在
// 使用在login-left-brand 完全相同的计算方式，确保间距一在
const updateBrandMarqueeSpacing = () => {
  nextTick(() => {
    const loginContainer = document.querySelector('.login-content.login-page') as HTMLElement
    const brandMarqueeContainer = document.querySelector('.brand-marquee-container') as HTMLElement

    if (!loginContainer || !brandMarqueeContainer) {
      // 如果元素还没找到，延迟重在
      setTimeout(() => updateBrandMarqueeSpacing(), 100)
      return
    }

    // 使用双重 requestAnimationFrame 确保在布局完成后获取准确的位置
    const id1 = requestAnimationFrame(() => {
      loginRafIds.delete(id1)
      const id2 = requestAnimationFrame(() => {
        loginRafIds.delete(id2)
        // 获取登录内容区域的位置信息（在login-left-brand 使用相同的逻辑在
        const loginRect = loginContainer.getBoundingClientRect()
        const loginWidth = loginRect.width || loginContainer.offsetWidth
        const loginLeft = loginRect.left
        const _loginBottom = loginRect.bottom // 获取登录窗口的底部位置（预留将来使用在

        // 如果宽度在或left在，说明元素还没渲染完成，延迟重试
        if (loginWidth < 100 || loginLeft <= 0) {
          setTimeout(() => updateBrandMarqueeSpacing(), 100)
          return
        }

        // 间距设定在0px（与右侧登录栏保在0px间距在
        const spacing = 20

        // 计算跑马灯的最大宽度：登录栏左边界 - 间距 - 左侧边距(20px)
        const maxWidth = loginLeft - spacing - 20

        // 仅在需要时动态调整宽度（CSS 已通过变量设置了基础定位在
        // 使用 style 在CSS 变量，使用 CSS 变量控制
        if (maxWidth > 200) {
          brandMarqueeContainer.style.width = `${maxWidth}px`
          brandMarqueeContainer.style.maxWidth = `${maxWidth}px`
        }

        // 添加 data 属性，方便在开发者工具中查找
        brandMarqueeContainer.setAttribute('data-brand-marquee-container', 'true')
        brandMarqueeContainer.setAttribute('data-max-width', `${maxWidth}`)
        brandMarqueeContainer.setAttribute('data-login-left', `${loginLeft}`)
      })
      loginRafIds.add(id2)
    })
    loginRafIds.add(id1)
  })
}

// 跑马灯拖拽功能初始化（与首页同步在
const initMarqueeDrag = () => {
  // 初始化完成，拖拽功能已就在
}

// 鼠标按下（与首页同步在
const handleMarqueeMouseDown = (e: MouseEvent) => {
  if (!marqueeTrackRef.value) return

  isMouseDown = true

  // 停止JavaScript动画
  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }

  isDragging.value = true
  dragStartX.value = e.clientX
  dragCurrentX.value = e.clientX

  // 移除CSS动画，改用transform控制
  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
    // 获取当前transform在
    const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
    const matrix = computedStyle.transform
    if (matrix && matrix !== 'none') {
      const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
      if (matrixValues && matrixValues.length >= 4) {
        dragOffset.value = parseFloat(matrixValues[4]) || 0
        // 规范化位置到有效范围内（登录页有10个卡片）
        const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
        if (items.length > 0) {
          const firstItem = items[0] as HTMLElement
          const itemWidth = firstItem.offsetWidth
          const gap = 8 // 减小间距，与CSS中的gap保持一在
          const singleItemWidth = itemWidth + gap
          const originalWidth = singleItemWidth * 10 // 登录页有10个卡在
          while (dragOffset.value <= -originalWidth) {
            dragOffset.value += originalWidth
          }
          while (dragOffset.value > 0) {
            dragOffset.value -= originalWidth
          }
        }
      }
    } else {
      dragOffset.value = 0
    }
  }

  // 绑定到document，这样可以在整个窗口内拖在
  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('mouseup', handleDocumentMouseUp)

  e.preventDefault()
  e.stopPropagation()
}

// 触摸开始（移动端，与首页同步）
const handleMarqueeTouchStart = (e: Event) => {
  if (!marqueeTrackRef.value) return

  const touchEvent = e as globalThis.TouchEvent
  isTouchStart = true
  const touch = touchEvent.touches[0]

  // 停止JavaScript动画
  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }

  isDragging.value = true
  dragStartX.value = touch.clientX
  dragCurrentX.value = touch.clientX

  // 移除CSS动画，改用transform控制
  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
    const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
    const matrix = computedStyle.transform
    if (matrix && matrix !== 'none') {
      const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
      if (matrixValues && matrixValues.length >= 4) {
        dragOffset.value = parseFloat(matrixValues[4]) || 0
        // 规范化位置到有效范围内（登录页有10个卡片）
        const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
        if (items.length > 0) {
          const firstItem = items[0] as HTMLElement
          const itemWidth = firstItem.offsetWidth
          const gap = 8 // 减小间距，与CSS中的gap保持一在
          const singleItemWidth = itemWidth + gap
          const originalWidth = singleItemWidth * 10 // 登录页有10个卡在
          while (dragOffset.value <= -originalWidth) {
            dragOffset.value += originalWidth
          }
          while (dragOffset.value > 0) {
            dragOffset.value -= originalWidth
          }
        }
      }
    } else {
      dragOffset.value = 0
    }
  }

  document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false })
  document.addEventListener('touchend', handleDocumentTouchEnd)

  e.preventDefault()
  e.stopPropagation()
}

// 全局鼠标移动（绑定在document上，与首页同步）
const handleDocumentMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !marqueeTrackRef.value || !isMouseDown) return

  dragCurrentX.value = e.clientX
  if (marqueeDragRafId !== null) return
  marqueeDragRafId = requestAnimationFrame(() => {
    marqueeDragRafId = null
    if (!isDragging.value || !marqueeTrackRef.value) return
    const deltaX = dragCurrentX.value - dragStartX.value
    const newPosition = dragOffset.value + deltaX

    // 计算原始列表宽度（登录页在0个卡片）
    const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
    if (items.length > 0) {
      const firstItem = items[0] as HTMLElement
      const itemWidth = firstItem.offsetWidth
      const gap = 50
      const singleItemWidth = itemWidth + gap
      const originalWidth = singleItemWidth * 10 // 登录页有10个卡在

      // 实现无缝循环：当超出范围时无缝重在
      let finalPosition = newPosition
      // 处理负值：当小于等在originalWidth时，加上originalWidth使其回到有效范围
      // 这样最后一个卡片后面会无缝显示第一个卡在
      while (finalPosition <= -originalWidth) {
        finalPosition += originalWidth
      }
      // 处理正值：当大在时，减去originalWidth使其回到有效范围
      while (finalPosition > 0) {
        finalPosition -= originalWidth
      }

      marqueeTrackRef.value.style.transform = `translateX(${finalPosition}px)`
    }
  })

  e.preventDefault()
}

// 全局鼠标释放（绑定在document上，与首页同步）
const handleDocumentMouseUp = (e: MouseEvent) => {
  if (!isDragging.value) return

  isMouseDown = false
  isDragging.value = false

  // 取消可能挂起的 raf
  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }

  // 移除事件监听
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)

  // 使用JavaScript动画继续从当前位置滚在
  if (marqueeTrackRef.value) {
    startMarqueeAnimation()
  }

  e.preventDefault()
}

// 全局触摸移动（移动端，与首页同步在
const handleDocumentTouchMove = (e: Event) => {
  if (!isDragging.value || !marqueeTrackRef.value || !isTouchStart) return

  const touchEvent = e as globalThis.TouchEvent
  const touch = touchEvent.touches[0]
  dragCurrentX.value = touch.clientX
  if (marqueeDragRafId !== null) return
  marqueeDragRafId = requestAnimationFrame(() => {
    marqueeDragRafId = null
    if (!isDragging.value || !marqueeTrackRef.value) return
    const deltaX = dragCurrentX.value - dragStartX.value
    const newPosition = dragOffset.value + deltaX

    const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
    if (items.length > 0) {
      const firstItem = items[0] as HTMLElement
      const itemWidth = firstItem.offsetWidth
      const gap = 50
      const singleItemWidth = itemWidth + gap
      const originalWidth = singleItemWidth * 10 // 登录页有10个卡在

      // 实现无缝循环：当超出范围时无缝重在
      let finalPosition = newPosition
      // 处理负值：当小于等在originalWidth时，加上originalWidth使其回到有效范围
      // 这样最后一个卡片后面会无缝显示第一个卡在
      while (finalPosition <= -originalWidth) {
        finalPosition += originalWidth
      }
      // 处理正值：当大在时，减去originalWidth使其回到有效范围
      while (finalPosition > 0) {
        finalPosition -= originalWidth
      }

      marqueeTrackRef.value.style.transform = `translateX(${finalPosition}px)`
    }
  })

  e.preventDefault()
}

// 全局触摸结束（移动端，与首页同步在
const handleDocumentTouchEnd = (e: Event) => {
  if (!isDragging.value) return

  isTouchStart = false
  isDragging.value = false

  // 取消可能挂起的 raf
  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }

  // 移除事件监听
  document.removeEventListener('touchmove', handleDocumentTouchMove)
  document.removeEventListener('touchend', handleDocumentTouchEnd)

  if (marqueeTrackRef.value) {
    startMarqueeAnimation()
  }

  e.preventDefault()
}

// 获取跑马灯图片路径（与首页同步，登录页使用前10个）
const getMarqueeImageSrc = (index: number) => {
  if (index === 1) return kouziIcon
  if (index === 2) return bbxIcon
  if (index === 3) return brand4Icon
  if (index === 4) return openaiIcon
  if (index === 5) return brand6Icon
  if (index === 6) return brand7Icon
  if (index === 7) return brand8Icon
  if (index === 8) return brand9Icon
  if (index === 9) return brand10Icon
  if (index === 10) return brand11Icon
  return '/images/logo.svg'
}

// 获取跑马灯图片alt文本（与首页同步，登录页使用在0个）
const getMarqueeImageAlt = (index: number) => {
  if (index === 1) return t('return.universal_login.扣子图标')
  if (index === 2) return t('return.universal_login.百宝箱logo1')
  if (index === 3) return t('return.universal_login.品牌图标2')
  if (index === 4) return 'OpenAI'
  if (index === 5) return t('return.universal_login.智谱清言3')
  if (index === 6) return 'Gork'
  if (index === 7) return t('return.universal_login.品牌84')
  if (index === 8) return 'Ali'
  if (index === 9) return 'TX'
  if (index === 10) return 'HW'
  return `Brand ${index}`
}

// 图片加载错误处理（与首页同步在
const handleImageError = (event: Event, index: number) => {
  const img = event.target as HTMLImageElement
  const imgNames: Record<number, string> = {
    1: '扣子图标',
    2: '百宝箱logo',
    3: '品牌图标',
    4: 'OpenAI',
    5: '智谱清言',
    6: 'Gork',
    7: '品牌8',
    8: 'Ali',
    9: 'TX',
    10: 'HW'
  }
  logger.error(t('common.errors.loadFailed'), { index, name: imgNames[index] || t('common.unknown'), src: img.src })
  // 如果自定义图标加载失败，fallback到logo
  if (index >= 1 && index <= 10) {
    logger.warn(t('common.errors.loadFailed'))
    img.src = '/images/logo.svg'
  }
}

// 图片loaded successfully处理（与首页同步在
const handleImageLoad = (event: Event, index: number) => {
  const imgNames: Record<number, string> = {
    1: '扣子图标',
    2: '百宝箱logo',
    3: '品牌图标',
    4: 'OpenAI',
    5: '智谱清言',
    6: 'Gork',
    7: '品牌8',
    8: 'Ali',
    9: 'TX',
    10: 'HW'
  }
  if (imgNames[index]) {
    if (import.meta.env.DEV) {
      logger.debug(`${imgNames[index]}loaded successfully:`, (event.target as HTMLImageElement).src)
    }
  }
}

// 启动品牌跑马灯动画（JavaScript控制，与首页同步在
const startMarqueeAnimation = () => {
  if (!marqueeTrackRef.value || isDragging.value) return

  // 停止之前的动在
  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }

  // 停止CSS动画，改用JavaScript控制
  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
  }

  // 等待DOM渲染完成后再计算
  nextTick(() => {
    setTimeout(() => {
      if (!marqueeTrackRef.value) return

      // 获取当前位置
      const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
      const matrix = computedStyle.transform
      let currentPosition = 0
      if (matrix && matrix !== 'none') {
        const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
        if (matrixValues && matrixValues.length >= 4) {
          currentPosition = parseFloat(matrixValues[4]) || 0
        }
      }

      const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
      if (items.length === 0 || items.length < 20) {
        // 如果项目还没加载完（应该在0个：10个原在+ 10个复制），重在
        setTimeout(() => startMarqueeAnimation(), 100)
        return
      }

      const firstItem = items[0] as HTMLElement
      if (!firstItem || firstItem.offsetWidth === 0) {
        // 如果宽度还没计算出来，重在
        setTimeout(() => startMarqueeAnimation(), 100)
        return
      }

      const itemWidth = firstItem.offsetWidth
      const gap = 50
      const singleItemWidth = itemWidth + gap
      const originalWidth = singleItemWidth * 10 // 登录页有10个卡片，不是15在

      // 规范化当前位置到有效范围在[-originalWidth, 0)
      // 确保位置在有效范围内，避免溢在
      while (currentPosition < -originalWidth) {
        currentPosition += originalWidth
      }
      while (currentPosition >= 0) {
        currentPosition -= originalWidth
      }

      const speed = 1

      const animate = () => {
        if (!marqueeTrackRef.value) {
          marqueeAnimationId = null
          return
        }

        currentPosition -= speed

        // 关键优化：提前判断重置时机，实现真正的无缝衔在
        // 在currentPosition <= -originalWidth 时，原始部分在0个卡片已经完全滚在
        // 此时复制部分的第一个卡片正好在原始部分第一个卡片的位置（因为内容完全相同）
        // 应该立即重置，让原始部分的第一个卡片显示，实现无缝循环
        //
        // 为了更早触发重置（在第一个卡片刚开始露出时就重置），我们提前判在
        // 在currentPosition <= -originalWidth + singleItemWidth 时就开始重在
        // 这样可以确保在第一个卡片刚开始从右侧露出时，就立即重在
        // 消除所有延迟和卡顿，实现完美的无缝衔接
        if (currentPosition <= -originalWidth + singleItemWidth) {
          // 加上 originalWidth，让位置回到有效范围内，实现无缝循环
          // 例如：currentPosition = -originalWidth + singleItemWidth 时，重置在singleItemWidth
          //      currentPosition = -originalWidth 时，重置在0
          // 由于复制部分的第一个卡片正好在原始部分第一个卡片的位置（内容完全相同）在
          // 重置后继续滚动，视觉上完全连续，没有任何跳跃
          currentPosition = currentPosition + originalWidth
        }

        marqueeTrackRef.value.style.transform = `translateX(${currentPosition}px)`
        marqueeAnimationId = requestAnimationFrame(animate)
      }

      marqueeAnimationId = requestAnimationFrame(animate)
    }, 100)
  })
}

// 继续注册跑马灯和拖拽相关清理
cleanup.add(() => {
  if (typeof window !== 'undefined' && resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }
  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }
  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }
  loginRafIds.forEach(id => cancelAnimationFrame(id))
  loginRafIds.clear()
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
  document.removeEventListener('touchmove', handleDocumentTouchMove)
  document.removeEventListener('touchend', handleDocumentTouchEnd)
})
</script>

<style scoped lang="scss">
/* ================================================================
   UniversalLogin 组件 CSS 变量定义
   遵循项目规范：使在--ulogin- 前缀
   ================================================================ */

// 根元在CSS 变量定义
.login-page-container {
  // === 布局变量 ===
  --ulogin-container-z-index: var(--z-base);
  --ulogin-content-z-index: var(--z-dropdown);
  --ulogin-marquee-z-index: var(--z-base);

  // === 尺寸变量 ===
  --ulogin-content-width: 420px;
  --ulogin-content-min-width: 380px;
  --ulogin-content-max-width: 480px;
  --ulogin-content-min-height: 580px;
  --ulogin-header-height: 60px;
  --ulogin-spacing: 20px;
  --ulogin-right-spacing: 20px; // 关键：与屏幕右侧的固定间在
  --ulogin-marquee-spacing: 20px;

  // === 圆角变量（跟随全局，见 variables.scss $global-border-radius在===
  --ulogin-border-radius: var(--global-border-radius);
  --ulogin-border-radius-sm: var(--global-border-radius);
  --ulogin-border-radius-xs: var(--global-border-radius);
  --ulogin-border-radius-lg: var(--global-border-radius);

  // === 颜色变量 - 亮色模式 ===
  --ulogin-bg-color: var(--el-bg-color);
  --ulogin-bg-hover: var(--el-fill-color-lighter);
  --ulogin-input-bg: var(--el-fill-color-light);
  --ulogin-input-bg-hover: var(--el-fill-color);
  --ulogin-text-color: var(--color-black-87);
  --ulogin-text-secondary: var(--color-black-60);
  --ulogin-text-placeholder: var(--color-black-45);
  --ulogin-border-color: transparent;
  --ulogin-shadow: none;

  // === 颜色变量 - 暗色模式（通过 .dark-mode 类覆盖） ===
  --ulogin-dark-bg-color: var(--el-bg-color);
  --ulogin-dark-bg-hover: var(--el-fill-color-lighter);
  --ulogin-dark-input-bg: var(--el-fill-color-light);
  --ulogin-dark-input-bg-alt: var(--color-white-5);
  --ulogin-dark-text-color: var(--el-text-color-primary);
  --ulogin-dark-text-secondary: var(--color-white-60);
  --ulogin-dark-text-placeholder: var(--color-white-45);
  --ulogin-dark-border-color: var(--border-unified-color);
  --ulogin-dark-border-hover: var(--border-unified-color);

  // === 输入框变在===
  --ulogin-input-height: 46px;
  --ulogin-input-height-sm: 44px;
  --ulogin-input-padding-x: clamp(8px, 1vw, 10px);
  --ulogin-input-font-size: clamp(14px, 1.6vw, 16px);

  // === 按钮变量 ===
  --ulogin-btn-height: clamp(44px, 4.2vw, 48px);
  --ulogin-btn-font-size: clamp(15px, 1.6vw, 17px);

  // === 过渡动画 ===
  --ulogin-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --ulogin-transition-fast: all 0.2s ease;

  // === 间距变量 ===
  --ulogin-gap: clamp(20px, 2.5vw, 32px);
  --ulogin-gap-sm: clamp(12px, 1.5vw, 16px);
  --ulogin-gap-xs: clamp(4px, 0.6vw, 8px);

  // === 第三方登录图在===
  --ulogin-icon-size: clamp(28px, 2.6vw, 36px);

  // === 跑马灯变在===
  --ulogin-marquee-item-width: 160px;
  --ulogin-marquee-item-height: 80px;
  --ulogin-marquee-gap: 8px;

  // === Element Plus 输入框变量覆在- 亮色模式 ===
  // 注意在-el-input-border-radius 使用全局 var(--global-border-radius)，见 variables.scss
  --el-input-bg-color: var(--el-fill-color-light);
  --el-input-border-color: var(--border-unified-color);
  --el-input-hover-border: var(--el-border-width-primary) solid var(--el-color-primary);
  --el-input-focus-border: var(--el-border-width-primary) solid var(--el-color-primary);
  --el-input-text-color: var(--color-black-87);
  --el-input-placeholder-color: var(--color-black-45);
  --el-input-hover-border: var(--el-color-primary);
  --el-input-focus-border: var(--el-color-primary);

  // === 统一输入框样式变在- 亮色模式 ===
  --unified-input-border-color: var(--border-unified-color);
  --unified-input-bg-color: var(--el-fill-color-light);
  --unified-input-transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  --unified-input-hover-border: var(--el-border-width-primary) solid var(--el-color-primary);
  --unified-input-hover-bg-color: var(--el-bg-color);
  --unified-input-hover-shadow: none;
  --unified-input-focus-border: var(--el-border-width-primary) solid var(--el-color-primary);
  --unified-input-focus-bg-color: var(--el-bg-color);
  --unified-input-focus-shadow: none;
}

// 暗色模式变量覆盖
.login-content.login-page.dark-mode {
  --ulogin-bg-color: var(--ulogin-dark-bg-color);
  --ulogin-bg-hover: var(--ulogin-dark-bg-hover);
  --ulogin-input-bg: var(--ulogin-dark-input-bg);
  --ulogin-text-color: var(--ulogin-dark-text-color);
  --ulogin-text-secondary: var(--ulogin-dark-text-secondary);
  --ulogin-text-placeholder: var(--ulogin-dark-text-placeholder);
  --ulogin-border-color: var(--ulogin-dark-border-color);

  // === Element Plus 输入框变量覆在- 暗色模式 ===
  --el-input-bg-color: var(--color-white-5);
  --el-input-border-color: var(--border-unified-color);
  --el-input-hover-border-color: var(--el-color-primary-light-3);
  --el-input-focus-border-color: var(--el-color-primary-light-3);
  --el-input-text-color: var(--color-white-87);
  --el-input-placeholder-color: var(--color-white-45);

  // === 统一输入框样式变在- 暗色模式 ===
  --unified-input-border-color: var(--border-unified-color);
  --unified-input-bg-color: var(--color-white-5);
  --unified-input-hover-border-color: var(--el-color-primary-light-3);
  --unified-input-hover-bg-color: var(--el-fill-color-dark);
  --unified-input-focus-border-color: var(--el-color-primary-light-3);
  --unified-input-focus-bg-color: var(--el-fill-color-darker);
}

/* 登录页面容器样式 */
.login-page-container {
  position: relative;
  width: auto;
  height: auto;
  min-width: 0;
  min-height: 0;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: visible;
  z-index: var(--ulogin-container-z-index);
  display: inline-block;
}

/* 品牌跑马灯容在- 定位在登录内容区域的左侧，屏幕底在*/
/* 使用 CSS 变量控制定位，与登录栏保持一致的间距 */
.brand-marquee-container {
  position: fixed;
  /* 定位在屏幕左侧底部，与右侧登录栏保持间距 */
  bottom: var(--ulogin-spacing);
  left: var(--ulogin-spacing);
  top: auto;
  right: auto;
  /* 宽度计算：视口宽在- 登录栏宽在- 登录栏右间距 - 跑马灯左间距 - 跑马灯与登录栏间在*/
  width: calc(100vw - var(--ulogin-content-max-width) - var(--ulogin-spacing) - var(--ulogin-spacing) - var(--ulogin-marquee-spacing));
  height: auto;
  min-width: 200px;
  min-height: 100px;
  max-width: calc(100vw - var(--ulogin-content-max-width) - var(--ulogin-spacing) * 2 - var(--ulogin-marquee-spacing));
  max-height: 150px;
  z-index: var(--ulogin-marquee-z-index);
  pointer-events: auto;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: 0;
  padding: 0;
  transform: none;
  background-color: transparent;
  background: transparent;
  overflow: hidden;
  isolation: isolate;
  visibility: visible;
  opacity: 1;
}

/* 品牌跑马灯样在*/
.brand-marquee {
  position: relative;
  width: 100%;
  max-width: 100%;
  height: auto;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 0;
  background-color: transparent;
  background: transparent;
  border-radius: var(--global-border-radius);
  box-shadow: none;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  opacity: 1;
  visibility: visible;
  z-index: inherit;
  box-sizing: border-box;

  &:active {
    cursor: grabbing;
  }
}

.marquee-track {
  display: flex;
  align-items: center;
  gap: var(--ulogin-marquee-gap);
  padding: 0;
  animation: none;
  width: max-content;
  will-change: transform;
  z-index: inherit;
  position: relative;

  /* 拖拽时禁用动画（与首页同步） */
  &.dragging {
    cursor: grabbing;
  }
}

/* 品牌卡片样式已移至共享文在src/styles/brand-marquee.scss，确保首页和登录页同在*/
/* 登录页使用更小的卡片尺寸，避免过大和被裁在*/

/* 登录页：确保跑马灯所有元素都在登录窗口下在*/
.brand-marquee-container .marquee-item,
.brand-marquee-container .marquee-track,
.brand-marquee-container .brand-marquee {
  z-index: inherit;
  position: relative;
}

/* 登录页卡片尺在- 使用更小的尺在*/
.brand-marquee-container .marquee-item {
  min-width: var(--ulogin-marquee-item-width);
  min-height: var(--ulogin-marquee-item-height);
  padding: 12px 16px;
  margin: 0 16px;
}

/* 图片元素 - 登录页使用更小的尺寸 */
.brand-marquee-container .marquee-image {
  width: var(--ulogin-marquee-item-width);
  height: var(--ulogin-marquee-item-height);
  max-width: var(--ulogin-marquee-item-width);
  max-height: var(--ulogin-marquee-item-height);
  min-width: var(--ulogin-marquee-item-width);
  min-height: var(--ulogin-marquee-item-height);
  object-fit: contain;
  opacity: 1;
  transition: opacity 0.3s ease;
  background: transparent;
  background-color: transparent;
  padding: 0;
  border: none;
  box-shadow: none;
  border-radius: var(--global-border-radius);
}

.marquee-image:hover {
  opacity: 0.9;
}

/* 跑马灯动在- 已改为JavaScript控制，保留此动画定义以备后用 */
@keyframes marquee {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
    /* 移动一半距离实现无缝滚在*/
  }
}

/* 确保跑马灯在登录表单后面显示 */
.login-content.login-page {
  position: fixed;
  z-index: var(--ulogin-content-z-index);
  isolation: isolate;
}

/* 确保登录窗口内部所有内容都在正确的层级，与边框（容器）层级一在*/
.login-content.login-page>*,
.login-content.login-page .form-container,
.login-content.login-page .account-form-container,
.login-content.login-page .phone-form-container,
.login-content.login-page .login-form,
.login-content.login-page .login-bottom-group,
.login-content.login-page .login-button,
.login-content.login-page .el-button {
  position: relative;
  z-index: var(--ulogin-content-z-index);
}

/* el-form-item 在el-input 层级单独控制，确保账号输入框的下拉菜单不被密码输入框遮挡 */
.login-content.login-page .el-form-item,
.login-content.login-page .el-form-item__content,
.login-content.login-page .el-input {
  position: relative;
}

/* 容器样式已下沉至 .login-content.login-page */

/* 登录内容样式 - 强制使用固定宽度解决布局问题 */
/* 注意：暂时使用硬编码值，后续可改在CSS 变量 */
.login-content.login-page {
  /* 尺寸 - 直接使用硬编码值确保生在*/
  width: 420px;
  min-width: 380px;
  max-width: 480px;
  min-height: 580px;

  /* 定位 - 使用 CSS 变量控制右间距，带回退在*/
  position: fixed;
  top: calc(var(--ulogin-header-height) + var(--ulogin-spacing));
  right: var(--ulogin-right-spacing);
  left: auto;
  bottom: var(--ulogin-spacing);

  /* 外观 */
  background-color: var(--ulogin-bg-color);
  background: var(--ulogin-bg-color);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-radius: var(--ulogin-border-radius);
  padding-top: clamp(32px, 3.5vw, 48px);
  padding-left: clamp(24px, 3vw, 40px);
  padding-right: clamp(24px, 3vw, 40px);
  padding-bottom: 20px;
  border: var(--unified-border);
  box-sizing: border-box;

  /* 布局 */
  display: flex;
  flex-direction: column;
  gap: var(--ulogin-gap);
  justify-content: center;
  align-items: stretch;
  overflow-x: hidden;
  overflow-y: auto;
  z-index: var(--ulogin-content-z-index);
  margin: 0;
  color: var(--el-text-color-primary);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    backdrop-filter 0.3s ease,
    background-color 0.2s ease;
  will-change: transform;
  transform: none;
  backface-visibility: visible;
  -webkit-backface-visibility: visible;
}

/* Hover悬浮效果 */
.login-content.login-page:hover {
  transform: none;
  box-shadow: none;
  backdrop-filter: blur(0.6px);
  -webkit-backdrop-filter: blur(0.6px);
  background-color: var(--ulogin-bg-hover);
  border: none;
}

/* 暗色模式 - 使用 :where(html.dark)，使用 CSS 变量与低特异性*/
:where(html.dark) .login-content.login-page.dark-mode,
:where(body.dark) .login-content.login-page.dark-mode,
.login-content.login-page.dark-mode {
  background-color: var(--ulogin-dark-bg-color);
  background: var(--ulogin-dark-bg-color);
  color: var(--ulogin-dark-text-color);
  opacity: 1;
  visibility: visible;
  backdrop-filter: blur(0.6px);
  -webkit-backdrop-filter: blur(0.6px);
  border: var(--unified-border);
  border-color: var(--ulogin-dark-border-color);
  box-shadow: none;
  transform: none;
  display: flex;
  z-index: var(--ulogin-content-z-index);
  padding-bottom: 20px;
}

/* 中等屏幕尺寸在93px-1023px）：确保定位正确 */
/* 使用 CSS 变量控制尺寸和定位，确保可配置在*/
@media (width >= 993px) and (max-width: 1023px) {
  .login-content.login-page {
    /* 尺寸 - 使用 CSS 变量，带硬编码回退在*/
    width: var(--ulogin-content-width);
    min-width: var(--ulogin-content-min-width);
    max-width: var(--ulogin-content-max-width);
    /* 定位 - 使用 CSS 变量，带硬编码回退在*/
    position: fixed;
    top: calc(var(--ulogin-header-height) + var(--ulogin-spacing));
    right: var(--ulogin-right-spacing);
    left: auto;
    bottom: var(--ulogin-spacing);
    z-index: var(--ulogin-content-z-index);
    min-height: var(--ulogin-content-min-height);
    max-height: none;
  }

  :where(html.dark) .login-content.login-page.dark-mode,
  :where(body.dark) .login-content.login-page.dark-mode,
  .login-content.login-page.dark-mode {
    position: fixed;
    top: calc(var(--ulogin-header-height) + var(--ulogin-spacing));
    right: 20px;
    /* 固定 20px */
    left: auto;
    bottom: var(--ulogin-spacing);
    z-index: var(--ulogin-content-z-index);
    min-height: var(--ulogin-content-min-height);
    max-height: calc(100vh - 84px);
    border: var(--unified-border);
    border-color: var(--color-black-101010);
  }
}

/* 桌面端：确保暗色模式也使用绝对定位到右侧 */
/* 使用 CSS 变量控制尺寸和定位，确保可配置在*/
@media (width >= 1024px) {
  .login-content.login-page {
    /* 尺寸 - 使用 CSS 变量，带硬编码回退在*/
    width: var(--ulogin-content-width);
    min-width: var(--ulogin-content-min-width);
    max-width: var(--ulogin-content-max-width);
    /* 定位 - 使用 CSS 变量，带硬编码回退在*/
    position: fixed;
    top: calc(var(--ulogin-header-height) + var(--ulogin-spacing));
    right: var(--ulogin-right-spacing);
    left: auto;
    bottom: var(--ulogin-spacing);
    z-index: var(--ulogin-content-z-index);
    min-height: var(--ulogin-content-min-height);
    max-height: none;
  }

  :where(html.dark) .login-content.login-page.dark-mode,
  :where(body.dark) .login-content.login-page.dark-mode,
  .login-content.login-page.dark-mode {
    position: fixed;
    top: calc(var(--ulogin-header-height) + var(--ulogin-spacing));
    right: 20px;
    /* 固定 20px */
    left: auto;
    bottom: var(--ulogin-spacing);
    z-index: var(--ulogin-content-z-index);
    min-height: var(--ulogin-content-min-height);
    max-height: calc(100vh - 84px);
    border: var(--unified-border);
    border-color: var(--color-black-101010);
  }
}

/* 暗色模式Hover悬浮效果 */
:where(.login-content.login-page.dark-mode):hover {
  transform: none;
  box-shadow: none;
  backdrop-filter: blur(0.6px);
  -webkit-backdrop-filter: blur(0.6px);
  background-color: var(--ulogin-dark-bg-hover);
  border: var(--unified-border);
  color: var(--ulogin-dark-text-color);
}

/* 暗色模式下确保所有文字内容可在*/
.login-content.login-page.dark-mode,
.login-content.login-page.dark-mode * {
  color: var(--ulogin-dark-text-color);
}

/* 暗色模式下特定元素的文字颜色 */
:where(.login-content.login-page.dark-mode) .el-input__inner,
:where(.login-content.login-page.dark-mode) .el-select__input,
.login-content.login-page.dark-mode input,
.login-content.login-page.dark-mode textarea,
.login-content.login-page.dark-mode select {
  color: var(--ulogin-dark-text-color);
}

:where(.login-content.login-page.dark-mode) .el-input__placeholder,
:where(.login-content.login-page.dark-mode) .el-select__placeholder {
  color: var(--ulogin-dark-text-secondary);
}

:where(.login-content.login-page.dark-mode) .el-button,
.login-content.login-page.dark-mode button {
  color: var(--ulogin-dark-text-color);
}

/* 登录头部 - 极简黑白灰风在*/
.login-header {
  text-align: center;
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Welcome SVG样式 - 在logo上方 */
.welcome-svg {
  width: clamp(420px, 38vw, 560px);
  height: auto;
  object-fit: contain;
  margin-top: 0;
  margin-bottom: clamp(4px, 0.5vw, 6px);
  display: block;
  visibility: visible;
  opacity: 1;
  max-width: 100%;
  filter: none;
  transition: filter 0.3s ease;
}

/* 暗色模式在welcome SVG 保持原色，不变白 */
:where(html.dark) .welcome-svg,
:where(.login-content.login-page.dark-mode) .welcome-svg,
.login-brand .welcome-svg.dark-mode {
  filter: none;
  transition: filter 0.3s ease;
}

/* 移动端也显示欢迎图片 - 与桌面端一在*/
@media (width <= 992px) {

  .welcome-svg,
  .login-brand .welcome-svg,
  .login-content .welcome-svg,
  .login-content.login-page .welcome-svg,
  .login-page .welcome-svg {
    display: block;
    visibility: visible;
    opacity: 1;
    width: clamp(280px, 60vw, 420px);
    height: auto;
    margin-top: 0;
    margin-bottom: clamp(4px, 0.5vw, 6px);
  }
}

/* Logo容器 - 重新设计 */
.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
  text-align: center;
  gap: var(--ulogin-gap-sm);
  opacity: 1;
  visibility: visible;

  /* Welcome 图片单独一在*/
  .welcome-svg {
    display: block;
    visibility: visible;
    opacity: 1;
    width: clamp(420px, 38vw, 560px);
    height: auto;
    margin: 0 auto;
    margin-bottom: 0;
  }
}

/* Logo样式 - 响应式适配，调整尺在*/
.login-logo {
  width: auto;
  height: auto;
  max-width: 180px;
  max-height: 60px;
  object-fit: contain;
  margin: 0;
  margin-bottom: clamp(16px, 2vw, 24px);
  display: block;
  visibility: visible;
  opacity: 1;
}

.login-title {
  font-size: clamp(20px, 2.5vw, 28px);
  font-weight: 600;
  margin: 0 0 clamp(6px, 0.8vw, 8px) 0;
  color: var(--el-text-color-primary);
  background: none;
  -webkit-background-clip: unset;
  -webkit-text-fill-color: var(--el-text-color-primary);
  background-clip: unset;
}

.login-subtitle {
  font-size: clamp(12px, 1.2vw, 14px);
  color: var(--el-text-color-secondary);
  margin: 0;
}

/* 安全提示 - 重新设计 */
.security-alert {
  margin: 0;
  /* 移除边距，使用父容器在gap */
  padding: 0;
  width: 100%;
}

/* 表单区域样式 - 重新设计 */
.form-area {
  flex: 1 1 auto;
  /* 占据剩余空间 */
  flex-grow: 1;
  flex-shrink: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  gap: clamp(20px, 2.5vw, 32px);
  /* 与主容器相同的间距设定，与welcome上面部分相同 */
  min-height: 0;
  /* 允许收缩 */
  width: 100%;
  overflow: visible;
  /* 确保第三方登录按钮放大效果不被裁在*/
  justify-content: flex-start;
  /* 确保内容从顶部开在*/
  padding-bottom: 0;
  /* 移除底部内边距，由父容器控制 */
  margin-bottom: 0;
  /* 移除底部外边在*/
}

/* 登录操作区域容器 - 独立于表单容器，位于 form-area 层级 */
.login-actions-container {
  display: flex;
  flex-direction: column;
  gap: clamp(20px, 2.5vw, 28px);
  /* 内部元素间距 */
  width: 100%;
  margin: 0;
  margin-bottom: 0;
  /* 底部间距由父容器在padding-bottom (20px) 控制 */
  margin-top: auto;
  /* 将容器推到底部，消除 form-area 产生的额外空在*/
  padding: 0;
  padding-bottom: 0;
  /* 确保没有额外的底部内边距 */
  align-items: stretch;
  /* 保持 stretch，让登录按钮等元素可以全在*/
  /* 在form-container 平级，使在form-area 在gap (clamp(20px, 2.5vw, 32px)) 控制与表单容器的间距 */
}

/* 登录操作区域内的第三方登录图在- 确保居中显示 */
.login-actions-container .third-party-login-icons {
  width: fit-content;
  /* 允许容器只占用实际需要的宽度，实现居在*/
  max-width: 100%;
  /* 限制最大宽度不超过父容在*/
  margin: 0 auto;
  /* 水平居中 */
  margin-left: auto;
  /* 确保左外边距自动 */
  margin-right: auto;
  /* 确保右外边距自动 */
  padding: 0;
  /* 移除内边在*/
  align-self: center;
  /* 在flex 容器中自身居中，覆盖父容器的 align-items: stretch */
  display: flex;
  /* 使用 flexbox 布局 */
  flex-direction: column;
  /* 垂直排列 */
  align-items: center;
  /* 水平居中 */
}

/* 登录操作区域内的登录按钮 */
.login-actions-container .login-button {
  width: 100%;
  margin: 0;
}

/* 登录按钮包裹层：始终接收点击，子按钮 disabled 时点击会落到此处 */
.login-button-wrap {
  position: relative;
  z-index: calc(var(--z-base) + 9);
  width: 100%;
  min-height: 44px;
  cursor: pointer;
  pointer-events: auto;
  outline: none;
}

.login-button-wrap .el-button {
  pointer-events: none;
}

/* 登录操作区域内的协议文字 */
.login-actions-container .login-agreement-text {
  width: 100%;
  margin: 0;
  padding: 0;
  padding-top: 0;
  /* 移除之前添加在padding-top */
}

/* 统一表单容器样式 - 账号和手机表单完全一在*/
.form-container,
.account-form-container,
.username-input-wrapper,
.phone-form-container {
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: clamp(16px, 2vw, 24px);
  /* 统一表单项间在*/
  min-height: 0;
  /* 允许收缩 */
  overflow: visible;
  /* 确保第三方登录按钮放大效果不被裁在*/
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  opacity: 1;
  visibility: visible;
  background-color: transparent;
  background: transparent;
}

/* 暗色模式下的表单容器 - 无背景色 */
:where(.login-content.login-page.dark-mode) .form-container,
:where(.login-content.login-page.dark-mode) .account-form-container,
:where(.login-content.login-page.dark-mode) .phone-form-container,
:where(.login-content.login-page.dark-mode) .login-form,
:where(.login-content.login-page.dark-mode) .login-actions-container {
  background: transparent;
  color: var(--el-text-color-primary);
}

.login-form {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  /* 统一表单项间距，在form-container 保持一在*/
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  --el-form-label-width: 0;
}

/* 覆盖 Element Plus 表单默认样式 - 使用 :deep 与单类，禁止高特异在*/
:where(#app) .login-form.el-form,
:where(#app) .el-form.login-form,
:where(#app) .account-form-container .el-form,
:where(#app) .phone-form-container .el-form,
:where(#app) .form-container .el-form {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  --el-form-label-width: 0;
  flex: 1 1 auto;
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: auto;
}

/* 确保账号和手机表单的 login-form 样式完全一在*/
.account-form-container .login-form,
.phone-form-container .login-form {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  /* 统一表单项间在*/
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  /* 确保与通用 .login-form 样式完全一在*/
  align-items: stretch;
  justify-content: flex-start;
}

/* 确保 Element Plus 表单元素也是 100% 宽度 */
.login-form.el-form,
.el-form.login-form {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* 确保所在Element Plus form 相关类都在100% 宽度 */
/* 确保所在Element Plus form 相关类都在100% 宽度 - 统一账号和手机表在*/
.form-container .el-form,
.form-container .login-form,
.account-form-container .el-form,
.account-form-container .login-form,
.phone-form-container .el-form,
.phone-form-container .login-form {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.login-form .el-form-item {
  margin-bottom: 0;
  /* 移除默认底部间距，使在gap 统一控制 */
  margin-top: 0;
  padding: 0;
}

:where(.login-form) :deep(.el-form-item__label) {
  width: 0;
  min-width: 0;
  max-width: 0;
  padding: 0;
  margin: 0;
  flex: 0 0 0;
  display: none;
}

.login-form.el-form--default :deep(.el-form-item__label),
.login-form.el-form--label-right :deep(.el-form-item__label),
.el-form--default:where(.login-form) :deep(.el-form-item__label),
.el-form--label-right:where(.login-form) :deep(.el-form-item__label) {
  width: 0;
  min-width: 0;
  max-width: 0;
  padding: 0;
  margin: 0;
  flex: 0 0 0;
  display: none;
}

:where(.login-form) :deep(.el-form-item__content) {
  flex: 1;
  width: 100%;
  min-width: 0;
  margin-left: 0;
}

.login-form.el-form--default :deep(.el-form-item__content),
.login-form.el-form--label-right :deep(.el-form-item__content),
.el-form--default:where(.login-form) :deep(.el-form-item__content),
.el-form--label-right:where(.login-form) :deep(.el-form-item__content) {
  flex: 1;
  width: 100%;
  min-width: 0;
  margin-left: 0;
}

/* 手机号表单项 - 完全移除底部间距 */
:where(.login-form) :deep(.el-form-item[prop='phoneNumber']) {
  margin-bottom: 0;
  /* 完全移除底部间距 */
  padding-bottom: 0;
}

:where(.login-form) :deep(.el-form-item[prop='phoneNumber'] .el-form-item__content) {
  margin: 0;
  /* 移除所有边在*/
  padding: 0;
  /* 在phone-background-bar 自己控制 */
  padding-top: 0;
  padding-bottom: 0;
  height: auto;
  min-height: auto;
  line-height: 1;
  display: flex;
  align-items: stretch;
  background-color: transparent;
  /* 透明，让 phone-background-bar 显示背景 */
  border-radius: var(--global-border-radius);
  box-sizing: border-box;
}

:where(.login-form) :deep(.el-form-item[prop='phoneNumber'] .el-form-item__error) {
  margin-bottom: 0;
  padding-bottom: 0;
}

/* 手机号背景栏样式已统一到下方定在*/

/* 验证码表单项 - 添加适当的间在*/
:where(.login-form) :deep(.el-form-item[prop='verificationCode']) {
  margin-top: 0;
  /* 保持顶部无间距，与手机号输入框紧在*/
  margin-bottom: clamp(12px, 1.5vw, 16px);
  /* 添加底部间距，确保与下方元素有足够距在*/
  padding-top: 0;
  padding-bottom: 0;
  position: relative;
  /* 确保定位上下文正在*/
  z-index: var(--z-base);
  /* 确保在其他元素之在*/
}

:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__content) {
  margin-top: 0;
  padding-top: 0;
  /* 移除顶部内边在*/
  margin-bottom: 0;
  padding-bottom: 0;
  /* 移除底部内边在*/
  padding-left: 0;
  /* 移除左侧内边距，由verification-code-background-bar控制 */
  padding-right: 0;
  /* 移除右侧内边距，由verification-code-background-bar控制 */
  background-color: transparent;
  /* 移除背景色，由verification-code-background-bar控制 */
  background: transparent;
  border-radius: var(--global-border-radius);
  /* 移除圆角，由verification-code-background-bar控制 */
  box-sizing: border-box;
  box-shadow: none;
  /* 移除投影 */
}

/* 暗色模式下验证码输入框容器背景色 - 透明，由verification-code-background-bar控制 */
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__content) {
  background-color: transparent;
  background: transparent;
  box-shadow: none;
}

/* 暗色模式下验证码背景在*/
:where(.login-content.login-page.dark-mode) .verification-code-background-bar {
  background-color: transparent;
  background: transparent;
  border: none;
}

:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__error) {
  margin-top: 0;
  padding-top: 0;
}

/* ============================================
   统一输入框样式系在- 所有输入框共享统一样式
   修改这里即可统一更新所有输入框的样在
   ============================================ */

/* 统一输入框样式变在- 亮色模式（圆角跟随全局 variables.scss在*/
.login-content.login-page {
  --el-input-border-radius: var(--global-border-radius);
  --unified-input-border-color: var(--border-unified-color);
  --unified-input-bg-color: var(--el-fill-color-light);
  --unified-input-transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  /* hover 状在*/
  --unified-input-hover-border: var(--el-border-width-primary) solid var(--el-color-primary);
  --unified-input-hover-bg-color: var(--el-bg-color);
  --unified-input-hover-shadow: none;
  /* focus 状在*/
  --unified-input-focus-border: var(--el-border-width-primary) solid var(--el-color-primary);
  --unified-input-focus-bg-color: var(--el-bg-color);
  --unified-input-focus-shadow: none;
}

/* 统一输入框样式变在- 暗色模式 */
.login-content.login-page.dark-mode {
  --el-input-border-radius: var(--global-border-radius);
  --unified-input-border-color: var(--border-unified-color);
  --unified-input-bg-color: var(--color-white-5);
  --unified-input-transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  /* hover 状在*/
  --unified-input-hover-border-color: var(--el-color-primary-light-3);
  --unified-input-hover-bg-color: var(--el-fill-color-dark);
  --unified-input-hover-shadow: none;
  /* focus 状在*/
  --unified-input-focus-border-color: var(--el-color-primary-light-3);
  --unified-input-focus-bg-color: var(--el-fill-color-darker);
  --unified-input-focus-shadow: none;
}

/* 统一输入框基础样式 - 应用到所有输入框 */
:where(.login-form) :deep(.unified-input-base),
.phone-background-bar.unified-input-base,
.verification-code-digit.unified-input-base {
  border: 2px solid var(--unified-input-border-color);
  border-radius: var(--el-input-border-radius);
  /* 使用全局变量 */
  background-color: var(--unified-input-bg-color);
  background: var(--unified-input-bg-color);
  transition: var(--unified-input-transition);
  box-shadow: none;
}

/* 统一输入在hover 状在- 无发光投在*/
:where(.login-form) :deep(.unified-input-base:hover),
.phone-background-bar.unified-input-base:hover,
.verification-code-digit.unified-input-base:hover,
:where(.login-form) :deep(.unified-input-base.is-hover),
.phone-background-bar.unified-input-base:focus-within {
  border: 2px solid var(--unified-input-hover-border-color);
  background-color: var(--unified-input-hover-bg-color);
  background: var(--unified-input-hover-bg-color);
  box-shadow: none;
}

/* 统一输入在focus 状在- 无发光投在*/
:where(.login-form) :deep(.unified-input-base:focus),
:where(.login-form) :deep(.unified-input-base.is-focus),
:where(.login-form) :deep(.unified-input-base:focus-within),
.phone-background-bar.unified-input-base:focus-within,
.verification-code-digit.unified-input-base:focus,
.verification-code-digit.unified-input-base.is-focused {
  border: 2px solid var(--unified-input-focus-border-color);
  background-color: var(--unified-input-focus-bg-color);
  background: var(--unified-input-focus-bg-color);
  box-shadow: none;
}

/* ============================================
   统一输入框样式应在- 自动应用到所有输入框
   ============================================ */

/* 验证码背景栏 - 添加适当的间在*/
.verification-code-background-bar {
  margin-top: 0;
  margin-bottom: 0;
  /* 保持底部无间距，由父元素控制 */
  padding-top: 0;
  padding-bottom: 0;
  position: relative;
  /* 确保定位上下文正在*/
  z-index: var(--z-base);
  /* 确保在其他元素之在*/
}

/* 确保手机号表单项和验证码表单项之间没有间在*/
:where(.login-form) :deep(.el-form-item[prop='phoneNumber'] + .el-form-item[prop='verificationCode']) {
  margin-top: 0;
  padding-top: 0;
}

:where(.login-form) :deep(.el-form-item[prop='phoneNumber'] ~ .el-form-item[prop='verificationCode']) {
  margin-top: 0;
  padding-top: 0;
}

/* 登录按钮所在的表单在- 已移在login-actions-container，此样式保留用于兼容在*/
.login-form .el-form-item:last-child,
.login-form .el-form-item:has(.login-button) {
  margin: 0;
  padding: 0;
}

/* ============================================
   登录表单输入框样在
   - 使用单类 / :deep 确保 6px 圆角，禁止高特异在
   ============================================ */

/* 登录表单输入框基础样式 - 仅一层描边：只用 border，禁在outline/box-shadow 避免双层 */
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper),
:where(.login-content.login-page) :where(.login-form) :deep(.el-input__wrapper),
:where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper),
:where(.login-form) :deep(.el-input__wrapper) {
  background-color: var(--el-fill-color-light);
  border: 2px solid var(--border-unified-color);
  border-radius: var(--global-border-radius);
  transition: border-color 0.2s ease, border-width 0.2s ease, background-color 0.2s ease;
  height: 46px;
  box-shadow: none;
  outline: none;
}

/* hover 状在*/
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper:hover),
:where(.login-content.login-page) :where(.login-form) :deep(.el-input__wrapper:hover),
:where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper:hover),
:where(.login-form) :deep(.el-input__wrapper:hover) {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: none;
  outline: none;
}

/* focus 状在- 仅改 border 颜色，不增加第二层描在*/
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper.is-focus),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-input.is-focus .el-input__wrapper),
:where(.login-content.login-page) :where(.login-form) :deep(.el-input.is-focus .el-input__wrapper),
:where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper.is-focus),
:where(.account-form-container) :where(.login-form) :deep(.el-input.is-focus .el-input__wrapper),
:where(.login-form) :deep(.el-input__wrapper.is-focus),
:where(.login-form) :deep(.el-input.is-focus .el-input__wrapper) {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: none;
  outline: none;
}

/* 登录表单在input 获得焦点时禁用全局 :focus-visible 在outline，避免与 wrapper 在border 形成双层描边 */
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-input__inner:focus),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-input__inner:focus-visible),
:where(.login-content.login-page) :where(.login-form) :deep(.el-input__wrapper input:focus),
:where(.login-content.login-page) :where(.login-form) :deep(.el-input__wrapper input:focus-visible),
:where(.account-form-container) :where(.login-form) :deep(.el-input__inner:focus),
:where(.account-form-container) :where(.login-form) :deep(.el-input__inner:focus-visible),
:where(.login-form) :deep(.el-input__inner:focus),
:where(.login-form) :deep(.el-input__inner:focus-visible),
:where(.login-form) :deep(.el-input__wrapper input:focus),
:where(.login-form) :deep(.el-input__wrapper input:focus-visible) {
  outline: none;
  box-shadow: none;
}

/* 暗色模式：账在密码/验证码输入框 - 透明背景、深色描边，无亮在*/
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input__wrapper) {
  background: transparent;
  border-color: var(--color-white-15);
}

:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper:hover),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input__wrapper:hover) {
  background: transparent;
  border-color: var(--el-color-primary-light-3);
}

:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input__wrapper.is-focus),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input.is-focus .el-input__wrapper),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input__wrapper.is-focus),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input.is-focus .el-input__wrapper) {
  background: transparent;
  border-color: var(--el-color-primary-light-3);
}

/* 暗色模式：验证码输入与验证码小框 - 无背在*/
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-input__wrapper),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-input__wrapper),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.captcha-input .el-input__wrapper) {
  background: transparent;
  border-color: var(--color-white-15);
}

/* 输入框内在- 基础样式 */
:where(.login-form) :deep(.el-input__inner) {
  color: var(--el-text-color-primary);
  background: transparent;
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input__inner) {
  color: var(--el-text-color-primary);
}

/* 账号表单输入框文字样式优在- 使用更具体的选择在*/
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='email'] .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='phone'] .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='code'] .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.captcha-input .el-input__inner) {
  color: var(--color-black-87);
  /* 亮色模式：深色文在*/
  font-size: clamp(14px, 1.6vw, 16px);
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: 0.01em;
  padding-left: 8px;
  /* 与左侧图标保持合理间在*/
  padding-right: 8px;
}

/* 账号表单输入框占位符颜色 */
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-input__inner::placeholder),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner::placeholder),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='email'] .el-input__inner::placeholder),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='phone'] .el-input__inner::placeholder),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='code'] .el-input__inner::placeholder) {
  color: var(--color-black-45);
  /* 亮色模式：低对比度灰色占位符 */
  font-size: clamp(14px, 1.6vw, 16px);
  font-weight: 400;
}

/* 暗色模式下账号表单输入框文字样式 */
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-input__inner),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='email'] .el-input__inner),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='phone'] .el-input__inner),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='code'] .el-input__inner) {
  color: var(--color-white-87);
  /* 暗色模式：浅色文在*/
  font-size: clamp(14px, 1.6vw, 16px);
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: 0.01em;
}

:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-input__inner::placeholder),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner::placeholder),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='email'] .el-input__inner::placeholder),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='phone'] .el-input__inner::placeholder),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='code'] .el-input__inner::placeholder) {
  color: var(--color-white-45);
  /* 暗色模式：低对比度白色占位符 */
  font-size: clamp(14px, 1.6vw, 16px);
  font-weight: 400;
}

/* 其他输入框占位符颜色保持原样在*/
:where(.login-form) :deep(.el-input__inner::placeholder):where(:not(.account-form-container .el-input__inner::placeholder)) {
  color: var(--el-text-color-placeholder);
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input__inner::placeholder):where(:not(.account-form-container .el-input__inner::placeholder)) {
  color: var(--el-text-color-placeholder);
}

/* 手机号输入框背景栏样式已统一到下方定在*/

/* 确保所有输入框的prefix宽度一致，对齐文字（包括验证码在*/
:where(.login-form) :deep(.el-form-item .el-input__prefix) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(45px, 5.5vw, 60px);
  min-width: clamp(45px, 5.5vw, 60px);
  max-width: clamp(45px, 5.5vw, 60px);
  padding: 0;
  padding-right: 4px;
  margin: 0;
  margin-right: 0;
  flex-shrink: 0;
}

/* 冗余规则已删除，所有输入框prefix样式由上方统一规则管理 */


/* 历史记录输入框包装器 */
.history-input-wrapper {
  position: relative;
  width: 100%;
}

/* 账号输入框包装器 - 确保下拉菜单可以显示 */
.username-input-wrapper {
  position: relative;
  width: 100%;
  overflow: visible;
  /* 允许下拉菜单显示 */
}

/* 账号输入框表单项 - 提升层级，确保下拉菜单不被后续表单项遮挡 */
/* 使用单类在:deep，使用 CSS 变量与低特异性*/
.username-form-item {
  position: relative;
  z-index: calc(var(--z-base) + 9);
}

/* 密码输入框表单项 - 降低层级，确保不遮挡账号输入框的下拉菜单 */
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password']),
:where(.login-form) :deep(.el-form-item[prop='password']) {
  position: relative;
  z-index: var(--z-base);
}

/* 手机号输入框包装在*/
.phone-input-wrapper {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  /* 允许收缩 */
  overflow: visible;
  /* 允许下拉菜单显示 */
  box-sizing: border-box;
}

/* 历史记录下拉菜单 */
.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  width: 100%;
  background-color: hsl(var(--popover));
  /* 使用设计令牌：弹出框背景在*/
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  z-index: var(--z-modal);
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
  display: block;
  visibility: visible;
  opacity: 1;
}

/* 暗色模式下历史记录下拉菜单（扁平化：沿用边框，无 box-shadow在*/
:where(.login-content.login-page.dark-mode) .history-dropdown,
:where(html.dark) .history-dropdown {
  /* 继承默认样式 */
}

.history-dropdown::-webkit-scrollbar {
  width: 6px;
}

.history-dropdown::-webkit-scrollbar-thumb {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.history-dropdown::-webkit-scrollbar-thumb:hover {
  background: var(--el-bg-color);
}

/* 历史记录在*/
.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
  color: hsl(var(--popover-foreground));
  /* 使用设计令牌：弹出框文字在*/
  min-height: 40px;
  line-height: 1.5;
  background-color: transparent;
}

.history-item:hover {
  background-color: hsl(var(--muted));
  /* 使用设计令牌：柔和背景色 */
}

.history-item:active {
  background-color: hsl(var(--accent) / 0.1);
  /* 使用设计令牌：强调色透明 */
}

.history-item .el-icon {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.history-item span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 暗色模式下的历史记录样式 - 使用设计令牌 */
:where(.login-content.login-page.dark-mode) .history-item,
:where(html.dark) .history-item {
  color: hsl(var(--popover-foreground));
}

:where(.login-content.login-page.dark-mode) .history-item:hover,
:where(html.dark) .history-item:hover {
  background-color: hsl(var(--muted));
}

:where(.login-content.login-page.dark-mode) .history-item:active,
:where(html.dark) .history-item:active {
  background-color: hsl(var(--accent) / 0.15);
}

:where(.login-content.login-page.dark-mode) .history-item .el-icon {
  color: var(--el-text-color-secondary);
}

/* 国家区号选择器与下拉样式 */
/* 国家代码文本样式 */
.country-code-text {
  display: inline-block;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  pointer-events: auto;
  position: relative;
  z-index: var(--z-base);
  margin: 0;
  /* 删除所有外边距 */
  padding: 0;
  /* 删除所有内边距 */
}

/* 完全隐藏国家代码选择器，不影响布局 */
.phone-background-bar>.country-code-select-inline {
  display: none;
}


/* 国家代码文本样式 - 可点在*/
.phone-background-bar>.country-code-text {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.country-code-select-inline {
  width: 100%;
  /* 占满父容器宽在*/
  min-width: 100%;
  /* 最小宽度为父容器宽在*/
  max-width: 100%;
  /* 最大宽度为父容器宽在*/
  overflow: visible;
  /* 允许下拉菜单显示 */
  box-sizing: border-box;
}

:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper) {
  cursor: pointer;
  width: 100%;
  /* 占满父容器宽在*/
  min-width: 100%;
  /* 最小宽度为父容器宽在*/
  max-width: 100%;
  /* 最大宽度为父容器宽在*/
  overflow: visible;
  /* 允许下拉菜单显示 */
  box-sizing: border-box;
}

:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix) {
  max-width: 24px;
  /* 增加最大宽度，确保箭头有足够空在*/
  width: auto;
  min-width: 20px;
  /* 增加最小宽在*/
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;
}

/* .country-code-popper 样式已移至全局样式块（文件末尾在*/

.country-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--el-text-color-primary);
}

:where(.login-form) :deep(.el-input__prefix-inner) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 0;
  max-width: fit-content;
  height: auto;
  min-height: 0;
  line-height: 1;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  /* 确保容器只包裹图标，不额外占用空在*/
  box-sizing: content-box;
}

/* phone-background-bar 内输入框在hover 状在*/
.phone-background-bar :deep(.el-input__wrapper:hover) {
  background-color: transparent;
  border-color: var(--unified-input-hover-border-color);
  box-shadow: none;
  outline: none;
}

/* 手机号输入行：国家码选择 + 手机号输在*/
.phone-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.phone-input-with-code-btn :deep(.el-input__suffix) {
  display: inline-flex;
  align-items: center;
  gap: 0;
  /* 移除间距，让容器正好匹配文字大小 */
  padding: 0;
  /* 移除所有内边距，让容器正好匹配文字大小 */
  padding-right: 0;
  /* 移除右侧内边距，让按钮贴近容器右在*/
  margin: 0;
  /* 移除所有外边距 */
  margin-right: 0;
  margin-left: auto;
  /* 自动靠右对齐 */
  width: auto;
  /* 自动宽度，正好匹配内在*/
  height: auto;
  /* 自动高度，正好匹配内在*/
  min-width: 0;
  /* 允许收缩到内容大在*/
  min-height: 0;
  /* 允许收缩到内容大在*/
  line-height: 1;
  /* 行高在，正好匹配文在*/
}

.phone-input-row {
  background-color: transparent;
  border-radius: var(--global-border-radius);
  padding: 0 8px;
  min-height: clamp(40px, 4.5vw, 44px);
  position: relative;
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  column-gap: 8px;
}

/* 统一为与验证码背景条一致的容器样式 */
/* 使用单类 / :deep 确保样式生效，禁止高特异在*/
.login-content.login-page .phone-background-bar {
  position: relative;
  width: 100%;
  /* 直接使用颜色值确保生在*/
  border: 2px solid var(--border-unified-color);
  border-radius: var(--global-border-radius);
  background-color: var(--el-fill-color-light);
  background: var(--el-fill-color-light);
  transition: border-color 0.2s ease, border-width 0.2s ease, background-color 0.2s ease;
  box-shadow: none;
  /* 布局样式 */
  padding: 0 clamp(8px, 1vw, 10px);
  padding-right: clamp(4px, 0.5vw, 8px);
  /* 为按钮留出右侧间在*/
  height: clamp(48px, 4.5vw, 52px);
  /* 统一高度 */
  min-height: clamp(48px, 4.5vw, 52px);
  max-height: clamp(48px, 4.5vw, 52px);
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  column-gap: clamp(4px, 0.5vw, 8px);
  position: relative;
  box-sizing: border-box;
  margin-bottom: clamp(3px, 0.4vw, 6px);
  padding-top: 0;
  padding-bottom: 0;
  line-height: 1;
}

/* 手机号输入框 hover 状在*/
:where(.login-content.login-page) .phone-background-bar:hover {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background-color: var(--el-bg-color);
  box-shadow: none;
}

/* 手机号输入框 focus 状在*/
:where(.login-content.login-page) .phone-background-bar:focus-within {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background-color: var(--el-bg-color);
  box-shadow: none;
}

/* 暗色模式：手机号输入框样在*/
:where(.login-content.login-page.dark-mode) .phone-background-bar {
  border: 2px solid var(--border-unified-color);
  background-color: var(--color-white-5);
  background: var(--color-white-5);
}

:where(.login-content.login-page.dark-mode) .phone-background-bar:hover {
  border-color: var(--el-color-primary-light-3);
  background-color: var(--el-fill-color-dark);
  box-shadow: none;
}

:where(.login-content.login-page.dark-mode) .phone-background-bar:focus-within {
  border-color: var(--el-color-primary-light-3);
  background-color: var(--el-fill-color-darker);
  box-shadow: none;
}

/* 国家代码文本直接作为 grid 第一在*/
.phone-background-bar>.country-code-text {
  display: inline-flex;
  align-items: center;
  width: max-content;
  /* 根据内容自适应宽度 */
  min-width: max-content;
  /* 确保最小宽度为内容宽度 */
  max-width: max-content;
  /* 确保最大宽度为内容宽度 */
  flex-shrink: 0;
  /* 不允许收在*/
  overflow: visible;
  /* 允许内容完整显示 */
  background-color: transparent;
  /* 不设置背景色 */
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  pointer-events: auto;
  position: relative;
  z-index: var(--z-base);
  margin: 0;
  padding: 0;
}

/* 国家代码选择器直接作在grid 第一列的一部分 */
.phone-background-bar>.country-code-select-inline {
  display: inline-flex;
  align-items: center;
  width: max-content;
  /* 根据内容自适应宽度 */
  min-width: max-content;
  /* 确保最小宽度为内容宽度 */
  max-width: max-content;
  /* 确保最大宽度为内容宽度 */
  flex-shrink: 0;
  /* 不允许收在*/
  overflow: visible;
  /* 允许内容完整显示 */
  background-color: transparent;
  /* 不设置背景色 */
  position: relative;
  z-index: calc(var(--z-base) + 1);
  margin: 0;
  padding: 0;
  height: 100%;
}

/* 手机号输入框包装器直接作在grid 第二在*/
.phone-background-bar>.phone-input-wrapper {
  display: flex;
  align-items: center;
  /* 确保垂直居中 */
  width: 100%;
  /* 在grid 中自动填充剩余空在*/
  max-width: 100%;
  min-width: 0;
  /* 允许收缩，避免溢在*/
  overflow: visible;
  /* 允许内容完整显示 */
  box-sizing: border-box;
  margin-left: 0;
  /* 确保没有负边在*/
  margin-right: 0;
  /* 确保没有右边在*/
  background-color: transparent;
  /* 不设置背景色 */
  height: 100%;
  /* 占满父容器高在*/
}

/* 国家代码选择器内部的 el-select wrapper - 移除所有背景色，确保宽度正确，在phone-background-bar 高度保持一在*/
:where(.phone-background-bar>.selected-country-code-display) :deep(.el-select__wrapper) {
  background-color: transparent;
  border: none;
  box-shadow: none;
  height: clamp(44px, 4.2vw, 48px);
  /* 在phone-background-bar 高度保持一在*/
  min-height: clamp(44px, 4.2vw, 48px);
  max-height: clamp(44px, 4.2vw, 48px);
  width: 100%;
  /* 占满父容器宽在*/
  min-width: 100%;
  /* 最小宽度为父容器宽在*/
  max-width: 100%;
  /* 最大宽度为父容器宽在*/
  display: flex;
  align-items: center;
  /* 确保垂直居中 */
  box-sizing: border-box;
}

/* 移除 hover 背景在*/
:where(.phone-background-bar>.selected-country-code-display) :deep(.el-select__wrapper:hover),
:where(.phone-background-bar>.selected-country-code-display) :deep(.el-select__wrapper.is-hovering) {
  background-color: transparent;
}

/* 移除 focus 背景在*/
:where(.phone-background-bar>.selected-country-code-display) :deep(.el-select__wrapper.is-focus),
:where(.phone-background-bar>.selected-country-code-display) :deep(.el-select__wrapper:focus),
:where(.phone-background-bar>.selected-country-code-display) :deep(.el-select__wrapper:active) {
  background-color: transparent;
}

/* 手机号输入框 wrapper - 完全移除背景色、描边、圆角（在phone-background-bar 控制在*/
/* 使用 :where() 或单类覆盖全局样式，禁止高特异在*/
:where(.login-content.login-page) .phone-background-bar>.phone-input-wrapper :deep(.el-input__wrapper),
:where(.login-content.login-page) .phone-background-bar .phone-input-wrapper :deep(.el-input__wrapper),
:where(.login-content.login-page) .phone-background-bar :deep(.el-input__wrapper),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__wrapper),
.phone-background-bar :deep(.el-input__wrapper) {
  background-color: transparent;
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  box-shadow: none;
  outline: none;
  height: clamp(44px, 4.2vw, 48px);
  /* 在phone-background-bar 高度保持一在*/
  min-height: clamp(44px, 4.2vw, 48px);
  max-height: clamp(44px, 4.2vw, 48px);
  width: 100%;
  min-width: 0;
  /* 允许 flex 子元素收在*/
  display: flex;
  align-items: center;
  /* 确保垂直居中 */
  padding: 0;
  /* 移除所有内边距 */
  overflow: visible;
  /* 允许文字完整显示 */
}

/* 移除所有状态的背景色、描边、圆角（hover, focus, active, disabled等） */
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:hover),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-hover),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-focus),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:focus),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:active),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-active),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-disabled),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:disabled),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-focus-within),
:where(.login-content.login-page) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:focus-within),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:hover),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-hover),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-focus),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:focus),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:active),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-active),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-disabled),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:disabled),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-focus-within),
:where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:focus-within) {
  background-color: transparent;
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  box-shadow: none;
  outline: none;
}

/* 移除 el-input__wrapper 内所有子元素的背景色 */
.phone-background-bar>.phone-input-wrapper :deep(.el-input__wrapper *),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__inner),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__prefix),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__suffix),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__prefix-inner),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__suffix-inner),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__validateIcon),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__clear),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__count),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__count-inner) {
  background-color: transparent;
  background: transparent;
}

/* 隐藏手机号输入框的清除按钮，不允许手动关在*/
.phone-input-with-code-btn :deep(.el-input__clear),
.phone-input-with-code-btn :deep(.el-input__suffix .el-input__clear) {
  display: none;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

/* 移除所有子元素在hover/focus/active 状态背景色和蓝色泛在*/
.phone-background-bar>.phone-input-wrapper :deep(.el-input__wrapper *:hover),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__wrapper *:focus),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__wrapper *:active),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__inner:hover),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__inner:focus),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__inner:active),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__prefix:hover),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__prefix:focus),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__suffix:hover),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__suffix:focus),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__suffix:focus-visible),
.phone-background-bar>.phone-input-wrapper :deep(.el-input__suffix:focus-within),
:where(.phone-background-bar)>.phone-input-wrapper :deep(.el-input__suffix *:focus:not(.code-button-inline)),
:where(.phone-background-bar)>.phone-input-wrapper :deep(.el-input__suffix *:focus-visible:not(.code-button-inline)) {
  background-color: transparent;
  background: transparent;
  outline: none;
  box-shadow: none;
  border: none;
}

/* 确保按钮在phone-background-bar 内也使用正确的样在*/
.phone-background-bar>.phone-input-wrapper :deep(.code-button-inline) {
  padding: clamp(6px, 0.6vw, 8px) clamp(12px, 1.2vw, 16px);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  /* 亮色模式：低对比色描在*/
  background: var(--el-bg-color);
  /* 亮色模式：纯白色背景 */
  color: var(--color-black-87);
  /* 亮色模式：深色文在*/
  font-weight: 500;
  font-size: clamp(13px, 1.2vw, 14px);
  min-height: clamp(32px, 3vw, 36px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.phone-background-bar>.phone-input-wrapper :deep(.code-button-inline:hover:not(:disabled)) {
  background: var(--el-bg-color);
  /* 保持纯白色背在*/
  border-color: var(--color-black-18);
}

.phone-background-bar>.phone-input-wrapper :deep(.code-button-inline:active:not(:disabled)) {
  background: var(--color-black-8);
  border-color: var(--color-black-24);
  transform: translateY(0);
}

.phone-background-bar>.phone-input-wrapper :deep(.code-button-inline:focus),
.phone-background-bar>.phone-input-wrapper :deep(.code-button-inline:focus-visible) {
  outline: 2px solid var(--color-black-20);
  outline-offset: 2px;
  border-color: var(--color-black-24);
  box-shadow: none;
}

.phone-background-bar>.phone-input-wrapper :deep(.code-button-inline:disabled) {
  background: var(--color-black-5);
  color: var(--color-black-38);
  border-color: var(--color-black-8);
  cursor: not-allowed;
  opacity: 0.6;
}

/* 暗色模式下按钮样在- 纯黑色背景，低对比色描边 */
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.code-button-inline) {
  background: var(--el-color-primary);
  /* 纯黑色背在*/
  color: var(--color-white-87);
  /* 浅色文字 */
  border: var(--unified-border);
  /* 低对比色描边 */
}

:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.code-button-inline:hover:not(:disabled)) {
  background: var(--el-color-primary);
  /* 保持纯黑色背在*/
  border-color: var(--color-white-18);
}

:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.code-button-inline:active:not(:disabled)) {
  background: var(--color-white-12);
  border-color: var(--color-white-24);
}

:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.code-button-inline:focus),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.code-button-inline:focus-visible) {
  outline: 2px solid var(--color-white-20);
  outline-offset: 2px;
  border-color: var(--color-white-24);
  box-shadow: none;
}

/* 暗色模式下也确保所有背景色透明 */
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:hover),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-hover),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-focus),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:focus),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:active),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-active),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-disabled),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:disabled),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper.is-focus-within),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper:focus-within),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__wrapper *),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__inner),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__prefix),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__suffix),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__prefix-inner),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__suffix-inner),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__validateIcon),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__clear),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__count),
:where(.login-content.login-page.dark-mode) :where(.phone-background-bar>.phone-input-wrapper) :deep(.el-input__count-inner) {
  background-color: transparent;
  background: transparent;
}

/* 国家代码选择器内部的 el-select 相关元素 */
.phone-background-bar>:where(.country-code-select-inline) :deep(.el-select),
.phone-background-bar>:where(.country-code-select-inline) :deep(.el-select__selection),
.phone-background-bar>:where(.country-code-select-inline) :deep(.el-select__suffix),
.phone-background-bar>:where(.country-code-select-inline) :deep(.el-select__caret) {
  position: relative;
  z-index: calc(var(--z-base) + 1);
  color: var(--el-text-color-primary);
}

.phone-background-bar>:where(.country-code-select-inline) :deep(.el-select__placeholder),
.phone-background-bar>:where(.country-code-select-inline) :deep(.el-select__input) {
  opacity: 1;
  color: var(--el-text-color-primary);
}

.country-code-select-inline {
  width: auto;
  min-width: max-content;
}

/* .country-code-popper 在.el-select-dropdown 样式已移至全局样式在*/

.phone-input-row :deep(.el-select__wrapper),
.phone-input-row :deep(.el-input__wrapper) {
  background-color: transparent;
  border: none;
  box-shadow: none;
  max-width: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
  z-index: var(--z-base);
  height: clamp(44px, 4.2vw, 48px);
  /* 在phone-background-bar 高度保持一在*/
  min-height: clamp(44px, 4.2vw, 48px);
  max-height: clamp(44px, 4.2vw, 48px);
}

.phone-input-with-code-btn :deep(.el-input__wrapper) {
  background-color: transparent;
  border: none;
  box-shadow: none;
  align-items: center;
  /* 确保垂直居中 */
  height: clamp(44px, 4.2vw, 48px);
  /* 在phone-background-bar 高度保持一在*/
  min-height: clamp(44px, 4.2vw, 48px);
  max-height: clamp(44px, 4.2vw, 48px);
  min-width: 0;
  /* 允许 flex 子元素收在*/
  overflow: visible;
  /* 允许文字完整显示 */
}

.phone-input-with-code-btn :deep(.el-input__inner) {
  background-color: transparent;
  width: 100%;
  min-width: 0;
  /* 允许收缩 */
  overflow: visible;
  /* 允许文字完整显示 */
  text-overflow: clip;
  /* 不使用省略号 */
  white-space: nowrap;
  /* 保持单行显示 */
}

.phone-input-row :deep(.el-select__selection),
.phone-input-row :deep(.el-select__selected-item),
.phone-input-row :deep(.el-select__input-wrapper),
.phone-input-row :deep(.el-select__suffix) {
  background-color: transparent;
  box-shadow: none;
  border: none;
}

.phone-input-row :deep(.el-select),
.phone-input-row :deep(.el-select__selection),
.phone-input-row :deep(.el-select__suffix) {
  position: relative;
  z-index: calc(var(--z-base) + 1);
}

.phone-input-row :deep(.el-select__placeholder),
.phone-input-row :deep(.el-select__input) {
  opacity: 1;
  color: var(--el-text-color-primary);
}

.phone-input-row :deep(.el-select__selection),
.phone-input-row :deep(.el-select__placeholder) {
  color: var(--el-text-color-primary);
}

.phone-input-row :deep(.el-select__suffix),
.phone-input-row :deep(.el-input__suffix) {
  display: inline-flex;
  align-items: center;
}

.country-code-select-inline {
  width: auto;
  min-width: max-content;
}

/* phone-background-bar 内输入框在focus/hover 状在*/
.phone-background-bar :deep(.el-input__wrapper.is-focus) {
  box-shadow: none;
  outline: none;
  background-color: transparent;
  border-color: var(--unified-input-focus-border-color);
}

.phone-background-bar :deep(.el-input__wrapper.is-hover) {
  border-color: var(--unified-input-hover-border-color);
  box-shadow: none;
  background-color: transparent;
}

:where(.login-form) :deep(.el-input__inner),
:where(.login-form) :deep(input.el-input__inner) {
  border: none;
  background: transparent;
  box-shadow: none;
  outline: none;
}

/* 确保表单项错误状态不改变间距：不添加额外 margin，由父级 gap 统一控制 */
:where(.login-form) :deep(.el-form-item.is-error) {
  margin-bottom: 0;
}

/* 隐藏所有错误提示并消除空间占用 */
:where(.login-form) :deep(.el-form-item__error) {
  display: none;
  visibility: hidden;
  height: 0;
  min-height: 0;
  max-height: 0;
  margin: 0;
  padding: 0;
  line-height: 0;
  font-size: 0;
  overflow: hidden;
  position: absolute;
  opacity: 0;
  width: 0;
}

/* 消除错误提示容器占用的空在*/
:where(.login-form) :deep(.el-form-item__content) {
  margin-bottom: 0;
  width: 100%;
  /* 确保 content 容器宽度在100% */
}

/* ========== 验证码布局：最简化重在========== */
/* 验证码表单项 label 隐藏 - 确保不占用任何空在*/
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__label),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__label),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__label),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__label),
:where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__label) {
  display: none;
  width: 0;
  min-width: 0;
  max-width: 0;
  margin: 0;
  padding: 0;
  visibility: hidden;
  position: absolute;
  overflow: hidden;
}

/* 验证在el-form-item：确保没有额外的 margin 在padding */
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha']),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha']),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha']),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha']),
:where(.login-form) :deep(.el-form-item[prop='captcha']),
/* 确保与其他输入框在el-form-item 样式完全一在*/
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username']),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password']),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username']),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password']),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username']),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password']),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username']),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='password']),
:where(.login-form) :deep(.el-form-item[prop='username']),
:where(.login-form) :deep(.el-form-item[prop='password']) {
  margin: 0;
  margin-left: 0;
  /* 明确设置左侧 margin 在0 */
  margin-right: 0;
  /* 明确设置右侧 margin 在0 */
  margin-bottom: 0;
  margin-top: 0;
  padding: 0;
  padding-left: 0;
  /* 明确设置左侧 padding 在0 */
  padding-right: 0;
  /* 明确设置右侧 padding 在0 */
}

/* 验证在content 容器：与其他输入框保持完全一致的样式，确保对在- 使用最高特异性选择器覆在Element Plus 默认样式 */
:where(.form-area .form-container.account-form-container) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.account-form-container .login-form.el-form--label-right) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-form.el-form--label-right) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
/* 确保与其他输入框 content 一在- 使用 :deep 与单类，禁止高特异在*/
:where(.form-area .form-container.account-form-container) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.form-area .form-container.account-form-container) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.account-form-container .login-form.el-form--label-right) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.account-form-container .login-form.el-form--label-right) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form.el-form--label-right) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-form.el-form--label-right) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-form.el-form--label-right) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content) {
  margin: 0;
  margin-left: 0;
  margin-right: 0;
  padding: 0;
  display: flex;
  align-items: stretch;
  background-color: transparent;
  /* 透明，让 el-input__wrapper 显示背景 */
  border-radius: var(--global-border-radius);
  box-sizing: border-box;
  width: 100%;
  height: auto;
  max-width: none;
  min-width: auto;
  min-height: auto;
  box-shadow: none;
  border: none;
  position: static;
  overflow: visible;
}

/* 验证在content 容器内的直接子元在div：确保没有额外的 margin 在padding */
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content > div),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content > div),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content > div),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content > div),
:where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content > div),
/* 确保与其他输入框在content 容器内的直接子元素样式完全一在*/
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content > div),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content > div),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content > div),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content > div) {
  margin: 0;
  margin-left: 0;
  margin-right: 0;
  margin-top: 0;
  margin-bottom: 0;
  padding: 0;
  padding-left: 0;
  padding-right: 0;
  padding-top: 0;
  padding-bottom: 0;
  width: 100%;
  box-sizing: border-box;
  position: relative;
}

/* 暗色模式下验证码 content 容器：与其他输入框保持完全一致的样式 */
:where(:where(.login-content.login-page.dark-mode) .form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(html.dark) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(html.dark) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(body.dark) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content),
:where(body.dark) :where(.login-form) :deep(.el-form-item[prop='captcha'] .el-form-item__content) {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: stretch;
  background-color: transparent;
  /* 透明，让 el-input__wrapper 显示背景 */
  border-radius: var(--global-border-radius);
  box-shadow: none;
  border: none;
  width: 100%;
  height: auto;
  max-width: none;
  min-width: auto;
  min-height: auto;
  position: static;
  overflow: visible;
}

/* 其他输入在content 容器：保持原样式 - 使用高优先级选择器确保一致在*/
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='username'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='email'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='phone'] .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='code'] .el-form-item__content) {
  margin: 0;
  margin-left: 0;
  margin-right: 0;
  padding: 0;
  display: flex;
  align-items: stretch;
  background-color: transparent;
  /* 透明，让 el-input__wrapper 显示背景 */
  border-radius: var(--global-border-radius);
  box-sizing: border-box;
}

/* ========== 统一所有输入框在el-input 元素样式：用户名、密码、验证码完全一在========== */
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input)),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input)),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input)),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input)),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input)),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input)),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input)),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input)),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input),
:where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input)),
:where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input),
:where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input)),
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input),
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input) {
  width: 100%;
  margin: 0;
  margin-left: 0;
  margin-right: 0;
  padding: 0;
  padding-left: 0;
  padding-right: 0;
  box-sizing: border-box;
  display: block;
}

/* ========== 统一所有输入框在wrapper 样式：用户名、密码、验证码完全一在========== */
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__wrapper),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__wrapper),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__wrapper),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__wrapper),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper),
:where(.login-form) :deep(.el-form-item[prop='username'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__wrapper),
:where(.login-form) :deep(.el-form-item[prop='password'] :where(:where(.el-form-item__content) .el-input__wrapper)),
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper) {
  margin: 0;
  margin-left: 0;
  margin-right: 0;
  padding: 0;
  padding-left: 0;
  padding-right: 0;
  height: 46px;
  min-height: 46px;
  max-height: 46px;
  line-height: 46px;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--el-input-border-radius);
  /* 使用全局变量 */
}

/* ========== 统一所有输入框在inner 样式：用户名、密码、验证码完全一在========== */
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input__inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input.el-input--prefix .el-input__inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input__inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input--prefix .el-input__inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input.el-input--prefix .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input--prefix .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='username'] .username-input-wrapper .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input.el-input--prefix .el-input__inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__inner),
// 登录表单输入框样在- 使用 :deep 与单类，使用 CSS 变量与低特异性
:where(.login-form) :deep(.el-form-item[prop='username'] .el-input.el-input--prefix .el-input__inner),
:where(.login-form) :deep(.el-form-item[prop='username'] .el-input__inner),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input.el-input--prefix .el-input__inner),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner) {
  height: 46px;
  line-height: 46px;
  margin: 0;
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
}

/* 验证码输入框 inner - 使用 :deep 与单在*/
:where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input.el-input--prefix) .el-input__inner),
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__inner),
:where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input.el-input--prefix.el-input--suffix) .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input.el-input--prefix) .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input.el-input--prefix.el-input--suffix) .el-input__inner) {
  height: 46px;
  line-height: 46px;
  margin: 0;
  margin-left: 0;
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  text-indent: 0;
}

/* 验证码输入框在wrapper - 使用 :deep 与单在*/
:where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input.el-input--prefix.el-input--suffix) .el-input__wrapper),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input.el-input--prefix.el-input--suffix) .el-input__wrapper) {
  display: flex;
  align-items: center;
  padding-left: 0;
  padding-right: 0;
  gap: 0;
}

/* 验证码图片外层容器：在输入框 suffix 中显示，固定尺寸 */
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__suffix),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__suffix) {
  padding: 0;
  margin: 0;
  padding-right: 0;
  margin-right: 0;
  height: 46px;
  max-height: 46px;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* 验证在suffix-inner：匹配图片大小，6px 圆角 */
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__suffix-inner),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__suffix-inner),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__suffix-inner),
:where(.login-content.login-page) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__suffix-inner),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__suffix-inner) {
  display: block;
  /* 表现为块级元素，类似 div */
  padding: 0;
  margin: 0;
  width: auto;
  height: 40px;
  max-height: 40px;
  min-height: 40px;
  overflow: hidden;
  /* 配合圆角裁剪图片 */
  border-radius: var(--global-border-radius);
  /* 6px 圆角 */
  flex-shrink: 0;
  box-sizing: border-box;
  line-height: 0;
}

/* 验证码图片外层包装容器：匹配图片大小在px 圆角 */
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper),
:where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input) .el-input__suffix .captcha-image-wrapper),
:where(.login-form) :deep(:where(.el-form-item[prop='captcha']) .captcha-input .el-input__suffix-inner .captcha-image-wrapper) {
  display: block;
  width: auto;
  height: 40px;
  padding: 0;
  margin: 0;
  cursor: pointer;
  user-select: none;
  border-radius: var(--global-border-radius);
  /* 6px 圆角 */
  overflow: hidden;
  box-sizing: border-box;
  line-height: 0;
}

/* 验证码图片容器：匹配图片大小 */
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper .captcha-image) {
  display: block;
  width: auto;
  height: 100%;
  padding: 0;
  margin: 0;
  border-radius: var(--global-border-radius);
  /* 6px 圆角 */
  overflow: hidden;
  box-sizing: border-box;
  line-height: 0;
}

/* 验证码图片：匹配容器大小在px 圆角 */
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper .captcha-image img),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper .captcha-image img),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper .captcha-image img) {
  display: block;
  width: auto;
  height: 40px;
  max-width: 140px;
  max-height: 40px;
  padding: 0;
  margin: 0;
  user-select: none;
  pointer-events: none;
  object-fit: contain;
  border: none;
  border-radius: var(--global-border-radius);
  /* 6px 圆角 */
  box-sizing: border-box;
}

/* 验证码加载图在*/
:where(.login-form) :deep(:where(.el-form-item[prop='captcha']) .captcha-image-wrapper .captcha-image .captcha-loading) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-placeholder);
}

/* 强制确保输入在wrapper 透明，让父容器背景显在- 使用更强的选择在*/
/* 确保输入在wrapper 基础状态透明，但 focus 状态会显示边框和阴在*/
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='email'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='phone'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='code'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.form-area .form-container.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='email'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='phone'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='code'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='username'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='password'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='email'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='phone'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='code'] :where(.el-form-item__content) .el-input__wrapper):not(.is-focus):not(:focus-within),
/* 验证码输入框 wrapper：非焦点状态透明 */
:where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-input .el-input__wrapper:not(.is-focus):not(:focus-within)) {
  background-color: transparent;
  background: transparent;
  box-shadow: none;
}

/* 确保输入在wrapper 失去焦点后恢复到初始状在- 高优先级规则 */
:where(.login-form) :deep(.el-form-item[prop='username'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='email'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='phone'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='code'] .el-input__wrapper):not(.is-focus):not(:focus-within) {
  border: var(--unified-border);
  border-radius: var(--el-input-border-radius);
  background-color: var(--unified-input-bg-color);
  background: var(--unified-input-bg-color);
  box-shadow: none;
  transition: var(--unified-input-transition);
}

/* 暗色模式下失去焦点后恢复到初始状在*/
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='username'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='email'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='phone'] .el-input__wrapper):not(.is-focus):not(:focus-within),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='code'] .el-input__wrapper):not(.is-focus):not(:focus-within) {
  border: var(--unified-border);
  border-radius: var(--el-input-border-radius);
  background-color: var(--unified-input-bg-color);
  background: var(--unified-input-bg-color);
  box-shadow: none;
  transition: var(--unified-input-transition);
}

/* 确保 hover 状态下在wrapper 背景色正在*/
:where(.login-form) :deep(.el-form-item[prop='username'] .el-input__wrapper:hover):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__wrapper:hover):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='email'] .el-input__wrapper:hover):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='phone'] .el-input__wrapper:hover):not(.is-focus):not(:focus-within),
:where(.login-form) :deep(.el-form-item[prop='code'] .el-input__wrapper:hover):not(.is-focus):not(:focus-within) {
  border: var(--unified-border);
  background-color: var(--unified-input-hover-bg-color);
  background: var(--unified-input-hover-bg-color);
  box-shadow: none;
}

/* 表单项容器背在- 在el-input__wrapper 自己显示背景 */
:where(.login-form) :deep(.el-form-item__content) {
  background-color: transparent;
  background: transparent;
}

:where(.login-form) :deep(.el-form-item.is-error .el-form-item__content) {
  margin-bottom: 0;
  padding-bottom: 0;
}

/* 验证码表单项错误时，完全消除底部间距，紧贴验证码输入在*/
:where(.login-form) :deep(.el-form-item[prop='verificationCode'].is-error),
:where(.login-form) :deep(.el-form-item:has(:where(.verification-code-background-bar)).is-error) {
  margin-bottom: 0;
  /* 完全消除底部间距 */
  padding-bottom: 0;
  margin-top: 0;
  padding-top: 0;
}

/* 验证码表单项的内容区域，消除所有间在*/
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__content) {
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  padding-left: 0;
  padding-right: 0;
  line-height: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  background-color: transparent;
  /* 透明，让 verification-code-digit 自己显示背景 */
  border-radius: var(--global-border-radius);
  box-sizing: border-box;
}

/* 验证码表单项的错误提示和输入框之间消除间在*/
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__error + .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__error ~ .el-form-item__content),
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__content) {
  margin-top: 0;
  padding-top: 0;
}

/* 验证码背景条紧贴错误提示 */
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__error + .verification-code-background-bar),
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__error ~ .verification-code-background-bar) {
  margin-top: 0;
  padding-top: 0;
}

:where(.login-form) :deep(.el-form-item.is-error .el-form-item__error) {
  display: none;
  /* 隐藏所有错误提在*/
  visibility: hidden;
  height: 0;
  margin: 0;
  padding: 0;
  line-height: 0;
  font-size: 0;
  overflow: hidden;
}

/* 验证码表单项的错误提示，完全隐藏 */
:where(.login-form) :deep(.el-form-item[prop='verificationCode'].is-error .el-form-item__error),
:where(.login-form) :deep(.el-form-item:has(:where(.verification-code-background-bar)).is-error .el-form-item__error) {
  display: none;
  visibility: hidden;
  height: 0;
  margin: 0;
  padding: 0;
  line-height: 0;
  font-size: 0;
  overflow: hidden;
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item.is-error .el-form-item__error) {
  color: var(--el-color-danger);
}

:where(.login-form) :deep(.el-input__inner) {
  color: var(--el-text-color-primary);
  font-size: clamp(14px, 1.4vw, 16px);
  line-height: clamp(40px, 4.5vw, 44px);
  height: auto;
  min-height: clamp(40px, 4.5vw, 44px);
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  box-shadow: none;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

/* 账号表单输入框内边距 - 与图标保持合理间在*/
:where(.account-form-container) :where(.login-form) :deep(.el-input__inner) {
  padding-left: 8px;
  padding-right: 8px;
}

/* phone-background-bar 内的输入框无内边在*/
.phone-background-bar :deep(.el-input__inner) {
  padding: 0;
}

/* 输入框内部间在- 与图标保持合理间在*/

/* 确保placeholder文字对齐 */
:where(.login-form) :deep(.el-input__inner)::placeholder {
  line-height: clamp(40px, 4.5vw, 44px);
}

/* 通用占位符样在- 但账号表单的优先级更在*/
:where(.login-form) :deep(.el-input__inner)::placeholder:where(:not(.account-form-container .login-form .el-input__inner::placeholder)) {
  color: var(--el-text-color-placeholder);
  font-size: clamp(12px, 1.2vw, 14px);
  line-height: clamp(40px, 4.5vw, 44px);
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input__inner)::placeholder:where(:not(.account-form-container .login-form .el-input__inner::placeholder)) {
  color: var(--el-text-color-placeholder);
}

/* 密码输入框的placeholder样式 - 与用户名输入框完全一在*/
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner[type='password'])::placeholder,
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner)::placeholder {
  color: var(--color-black-45);
  /* 亮色模式：低对比度灰色占位符，与用户名输入框一在*/
  font-size: clamp(14px, 1.6vw, 16px);
  /* 与用户名输入框相同的字体大小 */
  font-weight: 400;
}

:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner[type='password'])::placeholder,
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__inner)::placeholder {
  color: var(--color-white-45);
  /* 暗色模式：低对比度白色占位符，与用户名输入框一在*/
  font-size: clamp(14px, 1.6vw, 16px);
  /* 与用户名输入框相同的字体大小 */
  font-weight: 400;
}

/* 输入框图在- 优化渲染质量，提升视觉效果，使其更精致美在*/
/* 账号表单输入框图在- 使用项目设计系统的颜色变量，保持一致的视觉风格 */
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix .input-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix .el-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix-inner .input-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix-inner .el-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input) .el-input__prefix .input-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input) .el-input__prefix .el-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-form-item[prop='captcha'] :where(.captcha-input) .el-input__prefix-inner .input-icon),
:where(.account-form-container) :where(.login-form) :deep(:where(.el-form-item[prop='captcha']) :where(.captcha-input) .el-input__prefix-inner .el-icon) {
  color: var(--el-text-color-placeholder);
  font-size: clamp(20px, 2.2vw, 22px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(20px, 2.2vw, 22px);
  height: clamp(20px, 2.2vw, 22px);
  min-width: clamp(20px, 2.2vw, 22px);
  min-height: clamp(20px, 2.2vw, 22px);
  max-width: clamp(20px, 2.2vw, 22px);
  max-height: clamp(20px, 2.2vw, 22px);
  line-height: 1;
  flex-shrink: 0;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  transition: color 0.2s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  vertical-align: middle;
}

/* 优化图标内部SVG的渲染质量，使其更精在*/
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix .input-icon svg),
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix .el-icon svg),
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix-inner .input-icon svg),
:where(.account-form-container) :where(.login-form) :deep(.el-input__prefix-inner .el-icon svg) {
  width: 100%;
  height: 100%;
  display: block;
  /* 优化SVG渲染，使用平滑渲染模式，使图标更柔和美观 */
  shape-rendering: auto;
  /* 使用auto而不是geometricPrecision，使图标更平在*/
  image-rendering: auto;
  /* 使用auto而不是crisp-edges，使图标更柔在*/
  /* 确保SVG路径使用currentColor，继承父元素颜色 */
  fill: currentColor;
  stroke: none;
  /* 优化SVG的显示效在*/
  overflow: visible;
  /* 确保SVG在容器中居中 */
  margin: auto;
}

/* 账号表单输入在focus 时图标颜在- 使用项目设计系统的主色调 */
:where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix .input-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix .el-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix-inner .input-icon),
:where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix-inner .el-icon) {
  color: var(--el-color-primary);
  /* 聚焦时使用主题色，符合项目设计风在*/
}

/* 暗色模式下账号表单输入框图标 - 使用项目设计系统的颜色变在*/
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input__prefix .input-icon),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input__prefix .el-icon),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input__prefix-inner .input-icon),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input__prefix-inner .el-icon) {
  color: var(--el-text-color-placeholder);
  /* 使用项目设计系统的占位符颜色变量 */
}

:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix .input-icon),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix .el-icon),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix-inner .input-icon),
:where(.login-content.login-page.dark-mode) :where(.account-form-container) :where(.login-form) :deep(.el-input:where(.is-focus) .el-input__prefix-inner .el-icon) {
  color: var(--el-color-primary);
  /* 聚焦时使用主题色，符合项目设计风在*/
}

/* 其他输入框图标保持原样式 */
.input-icon:not(.account-form-container .input-icon) {
  color: var(--el-text-color-secondary);
  font-size: clamp(18px, 2.2vw, 20px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(18px, 2.2vw, 20px);
  height: clamp(18px, 2.2vw, 20px);
  min-width: clamp(18px, 2.2vw, 20px);
  min-height: clamp(18px, 2.2vw, 20px);
  max-width: clamp(18px, 2.2vw, 20px);
  max-height: clamp(18px, 2.2vw, 20px);
  line-height: 1;
  flex-shrink: 0;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

:where(.login-content.login-page.dark-mode) .input-icon:not(.account-form-container .input-icon) {
  color: var(--el-text-color-placeholder);
}

/* 密码显示/隐藏眼睛图标 - 使用用户提供的样式，调整大小与输入框前缀图标一在*/
.password-eye-container {
  /*------ Settings ------*/
  --color: var(--el-text-color-placeholder);
  --size: clamp(20px, 2.2vw, 22px);
  /* 与输入框前缀图标大小一在*/
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  font-size: var(--size);
  user-select: none;
  fill: var(--color);
  width: var(--size);
  height: var(--size);
  min-width: var(--size);
  min-height: var(--size);
  max-width: var(--size);
  max-height: var(--size);
  background: transparent;
  /* 移除背景 */
  background-color: transparent;
  /* 移除背景在*/
  border: none;
  /* 移除边框 */
  padding: 0;
  /* 移除内边在*/
  margin: 0;
  /* 移除外边在*/
}

.password-eye-container .eye {
  position: absolute;
  animation: keyframes-fill .5s;
  width: 100%;
  height: 100%;
}

.password-eye-container .eye-slash {
  position: absolute;
  animation: keyframes-fill .5s;
  display: none;
  width: 100%;
  height: 100%;
}

/* ------ On check event ------ */
.password-eye-container input:checked~.eye {
  display: none;
}

.password-eye-container input:checked~.eye-slash {
  display: block;
}

/* ------ Hide the default checkbox ------ */
.password-eye-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

/* ------ Animation ------ */
@keyframes keyframes-fill {
  0% {
    transform: scale(0);
    opacity: 0;
  }

  50% {
    transform: scale(1.2);
  }
}

/* 暗色模式适配 */
:where(.login-content.login-page.dark-mode) .password-eye-container {
  --color: var(--el-text-color-placeholder);
  background: transparent;
  background-color: transparent;
}

/* 暗色模式下确保密码眼睛图标容器的所有状态都没有背景在*/
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container:hover),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container:hover),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container:focus),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container:focus),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container:active),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container:active) {
  background: transparent;
  background-color: transparent;
}

/* 暗色模式下确在suffix 相关容器的所有状态都没有背景在*/
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix:hover),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix:hover),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix:focus),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix:focus),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner:hover),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner:hover),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner:focus),
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner:focus) {
  background: transparent;
  background-color: transparent;
  box-shadow: none;
}

/* 确保密码输入框的 suffix 区域正确显示 */
/* 在el-input__suffix 改为使用 div 的块级特在*/
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix) {
  display: flex;
  align-items: center;
  /* 垂直居中 */
  justify-content: flex-end;
  /* 内容靠右，但通过 padding 保持间距 */
  padding-right: clamp(12px, 1.5vw, 18px);
  /* 增加右边距，不要贴右在*/
  gap: clamp(4px, 0.5vw, 8px);
  /* 移除不必要的嵌套在*/
  margin: 0;
  height: 100%;
  /* 确保高度填满，便于垂直居在*/
  background: transparent;
  /* 移除背景 */
  background-color: transparent;
  /* 移除背景在*/
}

:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner) {
  display: flex;
  align-items: center;
  /* 垂直居中 */
  justify-content: flex-end;
  /* 内容靠右对齐 */
  margin: 0;
  background: transparent;
  /* 移除背景 */
  background-color: transparent;
  /* 移除背景在*/
  padding: 0;
  gap: clamp(4px, 0.5vw, 8px);
  /* 简化结构，减少嵌套 */
  width: auto;
  height: 100%;
  /* 确保高度填满，便于垂直居在*/
}

/* 清除按钮样式 - 用纯 CSS 叉号替换圆形图标（全局应用在*/
:where(.login-form) :deep(.el-input__clear),
.login-content :deep(.el-input__clear) {
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  box-shadow: none;
  width: 20px;
  height: 20px;
  color: var(--el-text-color-placeholder);
  transition: color 0.2s ease;
  position: relative;
}

:where(.login-form) :deep(.el-input__clear:hover),
.login-content :deep(.el-input__clear:hover) {
  color: var(--el-text-color-primary);
  background: transparent;
}

/* 隐藏原始 SVG 图标 */
:where(.login-form) :deep(.el-input__clear svg),
.login-content :deep(.el-input__clear svg) {
  display: none;
}

/* 用伪元素创建纯叉在*/
:where(.login-form) :deep(.el-input__clear)::before,
:where(.login-form) :deep(.el-input__clear)::after,
.login-content :deep(.el-input__clear)::before,
.login-content :deep(.el-input__clear)::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 2px;
  background-color: currentColor;
  border-radius: var(--global-border-radius);
}

:where(.login-form) :deep(.el-input__clear)::before,
.login-content :deep(.el-input__clear)::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

:where(.login-form) :deep(.el-input__clear)::after,
.login-content :deep(.el-input__clear)::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

/* 清除按钮显示在眼睛图标左侧：使用 order 属性，增加间距 */
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner .el-input__clear),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner .el-input__clear),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner > :where(.el-icon.el-input__clear)),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner > :where(.el-icon.el-input__clear)) {
  order: -1;
  /* 清除按钮排在最前面（左侧）*/
  margin-right: 12px;
  /* 增加与眼睛图标的间距 */
  margin-left: 0;
}

/* 眼睛图标排在清除按钮后面（右侧）*/
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner .password-eye-container),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner .password-eye-container) {
  order: 1;
  /* 眼睛图标排在后面（右侧）*/
}

:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner > *),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner > *) {
  flex-shrink: 0;
  background: transparent;
  background-color: transparent;
}

/* 确保密码眼睛图标容器的所有状态都没有背景在*/
:where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container),
:where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container:hover),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container:hover),
:where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container:focus),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container:focus),
:where(.login-form) :deep(.el-form-item[prop='password'] .password-eye-container:active),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .password-eye-container:active) {
  background: transparent;
  background-color: transparent;
  border: none;
  box-shadow: none;
  outline: none;
}

/* 确保 suffix 相关容器的所有状态都没有背景在*/
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix:hover),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix:hover),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix:focus),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix:focus),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner:hover),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner:hover),
:where(.login-form) :deep(.el-form-item[prop='password'] .el-input__suffix-inner:focus),
:where(.login-form) :deep(.el-form-item[prop='confirmPassword'] .el-input__suffix-inner:focus) {
  background: transparent;
  background-color: transparent;
  box-shadow: none;
}

/* 简化密码切换图标容器，使用 div 的块级特在*/
:where(.login-form) :deep(.password-toggle-icon) {
  display: flex;
  align-items: center;
  /* 垂直居中 */
  justify-content: center;
  /* 水平居中 */
  cursor: pointer;
  user-select: none;
  margin: 0;
  padding: 0;
  width: auto;
  height: 100%;
  /* 确保高度填满，便于垂直居在*/
  min-height: clamp(40px, 4.5vw, 44px);
  /* 与输入框高度一在*/
}

/* 手机号验证码输入框的图标放大并左对齐 - 与上面的+86容器对齐 */
/* 注意：仅匹配 prop='verificationCode' 在prop='code'，不匹配 prop='captcha'（登录验证码在*/
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-input__prefix),
:where(.login-form) :deep(.el-form-item[prop='code'] .el-input__prefix),
:where(.login-form) :deep(.el-form-item:has([placeholder*='6位验证码']) .el-input__prefix) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  /* 左对齐，在86位置对齐 */
  width: clamp(70px, 8vw, 90px);
  /* 与手机号输入框prefix宽度一在*/
  min-width: clamp(70px, 8vw, 90px);
  max-width: clamp(70px, 8vw, 90px);
  padding: 0;
  padding-right: 4px;
  margin: 0;
  margin-right: 0;
  flex-shrink: 0;
}

/* 验证码输入框在inner 也要消除左边距（仅针对手机号验证在verificationCode，不包括 captcha在*/
:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-input__inner),
:where(.login-form) :deep(.el-form-item:has([placeholder*='6位验证码']) .el-input__inner) {
  padding-left: 0;
  padding-inline-start: 0;
  margin-left: 0;
  text-align: left;
  /* 确保文字左对在*/
}

:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .input-icon),
:where(.login-form) :deep(.el-form-item:has([placeholder*='6位验证码']) .input-icon) {
  font-size: clamp(20px, 2.4vw, 22px);
  width: clamp(20px, 2.4vw, 22px);
  height: clamp(20px, 2.4vw, 22px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
  margin: 0;
  margin-left: 20px;
  padding: 0;
}

:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-input__prefix-inner),
:where(.login-form) :deep(.el-form-item:has([placeholder*='6位验证码']) .el-input__prefix-inner) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

/* 通用输入在focus 图标样式 - 但账号表单的优先级更在*/
:where(.login-form) :deep(.el-input.is-focus .input-icon):where(:not(.account-form-container .login-form .el-input.is-focus .input-icon)) {
  color: var(--el-text-color-primary);
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-input.is-focus .input-icon):where(:not(.account-form-container .login-form .el-input.is-focus .input-icon)) {
  color: var(--el-text-color-primary);
}

/* 密码提示文本 - 括号内文字更浅灰色且字号更小 */
.password-hint {
  margin-top: clamp(4px, 0.5vw, 6px);
  display: flex;
  align-items: center;
  min-height: clamp(14px, 1.5vw, 16px);
}

.password-hint.has-strength {
  margin-bottom: clamp(4px, 0.5vw, 6px);
}

.password-hint .hint-text {
  color: var(--el-text-color-placeholder);
  font-size: clamp(12px, 1vw, 14px);
  line-height: 1.2;
  padding-left: clamp(45px, 5.5vw, 60px);
  /* 对齐到prefix图标位置 */
  display: block;
}

:where(.login-content.login-page.dark-mode) .password-hint .hint-text {
  color: var(--el-text-color-placeholder);
}

/* 密码强度指示在- 极简精致设计 V3 */
.password-strength-indicator {
  margin-top: 8px;
  margin-bottom: -16px;
  /* 在margin 抵消 form gap，使上下间距一在*/
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0;
}

/* 进度条轨在- 极简细线 */
.strength-bar {
  flex: 1;
  height: 3px;
  background-color: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  position: relative;
}

/* 暗色模式轨道 */
:where(.login-content.login-page.dark-mode) .strength-bar {
  background-color: var(--color-white-8);
}

/* 进度条填在*/
.strength-fill {
  height: 100%;
  border-radius: var(--global-border-radius);
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease;
  position: relative;

  /* 弱密在- 柔和在*/
  &.weak {
    background-color: var(--el-color-danger-light-3);
  }

  /* 中等密码 - 柔和在*/
  &.medium {
    background-color: var(--el-color-warning-light-3);
  }

  /* 强密在- 柔和在*/
  &.strong {
    background-color: var(--el-color-success-light-3);
  }
}

/* 暗色模式填充颜色 */
:where(.login-content.login-page.dark-mode) .strength-fill {
  &.weak {
    background-color: var(--el-color-danger-light-3);
  }

  &.medium {
    background-color: var(--el-color-warning-light-3);
  }

  &.strong {
    background-color: var(--el-color-success-light-3);
  }
}

/* 强度文字 - 精致简在*/
.strength-text {
  font-size: 12px;
  font-weight: 500;
  min-width: 20px;
  text-align: right;
  line-height: 1;
  transition: color 0.2s ease;
  opacity: 0.9;

  &.weak {
    color: var(--el-color-danger);
  }

  &.medium {
    color: var(--el-color-warning);
  }

  &.strong {
    color: var(--el-color-success);
  }
}

/* 暗色模式下文字颜在*/
:where(.login-content.login-page.dark-mode) .strength-text {
  &.weak {
    color: var(--el-color-danger-light-3);
  }

  &.medium {
    color: var(--el-color-warning-light-3);
  }

  &.strong {
    color: var(--el-color-success-light-3);
  }
}


/* 验证码发送状在*/
.code-status {
  font-size: clamp(12px, 1.1vw, 14px);
  margin-top: clamp(3px, 0.4vw, 4px);

  &.success {
    color: var(--el-text-color-regular);
  }

  &.error {
    color: var(--el-text-color-primary);
  }

  &.info {
    color: var(--el-text-color-regular);
  }

  &.warning {
    color: var(--el-text-color-placeholder);
  }
}

:where(.login-content.login-page.dark-mode) .code-status.success,
:where(.login-content.login-page.dark-mode) .code-status.info {
  color: var(--el-text-color-placeholder);
}

:where(.login-content.login-page.dark-mode) .code-status.error {
  color: var(--el-color-danger);
}

:where(.login-content.login-page.dark-mode) .code-status.warning {
  color: var(--el-color-warning);
}

/* 表单操作行样在- 统一账号和手机表单的样式 */
.form-actions-row {
  margin: 0;
  /* 移除边距，使用父容器在gap */
  padding: 0;
  display: flex;
  flex-wrap: nowrap;
  /* 强制不换在*/
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 0;
  /* 移除 gap，使在el-col 在span 控制间距 */
  min-width: 0;
  /* 允许收缩 */
  overflow: visible;
  box-sizing: border-box;
}

/* 确保账号和手机表单的 form-actions-row 样式完全一在*/
.account-form-container .form-actions-row,
.phone-form-container .form-actions-row {
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 0;
  min-width: 0;
  overflow: visible;
  box-sizing: border-box;
}

/* 让包在自动登录"的列根据内容自适应宽度 - 统一账号和手机表在*/
.form-actions-row .el-col:first-child,
.account-form-container .form-actions-row .el-col:first-child,
.phone-form-container .form-actions-row .el-col:first-child {
  flex: 0 0 auto;
  /* 不收缩，不扩展，根据内容自适应 */
  width: auto;
  max-width: none;
  min-width: 0;
  flex-shrink: 0;
  /* 不允许收在*/
  white-space: nowrap;
  /* 防止内部换行 */
  display: flex;
  align-items: center;
}

/* 让右侧列占据剩余空间 - 统一账号和手机表在*/
.form-actions-row .el-col:last-child,
.account-form-container .form-actions-row .el-col:last-child,
.phone-form-container .form-actions-row .el-col:last-child {
  flex: 1 1 auto;
  min-width: 0;
  flex-shrink: 1;
  /* 允许收缩，但优先保持在一在*/
  overflow: visible;
  display: flex;
  align-items: center;
}

/* 确保 text-right 类的列正确右对齐 - 统一账号和手机表在*/
.form-actions-row .el-col.text-right,
:where(.account-form-container) .form-actions-row .el-col.text-right,
:where(.phone-form-container) .form-actions-row .el-col.text-right {
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  /* 强制不换在*/
  white-space: nowrap;
  /* 强制不换在*/
  overflow: visible;
  min-width: 0;
  /* 允许收缩 */
  gap: clamp(8px, 1vw, 12px);
  /* 统一右侧链接之间的间在*/
}

/* 确保 text-right 类内的链接正确右对齐 */
:where(.form-actions-row) .el-col.text-right .switch-to-sso-link,
:where(.form-actions-row) .el-col.text-right .switch-to-account-link {
  margin-left: 0;
  margin-right: 0;
  text-align: right;
}

/* 快捷登录标题现在在third-party-login-icons 内部 */
.third-party-login-icons .quick-login-title {
  width: 100%;
  /* 占满父容器宽在*/
  max-width: 100%;
  /* 最大宽度不超过父容在*/
  padding: 0;
  /* 移除内边在*/
  margin: 0;
  /* 移除所有外边距，由父容器控制间在*/
  box-sizing: border-box;
  display: flex;
  /* 确保 flex 布局 */
  align-items: center;
  justify-content: center;
}

/* 自适应留白容器：在自动登录与快捷登录之在*/
.qr-flex-spacer {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: clamp(2px, 0.3vw, 4px) 0;
  /* 进一步减少间在*/
}

/* qr-flex-spacer 隐藏规则已删在*/

.qr-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1vw, 12px);
  color: var(--el-text-color-secondary);
  font-size: clamp(12px, 1.3vw, 14px);

  .spinning {
    font-size: clamp(32px, 4vw, 48px);
    color: var(--el-text-color-secondary);
    animation: rotate 1s linear infinite;
  }

  p {
    margin: 0;
  }
}

:where(.login-content.login-page.dark-mode) .qr-loading-state {
  color: var(--el-text-color-placeholder);
}

:where(.login-content.login-page.dark-mode) .qr-loading-state .spinning {
  color: var(--el-text-color-placeholder);
}

.qr-image-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1vw, 12px);
}

.qr-image {
  width: clamp(160px, 20vw, 220px);
  height: clamp(160px, 20vw, 220px);
  border: none;
  border-radius: var(--global-border-radius);
  background-color: var(--el-text-color-primary);
  border: var(--unified-border);
  object-fit: contain;
}

/* 暗色模式：同样使用黑色背在*/
:where(.login-content.login-page.dark-mode) .qr-image {
  background-color: var(--el-text-color-primary);
}

.qr-status-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5vw, 6px);
  background-color: var(--el-overlay-color-lighter);
  padding: clamp(8px, 1vw, 12px);
  border-radius: var(--global-border-radius);
  font-size: clamp(12px, 1.2vw, 14px);
  color: var(--el-text-color-secondary);
  min-width: clamp(120px, 15vw, 160px);
  text-align: center;

  .el-icon {
    font-size: clamp(20px, 2.5vw, 28px);
  }

  &.status-pending,
  &.status-scanning,
  &.status-confirming,
  &.status-scanned,
  &.status-expired,
  &.status-failed,
  &.status-success {
    color: var(--el-text-color-regular);
  }
}

:where(.login-content.login-page.dark-mode) .qr-status-overlay {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

:where(.login-content.login-page.dark-mode) .qr-status-overlay.status-pending,
:where(.login-content.login-page.dark-mode) .qr-status-overlay.status-scanning,
:where(.login-content.login-page.dark-mode) .qr-status-overlay.status-confirming,
:where(.login-content.login-page.dark-mode) .qr-status-overlay.status-scanned,
:where(.login-content.login-page.dark-mode) .qr-status-overlay.status-expired,
:where(.login-content.login-page.dark-mode) .qr-status-overlay.status-failed,
:where(.login-content.login-page.dark-mode) .qr-status-overlay.status-success {
  color: var(--el-text-color-primary);
}

.qr-countdown {
  font-size: clamp(12px, 1.1vw, 14px);
  color: var(--el-text-color-placeholder);
  text-align: center;
  margin-top: clamp(4px, 0.5vw, 6px);
}

:where(.login-content.login-page.dark-mode) .qr-countdown {
  color: var(--el-text-color-placeholder);
}

/* 二维码占位符样式 */
.qr-placeholder {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: clamp(160px, 20vw, 180px);
  /* 减小最大高度以缩小间距 */
}

/* 隐藏逻辑已删除，二维码占位符始终显示 */

/* 二维码占位符内容 - 默认亮色模式：白色背在*/
.qr-placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 保证整体在容器中在*/
  gap: clamp(6px, 0.8vw, 10px);
  /* 减少内部间距 */
  padding: clamp(4px, 0.5vw, 8px) clamp(16px, 2vw, 24px);
  /* 减少上下padding，保持左右padding */
  width: clamp(180px, 22vw, 240px);
  /* 稍微放大容器 */
  max-width: 100%;
  /* 防止溢出 */
  height: clamp(180px, 22vw, 240px);
  /* 稍微放大容器 */
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color-page);
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  }

/* 暗色模式：深色背在*/
:where(.login-content.login-page.dark-mode) .qr-placeholder-content {
  background-color: var(--el-bg-color);
  }

/* 包裹二维码图标和文案，使 SVG 垂直居中到容器中在*/
.qr-placeholder-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateY(0);
  /* 移除偏移，让内容真正居中 */
  gap: clamp(6px, 0.8vw, 10px);
  /* 图标和文字之间的间距 */
}

/* 使用伪元素创建“外描边”虚线边框，贴合最外层轮廓 */
.qr-placeholder-content::before {
  content: '';
  position: absolute;
  /* 与容器同尺寸，虚线画在最外沿 */
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: var(--global-border-radius);
  pointer-events: none;
  box-sizing: border-box;
  border: 2px dashed var(--el-border-color);
}

:where(.login-content.login-page.dark-mode) .qr-placeholder-content::before {
  border-color: var(--el-border-color-light);
}

.qr-placeholder-icon {
  width: clamp(80px, 9vw, 100px);
  /* 稍微放大图标 */
  height: clamp(80px, 9vw, 100px);
  /* 稍微放大图标 */
  fill: var(--el-text-color-secondary);
  z-index: var(--z-base);
  flex-shrink: 0;
  /* 防止图标被压在*/
}

:where(.login-content.login-page.dark-mode) .qr-placeholder-icon {
  fill: var(--el-text-color-primary);
}

.qr-placeholder-text {
  font-size: clamp(12px, 1.2vw, 14px);
  color: var(--el-text-color-regular);
  text-align: center;
  line-height: 1.4;
  /* 减少行高，让文字更紧在*/
  margin: clamp(4px, 0.5vw, 8px) 0 0;
  /* 减少上边在*/
  z-index: var(--z-base);
}

:where(.login-content.login-page.dark-mode) .qr-placeholder-text {
  color: var(--el-text-color-primary);
}

.qr-image {
  width: 100%;
  max-width: 300px;
  height: auto;
  aspect-ratio: 1;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 快捷登录标题样式 - 重新设计 */
.quick-login-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1vw, 12px);
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 100%;
  position: relative;
  z-index: var(--z-0);
}

.title-line {
  flex: 1;
  height: 1px;
  background-color: var(--el-border-color-light);
  max-width: 100px;
  z-index: var(--z-0);
  position: relative;
}

.title-text {
  font-size: clamp(12px, 1.3vw, 14px);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  font-weight: 400;
}

/* 第三方登录图标样在- 重新设计的布局 - 使用 flexbox 确保居中 */
.login-content .third-party-login-icons,
.third-party-login-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: var(--ulogin-gap-sm);
  width: fit-content;
  max-width: 100%;
  padding: 0;
  box-sizing: border-box;
  margin: 0 auto;
  margin-top: 0;
  margin-bottom: 0;
  overflow: visible;
  -webkit-overflow-scrolling: touch;
  position: relative;
  z-index: var(--z-base);
}

/* 图标包装容器 - 确保图标行居在*/
.third-party-icons-wrapper {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  align-content: center;
  gap: clamp(8px, 1vw, 12px);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* 确保图标在包装容器中正确显示 */
.third-party-icons-wrapper .third-party-icon {
  flex-shrink: 0;
  flex-grow: 0;
}

.third-party-icon {
  width: var(--ulogin-icon-size);
  height: var(--ulogin-icon-size);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  position: relative;
  overflow: visible;
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);

  .platform-icon-img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
    transform: translateZ(0);
    filter: none;
    background: transparent;
    transition: filter 0.2s ease;
    opacity: 1;
    visibility: visible;
  }

  /* Apple 图标：明亮模式显示为黑色 */
  .platform-icon-img[src*='apple.svg'],
  .platform-icon-img[src*='Apple.svg'] {
    filter: brightness(0);
  }

  /* 暗色模式：保持图标原始颜在*/
  :where(.login-content.login-page.dark-mode) & .platform-icon-img {
    filter: none;
    opacity: 1;
    visibility: visible;
  }

  /* 暗色模式：Apple 图标恢复原色（白色） */
  :where(.login-content.login-page.dark-mode) & .platform-icon-img[src*='apple.svg'],
  :where(.login-content.login-page.dark-mode) & .platform-icon-img[src*='Apple.svg'] {
    filter: none;
  }

  .platform-name {
    position: absolute;
    top: -32px;
    left: 50%;
    right: auto;
    bottom: auto;
    transform: translateX(-50%) translateY(4px);
    font-size: 12px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    font-weight: 500;
    line-height: 1.4;
    z-index: var(--z-header);
    background-color: var(--el-overlay-color);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 4px 10px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    max-width: 140px;
    width: auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: border-box;
    contain: layout style paint;

    &>* {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      box-sizing: border-box;
    }

    word-break: break-all;
    overflow-wrap: break-word;
  }

  /* 暗色模式：平台名称样在*/
  :where(.login-content.login-page.dark-mode) & .platform-name {
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color-light);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: var(--unified-border);
  }

  /* Tooltip 样式 - 明亮模式 */
  &::after {
    content: attr(data-tooltip);

    /* 定位 */
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    z-index: var(--z-dropdown);

    /* 尺寸 */
    min-width: 60px;
    max-width: 100px;
    width: max-content;
    padding: 6px 8px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;

    /* 视觉样式 - 明亮模式 */
    background: var(--color-black-85);
    color: var(--el-color-white);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    text-align: center;
    letter-spacing: 0.2px;

    /* 圆角和边框（扁平化：在box-shadow在*/
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

    /* 初始状在- 隐藏 */
    opacity: 0;
    visibility: hidden;
    pointer-events: none;

    /* 动画过渡 */
    transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* 暗色模式：Tooltip 样式 */
  :where(.login-content.login-page.dark-mode) &::after {
    background: var(--color-white-95);
    color: var(--el-text-color-primary);
    border: var(--unified-border);
  }

  &:hover {
    opacity: 1;
    transform: translateZ(0) scale(1.15);

    &::after {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(-12px);
    }

    .platform-icon-img {
      opacity: 0.95;
      filter: none;
      background: transparent;
      transition:
        opacity 0.2s ease,
        filter 0.2s ease;
    }

    .platform-icon-img[src*='apple.svg'],
    .platform-icon-img[src*='Apple.svg'] {
      filter: brightness(0);
    }

    :where(.login-content.login-page.dark-mode) & .platform-icon-img {
      filter: none;
    }

    :where(.login-content.login-page.dark-mode) & .platform-icon-img[src*='apple.svg'],
    :where(.login-content.login-page.dark-mode) & .platform-icon-img[src*='Apple.svg'] {
      filter: none;
    }

    .platform-name {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }
  }

  &:active {
    transform: translateZ(0) scale(1.05);
    transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
}

/* 第三方登录图标容器：已在上方统一定义在flexbox 布局，此处删除重复的 grid 定义 */

/* 让底部内容固定贴近登录栏底部（随容器拉伸而保持固定间距） */
.login-content.login-page {
  display: flex;
  flex-direction: column;
  // height: 100%; // 移除，使用top和bottom自动计算高度
  position: fixed; // 已在基础样式中设在
}

.form-area {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 移除重复在form-container 定义，使用上方统一的样在*/

.login-bottom-group {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  top: auto;
  max-height: none;
  max-width: 100%;
  min-height: 0;
  min-width: 0;
  height: auto;
  width: 100%;
  overflow: visible;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--ulogin-gap-xs);
  margin-top: clamp(16px, 2vw, 24px);
  contain: none;

  &>* {
    max-width: 100%;
    overflow: visible;
    box-sizing: border-box;
    flex-shrink: 0;
  }
}

.login-content.login-page {
  display: flex;
  flex-direction: column;
  position: relative;
}

.login-bottom-group {
  margin-top: clamp(16px, 2vw, 24px);
  position: relative;
}

.text-right {
  text-align: right;
}

.text-left {
  text-align: left;
}

/* 切换到账号密码登录链接样在*/
.switch-to-account-link {
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
  display: inline-block;
  margin-left: 0;
  margin-right: 0;
  padding-left: 0;
  padding-right: 0;
}

:where(.login-content.login-page.dark-mode) .switch-to-account-link {
  color: var(--el-text-color-secondary);
}

.switch-to-account-link:hover {
  color: var(--el-text-color-secondary);
}

:where(.login-content.login-page.dark-mode) .switch-to-account-link:hover {
  color: var(--el-color-white);
}

.switch-to-account-link:active {
  color: var(--el-text-color-placeholder);
}

:where(.login-content.login-page.dark-mode) .switch-to-account-link:active {
  color: var(--el-text-color-secondary);
}

/* SSO登录链接样式 */
.switch-to-sso-link {
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  display: inline-block;
  transition: color 0.2s ease;
}

:where(.login-content.login-page.dark-mode) .switch-to-sso-link {
  color: var(--el-text-color-secondary);
}

.switch-to-sso-link:hover {
  color: var(--el-text-color-secondary);
}

:where(.login-content.login-page.dark-mode) .switch-to-sso-link:hover {
  color: var(--el-color-white);
}

.switch-to-sso-link:active {
  color: var(--el-text-color-placeholder);
}

:where(.login-content.login-page.dark-mode) .switch-to-sso-link:active {
  color: var(--el-text-color-secondary);
}

/* 切换到手机登录链接样在*/
.switch-to-phone-link {
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  /* 强制不换在*/
  flex-shrink: 0;
  /* 不允许收在*/
  display: inline-block;
  /* 确保是行内块元素 */
  transition: color 0.2s ease;
  display: inline-block;
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: 6px;
  /* 与忘记密码之间的间距 - 缩短 */
}

:where(.login-content.login-page.dark-mode) .switch-to-phone-link {
  color: var(--el-text-color-secondary);
}

.switch-to-phone-link:hover {
  color: var(--el-text-color-secondary);
  /* 悬停时稍微深一点的灰色 */
}

:where(.login-content.login-page.dark-mode) .switch-to-phone-link:hover {
  color: var(--el-color-white);
}

.switch-to-phone-link:active {
  color: var(--el-text-color-placeholder);
}

:where(.login-content.login-page.dark-mode) .switch-to-phone-link:active {
  color: var(--el-text-color-secondary);
}

/* 账号密码登录表单操作区域样式 */
.account-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  /* 缩短手机登录和忘记密码之间的间距 */
  flex-wrap: nowrap;
  /* 强制不换在*/
  white-space: nowrap;
  /* 强制不换在*/
  overflow: visible;
  min-width: 0;
  /* 允许收缩 */
  flex-shrink: 1;
  /* 允许收缩，但优先保持在一在*/
}

/* 确保 el-col 容器不会导致换行 */
.account-form-actions.el-col,
.text-right.account-form-actions {
  white-space: nowrap;
  overflow: visible;
  flex-wrap: nowrap;
  /* 强制不换在*/
  min-width: 0;
  /* 允许收缩 */
  display: flex;
  /* 确保是flex容器 */
}

/* 确保 el-col 本身不会换行 */
.form-actions-row .el-col {
  flex-wrap: nowrap;
  /* 强制不换在*/
  white-space: nowrap;
  /* 强制不换在*/
  min-width: 0;
  /* 允许收缩 */
}

/* Element Plus 按钮样式重置 - 确保我们的样式生效，但排除登录按在*/
.login-content .el-button:not(.login-button),
.login-form .el-button:not(.login-button) {
  background: none;
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* 登录按钮基础样式 - 重新设计 */
.login-button,
.login-content .login-button,
.login-form .login-button,
.el-button.login-button {
  width: 100%;
  height: clamp(44px, 5vw, 48px);
  /* 稍微增加高度，更醒目 */
  font-size: clamp(15px, 1.6vw, 17px);
  /* 稍微增大字体 */
  font-weight: 600;
  border-radius: var(--global-border-radius);
  /* 使用标准圆角在*/
  margin: 0;
  /* 移除边距，使用父容器在gap */
  margin-bottom: 0;
  /* 确保底部没有边距，由父容器的 gap 控制 */
  padding: 0;
  /* 移除内边在*/
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* GPU加速优在*/
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border: none;
  outline: none;
}

/* Primary 登录按钮样式 - 亮色主题 - 提高优先在*/
:where(.login-content) .login-button.el-button--primary,
:where(:where(.login-form) .login-button.el-button--primary),
:where(.el-button.login-button).el-button--primary,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary {
  background: var(--el-color-primary);
  background-color: var(--el-color-primary);
  color: var(--el-bg-color-page);
  box-shadow: none;
  border: none;
}

/* 确保按钮内文字颜色正确显在- 亮色主题 - 提高优先在*/
:where(.login-content) .login-button.el-button--primary span,
:where(:where(.login-form) .login-button.el-button--primary span),
:where(.el-button.login-button).el-button--primary span,
:where(.login-content) .login-button.el-button--primary .el-button__text,
:where(:where(.login-form) .login-button.el-button--primary .el-button__text),
:where(.el-button.login-button).el-button--primary .el-button__text,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary span,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary span),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary span,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary .el-button__text,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary .el-button__text),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary .el-button__text,
:where(.login-content) .login-button.el-button--primary *,
:where(:where(.login-form) .login-button.el-button--primary *),
:where(.el-button.login-button).el-button--primary * {
  color: var(--el-bg-color-page);
  -webkit-text-fill-color: var(--el-bg-color-page);
}

/* Primary 登录按钮样式 - 暗色主题：纯白底、黑字（与亮色主题黑白反转） */
:where(#app) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary,
:where(#app) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary,
:where(#app) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary,
:where(#app, html.dark) :where(.login-content) .login-button.el-button--primary,
:where(#app, html.dark) :where(:where(.login-form) .login-button.el-button--primary),
:where(#app, html.dark) :where(.el-button.login-button).el-button--primary,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) :where(:where(.login-form) .login-button.el-button--primary),
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary {
  background: var(--el-bg-color);
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border: 2px solid var(--border-unified-color);
  box-shadow: none;
}

/* 确保按钮内文字颜色正确显在- 暗色主题 */
:where(#app) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary span,
:where(#app) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary span,
:where(#app) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary span,
:where(#app) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary .el-button__text,
:where(#app) :where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary) .el-button__text,
:where(#app) :where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary) .el-button__text,
:where(#app, html.dark) :where(.login-content) .login-button.el-button--primary span,
:where(#app, html.dark) :where(:where(.login-form) .login-button.el-button--primary span),
:where(#app, html.dark) :where(.el-button.login-button).el-button--primary span,
:where(#app, html.dark) :where(.login-content) :where(.login-button.el-button--primary) .el-button__text,
:where(#app, html.dark) :where(.login-form) :where(.login-button.el-button--primary) .el-button__text,
:where(#app, html.dark) :where(.el-button.login-button.el-button--primary) .el-button__text,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary span,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary span,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary span,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary .el-button__text,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary) .el-button__text,
:where(#app, html.dark) :where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary) .el-button__text,
:where(#app) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary *,
:where(#app) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary *,
:where(#app) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary *,
:where(#app, html.dark) :where(.login-content) .login-button.el-button--primary *,
:where(#app, html.dark) :where(:where(.login-form) .login-button.el-button--primary *),
:where(#app, html.dark) :where(.el-button.login-button).el-button--primary * {
  color: var(--el-text-color-primary);
  -webkit-text-fill-color: var(--el-text-color-primary);
}

/* Primary 按钮悬停效果 - 亮色主题 - 提高优先在*/
:where(.login-content) .login-button.el-button--primary:hover:not(:disabled),
:where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled)),
:where(.el-button.login-button).el-button--primary:hover:not(:disabled),
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:hover:not(:disabled),
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled)),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary:hover:not(:disabled) {
  background: var(--el-color-primary);
  box-shadow: none;
  color: var(--color-on-primary);
  border: none;
  opacity: 0.9;
}

/* 确保按钮内文字颜色正确显在- 悬停状在- 亮色主题 - 提高优先在*/
:where(.login-content) .login-button.el-button--primary:hover:not(:disabled) span,
:where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled) span),
:where(.el-button.login-button).el-button--primary:hover:not(:disabled) span,
:where(.login-content) .login-button.el-button--primary:hover:not(:disabled) .el-button__text,
:where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled) .el-button__text),
:where(.el-button.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:hover:not(:disabled) span,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled) span),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary:hover:not(:disabled) span,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:hover:not(:disabled) .el-button__text,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled) .el-button__text),
:where(html:not(.dark)) :where(.el-button.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(.login-content) .login-button.el-button--primary:hover:not(:disabled) *,
:where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled) *),
:where(.el-button.login-button).el-button--primary:hover:not(:disabled) * {
  color: var(--color-on-primary);
  -webkit-text-fill-color: var(--color-on-primary);
}

/* Primary 按钮悬停效果 - 暗色主题 - 提高优先在*/
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:hover:not(:disabled),
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:hover:not(:disabled),
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:hover:not(:disabled),
:where(html.dark) :where(.login-content) .login-button.el-button--primary:hover:not(:disabled),
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled)),
:where(html.dark) :where(.el-button.login-button).el-button--primary:hover:not(:disabled),
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:hover:not(:disabled),
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:hover:not(:disabled),
:where(html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:hover:not(:disabled) {
  background: var(--el-bg-color);
  border-color: var(--el-border-color-light);
  box-shadow: none;
  color: var(--el-text-color-primary);
  opacity: 0.9;
}

/* 确保按钮内文字颜色正确显在- 悬停状在- 暗色主题 - 提高优先在*/
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:hover:not(:disabled) span,
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:hover:not(:disabled) span,
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:hover:not(:disabled) span,
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:hover:not(:disabled) .el-button__text,
:where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-content) .login-button.el-button--primary:hover:not(:disabled) span,
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled) span),
:where(html.dark) :where(.el-button.login-button).el-button--primary:hover:not(:disabled) span,
:where(html.dark) :where(.login-content) :where(.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-form) :where(.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(html.dark) :where(.el-button.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:hover:not(:disabled) span,
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:hover:not(:disabled) span,
:where(html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:hover:not(:disabled) span,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:hover:not(:disabled) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary:hover:not(:disabled)) .el-button__text,
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:hover:not(:disabled) *,
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:hover:not(:disabled) *,
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:hover:not(:disabled) *,
:where(html.dark) :where(.login-content) .login-button.el-button--primary:hover:not(:disabled) *,
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:hover:not(:disabled) *),
:where(html.dark) :where(.el-button.login-button).el-button--primary:hover:not(:disabled) * {
  color: var(--el-text-color-primary);
  -webkit-text-fill-color: var(--el-text-color-primary);
}

/* Primary 按钮激活效在- 提高优先在*/
:where(.login-content) .login-button.el-button--primary:active:not(:disabled),
:where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled)),
:where(.el-button.login-button).el-button--primary:active:not(:disabled),
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:active:not(:disabled),
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled)),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary:active:not(:disabled),
:where(html.dark) :where(.login-content) .login-button.el-button--primary:active:not(:disabled),
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled)),
:where(html.dark) :where(.el-button.login-button).el-button--primary:active:not(:disabled),
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:active:not(:disabled),
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:active:not(:disabled),
:where(html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:active:not(:disabled) {
  transform: translateY(0px) scale(0.98);
  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 确保按钮内文字颜色正确显在- 激活状在- 亮色主题 */
:where(.login-content) .login-button.el-button--primary:active:not(:disabled) span,
:where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled) span),
:where(.el-button.login-button).el-button--primary:active:not(:disabled) span,
:where(.login-content) .login-button.el-button--primary:active:not(:disabled) .el-button__text,
:where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled) .el-button__text),
:where(.el-button.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:active:not(:disabled) span,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled) span),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary:active:not(:disabled) span,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:active:not(:disabled) .el-button__text,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled) .el-button__text),
:where(html:not(.dark)) :where(.el-button.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(.login-content) .login-button.el-button--primary:active:not(:disabled) *,
:where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled) *),
:where(.el-button.login-button).el-button--primary:active:not(:disabled) * {
  color: var(--el-bg-color-page);
  -webkit-text-fill-color: var(--el-bg-color-page);
}

/* 确保按钮内文字颜色正确显在- 激活状在- 暗色主题 */
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:active:not(:disabled) span,
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:active:not(:disabled) span,
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:active:not(:disabled) span,
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:active:not(:disabled) .el-button__text,
:where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-content) .login-button.el-button--primary:active:not(:disabled) span,
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled) span),
:where(html.dark) :where(.el-button.login-button).el-button--primary:active:not(:disabled) span,
:where(html.dark) :where(.login-content) :where(.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-form) :where(.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(html.dark) :where(.el-button.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:active:not(:disabled) span,
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:active:not(:disabled) span,
:where(html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:active:not(:disabled) span,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:active:not(:disabled) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary:active:not(:disabled)) .el-button__text,
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:active:not(:disabled) *,
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:active:not(:disabled) *,
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:active:not(:disabled) *,
:where(html.dark) :where(.login-content) .login-button.el-button--primary:active:not(:disabled) *,
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:active:not(:disabled) *),
:where(html.dark) :where(.el-button.login-button).el-button--primary:active:not(:disabled) * {
  color: var(--el-text-color-primary);
  -webkit-text-fill-color: var(--el-text-color-primary);
}

/* Primary 按钮禁用状在- 亮色主题 - 提高优先在*/
:where(.login-content) .login-button.el-button--primary:disabled,
:where(:where(.login-form) .login-button.el-button--primary:disabled),
:where(.el-button.login-button).el-button--primary:disabled,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:disabled,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:disabled),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary:disabled {
  background: var(--el-text-color-placeholder);
  background-color: var(--el-text-color-placeholder);
  color: var(--el-bg-color-page);
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: none;
  border: none;
}

/* 确保按钮内文字颜色正确显在- 禁用状在- 亮色主题 */
:where(.login-content) .login-button.el-button--primary:disabled span,
:where(:where(.login-form) .login-button.el-button--primary:disabled span),
:where(.el-button.login-button).el-button--primary:disabled span,
:where(.login-content) .login-button.el-button--primary:disabled .el-button__text,
:where(:where(.login-form) .login-button.el-button--primary:disabled .el-button__text),
:where(.el-button.login-button.el-button--primary:disabled) .el-button__text,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:disabled span,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:disabled span),
:where(html:not(.dark)) :where(.el-button.login-button).el-button--primary:disabled span,
:where(html:not(.dark)) :where(.login-content) .login-button.el-button--primary:disabled .el-button__text,
:where(html:not(.dark)) :where(:where(.login-form) .login-button.el-button--primary:disabled .el-button__text),
:where(html:not(.dark)) :where(.el-button.login-button.el-button--primary:disabled) .el-button__text,
:where(.login-content) .login-button.el-button--primary:disabled *,
:where(:where(.login-form) .login-button.el-button--primary:disabled *),
:where(.el-button.login-button).el-button--primary:disabled * {
  color: var(--el-bg-color-page);
  -webkit-text-fill-color: var(--el-bg-color-page);
}

/* Primary 按钮禁用状在- 暗色主题 - 提高优先在*/
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:disabled,
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:disabled,
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:disabled,
:where(html.dark) :where(.login-content) .login-button.el-button--primary:disabled,
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:disabled),
:where(html.dark) :where(.el-button.login-button).el-button--primary:disabled,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:disabled,
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:disabled,
:where(html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:disabled {
  background: var(--el-fill-color-dark);
  background-color: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: none;
  border: none;
}

/* 确保按钮内文字颜色正确显在- 禁用状在- 暗色主题 */
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:disabled span,
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:disabled span,
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:disabled span,
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:disabled .el-button__text,
:where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary:disabled) .el-button__text,
:where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary:disabled) .el-button__text,
:where(html.dark) :where(.login-content) .login-button.el-button--primary:disabled span,
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:disabled span),
:where(html.dark) :where(.el-button.login-button).el-button--primary:disabled span,
:where(html.dark) :where(.login-content) :where(.login-button.el-button--primary:disabled) .el-button__text,
:where(html.dark) :where(.login-form) :where(.login-button.el-button--primary:disabled) .el-button__text,
:where(html.dark) :where(.el-button.login-button.el-button--primary:disabled) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:disabled span,
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:disabled span,
:where(html.dark) :where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:disabled span,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-button.el-button--primary:disabled .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) .login-form :where(.login-button.el-button--primary:disabled) .el-button__text,
:where(html.dark) :where(.login-content.login-page.dark-mode) :where(.el-button.login-button.el-button--primary:disabled) .el-button__text,
:where(.login-content.login-page.dark-mode) .login-button.el-button--primary:disabled *,
:where(.login-content.login-page.dark-mode) :where(.login-form) .login-button.el-button--primary:disabled *,
:where(.login-content.login-page.dark-mode) .el-button.login-button.el-button--primary:disabled *,
:where(html.dark) :where(.login-content) .login-button.el-button--primary:disabled *,
:where(html.dark) :where(:where(.login-form) .login-button.el-button--primary:disabled *),
:where(html.dark) :where(.el-button.login-button).el-button--primary:disabled * {
  color: var(--el-text-color-secondary);
  -webkit-text-fill-color: var(--el-text-color-secondary);
}

/* 在Primary 按钮样式保持不变 */
.login-button:not(.el-button--primary) {
  background-color: transparent;
  color: var(--el-text-color-primary);
  border: var(--unified-border);
}

:where(.login-content.login-page.dark-mode) .login-button:not(.el-button--primary) {
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color);
}

.login-button:hover:not(:disabled):not(.el-button--primary) {
  background-color: var(--el-fill-color-light);
  transform: translateZ(0) scale(1.02);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

:where(.login-content.login-page.dark-mode) .login-button:hover:not(:disabled):not(.el-button--primary) {
  background-color: var(--el-fill-color-dark);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

.login-button:active:not(:disabled):not(.el-button--primary) {
  background-color: var(--el-fill-color);
  transform: translateZ(0) scale(0.98);
  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-button:disabled:not(.el-button--primary) {
  background-color: transparent;
  color: var(--el-text-color-placeholder);
  border-color: var(--el-border-color-lighter);
  cursor: not-allowed;
  opacity: 0.6;
}

:where(.login-content.login-page.dark-mode) .login-button:disabled:not(.el-button--primary) {
  color: var(--el-text-color-placeholder);
  border-color: var(--el-border-color-darker);
}

/* 登录协议说明文字样式 - 重新设计 */
.login-agreement-text {
  margin: 0;
  /* 移除所有边距，使用父容器的 gap */
  margin-top: 0;
  /* 确保顶部没有边距，由父容器的 gap 控制 */
  padding: 0;
  /* 移除内边在*/
  font-size: clamp(12px, 1.2vw, 14px);
  color: var(--el-text-color-secondary);
  line-height: 1.8;
  /* 适中的行高，方便换行对齐 */
  display: block;
  text-align: center;
  /* 整体居中 */
  width: 100%;
  overflow: visible;
  /* 允许内容完整显示 */
  height: auto;
  /* 自动高度，由内容决定 */
  min-height: auto;
  /* 最小高度自在*/
  max-height: none;
  /* 不限制最大高在*/
}

/* 暗色主题下的协议文字 */
:where(.login-content.login-page.dark-mode) .login-agreement-text {
  color: var(--el-text-color-secondary);
}

.agreement-line-1,
.agreement-line-2 {
  display: flex;
  align-items: flex-start;
  /* 顶部对齐 */
  justify-content: center;
  /* 整体居中 */
  gap: 6px;
  line-height: 1.8;
  max-width: min(100%, 308px);
  /* 两边向内缩窄，限制最大宽在*/
  margin-left: auto;
  margin-right: auto;
  overflow: visible;
  /* 允许内容完整显示 */
  white-space: normal;
  /* 允许文字换行 */
}

/* 协议文字内容容器 - 换行时左对齐 */
.agreement-text-content {
  display: inline;
  text-align: left;
  /* 换行在在在在对齐 */
  line-height: 1.8;
}

/* 协议文本中的 span 文字样式 */
.login-agreement-text span {
  color: var(--el-text-color-secondary);
  display: inline;
  /* 确保文字显示 */
  visibility: visible;
  /* 确保可见 */
  opacity: 1;
  /* 确保不透明 */
  white-space: normal;
  /* 允许换行 */
  font-size: inherit;
  /* 继承父元素字体大在*/
  line-height: inherit;
  /* 继承父元素行在*/
  margin: 0;
  /* 移除默认边距 */
  padding: 0;
  /* 移除默认内边在*/
}

/* 协议复选框容器样式：无描边、无背景、无圆角 */
.agreement-checkbox {
  display: inline-flex;
  align-items: center;
  margin-right: 4px;
  flex-shrink: 0;
  border: none;
  background-color: transparent;
  background: transparent;
  border-radius: 0;
}

/* 协议链接样式 */
.agreement-link {
  color: var(--el-color-primary);
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.2s ease;
  margin: 0;
  display: inline;
  /* 确保链接显示 */
  visibility: visible;
  /* 确保可见 */
  opacity: 1;
  /* 确保不透明 */
  white-space: normal;
  /* 允许换行 */
}

/* 明亮模式下的协议链接 hover */
.agreement-link:hover {
  color: var(--el-color-primary-light-3);
}

/* 明亮模式下的协议链接 active */
.agreement-link:active {
  color: var(--el-text-color-regular);
}

/* 暗色主题下的协议链接 */
:where(.login-content.login-page.dark-mode) .agreement-link {
  color: var(--el-color-primary-light-3);
}

/* 暗色主题下的协议链接 hover */
:where(.login-content.login-page.dark-mode) .agreement-link:hover {
  color: var(--el-color-primary-light-5);
}

/* 验证码输入组样式 - 修复重合问题，增加间在*/
:where(.login-form) :deep(.el-input-group) {
  display: flex;
  width: 100%;
  gap: clamp(8px, 1vw, 12px);
  align-items: stretch;
}

:where(.login-form) :deep(.el-input-group__append) {
  display: flex;
  align-items: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  border-radius: var(--global-border-radius);
  overflow: visible;
  flex-shrink: 0;
}

/* 验证码按钮样在- 美化，醒目且有区分度 */
.code-button {
  border: none;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  white-space: nowrap;
  outline: none;
  border-radius: var(--global-border-radius);
  font-size: clamp(14px, 1.4vw, 16px);
  padding: 0 clamp(14px, 1.8vw, 18px);
  height: clamp(40px, 4.5vw, 44px);
  line-height: clamp(40px, 4.5vw, 44px);
  min-height: clamp(40px, 4.5vw, 44px);
  margin: 0;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: var(--unified-border);
  /* GPU加速优在*/
  will-change: transform, border-color, background;
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.code-button:hover:not(:disabled) {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color);
  outline: none;
  transform: translateZ(0) translateY(-1px) scale(1.02);
}

.code-button:active:not(:disabled) {
  background: var(--el-fill-color);
  transform: translateZ(0) translateY(0) scale(0.98);
  border-color: var(--el-border-color-lighter);
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.code-button:disabled {
  background: var(--el-bg-color-page);
  color: var(--el-text-color-placeholder);
  opacity: 1;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  font-weight: 400;
}

:where(.login-content.login-page.dark-mode) .code-button {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

:where(.login-content.login-page.dark-mode) .code-button:hover:not(:disabled) {
  background: var(--el-fill-color);
  color: var(--el-color-white);
}

:where(.login-content.login-page.dark-mode) .code-button:active:not(:disabled) {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

:where(.login-content.login-page.dark-mode) .code-button:disabled {
  color: var(--el-text-color-placeholder);
}

/* 复选框样式 - 完全重构 */
:where(.login-form) :deep(.el-checkbox) {
  border: none;
  font-size: clamp(15px, 1.6vw, 17px);
}

:where(.login-form) :deep(.el-checkbox__label) {
  color: var(--el-text-color-secondary);
  font-size: clamp(15px, 1.6vw, 17px);
  line-height: 1.5;
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-checkbox__label) {
  color: var(--el-text-color-placeholder);
}

/* 复选框输入容器 */
:where(.login-form) :deep(.el-checkbox__input) {
  border: none;
  outline: none;
  box-shadow: none;
  vertical-align: middle;
}

/* 隐藏原生复选框输入在*/
:where(.login-form) :deep(.el-checkbox__original) {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
  border: none;
  clip: rect(0, 0, 0, 0);
  pointer-events: none;
}

/* 复选框内部在- 正方形，大小等于字体高度 */
:where(.login-form) :deep(.el-checkbox__input .el-checkbox__inner) {
  display: inline-block;
  width: calc(clamp(15px, 1.6vw, 17px) * 1.5);
  height: calc(clamp(15px, 1.6vw, 17px) * 1.5);
  min-width: calc(clamp(15px, 1.6vw, 17px) * 1.5);
  min-height: calc(clamp(15px, 1.6vw, 17px) * 1.5);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background-color: var(--el-bg-color);
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  position: relative;
  overflow: visible;
  box-sizing: border-box;
  vertical-align: middle;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  cursor: pointer;
}

/* 未选中状态的悬停效果 */
:where(.login-form) :deep(.el-checkbox__input:not(.is-checked):hover .el-checkbox__inner) {
  background-color: var(--el-bg-color);
  background: var(--el-bg-color);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

/* 暗色模式下未选中状态的复选框显示白色边框 */
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-checkbox__input:not(.is-checked) .el-checkbox__inner) {
  border-color: var(--el-color-white);
  border: 2px solid var(--el-color-white);
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-checkbox__input:not(.is-checked):hover .el-checkbox__inner) {
  border-color: var(--el-color-white);
  border: 2px solid var(--el-color-white);
}

/* 选中状在- 纯黑色背在*/
:where(.login-form) :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
:where(.login-form) :deep(.el-checkbox__input.is-checked .el-checkbox__inner:hover),
:where(.login-form) :deep(.el-checkbox__input.is-checked .el-checkbox__inner:active),
:where(.login-form) :deep(:where(.el-checkbox__input.is-checked.is-focus) .el-checkbox__inner) {
  background-color: var(--el-color-primary);
  background: var(--el-color-primary);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  box-shadow: none;
  outline: none;
}

/* 使用两个伪元素绘制对号，实现手写动画 */
/* 第一条线（左侧竖线） */
:where(.login-form) :deep(.el-checkbox__input.is-checked .el-checkbox__inner)::before {
  content: '';
  position: absolute;
  left: 20%;
  top: 50%;
  transform: translateY(-50%) rotate(-45deg);
  transform-origin: left center;
  width: 0;
  height: 3px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  animation: checkmark-line1 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* 第二条线（右侧横线） */
:where(.login-form) :deep(.el-checkbox__input.is-checked .el-checkbox__inner)::after {
  content: '';
  position: absolute;
  left: 20%;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
  transform-origin: left center;
  width: 0;
  height: 3px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  animation: checkmark-line2 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
}

/* 第一条线动画 - 从左侧开始画 */
@keyframes checkmark-line1 {
  0% {
    width: 0;
    opacity: 0;
  }

  20% {
    opacity: 0.5;
  }

  100% {
    width: 35%;
    opacity: 1;
  }
}

/* 第二条线动画 - 从左侧开始画 */
@keyframes checkmark-line2 {
  0% {
    width: 0;
    opacity: 0;
  }

  20% {
    opacity: 0.5;
  }

  100% {
    width: 50%;
    opacity: 1;
  }
}

/* 聚焦状在*/
:where(.login-form) :deep(.el-checkbox__input.is-focus .el-checkbox__inner) {
  box-shadow: none;
  outline: none;
}

/* 忘记密码链接样式 - 与手机登录样式一在*/
:where(.login-form) :deep(.forgot-password) {
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
  display: inline-block;
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: 0;
  /* 忘记密码是最后一个，不需要右边距 */
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.forgot-password) {
  color: var(--el-text-color-secondary);
}

@media (width <= 480px) {

  .switch-to-account-link,
  .switch-to-phone-link,
  :where(.login-form) :deep(.forgot-password) {
    font-size: 16px;
    line-height: 32px;
  }

  .remember-me-text {
    font-size: 16px;
    line-height: 32px;
  }
}

:where(.login-form) :deep(.forgot-password:hover) {
  color: var(--el-text-color-secondary);
  /* 悬停时稍微深一点的灰色，与手机登录一在*/
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.forgot-password:hover) {
  color: var(--el-color-white);
}

:where(.login-form) :deep(.forgot-password:active) {
  color: var(--el-text-color-placeholder);
  /* 点击时的颜色，与手机登录一在*/
}

:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.forgot-password:active) {
  color: var(--el-text-color-secondary);
}

/* Select下拉框样在- 极简黑白灰风在*/
:where(.login-form) :deep(.el-select .el-input__wrapper) {
  border: none;
  box-shadow: none;
  background-color: var(--el-bg-color-page);
}

/* 移除 phone-background-bar 内选择器的 hover 背景在*/
.phone-background-bar :deep(.el-select .el-input__wrapper:hover) {
  background-color: transparent;
  /* 不设置背景色 */
}

:where(.phone-background-bar) :deep(.el-select.is-focus .el-input__wrapper) {
  box-shadow: none;
  background-color: transparent;
  border-color: var(--unified-input-focus-border-color);
}

/* 账号表单 el-select 使用 Element Plus 默认样式 */

/* Alert样式 - 极简黑白灰风在*/
.security-alert {
  border: none;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
}

.security-alert :deep(.el-alert__title) {
  color: var(--el-text-color-primary);
}

:where(.login-content.login-page.dark-mode) .security-alert :deep(.el-alert__title) {
  color: var(--el-text-color-primary);
}

.security-alert :deep(.el-alert__content) {
  color: var(--el-text-color-secondary);
}

:where(.login-content.login-page.dark-mode) .security-alert :deep(.el-alert__content) {
  color: var(--el-text-color-placeholder);
}

/* 响应式设在*/
@media (width <= 992px) {

  /* 小屏幕时调整品牌跑马灯容器定位，确保仍然可见 */
  .brand-marquee-container {
    bottom: var(--ulogin-spacing);
    left: var(--ulogin-spacing);
    top: auto;
    transform: none;
    max-width: calc(100vw - 520px - 36px);
  }

  .brand-marquee {
    display: flex;
    visibility: visible;
    opacity: 1;
  }

  /* 移动端（<992px）：使用相对定位居中显示 */
  .login-content.login-page {
    width: 100%;
    min-width: 300px;
    max-width: 100%;
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    bottom: auto;
    min-height: auto;
    max-height: none;
    margin: 0 auto;
    padding: 20px 16px;
  }

  .welcome-svg,
  .login-brand .welcome-svg {
    display: block;
    visibility: visible;
    opacity: 1;
    width: clamp(280px, 60vw, 420px);
    height: auto;
    margin-top: 0;
    margin-bottom: clamp(4px, 0.5vw, 6px);
  }
}

@media (width <= 768px) {

  /* 移动端调整品牌跑马灯容器定位 - 底部居中显示 */
  .brand-marquee-container {
    bottom: var(--ulogin-spacing);
    left: var(--ulogin-spacing);
    top: auto;
    transform: none;
    max-width: calc(100vw - 24px);
    z-index: var(--ulogin-marquee-z-index);
  }

  .login-content.login-page {
    padding: 20px 24px 24px 24px;
    width: calc(100vw - 24px);
    max-width: none;
    min-width: 0;
    border-radius: var(--ulogin-border-radius-xs);
    position: fixed;
    top: calc(var(--ulogin-header-height) + var(--ulogin-spacing));
    right: var(--ulogin-spacing);
    bottom: var(--ulogin-spacing);
    left: var(--ulogin-spacing);
    margin: 0;
    height: calc(100vh - 72px - 12px);
    height: calc(100dvh - 72px - 12px);
    max-height: calc(100vh - 72px - 12px);
    max-height: calc(100dvh - 72px - 12px);
  }

  /* 移动端显示欢迎图在- 与桌面端一在*/
  .welcome-svg,
  .login-brand .welcome-svg,
  .login-content .welcome-svg,
  .login-page .welcome-svg {
    display: block;
    visibility: visible;
    opacity: 1;
    width: clamp(280px, 60vw, 420px);
    height: auto;
    margin-top: 0;
    margin-bottom: clamp(4px, 0.5vw, 6px);
  }

  .login-logo {
    width: clamp(150px, 18vw, 220px);
    margin-bottom: clamp(12px, 1.5vw, 18px);
  }

  .login-title {
    font-size: 24px;
    margin-bottom: 20px;
  }

  .login-button {
    height: 44px;
    font-size: 15px;
  }

  .country-dial-small {
    font-size: 13px;
  }

  /* 移动端验证码图片容器：缩小尺在*/
  :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper) {
    height: 36px;
    max-height: 36px;
    min-height: 36px;
  }

  :where(.login-form) :deep(.el-form-item[prop='captcha'] .captcha-image-wrapper .captcha-image img) {
    max-width: 100px;
    max-height: 36px;
  }

  /* 响应式：保持 form-actions-row 样式统一，不换行 */
  .form-actions-row,
  .account-form-container .form-actions-row,
  .phone-form-container .form-actions-row {
    flex-wrap: nowrap;
    gap: 0;
    justify-content: space-between;
    align-items: center;
  }

  .form-actions-row .el-col,
  .account-form-container .form-actions-row .el-col,
  :where(.phone-form-container) :where(.form-actions-row) .el-col {
    flex: 0 0 auto;
    min-width: 0;
  }

  /* 让第一个列根据内容自适应 */
  .form-actions-row .el-col:first-child,
  .account-form-container .form-actions-row .el-col:first-child,
  .phone-form-container .form-actions-row .el-col:first-child {
    flex: 0 0 auto;
    width: auto;
    min-width: 0;
  }
}

@media (width <= 480px) {
  .login-content.login-page {
    padding: 20px 16px 16px 16px;
    width: calc(100vw - 8px);
    max-width: none;
    min-width: 0;
    border-radius: var(--ulogin-border-radius-xs);
    min-height: auto;
    position: fixed;
    top: calc(var(--ulogin-header-height) + var(--ulogin-spacing));
    right: 4px;
    bottom: 4px;
    left: 4px;
    margin: 0;
    height: calc(100vh - 72px - 4px);
    height: calc(100dvh - 72px - 4px);
    max-height: calc(100vh - 72px - 4px);
    max-height: calc(100dvh - 72px - 4px);
  }

  /* 移动端显示欢迎图在- 与桌面端一在*/
  .welcome-svg,
  .login-brand .welcome-svg,
  .login-content .welcome-svg,
  .login-page .welcome-svg {
    display: block;
    visibility: visible;
    opacity: 1;
    width: clamp(280px, 60vw, 420px);
    height: auto;
    margin-top: 0;
    margin-bottom: clamp(4px, 0.5vw, 6px);
  }

  .login-logo {
    width: clamp(120px, 15vw, 180px);
    margin-bottom: clamp(10px, 1.2vw, 14px);
  }

  .login-title {
    font-size: 20px;
    margin-bottom: 16px;
  }

  .login-button {
    height: 42px;
    font-size: 14px;
  }

  .country-code-display {
    justify-content: center;
  }

  .form-actions-row {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
  }

  .form-actions-row .el-col {
    width: auto;
    flex: 0 0 auto;
    text-align: left;
  }

  /* 小屏幕下第一个列也自适应 */
  .form-actions-row .el-col:first-child {
    width: auto;
    flex: 0 0 auto;
  }

  /* 右侧列在小屏幕下也自适应 */
  .form-actions-row .el-col:last-child {
    width: auto;
    flex: 0 0 auto;
  }

  /* 确保 text-right 类在小屏幕下也保持右对齐 */
  .form-actions-row .el-col.text-right {
    text-align: right;
    justify-content: flex-end;
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  .text-right {
    text-align: right;
  }

  /* 响应式：保持表单项间距统一，使用父容器在gap */
  .login-form .el-form-item,
  .account-form-container .login-form .el-form-item,
  :where(.phone-form-container) :where(.login-form) .el-form-item {
    margin-bottom: 0;
    /* 使用父容器的 gap 控制间距 */
  }
}

@media (width <= 360px) {
  .login-content.login-page {
    padding: 20px 12px 12px 12px;
    width: calc(100vw - 8px);
    /* 全宽减去左右间距 */
    max-width: none;
    /* 移除最大宽度限在*/
    min-width: 0;
    /* 移除最小宽度限在*/
    border-radius: var(--global-border-radius);
    // 固定位置：移动端使用4px间距，更贴近顶部菜单在
    position: fixed;
    top: calc(60px + 12px); // Header高度60px + 12px间距，与桌面端保持一在
    right: 4px; // 右侧间距4px
    bottom: 4px; // 底部间距4px
    left: 4px; // 左侧间距4px
    height: calc(100vh - 72px - 4px);
    height: calc(100dvh - 72px - 4px);
    max-height: calc(100vh - 72px - 4px);
    max-height: calc(100dvh - 72px - 4px);
  }

  /* 移动端显示欢迎图在- 与桌面端一在*/
  .welcome-svg,
  .login-brand .welcome-svg,
  .login-content .welcome-svg,
  .login-page .welcome-svg {
    display: block;
    visibility: visible;
    opacity: 1;
    width: clamp(280px, 60vw, 420px);
    height: auto;
    margin-top: 0;
    margin-bottom: clamp(4px, 0.5vw, 6px);
  }

  .login-logo {
    width: clamp(100px, 12vw, 140px);
    margin-bottom: clamp(8px, 1vw, 10px);
  }

  .login-title {
    font-size: 18px;
  }

  .country-code-select :deep(.el-input__inner) {
    font-size: 13px;
  }

  .login-button {
    height: 40px;
    font-size: 13px;
  }
}

/* 手机号输入框组合样式 */

/* 带国家代码的手机号输入框 */
.phone-input-with-country {
  width: 100%;
}

/* 手机号输入框内集成验证码按钮样式 */
.phone-input-with-code-btn :deep(.el-input__wrapper) {
  position: relative;
  align-items: center;
  /* 确保垂直居中 */
  display: flex;
  height: clamp(44px, 4.2vw, 48px);
  /* 在phone-background-bar 高度保持一在*/
  min-height: clamp(44px, 4.2vw, 48px);
  max-height: clamp(44px, 4.2vw, 48px);
}

.phone-input-with-code-btn :deep(.el-input__suffix) {
  position: relative;
  /* 使用相对定位 */
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  /* 右对齐，让按钮贴近右在*/
  pointer-events: auto;
  margin: 0;
  margin-left: clamp(4px, 0.5vw, 8px);
  /* 与输入文字保持间在*/
  margin-right: clamp(4px, 0.5vw, 8px);
  /* 右侧间距，保持美在*/
  padding: 0;
  /* 移除所有内边距，让按钮直接显示 */
  background: transparent;
  /* 始终透明，不显示背景 */
  right: 0;
  /* 强制靠右 */
  width: auto;
  /* 自动宽度，正好匹配内在*/
  min-width: 0;
  /* 允许收缩到内容大在*/
  max-width: none;
  /* 不限制最大宽度，让容器正好匹配文在*/
  height: auto;
  /* 自动高度，正好匹配内在*/
  min-height: 0;
  /* 允许收缩到内容大在*/
  flex-shrink: 0;
  /* 不允许收在*/
  flex-grow: 0;
  /* 不允许扩在*/
  box-sizing: border-box;
  overflow: visible;
  /* 允许内容完整显示 */
  line-height: 1.5;
  /* 增加行高，让文字更舒在*/
  transition: none;
  /* 移除过渡动画，避免影响按在*/
  border-radius: var(--global-border-radius);
  /* 移除圆角，让按钮自己控制 */
}

.phone-input-with-code-btn :deep(.el-input__suffix-inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  /* 移除所有内边距，由父容器控在*/
  width: auto;
  /* 自动宽度，正好匹配内在*/
  height: auto;
  /* 自动高度，正好匹配内在*/
  min-width: 0;
  /* 允许收缩到内容大在*/
  min-height: 0;
  /* 允许收缩到内容大在*/
  line-height: 1.5;
  /* 增加行高，与按钮保持一在*/
  user-select: none;
  /* 禁止选中文本 */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.phone-input-with-code-btn :deep(.el-input__inner) {
  padding-right: clamp(8px, 1vw, 12px);
  /* 减少右侧padding，因为按钮现在使用正常文档流 */
  padding-left: clamp(6px, 1vw, 8px);
  /* 恢复为原始值，间距已通过 column-gap 解决 */
  padding-top: 0;
  padding-bottom: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  outline: none;
  width: 100%;
  max-width: 100%;
  /* 确保不超出容在*/
  height: auto;
  min-height: 0;
  box-sizing: border-box;
  line-height: normal;
  /* 使用正常行高，确保垂直居在*/
  vertical-align: middle;
  /* 垂直居中对齐 */
  display: flex;
  align-items: center;
  /* 确保内容垂直居中 */
  flex: 1 1 auto;
  /* 允许flex收缩和扩在*/
  min-width: 0;
  /* 允许收缩在 */
  overflow: visible;
  /* 允许文字完整显示 */
  text-overflow: clip;
  /* 不使用省略号 */
  white-space: nowrap;
  /* 保持单行显示 */
}

/* 验证码按钮容在hover 状在- 保持透明，不显示背景 */
.phone-input-with-code-btn :deep(.el-input__suffix):hover {
  background-color: transparent;
  background: transparent;
  border-radius: var(--global-border-radius);
  padding: 0;
  transform: none;
  box-shadow: none;
}

/* 移除focus状态的蓝色泛光 */
.phone-input-with-code-btn :deep(.el-input__suffix):focus,
.phone-input-with-code-btn :deep(.el-input__suffix):focus-visible {
  outline: none;
  box-shadow: none;
  border: none;
}

:where(.login-content.login-page.dark-mode) .phone-input-with-code-btn :deep(.el-input__suffix):hover {
  background-color: transparent;
  background: transparent;
  box-shadow: none;
}

:where(.login-content.login-page.dark-mode) .phone-input-with-code-btn :deep(.el-input__suffix):focus,
:where(.login-content.login-page.dark-mode) .phone-input-with-code-btn :deep(.el-input__suffix):focus-visible {
  outline: none;
  box-shadow: none;
  border: none;
}

/* 内联验证码按在- 亮色模式：纯白色背景，低对比色描在*/
.code-button-inline {
  padding: clamp(6px, 0.6vw, 8px) clamp(12px, 1.2vw, 16px);
  /* 合适的内边在*/
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  /* 低对比色描边 */
  background: var(--el-bg-color);
  /* 纯白色背在*/
  color: var(--color-black-87);
  /* 深色文字 */
  font-weight: 500;
  /* 适中的字在*/
  font-size: clamp(13px, 1.2vw, 14px);
  white-space: nowrap;
  margin: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  width: auto;
  height: auto;
  min-height: clamp(32px, 3vw, 36px);
  /* 最小高在*/
  line-height: 1.5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  pointer-events: auto;
  position: relative;
  box-sizing: border-box;
  overflow: visible;
}

/* 按钮 hover 状在- 亮色模式：保持纯白色背景 */
.code-button-inline:hover:not(:disabled) {
  background: var(--el-bg-color);
  /* 保持纯白色背在*/
  border-color: var(--color-black-18);
  /* 稍深的描在*/
}

/* 按钮 active 状在- 亮色模式 */
.code-button-inline:active:not(:disabled) {
  background: var(--color-black-8);
  /* 更深的灰色背在*/
  border-color: var(--color-black-24);
}

/* 按钮 focus 状在- 亮色模式 */
.code-button-inline:focus,
.code-button-inline:focus-visible,
.code-button-inline:focus-within {
  outline: 2px solid var(--color-black-20);
  /* 低对比色描边 */
  outline-offset: 2px;
  border-color: var(--color-black-24);
}

/* 按钮 disabled 状在*/
.code-button-inline:disabled {
  background: var(--el-disabled-bg-color);
  color: var(--el-disabled-text-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.code-button-inline.is-loading {
  color: var(--color-black-87);
  cursor: wait;
  opacity: 0.8;
}

/* 暗色模式下的按钮样式 - 纯黑色背景，低对比色描边 */
:where(.login-content.login-page.dark-mode) .code-button-inline {
  background: var(--el-color-primary);
  /* 纯黑色背在*/
  color: var(--color-white-87);
  /* 浅色文字 */
  border: var(--unified-border);
  /* 低对比色描边 */
}

:where(.login-content.login-page.dark-mode) .code-button-inline:hover:not(:disabled) {
  background: var(--el-color-primary);
  /* 保持纯黑色背在*/
  border-color: var(--color-white-18);
  /* 稍亮的描在*/
}

:where(.login-content.login-page.dark-mode) .code-button-inline:active:not(:disabled) {
  background: var(--color-white-12);
  /* 更亮的背在*/
  border-color: var(--color-white-24);
}

:where(.login-content.login-page.dark-mode) .code-button-inline:focus,
:where(.login-content.login-page.dark-mode) .code-button-inline:focus-visible,
:where(.login-content.login-page.dark-mode) .code-button-inline:focus-within {
  outline: 2px solid var(--color-white-20);
  /* 低对比色描边 */
  outline-offset: 2px;
  border-color: var(--color-white-24);
}

:where(.login-content.login-page.dark-mode) .code-button-inline:disabled {
  background: var(--color-white-5);
  color: var(--color-white-38);
  border-color: var(--color-white-8);
}

:where(.login-content.login-page.dark-mode) .code-button-inline.is-loading {
  color: var(--color-white-87);
}

/* 验证码输入框 - 与手机号输入框等在*/
/* 确保 el-form-item 内容区域占满宽度 */
/* 确保表单项内容区域宽在00% */
:where(.login-form) :deep(.el-form-item__content) {
  width: 100%;
}

/* 手机号表单项内容区域 - 确保高度与输入框一在*/
:where(.login-form) :deep(.el-form-item[prop='phoneNumber'] .el-form-item__content) {
  height: auto;
  /* 自动高度，由 .phone-background-bar 决定 */
  min-height: auto;
  /* 最小高度自在*/
  max-height: none;
  /* 不限制最大高在*/
  display: flex;
  /* 使用 flex 布局 */
  align-items: stretch;
  /* 拉伸子元素，确保高度一在*/
}

/* 包含协议文本的表单项 - 已移在login-actions-container，此样式保留用于兼容在*/
:where(.login-form) :deep(.el-form-item:has(.login-agreement-text)) {
  margin-bottom: 0;
  margin-top: 0;
  padding: 0;
}

/* 包含协议文本的表单项内容区域 - 已移在login-actions-container，此样式保留用于兼容在*/
:where(.login-form) :deep(.el-form-item:has(.login-agreement-text) .el-form-item__content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0;
  margin: 0;
  width: 100%;
  max-width: 100%;
  overflow: visible;
  height: auto;
  min-height: auto;
  max-height: none;
}

:where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__content) {
  width: 100%;
  margin: 0;
  padding: 0 8px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  margin-top: 0;
  margin-bottom: 0;
  background-color: transparent;
  /* 透明，让 verification-code-digit 自己显示背景 */
  border-radius: var(--global-border-radius);
  box-sizing: border-box;
}

/* 验证码背景栏 - 重新设计，与登录栏整体协调，居中对齐显示 */
.verification-code-background-bar {
  display: flex;
  /* 改为 flex，便于居中对在*/
  align-items: center;
  justify-content: center;
  /* 居中对齐 */
  gap: 0;
  width: 100%;
  /* 宽度100%，占满父容器 */
  height: auto;
  /* 自动高度，贴合输入框 */
  min-height: auto;
  background-color: transparent;
  /* 移除背景在*/
  background: transparent;
  border: none;
  /* 移除边框 */
  border-radius: var(--global-border-radius);
  /* 移除圆角 */
  box-sizing: border-box;
  margin: 0;
  padding: 0 clamp(8px, 1vw, 10px);
  /* 与phone-background-bar的左侧padding保持一在*/
  padding-right: clamp(4px, 0.5vw, 8px);
  /* 右侧padding与phone-background-bar保持一在*/
  overflow: visible;
  /* 改为 visible，允许内容完整显在*/
  position: relative;
}

.verification-code-background-bar:hover {
  background-color: transparent;
}

/* 6位验证码输入框容在- 重新设计，居中对齐显在*/
.verification-code-inputs {
  display: flex;
  gap: clamp(6px, 0.8vw, 10px);
  /* 增加间距，使用相对单位保持比在*/
  align-items: center;
  justify-content: center;
  /* 居中对齐 */
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  overflow: visible;
  width: auto;
  /* 宽度自适应内容 */
  flex-wrap: nowrap;
  flex-shrink: 0;
  /* 不允许收在*/
  flex-grow: 0;
  /* 不允许增在*/
  position: relative;
}

/* 验证码图在- 重新设计，与其他输入框图标大小一致，根据登录栏宽度自适应 */
.verification-code-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: clamp(22px, 2.8vw, 32px);
  /* 进一步减小图标尺在*/
  height: clamp(29px, 3.7vw, 42px);
  /* 根据登录栏宽度自适应，与输入框高度匹在*/
  margin: 0;
  margin-right: clamp(6px, 0.8vw, 10px);
  /* 固定与第一个输入框的间距，稍微减小 */
  padding: 0;
  color: var(--el-text-color-primary);
  position: relative;
  /* 为z-index提供定位上下在*/
  z-index: calc(var(--z-base) + 9);
  /* 确保图标在输入框之上显示 */
}

/* 确保图标内部的SVG也是黑色，提高渲染清晰度 */
.verification-code-icon :deep(svg) {
  width: clamp(22px, 2.8vw, 32px);
  height: clamp(29px, 3.7vw, 42px);
  color: var(--el-text-color-primary);
  fill: currentColor;
  shape-rendering: geometricPrecision;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

/* 暗色模式下验证码图标显示为白在*/
:where(.login-content.login-page.dark-mode) .verification-code-icon {
  color: var(--el-color-white);
}

:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg) {
  color: var(--el-color-white);
  fill: var(--el-color-white);
  stroke: var(--el-color-white);
}

/* 确保SVG内部的所有路径和元素在暗色模式下都是白色 */
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg path),
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg circle),
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg rect),
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg line),
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg polyline),
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg polygon) {
  fill: var(--el-color-white);
  stroke: var(--el-color-white);
  color: var(--el-color-white);
}

/* 处理使用currentColor的SVG元素 */
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg[fill='currentColor']),
:where(.login-content.login-page.dark-mode) .verification-code-icon :deep(svg[stroke='currentColor']) {
  color: var(--el-color-white);
}

/* 单个验证码输入框 - 使用统一变量以自动适配在暗色模式 */
/* 验证码数字输入框 - 使用 :deep 与单类，禁止高特异在*/
:where(.login-content.login-page) .phone-form-container .verification-code-inputs input.verification-code-digit,
:where(.login-content.login-page) .verification-code-inputs input.verification-code-digit,
.login-content.login-page input.verification-code-digit {
  flex: 0 0 auto;
  width: 43px;
  height: 57px;
  border: 2px solid var(--unified-input-border-color);
  border-radius: var(--global-border-radius);
  background-color: var(--unified-input-bg-color);
  background: var(--unified-input-bg-color);
  box-sizing: border-box;
  overflow: visible;
  text-align: center;
  font-size: 21px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  outline: none;
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
  position: relative;
  z-index: var(--z-base);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  flex-shrink: 0;
}

/* 暗色模式下验证码输入框容器背在*/
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-form-item[prop='verificationCode'] .el-form-item__content) {
  background-color: var(--color-white-5);
  /* 暗色模式：浅灰色背景（半透明白色在*/
}

/* 暗色模式下验证码输入框默认样在- 使用与亮色相同特异性选择器确保覆在*/
/* 暗色模式验证码数字输入框 */
:where(.login-content.login-page.dark-mode) .phone-form-container .verification-code-inputs input.verification-code-digit,
:where(.login-content.login-page.dark-mode) .verification-code-inputs input.verification-code-digit,
:where(.login-content.login-page.dark-mode) input.verification-code-digit {
  border: var(--unified-border);
  background-color: var(--unified-input-bg-color);
  background: var(--unified-input-bg-color);
  color: var(--el-text-color-primary);
}

/* 悬停状在- 使用统一变量以适配暗色模式 */
:where(.login-content.login-page .phone-form-container .verification-code-inputs) input.verification-code-digit:hover,
:where(.login-content.login-page) .verification-code-inputs input.verification-code-digit:hover,
:where(.login-content.login-page) input.verification-code-digit:hover {
  border: 2px solid var(--unified-input-hover-border-color);
  background-color: var(--unified-input-hover-bg-color);
  background: var(--unified-input-hover-bg-color);
  box-shadow: none;
}

/* 聚焦状在- 使用统一变量以适配暗色模式 */
:where(.login-content.login-page .phone-form-container .verification-code-inputs) input.verification-code-digit:focus,
:where(.login-content.login-page .phone-form-container .verification-code-inputs) input.verification-code-digit.is-focused,
:where(.login-content.login-page) .verification-code-inputs input.verification-code-digit:focus,
:where(.login-content.login-page .verification-code-inputs) input.verification-code-digit.is-focused,
:where(.login-content.login-page) input.verification-code-digit:focus,
:where(.login-content.login-page) input.verification-code-digit.is-focused {
  border: 2px solid var(--unified-input-focus-border-color);
  background-color: var(--unified-input-focus-bg-color);
  background: var(--unified-input-focus-bg-color);
  box-shadow: none;
}

/* 暗色模式 hover/focus - 使用与亮色相同特异性确保覆在*/
:where(.login-content.login-page.dark-mode .phone-form-container .verification-code-inputs) input.verification-code-digit:hover,
:where(.login-content.login-page.dark-mode) .verification-code-inputs input.verification-code-digit:hover,
:where(.login-content.login-page.dark-mode) input.verification-code-digit:hover {
  border: 2px solid var(--unified-input-hover-border-color);
  background-color: var(--unified-input-hover-bg-color);
  background: var(--unified-input-hover-bg-color);
}

:where(.login-content.login-page.dark-mode .phone-form-container .verification-code-inputs) input.verification-code-digit:focus,
:where(.login-content.login-page.dark-mode .phone-form-container .verification-code-inputs) input.verification-code-digit.is-focused,
:where(.login-content.login-page.dark-mode) .verification-code-inputs input.verification-code-digit:focus,
:where(.login-content.login-page.dark-mode .verification-code-inputs) input.verification-code-digit.is-focused,
:where(.login-content.login-page.dark-mode) input.verification-code-digit:focus,
:where(.login-content.login-page.dark-mode) input.verification-code-digit.is-focused {
  border: 2px solid var(--unified-input-focus-border-color);
  background-color: var(--unified-input-focus-bg-color);
  background: var(--unified-input-focus-bg-color);
}

:where(.login-content.login-page.dark-mode) .verification-code-digit:focus,
:where(.login-content.login-page.dark-mode) .verification-code-digit.is-focused {
  color: var(--el-text-color-primary);
}

.verification-code-digit:disabled {
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}

/* 暗色模式下禁用状在*/
:where(.login-content.login-page.dark-mode) .verification-code-digit:disabled {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  border-color: var(--el-border-color);
}

/* 响应式调在- 1200px左右宽度适配，防止输入框超出容器 */
@media (width >= 1100px) and (max-width: 1300px) {
  .verification-code-background-bar {
    padding: 0 16px;
    /* 固定左右内边在*/
    overflow: visible;
    /* 允许内容完整显示 */
  }

  .verification-code-inputs {
    gap: clamp(6px, 0.8vw, 10px);
    /* 增加间距，使用相对单位保持比在*/
    width: auto;
    /* 宽度自适应内容，便于居在*/
    justify-content: center;
    /* 确保居中对齐 */
    flex-shrink: 0;
    /* 不允许收在*/
  }

  .verification-code-digit {
    flex: 1 1 0;
    /* 使用flex让输入框平均分配空间，自适应宽度 */
    width: auto;
    /* 宽度由flex控制 */
    min-width: 0;
    /* 允许收缩 */
    aspect-ratio: 3/4;
    /* 保持3:4比例，高度根据宽度自动计在*/
    font-size: clamp(16px, 2vw, 21px);
    /* 使用相对单位保持比例 */
  }
}

/* 响应式调在- 小屏幕时保持3:4比例，使用flex自动缩放 */
@media (width <= 768px) {
  .verification-code-background-bar {
    height: auto;
    /* 自动高度，贴合输入框 */
    min-height: auto;
    padding: 0 clamp(8px, 1vw, 10px);
    /* 使用相对单位保持对齐 */
    padding-right: clamp(4px, 0.5vw, 8px);
    /* 右侧padding与phone-background-bar保持一在*/
    overflow: visible;
    /* 允许内容完整显示 */
  }

  .verification-code-inputs {
    gap: clamp(6px, 0.8vw, 10px);
    /* 增加间距，使用相对单位保持比在*/
    width: auto;
    /* 宽度自适应内容，便于居在*/
    justify-content: center;
    /* 确保居中对齐 */
    flex-wrap: nowrap;
    flex-shrink: 0;
    /* 不允许收在*/
  }

  .verification-code-digit {
    flex: 1 1 0;
    /* 使用 flex 让输入框根据容器宽度自动缩放 */
    min-width: clamp(10px, 1.2vw, 16px);
    /* 确保最小尺在*/
    max-width: none;
    width: auto;
    aspect-ratio: 3/4;
    /* 保持3:4比例，高度根据宽度自动计在*/
    font-size: clamp(16px, 2vw, 21px);
    /* 使用相对单位保持比例 */
  }

  .verification-code-digit {
    width: 43px;
    /* 等比例缩在*/
    height: 57px;
    /* 等比例缩在*/
    font-size: 21px;
    /* 等比例缩小字在*/
  }

  .verification-code-icon {
    width: clamp(22px, 2.8vw, 32px);
    /* 根据容器宽度自适应 */
    height: clamp(29px, 3.7vw, 42px);
    /* 与输入框高度匹配 */
  }

  .verification-code-icon :deep(svg) {
    width: clamp(22px, 2.8vw, 32px);
    height: clamp(29px, 3.7vw, 42px);
  }
}

@media (width <= 480px) {
  .verification-code-background-bar {
    height: auto;
    /* 自动高度，贴合输入框 */
    min-height: auto;
    padding: 0 clamp(8px, 1vw, 10px);
    /* 使用相对单位保持对齐 */
    padding-right: clamp(4px, 0.5vw, 8px);
    /* 右侧padding与phone-background-bar保持一在*/
    overflow: visible;
    /* 允许内容完整显示 */
  }

  .verification-code-inputs {
    gap: clamp(6px, 0.8vw, 10px);
    /* 增加间距，使用相对单位保持比在*/
    width: auto;
    /* 宽度自适应内容，便于居在*/
    justify-content: center;
    /* 确保居中对齐 */
    flex-shrink: 0;
    /* 不允许收在*/
  }

  .verification-code-digit {
    flex: 1 1 0;
    /* 使用flex让输入框平均分配空间，自适应宽度 */
    width: auto;
    /* 宽度由flex控制 */
    min-width: clamp(10px, 1.2vw, 16px);
    /* 确保最小尺在*/
    aspect-ratio: 3/4;
    /* 保持3:4比例，高度根据宽度自动计在*/
    font-size: clamp(16px, 2vw, 21px);
    /* 使用相对单位保持比例 */
  }

  .verification-code-icon {
    width: clamp(22px, 2.8vw, 32px);
    /* 根据容器宽度自适应 */
    height: 42px;
    /* 与输入框高度匹配 */
  }

  .verification-code-icon :deep(svg) {
    width: 34px;
    height: 42px;
  }
}

.verification-code-input {
  width: 100%;
}

.verification-code-input :deep(.el-input__wrapper) {
  width: 100%;
  border: none;
  box-shadow: none;
  outline: none;
}

.verification-code-input :deep(.el-input__inner) {
  width: 100%;
  border: none;
  background: transparent;
  box-shadow: none;
  outline: none;
}

/* 确保国家代码选择器在prefix中正确显在*/
.phone-input-with-country :deep(.el-input__prefix) {
  display: flex;
  align-items: center;
  justify-content: center;
  /* 居中对齐 */
  padding: 0;
  padding-right: 10px;
  /* 在+86 保持更明显的间距 */
  margin: 0;
  margin-right: 0;
  width: clamp(60px, 7vw, 85px);
  /* 优化宽度以节省空在*/
  min-width: clamp(60px, 7vw, 85px);
  max-width: clamp(60px, 7vw, 85px);
  flex-shrink: 0;
}

.phone-input-with-country :deep(.el-input__inner) {
  padding-left: 0;
  padding-right: 0;
  padding-top: 0;
  padding-bottom: 0;
  padding-inline-start: 0;
  padding-inline-end: 0;
  margin: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  outline: none;
  width: 100%;
  height: auto;
  min-height: 0;
  line-height: inherit;
  box-sizing: border-box;
  /* 略微上移输入文字，使其在输入框内看起来更居中 */
  
}

.phone-input-with-country :deep(.el-input__wrapper) {
  border: none;
  box-shadow: none;
  outline: none;
}

.phone-input-with-country :deep(.el-input__prefix-inner) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: auto;
  min-width: 0;
  max-width: fit-content;
  height: auto;
  min-height: 0;
  line-height: 1;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  /* 确保容器只包裹图标，不额外占用空在*/
  box-sizing: content-box;
}

/* 国家代码文本样式 - 可见但不阻止点击 */
.selected-country-code-display .country-code-text {
  position: relative;
  z-index: calc(var(--z-base) + 9);
  /* 提高z-index确保文字在最上层 */
  pointer-events: none;
  /* 让点击穿透到el-select */
  display: inline-block;
  visibility: visible;
  opacity: 1;
  color: var(--el-text-color-primary);
}

/* 国家代码选择器样在- el-select覆盖整个容器作为点击区域 */
.country-code-select-inline {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  min-width: 100%;
  /* 确保最小宽度为父容器宽在*/
  max-width: 100%;
  /* 确保最大宽度为父容器宽在*/
  cursor: pointer;
  z-index: calc(var(--z-base) + 4);
  box-sizing: border-box;
}

/* el-select wrapper 样式 - 透明背景，左右圆在px，hover/点击时颜色变在*/
:where(.country-code-select-inline) :deep(.el-select__wrapper) {
  background-color: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  width: 100%;
  /* 占满父容器宽在*/
  min-width: 100%;
  /* 最小宽度为父容器宽在*/
  max-width: 100%;
  /* 最大宽度为父容器宽在*/
  height: 100%;
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  cursor: pointer;
  opacity: 1;
  pointer-events: auto;
  /* 左右圆角2px */
  border-radius: var(--global-border-radius);
  transition: background-color 0.2s ease;
}

/* 移除所在hover 状态背景色 */
:where(.country-code-select-inline) :deep(.el-select__wrapper:hover),
:where(.country-code-select-inline) :deep(.el-select__wrapper.is-hovering) {
  background-color: transparent;
  /* 不设置背景色 */
}

/* 暗色模式hover状在- 不设置背景色 */
:where(html.dark) :where(.country-code-select-inline) :deep(.el-select__wrapper:hover),
:where(html.dark) :where(.country-code-select-inline) :deep(.el-select__wrapper.is-hovering) {
  background-color: transparent;
  /* 不设置背景色 */
}

/* 移除所在focus/active 状态背景色 */
:where(.country-code-select-inline) :deep(.el-select__wrapper.is-focus),
:where(.country-code-select-inline) :deep(.el-select__wrapper:focus),
:where(.country-code-select-inline) :deep(.el-select__wrapper:active) {
  background-color: transparent;
  /* 不设置背景色 */
}

/* 暗色模式focus/active状在- 不设置背景色 */
:where(html.dark) :where(.country-code-select-inline) :deep(.el-select__wrapper.is-focus),
:where(html.dark) :where(.country-code-select-inline) :deep(.el-select__wrapper:focus),
:where(html.dark) :where(.country-code-select-inline) :deep(.el-select__wrapper:active) {
  background-color: transparent;
  /* 不设置背景色 */
}

/* 隐藏原生的选中项显示，但保持wrapper可点在*/
:where(.country-code-select-inline) :deep(.el-select__selection),
:where(.country-code-select-inline) :deep(.el-select__selected-item),
:where(.country-code-select-inline) :deep(.el-select__tags),
:where(.country-code-select-inline) :deep(.el-select__input),
:where(.country-code-select-inline) :deep(.el-input__inner) {
  opacity: 0;
  width: 0;
  height: 0;
  overflow: hidden;
}

/* 隐藏 placeholder */
:where(.country-code-select-inline) :deep(.el-select__placeholder) {
  display: none;
}

/* 隐藏下拉箭头（因为已经有自定义箭头在模板中） */
:where(.country-code-select-inline) :deep(.el-select__suffix) {
  opacity: 0;
  width: 0;
  pointer-events: none;
}

/* 移除重复的wrapper样式定义，已在上面统一定义 */

/* 极端兜底：针在el-select__wrapper is-filterable el-tooltip__trigger 组合类，确保透明背景和左右圆在px */
:where(.phone-background-bar>.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper.is-filterable.el-tooltip__trigger) {
  background-color: transparent;
  border-radius: var(--global-border-radius);
  /* 左右圆角2px */
  border: none;
  box-shadow: none;
  padding: 0;
}

/* 在登录页环境下进一步提高选择器优先级，确保透明背景和左右圆在px */
:where(.login-content.login-page) :where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper) {
  background-color: transparent;
  border-radius: var(--global-border-radius);
  /* 左右圆角2px */
  border: none;
  box-shadow: none;
}

:where(.login-content.login-page) :where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-input__wrapper),
:where(.login-content.login-page) :where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix),
:where(.login-content.login-page) :where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix-inner) {
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* 兜底：移在wrapper 及后缀区域可能存在在::before / ::after 浅灰背景 */
:where(.country-code-select-inline) :deep(.el-select__wrapper)::before,
:where(.country-code-select-inline) :deep(.el-select__wrapper)::after,
:where(.country-code-select-inline) :deep(.el-select__suffix)::before,
:where(.country-code-select-inline) :deep(.el-select__suffix)::after {
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* 确保 wrapper 内部的内容正确排在- 修复溢出问题 */
.country-code-select-inline {
  min-width: 20px;
  /* 确保父容器有足够空间 */
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

:where(.country-code-select-inline) :deep(.el-select__wrapper) {
  max-width: 100%;
  width: 100%;
  min-width: 100%;
  /* 最小宽度为父容器宽度，确保能完整显示内在*/
  overflow: visible;
  /* 允许内容完整显示 */
  box-sizing: border-box;
  position: relative;
  /* 改为relative，不使用绝对定位 */
  left: auto;
  right: auto;
  /* 添加定位属在*/
  top: auto;
  bottom: auto;
  /* 添加定位属在*/
  opacity: 1;
  pointer-events: auto;
}

:where(.country-code-select-inline) :deep(.el-select__suffix) {
  max-width: 20px;
  width: auto;
  min-width: 0;
  max-height: 100%;
  height: auto;
  min-height: 0;
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

:where(.country-code-select-inline) :deep(.el-select__suffix .el-icon) {
  max-width: 14px;
  max-height: 14px;
  width: 14px;
  height: 14px;
  overflow: hidden;
  box-sizing: border-box;
}

:where(.country-code-select-inline) :deep(.el-select__wrapper > *) {
  flex-shrink: 1;
  max-width: 100%;
  overflow: hidden;
}

/* el-select wrapper 样式 - 保持可见和可交互 */
:where(.country-code-select-inline) :deep(.el-select__wrapper) {
  opacity: 1;
  pointer-events: auto;
  cursor: pointer;
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* 确保选中值显示在正确位置 */
:where(.country-code-select-inline) :deep(.el-select__selected-item-wrap) {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  overflow: visible;
}

/* 显示el-input__wrapper中的选中值文在*/
:where(.country-code-select-inline) :deep(.el-input__wrapper) {
  display: flex;
  align-items: center;
  gap: 4px;
  /* 移除默认浅灰背景和描边，避免形成小圆角底在*/
  background-color: transparent;
  border: none;
  box-shadow: none;
  max-width: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
}

:where(.country-code-select-inline) :deep(.el-input__suffix),
:where(.country-code-select-inline) :deep(.el-select__suffix),
:where(.country-code-select-inline) :deep(.el-select__suffix-inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  visibility: visible;
  width: auto;
  height: auto;
  flex-shrink: 0;
}

/* 确保下拉箭头图标显示 */
:where(.country-code-select-inline) :deep(.el-select__caret),
:where(.country-code-select-inline) :deep(.el-icon),
:where(.country-code-select-inline) :deep(.el-icon svg) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  visibility: visible;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  width: auto;
  height: auto;
  flex-shrink: 0;
}

/* 显示选中的国家代码文在- 确保可见，使用多种选择器覆在*/
:where(.country-code-select-inline) :deep(.el-select__selected-item),
:where(.country-code-select-inline) :deep(.el-tag),
:where(.country-code-select-inline) :deep(.el-tag__content),
:where(.country-code-select-inline) :deep(.el-select__tags-text),
:where(.country-code-select-inline) :deep(.el-select__tags > .el-tag),
:where(.country-code-select-inline) :deep(.el-select__tags),
:where(.country-code-select-inline) :deep(.el-select__tags-inner) {
  display: inline-flex;
  align-items: center;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 500;
  padding: 0;
  margin: 0;
  margin-right: 4px;
  line-height: 1.5;
  background-color: transparent;
  border: none;
  box-shadow: none;
  position: relative;
  vertical-align: middle;
  cursor: pointer;
  visibility: visible;
  opacity: 1;
  width: auto;
  height: auto;
  max-width: none;
  flex-shrink: 0;
}

/* 显示 el-input__inner 中的选中在*/
:where(.country-code-select-inline) :deep(.el-input__inner),
:where(.country-code-select-inline) :deep(.el-select__tags .el-tag__content),
:where(.country-code-select-inline) :deep(.el-select__selected-item-wrap) {
  display: inline-block;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 500;
  padding: 0;
  margin: 0;
  line-height: 1.5;
  background-color: transparent;
  border: none;
  box-shadow: none;
  visibility: visible;
  opacity: 1;
  width: auto;
  height: auto;
}

/* 确保 el-select__tags 容器也显在- 已经在上面的样式中定义，这里确保优先在*/
:where(.country-code-select-inline) :deep(.el-select__tags) {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  visibility: visible;
  opacity: 1;
  position: relative;
  margin: 0;
  padding: 0;
  gap: 4px;
}

/* 特别处理 Element Plus 可能使用的文本显示方在*/
:where(.country-code-select-inline) :deep(.el-select__selected-item-wrap > .el-select__tags > .el-tag) {
  display: inline-flex;
  align-items: center;
  height: auto;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
}

:where(.country-code-select-inline) :deep(:where(.el-select__selected-item-wrap) > .el-select__tags > .el-tag > .el-tag__content) {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}

/* 隐藏placeholder和其他不必要的元在*/
:where(.country-code-select-inline) :deep(.el-select__placeholder),
:where(.country-code-select-inline) :deep(.el-select__prefix) {
  display: none;
  visibility: hidden;
  opacity: 0;
}

/* 让select透明但保持可点击，只显示下拉箭头 */
.phone-background-bar>.country-code-select-inline {
  position: relative;
  width: auto;
  /* 根据内容自适应宽度 */
  min-width: max-content;
  /* 最小宽度为内容宽度 */
  max-width: max-content;
  /* 最大宽度为内容宽度 */
  height: 100%;
  z-index: calc(var(--z-base) + 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
}

.phone-background-bar>:where(.country-code-select-inline) :deep(.el-select__wrapper) {
  width: auto;
  /* 根据内容自适应宽度 */
  max-width: max-content;
  /* 最大宽度为内容宽度 */
  height: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  /* 增加最小宽度，确保有足够空间显示箭在*/
  padding: 0;
  margin: 0;
  border: none;
  box-shadow: none;
}

/* 确保wrapper内的suffix容器显示 */
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper > .el-select__selected-item-wrap) {
  display: none;
  width: 0;
  min-width: 0;
  flex: 0;
}

:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper > .el-select__suffix) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 20px;
  /* 增加最小宽度，确保箭头有足够空在*/
  flex-shrink: 0;
  opacity: 1;
  visibility: visible;
  order: 999;
  /* 确保在最后显在*/
  margin: 0;
  margin-left: 4px;
  /* 增加左侧间距，避免与文本重合 */
  padding: 0;
  background-color: transparent;
  /* 去掉后缀区域自带的小圆角背景 */
}

/* 彻底移除国家区号选择器整体wrapper的常驻浅灰背景，确保透明和左右圆在px */
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper) {
  background-color: transparent;
  border-radius: var(--global-border-radius);
  /* 左右圆角2px */
  border: none;
  box-shadow: none;
  width: auto;
  /* 根据内容自适应宽度 */
  max-width: max-content;
  /* 最大宽度为内容宽度 */
}

:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-input__wrapper) {
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* 隐藏select中的文本，只显示下拉箭头 */
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__selected-item),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__tags),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__tags-text),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-tag),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-tag__content),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__selected-item-wrap),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__input),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-input__inner) {
  display: none;
  opacity: 0;
  visibility: hidden;
  width: 0;
  height: 0;
  padding: 0;
  margin: 0;
  position: absolute;
}

/* 确保suffix和箭头不被隐在*/
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-input__suffix),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix-inner),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__caret),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-icon),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-icon svg),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(i[class*='arrow']) {
  display: inline-flex;
  opacity: 1;
  visibility: visible;
  width: auto;
  height: auto;
  position: relative;
  background-color: transparent;
  /* 禁止为小箭头单独加背景色 */
}

/* 显示下拉箭头在选中值右侧，居中且紧贴国家代在*/
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-input__suffix),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix-inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  visibility: visible;
  position: relative;
  margin: 0;
  padding: 0;
  width: auto;
  height: 100%;
  flex-shrink: 0;
}

:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__caret),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-icon),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-icon svg),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(i[class*='arrow']),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(i),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper .el-select__suffix .el-icon),
:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__wrapper .el-select__suffix .el-select__caret) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  visibility: visible;
  color: var(--el-text-color-secondary);
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  position: relative;
  line-height: 1;
  flex-shrink: 0;
  cursor: pointer;
  background-color: transparent;
  /* 小箭头容器背景设为透明 */
}

:where(.selected-country-code-display) :where(.country-code-select-inline) :deep(.el-select__suffix svg) {
  width: 14px;
  height: 14px;
  color: var(--el-text-color-secondary);
  background-color: transparent;
  /* 小箭头SVG本身也不带背景色 */
  margin-left: 0;
  /* 确保箭头在suffix容器内居在*/
  flex-shrink: 0;
}

/* 显示下拉箭头 */
:where(.country-code-select-inline) :deep(.el-select__caret) {
  display: inline-block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-left: 4px;
  transition: transform 0.2s ease;
}

.country-code-select-inline.is-focus :deep(.el-select__caret) {
  transform: rotate(180deg);
}

/* hover和focus状态保持透明 */
:where(.country-code-select-inline) :deep(.el-select__wrapper:hover),
:where(.country-code-select-inline) :deep(.el-select__wrapper:focus),
.country-code-select-inline.is-focus :deep(.el-select__wrapper),
.country-code-select-inline.is-hovering :deep(.el-select__wrapper) {
  box-shadow: none;
  outline: none;
  background-color: transparent;
  border: none;
}

/* 国家代码显示样式 */
.country-code-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.country-flag-small {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.country-dial-small {
  color: var(--el-text-color-primary);
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

/* 手机号输入框 */
.phone-number-input {
  flex: 1;
  min-width: 0;
}

/* 下拉选项样式 */
.country-option {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  justify-content: space-between;
}

.country-name {
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 500;
  flex: 1;
  margin-right: 0;
  padding-right: 0;
}

.country-dial {
  color: var(--el-text-color-secondary);
  font-weight: 500;
  font-size: 12px;
  min-width: 50px;
  text-align: right;
  margin-left: 0;
  padding-left: 0;
}

/* 注意在country-code-popper 的所有样式（包括暗色模式）在全局样式块中定义 */
/* 因为使用在:teleported="true"，下拉菜单渲染到 body，scoped 样式不生在*/

/* 复选框样式优化：与“自动登录”文字匹配大小，圆角显示 */
:where(.login-form) :deep(.el-checkbox__inner) {
  width: 20px;
  height: 20px;
  border: 2px solid var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  background-color: transparent; // 简在
}

/* 暗色模式下未选中状态的复选框显示白色边框 */
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-checkbox:not(.is-checked) .el-checkbox__inner) {
  border-color: var(--el-color-white);
  border: 2px solid var(--el-color-white);
}

:where(.login-form) :deep(.el-checkbox.is-checked .el-checkbox__inner) {
  background-color: var(--el-color-primary);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

/* 暗色模式下选中状态的复选框保持黑色（或白色在*/
:where(.login-content.login-page.dark-mode) :where(.login-form) :deep(.el-checkbox.is-checked .el-checkbox__inner) {
  background-color: var(--el-color-white);
  border-color: var(--el-color-white);
}

:where(.login-form) :deep(.el-checkbox__label) {
  margin-left: 8px;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

/* 调整对号角度为逆时在0度（相对默认样式在*/
:where(.login-form) :deep(.el-checkbox.is-checked .el-checkbox__inner)::after {
  transform: rotate(-90deg);
}

/* 自动登录复选框包装在- 确保复选框在文字左在*/
.remember-me-text {
  font-size: 16px;
  line-height: 24px;
  color: var(--el-text-color-primary);
  user-select: none;
  font-weight: 700;
  margin-left: 3px;
}

/* 暗色模式下自动登录文字颜色与账号密码登录相同 */
:where(.login-content.login-page.dark-mode) .remember-me-text {
  color: var(--el-text-color-secondary);
  /* 在.switch-to-account-link 暗色模式颜色相同 */
}

.custom-checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-size: 16px;
  color: var(--el-text-color-primary);
  transition: color 0.3s;
  border: none;
  background-color: transparent;
  background: transparent;
  border-radius: 0;
}

.custom-checkbox input[type="checkbox"] {
  display: none;
}

.custom-checkbox .checkmark {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-unified-color);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 3px;
  transition: background-color 0.3s, border-color 0.3s, transform 0.3s;
  transform-style: preserve-3d;
}

.custom-checkbox .checkmark::before {
  content: "\2713";
  font-size: 16px;
  color: transparent;
  transition: color 0.3s, transform 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  width: 100%;
  height: 100%;
}

.custom-checkbox input[type="checkbox"]:checked+.checkmark {
  background-color: var(--el-text-color-primary);
  border-color: var(--el-text-color-primary);
  transform: scale(1.1) rotateZ(360deg) rotateY(360deg);
}

.custom-checkbox input[type="checkbox"]:checked+.checkmark::before {
  color: var(--el-bg-color);
}

.custom-checkbox:hover {
  color: var(--el-text-color-regular);
}

.custom-checkbox:hover .checkmark {
  border-color: var(--el-text-color-regular);
  background-color: var(--el-fill-color-light);
  transform: scale(1.05);
}

.custom-checkbox input[type="checkbox"]:focus+.checkmark {
  outline: 2px solid var(--color-black-25);
  outline-offset: 2px;
}

.custom-checkbox .checkmark,
.custom-checkbox input[type="checkbox"]:checked+.checkmark {
  transition: background-color 1.3s, border-color 1.3s, color 1.3s, transform 0.3s;
}

/* 登录按钮提示在- 亮色模式纯黑背景白色文字 */
:global(.el-popper.login-tooltip),
:global(.el-popper.login-tooltip.is-dark),
:global(.login-tooltip.el-popper) {
  background: var(--el-color-primary);
  background-color: var(--el-color-primary);
  border: none;
  border-radius: var(--global-border-radius);
  box-shadow: none;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-bg-color);
  font-weight: 400;
  max-width: 200px;
  word-break: keep-all;
  white-space: normal;
}

:global(.el-popper.login-tooltip *),
:global(.login-tooltip.el-popper *) {
  color: var(--el-bg-color);
  -webkit-text-fill-color: var(--el-bg-color);
}

:global(.el-popper.login-tooltip .el-popper__arrow::before),
:global(.login-tooltip.el-popper .el-popper__arrow::before) {
  background: var(--el-color-primary);
  border-color: var(--el-text-color-primary);
}

/* 登录按钮提示在- 暗色模式纯白背景黑色文字 */
:global(:where(html.dark) .el-popper.login-tooltip),
:global(:where(html.dark) .login-tooltip.el-popper),
:global(:where(body.dark) .el-popper.login-tooltip),
:global(:where(body.dark) .login-tooltip.el-popper) {
  background: var(--el-bg-color);
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

:global(:where(html.dark) .el-popper.login-tooltip *),
:global(:where(html.dark) .login-tooltip.el-popper *),
:global(:where(body.dark) .el-popper.login-tooltip *),
:global(:where(body.dark) .login-tooltip.el-popper *) {
  color: var(--el-text-color-primary);
  -webkit-text-fill-color: var(--el-text-color-primary);
}

:global(:where(html.dark) .el-popper.login-tooltip .el-popper__arrow::before),
:global(:where(html.dark) .login-tooltip.el-popper .el-popper__arrow::before),
:global(:where(body.dark) .el-popper.login-tooltip .el-popper__arrow::before),
:global(:where(body.dark) .login-tooltip.el-popper .el-popper__arrow::before) {
  background: var(--el-bg-color);
  border-color: var(--el-bg-color);
}

/* 协议确认弹窗样式 - 内容部分（scoped在*/

/* 弹窗内容容器 - 添加明确的ID和类名便于选择 */
#agreement-confirm-dialog-container,
.agreement-confirm-dialog-container {
  width: 100%;
  display: block;
}

.agreement-confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4px 0;
  width: 100%;
}

/* 提示文字样式 - 黑白灰配在*/
.agreement-confirm-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  margin: 0 0 16px 0;
  padding: 0 4px;
  word-break: break-word;
  transition: color 0.2s ease;
}

/* 暗色模式下的文字 */
:where(html.dark) .agreement-confirm-text {
  color: var(--el-border-color-lighter);
}

/* 链接容器 */
.agreement-confirm-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  margin-top: 2px;
}

/* 链接样式 - 黑白灰配色，不使用蓝在*/
.agreement-confirm-links .agreement-link-item {
  color: var(--el-text-color-regular);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease, background-color 0.2s ease;
  padding: 2px 4px;
  border-radius: var(--global-border-radius);
  background-color: transparent;
}

/* 明亮模式下的链接 - hover时变深灰在*/
.agreement-confirm-links .agreement-link-item:hover {
  color: var(--color-gray-303133);
  text-decoration: underline;
  background-color: var(--color-neutral-100);
}

.agreement-confirm-links .agreement-link-item:active {
  color: var(--el-text-color-primary);
  background-color: var(--el-fill-color-light);
}

/* 暗色模式下的链接 */
:where(html.dark) .agreement-confirm-links .agreement-link-item {
  color: var(--color-gray-b3b6ba);
}

:where(html.dark) .agreement-confirm-links .agreement-link-item:hover {
  color: var(--color-gray-e5eaf3);
  background-color: var(--color-dark-bg-1);
}

:where(html.dark) .agreement-confirm-links .agreement-link-item:active {
  color: var(--el-bg-color);
  background-color: var(--color-gray-3a3a3a);
}

/* 分隔在- 灰色 */
.agreement-confirm-separator {
  color: var(--el-text-color-primary);
  margin: 0 2px;
  font-size: 14px;
  transition: color 0.2s ease;
}

/* 暗色模式下的分隔在*/
:where(html.dark) .agreement-confirm-separator {
  color: var(--color-gray-a8abb2);
}

/* 底部按钮容器 */
.agreement-confirm-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 100%;
  position: relative;
  z-index: var(--z-base);
}

/* 取消按钮样式 - 扁平化设计：使用边框和背景，无阴在*/
.agreement-confirm-footer .agreement-cancel-button {
  min-width: 120px;
  width: 120px;
  height: 44px;
  border-radius: var(--global-border-radius);
  font-weight: 400;
  font-size: 14px;
  cursor: pointer;
  pointer-events: auto;
  position: relative;
  z-index: calc(var(--z-base) + 9);
  opacity: 1;
  margin: 0;
  box-shadow: none;
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  padding: 0;
}

.agreement-confirm-footer .agreement-cancel-button :deep(.el-button__inner),
.agreement-confirm-footer .agreement-cancel-button :deep(.el-button__wrapper) {
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  color: var(--el-text-color-regular);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  cursor: pointer;
  pointer-events: auto;
  width: 100%;
  height: 100%;
  box-shadow: none;
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.agreement-confirm-footer .agreement-cancel-button:disabled,
.agreement-confirm-footer .agreement-cancel-button.is-disabled {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
}

:where(.agreement-confirm-footer) .agreement-cancel-button:disabled :deep(.el-button__inner),
:where(.agreement-confirm-footer) .agreement-cancel-button.is-disabled :deep(.el-button__inner) {
  cursor: pointer;
  pointer-events: auto;
  opacity: 1;
}

/* 明亮模式下的取消按钮 - hover时边框变在*/
.agreement-confirm-footer .agreement-cancel-button:hover {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--el-fill-color-lighter);
  border-color: var(--color-black-20);
}

.agreement-confirm-footer .agreement-cancel-button:hover :deep(.el-button__inner),
.agreement-confirm-footer .agreement-cancel-button:hover :deep(.el-button__wrapper) {
  background-color: var(--el-fill-color-lighter);
  border-color: var(--color-black-20);
  color: var(--color-gray-303133);
  cursor: pointer;
  pointer-events: auto;
}

.agreement-confirm-footer .agreement-cancel-button:active {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--color-neutral-100);
  border-color: var(--color-black-25);
}

.agreement-confirm-footer .agreement-cancel-button:active :deep(.el-button__inner),
.agreement-confirm-footer .agreement-cancel-button:active :deep(.el-button__wrapper) {
  background-color: var(--color-neutral-100);
  border-color: var(--color-black-25);
  cursor: pointer;
  pointer-events: auto;
}

/* 暗色模式下的取消按钮 - 纯白色背景，纯黑色文在*/
:where(html.dark) .agreement-confirm-footer .agreement-cancel-button,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--color-dark-bg-6);
  border: var(--unified-border);
}

:where(html.dark) .agreement-confirm-footer .agreement-cancel-button :deep(.el-button__inner),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button :deep(.el-button__inner) {
  background-color: var(--color-dark-bg-6);
  border: var(--unified-border);
  color: var(--el-border-color-lighter);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: none;
}

:where(html.dark) .agreement-confirm-footer .agreement-cancel-button:hover,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--el-text-color-primary);
  border-color: var(--color-white-30);
}

:where(html.dark) .agreement-confirm-footer .agreement-cancel-button:hover :deep(.el-button__inner),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover :deep(.el-button__inner) {
  background-color: var(--el-text-color-primary);
  border-color: var(--color-white-30);
  color: var(--color-gray-e5eaf3);
  cursor: pointer;
  pointer-events: auto;
}

:where(html.dark) .agreement-confirm-footer .agreement-cancel-button:active,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
}

:where(html.dark) .agreement-confirm-footer .agreement-cancel-button:active :deep(.el-button__inner),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active :deep(.el-button__inner) {
  background-color: var(--color-gray-ebebeb);
  color: var(--el-text-color-primary);
  cursor: pointer;
  pointer-events: auto;
}

/* 同意按钮样式 - 扁平化设计：使用边框和背景，无阴在*/
.agreement-confirm-footer .agreement-agree-button {
  min-width: 120px;
  width: 120px;
  height: 36px;
  border-radius: var(--global-border-radius);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  pointer-events: auto;
  position: relative;
  z-index: calc(var(--z-base) + 9);
  opacity: 1;
  margin: 0;
  box-shadow: none;
  background-color: var(--el-color-primary);
  border: var(--unified-border);
  color: var(--el-bg-color);
  padding: 0;
}

.agreement-confirm-footer .agreement-agree-button :deep(.el-button__inner),
.agreement-confirm-footer .agreement-agree-button :deep(.el-button__wrapper) {
  background-color: var(--el-color-primary);
  border: var(--unified-border);
  color: var(--el-bg-color);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  cursor: pointer;
  pointer-events: auto;
  width: 100%;
  height: 100%;
  font-weight: 600;
  box-shadow: none;
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 确保按钮文本元素在黑色背景时为纯白色 */
.agreement-confirm-footer .agreement-agree-button :deep(.el-button__text),
.agreement-confirm-footer .agreement-agree-button :deep(span),
.agreement-confirm-footer .agreement-agree-button :deep(*) {
  color: var(--el-bg-color);
}

.agreement-confirm-footer .agreement-agree-button:disabled,
.agreement-confirm-footer .agreement-agree-button.is-disabled {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
}

:where(.agreement-confirm-footer) .agreement-agree-button:disabled :deep(.el-button__inner),
:where(.agreement-confirm-footer) .agreement-agree-button.is-disabled :deep(.el-button__inner) {
  cursor: pointer;
  pointer-events: auto;
  opacity: 1;
  background-color: var(--el-color-primary);
  color: var(--el-bg-color);
}

/* 明亮模式下的同意按钮 - hover时边框和背景变深 */
.agreement-confirm-footer .agreement-agree-button:hover {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--color-dark-bg-3);
  border-color: var(--color-dark-bg-3);
  color: var(--el-bg-color);
}

/* 确保 hover 时文本元素保持纯白色 */
.agreement-confirm-footer .agreement-agree-button:hover :deep(.el-button__text),
.agreement-confirm-footer .agreement-agree-button:hover :deep(span),
.agreement-confirm-footer .agreement-agree-button:hover :deep(*) {
  color: var(--el-bg-color);
}

.agreement-confirm-footer .agreement-agree-button:hover :deep(.el-button__inner),
.agreement-confirm-footer .agreement-agree-button:hover :deep(.el-button__wrapper) {
  background-color: var(--color-dark-bg-3);
  border-color: var(--color-dark-bg-3);
  color: var(--el-bg-color);
  cursor: pointer;
  pointer-events: auto;
}

.agreement-confirm-footer .agreement-agree-button:active {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--color-gray-0d0d0d);
  border-color: var(--color-gray-0d0d0d);
  color: var(--el-bg-color);
}

/* 确保 active 时文本元素保持纯白色 */
.agreement-confirm-footer .agreement-agree-button:active :deep(.el-button__text),
.agreement-confirm-footer .agreement-agree-button:active :deep(span),
.agreement-confirm-footer .agreement-agree-button:active :deep(*) {
  color: var(--el-bg-color);
}

.agreement-confirm-footer .agreement-agree-button:active :deep(.el-button__inner),
.agreement-confirm-footer .agreement-agree-button:active :deep(.el-button__wrapper) {
  background-color: var(--color-gray-0d0d0d);
  border-color: var(--color-gray-0d0d0d);
  cursor: pointer;
  pointer-events: auto;
}

/* 暗色模式下的同意按钮 - 纯白色背景，纯黑色文在*/
:where(html.dark) .agreement-confirm-footer .agreement-agree-button,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  color: var(--el-text-color-primary);
}

:where(html.dark) .agreement-confirm-footer .agreement-agree-button :deep(.el-button__inner),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button :deep(.el-button__inner) {
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  color: var(--el-text-color-primary);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: none;
}

/* 针对作用域样式中的按钮内部文本元在*/
:where(html.dark) .agreement-confirm-footer .agreement-cancel-button :deep(.el-button__text),
:where(html.dark) .agreement-confirm-footer .agreement-cancel-button :deep(span),
:where(html.dark) .agreement-confirm-footer .agreement-agree-button :deep(.el-button__text),
:where(html.dark) .agreement-confirm-footer .agreement-agree-button :deep(span),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button :deep(.el-button__text),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button :deep(span),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button :deep(.el-button__text),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button :deep(span),
:where(html.dark) .agreement-confirm-footer .agreement-cancel-button :deep(*),
:where(html.dark) .agreement-confirm-footer .agreement-agree-button :deep(*),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button :deep(*),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button :deep(*) {
  color: var(--el-text-color-primary);
}

/* 覆盖 Element Plus 的默认按钮类型样在*/
:where(html.dark) .agreement-confirm-footer .agreement-agree-button.el-button--primary,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary {
  background-color: var(--el-bg-color);
  border-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary :deep(.el-button__inner),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary :deep(.el-button__inner) {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

:where(html.dark) .agreement-confirm-footer .agreement-agree-button:hover,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
  background-color: var(--el-fill-color-light);
  border-color: var(--el-fill-color-light);
}

:where(html.dark) .agreement-confirm-footer .agreement-agree-button:hover :deep(.el-button__inner),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover :deep(.el-button__inner) {
  background-color: var(--el-fill-color-light);
  border-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  cursor: pointer;
  pointer-events: auto;
}

:where(html.dark) .agreement-confirm-footer .agreement-agree-button:active,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active {
  opacity: 1;
  cursor: pointer;
  pointer-events: auto;
}

:where(html.dark) .agreement-confirm-footer .agreement-agree-button:active :deep(.el-button__inner),
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active :deep(.el-button__inner) {
  background-color: var(--color-gray-ebebeb);
  color: var(--el-text-color-primary);
  cursor: pointer;
  pointer-events: auto;
}
</style>

<!-- 全局样式 - 用于 teleported 在body 的下拉菜在-->
<style lang="scss">
/* 验证码方块样在- 使用全局样式确保生效 */
.login-content.login-page input.verification-code-digit {
  border: 2px solid var(--border-unified-color);
  border-radius: var(--global-border-radius);
  background-color: var(--color-neutral-100);
  background: var(--color-neutral-100);
  box-shadow: none;
}

:where(.login-content.login-page) input.verification-code-digit:hover {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background-color: var(--el-bg-color);
}

:where(.login-content.login-page) input.verification-code-digit:focus {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background-color: var(--el-bg-color);
  outline: none;
}

/* 暗色模式：与亮色选择器同结构，确保覆在*/
:where(.login-content.login-page.dark-mode) .phone-form-container .verification-code-inputs input.verification-code-digit,
:where(.login-content.login-page.dark-mode) .verification-code-inputs input.verification-code-digit,
:where(.login-content.login-page.dark-mode) input.verification-code-digit {
  border: var(--unified-border);
  background-color: var(--color-white-5);
  background: var(--color-white-5);
  color: var(--el-text-color-primary);
}

:where(.login-content.login-page.dark-mode .phone-form-container .verification-code-inputs) input.verification-code-digit:hover,
:where(.login-content.login-page.dark-mode) .verification-code-inputs input.verification-code-digit:hover,
:where(.login-content.login-page.dark-mode) input.verification-code-digit:hover,
:where(.login-content.login-page.dark-mode .phone-form-container .verification-code-inputs) input.verification-code-digit:focus,
:where(.login-content.login-page.dark-mode) .verification-code-inputs input.verification-code-digit:focus,
:where(.login-content.login-page.dark-mode) input.verification-code-digit:focus {
  border: 2px solid var(--el-color-primary-light-3);
  background-color: var(--el-fill-color-dark);
  background: var(--el-fill-color-dark);
}

/* 国家代码选择器下拉菜单全局样式 */
/* 由于使用在:teleported="true"，下拉菜单渲染到 body，需要全局样式 */
.country-code-popper {
  max-height: 300px;
  border-radius: var(--global-border-radius);
  box-shadow: none;
  /* 无投在*/
  z-index: var(--z-notification);
  background: var(--el-bg-color);
  border: var(--unified-border);
  overflow: hidden;
  /* 裁剪内容以显示圆在*/
  padding: 0;
  margin: 0;
  min-width: 200px;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;

  /* 隐藏左上角的三角形箭在*/
  .el-popper__arrow {
    display: none;
  }

  &[data-popper-placement]::before,
  &[data-popper-placement]::after {
    display: none;
  }

  .el-select-dropdown {
    background: var(--el-bg-color);
    border: none;
    box-shadow: none;
    padding: 0;
    margin: 0;
    border-radius: var(--global-border-radius);
  }

  /* 移除顶部多余的容器或线条 */
  .el-select-dropdown__wrap,
  .el-scrollbar__wrap {
    padding-top: 0;
    margin-top: 0;
    border-top: none;
  }

  .el-select-dropdown__list {
    padding-top: 0;
    margin-top: 0;
    border-top: none;
  }

  /* 确保第一个选项没有额外的上边距 */
  .el-select-dropdown__item:first-child {
    margin-top: 0;
    padding-top: 8px;
    border-radius: var(--global-border-radius);
    /* 顶部圆角 */
  }

  /* 确保最后一个选项有底部圆在*/
  .el-select-dropdown__item:last-child {
    border-radius: var(--global-border-radius);
  }

  .el-select-dropdown__wrap,
  .el-scrollbar__wrap {
    max-height: 300px;
    overflow-y: auto;
    border: none;
  }

  .el-scrollbar,
  .el-scrollbar__bar,
  .el-scrollbar__thumb,
  .el-select-dropdown__list {
    border: none;
  }

  .el-select-dropdown__item {
    padding: 8px 12px;
    height: auto;
    min-height: 36px;
    line-height: 1.4;
    transition: background-color 0.2s ease, color 0.2s ease, font-weight 0.2s ease;
    display: flex;
    align-items: center;
    cursor: pointer;
    background-color: var(--el-bg-color);
    color: var(--el-text-color-primary);
    border: none;

    &:hover {
      background-color: var(--el-bg-color-page);
    }

    &.selected,
    &.is-selected {
      background-color: var(--el-bg-color-page);
      color: var(--el-text-color-primary);
      font-weight: 500;
    }

    .country-option {
      gap: 0;
      margin: 0;
      padding: 0;
      justify-content: space-between;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .country-name {
      margin-right: 8px;
      flex: 1;
      font-size: 12px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    .country-dial {
      margin-left: 8px;
      text-align: right;
      min-width: 50px;
      font-size: 12px;
      font-weight: 500;
      color: var(--el-text-color-secondary);
    }
  }
}

/* 暗色模式下的国家代码下拉菜单样式 */
:where(html.dark) .country-code-popper {
  background: var(--el-bg-color);
  box-shadow: none;
  /* 无投在*/
  border: var(--unified-border);

  .el-select-dropdown {
    background: var(--el-bg-color);
  }

  .el-select-dropdown__item {
    background-color: var(--el-bg-color);
    color: var(--el-text-color-primary);

    &:hover {
      background-color: var(--el-bg-color-page);
    }

    &.selected,
    &.is-selected {
      background-color: var(--el-bg-color-page);
      color: var(--el-text-color-primary);
    }

    .country-name {
      color: var(--el-text-color-primary);
    }

    .country-dial {
      color: var(--el-text-color-secondary);
    }
  }
}

/* ============================================
   协议确认弹窗全局样式 - 因为使用在append-to-body
   遵循项目规范：圆在0px、无描边、黑白灰配色
   ============================================ */

/* 弹窗遮罩在- 黑白灰配在*/
:where(body) .el-overlay:has(.agreement-confirm-dialog-wrapper .el-dialog) {
  background-color: var(--color-black-50);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

:where(html.dark) :where(body) .el-overlay:has(.agreement-confirm-dialog-wrapper .el-dialog) {
  background-color: var(--color-black-70);
}

/* 确保 overlay-dialog 容器居中 - 使用更强的选择在*/
:where(body) .el-overlay-dialog:has(.agreement-confirm-dialog-wrapper .el-dialog),
:where(html, body) .el-overlay-dialog:has(.agreement-confirm-dialog-wrapper .el-dialog),
.el-overlay-dialog:has(.agreement-confirm-dialog-wrapper),
:where(body) .el-overlay:has(.agreement-confirm-dialog-wrapper) .el-overlay-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

/* 全局样式：亮色模式下协议确认对话框同意按在- 纯黑色背景，白色文字（高优先级覆在dialog.scss在*/
.agreement-confirm-dialog-wrapper .el-dialog__footer .agreement-agree-button,
.agreement-confirm-dialog-wrapper .el-dialog__footer button.agreement-agree-button,
button.agreement-agree-button,
button.agreement-agree-button.el-button,
button.agreement-agree-button.el-button--large,
.agreement-confirm-footer button.agreement-agree-button,
.agreement-confirm-footer .agreement-agree-button,
.el-dialog__footer button.agreement-agree-button,
.el-dialog__footer .agreement-agree-button {
  min-width: 120px;
  width: 120px;
  height: 44px;
  background: var(--el-color-primary);
  border: var(--unified-border);
  color: var(--color-on-primary);
  border-radius: var(--global-border-radius);
}

:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-agree-button .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-agree-button .el-button__wrapper,
button.agreement-agree-button .el-button__inner,
button.agreement-agree-button .el-button__wrapper,
.agreement-confirm-footer button.agreement-agree-button .el-button__inner,
.agreement-confirm-footer button.agreement-agree-button .el-button__wrapper {
  background: var(--el-color-primary);
  color: var(--color-on-primary);
}

:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-agree-button *,
button.agreement-agree-button *,
.agreement-confirm-footer button.agreement-agree-button * {
  color: var(--color-on-primary);
  -webkit-text-fill-color: var(--color-on-primary);
}

.agreement-confirm-dialog-wrapper .el-dialog__footer .agreement-agree-button:hover,
button.agreement-agree-button:hover,
.agreement-confirm-footer button.agreement-agree-button:hover {
  background: var(--el-color-primary-dark-2);
  border-color: var(--el-color-primary-dark-2);
}

:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-agree-button:hover .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-agree-button:hover .el-button__wrapper,
button.agreement-agree-button:hover .el-button__inner,
button.agreement-agree-button:hover .el-button__wrapper,
.agreement-confirm-footer button.agreement-agree-button:hover .el-button__inner,
.agreement-confirm-footer button.agreement-agree-button:hover .el-button__wrapper {
  background: var(--el-color-primary-dark-2);
  color: var(--color-on-primary);
}

/* 亮色模式：协议弹窗取消按钮描边适配（覆在dialog.scss，保证边框一致可见） */
.agreement-confirm-dialog-wrapper .el-dialog__footer .agreement-cancel-button,
.agreement-confirm-dialog-wrapper .el-dialog__footer button.agreement-cancel-button {
  min-width: 120px;
  width: 120px;
  height: 44px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-regular);
}

:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-cancel-button .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-cancel-button .el-button__wrapper,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer button.agreement-cancel-button .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer button.agreement-cancel-button .el-button__wrapper {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-regular);
}

.agreement-confirm-dialog-wrapper .el-dialog__footer .agreement-cancel-button:hover,
.agreement-confirm-dialog-wrapper .el-dialog__footer button.agreement-cancel-button:hover {
  background: var(--el-fill-color-light);
  border-color: var(--color-black-24);
}

:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-cancel-button:hover .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-cancel-button:hover .el-button__wrapper,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer button.agreement-cancel-button:hover .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer button.agreement-cancel-button:hover .el-button__wrapper {
  background: var(--el-fill-color-light);
  border-color: var(--color-black-24);
  color: var(--el-text-color-primary);
}

.agreement-confirm-dialog-wrapper .el-dialog__footer .agreement-cancel-button:active,
.agreement-confirm-dialog-wrapper .el-dialog__footer button.agreement-cancel-button:active {
  background: var(--el-fill-color);
  border-color: var(--color-black-30);
}

:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-cancel-button:active .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-cancel-button:active .el-button__wrapper,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer button.agreement-cancel-button:active .el-button__inner,
:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer button.agreement-cancel-button:active .el-button__wrapper {
  background: var(--el-fill-color);
  border-color: var(--color-black-30);
  color: var(--el-text-color-primary);
}

/* 暗色模式：取在描边浅色字，同意=白底黑字（主操作在*/
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button {
  min-width: 160px;
  width: 160px;
  height: 44px;
  background: transparent;
  border: var(--unified-border);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button .el-button__inner,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button .el-button__wrapper,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button .el-button__wrapper,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button .el-button__inner {
  background: transparent;
  border-color: transparent;
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button {
  min-width: 160px;
  width: 160px;
  height: 44px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button .el-button__inner,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button .el-button__inner {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

/* 暗色下：取消按钮内浅色字，同意按钮内黑色在*/
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button *,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button * {
  color: var(--el-text-color-primary);
  -webkit-text-fill-color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button *,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button * {
  color: var(--el-text-color-primary);
  -webkit-text-fill-color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:hover,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:hover {
  background: var(--color-white-8);
  border-color: var(--color-white-50);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:hover,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover .el-button__inner,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover .el-button__wrapper,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:hover .el-button__inner {
  background: var(--color-white-8);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover .el-button__inner,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:hover .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:hover .el-button__inner {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:hover *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:hover * {
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:hover *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:hover * {
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:active,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:active {
  background: var(--color-white-12);
  border-color: var(--color-white-50);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:active,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:active {
  background: var(--el-fill-color);
  border-color: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active .el-button__inner,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:active .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:active .el-button__inner {
  background: var(--color-white-12);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active .el-button__inner,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:active .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:active .el-button__inner {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-cancel-button:active *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-cancel-button:active * {
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer .agreement-agree-button:active *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button:active * {
  color: var(--el-text-color-primary);
}

/* 覆盖 Element Plus 的默认按钮类型样在*/
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button.el-button--primary,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button.agreement-agree-button.el-button--primary {
  background-color: var(--el-bg-color);
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary .el-button__inner,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button:where(.agreement-agree-button.el-button--primary) .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary .el-button__inner,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button:where(.agreement-agree-button.el-button--primary) .el-button__inner {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary *,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button:where(.agreement-agree-button.el-button--primary) .el-button__text,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button:where(.agreement-agree-button.el-button--primary) span,
:where(html.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button:where(.agreement-agree-button.el-button--primary) *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) :where(.agreement-confirm-footer) .agreement-agree-button.el-button--primary *,
:where(body.dark) :where(.agreement-confirm-dialog-wrapper) .agreement-confirm-footer button:where(.agreement-agree-button.el-button--primary) * {
  color: var(--el-text-color-primary);
}

/* 明亮模式 - 弹窗容器（圆在0px，无描边，使用背景色区分在*/
/* 使用 Element Plus 原生 center 定位，使用 CSS 变量控制 */
.agreement-confirm-dialog-wrapper :deep(.el-dialog),
.agreement-confirm-dialog-wrapper.el-dialog,
.el-overlay-dialog .agreement-confirm-dialog-wrapper.el-dialog,
.el-overlay .agreement-confirm-dialog-wrapper.el-dialog,
:where(body) .el-overlay-dialog .agreement-confirm-dialog-wrapper.el-dialog,
:where(html, body) .el-overlay-dialog .agreement-confirm-dialog-wrapper.el-dialog {
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  border: none;
  box-shadow: none;
  margin: 0;
  z-index: var(--z-modal);
  pointer-events: auto;
}

.agreement-confirm-dialog-wrapper .el-dialog * {
  pointer-events: auto;
}

/* 使用单类确保标题居中，使用 CSS 变量控制 */
.agreement-confirm-dialog-wrapper .el-dialog__header,
.agreement-confirm-dialog-wrapper :deep(.el-dialog__header),
.el-overlay-dialog .agreement-confirm-dialog-wrapper .el-dialog__header,
:where(body) .el-overlay-dialog .agreement-confirm-dialog-wrapper .el-dialog__header {
  padding: 16px 20px 8px;
  border: none;
  margin-bottom: 0;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.agreement-confirm-dialog-wrapper .el-dialog__title,
.agreement-confirm-dialog-wrapper :deep(.el-dialog__title),
.agreement-confirm-dialog-wrapper .el-dialog__header .el-dialog__title,
.el-overlay-dialog .agreement-confirm-dialog-wrapper .el-dialog__title,
:where(body) .el-overlay-dialog .agreement-confirm-dialog-wrapper .el-dialog__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-gray-303133);
  line-height: 1.4;
  text-align: center;
  width: 100%;
  display: block;
}

.agreement-confirm-dialog-wrapper .el-dialog__body {
  padding: 12px 20px;
  color: var(--el-text-color-regular);
}

.agreement-confirm-dialog-wrapper .el-dialog__footer {
  padding: 12px 20px 16px;
  border: none;
  border-radius: var(--global-border-radius);
  position: relative;
  z-index: var(--z-header);
  pointer-events: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  overflow: visible;
}

/* 确保协议弹窗 footer 内两个按钮都可见、不被裁在*/
:where(.agreement-confirm-dialog-wrapper) :where(.el-dialog__footer) .agreement-confirm-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  overflow: visible;
}

:where(.agreement-confirm-dialog-wrapper) .el-dialog__footer .agreement-confirm-footer .el-button {
  flex-shrink: 0;
  visibility: visible;
  opacity: 1;
}

.agreement-confirm-dialog-wrapper .el-dialog__footer * {
  pointer-events: auto;
}

/* 暗色模式 - 弹窗与内容区统一深色背景、浅色字 */
:where(html.dark) .agreement-confirm-dialog-wrapper .el-dialog,
:where(body.dark) .agreement-confirm-dialog-wrapper .el-dialog {
  background-color: var(--el-bg-color);
  border: none;
  box-shadow: none;
}

:where(html.dark) .agreement-confirm-dialog-wrapper .el-dialog__header,
:where(body.dark) .agreement-confirm-dialog-wrapper .el-dialog__header {
  border: none;
  padding: 16px 20px 8px;
}

:where(html.dark) .agreement-confirm-dialog-wrapper .el-dialog__title,
:where(html.dark) .agreement-confirm-dialog-wrapper :deep(.el-dialog__title),
:where(html.dark) .agreement-confirm-dialog-wrapper .el-dialog__header .el-dialog__title,
:where(html.dark) .el-overlay-dialog .agreement-confirm-dialog-wrapper .el-dialog__title,
:where(html.dark) :where(body) .el-overlay-dialog .agreement-confirm-dialog-wrapper .el-dialog__title,
:where(body.dark) .agreement-confirm-dialog-wrapper .el-dialog__title,
:where(body.dark) .agreement-confirm-dialog-wrapper .el-dialog__header .el-dialog__title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  text-align: center;
  width: 100%;
  display: block;
}

:where(html.dark) .agreement-confirm-dialog-wrapper .el-dialog__body,
:where(body.dark) .agreement-confirm-dialog-wrapper .el-dialog__body {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  padding: 12px 20px;
}

:where(html.dark) .agreement-confirm-dialog-wrapper .el-dialog__footer {
  border: none;
  position: relative;
  z-index: var(--z-header);
  pointer-events: auto;
  padding: 16px 24px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

:where(html.dark) .agreement-confirm-dialog-wrapper .el-dialog__footer * {
  pointer-events: auto;
}

/* 全局样式：确保账号表单输入框背景色显在- 不使在scoped，确保优先级最在*/
:where(.login-form) .el-form-item[prop='username'] .el-form-item__content,
:where(.login-form) .el-form-item[prop='password'] .el-form-item__content,
:where(.login-form) .el-form-item[prop='email'] .el-form-item__content,
:where(.login-form) .el-form-item[prop='phone'] .el-form-item__content,
:where(.login-form) .el-form-item[prop='code'] .el-form-item__content {
  background-color: var(--color-neutral-100);
  background: var(--color-neutral-100);
  box-shadow: none;
}

:where(.login-form) .el-form-item[prop='username'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-form) .el-form-item[prop='password'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-form) .el-form-item[prop='email'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-form) .el-form-item[prop='phone'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-form) .el-form-item[prop='code'] :where(.el-form-item__content) .el-input__wrapper {
  background-color: transparent;
  background: transparent;
  box-shadow: none;
}

/* 暗色模式 */
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='username'] .el-form-item__content,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='password'] .el-form-item__content,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='email'] .el-form-item__content,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='phone'] .el-form-item__content,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='code'] .el-form-item__content {
  background-color: var(--color-dark-bg-6);
  background: var(--color-dark-bg-6);
  box-shadow: none;
}

:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='username'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='password'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='email'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='phone'] :where(.el-form-item__content) .el-input__wrapper,
:where(.login-content.login-page.dark-mode) :where(.login-form) .el-form-item[prop='code'] :where(.el-form-item__content) .el-input__wrapper {
  background-color: transparent;
  background: transparent;
  box-shadow: none;
}

/* ============================================
   协议确认对话框样式 - 使用 Element Plus 原生 center 定位
   使用单类或 :where() 控制优先级
   ============================================ */

/* 微信登录对话在- 使用单类，禁止高特异在*/
:where(.el-overlay .el-overlay-dialog) .el-dialog.wechat-qr-dialog {
  border-radius: var(--global-border-radius);
  overflow: hidden;
  --el-dialog-padding-primary: 0;
}

:where(.el-overlay .el-overlay-dialog) .el-dialog.wechat-qr-dialog .el-dialog__header {
  display: none;
  padding: 0;
  margin: 0;
}

:where(.el-overlay .el-overlay-dialog) .el-dialog.wechat-qr-dialog .el-dialog__body {
  padding: 0;
}

#wechat-qrcode-container {
  background-color: var(--el-text-color-primary);
}

#wechat-qrcode-container iframe {
  border: none;
  display: block;
  background-color: var(--el-text-color-primary);
}

:where(html.dark) .wechat-qrcode-container {
  background-color: var(--el-text-color-primary);
}

:where(html.dark) .wechat-login-tip {
  color: var(--el-border-color-lighter);
}

/* ========================================
   登录按钮样式 - 使用单类 / :deep 覆盖，禁止高特异性
   使用单类或 :where() 控制优先级
   ======================================== */

/* 亮色模式 - 登录按钮（单在/ :deep，禁止高特异性） */
:where(#app) :where(.login-content.login-page) :where(.login-actions-container) button.el-button.el-button--primary:where(.login-button),
:where(#app) :where(.login-content.login-page) button.el-button.el-button--primary:where(.login-button),
:where(.app-container) :where(.login-content.login-page) :where(.login-button).el-button.el-button--primary {
  background: var(--el-color-primary);
  background-color: var(--el-color-primary);
  color: var(--el-bg-color);
  border: none;
  box-shadow: none;
}

:where(#app) :where(.login-content.login-page) :where(.login-actions-container) button.el-button.el-button--primary:where(.login-button) span,
:where(#app) :where(.login-content.login-page) button.el-button.el-button--primary:where(.login-button) span,
:where(.app-container) :where(.login-content.login-page) :where(.login-button).el-button.el-button--primary span {
  color: var(--el-bg-color);
  -webkit-text-fill-color: var(--el-bg-color);
}

/* 亮色模式 - 登录按钮 hover 状在*/
:where(#app) :where(.login-content.login-page) :where(.login-actions-container) button.el-button.el-button--primary:where(.login-button):hover,
:where(#app) :where(.login-content.login-page) button.el-button.el-button--primary:where(.login-button):hover,
:where(.app-container) :where(.login-content.login-page) :where(.login-button).el-button.el-button--primary:hover {
  background: var(--el-color-primary);
  background-color: var(--el-color-primary);
  color: var(--el-bg-color);
  opacity: 0.9;
}

/* 暗色模式 - 登录按钮（单在/ :deep在 白色背景黑色文字 */
:where(html.dark) body :where(#app) :where(.login-content.login-page) :where(.login-actions-container) button.el-button.el-button--primary:where(.login-button),
:where(html.dark) body :where(#app) :where(.login-content.login-page) button.el-button.el-button--primary:where(.login-button),
:where(html.dark) body :where(.app-container) :where(.login-content.login-page) :where(.login-button).el-button.el-button--primary {
  background: var(--el-bg-color);
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border: none;
  box-shadow: none;
}

:where(html.dark) body :where(#app) :where(.login-content.login-page) :where(.login-actions-container) button.el-button.el-button--primary:where(.login-button) span,
:where(html.dark) body :where(#app) :where(.login-content.login-page) button.el-button.el-button--primary:where(.login-button) span,
:where(html.dark) body :where(.app-container) :where(.login-content.login-page) :where(.login-button).el-button.el-button--primary span {
  color: var(--el-text-color-primary);
  -webkit-text-fill-color: var(--el-text-color-primary);
}

/* 暗色模式 - 登录按钮 hover 状在*/
:where(html.dark) body :where(#app) :where(.login-content.login-page) :where(.login-actions-container) button.el-button.el-button--primary:where(.login-button):hover,
:where(html.dark) body :where(#app) :where(.login-content.login-page) button.el-button.el-button--primary:where(.login-button):hover,
:where(html.dark) body :where(.app-container) :where(.login-content.login-page) :where(.login-button).el-button.el-button--primary:hover {
  background: var(--color-neutral-100);
  background-color: var(--color-neutral-100);
  color: var(--el-text-color-primary);
  opacity: 0.9;
}
</style>
