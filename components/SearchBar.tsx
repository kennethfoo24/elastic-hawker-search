"use client";

import { SearchGlassIcon } from "./Icons";

export function SearchBar({
  value,
  onChange,
  onSearch,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
}) {
  return (
    <form
      className="flex items-center gap-2 rounded-full border border-border bg-surface p-1.5 pl-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_32px_-20px_rgba(15,23,42,0.18)] transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary-tint"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search hawker dishes — any language…"
        aria-label="Search query"
        className="w-full bg-transparent text-lg text-ink placeholder:text-muted/70 focus:outline-none"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        aria-label={loading ? "Searching" : "Search"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40 disabled:hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <SearchGlassIcon className="h-5 w-5" />
        )}
      </button>
    </form>
  );
}
