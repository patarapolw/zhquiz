<template>
  <section>
    <b-loading v-if="isLoading" active />
    <div v-if="allData.size > 0" class="LevelPage container">
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

      <b-table :key="whatToShow" :data="currentData">
        <template slot-scope="props">
          <b-table-column field="level" label="Level" width="40">
            <span
              class="clickable"
              @contextmenu.prevent="
                openSelectedContextmenu(evt, props.row.level)
              "
            >
              {{ props.row.level }}
            </span>
          </b-table-column>

          <b-table-column field="entries" label="Item">
            <div>
              <span
                v-for="t in props.row.entries"
                :key="t"
                class="tag clickable"
                :class="getTagClass(t)"
                @contextmenu.prevent="openSelectedContextmenu(evt, t)"
              >
                {{ t }}
              </span>
            </div>
          </b-table-column>
        </template>
      </b-table>

      <client-only>
        <vue-context ref="contextmenu" lazy>
          <li v-if="selected.entries.length === 1">
            <a
              role="button"
              @click.prevent="speakSelected"
              @keypress.prevent="speakSelected"
            >
              Speak
            </a>
          </li>
          <li v-if="!selected.quiz.length">
            <a
              role="button"
              @click.prevent="addToQuiz"
              @keypress.prevent="addToQuiz"
            >
              Add to quiz
            </a>
          </li>
          <li v-else>
            <a
              role="button"
              @click.prevent="removeFromQuiz"
              @keypress.prevent="removeFromQuiz"
            >
              Remove from quiz
            </a>
          </li>
          <li v-if="selected.entries.length === 1">
            <nuxt-link
              :to="{ path: '/vocab', query: { q: selected.entries[0] } }"
              target="_blank"
            >
              Search for vocab
            </nuxt-link>
          </li>
          <li v-if="selected.entries.length === 1">
            <nuxt-link
              :to="{ path: '/hanzi', query: { q: selected.entries[0] } }"
              target="_blank"
            >
              Search for Hanzi
            </nuxt-link>
          </li>
          <li v-if="selected.entries.length === 1">
            <a
              :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${selected.entries[0]}*`"
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
import { Component, Vue } from 'nuxt-property-decorator'

import { speak } from '~/assets/speak'

@Component<LevelPage>({
  layout: 'app',
  created() {
    this.init().then(() => {
      this.isLoading = false
    })
  },
  watch: {
    whatToShow() {
      this.onWhatToShowChanged()
    },
    'selected.entries': {
      deep: true,
      handler() {
        this.loadSelectedStatus()
      },
    },
  },
})
export default class LevelPage extends Vue {
  isLoading = true

  allData = new Map<number, Set<string>>()
  srsLevel = new Map<string, number>()

  selected: {
    entries: string[]
    quizIds: string[]
  } = {
    entries: [],
    quizIds: [],
  }

  tagClassMap = [
    (lv: any) => (lv > 2 ? 'is-success' : ''),
    (lv: any) => (lv > 0 ? 'is-warning' : ''),
    (lv: any) => (lv === 0 ? 'is-danger' : ''),
  ]

  whatToShow = 'all'

  get currentData() {
    return Array.from(this.allData)
      .map(([level, entries]) => {
        return {
          level,
          entries: Array.from(entries)
            .filter((v) => {
              if (this.whatToShow === 'all') {
                return true
              }

              if (this.whatToShow === 'learning') {
                if (this.srsLevel.get(v)! <= 2) {
                  return true
                }
              }

              if (this.whatToShow === 'all-quiz') {
                if (typeof this.srsLevel.get(v) !== 'undefined') {
                  return true
                }
              }

              return false
            })
            .sort(),
        }
      })
      .filter((a) => a.entries.length > 0)
      .sort((a, b) => a.level - b.level)
  }

  getTagClass(item: string) {
    const srsLevel = this.srsLevel.get(item)

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

  async init() {
    const {
      settings: { level: { whatToShow } = {} as any } = {},
    } = await this.$axios.$get('/api/user', {
      params: {
        select: ['settings.level.whatToShow'],
      },
    })

    if (whatToShow) {
      this.$set(this, 'whatToShow', whatToShow)
    }

    await this.reload()
  }

  async reload(...entries: string[]) {
    const {
      result = [],
    }: {
      result: {
        entry: string
        level?: number
        srsLevel?: number
      }[]
    } = await (entries.length > 0
      ? this.$axios.$post('/api/quiz/entries', {
          entries,
          type: 'vocab',
          select: ['entry', 'srsLevel'],
        })
      : this.$axios.$get('/api/dictionary/level'))

    entries.map((entry) => {
      this.srsLevel.delete(entry)
    })

    result.map(({ entry, level, srsLevel = -1 }) => {
      if (level) {
        const levelData = this.allData.get(level) || new Set()
        levelData.add(entry)
        this.allData.set(level, levelData)
      }

      this.srsLevel.set(entry, srsLevel)
    })

    if (!entries.length) {
      this.$set(this, 'allData', this.allData)
    }

    this.$set(this, 'srsLevel', this.srsLevel)
  }

  async onWhatToShowChanged() {
    await this.$axios.$patch('/api/user', {
      set: {
        'settings.level.whatToShow': this.whatToShow,
      },
    })
  }

  async loadSelectedStatus() {
    if (this.selected.entries.length) {
      const { entries } = this.selected

      const { result = [] } = await this.$axios.$post('/api/quiz/entries', {
        entries,
        type: 'vocab',
        select: ['_id'],
      })

      this.selected.quizIds = result.map(({ _id }: any) => _id)
      this.$set(this.selected, 'quizIds', this.selected.quizIds)
    }
  }

  async addToQuiz() {
    const { entries } = this.selected

    if (entries.length) {
      await this.$axios.$put('/api/quiz/entries', {
        entries,
        type: 'vocab',
      })
      this.$buefy.snackbar.open(
        `Added vocab: ${entries.slice(0, 3).join(',')}${
          entries.length > 3 ? '...' : ''
        } to quiz`
      )
      await this.reload(...entries)
    }
  }

  async removeFromQuiz() {
    const { entries, quizIds } = this.selected

    if (entries.length && quizIds.length) {
      await this.$axios.$post('/api/quiz/delete/ids', { ids: quizIds })
      this.$buefy.snackbar.open(
        `Removed vocab: ${entries.slice(0, 3).join(',')}${
          entries.length > 3 ? '...' : ''
        }  from quiz`
      )
      await this.reload(...entries)
    }
  }

  async speakSelected() {
    const {
      entries: [s],
    } = this.selected
    if (s) {
      await speak(s)
    }
  }

  async openSelectedContextmenu(evt: MouseEvent, it: number | string) {
    if (typeof it === 'number') {
      const selected = this.currentData.filter(({ level }) => level === it)[0]
      this.selected.entries = selected ? selected.entries : []
    } else if (typeof it === 'string') {
      this.selected.entries = [it]
    }

    if (this.selected.entries.length > 0) {
      await this.loadSelectedStatus()
      ;(this.$refs.contextmenu as any).open(evt)
    }
  }
}
</script>

<style scoped>
.tag {
  margin-right: 0.5rem;
}
</style>
