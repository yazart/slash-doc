import * as vscode from 'vscode';
import { getSettingsUri, pathExists, writeJson } from './filesystem';
import { getDefaultSettings, normalizeSettings } from './settings';
import type { SlashDocSettings } from './types';

export async function readSettings(workspaceRoot: vscode.Uri): Promise<SlashDocSettings> {
  const settingsUri = getSettingsUri(workspaceRoot);
  if (!(await pathExists(settingsUri))) {
    return getDefaultSettings();
  }
  const data = await vscode.workspace.fs.readFile(settingsUri);
  return normalizeSettings(JSON.parse(new TextDecoder().decode(data)));
}

export async function writeSettings(workspaceRoot: vscode.Uri, settings: SlashDocSettings): Promise<void> {
  await writeJson(getSettingsUri(workspaceRoot), settings);
}
