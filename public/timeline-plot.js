'use strict';

const ClosenessPlot = (() => {
  const ns = 'http://www.w3.org/2000/svg';
  const categoryColors = {
    family: '#4f6e85', friends: '#3e725f', romance: '#9c4c59', work: '#846629', pets: '#765f8d'
  };
  const categoryLabels = { family: 'Family member', friends: 'Friend', romance: 'Partner', work: 'Colleague', pets: 'Pet' };
  let plotId = 0;
  // Keep API-compatible stored values while presenting a smaller event vocabulary.
  const eventOptions = [
    ['Moved city', 'Moved'], ['New school', 'School'], ['University', 'University'],
    ['New job', 'Job'], ['Retirement', 'Retirement'], ['Other life event', 'Other']
  ];
  const canonicalEventType = type => ({ 'University change': 'University', 'Job change': 'New job' })[type] ?? type;
  const eventTypeLabel = type => eventOptions.find(([value]) => value === canonicalEventType(type))?.[1] ?? type;


  function relationshipType(track, tracks) {
    const { category, subtype } = track;
    if (category !== 'family' || (subtype !== 'Sibling' && subtype !== 'Child')) return subtype;
    const age = track.points[0][0];
    const sibling = subtype === 'Sibling';
    if (sibling && age === 0) return 'Older sibling';

    const peerAges = tracks
      .filter(peer => peer.id !== track.id && peer.category === category && peer.subtype === subtype)
      .map(peer => peer.points[0][0])
      .filter(peerAge => !sibling || peerAge > 0);
    const generic = sibling ? 'Younger sibling' : 'Child';
    if (!peerAges.length || peerAges.includes(age)) return generic;

    const hasEarlier = peerAges.some(peerAge => peerAge < age);
    const hasLater = peerAges.some(peerAge => peerAge > age);
    if (sibling) {
      if (!hasEarlier) return generic;
      return hasLater ? 'Middle sibling' : 'Youngest sibling';
    }
    if (!hasEarlier) return 'Oldest child';
    return hasLater ? 'Middle child' : 'Youngest child';
  }

  function namedLines(timeline) {
    return timeline.relationships.map(track => ({
      label: (() => {
        const type = relationshipType(track, timeline.relationships) || categoryLabels[track.category];
        return track.name && track.name !== type ? `${type} · ${track.name}` : type;
      })(),
      color: categoryColors[track.category],
      ending: track.ending,
      points: track.points
    }));
  }

  function publicLines(lines) {
    return lines.map(({ type, color, ending, points }) => ({ label: type, color, ending, points }));
  }

  function node(tag, attributes = {}, value) {
    const element = document.createElementNS(ns, tag);
    for (const [key, val] of Object.entries(attributes)) element.setAttribute(key, val);
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function pathFor(points) {
    let path = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const bend = (y1 - y0) / 3;
      path += `C${x0} ${y0 + bend} ${x1} ${y1 - bend} ${x1} ${y1}`;
    }
    return path;
  }

  function fadeStartAge(points) {
    // The final edit segment defines the exit, regardless of the relationship's length.
    return points.at(-2)?.[0] ?? points[0]?.[0] ?? 0;
  }

  function fadeMask(defs, id, width, height, from, to) {
    const gradient = node('linearGradient', { id: `${id}-gradient`, gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: from, y2: to });
    gradient.append(
      node('stop', { offset: 0, 'stop-color': 'white' }),
      node('stop', { offset: 1, 'stop-color': 'white', 'stop-opacity': 0 })
    );
    const mask = node('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height });
    mask.append(node('rect', { width, height, fill: `url(#${id}-gradient)` }));
    defs.append(gradient, mask);
  }

  // Use the actual visible label centres so guides stay aligned at every breakpoint.
  function scalePositions(svg) {
    const plot = svg.getBoundingClientRect();
    return [...document.querySelectorAll('.closeness-scale span')]
      .filter(label => label.getClientRects().length)
      .map(label => {
        const rect = label.getBoundingClientRect();
        return rect.left + rect.width / 2 - plot.left;
      }).filter(x => x >= 0 && x <= plot.width);
  }

  function render(svg, { age, duration = age, lines, events = [], ending = 'snapshot', selected = null, preview = false, tooltip = null, compactEvents = false }) {
    const width = preview ? 210 : svg.clientWidth || 600;
    const height = preview ? 420 : svg.clientHeight || 840;
    const mid = width / 2;
    const top = preview ? 13 : 30;
    const span = Number.isFinite(Number(duration)) ? Number(duration) : age;
    const displayAge = Math.floor(span);
    const bottom = span ? height - (preview ? 13 : 31) : top;
    const spread = mid - (preview ? 12 : 18);
    const x = distance => mid + spread * distance;
    const y = value => span ? top + (bottom - top) * value / span : top;
    const lineWidth = preview ? 1.4 : 2.1;
    const prefix = `plot-${++plotId}`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const defs = node('defs');
    const group = node('g');
    const hits = node('g', { 'aria-label': 'Relationship lines' });
    const eventHits = node('g', { 'aria-label': 'Life events' });
    const text = node('g', { 'font-family': 'system-ui,sans-serif', 'font-size': 10, fill: 'var(--muted, #5f5a51)', 'paint-order':'stroke', stroke:'var(--paper, #f7f4eb)', 'stroke-width':3, 'stroke-linejoin':'round' });
    const horizontalRule = (value, stroke) => node('line', { x1: 7, x2: width - 7, y1: y(value), y2: y(value), stroke });
    const rule = 'var(--rule, #d4cec0)';
    const ink = 'var(--ink, #24241f)';
    const accent = 'var(--accent, #a33d2d)';
    const paper = preview ? '#f0ebdf' : 'var(--paper, #f7f4eb)';
    group.append(horizontalRule(0, rule));
    if (preview) {
      // Keep the small gallery cards legible without turning them into a second
      // graph: a pair of age and closeness guides gives the curves some context,
      // while the actual relationship geometry remains untouched.
      const previewGuide = attributes => node('line', {
        stroke: rule, 'stroke-width': 1, 'stroke-dasharray': '2 4', opacity: .42,
        'pointer-events': 'none', ...attributes
      });
      if (span > 2) {
        for (const fraction of [1 / 3, 2 / 3]) {
          const guideY = y(span * fraction);
          group.append(previewGuide({ x1: 7, x2: width - 7, y1: guideY, y2: guideY }));
        }
      }
      for (const fraction of [.5, -.5]) {
        const guideX = x(fraction);
        group.append(previewGuide({ x1: guideX, x2: guideX, y1: top, y2: bottom }));
      }
    } else {
      for (const guideX of scalePositions(svg)) group.append(node('line', {
        x1: guideX, x2: guideX, y1: top, y2: bottom, stroke: rule,
        'stroke-width': 1, 'stroke-dasharray': '3 5', opacity: .6, 'pointer-events': 'none'
      }));
      const pixelsPerYear = span ? (bottom - top) / span : 0;
      const step = pixelsPerYear >= 32 ? 1 : pixelsPerYear >= 16 ? 2 : pixelsPerYear >= 8 ? 5 : pixelsPerYear >= 4 ? 10 : 20;
      for (let tick = step; tick < span && bottom - y(tick) > 20; tick += step) {
        group.append(horizontalRule(tick, rule));
        text.append(node('text', { x: 8, y: y(tick) - 6 }, `Age ${tick}`));
      }
      text.append(node('text', { x: 8, y: top - 6 }, 'Birth'));
      const endText = ending === 'now' ? `Now · Age ${displayAge}` : ending === 'death' ? `Death · Age ${displayAge}` : `Age ${displayAge}`;
      text.append(node('text', { x: width - 8, y: bottom - 6, 'text-anchor': 'end', 'font-weight': 700, fill: ending === 'death' ? accent : ink }, endText));
    }
    for (const event of events) {
      if (!Number.isFinite(Number(event.age)) || event.age < 0 || event.age > span) continue;
      const eventY = y(Number(event.age));
      const eventLine = node('line', { x1: 8, x2: preview ? width * .46 : width - 8, y1: eventY, y2: eventY,
        stroke: accent, 'stroke-width': preview ? 1 : 1.2, 'stroke-dasharray': '2 3', opacity: .72 });
      group.append(eventLine);
      const typeLabel = eventTypeLabel(event.type);
      const eventLabel = [typeLabel, event.label].filter(Boolean).join(' · ');
      if (eventLabel) eventLine.append(node('title', {}, eventLabel));
      const compact = compactEvents && !preview;
      const chipX = 64;
      const chipWidth = Math.min(130, Math.max(70, (typeLabel?.length || 0) * 5.5 + 16), width - chipX - 16);
      const shortType = typeLabel?.length > 19 ? `${typeLabel.slice(0, 18)}…` : typeLabel;
      if (!preview && event.type) {
        if (compact) text.append(node('rect', { x: chipX, y: eventY - 25, width: chipWidth, height: 22, rx: 3, fill: paper, stroke: rule, 'stroke-width': 1, 'pointer-events': 'none' }));
        text.append(node('text', { x: compact ? chipX + 7 : -12, y: compact ? eventY - 10 : eventY + 3, 'text-anchor': compact ? 'start' : 'end', 'font-size': compact ? 10 : 9, fill: accent, 'pointer-events': 'none' }, compact ? shortType : typeLabel));
      }
      if (!preview && eventLabel && tooltip) {
        const hit = node('rect', { x: compact ? chipX : -100, y: compact ? eventY - 32 : eventY - 16, width: compact ? chipWidth : 94, height: compact ? 40 : 32,
          fill: 'transparent', 'pointer-events': 'all', class: 'plot-hit',
          tabindex: 0, role: 'button', 'aria-label': eventLabel });
        const show = event => {
          tooltip.textContent = eventLabel;
          tooltip.hidden = false;
          const anchor = hit.getBoundingClientRect();
          const hasPointer = event && Number.isFinite(event.clientX) && event.clientX > 0 && event.clientY > 0;
          const pointX = hasPointer ? event.clientX : anchor.left + anchor.width / 2;
          const pointY = hasPointer ? event.clientY : anchor.top;
          const left = Math.min(Math.max(8, pointX + 12), window.innerWidth - tooltip.offsetWidth - 8);
          const top = Math.min(Math.max(8, pointY - tooltip.offsetHeight - 10), window.innerHeight - tooltip.offsetHeight - 8);
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        };
        const hide = () => { tooltip.hidden = true; };
        hit.addEventListener('pointerenter', show);
        hit.addEventListener('pointermove', show);
        hit.addEventListener('pointerdown', show);
        hit.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') hide(); });
        hit.addEventListener('focus', show);
        hit.addEventListener('blur', hide);
        hit.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          show(event);
        });
        eventHits.append(hit);
      }
    }
    if (span) group.append(horizontalRule(span, preview ? rule : ink));
    group.append(
      node('line', { x1: mid, x2: mid, y1: top, y2: bottom, stroke: ink, 'stroke-width': preview ? 1.5 : 2.2 }),
      node('circle', { cx: mid, cy: top, r: preview ? 2 : 3.1, fill: ink })
    );

    const ordered = lines.map((line, index) => ({ line, index }));
    if (selected !== null) ordered.push(...ordered.splice(selected, 1));
    for (const { line, index } of ordered) {
      const points = line.points.map(([time, distance]) => [x(distance), y(time)]);
      const [firstX, firstY] = points[0];
      const [endX, endY] = points.at(-1);
      const color = /^#[0-9a-f]{6}$/i.test(line.color) ? line.color : ink;
      const emphasized = selected === index;
      const thread = node('g', { opacity: selected === null || emphasized ? 1 : .25 });
      const curve = node('path', { d: pathFor(points), fill: 'none', stroke: color,
        'stroke-width': lineWidth + (emphasized ? 1 : 0), 'stroke-linecap': 'round' });
      if (line.ending === 'fade' && points.length > 1) {
        const id = `${prefix}-fade-${index}`;
        fadeMask(defs, id, width, height, y(fadeStartAge(line.points)), endY);
        curve.setAttribute('mask', `url(#${id})`);
      }
      thread.append(curve, node('circle', { cx: firstX, cy: firstY, r: preview ? 1.65 : 2.9, fill: color }));
      if (line.ending === 'death') {
        thread.append(node('circle', { cx: endX, cy: endY, r: preview ? 2.6 : 4.6, fill: paper, stroke: accent, 'stroke-width': preview ? .85 : 1.5 }));
      }
      if (line.label && !tooltip) thread.append(node('title', {}, line.label));
      group.append(thread);

      // Keep the visible drawing quiet, but give each line a generous, touch-friendly
      // target for the read-only timeline and gallery previews. The hit layer never
      // intercepts the enclosing card link, so hovering a thumbnail preserves navigation.
      if (line.label && tooltip) {
        const hit = node('path', {
          d: pathFor(points), fill: 'none', stroke: 'transparent', 'stroke-width': 18,
          'stroke-linecap': 'round', 'pointer-events': 'stroke', 'class': 'plot-hit',
          ...(preview ? {} : { tabindex: 0, role: 'button', 'aria-label': line.label })
        });
        const show = event => {
          if (!tooltip) return;
          tooltip.textContent = line.label;
          tooltip.hidden = false;
          const anchor = hit.getBoundingClientRect();
          const hasPointer = event && Number.isFinite(event.clientX) && event.clientX > 0 && event.clientY > 0;
          const x = hasPointer ? event.clientX : anchor.left + anchor.width / 2;
          const y = hasPointer ? event.clientY : anchor.top + anchor.height / 2;
          const left = Math.min(Math.max(8, x + 12), window.innerWidth - tooltip.offsetWidth - 8);
          const top = Math.min(Math.max(8, y - tooltip.offsetHeight - 10), window.innerHeight - tooltip.offsetHeight - 8);
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        };
        const hide = () => { if (tooltip) tooltip.hidden = true; };
        hit.addEventListener('pointerenter', show);
        hit.addEventListener('pointermove', show);
        hit.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') hide(); });
        hit.addEventListener('pointerdown', show);
        hit.addEventListener('focus', show);
        hit.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          show(event);
        });
        hit.addEventListener('blur', hide);
        hits.append(hit);
      }
    }
    if (ending === 'death') group.append(node('circle', { cx: mid, cy: bottom, r: 5, fill: paper, stroke: accent, 'stroke-width': 1.5 }));
    if (tooltip) tooltip.hidden = true;
    svg.replaceChildren(defs, group, hits, text, eventHits);
  }

  return { eventOptions, canonicalEventType, eventTypeLabel, node, render, relationshipType, namedLines, publicLines, scalePositions, fadeStartAge };
})();
