// Профиль и кейсы портфолио. Тексты — черновик, согласуем.

export const profile = {
  name: "Андрей Рыкунов",
  handle: "Андрей Рыкунов",
  tagline: "Автоматизирую рутину бизнеса с помощью ИИ",
  subtitle:
    "Коммерческий руководитель с 26-летним опытом в B2B · превращаю ручные процессы в работающие приложения",
  github: "https://github.com/kilevoy",
  email: "rykunov@gmail.com",
  phone: "+7 919 343-48-71",
  telegram: "https://t.me/rykunov",
  location: "Челябинск",
  hh: "", // TODO: ссылка на резюме hh.ru
  resumePdf: "Rykunov-AI-Automation-CV.pdf",
};

// Краткие факты для блока «Резюме»
export const highlights = [
  "26 лет в B2B-коммерции — от менеджера до заместителя коммерческого директора",
  "Команды до 85 человек, годовой план продаж до 1 млрд ₽, запуск 12 филиалов",
  "Power BI-дашборды как основной инструмент совещаний по продажам в 2016–2025",
  "Сегодня — AI-агенты, парсеры и веб-приложения, убирающие ручную рутину",
];

export interface Case {
  title: string;
  category: "AI-автоматизация" | "Калькуляторы" | "Python-автоматизация" | "Аналитика";
  outcome: string; // бизнес-результат: рутина → польза
  tech: string[];
  demo?: string;
  code?: string;
  status: "Готов" | "MVP" | "В разработке";
  flagship?: boolean;
}

export const cases: Case[] = [
  {
    title: "AI-ассистент совещаний",
    category: "AI-автоматизация",
    outcome:
      "Из аудиозаписи совещания — готовый протокол и единый реестр поручений с контролем сроков. 40 минут ручной работы → 60 секунд.",
    tech: ["Python", "Whisper", "LLM", "Google Docs/Sheets", "React"],
    demo: "https://kilevoy.github.io/ai-meeting-tasks/",
    code: "https://github.com/kilevoy/ai-meeting-tasks",
    status: "MVP",
    flagship: true,
  },
  {
    title: "AI-аудитор договоров",
    category: "AI-автоматизация",
    outcome:
      "Загрузка договора → юридический риск-аудит с позиции твоей стороны: риск-скор, критичные риски и готовый протокол разногласий. Минуты вместо часов вычитки.",
    tech: ["Python", "LLM", "pypdf / docx", "React", "n8n (прототип)"],
    demo: "https://kilevoy.github.io/ai-contract-auditor/",
    code: "https://github.com/kilevoy/ai-contract-auditor",
    status: "MVP",
    flagship: true,
  },
  {
    title: "B2B-дашборд продаж и склада",
    category: "Аналитика",
    outcome:
      "Продажи, маржа, склад и дебиторка автозапчастей в одной панели — управленческие решения по данным, а не по ощущениям.",
    tech: ["TypeScript", "React", "Vite", "Recharts"],
    demo: "https://kilevoy.github.io/dashboard/",
    code: "https://github.com/kilevoy/dashboard",
    status: "Готов",
    flagship: true,
  },
  {
    title: "Калькулятор ЛСТК-профилей",
    category: "Калькуляторы",
    outcome:
      "Подбор и расчёт ЛСТК-профилей, который раньше вели вручную в Excel — теперь в пару кликов, без ошибок.",
    tech: ["TypeScript", "React", "Vite", "Tailwind"],
    demo: "https://kilevoy.github.io/gps/",
    code: "https://github.com/kilevoy/gps",
    status: "Готов",
  },
  {
    title: "Подбор металлокаркаса",
    category: "Калькуляторы",
    outcome:
      "Автоматический подбор металлокаркаса и ограждающих конструкций по параметрам объекта — расчёт за секунды.",
    tech: ["TypeScript", "React", "Vitest", "Playwright"],
    demo: "https://kilevoy.github.io/insi-next/",
    code: "https://github.com/kilevoy/insi-next",
    status: "Готов",
  },
  {
    title: "Климатический атлас по СП",
    category: "Калькуляторы",
    outcome:
      "Климатические данные по СП для любого населённого пункта — мгновенно и офлайн (PWA), вместо поиска по таблицам.",
    tech: ["JavaScript", "JSON", "PWA"],
    demo: "https://kilevoy.github.io/climate-sp-atlas/",
    code: "https://github.com/kilevoy/climate-sp-atlas",
    status: "Готов",
  },
  {
    title: "Парсер конкурентной разведки",
    category: "Python-автоматизация",
    outcome:
      "Автоматический сбор и сравнение каталога и цен конкурентов в e-commerce — разведка без ручного мониторинга.",
    tech: ["Python", "Requests", "BeautifulSoup", "Tkinter"],
    demo: "https://kilevoy.github.io/one-chip-parser/",
    code: "https://github.com/kilevoy/one-chip-parser",
    status: "Готов",
  },
  {
    title: "Трекер прайсов поставщика",
    category: "Python-автоматизация",
    outcome:
      "Автообновление и сравнение прайсов Металл Профиль прямо из PDF — без ручного переноса цифр.",
    tech: ["Python", "PyMuPDF", "JSON"],
    demo: "https://kilevoy.github.io/-metallprofil-price-tracker/",
    code: "https://github.com/kilevoy/-metallprofil-price-tracker",
    status: "Готов",
  },
];

export const skills = [
  "AI / LLM (OpenRouter, Ollama)",
  "Python",
  "TypeScript / React",
  "n8n / автоматизация",
  "Telegram Bot API",
  "Google API (Docs/Sheets)",
  "Парсинг (PDF, web)",
  "Power BI / дашборды",
  "1С / CRM (Dynamics, amoCRM)",
  "B2B-аналитика продаж",
];
