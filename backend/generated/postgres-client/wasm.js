
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.WorkScalarFieldEnum = {
  id: 'id',
  name: 'name',
  address: 'address',
  cep: 'cep',
  startDate: 'startDate',
  ppcTargetPct: 'ppcTargetPct',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  passwordHash: 'passwordHash',
  isActive: 'isActive',
  contractorId: 'contractorId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserWorkRoleScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  workId: 'workId',
  role: 'role',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  assignedById: 'assignedById'
};

exports.Prisma.PermissionProfileScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  baseRole: 'baseRole',
  isSystem: 'isSystem',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProfilePermissionScalarFieldEnum = {
  id: 'id',
  profileId: 'profileId',
  permissionKey: 'permissionKey'
};

exports.Prisma.UserProfileAssignmentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  workId: 'workId',
  profileId: 'profileId',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  assignedById: 'assignedById',
  roleAssignmentId: 'roleAssignmentId'
};

exports.Prisma.ContractorFunctionScalarFieldEnum = {
  id: 'id',
  name: 'name'
};

exports.Prisma.ContractorScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  name: 'name',
  contact: 'contact',
  functionId: 'functionId'
};

exports.Prisma.LocationScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  level1: 'level1',
  level2: 'level2'
};

exports.Prisma.CauseScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  description: 'description'
};

exports.Prisma.TaskGroupScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TaskGroupItemScalarFieldEnum = {
  id: 'id',
  taskGroupId: 'taskGroupId',
  sequenceNumber: 'sequenceNumber',
  description: 'description',
  defaultContractorId: 'defaultContractorId',
  defaultSupervisor: 'defaultSupervisor',
  defaultLocationL1: 'defaultLocationL1',
  defaultLocationL2: 'defaultLocationL2'
};

exports.Prisma.WeekScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  weekNumber: 'weekNumber',
  year: 'year',
  startDate: 'startDate',
  endDate: 'endDate',
  prePlanningStatus: 'prePlanningStatus',
  prePlanningClosedAt: 'prePlanningClosedAt',
  prePlanningClosedById: 'prePlanningClosedById',
  planningStatus: 'planningStatus',
  feedbackStatus: 'feedbackStatus',
  qualityStatus: 'qualityStatus',
  planningClosedAt: 'planningClosedAt',
  planningClosedById: 'planningClosedById',
  feedbackClosedAt: 'feedbackClosedAt',
  feedbackClosedById: 'feedbackClosedById',
  qualityClosedAt: 'qualityClosedAt',
  qualityClosedById: 'qualityClosedById',
  reopenedAt: 'reopenedAt',
  reopenedById: 'reopenedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WeekPpcMeetingScalarFieldEnum = {
  id: 'id',
  weekId: 'weekId',
  meetingAt: 'meetingAt',
  minutes: 'minutes',
  isClosed: 'isClosed',
  closedAt: 'closedAt',
  closedById: 'closedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PpcMeetingAttendanceScalarFieldEnum = {
  id: 'id',
  meetingId: 'meetingId',
  contractorId: 'contractorId',
  present: 'present',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WeekWeatherDayScalarFieldEnum = {
  id: 'id',
  weekId: 'weekId',
  dayDate: 'dayDate',
  weekday: 'weekday',
  icon: 'icon',
  tempMinC: 'tempMinC',
  tempMaxC: 'tempMaxC',
  precipitationMm: 'precipitationMm',
  precipitationProbabilityPct: 'precipitationProbabilityPct'
};

exports.Prisma.HolidayScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  dayDate: 'dayDate',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  sequenceNumber: 'sequenceNumber',
  originWeekId: 'originWeekId',
  currentWeekId: 'currentWeekId',
  contractorId: 'contractorId',
  supervisor: 'supervisor',
  locationId: 'locationId',
  description: 'description',
  plannedStart: 'plannedStart',
  plannedEnd: 'plannedEnd',
  actualStart: 'actualStart',
  actualEnd: 'actualEnd',
  status: 'status',
  isUnplanned: 'isUnplanned',
  rolledFromTaskId: 'rolledFromTaskId',
  canceledAt: 'canceledAt',
  canceledById: 'canceledById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PreTaskScalarFieldEnum = {
  id: 'id',
  sequenceNumber: 'sequenceNumber',
  originWeekId: 'originWeekId',
  weekId: 'weekId',
  contractorId: 'contractorId',
  supervisor: 'supervisor',
  locationId: 'locationId',
  description: 'description',
  plannedStart: 'plannedStart',
  plannedEnd: 'plannedEnd',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PreTaskPlannedDayScalarFieldEnum = {
  id: 'id',
  preTaskId: 'preTaskId',
  weekday: 'weekday',
  plannedDate: 'plannedDate'
};

exports.Prisma.TaskPlannedDayScalarFieldEnum = {
  id: 'id',
  taskId: 'taskId',
  weekday: 'weekday',
  plannedDate: 'plannedDate',
  actualDate: 'actualDate'
};

exports.Prisma.FeedbackScalarFieldEnum = {
  id: 'id',
  taskId: 'taskId',
  weekId: 'weekId',
  status: 'status',
  causeId: 'causeId',
  comments: 'comments',
  submittedAt: 'submittedAt',
  submittedById: 'submittedById'
};

exports.Prisma.ReopenRequestScalarFieldEnum = {
  id: 'id',
  weekId: 'weekId',
  requestedById: 'requestedById',
  requestedAt: 'requestedAt',
  reason: 'reason',
  status: 'status',
  approvedById: 'approvedById',
  approvedAt: 'approvedAt',
  rejectedAt: 'rejectedAt'
};

exports.Prisma.FutureWeekAuthorizationScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  requestedWeekNumber: 'requestedWeekNumber',
  requestedById: 'requestedById',
  requestedAt: 'requestedAt',
  reason: 'reason',
  status: 'status',
  approvedById: 'approvedById',
  approvedAt: 'approvedAt',
  rejectedAt: 'rejectedAt'
};

exports.Prisma.NotificationRuleScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  prePlanningDeadlineWeekday: 'prePlanningDeadlineWeekday',
  prePlanningDeadlineTime: 'prePlanningDeadlineTime',
  ppcMeetingDeadlineWeekday: 'ppcMeetingDeadlineWeekday',
  ppcMeetingDeadlineTime: 'ppcMeetingDeadlineTime',
  planningDeadlineWeekday: 'planningDeadlineWeekday',
  planningDeadlineTime: 'planningDeadlineTime',
  feedbackDeadlineWeekday: 'feedbackDeadlineWeekday',
  feedbackDeadlineTime: 'feedbackDeadlineTime',
  qualityDeadlineWeekday: 'qualityDeadlineWeekday',
  qualityDeadlineTime: 'qualityDeadlineTime',
  emailRecipients: 'emailRecipients',
  enabled: 'enabled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WeekPerceivedQualityItemScalarFieldEnum = {
  id: 'id',
  weekId: 'weekId',
  contractorId: 'contractorId',
  qualityScore: 'qualityScore',
  collaborationTeamScore: 'collaborationTeamScore',
  safetyScore: 'safetyScore',
  cleaningScore: 'cleaningScore',
  comments: 'comments',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppConfigScalarFieldEnum = {
  id: 'id',
  companyName: 'companyName',
  companyCnpj: 'companyCnpj',
  companyAddress: 'companyAddress',
  companyCep: 'companyCep',
  companyStreet: 'companyStreet',
  companyNeighborhood: 'companyNeighborhood',
  companyCity: 'companyCity',
  companyState: 'companyState',
  companyNumber: 'companyNumber',
  companyComplement: 'companyComplement',
  companySite: 'companySite',
  logoPath: 'logoPath',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkPerceivedQualityConfigScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  deadlineRegularPct: 'deadlineRegularPct',
  deadlineGoodPct: 'deadlineGoodPct',
  qualityRegularScore: 'qualityRegularScore',
  qualityGoodScore: 'qualityGoodScore',
  collaborationPresenceImpactScore: 'collaborationPresenceImpactScore',
  collaborationRegularScore: 'collaborationRegularScore',
  collaborationGoodScore: 'collaborationGoodScore',
  safetyRegularScore: 'safetyRegularScore',
  safetyGoodScore: 'safetyGoodScore',
  cleaningRegularScore: 'cleaningRegularScore',
  cleaningGoodScore: 'cleaningGoodScore',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkFeasibilityScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  analysisDate: 'analysisDate',
  totalInvestment: 'totalInvestment',
  expectedRevenue: 'expectedRevenue',
  expectedOperatingCosts: 'expectedOperatingCosts',
  expectedDurationMonths: 'expectedDurationMonths',
  riskLevel: 'riskLevel',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkFeasibilitySnapshotScalarFieldEnum = {
  id: 'id',
  workId: 'workId',
  referenceDate: 'referenceDate',
  plannedProgressPct: 'plannedProgressPct',
  actualProgressPct: 'actualProgressPct',
  plannedCostAccum: 'plannedCostAccum',
  actualCostAccum: 'actualCostAccum',
  plannedRevenueAccum: 'plannedRevenueAccum',
  actualRevenueAccum: 'actualRevenueAccum',
  status: 'status',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditEventScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  workId: 'workId',
  entityType: 'entityType',
  entityId: 'entityId',
  eventType: 'eventType',
  description: 'description',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Work: 'Work',
  User: 'User',
  UserWorkRole: 'UserWorkRole',
  PermissionProfile: 'PermissionProfile',
  ProfilePermission: 'ProfilePermission',
  UserProfileAssignment: 'UserProfileAssignment',
  ContractorFunction: 'ContractorFunction',
  Contractor: 'Contractor',
  Location: 'Location',
  Cause: 'Cause',
  TaskGroup: 'TaskGroup',
  TaskGroupItem: 'TaskGroupItem',
  Week: 'Week',
  WeekPpcMeeting: 'WeekPpcMeeting',
  PpcMeetingAttendance: 'PpcMeetingAttendance',
  WeekWeatherDay: 'WeekWeatherDay',
  Holiday: 'Holiday',
  Task: 'Task',
  PreTask: 'PreTask',
  PreTaskPlannedDay: 'PreTaskPlannedDay',
  TaskPlannedDay: 'TaskPlannedDay',
  Feedback: 'Feedback',
  ReopenRequest: 'ReopenRequest',
  FutureWeekAuthorization: 'FutureWeekAuthorization',
  NotificationRule: 'NotificationRule',
  WeekPerceivedQualityItem: 'WeekPerceivedQualityItem',
  AppConfig: 'AppConfig',
  WorkPerceivedQualityConfig: 'WorkPerceivedQualityConfig',
  WorkFeasibility: 'WorkFeasibility',
  WorkFeasibilitySnapshot: 'WorkFeasibilitySnapshot',
  AuditEvent: 'AuditEvent'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
