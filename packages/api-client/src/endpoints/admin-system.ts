/**
 * B 端系统管�?API
 * 对接后端 admin-sys.ts / rbac.ts / admin.ts,覆盖 user/role/menu/dept/config/post/notice/dict/logininfor/operlog 模块�? */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 类型定义 =====================

export interface SysUser {
  id: string
  username?: string
  nickname: string
  avatar?: string | null
  email?: string | null
  phone?: string | null
  status: number
  roleId?: number
  deptId?: string | number
  remark?: string
  createdAt: string
  lastLoginAt?: string | null
  [key: string]: unknown
}

export interface SysRole {
  id: string
  name: string
  displayName: string
  description?: string | null
  scope?: 'none' | 'self' | 'team' | 'org' | 'all'
  isSystem?: boolean
  roleId?: number
  roleKey?: string
  roleSort?: number
  dataScope?: string
  status?: string
  createdAt?: string
  [key: string]: unknown
}

export interface SysMenu {
  id: string
  menuId?: string
  menuName?: string
  parentId?: string
  orderNum?: number
  path?: string
  component?: string
  menuType?: 'M' | 'C' | 'F'
  visible?: string
  status?: string
  perms?: string
  icon?: string
  isFrame?: boolean
  isCache?: boolean
  query?: string
  children?: SysMenu[]
  [key: string]: unknown
}

export interface SysDept {
  deptId: number
  parentId?: number
  deptName?: string
  orderNum?: number
  leader?: string
  phone?: string
  email?: string
  status?: string
  ancestors?: string
  children?: SysDept[]
  [key: string]: unknown
}

export interface SysConfig {
  configId: number
  configName?: string
  configKey?: string
  configValue?: string
  configType?: string
  remark?: string
  [key: string]: unknown
}

export interface SysPost {
  postId: number
  postCode?: string
  postName?: string
  postSort?: number
  status?: string
  remark?: string
  [key: string]: unknown
}

export interface SysNotice {
  noticeId: number
  noticeTitle: string
  noticeType: string
  noticeContent?: string
  status?: string
  createBy?: string
  remark?: string
  [key: string]: unknown
}

export interface SysDictType {
  dictId: number
  dictName?: string
  dictType?: string
  status?: string
  remark?: string
  [key: string]: unknown
}

export interface SysDictData {
  dictCode: number
  dictSort?: number
  dictLabel?: string
  dictValue?: string
  dictType?: string
  cssClass?: string
  listClass?: string
  isDefault?: string
  status?: string
  remark?: string
  [key: string]: unknown
}

export interface SysLogininfor {
  infoId?: number
  loginName?: string
  ipaddr?: string
  loginLocation?: string
  browser?: string
  os?: string
  status?: string
  msg?: string
  loginTime?: string
  [key: string]: unknown
}

export interface SysOperlog {
  operId?: number
  title?: string
  businessType?: number
  method?: string
  requestMethod?: string
  operatorType?: number
  operName?: string
  deptName?: string
  operUrl?: string
  operIp?: string
  operLocation?: string
  operParam?: string
  jsonResult?: string
  status?: string
  errorMsg?: string
  operTime?: string
  costTime?: number
  [key: string]: unknown
}

export interface MenuTreeSelect {
  menus: SysMenu[]
  checkedKeys?: string[]
  roleId?: string
}

export interface DeptTreeSelect {
  depts: SysDept[]
  checkedKeys?: number[]
}

export interface AuthRoleResult {
  user: SysUser
  roles: SysRole[]
  roleIds: string[]
}

// ===================== user 模块 =====================

export interface SysUserListQuery extends PageQuery {
  search?: string
  username?: string
  phone?: string
  email?: string
  status?: number
  role?: number
  deptId?: string | number
}

export async function listUsers(
  params: SysUserListQuery = {},
): Promise<ApiResult<PageData<SysUser>>> {
  return fetchApi<PageData<SysUser>>(`/api/admin/users${buildQs(params)}`)
}

export async function getUser(id: string): Promise<ApiResult<SysUser>> {
  return fetchApi<SysUser>(`/api/admin/users/${id}`)
}

export async function addUser(
  body: Partial<SysUser> & { nickname: string; password: string },
): Promise<ApiResult<SysUser>> {
  return fetchApi<SysUser>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateUser(
  id: string,
  body: { role?: number; status?: number },
): Promise<ApiResult<SysUser>> {
  return fetchApi<SysUser>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function delUser(id: string): Promise<ApiResult<SysUser>> {
  return fetchApi<SysUser>(`/api/admin/users/${id}`, { method: 'DELETE' })
}

export async function resetUserPwd(
  userId: string,
  password: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/users/resetPwd', {
    method: 'PUT',
    body: JSON.stringify({ userId, password }),
  })
}

export async function changeUserStatus(
  userId: string,
  status: number,
): Promise<ApiResult<SysUser>> {
  return fetchApi<SysUser>(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getUserProfile(): Promise<ApiResult<SysUser>> {
  return fetchApi<SysUser>('/api/auth/profile')
}

export async function updateUserProfile(data: Partial<SysUser>): Promise<ApiResult<SysUser>> {
  return fetchApi<SysUser>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function updateUserPwd(
  oldPassword: string,
  newPassword: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/profile/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}

export async function uploadAvatar(data: FormData): Promise<ApiResult<{ avatar: string }>> {
  return fetchApi<{ avatar: string }>('/api/users/avatar', {
    method: 'POST',
    body: data,
  })
}

export async function getAuthRole(userId: string): Promise<ApiResult<AuthRoleResult>> {
  return fetchApi<AuthRoleResult>(`/api/users/${userId}/roles`)
}

export async function updateAuthRole(
  userId: string,
  roleId: string,
  scopeResourceId?: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/users/${userId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ roleId, scopeResourceId }),
  })
}

export async function deptTreeSelect(): Promise<ApiResult<SysDept[]>> {
  return fetchApi<SysDept[]>('/api/admin/dept/list')
}

// ===================== role 模块 =====================

export interface SysRoleListQuery extends PageQuery {
  search?: string
  name?: string
  displayName?: string
  scope?: string
  status?: string
}

export async function listRole(
  params: SysRoleListQuery = {},
): Promise<ApiResult<PageData<SysRole>>> {
  return fetchApi<PageData<SysRole>>(`/api/roles${buildQs(params)}`)
}

export async function getRole(
  id: string,
): Promise<ApiResult<{ role: SysRole; permissions: unknown[] }>> {
  return fetchApi<{ role: SysRole; permissions: unknown[] }>(`/api/roles/${id}`)
}

export async function addRole(body: {
  name: string
  displayName: string
  description?: string
  scope?: SysRole['scope']
}): Promise<ApiResult<SysRole>> {
  return fetchApi<SysRole>('/api/roles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateRole(
  id: string,
  body: { displayName?: string; description?: string; scope?: SysRole['scope'] },
): Promise<ApiResult<SysRole>> {
  return fetchApi<SysRole>(`/api/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function dataScope(body: {
  roleId: string | number
  dataScope?: string
  deptIds?: Array<string | number>
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/role/dataScope', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function changeRoleStatus(
  roleId: string | number,
  status: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/role/changeStatus', {
    method: 'PUT',
    body: JSON.stringify({ roleId, status }),
  })
}

export async function delRole(
  roleId: string | number,
): Promise<ApiResult<{ roleId: string | number }>> {
  return fetchApi<{ roleId: string | number }>(`/api/admin/role/${roleId}`, {
    method: 'DELETE',
  })
}

export interface RoleAuthUserQuery extends PageQuery {
  roleId?: string | number
  userName?: string
  phonenumber?: string
}

export async function allocatedUserList(
  params: RoleAuthUserQuery,
): Promise<ApiResult<PageData<SysUser>>> {
  return fetchApi<PageData<SysUser>>(`/api/admin/role/authUser/allocatedList${buildQs(params)}`)
}

export async function unallocatedUserList(
  params: RoleAuthUserQuery,
): Promise<ApiResult<PageData<SysUser>>> {
  return fetchApi<PageData<SysUser>>(`/api/admin/role/authUser/unallocatedList${buildQs(params)}`)
}

export async function authUserCancel(body: {
  roleId: string | number
  userId: string | number
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/role/authUser/cancel', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function authUserCancelAll(params: {
  roleId: string | number
  userIds: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/role/authUser/cancelAll${buildQs(params)}`, {
    method: 'PUT',
  })
}

export async function authUserSelectAll(params: {
  roleId: string | number
  userIds: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/role/authUser/selectAll${buildQs(params)}`, {
    method: 'PUT',
  })
}

export async function roleDeptTreeSelect(
  roleId: string | number,
): Promise<ApiResult<DeptTreeSelect>> {
  return fetchApi<DeptTreeSelect>(`/api/admin/role/deptTree/${roleId}`)
}

// ===================== menu 模块 =====================

export interface SysMenuListQuery {
  menuName?: string
  visible?: string
  status?: string
}

export async function listMenu(
  params: SysMenuListQuery = {},
): Promise<ApiResult<{ list: SysMenu[]; total: number }>> {
  return fetchApi<{ list: SysMenu[]; total: number }>(`/api/admin/sys-menu/list${buildQs(params)}`)
}

export async function getMenu(menuId: string): Promise<ApiResult<SysMenu>> {
  return fetchApi<SysMenu>(`/api/admin/sys-menu/${menuId}`)
}

export async function menuTreeselect(): Promise<ApiResult<{ list: SysMenu[] }>> {
  return fetchApi<{ list: SysMenu[] }>('/api/admin/sys-menu/treeselect')
}

export async function roleMenuTreeselect(
  roleId: string | number,
): Promise<ApiResult<MenuTreeSelect>> {
  return fetchApi<MenuTreeSelect>(`/api/admin/sys-menu/roleMenuTreeselect/${roleId}`)
}

export async function addMenu(body: Omit<SysMenu, 'id' | 'children'>): Promise<ApiResult<SysMenu>> {
  return fetchApi<SysMenu>('/api/admin/sys-menu', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMenu(
  body: Partial<SysMenu> & { menuId: string },
): Promise<ApiResult<SysMenu>> {
  return fetchApi<SysMenu>('/api/admin/sys-menu', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delMenu(menuId: string): Promise<ApiResult<SysMenu>> {
  return fetchApi<SysMenu>(`/api/admin/sys-menu/${menuId}`, { method: 'DELETE' })
}

// ===================== dept 模块 =====================

export interface SysDeptListQuery {
  deptName?: string
  status?: string
}

export async function listDept(
  params: SysDeptListQuery = {},
): Promise<ApiResult<{ list: SysDept[]; total: number }>> {
  return fetchApi<{ list: SysDept[]; total: number }>(`/api/admin/dept/list${buildQs(params)}`)
}

export async function listDeptExcludeChild(
  deptId: string | number,
): Promise<ApiResult<{ list: SysDept[]; exclude: string }>> {
  return fetchApi<{ list: SysDept[]; exclude: string }>(`/api/admin/dept/list/exclude/${deptId}`)
}

export async function getDept(deptId: string | number): Promise<ApiResult<SysDept>> {
  return fetchApi<SysDept>(`/api/admin/dept/${deptId}`)
}

export async function addDept(
  body: Omit<SysDept, 'deptId' | 'children'>,
): Promise<ApiResult<SysDept>> {
  return fetchApi<SysDept>('/api/admin/dept', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateDept(
  body: Partial<SysDept> & { deptId: number },
): Promise<ApiResult<SysDept>> {
  return fetchApi<SysDept>('/api/admin/dept', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delDept(deptId: string | number): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/dept/${deptId}`, { method: 'DELETE' })
}

// ===================== config 模块 =====================

export interface SysConfigListQuery extends PageQuery {
  configName?: string
  configKey?: string
  configType?: string
}

export async function listConfig(
  params: SysConfigListQuery = {},
): Promise<ApiResult<PageData<SysConfig>>> {
  return fetchApi<PageData<SysConfig>>(`/api/admin/config/list${buildQs(params)}`)
}

export async function getConfig(configId: string | number): Promise<ApiResult<SysConfig>> {
  return fetchApi<SysConfig>(`/api/admin/config/${configId}`)
}

export async function getConfigKey(configKey: string): Promise<ApiResult<SysConfig>> {
  return fetchApi<SysConfig>(`/api/admin/config/configKey/${configKey}`)
}

export async function addConfig(body: {
  configName: string
  configKey: string
  configValue?: string
  configType?: string
  remark?: string
}): Promise<ApiResult<SysConfig>> {
  return fetchApi<SysConfig>('/api/admin/config', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateConfig(
  body: Partial<SysConfig> & { configId: number },
): Promise<ApiResult<SysConfig>> {
  return fetchApi<SysConfig>('/api/admin/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delConfig(
  configIds: string | number,
): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/config/${configIds}`, {
    method: 'DELETE',
  })
}

export async function refreshConfigCache(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/config/refreshCache', {
    method: 'DELETE',
  })
}

// ===================== post 模块 =====================

export interface SysPostListQuery extends PageQuery {
  postCode?: string
  postName?: string
  status?: string
}

export async function listPost(
  params: SysPostListQuery = {},
): Promise<ApiResult<PageData<SysPost>>> {
  return fetchApi<PageData<SysPost>>(`/api/admin/post/list${buildQs(params)}`)
}

export async function getPost(postId: string | number): Promise<ApiResult<SysPost>> {
  return fetchApi<SysPost>(`/api/admin/post/${postId}`)
}

export async function addPost(body: Omit<SysPost, 'postId'>): Promise<ApiResult<SysPost>> {
  return fetchApi<SysPost>('/api/admin/post', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePost(
  body: Partial<SysPost> & { postId: number },
): Promise<ApiResult<SysPost>> {
  return fetchApi<SysPost>('/api/admin/post', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delPost(postIds: string | number): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/post/${postIds}`, { method: 'DELETE' })
}

// ===================== notice 模块 =====================

export interface SysNoticeListQuery extends PageQuery {
  noticeTitle?: string
  noticeType?: string
  createBy?: string
}

export async function listNotice(
  params: SysNoticeListQuery = {},
): Promise<ApiResult<PageData<SysNotice>>> {
  return fetchApi<PageData<SysNotice>>(`/api/admin/notice/list${buildQs(params)}`)
}

export async function getNotice(noticeId: string | number): Promise<ApiResult<SysNotice>> {
  return fetchApi<SysNotice>(`/api/admin/notice/${noticeId}`)
}

export async function addNotice(body: Omit<SysNotice, 'noticeId'>): Promise<ApiResult<SysNotice>> {
  return fetchApi<SysNotice>('/api/admin/notice', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateNotice(
  body: Partial<SysNotice> & { noticeId: number },
): Promise<ApiResult<SysNotice>> {
  return fetchApi<SysNotice>('/api/admin/notice', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delNotice(
  noticeIds: string | number,
): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/notice/${noticeIds}`, { method: 'DELETE' })
}

// ===================== dict type 模块 =====================

export interface SysDictTypeListQuery extends PageQuery {
  dictName?: string
  dictType?: string
  status?: string
}

export async function listDictType(
  params: SysDictTypeListQuery = {},
): Promise<ApiResult<PageData<SysDictType>>> {
  return fetchApi<PageData<SysDictType>>(`/api/admin/dict/type/list${buildQs(params)}`)
}

export async function getDictType(dictId: string | number): Promise<ApiResult<SysDictType>> {
  return fetchApi<SysDictType>(`/api/admin/dict/type/${dictId}`)
}

export async function addDictType(
  body: Omit<SysDictType, 'dictId'>,
): Promise<ApiResult<SysDictType>> {
  return fetchApi<SysDictType>('/api/admin/dict/type', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateDictType(
  body: Partial<SysDictType> & { dictId: number },
): Promise<ApiResult<SysDictType>> {
  return fetchApi<SysDictType>('/api/admin/dict/type', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delDictType(
  dictIds: string | number,
): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/dict/type/${dictIds}`, {
    method: 'DELETE',
  })
}

export async function refreshDictCache(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/dict/type/refreshCache', {
    method: 'DELETE',
  })
}

export async function optionselectDictType(): Promise<ApiResult<{ list: SysDictType[] }>> {
  return fetchApi<{ list: SysDictType[] }>('/api/admin/dict/type/optionselect')
}

// ===================== dict data 模块 =====================

export interface SysDictDataListQuery extends PageQuery {
  dictType?: string
  dictLabel?: string
  status?: string
}

export async function listDictData(
  params: SysDictDataListQuery = {},
): Promise<ApiResult<PageData<SysDictData>>> {
  return fetchApi<PageData<SysDictData>>(`/api/admin/dict/data/list${buildQs(params)}`)
}

export async function getDictData(dictCode: string | number): Promise<ApiResult<SysDictData>> {
  return fetchApi<SysDictData>(`/api/admin/dict/data/${dictCode}`)
}

export async function getDicts(
  dictType: string,
): Promise<ApiResult<{ dictType: string; list: SysDictData[] }>> {
  return fetchApi<{ dictType: string; list: SysDictData[] }>(
    `/api/admin/dict/data/type/${dictType}`,
  )
}

export async function addDictData(
  body: Omit<SysDictData, 'dictCode'>,
): Promise<ApiResult<SysDictData>> {
  return fetchApi<SysDictData>('/api/admin/dict/data', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateDictData(
  body: Partial<SysDictData> & { dictCode: number },
): Promise<ApiResult<SysDictData>> {
  return fetchApi<SysDictData>('/api/admin/dict/data', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delDictData(
  dictCodes: string | number,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/api/admin/dict/data/${dictCodes}`, {
    method: 'DELETE',
  })
}

// ===================== logininfor 模块 =====================

export interface SysLogininforListQuery extends PageQuery {
  loginName?: string
  ipaddr?: string
  status?: string
}

export async function listLogininfor(
  params: SysLogininforListQuery = {},
): Promise<ApiResult<PageData<SysLogininfor>>> {
  return fetchApi<PageData<SysLogininfor>>(`/api/admin/logininfor/list${buildQs(params)}`)
}

export async function delLogininfor(
  infoIds: string | number,
): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/logininfor/${infoIds}`, {
    method: 'DELETE',
  })
}

export async function unlockLogininfor(
  userName: string,
): Promise<ApiResult<{ userName: string; unlocked: boolean }>> {
  return fetchApi<{ userName: string; unlocked: boolean }>(
    `/api/admin/logininfor/unlock/${userName}`,
    { method: 'PUT' },
  )
}

export async function cleanLogininfor(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/logininfor/clean', { method: 'DELETE' })
}

// ===================== operlog 模块 =====================

export interface SysOperlogListQuery extends PageQuery {
  title?: string
  businessType?: number
  operName?: string
  status?: string
}

export async function listOperlog(
  params: SysOperlogListQuery = {},
): Promise<ApiResult<PageData<SysOperlog>>> {
  return fetchApi<PageData<SysOperlog>>(`/api/admin/operlog/list${buildQs(params)}`)
}

export async function delOperlog(
  operIds: string | number,
): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/operlog/${operIds}`, { method: 'DELETE' })
}

export async function cleanOperlog(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/admin/operlog/clean', { method: 'DELETE' })
}

// ===================== circles/posts 模块（圈子动态管理） =====================

export interface SysCirclePostAuthor {
  id: string
  nickname: string
  avatar: string | null
}

export interface SysCirclePostCircle {
  id: string
  name: string
}

export interface SysCirclePost {
  id: string
  content: string
  images: string[]
  status: 'published' | 'deleted'
  author: SysCirclePostAuthor
  circle: SysCirclePostCircle
  viewCount: number
  commentCount: number
  likeCount: number
  favoriteCount: number
  createdAt: string
}

export interface SysCirclePostListQuery extends PageQuery {
  keyword?: string
  status?: 'published' | 'deleted'
  circleId?: string
}

export type SysCirclePostListResponse = PageData<SysCirclePost>

export async function listCirclePosts(
  params: SysCirclePostListQuery = {},
): Promise<ApiResult<SysCirclePostListResponse>> {
  return fetchApi<SysCirclePostListResponse>(`/api/admin/circles/posts${buildQs(params)}`)
}

export async function deleteCirclePost(id: string): Promise<ApiResult<null>> {
  return fetchApi<null>(`/api/admin/circles/posts/${id}`, { method: 'DELETE' })
}
