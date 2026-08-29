const LOGIN_EMAIL="GALERI SEJARAH BERHARGA DAN INDAH";
const LOGIN_PASSWORD="Sejarah123";

const loginPage=document.getElementById("loginPage");
const galleryPage=document.getElementById("galleryPage");
const gallery=document.getElementById("gallery");
const countLabel=document.getElementById("countLabel");
const loading=document.getElementById("loading");

const DB_NAME="GaleriSejarahAndriDB";
const STORE="media";

function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:"id"});
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
async function getAll(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly"),q=tx.objectStore(STORE).getAll();
  q.onsuccess=()=>{db.close();resolve(q.result)};
  q.onerror=()=>{db.close();reject(q.error)};
 });
}
async function put(item){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(item);
  tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
async function remove(id){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);
  tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};
 });
}

document.getElementById("togglePassword").onclick=()=>{
 const p=document.getElementById("password");
 p.type=p.type==="password"?"text":"password";
};

document.getElementById("loginForm").onsubmit=e=>{
 e.preventDefault();
 const email=document.getElementById("email").value.trim();
 const password=document.getElementById("password").value;
 if(email===LOGIN_EMAIL&&password===LOGIN_PASSWORD){
  document.getElementById("errorMessage").style.display="none";
  loading.style.display="grid";
  setTimeout(()=>{loading.style.display="none";loginPage.style.display="none";galleryPage.style.display="block";localStorage.setItem("andri_login","1");loadGallery()},800);
 }else{
  document.getElementById("errorMessage").style.display="block";
  document.querySelector(".login-card").animate([{transform:"translateX(-8px)"},{transform:"translateX(8px)"},{transform:"translateX(0)"}],{duration:260});
 }
};

document.getElementById("logoutBtn").onclick=()=>{
 localStorage.removeItem("andri_login");
 galleryPage.style.display="none";loginPage.style.display="grid";
};

async function addFiles(files,type){
 for(const file of files){
  if(!file.type.startsWith(type+"/"))continue;
  const now=new Date();
  const defaultName=file.name.replace(/\.[^/.]+$/,"").replace(/[_-]/g," ");
  const name=prompt("Nama/judul "+(type==="video"?"video":"foto")+":",defaultName);
  if(name===null)continue;
  await put({
   id:crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random(),
   name:name||defaultName,type,blob:file,
   date:now.toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"}),
   time:now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),
   uploadedAt:now.toISOString()
  });
 }
 await loadGallery();
}

document.getElementById("photoInput").onchange=async e=>{await addFiles([...e.target.files],"image");e.target.value=""};
document.getElementById("videoInput").onchange=async e=>{await addFiles([...e.target.files],"video");e.target.value=""};

async function loadGallery(){
 const items=(await getAll()).sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
 gallery.innerHTML="";
 countLabel.textContent=items.length+" kenangan";
 if(!items.length){
  gallery.innerHTML='<div class="empty"><strong>Belum ada kenangan</strong>Upload foto atau video pertamamu.</div>';
  return;
 }
 for(const item of items){
  const card=document.createElement("article");
  card.className="card";
  const media=document.createElement("div");media.className="media";
  const info=document.createElement("div");info.className="info";
  const name=document.createElement("div");name.className="name";name.textContent=item.name;
  const meta=document.createElement("div");meta.className="meta";meta.textContent=(item.type==="video"?"🎬 Video":"📷 Foto")+"  •  "+item.date+"  •  "+item.time;
  info.append(name,meta);
  const actions=document.createElement("div");actions.className="actions";
  const dl=document.createElement("button");dl.className="download";dl.textContent="⬇ Download";
  const del=document.createElement("button");del.className="delete";del.textContent="Hapus";
  actions.append(dl,del);card.append(media,info,actions);gallery.appendChild(card);
  const url=URL.createObjectURL(item.blob);
  if(item.type==="video"){const v=document.createElement("video");v.controls=true;v.preload="metadata";v.src=url;media.appendChild(v)}
  else{const img=document.createElement("img");img.src=url;img.alt=item.name;media.appendChild(img)}
  dl.onclick=()=>download(item);
  del.onclick=async()=>{if(confirm("Hapus kenangan ini?")){await remove(item.id);URL.revokeObjectURL(url);loadGallery()}};
 }
}

function download(item){
 const url=URL.createObjectURL(item.blob),a=document.createElement("a");
 a.href=url;a.download=(item.name||"kenangan").replace(/[\\/:*?"<>|]/g,"-")+"."+(item.type==="video"?"mp4":"jpg");
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function updateClock(){
 document.getElementById("clock").textContent=new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}
setInterval(updateClock,1000);updateClock();

window.addEventListener("load",()=>{if(localStorage.getItem("andri_login")==="1"){loginPage.style.display="none";galleryPage.style.display="block";loadGallery()}});
