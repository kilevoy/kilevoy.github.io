const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat,
  ExternalHyperlink, BorderStyle, TabStopType, TabStopPosition, HeadingLevel,
} = require("docx");

const ACCENT = "2E5BBA";
const MUTED = "555555";

// ── helpers ──
const heading = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 2 } },
    children: [new TextRun({ text, bold: true, color: ACCENT, font: "Arial", size: 24 })],
  });

const bullet = (children) =>
  new Paragraph({ numbering: { reference: "b", level: 0 }, spacing: { after: 70 }, children });

const t = (text, opts = {}) => new TextRun({ text, font: "Arial", ...opts });

// project bullet: bold name + dash + rest + (tech in muted italic)
const project = (name, rest, tech) =>
  bullet([
    t(name, { bold: true }),
    t(" — " + rest),
    ...(tech ? [t("  " + tech, { italics: true, color: MUTED, size: 19 })] : []),
  ]);

// job entry: company (bold) + title, dates right-aligned
const job = (company, title, dates) =>
  new Paragraph({
    spacing: { before: 120, after: 30 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      t(company, { bold: true }),
      t("   " + title, { color: MUTED }),
      t("\t" + dates, { color: MUTED, size: 19 }),
    ],
  });

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } }, // 10.5pt
    paragraphStyles: [
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [{
      reference: "b",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 220 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    children: [
      // ── Header ──
      new Paragraph({
        spacing: { after: 20 },
        children: [t("РЫКУНОВ АНДРЕЙ НИКОЛАЕВИЧ", { bold: true, size: 36 })],
      }),
      new Paragraph({
        spacing: { after: 80 },
        children: [t("AI-автоматизация бизнес-процессов", { color: ACCENT, size: 24, bold: true })],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [
          t("Челябинск · +7 919 343-48-71 · "),
          new ExternalHyperlink({ link: "mailto:rykunov@gmail.com", children: [new TextRun({ text: "rykunov@gmail.com", style: "Hyperlink", font: "Arial" })] }),
          t(" · "),
          new ExternalHyperlink({ link: "https://t.me/rykunov", children: [new TextRun({ text: "Telegram @rykunov", style: "Hyperlink", font: "Arial" })] }),
        ],
      }),
      new Paragraph({
        spacing: { after: 40 },
        children: [
          t("Портфолио: "),
          new ExternalHyperlink({ link: "https://kilevoy.github.io/", children: [new TextRun({ text: "kilevoy.github.io", style: "Hyperlink", font: "Arial" })] }),
          t("   ·   GitHub: "),
          new ExternalHyperlink({ link: "https://github.com/kilevoy", children: [new TextRun({ text: "github.com/kilevoy", style: "Hyperlink", font: "Arial" })] }),
        ],
      }),

      // ── Профиль ──
      heading("Профиль"),
      new Paragraph({
        spacing: { after: 90 },
        children: [t("Коммерческий руководитель с 26-летним опытом в B2B, который автоматизирует бизнес-процессы с помощью ИИ и кода. Прошёл путь от менеджера по продажам до заместителя коммерческого директора: команды до 85 человек, годовой план до 1 млрд ₽, управленческая аналитика и Power BI. Сочетаю управленческий опыт с практическими навыками разработки — от Python-парсеров и Telegram-ботов до веб-приложений и AI-пайплайнов, которые убирают ручную рутину.")],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [t("Моё отличие от типичного разработчика — я 26 лет управлял теми процессами, которые автоматизирую, и точно знаю, где бизнес теряет время и деньги.", { bold: true })],
      }),

      // ── Ключевые проекты ──
      heading("Ключевые проекты (AI и автоматизация)"),
      new Paragraph({
        spacing: { after: 100 },
        children: [t("Автоматизацию начал с собственной рутины и рутины менеджеров отдела продаж — с инженерных калькуляторов, заменивших ручные расчёты в Excel.", { italics: true, color: MUTED })],
      }),
      project("Инженерные калькуляторы", "подбор и расчёты (ЛСТК-профили, металлокаркас, фасадные кассеты, климат по СП), которые менеджеры раньше вели вручную в Excel — теперь в пару кликов и без ошибок. Реально ускорили работу отдела продаж.", "TypeScript / React, живые демо"),
      project("AI-ассистент совещаний", "«аудио → протокол + единый реестр поручений с контролем сроков». 40 минут ручной работы → 60 секунд.", "Whisper + LLM + Google Docs/Sheets, демо + код"),
      project("Парсер конкурентной разведки", "автоматический сбор и сравнение каталога и цен конкурентов в e-commerce.", "Python"),
      project("Трекер прайсов из PDF", "автообновление и сравнение прайсов поставщика без ручного переноса цифр.", "Python + PyMuPDF"),
      project("AI-аудитор договоров", "Telegram-бот находит юридические риски в договоре за минуты вместо часов ручной вычитки.", "n8n + OpenRouter"),
      project("B2B-дашборд", "продажи, маржа, склад и дебиторка в одной панели для управленческих решений.", "React + Recharts"),

      // ── Технологии ──
      heading("Технологии"),
      new Paragraph({
        spacing: { after: 60 },
        children: [t("AI/LLM (OpenRouter, Ollama) · Python · TypeScript/React · n8n · Telegram Bot API · Google API · парсинг PDF/web · Power BI · 1С/CRM (MS Dynamics, amoCRM) · B2B-аналитика продаж")],
      }),

      // ── Опыт работы ──
      heading("Опыт работы"),
      job("ООО «ИНСИ-Стальные конструкции»", "Заместитель коммерческого директора", "апрель 2008 — наст. время"),
      new Paragraph({ spacing: { after: 50 }, children: [t("Стройматериалы и металлоконструкции, B2B. Зоны ответственности в разные периоды: дивизионы Урал и Запад, направления «Кровля» и «Кровля и фасады».", { color: MUTED, size: 19 })] }),
      bullet([t("Команды до 85 человек, годовой план продаж до 1 млрд ₽, участие в запуске 12 филиалов")]),
      bullet([t("Разработал и внедрил управленческие Power BI-дашборды — основной инструмент совещаний по продажам в 2016–2025")]),
      bullet([t("Анализ продаж, план-факт, маржинальность, ценообразование и конкурентная среда по регионам, филиалам и продуктовым группам")]),
      bullet([t("Управленческая отчётность для руководителей; CRM-дисциплина (MS Dynamics, 1C, amoCRM), работа с большими данными из 1С и Excel")]),
      bullet([t("Применяю AI-инструменты для анализа рынка, подготовки отчётов и автоматизации рутинных аналитических задач")]),

      job("ЗАО ТД «Уралтрубосталь» (ЧТПЗ)", "Начальник отдела продаж", "2005 — 2008"),
      new Paragraph({ spacing: { after: 50 }, children: [t("Торговое подразделение ЧТПЗ, сбыт трубной продукции.", { color: MUTED, size: 19 })] }),
      bullet([t("Руководство продажами, ключевыми клиентами и развитием клиентской базы")]),
      bullet([t("Прогнозные и оперативные планы продаж, организация работы отдела, подбор и обучение менеджеров, переговоры с первыми лицами компаний")]),

      job("ОАО «Челябинский трубопрокатный завод»", "Начальник отдела продаж", "2003 — 2005"),
      bullet([t("Развитие продаж трубной продукции одного из крупнейших производителей РФ, переговоры с ключевыми заказчиками, координация коммерческой работы по направлению")]),

      job("ОАО «ЧЗПСН-Профнастил»", "от менеджера по продажам до директора центра продаж", "2000 — 2003"),
      bullet([t("Карьерный рост от менеджера до директора центра продаж; управление сбытовой структурой завода и филиалов, продажи профнастила, металлочерепицы и панелей, участие в открытии филиалов и развитии партнёрской сети")]),

      // ── Образование ──
      heading("Образование"),
      bullet([t("ЮУрГУ (Южно-Уральский гос. университет)", { bold: true }), t(" — Экономика и управление на предприятии, 2006")]),
      bullet([t("Университет Российской академии образования (Москва)", { bold: true }), t(" — Юридический факультет, 1998")]),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("Резюме_Рыкунов_AI-автоматизация.docx", buf);
  console.log("DOCX created");
});
