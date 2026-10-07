    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, deleteUser, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
      getFirestore, collection, addDoc, setDoc, updateDoc, query, orderBy, limit,
      onSnapshot, serverTimestamp, deleteDoc, doc, where, getDocs, getDoc
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    // ===== Cloudinary (photo / video / file upload) =====
    const CLOUD_NAME = "irn5vnzr";
    const UPLOAD_PRESET = "q5t0jb1h";
    const MAX_MB = 100;

    const firebaseConfig = {
      apiKey: "AIzaSyCuUiyx0uiiei3BsPx_DuvCWsewW4z3umw",
      authDomain: "ourchat-9931c.firebaseapp.com",
      projectId: "ourchat-9931c",
      storageBucket: "ourchat-9931c.firebasestorage.app",
      messagingSenderId: "234906945730",
      appId: "1:234906945730:web:c6093ff45cd2d694c9535b",
      measurementId: "G-BZHHQ4F5WQ"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const $ = id => document.getElementById(id);

    const chat=$("chat"), input=$("messageInput"), sendBtn=$("sendBtn"), deleteAllBtn=$("deleteAllBtn");
    const attachBtn=$("attachBtn"), fileInput=$("fileInput");
    const callUI=$("callUI"), remoteVideo=$("remoteVideo"), localVideo=$("localVideo"), callInfo=$("callInfo");
    const incoming=$("incoming"), incomingText=$("incomingText");

    let myName=null, myUid=null, started=false, regMode=false, regName="", profUid=null, profTab="posts", followsAll=[], curPeer=null, curChat=null, presAll={}, usersMap={}, msgUnsub=null;

    onAuthStateChanged(auth,user=>{
      $("splash").hidden=true;
      if(!user||user.isAnonymous){
        if(user) signOut(auth);
        $("loginBox").hidden=false;
        return;
      }
      $("loginBox").hidden=true;
      myUid=user.uid;
      myName=user.displayName||regName||localStorage.getItem("ourchat_name")||(user.email||"Me").split("@")[0];
      localStorage.setItem("ourchat_name",myName);
      setDoc(doc(db,"users",myUid),{uid:myUid,name:myName,email:user.email||""},{merge:true}).catch(()=>{});
      if(!started){ started=true; listenUsers(); listenCalls(); listenFollows(); listenPresence(); listenCallLog(); listenExtras(); listenReels(); listenPosts(); listenBlocks(); listenMine(); listenSocial(); }
    });

    const keyOf=v=>{ v=v.trim().toLowerCase(); return /^[\d+\s-]{7,}$/.test(v)?v.replace(/\D/g,""):v.replace(/^@/,""); };
    async function resolveEmail(v){
      if(v.includes("@")&&v.includes(".")) return v.trim();
      const d=await getDoc(doc(db,"logins",keyOf(v))); return d.exists()?d.data().email:null;
    }
    async function doLogin(){
      const idv=$("loginEmail").value.trim(), pw=$("loginPass").value, err=$("loginErr");
      if(!idv||!pw)return; err.textContent="";
      try{
        if(regMode){
          regName=$("regName").value.trim(); const un=keyOf($("regUser").value).replace(/[^a-z0-9._]/g,""), ph=keyOf($("regPhone").value);
          if(!regName||un.length<3){ err.textContent="Enter name and username (min 3)"; return; }
          if(!idv.includes("@")){ err.textContent="Enter a valid email"; return; }
          const c=await createUserWithEmailAndPassword(auth,idv,pw);
          if((await getDoc(doc(db,"logins",un))).exists()){ await deleteUser(c.user); err.textContent="Username already taken"; return; }
          await setDoc(doc(db,"logins",un),{email:idv,uid:c.user.uid});
          if(/^\d{7,}$/.test(ph)) setDoc(doc(db,"logins",ph),{email:idv,uid:c.user.uid}).catch(()=>{});
          updateProfile(c.user,{displayName:regName}).catch(()=>{});
          setDoc(doc(db,"users",c.user.uid),{username:un,phone:ph,name:regName},{merge:true});
        }else{
          const em=await resolveEmail(idv); if(!em){ err.textContent="No account found"; return; }
          await signInWithEmailAndPassword(auth,em,pw);
        }
      }catch(e){ err.textContent=(regMode?"Register failed (":"Wrong password or account (")+e.code+")"; }
    }
    $("forgotBtn").onclick=async()=>{
      const idv=$("loginEmail").value.trim(), err=$("loginErr"); if(!idv){ err.textContent="Enter email / username / mobile first"; return; }
      try{ const em=await resolveEmail(idv); if(!em){ err.textContent="No account found"; return; } await sendPasswordResetEmail(auth,em); err.textContent="✅ Reset link sent to "+em; }
      catch(e){ err.textContent="Failed ("+e.code+")"; }
    };
    $("loginBtn").onclick=doLogin;
    $("toggleReg").onclick=()=>{ regMode=!regMode; $("regName").hidden=!regMode; $("regUser").hidden=!regMode; $("regPhone").hidden=!regMode; $("forgotBtn").hidden=regMode; $("loginBtn").textContent=regMode?"Register":"Log in"; $("toggleReg").textContent=regMode?"Already registered? Log in":"New here? Register (one time only)"; $("loginErr").textContent=""; };
    $("loginPass").addEventListener("keydown",e=>{ if(e.key==="Enter")doLogin(); });
    $("logoutBtn").onclick=async()=>{ if(confirm("Log out?")){ await signOut(auth); location.reload(); } };


    /* ================= BLOCK / SAVED / HISTORY ================= */
    let myBlocks=new Set(), blockedMe=new Set(), savedMap={}, histList=[], hubMode="saved";
    const isHidden=uid=>!!uid&&(myBlocks.has(uid)||blockedMe.has(uid));
    const canChat=uid=>followsAll.some(f=>(f.from===myUid&&f.to===uid)||(f.from===uid&&f.to===myUid));

    function listenBlocks(){
      onSnapshot(query(collection(db,"blocks"),where("by","==",myUid)),s=>{ myBlocks=new Set(); s.forEach(d=>myBlocks.add(d.data().who)); afterBlock(); },()=>{});
      onSnapshot(query(collection(db,"blocks"),where("who","==",myUid)),s=>{ blockedMe=new Set(); s.forEach(d=>blockedMe.add(d.data().by)); afterBlock(); },()=>{});
    }
    function afterBlock(){
      if(curPeer&&isHidden(curPeer.uid)) $("chatBack").click();
      applyVis(); drawChats();
      if(!$("reels").hidden) drawReels();
      if(!$("prof").hidden) drawProf();
      if(!$("hub").hidden) drawHub();
    }

    function listenMine(){
      onSnapshot(query(collection(db,"users",myUid,"saved"),orderBy("at","desc"),limit(200)),s=>{
        savedMap={}; s.forEach(d=>{ savedMap[d.id]=d.data(); }); refreshSaveBtns();
      },()=>{});
      onSnapshot(query(collection(db,"users",myUid,"history"),orderBy("at","desc"),limit(100)),s=>{
        histList=[]; s.forEach(d=>histList.push({id:d.id,...d.data()})); if(!$("hub").hidden&&hubMode==="history") drawHub();
      },()=>{});
    }

    const histSeen={};
    function logHist(type,key,o){
      if(!myUid||!key) return;
      const id=type+"_"+key, now=Date.now();
      if(histSeen[id]&&now-histSeen[id]<30000) return;
      histSeen[id]=now;
      setDoc(doc(db,"users",myUid,"history",id),{type,...o,at:now}).catch(()=>{});
    }

    function saveBtn(kind,p){
      const b=actBtn(savedMap[p.id]?"✅":"🔖",()=>toggleSave(kind,p)); b.className="svBtn"; b.dataset.id=p.id; return b;
    }
    async function toggleSave(kind,p){
      const ref=doc(db,"users",myUid,"saved",p.id);
      try{
        if(savedMap[p.id]){ await deleteDoc(ref); toast("Removed from saved"); }
        else{ await setDoc(ref,{kind,url:p.url||"",mediaKind:kind==="reel"?"video":(p.kind||"image"),caption:p.caption||"",name:p.name||"",uid:p.uid||"",at:Date.now()}); toast("Saved 🔖"); }
      }catch(e){ alert("Failed: "+e.code); }
    }
    function refreshSaveBtns(){
      document.querySelectorAll(".svBtn").forEach(b=>{ b.textContent=savedMap[b.dataset.id]?"✅":"🔖"; });
      if(!$("hub").hidden&&hubMode==="saved") drawHub();
    }

    // hub overlay (Saved / History / Blocked)
    (function(){
      const st=document.createElement("style");
      st.textContent="#hub{position:fixed;inset:0;z-index:30;background:#fff;color:#111;display:flex;flex-direction:column}"+
        "body.dark #hub{background:#121212;color:#eee}"+
        "#hub[hidden]{display:none}"+
        "#hub .hTop{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(128,128,128,.25);padding-top:calc(12px + env(safe-area-inset-top,0px))}"+
        "#hub .hTop b{flex:1;font-size:17px}"+
        "#hub .hTop button,#hub .hRow button{background:none;border:0;color:inherit;font-size:15px;cursor:pointer;padding:6px 8px}"+
        "#hubBody{flex:1;overflow:auto;padding-bottom:env(safe-area-inset-bottom,0px)}"+
        "#hub .sg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}"+
        "#hub .sc{position:relative;aspect-ratio:1;background:#000;overflow:hidden}"+
        "#hub .sc video,#hub .sc img{width:100%;height:100%;object-fit:cover;display:block}"+
        "#hub .sc button{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);color:#fff;border:0;border-radius:50%;width:24px;height:24px}"+
        "#hub .hRow{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(128,128,128,.15)}"+
        "#hub .hRow .hm{flex:1;min-width:0}"+
        "#hub .hRow .hm div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
        "#hub .hRow small{opacity:.6}"+
        "#hub .hEmpty{text-align:center;padding:48px 20px;opacity:.6}";
      document.head.appendChild(st);
      const hub=document.createElement("div"); hub.id="hub"; hub.hidden=true;
      hub.innerHTML='<div class="hTop"><button id="hubBack">←</button><b id="hubTitle"></b><button id="hubClear"></button></div><div id="hubBody"></div>';
      document.body.appendChild(hub);
      $("viewer").style.zIndex="999";
    })();

    function openHub(mode){ hubMode=mode; $("menu").hidden=true; $("hub").hidden=false; drawHub(); }
    $("hubBack").onclick=()=>{ $("hub").hidden=true; };
    $("savedMenu").onclick=()=>openHub("saved");
    $("histMenu").onclick=()=>openHub("history");
    $("blockMenu").onclick=()=>openHub("blocked");
    $("hubClear").onclick=async()=>{
      if(hubMode!=="history"||!histList.length) return;
      if(!confirm("Clear all history?")) return;
      await Promise.all(histList.map(h=>deleteDoc(doc(db,"users",myUid,"history",h.id)).catch(()=>{})));
      Object.keys(histSeen).forEach(k=>delete histSeen[k]);
    };
    function playSaved(x){
      const isVid=x.mediaKind==="video";
      showViewer(isVid?mp4(x.url):x.url,(x.name?"@"+x.name+" ":"")+(x.caption||""),0,null,isVid);
    }
    function hubRow(main,sub,onClick,btnTxt,onBtn){
      const r=document.createElement("div"); r.className="hRow";
      const m=document.createElement("div"); m.className="hm";
      const a=document.createElement("div"); a.textContent=main; const b=document.createElement("small"); b.textContent=sub||"";
      m.append(a,b); if(onClick){ m.style.cursor="pointer"; m.onclick=onClick; }
      const x=document.createElement("button"); x.textContent=btnTxt; x.onclick=onBtn;
      r.append(m,x); return r;
    }
    function drawHub(){
      const body=$("hubBody"); body.innerHTML="";
      $("hubTitle").textContent=({saved:"🔖 Saved",history:"🕘 History",blocked:"🚫 Blocked accounts",requests:"👥 Follow requests",activity:"🔔 Activity",close:"💚 Close friends",limits:"🔕 Muted & restricted"})[hubMode]||"";
      $("hubClear").textContent=hubMode==="history"?"Clear all":""; $("hubClear").hidden=hubMode!=="history";
      if(drawHub2(body)) return;
      if(hubMode==="saved"){
        const items=Object.entries(savedMap).map(([id,v])=>({id,...v})).filter(x=>!isHidden(x.uid)).sort((a,b)=>b.at-a.at);
        if(!items.length){ body.innerHTML='<div class="hEmpty">Nothing saved yet<br>Tap 🔖 on a post or reel</div>'; return; }
        const g=document.createElement("div"); g.className="sg";
        items.forEach(x=>{
          const c=document.createElement("div"); c.className="sc";
          let m;
          if(x.mediaKind==="video"){ m=document.createElement("video"); m.src=mp4(x.url); m.muted=true; m.preload="metadata"; m.playsInline=true; }
          else{ m=document.createElement("img"); m.src=x.url; m.loading="lazy"; }
          c.onclick=()=>playSaved(x);
          const d=document.createElement("button"); d.textContent="✕"; d.onclick=e=>{ e.stopPropagation(); deleteDoc(doc(db,"users",myUid,"saved",x.id)).catch(()=>{}); };
          c.append(m,d); g.appendChild(c);
        });
        body.appendChild(g);
      }else if(hubMode==="history"){
        if(!histList.length){ body.innerHTML='<div class="hEmpty">No history yet</div>'; return; }
        histList.filter(h=>!isHidden(h.uid)).forEach(h=>{
          const t=new Date(h.at).toLocaleString([], {day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
          let main,go;
          if(h.type==="search"){ main="🔍 "+(h.text||""); go=()=>{ $("hub").hidden=true; showTab("chats"); $("userSearch").value=h.text||""; drawChats(); }; }
          else if(h.type==="profile"){ main="👤 "+(h.name||"Profile"); go=()=>{ if(!usersMap[h.uid]) return; $("hub").hidden=true; profUid=h.uid; showTab("prof"); }; }
          else{ main="🎬 "+(h.name?"@"+h.name+" ":"")+(h.caption||(h.kind==="reel"?"Reel":"Video")); go=()=>playSaved(h); }
          body.appendChild(hubRow(main,t,go,"✕",()=>deleteDoc(doc(db,"users",myUid,"history",h.id)).catch(()=>{})));
        });
      }else{
        const ids=[...myBlocks];
        if(!ids.length){ body.innerHTML='<div class="hEmpty">You haven\'t blocked anyone</div>'; return; }
        ids.forEach(id=>{
          const u=usersMap[id]||{};
          body.appendChild(hubRow(u.name||"Unknown",u.username?"@"+u.username:"",null,"Unblock",()=>deleteDoc(doc(db,"blocks",myUid+"_"+id)).catch(e=>alert("Failed: "+e.code))));
        });
      }
    }

    /* ================= PHASE 2: requests, close friends, mute/restrict/report, hashtags, activity ================= */
    let reqIn=[], reqOut=new Set(), prefs={closeFriends:[],muted:[],restricted:[]}, notifList=[], notifFirst=true;
    let closeRaw=[], storyBase=[], closeA=[], closeB=[], cLikes={}, cmReply=null, tagTok=0, notifTimer=null;
    let storyAud=localStorage.getItem("jv_aud")||"all";
    const isMuted=uid=>prefs.muted.includes(uid), isRestricted=uid=>prefs.restricted.includes(uid);

    (function(){
      const st=document.createElement("style");
      st.textContent="#menu{max-height:75vh;overflow-y:auto}#menuBtn{position:relative}"+
        "#menuBtn.dot::after{content:'';position:absolute;top:4px;right:4px;width:9px;height:9px;border-radius:50%;background:#ff3b5c}"+
        ".actSheet{width:100%;background:#fff;color:#111;border-radius:16px 16px 0 0;padding:8px 0 calc(12px + env(safe-area-inset-bottom,0px))}"+
        "body.dark .actSheet{background:#1e1e1e;color:#eee}"+
        ".actSheet button{display:block;width:100%;background:none;border:0;color:inherit;font-size:16px;padding:14px 18px;text-align:left;cursor:pointer}"+
        ".actSheet .at{padding:8px 18px;opacity:.6;font-size:13px}"+
        ".tagGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:8px}"+
        ".tagGrid .tc{position:relative;aspect-ratio:1;background:#000;overflow:hidden;cursor:pointer}"+
        ".tagGrid .tc img,.tagGrid .tc video{width:100%;height:100%;object-fit:cover;display:block}";
      document.head.appendChild(st);
    })();

    function actionSheet(title,items){
      const o=document.createElement("div"); o.style.cssText="position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end";
      const s=document.createElement("div"); s.className="actSheet";
      const h=document.createElement("div"); h.className="at"; h.textContent=title; s.appendChild(h);
      items.forEach(([t,fn])=>{ const b=document.createElement("button"); b.textContent=t; b.onclick=()=>{ o.remove(); fn(); }; s.appendChild(b); });
      const c=document.createElement("button"); c.textContent="Cancel"; c.style.opacity=".6"; c.onclick=()=>o.remove(); s.appendChild(c);
      o.onclick=e=>{ if(e.target===o) o.remove(); }; o.appendChild(s); document.body.appendChild(o);
    }

    function listenSocial(){
      onSnapshot(query(collection(db,"followReqs"),where("to","==",myUid)),s=>{ reqIn=[]; s.forEach(d=>reqIn.push({id:d.id,...d.data()})); updateMenuLabels(); if(!$("hub").hidden&&hubMode==="requests") drawHub(); },()=>{});
      onSnapshot(query(collection(db,"followReqs"),where("from","==",myUid)),s=>{ reqOut=new Set(); s.forEach(d=>reqOut.add(d.data().to)); if(!$("prof").hidden) drawProf(); },()=>{});
      onSnapshot(doc(db,"userPrefs",myUid),d=>{
        const x=d.exists()?d.data():{};
        prefs={closeFriends:x.closeFriends||[],muted:x.muted||[],restricted:x.restricted||[]};
        applyVis(); if(!$("reels").hidden) drawReels(); if(!$("prof").hidden) drawProf(); if(!$("hub").hidden) drawHub();
      },()=>{});
      const snapSt=s=>{ const a=[]; s.forEach(d=>{ const x=d.data(); const t=x.createdAt&&x.createdAt.toMillis?x.createdAt.toMillis():Date.now(); if(Date.now()-t<86400000) a.push({id:d.id,...x,t,close:true}); }); return a; };
      const mergeClose=()=>{ closeRaw=closeA.concat(closeB); storyRaw=storyBase.concat(closeRaw); stories=storyRaw.filter(canSee); drawStories(); };
      onSnapshot(query(collection(db,"closeStories"),where("cf","array-contains",myUid)),s=>{ closeA=snapSt(s); mergeClose(); },()=>{});
      onSnapshot(query(collection(db,"closeStories"),where("uid","==",myUid)),s=>{ closeB=snapSt(s); mergeClose(); },()=>{});
      onSnapshot(collection(db,"commentLikes"),s=>{
        cLikes={}; s.forEach(d=>{ const r=d.data(); (cLikes[r.cid]=cLikes[r.cid]||{})[r.uid]=1; });
        if(cmTarget&&!$("cmSheet").hidden) drawComments();
      },()=>{});
      onSnapshot(query(collection(db,"users",myUid,"notifs"),orderBy("at","desc"),limit(60)),s=>{
        const first=notifFirst; notifFirst=false;
        notifList=[]; s.forEach(d=>notifList.push({id:d.id,...d.data()}));
        if(!first) s.docChanges().forEach(c=>{
          if(c.type!=="added"||c.doc.metadata.hasPendingWrites) return;
          const n=c.doc.data(); if(isHidden(n.from)||isRestricted(n.from)) return;
          toast("🔔 "+notifText(n)); pushNotif(n);
        });
        updateMenuLabels(); if(!$("hub").hidden&&hubMode==="activity") drawHub();
      },()=>{});
    }

    const notifText=n=>{
      const w=n.fromName||"Someone";
      return n.type==="follow"?w+" started following you":n.type==="request"?w+" requested to follow you":n.type==="accepted"?w+" accepted your follow request"
        :n.type==="like"?w+" liked your post":n.type==="comment"?w+" commented: "+(n.text||""):n.type==="reply"?w+" replied: "+(n.text||"")
        :n.type==="clike"?w+" liked your comment":w+" sent you an update";
    };
    function pushNotif(n){
      if(!document.hidden||!("Notification" in window)||Notification.permission!=="granted"||!navigator.serviceWorker) return;
      navigator.serviceWorker.ready.then(r=>r.showNotification("Jivlag",{body:notifText(n),icon:"icon-192.png",badge:"icon-192.png",tag:"jivlag-act"})).catch(()=>{});
    }
    function notifTo(to,type,extra){
      if(!to||to===myUid||!myUid) return;
      addDoc(collection(db,"users",to,"notifs"),{from:myUid,fromName:myName,type,at:Date.now(),read:false,...extra}).catch(()=>{});
    }
    function unreadCount(){ return notifList.filter(n=>!n.read&&!isHidden(n.from)).length; }
    function updateMenuLabels(){
      const u=unreadCount(), r=reqIn.filter(x=>!isHidden(x.from)).length;
      $("actMenu").textContent="🔔 Activity"+(u?" ("+u+")":"");
      $("reqMenu").textContent="👥 Follow requests"+(r?" ("+r+")":"");
      $("menuBtn").classList.toggle("dot",u+r>0);
      $("privBtn").textContent="🔒 Private account: "+(((usersMap[myUid]||{}).private)?"On":"Off");
      $("audBtn").textContent="📖 Story for: "+(storyAud==="close"?"Close friends 💚":"Everyone");
    }
    $("menuBtn").addEventListener("click",updateMenuLabels);
    function markNotifsRead(){
      clearTimeout(notifTimer);
      notifTimer=setTimeout(()=>{ notifList.filter(n=>!n.read).forEach(n=>updateDoc(doc(db,"users",myUid,"notifs",n.id),{read:true}).catch(()=>{})); },1500);
    }

    async function savePrefs(o){ try{ await setDoc(doc(db,"userPrefs",myUid),o,{merge:true}); }catch(e){ alert("Failed: "+e.code); } }
    function togglePref(key,uid){
      const cur=prefs[key]||[];
      return savePrefs({[key]:cur.includes(uid)?cur.filter(x=>x!==uid):[...cur,uid]});
    }
    async function acceptReq(r){
      try{
        await setDoc(doc(db,"follows",r.from+"_"+myUid),{from:r.from,to:myUid});
        await deleteDoc(doc(db,"followReqs",r.id));
        notifTo(r.from,"accepted",{});
      }catch(e){ alert("Failed: "+e.code); }
    }

    function reportThing(type,targetId,targetUid){
      const r=prompt("Report reason:\n1 = Spam\n2 = Abusive / hate\n3 = Nudity\n4 = Scam / fake\n5 = Other");
      const map={"1":"spam","2":"abusive","3":"nudity","4":"scam","5":"other"};
      if(!r||!map[r.trim()]) return;
      addDoc(collection(db,"reports"),{by:myUid,type,targetId,targetUid:targetUid||"",reason:map[r.trim()],at:Date.now()})
        .then(()=>toast("Report sent. Thank you ✅")).catch(e=>alert("Report failed: "+e.code));
    }
    function rptBtn(kind,p){
      if(p.uid===myUid) return document.createTextNode("");
      const b=actBtn("🚩",()=>reportThing(kind,p.id,p.uid)); b.className="rptBtn"; return b;
    }

    // hashtags
    const TAGRE="[\\p{L}\\p{M}\\p{N}_]+";
    const tagsOf=t=>[...new Set((String(t||"").toLowerCase().match(new RegExp("#"+TAGRE,"gu"))||[]).map(x=>x.slice(1)))].slice(0,10);
    function linkTags(el,text){
      String(text||"").split(new RegExp("(#"+TAGRE+")","u")).forEach(part=>{
        if(!part) return;
        if(new RegExp("^#"+TAGRE+"$","u").test(part)){
          const a=document.createElement("span"); a.textContent=part; a.style.cssText="color:#3b82f6;cursor:pointer";
          a.onclick=e=>{ e.stopPropagation(); goTag(part); }; el.appendChild(a);
        }else el.appendChild(document.createTextNode(part));
      });
    }
    function goTag(t){
      $("reels").hidden=true; $("hub").hidden=true; closeViewer();
      showTab("chats"); $("userSearch").value=t; drawChats();
    }
    async function drawTags(tag){
      const tok=++tagTok, box=$("chatList");
      box.innerHTML='<div class="reelEmpty">Searching…</div>';
      const items=[];
      try{
        const [a,b]=await Promise.all([
          getDocs(query(collection(db,"posts"),where("tags","array-contains",tag),limit(30))),
          getDocs(query(collection(db,"reels"),where("tags","array-contains",tag),limit(30)))]);
        a.forEach(d=>items.push({id:d.id,...d.data()}));
        b.forEach(d=>items.push({id:d.id,reel:true,...d.data()}));
      }catch(e){}
      postRaw.forEach(p=>{ if((p.caption||"").toLowerCase().includes("#"+tag)) items.push(p); });
      reelList.forEach(r=>{ if((r.caption||"").toLowerCase().includes("#"+tag)) items.push({reel:true,...r}); });
      if(tok!==tagTok) return;
      const seen=new Set(), ok=x=>{
        if(seen.has(x.id)||isHidden(x.uid)) return false; seen.add(x.id);
        const u=usersMap[x.uid]||{};
        return x.uid===myUid||!u.private||followsAll.some(f=>f.from===myUid&&f.to===x.uid);
      };
      const ms=x=>x.createdAt&&x.createdAt.toMillis?x.createdAt.toMillis():0;
      const res=items.filter(ok).sort((a,b)=>ms(b)-ms(a));
      box.innerHTML="";
      const h=document.createElement("div"); h.className="reelEmpty"; h.textContent="#"+tag+" · "+res.length+" result"+(res.length===1?"":"s");
      box.appendChild(h);
      if(!res.length) return;
      const g=document.createElement("div"); g.className="tagGrid";
      res.forEach(x=>{
        const isVid=x.reel||x.kind==="video", c=document.createElement("div"); c.className="tc";
        let m; if(isVid){ m=document.createElement("video"); m.src=mp4(x.url); m.muted=true; m.preload="metadata"; m.playsInline=true; }
        else{ m=document.createElement("img"); m.src=x.url; m.loading="lazy"; }
        c.onclick=()=>playSaved({url:x.url,mediaKind:isVid?"video":"image",name:x.name||"",caption:x.caption||""});
        c.appendChild(m); g.appendChild(c);
      });
      box.appendChild(g);
    }

    // menu + hub modes
    $("reqMenu").onclick=()=>openHub("requests");
    $("actMenu").onclick=()=>{ openHub("activity"); markNotifsRead(); };
    $("cfMenu").onclick=()=>openHub("close");
    $("limMenu").onclick=()=>openHub("limits");
    $("privBtn").onclick=async()=>{
      const cur=!!(usersMap[myUid]||{}).private;
      try{ await setDoc(doc(db,"users",myUid),{private:!cur},{merge:true}); toast(!cur?"Account is now private 🔒":"Account is now public"); }
      catch(e){ alert("Failed: "+e.code); }
    };
    $("audBtn").onclick=()=>{
      storyAud=storyAud==="close"?"all":"close"; localStorage.setItem("jv_aud",storyAud); updateMenuLabels();
      toast("New stories go to "+(storyAud==="close"?"Close friends 💚":"Everyone"));
    };
    function mkRow(main,sub,onClick,btns,bold){
      const r=document.createElement("div"); r.className="hRow";
      const m=document.createElement("div"); m.className="hm";
      const a=document.createElement("div"); a.textContent=main; if(bold) a.style.fontWeight="700";
      const b=document.createElement("small"); b.textContent=sub||"";
      m.append(a,b); if(onClick){ m.style.cursor="pointer"; m.onclick=onClick; } r.appendChild(m);
      btns.forEach(([t,f])=>{ const x=document.createElement("button"); x.textContent=t; x.onclick=f; r.appendChild(x); });
      return r;
    }
    function drawHub2(body){
      const openProf=uid=>()=>{ if(!usersMap[uid]) return; $("hub").hidden=true; profUid=uid; showTab("prof"); };
      if(hubMode==="requests"){
        const arr=reqIn.filter(r=>!isHidden(r.from));
        if(!arr.length){ body.innerHTML='<div class="hEmpty">No follow requests</div>'; return true; }
        arr.forEach(r=>{ const u=usersMap[r.from]||{};
          body.appendChild(mkRow(u.name||"Unknown",u.username?"@"+u.username:"",openProf(r.from),[["Accept",()=>acceptReq(r)],["Decline",()=>deleteDoc(doc(db,"followReqs",r.id)).catch(()=>{})]])); });
        return true;
      }
      if(hubMode==="activity"){
        const arr=notifList.filter(n=>!isHidden(n.from)&&!isRestricted(n.from));
        if(!arr.length){ body.innerHTML='<div class="hEmpty">No activity yet</div>'; return true; }
        arr.forEach(n=>{
          const t=new Date(n.at).toLocaleString([], {day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
          const go=n.type==="request"?()=>openHub("requests"):n.url?()=>playSaved({url:n.url,mediaKind:n.mediaKind,name:"",caption:""}):openProf(n.from);
          body.appendChild(mkRow(notifText(n),t,go,[["✕",()=>deleteDoc(doc(db,"users",myUid,"notifs",n.id)).catch(()=>{})]],!n.read));
        });
        return true;
      }
      if(hubMode==="close"){
        const arr=Object.values(usersMap).filter(u=>u.uid&&u.uid!==myUid&&!isHidden(u.uid));
        if(!arr.length){ body.innerHTML='<div class="hEmpty">No other users yet</div>'; return true; }
        arr.forEach(u=>{ const on=prefs.closeFriends.includes(u.uid);
          body.appendChild(mkRow(u.name||"Unknown",u.username?"@"+u.username:"",null,[[on?"💚 Added":"Add",()=>togglePref("closeFriends",u.uid)]])); });
        return true;
      }
      if(hubMode==="limits"){
        const rows=[...prefs.muted.map(id=>["muted",id]),...prefs.restricted.map(id=>["restricted",id])];
        if(!rows.length){ body.innerHTML='<div class="hEmpty">No muted or restricted accounts</div>'; return true; }
        rows.forEach(([k,id])=>{ const u=usersMap[id]||{};
          body.appendChild(mkRow(u.name||"Unknown",k==="muted"?"Muted":"Restricted",null,[[k==="muted"?"Unmute":"Unrestrict",()=>togglePref(k,id)]])); });
        return true;
      }
      return false;
    }

    /* ================= MESSAGES ================= */
    function dayLabel(d){
      const today=new Date(), y=new Date(); y.setDate(today.getDate()-1);
      if(d.toDateString()===today.toDateString()) return "Today";
      if(d.toDateString()===y.toDateString()) return "Yesterday";
      return d.toLocaleDateString([], {day:"numeric",month:"short",year:"numeric"});
    }

    const tmv=d=>{ const c=d.data().createdAt; return c&&c.toMillis?c.toMillis():Date.now()+1e9; };
    function listenMessages(){
      if(msgUnsub) msgUnsub(); firstLoad=true; chat.innerHTML="";
      const q=query(collection(db,"messages"),where("chatId","==",curChat));
      msgUnsub=onSnapshot(q,snapshot=>{
        const isFirst=firstLoad; firstLoad=false;
        if(!isFirst) snapshot.docChanges().forEach(c=>{
          const d=c.doc.data();
          if(c.type==="added"&&!c.doc.metadata.hasPendingWrites&&d.uid!==myUid&&!isRestricted(d.uid)){ ding(); notify(d); if(d.heart) hearts(); }
        });
        chat.innerHTML="";
        if(snapshot.empty){ galleryItems=[]; drawPin(null); chat.innerHTML='<div id="status">No messages yet ❤️</div>'; return; }

        let lastDay=""; const dayMap={}; const media=[]; let pinNow=null;
        snapshot.docs.slice().sort((a,b)=>tmv(a)-tmv(b)).slice(-200).forEach(messageDoc=>{
          const data=messageDoc.data();
          const mine=data.uid===myUid;
          if(data.pinned) pinNow={id:messageDoc.id,data};
          const ts=data.createdAt&&data.createdAt.toDate?data.createdAt.toDate():null;

          if(ts){
            const day=ts.toDateString();
            (dayMap[day]=dayMap[day]||new Set()).add(data.uid);
            if(day!==lastDay){
              lastDay=day;
              const chip=document.createElement("div");
              chip.className="dateChip";
              const sp=document.createElement("span");
              sp.textContent=dayLabel(ts);
              chip.appendChild(sp);
              chat.appendChild(chip);
            }
          }

          const row=document.createElement("div");
          row.className="row"+(mine?" my-row":"");
          row.dataset.q=((data.text||"")+" "+(data.fileName||"")+" "+(data.name||"")).toLowerCase();
          const message=document.createElement("div");
          message.className="message"+(mine?" my-message":"");

          const name=document.createElement("div");
          name.className="name";
          name.textContent=(data.pinned?"📌 ":"")+(data.name||"Unknown");
          message.appendChild(name);

          if(data.replyTo){
            const qt=document.createElement("div");
            qt.className="quote";
            qt.textContent=data.replyTo.name+": "+data.replyTo.text;
            message.appendChild(qt);
          }

          const type=data.type||"text";
          if((type==="image"||type==="video")&&data.url) media.push({url:data.url,kind:type,name:data.name||"",t:ts?ts.getTime():0});
          if(type==="image"){
            const img=document.createElement("img");
            img.className="media"; img.src=data.url; img.loading="lazy";
            img.onclick=()=>window.open(data.url,"_blank");
            img.onload=()=>{chat.scrollTop=chat.scrollHeight;};
            message.appendChild(img);
            message.appendChild(dlLink(data.url,"⬇️ Save"));
          }else if(type==="video"){
            const v=document.createElement("video");
            v.className="media"; v.src=data.url; v.controls=true; v.preload="metadata"; v.playsInline=true;
            message.appendChild(v);
            message.appendChild(dlLink(data.url,"⬇️ Save"));
          }else if(type==="snap"){
            const sn=document.createElement("div");
            sn.className="snap"; sn.dataset.id=messageDoc.id; sn.dataset.mine=mine?"1":"";
            sn.onclick=()=>openSnap(data,messageDoc.id,mine);
            message.appendChild(sn);
          }else if(type==="audio"){
            const au=document.createElement("audio");
            au.src=data.url; au.controls=true; au.preload="metadata";
            message.appendChild(au);
          }else if(type==="file"){
            const a=document.createElement("a");
            a.href=data.url; a.target="_blank"; a.rel="noopener";
            a.textContent="📄 "+(data.fileName||"File");
            message.appendChild(a);
          }else{
            const text=document.createElement("div");
            text.textContent=data.text||"";
            message.appendChild(text);
          }

          if(ts){
            const tm=document.createElement("div");
            tm.className="time";
            tm.textContent=(data.edited?"edited · ":"")+ts.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
            if(mine){
              const tk=document.createElement("span");
              tk.className="tick"; tk.dataset.ts=ts.getTime();
              tm.appendChild(tk);
            }
            message.appendChild(tm);
          }

          const rc=document.createElement("div");
          rc.className="react"; rc.dataset.id=messageDoc.id;
          message.appendChild(rc);

          let lpT=null, lpFired=false, lpX=0, lpY=0;
          const lpStart=e=>{ lpFired=false; clearTimeout(lpT); const t=e.touches[0]; lpX=t.clientX; lpY=t.clientY; lpT=setTimeout(()=>{ lpFired=true; if(navigator.vibrate) navigator.vibrate(15); openMsgMenu(messageDoc.id,data,mine); },400); };
          const lpEnd=()=>clearTimeout(lpT);
          const lpMove=e=>{ const t=e.touches[0]; if(Math.abs(t.clientX-lpX)>12||Math.abs(t.clientY-lpY)>12) clearTimeout(lpT); };
          message.addEventListener("touchstart",lpStart,{passive:true});
          message.addEventListener("touchmove",lpMove,{passive:true});
          ["touchend","touchcancel"].forEach(ev=>message.addEventListener(ev,lpEnd,{passive:true}));
          message.addEventListener("contextmenu",e=>{ e.preventDefault(); lpFired=true; openMsgMenu(messageDoc.id,data,mine); });
          message.onclick=e=>{
            if(lpFired){ lpFired=false; return; }
            if(["A","IMG","VIDEO","AUDIO"].includes(e.target.tagName)||e.target.closest(".snap")) return;
            const now=Date.now();
            if(lastTap.id===messageDoc.id&&now-lastTap.t<350){
              clearTimeout(lastTap.timer); lastTap.id=null; toggleHeart(messageDoc.id); return;
            }
            lastTap={id:messageDoc.id,t:now,timer:setTimeout(()=>setReply(data),350)};
          };
          row.appendChild(message);

          chat.appendChild(row);
        });
        chat.scrollTop=chat.scrollHeight;
        galleryItems=media; drawPin(pinNow); if(!$("gallery").hidden) drawGallery();
        updateTicks(); updateSnaps(); updateReacts(); updateStreak(dayMap); applySearch();
        if(!document.hidden) setPresence({lastRead:Date.now()});
      },error=>{ chat.innerHTML='<div id="status">Error: '+error.code+'</div>'; });
    }

    async function sendMessage(){
      const text=input.value.trim();
      if(!text||!myUid)return;
      input.value="";
      try{
        await addMsg({type:"text",text});
      }catch(e){ alert(e.code==="blocked"||e.code==="permission-denied"?"You can't send messages to this account.":"Send failed: "+e.code); input.value=text; }
    }
    sendBtn.onclick=sendMessage;
    input.addEventListener("keydown",e=>{ if(e.key==="Enter")sendMessage(); });

    /* ================= PHOTO / VIDEO / FILE ================= */
    attachBtn.onclick=()=>{
      if(!CLOUD_NAME||!UPLOAD_PRESET){ alert("Add your Cloudinary cloud name and upload preset in script.js first."); return; }
      fileInput.click();
    };

    fileInput.onchange=async()=>{
      const file=fileInput.files[0];
      fileInput.value="";
      if(!file||!myUid)return;
      if(file.size>MAX_MB*1024*1024){ alert("File is larger than "+MAX_MB+" MB."); return; }

      setIcon(attachBtn,"busy"); attachBtn.disabled=true;
      try{
        const fd=new FormData();
        fd.append("file",file);
        fd.append("upload_preset",UPLOAD_PRESET);
        const res=await fetch("https://api.cloudinary.com/v1_1/"+CLOUD_NAME+"/auto/upload",{method:"POST",body:fd});
        const json=await res.json();
        if(!res.ok||!json.secure_url) throw new Error((json.error&&json.error.message)||"Upload failed");

        const type=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":"file";
        await addMsg({type,url:json.secure_url,fileName:file.name,text:""});
      }catch(e){
        alert("Upload failed: "+(e.message||e));
      }finally{
        setIcon(attachBtn,"clip"); attachBtn.disabled=false;
      }
    };

    /* ================= VOICE / VIDEO CALL (WebRTC) ================= */
    const rtcCfg={iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}]};
    let pc=null, localStream=null, callRef=null, unsubs=[], pending=[], ringTimer=null, answered=false, incomingCall=null;

    async function setupMedia(video){
      localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:"user"}:false});
      localVideo.srcObject=localStream;
      localVideo.style.display=video?"block":"none"; callUI.classList.toggle("vid",!!video); $("camToggle").style.display=video?"":"none";
      $("muteBtn").textContent="🎤";
    }

    function createPC(){
      pc=new RTCPeerConnection(rtcCfg);
      localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
      const remote=new MediaStream();
      remoteVideo.srcObject=remote;
      pc.ontrack=e=>e.streams[0].getTracks().forEach(t=>remote.addTrack(t));
      pc.onconnectionstatechange=()=>{
        if(!pc)return;
        if(pc.connectionState==="connected") startTimer();
        if(pc.connectionState==="failed") endCall(true);
      };
    }

    function addCand(c){
      if(pc&&pc.remoteDescription) pc.addIceCandidate(c).catch(()=>{});
      else pending.push(c);
    }
    function flushCands(){ pending.forEach(c=>pc.addIceCandidate(c).catch(()=>{})); pending=[]; }

    function showCallUI(text,name){ callInfo.textContent=text; $("callName").textContent=name||""; $("callAv").textContent=(name||"?").charAt(0).toUpperCase(); callUI.hidden=false; }
    let callT=null, ringI=null;
    function startTimer(){ if(callT) return; const t0=Date.now(); callT=setInterval(()=>{ const n=Math.floor((Date.now()-t0)/1000); callInfo.textContent=String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0"); },1000); }
    function startRing(){
      stopRing();
      const beep=()=>{ if(navigator.vibrate) navigator.vibrate([400,200,400]); if(!actx) return; [0,.45].forEach(o=>{ const x=actx.createOscillator(), g=actx.createGain(); x.frequency.value=o?520:440; g.gain.value=.12; x.connect(g); g.connect(actx.destination); x.start(actx.currentTime+o); x.stop(actx.currentTime+o+.35); }); };
      beep(); ringI=setInterval(beep,2500);
    }
    function stopRing(){ clearInterval(ringI); ringI=null; if(navigator.vibrate) navigator.vibrate(0); }

    async function startCall(video){
      if(pc||!myUid||!curPeer){ toast("Open a chat to call"); return; }
      try{ await setupMedia(video); }
      catch(e){ alert("Mic/Camera permission denied: "+e.name); return; }

      showCallUI("Calling...",curPeer.name);
      createPC();
      callRef=doc(collection(db,"calls"));
      const callerCands=collection(callRef,"callerCandidates");
      const calleeCands=collection(callRef,"calleeCandidates");
      pc.onicecandidate=e=>{ if(e.candidate) addDoc(callerCands,e.candidate.toJSON()); };

      try{
        const offer=await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setDoc(callRef,{
          from:myUid,to:curPeer.uid,name:myName,video,status:"ringing",createdAt:Date.now(),
          offer:{type:offer.type,sdp:offer.sdp}
        });
      }catch(e){ alert("Call failed: "+(e.code||e.message)); endCall(false); return; }

      unsubs.push(onSnapshot(callRef,async s=>{
        const d=s.data();
        if(!d||!pc)return;
        if(d.answer&&!answered){
          answered=true;
          clearTimeout(ringTimer);
          callInfo.textContent="Connecting...";
          await pc.setRemoteDescription(d.answer);
          flushCands();
        }
        if(d.status==="ended"||d.status==="declined") endCall(false);
      }));
      unsubs.push(onSnapshot(calleeCands,s=>s.docChanges().forEach(c=>{ if(c.type==="added") addCand(c.doc.data()); })));
      ringTimer=setTimeout(()=>{ if(pc&&!answered) endCall(true); },45000);
    }

    async function acceptCall(){
      if(!incomingCall)return;
      const {ref,data}=incomingCall;
      incomingCall=null; incoming.hidden=true; stopRing();
      try{ await setupMedia(data.video); }
      catch(e){ alert("Mic/Camera permission denied: "+e.name); updateDoc(ref,{status:"declined"}); return; }

      callRef=ref;
      showCallUI("Connecting...",data.name);
      createPC();
      const callerCands=collection(ref,"callerCandidates");
      const calleeCands=collection(ref,"calleeCandidates");
      pc.onicecandidate=e=>{ if(e.candidate) addDoc(calleeCands,e.candidate.toJSON()); };

      try{
        await pc.setRemoteDescription(data.offer);
        const ans=await pc.createAnswer();
        await pc.setLocalDescription(ans);
        await updateDoc(ref,{answer:{type:ans.type,sdp:ans.sdp},status:"active"});
      }catch(e){ alert("Call failed: "+(e.code||e.message)); endCall(true); return; }

      unsubs.push(onSnapshot(callerCands,s=>s.docChanges().forEach(c=>{ if(c.type==="added") addCand(c.doc.data()); })));
      unsubs.push(onSnapshot(ref,s=>{ const d=s.data(); if(d&&d.status==="ended") endCall(false); }));
    }

    function declineCall(){
      if(!incomingCall)return;
      updateDoc(incomingCall.ref,{status:"declined"}).catch(()=>{});
      incomingCall=null; incoming.hidden=true; stopRing();
    }

    function endCall(notify){
      clearTimeout(ringTimer);
      if(notify&&callRef) updateDoc(callRef,{status:"ended"}).catch(()=>{});
      unsubs.forEach(u=>u()); unsubs=[]; pending=[];
      if(localStream) localStream.getTracks().forEach(t=>t.stop());
      if(pc){ pc.onicecandidate=null; pc.onconnectionstatechange=null; pc.close(); }
      pc=null; localStream=null; callRef=null; answered=false;
      remoteVideo.srcObject=null; localVideo.srcObject=null;
      callUI.hidden=true; clearInterval(callT); callT=null;
    }

    function listenCalls(){
      const q=query(collection(db,"calls"),where("status","==","ringing"));
      onSnapshot(q,snap=>{
        snap.docChanges().forEach(c=>{
          const d=c.doc.data();
          if(c.type==="added"&&d.to===myUid&&!pc&&!incomingCall&&Date.now()-d.createdAt<90000){
            incomingCall={ref:c.doc.ref,data:d,id:c.doc.id};
            incomingText.textContent=(d.video?"🎥 Video call":"📞 Voice call")+" — "+(d.name||"");
            incoming.hidden=false; startRing();
          }
          if(c.type==="removed"&&incomingCall&&incomingCall.id===c.doc.id){
            incomingCall=null; incoming.hidden=true; stopRing();
          }
        });
      },()=>{});
    }

    $("voiceBtn").onclick=()=>startCall(false);
    $("videoBtn").onclick=()=>startCall(true);
    $("endBtn").onclick=()=>endCall(true);
    $("acceptBtn").onclick=acceptCall;
    $("declineBtn").onclick=declineCall;
    $("camToggle").onclick=()=>{ const t=localStream&&localStream.getVideoTracks()[0]; if(!t) return; t.enabled=!t.enabled; $("camToggle").textContent=t.enabled?"📷":"🚫"; };
    $("muteBtn").onclick=()=>{
      if(!localStream)return;
      const t=localStream.getAudioTracks()[0];
      if(!t)return;
      t.enabled=!t.enabled;
      $("muteBtn").textContent=t.enabled?"🎤":"🔇";
    };

    /* ================= EXTRAS ================= */
    let galleryItems=[], firstLoad=true, other=null, replyTo=null, typingOn=false, tt=null, actx=null, rec=null, chunks=[];

    function addMsg(o){
      if(!curChat) return Promise.reject({code:"open a chat first"});
      if(curPeer&&isHidden(curPeer.uid)) return Promise.reject({code:"blocked"});
      const m={...o,chatId:curChat,name:myName,uid:myUid,createdAt:serverTimestamp()};
      if(replyTo){ m.replyTo=replyTo; clearReply(); }
      return addDoc(collection(db,"messages"),m);
    }

    // reply
    function setReply(d){
      const t=d.type||"text";
      const prev=t==="image"?"📷 Photo":t==="video"?"🎥 Video":t==="audio"?"🎤 Voice":t==="file"?(d.fileName||"File"):(d.text||"");
      replyTo={name:d.name||"",text:prev.slice(0,80)};
      $("replyText").textContent="↩ "+replyTo.name+": "+replyTo.text;
      $("replyBar").hidden=false; input.focus();
    }
    function clearReply(){ replyTo=null; $("replyBar").hidden=true; }
    $("replyX").onclick=clearReply;

    // presence: online / typing / seen
    function setPresence(extra){
      if(!myUid)return;
      setDoc(doc(db,"presence",myUid),{name:myName,lastActive:Date.now(),...extra},{merge:true}).catch(()=>{});
    }
    function updateSub(){
      const sub=$("sub");
      if(!other){ sub.textContent=""; return; }
      const age=Date.now()-(other.lastActive||0);
      let st="";
      if(other.typing&&age<10000) st="typing...";
      else if(age<75000) st="🟢 online";
      else if(other.lastActive) st="last seen "+new Date(other.lastActive).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
      sub.textContent=(other.name?other.name+" · ":"")+st;
    }
    function updateTicks(){
      const lr=(other&&other.lastRead)||0;
      document.querySelectorAll(".tick").forEach(t=>{ const sn=(+t.dataset.ts<=lr); t.textContent=sn?" ✓✓":" ✓"; t.classList.toggle("seen",sn); });
    }
    function listenPresence(){
      onSnapshot(collection(db,"presence"),snap=>{
        snap.forEach(d=>{ presAll[d.id]=d.data(); });
        other=curPeer?presAll[curPeer.uid]||null:null;
        updateSub(); updateTicks(); drawChats();
      },()=>{});
      setPresence({lastRead:Date.now(),typing:false});
      setInterval(()=>{ if(!document.hidden) setPresence({}); updateSub(); },30000);
      document.addEventListener("visibilitychange",()=>{ if(!document.hidden) setPresence({lastRead:Date.now()}); });
    }
    input.addEventListener("input",()=>{
      if(!typingOn){ typingOn=true; setPresence({typing:true}); }
      clearTimeout(tt);
      tt=setTimeout(()=>{ typingOn=false; setPresence({typing:false}); },2000);
    });

    // sound + vibration
    document.addEventListener("pointerdown",()=>{
      if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    },{once:true});
    function ding(){
      if(navigator.vibrate) navigator.vibrate(200);
      if(!actx) return;
      const o=actx.createOscillator(), g=actx.createGain();
      o.frequency.value=880; g.gain.value=.1;
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime+.15);
    }

    // miss you hearts
    function hearts(){
      for(let i=0;i<14;i++){
        const h=document.createElement("div");
        h.className="fh"; h.textContent="❤️";
        h.style.left=Math.random()*90+"vw";
        h.style.animationDelay=Math.random()*.8+"s";
        document.body.appendChild(h);
        setTimeout(()=>h.remove(),3800);
      }
    }
    $("heartBtn").onclick=()=>{
      if(!myUid)return;
      addMsg({type:"text",text:"❤️ Miss you!",heart:true}).catch(e=>alert("Send failed: "+e.code));
      hearts();
    };

    // dark mode
    function applyDark(on){ document.body.classList.toggle("dark",on); $("darkBtn").textContent=on?"☀️ Light mode":"🌙 Dark mode"; }
    applyDark(localStorage.getItem("ourchat_dark")==="1");
    $("darkBtn").onclick=()=>{
      const on=!document.body.classList.contains("dark");
      localStorage.setItem("ourchat_dark",on?"1":"0");
      applyDark(on);
    };

    // voice message
    const micBtn=$("micBtn");
    micBtn.onclick=async()=>{
      if(rec){ rec.stop(); return; }
      if(!myUid)return;
      let st;
      try{ st=await navigator.mediaDevices.getUserMedia({audio:true}); }
      catch(e){ alert("Microphone permission denied"); return; }
      rec=new MediaRecorder(st); chunks=[];
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=async()=>{
        st.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunks,{type:rec.mimeType||"audio/webm"});
        rec=null; micBtn.style.background="";
        if(blob.size<1500){ setIcon(micBtn,"mic"); return; }
        setIcon(micBtn,"busy");
        try{
          const fd=new FormData();
          fd.append("file",blob,"voice.webm");
          fd.append("upload_preset",UPLOAD_PRESET);
          const r=await fetch("https://api.cloudinary.com/v1_1/"+CLOUD_NAME+"/auto/upload",{method:"POST",body:fd});
          const j=await r.json();
          if(!r.ok||!j.secure_url) throw new Error((j.error&&j.error.message)||"Upload failed");
          await addMsg({type:"audio",url:j.secure_url,text:""});
        }catch(e){ alert("Voice failed: "+(e.message||e)); }
        setIcon(micBtn,"mic");
      };
      rec.start(); setIcon(micBtn,"stop"); 
    };

    /* ================= SNAP / STORY / STREAK / REACTION ================= */
    let opened=new Set(), reacts={}, stories=[], vTimer=null, lastTap={id:null,t:0,timer:null};

    async function cloudUpload(file){
      const fd=new FormData();
      fd.append("file",file); fd.append("upload_preset",UPLOAD_PRESET);
      const r=await fetch("https://api.cloudinary.com/v1_1/"+CLOUD_NAME+"/auto/upload",{method:"POST",body:fd});
      const j=await r.json();
      if(!r.ok||!j.secure_url) throw new Error((j.error&&j.error.message)||"Upload failed");
      return j.secure_url;
    }

    function listenExtras(){
      onSnapshot(collection(db,"snapViews"),s=>{ opened=new Set(); s.forEach(d=>opened.add(d.id)); updateSnaps(); },()=>{});
      onSnapshot(collection(db,"reactions"),s=>{
        reacts={};
        s.forEach(d=>{ const r=d.data(); (reacts[r.msgId]=reacts[r.msgId]||{})[r.uid]=r.emoji; });
        updateReacts();
      },()=>{});
      onSnapshot(query(collection(db,"stories"),orderBy("createdAt","desc"),limit(80)),s=>{
        storyRaw=[];
        s.forEach(d=>{
          const x=d.data();
          const t=x.createdAt&&x.createdAt.toMillis?x.createdAt.toMillis():Date.now();
          if(Date.now()-t<86400000) storyRaw.push({id:d.id,...x,t});
        });
        storyBase=storyRaw.slice(); storyRaw=storyBase.concat(closeRaw);
        stories=storyRaw.filter(canSee);
        drawStories();
      },()=>{});
    }

    // viewer (snap + story)
    function showViewer(url,cap,secs,onDel,isVid){
      const vv=$("viewVid"); vv.onended=null; vv.pause(); vv.removeAttribute("src");
      if(isVid){ $("viewImg").hidden=true; $("viewImg").src=""; vv.hidden=false; vv.src=url; vv.play().catch(()=>{}); }
      else{ vv.hidden=true; $("viewImg").hidden=false; $("viewImg").src=url; }
      $("viewDel").hidden=!onDel;
      $("viewDel").onclick=onDel?async()=>{ closeViewer(); try{ await onDel(); }catch(e){} }:null;
      $("viewer").hidden=false;
      clearInterval(vTimer);
      $("viewTop").textContent=secs?cap+" · "+secs+"s":cap;
      if(secs){
        let n=secs;
        vTimer=setInterval(()=>{
          n--;
          if(n<=0) closeViewer(); else $("viewTop").textContent=cap+" · "+n+"s";
        },1000);
      }
    }
    function closeViewer(){ clearInterval(vTimer); clearTimeout(vTimer); const vv=$("viewVid"); vv.onended=null; vv.pause(); vv.removeAttribute("src"); vv.hidden=true; $("viewImg").hidden=false; $("viewer").hidden=true; $("viewImg").src=""; if(playStory.o) $("viewer").onclick=playStory.o; }
    $("viewer").onclick=e=>{ if(e.target.id!=="viewDel") closeViewer(); };

    // view-once snap
    function openSnap(d,id,mine){
      if(mine||opened.has(id)) return;
      opened.add(id); updateSnaps();
      setDoc(doc(db,"snapViews",id),{by:myUid,at:Date.now()}).catch(()=>{});
      showViewer(d.url,"📸 "+(d.name||""),5,null);
    }
    function updateSnaps(){
      document.querySelectorAll(".snap").forEach(e=>{
        const o=opened.has(e.dataset.id), mine=!!e.dataset.mine;
        e.className="snap"+(o?" done":"")+(mine?" mine":"");
        e.textContent=o?"Opened":mine?"Snap sent":"Tap to view";
      });
    }
    $("snapBtn").onclick=()=>$("snapInput").click();
    $("snapInput").onchange=async e=>{
      const f=e.target.files[0]; e.target.value="";
      if(!f||!myUid) return;
      $("snapBtn").style.opacity=.4;
      try{ await addMsg({type:"snap",url:await cloudUpload(f),text:""}); }
      catch(err){ alert("Snap failed: "+(err.message||err)); }
      $("snapBtn").style.opacity=1;
    };

    // stories
    $("addStory").onclick=()=>$("storyInput").click();
    $("storyInput").onchange=async e=>{
      const f=e.target.files[0]; e.target.value="";
      if(!f||!myUid) return;
      if(storyAud==="close"&&!prefs.closeFriends.length){ alert("Add some close friends first (menu → 💚 Close friends)"); return; }
      $("addStory").style.opacity=.4;
      try{
        const isV=f.type.startsWith("video/");
        if(!isV&&!f.type.startsWith("image/")){ alert("Please choose a photo or video"); $("addStory").style.opacity=1; return; }
        if(f.size>MAX_MB*1024*1024){ alert("File is larger than "+MAX_MB+" MB."); $("addStory").style.opacity=1; return; }
        const url=await cloudUpload(f);
        const sd={url,kind:isV?"video":"image",name:myName,uid:myUid,createdAt:serverTimestamp()};
        if(storyAud==="close") await addDoc(collection(db,"closeStories"),{...sd,cf:prefs.closeFriends.slice()});
        else await addDoc(collection(db,"stories"),sd);
      }catch(err){ alert("Story failed: "+(err.message||err)); }
      $("addStory").style.opacity=1;
    };
    let seenSt=new Set(JSON.parse(localStorage.getItem("jv_seen")||"[]"));
    function drawStories(){
      const box=$("storyList"); box.innerHTML="";
      const g={}; stories.filter(x=>!isMuted(x.uid)).sort((a,b)=>a.t-b.t).forEach(x=>(g[x.uid]=g[x.uid]||[]).push(x));
      Object.values(g).sort((a,b)=>(b[0].uid===myUid)-(a[0].uid===myUid)).forEach(arr=>{
        const f=arr[arr.length-1], all=arr.every(x=>seenSt.has(x.id));
        const it=document.createElement("div"); it.className="sItem";
        const c=document.createElement("div"); c.className="sCircle sRing"+(all?" seen":"");
        const th=f.kind==="video"?f.url.replace("/upload/","/upload/so_0,w_200,h_200,c_fill/").replace(/\.[a-z0-9]+$/i,".jpg"):f.url;
        c.style.setProperty("--img","url('"+th+"')");
        const n=document.createElement("span"); n.textContent=(arr.some(x=>x.close)?"💚 ":"")+(f.uid===myUid?"You":(f.name||""));
        it.append(c,n); it.onclick=()=>playStory(arr,0); box.appendChild(it);
      });
    }
    function playStory(arr,i){
      playStory.o=playStory.o||$("viewer").onclick;
      if(i>=arr.length){ closeViewer(); return; }
      const x=arr[i]; seenSt.add(x.id); localStorage.setItem("jv_seen",JSON.stringify([...seenSt].slice(-300)));
      const isV=x.kind==="video";
      clearTimeout(vTimer);
      showViewer(isV?mp4(x.url):x.url,"📖 "+(x.name||"")+" · "+new Date(x.t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+"  ("+(i+1)+"/"+arr.length+")",0,x.uid===myUid?()=>deleteDoc(doc(db,x.close?"closeStories":"stories",x.id)):null,isV);
      $("viewer").onclick=e=>{ if(e.target.id!=="viewDel"&&e.target.id!=="viewVid") playStory(arr,i+1); };
      if(isV){ $("viewVid").onended=()=>playStory(arr,i+1); vTimer=setTimeout(()=>playStory(arr,i+1),120000); }
      else vTimer=setTimeout(()=>playStory(arr,i+1),5000);
      drawStories();
    }

    // reactions (double tap)
    function toggleHeart(id){
      const has=reacts[id]&&reacts[id][myUid];
      const ref=doc(db,"reactions",id+"_"+myUid);
      (has?deleteDoc(ref):setDoc(ref,{msgId:id,uid:myUid,emoji:"❤️"})).catch(e=>alert("Reaction failed: "+e.code));
    }
    function updateReacts(){
      document.querySelectorAll(".react").forEach(e=>{ e.textContent=Object.values(reacts[e.dataset.id]||{}).join(""); });
    }

    // streak
    function updateStreak(m){
      const d=new Date(); let n=0;
      const ok=x=>m[x.toDateString()]&&m[x.toDateString()].size>=2;
      if(!ok(d)) d.setDate(d.getDate()-1);
      while(ok(d)){ n++; d.setDate(d.getDate()-1); }
      $("streak").textContent=n?"🔥"+n:"";
    }

    function setIcon(b,n){
      b.innerHTML='<svg class="ic"><use href="#i-'+n+'"/></svg>';
      b.classList.toggle("rec",n==="stop");
      b.classList.toggle("busy",n==="busy");
    }

    $("camBtn").onclick=()=>$("snapInput").click();

    /* ================= MENU ================= */
    document.addEventListener("click",e=>{
      const t=e.target;
      if(t.closest("#menuBtn")){ $("menu").hidden=!$("menu").hidden; return; }
      if(t.closest("#topChats")){ $("menu").hidden=true; showTab("chats"); return; }
      $("menu").hidden=true;
    });

    /* ================= REELS ================= */
    let reelList=[], reelLikes={}, reelObs=null, reelsMuted=false;

    function listenReels(){
      onSnapshot(query(collection(db,"reels"),orderBy("createdAt","desc"),limit(30)),s=>{
        reelList=[]; s.forEach(d=>reelList.push({id:d.id,...d.data()}));
        if(!$("reels").hidden) drawReels();
      },()=>{});
      onSnapshot(collection(db,"reelLikes"),s=>{
        reelLikes={};
        s.forEach(d=>{ const r=d.data(); (reelLikes[r.reelId]=reelLikes[r.reelId]||{})[r.uid]=1; });
        updateReelLikes();
      },()=>{});
    }

    function drawReels(){
      const feed=$("reelFeed"); feed.innerHTML="";
      if(!reelList.length){
        feed.innerHTML='<div class="reelEmpty">No reels yet<br>Tap ➕ above to add the first video</div>';
        return;
      }
      reelList.filter(r=>!isHidden(r.uid)&&!isMuted(r.uid)).forEach(r=>{
        const sec=document.createElement("section"); sec.className="reel"; sec.dataset.id=r.id;
        const v=document.createElement("video");
        v.src=(r.url||"").replace(/\.[a-z0-9]+$/i,".mp4");
        v.loop=true; v.muted=reelsMuted; v.playsInline=true; v.preload="metadata";
        v.onclick=()=>{ v.paused?v.play().catch(()=>{}):v.pause(); };
        v.ondblclick=()=>toggleReelLike(r.id);

        const info=document.createElement("div"); info.className="reelInfo";
        const nm=document.createElement("b"); nm.textContent="@"+(r.name||"");
        const cp=document.createElement("div"); linkTags(cp,r.caption);
        info.append(nm,cp);

        const side=document.createElement("div"); side.className="reelSide";
        const like=document.createElement("button"); like.className="rLike"; like.dataset.id=r.id;
        like.onclick=()=>toggleReelLike(r.id);
        const snd=document.createElement("button"); snd.className="rSnd";
        snd.textContent=reelsMuted?"🔇":"🔊"; snd.onclick=toggleReelSound;
        side.append(like,cmButton(r.id),actBtn("➤",()=>shareToChat({type:"video",url:mp4(r.url),text:r.caption||""})),dlLink(r.url),saveBtn("reel",r),rptBtn("reel",r),snd);
        if(r.uid===myUid){
          const del=document.createElement("button"); del.textContent="🗑️";
          del.onclick=()=>{ if(confirm("Delete this reel?")) deleteDoc(doc(db,"reels",r.id)).catch(e=>alert("Delete failed: "+e.code)); };
          side.appendChild(del);
        }
        sec.append(v,info,side); feed.appendChild(sec);
      });
      updateReelLikes(); observeReels();
    }

    function observeReels(){
      if(reelObs) reelObs.disconnect();
      reelObs=new IntersectionObserver(es=>es.forEach(e=>{
        const v=e.target.querySelector("video");
        if(e.isIntersecting&&e.intersectionRatio>.6){
          const rr=reelList.find(x=>x.id===e.target.dataset.id); if(rr) logHist("watch",rr.id,{kind:"reel",mediaKind:"video",url:rr.url,name:rr.name||"",caption:rr.caption||"",uid:rr.uid||""});
          v.play().catch(()=>{
            reelsMuted=true;
            document.querySelectorAll(".reel video").forEach(x=>{ x.muted=true; });
            document.querySelectorAll(".rSnd").forEach(b=>{ b.textContent="🔇"; });
            v.play().catch(()=>{});
          });
        }else v.pause();
      }),{root:$("reelFeed"),threshold:[0,.6,1]});
      document.querySelectorAll(".reel").forEach(r=>reelObs.observe(r));
    }

    function toggleReelSound(){
      reelsMuted=!reelsMuted;
      document.querySelectorAll(".reel video").forEach(v=>{ v.muted=reelsMuted; });
      document.querySelectorAll(".rSnd").forEach(b=>{ b.textContent=reelsMuted?"🔇":"🔊"; });
    }

    function toggleReelLike(id){
      const has=reelLikes[id]&&reelLikes[id][myUid];
      const ref=doc(db,"reelLikes",id+"_"+myUid);
      (has?deleteDoc(ref):setDoc(ref,{reelId:id,uid:myUid})).catch(e=>alert("Like failed: "+e.code));
      const it=postRaw.find(p=>p.id===id)||reelList.find(r=>r.id===id);
      if(it&&it.uid&&it.uid!==myUid){
        const nid="like_"+id+"_"+myUid, nref=doc(db,"users",it.uid,"notifs",nid);
        if(has) deleteDoc(nref).catch(()=>{});
        else setDoc(nref,{from:myUid,fromName:myName,type:"like",at:Date.now(),read:false,url:it.url||"",mediaKind:it.kind||"video",targetId:id}).catch(()=>{});
      }
    }
    function updateReelLikes(){
      document.querySelectorAll(".rLike").forEach(b=>{
        const m=reelLikes[b.dataset.id]||{};
        b.textContent=(m[myUid]?"❤️":"🤍")+" "+Object.keys(m).length;
      });
    }

    $("reelsBtn").onclick=()=>{ $("reels").hidden=false; drawReels(); };
    $("reelBack").onclick=()=>{ document.querySelectorAll(".reel video").forEach(v=>v.pause()); $("reels").hidden=true; };
    $("reelAdd").onclick=()=>$("reelInput").click();
    $("reelInput").onchange=async e=>{
      const f=e.target.files[0]; e.target.value="";
      if(!f||!myUid) return;
      if(!f.type.startsWith("video/")){ alert("Please choose a video"); return; }
      if(f.size>MAX_MB*1024*1024){ alert("Video is larger than "+MAX_MB+" MB."); return; }
      const cap=prompt("Caption (leave empty for none)")||"";
      $("reelAdd").style.opacity=.4;
      try{
        const url=await cloudUpload(f);
        await addDoc(collection(db,"reels"),{url,caption:cap.slice(0,150),tags:tagsOf(cap.slice(0,150)),name:myName,uid:myUid,createdAt:serverTimestamp()});
      }catch(err){ alert("Reel failed: "+(err.message||err)); }
      $("reelAdd").style.opacity=1;
    };

    /* ================= POSTS / COMMENTS / SHARE / DOWNLOAD ================= */
    let postList=[], postRaw=[], storyRaw=[], comments={}, cmTarget=null;
    // visibility: author's posts/stories are seen only by the author and by people who follow the author
    const canSee=x=>!isHidden(x.uid)&&(x.close||x.uid===myUid||followsAll.some(f=>f.from===myUid&&f.to===x.uid));
    function applyVis(){
      postList=postRaw.filter(canSee); stories=storyRaw.filter(canSee);
      drawPosts(); drawStories();
    }
    const dlUrl=u=>(u||"").replace("/upload/","/upload/fl_attachment/");
    const mp4=u=>(u||"").replace(/\.[a-z0-9]+$/i,".mp4");

    function toast(t){
      const el=$("toast"); el.textContent=t; el.hidden=false;
      clearTimeout(toast.t); toast.t=setTimeout(()=>{ el.hidden=true; },2200);
    }
    function shareToChat(msg){
      if(!curChat){ toast("Open a chat first, then share"); return; }
      addMsg(msg).then(()=>toast("Sent to chat ✅")).catch(e=>alert("Share failed: "+e.code));
    }
    function actBtn(txt,fn){ const b=document.createElement("button"); b.textContent=txt; b.onclick=fn; return b; }
    function cmButton(id){
      const b=actBtn("💬 "+(comments[id]||[]).length,()=>openComments(id));
      b.className="cmBtn"; b.dataset.id=id; return b;
    }
    function dlLink(url,label){
      const a=document.createElement("a");
      a.className="dlBtn"; a.href=dlUrl(url); a.target="_blank"; a.rel="noopener";
      a.textContent=label||"⬇️"; return a;
    }

    function listenPosts(){
      onSnapshot(query(collection(db,"posts"),orderBy("createdAt","desc"),limit(30)),s=>{
        postRaw=[]; s.forEach(d=>postRaw.push({id:d.id,...d.data()}));
        postList=postRaw.filter(canSee);
        drawPosts();
      },()=>{});
      onSnapshot(query(collection(db,"comments"),orderBy("createdAt"),limit(300)),s=>{
        comments={};
        s.forEach(d=>{ const c={id:d.id,...d.data()}; if(isHidden(c.uid)) return; (comments[c.targetId]=comments[c.targetId]||[]).push(c); });
        updateCmCounts(); if(cmTarget) drawComments();
      },()=>{});
    }

    function drawPosts(){
      const feed=$("postFeed"); feed.innerHTML=""; if(!$("prof").hidden) drawProf();
      if(!postList.length){
        feed.innerHTML='<div class="reelEmpty">No posts yet<br>Tap ➕ Post below to add the first photo</div>';
        return;
      }
      postList.filter(p=>!isMuted(p.uid)).forEach(p=>{
        const c=document.createElement("article"); c.className="post";
        const h=document.createElement("div"); h.className="pHead";
        const av=document.createElement("span"); av.className="pAv"; av.textContent=(p.name||"?").charAt(0).toUpperCase();
        const nm=document.createElement("b"); nm.textContent=p.name||"";
        h.append(av,nm);

        let m;
        if(p.kind==="video"){
          m=document.createElement("video"); m.src=mp4(p.url); m.controls=true; m.playsInline=true; m.preload="metadata"; m.onplay=()=>logHist("watch",p.id,{kind:"post",mediaKind:"video",url:p.url,name:p.name||"",caption:p.caption||"",uid:p.uid||""});
        }else{
          m=document.createElement("img"); m.src=p.url; m.loading="lazy"; m.ondblclick=()=>toggleReelLike(p.id);
        }
        m.className="pMedia";

        const act=document.createElement("div"); act.className="pAct";
        const like=actBtn("",()=>toggleReelLike(p.id)); like.className="rLike"; like.dataset.id=p.id;
        act.append(like,cmButton(p.id),
          actBtn("➤",()=>shareToChat(p.kind==="video"?{type:"video",url:mp4(p.url),text:""}:{type:"image",url:p.url,text:""})),
          dlLink(p.url),saveBtn("post",p),rptBtn("post",p));
        if(p.uid===myUid){
          const del=actBtn("🗑️",()=>{ if(confirm("Delete this?")) deleteDoc(doc(db,profTab==="reels"?"reels":"posts",p.id)).catch(e=>alert("Delete failed: "+e.code)); });
          del.style.marginLeft="auto"; act.appendChild(del);
        }
        c.append(h,m,act);
        if(p.caption){
          const cp=document.createElement("div"); cp.className="pCap";
          const b=document.createElement("b"); b.textContent=(p.name||"")+" ";
          cp.append(b); linkTags(cp,p.caption); c.appendChild(cp);
        }
        feed.appendChild(c);
      });
      updateReelLikes(); updateCmCounts();
    }

    // comments
    function openComments(id){ cmTarget=id; cmReply=null; $("cmInput").placeholder="Write a comment…"; $("cmSheet").hidden=false; drawComments(); }
    function drawComments(){
      const box=$("cmList"); box.innerHTML="";
      const vis=c=>!isHidden(c.uid)&&(c.uid===myUid||!isRestricted(c.uid));
      const all=(comments[cmTarget]||[]).filter(vis);
      const tops=all.filter(c=>!c.parentId);
      if(!tops.length){ box.innerHTML='<div class="cmEmpty">No comments yet</div>'; return; }
            const mk=(c,isReply)=>{
        const row=document.createElement("div"); row.className="cm"; if(isReply) row.style.marginLeft="28px";
        const b=document.createElement("b"); b.textContent=c.name||"";
        const t=document.createElement("span"); t.textContent=c.text||"";
        row.append(b,t);
        const n=Object.keys(cLikes[c.id]||{}).length, liked=!!(cLikes[c.id]&&cLikes[c.id][myUid]);
        row.appendChild(actBtn((liked?"❤️":"🤍")+(n?" "+n:""),()=>toggleCLike(c)));
        if(!isReply) row.appendChild(actBtn("↩",()=>{
          cmReply=(cmReply&&cmReply.id===c.id)?null:{id:c.id,uid:c.uid,name:c.name||""};
          $("cmInput").placeholder=cmReply?"Replying to "+cmReply.name+"…":"Write a comment…"; $("cmInput").focus();
        }));
        if(c.uid===myUid) row.appendChild(actBtn("✕",()=>{
          deleteDoc(doc(db,"comments",c.id)).catch(()=>{});
          if(!isReply) all.filter(k=>k.parentId===c.id).forEach(k=>deleteDoc(doc(db,"comments",k.id)).catch(()=>{}));
        }));
        return row;
      };
      tops.forEach(c=>{ box.appendChild(mk(c,false)); all.filter(k=>k.parentId===c.id).forEach(k=>box.appendChild(mk(k,true))); });
    }
    function updateCmCounts(){
      document.querySelectorAll(".cmBtn").forEach(b=>{ b.textContent="💬 "+(comments[b.dataset.id]||[]).length; });
    }
    async function sendComment(){
      const t=$("cmInput").value.trim();
      if(!t||!cmTarget||!myUid) return;
      $("cmInput").value="";
      const rp=cmReply; cmReply=null; $("cmInput").placeholder="Write a comment…";
      const it=postRaw.find(p=>p.id===cmTarget)||reelList.find(r=>r.id===cmTarget)||{};
      try{
        const o={targetId:cmTarget,text:t.slice(0,300),name:myName,uid:myUid,createdAt:serverTimestamp()};
        if(rp) o.parentId=rp.id;
        await addDoc(collection(db,"comments"),o);
        if(rp) notifTo(rp.uid,"reply",{text:t.slice(0,60)});
        if(it.uid&&(!rp||rp.uid!==it.uid)) notifTo(it.uid,"comment",{text:t.slice(0,60),url:it.url||"",mediaKind:it.kind||"video"});
      }catch(e){ alert("Comment failed: "+e.code); }
    }
    $("cmSend").onclick=sendComment;
    $("cmInput").addEventListener("keydown",e=>{ if(e.key==="Enter") sendComment(); });
    $("cmClose").onclick=()=>{ $("cmSheet").hidden=true; cmTarget=null; };

    // posts upload
    $("postsBtn").onclick=()=>$("postInput").click();
            $("postInput").onchange=async e=>{
      const f=e.target.files[0]; e.target.value="";
      if(!f||!myUid) return;
      const isV=f.type.startsWith("video/");
      if(!isV&&!f.type.startsWith("image/")){ alert("Please choose a photo or video"); return; }
      if(f.size>MAX_MB*1024*1024){ alert("File is larger than "+MAX_MB+" MB."); return; }
      const cap=prompt("Caption (leave empty for none)")||"";
      $("postsBtn").style.opacity=.4;
      try{
        const url=await cloudUpload(f);
        await addDoc(collection(db,"posts"),{url,kind:isV?"video":"image",caption:cap.slice(0,200),tags:tagsOf(cap.slice(0,200)),name:myName,uid:myUid,createdAt:serverTimestamp()});
        toast("Post added ✅");
      }catch(err){ alert("Post failed: "+(err.message||err)); }
      $("postsBtn").style.opacity=1;
    };

    /* ================= MESSAGE ACTIONS: reply / copy / forward / pin / edit / delete ================= */
    let mmCur=null, pinCur=null;
    function msgPreview(d){
      const t=d.type||"text";
      return t==="image"?"📷 Photo":t==="video"?"🎥 Video":t==="audio"?"🎤 Voice message":t==="file"?"📄 "+(d.fileName||"File"):t==="snap"?"📸 Snap":(d.text||"");
    }
    function openMsgMenu(id,d,mine){
      mmCur={id,d,mine};
      const isText=(d.type||"text")==="text";
      $("mmEdit").hidden=!(mine&&isText&&!d.heart);
      $("mmDelete").hidden=!mine;
      $("mmCopy").hidden=!(isText||d.url);
      $("mmForward").hidden=!(isText||d.url);
      $("mmPin").textContent=d.pinned?"📌 Unpin":"📌 Pin";
      $("msgMenu").hidden=false;
    }
    function closeMsgMenu(){ $("msgMenu").hidden=true; }
    $("msgMenu").onclick=e=>{ if(e.target.id==="msgMenu") closeMsgMenu(); };
    $("mmCancel").onclick=closeMsgMenu;
    $("mmReply").onclick=()=>{ const c=mmCur; closeMsgMenu(); if(c) setReply(c.d); };
    $("mmCopy").onclick=async()=>{
      const c=mmCur; closeMsgMenu(); if(!c) return;
      try{ await navigator.clipboard.writeText(c.d.text||c.d.url||""); toast("Copied ✅"); }catch(e){ toast("Copy failed"); }
    };
    $("mmForward").onclick=async()=>{
      const c=mmCur; closeMsgMenu(); if(!c) return;
      const text=c.d.text||"", url=c.d.url||"";
      try{
        if(navigator.share) await navigator.share(url?{title:"Jivlag",text,url}:{text});
        else{ await navigator.clipboard.writeText((text+" "+url).trim()); toast("Copied — paste it anywhere ✅"); }
      }catch(e){}
    };
    $("mmPin").onclick=async()=>{
      const c=mmCur; closeMsgMenu(); if(!c) return;
      try{
        if(c.d.pinned){ await updateDoc(doc(db,"messages",c.id),{pinned:false}); }
        else{
          if(pinCur&&pinCur.id!==c.id) await updateDoc(doc(db,"messages",pinCur.id),{pinned:false});
          await updateDoc(doc(db,"messages",c.id),{pinned:true});
        }
      }catch(e){ alert("Pin failed: "+e.code); }
    };
    $("mmEdit").onclick=async()=>{
      const c=mmCur; closeMsgMenu(); if(!c) return;
      const nt=prompt("Edit message",c.d.text||""); if(nt===null) return;
      const t=nt.trim(); if(!t||t===c.d.text) return;
      try{ await updateDoc(doc(db,"messages",c.id),{text:t,edited:true}); }catch(e){ alert("Edit failed: "+e.code); }
    };
    $("mmDelete").onclick=async()=>{
      const c=mmCur; closeMsgMenu();
      if(!c||!confirm("Delete this message?")) return;
      try{ await deleteDoc(doc(db,"messages",c.id)); }catch(e){ alert("Delete failed: "+e.code); }
    };
    function drawPin(p){
      pinCur=p;
      if(!p){ $("pinBar").hidden=true; return; }
      $("pinText").textContent=(p.data.name?p.data.name+": ":"")+msgPreview(p.data).slice(0,80);
      $("pinBar").hidden=false;
    }
    $("pinBar").onclick=e=>{
      if(e.target.id==="pinX"||!pinCur) return;
      const el=chat.querySelector('.react[data-id="'+pinCur.id+'"]');
      const row=el&&el.closest(".row");
      if(row){ row.scrollIntoView({block:"center",behavior:"smooth"}); row.classList.add("flash"); setTimeout(()=>row.classList.remove("flash"),1400); }
    };
    $("pinX").onclick=()=>{ if(pinCur) updateDoc(doc(db,"messages",pinCur.id),{pinned:false}).catch(()=>{}); };

    /* ================= NOTIFICATIONS (while the app is open or in the background) ================= */
    $("notifBtn").onclick=async()=>{
      if(!("Notification" in window)){ alert("This browser does not support notifications."); return; }
      const p=await Notification.requestPermission();
      toast(p==="granted"?"Notifications on ✅":"Notifications blocked");
    };
    function notify(d){
      if(!document.hidden||!("Notification" in window)||Notification.permission!=="granted") return;
      const body=d.heart?"❤️ Miss you!":msgPreview(d).slice(0,100);
      if(navigator.serviceWorker) navigator.serviceWorker.ready.then(r=>r.showNotification(d.name||"Jivlag",{body,icon:"icon-192.png",badge:"icon-192.png",tag:"jivlag-msg"})).catch(()=>{});
    }

    /* ================= SEARCH ================= */
    function applySearch(){
      const q=$("searchInput").value.trim().toLowerCase();
      let n=0;
      chat.querySelectorAll(".row").forEach(r=>{
        const hit=!q||(r.dataset.q||"").includes(q);
        r.classList.toggle("hide",!hit);
        if(hit&&q) n++;
      });
      chat.querySelectorAll(".dateChip").forEach(c=>c.classList.toggle("hide",!!q));
      $("searchCount").textContent=q?(n?n+" found":"No results"):"";
    }
    $("searchBtn").onclick=()=>{
      const bar=$("searchBar"); bar.hidden=!bar.hidden;
      if(bar.hidden){ $("searchInput").value=""; applySearch(); } else $("searchInput").focus();
    };
    $("searchClose").onclick=()=>{ $("searchBar").hidden=true; $("searchInput").value=""; applySearch(); };
    $("searchInput").addEventListener("input",applySearch);

    /* ================= GALLERY ================= */
    let galFilter="all";
    function galThumb(it){
      let u=it.url.replace("/upload/",it.kind==="video"?"/upload/so_0,w_300,h_300,c_fill,q_auto/":"/upload/w_300,h_300,c_fill,q_auto/");
      return it.kind==="video"?u.replace(/\.[a-z0-9]+$/i,".jpg"):u;
    }
    function drawGallery(){
      const feed=$("galFeed"); feed.innerHTML="";
      const seen=new Set(), all=[];
      galleryItems.forEach(it=>{ if(!seen.has(it.url)){ seen.add(it.url); all.push(it); } });
      postList.forEach(p=>{
        const u=p.kind==="video"?mp4(p.url):p.url;
        if(p.url&&!seen.has(u)){ seen.add(u); all.push({url:u,kind:p.kind==="video"?"video":"image",name:p.name||"",t:p.createdAt&&p.createdAt.toMillis?p.createdAt.toMillis():0}); }
      });
      const list=all.filter(i=>galFilter==="all"||i.kind===galFilter).sort((a,b)=>b.t-a.t);
      if(!list.length){ feed.innerHTML='<div class="galEmpty">Nothing here yet<br>Send a photo or video in the chat</div>'; return; }
      list.forEach(it=>{
        const d=document.createElement("div"); d.className="gi"+(it.kind==="video"?" v":"");
        const im=document.createElement("img"); im.loading="lazy"; im.alt=""; im.src=galThumb(it);
        d.appendChild(im);
        d.onclick=()=>{ if(it.kind==="video") window.open(it.url,"_blank"); else showViewer(it.url,"🖼️ "+it.name,0,null); };
        feed.appendChild(d);
      });
    }
    $("galBtn").onclick=()=>{ $("gallery").hidden=false; drawGallery(); };
    $("galBack").onclick=()=>{ $("gallery").hidden=true; };
    document.querySelectorAll("#galTabs button").forEach(b=>{
      b.onclick=()=>{
        galFilter=b.dataset.f;
        document.querySelectorAll("#galTabs button").forEach(x=>x.classList.toggle("on",x===b));
        drawGallery();
      };
    });

    /* ================= CLEAR CHAT FOR EVERYONE ================= */
    $("clearAllBtn").onclick=async()=>{
      if(!myUid) return;
      if(!confirm("⚠️ All messages of this chat will be deleted for both of you, permanently. Continue?")) return;
      if(!confirm("Really delete? This cannot be undone.")) return;
      try{
        if(!curChat){ alert("Open a chat first"); return; }
        const snapshot=await getDocs(query(collection(db,"messages"),where("chatId","==",curChat)));
        await Promise.all(snapshot.docs.map(d=>deleteDoc(doc(db,"messages",d.id))));
      }catch(e){ alert("Clear failed: "+e.code); }
    };

    /* ================= DELETE ALL ================= */
    deleteAllBtn.onclick=async()=>{
      if(!myUid)return;
      if(!confirm("Delete all your messages?"))return;
      try{
        const q=query(collection(db,"messages"),where("chatId","==",curChat||"-"),where("uid","==",myUid));
        const snapshot=await getDocs(q);
        await Promise.all(snapshot.docs.map(d=>deleteDoc(doc(db,"messages",d.id))));
        alert("All your messages deleted ❤️");
      }catch(e){ alert("Delete All failed: "+e.code); }
    };
  

    /* ================= USERS / CHAT LIST / NAV ================= */
    function listenUsers(){
      onSnapshot(collection(db,"users"),s=>{ usersMap={}; s.forEach(d=>{ usersMap[d.id]=d.data(); }); drawChats(); },()=>{});
      listenPresence(); listenExtras(); listenReels(); listenPosts();
    }
    function setAv(el,u){ u=u||{}; el.style.backgroundImage=u.photo?"url('"+u.photo+"')":""; el.style.backgroundSize="cover"; el.textContent=u.photo?"":(u.name||"?").charAt(0).toUpperCase(); }
    function callBtn(txt,u,v){ const b=document.createElement("button"); b.textContent=txt; b.className="cBtn"; b.onclick=e=>{ e.stopPropagation(); if(!canChat(u.uid)){ toast("Follow this person first"); return; } openChat(u); startCall(v); }; return b; }
    function drawChats(){
      const box=$("chatList"); if(!box) return; box.innerHTML="";
      { const raw=($("userSearch").value||"").trim(); if(raw.length>1&&raw[0]==="#"){ clearTimeout(drawChats.t); drawChats.t=setTimeout(()=>drawTags(raw.slice(1).toLowerCase()),300); return; } }
      const q=($("userSearch").value||"").trim().toLowerCase().replace(/^@/,"");
      const arr=Object.values(usersMap).filter(u=>u.uid!==myUid&&!isHidden(u.uid)&&(q||canChat(u.uid))&&(!q||((u.name||"")+" "+(u.username||"")).toLowerCase().includes(q)));
      if(!arr.length){ box.innerHTML=q?'<div class="reelEmpty">No users found</div>':'<div class="reelEmpty">No chats yet<br>Search a user and follow them to start chatting</div>'; return; }
      arr.forEach(u=>{
        const p=presAll[u.uid]||{}, on=Date.now()-(p.lastActive||0)<75000;
        const r=document.createElement("div"); r.className="cRow";
        r.innerHTML='<span class="pAv"></span><div><b></b><small></small></div>';
        setAv(r.querySelector(".pAv"),u);
        r.querySelector("b").textContent=u.name||"";
        r.querySelector("small").textContent=on?"🟢 online":((u.username?"@"+u.username:(canChat(u.uid)?"tap to chat":"follow to chat"))+(u.bio?" · "+u.bio:""));
        const pb=document.createElement("button"); pb.className="cBtn"; pb.textContent="👤"; pb.onclick=e=>{ e.stopPropagation(); profUid=u.uid; logHist("profile",u.uid,{uid:u.uid,name:u.name||""}); showTab("prof"); }; r.append(pb,callBtn("📞",u,false),callBtn("🎥",u,true));
        r.onclick=()=>openChat(u); box.appendChild(r);
      });
    }
    function openChat(u){
      if(!canChat(u.uid)){ toast("Follow this person first to chat"); return; }
      if(isHidden(u.uid)){ toast("You can't chat with this account"); return; }
      curPeer=u; curChat=[myUid,u.uid].sort().join("_");
      $("peerName").textContent=u.name||""; setAv($("peerAv"),u);
      other=presAll[u.uid]||null; updateSub();
      $("chatScreen").hidden=false; listenMessages();
    }
    $("chatBack").onclick=()=>{ if(msgUnsub){ msgUnsub(); msgUnsub=null; } curChat=null; curPeer=null; other=null; $("chatScreen").hidden=true; };
    function showTab(t){
      $("home").hidden=t!=="home"; $("chats").hidden=t!=="chats"; $("prof").hidden=t!=="prof";
      $("navProf").classList.toggle("on",t==="prof"); if(t==="prof") drawProf();
      $("navChat").classList.toggle("on",t==="home"); $("navChats").classList.toggle("on",t==="chats");
    }
    $("navChat").onclick=()=>showTab("home");
    $("navProf").onclick=()=>{ profUid=myUid; showTab("prof"); };
    $("galMenu").onclick=()=>$("galBtn").onclick();
    $("navChats").onclick=()=>showTab("chats");

    function listenFollows(){ onSnapshot(collection(db,"follows"),sn=>{ followsAll=[]; sn.forEach(d=>followsAll.push(d.data())); applyVis(); drawChats(); if(curPeer&&!canChat(curPeer.uid)) $("chatBack").click(); if(!$("prof").hidden) drawProf(); },()=>{}); }
    function drawProf(){
      profUid=profUid||myUid; const me=profUid===myUid;
      const u=usersMap[profUid]||(me?{name:myName}:{}), mine=postList.filter(p=>p.uid===profUid);
      setAv($("profAv"),u); $("profUser").textContent=u.username||(u.name||"").toLowerCase().replace(/\s+/g,"_");
      $("profNameShow").textContent=u.name||""; $("profBioShow").textContent=u.bio||"";
      $("stPosts").textContent=mine.length; $("stFollowers").textContent=followsAll.filter(f=>f.to===profUid).length; $("stFollowing").textContent=followsAll.filter(f=>f.from===profUid).length;
      $("profBack").hidden=me; $("profEdit").hidden=!me; $("profPhotoBtn").hidden=!me; $("profFollow").hidden=me; if(!me) $("profForm").hidden=true;
      const fl=followsAll.some(f=>f.from===myUid&&f.to===profUid); $("profFollow").textContent=fl?"Following ✓":(reqOut.has(profUid)?"Requested":"Follow"); $("profMore").hidden=me;
      $("profMsg").hidden=me||isHidden(profUid)||!canChat(profUid); $("profBlock").hidden=me; $("profBlock").textContent=myBlocks.has(profUid)?"Unblock":"Block"; $("tabPosts").classList.toggle("on",profTab==="posts"); $("tabReels").classList.toggle("on",profTab==="reels");
      const items=profTab==="reels"?reelList.filter(r=>r.uid===profUid):mine;
      const g=$("profGrid"); g.innerHTML="";
      if(!me&&u.private&&!fl){ g.innerHTML='<div class="reelEmpty">🔒 This account is private<br>Follow to see their posts</div>'; return; }
      if(!items.length){ g.innerHTML='<div class="reelEmpty">No posts yet</div>'; return; }
      items.forEach(p=>{
        const c=document.createElement("div"); c.className="gCell";
        if(p.kind==="video"||profTab==="reels"){ const v=document.createElement("video"); v.src=mp4(p.url); v.muted=true; v.preload="metadata"; v.playsInline=true; c.append(v); c.onclick=()=>{ if(profTab==="reels") $("reelsBtn").click(); else showTab("home"); }; }
        else{ const im=document.createElement("img"); im.src=p.url; im.loading="lazy"; c.append(im); c.onclick=()=>showViewer(p.url,p.caption||"",0,null); }
        if(me){ const x=document.createElement("button"); x.className="gDel"; x.textContent="🗑"; x.onclick=ev=>{ ev.stopPropagation(); if(confirm("Delete this post?")) deleteDoc(doc(db,"posts",p.id)).catch(er=>alert("Failed: "+er.code)); }; c.append(x); }
        g.appendChild(c);
      });
    }
    $("profBack").onclick=()=>{ profUid=myUid; showTab("chats"); };
    $("profFollow").onclick=async()=>{
      const t=profUid; if(!t||t===myUid) return; const id=myUid+"_"+t;
      const following=followsAll.some(f=>f.from===myUid&&f.to===t);
      try{
        if(following) await deleteDoc(doc(db,"follows",id));
        else if(reqOut.has(t)) await deleteDoc(doc(db,"followReqs",id));
        else if((usersMap[t]||{}).private){ await setDoc(doc(db,"followReqs",id),{from:myUid,to:t,at:Date.now()}); notifTo(t,"request",{}); toast("Follow request sent"); }
        else{ await setDoc(doc(db,"follows",id),{from:myUid,to:t}); notifTo(t,"follow",{}); }
      }catch(e){ alert("Failed: "+e.code); }
    };
    $("profMore").onclick=()=>{
      const t=profUid; if(!t||t===myUid) return; const nm=(usersMap[t]||{}).name||"this account";
      actionSheet(nm,[
        [isMuted(t)?"🔔 Unmute posts & stories":"🔕 Mute posts & stories",()=>togglePref("muted",t)],
        [isRestricted(t)?"Unrestrict":"🤫 Restrict",()=>togglePref("restricted",t)],
        ["🚩 Report account",()=>reportThing("account",t,t)],
        [myBlocks.has(t)?"Unblock":"🚫 Block",()=>$("profBlock").click()]
      ]);
    };
    $("profEdit").onclick=()=>{ const f=$("profForm"); f.hidden=!f.hidden; $("profEdit").textContent=f.hidden?"Edit profile":"Cancel"; if(!f.hidden){ const u=usersMap[myUid]||{}; $("profName").value=u.name||myName||""; $("profBio").value=u.bio||""; } };
    $("profPhotoBtn").onclick=()=>$("profPhoto").click();
    $("profPhoto").onchange=async e=>{
      const f=e.target.files[0]; e.target.value=""; if(!f) return;
      $("profPhotoBtn").textContent="Uploading...";
      try{ const photo=await cloudUpload(f); await setDoc(doc(db,"users",myUid),{photo},{merge:true}); toast("Photo updated ✅"); setTimeout(drawProf,500); }
      catch(err){ alert("Photo failed: "+(err.message||err)); }
      $("profPhotoBtn").textContent="Change photo";
    };
    $("profSave").onclick=async()=>{
      const name=$("profName").value.trim()||myName, bio=$("profBio").value.trim();
      try{
        await setDoc(doc(db,"users",myUid),{name,bio},{merge:true});
        myName=name; localStorage.setItem("ourchat_name",name);
        if(auth.currentUser) updateProfile(auth.currentUser,{displayName:name}).catch(()=>{});
        toast("Saved ✅"); $("profForm").hidden=true; $("profEdit").textContent="Edit profile"; setTimeout(drawProf,500);
      }catch(err){ alert("Save failed: "+err.code); }
    };

    /* ===== call history ===== */
    let callsMap={};
    function listenCallLog(){
      ["from","to"].forEach(k=>onSnapshot(query(collection(db,"calls"),where(k,"==",myUid)),s=>{
        s.forEach(d=>{ callsMap[d.id]=d.data(); }); drawCallLog();
      },()=>{}));
    }
    function drawCallLog(){
      const box=$("callLog"); box.innerHTML="";
      const arr=Object.values(callsMap).filter(c=>c.to).sort((a,b)=>b.createdAt-a.createdAt).slice(0,15);
      if(!arr.length){ box.innerHTML='<div class="reelEmpty">No calls yet</div>'; return; }
      arr.forEach(c=>{
        const out=c.from===myUid, pid=out?c.to:c.from, u=usersMap[pid]||{uid:pid,name:c.name||"?"};
        const miss=!out&&!c.answer;
        const r=document.createElement("div"); r.className="cRow";
        r.innerHTML='<span class="pAv"></span><div><b></b><small></small></div>'; setAv(r.querySelector(".pAv"),u);
        r.querySelector("b").textContent=u.name||""; if(miss) r.querySelector("b").style.color="#e5484d";
        r.querySelector("small").textContent=(out?"↗ ":"↙ ")+(c.video?"Video":"Voice")+(miss?" · missed":"")+" · "+new Date(c.createdAt).toLocaleString([],{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
        r.append(callBtn(c.video?"🎥":"📞",u,!!c.video)); box.appendChild(r);
      });
    }

    $("tabPosts").onclick=()=>{ profTab="posts"; drawProf(); };
    $("tabReels").onclick=()=>{ profTab="reels"; drawProf(); };
    $("profBlock").onclick=async()=>{
      const t=profUid; if(!t||t===myUid) return;
      const ref=doc(db,"blocks",myUid+"_"+t);
      try{
        if(myBlocks.has(t)){ await deleteDoc(ref); toast("Unblocked ✅"); return; }
        if(!confirm("Block "+((usersMap[t]||{}).name||"this account")+"? They won't be able to message or call you, and you won't see each other's posts.")) return;
        await setDoc(ref,{by:myUid,who:t,at:Date.now()});
        deleteDoc(doc(db,"follows",myUid+"_"+t)).catch(()=>{});
        deleteDoc(doc(db,"follows",t+"_"+myUid)).catch(()=>{});
        toast("Blocked 🚫"); showTab("chats");
      }catch(e){ alert("Failed: "+e.code); }
    };
    $("profMsg").onclick=()=>{ const u=usersMap[profUid]; if(u) openChat(u); };
    $("userSearch").oninput=drawChats;
    $("userSearch").addEventListener("change",()=>{ const t=$("userSearch").value.trim(); if(t.length>=2) logHist("search",encodeURIComponent(t.toLowerCase()).slice(0,150),{text:t}); });
    function showFollows(kind){
      const ids=followsAll.filter(f=>kind==="followers"?f.to===profUid:f.from===profUid).map(f=>kind==="followers"?f.from:f.to);
      $("fTitle").textContent=(kind==="followers"?"Followers":"Following")+" ("+ids.length+")"; const box=$("fRows"); box.innerHTML="";
      if(!ids.length) box.innerHTML='<div class="reelEmpty">Nobody yet</div>';
      ids.forEach(id=>{ const u=usersMap[id]||{uid:id,name:"?"}, r=document.createElement("div"); r.className="cRow";
        r.innerHTML='<span class="pAv"></span><div><b></b><small></small></div>'; setAv(r.querySelector(".pAv"),u);
        r.querySelector("b").textContent=u.name||""; r.querySelector("small").textContent=u.username?"@"+u.username:"";
        r.onclick=()=>{ $("fList").hidden=true; profUid=id; showTab("prof"); }; box.appendChild(r); });
      $("fList").hidden=false;
    }
    $("stFollowers").parentElement.onclick=()=>showFollows("followers");
    $("stFollowing").parentElement.onclick=()=>showFollows("following");
    $("fClose").onclick=()=>{ $("fList").hidden=true; };
