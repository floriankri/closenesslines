import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/timeline-plot.js', import.meta.url), 'utf8');
const plot = vm.runInNewContext(`${source}\nClosenessPlot`);

test('an abrupt exit after decades does not fade earlier relationship history', () => {
  for (const side of [-1, 1]) {
    const points = [[0, side * .8], [10, side * .1], [49.9, side * .1], [50, side]];
    assert.equal(plot.fadeStartAge(points), 49.9);
  }
});

test('the final segment controls fade timing even after multiple outward edits', () => {
  assert.equal(plot.fadeStartAge([[0, .1], [10, .3], [20, .7], [25, 1]]), 20);
  assert.equal(plot.fadeStartAge([[0, .1], [20, .1], [25, .1]]), 20);
  assert.equal(plot.fadeStartAge([[5, .1]]), 5);
});

test('named relationship labels retain both role and private name without duplicates', () => {
  const track = {id:'grandparent',category:'family',subtype:'Grandparent',name:'Esther',ending:'ongoing',points:[[0,.2],[30,.2]]};
  assert.equal(plot.namedLines({relationships:[track]})[0].label, 'Grandparent · Esther');
  assert.equal(plot.namedLines({relationships:[{...track,name:'Grandparent'}]})[0].label, 'Grandparent');
});

test('simplified life event options retain API compatibility and accept old change events', () => {
  assert.deepEqual(Array.from(plot.eventOptions, ([,label]) => label), ['Moved', 'School', 'University', 'Job', 'Retirement', 'Other']);
  assert.equal(plot.eventTypeLabel('University change'), 'University');
  assert.equal(plot.canonicalEventType('University change'), 'University');
  assert.equal(plot.eventTypeLabel('Job change'), 'Job');
  assert.equal(plot.canonicalEventType('Job change'), 'New job');
  assert.equal(plot.eventTypeLabel('Moved city'), 'Moved');
});

test('relationship styles follow types rather than custom names or array position',()=>{
  const a={category:'friends',subtype:'University friend',name:'Dave'};
  const b={...a,name:'Eva'};
  assert.equal(plot.trackColor(a,[a,b]),plot.trackColor(b,[a,b]));
  assert.deepEqual(Array.from(plot.trackDash(a)),[]);
  assert.deepEqual(Array.from(plot.trackDash(a)),Array.from(plot.trackDash(b)));
  assert.notEqual(plot.trackColor({...a,subtype:'Friend group'}),plot.trackColor(a));
  const named=plot.namedLines({relationships:[{...a,points:[[18,.5]],ending:'ongoing'}]})[0];
  const publicLine=plot.publicLines([{type:'University friend',color:'#3e725f',points:[[18,.5]],ending:'ongoing'}])[0];
  assert.equal(named.color,publicLine.color);
  assert.deepEqual(Array.from(named.dash),Array.from(publicLine.dash));
});
test('recent-years mapping is the default and pointer mapping is its exact inverse',()=>{
  assert.equal(plot.getTimeScale(),'recent');
  for(const mode of ['recent','equal'])for(const max of [6,27.167,88])for(const age of [0,.01,max/2,max,max+1,-1]){
    assert.ok(Math.abs(plot.ratioAge(plot.ageRatio(age,max,mode),max,mode)-age)<1e-9);
  }
  assert.ok(plot.ageRatio(10,80,'recent')<plot.ageRatio(10,80,'equal'));
  plot.setTimeScale('equal'); assert.equal(plot.getTimeScale(),'equal');
  plot.setTimeScale('recent');
});


test('export patterns start solid and change only for a new role within a category',()=>{
  const items=[{category:'friends',subtype:'Childhood friend',name:'A'},{category:'friends',subtype:'Childhood friend',name:'B'},{category:'friends',subtype:'University friend',name:'C'},{category:'friends',subtype:'University friend',name:'D'},{category:'family',subtype:'Parent'}];
  const patterns=Array.from(plot.exportDashes(items),dash=>Array.from(dash));
  assert.deepEqual(patterns,[[],[],[2,4],[2,4],[]]);
  for(const item of items)assert.deepEqual(Array.from(plot.trackDash(item)),[]);
});

test('gallery previews show scaled age context without private event markers or a tinted paper fill', () => {
  class Element {
    constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
  }
  const previewPlot = vm.runInNewContext(`${source}\nClosenessPlot`, {
    document: { createElementNS: (_, tag) => new Element(tag) }
  });
  const svg = new Element('svg');
  previewPlot.render(svg, { age: 80, duration: 80, lines: [], preview: true,
    events: [{ age: 25, type: 'Moved city', label: 'Private place' }] });
  const flatten = node => [node, ...node.children.flatMap(flatten)];
  const nodes = flatten(svg);
  const labels = nodes.filter(n => n.tag === 'text').map(n => n.textContent);
  assert.ok(labels.includes('Birth'));
  assert.ok(labels.includes('Age 20'));
  assert.ok(labels.includes('Age 80'));
  assert.ok(!labels.some(label => String(label).includes('Moved') || String(label).includes('Private')));
  assert.ok(!nodes.some(n => n.attributes.fill === '#f0ebdf'));
  const eventLayer = nodes.find(n => n.attributes['aria-label'] === 'Life events');
  assert.equal(eventLayer.children.length, 0);
});
