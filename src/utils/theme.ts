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

export function savedTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
