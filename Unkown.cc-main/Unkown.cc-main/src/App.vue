<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import logoPng from './assets/logo.png'

const router = useRouter()
const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
const showUserMenu = ref(false)

const isAdminComputed = computed(() => {
  return user.value?.staffRole === 'admin' || user.value?.staffRole === 'manager' || user.value?.role === 'staff' || (user.value?.roles || []).includes('role_admin') || (user.value?.roles || []).includes('role_manager')
})

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  if (typeof document !== 'undefined') {
    document.cookie = 'token=; Max-Age=0; path=/'
  }
  user.value = null
  router.push('/')
}

function goToProfile() {
  showUserMenu.value = false
  router.push('/profile')
}
</script>

<template>
  <div>
    <header class="app-header">
      <div class="logo-area" @click="router.push('/')" style="cursor:pointer;display:flex;align-items:center;gap:10px">
        <img :src="logoPng" alt="Unknown.cc Logo" style="height:40px;width:40px;vertical-align:middle;border-radius:8px;box-shadow:0 0 6px #00ff8866;object-fit:cover;background:#061218;image-rendering:crisp-edges;" />
        <span class="logo-text" style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:1.4rem;color:#00ff88;letter-spacing:1px;">Unknown.cc</span>
      </div>
      <nav class="nav-links">
        <a href="#" @click.prevent="router.push('/')">Home</a>
        <a href="#" @click.prevent="router.push('/forum')">Forum</a>
        <a href="#" @click.prevent="router.push('/guide')">Guide</a>
        <a href="#" @click.prevent="router.push('/members')">Members</a>
        <a href="#" @click.prevent="router.push('/tickets')">Tickets</a>
        <a href="#" @click.prevent="router.push('/store')">Products</a>
        <a v-if="isAdminComputed" href="#" @click.prevent="router.push('/admin')" style="color:#00ff88">Admin</a>
      </nav>
      <div class="user-area">
        <template v-if="user">
          <div style="position:relative">
            <button @click="showUserMenu = !showUserMenu" style="background:transparent;border:none;color:#00ff88;cursor:pointer;font-weight:600">
              {{ user.username }} ▼
            </button>
            <div v-if="showUserMenu" style="position:absolute;top:100%;right:0;background:var(--card);border:1px solid rgba(0,255,136,0.2);border-radius:6px;min-width:150px;z-index:1000">
              <a href="/profile" @click="goToProfile" style="display:block;padding:10px 16px;color:#00ff88;text-decoration:none;border-bottom:1px solid rgba(0,255,136,0.1);cursor:pointer">My Profile</a>
              <a href="/profile" @click="showUserMenu = false" style="display:block;padding:10px 16px;color:#d9eef5;text-decoration:none;border-bottom:1px solid rgba(0,255,136,0.1);cursor:pointer">Settings</a>
              <button @click="logout" style="display:block;width:100%;padding:10px 16px;color:#ff6b6b;text-decoration:none;background:transparent;border:none;text-align:left;cursor:pointer">Logout</button>
            </div>
          </div>
        </template>
        <template v-else>
          <a href="/login" style="padding:8px 16px;background:#00ff88;color:#061218;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;border:none;cursor:pointer;transition:all 0.3s">Login</a>
          <a href="/register" style="padding:8px 16px;background:#00ffcc;color:#061218;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;border:none;cursor:pointer;transition:all 0.3s;margin-left:8px">Register</a>
        </template>
      </div>
    </header>
    <router-view />
  </div>
</template>

<style>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 32px 12px 32px;
  background: #061218;
  border-bottom: 1px solid rgba(0,255,136,0.08);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 24px 0 #00ff8822;
}
.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}
.logo-area img {
  height: 36px;
  width: 36px;
  filter: drop-shadow(0 0 8px #00ff88cc);
}
.logo-text {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  color: #00ff88;
  letter-spacing: 1.5px;
  text-shadow: 0 0 8px #00ff88, 0 0 2px #00ff88;
  transition: color 0.2s, text-shadow 0.2s;
}
.nav-links a {
  color: #9bb0bd;
  text-decoration: none;
  margin: 0 14px;
  font-weight: 600;
  font-size: 1.08rem;
  transition: color 0.2s, text-shadow 0.2s;
  text-shadow: 0 0 2px #00ff8822;
}
.nav-links a:hover {
  color: #00ff88;
  text-shadow: 0 0 8px #00ff88;
}
.user-area {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
