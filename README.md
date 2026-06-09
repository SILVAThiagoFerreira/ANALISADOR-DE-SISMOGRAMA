# Analisador de Sismograma - Waveform

Projeto web estático para análise de sismogramas em CSV no padrão **Full Waveform**, com visual corporativo clean, gráficos separados por canal e pronto para hospedagem no **GitHub Pages**.

## O que o sistema faz

- Importa CSV de sismograma diretamente no navegador.
- Lê automaticamente os canais:
  - `Mic` / `MicL` para pressão acústica em Pa.
  - `Tran` para vibração transversal em mm/s.
  - `Vert` para vibração vertical em mm/s.
  - `Long` para vibração longitudinal em mm/s.
- Reconstrói o eixo de tempo pela taxa de amostragem do arquivo.
- Mostra, nos blocos superiores, as informações gerais do sismograma:
  - local;
  - data e hora;
  - equipamento;
  - amostragem;
  - duração.
- Permite cadastrar vários desmontes/intervalos.
- Cada desmonte pode receber um nome.
- Cada desmonte recebe uma cor diferente nos gráficos.
- Os valores de pico aparecem como rótulo dentro do próprio gráfico:
  - pressão acústica em Pa e dB no gráfico de pressão;
  - Tran no gráfico transversal;
  - Vert no gráfico vertical;
  - Long no gráfico longitudinal.
- Quando não há intervalo cadastrado, o sistema exibe o registro completo.
- Exporta um relatório em PDF pelo comando de impressão do navegador, com capa, metadados, tabela e gráficos.

## Como rodar localmente

Abra a pasta do projeto no terminal e rode:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

## Como usar

1. Clique em **Selecionar sismograma** ou arraste o arquivo para a área de importação.
2. Para marcar um desmonte, preencha:
   - Nome do intervalo;
   - Início;
   - Final.
3. Clique em **Aplicar**.
4. Repita o processo para adicionar outros desmontes.
5. Os valores calculados aparecem dentro dos gráficos, no rótulo colorido de cada intervalo.
6. Use **Exportar relatório PDF** para gerar o relatório. Na janela de impressão, escolha **Salvar como PDF**.

## Hospedagem no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos deste projeto para a raiz do repositório.
3. Vá em `Settings > Pages`.
4. Em `Build and deployment`, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Salve e aguarde o link público do Pages.
