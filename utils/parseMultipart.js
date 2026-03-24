/**
 * parseMultipart.js
 *
 * Manually parses a multipart/form-data request body without multer or busboy.
 * Returns:  { fields: { key: value }, files: { key: { dataUri, mimeType, filename } } }
 *
 * Works with Node's built-in IncomingMessage (req) stream.
 */

const parseMultipart = (req) => {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      return reject(new Error("Request is not multipart/form-data"));
    }

    // Extract the boundary string from Content-Type header
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return reject(new Error("No boundary found in Content-Type"));

    const boundary = boundaryMatch[1].trim();

    // Collect raw body chunks
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks);

        const fields = {};
        const files = {};

        // Split body by boundary
        const delimiterBuf = Buffer.from(`--${boundary}`);
        const parts = splitBuffer(rawBody, delimiterBuf);

        for (const part of parts) {
          // Skip preamble, epilogue, and empty parts
          if (!part || part.length === 0) continue;

          // Each part: headers + blank line + body
          // Find the double CRLF that separates headers from body
          const headerBodySep = Buffer.from("\r\n\r\n");
          const sepIdx = indexOf(part, headerBodySep);
          if (sepIdx === -1) continue;

          const headerSection = part.slice(0, sepIdx).toString("utf8");
          // Body: strip trailing \r\n added by the boundary
          let bodyBuf = part.slice(sepIdx + 4);
          if (bodyBuf[bodyBuf.length - 2] === 0x0d && bodyBuf[bodyBuf.length - 1] === 0x0a) {
            bodyBuf = bodyBuf.slice(0, -2);
          }

          // Parse Content-Disposition
          const dispositionMatch = headerSection.match(
            /Content-Disposition:\s*form-data;[^;]*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i
          );
          if (!dispositionMatch) continue;

          const fieldName = dispositionMatch[1];
          const filename = dispositionMatch[2]; // undefined for plain fields

          // Parse Content-Type for file parts
          const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
          const mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : null;

          if (filename !== undefined && mimeType) {
            // It's a file — convert buffer to base64 data URI
            const base64 = bodyBuf.toString("base64");
            const dataUri = `data:${mimeType};base64,${base64}`;
            files[fieldName] = { dataUri, mimeType, filename };
          } else {
            // It's a plain text field
            fields[fieldName] = bodyBuf.toString("utf8");
          }
        }

        resolve({ fields, files });
      } catch (err) {
        reject(err);
      }
    });
  });
};

// ── Utility: split a Buffer by a delimiter Buffer ──────────────────────────
function splitBuffer(buf, delimiter) {
  const parts = [];
  let start = 0;

  while (start < buf.length) {
    const idx = indexOf(buf, delimiter, start);
    if (idx === -1) break;
    parts.push(buf.slice(start, idx));
    start = idx + delimiter.length;
    // skip the \r\n after the boundary line
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
    // "--" suffix means it's the closing boundary
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break;
  }

  return parts;
}

// ── Utility: indexOf for Buffers (not available in older Node versions) ─────
function indexOf(buf, search, offset = 0) {
  for (let i = offset; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

// ✅ Correct
export default parseMultipart;