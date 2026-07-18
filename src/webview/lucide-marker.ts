import Marker from '@editorjs/marker';
import { LUCIDE_ICONS } from './lucide-icons';

export default class LucideMarker extends Marker {
  get toolboxIcon(): string {
    return LUCIDE_ICONS.highlighter;
  }
}
