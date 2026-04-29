Correção aplicada - horário São Paulo / gráfico histórico

Arquivos alterados:
- auto-history-service.js
- history-charts.js
- daily-history-charts.js

Correções:
- Removido cálculo manual UTC-3 que deslocava horários e timestamps.
- Data/hora agora usa Intl.DateTimeFormat com timeZone America/Sao_Paulo.
- Timestamp continua sendo epoch real, adequado para Firebase/ordenação.
- Datas ISO e BR são normalizadas antes de filtrar por dia/turno.
- Correção do rótulo quebrado "22 (2026-)" no eixo X.
- Turnos usam a data selecionada em São Paulo: 24h, Turno 1, Turno 2, Turno 3 e período personalizado.
- Gráfico exibe "M" no fim da linha de Moldes e "BL" no fim da linha de Blanks.
