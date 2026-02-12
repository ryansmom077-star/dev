<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const threads = ref([])
const title = ref('')
const content = ref('')
const error = ref('')
const router = useRouter()
const categories = ref([])
const forumsByCategory = ref({})
const selectedForum = ref(null)
const isStaff = JSON.parse(localStorage.getItem('user') || 'null')?.staffRole === 'admin' || JSON.parse(localStorage.getItem('user') || 'null')?.staffRole === 'manager'

async function load() {
  // load categories and forums
  try {
    const res = await fetch(`${API_BASE}/api/forums/categories`)
    if (res.ok) {
      const data = await res.json()
      categories.value = data.categories || []
      forumsByCategory.value = data.forumsByCategory || {}
      // default select first forum
      const firstCat = categories.value[0]
      const firstForum = firstCat && (forumsByCategory.value[firstCat.id] || [])[0]
      if (firstForum) await loadForum(firstForum.id)
    }
  } catch (e) {
    console.warn('Failed to load forums', e.message)
  }
}

async function loadForum(forumId) {
  selectedForum.value = forumId
  const res = await fetch(`${API_BASE}/api/forums/${forumId}/threads`)
  threads.value = await res.json()
}

async function createThread() {
  error.value = ''
  const token = localStorage.getItem('token')
  if (!token) return router.push('/login')
  try {
    if (!selectedForum.value) throw new Error('No forum selected')
    // check forum readOnly
    const forumListRes = await fetch(`${API_BASE}/api/forums/categories`)
    const forumList = forumListRes.ok ? await forumListRes.json() : null
    const forumAll = forumList ? (forumList.forumsByCategory || {}) : {}
    let forumObj = null
    for (const k of Object.keys(forumAll)) {
      const f = forumAll[k].find(ff => ff.id === selectedForum.value)
      if (f) { forumObj = f; break }
    }
    if (forumObj?.readOnly && !isStaff) throw new Error('This forum is read-only')

    const res = await fetch(`${API_BASE}/api/forums/${selectedForum.value}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.value, content: content.value })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    title.value = ''
    content.value = ''
    await loadForum(selectedForum.value)
  } catch (err) {
    error.value = err.message
  }
}

onMounted(load)
</script>

<template>
  <div class="container">
    <div class="forum-hero" style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <h1 style="margin:0;font-size:32px">Forum</h1>
        <p style="margin:6px 0 0;color:#9bb0bd">Join the community discussion</p>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <button v-if="isStaff" class="create-btn" @click="router.push('/admin')">Staff Dashboard</button>
      </div>
    </div>
    <div class="forum-grid">
      <div>
        <div v-if="error" style="color:#ff6b6b;margin-bottom:12px">Error: {{ error }}</div>
        <div class="form-card" style="background:rgba(7,24,29,0.5);margin-bottom:18px">
          <h3 style="margin-top:0">Create New Thread</h3>
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <select v-model="selectedForum" @change="loadForum(selectedForum)" style="flex:1;padding:8px;background:transparent;border:1px solid rgba(0,255,136,0.06);color:#d9eef5">
              <option v-for="cat in categories" :key="cat.id" disabled>{{ cat.name }}</option>
              <template v-for="cat in categories">
                <optgroup :label="cat.name">
                  <option v-for="f in forumsByCategory[cat.id]" :value="f.id">{{ f.name }}{{ f.readOnly ? ' (read-only)' : '' }}</option>
                </optgroup>
              </template>
            </select>
          </div>
          <input class="input" placeholder="Thread Title" v-model="title" style="margin-bottom:8px" />
          <textarea class="input" placeholder="Description (optional)" v-model="content" style="height:80px;margin-bottom:12px"></textarea>
          <button class="create-btn" @click="createThread" style="width:100%">Create Thread</button>
        </div>
        <div class="category-list">
          <div v-if="!threads.length" style="padding:20px;text-align:center;color:#9bb0bd">No threads yet. Start one!</div>
          <div v-for="t in threads" :key="t.id" class="thread-row">
            <a :href="`/thread/${t.id}`" style="color:#00ff88;text-decoration:none;flex:1">{{ t.title }}</a>
            <span class="muted" style="text-align:right">{{ t.postCount }} replies</span>
          </div>
        </div>
      </div>
      <div style="background:var(--card);padding:12px;border-radius:6px;height:fit-content">
        <h3 style="margin-top:0">Community Stats</h3>
        <div style="font-size:24px;color:var(--accent);font-weight:600">{{ threads.length }}</div>
        <div class="muted">Total Threads</div>
      </div>
    </div>
  </div>
</template>
