import { getEditorWebviewStylesA } from './editor-webview-styles-a';
import { EDITOR_WEBVIEW_STYLES_B } from './editor-webview-styles-b';
import { EDITOR_WEBVIEW_STYLES_C } from './editor-webview-styles-c';
import { EDITORJS_2_23_THEME_STYLES } from './editor-webview-styles-editorjs-2-23';

export function getEditorWebviewStyles(iconUri: string): string {
  return (
    getEditorWebviewStylesA(iconUri) + EDITOR_WEBVIEW_STYLES_B + EDITOR_WEBVIEW_STYLES_C + EDITORJS_2_23_THEME_STYLES
  );
}
