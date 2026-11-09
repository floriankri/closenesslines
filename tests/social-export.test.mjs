import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../public/social-export.js',import.meta.url),'utf8');
function renderer(extra={}) {
  return vm.runInNewContext(`${source}\nClosenessExport`, {Path2D:class {constructor(path){this.path=path;}},...extra});
}
function canvas() {
  const strokes=[];
  const context=new Proxy({stroke(path){if(path)strokes.push({path:path.path,style:this.strokeStyle,dash:this.dash});},setLineDash(values){this.dash=Array.from(values);},createLinearGradient(){return {gradient:true,addColorStop(){}};}},{get(object,key){return key in object?object[key]:()=>{};}});
  return {width:0,height:0,getContext:()=>context,strokes};
}
test('export fade does not repaint its final segment with opaque color',()=>{
  const target=canvas();
  renderer().render(target,{age:50,lines:[{color:'#4f6e85',ending:'fade',points:[[0,.1],[40,.2],[50,1]]}]});
  assert.equal(target.width,1080);assert.equal(target.height,1920);
  assert.equal(target.strokes.length,2);
  assert.equal(target.strokes[0].style,'#4f6e85');
  assert.equal(target.strokes[1].style.gradient,true);
  assert.equal((target.strokes[0].path.match(/ C /g)||[]).length,1);
});
test('video rejects pre-cancelled recording before opening any stream',async()=>{
  let opened=false;
  const exporter=renderer({MediaRecorder:class {}});
  await assert.rejects(exporter.record({}, {canvas:{captureStream(){opened=true;}},signal:{aborted:true}}),{name:'AbortError'});
  assert.equal(opened,false);
});


test('video camera starts at birth and follows time without scrolling past the end',()=>{
  const exporter=renderer();
  for(const age of [8,31,88]){
    const start=exporter.cameraFor(age,0,true);
    const middle=exporter.cameraFor(age,.5,true);
    const end=exporter.cameraFor(age,1,true);
    assert.equal(start.cameraTop,0);
    assert.equal(end.cameraBottom,age);
    assert.ok(middle.cameraTop>=start.cameraTop && middle.cameraTop<=end.cameraTop);
    assert.ok(end.windowAge<=18);
  }
  assert.equal(exporter.cameraFor(88,1,false).cameraTop,0);
  assert.equal(exporter.cameraFor(88,1,false).windowAge,88);
});


test('image and scrolling export use the selected time expansion and supplied type pattern',()=>{
  for(const scrolling of [false,true]){
    const points=[[0,.2],[10,.4]],line={color:'#3e725f',dash:[2,4],points,ending:'ongoing'};
    const recent=canvas(),equal=canvas();
    renderer().render(recent,{age:40,timeScale:'recent',lines:[line]},{scrolling,progress:scrolling?.5:1});
    renderer().render(equal,{age:40,timeScale:'equal',lines:[line]},{scrolling,progress:scrolling?.5:1});
    const endY=target=>Number(target.strokes[0].path.match(/-?[0-9]+(?:\.[0-9]+)?/g).at(-1));
    assert.ok(endY(recent)<endY(equal));
    assert.equal(recent.strokes[0].style,'#3e725f');
    assert.deepEqual(recent.strokes[0].dash,[3.2,6.4]);
  }
});
