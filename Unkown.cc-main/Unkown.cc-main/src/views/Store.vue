<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../lib/apiBase'

const products = ref([])
const loading = ref(false)
const error = ref('')
const token = localStorage.getItem('token')
const router = useRouter()

const selectedPlanMonths = ref(1)
const selectedPlanIndex = ref(0)

const plans = ref([
  { months: 1, label: '1 month', multiplier: 1, saveText: '' },
  { months: 3, label: '3 months', multiplier: 3, saveText: 'Save 10%' },
  { months: 6, label: '6 months', multiplier: 6, saveText: 'Save 20%' },
  { months: 12, label: '12 months', multiplier: 12, saveText: 'Save 30%' }
])

function priceFor(prod, months, multiplierOverride) {
  const base = parseFloat(prod.price) || 0
  const m = multiplierOverride ?? months
  // apply discounts for non-1 month options
  let total = base * m
  if (m === 3) total *= 0.9
  if (m === 6) total *= 0.8
  if (m === 12) total *= 0.7
  return (Math.round(total * 100) / 100).toFixed(2)
}

async function loadProducts() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/store/products`)
    if (!res.ok) throw new Error('Failed to load products')
    products.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally { loading.value = false }
}

const product = computed(() => products.value[0] || { id: 'demo', name: 'Product', description: '', price: '20.00', currency: 'USD', image: '' })

async function buySelected() {
  const prod = product.value
  const months = plans.value[selectedPlanIndex.value].months
  if (!token) return router.push('/login')
  localStorage.setItem('pendingCheckout', JSON.stringify({
    productId: prod.id,
    months,
    createdAt: Date.now()
  }))
  router.push('/terms')
}

onMounted(loadProducts)
</script>

<template>
  <div class="container store-page">
    <h2 style="color:var(--accent)">Store</h2>
    <div v-if="error" style="color:#ff6b6b">{{ error }}</div>
    <div v-if="loading">Loading products...</div>

    <div v-else class="store-grid">
      <div class="left-panel">
        <div class="product-hero">
          <div class="product-image" v-if="product.image" :style="{ 'background-image': 'url('+product.image+')' }"></div>
          <div v-else class="product-image placeholder">
            <svg width="220" height="120" viewBox="0 0 220 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="220" height="120" rx="8" fill="#081215"/>
              <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#2a6b5a" font-size="22">{{ product.name }}</text>
            </svg>
          </div>
        </div>

        <div style="margin-top:18px">
          <div class="muted">Choose Subscription Length</div>
          <div class="subscription-row">
            <div v-for="(p, idx) in plans" :key="p.months" :class="['subscription-card', {active: idx === selectedPlanIndex}]" @click="selectedPlanIndex = idx">
              <div class="sub-label">{{ p.label }}</div>
              <div class="sub-price">${{ priceFor(product, p.months, p.multiplier) }} <span class="muted" style="font-size:12px">/mo</span></div>
              <div class="sub-save" v-if="p.saveText">{{ p.saveText }}</div>
            </div>
          </div>

          <div class="price-summary">
            <div>
              <div style="font-size:22px;font-weight:800">${{ priceFor(product, plans[selectedPlanIndex].months) }}</div>
              <div class="muted">Total for {{ plans[selectedPlanIndex].months }} month(s)</div>
            </div>
            <button class="buy-btn" @click="buySelected">Buy Now</button>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="description-box">
          <h3 style="margin-top:0">Description</h3>
          <div class="desc-scroll" v-html="product.description"></div>
        </div>
      </div>
    </div>
  </div>
</template>
