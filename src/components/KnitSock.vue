<script setup lang="ts">
// Calcetín navideño de punto, plateado y con costuras. Para los momentos de espera.
defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size ?? 70" :height="((size ?? 70) * 86) / 70" viewBox="0 0 70 86" aria-hidden="true" class="sock">
    <defs>
      <linearGradient id="sock-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2a4282" />
        <stop offset="1" stop-color="#16295a" />
      </linearGradient>
      <linearGradient id="sock-cuff" x1="0" x2="1">
        <stop offset="0" stop-color="#c7cfdd" />
        <stop offset=".5" stop-color="#ffffff" />
        <stop offset="1" stop-color="#b3bdce" />
      </linearGradient>
    </defs>
    <path
      d="M20 18h30v34c0 6 3 9 3 15 0 9-7 15-17 15-9 0-17-2-24-7-5-4-6-11-1-14 5-3 9-6 9-12Z"
      fill="url(#sock-body)"
      stroke="#9aa6bd"
      stroke-width="1"
    />
    <!-- pespuntes -->
    <path
      d="M24 24v28c0 6-4 10-9 13-3 2-3 6 0 8 6 4 13 5 20 5 8 0 13-4 13-11 0-5-2-8-2-14V24"
      fill="none"
      stroke="#c9d1df"
      stroke-width="1"
      stroke-dasharray="2.5 2.2"
      opacity=".75"
    />
    <!-- copos de punto -->
    <path d="M36 40l2 2-2 2-2-2Zm-6 10 2 2-2 2-2-2Zm12 2 2 2-2 2-2-2Z" fill="#d6dce7" opacity=".8" />
    <rect x="16" y="6" width="38" height="15" rx="4" fill="url(#sock-cuff)" />
    <path d="M19 10h32M19 17h32" stroke="#8d98ad" stroke-width=".9" stroke-dasharray="2 1.8" />
    <path d="M50 6c4-6 10-5 12-1" fill="none" stroke="#d6dce7" stroke-width="1.2" />
  </svg>
</template>

<style scoped>
.sock {
  display: inline-block;
  transform: rotate(-8deg);
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
}
</style>
