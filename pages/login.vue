<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: false })

const config = useRuntimeConfig()
const mockMode = String(config.public.mockMode ?? '').toLowerCase()
const isMock = mockMode === '1' || mockMode === 'true' || mockMode === 'yes'

const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

onMounted(() => {
  if (isMock) navigateTo('/')
})

async function submit() {
  submitting.value = true
  error.value = null
  try {
    await $fetch('/api/session/login', {
      method: 'POST',
      body: { password: password.value },
    })
    await navigateTo('/')
  } catch (e: unknown) {
    const err = e as { statusCode?: number }
    error.value = err.statusCode === 401 ? 'Incorrect password.' : 'Login failed. Try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="min-h-screen grid place-items-center px-6">
    <form
      v-if="!isMock"
      class="w-full max-w-sm border-y border-rule py-12"
      @submit.prevent="submit"
    >
      <div class="text-center">
        <div class="kicker">Restricted</div>
        <h1 class="font-display text-5xl leading-none mt-2">The Daily</h1>
        <p class="text-mute italic mt-3">Credentials required to continue.</p>
      </div>

      <label class="block mt-10">
        <span class="kicker">Password</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          autofocus
          class="mt-2 w-full bg-transparent border-b border-ink py-2 font-display text-xl focus:outline-none focus:border-accent"
        >
      </label>

      <p v-if="error" class="mt-4 text-sm text-accent italic">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting || !password"
        class="mt-8 w-full py-3 border border-ink font-display text-lg tracking-wide hover:bg-ink hover:text-paper transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {{ submitting ? 'Verifying…' : 'Enter' }}
      </button>
    </form>

    <p v-else class="text-mute italic">Mock mode active — redirecting…</p>
  </main>
</template>
