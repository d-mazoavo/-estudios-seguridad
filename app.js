(() => {
'use strict';

/* =====================================================================
   Constantes del dominio
   ===================================================================== */
const APP_ID = 'AVOPAK-DSI-ESTUDIOS';
const SCHEMA = 1;
const KDF_ITER = 600000;
const VINCULOS = ['Trabajador Avo Pak','Personal de finca','Contratista','Aspirante'];
const ESTADOS_P = ['Activo','En selección','Retirado'];
const TIPOS_DOC = ['CC','CE','PPT','PEP','PA','Otro'];
const RESULTADOS = ['Sin registro','Con registro','No concluyente'];
const TIPOS_AUT = ['General de tratamiento de datos','Específica de visita domiciliaria'];
const TIPOS_EST = ['Ingreso','Actualización periódica','Por causa'];
const ESTADOS_EST = ['Programado','Realizado','No realizado','Anulado'];
const MOTIVOS_NR = ['Negativa del titular','Titular no ubicado','Reprogramado','Otro'];
const CONCEPTOS = ['Favorable','Favorable con observaciones','No favorable','Inconcluso'];
const CHECK_RES = ['Conforme','Con observación','No verificado','No aplica'];
const FUENTES_INFO = [
  {k:'observacion', t:'Observación directa del ejecutor', n:'Instrumental'},
  {k:'entrevista', t:'Entrevista al titular', n:'Testimonial'},
  {k:'documentos', t:'Documentos exhibidos por el titular', n:'Documental'},
  {k:'consultas', t:'Consultas en fuentes públicas', n:'Documental'},
  {k:'referencias', t:'Referencias de terceros autorizadas por el titular', n:'Testimonial'}
];
const CHECKLIST = [
  {k:'identidad', t:'Identidad verificada con documento original'},
  {k:'residencia', t:'Residencia coincide con la reportada a la compañía', visita:true},
  {k:'permanencia', t:'Tiempo de residencia en el inmueble', visita:true, kind:'text'},
  {k:'tenencia', t:'Tenencia del inmueble', visita:true, kind:'select', opts:['Propia','Arrendada','Familiar','Otra','No informada']},
  {k:'hogar', t:'Personas que conforman el hogar (solo la cifra)', visita:true, kind:'number'},
  {k:'coherencia', t:'Coherencia aparente entre ingresos y nivel de vida'},
  {k:'vulnerabilidad', t:'Factores de vulnerabilidad frente a coacción o extorsión'},
  {k:'entorno', t:'Condiciones de seguridad del entorno de la vivienda', visita:true},
  {k:'referencias', t:'Referencias verificadas con autorización del titular'}
];
const MOTIVOS_SUP = ['Vencimiento del plazo de conservación','Solicitud de supresión del titular','Registro creado por error','Otro'];
const STATUS_RANK = {bad:3, warn:2, ok:1, na:0};
const GLYPH = {ok:'✓', warn:'!', bad:'✕', na:'–'};

function defaultDB(op){
  return {
    meta:{app:APP_ID, schema:SCHEMA, creado:nowISO(), seq:{persona:0, estudio:{}, informe:{}}, ultimoRespaldo:null},
    config:{
      operador:{nombre:op.nombre, cargo:op.cargo},
      empresas:['Avo Pak S.A.S.','Unión Hass','Santa Catalina Hass','Hass Paradise'],
      fuentes:[
        {id:'f1', nombre:'Policía Nacional: antecedentes judiciales', obligatoria:true, activa:true},
        {id:'f2', nombre:'Procuraduría General de la Nación: antecedentes disciplinarios', obligatoria:true, activa:true},
        {id:'f3', nombre:'Contraloría General de la República: responsabilidad fiscal', obligatoria:true, activa:true},
        {id:'f4', nombre:'Policía Nacional: Registro Nacional de Medidas Correctivas', obligatoria:false, activa:true},
        {id:'f5', nombre:'Rama Judicial: consulta de procesos', obligatoria:false, activa:true},
        {id:'f6', nombre:'Plataforma Inspektor: listas restrictivas', obligatoria:false, activa:true}
      ],
      periodicidad:{critico:{antecedentes:12, visita:24}, general:{antecedentes:24, visita:0}},
      diasAlerta:30,
      retencionAnios:3,
      autoBloqueoMin:10,
      prefijoInforme:'DSI-INF-ESP',
      valoraciones:['Sin incidencia en el cargo','Requiere análisis','Incidencia relevante para el cargo'],
      fundamento:'Estudio practicado con autorización previa, expresa e informada del titular, en los términos de la Ley 1581 de 2012 y sus normas reglamentarias, como parte de los controles de seguridad del personal en cargos críticos del sistema de gestión de seguridad de la cadena de suministro de Avo Pak S.A.S.',
      advertencia:'Documento de reserva. Contiene datos personales tratados con la finalidad exclusiva de gestionar la seguridad del personal y de la cadena de suministro de Avo Pak S.A.S. Su acceso y circulación están restringidos a quien tenga competencia para conocerlo (artículo 4, literal f, Ley 1581 de 2012). Puede servir de soporte a actuaciones administrativas, disciplinarias o judiciales.',
      logo:null
    },
    personas:[], autorizaciones:[], consultas:[], hallazgos:[], estudios:[], bitacora:[]
  };
}

/* =====================================================================
   Utilidades
   ===================================================================== */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const nf = new Intl.NumberFormat('es-CO');
const fmtN = n => nf.format(n);
const pct = (a,b) => b ? Math.round(a*100/b) : 0;
function nowISO(){ return new Date().toISOString(); }
function today(){ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtD(iso){ if(!iso) return ''; const [y,m,d]=iso.slice(0,10).split('-'); return `${d}/${m}/${y}`; }
function fmtDT(iso){ if(!iso) return ''; const d=new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function addMonths(iso, n){ const [y,m,d]=iso.split('-').map(Number); const first=new Date(y, m-1+n, 1); const last=new Date(first.getFullYear(), first.getMonth()+1, 0).getDate(); return `${first.getFullYear()}-${pad(first.getMonth()+1)}-${pad(Math.min(d,last))}`; }
function daysUntil(iso){ const [y,m,d]=iso.split('-').map(Number); const t=today().split('-').map(Number); return Math.round((Date.UTC(y,m-1,d)-Date.UTC(t[0],t[1]-1,t[2]))/86400000); }
function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')); }
function norm(s){ return String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim(); }
function canon(o){ if(o===null||typeof o!=='object') return JSON.stringify(o); if(Array.isArray(o)) return '['+o.map(canon).join(',')+']'; return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}'; }
function opts(list, sel, empty){ return (empty!==undefined?`<option value="">${esc(empty)}</option>`:'') + list.map(v=>{ const val=typeof v==='object'?v.v:v, lab=typeof v==='object'?v.t:v; return `<option value="${esc(val)}"${String(val)===String(sel??'')?' selected':''}>${esc(lab)}</option>`; }).join(''); }
function parseDateLoose(s){
  s=String(s??'').trim(); if(!s) return null;
  let m;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  if((m=s.match(/^(\d{5})$/))){ const d=new Date(Date.UTC(1899,11,30)+(+m[1])*86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; }
  return null;
}
function validISO(iso){ if(!iso) return false; const [y,m,d]=iso.split('-').map(Number); const dt=new Date(y,m-1,d); return dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d; }

/* ---------- Cifrado ---------- */
const TE = new TextEncoder(), TD = new TextDecoder();
function b64(buf){ const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s=''; for(let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000)); return btoa(s); }
function unb64(str){ const bin=atob(str); const out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; }
async function deriveKey(pass, salt, iter){
  const base = await crypto.subtle.importKey('raw', TE.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:iter, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
async function seal(obj, key, salt, iter){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, TE.encode(JSON.stringify(obj)));
  return {app:APP_ID, fmt:1, kdf:'PBKDF2-SHA256', cipher:'AES-256-GCM', iter, salt:b64(salt), iv:b64(iv), ct:b64(ct), saved:nowISO()};
}
async function openEnvelope(env, pass){
  if(!env || env.app!==APP_ID || !env.ct) throw new Error('El archivo no corresponde a un respaldo de esta aplicación.');
  const salt=unb64(env.salt); const key=await deriveKey(pass, salt, env.iter);
  let plain;
  try{ plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(env.iv)}, key, unb64(env.ct)); }
  catch(e){ throw new Error('Contraseña incorrecta.'); }
  return {db:JSON.parse(TD.decode(plain)), key, salt, iter:env.iter};
}
async function sha256Hex(str){ const h=await crypto.subtle.digest('SHA-256', TE.encode(str)); return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join(''); }

/* ---------- Almacenamiento local (IndexedDB con respaldo en localStorage) ---------- */
const Store = {
  db:null, mode:'idb',
  async init(){
    try{
      this.db = await new Promise((res,rej)=>{ const r=indexedDB.open('avopak-dsi-estudios',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
    }catch(e){ this.mode='ls'; }
  },
  async get(k){
    if(this.mode==='ls'){ const v=localStorage.getItem('avopak-dsi-'+k); return v?JSON.parse(v):null; }
    return new Promise((res,rej)=>{ const t=this.db.transaction('kv','readonly').objectStore('kv').get(k); t.onsuccess=()=>res(t.result??null); t.onerror=()=>rej(t.error); });
  },
  async set(k,v){
    if(this.mode==='ls'){ localStorage.setItem('avopak-dsi-'+k, JSON.stringify(v)); return; }
    return new Promise((res,rej)=>{ const tx=this.db.transaction('kv','readwrite'); tx.objectStore('kv').put(v,k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); });
  },
  async del(k){
    if(this.mode==='ls'){ localStorage.removeItem('avopak-dsi-'+k); return; }
    return new Promise((res,rej)=>{ const tx=this.db.transaction('kv','readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); });
  }
};

/* =====================================================================
   Estado de sesión
   ===================================================================== */
const S = {
  db:null, key:null, salt:null, iter:KDF_ITER,
  saveTimer:null, savePromise:Promise.resolve(), dirty:false,
  lastAct:Date.now(), idx:null, cumpl:new Map(), listFn:null, estDirty:false, skipHash:false,
  ui:null
};
function freshUI(){
  return {
    tab:{anio:String(new Date().getFullYear())},
    personas:{q:'', vinculo:'', empresa:'', critico:'', estado:'vigentes', cumpl:'', limit:300, sel:new Set()},
    consultas:{q:'', fuente:'', resultado:'', desde:'', hasta:'', anuladas:false, limit:300},
    hallazgos:{q:'', estado:'Vigente', valoracion:'', fuente:'', limit:300},
    estudios:{q:'', estado:'', concepto:'', anio:'', visita:'', limit:300},
    venc:{asunto:'', estado:'', vinculo:'', empresa:'', critico:''},
    bitacora:{q:'', limit:300},
    ficha:{levantados:false}
  };
}
S.ui = freshUI();
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('avopak-dsi-estudios') : null;
const TAB_ID = uid();

function cfg(){ return S.db.config; }
function mutate(){ S.idx=null; S.cumpl.clear(); scheduleSave(); }
function scheduleSave(){ S.dirty=true; setSaveState('pending'); clearTimeout(S.saveTimer); S.saveTimer=setTimeout(()=>saveNow(), 350); }
function saveNow(){
  clearTimeout(S.saveTimer);
  S.savePromise = S.savePromise.then(async()=>{
    if(!Nube.dek || !S.db) return;
    await logChain;
    await guardarLocal();
    S.dirty=false; setSaveState();
    programarSync();
  }).catch(err=>{ S.dirty=false; Y.estado='error'; Y.error=err.message; setSaveState(); toast('No se pudo guardar en este equipo: '+err.message); });
  return S.savePromise;
}
function setSaveState(){
  const el=$('#savestate'); if(!el) return;
  let t, pend=true;
  if(S.dirty) t='Guardando…';
  else if(Y.estado==='sync') t='Sincronizando con la nube…';
  else if(Y.estado==='offline') t=`Sin conexión: ${Y.pendN?fmtN(Y.pendN)+' cambio(s) cifrado(s) en este equipo, se enviarán':'los cambios se enviarán'} al volver la conexión`;
  else if(Y.estado==='error') t='Error de sincronización: '+Y.error;
  else { pend=!!Y.pendN; t = Y.pendN ? `${fmtN(Y.pendN)} cambio(s) por enviar` : Y.ultima ? 'Sincronizado y cifrado a las '+Y.ultima : 'Datos cifrados'; }
  el.textContent=t; el.classList.toggle('pending', pend); el.classList.toggle('err', Y.estado==='error');
}

/* =====================================================================
   Sincronización cifrada con Firebase
   Cada persona, autorización, consulta, hallazgo y estudio es un documento cifrado; la configuración y los
   metadatos también. La copia de este equipo (cifrada con la misma llave) permite trabajar sin conexión.
   ===================================================================== */
const SYNC_COLS = ['personas','autorizaciones','consultas','hallazgos','estudios'];
const Y = { base:new Map(), lastPull:0, bitN:0, inicial:false, chain:Promise.resolve(), timer:null, poll:null, estado:'', error:'', ultima:'', pendN:0, progreso:null };
function resetY(){ clearTimeout(Y.timer); clearInterval(Y.poll); Object.assign(Y, {base:new Map(), lastPull:0, bitN:0, inicial:false, timer:null, poll:null, estado:'', error:'', ultima:'', pendN:0, progreso:null}); }
function docsActuales(){
  const m=new Map();
  m.set('config', ['config', S.db.config]); m.set('meta', ['meta', S.db.meta]);
  for(const c of SYNC_COLS) for(const r of S.db[c]) m.set(c+'_'+r.id, [c, r]);
  return m;
}
function pendientes(){
  const cur=docsActuales(), out=[];
  for(const [id,[c,o]] of cur){ const s=JSON.stringify(o); if(Y.base.get(id)!==s) out.push({id, c, o, s}); }
  for(const [id] of Y.base) if(!cur.has(id)) out.push({id, c:id.split('_')[0], del:true});
  return out;
}
async function guardarLocal(){
  const v=await Nube.cifrar('boveda-local', S.db);
  const pend=pendientes(); Y.pendN=pend.length + S.db.bitacora.filter(e=>e.n>Y.bitN).length;
  await Store.set('vault', {inst:Nube.inst.id, iv:v.iv, ct:v.ct, saved:nowISO()});
  await Store.set('sync', {inst:Nube.inst.id, lastPull:Y.lastPull, bitN:Y.bitN, pend:pend.map(x=>x.id)});
}
// Estado base a partir de la copia local: lo que no estaba pendiente se considera igual al servidor
function baseDesdeLocal(st){
  const pend=new Set(st.pend||[]), cur=docsActuales(); Y.base=new Map();
  for(const [id,[,o]] of cur) if(!pend.has(id)) Y.base.set(id, JSON.stringify(o));
  for(const id of pend) if(!cur.has(id)) Y.base.set(id, '§');
  Y.lastPull=st.lastPull||0; Y.bitN=st.bitN||0;
}
function programarSync(ms){ clearTimeout(Y.timer); Y.timer=setTimeout(()=>sincronizar(), ms==null?1500:ms); }
function sincronizar(){
  Y.chain = Y.chain.then(ciclo).catch(err=>{
    const red = err.code==='unavailable' || err.code==='timeout' || !navigator.onLine;
    Y.estado = red ? 'offline' : 'error'; Y.error = Nube.errorTexto(err); setSaveState();
    if(!red) console.error(err);
  });
  return Y.chain;
}
async function ciclo(){
  if(!S.db || !Nube.dek) return;
  if(!navigator.onLine){ Y.estado='offline'; setSaveState(); return; }
  Y.estado='sync'; setSaveState();
  await traer();
  await enviar();
  Y.estado=''; Y.error=''; Y.ultima=new Date().toTimeString().slice(0,5);
  if(S.db) await guardarLocal();
  setSaveState(); updateBackupState();
}
function poner(id, c, o){
  if(c==='config'){ S.db.config=o; return; }
  if(c==='meta'){
    const loc=S.db.meta.seq||{}; const sq=o.seq=o.seq||{persona:0, estudio:{}, informe:{}};
    sq.persona=Math.max(sq.persona||0, loc.persona||0);
    for(const k of ['estudio','informe']){ sq[k]=sq[k]||{}; for(const y in (loc[k]||{})) sq[k][y]=Math.max(sq[k][y]||0, loc[k][y]); }
    S.db.meta=o; return;
  }
  if(!SYNC_COLS.includes(c)) return;
  const arr=S.db[c]; const i=arr.findIndex(r=>r.id===o.id);
  if(i>=0) arr[i]=o; else arr.push(o);
}
function quitar(id, c){ if(!SYNC_COLS.includes(c)) return; const rid=id.slice(c.length+1); const arr=S.db[c]; const i=arr.findIndex(r=>r.id===rid); if(i>=0) arr.splice(i,1); }
async function traer(){
  const docs=await Nube.leerCambios(Y.lastPull-5000);
  if(!S.db) return;
  const cur=docsActuales(); let cambio=false, max=Y.lastPull, malos=0;
  for(const d of docs){
    max=Math.max(max, d.mod);
    const local=cur.get(d.id); const localStr=local?JSON.stringify(local[1]):undefined;
    const pendiente = !Y.inicial && (local ? Y.base.get(d.id)!==localStr : Y.base.has(d.id));
    if(pendiente) continue;                     // el cambio hecho en este equipo prevalece y se envía enseguida
    if(d.del){ if(local){ quitar(d.id, d.c); cambio=true; } Y.base.delete(d.id); continue; }
    let o; try{ o=await Nube.descifrar(d.id, d); }catch(e){ malos++; continue; }
    const s=JSON.stringify(o);
    if(localStr===s){ Y.base.set(d.id, s); continue; }
    Y.base.set(d.id, s); poner(d.id, d.c, o); cambio=true;
  }
  Y.lastPull=max;
  if(malos) toast(`${malos} registro(s) del servidor no se pudieron descifrar y se omitieron. Revise la bitácora y avise a soporte.`);
  const bit=await Nube.leerBitacora(Y.bitN);
  if(bit.length){ await fusionarBitacora(bit); cambio=true; }
  if(cambio && S.db){ S.idx=null; S.cumpl.clear(); refrescar(); }
}
// Las entradas de la bitácora del servidor mandan; las de este equipo aún no enviadas se encadenan después
function fusionarBitacora(server){
  logChain = logChain.then(async()=>{
    if(!S.db) return;
    const B=S.db.bitacora, loc=B.filter(e=>e.n>Y.bitN);
    let k=0; while(k<server.length && k<loc.length && server[k].hash===loc[k].hash) k++;
    if(k===server.length){ Y.bitN+=k; return; }
    const nuevo=B.filter(e=>e.n<=Y.bitN).concat(server);
    let prev=nuevo.length?nuevo[nuevo.length-1].hash:'INICIO';
    for(const e of loc.slice(k)){ const r={n:nuevo.length+1, ts:e.ts, usuario:e.usuario, accion:e.accion, ref:e.ref, detalle:e.detalle, prev}; r.hash=await sha256Hex(canon(r)); nuevo.push(r); prev=r.hash; }
    S.db.bitacora=nuevo; Y.bitN=nuevo.length-(loc.length-k);
  });
  return logChain;
}
async function enviar(){
  if(Y.inicial || !S.db) return;
  const lista=pendientes();
  if(lista.length){
    await Nube.escribir(lista, Y.progreso);
    for(const w of lista){ if(w.del) Y.base.delete(w.id); else Y.base.set(w.id, w.s); }
  }
  await logChain;
  const subir=async()=>{ const bp=S.db.bitacora.filter(e=>e.n>Y.bitN); if(bp.length) await Nube.agregarBitacora(bp, n=>{ Y.bitN=n; }); };
  try{ await subir(); }
  catch(err){
    if(err.code!=='permission-denied') throw err;
    // Otro equipo agregó entradas primero: se traen, se reencadenan las de este equipo y se reintenta una vez
    const srv=await Nube.leerBitacora(Y.bitN); if(srv.length) await fusionarBitacora(srv); await logChain; await subir();
  }
}
function refrescar(){
  updateChrome();
  if($('#dlg').open || S.estDirty || !$('#app') || $('#app').hidden) { S.refrescar=true; return; }
  const a=document.activeElement; if(a && a.dataset && a.dataset.filter) { S.refrescar=true; return; }
  render();
}
// Consecutivos únicos entre equipos: se reservan en el servidor
async function reservarSeq(campo, k){
  let n;
  try{ n=await Nube.reservar(campo, k||1); }
  catch(e){ return (e.code==='timeout'||e.code==='unavailable'||!navigator.onLine) ? 'Sin conexión: el consecutivo se asigna en el servidor para que no se repita entre equipos. Intente de nuevo cuando haya conexión.' : 'No fue posible asignar el consecutivo: '+Nube.errorTexto(e); }
  const s=S.db.meta.seq;
  if(campo==='persona') s.persona=n-1; else { const [t,y]=campo.split('_'); s[t][y]=n-1; }
  return null;
}
function seqServidor(seq){
  const o={persona:seq.persona||0};
  for(const t of ['estudio','informe']) for(const y in (seq[t]||{})) o[t+'_'+y]=seq[t][y];
  return o;
}

/* ---------- Bitácora encadenada ---------- */
let logChain = Promise.resolve();
function log(accion, ref, detalle){
  const db = S.db;
  logChain = logChain.then(async()=>{
    const prev = db.bitacora.length ? db.bitacora[db.bitacora.length-1].hash : 'INICIO';
    const e = {n:db.bitacora.length+1, ts:nowISO(), usuario:db.config.operador.nombre, accion, ref:ref||'', detalle:detalle||'', prev};
    e.hash = await sha256Hex(canon(e));
    db.bitacora.push(e);
  });
  scheduleSave();
  return logChain;
}
async function verificarBitacora(){
  let prev='INICIO';
  for(const e of S.db.bitacora){
    const {hash, ...rest} = e;
    if(rest.prev!==prev) return {ok:false, n:e.n};
    const h = await sha256Hex(canon(rest));
    if(h!==hash) return {ok:false, n:e.n};
    prev=hash;
  }
  return {ok:true, total:S.db.bitacora.length};
}

/* =====================================================================
   Índices y reglas de cumplimiento
   ===================================================================== */
function idx(){
  if(S.idx) return S.idx;
  const I={pers:new Map(), byCode:new Map(), cons:new Map(), hall:new Map(), est:new Map(), aut:new Map(), fuente:new Map()};
  const push=(m,k,v)=>{ if(!m.has(k)) m.set(k,[]); m.get(k).push(v); };
  for(const p of S.db.personas){ I.pers.set(p.id,p); I.byCode.set(p.codigo,p); }
  for(const c of S.db.consultas) push(I.cons,c.personaId,c);
  for(const h of S.db.hallazgos) push(I.hall,h.personaId,h);
  for(const e of S.db.estudios) push(I.est,e.personaId,e);
  for(const a of S.db.autorizaciones) push(I.aut,a.personaId,a);
  for(const f of cfg().fuentes) I.fuente.set(f.id,f);
  S.idx=I; return I;
}
const P = id => idx().pers.get(id);
const fuenteNom = id => idx().fuente.get(id)?.nombre || 'Fuente retirada';
const nombre = p => p ? `${p.nombres} ${p.apellidos}`.trim() : '';
const vigente = p => p && !p.anon && (p.estado==='Activo' || p.estado==='En selección');
function lastConsulta(pid, fid){ let best=null; for(const c of idx().cons.get(pid)||[]){ if(c.anulada||c.fuenteId!==fid) continue; if(!best||c.fecha>best.fecha) best=c; } return best; }
function lastConsultaAny(pid){ let best=null; for(const c of idx().cons.get(pid)||[]){ if(c.anulada) continue; if(!best||c.fecha>best.fecha) best=c; } return best; }
function lastVisita(pid){ let best=null; for(const e of idx().est.get(pid)||[]){ if(e.estado!=='Realizado'||!e.incluyeVisita||!e.fechaRealizacion) continue; if(!best||e.fechaRealizacion>best.fechaRealizacion) best=e; } return best; }
function statusDue(due){ const d=daysUntil(due); if(d<0) return 'bad'; if(d<=cfg().diasAlerta) return 'warn'; return 'ok'; }
const DUE_LBL = {bad:'Vencida', warn:'Por vencer', ok:'Al día'};
function cumpl(p){
  if(S.cumpl.has(p.id)) return S.cumpl.get(p.id);
  const NA={s:'na', t:'No aplica'};
  let r;
  if(!vigente(p)) r={aut:NA, ant:NA, vis:NA, g:'na'};
  else{
    const per = p.critico ? cfg().periodicidad.critico : cfg().periodicidad.general;
    const auts=(idx().aut.get(p.id)||[]).filter(a=>a.tipo===TIPOS_AUT[0] && a.estado==='Vigente').sort((a,b)=>b.fecha.localeCompare(a.fecha));
    const aut = auts.length ? {s:'ok', t:'Vigente', d:auts[0].fecha, det:'Firmada el '+fmtD(auts[0].fecha)} : {s:'bad', t:'Sin autorización', det:'Registre la autorización general de tratamiento de datos'};
    const oblig = cfg().fuentes.filter(f=>f.obligatoria && f.activa);
    let ant;
    if(!oblig.length) ant={s:'na', t:'Sin fuentes obligatorias', det:'Defínalas en Configuración'};
    else{
      const missing=[]; let minDue=null;
      for(const f of oblig){ const c=lastConsulta(p.id,f.id); if(!c) missing.push(f.nombre); else { const due=addMonths(c.fecha, per.antecedentes); if(!minDue||due<minDue) minDue=due; } }
      if(missing.length) ant={s:'bad', t: missing.length===oblig.length?'Sin consulta':'Consulta incompleta', det:'Falta: '+missing.join('; ')};
      else { const s=statusDue(minDue); ant={s, t:DUE_LBL[s], d:minDue, det:(s==='bad'?'Venció el ':'Vence el ')+fmtD(minDue)}; }
    }
    let vis;
    if(per.visita>0){
      const v=lastVisita(p.id);
      if(!v) vis={s:'bad', t:'Sin visita', det:'Cargo crítico sin visita domiciliaria registrada'};
      else { const due=addMonths(v.fechaRealizacion, per.visita); const s=statusDue(due); vis={s, t:DUE_LBL[s], d:due, det:`Última el ${fmtD(v.fechaRealizacion)}; ${s==='bad'?'venció':'vence'} el ${fmtD(due)}`}; }
    } else vis={s:'na', t:'No requerida', det:p.critico?'Periodicidad en cero':'Solo para cargos críticos'};
    const g = [aut,ant,vis].reduce((w,x)=>STATUS_RANK[x.s]>STATUS_RANK[w]?x.s:w,'na');
    r={aut, ant, vis, g};
  }
  S.cumpl.set(p.id,r); return r;
}
const G_LBL = {bad:'Requiere acción', warn:'Por vencer', ok:'Al día', na:'No aplica'};
function stHTML(s, text){ return `<span class="st ${s}"><span class="g" aria-hidden="true">${GLYPH[s]}</span>${esc(text)}</span>`; }

function vencimientos(){
  const out=[];
  for(const p of S.db.personas){
    if(!vigente(p)) continue;
    const c=cumpl(p);
    for(const [asunto,k] of [['Autorización','aut'],['Antecedentes','ant'],['Visita domiciliaria','vis']]){
      const r=c[k]; if(r.s==='bad'||r.s==='warn') out.push({p, asunto, s:r.s, t:r.t, d:r.d||'', det:r.det||''});
    }
  }
  out.sort((a,b)=> (STATUS_RANK[b.s]-STATUS_RANK[a.s]) || ((b.p.critico?1:0)-(a.p.critico?1:0)) || (a.d||'0').localeCompare(b.d||'0'));
  return out;
}

/* =====================================================================
   Detección de datos sensibles (aviso, no bloqueo)
   ===================================================================== */
const SENS_RE = /(relig|iglesia|catolic|evangel|cristian[oa]|testigo de jehova|partido politic|militancia|afiliacion politica|ideologi|sindic|enfermedad|diagnost|medic[oa]|clinic|hospital|psiquiat|psicolog|depresi|ansiedad|embaraz|discapac|\bvih\b|\bsida\b|cancer|orientacion sexual|homosexual|\bgay\b|lesbiana|transgener|bisexual|vida sexual|etnia|etnic|indigena|afrodescend|\braza\b|huella dactilar|biometric)/;
function sensCheck(text){ const m = norm(text).match(SENS_RE); return m ? m[0] : null; }
function attachSensitive(root){
  for(const el of $$('textarea, input[data-sens]', root)){
    if(el.dataset.sensBound) continue; el.dataset.sensBound='1';
    const warn=document.createElement('div'); warn.className='sens-warn'; warn.hidden=true; el.insertAdjacentElement('afterend', warn);
    const check=()=>{ const hit=sensCheck(el.value); warn.hidden=!hit; if(hit) warn.textContent='Posible dato sensible (artículo 5, Ley 1581 de 2012). Registre solo lo estrictamente necesario para la finalidad de seguridad, o redáctelo de forma indirecta.'; };
    el.addEventListener('input', check); check();
  }
}

/* =====================================================================
   Interfaz: utilidades
   ===================================================================== */
let toastTimer;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('on'), 2600); }
function download(name, content, type){ const blob = content instanceof Blob ? content : new Blob([content], {type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();}, 1500); }
function csvCell(v){ v = v==null ? '' : String(v); return /[";\n\r]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function exportCSV(name, headers, rows){ const body=[headers, ...rows].map(r=>r.map(csvCell).join(';')).join('\r\n'); download(name, '﻿'+body, 'text/csv;charset=utf-8'); }
function stamp(){ return today(); }

function formObj(f){
  const o={};
  for(const el of f.elements){
    if(!el.name || el.disabled) continue;
    if(el.type==='checkbox'){
      if(el.name.endsWith('[]')){ const k=el.name.slice(0,-2); (o[k]=o[k]||[]); if(el.checked) o[k].push(el.value); }
      else o[el.name]=el.checked;
    } else if(el.type==='radio'){ if(el.checked) o[el.name]=el.value; }
    else if(el.type==='file'){ o[el.name]=el.files; }
    else o[el.name]=el.value.trim();
  }
  return o;
}
function openDialog({title, body, submit='Guardar', wide=false, danger=false, onSubmit, onOpen}){
  const dlg=$('#dlg'), f=$('#dlgform');
  f.innerHTML = `<div class="dlg-head"><h2>${esc(title)}</h2><button type="button" class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="dlg-body">${body}</div><div class="dlg-err" hidden></div>
    <div class="dlg-foot"><button type="button" class="btn" data-close>Cancelar</button>${submit?`<button type="submit" class="btn ${danger?'danger':'primary'}">${esc(submit)}</button>`:''}</div>`;
  dlg.classList.toggle('wide', !!wide);
  f.onsubmit = async ev => {
    ev.preventDefault();
    const btn=f.querySelector('button[type=submit]'); if(btn) btn.disabled=true;
    try{
      const r = await onSubmit(formObj(f), f);
      if(typeof r==='string'){ const e=f.querySelector('.dlg-err'); e.textContent=r; e.hidden=false; return; }
      if(r===false) return;
      dlg.close();
    }catch(err){ const e=f.querySelector('.dlg-err'); e.textContent=err.message||String(err); e.hidden=false; }
    finally{ if(btn) btn.disabled=false; }
  };
  $$('[data-close]', f).forEach(b=>b.onclick=()=>dlg.close());
  if(!dlg.open) dlg.showModal();
  attachSensitive(f);
  if(onOpen) onOpen(f);
  const first=f.querySelector('.dlg-body input:not([type=hidden]):not([type=checkbox]),.dlg-body select,.dlg-body textarea'); if(first) first.focus();
}
function confirmDialog(title, text, label, fn, danger=true){
  openDialog({title, body:`<p>${text}</p>`, submit:label, danger, onSubmit:fn});
}
function personaPicker(name='personaRef', value=''){
  const list = S.db.personas.filter(p=>!p.anon).map(p=>`<option value="${esc(nombre(p))} (${esc(p.codigo)})"></option>`).join('');
  return `<label class="f wide"><span>Persona</span><input type="text" name="${name}" list="dl-personas" value="${esc(value)}" placeholder="Escriba el nombre o el código" autocomplete="off" required><datalist id="dl-personas">${list}</datalist><span class="hint">Seleccione de la lista. La persona debe estar registrada antes.</span></label>`;
}
function resolvePersona(ref){ const m=String(ref||'').match(/\((P-\d+)\)\s*$/); if(m) return idx().byCode.get(m[1]); const q=norm(ref); return S.db.personas.find(p=>!p.anon && (norm(p.codigo)===q || norm(p.doc)===q)) || null; }

/* =====================================================================
   Gráficos (una serie, sin dependencias)
   ===================================================================== */
function niceMax(v){ if(v<=5) return 5; const p=Math.pow(10, Math.floor(Math.log10(v))); for(const m of [1,2,2.5,5,10]) if(m*p>=v) return m*p; return 10*p; }
function chartBarsV(items, label){
  const W=640, H=210, L=34, R=8, T=20, B=26; const max=niceMax(Math.max(0,...items.map(i=>i.value)));
  const n=items.length, cw=(W-L-R)/n, bw=Math.max(8, Math.min(34, cw-10));
  const y=v=>T+(H-T-B)*(1-v/max);
  const maxV=Math.max(...items.map(i=>i.value)); const maxI=items.findIndex(i=>i.value===maxV);
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
  for(const t of [0, max/2, max]){ const yy=y(t); s+=`<line class="${t===0?'base':'grid'}" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L-6}" y="${yy+4}" text-anchor="end">${fmtN(t)}</text>`; }
  items.forEach((it,i)=>{
    const cx=L+cw*i+cw/2, x=cx-bw/2, top=y(it.value), base=y(0), h=base-top, r=Math.min(4,bw/2,h);
    s+=`<g data-tip="${esc(it.tip||(it.label+': '+fmtN(it.value)))}"><rect class="hit" x="${L+cw*i}" y="${T}" width="${cw}" height="${H-T-B}"/>`;
    if(it.value>0) s+=`<path class="bar" d="M${x},${base} V${top+r} Q${x},${top} ${x+r},${top} H${x+bw-r} Q${x+bw},${top} ${x+bw},${top+r} V${base} Z"/>`;
    s+=`</g><text class="ax" x="${cx}" y="${H-8}" text-anchor="middle">${esc(it.label)}</text>`;
    if((i===maxI||i===n-1) && it.value>0) s+=`<text class="vl" x="${cx}" y="${top-5}" text-anchor="middle">${fmtN(it.value)}</text>`;
  });
  return s+'</svg>';
}
function chartBarsH(items){
  if(!items.length) return '<p class="hint">Sin datos para el periodo.</p>';
  const max=Math.max(1,...items.map(i=>i.value));
  return `<div class="hbars">${items.map(i=>`<div class="hb-row" data-tip="${esc(i.label)}: ${fmtN(i.value)}"><div class="hb-label">${esc(i.label)}</div><div class="hb-track"><div class="hb-bar${i.value?'':' zero'}" style="width:${i.value*100/max}%"></div></div><div class="hb-val">${fmtN(i.value)}</div></div>`).join('')}</div>`;
}
function dataTable(head, rows){ return `<details class="data"><summary>Ver datos en tabla</summary><table class="tbl"><thead><tr>${head.map((h,i)=>`<th${i?' class="n"':''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i?' class="n"':''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`; }

/* =====================================================================
   Enrutamiento y render
   ===================================================================== */
function parseHash(){ const h=(location.hash||'#/tablero').slice(2).split('/'); return {route:h[0]||'tablero', id:h[1]?decodeURIComponent(h[1]):null}; }
function render(){
  if(!S.db) return;
  S.refrescar=false;
  const {route, id} = parseHash();
  S.listFn=null;
  const main=$('#main');
  const views={tablero:vTablero, personas:vPersonas, persona:vPersona, vencimientos:vVenc, consultas:vConsultas, hallazgos:vHallazgos, estudios:vEstudios, estudio:vEstudio, bitacora:vBitacora, config:vConfig};
  const fn = views[route] || vTablero;
  main.innerHTML = fn(id);
  if(S.listFn) S.listFn();
  attachSensitive(main);
  $$('#nav a').forEach(a=>a.classList.toggle('on', a.dataset.route===route || (route==='persona'&&a.dataset.route==='personas') || (route==='estudio'&&a.dataset.route==='estudios')));
  updateChrome();
  if(route==='estudio') bindEstudio();
}
function updateChrome(){
  const v=vencimientos().filter(x=>x.s==='bad').length; const nv=$('#navvenc'); nv.hidden=!v; nv.textContent=v;
  $('#operator').innerHTML = `${esc(cfg().operador.nombre)}<br>${esc(cfg().operador.cargo)}`;
  updateBackupState();
}

/* ---------- Tablero ---------- */
function vTablero(){
  const db=S.db, y=S.ui.tab.anio;
  const inY = d => d && (y==='todos' || d.startsWith(y));
  const act = db.personas.filter(p=>!p.anon && p.estado==='Activo');
  const sel = db.personas.filter(p=>!p.anon && p.estado==='En selección');
  const crit = act.filter(p=>p.critico);
  const critVis = crit.filter(p=>['ok','warn'].includes(cumpl(p).vis.s)).length;
  const antOk = act.filter(p=>['ok','warn'].includes(cumpl(p).ant.s)).length;
  const hallVig = db.hallazgos.filter(h=>!h.anulado && h.estado==='Vigente' && vigente(P(h.personaId))).length;
  const cons = db.consultas.filter(c=>!c.anulada && inY(c.fecha));
  const consReg = cons.filter(c=>c.resultado==='Con registro').length;
  const ests = db.estudios.filter(e=>e.estado==='Realizado' && inY(e.fechaRealizacion));
  const venc = vencimientos(); const vBad=venc.filter(v=>v.s==='bad').length, vWarn=venc.length-vBad;
  const years = new Set([String(new Date().getFullYear())]); db.consultas.forEach(c=>c.fecha&&years.add(c.fecha.slice(0,4))); db.estudios.forEach(e=>e.fechaRealizacion&&years.add(e.fechaRealizacion.slice(0,4)));
  const yOpts=[{v:'todos',t:'Todo el histórico'}, ...[...years].sort().reverse().map(v=>({v,t:v}))];
  const per = y==='todos' ? 'todo el histórico' : y;

  // consultas por mes: 12 meses (año elegido) o últimos 12 meses
  const months=[]; const now=new Date();
  if(y==='todos'){ for(let i=11;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); months.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}`); } }
  else for(let m=1;m<=12;m++) months.push(`${y}-${pad(m)}`);
  const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const allCons = db.consultas.filter(c=>!c.anulada);
  const byMonth = months.map(k=>{ const v=allCons.filter(c=>c.fecha&&c.fecha.startsWith(k)).length; const [yy,mm]=k.split('-'); return {label:MES[+mm-1]+(y==='todos'?' '+yy.slice(2):''), value:v, tip:`${MES[+mm-1]} ${yy}: ${fmtN(v)} consultas`}; });

  const byEmp = {}; act.forEach(p=>{ const k=p.empresa||p.vinculo; byEmp[k]=(byEmp[k]||0)+1; });
  const empItems = Object.entries(byEmp).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
  const concItems = CONCEPTOS.map(c=>({label:c, value:ests.filter(e=>e.concepto===c).length}));
  const srcRows = cfg().fuentes.map(f=>{ const cs=cons.filter(c=>c.fuenteId===f.id); const r=cs.filter(c=>c.resultado==='Con registro').length; return [f.nombre, cs.length, r]; }).filter(r=>r[1]>0);
  const prior = venc.filter(v=>v.s==='bad').slice(0,8);
  const facts = db.bitacora.slice(-8).reverse();
  const ub=db.meta.ultimoRespaldo; const dias = ub ? -daysUntil(ub.slice(0,10)) : null;
  const backupWarn = (!ub && db.personas.length) || (dias!==null && dias>30);

  return `<div class="page-head"><div><h1>Tablero</h1><div class="lead">Cifras de verificación de antecedentes y estudios de seguridad. Corte al ${fmtD(today())}.</div></div>
    <div class="head-actions"><label class="hint">Periodo <select data-filter="tab.anio">${opts(yOpts,y)}</select></label>
    <button class="btn" type="button" data-act="copiarResumen">Copiar resumen para informe</button><button class="btn" type="button" data-act="exportCifras">Exportar cifras</button></div></div>
    ${backupWarn?`<div class="banner warn">${ub?`El último respaldo cifrado se descargó hace ${dias} días.`:'Aún no ha descargado ningún respaldo cifrado.'} Los datos están en la nube, pero un respaldo mensual en su OneDrive protege frente a la pérdida de la cuenta o del proyecto. <button class="linkbtn" type="button" data-act="respaldo">Descargar respaldo ahora</button></div>`:''}
    ${!db.personas.length?`<div class="empty"><p>Aún no hay personas registradas. Empiece importando el listado de personal desde Excel o registrando la primera persona.</p><button class="btn primary" type="button" data-act="importar">Importar personas</button> <button class="btn" type="button" data-act="nuevaPersona">Registrar persona</button></div>`:''}
    <section class="figures" aria-label="Indicadores">
      <div class="fig"><div class="big">${fmtN(act.length)}</div><div class="lbl">Personas activas</div><div class="ctx">${fmtN(sel.length)} en selección</div></div>
      <div class="fig"><div class="big">${fmtN(crit.length)}</div><div class="lbl">En cargos críticos</div><div class="ctx">${pct(crit.length,act.length)} % del personal activo</div></div>
      <div class="fig"><div class="big">${pct(critVis,crit.length)} %</div><div class="lbl">Críticos con visita al día</div><div class="ctx">${fmtN(critVis)} de ${fmtN(crit.length)}</div><div class="meter"><i style="width:${pct(critVis,crit.length)}%"></i></div></div>
      <div class="fig"><div class="big">${pct(antOk,act.length)} %</div><div class="lbl">Antecedentes al día</div><div class="ctx">${fmtN(antOk)} de ${fmtN(act.length)} activos</div><div class="meter"><i style="width:${pct(antOk,act.length)}%"></i></div></div>
      <div class="fig"><div class="big">${fmtN(hallVig)}</div><div class="lbl">Registros vigentes</div><div class="ctx">en personas activas o en selección</div></div>
    </section>
    <div class="grid2">
      <section class="panel"><h2>Pendientes que requieren acción</h2>
        ${prior.length?`<table class="tbl"><thead><tr><th>Persona</th><th>Asunto</th><th>Situación</th></tr></thead><tbody>${prior.map(v=>`<tr data-href="#/persona/${v.p.id}"><td>${esc(nombre(v.p))}${v.p.critico?' <span class="tag crit">Crítico</span>':''}</td><td>${esc(v.asunto)}</td><td>${stHTML(v.s,v.t)}</td></tr>`).join('')}</tbody></table>
        <p class="more"><a href="#/vencimientos">Ver los ${fmtN(vBad)} vencidos y ${fmtN(vWarn)} por vencer</a></p>`:'<p class="hint">No hay asuntos vencidos.</p>'}
      </section>
      <section class="panel"><h2>Consultas por mes</h2><p class="hint" style="margin:-6px 0 8px">${y==='todos'?'Últimos 12 meses':'Año '+esc(y)}; ${fmtN(cons.length)} consultas en ${esc(per)}, ${fmtN(consReg)} con registro.</p>
        ${chartBarsV(byMonth,'Consultas de antecedentes por mes')}${dataTable(['Mes','Consultas'], byMonth.map(m=>[m.label,m.value]))}</section>
    </div>
    <div class="grid2">
      <section class="panel"><h2>Personal activo por empresa o finca</h2>${chartBarsH(empItems)}</section>
      <section class="panel"><h2>Conceptos de estudios realizados</h2><p class="hint" style="margin:-6px 0 10px">${fmtN(ests.length)} estudios en ${esc(per)}, ${fmtN(ests.filter(e=>e.incluyeVisita).length)} con visita domiciliaria.</p>${chartBarsH(concItems)}</section>
    </div>
    <div class="grid2">
      <section class="panel"><h2>Consultas por fuente</h2>${srcRows.length?`<table class="tbl"><thead><tr><th>Fuente</th><th class="n">Consultas</th><th class="n">Con registro</th></tr></thead><tbody>${srcRows.map(r=>`<tr><td>${esc(r[0])}</td><td class="n">${fmtN(r[1])}</td><td class="n">${fmtN(r[2])}</td></tr>`).join('')}</tbody></table>`:'<p class="hint">Sin consultas en el periodo.</p>'}</section>
      <section class="panel"><h2>Hechos recientes</h2>${facts.length?`<ul class="facts">${facts.map(e=>`<li><span class="when">${fmtDT(e.ts)}</span>${esc(e.accion)}${e.ref?' '+esc(e.ref):''}${e.detalle?'. '+esc(e.detalle):''}</li>`).join('')}</ul><p class="more"><a href="#/bitacora">Ver bitácora completa</a></p>`:'<p class="hint">Sin actividad registrada.</p>'}</section>
    </div>`;
}
function resumenTexto(){
  const db=S.db, y=S.ui.tab.anio; const inY=d=>d&&(y==='todos'||d.startsWith(y));
  const act=db.personas.filter(p=>!p.anon&&p.estado==='Activo'); const crit=act.filter(p=>p.critico);
  const critVis=crit.filter(p=>['ok','warn'].includes(cumpl(p).vis.s)).length; const antOk=act.filter(p=>['ok','warn'].includes(cumpl(p).ant.s)).length;
  const hallVig=db.hallazgos.filter(h=>!h.anulado&&h.estado==='Vigente'&&vigente(P(h.personaId))).length;
  const cons=db.consultas.filter(c=>!c.anulada&&inY(c.fecha)); const reg=cons.filter(c=>c.resultado==='Con registro').length;
  const ests=db.estudios.filter(e=>e.estado==='Realizado'&&inY(e.fechaRealizacion));
  const venc=vencimientos(); const vb=venc.filter(v=>v.s==='bad').length;
  const per = y==='todos'?'en todo el histórico':'en '+y;
  const conc = CONCEPTOS.map(c=>[c, ests.filter(e=>e.concepto===c).length]).filter(x=>x[1]).map(x=>`${x[0].toLowerCase()}: ${x[1]}`).join('; ');
  return `Estudios de seguridad de personal, corte al ${fmtD(today())}. Personal activo: ${fmtN(act.length)}, de los cuales ${fmtN(crit.length)} ocupan cargos críticos. Antecedentes al día: ${pct(antOk,act.length)} % del personal activo (${fmtN(antOk)} de ${fmtN(act.length)}). Cobertura de visita domiciliaria vigente en cargos críticos: ${pct(critVis,crit.length)} % (${fmtN(critVis)} de ${fmtN(crit.length)}). Registros vigentes en personal activo o en selección: ${fmtN(hallVig)}. Consultas de antecedentes ${per}: ${fmtN(cons.length)}, de ellas ${fmtN(reg)} con registro. Estudios realizados ${per}: ${fmtN(ests.length)}${conc?' ('+conc+')':''}. Asuntos vencidos a la fecha: ${fmtN(vb)}; por vencer: ${fmtN(venc.length-vb)}.`;
}

/* ---------- Personas ---------- */
function vPersonas(){
  const u=S.ui.personas;
  const empresas=[...new Set([...cfg().empresas, ...S.db.personas.map(p=>p.empresa).filter(Boolean)])].sort();
  S.listFn = listPersonas;
  return `<div class="page-head"><div><h1>Personas</h1><div class="lead">Personal propio, de las fincas, contratistas y aspirantes. La criticidad debe corresponder a la identificación formal de cargos críticos.</div></div>
    <div class="head-actions"><button class="btn" type="button" data-act="importar">Importar desde Excel</button><button class="btn" type="button" data-act="exportPersonas">Exportar</button><button class="btn primary" type="button" data-act="nuevaPersona">Registrar persona</button></div></div>
    <div class="filters">
      <label>Buscar<input type="search" data-filter="personas.q" value="${esc(u.q)}" placeholder="Nombre, documento, código o cargo"></label>
      <label>Vínculo<select data-filter="personas.vinculo">${opts(VINCULOS,u.vinculo,'Todos')}</select></label>
      <label>Empresa o finca<select data-filter="personas.empresa">${opts(empresas,u.empresa,'Todas')}</select></label>
      <label>Criticidad<select data-filter="personas.critico">${opts([{v:'si',t:'Cargos críticos'},{v:'no',t:'No críticos'}],u.critico,'Todas')}</select></label>
      <label>Estado<select data-filter="personas.estado">${opts([{v:'vigentes',t:'Activos y en selección'},...ESTADOS_P,{v:'todos',t:'Todos'}],u.estado)}</select></label>
      <label>Cumplimiento<select data-filter="personas.cumpl">${opts([{v:'bad',t:'Requiere acción'},{v:'warn',t:'Por vencer'},{v:'ok',t:'Al día'}],u.cumpl,'Todos')}</select></label>
    </div>
    <div id="selbar"></div><div id="list"></div>`;
}
function filtPersonas(){
  const u=S.ui.personas; const q=norm(u.q);
  return S.db.personas.filter(p=>{
    if(u.estado==='vigentes'){ if(!vigente(p)) return false; } else if(u.estado!=='todos' && p.estado!==u.estado) return false;
    if(u.vinculo && p.vinculo!==u.vinculo) return false;
    if(u.empresa && p.empresa!==u.empresa) return false;
    if(u.critico==='si' && !p.critico) return false; if(u.critico==='no' && p.critico) return false;
    if(u.cumpl && cumpl(p).g!==u.cumpl) return false;
    if(q && !norm(`${p.nombres} ${p.apellidos} ${p.doc} ${p.codigo} ${p.cargo}`).includes(q)) return false;
    return true;
  }).sort((a,b)=>(STATUS_RANK[cumpl(b).g]-STATUS_RANK[cumpl(a).g]) || nombre(a).localeCompare(nombre(b),'es'));
}
function listPersonas(){
  const u=S.ui.personas, rows=filtPersonas(), shown=rows.slice(0,u.limit);
  const el=$('#list'); if(!el) return;
  if(!S.db.personas.length){ el.innerHTML=`<div class="empty"><p>No hay personas registradas. Importe el listado desde un archivo de Excel guardado como CSV, o registre una persona.</p><button class="btn primary" type="button" data-act="importar">Importar personas</button> <button class="btn" type="button" data-act="plantilla" data-tipo="personas">Descargar plantilla</button></div>`; updateSelbar(); return; }
  el.innerHTML = `<p class="resultcount">${fmtN(rows.length)} personas</p>
  ${rows.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th class="cb"><input type="checkbox" data-act="selAll" aria-label="Seleccionar todas las filas visibles"></th><th>Persona</th><th>Vínculo y empresa</th><th>Cargo</th><th>Última consulta</th><th>Última visita</th><th>Cumplimiento</th></tr></thead><tbody>
  ${shown.map(p=>{ const c=cumpl(p), lc=lastConsultaAny(p.id), lv=lastVisita(p.id); return `<tr data-href="#/persona/${p.id}">
    <td class="cb"><input type="checkbox" data-sel="${p.id}" ${u.sel.has(p.id)?'checked':''} aria-label="Seleccionar"></td>
    <td><a href="#/persona/${p.id}"><strong>${esc(nombre(p))}</strong></a>${p.anon?' <span class="tag hist">Datos suprimidos</span>':''}<div class="sub">${esc(p.tipoDoc)} ${esc(p.doc)}; ${esc(p.codigo)}</div></td>
    <td>${esc(p.vinculo)}<div class="sub">${esc(p.empresa||'')}</div></td>
    <td>${esc(p.cargo||'')}${p.critico?' <span class="tag crit">Crítico</span>':''}<div class="sub">${esc(p.estado)}</div></td>
    <td class="num">${lc?fmtD(lc.fecha):'<span class="sub">Ninguna</span>'}</td>
    <td class="num">${lv?fmtD(lv.fechaRealizacion):'<span class="sub">Ninguna</span>'}</td>
    <td>${stHTML(c.g, G_LBL[c.g])}</td></tr>`; }).join('')}
  </tbody></table></div>${rows.length>shown.length?`<p class="more"><button class="btn" type="button" data-act="limitAll" data-view="personas">Mostrar las ${fmtN(rows.length)}</button></p>`:''}`:'<p class="empty">Ninguna persona coincide con los filtros.</p>'}`;
  updateSelbar();
}
function updateSelbar(){
  const sb=$('#selbar'); if(!sb) return; const n=S.ui.personas.sel.size;
  sb.innerHTML = n ? `<div class="selbar"><strong>${fmtN(n)} seleccionadas</strong><button class="btn sm" type="button" data-act="consultaLote">Registrar consulta en lote</button><button class="btn sm ghost" type="button" data-act="selClear">Quitar selección</button></div>` : '';
}

function personaForm(p={}){
  const empresas=[...new Set([...cfg().empresas, ...S.db.personas.map(x=>x.empresa).filter(Boolean)])].sort();
  return `<div class="fgrid">
    <label class="f"><span>Tipo de documento</span><select name="tipoDoc">${opts(TIPOS_DOC,p.tipoDoc||'CC')}</select></label>
    <label class="f"><span>Número de documento</span><input type="text" name="doc" value="${esc(p.doc)}" required inputmode="numeric"></label>
    <label class="f"><span>Nombres</span><input type="text" name="nombres" value="${esc(p.nombres)}" required></label>
    <label class="f"><span>Apellidos</span><input type="text" name="apellidos" value="${esc(p.apellidos)}"></label>
    <label class="f"><span>Vínculo</span><select name="vinculo">${opts(VINCULOS,p.vinculo||VINCULOS[0])}</select></label>
    <label class="f"><span>Empresa o finca</span><input type="text" name="empresa" list="dl-emp" value="${esc(p.empresa||'Avo Pak S.A.S.')}"><datalist id="dl-emp">${empresas.map(e=>`<option value="${esc(e)}">`).join('')}</datalist></label>
    <label class="f"><span>Cargo</span><input type="text" name="cargo" value="${esc(p.cargo)}"></label>
    <label class="f"><span>Área</span><input type="text" name="area" value="${esc(p.area)}"></label>
    <label class="f"><span>Estado</span><select name="estado">${opts(ESTADOS_P,p.estado||'Activo')}</select></label>
    <label class="f"><span>Fecha de ingreso</span><input type="date" name="fechaIngreso" value="${esc(p.fechaIngreso)}"></label>
    <label class="f"><span>Fecha de retiro</span><input type="date" name="fechaRetiro" value="${esc(p.fechaRetiro)}"><span class="hint">Solo si el estado es Retirado</span></label>
    <label class="f"><span>Municipio de residencia</span><input type="text" name="municipio" value="${esc(p.municipio)}"></label>
    <div class="wide"><label class="chk"><input type="checkbox" name="critico" ${p.critico?'checked':''}><span><strong>Cargo crítico</strong><br><span class="hint">Activa la periodicidad de cargos críticos y la exigencia de visita domiciliaria.</span></span></label></div>
    <label class="f wide"><span>Observaciones</span><textarea name="obs" rows="2" placeholder="Solo información necesaria para la finalidad de seguridad">${esc(p.obs)}</textarea></label>
  </div>`;
}
function validarPersona(o, current){
  if(!o.doc) return 'Indique el número de documento.';
  if(!o.nombres) return 'Indique los nombres.';
  const dup=S.db.personas.find(x=>x!==current && !x.anon && x.tipoDoc===o.tipoDoc && norm(x.doc)===norm(o.doc));
  if(dup) return `Ya existe una persona con ${o.tipoDoc} ${o.doc}: ${nombre(dup)} (${dup.codigo}).`;
  if(o.estado==='Retirado' && !o.fechaRetiro) return 'Indique la fecha de retiro.';
  if(o.fechaIngreso && o.fechaIngreso>today()) return 'La fecha de ingreso no puede ser futura.';
  return null;
}
function nuevaPersona(){
  openDialog({title:'Registrar persona', wide:true, body:personaForm(), submit:'Registrar persona', onSubmit:async o=>{
    const err=validarPersona(o,null); if(err) return err;
    const e2=await reservarSeq('persona',1); if(e2) return e2;
    if(validarPersona(o,null)) return validarPersona(o,null);
    const p=crearPersona(o);
    log('Persona registrada', p.codigo, `${p.vinculo}${p.critico?', cargo crítico':''}`);
    mutate(); toast('Persona registrada'); location.hash='#/persona/'+p.id;
  }});
}
function crearPersona(o){
  S.db.meta.seq.persona++;
  const p={id:uid(), codigo:'P-'+String(S.db.meta.seq.persona).padStart(5,'0'), tipoDoc:o.tipoDoc||'CC', doc:o.doc, nombres:o.nombres, apellidos:o.apellidos||'', vinculo:o.vinculo, empresa:o.empresa||'', cargo:o.cargo||'', area:o.area||'', critico:!!o.critico, estado:o.estado||'Activo', fechaIngreso:o.fechaIngreso||'', fechaRetiro:o.estado==='Retirado'?(o.fechaRetiro||''):'', municipio:o.municipio||'', obs:o.obs||'', creado:nowISO(), actualizado:nowISO(), anon:false};
  S.db.personas.push(p); S.idx=null; return p;
}
function editarPersona(id){
  const p=P(id);
  openDialog({title:'Editar datos de la persona', wide:true, body:personaForm(p), onSubmit:o=>{
    const err=validarPersona(o,p); if(err) return err;
    const campos=['tipoDoc','doc','nombres','apellidos','vinculo','empresa','cargo','area','estado','fechaIngreso','fechaRetiro','municipio','obs'];
    const cambios=[]; const labels={tipoDoc:'tipo de documento',doc:'documento',nombres:'nombres',apellidos:'apellidos',vinculo:'vínculo',empresa:'empresa',cargo:'cargo',area:'área',estado:'estado',fechaIngreso:'fecha de ingreso',fechaRetiro:'fecha de retiro',municipio:'municipio',obs:'observaciones'};
    if(o.estado!=='Retirado') o.fechaRetiro='';
    for(const k of campos){ if((p[k]||'')!==(o[k]||'')){ cambios.push(labels[k]); p[k]=o[k]||''; } }
    if(!!o.critico!==!!p.critico){ cambios.push('criticidad'); p.critico=!!o.critico; }
    if(!cambios.length) return;
    p.actualizado=nowISO();
    log('Persona actualizada', p.codigo, 'Campos: '+cambios.join(', ')+(cambios.includes('criticidad')?`; ahora ${p.critico?'crítico':'no crítico'}`:'')+(cambios.includes('estado')?`; estado ${p.estado}`:''));
    mutate(); render(); toast('Datos actualizados');
  }});
}
function suprimirPersona(id){
  const p=P(id);
  openDialog({title:'Suprimir datos de la persona', danger:true, submit:'Suprimir datos', body:`<p>Se eliminarán de forma irreversible los datos identificativos y los textos asociados a <strong>${esc(nombre(p))}</strong> (${esc(p.codigo)}): nombre, documento, observaciones, descripciones, direcciones y contenido de informes. Se conservan solo fechas, tipos y resultados para las cifras, y la constancia en la bitácora.</p>
    <div class="fgrid"><label class="f"><span>Motivo</span><select name="motivo">${opts(MOTIVOS_SUP,'')}</select></label><label class="f wide"><span>Detalle del soporte</span><input type="text" name="detalle" placeholder="Ej.: solicitud radicada, acta de depuración"></label>
    <label class="f wide"><span>Escriba SUPRIMIR para confirmar</span><input type="text" name="conf" autocomplete="off"></label></div>`,
    onSubmit:o=>{ if(o.conf!=='SUPRIMIR') return 'Escriba SUPRIMIR para confirmar.'; anonimizar(p, o.motivo+(o.detalle?'; '+o.detalle:'')); mutate(); render(); toast('Datos suprimidos'); }});
}
function anonimizar(p, motivo){
  Object.assign(p,{nombres:'Datos', apellidos:'suprimidos', doc:'', municipio:'', obs:'', area:'', anon:true, fechaSupresion:today(), actualizado:nowISO()});
  for(const c of S.db.consultas) if(c.personaId===p.id){ c.obs=''; c.soporte=''; }
  for(const h of S.db.hallazgos) if(h.personaId===p.id){ h.descripcion=''; h.soporte=''; h.obs=''; h.soporteLev=''; }
  for(const a of S.db.autorizaciones) if(a.personaId===p.id){ a.soporte=''; a.obs=''; }
  for(const e of S.db.estudios) if(e.personaId===p.id){ Object.assign(e,{direccion:'', municipio:'', soporteVol:'', hechos:'', inferencias:'', conclusion:'', recomendaciones:'', obs:''}); for(const k in (e.checklist||{})) e.checklist[k]={r:e.checklist[k].r, v:'', obs:''}; if(e.informe) e.informe.versiones.forEach(v=>{ v.snap=null; }); }
  log('Datos suprimidos', p.codigo, motivo);
}

/* ---------- Ficha de persona ---------- */
function vPersona(id){
  const p=P(id); if(!p) return `<p class="empty">La persona no existe. <a href="#/personas">Volver a personas</a></p>`;
  const c=cumpl(p), I=idx();
  const auts=(I.aut.get(p.id)||[]).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const cons=(I.cons.get(p.id)||[]).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const halls=(I.hall.get(p.id)||[]).filter(h=>!h.anulado).sort((a,b)=>b.fechaDeteccion.localeCompare(a.fechaDeteccion));
  const vig=halls.filter(h=>h.estado==='Vigente'), lev=halls.filter(h=>h.estado==='Levantado');
  const ests=(I.est.get(p.id)||[]).slice().sort((a,b)=>(b.fechaRealizacion||b.fechaProgramada||'').localeCompare(a.fechaRealizacion||a.fechaProgramada||''));
  const showLev=S.ui.ficha.levantados;
  const seg=(k,lab)=>`<div class="seg ${c[k].s}"><div class="k">${lab}</div><div class="v">${stHTML(c[k].s,c[k].t)}</div><div class="d">${esc(c[k].det||'')}</div></div>`;
  const dis = p.anon ? 'disabled' : '';
  return `<a class="back" href="#/personas">Personas</a>
  <div class="page-head"><div><h1>${esc(nombre(p))}</h1>${p.anon?`<div class="lead">Datos identificativos suprimidos el ${fmtD(p.fechaSupresion)}. Se conservan solo para cifras y trazabilidad.</div>`:''}</div>
    <div class="head-actions">
      <button class="btn" type="button" data-act="editarPersona" data-id="${p.id}" ${dis}>Editar datos</button>
      <button class="btn" type="button" data-act="nuevaAutorizacion" data-pid="${p.id}" ${dis}>Registrar autorización</button>
      <button class="btn" type="button" data-act="nuevaConsulta" data-pid="${p.id}" ${dis}>Registrar consulta</button>
      <button class="btn primary" type="button" data-act="nuevoEstudio" data-pid="${p.id}" ${dis}>Programar estudio</button>
    </div></div>
  <dl class="ident">
    <div><dt>Documento</dt><dd>${esc(p.tipoDoc)} ${esc(p.doc)||'—'}</dd></div>
    <div><dt>Código interno</dt><dd>${esc(p.codigo)}</dd></div>
    <div><dt>Vínculo</dt><dd>${esc(p.vinculo)}</dd></div>
    <div><dt>Empresa o finca</dt><dd>${esc(p.empresa||'—')}</dd></div>
    <div><dt>Cargo</dt><dd>${esc(p.cargo||'—')} ${p.critico?'<span class="tag crit">Crítico</span>':''}</dd></div>
    <div><dt>Área</dt><dd>${esc(p.area||'—')}</dd></div>
    <div><dt>Estado</dt><dd>${esc(p.estado)}${p.fechaRetiro?' desde '+fmtD(p.fechaRetiro):''}</dd></div>
    <div><dt>Ingreso</dt><dd>${p.fechaIngreso?fmtD(p.fechaIngreso):'—'}</dd></div>
    <div><dt>Municipio de residencia</dt><dd>${esc(p.municipio||'—')}</dd></div>
  </dl>
  ${p.obs?`<p class="hint" style="margin-top:10px">${esc(p.obs)}</p>`:''}
  <div class="strip" aria-label="Situación de cumplimiento">${seg('aut','Autorización de datos')}${seg('ant','Antecedentes')}${seg('vis','Visita domiciliaria')}</div>

  <div class="section"><div class="section-head"><h2>Consultas de antecedentes</h2><button class="btn sm" type="button" data-act="nuevaConsulta" data-pid="${p.id}" ${dis}>Registrar consulta</button></div>
  ${cons.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Fuente</th><th>Resultado</th><th>Soporte</th><th>Observación</th><th></th></tr></thead><tbody>
  ${cons.map(x=>`<tr class="${x.anulada?'anulado':''}"><td class="num">${fmtD(x.fecha)}</td><td>${esc(fuenteNom(x.fuenteId))}</td><td>${x.resultado==='Con registro'?'<span class="tag bad">Con registro</span>':esc(x.resultado)}</td><td>${esc(x.soporte)}</td><td>${esc(x.obs)}${x.anulada?`<div class="sub">Anulada: ${esc(x.motivoAnulacion)}</div>`:''}</td><td class="keep">${x.anulada||p.anon?'':`<button class="btn sm ghost" type="button" data-act="anularConsulta" data-id="${x.id}">Anular</button>`}</td></tr>`).join('')}
  </tbody></table></div>`:'<p class="hint">Sin consultas registradas.</p>'}</div>

  <div class="section"><div class="section-head"><h2>Registros hallados</h2><div class="head-actions">
    <label class="chk" style="font-size:13px"><input type="checkbox" data-act="toggleLev" ${showLev?'checked':''}> Mostrar levantados (vista de auditoría)</label>
    <button class="btn sm" type="button" data-act="nuevoHallazgo" data-pid="${p.id}" ${dis}>Registrar hallazgo</button></div></div>
  ${(vig.length||(showLev&&lev.length))?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Detectado</th><th>Fuente</th><th>Descripción</th><th>Valoración</th><th>Estado</th><th></th></tr></thead><tbody>
  ${[...vig, ...(showLev?lev:[])].map(h=>`<tr><td class="num">${fmtD(h.fechaDeteccion)}</td><td>${esc(fuenteNom(h.fuenteId))}</td><td>${esc(h.descripcion)}</td><td>${esc(h.valoracion)}</td><td>${h.estado==='Vigente'?'<span class="tag bad">Vigente</span>':`<span class="tag hist">Levantado el ${fmtD(h.fechaLevantamiento)}</span>`}</td><td>${h.estado==='Vigente'&&!p.anon?`<button class="btn sm" type="button" data-act="levantarHallazgo" data-id="${h.id}">Registrar levantamiento</button>`:''}</td></tr>`).join('')}
  </tbody></table></div>`:`<p class="hint">Sin registros vigentes.${lev.length&&!showLev?` Hay ${lev.length} levantado(s), visibles solo en la vista de auditoría.`:''}</p>`}
  <p class="hint">Los registros levantados se conservan como trazabilidad, no aparecen en el perfil activo ni alimentan conceptos de riesgo, y se suprimen al vencer el plazo de conservación.</p></div>

  <div class="section"><div class="section-head"><h2>Estudios y visitas</h2><button class="btn sm" type="button" data-act="nuevoEstudio" data-pid="${p.id}" ${dis}>Programar estudio</button></div>
  ${ests.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Código</th><th>Tipo</th><th>Visita</th><th>Fecha</th><th>Estado</th><th>Concepto</th><th>Informe</th></tr></thead><tbody>
  ${ests.map(e=>`<tr data-href="#/estudio/${e.id}" class="${e.estado==='Anulado'?'anulado':''}"><td>${esc(e.codigo)}</td><td>${esc(e.tipo)}</td><td>${e.incluyeVisita?'Sí':'No'}</td><td class="num">${fmtD(e.fechaRealizacion||e.fechaProgramada)}${!e.fechaRealizacion?'<div class="sub">programada</div>':''}</td><td>${esc(e.estado)}</td><td>${esc(e.concepto||'')}</td><td>${e.informe?esc(e.informe.codigo)+' v'+e.informe.versiones.length:''}</td></tr>`).join('')}
  </tbody></table></div>`:'<p class="hint">Sin estudios registrados.</p>'}</div>

  <div class="section"><div class="section-head"><h2>Autorizaciones</h2><button class="btn sm" type="button" data-act="nuevaAutorizacion" data-pid="${p.id}" ${dis}>Registrar autorización</button></div>
  ${auts.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Tipo</th><th>Fecha</th><th>Formato y versión</th><th>Soporte</th><th>Estado</th><th></th></tr></thead><tbody>
  ${auts.map(a=>`<tr><td>${esc(a.tipo)}</td><td class="num">${fmtD(a.fecha)}</td><td>${esc(a.version)}</td><td>${esc(a.soporte)}</td><td>${a.estado==='Vigente'?'<span class="tag ok">Vigente</span>':`<span class="tag hist">Revocada el ${fmtD(a.fechaRevocatoria)}</span>`}</td><td>${a.estado==='Vigente'&&!p.anon?`<button class="btn sm ghost" type="button" data-act="revocarAutorizacion" data-id="${a.id}">Registrar revocatoria</button>`:''}</td></tr>`).join('')}
  </tbody></table></div>`:'<p class="hint">Sin autorizaciones registradas.</p>'}</div>

  <div class="section"><div class="section-head"><h2>Historial</h2></div>${historial(p)}</div>

  ${p.anon?'':`<div class="section"><div class="section-head"><h2>Supresión de datos</h2></div><p class="hint">Procede al vencer el plazo de conservación, por solicitud de supresión del titular o por registro erróneo. Es irreversible.</p><button class="btn" type="button" data-act="suprimirPersona" data-id="${p.id}">Suprimir datos de esta persona</button></div>`}`;
}
function historial(p){
  const I=idx(), ev=[];
  for(const a of I.aut.get(p.id)||[]){ ev.push({d:a.fecha, t:`Autorización: ${a.tipo.toLowerCase()}`}); if(a.estado==='Revocada') ev.push({d:a.fechaRevocatoria, t:'Revocatoria de autorización', h:true}); }
  for(const c of I.cons.get(p.id)||[]) if(!c.anulada) ev.push({d:c.fecha, t:`Consulta en ${fuenteNom(c.fuenteId)}: ${c.resultado.toLowerCase()}`});
  for(const h of I.hall.get(p.id)||[]) if(!h.anulado){ ev.push({d:h.fechaDeteccion, t:`Registro detectado en ${fuenteNom(h.fuenteId)}`}); if(h.estado==='Levantado'&&S.ui.ficha.levantados) ev.push({d:h.fechaLevantamiento, t:`Registro levantado (${fuenteNom(h.fuenteId)})`, h:true}); }
  for(const e of I.est.get(p.id)||[]){ if(e.estado==='Realizado') ev.push({d:e.fechaRealizacion, t:`${e.incluyeVisita?'Visita domiciliaria':'Estudio'} realizado (${e.codigo}): ${(e.concepto||'sin concepto').toLowerCase()}`}); else if(e.estado==='No realizado') ev.push({d:e.fechaProgramada, t:`Estudio no realizado (${e.codigo}): ${(e.motivoNR||'').toLowerCase()}`}); }
  ev.sort((a,b)=>(b.d||'').localeCompare(a.d||''));
  if(!ev.length) return '<p class="hint">Sin eventos.</p>';
  return `<ul class="timeline">${ev.slice(0,40).map(e=>`<li class="${e.h?'hist':''}"><div class="when">${fmtD(e.d)}</div>${esc(e.t)}</li>`).join('')}</ul>`;
}

/* ---------- Autorizaciones ---------- */
function nuevaAutorizacion(pid){
  const p=P(pid);
  openDialog({title:'Registrar autorización', body:`<p class="hint">Persona: <strong>${esc(nombre(p))}</strong> (${esc(p.codigo)})</p><div class="fgrid">
    <label class="f wide"><span>Tipo</span><select name="tipo">${opts(TIPOS_AUT,TIPOS_AUT[0])}</select></label>
    <label class="f"><span>Fecha de firma</span><input type="date" name="fecha" value="${today()}" max="${today()}"></label>
    <label class="f"><span>Formato y versión</span><input type="text" name="version" placeholder="Código y versión del formato"></label>
    <label class="f wide"><span>Ubicación del soporte firmado</span><input type="text" name="soporte" placeholder="Carpeta física o ruta en SharePoint"></label></div>
    <p class="hint">La visita domiciliaria exige autorización específica, previa, expresa e informada, distinta de la general.</p>`,
    onSubmit:o=>{ if(!validISO(o.fecha)) return 'Indique una fecha válida.'; if(o.fecha>today()) return 'La fecha no puede ser futura.';
      const a={id:uid(), personaId:pid, tipo:o.tipo, fecha:o.fecha, version:o.version, soporte:o.soporte, estado:'Vigente', creado:nowISO()};
      S.db.autorizaciones.push(a); log('Autorización registrada', p.codigo, a.tipo); mutate(); render(); toast('Autorización registrada'); }});
}
function revocarAutorizacion(id){
  const a=S.db.autorizaciones.find(x=>x.id===id), p=P(a.personaId);
  openDialog({title:'Registrar revocatoria', danger:true, submit:'Registrar revocatoria', body:`<p>${esc(a.tipo)} de ${esc(nombre(p))}, firmada el ${fmtD(a.fecha)}.</p><div class="fgrid"><label class="f"><span>Fecha de revocatoria</span><input type="date" name="fecha" value="${today()}" max="${today()}"></label><label class="f wide"><span>Soporte</span><input type="text" name="soporte"></label></div>`,
    onSubmit:o=>{ if(!validISO(o.fecha)) return 'Indique una fecha válida.'; a.estado='Revocada'; a.fechaRevocatoria=o.fecha; a.soporteRev=o.soporte; log('Autorización revocada', p.codigo, a.tipo); mutate(); render(); toast('Revocatoria registrada'); }});
}

/* ---------- Consultas ---------- */
function fuentesActivas(){ return cfg().fuentes.filter(f=>f.activa).map(f=>({v:f.id, t:f.nombre})); }
function consultaBody(p){
  return `${p?`<p class="hint">Persona: <strong>${esc(nombre(p))}</strong> (${esc(p.codigo)})</p>`:''}<div class="fgrid">
    ${p?'':personaPicker()}
    <label class="f"><span>Fecha de la consulta</span><input type="date" name="fecha" value="${today()}" max="${today()}"></label>
    <label class="f"><span>Resultado</span><select name="resultado" data-toggle-hall>${opts(RESULTADOS,'Sin registro')}</select></label>
    <label class="f wide"><span>Fuente</span><select name="fuente">${opts(fuentesActivas(),'')}</select></label>
    <label class="f wide"><span>Ubicación del soporte</span><input type="text" name="soporte" placeholder="Ej.: PDF del certificado en la carpeta del expediente"></label>
    <label class="f wide"><span>Observación</span><input type="text" name="obs" data-sens></label>
    <div class="wide hall-extra" hidden><div class="banner warn" style="margin:0 0 10px">Se creará un registro hallado vigente asociado a esta consulta. Descríbalo de forma breve y objetiva.</div><div class="fgrid">
      <label class="f wide"><span>Descripción breve del registro</span><input type="text" name="hDesc" data-sens placeholder="Ej.: anotación vigente en la fuente; ver soporte"></label>
      <label class="f"><span>Valoración</span><select name="hVal">${opts(cfg().valoraciones,cfg().valoraciones[1]||cfg().valoraciones[0])}</select></label></div></div>
  </div>`;
}
function bindHallToggle(f){ const sel=f.querySelector('[data-toggle-hall]'); const box=f.querySelector('.hall-extra'); if(!sel||!box) return; const t=()=>box.hidden=sel.value!=='Con registro'; sel.addEventListener('change',t); t(); }
function registrarConsulta(p, o, lote){
  const c={id:uid(), personaId:p.id, fecha:o.fecha, fuenteId:o.fuente, resultado:o.resultado, soporte:o.soporte||'', obs:o.obs||'', consultadoPor:cfg().operador.nombre, creado:nowISO(), anulada:false, lote:lote||''};
  S.db.consultas.push(c);
  if(o.resultado==='Con registro'){
    const h={id:uid(), personaId:p.id, fuenteId:o.fuente, consultaId:c.id, fechaDeteccion:o.fecha, descripcion:o.hDesc||'', valoracion:o.hVal||cfg().valoraciones[1]||'', estado:'Vigente', soporte:o.soporte||'', creado:nowISO()};
    S.db.hallazgos.push(h); c.hallazgoId=h.id;
  }
  return c;
}
function nuevaConsulta(pid){
  const p0 = pid ? P(pid) : null;
  openDialog({title:'Registrar consulta de antecedentes', body:consultaBody(p0), submit:'Registrar consulta', onOpen:bindHallToggle, onSubmit:o=>{
    const p = p0 || resolvePersona(o.personaRef); if(!p) return 'Seleccione una persona registrada de la lista.';
    if(!o.fuente) return 'Seleccione la fuente.'; if(!validISO(o.fecha)) return 'Indique una fecha válida.'; if(o.fecha>today()) return 'La fecha no puede ser futura.';
    if(o.resultado==='Con registro' && !o.hDesc) return 'Describa brevemente el registro hallado.';
    registrarConsulta(p,o);
    log('Consulta registrada', p.codigo, `${fuenteNom(o.fuente)}: ${o.resultado}`);
    mutate(); render(); toast('Consulta registrada');
  }});
}
function consultaLote(){
  const ids=[...S.ui.personas.sel].filter(id=>P(id)&&!P(id).anon); if(!ids.length) return;
  openDialog({title:`Registrar consulta en lote (${ids.length} personas)`, submit:'Registrar consultas', body:`<p class="hint">Se registra la misma fuente, fecha y resultado "Sin registro" para todas las personas seleccionadas. Si alguna tuvo registro, regístrelo después en su ficha como consulta individual con resultado "Con registro".</p><div class="fgrid">
    <label class="f wide"><span>Fuente</span><select name="fuente">${opts(fuentesActivas(),'')}</select></label>
    <label class="f"><span>Fecha de la consulta</span><input type="date" name="fecha" value="${today()}" max="${today()}"></label>
    <label class="f wide"><span>Ubicación del soporte</span><input type="text" name="soporte" placeholder="Ej.: reporte consolidado de la plataforma"></label></div>`,
    onSubmit:o=>{ if(!o.fuente) return 'Seleccione la fuente.'; if(!validISO(o.fecha)||o.fecha>today()) return 'Indique una fecha válida, no futura.';
      const lote='L-'+Date.now().toString(36).toUpperCase();
      for(const id of ids) registrarConsulta(P(id), {...o, resultado:'Sin registro', obs:''}, lote);
      log('Consulta en lote registrada', lote, `${ids.length} personas; ${fuenteNom(o.fuente)}: Sin registro`);
      S.ui.personas.sel.clear(); mutate(); render(); toast(`${ids.length} consultas registradas`); }});
}
function anularConsulta(id){
  const c=S.db.consultas.find(x=>x.id===id), p=P(c.personaId);
  openDialog({title:'Anular consulta', danger:true, submit:'Anular consulta', body:`<p>Consulta del ${fmtD(c.fecha)} en ${esc(fuenteNom(c.fuenteId))}. La consulta anulada queda visible tachada y no cuenta para cumplimiento ni cifras.${c.hallazgoId?' El registro hallado asociado también se anulará.':''}</p><label class="f"><span>Motivo</span><input type="text" name="motivo" required></label>`,
    onSubmit:o=>{ if(!o.motivo) return 'Indique el motivo.'; c.anulada=true; c.motivoAnulacion=o.motivo; if(c.hallazgoId){ const h=S.db.hallazgos.find(x=>x.id===c.hallazgoId); if(h){ h.anulado=true; h.motivoAnulacion='Consulta anulada'; } } log('Consulta anulada', p.codigo, o.motivo); mutate(); render(); }});
}
function vConsultas(){
  const u=S.ui.consultas; S.listFn=listConsultas;
  return `<div class="page-head"><div><h1>Consultas de antecedentes</h1><div class="lead">Toda consulta realizada, por fuente, con su resultado y la ubicación del soporte.</div></div>
    <div class="head-actions"><button class="btn" type="button" data-act="importar" data-tipo="consultas">Importar histórico</button><button class="btn" type="button" data-act="exportConsultas">Exportar</button><button class="btn primary" type="button" data-act="nuevaConsulta">Registrar consulta</button></div></div>
    <div class="filters">
      <label>Buscar persona<input type="search" data-filter="consultas.q" value="${esc(u.q)}" placeholder="Nombre, documento o código"></label>
      <label>Fuente<select data-filter="consultas.fuente">${opts(cfg().fuentes.map(f=>({v:f.id,t:f.nombre})),u.fuente,'Todas')}</select></label>
      <label>Resultado<select data-filter="consultas.resultado">${opts(RESULTADOS,u.resultado,'Todos')}</select></label>
      <label>Desde<input type="date" data-filter="consultas.desde" value="${esc(u.desde)}"></label>
      <label>Hasta<input type="date" data-filter="consultas.hasta" value="${esc(u.hasta)}"></label>
      <label class="chk" style="align-self:center"><input type="checkbox" data-filter="consultas.anuladas" ${u.anuladas?'checked':''}> Incluir anuladas</label>
    </div><div id="list"></div>`;
}
function filtConsultas(){
  const u=S.ui.consultas, q=norm(u.q);
  return S.db.consultas.filter(c=>{ if(!u.anuladas&&c.anulada) return false; if(u.fuente&&c.fuenteId!==u.fuente) return false; if(u.resultado&&c.resultado!==u.resultado) return false; if(u.desde&&c.fecha<u.desde) return false; if(u.hasta&&c.fecha>u.hasta) return false; if(q){ const p=P(c.personaId); if(!norm(`${nombre(p)} ${p?.doc} ${p?.codigo}`).includes(q)) return false; } return true; }).sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.creado.localeCompare(a.creado));
}
function listConsultas(){
  const u=S.ui.consultas, rows=filtConsultas(), shown=rows.slice(0,u.limit), el=$('#list');
  const reg=rows.filter(c=>c.resultado==='Con registro'&&!c.anulada).length;
  el.innerHTML = `<p class="resultcount">${fmtN(rows.length)} consultas; ${fmtN(reg)} con registro</p>${rows.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Persona</th><th>Fuente</th><th>Resultado</th><th>Soporte</th><th>Registró</th></tr></thead><tbody>
  ${shown.map(c=>{ const p=P(c.personaId); return `<tr data-href="#/persona/${c.personaId}" class="${c.anulada?'anulado':''}"><td class="num">${fmtD(c.fecha)}</td><td>${esc(nombre(p))}<div class="sub">${esc(p?.codigo)}</div></td><td>${esc(fuenteNom(c.fuenteId))}</td><td>${c.resultado==='Con registro'?'<span class="tag bad">Con registro</span>':esc(c.resultado)}</td><td>${esc(c.soporte)}${c.lote?`<div class="sub">Lote ${esc(c.lote)}</div>`:''}</td><td>${esc(c.consultadoPor)}</td></tr>`; }).join('')}
  </tbody></table></div>${rows.length>shown.length?`<p class="more"><button class="btn" type="button" data-act="limitAll" data-view="consultas">Mostrar las ${fmtN(rows.length)}</button></p>`:''}`:'<p class="empty">No hay consultas con estos filtros.</p>'}`;
}

/* ---------- Hallazgos ---------- */
function nuevoHallazgo(pid){
  const p=P(pid);
  openDialog({title:'Registrar hallazgo', body:`<p class="hint">Persona: <strong>${esc(nombre(p))}</strong> (${esc(p.codigo)}). Use esta opción para registros conocidos por una fuente distinta de una consulta registrada.</p><div class="fgrid">
    <label class="f wide"><span>Fuente</span><select name="fuente">${opts(fuentesActivas(),'')}</select></label>
    <label class="f"><span>Fecha de detección</span><input type="date" name="fecha" value="${today()}" max="${today()}"></label>
    <label class="f"><span>Valoración</span><select name="val">${opts(cfg().valoraciones,cfg().valoraciones[1])}</select></label>
    <label class="f wide"><span>Descripción breve</span><input type="text" name="desc" data-sens required></label>
    <label class="f wide"><span>Ubicación del soporte</span><input type="text" name="soporte"></label></div>`,
    onSubmit:o=>{ if(!o.fuente) return 'Seleccione la fuente.'; if(!o.desc) return 'Describa el registro.'; if(!validISO(o.fecha)||o.fecha>today()) return 'Indique una fecha válida, no futura.';
      S.db.hallazgos.push({id:uid(), personaId:pid, fuenteId:o.fuente, fechaDeteccion:o.fecha, descripcion:o.desc, valoracion:o.val, estado:'Vigente', soporte:o.soporte, creado:nowISO()});
      log('Hallazgo registrado', p.codigo, fuenteNom(o.fuente)); mutate(); render(); toast('Hallazgo registrado'); }});
}
function levantarHallazgo(id){
  const h=S.db.hallazgos.find(x=>x.id===id), p=P(h.personaId);
  openDialog({title:'Registrar levantamiento del registro', submit:'Registrar levantamiento', body:`<p>${esc(nombre(p))}: registro en ${esc(fuenteNom(h.fuenteId))}, detectado el ${fmtD(h.fechaDeteccion)}.</p><p class="hint">El registro levantado sale del perfil activo y queda solo como trazabilidad en la vista de auditoría.</p><div class="fgrid">
    <label class="f"><span>Fecha en que se verificó el levantamiento</span><input type="date" name="fecha" value="${today()}" max="${today()}"></label>
    <label class="f wide"><span>Soporte de la verificación</span><input type="text" name="soporte" placeholder="Ej.: nueva consulta sin registro, certificado"></label>
    <label class="f wide"><span>Observación</span><input type="text" name="obs" data-sens></label></div>`,
    onSubmit:o=>{ if(!validISO(o.fecha)||o.fecha>today()) return 'Indique una fecha válida, no futura.'; if(o.fecha<h.fechaDeteccion) return 'La fecha es anterior a la detección.';
      Object.assign(h,{estado:'Levantado', fechaLevantamiento:o.fecha, soporteLev:o.soporte, obsLev:o.obs}); log('Registro levantado', p.codigo, fuenteNom(h.fuenteId)); mutate(); render(); toast('Levantamiento registrado'); }});
}
function vHallazgos(){
  const u=S.ui.hallazgos; S.listFn=listHallazgos;
  return `<div class="page-head"><div><h1>Registros hallados</h1><div class="lead">Registros detectados en las consultas. Los levantados se muestran solo al filtrarlos, como trazabilidad de auditoría.</div></div><div class="head-actions"><button class="btn" type="button" data-act="exportHallazgos">Exportar</button></div></div>
  <div class="filters">
    <label>Buscar persona<input type="search" data-filter="hallazgos.q" value="${esc(u.q)}"></label>
    <label>Estado<select data-filter="hallazgos.estado">${opts([{v:'Vigente',t:'Vigentes'},{v:'Levantado',t:'Levantados (auditoría)'},{v:'',t:'Todos'}],u.estado)}</select></label>
    <label>Valoración<select data-filter="hallazgos.valoracion">${opts(cfg().valoraciones,u.valoracion,'Todas')}</select></label>
    <label>Fuente<select data-filter="hallazgos.fuente">${opts(cfg().fuentes.map(f=>({v:f.id,t:f.nombre})),u.fuente,'Todas')}</select></label>
  </div><div id="list"></div>`;
}
function filtHallazgos(){ const u=S.ui.hallazgos, q=norm(u.q); return S.db.hallazgos.filter(h=>{ if(h.anulado) return false; if(u.estado&&h.estado!==u.estado) return false; if(u.valoracion&&h.valoracion!==u.valoracion) return false; if(u.fuente&&h.fuenteId!==u.fuente) return false; if(q){ const p=P(h.personaId); if(!norm(`${nombre(p)} ${p?.doc} ${p?.codigo}`).includes(q)) return false; } return true; }).sort((a,b)=>b.fechaDeteccion.localeCompare(a.fechaDeteccion)); }
function listHallazgos(){
  const rows=filtHallazgos(), u=S.ui.hallazgos, shown=rows.slice(0,u.limit);
  $('#list').innerHTML = `<p class="resultcount">${fmtN(rows.length)} registros</p>${rows.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Detectado</th><th>Persona</th><th>Fuente</th><th>Descripción</th><th>Valoración</th><th>Estado</th></tr></thead><tbody>
  ${shown.map(h=>{ const p=P(h.personaId); return `<tr data-href="#/persona/${h.personaId}"><td class="num">${fmtD(h.fechaDeteccion)}</td><td>${esc(nombre(p))}${p?.critico?' <span class="tag crit">Crítico</span>':''}<div class="sub">${esc(p?.codigo)}; ${esc(p?.estado)}</div></td><td>${esc(fuenteNom(h.fuenteId))}</td><td>${esc(h.descripcion)}</td><td>${esc(h.valoracion)}</td><td>${h.estado==='Vigente'?'<span class="tag bad">Vigente</span>':`<span class="tag hist">Levantado el ${fmtD(h.fechaLevantamiento)}</span>`}</td></tr>`; }).join('')}
  </tbody></table></div>`:'<p class="empty">No hay registros con estos filtros.</p>'}`;
}

/* ---------- Estudios y visitas ---------- */
function nuevoEstudio(pid){
  const p0 = pid ? P(pid) : null;
  openDialog({title:'Programar estudio de seguridad', submit:'Crear y abrir', body:`${p0?`<p class="hint">Persona: <strong>${esc(nombre(p0))}</strong> (${esc(p0.codigo)})${p0.critico?' <span class="tag crit">Crítico</span>':''}</p>`:''}<div class="fgrid">
    ${p0?'':personaPicker()}
    <label class="f"><span>Tipo de estudio</span><select name="tipo">${opts(TIPOS_EST,p0&&lastVisita(p0.id)?'Actualización periódica':'Ingreso')}</select></label>
    <label class="f"><span>Fecha programada</span><input type="date" name="fecha" value="${today()}"></label>
    <label class="f wide"><span>Ejecutor</span><input type="text" name="ejecutor" value="${esc(cfg().operador.nombre)}"><span class="hint">Si lo ejecuta una firma externa, indique su nombre y credencial de la Superintendencia de Vigilancia y Seguridad Privada.</span></label>
    <div class="wide"><label class="chk"><input type="checkbox" name="visita" ${p0?.critico?'checked':''}><span><strong>Incluye visita domiciliaria</strong><br><span class="hint">Requiere autorización específica y constancia de voluntariedad antes de registrarla como realizada.</span></span></label></div>
    <label class="f wide"><span>Motivo u observación</span><input type="text" name="obs" data-sens></label></div>`,
    onSubmit:async o=>{ const p=p0||resolvePersona(o.personaRef); if(!p) return 'Seleccione una persona registrada de la lista.'; if(!validISO(o.fecha)) return 'Indique una fecha válida.';
      const e2=await reservarSeq('estudio_'+o.fecha.slice(0,4),1); if(e2) return e2;
      const y=o.fecha.slice(0,4); const seq=(S.db.meta.seq.estudio[y]||0)+1; S.db.meta.seq.estudio[y]=seq;
      const e={id:uid(), codigo:`E-${y}-${String(seq).padStart(4,'0')}`, personaId:p.id, tipo:o.tipo, incluyeVisita:!!o.visita, fechaProgramada:o.fecha, fechaRealizacion:'', estado:'Programado', motivoNR:'', ejecutor:o.ejecutor, autorizacionId:'', volInicio:false, volCierre:false, soporteVol:'', municipio:p.municipio||'', direccion:'', fuentesInfo:[], checklist:{}, hechos:'', inferencias:'', conclusion:'', concepto:'', recomendaciones:'', obs:o.obs, creado:nowISO(), actualizado:nowISO(), informe:null};
      S.db.estudios.push(e); log('Estudio programado', e.codigo, `Persona ${p.codigo}${e.incluyeVisita?'; con visita domiciliaria':''}`); mutate(); location.hash='#/estudio/'+e.id; }});
}
function vEstudios(){
  const u=S.ui.estudios; S.listFn=listEstudios;
  const years=[...new Set(S.db.estudios.map(e=>(e.fechaRealizacion||e.fechaProgramada||'').slice(0,4)).filter(Boolean))].sort().reverse();
  return `<div class="page-head"><div><h1>Estudios y visitas</h1><div class="lead">Estudios de seguridad de personal y visitas domiciliarias, con su concepto e informe.</div></div>
    <div class="head-actions"><button class="btn" type="button" data-act="exportEstudios">Exportar</button><button class="btn primary" type="button" data-act="nuevoEstudio">Programar estudio</button></div></div>
  <div class="filters">
    <label>Buscar persona<input type="search" data-filter="estudios.q" value="${esc(u.q)}"></label>
    <label>Estado<select data-filter="estudios.estado">${opts(ESTADOS_EST,u.estado,'Todos')}</select></label>
    <label>Concepto<select data-filter="estudios.concepto">${opts(CONCEPTOS,u.concepto,'Todos')}</select></label>
    <label>Visita<select data-filter="estudios.visita">${opts([{v:'si',t:'Con visita'},{v:'no',t:'Sin visita'}],u.visita,'Todas')}</select></label>
    <label>Año<select data-filter="estudios.anio">${opts(years,u.anio,'Todos')}</select></label>
  </div><div id="list"></div>`;
}
function filtEstudios(){ const u=S.ui.estudios, q=norm(u.q); return S.db.estudios.filter(e=>{ if(u.estado&&e.estado!==u.estado) return false; if(u.concepto&&e.concepto!==u.concepto) return false; if(u.visita==='si'&&!e.incluyeVisita) return false; if(u.visita==='no'&&e.incluyeVisita) return false; if(u.anio&&!(e.fechaRealizacion||e.fechaProgramada||'').startsWith(u.anio)) return false; if(q){ const p=P(e.personaId); if(!norm(`${nombre(p)} ${p?.doc} ${p?.codigo} ${e.codigo}`).includes(q)) return false; } return true; }).sort((a,b)=>(b.fechaRealizacion||b.fechaProgramada).localeCompare(a.fechaRealizacion||a.fechaProgramada)); }
function listEstudios(){
  const rows=filtEstudios(), shown=rows.slice(0,S.ui.estudios.limit);
  $('#list').innerHTML = `<p class="resultcount">${fmtN(rows.length)} estudios</p>${rows.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Código</th><th>Persona</th><th>Tipo</th><th>Visita</th><th>Fecha</th><th>Estado</th><th>Concepto</th><th>Informe</th></tr></thead><tbody>
  ${shown.map(e=>{ const p=P(e.personaId); return `<tr data-href="#/estudio/${e.id}" class="${e.estado==='Anulado'?'anulado':''}"><td><a href="#/estudio/${e.id}">${esc(e.codigo)}</a></td><td>${esc(nombre(p))}${p?.critico?' <span class="tag crit">Crítico</span>':''}<div class="sub">${esc(p?.cargo||'')}</div></td><td>${esc(e.tipo)}</td><td>${e.incluyeVisita?'Sí':'No'}</td><td class="num">${fmtD(e.fechaRealizacion||e.fechaProgramada)}${!e.fechaRealizacion?'<div class="sub">programada</div>':''}</td><td>${esc(e.estado)}</td><td>${esc(e.concepto||'')}</td><td>${e.informe?esc(e.informe.codigo)+' v'+e.informe.versiones.length:''}</td></tr>`; }).join('')}
  </tbody></table></div>`:'<p class="empty">No hay estudios con estos filtros.</p>'}`;
}
function contentOf(e,p){
  const aut=S.db.autorizaciones.find(a=>a.id===e.autorizacionId);
  const oblig=cfg().fuentes.filter(f=>f.activa);
  const consultas=oblig.map(f=>{ const c=lastConsulta(p.id,f.id); if(!c||(e.fechaRealizacion&&c.fecha>e.fechaRealizacion)) return null;
    let resultado=c.resultado; if(c.hallazgoId){ const h=S.db.hallazgos.find(x=>x.id===c.hallazgoId); if(h&&h.estado==='Levantado'&&(!e.fechaRealizacion||h.fechaLevantamiento<=e.fechaRealizacion)) resultado='Sin anotación vigente (levantamiento verificado el '+fmtD(h.fechaLevantamiento)+')'; }
    return {fuente:f.nombre, fecha:c.fecha, resultado}; }).filter(Boolean);
  const hall=(idx().hall.get(p.id)||[]).filter(h=>!h.anulado&&h.estado==='Vigente').map(h=>({fuente:fuenteNom(h.fuenteId), fecha:h.fechaDeteccion, descripcion:h.descripcion, valoracion:h.valoracion}));
  return {
    estudio:{codigo:e.codigo, tipo:e.tipo, incluyeVisita:e.incluyeVisita, fechaRealizacion:e.fechaRealizacion, ejecutor:e.ejecutor, municipio:e.incluyeVisita?e.municipio:'', direccion:e.incluyeVisita?e.direccion:''},
    persona:{codigo:p.codigo, nombre:nombre(p), documento:`${p.tipoDoc} ${p.doc}`, vinculo:p.vinculo, empresa:p.empresa, cargo:p.cargo, critico:p.critico},
    autorizacion: aut?{tipo:aut.tipo, fecha:aut.fecha, version:aut.version, soporte:aut.soporte}:null,
    voluntariedad:{inicio:e.volInicio, cierre:e.volCierre, soporte:e.soporteVol},
    fundamento:cfg().fundamento,
    fuentesInfo:FUENTES_INFO.filter(f=>(e.fuentesInfo||[]).includes(f.k)).map(f=>({t:f.t, n:f.n})),
    consultas, hallazgos:hall,
    checklist:CHECKLIST.filter(c=>e.incluyeVisita||!c.visita).map(c=>({t:c.t, r:e.checklist?.[c.k]?.r||'', v:e.checklist?.[c.k]?.v||'', obs:e.checklist?.[c.k]?.obs||'', kind:c.kind||'res'})),
    hechos:e.hechos, inferencias:e.inferencias, conclusion:e.conclusion, concepto:e.concepto, recomendaciones:e.recomendaciones,
    advertencia:cfg().advertencia
  };
}
function vEstudio(id){
  const e=S.db.estudios.find(x=>x.id===id); if(!e) return `<p class="empty">El estudio no existe. <a href="#/estudios">Volver</a></p>`;
  const p=P(e.personaId);
  const autsEsp=(idx().aut.get(p.id)||[]).filter(a=>a.tipo===TIPOS_AUT[1]&&(a.estado==='Vigente'||a.id===e.autorizacionId));
  const lock = e.estado==='Anulado' || p.anon;
  let banner='';
  if(e.informe && e.informe.versiones.length){ const last=e.informe.versiones[e.informe.versiones.length-1]; if(last.snap && canon(last.snap.content)!==canon(contentOf(e,p))) banner=`<div class="banner warn">El estudio cambió después de emitir la versión ${last.v} del informe ${esc(e.informe.codigo)}. Emita una nueva versión para que el informe refleje el contenido actual.</div>`; }
  const ck = CHECKLIST.map(c=>{ const v=e.checklist?.[c.k]||{}; let ctrl;
    if(c.kind==='text') ctrl=`<input type="text" name="ck_${c.k}_v" value="${esc(v.v)}" aria-label="${esc(c.t)}">`;
    else if(c.kind==='number') ctrl=`<input type="number" min="0" max="30" name="ck_${c.k}_v" value="${esc(v.v)}" aria-label="${esc(c.t)}">`;
    else if(c.kind==='select') ctrl=`<select name="ck_${c.k}_v" aria-label="${esc(c.t)}">${opts(c.opts,v.v,'Seleccione')}</select>`;
    else ctrl=`<select name="ck_${c.k}_r" aria-label="${esc(c.t)}">${opts(CHECK_RES,v.r,'Seleccione')}</select>`;
    return `<tr class="${c.visita?'only-visita':''}"><td>${esc(c.t)}</td><td style="width:200px">${ctrl}</td><td><input type="text" name="ck_${c.k}_o" value="${esc(v.obs)}" data-sens aria-label="Observación"></td></tr>`; }).join('');
  return `<a class="back" href="#/persona/${p.id}">${esc(nombre(p))}</a>
  <div class="page-head"><div><h1>Estudio ${esc(e.codigo)}</h1><div class="lead">${esc(nombre(p))}, ${esc(p.cargo||'sin cargo')}${p.critico?', cargo crítico':''}. ${esc(p.vinculo)}${p.empresa?', '+esc(p.empresa):''}.</div></div>
    <div class="head-actions">${e.informe?e.informe.versiones.slice().reverse().map(v=>`<button class="btn" type="button" data-act="imprimirInforme" data-id="${e.id}" data-v="${v.v}" ${v.snap?'':'disabled'}>Informe v${v.v}</button>`).join(''):''}</div></div>
  ${banner}<div id="esterr"></div>
  <form id="estform" class="estform ${e.incluyeVisita?'has-visita':''} ${e.estado==='No realizado'?'st-nr':''}" data-id="${e.id}" novalidate>
  <fieldset ${lock?'disabled':''}><legend>Datos del estudio</legend><div class="fgrid">
    <label class="f"><span>Tipo</span><select name="tipo">${opts(TIPOS_EST,e.tipo)}</select></label>
    <label class="f"><span>Estado</span><select name="estado" data-est="estado">${opts(ESTADOS_EST.filter(x=>x!=='Anulado'||e.estado==='Anulado'),e.estado)}</select></label>
    <label class="f"><span>Fecha programada</span><input type="date" name="fechaProgramada" value="${esc(e.fechaProgramada)}"></label>
    <label class="f"><span>Fecha de realización</span><input type="date" name="fechaRealizacion" value="${esc(e.fechaRealizacion)}" max="${today()}"></label>
    <label class="f only-nr"><span>Motivo de no realización</span><select name="motivoNR">${opts(MOTIVOS_NR,e.motivoNR,'Seleccione')}</select></label>
    <label class="f"><span>Ejecutor</span><input type="text" name="ejecutor" value="${esc(e.ejecutor)}"></label>
    <div class="wide"><label class="chk"><input type="checkbox" name="incluyeVisita" data-est="visita" ${e.incluyeVisita?'checked':''}><span><strong>Incluye visita domiciliaria</strong></span></label></div>
    <label class="f wide"><span>Motivo u observación</span><input type="text" name="obs" value="${esc(e.obs)}" data-sens></label>
  </div></fieldset>

  <fieldset class="only-visita" ${lock?'disabled':''}><legend>Autorización y voluntariedad de la visita</legend>
    <p class="hint" style="margin-top:0">El ingreso al domicilio se legitima solo con el consentimiento del morador, revocable en cualquier momento (artículo 28 de la Constitución). Sin autorización específica vigente y constancia de inicio, la visita no puede registrarse como realizada.</p>
    <div class="fgrid">
    <label class="f wide"><span>Autorización específica de visita domiciliaria</span><select name="autorizacionId">${opts(autsEsp.map(a=>({v:a.id,t:`${fmtD(a.fecha)}; ${a.version||'sin versión'}${a.estado!=='Vigente'?' (revocada)':''}`})),e.autorizacionId,autsEsp.length?'Seleccione':'No hay autorizaciones específicas registradas')}</select>
      ${autsEsp.length?'':`<span class="hint">Regístrela en la ficha de la persona: <a href="#/persona/${p.id}">abrir ficha</a>.</span>`}</label>
    <div><label class="chk"><input type="checkbox" name="volInicio" ${e.volInicio?'checked':''}><span>Constancia de voluntariedad firmada al inicio</span></label></div>
    <div><label class="chk"><input type="checkbox" name="volCierre" ${e.volCierre?'checked':''}><span>Constancia de voluntariedad firmada al cierre</span></label></div>
    <label class="f wide"><span>Ubicación del soporte de las constancias</span><input type="text" name="soporteVol" value="${esc(e.soporteVol)}"></label>
    <label class="f"><span>Municipio</span><input type="text" name="municipio" value="${esc(e.municipio)}"></label>
    <label class="f wide"><span>Dirección visitada</span><input type="text" name="direccion" value="${esc(e.direccion)}"></label>
  </div></fieldset>

  <fieldset ${lock?'disabled':''}><legend>Fuentes de información utilizadas</legend><div class="fgrid">
    ${FUENTES_INFO.map(f=>`<div><label class="chk"><input type="checkbox" name="fuentesInfo[]" value="${f.k}" ${(e.fuentesInfo||[]).includes(f.k)?'checked':''}><span>${esc(f.t)}<br><span class="hint">${esc(f.n)}</span></span></label></div>`).join('')}
  </div></fieldset>

  <fieldset ${lock?'disabled':''}><legend>Lista de verificación</legend>
    <p class="hint" style="margin-top:0">No registre datos de salud, religión, política, afiliación sindical, vida sexual, origen étnico ni datos de familiares. Del hogar se registra solo la cifra de personas.</p>
    <div class="tblwrap"><table class="tbl cktbl"><thead><tr><th>Aspecto</th><th>Resultado</th><th>Observación</th></tr></thead><tbody>${ck}</tbody></table></div>
  </fieldset>

  <fieldset ${lock?'disabled':''}><legend>Constataciones y concepto</legend><div class="fgrid">
    <label class="f wide"><span>Hechos constatados</span><textarea name="hechos" rows="4" placeholder="Solo lo verificado directamente, sin valoraciones">${esc(e.hechos)}</textarea></label>
    <label class="f wide"><span>Inferencias razonables</span><textarea name="inferencias" rows="3" placeholder="Deducciones que se apoyan en los hechos anteriores">${esc(e.inferencias)}</textarea></label>
    <label class="f wide"><span>Conclusión técnica</span><textarea name="conclusion" rows="3">${esc(e.conclusion)}</textarea></label>
    <label class="f"><span>Concepto</span><select name="concepto">${opts(CONCEPTOS,e.concepto,'Seleccione')}</select></label>
    <label class="f wide"><span>Recomendaciones</span><textarea name="recomendaciones" rows="3" placeholder="Con responsable y plazo cuando aplique">${esc(e.recomendaciones)}</textarea></label>
  </div></fieldset>
  ${lock?'':`<div class="stickybar"><button class="btn primary" type="button" data-act="guardarEstudio">Guardar estudio</button><button class="btn" type="button" data-act="emitirInforme">${e.informe?'Emitir nueva versión del informe':'Emitir informe'}</button><span style="flex:1"></span><button class="btn ghost" type="button" data-act="anularEstudio">Anular estudio</button></div>`}
  </form>`;
}
function bindEstudio(){
  const f=$('#estform'); if(!f) return; S.estDirty=false;
  f.addEventListener('input', ()=>{ S.estDirty=true; });
  f.addEventListener('change', ev=>{ S.estDirty=true; const t=ev.target;
    if(t.dataset.est==='visita') f.classList.toggle('has-visita', t.checked);
    if(t.dataset.est==='estado'){ f.classList.toggle('st-nr', t.value==='No realizado'); if(t.value==='Realizado' && !f.fechaRealizacion.value) f.fechaRealizacion.value=today(); }
  });
}
function guardarEstudio(silent){
  const f=$('#estform'); const e=S.db.estudios.find(x=>x.id===f.dataset.id); const p=P(e.personaId); const o=formObj(f);
  const upd={tipo:o.tipo, estado:o.estado, fechaProgramada:o.fechaProgramada, fechaRealizacion:o.fechaRealizacion, motivoNR:o.estado==='No realizado'?o.motivoNR:'', ejecutor:o.ejecutor, incluyeVisita:!!o.incluyeVisita, obs:o.obs,
    autorizacionId:o.autorizacionId||'', volInicio:!!o.volInicio, volCierre:!!o.volCierre, soporteVol:o.soporteVol||'', municipio:o.municipio||'', direccion:o.direccion||'',
    fuentesInfo:o.fuentesInfo||[], checklist:{}, hechos:o.hechos, inferencias:o.inferencias, conclusion:o.conclusion, concepto:o.concepto, recomendaciones:o.recomendaciones};
  for(const c of CHECKLIST) upd.checklist[c.k]={r:o[`ck_${c.k}_r`]||'', v:o[`ck_${c.k}_v`]||'', obs:o[`ck_${c.k}_o`]||''};
  const errs=[];
  if(upd.fechaProgramada && !validISO(upd.fechaProgramada)) errs.push('La fecha programada no es válida.');
  if(upd.estado==='Realizado'){
    if(!validISO(upd.fechaRealizacion)) errs.push('Indique la fecha de realización.');
    else if(upd.fechaRealizacion>today()) errs.push('La fecha de realización no puede ser futura.');
    if(!upd.concepto) errs.push('Seleccione el concepto.');
    if(!upd.fuentesInfo.length) errs.push('Marque al menos una fuente de información utilizada.');
    if(upd.incluyeVisita){
      const a=S.db.autorizaciones.find(x=>x.id===upd.autorizacionId);
      if(!a) errs.push('Seleccione la autorización específica de visita domiciliaria.');
      else { if(a.estado!=='Vigente' && !(a.fechaRevocatoria && a.fechaRevocatoria>upd.fechaRealizacion)) errs.push('La autorización seleccionada estaba revocada en la fecha de la visita.'); if(a.fecha>upd.fechaRealizacion) errs.push('La autorización es posterior a la fecha de la visita; debe ser previa.'); }
      if(!upd.volInicio) errs.push('Registre la constancia de voluntariedad firmada al inicio de la visita.');
    }
  } else if(upd.estado==='No realizado' && !upd.motivoNR) errs.push('Indique el motivo por el que no se realizó.');
  const box=$('#esterr');
  if(errs.length){ box.innerHTML=`<div class="errs"><strong>No se guardó. Corrija lo siguiente:</strong><ul>${errs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`; box.scrollIntoView({behavior:'smooth', block:'start'}); return false; }
  box.innerHTML='';
  const before=canon({...e, informe:null, actualizado:null});
  const prevEstado=e.estado;
  Object.assign(e, upd);
  if(canon({...e, informe:null, actualizado:null})!==before){
    e.actualizado=nowISO();
    log(prevEstado!==e.estado?`Estudio ${e.estado.toLowerCase()}`:'Estudio actualizado', e.codigo, `Persona ${p.codigo}${e.estado==='Realizado'?'; concepto '+e.concepto:''}${e.estado==='No realizado'?'; '+e.motivoNR:''}`);
    mutate();
  }
  S.estDirty=false;
  if(!silent){ toast('Estudio guardado'); render(); }
  return true;
}
async function emitirInforme(){
  if(!guardarEstudio(true)) return;
  const id=$('#estform').dataset.id; const e=S.db.estudios.find(x=>x.id===id); const p=P(e.personaId);
  if(e.estado!=='Realizado'){ render(); $('#esterr').innerHTML='<div class="errs">El informe solo se emite para estudios en estado Realizado.</div>'; return; }
  const content=contentOf(e,p);
  if(e.informe && e.informe.versiones.length){ const last=e.informe.versiones[e.informe.versiones.length-1]; if(last.snap && canon(last.snap.content)===canon(content)){ toast('El contenido no cambió desde la versión '+last.v); render(); return; } }
  if(!e.informe){ const e2=await reservarSeq('informe_'+e.fechaRealizacion.slice(0,4),1); if(e2){ toast(e2); render(); return; } }
  if(!e.informe){ const y=e.fechaRealizacion.slice(0,4); const seq=(S.db.meta.seq.informe[y]||0)+1; S.db.meta.seq.informe[y]=seq; e.informe={codigo:`${cfg().prefijoInforme}-${y}-${String(seq).padStart(3,'0')}`, versiones:[]}; }
  const v=e.informe.versiones.length+1;
  const snap={meta:{codigo:e.informe.codigo, version:v, emitido:nowISO(), emisor:{...cfg().operador}}, content};
  const hash=await sha256Hex(canon(snap));
  e.informe.versiones.push({v, emitido:snap.meta.emitido, hash, snap});
  log('Informe emitido', `${e.informe.codigo} v${v}`, `Estudio ${e.codigo}; SHA-256 ${hash.slice(0,16)}…`);
  mutate(); render(); imprimirInforme(e.id, v);
}
function imprimirInforme(id, v){
  const e=S.db.estudios.find(x=>x.id===id); const ver=e.informe.versiones.find(x=>x.v===+v); if(!ver||!ver.snap){ toast('El contenido de esta versión fue suprimido.'); return; }
  const {meta, content:c}=ver.snap; const L=cfg().logo;
  const yn=b=>b?'Sí':'No';
  const para=t=>t?`<p>${esc(t)}</p>`:'<p class="empty">Sin anotaciones.</p>';
  const html=`<div class="rep">
    <table class="head"><tr><td class="logo" rowspan="3">${L?`<img src="${L}" alt="Avo Pak S.A.S.">`:'AVO PAK S.A.S.'}</td><td class="title" rowspan="3">Dirección de Seguridad Integral<br>Informe de estudio de seguridad de personal${c.estudio.incluyeVisita?' con visita domiciliaria':''}</td><td class="meta">Código: ${esc(meta.codigo)}</td></tr><tr><td class="meta">Versión: ${meta.version}</td></tr><tr><td class="meta">Emisión: ${fmtDT(meta.emitido)}</td></tr></table>
    <div class="class">Información estrictamente confidencial. Circulación restringida.</div>
    <h3 class="bar">1. Identificación</h3>
    <table class="kv"><tr><th>Estudio</th><td>${esc(c.estudio.codigo)}; ${esc(c.estudio.tipo)}</td></tr><tr><th>Fecha de realización</th><td>${fmtD(c.estudio.fechaRealizacion)}</td></tr><tr><th>Ejecutor</th><td>${esc(c.estudio.ejecutor)}</td></tr>
      <tr><th>Persona</th><td>${esc(c.persona.nombre)} (${esc(c.persona.codigo)})</td></tr><tr><th>Documento</th><td>${esc(c.persona.documento)}</td></tr><tr><th>Vínculo y empresa</th><td>${esc(c.persona.vinculo)}${c.persona.empresa?'; '+esc(c.persona.empresa):''}</td></tr><tr><th>Cargo</th><td>${esc(c.persona.cargo||'')}${c.persona.critico?' (cargo crítico)':''}</td></tr>
      ${c.estudio.incluyeVisita?`<tr><th>Lugar de la visita</th><td>${esc(c.estudio.direccion||'')}${c.estudio.municipio?', '+esc(c.estudio.municipio):''}</td></tr>`:''}</table>
    <h3 class="bar">2. Fundamento y autorización</h3>
    <p>${esc(c.fundamento)}</p>
    ${c.estudio.incluyeVisita?`<table class="kv"><tr><th>Autorización específica</th><td>${c.autorizacion?`${esc(c.autorizacion.tipo)}, firmada el ${fmtD(c.autorizacion.fecha)}${c.autorizacion.version?'; formato '+esc(c.autorizacion.version):''}${c.autorizacion.soporte?'; soporte: '+esc(c.autorizacion.soporte):''}`:'No registrada'}</td></tr>
      <tr><th>Constancia de voluntariedad</th><td>Al inicio: ${yn(c.voluntariedad.inicio)}. Al cierre: ${yn(c.voluntariedad.cierre)}.${c.voluntariedad.soporte?' Soporte: '+esc(c.voluntariedad.soporte):''}</td></tr></table>`:''}
    <h3 class="bar">3. Fuentes de información</h3>
    ${c.fuentesInfo.length?`<table><tr><th>Fuente</th><th>Naturaleza</th></tr>${c.fuentesInfo.map(f=>`<tr><td>${esc(f.t)}</td><td>${esc(f.n)}</td></tr>`).join('')}</table>`:'<p class="empty">No se indicaron.</p>'}
    <p><strong>Consultas de antecedentes vigentes a la fecha del estudio</strong></p>
    ${c.consultas.length?`<table><tr><th>Fuente</th><th>Fecha</th><th>Resultado</th></tr>${c.consultas.map(x=>`<tr><td>${esc(x.fuente)}</td><td>${fmtD(x.fecha)}</td><td>${esc(x.resultado)}</td></tr>`).join('')}</table>`:'<p class="empty">Sin consultas registradas.</p>'}
    <p><strong>Registros vigentes</strong></p>
    ${c.hallazgos.length?`<table><tr><th>Fuente</th><th>Detectado</th><th>Descripción</th><th>Valoración</th></tr>${c.hallazgos.map(x=>`<tr><td>${esc(x.fuente)}</td><td>${fmtD(x.fecha)}</td><td>${esc(x.descripcion)}</td><td>${esc(x.valoracion)}</td></tr>`).join('')}</table>`:'<p>No registra anotaciones vigentes en las fuentes consultadas.</p>'}
    <h3 class="bar">4. Hechos constatados</h3>
    <table><tr><th style="width:45%">Aspecto verificado</th><th style="width:18%">Resultado</th><th>Observación</th></tr>${c.checklist.map(x=>`<tr><td>${esc(x.t)}</td><td>${esc(x.kind==='res'?x.r:x.v)}</td><td>${esc(x.obs)}</td></tr>`).join('')}</table>
    ${para(c.hechos)}
    <h3 class="bar">5. Inferencias razonables</h3>${para(c.inferencias)}
    <h3 class="bar">6. Conclusión técnica y concepto</h3><p class="concepto">Concepto: ${esc(c.concepto)}</p>${para(c.conclusion)}
    <h3 class="bar">7. Recomendaciones</h3>${para(c.recomendaciones)}
    <h3 class="bar">8. Advertencia</h3><p>${esc(c.advertencia)}</p>
    <table class="firma"><tr><td style="height:34pt"></td></tr><tr><td class="line">${esc(meta.emisor.nombre)}<br>${esc(meta.emisor.cargo)}<br>Avo Pak S.A.S.</td></tr></table>
    <div class="foot">Huella de integridad SHA-256 del contenido emitido: ${ver.hash}. Cualquier alteración posterior del contenido produce una huella distinta, verificable contra la bitácora de la aplicación.</div>
  </div>`;
  const root=$('#print-root'); root.innerHTML=html;
  const done=()=>{ root.innerHTML=''; window.removeEventListener('afterprint',done); };
  window.addEventListener('afterprint', done);
  setTimeout(()=>window.print(), 60);
}
function anularEstudio(){
  const id=$('#estform').dataset.id; const e=S.db.estudios.find(x=>x.id===id); const p=P(e.personaId);
  openDialog({title:'Anular estudio', danger:true, submit:'Anular estudio', body:`<p>El estudio ${esc(e.codigo)} quedará anulado: se conserva para trazabilidad, pero no cuenta para cumplimiento ni cifras.${e.informe?' Los informes emitidos se conservan.':''}</p><label class="f"><span>Motivo</span><input type="text" name="motivo"></label>`,
    onSubmit:o=>{ if(!o.motivo) return 'Indique el motivo.'; e.estado='Anulado'; e.motivoAnulacion=o.motivo; log('Estudio anulado', e.codigo, `Persona ${p.codigo}; ${o.motivo}`); S.estDirty=false; mutate(); render(); }});
}

/* ---------- Vencimientos ---------- */
function vVenc(){
  const u=S.ui.venc; S.listFn=listVenc;
  const empresas=[...new Set(S.db.personas.map(p=>p.empresa).filter(Boolean))].sort();
  return `<div class="page-head"><div><h1>Vencimientos</h1><div class="lead">Autorizaciones faltantes, antecedentes y visitas vencidas o por vencer en los próximos ${cfg().diasAlerta} días, según la periodicidad configurada.</div></div><div class="head-actions"><button class="btn" type="button" data-act="exportVenc">Exportar</button></div></div>
  <div class="filters">
    <label>Asunto<select data-filter="venc.asunto">${opts(['Autorización','Antecedentes','Visita domiciliaria'],u.asunto,'Todos')}</select></label>
    <label>Situación<select data-filter="venc.estado">${opts([{v:'bad',t:'Requiere acción'},{v:'warn',t:'Por vencer'}],u.estado,'Todas')}</select></label>
    <label>Criticidad<select data-filter="venc.critico">${opts([{v:'si',t:'Cargos críticos'},{v:'no',t:'No críticos'}],u.critico,'Todas')}</select></label>
    <label>Vínculo<select data-filter="venc.vinculo">${opts(VINCULOS,u.vinculo,'Todos')}</select></label>
    <label>Empresa o finca<select data-filter="venc.empresa">${opts(empresas,u.empresa,'Todas')}</select></label>
  </div><div id="list"></div>`;
}
function filtVenc(){ const u=S.ui.venc; return vencimientos().filter(v=>(!u.asunto||v.asunto===u.asunto)&&(!u.estado||v.s===u.estado)&&(!u.vinculo||v.p.vinculo===u.vinculo)&&(!u.empresa||v.p.empresa===u.empresa)&&(u.critico!=='si'||v.p.critico)&&(u.critico!=='no'||!v.p.critico)); }
function listVenc(){
  const rows=filtVenc();
  const act=v=> v.asunto==='Antecedentes'?`<button class="btn sm" type="button" data-act="nuevaConsulta" data-pid="${v.p.id}">Registrar consulta</button>`: v.asunto==='Autorización'?`<button class="btn sm" type="button" data-act="nuevaAutorizacion" data-pid="${v.p.id}">Registrar autorización</button>`:`<button class="btn sm" type="button" data-act="nuevoEstudio" data-pid="${v.p.id}">Programar visita</button>`;
  $('#list').innerHTML = `<p class="resultcount">${fmtN(rows.length)} asuntos</p>${rows.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>Persona</th><th>Vínculo y empresa</th><th>Asunto</th><th>Situación</th><th>Detalle</th><th></th></tr></thead><tbody>
  ${rows.map(v=>`<tr><td><a href="#/persona/${v.p.id}">${esc(nombre(v.p))}</a>${v.p.critico?' <span class="tag crit">Crítico</span>':''}<div class="sub">${esc(v.p.cargo||'')}</div></td><td>${esc(v.p.vinculo)}<div class="sub">${esc(v.p.empresa||'')}</div></td><td>${esc(v.asunto)}</td><td>${stHTML(v.s,v.t)}</td><td class="sub">${esc(v.det)}</td><td>${act(v)}</td></tr>`).join('')}
  </tbody></table></div>`:'<p class="empty">No hay vencimientos con estos filtros.</p>'}`;
}

/* ---------- Bitácora ---------- */
function vBitacora(){
  S.listFn=listBitacora;
  return `<div class="page-head"><div><h1>Bitácora</h1><div class="lead">Registro de toda actuación, encadenado con huellas SHA-256. No se puede editar ni borrar. Las referencias usan códigos internos, no nombres.</div></div>
    <div class="head-actions"><button class="btn" type="button" data-act="verificarBitacora">Verificar integridad</button><button class="btn" type="button" data-act="exportBitacora">Exportar</button></div></div>
  <div id="bitres"></div>
  <div class="filters"><label>Buscar<input type="search" data-filter="bitacora.q" value="${esc(S.ui.bitacora.q)}" placeholder="Acción, código o detalle"></label></div><div id="list"></div>`;
}
function listBitacora(){
  const q=norm(S.ui.bitacora.q); const rows=S.db.bitacora.filter(e=>!q||norm(`${e.accion} ${e.ref} ${e.detalle} ${e.usuario}`).includes(q)).slice().reverse(); const shown=rows.slice(0,S.ui.bitacora.limit);
  $('#list').innerHTML = `<p class="resultcount">${fmtN(rows.length)} entradas</p><div class="tblwrap"><table class="tbl"><thead><tr><th class="n">N.º</th><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Referencia</th><th>Detalle</th></tr></thead><tbody>
  ${shown.map(e=>`<tr><td class="n">${e.n}</td><td class="num">${fmtDT(e.ts)}</td><td>${esc(e.usuario)}</td><td>${esc(e.accion)}</td><td>${e.ref.startsWith('P-')&&idx().byCode.get(e.ref)?`<a href="#/persona/${idx().byCode.get(e.ref).id}">${esc(e.ref)}</a>`:esc(e.ref)}</td><td>${esc(e.detalle)}</td></tr>`).join('')}
  </tbody></table></div>${rows.length>shown.length?`<p class="more"><button class="btn" type="button" data-act="limitAll" data-view="bitacora">Mostrar las ${fmtN(rows.length)}</button></p>`:''}`;
}

/* ---------- Configuración ---------- */
function vConfig(){
  const c=cfg(); const retirados=retiradosVencidos();
  return `<div class="page-head"><div><h1>Configuración</h1><div class="lead">Parámetros del registro. Los cambios quedan en la bitácora.</div></div></div>
  <form id="cfgform" novalidate>
  <section class="panel"><h2>Operador</h2><div class="fgrid">
    <label class="f"><span>Nombre</span><input type="text" name="opNombre" value="${esc(c.operador.nombre)}"></label>
    <label class="f"><span>Cargo</span><input type="text" name="opCargo" value="${esc(c.operador.cargo)}"></label></div></section>
  <section class="panel"><h2>Periodicidades</h2><p class="hint" style="margin-top:-6px">Son parámetros internos que deben coincidir con el procedimiento aprobado. La visita bienal para cargos críticos sigue el numeral 5.3 de la Resolución DIAN 015 de 2016; verifique su vigencia en el régimen OEA actual.</p><div class="fgrid">
    <label class="f"><span>Antecedentes, cargos críticos (meses)</span><input type="number" min="1" max="60" name="pcA" value="${c.periodicidad.critico.antecedentes}"></label>
    <label class="f"><span>Visita, cargos críticos (meses)</span><input type="number" min="0" max="60" name="pcV" value="${c.periodicidad.critico.visita}"></label>
    <label class="f"><span>Antecedentes, demás personal (meses)</span><input type="number" min="1" max="60" name="pgA" value="${c.periodicidad.general.antecedentes}"></label>
    <label class="f"><span>Visita, demás personal (meses; 0 = no aplica)</span><input type="number" min="0" max="60" name="pgV" value="${c.periodicidad.general.visita}"></label>
    <label class="f"><span>Días de aviso previo</span><input type="number" min="0" max="120" name="dias" value="${c.diasAlerta}"></label></div></section>
  <section class="panel"><h2>Fuentes de consulta</h2><p class="hint" style="margin-top:-6px">Catálogo cerrado. Incluya solo fuentes de consulta lícita; no registre información reservada obtenida por canales no públicos. Las obligatorias determinan si los antecedentes están al día.</p>
    <div class="cfg-src">${c.fuentes.map(f=>`<input type="text" name="fn_${f.id}" value="${esc(f.nombre)}" aria-label="Nombre de la fuente"><label class="chk"><input type="checkbox" name="fo_${f.id}" ${f.obligatoria?'checked':''}> Obligatoria</label><label class="chk"><input type="checkbox" name="fa_${f.id}" ${f.activa?'checked':''}> Activa</label>`).join('')}</div>
    <div class="fgrid" style="margin-top:12px"><label class="f wide"><span>Agregar fuente</span><input type="text" name="nuevaFuente" placeholder="Nombre de la entidad y del registro consultado"></label></div></section>
  <section class="panel"><h2>Empresas, fincas y valoraciones</h2><div class="fgrid">
    <label class="f"><span>Empresas y fincas (una por línea)</span><textarea name="empresas" rows="5">${esc(c.empresas.join('\n'))}</textarea></label>
    <label class="f"><span>Escala de valoración de hallazgos (una por línea)</span><textarea name="valoraciones" rows="5">${esc(c.valoraciones.join('\n'))}</textarea><span class="hint">Aliniéela con el instructivo de valoración de hallazgos vigente.</span></label></div></section>
  <section class="panel"><h2>Informes</h2><div class="fgrid">
    <label class="f"><span>Prefijo del código</span><input type="text" name="prefijo" value="${esc(c.prefijoInforme)}"><span class="hint">Provisional hasta su confirmación por Calidad.</span></label>
    <label class="f"><span>Logotipo (imagen, máximo 300 KB)</span><input type="file" name="logo" accept="image/png,image/jpeg">${c.logo?`<span class="hint">Cargado. <button class="linkbtn" type="button" data-act="quitarLogo">Quitar</button></span>`:''}</label>
    <label class="f wide"><span>Fundamento del estudio</span><textarea name="fundamento" rows="3">${esc(c.fundamento)}</textarea></label>
    <label class="f wide"><span>Advertencia de reserva</span><textarea name="advertencia" rows="3">${esc(c.advertencia)}</textarea></label></div></section>
  <section class="panel"><h2>Seguridad y conservación</h2><div class="fgrid">
    <label class="f"><span>Bloqueo por inactividad (minutos)</span><input type="number" min="2" max="60" name="bloqueo" value="${c.autoBloqueoMin}"></label>
    <label class="f"><span>Conservación tras el retiro (años)</span><input type="number" min="1" max="20" name="retencion" value="${c.retencionAnios}"><span class="hint">Valídelo con el responsable de protección de datos.</span></label></div></section>
  <div class="stickybar"><button class="btn primary" type="button" data-act="guardarConfig">Guardar configuración</button></div>
  </form>
  <section class="panel" style="margin-top:16px"><h2>Nube, llaves y respaldo</h2>
    <p class="hint" style="margin-top:-6px">La información se guarda en el proyecto Firebase «${esc(Nube.proyecto())}», cifrada en este equipo antes de enviarse: el servidor solo recibe texto cifrado. Este equipo conserva una copia, también cifrada, para trabajar sin conexión.</p>
    <p>Cuenta: <strong>${esc((Nube.usuario()||{}).email||'')}</strong>. Estado: ${esc($('#savestate')?$('#savestate').textContent:'')}.</p>
    <div class="head-actions"><button class="btn" type="button" data-act="sincronizarYa">Sincronizar ahora</button><button class="btn primary" type="button" data-act="respaldo">Descargar respaldo cifrado</button><button class="btn" type="button" data-act="cambiarClave">Cambiar clave de cifrado</button><button class="btn" type="button" data-act="nuevoCodigo">Nuevo código de recuperación</button><button class="btn" type="button" data-act="cambiarAcceso">Cambiar contraseña de acceso</button></div>
    <p class="hint">Descargue un respaldo cifrado al menos una vez al mes y guárdelo en su OneDrive corporativo: protege frente a la pérdida de la cuenta o del proyecto. Se abre con la clave de cifrado vigente al descargarlo.</p></section>
  <section class="panel"><h2>Supresión por vencimiento del plazo</h2>
    ${retirados.length?`<p>${fmtN(retirados.length)} personas retiradas superan el plazo de conservación de ${c.retencionAnios} años.</p><button class="btn" type="button" data-act="suprimirVencidos">Suprimir sus datos</button>`:'<p class="hint">Ninguna persona retirada supera el plazo de conservación.</p>'}</section>
  <section class="panel"><h2>Este equipo</h2><p class="hint" style="margin-top:-6px">Cerrar sesión conserva la copia cifrada para la próxima vez. Borrar la copia elimina los datos de este navegador; la información en la nube no se afecta. Almacenamiento: ${Store.mode==='idb'?'IndexedDB':'localStorage'}${S.persisted===true?', persistente':''}.</p><div class="head-actions"><button class="btn" type="button" data-act="cerrarSesion">Cerrar sesión</button><button class="btn danger" type="button" data-act="borrarTodo">Borrar la copia de este equipo</button></div></section>`;
}
function retiradosVencidos(){ const n=cfg().retencionAnios; return S.db.personas.filter(p=>!p.anon && p.estado==='Retirado' && p.fechaRetiro && addMonths(p.fechaRetiro, n*12)<today()); }
async function guardarConfig(){
  const f=$('#cfgform'); const o=formObj(f); const c=cfg(); const cambios=[];
  const int=(v,min,max,lbl)=>{ const n=parseInt(v,10); if(isNaN(n)||n<min||n>max) throw new Error(`${lbl}: valor entre ${min} y ${max}.`); return n; };
  let per, dias, bloq, ret, emp, val, logo=null;
  try{
    per={critico:{antecedentes:int(o.pcA,1,60,'Antecedentes de críticos'), visita:int(o.pcV,0,60,'Visita de críticos')}, general:{antecedentes:int(o.pgA,1,60,'Antecedentes del demás personal'), visita:int(o.pgV,0,60,'Visita del demás personal')}};
    dias=int(o.dias,0,120,'Días de aviso'); bloq=int(o.bloqueo,2,60,'Bloqueo'); ret=int(o.retencion,1,20,'Conservación');
    if(!o.opNombre) throw new Error('Indique el nombre del operador.');
    emp=o.empresas.split('\n').map(s=>s.trim()).filter(Boolean);
    val=o.valoraciones.split('\n').map(s=>s.trim()).filter(Boolean); if(!val.length) throw new Error('La escala de valoración no puede quedar vacía.');
    if(o.logo && o.logo.length){ const file=o.logo[0]; if(file.size>300*1024) throw new Error('El logotipo supera 300 KB.'); logo=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(file); }); }
  }catch(err){ toast(err.message); return; }
  {
    if(canon(per)!==canon(c.periodicidad)){ cambios.push('periodicidades'); c.periodicidad=per; }
    if(dias!==c.diasAlerta){ cambios.push('días de aviso'); c.diasAlerta=dias; }
    if(bloq!==c.autoBloqueoMin){ cambios.push('bloqueo'); c.autoBloqueoMin=bloq; }
    if(ret!==c.retencionAnios){ cambios.push('plazo de conservación'); c.retencionAnios=ret; }
    if(o.opNombre!==c.operador.nombre||o.opCargo!==c.operador.cargo){ cambios.push('operador'); c.operador={nombre:o.opNombre, cargo:o.opCargo}; }
    for(const fu of c.fuentes){ const nn=o['fn_'+fu.id], ob=!!o['fo_'+fu.id], ac=!!o['fa_'+fu.id]; if(nn&&nn!==fu.nombre){fu.nombre=nn; cambios.push('nombre de fuente');} if(ob!==fu.obligatoria||ac!==fu.activa){ fu.obligatoria=ob; fu.activa=ac; cambios.push('fuentes'); } }
    if(o.nuevaFuente){ c.fuentes.push({id:'f'+uid().slice(0,8), nombre:o.nuevaFuente, obligatoria:false, activa:true}); cambios.push('fuente agregada'); }
    if(canon(emp)!==canon(c.empresas)){ c.empresas=emp; cambios.push('empresas'); }
    if(canon(val)!==canon(c.valoraciones)){ c.valoraciones=val; cambios.push('valoraciones'); }
    if(o.prefijo&&o.prefijo!==c.prefijoInforme){ c.prefijoInforme=o.prefijo; cambios.push('prefijo de informe'); }
    if(o.fundamento!==c.fundamento){ c.fundamento=o.fundamento; cambios.push('fundamento'); }
    if(o.advertencia!==c.advertencia){ c.advertencia=o.advertencia; cambios.push('advertencia'); }
    if(logo){ c.logo=logo; cambios.push('logotipo'); }
  }
  if(!cambios.length){ toast('No hay cambios'); return; }
  log('Configuración modificada', '', [...new Set(cambios)].join(', ')); mutate(); render(); toast('Configuración guardada');
}

/* =====================================================================
   Importación CSV
   ===================================================================== */
function parseCSV(text){
  text=text.replace(/^﻿/,'');
  const first=text.split(/\r?\n/,1)[0];
  const delim=[';',',','\t'].map(d=>[d,first.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[]; let row=[], field='', q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){field+='"';i++;} else q=false; } else field+=ch; }
    else if(ch==='"') q=true;
    else if(ch===delim){ row.push(field); field=''; }
    else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n') i++; row.push(field); rows.push(row); row=[]; field=''; }
    else field+=ch;
  }
  if(field!==''||row.length){ row.push(field); rows.push(row); }
  return rows.filter(r=>r.some(x=>x.trim()!==''));
}
async function readTextFile(file){ const buf=await file.arrayBuffer(); let t=new TextDecoder('utf-8').decode(buf); if(t.includes('�')) t=new TextDecoder('windows-1252').decode(buf); return t; }
const TPL = {
  personas:['tipo_documento','numero_documento','nombres','apellidos','vinculo','empresa_finca','cargo','area','cargo_critico','estado','fecha_ingreso','municipio_residencia'],
  consultas:['numero_documento','fecha','fuente','resultado','soporte','observacion']
};
function plantilla(tipo){
  const ex = tipo==='personas'
    ? [['CC','1000000001','Nombre de ejemplo','Apellido de ejemplo','Trabajador Avo Pak','Avo Pak S.A.S.','Auxiliar de despacho','Logística','Sí','Activo','15/03/2025','La Ceja']]
    : [['1000000001','10/10/2026',cfg().fuentes[0].nombre,'Sin registro','Carpeta del expediente','']];
  exportCSV(`plantilla-${tipo}.csv`, TPL[tipo], ex);
}
function mapVinculo(v){ const n=norm(v); if(!n) return null; if(n.startsWith('trab')||n.includes('avo')) return VINCULOS[0]; if(n.includes('finca')) return VINCULOS[1]; if(n.startsWith('contrat')) return VINCULOS[2]; if(n.startsWith('aspir')) return VINCULOS[3]; return null; }
function mapEstado(v){ const n=norm(v); if(!n||n.startsWith('activ')) return 'Activo'; if(n.includes('selec')) return 'En selección'; if(n.startsWith('retir')) return 'Retirado'; return null; }
function mapBool(v){ return ['si','s','x','1','true','verdadero','critico'].includes(norm(v)); }
function analizarImport(tipo, rows){
  const head=rows[0].map(h=>norm(h).replace(/\s+/g,'_'));
  const need=TPL[tipo]; const miss=need.filter(n=>!head.includes(n) && ['numero_documento','nombres','fecha','fuente','resultado'].includes(n));
  if(miss.length) return {fatal:`Faltan columnas obligatorias: ${miss.join(', ')}. Use la plantilla.`};
  const col=k=>head.indexOf(k);
  const get=(r,k)=>{ const i=col(k); return i<0?'':String(r[i]??'').trim(); };
  const ok=[], errs=[]; const seen=new Set();
  rows.slice(1).forEach((r,i)=>{
    const line=i+2;
    if(tipo==='personas'){
      const o={tipoDoc:(get(r,'tipo_documento')||'CC').toUpperCase(), doc:get(r,'numero_documento').replace(/[.\s]/g,''), nombres:get(r,'nombres'), apellidos:get(r,'apellidos'), vinculo:mapVinculo(get(r,'vinculo')), empresa:get(r,'empresa_finca'), cargo:get(r,'cargo'), area:get(r,'area'), critico:mapBool(get(r,'cargo_critico')), estado:mapEstado(get(r,'estado')), fechaIngreso:parseDateLoose(get(r,'fecha_ingreso'))||'', municipio:get(r,'municipio_residencia')};
      if(!TIPOS_DOC.includes(o.tipoDoc)) o.tipoDoc='Otro';
      const e=[]; if(!o.doc) e.push('sin documento'); if(!o.nombres) e.push('sin nombres'); if(!o.vinculo) e.push('vínculo no reconocido'); if(!o.estado) e.push('estado no reconocido'); if(get(r,'fecha_ingreso')&&!o.fechaIngreso) e.push('fecha de ingreso inválida');
      const key=o.tipoDoc+'|'+o.doc; if(o.doc&&seen.has(key)) e.push('documento repetido en el archivo'); seen.add(key);
      if(e.length) errs.push(`Fila ${line}: ${e.join('; ')}`); else ok.push(o);
    } else {
      const docv=get(r,'numero_documento').replace(/[.\s]/g,''); const p=S.db.personas.find(x=>!x.anon&&norm(x.doc)===norm(docv));
      const fecha=parseDateLoose(get(r,'fecha')); const fn=norm(get(r,'fuente')); const f=cfg().fuentes.find(x=>norm(x.nombre)===fn)||cfg().fuentes.find(x=>fn&&norm(x.nombre).startsWith(fn));
      const rn=norm(get(r,'resultado')); const res = rn.startsWith('sin')?'Sin registro': rn.startsWith('con')?'Con registro': rn.startsWith('no')?'No concluyente':null;
      const e=[]; if(!p) e.push('persona no registrada'); if(!fecha||fecha>today()) e.push('fecha inválida o futura'); if(!f) e.push('fuente no reconocida'); if(!res) e.push('resultado no reconocido');
      if(e.length) errs.push(`Fila ${line}: ${e.join('; ')}`); else ok.push({p, o:{fecha, fuente:f.id, resultado:res, soporte:get(r,'soporte'), obs:get(r,'observacion'), hDesc:get(r,'observacion')||'Registro hallado en importación histórica; ver soporte', hVal:cfg().valoraciones[1]||cfg().valoraciones[0]}});
    }
  });
  return {ok, errs};
}
function importar(tipo){
  tipo = tipo || 'personas';
  let parsed=null;
  openDialog({title: tipo==='personas'?'Importar personas':'Importar consultas históricas', wide:true, submit:'Importar', body:`
    <p class="hint">Prepare el archivo en Excel con las columnas de la plantilla y guárdelo como CSV (delimitado por punto y coma o comas). Las fechas pueden ir como dd/mm/aaaa.</p>
    <p><button class="btn sm" type="button" data-act="plantilla" data-tipo="${tipo}">Descargar plantilla</button></p>
    ${tipo==='personas'
      ?`<p class="hint">Vínculo admitido: ${VINCULOS.join(', ')}. Estado: ${ESTADOS_P.join(', ')}. Cargo crítico: Sí o No.</p><label class="chk"><input type="checkbox" name="actualizar"> Actualizar los datos de personas ya registradas con el mismo documento</label>`
      :`<p class="hint">Las personas deben estar registradas antes. Fuentes admitidas: ${cfg().fuentes.map(f=>esc(f.nombre)).join('; ')}. Resultado: Sin registro, Con registro o No concluyente. Cada fila "Con registro" crea un registro hallado vigente.</p>`}
    <label class="f" style="margin-top:12px"><span>Archivo CSV</span><input type="file" name="archivo" accept=".csv,text/csv,text/plain"></label>
    <div id="impprev"></div>`,
    onOpen:f=>{ f.archivo.addEventListener('change', async()=>{ const file=f.archivo.files[0]; const box=$('#impprev'); parsed=null; if(!file){ box.innerHTML=''; return; }
      try{ const rows=parseCSV(await readTextFile(file)); if(rows.length<2){ box.innerHTML='<div class="banner bad">El archivo no tiene filas de datos.</div>'; return; }
        const r=analizarImport(tipo, rows); if(r.fatal){ box.innerHTML=`<div class="banner bad">${esc(r.fatal)}</div>`; return; } parsed=r;
        let dup=0; if(tipo==='personas') dup=r.ok.filter(o=>S.db.personas.some(p=>!p.anon&&p.tipoDoc===o.tipoDoc&&norm(p.doc)===norm(o.doc))).length;
        box.innerHTML=`<div class="banner ${r.errs.length?'warn':'ok'}" style="margin-top:12px">${fmtN(r.ok.length)} filas válidas${tipo==='personas'?`, de ellas ${fmtN(dup)} ya registradas`:''}. ${fmtN(r.errs.length)} filas con errores no se importarán.${r.errs.length?`<ul>${r.errs.slice(0,15).map(x=>`<li>${esc(x)}</li>`).join('')}${r.errs.length>15?`<li>y ${r.errs.length-15} más</li>`:''}</ul>`:''}</div>`;
      }catch(err){ box.innerHTML=`<div class="banner bad">${esc(err.message)}</div>`; } }); },
    onSubmit:async o=>{
      if(!parsed) return 'Seleccione un archivo válido.'; if(!parsed.ok.length) return 'No hay filas válidas para importar.';
      if(tipo==='personas'){
        const nuevosDoc=new Set(parsed.ok.filter(r=>!S.db.personas.some(p=>!p.anon&&p.tipoDoc===r.tipoDoc&&norm(p.doc)===norm(r.doc))).map(r=>r.tipoDoc+'|'+norm(r.doc)));
        if(nuevosDoc.size){ const e2=await reservarSeq('persona', nuevosDoc.size); if(e2) return e2; }
        let nuevos=0, act=0, omit=0;
        for(const r of parsed.ok){ const ex=S.db.personas.find(p=>!p.anon&&p.tipoDoc===r.tipoDoc&&norm(p.doc)===norm(r.doc));
          if(ex){ if(o.actualizar){ for(const k of ['nombres','apellidos','vinculo','empresa','cargo','area','estado','fechaIngreso','municipio']) if(r[k]) ex[k]=r[k]; ex.critico=r.critico; if(ex.estado==='Retirado'&&!ex.fechaRetiro) ex.fechaRetiro=today(); ex.actualizado=nowISO(); act++; } else omit++; }
          else { if(r.estado==='Retirado') r.fechaRetiro=today(); crearPersona(r); nuevos++; } }
        log('Importación de personas', '', `${nuevos} nuevas; ${act} actualizadas; ${omit} omitidas por existir; ${parsed.errs.length} filas con error`);
        mutate(); render(); toast(`${nuevos} personas importadas`);
      } else {
        const lote='H-'+Date.now().toString(36).toUpperCase(); let reg=0;
        for(const {p,o:c} of parsed.ok){ registrarConsulta(p,c,lote); if(c.resultado==='Con registro') reg++; }
        log('Importación de consultas históricas', lote, `${parsed.ok.length} consultas; ${reg} con registro; ${parsed.errs.length} filas con error`);
        mutate(); render(); toast(`${parsed.ok.length} consultas importadas`);
      }
    }});
}

/* =====================================================================
   Exportaciones
   ===================================================================== */
const EXPORTS = {
  exportPersonas(){ const rows=filtPersonas().map(p=>{ const c=cumpl(p), lc=lastConsultaAny(p.id), lv=lastVisita(p.id); return [p.codigo,p.tipoDoc,p.doc,p.nombres,p.apellidos,p.vinculo,p.empresa,p.cargo,p.area,p.critico?'Sí':'No',p.estado,fmtD(p.fechaIngreso),fmtD(p.fechaRetiro),p.municipio,lc?fmtD(lc.fecha):'',lv?fmtD(lv.fechaRealizacion):'',c.aut.t,c.ant.t,c.vis.t,G_LBL[c.g]]; });
    exportCSV(`personas-${stamp()}.csv`, ['Código','Tipo doc.','Documento','Nombres','Apellidos','Vínculo','Empresa o finca','Cargo','Área','Crítico','Estado','Ingreso','Retiro','Municipio','Última consulta','Última visita','Autorización','Antecedentes','Visita','Cumplimiento'], rows); log('Exportación', '', `Personas: ${rows.length} filas`); },
  exportConsultas(){ const rows=filtConsultas().map(c=>{ const p=P(c.personaId); return [fmtD(c.fecha),p?.codigo,nombre(p),p?.doc,fuenteNom(c.fuenteId),c.resultado,c.soporte,c.obs,c.consultadoPor,c.lote||'',c.anulada?'Sí':'No']; });
    exportCSV(`consultas-${stamp()}.csv`, ['Fecha','Código','Persona','Documento','Fuente','Resultado','Soporte','Observación','Registró','Lote','Anulada'], rows); log('Exportación', '', `Consultas: ${rows.length} filas`); },
  exportHallazgos(){ const rows=filtHallazgos().map(h=>{ const p=P(h.personaId); return [fmtD(h.fechaDeteccion),p?.codigo,nombre(p),fuenteNom(h.fuenteId),h.descripcion,h.valoracion,h.estado,fmtD(h.fechaLevantamiento)]; });
    exportCSV(`registros-hallados-${stamp()}.csv`, ['Detectado','Código','Persona','Fuente','Descripción','Valoración','Estado','Levantado'], rows); log('Exportación', '', `Registros hallados: ${rows.length} filas`); },
  exportEstudios(){ const rows=filtEstudios().map(e=>{ const p=P(e.personaId); return [e.codigo,p?.codigo,nombre(p),p?.cargo,p?.critico?'Sí':'No',e.tipo,e.incluyeVisita?'Sí':'No',fmtD(e.fechaProgramada),fmtD(e.fechaRealizacion),e.estado,e.motivoNR,e.concepto,e.ejecutor,e.informe?e.informe.codigo:'',e.informe?e.informe.versiones.length:'']; });
    exportCSV(`estudios-${stamp()}.csv`, ['Código','Código persona','Persona','Cargo','Crítico','Tipo','Visita','Programado','Realizado','Estado','Motivo no realización','Concepto','Ejecutor','Informe','Versiones'], rows); log('Exportación', '', `Estudios: ${rows.length} filas`); },
  exportVenc(){ const rows=filtVenc().map(v=>[v.p.codigo,nombre(v.p),v.p.vinculo,v.p.empresa,v.p.cargo,v.p.critico?'Sí':'No',v.asunto,v.t,fmtD(v.d),v.det]);
    exportCSV(`vencimientos-${stamp()}.csv`, ['Código','Persona','Vínculo','Empresa o finca','Cargo','Crítico','Asunto','Situación','Fecha límite','Detalle'], rows); log('Exportación', '', `Vencimientos: ${rows.length} filas`); },
  exportBitacora(){ const rows=S.db.bitacora.map(e=>[e.n,fmtDT(e.ts),e.usuario,e.accion,e.ref,e.detalle,e.hash]);
    exportCSV(`bitacora-${stamp()}.csv`, ['N.º','Fecha y hora','Usuario','Acción','Referencia','Detalle','Huella SHA-256'], rows); log('Exportación', '', `Bitácora: ${rows.length} filas`); },
  exportCifras(){
    const db=S.db, y=S.ui.tab.anio, inY=d=>d&&(y==='todos'||d.startsWith(y));
    const act=db.personas.filter(p=>!p.anon&&p.estado==='Activo'), crit=act.filter(p=>p.critico);
    const cons=db.consultas.filter(c=>!c.anulada&&inY(c.fecha)), ests=db.estudios.filter(e=>e.estado==='Realizado'&&inY(e.fechaRealizacion)); const venc=vencimientos();
    const rows=[['Fecha de corte',fmtD(today())],['Periodo',y==='todos'?'Todo el histórico':y],['Personas activas',act.length],['Personas en selección',db.personas.filter(p=>!p.anon&&p.estado==='En selección').length],['Cargos críticos activos',crit.length],
      ['Críticos con visita al día',crit.filter(p=>['ok','warn'].includes(cumpl(p).vis.s)).length],['Activos con antecedentes al día',act.filter(p=>['ok','warn'].includes(cumpl(p).ant.s)).length],
      ['Registros vigentes',db.hallazgos.filter(h=>!h.anulado&&h.estado==='Vigente'&&vigente(P(h.personaId))).length],['Registros levantados en el periodo',db.hallazgos.filter(h=>!h.anulado&&h.estado==='Levantado'&&inY(h.fechaLevantamiento)).length],
      ['Consultas en el periodo',cons.length],['Consultas con registro',cons.filter(c=>c.resultado==='Con registro').length],['Estudios realizados',ests.length],['Estudios con visita domiciliaria',ests.filter(e=>e.incluyeVisita).length],
      ...CONCEPTOS.map(c=>['Concepto: '+c, ests.filter(e=>e.concepto===c).length]),['Estudios no realizados por negativa del titular',db.estudios.filter(e=>e.estado==='No realizado'&&e.motivoNR==='Negativa del titular'&&inY(e.fechaProgramada)).length],
      ['Asuntos vencidos',venc.filter(v=>v.s==='bad').length],['Asuntos por vencer',venc.filter(v=>v.s==='warn').length]];
    exportCSV(`cifras-estudios-${stamp()}.csv`, ['Indicador','Valor'], rows); log('Exportación', '', 'Cifras del tablero'); }
};

/* =====================================================================
   Respaldo, llaves y cuenta
   ===================================================================== */
async function guardarLlaveLocal(l){ const u=Nube.usuario(); await Store.set('llave', {uid:u?u.uid:'', inst:Nube.inst.id, adminUid:Nube.inst.adminUid, pass:l.pass, rec:l.rec}); }
async function llaveActual(){
  try{ const l=await Nube.leerLlave(); if(l){ await guardarLlaveLocal(l); return l; } }catch(e){}
  const loc=await Store.get('llave'); return loc && loc.inst===Nube.inst.id ? {pass:loc.pass, rec:loc.rec} : null;
}
function respaldo(){
  openDialog({title:'Descargar respaldo cifrado', submit:'Descargar respaldo', body:`<p class="hint">Copia completa en un archivo cifrado con su clave de cifrado actual. Guárdelo en su OneDrive corporativo. Sirve para reinstalar la aplicación en un proyecto nuevo si el actual se perdiera.</p><label class="f"><span>Clave de cifrado</span><input type="password" name="clave" autocomplete="current-password"></label>`,
    onSubmit:async o=>{
      const llave=await llaveActual(); if(!llave) return 'No se encontró la llave de datos.';
      if(!await Nube.verificarClave(llave, o.clave)) return 'La clave de cifrado no es correcta.';
      S.db.meta.ultimoRespaldo=nowISO();
      await log('Respaldo cifrado descargado','','');
      await saveNow();
      const salt=crypto.getRandomValues(new Uint8Array(16)); const key=await deriveKey(o.clave, salt, KDF_ITER);
      const env=await seal(S.db, key, salt, KDF_ITER);
      download(`respaldo-estudios-seguridad-${stamp()}.avpk`, JSON.stringify(env), 'application/octet-stream');
      updateChrome(); toast('Respaldo cifrado descargado');
    }});
}
function cambiarClave(){
  openDialog({title:'Cambiar clave de cifrado', submit:'Cambiar clave', body:`<div class="fgrid"><label class="f wide"><span>Clave de cifrado actual</span><input type="password" name="actual" autocomplete="current-password"></label><label class="f wide"><span>Nueva clave de cifrado (mínimo 12 caracteres)</span><input type="password" name="nueva" autocomplete="new-password"></label><label class="f wide"><span>Repita la nueva clave</span><input type="password" name="nueva2" autocomplete="new-password"></label></div><p class="hint">Requiere conexión. Cambia la clave que protege la llave de datos en todos sus equipos. Los respaldos ya descargados se siguen abriendo con la clave con la que se generaron. El código de recuperación no cambia.</p>`,
    onSubmit:async o=>{
      const err=claveDebil(o.nueva,o.nueva2); if(err) return err;
      let r; try{ const llave=await Nube.leerLlave(); r=await Nube.cambiarClave(llave, o.actual, o.nueva); }catch(e){ return Nube.errorTexto(e); }
      if(!r) return 'La clave de cifrado actual no es correcta.';
      await guardarLlaveLocal(r); await log('Clave de cifrado cambiada','',''); await saveNow(); toast('Clave de cifrado cambiada');
    }});
}
function nuevoCodigo(){
  openDialog({title:'Generar nuevo código de recuperación', submit:'Generar código', body:`<p class="hint">El código anterior deja de servir. Use esta opción si el código se extravió o pudo ser visto por otra persona. Requiere conexión.</p><label class="f"><span>Clave de cifrado</span><input type="password" name="clave" autocomplete="current-password"></label>`,
    onSubmit:async o=>{
      let r; try{ const llave=await Nube.leerLlave(); r=await Nube.regenerarCodigo(llave, o.clave); }catch(e){ return Nube.errorTexto(e); }
      if(!r) return 'La clave de cifrado no es correcta.';
      await guardarLlaveLocal(r.llave); await log('Código de recuperación reemplazado','',''); await saveNow();
      setTimeout(()=>openDialog({title:'Nuevo código de recuperación', submit:null, body:codigoHTML(r.codigo)+`<p class="hint">Guárdelo en un lugar seguro, separado del computador. No se vuelve a mostrar.</p><p><button class="btn" type="button" id="codprint">Imprimir</button></p>`, onOpen:f=>{ f.querySelector('#codprint').onclick=()=>imprimirCodigo(r.codigo); }}), 50);
    }});
}
function cambiarAcceso(){
  openDialog({title:'Cambiar contraseña de acceso', submit:'Cambiar contraseña', body:`<div class="fgrid"><label class="f wide"><span>Contraseña de acceso actual</span><input type="password" name="actual" autocomplete="current-password"></label><label class="f wide"><span>Nueva contraseña de acceso (mínimo 10 caracteres)</span><input type="password" name="nueva" autocomplete="new-password"></label><label class="f wide"><span>Repita la nueva contraseña</span><input type="password" name="nueva2" autocomplete="new-password"></label></div><p class="hint">Es la contraseña con la que entra a la cuenta. No cambia la clave de cifrado.</p>`,
    onSubmit:async o=>{
      if(!o.nueva||o.nueva.length<10) return 'La contraseña de acceso debe tener al menos 10 caracteres.'; if(o.nueva!==o.nueva2) return 'Las contraseñas no coinciden.';
      try{ await Nube.cambiarContrasena(o.actual, o.nueva); }catch(e){ return Nube.errorTexto(e); }
      await log('Contraseña de acceso cambiada','',''); toast('Contraseña de acceso cambiada');
    }});
}
function claveDebil(a,b){ if(!a||a.length<12) return 'La clave de cifrado debe tener al menos 12 caracteres.'; if(a!==b) return 'Las claves no coinciden.'; if(/^(.)\1+$/.test(a)) return 'La clave es demasiado simple.'; return null; }
function migrate(db){
  db.meta.seq = db.meta.seq || {persona:0, estudio:{}, informe:{}}; db.meta.seq.estudio=db.meta.seq.estudio||{}; db.meta.seq.informe=db.meta.seq.informe||{};
  for(const k of ['personas','autorizaciones','consultas','hallazgos','estudios','bitacora']) db[k]=db[k]||[];
  const d=defaultDB({nombre:'',cargo:''}).config; db.config={...d, ...db.config}; db.config.periodicidad={...d.periodicidad, ...db.config.periodicidad};
  return db;
}
const codigoHTML = c => `<div class="codrec" aria-label="Código de recuperación">${esc(c)}</div>`;
function imprimirCodigo(c){
  $('#print-root').innerHTML=`<div class="codprint"><h1>Código de recuperación</h1><p>Aplicación de estudios de seguridad de personal, Dirección de Seguridad Integral, Avo Pak S.A.S. Proyecto: ${esc(Nube.proyecto())}.</p>${codigoHTML(c)}<p>Generado el ${esc(fmtDT(nowISO()))}. Permite recuperar la información si se olvida la clave de cifrado. Guárdelo en sobre cerrado, en un lugar seguro y separado del computador. Quien tenga este código y acceso a la cuenta puede leer la información.</p></div>`;
  window.print();
}

/* =====================================================================
   Pantallas de acceso, desbloqueo e instalación
   ===================================================================== */
const LOCK_HEAD = `<div class="lock-brand">Avo Pak S.A.S., Dirección de Seguridad Integral</div><h1>Registro de estudios de seguridad de personal</h1>`;
function lockErr(t){ const e=$('#lockerr'); if(e){ e.textContent=t; e.hidden=!t; } }
function renderLock(mode, msg){
  $('#app').hidden=true; const L=$('#lock'); L.hidden=false;
  const aviso = msg ? `<div class="lock-msg">${esc(msg)}</div>` : '';
  const err = `<div id="lockerr" class="dlg-err" hidden style="margin:12px 0 0"></div>`;
  if(mode==='config'){
    L.innerHTML=`<div class="lock-card">${LOCK_HEAD}<div class="lock-msg">Falta configurar el proyecto de Firebase.</div><p>Edite el archivo <strong>config.js</strong> en GitHub y pegue el bloque de configuración que le muestra Firebase (Configuración del proyecto, Tus apps, App web). Luego recargue esta página.</p></div>`;
    return;
  }
  if(mode==='cargando'){ L.innerHTML=`<div class="lock-card">${LOCK_HEAD}<p class="lock-wait">${esc(msg||'Un momento…')}</p></div>`; return; }
  if(mode==='error'){
    L.innerHTML=`<div class="lock-card">${LOCK_HEAD}${aviso}<p><button class="btn primary" type="button" id="reint">Reintentar</button></p></div>`;
    $('#reint').onclick=()=>arrancar(); return;
  }
  if(mode==='login'){
    L.innerHTML=`<div class="lock-card">${LOCK_HEAD}${aviso}<form id="loginform" novalidate><div class="fgrid" style="grid-template-columns:1fr">
      <label class="f"><span>Correo de la cuenta</span><input type="email" name="correo" autocomplete="username" required></label>
      <label class="f"><span>Contraseña de acceso</span><input type="password" name="clave" autocomplete="current-password"></label></div>${err}
      <p style="margin-top:16px"><button class="btn primary" type="submit">Entrar</button></p></form>
      <div class="lock-links"><button class="linkbtn" type="button" id="olvido">Olvidé la contraseña de acceso</button></div></div>`;
    $('#loginform').onsubmit=async ev=>{ ev.preventDefault(); const o=formObj(ev.target); const b=ev.target.querySelector('button[type=submit]');
      if(!o.correo||!o.clave){ lockErr('Escriba el correo y la contraseña de acceso.'); return; }
      b.disabled=true; b.textContent='Verificando…'; lockErr('');
      try{ await Nube.entrar(o.correo, o.clave); }catch(e){ lockErr(Nube.errorTexto(e)); b.disabled=false; b.textContent='Entrar'; } };
    $('#olvido').onclick=async()=>{ const c=$('#loginform').correo.value.trim(); if(!c){ lockErr('Escriba primero el correo de la cuenta.'); return; }
      try{ await Nube.restablecer(c); lockErr(''); toast('Si el correo corresponde a la cuenta, recibirá un enlace para restablecer la contraseña de acceso.'); }catch(e){ lockErr(Nube.errorTexto(e)); } };
    setTimeout(()=>{ const i=$('#loginform input'); if(i) i.focus(); },50);
    return;
  }
  if(mode==='unlock'){
    const u=Nube.usuario();
    L.innerHTML=`<div class="lock-card">${LOCK_HEAD}${aviso}<p class="hint">Cuenta: ${esc(u?u.email:'')}</p>
      <form id="unlockform" novalidate><label class="f"><span>Clave de cifrado</span><input type="password" name="pass" autocomplete="current-password"></label>${err}
      <p style="margin-top:16px"><button class="btn primary" type="submit">Desbloquear</button></p></form>
      <div class="lock-links"><button class="linkbtn" type="button" id="olvclave">Olvidé la clave de cifrado</button><button class="linkbtn" type="button" id="salir">Cerrar sesión</button></div></div>`;
    $('#unlockform').onsubmit=async ev=>{ ev.preventDefault(); const o=formObj(ev.target); const btn=ev.target.querySelector('button[type=submit]');
      if(!o.pass){ lockErr('Escriba la clave de cifrado.'); return; }
      btn.disabled=true; btn.textContent='Descifrando…'; lockErr('');
      try{ await desbloquear(o.pass); }catch(err){ if(!$('#unlockform')) renderLock('unlock'); lockErr(err.message); const b=$('#unlockform button[type=submit]'); if(b){ b.disabled=false; b.textContent='Desbloquear'; } } };
    $('#olvclave').onclick=()=>renderLock('recuperar');
    $('#salir').onclick=()=>cerrarTodo(false);
    setTimeout(()=>{ const i=$('#unlockform input'); if(i) i.focus(); },50);
    return;
  }
  if(mode==='recuperar'){
    L.innerHTML=`<div class="lock-card">${LOCK_HEAD}<p>Escriba el código de recuperación que guardó al instalar y defina una clave de cifrado nueva. Requiere conexión.</p>
      <form id="recform" novalidate><div class="fgrid" style="grid-template-columns:1fr">
      <label class="f"><span>Código de recuperación</span><input type="text" name="codigo" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"></label>
      <label class="f"><span>Nueva clave de cifrado (mínimo 12 caracteres)</span><input type="password" name="nueva" autocomplete="new-password"></label>
      <label class="f"><span>Repita la nueva clave</span><input type="password" name="nueva2" autocomplete="new-password"></label></div>${err}
      <p style="margin-top:16px"><button class="btn primary" type="submit">Recuperar acceso</button></p></form>
      <div class="lock-links"><button class="linkbtn" type="button" id="volver">Volver</button></div></div>`;
    $('#volver').onclick=()=>renderLock('unlock');
    $('#recform').onsubmit=async ev=>{ ev.preventDefault(); const o=formObj(ev.target); const btn=ev.target.querySelector('button[type=submit]');
      if(Nube.normCodigo(o.codigo).length!==24){ lockErr('El código tiene 24 letras y números (sin contar los guiones).'); return; }
      const e2=claveDebil(o.nueva,o.nueva2); if(e2){ lockErr(e2); return; }
      btn.disabled=true; btn.textContent='Verificando…'; lockErr('');
      try{
        const llave=await Nube.leerLlave(); const r=await Nube.recuperar(llave, o.codigo, o.nueva);
        if(!r){ lockErr('El código de recuperación no es correcto.'); btn.disabled=false; btn.textContent='Recuperar acceso'; return; }
        await guardarLlaveLocal(r); await cargarDatos();
        await log('Acceso recuperado con el código de recuperación; nueva clave de cifrado','',''); mutate();
        toast('Acceso recuperado. Considere generar un código de recuperación nuevo en Configuración.');
      }catch(err){ lockErr(Nube.errorTexto(err)); btn.disabled=false; btn.textContent='Recuperar acceso'; } };
    return;
  }
  if(mode==='instalar'){
    L.innerHTML=`<div class="lock-card wide">${LOCK_HEAD}<p>Primera instalación en el proyecto Firebase «${esc(Nube.proyecto())}». Los datos se cifran en su equipo (AES-256) antes de enviarse: el servidor solo guarda texto cifrado.</p>
      <form id="instform" novalidate>
      <h2 class="lock-h2">1. Cuenta de acceso</h2><div class="fgrid">
        <label class="f wide"><span>Correo de la cuenta</span><input type="email" name="correo" autocomplete="username"></label>
        <label class="f"><span>Contraseña de acceso (mínimo 10 caracteres)</span><input type="password" name="clave" autocomplete="new-password"></label>
        <label class="f"><span>Repita la contraseña</span><input type="password" name="clave2" autocomplete="new-password"></label>
        <label class="f wide"><span>Código de instalación</span><input type="text" name="codigo" autocomplete="off" spellcheck="false"><span class="hint">Está en el archivo de reglas de Firestore que le entregaron con la aplicación.</span></label></div>
      <h2 class="lock-h2">2. Operador</h2><div class="fgrid">
        <label class="f"><span>Nombre</span><input type="text" name="nombre" autocomplete="name"></label>
        <label class="f"><span>Cargo</span><input type="text" name="cargo" value="Director de Seguridad Integral"></label></div>
      <h2 class="lock-h2">3. Clave de cifrado</h2><p class="hint">Distinta de la contraseña de acceso. Sin ella, o sin el código de recuperación, nadie puede leer la información, tampoco usted.</p><div class="fgrid">
        <label class="f"><span>Clave de cifrado (mínimo 12 caracteres)</span><input type="password" name="cif" autocomplete="new-password"></label>
        <label class="f"><span>Repita la clave de cifrado</span><input type="password" name="cif2" autocomplete="new-password"></label></div>
      <h2 class="lock-h2">4. Datos de la versión anterior (opcional)</h2><p class="hint">Si ya usaba el archivo Registro_Estudios_Seguridad_DSI.html, descargue allí un respaldo (Configuración, Descargar respaldo cifrado) y selecciónelo aquí con su contraseña maestra.</p><div class="fgrid">
        <label class="f"><span>Archivo de respaldo (.avpk)</span><input type="file" name="archivo" accept=".avpk,.json,application/json,application/octet-stream"></label>
        <label class="f"><span>Contraseña del respaldo</span><input type="password" name="passres" autocomplete="off"></label></div>
      ${err}<p style="margin-top:16px"><button class="btn primary" type="submit">Instalar</button></p></form></div>`;
    $('#instform').onsubmit=async ev=>{ ev.preventDefault(); const o=formObj(ev.target); const btn=ev.target.querySelector('button[type=submit]');
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.correo||'')) return lockErr('Escriba un correo válido.');
      if(!o.clave||o.clave.length<10) return lockErr('La contraseña de acceso debe tener al menos 10 caracteres.');
      if(o.clave!==o.clave2) return lockErr('Las contraseñas de acceso no coinciden.');
      if(!o.codigo) return lockErr('Escriba el código de instalación.');
      if(!o.nombre) return lockErr('Escriba el nombre del operador.');
      const e2=claveDebil(o.cif,o.cif2); if(e2) return lockErr(e2);
      if(o.cif===o.clave) return lockErr('La clave de cifrado debe ser distinta de la contraseña de acceso.');
      const file=o.archivo&&o.archivo[0];
      btn.disabled=true; btn.textContent='Preparando…'; lockErr('');
      try{
        let db0, env=null;
        if(file){
          if(!o.passres) throw new Error('Escriba la contraseña del respaldo.');
          try{ env=JSON.parse(await file.text()); }catch(e){ throw new Error('El archivo no es un respaldo válido.'); }
          const r=await openEnvelope(env, o.passres);
          if(!r.db||r.db.meta?.app!==APP_ID) throw new Error('El contenido no corresponde a esta aplicación.');
          db0=migrate(r.db);
          const v=await verificarCadena(db0.bitacora); if(!v.ok) throw new Error(`La bitácora del respaldo está alterada (entrada ${v.n}). No se importa.`);
        } else db0=defaultDB({nombre:o.nombre, cargo:o.cargo||'Director de Seguridad Integral'});
        db0.config.operador={nombre:o.nombre, cargo:o.cargo||'Director de Seguridad Integral'};
        btn.textContent='Instalando…'; S.instalando=true;
        const res=await Nube.instalar({correo:o.correo, clave:o.clave, codigo:o.codigo, claveCifrado:o.cif, seq:seqServidor(db0.meta.seq)});
        await guardarLlaveLocal(res.llave);
        resetY(); S.db=db0; S.idx=null; S.cumpl.clear();
        await log(env?'Instalación en la nube con datos importados del respaldo':'Instalación en la nube', '', env?`Respaldo guardado el ${fmtDT(env.saved)}; ${db0.personas.length} personas, ${db0.consultas.length} consultas, ${db0.estudios.length} estudios`:`Proyecto ${Nube.proyecto()}`);
        await guardarLocal();
        Y.progreso=(a,b)=>{ const el=$('#instprog'); if(el) el.textContent=`Enviando a la nube: ${fmtN(a)} de ${fmtN(b)} registros cifrados…`; };
        sincronizar().then(()=>{ Y.progreso=null; const el=$('#instprog'); if(el) el.textContent = Y.estado ? 'Los datos se terminarán de enviar en segundo plano.' : 'Datos enviados a la nube.'; });
        mostrarCodigo(res.recuperacion);
      }catch(err){ S.instalando=false; S.db=null; lockErr(Nube.errorTexto(err)); btn.disabled=false; btn.textContent='Instalar'; }
    };
  }
}
async function verificarCadena(lista){
  let prev='INICIO';
  for(const e of lista){ const {hash, ...rest}=e; if(rest.prev!==prev) return {ok:false, n:e.n}; if(await sha256Hex(canon(rest))!==hash) return {ok:false, n:e.n}; prev=hash; }
  return {ok:true};
}
function mostrarCodigo(codigo){
  const L=$('#lock');
  L.innerHTML=`<div class="lock-card">${LOCK_HEAD}<h2 class="lock-h2">Código de recuperación</h2>
    <p>Es la única forma de recuperar la información si olvida la clave de cifrado. Escríbalo o imprímalo y guárdelo en un lugar seguro, separado del computador (por ejemplo, en sobre cerrado). No se vuelve a mostrar.</p>
    ${codigoHTML(codigo)}
    <p><button class="btn" type="button" id="codprint">Imprimir</button></p>
    <label class="chk"><input type="checkbox" id="codok"> <span>Guardé el código de recuperación en un lugar seguro</span></label>
    <p class="hint" id="instprog"></p>
    <p style="margin-top:12px"><button class="btn primary" type="button" id="codgo" disabled>Entrar a la aplicación</button></p></div>`;
  $('#codprint').onclick=()=>imprimirCodigo(codigo);
  $('#codok').onchange=e=>{ $('#codgo').disabled=!e.target.checked; };
  $('#codgo').onclick=()=>{ $('#print-root').innerHTML=''; S.instalando=false; enterApp(); };
}

async function arrancar(msg){
  if(S.db || S.instalando) return;
  renderLock('cargando','Verificando la cuenta…');
  const u=Nube.usuario();
  let inst=null, sinRed=false;
  try{ inst=await Nube.leerInstalacion(); }catch(e){ sinRed=true; }
  if(S.db || S.instalando) return;
  if(sinRed){
    const loc=await Store.get('llave');
    if(u && loc && loc.uid===u.uid){ Nube.inst={id:loc.inst, adminUid:loc.adminUid}; renderLock('unlock', 'Sin conexión: trabajará con la copia cifrada de este equipo y los cambios se enviarán al volver la conexión.'); return; }
    renderLock('error', 'Sin conexión con el servidor y sin una copia de los datos en este equipo. Conéctese a internet y reintente.'); return;
  }
  if(!inst){ renderLock('instalar'); return; }
  if(!u){ renderLock('login', msg || S.avisoLogin); S.avisoLogin=''; return; }
  if(inst.adminUid!==u.uid){ S.avisoLogin='Esta cuenta no es la del administrador de la aplicación.'; await Nube.salir(); return; }
  Nube.inst={id:inst.id, adminUid:inst.adminUid};
  renderLock('unlock', msg);
}
async function desbloquear(clave){
  let llave=null;
  try{ llave=await Nube.leerLlave(); }catch(e){ if(e.code==='permission-denied') throw new Error(Nube.errorTexto(e)); const loc=await Store.get('llave'); if(loc && loc.inst===Nube.inst.id) llave={pass:loc.pass, rec:loc.rec}; }
  if(!llave) throw new Error('No fue posible obtener la llave de datos: sin conexión y sin copia en este equipo.');
  if(!await Nube.abrir(llave, clave)) throw new Error('La clave de cifrado no es correcta.');
  await guardarLlaveLocal(llave);
  await cargarDatos();
}
async function cargarDatos(){
  resetY(); S.db=null;
  const v=await Store.get('vault'), st=await Store.get('sync');
  if(v && st && v.inst===Nube.inst.id && st.inst===Nube.inst.id){ try{ S.db=migrate(await Nube.descifrar('boveda-local', v)); }catch(e){ S.db=null; } }
  if(S.db){ baseDesdeLocal(st); enterApp(); sincronizar(); return; }
  if(!navigator.onLine){ Nube.cerrar(); throw new Error('Primera apertura en este equipo: se necesita conexión para descargar los datos.'); }
  renderLock('cargando','Descargando y descifrando los datos…');
  S.db=migrate(defaultDB({nombre:'', cargo:''})); Y.inicial=true;
  try{ await traer(); }catch(e){ S.db=null; Y.inicial=false; Nube.cerrar(); renderLock('unlock'); throw new Error(Nube.errorTexto(e)); }
  Y.inicial=false; await logChain; await guardarLocal();
  enterApp(); sincronizar();
}
async function enterApp(){
  S.idx=null; S.cumpl.clear(); S.lastAct=Date.now();
  $('#lock').hidden=true; $('#lock').innerHTML=''; $('#app').hidden=false;
  if(bc) bc.postMessage({t:'claim', id:TAB_ID});
  try{ if(navigator.storage&&navigator.storage.persist) S.persisted=await navigator.storage.persist(); }catch(e){}
  clearInterval(Y.poll); Y.poll=setInterval(()=>{ if(S.db && document.visibilityState==='visible') sincronizar(); }, 30000);
  if(!location.hash) location.hash='#/tablero'; else render();
  setSaveState();
}
async function lock(msg){
  if(!S.db) return;
  if($('#dlg').open) $('#dlg').close();
  await saveNow();
  try{ await Promise.race([Y.chain, new Promise(r=>setTimeout(r,4000))]); }catch(e){}
  resetY();
  S.db=null; Nube.cerrar(); S.idx=null; S.cumpl.clear(); S.ui=freshUI(); S.estDirty=false;
  $('#main').innerHTML=''; $('#print-root').innerHTML=''; $('#gsearch').value=''; $('#gresults').hidden=true;
  renderLock('unlock', msg||'');
}
async function cerrarTodo(borrar){
  clearTimeout(S.saveTimer);
  if(S.db){ if(borrar){ resetY(); S.db=null; Nube.cerrar(); S.ui=freshUI(); S.estDirty=false; $('#main').innerHTML=''; } else await lock(''); }
  if(borrar){ await Store.del('vault'); await Store.del('sync'); await Store.del('llave'); }
  renderLock('cargando','Cerrando sesión…');
  await Nube.salir();
}
function borrarDialog(){
  openDialog({title:'Borrar la copia de este equipo', danger:true, submit:'Borrar copia y cerrar sesión', body:`<p>Se borra la copia cifrada guardada en este navegador y se cierra la sesión. La información en la nube no se afecta.</p>${Y.pendN?`<div class="banner bad">Hay ${fmtN(Y.pendN)} cambio(s) que aún no llegan a la nube y se perderán. Conéctese y espere a que se sincronicen antes de borrar.</div>`:''}<label class="f"><span>Escriba BORRAR para confirmar</span><input type="text" name="conf" autocomplete="off"></label>`,
    onSubmit:async o=>{ if(o.conf!=='BORRAR') return 'Escriba BORRAR para confirmar.'; await cerrarTodo(true); toast('Copia de este equipo borrada'); }});
}
function updateBackupState(){
  const el=$('#backupstate'); if(!el||!S.db) return;
  const ub=S.db.meta.ultimoRespaldo; el.textContent = ub ? 'Último respaldo: '+fmtD(ub.slice(0,10)) : 'Sin respaldo descargado';
}

/* =====================================================================
   Eventos globales
   ===================================================================== */
const ACTIONS = {
  lock:()=>lock('Sesión bloqueada.'),
  nuevaPersona, importar:t=>importar(t.dataset.tipo), plantilla:t=>plantilla(t.dataset.tipo),
  editarPersona:t=>editarPersona(t.dataset.id), suprimirPersona:t=>suprimirPersona(t.dataset.id),
  nuevaAutorizacion:t=>nuevaAutorizacion(t.dataset.pid), revocarAutorizacion:t=>revocarAutorizacion(t.dataset.id),
  nuevaConsulta:t=>nuevaConsulta(t.dataset.pid), consultaLote, anularConsulta:t=>anularConsulta(t.dataset.id),
  nuevoHallazgo:t=>nuevoHallazgo(t.dataset.pid), levantarHallazgo:t=>levantarHallazgo(t.dataset.id),
  nuevoEstudio:t=>nuevoEstudio(t.dataset.pid), guardarEstudio:()=>guardarEstudio(false), emitirInforme, anularEstudio,
  imprimirInforme:t=>imprimirInforme(t.dataset.id, t.dataset.v),
  toggleLev:t=>{ S.ui.ficha.levantados=t.checked; render(); },
  selClear:()=>{ S.ui.personas.sel.clear(); S.listFn&&S.listFn(); },
  limitAll:t=>{ S.ui[t.dataset.view].limit=1e9; S.listFn&&S.listFn(); },
  verificarBitacora:async()=>{ const r=await verificarBitacora(); $('#bitres').innerHTML = r.ok?`<div class="banner ok">Bitácora íntegra: ${fmtN(r.total)} entradas verificadas, cadena de huellas sin alteraciones.</div>`:`<div class="banner bad">La cadena de huellas se rompe en la entrada ${r.n}. Los datos pudieron alterarse por fuera de la aplicación.</div>`; },
  copiarResumen:async()=>{ const t=resumenTexto(); try{ await navigator.clipboard.writeText(t); toast('Resumen copiado'); }catch(e){ openDialog({title:'Resumen para informe', submit:null, body:`<textarea rows="8" readonly>${esc(t)}</textarea>`}); } },
  guardarConfig, respaldo, cambiarClave, nuevoCodigo, cambiarAcceso, cerrarSesion:()=>cerrarTodo(false),
  sincronizarYa:async()=>{ await saveNow(); await sincronizar(); toast(Y.estado?('No se pudo sincronizar: '+(Y.estado==='offline'?'sin conexión':Y.error)):'Sincronizado'); if(location.hash.startsWith('#/config')) render(); },
  quitarLogo:()=>{ cfg().logo=null; log('Configuración modificada','','logotipo retirado'); mutate(); render(); },
  suprimirVencidos:()=>{ const list=retiradosVencidos(); confirmDialog('Suprimir datos por vencimiento', `Se suprimirán de forma irreversible los datos identificativos de ${list.length} personas retiradas hace más de ${cfg().retencionAnios} años.`, 'Suprimir datos', ()=>{ list.forEach(p=>anonimizar(p,'Vencimiento del plazo de conservación')); mutate(); render(); toast(`${list.length} registros suprimidos`); }); },
  borrarTodo:()=>borrarDialog(),
  ...EXPORTS
};
document.addEventListener('click', e=>{
  const sel=e.target.closest('input[data-sel]');
  if(sel){ sel.checked?S.ui.personas.sel.add(sel.dataset.sel):S.ui.personas.sel.delete(sel.dataset.sel); updateSelbar(); return; }
  const t=e.target.closest('[data-act]');
  if(t){
    if(t.disabled) return;
    if(t.dataset.act==='selAll'){ const vis=filtPersonas().slice(0,S.ui.personas.limit); vis.forEach(p=> t.checked?S.ui.personas.sel.add(p.id):S.ui.personas.sel.delete(p.id)); $$('input[data-sel]').forEach(c=>c.checked=t.checked); updateSelbar(); return; }
    if(t.dataset.act==='toggleLev'){ ACTIONS.toggleLev(t); return; }
    const fn=ACTIONS[t.dataset.act]; if(fn){ e.preventDefault(); fn(t,e); }
    return;
  }
  const row=e.target.closest('tr[data-href]');
  if(row && !e.target.closest('a,button,input,select,label')){ location.hash=row.dataset.href; }
});
function setFilter(el){ const [v,k]=el.dataset.filter.split('.'); S.ui[v][k]= el.type==='checkbox'?el.checked:el.value; if(S.ui[v].limit) S.ui[v].limit=300; if(S.listFn) S.listFn(); else render(); }
document.addEventListener('input', e=>{ const el=e.target; if(el.dataset&&el.dataset.filter && el.tagName==='INPUT' && el.type!=='checkbox') setFilter(el); });
document.addEventListener('change', e=>{ const el=e.target; if(el.dataset&&el.dataset.filter && (el.tagName==='SELECT'||el.type==='checkbox')) setFilter(el); });
window.addEventListener('hashchange', ()=>{
  if(S.skipHash){ S.skipHash=false; return; }
  if(S.estDirty && !confirm('Hay cambios sin guardar en el estudio. ¿Salir sin guardar?')){ S.skipHash=true; history.back(); return; }
  S.estDirty=false; render(); $('#main').focus({preventScroll:true}); window.scrollTo(0,0);
});
window.addEventListener('beforeunload', e=>{ if(S.dirty||S.estDirty){ saveNow(); e.preventDefault(); e.returnValue=''; } });
['mousemove','keydown','click','touchstart','scroll'].forEach(ev=>document.addEventListener(ev, ()=>{ S.lastAct=Date.now(); }, {passive:true}));
setInterval(()=>{ if(S.db && Date.now()-S.lastAct > cfg().autoBloqueoMin*60000) lock('Bloqueo automático por inactividad.'); }, 20000);
window.addEventListener('online', ()=>{ if(S.db) sincronizar(); });
window.addEventListener('offline', ()=>{ if(S.db){ Y.estado='offline'; setSaveState(); } });
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && S.db) sincronizar(); });
$('#dlg').addEventListener('close', ()=>{ if(S.refrescar && S.db && !S.estDirty) render(); });
if(bc) bc.onmessage = ev=>{ if(ev.data?.t==='claim' && ev.data.id!==TAB_ID && S.db) lock('La aplicación se abrió en otra pestaña o ventana; esta sesión se bloqueó para evitar sobrescribir datos.'); };

/* Búsqueda global */
const gs=$('#gsearch'), gr=$('#gresults');
gs.addEventListener('input', ()=>{
  const q=norm(gs.value); if(!q||!S.db){ gr.hidden=true; return; }
  const m=S.db.personas.filter(p=>!p.anon && norm(`${p.nombres} ${p.apellidos} ${p.doc} ${p.codigo}`).includes(q)).slice(0,8);
  gr.innerHTML = m.length ? m.map(p=>`<button type="button" data-go="${p.id}">${esc(nombre(p))}<div class="sub">${esc(p.tipoDoc)} ${esc(p.doc)}; ${esc(p.codigo)}; ${esc(p.cargo||p.vinculo)}</div></button>`).join('') : '<div class="hint" style="padding:10px 12px">Sin coincidencias</div>';
  gr.hidden=false;
});
gr.addEventListener('click', e=>{ const b=e.target.closest('[data-go]'); if(b){ location.hash='#/persona/'+b.dataset.go; gr.hidden=true; gs.value=''; } });
gs.addEventListener('keydown', e=>{ if(e.key==='Escape'){ gr.hidden=true; gs.blur(); } if(e.key==='Enter'){ const b=gr.querySelector('[data-go]'); if(b) b.click(); } });
document.addEventListener('click', e=>{ if(!e.target.closest('.search')) gr.hidden=true; });

/* Tooltip de gráficos */
const tip=$('#tip');
document.addEventListener('mouseover', e=>{ const t=e.target.closest('[data-tip]'); if(!t){ tip.hidden=true; return; } tip.textContent=t.dataset.tip; tip.hidden=false; });
document.addEventListener('mousemove', e=>{ if(!tip.hidden){ tip.style.left=Math.min(e.clientX+12, innerWidth-tip.offsetWidth-8)+'px'; tip.style.top=(e.clientY+14)+'px'; } });

/* Arranque */
(async()=>{
  if(!window.isSecureContext || !crypto.subtle){ document.body.innerHTML='<p style="padding:24px;font:16px system-ui">Este navegador no permite el cifrado necesario. Abra la aplicación desde su dirección https en Microsoft Edge o Google Chrome.</p>'; return; }
  await Store.init();
  if(!Nube.configurado()){ renderLock('config'); return; }
  try{ Nube.init(); }catch(e){ renderLock('error','No se pudo iniciar Firebase: '+e.message); return; }
  if('serviceWorker' in navigator && !(window.EST_CONFIG||{}).sinServiceWorker) navigator.serviceWorker.register('sw.js').catch(()=>{});
  Nube.alCambiarSesion(()=>{ if(!S.db && !S.instalando) arrancar(); });
})();


})();
