/**
 * Gemini API URL patterns
 */
export const API_PATTERNS = {
  batch: /\/_\/BardChatUi\/data\/batchexecute/,
  conversations: /\/conversations/,
}

/**
 * Base URL for Gemini app
 */
export const GEMINI_APP_URL = 'https://gemini.google.com/app/'

/**
 * ID validation patterns
 */
export const CONVERSATION_ID_RE = /^c_[a-z0-9]+$/i
export const RESPONSE_ID_RE = /^rc_[a-z0-9]+$/i
export const RESPONSE_ID_SHORT_RE = /^r_[a-z0-9]+$/i
