<template>
  <section>
    <b-loading v-if="isLoading" active />
    <div v-if="Object.keys(allData).length > 0" class="LevelPage container">
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

      <b-table :data="currentData">
        <template slot-scope="props">
          <b-table-column field="level" label="Level" width="40">
            <span
              class="clickable"
              @contextmenu.prevent="
                (evt) => openSelectedContextmenu(evt, props.row.level)
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
                @contextmenu.prevent="(evt) => openSelectedContextmenu(evt, t)"
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
          <li v-if="selected.cardIds.length !== selected.entries.length">
            <a
              role="button"
              @click.prevent="addToQuiz"
              @keypress.prevent="addToQuiz"
            >
              Add to quiz
            </a>
          </li>
          <li v-if="selected.cardIds.length">
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
    this.init()
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

  allData: {
    [level: string]: string[]
  } = {}

  srsLevel: {
    [entry: string]: number
  } = {}

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
  currentData: {
    level: number
    entries: string[]
  }[] = []

  setCurrentData() {
    this.currentData = Object.entries(this.allData)
      .map(([_lv, entries]) => {
        const level = parseInt(_lv)

        return {
          level,
          entries: Array.from(entries)
            .filter((v) => {
              if (this.whatToShow === 'all') {
                return true
              }

              if (this.whatToShow === 'learning') {
                if (this.srsLevel[v] <= 2) {
                  return true
                }
              }

              if (this.whatToShow === 'all-quiz') {
                if (typeof this.srsLevel[v] !== 'undefined') {
                  return true
                }
              }

              return false
            })
            .sort(),
        }
      })
      .filter((a) => {
        return a.entries.length > 0
      })
      .sort((a, b) => a.level - b.level)

    this.$set(this, 'currentData', this.currentData)
  }

  getTagClass(item: string) {
    const srsLevel = this.srsLevel[item]

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
    this.isLoading = false
  }

  async reload(...entries: string[]) {
    const {
      result = [],
    }: {
      result: {
        entry: string
        level?: number
        srsLevel: number
      }[]
    } = await (entries.length > 0
      ? this.$axios.$post('/api/quiz/entries', {
          entries,
          type: 'vocab',
          select: ['entry', 'srsLevel'],
        })
      : this.$axios.$get('/api/dictionary/allLevels', {
          params: {
            type: 'vocab',
          },
        }))

    entries.map((entry) => {
      delete this.srsLevel[entry]
    })

    result.map(({ entry, level, srsLevel }) => {
      if (level) {
        const lv = level.toString()
        const levelData = this.allData[lv] || []
        levelData.push(entry)
        this.allData[lv] = levelData
      }

      this.srsLevel[entry] = srsLevel
    })

    if (!entries.length) {
      this.$set(this, 'allData', this.allData)
    }

    this.$set(this, 'srsLevel', this.srsLevel)
    this.setCurrentData()
  }

  async onWhatToShowChanged() {
    this.setCurrentData()

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

      this.selected.quizIds = result.map((r: any) => r._id)
      this.$set(this.selected, 'quizIds', this.selected.quizIds)
    }
  }

  async addToQuiz() {
    const { entries } = this.selected

    if (entries.length) {
      await this.$axios.$put('/api/quiz', {
        entry: entries,
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
