import {
  Database,
  Github,
  Heart,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_VERSION } from '@/utils/constants'

export function AboutPanel() {
  const { t } = useTranslation('about')

  const features = [
    {
      icon: RefreshCw,
      title: t('featureAutoSync'),
      description: t('featureAutoSyncDesc'),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Search,
      title: t('featureSearch'),
      description: t('featureSearchDesc'),
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: Database,
      title: t('featureStorage'),
      description: t('featureStorageDesc'),
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: Star,
      title: t('featureFavorites'),
      description: t('featureFavoritesDesc'),
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: Shield,
      title: t('featurePrivacy'),
      description: t('featurePrivacyDesc'),
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      icon: Zap,
      title: t('featurePerformance'),
      description: t('featurePerformanceDesc'),
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ]
  return (
    <div className="h-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex gap-8">
        {/* Main Content - Left */}
        <div className="min-w-0 flex-1">
          {/* Hero Section */}
          <div className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-blue-500/5 to-transparent p-8">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400 shadow-lg">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="mb-2 font-heading text-3xl font-bold tracking-tight">
                  {t('common:appName')}
                </h2>
                <p className="max-w-lg text-muted-foreground">{t('heroDescription')}</p>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card/50 p-5 transition-all hover:bg-muted/30"
              >
                <div
                  className={`h-10 w-10 rounded-lg ${feature.bgColor} mb-3 flex items-center justify-center transition-transform group-hover:scale-110`}
                >
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <h4 className="mb-1 font-heading font-semibold">{feature.title}</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/30 p-4">
            <p className="text-sm text-muted-foreground">
              {t('common:version')}{' '}
              <span className="font-medium text-foreground">{APP_VERSION}</span>
            </p>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com/flowKKo/chat-central"
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-4 w-4" />
                {t('common:github')}
              </a>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {t('common:madeWith')} <Heart className="h-3.5 w-3.5 fill-red-400 text-red-400" />
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar - Right */}
        <div className="hidden w-72 flex-shrink-0 xl:block">
          <div className="sticky top-6 space-y-4">
            {/* Supported Platforms */}
            <div className="rounded-2xl border border-border bg-card/50 p-5">
              <h3 className="mb-4 font-heading font-semibold">{t('supportedPlatforms')}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-claude-light">
                    <span className="h-3 w-3 rounded-full bg-claude" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-claude">Claude</span>
                    <p className="text-xs text-muted-foreground">claude.ai</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chatgpt-light">
                    <span className="h-3 w-3 rounded-full bg-chatgpt" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-chatgpt">ChatGPT</span>
                    <p className="text-xs text-muted-foreground">chatgpt.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gemini-light">
                    <span className="h-3 w-3 rounded-full bg-gemini" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gemini">Gemini</span>
                    <p className="text-xs text-muted-foreground">gemini.google.com</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="rounded-2xl border border-border bg-card/50 p-5">
              <h3 className="mb-4 font-heading font-semibold">{t('quickLinks')}</h3>
              <div className="space-y-2">
                <a
                  href="https://github.com/flowKKo/chat-central"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex cursor-pointer items-center gap-2 rounded-lg p-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                  {t('sourceCode')}
                </a>
                <a
                  href="https://github.com/flowKKo/chat-central/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex cursor-pointer items-center gap-2 rounded-lg p-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <Star className="h-4 w-4" />
                  {t('reportIssue')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
