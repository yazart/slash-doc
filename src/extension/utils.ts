export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function stripHtml(value: string): string {
  return value.replaceAll(/<[^>]*>/g, '');
}

export function createPageId(): string {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSettingsId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function escapeJavaScriptString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r');
}

export function getNonce(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return nonce;
}

export function isExpressRouter(value: unknown): value is Router {
  return typeof value === 'function' && typeof (value as { use?: unknown }).use === 'function';
}
import type { Router } from 'express';
