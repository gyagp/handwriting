import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
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
    component: () => import('@/views/Capture.vue')
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

export default router
