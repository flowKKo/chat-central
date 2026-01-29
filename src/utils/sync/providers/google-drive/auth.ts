// ============================================================================
// Chrome Identity API Types
// ============================================================================

/**
 * Chrome identity API type declaration
 * Used for Google OAuth authentication in Chrome extensions
 */
export interface ChromeIdentityAPI {
  getAuthToken: (options: { interactive: boolean }, callback: (token?: string) => void) => void
  removeCachedAuthToken: (options: { token: string }, callback: () => void) => void
}

export interface ChromeRuntimeAPI {
  lastError?: { message: string }
}

export interface ChromeAPI {
  identity?: ChromeIdentityAPI
  runtime?: ChromeRuntimeAPI
}

declare const chrome: ChromeAPI | undefined

// ============================================================================
// Auth Functions
// ============================================================================

/**
 * Get an OAuth token via chrome.identity API
 */
export async function getAuthToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use chrome.identity API for OAuth
    if (!chrome?.identity?.getAuthToken) {
      reject(new Error('Chrome identity API not available'))
      return
    }

    chrome.identity.getAuthToken({ interactive }, (token?: string) => {
      if (chrome?.runtime?.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (!token) {
        reject(new Error('No token received'))
        return
      }

      resolve(token)
    })
  })
}

/**
 * Revoke an OAuth token
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
    method: 'POST',
  })
}

/**
 * Validate an OAuth token against Google's tokeninfo endpoint
 */
export async function validateToken(token: string): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
  )

  if (!response.ok) {
    throw new Error('Token validation failed')
  }
}

/**
 * Remove a cached auth token from Chrome's identity cache
 */
export async function removeCachedAuthToken(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!chrome?.identity?.removeCachedAuthToken) {
      resolve()
      return
    }

    chrome.identity.removeCachedAuthToken({ token }, () => {
      if (chrome?.runtime?.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })
}
