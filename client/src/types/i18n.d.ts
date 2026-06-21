import 'vue-i18n'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage {
    messages?: {
      formRefNotFound?: string
      checkFormInput?: string
      operationFailed?: string
      networkError?: string
      timeout?: string
      defaultSuccess?: string
      loginRequired?: string
      adminRequired?: string
    }
    formValidation?: {
      required?: string
      email?: string
      phone?: string
      url?: string
      number?: string
      numberRange?: string
      numberMin?: string
      numberMax?: string
      stringLength?: string
      positiveNumber?: string
      agentName?: string
      agentNameLength?: string
      agentId?: string
      agentIdLength?: string
      categoryRequired?: string
      modelName?: string
      modelNameLength?: string
      modelId?: string
      modelIdLength?: string
      providerRequired?: string
      maxTokensRequired?: string
      temperatureRange?: string
      username?: string
      usernameLength?: string
      usernamePattern?: string
      emailRequired?: string
      phoneRequired?: string
      passwordRequired?: string
      passwordLength?: string
    }
    errorHandler?: {
      httpErrors?: {
        [key: number]: string
      }
      networkError?: string
      confirmAction?: string
      deleteConfirm?: string
      confirmDelete?: string
      batchDeleteConfirm?: string
      confirmBatchDelete?: string
    }
    common?: {
      confirm?: string
      cancel?: string
    }
  }
}
