import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../prototypes/time-scale.js',import.meta.url),'utf8');
const context={};vm.runInNewContext(source,context);
const {mapAge}=context.TimeScalePrototype;
test('experimental time mappings preserve birth, endpoint and chronological order at every age',()=>{
  for(const horizon of [6,12,27,60,88])for(const mode of ['equal','childhood','recent'])for(const strength of [0,.5,1]){
    assert.equal(mapAge(0,mode,12,strength,horizon),0);
    assert.ok(Math.abs(mapAge(horizon,mode,12,strength,horizon)-horizon)<1e-9);
    let previous=-1;
    for(let step=0;step<=1000;step++){
      const value=mapAge(horizon*step/1000,mode,12,strength,horizon);
      assert.ok(value>previous,`${mode}: strict order at ${horizon}/${step}`);
      previous=value;
    }
  }
});
test('childhood compression gives early years less room without a sudden scale break',()=>{
  assert.ok(mapAge(12,'childhood',12,.5,88)<12);
  const delta=.0001,knee=12;
  const before=(mapAge(knee,'childhood',12,.5,88)-mapAge(knee-delta,'childhood',12,.5,88))/delta;
  const after=(mapAge(knee+delta,'childhood',12,.5,88)-mapAge(knee,'childhood',12,.5,88))/delta;
  assert.ok(Math.abs(before-after)<.001);
});
