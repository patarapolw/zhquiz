<template>
  <section class="desktop:overflow-visible">
    <div class="RandomPage">
      <div class="columns w-full">
        <div class="column is-6">
          <div class="item-display item-display-top">
            <b-tooltip :label="hanzi.english">
              <div
                class="font-han hanzi clickable"
                @contextmenu.prevent="(evt) => $refs.hanziContextmenu.open(evt)"
              >
                {{ hanzi.item }}
              </div>
            </b-tooltip>
            <b-loading :active="!hanzi.item" :is-full-page="false"></b-loading>
          </div>
          <center>Hanzi of the day</center>
        </div>

        <div class="column is-6">
          <div class="item-display item-display-top">
            <b-tooltip :label="vocab.english">
              <div
                class="font-zh-simp hanzi clickable"
                @contextmenu.prevent="
                  (evt) =>
                    getQuizStatus(sentence).then(() =>
                      $refs.vocabContextmenu.open(evt)
                    )
                "
              >
                {{ vocab.item }}
              </div>
            </b-tooltip>
            <b-loading :active="!vocab.item" :is-full-page="false"></b-loading>
          </div>
          <center>Vocab of the day</center>
        </div>
      </div>

      <div class="item-display item-display-bottom">
        <b-tooltip :label="sentence.english">
          <div
            class="font-zh-simp hanzi clickable text-center"
            @contextmenu.prevent="
              (evt) =>
                getQuizStatus(sentence).then(() =>
                  $refs.sentenceContextmenu.open(evt)
                )
            "
          >
            {{ sentence.item }}
          </div>
        </b-tooltip>
        <b-loading :active="!sentence.item" :is-full-page="false" />
      </div>
      <center>Sentence of the day</center>
    </div>

    <client-only>
      <vue-context ref="hanziContextmenu" lazy>
        <li>
          <a
            role="button"
            @click.prevent="loadHanzi"
            @keypress.prevent="loadHanzi"
          >
            Reload
          </a>
        </li>
        <li>
          <a
            role="button"
            @click.prevent="speak(hanzi.item)"
            @keypress.prevent="speak(hanzi.item)"
          >
            Speak
          </a>
        </li>
        <li v-if="!hanzi.id.length">
          <a
            role="button"
            @click.prevent="addToQuiz(hanzi)"
            @keypress.prevent="addToQuiz(hanzi)"
          >
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz(hanzi)"
            @keypress.prevent="removeFromQuiz(hanzi)"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/vocab', query: { q: hanzi.item } }"
            target="_blank"
          >
            Search for vocab
          </nuxt-link>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/hanzi', query: { q: hanzi.item } }"
            target="_blank"
          >
            Search for Hanzi
          </nuxt-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${hanzi.item}*`"
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
            @click.prevent="loadVocab"
            @keypress.prevent="loadVocab"
          >
            Reload
          </a>
        </li>
        <li>
          <a
            role="button"
            @click.prevent="speak(vocab.item)"
            @keypress.prevent="speak(vocab.item)"
          >
            Speak
          </a>
        </li>
        <li v-if="!vocab.id.length">
          <a
            role="button"
            @click.prevent="addToQuiz(vocab)"
            @keypress.prevent="addToQuiz(vocab)"
          >
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz(vocab)"
            @keypress.prevent="removeFromQuiz(vocab)"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/vocab', query: { q: vocab.item } }"
            target="_blank"
          >
            Search for vocab
          </nuxt-link>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/hanzi', query: { q: vocab.item } }"
            target="_blank"
          >
            Search for Hanzi
          </nuxt-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${vocab.item}*`"
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
            @click.prevent="loadSentence"
            @keypress.prevent="loadSentence"
          >
            Reload
          </a>
        </li>
        <li>
          <a
            role="button"
            @click.prevent="speak(sentence.item)"
            @keypress.prevent="speak(sentence.item)"
          >
            Speak
          </a>
        </li>
        <li v-if="!sentence.id.length">
          <a
            role="button"
            @click.prevent="addToQuiz(sentence)"
            @keypress.prevent="addToQuiz(sentence)"
          >
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz(sentence)"
            @keypress.prevent="removeFromQuiz(sentence)"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/vocab', query: { q: sentence.item } }"
            target="_blank"
          >
            Search for vocab
          </nuxt-link>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/hanzi', query: { q: sentence.item } }"
            target="_blank"
          >
            Search for Hanzi
          </nuxt-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${sentence.item}`"
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
import { Component, Vue } from 'nuxt-property-decorator'

import { doMapKeypress } from '~/assets/keypress'
import { speak } from '~/assets/speak'

@Component<RandomPage>({
  layout: 'app',
  mounted() {
    window.onkeypress = this.onKeypress.bind(this)
    Promise.all([this.loadHanzi(), this.loadVocab(), this.loadSentence()])
  },
  beforeDestroy() {
    window.onkeypress = null
  },
})
export default class RandomPage extends Vue {
  hanzi = {
    type: 'hanzi',
    entry: null,
    english: null,
    id: [],
  }

  vocab = {
    type: 'vocab',
    entry: null,
    english: null,
    id: [],
  }

  sentence = {
    type: 'sentence',
    entry: null,
    english: null,
    id: [],
  }

  get level() {
    return this.$accessor.level
  }

  get levelMin() {
    return this.$accessor.levelMin
  }

  onKeypress(evt: KeyboardEvent) {
    doMapKeypress(evt, {
      '1': () => this.loadHanzi(),
      '2': () => this.loadVocab(),
      '3': () => this.loadSentence(),
      q: () => this.speak(this.hanzi.entry),
      w: () => this.speak(this.vocab.entry),
      e: () => this.speak(this.sentence.entry),
    })
  }

  async speak(s?: string | null) {
    if (s) {
      speak(s)
    }
  }

  async loadHanzi() {
    if (this.level) {
      const { result, english = null } = await this.$axios.$get(
        '/api/hanzi/random',
        {
          params: {
            levelMin: this.levelMin,
            level: this.level,
          },
        }
      )

      this.hanzi.entry = result
      this.hanzi.english = english
    }
  }

  async loadVocab() {
    if (this.level) {
      const { result, english = null } = await this.$axios.$get(
        '/api/vocab/random',
        {
          params: {
            levelMin: this.levelMin,
            level: this.level,
          },
        }
      )

      this.vocab.entry = result
      this.vocab.english = english
    }
  }

  async loadSentence() {
    if (this.level) {
      const { result, english = null } = await this.$axios.$get(
        '/api/sentence/random',
        {
          params: {
            levelMin: this.levelMin,
            level: this.level,
          },
        }
      )
      this.sentence.entry = result
      this.sentence.english = english
    }
  }

  async getQuizStatus(it: any) {
    const vm = this as any

    const { result } = await this.$axios.$get('/api/quiz/entry', {
      params: {
        entry: it.entry,
        type: it.type,
        select: ['_id'],
      },
    })

    this.$set(
      vm[it.type],
      'id',
      result.map((el: any) => el._id)
    )
  }

  async addToQuiz(it: any) {
    await this.$axios.$put('/api/quiz/', {
      entry: it.entry,
      type: it.type,
    })

    this.$buefy.snackbar.open(`Added ${it.type}: ${it.entry} to quiz`)
  }

  async removeFromQuiz(it: any) {
    const vm = this as any

    await this.$axios.$post('/api/quiz/delete/ids', {
      ids: vm[it.type].id,
    })

    this.$buefy.snackbar.open(`Removed ${it.type}: ${it.entry} from quiz`)
  }
}
</script>

<style scoped>
.RandomPage {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.item-display {
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 1em;
  position: relative;
}

.item-display-top .hanzi {
  font-size: 50px;
  min-height: 60px;
}

.item-display-bottom .hanzi {
  font-size: 30px;
  min-width: 3em;
  min-height: 40px;
}

@media screen and (min-width: 1025px) {
  .desktop\:overflow-visible {
    overflow: visible;
  }
}
</style>
