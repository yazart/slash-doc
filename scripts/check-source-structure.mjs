import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const sourceRoot = path.resolve('src');
const maxLines = 400;

const collectTypeScriptFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(entryPath);
      }
      return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
    }),
  );
  return nestedFiles.flat();
};

const countClasses = (sourceFile) => {
  let count = 0;
  const visit = (node) => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
};

const files = await collectTypeScriptFiles(sourceRoot);
const violations = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const relativePath = path.relative(process.cwd(), file);
  const lineCount = source === '' ? 0 : source.split(/\r?\n/).length;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const classCount = countClasses(sourceFile);

  if (lineCount > maxLines) {
    violations.push(`${relativePath}: ${lineCount} строк (максимум ${maxLines})`);
  }
  if (classCount > 1) {
    violations.push(`${relativePath}: ${classCount} класса (максимум 1)`);
  }
}

if (violations.length > 0) {
  process.stderr.write('Нарушены ограничения структуры исходного кода:\n');
  for (const violation of violations) {
    process.stderr.write(`- ${violation}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Проверено ${files.length} файлов: не более ${maxLines} строк и одного класса.\n`);
}
