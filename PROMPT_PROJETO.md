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
