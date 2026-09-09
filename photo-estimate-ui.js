(function(){
  const PHOTO_MAX=6;
  const PHOTO_ENDPOINT=()=>localStorage.getItem('grabHaulPhotoEndpoint')||'/api/photo-estimate';
  const PRICES={1:150,2:225,3:300,4:375,5:450,6:525,7:600,8:650};
  const $=id=>document.getElementById(id);
  const money=v=>'$'+Number(v||0).toFixed(2);

  function build(){
    const card=document.querySelector('#calculator .card:nth-of-type(2)');
    if(!card||document.getElementById('photoUpload')) return;
    card.innerHTML=`<h2>AI Photo Quote</h2>
      <p class="note">Upload multiple photos of the same job. More angles usually produce a better estimate. Photos are analyzed together; the AI does not automatically send a quote to the customer.</p>
      <label for="photoUpload">Customer Photos (up to ${PHOTO_MAX})</label>
      <input id="photoUpload" type="file" accept="image/*" multiple>
      <div id="photoPreview" class="photo-preview"></div>
      <div class="actions" style="margin-top:12px">
        <button class="primary" id="analyzePhotos">Analyze Photos</button>
        <button id="clearPhotos">Clear Photos</button>
      </div>
      <div id="photoStatus" class="note" style="margin-top:10px"></div>
      <div id="photoResult" style="display:none;margin-top:14px">
        <div class="result"><span>Estimated Volume</span><span id="photoVolume">—</span></div>
        <div class="result"><span>Recommended Quote</span><span id="photoPrice">—</span></div>
        <div class="result"><span>Confidence</span><span id="photoConfidence">—</span></div>
        <div id="photoItems" class="note"></div>
        <div id="photoSpecials" class="note"></div>
        <div id="photoWarning" class="note"></div>
        <div id="photoNotes" class="note"></div>
        <div class="actions" style="margin-top:10px"><button class="green" id="usePhotoEstimate">Use AI Estimate in Calculator</button></div>
      </div>`;

    $('photoUpload').addEventListener('change',preview);
    $('analyzePhotos').addEventListener('click',analyze);
    $('clearPhotos').addEventListener('click',clear);
    $('usePhotoEstimate').addEventListener('click',useEstimate);
  }

  function preview(){
    const input=$('photoUpload'), files=Array.from(input.files||[]).slice(0,PHOTO_MAX);
    if(input.files.length>PHOTO_MAX){$('photoStatus').textContent=`Only the first ${PHOTO_MAX} photos will be analyzed.`}
    const box=$('photoPreview');box.innerHTML='';
    files.forEach(file=>{const url=URL.createObjectURL(file);const img=document.createElement('img');img.src=url;img.alt=file.name;img.onload=()=>URL.revokeObjectURL(url);box.appendChild(img)});
  }

  function clear(){
    $('photoUpload').value='';$('photoPreview').innerHTML='';$('photoStatus').textContent='';$('photoResult').style.display='none';
  }

  function resize(file){return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read image.'));reader.onload=()=>{
      const img=new Image();img.onerror=()=>reject(new Error('Could not process image.'));img.onload=()=>{
        const max=1400,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.72));
      };img.src=reader.result;
    };reader.readAsDataURL(file);
  })}

  async function analyze(){
    const files=Array.from($('photoUpload').files||[]).slice(0,PHOTO_MAX);
    if(!files.length){alert('Please select at least one customer photo.');return}
    const btn=$('analyzePhotos');btn.disabled=true;$('photoResult').style.display='none';$('photoStatus').textContent='Preparing photos and analyzing the job...';
    try{
      const images=[];for(const file of files)images.push(await resize(file));
      const response=await fetch(PHOTO_ENDPOINT(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,pricing:PRICES})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`Photo analysis failed (${response.status}).`);
      window.grabHaulPhotoEstimate=data;
      $('photoVolume').textContent=data.estimated_low===data.estimated_high?`${data.estimated_low} yard${data.estimated_low===1?'':'s'}`:`${data.estimated_low}–${data.estimated_high} yards`;
      $('photoPrice').textContent=money(data.recommended_price);
      $('photoConfidence').textContent=(data.confidence||'medium').replace(/^./,c=>c.toUpperCase());
      $('photoItems').innerHTML=data.observed_items?.length?'<b>Visible items:</b> '+data.observed_items.map(escapeHtml).join(', '):'';
      $('photoSpecials').innerHTML=data.special_items?.length?'<b>Potential special fees:</b> '+data.special_items.map(escapeHtml).join(', '):'<b>Potential special fees:</b> None identified';
      $('photoWarning').innerHTML=data.heavy_material_warning?'<b>⚠ Heavy-material warning:</b> Review this job separately before quoting.':'';
      $('photoNotes').innerHTML=data.notes?'<b>AI notes:</b> '+escapeHtml(data.notes):'';
      $('photoResult').style.display='block';$('photoStatus').textContent='Analysis complete. Review the estimate before quoting.';
    }catch(err){$('photoStatus').textContent=err.message||'Unable to analyze photos.'}
    finally{btn.disabled=false}
  }

  function useEstimate(){
    const e=window.grabHaulPhotoEstimate;if(!e)return;
    const v=Math.max(1,Math.min(8,Number(e.recommended_volume)||1));
    if($('estVolume'))$('estVolume').value=v;
    if($('actualVolume'))$('actualVolume').value=v;
    if($('actualBase'))$('actualBase').value=Number(e.recommended_price||PRICES[v]);
    if(Array.isArray(e.special_items)){
      const text=e.special_items.join(' ').toLowerCase();
      const names=[['mattress',0],['box spring',1],['refrigerator',3],['freezer',3],['window a/c',4],['window ac',4],['large a/c',5],['large ac',5],['large tv',6],['electronics',6],['passenger tire',7],['light truck tire',8],['large tire',8],['rim',9]];
      names.forEach(([term,i])=>{if(text.includes(term)&&$('q'+i)&&Number($('q'+i).value)<1)$('q'+i).value=1});
    }
    if(typeof window.calc==='function')window.calc();
    $('photoStatus').textContent='AI estimate copied into the calculator. Review everything before quoting.';
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  window.addEventListener('DOMContentLoaded',build);
  if(document.readyState!=='loading')build();
})();
