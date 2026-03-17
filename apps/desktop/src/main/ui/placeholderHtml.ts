const baseStyles = `
  :root {
    font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #e3e3e3;
    background-color: #121212;
  }
  body {
    margin: 0;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .container {
    text-align: center;
  }
  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }
  p {
    margin: 0;
    color: #b5b5b5;
  }
`;

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const buildPlaceholderHtml = (version: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <title>FilePilot</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <div class="container">
      <h1>FilePilot Desktop</h1>
      <p>Version ${escape(version)}</p>
      <p>Renderer shell coming in Tranche B.</p>
    </div>
  </body>
</html>`;
