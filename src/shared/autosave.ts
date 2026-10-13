export type AutoSaveSettings = {
  enabled: boolean;
  intervalSeconds: number;
};

export const DEFAULT_AUTO_SAVE_SETTINGS: AutoSaveSettings = {
  enabled: true,
  intervalSeconds: 1,
};

export function normalizeAutoSaveSettings(value: unknown): AutoSaveSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_AUTO_SAVE_SETTINGS };
  const settings = value as Record<string, unknown>;
  const interval = typeof settings.intervalSeconds === 'number' ? settings.intervalSeconds : Number.NaN;
  return {
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : DEFAULT_AUTO_SAVE_SETTINGS.enabled,
    intervalSeconds: Number.isFinite(interval)
      ? Math.max(0.3, Math.min(1800, interval))
      : DEFAULT_AUTO_SAVE_SETTINGS.intervalSeconds,
  };
}
