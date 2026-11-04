# Guided creator feature preview

Branch: `codex/guided-creator-preview`. Experimental; do not merge or deploy without user review.

- Optional collapsible guidance, with remembered open/closed preference.
- Explicit person/event placement actions and cancellation; existing free drawing remains.
- Mobile event labels inside the graph; no reserved 100px event gutter. Desktop retains outside labels.
- Mobile selected relationship panel at the bottom with Done control.
- Public viewer uses matching mobile event chips; gallery cards center on narrow screens.
- Current publication semantics unchanged: Publish & share also creates the anonymous gallery version. Save / editing link does not newly publish a private timeline. Updating an already published timeline still updates it.

Verified: Node syntax, 18 existing tests, build, diff whitespace. Browser at 1280px and 390px: draft restore, guide event placement across a relationship, event drag, selected-person panel, add person, cancel/Escape, local publish and shared event tooltip. Mobile plot362px in390px viewport with no horizontal overflow. Synthetic local data only.

Not yet implemented: AI, family questionnaire, separate private viewer sharing/publication backend, or a redesigned point-removal interaction. Real-device touch/Safari and dense coincident event labels need further testing.
