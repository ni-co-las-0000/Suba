// Manejo del arreglo de elementos: {type: "audio"|"tts", filename, displayText}
const list = [];
const listEl = document.getElementById("elementsList");
const fileInput = document.getElementById("fileInput");
const playerArea = document.getElementById("playerArea");
let audioPlayer = null;

function renderList(){
  listEl.innerHTML = "";
  list.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex align-items-center justify-content-between";
    li.innerHTML = `
      <div>
        <strong>${item.type === "tts" ? "🗣️ Texto" : "🎧 Audio"}</strong>
        <div class="small text-muted">${item.displayText}</div>
      </div>
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-secondary" onclick="moveUp(${idx})">↑</button>
        <button class="btn btn-outline-secondary" onclick="moveDown(${idx})">↓</button>
        <button class="btn btn-outline-secondary" onclick="editItem(${idx})">Editar</button>
        <button class="btn btn-danger" onclick="deleteItem(${idx})">Eliminar</button>
      </div>
    `;
    listEl.appendChild(li);
  });
}

function addTextItem(text, filename){
  list.push({type:"tts", filename:filename, displayText: text});
  renderList();
}

function addAudioItem(origName, filename){
  list.push({type:"audio", filename:filename, displayText: origName});
  renderList();
}

document.getElementById("btnAddText").addEventListener("click", ()=>{
  const text = prompt("Escribe el texto que quieres convertir a voz:");
  if(!text) return;
  fetch("/create_tts", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({text: text})
  }).then(r=>r.json())
  .then(data=>{
    if(data.filename){
      addTextItem(text, data.filename);
    } else {
      alert("Error al crear TTS");
    }
  });
});

fileInput.addEventListener("change", ()=>{
  const f = fileInput.files[0];
  if(!f) return;
  const form = new FormData();
  form.append("file", f);
  fetch("/upload", {method:"POST", body: form})
    .then(r=>r.json())
    .then(data=>{
      if(data.filename){
        addAudioItem(f.name, data.filename);
      } else {
        alert("Error al subir archivo");
      }
      fileInput.value = "";
    });
});

function moveUp(i){
  if(i<=0) return;
  const a = list.splice(i,1)[0];
  list.splice(i-1,0,a);
  renderList();
}
function moveDown(i){
  if(i>=list.length-1) return;
  const a = list.splice(i,1)[0];
  list.splice(i+1,0,a);
  renderList();
}
function deleteItem(i){
  if(!confirm("Eliminar elemento?")) return;
  list.splice(i,1);
  renderList();
}
function editItem(i){
  const item = list[i];
  if(item.type === "tts"){
    const newText = prompt("Editar texto:", item.displayText);
    if(!newText) return;
    // regenerate TTS
    fetch("/create_tts", {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({text: newText})
    }).then(r=>r.json()).then(data=>{
      if(data.filename){
        item.filename = data.filename;
        item.displayText = newText;
        renderList();
      } else alert("Error al regenerar TTS");
    });
  } else {
    alert("Para editar un audio subido, elimínalo y sube uno nuevo.");
  }
}

document.getElementById("btnClear").addEventListener("click", ()=>{
  if(confirm("Limpiar lista?")){ list.length=0; renderList(); }
});

let playing = false;
document.getElementById("btnPreview").addEventListener("click", async ()=>{
  if(list.length===0) return alert("La lista está vacía.");
  // Compose on server for preview
  const resp = await fetch("/compose", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({items: list})});
  const data = await resp.json();
  if(data && data.url){
    playUrl(data.url);
  } else {
    alert("Error al componer audio para preview");
  }
});

document.getElementById("btnCompose").addEventListener("click", async ()=>{
  if(list.length===0) return alert("La lista está vacía.");
  const resp = await fetch("/compose", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({items: list})});
  const data = await resp.json();
  if(data && data.url){
    // show download link
    playerArea.innerHTML = `<audio controls class="w-100" src="${data.url}"></audio>
    <div class="mt-2"><a class="btn btn-outline-primary" href="/download/${data.filename}">Descargar MP3</a></div>`;
    window.scrollTo(0, document.body.scrollHeight);
  } else {
    alert("Error al exportar");
  }
});

document.getElementById("btnStop").addEventListener("click", ()=>{
  if(audioPlayer){ audioPlayer.pause(); audioPlayer = null; playing=false; }
});

function playUrl(url){
  if(audioPlayer){ audioPlayer.pause(); audioPlayer = null; }
  audioPlayer = new Audio(url);
  audioPlayer.play();
  playing = true;
  audioPlayer.onended = ()=>{ playing=false; audioPlayer=null; };
}

renderList();
