/* Jivlag neon: one icon family, theme colours, extra account options */
(function(){
"use strict";

/* ---------- 1. Icons: one style (24 grid, round strokes, soft duotone fill) ---------- */
// [outline path, duotone fill path ("=" = same as outline)] or ["<raw svg>"]
var I={
home:["M4 10.8 12 4.2l8 6.6V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19zM9.800 20.500v-5.200h4.400v5.200","="],
reels:["M8.500 3.800h7a4.700 4.700 0 0 1 4.700 4.700v7a4.700 4.700 0 0 1-4.700 4.700h-7a4.700 4.700 0 0 1-4.700-4.700v-7a4.700 4.700 0 0 1 4.700-4.700zM10.300 9v6l5-3z","="],
post:["M8.500 3.800h7a4.700 4.700 0 0 1 4.700 4.700v7a4.700 4.700 0 0 1-4.700 4.700h-7a4.700 4.700 0 0 1-4.700-4.700v-7a4.700 4.700 0 0 1 4.700-4.700zM12 8.500v7M8.500 12h7"],
chat:["M12 3.800c4.600 0 8.200 3.100 8.200 7.100s-3.600 7.100-8.200 7.100c-.9 0-1.800-.1-2.600-.4L5 20l1-3.600c-1.400-1.300-2.200-3.300-2.200-5.500 0-4 3.600-7.100 8.200-7.100z","="],
comment:["M5 5h14a1.500 1.500 0 0 1 1.500 1.500v9a1.500 1.500 0 0 1-1.500 1.500h-6.500L8 20.500V17H5a1.500 1.500 0 0 1-1.500-1.500v-9A1.500 1.500 0 0 1 5 5z","="],
user:["M12 3.800a3.900 3.900 0 1 1 0 7.800 3.900 3.900 0 0 1 0-7.800zM4.600 20.200c.6-3.700 3.700-6 7.400-6s6.800 2.300 7.400 6","M12 3.800a3.900 3.900 0 1 1 0 7.800 3.900 3.900 0 0 1 0-7.800z"],
users:["M9.500 4a3.500 3.500 0 1 1 0 7 3.500 3.500 0 0 1 0-7zM3 20c.5-3.300 3.200-5.200 6.500-5.200s6 1.900 6.500 5.200M16.500 4.300a3.500 3.500 0 0 1 0 6.600M18.500 14.900c1.500.7 2.300 2.200 2.600 4.100","M9.500 4a3.500 3.500 0 1 1 0 7 3.500 3.500 0 0 1 0-7z"],
userx:["M10 4a3.700 3.700 0 1 1 0 7.400A3.700 3.700 0 0 1 10 4zM3.500 20c.5-3.600 3.200-5.500 6.500-5.500 1.200 0 2.300.2 3.200.7M16.500 15.500l4.500 4.500M21 15.500l-4.500 4.500","M10 4a3.700 3.700 0 1 1 0 7.400A3.700 3.700 0 0 1 10 4z"],
bell:["M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 1.700h-15zM10 20.500a2.100 2.100 0 0 0 4 0","M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 1.700h-15z"],
"bell-off":["M6 16.500V11c0-1 .2-1.900.7-2.700M9 5.300A6 6 0 0 1 18 11v5.500l1.500 1.700H8M10 20.500a2.100 2.100 0 0 0 4 0M4 4l16 16"],
sliders:["M4 7h9M17 7h3M4 17h3M11 17h9M15 4.500v5M9 14.500v5"],
send:["M20.500 3.500 10 14M20.500 3.500l-6.500 17-4-6.500-6.500-4z","M20.500 3.500l-6.500 17-4-6.500z"],
search:["M11 4.500a6.500 6.500 0 1 1 0 13 6.500 6.500 0 0 1 0-13zM16 16l4.500 4.500","M11 4.500a6.500 6.500 0 1 1 0 13 6.500 6.500 0 0 1 0-13z"],
menu:["M4 8h16M4 16h10"],
more:['<circle cx="5" cy="12" r="1.700" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.700" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.700" fill="currentColor" stroke="none"/>'],
clip:["M20 11.500l-7.800 7.800a5 5 0 0 1-7-7L13 4.500a3.300 3.300 0 0 1 4.700 4.700l-7.800 7.800a1.700 1.700 0 0 1-2.400-2.400L14.500 8.500"],
mic:["M12 3.500a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3zM5.500 11.500a6.500 6.500 0 0 0 13 0M12 18v3","M12 3.500a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z"],
"mic-off":["M4 4l16 16M9 6.500a3 3 0 0 1 6 0v4.800M9 9.500v2a3 3 0 0 0 4.500 2.600M5.500 11.500a6.500 6.500 0 0 0 10 5.500M18.500 11.500c0 .7-.1 1.300-.3 1.900M12 18v3"],
camera:["M4 8.500a2 2 0 0 1 2-2h1.600l1.400-2h6l1.400 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 10a3.200 3.200 0 1 0 0 6.400 3.200 3.200 0 0 0 0-6.400z","="],
"camera-off":["M4 8.500a2 2 0 0 1 2-2h1.600l1.400-2h6l1.400 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM3.500 3.500l17 17"],
video:["M4.500 6.500h8.500a2.500 2.500 0 0 1 2.500 2.500v6a2.500 2.500 0 0 1-2.500 2.500H4.500A2.500 2.500 0 0 1 2 15V9a2.500 2.500 0 0 1 2.500-2.500zM15.500 10.500l6-3v9l-6-3","M4.500 6.500h8.500a2.500 2.500 0 0 1 2.500 2.500v6a2.500 2.500 0 0 1-2.500 2.500H4.500A2.500 2.500 0 0 1 2 15V9a2.500 2.500 0 0 1 2.500-2.500z"],
phone:["M6.500 3.500h2.800l1.500 4-2 1.300a11 11 0 0 0 5.400 5.400l1.300-2 4 1.500v2.800a2 2 0 0 1-2.200 2A15.500 15.500 0 0 1 4.500 5.700a2 2 0 0 1 2-2.200z","="],
endcall:['<g transform="rotate(135 12 12)"><path d="M6.500 3.500h2.800l1.500 4-2 1.300a11 11 0 0 0 5.400 5.400l1.300-2 4 1.500v2.800a2 2 0 0 1-2.200 2A15.500 15.500 0 0 1 4.500 5.700a2 2 0 0 1 2-2.200z"/></g>'],
stop:['<rect x="6.500" y="6.500" width="11" height="11" rx="2.500" fill="currentColor" stroke="none"/>'],
busy:["M20 12a8 8 0 1 1-2.400-5.700"],
plus:["M12 5v14M5 12h14"],
x:["M6 6l12 12M18 6L6 18"],
back:["M19 12H5.500M11.500 6l-6 6 6 6"],
heart:["M12 20.200 4.700 13A4.900 4.900 0 0 1 11.600 6l.4.4.4-.4a4.900 4.900 0 0 1 6.900 7z"],
"heart-f":['<path d="M12 20.200 4.700 13A4.900 4.900 0 0 1 11.600 6l.4.4.4-.4a4.900 4.900 0 0 1 6.900 7z" fill="currentColor"/>'],
"star-f":['<path d="M12 3.800l2.400 5 5.400.7-4 3.700 1 5.400-4.800-2.700-4.800 2.700 1-5.400-4-3.700 5.400-.7z" fill="currentColor" stroke-linejoin="round"/>'],
bookmark:["M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z","="],
"bookmark-f":['<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" fill="currentColor"/>'],
flag:["M5.500 21V4M5.500 4.500h12l-2.500 4 2.500 4h-12","M5.500 4.500h12l-2.500 4 2.500 4h-12z"],
trash:["M4.500 7h15M9.500 7V4.500h5V7M6.500 7l.8 12.200a1.500 1.500 0 0 0 1.500 1.300h6.400a1.500 1.500 0 0 0 1.500-1.300L17.500 7M10 11v5.500M14 11v5.500","M6.500 7h11l-.7 12.200a1.500 1.500 0 0 1-1.500 1.300H8.700a1.500 1.500 0 0 1-1.500-1.300z"],
lock:["M7 10.500V8a5 5 0 0 1 10 0v2.500M6 10.500h12a1.500 1.500 0 0 1 1.500 1.500v6.500A1.500 1.500 0 0 1 18 20H6a1.500 1.500 0 0 1-1.500-1.500V12A1.500 1.500 0 0 1 6 10.500zM12 14.500v2","M6 10.500h12a1.500 1.500 0 0 1 1.500 1.500v6.500A1.500 1.500 0 0 1 18 20H6a1.500 1.500 0 0 1-1.500-1.500V12A1.500 1.500 0 0 1 6 10.500z"],
book:["M12 6.500C10 5 7.500 4.500 4 5v13c3.500-.5 6 0 8 1.500 2-1.500 4.500-2 8-1.500V5c-3.500-.5-6 0-8 1.500zM12 6.500v13","M12 6.500C10 5 7.500 4.500 4 5v13c3.500-.5 6 0 8 1.500z"],
clock:["M12 3.500a8.500 8.500 0 1 1 0 17 8.500 8.500 0 0 1 0-17zM12 7.500V12l3 2","M12 3.500a8.500 8.500 0 1 1 0 17 8.500 8.500 0 0 1 0-17z"],
ban:["M12 3.500a8.500 8.500 0 1 1 0 17 8.500 8.500 0 0 1 0-17zM6 6l12 12"],
logout:["M10 4H6.500A1.500 1.500 0 0 0 5 5.500v13A1.500 1.500 0 0 0 6.500 20H10M15 8l4 4-4 4M19 12H9.500"],
push:["M8 2.500h8A1.500 1.500 0 0 1 17.500 4v16a1.500 1.500 0 0 1-1.500 1.500H8A1.500 1.500 0 0 1 6.500 20V4A1.500 1.500 0 0 1 8 2.500zM10.500 18.500h3","="],
image:["M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4.500 17l4.500-4.500 3.500 3.500 2.500-2.500 4.500 4.500M9 8.500h.01","M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
moon:["M19.500 14.500A8 8 0 0 1 9.500 4.500a8 8 0 1 0 10 10z","="],
sun:["M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.300 5.300l1.400 1.400M17.300 17.300l1.400 1.400M5.300 18.700l1.400-1.400M17.300 6.700l1.400-1.400","M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"],
pin:["M9 4h6l-.8 5 2.800 3.300H7L9.800 9zM12 12.300v8.200","M9 4h6l-.8 5 2.800 3.300H7L9.800 9z"],
edit:["M4.500 19.500l1-4L16.500 4.500a2 2 0 0 1 2.800 2.800L8.300 18.300zM14.500 6.500l3 3","M4.500 19.500l1-4 3 3z"],
copy:["M9 9h9.500a1.500 1.500 0 0 1 1.500 1.500V19.500a1.500 1.500 0 0 1-1.500 1.500H9a1.500 1.500 0 0 1-1.500-1.500V10.500A1.500 1.500 0 0 1 9 9zM16 6V4.500A1.500 1.500 0 0 0 14.500 3h-9A1.500 1.500 0 0 0 4 4.500v9A1.500 1.500 0 0 0 5.500 15H7","M9 9h9.500a1.500 1.500 0 0 1 1.500 1.500V19.500a1.500 1.500 0 0 1-1.500 1.500H9a1.500 1.500 0 0 1-1.500-1.500V10.500A1.500 1.500 0 0 1 9 9z"],
reply:["M9.500 6L4 11.500 9.500 17M4.500 11.500H14a6 6 0 0 1 6 6V19"],
forward:["M14.500 6l5.500 5.500-5.500 5.500M19.500 11.500H10a6 6 0 0 0-6 6V19"],
grid:["M4 4h6.500v6.500H4zM13.500 4H20v6.500h-6.500zM4 13.500h6.500V20H4zM13.500 13.500H20V20h-6.500z"],
flame:["M12 3c.5 3 4.500 5 4.500 10a4.500 4.500 0 0 1-9 0c0-2 1-3.200 2-4 .2 1.200.8 2 1.700 2.200C11 9.500 10.500 6 12 3z","="],
file:["M6.500 3.500h7L19 9v10a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 19V5a1.500 1.500 0 0 1 1.500-1.500zM13.500 3.500V9H19","M6.500 3.500h7L19 9v10a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 19V5a1.500 1.500 0 0 1 1.500-1.500z"],
check:["M5 12.500l5 5L19.500 7"],
"check-circle":["M12 3.500a8.500 8.500 0 1 1 0 17 8.500 8.500 0 0 1 0-17zM8.200 12.200l2.800 2.800 4.800-5.500","M12 3.500a8.500 8.500 0 1 1 0 17 8.500 8.500 0 0 1 0-17z"],
dot:['<circle cx="12" cy="12" r="5" fill="#3ddc97" stroke="none"/>'],
volume:["M4 9.500h3.500l5-4v13l-5-4H4zM16 9a4.500 4.500 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11","M4 9.500h3.500l5-4v13l-5-4H4z"],
"volume-off":["M4 9.500h3.500l5-4v13l-5-4H4zM16.500 9.500l5 5M21.500 9.500l-5 5"],
"eye-off":["M3 12s3.300-6 9-6c1.500 0 2.800.4 3.900 1M21 12s-1.200 2.200-3.300 3.900M4 4l16 16M9.900 9.900a3 3 0 0 0 4.200 4.200"],
verified:['<path d="M12 2.500l2.500 1.800 3-.1 1 2.900 2.500 1.800-.9 2.900.9 2.900-2.500 1.800-1 2.900-3-.1L12 21.500l-2.500-1.800-3 .1-1-2.900L3 15l.9-2.900L3 9.200l2.500-1.800 1-2.900 3 .1z" fill="url(#vg)" stroke="none"/><path d="M8.500 12.200l2.400 2.400 4.600-5" stroke="#fff" stroke-width="2" fill="none"/>'],
palette:["M12 3.500a8.500 8.500 0 1 0 0 17c1.200 0 1.800-.8 1.800-1.700 0-1.500-1.300-1.500-1.300-2.800 0-1 .8-1.700 1.800-1.700H17a3.500 3.500 0 0 0 3.500-3.500C20.500 6.500 16.800 3.500 12 3.500zM7.500 11h.01M10 7.500h.01M14.500 7.500h.01","M12 3.500a8.500 8.500 0 1 0 0 17c1.200 0 1.800-.8 1.800-1.700 0-1.500-1.300-1.500-1.300-2.800 0-1 .8-1.700 1.800-1.700H17a3.500 3.500 0 0 0 3.500-3.500C20.500 6.500 16.800 3.500 12 3.500z"],
link:["M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"],
download:["M12 4v11M7.500 10.500L12 15l4.500-4.500M5 19.500h14"]
};
var DUO='fill="currentColor" fill-opacity=".2" stroke="none" fill-rule="evenodd"';
var sp='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="vg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b8a"/><stop offset="1" stop-color="#6f5bff"/></linearGradient></defs>';
Object.keys(I).forEach(function(k){
  var a=I[k], b="";
  if(a[0].charAt(0)==="<") b=a[0];
  else{ if(a[1]) b+='<path d="'+(a[1]==="="?a[0]:a[1])+'" '+DUO+'/>'; b+='<path d="'+a[0]+'"/>'; }
  sp+='<symbol id="n-'+k+'" viewBox="0 0 24 24">'+b+'</symbol>';
});
sp+="</svg>";
document.body.insertAdjacentHTML("afterbegin",sp);

/* ---------- 2. Replace leftover emoji in UI (buttons, toasts, labels) with the icons ---------- */
var MAP={"🗑":"trash","🔔":"bell","🔕":"bell-off","👥":"users","🔒":"lock","💚":"star-f","📖":"book","🔖":"bookmark","✅":"check-circle","🕘":"clock","🚫":"ban","🚪":"logout","📲":"push","🖼":"image","🌙":"moon","☀":"sun","📌":"pin","✏":"edit","📋":"copy","↩":"reply","➤":"forward","🎬":"reels","🎤":"mic","📷":"camera","📸":"camera","📵":"endcall","📞":"phone","🎥":"video","🔇":"volume-off","🔊":"volume","🔥":"flame","🤍":"heart","❤":"heart-f","💬":"comment","🚩":"flag","🤫":"eye-off","👤":"user","🔍":"search","📄":"file","🟢":"dot","➕":"plus","✕":"x","←":"back","⋯":"more","▦":"grid","🎨":"palette","⬇":"download"};
var RE=new RegExp("("+Object.keys(MAP).join("|")+")\uFE0F?","gu");
var OK="button,.reelEmpty,.hEmpty,#toast,#pinText,#replyText,#chatList,#callLog,#hubBody,#fRows,#sub,.callTop,.ctitle";
function mk(name){
  var s=document.createElementNS("http://www.w3.org/2000/svg","svg"); s.setAttribute("class","ic n-"+name);
  var u=document.createElementNS("http://www.w3.org/2000/svg","use"); u.setAttribute("href","#n-"+name); s.appendChild(u);
  var w=document.createElement("span"); w.className="ico"; w.appendChild(s); return w;
}
function fix(t){
  var p=t.parentNode; if(!p||!t.nodeValue||p.nodeType!==1) return;
  RE.lastIndex=0; if(!RE.test(t.nodeValue)) return;
  if(!p.closest(OK)||p.closest(".message")) return;
  var v=t.nodeValue, f=document.createDocumentFragment(), last=0, m; RE.lastIndex=0;
  while((m=RE.exec(v))){ if(m.index>last) f.appendChild(document.createTextNode(v.slice(last,m.index))); f.appendChild(mk(MAP[m[1]])); last=m.index+m[0].length; }
  if(last<v.length) f.appendChild(document.createTextNode(v.slice(last)));
  p.replaceChild(f,t);
}
function scan(n){
  if(n.nodeType===3){ fix(n); return; }
  if(n.nodeType!==1||n.closest(".message")) return;
  var w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT,null), a=[], x; while((x=w.nextNode())) a.push(x);
  a.forEach(fix);
}
new MutationObserver(function(ms){
  ms.forEach(function(m){
    if(m.type==="characterData") fix(m.target);
    else m.addedNodes.forEach(scan);
  });
}).observe(document.body,{childList:true,subtree:true,characterData:true});
scan(document.body);

/* ---------- 3. Theme colours + light/dark meta ---------- */
var THEMES={
  neon:{n:"Neon",a:"#ff5f7e",b:"#6f5bff"},
  mint:{n:"Mint",a:"#19d3a2",b:"#1e9bff"},
  amber:{n:"Amber",a:"#ffb02e",b:"#ff4f3c"},
  sky:{n:"Sky",a:"#38c9ff",b:"#6a5cff"},
  rose:{n:"Rose",a:"#ff4d8d",b:"#ff9a5c"}
};
function theme(){ var k=localStorage.getItem("jv_theme"); return THEMES[k]?k:"neon"; }
function applyTheme(k){
  var t=THEMES[k]||THEMES.neon, s=document.body.style;
  s.setProperty("--c1",t.a); s.setProperty("--c2",t.b);
  syncMeta();
}
function syncMeta(){
  var m=document.querySelector('meta[name="theme-color"]'); if(!m) return;
  m.setAttribute("content",document.body.classList.contains("dark")?"#0c0720":"#f4f1ff");
}
applyTheme(theme());
new MutationObserver(syncMeta).observe(document.body,{attributes:true,attributeFilter:["class"]});

/* ---------- 4. Small bottom sheet used by the new options ---------- */
function sheet(title,fill){
  var old=document.getElementById("nSheet"); if(old) old.remove();
  var s=document.createElement("div"); s.id="nSheet";
  var c=document.createElement("div"); c.className="nCard";
  var h=document.createElement("h3"); h.textContent=title; c.appendChild(h);
  fill(c); s.appendChild(c); document.body.appendChild(s);
  s.addEventListener("click",function(e){ if(e.target===s) s.remove(); });
  return s;
}
function toast(t){ if(window.JV&&JV.toast) JV.toast(t); }
function $(id){ return document.getElementById(id); }

function themeSheet(){
  sheet("Theme colour",function(c){
    var g=document.createElement("div"); g.className="themeGrid";
    Object.keys(THEMES).forEach(function(k){
      var b=document.createElement("button"); b.className="themeOpt"+(theme()===k?" on":"");
      var sw=document.createElement("span"); sw.className="sp"; sw.style.background="linear-gradient(135deg,"+THEMES[k].a+","+THEMES[k].b+")";
      var l=document.createElement("span"); l.textContent=THEMES[k].n; b.append(sw,l);
      b.onclick=function(){ localStorage.setItem("jv_theme",k); applyTheme(k); g.querySelectorAll(".themeOpt").forEach(function(x){ x.classList.toggle("on",x===b); }); };
      g.appendChild(b);
    });
    c.appendChild(g);
    var n=document.createElement("p"); n.className="nNote"; n.textContent="Applies to this device."; c.appendChild(n);
  });
}

function toggleRow(c,label,sub,key){
  var r=document.createElement("label"); r.className="nRow";
  var t=document.createElement("span"); t.innerHTML="<b></b><small></small>"; t.firstChild.textContent=label; t.lastChild.textContent=sub;
  var i=document.createElement("input"); i.type="checkbox"; i.className="sw"; i.checked=localStorage.getItem(key)!=="0";
  i.onchange=function(){ localStorage.setItem(key,i.checked?"1":"0"); };
  r.append(t,i); c.appendChild(r);
}
function notifSheet(){
  sheet("Notification settings",function(c){
    toggleRow(c,"Messages","New chat messages while the app is in the background","jv_np_msg");
    toggleRow(c,"Activity","Likes, comments and follow requests","jv_np_act");
    var b=document.createElement("button"); b.className="nBtn";
    var ok=("Notification" in window)&&Notification.permission==="granted";
    b.textContent=ok?"Notifications are allowed on this device":"Allow notifications on this device";
    b.disabled=ok; b.onclick=function(){ var x=$("notifBtn"); if(x) x.click(); document.getElementById("nSheet").remove(); };
    c.appendChild(b);
  });
}

async function downloadData(){
  var J=window.JV; if(!J||!J.uid()) return; var u=J.uid();
  toast("Preparing your data…");
  var out={app:"Jivlag",exportedAt:new Date().toISOString(),profile:J.user(),posts:J.posts().filter(function(p){return p.uid===u;}),reels:J.reels().filter(function(r){return r.uid===u;}),follows:J.follows().filter(function(f){return f.from===u||f.to===u;}),preferences:J.prefs()};
  try{ var r=await J.sb.from("messages").select("*").or("sender_id.eq."+u+",receiver_id.eq."+u); if(!r.error) out.messages=r.data; }catch(e){}
  var a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:"application/json"}));
  a.download="jivlag-data-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
}

async function deactivate(){
  var J=window.JV; if(!J||!J.uid()) return;
  if(!confirm("Deactivate your account?\n\nYour profile and posts will be hidden. Log in again any time to bring them back.")) return;
  window.JV_deact=true;
  var r=await J.sb.from("profiles").update({deactivated:true}).eq("id",J.uid());
  if(r.error){ window.JV_deact=false; alert("Could not deactivate. Run supabase-new-columns.sql in Supabase first."); return; }
  await J.sb.auth.signOut(); location.reload();
}

function bind(id,fn){ var b=$(id); if(b) b.addEventListener("click",fn); }
bind("themeBtn",themeSheet);
bind("notifSetBtn",notifSheet);
bind("dlDataBtn",downloadData);
bind("deactBtn",deactivate);
bind("editMenu",function(){
  $("navProf").click();
  setTimeout(function(){ if($("profForm").hidden) $("profEdit").click(); var l=$("profLinks"),u=window.JV&&JV.user(); if(l&&u) l.value=u.links||""; },80);
});
// fill the Links field whenever "Edit profile" is opened
bind("profEdit",function(){ setTimeout(function(){ var l=$("profLinks"),u=window.JV&&JV.user(); if(l&&u&&!$("profForm").hidden) l.value=u.links||""; },60); });
})();
