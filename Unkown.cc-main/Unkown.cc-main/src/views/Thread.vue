<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const route = useRoute()
const thread = ref(null)
const posts = ref([])
const content = ref('')
const error = ref('')
const token = localStorage.getItem('token')

async function load() {
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/threads/${route.params.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load thread')
    const data = await res.json()
    thread.value = data.thread
    posts.value = data.posts
  } catch (err) {
    error.value = err.message
  }
}

async function addPost() {
  error.value = ''
  const token = localStorage.getItem('token')
  if (!token) return alert('Please login')
  try {
    const res = await fetch(`${API_BASE}/api/threads/${route.params.id}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: content.value })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    content.value = ''
    await load()
  } catch (err) {
    error.value = err.message
  }
}

onMounted(load)
</script>

<template>
  <div v-if="thread" class="container">
    <div style="margin-bottom:18px">
      <a href="/" style="color:#00ff88;text-decoration:none">← Back to Forum</a>
    </div>
    <div class="forum-grid">
      <div>
        <div style="background:var(--card);padding:18px;border-radius:8px;margin-bottom:18px">
          <h2 style="margin:0 0 12px">{{ thread.title }}</h2>
          <p style="margin:0;color:#9bb0bd;font-size:14px">{{ thread.content || 'No description' }}</p>
        </div>
        <div v-if="error" style="color:#ff6b6b;margin-bottom:12px">Error: {{ error }}</div>
        <div style="background:var(--card);padding:18px;border-radius:8px">
          <h3 style="margin-top:0">Replies</h3>
          <div v-if="!posts.length" style="color:#9bb0bd;text-align:center;padding:20px">No replies yet. Be the first to reply!</div>
          <div v-for="p in posts" :key="p.id" class="post">
            <p style="margin:0">{{ p.content }}</p>
          </div>
          <div style="margin-top:18px;border-top:1px solid rgba(255,255,255,0.03);padding-top:18px">
            <textarea class="input" v-model="content" placeholder="Write your reply..." style="height:100px;margin-bottom:12px"></textarea>
            <button class="create-btn" @click="addPost" style="width:100%">Post Reply</button>
          </div>
        </div>
      </div>
      <div style="background:var(--card);padding:12px;border-radius:6px;height:fit-content">
        <h3 style="margin-top:0">Thread Info</h3>
        <div class="muted">{{ posts.length }} replies</div>
      </div>
    </div>
  </div>
  <div v-else class="container" style="text-align:center;padding:40px">Loading...</div>
</template>
