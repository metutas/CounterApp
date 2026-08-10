# Play Store'un istedigi gorselleri uretir:
#   - store/icon-512.png        : 512x512 magaza ikonu (assets/images/icon.png'den kucultulur)
#   - store/feature-graphic.png : 1024x500 one cikan gorsel
#
# Kullanim: powershell -ExecutionPolicy Bypass -File scripts/make-store-assets.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'store'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$srcIconPath = Join-Path $root 'assets\images\icon.png'
$srcIcon = [System.Drawing.Image]::FromFile($srcIconPath)

# --- 1) 512x512 magaza ikonu ---
$icon512 = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($icon512)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($srcIcon, 0, 0, 512, 512)
$g.Dispose()
$icon512.Save((Join-Path $outDir 'icon-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$icon512.Dispose()

# --- 2) 1024x500 one cikan gorsel ---
$fg = New-Object System.Drawing.Bitmap 1024, 500
$g = [System.Drawing.Graphics]::FromImage($fg)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Koyu arka plan (uygulamanin koyu temasiyla ayni his)
$bgRect = New-Object System.Drawing.Rectangle 0, 0, 1024, 500
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $bgRect,
  [System.Drawing.Color]::FromArgb(255, 12, 12, 14),
  [System.Drawing.Color]::FromArgb(255, 34, 28, 8),
  [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
)
$g.FillRectangle($bgBrush, $bgRect)
$bgBrush.Dispose()

# Sag tarafta sicak bir isik halesi (kum saati altin tonuyla uyumlu)
$glow = New-Object System.Drawing.Drawing2D.GraphicsPath
$glow.AddEllipse(560, -120, 620, 740)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glow)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, 255, 193, 7)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 193, 7))
$g.FillPath($glowBrush, $glow)
$glowBrush.Dispose()
$glow.Dispose()

# Ikon (solda, kare kirpilmis halde)
$g.DrawImage($srcIcon, 96, 130, 240, 240)

# Basliklar
$titleFont = New-Object System.Drawing.Font('Segoe UI', 54, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subFont = New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$tagFont = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$amber = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 193, 7))
$grey = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 190, 190, 195))

# Turkce karakterler: bu .ps1 ANSI okunabildigi icin kod noktasindan uretiliyor
$cCedil = [char]0x00E7  # c
$gBreve = [char]0x011F  # g
$subtitle = "Saya${cCedil}, Alarm ve Odaklanma Sesleri"
$tagline = "Ya${gBreve}mur - Dalga - Orman - Odak"

$g.DrawString('CounterApp', $titleFont, $white, 392, 158)
$g.DrawString($subtitle, $subFont, $grey, 396, 232)

# Altin vurgu cizgisi
$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 193, 7)), 4
$g.DrawLine($linePen, 398, 292, 700, 292)
$linePen.Dispose()

$g.DrawString($tagline, $tagFont, $amber, 396, 312)

$titleFont.Dispose(); $subFont.Dispose(); $tagFont.Dispose()
$white.Dispose(); $amber.Dispose(); $grey.Dispose()
$g.Dispose()

$fg.Save((Join-Path $outDir 'feature-graphic.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$fg.Dispose()
$srcIcon.Dispose()

Write-Output "OK: store/icon-512.png ve store/feature-graphic.png olusturuldu"
