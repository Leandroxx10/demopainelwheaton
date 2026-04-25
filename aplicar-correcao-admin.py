from pathlib import Path

admin = Path('admin.html')
if not admin.exists():
    raise SystemExit('ERRO: coloque este script na raiz do projeto, junto do admin.html original.')

text = admin.read_text(encoding='utf-8')
original = text

# Backup único
backup = Path('admin.html.backup-antes-historico-v9')
if not backup.exists():
    backup.write_text(original, encoding='utf-8')

# CSS: injeta sem duplicar. Preferência: perto dos estilos do histórico/admin.
css_links = [
    '<link rel="stylesheet" href="history-charts.css">',
    '<link rel="stylesheet" href="history-polish.css">',
]
for link in css_links:
    if link not in text:
        if '<link rel="stylesheet" href="history-styles.css">' in text:
            text = text.replace('<link rel="stylesheet" href="history-styles.css">', '<link rel="stylesheet" href="history-styles.css">\n    ' + link, 1)
        elif '<link rel="stylesheet" href="prefix-modal.css">' in text:
            text = text.replace('<link rel="stylesheet" href="prefix-modal.css">', '<link rel="stylesheet" href="prefix-modal.css">\n    ' + link, 1)
        else:
            text = text.replace('</head>', '    ' + link + '\n</head>', 1)

# JS: garante que history-polish carregue depois de history-charts.
polish_script = '<script src="history-polish.js"></script>'
if polish_script not in text:
    if '<script src="history-charts.js"></script>' in text:
        text = text.replace('<script src="history-charts.js"></script>', '<script src="history-charts.js"></script>\n    ' + polish_script, 1)
    else:
        text = text.replace('</body>', '    <script src="history-charts.js"></script>\n    ' + polish_script + '\n</body>', 1)

# Remove botões antigos do bloco do histórico se existirem como botões simples de alternar/análise.
# A nova UI gera o exportar PDF e tutorial no padrão do filtro via history-polish.js.
replacements = [
    ('<button id="toggleChartTypeBtn" class="chart-action-btn"><i class="fas fa-chart-bar"></i> Barras</button>', ''),
    ('<button id="generateAnalysisBtn" class="chart-action-btn primary"><i class="fas fa-chart-line"></i> Gerar Análise</button>', ''),
]
for old, new in replacements:
    text = text.replace(old, new)

admin.write_text(text, encoding='utf-8')
print('OK: admin.html atualizado sem apagar o conteúdo original.')
print('Backup criado em:', backup)
