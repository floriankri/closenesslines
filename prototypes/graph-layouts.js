'use strict';
// The same illustrative relationships used on the home page. No saved personal data.
const tracks = [
  ['Mum','family',[[0,9],[6,13],[11,20],[15,72],[18,58],[24,25],[31,28],[42,22],[51,26],[57,16],[61,10]],true],
  ['Dad','family',[[0,17],[9,21],[12,27],[16,85],[19,72],[26,34],[33,37],[42,32],[49,35],[54,17]],true],
  ['Childhood friend','friends',[[4,55],[7,25],[13,35],[17,46],[21,79],[27,91]],false,17],
  ['School friend','friends',[[7,69],[12,29],[17,19],[21,48],[29,56],[38,68],[41,79],[44,91]],false,38],
  ['School friends','friends',[[8,90],[13,54],[17,38],[19,67],[23,88],[27,96]],false,19],
  ['University friend','friends',[[18,83],[19,30],[22,27],[24,46],[34,49],[40,59],[43,73],[46,90]],false,40],
  ['First university friends','friends',[[18,96],[21,49],[23,66],[27,94],[32,98]],false,23],
  ['First fling','partner',[[19,74],[19.85,12],[20.35,2],[20.8,13],[22,91]],false,20.8],
  ['One-night stand','partner',[[22.3,45],[22.43,15],[22.55,1],[22.67,15],[22.8,52]],false,22.67],
  ['Second university friends','friends',[[23,97],[25,41],[27,35],[30,57],[38,85],[43,96]],false,30],
  ['Longer relationship','partner',[[24,79],[26,11],[29,15],[30,38],[31,90],[33,97]],false,30],
  ['First job colleagues','work',[[28,94],[30,52],[33,50],[35,70],[39,90],[44,98]],false,35],
  ['Friend from first job','work',[[28,84],[31,29],[35,53],[48,64],[58,78],[69,91],[73,96]],false,58],
  ['Life partner','partner',[[34,77],[36,19],[38,3],[41,2],[46,12],[50,4],[55,2],[60,10],[64,5],[68,2],[73,9],[76,3],[79,2]],true],
  ['Later colleagues','work',[[34,93],[38,56],[47,51],[58,55],[66,59],[68,84],[73,97]],false,66],
  ['Work friend','work',[[36,86],[42,45],[53,45],[64,42],[68,53],[71,70],[75,91]],false,68],
  ['Older child','family',[[39,16],[45,14],[51,22],[56,42],[63,32],[71,29],[77,33],[79,14],[84,18],[88,63]],false,84],
  ['Younger child','family',[[42,24],[48,19],[54,29],[59,48],[64,39],[70,34],[76,40],[81,21],[85,40],[88,73]],false,81],
  ['Dog','pet',[[40,52],[41,31],[46,27],[51,30]],true],
  ['Other school parents','friends',[[45,94],[48,55],[53,51],[57,75],[62,92],[65,98]],false,57],
  ['Friend from school pickup','friends',[[46,87],[50,44],[56,49],[59,66],[63,88]],false,56],
  ['Neighbor','friends',[[67,90],[70,65],[74,52],[79,42],[83,36],[85,42],[88,78]],false,83]
];
const colors = {family:'#4f6e85',friends:'#3e725f',partner:'#9c4c59',work:'#846629',pet:'#765f8d'};
const titles = {right:'Time ↓ · Farther →',down:'Time → · Farther ↓',up:'Time → · Farther ↑'};
const graph = document.querySelector('#graph');
const tooltip = document.querySelector('#tooltip');
const canvas = document.querySelector('.canvas');
let view = 'right', selected = null;
function el(tag, attrs={}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  if(text !== undefined) node.textContent=text;
  return node;
}
function hideTip(){tooltip.hidden=true;}
function tip(label,x,y){
  tooltip.textContent=label;tooltip.hidden=false;
  const rect=tooltip.getBoundingClientRect();
  tooltip.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,x+12))+'px';
  tooltip.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,y+12))+'px';
}
function select(index){selected=selected===index?null:index;render();}
function render(){
  hideTip();
  const horizontal=view!=='right', zoom=Number(document.querySelector('#zoom').value);
  const timeLength=1100*zoom, distanceLength=350, start=75, near=70;
  const width=horizontal?timeLength+130:distanceLength+130;
  const height=horizontal?distanceLength+130:timeLength+130;
  const at=(age,distance)=>horizontal?[start+age/88*timeLength,view==='up'?height-near-distance/100*distanceLength:near+distance/100*distanceLength]:[near+distance/100*distanceLength,start+age/88*timeLength];
  const nearStart=at(0,0),nearEnd=at(88,0);
  graph.setAttribute('width',width);graph.setAttribute('height',height);graph.setAttribute('viewBox',`0 0 ${width} ${height}`);
  graph.setAttribute('aria-label',titles[view]);
  canvas.className='canvas '+(horizontal?'horizontal':'vertical');
  document.querySelector('#view-title').textContent=titles[view];
  document.querySelector('#scroll-note').textContent=horizontal?'Scroll right through time. All distances are on one side of the person.':'Scroll down through time. All distances are to the right of the person.';
  document.querySelector('#selection').textContent=selected===null?'All relationships':tracks[selected][0];
  document.querySelector('#clear').disabled=selected===null;
  document.querySelector('#zoom-value').textContent=zoom+'×';
  const fragment=document.createDocumentFragment(),defs=el('defs');fragment.append(defs);
  for(let age=0;age<=88;age+=10){
    const a=at(age,0),b=at(age,100);
    fragment.append(el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'guide'}));
    fragment.append(el('text',{x:horizontal?a[0]:a[0]-12,y:horizontal?(view==='up'?a[1]+22:a[1]-14):a[1]+3,'text-anchor':horizontal?'middle':'end',class:'tick'},age===0?'Birth':`Age ${age}`));
  }
  for(const [distance,label] of [[0,'Person'],[12,'Closest'],[36,'Close friend'],[63,'Friend'],[92,'Acquaintance']]){
    const a=at(0,distance),b=at(88,distance);
    if(distance)fragment.append(el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'guide distance'}));
    fragment.append(el('text',{x:horizontal?a[0]-12:a[0],y:horizontal?a[1]+3:a[1]-30,'text-anchor':horizontal?'end':'middle',class:distance?'tick':'axis-label'},label));
  }
  fragment.append(el('line',{x1:nearStart[0],y1:nearStart[1],x2:nearEnd[0],y2:nearEnd[1],class:'axis'}),el('circle',{cx:nearStart[0],cy:nearStart[1],r:3.5,fill:'var(--ink)'}));
  const filter=document.querySelector('#filter').value;
  tracks.forEach(([name,category,points,death,fadeAge],index)=>{
    if(filter!=='all'&&filter!==category)return;
    const mapped=points.map(([age,d])=>at(age,Math.abs(d)));
    let path=`M${mapped[0].join(' ')}`;
    for(let i=1;i<mapped.length;i++){
      const [x0,y0]=mapped[i-1],[x1,y1]=mapped[i];
      path+=horizontal?`C${x0+(x1-x0)/3} ${y0} ${x1-(x1-x0)/3} ${y1} ${x1} ${y1}`:`C${x0} ${y0+(y1-y0)/3} ${x1} ${y1-(y1-y0)/3} ${x1} ${y1}`;
    }
    const group=el('g',{class:'relationship'+(selected===index?' selected':selected!==null?' dim':'')});
    const line=el('path',{d:path,stroke:colors[category],class:'curve'});
    if(!death&&fadeAge!==undefined){
      const from=at(fadeAge,0),to=at(points.at(-1)[0],0),id=`fade-${index}`;
      const gradient=el('linearGradient',{id,gradientUnits:'userSpaceOnUse',x1:from[0],y1:from[1],x2:to[0],y2:to[1]});
      gradient.append(el('stop',{offset:0,'stop-color':colors[category]}),el('stop',{offset:1,'stop-color':colors[category],'stop-opacity':0}));defs.append(gradient);line.setAttribute('stroke',`url(#${id})`);
    }
    const hit=el('path',{d:path,class:'line-hit',tabindex:0,role:'button','aria-label':name,'aria-pressed':String(selected===index)});
    hit.append(el('title',{},name));
    hit.addEventListener('click',event=>{event.stopPropagation();select(index);});
    hit.addEventListener('pointermove',event=>tip(name,event.clientX,event.clientY));hit.addEventListener('pointerleave',hideTip);
    hit.addEventListener('focus',()=>{const r=hit.getBoundingClientRect();tip(name,r.left,r.top);});hit.addEventListener('blur',hideTip);
    hit.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();select(index);graph.querySelector(`[aria-label="${name}"]`)?.focus();}});
    group.append(line,hit,el('circle',{cx:mapped[0][0],cy:mapped[0][1],r:2,fill:colors[category],'pointer-events':'none'}));
    if(death)group.append(el('circle',{cx:mapped.at(-1)[0],cy:mapped.at(-1)[1],r:3.5,class:'terminal'}));
    fragment.append(group);
  });
  graph.replaceChildren(fragment);
}
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{
  view=button.dataset.view;
  for(const tab of document.querySelectorAll('[data-view]'))tab.setAttribute('aria-pressed',String(tab===button));
  render();canvas.scrollTo(0,0);
});
document.querySelector('#filter').addEventListener('change',()=>{selected=null;render();});
document.querySelector('#zoom').addEventListener('input',render);
document.querySelector('#clear').addEventListener('click',()=>{selected=null;render();});
graph.addEventListener('click',()=>{selected=null;render();});
canvas.addEventListener('scroll',hideTip,{passive:true});
window.addEventListener('scroll',hideTip,{passive:true});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){selected=null;render();}});
render();
