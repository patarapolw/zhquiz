<template>
  <section class="desktop:overflow-visible">
    <div class="RandomPage">
      <div class="columns w-full">
        <div class="column is-6">
          <div class="item-display item-display-top">
            <b-tooltip :label="current.hanzi.translation">
              <div
                class="font-han hanzi clickable"
                @contextmenu.prevent="
                  (evt) => openSelectedContextmenu(evt, 'hanzi')
                "
              >
                {{ current.hanzi.entry }}
              </div>
            </b-tooltip>
            <b-loading
              :active="!current.hanzi.entry"
              :is-full-page="false"
            ></b-loading>
          </div>
          <center>Hanzi of the day</center>
        </div>

        <div class="column is-6">
          <div class="item-display item-display-top">
            <b-tooltip :label="current.vocab.translation">
              <div
                class="font-zh-simp hanzi clickable"
                @contextmenu.prevent="
                  (evt) => openSelectedContextmenu(evt, 'vocab')
                "
              >
                {{ current.vocab.entry }}
              </div>
            </b-tooltip>
            <b-loading
              :active="!current.vocab.entry"
              :is-full-page="false"
            ></b-loading>
          </div>
          <center>Vocab of the day</center>
        </div>
      </div>

      <div class="item-display item-display-bottom">
        <b-tooltip :label="current.sentence.translation">
          <div
            class="font-zh-simp hanzi clickable text-center"
            @contextmenu.prevent="
              (evt) => openSelectedContextmenu(evt, 'sentence')
            "
          >
            {{ current.sentence.entry }}
          </div>
        </b-tooltip>
        <b-loading :active="!current.sentence.entry" :is-full-page="false" />
      </div>
      <center>Sentence of the day</center>
    </div>

    <client-only>
      <vue-context ref="contextmenu" lazy>
        <li>
          <a
            role="button"
            @click.prevent="reload()"
            @keypress.prevent="reload()"
          >
            Reload
          </a>
        </li>
        <li>
          <a
            role="button"
            @click.prevent="doSpeak()"
            @keypress.prevent="doSpeak()"
          >
            Speak
          </a>
        </li>
        <li v-if="!selected.quizIds.length">
          <a
            role="button"
            @click.prevent="addToQuiz()"
            @keypress.prevent="addToQuiz()"
          >
            Add to quiz
          </a>
        </li>
        <li v-else>
          <a
            role="button"
            @click.prevent="removeFromQuiz()"
            @keypress.prevent="removeFromQuiz()"
          >
            Remove from quiz
          </a>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/vocab', query: { q: selected.entry } }"
            target="_blank"
          >
            Search for vocab
          </nuxt-link>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/hanzi', query: { q: selected.entry } }"
            target="_blank"
          >
            Search for Hanzi
          </nuxt-link>
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
import { Component, Vue } from 'nuxt-property-decorator'

import { doMapKeypress } from '~/assets/keypress'
import { speak } from '~/assets/speak'

type IRandomType = 'hanzi' | 'vocab' | 'sentence'

interface IRandomItem {
  entry: string
  translation: string
}

@Component<RandomPage>({
  layout: 'app',
  created() {
    this.onUserChanged()
  },
  mounted() {
    window.onkeypress = this.onKeypress.bind(this)
  },
  beforeDestroy() {
    window.onkeypress = null
  },
})
export default class RandomPage extends Vue {
  current: Record<IRandomType, IRandomItem> = {
    hanzi: {
      entry: '',
      translation: '',
    },
    vocab: {
      entry: '',
      translation: '',
    },
    sentence: {
      entry: '',
      translation: '',
    },
  }

  selected: {
    entry?: string
    type?: IRandomType
    quizIds: string[]
  } = {
    quizIds: [],
  }

  levelMin = 0
  level = 0

  onKeypress(evt: KeyboardEvent) {
    doMapKeypress(evt, {
      '1': () => this.reload('hanzi'),
      '2': () => this.reload('vocab'),
      '3': () => this.reload('sentence'),
      q: () => this.doSpeak('hanzi'),
      w: () => this.doSpeak('vocab'),
      e: () => this.doSpeak('sentence'),
    })
  }

  async doSpeak(type?: IRandomType) {
    const { entry } = type ? this.current[type] : this.selected
    if (!entry) {
      return
    }

    await speak(entry)
  }

  async onUserChanged() {
    const { levelMin, level } = await this.$axios.$get('/api/user', {
      params: {
        select: ['levelMin', 'level'],
      },
    })
    this.levelMin = levelMin || 1
    this.level = level || 60

    await Promise.all([
      this.reload('hanzi'),
      this.reload('vocab'),
      this.reload('sentence'),
    ])
  }

  async reload(type?: IRandomType) {
    type = type || this.selected.type
    if (!type) {
      return
    }

    const r = await this.$axios.$get('/api/dictionary/random', {
      params: {
        type: [type],
        select: ['entry', 'translation'],
        level: [this.levelMin, this.level],
      },
    })

    this.current[type].entry = ''
    this.current[type].translation = ''

    if (r && r.result && r.result[0]) {
      const { entry = '', translation: [translation = ''] = [] } = r.result[0]
      this.current[type].entry = entry
      this.current[type].translation = translation
    }

    this.$set(this.current, type, this.current[type])
  }

  async addToQuiz() {
    const { entry, type } = this.selected
    if (!entry || !type) {
      return
    }

    if (entry) {
      await this.$axios.$put('/api/quiz/entries', {
        entries: [entry],
        type,
      })
      await this.getQuizStatus(type)

      this.$buefy.snackbar.open(`Added ${type}: ${entry} to quiz`)
    }
  }

  async removeFromQuiz() {
    const { entry, type, quizIds } = this.selected
    if (!entry || !type || !quizIds.length) {
      return
    }

    await this.$axios.$post('/api/quiz/delete/ids', {
      ids: quizIds,
    })
    await this.getQuizStatus(type)

    this.$buefy.snackbar.open(`Removed ${type}: ${entry} to quiz`)
  }

  async getQuizStatus(type: IRandomType) {
    const { entry } = this.current[type]
    let quizIds: string[] = []

    if (entry) {
      const { result } = await this.$axios.$get('/api/quiz/entry', {
        params: {
          entry,
          select: ['_id'],
          limit: -1,
        },
      })
      quizIds = result.map(({ _id }: any) => _id)
    }

    this.selected.quizIds = quizIds
  }

  async openSelectedContextmenu(evt: MouseEvent, type: IRandomType) {
    await this.getQuizStatus(type)
    const { entry } = this.current[type]
    this.selected.entry = entry
    this.selected.type = type
    ;(this.$refs.contextmenu as any).open(evt)
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
