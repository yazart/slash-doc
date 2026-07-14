import * as vscode from 'vscode';
import express = require('express');
import type { Server } from 'http';
import { PuppeteerNode } from 'puppeteer/lib/cjs/puppeteer/node/Puppeteer.js';
import { PUPPETEER_REVISIONS } from 'puppeteer/lib/cjs/puppeteer/revisions.js';
import { pathToFileURL } from 'url';
import {
  getApiServiceUri,
  getGlobalAddonRootUri,
  getGlobalApiRootUri,
  getSettingsUri,
  getWorkspaceRoot,
  pathExists
} from './filesystem';
import { readSettings, writeSettings } from './settings-store';
import type { ApiService } from './types';
import { isExpressRouter, isRecord } from './utils';

export class ApiServerManager {
  private server?: Server;

  constructor(private readonly extensionUri: vscode.Uri) {}

  async reload(): Promise<void> {
    await this.dispose();

    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot || !(await pathExists(vscode.Uri.joinPath(workspaceRoot, '.slash-doc')))) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const app = express();
    app.use(express.json());

    const context = {
      extensionUri: this.extensionUri.fsPath,
      workspaceRoot: workspaceRoot.fsPath,
      apiRoot: getGlobalApiRootUri(this.extensionUri).fsPath,
      puppeteer: createBundledPuppeteer(this.extensionUri.fsPath),
      variables: Object.fromEntries(settings.variables.map((item) => [item.key, item.value])),
      settings
    };

    app.get('/__slash-doc/health', (_request, response) => {
      response.json({
        ok: true,
        prefix: settings.apiPrefix
      });
    });

    for (const service of settings.apiServices) {
      try {
        await mountApiService(app, this.extensionUri, workspaceRoot, settings.apiPrefix, service, context);
      } catch (error) {
        console.error(`Failed to mount Slash Doc API service ${service.file}`, error);
      }
    }

    this.server = await new Promise<Server>((resolve, reject) => {
      const server = app.listen(settings.apiPort, () => resolve(server));
      server.once('error', reject);
    });
  }

  async dispose(): Promise<void> {
    const server = this.server;
    this.server = undefined;

    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

function createBundledPuppeteer(projectRoot: string): PuppeteerNode {
  const productName = process.env.PUPPETEER_PRODUCT === 'firefox'
    || process.env.npm_config_puppeteer_product === 'firefox'
    || process.env.npm_package_config_puppeteer_product === 'firefox'
    ? 'firefox'
    : undefined;

  return new PuppeteerNode({
    projectRoot,
    preferredRevision: productName === 'firefox' ? PUPPETEER_REVISIONS.firefox : PUPPETEER_REVISIONS.chromium,
    isPuppeteerCore: false,
    productName
  });
}

export async function migrateLegacyModules(extensionUri: vscode.Uri): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();

  if (!workspaceRoot || !(await pathExists(getSettingsUri(workspaceRoot)))) {
    return;
  }

  const settings = await readSettings(workspaceRoot);
  const globalApiRoot = getGlobalApiRootUri(extensionUri);
  const globalAddonRoot = getGlobalAddonRootUri(extensionUri);
  await vscode.workspace.fs.createDirectory(globalApiRoot);
  await vscode.workspace.fs.createDirectory(globalAddonRoot);

  for (const service of settings.apiServices) {
    await copyLegacyModuleIfMissing(
      vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'api', service.file),
      vscode.Uri.joinPath(globalApiRoot, service.file)
    );
  }

  for (const addon of settings.customEditorAddons) {
    await copyLegacyModuleIfMissing(
      vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'addons', addon.file),
      vscode.Uri.joinPath(globalAddonRoot, addon.file)
    );
  }

  await writeSettings(workspaceRoot, settings);
}

async function copyLegacyModuleIfMissing(source: vscode.Uri, target: vscode.Uri): Promise<void> {
  if (await pathExists(target) || !(await pathExists(source))) {
    return;
  }

  await vscode.workspace.fs.writeFile(target, await vscode.workspace.fs.readFile(source));
}

async function mountApiService(
  app: express.Express,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
  apiPrefix: string,
  service: ApiService,
  context: unknown
): Promise<void> {
  const serviceUri = getApiServiceUri(extensionUri, workspaceRoot, service);
  const serviceContext = {
    ...(isRecord(context) ? context : {}),
    apiRoot: getGlobalApiRootUri(extensionUri).fsPath
  };

  if (!(await pathExists(serviceUri))) {
    return;
  }

  const moduleUrl = `${pathToFileURL(serviceUri.fsPath).href}?v=${Date.now()}`;
  const routeModule = await import(moduleUrl) as Record<string, unknown>;
  const router = express.Router();
  const register = routeModule.register ?? routeModule.default;

  if (typeof register === 'function') {
    await register(router, serviceContext);
    app.use(apiPrefix, router);
    return;
  }

  const exportedRouter = routeModule.router ?? routeModule.default;

  if (isExpressRouter(exportedRouter)) {
    app.use(apiPrefix, exportedRouter);
  }
}

