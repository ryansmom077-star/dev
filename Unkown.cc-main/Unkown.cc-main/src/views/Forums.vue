<script setup>
import { ref, onMounted } from 'vue'
import { API_BASE } from '../lib/apiBase'
import { useRouter } from 'vue-router'

const router = useRouter()
const token = localStorage.getItem('token')
const user = JSON.parse(localStorage.getItem('user') || '{}')

const categories = ref([])
const forumsByCategory = ref({})
const selectedForum = ref(null)
const threads = ref([])
const newThreadTitle = ref('')
const newThreadContent = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

function updateThreadCount(forumId, count) {
  const categoryIds = Object.keys(forumsByCategory.value || {})
  for (const catId of categoryIds) {
    const forum = (forumsByCategory.value[catId] || []).find(item => item.id === forumId)
    if (forum) {
      forum.threadCount = count
      break
    }
  }
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/api/forums/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load categories')
    const data = await res.json()
    categories.value = data.categories
    forumsByCategory.value = data.forumsByCategory
  } catch (err) {
    error.value = err.message
  }
}

async function selectForum(forumId) {
  selectedForum.value = forumId
  try {
    const res = await fetch(`${API_BASE}/api/forums/${forumId}/threads`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load threads')
    threads.value = await res.json()
    updateThreadCount(forumId, threads.value.length)
  } catch (err) {
    error.value = err.message
  }
}

async function createThread() {
  if (!selectedForum.value) return
  if (!newThreadTitle.value || !newThreadContent.value) {
    return error.value = 'Title and content required'
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/forums/${selectedForum.value}/threads`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ title: newThreadTitle.value, content: newThreadContent.value })
    })
    
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create thread')
    
    success.value = 'Thread created!'
    newThreadTitle.value = ''
    newThreadContent.value = ''
    await selectForum(selectedForum.value)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)
</script>

<template>
  <div class="container" style="display:grid;grid-template-columns:220px 1fr;gap:20px;margin-top:20px">
    <!-- Left Sidebar: Categories -->
    <div style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:16px;height:fit-content">
      <h3 style="margin-top:0;color:#00ff88">Categories</h3>
      <div
        v-for="cat in categories"
        :key="cat.id"
        @click="selectedForum = cat.id"
        style="padding:10px 12px;margin-bottom:8px;border-radius:6px;cursor:pointer;transition:all 0.2s"
        :style="{ 
          background: selectedForum && forumsByCategory[cat.id]?.length ? 'rgba(0,255,136,0.15)' : 'transparent',
          borderLeft: `3px solid ${cat.color}`
        }"
      >
        <div style="color:#00ffcc;font-weight:600;font-size:14px">{{ cat.name }}</div>
        <div style="color:#9bb0bd;font-size:12px">{{ forumsByCategory[cat.id]?.length || 0 }} forums</div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div>
      <div v-if="error" style="color:#ff6b6b;margin-bottom:12px;background:rgba(255,107,107,0.1);padding:12px;border-radius:6px">{{ error }}</div>
      <div v-if="success" style="color:#51cf66;margin-bottom:12px;background:rgba(81,207,102,0.1);padding:12px;border-radius:6px">{{ success }}</div>

      <!-- Forum Selection -->
      <div v-if="!selectedForum" style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:24px;text-align:center">
        <p style="color:#9bb0bd;font-size:16px;margin:0">Select a category to view forums</p>
      </div>

      <!-- Forums Grid -->
      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px">
        <div
          v-for="forum in forumsByCategory[selectedForum] || []"
          :key="forum.id"
          @click="selectForum(forum.id)"
          style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:16px;cursor:pointer;transition:all 0.2s"
        >
          <div style="color:#00ffcc;font-weight:600;margin-bottom:4px">{{ forum.name }}</div>
          <div style="color:#9bb0bd;font-size:13px;margin-bottom:10px">{{ forum.description }}</div>
          <div style="color:#00ff88;font-size:12px;font-weight:600">{{ forum.threadCount || 0 }} threads</div>
        </div>
      </div>

      <!-- Create Thread Form -->
      <div v-if="selectedForum" style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:20px;margin-bottom:24px">
        <h3 style="margin-top:0;color:#00ff88">Create New Thread</h3>
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Title</label>
          <input class="input" v-model="newThreadTitle" placeholder="Thread title" />
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Content</label>
          <textarea class="input" v-model="newThreadContent" placeholder="Your message..." style="min-height:120px;resize:vertical"></textarea>
        </div>
        <button class="create-btn" @click="createThread" :disabled="loading" style="width:100%">
          {{ loading ? 'Creating...' : 'Create Thread' }}
        </button>
      </div>

      <!-- Threads List -->
      <div v-if="threads.length" style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:20px">
        <h3 style="margin-top:0;color:#00ff88">Recent Threads</h3>
        <div
          v-for="thread in threads"
          :key="thread.id"
          @click="router.push(`/thread/${thread.id}`)"
          style="padding:12px;border-bottom:1px solid rgba(0,255,136,0.1);cursor:pointer;transition:all 0.2s;border-left:3px solid #00ff88;margin-bottom:8px"
        >
          <div style="color:#00ffcc;font-weight:600;margin-bottom:4px">{{ thread.title }}</div>
          <div style="color:#9bb0bd;font-size:13px">{{ thread.content.substring(0, 100) }}...</div>
          <div style="color:#9bb0bd;font-size:12px;margin-top:6px">{{ thread.postCount || 0 }} replies</div>
        </div>
      </div>
    </div>
  </div>
</template>
