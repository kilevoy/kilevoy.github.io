import { useState, useEffect } from "react";
import { profile, cases, skills, highlights, type Case } from "./data";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light"; // дефолт — светлая
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      title={theme === "light" ? "Тёмная тема" : "Светлая тема"}
      aria-label="Переключить тему"
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}

export default function App() {
  return (
    <div className="page">
      <Nav />
      <Hero />
      <Cases />
      <About />
      <Resume />
      <Contact />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="nav">
      <a href="#top" className="nav-logo">
        {profile.handle}
      </a>
      <div className="nav-links">
        <a href="#cases">Кейсы</a>
        <a href="#about">Обо мне</a>
        <a href="#resume">Резюме</a>
        <a href="#contact">Контакты</a>
        <a href={profile.github} target="_blank" rel="noreferrer" className="nav-gh">
          GitHub
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="hero" id="top">
      <div className="badge">AI-автоматизация бизнес-процессов</div>
      <h1>
        {profile.tagline.split("ИИ")[0]}
        <span className="grad">ИИ</span>
      </h1>
      <p className="lead">{profile.subtitle}</p>
      <div className="hero-cta">
        <a className="btn primary" href="#cases">
          Смотреть кейсы
        </a>
        <a className="btn ghost" href="#contact">
          Связаться
        </a>
      </div>
      <div className="hero-stats">
        <div>
          <b>26 лет</b>
          <span>в B2B-коммерции</span>
        </div>
        <div>
          <b>{cases.length}+</b>
          <span>внедрённых решений</span>
        </div>
        <div>
          <b>AI</b>
          <span>агенты и пайплайны</span>
        </div>
      </div>
    </header>
  );
}

function Cases() {
  const cats = ["Все", "AI-автоматизация", "Калькуляторы", "Python-автоматизация", "Аналитика"];
  const [active, setActive] = useState("Все");
  const shown = active === "Все" ? cases : cases.filter((c) => c.category === active);

  return (
    <section className="cases" id="cases">
      <h2>Кейсы</h2>
      <p className="section-sub">
        Реальные задачи бизнеса, превращённые в работающие приложения. У большинства —
        живое демо: можно открыть и протестировать.
      </p>

      <div className="filters">
        {cats.map((c) => (
          <button
            key={c}
            className={`filter ${active === c ? "on" : ""}`}
            onClick={() => setActive(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid">
        {shown.map((c, i) => (
          <CaseCard key={i} c={c} />
        ))}
      </div>
    </section>
  );
}

function CaseCard({ c }: { c: Case }) {
  return (
    <article className={`ccard ${c.flagship ? "flag" : ""}`}>
      <div className="ccard-top">
        <span className="cat">{c.category}</span>
        <span className={`stat st-${c.status === "Готов" ? "ok" : c.status === "MVP" ? "mvp" : "wip"}`}>
          {c.status}
        </span>
      </div>
      <h3>{c.title}</h3>
      <p className="outcome">{c.outcome}</p>
      <div className="tags">
        {c.tech.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <div className="ccard-links">
        {c.demo && (
          <a href={c.demo} target="_blank" rel="noreferrer" className="lnk demo">
            ▶ Открыть демо
          </a>
        )}
        {c.code && (
          <a href={c.code} target="_blank" rel="noreferrer" className="lnk code">
            Код
          </a>
        )}
        {!c.demo && !c.code && <span className="lnk muted">Portfolio case</span>}
      </div>
    </article>
  );
}

function About() {
  return (
    <section className="about" id="about">
      <h2>Обо мне</h2>
      <div className="about-grid">
        <div className="about-text">
          <p>
            26 лет в B2B-коммерции — строительные материалы и металлоконструкции.
            Замкоммерческого директора, команды до 85 человек, годовой план продаж
            до 1 млрд ₽, запуск 12 филиалов. Power BI-дашборды, которые с 2016 по
            2025 год были основным инструментом совещаний по продажам.
          </p>
          <p>
            Изнутри знаю, где бизнес теряет время на рутине: ручные расчёты, перенос
            данных из 1С и PDF, протоколы совещаний, мониторинг конкурентов. Сегодня
            закрываю эти задачи кодом и ИИ — от инженерных калькуляторов и парсеров
            до AI-агентов, которые слушают совещания и ставят задачи.
          </p>
          <p className="about-edge">
            Моё преимущество — я автоматизирую бизнес не в вакууме. Я 26 лет
            управлял этими процессами и знаю, где настоящая боль.
          </p>
        </div>
        <div className="about-skills">
          <h4>Стек и навыки</h4>
          <div className="chips">
            {skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Resume() {
  return (
    <section className="resume" id="resume">
      <h2>Резюме</h2>
      <p className="section-sub">
        Коммерческий руководитель, который сам строит инструменты автоматизации.
        Кратко — главное:
      </p>
      <div className="resume-card">
        <ul className="resume-hl">
          {highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
        <div className="resume-actions">
          <a className="btn primary" href="resume.html" target="_blank" rel="noreferrer">
            Открыть резюме →
          </a>
          <a className="btn ghost" href="resume.pdf" download>
            Скачать PDF
          </a>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="contact" id="contact">
      <h2>Контакты</h2>
      <p className="section-sub">
        Открыт к предложениям по автоматизации и AI-разработке.
      </p>
      <div className="contact-links">
        <a href={profile.github} target="_blank" rel="noreferrer" className="btn ghost">
          GitHub
        </a>
        {profile.email && (
          <a href={`mailto:${profile.email}`} className="btn ghost">
            Email
          </a>
        )}
        {profile.telegram && (
          <a href={profile.telegram} target="_blank" rel="noreferrer" className="btn ghost">
            Telegram
          </a>
        )}
        {profile.hh && (
          <a href={profile.hh} target="_blank" rel="noreferrer" className="btn ghost">
            hh.ru
          </a>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p>
        © {new Date().getFullYear()} {profile.handle} · Портфолио по
        AI-автоматизации бизнес-процессов
      </p>
    </footer>
  );
}
