import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  applyTheme,
  CUSTOM_THEME_STORAGE_KEY,
  getStoredCustomTheme,
  getStoredTheme,
  THEME_STORAGE_KEY,
  type CustomThemeColors,
  type ThemePreference,
} from '@/lib/theme';

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '夜间', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'custom', label: '自定义', icon: Palette },
];

const COLOR_FIELDS: Array<{
  key: keyof CustomThemeColors;
  label: string;
}> = [
  { key: 'background', label: '页面背景' },
  { key: 'card', label: '卡片背景' },
  { key: 'foreground', label: '正文文字' },
  { key: 'primary', label: '主交互色' },
  { key: 'border', label: '边框' },
];

export function ThemeSelector() {
  const [theme, setTheme] = useState<ThemePreference>(() => getStoredTheme());
  const [customTheme, setCustomTheme] = useState<CustomThemeColors>(() => getStoredCustomTheme());
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const themeBeforeCustomRef = useRef<ThemePreference>(theme);

  useEffect(() => {
    applyTheme(theme, customTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, customTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') applyTheme('system', customTheme);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme, customTheme]);

  const selectTheme = (nextTheme: ThemePreference) => {
    if (nextTheme !== 'custom') {
      setTheme(nextTheme);
      return;
    }
    themeBeforeCustomRef.current = theme;
    setCustomTheme(getStoredCustomTheme());
    setTheme('custom');
    setCustomDialogOpen(true);
  };

  const saveCustomTheme = () => {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(customTheme));
    setTheme('custom');
    setCustomDialogOpen(false);
  };

  const handleCustomDialogChange = (open: boolean) => {
    setCustomDialogOpen(open);
    if (!open) {
      setCustomTheme(getStoredCustomTheme());
      setTheme(themeBeforeCustomRef.current);
    }
  };

  const Icon = THEME_OPTIONS.find((option) => option.value === theme)?.icon || Monitor;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="切换主题">
            <Icon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {THEME_OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            return (
              <DropdownMenuItem key={option.value} onSelect={() => selectTheme(option.value)}>
                <OptionIcon className="size-4" />
                <span className="flex-1">{option.label}</span>
                {theme === option.value && <Check className="size-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customDialogOpen} onOpenChange={handleCustomDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>自定义主题</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              状态色保留系统语义，避免风险和优先级信号失真。
            </p>
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between gap-4 text-sm">
                <span>{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customTheme[key]}
                    onChange={(event) => setCustomTheme((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))}
                    className="size-8 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
                  />
                  <span className="w-16 font-mono text-xs text-muted-foreground">
                    {customTheme[key].toUpperCase()}
                  </span>
                </div>
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleCustomDialogChange(false)}>取消</Button>
              <Button onClick={saveCustomTheme}>应用主题</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
