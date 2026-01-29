import { Search, X } from 'lucide-react'

interface SearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function SearchBar({ searchQuery, onSearchChange }: SearchBarProps) {
  return (
    <div className="relative">
      <label htmlFor="manage-search" className="sr-only">
        Search conversations
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id="manage-search"
        type="text"
        placeholder="Search conversations..."
        className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-8 text-sm transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {searchQuery && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 transition-colors hover:bg-muted"
          onClick={() => onSearchChange('')}
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
