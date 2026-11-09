export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-3xl opacity-70">🌸</div>
      <p className="font-serif text-base text-ink-soft">剪贴板还是空的</p>
      <p className="max-w-[15rem] text-xs leading-6 text-ink-faint">
        复制任意文本、文件或图片后会自动出现在这里。Ctrl+Shift+V
        可随时唤起窗口，关闭窗口会隐藏到系统托盘。
      </p>
    </div>
  );
}
