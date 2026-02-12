<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const members = ref([])
const roles = ref([])
const loading = ref(false)
const error = ref('')
const searchTerm = ref('')
const token = localStorage.getItem('token')
const user = JSON.parse(localStorage.getItem('user') || '{}')

const isStaff = user?.staffRole === 'admin' || user?.staffRole === 'manager' || (user?.roles || []).includes('role_admin') || (user?.roles || []).includes('role_manager')
const isAdmin = user?.staffRole === 'admin' || (user?.roles || []).includes('role_admin')
const router = useRouter()

async function loadMembers() {
  loading.value = true
  error.value = ''
  try {
    const q = searchTerm.value ? `?search=${encodeURIComponent(searchTerm.value)}` : ''
    const res = await fetch(`${API_BASE}/api/admin/users${q}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to load members')
    members.value = await res.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/roles`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    roles.value = await res.json()
  } catch (e) {
    // ignore
  }
}

function isOnline(member) {
  // User is online if they logged in within the last 5 minutes
  const now = Date.now()
  const lastActive = member.lastActive || member.createdAt || 0
  return (now - lastActive) < 5 * 60 * 1000
}

async function banMember(memberId) {
  if (!confirm('Ban this member?')) return
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${memberId}/ban`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to ban member')
    await loadMembers()
  } catch (err) {
    error.value = err.message
  }
}

async function unbanMember(memberId) {
  if (!confirm('Unban this member?')) return
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${memberId}/unban`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to unban member')
    await loadMembers()
  } catch (err) {
    error.value = err.message
  }
}

async function changeRolesForMember(member) {
  // show a simple prompt with available roles (comma-separated ids)
  const current = (member.roles || []).join(',')
  const list = roles.value.map(r => `${r.id}:${r.name}`).join('\n')
  const input = prompt(`Available roles (id:name)\n${list}\n\nEnter comma-separated role ids to assign to ${member.username}:`, current)
  if (input === null) return
  const newRoles = input.split(',').map(s => s.trim()).filter(Boolean)
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${member.id}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set', roles: newRoles })
    })
    if (!res.ok) throw new Error('Failed to update roles')
    await loadMembers()
  } catch (err) {
    error.value = err.message
  }
}

function getBanButtonStyle(banned) {
  return {
    background: banned ? '#51cf66' : '#ff6b6b',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    width: '100%'
  }
}

onMounted(loadMembers)
onMounted(loadRoles)

function onSearch() {
  loadMembers()
}
</script>

<template>
  <div class="container">
    <div style="margin-bottom:18px">
      <a href="/" style="color:#00ff88;text-decoration:none">← Back to Forum</a>
    </div>
    
    <h1 style="margin:0 0 24px;color:#00ff88">Members</h1>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <input v-model="searchTerm" placeholder="Search username, email or UID" class="input" style="flex:1" />
      <button class="create-btn" @click="onSearch" style="padding:8px 12px">Search</button>
    </div>
    <div v-if="error" style="color:#ff6b6b;margin-bottom:12px;background:rgba(255,107,107,0.1);padding:12px;border-radius:6px">{{ error }}</div>
    
    <div v-if="loading" style="text-align:center;color:#9bb0bd;padding:40px">Loading members...</div>
    <div v-else-if="!members.length" style="text-align:center;color:#9bb0bd;padding:40px">No members yet</div>
    
    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
      <div 
        v-for="member in members" 
        :key="member.id"
        style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:16px;position:relative"
        :style="{ borderLeft: member.banned ? '4px solid #ff6b6b' : '4px solid #00ff88' }"
      >
        <!-- Online Status Indicator -->
        <div 
          style="position:absolute;top:12px;right:12px;width:12px;height:12px;border-radius:50%;border:2px solid"
          :style="{ background: isOnline(member) ? '#51cf66' : '#9bb0bd', borderColor: isOnline(member) ? '#51cf66' : '#9bb0bd' }"
          :title="isOnline(member) ? 'Online' : 'Offline'"
        ></div>
        
        <!-- Member Info -->
        <div style="margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div 
              style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#00ff88,#00ffcc);display:flex;align-items:center;justify-content:center;font-weight:bold;color:#061218"
            >
              {{ member.username.charAt(0).toUpperCase() }}
            </div>
            <div style="flex:1;min-width:0">
              <div style="color:#00ffcc;font-weight:600;word-break:break-word">{{ member.username }}</div>
              <div style="color:#9bb0bd;font-size:12px">UID #{{ member.uid }}</div>
            </div>
          </div>
        </div>
        
        <!-- Member Status -->
        <div style="margin-bottom:12px;padding:8px;background:rgba(0,255,136,0.05);border-radius:4px">
          <div style="font-size:12px;color:#d9eef5;margin-bottom:4px">
            <span v-if="member.staffRole === 'admin'" style="color:#00ff88;font-weight:600">ADMIN</span>
            <span v-else-if="member.staffRole === 'manager'" style="color:#00ffcc;font-weight:600">MANAGER</span>
            <span v-else style="color:#9bb0bd">Member</span>
          </div>
          <div style="font-size:12px;color:#d9eef5">
            <span v-if="member.banned" style="color:#ff6b6b;font-weight:600">BANNED</span>
            <span v-else style="color:#51cf66">Active</span>
          </div>
        </div>
        
      </div>
    </div>
  </div>
</template>

<style scoped>
button:hover {
  opacity: 0.85;
  transition: opacity 0.2s;
}
</style>
