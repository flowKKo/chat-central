export function AboutPanel() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-8">About</h2>

      <div className="max-w-2xl">
        <div className="text-center py-12">
          <h3 className="text-3xl font-bold mb-4">Chat Central</h3>
          <p className="text-lg text-muted-foreground mb-8">
            Unified AI conversation manager for Claude, ChatGPT, and Gemini
          </p>

          <div className="grid grid-cols-3 gap-6 mb-12">
            <div className="p-6 border border-border rounded-lg">
              <div className="text-3xl mb-2">Auto Sync</div>
              <h4 className="font-semibold mb-1">Auto Sync</h4>
              <p className="text-sm text-muted-foreground">
                Automatically track conversations as you chat
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg">
              <div className="text-3xl mb-2">Smart Search</div>
              <h4 className="font-semibold mb-1">Smart Search</h4>
              <p className="text-sm text-muted-foreground">
                Find any conversation across all platforms
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg">
              <div className="text-3xl mb-2">Local Storage</div>
              <h4 className="font-semibold mb-1">Local Storage</h4>
              <p className="text-sm text-muted-foreground">Your data stays on your device</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">Version 0.1.0</p>
        </div>
      </div>
    </div>
  )
}
