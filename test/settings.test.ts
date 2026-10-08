import { describe, expect, it } from 'vitest';
import { getDefaultSettings, normalizeSettings } from '../src/extension/settings';

describe('export settings', () => {
  it('keeps document files embedded by default', () => {
    expect(getDefaultSettings().exportOptions.separateFiles).toBe(false);
    expect(normalizeSettings({ version: 1 }).exportOptions.separateFiles).toBe(false);
    expect(getDefaultSettings().exportOptions.repositoryUrl).toBe('');
    expect(getDefaultSettings().exportOptions.defaultBranch).toBe('master');
    expect(getDefaultSettings().exportOptions.markdownRootFileName).toBe('README.md');
  });

  it('stores a named default branch and falls back to master', () => {
    expect(normalizeSettings({ exportOptions: { defaultBranch: ' release/docs ' } }).exportOptions.defaultBranch).toBe(
      'release/docs',
    );
    expect(normalizeSettings({ exportOptions: { defaultBranch: ' ' } }).exportOptions.defaultBranch).toBe('master');
  });

  it('stores a GitLab repository URL for edit links', () => {
    expect(
      normalizeSettings({ exportOptions: { repositoryUrl: ' https://gitlab.example/group/project ' } }).exportOptions,
    ).toMatchObject({ repositoryUrl: 'https://gitlab.example/group/project' });
  });

  it('enables file separation and migrates the legacy image setting', () => {
    expect(normalizeSettings({ exportOptions: { separateFiles: true } }).exportOptions.separateFiles).toBe(true);
    expect(normalizeSettings({ exportOptions: { extractImages: true } }).exportOptions.separateFiles).toBe(true);
  });

  it('normalizes the configurable Markdown root file name', () => {
    expect(normalizeSettings({ exportOptions: { markdownRootFileName: ' SUMMARY ' } }).exportOptions).toMatchObject({
      markdownRootFileName: 'SUMMARY.md',
    });
    expect(normalizeSettings({ exportOptions: { markdownRootFileName: '../docs?.md' } }).exportOptions).toMatchObject({
      markdownRootFileName: 'docs-.md',
    });
    expect(normalizeSettings({ exportOptions: { markdownRootFileName: '' } }).exportOptions).toMatchObject({
      markdownRootFileName: 'README.md',
    });
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
