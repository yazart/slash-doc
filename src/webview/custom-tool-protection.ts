import type { ToolConstructable } from '@editorjs/editorjs/types/tools';

export type CustomAddonModule = { id: string; toolName: string; uri: string };
export type CustomBlockTool = { render(...args: unknown[]): HTMLElement };
export type CustomBlockToolConstructor = new (...args: any[]) => CustomBlockTool;

export function protectCustomTool(tool: CustomBlockToolConstructor, addon: CustomAddonModule): ToolConstructable {
  return class ProtectedCustomTool extends tool {
    override render(...args: unknown[]): HTMLElement {
      const root = super.render(...args);
      root.dataset.slashDocCustomAddon = addon.id;
      root.addEventListener('keydown', stopCustomBlockDeletion);
      return root;
    }
  } as unknown as ToolConstructable;
}

function stopCustomBlockDeletion(event: KeyboardEvent): void {
  if (event.key === 'Backspace') event.stopPropagation();
}
