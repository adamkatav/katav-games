# Embeds art/*.png into index.html as base64 data URIs, so the page is one
# self-contained file that works offline from a double-clicked local copy.
# Re-run this whenever the artwork in art/ changes.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$html = Join-Path $root 'index.html'

$parts = @()
foreach ($name in 'king','queen','jack','back','crest') {
  $png = Join-Path $root "art\$name.png"
  if (-not (Test-Path $png)) { throw "missing $png" }
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($png))
  $parts += '{0}:"data:image/png;base64,{1}"' -f $name, $b64
  "{0,-6} {1,5} KB" -f $name, [int]((Get-Item $png).Length / 1KB)
}

$line = '<script id="art-data">window.ART={' + ($parts -join ',') + '};</script>'

$text = [IO.File]::ReadAllText($html)
$pattern = '(?s)<script id="art-data">.*?</script>'
if ($text -notmatch $pattern) { throw 'art-data script tag not found in index.html' }
$text = [Text.RegularExpressions.Regex]::Replace($text, $pattern, { $line })
[IO.File]::WriteAllText($html, $text, (New-Object Text.UTF8Encoding $false))

"index.html now {0} KB" -f [int]((Get-Item $html).Length / 1KB)
