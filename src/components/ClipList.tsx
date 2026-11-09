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
    <div className="flex flex-col gap-1 p-2">
      {clips.map((clip) => (
        <ClipItem key={clip.id} clip={clip} />
      ))}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mx-auto my-2 rounded-md px-4 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
        >
          {loading ? "加载中…" : "加载更多"}
        </button>
      )}
      {loading && clips.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-500">加载中…</p>
      )}
    </div>
  );
}
