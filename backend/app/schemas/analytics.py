import uuid
from typing import List, Dict, Optional
from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class TasksByStatusOut(BaseModel):
    period_days: int
    team_id: Optional[uuid.UUID] = None
    data: List[StatusCount]


class ServiceAvg(BaseModel):
    service_id: uuid.UUID
    service_name: str
    avg_hours: Optional[float] = None
    sample_size: int


class AvgCompletionTimeOut(BaseModel):
    period_days: int
    avg_hours: Optional[float] = None
    sample_size: int
    by_service: List[ServiceAvg] = []


class FrequentlyRejectedItem(BaseModel):
    id: uuid.UUID
    title: str
    reject_count: int
    status: str
    service_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None


class FrequentlyRejectedOut(BaseModel):
    period_days: int
    total: int
    items: List[FrequentlyRejectedItem]


class TeamMemberLoad(BaseModel):
    team_id: uuid.UUID
    team_name: str
    active_tasks: int
    active_subtasks: int
    member_count: int


class TeamLoadOut(BaseModel):
    data: List[TeamMemberLoad]


class OverdueItem(BaseModel):
    id: uuid.UUID
    title: str
    deadline: str
    team_id: Optional[uuid.UUID] = None
    team_name: Optional[str] = None
    priority: str
    status: str


class OverdueOut(BaseModel):
    total: int
    items: List[OverdueItem]


class TicketStatusCount(BaseModel):
    status: str
    count: int


class TicketsStatsOut(BaseModel):
    period_days: int
    total: int
    by_status: List[TicketStatusCount]
    by_priority: List[Dict]


class WeekPoint(BaseModel):
    week: str
    week_label: str
    created: int
    closed: int


class WeeklyStatsOut(BaseModel):
    period_weeks: int
    data: List[WeekPoint]


class DashWeekly(BaseModel):
    label: str
    created: int
    closed: int


class DashWorkerLoad(BaseModel):
    name: str
    active: int
    done: int


class DashTeamLoad(BaseModel):
    team_name: str
    active_tasks: int
    member_count: int


class DashOverdue(BaseModel):
    id: uuid.UUID
    title: str
    team_name: Optional[str] = None
    deadline: str
    priority: str


class DashPriority(BaseModel):
    priority: str
    count: int


class DashboardOut(BaseModel):
    scope: str
    team_name: Optional[str] = None
    period_days: int
    total_tasks: int
    done: int
    completion_rate: int
    avg_completion_days: float
    on_time_percent: float
    overdue_count: int
    active_tickets: int
    by_status: List[StatusCount]
    weekly: List[DashWeekly]
    team_load: List[DashTeamLoad] = []
    worker_load: List[DashWorkerLoad] = []
    tickets_total: int = 0
    tickets_by_status: List[StatusCount] = []
    tickets_by_priority: List[DashPriority] = []
    overdue: List[DashOverdue] = []
