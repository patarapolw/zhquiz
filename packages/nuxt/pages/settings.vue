<template>
  <section>
    <div v-show="isInit" class="SettingsPage">
      <form class="container" @submit.prevent="doSave">
        <div class="flex flex-row items-center">
          <b-field label="Level Range" class="flex-grow">
            <b-slider v-model="lv" :min="lvRange[0]" :max="lvRange[1]" lazy>
              <b-slider-tick :value="lvRange[0]">{{
                lvRange[0]
              }}</b-slider-tick>
              <template
                v-for="val in Array(lvRange[1] / 10)
                  .fill(10)
                  .map((el, i) => el * (i + 1))"
              >
                <b-slider-tick :key="val" :value="val">{{ val }}</b-slider-tick>
              </template>
            </b-slider>
          </b-field>
          <div class="label-level">{{ lv[0] }} - {{ lv[1] }}</div>
        </div>

        <div class="flex flex-row">
          <button
            class="button is-success"
            :disabled="!email"
            type="submit"
            aria-label="save"
          >
            Save
          </button>
        </div>
      </form>

      <div class="container w-full danger-zone">
        <h3 class="title is-4 is-danger">Danger Zone</h3>

        <form
          class="flex flex-row items-center"
          @submit.prevent="isDeleteAccountModal = true"
        >
          <p class="flex">Delete my account</p>
          <div class="flex-grow" />
          <button class="button is-danger" aria-label="delete-account">
            Delete
          </button>
        </form>
      </div>

      <b-modal :active.sync="isDeleteAccountModal" :width="500">
        <form
          class="card delete-account-form"
          @submit.prevent="doDeleteAccount"
        >
          <div class="card-content">
            <div class="flex flex-row items-center">
              <div class="icon has-text-danger">
                <fontawesome icon="exclamation-circle" />
              </div>

              <div class="flex-grow content">
                <div>Type your <b>email</b> to delete your account.</div>

                <input
                  v-model="deleteAccountEmail"
                  class="input control"
                  type="email"
                  aria-label="delete-account-email"
                />

                <div class="flex flex-row items-center">
                  <div class="flex-grow" />
                  <button
                    type="submit"
                    class="button is-danger"
                    :disabled="deleteAccountEmail !== email"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </b-modal>
    </div>
  </section>
</template>

<script lang="ts">
import { User } from 'firebase/app'
import { Component, Vue, Watch } from 'nuxt-property-decorator'

@Component({
  layout: 'app',
})
export default class SettingsPage extends Vue {
  lv = [1, 60]
  isInit = false

  isDeleteAccountModal = false
  deleteAccountEmail = ''

  readonly lvRange = [1, 60]

  get email() {
    const u = this.$store.state.user as User | null
    return u ? u.email : undefined
  }

  created() {
    this.onUserChanged()
  }

  @Watch('email')
  async onUserChanged() {
    if (this.email) {
      this.isInit = false
      const { levelMin, level } = await this.$axios.$post('/api/user/', {
        select: ['levelMin', 'level'],
      })
      this.lv = [levelMin || 1, level || 60]
      this.isInit = true
    }
  }

  async doSave() {
    await this.$axios.$patch('/api/user/', {
      set: {
        levelMin: this.lv[0],
        level: this.lv[1],
      },
    })
    this.$buefy.snackbar.open('Saved')
  }

  async doDeleteAccount() {
    await this.$axios.$delete('/api/user/')
    this.$router.push('/')
  }
}
</script>

<style scoped>
.SettingsPage {
  padding-top: 1rem;
}

.SettingsPage > :not(.modal) {
  margin-bottom: 2rem;
}

.label-level {
  text-align: right;
  width: 5em;
  word-break: keep-all;
  margin-left: 1rem;
}

.danger-zone {
  min-height: 150px;
  border: 1px solid red;
  border-radius: 0.25rem;
  padding: 1.5rem;
}

.danger-zone .title {
  color: red;
}

.delete-account-form .icon {
  margin-right: 1.5rem;
  padding: 1.5rem;
}

.delete-account-form .icon > svg {
  --size: 3rem;

  width: var(--size);
  height: var(--size);
}

.delete-account-form .content > * + * {
  margin-top: 1rem;
}
</style>
