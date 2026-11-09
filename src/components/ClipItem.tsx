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
      className={`group relative flex cursor-pointer gap-3 rounded-xl border bg-cloud p-3 shadow-[0_1px_3px_var(--color-shadow)] transition-all hover:border-bamboo-glow hover:shadow-[0_2px_8px_var(--color-shadow-deep)] ${
        clip.pinned
          ? "border-bamboo-glow border-l-2 border-l-bamboo"
          : "border-paper-deep"
      }`}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper-warm text-base">
        {TYPE_ICONS[clip.contentType]}
      </div>

      <div className="min-w-0 flex-1">
        {clip.contentType === "image" ? (
          imgSrc ? (
            <img
              src={imgSrc}
              alt="剪贴板图片"
              className="max-h-40 rounded-lg border border-paper-deep"
            />
          ) : (
            <div className="h-20 w-full animate-pulse rounded-lg bg-paper-warm" />
          )
        ) : (
          <p className="line-clamp-2 whitespace-pre-wrap break-all text-sm leading-relaxed text-ink-soft">
            {isFile
              ? `📄 ${filePaths[0]}${filePaths.length > 1 ? ` 等 ${filePaths.length} 个文件` : ""}`
              : preview}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
          <span>{TYPE_LABELS[clip.contentType]}</span>
          <select
            value={clip.category}
            onChange={(e) => changeCategory(clip.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="cursor-pointer rounded bg-transparent text-ink-faint outline-none transition-colors hover:bg-paper-warm hover:text-ink-soft focus:bg-paper-warm [&>option]:bg-cloud [&>option]:text-ink"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span>{formatRelative(clip.createdAt)}</span>
          {clip.isSensitive && (
            <span className="rounded-full bg-cinnabar-bg px-1.5 py-0.5 font-medium text-cinnabar">
              敏感
            </span>
          )}
          {clip.isSynced && (
            <span className="rounded-full bg-bamboo-mist px-1.5 py-0.5 text-bamboo">
              已同步
            </span>
          )}
          {clip.pinned && (
            <span className="rounded-full bg-bamboo-mist px-1.5 py-0.5 text-bamboo">
              📌 已置顶
            </span>
          )}
        </div>
      </div>

      <div className="absolute right-2.5 top-2.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          title="复制回剪贴板（双击条目亦可）"
          onClick={onCopy}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            copied
              ? "bg-bamboo text-cloud"
              : "bg-paper-warm text-ink-soft hover:bg-bamboo hover:text-cloud"
          }`}
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
        <button
          title={clip.pinned ? "取消置顶" : "置顶"}
          onClick={() => void togglePin(clip.id)}
          className="rounded-md bg-paper-warm px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-stone hover:text-cloud"
        >
          {clip.pinned ? "取消置顶" : "置顶"}
        </button>
        <button
          title="删除"
          onClick={() => void deleteClip(clip.id)}
          className="rounded-md bg-paper-warm px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-cinnabar hover:text-cloud"
        >
          删除
        </button>
      </div>
    </div>
  );
}
