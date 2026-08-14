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
  nbrStatusSummary: document.getElementById('nbrStatusSummary'),
  nbrPressureChart: document.getElementById('nbrPressureChart'),
  nbrVibrationChart: document.getElementById('nbrVibrationChart'),
  waveformZoomOutBtn: document.getElementById('waveformZoomOutBtn'),
  waveformZoomInBtn: document.getElementById('waveformZoomInBtn'),
  waveformResetBtn: document.getElementById('waveformResetBtn'),
  waveformZoomState: document.getElementById('waveformZoomState'),
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

function setStatus(text) {
  if (!els.statusPill) return;
  els.statusPill.textContent = text;
  els.statusPill.setAttribute('aria-label', text);
  els.statusPill.dataset.state = /importado/i.test(text) ? 'ready' : 'busy';
}

const colors = {
  grid: '#e3e6ea',
  axis: '#6c7680',
  text: '#6c7680',
  ink: '#38424b',
  peak: '#e20613',
  mic: '#38424b',
  tran: '#e20613',
  vert: '#22c55e',
  long: '#1f4ab8',
  zero: '#8b949e',
  nbrLine: '#38424b',
  nbrGuide: '#e20613',
  nbrTran: '#e20613',
  nbrLong: '#1f4ab8',
  nbrVert: '#22c55e'
};

const intervalPalette = [
  '#e20613',
  '#1f4ab8',
  '#22c55e',
  '#8d681d',
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

const WAVEFORM_MARGIN = { left: 66, right: 18, top: 46, bottom: 42 };
const WAVEFORM_ZOOM_STEP = 0.82;
const WAVEFORM_MIN_SPAN_SECONDS = 1 / 1024;
const waveformInteractions = new WeakMap();
const INTERACTIVE_CHARTS = [
  {
    metric: 'mic',
    canvas: () => els.micChart,
    label: 'Pressão acústica',
    unit: 'Pa'
  },
  {
    metric: 'tran',
    canvas: () => els.tranChart,
    label: 'Vibração transversal',
    unit: 'mm/s'
  },
  {
    metric: 'vert',
    canvas: () => els.vertChart,
    label: 'Vibração vertical',
    unit: 'mm/s'
  },
  {
    metric: 'long',
    canvas: () => els.longChart,
    label: 'Vibração longitudinal',
    unit: 'mm/s'
  }
];

const state = {
  fileName: null,
  metadata: {},
  data: null,
  fireHistory: null,
  intervals: [],
  activeStats: null,
  activeLabel: 'Registro completo',
  chartSelection: {
    active: false,
    metric: null,
    startTime: null,
    hoverTime: null
  },
  waveformViewport: null,
  exporting: false
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
  if (end === null) {
    end = state.chartSelection.active && Number.isFinite(state.chartSelection.hoverTime)
      ? state.chartSelection.hoverTime
      : state.data.duration;
  }

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

function formatSelectionTime(value) {
  return Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : '';
}

function getWaveformViewRange() {
  if (state.waveformViewport) {
    return {
      viewStart: state.waveformViewport.start,
      viewEnd: state.waveformViewport.end
    };
  }

  let viewStart = 0;
  let viewEnd = state.data?.duration || 1;

  if (state.data && state.intervals.length && els.focusInterval.checked) {
    const minStart = Math.min(...state.intervals.map(interval => interval.start));
    const maxEnd = Math.max(...state.intervals.map(interval => interval.end));
    const span = Math.max(getWaveformMinSpan(), maxEnd - minStart);
    const pad = Math.max(span * 0.08, 0.25);
    viewStart = Math.max(0, minStart - pad);
    viewEnd = Math.min(state.data.duration, maxEnd + pad);
  }

  return { viewStart, viewEnd };
}

function getWaveformMinSpan() {
  const sampleRate = Math.max(1, state.data?.sampleRate || 0);
  return Math.max(1 / sampleRate, WAVEFORM_MIN_SPAN_SECONDS);
}

function clampWaveformViewport(start, end) {
  const duration = state.data?.duration;
  if (!Number.isFinite(duration) || duration <= 0) return null;

  let viewStart = Number(start);
  let viewEnd = Number(end);
  if (!Number.isFinite(viewStart) || !Number.isFinite(viewEnd)) return null;
  if (viewStart > viewEnd) [viewStart, viewEnd] = [viewEnd, viewStart];

  const minSpan = Math.min(duration, getWaveformMinSpan());
  if (viewEnd - viewStart < minSpan) {
    const mid = (viewStart + viewEnd) / 2;
    viewStart = mid - minSpan / 2;
    viewEnd = mid + minSpan / 2;
  }

  if (viewStart < 0) {
    viewEnd -= viewStart;
    viewStart = 0;
  }

  if (viewEnd > duration) {
    viewStart -= viewEnd - duration;
    viewEnd = duration;
  }

  if (viewStart < 0) viewStart = 0;
  if (viewEnd > duration) viewEnd = duration;

  if (viewEnd - viewStart < minSpan) {
    if (duration <= minSpan) return { start: 0, end: duration };
    viewStart = Math.max(0, Math.min(duration - minSpan, viewStart));
    viewEnd = viewStart + minSpan;
  }

  return { start: viewStart, end: viewEnd };
}

function syncWaveformViewportUI() {
  const zoomed = Boolean(state.waveformViewport);
  const focusMode = !zoomed && Boolean(state.data && state.intervals.length && els.focusInterval.checked);
  const label = zoomed
    ? `Zoom manual · ${fmtTime(state.waveformViewport.start)} → ${fmtTime(state.waveformViewport.end)}`
    : focusMode
      ? 'Foco automático nos intervalos'
      : 'Visão completa';

  if (els.waveformZoomState) {
    els.waveformZoomState.textContent = label;
  }

  if (els.waveformResetBtn) {
    els.waveformResetBtn.disabled = !zoomed;
  }

  INTERACTIVE_CHARTS.forEach(def => {
    const canvas = def.canvas();
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (wrap?.classList) {
      wrap.classList.toggle('zoomed', zoomed);
      const interaction = waveformInteractions.get(canvas);
      wrap.classList.toggle('panning', Boolean(interaction?.dragging));
    }
    canvas.title = zoomed
      ? 'Clique para marcar intervalos. Roda do mouse para ampliar ou reduzir. Arraste para mover o zoom.'
      : 'Clique para marcar intervalos. Roda do mouse para dar zoom. Arraste para mover quando ampliado.';
  });
}

function setWaveformViewport(start, end, options = {}) {
  const next = clampWaveformViewport(start, end);
  if (!next) return;

  state.waveformViewport = next;
  syncWaveformViewportUI();
  updateIntervalHint();
  scheduleRender();

  if (!options.silent && options.toast) {
    showToast(options.toast);
  }
}

function resetWaveformViewport(options = {}) {
  if (!state.waveformViewport) {
    syncWaveformViewportUI();
    return;
  }

  state.waveformViewport = null;
  syncWaveformViewportUI();
  updateIntervalHint();
  scheduleRender();

  if (!options.silent) {
    showToast(options.toast || 'Visão completa restaurada.');
  }
}

function zoomWaveformAt(anchorTime, factor, options = {}) {
  const { viewStart, viewEnd } = getWaveformViewRange();
  const currentSpan = Math.max(getWaveformMinSpan(), viewEnd - viewStart);
  const targetSpan = Math.max(getWaveformMinSpan(), Math.min(state.data.duration, currentSpan * factor));
  const anchor = Number.isFinite(anchorTime) ? anchorTime : (viewStart + viewEnd) / 2;

  let start = anchor - ((anchor - viewStart) / currentSpan) * targetSpan;
  let end = start + targetSpan;

  const clamped = clampWaveformViewport(start, end);
  if (!clamped) return;

  setWaveformViewport(clamped.start, clamped.end, options);
}

function panWaveformBy(deltaSeconds, options = {}) {
  if (!state.waveformViewport) return;
  const start = state.waveformViewport.start + deltaSeconds;
  const end = state.waveformViewport.end + deltaSeconds;
  setWaveformViewport(start, end, options);
}

function getWaveformChartBounds(canvas) {
  const rect = canvas.getBoundingClientRect();
  const { viewStart, viewEnd } = getWaveformViewRange();
  const plotLeft = WAVEFORM_MARGIN.left;
  const plotRight = Math.max(plotLeft + 1, rect.width - WAVEFORM_MARGIN.right);
  const plotTop = WAVEFORM_MARGIN.top;
  const plotBottom = Math.max(plotTop + 1, rect.height - WAVEFORM_MARGIN.bottom);
  return {
    rect,
    viewStart,
    viewEnd,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    plotWidth: plotRight - plotLeft,
    plotHeight: plotBottom - plotTop
  };
}

function getWaveformTimeFromPointer(canvas, event) {
  const bounds = getWaveformChartBounds(canvas);
  const x = event.clientX - bounds.rect.left;
  const y = event.clientY - bounds.rect.top;

  if (x < bounds.plotLeft || x > bounds.plotRight || y < bounds.plotTop || y > bounds.plotBottom) {
    return null;
  }

  const ratio = (x - bounds.plotLeft) / Math.max(0.000001, bounds.plotWidth);
  const time = bounds.viewStart + ratio * (bounds.viewEnd - bounds.viewStart);
  return Math.max(bounds.viewStart, Math.min(bounds.viewEnd, time));
}

function clearChartSelection(shouldRender = true) {
  state.chartSelection.active = false;
  state.chartSelection.metric = null;
  state.chartSelection.startTime = null;
  state.chartSelection.hoverTime = null;
  if (shouldRender) scheduleRender();
}

function startChartSelection(metric, time) {
  state.chartSelection.active = true;
  state.chartSelection.metric = metric;
  state.chartSelection.startTime = time;
  state.chartSelection.hoverTime = time;
  els.startTime.value = formatSelectionTime(time);
  els.endTime.value = '';
  updateIntervalHint();
  scheduleRender();
}

function updateChartSelectionHover(time) {
  if (!state.chartSelection.active) return;
  state.chartSelection.hoverTime = time;
  scheduleRender();
}

function completeChartSelection(time) {
  if (!state.chartSelection.active) return;
  els.endTime.value = formatSelectionTime(time);
  addInterval();
}

function getWaveformMetricLabel(metric) {
  return INTERACTIVE_CHARTS.find(item => item.metric === metric)?.label || 'gráfico';
}

function scheduleRender() {
  if (render.scheduleTimer) return;
  render.scheduleTimer = window.requestAnimationFrame(() => {
    render.scheduleTimer = 0;
    render();
  });
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
    syncWaveformViewportUI();
    return;
  }

  if (state.chartSelection.active && Number.isFinite(state.chartSelection.startTime)) {
    const start = formatSelectionTime(state.chartSelection.startTime);
    const end = formatSelectionTime(state.chartSelection.hoverTime ?? state.chartSelection.startTime);
    const label = getWaveformMetricLabel(state.chartSelection.metric);
    els.intervalHint.textContent = `Seleção ativa em ${label}: ${start} → ${end}. Clique no gráfico para confirmar o final ou pressione Esc para cancelar.`;
    syncWaveformViewportUI();
    return;
  }

  if (state.waveformViewport) {
    els.intervalHint.textContent = `Zoom manual ativo de ${fmtTime(state.waveformViewport.start)} a ${fmtTime(state.waveformViewport.end)}. Use a roda do mouse, os botões ou arraste o gráfico para navegar.`;
    syncWaveformViewportUI();
    return;
  }

  if (!state.intervals.length) {
    els.intervalHint.textContent = 'Sem intervalo: registro completo. Clique no gráfico, use a roda do mouse para dar zoom ou preencha os campos numéricos.';
    syncWaveformViewportUI();
    return;
  }

  const count = state.intervals.length;
  els.intervalHint.textContent = `${count} intervalo${count > 1 ? 's' : ''} ativo${count > 1 ? 's' : ''}. Clique no gráfico, use a roda do mouse para zoom ou use os campos numéricos para adicionar outro.`;
  syncWaveformViewportUI();
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
    color: '#38424b',
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
  clearChartSelection(false);
  if (show) showToast('Campos de intervalo limpos.');
}

function clearAllIntervals() {
  state.intervals = [];
  clearChartSelection(false);
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


function parseDistanceMeters(metadata) {
  const candidates = [
    getMetadataValue(metadata, 'ScaledDistance'),
    getMetadataValue(metadata, 'Distance'),
    getMetadataValue(metadata, 'Distancia'),
    getMetadataValue(metadata, 'Distância'),
    getMetadataValue(metadata, 'LocationDistance')
  ].filter(Boolean);

  for (const raw of candidates) {
    const text = String(raw);
    const insideParentheses = text.match(/\(([\d.,]+)\s*m\b/i);
    if (insideParentheses) {
      const value = parseNumber(insideParentheses[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }

    const distanceWithUnit = text.match(/([\d.,]+)\s*m\b/i);
    if (distanceWithUnit) {
      const value = parseNumber(distanceWithUnit[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return NaN;
}

function getDistanceMeters() {
  if (!state.data) return NaN;
  return parseDistanceMeters(state.data.metadata || {});
}

function metadataFrequency(channel) {
  if (!state.data) return NaN;
  const keyMap = {
    tran: 'TranZCFreq',
    vert: 'VertZCFreq',
    long: 'LongZCFreq'
  };
  return parseNumber(getMetadataValue(state.data.metadata, keyMap[channel]));
}

function estimateZeroCrossingFrequency(channel, peak, interval) {
  if (!state.data?.data?.[channel]) return NaN;

  const arr = state.data.data[channel];
  const time = state.data.data.time;
  const sr = Math.max(1, state.data.sampleRate || 1024);
  const peakIndex = Number.isFinite(peak?.index)
    ? peak.index
    : indexForTime(Number.isFinite(peak?.time) ? peak.time : 0);

  const intervalStart = Number.isFinite(interval?.i0) ? interval.i0 : 0;
  const intervalEnd = Number.isFinite(interval?.i1) ? interval.i1 : arr.length - 1;
  const halfWindow = Math.max(16, Math.round(sr * 0.35));
  const start = Math.max(0, intervalStart, peakIndex - halfWindow);
  const end = Math.min(arr.length - 1, intervalEnd, peakIndex + halfWindow);

  if (end - start < 8) return metadataFrequency(channel);

  const crossings = [];
  for (let i = start + 1; i <= end; i++) {
    const a = arr[i - 1];
    const b = arr[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

    if (a === 0) {
      crossings.push(time[i - 1]);
      continue;
    }

    if ((a < 0 && b > 0) || (a > 0 && b < 0) || b === 0) {
      const t0 = time[i - 1];
      const t1 = time[i];
      const ratio = Math.abs(a) / Math.max(Math.abs(a) + Math.abs(b), 0.000001);
      crossings.push(t0 + (t1 - t0) * ratio);
    }
  }

  if (crossings.length >= 3) {
    const first = crossings[0];
    const last = crossings[crossings.length - 1];
    const duration = last - first;
    const halfCycles = crossings.length - 1;
    const freq = halfCycles / (2 * Math.max(duration, 0.000001));
    if (Number.isFinite(freq) && freq > 0.1 && freq <= 1000) return freq;
  }

  return metadataFrequency(channel);
}

function nbrVibrationLimit(freq) {
  const f = Number(freq);
  if (!Number.isFinite(f) || f <= 0) return NaN;
  if (f <= 4) return 15;
  if (f <= 15) return 15 + ((f - 4) / 11) * 5;
  if (f <= 40) return 20 + ((f - 15) / 25) * 30;
  return 50;
}

function getNBRIntervals() {
  if (!state.data) return [];
  if (state.intervals.length) return state.intervals;

  return [{
    id: 'full-record-nbr',
    name: 'Registro completo',
    start: 0,
    end: state.data.duration || 0,
    i0: 0,
    i1: state.data.data.time.length - 1,
    color: '#38424b',
    stats: state.activeStats || calculateFullStats(),
    source: 'full'
  }];
}

function getNBRComplianceRows() {
  if (!state.data) return [];

  const distance = getDistanceMeters();
  const channels = [
    { key: 'tran', label: 'Transversal', unit: 'mm/s', color: colors.nbrTran, shape: 'square' },
    { key: 'long', label: 'Longitudinal', unit: 'mm/s', color: colors.nbrLong, shape: 'diamond' },
    { key: 'vert', label: 'Vertical', unit: 'mm/s', color: colors.nbrVert, shape: 'triangle' }
  ];

  return getNBRIntervals().map((interval, intervalIndex) => {
    const stats = interval.stats || calculateFullStats();
    const pressurePa = stats?.mic?.abs ?? NaN;
    const pressureDb = paToDb(pressurePa);

    return {
      interval,
      intervalIndex,
      distance,
      pressurePa,
      pressureDb,
      pressureCompliant: Number.isFinite(pressureDb) ? pressureDb <= 134 : null,
      channels: channels.map(channel => {
        const peak = stats?.[channel.key] || {};
        const ppv = peak.abs ?? NaN;
        const officialFreq = metadataFrequency(channel.key);
        const freq = interval.source === 'full' && Number.isFinite(officialFreq)
          ? officialFreq
          : estimateZeroCrossingFrequency(channel.key, peak, interval);
        const limit = nbrVibrationLimit(freq);
        return {
          ...channel,
          ppv,
          freq,
          limit,
          compliant: Number.isFinite(ppv) && Number.isFinite(limit) ? ppv <= limit : null
        };
      })
    };
  });
}

function updateNBRStatus() {
  if (!els.nbrStatusSummary) return;

  if (!state.data) {
    els.nbrStatusSummary.textContent = 'Aguardando arquivo';
    els.nbrStatusSummary.className = 'nbr-badge';
    return;
  }

  const rows = getNBRComplianceRows();
  const allChecks = rows.flatMap(row => [row.pressureCompliant, ...row.channels.map(c => c.compliant)])
    .filter(value => value !== null);
  const hasDistance = Number.isFinite(getDistanceMeters());
  const nonCompliant = allChecks.some(value => value === false);

  els.nbrStatusSummary.className = `nbr-badge ${nonCompliant ? 'alert' : 'ok'}`;
  if (!hasDistance) {
    els.nbrStatusSummary.textContent = nonCompliant
      ? 'Atenção: distância ausente'
      : 'Distância ausente no CSV';
    return;
  }

  els.nbrStatusSummary.textContent = nonCompliant
    ? 'Ponto acima do limite'
    : 'Pontos abaixo dos limites';
}

function drawCanvasMessage(canvas, message) {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.text;
  ctx.font = '650 13px Aptos, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
}

function drawNBRPoint(ctx, x, y, color, shape = 'circle', size = 4.5) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();

  if (shape === 'square') {
    ctx.rect(x - size, y - size, size * 2, size * 2);
  } else if (shape === 'diamond') {
    ctx.moveTo(x, y - size - 1);
    ctx.lineTo(x + size + 1, y);
    ctx.lineTo(x, y + size + 1);
    ctx.lineTo(x - size - 1, y);
    ctx.closePath();
  } else if (shape === 'triangle') {
    ctx.moveTo(x, y - size - 1);
    ctx.lineTo(x + size + 1, y + size);
    ctx.lineTo(x - size - 1, y + size);
    ctx.closePath();
  } else {
    ctx.arc(x, y, size, 0, Math.PI * 2);
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawNBRPressureChart(canvas) {
  if (!canvas) return;
  if (!state.data) {
    drawCanvasMessage(canvas, 'Importe um CSV para gerar o gráfico de pressão sonora da NBR 9653.');
    return;
  }

  const rows = getNBRComplianceRows();
  const distance = getDistanceMeters();
  const { ctx, width, height } = setupCanvas(canvas);
  const margin = { left: 72, right: 52, top: 34, bottom: 54 };
  const plotW = Math.max(1, width - margin.left - margin.right);
  const plotH = Math.max(1, height - margin.top - margin.bottom);
  const maxDistance = Number.isFinite(distance) ? Math.max(6000, Math.ceil(distance / 1000) * 1000) : 6000;
  const yMin = 0;
  const yMax = 160;

  const xScale = value => margin.left + (value / maxDistance) * plotW;
  const yScale = value => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = '#8f949a';
  ctx.lineWidth = 1;
  ctx.font = '11px Aptos, Segoe UI, sans-serif';
  ctx.fillStyle = '#6f7378';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let y = 0; y <= 160; y += 20) {
    const py = yScale(y);
    ctx.beginPath();
    ctx.moveTo(margin.left, py);
    ctx.lineTo(margin.left + plotW, py);
    ctx.stroke();
    ctx.fillText(String(y), margin.left - 10, py);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xStep = maxDistance <= 6000 ? 1000 : Math.ceil(maxDistance / 6 / 1000) * 1000;
  for (let x = 0; x <= maxDistance; x += xStep) {
    const px = xScale(x);
    ctx.beginPath();
    ctx.moveTo(px, margin.top);
    ctx.lineTo(px, margin.top + plotH);
    ctx.stroke();
    ctx.fillText(x.toLocaleString('pt-BR'), px, margin.top + plotH + 12);
  }

  const limitY = yScale(134);
  ctx.strokeStyle = colors.nbrLine;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(margin.left, limitY);
  ctx.lineTo(margin.left + plotW, limitY);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1f2328';
  ctx.lineWidth = 1;
  ctx.fillRect(margin.left - 30, limitY - 8, 24, 16);
  ctx.strokeRect(margin.left - 30, limitY - 8, 24, 16);
  ctx.fillRect(margin.left + plotW + 6, limitY - 8, 28, 16);
  ctx.strokeRect(margin.left + plotW + 6, limitY - 8, 28, 16);
  ctx.fillStyle = '#30343a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('134', margin.left - 18, limitY);
  ctx.fillText('134', margin.left + plotW + 20, limitY);

  if (Number.isFinite(distance)) {
    rows.forEach((row, index) => {
      if (!Number.isFinite(row.pressureDb)) return;
      const jitter = rows.length > 1 ? (index - (rows.length - 1) / 2) * Math.min(36, plotW * 0.008) : 0;
      const px = Math.max(margin.left, Math.min(margin.left + plotW, xScale(distance) + jitter));
      const py = yScale(Math.max(yMin, Math.min(yMax, row.pressureDb)));
      drawNBRPoint(ctx, px, py, colors.peak, 'circle', 4.4);
      ctx.fillStyle = '#6f7378';
      ctx.font = '10px Aptos, Segoe UI, sans-serif';
      ctx.textBaseline = 'bottom';
      const label = fmt(row.pressureDb, 1);
      if (px > margin.left + plotW - 46) {
        ctx.textAlign = 'right';
        ctx.fillText(label, px - 7, py - 7);
      } else if (px < margin.left + 46) {
        ctx.textAlign = 'left';
        ctx.fillText(label, px + 7, py - 7);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(label, px, py - 7);
      }
    });
  } else {
    ctx.fillStyle = '#6f7378';
    ctx.font = '650 12px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Distância não encontrada no campo ScaledDistance do CSV.', margin.left + plotW / 2, margin.top + plotH / 2);
  }

  ctx.strokeStyle = '#8f949a';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);

  ctx.fillStyle = '#6f7378';
  ctx.font = '11px Aptos, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Distância (m)', margin.left + plotW / 2, height - 10);

  ctx.save();
  ctx.translate(15, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Pressão Acústica (dB)', 0, 0);
  ctx.restore();
}

function log10(value) {
  return Math.log(value) / Math.LN10;
}

function drawNBRVibrationChart(canvas) {
  if (!canvas) return;
  if (!state.data) {
    drawCanvasMessage(canvas, 'Importe um CSV para gerar o gráfico de vibração da NBR 9653.');
    return;
  }

  const rows = getNBRComplianceRows();
  const points = rows.flatMap((row, intervalIndex) => row.channels.map(channel => ({
    ...channel,
    intervalName: state.exporting ? formatReportIntervalName(row.interval) : row.interval.name,
    intervalIndex
  })));

  const { ctx, width, height } = setupCanvas(canvas);
  const margin = { left: 68, right: 48, top: 34, bottom: 54 };
  const plotW = Math.max(1, width - margin.left - margin.right);
  const plotH = Math.max(1, height - margin.top - margin.bottom);
  const xMin = 1;
  const xMax = 1000;
  const yMin = 0;
  const yMax = 60;
  const xScale = value => margin.left + ((log10(Math.max(xMin, Math.min(xMax, value))) - log10(xMin)) / (log10(xMax) - log10(xMin))) * plotW;
  const yScale = value => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = '#8f949a';
  ctx.lineWidth = 1;
  ctx.font = '11px Aptos, Segoe UI, sans-serif';
  ctx.fillStyle = '#6f7378';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let y = 0; y <= 60; y += 10) {
    const py = yScale(y);
    ctx.beginPath();
    ctx.moveTo(margin.left, py);
    ctx.lineTo(margin.left + plotW, py);
    ctx.stroke();
    ctx.fillText(String(y), margin.left - 10, py);
  }

  const majorTicks = [1, 10, 100, 1000];
  const minorTicks = [];
  for (const decade of [1, 10, 100]) {
    for (let m = 2; m <= 9; m++) minorTicks.push(m * decade);
  }

  ctx.strokeStyle = '#c0c3c7';
  minorTicks.forEach(value => {
    const px = xScale(value);
    ctx.beginPath();
    ctx.moveTo(px, margin.top);
    ctx.lineTo(px, margin.top + plotH);
    ctx.stroke();
  });

  ctx.strokeStyle = '#8f949a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  majorTicks.forEach(value => {
    const px = xScale(value);
    ctx.beginPath();
    ctx.moveTo(px, margin.top);
    ctx.lineTo(px, margin.top + plotH);
    ctx.stroke();
    ctx.fillText(String(value), px, margin.top + plotH + 12);
  });

  ctx.strokeStyle = colors.nbrGuide;
  ctx.fillStyle = colors.nbrGuide;
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.3;
  [
    { y: 15, x0: 1, x1: 4 },
    { y: 20, x0: 1, x1: 15 },
    { y: 50, x0: 1, x1: 40 },
    { x: 4, y0: 0, y1: 15 },
    { x: 15, y0: 0, y1: 20 },
    { x: 40, y0: 0, y1: 50 }
  ].forEach(item => {
    ctx.beginPath();
    if (item.y !== undefined) {
      ctx.moveTo(xScale(item.x0), yScale(item.y));
      ctx.lineTo(xScale(item.x1), yScale(item.y));
    } else {
      ctx.moveTo(xScale(item.x), yScale(item.y0));
      ctx.lineTo(xScale(item.x), yScale(item.y1));
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.font = '700 10px Aptos, Segoe UI, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('15', margin.left - 12, yScale(15));
  ctx.fillText('4', xScale(4), margin.top + plotH + 27);
  ctx.fillText('15', xScale(15), margin.top + plotH + 27);
  ctx.fillText('40', xScale(40), margin.top + plotH + 27);

  const limitCurve = [
    [4, 15],
    [15, 20],
    [40, 50],
    [1000, 50]
  ];
  ctx.strokeStyle = colors.nbrLine;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  limitCurve.forEach(([x, y], index) => {
    const px = xScale(x);
    const py = yScale(y);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  points.forEach((point, pointIndex) => {
    if (!Number.isFinite(point.freq) || !Number.isFinite(point.ppv)) return;
    const xJitter = points.length > 3 ? ((pointIndex % 3) - 1) * 3 : 0;
    const px = xScale(point.freq) + xJitter;
    const py = yScale(Math.max(yMin, Math.min(yMax, point.ppv)));
    drawNBRPoint(ctx, px, py, point.color, point.shape, 4.5);
  });

  ctx.strokeStyle = '#8f949a';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);

  ctx.fillStyle = '#6f7378';
  ctx.font = '11px Aptos, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Frequência (Hz)', margin.left + plotW / 2, height - 10);

  ctx.save();
  ctx.translate(15, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('PPV (mm/s)', 0, 0);
  ctx.restore();
}

function renderNBRCharts() {
  updateNBRStatus();
  drawNBRPressureChart(els.nbrPressureChart);
  drawNBRVibrationChart(els.nbrVibrationChart);
}

function buildNBRReportRows() {
  const rows = getNBRComplianceRows();
  return rows.flatMap(row => {
    const pressureStatus = row.pressureCompliant === null
      ? 'Não calculado'
      : row.pressureCompliant ? 'Conforme' : 'Acima do limite';

    const vibrationRows = row.channels.map(channel => {
      const status = channel.compliant === null
        ? 'Não calculado'
        : channel.compliant ? 'Conforme' : 'Acima do limite';
      return `
        <tr>
          <td>${escapeHtml(formatReportIntervalName(row.interval))}</td>
          <td>${escapeHtml(channel.label)}</td>
          <td>${fmt(channel.freq, 1)} Hz</td>
          <td>${fmt(channel.ppv, 3)} mm/s</td>
          <td>${fmt(channel.limit, 1)} mm/s</td>
          <td>${escapeHtml(status)}</td>
        </tr>
      `;
    }).join('');

    const pressureRow = `
      <tr>
        <td>${escapeHtml(formatReportIntervalName(row.interval))}</td>
        <td>Pressão sonora</td>
        <td>${Number.isFinite(row.distance) ? `${fmt(row.distance, 1)} m` : 'Distância ausente'}</td>
        <td>${fmt(row.pressureDb, 1)} dB(L)</td>
        <td>134,0 dB(L)</td>
        <td>${escapeHtml(pressureStatus)}</td>
      </tr>
    `;

    return pressureRow + vibrationRows;
  }).join('');
}

function renderCanvasDataURL(width, height, renderFn) {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  host.append(canvas);
  document.body.append(host);

  try {
    renderFn(canvas);
    return canvas.toDataURL('image/png');
  } finally {
    host.remove();
  }
}

function buildWaveformExportConfig(metric) {
  const exportMargin = { left: 54, right: 16, top: 28, bottom: 34 };

  if (metric === 'mic') {
    return {
      yLabel: 'Pressão acústica (Pa)',
      metric: 'mic',
      margin: exportMargin,
      ...getViewConfig(
        [{ data: state.data?.data.mic, color: colors.mic }],
        null
      )
    };
  }

  if (metric === 'tran') {
    return {
      yLabel: 'Tran (mm/s)',
      metric: 'tran',
      margin: exportMargin,
      ...getViewConfig(
        [{ data: state.data?.data.tran, color: colors.tran }],
        null
      )
    };
  }

  if (metric === 'vert') {
    return {
      yLabel: 'Vert (mm/s)',
      metric: 'vert',
      margin: exportMargin,
      ...getViewConfig(
        [{ data: state.data?.data.vert, color: colors.vert }],
        null
      )
    };
  }

  return {
    yLabel: 'Long (mm/s)',
    metric: 'long',
    margin: exportMargin,
    ...getViewConfig(
      [{ data: state.data?.data.long, color: colors.long }],
      null
    )
  };
}

function buildReportChartImages() {
  return {
    mic: renderCanvasDataURL(1280, 620, canvas => drawChart(canvas, buildWaveformExportConfig('mic'))),
    tran: renderCanvasDataURL(1280, 620, canvas => drawChart(canvas, buildWaveformExportConfig('tran'))),
    vert: renderCanvasDataURL(1280, 620, canvas => drawChart(canvas, buildWaveformExportConfig('vert'))),
    long: renderCanvasDataURL(1280, 620, canvas => drawChart(canvas, buildWaveformExportConfig('long'))),
    nbrPressure: renderCanvasDataURL(1180, 760, canvas => drawNBRPressureChart(canvas)),
    nbrVibration: renderCanvasDataURL(1180, 760, canvas => drawNBRVibrationChart(canvas))
  };
}

function getViewConfig(series, peak) {
  const { viewStart, viewEnd } = getWaveformViewRange();

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
  const margin = cfg.margin || WAVEFORM_MARGIN;
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

  drawSelectionOverlay(ctx, width, height, margin, viewStart, viewEnd, xScale, plotH);

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

function drawSelectionOverlay(ctx, width, height, margin, viewStart, viewEnd, xScale, plotH) {
  if (!state.chartSelection.active || state.exporting) return;

  const startTime = state.chartSelection.startTime;
  const hoverTime = Number.isFinite(state.chartSelection.hoverTime)
    ? state.chartSelection.hoverTime
    : startTime;

  if (!Number.isFinite(startTime) || !Number.isFinite(hoverTime)) return;

  const leftTime = Math.min(startTime, hoverTime);
  const rightTime = Math.max(startTime, hoverTime);
  const plotRight = width - margin.right;
  const left = Math.max(margin.left, Math.min(plotRight, xScale(leftTime)));
  const right = Math.max(margin.left, Math.min(plotRight, xScale(rightTime)));

  ctx.save();
  ctx.fillStyle = hexToRgba(colors.peak, 0.07);
  if (right > left) ctx.fillRect(left, margin.top, right - left, plotH);

  ctx.strokeStyle = colors.peak;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 5]);
  [startTime, hoverTime].forEach(time => {
    if (time < viewStart || time > viewEnd) return;
    const x = xScale(time);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotH);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  const label = `${fmtTime(leftTime)} → ${fmtTime(rightTime)}`;
  ctx.font = '700 10px Inter, system-ui, sans-serif';
  const labelWidth = ctx.measureText(label).width + 14;
  const labelX = Math.max(margin.left + 6, Math.min(plotRight - labelWidth - 6, left + 6));
  const labelY = margin.top + 8;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, labelX, labelY, labelWidth, 18, 9);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(colors.peak, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = colors.peak;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, labelX + 7, labelY + 9);
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
  syncWaveformViewportUI();

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

  renderNBRCharts();
}

function cancelChartSelection() {
  if (!state.chartSelection.active) return;
  clearChartSelection(false);
  updateIntervalHint();
  scheduleRender();
  showToast('Seleção de intervalo cancelada.');
}

function getWaveformInteraction(canvas) {
  if (!waveformInteractions.has(canvas)) {
    waveformInteractions.set(canvas, {
      pointerId: null,
      startX: 0,
      startY: 0,
      startViewport: null,
      dragging: false,
      suppressClick: false
    });
  }

  return waveformInteractions.get(canvas);
}

function bindInteractiveWaveformCharts() {
  INTERACTIVE_CHARTS.forEach(def => {
    const canvas = def.canvas();
    if (!canvas) return;

    const wrap = canvas.parentElement;
    if (wrap?.classList?.add) wrap.classList.add('interactive');
    canvas.dataset.metric = def.metric;
    canvas.title = 'Clique para marcar intervalos. Use a roda do mouse para dar zoom.';

    canvas.addEventListener('click', event => {
      const interaction = getWaveformInteraction(canvas);
      if (interaction.suppressClick) {
        interaction.suppressClick = false;
        return;
      }

      if (!state.data) return;
      const time = getWaveformTimeFromPointer(canvas, event);
      if (!Number.isFinite(time)) return;

      if (!state.chartSelection.active) {
        startChartSelection(def.metric, time);
        return;
      }

      completeChartSelection(time);
    });

    canvas.addEventListener('wheel', event => {
      if (!state.data) return;
      const time = getWaveformTimeFromPointer(canvas, event);
      if (!Number.isFinite(time)) return;

      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? WAVEFORM_ZOOM_STEP : 1 / WAVEFORM_ZOOM_STEP;
      zoomWaveformAt(time, zoomFactor, { silent: true });
    }, { passive: false });

    canvas.addEventListener('pointerdown', event => {
      if (!state.data || event.button !== 0 || state.chartSelection.active || !state.waveformViewport) return;

      const interaction = getWaveformInteraction(canvas);
      interaction.pointerId = event.pointerId;
      interaction.startX = event.clientX;
      interaction.startY = event.clientY;
      interaction.startViewport = { ...state.waveformViewport };
      interaction.dragging = false;
      interaction.suppressClick = false;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', event => {
      const interaction = getWaveformInteraction(canvas);
      if (interaction.pointerId === event.pointerId && interaction.startViewport && state.waveformViewport) {
        const dx = event.clientX - interaction.startX;
        const dy = event.clientY - interaction.startY;
        if (!interaction.dragging && Math.hypot(dx, dy) > 4) {
          interaction.dragging = true;
          wrap?.classList.add('panning');
        }

        if (interaction.dragging) {
          event.preventDefault();
          const bounds = getWaveformChartBounds(canvas);
          const span = Math.max(getWaveformMinSpan(), interaction.startViewport.end - interaction.startViewport.start);
          const deltaSeconds = -(dx / Math.max(1, bounds.plotWidth)) * span;
          const next = clampWaveformViewport(
            interaction.startViewport.start + deltaSeconds,
            interaction.startViewport.end + deltaSeconds
          );

          if (next) {
            state.waveformViewport = next;
            syncWaveformViewportUI();
            updateIntervalHint();
            scheduleRender();
          }

          interaction.suppressClick = true;
          return;
        }
      }

      if (!state.chartSelection.active) return;
      const time = getWaveformTimeFromPointer(canvas, event);
      if (!Number.isFinite(time)) return;
      updateChartSelectionHover(time);
    });

    canvas.addEventListener('pointerup', event => {
      const interaction = getWaveformInteraction(canvas);
      if (interaction.pointerId !== event.pointerId) return;

      if (interaction.dragging) {
        interaction.suppressClick = true;
      }

      interaction.pointerId = null;
      interaction.dragging = false;
      interaction.startViewport = null;
      wrap?.classList.remove('panning');

      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    });

    canvas.addEventListener('pointercancel', event => {
      const interaction = getWaveformInteraction(canvas);
      if (interaction.pointerId !== event.pointerId) return;

      interaction.pointerId = null;
      interaction.dragging = false;
      interaction.startViewport = null;
      interaction.suppressClick = false;
      wrap?.classList.remove('panning');

      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (!state.chartSelection.active || !Number.isFinite(state.chartSelection.startTime)) return;
      state.chartSelection.hoverTime = state.chartSelection.startTime;
      updateIntervalHint();
      scheduleRender();
    });
  });
}

async function loadTextAsCSV(text, fileName) {
  setStatus('Processando arquivo...');

  await new Promise(resolve => setTimeout(resolve, 20));
  const parsed = parseSismogramCSV(text, fileName);

  state.fileName = fileName;
  state.metadata = parsed.metadata;
  state.data = parsed;
  state.intervals = [];
  state.waveformViewport = null;
  clearChartSelection(false);
  state.activeStats = calculateFullStats();
  state.activeLabel = 'Registro completo';

  updateMetadata();
  updateOverviewCards();
  setStatus('Arquivo importado');
  showToast('Sismograma importado com sucesso.');
  refreshUI();

  if (state.fireHistory?.entries?.length) {
    applyAutoFireIntervals();
  }
}

async function loadTextAsHistory(text, fileName) {
  setStatus('Processando historial...');

  await new Promise(resolve => setTimeout(resolve, 20));
  const parsed = parseDrbHistory(text, fileName);

  state.fireHistory = parsed;
  setStatus('Historial importado');

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
      setStatus('Erro no arquivo');
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
      setStatus('Erro no historial');
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
      color: '#38424b',
      stats: full
    };
    return [fake];
  }

  return state.intervals;
}

function formatReportIntervalName(interval) {
  const name = String(interval?.name || '').trim();
  return name.replace(/^Produção\s+/i, '') || 'Intervalo sem nome';
}

function metadataReportRows() {
  if (!state.data) return [];
  const metadata = state.data.metadata;
  return [
    ['Arquivo', state.data.fileName],
    ['Data e hora do evento', `${getMetadataValue(metadata, 'EventDate') || '--'} ${getMetadataValue(metadata, 'EventTime') || ''}`.trim()],
    ['Local', getMetadataValue(metadata, 'TitleString1') || getMetadataValue(metadata, 'Location') || '--'],
    ['Série do equipamento', getMetadataValue(metadata, 'SerialNumber') || '--'],
    ['Taxa de amostragem', `${fmt(state.data.sampleRate, 0)} sps`],
    ['Duração do registro', `${fmt(state.data.duration, 3)} s`],
    ['Amostras processadas', state.data.data.time.length.toLocaleString('pt-BR')],
    ['Canais analisados', 'Mic/MicL, Tran, Vert, Long'],
    ['Histórico DRB', state.fireHistory?.entries?.length ? `${state.fireHistory.entries.length.toLocaleString('pt-BR')} eventos` : 'Não carregado']
  ];
}

function getReportOverview(rows) {
  const metadata = state.data?.metadata || {};
  const location = getMetadataValue(metadata, 'TitleString1') || getMetadataValue(metadata, 'Location') || '--';
  const eventDateTime = `${getMetadataValue(metadata, 'EventDate') || '--'} ${getMetadataValue(metadata, 'EventTime') || ''}`.trim();
  const serial = getMetadataValue(metadata, 'SerialNumber') || '--';
  const distance = getDistanceMeters();
  const nbrRows = getNBRComplianceRows();

  const highestPressureInterval = rows.reduce((best, interval) => {
    const currentValue = interval.stats?.mic?.abs ?? -Infinity;
    const bestValue = best?.stats?.mic?.abs ?? -Infinity;
    return currentValue > bestValue ? interval : best;
  }, null);

  const highestPVSInterval = rows.reduce((best, interval) => {
    const currentValue = interval.stats?.pvs?.value ?? -Infinity;
    const bestValue = best?.stats?.pvs?.value ?? -Infinity;
    return currentValue > bestValue ? interval : best;
  }, null);

  let totalChecks = 0;
  let exceededChecks = 0;
  const flaggedIntervals = new Set();

  nbrRows.forEach(row => {
    const pressureChecks = [row.pressureCompliant, ...row.channels.map(channel => channel.compliant)];
    pressureChecks.forEach(check => {
      if (check === null) return;
      totalChecks += 1;
      if (check === false) {
        exceededChecks += 1;
        flaggedIntervals.add(row.interval.name);
      }
    });
  });

  const highestPressureDb = paToDb(highestPressureInterval?.stats?.mic?.abs ?? NaN);
  const complianceLabel = exceededChecks
    ? `${exceededChecks} ${exceededChecks > 1 ? 'verificações' : 'verificação'} acima do limite`
    : totalChecks
      ? 'Verificações abaixo do limite'
      : 'Verificações pendentes';

  const complianceTone = exceededChecks ? 'alert' : totalChecks ? 'ok' : 'muted';

  const executiveNotes = [
    highestPressureInterval
      ? `Maior pressão acústica no intervalo ${formatReportIntervalName(highestPressureInterval)}: ${fmt(highestPressureInterval.stats.mic.abs, 3)} Pa (${fmt(highestPressureDb, 1)} dB(L)).`
      : 'Maior pressão acústica indisponível.',
    highestPVSInterval
      ? `Maior PVS no intervalo ${formatReportIntervalName(highestPVSInterval)}: ${fmt(highestPVSInterval.stats.pvs.value, 3)} mm/s, com pico em ${fmtTime(highestPVSInterval.stats.pvs.time)}.`
      : 'Maior PVS indisponível.',
    totalChecks
      ? exceededChecks
        ? `Na leitura normativa da ABNT NBR 9653:2018, ${flaggedIntervals.size.toLocaleString('pt-BR')} intervalo${flaggedIntervals.size > 1 ? 's apresentaram' : ' apresentou'} ao menos um ponto acima do limite.`
        : 'Na leitura normativa da ABNT NBR 9653:2018, todas as verificações calculadas permaneceram abaixo dos limites aplicáveis.'
      : 'A leitura normativa depende da distância do ponto e dos dados de frequência disponíveis no registro.'
  ];

  return {
    location,
    eventDateTime,
    serial,
    distanceLabel: Number.isFinite(distance) ? `${fmt(distance, 1)} m` : 'Não identificada',
    intervalsLabel: rows.length.toLocaleString('pt-BR'),
    sampleCountLabel: state.data?.data?.time?.length.toLocaleString('pt-BR') || '--',
    drbLabel: state.fireHistory?.entries?.length ? state.fireHistory.entries.length.toLocaleString('pt-BR') : '0',
    highestPressureInterval,
    highestPVSInterval,
    highestPressureDb,
    totalChecks,
    exceededChecks,
    complianceLabel,
    complianceTone,
    executiveNotes
  };
}

function buildLegacyReportHTML() {
  if (!state.data) return '';

  const rows = reportRows();
  const metaRows = metadataReportRows();
  const overview = getReportOverview(rows);
  const cards = [
    ['Local monitorado', overview.location],
    ['Evento', overview.eventDateTime],
    ['Distância escalada', overview.distanceLabel],
    ['Intervalos avaliados', overview.intervalsLabel],
    ['Taxa de amostragem', `${fmt(state.data.sampleRate, 0)} sps`],
    ['Duração do registro', `${fmt(state.data.duration, 3)} s`]
  ];

  const previousExporting = state.exporting;
  state.exporting = true;

  let chartImages;
  try {
    render();
    chartImages = buildReportChartImages();
  } finally {
    state.exporting = previousExporting;
    render();
  }

  const metaTable = metaRows.map(([key, value]) => `
    <tr>
      <td><strong>${escapeHtml(key)}</strong></td>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const nbrReportRows = buildNBRReportRows();

  const intervalRows = rows.map(interval => {
    const s = interval.stats;
    const micDb = paToDb(s.mic.abs);
    return `
      <tr>
        <td><span class="report-color" style="background:${interval.color}"></span>${escapeHtml(formatReportIntervalName(interval))}</td>
        <td>${fmtTime(interval.start)}</td>
        <td>${fmtTime(interval.end)}</td>
        <td>${fmt(s.mic.abs, 3)} Pa<br>${fmt(micDb, 1)} dB(L)</td>
        <td>${fmt(s.tran.abs, 3)} mm/s<br><span>${fmtTime(s.tran.time)}</span></td>
        <td>${fmt(s.vert.abs, 3)} mm/s<br><span>${fmtTime(s.vert.time)}</span></td>
        <td>${fmt(s.long.abs, 3)} mm/s<br><span>${fmtTime(s.long.time)}</span></td>
        <td>${fmt(s.pvs.value, 3)} mm/s<br><span>${fmtTime(s.pvs.time)}</span></td>
      </tr>
    `;
  }).join('');

  const executiveNotes = overview.executiveNotes.map(note => `
    <li>${escapeHtml(note)}</li>
  `).join('');

  return `
    <div class="report-page report-cover">
      <div class="report-cover-top">
        <img class="report-logo" src="VISUAL/LOGO OPENBLAST TRANSPARENTE.png" alt="OpenBlast" />
        <div class="report-docline">
          <div>
            <span>Documento</span>
            <strong>Relatório técnico</strong>
          </div>
          <div>
            <span>Evento</span>
            <strong>${escapeHtml(overview.eventDateTime || '--')}</strong>
          </div>
        </div>
      </div>

      <div class="report-hero">
        <div class="report-hero-copy">
          <p class="report-kicker">Análise técnica de sismograma</p>
          <h1 class="report-title">Pressão acústica e vibração por evento monitorado</h1>
          <p class="report-subtitle">
            Síntese executiva do registro importado, com leitura consolidada de picos, comparação entre intervalos
            e verificação normativa frente à ABNT NBR 9653:2018.
          </p>
        </div>

        <div class="report-status-card ${overview.complianceTone}">
          <span>Situação normativa</span>
          <strong>${escapeHtml(overview.complianceLabel)}</strong>
          <small>${escapeHtml(overview.location)}</small>
        </div>
      </div>

      <div class="report-grid">
        ${cards.map(([label, value]) => `
          <div class="report-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join('')}
      </div>

      <div class="report-insight-grid">
        <section class="report-panel">
          <div class="report-panel-heading">
            <span>Leitura executiva</span>
            <strong>Principais mensagens</strong>
          </div>
          <ul class="report-note-list">
            ${executiveNotes}
          </ul>
        </section>

        <section class="report-panel">
          <div class="report-panel-heading">
            <span>Escopo</span>
            <strong>Base analítica</strong>
          </div>
          <div class="report-mini-metrics">
            <div>
              <span>Amostras</span>
              <strong>${escapeHtml(overview.sampleCountLabel)}</strong>
            </div>
            <div>
              <span>Eventos DRB</span>
              <strong>${escapeHtml(overview.drbLabel)}</strong>
            </div>
            <div>
              <span>Equipamento</span>
              <strong>${escapeHtml(overview.serial)}</strong>
            </div>
            <div>
              <span>Arquivo</span>
              <strong>${escapeHtml(state.data.fileName)}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div class="report-page">
      <div class="report-columns">
        <section class="report-panel">
          <div class="report-panel-heading">
            <span>Rastreabilidade</span>
            <strong>Base do registro</strong>
          </div>
          <table class="report-table report-table-compact">
            <tbody>${metaTable}</tbody>
          </table>
        </section>

        <section class="report-panel">
          <div class="report-panel-heading">
            <span>Leitura consolidada</span>
            <strong>Indicadores-chave</strong>
          </div>
          <div class="report-summary-stack">
            <div class="report-summary-item">
              <span>Maior pressão acústica</span>
              <strong>${fmt(overview.highestPressureInterval?.stats?.mic?.abs ?? NaN, 3)} Pa</strong>
              <small>${escapeHtml(overview.highestPressureInterval ? formatReportIntervalName(overview.highestPressureInterval) : '--')} · ${fmt(overview.highestPressureDb, 1)} dB(L)</small>
            </div>
            <div class="report-summary-item">
              <span>Maior PVS</span>
              <strong>${fmt(overview.highestPVSInterval?.stats?.pvs?.value ?? NaN, 3)} mm/s</strong>
              <small>${escapeHtml(overview.highestPVSInterval ? formatReportIntervalName(overview.highestPVSInterval) : '--')} · ${fmtTime(overview.highestPVSInterval?.stats?.pvs?.time ?? NaN)}</small>
            </div>
            <div class="report-summary-item">
              <span>Checagens normativas</span>
              <strong>${escapeHtml(String(overview.totalChecks))}</strong>
              <small>${escapeHtml(overview.complianceLabel)}</small>
            </div>
          </div>
        </section>
      </div>

      <section class="report-panel report-panel-spaced">
        <div class="report-panel-heading">
          <span>Resultados</span>
          <strong>Resumo por intervalo</strong>
        </div>
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
      </section>
    </div>

    <div class="report-page">
      <div class="report-panel-heading report-section-heading">
        <span>Conformidade</span>
        <strong>ABNT NBR 9653:2018</strong>
      </div>
      <div class="report-nbr-grid">
        <div class="report-chart report-chart-tight">
          <h3>Pressão Sonora em Eventos Sismográficos</h3>
          <img src="${chartImages.nbrPressure}" alt="Gráfico de pressão sonora ABNT NBR 9653" />
        </div>
        <div class="report-chart report-chart-tight">
          <h3>Vibração em Eventos Sismográficos</h3>
          <img src="${chartImages.nbrVibration}" alt="Gráfico de vibração ABNT NBR 9653" />
        </div>
      </div>
      <div class="report-nbr-legend-grid">
        <div class="report-nbr-legend-card">
          <h3>Pressão sonora</h3>
          <div class="report-nbr-legend-list">
            <div class="report-nbr-legend-item">
              <span class="report-nbr-legend-swatch report-nbr-legend-line"></span>
              <span>Limite 134 dB(L)</span>
            </div>
            <div class="report-nbr-legend-item">
              <span class="report-nbr-legend-swatch report-nbr-legend-point"></span>
              <span>Pico medido</span>
            </div>
          </div>
        </div>
        <div class="report-nbr-legend-card">
          <h3>Vibração</h3>
          <div class="report-nbr-legend-list">
            <div class="report-nbr-legend-item">
              <span class="report-nbr-legend-swatch report-nbr-legend-square"></span>
              <span>Transversal</span>
            </div>
            <div class="report-nbr-legend-item">
              <span class="report-nbr-legend-swatch report-nbr-legend-diamond"></span>
              <span>Longitudinal</span>
            </div>
            <div class="report-nbr-legend-item">
              <span class="report-nbr-legend-swatch report-nbr-legend-triangle"></span>
              <span>Vertical</span>
            </div>
            <div class="report-nbr-legend-item">
              <span class="report-nbr-legend-swatch report-nbr-legend-line"></span>
              <span>Curva limite</span>
            </div>
          </div>
        </div>
      </div>
      <table class="report-table report-nbr-table">
        <thead>
          <tr>
            <th>Intervalo</th>
            <th>Indicador</th>
            <th>Frequência/Distância</th>
            <th>Valor medido</th>
            <th>Limite</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${nbrReportRows}</tbody>
      </table>
    </div>

    <div class="report-page report-waveform-page">
      <div class="report-panel-heading report-section-heading">
        <span>Waveforms</span>
        <strong>Leitura gráfica de referência</strong>
      </div>
      <div class="report-waveform-grid">
        <div class="report-chart report-waveform-chart">
        <h3>Pressão acústica · Pa</h3>
        <img src="${chartImages.mic}" alt="Waveform da pressão acústica" />
        </div>
        <div class="report-chart report-waveform-chart">
        <h3>Vibração transversal · Tran</h3>
        <img src="${chartImages.tran}" alt="Waveform de vibração transversal" />
        </div>
        <div class="report-chart report-waveform-chart">
        <h3>Vibração vertical · Vert</h3>
        <img src="${chartImages.vert}" alt="Waveform de vibração vertical" />
        </div>
        <div class="report-chart report-waveform-chart">
        <h3>Vibração longitudinal · Long</h3>
        <img src="${chartImages.long}" alt="Waveform de vibração longitudinal" />
        </div>
      </div>
    </div>

  `;
}

function buildReportHTML() {
  if (!state.data) return '';

  const rows = reportRows();
  const overview = getReportOverview(rows);
  const nbrRows = getNBRComplianceRows();
  const previousExporting = state.exporting;
  state.exporting = true;

  let chartImages;
  try {
    render();
    chartImages = buildReportChartImages();
  } finally {
    state.exporting = previousExporting;
    render();
  }

  const statusMeta = compliant => {
    if (compliant === true) return { label: 'Conforme', className: 'ok' };
    if (compliant === false) return { label: 'Acima do limite', className: 'alert' };
    return { label: 'Pendente', className: 'pending' };
  };

  const banner = overview.exceededChecks
    ? { label: 'ATENÇÃO', description: overview.complianceLabel, tone: 'alert' }
    : overview.totalChecks
      ? { label: 'CONFORME', description: `${overview.totalChecks}/${overview.totalChecks} verificações abaixo dos limites`, tone: 'ok' }
      : { label: 'PENDENTE', description: 'Dados insuficientes para concluir a verificação', tone: 'muted' };

  const decisionRows = nbrRows.flatMap(row => {
    const interval = formatReportIntervalName(row.interval);
    const records = [
      {
        interval,
        indicator: 'Pressão sonora',
        measured: `${fmt(row.pressureDb, 1)} dB(L)`,
        limit: '134,0 dB(L)',
        compliant: row.pressureCompliant
      },
      ...row.channels.map(channel => ({
        interval,
        indicator: channel.label,
        measured: `${fmt(channel.ppv, 3)} mm/s`,
        limit: `${fmt(channel.limit, 1)} mm/s`,
        compliant: channel.compliant
      }))
    ];

    return records.map(record => {
      const status = statusMeta(record.compliant);
      return `
        <tr>
          <td>${escapeHtml(record.interval)}</td>
          <td><strong>${escapeHtml(record.indicator)}</strong></td>
          <td>${escapeHtml(record.measured)}</td>
          <td>${escapeHtml(record.limit)}</td>
          <td><span class="report-status ${status.className}">${escapeHtml(status.label)}</span></td>
        </tr>
      `;
    });
  }).join('');

  const normativeRows = buildNBRReportRows().replace(/<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/g,
    '<td>$2</td><td>$3</td><td>$4</td><td>$5</td><td>$6</td>');

  const eventDate = getMetadataValue(state.data.metadata, 'EventDate') || '--';
  const eventTime = getMetadataValue(state.data.metadata, 'EventTime') || '--';
  const serial = getMetadataValue(state.data.metadata, 'SerialNumber') || '--';
  const sourceFile = state.data.fileName || '--';

  return `
    <div class="report-page report-executive-page">
      <header class="report-header">
        <div class="report-brand">
          <img src="VISUAL/LOGO OPENBLAST TRANSPARENTE.png" alt="OpenBlast" />
          <div><span>Monitoramento sismográfico</span><strong>Relatório de evento</strong></div>
        </div>
        <div class="report-header-code">ABNT NBR 9653:2018</div>
      </header>

      <div class="report-title-row">
        <div>
          <p class="report-eyebrow">Resumo executivo</p>
          <h1>${escapeHtml(overview.location)}</h1>
          <p class="report-subtitle">${escapeHtml(eventDate)} · ${escapeHtml(eventTime)} · Equipamento ${escapeHtml(serial)}</p>
        </div>
        <div class="report-distance"><span>Distância monitorada</span><strong>${escapeHtml(overview.distanceLabel)}</strong></div>
      </div>

      <section class="report-status-banner ${banner.tone}">
        <div class="report-status-mark">${escapeHtml(banner.label)}</div>
        <div><strong>${escapeHtml(banner.description)}</strong><span>Resultado da verificação normativa do evento</span></div>
      </section>

      <section class="report-kpi-grid">
        <article class="report-kpi">
          <span>Pressão sonora máxima</span>
          <strong>${fmt(overview.highestPressureDb, 1)} <small>dB(L)</small></strong>
          <em>${escapeHtml(overview.highestPressureInterval ? formatReportIntervalName(overview.highestPressureInterval) : '--')}</em>
        </article>
        <article class="report-kpi">
          <span>PVS máximo</span>
          <strong>${fmt(overview.highestPVSInterval?.stats?.pvs?.value ?? NaN, 3)} <small>mm/s</small></strong>
          <em>${escapeHtml(overview.highestPVSInterval ? formatReportIntervalName(overview.highestPVSInterval) : '--')}</em>
        </article>
        <article class="report-kpi">
          <span>Intervalos avaliados</span>
          <strong>${escapeHtml(overview.intervalsLabel)}</strong>
          <em>Registro analisado</em>
        </article>
        <article class="report-kpi">
          <span>Taxa de amostragem</span>
          <strong>${fmt(state.data.sampleRate, 0)} <small>sps</small></strong>
          <em>${fmt(state.data.duration, 3)} s de duração</em>
        </article>
      </section>

      <section class="report-decision-panel">
        <div class="report-section-head"><div><p>Decisão técnica</p><h2>Medido × limite aplicável</h2></div><span>Valores de pico</span></div>
        <table class="report-table report-decision-table">
          <thead><tr><th>Intervalo</th><th>Indicador</th><th>Medido</th><th>Limite</th><th>Status</th></tr></thead>
          <tbody>${decisionRows || '<tr><td colspan="5">Nenhuma verificação calculada.</td></tr>'}</tbody>
        </table>
      </section>

      <p class="report-callout ${banner.tone}">${overview.exceededChecks ? 'O evento requer atenção: há pelo menos um indicador acima do limite aplicável.' : overview.totalChecks ? 'Evento conforme à ABNT NBR 9653:2018; todas as verificações calculadas permaneceram abaixo dos limites aplicáveis.' : 'A conclusão normativa depende de dados complementares do registro.'}</p>

      <footer class="report-footer">
        <span>Arquivo: ${escapeHtml(sourceFile)}</span>
        <span>Duração: ${fmt(state.data.duration, 3)} s</span>
        <span>Norma: ABNT NBR 9653:2018</span>
      </footer>
    </div>

    <div class="report-page report-technical-page">
      <header class="report-page-head"><div><p class="report-eyebrow">Verificação normativa</p><h2>Conformidade por evento</h2></div><span>${escapeHtml(overview.complianceLabel)}</span></header>
      <div class="report-technical-grid">
        <figure class="report-chart report-technical-card"><figcaption><span>Pressão sonora</span><strong>Pressão × distância</strong></figcaption><img src="${chartImages.nbrPressure}" alt="Gráfico de pressão sonora segundo a ABNT NBR 9653" /></figure>
        <figure class="report-chart report-technical-card"><figcaption><span>Vibração</span><strong>PPV × frequência</strong></figcaption><img src="${chartImages.nbrVibration}" alt="Gráfico de vibração segundo a ABNT NBR 9653" /></figure>
      </div>
      <section class="report-decision-panel report-normative-panel">
        <div class="report-section-head"><div><p>Rastreabilidade objetiva</p><h2>Leituras utilizadas na decisão</h2></div><span>ABNT NBR 9653:2018</span></div>
        <table class="report-table report-normative-table">
          <thead><tr><th>Indicador</th><th>Frequência / distância</th><th>Medido</th><th>Limite</th><th>Status</th></tr></thead>
          <tbody>${normativeRows || '<tr><td colspan="5">Nenhuma leitura normativa disponível.</td></tr>'}</tbody>
        </table>
      </section>
      <footer class="report-footer"><span>Equipamento: ${escapeHtml(serial)}</span><span>Local: ${escapeHtml(overview.location)}</span><span>Arquivo: ${escapeHtml(sourceFile)}</span></footer>
    </div>

    <div class="report-page report-waveform-page">
      <header class="report-page-head"><div><p class="report-eyebrow">Anexo técnico</p><h2>Waveforms do registro</h2></div><span>Leitura gráfica de referência</span></header>
      <div class="report-waveform-grid report-waveform-grid-compact">
        <figure class="report-chart report-waveform-chart"><figcaption><span>Canal 01</span><strong>Pressão acústica · Pa</strong></figcaption><img src="${chartImages.mic}" alt="Waveform da pressão acústica" /></figure>
        <figure class="report-chart report-waveform-chart"><figcaption><span>Canal 02</span><strong>Vibração transversal · Tran</strong></figcaption><img src="${chartImages.tran}" alt="Waveform da vibração transversal" /></figure>
        <figure class="report-chart report-waveform-chart"><figcaption><span>Canal 03</span><strong>Vibração vertical · Vert</strong></figcaption><img src="${chartImages.vert}" alt="Waveform da vibração vertical" /></figure>
        <figure class="report-chart report-waveform-chart"><figcaption><span>Canal 04</span><strong>Vibração longitudinal · Long</strong></figcaption><img src="${chartImages.long}" alt="Waveform da vibração longitudinal" /></figure>
      </div>
      <footer class="report-footer"><span>Registro completo: ${fmt(state.data.data.time.length, 0)} amostras</span><span>Taxa: ${fmt(state.data.sampleRate, 0)} sps</span><span>Tempo total: ${fmt(state.data.duration, 3)} s</span></footer>
    </div>
  `;
}

function buildPdfFileName() {
  const rawName = state.data?.fileName || 'relatorio-sismograma';
  const base = rawName.replace(/\.[^.]+$/, '');
  const safe = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe || 'relatorio-sismograma'}.pdf`;
}

async function exportReportPDF() {
  if (!state.data) {
    showToast('Importe um arquivo antes de exportar o relatório.');
    return;
  }

  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    showToast('Biblioteca de exportação PDF não carregada.');
    return;
  }

  const previousLabel = els.exportPdfBtn.textContent;
  els.exportPdfBtn.disabled = true;
  els.exportPdfBtn.textContent = 'Gerando PDF...';
  els.printReport.innerHTML = buildReportHTML();
  els.printReport.classList.add('pdf-render-active');

  try {
    await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

    const reportPages = Array.from(els.printReport.querySelectorAll('.report-page'));
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    for (let index = 0; index < reportPages.length; index++) {
      const pageNode = reportPages[index];
      const canvas = await window.html2canvas(pageNode, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const image = canvas.toDataURL('image/jpeg', 0.98);
      if (index > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(image, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    pdf.save(buildPdfFileName());
    showToast('PDF gerado com sucesso.');
  } catch (error) {
    console.error(error);
    showToast('Falha ao gerar o PDF.');
  } finally {
    els.printReport.classList.remove('pdf-render-active');
    els.printReport.innerHTML = '';
    els.exportPdfBtn.disabled = false;
    els.exportPdfBtn.textContent = previousLabel;
  }
}

els.fileInput.addEventListener('change', event => readFile(event.target.files[0]));
els.drbFile.addEventListener('change', event => readHistoryFile(event.target.files[0]));
els.applyIntervalBtn.addEventListener('click', addInterval);
els.clearIntervalBtn.addEventListener('click', () => clearIntervalFields(true));
els.clearAllIntervalsBtn.addEventListener('click', clearAllIntervals);
els.clearHistoryBtn.addEventListener('click', () => {
  state.fireHistory = null;
  clearChartSelection(false);
  if (state.data) {
    state.intervals = state.intervals.filter(interval => interval.source !== 'drb');
    state.activeStats = state.intervals.length ? state.intervals[state.intervals.length - 1].stats : calculateFullStats();
    state.activeLabel = state.intervals.length ? state.intervals[state.intervals.length - 1].name : 'Registro completo';
    updateOverviewCards();
    refreshUI();
  } else {
    refreshUI();
  }
  setStatus('Historial removido');
  showToast('Historial DRB removido.');
});
els.waveformZoomInBtn.addEventListener('click', () => {
  if (!state.data) return;
  const { viewStart, viewEnd } = getWaveformViewRange();
  zoomWaveformAt((viewStart + viewEnd) / 2, WAVEFORM_ZOOM_STEP, {
    toast: 'Zoom aproximado aplicado.'
  });
});
els.waveformZoomOutBtn.addEventListener('click', () => {
  if (!state.data) return;
  const { viewStart, viewEnd } = getWaveformViewRange();
  zoomWaveformAt((viewStart + viewEnd) / 2, 1 / WAVEFORM_ZOOM_STEP, {
    toast: 'Zoom afastado.'
  });
});
els.waveformResetBtn.addEventListener('click', () => {
  resetWaveformViewport({ toast: 'Visão completa restaurada.' });
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
    setStatus('Carregando exemplo...');
    const response = await fetch('sample/20260602-COMUNIDADE-DE-CORREDOR-UM16385.IDFW.CSV');
    if (!response.ok) throw new Error('Não foi possível carregar o exemplo. Rode por um servidor local ou pelo GitHub Pages.');
    const text = await response.text();
    await loadTextAsCSV(text, '20260602-COMUNIDADE-DE-CORREDOR-UM16385.IDFW.CSV');
  } catch (error) {
    setStatus('Aguardando arquivo');
    showToast(error.message);
  }
});

window.addEventListener('resize', () => {
  window.clearTimeout(render.resizeTimer);
  render.resizeTimer = window.setTimeout(render, 120);
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') cancelChartSelection();
  if (event.ctrlKey && event.key === '0') {
    event.preventDefault();
    resetWaveformViewport({ silent: false, toast: 'Visão completa restaurada.' });
  }
});

bindInteractiveWaveformCharts();
updateIntervalSummaryTable();
render();
updateIntervalHint();
