export const TANSTACK_KEYS = {
  // coach

  // Dashboard
  dashboard: ["coach", "dashboard"],
  // Teams
  teams: ["coach", "teams"],
  teamDetails: (teamId: string) => ["coach", "teamDetails", teamId],
  // Schedule
  schedule: ["coach", "schedule"],
  // Messages
  messages: ["coach", "messages"],
  messageDetails: (messageId: string) => ["coach", "messageDetails", messageId],
  directChatInfo: (chatId: string) => ["directChatInfo", chatId],
  directChatMessages: (chatId: string) => ["directChatMessages", chatId],
  teamChatInfo: (teamId: string) => ["teamChatInfo", teamId],
  teamChatMessages: (teamId: string) => ["teamChatMessages", teamId],
  teamAnnouncements: (teamId: string) => ["teamAnnouncements", teamId],
  // Payments
  payments: ["coach", "payments"],
  paymentsSummary: ["coach", "payments", "summary"],
  paymentPlanDetail: (planId: string) => ["coach", "paymentPlanDetail", planId],
  // Profile

  // shared
  playerDetails: (playerId: string) => ["shared", "playerDetails", playerId],

  // parent
  parentSchedule: ["parent", "schedule"],
  parentDashboard: ["parent", "dashboard"],
  myFamily: ["parent", "myFamily"],
  programs: ["parent", "programs"],
  programDetails: (id: string) => ["parent", "programDetails", id],
  registration: ["parent", "registration"],
  parentMessages: ["parent", "messages"],
  parentMessageDetails: (messageId: string) => ["parent", "messageDetails", messageId],
  parentPayments: ["parent", "payments"],
  parentPaymentsSummary: ["parent", "payments", "summary"],
  parentOrganizations: ["parent", "organizations"],
  parentTeamInvitations: ["parent", "teamInvitations"],
  parentTeamInvitationDetail: (id: string) => ["parent", "teamInvitationDetail", id],
};
