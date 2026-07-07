// @ts-nocheck
// 用户端 vuex shim —— 旧项目使用 useStore() from 'vuex'，当前项目改用 Pinia。
// 这里提供一个基于 localStorage + reactive 的兼容 store，覆盖旧 getters/commit/dispatch 调用。
import { reactive } from 'vue'
import storage from './storageUtils'
import { getUser, setUser, deleteUser } from './userUtils'

interface EduState {
  mainHeight: string
  asideStatus: boolean
  userInfo: any
  isLogin: boolean
}

const state: EduState = reactive({
  mainHeight: 'auto',
  asideStatus: false,
  userInfo: getUser() || undefined,
  isLogin: !!getUser()
})

const getters = {
  getMainHeight: () => state.mainHeight,
  getAsideStatus: () => state.asideStatus,
  getUserInfo: () => state.userInfo || getUser(),
  getIsLogin: () => state.isLogin
}

const mutations: Record<string, (payload?: any) => void> = {
  setMainHeight(payload: string) {
    state.mainHeight = payload
  },
  setAsideStatus(payload: boolean) {
    state.asideStatus = payload
  },
  setUserInfo(payload: any) {
    state.userInfo = payload
    if (payload) setUser(payload)
    state.isLogin = !!payload
  },
  setIsLogin(payload: boolean) {
    state.isLogin = payload
  },
  clearUserInfo() {
    state.userInfo = undefined
    state.isLogin = false
    deleteUser()
  }
}

const actions: Record<string, (payload?: any) => void> = {
  updateUserInfo({ commit }: any, payload: any) {
    commit('setUserInfo', payload)
  },
  updateIsLogin({ commit }: any, payload: boolean) {
    commit('setIsLogin', payload)
  },
  logout({ commit }: any) {
    commit('clearUserInfo')
  }
}

export function useStore() {
  const store = {
    state,
    getters,
    commit(type: string, payload?: any) {
      const fn = mutations[type]
      if (fn) fn(payload)
    },
    dispatch(type: string, payload?: any) {
      const fn = actions[type]
      if (fn) return fn({ commit: store.commit, state, getters }, payload)
    }
  }
  return store
}

export function createStore() {
  return { state, getters, commit: (t: string, p?: any) => mutations[t] && mutations[t](p), dispatch: (t: string, p?: any) => actions[t] && actions[t]({ commit: (t2: string, p2?: any) => mutations[t2] && mutations[t2](p2), state, getters }, p) }
}

export default { useStore, createStore }
