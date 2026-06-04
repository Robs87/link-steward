# Link Steward OneNav Browser Extension

Chrome / Edge extension for a self-hosted Link Steward OneNav instance.

## Install Unpacked

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Enable developer mode.
3. Choose "Load unpacked".
4. Select this directory:

```text
apps/extension
```

## Settings

Open the extension settings tab and fill:

- API domain: your OneNav URL, for example `http://192.168.31.190:3088`
- API Token: generated in OneNav admin, under system settings / get API

The extension can list categories, search links, add the current page, and save
links as private or public.

## Build Zip

```bash
node scripts/build-extension-zip.mjs
```

The archive is written to:

```text
dist/link-steward-onenav-extension.zip
```
