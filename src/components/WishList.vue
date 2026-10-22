<script setup lang="ts">
// Lista de deseos en modo lectura.
import type { Wish } from '@/types'
import { safeHref } from '@/lib/url'

defineProps<{ wishes: Wish[] }>()

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <ol class="wishes">
    <li v-for="w in wishes" :key="w.id">
      <span class="text">{{ w.text }}</span>
      <a
        v-if="safeHref(w.url)"
        :href="safeHref(w.url)"
        target="_blank"
        rel="noopener noreferrer"
        class="link"
      >
        Ver en {{ hostOf(w.url!) }} ↗
      </a>
    </li>
  </ol>
</template>

<style scoped>
.wishes {
  list-style: none;
  counter-reset: wish;
  padding: 0;
  margin: 0;
}

.wishes li {
  counter-increment: wish;
  position: relative;
  padding: 0.7rem 0 0.7rem 2.2rem;
  border-bottom: 1px dashed var(--stitch);
}

.wishes li:last-child {
  border-bottom: 0;
}

.wishes li::before {
  content: counter(wish);
  position: absolute;
  left: 0;
  top: 0.55rem;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.35rem;
  color: var(--silver-deep);
}

.text {
  display: block;
  color: var(--white);
}

.link {
  font-size: 0.9rem;
  letter-spacing: 0.03em;
  word-break: break-all;
}
</style>
