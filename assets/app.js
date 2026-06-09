const els = {
  fileInput: document.getElementById('csvFile'),
  dropzone: document.getElementById('dropzone'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  drbFile: document.getElementById('drbFile'),
  drbDropzone: document.getElementById('drbDropzone'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  statusPill: document.getElementById('statusPill'),
  metadataList: document.getElementById('metadataList'),
  intervalName: document.getElementById('intervalName'),
  startTime: document.getElementById('startTime'),
  endTime: document.getElementById('endTime'),
  applyIntervalBtn: document.getElementById('applyIntervalBtn'),
  clearIntervalBtn: document.getElementById('clearIntervalBtn'),
  clearAllIntervalsBtn: document.getElementById('clearAllIntervalsBtn'),
  focusInterval: document.getElementById('focusInterval'),
  intervalHint: document.getElementById('intervalHint'),
  intervalsList: document.getElementById('intervalsList'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),
  micIntervalTags: document.getElementById('micIntervalTags'),
  tranIntervalTags: document.getElementById('tranIntervalTags'),
  vertIntervalTags: document.getElementById('vertIntervalTags'),
  longIntervalTags: document.getElementById('longIntervalTags'),
  printReport: document.getElementById('printReport'),
  intervalSummarySection: document.getElementById('intervalSummarySection'),
  intervalSummaryBody: document.getElementById('intervalSummaryBody'),
  micPeak: document.getElementById('micPeak'),
  micPeakDetails: document.getElementById('micPeakDetails'),
  tranPeak: document.getElementById('tranPeak'),
  tranPeakDetails: document.getElementById('tranPeakDetails'),
  vertPeak: document.getElementById('vertPeak'),
  vertPeakDetails: document.getElementById('vertPeakDetails'),
  longPeak: document.getElementById('longPeak'),
  longPeakDetails: document.getElementById('longPeakDetails'),
  pvsPeak: document.getElementById('pvsPeak'),
  pvsPeakDetails: document.getElementById('pvsPeakDetails'),
  micChart: document.getElementById('micChart'),
  tranChart: document.getElementById('tranChart'),
  vertChart: document.getElementById('vertChart'),
  longChart: document.getElementById('longChart'),
  toast: document.getElementById('toast')
};

const colors = {
  grid: '#ede9e3',
  axis: '#d9d4cc',
  text: '#6b7280',
  ink: '#171717',
  peak: '#e30613',
  mic: '#202124',
  tran: '#365f91',
  vert: '#4f7f68',
  long: '#9a6a2f',
  zero: '#98a2b3'
};

const intervalPalette = [
  '#e30613',
  '#365f91',
  '#4f7f68',
  '#9a6a2f',
  '#7c3aed',
  '#0f766e',
  '#c2410c',
  '#be185d',
  '#0369a1',
  '#475569'
];

const FIRE_WINDOW = {
  pre: 2,
  post: 6
};

const state = {
  fileName: null,
  metadata: {},
  data: null,
  fireHistory: null,
  intervals: [],
  activeStats: null,
  activeLabel: 'Registro completo'
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 3600);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseCSVLine(line) {
  const out = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && quoted && next === '"') {
      value += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(value.trim());
      value = '';
    } else {
      value += ch;
    }
  }

  out.push(value.trim());
  return out;
}

function parseNumber(raw) {
  if (raw === undefined || raw === null) return NaN;
  const cleaned = String(raw)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9+\-eE.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseDateTimeString(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const normalized = value
    .replace(/\./g, '/')
    .replace(/\s+/g, ' ')
    .trim();

  const match = normalized.match(
    /^(\d{4})[\/-](\d{2})[\/-](\d{2})(?:[ T-](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?)?$/
  );
  if (match) {
    const [, yyyy, mm, dd, hh = '00', mi = '00', ss = '00'] = match;
    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const alt = normalized.match(
    /^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:[ T-](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?)?$/
  );
  if (!alt) return null;

  const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = alt;
  const date = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(mi),
    Number(ss)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEventDateTime(metadata) {
  const dateRaw = getMetadataValue(metadata, 'EventDate');
  const timeRaw = getMetadataValue(metadata, 'EventTime');
  const dateOnly = parseDateTimeString(dateRaw);
  if (dateOnly && timeRaw) {
    const time = String(timeRaw).trim();
    const timeMatch = time.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    if (timeMatch) {
      const out = new Date(dateOnly);
      out.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3]), 0);
      return out;
    }
  }

  if (dateOnly) return dateOnly;

  const combined = `${dateRaw || ''} ${timeRaw || ''}`.trim();
  return parseDateTimeString(combined);
}

function parseTimeInput(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const normalized = value.replace(',', '.');
  if (normalized.includes(':')) {
    const parts = normalized.split(':').map(Number);
    if (parts.some(n => !Number.isFinite(n))) return NaN;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return NaN;
  }

  return parseNumber(normalized);
}

function getMetadataValue(metadata, key) {
  const direct = metadata[key];
  if (direct !== undefined) return direct;
  const found = Object.keys(metadata).find(k => k.toLowerCase() === key.toLowerCase());
  return found ? metadata[found] : undefined;
}

function parseSampleRate(metadata, rowCount, recordTime) {
  const raw = getMetadataValue(metadata, 'SampleRate');
  const fromHeader = parseNumber(raw);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader;

  if (Number.isFinite(recordTime) && recordTime > 0 && rowCount > 0) {
    return rowCount / recordTime;
  }

  return 1024;
}

function findHeaderIndex(lines) {
  return lines.findIndex(line => {
    const cols = parseCSVLine(line).map(c => c.replace(/"/g, '').trim().toLowerCase());
    return cols.includes('tran') && cols.includes('vert') && cols.includes('long') && cols.some(c => c.startsWith('mic'));
  });
}

function normalizeChannelName(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  if (n === 'tran' || n.includes('trans')) return 'tran';
  if (n === 'vert' || n.includes('vertical')) return 'vert';
  if (n === 'long' || n.includes('longitudinal')) return 'long';
  if (n.startsWith('mic') || n.includes('pressure') || n.includes('sound')) return 'mic';
  if (n === 'time' || n.includes('tempo')) return 'time';
  return n;
}

function parseSismogramCSV(text, fileName = 'sismograma.csv') {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim().length);
  const headerIndex = findHeaderIndex(lines);

  if (headerIndex < 0) {
    throw new Error('Não encontrei a linha de canais Tran, Vert, Long e Mic/MicL no CSV.');
  }

  const metadata = {};
  for (let i = 0; i < headerIndex; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length >= 2) {
      const key = row[0].replace(/^"|"$/g, '');
      const value = row.slice(1).join(', ').replace(/^"|"$/g, '');
      metadata[key] = value;
    }
  }

  const headers = parseCSVLine(lines[headerIndex]).map(h => h.replace(/^"|"$/g, ''));
  const channelIndex = {};
  headers.forEach((header, index) => {
    const normalized = normalizeChannelName(header);
    if (['tran', 'vert', 'long', 'mic', 'time'].includes(normalized)) {
      channelIndex[normalized] = index;
    }
  });

  for (const required of ['tran', 'vert', 'long', 'mic']) {
    if (channelIndex[required] === undefined) {
      throw new Error(`Canal obrigatório não encontrado no CSV: ${required}.`);
    }
  }

  const recordTime = parseNumber(getMetadataValue(metadata, 'RecordTime'));
  const estimatedRows = Math.max(0, lines.length - headerIndex - 1);
  const sampleRate = parseSampleRate(metadata, estimatedRows, recordTime);

  const data = { time: [], tran: [], vert: [], long: [], mic: [] };

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const tran = parseNumber(row[channelIndex.tran]);
    const vert = parseNumber(row[channelIndex.vert]);
    const long = parseNumber(row[channelIndex.long]);
    const mic = parseNumber(row[channelIndex.mic]);

    if (![tran, vert, long, mic].every(Number.isFinite)) continue;

    const sampleIndex = data.time.length;
    let t = sampleIndex / sampleRate;
    if (channelIndex.time !== undefined) {
      const parsedTime = parseNumber(row[channelIndex.time]);
      if (Number.isFinite(parsedTime)) t = parsedTime;
    }

    data.time.push(t);
    data.tran.push(tran);
    data.vert.push(vert);
    data.long.push(long);
    data.mic.push(mic);
  }

  if (!data.time.length) {
    throw new Error('O CSV foi reconhecido, mas não contém amostras numéricas válidas.');
  }

  const duration = data.time[data.time.length - 1] || recordTime || 0;

  return {
    fileName,
    metadata,
    sampleRate,
    duration,
    data
  };
}

function parseDrbHistory(text, fileName = 'HISTO-DRB.txt') {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const entries = [];
  const headerRegex = /^\[(?<tag>[^\]]+)\](?<date>\d{4}[\/-]\d{2}[\/-]\d{2})-(?<time>\d{2}:\d{2}:\d{2})(?:;.*)?$/;

  const readPlanMetadata = (startIndex) => {
    const meta = {};
    for (let i = startIndex; i < Math.min(lines.length, startIndex + 8); i++) {
      const line = lines[i].trim();
      if (!line || line === '-' || line.startsWith('[')) break;
      if (!/^PU\d+/i.test(line)) continue;

      const parts = line.split(';').map(part => part.trim());
      meta.plan = parts[0] || meta.plan;

      const thirdField = parts[3] || '';
      const tailField = parts.slice(4).find(part => /^PP[A-Z0-9_]+/i.test(part)) || '';
      const fallbackName = parts.slice(1).find(part => /^[A-Z][A-Z0-9_ ]+$/i.test(part)) || '';

      if (!meta.fireName) {
        if (/^[A-Z][A-Z0-9_ ]+$/i.test(thirdField) && !/^\d/.test(thirdField)) {
          meta.fireName = thirdField;
        } else if (tailField) {
          meta.fireName = tailField.split(/\s+/)[0].trim();
        } else if (fallbackName) {
          meta.fireName = fallbackName;
        }
      }

      if (!meta.plan && parts[0]) meta.plan = parts[0];
    }
    return meta;
  };

  let currentDate = null;
  let lastPlan = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '-') continue;

    const header = line.match(headerRegex);
    if (header) {
      currentDate = header.groups.date;
      const tag = header.groups.tag;
      const time = header.groups.time;

      if (tag === 'BlastingPlan') {
        lastPlan = {
          date: currentDate,
          time,
          ...readPlanMetadata(i + 1)
        };
      }

      if (tag === 'Fire' || tag === 'FireButtonPressed') {
        const timestamp = parseDateTimeString(`${currentDate} ${time}`);
        if (!timestamp) continue;

        const effectiveTime = tag === 'Fire' ? time : null;
        const pressedTime = tag === 'FireButtonPressed'
          ? (lines[i].match(/-(\d{2}:\d{2}:\d{2})/)?.[1] || time)
          : null;
        const plan = lastPlan?.plan || null;
        const fireName = lastPlan?.fireName || null;
        const observation = lastPlan?.observation || null;
        const displayName = fireName || plan || `Disparo ${entries.length + 1}`;

        entries.push({
          type: tag,
          timestamp,
          effectiveTime,
          pressedTime,
          name: displayName,
          fireName,
          plan,
          observation,
          raw: line
        });

        if (tag === 'Fire') {
          lastPlan = null;
        }
      }
    }
  }

  return {
    fileName,
    entries
  };
}

function fmt(value, digits = 3) {
  if (!Number.isFinite(value)) return '--';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--';
  return `${sec.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} s`;
}

function paToDb(pa) {
  const p0 = 20e-6;
  const abs = Math.abs(pa);
  if (!Number.isFinite(abs) || abs <= 0) return NaN;
  return 20 * Math.log10(abs / p0);
}

function getIntervalColor(index) {
  if (intervalPalette[index]) return intervalPalette[index];
  const hue = (index * 137.508 + 12) % 360;
  return `hsl(${hue.toFixed(1)} 68% 42%)`;
}

function getFireWindowSeconds() {
  return FIRE_WINDOW.pre + FIRE_WINDOW.post;
}

function buildFireIntervalsFromHistory() {
  if (!state.data || !state.fireHistory?.entries?.length) return [];

  const recordStart = parseEventDateTime(state.data.metadata);
  if (!recordStart) return [];

  const duration = state.data.duration || (state.data.data.time.at(-1) ?? 0);
  const intervals = [];

  state.fireHistory.entries.forEach((entry, index) => {
    const sec = (entry.timestamp - recordStart) / 1000;
    if (!Number.isFinite(sec)) return;

    const start = Math.max(0, sec - FIRE_WINDOW.pre);
    const end = Math.min(duration, sec + FIRE_WINDOW.post);
    if (end <= start) return;

    const i0 = Math.min(indexForTime(start), indexForTime(end));
    const i1 = Math.max(indexForTime(start), indexForTime(end));
    const stats = calculateStats(i0, i1);

    intervals.push({
      id: `fire-${index + 1}-${entry.timestamp.getTime()}`,
      name: entry.name || `Disparo ${index + 1}`,
      start,
      end,
      i0,
      i1,
      color: getIntervalColor(index),
      stats,
      source: 'drb',
      rawTimestamp: entry.timestamp.toISOString()
    });
  });

  return intervals;
}

function applyAutoFireIntervals() {
  if (!state.data) return;

  const autoIntervals = buildFireIntervalsFromHistory();
  const manualIntervals = state.intervals.filter(interval => interval.source !== 'drb');
  state.intervals = [...manualIntervals, ...autoIntervals];

  if (autoIntervals.length) {
    setActiveStats(autoIntervals[autoIntervals.length - 1].stats, autoIntervals[autoIntervals.length - 1].name);
    showToast(`${autoIntervals.length} intervalo${autoIntervals.length > 1 ? 's' : ''} de DRB reconhecido${autoIntervals.length > 1 ? 's' : ''}.`);
  } else if (!manualIntervals.length) {
    setActiveStats(calculateFullStats(), 'Registro completo');
  }

  refreshUI();
}

function indexForTime(sec) {
  const sr = state.data.sampleRate;
  const maxIdx = state.data.data.time.length - 1;
  return Math.max(0, Math.min(maxIdx, Math.round(sec * sr)));
}

function findAbsPeak(arr, time, i0, i1) {
  let maxAbs = -Infinity;
  let value = 0;
  let idx = i0;

  for (let i = i0; i <= i1; i++) {
    const current = arr[i];
    const abs = Math.abs(current);
    if (abs > maxAbs) {
      maxAbs = abs;
      value = current;
      idx = i;
    }
  }

  return { value, abs: maxAbs, time: time[idx], index: idx };
}

function findPVSPeak(data, i0, i1) {
  let max = -Infinity;
  let idx = i0;

  for (let i = i0; i <= i1; i++) {
    const pvs = Math.sqrt(data.tran[i] ** 2 + data.vert[i] ** 2 + data.long[i] ** 2);
    if (pvs > max) {
      max = pvs;
      idx = i;
    }
  }

  return { value: max, time: data.time[idx], index: idx };
}

function calculateStats(i0, i1) {
  const d = state.data.data;
  return {
    mic: findAbsPeak(d.mic, d.time, i0, i1),
    tran: findAbsPeak(d.tran, d.time, i0, i1),
    vert: findAbsPeak(d.vert, d.time, i0, i1),
    long: findAbsPeak(d.long, d.time, i0, i1),
    pvs: findPVSPeak(d, i0, i1)
  };
}

function calculateFullStats() {
  if (!state.data) return null;
  return calculateStats(0, state.data.data.time.length - 1);
}

function buildIntervalFromInputs() {
  const startRaw = els.startTime.value.trim();
  const endRaw = els.endTime.value.trim();

  if (!startRaw && !endRaw) return null;

  let start = parseTimeInput(startRaw);
  let end = parseTimeInput(endRaw);

  if (start === null) start = 0;
  if (end === null) end = state.data.duration;

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('Use intervalos em segundos, mm:ss ou hh:mm:ss.');
  }

  start = Math.max(0, Math.min(state.data.duration, start));
  end = Math.max(0, Math.min(state.data.duration, end));

  if (start > end) [start, end] = [end, start];

  if (start === end) {
    const epsilon = 1 / Math.max(1, state.data.sampleRate || 1024);
    if (end + epsilon <= state.data.duration) {
      end = end + epsilon;
    } else if (start - epsilon >= 0) {
      start = start - epsilon;
    } else {
      end = Math.min(state.data.duration, start + epsilon);
    }
  }

  const i0 = Math.min(indexForTime(start), indexForTime(end));
  const i1 = Math.max(indexForTime(start), indexForTime(end));

  const name = els.intervalName.value.trim() || `Intervalo ${state.intervals.length + 1}`;
  const color = getIntervalColor(state.intervals.length);
  const stats = calculateStats(i0, i1);

  return {
    id: `interval-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    start,
    end,
    i0,
    i1,
    color,
    stats,
    source: 'manual'
  };
}

function updateMetadata() {
  if (!state.data) return;

  const metadata = state.data.metadata;
  const rows = [
    ['Arquivo', state.data.fileName],
    ['Evento', `${getMetadataValue(metadata, 'EventDate') || '--'} ${getMetadataValue(metadata, 'EventTime') || ''}`.trim()],
    ['Local', getMetadataValue(metadata, 'TitleString1') || getMetadataValue(metadata, 'Location') || '--'],
    ['Cliente', getMetadataValue(metadata, 'TitleString2') || '--'],
    ['Série', getMetadataValue(metadata, 'SerialNumber') || '--'],
    ['Amostragem', `${fmt(state.data.sampleRate, 0)} sps`],
    ['Duração', `${fmt(state.data.duration, 3)} s`],
    ['Amostras', state.data.data.time.length.toLocaleString('pt-BR')],
    ['Canais', 'Mic/MicL, Tran, Vert, Long'],
    ['Historial', state.fireHistory?.entries?.length ? `${state.fireHistory.entries.length.toLocaleString('pt-BR')} eventos DRB` : 'Não carregado']
  ];

  els.metadataList.innerHTML = rows.map(([key, value]) => `
    <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value || '--')}</dd></div>
  `).join('');
}

function updateOverviewCards() {
  if (!state.data) {
    els.micPeak.textContent = '--';
    els.micPeakDetails.textContent = 'Comunidade / ponto de monitoramento';
    els.tranPeak.textContent = '--';
    els.tranPeakDetails.textContent = 'Evento do sismograma';
    els.vertPeak.textContent = '--';
    els.vertPeakDetails.textContent = 'Número de série';
    els.longPeak.textContent = '--';
    els.longPeakDetails.textContent = 'Taxa de aquisição';
    els.pvsPeak.textContent = '--';
    els.pvsPeakDetails.textContent = 'Tempo total do registro';
    return;
  }

  const metadata = state.data.metadata;
  const local = getMetadataValue(metadata, 'TitleString1') || getMetadataValue(metadata, 'Location') || '--';
  const cliente = getMetadataValue(metadata, 'TitleString2') || '--';
  const date = getMetadataValue(metadata, 'EventDate') || '--';
  const time = getMetadataValue(metadata, 'EventTime') || '--';
  const serial = getMetadataValue(metadata, 'SerialNumber') || '--';
  const calibration = getMetadataValue(metadata, 'Calibration') || 'Calibração não informada';
  const fileName = state.data.fileName || '--';
  const fireCount = state.fireHistory?.entries?.length || 0;

  els.micPeak.textContent = local;
  els.micPeakDetails.textContent = `Cliente: ${cliente}`;

  els.tranPeak.textContent = date;
  els.tranPeakDetails.textContent = `Horário: ${time}`;

  els.vertPeak.textContent = serial;
  els.vertPeakDetails.textContent = calibration;

  els.longPeak.textContent = `${fmt(state.data.sampleRate, 0)} sps`;
  els.longPeakDetails.textContent = `${state.data.data.time.length.toLocaleString('pt-BR')} amostras`;

  els.pvsPeak.textContent = `${fmt(state.data.duration, 3)} s`;
  els.pvsPeakDetails.textContent = fireCount ? `${fileName} · ${fireCount} eventos DRB` : fileName;
}

function setActiveStats(stats, label) {
  state.activeStats = stats;
  state.activeLabel = label;
  updateOverviewCards();
}

function updateIntervalHint() {
  if (!state.data) {
    els.intervalHint.textContent = 'Importe um arquivo para iniciar a análise.';
    return;
  }

  if (!state.intervals.length) {
    els.intervalHint.textContent = 'Sem intervalo: registro completo.';
    return;
  }

  const count = state.intervals.length;
  els.intervalHint.textContent = `${count} intervalo${count > 1 ? 's' : ''} ativo${count > 1 ? 's' : ''}.`;
}

function updateIntervalsList() {
  if (!state.intervals.length) {
    els.intervalsList.innerHTML = '<p class="empty-list">Nenhum intervalo adicionado.</p>';
    return;
  }

  els.intervalsList.innerHTML = state.intervals.map(interval => `
    <div class="interval-item">
      <span class="interval-color" style="background:${interval.color}"></span>
      <div>
        <strong>${escapeHtml(interval.name)}</strong>
        <small>${fmtTime(interval.start)} a ${fmtTime(interval.end)}</small>
      </div>
      <button class="remove-interval" type="button" data-remove-interval="${interval.id}" title="Remover intervalo">×</button>
    </div>
  `).join('');

  els.intervalsList.querySelectorAll('[data-remove-interval]').forEach(button => {
    button.addEventListener('click', () => removeInterval(button.dataset.removeInterval));
  });
}

function formatIntervalMetric(interval, metric) {
  const stats = interval.stats || {};

  if (metric === 'mic') {
    const value = stats.mic?.abs ?? NaN;
    const db = paToDb(value);
    return `${fmt(value, 3)} Pa · ${fmt(db, 1)} dB`;
  }

  const value = stats[metric]?.abs ?? NaN;
  return `${fmt(value, 3)} mm/s`;
}

function formatIntervalLabel(interval) {
  return `${fmtTime(interval.start)} → ${fmtTime(interval.end)}`;
}

function truncateLabel(text, max = 24) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function compactIntervalMetric(interval, metric) {
  const stats = interval.stats || {};

  if (metric === 'mic') {
    const pa = stats.mic?.abs ?? NaN;
    const db = paToDb(pa);
    return `${fmt(pa, 2)} Pa · ${fmt(db, 1)} dB`;
  }

  const value = stats[metric]?.abs ?? NaN;
  return `${fmt(value, 2)} mm/s`;
}

function updateIntervalSummaryTable() {
  if (!els.intervalSummaryBody) return;

  if (!state.data) {
    els.intervalSummaryBody.innerHTML = '<tr><td colspan="5">Importe um CSV para iniciar a análise.</td></tr>';
    return;
  }

  const rows = state.intervals.length ? state.intervals : [{
    name: 'Registro completo',
    start: 0,
    end: state.data.duration,
    color: '#34383d',
    stats: state.activeStats || calculateFullStats()
  }];

  els.intervalSummaryBody.innerHTML = rows.map(interval => {
    const s = interval.stats || {};
    const micAbs = s.mic?.abs ?? NaN;
    const micDb = paToDb(micAbs);
    const pvs = s.pvs?.value ?? NaN;
    return `
      <tr>
        <td><span class="summary-dot" style="background:${interval.color}"></span>${escapeHtml(interval.name)}</td>
        <td>${fmtTime(interval.start)}</td>
        <td>${fmtTime(interval.end)}</td>
        <td>${fmt(micAbs, 2)} Pa · ${fmt(micDb, 1)} dB</td>
        <td>${fmt(pvs, 2)} mm/s</td>
      </tr>
    `;
  }).join('');
}

function renderChartIntervalTags() {
  const targets = [
    ['mic', els.micIntervalTags],
    ['tran', els.tranIntervalTags],
    ['vert', els.vertIntervalTags],
    ['long', els.longIntervalTags]
  ];

  for (const [metric, target] of targets) {
    if (!target) continue;

    if (!state.intervals.length) {
      target.innerHTML = '';
      continue;
    }

    const sorted = [...state.intervals].sort((a, b) => a.start - b.start);
    target.innerHTML = sorted.map((interval, index) => `
      <article class="interval-chip" style="--interval-color:${interval.color};" title="${escapeHtml(interval.name)} · ${formatIntervalLabel(interval)}">
        <span class="interval-chip__dot" aria-hidden="true"></span>
        <div class="interval-chip__copy">
          <strong>${index + 1}. ${escapeHtml(interval.name)}</strong>
          <small>${escapeHtml(formatIntervalLabel(interval))} · ${escapeHtml(formatIntervalMetric(interval, metric))}</small>
        </div>
      </article>
    `).join('');
  }
}

function refreshUI() {
  updateIntervalHint();
  updateIntervalsList();
  updateIntervalSummaryTable();
  renderChartIntervalTags();
  render();
}

function addInterval() {
  if (!state.data) {
    showToast('Importe um arquivo antes de aplicar o intervalo.');
    return;
  }

  try {
    const interval = buildIntervalFromInputs();

    if (!interval) {
      if (!state.intervals.length) {
        setActiveStats(calculateFullStats(), 'Registro completo');
        refreshUI();
        showToast('Campos vazios: registro completo exibido.');
      } else {
        showToast('Preencha início e final para adicionar outro intervalo ou remova todos.');
      }
      return;
    }

    state.intervals.push(interval);
    setActiveStats(interval.stats, interval.name);
    clearIntervalFields(false);
    refreshUI();
    showToast(`Intervalo "${interval.name}" adicionado.`);
  } catch (error) {
    showToast(error.message);
  }
}

function removeInterval(id) {
  const removedIndex = state.intervals.findIndex(interval => interval.id === id);
  if (removedIndex < 0) return;

  state.intervals.splice(removedIndex, 1);

  if (state.intervals.length) {
    const last = state.intervals[state.intervals.length - 1];
    setActiveStats(last.stats, last.name);
  } else {
    setActiveStats(calculateFullStats(), 'Registro completo');
  }

  refreshUI();
}

function clearIntervalFields(show = true) {
  els.intervalName.value = '';
  els.startTime.value = '';
  els.endTime.value = '';
  if (show) showToast('Campos de intervalo limpos.');
}

function clearAllIntervals() {
  state.intervals = [];
  if (state.data) {
    setActiveStats(calculateFullStats(), 'Registro completo');
  } else {
    setActiveStats(null, 'Registro completo');
  }
  refreshUI();
  showToast('Todos os intervalos foram removidos.');
}

function getRangeMinMax(seriesList, i0, i1) {
  let min = Infinity;
  let max = -Infinity;

  for (const series of seriesList) {
    const arr = series.data;
    const step = Math.max(1, Math.floor((i1 - i0) / 12000));
    for (let i = i0; i <= i1; i += step) {
      const value = arr[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: -1, max: 1 };
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }

  const padding = (max - min) * 0.14;
  return { min: min - padding, max: max + padding };
}

function niceTicks(min, max, count = 5) {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return [min, max];

  const rough = span / Math.max(1, count - 1);
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * power;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(v);
  return ticks.slice(0, 9);
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function getViewConfig(series, peak) {
  let viewStart = 0;
  let viewEnd = state.data?.duration || 1;

  if (state.data && state.intervals.length && els.focusInterval.checked) {
    const minStart = Math.min(...state.intervals.map(interval => interval.start));
    const maxEnd = Math.max(...state.intervals.map(interval => interval.end));
    const span = Math.max(1 / state.data.sampleRate, maxEnd - minStart);
    const pad = Math.max(span * 0.08, 0.25);
    viewStart = Math.max(0, minStart - pad);
    viewEnd = Math.min(state.data.duration, maxEnd + pad);
  }

  return {
    viewStart,
    viewEnd,
    intervals: state.intervals,
    series: series.filter(s => s.data),
    peak
  };
}

function drawChart(canvas, cfg) {
  const { ctx, width, height } = setupCanvas(canvas);
  const margin = { left: 66, right: 18, top: 46, bottom: 42 };
  const plotW = Math.max(1, width - margin.left - margin.right);
  const plotH = Math.max(1, height - margin.top - margin.bottom);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (!state.data) {
    ctx.fillStyle = colors.text;
    ctx.font = '650 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Importe um arquivo para visualizar a waveform', width / 2, height / 2);
    return;
  }

  const time = state.data.data.time;
  const { viewStart, viewEnd, intervals, series, yLabel, peak, metric } = cfg;
  const sr = state.data.sampleRate;
  const i0 = Math.max(0, Math.min(time.length - 1, Math.floor(viewStart * sr)));
  const i1 = Math.max(i0, Math.min(time.length - 1, Math.ceil(viewEnd * sr)));
  const { min: yMin, max: yMax } = getRangeMinMax(series, i0, i1);

  const xScale = sec => margin.left + ((sec - viewStart) / Math.max(0.000001, viewEnd - viewStart)) * plotW;
  const yScale = value => margin.top + (1 - ((value - yMin) / Math.max(0.000001, yMax - yMin))) * plotH;

  drawGrid(ctx, width, height, margin, plotW, plotH, viewStart, viewEnd, yMin, yMax, xScale, yScale, yLabel);
  drawIntervals(ctx, intervals, viewStart, viewEnd, xScale, margin, plotH, width);

  ctx.save();
  ctx.beginPath();
  ctx.rect(margin.left, margin.top, plotW, plotH);
  ctx.clip();

  for (const item of series) {
    drawWaveformSeries(ctx, item.data, time, i0, i1, xScale, yScale, item.color, plotW);
  }

  if (peak && peak.time >= viewStart && peak.time <= viewEnd) {
    drawPeakMarker(ctx, peak, xScale, yScale, margin, plotH);
  }

  ctx.restore();

  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);
}

function drawGrid(ctx, width, height, margin, plotW, plotH, viewStart, viewEnd, yMin, yMax, xScale, yScale, yLabel) {
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const yTicks = niceTicks(yMin, yMax, 6);
  yTicks.forEach(tick => {
    const y = yScale(tick);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    ctx.fillText(fmt(tick, Math.abs(tick) < 10 ? 2 : 1), margin.left - 10, y);
  });

  const xTicks = niceTicks(viewStart, viewEnd, 7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  xTicks.forEach(tick => {
    const x = xScale(tick);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotH);
    ctx.stroke();
    ctx.fillText(fmt(tick, tick < 10 ? 2 : 1), x, margin.top + plotH + 12);
  });

  const zeroY = yScale(0);
  if (zeroY >= margin.top && zeroY <= margin.top + plotH) {
    ctx.strokeStyle = colors.zero;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(width - margin.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(yLabel, margin.left, margin.top - 12);
  ctx.textAlign = 'right';
  ctx.fillText('Tempo (s)', width - margin.right, height - 18);
  ctx.restore();
}

function drawIntervals(ctx, intervals, viewStart, viewEnd, xScale, margin, plotH, width) {
  if (!intervals.length) return;
  const plotRight = width - margin.right;

  intervals.forEach((interval, index) => {
    const a = Math.max(viewStart, interval.start);
    const b = Math.min(viewEnd, interval.end);
    if (b < viewStart || a > viewEnd) return;

    const xA = xScale(a);
    const xB = xScale(b);
    const left = Math.max(margin.left, xA);
    const right = Math.min(plotRight, xB);

    ctx.save();
    ctx.fillStyle = hexToRgba(interval.color, 0.045);
    if (right > left) ctx.fillRect(left, margin.top, right - left, plotH);

    ctx.strokeStyle = interval.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    [interval.start, interval.end].forEach(sec => {
      if (sec < viewStart || sec > viewEnd) return;
      const x = xScale(sec);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + plotH);
      ctx.stroke();
    });
    ctx.restore();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function hexToRgba(color, alpha) {
  if (!color.startsWith('#')) return color.replace(')', ` / ${alpha})`);
  const hex = color.replace('#', '');
  const full = hex.length === 3
    ? hex.split('').map(c => c + c).join('')
    : hex;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawPeakMarker(ctx, peak, xScale, yScale, margin, plotH) {
  const x = xScale(peak.time);
  const y = yScale(peak.value);

  if (y < margin.top || y > margin.top + plotH) return;

  ctx.save();
  ctx.strokeStyle = colors.peak;
  ctx.fillStyle = colors.peak;
  ctx.lineWidth = 1.3;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x, margin.top);
  ctx.lineTo(x, margin.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWaveformSeries(ctx, arr, time, i0, i1, xScale, yScale, color, plotWidth) {
  const total = i1 - i0 + 1;
  const samplesPerPixel = total / Math.max(1, plotWidth);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;

  if (samplesPerPixel > 3) {
    ctx.beginPath();
    const pixelCount = Math.ceil(plotWidth);
    for (let px = 0; px < pixelCount; px++) {
      const start = i0 + Math.floor(px * samplesPerPixel);
      const end = Math.min(i1, i0 + Math.floor((px + 1) * samplesPerPixel));
      let min = Infinity;
      let max = -Infinity;

      for (let i = start; i <= end; i++) {
        const value = arr[i];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      const x = xScale(time[start]);
      ctx.moveTo(x, yScale(min));
      ctx.lineTo(x, yScale(max));
    }
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const x = xScale(time[i]);
    const y = yScale(arr[i]);
    if (i === i0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function render() {
  drawChart(els.micChart, {
    yLabel: 'Pressão acústica (Pa)',
    metric: 'mic',
    ...getViewConfig(
      [{ data: state.data?.data.mic, color: colors.mic }],
      null
    )
  });

  drawChart(els.tranChart, {
    yLabel: 'Tran (mm/s)',
    metric: 'tran',
    ...getViewConfig(
      [{ data: state.data?.data.tran, color: colors.tran }],
      null
    )
  });

  drawChart(els.vertChart, {
    yLabel: 'Vert (mm/s)',
    metric: 'vert',
    ...getViewConfig(
      [{ data: state.data?.data.vert, color: colors.vert }],
      null
    )
  });

  drawChart(els.longChart, {
    yLabel: 'Long (mm/s)',
    metric: 'long',
    ...getViewConfig(
      [{ data: state.data?.data.long, color: colors.long }],
      null
    )
  });
}

async function loadTextAsCSV(text, fileName) {
  els.statusPill.textContent = 'Processando arquivo...';

  await new Promise(resolve => setTimeout(resolve, 20));
  const parsed = parseSismogramCSV(text, fileName);

  state.fileName = fileName;
  state.metadata = parsed.metadata;
  state.data = parsed;
  state.intervals = [];
  state.activeStats = calculateFullStats();
  state.activeLabel = 'Registro completo';

  updateMetadata();
  updateOverviewCards();
  els.statusPill.textContent = 'Arquivo importado';
  showToast('Sismograma importado com sucesso.');
  refreshUI();

  if (state.fireHistory?.entries?.length) {
    applyAutoFireIntervals();
  }
}

async function loadTextAsHistory(text, fileName) {
  els.statusPill.textContent = 'Processando historial...';

  await new Promise(resolve => setTimeout(resolve, 20));
  const parsed = parseDrbHistory(text, fileName);

  state.fireHistory = parsed;
  els.statusPill.textContent = 'Historial importado';

  if (!parsed.entries.length) {
    showToast('Historial carregado, mas nenhum evento DRB foi encontrado.');
    refreshUI();
    return;
  }

  if (state.data) {
    applyAutoFireIntervals();
  } else {
    refreshUI();
  }

  showToast(`${parsed.entries.length} evento${parsed.entries.length > 1 ? 's' : ''} DRB carregado${parsed.entries.length > 1 ? 's' : ''}.`);
}

function readFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async event => {
    try {
      await loadTextAsCSV(event.target.result, file.name);
    } catch (error) {
      els.statusPill.textContent = 'Erro no arquivo';
      showToast(error.message);
    }
  };
  reader.onerror = () => showToast('Não foi possível ler o arquivo selecionado.');
  reader.readAsText(file);
}

function readHistoryFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async event => {
    try {
      await loadTextAsHistory(event.target.result, file.name);
    } catch (error) {
      els.statusPill.textContent = 'Erro no historial';
      showToast(error.message);
    }
  };
  reader.onerror = () => showToast('Não foi possível ler o historial selecionado.');
  reader.readAsText(file);
}

function reportRows() {
  if (!state.intervals.length) {
    const full = state.activeStats || calculateFullStats();
    const fake = {
      name: 'Registro completo',
      start: 0,
      end: state.data?.duration || 0,
      color: '#161616',
      stats: full
    };
    return [fake];
  }

  return state.intervals;
}

function metadataReportRows() {
  if (!state.data) return [];
  const metadata = state.data.metadata;
  return [
    ['Arquivo', state.data.fileName],
    ['Data e hora do evento', `${getMetadataValue(metadata, 'EventDate') || '--'} ${getMetadataValue(metadata, 'EventTime') || ''}`.trim()],
    ['Local', getMetadataValue(metadata, 'TitleString1') || getMetadataValue(metadata, 'Location') || '--'],
    ['Cliente', getMetadataValue(metadata, 'TitleString2') || '--'],
    ['Série do equipamento', getMetadataValue(metadata, 'SerialNumber') || '--'],
    ['Taxa de amostragem', `${fmt(state.data.sampleRate, 0)} sps`],
    ['Duração do registro', `${fmt(state.data.duration, 3)} s`],
    ['Amostras processadas', state.data.data.time.length.toLocaleString('pt-BR')],
    ['Canais analisados', 'Mic/MicL, Tran, Vert, Long'],
    ['Historial DRB', state.fireHistory?.entries?.length ? `${state.fireHistory.entries.length.toLocaleString('pt-BR')} eventos` : 'Não carregado']
  ];
}

function buildReportHTML() {
  if (!state.data) return '';

  const rows = reportRows();
  const generatedAt = new Date().toLocaleString('pt-BR');
  const metaRows = metadataReportRows();

  const cards = [
    ['Arquivo', state.data.fileName],
    ['Intervalos analisados', rows.length.toLocaleString('pt-BR')],
    ['Amostragem', `${fmt(state.data.sampleRate, 0)} sps`],
    ['Duração', `${fmt(state.data.duration, 3)} s`],
    ['Eventos DRB', state.fireHistory?.entries?.length ? state.fireHistory.entries.length.toLocaleString('pt-BR') : '0']
  ];

  const chartImages = {
    mic: els.micChart.toDataURL('image/png'),
    tran: els.tranChart.toDataURL('image/png'),
    vert: els.vertChart.toDataURL('image/png'),
    long: els.longChart.toDataURL('image/png')
  };

  const metaTable = metaRows.map(([key, value]) => `
    <tr>
      <td><strong>${escapeHtml(key)}</strong></td>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const intervalRows = rows.map(interval => {
    const s = interval.stats;
    const micDb = paToDb(s.mic.abs);
    return `
      <tr>
        <td><span class="report-color" style="background:${interval.color}"></span>${escapeHtml(interval.name)}</td>
        <td>${fmtTime(interval.start)}</td>
        <td>${fmtTime(interval.end)}</td>
        <td>${fmt(s.mic.abs, 3)} Pa<br>${fmt(micDb, 1)} dB</td>
        <td>${fmt(s.tran.abs, 3)} mm/s<br><span>${fmtTime(s.tran.time)}</span></td>
        <td>${fmt(s.vert.abs, 3)} mm/s<br><span>${fmtTime(s.vert.time)}</span></td>
        <td>${fmt(s.long.abs, 3)} mm/s<br><span>${fmtTime(s.long.time)}</span></td>
        <td>${fmt(s.pvs.value, 3)} mm/s<br><span>${fmtTime(s.pvs.time)}</span></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="report-page report-cover">
      <img class="report-logo" src="assets/enaex-brasil.png" alt="Enaex Brasil" />
      <p class="report-kicker">Relatório técnico de waveform</p>
      <h1 class="report-title">Analisador de Sismograma - Waveform</h1>
      <p class="report-subtitle">
        Relatório consolidado dos picos de pressão acústica e vibração por intervalo selecionado.
        A pressão acústica é apresentada em Pa e dB. As vibrações são apresentadas em mm/s para Tran, Vert e Long.
      </p>

      <div class="report-grid">
        ${cards.map(([label, value]) => `
          <div class="report-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="report-page">
      <h2 class="report-section-title">Metadados do sismograma</h2>
      <table class="report-table">
        <tbody>${metaTable}</tbody>
      </table>

      <h2 class="report-section-title" style="margin-top:12mm">Resumo dos intervalos</h2>
      <table class="report-table">
        <thead>
          <tr>
            <th>Intervalo</th>
            <th>Início</th>
            <th>Final</th>
            <th>Pressão acústica</th>
            <th>Tran</th>
            <th>Vert</th>
            <th>Long</th>
            <th>PVS</th>
          </tr>
        </thead>
        <tbody>${intervalRows}</tbody>
      </table>
    </div>

    <div class="report-page">
      <h2 class="report-section-title">Gráficos de waveform</h2>
      <div class="report-chart">
        <h3>Pressão acústica · Pa</h3>
        <img src="${chartImages.mic}" alt="Waveform da pressão acústica" />
      </div>
      <div class="report-chart">
        <h3>Vibração transversal · Tran</h3>
        <img src="${chartImages.tran}" alt="Waveform de vibração transversal" />
      </div>
      <div class="report-chart">
        <h3>Vibração vertical · Vert</h3>
        <img src="${chartImages.vert}" alt="Waveform de vibração vertical" />
      </div>
      <div class="report-chart">
        <h3>Vibração longitudinal · Long</h3>
        <img src="${chartImages.long}" alt="Waveform de vibração longitudinal" />
      </div>
    </div>

    <div class="report-footer">
      <span>Analisador de Sismograma - Waveform</span>
      <span>Gerado em ${escapeHtml(generatedAt)}</span>
    </div>
  `;
}

function exportReportPDF() {
  if (!state.data) {
    showToast('Importe um arquivo antes de exportar o relatório.');
    return;
  }

  els.printReport.innerHTML = buildReportHTML();
  window.setTimeout(() => window.print(), 80);
}

els.fileInput.addEventListener('change', event => readFile(event.target.files[0]));
els.drbFile.addEventListener('change', event => readHistoryFile(event.target.files[0]));
els.applyIntervalBtn.addEventListener('click', addInterval);
els.clearIntervalBtn.addEventListener('click', () => clearIntervalFields(true));
els.clearAllIntervalsBtn.addEventListener('click', clearAllIntervals);
els.clearHistoryBtn.addEventListener('click', () => {
  state.fireHistory = null;
  if (state.data) {
    state.intervals = state.intervals.filter(interval => interval.source !== 'drb');
    state.activeStats = state.intervals.length ? state.intervals[state.intervals.length - 1].stats : calculateFullStats();
    state.activeLabel = state.intervals.length ? state.intervals[state.intervals.length - 1].name : 'Registro completo';
    updateOverviewCards();
    refreshUI();
  } else {
    refreshUI();
  }
  els.statusPill.textContent = 'Historial removido';
  showToast('Historial DRB removido.');
});
els.focusInterval.addEventListener('change', () => {
  updateIntervalHint();
  render();
});
els.exportPdfBtn.addEventListener('click', exportReportPDF);
els.startTime.addEventListener('keydown', event => { if (event.key === 'Enter') addInterval(); });
els.endTime.addEventListener('keydown', event => { if (event.key === 'Enter') addInterval(); });
els.intervalName.addEventListener('keydown', event => { if (event.key === 'Enter') addInterval(); });

for (const eventName of ['dragenter', 'dragover']) {
  els.dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    els.dropzone.classList.add('dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  els.dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    els.dropzone.classList.remove('dragging');
  });
}

els.dropzone.addEventListener('drop', event => {
  const file = event.dataTransfer.files?.[0];
  readFile(file);
});

els.drbDropzone.addEventListener('dragenter', event => {
  event.preventDefault();
  els.drbDropzone.classList.add('dragging');
});
els.drbDropzone.addEventListener('dragover', event => {
  event.preventDefault();
  els.drbDropzone.classList.add('dragging');
});
els.drbDropzone.addEventListener('dragleave', event => {
  event.preventDefault();
  els.drbDropzone.classList.remove('dragging');
});
els.drbDropzone.addEventListener('drop', event => {
  event.preventDefault();
  els.drbDropzone.classList.remove('dragging');
  const file = event.dataTransfer.files?.[0];
  readHistoryFile(file);
});

els.loadSampleBtn.addEventListener('click', async () => {
  try {
    els.statusPill.textContent = 'Carregando exemplo...';
    const response = await fetch('sample/20260602-COMUNIDADE-DE-CORREDOR-UM16385.IDFW.CSV');
    if (!response.ok) throw new Error('Não foi possível carregar o exemplo. Rode por um servidor local ou pelo GitHub Pages.');
    const text = await response.text();
    await loadTextAsCSV(text, '20260602-COMUNIDADE-DE-CORREDOR-UM16385.IDFW.CSV');
  } catch (error) {
    els.statusPill.textContent = 'Aguardando arquivo';
    showToast(error.message);
  }
});

window.addEventListener('resize', () => {
  window.clearTimeout(render.resizeTimer);
  render.resizeTimer = window.setTimeout(render, 120);
});

updateIntervalSummaryTable();
render();
updateIntervalHint();
