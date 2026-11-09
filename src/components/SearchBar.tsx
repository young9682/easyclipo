import { useEffect, useState } from "react";
import { useClips } from "../stores/clips";
import type { ContentType } from "../types";

const TYPE_OPTIONS: Array<{ value: ContentType | null; label: string }> = [
  { value: null, label: "全部类型" },
  { value: "text", label: "文本" },
  { value: "image", label: "图片" },
  { value: "code", label: "代码" },
  { value: "link", label: "链接" },
  { value: "file", label: "文件" },
];

export function SearchBar() {
  const setQuery = useClips((s) => s.setQuery);
  const setTypeFilter = useClips((s) => s.setTypeFilter);
  const [text, setText] = useState("");

  // 300ms 防抖后应用搜索词
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(t);
  }, [text, setQuery]);

  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="搜索剪贴板内容…"
        className="min-w-0 flex-1 rounded-lg border border-paper-deep bg-cloud px-3 py-1.5 text-sm text-ink outline-none placeholder-ink-ghost transition-colors focus:border-bamboo focus:ring-2 focus:ring-bamboo-glow"
      />
      <select
        onChange={(e) =>
          setTypeFilter((e.target.value || null) as ContentType | null)
        }
        className="cursor-pointer rounded-lg border border-paper-deep bg-cloud px-2 py-1.5 text-sm text-ink-soft outline-none transition-colors focus:border-bamboo"
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.label} value={o.value ?? ""}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
