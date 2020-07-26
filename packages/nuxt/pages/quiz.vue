<template>
  <section>
    <div v-if="isInit" class="QuizPage">
      <div class="columns">
        <div class="column is-4">
          <div class="field">
            <label class="label">Type</label>
            <b-field class="flex-wrap">
              <b-checkbox-button
                v-model="type"
                native-value="hanzi"
                type="is-success"
              >
                Hanzi
              </b-checkbox-button>
              <b-checkbox-button
                v-model="type"
                native-value="vocab"
                type="is-success"
              >
                Vocab
              </b-checkbox-button>
              <b-checkbox-button
                v-model="type"
                native-value="sentence"
                type="is-success"
              >
                Sentence
              </b-checkbox-button>
              <b-checkbox-button
                v-model="type"
                native-value="extra"
                type="is-success"
              >
                Extra
              </b-checkbox-button>
            </b-field>
          </div>
        </div>
        <div class="column is-4">
          <div class="field">
            <label class="label">Learning stage</label>
            <b-field class="flex-wrap">
              <b-checkbox-button
                v-model="stage"
                native-value="new"
                type="is-success"
              >
                New
              </b-checkbox-button>
              <b-checkbox-button
                v-model="stage"
                native-value="leech"
                type="is-success"
              >
                Leech
              </b-checkbox-button>
              <b-checkbox-button
                v-model="stage"
                native-value="learning"
                type="is-success"
              >
                Learning
              </b-checkbox-button>
              <b-checkbox-button
                v-model="stage"
                native-value="graduated"
                type="is-success"
              >
                Graduated
              </b-checkbox-button>
            </b-field>
          </div>
        </div>
        <div class="column is-4">
          <div class="field">
            <label class="label">Due</label>
            <div class="control">
              <b-switch v-model="isDue">Due only</b-switch>
            </div>
          </div>
        </div>
      </div>

      <div class="columns">
        <div class="column is-6">
          <div class="field">
            <label class="label">Direction</label>
            <b-field class="flex-wrap">
              <b-checkbox-button
                v-model="direction"
                native-value="se"
                type="is-success"
              >
                Simplified-English
              </b-checkbox-button>
              <b-checkbox-button
                v-model="direction"
                native-value="te"
                type="is-success"
              >
                Traditional-English
              </b-checkbox-button>
              <b-checkbox-button
                v-model="direction"
                native-value="ec"
                type="is-success"
              >
                English-Chinese
              </b-checkbox-button>
            </b-field>
          </div>
        </div>
        <div class="column is-6">
          <b-field label="Filter by tags">
            <b-taginput
              v-model="selectedTags"
              icon="tag"
              placeholder="Add a tag"
              :data="filteredTags"
              autocomplete
              :allow-new="false"
              open-on-focus
              @typing="getFilteredTags"
            />
          </b-field>
        </div>
      </div>

      <b-collapse class="card" animation="slide" :open="isQuizDashboardReady">
        <div
          slot="trigger"
          slot-scope="props"
          class="card-header"
          role="button"
        >
          <p class="card-header-title">Quiz</p>
          <a role="button" class="card-header-icon">
            <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
          </a>
        </div>
        <div class="card-content">
          <div class="columns">
            <div class="column is-3">
              <div v-if="!isDue">
                <span class="column-label">Pending: </span>
                <span>{{ data.length | format }}</span>
              </div>
              <div v-else-if="dueItems.length">
                <span class="column-label">Due: </span>
                <span>{{ dueItems.length | format }}</span>
              </div>
              <div v-else-if="dueIn">
                <span class="column-label">Due in: </span>
                <span>{{ dueIn | duration }}</span>
              </div>
              <div v-else>
                <span>No items due</span>
              </div>
            </div>

            <div class="column is-3">
              <span class="column-label">New: </span>
              <span>{{ newItems.length | format }}</span>
            </div>
            <div class="column is-3">
              <span class="column-label">Leech: </span>
              <span>{{ leechItems.length | format }}</span>
            </div>
            <div class="column is-3 flex flex-row">
              <div class="flex-grow" />
              <b-button
                type="is-success"
                :disabled="data.length === 0"
                @click="startQuiz"
              >
                Start Quiz
              </b-button>
            </div>
          </div>
        </div>
      </b-collapse>

      <b-collapse class="card" animation="slide" :open.sync="isTableShown">
        <div
          slot="trigger"
          slot-scope="props"
          class="card-header"
          role="button"
        >
          <p class="card-header-title">
            {{ props.open ? 'Hide items' : 'Show items' }}
          </p>
          <a role="button" class="card-header-icon">
            <fontawesome :icon="props.open ? 'caret-down' : 'caret-up'" />
          </a>
        </div>
        <div class="card-content">
          <b-table
            :data="data"
            paginated
            :per-page="10"
            checkable
            @contextmenu="onTableContextmenu"
          >
            <template slot-scope="props">
              <b-table-column
                field="type"
                label="Type"
                width="100"
                searchable
                sortable
              >
                {{ props.row.type }}
              </b-table-column>
              <b-table-column field="item" label="Item" searchable sortable>
                {{ props.row.item }}
              </b-table-column>
              <b-table-column
                field="direction"
                label="Direction"
                searchable
                sortable
              >
                <span v-if="props.row.direction === 'ec'">English-Chinese</span>
                <span v-else-if="props.row.direction === 'te'">
                  Traditional-English
                </span>
                <span v-else-if="props.row.type === 'vocab'">
                  Simplified-English
                </span>
                <span v-else>Chinese-English</span>
              </b-table-column>
              <b-table-column field="tag" label="Tag" searchable>
                <b-tag v-for="t in props.row.tag || []" :key="t">{{ t }}</b-tag>
              </b-table-column>
              <b-table-column
                field="srsLevel"
                label="SRS Level"
                searchable
                sortable
              >
                {{ props.row.srsLevel }}
              </b-table-column>
              <b-table-column
                field="nextReview"
                label="Next Review"
                searchable
                sortable
              >
                {{ props.row.nextReview | formatDate }}
              </b-table-column>
            </template>
          </b-table>
        </div>
      </b-collapse>

      <b-modal :active.sync="isEditTagModal" @close="onEditTagModelClose">
        <div class="card">
          <div class="card-header">
            <div class="card-header-title">Edit tags</div>
          </div>
          <div class="card-content">
            <b-taginput
              v-model="selectedRow.tag"
              icon="tag"
              placeholder="Add a tag"
              :data="filteredTags"
              autocomplete
              :allow-new="true"
              open-on-focus
              @typing="getFilteredTags"
            />
            <div class="field taginput-field">
              <b-button @click="isEditTagModal = false">Close</b-button>
            </div>
          </div>
        </div>
      </b-modal>

      <b-modal class="quiz-modal" :active.sync="isQuizModal" @close="endQuiz">
        <div class="card">
          <div v-if="quizCurrent" class="card-content">
            <div
              v-show="!isQuizShownAnswer"
              ref="quizFront"
              class="content"
              v-html="quizFront"
            />
            <div
              v-show="isQuizShownAnswer"
              ref="quizBack"
              class="content"
              v-html="quizBack"
            />
            <b-loading :active="!isQuizItemReady" :is-full-page="false" />
          </div>

          <div class="buttons-area">
            <div v-if="!quizCurrent" class="buttons">
              <button
                ref="btnEndQuiz"
                class="button is-warning"
                @click="endQuiz"
                @keypress="endQuiz"
              >
                End quiz
              </button>
            </div>
            <div v-else-if="!isQuizShownAnswer" class="buttons">
              <button
                ref="btnShowAnswer"
                class="button is-warning"
                @click="isQuizShownAnswer = true"
                @keypress="isQuizShownAnswer = true"
              >
                Show answer
              </button>
            </div>
            <div v-else class="buttons-panel">
              <div class="buttons">
                <button
                  ref="btnMarkRight"
                  class="button is-success"
                  @click="markRight"
                  @keypress="markRight"
                >
                  Right
                </button>
                <button
                  ref="btnMarkWrong"
                  class="button is-danger"
                  @click="markWrong"
                  @keypress="markWrong"
                >
                  Wrong
                </button>
                <button
                  ref="btnMarkRepeat"
                  class="button is-warning"
                  @click="markRepeat"
                  @keypress="markRepeat"
                >
                  Repeat
                </button>
              </div>

              <div class="buttons">
                <button
                  ref="btnHideAnswer"
                  class="button is-warning"
                  @click="isQuizShownAnswer = false"
                  @keypress="isQuizShownAnswer = false"
                >
                  Hide answer
                </button>
                <button
                  ref="btnEditModal"
                  class="button is-info"
                  @click="
                    editItem = quizCurrent
                    isEditModal = true
                  "
                  @keypress="
                    editItem = quizCurrent
                    isEditModal = true
                  "
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </b-modal>

      <b-modal class="edit-modal" :active.sync="isEditModal">
        <div class="card">
          <div class="card-content">
            <b-tabs type="is-boxed" @change="onEditTabChange">
              <b-tab-item label="Front">
                <MarkdownEditor
                  ref="mde0"
                  v-model="editItem.front"
                  :renderer="previewRender"
                />
              </b-tab-item>
              <b-tab-item label="Back">
                <MarkdownEditor
                  ref="mde1"
                  v-model="editItem.back"
                  :renderer="previewRender"
                />
              </b-tab-item>
              <b-tab-item label="Mnemonic">
                <MarkdownEditor
                  ref="mde2"
                  v-model="editItem.mnemonic"
                  :renderer="previewRender"
                />
              </b-tab-item>
            </b-tabs>
          </div>

          <div class="card-footer">
            <div class="flex-grow" />
            <div class="buttons">
              <button
                class="button is-success"
                @click="doEditSave"
                @keypress="doEditSave"
              >
                Save
              </button>
              <button
                class="button is-danger"
                @click="doEditLoad"
                @keypress="doEditLoad"
              >
                Reset
              </button>
              <button
                class="button"
                @click="isEditModal = false"
                @keypress="isEditModal = false"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </b-modal>

      <b-loading :active="isLoading" />

      <client-only>
        <vue-context ref="contextmenu" lazy>
          <li>
            <a
              role="button"
              @click.prevent="speak(selectedRow.item)"
              @keypress.prevent="speak(selectedRow.item)"
            >
              Speak
            </a>
          </li>
          <li>
            <a
              role="button"
              @click.prevent="isEditTagModal = true"
              @keypress.prevent="isEditTagModal = true"
            >
              Edit tags
            </a>
          </li>
          <li>
            <a
              role="button"
              @click.prevent="
                editItem = selectedRow
                isEditModal = true
              "
              @keypress.prevent="
                editItem = selectedRow
                isEditModal = true
              "
            >
              Edit item
            </a>
          </li>
          <li>
            <a
              role="button"
              @click.prevent="removeItem"
              @keypress.prevent="removeItem"
            >
              Remove item
            </a>
          </li>
        </vue-context>
      </client-only>
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'nuxt-property-decorator'

import cardDefault from '~/assets/card-default.yaml'
import { doClick, doMapKeypress } from '~/assets/keypress'
import { markdownToHtml } from '~/assets/make-html'
import { speak } from '~/assets/speak'
import { shuffle } from '~/assets/util'

interface IQuizData {
  type: string
  item: string
  raw: any
  cards: {
    _id: string
    direction: string
    front: string
    back: string
    mnemonic: string
  }[]
}

@Component({
  layout: 'app',
})
export default class QuizPage extends Vue {
  isLoading = false
  isInit = false
  isQuizDashboardReady = false

  selectedTags: string[] = []
  filteredTags: string[] = []
  allTags: string[] = []

  type = ['hanzi', 'vocab', 'sentence', 'extra']
  stage = ['new', 'leech', 'learning']
  direction = ['se']
  isDue = true

  dueIn: Date | null = null
  data: any[] = []
  isTableShown = false

  selectedRow = {} as any
  isEditTagModal = false

  isQuizModal = false
  quizItems: any[] = []
  quizIndex = 0
  isQuizShownAnswer = false
  isQuizItemReady = false

  quizFront = ''
  quizBack = ''
  quizMnemonic = ''
  quizData: IQuizData[] = []
  quizCurrentData: any = null

  isEditModal = false
  editItem = {
    _id: '',
    front: '',
    back: '',
    mnemonic: '',
    type: '',
    item: '',
    direction: '',
  }

  speak = speak

  get email() {
    const u = this.$store.state.user
    return u ? (u.email as string) : undefined
  }

  get backlogItems() {
    const now = +new Date()
    return this.data.filter(
      (d) => d.nextReview && +new Date(d.nextReview) < now
    )
  }

  get dueItems() {
    return [...this.backlogItems, ...this.newItems]
  }

  get newItems() {
    return this.data.filter((d) => typeof d.srsLevel === 'undefined')
  }

  get leechItems() {
    return this.data.filter((d) => {
      const { wrong } = (d.stat || {}).streak || {}
      if (wrong) return wrong >= 3

      return false
    })
  }

  get quizCurrent() {
    return this.quizItems[this.quizIndex]
  }

  async created() {
    await this.onUserChange()
    this.isQuizDashboardReady = true
  }

  beforeDestroy() {
    window.onkeypress = null
  }

  previewRender(md: string) {
    const { type, item } = this.editItem
    const { raw } =
      this.quizData.filter((d) => {
        return d.type === type && d.item === item
      })[0] || {}

    return markdownToHtml(md, {
      ...this.editItem,
      raw,
    })
  }

  getQuizFront() {
    let template = ''

    if (this.quizCurrent) {
      const { type, item, direction } = this.quizCurrent
      const { raw = null, cards = [] } =
        this.quizData.filter((d) => {
          return d.type === type && d.item === item
        })[0] || {}

      this.quizCurrentData = raw

      const { front } =
        cards.filter((c) => {
          return c.direction === direction
        })[0] || {}

      template = front || cardDefault[type][direction].front || ''

      return markdownToHtml(template, {
        ...this.quizCurrent,
        raw: this.quizCurrentData,
      })
    }

    return ''
  }

  getQuizBack() {
    let template = ''

    if (this.quizCurrent) {
      const { type, item, direction } = this.quizCurrent
      const { raw = null, cards = [] } =
        this.quizData.filter((d) => {
          return d.type === type && d.item === item
        })[0] || {}

      this.quizCurrentData = raw

      const { back } =
        cards.filter((c) => {
          return c.direction === direction
        })[0] || {}

      template = back || cardDefault[type][direction].back || ''

      return markdownToHtml(template, {
        ...this.quizCurrent,
        raw: this.quizCurrentData,
      })
    }

    return ''
  }

  @Watch('email')
  async onUserChange() {
    if (this.email) {
      await Promise.all([
        (async () => {
          const {
            settings: {
              quiz: { type, stage, direction, isDue } = {} as any,
            } = {},
          } = await this.$axios.$get('/api/user/')

          if (type) {
            this.$set(this, 'type', type)
          }

          if (stage) {
            this.$set(this, 'stage', stage)
          }

          if (direction) {
            this.$set(this, 'direction', direction)
          }

          if (typeof isDue !== 'undefined') {
            this.$set(this, 'isDue', isDue)
          }
          // eslint-disable-next-line no-console
        })().catch(console.error),
        (async () => {
          const { result } = await this.$axios.$post('/api/card/q', {
            projection: {
              tag: 1,
              _id: 0,
            },
            limit: null,
            hasCount: false,
          })

          this.allTags = Array.from(
            new Set<string>(
              (result as any[]).reduce(
                (prev, { tag = [] }: { tag: string[] }) => {
                  return [...prev, ...tag]
                },
                [] as string[]
              )
            )
          ).sort()

          // eslint-disable-next-line no-console
        })().catch(console.error),
      ])

      this.isInit = true
      this.isLoading = false

      this.data = []
      await this.load()
    }
  }

  @Watch('type')
  @Watch('stage')
  @Watch('direction')
  @Watch('isDue')
  async load(opts?: { _dueIn: boolean }) {
    let nextReview = undefined as any

    if (opts && opts._dueIn) {
      nextReview = { $exists: true }
    } else {
      this.$axios.$patch('/api/user/', {
        set: {
          'settings.quiz.type': this.type,
          'settings.quiz.stage': this.stage,
          'settings.quiz.direction': this.direction,
          'settings.quiz.isDue': this.isDue,
        },
      })
    }

    const cond: any = {
      tag: this.selectedTags,
      type: { $in: this.type },
      direction: { $in: this.direction },
      nextReview,
    }

    const $or: any[] = []

    if (this.stage.includes('new')) {
      $or.push({
        nextReview: { $exists: false },
      })
    }

    if (this.stage.includes('leech')) {
      $or.push({
        'stat.streak.wrong': { $gte: 3 },
      })
    }

    if (this.stage.includes('learning')) {
      $or.push({
        srsLevel: { $lt: 3 },
      })
    }

    if (this.stage.includes('graduated')) {
      $or.push({
        srsLevel: { $gte: 3 },
      })
    }

    let data: any[] = []

    if ($or.length > 0) {
      const $and = [cond, { $or }]

      if (this.isDue) {
        $and.push({
          $or: [
            { nextReview: { $lt: { $toDate: new Date().toISOString() } } },
            { nextReview: { $exists: false } },
          ],
        })
      }

      const { result } = await this.$axios.$post('/api/card/q', {
        cond: { $and },
        join: ['quiz'],
        projection:
          opts && opts._dueIn
            ? {
                nextReview: 1,
              }
            : {
                _id: 1,
                type: 1,
                item: 1,
                direction: 1,
                tag: 1,
                srsLevel: 1,
                nextReview: 1,
                stat: 1,
              },
        limit: opts && opts._dueIn ? 1 : null,
        sort:
          opts && opts._dueIn
            ? {
                nextReview: 1,
              }
            : undefined,
        hasCount: false,
      })

      data = result
    }

    if (opts && opts._dueIn) {
      return data
    }

    this.$set(this, 'data', data)
    this.getDueIn()

    return data
  }

  getFilteredTags(text: string) {
    this.filteredTags = this.allTags.filter((t) => {
      return t.toLocaleLowerCase().startsWith(text.toLocaleLowerCase())
    })
  }

  onTableContextmenu(row: any, evt: MouseEvent) {
    evt.preventDefault()

    this.selectedRow = row
    const contextmenu = this.$refs.contextmenu as any
    contextmenu.open(evt)
  }

  removeItem() {
    this.$buefy.dialog.confirm({
      message: 'Are you sure you want to remove this item?',
      confirmText: 'Remove',
      type: 'is-danger',
      hasIcon: true,
      onConfirm: async () => {
        await this.$axios.$delete('/api/card/', {
          data: {
            id: this.selectedRow._id,
          },
        })
        this.data = this.data.filter((d) => d._id !== this.selectedRow._id)
      },
    })
  }

  async onEditTagModelClose() {
    await this.$axios.$patch('/api/card/', {
      id: this.selectedRow._id,
      set: this.selectedRow.tag,
    })
  }

  async startQuiz() {
    this.quizItems = shuffle(this.data)
    this.quizIndex = -1
    await this.initNextQuizItem()

    window.onkeypress = this.onQuizKeypress.bind(this)
    this.isQuizModal = true
  }

  endQuiz() {
    window.onkeypress = null
    this.isQuizModal = false
    this.load()
  }

  async initNextQuizItem() {
    this.quizIndex++
    this.isQuizShownAnswer = false

    this.quizFront = this.getQuizFront()
    this.quizBack = this.getQuizBack()

    Array(2)
      .fill(null)
      .map((_, i) => {
        const it = this.quizItems[this.quizIndex + i + 1]
        if (it) {
          this.cacheQuizItem(it, true)
        }
      })

    if (this.quizCurrent) {
      await this.cacheQuizItem(this.quizCurrent)

      this.quizFront = this.getQuizFront()
      this.quizBack = this.getQuizBack()
    }
  }

  async cacheQuizItem(target: any, isFuture?: boolean) {
    const { type, item, _id, direction } = target
    let data = this.quizData.filter((d) => {
      return d.item === item && d.type === type
    })[0]

    if (!data) {
      if (!isFuture && direction !== 'se') {
        this.isQuizItemReady = false
      }

      const { result } = await this.$axios.$post(`/api/${type}/match`, {
        entry: item,
      })

      if (type === 'vocab') {
        const { vocabs } = result
        const simplified = vocabs[0].simplified
        const u = (k: string) => {
          const arr = (vocabs as any[])
            .map((v) => (v as any)[k] as string)
            .filter((t) => t)
            .filter((t, i, arr) => arr.indexOf(t) === i)
          return arr.length > 0 ? arr : undefined
        }

        Object.assign(result, {
          simplified,
          traditional: u('traditional'),
          pinyin: u('pinyin')!,
          english: u('english'),
        })
      }

      data = {
        type,
        item,
        raw: result,
        cards: [],
      }

      this.quizData.push(data)
    }

    let card = data.cards.filter((c) => c._id === _id)[0]
    if (!card) {
      card = await this.$axios.$get('/api/quiz/card', {
        params: { id: _id },
      })
      data.cards.push(card)
    }

    this.$set(this, 'quizData', this.quizData)
    this.isQuizItemReady = true
  }

  async markRight() {
    this.isQuizItemReady = false

    await this.$axios.$patch('/api/quiz/right', undefined, {
      params: { id: this.quizCurrent._id },
    })

    this.isQuizItemReady = true
    this.initNextQuizItem()
  }

  async markWrong() {
    this.isQuizItemReady = false

    await this.$axios.$patch('/api/quiz/wrong', undefined, {
      params: { id: this.quizCurrent._id },
    })

    this.isQuizItemReady = true
    this.initNextQuizItem()
  }

  async markRepeat() {
    this.isQuizItemReady = false

    await this.$axios.$patch('/api/quiz/repeat', undefined, {
      params: { id: this.quizCurrent._id },
    })

    this.isQuizItemReady = true
    this.initNextQuizItem()
  }

  async doEditSave() {
    const { front, back, mnemonic, type, item, direction } = this.editItem

    await this.$axios.$patch('/api/card/', {
      id: this.editItem._id,
      set: {
        front,
        back,
        mnemonic,
      },
    })

    const { cards = [] } =
      this.quizData.filter((d) => {
        return d.type === type && d.item === item
      })[0] || {}

    const card = cards.filter((c) => {
      return c.direction === direction
    })[0]

    if (!card) {
      cards.push(this.editItem)
    } else {
      Object.assign(card, this.editItem)
    }
    this.doEditLoad()

    this.$buefy.snackbar.open('Saved')
  }

  @Watch('isEditModal')
  async doEditLoad() {
    if (this.isEditModal) {
      await this.cacheQuizItem(this.editItem)

      const { type, item, direction } = this.editItem
      const { cards = [] } =
        this.quizData.filter((d) => {
          return d.type === type && d.item === item
        })[0] || {}

      const { front, back, mnemonic } =
        cards.filter((c) => {
          return c.direction === direction
        })[0] || {}

      this.editItem.front = front || cardDefault[type][direction].front || ''
      this.editItem.back = back || cardDefault[type][direction].back || ''
      this.editItem.mnemonic = mnemonic || ''

      // this.$set(this, 'editItem', this.editItem)
      this.$forceUpdate()
    }
  }

  onEditTabChange(i: number) {
    this.$nextTick(() => {
      ;(this.$refs[`mde${i}`] as any).codemirror.refresh()
    })
  }

  async getDueIn() {
    if (this.dueItems.length > 0) {
      this.dueIn = null
      return
    }

    const it = (await this.load({ _dueIn: true }))[0]
    this.dueIn = it ? it.nextReview : null
  }

  onQuizKeypress(evt: KeyboardEvent) {
    if (!this.isQuizModal) {
      return
    }

    if (this.isEditModal || this.isEditTagModal) {
      return
    }

    if (
      evt.target instanceof HTMLTextAreaElement ||
      evt.target instanceof HTMLInputElement
    ) {
      return
    }

    if (!this.quizCurrent) {
      doMapKeypress(evt, {
        ' ': this.$refs.btnEndQuiz as HTMLButtonElement,
      })
    } else if (!this.isQuizShownAnswer) {
      doMapKeypress(evt, {
        ' ': this.$refs.btnShowAnswer as HTMLButtonElement,
      })
    } else {
      const speakItemN = (n: number) => {
        const quizContent = (this.isQuizShownAnswer
          ? this.$refs.quizBack
          : this.$refs.quizFront) as HTMLDivElement | null

        if (!quizContent) {
          return
        }

        doClick(quizContent.querySelector(`.speak-item-${n}`))
      }

      doMapKeypress(evt, {
        '1': this.$refs.btnMarkRight as HTMLButtonElement,
        '2': this.$refs.btnMarkWrong as HTMLButtonElement,
        '3': this.$refs.btnMarkRepeat as HTMLButtonElement,
        q: this.$refs.btnHideAnswer as HTMLButtonElement,
        ' ': 'q',
        e: this.$refs.btnEditModal as HTMLButtonElement,
        s: () => speakItemN(-1),
        d: () => speakItemN(0),
        f: () => speakItemN(1),
        g: () => speakItemN(2),
        h: () => speakItemN(3),
        j: () => speakItemN(4),
        k: () => speakItemN(5),
        l: () => speakItemN(6),
        ';': () => speakItemN(7),
        "'": () => speakItemN(8),
      })
    }
  }
}
</script>

<style scoped>
.card {
  margin-bottom: 1rem;
}

.column-label {
  width: 5rem;
}

.taginput-field {
  padding-top: 1em;
  display: flex;
  flex-direction: row-reverse;
}

.quiz-modal .modal-content {
  max-width: 500px !important;
}

.quiz-modal .buttons-area {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.buttons-area .buttons {
  margin-bottom: 0;
}

.quiz-modal .card-content {
  min-height: 7.5rem;
  max-height: calc(100vh - 300px);
  overflow: scroll;
  padding-bottom: 0;
  padding-left: 0;
  padding-right: 0;
  margin-left: 1.5rem;
  margin-right: 1.5rem;
  border-bottom: 1px solid hsla(0, 0%, 50%, 0.25);
}

.buttons-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.buttons-panel .buttons {
  margin-bottom: 0;
}

.buttons-area button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background-color: currentColor;
  visibility: hidden;
  z-index: 2;
}

.buttons-area button:not(:active)::before {
  animation: ripple 0.4s cubic-bezier(0, 0, 0.2, 1);
  transition: visibility 0.4s step-end;
}

.buttons-area button:active::before {
  visibility: visible;
}

.edit-modal .card-footer {
  padding: 1rem;
}

@keyframes ripple {
  0% {
    width: 0;
    height: 0;
    opacity: 0.5;
  }
  100% {
    width: 150px;
    height: 150px;
    opacity: 0;
  }
}
</style>
