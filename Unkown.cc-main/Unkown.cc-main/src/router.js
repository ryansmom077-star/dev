import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Forums from './views/Forums.vue'
import Thread from './views/Thread.vue'
import Login from './views/Login.vue'
import Register from './views/Register.vue'
import Admin from './views/Admin.vue'
import Guide from './views/Guide.vue'
import Members from './views/Members.vue'
import Profile from './views/Profile.vue'
import Tickets from './views/Tickets.vue'
import Terms from './views/Terms.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/forum', component: Forums, meta: { requiresAuth: true, requiresForumAccess: true } },
  { path: '/store', component: () => import('./views/Store.vue') },
  { path: '/thread/:id', component: Thread, props: true, meta: { requiresAuth: true, requiresForumAccess: true } },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/guide', component: Guide },
  { path: '/members', component: Members, meta: { requiresAuth: true } },
  { path: '/profile/:id?', component: Profile, meta: { requiresAuth: true } },
  { path: '/tickets', component: Tickets, meta: { requiresAuth: true } },
  { path: '/terms', component: Terms },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, requiresStaff: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  
  const isStaff = user?.role === 'staff' || user?.staffRole === 'admin' || user?.staffRole === 'manager' || (user?.roles || []).includes('role_admin') || (user?.roles || []).includes('role_manager')

  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.meta.requiresForumAccess && user?.accessRevoked) {
    next('/profile')
  } else if (to.meta.requiresStaff && !isStaff) {
    next('/')
  } else {
    next()
  }
})

export default router










