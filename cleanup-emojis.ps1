$replacements = @(
    @{ old = "ðŸ†"; new = "[Trophy]" },
    @{ old = "ðŸŽ™ï¸"; new = "[Microphone]" },
    @{ old = "âœï¸"; new = "[Checkmark]" },
    @{ old = "ðŸ¤–"; new = "[Robot]" },
    @{ old = "âš ï¸"; new = "[Warning]" },
    @{ old = "â°"; new = "[Clock]" },
    @{ old = "â†'"; new = "->" }
)

$files = Get-ChildItem -Path "src/messages" -Filter "*.json" -Recurse
$totalReplacements = 0
$filesModified = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $originalContent = $content
    
    foreach ($pair in $replacements) {
        if ($content -like "*$($pair.old)*") {
            $content = $content -replace [regex]::Escape($pair.old), $pair.new
            Write-Host "$($file.Name): Replaced '$($pair.old)' -> '$($pair.new)'"
            $totalReplacements++
        }
    }
    
    if ($content -ne $originalContent) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $filesModified++
    }
}

Write-Host "`nSummary:"
Write-Host "Files modified: $filesModified"
Write-Host "Total replacements: $totalReplacements"
