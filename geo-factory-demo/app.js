/*
 * Интерфейс GEO Factory. Вся расчётная логика — в app_core.js (GeoCore),
 * данные — в factory_data.js (собирается export_data.py).
 * То, что вводит пользователь, хранится в браузере и выгружается в файл.
 */
(function () {
  'use strict';

  var D = typeof FACTORY_DATA !== 'undefined' ? FACTORY_DATA : window.FACTORY_DATA;
  var C = window.GeoCore;
  var E = C.escapeHtml;
  var STORE_KEY = 'geo_factory_state_v2';

  var VIEWS = [
    { id: 'overview', title: 'Обзор' },
    { id: 'demand', title: 'Спрос' },
    { id: 'serp', title: 'Выдача' },
    { id: 'economy', title: 'Экономика' },
    { id: 'content', title: 'Контент' },
    { id: 'plan', title: 'План пилота' }
  ];

  var REVIEW = {
    draft: { label: 'Черновик', cls: 'neutral' },
    in_review: { label: 'На проверке у инженера', cls: 'info' },
    approved: { label: 'Подтверждено инженером', cls: 'real' },
    published: { label: 'Опубликовано', cls: 'real' }
  };

  var PLAN_STEPS = [
    { id: 'w1_wordstat', week: 'Неделя 1', title: 'Снять реальные частоты Вордстат', text: 'Челябинская область и Урал. Раздел «Спрос». Раз в месяц обновлять.' },
    { id: 'w1_serp', week: 'Неделя 1', title: 'Сделать базовый замер выдачи', text: 'Позиция сайта завода и блок ответа ИИ по запросам с реальным спросом. Раздел «Выдача». Базовый замер от 12.11.2026 уже в журнале.' },
    { id: 'w1_shipment', week: 'Неделя 1', title: 'Получить от отдела продаж цену, маржу, средний заказ и годовую отгрузку', text: 'Без этих цифр экономика остаётся допущением. Раздел «Экономика».' },
    { id: 'w2_review', week: 'Неделя 2', title: 'Отдать статью о смете инженеру и отделу продаж', text: 'Закрыть все метки [ПОДТВЕРДИТЬ] и отметить проверенные цифры. Раздел «Контент».' },
    { id: 'w2_publish', week: 'Неделя 2', title: 'Опубликовать статью на сайте завода и в Дзене', text: 'С разметкой FAQ и контактами отдела продаж.' },
    { id: 'w3_second', week: 'Недели 3–4', title: 'Подготовить вторую статью по коммерческому кластеру', text: 'Тема из гипотез с наибольшим подтверждённым спросом.' },
    { id: 'w6_repeat', week: 'Неделя 6', title: 'Повторить замер выдачи', text: 'Те же запросы. Сравнение с базовым замером считается автоматически.' },
    { id: 'w6_leads', week: 'Неделя 6', title: 'Посчитать обращения с материалов', text: 'Звонки и заявки с пометкой источника — в отделе продаж.' },
    { id: 'w6_decision', week: 'Неделя 6', title: 'Решение: масштабировать или закрыть', text: 'По фактическим позициям и обращениям, а не по модели.' }
  ];

  // ---------- состояние ----------

  function defaultState() {
    return {
      overrides: {}, serp: { baseline: {}, repeat: {} }, funnel: Object.assign({ unique_share: 60 }, D.funnel_defaults),
      claims: {}, review: {}, plan: {}, theme: 'light'
    };
  }

  function loadState() {
    var s = defaultState();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) mergeState(s, JSON.parse(raw));
    } catch (e) { /* хранилище недоступно — работаем в памяти */ }
    seedBaseline(s);
    return s;
  }

  // Базовый замер выдачи из данных проекта попадает в журнал один раз и не затирает ручные записи.
  function seedBaseline(s) {
    var B = D.serp_baseline;
    if (!B || !B.entries || s.serp_seed === B.date) return;
    B.entries.forEach(function (e) {
      if (s.serp.baseline[e.query]) return;
      s.serp.baseline[e.query] = { pos: e.pos ? String(e.pos) : 'out', neuro: e.ai, top: e.first || '', date: B.date, auto: true };
    });
    s.serp_seed = B.date;
  }

  function mergeState(target, src) {
    if (!src || typeof src !== 'object') return;
    ['overrides', 'claims', 'review', 'plan'].forEach(function (k) {
      if (src[k] && typeof src[k] === 'object') target[k] = src[k];
    });
    if (src.serp && typeof src.serp === 'object') {
      target.serp.baseline = src.serp.baseline || {};
      target.serp.repeat = src.serp.repeat || {};
    }
    if (src.serp_seed) target.serp_seed = src.serp_seed;
    if (src.funnel && typeof src.funnel === 'object') Object.assign(target.funnel, src.funnel);
    if (src.theme === 'dark' || src.theme === 'light') target.theme = src.theme;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* нет хранилища */ }
  }

  var state = loadState();
  var ui = { view: 'overview', openClusters: {}, filter: '', region: 'chel', serpRound: 'baseline', pack: null, tab: 'article', raw: false };

  function clusters() { return C.applyOverrides(D.semantics.clusters, state.overrides); }

  // ---------- мелкие помощники ----------

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.style.display = 'none'; }, 3200);
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function copyText(text) {
    var done = function () { toast('Скопировано в буфер обмена'); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function badge(status) {
    var map = { demo: ['demo', 'Демо-оценка'], real: ['real', 'Вордстат'], partial: ['partial', 'Частично'] };
    var b = map[status] || map.demo;
    return '<span class="badge ' + b[0] + '">' + b[1] + '</span>';
  }

  function plural(n, f) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    return b === 1 ? f[0] : f[2];
  }

  function head(title, text, toolbar) {
    return '<div class="page-head"><div><h1>' + E(title) + '</h1><p>' + text + '</p></div>' +
      (toolbar ? '<div class="toolbar">' + toolbar + '</div>' : '') + '</div>';
  }

  function reviewStatus(pack) { return state.review[pack.id] || pack.review.status || 'draft'; }

  function claimsDone(pack) {
    var done = state.claims[pack.id] || {};
    return pack.audit.claims_to_verify.filter(function (c) { return done[c.line]; }).length;
  }

  function planDone(id) {
    if (state.plan[id]) return true;
    if (id === 'w1_shipment') return !!state.funnel.confirmed && parseFloat(state.funnel.annual_shipment_m3) > 0;
    if (id === 'w1_serp') {
      var st = C.serpStats(D.serp_queries, state.serp.baseline);
      return st.total > 0 && st.measured === st.total;
    }
    return id === 'w1_wordstat' && C.summarize(clusters()).status === 'real';
  }

  function baseKeyword(phrase) {
    var key = phrase.trim().toLowerCase(), found = null;
    Object.keys(D.semantics.clusters).forEach(function (c) {
      D.semantics.clusters[c].keywords.forEach(function (k) { if (k.phrase.trim().toLowerCase() === key) found = k; });
    });
    return found;
  }

  function baseFunnel(cl) {
    var p = Object.assign({}, state.funnel);
    p.demand = C.demandForScope(cl, p.scope);
    p.content_cost = C.pilotCost(p);
    return C.calcFunnel(p);
  }

  // ---------- навигация ----------

  function renderNav() {
    var cl = clusters(), sum = C.summarize(cl);
    var st = C.serpStats(D.serp_queries, state.serp.baseline);
    var approved = D.packs.filter(function (p) { var s = reviewStatus(p); return s === 'approved' || s === 'published'; }).length;
    var planCount = PLAN_STEPS.filter(function (s) { return planDone(s.id); }).length;
    var counts = {
      demand: sum.real + '/' + sum.total, serp: st.measured + '/' + st.total,
      content: approved + '/' + D.packs.length, plan: planCount + '/' + PLAN_STEPS.length
    };
    $('nav').innerHTML = VIEWS.map(function (v, i) {
      return '<button data-action="go" data-view="' + v.id + '" class="' + (ui.view === v.id ? 'active' : '') + '"' +
        (ui.view === v.id ? ' aria-current="page"' : '') + '><span class="num">' + (i + 1) + '</span>' + v.title +
        (counts[v.id] ? '<span class="count">' + counts[v.id] + '</span>' : '') + '</button>';
    }).join('');
    $('sideNote').textContent = 'Данные собраны ' + D.meta.generated_at + '. Введённое хранится в этом браузере — сохраняйте в файл.';
    $('themeBtn').textContent = state.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  // ---------- 1. Обзор ----------

  function viewOverview() {
    var cl = clusters(), sum = C.summarize(cl);
    var st = C.serpStats(D.serp_queries, state.serp.baseline);
    var f = baseFunnel(cl);
    var approved = D.packs.filter(function (p) { var s = reviewStatus(p); return s === 'approved' || s === 'published'; }).length;
    var hasShipment = parseFloat(state.funnel.annual_shipment_m3) > 0;
    var pct = function (a, b) { return b ? Math.round(a / b * 100) : 0; };

    var kpi = function (view, label, value, sub, share, ok) {
      return '<button class="kpi" data-action="go" data-view="' + view + '"><div class="label">' + label + '</div>' +
        '<div class="value">' + value + '</div><div class="sub">' + sub + '</div>' +
        '<div class="meter' + (ok ? ' ok' : '') + '"><i style="width:' + share + '%"></i></div></button>';
    };

    var next = [
      { done: sum.real === sum.total, view: 'demand', title: 'Подтвердить спрос', text: (sum.real === sum.total ? 'Частоты Вордстат сняты по всем ' + sum.total + ' запросам ядра. Обновляйте раз в месяц.' : 'Реальные частоты Вордстат сняты по ' + sum.real + ' из ' + sum.total + ' фраз. Остальные — демо-оценка.') },
      { done: st.measured === st.total, view: 'serp', title: 'Замерить выдачу', text: 'Позиция завода зафиксирована по ' + st.measured + ' из ' + st.total + ' запросов.' },
      { done: !!state.funnel.confirmed, view: 'economy', title: 'Подтвердить цифры экономики', text: state.funnel.confirmed ? 'Цена, маржа и размер заказа подтверждены отделом продаж.' : 'Цена, маржа и размер заказа пока стартовые допущения. Спросите в отделе продаж.' + (hasShipment ? '' : ' Годовая отгрузка не введена.') },
      { done: approved > 0, view: 'content', title: 'Подтвердить статью у инженера', text: 'Подтверждено материалов: ' + approved + ' из ' + D.packs.length + '.' }
    ];

    var p = D.passport;
    return head('Пилот GEO для завода ЗАВОД-Х',
      'Задача пилота — за шесть недель проверить на фактах, приводят ли экспертные материалы завода покупателей из поиска и нейроответов.',
      '<button class="btn" data-action="print">Печать сводки</button>') +
      (sum.status !== 'real' ? '<div class="notice demo"><div><b>Часть цифр — оценка, а не измерение</b><span>Спрос: ' + sum.real + ' из ' + sum.total +
        ' фраз подтверждены Вордстатом. Выручка в модели считается от этих частот и ваших допущений.</span></div>' +
        '<button class="btn small" data-action="go" data-view="demand">Ввести реальные частоты</button></div>' : '') +
      '<div class="grid g4">' +
      kpi('demand', 'Спрос подтверждён', sum.real + ' <small>из ' + sum.total + ' фраз</small>', C.fmt(sum.chelyabinsk) + ' запросов/мес по области', pct(sum.real, sum.total), sum.real === sum.total) +
      kpi('serp', 'Выдача замерена', st.measured + ' <small>из ' + st.total + '</small>', st.measured ? 'В топ-12: ' + st.top12 + ', в топ-3: ' + st.top3 : 'Базовый замер не сделан', pct(st.measured, st.total), st.measured === st.total) +
      kpi('content', 'Материалы подтверждены', approved + ' <small>из ' + D.packs.length + '</small>', 'Статус ставит инженер завода', pct(approved, D.packs.length), approved === D.packs.length) +
      kpi('economy', 'Окупаемость пилота', f.breakeven_deals === null ? '—' : '≈ ' + Math.ceil(f.breakeven_deals) + ' <small>' + plural(Math.ceil(f.breakeven_deals), ['отгрузка', 'отгрузки', 'отгрузок']) + '</small>',
        state.funnel.confirmed ? 'Цена, маржа и заказ подтверждены' : 'По допущениям, не прогноз', state.funnel.confirmed ? (hasShipment ? 100 : 70) : 20, !!state.funnel.confirmed && hasShipment) +
      '</div>' +
      findingCard(sum) +
      '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>Что сделать дальше</h2>' +
      next.map(function (n, i) {
        return '<div class="step-row' + (n.done ? ' done' : '') + '"><div class="n">' + (n.done ? '✓' : i + 1) + '</div><div><b>' + n.title + '</b><p>' + n.text + '</p></div>' +
          '<button class="btn small no-print" data-action="go" data-view="' + n.view + '">Открыть</button></div>';
      }).join('') + '</div>' +
      '<div class="card"><h2>Паспорт предприятия</h2><dl class="kv">' +
      '<dt>Компания</dt><dd>' + E(p.company_name) + '</dd><dt>ИНН</dt><dd>' + E(p.inn) + '</dd>' +
      '<dt>Производство</dt><dd>' + E(p.production_address) + '</dd><dt>Отдел продаж</dt><dd>' + E(p.sales_office) + '</dd>' +
      '<dt>Сайт</dt><dd>' + E(p.site) + '</dd><dt>Телефон</dt><dd>' + E(p.contact_phone) + '</dd></dl>' +
      '<p class="small muted" style="margin:12px 0 0">Технические характеристики и кейсы из паспорта используются в текстах только после подтверждения службой качества завода.</p></div></div>';
  }

  function findingCard(sum) {
    var L = D.legacy_check && D.legacy_check.phrases;
    if (!L || sum.status === 'demo') return '';
    var zero = L.filter(function (x) { return !x.real_chelyabinsk && !x.real_urfo; }).length;
    var demo = L.reduce(function (a, x) { return a + x.demo_chelyabinsk; }, 0), real = L.reduce(function (a, x) { return a + x.real_chelyabinsk; }, 0);
    var heads = D.semantics.heads || [];
    return '<div class="card" style="margin-top:14px"><h2>Что показал Вордстат <span class="badge real">' + E(D.semantics.snapshot_info.snapshot_period) + '</span></h2>' +
      '<div class="grid g2"><div><p style="margin:0 0 8px">Первая версия ядра не подтвердилась: по <b>' + zero + ' из ' + L.length + '</b> фраз спрос нулевой, суммарно <b>' + C.fmt(real) +
      '</b> запросов в месяц по области вместо <b>' + C.fmt(demo) + '</b> в прежней оценке. Ядро пересобрано из запросов, которые люди действительно вводят.</p>' +
      '<p class="muted small" style="margin:0">Спрос сосредоточен в коротких запросах: покупка и цена, расчёт количества, название завода. Тема крепежа, под которую написана первая статья, даёт около 250 запросов в месяц.</p></div>' +
      '<dl class="kv">' + heads.map(function (h) { return '<dt>«' + E(h.phrase) + '», все запросы со словом</dt><dd>' + C.fmt(h.frequency_chelyabinsk) + '</dd>'; }).join('') + '</dl></div>' +
      '<p class="muted small" style="margin:10px 0 0">Челябинская область, запросов в месяц. ' + E(D.semantics.note || '') + '</p></div>';
  }

  // ---------- 2. Спрос ----------

  function clusterList(cl) {
    var q = ui.filter.trim().toLowerCase();
    var region = ui.region;
    var keys = Object.keys(cl).sort(function (a, b) {
      var f = region === 'chel' ? 'total_cluster_traffic_chelyabinsk' : 'total_cluster_traffic';
      return cl[b][f] - cl[a][f];
    });
    var shown = 0;
    var html = keys.map(function (key) {
      var c = cl[key];
      var kws = c.keywords.filter(function (k) { return !q || k.phrase.toLowerCase().indexOf(q) >= 0; });
      if (!kws.length) return '';
      shown += kws.length;
      var max = Math.max.apply(null, c.keywords.map(function (k) { return region === 'chel' ? k.frequency_chelyabinsk : k.frequency_urfo; }).concat([1]));
      var real = c.keywords.filter(function (k) { return k.source === 'real'; }).length;
      var stage = C.STAGES[c.stage] ? '<span class="badge neutral plain">' + C.STAGES[c.stage] + '</span> ' : '';
      var total = region === 'chel' ? c.total_cluster_traffic_chelyabinsk : c.total_cluster_traffic;
      var status = real === c.keywords.length ? 'real' : (c.keywords.some(function (k) { return k.source !== 'demo'; }) ? 'partial' : 'demo');
      var open = q || ui.openClusters[key];
      return '<details class="cluster" data-cluster="' + key + '"' + (open ? ' open' : '') + '><summary><div><h3>' + E(c.title) + '</h3><p>' + E(c.summary) + '</p></div>' +
        '<span>' + stage + badge(status) + '</span>' + '<div class="total">' + C.fmt(total) + '<small>запросов/мес · ' + real + '/' + c.keywords.length + ' подтв.</small></div></summary>' +
        '<div class="body table-wrap"><table><thead><tr><th>Фраза</th><th class="num">Челябинская обл.</th><th class="num">Урал</th><th>Дата</th><th>Источник</th><th class="no-print"></th></tr></thead><tbody>' +
        kws.map(function (k) {
          var o = state.overrides[k.phrase.trim().toLowerCase()] || {};
          var val = region === 'chel' ? k.frequency_chelyabinsk : k.frequency_urfo;
          var inp = function (field, placeholder) {
            return '<input type="number" min="0" inputmode="numeric" data-change="freq" data-phrase="' + E(k.phrase) + '" data-field="' + field + '" data-fid="' + E(k.phrase) + '|' + field +
              '" value="' + (o[field] === null || o[field] === undefined ? (k.source === 'demo' ? '' : placeholder) : E(o[field])) + '" placeholder="' + C.fmt(placeholder) + '" aria-label="' + (field === 'chel' ? 'Челябинская область' : 'УрФО') + ': ' + E(k.phrase) + '">';
          };
          return '<tr><td>' + E(k.phrase) + (k.anchor ? '' : ' <span class="muted small">· входит в якорный запрос</span>') + '<span class="bar" style="width:' + Math.max(1, Math.round(val / max * 100)) + '%"></span></td>' +
            '<td class="num">' + inp('chel', k.frequency_chelyabinsk) + '</td><td class="num">' + inp('urfo', k.frequency_urfo) + '</td>' +
            '<td class="nowrap muted small">' + E(k.checked_date || '—') + '</td><td>' + badge(k.source) + '</td>' +
            '<td class="right no-print"><a class="btn small" target="_blank" rel="noopener" href="' + C.wordstatUrl(k.phrase) + '">Вордстат ↗</a></td></tr>';
        }).join('') + '</tbody></table></div></details>';
    }).join('');
    return html || '<div class="card empty">По запросу «' + E(ui.filter) + '» фраз не найдено.</div>';
  }

  function legacyBlock() {
    var L = D.legacy_check && D.legacy_check.phrases;
    if (!L) return '';
    var zero = L.filter(function (x) { return !x.real_chelyabinsk && !x.real_urfo; }).length;
    return '<details class="cluster" style="margin-top:18px"><summary><div><h3>Архив: первая версия ядра</h3><p>60 длинных фраз с частотами, заданными вручную. Проверка в Вордстате ' + E(D.legacy_check.checked_date) +
      ': по ' + zero + ' фразам запросов нет. В расчётах не участвует.</p></div><span class="badge neutral plain">архив</span><div class="total">' + zero + '/' + L.length + '<small>с нулевым спросом</small></div></summary>' +
      '<div class="body table-wrap"><table><thead><tr><th>Фраза</th><th class="num">Было в оценке, обл.</th><th class="num">Вордстат, обл.</th><th class="num">Вордстат, Урал</th></tr></thead><tbody>' +
      L.map(function (x) { return '<tr><td>' + E(x.phrase) + '</td><td class="num muted">' + C.fmt(x.demo_chelyabinsk) + '</td><td class="num"><b>' + C.fmt(x.real_chelyabinsk) + '</b></td><td class="num">' + C.fmt(x.real_urfo) + '</td></tr>'; }).join('') +
      '</tbody></table></div></details>';
  }

  function viewDemand() {
    var cl = clusters(), sum = C.summarize(cl);
    return head('Спрос: семантическое ядро',
      Object.keys(cl).length + ' кластеров, ' + sum.total + ' запросов. Частоты — число запросов в месяц по широкому соответствию. Итог кластера считается по якорным запросам: остальные входят в них и показаны для выбора тем. Числа можно обновлять вручную или загрузкой CSV.',
      '<button class="btn" data-action="csv-template">Скачать таблицу CSV</button><button class="btn primary" data-action="csv-import">Загрузить CSV</button>') +
      '<div class="notice ' + (sum.status === 'real' ? 'real' : 'demo') + '"><div><b>' +
      (sum.status === 'real' ? 'Все частоты подтверждены Вордстатом' : 'Подтверждено Вордстатом: ' + sum.real + ' из ' + sum.total + ' фраз') + '</b><span>' +
      (sum.status === 'real' ? 'Период ' + E(D.semantics.snapshot_info.snapshot_period) + ', снято ' + E(D.semantics.snapshot_info.snapshot_date) + '. По области: ' + C.fmt(sum.chelyabinsk) + ' запросов/мес, по Уралу: ' + C.fmt(sum.urfo) + '. Итоги кластеров — верхняя оценка: якорные запросы частично пересекаются.' :
        'Остальные значения заданы вручную как ориентир и не являются выгрузкой. Быстрее всего — скачать таблицу, заполнить и загрузить обратно.') + '</span></div>' +
      (Object.keys(state.overrides).length ? '<button class="btn small" data-action="freq-reset">Сбросить введённое</button>' : '') + '</div>' +
      '<div class="toolbar" style="margin-bottom:12px"><input type="search" id="semFilter" data-input="filter" placeholder="Поиск по фразам" value="' + E(ui.filter) + '" style="flex:1;min-width:200px" aria-label="Поиск по фразам">' +
      '<div class="seg" role="group" aria-label="Сортировка по региону"><button data-action="region" data-region="chel" class="' + (ui.region === 'chel' ? 'active' : '') + '">Челябинская обл.</button>' +
      '<button data-action="region" data-region="urfo" class="' + (ui.region === 'urfo' ? 'active' : '') + '">Урал</button></div></div>' +
      '<div id="semList">' + clusterList(cl) + '</div>' + legacyBlock() +
      '<p class="small muted" style="margin-top:14px">Чтобы реальные частоты попали в сборку для всех, сохраните заполненную таблицу как <code>data/wordstat_real.csv</code> и запустите <code>python export_data.py</code>.</p>';
  }

  // ---------- 3. Выдача ----------

  function serpFindings(B) {
    if (!B.findings || !B.findings.length) return '';
    return '<div class="card" style="margin-bottom:14px"><h2>Что показал базовый замер <span class="badge real">' + E(B.date) + '</span></h2><ul style="margin:0 0 10px;padding-left:20px">' +
      B.findings.map(function (f) { return '<li style="margin-bottom:6px">' + E(f) + '</li>'; }).join('') + '</ul>' +
      '<p class="muted small" style="margin:0">' + E(B.caveats || '') + '</p></div>';
  }

  function viewSerp() {
    var round = ui.serpRound, log = state.serp[round];
    var B = D.serp_baseline || { entries: [] }, BQ = {};
    B.entries.forEach(function (x) { BQ[x.query] = x; });
    var base = C.serpStats(D.serp_queries, state.serp.baseline);
    var rep = C.serpStats(D.serp_queries, state.serp.repeat);
    var posOpts = [['', '—']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return [String(n), String(n)]; })).concat([['out', 'нет в топ-12']]);
    var neuroOpts = [['', '—'], ['cited', 'завод в источниках или назван'], ['not_cited', 'ответ ИИ есть, завода нет'], ['none', 'ответа ИИ нет']];
    var sel = function (q, field, opts, val) {
      return '<select data-change="serp" data-query="' + E(q) + '" data-field="' + field + '" aria-label="' + field + ': ' + E(q) + '">' +
        opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(val || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    };
    var stat = function (label, a, b, total) {
      var delta = rep.measured ? b - a : null;
      return '<div class="card"><div class="muted small">' + label + '</div><div class="result-big">' + (rep.measured ? b : a) + '<small class="muted" style="font-size:14px"> из ' + total + '</small></div>' +
        '<div class="small muted">' + (delta === null ? 'Базовый замер' : 'Было ' + a + ' → стало ' + b + ' (' + (delta > 0 ? '+' : '') + delta + ')') + '</div></div>';
    };
    return head('Выдача: журнал замеров',
      (B.date ? 'Базовый замер от ' + E(B.date) + ' снят по ' + B.entries.length + ' запросам: Яндекс, регион Челябинск, чистый браузер без входа в аккаунт. Повторный замер через шесть недель делайте так же, иначе цифры не сопоставить.'
        : 'Откройте запрос в Яндексе в режиме инкогнито, найдите сайт завода ' + E(D.passport.site) + ' и запишите позицию. Отдельно отметьте, есть ли завод в блоке ответа ИИ. Через шесть недель повторите замер.'),
      '<div class="seg" role="group" aria-label="Замер"><button data-action="round" data-round="baseline" class="' + (round === 'baseline' ? 'active' : '') + '">Базовый замер</button>' +
      '<button data-action="round" data-round="repeat" class="' + (round === 'repeat' ? 'active' : '') + '">Повторный замер</button></div>' +
      '<button class="btn" data-action="serp-csv">Выгрузить CSV</button>') +
      '<div class="grid g4" style="margin-bottom:14px">' +
      stat('Замерено запросов', base.measured, rep.measured, base.total) +
      stat('Завод в топ-3', base.top3, rep.top3, base.total) +
      stat('Завод в топ-12', base.top12, rep.top12, base.total) +
      stat('Завод в ответе ИИ', base.neuro_cited, rep.neuro_cited, base.total) + '</div>' + serpFindings(B) +
      '<div class="card" style="padding:0"><div class="table-wrap"><table><thead><tr><th>Запрос</th><th>Позиция завода</th><th>Ответ ИИ</th><th>Кто на первом месте</th><th title="Рекламных блоков в выдаче при базовом замере">Реклама</th><th>Дата</th><th class="no-print"></th></tr></thead><tbody>' +
      D.serp_queries.map(function (q) {
        var e = log[q.query] || {};
        return '<tr><td>' + E(q.query) + '<div class="small muted">Гипотеза ' + q.hypothesis + '</div></td>' +
          '<td>' + sel(q.query, 'pos', posOpts, e.pos) + '</td><td>' + sel(q.query, 'neuro', neuroOpts, e.neuro) + '</td>' +
          '<td><input type="text" data-change="serp" data-query="' + E(q.query) + '" data-field="top" value="' + E(e.top || '') + '" placeholder="домен или название" aria-label="Кто на первом месте: ' + E(q.query) + '"></td>' +
          '<td class="nowrap small" title="' + E(BQ[q.query] ? BQ[q.query].ads_who.join(', ') : '') + '">' + (BQ[q.query] ? BQ[q.query].ads : '—') + '</td>' +
          '<td class="nowrap muted small">' + E(e.date || '—') + (e.auto ? ' <span class="badge info">авто</span>' : '') + '</td>' +
          '<td class="right no-print"><a class="btn small" target="_blank" rel="noopener" href="' + C.yandexUrl(q.query) + '">Яндекс ↗</a></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<p class="small muted" style="margin-top:12px">Ссылка открывает поиск с регионом Челябинск. Позиции зависят от персонализации, поэтому повторный замер делайте в чистом окне без входа в аккаунт и в один день. Запись, которую вы изменили вручную, перестаёт считаться автоматической.</p>';
  }

  // ---------- 4. Экономика ----------

  var FIELDS = [
    { id: 'unique_share', label: 'Доля целевых запросов', unit: '%', min: 10, max: 100, step: 5, hint: 'Запросы ≠ люди: один человек ищет несколько раз, часть запросов не про покупку.' },
    { id: 'ctr_now', label: 'Переходы на материалы завода сейчас', unit: '%', min: 0, max: 30, step: 0.5, hint: 'Доля показов, которая сегодня приводит на сайт завода.' },
    { id: 'ctr_target', label: 'Переходы после пилота', unit: '%', min: 0, max: 40, step: 0.5, hint: 'Ориентир: первые позиции собирают заметно больше переходов, чем 7–10-я.' },
    { id: 'visit_to_lead', label: 'Посетитель → обращение', unit: '%', min: 0.1, max: 10, step: 0.1, hint: 'Звонок или заявка с материала.' },
    { id: 'lead_to_deal', label: 'Обращение → отгрузка', unit: '%', min: 1, max: 60, step: 1, hint: 'Возьмите фактическую конверсию отдела продаж.' },
    { id: 'm3_per_deal', label: 'Объём одной отгрузки', unit: 'м³', min: 5, max: 200, step: 5, hint: 'Средний заказ частного застройщика, из отчёта отдела продаж.' },
    { id: 'price_per_m3', label: 'Цена', unit: '₽/м³', min: 3000, max: 9000, step: 100, hint: 'Отпускная цена завода за кубометр.' },
    { id: 'margin', label: 'Маржа', unit: '%', min: 1, max: 60, step: 1, hint: 'Маржинальная прибыль с кубометра.' },
    { id: 'season_months', label: 'Сезон', unit: 'мес', min: 1, max: 12, step: 1, hint: 'Сколько месяцев в году работает спрос.' }
  ];

  function economyOut() {
    var cl = clusters(), sum = C.summarize(cl);
    var p = Object.assign({}, state.funnel);
    p.demand = C.demandForScope(cl, p.scope);
    p.content_cost = C.pilotCost(p);
    var f = C.calcFunnel(p);
    var step = function (v, l, cls) { return '<div class="step ' + (cls || '') + '"><b>' + v + '</b><span>' + l + '</span></div>'; };
    var shipment = parseFloat(p.annual_shipment_m3) > 0;
    var sanity;
    if (!shipment) sanity = '<div class="notice demo" style="margin:14px 0 0"><div><b>Модель не сверена с фактом</b><span>Введите годовую отгрузку завода — станет видно, какую её долю даёт пилот, и не завышены ли допущения.</span></div></div>';
    else if (f.share_of_shipment > 15) sanity = '<div class="notice demo" style="margin:14px 0 0"><div><b>Допущения завышены: ' + C.fmt(f.share_of_shipment, 1) + '% годовой отгрузки</b><span>Один контентный канал не даёт такой доли. Снизьте конверсии или долю целевых запросов.</span></div></div>';
    else sanity = '<div class="notice real" style="margin:14px 0 0"><div><b>' + C.fmt(f.share_of_shipment, 1) + '% годовой отгрузки завода</b><span>Порядок величины правдоподобен. Точность даст только факт после пилота.</span></div></div>';

    var rows = Object.keys(C.SCENARIOS).map(function (key) {
      var s = C.SCENARIOS[key];
      var r = C.calcFunnel(Object.assign({}, p, { ctr_target: s.ctr_target, visit_to_lead: s.visit_to_lead, lead_to_deal: s.lead_to_deal, unique_share: s.unique_share }));
      return '<tr><td><b>' + s.label + '</b><div class="small muted">переходы ' + s.ctr_target + '%, заявка ' + s.visit_to_lead + '%, сделка ' + s.lead_to_deal + '%</div></td>' +
        '<td class="num">' + C.fmt(r.deals, 1) + '</td><td class="num">' + C.fmt(r.year_m3) + '</td><td class="num">' + C.fmtMoney(r.year_revenue) + '</td><td class="num">' + C.fmtMoney(r.year_margin) + '</td>' +
        '<td class="no-print"><button class="btn small" data-action="scenario" data-scenario="' + key + '">Применить</button></td></tr>';
    }).join('');

    var conf = !!p.confirmed, be = f.breakeven_deals;
    var big = function (v, unit) { return '<div class="result-big">' + v + (unit ? ' <small class="muted" style="font-size:14px">' + unit + '</small>' : '') + '</div>'; };
    var beCard = '<div class="card"><h2>Окупаемость пилота <span class="badge ' + (conf ? 'real' : 'demo') + '">' + (conf ? 'Цифры отдела продаж' : 'Стартовые допущения') + '</span></h2>' +
      (be === null ? '<p class="muted" style="margin:0">' + (p.content_cost === 0 ? 'Затраты пилота равны нулю: окупается сразу. Но время сотрудников чего-то стоит, внесите его слева.' : 'Введите цену, маржу и размер заказа — порог окупаемости появится здесь.') + '</p>' :
        '<div class="grid g3"><div><div class="muted small">Чтобы вернуть затраты ' + C.fmtMoney(p.content_cost) + ', нужно</div>' + big('≈ ' + Math.ceil(be), plural(Math.ceil(be), ['отгрузка', 'отгрузки', 'отгрузок'])) + '<div class="small muted">примерно ' + C.fmt(f.breakeven_m3) + ' м³</div></div>' +
        '<div><div class="muted small">Это обращений</div>' + (f.breakeven_leads === null ? big('—') : big('≈ ' + C.fmt(Math.ceil(f.breakeven_leads)))) + '<div class="small muted">при ' + C.fmt(parseFloat(p.lead_to_deal)) + '% обращений, доходящих до отгрузки</div></div>' +
        '<div><div class="muted small">Это переходов на материалы</div>' + (f.breakeven_visits === null ? big('—') : big('≈ ' + C.fmt(Math.ceil(f.breakeven_visits)))) + '<div class="small muted">при ' + C.fmt(parseFloat(p.visit_to_lead), 1) + '% посетителей, оставляющих обращение</div></div></div>' +
        '<p class="small" style="margin:14px 0 0">Одна отгрузка в ' + C.fmt(parseFloat(p.m3_per_deal)) + ' м³ даёт ' + C.fmtMoney(f.margin_per_deal) + ' маржи. Число отгрузок зависит только от цены, маржи и размера заказа. Конверсии меняют лишь то, сколько для этого нужно обращений и переходов.' +
        (f.season_deals > 0 ? ' По модели ниже за сезон выйдет ≈ ' + C.fmt(f.season_deals, 1) + ' ' + plural(Math.round(f.season_deals), ['отгрузка', 'отгрузки', 'отгрузок']) + '; порог перекрыт ×' + C.fmt(f.season_deals / be, 1) + '. Это допущение, а не прогноз.' : '') + '</p>') +
      (conf ? '' : '<p class="small muted" style="margin:10px 0 0">Цена, маржа и размер заказа сейчас стартовые. Спросите их в отделе продаж, введите слева и отметьте галочку.</p>') + '</div>';

    return beCard + '<div class="card"><h2>Что если: воронка за месяц ' + badge(sum.status) + ' <span class="badge demo">конверсии — допущения</span></h2><div class="funnel">' +
      step(C.fmt(f.demand), 'целевых запросов') + step(C.fmt(f.extra_visits), 'дополнительных переходов') +
      step(C.fmt(f.leads, 1), 'обращений') + step(C.fmt(f.deals, 1), 'отгрузок') + step(C.fmtMoney(f.revenue), 'выручка', 'final') + '</div>' +
      '<div class="grid g3" style="margin-top:14px"><div><div class="muted small">Выручка за сезон</div><div class="result-big">' + C.fmtMoney(f.year_revenue) + '</div></div>' +
      '<div><div class="muted small">Маржа за сезон</div><div class="result-big">' + C.fmtMoney(f.year_margin) + '</div></div>' +
      '<div><div class="muted small">Объём за сезон</div><div class="result-big">' + C.fmt(f.year_m3) + ' м³</div></div></div>' +
      '<dl class="kv" style="margin-top:14px"><dt>Окупаемость затрат на контент</dt><dd>' + (f.payback_months === null ? '—' : C.fmt(f.payback_months, 1) + ' мес') + '</dd>' +
      '<dt>Переходов сейчас / после пилота</dt><dd>' + C.fmt(f.visits_now) + ' / ' + C.fmt(f.visits_target) + '</dd></dl>' + sanity + '</div>' +
      '<div class="card"><h2>Три сценария</h2><div class="table-wrap"><table><thead><tr><th>Сценарий</th><th class="num">Отгрузок/мес</th><th class="num">м³ за сезон</th><th class="num">Выручка</th><th class="num">Маржа</th><th class="no-print"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small muted" style="margin:10px 0 0">Это модель «что если», а не прогноз. Каждый процент — допущение, которое пилот должен заменить фактом.</p></div>';
  }

  function viewEconomy() {
    var p = state.funnel;
    var field = function (f) {
      return '<div class="field"><label for="f_' + f.id + '">' + f.label + ', ' + f.unit + '</label><div class="row">' +
        '<input type="range" id="f_' + f.id + '" data-input="funnel" data-field="' + f.id + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + E(p[f.id]) + '">' +
        '<input type="number" data-input="funnel" data-field="' + f.id + '" min="0" step="' + f.step + '" value="' + E(p[f.id]) + '" aria-label="' + f.label + '"></div><div class="hint">' + f.hint + '</div></div>';
    };
    var PLANT = ['price_per_m3', 'margin', 'm3_per_deal'];
    var plantFields = FIELDS.filter(function (f) { return PLANT.indexOf(f.id) >= 0; });
    var modelFields = FIELDS.filter(function (f) { return PLANT.indexOf(f.id) < 0; });
    var groupHead = function (t, h) { return '<div class="field" style="margin-top:8px"><label style="font-weight:700">' + t + '</label><div class="hint">' + h + '</div></div>'; };
    return head('Экономика пилота',
      'Сколько отгрузок нужно, чтобы пилот окупился, и что будет, если переходы вырастут. Спрос взят из раздела «Спрос». Цена, маржа и размер заказа — три числа отдела продаж; пока их нет, расчёт идёт по стартовым допущениям.',
      '<button class="btn" data-action="funnel-reset">Сбросить допущения</button><button class="btn" data-action="print">Печать</button>') +
      '<div class="grid split" style="grid-template-columns:340px minmax(0,1fr)"><div class="card stack no-print">' +
      '<div class="field"><label for="f_scope">Какой спрос считаем</label><select id="f_scope" data-change="funnel-select" data-field="scope">' +
      Object.keys(C.SCOPES).map(function (k) { return '<option value="' + k + '"' + (p.scope === k ? ' selected' : '') + '>' + C.SCOPES[k].label + '</option>'; }).join('') + '</select>' +
      '<div class="hint">Брендовые запросы в расчёт не входят: этот спрос завод уже получает.</div></div>' +
      groupHead('Спросите в отделе продаж', 'Три числа определяют, сколько отгрузок окупит пилот.') +
      plantFields.map(field).join('') +
      groupHead('Затраты пилота', 'Публикация на сайте завода, в Дзене, ВК и Телеграме бесплатна. Затраты — рабочее время.') +
      '<div class="field"><label for="f_cash">Деньги наружу, ₽</label><input type="number" id="f_cash" data-input="funnel" data-field="cost_cash" min="0" step="1000" value="' + E(p.cost_cash || 0) + '"><div class="hint">Реклама, платные сервисы, дизайнер. На бесплатных площадках — 0.</div></div>' +
      '<div class="field"><label for="f_hours">Рабочее время за пилот, часов</label><input type="number" id="f_hours" data-input="funnel" data-field="cost_hours" min="0" step="5" value="' + E(p.cost_hours || 0) + '"><div class="hint">Инженер, отдел продаж, правки текста, публикация, замеры. 40 часов — стартовая оценка.</div></div>' +
      '<div class="field"><label for="f_rate">Стоимость часа, ₽</label><input type="number" id="f_rate" data-input="funnel" data-field="cost_rate" min="0" step="100" value="' + E(p.cost_rate || 0) + '"><div class="hint">Оклад с налогами на час работы. 1 000 ₽ — ориентир, поправьте.</div></div>' +
      '<div class="hint" id="costTotal">Итого затрат: <b>' + C.fmtMoney(C.pilotCost(p)) + '</b></div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px"><input type="checkbox" data-change="funnel-confirm"' + (p.confirmed ? ' checked' : '') + ' style="margin-top:3px"><span>Цену, маржу и размер заказа подтвердил отдел продаж</span></label>' +
      groupHead('Допущения о воронке', 'Заменяются фактом после пилота.') +
      modelFields.map(field).join('') +
      '<div class="field"><label for="f_ship">Годовая отгрузка завода, м³</label><input type="number" id="f_ship" data-input="funnel" data-field="annual_shipment_m3" min="0" step="1000" value="' + E(p.annual_shipment_m3 || '') + '" placeholder="для сверки модели">' +
      '<div class="hint">Не выгружается никуда, хранится только в этом браузере.</div></div></div>' +
      '<div class="stack" id="ecoOut">' + economyOut() + '</div></div>';
  }

  // ---------- 5. Контент ----------

  var TABS = [
    { id: 'why', title: 'Обоснование' }, { id: 'article', title: 'Статья' }, { id: 'audit', title: 'Проверка структуры' }, { id: 'claims', title: 'Цифры на подтверждение' },
    { id: 'leadgen', title: 'Лид-магниты' }, { id: 'social', title: 'Соцсети' }, { id: 'targeting', title: 'Таргетинг' }
  ];

  function allItems() {
    var packs = D.packs.map(function (p) { return { kind: 'pack', id: p.id, title: p.title, sub: p.intent, audit: p.audit, texts: p.texts, review: p.review, cluster_id: p.cluster_id, rationale: p.rationale }; });
    var tpl = D.package.map(function (p) {
      return { kind: 'template', id: 'tpl_' + p.channel, title: p.channel_title || p.title, sub: p.title, audit: p.audit, texts: { article: p.content }, review: { status: 'draft', comment: '' }, blocked: p.blocked_reason };
    });
    return packs.concat(tpl);
  }

  // ---------- обоснование: данные → вывод → что сделано → что ожидаем → как проверим ----------

  var VERDICT = {
    success: { cls: 'real', label: 'Критерий успеха выполнен' },
    failure: { cls: 'demo', label: 'Критерий провала' },
    middle: { cls: 'info', label: 'Не доказано' },
    incomplete: { cls: 'neutral', label: 'Замер не закончен' }
  };

  function posLabel(pos) { return pos === null || pos === undefined ? 'нет в топ-12' : String(pos); }
  function aiLabel(ai) { return { cited: 'завод в источниках', not_cited: 'ответ есть, завода нет', none: 'ответа нет' }[ai] || '—'; }

  function rationaleBody(cur) {
    var r = cur.rationale, sm = r.summary, info = D.semantics.snapshot_info;
    var step = function (n, title, html) {
      return '<section class="chain-step"><div class="chain-num">' + n + '</div><div class="chain-body"><h3>' + title + '</h3>' + html + '</div></section>';
    };
    var list = function (arr) { return '<ul class="chain-list">' + arr.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>'; };

    // 1. данные
    var rows = r.targets.map(function (t) {
      var primary = r.rule.primary.indexOf(t.query) >= 0;
      return '<tr><td>' + E(t.query) + (primary ? '' : ' <span class="badge neutral plain" title="Под этот запрос порога нет, за ним только наблюдаем">наблюдаем</span>') + '</td>' +
        '<td class="right">' + C.fmt(t.frequency_chelyabinsk) + '</td><td class="right">' + C.fmt(t.frequency_urfo) + '</td>' +
        '<td class="right">' + posLabel(t.pos) + '</td><td>' + aiLabel(t.ai) + '</td><td class="right">' + t.ads + '</td></tr>';
    }).join('');
    var data = '<p>По ' + sm.queries + ' целевым запросам в области ищут <b>' + C.fmt(sm.demand_chelyabinsk) + '</b> раз в месяц, по Уралу — ' + C.fmt(sm.demand_urfo) +
      ' (Яндекс Вордстат, ' + E(info.snapshot_period) + '). Сайт завода в первых 12 результатах по <b>' + sm.in_top12 + ' из ' + sm.queries + '</b>; ответ ИИ показан по ' + sm.ai_shown +
      ', завод в его источниках — по ' + sm.ai_plant + '. Рекламных блоков по этим запросам: ' + sm.ads_total + '.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Запрос</th><th class="right">Обл./мес</th><th class="right">Урал/мес</th><th class="right">Позиция</th><th>Ответ ИИ</th><th class="right">Рекл.</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small muted" style="margin:8px 0 0">Замер выдачи от ' + E((D.serp_baseline || {}).date || '') + ': одна проходка, чистый браузер, регион Челябинск. Спрос — широкое соответствие, поэтому это верхняя оценка.</p>';

    // 3. что сделано
    var a = cur.audit;
    var done = list(r.done) + '<div class="chain-sub">Нужно от завода</div>' + list(r.need_from_plant) +
      '<p class="small muted" style="margin:8px 0 0">В тексте ' + C.fmt(a.words) + ' слов, цифр на подтверждение: ' + a.claims_total + ', меток [ПОДТВЕРДИТЬ]: ' + a.open_markers + '. Статус: ' + (REVIEW[reviewStatus(cur)] || REVIEW.draft).label.toLowerCase() + '.</p>';

    // 4. что ожидаем
    var expect = '<div class="expect"><div><span class="badge real">Успех</span><p>' + E(r.success_text) + '</p></div>' +
      '<div><span class="badge demo">Провал</span><p>' + E(r.failure_text) + '</p></div>' +
      '<div><span class="badge info">Не доказано</span><p>' + E(r.middle_text) + '</p></div></div>' +
      '<p class="small muted" style="margin:8px 0 0">' + E(r.disclaimer) + '</p>';

    // 5. как проверим + живой результат
    var base = rationaleVerdictFor(r, state.serp.baseline), rep = rationaleVerdictFor(r, state.serp.repeat);
    var bv = VERDICT[base.state], rv = VERDICT[rep.state];
    var ctrl = C.controlStats(D.control_queries || [], state.serp.baseline, state.serp.repeat);
    var live = '<div class="chain-live"><div class="kv">' +
      '<dt>Исходная точка (замер ' + E((D.serp_baseline || {}).date || '') + ')</dt><dd><span class="badge ' + bv.cls + '">' + bv.label + '</span></dd>' +
      '<dt>Повторный замер</dt><dd><span class="badge ' + rv.cls + '">' + rv.label + '</span></dd>' +
      '<dt>В топ-12 по запросам критерия</dt><dd>' + (base.top12 === null ? '—' : base.top12) + ' → ' + (rep.top12 === null ? '—' : rep.top12) + ' из ' + base.of + '</dd>' +
      '<dt>Контрольная группа (' + ctrl.total + ' запросов), в топ-12</dt><dd>' + ctrl.base_top12 + ' → ' + (ctrl.rep_measured ? ctrl.rep_top12 + ' (замерено ' + ctrl.rep_measured + ')' : '—') + '</dd></div>' +
      (rep.state === 'incomplete' ? '<p class="small muted" style="margin:8px 0 0">Повторный замер: внесено ' + rep.measured + ' из ' + rep.of + ' запросов критерия. Внесите позиции в разделе «Выдача» → «Повторный замер».</p>' : '') +
      '<div class="no-print" style="margin-top:8px"><button class="btn small" data-action="go-repeat">Открыть журнал замеров</button></div></div>';
    var check = '<ol class="chain-list">' + r.check.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ol>' + live +
      '<p class="small muted" style="margin:8px 0 0">Контрольная группа — запросы замера, под которые нового материала нет. Если материалы про смету или крепёж тоже опубликуют в пилоте, их запросы нужно убрать из контроля.</p>';

    return '<div class="chain">' +
      step(1, 'Данные: что показали Вордстат и замер выдачи', data) +
      step(2, 'Вывод: зачем эта статья', '<p>' + E(r.why) + '</p>') +
      step(3, 'Что сделано', done) +
      step(4, 'Что ожидаем и когда признаем провал', expect) +
      step(5, 'Как проверим через шесть недель', check) + '</div>';
  }

  function rationaleVerdictFor(r, log) { return C.rationaleVerdict(r.rule, log); }

  function viewContent() {
    var items = allItems();
    var firstOpen = !ui.pack;
    var cur = items.filter(function (i) { return i.id === ui.pack; })[0] || items[0];
    ui.pack = cur.id;
    if (firstOpen && cur.rationale) ui.tab = 'why';
    var tabs = TABS.filter(function (t) { return t.id === 'why' ? !!cur.rationale : (t.id === 'audit' || t.id === 'claims' || cur.texts[t.id]); });
    if (!tabs.some(function (t) { return t.id === ui.tab; })) ui.tab = 'article';
    var status = reviewStatus(cur), done = claimsDone(cur);

    var listItem = function (i) {
      var s = REVIEW[reviewStatus(i)] || REVIEW.draft;
      return '<button data-action="pack" data-pack="' + i.id + '" class="' + (i.id === cur.id ? 'active' : '') + '"><b>' + E(i.title) + '</b><small>' + E(i.sub) + '</small>' +
        '<span class="badge ' + s.cls + '">' + s.label + '</span> <span class="badge neutral plain">структура ' + i.audit.geo_score + '</span></button>';
    };
    var list = '<div class="pack-list no-print"><div class="small muted" style="margin:0 0 6px">Статьи</div>' + items.filter(function (i) { return i.kind === 'pack'; }).map(listItem).join('') +
      '<div class="small muted" style="margin:14px 0 6px">Шаблонные форматы</div>' + items.filter(function (i) { return i.kind === 'template'; }).map(listItem).join('') + '</div>';

    var body;
    if (ui.tab === 'why' && cur.rationale) {
      body = rationaleBody(cur);
    } else if (ui.tab === 'audit') {
      body = '<div class="grid" style="grid-template-columns:160px minmax(0,1fr);align-items:start"><div><div class="score">' + cur.audit.geo_score + '<small> / 100</small></div>' +
        '<div class="small muted">Слов: ' + C.fmt(cur.audit.words) + '</div></div><div>' +
        cur.audit.checks.map(function (c) {
          return '<div class="check' + (c.passed ? '' : ' fail') + '"><div class="mark">' + (c.passed ? '✓' : '!') + '</div><div><b>' + E(c.title) + '</b><p>' + E(c.hint) + '</p></div><div class="small muted">' + c.weight + '</div></div>';
        }).join('') + '</div></div><p class="small muted" style="margin:14px 0 0">' + E(cur.audit.note) + '</p>';
    } else if (ui.tab === 'claims') {
      var marks = state.claims[cur.id] || {};
      body = '<div class="toolbar no-print" style="margin-bottom:10px"><b>Проверено ' + done + ' из ' + cur.audit.claims_total + '</b>' +
        '<button class="btn small" data-action="print">Печать чек-листа для инженера</button></div>' +
        '<p class="small muted print-only">Чек-лист для инженера: ' + E(cur.title) + '. Отметьте подтверждённые цифры, исправьте неверные.</p>' +
        (cur.audit.claims_to_verify.length ? cur.audit.claims_to_verify.map(function (c) {
          return '<label class="claim' + (marks[c.line] ? ' done' : '') + '"><input type="checkbox" data-change="claim" data-line="' + c.line + '"' + (marks[c.line] ? ' checked' : '') + '>' +
            '<span class="t">' + E(c.text) + '</span><span>' + (c.needs_factory_data ? '<span class="badge demo plain">данные завода</span>' : (c.norm_ref ? '<span class="badge info plain">норматив</span>' : '')) + '</span></label>';
        }).join('') : '<div class="empty">В тексте нет числовых утверждений.</div>');
    } else {
      var text = cur.texts[ui.tab] || '';
      body = '<div class="toolbar no-print" style="margin-bottom:12px"><div class="seg"><button data-action="raw" data-raw="0" class="' + (!ui.raw ? 'active' : '') + '">Просмотр</button>' +
        '<button data-action="raw" data-raw="1" class="' + (ui.raw ? 'active' : '') + '">Markdown</button></div>' +
        '<button class="btn" data-action="copy">Копировать</button><button class="btn" data-action="download-md">Скачать .md</button><button class="btn" data-action="print">Печать</button></div>' +
        (ui.raw ? '<div class="prose"><pre>' + E(text) + '</pre></div>' : '<article class="prose">' + C.mdToHtml(text) + '</article>');
    }

    var gate = '';
    if (cur.blocked) gate = '<div class="notice demo"><div><b>Публиковать нельзя</b><span>' + E(cur.blocked) + '</span></div></div>';
    else if (cur.audit.open_markers) gate = '<div class="notice demo"><div><b>Меток [ПОДТВЕРДИТЬ] в тексте: ' + cur.audit.open_markers + '</b><span>Это данные, которые есть только у завода: цены, номенклатура, условия доставки. До их заполнения текст не публикуется.</span></div></div>';
    else if (status === 'draft') gate = '<div class="notice demo"><div><b>Текст не проверен инженером</b><span>' + E(cur.review.comment || 'Цифры и ссылки на нормативы нужно подтвердить до публикации.') + '</span></div></div>';

    return head('Контент',
      'Одна тема — один пакет: статья и производные форматы. Балл оценивает структуру текста для цитирования нейросетями; достоверность подтверждает только человек.') +
      '<div class="grid split">' + list + '<div class="card"><div class="page-head" style="margin-bottom:10px"><div><h2 style="margin:0">' + E(cur.title) + '</h2>' +
      '<div class="small muted">Проверено цифр: ' + done + ' из ' + cur.audit.claims_total + '</div></div>' +
      '<div class="toolbar no-print"><label class="small muted" for="revSel">Статус</label><select id="revSel" data-change="review">' +
      Object.keys(REVIEW).map(function (k) { return '<option value="' + k + '"' + (status === k ? ' selected' : '') + '>' + REVIEW[k].label + '</option>'; }).join('') + '</select></div></div>' +
      gate + '<div class="tabs" role="tablist">' + tabs.map(function (t) {
        return '<button role="tab" data-action="tab" data-tab="' + t.id + '" class="' + (ui.tab === t.id ? 'active' : '') + '" aria-selected="' + (ui.tab === t.id) + '">' + t.title +
          (t.id === 'claims' ? ' · ' + cur.audit.claims_total : '') + '</button>';
      }).join('') + '</div>' + body + '</div></div>';
  }

  // ---------- 6. План ----------

  function viewPlan() {
    var cl = clusters();
    var weeks = [];
    PLAN_STEPS.forEach(function (s) { if (weeks.indexOf(s.week) < 0) weeks.push(s.week); });
    var done = PLAN_STEPS.filter(function (s) { return planDone(s.id); }).length;
    var hyps = D.hypotheses.slice().sort(function (a, b) {
      return (cl[b.cluster_id] || {}).total_cluster_traffic_chelyabinsk - (cl[a.cluster_id] || {}).total_cluster_traffic_chelyabinsk;
    });
    return head('План пилота на шесть недель',
      'Выполнено шагов: ' + done + ' из ' + PLAN_STEPS.length + '. Цель — получить три факта: реальный спрос, изменение позиций, число обращений. Гипотезы ниже отсортированы по спросу в области.',
      '<button class="btn" data-action="print">Печать плана</button>') +
      '<div class="card">' + weeks.map(function (w) {
        return '<h2 style="margin-top:8px">' + w + '</h2>' + PLAN_STEPS.filter(function (s) { return s.week === w; }).map(function (s) {
          return '<label class="claim' + (planDone(s.id) ? ' done' : '') + '"><input type="checkbox" data-change="plan" data-step="' + s.id + '"' + (planDone(s.id) ? ' checked' : '') + '>' +
            '<span><span class="t"><b>' + s.title + '</b></span><br><span class="small muted">' + s.text + '</span></span><span></span></label>';
        }).join('');
      }).join('') + '</div>' +
      '<h2 style="font-size:16px;margin:22px 0 10px">Гипотезы: о чём писать</h2><div class="grid g2">' +
      hyps.map(function (h) {
        var c = cl[h.cluster_id] || {};
        var st = (c.keywords || []).every(function (k) { return k.source === 'real'; }) ? 'real' : ((c.keywords || []).some(function (k) { return k.source !== 'demo'; }) ? 'partial' : 'demo');
        return '<div class="card" style="margin:0"><div class="page-head" style="margin-bottom:8px"><h2 style="margin:0">' + E(h.title) + '</h2>' + badge(st) + '</div>' +
          '<p style="margin:0 0 10px" class="muted">' + E(h.premise) + '</p>' +
          '<dl class="kv" style="margin-bottom:10px"><dt>Спрос по области</dt><dd>' + C.fmt(c.total_cluster_traffic_chelyabinsk) + ' запросов/мес</dd><dt>Спрос по Уралу</dt><dd>' + C.fmt(c.total_cluster_traffic) + '</dd></dl>' +
          '<div class="chips">' + (h.core_queries_to_test || []).map(function (q) { return '<span class="chip">' + E(q) + '</span>'; }).join('') + '</div>' +
          '<p class="small" style="margin:10px 0 0"><b>Цель:</b> ' + E(h.commercial_goal) + '</p></div>';
      }).join('') + '</div>';
  }

  // ---------- отрисовка ----------

  var RENDER = { overview: viewOverview, demand: viewDemand, serp: viewSerp, economy: viewEconomy, content: viewContent, plan: viewPlan };

  function render(keepScroll) {
    var y = window.scrollY;
    renderNav();
    $('main').innerHTML = RENDER[ui.view]();
    document.title = VIEWS.filter(function (v) { return v.id === ui.view; })[0].title + ' — GEO Factory';
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }

  function rerenderKeepFocus() {
    setTimeout(function () {
      var a = document.activeElement, fid = a && a.getAttribute ? a.getAttribute('data-fid') : null;
      render(true);
      if (fid) {
        var els = document.querySelectorAll('[data-fid]');
        for (var i = 0; i < els.length; i++) if (els[i].getAttribute('data-fid') === fid) { els[i].focus(); break; }
      }
    }, 0);
  }

  function currentItem() { return allItems().filter(function (i) { return i.id === ui.pack; })[0]; }

  // ---------- события ----------

  var ACTIONS = {
    go: function (el) { ui.view = el.getAttribute('data-view'); render(); },
    theme: function () { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); renderNav(); },
    print: function () { window.print(); },
    region: function (el) { ui.region = el.getAttribute('data-region'); render(true); },
    round: function (el) { ui.serpRound = el.getAttribute('data-round'); render(true); },
    'go-repeat': function () { ui.view = 'serp'; ui.serpRound = 'repeat'; render(); },
    pack: function (el) {
      ui.pack = el.getAttribute('data-pack');
      var it = currentItem();
      ui.tab = it && it.rationale ? 'why' : 'article';
      render();
    },
    tab: function (el) { ui.tab = el.getAttribute('data-tab'); render(true); },
    raw: function (el) { ui.raw = el.getAttribute('data-raw') === '1'; render(true); },
    copy: function () { copyText(currentItem().texts[ui.tab] || ''); },
    'download-md': function () { download(ui.pack + '_' + ui.tab + '.md', currentItem().texts[ui.tab] || '', 'text/markdown;charset=utf-8'); },
    'csv-template': function () { download('wordstat_real.csv', C.buildTemplateCsv(clusters()), 'text/csv;charset=utf-8'); toast('Заполните колонки с частотами и загрузите файл обратно'); },
    'csv-import': function () { $('fileCsv').click(); },
    'freq-reset': function () {
      if (!window.confirm('Удалить все введённые частоты и вернуть демо-оценку?')) return;
      state.overrides = {}; save(); render(true);
    },
    'funnel-reset': function () { state.funnel = Object.assign({ unique_share: 60 }, D.funnel_defaults, { annual_shipment_m3: state.funnel.annual_shipment_m3 }); save(); render(true); },
    scenario: function (el) {
      var s = C.SCENARIOS[el.getAttribute('data-scenario')];
      ['ctr_target', 'visit_to_lead', 'lead_to_deal', 'unique_share'].forEach(function (k) { state.funnel[k] = s[k]; });
      save(); render(true); toast('Применён сценарий «' + s.label + '»');
    },
    'serp-csv': function () {
      var q = function (s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; };
      var lines = ['query;round;position;neuro;top1;date'];
      ['baseline', 'repeat'].forEach(function (r) {
        D.serp_queries.forEach(function (x) {
          var e = state.serp[r][x.query];
          if (e) lines.push([q(x.query), r, e.pos || '', e.neuro || '', q(e.top), e.date || ''].join(';'));
        });
      });
      download('serp_log.csv', '﻿' + lines.join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
    },
    'export-state': function () {
      download('geo_factory_' + C.today().split('.').reverse().join('-') + '.json', JSON.stringify(state, null, 2), 'application/json');
      toast('Файл сохранён. Его можно загрузить на другом компьютере');
    },
    'import-state': function () { $('fileState').click(); }
  };

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;
    var fn = ACTIONS[el.getAttribute('data-action')];
    if (fn) fn(el);
  });

  document.addEventListener('toggle', function (ev) {
    var d = ev.target;
    if (d && d.classList && d.classList.contains('cluster') && !ui.filter) ui.openClusters[d.getAttribute('data-cluster')] = d.open;
  }, true);

  document.addEventListener('change', function (ev) {
    var el = ev.target, kind = el.getAttribute && el.getAttribute('data-change');
    if (!kind) return;
    if (kind === 'freq') {
      var key = el.getAttribute('data-phrase').trim().toLowerCase();
      var base = baseKeyword(key), isReal = base && base.source === 'real';
      var o = state.overrides[key] || { chel: isReal ? base.frequency_chelyabinsk : null, urfo: isReal ? base.frequency_urfo : null, date: '' };
      o[el.getAttribute('data-field')] = C.toInt(el.value);
      if (o.chel === null && o.urfo === null) delete state.overrides[key];
      else { o.date = C.today(); state.overrides[key] = o; }
      save(); rerenderKeepFocus();
    } else if (kind === 'serp') {
      var log = state.serp[ui.serpRound], q = el.getAttribute('data-query');
      var e = log[q] || {};
      e[el.getAttribute('data-field')] = el.value;
      if (!e.pos && !e.neuro && !e.top) delete log[q];
      else { e.date = C.today(); delete e.auto; log[q] = e; }
      save();
      if (el.tagName === 'SELECT') render(true); else renderNav();
    } else if (kind === 'claim') {
      var m = state.claims[ui.pack] || (state.claims[ui.pack] = {});
      if (el.checked) m[el.getAttribute('data-line')] = true; else delete m[el.getAttribute('data-line')];
      save(); render(true);
    } else if (kind === 'plan') {
      if (el.checked) state.plan[el.getAttribute('data-step')] = true; else delete state.plan[el.getAttribute('data-step')];
      save(); render(true);
    } else if (kind === 'review') {
      var item = currentItem();
      if ((el.value === 'approved' || el.value === 'published') && (item.audit.open_markers || item.blocked)) {
        toast('Сначала закройте метки [ПОДТВЕРДИТЬ] и неподтверждённые данные');
        el.value = reviewStatus(item);
        return;
      }
      state.review[ui.pack] = el.value; save(); render(true);
    } else if (kind === 'funnel-confirm') {
      state.funnel.confirmed = !!el.checked; save(); render(true);
    } else if (kind === 'funnel-select') {
      state.funnel[el.getAttribute('data-field')] = el.value; save();
      $('ecoOut').innerHTML = economyOut(); renderNav();
    }
  });

  document.addEventListener('input', function (ev) {
    var el = ev.target, kind = el.getAttribute && el.getAttribute('data-input');
    if (kind === 'filter') {
      ui.filter = el.value;
      $('semList').innerHTML = clusterList(clusters());
    } else if (kind === 'funnel') {
      var field = el.getAttribute('data-field'), v = parseFloat(el.value);
      state.funnel[field] = isFinite(v) ? v : 0;
      var twins = document.querySelectorAll('[data-input="funnel"][data-field="' + field + '"]');
      for (var i = 0; i < twins.length; i++) if (twins[i] !== el) twins[i].value = el.value;
      save();
      $('ecoOut').innerHTML = economyOut();
      var ct = $('costTotal'); if (ct) ct.innerHTML = 'Итого затрат: <b>' + C.fmtMoney(C.pilotCost(state.funnel)) + '</b>';
    }
  });

  function readFile(input, cb) {
    var file = input.files && input.files[0];
    if (!file) return;
    var r = new FileReader();
    r.onload = function () { cb(String(r.result)); input.value = ''; };
    r.onerror = function () { toast('Не удалось прочитать файл'); input.value = ''; };
    r.readAsText(file, 'utf-8');
  }

  $('fileCsv').addEventListener('change', function () {
    readFile(this, function (text) {
      var res = C.parseWordstatCsv(text);
      if (res.error) { toast(res.error); return; }
      var known = {}, matched = 0;
      Object.keys(D.semantics.clusters).forEach(function (k) { D.semantics.clusters[k].keywords.forEach(function (kw) { known[kw.phrase.trim().toLowerCase()] = true; }); });
      Object.keys(res.rows).forEach(function (phrase) {
        if (!known[phrase]) return;
        var r = res.rows[phrase];
        state.overrides[phrase] = { chel: r.chel, urfo: r.urfo, date: r.date || C.today() };
        matched++;
      });
      save(); render(true);
      toast(matched ? 'Загружено частот: ' + matched + (res.count > matched ? '. Не совпало с ядром: ' + (res.count - matched) : '') : 'Ни одна фраза из файла не совпала с ядром');
    });
  });

  $('fileState').addEventListener('change', function () {
    readFile(this, function (text) {
      try {
        var fresh = defaultState();
        mergeState(fresh, JSON.parse(text));
        state = fresh; save(); render();
        toast('Данные загружены из файла');
      } catch (e) { toast('Файл не похож на сохранение GEO Factory'); }
    });
  });

  render();
})();
