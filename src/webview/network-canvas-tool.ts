import { LitElement, css, html, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { networkIcon } from './network-icons';

type NetworkNodeType = 'server' | 'database' | 'workstation' | 'balancer';
type NetworkLineType = 'solid' | 'dashed' | 'dotted' | 'double';

type NetworkNode = { id: string; type: NetworkNodeType; label: string; x: number; y: number; vlanId?: string };
type NetworkVlan = { id: string; name: string; color: string; x: number; y: number; width: number; height: number };
type NetworkConnection = { id: string; from: string; to: string; label?: string; lineType?: NetworkLineType };
export type NetworkCanvasData = {
  version: 1;
  nodes: NetworkNode[];
  vlans: NetworkVlan[];
  connections: NetworkConnection[];
  viewport: { x: number; y: number; scale: number };
};

type ToolArgs = { data?: Partial<NetworkCanvasData> };
type Point = { x: number; y: number };
type SelectedItem = { kind: 'node'; value: NetworkNode } | { kind: 'vlan'; value: NetworkVlan } | { kind: 'connection'; value: NetworkConnection };

const nodeTypes: Array<{ type: NetworkNodeType; label: string }> = [
  { type: 'server', label: 'Server' },
  { type: 'database', label: 'Database' },
  { type: 'workstation', label: 'Workstation' },
  { type: 'balancer', label: 'Balancer' }
];
const vlanColors = ['#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#10b981', '#6366f1'];
const lineTypes: NetworkLineType[] = ['solid', 'dashed', 'dotted', 'double'];

@customElement('slash-network-canvas')
export class NetworkCanvasElement extends LitElement {
  @property({ attribute: false }) data: NetworkCanvasData = createNetworkData();
  @state() private nodes: NetworkNode[] = [];
  @state() private vlans: NetworkVlan[] = [];
  @state() private connections: NetworkConnection[] = [];
  @state() private selectedId: string | null = null;
  @state() private connectingFrom: string | null = null;
  @state() private scale = 1;
  @state() private offset: Point = { x: 0, y: 0 };
  private initialized = false;
  private dragging?: { kind: 'node' | 'vlan'; id: string; offset: Point };
  private panning?: Point;

  static styles = css`
    :host { --nc-bg:var(--vscode-editor-background,#1e1e1e); --nc-card:var(--vscode-editorWidget-background,#252526); --nc-fg:var(--vscode-editor-foreground,#ccc); --nc-muted:var(--vscode-descriptionForeground,#999); --nc-border:var(--vscode-panel-border,#454545); --nc-primary:var(--vscode-charts-cyan,#06b6d4); display:block; width:100%; color:var(--nc-fg); font-family:var(--vscode-font-family,sans-serif); }
    * { box-sizing:border-box; }
    button,input,select { font:inherit; }
    .editor { display:grid; grid-template-columns:150px minmax(0,1fr); height:540px; overflow:hidden; border:1px solid var(--nc-border); border-radius:4px; background:var(--nc-bg); }
    .sidebar { z-index:5; display:flex; flex-direction:column; border-right:1px solid var(--nc-border); background:var(--nc-card); }
    .heading { margin:0; padding:12px; border-bottom:1px solid var(--nc-border); color:var(--nc-muted); font:600 11px/1.2 var(--vscode-editor-font-family,monospace); letter-spacing:.08em; text-transform:uppercase; }
    .items { display:grid; gap:6px; padding:9px; }
    .item { display:flex; align-items:center; gap:9px; padding:8px; color:var(--nc-fg); border:1px solid transparent; border-radius:4px; background:transparent; cursor:grab; text-align:left; }
    .item:hover { border-color:var(--nc-border); background:var(--vscode-list-hoverBackground,rgba(255,255,255,.06)); }
    .item .icon { display:grid; place-items:center; width:23px; height:23px; color:var(--item-color); border:1px solid currentColor; border-radius:4px; font:700 14px monospace; }
    .item span:last-child { font:500 11px var(--vscode-editor-font-family,monospace); }
    .separator { height:1px; margin:3px 0; background:var(--nc-border); }
    .help { margin-top:auto; padding:12px; color:var(--nc-muted); border-top:1px solid var(--nc-border); font:9px/1.5 var(--vscode-editor-font-family,monospace); }
    .stage { position:relative; min-width:0; overflow:hidden; }
    .canvas { position:absolute; inset:0; overflow:hidden; cursor:grab; background-color:var(--nc-bg); background-image:linear-gradient(color-mix(in srgb,var(--nc-muted) 18%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--nc-muted) 18%,transparent) 1px,transparent 1px); background-size:20px 20px; }
    .content { position:absolute; inset:0; transform-origin:0 0; }
    .connections { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }
    .connection { pointer-events:stroke; cursor:pointer; }
    .connection-label { font:10px var(--vscode-editor-font-family,monospace); fill:var(--nc-muted); text-anchor:middle; pointer-events:auto; cursor:pointer; }
    .vlan { position:absolute; z-index:1; border:2px dashed var(--vlan-color); border-radius:8px; background:color-mix(in srgb,var(--vlan-color) 8%,transparent); cursor:move; user-select:none; }
    .vlan.selected { outline:2px solid var(--vscode-focusBorder,#007fd4); outline-offset:2px; }
    .vlan-label { display:inline-block; padding:3px 8px; color:var(--vlan-color); border-radius:0 0 6px 0; background:color-mix(in srgb,var(--vlan-color) 20%,transparent); font:600 10px var(--vscode-editor-font-family,monospace); letter-spacing:.06em; }
    .network-node { position:absolute; z-index:3; display:flex; flex-direction:column; align-items:center; gap:6px; width:100px; color:var(--node-color); transform:translate(-50%,-50%); cursor:grab; user-select:none; }
    .node-card { display:grid; place-items:center; width:54px; height:48px; border:1px solid currentColor; border-radius:8px; background:var(--nc-card); box-shadow:0 0 12px color-mix(in srgb,var(--node-color) 30%,transparent); font:700 25px monospace; }
    .network-node.selected .node-card { outline:2px solid var(--vscode-focusBorder,#007fd4); transform:scale(1.08); }
    .node-label { max-width:100px; overflow:hidden; color:var(--nc-muted); font:10px var(--vscode-editor-font-family,monospace); text-overflow:ellipsis; white-space:nowrap; }
    .server { --node-color:var(--vscode-charts-cyan,#06b6d4); --item-color:var(--node-color); }.database { --node-color:var(--vscode-charts-purple,#8b5cf6); --item-color:var(--node-color); }.workstation { --node-color:var(--vscode-charts-green,#10b981); --item-color:var(--node-color); }.balancer { --node-color:var(--vscode-charts-orange,#f97316); --item-color:var(--node-color); }.vlan-item { --item-color:#06b6d4; }
    .hint { position:absolute; z-index:8; top:10px; left:50%; padding:5px 10px; color:var(--nc-primary); border:1px solid color-mix(in srgb,var(--nc-primary) 50%,transparent); border-radius:999px; background:var(--nc-card); transform:translateX(-50%); font-size:10px; }
    .toolbar { position:absolute; z-index:8; bottom:10px; left:50%; display:flex; align-items:center; gap:3px; padding:5px; border:1px solid var(--nc-border); border-radius:6px; background:color-mix(in srgb,var(--nc-card) 92%,transparent); transform:translateX(-50%); }
    .toolbar button { min-width:28px; height:27px; color:var(--nc-fg); border:0; border-radius:3px; background:transparent; cursor:pointer; }.toolbar button:hover { background:var(--vscode-toolbar-hoverBackground,rgba(255,255,255,.08)); }.zoom { width:45px; color:var(--nc-muted); font-size:10px; text-align:center; }
    .properties { position:absolute; z-index:9; top:0; right:0; bottom:0; width:220px; padding:14px; border-left:1px solid var(--nc-border); background:var(--nc-card); box-shadow:-5px 0 14px rgba(0,0,0,.14); }
    .properties-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }.properties h3 { margin:0; font-size:12px; }.close { color:var(--nc-muted); border:0; background:transparent; cursor:pointer; }
    label { display:grid; gap:5px; margin-bottom:12px; color:var(--nc-muted); font-size:10px; } input,select { width:100%; padding:6px; color:var(--vscode-input-foreground,var(--nc-fg)); border:1px solid var(--vscode-input-border,var(--nc-border)); border-radius:2px; outline:0; background:var(--vscode-input-background,var(--nc-bg)); }
    .delete { width:100%; padding:6px; color:var(--vscode-button-foreground,#fff); border:0; border-radius:2px; background:var(--vscode-inputValidation-errorBorder,#be1100); cursor:pointer; }
    @media(max-width:700px){.editor{grid-template-columns:58px minmax(0,1fr)}.heading,.item span:last-child,.help{display:none}.item{justify-content:center;padding:7px}}
  `;

  protected willUpdate(changes: Map<PropertyKey, unknown>) {
    if (changes.has('data') && !this.initialized) {
      const data = createNetworkData(this.data);
      this.nodes = structuredClone(data.nodes); this.vlans = structuredClone(data.vlans); this.connections = structuredClone(data.connections);
      this.offset = { x:data.viewport.x, y:data.viewport.y }; this.scale = data.viewport.scale; this.initialized = true;
    }
  }
  connectedCallback(){ super.connectedCallback(); window.addEventListener('mousemove',this.onMouseMove); window.addEventListener('mouseup',this.onMouseUp); }
  disconnectedCallback(){ window.removeEventListener('mousemove',this.onMouseMove); window.removeEventListener('mouseup',this.onMouseUp); super.disconnectedCallback(); }
  get value():NetworkCanvasData{return{version:1,nodes:structuredClone(this.nodes),vlans:structuredClone(this.vlans),connections:structuredClone(this.connections),viewport:{x:this.offset.x,y:this.offset.y,scale:this.scale}}}
  private createId(){return`network-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
  private emitChange(){this.dispatchEvent(new CustomEvent('network-change',{detail:this.value,bubbles:true,composed:true}))}
  private rect(){return this.renderRoot.querySelector('.canvas')!.getBoundingClientRect()}
  private point(event:MouseEvent):Point{const rect=this.rect();return{x:(event.clientX-rect.left-this.offset.x)/this.scale,y:(event.clientY-rect.top-this.offset.y)/this.scale}}
  private endpoint(id:string):Point|undefined{const node=this.nodes.find(item=>item.id===id);if(node)return{x:node.x,y:node.y};const vlan=this.vlans.find(item=>item.id===id);return vlan?{x:vlan.x+vlan.width/2,y:vlan.y+vlan.height/2}:undefined}
  private selected():SelectedItem|undefined{const node=this.nodes.find(item=>item.id===this.selectedId);if(node)return{kind:'node',value:node};const vlan=this.vlans.find(item=>item.id===this.selectedId);if(vlan)return{kind:'vlan',value:vlan};const connection=this.connections.find(item=>item.id===this.selectedId);return connection?{kind:'connection',value:connection}:undefined}
  private addNode(type:NetworkNodeType,point?:Point){const label=nodeTypes.find(item=>item.type===type)!.label;this.nodes=[...this.nodes,{id:this.createId(),type,label:`${label} ${this.nodes.filter(node=>node.type===type).length+1}`,x:point?.x??230+this.nodes.length*35,y:point?.y??150+this.nodes.length*28}];this.emitChange()}
  private addVlan(point?:Point){const index=this.vlans.length;this.vlans=[...this.vlans,{id:this.createId(),name:`VLAN ${index+1}`,color:vlanColors[index%vlanColors.length],x:point?.x??120+index*35,y:point?.y??90+index*30,width:280,height:180}];this.emitChange()}
  private onCanvasDown(event:MouseEvent){const target=event.target as Element;if(!target.classList.contains('canvas')&&!target.classList.contains('content')&&!target.classList.contains('connections'))return;if(this.connectingFrom){this.connectingFrom=null;return}this.selectedId=null;this.panning={x:event.clientX-this.offset.x,y:event.clientY-this.offset.y}}
  private onItemDown(event:MouseEvent,kind:'node'|'vlan',id:string){event.preventDefault();event.stopPropagation();if(this.connectingFrom){this.completeConnection(id);return}const item=kind==='node'?this.nodes.find(node=>node.id===id):this.vlans.find(vlan=>vlan.id===id);if(!item)return;const point=this.point(event);this.selectedId=id;this.dragging={kind,id,offset:{x:point.x-item.x,y:point.y-item.y}}}
  private onMouseMove=(event:MouseEvent)=>{if(this.panning){this.offset={x:event.clientX-this.panning.x,y:event.clientY-this.panning.y}}else if(this.dragging){const point=this.point(event);if(this.dragging.kind==='node')this.nodes=this.nodes.map(node=>node.id===this.dragging!.id?{...node,x:point.x-this.dragging!.offset.x,y:point.y-this.dragging!.offset.y}:node);else this.vlans=this.vlans.map(vlan=>vlan.id===this.dragging!.id?{...vlan,x:point.x-this.dragging!.offset.x,y:point.y-this.dragging!.offset.y}:vlan)}};
  private onMouseUp=()=>{if(this.dragging||this.panning)this.emitChange();this.dragging=undefined;this.panning=undefined};
  private startConnection(event:MouseEvent,id:string){event.preventDefault();event.stopPropagation();this.connectingFrom=id;this.selectedId=id}
  private completeConnection(id:string){if(this.connectingFrom&&this.connectingFrom!==id&&!this.connections.some(item=>(item.from===this.connectingFrom&&item.to===id)||(item.from===id&&item.to===this.connectingFrom)))this.connections=[...this.connections,{id:this.createId(),from:this.connectingFrom,to:id,lineType:'dashed'}];this.connectingFrom=null;this.emitChange()}
  private updateSelected(value:string){const selected=this.selected();if(!selected)return;if(selected.kind==='node')this.nodes=this.nodes.map(item=>item.id===selected.value.id?{...item,label:value}:item);if(selected.kind==='vlan')this.vlans=this.vlans.map(item=>item.id===selected.value.id?{...item,name:value}:item);if(selected.kind==='connection')this.connections=this.connections.map(item=>item.id===selected.value.id?{...item,label:value}:item);this.emitChange()}
  private updateLineType(lineType:NetworkLineType){if(!this.selectedId)return;this.connections=this.connections.map(item=>item.id===this.selectedId?{...item,lineType}:item);this.emitChange()}
  private updateVlan(updates:Partial<Pick<NetworkVlan,'width'|'height'|'color'>>){if(!this.selectedId)return;this.vlans=this.vlans.map(item=>item.id===this.selectedId?{...item,...updates}:item);this.emitChange()}
  private deleteSelected(){const id=this.selectedId;if(!id)return;this.nodes=this.nodes.filter(item=>item.id!==id);this.vlans=this.vlans.filter(item=>item.id!==id);this.connections=this.connections.filter(item=>item.id!==id&&item.from!==id&&item.to!==id);this.selectedId=null;this.emitChange()}
  private zoom(delta:number){this.scale=Math.max(.2,Math.min(3,this.scale+delta));this.emitChange()}
  private connectionSvg(connection:NetworkConnection){const from=this.endpoint(connection.from),to=this.endpoint(connection.to);if(!from||!to)return'';const type=connection.lineType??'dashed';const dash=type==='dashed'?'7 4':type==='dotted'?'2 5':undefined;const color=connection.id===this.selectedId?'var(--nc-primary)':'color-mix(in srgb,var(--nc-primary) 55%,transparent)';const lines=type==='double'?svg`<line x1=${from.x-3} y1=${from.y-3} x2=${to.x-3} y2=${to.y-3} stroke=${color} stroke-width="2"/><line x1=${from.x+3} y1=${from.y+3} x2=${to.x+3} y2=${to.y+3} stroke=${color} stroke-width="2"/>`:svg`<line x1=${from.x} y1=${from.y} x2=${to.x} y2=${to.y} stroke=${color} stroke-width="2" stroke-dasharray=${dash??''}/>`;return svg`<g class="connection" @click=${(event:Event)=>{event.stopPropagation();this.selectedId=connection.id}}>${lines}<line x1=${from.x} y1=${from.y} x2=${to.x} y2=${to.y} stroke="transparent" stroke-width="14"/>${connection.label?svg`<text class="connection-label" x=${(from.x+to.x)/2} y=${(from.y+to.y)/2-7}>${connection.label}</text>`:''}</g>`}
  render(){const selected=this.selected();return html`<div class="editor"><aside class="sidebar"><h3 class="heading">Components</h3><div class="items">${nodeTypes.map(item=>html`<button class="item ${item.type}" type="button" draggable="true" @click=${()=>this.addNode(item.type)} @dragstart=${(event:DragEvent)=>event.dataTransfer?.setData('application/network-type',item.type)}><span class="icon">${unsafeHTML(networkIcon(item.type,18))}</span><span>${item.label}</span></button>`)}<div class="separator"></div><button class="item vlan-item" type="button" draggable="true" @click=${()=>this.addVlan()} @dragstart=${(event:DragEvent)=>event.dataTransfer?.setData('application/network-type','vlan')}><span class="icon">${unsafeHTML(networkIcon('layers',18))}</span><span>VLAN Segment</span></button></div><p class="help">Click to add • Drag to move<br>Right-click to connect<br>Select and delete to remove</p></aside><main class="stage">${this.connectingFrom?html`<div class="hint">Click a node or VLAN to connect</div>`:''}<div class="canvas" @mousedown=${this.onCanvasDown} @wheel=${(event:WheelEvent)=>{event.preventDefault();this.zoom(event.deltaY>0?-.1:.1)}} @dragover=${(event:DragEvent)=>event.preventDefault()} @drop=${(event:DragEvent)=>{event.preventDefault();const type=event.dataTransfer?.getData('application/network-type');if(!type)return;const point=this.point(event);type==='vlan'?this.addVlan(point):this.addNode(type as NetworkNodeType,point)}}><div class="content" style=${`transform:translate(${this.offset.x}px,${this.offset.y}px) scale(${this.scale})`}><svg class="connections">${this.connections.map(item=>this.connectionSvg(item))}</svg>${this.vlans.map(vlan=>html`<div class="vlan ${vlan.id===this.selectedId?'selected':''}" style=${`--vlan-color:${vlan.color};left:${vlan.x}px;top:${vlan.y}px;width:${vlan.width}px;height:${vlan.height}px`} @mousedown=${(event:MouseEvent)=>this.onItemDown(event,'vlan',vlan.id)} @contextmenu=${(event:MouseEvent)=>this.startConnection(event,vlan.id)}><span class="vlan-label">${vlan.name}</span></div>`)}${this.nodes.map(node=>html`<div class="network-node ${node.type} ${node.id===this.selectedId?'selected':''}" style=${`left:${node.x}px;top:${node.y}px`} @mousedown=${(event:MouseEvent)=>this.onItemDown(event,'node',node.id)} @contextmenu=${(event:MouseEvent)=>this.startConnection(event,node.id)}><div class="node-card">${unsafeHTML(networkIcon(node.type,28))}</div><span class="node-label">${node.label}</span></div>`)}</div></div><div class="toolbar"><button @click=${()=>this.zoom(-.15)}>−</button><span class="zoom">${Math.round(this.scale*100)}%</span><button @click=${()=>this.zoom(.15)}>+</button><button title="Reset view" @click=${()=>{this.scale=1;this.offset={x:0,y:0};this.emitChange()}}>⌂</button></div>${selected?html`<aside class="properties"><div class="properties-header"><h3>${selected.kind==='connection'?'Connection':selected.kind==='vlan'?'VLAN':'Network node'}</h3><button class="close" @click=${()=>{this.selectedId=null}}>×</button></div><label>${selected.kind==='vlan'?'Name':'Label'}<input .value=${selected.kind==='node'?selected.value.label:selected.kind==='vlan'?selected.value.name:selected.value.label??''} @input=${(event:Event)=>this.updateSelected((event.target as HTMLInputElement).value)}></label>${selected.kind==='connection'?html`<label>Line type<select .value=${selected.value.lineType??'dashed'} @change=${(event:Event)=>this.updateLineType((event.target as HTMLSelectElement).value as NetworkLineType)}>${lineTypes.map(type=>html`<option value=${type}>${type}</option>`)}</select></label>`:''}${selected.kind==='vlan'?html`<label>Width<input type="number" min="100" .value=${String(selected.value.width)} @input=${(event:Event)=>this.updateVlan({width:Math.max(100,Number((event.target as HTMLInputElement).value)||100)})}></label><label>Height<input type="number" min="70" .value=${String(selected.value.height)} @input=${(event:Event)=>this.updateVlan({height:Math.max(70,Number((event.target as HTMLInputElement).value)||70)})}></label><label>Color<input type="color" .value=${selected.value.color} @input=${(event:Event)=>this.updateVlan({color:(event.target as HTMLInputElement).value})}></label>`:''}<button class="delete" @click=${this.deleteSelected}>Delete</button></aside>`:''}</main></div>`}
}

export default class NetworkCanvasTool {
  private readonly data:NetworkCanvasData; private element?:NetworkCanvasElement; private wrapper?:HTMLDivElement;
  static get toolbox(){return{title:'Network Canvas',icon:'<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="1" y="1" width="5" height="4" rx="1" stroke="currentColor"/><circle cx="14" cy="3" r="2" stroke="currentColor"/><rect x="10" y="12" width="6" height="4" rx="1" stroke="currentColor"/><path d="M6 3h6M14 5v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V5" stroke="currentColor"/></svg>'}}
  constructor({data}:ToolArgs){this.data=createNetworkData(data)}
  render(){this.wrapper=document.createElement('div');this.wrapper.className='slash-network-canvas-tool';this.element=document.createElement('slash-network-canvas');this.element.data=this.data;this.element.addEventListener('network-change',()=>{if(!this.wrapper)return;this.wrapper.dataset.revision=String(Number(this.wrapper.dataset.revision??'0')+1);this.wrapper.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true}))});this.wrapper.append(this.element);return this.wrapper}
  save():NetworkCanvasData{return this.element?.value??this.data}
}

function createNetworkData(data?:Partial<NetworkCanvasData>):NetworkCanvasData{const nodes=Array.isArray(data?.nodes)?data.nodes.filter(isNode).map(item=>({...item})):[];const vlans=Array.isArray(data?.vlans)?data.vlans.filter(isVlan).map(item=>({...item,width:Math.max(100,item.width),height:Math.max(70,item.height),color:/^#[0-9a-f]{6}$/i.test(item.color)?item.color:'#06b6d4'})):[];const ids=new Set([...nodes,...vlans].map(item=>item.id));const connections=Array.isArray(data?.connections)?data.connections.filter(item=>isConnection(item)&&ids.has(item.from)&&ids.has(item.to)).map(item=>({...item})):[];return{version:1,nodes,vlans,connections,viewport:{x:finite(data?.viewport?.x,0),y:finite(data?.viewport?.y,0),scale:Math.max(.2,Math.min(3,finite(data?.viewport?.scale,1)))}}}
function isNode(value:unknown):value is NetworkNode{if(!value||typeof value!=='object')return false;const item=value as Partial<NetworkNode>;return typeof item.id==='string'&&typeof item.type==='string'&&nodeTypes.some(type=>type.type===item.type)&&typeof item.label==='string'&&Number.isFinite(item.x)&&Number.isFinite(item.y)}
function isVlan(value:unknown):value is NetworkVlan{if(!value||typeof value!=='object')return false;const item=value as Partial<NetworkVlan>;return typeof item.id==='string'&&typeof item.name==='string'&&typeof item.color==='string'&&Number.isFinite(item.x)&&Number.isFinite(item.y)&&Number.isFinite(item.width)&&Number.isFinite(item.height)}
function isConnection(value:unknown):value is NetworkConnection{if(!value||typeof value!=='object')return false;const item=value as Partial<NetworkConnection>;return typeof item.id==='string'&&typeof item.from==='string'&&typeof item.to==='string'&&(!item.lineType||lineTypes.includes(item.lineType))}
function finite(value:unknown,fallback:number){return typeof value==='number'&&Number.isFinite(value)?value:fallback}

declare global{interface HTMLElementTagNameMap{'slash-network-canvas':NetworkCanvasElement}}
