const SOCKET_URL = "";

const BASE_URL = `${SOCKET_URL}api/`;

// placeholder — update when backend API is finalized
const ENDPOINTS = {
  LOGIN: "auth/login",
  // Dashboard
  DASHBOARD: "coach/dashboard",
  // Teams
  TEAMS: "coach/teams",
  TEAM_DETAILS: (teamId: string) => `coach/teams/${teamId}`,
  // Schedule
  SCHEDULE: "coach/schedule",
  // Messages
  MESSAGES: "coach/messages",
  MESSAGE_DETAILS: (messageId: string) => `coach/messages/${messageId}`,
  DIRECT_CHAT: (chatId: string) => `chat/direct/${chatId}`,
  TEAM_CHAT: (teamId: string) => `chat/team/${teamId}`,
  // Payments
  PAYMENTS: "coach/payments",
  PAYMENTS_SUMMARY: "coach/payments/summary",
  PAYMENT_PLAN: (planId: string) => `coach/payment-plans/${planId}`,
  // Profile
  PROFILE: "coach/profile",
  CHANGE_PASSWORD: "coach/change-password",
};

export { BASE_URL, ENDPOINTS, SOCKET_URL };
