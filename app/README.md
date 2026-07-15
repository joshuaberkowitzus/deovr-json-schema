# DeoVR JSON Converter App

A small web app that converts VRPorn.com API JSON responses into the [DeoVR JSON format](https://deovr.com/app/doc) defined in this repository.

## How it works

The app reads a VRPorn.com API JSON payload and maps it to a `SingleVideoJson` object (as defined in `../index.ts`):

| Source field | DeoVR field | Notes |
|---|---|---|
| `data.item.name` | `title` | |
| `data.item.id` | `id` | UUID hashed to integer |
| `data.item.previewImage.path` | `thumbnailUrl` | |
| `data.item.time` | `videoLength` | seconds |
| `data.item.description` | `description` | |
| `data.item.publishedAt` | `date` | unix timestamp |
| `data.item.shortVideo.path` | `videoPreview` | |
| `data.item.sources.free.*` | `encodings[0]` (name: "free") | free-tier sources |
| `data.item.sources.paid.*` | `encodings[1]` (name: "paid") | paid-tier sources |
| category slug `180` | `screenType: "dome"`, `viewAngle: 180` | |
| category slug `360` | `screenType: "sphere"`, `viewAngle: 360` | |
| category slug `3d` | `id3d: true`, `stereoMode: "sbs"` | |
| category slug `60-fps` | `fps: 60` | |

## Running

```sh
# Install dependencies
cd app
npm install

# Start the server (default port 3000)
npm start

# Or set a custom port
PORT=8080 npm start
```

Then open http://localhost:3000 in your browser.

## Usage

### Web UI

Navigate to `http://localhost:3000` and paste a VRPorn.com API JSON URL into the input field, then click **Convert**. The page will display:

- A video summary (thumbnail, title, metadata badges)
- A table of video sources grouped by encoding
- The full DeoVR JSON output (with a Copy button)

### REST API

POST raw source JSON to `/convert` to receive the DeoVR JSON directly:

```sh
curl -X POST http://localhost:3000/convert \
  -H "Content-Type: application/json" \
  -d @source.json
```
