    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
      getFirestore, collection, addDoc, setDoc, updateDoc, query, orderBy, limit,
      onSnapshot, serverTimestamp, deleteDoc, doc, where, getDocs
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    // ===== Cloudinary (photo / video / file upload) — apla cloud name ani preset ithe taka =====
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

    let myName=null, myUid=null, started=false;

    onAuthStateChanged(auth,user=>{
      if(!user||user.isAnonymous){
        if(user) signOut(auth);
        $("loginBox").hidden=false;
        return;
      }
      $("loginBox").hidden=true;
      myUid=user.uid;
      if(!myName){
        myName=localStorage.getItem("ourchat_name");
        if(!myName){
          myName=(prompt("तुमचे नाव काय?")||"").trim()||"Me";
          localStorage.setItem("ourchat_name",myName);
        }
      }
      if(!started){ started=true; listenMessages(); listenCalls(); listenPresence(); listenExtras(); }
    });

    async function doLogin(){
      const em=$("loginEmail").value.trim(), pw=$("loginPass").value;
      if(!em||!pw)return;
      $("loginErr").textContent="";
      try{ await signInWithEmailAndPassword(auth,em,pw); }
      catch(e){ $("loginErr").textContent="Email kinva password chukicha aahe ("+e.code+")"; }
    }
    $("loginBtn").onclick=doLogin;
    $("loginPass").addEventListener("keydown",e=>{ if(e.key==="Enter")doLogin(); });
    $("logoutBtn").onclick=async()=>{ if(confirm("Logout karaycha?")){ await signOut(auth); location.reload(); } };

    /* ================= MESSAGES ================= */
    function dayLabel(d){
      const today=new Date(), y=new Date(); y.setDate(today.getDate()-1);
      if(d.toDateString()===today.toDateString()) return "Today";
      if(d.toDateString()===y.toDateString()) return "Yesterday";
      return d.toLocaleDateString([], {day:"numeric",month:"short",year:"numeric"});
    }

    function listenMessages(){
      const q=query(collection(db,"messages"),orderBy("createdAt"),limit(200));
      onSnapshot(q,snapshot=>{
        const isFirst=firstLoad; firstLoad=false;
        if(!isFirst) snapshot.docChanges().forEach(c=>{
          const d=c.doc.data();
          if(c.type==="added"&&!c.doc.metadata.hasPendingWrites&&d.uid!==myUid){ ding(); if(d.heart) hearts(); }
        });
        chat.innerHTML="";
        if(snapshot.empty){ chat.innerHTML='<div id="status">No messages yet ❤️</div>'; return; }

        let lastDay=""; const dayMap={};
        snapshot.forEach(messageDoc=>{
          const data=messageDoc.data();
          const mine=data.uid===myUid;
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
          const message=document.createElement("div");
          message.className="message"+(mine?" my-message":"");

          const name=document.createElement("div");
          name.className="name";
          name.textContent=data.name||"Unknown";
          message.appendChild(name);

          if(data.replyTo){
            const qt=document.createElement("div");
            qt.className="quote";
            qt.textContent=data.replyTo.name+": "+data.replyTo.text;
            message.appendChild(qt);
          }

          const type=data.type||"text";
          if(type==="image"){
            const img=document.createElement("img");
            img.className="media"; img.src=data.url; img.loading="lazy";
            img.onclick=()=>window.open(data.url,"_blank");
            img.onload=()=>{chat.scrollTop=chat.scrollHeight;};
            message.appendChild(img);
          }else if(type==="video"){
            const v=document.createElement("video");
            v.className="media"; v.src=data.url; v.controls=true; v.preload="metadata"; v.playsInline=true;
            message.appendChild(v);
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
            tm.textContent=ts.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
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

          message.onclick=e=>{
            if(["A","IMG","VIDEO","AUDIO"].includes(e.target.tagName)||e.target.closest(".snap")) return;
            const now=Date.now();
            if(lastTap.id===messageDoc.id&&now-lastTap.t<350){
              clearTimeout(lastTap.timer); lastTap.id=null; toggleHeart(messageDoc.id); return;
            }
            lastTap={id:messageDoc.id,t:now,timer:setTimeout(()=>setReply(data),350)};
          };
          row.appendChild(message);

          if(mine){
            const del=document.createElement("button");
            del.className="deleteBtn"; del.textContent="🗑️"; del.title="Delete message";
            del.onclick=async()=>{
              if(!confirm("Delete this message?")) return;
              try{ await deleteDoc(doc(db,"messages",messageDoc.id)); }
              catch(e){ alert("Delete failed: "+e.code); }
            };
            row.appendChild(del);
          }
          chat.appendChild(row);
        });
        chat.scrollTop=chat.scrollHeight;
        updateTicks(); updateSnaps(); updateReacts(); updateStreak(dayMap);
        if(!document.hidden) setPresence({lastRead:Date.now()});
      },error=>{ chat.innerHTML='<div id="status">Error: '+error.code+'</div>'; });
    }

    async function sendMessage(){
      const text=input.value.trim();
      if(!text||!myUid)return;
      input.value="";
      try{
        await addMsg({type:"text",text});
      }catch(e){ alert("Send failed: "+e.code); input.value=text; }
    }
    sendBtn.onclick=sendMessage;
    input.addEventListener("keydown",e=>{ if(e.key==="Enter")sendMessage(); });

    /* ================= PHOTO / VIDEO / FILE ================= */
    attachBtn.onclick=()=>{
      if(CLOUD_NAME==="irn5vnzr"){ alert("Pahile Cloudinary cloud name ani upload preset code madhe taka."); return; }
      fileInput.click();
    };

    fileInput.onchange=async()=>{
      const file=fileInput.files[0];
      fileInput.value="";
      if(!file||!myUid)return;
      if(file.size>MAX_MB*1024*1024){ alert("File "+MAX_MB+" MB peksha motha aahe."); return; }

      attachBtn.textContent="⏳"; attachBtn.disabled=true;
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
        attachBtn.textContent="📎"; attachBtn.disabled=false;
      }
    };

    /* ================= VOICE / VIDEO CALL (WebRTC) ================= */
    const rtcCfg={iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}]};
    let pc=null, localStream=null, callRef=null, unsubs=[], pending=[], ringTimer=null, answered=false, incomingCall=null;

    async function setupMedia(video){
      localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:"user"}:false});
      localVideo.srcObject=localStream;
      localVideo.style.display=video?"block":"none";
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
        if(pc.connectionState==="connected") callInfo.textContent="🔴 Live";
        if(pc.connectionState==="failed") endCall(true);
      };
    }

    function addCand(c){
      if(pc&&pc.remoteDescription) pc.addIceCandidate(c).catch(()=>{});
      else pending.push(c);
    }
    function flushCands(){ pending.forEach(c=>pc.addIceCandidate(c).catch(()=>{})); pending=[]; }

    function showCallUI(text){ callInfo.textContent=text; callUI.hidden=false; }

    async function startCall(video){
      if(pc||!myUid)return;
      try{ await setupMedia(video); }
      catch(e){ alert("Mic/Camera permission milali nahi: "+e.name); return; }

      showCallUI("Calling...");
      createPC();
      callRef=doc(collection(db,"calls"));
      const callerCands=collection(callRef,"callerCandidates");
      const calleeCands=collection(callRef,"calleeCandidates");
      pc.onicecandidate=e=>{ if(e.candidate) addDoc(callerCands,e.candidate.toJSON()); };

      try{
        const offer=await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setDoc(callRef,{
          from:myUid,name:myName,video,status:"ringing",createdAt:Date.now(),
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
      incomingCall=null; incoming.hidden=true;
      try{ await setupMedia(data.video); }
      catch(e){ alert("Mic/Camera permission milali nahi: "+e.name); updateDoc(ref,{status:"declined"}); return; }

      callRef=ref;
      showCallUI("Connecting...");
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
      incomingCall=null; incoming.hidden=true;
    }

    function endCall(notify){
      clearTimeout(ringTimer);
      if(notify&&callRef) updateDoc(callRef,{status:"ended"}).catch(()=>{});
      unsubs.forEach(u=>u()); unsubs=[]; pending=[];
      if(localStream) localStream.getTracks().forEach(t=>t.stop());
      if(pc){ pc.onicecandidate=null; pc.onconnectionstatechange=null; pc.close(); }
      pc=null; localStream=null; callRef=null; answered=false;
      remoteVideo.srcObject=null; localVideo.srcObject=null;
      callUI.hidden=true;
    }

    function listenCalls(){
      const q=query(collection(db,"calls"),where("status","==","ringing"));
      onSnapshot(q,snap=>{
        snap.docChanges().forEach(c=>{
          const d=c.doc.data();
          if(c.type==="added"&&d.from!==myUid&&!pc&&!incomingCall&&Date.now()-d.createdAt<90000){
            incomingCall={ref:c.doc.ref,data:d,id:c.doc.id};
            incomingText.textContent=(d.video?"🎥 Video call":"📞 Voice call")+" — "+(d.name||"");
            incoming.hidden=false;
          }
          if(c.type==="removed"&&incomingCall&&incomingCall.id===c.doc.id){
            incomingCall=null; incoming.hidden=true;
          }
        });
      },()=>{});
    }

    $("voiceBtn").onclick=()=>startCall(false);
    $("videoBtn").onclick=()=>startCall(true);
    $("endBtn").onclick=()=>endCall(true);
    $("acceptBtn").onclick=acceptCall;
    $("declineBtn").onclick=declineCall;
    $("muteBtn").onclick=()=>{
      if(!localStream)return;
      const t=localStream.getAudioTracks()[0];
      if(!t)return;
      t.enabled=!t.enabled;
      $("muteBtn").textContent=t.enabled?"🎤":"🔇";
    };

    /* ================= EXTRAS ================= */
    let firstLoad=true, other=null, replyTo=null, typingOn=false, tt=null, actx=null, rec=null, chunks=[];

    function addMsg(o){
      const m={...o,name:myName,uid:myUid,createdAt:serverTimestamp()};
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
      document.querySelectorAll(".tick").forEach(t=>{ t.textContent=(+t.dataset.ts<=lr)?" ✓✓":" ✓"; });
    }
    function listenPresence(){
      onSnapshot(collection(db,"presence"),snap=>{
        other=null;
        snap.forEach(d=>{ if(d.id!==myUid) other=d.data(); });
        updateSub(); updateTicks();
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
      catch(e){ alert("Mic permission milali nahi"); return; }
      rec=new MediaRecorder(st); chunks=[];
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=async()=>{
        st.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunks,{type:rec.mimeType||"audio/webm"});
        rec=null; micBtn.style.background="";
        if(blob.size<1500){ micBtn.textContent="🎤"; return; }
        micBtn.textContent="⏳";
        try{
          const fd=new FormData();
          fd.append("file",blob,"voice.webm");
          fd.append("upload_preset",UPLOAD_PRESET);
          const r=await fetch("https://api.cloudinary.com/v1_1/"+CLOUD_NAME+"/auto/upload",{method:"POST",body:fd});
          const j=await r.json();
          if(!r.ok||!j.secure_url) throw new Error((j.error&&j.error.message)||"Upload failed");
          await addMsg({type:"audio",url:j.secure_url,text:""});
        }catch(e){ alert("Voice failed: "+(e.message||e)); }
        micBtn.textContent="🎤";
      };
      rec.start(); micBtn.textContent="⏹️"; micBtn.style.background="#ffd0dc";
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
      onSnapshot(query(collection(db,"stories"),orderBy("createdAt"),limit(30)),s=>{
        stories=[];
        s.forEach(d=>{
          const x=d.data();
          const t=x.createdAt&&x.createdAt.toMillis?x.createdAt.toMillis():Date.now();
          if(Date.now()-t<86400000) stories.push({id:d.id,...x,t});
        });
        drawStories();
      },()=>{});
    }

    // viewer (snap + story)
    function showViewer(url,cap,secs,onDel){
      $("viewImg").src=url;
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
    function closeViewer(){ clearInterval(vTimer); $("viewer").hidden=true; $("viewImg").src=""; }
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
        e.className="snap"+(o?" done":"");
        e.textContent=o?"📸 Opened":mine?"📸 Snap sent":"📸 Tap to view";
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
      $("addStory").style.opacity=.4;
      try{
        const url=await cloudUpload(f);
        await addDoc(collection(db,"stories"),{url,name:myName,uid:myUid,createdAt:serverTimestamp()});
      }catch(err){ alert("Story failed: "+(err.message||err)); }
      $("addStory").style.opacity=1;
    };
    function drawStories(){
      const box=$("storyList"); box.innerHTML="";
      stories.slice().reverse().forEach(s=>{
        const it=document.createElement("div"); it.className="sItem";
        const c=document.createElement("div"); c.className="sCircle sRing";
        c.style.backgroundImage="url('"+s.url+"')";
        const n=document.createElement("span"); n.textContent=s.uid===myUid?"You":(s.name||"");
        it.appendChild(c); it.appendChild(n);
        const cap="📖 "+(s.name||"")+" · "+new Date(s.t).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
        it.onclick=()=>showViewer(s.url,cap,0,s.uid===myUid?()=>deleteDoc(doc(db,"stories",s.id)):null);
        box.appendChild(it);
      });
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

    /* ================= MENU ================= */
    $("menuBtn").onclick=()=>{ $("menu").hidden=!$("menu").hidden; };
    $("menu").onclick=()=>{ $("menu").hidden=true; };
    document.addEventListener("click",e=>{
      if(!e.target.closest("#menu")&&e.target.id!=="menuBtn") $("menu").hidden=true;
    });

    /* ================= CLEAR CHAT FOR EVERYONE ================= */
    $("clearAllBtn").onclick=async()=>{
      if(!myUid) return;
      if(!confirm("⚠️ दोघांचे सगळे messages सर्वांसाठी कायमचे delete होतील. पुढे जायचे?")) return;
      if(!confirm("खरंच delete करायचे? हे परत मिळणार नाही.")) return;
      try{
        const snapshot=await getDocs(collection(db,"messages"));
        await Promise.all(snapshot.docs.map(d=>deleteDoc(doc(db,"messages",d.id))));
      }catch(e){ alert("Clear failed: "+e.code); }
    };

    /* ================= DELETE ALL ================= */
    deleteAllBtn.onclick=async()=>{
      if(!myUid)return;
      if(!confirm("तुमचे सर्व messages delete करायचे आहेत?"))return;
      try{
        const q=query(collection(db,"messages"),where("uid","==",myUid));
        const snapshot=await getDocs(q);
        await Promise.all(snapshot.docs.map(d=>deleteDoc(doc(db,"messages",d.id))));
        alert("All your messages deleted ❤️");
      }catch(e){ alert("Delete All failed: "+e.code); }
    };
  
