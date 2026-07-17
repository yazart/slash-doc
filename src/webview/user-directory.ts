import type { SlashDocUser } from '../shared/users';

type MessageSender = {
  postMessage(message: unknown): void;
};

type PendingRequest = {
  resolve(users: SlashDocUser[]): void;
  timeout: ReturnType<typeof setTimeout>;
};

export type UserDirectoryBridge = {
  search(query: string): Promise<SlashDocUser[]>;
  handleMessage(message: unknown): boolean;
};

declare global {
  interface Window {
    __SLASH_DOC_USER_DIRECTORY__?: UserDirectoryBridge;
  }
}

export function createUserDirectoryBridge(sender: MessageSender): UserDirectoryBridge {
  const requests = new Map<string, PendingRequest>();
  return {
    search(query) {
      const requestId = `users-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          requests.delete(requestId);
          resolve([]);
        }, 5_000);
        requests.set(requestId, { resolve, timeout });
        sender.postMessage({ type: 'searchUsers', requestId, query });
      });
    },
    handleMessage(message) {
      if (!isRecord(message) || message.type !== 'userSearchResponse' || typeof message.requestId !== 'string') {
        return false;
      }
      const pending = requests.get(message.requestId);
      if (!pending) return true;
      clearTimeout(pending.timeout);
      requests.delete(message.requestId);
      pending.resolve(Array.isArray(message.users) ? message.users.filter(isSlashDocUser) : []);
      return true;
    },
  };
}

export function setupUserMentions(directory: UserDirectoryBridge): void {
  const popup = document.createElement('div');
  popup.className = 'slash-user-search-popup';
  popup.hidden = true;
  document.body.append(popup);

  let replacementRange: Range | undefined;
  let requestSequence = 0;
  let activeIndex = 0;
  let results: SlashDocUser[] = [];

  const close = () => {
    popup.hidden = true;
    popup.replaceChildren();
    replacementRange = undefined;
    results = [];
  };

  const choose = (user: SlashDocUser) => {
    const range = replacementRange;
    if (!range?.commonAncestorContainer.isConnected) return close();
    const mention = createUserMention(user);
    range.deleteContents();
    range.insertNode(document.createTextNode('\u00a0'));
    range.insertNode(mention);
    const caret = document.createRange();
    caret.setStartAfter(mention.nextSibling ?? mention);
    caret.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    mention.closest<HTMLElement>('[contenteditable="true"]')?.dispatchEvent(new Event('input', { bubbles: true }));
    close();
  };

  const render = () => {
    popup.replaceChildren();
    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'slash-user-search-empty';
      empty.textContent = 'Пользователи не найдены';
      popup.append(empty);
      return;
    }
    results.forEach((user, index) => {
      const option = createUserOption(user);
      option.classList.toggle('active', index === activeIndex);
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => choose(user));
      popup.append(option);
    });
  };

  const update = async () => {
    const context = readMentionContext();
    if (!context) return close();
    replacementRange = context.range;
    const marker = context.range.getBoundingClientRect();
    popup.style.left = `${Math.max(8, Math.min(marker.left, window.innerWidth - 330))}px`;
    popup.style.top = `${Math.max(8, Math.min(marker.bottom + 6, window.innerHeight - 260))}px`;
    popup.hidden = false;
    results = [];
    popup.innerHTML = '<div class="slash-user-search-empty">Поиск…</div>';
    const sequence = ++requestSequence;
    const users = await directory.search(context.query);
    if (sequence !== requestSequence || popup.hidden) return;
    results = users;
    activeIndex = 0;
    render();
  };

  document.addEventListener('input', (event) => {
    if (isEditableEditorTarget(event.target)) void update();
  });
  document.addEventListener('keydown', (event) => {
    if (popup.hidden || results.length === 0) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      choose(results[activeIndex]);
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !popup.contains(event.target)) close();
  });
}

export function createUserOption(user: SlashDocUser): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'slash-user-search-option';
  const image = document.createElement('img');
  image.src = user.photo;
  image.alt = '';
  const text = document.createElement('span');
  const name = document.createElement('strong');
  name.textContent = user.fullName;
  const email = document.createElement('small');
  email.textContent = user.email;
  text.append(name, email);
  button.append(image, text);
  return button;
}

export function createUserMention(user: SlashDocUser): HTMLAnchorElement {
  const mention = document.createElement('a');
  mention.className = 'slash-user-mention';
  mention.contentEditable = 'false';
  mention.dataset.userId = user.id;
  mention.dataset.userName = user.fullName;
  mention.dataset.userEmail = user.email;
  mention.dataset.userPhoto = user.photo;
  mention.dataset.userLink = user.link;
  mention.href = user.link;
  mention.target = '_blank';
  mention.rel = 'noopener noreferrer';
  mention.title = `${user.fullName} · ${user.email}`;
  mention.textContent = `@${user.fullName}`;
  return mention;
}

function readMentionContext(): { query: string; range: Range } | undefined {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return undefined;
  const caret = selection.getRangeAt(0);
  const editable = getElement(caret.startContainer)?.closest<HTMLElement>('#editor [contenteditable="true"]');
  if (!editable || editable.closest('[data-slash-doc-custom-addon], .slash-approval-table-tool')) return undefined;
  const before = document.createRange();
  before.selectNodeContents(editable);
  before.setEnd(caret.startContainer, caret.startOffset);
  const match = /(?:^|\s)@([^@\n]{0,60})$/u.exec(before.toString());
  if (!match) return undefined;
  const length = match[1].length + 1;
  const start = findTextPositionBeforeCaret(editable, caret, length);
  if (!start) return undefined;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(caret.startContainer, caret.startOffset);
  return { query: match[1].trim(), range };
}

function findTextPositionBeforeCaret(root: HTMLElement, caret: Range, characters: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  let remaining = characters;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const text = nodes[index];
    const end = text === caret.startContainer ? caret.startOffset : text.data.length;
    if (!caret.comparePoint || caret.comparePoint(text, end) <= 0) {
      if (remaining <= end) return { node: text, offset: end - remaining };
      remaining -= end;
    }
  }
  return undefined;
}

function isEditableEditorTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('#editor [contenteditable="true"]'));
}

function getElement(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSlashDocUser(value: unknown): value is SlashDocUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.email === 'string' &&
    typeof value.photo === 'string' &&
    typeof value.link === 'string'
  );
}
