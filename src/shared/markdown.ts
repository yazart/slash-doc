export function renderSafeMarkdown(markdown: string): string {
  const lines = markdown.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^```([\w-]*)\s*$/.exec(line.trim());
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      const language = fence[1] ? ` class="language-${escapeAttribute(fence[1])}"` : '';
      output.push(`<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line.trim())) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      output.push(`<blockquote>${quote.map(renderInline).join('<br>')}</blockquote>`);
      continue;
    }

    const list = /^(\s*)([-*+] |\d+[.)] )(.+)$/.exec(line);
    if (list) {
      const ordered = /^\d/.test(list[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^(\s*)([-*+] |\d+[.)] )(.+)$/.exec(lines[index]);
        if (!item || /^\d/.test(item[2]) !== ordered) break;
        items.push(`<li>${renderInline(item[3].trim())}</li>`);
        index += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      output.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      if (paragraph.length > 0 && isBlockStart(lines[index])) break;
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
  }

  return output.join('');
}

function isBlockStart(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^```/.test(trimmed) || /^#{1,6}\s/.test(trimmed) || /^>\s?/.test(trimmed) || /^(\s*)([-*+] |\d+[.)] )/.test(line)
  );
}

function renderInline(value: string): string {
  const code: string[] = [];
  let rendered = escapeHtml(value).replaceAll(/`([^`]+)`/g, (_, content: string) => {
    const token = `\u0000CODE${code.length}\u0000`;
    code.push(`<code>${content}</code>`);
    return token;
  });

  rendered = rendered
    .replaceAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replaceAll(/__([^_]+)__/g, '<strong>$1</strong>')
    .replaceAll(/\*([^*]+)\*/g, '<em>$1</em>')
    .replaceAll(/_([^_]+)_/g, '<em>$1</em>')
    .replaceAll(/~~([^~]+)~~/g, '<del>$1</del>');

  return rendered.replaceAll(/\u0000CODE(\d+)\u0000/g, (_, value: string) => code[Number(value)] ?? '');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('`', '&#96;');
}
