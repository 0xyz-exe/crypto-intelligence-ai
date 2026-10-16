# UI/UX design brief

## Direction
Dark-first research console using graphite/navy surfaces, subtle borders, calm emerald for positive and muted coral for negative. Neutral text and labels supplement all directional colors. Use tabular numerals and compact data tables, not decorative gradients or glows.

## Layout and behavior
- Left sidebar on desktop with brand, primary nav and watchlist; top header has market status, search and accessible controls.
- Main dashboard uses a compact market strip, BTC reference chart, asset table, analysis panel and watchlist preview.
- Asset view contains identity/source, history controls, chart and deterministic metrics.
- Analyst panel distinguishes facts, calculated values and interpretation; unavailable AI is explicit.
- Mobile collapses sidebar to horizontal navigation and stacks cards. No horizontal overflow.
- Loading, no-data, provider error, stale and demo states have explicit text and retry where retry is meaningful.
- Keyboard-visible focus, semantic headings/buttons/labels, accessible chart summary and reduced-motion support.

## Interaction contract
Search filters the supported market list; asset rows open detail. Timeframe changes history. Watchlist actions persist locally. Theme and settings controls only exist if functional. Market mode is an explicit setting; demo fixtures are visibly tagged. AI requires an application-owned key, otherwise deterministic analysis is shown.

## Accessibility and validation
Test at desktop and narrow viewports. No color-only cues. Avoid animation when reduced-motion is requested. Ensure chart details can be understood from accompanying labels/table/summary. Add no inert controls.
