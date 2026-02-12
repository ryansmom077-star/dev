import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles.css'

function decodeJwt(token) {
	try {
		const parts = token.split('.')
		if (parts.length < 2) return null
		const payload = parts[1]
		const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
		return JSON.parse(decodeURIComponent(escape(json)))
	} catch (e) {
		return null
	}
}

// Auto sign-in when 'remember' is set and token present
const token = localStorage.getItem('token')
const remember = localStorage.getItem('remember')
if (token && remember && !localStorage.getItem('user')) {
	const payload = decodeJwt(token)
	if (payload) {
		const u = { id: payload.id, username: payload.username, role: payload.role, staffRole: payload.staffRole, roles: payload.roles || [] }
		localStorage.setItem('user', JSON.stringify(u))
	}
}

// If no token in localStorage, try to find a JWT stored as a cookie and use it
if (!localStorage.getItem('token') && typeof document !== 'undefined') {
	const cookieStr = document.cookie || ''
	const parts = cookieStr.split(';').map(s => s.trim())
	for (const p of parts) {
		const eq = p.indexOf('=')
		if (eq === -1) continue
		const name = p.slice(0, eq)
		const val = decodeURIComponent(p.slice(eq + 1))
		// heuristic: JWTs contain two dots
		if (val && typeof val === 'string' && (val.match(/\./g) || []).length === 2) {
			try {
				const payload = decodeJwt(val)
				if (payload && payload.id) {
					localStorage.setItem('token', val)
					const u = { id: payload.id, username: payload.username, role: payload.role, staffRole: payload.staffRole, roles: payload.roles || [] }
					localStorage.setItem('user', JSON.stringify(u))
					break
				}
			} catch (e) {
				// not a valid JWT, continue
			}
		}
	}
}

createApp(App).use(router).mount('#app')
