import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function loadAppHtml(): void {
  const html = readFileSync(join(WEB_ROOT, 'index.html'), 'utf-8');
  const bodyMatch = /<body>([\s\S]*?)<\/body>/i.exec(html);
  if (!bodyMatch?.[1]) {
    throw new Error('Could not parse index.html body');
  }
  const bodyContent = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');
  document.body.innerHTML = bodyContent;

  const headMatch = /<head>([\s\S]*?)<\/head>/i.exec(html);
  if (headMatch?.[1]) {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(headMatch[1]);
    if (titleMatch?.[1]) {
      document.title = titleMatch[1];
    }
  }
}
