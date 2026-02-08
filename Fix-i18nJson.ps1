# Fix-i18nJson.ps1
# Recursively fixes JSON translation files under src/messages/ so they begin with '{' and contain no BOM.
# Compatible with Windows PowerShell 5.1
# - Removes UTF-8 BOM if present
# - Removes any bytes/chars before the first '{'
# - Rewrites as UTF-8 (no BOM)
# - Validates JSON using ConvertFrom-Json
# - Prints list of modified files

$ErrorActionPreference = "Stop"

$root = Join-Path (Get-Location) "src/messages"
if (-not (Test-Path -LiteralPath $root)) {
  throw "Root folder not found: $root"
}

# Strict UTF-8 decoder (throws on invalid bytes)
$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
# UTF-8 encoder without BOM (for writing)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$modified = New-Object System.Collections.Generic.List[string]
$failed = New-Object System.Collections.Generic.List[string]

$files = Get-ChildItem -LiteralPath $root -Recurse -File -Filter *.json

foreach ($f in $files) {
  try {
    $path = $f.FullName
    $originalBytes = [System.IO.File]::ReadAllBytes($path)

    if ($originalBytes.Length -eq 0) {
      throw "Empty file"
    }

    # Remove UTF-8 BOM if present
    $start = 0
    if ($originalBytes.Length -ge 3 -and
        $originalBytes[0] -eq 0xEF -and
        $originalBytes[1] -eq 0xBB -and
        $originalBytes[2] -eq 0xBF) {
      $start = 3
    }

    # Find first '{'
    $braceIndex = -1
    for ($i = $start; $i -lt $originalBytes.Length; $i++) {
      if ($originalBytes[$i] -eq 0x7B) {
        $braceIndex = $i
        break
      }
    }

    if ($braceIndex -lt 0) {
      throw "No '{' found"
    }

    # Strip everything before first '{'
    $candidateBytes = $originalBytes[$braceIndex..($originalBytes.Length - 1)]

    # Decode strictly
    $jsonText = $utf8Strict.GetString($candidateBytes)

    if ($jsonText.Length -eq 0 -or $jsonText[0] -ne '{') {
      throw "After cleanup, first character is not '{'"
    }

    # ✅ JSON validation (PowerShell 5.1 compatible)
    try {
      $null = $jsonText | ConvertFrom-Json
    } catch {
      throw "JSON parse failed: $($_.Exception.Message)"
    }

    # Rewrite as UTF-8 without BOM
    $newBytes = $utf8NoBom.GetBytes($jsonText)

    # Detect change
    $changed = $false
    if ($newBytes.Length -ne $originalBytes.Length) {
      $changed = $true
    } else {
      for ($i = 0; $i -lt $newBytes.Length; $i++) {
        if ($newBytes[$i] -ne $originalBytes[$i]) {
          $changed = $true
          break
        }
      }
    }

    if ($changed) {
      [System.IO.File]::WriteAllBytes($path, $newBytes)
      $modified.Add($path) | Out-Null
    }

  } catch {
    $failed.Add("$($f.FullName) - $($_.Exception.Message)") | Out-Null
  }
}

if ($modified.Count -gt 0) {
  "Modified files:"
  $modified | Sort-Object
} else {
  "Modified files:"
  "(none)"
}

if ($failed.Count -gt 0) {
  ""
  "Failed files:"
  $failed
  exit 1
}

exit 0
