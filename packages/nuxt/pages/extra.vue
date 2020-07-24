<template>
  <section>
    <div class="ExtraPage container">
      <nav class="new-item-panel">
        <div class="w-full flex-grow">
          <b-field label="Entry">
            <b-input v-model="newItem.entry" />
          </b-field>
        </div>

        <div class="w-full flex-grow">
          <b-field label="Reading">
            <b-input v-model="newItem.reading" />
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
            :disabled="!newItem.entry || !newItem.english"
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

interface IExtra {
  _id?: string
  entry: string
  reading: string
  english: string
}

@Component<ExtraPage>({
  layout: 'app',
  created() {
    this.load()
  },
  watch: {
    page() {
      this.load()
    },
  },
})
export default class ExtraPage extends Vue {
  count = 0
  perPage = 10
  page = 1
  tableData: IExtra[] = []
  tableHeader = [
    { field: 'entry', label: 'Entry', sortable: true },
    { field: 'reading', label: 'Reading', sortable: true },
    { field: 'english', label: 'English', sortable: true },
  ]

  sort = {
    key: 'updatedAt',
    type: 'desc',
  }

  newItem: IExtra = {
    entry: '',
    reading: '',
    english: '',
  }

  selected: {
    row?: IExtra
    quizIds: string[]
  } = {
    quizIds: [],
  }

  async speakRow() {
    if (this.selected.row) {
      await speak(this.selected.row.entry)
    }
  }

  async load() {
    const { result, count } = await this.$axios.$get('/api/extra/q', {
      params: {
        page: this.page,
        perPage: this.perPage,
        sort: [`${this.sort.type === 'desc' ? '-' : ''}${this.sort.key}`],
        select: ['_id', 'entry', 'reading', 'english'],
      },
    })

    this.tableData = result
    this.$set(this, 'tableData', this.tableData)
    this.count = count
  }

  async doDelete() {
    if (this.selected.row && this.selected.row._id) {
      await this.$axios.$delete('/api/extra', {
        params: {
          id: this.selected.row._id,
        },
      })
      await this.load()
    }
  }

  async onTableContextmenu(row: any, evt: MouseEvent) {
    evt.preventDefault()

    this.selected.row = row
    const { result } = await this.$axios.$get('/api/quiz/entry', {
      params: {
        entry: row.entry,
        select: ['_id'],
        type: 'extra',
      },
    })

    this.selected.quizIds = result.map((q: any) => q._id)
    this.$set(this.selected, 'quizIds', this.selected.quizIds)

    const contextmenu = this.$refs.contextmenu as any
    contextmenu.open(evt)
  }

  async addToQuiz(newItem = this.selected.row) {
    if (newItem) {
      const { existingType, _id } = await this.$axios.$put(
        '/api/extra',
        this.selected.row
      )

      if (existingType || _id) {
        this.$buefy.snackbar.open(
          `Added ${existingType || 'extra'}: ${newItem.entry} to quiz`
        )
      }

      if (_id) {
        this.$set(this, 'newItem', {})
        await this.load()
      }
    }
  }

  async removeFromQuiz() {
    if (this.selected.row) {
      if (this.selected.quizIds.length) {
        await this.$axios.$post('/api/quiz/delete/ids', {
          ids: this.selected.quizIds,
        })
      }
      this.$buefy.snackbar.open(
        `Removed extra: ${this.selected.row.entry} from quiz`
      )
    }
  }

  async onSort(key: string, type: string) {
    this.sort.key = key
    this.sort.type = type
    await this.load()
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
