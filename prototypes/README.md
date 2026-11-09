# Local graph layout comparison

Run `npm run dev` (or `npm run dev:hosted`) and open
`http://127.0.0.1:8837/prototypes/graph-layouts.html`.

The three views share the fictional relationship control points from the home
page: vertical time with distance right; horizontal time with distance down;
horizontal time with distance up. The same time scale and distance span make the
rotation comparable. Selection, type filters, tooltips and time stretching are
available. This is a layout experiment, not an alternate editor.

These files are served by explicit local development routes. They are excluded
from the GitHub Pages artifact and do not read or write saved timelines.

Time-spacing comparison: open `/prototypes/time-scale.html` to compare equal
years, smoothly compressed childhood (age10/12 cutoff and strength), and
recent-years emphasis. Design notes: [TIME-SCALE.md](TIME-SCALE.md).
