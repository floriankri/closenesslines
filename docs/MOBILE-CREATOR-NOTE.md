# Mobile guidance and viewer labels — 10 November 2026

Phone creator (viewport <=600px) shows a dismissible inline note: “Drawing is easier on a computer or tablet. You can still create on your phone.” Hidden at tablet/desktop widths. Dismissal lasts for the current page, does not add persisted tracking/settings.

Compact detail-view event chips now sit at the right edge of the plot, retaining the event line and tap/keyboard tooltip. Desktop event labels remain outside the left edge; creator event positioning is unchanged. User considered hiding mobile events; right-side chips are the chosen reversible experiment to preserve context.

Browser checks: 390px creator note and dismiss action; 768px note absent; 390px named/public synthetic detail label on right; video beginning/middle/end synthetic frames. Full automated suite: 29 passing, syntax/build/diff checks passed. New work is feature branch only, not deployed.
