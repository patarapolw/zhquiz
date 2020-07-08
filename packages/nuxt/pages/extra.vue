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
            @click="addNewItem"
            @keypress="addNewItem"
          >
            Add
          </button>
        </div>
      </nav>

      <b-table
        :data="data"
        :columns="dataHeader"
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
          <a role="button" @click.prevent="speak" @keypress.prevent="speak">
            Speak
          </a>
        </li>
        <li
          v-if="
            !cardIds[selectedRow.chinese] ||
            !cardIds[selectedRow.chinese].length
          "
        >
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
          <nuxt-link
            :to="{ path: '/vocab', query: { q: selectedRow.chinese } }"
            target="_blank"
          >
            Search for vocab
          </nuxt-link>
        </li>
        <li>
          <nuxt-link
            :to="{ path: '/hanzi', query: { q: selectedRow.chinese } }"
            target="_blank"
          >
            Search for Hanzi
          </nuxt-link>
        </li>
        <li>
          <a
            :href="`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=*${selectedRow.chinese}*`"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in MDBG
          </a>
        </li>
        <li>
          <a
            role="button"
            @click.prevent="doDelete"
            @keypress.prevent="doDelete"
          >
            Delete
          </a>
        </li>
      </vue-context>
    </client-only>
  </section>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'nuxt-property-decorator'

import { speak } from '~/assets/speak'

@Component({
  layout: 'app',
})
export default class ExtraPage extends Vue {
  data: any = []
  count = 0
  perPage = 10
  page = 1
  dataHeader = [
    { field: 'chinese', label: 'Chinese', sortable: true },
    { field: 'pinyin', label: 'Pinyin', sortable: true },
    { field: 'english', label: 'English', sortable: true },
  ]

  sort = {
    key: 'updatedAt',
    type: 'desc',
  }

  newItem: any = {}
  selectedRow: any = {}
  cardIds: any = {}

  speak = speak

  created() {
    this.load()
  }

  @Watch('$store.state.user')
  async onUserChange() {
    if (this.$store.state.user) {
      await this.load()
    } else {
      this.$set(this, 'data', [])
    }
  }

  @Watch('page')
  async load() {
    const { result, count } = await this.$axios.$post('/api/extra/q', {
      offset: (this.page - 1) * this.perPage,
      limit: this.perPage,
      select: ['chinese', 'pinyin', 'english'],
      sort: [[this.sort.key, this.sort.type === 'desc' ? -1 : 1]],
    })

    this.$set(this, 'data', result)
    this.count = count
  }

  async addNewItem() {
    const { type } = await this.$axios.$put('/api/extra/', {
      create: this.newItem,
    })

    if (type === 'extra') {
      this.$set(this, 'newItem', {})
      await this.addToQuiz(this.newItem)
      await this.load()
    } else {
      // this.$set(this, 'newItem', {})
      await this.addToQuiz(this.newItem, type)
    }
  }

  async doDelete() {
    await this.$axios.$delete('/api/extra/', {
      data: {
        id: this.selectedRow._id,
      },
    })
    await this.load()
  }

  onTableContextmenu(row: any, evt: MouseEvent) {
    evt.preventDefault()

    this.selectedRow = row
    const contextmenu = this.$refs.contextmenu as any
    contextmenu.open(evt)
  }

  @Watch('selectedRow')
  async loadVocabStatus() {
    if (this.selectedRow.chinese) {
      const { result } = await this.$axios.$post('/api/card/q', {
        cond: {
          item: this.selectedRow.chinese,
          type: 'extra',
        },
        select: ['_id'],
        hasCount: false,
      })

      this.$set(
        this.cardIds,
        this.selectedRow.chinese,
        result.map((r: any) => r._id)
      )
    }
  }

  async addToQuiz(item = this.selectedRow.chinese, type = 'extra') {
    await this.$axios.$put('/api/card/', {
      create: { item, type },
    })
    this.$buefy.snackbar.open(`Added ${type}: ${item} to quiz`)

    this.loadVocabStatus()
  }

  async removeFromQuiz() {
    const type = 'extra'
    const item = this.selectedRow.chinese

    const id = this.cardIds[item] || []
    await this.$axios.$delete('/api/card/', {
      data: { id },
    })
    this.$buefy.snackbar.open(`Removed ${type}: ${item} from quiz`)

    this.loadVocabStatus()
  }

  onSort(key: string, type: string) {
    this.sort.key = key
    this.sort.type = type
    this.load()
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
