import { render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloudSyncPanel } from './CloudSyncPanel'
import {
  autoSyncEnabledAtom,
  autoSyncIntervalAtom,
  cloudSyncErrorAtom,
  cloudSyncStatusAtom,
  isCloudConnectedAtom,
  lastCloudSyncAtom,
  lastSyncResultAtom,
} from '@/utils/atoms/cloud-sync'

// Mock wxt/browser (required by cloud-sync atoms)
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock cloud-sync module (required by action atoms)
vi.mock('@/utils/sync/cloud-sync', () => ({
  connectCloudProvider: vi.fn().mockResolvedValue(undefined),
  disconnectCloudProvider: vi.fn().mockResolvedValue(undefined),
  loadCloudSyncState: vi.fn().mockResolvedValue({
    provider: null,
    isConnected: false,
    lastSyncAt: null,
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 5,
    error: null,
  }),
  syncToCloud: vi.fn().mockResolvedValue({ success: true, stats: {} }),
}))

function renderWithStore(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <CloudSyncPanel />
    </Provider>
  )
}

describe('cloudSyncPanel', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    // Set default disconnected state
    store.set(isCloudConnectedAtom, false)
    store.set(cloudSyncStatusAtom, 'idle')
    store.set(lastCloudSyncAtom, null)
    store.set(cloudSyncErrorAtom, null)
    store.set(lastSyncResultAtom, null)
    store.set(autoSyncEnabledAtom, false)
    store.set(autoSyncIntervalAtom, 5)
  })

  describe('disconnected state', () => {
    it('should render not connected status', () => {
      renderWithStore(store)
      expect(screen.getByText('Not connected')).toBeInTheDocument()
      expect(screen.getByText('Connect with Google')).toBeInTheDocument()
    })

    it('should render Cloud Sync heading', () => {
      renderWithStore(store)
      expect(screen.getByText('Cloud Sync')).toBeInTheDocument()
      expect(screen.getByText('Sync your conversations across devices')).toBeInTheDocument()
    })

    it('should show privacy note', () => {
      renderWithStore(store)
      expect(
        screen.getByText(/Your data is stored in your own Google Drive app folder/)
      ).toBeInTheDocument()
    })

    it('should toggle advanced options', () => {
      renderWithStore(store)

      expect(screen.queryByText('WebDAV (Coming Soon)')).not.toBeInTheDocument()

      fireEvent.click(screen.getByText('Advanced options'))
      expect(screen.getByText('WebDAV (Coming Soon)')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Advanced options'))
      expect(screen.queryByText('WebDAV (Coming Soon)')).not.toBeInTheDocument()
    })

    it('should not show connected-state elements', () => {
      renderWithStore(store)
      expect(screen.queryByText('Connected to Google Drive')).not.toBeInTheDocument()
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument()
      expect(screen.queryByText('Disconnect')).not.toBeInTheDocument()
    })
  })

  describe('connected state', () => {
    beforeEach(() => {
      store.set(isCloudConnectedAtom, true)
    })

    it('should render connected status', () => {
      renderWithStore(store)
      expect(screen.getByText('Connected to Google Drive')).toBeInTheDocument()
    })

    it('should show Sync Now and Disconnect buttons', () => {
      renderWithStore(store)
      expect(screen.getByText('Sync Now')).toBeInTheDocument()
      expect(screen.getByText('Disconnect')).toBeInTheDocument()
    })

    it('should show auto-sync toggle', () => {
      renderWithStore(store)
      expect(screen.getByText('Auto-sync')).toBeInTheDocument()
      expect(screen.getByText(/Automatically sync every/)).toBeInTheDocument()
    })

    it('should show last sync time when available', () => {
      // Set lastCloudSyncAtom to 2 minutes ago
      store.set(lastCloudSyncAtom, Date.now() - 2 * 60 * 1000)
      renderWithStore(store)
      expect(screen.getByText(/Last synced:/)).toBeInTheDocument()
      expect(screen.getByText(/2 minutes ago/)).toBeInTheDocument()
    })

    it('should show sync error when present', () => {
      store.set(cloudSyncErrorAtom, 'Upload failed')
      renderWithStore(store)
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })

    it('should show reconnect button for auth errors', () => {
      store.set(cloudSyncErrorAtom, 'Auth failed')
      store.set(lastSyncResultAtom, {
        success: false,
        direction: 'upload',
        errorCategory: 'auth',
        error: 'Auth failed',
        stats: {
          conversationsUploaded: 0,
          conversationsDownloaded: 0,
          messagesUploaded: 0,
          messagesDownloaded: 0,
        },
      })
      renderWithStore(store)
      expect(screen.getByText('Reconnect account')).toBeInTheDocument()
    })

    it('should show sync success with stats', () => {
      store.set(cloudSyncStatusAtom, 'success')
      store.set(lastSyncResultAtom, {
        success: true,
        direction: 'merge',
        stats: {
          conversationsUploaded: 5,
          conversationsDownloaded: 3,
          messagesUploaded: 0,
          messagesDownloaded: 0,
        },
      })
      renderWithStore(store)
      expect(screen.getByText('Sync completed')).toBeInTheDocument()
      expect(screen.getByText(/Uploaded 5 conversations/)).toBeInTheDocument()
      expect(screen.getByText(/Downloaded 3 conversations/)).toBeInTheDocument()
    })

    it('should show syncing state', () => {
      store.set(cloudSyncStatusAtom, 'syncing')
      renderWithStore(store)
      expect(screen.getByText('Syncing...')).toBeInTheDocument()
    })

    it('should disable sync button when syncing', () => {
      store.set(cloudSyncStatusAtom, 'syncing')
      renderWithStore(store)
      const syncButton = screen.getByText('Syncing...').closest('button')
      expect(syncButton).toBeDisabled()
    })

    it('should show auto-sync interval for singular minute', () => {
      store.set(autoSyncIntervalAtom, 1)
      renderWithStore(store)
      expect(screen.getByText(/Automatically sync every 1 minute$/)).toBeInTheDocument()
    })

    it('should pluralize minutes correctly', () => {
      store.set(autoSyncIntervalAtom, 10)
      renderWithStore(store)
      expect(screen.getByText(/Automatically sync every 10 minutes/)).toBeInTheDocument()
    })

    it('should not show connect button when connected', () => {
      renderWithStore(store)
      expect(screen.queryByText('Connect with Google')).not.toBeInTheDocument()
    })
  })

  describe('offline state', () => {
    it('should show offline warning when navigator is offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      renderWithStore(store)
      expect(
        screen.getByText(/You're offline\. Sync will resume when connected\./)
      ).toBeInTheDocument()
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    })
  })
})
