import fs from "node:fs";
import path from "node:path";
import session, { type SessionData } from "express-session";

type StoredSession = {
  data: SessionData;
  expiresAt?: number | null;
};

type PersistedSessions = {
  sessions: Record<string, StoredSession>;
};

export class JsonFileSessionStore extends session.Store {
  private filePath: string;
  private sessions: Map<string, StoredSession> = new Map();
  private saveTimer: NodeJS.Timeout | undefined;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    this.load();
  }

  get(sid: string, callback: (err?: any, session?: SessionData | null) => void) {
    const record = this.sessions.get(sid);
    if (!record) {
      callback(undefined, undefined);
      return;
    }
    if (this.isExpired(record)) {
      this.sessions.delete(sid);
      this.scheduleSave();
      callback(undefined, undefined);
      return;
    }
    callback(undefined, record.data);
  }

  set(sid: string, session: SessionData, callback?: (err?: any) => void) {
    this.sessions.set(sid, {
      data: session,
      expiresAt: this.getExpiresAt(session),
    });
    this.scheduleSave();
    callback?.();
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    this.sessions.delete(sid);
    this.scheduleSave();
    callback?.();
  }

  touch(sid: string, session: SessionData, callback?: (err?: any) => void) {
    const record = this.sessions.get(sid);
    if (record) {
      record.data = session;
      record.expiresAt = this.getExpiresAt(session);
      this.scheduleSave();
    }
    callback?.();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedSessions;
      const entries = Object.entries(parsed.sessions ?? {});
      for (const [sid, record] of entries) {
        this.sessions.set(sid, record);
      }
      this.pruneExpired();
    } catch (err) {
      console.error("Failed to load session store", err);
    }
  }

  private persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const payload: PersistedSessions = {
        sessions: Object.fromEntries(this.sessions.entries()),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save session store", err);
    }
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.pruneExpired();
      this.persist();
    }, 200);
  }

  private pruneExpired() {
    const now = Date.now();
    for (const [sid, record] of this.sessions.entries()) {
      if (record.expiresAt && record.expiresAt <= now) {
        this.sessions.delete(sid);
      }
    }
  }

  private isExpired(record: StoredSession) {
    if (!record.expiresAt) return false;
    return record.expiresAt <= Date.now();
  }

  private getExpiresAt(session: SessionData) {
    const cookie = session.cookie;
    if (!cookie) return null;
    if (cookie.expires) {
      const expires =
        typeof cookie.expires === "string" || typeof cookie.expires === "number"
          ? new Date(cookie.expires).getTime()
          : cookie.expires.getTime();
      return Number.isFinite(expires) ? expires : null;
    }
    if (typeof cookie.maxAge === "number") {
      return Date.now() + cookie.maxAge;
    }
    return null;
  }
}
