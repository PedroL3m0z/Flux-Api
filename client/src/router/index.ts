import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'overview',
          component: () => import('@/pages/dashboard/Overview.vue'),
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/pages/dashboard/Users.vue'),
        },
        {
          path: 'instances',
          name: 'instances',
          component: () => import('@/pages/dashboard/Instances.vue'),
        },
        {
          path: 'api-key',
          name: 'api-key',
          component: () => import('@/pages/dashboard/ApiKey.vue'),
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/Login.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFound.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) {
    await auth.init()
  }
  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.user) {
    return { name: 'overview' }
  }
  return true
})

export default router
