import EditorJS, { type OutputData } from '@editorjs/editorjs';
import type { EditorTools } from './editor-tool-registry';
import { LUCIDE_ICONS } from './lucide-icons';
import { normalizeEditorData } from './editor-data';
import { diffPageBlocks, type PageBlockDiffEntry } from './page-block-diff';
import { diffText, readBlockText } from './page-text-diff';

type PageGitCommit = { hash: string; shortHash: string; date: string; author: string; subject: string };
type MessageSender = (message: unknown) => void;
type HistoryResponse = { type?: string; requestId?: string; commits?: PageGitCommit[]; data?: unknown; error?: string };

export function installPageHistoryPanel(tools: EditorTools, postMessage: MessageSender): void {
  const actions = document.querySelector<HTMLElement>('.export-actions');
  if (!actions || !window.__SLASH_DOC_CURRENT_PAGE_ID__) return;
  const view = createHistoryView();
  actions.prepend(view.root);
  document.body.append(view.overlay);
  const versions = new Map<string, OutputData>();
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void }>();
  let viewer: EditorJS | undefined;
  let commitsLoaded = false;
  let activeMode: 'history' | 'comparison' = 'history';

  window.addEventListener('message', (event: MessageEvent<HistoryResponse>) => {
    if (!event.data?.requestId || !event.data.type?.startsWith('gitPage')) return;
    const request = pending.get(event.data.requestId);
    if (!request) return;
    pending.delete(event.data.requestId);
    if (event.data.error) request.reject(new Error(event.data.error));
    else request.resolve(event.data.commits ?? event.data.data);
  });

  const request = (type: 'gitPageHistory' | 'gitPageVersion', commit?: string) => {
    const requestId = `git-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<unknown>((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      postMessage({ type, requestId, commit });
    });
  };

  const loadVersion = async (hash: string): Promise<OutputData> => {
    const cached = versions.get(hash);
    if (cached) return structuredClone(cached);
    const data = normalizeEditorData(await request('gitPageVersion', hash));
    versions.set(hash, data);
    return structuredClone(data);
  };

  const render = async (data: OutputData, diff?: PageBlockDiffEntry[]) => {
    view.viewer.replaceChildren();
    if (viewer) {
      viewer.destroy();
      viewer = undefined;
    }
    viewer = new EditorJS({ holder: view.viewer, tools, data, minHeight: 0, autofocus: false, inlineToolbar: false });
    await viewer.isReady;
    view.viewer.setAttribute('aria-readonly', 'true');
    view.viewer.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach((item) => {
      item.contentEditable = 'false';
    });
    view.viewer
      .querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, button, select, textarea',
      )
      .forEach((item) => (item.disabled = true));
    if (diff) {
      Array.from(view.viewer.querySelectorAll<HTMLElement>('.ce-block')).forEach((block, index) => {
        const entry = diff[index];
        block.dataset.gitDiff = entry?.status ?? 'unchanged';
        if (entry?.status === 'modified') renderTextDiff(block, entry);
      });
    }
  };

  const showError = (status: HTMLElement, error: unknown) => {
    status.textContent = error instanceof Error ? error.message : String(error);
    status.dataset.error = 'true';
  };

  const loadCommits = async (status: HTMLElement) => {
    if (commitsLoaded) return;
    status.textContent = 'Загрузка истории…';
    try {
      const commits = (await request('gitPageHistory')) as PageGitCommit[];
      populateCommits(view.version, commits);
      populateCommits(view.first, commits);
      populateCommits(view.second, commits);
      view.first.selectedIndex = Math.min(1, Math.max(0, commits.length - 1));
      view.second.selectedIndex = 0;
      view.version.selectedIndex = 0;
      commitsLoaded = true;
      view.historyStatus.textContent = commits.length
        ? `Коммитов: ${commits.length}`
        : 'История изменений страницы пуста';
      view.comparisonStatus.textContent = commits.length
        ? `Коммитов: ${commits.length}`
        : 'История изменений страницы пуста';
      view.viewButton.disabled = commits.length === 0;
      view.compareButton.disabled = commits.length < 2;
    } catch (error) {
      showError(status, error);
    }
  };

  view.historyToggle.addEventListener('click', async () => {
    view.comparisonPanel.hidden = true;
    view.historyPanel.hidden = !view.historyPanel.hidden;
    if (!view.historyPanel.hidden) await loadCommits(view.historyStatus);
  });

  view.comparisonToggle.addEventListener('click', async () => {
    view.historyPanel.hidden = true;
    view.comparisonPanel.hidden = !view.comparisonPanel.hidden;
    if (!view.comparisonPanel.hidden) await loadCommits(view.comparisonStatus);
  });

  view.viewButton.addEventListener('click', async () => {
    if (!view.version.value) return;
    view.historyStatus.textContent = 'Загрузка версии…';
    try {
      await render(await loadVersion(view.version.value));
      activeMode = 'history';
      openOverlay(view, `Версия ${selectedLabel(view.version)}`, false);
      view.historyStatus.textContent = '';
    } catch (error) {
      showError(view.historyStatus, error);
    }
  });

  view.compareButton.addEventListener('click', async () => {
    if (!view.first.value || !view.second.value) return;
    view.comparisonStatus.textContent = 'Сравнение версий…';
    try {
      const [previous, next] = await Promise.all([loadVersion(view.first.value), loadVersion(view.second.value)]);
      const diff = diffPageBlocks(previous, next);
      const data = normalizeEditorData({ blocks: diff.map((entry) => entry.block) });
      await render(data, diff);
      activeMode = 'comparison';
      openOverlay(view, `${selectedLabel(view.first)} → ${selectedLabel(view.second)}`, true);
      view.comparisonStatus.textContent = '';
    } catch (error) {
      showError(view.comparisonStatus, error);
    }
  });

  const close = () => {
    view.overlay.hidden = true;
    view.overlay.removeAttribute('data-mode');
    viewer?.destroy();
    viewer = undefined;
    view.viewer.replaceChildren();
    (activeMode === 'comparison' ? view.comparisonToggle : view.historyToggle).focus();
  };
  view.close.addEventListener('click', close);
  view.overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!view.root.contains(event.target as Node)) {
      view.historyPanel.hidden = true;
      view.comparisonPanel.hidden = true;
    }
  });
}

function renderTextDiff(block: HTMLElement, entry: PageBlockDiffEntry): void {
  const previous = readBlockText(entry.previousBlock);
  const next = readBlockText(entry.block);
  if (previous === undefined || next === undefined || previous === next) return;
  const output = document.createElement('span');
  output.className = 'git-history-text-diff';
  for (const part of diffText(previous, next)) {
    const element = document.createElement(part.kind === 'removed' ? 'del' : part.kind === 'added' ? 'ins' : 'span');
    element.textContent = part.value;
    output.append(element);
  }
  const textElement =
    entry.block.type === 'paragraph' || entry.block.type === 'header'
      ? block.querySelector<HTMLElement>('.ce-paragraph, .ce-header')
      : undefined;
  if (textElement) textElement.replaceChildren(output);
  else block.querySelector<HTMLElement>('.ce-block__content')?.append(output);
}

type HistoryView = ReturnType<typeof createHistoryView>;

function createHistoryView() {
  const root = document.createElement('div');
  root.className = 'git-history-control';
  const historyToggle = iconButton('История Git', LUCIDE_ICONS.history);
  const comparisonToggle = iconButton('Сравнение версий', LUCIDE_ICONS.fileDiff);
  const historyPanel = document.createElement('div');
  historyPanel.className = 'git-history-panel git-history-panel--view';
  historyPanel.hidden = true;
  const comparisonPanel = document.createElement('div');
  comparisonPanel.className = 'git-history-panel git-history-panel--comparison';
  comparisonPanel.hidden = true;
  const version = versionSelect('Версия');
  const first = versionSelect('Первая версия');
  const second = versionSelect('Следующая версия');
  const viewButton = actionButton('Просмотр');
  const compareButton = actionButton('Сравнить');
  viewButton.disabled = true;
  compareButton.disabled = true;
  const historyStatus = statusElement();
  const comparisonStatus = statusElement();
  historyPanel.append(labeled('Версия', version), viewButton, historyStatus);
  comparisonPanel.append(
    labeled('Первая версия', first),
    labeled('Следующая версия', second),
    compareButton,
    comparisonStatus,
  );
  root.append(historyToggle, comparisonToggle, historyPanel, comparisonPanel);

  const overlay = document.createElement('section');
  overlay.className = 'git-history-overlay';
  overlay.hidden = true;
  overlay.tabIndex = -1;
  const header = document.createElement('header');
  const title = document.createElement('strong');
  const legend = document.createElement('div');
  legend.className = 'git-history-legend';
  legend.innerHTML =
    '<span data-kind="added">Добавлен</span><span data-kind="modified">Изменён</span><span data-kind="removed">Удалён</span>';
  const close = actionButton('Выйти из просмотра');
  close.classList.add('git-history-exit');
  header.append(title, legend, close);
  const viewer = document.createElement('div');
  viewer.className = 'git-history-viewer';
  overlay.append(header, viewer);
  return {
    root,
    historyToggle,
    comparisonToggle,
    historyPanel,
    comparisonPanel,
    version,
    first,
    second,
    viewButton,
    compareButton,
    historyStatus,
    comparisonStatus,
    overlay,
    title,
    legend,
    close,
    viewer,
  };
}

function statusElement(): HTMLSpanElement {
  const status = document.createElement('span');
  status.className = 'git-history-status';
  return status;
}

function openOverlay(view: HistoryView, title: string, comparison: boolean): void {
  view.title.textContent = title;
  view.legend.hidden = !comparison;
  view.close.textContent = comparison ? 'Выйти из сравнения' : 'Выйти из просмотра';
  view.overlay.dataset.mode = comparison ? 'comparison' : 'view';
  view.overlay.hidden = false;
  view.overlay.focus();
}

function populateCommits(select: HTMLSelectElement, commits: PageGitCommit[]): void {
  select.replaceChildren(
    ...commits.map((commit, index) => {
      const option = document.createElement('option');
      option.value = commit.hash;
      const date = new Date(commit.date).toLocaleString('ru-RU');
      option.textContent = `${commits.length - index - 1} · ${date} · ${commit.author} · ${commit.subject}`;
      option.title = `${commit.author}: ${commit.subject}`;
      return option;
    }),
  );
}

function selectedLabel(select: HTMLSelectElement): string {
  return select.selectedOptions[0]?.textContent ?? '';
}

function versionSelect(label: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);
  return select;
}

function labeled(text: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.append(document.createTextNode(text), control);
  return label;
}

function actionButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'git-history-action';
  button.textContent = text;
  return button;
}

function iconButton(label: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'export-button export-icon-button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = icon;
  return button;
}
