# Builds dist/module.zip and dist/module.json for a GitHub release.
# The zip is written with forward-slash paths so it installs on Linux hosts such as The Forge.
$root = $PSScriptRoot
$src = Join-Path $root "sf2e-starship-sheets"
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force $dist | Out-Null

$manifest = Get-Content (Join-Path $src "module.json") -Raw | ConvertFrom-Json
$expected = "https://github.com/WednesdayBryan/sf2e-starship-sheets/releases/download/v$($manifest.version)/module.zip"
if ($manifest.download -ne $expected) { throw "module.json download should be $expected" }

$zip = Join-Path $dist "module.zip"
if (Test-Path $zip) { Remove-Item $zip -Confirm:$false }
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$fs = [IO.File]::Open($zip, "Create")
$archive = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
Get-ChildItem $src -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length + 1).Replace("\", "/")
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel) | Out-Null
}
$archive.Dispose()
$fs.Dispose()
Copy-Item (Join-Path $src "module.json") (Join-Path $dist "module.json") -Force
Write-Output "Built v$($manifest.version): $zip"
