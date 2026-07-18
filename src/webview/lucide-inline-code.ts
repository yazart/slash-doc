import InlineCode from '@editorjs/inline-code';
import { LUCIDE_ICONS } from './lucide-icons';

export default class LucideInlineCode extends InlineCode {
  get toolboxIcon(): string {
    return LUCIDE_ICONS.code;
  }
}
