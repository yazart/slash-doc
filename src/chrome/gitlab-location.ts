export type GitLabPageLocation = {
  origin: string;
  projectPath: string;
  ref: string;
  filePath: string;
  pageId: string;
};

export function getGitLabPageLocation(href: string): GitLabPageLocation | undefined {
  try {
    const url = new URL(href);
    if (!['http:', 'https:'].includes(url.protocol)) return;
    const marker = '/-/edit/';
    const index = url.pathname.indexOf(marker);
    if (index < 1) return;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    const match = /^(.+?)\/(\.slash-doc\/(?:[^/]+\/)+content\.yaml)$/.exec(path);
    if (!match) return;
    return {
      origin: url.origin,
      projectPath: url.pathname.slice(0, index),
      ref: match[1],
      filePath: match[2],
      pageId: match[2].split('/').at(-2) ?? '',
    };
  } catch {
    return;
  }
}

export function getRawFileUrl(location: GitLabPageLocation, filePath: string): string {
  const path = filePath.split('/').map(encodeURIComponent).join('/');
  return `${location.origin}${location.projectPath}/-/raw/${encodeURIComponent(location.ref)}/${path}`;
}
