export class SyncApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'SyncApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new SyncApiError('无法连接收藏同步服务')
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // A proxy error can return HTML instead of the API JSON response.
  }

  if (!response.ok) {
    throw new SyncApiError(payload?.error || `同步请求失败（${response.status}）`, response.status)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SyncApiError('同步服务器响应格式无效', response.status)
  }
  return payload
}

function validateSession(payload) {
  if (
    typeof payload.authenticated !== 'boolean' ||
    (payload.authenticated && typeof payload.username !== 'string')
  ) {
    throw new SyncApiError('同步服务器响应格式无效')
  }
  return payload
}

function validateCollection(payload) {
  if (
    !Array.isArray(payload.keys) ||
    typeof payload.initialized !== 'boolean' ||
    (payload.updatedAt !== null && typeof payload.updatedAt !== 'number') ||
    !Number.isInteger(payload.version) ||
    payload.version < 0
  ) {
    throw new SyncApiError('同步服务器响应格式无效')
  }
  return payload
}

function validateSlotUpdate(payload) {
  if (
    typeof payload.key !== 'string' ||
    typeof payload.collected !== 'boolean' ||
    typeof payload.updatedAt !== 'number' ||
    !Number.isInteger(payload.version) ||
    payload.version < 1
  ) {
    throw new SyncApiError('同步服务器响应格式无效')
  }
  return payload
}

export const syncApi = {
  async session(signal) {
    return validateSession(await request('/api/session', { signal }))
  },
  async login(username, password) {
    return validateSession(
      await request('/api/login', { method: 'POST', body: { username, password } }),
    )
  },
  logout() {
    return request('/api/logout', { method: 'POST' })
  },
  async collection(signal) {
    return validateCollection(await request('/api/collection', { signal }))
  },
  async initializeCollection(keys) {
    return validateCollection(
      await request('/api/collection', { method: 'PUT', body: { keys } }),
    )
  },
  async updateSlot(key, collected) {
    return validateSlotUpdate(
      await request('/api/collection', { method: 'PATCH', body: { key, collected } }),
    )
  },
}
