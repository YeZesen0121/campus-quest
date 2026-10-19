# UI migration fonts

Owner-approved direction: 2026-10-16 R5-inclusive whole-site samples. Display
headings use a local Song-style serif; UI/body remain a legible local sans.
`globals.css :root` owns all three stacks. No font files are downloaded or
redistributed by the product.

| Role | Production stack |
| --- | --- |
| UI/body | Microsoft YaHei, PingFang SC, Noto Sans CJK SC, system-ui, sans-serif |
| Brand/page/authentication title | SimSun, Songti SC, Noto Serif CJK SC, serif |
| Existing mono content | ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace |

Display sizes follow approved reference `innovation-round-1/styles.css`: 31px
below 40rem and 38px at/above 40rem, weight400. Body/control sizes remain separately
owned. The source-derived shell brand uses26px display type; the ordinary rail defaults to200px and the administrator rail208px, while saved legacy232px widths, native resize and collapse remain supported. Final screenshot receipts must bind the current source; earlier batch images remain historical.

## Platform evidence

T0 metadata is fresh from this environment, not an assertion about another OS.

- Windows: installed SimSun, SimSun-ExtB and Microsoft YaHei file metadata and
  SHA256 hashes are retained in `infra/ui/.runtime/baseline/windows-fonts.json`.
- Linux pinned runtime: Noto Sans/Serif CJK SC and Liberation Mono resolved
  through fontconfig. Package versions: `fonts-noto-cjk`1:20230817+repack1-3,
  `fonts-liberation`1:2.1.5-3. Character maps cover华师令/龘/𠮷/𰻞; Noto Color
  Emoji covers🌱/🧭. Full paths/indexes/versions/hashes are in
  `baseline/linux-fonts.json`.
- macOS/iOS: real hardware unavailable. Declared fallback has not been tested
  there; Linux WebKit smoke is not a macOS/iOS font test.

Actual Windows/Linux browser render samples PASSED and all six PNGs were
visually inspected. Fresh contexts block external hosts and record CDP
platform-font usage, normal/rare Chinese, Latin, numbers, emoji, long names and
an input. Both platforms use actual390/1440 viewports and a720CSSpx/DPR2
equivalent of200% zoom, asserted in browser JS. This is not physical browser UI
zoom. No sample overflows horizontally; rare characters and emoji render.

Evidence: ignored `.runtime/font-probe/{windows,linux}.json` and six named PNGs.
Linux actual display/body resolve to Noto Serif/Sans CJK SC, with Noto Color
Emoji fallback. Windows actual families are recorded in its CDP JSON. These are
diagnostic glyph specimens using the actual stylesheet; the gallery's fixed
dialog was hidden only in the diagnostic context. They are not product pixel
baselines. An initial probe inserted the sample before hydration and failed;
the corrected probe waits for Radix's mounted portal before insertion. Failure
log053118 and successful log053327 remain under `.runtime/logs/`.

## Deterministic product screenshots

Every existing visual helper pins sans to Noto Sans CJK SC, serif to Noto Serif
CJK SC and mono to Liberation Mono, then awaits `document.fonts.ready`. It does
not replace every element's font family or mask meaningful stable content.
Production retains system fallbacks. Baseline images remain Linux-authoritative.

## Contrast adaptation

Approved sample auxiliary text `#74756a` has4.20755:1 contrast on paper; product
muted/subtle use minimally deepened `#6c6d62`, with ratios4.72677/5.11218/4.50901/
4.50163 on paper/content/secondary/brand surfaces. Control boundaries use the
divider hue/chroma at62% OKLCH lightness rather than the decorative group border.
Keep actual axe findings and resolved exception removal in the verification
record; these calculations alone do not establish whole-page accessibility.
