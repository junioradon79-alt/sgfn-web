# Génère les icônes launcher Android (SGNF) depuis public/logo-embleme.png.
# - Foreground adaptatif (API 26+) : emblème centré dans la zone de sécurité, sur
#   fond blanc défini par @color/ic_launcher_background (#FFFFFF).
# - Icônes legacy carrée + ronde (API 24-25).
# Toutes densités. System.Drawing, sans dépendance réseau.
Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Dev\sgfn-web\public\logo-embleme.png"
$res = "C:\Dev\sgfn-web\android\app\src\main\res"
$src = [System.Drawing.Image]::FromFile($srcPath)

function New-GraphicsCanvas([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return ,@($bmp, $g)
}
function Save-Bmp($bmp, [string]$path) {
  $dir = Split-Path $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$legacy = [ordered]@{ "mdpi" = 48; "hdpi" = 72; "xhdpi" = 96; "xxhdpi" = 144; "xxxhdpi" = 192 }
$fg     = [ordered]@{ "mdpi" = 108; "hdpi" = 162; "xhdpi" = 216; "xxhdpi" = 324; "xxxhdpi" = 432 }
$white  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

# ── Legacy carrée (emblème plein sur fond blanc) + ronde (masque circulaire) ──
foreach ($d in $legacy.Keys) {
  $s = $legacy[$d]

  $p = New-GraphicsCanvas $s; $bmp = $p[0]; $g = $p[1]
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($src, 0, 0, $s, $s)
  Save-Bmp $bmp "$res\mipmap-$d\ic_launcher.png"
  $g.Dispose(); $bmp.Dispose()

  $p2 = New-GraphicsCanvas $s; $bmp2 = $p2[0]; $g2 = $p2[1]
  $g2.Clear([System.Drawing.Color]::Transparent)
  $g2.FillEllipse($white, 0, 0, $s, $s)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(0, 0, $s, $s)
  $g2.SetClip($path)
  $g2.DrawImage($src, 0, 0, $s, $s)
  Save-Bmp $bmp2 "$res\mipmap-$d\ic_launcher_round.png"
  $g2.Dispose(); $bmp2.Dispose()
  Write-Output "legacy $d : $s px"
}

# ── Foreground adaptatif : emblème centré à 68% (zone de sécurité) sur transparent ─
$scale = 0.68
foreach ($d in $fg.Keys) {
  $s = $fg[$d]
  $p = New-GraphicsCanvas $s; $bmp = $p[0]; $g = $p[1]
  $g.Clear([System.Drawing.Color]::Transparent)
  $w = [int]($s * $scale)
  $off = [int](($s - $w) / 2)
  $g.DrawImage($src, $off, $off, $w, $w)
  Save-Bmp $bmp "$res\mipmap-$d\ic_launcher_foreground.png"
  $g.Dispose(); $bmp.Dispose()
  Write-Output "foreground $d : $s px (embleme $w px)"
}

$src.Dispose()
Write-Output "OK - icones SGNF generees"
