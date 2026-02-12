<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const remember = ref(false)
const twoFaRequired = ref(false)
const twoFaToken = ref('')
const twoFaCode = ref('')
const twoFaLoading = ref(false)

const showReset = ref(false)
const resetEmail = ref('')
const resetCode = ref('')
const resetNewPassword = ref('')
const resetLoading = ref(false)
const resetMessage = ref('')

async function submit() {
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: username.value, password: password.value, remember: remember.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    if (data.requiresTwoFa) {
      twoFaRequired.value = true
      twoFaToken.value = data.tempToken
      return
    }
    localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      if (remember.value) localStorage.setItem('remember', '1')
      else localStorage.removeItem('remember')
    window.location.href = '/'
  } catch (err) {
    error.value = err.message
  }
}

async function verifyTwoFa() {
  if (!twoFaCode.value.trim()) return
  error.value = ''
  twoFaLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/auth/2fa/confirm-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: twoFaToken.value, code: twoFaCode.value.trim() })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '2FA failed')
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    if (remember.value) localStorage.setItem('remember', '1')
    else localStorage.removeItem('remember')
    window.location.href = '/'
  } catch (err) {
    error.value = err.message
  } finally {
    twoFaLoading.value = false
  }
}

async function requestResetCode() {
  if (!resetEmail.value.trim()) return
  resetLoading.value = true
  resetMessage.value = ''
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/auth/reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail.value.trim() })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to send code')
    resetMessage.value = data.message || 'If the email exists, a code was sent.'
  } catch (err) {
    error.value = err.message
  } finally {
    resetLoading.value = false
  }
}

async function submitReset() {
  if (!resetEmail.value.trim() || !resetCode.value.trim() || !resetNewPassword.value) return
  resetLoading.value = true
  resetMessage.value = ''
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/auth/reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: resetEmail.value.trim(),
        code: resetCode.value.trim(),
        newPassword: resetNewPassword.value
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to reset password')
    resetMessage.value = 'Password updated. You can log in now.'
    showReset.value = false
  } catch (err) {
    error.value = err.message
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <div class="container" style="max-width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center">
    <div class="form-card">
      <h2 style="text-align:center;margin-top:0">Login</h2>
      <div v-if="error" style="color:#ff6b6b;margin-bottom:12px;text-align:center">{{ error }}</div>
      <form v-if="!twoFaRequired && !showReset" @submit.prevent="submit">
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Username</label>
          <input class="input" v-model="username" />
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Password</label>
          <input class="input" type="password" v-model="password" />
        </div>
        <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="remember" v-model="remember" />
          <label for="remember" style="color:#d9eef5">Remember me (auto sign-in)</label>
        </div>
        <button type="submit" class="create-btn" style="width:100%;font-size:16px;padding:12px">Login</button>
        <button type="button" class="create-btn" @click="showReset = true" style="width:100%;margin-top:8px;background:#2a3a45">Forgot Password</button>
      </form>

      <div v-else-if="twoFaRequired">
        <div style="margin-bottom:12px;color:#9bb0bd;font-size:13px">Enter the 6-digit code sent to your email.</div>
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">2FA Code</label>
          <input class="input" v-model="twoFaCode" />
        </div>
        <button class="create-btn" @click="verifyTwoFa" :disabled="twoFaLoading" style="width:100%;font-size:16px;padding:12px">
          {{ twoFaLoading ? 'Verifying...' : 'Verify Code' }}
        </button>
      </div>

      <div v-else>
        <div v-if="resetMessage" style="color:#51cf66;margin-bottom:10px;background:rgba(81,207,102,0.1);padding:8px;border-radius:6px">{{ resetMessage }}</div>
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Email</label>
          <input class="input" type="email" v-model="resetEmail" />
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="create-btn" @click="requestResetCode" :disabled="resetLoading" style="flex:1">Send Code</button>
          <button class="create-btn" @click="showReset = false" style="flex:1;background:#2a3a45">Back to Login</button>
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Reset Code</label>
          <input class="input" v-model="resetCode" />
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5">New Password</label>
          <input class="input" type="password" v-model="resetNewPassword" />
        </div>
        <button class="create-btn" @click="submitReset" :disabled="resetLoading" style="width:100%;font-size:16px;padding:12px">
          {{ resetLoading ? 'Updating...' : 'Reset Password' }}
        </button>
      </div>

      <p v-if="!showReset" style="text-align:center;color:#9bb0bd;margin:12px 0 0">Don't have an account? <a href="/register" style="color:#00ff88;text-decoration:none">Register</a></p>
    </div>
  </div>
</template>
