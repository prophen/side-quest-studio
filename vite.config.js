import { defineConfig } from "vite";

// Open Graph URLs need the public origin:
//   VITE_SITE_URL=https://sidequest.example npm run build   (no trailing slash)
// Unset, they fall back to relative paths, which some link previews ignore.
process.env.VITE_SITE_URL ??= "";

export default defineConfig({});
