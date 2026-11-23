# Change IT

Fast, self-hosted image compression and format conversion in a single Node.js monolith. Drop in images or PDFs, choose an output format and compression level, and download the results individually or as a batch ZIP.

## Features

- **Image to image:** JPG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, and GIF inputs converted to JPG, PNG, WebP, AVIF, or TIFF.
- **Images to PDF:** Pack one or many images into a single multi-page PDF with Original, A4, or Letter page sizing.
- **PDF to images:** Render PDF pages to JPG, PNG, WebP, AVIF, or TIFF. Multi-page results download as a ZIP.
- **Resolution-preserving presets:** Low, Medium, and High compression reduce file size without changing `width × height` unless the optional resize controls are enabled.
- **Per-file overrides:** Convert one file to WebP and another to PDF in the same batch.
- **Before/after comparison:** Interactive visual diff slider plus resolution, file size, savings, and processing time for every result.
- **Safety by default:** Magic-byte file validation, 50 MB per-file limit, 20 files per batch, capped concurrency, ephemeral temp storage, and automatic cleanup.
- **One deployable unit:** Fastify serves the built React client in production.

## Supported Formats

| Direction | Formats |
| --- | --- |
| Input | JPG, JPEG, PNG, WebP, AVIF, HEIC, HEIF, TIFF, GIF, PDF |
| Output | JPG, JPEG, PNG, WebP, AVIF, TIFF, PDF |

HEIC/HEIF **input** is decoded through `heic-convert`. HEIC/HEIF **output** is not supported by the bundled runtime; requesting it returns a clear `UNSUPPORTED_OUTPUT_FORMAT` error.

## Requirements

- Node.js **>= 22.13.0**
- npm 10+
- Optional: Docker

## Quick Start

```bash
npm install
cp .env.example .env   # optional, on Windows: copy .env.example .env
npm run dev
```

- Frontend (Vite): `http://localhost:5173`
- Backend (Fastify): `http://localhost:3000`
- Vite proxies `/api` to the backend during development.

The server loads `.env` automatically when present. Existing environment variables take precedence over values in the file, so production overrides remain unchanged.

### Production Build

```bash
npm run build
npm start
```

The Fastify server serves the compiled React client and API from `http://localhost:3000`.

### Docker

```bash
docker build -t change-it .
docker run --rm -p 3000:3000 change-it
```

The container runs as the non-root `node` user with `NODE_ENV=production`.

## Continuous Delivery

The workflow at `.github/workflows/release.yml` runs only on pushes to `master`:

1. Installs dependencies, type-checks, runs tests, and builds both server and client.
2. Builds and pushes the Docker image to `ghcr.io/escape-dev/change-it` with `latest` and `sha-<short>` tags, plus `v<version>` when a new release is created.
3. Creates the GitHub Release `v<version>` when that release does not already exist.

To publish a new release, bump `version` in `package.json` and push to `master`. Pushing without a version bump refreshes the `latest` and commit-SHA image tags but does not create another release.

```bash
docker pull ghcr.io/escape-dev/change-it:latest
```

The workflow uses the repository `GITHUB_TOKEN` with `contents: write` and `packages: write`; no extra secrets are required. If publishing is blocked, ensure repository Actions settings permit read/write workflow token access. GHCR packages are private by default, so adjust package visibility in GitHub if anonymous pulls are desired.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start backend and Vite client concurrently |
| `npm run dev:server` | Start the Fastify backend with hot reload |
| `npm run dev:client` | Start the Vite client |
| `npm run build` | Type-check/build the server and build the client |
| `npm run build:server` | Compile the server to `server/dist` |
| `npm run build:client` | Build the client to `client/dist` |
| `npm run typecheck` | Type-check server and client |
| `npm test` | Run the unit test suite |
| `npm start` | Run the compiled production server |
| `npm run clean` | Remove server and client build output |

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | Set to `production` for JSON logs and static serving |
| `CHANGE_IT_TMP_DIR` | OS temp dir + `/change-it` | Ephemeral workspace root |
| `MAX_CONCURRENT_CONVERSIONS` | `3` | Maximum concurrent CPU-heavy conversion jobs |

Upload limits, PDF page caps, resize bounds, and cleanup timing are defined in `server/src/config.ts`.

## Compression Presets

All presets preserve the source pixel dimensions by default.

| Preset | JPEG | WebP | AVIF | PNG | TIFF |
| --- | --- | --- | --- | --- | --- |
| Low | q88, mozjpeg, progressive, 4:4:4 | q88, effort 4 | q82, effort 3 | level 6, full color | LZW |
| Medium | q76, mozjpeg, progressive, 4:2:0 | q76, effort 4 | q68, effort 4 | level 8, palette q80, dither 0.5 | Deflate |
| High | q62, mozjpeg, progressive, 4:2:0 | q62, effort 5 | q52, effort 4 | level 9, palette q65, 128 colors | JPEG q62 |

An optional, collapsed **Resize dimensions** control scales output to fit within a maximum width/height while preserving aspect ratio. It is off by default.

## API

### `POST /api/convert`

Multipart form data:

- `options` — JSON string (append this field before the files).
- `files` — one or more file parts, up to 20.

Example options:

```json
{
  "targetFormat": "webp",
  "compression": "medium",
  "pageFit": "original",
  "resize": null,
  "perFile": [
    { "targetFormat": "png", "compression": "high" },
    null
  ]
}
```

`perFile` is aligned with the order of the uploaded files. Use `null` or omit entries to inherit global settings. Resize values are whole numbers between 16 and 20000 pixels.

Example response:

```json
{
  "jobId": "32e6f0b2-...",
  "results": [
    {
      "id": "9a5f...",
      "kind": "image",
      "fileName": "photo.webp",
      "sources": ["photo.heic"],
      "inputFormat": "heic",
      "outputFormat": "webp",
      "compression": "medium",
      "originalSize": 5242880,
      "outputSize": 1048576,
      "savedPercent": 80,
      "width": 1920,
      "height": 1080,
      "originalWidth": 1920,
      "originalHeight": 1080,
      "resolutionPreserved": true,
      "durationMs": 420,
      "downloadUrl": "/api/download/32e6f0b2-.../file/9a5f..."
    }
  ],
  "errors": []
}
```

PDF-to-image results include `pages`, `downloads`, and a group ZIP `downloadUrl` when there is more than one page. Image-to-PDF results include the combined source count and PDF download URL.

Errors use a structured shape:

```json
{
  "error": {
    "code": "UNSUPPORTED_TYPE",
    "message": "This file type is not supported.",
    "fileName": "fake.jpg",
    "errors": []
  }
}
```

Common status codes: `400` invalid options/upload, `413` file too large, `415` unsupported input/output, `422` processing failure, `500` internal error.

### `GET /api/health`

Returns service status, uptime, active job count, configured limits, and supported formats.

### Download endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/download/:jobId/all` | Download every output as a ZIP |
| `GET /api/download/:jobId/group/:groupId?name=...` | Download one multi-page result group as a ZIP |
| `GET /api/download/:jobId/file/:fileId` | Download one output file |

Download links are ephemeral. Downloading the batch ZIP removes the workspace immediately; otherwise files expire after 20 minutes.

## Architecture

```text
change-it/
├── AGENT.md
├── Dockerfile
├── package.json
├── tsconfig.json
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── settings/          # Format, compression, advanced controls
│       │   ├── CompareSlider.tsx
│       │   ├── Dropzone.tsx
│       │   ├── ResultCard.tsx
│       │   └── ...
│       ├── hooks/                 # File queue, clipboard paste, conversion
│       ├── lib/                   # API client, payload builder, formatting
│       └── types/
└── server/
    ├── tsconfig.build.json
    └── src/
        ├── app.ts                 # Fastify app factory
        ├── index.ts               # Bootstrap and graceful shutdown
        ├── config.ts
        ├── routes/
        │   ├── convert.ts
        │   ├── download.ts
        │   └── health.ts
        ├── services/
        │   ├── uploadService.ts
        │   ├── conversionPlan.ts
        │   ├── conversionService.ts
        │   ├── converters/
        │   │   ├── imageToImage.ts
        │   │   ├── imagesToPdf.ts
        │   │   └── pdfToImages.ts
        │   ├── imageProcessor.ts
        │   ├── heicProcessor.ts
        │   ├── pdfProcessor.ts
        │   ├── zipService.ts
        │   └── options.ts
        ├── jobs/                  # p-limit queue, job store, cron cleanup
        ├── middleware/
        ├── types/
        └── utils/
```

### Processing Pipeline

1. Uploads stream to a scoped temp directory under `CHANGE_IT_TMP_DIR`.
2. `file-type` validates the real format using magic bytes.
3. Conversions are scheduled through `p-limit` (3 concurrent by default).
4. Images are processed with `sharp`; HEIC is decoded first.
5. PDFs are assembled with `pdf-lib`, or rendered with `pdfjs-dist` + `@napi-rs/canvas`.
6. Outputs are written to the job’s output directory and registered in memory.
7. Input files are deleted immediately after the conversion request.
8. Outputs remain available for 20 minutes; a `node-cron` sweep runs every 5 minutes.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

The test suite covers option parsing, format normalization, conversion utilities, client payload validation, and formatting helpers. Production builds exclude test files through `server/tsconfig.build.json`.

## Operational Notes

- The job registry is in-memory. After a server restart, existing download links expire; files are removed by the cleanup sweep.
- PDF rendering defaults to 150 DPI with a maximum edge of 4000 px and at most 50 pages per PDF.
- PDF input cannot target PDF output; choose an image format to render pages.
- File extensions are never trusted for validation; actual binary headers are inspected.
- Batch downloads are generated with `yazl` streaming, so large batches are not loaded into memory.
