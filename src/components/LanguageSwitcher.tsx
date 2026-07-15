import { Check, Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage, type AppLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLanguage: AppLanguage =
    i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en";

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selectLanguage = (language: AppLanguage) => {
    void changeAppLanguage(language);
    setOpen(false);
  };

  return (
    <div className="language-switcher" ref={containerRef}>
      <button
        className="language-switcher__trigger"
        type="button"
        aria-label={t("language.label")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Languages size={14} strokeWidth={1.7} />
        <span>
          {currentLanguage === "en"
            ? t("language.englishShort")
            : t("language.chineseShort")}
        </span>
      </button>
      {open && (
        <div className="language-switcher__menu" role="menu" aria-label={t("language.menu")}>
          <button type="button" role="menuitemradio" aria-checked={currentLanguage === "en"} onClick={() => selectLanguage("en")}>
            <span>{t("language.english")}</span>
            {currentLanguage === "en" && <Check size={13} />}
          </button>
          <button type="button" role="menuitemradio" aria-checked={currentLanguage === "zh-CN"} onClick={() => selectLanguage("zh-CN")}>
            <span>{t("language.chinese")}</span>
            {currentLanguage === "zh-CN" && <Check size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}
