"""
Database seed script.
Run with: docker compose exec backend python -m app.seed
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.team import Team
from app.models.service import Service
from app.models.application import Application, ApplicationStatus
from app.models.ticket import Ticket, TicketPriority, TicketStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.subtask import Subtask, SubtaskStatus
from app.models.comment import Comment, CommentEntityType
from app.models.notification import Notification, NotificationEntityType
from app.models.audit_log import AuditLog, AuditEntityType

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def now() -> datetime:
    return datetime.now(timezone.utc)


def days_ago(n: int) -> datetime:
    return now() - timedelta(days=n)


def days_from_now(n: int) -> datetime:
    return now() + timedelta(days=n)


async def clear_tables(session: AsyncSession) -> None:
    tables = [
        "audit_log", "notifications", "comments", "subtasks", "tasks",
        "tickets", "applications", "services", "users", "teams",
    ]
    for table in tables:
        await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
    await session.commit()
    print("Tables cleared.")


async def seed(session: AsyncSession) -> None:
    team_frontend = Team(id=uuid.uuid4(), name="Frontend")
    team_backend = Team(id=uuid.uuid4(), name="Backend")
    team_qa = Team(id=uuid.uuid4(), name="QA")
    team_devops = Team(id=uuid.uuid4(), name="DevOps")
    team_mobile = Team(id=uuid.uuid4(), name="Mobile")
    team_data = Team(id=uuid.uuid4(), name="Data/BI")
    teams = [team_frontend, team_backend, team_qa, team_devops, team_mobile, team_data]
    session.add_all(teams)
    await session.flush()

    def mk(email, name, role, pwd, team=None, active=True):
        return User(
            id=uuid.uuid4(), email=email, password_hash=hash_password(pwd),
            full_name=name, role=role, team_id=team.id if team else None,
            is_active=active, notify_email=True,
        )

    admin = mk("admin@2ltp.ru", "Администратор Системы", UserRole.admin, "Admin123!")
    admin2 = mk("admin2@2ltp.ru", "Виктория Админова", UserRole.admin, "Admin123!")

    manager = mk("manager@2ltp.ru", "Менеджер Проектов", UserRole.manager, "Manager123!")
    manager2 = mk("manager2@2ltp.ru", "Павел Управленцев", UserRole.manager, "Manager123!")

    tl_frontend = mk("tl.frontend@2ltp.ru", "Алексей Фронтов", UserRole.teamlead, "Teamlead123!", team_frontend)
    tl_backend = mk("tl.backend@2ltp.ru", "Сергей Бэкенд", UserRole.teamlead, "Teamlead123!", team_backend)
    tl_qa = mk("tl.qa@2ltp.ru", "Наталья Тестова", UserRole.teamlead, "Teamlead123!", team_qa)
    tl_devops = mk("tl.devops@2ltp.ru", "Роман Деплоев", UserRole.teamlead, "Teamlead123!", team_devops)
    tl_mobile = mk("tl.mobile@2ltp.ru", "Игорь Мобайлов", UserRole.teamlead, "Teamlead123!", team_mobile)
    tl_data = mk("tl.data@2ltp.ru", "Елена Данных", UserRole.teamlead, "Teamlead123!", team_data)

    worker1 = mk("worker1@2ltp.ru", "Дмитрий Иванов", UserRole.worker, "Worker123!", team_frontend)
    worker2 = mk("worker2@2ltp.ru", "Ольга Петрова", UserRole.worker, "Worker123!", team_frontend)
    worker3 = mk("worker3@2ltp.ru", "Михаил Сидоров", UserRole.worker, "Worker123!", team_backend)
    worker4 = mk("worker4@2ltp.ru", "Екатерина Козлова", UserRole.worker, "Worker123!", team_backend)
    worker5 = mk("worker5@2ltp.ru", "Андрей Новиков", UserRole.worker, "Worker123!", team_qa)
    worker6 = mk("worker6@2ltp.ru", "Мария Семёнова", UserRole.worker, "Worker123!", team_devops)
    worker7 = mk("worker7@2ltp.ru", "Никита Волков", UserRole.worker, "Worker123!", team_frontend)
    worker8 = mk("worker8@2ltp.ru", "Анна Морозова", UserRole.worker, "Worker123!", team_backend)
    worker9 = mk("worker9@2ltp.ru", "Павел Зайцев", UserRole.worker, "Worker123!", team_qa)
    worker10 = mk("worker10@2ltp.ru", "Светлана Орлова", UserRole.worker, "Worker123!", team_devops)
    worker11 = mk("worker11@2ltp.ru", "Артём Лебедев", UserRole.worker, "Worker123!", team_mobile)
    worker12 = mk("worker12@2ltp.ru", "Юлия Соколова", UserRole.worker, "Worker123!", team_mobile)
    worker13 = mk("worker13@2ltp.ru", "Глеб Кузнецов", UserRole.worker, "Worker123!", team_data)
    worker_inactive = mk("worker.inactive@2ltp.ru", "Борис Уволенко", UserRole.worker, "Worker123!", team_backend, active=False)

    client1 = mk("client@2ltp.ru", "Иван Клиентов", UserRole.client, "Client123!")
    client2 = mk("client2@2ltp.ru", "Анастасия Заказова", UserRole.client, "Client123!")
    client3 = mk("client3@2ltp.ru", "ООО «ТехноСервис»", UserRole.client, "Client123!")

    all_users = [
        admin, admin2, manager, manager2,
        tl_frontend, tl_backend, tl_qa, tl_devops, tl_mobile, tl_data,
        worker1, worker2, worker3, worker4, worker5, worker6, worker7,
        worker8, worker9, worker10, worker11, worker12, worker13, worker_inactive,
        client1, client2, client3,
    ]
    session.add_all(all_users)
    await session.flush()

    team_frontend.teamlead_id = tl_frontend.id
    team_backend.teamlead_id = tl_backend.id
    team_qa.teamlead_id = tl_qa.id
    team_devops.teamlead_id = tl_devops.id
    team_mobile.teamlead_id = tl_mobile.id
    team_data.teamlead_id = tl_data.id
    await session.flush()

    team_workers = {
        team_frontend.id: [worker1, worker2, worker7],
        team_backend.id: [worker3, worker4, worker8],
        team_qa.id: [worker5, worker9],
        team_devops.id: [worker6, worker10],
        team_mobile.id: [worker11, worker12],
        team_data.id: [worker13],
    }

    def svc(name, color, desc, category, team, priority, reaction, resolution):
        return Service(
            id=uuid.uuid4(), name=name, color=color, description=desc,
            category=category,
            responsible_team_id=team.id if team else None,
            default_priority=priority,
            sla_reaction_hours=reaction,
            sla_resolution_hours=resolution,
            status="active",
        )

    s_email     = svc("Электронная почта и календарь",            "#2563EB", "MS Exchange / Outlook, корпоративная почта и совместные календари",        "communications", team_devops,  "high",   1, 4)
    s_phone     = svc("Корпоративная телефония / IP-телефония",   "#7C3AED", "IP-АТС, SIP-телефония, переадресации и голосовое меню",                     "communications", team_devops,  "high",   1, 4)
    s_vpn       = svc("Доступ в интернет и VPN",                  "#059669", "Удалённый доступ для сотрудников и филиалов, VPN-клиенты, межсетевые экраны", "networks",      team_devops,  "high",   1, 8)
    s_ad        = svc("Учётные записи и доступы (AD)",            "#D97706", "Active Directory, групповые политики, управление правами и RBAC",            "access",        team_backend, "medium", 2, 8)
    s_print     = svc("Печать и сканирование документов",         "#DC2626", "Сетевые принтеры, серверы печати, МФУ и сканеры",                            "office",        team_qa,      "low",    4, 24)
    s_vc        = svc("Видеоконференцсвязь",                      "#EC4899", "MS Teams, Zoom, корпоративные ВКС-системы",                                  "communications", team_devops,  "medium", 2, 8)
    s_wms       = svc("Складской учёт и WMS-операции",            "#0EA5E9", "WMS на 7 складах, интеграция с 1С:ERP и Oracle",                             "logistics",     team_backend, "high",   1, 6)
    s_b2b       = svc("Закупки и снабжение (b2b-портал)",         "#10B981", "RS24, личный кабинет клиентов и партнёров, B2B-заказы",                       "sales",         team_backend, "medium", 2, 12)
    s_1c        = svc("Бухгалтерский и налоговый учёт",           "#6366F1", "1С:Бухгалтерия, 1С:Зарплата, налоговая отчётность и закрытие периодов",      "finance",       team_backend, "high",   2, 8)
    s_crm       = svc("Управление взаимоотношениями с клиентами", "#F59E0B", "CRM-система, воронки продаж, работа с клиентами и партнёрами",                "sales",         team_backend, "medium", 4, 24)
    s_backup    = svc("Резервное копирование и восстановление",   "#8B5CF6", "Veeam, политики бэкапирования, тестирование восстановления данных",           "infrastructure", team_devops,  "medium", 4, 24)
    all_services = [s_email, s_phone, s_vpn, s_ad, s_print, s_vc, s_wms, s_b2b, s_1c, s_crm, s_backup]
    session.add_all(all_services)

    def app(name, color, desc):
        return Application(id=uuid.uuid4(), name=name, color=color, description=desc, status=ApplicationStatus.active)

    app_erp      = app("1С:ERP / 1С:Управление торговлей",          "#DC2626", "Складской учёт, закупки и управление продажами")
    app_1c_buh   = app("1С:Бухгалтерия",                            "#B91C1C", "Бухгалтерский и налоговый учёт")
    app_oracle   = app("Oracle (ERP/БД)",                           "#F59E0B", "Координация складов, логистика, учёт остатков")
    app_rs24     = app("RS24 (b2b-портал)",                         "#2563EB", "Закупки, личный кабинет клиентов и партнёров")
    app_exchange = app("Microsoft Exchange / Outlook",              "#0078D4", "Корпоративная почта, календари и задачи")
    app_teams    = app("MS Teams / Zoom",                           "#6264A7", "Видеоконференцсвязь, корпоративные чаты и совещания")
    app_ad       = app("Active Directory",                          "#7C3AED", "Учётные записи, доступы, групповые политики")
    app_wms      = app("WMS-система",                               "#059669", "Управление складскими операциями на 7 складах")
    app_crm      = app("CRM-система",                               "#D97706", "Работа с клиентами и партнёрами, воронки продаж")
    app_1c_zup   = app("1С:Зарплата и управление персоналом",       "#DC2626", "Кадровый учёт, расчёт зарплаты и командировочных")
    app_print    = app("Сервер печати / принтеры",                  "#6B7280", "Сетевые принтеры и МФУ в офисах")
    app_zabbix   = app("Zabbix / система мониторинга",              "#CC0000", "Контроль доступности инфраструктуры и оборудования")
    app_vpn      = app("VPN-клиент (Cisco AnyConnect)",             "#1BA0D7", "Удалённый доступ для филиалов и удалённых сотрудников")
    app_veeam    = app("Системы резервного копирования (Veeam)",    "#00B336", "Резервное копирование и быстрое восстановление данных")
    all_apps = [app_erp, app_1c_buh, app_oracle, app_rs24, app_exchange, app_teams, app_ad,
                app_wms, app_crm, app_1c_zup, app_print, app_zabbix, app_vpn, app_veeam]
    session.add_all(all_apps)

    app_erp.services      = [s_wms, s_1c, s_b2b]
    app_1c_buh.services   = [s_1c]
    app_oracle.services   = [s_wms]
    app_rs24.services     = [s_b2b]
    app_exchange.services = [s_email]
    app_teams.services    = [s_vc]
    app_ad.services       = [s_ad]
    app_wms.services      = [s_wms]
    app_crm.services      = [s_crm]
    app_1c_zup.services   = [s_1c]
    app_print.services    = [s_print]
    app_zabbix.services   = [s_backup]
    app_vpn.services      = [s_vpn]
    app_veeam.services    = [s_backup]
    await session.flush()

    task_defs = [
        ("Сбой репликации 1С:Бухгалтерии — не обновляется база",
         "После планового обновления сервера репликация между основным узлом и резервным перестала работать. Пользователи бухгалтерии не могут вносить проводки. Восстановить репликацию и провести тест целостности данных.",
         TaskPriority.critical, TaskStatus.in_progress, s_1c, team_backend, admin, 1),

        ("Настройка AD-политик для нового структурного подразделения",
         "Создан новый отдел закупок (50 сотрудников). Создать OU в Active Directory, настроить GPO, назначить доступы к RS24 и CRM, добавить учётные записи.",
         TaskPriority.high, TaskStatus.review, s_ad, team_backend, manager, 3),

        ("Устранение разрывов VPN в екатеринбургском филиале",
         "Сотрудники филиала массово жалуются на обрывы VPN-соединения (Cisco AnyConnect) каждые 15–20 минут. Работа со складскими системами и 1С парализована.",
         TaskPriority.critical, TaskStatus.in_progress, s_vpn, team_devops, admin, 2),

        ("Обновление WMS-модуля приёмки на складах 3–5",
         "Плановое обновление WMS до версии 4.2. Включает миграцию справочника ГТД, обновление сканеров штрихкодов, тест приёмки и отгрузки.",
         TaskPriority.medium, TaskStatus.done, s_wms, team_devops, manager, -2),

        ("Ошибка формирования счётов-фактур в 1С:Бухгалтерии",
         "При формировании счётов-фактур система выдаёт ошибку «Значение не является числом». Затронуты все счета, выставленные после 1 апреля. Нужно идентифицировать причину и выполнить перепроводку.",
         TaskPriority.critical, TaskStatus.assigned, s_1c, team_backend, manager2, 2),

        ("Восстановление почтовых ящиков после сбоя Exchange",
         "После падения диска на сервере Exchange потеряны почтовые ящики 12 пользователей финансового отдела. Восстановить из резервной копии Veeam и проверить целостность писем.",
         TaskPriority.critical, TaskStatus.in_progress, s_email, team_devops, admin, 1),

        ("Настройка сетевых принтеров после переезда офиса",
         "После переезда московского офиса 18 принтеров требуют переподключения к новой подсети. Обновить IP-адреса, переустановить драйверы на рабочих станциях.",
         TaskPriority.medium, TaskStatus.in_progress, s_print, team_qa, manager, 5),

        ("Недоступность RS24 для ключевого партнёра",
         "Партнёр ООО «Логистик Про» не может войти в b2b-портал RS24 — получает ошибку 403. Партнёр блокирует крупный заказ. Восстановить доступ в течение 1 часа.",
         TaskPriority.high, TaskStatus.draft, s_b2b, team_backend, manager, 1),

        ("Настройка мониторинга Zabbix для новых серверов",
         "Добавление в Zabbix 12 новых серверов после расширения инфраструктуры. Настройка шаблонов мониторинга, алертов на CPU/RAM/диск, нотификации в Telegram и почту.",
         TaskPriority.medium, TaskStatus.assigned, s_backup, team_devops, admin, 10),

        ("Сбой корпоративной IP-телефонии в головном офисе",
         "Все внутренние звонки через IP-АТС недоступны — сотрудники слышат тишину после набора номера. Внешние звонки также не работают.",
         TaskPriority.critical, TaskStatus.review, s_phone, team_devops, manager2, 1),

        ("Массовая блокировка учётных записей AD после атаки",
         "Зафиксирована атака перебором паролей на 47 учётных записей Active Directory, 23 заблокированы. Провести аудит, сбросить пароли пострадавшим, ужесточить политику блокировок.",
         TaskPriority.critical, TaskStatus.in_progress, s_ad, team_backend, admin, 1),

        ("Восстановление резервной копии Oracle после инцидента",
         "В результате некорректного обновления скрипта миграции удалены данные в таблицах логистики Oracle за 3 дня. Восстановить из резервной копии Veeam, проверить целостность.",
         TaskPriority.critical, TaskStatus.done, s_backup, team_devops, admin, -1),

        ("Не открывается CRM для менеджеров продаж",
         "CRM-система недоступна для 8 менеджеров отдела продаж после смены пароля AD. В остальных системах вход работает. Синхронизировать пароль AD с CRM.",
         TaskPriority.high, TaskStatus.done, s_crm, team_backend, manager, -3),

        ("Настройка VKS для совещания с зарубежными партнёрами",
         "Необходимо настроить корпоративную ВКС-систему для совещания с партнёрами из ЕС. Создать переговорную комнату, протестировать подключение, обеспечить запись.",
         TaskPriority.medium, TaskStatus.assigned, s_vc, team_devops, manager2, 7),

        ("Аудит резервных копий перед закрытием квартала",
         "Провести внеплановый аудит всех резервных копий критичных систем (1С, Oracle, WMS) перед закрытием квартала. Проверить актуальность и целостность бэкапов.",
         TaskPriority.high, TaskStatus.assigned, s_backup, team_devops, admin, 4),

        ("Потеря связи с WMS на складе №6",
         "WMS-терминалы на складе №6 потеряли связь с сервером. Операции приёмки и отгрузки остановлены. Диагностировать сетевой сбой, восстановить подключение.",
         TaskPriority.critical, TaskStatus.in_progress, s_wms, team_devops, manager, 1),

        ("Массовый сброс паролей для нового требования ИБ",
         "По требованию службы ИБ необходимо принудительно сбросить пароли 120 сотрудникам и установить новую политику сложности паролей в AD.",
         TaskPriority.high, TaskStatus.draft, s_ad, team_backend, admin, 5),

        ("Интеграция 1С:ERP с новой версией WMS",
         "После обновления WMS до версии 4.2 нарушилась интеграция с 1С:ERP — данные о поступлении товаров не передаются. Восстановить интеграцию и проверить все обмены.",
         TaskPriority.critical, TaskStatus.in_progress, s_1c, team_backend, manager, 2),

        ("Обновление сертификата Exchange для внешней почты",
         "SSL-сертификат сервера Exchange истекает через 7 дней. Обновить сертификат, перезапустить службы, проверить корректность подключения клиентов.",
         TaskPriority.high, TaskStatus.review, s_email, team_devops, admin, 5),

        ("Перевод 30 сотрудников в новую OU Active Directory",
         "В рамках реструктуризации необходимо перевести 30 сотрудников из 5 отделов в новые организационные единицы AD с переназначением GPO и доступов.",
         TaskPriority.medium, TaskStatus.done, s_ad, team_backend, manager2, -4),

        ("Настройка Cisco AnyConnect для удалённых сотрудников",
         "10 новых сотрудников на удалённой работе нуждаются в настройке VPN-клиента Cisco AnyConnect. Создать профили подключения, настроить двухфакторную аутентификацию.",
         TaskPriority.medium, TaskStatus.done, s_vpn, team_devops, manager, -6),

        ("Диагностика медленной работы RS24 в периоды отгрузок",
         "b2b-портал RS24 критически замедляется в часы пиковых отгрузок (9:00–11:00 и 14:00–16:00). Провести диагностику, выявить узкое место, подготовить план оптимизации.",
         TaskPriority.high, TaskStatus.in_progress, s_b2b, team_backend, manager, 6),

        ("Восстановление МФУ в бухгалтерии",
         "МФУ Xerox в бухгалтерии перестал отображаться в сети после обновления прошивки. Диагностика и восстановление сетевого подключения, переустановка драйверов.",
         TaskPriority.low, TaskStatus.done, s_print, team_qa, tl_qa, -7),

        ("Настройка шаблонов оповещений в Zabbix",
         "Настроить кастомные шаблоны Zabbix для 1С-серверов и WMS: CPU > 80%, RAM < 10%, диск < 15%. Настроить рассылку алертов по ответственным группам в Telegram.",
         TaskPriority.medium, TaskStatus.assigned, s_backup, team_devops, admin, 8),
    ]

    tasks = []
    for title, desc, prio, st, service, team, creator, dd in task_defs:
        t = Task(
            id=uuid.uuid4(), title=title, description=desc, priority=prio, status=st,
            service_id=service.id, created_by=creator.id, deadline=days_from_now(dd),
            updated_at=now(),
        )
        if st != TaskStatus.draft:
            t.team_id = team.id
        tasks.append(t)
    session.add_all(tasks)
    await session.flush()

    SUB_TITLES = [
        "Подготовить технический анализ", "Реализовать основную логику",
        "Написать unit-тесты", "Code review и правки", "Обновить документацию",
        "Интеграционное тестирование", "Оптимизация производительности",
        "Исправить замечания QA",
    ]
    sub_status_cycle = [
        SubtaskStatus.done, SubtaskStatus.in_progress, SubtaskStatus.todo,
        SubtaskStatus.blocked, SubtaskStatus.done, SubtaskStatus.todo,
    ]
    subtasks = []
    si = 0
    for t in tasks:
        if t.status in (TaskStatus.draft, TaskStatus.assigned):
            count = 2 if t.status == TaskStatus.assigned else 0
        elif t.status == TaskStatus.done:
            count = 3
        else:
            count = 4
        workers = team_workers.get(t.team_id, [])
        if not workers:
            continue
        for k in range(count):
            if t.status == TaskStatus.done:
                st = SubtaskStatus.done
            else:
                st = sub_status_cycle[si % len(sub_status_cycle)]
            assignee = workers[k % len(workers)]
            deadline = days_ago(2) if (si % 5 == 0 and st != SubtaskStatus.done) else days_from_now(3 + (si % 6))
            subtasks.append(Subtask(
                id=uuid.uuid4(), title=f"{SUB_TITLES[si % len(SUB_TITLES)]} — {t.title[:24]}",
                description="", status=st, task_id=t.id, assignee_id=assignee.id,
                deadline=deadline, updated_at=now(),
            ))
            si += 1
    session.add_all(subtasks)
    await session.flush()

    ticket_defs = [
        ("Недоступен Exchange — не приходят входящие письма",
         "С утра сотрудники финансового отдела не получают входящих писем. Исходящие уходят, входящие зависают в очереди на сервере. Проблема у 12 пользователей.",
         TicketPriority.high, TicketStatus.processing, client1, app_exchange, tasks[5]),

        ("Ошибка «Налог не рассчитан» при закрытии квартала в 1С",
         "При попытке закрыть квартал в 1С:Бухгалтерии система выдаёт ошибку «Налог на прибыль не рассчитан. Проверьте регистры накопления». Отчётность заблокирована.",
         TicketPriority.high, TicketStatus.accepted, client1, app_1c_buh, tasks[0]),

        ("Не могу войти в RS24, ошибка 403 Forbidden",
         "Менеджер ООО «Логистик Про» не может авторизоваться в b2b-портале RS24 с 9:00 сегодня. При вводе корректных данных — ошибка 403. Другие пользователи партнёра работают нормально.",
         TicketPriority.high, TicketStatus.new, client3, app_rs24, tasks[7]),

        ("WMS зависает при сканировании штрихкодов на складе №2",
         "Терминалы сбора данных на складе №2 зависают при оприходовании товара — после сканирования штрихкода зависание 30–40 секунд. Приёмка встала. 14 операторов не могут работать.",
         TicketPriority.high, TicketStatus.rejected, client2, app_wms, tasks[3]),

        ("Потерян доступ к CRM после смены пароля AD",
         "После плановой смены пароля Active Directory не могу войти в CRM-систему. В остальные системы (почта, RS24) вход проходит нормально. Ошибка: «Неверное имя пользователя или пароль».",
         TicketPriority.medium, TicketStatus.closed, client1, app_crm, None),

        ("Запрос на создание учётной записи для нового сотрудника",
         "Прошу создать учётную запись AD для нового сотрудника отдела логистики: Иванова Светлана Петровна, должность — менеджер склада, нужен доступ к WMS и 1С:ERP.",
         TicketPriority.low, TicketStatus.accepted, client2, app_ad, None),

        ("VPN отключается каждые 15 минут — не могу работать удалённо",
         "С прошлой пятницы VPN (Cisco AnyConnect) постоянно обрывается с интервалом 15–20 минут. Проблема у всех сотрудников екатеринбургского филиала. На работу в 1С и WMS влияет критически.",
         TicketPriority.high, TicketStatus.closed, client3, app_vpn, tasks[2]),

        ("1С:ERP не синхронизируется с WMS",
         "После обновления WMS данные о поступлении товаров перестали передаваться в 1С:ERP. Остатки на складах расходятся уже 2 дня. Необходима срочная диагностика интеграции.",
         TicketPriority.high, TicketStatus.processing, client1, app_erp, tasks[17]),

        ("Не работает корпоративная телефония в головном офисе",
         "Все внутренние звонки через IP-АТС недоступны с 8:30 утра. Сотрудники слышат тишину после набора номера. Внешние звонки также не работают. Около 200 пользователей затронуто.",
         TicketPriority.high, TicketStatus.processing, client2, app_teams, tasks[9]),

        ("Не могу подключиться к MS Teams при работе из дома",
         "MS Teams не подключается при работе через домашний интернет. При подключении через VPN — работает. Возможно, блокировка по IP на корпоративном файрволе.",
         TicketPriority.medium, TicketStatus.new, client1, app_teams, None),

        ("Ошибка при расчёте зарплаты в 1С:ЗУП",
         "При проведении расчёта зарплаты за месяц в 1С:Зарплата и управление персоналом возникает ошибка «Не задан тариф для подразделения». Расчёт заблокирован для 3 отделов.",
         TicketPriority.high, TicketStatus.new, client3, app_1c_zup, None),

        ("Принтер в переговорной не печатает после переезда",
         "HP LaserJet в переговорной комнате 3-го этажа недоступен в сети после переезда офиса. Другие принтеры работают. Требуется настройка IP и переустановка драйвера.",
         TicketPriority.low, TicketStatus.processing, client1, app_print, tasks[6]),

        ("Запрос на расширение прав в RS24 для нового менеджера",
         "Новый менеджер по закупкам Петров А.В. нуждается в расширенных правах в RS24: доступ к разделам «Договоры» и «Аналитика закупок». Текущая роль — только просмотр заявок.",
         TicketPriority.low, TicketStatus.new, client2, app_rs24, None),

        ("Zabbix не отправляет алерты при сбое серверов",
         "Вчера был сбой на сервере БД, но уведомления от Zabbix не пришли. Настройки оповещений в системе корректны. Возможна проблема с SMTP-шлюзом или Telegram-ботом.",
         TicketPriority.high, TicketStatus.accepted, client3, app_zabbix, None),
    ]
    tickets = []
    for title, desc, prio, st, cl, ap, linked in ticket_defs:
        tk = Ticket(
            id=uuid.uuid4(), title=title, description=desc, priority=prio, status=st,
            client_id=cl.id, application_id=ap.id, task_id=linked.id if linked else None,
        )
        tickets.append(tk)
    session.add_all(tickets)
    await session.flush()

    def tcomment(body, author, ticket, visible=True):
        return Comment(id=uuid.uuid4(), body=body, author_id=author.id,
                       entity_type=CommentEntityType.ticket, entity_id=ticket.id,
                       is_visible_to_client=visible)

    def task_comment(body, author, task):
        return Comment(id=uuid.uuid4(), body=body, author_id=author.id,
                       entity_type=CommentEntityType.task, entity_id=task.id,
                       is_visible_to_client=False)

    comments = [
        tcomment("Принято в работу. Создана задача на восстановление почты Exchange.", manager, tickets[0]),
        tcomment("Диагностика показала сбой диска. Начинаем восстановление из Veeam.", tl_devops, tickets[0]),
        tcomment("Внутренняя заметка: задействовать резервный MX-сервер на время восстановления.", manager, tickets[0], visible=False),
        tcomment("Подтверждено. Связано со сбоем репликации БД 1С. Задача T-184 в работе.", manager, tickets[1]),
        tcomment("WMS обновлён до 4.2 в задаче T-181. Проблема на складе №2 устранена в рамках планового обновления.", manager, tickets[3]),
        tcomment("Доступ к CRM восстановлен. Пароль AD синхронизирован вручную.", tl_backend, tickets[4]),
        tcomment("Уточните: при смене пароля AD всегда необходимо уведомить поддержку для синхронизации CRM.", manager, tickets[4]),
        tcomment("Учётная запись создана. Доступы к WMS и 1С:ERP назначены. Временный пароль направлен руководителю.", tl_backend, tickets[5]),
        tcomment("Проблема решена настройкой keepalive-таймаутов на ASA Cisco. VPN стабилен.", tl_devops, tickets[6]),
        tcomment("Подтверждаем: проблема в интеграции WMS 4.2 с 1С:ERP. Восстанавливаем обмен данными.", tl_backend, tickets[7]),
        tcomment("IP-АТС восстановлена. Причина — сбой коммутатора в серверной. Заменён резервный блок питания.", tl_devops, tickets[8]),
        tcomment("Принято. Проверяем правила файрвола для Teams.", manager, tickets[9]),
        tcomment("Тикет отклонён — проблема на складе решена плановым обновлением WMS.", manager2, tickets[3]),
        task_comment("Лог репликации показывает ошибку WAL после обновления PostgreSQL. Правим конфиг.", worker3, tasks[0]),
        task_comment("OU и GPO созданы. Учётные записи готовы. Назначаю права в RS24 и CRM.", worker4, tasks[1]),
        task_comment("Анализ логов AnyConnect завершён: idle-timeout слишком короткий. Исправляем.", worker6, tasks[2]),
        task_comment("WMS обновлён на всех 3 складах. Провели тест приёмки — всё работает корректно.", worker6, tasks[3]),
    ]
    session.add_all(comments)

    def notif(user, title, body, etype, eid, read=False):
        return Notification(id=uuid.uuid4(), user_id=user.id, title=title, body=body,
                            entity_type=etype, entity_id=eid, is_read=read)

    notifications = [
        notif(client1, "Заявка принята в работу", "Заявка «Недоступен Exchange» принята в работу.", NotificationEntityType.ticket, tickets[0].id, read=True),
        notif(client1, "Новый комментарий к заявке", "Инженер оставил комментарий к вашей заявке.", NotificationEntityType.ticket, tickets[0].id),
        notif(client1, "Заявка закрыта", "Заявка «Потерян доступ к CRM» закрыта.", NotificationEntityType.ticket, tickets[4].id),
        notif(client2, "Заявка отклонена", "Заявка «WMS зависает на складе №2» отклонена. Подробности в комментариях.", NotificationEntityType.ticket, tickets[3].id),
        notif(client3, "Заявка в обработке", "Заявка «VPN отключается каждые 15 минут» взята в обработку.", NotificationEntityType.ticket, tickets[6].id),
        notif(tl_backend, "Новый критичный инцидент", "Задача «Сбой репликации 1С:Бухгалтерии» назначена команде Backend.", NotificationEntityType.task, tasks[0].id, read=True),
        notif(tl_devops, "Новый критичный инцидент", "Задача «Устранение разрывов VPN» назначена команде DevOps.", NotificationEntityType.task, tasks[2].id),
        notif(manager, "Задача на ревью", "Задача «Настройка AD-политик» ожидает ревью.", NotificationEntityType.task, tasks[1].id),
        notif(manager, "Задача на ревью", "Задача «Сбой корпоративной IP-телефонии» ожидает ревью.", NotificationEntityType.task, tasks[9].id),
        notif(worker3, "Подзадача назначена вам", "Вам назначена подзадача по задаче «Сбой репликации 1С».", NotificationEntityType.subtask, subtasks[0].id),
        notif(worker6, "Подзадача назначена вам", "Вам назначена подзадача по задаче «Устранение разрывов VPN».", NotificationEntityType.subtask, subtasks[2].id if len(subtasks) > 2 else subtasks[0].id),
        notif(worker5, "Подзадача назначена вам", "Вам назначена подзадача по задаче «Настройка принтеров».", NotificationEntityType.subtask, subtasks[-1].id),
        notif(tl_devops, "Новая задача команде", "Задача «Настройка мониторинга Zabbix» назначена команде DevOps.", NotificationEntityType.task, tasks[8].id),
    ]
    session.add_all(notifications)

    def audit(actor, action, etype, eid, meta=None):
        return AuditLog(id=uuid.uuid4(), user_id=actor.id, action=action,
                        entity_type=etype, entity_id=eid, meta=meta or {})

    audit_entries = [
        audit(admin, "auth.login", AuditEntityType.user, admin.id),
        audit(manager, "auth.login", AuditEntityType.user, manager.id),
        audit(manager, "task.created", AuditEntityType.task, tasks[0].id, {"title": tasks[0].title}),
        audit(admin, "task.created", AuditEntityType.task, tasks[2].id, {"title": tasks[2].title}),
        audit(tl_backend, "task.accepted", AuditEntityType.task, tasks[0].id),
        audit(tl_devops, "task.accepted", AuditEntityType.task, tasks[2].id),
        audit(manager, "ticket.rejected", AuditEntityType.ticket, tickets[3].id, {"reason": "Проблема решена плановым обновлением WMS"}),
        audit(manager, "ticket.accepted", AuditEntityType.ticket, tickets[1].id, {"task_id": str(tasks[0].id)}),
        audit(admin, "user.created", AuditEntityType.user, worker13.id, {"email": worker13.email}),
        audit(admin, "user.archived", AuditEntityType.user, worker_inactive.id),
        audit(tl_backend, "subtask.created", AuditEntityType.subtask, subtasks[2].id if len(subtasks) > 2 else subtasks[0].id),
        audit(admin, "team.created", AuditEntityType.team, team_devops.id, {"name": "DevOps"}),
    ]
    session.add_all(audit_entries)

    await session.commit()

    print("Seed completed successfully!")
    print()
    print(f"Teams: {len(teams)} | Users: {len(all_users)} | Services: {len(all_services)} | Apps: {len(all_apps)}")
    print("Services: " + ", ".join(s.name for s in all_services))
    print(f"Tasks: {len(tasks)} | Subtasks: {len(subtasks)} | Tickets: {len(tickets)} | "
          f"Comments: {len(comments)} | Notifications: {len(notifications)} | Audit: {len(audit_entries)}")
    print()
    print("=== Test accounts (password in parentheses) ===")
    print("Admin:    admin@2ltp.ru (Admin123!)        / admin2@2ltp.ru (Admin123!)")
    print("Manager:  manager@2ltp.ru (Manager123!)    / manager2@2ltp.ru (Manager123!)")
    print("Teamlead: tl.frontend@2ltp.ru (Teamlead123!)  [+ backend/qa/devops/mobile/data]")
    print("Worker:   worker1@2ltp.ru (Worker123!)     [worker1..worker13]")
    print("Client:   client@2ltp.ru (Client123!)      / client2 / client3")


async def main(if_empty: bool = False) -> None:
    async with AsyncSessionLocal() as session:
        if if_empty:
            existing = await session.execute(text("SELECT 1 FROM users LIMIT 1"))
            if existing.first() is not None:
                print("Database already seeded — skipping.")
                return
        print("Starting seed...")
        await clear_tables(session)
        await seed(session)


if __name__ == "__main__":
    import sys
    asyncio.run(main(if_empty="--if-empty" in sys.argv))
