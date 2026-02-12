<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const router = useRouter()
const tos = ref({ title: 'Terms and Conditions', content: '' })
const loading = ref(false)
const error = ref('')
const accepted = ref(false)
const pendingCheckout = ref(null)
const currentUser = JSON.parse(localStorage.getItem('user') || 'null')

const canCheckout = computed(() => accepted.value && !!pendingCheckout.value)

function loadPendingCheckout() {
  try {
    const raw = localStorage.getItem('pendingCheckout')
    pendingCheckout.value = raw ? JSON.parse(raw) : null
  } catch (e) {
    pendingCheckout.value = null
  }
}

async function loadTos() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/tos`)
    if (!res.ok) throw new Error('Failed to load terms')
    const data = await res.json()
    tos.value = data || tos.value
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function completeCheckout() {
  if (!canCheckout.value) return
  const token = localStorage.getItem('token')
  if (!token) return router.push('/login')

  try {
    const { productId, months } = pendingCheckout.value
    const signature = currentUser?.username || 'accepted'
    const res = await fetch(`${API_BASE}/api/store/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        productId,
        months,
        paymentIntentId: `pi_dummy_${Date.now()}`,
        tosAccepted: true,
        tosSignature: signature
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Purchase failed')
    localStorage.removeItem('pendingCheckout')
    router.push('/store')
  } catch (err) {
    error.value = err.message
  }
}

onMounted(() => {
  loadPendingCheckout()
  loadTos()
})
</script>

<template>
  <div class="terms-page">
    <div class="terms-card">
      <div class="terms-title">Terms & Conditions</div>
      <div class="terms-subtitle">Review and accept before checkout.</div>

      <div v-if="error" class="terms-error">{{ error }}</div>
      <div v-if="loading" class="terms-loading">Loading terms...</div>

      <div v-else class="terms-content" v-html="tos.content || '<p>No terms provided yet.</p>'"></div>

      <label class="terms-accept">
        <input type="checkbox" v-model="accepted" />
        <span>I accept the terms and conditions</span>
      </label>

      <button class="terms-btn" :disabled="!canCheckout" @click="completeCheckout">
        Check out
      </button>

      <div v-if="!pendingCheckout" class="terms-hint">
        No pending checkout. <button class="terms-link" @click="router.push('/store')">Go to store</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terms-page {
  min-height: calc(100vh - 70px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 18px;
  background: radial-gradient(circle at 20% 20%, #4ea1ff 0%, #2f77d1 35%, #1c4f9b 100%);
  font-family: "Space Grotesk", "Sora", "Segoe UI", sans-serif;
}
.terms-card {
  width: min(520px, 92vw);
  background: #ffffff;
  border-radius: 12px;
  padding: 26px;
  box-shadow: 0 18px 50px rgba(10, 30, 60, 0.35);
  color: #0b1b2b;
}
.terms-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 6px;
}
.terms-subtitle {
  color: #5a6b7b;
  font-size: 13px;
  margin-bottom: 16px;
}
.terms-content {
  max-height: 220px;
  overflow: auto;
  border: 1px solid #e6edf4;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  background: #f7fbff;
  margin-bottom: 16px;
}
.terms-accept {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  margin-bottom: 14px;
  color: #1d2f45;
}
.terms-btn {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: none;
  background: #111111;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.terms-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.terms-btn:not(:disabled):hover {
  transform: translateY(-1px);
}
.terms-error {
  background: #ffe8e8;
  color: #a11c1c;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  margin-bottom: 12px;
}
.terms-loading {
  color: #5a6b7b;
  font-size: 12px;
  margin-bottom: 12px;
}
.terms-hint {
  margin-top: 14px;
  font-size: 12px;
  color: #5a6b7b;
  text-align: center;
}
.terms-link {
  background: none;
  border: none;
  color: #1e5fdb;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
</style>
