/*
 * Чистая логика GEO Factory: расчёты, разбор CSV, рендер Markdown.
 * Без обращения к DOM — поэтому файл одинаково работает в браузере и в node-тестах.
 */
(function (root) {
  'use strict';

  // ---------- форматирование ----------

  function fmt(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var d = digits || 0;
    var parts = Number(n).toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  }

  function fmtMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e6) return fmt(n / 1e6, abs >= 1e7 ? 1 : 2) + ' млн ₽';
    if (abs >= 1e3) return fmt(n / 1e3, 0) + ' тыс. ₽';
    return fmt(n, 0) + ' ₽';
  }

  function today() {
    var d = new Date();
    var p = function (x) { return String(x).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- спрос ----------

  function toInt(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/[\s ]/g, '');
    if (!/^\d+$/.test(s)) return null;
    return parseInt(s, 10);
  }

  /** Накладывает введённые или загруженные частоты поверх демо-оценки. Исходные данные не меняет. */
  function applyOverrides(clusters, overrides) {
    var out = {};
    overrides = overrides || {};
    Object.keys(clusters).forEach(function (key) {
      var c = clusters[key];
      var copy = Object.assign({}, c);
      copy.keywords = c.keywords.map(function (k) {
        var kw = Object.assign({}, k);
        var o = overrides[k.phrase.trim().toLowerCase()];
        if (o) {
          var chel = toInt(o.chel), urfo = toInt(o.urfo);
          if (chel !== null) kw.frequency_chelyabinsk = chel;
          if (urfo !== null) kw.frequency_urfo = urfo;
          if (chel !== null && urfo !== null) kw.source = 'real';
          else if (chel !== null || urfo !== null) kw.source = 'partial';
          if (chel !== null || urfo !== null) kw.checked_date = o.date || kw.checked_date || '';
        }
        if (!kw.source) kw.source = 'demo';
        if (kw.anchor === undefined) kw.anchor = true;
        return kw;
      });
      // Итог кластера — только по якорным запросам: остальные входят в них по широкому соответствию.
      copy.total_cluster_traffic = copy.keywords.reduce(function (s, k) { return s + (k.anchor ? k.frequency_urfo : 0); }, 0);
      copy.total_cluster_traffic_chelyabinsk = copy.keywords.reduce(function (s, k) { return s + (k.anchor ? k.frequency_chelyabinsk : 0); }, 0);
      out[key] = copy;
    });
    return out;
  }

  function summarize(clusters) {
    var total = 0, real = 0, partial = 0, chel = 0, urfo = 0;
    Object.keys(clusters).forEach(function (key) {
      clusters[key].keywords.forEach(function (k) {
        total++;
        if (k.source === 'real') real++;
        if (k.source === 'partial') partial++;
        if (k.anchor !== false) { chel += k.frequency_chelyabinsk; urfo += k.frequency_urfo; }
      });
    });
    var status = real === total && total > 0 ? 'real' : (real + partial > 0 ? 'partial' : 'demo');
    return { total: total, real: real, partial: partial, chelyabinsk: chel, urfo: urfo, status: status };
  }

  var STAGES = { buy: 'покупка', calc: 'расчёт', brand: 'бренд', info: 'справка', early: 'раннее намерение' };

  var SCOPES = {
    chel_buy: { label: 'Челябинская область: покупка и цена', region: 'chel', stages: ['buy'] },
    chel_buy_calc: { label: 'Челябинская область: покупка, цена и расчёт количества', region: 'chel', stages: ['buy', 'calc'] },
    chel_all: { label: 'Челябинская область: все кластеры', region: 'chel', stages: null },
    urfo_buy: { label: 'Урал: покупка и цена', region: 'urfo', stages: ['buy'] },
    urfo_buy_calc: { label: 'Урал: покупка, цена и расчёт количества', region: 'urfo', stages: ['buy', 'calc'] },
    urfo_all: { label: 'Урал: все кластеры', region: 'urfo', stages: null }
  };

  function demandForScope(clusters, scope) {
    var s = SCOPES[scope] || SCOPES.chel_buy_calc;
    var sum = 0;
    Object.keys(clusters).forEach(function (key) {
      var c = clusters[key];
      if (s.stages && s.stages.indexOf(c.stage) < 0) return;
      sum += s.region === 'chel' ? c.total_cluster_traffic_chelyabinsk : c.total_cluster_traffic;
    });
    return sum;
  }

  // ---------- CSV с частотами ----------

  function splitCsvLine(line, delim) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  /** Разбирает CSV шаблона: phrase; frequency_chelyabinsk; frequency_urfo; checked_date. */
  function parseWordstatCsv(text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return { rows: {}, count: 0, error: 'Файл пустой.' };
    var head = lines[0];
    var delim = [';', '\t', ','].sort(function (a, b) { return head.split(b).length - head.split(a).length; })[0];
    var cols = splitCsvLine(head, delim).map(function (c) { return c.trim().toLowerCase(); });
    var find = function (re) { for (var i = 0; i < cols.length; i++) if (re.test(cols[i])) return i; return -1; };
    var iPhrase = find(/phrase|фраза|запрос/), iChel = find(/chel|челяб/), iUrfo = find(/urfo|урфо/), iDate = find(/date|дата/);
    if (iPhrase < 0 || (iChel < 0 && iUrfo < 0)) {
      return { rows: {}, count: 0, error: 'Не найдены колонки. Нужны: phrase, frequency_chelyabinsk, frequency_urfo.' };
    }
    var rows = {}, count = 0;
    for (var n = 1; n < lines.length; n++) {
      var cells = splitCsvLine(lines[n], delim);
      var phrase = (cells[iPhrase] || '').trim().toLowerCase();
      if (!phrase) continue;
      var chel = iChel >= 0 ? toInt(cells[iChel]) : null;
      var urfo = iUrfo >= 0 ? toInt(cells[iUrfo]) : null;
      if (chel === null && urfo === null) continue;
      rows[phrase] = { chel: chel, urfo: urfo, date: iDate >= 0 ? (cells[iDate] || '').trim() : '' };
      count++;
    }
    return { rows: rows, count: count, error: count ? null : 'В файле нет строк с частотами.' };
  }

  function buildTemplateCsv(clusters) {
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var lines = ['phrase;frequency_chelyabinsk;frequency_urfo;checked_date;cluster'];
    Object.keys(clusters).forEach(function (key) {
      clusters[key].keywords.forEach(function (k) {
        var real = k.source === 'real' || k.source === 'partial';
        lines.push([q(k.phrase), real ? k.frequency_chelyabinsk : '', real ? k.frequency_urfo : '', real ? (k.checked_date || '') : '', q(clusters[key].title)].join(';'));
      });
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  // ---------- экономика ----------

  var SCENARIOS = {
    pessimistic: { label: 'Осторожный', ctr_target: 6, visit_to_lead: 1, lead_to_deal: 10, unique_share: 40 },
    base: { label: 'Базовый', ctr_target: 12, visit_to_lead: 2, lead_to_deal: 20, unique_share: 60 },
    optimistic: { label: 'Сильный', ctr_target: 20, visit_to_lead: 3, lead_to_deal: 30, unique_share: 75 }
  };

  /**
   * Воронка «от спроса к деньгам» через переходы на материалы завода.
   * Все проценты передаются числами (12 = 12%).
   */
  function calcFunnel(p) {
    var num = function (v) { var x = parseFloat(v); return isFinite(x) ? x : 0; };
    var demand = num(p.demand) * num(p.unique_share === undefined ? 100 : p.unique_share) / 100;
    var ctrNow = num(p.ctr_now), ctrTarget = Math.max(num(p.ctr_target), ctrNow);
    var visitsNow = demand * ctrNow / 100;
    var visitsTarget = demand * ctrTarget / 100;
    var extraVisits = visitsTarget - visitsNow;
    var leads = extraVisits * num(p.visit_to_lead) / 100;
    var deals = leads * num(p.lead_to_deal) / 100;
    var m3 = deals * num(p.m3_per_deal);
    var revenue = m3 * num(p.price_per_m3);
    var margin = revenue * num(p.margin) / 100;
    var months = Math.min(12, Math.max(0, num(p.season_months)));
    var shipment = num(p.annual_shipment_m3);
    var cost = num(p.content_cost);
    // Порог окупаемости: сколько отгрузок возвращают затраты. Зависит только от цены, маржи и размера заказа.
    var marginPerM3 = num(p.price_per_m3) * num(p.margin) / 100;
    var marginPerDeal = marginPerM3 * num(p.m3_per_deal);
    var beDeals = marginPerDeal > 0 && cost > 0 ? cost / marginPerDeal : null;
    var leadToDeal = num(p.lead_to_deal) / 100, visitToLead = num(p.visit_to_lead) / 100;
    var beLeads = beDeals !== null && leadToDeal > 0 ? beDeals / leadToDeal : null;
    var beVisits = beLeads !== null && visitToLead > 0 ? beLeads / visitToLead : null;
    return {
      margin_per_m3: marginPerM3,
      margin_per_deal: marginPerDeal,
      breakeven_deals: beDeals,
      breakeven_m3: marginPerM3 > 0 && cost > 0 ? cost / marginPerM3 : null,
      breakeven_leads: beLeads,
      breakeven_visits: beVisits,
      season_deals: deals * months,
      demand: demand,
      visits_now: visitsNow,
      visits_target: visitsTarget,
      extra_visits: extraVisits,
      leads: leads,
      deals: deals,
      m3: m3,
      revenue: revenue,
      margin: margin,
      year_m3: m3 * months,
      year_revenue: revenue * months,
      year_margin: margin * months,
      payback_months: margin > 0 && cost > 0 ? cost / margin : null,
      share_of_shipment: shipment > 0 ? (m3 * months) / shipment * 100 : null
    };
  }

  // Затраты пилота: деньги наружу плюс рабочее время сотрудников.
  function pilotCost(p) {
    var num = function (v) { var x = parseFloat(v); return isFinite(x) && x > 0 ? x : 0; };
    return num(p.cost_cash) + num(p.cost_hours) * num(p.cost_rate);
  }

  // ---------- журнал замеров выдачи ----------

  function serpStats(queries, log) {
    var st = { total: queries.length, measured: 0, top3: 0, top10: 0, top12: 0, out: 0, neuro_cited: 0, neuro_checked: 0 };
    queries.forEach(function (q) {
      var e = (log || {})[q.query];
      if (!e) return;
      if (e.pos) {
        st.measured++;
        if (e.pos === 'out') st.out++;
        else {
          var n = parseInt(e.pos, 10);
          if (n <= 12) st.top12++;
          if (n <= 10) st.top10++;
          if (n <= 3) st.top3++;
        }
      }
      if (e.neuro && e.neuro !== '') {
        st.neuro_checked++;
        if (e.neuro === 'cited') st.neuro_cited++;
      }
    });
    return st;
  }

  // ---------- обоснование материалов: пороги успеха и провала ----------

  function isTop12(pos) {
    var n = parseInt(pos, 10);
    return !isNaN(n) && n <= 12;
  }

  // Та же логика, что в src/rationale.py (evaluate). log: {запрос: {pos, neuro}}.
  function rationaleVerdict(rule, log) {
    var primary = rule.primary, aiQ = rule.ai_queries || primary;
    log = log || {};
    var measured = primary.filter(function (q) { var e = log[q]; return e && e.pos !== undefined && e.pos !== null && e.pos !== ''; }).length;
    if (measured < primary.length) return { state: 'incomplete', measured: measured, of: primary.length, top12: null, ai: null };
    var top12 = primary.filter(function (q) { return isTop12(log[q].pos); }).length;
    var ai = aiQ.filter(function (q) { return log[q] && log[q].neuro === 'cited'; }).length;
    var ok = rule.success, bad = rule.failure;
    var good = top12 >= ok.top12_min && (ok.ai_min === null || ok.ai_min === undefined || ai >= ok.ai_min);
    var fail = top12 <= bad.top12_max && (bad.ai_max === null || bad.ai_max === undefined || ai <= bad.ai_max);
    return { state: good ? 'success' : (fail ? 'failure' : 'middle'), measured: measured, of: primary.length, top12: top12, ai: ai };
  }

  // Контрольная группа: запросы без нового материала. Если они сдвинулись так же, причина не в статье.
  function controlStats(queries, baseLog, repLog) {
    var st = { total: queries.length, base_measured: 0, base_top12: 0, rep_measured: 0, rep_top12: 0 };
    queries.forEach(function (q) {
      var b = (baseLog || {})[q], r = (repLog || {})[q];
      if (b && b.pos) { st.base_measured++; if (isTop12(b.pos)) st.base_top12++; }
      if (r && r.pos) { st.rep_measured++; if (isTop12(r.pos)) st.rep_top12++; }
    });
    return st;
  }

  function yandexUrl(query) {
    return 'https://yandex.ru/search/?lr=56&text=' + encodeURIComponent(query);
  }

  function wordstatUrl(phrase) {
    return 'https://wordstat.yandex.ru/?region=11225&view=table&words=' + encodeURIComponent(phrase);
  }

  // ---------- Markdown ----------

  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/\[ПОДТВЕРДИТЬ([^\]]*)\]/gi, function (m) { return '<mark class="todo">' + m + '</mark>'; });
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    return s;
  }

  function mdToHtml(md) {
    var lines = String(md || '').replace(/\r/g, '').split('\n');
    var html = [], i = 0, para = [];
    var flush = function () { if (para.length) { html.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    var isRow = function (l) { return /^\s*\|/.test(l); };
    var isSep = function (l) { return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && /-/.test(l); };
    var cells = function (l) { return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); };

    while (i < lines.length) {
      var line = lines[i];
      if (/^```/.test(line)) {
        flush();
        var code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++;
        html.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
        continue;
      }
      if (!line.trim()) { flush(); i++; continue; }
      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) { flush(); html.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); html.push('<hr>'); i++; continue; }
      if (isRow(line)) {
        flush();
        var rows = [];
        while (i < lines.length && isRow(lines[i])) { rows.push(lines[i]); i++; }
        var hasHead = rows.length > 1 && isSep(rows[1]);
        var t = '<div class="table-wrap"><table>';
        rows.forEach(function (r, idx) {
          if (isSep(r)) return;
          var tag = hasHead && idx === 0 ? 'th' : 'td';
          t += '<tr>' + cells(r).map(function (c) { return '<' + tag + '>' + inline(c) + '</' + tag + '>'; }).join('') + '</tr>';
        });
        html.push(t + '</table></div>');
        continue;
      }
      if (/^\s*>/.test(line)) {
        flush();
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        html.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>');
        continue;
      }
      var ul = /^\s*[-*•]\s+(.*)$/, ol = /^\s*\d+[.)]\s+(.*)$/;
      if (ul.test(line) || ol.test(line)) {
        flush();
        var ordered = ol.test(line), re = ordered ? ol : ul, items = [];
        while (i < lines.length && (re.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
          var m = re.exec(lines[i]);
          if (m) items.push(m[1]); else items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        }
        html.push((ordered ? '<ol>' : '<ul>') + items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + (ordered ? '</ol>' : '</ul>'));
        continue;
      }
      para.push(line.trim());
      i++;
    }
    flush();
    return html.join('\n');
  }

  var api = {
    STAGES: STAGES,
    SCOPES: SCOPES,
    SCENARIOS: SCENARIOS,
    fmt: fmt,
    fmtMoney: fmtMoney,
    today: today,
    escapeHtml: escapeHtml,
    toInt: toInt,
    applyOverrides: applyOverrides,
    summarize: summarize,
    demandForScope: demandForScope,
    parseWordstatCsv: parseWordstatCsv,
    buildTemplateCsv: buildTemplateCsv,
    calcFunnel: calcFunnel,
    serpStats: serpStats,
    rationaleVerdict: rationaleVerdict,
    controlStats: controlStats,
    pilotCost: pilotCost,
    yandexUrl: yandexUrl,
    wordstatUrl: wordstatUrl,
    mdToHtml: mdToHtml
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GeoCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
