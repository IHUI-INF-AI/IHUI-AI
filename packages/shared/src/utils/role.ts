/**
 * 用户角色标签(跨端统一:mobile-rn/UserInfoCard 共用)。
 * isVip: 1=VIP, 0=普通;identityType: 1=操盘手, 2=会员, 其他=普通用户
 * 逻辑依据 mobile-rn/UserInfoCard.tsx 原始实现:isVip===1 且 identityType===1 → 操盘手;isVip===1 → 会员。
 */
export function getRoleLabel(isVip?: number, identityType?: number): string {
  if (isVip === 1 && identityType === 1) return '操盘手'
  if (isVip === 1) return '会员'
  return '普通用户'
}
