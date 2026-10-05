#!/bin/bash
# Task 16 — generate ACE Shop product photography (3 stores, 10 products)
set -e
OUT=/home/z/my-project/public/shop
mkdir -p "$OUT"

gen() {
  local file="$1"; shift
  local prompt="$1"; shift
  if [ -s "$OUT/$file" ]; then
    echo "skip $file (exists)"
    return
  fi
  echo "→ generating $file"
  z-ai image -p "$prompt" -o "$OUT/$file" -s 1024x1024 && echo "  ✓ $file"
}

# ---------- AceWears (body wears) ----------
gen acewears-hoodie.png "Professional e-commerce product photography of a premium black hoodie sweatshirt with a small purple embroidered letter A logo on the chest, ghost mannequin floating style, light gray seamless studio background, soft diffused studio lighting, high quality, detailed"
gen acewears-tee.png "Professional e-commerce product photography of a crisp white cotton t-shirt with a small purple A logo printed on the chest, neatly folded, light gray seamless studio background, soft shadows, high quality, detailed"
gen acewears-cap.png "Professional e-commerce product photography of a black snapback baseball cap with a small purple embroidered A logo, three-quarter angle view, light gray seamless studio background, soft studio lighting, high quality, detailed"
gen acewears-joggers.png "Professional e-commerce product photography of premium black athletic joggers sweatpants with a small purple A logo on the thigh, neatly folded display, light gray seamless studio background, soft studio lighting, high quality, detailed"

# ---------- AceLaptops ----------
gen acelaptops-pro16.png "Professional e-commerce product photography of a sleek premium 16-inch aluminum laptop open at a three-quarter angle, dark screen glowing with a subtle purple abstract wallpaper, light gray seamless studio background, soft studio lighting, high quality, detailed"
gen acelaptops-air14.png "Professional e-commerce product photography of an ultra-thin silver 14-inch laptop half-open showing its thin wedge profile, light gray seamless studio background, soft studio lighting, high quality, detailed"
gen acelaptops-lite14.png "Professional e-commerce product photography of a matte black 14-inch laptop open facing forward showing a colorful abstract screen wallpaper, light gray seamless studio background, soft studio lighting, high quality, detailed"

# ---------- AcePhones ----------
gen acephones-ultra.png "Professional e-commerce product photography of a flagship black smartphone standing upright with a large triple camera module, screen showing a purple gradient wallpaper, light gray seamless studio background, soft studio lighting, high quality, detailed"
gen acephones-note12.png "Professional e-commerce product photography of a modern mid-range smartphone in a deep purple finish with quad cameras, angled three-quarter view, light gray seamless studio background, soft studio lighting, high quality, detailed"
gen acephones-mini.png "Professional e-commerce product photography of a compact white smartphone with clean minimal design standing upright, light gray seamless studio background, soft studio lighting, high quality, detailed"

echo "done — $(ls "$OUT" | wc -l) files in $OUT"
