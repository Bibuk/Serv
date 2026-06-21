import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User, UserRole
from app.models.team import Team
from app.schemas.team import TeamOut, TeamCreate, TeamUpdate, TeamListOut
from app.dependencies import require_admin, get_current_user
from app.services.audit import log_action
from app.models.audit_log import AuditEntityType

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/", response_model=TeamListOut)
async def list_teams(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Managers/teamleads need team lists (e.g. to assign tasks); clients do not
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    total = (await db.execute(select(func.count(Team.id)))).scalar_one()
    teams = (
        await db.execute(
            select(Team).order_by(Team.name).offset((page - 1) * size).limit(size)
        )
    ).scalars().all()
    return TeamListOut(
        items=[TeamOut.model_validate(t) for t in teams],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
async def create_team(
    body: TeamCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    team = Team(name=body.name, teamlead_id=body.teamlead_id)
    db.add(team)
    await db.flush()
    log_action(db, current_user.id, "team.created", AuditEntityType.team, team.id,
               {"name": team.name})
    await db.refresh(team)
    return TeamOut.model_validate(team)


@router.get("/{team_id}", response_model=TeamOut)
async def get_team(
    team_id: uuid.UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return TeamOut.model_validate(team)


@router.patch("/{team_id}", response_model=TeamOut)
async def update_team(
    team_id: uuid.UUID,
    body: TeamUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.flush()
    log_action(db, current_user.id, "team.updated", AuditEntityType.team, team.id,
               {"fields": sorted(update_data.keys())})
    await db.refresh(team)
    return TeamOut.model_validate(team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    log_action(db, current_user.id, "team.deleted", AuditEntityType.team, team.id,
               {"name": team.name})
    await db.delete(team)
    await db.flush()
