#!/usr/bin/env python3
"""Concatenate CSS/JS source files into production bundles (no rule duplication)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / 'static'
CSS = STATIC / 'css'
JS = STATIC / 'js'
CSS_OUT = CSS / 'bundles'
JS_OUT = JS / 'bundles'

PUBLIC_CSS = [
    'fonts.css',
    'tokens.css',
    'base.css',
    'components.css',
    'wireframe-tokens.css',
    'theme-toggle.css',
    'toast.css',
    'pages/login.css',
]

CORE_CSS = [
    'fonts.css',
    'tokens.css',
    'base.css',
    'layout.css',
    'components.css',
    'wireframe-tokens.css',
    'wireframe-layout.css',
    'wireframe-components.css',
    'wireframe-pages.css',
    'packages.css',
    'theme-toggle.css',
    'responsive.css',
    'responsive-pages.css',
    'responsive-complete.css',
    'table-cards.css',
    'toast.css',
    'modal.css',
]

APP_CSS = [
    'pages/pages.css',
    'crm-due-payments.css',
    'crm-documents.css',
    'animations.css',
]

CORE_JS = [
    'theme.js',
    'crm-api.js',
    'crm-store.js',
    'crm-payments.js',
    'crm-validation.js',
    'crm-route.js',
    'crm-client-suggest.js',
    'crm-render.js',
    'crm-due-payments.js',
    'crm-documents.js',
    'modal.js',
    'crm-delete.js',
    'actions.js',
    'packages.js',
    'currency.js',
    'wireframe.js',
    'app.js',
]

PUBLIC_JS = [
    'theme.js',
    'actions.js',
]


def concat_css(names: list[str], dest: Path) -> None:
    chunks: list[str] = []
    for name in names:
        path = CSS / name
        if not path.is_file():
            raise FileNotFoundError(path)
        text = path.read_text(encoding='utf-8')
        if name == 'fonts.css':
            text = text.replace("url('../fonts/", "url('../../fonts/")
        chunks.append(f'/* === {name} === */\n')
        chunks.append(text)
        if not chunks[-1].endswith('\n'):
            chunks.append('\n')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(''.join(chunks), encoding='utf-8')
    print(f'wrote {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)')


def concat_js(names: list[str], dest: Path) -> None:
    chunks: list[str] = []
    for name in names:
        path = JS / name
        if not path.is_file():
            raise FileNotFoundError(path)
        chunks.append(f'/* === {name} === */\n')
        chunks.append(path.read_text(encoding='utf-8'))
        if not chunks[-1].endswith('\n'):
            chunks.append('\n')
        chunks.append('\n')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(''.join(chunks), encoding='utf-8')
    print(f'wrote {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)')


def main() -> None:
    CSS_OUT.mkdir(parents=True, exist_ok=True)
    JS_OUT.mkdir(parents=True, exist_ok=True)
    concat_css(PUBLIC_CSS, CSS_OUT / 'crm-public.css')
    concat_css(CORE_CSS, CSS_OUT / 'crm-core.css')
    concat_css(APP_CSS, CSS_OUT / 'crm-app.css')
    concat_js(PUBLIC_JS, JS_OUT / 'crm-public.js')
    concat_js(CORE_JS, JS_OUT / 'crm-core.js')


if __name__ == '__main__':
    main()
