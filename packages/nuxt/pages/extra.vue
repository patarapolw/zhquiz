<template>
  <section>
    <div class="ExtraPage container">
      <nav class="new-item-panel">
        <div class="w-full flex-grow">
          <b-field label="Chinese">
            <b-input v-model="newItem.chinese" />
          </b-field>
        </div>

        <div class="w-full flex-grow">
          <b-field label="Pinyin">
            <b-input v-model="newItem.pinyin" />
          </b-field>
        </div>

        <div class="w-full flex-grow">
          <b-field label="English">
            <b-input v-model="newItem.english" />
          </b-field>
        </div>

        <div class="tablet:w-full">
          <button
            class="button is-success w-full"
            :disabled="!newItem.chinese || !newItem.english"
            @click="addToQuiz(newItem)"
            @keypress="addToQuiz(newItem)"
          >
            Add
          </button>
        </div>
      </nav>

      <b-table
        :data="tableData"
        :columns="tableHeader"
        checkable
        paginated
        backend-pagination
        :total="count"
        :per-page="perPage"
        :current-page.sync="page"
        backend-sorting
        :default-sort="[sort.key, sort.type]"
        @contextmenu="onTableContextmenu"
        @sort="onSort"
      />
    </div>

    <client-only>
      <vue-context ref="contextmenu" lazy>
        <li>
          <a
            role="button"
            @click.prevent="speakRow()"
            @keypress.prevent="speakRow()"
          >
            Speak
          </a>
        </li>
        <li v-if="selected.row && !selected.quizIds.length">
          <a
            role="button"
            @click.prevent="addToQuiz()"
            @keypress.prevent="addToQuiz()"
          >
            Add to quiz
          </a>
        </li>
        <li v-if="selected.row && selected.quizIds.length">
          <a
            role="button"
            @click.prevent="removeFromQuiz()"
            @keypress.prevent="removeFromQuiz()"
          >
            Remove from quiz
          </a>
        </li>
        <li v-if="selected.row">
          <nuxt-link
            :to="{ path: '/vocab', query: { q: selected.row.entry } }"
            target="_blank"
          >
            Search for vocab
          </nuxt-link>
        </li>
        <li v-if="selected.row">
          <nuxt-link
            :to="{ path: '/hanzi', query: { q: selected.row.entry } }"
            target="_blank"
          >
            Search for Hanzi
          </nuxt-link>
        </li>
        <li v-if="selected.row">
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${selected.row.entry}*`"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in MDBG
          </a>
        </li>
        <li>
          <a
            role="button"
            @click.prevent="doDelete()"
            @keypress.prevent="doDelete()"
          >
            Delete
          </a>
        </li>
      </vue-context>
    </client-only>
  </section>
</template>

<script lang="ts">
import { Component, Vue } from 'nuxt-property-decorator'

import { speak } from '~/assets/speak'
import { IDictionaryItem } from '~/assets/types/item'

interface IExtra {
  chinese: string
  pinyin: string
  english: string
}

@Component<ExtraPage>({
  layout: 'app',
  created() {
    this.loadPage()
  },
  watch: {
    page() {
      this.loadPage()
    },
  },
})
export default class ExtraPage extends Vue {
  count = 0
  perPage = 10
  page = 1
  tableData: IDictionaryItem[] = []
  tableHeader = [
    { field: 'entry', label: 'Chinese', sortable: true },
    { field: 'reading.0', label: 'Pinyin', sortable: true },
    { field: 'translation.0', label: 'English', sortable: true },
  ]

  sort = {
    key: 'updatedAt',
    type: 'desc',
  }

  newItem: IExtra = {
    chinese: '',
    pinyin: '',
    english: '',
  }

  selected: {
    row?: IDictionaryItem
    quizIds: string[]
  } = {
    quizIds: [],
  }

  async speakRow() {
    if (this.selected.row) {
      await speak(this.selected.row.entry)
    }
  }

  async loadPage(reset?: boolean) {
    const p = reset ? 1 : this.page

    const { result, count } = await this.$axios.$get('/api/item/search', {
      params: {
        type: 'user',
        select: ['entry', 'reading', 'translation'],
        page: [p, this.perPage],
        sort: `${this.sort.type === 'desc' ? '-' : ''}${this.sort.key}`,
      },
    })

    this.page = p
    this.tableData = result
    this.$set(this, 'tableData', result)
    this.count = count
  }

  async addNewItem() {
    const normItem = this.normalizeExtraForDatabase(this.newItem)
    if (!normItem) {
      return
    }

    const { type } = await this.$axios.$put('/api/item', normItem)

    this.newItem.chinese = ''
    this.newItem.pinyin = ''
    this.newItem.english = ''

    if (!type) {
      await this.addToQuiz(this.newItem)
      await this.loadPage()
    } else {
      await this.addToQuiz(this.newItem)
    }
  }

  async doDelete() {
    const { row, quizIds } = this.selected

    if (quizIds.length) {
      await this.$axios.$post('/api/quiz/delete/ids', {
        ids: quizIds,
      })
    }

    if (row) {
      await this.$axios.$delete('/api/item/entry', {
        params: {
          entry: row.entry,
        },
      })
      this.tableData = this.tableData.filter((d) => d.entry === row.entry)
      this.$set(this, 'tableData', this.tableData)
    }
  }

  async onTableContextmenu(row: IDictionaryItem, evt: MouseEvent) {
    evt.preventDefault()

    this.selected.row = row
    this.$set(this.selected, 'row', row)
    await this.loadSelectedStatus()
    ;(this.$refs.contextmenu as any).open(evt)
  }

  async loadSelectedStatus() {
    if (this.selected.row) {
      const { entry } = this.selected.row

      const { result } = await this.$axios.$get('/api/quiz/entry', {
        params: {
          entry,
          type: 'user',
          select: ['_id'],
          limit: -1,
        },
      })

      this.selected.quizIds = result.map((r: any) => r._id)
      this.$set(this.selected, 'quizIds', this.selected.quizIds)
    }
  }

  async addToQuiz(newItem?: IExtra) {
    const normItem = newItem
      ? this.normalizeExtraForDatabase(this.newItem)
      : this.selected.row

    if (normItem) {
      const { type } = await this.$axios.$put('/api/item', normItem)
      this.$buefy.snackbar.open(
        `Added ${type || 'extra'}: ${normItem.entry} to quiz`
      )
    }
  }

  async removeFromQuiz() {
    const { row, quizIds } = this.selected

    if (row && quizIds.length) {
      await this.$axios.$post('/api/item/delete/ids', { ids: quizIds })
      this.$buefy.snackbar.open(`Removed extra: ${row.entry} from quiz`)
    }
  }

  async onSort(key: string, type: string) {
    this.sort.key = key
    this.sort.type = type
    await this.loadPage(true)
  }

  normalizeExtraForDatabase(item: IExtra): IDictionaryItem | null {
    if (!item.chinese) {
      return null
    }

    item.pinyin = (item.pinyin || '').trim()
    item.english = (item.english || '').trim()

    return {
      entry: item.chinese,
      reading: item.pinyin ? [item.pinyin] : undefined,
      translation: item.english ? [item.english] : undefined,
    }
  }
}
</script>

<style scoped>
.new-item-panel {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 0.5rem;
}

.new-item-panel > div {
  margin-top: 0;
  margin-left: 0;
}

.new-item-panel > div + div {
  margin-left: 1em;
}

tbody tr:hover {
  cursor: pointer;
  color: blue;
}

@media screen and (max-width: 1024px) {
  .new-item-panel {
    flex-direction: column;
    align-items: flex-end;
  }

  .new-item-panel > div + div {
    margin-top: 1em;
  }
}
</style>
