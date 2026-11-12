/**
 * 梅枝装饰（墨枝 + 白梅五瓣 + 朱砂蕊）：
 * 与应用图标同源的五瓣梅花语言，绝对定位在列表区右上角，pointer-events 关闭。
 */
export function PlumBranch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 110"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <path
        d="M132 6 C 112 20, 96 32, 82 50 C 70 65, 58 84, 50 106"
        fill="none"
        stroke="var(--color-stroke)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M96 36 C 86 42, 80 50, 76 60"
        fill="none"
        stroke="var(--color-stroke)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M70 68 C 60 70, 52 76, 46 84"
        fill="none"
        stroke="var(--color-stroke)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g fill="var(--color-petal)" opacity="0.9">
        <circle cx="78" cy="21" r="5" />
        <circle cx="84.7" cy="26" r="5" />
        <circle cx="82.1" cy="33.5" r="5" />
        <circle cx="73.9" cy="33.5" r="5" />
        <circle cx="71.3" cy="26" r="5" />
        <circle cx="52" cy="80" r="4.4" />
        <circle cx="57.1" cy="83.7" r="4.4" />
        <circle cx="55.1" cy="89.8" r="4.4" />
        <circle cx="48.9" cy="89.8" r="4.4" />
        <circle cx="46.9" cy="83.7" r="4.4" />
      </g>
      <circle cx="78" cy="27.3" r="2" fill="var(--color-cinnabar)" />
      <circle cx="52" cy="85.2" r="1.7" fill="var(--color-cinnabar)" />
      <circle
        cx="63"
        cy="52"
        r="2.6"
        fill="var(--color-petal)"
        stroke="var(--color-stroke)"
        strokeWidth="1"
      />
      <circle
        cx="48"
        cy="70"
        r="2.2"
        fill="var(--color-petal)"
        stroke="var(--color-stroke)"
        strokeWidth="1"
      />
    </svg>
  );
}
