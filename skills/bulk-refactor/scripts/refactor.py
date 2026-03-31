#!/usr/bin/env python3
"""
Bulk Refactor Engine — Apply pattern-based transformations across many files
simultaneously with dry-run preview and rollback capability.

Usage:
  python refactor.py --spec /tmp/refactor-spec.json --dry-run
  python refactor.py --spec /tmp/refactor-spec.json --apply
"""

import argparse
import glob
import json
import os
import re
import shutil
import sys
from datetime import datetime


def load_spec(spec_path):
    with open(spec_path, "r") as f:
        return json.load(f)


def find_files(file_glob, base_dir="."):
    pattern = os.path.join(base_dir, file_glob)
    return sorted(glob.glob(pattern, recursive=True))


def apply_transform(content, spec):
    mode = spec.get("mode", "string")
    find = spec["find"]
    replace = spec["replace"]

    if mode == "regex":
        new_content = re.sub(find, replace, content)
    else:
        new_content = content.replace(find, replace)

    return new_content


def diff_preview(original, modified, filepath):
    """Generate a simple diff preview."""
    orig_lines = original.splitlines()
    mod_lines = modified.splitlines()
    changes = []

    for i, (o, m) in enumerate(zip(orig_lines, mod_lines)):
        if o != m:
            changes.append({
                "line": i + 1,
                "before": o.strip(),
                "after": m.strip(),
            })

    if len(mod_lines) > len(orig_lines):
        for i in range(len(orig_lines), len(mod_lines)):
            changes.append({"line": i + 1, "before": None, "after": mod_lines[i].strip()})
    elif len(orig_lines) > len(mod_lines):
        for i in range(len(mod_lines), len(orig_lines)):
            changes.append({"line": i + 1, "before": orig_lines[i].strip(), "after": None})

    return changes


def main():
    parser = argparse.ArgumentParser(description="Bulk Refactor Engine")
    parser.add_argument("--spec", required=True, help="Path to refactor spec JSON")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--apply", action="store_true", help="Apply changes")
    parser.add_argument("--backup-dir", default="/tmp/refactor-backups", help="Backup directory")
    parser.add_argument("--output", "-o", help="Write report to file")

    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Error: Must specify either --dry-run or --apply")
        sys.exit(1)

    spec = load_spec(args.spec)
    files = find_files(spec["file_glob"])

    if not files:
        print(json.dumps({"error": f"No files matched glob: {spec['file_glob']}", "files_found": 0}))
        sys.exit(0)

    print(f"Refactor: {spec.get('description', 'No description')}")
    print(f"Pattern: {spec['file_glob']}")
    print(f"Files matched: {len(files)}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'APPLY'}")
    print()

    results = []
    modified_count = 0
    backup_paths = []

    for filepath in files:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            original = f.read()

        modified = apply_transform(original, spec)

        if original == modified:
            results.append({"file": filepath, "status": "unchanged", "changes": []})
            continue

        changes = diff_preview(original, modified, filepath)
        modified_count += 1

        if args.dry_run:
            print(f"  📝 {filepath} — {len(changes)} change(s)")
            for c in changes[:5]:
                if c["before"]:
                    print(f"     - {c['before']}")
                if c["after"]:
                    print(f"     + {c['after']}")
            if len(changes) > 5:
                print(f"     ... and {len(changes) - 5} more")
            results.append({"file": filepath, "status": "would_modify", "changes": changes})
        else:
            # Backup
            backup_path = os.path.join(args.backup_dir, datetime.now().strftime("%Y%m%d_%H%M%S"), filepath)
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            shutil.copy2(filepath, backup_path)
            backup_paths.append(backup_path)

            # Write
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(modified)

            print(f"  ✅ {filepath} — {len(changes)} change(s) applied")
            results.append({"file": filepath, "status": "modified", "changes": changes, "backup": backup_path})

    report = {
        "description": spec.get("description", ""),
        "mode": "dry_run" if args.dry_run else "applied",
        "files_scanned": len(files),
        "files_modified": modified_count,
        "files_unchanged": len(files) - modified_count,
        "backup_dir": args.backup_dir if args.apply else None,
        "results": results,
    }

    print()
    print(f"{'=' * 50}")
    print(f"  Files scanned: {len(files)}")
    print(f"  Files {'would be ' if args.dry_run else ''}modified: {modified_count}")
    print(f"  Files unchanged: {len(files) - modified_count}")
    print(f"{'=' * 50}")

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\nReport written to {args.output}")


if __name__ == "__main__":
    main()
