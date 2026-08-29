// GALERI SEJARAH BERHARGA DAN INDAH — E2EE CLIENT SIDE
// Isi URL + PUBLISHABLE KEY dari Supabase. Jangan gunakan secret/service_role.
const SUPABASE_URL="PASTE_SUPABASE_URL_DI_SINI";
const SUPABASE_PUBLISHABLE_KEY="PASTE_SUPABASE_PUBLISHABLE_KEY_DI_SINI";
const BUCKET="galeri";

const LOGIN_EMAIL="GALERI SEJARAH BERHARGA DAN INDAH";
const LOGIN_PASSWORD="Sejarah123";

const $=id=>document.getElementById(id);
const loginPage=$("loginPage"),galleryPage=$("galleryPage"),gallery=$("gallery"),countLabel=$("countLabel"),loading=$("loading"),loadingText=$("loadingText");
let supabaseClient=null, cryptoKey=null, editingNoteId=null, noteImageFile=null;

function configured(){return SUPABASE_URL.startsWith("https://")&&!SUPABASE_URL.includes("PASTE_")&&!SUPABASE_PUBLISHABLE_KEY.includes("PASTE_")}
function initSupabase(){if(!configured())return false;supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);return true}
function showConfigError(){alert("Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di script.js.")}
function setLoading(show,text="Memproses..."){loading.style.display=show?"grid":"none";loadingText.textContent=text}

$("togglePassword").onclick=()=>{const p=$("password");p.type=p.type==="password"?"text":"password"};

async function deriveKey(password){
 const enc=new TextEncoder(), base=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt:enc.encode("ANDRI-GALERI-E2EE-v1"),iterations:250000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function bytesToB64(bytes){let s="";for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function b64ToBytes(b64){const s=atob(b64),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
async function encryptBytes(data){
 const iv=crypto.getRandomValues(new Uint8Array(12)), ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},cryptoKey,data));
 const out=new Uint8Array(12+ct.length);out.set(iv);out.set(ct,12);return out;
}
async function decryptBytes(data){
 const iv=data.slice(0,12),ct=data.slice(12);
 return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv},cryptoKey,ct));
}
async function encryptText(text){return bytesToB64(await encryptBytes(new TextEncoder().encode(text)))}
async function decryptText(b64){return new TextDecoder().decode(await decryptBytes(b64ToBytes(b64)))}
function safeName(name){return (name||"file").toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||"file"}
function extOf(name){return (name.match(/\.[^/.]+$/)||[""])[0].toLowerCase()}
function path(){return crypto.randomUUID()+".bin"}

$("loginForm").onsubmit=async e=>{
 e.preventDefault();const u=$("email").value.trim(),p=$("password").value;
 if(u!==LOGIN_EMAIL||p!==LOGIN_PASSWORD){$("errorMessage").style.display="block";return}
 if(!configured()){showConfigError();return}
 try{
  setLoading(true,"Menyiapkan enkripsi...");
  cryptoKey=await deriveKey(p);initSupabase();
  localStorage.setItem("andri_login","1");localStorage.setItem("andri_key_session","1");
  loginPage.style.display="none";galleryPage.style.display="block";await loadAll();
 }catch(err){console.error(err);alert("Gagal membuka arsip. Pastikan kunci benar.");}
 finally{setLoading(false)}
};
$("logoutBtn").onclick=()=>{localStorage.removeItem("andri_login");localStorage.removeItem("andri_key_session");cryptoKey=null;galleryPage.style.display="none";loginPage.style.display="grid";$("password").value=""};

async function uploadEncrypted(file,title,type){
 if(file.size>50*1024*1024){alert(`${file.name} lebih dari 50 MB.`);return null}
 const encrypted=await encryptBytes(new Uint8Array(await file.arrayBuffer()));
 const storagePath=path();
 const {error}=await supabaseClient.storage.from(BUCKET).upload(storagePath,encrypted,{contentType:"application/octet-stream",upsert:false,cacheControl:"3600"});
 if(error)throw error;
 const encryptedTitle=await encryptText(title||file.name);
 const {data,error:dbError}=await supabaseClient.from("gallery_media").insert({title_encrypted:encryptedTitle,path:storagePath,type,original_name_encrypted:await encryptText(file.name),mime_type:file.type||"application/octet-stream"}).select().single();
 if(dbError)throw dbError;
 return data;
}
async function addFiles(files,type){
 if(!cryptoKey){alert("Silakan masuk terlebih dahulu.");return}
 for(const file of files){
  const title=prompt(`Nama/judul ${type==="audio"?"musik":type==="file"?"file":type}:`,file.name.replace(/\.[^/.]+$/," "));
  if(title===null)continue;
  try{setLoading(true,`Mengenkripsi ${file.name}...`);await uploadEncrypted(file,title,type)}catch(err){console.error(err);alert("Upload gagal: "+err.message)}
 }
 setLoading(false);await loadGallery();
}
$("photoInput").onchange=e=>{addFiles([...e.target.files],"image");e.target.value=""};
$("videoInput").onchange=e=>{addFiles([...e.target.files],"video");e.target.value=""};
$("musicInput").onchange=e=>{addFiles([...e.target.files],"audio");e.target.value=""};
$("fileInput").onchange=e=>{addFiles([...e.target.files],"file");e.target.value=""};

async function loadGallery(){
 const {data:items,error}=await supabaseClient.from("gallery_media").select("*").order("uploaded_at",{ascending:false});
 if(error){gallery.innerHTML=`<div class="empty"><strong>Arsip belum siap</strong>${error.message}</div>`;return}
 gallery.innerHTML="";countLabel.textContent=`${items.length} item`;
 if(!items.length){gallery.innerHTML='<div class="empty"><strong>Belum ada file</strong>Tambahkan foto, video, musik, atau file.</div>';return}
 for(const item of items){
  const card=document.createElement("article");card.className="card";
  const media=document.createElement("div");media.className="media";media.innerHTML='<div class="decrypting">🔐 Memuat terenkripsi...</div>';
  const info=document.createElement("div");info.className="info";
  const name=document.createElement("div");name.className="name";name.textContent="File terenkripsi";
  const meta=document.createElement("div");meta.className="meta";meta.textContent=typeIcon(item.type)+" • "+new Date(item.uploaded_at).toLocaleString("id-ID");
  info.append(name,meta);
  const actions=document.createElement("div");actions.className="actions";
  const dl=document.createElement("button");dl.className="download";dl.textContent="⬇ Simpan";
  actions.append(dl);card.append(media,info,actions);gallery.appendChild(card);
  try{
   const {data:signed,error:sErr}=await supabaseClient.storage.from(BUCKET).createSignedUrl(item.path,600);
   if(sErr)throw sErr;
   const response=await fetch(signed.signedUrl);if(!response.ok)throw new Error("File tidak dapat diambil");
   const plain=await decryptBytes(new Uint8Array(await response.arrayBuffer()));
   const blob=new Blob([plain],{type:item.mime_type||guessMime(item.type)});
   const url=URL.createObjectURL(blob);
   name.textContent=await decryptText(item.title_encrypted);
   renderMedia(media,url,item,blob);
   dl.onclick=()=>saveBlob(blob,name.textContent,item.mime_type||guessMime(item.type));
  }catch(err){console.error(err);media.innerHTML='<div class="decrypting">🔒 Tidak bisa didekripsi</div>';dl.disabled=true}
 }
}
function typeIcon(t){return {image:"📷 Foto",video:"🎬 Video",audio:"🎵 Musik",file:"📁 File"}[t]||"📁 File"}
function guessMime(t){return {image:"image/*",video:"video/*",audio:"audio/*"}[t]||"application/octet-stream"}
function renderMedia(el,url,item,blob){
 el.innerHTML="";
 if(item.type==="image"){const img=document.createElement("img");img.src=url;img.alt="Kenangan";el.append(img)}
 else if(item.type==="video"){const v=document.createElement("video");v.controls=true;v.preload="metadata";v.src=url;el.append(v)}
 else if(item.type==="audio"){const box=document.createElement("div");box.className="audio-box";box.innerHTML="🎵";const a=document.createElement("audio");a.controls=true;a.src=url;box.append(a);el.append(box)}
 else {el.innerHTML='<div class="file-box">📁<br><span>FILE TERENKRIPSI</span></div>'}
}
function saveBlob(blob,name,mime){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=safeName(name||"file")+(extOf(name||"")?"":extensionFromMime(mime));document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
function extensionFromMime(m){const map={"image/jpeg":".jpg","image/png":".png","image/webp":".webp","audio/mpeg":".mp3","audio/wav":".wav","video/mp4":".mp4","application/pdf":".pdf","text/plain":".txt"};return map[m]||".bin"}

const galleryTab=$("galleryTab"),notesTab=$("notesTab"),gallerySection=$("gallerySection"),notesSection=$("notesSection"),noteEditor=$("noteEditor"),notesList=$("notesList");
galleryTab.onclick=()=>{galleryTab.classList.add("active");notesTab.classList.remove("active");gallerySection.style.display="block";notesSection.style.display="none"};
notesTab.onclick=()=>{notesTab.classList.add("active");galleryTab.classList.remove("active");gallerySection.style.display="none";notesSection.style.display="block";loadNotes()};
$("newNoteBtn").onclick=()=>{editingNoteId=null;noteImageFile=null;$("noteTitle").value="";$("noteText").value="";$("noteImageInput").value="";$("noteImagePreview").innerHTML="";noteEditor.style.display="block";$("noteText").focus()};
$("cancelNoteBtn").onclick=()=>{noteEditor.style.display="none";editingNoteId=null;noteImageFile=null};
$("noteImageInput").onchange=e=>{noteImageFile=e.target.files[0]||null;const p=$("noteImagePreview");p.innerHTML="";if(noteImageFile){const img=document.createElement("img");img.src=URL.createObjectURL(noteImageFile);p.append(img)}};

async function saveNote(){
 const title=$("noteTitle").value.trim()||"Catatan Tanpa Judul",text=$("noteText").value.trim();
 if(!text){alert("Isi catatan terlebih dahulu.");return}
 try{
  setLoading(true,"Mengenkripsi catatan...");
  let imagePath=null;
  if(noteImageFile){
   if(noteImageFile.size>50*1024*1024)throw new Error("Gambar lebih dari 50 MB.");
   const enc=await encryptBytes(new Uint8Array(await noteImageFile.arrayBuffer()));imagePath=path();
   const {error}=await supabaseClient.storage.from(BUCKET).upload(imagePath,enc,{contentType:"application/octet-stream",upsert:false});
   if(error)throw error;
  }
  const payload={title_encrypted:await encryptText(title),text_encrypted:await encryptText(text),image_path:imagePath};
  if(editingNoteId){
   const {error}=await supabaseClient.from("gallery_notes").update(payload).eq("id",editingNoteId);if(error)throw error;
  }else{
   const {error}=await supabaseClient.from("gallery_notes").insert(payload);if(error)throw error;
  }
  noteEditor.style.display="none";editingNoteId=null;noteImageFile=null;await loadNotes();
 }catch(err){console.error(err);alert("Catatan gagal disimpan: "+err.message)}
 finally{setLoading(false)}
}
$("saveNoteBtn").onclick=saveNote;

async function loadNotes(){
 const {data:notes,error}=await supabaseClient.from("gallery_notes").select("*").order("updated_at",{ascending:false});
 notesList.innerHTML="";
 if(error){notesList.innerHTML=`<div class="empty"><strong>Catatan belum siap</strong>${error.message}</div>`;return}
 if(!notes.length){notesList.innerHTML='<div class="no-notes">📝<br><br>Belum ada catatan.<br>Tekan “Catatan Baru”.</div>';return}
 for(const n of notes){
  const card=document.createElement("article");card.className="note-card";
  if(n.image_path){
   try{
    const {data:s}=await supabaseClient.storage.from(BUCKET).createSignedUrl(n.image_path,600);const r=await fetch(s.signedUrl);const plain=await decryptBytes(new Uint8Array(await r.arrayBuffer()));const url=URL.createObjectURL(new Blob([plain],{type:"image/*"}));const img=document.createElement("img");img.className="note-img";img.src=url;card.append(img)
   }catch(e){}
  }
  const title=document.createElement("div");title.className="note-title";title.textContent=await decryptText(n.title_encrypted);
  const body=document.createElement("div");body.className="note-body";body.textContent=await decryptText(n.text_encrypted);
  const time=document.createElement("div");time.className="note-time";time.textContent="🕐 "+new Date(n.updated_at).toLocaleString("id-ID");
  const actions=document.createElement("div");actions.className="note-actions";
  const edit=document.createElement("button");edit.textContent="✏️ Edit";edit.onclick=()=>editNote(n);
  const del=document.createElement("button");del.textContent="🗑️ Hapus";del.onclick=()=>deleteNote(n.id);
  actions.append(edit,del);card.append(title,body,time,actions);notesList.append(card)
 }
}
async function editNote(n){
 editingNoteId=n.id;noteImageFile=null;$("noteTitle").value=await decryptText(n.title_encrypted);$("noteText").value=await decryptText(n.text_encrypted);$("noteImageInput").value="";$("noteImagePreview").innerHTML="";noteEditor.style.display="block";$("noteText").focus()
}
async function deleteNote(id){
 if(!confirm("Hapus catatan ini?"))return;
 const {error}=await supabaseClient.from("gallery_notes").delete().eq("id",id);
 if(error)alert(error.message);else loadNotes()
}
function updateClock(){$("clock").textContent=new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
setInterval(updateClock,1000);updateClock();

window.addEventListener("load",async()=>{
 if(localStorage.getItem("andri_login")==="1"&&configured()){
  try{cryptoKey=await deriveKey(LOGIN_PASSWORD);initSupabase();loginPage.style.display="none";galleryPage.style.display="block";await loadAll()}catch(e){console.error(e);localStorage.removeItem("andri_login")}
 }
});
async function loadAll(){await loadGallery();if(notesSection.style.display!=="none")await loadNotes()}
