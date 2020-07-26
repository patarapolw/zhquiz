<template>
  <section>
    <div class="HanziPage container">
      <form class="field" @submit.prevent="q = q0">
        <div class="control">
          <input
            v-model="q0"
            class="input"
            type="search"
            name="q"
            placeholder="Type here to search."
            aria-label="search"
          />
        </div>
      </form>

      <div class="columns">
        <div class="column is-6 entry-display">
          <div
            class="hanzi-display clickable font-han"
            @contextmenu.prevent="
              openSelectedContextmenu(evt, 'hanzi', current)
            "
          >
            {{ current.entry() }}
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
              :disabled="i > entries.length - 2"
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
            :open="!!current.sub.length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">Subcompositions</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <span
                v-for="h in current.sub"
                :key="h"
                class="font-han clickable"
                @contextmenu.prevent="openSelectedContextmenu(evt, 'hanzi', h)"
              >
                {{ h }}
              </span>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="!!current.sup.length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">Supercompositions</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <span
                v-for="h in current.sup"
                :key="h"
                class="font-han clickable"
                @contextmenu.prevent="openSelectedContextmenu(evt, 'hanzi', h)"
              >
                {{ h }}
              </span>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="!!current.variants.length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">Variants</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <span
                v-for="h in current.variants"
                :key="h"
                class="font-han clickable"
                @contextmenu.prevent="openSelectedContextmenu(evt, 'hanzi', h)"
              >
                {{ h }}
              </span>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="!!current.vs.length"
          >
            <div
              slot="trigger"
              slot-scope="props"
              class="card-header"
              role="button"
            >
              <h2 class="card-header-title">Vocabularies</h2>
              <a role="button" class="card-header-icon">
                <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
              </a>
            </div>

            <div class="card-content">
              <div v-for="(v, i) in current.vs" :key="i" class="long-item">
                <span
                  class="clickable font-zh-simp"
                  @contextmenu.prevent="
                    openSelectedContextmenu(evt, 'vocab', v.entry)
                  "
                >
                  {{ v.entry }}
                </span>

                <span v-if="v.alt && v.alt.length">
                  (
                  <span
                    v-for="a in v.alt"
                    :key="a"
                    class="clickable vocab-alt font-zh-trad"
                    @contextmenu.prevent="
                      (evt) => {
                        openSelectedContextmenu(evt, 'vocab', a)
                      }
                    "
                  >
                    {{ a }}
                  </span>
                  )
                </span>

                <span v-if="v.reading && v.reading.length">
                  [
                  <span v-for="r in v.reading" :key="r" class="vocab-reading">
                    {{ r }}
                  </span>
                  ]
                </span>

                <span v-if="v.translation && v.translation.length">
                  <span
                    v-for="t in v.translation"
                    :key="t"
                    class="vocab-translation"
                  >
                    {{ t }}
                  </span>
                </span>
              </div>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="!!current.ss.length"
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
              <div v-for="(s, i) in current.ss" :key="i" class="long-item">
                <span
                  class="clickable font-zh-simp"
                  @contextmenu.prevent="
                    openSelectedContextmenu(evt, 'sentence', v.entry)
                  "
                >
                  {{ s.entry }}
                </span>

                <span v-if="s.translation">{{ s.translation[0] }}</span>
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
            @click.prevent="speakSelected"
            @keypress.prevent="speakSelected"
          >
            Speak
          </a>
        </li>
        <li v-if="!selected.quizIds.length">
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

import { IDictType, IDict } from '~/assets/schema'
import { speak } from '~/assets/speak'

@Component<HanziPage>({
  layout: 'app',
  created() {
    this.q0 = this.q
    this.onQChange()
  },
  watch: {
    q() {
      this.onQChange()
    },
    current() {
      this.onCurrentChange()
    },
  },
})
export default class HanziPage extends Vue {
  entries: string[] = []
  i: number = 0

  current = {
    entry: () => {
      return this.entries[this.i] as string | undefined
    },
    sub: [] as string[],
    sup: [] as string[],
    variants: [] as string[],
    vs: [] as Pick<IDict, 'entry' | 'alt' | 'reading' | 'english'>[],
    ss: [] as Pick<IDict, 'entry' | 'english'>[],
  }

  selected: {
    entry?: string
    type?: IDictType
    quizIds: string[]
  } = {
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

  async onQChange() {
    const qs = this.q.split('').filter((h) => XRegExp('\\p{Han}').test(h))
    this.$set(
      this,
      'entries',
      qs.filter((h, i) => qs.indexOf(h) === i)
    )
    this.i = 0

    const [, ...rs] = qs

    await Promise.all([
      this.onCurrentChange(),
      rs.length
        ? await this.$accessor.dictionary.searchToken({
            q: rs.join(''),
          })
        : null,
    ])
  }

  async onCurrentChange() {
    const q = this.current.entry()
    const [ts = [], vs = [], ss = []] = q
      ? await Promise.all([
          this.$accessor.dictionary.searchToken({ q }),
          this.$accessor.dictionary.searchDict({
            q,
            strategy: 'contains',
            type: 'vocab',
          }),
          this.$accessor.dictionary.searchDict({
            q,
            strategy: 'contains',
            type: 'sentence',
            select: ['entry', 'english'],
          }),
        ])
      : []

    this.current.sub = ts[0]?.sub || []
    this.current.sup = ts[0]?.sup || []
    this.current.variants = ts[0]?.variants || []
    this.current.vs = vs as any
    this.current.ss = ss as any
    this.$set(this, 'current', this.current)
  }

  async loadSelectedStatus() {
    const { entry, type } = this.selected

    if (entry && type) {
      const { result = [] } = await this.$axios.$get('/api/quiz/entry', {
        params: {
          entry,
          type,
          select: ['_id'],
        },
      })

      this.selected.quizIds = result.map((r: any) => r._id)
      this.$set(this.selected, 'quizIds', this.selected.quizIds)
    }
  }

  async addToQuiz() {
    const { entry, type } = this.selected

    if (entry && type) {
      await this.$axios.$put('/api/quiz', {
        entry,
        dictionaryType: type,
      })
      this.$buefy.snackbar.open(`Added ${type}: ${entry} to quiz`)
    }
  }

  async removeFromQuiz() {
    const { entry, type, quizIds } = this.selected

    if (entry && type && quizIds.length) {
      await this.$axios.$post('/api/quiz/delete/ids', {
        ids: quizIds,
      })

      this.$buefy.snackbar.open(`Removed ${type}: ${entry} from quiz`)
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
    type: IDictType,
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

.card-content {
  max-height: 250px;
  overflow: scroll;
}

.card-content .font-han {
  font-size: 50px;
  display: inline-block;
}

.long-item > span + span::before {
  content: ' ';
}

.long-item > span > span + span::before {
  content: '|';
}
</style>
