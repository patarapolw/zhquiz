<template>
  <section class="IndexPage">
    <client-only>
      <article>
        <div class="content">
          <h1>ZhQuiz - A Chinese quizzing app</h1>

          <button class="button is-info" @click="doLogin" @keypress="doLogin">
            <span>
              <fontawesome :icon="['fab', 'google']" />
            </span>
            <span>Login with Google</span>
          </button>

          <h4>
            So, you want to learn Chinese. Let's see. How much you can read?
          </h4>

          <figure class="image is-16by9">
            <iframe
              title="video-demo"
              class="has-ratio"
              src="https://www.youtube.com/embed/iomE0xiYoqY"
              frameborder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            />
          </figure>

          <h2>Features</h2>

          <ul>
            <li>HSK vocabularies made into 60 levels</li>
            <li>Flashcards showing statuses of success</li>
            <li>Custom vocabularies input by users</li>
            <li>Speech-enabled</li>
          </ul>

          <h4>Login to try now.</h4>
        </div>
      </article>

      <div class="background" />
    </client-only>
  </section>
</template>

<script lang="ts">
import { Component, Vue } from 'nuxt-property-decorator'

@Component
export default class IndexPage extends Vue {
  async doLogin() {
    if (!this.$accessor.user) {
      const provider = new this.$fireAuthObj.GoogleAuthProvider()
      await this.$fireAuth.signInWithPopup(provider)
    }

    this.$router.push('/random')
  }
}
</script>

<style scoped>
.IndexPage {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.IndexPage article {
  margin-top: 1rem;
  width: calc(100vw - 1rem);
}

@media (min-width: 769px) {
  .IndexPage article {
    max-width: 60vw;
  }
}

.content button {
  width: 100%;
  margin-bottom: 1rem;
}

button > span + span {
  margin-left: 1rem;
}

.background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -100;
  background-image: radial-gradient(
      circle at 28% 51%,
      rgba(206, 206, 206, 0.03) 0%,
      rgba(206, 206, 206, 0.03) 17%,
      transparent 17%,
      transparent 100%
    ),
    radial-gradient(
      circle at 45% 10%,
      rgba(10, 10, 10, 0.03) 0%,
      rgba(10, 10, 10, 0.03) 45%,
      transparent 45%,
      transparent 100%
    ),
    radial-gradient(
      circle at 48% 44%,
      rgba(74, 74, 74, 0.03) 0%,
      rgba(74, 74, 74, 0.03) 84%,
      transparent 84%,
      transparent 100%
    ),
    radial-gradient(
      circle at 47% 50%,
      rgba(186, 186, 186, 0.03) 0%,
      rgba(186, 186, 186, 0.03) 23%,
      transparent 23%,
      transparent 100%
    ),
    radial-gradient(
      circle at 29% 70%,
      rgba(9, 9, 9, 0.03) 0%,
      rgba(9, 9, 9, 0.03) 32%,
      transparent 32%,
      transparent 100%
    ),
    radial-gradient(
      circle at 2% 75%,
      rgba(179, 179, 179, 0.03) 0%,
      rgba(179, 179, 179, 0.03) 19%,
      transparent 19%,
      transparent 100%
    ),
    radial-gradient(
      circle at 2% 36%,
      rgba(26, 26, 26, 0.03) 0%,
      rgba(26, 26, 26, 0.03) 1%,
      transparent 1%,
      transparent 100%
    ),
    radial-gradient(
      circle at 53% 70%,
      rgba(90, 90, 90, 0.03) 0%,
      rgba(90, 90, 90, 0.03) 55%,
      transparent 55%,
      transparent 100%
    ),
    radial-gradient(
      circle at 28% 92%,
      rgba(31, 31, 31, 0.03) 0%,
      rgba(31, 31, 31, 0.03) 35%,
      transparent 35%,
      transparent 100%
    ),
    linear-gradient(90deg, rgb(255, 255, 255), rgb(255, 255, 255));
}
</style>
