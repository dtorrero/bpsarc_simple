#!/usr/bin/env python3
"""
ARC Raiders Blueprints Update Utility

Downloads the latest blueprint data from the ARC Raiders wiki,
compares with existing data, and outputs only NEW blueprints
to separate files for review before updating the production server.

Usage:
    python update_blueprints.py

Output:
    - blueprints_new.json   - Complete dataset (existing + new blueprints)
    - images_new/           - Folder with only new images
    - update_report.txt     - Summary of changes
"""

import json
import os
import sys
import time
import hashlib
import re
from datetime import datetime
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

# ─── Configuration ───────────────────────────────────────────────────────────

WIKI_URL = "https://arcraiders.wiki/wiki/Blueprints"
WIKI_BASE = "https://arcraiders.wiki"

EXISTING_JSON = "blueprints.json"
EXISTING_IMAGES_DIR = "images"

OUTPUT_JSON = "blueprints_new.json"
OUTPUT_IMAGES_DIR = "images_new"
OUTPUT_REPORT = "update_report.txt"

REQUEST_DELAY = 0.2  # seconds between requests to be nice to the server

# ─── Helpers ─────────────────────────────────────────────────────────────────

def log(msg):
    print(f"  {msg}")


def load_existing_blueprints(path):
    """Load existing blueprints JSON, return list or None."""
    if not os.path.exists(path):
        log(f"No existing data found at {path}")
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        log(f"Loaded {len(data)} existing blueprints from {path}")
        return data
    except (json.JSONDecodeError, IOError) as e:
        log(f"Warning: Could not load {path}: {e}")
        return None


def load_existing_images(dir_path):
    """Return a set of filenames already present in the images directory."""
    if not os.path.isdir(dir_path):
        return set()
    files = set()
    for f in os.listdir(dir_path):
        if os.path.isfile(os.path.join(dir_path, f)):
            files.add(f)
    log(f"Found {len(files)} existing images in {dir_path}/")
    return files


def download_page(url):
    """Download a page and return its HTML text."""
    log(f"Downloading {url}...")
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        print(f"  ERROR: Failed to download {url}: {e}")
        sys.exit(1)


def download_image(url, dest_path):
    """Download an image file. Returns True on success."""
    try:
        resp = requests.get(url, stream=True, timeout=30)
        resp.raise_for_status()
        with open(dest_path, 'wb') as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        log(f"  WARNING: Failed to download {url}: {e}")
        return False


def file_hash(filepath):
    """Return SHA256 hash of a file, or None."""
    try:
        h = hashlib.sha256()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def clean_filename(filename):
    """
    Clean a wiki image filename to match production conventions:
    - URL-decode percent-encoded characters (%28 → (, %29 → ), %27 → ')
    - Remove parentheses and apostrophes
    """
    decoded = unquote(filename)
    cleaned = decoded.replace("(", "").replace(")", "").replace("'", "")
    return cleaned

# ─── Scraping ─────────────────────────────────────────────────────────────────

def extract_blueprint_data(html):
    """
    Extract blueprint records from the wiki table.
    Returns a list of dicts with keys:
        name, map, condition, scavengable, containers,
        quest_reward, trials_reward, image_filename
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Try to find the wikitable – the main blueprint table
    table = soup.find('table', {'class': 'wikitable'})
    if not table:
        print("  ERROR: Could not find blueprint table (class='wikitable') on the page.")
        print("  The wiki may have changed its layout.")
        sys.exit(1)

    blueprints = []
    rows = table.find_all('tr')
    for row in rows[1:]:  # skip header
        cols = row.find_all('td')
        if len(cols) < 7:
            continue

        # Name – look for a link inside the first cell
        name_cell = cols[0]
        name_link = name_cell.find('a')
        name = name_link.get_text(strip=True) if name_link else name_cell.get_text(strip=True)
        if not name:
            continue

        record = {
            'name': name,
            'map': cols[1].get_text(strip=True),
            'condition': cols[2].get_text(strip=True),
            'scavengable': cols[3].get_text(strip=True),
            'containers': cols[4].get_text(strip=True),
            'quest_reward': cols[5].get_text(strip=True),
            'trials_reward': cols[6].get_text(strip=True),
            'image_filename': None,
        }
        blueprints.append(record)

    return blueprints


def _normalize_name(name):
    """Normalize 'Mag' ↔ 'Magazine' for comparison purposes."""
    return name.replace('Magazine', 'Mag')


def extract_grid_only_blueprints(html, table_blueprints):
    """
    Extract blueprint names from the image grid that are NOT in the table.
    These are blueprints with images but no data in the table yet.
    Returns a list of partial records (name + image_filename only).
    """
    soup = BeautifulSoup(html, 'html.parser')
    table_names = {bp['name'] for bp in table_blueprints}
    table_names_normalized = {_normalize_name(bp['name']) for bp in table_blueprints}

    grid = soup.find('div', {'class': 'blueprint-grid'})
    if not grid:
        return []

    grid_only = []
    cells = grid.find_all('div', {'class': 'bp-cell'})

    for cell in cells:
        link = cell.find('a')
        if not link or 'title' not in link.attrs:
            continue
        name = link['title']

        # Skip if already in the table (exact match or Mag/Magazine variant)
        if name in table_names or _normalize_name(name) in table_names_normalized:
            continue

        # Get image URL from the cell
        img_url = None
        bp_image_div = cell.find('div', {'class': 'bp-image'})
        if bp_image_div:
            img = bp_image_div.find('img')
            if img and img.get('src'):
                img_url = img['src']
        if not img_url:
            for img in cell.find_all('img'):
                src = img.get('src', '')
                if 'UI_Blueprint_background' not in src and 'Icon_Blueprint' not in src:
                    img_url = src
                    break

        raw_filename = os.path.basename(img_url.split('?')[0]) if img_url else None
        filename = clean_filename(raw_filename) if raw_filename else None

        record = {
            'name': name,
            'map': '',
            'condition': '',
            'scavengable': '',
            'containers': '',
            'quest_reward': '',
            'trials_reward': '',
            'image_filename': filename,
        }
        grid_only.append(record)

    return grid_only



def extract_image_map(html):
    """
    Build a mapping from blueprint name → image URL by scanning the page
    for blueprint images.  Falls back to filename-based matching.
    """
    soup = BeautifulSoup(html, 'html.parser')
    image_map = {}

    # ── Method 1: blueprint grid (bp-cell elements) ──────────────────────
    grid = soup.find('div', {'class': 'blueprint-grid'})
    if grid:
        cells = grid.find_all('div', {'class': 'bp-cell'})
        for cell in cells:
            link = cell.find('a')
            if not link or 'title' not in link.attrs:
                continue
            name = link['title']

            # Look for the actual blueprint image (not the background)
            bp_image_div = cell.find('div', {'class': 'bp-image'})
            if bp_image_div:
                img = bp_image_div.find('img')
                if img and img.get('src'):
                    src = img['src']
                    if src.startswith('/'):
                        src = f"{WIKI_BASE}{src}"
                    image_map[name] = src
                    continue

            # Fallback: any image that is NOT the background
            for img in cell.find_all('img'):
                src = img.get('src', '')
                if 'UI_Blueprint_background' not in src and 'Icon_Blueprint' not in src:
                    if src.startswith('/'):
                        src = f"{WIKI_BASE}{src}"
                    image_map[name] = src
                    break

    # ── Method 2: filename-based matching for any remaining images ───────
    # This catches images that may not be in the grid with exact names
    for img in soup.find_all('img'):
        src = img.get('src', '')
        if 'UI_Blueprint_background' in src or 'Icon_Blueprint' in src:
            continue

        filename = os.path.basename(src.split('?')[0])
        if not filename.startswith('256px-') and not filename.endswith('.webp') and not filename.endswith('.png'):
            continue

        # Derive a name from the filename
        stem = filename
        for prefix in ['256px-']:
            if stem.startswith(prefix):
                stem = stem[len(prefix):]
        # Remove extensions
        for ext in ['.png.webp', '.webp', '.png']:
            if stem.endswith(ext):
                stem = stem[:-len(ext)]
                break
        name_from_file = stem.replace('_', ' ')

        abs_src = f"{WIKI_BASE}{src}" if src.startswith('/') else src

        # Add under the derived name (won't overwrite an existing exact match)
        if name_from_file not in image_map:
            image_map[name_from_file] = abs_src

        # Also try "Magazine" ↔ "Mag" variations
        if 'Mag' in name_from_file and 'Magazine' not in name_from_file:
            alt = name_from_file.replace('Mag', 'Magazine')
            if alt not in image_map:
                image_map[alt] = abs_src
        elif 'Magazine' in name_from_file:
            alt = name_from_file.replace('Magazine', 'Mag')
            if alt not in image_map:
                image_map[alt] = abs_src

    return image_map

# ─── Diff / Merge ────────────────────────────────────────────────────────────

def find_new_blueprints(existing, fresh):
    """
    Compare existing blueprints with freshly scraped ones.
    Returns (new_blueprints, all_blueprints).

    Matching is done by blueprint *name* (case-sensitive).
    Existing records are kept as-is; new records are appended.
    """
    if existing is None:
        return fresh, fresh

    existing_names = {bp['name'] for bp in existing}
    new_items = [bp for bp in fresh if bp['name'] not in existing_names]

    # Preserve existing order, append new ones
    all_items = list(existing) + new_items

    return new_items, all_items


def find_new_images(existing_images_set, fresh_blueprints, image_map):
    """
    Determine which images need to be downloaded.
    Returns a list of (blueprint_name, image_url, target_filename).
    """
    needed = []
    for bp in fresh_blueprints:
        name = bp['name']
        url = image_map.get(name)
        if not url:
            continue
        raw_filename = os.path.basename(url.split('?')[0])
        filename = clean_filename(raw_filename)
        if filename not in existing_images_set:
            needed.append((name, url, filename))
    return needed

# ─── Output ──────────────────────────────────────────────────────────────────

def write_report(new_bps, new_images, all_bps, output_path):
    """Write a human-readable update report."""
    lines = []
    lines.append("=" * 60)
    lines.append("ARC Raiders Blueprints – Update Report")
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"Total blueprints in new dataset: {len(all_bps)}")
    lines.append(f"New blueprints found:           {len(new_bps)}")
    lines.append(f"New images to download:         {len(new_images)}")
    lines.append("")

    if new_bps:
        lines.append("── New Blueprints ──")
        for bp in new_bps:
            lines.append(f"  • {bp['name']}")
            lines.append(f"      Map:         {bp['map']}")
            lines.append(f"      Condition:   {bp['condition']}")
            lines.append(f"      Scavengable: {bp['scavengable']}")
            lines.append(f"      Containers:  {bp['containers']}")
            lines.append(f"      Quest:       {bp['quest_reward']}")
            lines.append(f"      Trials:      {bp['trials_reward']}")
            lines.append("")

    if new_images:
        lines.append("── New Images ──")
        for name, url, fname in new_images:
            lines.append(f"  • {name} → {fname}")
        lines.append("")

    lines.append("── Files Created ──")
    lines.append(f"  {OUTPUT_JSON}")
    lines.append(f"  {OUTPUT_IMAGES_DIR}/")
    lines.append(f"  {OUTPUT_REPORT}")
    lines.append("")
    lines.append("── Next Steps ──")
    lines.append("  1. Review the new data in blueprints_new.json")
    lines.append("  2. Check new images in images_new/")
    lines.append("  3. If satisfied, copy to production:")
    lines.append(f"     cp blueprints_new.json blueprints.json")
    lines.append(f"     cp images_new/* images/")
    lines.append("")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    log(f"Report written to {output_path}")


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("")
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║       ARC Raiders Blueprints – Update Utility              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print("")

    # 1. Load existing data
    print("── Step 1: Loading existing data ──")
    existing_bps = load_existing_blueprints(EXISTING_JSON)
    existing_images = load_existing_images(EXISTING_IMAGES_DIR)
    print("")

    # 2. Download fresh data from wiki
    print("── Step 2: Downloading from wiki ──")
    html = download_page(WIKI_URL)
    print("")

    # 3. Extract blueprint records from table
    print("── Step 3: Extracting blueprint data from table ──")
    fresh_bps = extract_blueprint_data(html)
    log(f"Found {len(fresh_bps)} blueprints in the wiki table")
    print("")

    # 4. Extract grid-only blueprints (images without table data)
    print("── Step 4: Extracting grid-only blueprints ──")
    grid_only_bps = extract_grid_only_blueprints(html, fresh_bps)
    if grid_only_bps:
        log(f"Found {len(grid_only_bps)} blueprints in grid (no table data):")
        for bp in grid_only_bps:
            log(f"  ➜ {bp['name']}")
    else:
        log("No grid-only blueprints found")
    print("")

    # 5. Merge: table data + grid-only data
    all_fresh_bps = fresh_bps + grid_only_bps
    log(f"Total fresh blueprints: {len(all_fresh_bps)} (table: {len(fresh_bps)} + grid-only: {len(grid_only_bps)})")
    print("")

    # 6. Extract image URLs
    print("── Step 6: Extracting image URLs ──")
    image_map = extract_image_map(html)
    log(f"Found {len(image_map)} image URLs")
    print("")

    # 7. Diff: find what's new
    print("── Step 7: Comparing with existing data ──")
    new_bps, all_bps = find_new_blueprints(existing_bps, all_fresh_bps)
    log(f"New blueprints: {len(new_bps)}")

    if new_bps:
        for bp in new_bps:
            log(f"  ➜ {bp['name']}")
    else:
        log("  (none – dataset is up to date)")
    print("")

    # 8. Determine which images need downloading
    print("── Step 8: Checking images ──")
    new_images = find_new_images(existing_images, all_fresh_bps, image_map)
    log(f"New images needed: {len(new_images)}")

    if not new_bps and not new_images:
        print("")
        print("  ✓ Everything is up to date. Nothing to do.")
        print("")
        # Still write a report so the user can see the status
        write_report(new_bps, new_images, all_bps, OUTPUT_REPORT)
        return

    # 9. Download new images
    if new_images:
        print("")
        print("── Step 9: Downloading new images ──")
        os.makedirs(OUTPUT_IMAGES_DIR, exist_ok=True)
        downloaded = 0
        failed = 0
        for name, url, fname in new_images:
            dest = os.path.join(OUTPUT_IMAGES_DIR, fname)
            log(f"  Downloading {name}...")
            if download_image(url, dest):
                downloaded += 1
            else:
                failed += 1
            time.sleep(REQUEST_DELAY)
        log(f"Downloaded: {downloaded}, Failed: {failed}")

    # 10. Fill in image_filename for table blueprints from the image map
    print("── Step 10: Filling in image filenames ──")
    filled = 0
    for bp in all_bps:
        if bp['image_filename'] is None and bp['name'] in image_map:
            url = image_map[bp['name']]
            raw_filename = os.path.basename(url.split('?')[0])
            bp['image_filename'] = clean_filename(raw_filename)
            filled += 1
    if filled:
        log(f"Filled image_filename for {filled} blueprints")
    else:
        log("No image filenames needed filling")
    print("")

    # 11. Write output JSON
    print("── Step 11: Writing output files ──")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(all_bps, f, indent=2, ensure_ascii=False)
        f.write('\n')  # trailing newline
    log(f"Written {OUTPUT_JSON} ({len(all_bps)} blueprints)")

    # 12. Write report
    write_report(new_bps, new_images, all_bps, OUTPUT_REPORT)

    # 13. Summary
    print("")
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║                         Complete                           ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print("")
    print(f"  New blueprints: {len(new_bps)}")
    print(f"  New images:     {len(new_images)}")
    print("")
    print(f"  Review the output files:")
    print(f"    • {OUTPUT_JSON}")
    print(f"    • {OUTPUT_IMAGES_DIR}/")
    print(f"    • {OUTPUT_REPORT}")
    print("")
    print("  To deploy, copy to production:")
    print(f"    cp {OUTPUT_JSON} {EXISTING_JSON}")
    print(f"    cp {OUTPUT_IMAGES_DIR}/* {EXISTING_IMAGES_DIR}/")
    print("")


if __name__ == "__main__":
    main()
