'use strict';

/* A deliberately small canvas-only renderer for shareable Closeness Lines. */
const ClosenessExport = (() => {
  const palette = {
    family: '#4f6e85',
    friends: '#3e725f',
    romance: '#9c4c59',
    work: '#846629',
    pets: '#765f8d'
  };
  const ink = '#282721';
  const muted = '#777166';
  const rule = '#d7d0c1';
  const paper = '#f7f3e9';
  const red = '#a33d2d';
  const serif = 'Georgia, "Times New Roman", serif';
  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function maxAgeFor(model = {}) {
    return Math.max(1, Number(model.age) || 0, ...(Array.isArray(model.lines) ? model.lines.flatMap(line => (line.points || []).map(point => Number(point[0]) || 0)) : []));
  }

  function cameraFor(maxAge, progress = 1, scrolling = false, windowYears = 18) {
    const age = Math.max(1, Number(maxAge) || 1);
    const reveal = age * clamp(Number(progress) || 0, 0, 1);
    const window = scrolling ? Math.min(windowYears, age) : age;
    const top = scrolling ? clamp(reveal - window * 0.75, 0, Math.max(0, age - window)) : 0;
    return { maxAge: age, revealAge: reveal, windowAge: window, cameraTop: top, cameraBottom: top + window };
  }

  function safeModel(model = {}) {
    const lines = Array.isArray(model.lines) ? model.lines : [];
    return {
      age: finite(model.age) ? Math.max(0, Number(model.age)) : 0,
      tagline: typeof model.tagline === 'string' ? model.tagline.trim() : '',
      timeScale: model.timeScale === 'equal' ? 'equal' : 'recent',
      lines: lines.map((line, index) => ({
        label: typeof line?.label === 'string' ? line.label : '',
        color: /^#[0-9a-f]{6}$/i.test(line?.color) ? line.color : (palette[line?.category] || ink),
        dash: Array.isArray(line?.dash) ? line.dash.filter(value=>Number.isFinite(value)&&value>0).slice(0,8) : [],
        ending: line?.ending === 'death' || line?.ending === 'fade' ? line.ending : 'ongoing',
        points: (Array.isArray(line?.points) ? line.points : [])
          .filter(point => Array.isArray(point) && finite(point[0]) && finite(point[1]))
          .map(point => [Math.max(0, Number(point[0])), clamp(Number(point[1]), -1, 1)])
          .sort((a, b) => a[0] - b[0])
      })).filter(line => line.points.length),
      events: (Array.isArray(model.events) ? model.events : [])
        .filter(event => finite(event?.age))
        .map(event => ({ age: Math.max(0, Number(event.age)), type: String(event.type || ''), label: String(event.label || '') }))
    };
  }

  function path(points, x, y) {
    if (!points.length) return '';
    let d = `M ${x(points[0][1])} ${y(points[0][0])}`;
    for (let i = 1; i < points.length; i++) {
      const [a0, d0] = points[i - 1];
      const [a1, d1] = points[i];
      const bend = (y(a1) - y(a0)) / 3;
      d += ` C ${x(d0)} ${y(a0) + bend} ${x(d1)} ${y(a1) - bend} ${x(d1)} ${y(a1)}`;
    }
    return d;
  }

  function visiblePoints(points, age) {
    if (!points.length || age < points[0][0]) return [];
    const result = [];
    for (let i = 0; i < points.length; i++) {
      if (points[i][0] <= age) result.push(points[i]);
      else {
        const previous = points[i - 1];
        if (previous && points[i][0] > previous[0]) {
          const t = (age - previous[0]) / (points[i][0] - previous[0]);
          result.push([age, previous[1] + (points[i][1] - previous[1]) * clamp(t, 0, 1)]);
        }
        break;
      }
    }
    return result;
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function textLines(ctx, text, x, y, lineHeight) {
    String(text).split(/\n/).slice(0, 2).forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight, ctx.canvas ? ctx.canvas.width * .8 : 850));
  }

  function render(canvas, input, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('ClosenessExport.render requires a canvas');
    const model = safeModel(input);
    const width = Math.max(240, Number(options.width) || 1080);
    const height = Math.max(320, Number(options.height) || 1920);
    const progress = clamp(finite(options.progress) ? Number(options.progress) : 1, 0, 1);
    const scrolling = options.scrolling === true;
    const ctx = canvas.getContext('2d');
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'alphabetic';

    const camera = cameraFor(maxAgeFor(model), progress, scrolling);
    const { maxAge, revealAge, windowAge, cameraTop, cameraBottom } = camera;
    const marginX = Math.max(58, width * 0.105);
    const axis = width / 2;
    const top = scrolling ? 185 : Math.max(150, height * 0.15);
    const bottom = scrolling ? height - 150 : height - Math.max(170, height * 0.145);
    const span = Math.max(1, bottom - top);
    const x = distance => axis + distance * (width / 2 - marginX);
    const ratio = age => model.timeScale === 'equal' ? age/maxAge : Math.pow(Math.max(0,age/maxAge),1.6);
    const ratioTop=ratio(cameraTop),ratioSpan=ratio(cameraBottom)-ratioTop;
    const y = age => top + ((ratio(age)-ratioTop) / ratioSpan) * span;

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(width * 0.038)}px ${serif}`;
    ctx.fillText('The people we keep', axis, 58);
    if (model.tagline) {
      ctx.fillStyle = muted;
      ctx.font = `${Math.round(width * 0.018)}px ${serif}`;
      textLines(ctx, model.tagline, axis, 91, Math.round(width * 0.026));
    }

    ctx.strokeStyle = rule;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    const tickStep = span / windowAge >= 24 ? 5 : span / windowAge >= 13 ? 10 : 20;
    const firstTick = scrolling ? Math.max(tickStep, Math.ceil(cameraTop / tickStep) * tickStep) : tickStep;
    const lastTick = scrolling ? Math.min(maxAge, cameraBottom) : maxAge;
    for (let tick = firstTick; tick < lastTick; tick += tickStep) {
      ctx.beginPath(); ctx.moveTo(marginX, y(tick)); ctx.lineTo(width - marginX, y(tick)); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(axis, top); ctx.lineTo(axis, bottom); ctx.stroke();
    ctx.fillStyle = ink;
    if (cameraTop === 0) {ctx.beginPath(); ctx.arc(axis, top, 4, 0, Math.PI * 2); ctx.fill();}
    ctx.font = `${Math.round(width * 0.019)}px ${serif}`;
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    if (!scrolling || cameraTop <= 0) ctx.fillText('birth', axis - 14, y(0) + 5);
    for (let tick = firstTick; tick < lastTick; tick += tickStep) ctx.fillText(String(tick), axis - 14, y(tick) + 5);
    ctx.textAlign = 'left';
    ctx.fillText(scrolling ? `age ${Math.floor(revealAge)}` : `age ${Math.round(maxAge)}`, axis + 14, bottom + 5);
    ctx.textAlign = 'center';
    ctx.fillText('PERSON', axis, top - 20);
    ctx.textAlign = 'left';
    ctx.fillText('farther', marginX, top - 20);
    ctx.textAlign = 'right';
    ctx.fillText('farther', width - marginX, top - 20);
    ctx.textAlign = 'center';
    ctx.fillText('closer', axis - (width / 2 - marginX) * 0.5, top - 20);
    ctx.fillText('closer', axis + (width / 2 - marginX) * 0.5, top - 20);

    const drawSegment = (line, points, from, to, stroke = line.color) => {
      if (points.length < 2) return;
      const segment = points.slice(from, to + 1);
      if (segment.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(3, width * 0.0032);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke;
      ctx.setLineDash(line.dash.map(value=>value*1.6));
      ctx.stroke(new Path2D(path(segment, x, y)));
    };

    const revealBottom = scrolling ? Math.min(bottom, y(revealAge)) : Math.min(bottom, y(revealAge));
    model.lines.forEach(line => {
      if (!line.points.length || line.points[0][0] > revealAge || line.points.at(-1)[0] < cameraTop) return;
      const complete = revealAge >= line.points[line.points.length - 1][0];
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top, width, Math.max(0, revealBottom - top));
      ctx.clip();
      const finalIndex = line.points.length - 1;
      if (line.ending === 'fade' && line.points.length > 1) {
        drawSegment(line, line.points, 0, finalIndex - 1);
        const start = line.points[line.points.length - 2];
        const end = line.points[line.points.length - 1];
        ctx.beginPath(); ctx.lineWidth = Math.max(3, width * 0.0032); ctx.lineCap = 'round';
        const gradient = ctx.createLinearGradient(x(start[1]), y(start[0]), x(end[1]), y(end[0]));
        gradient.addColorStop(0, line.color); gradient.addColorStop(1, `${line.color}00`);
        ctx.strokeStyle = gradient;
        ctx.setLineDash(line.dash.map(value=>value*1.6));
        ctx.stroke(new Path2D(path([start, end], x, y)));
      } else drawSegment(line, line.points, 0, finalIndex);
      ctx.restore();
      const first = line.points[0];
      if (first[0] >= cameraTop && first[0] <= cameraBottom && first[0] <= revealAge) {
        ctx.fillStyle = line.color;
        ctx.beginPath(); ctx.arc(x(first[1]), y(first[0]), Math.max(4, width * 0.004), 0, Math.PI * 2); ctx.fill();
      }
      if (line.ending === 'death' && complete) {
        const last = line.points.at(-1);
        ctx.fillStyle = paper; ctx.strokeStyle = red; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x(last[1]), y(last[0]), Math.max(8, width * 0.008), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x(last[1]), y(last[0]), Math.max(3, width * 0.003), 0, Math.PI * 2); ctx.stroke();
      }
    });

    const labels = model.lines.map(line => ({ line, point: line.points[0] })).filter(item => item.line.label && (!scrolling || (item.point[0] >= cameraTop && item.point[0] <= cameraBottom && item.point[0] <= revealAge)));
    const labelOrder = [...labels].sort((a, b) => y(a.point[0]) - y(b.point[0]));
    const showLabels = labels.length <= 8 && labelOrder.every((item, index) => index === 0 || Math.abs(y(item.point[0]) - y(labelOrder[index - 1].point[0])) >= width * 0.032);
    ctx.font = `${Math.round(width * 0.019)}px ${serif}`;

    if (showLabels && !scrolling) {
      ctx.textBaseline = 'middle';
      labels.forEach(({ line, point }) => {
        const label = line.label;
        const right = point[1] >= 0;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.fillStyle = line.color;
        ctx.fillText(label, x(point[1]) + (right ? 12 : -12), y(point[0]), Math.max(80, (right ? width-x(point[1]) : x(point[1]))-24));
      });
    } else if (!scrolling) {
      const grouped=new Map();
      for(const item of labels){
        const key=JSON.stringify([item.line.label,item.line.color,item.line.dash]);
        const entry=grouped.get(key);
        if(entry)entry.count++; else grouped.set(key,{...item,count:1});
      }
      const legendLabels=[...grouped.values()];
      const legendY = bottom + 54;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = muted;
      ctx.font = `${Math.round(width * 0.018)}px ${serif}`;
      const maxRows = Math.max(1, Math.floor((height - legendY - 58) / 22));
      const maxItems = maxRows * 2;
      legendLabels.slice(0, maxItems).forEach(({ line, count }, index) => {
        const col = index % 2; const row = Math.floor(index / 2);
        const lx = marginX + col * ((width - marginX * 2) / 2);
        const ly = legendY + row * 22;
        ctx.strokeStyle=line.color;ctx.lineWidth=3;ctx.setLineDash(line.dash.map(value=>value*1.6));ctx.beginPath();ctx.moveTo(lx-6,ly);ctx.lineTo(lx+22,ly);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle = ink; ctx.fillText(line.label+(count>1?` ×${count}`:''), lx + 32, ly, (width-marginX*2)/2-45);
      });
      if (legendLabels.length > maxItems) {
        const col = maxItems % 2; const row = Math.floor(maxItems / 2);
        const lx = marginX + col * ((width - marginX * 2) / 2);
        ctx.fillStyle = muted; ctx.fillText(`+${legendLabels.length - maxItems} more`, lx + 11, legendY + row * 22);
      }
    }

    model.events.filter(event => event.age >= cameraTop && event.age <= revealAge && event.age <= cameraBottom).forEach(event => {
      const ey = y(event.age);
      ctx.strokeStyle = red; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(marginX, ey); ctx.lineTo(width - marginX, ey); ctx.stroke(); ctx.setLineDash([]);
      const label = [event.type, event.label].filter(Boolean).join(' · ');
      if (label) { ctx.fillStyle = red; ctx.font = `${Math.round(width * 0.016)}px ${serif}`; ctx.textAlign = 'left'; ctx.fillText(label, marginX + 8, ey - 7, width-marginX*2-16); }
    });
    ctx.fillStyle = muted; ctx.font = `${Math.round(width * 0.016)}px ${serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('closenesslines.com', axis, height - 34);
    if (typeof options.onProgress === 'function') options.onProgress(progress);
    return canvas;
  }

  function record(model, options = {}) {
    const canvas = options.canvas || (typeof document !== 'undefined' && document.createElement('canvas'));
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      return Promise.reject(new Error('Video recording is not supported in this browser'));
    }
    if (options.signal?.aborted) return Promise.reject(Object.assign(new Error('Recording aborted'), { name: 'AbortError' }));
    const width = Number(options.width) || 1080;
    const height = Number(options.height) || 1920;
    const fps = 30;
    const mime = ['video/mp4;codecs=h264', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(type => MediaRecorder.isTypeSupported?.(type));
    try { render(canvas, model, { ...options, width, height, scrolling: true, progress: 0 }); } catch (error) { return Promise.reject(error); }
    let stream;
    let recorder;
    try {
      stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      return Promise.reject(new Error(`Video recording could not start: ${error.message || error}`));
    }
    const chunks = [];
    const maxAge = maxAgeFor(model);
    const duration = Math.max(1000, Number(options.revealMs) || clamp(maxAge * 350, 12000, 24000));
    const started = performance.now();
    let raf;
    let settled = false;
    return new Promise((resolve, reject) => {
      const cleanup = () => { if (raf) cancelAnimationFrame(raf); stream.getTracks().forEach(track => track.stop()); options.signal?.removeEventListener('abort', abort); };
      const abort = () => { if (settled) return; settled = true; if (recorder.state !== 'inactive') recorder.stop(); cleanup(); reject(Object.assign(new Error('Recording aborted'), { name: 'AbortError' })); };
      options.signal?.addEventListener('abort', abort, { once: true });
      recorder.addEventListener('dataavailable', event => { if (event.data?.size) chunks.push(event.data); });
      recorder.addEventListener('error', event => {
        if (settled) return;
        settled = true; cleanup();
        reject(event.error || new Error('Video recording failed'));
      }, { once: true });
      recorder.addEventListener('stop', () => {
        if (settled) return;
        settled = true; cleanup();
        resolve(new Blob(chunks, { type: recorder.mimeType || mime || 'video/webm' }));
      }, { once: true });
      try { recorder.start(); } catch (error) { settled = true; cleanup(); reject(error); return; }
      const frame = now => {
        if (settled) return;
        const progress = clamp((now - started) / duration, 0, 1);
        try { render(canvas, model, { ...options, width, height, scrolling: true, progress, onProgress: options.onProgress }); }
        catch (error) { settled = true; if (recorder.state !== 'inactive') recorder.stop(); cleanup(); reject(error); return; }
        if (progress < 1) raf = requestAnimationFrame(frame);
        else setTimeout(() => { if (!settled) recorder.stop(); }, 1000);
      };
      raf = requestAnimationFrame(frame);
    });
  }

  function supported() {
    return typeof document !== 'undefined' && typeof document.createElement === 'function' &&
      typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype &&
      typeof MediaRecorder !== 'undefined';
  }

  return { render, record, supported, maxAgeFor, cameraFor };
})();

if (typeof globalThis !== 'undefined') globalThis.ClosenessExport = ClosenessExport;
