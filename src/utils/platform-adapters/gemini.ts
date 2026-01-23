/**
 * Gemini Platform Adapter
 *
 * Re-exports from the gemini/ module for backward compatibility.
 * The implementation has been split into smaller focused modules:
 * - gemini/constants.ts: API patterns and URL constants
 * - gemini/types.ts: Type definitions
 * - gemini/payload.ts: Payload processing utilities
 * - gemini/utils.ts: ID utilities and tree walking
 * - gemini/list.ts: Conversation list parsing
 * - gemini/detail.ts: Conversation detail parsing
 * - gemini/index.ts: Main adapter implementation
 */
export { geminiAdapter } from './gemini/index'
