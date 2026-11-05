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

Follow-up: person actions now open details first, then place the chosen person; the guide stays open unless explicitly closed. Events can be dragged by their dotted rule as well as their label. Opening an event dialog clears placement state, including when entered through the desktop gutter. Browser verified person-first placement, dotted-rule drag and gutter-create-then-drag; all18 tests/syntax checks pass.

Walkthrough revision: replaced the top checklist with an optional guided tour that highlights actual controls and graph targets, scrolls them into view, and advances after birth entry, event creation, person creation and a real shape change. Skip/exit supported; dialogs temporarily hide the coach. The mobile editor sheet is hidden only while the guide runs. Browser verified the full event/person/shape sequence, birth transition, skip, restart and exit at desktop/390px. No automatic publication.
