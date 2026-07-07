"use client";

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
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search 130 hawker dishes — any language, any phrasing…"
        aria-label="Search query"
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-lg text-ink placeholder:text-muted/70 focus:outline-2 focus:outline-rrf/70"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="shrink-0 rounded-xl bg-rrf px-6 py-3 text-lg font-semibold text-kopi transition-colors hover:bg-rrf/85 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink"
      >
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
