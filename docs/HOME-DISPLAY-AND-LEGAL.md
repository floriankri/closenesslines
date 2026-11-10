# Home display alignment and legal pages — 10 November 2026

## Display decisions

Home retains the authored story, fixed age-88 horizon and chapter-aware vertical spacing. It uses the shared recent/equal-year mapping within chapters; minimum narrative space means its global vertical proportions intentionally differ from the editor. No life-event markers or editing controls are added.

Aligned with creator: 2.2px relationship strokes, full initial opacity, 3px active stroke, 0.46 dimming, 3px start dots, 5px death rings, 2.2px centre spine, direct control-point distances without the old extra averaging, 22px pointer hit regions. Desktop plot column is capped at 520px. Mobile retains the graph/story columns and simplified spacing controls. Category colors and last-segment fades already matched.

Remaining intentional differences: story chapters rather than sidebar, fixed example rather than personal draft/Now, age-only ticks rather than birth-year/calendar labels, chapter-driven height rather than resize slider, relationship filter rather than editing tools.

Gallery thumbnails use the page paper, no separate yellow fill. They show actual relationship geometry, Birth/end age and age guides at rounded intervals, culled where compressed time would crowd labels. No life-event markers in thumbnails. Selected recent/equal mode still applies.

## Legal draft and implementation evidence

Impressum and Privacy pages linked from Home, Creator, Gallery and timeline viewer. Operator details and public email supplied by user. No tracking or consent banner introduced.

Source audit: no accounts, analytics, advertising scripts or cookies. Local storage holds creator draft (including capability information), hint progress and display preference. Supabase stores full private JSON plus safe public projections; public custom names and event labels are stripped server-side, but public tagline remains free text. No automatic timeline expiry or user delete endpoint currently exists. Rate buckets are aggregate, without IP identity, and expire after two days. Image/video generation is client-side.

The pages are a factual draft, not a completed legal compliance review. Before production legal sign-off, verify actual project region, provider log/backup retention, applicable processing agreements and international transfer arrangements, email retention, and an operational deletion-request process. Do not claim that account-free use makes timelines anonymous. No provider agreement was accepted or changed during this task.

Primary references checked 10 November 2026:

- https://www.gesetze-im-internet.de/ddg/__5.html
- https://www.gesetze-im-internet.de/ttdsg/__25.html
- https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement
- https://supabase.com/legal/customer-resources/data-processing-addendum
- https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq

## Verification

Desktop and 390px mobile browser inspection of story, gallery card with synthetic local record, privacy page. Gallery DOM confirmed age labels, no event markers and no horizontal overflow. Syntax, build allowlist and complete automated suite checked. No production data changed; no deployment requested for this revision.
