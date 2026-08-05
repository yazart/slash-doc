import { describe, expect, it } from 'vitest';
import { getDefaultSettings, normalizeSettings } from '../src/extension/settings';

describe('export settings', () => {
  it('keeps embedded images by default for backward compatibility', () => {
    expect(getDefaultSettings().exportOptions.extractImages).toBe(false);
    expect(normalizeSettings({ version: 1 }).exportOptions.extractImages).toBe(false);
  });

  it('enables image extraction from persisted settings', () => {
    expect(normalizeSettings({ exportOptions: { extractImages: true } }).exportOptions.extractImages).toBe(true);
  });
});

describe('autosave settings', () => {
  it('uses enabled one-second autosave by default', () => {
    expect(normalizeSettings({ version: 1 }).autoSave).toEqual({ enabled: true, intervalSeconds: 1 });
  });

  it('normalizes the configured interval to a safe range', () => {
    expect(normalizeSettings({ autoSave: { enabled: false, intervalSeconds: 12.6 } }).autoSave).toEqual({
      enabled: false,
      intervalSeconds: 12.6,
    });
    expect(normalizeSettings({ autoSave: { intervalSeconds: 0 } }).autoSave.intervalSeconds).toBe(0.3);
    expect(normalizeSettings({ autoSave: { intervalSeconds: 10_000 } }).autoSave.intervalSeconds).toBe(1800);
  });
});
