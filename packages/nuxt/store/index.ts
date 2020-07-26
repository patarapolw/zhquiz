import { User } from 'firebase/app'
import { actionTree, getAccessorType, mutationTree } from 'typed-vuex'

export const state = () => ({
  user: null as User | null,
  isAuthReady: false,
  /**
   * This is necessary for layout display
   */
  level: null as number | null,
})

export type RootState = ReturnType<typeof state>

export const mutations = mutationTree(state, {
  SET_USER(state, user: User | null) {
    state.user = JSON.parse(JSON.stringify(user))
    state.isAuthReady = true
  },
  SET_LEVEL(state, level: number | null) {
    state.level = level
  },
})

export const actions = actionTree(
  { state, mutations },
  {
    async updateUser({ commit }, user: User | null) {
      if (user) {
        this.$axios.defaults.headers.authorization = `Bearer ${await user.getIdToken()}`
        const { level = 1 } = await this.$axios.$get(
          '/api/dictionary/currentLevel?type=vocab'
        )
        commit('SET_LEVEL', level)
      } else {
        delete this.$axios.defaults.headers.authorization
        commit('SET_LEVEL', null)
      }

      commit('SET_USER', user)
    },
  }
)

export const accessorType = getAccessorType({
  state,
  mutations,
  actions,
  // modules: {
  //   dictionary,
  // },
})
