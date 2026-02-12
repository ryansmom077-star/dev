import DOMPurify from 'dompurify'

// SECURITY: XSS Protection - sanitize user-generated content
export function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title', 'class'],
    KEEP_CONTENT: true
  })
}

// Escape plain text to prevent XSS
export function escapeHTML(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Store and retrieve CSRF token
export function setCSRFToken(token) {
  localStorage.setItem('_csrf_token', token)
}

export function getCSRFToken() {
  return localStorage.getItem('_csrf_token')
}

// Add CSRF token to fetch headers
export function addCSRFHeader(headers = {}) {
  const token = getCSRFToken()
  if (token) {
    headers['X-CSRF-Token'] = token
  }
  return headers
}
