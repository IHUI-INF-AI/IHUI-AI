export {
  useAuthStore,
  useTokenStore,
  useUserStore,
  useWalletStore,
  useVipStore,
  usePermissionsStore,
  useThirdPartyStore,
} from './auth/index'

export type {
  RawUserInfo,
  LoginResponseData,
  AuthState,
  ThirdPartyLoginData,
  UserInfoData,
  UserFundInfo,
  UserVipInfo,
} from './auth/types'

// Re-export shared-logic useUser composable for cross-platform use
export { useUser as useSharedUser } from '@aizhs/shared-logic'
