import { useClips } from "../stores/clips";

const CATEGORIES = ["全部", "文本", "图片", "代码", "链接", "文件"];

/** 分段式分类页签（纸面胶囊 + 竹青选中态） */
export function CategoryTabs() {
  const category = useClips((s) => s.category);
  const setCategory = useClips((s) => s.setCategory);

  return (
    <div className="px-4 py-1.5">
      <div className="inline-flex rounded-lg bg-paper-warm p-0.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-md px-3 py-1 text-xs transition-all ${
              category === c
                ? "bg-cloud font-medium text-bamboo shadow-[0_1px_2px_var(--color-shadow)]"
                : "text-ink-faint hover:text-ink-soft"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
