import mermaid from 'mermaid';

export type MermaidPalette = {
  background: string;
  surface: string;
  foreground: string;
  border: string;
  line: string;
  secondary: string;
  tertiary: string;
};
export function readMermaidPalette(): MermaidPalette {
  // VS Code injects theme tokens on body. Reading only :root picks dark fallback colors in light themes.
  const style = getComputedStyle(document.body);
  const background = style.getPropertyValue('--vscode-editor-background').trim() || style.backgroundColor || '#ffffff';
  return {
    background,
    surface: style.getPropertyValue('--vscode-editorWidget-background').trim() || background,
    foreground: style.getPropertyValue('--vscode-editor-foreground').trim() || style.color || '#333333',
    border: style.getPropertyValue('--vscode-panel-border').trim() || style.color || '#888888',
    line: style.getPropertyValue('--vscode-descriptionForeground').trim() || style.color || '#888888',
    secondary: style.getPropertyValue('--vscode-list-hoverBackground').trim() || background,
    tertiary: style.getPropertyValue('--vscode-input-background').trim() || background,
  };
}
export function mermaidThemeConfig(palette: MermaidPalette): Record<string, unknown> {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      background: palette.background,
      primaryColor: palette.surface,
      primaryTextColor: palette.foreground,
      primaryBorderColor: palette.border,
      lineColor: palette.line,
      textColor: palette.foreground,
      secondaryColor: palette.secondary,
      tertiaryColor: palette.tertiary,
      secondaryTextColor: palette.foreground,
      tertiaryTextColor: palette.foreground,
      nodeBkg: palette.surface,
      mainBkg: palette.surface,
      nodeTextColor: palette.foreground,
      clusterBkg: palette.secondary,
      clusterBorder: palette.border,
      titleColor: palette.foreground,
      edgeLabelBackground: palette.background,
      labelBackground: palette.background,
      actorBkg: palette.surface,
      actorTextColor: palette.foreground,
      actorBorder: palette.border,
      signalColor: palette.foreground,
      signalTextColor: palette.foreground,
      labelBoxBkgColor: palette.surface,
      labelBoxBorderColor: palette.border,
      labelTextColor: palette.foreground,
      noteBkgColor: palette.secondary,
      noteTextColor: palette.foreground,
      noteBorderColor: palette.border,
      activationBkgColor: palette.tertiary,
      activationBorderColor: palette.border,
    },
  };
}
let renderQueue: Promise<unknown> = Promise.resolve();
export function renderThemedMermaid(id: string, code: string, palette: MermaidPalette): Promise<string> {
  const rendering = renderQueue.then(
    () =>
      new Promise<string>((resolve, reject) => {
        try {
          mermaid.initialize(mermaidThemeConfig(palette));
          mermaid.render(id, code, resolve);
        } catch (error) {
          reject(error);
        }
      }),
  );
  renderQueue = rendering.catch(() => undefined);
  return rendering;
}
export function watchMermaidTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  const options = {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-vscode-theme-kind', 'data-vscode-theme-id'],
  };
  observer.observe(document.documentElement, options);
  observer.observe(document.body, options);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onChange);
  };
}
