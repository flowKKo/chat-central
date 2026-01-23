# Contributing to Chat Central

Thanks for your interest in contributing! This guide covers development setup, project architecture, and contribution guidelines.

## Prerequisites

- Node.js 18+
- pnpm 9+

## Getting Started

```bash
# Clone the repository
git clone https://github.com/flowKKo/chat-central.git
cd chat-central

# Install dependencies
pnpm install
```

## Development

### Standard Development (with HMR)

```bash
# Chrome
pnpm dev

# Firefox
pnpm dev:firefox
```

This starts the WXT dev server with hot module replacement. The extension will auto-reload on code changes.

### Manual Build + Auto Reload

Use this when you need to test with existing browser sessions (e.g., logged into AI platforms):

```bash
pnpm dev:reload
```

Commands:

- `r` or `Enter` - Build and reload extension
- `b` - Build only
- `s` - Show connection status
- `q` - Quit
- `h` - Help

Load the extension from `.output/chrome-mv3` in Chrome, then press Enter to rebuild and auto-reload.

### Build

```bash
# Production build
pnpm build              # Chrome
pnpm build:firefox      # Firefox

# Create ZIP for distribution
pnpm zip
pnpm zip:firefox
pnpm zip:all
```

### Testing

```bash
pnpm test              # Run all tests
pnpm test:watch        # Interactive mode
```

### Code Quality

```bash
pnpm type-check        # TypeScript check
pnpm lint              # ESLint
pnpm lint:fix          # Auto-fix lint issues
pnpm format            # Format with Prettier
pnpm format:check      # Check formatting
pnpm validate          # Run all checks (type-check + lint + test)
```

### Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) for automated checks:

- **pre-commit**: Runs ESLint and Prettier on staged files
- **commit-msg**: Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)

#### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance
- `ci`: CI/CD changes
- `build`: Build system changes

**Examples:**

```bash
git commit -m "feat: add conversation export to markdown"
git commit -m "fix: resolve search highlight flicker"
git commit -m "docs: update API documentation"
```

## Project Structure

```
chat-central/
├── src/
│   ├── assets/                   # Static assets & styles
│   │   └── styles/globals.css    # CSS variables (theming)
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # Generic UI components
│   │   ├── shadcn/               # Shadcn UI components
│   │   ├── providers/            # Context providers (Theme)
│   │   └── sync/                 # Sync-related components
│   │
│   ├── entrypoints/              # WXT entry points
│   │   ├── background/           # Service worker
│   │   ├── interceptor.content/  # API interceptor (MAIN world)
│   │   ├── observer.content/     # Message relay
│   │   ├── popup/                # Extension popup
│   │   ├── manage/               # Full-page manager
│   │   └── options/              # Settings page
│   │
│   ├── utils/
│   │   ├── platform-adapters/    # Platform-specific parsers
│   │   ├── db/                   # IndexedDB (Dexie)
│   │   ├── atoms/                # Jotai state
│   │   └── sync/                 # Sync engine
│   │
│   ├── types/                    # TypeScript types
│   └── hooks/                    # Custom React hooks
│
├── scripts/                      # Development scripts
│   └── dev-reload.ts             # Manual reload server
│
└── .output/                      # Build output (gitignored)
```

## Architecture

### Data Flow

```
AI Platform → Interceptor → Background → IndexedDB → UI
```

1. **Interceptor** (`interceptor.content`) - Runs in page context, captures API responses
2. **Background** - Receives messages, processes with platform adapters, stores to DB
3. **Platform Adapters** - Normalize data from Claude/ChatGPT/Gemini to unified format
4. **IndexedDB** - Local storage via Dexie.js
5. **UI** - React components with Jotai state management

### Key Patterns

- **Platform Adapters**: Encapsulate platform-specific logic in `utils/platform-adapters/`
- **Jotai Atoms**: Global state in `utils/atoms/`
- **Type Safety**: Use `unknown` with narrowing, Zod for validation
- **No `any`**: Explicitly banned

## Adding a New Platform

1. Create adapter in `src/utils/platform-adapters/{platform}.ts`
2. Implement `PlatformAdapter` interface from `types.ts`
3. Register in `src/utils/platform-adapters/index.ts`
4. Add URL patterns to `wxt.config.ts` manifest
5. Add tests

## Coding Standards

### Do

- Use platform adapters for platform-specific logic
- Use Jotai atoms for shared state
- Write tests for new features
- Use TypeScript strict mode
- Keep components functional

### Don't

- Put platform checks (`if (platform === 'claude')`) in UI components
- Use `any` type
- Access DB directly in components (use atoms/hooks)
- Commit console.logs in production code
- Modify `.output/` or `.wxt/` directly

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run validation (or let pre-commit hooks handle it):
   ```bash
   pnpm validate  # Runs type-check + lint + test
   pnpm build     # Ensure it builds
   ```
5. Commit your changes (follow conventional commits format)
6. Push to your fork
7. Open a Pull Request

The pre-commit hooks will automatically run ESLint and Prettier on your staged files.

## Troubleshooting

| Issue                     | Solution                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| Build errors              | Clear `.output/` and `.wxt/`, run `pnpm install`                   |
| HMR not working           | Reload extension in `chrome://extensions` or use `pnpm dev:reload` |
| Type errors               | Run `pnpm type-check`                                              |
| Interception not working  | Check console in page context (not extension context)              |
| Theme not applying        | Verify `ThemeProvider` wraps the app                               |
| Dev reload not connecting | Ensure `pnpm dev:reload` is running on port 3717                   |

## Questions?

Open an issue on [GitHub](https://github.com/flowKKo/chat-central/issues).
