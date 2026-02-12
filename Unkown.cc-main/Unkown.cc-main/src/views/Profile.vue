<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const route = useRoute()
const token = localStorage.getItem('token')
const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

const profile = ref({
  uid: null,
  username: '',
  profile: {},
  createdAt: null
})
const isOwnProfile = ref(false)
const editMode = ref(false)
const activeTab = ref('profile')
const bio = ref('')
const signature = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const accessRevoked = ref(false)
const accessKey = ref('')
const redeemLoading = ref(false)

const pfpUploadData = ref('')
const bannerUploadData = ref('')
const pfpPreview = ref('')
const bannerPreview = ref('')
const pfpFileName = ref('')
const bannerFileName = ref('')
const pfpSourceUrl = ref('')
const bannerSourceUrl = ref('')

const cropModalOpen = ref(false)
const cropType = ref('pfp')
const cropImageUrl = ref('')
const cropImageType = ref('image/png')
const cropZoom = ref(1)
const cropOffset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const offsetStart = ref({ x: 0, y: 0 })

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const allowedImageLabel = 'PNG, JPG, WEBP, or GIF'

const isStaffUser = computed(() => {
  return currentUser?.staffRole === 'admin' || currentUser?.staffRole === 'manager' || currentUser?.role === 'staff'
    || (currentUser?.roles || []).includes('role_admin') || (currentUser?.roles || []).includes('role_manager')
})

function resolveImageUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) return `${API_BASE}${url}`
  return url
}

const pfpDisplay = computed(() => resolveImageUrl(pfpPreview.value) || resolveImageUrl(profile.value.profile?.pfp))
const bannerDisplay = computed(() => resolveImageUrl(bannerPreview.value) || resolveImageUrl(profile.value.profile?.banner))
const cropFrame = computed(() => {
  return cropType.value === 'pfp'
    ? { width: 280, height: 280 }
    : { width: 640, height: 200 }
})

const invites = ref([])
const inviteStats = ref({ invitationsSentToday: 0, invitationsSentThisMonth: 0, totalInvitationsSent: 0 })
const invitesLoading = ref(false)
const invitesError = ref('')
const canGenerateInvites = ref(false)
const inviteGenerateCount = ref(1)

const securityEmail = ref('')
const twoFaEnabled = ref(false)
const twoFaCode = ref('')
const twoFaLoading = ref(false)
const twoFaVerifyLoading = ref(false)
const twoFaMode = ref('enable')
const securityMessage = ref('')
const resetCode = ref('')
const resetNewPassword = ref('')
const resetLoading = ref(false)
const cropImageStyle = computed(() => {
  return {
    transform: `translate(${cropOffset.value.x}px, ${cropOffset.value.y}px) scale(${cropZoom.value})`,
    transformOrigin: 'center',
    cursor: isDragging.value ? 'grabbing' : 'grab'
  }
})

async function loadProfile() {
  const userId = route.params.id || currentUser.id
  isOwnProfile.value = userId === currentUser.id
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/users/${userId}/profile`)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to load profile')
    }
    const data = await res.json()
    profile.value = data
    bio.value = data.profile?.bio || ''
    signature.value = data.profile?.signature || ''
    accessRevoked.value = !!data.accessRevoked
  } catch (err) {
    error.value = err.message
  }
}

async function loadInvites() {
  if (!isOwnProfile.value) return
  invitesLoading.value = true
  invitesError.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/users/invites`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load invites')
    invites.value = data.invites || []
    inviteStats.value = data.stats || inviteStats.value
    canGenerateInvites.value = !!data.canGenerate
  } catch (err) {
    invitesError.value = err.message
  } finally {
    invitesLoading.value = false
  }
}

async function generateInvites() {
  if (!canGenerateInvites.value || !isStaffUser.value) return
  invitesError.value = ''
  invitesLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/users/invites/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ count: inviteGenerateCount.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to generate invites')
    await loadInvites()
  } catch (err) {
    invitesError.value = err.message
  } finally {
    invitesLoading.value = false
  }
}

async function loadSecurity() {
  if (!isOwnProfile.value) return
  securityMessage.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/users/security`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load security info')
    securityEmail.value = data.email || ''
    twoFaEnabled.value = !!data.twoFaEnabled
  } catch (err) {
    error.value = err.message
  }
}

async function sendTwoFaCode() {
  twoFaLoading.value = true
  securityMessage.value = ''
  try {
    const endpoint = twoFaEnabled.value ? '/api/auth/2fa/request-disable' : '/api/auth/2fa/request-enable'
    twoFaMode.value = twoFaEnabled.value ? 'disable' : 'enable'
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to send code')
    securityMessage.value = 'Code sent to your email.'
  } catch (err) {
    error.value = err.message
  } finally {
    twoFaLoading.value = false
  }
}

async function verifyTwoFaCode() {
  if (!twoFaCode.value.trim()) return
  twoFaVerifyLoading.value = true
  securityMessage.value = ''
  try {
    const endpoint = twoFaMode.value === 'disable' ? '/api/auth/2fa/disable' : '/api/auth/2fa/enable'
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: twoFaCode.value.trim() })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to verify code')
    twoFaEnabled.value = twoFaMode.value !== 'disable'
    twoFaCode.value = ''
    securityMessage.value = twoFaEnabled.value ? '2FA enabled.' : '2FA disabled.'
  } catch (err) {
    error.value = err.message
  } finally {
    twoFaVerifyLoading.value = false
  }
}

async function sendResetCode() {
  if (!securityEmail.value) return
  resetLoading.value = true
  securityMessage.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/auth/reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: securityEmail.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to send reset code')
    securityMessage.value = data.message || 'If the email exists, a code was sent.'
  } catch (err) {
    error.value = err.message
  } finally {
    resetLoading.value = false
  }
}

async function resetPassword() {
  if (!securityEmail.value || !resetCode.value.trim() || !resetNewPassword.value) return
  resetLoading.value = true
  securityMessage.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/auth/reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: securityEmail.value,
        code: resetCode.value.trim(),
        newPassword: resetNewPassword.value
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to reset password')
    securityMessage.value = 'Password updated.'
    resetCode.value = ''
    resetNewPassword.value = ''
  } catch (err) {
    error.value = err.message
  } finally {
    resetLoading.value = false
  }
}

function openCropModal(type, sourceUrl, mimeType) {
  cropType.value = type
  cropImageUrl.value = sourceUrl
  cropImageType.value = mimeType || 'image/png'
  cropZoom.value = 1
  cropOffset.value = { x: 0, y: 0 }
  cropModalOpen.value = true
}

function closeCropModal() {
  cropModalOpen.value = false
  cropImageUrl.value = ''
}

function handlePfpSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!allowedImageTypes.includes(file.type)) {
    error.value = `Only ${allowedImageLabel} files are allowed.`
    event.target.value = ''
    return
  }
  pfpFileName.value = file.name
  pfpSourceUrl.value = URL.createObjectURL(file)
  openCropModal('pfp', pfpSourceUrl.value, file.type)
  event.target.value = ''
}

function handleBannerSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!allowedImageTypes.includes(file.type)) {
    error.value = `Only ${allowedImageLabel} files are allowed.`
    event.target.value = ''
    return
  }
  bannerFileName.value = file.name
  bannerSourceUrl.value = URL.createObjectURL(file)
  openCropModal('banner', bannerSourceUrl.value, file.type)
  event.target.value = ''
}

function openAdjust(type) {
  const source = type === 'pfp' ? (pfpDisplay.value || '') : (bannerDisplay.value || '')
  if (!source) return
  openCropModal(type, source, 'image/png')
}

function startDrag(event) {
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  offsetStart.value = { x: cropOffset.value.x, y: cropOffset.value.y }
}

function onDrag(event) {
  if (!isDragging.value) return
  cropOffset.value = {
    x: offsetStart.value.x + (event.clientX - dragStart.value.x),
    y: offsetStart.value.y + (event.clientY - dragStart.value.y)
  }
}

function endDrag() {
  isDragging.value = false
}

async function renderCropToDataUrl() {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const frame = cropFrame.value
      const canvas = document.createElement('canvas')
      canvas.width = frame.width
      canvas.height = frame.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas not supported'))

      const baseScale = Math.max(frame.width / img.width, frame.height / img.height)
      const scale = baseScale * cropZoom.value
      const drawWidth = img.width * scale
      const drawHeight = img.height * scale
      const dx = (frame.width - drawWidth) / 2 + cropOffset.value.x
      const dy = (frame.height - drawHeight) / 2 + cropOffset.value.y

      ctx.drawImage(img, dx, dy, drawWidth, drawHeight)
      resolve(canvas.toDataURL(cropImageType.value || 'image/png'))
    }
    img.onerror = () => reject(new Error('failed to load image'))
    img.src = cropImageUrl.value
  })
}

async function applyCrop() {
  try {
    const dataUrl = await renderCropToDataUrl()
    if (cropType.value === 'pfp') {
      pfpUploadData.value = dataUrl
      pfpPreview.value = dataUrl
    } else {
      bannerUploadData.value = dataUrl
      bannerPreview.value = dataUrl
    }
    closeCropModal()
  } catch (err) {
    error.value = err.message
  }
}

async function redeemKey() {
  if (!accessKey.value.trim()) return
  error.value = ''
  success.value = ''
  redeemLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/users/redeem-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key: accessKey.value.trim() })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to redeem key')
    accessRevoked.value = false
    accessKey.value = ''
    const stored = JSON.parse(localStorage.getItem('user') || '{}')
    stored.accessRevoked = false
    localStorage.setItem('user', JSON.stringify(stored))
    success.value = 'Access restored!'
  } catch (err) {
    error.value = err.message
  } finally {
    redeemLoading.value = false
  }
}

async function updateProfile() {
  loading.value = true
  error.value = ''
  success.value = ''
  
  try {
    const body = { bio: bio.value, signature: signature.value }
    
    if (pfpUploadData.value) body.pfp = pfpUploadData.value
    if (bannerUploadData.value) body.banner = bannerUploadData.value
    
    const res = await fetch(`${API_BASE}/api/users/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to update profile')

    success.value = 'Profile updated!'
    pfpUploadData.value = ''
    bannerUploadData.value = ''
    pfpPreview.value = ''
    bannerPreview.value = ''
    editMode.value = false
    await loadProfile()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadProfile)

watch([activeTab, isOwnProfile], ([tab]) => {
  if (!isOwnProfile.value) return
  if (tab === 'invites') loadInvites()
  if (tab === 'security') loadSecurity()
})
</script>

<template>
  <div class="container" style="max-width:800px">
    <div style="margin-bottom:18px">
      <a href="/" style="color:#00ff88;text-decoration:none">← Back</a>
    </div>

    <div v-if="error" style="color:#ff6b6b;margin-bottom:12px;background:rgba(255,107,107,0.1);padding:12px;border-radius:6px">{{ error }}</div>
    <div v-if="success" style="color:#51cf66;margin-bottom:12px;background:rgba(81,207,102,0.1);padding:12px;border-radius:6px">{{ success }}</div>

    <div v-if="accessRevoked && isOwnProfile" style="margin-bottom:16px;background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.35);border-radius:8px;padding:14px">
      <div style="color:#ff6b6b;font-weight:600;margin-bottom:8px">Forum access revoked</div>
      <div style="color:#9bb0bd;font-size:12px;margin-bottom:10px">Redeem a new key to regain access to forums.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input class="input" v-model="accessKey" placeholder="Enter access key" style="flex:1;min-width:200px" />
        <button class="create-btn" @click="redeemKey" :disabled="redeemLoading" style="min-width:140px">{{ redeemLoading ? 'Redeeming...' : 'Redeem Key' }}</button>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:18px;border-bottom:1px solid rgba(0,255,136,0.2)">
      <button class="create-btn" @click="activeTab='profile'" :style="{background:activeTab==='profile' ? '#00ff88' : '#2a3a45',color:activeTab==='profile' ? '#061218' : '#d9eef5'}">Profile</button>
      <button class="create-btn" @click="activeTab='invites'" :style="{background:activeTab==='invites' ? '#00ff88' : '#2a3a45',color:activeTab==='invites' ? '#061218' : '#d9eef5'}">Invites</button>
      <button class="create-btn" @click="activeTab='security'" :style="{background:activeTab==='security' ? '#00ff88' : '#2a3a45',color:activeTab==='security' ? '#061218' : '#d9eef5'}">Security</button>
    </div>

    <div v-if="activeTab === 'profile'">
      <!-- Banner -->
      <div v-if="!editMode && bannerDisplay" style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;margin-bottom:20px;overflow:hidden;height:150px">
        <img :src="bannerDisplay" style="width:100%;height:100%;object-fit:cover" />
      </div>

    <!-- Profile Header -->
    <div style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:24px;margin-bottom:20px;position:relative">
      <div v-if="editMode && isOwnProfile" style="position:absolute;top:12px;right:12px">
        <label style="cursor:pointer;color:#00ff88;font-size:12px;display:block;margin-bottom:8px">
          <input type="file" :accept="allowedImageTypes.join(',')" @change="handleBannerSelect" style="display:none" />
          Change Banner
        </label>
        <button v-if="bannerDisplay" class="create-btn" @click="openAdjust('banner')" style="padding:4px 10px;font-size:11px">Readjust</button>
      </div>

      <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:20px">
        <!-- PFP -->
        <div style="position:relative;flex-shrink:0">
          <div v-if="pfpDisplay" style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid #00ff88">
            <img :src="pfpDisplay" style="width:100%;height:100%;object-fit:cover" />
          </div>
          <div v-else style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#00ff88,#00ffcc);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:bold;color:#061218;border:3px solid #00ff88">
            {{ profile.username?.charAt(0).toUpperCase() || 'U' }}
          </div>
          <label v-if="editMode && isOwnProfile" style="position:absolute;bottom:0;right:0;width:24px;height:24px;background:#00ff88;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:#061218;font-weight:bold">
            <input type="file" :accept="allowedImageTypes.join(',')" @change="handlePfpSelect" style="display:none" />
            ✎
          </label>
        </div>

        <!-- User Info -->
        <div style="flex:1">
          <div style="color:#00ffcc;font-size:24px;font-weight:600">{{ profile.username }}</div>
          <div style="color:#9bb0bd;font-size:14px;margin-top:2px">
            <span v-if="profile.uid !== null">UID #{{ profile.uid }}</span>
            <span v-else>UID #-</span>
          </div>
          <div style="color:#00ff88;font-size:13px;margin-top:4px">
            Member since 
            <span v-if="profile.createdAt">{{ new Date(profile.createdAt).toLocaleDateString() }}</span>
            <span v-else>Unknown</span>
          </div>
        </div>
      </div>

      <!-- Bio Display/Edit -->
      <div style="border-top:1px solid rgba(0,255,136,0.1);padding-top:16px">
        <div v-if="!editMode" style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div style="color:#9bb0bd;font-size:12px;margin-bottom:4px">Bio</div>
            <div style="color:#d9eef5">{{ bio || 'No bio yet' }}</div>
          </div>
          <button v-if="isOwnProfile" class="create-btn" @click="editMode = true" style="padding:6px 12px;font-size:12px">Edit Profile</button>
        </div>
        <div v-else>
          <label style="display:block;margin-bottom:4px;color:#d9eef5;font-size:12px">Bio</label>
          <textarea class="input" v-model="bio" placeholder="Tell us about yourself..." style="min-height:80px;width:100%"></textarea>

          <div style="margin-top:16px">
            <label style="display:block;margin-bottom:4px;color:#d9eef5;font-size:12px">Profile Picture</label>
            <div v-if="pfpFileName" style="color:#00ff88;font-size:12px;margin-bottom:8px">
              ✓ Selected: {{ pfpFileName }}
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <input type="file" :accept="allowedImageTypes.join(',')" @change="handlePfpSelect" style="display:block;color:#d9eef5;font-size:12px" />
              <button v-if="pfpDisplay" class="create-btn" @click="openAdjust('pfp')" style="padding:4px 10px;font-size:11px">Readjust</button>
            </div>
            <div style="color:#9bb0bd;font-size:11px;margin-top:6px">Allowed: {{ allowedImageLabel }}</div>
          </div>

          <div style="margin-top:16px">
            <label style="display:block;margin-bottom:4px;color:#d9eef5;font-size:12px">Banner</label>
            <div v-if="bannerFileName" style="color:#00ff88;font-size:12px;margin-bottom:8px">
              ✓ Selected: {{ bannerFileName }}
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <input type="file" :accept="allowedImageTypes.join(',')" @change="handleBannerSelect" style="display:block;color:#d9eef5;font-size:12px" />
              <button v-if="bannerDisplay" class="create-btn" @click="openAdjust('banner')" style="padding:4px 10px;font-size:11px">Readjust</button>
            </div>
            <div style="color:#9bb0bd;font-size:11px;margin-top:6px">Allowed: {{ allowedImageLabel }}</div>
          </div>

          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="create-btn" @click="updateProfile" :disabled="loading" style="flex:1">{{ loading ? 'Saving...' : 'Save Changes' }}</button>
            <button class="create-btn" @click="editMode = false" style="background:#666;flex:1">Cancel</button>
          </div>
        </div>
      </div>
    </div>

      <!-- Signature -->
      <div style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:20px">
        <div style="color:#00ff88;font-weight:600;margin-bottom:12px">Signature</div>
        <div style="color:#d9eef5;border-left:3px solid #00ff88;padding-left:12px;padding-top:8px;padding-bottom:8px;min-height:40px">
          {{ signature || 'No signature' }}
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'invites'">
      <div style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:18px;margin-bottom:18px">
        <h2 style="margin-top:0">Your invitations</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
          <div style="background:#0b1b22;border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:12px">
            <div style="color:#9bb0bd;font-size:12px">Invitations sent today</div>
            <div style="color:#00ff88;font-size:18px;font-weight:700">{{ inviteStats.invitationsSentToday }}</div>
          </div>
          <div style="background:#0b1b22;border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:12px">
            <div style="color:#9bb0bd;font-size:12px">Invitations sent this month</div>
            <div style="color:#00ff88;font-size:18px;font-weight:700">{{ inviteStats.invitationsSentThisMonth }}</div>
          </div>
          <div style="background:#0b1b22;border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:12px">
            <div style="color:#9bb0bd;font-size:12px">Total invitations sent</div>
            <div style="color:#00ff88;font-size:18px;font-weight:700">{{ inviteStats.totalInvitationsSent }}</div>
          </div>
        </div>

        <div v-if="canGenerateInvites && isStaffUser" style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
          <input class="input" type="number" min="1" max="25" v-model.number="inviteGenerateCount" style="width:90px" />
          <button class="create-btn" @click="generateInvites" :disabled="invitesLoading">Generate Invites</button>
        </div>

        <div v-if="invitesError" style="color:#ff6b6b;margin-bottom:12px">{{ invitesError }}</div>
        <div v-if="invitesLoading" style="color:#9bb0bd">Loading invites...</div>

        <div v-else style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="border-bottom:1px solid rgba(0,255,136,0.1)">
                <th style="text-align:left;padding:10px;color:#00ff88">Date</th>
                <th style="text-align:left;padding:10px;color:#00ff88">Invitation code</th>
                <th style="text-align:left;padding:10px;color:#00ff88">Registered user</th>
                <th style="text-align:left;padding:10px;color:#00ff88">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in invites" :key="inv.id" style="border-bottom:1px solid rgba(0,255,136,0.05)">
                <td style="padding:10px;color:#9bb0bd">{{ new Date(inv.generatedAt).toLocaleDateString() }}</td>
                <td style="padding:10px;color:#d9eef5;font-family:monospace">{{ inv.key }}</td>
                <td style="padding:10px;color:#9bb0bd">{{ inv.usedByUsername || '--' }}</td>
                <td style="padding:10px;color:#9bb0bd">{{ inv.revoked ? 'revoked' : (inv.usedBy ? 'used' : 'unused') }}</td>
              </tr>
              <tr v-if="!invites.length">
                <td colspan="4" style="padding:16px;color:#9bb0bd;text-align:center">No invitations yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-else>
      <div style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:18px;margin-bottom:18px">
        <h2 style="margin-top:0">Two-Factor Authentication</h2>
        <p style="color:#9bb0bd;font-size:12px">Status: <span :style="{color: twoFaEnabled ? '#51cf66' : '#ff6b6b'}">{{ twoFaEnabled ? 'Enabled' : 'Disabled' }}</span></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="create-btn" @click="sendTwoFaCode" :disabled="twoFaLoading">
            {{ twoFaEnabled ? 'Send Disable Code' : 'Send Enable Code' }}
          </button>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input class="input" v-model="twoFaCode" placeholder="Enter 6-digit code" style="max-width:220px" />
          <button class="create-btn" @click="verifyTwoFaCode" :disabled="twoFaVerifyLoading">{{ twoFaVerifyLoading ? 'Verifying...' : 'Confirm' }}</button>
        </div>
      </div>

      <div style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:18px">
        <h2 style="margin-top:0">Password Reset</h2>
        <div style="color:#9bb0bd;font-size:12px;margin-bottom:8px">Email: {{ securityEmail || 'Loading...' }}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button class="create-btn" @click="sendResetCode" :disabled="resetLoading">Send Reset Code</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="input" v-model="resetCode" placeholder="Reset code" style="max-width:200px" />
          <input class="input" type="password" v-model="resetNewPassword" placeholder="New password" style="max-width:220px" />
          <button class="create-btn" @click="resetPassword" :disabled="resetLoading">{{ resetLoading ? 'Updating...' : 'Update Password' }}</button>
        </div>
        <div v-if="securityMessage" style="color:#51cf66;margin-top:10px">{{ securityMessage }}</div>
      </div>
    </div>

    <div v-if="cropModalOpen" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:2000">
      <div style="width:min(760px,94vw);background:#0b1b22;border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,0.45)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:16px;color:#00ff88;font-weight:600">Readjust {{ cropType === 'pfp' ? 'Profile Picture' : 'Banner' }}</div>
          <button class="create-btn" @click="closeCropModal" style="padding:4px 10px;font-size:12px;background:#2a3a45">Close</button>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
          <div
            :style="{width: cropFrame.width + 'px', height: cropFrame.height + 'px', borderRadius: cropType === 'pfp' ? '50%' : '10px', overflow:'hidden', background:'#0f222b', border:'2px solid rgba(0,255,136,0.35)'}"
            @mousedown="startDrag"
            @mousemove="onDrag"
            @mouseup="endDrag"
            @mouseleave="endDrag"
          >
            <img
              :src="cropImageUrl"
              :style="cropImageStyle"
              style="width:100%;height:100%;object-fit:cover;user-select:none"
              draggable="false"
            />
          </div>

          <div style="width:min(420px,90%);display:flex;align-items:center;gap:10px;color:#9bb0bd;font-size:12px">
            <span>Zoom</span>
            <input type="range" min="1" max="3" step="0.01" v-model.number="cropZoom" style="flex:1" />
          </div>
        </div>

        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="create-btn" @click="applyCrop" style="flex:1">Apply</button>
          <button class="create-btn" @click="closeCropModal" style="background:#666;flex:1">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>
