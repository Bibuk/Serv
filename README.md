# 2LTP — Корпоративный IT-портал управления задачами

Дипломный проект по специальности 09.02.07 «Информационные системы и программирование»,
ЧУПО «Высшая школа предпринимательства» (Тверь, 2026).

Веб-приложение для автоматизации процессов IT-отдела: управление задачами, подзадачами,
тикетами (заявками от сотрудников), командами и IT-сервисами компании. Реализованы два
независимых портала — **внутренний** (для IT-специалистов) и **клиентский** (для
сотрудников-неспециалистов, подающих заявки).

---

## Технологический стек

| Уровень | Технологии |
|---|---|
| Серверная часть | Python 3.11, FastAPI 0.111, SQLAlchemy 2.0 (async), asyncpg |
| База данных | PostgreSQL 15 |
| Фоновые задачи | Celery 5.3, Celery Beat, Redis 7 |
| Аутентификация | JWT (httpOnly cookies), python-jose, passlib/bcrypt |
| Интерфейс | React 19, TypeScript 6, Ant Design 6, Zustand, React Query |
| Сборка фронтенда | Vite 8 |
| Контейнеризация | Docker, Docker Compose (6 сервисов), Nginx |

---

## Скриншоты интерфейса

### Вход в систему

![Вход в систему](docs/screenshots/login.png)

Единая страница входа для обоих порталов. Аутентификация по корпоративной почте и паролю.

### Дашборд менеджера

![Дашборд менеджера](docs/screenshots/manager_dashboard.png)

Сводка по задачам: активные, на проверке, завершённые. Быстрое создание задачи и
назначение команды.

### Доска тимлида

![Доска тимлида](docs/screenshots/teamlead_dashboard.png)

Задачи команды, декомпозиция на подзадачи, назначение исполнителей, контроль статусов.

### Экран работника

![Экран работника](docs/screenshots/worker_screen.png)

Список назначенных подзадач, смена статуса, комментарии, вложения.

### Карточка задачи

![Карточка задачи](docs/screenshots/task_drawer.png)

Полная информация: описание, подзадачи, внутренние комментарии, история изменений (аудит),
вложенные файлы.

### Тикеты — вид менеджера

![Список тикетов](docs/screenshots/manager_tickets.png)

Входящие заявки от сотрудников, назначение приоритета, связь тикета с задачей.

### Аналитика

![Аналитика](docs/screenshots/analytics.png)

Графики нагрузки по командам, SLA-метрики, динамика закрытых задач.

### Административный раздел

![Администрирование](docs/screenshots/admin_screen.png)

Управление пользователями, командами, сервисами и приложениями. Журнал аудита.

### Клиентский портал — список заявок

![Заявки клиента](docs/screenshots/client_tickets.png)

Сотрудник видит свои обращения, их статус и историю переписки с IT-отделом.

### Клиентский портал — создание заявки

![Создание заявки](docs/screenshots/client_create_ticket.png)

Выбор сервиса, приложения, описание проблемы, прикрепление файлов.

---

## Функциональность

- **Ролевая модель** — `admin | manager | teamlead | worker | client`.
- **Жизненный цикл задачи** — `draft → assigned → inprog → review → done → archive`
  (с возможностью `reject` на любом этапе).
- **Декомпозиция** — задачи делятся на подзадачи со статусами `todo | inprog | blocked | done`.
- **Тикеты** — заявки от сотрудников-клиентов, привязываются к задачам IT-отдела.
- **Команды и сервисы** — 6 команд (Frontend, Backend, QA, DevOps, Mobile, Data/BI),
  справочник IT-сервисов и приложений.
- **Вложения** — файлы к задачам и тикетам.
- **WebSocket-уведомления** — мгновенные оповещения при смене статусов.
- **Аналитика** — серверные агрегаты: нагрузка по командам, SLA, динамика.
- **Аудит** — журнал всех действий над задачами.
- **Два портала** — разные сборки фронтенда для IT-специалистов и сотрудников.

---

## Структура репозитория

```
/
├── backend/
│   ├── app/
│   │   ├── models/        # ORM-модели (User, Task, Subtask, Ticket, Team, ...)
│   │   ├── routers/       # API-маршруты (tasks, tickets, users, analytics, ...)
│   │   ├── schemas/       # Pydantic-схемы запросов и ответов
│   │   ├── services/      # Бизнес-логика, файловое хранилище, уведомления
│   │   ├── tasks/         # Celery-задачи (email, scheduled)
│   │   ├── seed.py        # Наполнение БД тестовыми данными
│   │   └── main.py        # Точка входа FastAPI
│   ├── alembic/           # Миграции базы данных (001 → 007)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── app/
│       ├── src/
│       │   ├── api/       # HTTP-клиент, хуки запросов, DTO/маппинг
│       │   ├── screens/   # Экраны по ролям (manager, teamlead, worker, client, admin)
│       │   ├── shells/    # Оболочки порталов (Internal / Client)
│       │   ├── components/# Переиспользуемые компоненты
│       │   ├── store/     # Zustand-хранилища
│       │   └── App.tsx
│       ├── Dockerfile
│       └── package.json
├── docs/
│   ├── screenshots/       # Скриншоты интерфейса (см. раздел выше)
│   └── erd.png            # ERD-диаграмма базы данных
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## Модель данных

База данных содержит 13 таблиц, приведённых к третьей нормальной форме.
ERD-диаграмма: [`docs/erd.png`](docs/erd.png).

Основные сущности:

- `users` — учётные записи сотрудников (роли, команды)
- `teams` — команды IT-отдела
- `tasks` / `subtasks` — задачи и подзадачи с полным циклом статусов
- `tickets` — заявки от сотрудников-клиентов
- `services` / `applications` — справочник IT-сервисов и приложений
- `comments` — комментарии к задачам и тикетам (внутренние и клиентские)
- `file_attachments` — вложения к задачам и тикетам
- `notifications` — уведомления пользователей
- `audit_log` — журнал действий

---

## Требования для запуска

- **Docker** >= 24.0 и **Docker Compose** >= 2.20
- Свободные порты: `3000`, `3001`, `8000`
- Минимум 2 ГБ свободной оперативной памяти

---

## Развёртывание через Docker Compose

Проект запускается одной командой — Docker Compose поднимает 6 сервисов:
`postgres`, `redis`, `backend`, `celery-worker`, `celery-beat`, `frontend-internal`, `frontend-client`.

### Шаг 1. Клонировать репозиторий

```bash
git clone https://github.com/Bibuk/fix2.git
cd fix2
```

### Шаг 2. Создать файл окружения

```bash
cp .env.example .env
```

Открыть `.env` и заполнить переменные:

```env
# База данных
POSTGRES_PASSWORD=ваш_пароль_postgres
POSTGRES_DB=twoltp
DATABASE_URL=postgresql+asyncpg://postgres:ваш_пароль_postgres@postgres:5432/twoltp

# Redis
REDIS_PASSWORD=ваш_пароль_redis
REDIS_URL=redis://:ваш_пароль_redis@redis:6379/0

# JWT — любая случайная строка длиной не менее 32 символов
SECRET_KEY=замените_на_случайную_строку_минимум_32_символа

# При первом запуске автоматически наполнит БД тестовыми данными
SEED_ON_START=true
```

> Сгенерировать надёжный `SECRET_KEY`:
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(64))"
> ```

### Шаг 3. Собрать образы

```bash
docker compose build
```

Первая сборка занимает 3–5 минут (загрузка зависимостей Python и Node.js).

### Шаг 4. Запустить все сервисы

```bash
docker compose up -d
```

При первом запуске backend автоматически:
1. применяет миграции базы данных (`alembic upgrade head`);
2. наполняет БД тестовыми данными (если `SEED_ON_START=true`).

### Шаг 5. Проверить, что всё работает

```bash
docker compose ps
```

Все сервисы должны показывать статус `running`. Затем открыть в браузере:

| Портал | Адрес | Описание |
|---|---|---|
| Внутренний | http://localhost:3000 | IT-специалисты (manager, teamlead, worker, admin) |
| Клиентский | http://localhost:3001 | Сотрудники-заявители (client) |
| API / Swagger UI | http://localhost:8000/docs | Документация REST API |

### Остановка и перезапуск

```bash
# Остановить (данные сохраняются в volumes)
docker compose down

# Остановить и удалить все данные (полный сброс)
docker compose down -v

# Перезапустить после изменения кода
docker compose build && docker compose up -d
```

---

## Make-команды (сокращения)

```bash
make build       # Пересобрать Docker-образы
make up          # Запустить все сервисы
make down        # Остановить все сервисы
make logs        # Следить за логами в реальном времени
make migrate     # Применить миграции Alembic вручную
make seed        # Запустить скрипт наполнения БД тестовыми данными
make shell-db    # Открыть psql-консоль PostgreSQL
make dev         # Запустить в режиме разработки (с hot-reload)
```

---

## Тестовые учётные записи

После запуска с `SEED_ON_START=true` в базе создаётся 29 пользователей.
Ниже — основные аккаунты для проверки каждой роли:

| Роль | Email | Пароль |
|---|---|---|
| Администратор | admin@2ltp.ru | Admin123! |
| Менеджер | manager@2ltp.ru | Manager123! |
| Тимлид Frontend | tl.frontend@2ltp.ru | Teamlead123! |
| Тимлид Backend | tl.backend@2ltp.ru | Teamlead123! |
| Тимлид QA | tl.qa@2ltp.ru | Teamlead123! |
| Тимлид DevOps | tl.devops@2ltp.ru | Teamlead123! |
| Тимлид Mobile | tl.mobile@2ltp.ru | Teamlead123! |
| Тимлид Data/BI | tl.data@2ltp.ru | Teamlead123! |
| Исполнитель | worker1@2ltp.ru | Worker123! |
| Исполнитель | worker2@2ltp.ru | Worker123! |
| Клиент (активный) | client@2ltp.ru | Client123! |
| Клиент | client2@2ltp.ru | Client123! |

Клиентский портал открывается на http://localhost:3001, внутренний — на http://localhost:3000.

---

## Кейсы тестирования

### Клиентский портал (http://localhost:3001)

1. Войти как `client@2ltp.ru` → просмотреть историю заявок → создать новую заявку.
2. Выбрать сервис и приложение в форме создания, прикрепить файл.
3. Добавить комментарий к существующей заявке, проверить ответ IT-отдела.

### Внутренний портал (http://localhost:3000)

4. Войти как `manager@2ltp.ru` → создать задачу → назначить команду Frontend.
5. Войти как `tl.frontend@2ltp.ru` → взять задачу в работу → создать подзадачи → назначить исполнителей.
6. Войти как `worker1@2ltp.ru` → перевести подзадачу в статус `inprog` → сдать на проверку.
7. Вернуться как менеджер → проверить задачу → принять или вернуть на доработку.
8. Войти как `manager@2ltp.ru` → открыть вкладку «Тикеты» → ответить на заявку клиента.
9. Войти как `admin@2ltp.ru` → управление пользователями → просмотр журнала аудита.
10. Открыть вкладку «Аналитика» → проверить графики нагрузки по командам.

### API

11. Открыть http://localhost:8000/docs → авторизоваться через `POST /api/auth/login`.
12. Проверить защищённые маршруты (задачи, пользователи, аналитика).

---

## Миграции базы данных

Миграции применяются автоматически при старте контейнера (`RUN_MIGRATIONS=true`).

Для ручного управления:

```bash
# Применить все ожидающие миграции
docker compose exec backend alembic upgrade head

# Просмотреть цепочку миграций
docker compose exec backend alembic history

# Откатить последнюю миграцию
docker compose exec backend alembic downgrade -1
```

---

## Разработка без Docker

### Бэкенд

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Linux/macOS
# venv\Scripts\activate         # Windows

pip install -r requirements.txt

# Заполнить .env: DATABASE_URL, REDIS_URL, SECRET_KEY
alembic upgrade head
python -m app.seed              # наполнить тестовыми данными
uvicorn app.main:app --reload --port 8000
```

### Фронтенд

```bash
cd frontend/app
npm install

# Внутренний портал (порт 5173):
VITE_PORTAL=internal VITE_API_MOCK=false npm run dev

# Клиентский портал (порт 5174, если запускать одновременно):
VITE_PORTAL=client VITE_API_MOCK=false npm run dev -- --port 5174
```

> Режим мок-данных (без бэкенда): `VITE_API_MOCK=true npm run dev`

---

## Использование ИИ-инструментов в проекте

В соответствии с методическими указаниями ЧУПО «ВШП» все использованные ИИ-инструменты
задокументированы ниже. Искусственный интеллект применялся исключительно для вспомогательных
задач. Ключевые этапы работы — концепция, проектирование, написание серверного и клиентского
кода, анализ и формулирование выводов — выполнены студентом лично. Все материалы, полученные
с помощью ИИ, проверены студентом на корректность и достоверность.

| Инструмент | Назначение в проекте | Официальный ресурс |
|---|---|---|
| **Claude (Anthropic)** | Вспомогательная помощь при проработке дизайна пользовательских интерфейсов (варианты компоновки и визуальной иерархии). Сам дизайн и его реализация в коде выполнены студентом. | https://claude.ai |
| **ChatGPT (OpenAI)** | Генерация тестовых (демонстрационных) данных для наполнения базы данных — рутинная задача, прямо разрешённая методическими указаниями. | https://chatgpt.com |

**Claude** применялся как вспомогательное средство при проработке визуального оформления
пользовательских интерфейсов: рассматривались варианты компоновки экранов, организации
навигации и визуальной иерархии элементов. Итоговые дизайнерские решения принимались
студентом, реализация в коде на React выполнена студентом самостоятельно.

**ChatGPT** применялся для автоматизации рутинной задачи — формирования набора
демонстрационных данных: учётных записей пользователей, перечня сервисов и приложений,
примеров задач, подзадач и тикетов. Данные проверены студентом и интегрированы в скрипт
`backend/app/seed.py`. Все данные являются вымышленными.

Ответственность за корректность и качество всех материалов несёт студент.

---

## Лицензии используемого ПО

- **FastAPI** — MIT. https://fastapi.tiangolo.com
- **SQLAlchemy** — MIT. https://www.sqlalchemy.org
- **asyncpg** — Apache 2.0. https://github.com/MagicStack/asyncpg
- **Alembic** — MIT. https://alembic.sqlalchemy.org
- **Pydantic** — MIT. https://docs.pydantic.dev
- **Celery** — BSD-3-Clause. https://docs.celeryq.dev
- **passlib** — BSD-3-Clause. https://passlib.readthedocs.io
- **python-jose** — MIT. https://github.com/mpdavis/python-jose
- **uvicorn** — BSD-3-Clause. https://www.uvicorn.org
- **React** — MIT. https://react.dev
- **Ant Design** — MIT. https://ant.design
- **Zustand** — MIT. https://github.com/pmndrs/zustand
- **TanStack React Query** — MIT. https://tanstack.com/query
- **Vite** — MIT. https://vite.dev
- **TypeScript** — Apache 2.0. https://www.typescriptlang.org
- **PostgreSQL** — PostgreSQL License. https://www.postgresql.org
- **Redis** — BSD-3-Clause. https://redis.io
- **Nginx** — BSD-2-Clause. https://nginx.org
- **Docker** — Apache 2.0. https://www.docker.com

---

## Автор

Дипломный проект выполнен в рамках программы подготовки специалистов среднего звена
по специальности **09.02.07 «Информационные системы и программирование»**,
ЧУПО «Высшая школа предпринимательства» (Тверь), 2026 г.
