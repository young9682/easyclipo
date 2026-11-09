import { useEffect, useRef, useState } from "react";
import { invoke } from "../utils/tauri";
import { formatRelative } from "../utils/time";
import { useClips } from "../stores/clips";
import { TYPE_ICONS, TYPE_LABELS, type ClipRow } from "../types";

const CATEGORY_OPTIONS = ["文本", "图片", "代码", "链接", "文件", "未分类", "重要"];

/** 元素进入视口即返回 true（图片缩略懒加载用） */
function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          ob.disconnect();
        }
      },
      { rootMargin: "120px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return { ref, inView };
}

export function ClipItem({ clip }: { clip: ClipRow }) {
  const copyClip = useClips((s) => s.copyClip);
  const deleteClip = useClips((s) => s.deleteClip);
  const togglePin = useClips((s) => s.togglePin);
  const changeCategory = useClips((s) => s.changeCategory);
  const [copied, setCopied] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const { ref, inView } = useInView();

  // 图片条目进入视口后按需加载缩略
  useEffect(() => {
    if (!inView || clip.contentType !== "image" || !clip.hasImage || imgSrc) {
      return;
    }
    invoke<string | null>("get_image_base64", { id: clip.id })
      .then((src) => setImgSrc(src))
      .catch(() => setImgSrc(null));
  }, [inView, clip.contentType, clip.hasImage, clip.id, imgSrc]);

  const preview = (clip.textContent ?? "").trim();
  const filePaths = preview.split("\n").filter((l) => l.trim());
  const isFile = clip.contentType === "file";

  const onCopy = () => {
    void copyClip(clip.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div
      ref={ref}
      onDoubleClick={onCopy}
      className="group relative flex cursor-pointer gap-2.5 rounded-lg border border-transparent p-2.5 hover:border-zinc-700 hover:bg-zinc-800/60"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-base">
        {TYPE_ICONS[clip.contentType]}
      </div>

      <div className="min-w-0 flex-1">
        {clip.contentType === "image" ? (
          imgSrc ? (
            <img
              src={imgSrc}
              alt="剪贴板图片"
              className="max-h-40 rounded-md border border-zinc-700"
            />
          ) : (
            <div className="h-20 w-full animate-pulse rounded-md bg-zinc-800" />
          )
        ) : (
          <p className="line-clamp-2 whitespace-pre-wrap break-all text-sm text-zinc-200">
            {isFile
              ? `📄 ${filePaths[0]}${filePaths.length > 1 ? ` 等 ${filePaths.length} 个文件` : ""}`
              : preview}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
          <span>{TYPE_LABELS[clip.contentType]}</span>
          <select
            value={clip.category}
            onChange={(e) => changeCategory(clip.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="cursor-pointer rounded bg-transparent text-zinc-400 outline-none hover:bg-zinc-800 focus:bg-zinc-800 [&>option]:bg-zinc-800"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span>{formatRelative(clip.createdAt)}</span>
          {clip.isSensitive && (
            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-400">
              敏感
            </span>
          )}
          {clip.isSynced && (
            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-400">
              已同步
            </span>
          )}
          {clip.pinned && <span className="text-amber-400">📌 已置顶</span>}
        </div>
      </div>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          title="复制回剪贴板（双击条目亦可）"
          onClick={onCopy}
          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-sky-600 hover:text-white"
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
        <button
          title={clip.pinned ? "取消置顶" : "置顶"}
          onClick={() => void togglePin(clip.id)}
          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-amber-600 hover:text-white"
        >
          {clip.pinned ? "取消置顶" : "置顶"}
        </button>
        <button
          title="删除"
          onClick={() => void deleteClip(clip.id)}
          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-rose-600 hover:text-white"
        >
          删除
        </button>
      </div>
    </div>
  );
}
