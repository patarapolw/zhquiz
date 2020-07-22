import { User } from 'firebase/app'
import { ActionTree, MutationTree } from 'vuex'

export const state = () => ({
  user: null as User | null,
  isAuthReady: false,
  level: null as number | null,
})

export type RootState = ReturnType<typeof state>

export const mutations: MutationTree<RootState> = {
  updateUser(state, user) {
    state.user = JSON.parse(JSON.stringify(user))
    state.isAuthReady = true
  },
  updateLevel(state, level) {
    state.level = level
  },
}

export const actions: ActionTree<RootState, RootState> = {
  async updateUser({ commit, dispatch }, user: User | null) {
    if (user) {
      this.$axios.defaults.headers.authorization = `Bearer ${await user.getIdToken()}`
    } else {
      delete this.$axios.defaults.headers.authorization
    }

    commit('updateUser', user)
    await dispatch('updateLevel')
  },
  async updateLevel({ commit, state }) {
    if (state.user) {
      const { level } = await this.$axios.$get('/api/dictionary/currentLevel')
      commit('updateLevel', level)
    } else {
      commit('updateLevel', null)
    }
  },
}
