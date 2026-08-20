const $ = s => document.querySelector(s);
function flash(t, ok, link){const m=$("#msg");m.innerHTML="";m.appendChild(document.createTextNode(t));
  if(link){const a=document.createElement("a");a.className="msglink";a.textContent="View output →";
    a.onclick=e=>{e.stopPropagation();gotoJobOutput(link.jobname,link.jobid);};m.appendChild(a);}
  m.className="msg show "+(ok?"ok":"err");m._dur=link?20000:4500;clearTimeout(m._t);
  m._t=setTimeout(()=>m.className="msg",m._dur);}
function gotoJobOutput(jobname,jobid){
  if($("#explorer").classList.contains("show"))closeExplorer();
  document.querySelector('nav button[data-tab="jobs"]').click();
  $("#jobFilter").value=jobname;viewJob(jobname,jobid);}
async function get(u){const r=await fetch(u);if(!r.ok)throw new Error(u+" -> "+r.status);return r.text();}
async function post(u,params){const b=new URLSearchParams();for(const k in params)b.append(k,params[k]);
  const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:b.toString()});
  if(!r.ok)throw new Error(u+" -> "+r.status);return r.text();}
// pack textarea into WEBADM params: ~-guard each line (HTTPD collapses a leading //), plus count
function packLines(text){const lines=text.replace(/\r/g,"").replace(/\s+$/,"").split("\n");
  const p={count:lines.length};lines.forEach((l,i)=>p["line"+(i+1)]="~"+l.replace(/\s+$/,""));return p;}
// ---- protected datasets: no generic delete/rename/move touches system libraries ----
// A member rename on SYS1.PROCLIB once wiped the entire dataset (2026-07):
// exDeleteMember's old copy-out/DELETE-ORIGINAL/copy-back sequence destroyed
// the original before the rebuild was verified, on a dataset that's
// continuously enqueued by JES2 and every started task — exactly where that
// ordering was most likely to fail. Block destructive ops on system HLQs
// outright rather than trust a confirm() dialog someone can click through.
const EX_PROTECTED_HLQ=["SYS1","SYS2","SYS3","HTTPD","TCPIP","VTAMLST","PARMLIB"];
function exIsProtected(dsn){return EX_PROTECTED_HLQ.includes((dsn.split(".")[0]||"").toUpperCase());}
// wildcard dataset matching: '*' = any run of chars, '?' = exactly one char.
// /dsl/list only lists *under* a concrete first qualifier (no catalog-wide
// search), so the wildcard applies to the rest of the name — the first
// qualifier itself still has to be a literal HLQ.
function exWildTest(pattern){
  const esc=pattern.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*").replace(/\?/g,".");
  const re=new RegExp("^"+esc+"$","i");
  return n=>re.test(n);}

// ---- quick access: favorites + recently-opened, persisted in localStorage ----
let qRecents=[],qFavs=[];
try{qRecents=JSON.parse(localStorage.getItem("tk5Recents")||"[]");}catch(e){qRecents=[];}
try{qFavs=JSON.parse(localStorage.getItem("tk5Favorites")||"[]");}catch(e){qFavs=[];}
function qSave(){localStorage.setItem("tk5Recents",JSON.stringify(qRecents));
  localStorage.setItem("tk5Favorites",JSON.stringify(qFavs));}
function qIsFav(dsn,mbr){mbr=mbr||"";return qFavs.some(f=>f.dsn===dsn&&(f.mbr||"")===mbr);}
function qLabel(r){return r.dsn+(r.mbr?"("+r.mbr+")":"");}
function qPushRecent(dsn,mbr){mbr=mbr||"";
  qRecents=qRecents.filter(r=>!(r.dsn===dsn&&(r.mbr||"")===mbr));
  qRecents.unshift({dsn,mbr});qRecents.length=Math.min(qRecents.length,15);
  qSave();renderQuickAccess();}
function qToggleFav(dsn,mbr,po){mbr=mbr||"";
  if(qIsFav(dsn,mbr))qFavs=qFavs.filter(f=>!(f.dsn===dsn&&(f.mbr||"")===mbr));
  else qFavs.unshift({dsn,mbr,po:!!po});
  qSave();renderQuickAccess();}
// show the explorer and open a saved reference directly (no reliance on the tree)
function exOpenRef(dsn,mbr,po){
  $("#exFilter").value=dsn.split(".")[0];
  $("#explorer").classList.add("show");document.body.style.overflow="hidden";
  exTree(mbr?undefined:dsn,po);
  if(mbr)exOpen(null,dsn,mbr);}
// collapse state for the sidebar sections (favorites open, recent collapsed by default)
let qCollapsed={fav:false,rec:true};
try{qCollapsed=Object.assign(qCollapsed,JSON.parse(localStorage.getItem("tk5QuickCollapsed")||"{}"));}catch(e){}
function qToggleSection(which){qCollapsed[which]=!qCollapsed[which];
  localStorage.setItem("tk5QuickCollapsed",JSON.stringify(qCollapsed));renderQuickAccess();}
function qItem(r,isFav){
  const row=document.createElement("div");row.className="ex-qitem";
  const on=isFav||qIsFav(r.dsn,r.mbr);
  const star=document.createElement("span");star.className="qi-star"+(on?"":" off");
  star.innerHTML=on?"&#9733;":"&#9734;";star.title=on?"Unfavorite":"Favorite";
  star.onclick=e=>{e.stopPropagation();qToggleFav(r.dsn,r.mbr,r.po);};
  const lbl=document.createElement("span");lbl.className="qi-lbl";lbl.textContent=qLabel(r);
  lbl.title="Open "+qLabel(r);
  const x=document.createElement("span");x.className="qi-x";x.innerHTML="&times;";
  x.title=isFav?"Unfavorite":"Remove from recents";
  x.onclick=e=>{e.stopPropagation();
    if(isFav)qToggleFav(r.dsn,r.mbr);
    else{qRecents=qRecents.filter(o=>!(o.dsn===r.dsn&&(o.mbr||"")===(r.mbr||"")));qSave();renderQuickAccess();}};
  row.onclick=()=>exOpenRef(r.dsn,r.mbr,r.po);
  row.append(star,lbl,x);
  return row;}
function renderQuickAccess(){
  const favSec=$("#exFavSec"),recSec=$("#exRecSec");if(!favSec||!recSec)return;
  if(qFavs.length){favSec.style.display="";favSec.classList.toggle("open",!qCollapsed.fav);
    $("#exFavN").textContent="("+qFavs.length+")";
    const body=$("#exFavBody");body.innerHTML="";qFavs.forEach(f=>body.appendChild(qItem(f,true)));}
  else favSec.style.display="none";
  if(qRecents.length){recSec.style.display="";recSec.classList.toggle("open",!qCollapsed.rec);
    $("#exRecN").textContent="("+qRecents.length+")";
    const body=$("#exRecBody");body.innerHTML="";qRecents.forEach(r=>body.appendChild(qItem(r,false)));}
  else recSec.style.display="none";}

// ---- sidebar Jobs section: a live, collapsible mirror of the Jobs tab's
// queue inside the Explorer sidebar (below the dataset tree). Clicking a
// row jumps to the full Jobs tab for output/purge — this list is just a
// quick-glance/quick-open shortcut, not a replacement for it.
let exJobsCollapsed=false;
try{exJobsCollapsed=JSON.parse(localStorage.getItem("tk5JobsCollapsed")||"false");}catch(e){}
function exJobsRenderCollapse(){$("#exSideJobs").classList.toggle("collapsed",exJobsCollapsed);}
function exJobsToggle(){exJobsCollapsed=!exJobsCollapsed;
  localStorage.setItem("tk5JobsCollapsed",JSON.stringify(exJobsCollapsed));
  exJobsRenderCollapse();if(!exJobsCollapsed)exJobsRefresh();}
async function exJobsRefresh(){
  const f=$("#exJobFilter").value.trim()||"*";const el=$("#exJobsList");
  el.innerHTML='<div class="tree-item muted">loading&hellip;</div>';
  try{const t=await get("/jes/status?job="+encodeURIComponent(f));const j=JSON.parse(t);
    const rows=j.data||[];$("#exJobsN").textContent=rows.length?"("+rows.length+")":"";
    el.innerHTML="";
    if(!rows.length){el.innerHTML='<div class="tree-item muted">no jobs</div>';return;}
    rows.forEach(job=>{const st=["OUTPUT","ACTIVE"].indexOf(job.status)>=0?job.status:"other";
      const d=document.createElement("div");d.className="ex-job-item";
      d.title=job.jobname+" ("+job.jobid+") — "+job.status;
      d.innerHTML='<span class="ji-name"></span><span class="ji-id"></span><span class="grow"></span>'+
        '<span class="pill '+st+'">'+job.status+'</span>';
      d.querySelector(".ji-name").textContent=job.jobname;
      d.querySelector(".ji-id").textContent=job.jobid;
      d.onclick=()=>gotoJobOutput(job.jobname,job.jobid);
      d.oncontextmenu=e=>ctxShow(e,[["View output",()=>gotoJobOutput(job.jobname,job.jobid)],
        ["Purge",()=>purgeJob(job.jobname,job.jobid)]]);
      el.appendChild(d);});}
  catch(e){el.innerHTML='<div class="tree-item errtx">'+e.message+'</div>';}}

document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
  const tab=b.dataset.tab;
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");$("#"+tab).classList.add("active");
  // Datasets IS the Explorer now — open the overlay; other tabs hide it
  if(tab==="datasets")openExplorer();
  else{if($("#explorer").classList.contains("show"))closeExplorer();
    if(tab==="jobs")listJobs();
    if(tab==="oper")operEnsureLoaded();}
});
// ---- operator console: Hercules's own web console (port 8038), embedded ----
// live in an iframe. That port sends no CORS headers, so a fetch() from this
// page (served on 8080) would be silently blocked by the browser — but
// embedding via <iframe> isn't subject to CORS, only cross-doc JS reads are,
// and Hercules sends no X-Frame-Options/CSP either (confirmed by hand).
function operUrl(cmd){
  const base="http://"+location.hostname+":8038/cgi-bin/tasks/syslog";
  return(cmd?base+"?command="+encodeURIComponent(cmd):base)+"#bottom";}
// ---- command history: last 20, persisted in localStorage, most-recent-first ----
let operHistory=[];
try{operHistory=JSON.parse(localStorage.getItem("tk5OperHistory")||"[]");}catch(e){operHistory=[];}
let operHistPos=-1;
function operRenderHistory(){const dl=$("#operHistoryList");dl.innerHTML="";
  operHistory.forEach(c=>dl.appendChild(Object.assign(document.createElement("option"),{value:c})));}
function operPushHistory(cmd){const i=operHistory.indexOf(cmd);if(i>=0)operHistory.splice(i,1);
  operHistory.unshift(cmd);operHistory.length=Math.min(operHistory.length,20);
  localStorage.setItem("tk5OperHistory",JSON.stringify(operHistory));operRenderHistory();}
function operClearHistory(){operHistory=[];localStorage.removeItem("tk5OperHistory");operRenderHistory();}
function operHistNav(dir){ // history[0] is most recent; dir:+1 = older (Up), -1 = newer (Down)
  if(!operHistory.length)return;
  operHistPos=Math.max(-1,Math.min(operHistory.length-1,operHistPos+dir));
  $("#operCmd").value=operHistPos>=0?operHistory[operHistPos]:"";}
function operSend(){const cmd=$("#operCmd").value.trim();if(!cmd)return;
  operPushHistory(cmd);operHistPos=-1;
  $("#operFrame").src=operUrl(cmd);$("#operCmd").value="";}
function operEnsureLoaded(){const f=$("#operFrame");if(!f.src)f.src=operUrl("");}
operRenderHistory();

async function health(){try{const t=await get("/rexx/WEBADM?action=ping");
  const up=t.indexOf("WEBADM ok")>=0;$("#dot").className="dot "+(up?"up":"down");
  $("#statusText").textContent=up?"backend ready (read/write)":"read-only (WEBADM missing)";}
  catch(e){$("#dot").className="dot down";$("#statusText").textContent="server unreachable";}}

// Shows the signed-in user in the header and, via currentUserHlq below,
// makes the Explorer default to their own HLQ instead of HERC01 (auth-proxy
// only - harmless no-op if /auth/whoami 404s, e.g. hitting the HTTPD directly).
let currentUserHlq="HERC01";
async function whoami(){try{const r=await fetch("/auth/whoami");if(!r.ok)return null;
  const j=await r.json();if(j&&j.user){currentUserHlq=j.user;$("#whoUser").textContent=" \u00B7 signed in: "+j.user;return j.user;}}
  catch(e){/* no auth-proxy in front - leave header as-is */}
  return null;}

// ---- explorer (VS Code-style browse/edit, split-pane, drag-to-split) ----
const EX_MAX_PANES=4;
let exTabs=[],exCurId=-1,exTabSeq=0;
let exLayout={pane:"p0"},exPaneSeq=1,exFocusPaneId="p0",exPaneActive={p0:null};
let exDragTabId=null,exDragFromPane=null,exDragTree=null;
function exTab(){return exTabs.find(t=>t.id===exCurId)||null;}
function exPaneTab(paneId){const id=exPaneActive[paneId];return id!=null?(exTabs.find(t=>t.id===id)||null):null;}
function exName(t){return t?t.dsn+(t.mbr?"("+t.mbr+")":""):"";}
function exAnyDirty(){return exTabs.some(t=>t.dirty);}
function exPaneIds(node,out){node=node||exLayout;out=out||[];
  if(node.pane)out.push(node.pane);else{exPaneIds(node.a,out);exPaneIds(node.b,out);}return out;}
function exFindPaneEl(paneId){return document.querySelector('.ex-pane[data-pane="'+paneId+'"]');}
function openExplorer(dsn,po){
  if(dsn)$("#exFilter").value=dsn.split(".")[0];
  else if(!$("#exFilter").value.trim())$("#exFilter").value=currentUserHlq;
  $("#explorer").classList.add("show");document.body.style.overflow="hidden";
  // populate the tree on first open or when revealing a specific dataset;
  // preserve tree/expansion state across plain Datasets<->Jobs tab switches
  if(dsn||!$("#exTreeList").children.length)exTree(dsn,po);
  exJobsRefresh();}
function closeExplorer(){ // hide the overlay to show the Jobs/Operator tab; open tabs are kept
  ctxHide();$("#explorer").classList.remove("show");document.body.style.overflow="";
  return true;}
// ---- dataset attributes (RECFM/LRECL/BLKSIZE/DSORG/VOL/dates) ----
// All of these come straight from a /dsl/list row (columns after the DSN);
// no extra job needed. Members carry no per-member stats on this system
// (the /dsl/pds number is a directory TTR pointer, not a size), so a member's
// Properties shows its parent dataset's DCB, which is what it's stored under.
let exAttrCache={}; // dsn -> parsed attributes, populated as the tree lists them
function exParseAttrs(line){
  const p=line.trim().split(/\s+/);
  if(p.length<6||/^Elapsed/i.test(line)||/^Error/i.test(line))return null;
  return{dsn:p[0],vol:p[1],lrecl:p[2],blksize:p[3],dsorg:p[4],recfm:p[5],created:p[6]||"",refd:p[7]||""};}
async function exFetchAttrs(dsn){
  if(exAttrCache[dsn])return exAttrCache[dsn];
  try{const t=await get("/dsl/list?hlq="+encodeURIComponent(dsn.split(".")[0]));
    t.split("\n").forEach(l=>{const a=exParseAttrs(l);if(a)exAttrCache[a.dsn]=a;});}
  catch(e){}
  return exAttrCache[dsn]||null;}
async function exShowProps(dsn,mbr){
  $("#propsTitle").textContent=dsn+(mbr?"("+mbr+")":"");
  $("#propsBody").innerHTML='<div class="pnote">loading&hellip;</div>';
  $("#props").classList.add("show");
  const a=await exFetchAttrs(dsn);
  if(!a){$("#propsBody").innerHTML='<div class="pnote">Attributes unavailable for '+exEscHtml(dsn)+'</div>';return;}
  const orgTxt=a.dsorg==="PO"?"PO (partitioned)":a.dsorg==="PS"?"PS (sequential)":a.dsorg==="DA"?"DA (direct)":a.dsorg;
  const rows=[["Organization",orgTxt],["Record format",a.recfm],["LRECL",a.lrecl],
    ["Block size",a.blksize],["Volume",a.vol],["Created",a.created||"-"],["Referenced",a.refd||"-"]];
  let html=rows.map(r=>'<div class="pk">'+r[0]+'</div><div class="pv">'+exEscHtml(String(r[1]))+'</div>').join("");
  if(mbr)html+='<div class="pnote">Member of '+exEscHtml(dsn)+' &mdash; members inherit the dataset\'s DCB (this system keeps no per-member ISPF stats).</div>';
  $("#propsBody").innerHTML=html;}
function closeProps(){$("#props").classList.remove("show");}
async function exTree(focusDsn,focusPo){
  const raw=($("#exFilter").value.trim()||currentUserHlq).toUpperCase();$("#exFilter").value=raw;
  const el=$("#exTreeList");el.innerHTML='<div class="tree-item muted">loading&hellip;</div>';
  const first=raw.split(".")[0];
  if(/[*?]/.test(first)){el.innerHTML='<div class="tree-item muted">first qualifier can\'t contain wildcards — try e.g. HERC01.J* instead</div>';return;}
  const hasWild=/[*?]/.test(raw),match=hasWild?exWildTest(raw):null;
  try{const t=await get("/dsl/list?hlq="+encodeURIComponent(first));
    let rows=t.split("\n").filter(l=>l.trim()&&!/^Elapsed/i.test(l)&&!/^Error/i.test(l));
    rows.forEach(l=>{const a=exParseAttrs(l);if(a)exAttrCache[a.dsn]=a;}); // cache DCB attrs for Properties
    rows=rows.filter(l=>{const n=l.split(/\s+/)[0];return n&&(hasWild?match(n):n.startsWith(raw));});
    el.innerHTML="";
    rows.forEach(l=>{const dsn=l.split(/\s+/)[0],po=/\bPO\b/.test(l);
      const d=document.createElement("div");d.className="tree-item";d.dataset.dsn=dsn;
      d.innerHTML='<span class="chev">'+(po?"&#9656;":"")+'</span><span class="lbl"></span>'+(po?'':'<span class="tag">PS</span>');
      d.querySelector(".lbl").textContent=dsn;
      d.onclick=()=>{if(po)exToggle(d,dsn);else exOpen(d,dsn,"");};
      if(!po)exWireTreeDrag(d,dsn,"");
      d.oncontextmenu=e=>ctxShow(e,(po?
        [["Refresh members",()=>{if(d.classList.contains("open"))exToggle(d,dsn);exToggle(d,dsn);}],
         ["New member…",()=>exNewMember(dsn)]]:
        [["Open",()=>exOpen(d,dsn,"")],["Submit JCL",()=>exSubmitTree(dsn,"")]]
        ).concat([["Properties",()=>exShowProps(dsn,"")],
          [qIsFav(dsn,"")?"Unfavorite":"\u2605 Favorite",()=>qToggleFav(dsn,"",po)]]).concat(exClipMenu(po?"pds":"seq",dsn)));
      el.appendChild(d);
      if(po){const kids=document.createElement("div");kids.className="tree-kids";el.appendChild(kids);}});
    if(!rows.length)el.innerHTML='<div class="tree-item muted">no datasets match '+raw+'</div>';
    if(focusDsn){const d=[...el.children].find(x=>x.dataset&&x.dataset.dsn===focusDsn);
      if(d){d.scrollIntoView({block:"center"});if(focusPo)exToggle(d,focusDsn);else exOpen(d,focusDsn,"");}}}
  catch(e){const friendly=/->\s*501/.test(e.message);
    el.innerHTML='<div class="tree-item '+(friendly?'muted':'errtx')+'">'+(friendly?'no datasets found for '+raw:e.message)+'</div>';}}
async function exToggle(d,dsn){
  const kids=d.nextElementSibling;
  if(d.classList.contains("open")){d.classList.remove("open");kids.innerHTML="";return;}
  d.classList.add("open");kids.innerHTML='<div class="tree-item member muted">loading&hellip;</div>';
  try{const t=await get("/dsl/pds?dsn="+encodeURIComponent(dsn));
    const rows=t.split("\n").map(l=>l.split(/\s+/)[0]).filter(m=>m&&!/^Elapsed/i.test(m));
    kids.innerHTML="";
    rows.forEach(m=>{const k=document.createElement("div");k.className="tree-item member";k.textContent=m;
      k.onclick=()=>exOpen(k,dsn,m);
      exWireTreeDrag(k,dsn,m);
      k.oncontextmenu=e=>ctxShow(e,[["Open",()=>exOpen(k,dsn,m)],["Submit JCL",()=>exSubmitTree(dsn,m)],
        ["Properties",()=>exShowProps(dsn,m)],
        [qIsFav(dsn,m)?"Unfavorite":"\u2605 Favorite",()=>qToggleFav(dsn,m)]].concat(exClipMenu("member",dsn,m)));
      kids.appendChild(k);});
    if(!rows.length)kids.innerHTML='<div class="tree-item member muted">empty PDS</div>';
    exAddNew(kids,dsn);}
  catch(e){
    // /dsl/pds answers 404 "No members found" for an *empty* PDS — normal
    if(/->\s*404/.test(e.message)){kids.innerHTML='<div class="tree-item member muted">empty PDS</div>';exAddNew(kids,dsn);}
    else kids.innerHTML='<div class="tree-item member errtx">'+e.message+'</div>';}}
function exAddNew(kids,dsn){
  const k=document.createElement("div");k.className="tree-item member new";k.textContent="+ new member";
  k.onclick=()=>exNewMember(dsn);
  kids.appendChild(k);}
function exWireTreeDrag(el,dsn,mbr){ // drag straight from the navigator into any pane, open or split
  el.draggable=true;
  el.ondragstart=e=>{exDragTree={dsn,mbr};e.dataTransfer.effectAllowed="copy";
    try{e.dataTransfer.setData("text/plain",dsn+(mbr?"("+mbr+")":""));}catch(err){}};
  el.ondragend=()=>{exDragTree=null;exClearDropzones();};}
function exOpenInPane(tab){ // assign a freshly-created tab to the focused pane
  tab.pane=exFocusPaneId;exTabs.push(tab);exCurId=tab.id;exPaneActive[tab.pane]=tab.id;
  exRenderLayout();}
function exNewMember(dsn){
  const m=prompt("New member name (1-8 chars):","");if(!m)return;
  const mb=m.trim().toUpperCase();
  if(!/^[A-Z#@$][A-Z0-9#@$]{0,7}$/.test(mb)){flash("Invalid member name",false);return;}
  const found=exTabs.find(t=>t.dsn===dsn&&t.mbr===mb);
  if(found){exSwitch(found.id);return;}
  exStash();
  const tab={id:++exTabSeq,dsn,mbr:mb,text:"",dirty:true,loading:false,fmt:"auto"};
  exOpenInPane(tab);
  exStatus("new member — Save to create");
  const el=exFindPaneEl(tab.pane);if(el)el.querySelector(".ex-text").focus();}
async function exOpen(el,dsn,mbr){
  document.querySelectorAll("#exTreeList .tree-item.sel").forEach(x=>x.classList.remove("sel"));
  if(el)el.classList.add("sel");
  const found=exTabs.find(t=>t.dsn===dsn&&t.mbr===mbr);
  if(found){exSwitch(found.id);return;}
  exStash();
  const tab={id:++exTabSeq,dsn,mbr,text:"",dirty:false,loading:true,fmt:"auto"};
  exOpenInPane(tab);
  exLoadTabContent(tab);}
async function exLoadTabContent(tab){ // shared by click-to-open and drag-from-tree
  try{let u="/dsl/print?dsn="+encodeURIComponent(tab.dsn);if(tab.mbr)u+="&member="+encodeURIComponent(tab.mbr);
    let t=await get(u);t=t.replace(/[ \t]+(?=\n)/g,"").replace(/\s+$/,"");
    tab.text=t;tab.loading=false;
    qPushRecent(tab.dsn,tab.mbr);
    if(exTabs.includes(tab))exRefreshPaneView(tab.pane);}
  catch(e){const idx=exTabs.indexOf(tab);if(idx>=0)exTabs.splice(idx,1);
    if(exPaneActive[tab.pane]===tab.id)exPaneActive[tab.pane]=null;
    if(exCurId===tab.id)exCurId=exTabs[0]?exTabs[0].id:-1;
    exRenderLayout();
    flash("Load failed: "+e.message,false);}}
function exStash(){ // write every visible pane's textarea back into its tab object
  document.querySelectorAll(".ex-pane").forEach(p=>{
    const id=exPaneActive[p.dataset.pane],t=id!=null?exTabs.find(x=>x.id===id):null;
    if(t&&!t.loading)t.text=p.querySelector(".ex-text").value;});}
function exSwitch(id){const t=exTabs.find(x=>x.id===id);if(!t)return;
  if(id===exCurId&&exPaneActive[t.pane]===id){exFocusPane(t.pane);return;}
  exStash();exCurId=id;exFocusPaneId=t.pane;exPaneActive[t.pane]=id;
  exRenderPaneTabBar(t.pane);exRefreshPaneView(t.pane);exRenderTopBar();exPersistSoon();}
function exFocusPane(paneId){exFocusPaneId=paneId;
  const t=exPaneTab(paneId);if(t)exCurId=t.id;exRenderTopBar();}
function exRemoveTabsFromPane(paneId,removedId){
  const remaining=exTabs.filter(t=>t.pane===paneId);
  if(remaining.length){if(exPaneActive[paneId]===removedId)exPaneActive[paneId]=remaining[remaining.length-1].id;}
  else{exPaneActive[paneId]=null;exRemovePaneFromLayout(paneId);}}
function exCloseTab(id){const t=exTabs.find(x=>x.id===id);if(!t)return;
  exStash();
  if(t.dirty&&!confirm("Discard unsaved changes to "+exName(t)+"?"))return;
  exTabs=exTabs.filter(x=>x.id!==id);
  exRemoveTabsFromPane(t.pane,id);
  if(exCurId===id){const nt=exPaneTab(exFocusPaneId)||exTabs[0];exCurId=nt?nt.id:-1;if(nt)exFocusPaneId=nt.pane;}
  exRenderLayout();exRenderTopBar();}
function exRenderTopBar(){const t=exTab();
  const c=$("#exCrumbs");c.innerHTML="";
  if(!t){$("#exSave").disabled=true;$("#exFmtSel").disabled=true;$("#exFmtSel").value="auto";
    $("#exDot").style.visibility="hidden";return;}
  const parts=t.dsn.split(".");
  parts.forEach((p,i,a)=>{
    const dsn=a.slice(0,i+1).join("."),leaf=i===a.length-1;
    const seg=Object.assign(document.createElement("span"),{textContent:p,className:"crumb"});
    seg.title="Reveal "+dsn+" in tree";
    seg.onclick=()=>exRevealCrumb(dsn,leaf);
    c.appendChild(seg);
    if(!leaf)c.appendChild(Object.assign(document.createElement("span"),{textContent:"›",className:"sep"}));});
  if(t.mbr){c.appendChild(Object.assign(document.createElement("span"),{textContent:"›",className:"sep"}));
    const mseg=Object.assign(document.createElement("span"),{textContent:t.mbr,className:"crumb mbr"});
    mseg.title="Reveal "+t.mbr+" in tree";
    mseg.onclick=()=>exRevealCrumb(t.dsn,true);
    c.appendChild(mseg);}
  $("#exSave").disabled=false;
  $("#exFmtSel").disabled=false;$("#exFmtSel").value=t.fmt||"auto";
  $("#exDot").style.visibility=t.dirty?"visible":"hidden";}
function exRevealCrumb(dsn,leaf){ // clicking a breadcrumb segment filters/reveals it in the tree
  $("#exFilter").value=dsn;
  exTree(leaf?dsn:undefined,leaf);}

// ---- split-pane layout: a small binary tree of panes, VS Code-style ----
// {pane:"p0"} is a leaf; {dir:"row"|"col",a:node,b:node,split:0.5} is a split.
// Dragging a tab to an edge of a pane splits it (capped at EX_MAX_PANES);
// closing a pane's last tab (or dragging its last tab elsewhere) prunes it
// back out and its sibling takes over the freed space.
function exRemovePaneFromLayout(paneId){
  if(exPaneIds().length<=1)return; // sole remaining pane — leave it, goes to the empty placeholder
  exLayout=exPruneNode(exLayout,paneId);
  delete exPaneActive[paneId];
  if(exFocusPaneId===paneId)exFocusPaneId=exPaneIds()[0];}
function exPruneNode(node,paneId){
  if(node.pane)return node;
  if(node.a.pane===paneId)return node.b;
  if(node.b.pane===paneId)return node.a;
  const na=exPruneNode(node.a,paneId);if(na!==node.a)return{dir:node.dir,a:na,b:node.b,split:node.split};
  const nb=exPruneNode(node.b,paneId);if(nb!==node.b)return{dir:node.dir,a:node.a,b:nb,split:node.split};
  return node;}
function exReplaceLeaf(node,paneId,fn){
  if(node.pane)return node.pane===paneId?fn():node;
  const na=exReplaceLeaf(node.a,paneId,fn);if(na!==node.a)return{dir:node.dir,a:na,b:node.b,split:node.split};
  const nb=exReplaceLeaf(node.b,paneId,fn);if(nb!==node.b)return{dir:node.dir,a:node.a,b:nb,split:node.split};
  return node;}
function exSplitPane(paneId,edge,newPaneId){
  const dir=(edge==="left"||edge==="right")?"row":"col",before=(edge==="left"||edge==="top");
  exLayout=exReplaceLeaf(exLayout,paneId,()=>{
    const existing={pane:paneId},created={pane:newPaneId};
    return before?{dir,a:created,b:existing,split:0.5}:{dir,a:existing,b:created,split:0.5};});}

// ---- persist open tabs + pane layout across reloads (localStorage) ----
// The whole editor workspace (tab buffers incl. unsaved edits, the split
// tree, which tab is active in each pane, focus) is snapshotted so a browser
// refresh restores exactly where you were. Debounced on edits; also flushed
// on beforeunload as a safety net.
function exPersist(){
  try{const s={tabs:exTabs.map(t=>({id:t.id,dsn:t.dsn,mbr:t.mbr,text:t.text,dirty:t.dirty,fmt:t.fmt,pane:t.pane})),
    layout:exLayout,paneActive:exPaneActive,curId:exCurId,focusPaneId:exFocusPaneId,paneSeq:exPaneSeq,tabSeq:exTabSeq};
    localStorage.setItem("tk5ExplorerState",JSON.stringify(s));}catch(e){}}
let exPersistT=null;
function exPersistSoon(){clearTimeout(exPersistT);exPersistT=setTimeout(()=>{exStash();exPersist();},500);}
function exValidateState(s){
  if(!s||!s.layout||!Array.isArray(s.tabs)||!s.tabs.length)return null;
  const panes=new Set(exPaneIds(s.layout));if(!panes.size)return null;
  const first=[...panes][0];
  s.tabs.forEach(t=>{if(!panes.has(t.pane))t.pane=first;t.loading=false;t.mbr=t.mbr||"";});
  const pa={};panes.forEach(p=>{
    const cand=s.paneActive&&s.paneActive[p];
    pa[p]=s.tabs.some(t=>t.id===cand&&t.pane===p)?cand:(s.tabs.find(t=>t.pane===p)||{}).id;
    if(pa[p]===undefined)pa[p]=null;});
  s.paneActive=pa;
  if(!panes.has(s.focusPaneId))s.focusPaneId=first;
  if(!s.tabs.some(t=>t.id===s.curId))s.curId=pa[s.focusPaneId]!=null?pa[s.focusPaneId]:-1;
  s.tabSeq=Math.max(s.tabSeq||0,...s.tabs.map(t=>t.id||0));
  s.paneSeq=Math.max(s.paneSeq||1,1);
  return s;}
function exRestore(){
  let s;try{s=JSON.parse(localStorage.getItem("tk5ExplorerState")||"null");}catch(e){s=null;}
  try{s=exValidateState(s);}catch(e){s=null;}
  if(!s)return false;
  exTabs=s.tabs.map(t=>({id:t.id,dsn:t.dsn,mbr:t.mbr||"",text:t.text||"",dirty:!!t.dirty,loading:false,fmt:t.fmt||"auto",pane:t.pane}));
  exLayout=s.layout;exPaneActive=s.paneActive;exCurId=s.curId;
  exFocusPaneId=s.focusPaneId;exTabSeq=s.tabSeq;exPaneSeq=s.paneSeq;
  return true;}

function exRenderLayout(){
  const root=$("#exPanesRoot");root.innerHTML="";
  root.appendChild(exBuildNode(exLayout));
  exPaneIds().forEach(id=>{if(!(id in exPaneActive))exPaneActive[id]=null;exRefreshPaneView(id);});
  exPersistSoon();}
function exBuildNode(node){
  if(node.pane)return exBuildPane(node.pane);
  const wrap=document.createElement("div");wrap.className="ex-split "+node.dir;
  const a=exBuildNode(node.a),b=exBuildNode(node.b);
  a.style.flex=node.split+" 1 0";b.style.flex=(1-node.split)+" 1 0";
  const handle=document.createElement("div");handle.className="ex-splitter "+node.dir;
  exWireSplitter(handle,node,a,b,wrap);
  wrap.append(a,handle,b);
  return wrap;}
function exWireSplitter(handle,node,a,b,wrap){
  handle.onpointerdown=e=>{
    e.preventDefault();handle.setPointerCapture(e.pointerId);handle.classList.add("active");
    const rect=wrap.getBoundingClientRect(),row=node.dir==="row";
    const move=ev=>{
      const pos=row?ev.clientX-rect.left:ev.clientY-rect.top,total=row?rect.width:rect.height;
      const frac=Math.min(0.85,Math.max(0.15,pos/total));
      node.split=frac;a.style.flex=frac+" 1 0";b.style.flex=(1-frac)+" 1 0";};
    const up=()=>{handle.classList.remove("active");
      document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);};
    document.addEventListener("pointermove",move);document.addEventListener("pointerup",up);};}
function exBuildPane(paneId){
  const el=$("#exPaneTpl").content.firstElementChild.cloneNode(true);
  el.dataset.pane=paneId;
  exWirePane(el,paneId);
  return el;}
function exWirePane(el,paneId){
  const ta=el.querySelector(".ex-text");
  ta.addEventListener("input",()=>{exDirtyMark(paneId);exRefreshPaneEditorChrome(paneId);
    const fb=exFindBar(paneId);if(fb&&fb.classList.contains("show"))exFindRun(paneId);
    exPersistSoon();});
  ta.addEventListener("scroll",()=>exSyncPaneScroll(paneId));
  ta.addEventListener("focus",()=>exFocusPane(paneId));
  ta.addEventListener("contextmenu",e=>{
    const t=exPaneTab(paneId);if(!t)return;
    ctxShow(e,[["Save",()=>{exFocusPane(paneId);exSave();}],
      ["Submit JCL",()=>{exStash();exSubmitText(exName(t),t.text);}],
      ["Copy",()=>exSetClip('copy',t.dsn,t.mbr,false)],["Cut",()=>exSetClip('move',t.dsn,t.mbr,false)],
      [t.mbr?"Rename…":"Rename dataset…",()=>exRenameItem(t.dsn,t.mbr,false)],
      [t.mbr?"Delete member":"Delete dataset",()=>exDeleteItem(t.dsn,t.mbr)]]);});
  el.addEventListener("dragover",e=>exDragOverPane(e,el));
  el.addEventListener("dragleave",e=>{if(!el.contains(e.relatedTarget))exSetDropZone(el,null);});
  el.addEventListener("drop",e=>exDropOnPane(e,el,paneId));
  // find/replace bar
  const find=el.querySelector(".ex-find");
  find.querySelector(".ex-find-q").addEventListener("input",()=>exFindRun(paneId));
  find.querySelector(".ex-find-q").addEventListener("keydown",e=>{
    if(e.key==="Enter"){e.preventDefault();exFindStep(paneId,e.shiftKey?-1:1);}
    else if(e.key==="Escape"){e.preventDefault();exFindClose(paneId);}});
  find.querySelector(".ex-find-r").addEventListener("keydown",e=>{
    if(e.key==="Enter"){e.preventDefault();exFindReplace(paneId);}
    else if(e.key==="Escape"){e.preventDefault();exFindClose(paneId);}});
  find.querySelectorAll(".ex-find-btn,.ex-find-x").forEach(b=>b.addEventListener("click",()=>{
    const a=b.dataset.act;
    if(a==="next")exFindStep(paneId,1);else if(a==="prev")exFindStep(paneId,-1);
    else if(a==="rep")exFindReplace(paneId);else if(a==="repall")exFindReplaceAll(paneId);
    else if(a==="case"){b.classList.toggle("on");exFindRun(paneId);}
    else if(a==="close")exFindClose(paneId);}));}
// ---- drag-to-split: dragging a tab to an edge splits the pane it's dropped ----
// on; dropping on a tab bar or the center zone just moves the tab there.
function exSetDropZone(el,zone){
  el.querySelectorAll(".ex-dropzone .zone").forEach(z=>z.classList.remove("show"));
  if(zone)el.querySelector(".zone."+zone).classList.add("show");}
function exZoneAt(e,el){
  if(e.target.closest(".ex-tabbar"))return"center";
  const r=el.getBoundingClientRect();
  const dx=(e.clientX-r.left)/r.width-0.5,dy=(e.clientY-r.top)/r.height-0.5;
  // split by the rectangle's diagonals into 4 edge triangles + a center square,
  // so a corner resolves to whichever edge it's actually closer to (not always left/right)
  if(Math.abs(dx)<0.15&&Math.abs(dy)<0.15)return"center";
  return Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"top":"bottom");}
function exDragOverPane(e,el){
  if(exDragTabId==null&&!exDragTree)return;
  e.preventDefault();e.dataTransfer.dropEffect=exDragTree?"copy":"move";
  exSetDropZone(el,exZoneAt(e,el));}
function exDropOnPane(e,el,paneId){
  e.preventDefault();exSetDropZone(el,null);
  const zone=exZoneAt(e,el);
  if(exDragTabId!=null){
    const id=exDragTabId,fromPane=exDragFromPane;
    exDragTabId=null;exDragFromPane=null;
    exPlaceTabInPane(id,fromPane,paneId,zone);return;}
  if(exDragTree){
    const{dsn,mbr}=exDragTree;exDragTree=null;
    exOpenTreeItemInPane(dsn,mbr,paneId,zone);return;}}
// ---- shared placement: used by both drag-an-open-tab and drag-from-navigator ----
function exPlaceTabInPane(id,fromPane,paneId,zone){
  const t=exTabs.find(x=>x.id===id);if(!t)return;
  exStash();
  if(zone==="center"){
    if(t.pane===paneId){exSwitch(id);return;}
    const oldPane=t.pane;t.pane=paneId;
    exPaneActive[paneId]=t.id;exCurId=t.id;exFocusPaneId=paneId;
    exRemoveTabsFromPane(oldPane,t.id);
    exRenderLayout();exRenderTopBar();return;}
  if(fromPane===paneId&&exTabs.filter(x=>x.pane===paneId).length<=1)return; // nothing else to split off
  if(exPaneIds().length>=EX_MAX_PANES){flash("Maximum of "+EX_MAX_PANES+" panes",false);return;}
  const newPaneId="p"+(exPaneSeq++),oldPane=t.pane;
  t.pane=newPaneId;exPaneActive[newPaneId]=t.id;
  exSplitPane(paneId,zone,newPaneId);
  exRemoveTabsFromPane(oldPane,t.id);
  exCurId=t.id;exFocusPaneId=newPaneId;
  exRenderLayout();exRenderTopBar();}
function exOpenTreeItemInPane(dsn,mbr,paneId,zone){
  const found=exTabs.find(t=>t.dsn===dsn&&t.mbr===mbr);
  if(found){exPlaceTabInPane(found.id,found.pane,paneId,zone);return;}
  exStash();
  const tab={id:++exTabSeq,dsn,mbr,text:"",dirty:false,loading:true,fmt:"auto"};
  if(zone==="center"){
    tab.pane=paneId;exTabs.push(tab);exPaneActive[paneId]=tab.id;
    exCurId=tab.id;exFocusPaneId=paneId;
  }else{
    if(exPaneIds().length>=EX_MAX_PANES){flash("Maximum of "+EX_MAX_PANES+" panes",false);return;}
    const newPaneId="p"+(exPaneSeq++);
    tab.pane=newPaneId;exTabs.push(tab);exPaneActive[newPaneId]=tab.id;
    exSplitPane(paneId,zone,newPaneId);
    exCurId=tab.id;exFocusPaneId=newPaneId;}
  exRenderLayout();exRenderTopBar();
  exLoadTabContent(tab);}

// ---- in-editor find & replace: per-pane bar, native textarea selection ----
// operates on the focused pane's active tab; matches are literal (with an
// optional case-sensitive toggle), selected in the textarea and scrolled into
// view. Replace-all rebuilds the buffer from the precomputed match offsets.
let exFindState={};
function exFindBar(paneId){const el=exFindPaneEl(paneId);return el?el.querySelector(".ex-find"):null;}
function exFindOpen(paneId){
  const el=exFindPaneEl(paneId);if(!el)return;
  const bar=el.querySelector(".ex-find");bar.classList.add("show");
  const ta=el.querySelector(".ex-text"),q=bar.querySelector(".ex-find-q");
  const sel=ta.value.substring(ta.selectionStart,ta.selectionEnd);
  if(sel&&!sel.includes("\n"))q.value=sel;
  q.focus();q.select();exFindRun(paneId);}
function exFindClose(paneId){const bar=exFindBar(paneId);if(!bar)return;
  bar.classList.remove("show");delete exFindState[paneId];
  const el=exFindPaneEl(paneId);if(el)el.querySelector(".ex-text").focus();}
function exFindMatches(text,q,cs){if(!q)return[];
  const hay=cs?text:text.toLowerCase(),n=cs?q:q.toLowerCase(),res=[];
  let i=0;while((i=hay.indexOf(n,i))>=0){res.push([i,i+n.length]);i+=n.length;}return res;}
function exFindRun(paneId){
  const el=exFindPaneEl(paneId);if(!el)return;const bar=el.querySelector(".ex-find");
  const q=bar.querySelector(".ex-find-q").value;
  const cs=bar.querySelector('[data-act="case"]').classList.contains("on");
  const matches=exFindMatches(el.querySelector(".ex-text").value,q,cs);
  exFindState[paneId]={matches,idx:matches.length?0:-1};
  exFindPaint(paneId);if(matches.length)exFindSelect(paneId);}
function exFindStep(paneId,dir){const st=exFindState[paneId];
  if(!st||!st.matches.length){exFindRun(paneId);return;}
  st.idx=(st.idx+dir+st.matches.length)%st.matches.length;
  exFindSelect(paneId);exFindPaint(paneId);}
function exFindSelect(paneId){const st=exFindState[paneId];const el=exFindPaneEl(paneId);if(!el||!st)return;
  const ta=el.querySelector(".ex-text"),m=st.matches[st.idx];if(!m)return;
  ta.setSelectionRange(m[0],m[1]);
  const line=(ta.value.slice(0,m[0]).match(/\n/g)||[]).length;
  const lh=parseFloat(getComputedStyle(ta).lineHeight)||18;
  ta.scrollTop=Math.max(0,line*lh-ta.clientHeight/2);exSyncPaneScroll(paneId);}
function exFindPaint(paneId){const st=exFindState[paneId]||{matches:[],idx:-1};
  const bar=exFindBar(paneId);if(!bar)return;
  bar.querySelector(".ex-find-count").textContent=st.matches.length?(st.idx+1)+"/"+st.matches.length:"0/0";}
function exFindReplace(paneId){const st=exFindState[paneId];const el=exFindPaneEl(paneId);if(!el||!st||!st.matches.length)return;
  const ta=el.querySelector(".ex-text"),bar=el.querySelector(".ex-find");
  const m=st.matches[st.idx],rep=bar.querySelector(".ex-find-r").value;
  ta.value=ta.value.slice(0,m[0])+rep+ta.value.slice(m[1]);
  exFindAfterEdit(paneId);exFindRun(paneId);}
function exFindReplaceAll(paneId){const st=exFindState[paneId];const el=exFindPaneEl(paneId);if(!el||!st||!st.matches.length)return;
  const ta=el.querySelector(".ex-text"),bar=el.querySelector(".ex-find");
  const rep=bar.querySelector(".ex-find-r").value;
  let out="",last=0;st.matches.forEach(m=>{out+=ta.value.slice(last,m[0])+rep;last=m[1];});
  out+=ta.value.slice(last);const count=st.matches.length;ta.value=out;
  exFindAfterEdit(paneId);exFindRun(paneId);
  flash("Replaced "+count+" occurrence"+(count===1?"":"s"),true);}
function exFindAfterEdit(paneId){ // mirror the input handler: dirty, refresh, persist
  exDirtyMark(paneId);exRefreshPaneEditorChrome(paneId);
  const t=exPaneTab(paneId),el=exFindPaneEl(paneId);
  if(t&&el)t.text=el.querySelector(".ex-text").value;
  exPersistSoon();}

// ---- line numbers + lightweight syntax highlighting (JCL/REXX/ASM, no deps) ----
function exEscHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
// built via string concat, not a single regex literal: the MVS-side FTP that
// deploys this file silently hard-wraps any line past ~254 chars, which
// snaps a long regex literal in two and breaks the whole script.
const EX_TOK=new RegExp(
  "(\\/\\*[\\s\\S]*?\\*\\/)|(^\\/\\/\\*.*$)|(^\\*.*$)|(^\\/\\/[A-Za-z0-9#@$][^\\s]*)|"+
  "('(?:[^']|'')*')|(\"(?:[^\"\\\\]|\\\\.)*\")|"+
  "(\\b(?:JOB|EXEC|PEND|PROC|IF|THEN|ELSE|ENDIF|INCLUDE|OUTPUT|SET|JCLLIB|DD|CNTL|ENDCNTL|"+
  "JOBLIB|COPY|EXCLUDE|SELECT|SCRATCH|RENAME|CATALOG|VOL|DSNAME|MEMBER|ADDRESS|ARG|CALL|DO|"+
  "DROP|EXIT|INTERPRET|ITERATE|LEAVE|NOP|NUMERIC|OPTIONS|OTHERWISE|PARSE|PROCEDURE|PULL|PUSH|"+
  "QUEUE|RETURN|SAY|SIGNAL|TRACE|UPPER|LOWER|WHEN|EXPOSE|FOREVER|TO|BY|WHILE|UNTIL|VALUE|WITH|"+
  "VAR)\\b)|(\\b\\d+\\b)",
  "gim");
function exHighlight(text){
  let out="",last=0,m;EX_TOK.lastIndex=0;
  while((m=EX_TOK.exec(text))){
    out+=exEscHtml(text.slice(last,m.index));
    const tok=m[0];let cls="";
    if(m[1]||m[2]||m[3])cls="tok-cmt";
    else if(m[4])cls="tok-name";
    else if(m[5]||m[6])cls="tok-str";
    else if(m[7])cls="tok-kw";
    else if(m[8])cls="tok-num";
    out+=cls?'<span class="'+cls+'">'+exEscHtml(tok)+'</span>':exEscHtml(tok);
    last=m.index+tok.length;}
  out+=exEscHtml(text.slice(last));
  return out;}
function exRefreshPaneView(paneId){
  const el=exFindPaneEl(paneId);if(!el)return;
  const t=exPaneTab(paneId),ta=el.querySelector(".ex-text");
  exRenderPaneTabBar(paneId);
  if(!t){ta.value="";ta.disabled=true;
    el.querySelector(".ex-gutter").textContent="";el.querySelector(".ex-hl code").innerHTML="";
    el.querySelector(".ex-ruler").innerHTML="";exPaneState(paneId,"ready");exPaneStatus(paneId,"");return;}
  ta.disabled=false;ta.value=t.loading?"":t.text;
  exPaneState(paneId,t.dirty?"modified":"saved");
  exPaneStatus(paneId,t.loading?"loading…":(t.text?t.text.split("\n").length:0)+" lines");
  exRefreshPaneEditorChrome(paneId);
  if(exCurId===t.id)exRenderTopBar();}
function exRefreshPaneEditorChrome(paneId){
  const el=exFindPaneEl(paneId);if(!el)return;
  const t=exPaneTab(paneId);if(!t)return;
  const val=el.querySelector(".ex-text").value;
  const n=(val.match(/\n/g)||[]).length+1;
  let g="";for(let i=1;i<=n;i++)g+=i+"\n";
  el.querySelector(".ex-gutter").textContent=g;
  el.querySelector(".ex-hl code").innerHTML=exHighlight(val)+"\n";
  el.querySelector(".ex-ruler").innerHTML=exBuildRuler(exResolveFmt(t));
  exSyncPaneScroll(paneId);}
function exSyncPaneScroll(paneId){const el=exFindPaneEl(paneId);if(!el)return;
  const ta=el.querySelector(".ex-text");
  el.querySelector(".ex-gutter").scrollTop=ta.scrollTop;
  const hl=el.querySelector(".ex-hl");hl.scrollTop=ta.scrollTop;hl.scrollLeft=ta.scrollLeft;
  el.querySelector(".ex-ruler").style.transform="translateX(-"+ta.scrollLeft+"px)";}
// ---- column ruler: a synced ruler line, format-aware (JCL/ASM both use   ----
// ---- col 72 as a continuation flag — a real bug this caught after the   ----
// ---- fact in sumloop.asm; this surfaces it visually instead. ----------- ----
function exResolveFmt(t){
  if(!t)return"plain";
  if(t.fmt&&t.fmt!=="auto")return t.fmt;
  const d=t.dsn.toUpperCase(),m=(t.mbr||"").toUpperCase();
  if(d.includes("JCL")||m.includes("JCL"))return"jcl";
  if(d.includes("ASM"))return"asm";
  if(d.includes("EXEC")||d.includes("REXX")||d.includes("RX"))return"rexx";
  return"plain";}
function exSetFmt(v){const t=exTab();if(!t)return;t.fmt=v;
  const el=exFindPaneEl(t.pane);if(el)el.querySelector(".ex-ruler").innerHTML=exBuildRuler(exResolveFmt(t));}
function exBuildRuler(fmt){
  const width=200,marked=(fmt==="jcl"||fmt==="asm");
  let html="";
  for(let c=1;c<=width;c++){
    const ch=(c%10===0)?String(Math.floor(c/10)%10):(c%5===0?"+":"-");
    let cls="";
    if(marked&&c===72)cls="mark72";else if(marked&&c===80)cls="mark80";
    html+=cls?'<span class="'+cls+'" title="col '+c+(c===72?" — continuation flag":" — card-reader limit")+'">'+ch+'</span>':ch;}
  return html;}
function exRenderPaneTabBar(paneId){
  const el=exFindPaneEl(paneId);if(!el)return;
  const bar=el.querySelector(".ex-tabbar");
  const tabs=exTabs.filter(t=>t.pane===paneId);
  bar.innerHTML="";bar.style.display=tabs.length?"flex":"none";
  tabs.forEach(t=>{const d=document.createElement("div");
    d.className="ex-tab"+(t.id===exPaneActive[paneId]?" cur":"")+(t.dirty?" dirty":"");
    d.title=exName(t);d.draggable=true;
    d.innerHTML='<span class="d">&#9679;</span><span class="l"></span><span class="x" title="close">&times;</span>';
    d.querySelector(".l").textContent=t.mbr||t.dsn;
    d.onclick=e=>{if(!e.target.classList.contains("x"))exSwitch(t.id);};
    d.querySelector(".x").onclick=e=>{e.stopPropagation();exCloseTab(t.id);};
    d.ondragstart=e=>{exDragTabId=t.id;exDragFromPane=paneId;e.dataTransfer.effectAllowed="move";
      try{e.dataTransfer.setData("text/plain",String(t.id));}catch(err){}};
    d.ondragend=()=>{exDragTabId=null;exDragFromPane=null;exClearDropzones();};
    d.oncontextmenu=e=>ctxShow(e,[["Submit JCL",()=>exSubmitTab(t.id)],
      ["Copy",()=>exSetClip('copy',t.dsn,t.mbr,false)],["Cut",()=>exSetClip('move',t.dsn,t.mbr,false)],
      [t.mbr?"Rename…":"Rename dataset…",()=>exRenameItem(t.dsn,t.mbr,false)],
      [t.mbr?"Delete member":"Delete dataset",()=>exDeleteItem(t.dsn,t.mbr)],
      "-",["Close",()=>exCloseTab(t.id)]]);
    bar.appendChild(d);});}
function exClearDropzones(){document.querySelectorAll(".ex-pane").forEach(el=>exSetDropZone(el,null));}
function exDirtyMark(paneId){const t=exPaneTab(paneId);if(t&&!t.dirty){t.dirty=true;
  exRenderPaneTabBar(paneId);exPaneState(paneId,"modified");if(exCurId===t.id)exRenderTopBar();}}
function exPaneState(paneId,text){const el=exFindPaneEl(paneId);if(el)el.querySelector(".ex-state").textContent=text;}
function exPaneStatus(paneId,text){const el=exFindPaneEl(paneId);if(el)el.querySelector(".ex-lines").textContent=text;}
function exStatus(text){const t=exTab();exPaneStatus(t?t.pane:exFocusPaneId,text);}
async function exSave(){const t=exTab();
  if(!t){flash("Nothing to save",false);return;}
  exStash();
  const p=packLines(t.text);p.action="save";p.dsn=t.dsn;p.member=t.mbr;
  exStatus("saving…");
  try{const r=await post("/rexx/WEBADM",p);
    if(/rc=0/.test(r)){
      const isNew=t.mbr&&(()=>{const open=[...document.querySelectorAll("#exTreeList .tree-item.open")].find(x=>x.dataset.dsn===t.dsn);
        return open&&![...open.nextElementSibling.children].some(k=>k.textContent===t.mbr)?open:null;})();
      t.dirty=false;exRenderPaneTabBar(t.pane);exPaneState(t.pane,"saved");exRenderTopBar();exStatus(p.count+" lines");
      flash("Saved "+exName(t)+" — "+p.count+" lines",true);
      if(isNew){exToggle(isNew,t.dsn);exToggle(isNew,t.dsn);}}
    else{flash(r.trim(),false);exStatus("");}}
  catch(e){flash("Save failed: "+e.message,false);exStatus("");}}
// ---- submit-as-JCL (Zowe-style) ----
async function exJobIds(name){
  try{const j=JSON.parse(await get("/jes/status?job="+encodeURIComponent(name)));return (j.data||[]).map(x=>x.jobid);}
  catch(e){return [];}}
async function exWatchJob(name,before,label){
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    await new Promise(r=>setTimeout(r,1200));
    let jobs=[];
    try{jobs=JSON.parse(await get("/jes/status?job="+encodeURIComponent(name))).data||[];}catch(e){continue;}
    const fresh=jobs.filter(j=>!before.includes(j.jobid));
    const hit=fresh.find(j=>j.status==="OUTPUT")||fresh.find(j=>j.status==="ACTIVE");
    if(hit){exJobsRefresh();flash(label+" — job "+hit.jobname+" ("+hit.jobid+") "+(hit.status==="OUTPUT"?"finished":"is running"),true,
      {jobname:hit.jobname,jobid:hit.jobid});return;}}}
async function exSubmitText(label,text){
  if(!text.trim()){flash("Nothing to submit",false);return;}
  if(!/^\/\/\S+\s+JOB/m.test(text)&&!confirm(label+" doesn't look like JCL (no JOB card). Submit anyway?"))return;
  const jobname=(text.match(/^\/\/(\S{1,8})\s+JOB/m)||[])[1];
  const before=jobname?await exJobIds(jobname):[];
  const p=packLines(text);p.action="submit";
  exStatus("submitting…");
  try{const r=await post("/rexx/WEBADM",p);
    const ok=/rc=0/.test(r);
    flash((ok?"Submitted "+label+" — ":"")+r.trim().replace(/\s*-\s*see jobs tab\.?$/i,""),ok);
    exStatus("");
    if(ok){exJobsRefresh();if(jobname)exWatchJob(jobname,before,"Submitted "+label);}}
  catch(e){flash("Submit failed: "+e.message,false);exStatus("");}}
function exSubmitTab(id){exStash();const t=exTabs.find(x=>x.id===id);if(t)exSubmitText(exName(t),t.text);}
async function exSubmitTree(dsn,mbr){
  const label=dsn+(mbr?"("+mbr+")":"");
  try{let u="/dsl/print?dsn="+encodeURIComponent(dsn);if(mbr)u+="&member="+encodeURIComponent(mbr);
    const t=(await get(u)).replace(/[ \t]+(?=\n)/g,"").replace(/\s+$/,"");
    exSubmitText(label,t);}
  catch(e){flash("Submit failed: "+e.message,false);}}
// ---- clipboard: copy/move datasets & members ----
// Built entirely on WEBADM read/save plus small submitted utility jobs — no
// server-side changes needed. Member delete uses IEBCOPY EXCLUDE into a temp
// PDS then recreates the original from the temp (in-place compress-with-
// exclude is rejected by IEBCOPY; IEHPROGM SCRATCH needs a volume "mount"
// this Hercules setup can't satisfy for resident packs). DCB=(sourcedsn)
// referback means RECFM/LRECL/BLKSIZE/DSORG never need to be parsed by hand.
let exClip=null;
function exClipLabel(){if(!exClip)return"";
  const what=exClip.kind==="pds"?exClip.dsn+" (all members)":exClip.dsn+(exClip.mbr?"("+exClip.mbr+")":"");
  return(exClip.op==="move"?"Cut: ":"Copied: ")+what;}
function exRenderClip(){const b=$("#exClipBar");
  if(!exClip){b.style.display="none";return;}
  b.style.display="flex";$("#exClipText").textContent=exClipLabel();}
function exClearClip(){exClip=null;exRenderClip();}
function exSetClip(op,dsn,mbr,wholePds){
  exClip={op,kind:wholePds?"pds":"item",dsn,mbr:mbr||""};
  exRenderClip();
  flash((op==="move"?"Cut ":"Copied ")+dsn+(mbr?"("+mbr+")":wholePds?" (all members)":"")+" — right-click a destination to paste",true);}
function exClipMenu(targetType,dsn,mbr){
  const items=["-"];
  if(targetType==="pds"){
    items.push(["Copy dataset",()=>exSetClip("copy",dsn,"",true)]);
    items.push(["Cut dataset",()=>exSetClip("move",dsn,"",true)]);
    items.push(["Rename dataset…",()=>exRenameItem(dsn,"",true)]);
    items.push(["Delete dataset",()=>exDeleteItem(dsn,"")]);
  }else{
    items.push(["Copy",()=>exSetClip("copy",dsn,mbr||"",false)]);
    items.push(["Cut",()=>exSetClip("move",dsn,mbr||"",false)]);
    items.push([targetType==="member"?"Rename…":"Rename dataset…",()=>exRenameItem(dsn,mbr||"",false)]);
    items.push([targetType==="member"?"Delete member":"Delete dataset",()=>exDeleteItem(dsn,mbr||"")]);
  }
  if(exClip){
    items.push("-");
    if(targetType==="pds")items.push([exClip.kind==="pds"?"Paste (merge members)":"Paste as new member…",()=>exPaste(dsn,true)]);
    else if(targetType==="member"){if(exClip.kind==="item")items.push(["Paste (overwrite this member)",()=>exPasteOverMember(dsn,mbr)]);}
    else{if(exClip.kind==="item")items.push(["Paste (overwrite dataset)",()=>exPaste(dsn,false)]);}
    items.push(["Paste into new dataset…",()=>exPasteIntoNew()]);
  }
  return items;}
function exBgMenu(e){if(e.target.id!=="exTreeList"||!exClip)return;
  ctxShow(e,[["Paste into new dataset…",()=>exPasteIntoNew()]]);}
function exName2(clip){return clip.dsn+(clip.mbr?"("+clip.mbr+")":"");}

async function exRunJob(jobname,lines){
  const params=packLines(lines.join("\n"));params.action="submit";
  const r=await post("/rexx/WEBADM",params);
  if(!/rc=0/.test(r))throw new Error("submit failed — "+r.trim());
  const id=await waitJob(jobname);
  if(!id)throw new Error(jobname+" submitted but never reached OUTPUT — check Jobs tab");
  const out=await get("/jes/print?jobid="+encodeURIComponent(id));
  try{await post("/jes/purge",{jobname,jobid:id});}
  catch(e){/* spool cleanup failing doesn't mean the job itself failed - we
    already have the real output; leave the spool entry for later cleanup
    rather than throw away a result that actually completed */}
  return out;}
function exWhy(out){
  if(/NOT CATLGD 2|DUPLICATE|ALREADY IN CATALOG/i.test(out))return"already exists";
  if(/JCL ERROR/i.test(out))return"JCL error";
  if(/SPACE AVAILABLE|IGD|IEF257I/i.test(out))return"not enough space";
  return"see Jobs tab output for details";}

async function exAllocLike(newDsn,likeDsn,isPO){
  const out=await exRunJob("HERC01AL",[
    "//HERC01AL JOB (ALLOC),'ALLOC LIKE',CLASS=A,MSGCLASS=H,",
    "//         USER=HERC01,PASSWORD=CUL8TR",
    "//A       EXEC PGM=IEFBR14",
    "//D       DD DSN="+newDsn+",DISP=(NEW,CATLG,DELETE),",
    "//            UNIT=SYSDA,SPACE=(TRK,(20,20"+(isPO?",20":"")+")),",
    "//            DCB=("+likeDsn+")"]);
  if(!/CATALOGED/i.test(out)||/NOT CATLGD/i.test(out))throw new Error("allocate "+newDsn+" failed — "+exWhy(out));}

async function exDeleteWholeDataset(dsn){
  if(exIsProtected(dsn))throw new Error(dsn+" is a protected system dataset — delete it via 3270/JCL, not this UI");
  const out=await exRunJob("HERC01DL",[
    "//HERC01DL JOB (DEL),'DELETE DS',CLASS=A,MSGCLASS=H,",
    "//         USER=HERC01,PASSWORD=CUL8TR",
    "//A       EXEC PGM=IEFBR14",
    "//D       DD DSN="+dsn+",DISP=(OLD,DELETE,DELETE)"]);
  if(!/\bDELETED\b/i.test(out))throw new Error("delete "+dsn+" failed — "+exWhy(out));}

// list member names of a PDS via the read-only /dsl/pds endpoint; returns
// null (not []) if the dataset itself couldn't be read at all, vs. [] for a
// genuinely empty PDS (404 "no members" is normal there) — callers must
// treat null as "verification failed", not "zero members".
async function exListMembers(dsn){
  try{return(await get("/dsl/pds?dsn="+encodeURIComponent(dsn))).split("\n")
    .map(l=>l.split(/\s+/)[0]).filter(m=>m&&!/^Elapsed/i.test(m));}
  catch(e){return /->\s*404/.test(e.message)?[]:null;}}

// ---- delete a member: build-and-verify the replacement BEFORE touching the ----
// original, so a failure at any point leaves real data intact somewhere,
// never "original gone, nothing rebuilt" (see EX_PROTECTED_HLQ above for why
// this ordering matters). Three separate jobs, each checkpointed by a live
// /dsl/pds read rather than trusting job-output text alone.
async function exDeleteMember(dsn,mbr){
  if(exIsProtected(dsn))throw new Error(dsn+" is a protected system dataset — delete members via 3270/JCL, not this UI");
  const tmp=dsn.split(".")[0]+".MV"+Date.now().toString(36).slice(-6).toUpperCase();
  const srcMembers=await exListMembers(dsn);
  if(srcMembers===null)throw new Error("couldn't read "+dsn+" to verify — aborted, nothing changed");
  if(!srcMembers.includes(mbr))throw new Error(mbr+" not found in "+dsn);

  // Step 1: build the replacement (dsn minus mbr) under a temp name. The
  // original is not touched by this step at all.
  const out1=await exRunJob("HERC01M1",[
    "//HERC01M1 JOB (MV),'MEMBER COPY',CLASS=A,MSGCLASS=H,",
    "//         USER=HERC01,PASSWORD=CUL8TR",
    "//S1      EXEC PGM=IEBCOPY",
    "//SYSPRINT DD SYSOUT=*",
    "//IN1      DD DISP=SHR,DSN="+dsn,
    "//OUT1     DD DSN="+tmp+",DISP=(NEW,CATLG,DELETE),",
    "//            UNIT=SYSDA,SPACE=(TRK,(50,30,40)),",
    "//            DCB=("+dsn+")",
    "//SYSIN    DD *",
    "  COPY OUTDD=OUT1,INDD=((IN1,R))",
    "  EXCLUDE MEMBER="+mbr,
    "/*"]);
  if(!/CATALOGED/i.test(out1))throw new Error("could not build a replacement for "+dsn+" — "+exWhy(out1)+"; original untouched");
  const tmpMembers=await exListMembers(tmp);
  if(tmpMembers===null||tmpMembers.includes(mbr)||tmpMembers.length!==srcMembers.length-1)
    throw new Error("replacement copy for "+dsn+" doesn't look right (check "+tmp+") — original untouched");

  // Step 2: only now swap dsn -> rebuilt-from-tmp. A verified-good copy
  // already exists in tmp, so nothing is lost even if this step fails.
  const out2=await exRunJob("HERC01M2",[
    "//HERC01M2 JOB (MV),'MEMBER SWAP',CLASS=A,MSGCLASS=H,",
    "//         USER=HERC01,PASSWORD=CUL8TR",
    "//S1      EXEC PGM=IEFBR14",
    "//D1       DD DSN="+dsn+",DISP=(OLD,DELETE,DELETE)",
    "//S2      EXEC PGM=IEBCOPY,COND=(0,NE,S1)",
    "//SYSPRINT DD SYSOUT=*",
    "//IN1      DD DISP=SHR,DSN="+tmp,
    "//OUT1     DD DSN="+dsn+",DISP=(NEW,CATLG,DELETE),",
    "//            UNIT=SYSDA,SPACE=(TRK,(50,30,40)),",
    "//            DCB=("+tmp+")",
    "//SYSIN    DD *",
    "  COPY OUTDD=OUT1,INDD=IN1",
    "/*"]);
  if(!(/CATALOGED/i.test(out2)&&/\bDELETED\b/i.test(out2)))
    throw new Error(dsn+" delete did not complete — your data is safe in "+tmp+", recover it manually (check the Jobs tab)");

  // Verify the final result before cleaning up the temp backup.
  const finalMembers=await exListMembers(dsn);
  if(finalMembers===null||finalMembers.includes(mbr)||finalMembers.length!==srcMembers.length-1)
    throw new Error(dsn+" was rebuilt but looks wrong — your data is safe in "+tmp+", recover it manually (check the Jobs tab)");

  await exRunJob("HERC01M3",[
    "//HERC01M3 JOB (MV),'CLEANUP TEMP',CLASS=A,MSGCLASS=H,",
    "//         USER=HERC01,PASSWORD=CUL8TR",
    "//S1      EXEC PGM=IEFBR14",
    "//D1       DD DSN="+tmp+",DISP=(OLD,DELETE,DELETE)"]);}

async function exCopyWholePds(srcDsn,destDsn,isNewDest){
  const lines=[
    "//HERC01CP JOB (CP),'COPY PDS',CLASS=A,MSGCLASS=H,",
    "//         USER=HERC01,PASSWORD=CUL8TR",
    "//S1      EXEC PGM=IEBCOPY",
    "//SYSPRINT DD SYSOUT=*",
    "//IN1      DD DISP=SHR,DSN="+srcDsn];
  if(isNewDest){
    lines.push("//OUT1     DD DSN="+destDsn+",DISP=(NEW,CATLG,DELETE),");
    lines.push("//            UNIT=SYSDA,SPACE=(TRK,(20,20,20)),");
    lines.push("//            DCB=("+srcDsn+")");
  }else lines.push("//OUT1     DD DISP=SHR,DSN="+destDsn);
  lines.push("//SYSIN    DD *","  COPY OUTDD=OUT1,INDD=IN1","/*");
  const out=await exRunJob("HERC01CP",lines);
  const copied=[...out.matchAll(/IEB154I\s+(\S+)\s+HAS BEEN SUCCESSFULLY\s+COPIED/gi)].map(m=>m[1]);
  if(!copied.length&&!/CATALOGED/i.test(out))throw new Error("copy failed — "+exWhy(out));
  return copied;}

async function exDeleteSource(clip){
  try{if(clip.mbr)await exDeleteMember(clip.dsn,clip.mbr);else await exDeleteWholeDataset(clip.dsn);}
  catch(e){flash("Pasted, but couldn't remove the original — "+e.message,false);}}

async function exDeleteItem(dsn,mbr){
  const label=dsn+(mbr?"("+mbr+")":"");
  if(exIsProtected(dsn)){flash(dsn+" is a protected system dataset — delete via 3270/JCL, not this UI",false);return;}
  if(!confirm("Delete "+label+(mbr?"":" and ALL of its members")+"? This cannot be undone."))return;
  try{
    if(mbr)await exDeleteMember(dsn,mbr);else await exDeleteWholeDataset(dsn);
    const dead=exTabs.filter(t=>t.dsn===dsn&&(!mbr||t.mbr===mbr));
    dead.forEach(t=>{exTabs=exTabs.filter(x=>x!==t);exRemoveTabsFromPane(t.pane,t.id);
      if(exCurId===t.id)exCurId=-1;});
    if(exCurId===-1){const nt=exPaneTab(exFocusPaneId)||exTabs[0];exCurId=nt?nt.id:-1;if(nt)exFocusPaneId=nt.pane;}
    exRenderLayout();exRenderTopBar();
    if(exClip&&exClip.dsn===dsn&&(!mbr||exClip.mbr===mbr))exClearClip();
    flash("Deleted "+label,true);
    exTree();
  }catch(e){flash("Delete failed: "+e.message,false);}}

// ---- rename: write under the new name, then delete the old one (same ----
// ---- primitives as Move — see exDeleteMember/exDeleteWholeDataset)   ----
function exRetarget(oldDsn,oldMbr,newDsn,newMbr){
  for(const t of exTabs)if(t.dsn===oldDsn&&t.mbr===(oldMbr||""))
    {t.dsn=newDsn;t.mbr=newMbr||"";}
  if(exClip&&exClip.dsn===oldDsn&&exClip.mbr===(oldMbr||""))
    {exClip.dsn=newDsn;exClip.mbr=newMbr||"";exRenderClip();}
  exPaneIds().forEach(exRenderPaneTabBar);exRenderTopBar();}
async function exRenameMember(dsn,oldMbr){
  const m=prompt("Rename member "+oldMbr+" to:",oldMbr);
  if(m===null)return;
  const newMbr=m.trim().toUpperCase();
  if(!newMbr||newMbr===oldMbr)return;
  if(!/^[A-Z#@$][A-Z0-9#@$]{0,7}$/.test(newMbr)){flash("Invalid member name",false);return;}
  try{
    const text=(await get("/dsl/print?dsn="+encodeURIComponent(dsn)+"&member="+encodeURIComponent(oldMbr)))
      .replace(/[ \t]+(?=\n)/g,"").replace(/\s+$/,"");
    const p=packLines(text);p.action="save";p.dsn=dsn;p.member=newMbr;
    const r=await post("/rexx/WEBADM",p);
    if(!/rc=0/.test(r))throw new Error(r.trim());
    await exDeleteMember(dsn,oldMbr);
    exRetarget(dsn,oldMbr,dsn,newMbr);
    flash("Renamed "+dsn+"("+oldMbr+") to "+newMbr,true);
    exTree();
  }catch(e){flash("Rename failed: "+e.message,false);}}
async function exRenameDataset(dsn,isPO){
  if(exIsProtected(dsn)){flash(dsn+" is a protected system dataset — rename it via 3270/JCL, not this UI",false);return;}
  const d=prompt("Rename dataset "+dsn+" to:",dsn);
  if(d===null)return;
  const newDsn=d.trim().toUpperCase();
  if(!newDsn||newDsn===dsn)return;
  if(!/^[A-Z#@$][A-Z0-9#@$]{0,7}(\.[A-Z#@$][A-Z0-9#@$]{0,7})*$/.test(newDsn)){flash("Invalid dataset name",false);return;}
  try{
    if(isPO)await exCopyWholePds(dsn,newDsn,true);
    else{
      await exAllocLike(newDsn,dsn,false);
      const text=(await get("/dsl/print?dsn="+encodeURIComponent(dsn))).replace(/[ \t]+(?=\n)/g,"").replace(/\s+$/,"");
      const p=packLines(text);p.action="save";p.dsn=newDsn;p.member="";
      const r=await post("/rexx/WEBADM",p);
      if(!/rc=0/.test(r))throw new Error(r.trim());
    }
    await exDeleteWholeDataset(dsn);
    exRetarget(dsn,"",newDsn,"");
    flash("Renamed "+dsn+" to "+newDsn,true);
    $("#exFilter").value=newDsn.split(".")[0];
    exTree(newDsn,isPO);
  }catch(e){flash("Rename failed: "+e.message,false);}}
function exRenameItem(dsn,mbr,isPO){
  if(mbr)return exRenameMember(dsn,mbr);
  return exRenameDataset(dsn,isPO);}

async function exPaste(destDsn,destIsPO){
  if(!exClip){flash("Clipboard is empty",false);return;}
  const clip=exClip;
  try{
    if(clip.kind==="item"){
      let destMbr="";
      if(destIsPO){
        const suggested=clip.mbr||clip.dsn.split(".").pop();
        const m=prompt("Member name in "+destDsn+":",suggested);
        if(m===null)return;
        destMbr=m.trim().toUpperCase();
        if(!/^[A-Z#@$][A-Z0-9#@$]{0,7}$/.test(destMbr)){flash("Invalid member name",false);return;}
      }else if(!confirm("Overwrite the contents of "+destDsn+" with "+exName2(clip)+"?"))return;
      if(destDsn===clip.dsn&&destMbr===clip.mbr){flash("Source and destination are the same",false);return;}
      let u="/dsl/print?dsn="+encodeURIComponent(clip.dsn);if(clip.mbr)u+="&member="+encodeURIComponent(clip.mbr);
      const text=(await get(u)).replace(/[ \t]+(?=\n)/g,"").replace(/\s+$/,"");
      const p=packLines(text);p.action="save";p.dsn=destDsn;p.member=destMbr;
      const r=await post("/rexx/WEBADM",p);
      if(!/rc=0/.test(r))throw new Error(r.trim());
      flash("Pasted into "+destDsn+(destMbr?"("+destMbr+")":""),true);
    }else{
      if(!destIsPO){flash("Can't paste a whole dataset's members into a sequential dataset",false);return;}
      const copied=await exCopyWholePds(clip.dsn,destDsn,false);
      flash("Copied "+copied.length+" member(s) from "+clip.dsn+" into "+destDsn+
        (clip.op==="move"?" — source left in place (merge-move isn't supported; use \"Paste into new dataset\" to fully move)":""),true);
      exTree();return;
    }
    if(clip.op==="move")await exDeleteSource(clip);
    exClearClip();exTree();
  }catch(e){flash("Paste failed: "+e.message,false);}}

async function exPasteOverMember(destDsn,destMbr){
  if(!exClip||exClip.kind!=="item"){flash("Clipboard is empty or holds a whole dataset",false);return;}
  const clip=exClip;
  if(destDsn===clip.dsn&&destMbr===clip.mbr){flash("Source and destination are the same",false);return;}
  if(!confirm("Overwrite "+destDsn+"("+destMbr+") with "+exName2(clip)+"?"))return;
  try{
    let u="/dsl/print?dsn="+encodeURIComponent(clip.dsn);if(clip.mbr)u+="&member="+encodeURIComponent(clip.mbr);
    const text=(await get(u)).replace(/[ \t]+(?=\n)/g,"").replace(/\s+$/,"");
    const p=packLines(text);p.action="save";p.dsn=destDsn;p.member=destMbr;
    const r=await post("/rexx/WEBADM",p);
    if(!/rc=0/.test(r))throw new Error(r.trim());
    flash("Pasted into "+destDsn+"("+destMbr+")",true);
    if(clip.op==="move")await exDeleteSource(clip);
    exClearClip();exTree();
  }catch(e){flash("Paste failed: "+e.message,false);}}

async function exPasteIntoNew(){
  if(!exClip){flash("Clipboard is empty",false);return;}
  const clip=exClip;
  const suggested=clip.kind==="pds"?clip.dsn+".COPY":(clip.mbr?clip.dsn.split(".")[0]+".NEW."+clip.mbr:clip.dsn+".COPY");
  const dsn=(prompt("New dataset name:",suggested)||"").trim().toUpperCase();
  if(!dsn)return;
  if(!/^[A-Z#@$][A-Z0-9#@$]{0,7}(\.[A-Z#@$][A-Z0-9#@$]{0,7})*$/.test(dsn)){flash("Invalid dataset name",false);return;}
  try{
    let isPO;
    if(clip.kind==="pds"){await exCopyWholePds(clip.dsn,dsn,true);isPO=true;}
    else{
      isPO=!!clip.mbr;
      await exAllocLike(dsn,clip.dsn,isPO);
      let u="/dsl/print?dsn="+encodeURIComponent(clip.dsn);if(clip.mbr)u+="&member="+encodeURIComponent(clip.mbr);
      const text=(await get(u)).replace(/[ \t]+(?=\n)/g,"").replace(/\s+$/,"");
      const p=packLines(text);p.action="save";p.dsn=dsn;p.member=isPO?clip.mbr:"";
      const r=await post("/rexx/WEBADM",p);
      if(!/rc=0/.test(r))throw new Error(r.trim());
    }
    flash("Copied "+(clip.kind==="pds"?clip.dsn+" (all members)":exName2(clip))+" to new dataset "+dsn,true);
    if(clip.op==="move")await exDeleteSource(clip);
    exClearClip();
    $("#exFilter").value=dsn.split(".")[0];
    exTree(dsn,isPO);
  }catch(e){flash("Create/paste failed: "+e.message,false);}}

// ---- context menu ----
function ctxShow(e,items){e.preventDefault();e.stopPropagation();
  const m=$("#ctx");m.innerHTML="";
  items.forEach(it=>{
    if(it==="-"){m.appendChild(Object.assign(document.createElement("div"),{className:"sep"}));return;}
    const d=document.createElement("div");d.className="ci";d.textContent=it[0];
    d.onclick=ev=>{ev.stopPropagation();ctxHide();it[1]();};m.appendChild(d);});
  m.classList.add("show");
  m.style.left=Math.min(e.clientX,innerWidth-m.offsetWidth-8)+"px";
  m.style.top=Math.min(e.clientY,innerHeight-m.offsetHeight-8)+"px";}
function ctxHide(){$("#ctx").classList.remove("show");}

// ---- new dataset ----
function openNewDs(){$("#newds").classList.add("show");$("#ndInfo").textContent="";$("#ndCreate").disabled=false;
  const hlq=($("#exFilter").value.trim()||currentUserHlq).split(".")[0];
  if(hlq&&!$("#ndDsn").value)$("#ndDsn").value=hlq+".NEW.PDS";
  ndTypeChange();$("#ndDsn").focus();}
function closeNewDs(){$("#newds").classList.remove("show");}
function ndTypeChange(){const t=$("#ndType").value;const dir=$("#ndDir");
  dir.disabled=(t!=="PO");dir.style.opacity=(t==="PO")?1:.35;
  $("#ndSpaceNote").textContent=(t==="PO")?"primary / secondary / directory-blocks":"primary / secondary (no directory for "+t+")";}
function ndRecfmChange(){const rf=$("#ndRecfm").value,b=$("#ndBlk"),l=$("#ndLrecl");
  if(rf[0]==="V"){if(b.value==="3120")b.value="6160";}else if(rf==="U"){l.value="0";if(b.value==="3120")b.value="6144";}
  else if(b.value==="6160")b.value="3120";}
async function waitJob(name){for(let i=0;i<15;i++){await new Promise(r=>setTimeout(r,900));
  try{const j=JSON.parse(await get("/jes/status?job="+encodeURIComponent(name)));
    const d=(j.data||[]).find(x=>x.jobname===name&&x.status==="OUTPUT");if(d)return d.jobid;}catch(e){}}
  return null;}
async function createDataset(){
  const dsn=$("#ndDsn").value.trim().toUpperCase();
  if(!/^[A-Z#@$][A-Z0-9#@$]{0,7}(\.[A-Z#@$][A-Z0-9#@$]{0,7})*$/.test(dsn)){flash("Invalid dataset name",false);return;}
  const t=$("#ndType").value,vol=$("#ndVol").value.trim().toUpperCase();
  const rf=$("#ndRecfm").value,lr=$("#ndLrecl").value.trim(),bk=$("#ndBlk").value.trim();
  const p=$("#ndPri").value.trim(),s=$("#ndSec").value.trim(),d=$("#ndDir").value.trim();
  const space=(t==="PO")?`SPACE=(TRK,(${p},${s},${d}))`:`SPACE=(TRK,(${p},${s}))`;
  const unit="UNIT=SYSDA"+(vol?`,VOL=SER=${vol}`:"");
  const J=[
    "//HERC01NA JOB (ALLOC),'NEW DATASET',CLASS=A,MSGCLASS=H,",
    "//         USER=HERC01,PASSWORD=CUL8TR",
    "//A       EXEC PGM=IEFBR14",
    `//D       DD DSN=${dsn},DISP=(NEW,CATLG,DELETE),`,
    `//            ${unit},${space},`,
    `//            DCB=(DSORG=${t},RECFM=${rf},LRECL=${lr},BLKSIZE=${bk})`
  ];
  const params=packLines(J.join("\n"));params.action="submit";
  const btn=$("#ndCreate");btn.disabled=true;$("#ndInfo").textContent="submitting…";
  try{
    const r=await post("/rexx/WEBADM",params);
    if(!/rc=0/.test(r)){flash(r.trim(),false);$("#ndInfo").textContent="";btn.disabled=false;return;}
    $("#ndInfo").textContent="allocating…";
    const id=await waitJob("HERC01NA");
    if(!id){flash("Submitted, but couldn't confirm — check the Jobs tab",false);$("#ndInfo").textContent="";btn.disabled=false;return;}
    const out=await get("/jes/print?jobid="+encodeURIComponent(id));
    try{await post("/jes/purge",{jobname:"HERC01NA",jobid:id});}catch(e){/* cleanup only - see exRunJob */}
    if(/CATALOGED|CATLGED/i.test(out)&&!/NOT CATLGD/i.test(out)){
      flash("Created "+dsn,true);closeNewDs();
      $("#exFilter").value=dsn.split(".")[0];
      openExplorer(dsn,t==="PO");
    }else{
      let why="allocation failed";
      if(/NOT CATLGD 2|DUPLICATE|ALREADY IN CATALOG/i.test(out))why="dataset already exists";
      else if(/JCL ERROR/i.test(out))why="JCL error (check attributes)";
      else if(/SPACE AVAILABLE|IGD|IEF257I/i.test(out))why="not enough space on volume";
      flash("Create failed: "+why,false);$("#ndInfo").textContent="";btn.disabled=false;}
  }catch(e){flash("Create failed: "+e.message,false);$("#ndInfo").textContent="";btn.disabled=false;}
}

async function listJobs(){const f=$("#jobFilter").value.trim()||"*";const tb=$("#jobRows");
  tb.innerHTML='<tr><td colspan="4" class="muted">loading…</td></tr>';
  try{const t=await get("/jes/status?job="+encodeURIComponent(f));const j=JSON.parse(t);
    const rows=j.data||[];tb.innerHTML="";
    if(!rows.length){tb.innerHTML='<tr><td colspan="4" class="muted">no jobs</td></tr>';return;}
    rows.forEach(job=>{const tr=document.createElement("tr");
      const st=["OUTPUT","ACTIVE"].indexOf(job.status)>=0?job.status:"other";
      tr.innerHTML='<td><a class="link">'+job.jobname+'</a></td><td class="muted">'+job.jobid+
        '</td><td><span class="pill '+st+'">'+job.status+'</span></td>'+
        '<td><button class="btn danger" style="padding:3px 8px;font-size:11px">purge</button></td>';
      tr.querySelector("a").onclick=()=>viewJob(job.jobname,job.jobid);
      tr.querySelector("button").onclick=()=>purgeJob(job.jobname,job.jobid);
      tb.appendChild(tr);});}
  catch(e){tb.innerHTML='<tr><td colspan="4" style="color:var(--err)">'+e.message+'</td></tr>';}}
async function viewJob(name,id){$("#joName").textContent=name+" ("+id+")";$("#joName").className="";
  $("#jobOut").textContent="loading…";
  try{$("#jobOut").textContent=await get("/jes/print?jobid="+encodeURIComponent(id));}
  catch(e){$("#jobOut").textContent="";flash(e.message,false);}}
async function purgeJob(name,id){if(!confirm("Purge "+name+" "+id+"?"))return;
  try{await post("/jes/purge",{jobname:name,jobid:id});
    // HTTPJES2 reports rc=0 even when it can't remove output that is assigned
    // to a printer device (class-Z output stuck on the drained PRINTER2
    // sockdev). Verify, and tell the truth if it's still there.
    const chk=JSON.parse(await get("/jes/status?jobid="+encodeURIComponent(id)));
    if(!(chk.data||[]).length){flash("Purged "+name,true);}
    else{flash("Could not purge "+name+" — its output is queued to PRINTER2. Run drain-printer2.ps1 to clear class-Z output.",false);}
    listJobs();exJobsRefresh();}
  catch(e){flash(e.message,false);}}

health();
// wait for whoami() so currentUserHlq is set before the Explorer's first
// tree fetch picks a default HLQ - avoids a flash of the wrong dataset list.
(async()=>{await whoami();renderQuickAccess();exRestore();exRenderLayout();exRenderTopBar();exJobsRenderCollapse();openExplorer();})();
$("#jobFilter").addEventListener("keydown",e=>{if(e.key==="Enter")listJobs();});
$("#exJobFilter").addEventListener("keydown",e=>{if(e.key==="Enter")exJobsRefresh();});
$("#newds").addEventListener("click",e=>{if(e.target.id==="newds")closeNewDs();});
$("#props").addEventListener("click",e=>{if(e.target.id==="props")closeProps();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeNewDs();closeProps();ctxHide();}});
$("#exFilter").addEventListener("keydown",e=>{if(e.key==="Enter")exTree();});
$("#operCmd").addEventListener("keydown",e=>{
  if(e.key==="Enter")operSend();
  else if(e.key==="ArrowUp"){e.preventDefault();operHistNav(1);}
  else if(e.key==="ArrowDown"){e.preventDefault();operHistNav(-1);}});
document.addEventListener("click",ctxHide);
$("#msg").addEventListener("mouseenter",()=>clearTimeout($("#msg")._t));
$("#msg").addEventListener("mouseleave",e=>{const m=e.currentTarget;m._t=setTimeout(()=>m.className="msg",m._dur||4500);});
window.addEventListener("resize",ctxHide);
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&(e.key==="s"||e.key==="S")&&$("#explorer").classList.contains("show")){
    e.preventDefault();exSave();}
  else if((e.ctrlKey||e.metaKey)&&(e.key==="f"||e.key==="F")&&$("#explorer").classList.contains("show")){
    if(exPaneTab(exFocusPaneId)){e.preventDefault();exFindOpen(exFocusPaneId);}}});
window.addEventListener("beforeunload",e=>{exStash();exPersist();if(exAnyDirty()){e.preventDefault();e.returnValue="";}});
