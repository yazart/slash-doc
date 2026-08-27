export type PageBlock = { id?: string; type?: string; data?: unknown; [key: string]: unknown };
export type PageBlockDiffStatus = 'unchanged' | 'added' | 'modified' | 'removed';
export type PageBlockDiffEntry = { block: PageBlock; status: PageBlockDiffStatus; previousBlock?: PageBlock };

export function diffPageBlocks(previous: unknown, next: unknown): PageBlockDiffEntry[] {
  const left = readBlocks(previous);
  const right = readBlocks(next);
  const rows = left.length + 1;
  const columns = right.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let index = 0; index < rows; index += 1) costs[index][0] = index;
  for (let index = 0; index < columns; index += 1) costs[0][index] = index;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      costs[row][column] = Math.min(
        costs[row - 1][column] + 1,
        costs[row][column - 1] + 1,
        costs[row - 1][column - 1] + substitutionCost(left[row - 1], right[column - 1]),
      );
    }
  }

  const result: PageBlockDiffEntry[] = [];
  let row = left.length;
  let column = right.length;
  while (row > 0 || column > 0) {
    const pairCost = row && column ? substitutionCost(left[row - 1], right[column - 1]) : Number.POSITIVE_INFINITY;
    if (row > 0 && column > 0 && costs[row][column] === costs[row - 1][column - 1] + pairCost) {
      result.push({
        block: right[column - 1],
        status: pairCost === 0 ? 'unchanged' : 'modified',
        previousBlock: pairCost === 0 ? undefined : left[row - 1],
      });
      row -= 1;
      column -= 1;
    } else if (column > 0 && costs[row][column] === costs[row][column - 1] + 1) {
      result.push({ block: right[column - 1], status: 'added' });
      column -= 1;
    } else {
      result.push({ block: left[row - 1], status: 'removed' });
      row -= 1;
    }
  }
  return result.reverse();
}

function substitutionCost(left: PageBlock, right: PageBlock): number {
  if (stableValue(left) === stableValue(right)) return 0;
  if (left.id && right.id) return left.id === right.id ? 1 : 3;
  return left.type === right.type ? 1 : 3;
}

function readBlocks(value: unknown): PageBlock[] {
  if (!isRecord(value) || !Array.isArray(value.blocks)) return [];
  return value.blocks.filter(isRecord);
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`)
    .join(',')}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
