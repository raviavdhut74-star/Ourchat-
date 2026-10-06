          }else if(type==="audio"){
            const audioContainer = document.createElement("div");
            audioContainer.className = "audio-player-box";

            const au = document.createElement("audio");
            au.src = data.url;
            au.preload = "metadata";

            const speedBtn = document.createElement("button");
            speedBtn.className = "speed-btn";
            speedBtn.textContent = "1x";
            
            let speeds = [1, 1.5, 2];
            let speedIdx = 0;
            
            speedBtn.onclick = () => {
              speedIdx = (speedIdx + 1) % speeds.length;
              au.playbackRate = speeds[speedIdx];
              speedBtn.textContent = speeds[speedIdx] + "x";
            };

            audioContainer.appendChild(au);
            audioContainer.appendChild(speedBtn);
            
            const playPauseBtn = document.createElement("button");
            playPauseBtn.className = "play-pause-btn";
            playPauseBtn.textContent = "▶";
            
            playPauseBtn.onclick = () => {
              if(au.paused){
                au.play();
                playPauseBtn.textContent = "⏸";
              } else {
                au.pause();
                playPauseBtn.textContent = "▶";
              }
            };
            
            audioContainer.prepend(playPauseBtn);
            message.appendChild(audioContainer);
            message.appendChild(dlLink(data.url, "⬇️ Save"));
n.onclick=()=>{
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
      catch(e){ alert("Mic/Camera permission denied: "+e.name); return; }

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
      catch(e){ alert("Mic/Camera permission denied: "+e.name); updateDoc(ref,{status:"declined"}); return; }

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
    let galleryItems=[], firstLoad=true, other=null, replyTo=null, typingOn=false, tt=null, actx=null, rec=null, chunks=[];

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
      document.querySelectorAll(".tick").forEach(t=>{ const sn=(+t.dataset.ts<=lr); t.textContent=sn?" ✓✓":" ✓"; t.classList.toggle("seen",sn); });
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
        c.style.setProperty("--img","url('"+s.url+"')");
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

    function setIcon(b,n){
      b.innerHTML='<svg class="ic"><use href="#i-'+n+'"/></svg>';
      b.classList.toggle("rec",n==="stop");
      b.classList.toggle("busy",n==="busy");
    }

    $("camBtn").onclick=()=>$("snapInput").click();

    /* ================= MENU ================= */
    $("menuBtn").onclick=()=>{ $("menu").hidden=!$("menu").hidden; };
    $("menu").onclick=()=>{ $("menu").hidden=true; };
    document.addEventListener("click",e=>{
      if(!e.target.closest("#menu")&&e.target.id!=="menuBtn") $("menu").hidden=true;
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
      reelList.forEach(r=>{
        const sec=document.createElement("section"); sec.className="reel";
        const v=document.createElement("video");
        v.src=(r.url||"").replace(/\.[a-z0-9]+$/i,".mp4");
        v.loop=true; v.muted=reelsMuted; v.playsInline=true; v.preload="metadata";
        v.onclick=()=>{ v.paused?v.play().catch(()=>{}):v.pause(); };
        v.ondblclick=()=>toggleReelLike(r.id);

        const info=document.createElement("div"); info.className="reelInfo";
        const nm=document.createElement("b"); nm.textContent="@"+(r.name||"");
        const cp=document.createElement("div"); cp.textContent=r.caption||"";
        info.append(nm,cp);

        const side=document.createElement("div"); side.className="reelSide";
        const like=document.createElement("button"); like.className="rLike"; like.dataset.id=r.id;
        like.onclick=()=>toggleReelLike(r.id);
        const snd=document.createElement("button"); snd.className="rSnd";
        snd.textContent=reelsMuted?"🔇":"🔊"; snd.onclick=toggleReelSound;
        side.append(like,cmButton(r.id),actBtn("➤",()=>shareToChat({type:"video",url:mp4(r.url),text:r.caption||""})),dlLink(r.url),snd);
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
        await addDoc(collection(db,"reels"),{url,caption:cap.slice(0,150),name:myName,uid:myUid,createdAt:serverTimestamp()});
      }catch(err){ alert("Reel failed: "+(err.message||err)); }
      $("reelAdd").style.opacity=1;
    };

    /* ================= POSTS / COMMENTS / SHARE / DOWNLOAD ================= */
    let postList=[], comments={}, cmTarget=null;
    const dlUrl=u=>(u||"").replace("/upload/","/upload/fl_attachment/");
    const mp4=u=>(u||"").replace(/\.[a-z0-9]+$/i,".mp4");

    function toast(t){
      const el=$("toast"); el.textContent=t; el.hidden=false;
      clearTimeout(toast.t); toast.t=setTimeout(()=>{ el.hidden=true; },2200);
    }
    function shareToChat(msg){
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
        postList=[]; s.forEach(d=>postList.push({id:d.id,...d.data()}));
        if(!$("posts").hidden) drawPosts();
      },()=>{});
      onSnapshot(query(collection(db,"comments"),orderBy("createdAt"),limit(300)),s=>{
        comments={};
        s.forEach(d=>{ const c={id:d.id,...d.data()}; (comments[c.targetId]=comments[c.targetId]||[]).push(c); });
        updateCmCounts(); if(cmTarget) drawComments();
      },()=>{});
    }

    function drawPosts(){
      const feed=$("postFeed"); feed.innerHTML="";
      if(!postList.length){
        feed.innerHTML='<div class="reelEmpty">No posts yet<br>Tap ➕ above to add the first photo</div>';
        return;
      }
      postList.forEach(p=>{
        const c=document.createElement("article"); c.className="post";
        const h=document.createElement("div"); h.className="pHead";
        const av=document.createElement("span"); av.className="pAv"; av.textContent=(p.name||"?").charAt(0).toUpperCase();
        const nm=document.createElement("b"); nm.textContent=p.name||"";
        h.append(av,nm);

        let m;
        if(p.kind==="video"){
          m=document.createElement("video"); m.src=mp4(p.url); m.controls=true; m.playsInline=true; m.preload="metadata";
        }else{
          m=document.createElement("img"); m.src=p.url; m.loading="lazy"; m.ondblclick=()=>toggleReelLike(p.id);
        }
        m.className="pMedia";

        const act=document.createElement("div"); act.className="pAct";
        const like=actBtn("",()=>toggleReelLike(p.id)); like.className="rLike"; like.dataset.id=p.id;
        act.append(like,cmButton(p.id),
          actBtn("➤",()=>shareToChat(p.kind==="video"?{type:"video",url:mp4(p.url),text:""}:{type:"image",url:p.url,text:""})),
          dlLink(p.url));
        if(p.uid===myUid){
          const del=actBtn("🗑️",()=>{ if(confirm("Delete this post?")) deleteDoc(doc(db,"posts",p.id)).catch(e=>alert("Delete failed: "+e.code)); });
          del.style.marginLeft="auto"; act.appendChild(del);
        }
        c.append(h,m,act);
        if(p.caption){
          const cp=document.createElement("div"); cp.className="pCap";
          const b=document.createElement("b"); b.textContent=(p.name||"")+" ";
          cp.append(b,document.createTextNode(p.caption)); c.appendChild(cp);
        }
        feed.appendChild(c);
      });
      updateReelLikes(); updateCmCounts();
    }

    // comments
    function openComments(id){ cmTarget=id; $("cmSheet").hidden=false; drawComments(); }
    function drawComments(){
      const box=$("cmList"); box.innerHTML="";
      const arr=comments[cmTarget]||[];
      if(!arr.length){ box.innerHTML='<div class="cmEmpty">No comments yet</div>'; return; }
      arr.forEach(c=>{
        const row=document.createElement("div"); row.className="cm";
        const b=document.createElement("b"); b.textContent=c.name||"";
        const t=document.createElement("span"); t.textContent=c.text||"";
        row.append(b,t);
        if(c.uid===myUid) row.appendChild(actBtn("✕",()=>deleteDoc(doc(db,"comments",c.id)).catch(()=>{})));
        box.appendChild(row);
      });
      box.scrollTop=box.scrollHeight;
    }
    function updateCmCounts(){
      document.querySelectorAll(".cmBtn").forEach(b=>{ b.textContent="💬 "+(comments[b.dataset.id]||[]).length; });
    }
    async function sendComment(){
      const t=$("cmInput").value.trim();
      if(!t||!cmTarget||!myUid) return;
      $("cmInput").value="";
      try{ await addDoc(collection(db,"comments"),{targetId:cmTarget,text:t.slice(0,300),name:myName,uid:myUid,createdAt:serverTimestamp()}); }
      catch(e){ alert("Comment failed: "+e.code); }
    }
    $("cmSend").onclick=sendComment;
    $("cmInput").addEventListener("keydown",e=>{ if(e.key==="Enter") sendComment(); });
    $("cmClose").onclick=()=>{ $("cmSheet").hidden=true; cmTarget=null; };

    // posts upload
    $("postsBtn").onclick=()=>{ $("posts").hidden=false; drawPosts(); };
    $("postBack").onclick=()=>{ $("posts").hidden=true; };
    $("postAdd").onclick=()=>$("postInput").click();
    $("postInput").onchange=async e=>{
      const f=e.target.files[0]; e.target.value="";
      if(!f||!myUid) return;
      const isV=f.type.startsWith("video/");
      if(!isV&&!f.type.startsWith("image/")){ alert("Please choose a photo or video"); return; }
      if(f.size>MAX_MB*1024*1024){ alert("File is larger than "+MAX_MB+" MB."); return; }
      const cap=prompt("Caption (leave empty for none)")||"";
      $("postAdd").style.opacity=.4;
      try{
        const url=await cloudUpload(f);
        await addDoc(collection(db,"posts"),{url,kind:isV?"video":"image",caption:cap.slice(0,200),name:myName,uid:myUid,createdAt:serverTimestamp()});
        toast("Post added ✅");
      }catch(err){ alert("Post failed: "+(err.message||err)); }
      $("postAdd").style.opacity=1;
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
      if(!confirm("⚠️ All messages will be deleted for everyone, permanently. Continue?")) return;
      if(!confirm("Really delete? This cannot be undone.")) return;
      try{
        const snapshot=await getDocs(collection(db,"messages"));
        await Promise.all(snapshot.docs.map(d=>deleteDoc(doc(db,"messages",d.id))));
      }catch(e){ alert("Clear failed: "+e.code); }
    };

    /* ================= DELETE ALL ================= */
    deleteAllBtn.onclick=async()=>{
      if(!myUid)return;
      if(!confirm("Delete all your messages?"))return;
      try{
        const q=query(collection(db,"messages"),where("uid","==",myUid));
        const snapshot=await getDocs(q);
        await Promise.all(snapshot.docs.map(d=>deleteDoc(doc(db,"messages",d.id))));
        alert("All your messages deleted ❤️");
      }catch(e){ alert("Delete All failed: "+e.code); }
    };
  
