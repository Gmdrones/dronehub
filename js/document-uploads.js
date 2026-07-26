(function(){
  var BUCKET='pilot-documents';
  function clean(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
  function safeName(name){return String(name||'documento.pdf').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-100)}
  function isAro(doc){var raw=clean((doc.type||'')+' '+(doc.name||''));return raw.includes('avaliacao de risco')||/(^|\s)aro(\s|$)/.test(raw)}
  function isInspectionDocument(doc){
    if(isAro(doc))return false;
    var raw=clean((doc.type||'')+' '+(doc.name||''));
    return ['sarpas','sisant','anatel','reta','seguro'].some(function(term){return raw.includes(term)});
  }
  async function uploadPilotDocument(file,userId,documentId){
    if(!file)throw new Error('Selecione um arquivo PDF ou uma imagem.');
    if(!supabaseClient)throw new Error('O armazenamento seguro está indisponível.');
    var allowed=['application/pdf','image/jpeg','image/png','image/webp'];
    if(allowed.indexOf(file.type)<0)throw new Error('Formato não permitido. Envie PDF, JPG, PNG ou WEBP.');
    if(file.size>15*1024*1024)throw new Error('O arquivo ultrapassa o limite de 15 MB.');
    var path=userId+'/'+documentId+'/'+Date.now()+'-'+safeName(file.name);
    var result=await supabaseClient.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(result.error)throw result.error;
    return {filePath:path,fileName:file.name,fileSize:file.size,fileType:file.type,uploadedAt:new Date().toISOString()};
  }
  async function signedDocumentUrl(doc,seconds){
    if(!doc||!doc.filePath||!supabaseClient)return '';
    var result=await supabaseClient.storage.from(BUCKET).createSignedUrl(doc.filePath,Math.max(60,Number(seconds)||900));
    return result.error?'':result.data.signedUrl;
  }
  async function deletePilotDocumentFile(doc){
    if(doc&&doc.filePath&&supabaseClient)await supabaseClient.storage.from(BUCKET).remove([doc.filePath]);
  }
  async function saveDocumentWithFile(userId,data,file){
    if(!file)throw new Error('Anexe o PDF ou a imagem do documento.');
    var uploaded=await uploadPilotDocument(file,userId,data.id);
    Object.assign(data,uploaded);
    if(typeof isSarpasDocument==='function'&&isSarpasDocument(data)){
      var old=getDocuments(userId).filter(function(doc){return doc.id!==data.id&&isSarpasDocument(doc)});
      await Promise.all(old.map(deletePilotDocumentFile));
    }
    saveDocument(userId,data);
    return data;
  }
  function installFileField(){
    var type=document.getElementById('docType');if(!type||document.getElementById('docFile'))return;
    var field=document.createElement('label');field.className='document-file-field';field.innerHTML='<span>Arquivo comprobatório</span><input id="docFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"><small>PDF ou imagem, até 15 MB.</small>';
    type.insertAdjacentElement('afterend',field);
    var bar=type.closest('.add-bar');if(bar){var note=document.createElement('p');note.className='document-file-note';note.innerHTML='<strong>Importante:</strong> o SARPAS é específico de cada voo e substitui a autorização anterior. SISANT, ANATEL, RETA e demais documentos permanecem no prontuário.';bar.appendChild(note)}
  }
  window.uploadPilotDocument=uploadPilotDocument;
  window.signedDocumentUrl=signedDocumentUrl;
  window.deletePilotDocumentFile=deletePilotDocumentFile;
  window.saveDocumentWithFile=saveDocumentWithFile;
  window.isInspectionDocument=isInspectionDocument;
  window.installDocumentUploadField=installFileField;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installFileField);else installFileField();
})();
