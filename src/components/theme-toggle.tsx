"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEditor, type ThemeMode } from "@/lib/editor/store";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlays";

const OPTIONS: { mode: ThemeMode; icon: React.ElementType; label: string }[] = [
  { mode: "light", icon: Sun, label: "Light" },
  { mode: "dark", icon: Moon, label: "Dark" },
  { mode: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useEditor((state) => state.theme);
  const setTheme = useEditor((state) => state.setTheme);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  if (compact) {
    const current = OPTIONS.find((option) => option.mode === theme) ?? OPTIONS[2];
    const Icon = current.icon;
    const next = OPTIONS[(OPTIONS.findIndex((option) => option.mode === theme) + 1) % OPTIONS.length];
    return (
      <Tooltip label={`Theme: ${current.label} — switch to ${next.label}`}>
        <button
          type="button"
          onClick={() => setTheme(next.mode)}
          className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition hover:surface-3 hover:text-[var(--text)]"
          aria-label={`Switch to ${next.label} theme`}
        >
          <Icon className="size-4" />
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-[var(--radius-md)] surface-3 p-1">
      {OPTIONS.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => setTheme(mode)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-medium transition",
            theme === mode
              ? "surface text-[var(--text)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text)]",
          )}
          aria-pressed={theme === mode}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
