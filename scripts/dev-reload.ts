/**
 * Manual Dev Reload Server
 *
 * This script provides a manual build + auto-reload workflow:
 * 1. Starts a WebSocket server that the extension connects to
 * 2. Waits for user commands
 * 3. On command, builds the extension and sends reload signal
 *
 * Usage:
 *   pnpm dev:reload
 *
 * Commands:
 *   r, reload, Enter  - Build and reload extension
 *   b, build          - Build only (no reload signal)
 *   q, quit, exit     - Exit the server
 *   h, help           - Show help
 */

import { spawn } from 'node:child_process'
import * as readline from 'node:readline'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = 3717
const clients = new Set<WebSocket>()

// ANSI colors
const colors = {
  reset: '\x1B[0m',
  bright: '\x1B[1m',
  dim: '\x1B[2m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  magenta: '\x1B[35m',
  cyan: '\x1B[36m',
  red: '\x1B[31m',
}

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logInfo(message: string) {
  log(`[INFO] ${message}`, colors.cyan)
}

function logSuccess(message: string) {
  log(`[OK] ${message}`, colors.green)
}

function logError(message: string) {
  log(`[ERROR] ${message}`, colors.red)
}

function _logCommand(message: string) {
  log(`> ${message}`, colors.yellow)
}

// Start WebSocket server
const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws) => {
  clients.add(ws)
  logInfo(`Extension connected (${clients.size} client${clients.size > 1 ? 's' : ''})`)

  ws.on('close', () => {
    clients.delete(ws)
    logInfo(`Extension disconnected (${clients.size} client${clients.size > 1 ? 's' : ''})`)
  })

  ws.on('error', (err) => {
    logError(`WebSocket error: ${err.message}`)
    clients.delete(ws)
  })
})

wss.on('error', (err) => {
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    logError(`Port ${PORT} is already in use. Is another dev-reload server running?`)
    process.exit(1)
  }
  logError(`Server error: ${err.message}`)
})

// Build function
function build(): Promise<boolean> {
  return new Promise((resolve) => {
    logInfo('Building...')
    const startTime = Date.now()

    const child = spawn('pnpm', ['wxt', 'build', '-m', 'development'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let _stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      _stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)

      if (code === 0) {
        logSuccess(`Build completed in ${duration}s`)
        resolve(true)
      } else {
        logError(`Build failed (exit code: ${code})`)
        if (stderr) {
          console.log(colors.dim + stderr + colors.reset)
        }
        resolve(false)
      }
    })

    child.on('error', (err) => {
      logError(`Build error: ${err.message}`)
      resolve(false)
    })
  })
}

// Send reload signal to all connected extensions
function sendReload() {
  if (clients.size === 0) {
    logError('No extension connected! Make sure to:')
    console.log('  1. Load the extension from .output/chrome-mv3')
    console.log('  2. Check browser console for connection errors')
    return
  }

  const message = JSON.stringify({ type: 'reload', timestamp: Date.now() })
  let sent = 0

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
      sent++
    }
  })

  logSuccess(`Reload signal sent to ${sent} client${sent > 1 ? 's' : ''}`)
}

// Build and reload
async function buildAndReload() {
  const success = await build()
  if (success) {
    sendReload()
  }
}

// Show help
function showHelp() {
  console.log('')
  log('Commands:', colors.bright)
  console.log('  r, reload, Enter  - Build and reload extension')
  console.log('  b, build          - Build only (no reload)')
  console.log('  s, status         - Show connection status')
  console.log('  q, quit, exit     - Exit server')
  console.log('  h, help           - Show this help')
  console.log('')
}

// Show status
function showStatus() {
  log(`\nStatus:`, colors.bright)
  console.log(`  WebSocket server: ws://localhost:${PORT}`)
  console.log(`  Connected clients: ${clients.size}`)
  console.log('')
}

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt() {
  rl.question(`${colors.magenta}[dev-reload]${colors.reset} `, async (input) => {
    const cmd = input.trim().toLowerCase()

    switch (cmd) {
      case '':
      case 'r':
      case 'reload':
        await buildAndReload()
        break

      case 'b':
      case 'build':
        await build()
        break

      case 's':
      case 'status':
        showStatus()
        break

      case 'q':
      case 'quit':
      case 'exit':
        logInfo('Shutting down...')
        wss.close()
        rl.close()
        process.exit(0)

      case 'h':
      case 'help':
        showHelp()
        break

      default:
        logError(`Unknown command: ${cmd}`)
        console.log('  Type "h" or "help" for available commands')
    }

    prompt()
  })
}

// Main
console.log('')
log('========================================', colors.bright)
log('  Chat Central - Dev Reload Server', colors.bright)
log('========================================', colors.bright)
console.log('')
logInfo(`WebSocket server started on ws://localhost:${PORT}`)
logInfo('Waiting for extension to connect...')
console.log('')
log('Press Enter or type "r" to build and reload', colors.dim)
log('Type "h" for help', colors.dim)
console.log('')

// Initial build
build().then(() => {
  console.log('')
  prompt()
})

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('')
  logInfo('Shutting down...')
  wss.close()
  rl.close()
  process.exit(0)
})
