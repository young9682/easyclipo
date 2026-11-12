/** 空态：梅枝小影 + 宋体文案（梅影风格） */
export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <svg viewBox="0 0 140 110" aria-hidden="true" className="w-[130px] opacity-50">
        <path
          d="M132 6 C 112 20, 96 32, 82 50 C 70 65, 58 84, 50 106"
          fill="none"
          stroke="var(--color-stroke)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <g fill="var(--color-petal)" opacity="0.9">
          <circle cx="78" cy="21" r="5" />
          <circle cx="84.7" cy="26" r="5" />
          <circle cx="82.1" cy="33.5" r="5" />
          <circle cx="73.9" cy="33.5" r="5" />
          <circle cx="71.3" cy="26" r="5" />
        </g>
        <circle cx="78" cy="27.3" r="2" fill="var(--color-cinnabar)" />
      </svg>
      <p className="font-serif text-base text-ink-soft">剪贴板还是空的</p>
      <p className="max-w-[15rem] text-xs leading-6 text-ink-faint">
        复制任意文本、文件或图片后会自动出现在这里。Ctrl+Shift+V
        可随时唤起窗口，关闭窗口会隐藏到系统托盘。
      </p>
    </div>
  );
}
