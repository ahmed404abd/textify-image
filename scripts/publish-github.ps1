# Push and release (run in your terminal after `gh auth login` as ahmed404abd)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

git remote set-url origin https://github.com/ahmed404abd/textify-image.git
git push -u origin main

if (-not (Test-Path "textify-image-0.1.0.vsix")) {
  npm run compile
  npx vsce package
}

gh release create v0.1.0 textify-image-0.1.0.vsix `
  --repo ahmed404abd/textify-image `
  --title "v0.1.0" `
  --notes "Initial release of Textify Image — sidebar panel OCR with Tesseract.js (offline, no API keys)."

Write-Host "Done. GitHub release created."
