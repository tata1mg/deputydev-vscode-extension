import { useEffect, useState } from "react";
import { useThemeStore } from "@/stores/useThemeStore";

export function useSafeAutocompleteBackground(): string {
  const { themeKind } = useThemeStore();
  const [safeBg, setSafeBg] = useState("var(--vscode-list-inactiveSelectionBackground)");

  useEffect(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--vscode-list-inactiveSelectionBackground")
      .trim();

    const isBad =
      raw === "" ||
      raw === "transparent" ||
      raw.startsWith("rgba") ||
      themeKind === "high-contrast" ||
      themeKind === "high-contrast-light";

    if (isBad) {
      setSafeBg("var(--deputydev-chat-background)");
    } else {
      setSafeBg(raw);
    }
  }, [themeKind]);

  return safeBg;
}