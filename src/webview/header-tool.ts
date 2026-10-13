import PersistentParagraphTool from './persistent-paragraph-tool';
import type { BlockToolConstructorOptions } from './block-editor-types';
import { textHeadingLevel } from '../shared/text-block';

/** Legacy addon/API alias; the editor stores new headings as text blocks. */
export default class HeaderTool extends PersistentParagraphTool {
  constructor(options: BlockToolConstructorOptions) {
    super({
      ...options,
      data: {
        ...options.data,
        text: typeof options.data.text === 'string' ? options.data.text : '',
        level: textHeadingLevel({ type: 'header', data: options.data }),
      },
    });
  }
}
