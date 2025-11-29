# v8.0 Backend Setup Script - PowerShell
# Automatikus migration és adatbázis inicializálás

Write-Host "
╔══════════════════════════════════════════════════════════╗
║  v8.0 Backend Setup - Auto Migration                    ║
║  Lab Request System - Abstract Notification System       ║
╚══════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

# 1. Ellenőrzések
Write-Host "[1/5] Környezet ellenőrzése..." -ForegroundColor Yellow

# Python verzió
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ Python telepítve: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Python nem található! Telepítsd: https://python.org" -ForegroundColor Red
    exit 1
}

# app.py létezik?
if (-not (Test-Path "app.py")) {
    Write-Host "  ✗ app.py nem található! Rossz mappában vagy?" -ForegroundColor Red
    Write-Host "    Futtasd ezt a scriptet a backend mappában!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ app.py megtalálva" -ForegroundColor Green

# 2. Függőségek telepítése
Write-Host "`n[2/5] Hiányzó függőségek telepítése..." -ForegroundColor Yellow

Write-Host "  → qrcode + pillow telepítése..." -ForegroundColor Cyan
python -m pip install qrcode pillow --quiet 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ qrcode + pillow telepítve" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Figyelmeztetés: qrcode telepítés sikertelen, de folytatjuk..." -ForegroundColor Yellow
}

# 3. Instance mappa létrehozása
Write-Host "`n[3/5] Instance mappa létrehozása..." -ForegroundColor Yellow

if (-not (Test-Path "instance")) {
    New-Item -ItemType Directory -Path instance -Force | Out-Null
    Write-Host "  ✓ instance mappa létrehozva" -ForegroundColor Green
} else {
    Write-Host "  ✓ instance mappa már létezik" -ForegroundColor Green
}

# 4. Adatbázis inicializálás
Write-Host "`n[4/5] Adatbázis inicializálás..." -ForegroundColor Yellow

if (Test-Path "instance\lab_requests.db") {
    Write-Host "  ✓ Adatbázis már létezik: instance\lab_requests.db" -ForegroundColor Green
} else {
    Write-Host "  → Új adatbázis létrehozása..." -ForegroundColor Cyan
    
    $createDbScript = "from app import app, db; app.app_context().push(); db.create_all(); print('OK')"
    $result = python -c $createDbScript 2>&1
    
    if ($result -match "OK") {
        Write-Host "  ✓ Adatbázis sikeresen létrehozva!" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Adatbázis létrehozás sikertelen:" -ForegroundColor Red
        Write-Host "    $result" -ForegroundColor Red
        Write-Host "`n  Lehetséges okok:" -ForegroundColor Yellow
        Write-Host "    - Hiányzó Python modulok (futtasd: python -m pip install -r requirements.txt)" -ForegroundColor Yellow
        Write-Host "    - app.py szintaxis hiba" -ForegroundColor Yellow
        exit 1
    }
}

# 5. v8.0 Migration futtatása
Write-Host "`n[5/5] v8.0 Migration futtatása..." -ForegroundColor Yellow

if (-not (Test-Path "migrate_v8_0.py")) {
    Write-Host "  ✗ migrate_v8_0.py nem található!" -ForegroundColor Red
    Write-Host "    Másold be a migrate_v8_0.py fájlt ebbe a mappába!" -ForegroundColor Red
    exit 1
}

Write-Host "  → Migration indítása..." -ForegroundColor Cyan
Write-Host ""

# Migration futtatás (kimenetet közvetlenül mutatjuk)
python migrate_v8_0.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n
╔══════════════════════════════════════════════════════════╗
║  ✅ v8.0 Backend Setup SIKERES!                         ║
╚══════════════════════════════════════════════════════════╝
" -ForegroundColor Green

    Write-Host "Következő lépések:" -ForegroundColor Cyan
    Write-Host "  1. Backend tesztelés: python app.py" -ForegroundColor White
    Write-Host "  2. Git commit:" -ForegroundColor White
    Write-Host "     git add migrate_v8_0.py notification_service.py app.py" -ForegroundColor Gray
    Write-Host "     git commit -m 'v8.0: Abstract Notification System'" -ForegroundColor Gray
    Write-Host "     git push railway main" -ForegroundColor Gray
    Write-Host "  3. Railway migration:" -ForegroundColor White
    Write-Host "     railway run python migrate_v8_0.py" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "`n
╔══════════════════════════════════════════════════════════╗
║  ✗ v8.0 Migration SIKERTELEN!                           ║
╚══════════════════════════════════════════════════════════╝
" -ForegroundColor Red
    
    Write-Host "Ellenőrizd a fenti hibaüzeneteket!" -ForegroundColor Yellow
    Write-Host "Segítség kérése: küldd el a teljes kimenetet Claude-nak" -ForegroundColor Yellow
    exit 1
}
