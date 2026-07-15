import express, { Request, Response } from "express";
import fetch from "node-fetch";
import { parseSourceToDeoVR, SourceJson, SingleVideoJson } from "./parser";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json({ limit: "10mb" }));

/** Build the HTML page showing input summary and DeoVR JSON output. */
function renderPage(opts: {
  deovrJson?: SingleVideoJson;
  error?: string;
  sourceUrl?: string;
  inputJson?: object;
}): string {
  const { deovrJson, error, sourceUrl, inputJson } = opts;

  const deovrOutput = deovrJson ? JSON.stringify(deovrJson, null, 2) : null;
  const encodingsSummary = deovrJson
    ? deovrJson.encodings
        .map(
          (e) =>
            `<tr>
              <td>${escapeHtml(e.name)}</td>
              <td>${e.videoSources.length} source(s): ${e.videoSources
                .map((s) => `${s.resolution}p`)
                .join(", ")}</td>
            </tr>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DeoVR JSON Converter</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      margin: 0;
      padding: 0;
    }
    header {
      background: #1a1a2e;
      padding: 1.5rem 2rem;
      border-bottom: 2px solid #4a90e2;
    }
    header h1 { margin: 0; font-size: 1.6rem; color: #4a90e2; }
    header p { margin: 0.25rem 0 0; color: #999; font-size: 0.9rem; }
    main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
    .card {
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #4a90e2; }
    form { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    input[type="text"] {
      flex: 1;
      min-width: 200px;
      padding: 0.6rem 0.9rem;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #e0e0e0;
      font-size: 0.9rem;
    }
    button {
      padding: 0.6rem 1.4rem;
      background: #4a90e2;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
    }
    button:hover { background: #357abd; }
    .error {
      background: #2d1010;
      border: 1px solid #a33;
      color: #f88;
      padding: 1rem;
      border-radius: 6px;
    }
    .video-summary { display: flex; gap: 1.5rem; align-items: flex-start; }
    .video-summary img {
      width: 240px;
      height: 135px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #333;
      flex-shrink: 0;
    }
    .video-meta { flex: 1; }
    .video-meta h3 { margin: 0 0 0.5rem; font-size: 1.2rem; color: #fff; }
    .video-meta p { margin: 0.25rem 0; color: #999; font-size: 0.88rem; }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 0.78rem;
      font-weight: 600;
      margin: 0.2rem 0.2rem 0 0;
      background: #2a3a4a;
      color: #7ab8ff;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    table th, table td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid #2a2a2a;
    }
    table th { color: #888; font-weight: 600; }
    pre {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.82rem;
      line-height: 1.5;
      color: #c3e88d;
      max-height: 500px;
    }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .tab-btn {
      padding: 0.4rem 1rem;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px 6px 0 0;
      color: #aaa;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .tab-btn.active { background: #4a90e2; color: #fff; border-color: #4a90e2; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .copy-btn {
      float: right;
      margin-top: -0.25rem;
      padding: 0.3rem 0.8rem;
      font-size: 0.78rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>🎬 DeoVR JSON Converter</h1>
    <p>Convert VRPorn.com API JSON to DeoVR JSON format</p>
  </header>
  <main>
    <div class="card">
      <h2>Source JSON URL</h2>
      <form method="GET" action="/">
        <input
          type="text"
          name="url"
          placeholder="Paste a VRPorn.com API JSON URL…"
          value="${escapeHtml(sourceUrl ?? "")}"
        />
        <button type="submit">Convert</button>
      </form>
      <p style="margin:0.75rem 0 0; color:#666; font-size:0.82rem;">
        Or POST raw JSON to <code>/convert</code> to receive the DeoVR JSON response directly.
      </p>
    </div>

    ${
      error
        ? `<div class="error"><strong>Error:</strong> ${escapeHtml(error)}</div>`
        : ""
    }

    ${
      deovrJson
        ? `
    <div class="card">
      <h2>Video Summary</h2>
      <div class="video-summary">
        ${deovrJson.thumbnailUrl ? `<img src="${escapeHtml(deovrJson.thumbnailUrl)}" alt="thumbnail" loading="lazy" />` : ""}
        <div class="video-meta">
          <h3>${escapeHtml(deovrJson.title ?? "(untitled)")}</h3>
          <p>${deovrJson.description ? escapeHtml(deovrJson.description.slice(0, 240)) + (deovrJson.description.length > 240 ? "…" : "") : ""}</p>
          <p>
            ${deovrJson.screenType ? `<span class="badge">${escapeHtml(deovrJson.screenType)}</span>` : ""}
            ${deovrJson.viewAngle ? `<span class="badge">${deovrJson.viewAngle}°</span>` : ""}
            ${deovrJson.id3d ? `<span class="badge">3D</span>` : ""}
            ${deovrJson.stereoMode ? `<span class="badge">${escapeHtml(deovrJson.stereoMode)}</span>` : ""}
            ${deovrJson.fps ? `<span class="badge">${deovrJson.fps} FPS</span>` : ""}
            ${deovrJson.videoLength ? `<span class="badge">${formatDuration(deovrJson.videoLength)}</span>` : ""}
          </p>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Video Sources</h2>
      <table>
        <thead><tr><th>Encoding</th><th>Resolutions</th></tr></thead>
        <tbody>${encodingsSummary}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>
        DeoVR JSON Output
        <button class="copy-btn" onclick="copyJson()">Copy</button>
      </h2>
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab(event,'deovr')">DeoVR JSON</button>
        ${inputJson ? `<button class="tab-btn" onclick="switchTab(event,'source')">Source JSON</button>` : ""}
      </div>
      <div id="tab-deovr" class="tab-content active">
        <pre id="deovr-json">${escapeHtml(deovrOutput ?? "")}</pre>
      </div>
      ${
        inputJson
          ? `<div id="tab-source" class="tab-content">
        <pre>${escapeHtml(JSON.stringify(inputJson, null, 2).slice(0, 50000))}</pre>
      </div>`
          : ""
      }
    </div>
    `
        : ""
    }
  </main>

  <script>
    var _deovrJson = ${deovrOutput ? JSON.stringify(deovrOutput) : "null"};
    function copyJson() {
      if (!_deovrJson) return;
      navigator.clipboard.writeText(_deovrJson).then(() => {
        var btn = document.querySelector('.copy-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy'; }, 1500); }
      });
    }
    function switchTab(e, id) {
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
      e.currentTarget.classList.add('active');
      var el = document.getElementById('tab-' + id);
      if (el) el.classList.add('active');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Validate that a URL uses only http or https and points to a public host.
 * Returns the parsed URL object on success, or an error message string on failure.
 * Using the parsed URL object ensures the fetch call uses a normalized, sanitized URL.
 */
function validateSourceUrl(urlString: string): URL | string {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return "Invalid URL format.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http and https URLs are allowed.";
  }
  const hostname = parsed.hostname.toLowerCase();
  // Reject requests to loopback, link-local, and private-network addresses
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return "Requests to private or loopback addresses are not allowed.";
  }
  return parsed;
}

/** GET / — render the converter UI, optionally fetching a ?url= */
app.get("/", async (req: Request, res: Response) => {
  const sourceUrl = typeof req.query.url === "string" ? req.query.url.trim() : undefined;

  if (!sourceUrl) {
    res.send(renderPage({}));
    return;
  }

  let raw: object | undefined;
  let deovrJson: SingleVideoJson | undefined;
  let error: string | undefined;

  const validated = validateSourceUrl(sourceUrl);
  if (typeof validated === "string") {
    error = validated;
  } else {
    // Use the normalized URL object (not raw user input) to prevent request forgery
    try {
      const response = await fetch(validated, {
        headers: { "User-Agent": "deovr-json-converter/1.0" },
      });
      if (!response.ok) {
        error = `HTTP ${response.status} ${response.statusText} from source URL`;
      } else {
        raw = (await response.json()) as object;
        deovrJson = parseSourceToDeoVR(raw as SourceJson);
      }
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  res.send(renderPage({ deovrJson, error, sourceUrl, inputJson: raw }));
});

/** POST /convert — accept raw source JSON body, return DeoVR JSON */
app.post("/convert", (req: Request, res: Response) => {
  try {
    const source = req.body as SourceJson;
    const deovrJson = parseSourceToDeoVR(source);
    res.json(deovrJson);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`DeoVR JSON Converter running at http://localhost:${PORT}`);
});
