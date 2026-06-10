# Prompt do projeto

Crie uma aplicação web estática, pronta para GitHub Pages, chamada **Analisador de Sismograma - Waveform**.

## Objetivo

A aplicação deve permitir importar um CSV full waveform extraído de sismógrafo e analisar a pressão acústica e as vibrações por desmonte/intervalo.

## Requisitos funcionais

1. O usuário deve importar um arquivo CSV.
2. O sistema deve identificar automaticamente os canais `Tran`, `Vert`, `Long` e `Mic`/`MicL`.
3. O sistema deve reconstruir o tempo com base na taxa de amostragem do arquivo.
4. Os blocos superiores devem exibir informações gerais do sismograma:
   - local;
   - data e hora;
   - equipamento;
   - taxa de amostragem;
   - duração do registro.
5. O usuário deve poder cadastrar mais de um intervalo/desmonte.
6. Cada intervalo/desmonte deve ter:
   - nome;
   - início;
   - final;
   - cor própria no gráfico.
7. Quando um intervalo for adicionado, o sistema deve calcular:
   - pico de pressão acústica em Pa e dB;
   - pico de vibração Tran;
   - pico de vibração Vert;
   - pico de vibração Long;
   - PVS.
8. Os valores de pico devem aparecer no próprio gráfico como rótulo colorido do intervalo.
9. Os eixos de vibração devem aparecer separados em três gráficos independentes:
   - Tran;
   - Vert;
   - Long.
10. Deve existir um gráfico separado para pressão acústica.
11. Deve existir exportação de relatório em PDF.
12. O projeto deve ser 100% estático, sem backend.

## Requisitos visuais

- Visual corporativo clean.
- Padrão McKinsey profissional.
- Identidade visual alinhada à pasta VISUAL.
- Uso de vermelho, grafite, cinza e fundo claro.
- Interface objetiva para uso operacional e técnico.
- Cards superiores com dados gerais.
- Gráficos com rótulos claros por desmonte/intervalo.

## Stack

- HTML
- CSS
- JavaScript puro
- Canvas nativo
- Sem dependências externas

## Atualização obrigatória adicionada

O projeto agora deve manter os gráficos normativos da **ABNT NBR 9653:2018** no site e no relatório PDF:

1. Gráfico de pressão sonora:
   - título: `Pressão Sonora em Eventos Sismográficos - ABNT NBR 9653:2018`;
   - limite horizontal de 134 dB(L);
   - pontos de pressão sonora calculados em dB(L);
   - distância lida do campo `ScaledDistance` do CSV.
2. Gráfico de vibração:
   - título: `Vibração em Eventos Sismográficos - ABNT NBR 9653:2018`;
   - eixo X logarítmico de frequência em Hz;
   - eixo Y PPV em mm/s;
   - curva limite 4 Hz/15 mm/s, 15 Hz/20 mm/s, 40 Hz/50 mm/s e 1000 Hz/50 mm/s;
   - pontos separados para Transversal, Longitudinal e Vertical.
3. Os dois gráficos devem entrar no PDF exportado antes dos gráficos de waveform.
4. O projeto deve continuar 100% estático, compatível com GitHub Pages, sem dependências externas.
