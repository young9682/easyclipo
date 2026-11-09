import { useClips } from "../stores/clips";

const CATEGORIES = ["全部", "文本", "图片", "代码", "链接", "文件"];

export function CategoryTabs() {
  const category = useClips((s) => s.category);
  const setCategory = useClips((s) => s.setCategory);

  return (
    <div className="flex gap-1 border-b border-zinc-800 px-3 pt-1">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => setCategory(c)}
          className={`rounded-t-md px-3 py-1.5 text-xs transition-colors ${
            category === c
              ? "border-b-2 border-sky-400 font-medium text-sky-300"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
