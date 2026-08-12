import { describe, expect, it } from 'vitest';
import { importedCodeLanguage } from '../src/extension/document-import-readers';
import { highlightSource, normalizeCodeLanguage } from '../src/shared/syntax-highlighter';

describe('PlantUML syntax highlighting', () => {
  it('is available as a code block language', () => {
    expect(normalizeCodeLanguage('plantuml')).toBe('plantuml');
    expect(importedCodeLanguage('puml')).toBe('plantuml');
    expect(importedCodeLanguage('iuml')).toBe('plantuml');
  });

  it('highlights directives, entities, strings, arrows, and comments', () => {
    const html = highlightSource(
      `@startuml\nactor User\nparticipant "API"\nUser -> "API": Request\n' comment\n@enduml`,
      'plantuml',
    );

    expect(html).toContain('hljs-meta');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('hljs-string');
    expect(html).toContain('hljs-symbol');
    expect(html).toContain('hljs-comment');
  });
});
