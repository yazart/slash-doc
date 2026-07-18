import Underline from '@editorjs/underline';
import { LUCIDE_ICONS } from './lucide-icons';

export default class LucideUnderline extends Underline {
  get toolboxIcon(): string {
    return LUCIDE_ICONS.underline;
  }
}
