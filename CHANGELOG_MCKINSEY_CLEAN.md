# Revisão de interface - padrão McKinsey clean

## Ajustes aplicados

- Interface refeita com layout corporativo limpo, menos ornamentação e melhor hierarquia visual.
- Header simplificado com logo, status do arquivo e botão de exportação em PDF.
- Painel lateral reduzido para três blocos objetivos: arquivo, intervalos e metadados.
- Cards superiores redesenhados para mostrar apenas informações gerais do sismograma.
- Gráficos reorganizados com menos elementos visuais e melhor respiro.
- Chips externos de intervalo foram ocultados para reduzir ruído visual.
- Rótulos dos intervalos agora são desenhados em faixa superior do próprio gráfico, fora da área útil da waveform.
- Rótulos menores, com controle de sobreposição e marcador compacto quando há muitos intervalos próximos.
- Tabela consolidada de intervalos adicionada com pressão acústica em Pa/dB e PVS em mm/s.
- Botão Aplicar mantido com texto branco sobre fundo vermelho.
- Mantidos cálculo local, exportação PDF, suporte a múltiplos intervalos e cores distintas por intervalo.

## Arquivos principais alterados

- `index.html`
- `assets/styles.css`
- `assets/app.js`
