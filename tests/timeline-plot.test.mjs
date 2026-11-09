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
