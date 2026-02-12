<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const router = useRouter()
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const inviteKey = ref('')
const error = ref('')
const success = ref('')

function validateUsername() {
  if (username.value.length < 3 || username.value.length > 25) {
    return 'Username must be 3-25 characters'
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username.value)) {
    return 'Username must be alphanumeric'
  }
  return ''
}

function validateEmail() {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email.value) ? '' : 'Invalid email address'
}

function validatePassword() {
  if (password.value.length < 6) return 'Password must be at least 6 characters'
  if (password.value !== confirmPassword.value) return 'Passwords do not match'
  return ''
}

async function submit() {
  error.value = ''
  success.value = ''
  
  const usernameErr = validateUsername()
  const emailErr = validateEmail()
  const passwordErr = validatePassword()
  
  if (usernameErr) return error.value = usernameErr
  if (emailErr) return error.value = emailErr
  if (passwordErr) return error.value = passwordErr
  
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        username: username.value, 
        email: email.value,
        password: password.value,
        inviteKey: inviteKey.value || undefined
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Register failed')
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    success.value = 'Account created! Redirecting...'
    setTimeout(() => router.push('/'), 1500)
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <div class="container" style="max-width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
    <div class="form-card" style="max-width:600px;width:100%">
      <h2 style="text-align:center;margin-top:0">Create Account</h2>
      <div v-if="error" style="color:#ff6b6b;margin-bottom:12px;background:rgba(255,107,107,0.1);padding:10px;border-radius:6px">{{ error }}</div>
      <div v-if="success" style="color:#51cf66;margin-bottom:12px;background:rgba(81,207,102,0.1);padding:10px;border-radius:6px">{{ success }}</div>
      <form @submit.prevent="submit">
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5;font-size:14px">
            <span style="color:#00ff88">Your username must be alphanumeric between 3 and 25 characters long</span>
          </label>
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Username</label>
          <input class="input" v-model="username" placeholder="your_username" />
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5;font-size:14px">
            <span style="color:#00ff88">Please enter and confirm your chosen password</span>
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Password</label>
              <input class="input" type="password" v-model="password" placeholder="••••••" />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;color:#d9eef5">Confirm password</label>
              <input class="input" type="password" v-model="confirmPassword" placeholder="••••••" />
            </div>
          </div>
          <p style="margin:4px 0 0;color:#9bb0bd;font-size:12px">Passwords must be at least 6 characters long. Passwords are case sensitive.</p>
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5;font-size:14px">
            <span style="color:#00ff88">Enter a valid email address</span>
          </label>
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Email</label>
          <input class="input" type="email" v-model="email" placeholder="your@email.com" />
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;margin-bottom:4px;color:#d9eef5;font-size:14px">
            <span style="color:#00ff88">You must be invited to join this forum</span>
          </label>
          <label style="display:block;margin-bottom:4px;color:#d9eef5">Invitation Key</label>
          <input class="input" v-model="inviteKey" placeholder="invitation-key-here" />
        </div>
        <button type="submit" class="create-btn" style="width:100%;font-size:16px;padding:12px">Register</button>
      </form>
      <p style="text-align:center;color:#9bb0bd;margin:12px 0 0">Already have an account? <a href="/login" style="color:#00ff88;text-decoration:none">Login</a></p>
    </div>
  </div>
</template>
