#!/usr/bin/env python3
"""Check an HTML file for WPS 演示 HTML素材 embedding issues.

Usage:
    python3 check_embed_html.py file1.html [file2.html ...]

Exit code 1 when error-level findings exist, otherwise 0. Warnings are
reported but do not fail the run.
"""

import re
import sys
from pathlib import Path

RESOURCE_ERRORS = [
    (re.compile(r'(?<![.\w])src\s*=\s*["\'](?!#|data:)', re.IGNORECASE), "external or relative resource src"),
    (re.compile(r'<link\b[^>]*\bhref\s*=\s*["\'](?!#|data:)', re.IGNORECASE), "external or relative <link>"),
    (re.compile(r'@import[^;]*["\']?\s*(?:https?:)?//', re.IGNORECASE), "CSS @import over network"),
    (re.compile(r'url\(\s*["\']?\s*(?:https?:)?//', re.IGNORECASE), "CSS url() over network"),
    (re.compile(r'\bimport\s*\(\s*["\']\s*https?://', re.IGNORECASE), "dynamic import over network"),
]

NETWORK_WARNINGS = [
    (re.compile(r'\bfetch\s*\(', re.IGNORECASE), "fetch() present; confirm it never loads a remote URL"),
    (re.compile(r'XMLHttpRequest'), "XMLHttpRequest present; confirm it never loads a remote URL"),
]

LAYOUT_ERRORS = [
    (re.compile(r'position\s*:\s*fixed', re.IGNORECASE), "position: fixed (full-page layout)"),
    (re.compile(r'\b100vh\b', re.IGNORECASE), "100vh layout"),
    (re.compile(r'\b100vw\b', re.IGNORECASE), "100vw layout"),
    (re.compile(r'\bwindow\.(?:innerWidth|innerHeight)\b'), "window.innerWidth/innerHeight layout read"),
]

HINT_PHRASES = [
    "拖动旋转", "滚轮缩放", "模型已载入", "正在载入", "准备模型",
    "加载中", "操作提示", "使用说明", "点击查看",
]


def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


def scan(path):
    raw = Path(path).read_text(encoding="utf-8", errors="replace")
    errors = []
    warnings = []

    for pattern, label in RESOURCE_ERRORS:
        for match in pattern.finditer(raw):
            errors.append((line_of(raw, match.start()), label))
    for pattern, label in LAYOUT_ERRORS:
        for match in pattern.finditer(raw):
            errors.append((line_of(raw, match.start()), label))

    for pattern, label in NETWORK_WARNINGS:
        for match in pattern.finditer(raw):
            warnings.append((line_of(raw, match.start()), label))

    for match in re.finditer(r'\bhref\s*=\s*["\']https?://', raw, re.IGNORECASE):
        warnings.append((line_of(raw, match.start()), "external hyperlink (not required to load, but remove per no-attribution rule)"))

    decoded = re.sub(
        r'\\u([0-9a-fA-F]{4})',
        lambda m: chr(int(m.group(1), 16)),
        raw,
    )
    for phrase in HINT_PHRASES:
        start = 0
        while True:
            index = decoded.find(phrase, start)
            if index == -1:
                break
            warnings.append((line_of(decoded, index), "small-print/hint phrase present: " + phrase))
            start = index + len(phrase)

    for match in re.finditer(r'font-size\s*:\s*([0-9]*\.?[0-9]+)px', raw, re.IGNORECASE):
        value = float(match.group(1))
        if value < 12:
            warnings.append((line_of(raw, match.start()), "font-size %gpx may read as small print" % value))

    for match in re.finditer(r'background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()', raw):
        snippet = re.sub(r"\s+", " ", raw[match.start():match.start() + 70]).strip()
        warnings.append((line_of(raw, match.start()), "check background is intentional: " + snippet))

    if not re.search(r'background\s*:\s*transparent', raw, re.IGNORECASE):
        warnings.append((0, "no explicit transparent background found"))

    return errors, warnings


def main():
    paths = sys.argv[1:]
    if not paths:
        print("usage: check_embed_html.py <file.html> [...]")
        return 2

    failed = False
    for path in paths:
        errors, warnings = scan(path)
        print("== " + path)
        for line, label in errors:
            failed = True
            print("  ERROR  line %s: %s" % (line or "-", label))
        for line, label in warnings:
            print("  WARN   line %s: %s" % (line or "-", label))
        if not errors and not warnings:
            print("  OK: no embedding issues found")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
