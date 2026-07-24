import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type AppTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "ovis_manager_theme";

function readInitialTheme(): AppTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<AppTheme>(readInitialTheme);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = t(`theme.switchTo.${nextTheme}`);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute("content", theme === "dark" ? "#080808" : "#f3f4f5");
  }, [theme]);

  return (
    <button
      className="theme-switcher"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme)}
    >
      {theme === "dark" ? (
        <Sun size={15} strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <Moon size={15} strokeWidth={1.7} aria-hidden="true" />
      )}
    </button>
  );
}
