// WMoldes - Anotações overlay, sem plugin e sem recursão.
(function () {
  'use strict';

  const ROOT = 'historyChartNotesStable';
  const state = { notes: [], subscribed: '', tooltip: null };

  function $(id){ return document.getElementById(id); }
  function qs(s){ return document.querySelector(s); }
  function pad(v){ return String(v).padStart(2,'0'); }
  function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function esc(v){ return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }
  function safeKey(v){ return String(v||'sem-maquina').replace(/[.#$/\[\]]/g,'_'); }
  function nowText(){ const d=new Date(); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

  function normalizeDate(v){
    if(!v) return todayISO();
    const s=String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const br=s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if(br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso=s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return todayISO();
  }

  function getMachine(){
    const s=$('historyMachineSelect');
    if(!s) return '';
    const value=String(s.value||'').trim();
    const text=s.options&&s.selectedIndex>=0?String(s.options[s.selectedIndex].textContent||'').toLowerCase():'';
    if(!value) return '';
    if(value.toLowerCase().includes('carregando')||text.includes('carregando')) return '';
    return value;
  }

  function getDate(){
    const s=$('historyDate');
    if(!s) return todayISO();
    const t=s.options&&s.selectedIndex>=0?s.options[s.selectedIndex].textContent:'';
    return normalizeDate(s.value||t);
  }

  function timeToMin(t){ const m=String(t||'').match(/(\d{1,2}):(\d{2})/); return m?Number(m[1])*60+Number(m[2]):0; }
  function minToHour(m){ return m/60; }
  function extractTime(v){
    if(!v) return '';
    if(typeof v==='number'){ const d=new Date(v); return isNaN(d)?'':`${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    const s=String(v); const hh=s.match(/(\d{1,2}):(\d{2})/); if(hh) return `${pad(hh[1])}:${hh[2]}`;
    const d=new Date(s); return isNaN(d)?'':`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getChart(){
    const c=$('historyChart');
    if(!c||!window.Chart) return null;
    return Chart.getChart(c)||window.historyChart||null;
  }

  function labelHour(label){ const m=String(label??'').match(/(\d{1,2}):(\d{2})/); return m?Number(m[1])+Number(m[2])/60:null; }

  function pixelForHour(chart,hour){
    if(!chart||!chart.scales) return NaN;
    const xs=chart.scales.x||Object.values(chart.scales).find(s=>s.axis==='x');
    if(!xs) return NaN;

    const labels=chart.data?.labels||[];

    // Quando o eixo X é categoria, Chart.js só posiciona por índice.
    // Por isso NÃO usamos o ponto mais próximo. Interpolamos entre os horários
    // visíveis para colocar a anotação exatamente no horário real.
    const points=[];
    labels.forEach((label,index)=>{
      const h=labelHour(label);
      if(h==null) return;
      const px=xs.getPixelForValue(index);
      if(Number.isFinite(px)) points.push({h,px,index});
    });

    if(points.length>=2){
      // Corrige virada de turno/noite: 22:00, 23:00, 00:00...
      for(let i=1;i<points.length;i++){
        if(points[i].h < points[i-1].h) points[i].h += 24;
      }

      let target=hour;
      if(target < points[0].h && points[points.length-1].h > 24) target += 24;

      if(target <= points[0].h){
        const a=points[0], b=points[1];
        const ratio=(target-a.h)/(b.h-a.h || 1);
        return a.px+(b.px-a.px)*ratio;
      }

      if(target >= points[points.length-1].h){
        const a=points[points.length-2], b=points[points.length-1];
        const ratio=(target-a.h)/(b.h-a.h || 1);
        return a.px+(b.px-a.px)*ratio;
      }

      for(let i=0;i<points.length-1;i++){
        const a=points[i], b=points[i+1];
        if(target>=a.h && target<=b.h){
          const ratio=(target-a.h)/(b.h-a.h || 1);
          return a.px+(b.px-a.px)*ratio;
        }
      }
    }

    // Fallback para eixo linear/time.
    let px=xs.getPixelForValue(hour);
    if(Number.isFinite(px)&&px>=xs.left-80&&px<=xs.right+80) return px;

    return NaN;
  }

  function ensureUI(){
    const container=qs('#history-section .chart-container')||qs('.chart-container');
    if(container && !$('historyNotesToolbar')){
      const tb=document.createElement('div');
      tb.id='historyNotesToolbar';
      tb.className='history-notes-toolbar is-disabled';
      tb.style.display='none';
      tb.innerHTML='<button type="button" class="history-note-add-btn" id="historyNoteAddBtn"><i class="fas fa-sticky-note"></i> Nova anotação</button><span class="history-notes-helper">Anotações e manutenção aparecem no topo do gráfico.</span>';
      container.insertBefore(tb,container.firstChild);
    }
    if(container && !$('historyNotesLayer')){
      const layer=document.createElement('div');
      layer.id='historyNotesLayer';
      layer.className='history-notes-layer';
      container.appendChild(layer);
    }
    if(!$('historyNoteModalBackdrop')){
      const modal=document.createElement('div');
      modal.id='historyNoteModalBackdrop';
      modal.className='history-note-modal-backdrop';
      modal.innerHTML=`
        <div class="history-note-modal">
          <div class="history-note-modal-header">
            <div><h3>Anotação do gráfico</h3><p>Será exibida no topo do gráfico, alinhada pelo horário.</p></div>
            <button type="button" class="history-note-icon-btn" id="historyNoteCloseBtn"><i class="fas fa-times"></i></button>
          </div>
          <input type="hidden" id="historyNoteId">
          <div class="history-note-form-grid">
            <div class="history-note-field"><label>Data</label><input type="date" id="historyNoteDate"></div>
            <div class="history-note-field"><label>Horário inicial</label><input type="time" id="historyNoteStart"></div>
            <div class="history-note-field"><label>Horário final</label><input type="time" id="historyNoteEnd"></div>
          </div>
          <div class="history-note-field"><label>Mensagem</label><textarea id="historyNoteMessage" rows="4" placeholder="Digite a mensagem..."></textarea></div>
          <div class="history-note-modal-actions">
            <button type="button" class="history-note-danger-btn" id="historyNoteDeleteBtn"><i class="fas fa-trash"></i> Remover</button>
            <div class="history-note-modal-actions-right">
              <button type="button" class="history-note-secondary-btn" id="historyNoteCancelBtn">Cancelar</button>
              <button type="button" class="history-note-primary-btn" id="historyNoteSaveBtn"><i class="fas fa-save"></i> Salvar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
  }

  function updateButton(){
    ensureUI();
    const tb=$('historyNotesToolbar');
    if(!tb) return;
    const ok=!!getMachine();
    tb.style.display=ok?'flex':'none';
    tb.classList.toggle('is-disabled',!ok);
  }

  function selectedRange(){
    const active=qs('.period-btn.active,.period-option.active,[data-period].active');
    const p=active?String(active.dataset.period||''):'24h';
    if(p==='custom') return {start:$('customStartTime')?.value||'00:00',end:$('customEndTime')?.value||'23:59'};
    if(p==='shift1'||p==='turno1') return {start:'06:00',end:'14:00'};
    if(p==='shift2'||p==='turno2') return {start:'14:00',end:'22:00'};
    if(p==='shift3'||p==='turno3') return {start:'22:00',end:'06:00'};
    return {start:'00:00',end:'23:59'};
  }

  function fields(o,names){ if(!o)return undefined; for(const n of names){ if(o[n]!==undefined&&o[n]!==null&&o[n]!=='') return o[n]; } }
  function maintenanceRowsFrom(src,machine){
    if(!src)return[];
    const direct=src[machine]||src[String(machine)];
    if(Array.isArray(direct))return direct;
    if(direct&&typeof direct==='object'){
      const record=fields(direct,['status','isInMaintenance','emManutencao','maintenance','manutencao','startTime','horaInicio','endTime','horaFim']);
      return record?[direct]:Object.values(direct);
    }
    if(Array.isArray(src)) return src.filter(r=>String(fields(r,['machine','maquina','machineId','nomeMaquina'])||'')===String(machine));
    return [];
  }
  function isMaint(r){
    const status=String(fields(r,['status','state','estado','tipoStatus'])||'').toLowerCase();
    const type=String(fields(r,['type','tipo','eventType','evento'])||'').toLowerCase();
    const msg=String(fields(r,['message','mensagem','reason','motivo','observacao','observação'])||'').toLowerCase();
    return r?.isInMaintenance===true||r?.emManutencao===true||r?.maintenance===true||r?.manutencao===true||status.includes('manut')||status.includes('parada')||type.includes('manut')||msg.includes('manut')||msg.includes('corretiva');
  }
  function maintenanceIntervals(){
    const machine=getMachine(); if(!machine)return[];
    const sources=[window.machineMaintenance,window.maintenanceData,window.allMachineMaintenance,window.manutencoes,window.maintenanceRecords,window.maintenanceHistory,window.historicoManutencao,window.allAdminMachines,window.allMachinesData].filter(Boolean);
    const rows=[]; sources.forEach(s=>maintenanceRowsFrom(s,machine).forEach(r=>rows.push(r)));
    const range=selectedRange();
    return rows.filter(isMaint).map((r,i)=>{
      const start=extractTime(fields(r,['startTime','horaInicio','inicio','maintenanceStart','startedAt','inicioManutencao','start','createdAt','timestamp','dataInicio']))||range.start;
      const end=extractTime(fields(r,['endTime','horaFim','fim','maintenanceEnd','endedAt','fimManutencao','end','returnedAt','retorno','returnTime','dataFim']))||range.end;
      const reason=fields(r,['reason','motivo','message','mensagem','observacao','observação']);
      return {id:'maint_'+i,date:getDate(),startTime:start,endTime:end,message:`PARADA PARA MANUTENÇÃO CORRETIVA${reason?'\nMotivo: '+reason:''}`,author:'Sistema',updatedAtText:end?'Período registrado':'Em manutenção',maintenance:true};
    });
  }

  function visibleNotes(){
    const machine=getMachine(); if(!machine)return[];
    const date=getDate(); const range=selectedRange(); const rs=timeToMin(range.start), re=timeToMin(range.end);
    const saved=state.notes.filter(n=>{
      const s=timeToMin(n.startTime), e=timeToMin(n.endTime||n.startTime);
      return normalizeDate(n.date||date)===date && e>=rs && s<=re;
    });
    return [...maintenanceIntervals(),...saved];
  }

  function renderLayer(){
    updateButton();
    const layer=$('historyNotesLayer'); const chart=getChart(); const canvas=$('historyChart');
    if(!layer||!chart||!canvas||!chart.chartArea){ if(layer)layer.innerHTML=''; return; }
    layer.innerHTML='';
    const canvasRect=canvas.getBoundingClientRect();
    const containerRect=layer.parentElement.getBoundingClientRect();
    const scaleX=canvasRect.width/canvas.width;
    const scaleY=canvasRect.height/canvas.height;
    const topBase=canvasRect.top-containerRect.top+(chart.chartArea.top*scaleY)-62;
    const leftBase=canvasRect.left-containerRect.left;
    const rightLimit=canvasRect.width;
    const occupied=[];
    visibleNotes().forEach(note=>{
      const sh=minToHour(timeToMin(note.startTime)), eh=minToHour(timeToMin(note.endTime||note.startTime));
      const sx=pixelForHour(chart,sh)*scaleX, ex=pixelForHour(chart,eh)*scaleX, mx=pixelForHour(chart,(sh+eh)/2)*scaleX;
      if(!Number.isFinite(mx))return;
      const div=document.createElement('div');
      div.className=note.maintenance?'history-note-gantt':'history-note-marker';
      div.dataset.noteId=note.id;
      div.__note=note;
      if(note.maintenance){
        const left=Math.max(0,Math.min(sx,ex)); const right=Math.min(rightLimit,Math.max(sx,ex));
        div.style.left=(leftBase+left)+'px'; div.style.top=topBase+'px'; div.style.width=Math.max(24,right-left)+'px';
        div.textContent=(right-left)>140?'Manutenção corretiva':'Manutenção';
      }else{
        let row=0; while(occupied.some(o=>Math.abs(o.x-mx)<38&&o.row===row))row++; row=Math.min(row,1); occupied.push({x:mx,row});
        div.style.left=(leftBase+mx-16)+'px'; div.style.top=(topBase+30+row*28)+'px';
        div.innerHTML='<span></span><span></span><span></span>';
      }
      div.addEventListener('mouseenter',e=>showTooltip(note,e));
      div.addEventListener('mousemove',e=>showTooltip(note,e));
      div.addEventListener('mouseleave',()=>hideTooltip());
      div.addEventListener('click',()=>{ if(!note.maintenance)openModal(note); });
      layer.appendChild(div);
    });
  }

  function tooltip(){
    if(state.tooltip)return state.tooltip;
    const t=document.createElement('div'); t.className='history-note-tooltip'; t.style.display='none'; document.body.appendChild(t); state.tooltip=t; return t;
  }
  function showTooltip(note,e){
    const t=tooltip();
    t.innerHTML=`<div class="history-note-tooltip-time ${note.maintenance?'maintenance':''}">${esc(note.startTime)} - ${esc(note.endTime||note.startTime)}</div><div class="history-note-tooltip-message">${esc(note.message)}</div><div class="history-note-tooltip-meta">${esc(note.author||'Usuário')} • ${esc(note.updatedAtText||note.createdAtText||'')}</div><div class="history-note-tooltip-actions">${note.maintenance?'Faixa automática de manutenção':'Clique para editar/remover'}</div>`;
    t.style.display='block';
    let l=e.clientX+14, top=e.clientY+14; const r=t.getBoundingClientRect();
    if(l+r.width>innerWidth-12)l=e.clientX-r.width-14; if(top+r.height>innerHeight-12)top=e.clientY-r.height-14;
    t.style.left=Math.max(12,l)+'px'; t.style.top=Math.max(12,top)+'px';
  }
  function hideTooltip(){ if(state.tooltip)state.tooltip.style.display='none'; }

  function hasFirebase(){ return !!(window.firebase&&firebase.database); }
  function localKey(){ return `wmoldes_notes_${safeKey(getMachine())}_${getDate()}`; }
  function loadLocal(){ try{return JSON.parse(localStorage.getItem(localKey())||'[]')}catch{return[]} }
  function saveLocal(rows){ localStorage.setItem(localKey(),JSON.stringify(rows)); }

  function subscribeNotes(){
    updateButton(); const machine=getMachine();
    if(!machine){ state.notes=[]; renderLayer(); return; }
    if(!hasFirebase()){ state.notes=loadLocal(); renderLayer(); return; }
    const path=`${ROOT}/${safeKey(machine)}/${getDate()}`;
    if(state.subscribed&&state.subscribed!==path){ try{firebase.database().ref(state.subscribed).off()}catch{} }
    state.subscribed=path;
    firebase.database().ref(path).off();
    firebase.database().ref(path).on('value',snap=>{
      const val=snap.val()||{};
      state.notes=Object.keys(val).map(id=>({id,machine,date:getDate(),...val[id]}));
      renderLayer();
    });
  }

  function defaultStart(){ const d=new Date(); return `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes()/5)*5)}`; }
  function defaultEnd(){ const d=new Date(Date.now()+30*60000); return `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes()/5)*5)}`; }
  function openModal(note){
    ensureUI(); const machine=getMachine(); if(!machine){ alert('Selecione uma máquina antes de criar uma anotação.'); return; }
    $('historyNoteId').value=note?.id||''; $('historyNoteDate').value=normalizeDate(note?.date||getDate()); $('historyNoteStart').value=note?.startTime||defaultStart(); $('historyNoteEnd').value=note?.endTime||defaultEnd(); $('historyNoteMessage').value=note?.message||'';
    $('historyNoteDeleteBtn').style.display=note?'inline-flex':'none'; $('historyNoteModalBackdrop').classList.add('active');
  }
  function closeModal(){ $('historyNoteModalBackdrop')?.classList.remove('active'); }
  async function saveNote(){
    const machine=getMachine(), date=normalizeDate($('historyNoteDate').value||getDate()), id=$('historyNoteId').value;
    const startTime=$('historyNoteStart').value, endTime=$('historyNoteEnd').value, message=String($('historyNoteMessage').value||'').trim();
    if(!machine)return alert('Selecione uma máquina.'); if(!startTime||!endTime)return alert('Informe horários.'); if(timeToMin(endTime)<timeToMin(startTime))return alert('Horário final menor que inicial.'); if(!message)return alert('Digite a mensagem.');
    const author=$('currentUserEmail')?.textContent||'Usuário'; const payload={machine,date,startTime,endTime,message,author,updatedAt:Date.now(),updatedAtText:new Date().toLocaleString('pt-BR')};
    if(hasFirebase()){ const ref=firebase.database().ref(`${ROOT}/${safeKey(machine)}/${date}`); if(id)await ref.child(id).update(payload); else await ref.push({...payload,createdAt:Date.now(),createdAtText:new Date().toLocaleString('pt-BR')}); }
    else{ const rows=loadLocal(); if(id){const i=rows.findIndex(r=>r.id===id); if(i>=0)rows[i]={...rows[i],...payload};} else rows.push({id:'local_'+Date.now(),...payload}); saveLocal(rows); state.notes=rows; }
    closeModal(); subscribeNotes();
  }
  async function deleteNote(){
    const id=$('historyNoteId').value; if(!id||!confirm('Remover esta anotação?'))return;
    if(hasFirebase()) await firebase.database().ref(`${ROOT}/${safeKey(getMachine())}/${getDate()}`).child(id).remove();
    else{ const rows=loadLocal().filter(r=>r.id!==id); saveLocal(rows); state.notes=rows; }
    closeModal(); subscribeNotes();
  }
  function bind(){
    ensureUI();
    if($('historyNoteAddBtn')&&!$('historyNoteAddBtn').__bound){ $('historyNoteAddBtn').__bound=true; $('historyNoteAddBtn').addEventListener('click',()=>openModal(null)); }
    if($('historyNoteCloseBtn')&&!$('historyNoteCloseBtn').__bound){ $('historyNoteCloseBtn').__bound=true; $('historyNoteCloseBtn').addEventListener('click',closeModal); }
    if($('historyNoteCancelBtn')&&!$('historyNoteCancelBtn').__bound){ $('historyNoteCancelBtn').__bound=true; $('historyNoteCancelBtn').addEventListener('click',closeModal); }
    if($('historyNoteSaveBtn')&&!$('historyNoteSaveBtn').__bound){ $('historyNoteSaveBtn').__bound=true; $('historyNoteSaveBtn').addEventListener('click',saveNote); }
    if($('historyNoteDeleteBtn')&&!$('historyNoteDeleteBtn').__bound){ $('historyNoteDeleteBtn').__bound=true; $('historyNoteDeleteBtn').addEventListener('click',deleteNote); }
    if($('historyNoteModalBackdrop')&&!$('historyNoteModalBackdrop').__bound){ $('historyNoteModalBackdrop').__bound=true; $('historyNoteModalBackdrop').addEventListener('click',e=>{if(e.target===$('historyNoteModalBackdrop'))closeModal();}); }
    ['historyMachineSelect','historyDate','customStartTime','customEndTime'].forEach(id=>{ const node=$(id); if(node&&!node.__notesBound){ node.__notesBound=true; node.addEventListener('change',()=>setTimeout(subscribeNotes,150)); }});
    window.addEventListener('resize',()=>setTimeout(renderLayer,100));
    const scroll=qs('.chart-scroll'); if(scroll&&!scroll.__notesBound){ scroll.__notesBound=true; scroll.addEventListener('scroll',()=>requestAnimationFrame(renderLayer)); }
  }
  function init(){ ensureUI(); bind(); updateButton(); setTimeout(subscribeNotes,700); setInterval(()=>{ensureUI(); bind(); updateButton(); renderLayer();},1500); }
  window.WMoldesHistoryNotes={open:()=>openModal(null),refresh:()=>subscribeNotes(),redraw:()=>renderLayer()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();
