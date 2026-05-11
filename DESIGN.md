# ScentForge Atelier Design

## Color Tokens

- ink: `#10100E`
- ivory: `#F6F0E6`
- forest: `#173D2B`
- moss: `#6F7F52`
- amber: `#C58A3A`
- rose: `#C97B7B`
- smoke: `#D8D0C2`

The app applies these through CSS variables in `src/app/globals.css`, with Tailwind available for utility composition.

## Typography

- Headings: an elegant system serif stack using Iowan Old Style, Palatino Linotype, Georgia, serif
- Body: Avenir Next, Segoe UI, system UI, sans-serif
- Code and logs: SF Mono, Consolas, Liberation Mono, monospace

No external font package is required for the local demo.

## Motion

Motion is restrained: small transform feedback on controls, premium easing, and reduced-motion support. The experience should feel polished without becoming animated decoration.

## Components

- Editorial hero with oversized serif type and asymmetrical support copy
- Perfume product cards with custom bottle visuals, scent hierarchy, and stable controls
- Affiliate dashboard stat panels with readable live metrics
- Simple SVG/CSS trend chart using only LIVE orders
- Atelier editor with prompt panel, generated files, preview stage, validation checklist, and terminal-like logs
- Generated storefront rendering based on the generated manifest, keeping runtime execution constrained

## Design Principle

The public store should feel like fragrance media. The dashboard should feel like a well-run back office. The Atelier should feel like a workshop where generation is powerful but gated by proof.
