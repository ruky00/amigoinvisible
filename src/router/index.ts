import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    // Enlace personal que se manda por WhatsApp: /entrar/NIEVE-42
    { path: '/entrar/:code', name: 'enter', component: () => import('@/views/EnterView.vue') },
    {
      path: '/mi-sorteo',
      name: 'participant',
      component: () => import('@/views/ParticipantView.vue'),
      meta: { needsParticipant: true },
    },
    // Organización: lista de sorteos y el panel de cada uno
    {
      path: '/organizar',
      name: 'admin',
      component: () => import('@/views/AdminEventsView.vue'),
      meta: { adminZone: true },
    },
    {
      path: '/organizar/:eventId',
      name: 'admin-event',
      component: () => import('@/views/AdminView.vue'),
      meta: { adminZone: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const session = useSessionStore()
  // Al salir de la zona de organización se olvida su sesión: para volver hay que poner la contraseña
  if (!to.meta.adminZone) session.adminToken = null
  if (to.meta.needsParticipant && !session.participantToken) return { name: 'home' }
  if (to.name === 'home' && session.participantToken) return { name: 'participant' }
})

export default router
