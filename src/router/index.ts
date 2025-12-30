import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { currentUser } from '@/services/db'
import { showToast } from 'vant'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/library',
    name: 'Library',
    component: () => import('@/views/Library.vue')
  },
  {
    path: '/capture',
    name: 'Capture',
    component: () => import('@/views/Capture.vue'),
    meta: { roles: ['user'] }
  },
  {
    path: '/gallery',
    name: 'Gallery',
    component: () => import('@/views/Gallery.vue')
  },
  {
    path: '/work/new',
    name: 'NewWork',
    component: () => import('@/views/WorkEditor.vue')
  },
  {
    path: '/work/:id',
    name: 'EditWork',
    component: () => import('@/views/WorkEditor.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue')
  },
  {
    path: '/character/:char',
    name: 'CharacterDetail',
    component: () => import('@/views/CharacterDetail.vue'),
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.path === '/login') {
    if (currentUser.value) {
      next('/')
    } else {
      next()
    }
    return
  }

  if (!currentUser.value) {
    next('/login')
    return
  }

  if (to.meta.roles) {
    const roles = to.meta.roles as string[]
    if (currentUser.value && !roles.includes(currentUser.value.role)) {
      showToast('无权访问')
      return next('/')
    }
  }
  next()
})

export default router
