import { Sparkles, RefreshCw, Search, Database, Github, Heart, Star, Shield, Zap } from 'lucide-react'

const features = [
  {
    icon: RefreshCw,
    title: 'Auto Sync',
    description: 'Automatically track conversations as you chat with AI assistants',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Find any conversation across all platforms instantly',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Database,
    title: 'Local Storage',
    description: 'Your data stays securely on your device, never on servers',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  {
    icon: Star,
    title: 'Favorites',
    description: 'Star important conversations for quick access anytime',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'No tracking, no analytics, completely private',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  {
    icon: Zap,
    title: 'Fast & Light',
    description: 'Minimal footprint, maximum performance',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
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

      <div className="flex gap-8">
        {/* Main Content - Left */}
        <div className="flex-1 min-w-0">
          {/* Hero Section */}
          <div className="p-8 bg-gradient-to-br from-primary/10 via-blue-500/5 to-transparent border border-border rounded-2xl mb-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-lg flex-shrink-0">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-heading font-bold tracking-tight mb-2">
                  Chat Central
                </h2>
                <p className="text-muted-foreground max-w-lg">
                  Unified AI conversation manager for Claude, ChatGPT, and Gemini. Keep all your AI conversations organized in one place.
                </p>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-5 bg-card/50 border border-border rounded-xl hover:bg-muted/30 transition-all"
              >
                <div
                  className={`w-10 h-10 rounded-lg ${feature.bgColor} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}
                >
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h4 className="font-heading font-semibold mb-1">{feature.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 bg-card/30 border border-border rounded-xl">
            <p className="text-sm text-muted-foreground">
              Version <span className="font-medium text-foreground">0.1.0</span>
            </p>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com/flowKKo/chat-central"
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

        {/* Sidebar - Right */}
        <div className="hidden xl:block w-72 flex-shrink-0">
          <div className="sticky top-6 space-y-4">
            {/* Supported Platforms */}
            <div className="p-5 bg-card/50 border border-border rounded-2xl">
              <h3 className="font-heading font-semibold mb-4">Supported Platforms</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="w-10 h-10 rounded-lg bg-claude-light flex items-center justify-center">
                    <span className="w-3 h-3 rounded-full bg-claude" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-claude">Claude</span>
                    <p className="text-xs text-muted-foreground">claude.ai</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="w-10 h-10 rounded-lg bg-chatgpt-light flex items-center justify-center">
                    <span className="w-3 h-3 rounded-full bg-chatgpt" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-chatgpt">ChatGPT</span>
                    <p className="text-xs text-muted-foreground">chatgpt.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="w-10 h-10 rounded-lg bg-gemini-light flex items-center justify-center">
                    <span className="w-3 h-3 rounded-full bg-gemini" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gemini">Gemini</span>
                    <p className="text-xs text-muted-foreground">gemini.google.com</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="p-5 bg-card/50 border border-border rounded-2xl">
              <h3 className="font-heading font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                <a
                  href="https://github.com/flowKKo/chat-central"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Github className="w-4 h-4" />
                  Source Code
                </a>
                <a
                  href="https://github.com/flowKKo/chat-central/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Star className="w-4 h-4" />
                  Report Issue
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
