import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Image as ImageIcon, Pin, Trash2 } from "lucide-react";
import { invoke } from "../utils/tauri";
import { formatRelative } from "../utils/time";
import { useClips } from "../stores/clips";
import { TYPE_LABELS, TYPE_STAMPS, type ClipRow } from "../types";

const CATEGORY_OPTIONS = ["文本", "图片", "代码", "链接", "文件", "未分类", "重要"];

/** 命中片段用竹青高亮（大小写不敏感定位，保留原文大小写） */
function withHighlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return text;
  const nodes: ReactNode[] = [];
  let from = 0;
  let idx = hay.indexOf(needle);
  let key = 0;
  while (idx !== -1) {
    if (idx > from) nodes.push(text.slice(from, idx));
    nodes.push(
      <mark
        key={key++}
        className="rounded-[2px] bg-bamboo-mist px-0.5 text-bamboo"
      >
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    from = idx + needle.length;
    idx = hay.indexOf(needle, from);
  }
  if (from < text.length) nodes.push(text.slice(from));
  return nodes;
}

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

/** 卷条条目：直角笺纸 + 类型印章戳 + 悬停图钮（梅影风格） */
export function ClipItem({ clip }: { clip: ClipRow }) {
  const copyClip = useClips((s) => s.copyClip);
  const deleteClip = useClips((s) => s.deleteClip);
  const togglePin = useClips((s) => s.togglePin);
  const changeCategory = useClips((s) => s.changeCategory);
  const query = useClips((s) => s.query);
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
  const isCode = clip.contentType === "code";

  const onCopy = () => {
    void copyClip(clip.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const stamp = clip.isSensitive
    ? "密"
    : TYPE_STAMPS[clip.contentType];

  const bodyText = isFile
    ? `${filePaths[0]}${filePaths.length > 1 ? ` 等 ${filePaths.length} 个文件` : ""}`
    : preview;

  const actBtn =
    "flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-faint transition-colors hover:bg-bamboo-mist hover:text-bamboo";

  return (
    <div
      ref={ref}
      onDoubleClick={onCopy}
      title="双击复制"
      className={`group relative cursor-pointer rounded-[3px] border bg-cloud py-2 pl-[15px] pr-3 transition-colors hover:border-bamboo/50 ${
        clip.pinned
          ? "border-l-[3px] border-l-bamboo border-y-paper-deep border-r-paper-deep"
          : "border-paper-deep"
      }`}
    >
      <div className="min-w-0">
        {clip.contentType === "image" ? (
          imgSrc ? (
            <img
              src={imgSrc}
              alt="剪贴板图片"
              className="mt-1 max-h-40 max-w-full rounded-[3px] border border-dashed border-paper-deep"
            />
          ) : (
            <div className="mt-1 flex h-14 w-full items-center justify-center animate-pulse rounded-[3px] border border-dashed border-paper-deep text-ink-faint">
              <ImageIcon size={16} />
            </div>
          )
        ) : (
          <p
            className={`line-clamp-2 whitespace-pre-wrap break-all pr-7 text-[13px] leading-relaxed ${
              isCode ? "font-mono text-xs" : ""
            } text-ink-soft`}
          >
            {withHighlight(bodyText, query)}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pr-16 text-[11px] text-ink-faint">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px] leading-none ${
              clip.isSensitive
                ? "border-cinnabar text-cinnabar"
                : "border-paper-deep text-ink-soft"
            }`}
            title={TYPE_LABELS[clip.contentType]}
          >
            {stamp}
          </span>
          <select
            value={clip.category}
            onChange={(e) => changeCategory(clip.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="cursor-pointer appearance-none rounded bg-transparent text-[11px] text-ink-faint outline-none transition-colors hover:bg-paper-warm hover:text-ink-soft focus:bg-paper-warm [&>option]:bg-cloud [&>option]:text-ink"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span>{formatRelative(clip.createdAt)}</span>
          {clip.isSensitive && (
            <span className="rounded-[2px] bg-cinnabar-bg px-1.5 py-px text-[10px] text-cinnabar">
              敏感
            </span>
          )}
          {clip.isSynced && (
            <span className="text-[10px] text-bamboo">已同步</span>
          )}
          {clip.pinned && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-bamboo">
              <Pin size={9} /> 已置顶
            </span>
          )}
        </div>
      </div>

      {/* 悬停操作：复制 / 置顶 / 删除 */}
      <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="复制回剪贴板（双击条目亦可）"
          aria-label="复制"
          onClick={onCopy}
          className={`${actBtn} ${copied ? "text-bamboo" : ""}`}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        <button
          type="button"
          title={clip.pinned ? "取消置顶" : "置顶"}
          aria-label={clip.pinned ? "取消置顶" : "置顶"}
          onClick={() => void togglePin(clip.id)}
          className={actBtn}
        >
          <Pin size={13} />
        </button>
        <button
          type="button"
          title="删除"
          aria-label="删除"
          onClick={() => void deleteClip(clip.id)}
          className={`${actBtn} hover:bg-cinnabar-bg hover:text-cinnabar`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
