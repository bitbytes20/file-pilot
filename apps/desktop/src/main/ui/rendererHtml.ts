import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const baseStyles = `
  :root {
    color-scheme: dark;
    font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0f1115;
    color: #f5f7fa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: linear-gradient(180deg, #0f1115 0%, #161a22 100%);
  }
  #app { min-height: 100vh; }
`;

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export const buildRendererHtml = async (rendererBundlePath: string): Promise<string> => {
  const script = await readFile(rendererBundlePath, 'utf8');
  const scriptHash = createHash('sha256').update(script).digest('base64');
  const csp = [
    "default-src 'none'",
    `script-src 'sha256-${scriptHash}'`,
    "style-src 'unsafe-inline'",
    'img-src data:',
    "connect-src 'none'",
    'font-src data:',
  ].join('; ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FilePilot</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">${script}</script>
  </body>
</html>`;
};
