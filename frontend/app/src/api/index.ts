export { ApiError, apiClient, setUnauthorizedHandler } from './client';
export type { LoginCredentials, AuthResult } from './auth';
export { authLogin, authLogout, authMe } from './auth';
export {
  getTasks, getTask, createTask, updateTask, updateTaskStatus,
  acceptTask, submitTaskReview, assignTask, approveTask, rejectTask,
  getMySubtasks, getTaskComments,
  addTaskComment, archiveTask, deleteTask,
  createSubtask, updateSubtask, deleteSubtask,
  getSubtaskFiles, uploadSubtaskFile, deleteSubtaskFile,
  getTaskFiles, uploadTaskFile, deleteTaskFile,
} from './tasks';
export type { CreateSubtaskDto, UpdateSubtaskDto, FileAttachment } from './tasks';
export {
  getTickets, getTicket, createTicket, addTicketComment, getTicketComments,
  updateTicketStatus, updateTicketPriority, rejectTicket, linkTaskToTicket,
} from './tickets';
export {
  getServices, createService, updateService, deleteService,
  getApplications, createApplication, updateApplication, setApplicationArchived,
} from './services';
export type { ServiceDto, AppDto } from './services';
export {
  getUsers, getUser, updateProfile, changePassword,
  createUser, updateUser, deactivateUser, setUserActive,
} from './users';
export type {
  UpdateProfileDto, ChangePasswordDto, UsersFilter,
  AdminUserCreateDto, AdminUserUpdateDto,
} from './users';
export { getTeams, createTeam, updateTeam, deleteTeam } from './teams';
export type { TeamDetail, CreateTeamDto, UpdateTeamDto } from './teams';
export { getNotifications, markNotificationRead, markAllNotificationsRead } from './notifications';
export type { NotificationDto } from './notifications';
export { NotificationSocket } from './realtime';
export type { NotificationSocketHandlers } from './realtime';
export { getAuditLog } from './audit';
export type { CreateTaskDto, UpdateTaskDto, CreateCommentDto, CreateTicketDto, TasksQuery, TicketsQuery, AuditQuery } from './dto';
