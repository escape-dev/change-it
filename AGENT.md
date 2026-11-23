# AGENT.md — Change IT Engineering & Coding Guidelines

## Project Overview

**Change IT** is a Node.js TypeScript monolith web application for fast image compression and multi-format file conversion (`JPG`, `JPEG`, `PNG`, `WebP`, `AVIF`, `HEIC`, `PDF`, `TIFF`, `GIF`).

## Architectural Invariants (Do Not Break)

1. **Monolith Simplicity:** Keep frontend and backend inside one Node.js deployable unit. Do not introduce microservices, external message brokers (Redis/RabbitMQ), or external cloud storage dependencies unless explicitly requested.
2. **Resolution Preservation by Default:** The `Low`, `Medium`, and `High` compression presets MUST NOT alter the input image's `width` or `height`. Dimension scaling may only occur when the user explicitly sets custom resize dimensions.
3. **Stream & Memory Safety:** Never load large batches unbounded into memory. Always route heavy image/PDF tasks through the `p-limit` concurrency limiter and clean up temporary files in `try / finally` blocks.
4. **Magic-Byte Validation:** Always inspect binary headers (`file-type`) rather than trusting `file.originalname` extensions.

## Compression Preset Contract (`server/src/services/imageProcessor.ts`)

- **`low`**: High fidelity (`quality ~88`), `mozjpeg` enabled, `4:4:4` chroma subsampling for JPEG, lossless/full-depth PNG.
- **`medium`** _(default)_: Balanced (`quality ~76`), `mozjpeg` enabled, `4:2:0` chroma subsampling for JPEG, adaptive PNG palette quantization (`quality: 80`).
- **`high`**: Maximum byte reduction (`quality ~62`), `mozjpeg` enabled, aggressive PNG palette quantization (`colours: 128`, `quality: 65`), AVIF effort capped at `<= 4` to protect render speed.

## Coding Conventions

- **Language:** Strict TypeScript (`strict: true`) across both `client/` and `server/`.
- **Error Handling:** Return structured JSON errors `{ error: { code, message, fileName? } }` with appropriate HTTP status codes (`400`, `413`, `415`, `500`).
- **Performance:** Prefer `sharp` pipelines over spawning child processes. Reuse buffers/streams cleanly and log per-file processing duration in milliseconds.

## Verification Checklist Before Completing Tasks

- [ ] Verify `JPG`, `PNG`, `WebP`, `AVIF`, `HEIC`, and `PDF` inputs all convert without unhandled rejections.
- [ ] Verify output pixel dimensions (`width × height`) match input dimensions across `low`, `medium`, and `high` compression when resize is disabled.
- [ ] Verify temporary files are deleted after request completion and via scheduled cleanup.
- [ ] Run TypeScript typecheck (`npm run typecheck`) and unit tests (`npm test`) cleanly.
- [ ] Run the production build (`npm run build`) cleanly.
