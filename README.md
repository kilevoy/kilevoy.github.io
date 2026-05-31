# kilevoy.github.io — Портфолио

Сайт-портфолио Андрея Рыкунова: AI-автоматизация бизнес-процессов.
React + TypeScript + Vite. Деплой на GitHub Pages (включается при запуске).

## Структура

```
.
├── src/            — исходники сайта (App, data, styles)
├── resume/         — резюме (генератор DOCX + готовые DOCX/PDF)
├── index.html
└── vite.config.ts
```

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## Резюме

В папке `resume/`:
- `generate.js` — генератор DOCX (Node + docx)
- `Резюме_Рыкунов_AI-автоматизация.docx` / `.pdf` — готовые файлы

Пересборка: `cd resume && node generate.js`, затем экспорт в PDF.

## Статус

Черновик. Репозиторий приватный — используется как бэкап и история работы.
Публикация (public + GitHub Pages) — при готовности.
