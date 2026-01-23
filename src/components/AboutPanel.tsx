import { Sparkles, RefreshCw, Search, Database, Github, Heart } from 'lucide-react'

const features = [
  {
    icon: RefreshCw,
    title: 'Auto Sync',
    description: 'Automatically track conversations as you chat',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Find any conversation across all platforms',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Database,
    title: 'Local Storage',
    description: 'Your data stays securely on your device',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
]

export function AboutPanel() {
  return (
    <div className="h-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold tracking-tight mb-1">About</h1>
        <p className="text-sm text-muted-foreground">
          Learn more about Chat Central
        </p>
      </div>

      <div className="max-w-3xl">
        {/* Hero Section */}
        <div className="text-center py-8 mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-400 mb-6 shadow-glow">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-heading font-bold tracking-tight mb-3">
            Chat Central
          </h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Unified AI conversation manager for Claude, ChatGPT, and Gemini
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 bg-card/50 border border-border rounded-2xl hover:bg-muted/30 transition-all cursor-default"
            >
              <div
                className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}
              >
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h4 className="font-heading font-semibold mb-1">{feature.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Supported Platforms */}
        <div className="p-6 bg-card/50 border border-border rounded-2xl mb-8">
          <h3 className="font-heading font-semibold mb-4 text-center">Supported Platforms</h3>
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-claude-light flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-claude" />
              </div>
              <span className="text-sm font-medium text-claude">Claude</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-chatgpt-light flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-chatgpt" />
              </div>
              <span className="text-sm font-medium text-chatgpt">ChatGPT</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gemini-light flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-gemini" />
              </div>
              <span className="text-sm font-medium text-gemini">Gemini</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Version <span className="font-medium text-foreground">0.1.0</span>
          </p>

          <div className="flex items-center justify-center gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <span className="text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Made with <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
