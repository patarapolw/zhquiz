<template>
  <section>
    <b-loading v-if="isLoading" active />
    <div v-if="isInit" class="LevelPage container">
      <div class="field">
        <label class="label">Filter</label>
        <b-field>
          <b-radio-button
            v-model="whatToShow"
            native-value="all"
            type="is-success"
          >
            Show all
          </b-radio-button>
          <b-radio-button
            v-model="whatToShow"
            native-value="all-quiz"
            type="is-info"
          >
            All quiz
          </b-radio-button>
          <b-radio-button
            v-model="whatToShow"
            native-value="learning"
            type="is-warning"
          >
            Learning
          </b-radio-button>
        </b-field>
      </div>

      <b-table :key="whatToShow" :data="shownData">
        <template slot-scope="props">
          <b-table-column field="level" label="Level" width="40">
            {{ props.row.level }}
          </b-table-column>

          <b-table-column field="item" label="Item">
            <div>
              <span
                v-for="t in props.row.item"
                :key="t"
                class="tag clickable"
                :class="getTagClass(t)"
                @contextmenu.prevent="
                  (evt) => {
                    selected = t
                    $refs.contextmenu.open(evt)
                  }
                "
              >
                {{ t }}
              </span>
            </div>
          </b-table-column>
        </template>
      </b-table>

      <client-only>
        <vue-context ref="contextmenu" lazy>
          <li>
            <a
              role="button"
              @click.prevent="speak(selected)"
              @keypress.prevent="speak(selected)"
            >
              Speak
            </a>
          </li>
          <li v-if="!vocabIds[selected] || !vocabIds[selected].length">
            <a
              role="button"
              @click.prevent="addToQuiz(selected)"
              @keypress.prevent="addToQuiz(selected)"
            >
              Add to quiz
            </a>
          </li>
          <li v-else>
            <a
              role="button"
              @click.prevent="removeFromQuiz(selected)"
              @keypress.prevent="removeFromQuiz(selected)"
            >
              Remove from quiz
            </a>
          </li>
          <li>
            <nuxt-link
              :to="{ path: '/vocab', query: { q: selected } }"
              target="_blank"
            >
              Search for vocab
            </nuxt-link>
          </li>
          <li>
            <nuxt-link
              :to="{ path: '/hanzi', query: { q: selected } }"
              target="_blank"
            >
              Search for Hanzi
            </nuxt-link>
          </li>
          <li>
            <a
              :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${selected}*`"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in MDBG
            </a>
          </li>
        </vue-context>
      </client-only>
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'nuxt-property-decorator'

import { speak } from '~/assets/speak'

@Component({
  layout: 'app',
})
export default class LevelPage extends Vue {
  isInit = false
  isLoading = true

  data = [] as any[]
  selected = ''

  vocabIds: any = {}

  vocabSrsLevel: any = {}
  tagClassMap = [
    (lv: any) => (lv > 2 ? 'is-success' : ''),
    (lv: any) => (lv > 0 ? 'is-warning' : ''),
    (lv: any) => (lv === 0 ? 'is-danger' : ''),
  ]

  whatToShow = 'all'

  speak = speak

  get email() {
    const u = this.$store.state.user
    return u ? (u.email as string) : undefined
  }

  get shownData() {
    const data = JSON.parse(JSON.stringify(this.data)) as any[]
    return data
      .map((d) => {
        if (this.whatToShow === 'all-quiz' || this.whatToShow === 'learning') {
          d.item = d.item.filter(
            (v: string) => typeof this.vocabSrsLevel[v] !== 'undefined'
          )
        }

        if (this.whatToShow === 'learning') {
          d.item = d.item.filter((v: string) => !(this.vocabSrsLevel[v] > 2))
        }

        return d
      })
      .filter(({ item }) => item.length > 0)
  }

  async created() {
    await this.onUserChange()

    this.isLoading = true
    const data = await this.$axios.$get('/api/vocab/all')

    this.$set(
      this,
      'data',
      Object.entries(data).map(([lv, vs]) => {
        return { level: parseInt(lv), item: vs }
      })
    )

    this.isLoading = false
  }

  getTagClass(item: string) {
    const srsLevel = this.vocabSrsLevel[item]

    if (typeof srsLevel !== 'undefined') {
      if (srsLevel === -1) {
        return 'is-info'
      }

      for (const fn of this.tagClassMap) {
        const c = fn(srsLevel)
        if (c) {
          return c
        }
      }
    }

    return 'is-light'
  }

  @Watch('email')
  async onUserChange() {
    if (this.email) {
      const {
        settings: { level: { whatToShow } = {} as any } = {},
      } = await this.$axios.$post('/api/user/', {
        select: ['settings.level.whatToShow'],
      })

      if (whatToShow) {
        this.$set(this, 'whatToShow', whatToShow)
      }

      this.isInit = true

      const { result } = await this.$axios.$post('/api/card/q', {
        cond: {
          type: 'vocab',
        },
        join: ['quiz'],
        select: ['item', 'srsLevel'],
        limit: null,
        hasCount: false,
      })

      this.vocabSrsLevel = {}
      result.map((d: any) => {
        let lv = this.vocabSrsLevel[d.item]
        this.vocabSrsLevel[d.item] = lv = typeof lv === 'undefined' ? -1 : lv

        if (typeof d.srsLevel === 'number') {
          this.vocabSrsLevel[d.item] = lv > d.srsLevel ? lv : d.srsLevel
        }
      })

      this.$set(this, 'vocabSrsLevel', this.vocabSrsLevel)
    }
  }

  @Watch('whatToShow')
  async onWhatToShowChanged() {
    await this.$axios.$patch('/api/user/', {
      set: {
        'settings.level.whatToShow': this.whatToShow,
      },
    })
  }

  @Watch('selected')
  async loadVocabStatus() {
    if (this.selected) {
      const { result } = await this.$axios.$post('/api/card/q', {
        cond: {
          item: this.selected,
          type: 'vocab',
        },
        join: ['quiz'],
        select: ['_id', 'srsLevel'],
        hasCount: false,
      })

      const srsLevels = result
        .map((r: any) => r.srsLevel)
        .filter((s: any) => typeof s === 'number')
      const srsLevel =
        srsLevels.length > 0
          ? Math.max(...srsLevels)
          : result.length > 0
          ? -1
          : undefined

      this.$set(
        this.vocabIds,
        this.selected,
        result.map((r: any) => r._id)
      )
      this.$set(this.vocabSrsLevel, this.selected, srsLevel)
    }
  }

  async addToQuiz(item: string) {
    const type = 'vocab'

    await this.$axios.$put('/api/card/', {
      create: { item, type },
    })
    this.$buefy.snackbar.open(`Added ${type}: ${item} to quiz`)

    this.loadVocabStatus()
  }

  async removeFromQuiz(item: string) {
    if (this.vocabIds[item]) {
      await this.$axios.$delete('/api/card/', {
        data: { id: this.vocabIds[item] },
      })
      this.$buefy.snackbar.open(`Removed vocab: ${item} from quiz`)
      this.loadVocabStatus()
    }
  }
}
</script>

<style scoped>
.tag {
  margin-right: 0.5rem;
}
</style>
