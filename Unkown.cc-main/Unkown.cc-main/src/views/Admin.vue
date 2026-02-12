<script setup>
import { ref, onMounted, computed } from 'vue'
import { API_BASE } from '../lib/apiBase'
import logoPng from '../assets/logo.png'

const keys = ref([])
const users = ref([])
const ranks = ref([])
const accountLogs = ref([])
const products = ref([])
const productName = ref('')
const productPrice = ref(0)
const productCurrency = ref('USD')
const productDescription = ref('')
const forumIsOpen = ref(true)
// Forums/admin UI state
const categories = ref([])
const forumsByCategory = ref({})
const categoryName = ref('')
const categoryId = ref('')
const forumName = ref('')
const forumIdInput = ref('')
const forumCategory = ref('')
const forumReadOnly = ref(false)

const keyCount = ref(5)
const accountCreateUsername = ref('')
const accountCreateEmail = ref('')
const accountCreatePassword = ref('')
const accountCreateStaffRole = ref('user')

const userSearch = ref('')
const bannedSearch = ref('')
const accountLogSearch = ref('')
const rankName = ref('')
const rankColor = ref('#00ff88')
const rankPermissions = ref({
  forum_access: true,
  create_threads: true,
  create_posts: true,
  delete_own_posts: true,
  view_tickets: false,
  create_tickets: false,
  generate_invites: false,
  ban_users: false,
  delete_posts: false,
  delete_threads: false,
  manage_forum: false,
  change_uid: false
})

const selectedRankForPermissions = ref(null)

const error = ref('')
const success = ref('')
const loading = ref(false)
const activeTab = ref('keys')
const selectedUser = ref(null)
const selectedRank = ref(null)
const openUserMenuId = ref(null)
const userMenuX = ref(0)
const userMenuY = ref(0)
const banModalOpen = ref(false)
const banTarget = ref(null)
const banReason = ref('')
const banDuration = ref('1d')
const banSubmitting = ref(false)

const token = localStorage.getItem('token')
const user = JSON.parse(localStorage.getItem('user') || '{}')

// Staff (admin or manager) can access admin panel
const isStaff = user?.staffRole === 'admin' || user?.staffRole === 'manager'
const isAdmin = user?.staffRole === 'admin'

async function loadData() {
  await loadKeys()
  await loadUsers()
  await loadRanks()
  await loadForums()
  await loadProducts()
  await loadAccountLogs()
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/store/products`)
    if (!res.ok) throw new Error('Failed to load products')
    products.value = await res.json()
  } catch (err) {
    console.warn('Products not available:', err.message)
  }
}

async function loadForums() {
  try {
    const res = await fetch(`${API_BASE}/api/forums/categories`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    categories.value = data.categories || []
    forumsByCategory.value = data.forumsByCategory || {}
  } catch (e) {
    console.warn('Could not load forums', e.message)
  }
}

async function createCategory() {
  if (!(user?.staffRole === 'admin' || user?.staffRole === 'manager')) return alert('Admin/manager only')
  if (!categoryId.value || !categoryName.value) return alert('id and name required')
  try {
    const res = await fetch(`${API_BASE}/api/admin/forums/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: categoryId.value, name: categoryName.value })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    categoryId.value = ''
    categoryName.value = ''
    await loadForums()
    success.value = 'Category created'
  } catch (err) { error.value = err.message }
}

async function createForumAdmin() {
  if (!(user?.staffRole === 'admin' || user?.staffRole === 'manager')) return alert('Admin/manager only')
  if (!forumIdInput.value || !forumName.value || !forumCategory.value) return alert('id, name and category required')
  try {
    const res = await fetch(`${API_BASE}/api/admin/forums`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: forumIdInput.value, name: forumName.value, categoryId: forumCategory.value, readOnly: !!forumReadOnly.value })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    forumIdInput.value = ''
    forumName.value = ''
    forumCategory.value = ''
    forumReadOnly.value = false
    await loadForums()
    success.value = 'Forum created'
  } catch (err) { error.value = err.message }
}

async function deleteForumAdmin(fid) {
  if (!(user?.staffRole === 'admin' || user?.staffRole === 'manager') || !confirm('Delete this forum?')) return
  try {
    const res = await fetch(`${API_BASE}/api/admin/forums/${fid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    await loadForums()
    success.value = 'Forum deleted'
  } catch (err) { error.value = err.message }
}

function copyId(id) {
  try {
    navigator.clipboard.writeText(id)
    alert('Copied id: ' + id)
  } catch (e) {
    console.warn('copy failed', e)
  }
}

async function createProduct() {
  if (!isAdmin) return alert('Admin only')
  if (!productName.value || !productPrice.value) return alert('Name and price required')
  try {
    const res = await fetch(`${API_BASE}/api/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: productName.value, description: productDescription.value, price: String(productPrice.value), currency: productCurrency.value })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create product')
    productName.value = ''
    productPrice.value = 0
    productCurrency.value = 'USD'
    productDescription.value = ''
    await loadProducts()
    success.value = 'Product created'
  } catch (err) {
    error.value = err.message
  }
}

async function deleteProduct(productId) {
  if (!isAdmin || !confirm('Delete this product?')) return
  try {
    const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete product')
    await loadProducts()
    success.value = 'Product deleted'
  } catch (err) {
    error.value = err.message
  }
}

async function loadAccountLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/account-logs`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to load account logs')
    accountLogs.value = await res.json()
  } catch (err) {
    console.warn('Account logs not available:', err.message)
  }
}

async function loadKeys() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/keys`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to load keys')
    keys.value = await res.json()
  } catch (err) {
    error.value = err.message
  }
}

async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to load users')
    users.value = await res.json()
  } catch (err) {
    // Endpoint not created yet, will add it
  }
}

async function createAccount() {
  if (!isAdmin) return alert('Admin only')
  if (!accountCreateUsername.value || !accountCreateEmail.value || !accountCreatePassword.value) {
    return alert('Username, email, and password required')
  }
  error.value = ''
  success.value = ''

  try {
    const res = await fetch(`${API_BASE}/api/admin/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        username: accountCreateUsername.value,
        email: accountCreateEmail.value,
        password: accountCreatePassword.value,
        staffRole: accountCreateStaffRole.value === 'user' ? null : accountCreateStaffRole.value
      })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create account')
    accountCreateUsername.value = ''
    accountCreateEmail.value = ''
    accountCreatePassword.value = ''
    accountCreateStaffRole.value = 'user'
    success.value = 'Account created'
    await loadUsers()
    await loadAccountLogs()
  } catch (err) {
    error.value = err.message
  }
}

async function setStaffRole(userId, staffRole) {
  if (!isAdmin) return alert('Admin only')
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${userId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ staffRole })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update staff role')
    success.value = 'Staff role updated'
    await loadUsers()
    await loadAccountLogs()
  } catch (err) {
    error.value = err.message
  } finally {
    openUserMenuId.value = null
  }
}

async function changeUID(userId) {
  if (!isStaff) return alert('Staff only')
  const user = users.value.find(u => u.id === userId)
  if (!user) return
  
  const newUid = prompt(`Change UID for ${user.username}?\n\nCurrent UID: ${user.uid}\nEnter new UID (or leave blank to cancel):`, '')
  if (newUid === null || newUid.trim() === '') return
  
  const parsedUid = parseInt(newUid.trim(), 10)
  if (isNaN(parsedUid)) {
    alert('Please enter a valid number')
    return
  }
  
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${userId}/change-uid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newUid: parsedUid })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to change UID')
    const data = await res.json()
    if (data.swapped) {
      success.value = `UID changed and swapped with user #${data.otherUserId}`
    } else {
      success.value = 'UID changed successfully'
    }
    await loadUsers()
  } catch (err) {
    error.value = err.message
  } finally {
    openUserMenuId.value = null
  }
}

function toggleUserMenu(userId, event) {
  if (openUserMenuId.value === userId) {
    openUserMenuId.value = null
    return
  }
  const rect = event?.currentTarget?.getBoundingClientRect?.()
  if (rect) {
    userMenuX.value = Math.min(rect.left, window.innerWidth - 220)
    userMenuY.value = rect.bottom + 6
  }
  openUserMenuId.value = userId
}

function closeUserMenu() {
  openUserMenuId.value = null
}

async function loadRanks() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/ranks`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to load ranks')
    ranks.value = await res.json()
  } catch (err) {
    console.warn('Ranks endpoint not ready')
  }
}

async function generateKeys() {
  error.value = ''
  success.value = ''
  loading.value = true
  
  try {
    if (keyCount.value < 1 || keyCount.value > 100) {
      throw new Error('Generate 1-100 keys at a time')
    }
    
    const res = await fetch(`${API_BASE}/api/admin/keys/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ count: keyCount.value })
    })
    
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate keys')
    
    const newKeys = await res.json()
    success.value = `Generated ${newKeys.length} new keys`
    keyCount.value = 5
    await loadKeys()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function deleteKey(keyId) {
  if (!confirm('Delete this key?')) return
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete key')
    
    success.value = 'Key deleted'
    await loadKeys()
  } catch (err) {
    error.value = err.message
  }
}

async function revokeKey(keyId) {
  if (!confirm('Revoke this key? The user will need a new key to regain forum access.')) return
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/keys/${keyId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to revoke key')
    success.value = 'Key revoked and access removed'
    await loadKeys()
  } catch (err) {
    error.value = err.message
  }
}

async function generateInviteKey() {
  error.value = ''
  success.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/admin/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ count: 1 })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate key')
    const data = await res.json()
    const key = data?.[0]?.key
    if (key) {
      navigator.clipboard.writeText(key)
      success.value = 'Invite key generated and copied'
    } else {
      success.value = 'Invite key generated'
    }
    await loadKeys()
  } catch (err) {
    error.value = err.message
  }
}

async function generateSingleKey() {
  if (!isAdmin) return
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/admin/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ count: 1 })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate key')
    const [newKey] = await res.json()
    if (newKey?.key) copyToClipboard(newKey.key)
    success.value = 'Invite key generated and copied'
    await loadKeys()
  } catch (err) {
    error.value = err.message
  }
}

function openBanModal(user) {
  banTarget.value = user
  banReason.value = ''
  banDuration.value = '1d'
  banModalOpen.value = true
}

function closeBanModal() {
  banModalOpen.value = false
  banTarget.value = null
  banReason.value = ''
  banDuration.value = '1d'
}

async function unbanUser(userId) {
  if (!confirm('Unban this user?')) return
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${userId}/unban`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to unban user')
    success.value = 'User unbanned'
    await loadUsers()
  } catch (err) {
    error.value = err.message
  }
}

async function submitBan() {
  if (!banTarget.value) return
  if (!banReason.value.trim()) {
    error.value = 'Ban reason required'
    return
  }

  error.value = ''
  banSubmitting.value = true
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${banTarget.value.id}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ duration: banDuration.value, reason: banReason.value.trim() })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to ban user')
    success.value = 'User banned'
    await loadUsers()
    closeBanModal()
  } catch (err) {
    error.value = err.message
  } finally {
    banSubmitting.value = false
  }
}

async function banUser(userId) {
  const user = users.value.find(u => u.id === userId)
  if (!user) return
  if (user.banned) {
    await unbanUser(userId)
    return
  }
  openBanModal(user)
  closeUserMenu()
}

async function createRank() {
  if (!isAdmin) return alert('Admin only')
  error.value = ''
  success.value = ''
  
  try {
    if (!rankName.value) throw new Error('Rank name required')
    
    const res = await fetch(`${API_BASE}/api/admin/ranks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ name: rankName.value, color: rankColor.value, permissions: rankPermissions.value })
    })
    
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create rank')
    success.value = 'Rank created'
    rankName.value = ''
    rankColor.value = '#00ff88'
    rankPermissions.value = {
      forum_access: true,
      create_threads: true,
      create_posts: true,
      delete_own_posts: true,
      view_tickets: false,
      create_tickets: false,
      generate_invites: false,
      ban_users: false,
      delete_posts: false,
      delete_threads: false,
      manage_forum: false,
      change_uid: false
    }
    await loadRanks()
  } catch (err) {
    error.value = err.message
  }
}

async function updateRankPermissions(rankId) {
  if (!isAdmin || !selectedRankForPermissions.value) return
  error.value = ''
  success.value = ''
  
  const rank = ranks.value.find(r => r.id === rankId)
  if (!rank) return
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/ranks/${rankId}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ permissions: rank.permissions })
    })
    
    if (!res.ok) throw new Error('Failed to update permissions')
    success.value = 'Permissions updated!'
  } catch (err) {
    error.value = err.message
  }
}

async function deleteRank(rankId) {
  if (!isAdmin || !confirm('Delete this rank?')) return
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/ranks/${rankId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete rank')
    success.value = 'Rank deleted'
    await loadRanks()
  } catch (err) {
    error.value = err.message
  }
}

async function toggleForum() {
  if (!isAdmin) return alert('Admin only')
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/forum/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!res.ok) throw new Error('Failed to toggle forum')
    const data = await res.json()
    forumIsOpen.value = data.isOpen
    success.value = `Forum is now ${data.isOpen ? 'open' : 'closed'}`
  } catch (err) {
    error.value = err.message
  }
}

function copyToClipboard(key) {
  navigator.clipboard.writeText(key)
}

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(u => {
    return String(u.uid) === q || u.username?.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  })
})

const filteredBannedUsers = computed(() => {
  const q = bannedSearch.value.trim().toLowerCase()
  const banned = users.value.filter(u => u.banned)
  if (!q) return banned
  return banned.filter(u => {
    return String(u.uid) === q || u.username?.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  })
})

function formatBanDuration(label) {
  if (!label || label === 'perm') return 'Permanent'
  if (label === '1d') return '1 day'
  if (label === '1w') return '1 week'
  if (label === '1mo') return '1 month'
  if (label === '1y') return '1 year'
  return label
}

function formatBanExpiry(ts) {
  if (!ts) return 'Permanent'
  return new Date(ts).toLocaleString()
}

const filteredAccountLogs = computed(() => {
  const q = accountLogSearch.value.trim().toLowerCase()
  if (!q) return accountLogs.value
  return accountLogs.value.filter(l => {
    return String(l.uid) === q || l.username?.toLowerCase().includes(q) || (l.ip || '').toLowerCase().includes(q) || (l.staffStatus || '').toLowerCase().includes(q)
  })
})

onMounted(loadData)
</script>

<template>
  <div class="container">
    <div style="margin-bottom:18px">
      <a href="/" style="color:#00ff88;text-decoration:none">← Back to Forum</a>
    </div>
    
    <div class="admin-brand">
      <img :src="logoPng" alt="Unknown.cc" />
      <div>
        <div class="admin-brand-title">Unknown.cc</div>
        <div class="admin-brand-sub">Staff Manager</div>
      </div>
      <div class="admin-brand-role">Role: {{ user?.staffRole?.toUpperCase() }}</div>
    </div>
    
    <div style="display:flex;gap:12px;margin-bottom:18px;border-bottom:1px solid rgba(0,255,136,0.2);overflow-x:auto">
      <button @click="activeTab='keys'" :style="{color:activeTab==='keys'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='keys'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Keys</button>
      <button @click="activeTab='users'" :style="{color:activeTab==='users'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='users'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Users</button>
      <button @click="activeTab='banned'" :style="{color:activeTab==='banned'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='banned'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Banned</button>
      <button v-if="isStaff" @click="activeTab='accountlogs'" :style="{color:activeTab==='accountlogs'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='accountlogs'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Account Logs</button>
      <button v-if="isStaff" @click="activeTab='products'" :style="{color:activeTab==='products'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='products'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Products</button>
      <button v-if="isStaff" @click="activeTab='forums'" :style="{color:activeTab==='forums'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='forums'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Forums</button>
      <button v-if="isAdmin" @click="activeTab='ranks'" :style="{color:activeTab==='ranks'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='ranks'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Ranks</button>
      <button v-if="isAdmin" @click="activeTab='permissions'" :style="{color:activeTab==='permissions'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='permissions'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Permissions</button>
      <button v-if="isAdmin" @click="activeTab='settings'" :style="{color:activeTab==='settings'?'#00ff88':'#9bb0bd',background:'transparent',border:'none',padding:'12px',cursor:'pointer',borderBottom:activeTab==='settings'?'2px solid #00ff88':'none',whiteSpace:'nowrap'}">Settings</button>
    </div>
    
    <div class="forum-grid">
      <div>
        <div v-if="error" style="color:#ff6b6b;margin-bottom:12px;background:rgba(255,107,107,0.1);padding:10px;border-radius:6px">{{ error }}</div>
        <div v-if="success" style="color:#51cf66;margin-bottom:12px;background:rgba(81,207,102,0.1);padding:10px;border-radius:6px">{{ success }}</div>
        
        <!-- Keys Tab -->
        <div v-if="activeTab === 'keys'">
          <div style="background:var(--card);padding:18px;border-radius:8px;margin-bottom:18px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Generate Invitation Keys</h2>
            <div style="margin-bottom:12px">
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Number of keys</label>
              <input class="input" type="number" v-model.number="keyCount" min="1" max="100" />
            </div>
            <button class="create-btn" @click="generateKeys" :disabled="loading" style="width:100%;cursor:pointer">
              {{ loading ? 'Generating...' : 'Generate Keys' }}
            </button>
          </div>

          <div style="background:var(--card);padding:18px;border-radius:8px;margin-bottom:18px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Create Account</h2>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
              <input class="input" v-model="accountCreateUsername" placeholder="Username" />
              <input class="input" v-model="accountCreateEmail" placeholder="Email" />
              <input class="input" v-model="accountCreatePassword" type="password" placeholder="Password" />
              <select class="input" v-model="accountCreateStaffRole">
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button class="create-btn" @click="createAccount" style="width:100%">Create Account</button>
          </div>
          
          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Keys ({{ keys.length }})</h2>
            <div style="max-height:600px;overflow-y:auto">
              <div v-for="k in keys" :key="k.id" style="background:rgba(0,255,136,0.05);padding:10px;border-radius:6px;margin-bottom:8px;border-left:3px solid #00ff88">
                <div style="display:flex;gap:8px;align-items:center">
                  <div style="flex:1;font-family:monospace;font-size:12px;color:#00ff88;cursor:pointer;user-select:all" @click="copyToClipboard(k.key)">{{ k.key }}</div>
                  <button v-if="!k.usedBy" class="create-btn" @click="deleteKey(k.id)" style="padding:4px 8px;font-size:11px">Delete</button>
                  <button v-else-if="!k.revoked" class="create-btn" @click="revokeKey(k.id)" style="padding:4px 8px;font-size:11px;background:#dc3545">Revoke Access</button>
                  <span v-else style="padding:4px 8px;font-size:11px;color:#9bb0bd">Revoked</span>
                </div>
                <div style="font-size:11px;color:#9bb0bd;margin-top:6px">
                  <span v-if="k.usedBy && k.revoked">Revoked ({{ k.usedByUsername }})</span>
                  <span v-else-if="k.usedBy">✓ Used by {{ k.usedByUsername }}</span>
                  <span v-else>⊙ Unused</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Forums Management (Admin Only) -->
        <div v-if="activeTab === 'forums'">
          <div style="background:var(--card);padding:18px;border-radius:8px;margin-bottom:18px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Create Category</h2>
            <div style="display:flex;gap:8px;margin-bottom:12px">
              <input class="input" v-model="categoryId" placeholder="id (e.g., cat_news)" />
              <input class="input" v-model="categoryName" placeholder="Name" />
              <button class="create-btn" @click="createCategory">Create</button>
            </div>
            <h2 style="margin-top:0;margin-bottom:8px">Create Forum</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <input class="input" v-model="forumIdInput" placeholder="id (e.g., forum_news)" style="min-width:180px" />
              <input class="input" v-model="forumName" placeholder="Forum Name" style="min-width:220px" />
              <select class="input" v-model="forumCategory" style="min-width:180px">
                <option disabled value="">Select category</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <label style="display:flex;align-items:center;gap:8px;color:#d9eef5">
                <input type="checkbox" v-model="forumReadOnly" /> Read-only
              </label>
              <button class="create-btn" @click="createForumAdmin">Create Forum</button>
            </div>
          </div>

          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Categories & Forums</h2>
            <div v-if="!categories.length" style="text-align:center;color:#9bb0bd;padding:20px">No categories</div>
            <div v-for="cat in categories" :key="cat.id" style="margin-bottom:12px;padding:12px;border-radius:6px;background:rgba(0,255,136,0.03)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:700;color:#00ffcc">{{ cat.name }} <span style="font-size:12px;color:#9bb0bd;margin-left:8px">{{ cat.id }}</span></div>
              </div>
              <div style="margin-top:8px">
                <div v-for="f in forumsByCategory[cat.id] || []" :key="f.id" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:6px;margin-bottom:6px;background:rgba(0,0,0,0.03)">
                  <div>
                    <div style="font-weight:600;color:#d9eef5">{{ f.name }}</div>
                    <div style="font-size:12px;color:#9bb0bd">{{ f.description || '' }} <span style="margin-left:8px;color:#00ff88">{{ f.readOnly ? '(read-only)' : '' }}</span></div>
                  </div>
                  <div style="display:flex;gap:8px;align-items:center">
                    <button class="create-btn" @click="copyToClipboard(f.id)" style="padding:6px 8px">Copy ID</button>
                    <button class="create-btn" @click="deleteForumAdmin(f.id)" style="background:#dc3545;padding:6px 8px">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Products (Admin Only) -->
        <div v-if="activeTab === 'products'">
          <div style="background:var(--card);padding:18px;border-radius:8px;margin-bottom:18px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Create Product</h2>
            <div style="margin-bottom:12px">
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Name</label>
              <input class="input" v-model="productName" />
            </div>
            <div style="margin-bottom:12px">
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Price (cents)</label>
              <input class="input" type="number" v-model.number="productPrice" />
            </div>
            <div style="margin-bottom:12px">
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Currency</label>
              <input class="input" v-model="productCurrency" />
            </div>
            <div style="margin-bottom:12px">
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Description</label>
              <textarea class="input" v-model="productDescription"></textarea>
            </div>
            <button class="create-btn" @click="createProduct">Create Product</button>
          </div>

          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Products ({{ products.length }})</h2>
            <div v-if="!products.length" style="text-align:center;color:#9bb0bd;padding:20px">No products</div>
            <div v-for="p in products" :key="p.id" style="background:rgba(0,255,136,0.03);padding:12px;border-radius:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;color:#00ffcc">{{ p.name }}</div>
                <div style="font-size:12px;color:#9bb0bd">{{ p.description }}</div>
                <div style="font-weight:700;color:#00ff88">{{ p.price }} {{ p.currency }}</div>
              </div>
              <div>
                <button class="create-btn" @click="deleteProduct(p.id)" style="background:#dc3545">Delete</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- User Management -->
        <div v-if="activeTab === 'users'">
          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
              <h2 style="margin:0">Users ({{ filteredUsers.length }})</h2>
              <input class="input" v-model="userSearch" placeholder="Search username, email, or uid" style="max-width:280px" />
            </div>
            <div v-if="!filteredUsers.length" style="text-align:center;color:#9bb0bd;padding:20px">No users found</div>
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                  <tr style="border-bottom:1px solid rgba(0,255,136,0.1)">
                    <th style="text-align:left;padding:8px;color:#00ff88">UID</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Username</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Email</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Role</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Status</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="usr in filteredUsers" :key="usr.id" style="border-bottom:1px solid rgba(0,255,136,0.05);background:rgba(0,255,136,0.02)">
                    <td style="padding:8px;color:#00ffcc;font-weight:600">#{{ usr.uid }}</td>
                    <td style="padding:8px">{{ usr.username }}</td>
                    <td style="padding:8px;color:#9bb0bd;font-size:12px">{{ usr.email }}</td>
                    <td style="padding:8px">
                      <span v-if="usr.staffRole === 'admin'" style="color:#00ff88">ADMIN</span>
                      <span v-else-if="usr.staffRole === 'manager'" style="color:#00ffcc">MANAGER</span>
                      <span v-else style="color:#9bb0bd">user</span>
                    </td>
                    <td style="padding:8px">
                      <span v-if="usr.banned" style="color:#ff6b6b">BANNED</span>
                      <span v-else style="color:#51cf66">active</span>
                    </td>
                    <td style="padding:8px">
                      <div style="position:relative;display:inline-block">
                        <button class="create-btn" @click="toggleUserMenu(usr.id, $event)" style="padding:4px 10px;font-size:14px">...</button>
                        <div v-if="openUserMenuId === usr.id" :style="{position:'fixed',left:userMenuX + 'px',top:userMenuY + 'px',background:'#0b1b22',border:'1px solid rgba(0,255,136,0.2)',borderRadius:'8px',minWidth:'180px',zIndex:1000,boxShadow:'0 12px 30px rgba(0,0,0,0.4)'}">
                          <button v-if="isAdmin" @click="setStaffRole(usr.id, 'admin')" style="display:block;width:100%;text-align:left;padding:8px 10px;background:transparent;border:none;color:#d9eef5;cursor:pointer">Make Admin</button>
                          <button v-if="isAdmin" @click="setStaffRole(usr.id, 'manager')" style="display:block;width:100%;text-align:left;padding:8px 10px;background:transparent;border:none;color:#d9eef5;cursor:pointer">Make Manager</button>
                          <button v-if="isAdmin" @click="setStaffRole(usr.id, null)" style="display:block;width:100%;text-align:left;padding:8px 10px;background:transparent;border:none;color:#d9eef5;cursor:pointer">Remove Staff</button>
                          <button v-if="isStaff" @click="changeUID(usr.id); closeUserMenu()" style="display:block;width:100%;text-align:left;padding:8px 10px;background:transparent;border:none;color:#00ffcc;cursor:pointer">Change UID</button>
                          <button v-if="isStaff" @click="generateInviteKey(); closeUserMenu()" style="display:block;width:100%;text-align:left;padding:8px 10px;background:transparent;border:none;color:#00ff88;cursor:pointer">Generate Invite Key</button>
                          <button v-if="isStaff" @click="banUser(usr.id); closeUserMenu()" style="display:block;width:100%;text-align:left;padding:8px 10px;background:transparent;border:none;color:#ff6b6b;cursor:pointer">
                            {{ usr.banned ? 'Unban' : 'Ban' }}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Banned Users -->
        <div v-if="activeTab === 'banned'">
          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
              <h2 style="margin:0">Banned Users ({{ filteredBannedUsers.length }})</h2>
              <input class="input" v-model="bannedSearch" placeholder="Search username, email, or uid" style="max-width:280px" />
            </div>
            <div v-if="!filteredBannedUsers.length" style="text-align:center;color:#9bb0bd;padding:20px">No banned users</div>
            <div style="overflow-x:auto" v-else>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                  <tr style="border-bottom:1px solid rgba(0,255,136,0.1)">
                    <th style="text-align:left;padding:8px;color:#00ff88">UID</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Username</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Reason</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Duration</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Expires</th>
                    <th style="text-align:left;padding:8px;color:#00ff88">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="usr in filteredBannedUsers" :key="usr.id" style="border-bottom:1px solid rgba(0,255,136,0.05);background:rgba(0,255,136,0.02)">
                    <td style="padding:8px;color:#00ffcc;font-weight:600">#{{ usr.uid }}</td>
                    <td style="padding:8px">{{ usr.username }}</td>
                    <td style="padding:8px;color:#9bb0bd">{{ usr.banReason || '-' }}</td>
                    <td style="padding:8px;color:#d9eef5">{{ formatBanDuration(usr.banDurationLabel) }}</td>
                    <td style="padding:8px;color:#9bb0bd">{{ formatBanExpiry(usr.banExpiresAt) }}</td>
                    <td style="padding:8px">
                      <button class="create-btn" @click="unbanUser(usr.id)" style="padding:4px 10px;font-size:12px">Unban</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Account Creation Logs (Admin Only) -->
        <div v-if="activeTab === 'accountlogs'">
          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">
              <h2 style="margin:0">Account Creation Logs</h2>
              <input class="input" v-model="accountLogSearch" placeholder="Search username, uid, or ip" style="max-width:280px" />
            </div>
            <p style="color:#9bb0bd;margin:0 0 16px;font-size:13px">Track all account registrations with IP, UID, and staff status</p>
            <div v-if="!filteredAccountLogs.length" style="text-align:center;color:#9bb0bd;padding:20px">No account logs found</div>
            
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                  <tr style="border-bottom:1px solid rgba(0,255,136,0.1)">
                    <th style="text-align:left;padding:10px;color:#00ff88">UID</th>
                    <th style="text-align:left;padding:10px;color:#00ff88">Username</th>
                    <th style="text-align:left;padding:10px;color:#00ff88">IP Address</th>
                    <th style="text-align:left;padding:10px;color:#00ff88">Staff Status</th>
                    <th style="text-align:left;padding:10px;color:#00ff88">Status</th>
                    <th style="text-align:left;padding:10px;color:#00ff88">Created</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in filteredAccountLogs" :key="log.id" style="border-bottom:1px solid rgba(0,255,136,0.05);background:rgba(0,255,136,0.02)">
                    <td style="padding:10px;color:#00ffcc;font-weight:600">#{{ log.uid }}</td>
                    <td style="padding:10px;color:#d9eef5">{{ log.username }}</td>
                    <td style="padding:10px;color:#9bb0bd;font-family:monospace">{{ log.ip }}</td>
                    <td style="padding:10px">
                      <span v-if="log.staffStatus === 'admin'" style="color:#ff6b6b;font-weight:600">ADMIN</span>
                      <span v-else-if="log.staffStatus === 'manager'" style="color:#00ffcc">MANAGER</span>
                      <span v-else style="color:#51cf66">User</span>
                    </td>
                    <td style="padding:10px">
                      <span v-if="log.banned" style="color:#ff6b6b;font-weight:600">BANNED</span>
                      <span v-else style="color:#51cf66">Active</span>
                    </td>
                    <td style="padding:10px;color:#9bb0bd;font-size:11px">{{ new Date(log.timestamp).toLocaleDateString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Rank Management (Admin Only) -->
        <div v-if="activeTab === 'ranks'">
          <div style="background:var(--card);padding:18px;border-radius:8px;margin-bottom:18px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Create Custom Rank</h2>
            <div style="margin-bottom:12px">
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Rank Name</label>
              <input class="input" v-model="rankName" placeholder="e.g., Moderator" />
            </div>
            <div style="margin-bottom:12px">
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Rank Color (Hex)</label>
              <input class="input" v-model="rankColor" type="color" />
            </div>
            <button class="create-btn" @click="createRank" style="width:100%">Create Rank</button>
          </div>
          
          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Custom Ranks ({{ ranks.length }})</h2>
            <div v-for="rank in ranks" :key="rank.id" style="background:rgba(0,255,136,0.05);padding:12px;border-radius:6px;margin-bottom:8px;border-left:3px solid #00ff88">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="color:white">
                  <span :style="{color:rank.color,fontWeight:'600'}">{{ rank.name }}</span>
                  <span style="font-size:12px;color:#9bb0bd;margin-left:8px">{{ rank.color }}</span>
                </div>
                <button class="create-btn" @click="deleteRank(rank.id)" style="padding:4px 8px;font-size:11px;background:#dc3545">Delete</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Rank Permissions Management (Admin Only) -->
        <div v-if="activeTab === 'permissions'">
          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Role Permissions</h2>
            <p style="color:#9bb0bd;margin:0 0 16px">Configure what each rank can do</p>
            
            <div v-for="rank in ranks" :key="rank.id" style="background:rgba(0,255,136,0.05);padding:16px;border-radius:6px;margin-bottom:18px;border-left:3px solid #00ff88">
              <div style="color:#00ffcc;font-weight:600;margin-bottom:12px;font-size:14px">{{ rank.name }}</div>
              
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <label style="display:flex;align-items:center;gap:8px;color:#d9eef5;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.forum_access" @change="updateRankPermissions(rank.id)" />
                  Forum Access
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#d9eef5;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.create_threads" @change="updateRankPermissions(rank.id)" />
                  Create Threads
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#d9eef5;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.create_posts" @change="updateRankPermissions(rank.id)" />
                  Create Posts
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#d9eef5;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.delete_own_posts" @change="updateRankPermissions(rank.id)" />
                  Delete Own Posts
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#d9eef5;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.view_tickets" @change="updateRankPermissions(rank.id)" />
                  View Tickets
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#d9eef5;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.create_tickets" @change="updateRankPermissions(rank.id)" />
                  Create Tickets
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#d9eef5;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.generate_invites" @change="updateRankPermissions(rank.id)" />
                  Generate Invites
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ff6b6b;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.ban_users" @change="updateRankPermissions(rank.id)" />
                  Ban Users
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ff6b6b;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.delete_posts" @change="updateRankPermissions(rank.id)" />
                  Delete Posts
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ff6b6b;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.delete_threads" @change="updateRankPermissions(rank.id)" />
                  Delete Threads
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ff6b6b;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.manage_forum" @change="updateRankPermissions(rank.id)" />
                  Manage Forum
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#00ffcc;cursor:pointer">
                  <input type="checkbox" v-model="rank.permissions.change_uid" @change="updateRankPermissions(rank.id)" />
                  Change User UID
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Settings (Admin Only) -->
        <div v-if="activeTab === 'settings'">
          <div style="background:var(--card);padding:18px;border-radius:8px;border:1px solid rgba(0,255,136,0.1)">
            <h2 style="margin-top:0">Forum Settings</h2>
            <div style="margin-bottom:18px;padding:12px;background:rgba(0,255,136,0.05);border-radius:6px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <p style="margin:0;color:#d9eef5;font-weight:600">Forum Status</p>
                  <p style="margin:4px 0 0;color:#9bb0bd;font-size:12px">{{ forumIsOpen ? 'Forum is open' : 'Forum is closed' }}</p>
                </div>
                <button class="create-btn" @click="toggleForum" style="padding:10px 14px">
                  {{ forumIsOpen ? 'Close Forum' : 'Open Forum' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style="background:var(--card);padding:12px;border-radius:6px;height:fit-content;border:1px solid rgba(0,255,136,0.1)">
        <h3 style="margin-top:0">Quick Stats</h3>
        <div style="font-size:20px;color:var(--accent);font-weight:600">{{ keys.filter(k => !k.usedBy).length }}</div>
        <div class="muted">Unused Keys</div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(0,255,136,0.1)">
          <div style="font-size:20px;color:var(--accent);font-weight:600">{{ keys.length }}</div>
          <div class="muted">Total Keys</div>
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(0,255,136,0.1)">
          <div style="font-size:20px;color:var(--accent);font-weight:600">{{ accountLogs.length }}</div>
          <div class="muted">Account Logs</div>
        </div>
      </div>
    </div>

    <div v-if="banModalOpen" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:2000">
      <div style="width:min(520px,92vw);background:#0b1b22;border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,0.45)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:16px;color:#00ff88;font-weight:600">Ban User</div>
          <button class="create-btn" @click="closeBanModal" style="padding:4px 10px;font-size:12px;background:#2a3a45">Close</button>
        </div>
        <div style="color:#9bb0bd;font-size:12px;margin-bottom:10px">{{ banTarget?.username }}</div>

        <label style="display:block;margin-bottom:6px;color:#d9eef5;font-size:12px">Reason</label>
        <textarea class="input" v-model="banReason" placeholder="Explain why this user is banned" style="min-height:90px;resize:vertical"></textarea>

        <label style="display:block;margin:12px 0 6px;color:#d9eef5;font-size:12px">Duration</label>
        <select class="input" v-model="banDuration">
          <option value="1d">1 day</option>
          <option value="1w">1 week</option>
          <option value="1mo">1 month</option>
          <option value="1y">1 year</option>
          <option value="0">Permanent</option>
        </select>

        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="create-btn" @click="submitBan" :disabled="banSubmitting" style="flex:1">{{ banSubmitting ? 'Banning...' : 'Apply Ban' }}</button>
          <button class="create-btn" @click="closeBanModal" style="background:#666;flex:1">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 10px;
  margin-bottom: 18px;
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.08), rgba(0, 255, 204, 0.03));
  border: 1px solid rgba(0, 255, 136, 0.15);
}
.admin-brand img {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.35);
  background: #061218;
}
.admin-brand-title {
  font-weight: 700;
  font-size: 18px;
  color: #e7f8ff;
  letter-spacing: 1px;
}
.admin-brand-sub {
  font-size: 12px;
  color: #9bb0bd;
}
.admin-brand-role {
  margin-left: auto;
  color: #00ff88;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
</style>
