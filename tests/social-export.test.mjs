import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../public/social-export.js',import.meta.url),'utf8');
function renderer(extra={}) {
  return vm.runInNewContext(`${source}\nClosenessExport`, {Path2D:class {constructor(path){this.path=path;}},...extra});
}
function canvas() {
  const strokes=[],texts=[];
  const context=new Proxy({measureText(text){return {width:String(text).length*14};},fillText(text,x,y){texts.push({text,x,y});},stroke(path){if(path)strokes.push({path:path.path,style:this.strokeStyle,dash:this.dash});},setLineDash(values){this.dash=Array.from(values);},createLinearGradient(){return {gradient:true,addColorStop(){}};}},{get(object,key){return key in object?object[key]:()=>{};}});
  return {width:0,height:0,getContext:()=>context,strokes,texts};
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

test('video labels follow the latest visible point instead of disappearing after the camera moves',()=>{
  const exporter=renderer();
  const model={lines:[
    {label:'University friend',points:[[2,-.4],[25,-.2],[60,-.7]]},
    {label:'Life partner',points:[[18,.3],[45,.5],[80,.2]]},
    {label:'Mum',points:[[0,.1],[80,.1]]}
  ]};
  const camera=exporter.cameraFor(80,.75,true);
  const labels=exporter.labelPoints(model,camera);
  assert.deepEqual(labels.map(item=>[item.line.label,item.point[0]]),[
    ['University friend',60],['Life partner',60],['Mum',60]
  ]);
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


test('video draws readable labels inside the frame after scrolling past their starts',()=>{
  const target=canvas();
  renderer().render(target,{age:80,timeScale:'recent',lines:[
    {label:'Mum',points:[[0,-.1],[80,-.1]]},
    {label:'Life partner',points:[[20,-.2],[80,-.2]]},
    {label:'Dad',points:[[0,.1],[80,.1]]}
  ]},{scrolling:true,progress:.75});
  const labels=target.texts.filter(item=>['Mum','Life partner','Dad'].includes(item.text));
  assert.equal(labels.length,3);
  for(const label of labels){assert.ok(label.x>0&&label.x<1080);assert.ok(label.y>185&&label.y<1770);}
  const left=labels.filter(item=>item.x<540);
  assert.ok(Math.abs(left[0].y-left[1].y)>=40);
});
