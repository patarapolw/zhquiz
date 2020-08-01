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
              (evt) => {
                selectedHanzi = current
                $refs.hanziContextmenu.open(evt)
              }
            "
          >
            {{ current }}
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
          <b-collapse class="card" animation="slide" :open="!!sub">
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
                v-for="h in sub"
                :key="h"
                class="font-han clickable"
                @contextmenu.prevent="
                  (evt) => {
                    selectedHanzi = h
                    $refs.hanziContextmenu.open(evt)
                  }
                "
              >
                {{ h }}
              </span>
            </div>
          </b-collapse>

          <b-collapse class="card" animation="slide" :open="!!sup">
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
                v-for="h in sup"
                :key="h"
                class="font-han clickable"
                @contextmenu.prevent="
                  (evt) => {
                    selectedHanzi = h
                    $refs.hanziContextmenu.open(evt)
                  }
                "
              >
                {{ h }}
              </span>
            </div>
          </b-collapse>

          <b-collapse class="card" animation="slide" :open="!!variants">
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
                v-for="h in variants"
                :key="h"
                class="font-han clickable"
                @contextmenu.prevent="
                  (evt) => {
                    selectedHanzi = h
                    $refs.hanziContextmenu.open(evt)
                  }
                "
              >
                {{ h }}
              </span>
            </div>
          </b-collapse>

          <b-collapse class="card" animation="slide" :open="vocabs.length > 0">
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
              <div v-for="(v, i) in vocabs" :key="i" class="long-item">
                <span
                  class="clickable"
                  @contextmenu.prevent="
                    (evt) => {
                      selectedVocab = v.simplified
                      $refs.vocabContextmenu.open(evt)
                    }
                  "
                >
                  {{ v.simplified }}
                </span>

                <span
                  v-if="v.traditional"
                  class="clickable"
                  @contextmenu.prevent="
                    (evt) => {
                      selectedVocab = v.traditional
                      $refs.vocabContextmenu.open(evt)
                    }
                  "
                >
                  {{ v.traditional }}
                </span>

                <span class="pinyin">[{{ v.pinyin }}]</span>

                <span>{{ v.english }}</span>
              </div>
            </div>
          </b-collapse>

          <b-collapse
            class="card"
            animation="slide"
            :open="sentences.length > 0"
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
              <div v-for="(s, i) in sentences" :key="i" class="long-item">
                <span
                  class="clickable"
                  @contextmenu.prevent="
                    (evt) => {
                      selectedSentence = s.chinese
                      $refs.sentenceContextmenu.open(evt)
                    }
                  "
                >
                  {{ s.chinese }}
                </span>

                <span>{{ s.english }}</span>
              </div>
            </div>
          </b-collapse>
        </div>
      </div>
    </div>

    <client-only>
      <vue-context ref="hanziContextmenu" lazy>
        <li>
          <a
            role="button"
            @click.prevent="speak(selectedHanzi)"
            @keypress.prevent="speak(selectedHanzi)"
          >
            Speak
          </a>
        </li>
        <li v-if="!hanziIds[selectedHanzi]">
          <a
            role="button"
            @click.prevent="addToQuiz(selectedHanzi, 'hanzi')"
            @keypress.prevent="addToQuiz(selectedHanzi, 'hanzi')"
          >
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz(selectedHanzi, 'hanzi')"
            @keypress.prevent="removeFromQuiz(selectedHanzi, 'hanzi')"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <router-link
            :to="{ path: '/vocab', query: { q: selectedHanzi } }"
            target="_blank"
          >
            Search for vocab
          </router-link>
        </li>
        <li>
          <router-link
            :to="{ path: '/hanzi', query: { q: selectedHanzi } }"
            target="_blank"
          >
            Search for Hanzi
          </router-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${selectedHanzi}*`"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in MDBG
          </a>
        </li>
      </vue-context>

      <vue-context ref="vocabContextmenu" lazy>
        <li>
          <a
            role="button"
            @click.prevent="speak(selectedVocab)"
            @keypress.prevent="speak(selectedVocab)"
          >
            Speak
          </a>
        </li>
        <li v-if="!vocabIds[selectedVocab]">
          <a
            role="button"
            @click.prevent="addToQuiz(selectedVocab, 'vocab')"
            @keypress.prevent="addToQuiz(selectedVocab, 'vocab')"
          >
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz(selectedVocab, 'vocab')"
            @keypress.prevent="removeFromQuiz(selectedVocab, 'vocab')"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <router-link
            :to="{ path: '/vocab', query: { q: selectedVocab } }"
            target="_blank"
          >
            Search for vocab
          </router-link>
        </li>
        <li>
          <router-link
            :to="{ path: '/hanzi', query: { q: selectedVocab } }"
            target="_blank"
          >
            Search for Hanzi
          </router-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${selectedVocab}*`"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in MDBG
          </a>
        </li>
      </vue-context>

      <vue-context ref="sentenceContextmenu" lazy>
        <li>
          <a
            role="button"
            @click.prevent="speak(selectedSentence)"
            @keypress.prevent="speak(selectedSentence)"
          >
            Speak
          </a>
        </li>
        <li v-if="!sentenceIds[selectedSentence]">
          <a
            role="button"
            @click.prevent="addToQuiz(selectedSentence, 'sentence')"
            @keypress.prevent="addToQuiz(selectedSentence, 'sentence')"
          >
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz(selectedSentence, 'sentence')"
            @keypress.prevent="removeFromQuiz(selectedSentence, 'sentence')"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <router-link
            :to="{ path: '/vocab', query: { q: selectedSentence } }"
            target="_blank"
          >
            Search for vocab
          </router-link>
        </li>
        <li>
          <router-link
            :to="{ path: '/hanzi', query: { q: selectedSentence } }"
            target="_blank"
          >
            Search for Hanzi
          </router-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${selectedSentence}`"
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

@Component<HanziPage>({
  layout: 'app',
  watch: {
    q() {
      this.onQChange(this.q)
    },
    current() {
      this.load()
    },
    selectedHanzi() {
      this.loadHanziStatus()
    },
    selectedVocab() {
      this.loadVocabStatus()
    },
    selectedSentence() {
      this.loadSentenceStatus()
    },
  },
})
export default class HanziPage extends Vue {
  entries: string[] = []
  i: number = 0

  sub = ''
  sup = ''
  variants = ''
  vocabs: any[] = []
  sentences: any[] = []

  selectedHanzi = ''
  selectedVocab = ''
  selectedSentence = ''

  hanziIds: any = {}
  vocabIds: any = {}
  sentenceIds: any = {}

  speak = speak

  q0 = ''

  get q() {
    const q = this.$route.query.q
    return (Array.isArray(q) ? q[0] : q) || ''
  }

  set q(q: string) {
    this.$router.push({ query: { q } })
  }

  get current() {
    return this.entries[this.i]
  }

  created() {
    this.q0 = this.q
    this.onQChange(this.q0)
  }

  onQChange(q: string) {
    const qs = q.split('').filter((h) => XRegExp('\\p{Han}').test(h))
    this.$set(
      this,
      'entries',
      qs.filter((h, i) => qs.indexOf(h) === i)
    )
    this.i = 0
    this.load()
  }

  load() {
    if (this.current) {
      this.loadHanzi()
      this.loadVocab()
      this.loadSentences()
    } else {
      this.sub = ''
      this.sup = ''
      this.variants = ''
      this.vocabs = []
      this.sentences = []
    }
  }

  async loadHanzi() {
    const r = (
      await this.$axios.$get('/api/hanzi/match', {
        params: {
          entry: this.current,
        },
      })
    ).result
    this.sub = r.sub
    this.sup = r.sup
    this.variants = r.variants
  }

  async loadVocab() {
    const { result } = await this.$axios.$get('/api/vocab/q', {
      params: {
        entry: this.current,
        limit: -1,
      },
    })
    this.$set(this, 'vocabs', result)
  }

  async loadSentences() {
    const { result } = await this.$axios.$get('/api/sentence/q', {
      params: {
        entry: this.current,
      },
    })
    this.$set(this, 'sentences', result)
  }

  async loadHanziStatus() {
    if (this.selectedHanzi) {
      const { result } = await this.$axios.$get('/api/quiz/entry', {
        params: {
          entry: this.selectedHanzi,
          type: 'hanzi',
          select: ['_id'],
        },
      })
      this.$set(this.hanziIds, this.selectedHanzi, !!result.length)
    }
  }

  async loadVocabStatus() {
    if (this.selectedVocab) {
      const { result } = await this.$axios.$get('/api/quiz/entry', {
        params: {
          entry: this.selectedVocab,
          type: 'vocab',
          select: ['_id'],
        },
      })
      this.$set(this.vocabIds, this.selectedVocab, !!result.length)
    }
  }

  async loadSentenceStatus() {
    if (this.selectedSentence) {
      const { result } = await this.$axios.$get('/api/quiz/entry', {
        params: {
          entry: this.selectedSentence,
          type: 'sentence',
          select: ['_id'],
        },
      })
      this.$set(
        this.sentenceIds,
        this.selectedSentence,
        result.map((d: any) => d._id)
      )
    }
  }

  async addToQuiz(entry: string, type: string) {
    await this.$axios.$put('/api/quiz/', { entry, type })
    this.$buefy.snackbar.open(`Added ${type}: ${entry} to quiz`)

    type === 'vocab' ? this.loadVocabStatus() : this.loadHanziStatus()
  }

  async removeFromQuiz(entry: string, type: string) {
    const ids =
      (type === 'vocab' ? this.vocabIds[entry] : this.hanziIds[entry]) || []
    await Promise.all(
      ids.map((id: string) =>
        this.$axios.$delete('/api/quiz/', {
          params: { id },
        })
      )
    )
    this.$buefy.snackbar.open(`Removed ${type}: ${entry} from quiz`)

    type === 'vocab' ? this.loadVocabStatus() : this.loadHanziStatus()
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

.long-item > span + span {
  margin-left: 1rem;
}

.long-item > .pinyin {
  min-width: 8rem;
}
</style>
