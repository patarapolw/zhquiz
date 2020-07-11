<template>
  <section class="MarkdownEditor columns">
    <button
      class="button floating-button"
      @click="isPreview = !isPreview"
      @keypress="isPreview = !isPreview"
    >
      <b-tooltip :label="isPreview ? 'Hide preview' : 'Show preview'">
        <fontawesome :icon="isPreview ? 'eye-slash' : 'eye'" />
      </b-tooltip>
    </button>

    <div class="column" :class="isPreview ? 'is-6' : ''">
      <client-only>
        <codemirror ref="cm" v-model="markdown" @input="onCodeChange" />
      </client-only>
    </div>

    <div v-show="isPreview" class="column is-6">
      <div class="content" v-html="html" />
    </div>
  </section>
</template>

<script lang="ts">
import {} from 'codemirror'
import { Component, Prop, Vue } from 'nuxt-property-decorator'

@Component<MarkdownEditor>({
  created() {
    this.mq.addListener(this.mqListener.bind(this))
  },
  beforeDestroy() {
    this.mq.removeListener(this.mqListener.bind(this))
  },
  watch: {
    value() {
      this.onValueChange()
    },
  },
})
export default class MarkdownEditor extends Vue {
  @Prop({ default: '' }) value!: string
  @Prop({ required: true }) renderer!: (s: string) => string

  markdown = this.value
  readonly mq = matchMedia('(min-width: 770px)')

  isPreview = this.mq.matches
  isFromExternal = false

  get codemirror() {
    const cm = this.$refs.cm as any
    return cm.codemirror as CodeMirror.Editor
  }

  get html() {
    return this.renderer(this.markdown)
  }

  mqListener(ev: MediaQueryListEvent) {
    this.isPreview = ev.matches
  }

  onCodeChange() {
    if (!this.isFromExternal) {
      this.$emit('input', this.markdown)
    }
  }

  onValueChange() {
    this.isFromExternal = true
    this.codemirror.setValue(this.value)
    this.isFromExternal = false
  }
}
</script>

<style scoped>
.MarkdownEditor {
  display: relative;
}

.floating-button {
  position: absolute;
  right: 0;
  top: 0;
  z-index: 1000;
}

.vue-codemirror {
  border: 1px solid rgb(216, 216, 216);
}

.content {
  max-height: 300px;
  overflow: scroll;
}
</style>
