import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.team import Team
from app.models.subtask import Subtask
from app.models.service import Service
from app.models.audit_log import AuditLog, AuditEntityType
from app.schemas.analytics import (
    TasksByStatusOut,
    AvgCompletionTimeOut,
    ServiceAvg,
    TeamLoadOut,
    OverdueOut,
    TicketsStatsOut,
    WeeklyStatsOut,
    WeekPoint,
    StatusCount,
    TeamMemberLoad,
    OverdueItem,
    TicketStatusCount,
    FrequentlyRejectedItem,
    FrequentlyRejectedOut,
    DashboardOut,
    DashWeekly,
    DashWorkerLoad,
    DashTeamLoad,
    DashOverdue,
    DashPriority,
)
from app.dependencies import require_teamlead, get_current_user

_RU_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн",
              "июл", "авг", "сен", "окт", "ноя", "дек"]

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _period_start(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


@router.get("/tasks-by-status", response_model=TasksByStatusOut)
async def tasks_by_status(
    period: str = Query("30d", description="e.g. 7d, 30d, 90d"),
    team_id: Optional[uuid.UUID] = None,
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    days = int(period.rstrip("d")) if period.endswith("d") else 30
    start = _period_start(days)

    filters = [Task.created_at >= start]
    if team_id:
        filters.append(Task.team_id == team_id)

    q = (
        select(Task.status, func.count(Task.id).label("count"))
        .where(and_(*filters))
        .group_by(Task.status)
    )
    rows = (await db.execute(q)).all()
    data = [StatusCount(status=row.status.value, count=row.count) for row in rows]

    return TasksByStatusOut(period_days=days, team_id=team_id, data=data)


@router.get("/avg-completion-time", response_model=AvgCompletionTimeOut)
async def avg_completion_time(
    period: str = Query("30d"),
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    days = int(period.rstrip("d")) if period.endswith("d") else 30
    start = _period_start(days)

    q = select(
        func.avg(
            func.extract("epoch", Task.updated_at - Task.created_at) / 3600
        ).label("avg_hours"),
        func.count(Task.id).label("sample_size"),
    ).where(
        and_(
            Task.status == TaskStatus.done,
            Task.updated_at >= start,
        )
    )
    row = (await db.execute(q)).first()

    per_service_q = (
        select(
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            func.avg(func.extract("epoch", Task.updated_at - Task.created_at) / 3600).label("avg_hours"),
            func.count(Task.id).label("sample_size"),
        )
        .join(Service, Task.service_id == Service.id)
        .where(and_(Task.status == TaskStatus.done, Task.updated_at >= start))
        .group_by(Service.id, Service.name)
        .order_by(Service.name)
    )
    per_service_rows = (await db.execute(per_service_q)).all()
    by_service = [
        ServiceAvg(
            service_id=r.service_id,
            service_name=r.service_name,
            avg_hours=round(float(r.avg_hours), 2) if r.avg_hours else None,
            sample_size=r.sample_size or 0,
        )
        for r in per_service_rows
    ]

    return AvgCompletionTimeOut(
        period_days=days,
        avg_hours=round(float(row.avg_hours), 2) if row.avg_hours else None,
        sample_size=row.sample_size or 0,
        by_service=by_service,
    )


@router.get("/team-load", response_model=TeamLoadOut)
async def team_load(
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    teams = (await db.execute(select(Team))).scalars().all()
    result = []

    for team in teams:
        active_task_statuses = [TaskStatus.assigned, TaskStatus.in_progress, TaskStatus.review]
        task_count_q = select(func.count(Task.id)).where(
            and_(
                Task.team_id == team.id,
                Task.status.in_(active_task_statuses),
            )
        )
        active_tasks = (await db.execute(task_count_q)).scalar_one()

        subtask_count_q = (
            select(func.count(Subtask.id))
            .join(User, Subtask.assignee_id == User.id)
            .where(
                and_(
                    User.team_id == team.id,
                    Subtask.status.in_(["todo", "in_progress", "blocked"]),
                )
            )
        )
        active_subtasks = (await db.execute(subtask_count_q)).scalar_one()

        member_count_q = select(func.count(User.id)).where(User.team_id == team.id)
        member_count = (await db.execute(member_count_q)).scalar_one()

        result.append(
            TeamMemberLoad(
                team_id=team.id,
                team_name=team.name,
                active_tasks=active_tasks,
                active_subtasks=active_subtasks,
                member_count=member_count,
            )
        )

    return TeamLoadOut(data=result)


@router.get("/overdue", response_model=OverdueOut)
async def overdue_tasks(
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    non_terminal = [TaskStatus.draft, TaskStatus.assigned, TaskStatus.in_progress, TaskStatus.review]

    q = (
        select(Task, Team.name.label("team_name"))
        .outerjoin(Team, Task.team_id == Team.id)
        .where(
            and_(
                Task.deadline < now,
                Task.status.in_(non_terminal),
            )
        )
        .order_by(Task.deadline.asc())
    )
    rows = (await db.execute(q)).all()

    items = []
    for row in rows:
        task = row[0]
        team_name = row[1]
        items.append(
            OverdueItem(
                id=task.id,
                title=task.title,
                deadline=task.deadline.isoformat() if task.deadline else "",
                team_id=task.team_id,
                team_name=team_name,
                priority=task.priority.value,
                status=task.status.value,
            )
        )

    return OverdueOut(total=len(items), items=items)


@router.get("/frequently-rejected", response_model=FrequentlyRejectedOut)
async def frequently_rejected(
    period: str = Query("90d"),
    limit: int = Query(20, ge=1, le=100),
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    """Tasks rejected most often (by count of task.rejected audit events)."""
    days = int(period.rstrip("d")) if period.endswith("d") else 90
    start = _period_start(days)

    counts_q = (
        select(
            AuditLog.entity_id.label("task_id"),
            func.count(AuditLog.id).label("reject_count"),
        )
        .where(
            and_(
                AuditLog.entity_type == AuditEntityType.task,
                AuditLog.action == "task.rejected",
                AuditLog.created_at >= start,
                AuditLog.entity_id.isnot(None),
            )
        )
        .group_by(AuditLog.entity_id)
        .order_by(func.count(AuditLog.id).desc())
        .limit(limit)
    )
    rows = (await db.execute(counts_q)).all()

    items: list[FrequentlyRejectedItem] = []
    for r in rows:
        task = (await db.execute(select(Task).where(Task.id == r.task_id))).scalar_one_or_none()
        if not task:
            continue
        items.append(
            FrequentlyRejectedItem(
                id=task.id,
                title=task.title,
                reject_count=r.reject_count,
                status=task.status.value,
                service_id=task.service_id,
                team_id=task.team_id,
            )
        )

    return FrequentlyRejectedOut(period_days=days, total=len(items), items=items)


@router.get("/tickets-stats", response_model=TicketsStatsOut)
async def tickets_stats(
    period: str = Query("30d"),
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    days = int(period.rstrip("d")) if period.endswith("d") else 30
    start = _period_start(days)

    total_q = select(func.count(Ticket.id)).where(Ticket.created_at >= start)
    total = (await db.execute(total_q)).scalar_one()

    by_status_q = (
        select(Ticket.status, func.count(Ticket.id).label("count"))
        .where(Ticket.created_at >= start)
        .group_by(Ticket.status)
    )
    by_status_rows = (await db.execute(by_status_q)).all()
    by_status = [TicketStatusCount(status=r.status.value, count=r.count) for r in by_status_rows]

    by_priority_q = (
        select(Ticket.priority, func.count(Ticket.id).label("count"))
        .where(Ticket.created_at >= start)
        .group_by(Ticket.priority)
    )
    by_priority_rows = (await db.execute(by_priority_q)).all()
    by_priority = [{"priority": r.priority.value, "count": r.count} for r in by_priority_rows]

    return TicketsStatsOut(
        period_days=days,
        total=total,
        by_status=by_status,
        by_priority=by_priority,
    )


@router.get("/summary")
async def analytics_summary(
    weeks: int = Query(12, ge=1, le=52),
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated dashboard summary used by the analytics screen."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(weeks=weeks)
    non_terminal = [TaskStatus.draft, TaskStatus.assigned, TaskStatus.in_progress, TaskStatus.review]

    done_rows = (
        await db.execute(
            select(Task.created_at, Task.updated_at, Task.deadline).where(
                and_(Task.status == TaskStatus.done, Task.updated_at >= start)
            )
        )
    ).all()
    total_closed = len(done_rows)
    if total_closed:
        avg_days = sum((r.updated_at - r.created_at).total_seconds() for r in done_rows) / total_closed / 86400
        on_time = sum(1 for r in done_rows if r.deadline and r.updated_at <= r.deadline)
        on_time_percent = round(on_time / total_closed * 100, 1)
    else:
        avg_days = 0.0
        on_time_percent = 0.0

    total_overdue = (
        await db.execute(
            select(func.count(Task.id)).where(
                and_(Task.deadline < now, Task.status.in_(non_terminal))
            )
        )
    ).scalar_one()

    status_rows = (
        await db.execute(
            select(Task.status, func.count(Task.id).label("count"))
            .where(Task.status != TaskStatus.archived)
            .group_by(Task.status)
        )
    ).all()
    by_status = [{"status": r.status.value, "count": r.count} for r in status_rows]

    week_lit = text("'week'")
    created_week = func.date_trunc(week_lit, Task.created_at)
    closed_week = func.date_trunc(week_lit, Task.updated_at)
    created_rows = (
        await db.execute(
            select(created_week.label("week"), func.count(Task.id).label("cnt"))
            .where(Task.created_at >= start)
            .group_by(created_week)
        )
    ).all()
    closed_rows = (
        await db.execute(
            select(closed_week.label("week"), func.count(Task.id).label("cnt"))
            .where(and_(Task.status == TaskStatus.done, Task.updated_at >= start))
            .group_by(closed_week)
        )
    ).all()
    created_map = {str(r.week.date()): r.cnt for r in created_rows}
    closed_map = {str(r.week.date()): r.cnt for r in closed_rows}
    weekly_stats = [
        {"week": w, "created": created_map.get(w, 0), "closed": closed_map.get(w, 0)}
        for w in sorted(set(created_map) | set(closed_map))
    ]

    teams = (await db.execute(select(Team))).scalars().all()
    team_load = []
    for team in teams:
        active_tasks = (
            await db.execute(
                select(func.count(Task.id)).where(
                    and_(Task.team_id == team.id, Task.status.in_(non_terminal))
                )
            )
        ).scalar_one()
        total_members = (
            await db.execute(select(func.count(User.id)).where(User.team_id == team.id))
        ).scalar_one()
        team_load.append({
            "team_id": str(team.id),
            "team_name": team.name,
            "active_tasks": active_tasks,
            "total_members": total_members,
        })

    return {
        "avg_completion_days": round(avg_days, 1),
        "on_time_percent": on_time_percent,
        "total_closed": total_closed,
        "total_overdue": total_overdue,
        "weekly_stats": weekly_stats,
        "by_status": by_status,
        "team_load": team_load,
    }


@router.get("/weekly-stats", response_model=WeeklyStatsOut)
async def weekly_stats(
    period: str = Query("90d", description="e.g. 30d, 90d, 180d"),
    _: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    """Tasks created vs closed per calendar week for the last N days."""
    days = int(period.rstrip("d")) if period.endswith("d") else 90
    weeks = max(1, days // 7)
    start = datetime.now(timezone.utc) - timedelta(weeks=weeks)

    week_lit = text("'week'")
    created_week = func.date_trunc(week_lit, Task.created_at)
    closed_week = func.date_trunc(week_lit, Task.updated_at)

    created_q = (
        select(created_week.label("week"), func.count(Task.id).label("cnt"))
        .where(Task.created_at >= start)
        .group_by(created_week)
        .order_by(created_week)
    )
    created_rows = (await db.execute(created_q)).all()

    closed_q = (
        select(closed_week.label("week"), func.count(Task.id).label("cnt"))
        .where(
            and_(
                Task.status == TaskStatus.done,
                Task.updated_at >= start,
            )
        )
        .group_by(closed_week)
        .order_by(closed_week)
    )
    closed_rows = (await db.execute(closed_q)).all()

    created_map: dict[str, int] = {str(r.week.date()): r.cnt for r in created_rows}
    closed_map: dict[str, int] = {str(r.week.date()): r.cnt for r in closed_rows}

    all_weeks: set[str] = set(created_map) | set(closed_map)
    sorted_weeks = sorted(all_weeks)

    RU_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн",
                 "июл", "авг", "сен", "окт", "ноя", "дек"]

    data: list[WeekPoint] = []
    for w in sorted_weeks:
        from datetime import date
        d = date.fromisoformat(w)
        label = f"{d.day} {RU_MONTHS[d.month - 1]}"
        data.append(WeekPoint(
            week=w,
            week_label=label,
            created=created_map.get(w, 0),
            closed=closed_map.get(w, 0),
        ))

    return WeeklyStatsOut(period_weeks=weeks, data=data)


def _parse_days(period: str, default: int = 30) -> int:
    if period.endswith("d"):
        try:
            return int(period[:-1])
        except ValueError:
            return default
    return default


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(
    period: str = Query("30d", description="e.g. 7d, 30d, 90d"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Single role-scoped payload for the analytics screen.

    Teamlead → scoped to their own team; manager/admin → all teams.
    """
    if current_user.role not in (UserRole.teamlead, UserRole.manager, UserRole.admin):
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Access denied")

    days = _parse_days(period)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    non_terminal = [TaskStatus.draft, TaskStatus.assigned, TaskStatus.in_progress, TaskStatus.review]

    is_teamlead = current_user.role == UserRole.teamlead
    team_id = current_user.team_id if is_teamlead else None
    scope = "team" if is_teamlead else "global"

    team_name = None
    if is_teamlead and team_id:
        team_name = (await db.execute(select(Team.name).where(Team.id == team_id))).scalar_one_or_none()

    def task_period_filters():
        f = [Task.created_at >= start]
        if team_id:
            f.append(Task.team_id == team_id)
        return f

    # Totals (tasks created in period)
    total_tasks = (await db.execute(
        select(func.count(Task.id)).where(and_(*task_period_filters()))
    )).scalar_one()
    done = (await db.execute(
        select(func.count(Task.id)).where(and_(*task_period_filters(), Task.status == TaskStatus.done))
    )).scalar_one()
    completion_rate = round(done / total_tasks * 100) if total_tasks else 0

    # Status breakdown (period)
    status_rows = (await db.execute(
        select(Task.status, func.count(Task.id).label("count"))
        .where(and_(*task_period_filters()))
        .group_by(Task.status)
    )).all()
    by_status = [StatusCount(status=r.status.value, count=r.count) for r in status_rows]

    # Completion metrics (tasks closed in period)
    closed_filters = [Task.status == TaskStatus.done, Task.updated_at >= start]
    if team_id:
        closed_filters.append(Task.team_id == team_id)
    done_rows = (await db.execute(
        select(Task.created_at, Task.updated_at, Task.deadline).where(and_(*closed_filters))
    )).all()
    total_closed = len(done_rows)
    if total_closed:
        avg_days = sum((r.updated_at - r.created_at).total_seconds() for r in done_rows) / total_closed / 86400
        on_time = sum(1 for r in done_rows if r.deadline and r.updated_at <= r.deadline)
        on_time_percent = round(on_time / total_closed * 100, 1)
    else:
        avg_days = 0.0
        on_time_percent = 0.0

    # Overdue
    overdue_filters = [Task.deadline < now, Task.status.in_(non_terminal)]
    if team_id:
        overdue_filters.append(Task.team_id == team_id)
    overdue_count = (await db.execute(
        select(func.count(Task.id)).where(and_(*overdue_filters))
    )).scalar_one()
    overdue_rows = (await db.execute(
        select(Task, Team.name.label("team_name"))
        .outerjoin(Team, Task.team_id == Team.id)
        .where(and_(*overdue_filters))
        .order_by(Task.deadline.asc())
        .limit(50)
    )).all()
    overdue = [
        DashOverdue(
            id=row[0].id,
            title=row[0].title,
            team_name=row[1],
            deadline=row[0].deadline.isoformat() if row[0].deadline else "",
            priority=row[0].priority.value,
        )
        for row in overdue_rows
    ]

    # Tickets (scoped to team via linked tasks for teamlead)
    ticket_scope = []
    if team_id:
        ticket_scope.append(
            Ticket.task_id.in_(select(Task.id).where(Task.team_id == team_id))
        )
    active_tickets = (await db.execute(
        select(func.count(Ticket.id)).where(
            and_(Ticket.status.notin_([TicketStatus.closed, TicketStatus.rejected]), *ticket_scope)
        )
    )).scalar_one()
    t_period = [Ticket.created_at >= start, *ticket_scope]
    tickets_total = (await db.execute(
        select(func.count(Ticket.id)).where(and_(*t_period))
    )).scalar_one()
    t_status_rows = (await db.execute(
        select(Ticket.status, func.count(Ticket.id).label("count"))
        .where(and_(*t_period)).group_by(Ticket.status)
    )).all()
    tickets_by_status = [StatusCount(status=r.status.value, count=r.count) for r in t_status_rows]
    t_prio_rows = (await db.execute(
        select(Ticket.priority, func.count(Ticket.id).label("count"))
        .where(and_(*t_period)).group_by(Ticket.priority)
    )).all()
    tickets_by_priority = [DashPriority(priority=r.priority.value, count=r.count) for r in t_prio_rows]

    # Weekly created vs closed
    week_lit = text("'week'")
    created_week = func.date_trunc(week_lit, Task.created_at)
    closed_week = func.date_trunc(week_lit, Task.updated_at)
    cw_filters = [Task.created_at >= start] + ([Task.team_id == team_id] if team_id else [])
    clw_filters = [Task.status == TaskStatus.done, Task.updated_at >= start] + ([Task.team_id == team_id] if team_id else [])
    created_rows = (await db.execute(
        select(created_week.label("week"), func.count(Task.id).label("cnt"))
        .where(and_(*cw_filters)).group_by(created_week)
    )).all()
    closed_rows = (await db.execute(
        select(closed_week.label("week"), func.count(Task.id).label("cnt"))
        .where(and_(*clw_filters)).group_by(closed_week)
    )).all()
    created_map = {str(r.week.date()): r.cnt for r in created_rows}
    closed_map = {str(r.week.date()): r.cnt for r in closed_rows}
    from datetime import date as _date
    weekly = []
    for w in sorted(set(created_map) | set(closed_map)):
        d = _date.fromisoformat(w)
        weekly.append(DashWeekly(
            label=f"{d.day} {_RU_MONTHS[d.month - 1]}",
            created=created_map.get(w, 0),
            closed=closed_map.get(w, 0),
        ))

    # Team load (manager/admin) vs worker load (teamlead)
    team_load: list[DashTeamLoad] = []
    worker_load: list[DashWorkerLoad] = []
    if is_teamlead and team_id:
        members = (await db.execute(
            select(User.id, User.full_name).where(User.team_id == team_id)
        )).all()
        counts = []
        if members:
            counts = (await db.execute(
                select(Subtask.assignee_id, Subtask.status, func.count(Subtask.id).label("cnt"))
                .where(Subtask.assignee_id.in_([m.id for m in members]))
                .group_by(Subtask.assignee_id, Subtask.status)
            )).all()
        agg: dict = {}
        for r in counts:
            a = agg.setdefault(r.assignee_id, {"active": 0, "done": 0})
            if r.status == "done":
                a["done"] += r.cnt
            else:
                a["active"] += r.cnt
        for m in members:
            a = agg.get(m.id, {"active": 0, "done": 0})
            worker_load.append(DashWorkerLoad(name=m.full_name, active=a["active"], done=a["done"]))
        worker_load.sort(key=lambda w: w.active, reverse=True)
    else:
        teams = (await db.execute(select(Team))).scalars().all()
        for team in teams:
            active = (await db.execute(
                select(func.count(Task.id)).where(
                    and_(Task.team_id == team.id, Task.status.in_(non_terminal))
                )
            )).scalar_one()
            members = (await db.execute(
                select(func.count(User.id)).where(User.team_id == team.id)
            )).scalar_one()
            team_load.append(DashTeamLoad(team_name=team.name, active_tasks=active, member_count=members))

    return DashboardOut(
        scope=scope,
        team_name=team_name,
        period_days=days,
        total_tasks=total_tasks,
        done=done,
        completion_rate=completion_rate,
        avg_completion_days=round(avg_days, 1),
        on_time_percent=on_time_percent,
        overdue_count=overdue_count,
        active_tickets=active_tickets,
        by_status=by_status,
        weekly=weekly,
        team_load=team_load,
        worker_load=worker_load,
        tickets_total=tickets_total,
        tickets_by_status=tickets_by_status,
        tickets_by_priority=tickets_by_priority,
        overdue=overdue,
    )
