const inferredHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const inferredProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
export const API_BASE = import.meta.env.VITE_API_BASE || `${inferredProtocol}//${inferredHost}:3000`
