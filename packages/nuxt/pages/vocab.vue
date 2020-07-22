<template>
  <section>
    <div class="VocabPage contain">
      <form class="field" @submit.prevent="q = q0">
        <div class="control">
          <input
            v-model="q0"
            type="search"
            class="input"
            name="q"
            placeholder="Type here to search."
            aria-label="search"
          />
        </div>
      </form>

      <div class="columns">
        <div class="column is-6 entry-display">
          <div class="vocab-display font-zh-simp">
            <div
              class="clickable text-center"
              @contextmenu.prevent="
                (evt) => {
                  openSelectedContextmenu(
                    evt,
                    'vocab',
                    entry ? entry.entry : current
                  )
                }
              "
            >
              {{ entry ? entry.entry : current }}
            </div>
          </div>

          <div class="buttons has-addons">
            <button
              class="button"
              :disabled="i < 1"
              @click="i--"
              @keypress="i--"
            >
              Previous
            </button>
            <button
              class="button"
              :disabled="i > allEntries.length - 2"
              @click="i++"
              @keypress="i++"
            >
              Next
            </button>

            <b-dropdown hoverable aria-role="list">
              <button slot="trigger" class="button">
                <fontawesome icon="caret-down" />
              </button>

              <b-dropdown-item aria-role="listitem">
                Search in MDBG
              </b-dropdown-item>
            </b-dropdown>
          </div>
        </div>

        <div class="column is-6">
          <b-collapse
            class="card"
            animation="slide"
            style="margin-bottom: 1em;"
            :open="((entry || {}).reading || []).length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">Reading</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <span
                v-for="(r, i) in entry.reading"
                :key="i"
                class="pipe-divided"
              >
                {{ r }}
              </span>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="((entry || {}).alt || []).length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">Traditional</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <span
                v-for="(a, i) in entry.alt"
                :key="i"
                class="font-zh-trad clickable pipe-divided"
                @contextmenu.prevent="
                  (evt) => {
                    openSelectedContextmenu(evt, 'vocab', a)
                  }
                "
              >
                {{ a }}
              </span>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="((entry || {}).translation || []).length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">English</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <ul>
                <li v-for="(a, i) in entry.translation" :key="i">
                  {{ t }}
                </li>
              </ul>
              <span>{{ current.english }}</span>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="matchedSentence.length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">Sentences</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <div
                v-for="(s, i) in matchedSentence"
                :key="i"
                class="sentence-item"
              >
                <span
                  class="clickable font-zh-simp"
                  @contextmenu.prevent="
                    (evt) => {
                      openSelectedContextmenu(evt, 'sentence', s.entry)
                    }
                  "
                >
                  {{ s.entry }}
                </span>
                <ul>
                  <li v-for="(a, i1) in s.translation" :key="i1">
                    {{ t }}
                  </li>
                </ul>
              </div>
            </div>
          </b-collapse>
        </div>
      </div>
    </div>

    <client-only>
      <vue-context ref="contextmenu" lazy>
        <li>
          <a
            role="button"
            @click.prevent="speakSelected()"
            @keypress.prevent="speakSelected()"
          >
            Speak
          </a>
        </li>
        <li v-if="!selected.quizIds.length">
          <a role="button" @click.prevent="addToQuiz()" @keypress="addToQuiz()">
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz()"
            @keypress="removeFromQuiz()"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <router-link
            :to="{ path: '/vocab', query: { q: selected.entry } }"
            target="_blank"
          >
            Search for vocab
          </router-link>
        </li>
        <li>
          <router-link
            :to="{ path: '/hanzi', query: { q: selected.entry } }"
            target="_blank"
          >
            Search for Hanzi
          </router-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${
              selected.type === 'sentence'
                ? selected.entry
                : `*${selected.entry}*`
            }`"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in MDBG
          </a>
        </li>
      </vue-context>
    </client-only>
  </section>
</template>

<script lang="ts">
import XRegExp from 'xregexp'
import { Component, Vue } from 'nuxt-property-decorator'

import { speak } from '~/assets/speak'
import { IDictionaryItem } from '~/assets/types/item'

type ISelectedType = 'vocab' | 'sentence'
type IDictionaryType = 'vocab' | 'sentence'

interface ISelectedItem {
  type?: ISelectedType
  entry?: string
  quizIds: string[]
}

@Component<VocabPage>({
  layout: 'app',
  created() {
    this.q0 = this.q
    this.onQChange(this.q0)
  },
  watch: {
    q() {
      this.onQChange()
    },
    current() {
      this.load()
    },
  },
})
export default class VocabPage extends Vue {
  allEntries: string[] = []
  i: number = 0

  dict: Record<
    IDictionaryType,
    {
      [entry: string]: IDictionaryItem
    }
  > = {
    vocab: {},
    sentence: {},
  }

  resolveAltVocab = new Map<string, string>()

  selected: ISelectedItem = {
    quizIds: [],
  }

  q0 = ''

  get q() {
    const q = this.$route.query.q
    return (Array.isArray(q) ? q[0] : q) || ''
  }

  set q(q: string) {
    this.$router.push({ query: { q } })
  }

  get current() {
    return this.allEntries[this.i] as string | undefined
  }

  get entry() {
    let c = this.current
    if (!c) {
      return null
    }

    if (!this.dict.vocab[c]) {
      c = this.resolveAltVocab.get(c) || c
    }

    return this.dict.vocab[c] || null
  }

  get matchedSentence() {
    if (!this.current) {
      return []
    }

    return Object.entries(this.dict.sentence)
      .filter(([entry]) => this.current && entry.includes(this.current))
      .map(([, content]) => content)
      .sort((a, b) => {
        if (
          typeof b.priority !== 'undefined' &&
          typeof a.priority !== 'undefined'
        ) {
          return b.priority - a.priority
        }
        if (
          typeof b.frequency !== 'undefined' &&
          typeof a.frequency !== 'undefined'
        ) {
          return b.frequency - a.frequency
        }
        return 0.5 - Math.random()
      })
      .slice(0, 10)
  }

  async onQChange(q = this.q) {
    if (q) {
      const { result } = await this.$axios.$get('/api/chinese/jieba', {
        params: { q },
      })

      const qs = (result as string[])
        .filter((h) => XRegExp('\\p{Han}+').test(h))
        .filter((h, i, arr) => arr.indexOf(h) === i)

      this.allEntries = qs
      this.$set(this, 'allEntries', qs)
    }

    this.i = 0
    await this.load()
  }

  async load() {
    let c = this.current
    if (!c) {
      return
    }

    if (!this.dict.vocab[c]) {
      c = this.resolveAltVocab.get(c) || c
    }

    const [rv, rs] = await Promise.all([
      this.dict.vocab[c]
        ? null
        : this.$axios.$get('/api/dictionary/matchAlt', {
            params: {
              q: c,
              select: ['entry', 'alt', 'reading', 'translation'],
              type: 'vocab',
            },
          }),
      this.$axios.$post('/api/dictionary/search', {
        q: c,
        type: 'sentence',
        select: ['entry', 'translation'],
        limit: 10,
        exclude: Object.keys(this.dict.sentence).filter((s) => s.includes(c!)),
      }),
    ])

    if (rv !== null) {
      rv.result.map((v: IDictionaryItem) => {
        this.dict.vocab[v.entry] = v
        if (v.alt) {
          v.alt.map((a) => {
            this.resolveAltVocab.set(a, v.entry)
          })
        }
      })
    }

    rs.result.map((s: IDictionaryItem) => {
      this.dict.sentence[s.entry] = s
    })
  }

  async addToQuiz() {
    const { entry, type } = this.selected
    if (!entry || !type) {
      return
    }

    await this.$axios.$put('/api/quiz/entries', {
      entries: [entry],
      type,
    })
    await this.loadSelectedStatus()

    this.$buefy.snackbar.open(`Added ${type}: ${entry} to quiz`)
  }

  async removeFromQuiz() {
    const { entry, type, quizIds } = this.selected
    if (!entry || !type || !quizIds.length) {
      return
    }

    await this.$axios.$post('/api/quiz/delete/ids', {
      ids: quizIds,
    })
    await this.loadSelectedStatus()

    this.$buefy.snackbar.open(`Removed ${type}: ${entry} to quiz`)
  }

  async loadSelectedStatus() {
    const { entry, type } = this.selected

    if (entry && type) {
      const { result } = await this.$axios.$get('/api/quiz/entry', {
        params: {
          entry,
          type,
          select: ['_id'],
        },
      })

      this.selected.quizIds = result.map(({ _id }: any) => _id)
      this.$set(this.selected, 'quizIds', this.selected.quizIds)
    }
  }

  async speakSelected() {
    const { entry } = this.selected
    if (entry) {
      await speak(entry)
    }
  }

  async openSelectedContextmenu(
    evt: MouseEvent,
    type: ISelectedType,
    entry: string
  ) {
    this.selected.type = type
    this.selected.entry = entry

    await this.loadSelectedStatus()
    ;(this.$refs.contextmenu as any).open(evt)
  }
}
</script>

<style scoped>
.entry-display {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.entry-display .clickable {
  min-height: 1.5em;
  display: block;
}

.card {
  margin-bottom: 1rem;
}

.card [class^='font-'] {
  font-size: 60px;
  height: 80px;
}

.card-content {
  max-height: 250px;
  overflow: scroll;
}

.sentence-item {
  margin-right: 1rem;
}
</style>
