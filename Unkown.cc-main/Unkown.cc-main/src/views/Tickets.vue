<script setup>
import { ref, onMounted } from 'vue'
import { API_BASE } from '../lib/apiBase'

const token = localStorage.getItem('token')
const user = JSON.parse(localStorage.getItem('user') || '{}')

const tickets = ref([])
const filteredTickets = ref([])
const searchUser = ref('')
const selectedTicket = ref(null)
const staffCanViewAll = user?.staffRole === 'admin' || user?.staffRole === 'manager' || user?.role === 'staff'
const newTicketSubject = ref('')
const newTicketDescription = ref('')
const newTicketCategory = ref('general')
const loading = ref(false)
const error = ref('')
const success = ref('')
const showCreateForm = ref(false)

const isAdmin = user?.staffRole === 'admin'


async function loadTickets() {
  try {
    const res = await fetch(`${API_BASE}/api/tickets`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to load tickets')
    tickets.value = await res.json()
    filterTickets()
  } catch (err) {
    error.value = err.message
  }
}

function filterTickets() {
  if (!staffCanViewAll || !searchUser.value) {
    filteredTickets.value = tickets.value
    return
  }
  const q = searchUser.value.toLowerCase().trim()
  filteredTickets.value = tickets.value.filter(t => (t.username && t.username.toLowerCase().includes(q)) || (t.createdByUsername && t.createdByUsername.toLowerCase().includes(q)))
}

function selectTicket(ticket) {
  selectedTicket.value = ticket
}

async function closeTicket(ticket) {
  if (!ticket) return
  try {
    const res = await fetch(`${API_BASE}/api/tickets/${ticket.id}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to close ticket')
    success.value = 'Ticket closed.'
    selectedTicket.value = null
    await loadTickets()
  } catch (err) {
    error.value = err.message
  }
}

async function respondToTicket(ticket, response) {
  if (!ticket || !response) return
  try {
    const res = await fetch(`${API_BASE}/api/tickets/${ticket.id}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message: response })
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to send response')
    success.value = 'Response sent.'
    selectedTicket.value.staffResponse = ''
    await loadTickets()
    // Optionally, keep modal open and update selectedTicket
    // selectedTicket.value = (await res.json())
  } catch (err) {
    error.value = err.message
  }
}

async function createTicket() {
  if (!newTicketSubject.value || !newTicketDescription.value) {
    return error.value = 'Subject and description required'
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const res = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        subject: newTicketSubject.value,
        description: newTicketDescription.value,
        category: newTicketCategory.value
      })
    })
    
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create ticket')
    
    success.value = 'Ticket created!'
    newTicketSubject.value = ''
    newTicketDescription.value = ''
    newTicketCategory.value = 'general'
    showCreateForm.value = false
    await loadTickets()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function getStatusColor(status) {
  const colors = {
    open: '#00ff88',
    assigned: '#00ffcc',
    resolved: '#51cf66',
    closed: '#9bb0bd'
  }
  return colors[status] || '#9bb0bd'
}

onMounted(loadTickets)

// Watch searchUser for filtering
import { watch } from 'vue'
watch(searchUser, filterTickets)
</script>

<template>
  <div class="container">
    <div style="margin-bottom:18px">
      <a href="/" style="color:#00ff88;text-decoration:none">← Back to Forum</a>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <h1 style="margin:0;color:#00ff88">Support Tickets</h1>
      <button class="create-btn" @click="showCreateForm = !showCreateForm" style="padding:10px 16px">
        {{ showCreateForm ? 'Cancel' : 'Create Ticket' }}
      </button>
    </div>

    <div v-if="error" style="color:#ff6b6b;margin-bottom:12px;background:rgba(255,107,107,0.1);padding:12px;border-radius:6px">{{ error }}</div>
    <div v-if="success" style="color:#51cf66;margin-bottom:12px;background:rgba(81,207,102,0.1);padding:12px;border-radius:6px">{{ success }}</div>

    <!-- Create Ticket Form -->
    <div v-if="showCreateForm" style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:20px;margin-bottom:24px">
      <h3 style="margin-top:0;color:#00ff88">New Ticket</h3>
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:4px;color:#d9eef5">Subject</label>
        <input class="input" v-model="newTicketSubject" placeholder="Brief description of your issue" />
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:4px;color:#d9eef5">Category</label>
        <select class="input" v-model="newTicketCategory" style="display:block;width:100%">
          <option value="general">General Support</option>
          <option value="account">Account Issue</option>
          <option value="payment">Payment</option>
          <option value="bug">Bug Report</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:4px;color:#d9eef5">Description</label>
        <textarea class="input" v-model="newTicketDescription" placeholder="Detailed description..." style="min-height:120px;resize:vertical"></textarea>
      </div>
      <button class="create-btn" @click="createTicket" :disabled="loading" style="width:100%">
        {{ loading ? 'Creating...' : 'Submit Ticket' }}
      </button>
    </div>

    <!-- Staff: Search by username -->
    <div v-if="staffCanViewAll" style="margin-bottom:18px">
      <input class="input" v-model="searchUser" placeholder="Search by username..." style="width:300px" />
    </div>

    <!-- Tickets List -->
    <div style="background:var(--card);border:1px solid rgba(0,255,136,0.1);border-radius:8px;padding:20px">
      <h3 style="margin-top:0;color:#00ff88">Tickets ({{ filteredTickets.length }})</h3>

      <div v-if="!filteredTickets.length" style="text-align:center;color:#9bb0bd;padding:40px">
        No tickets found
      </div>

      <div v-for="ticket in filteredTickets" :key="ticket.id" style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.1);border-radius:6px;padding:16px;margin-bottom:12px;border-left:4px solid #00ff88;cursor:pointer" @click="selectTicket(ticket)">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <div style="color:#00ffcc;font-weight:600;margin-bottom:4px">#{{ ticket.id.substring(0, 8).toUpperCase() }}</div>
            <div style="color:#00ff88;font-weight:600;font-size:16px">{{ ticket.subject }}</div>
            <div v-if="ticket.username || ticket.createdByUsername" style="color:#9bb0bd;font-size:12px">User: <span style="color:#00ff88">{{ ticket.username || ticket.createdByUsername }}</span></div>
          </div>
          <div style="text-align:right">
            <div :style="{ color: getStatusColor(ticket.status), fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }">{{ ticket.status }}</div>
            <div style="color:#9bb0bd;font-size:12px;margin-top:4px">{{ new Date(ticket.createdAt).toLocaleDateString() }}</div>
          </div>
        </div>
        <div style="color:#9bb0bd;font-size:13px;margin-bottom:8px">{{ ticket.description }}</div>
        <div style="color:#9bb0bd;font-size:11px">Category: <span style="color:#00ff88">{{ ticket.category }}</span></div>
      </div>
    </div>

    <!-- Ticket Details Modal (for staff) -->
    <div v-if="selectedTicket" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center">
      <div style="background:var(--card);padding:32px;border-radius:12px;min-width:400px;max-width:90vw;max-height:90vh;overflow:auto;position:relative">
        <button @click="selectedTicket = null" style="position:absolute;top:12px;right:12px;background:transparent;border:none;color:#00ff88;font-size:22px;cursor:pointer">&times;</button>
        <h2 style="color:#00ff88;margin-top:0">Ticket #{{ selectedTicket.id.substring(0,8).toUpperCase() }}</h2>
        <div style="color:#00ffcc;font-weight:600;font-size:18px">{{ selectedTicket.subject }}</div>
        <div style="color:#9bb0bd;font-size:13px;margin-bottom:8px">{{ selectedTicket.description }}</div>
        <div style="color:#9bb0bd;font-size:12px">Category: <span style="color:#00ff88">{{ selectedTicket.category }}</span></div>
        <div style="color:#9bb0bd;font-size:12px">Status: <span :style="{color:getStatusColor(selectedTicket.status)}">{{ selectedTicket.status }}</span></div>
        <div v-if="selectedTicket.responses && selectedTicket.responses.length" style="margin-top:18px">
          <h4 style="color:#00ffcc">Responses</h4>
          <div v-for="resp in selectedTicket.responses" :key="resp.id" style="background:rgba(0,255,136,0.05);padding:10px;border-radius:6px;margin-bottom:8px">
            <div style="color:#00ff88;font-weight:600">{{ resp.staff ? 'Staff' : 'User' }}:</div>
            <div style="color:#d9eef5">{{ resp.message }}</div>
            <div style="color:#9bb0bd;font-size:11px">{{ new Date(resp.createdAt).toLocaleString() }}</div>
          </div>
        </div>
        <div v-if="staffCanViewAll && selectedTicket.status !== 'closed'" style="margin-top:18px">
          <textarea class="input" v-model="selectedTicket.staffResponse" placeholder="Type your response..." style="width:100%;min-height:80px"></textarea>
          <button class="create-btn" style="margin-top:8px;width:100%" @click="respondToTicket(selectedTicket, selectedTicket.staffResponse)">Send Response</button>
          <button class="create-btn" style="margin-top:8px;width:100%;background:#dc3545" @click="closeTicket(selectedTicket)">Close Ticket</button>
        </div>
      </div>
    </div>
  </div>
</template>
