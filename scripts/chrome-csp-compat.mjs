// Keep pinned legacy libraries compatible with Manifest V3 without changing
// their installed files or the VS Code build.
export function chromeCspCompat() {
  return {
    name: 'slash-doc-chrome-csp-compat',
    enforce: 'pre',
    transform(source, id) {
      if (!id.includes('/node_modules/')) return;
      let code = source.replaceAll(
        /Function\((['"])r\1,\s*(['"])regeneratorRuntime = r\2\)/g,
        '(function(r){globalThis.regeneratorRuntime=r})',
      );
      code = code.replaceAll(/(?:new )?Function\((['"])return this\1\)\(\)/g, 'globalThis');
      if (id.includes('/mermaid/dist/mermaid.esm.min.mjs')) {
        const converter =
          'function mo(t){return new Function("d","return {"+t.map((function(t,e){return JSON.stringify(t)+": d["+e+\'] || ""\'})).join(",")+"}")}';
        if (!code.includes(converter))
          throw new Error('Mermaid CSV converter changed; review Chrome CSP compatibility.');
        code = code.replace(
          converter,
          'function mo(t){return function(d){return Object.fromEntries(t.map(function(key,index){return [key,d[index]||""]}))}}',
        );
      }
      return code === source ? undefined : { code, map: null };
    },
  };
}
