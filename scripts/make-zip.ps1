# Crée sgfn-deploy.zip avec des séparateurs Unix (/) indispensables
# pour que cPanel extraie correctement les sous-dossiers (_next/, etc.)
# Usage : powershell -ExecutionPolicy Bypass -File scripts/make-zip.ps1

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$outDir  = Join-Path $PSScriptRoot "..\out"  | Resolve-Path
$zipPath = Join-Path $PSScriptRoot "..\sgfn-deploy.zip"

[System.IO.File]::Delete($zipPath)

$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$archive   = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$files = Get-ChildItem -Path $outDir -Recurse -File
foreach ($file in $files) {
    # Séparateurs Unix obligatoires pour Linux/cPanel
    $entryName  = $file.FullName.Substring($outDir.Path.Length + 1).Replace("\", "/")
    $entry      = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream  = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$archive.Dispose()
$zipStream.Close()

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "✓ sgfn-deploy.zip — $sizeMB MB ($($files.Count) fichiers)"
