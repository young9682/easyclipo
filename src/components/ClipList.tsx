import { useClips } from "../stores/clips";
import { ClipItem } from "./ClipItem";
import { EmptyState } from "./EmptyState";

export function ClipList() {
  const clips = useClips((s) => s.clips);
  const loading = useClips((s) => s.loading);
  const hasMore = useClips((s) => s.hasMore);
  const loadMore = useClips((s) => s.loadMore);

  if (!loading && clips.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      {clips.map((clip) => (
        <ClipItem key={clip.id} clip={clip} />
      ))}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mx-auto my-2 rounded-lg px-4 py-1.5 text-xs text-ink-faint transition-colors hover:bg-paper-warm hover:text-ink-soft disabled:opacity-50"
        >
          {loading ? "加载中…" : "加载更多"}
        </button>
      )}
      {loading && clips.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-faint">加载中…</p>
      )}
    </div>
  );
}
