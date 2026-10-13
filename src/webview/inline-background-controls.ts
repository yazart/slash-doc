import { createButton } from './confluence-table-inline-utils';
import { LUCIDE_ICONS } from './lucide-icons';

export function createBackgroundControls(
  toolbar: HTMLElement,
  applyText: (color: string) => void,
  clearText: () => void,
): { update(hasSelection: boolean): void } {
  const picker = (title: string, change: (color: string) => void) => {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = '#fef08a';
    input.title = title;
    input.setAttribute('aria-label', title);
    input.addEventListener('change', () => change(input.value));
    return input;
  };
  const textColor = picker('Фон выделения', applyText);
  const textReset = createButton('Убрать фон выделения', LUCIDE_ICONS.x);
  textReset.addEventListener('click', clearText);
  toolbar.append(textColor, textReset);
  return {
    update(hasSelection) {
      textColor.disabled = textReset.disabled = !hasSelection;
    },
  };
}
