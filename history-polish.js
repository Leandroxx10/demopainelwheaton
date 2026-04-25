/* WMoldes - Histórico Admin | V12: botões no card superior de filtros */
(function () {
  const READY_DELAY = 250;
  const LOOP_DELAY = 1200;
  function norm(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function visible(el){if(!el||!el.getBoundingClientRect)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';}
  function hasText(el,needle){return norm(el.textContent).includes(norm(needle));}
  function makeButton(id,className,icon,title,subtitle,action){let btn=document.getElementById(id);if(!btn){btn=document.createElement('button');btn.id=id;btn.type='button';}btn.dataset.historyAction=action;btn.className=className;btn.innerHTML=`<span class="history-action-icon"><i class="${icon}"></i></span><span class="history-action-text"><strong>${title}</strong><small>${subtitle}</small></span>`;return btn;}
  function openTutorial(){window.location.href='historico-tutorial.html';}
  function exportPdfFallback(){const fn=window.exportHistoryPdf||window.exportarHistoricoPDF||window.exportarGraficoHistoricoPDF;if(typeof fn==='function')return fn();alert('Exportação PDF indisponível. Verifique se history-charts.js foi carregado antes de history-polish.js.');}
  function removeWrongButtons(){
    document.querySelectorAll('.history-action-row:not(#historyActionRow), .hc-action-row, .history-export-actions').forEach(row=>row.remove());
    Array.from(document.querySelectorAll('button,a')).forEach(el=>{const t=norm(el.textContent);const isTarget=el.id==='historyTutorialBtn'||el.id==='exportHistoryPdfBtn';const oldGenerated=(t.includes('tutorial')&&(t.includes('historico')||t.includes('grafico')||t.includes('aprenda')))||(t.includes('exportar')&&t.includes('pdf'));const removed=t==='barras'||t.includes('gerar analise');if(removed){const w=el.closest('.history-action,.action-button-wrapper,.chart-action')||el;w.style.display='none';w.setAttribute('aria-hidden','true');return;}if(!isTarget&&oldGenerated)el.remove();});
  }
  function findPeriodElement(){
    const sels=['.period-selector','.period-options','.period-buttons','.history-period-selector','.history-period-options','[data-period="24h"]','[data-period="shift1"]','[data-period="shift2"]','[data-period="shift3"]'];
    for(const sel of sels){const el=document.querySelector(sel);if(visible(el))return el;}
    return Array.from(document.querySelectorAll('label,h3,h4,strong,span,div')).filter(visible).find(el=>norm(el.textContent)==='periodo'||norm(el.textContent).includes('periodo'))||null;
  }
  function findHistoryFilterCard(){
    const machine=document.getElementById('historyMachineSelect')||document.querySelector('[name="historyMachineSelect"],.machine-select-button,.selected-machine-text');
    const date=document.getElementById('historyDate')||document.querySelector('[name="historyDate"],.history-date,input[type="date"]');
    const period=findPeriodElement();
    if(machine&&period){let cur=machine.parentElement;while(cur&&cur!==document.body){if(cur.contains(period)&&(!date||cur.contains(date))&&!cur.querySelector('canvas')){const r=cur.getBoundingClientRect();if(r.width>=420&&r.height>=160)return cur;}cur=cur.parentElement;}}
    if(period){let cur=period.parentElement;while(cur&&cur!==document.body){const t=norm(cur.textContent);const r=cur.getBoundingClientRect();if(t.includes('maquina')&&t.includes('data')&&t.includes('periodo')&&!cur.querySelector('canvas')&&r.width>=420)return cur;cur=cur.parentElement;}}
    const items=Array.from(document.querySelectorAll('.admin-card,.history-card,.history-filter-card,.history-filters,.filter-card,section,form,div')).filter(visible).filter(el=>!el.closest('aside,nav,.sidebar,.admin-sidebar')).filter(el=>!el.querySelector('canvas')).map(el=>{const r=el.getBoundingClientRect();return{el,r,t:norm(el.textContent),area:r.width*r.height};}).filter(x=>x.r.width>=420&&x.r.height>=160&&x.t.includes('maquina')&&x.t.includes('data')&&x.t.includes('periodo'));
    items.sort((a,b)=>a.area-b.area);return items[0]?.el||null;
  }
  function installTopActions(){
    removeWrongButtons();
    const card=findHistoryFilterCard();if(!card)return;
    card.classList.add('history-filter-card-with-actions');
    if(getComputedStyle(card).position==='static')card.style.position='relative';
    let row=document.getElementById('historyActionRow');if(!row){row=document.createElement('div');row.id='historyActionRow';}
    row.className='history-action-row history-top-action-row';
    const tutorialBtn=makeButton('historyTutorialBtn','history-btn history-tutorial-btn','fas fa-graduation-cap','Tutorial','Como usar o histórico','tutorial');
    const pdfBtn=makeButton('exportHistoryPdfBtn','history-btn history-export-pdf-btn','fas fa-file-pdf','Exportar PDF','Gráfico + tabela','export-pdf');
    tutorialBtn.onclick=openTutorial;pdfBtn.onclick=exportPdfFallback;row.replaceChildren(tutorialBtn,pdfBtn);
    if(row.parentElement!==card)card.insertBefore(row,card.firstChild);
  }
  function ensureEmptyState(){
    const canvas=document.querySelector('canvas');const chartBox=canvas?(canvas.closest('.chart-container,.history-chart-container,.admin-card,section,div')||canvas.parentElement):null;if(!chartBox)return;
    if(getComputedStyle(chartBox).position==='static')chartBox.style.position='relative';
    const emptyText=Array.from(document.querySelectorAll('*')).find(el=>visible(el)&&(hasText(el,'Nenhum dado encontrado para o período')||hasText(el,'Nenhum dado encontrado para o periodo')));
    let empty=document.getElementById('historyEmptyState');if(!empty){empty=document.createElement('div');empty.id='historyEmptyState';empty.className='history-empty-state';empty.innerHTML='<div class="history-empty-card"><div class="history-empty-illustration"></div><h3>Nenhum dado encontrado</h3><p>Não existem registros para a máquina e o período selecionados. Altere a data, o turno ou escolha outra máquina.</p></div>';chartBox.appendChild(empty);}empty.style.display=emptyText?'flex':'none';
  }
  function boot(){installTopActions();ensureEmptyState();setInterval(()=>{installTopActions();ensureEmptyState();},LOOP_DELAY);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,READY_DELAY));else setTimeout(boot,READY_DELAY);
})();
