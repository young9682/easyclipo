export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "easyclip-theme";

export function currentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  if (mode === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage 不可用时主题仅本次会话生效
  }
}

/** 梅影主题默认夜色（墨卷），昼色需显式选择 */
export function savedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
