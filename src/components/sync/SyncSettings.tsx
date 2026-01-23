import { useAtom } from 'jotai'
import { AlertCircle, CheckCircle, Cloud, Loader2, Save, TestTube, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type SyncSettings,
  syncSettingsAtom,
  syncSettingsOpenAtom,
  updateSyncSettingsAtom,
} from '@/utils/atoms/sync'
import { cn } from '@/utils/cn'

export function SyncSettingsModal() {
  const [isOpen, setIsOpen] = useAtom(syncSettingsOpenAtom)
  const [settings] = useAtom(syncSettingsAtom)
  const [, updateSettings] = useAtom(updateSyncSettingsAtom)

  const [formData, setFormData] = useState<SyncSettings>(settings)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData(settings)
      setTestStatus('idle')
      setTestError(null)
    }
  }, [isOpen, settings])

  if (!isOpen) return null

  const handleChange = <K extends keyof SyncSettings>(key: K, value: SyncSettings[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleTest = async () => {
    if (!formData.endpoint) {
      setTestError('Endpoint is required')
      setTestStatus('error')
      return
    }

    setTestStatus('testing')
    setTestError(null)

    try {
      const response = await fetch(`${formData.endpoint}/health`, {
        method: 'GET',
        headers: formData.apiKey ? { Authorization: `Bearer ${formData.apiKey}` } : undefined,
      })

      if (response.ok) {
        setTestStatus('success')
      } else {
        setTestError(`Server returned ${response.status}`)
        setTestStatus('error')
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Connection failed')
      setTestStatus('error')
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateSettings(formData)
      setIsOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-md rounded-lg border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Cloud Sync Settings</h2>
          </div>
          <button
            type="button"
            className="rounded-md p-1 transition-colors hover:bg-muted"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Enable Cloud Sync</label>
              <p className="text-sm text-muted-foreground">Sync conversations across devices</p>
            </div>
            <button
              type="button"
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                formData.enabled ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => handleChange('enabled', !formData.enabled)}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                  formData.enabled && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {formData.enabled && (
            <>
              {/* Endpoint */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Server Endpoint</label>
                <input
                  type="url"
                  className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://sync.example.com"
                  value={formData.endpoint}
                  onChange={(e) => handleChange('endpoint', e.target.value)}
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">API Key (Optional)</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Your API key"
                  value={formData.apiKey}
                  onChange={(e) => handleChange('apiKey', e.target.value)}
                />
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                  onClick={handleTest}
                  disabled={testStatus === 'testing' || !formData.endpoint}
                >
                  {testStatus === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Test Connection
                </button>
                {testStatus === 'success' && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Connected
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {testError}
                  </span>
                )}
              </div>

              <hr className="border-border" />

              {/* Auto Sync */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Auto Sync</label>
                  <p className="text-sm text-muted-foreground">Automatically sync in background</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    formData.autoSync ? 'bg-primary' : 'bg-muted'
                  )}
                  onClick={() => handleChange('autoSync', !formData.autoSync)}
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      formData.autoSync && 'translate-x-5'
                    )}
                  />
                </button>
              </div>

              {formData.autoSync && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sync Interval</label>
                  <select
                    className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.autoSyncInterval}
                    onChange={(e) => handleChange('autoSyncInterval', Number(e.target.value))}
                  >
                    <option value={1}>Every 1 minute</option>
                    <option value={5}>Every 5 minutes</option>
                    <option value={15}>Every 15 minutes</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every hour</option>
                  </select>
                </div>
              )}

              {/* Auto Resolve Conflicts */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Auto-resolve Conflicts</label>
                  <p className="text-sm text-muted-foreground">
                    Automatically merge conflicting changes
                  </p>
                </div>
                <button
                  type="button"
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    formData.autoResolveConflicts ? 'bg-primary' : 'bg-muted'
                  )}
                  onClick={() =>
                    handleChange('autoResolveConflicts', !formData.autoResolveConflicts)
                  }
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      formData.autoResolveConflicts && 'translate-x-5'
                    )}
                  />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
