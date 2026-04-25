(function () {
  const steps = [
    {
      label: 'Etapa 1', title: 'Escolha a máquina correta', target: '#demoMachine',
      description: 'No campo Máquina, selecione o equipamento que deseja consultar. Esse filtro define qual histórico será exibido no gráfico.',
      callout: 'Use este campo primeiro. Sem escolher a máquina correta, os dados exibidos podem não representar o equipamento desejado.'
    },
    {
      label: 'Etapa 2', title: 'Selecione a data da consulta', target: '#demoDate',
      description: 'Depois escolha a data. O histórico pode ser consultado por dia, por turno ou por um intervalo personalizado.',
      callout: 'A data é a base da consulta. Para o terceiro turno, o sistema considera 22:00 até 06:00 do dia seguinte.'
    },
    {
      label: 'Etapa 3', title: 'Use os filtros de período', target: '#demoPeriod',
      description: 'Use 24h para ver o dia inteiro ou selecione Turno 1, Turno 2 ou Turno 3. Também é possível personalizar horário inicial e final.',
      callout: 'Turnos configurados: 06:00–14:00, 14:00–22:00 e 22:00–06:00.'
    },
    {
      label: 'Etapa 4', title: 'Escolha quais itens deseja visualizar', target: '#demoChips',
      description: 'Moldes e Blanks aparecem selecionados por padrão. Neck Rings e Funís podem ser ativados quando necessário.',
      callout: 'Ative apenas o que precisa comparar. Isso deixa o gráfico mais limpo e reduz erro de interpretação.'
    },
    {
      label: 'Etapa 5', title: 'Interprete o gráfico', target: '#demoChart',
      description: 'O gráfico mostra a quantidade registrada em cada horário. Use a linha temporal para entender perdas, reposições e variações de estoque.',
      callout: 'Quando não houver dados no período, o painel informa que nenhum dado foi encontrado.'
    },
    {
      label: 'Etapa 6', title: 'Exporte o PDF', target: '#demoPdf',
      description: 'O botão Exportar PDF gera um relatório com a visualização do gráfico e, abaixo, a tabela com quantidade por horário.',
      callout: 'Use o PDF para anexar em relatórios, auditorias ou acompanhamento de turno.'
    }
  ];

  let current = 0;
  const $ = (s) => document.querySelector(s);

  function render() {
    const step = steps[current];
    $('#historyStepLabel').textContent = step.label;
    $('#historyStepTitle').textContent = step.title;
    $('#historyStepDescription').textContent = step.description;
    $('#historyCallout').textContent = step.callout;
    $('#historyProgressBar').style.width = `${((current + 1) / steps.length) * 100}%`;

    document.querySelectorAll('#historyStepList li').forEach((li, index) => li.classList.toggle('active', index === current));
    document.querySelectorAll('.spotlight').forEach(el => el.classList.remove('spotlight'));
    const target = $(step.target);
    if (target) target.classList.add('spotlight');
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('#historyStepList').innerHTML = steps.map((s, i) => `<li data-step="${i}">${s.title}</li>`).join('');
    $('#historyStepList').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-step]');
      if (!li) return;
      current = Number(li.dataset.step);
      render();
    });
    $('#historyPrevStep').addEventListener('click', () => { current = Math.max(0, current - 1); render(); });
    $('#historyNextStep').addEventListener('click', () => { current = Math.min(steps.length - 1, current + 1); render(); });
    $('#historyStartBtn').addEventListener('click', () => { current = 0; render(); document.querySelector('.history-layout').scrollIntoView({ behavior: 'smooth' }); });
    render();
  });
})();
