# Preflight (Encoding & Syntax Guard)

Run before push/deploy to prevent Arabic/encoding regressions.

## Command

node tools/preflight.js

## What it checks

- UTF-8 BOM exists on HTML files
- <meta charset="UTF-8"> exists
- No replacement characters (?)
- No illegal U+00A7 (?)
- No unquoted Arabic keys in JS object literals
