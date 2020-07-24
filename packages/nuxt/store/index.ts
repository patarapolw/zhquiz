import { User } from 'firebase/app'
import { ActionTree, MutationTree } from 'vuex'

export const state = () => ({
  user: null as User | null,
  isAuthReady: false,
  /**
   * This is necessary for layout display
   */
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
  async updateUser({ commit }, user: User | null) {
    if (user) {
      this.$axios.defaults.headers.authorization = `Bearer ${await user.getIdToken()}`
      const { level = 1 } = await this.$axios.$get(
        '/api/dictionary/currentLevel?type=vocab'
      )
      commit('updateLevel', level)
    } else {
      delete this.$axios.defaults.headers.authorization
      commit('updateLevel', null)
    }

    commit('updateUser', user)
  },
}
