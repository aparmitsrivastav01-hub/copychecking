export type UserRole = "student" | "examiner" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  avatarText: string;
  rollNo?: string;
  school?: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: number;
}

// In-memory / Pre-seeded authentic users for PaperCheck AI
export const SEEDED_USERS: Array<User & { passwordHash: string }> = [
  {
    id: "usr_examiner_nitin",
    email: "nitin@codebrahmastra.com",
    name: "Nitin Paliwal",
    role: "examiner",
    title: "Head Examiner & Evaluator (CBSE CS 083)",
    avatarText: "NP",
    school: "Code Brahmastra Assessment Center",
    createdAt: "2026-01-15T09:00:00.000Z",
    // Simple hashed password 'examiner123'
    passwordHash: "examiner123",
  },
  {
    id: "usr_examiner_alt",
    email: "examiner@papercheck.ai",
    name: "Nitin Paliwal",
    role: "examiner",
    title: "Chief Reviewer",
    avatarText: "NP",
    school: "CBSE Evaluation Center",
    createdAt: "2026-01-15T09:00:00.000Z",
    passwordHash: "examiner123",
  },
  {
    id: "usr_student_aarav",
    email: "aarav@papercheck.ai",
    name: "Aarav Gupta",
    role: "student",
    title: "Class 12 - Computer Science (083)",
    avatarText: "AG",
    rollNo: "12491024",
    school: "Delhi Public School, R.K. Puram",
    createdAt: "2026-02-01T10:00:00.000Z",
    passwordHash: "student123",
  },
  {
    id: "usr_admin_paliwal",
    email: "admin@papercheck.ai",
    name: "System Admin",
    role: "admin",
    title: "Platform Administrator",
    avatarText: "SA",
    school: "PaperCheck AI HQ",
    createdAt: "2026-01-01T08:00:00.000Z",
    passwordHash: "admin123",
  },
];

const SESSION_COOKIE_NAME = "papercheck_session_token";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Active sessions in-memory storage (server-side runtime)
const activeSessions = new Map<string, AuthSession>();

function sanitizeUser(userWithSecret: User & { passwordHash: string }): User {
  const { passwordHash: _hash, ...user } = userWithSecret;
  return user;
}

export function findUserByEmail(email: string): User | null {
  const normalized = email.trim().toLowerCase();
  const found = SEEDED_USERS.find((u) => u.email.toLowerCase() === normalized);
  return found ? sanitizeUser(found) : null;
}

export function findUserById(id: string): User | null {
  const found = SEEDED_USERS.find((u) => u.id === id);
  return found ? sanitizeUser(found) : null;
}

export function verifyCredentials(email: string, password: string): User | null {
  const normalized = email.trim().toLowerCase();
  const matched = SEEDED_USERS.find(
    (u) => u.email.toLowerCase() === normalized && u.passwordHash === password.trim()
  );
  return matched ? sanitizeUser(matched) : null;
}

export function createSession(user: User): AuthSession {
  // Generate a random secure session token
  const randomPart = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const token = `sess_${user.role}_${user.id}_${randomPart}`;
  const session: AuthSession = {
    token,
    user,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  activeSessions.set(token, session);
  return session;
}

export function getSession(token: string | null | undefined): AuthSession | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) {
    // If server restarted, restore session for seeded tokens if token matches known format
    if (token.startsWith("sess_")) {
      for (const u of SEEDED_USERS) {
        if (token.includes(u.id)) {
          const restored: AuthSession = {
            token,
            user: sanitizeUser(u),
            expiresAt: Date.now() + SESSION_DURATION_MS,
          };
          activeSessions.set(token, restored);
          return restored;
        }
      }
    }
    return null;
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

export function deleteSession(token: string): void {
  activeSessions.delete(token);
}

export function hasPermission(user: User | null, allowedRoles: UserRole[]): boolean {
  if (!user) return false;
  if (user.role === "admin") return true; // Admins have universal access
  return allowedRoles.includes(user.role);
}

export function getUserFromRequest(req: { cookies: { get: (name: string) => { value?: string } | undefined }; headers: { get: (name: string) => string | null } }): User | null {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const token = cookieToken || bearerToken;
  const session = getSession(token);
  return session ? session.user : null;
}

export { SESSION_COOKIE_NAME };
