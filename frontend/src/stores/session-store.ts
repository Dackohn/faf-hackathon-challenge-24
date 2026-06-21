import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { loginAdmin as loginAdminRequest, loginGuest } from "@/lib/auth-client";
import type { GuestProfile } from "@/types/guest";

export type GuestSession = {
  role: "guest";
  guest: GuestProfile;
};

export type AdminSession = {
  role: "admin";
  displayName: string;
};

export type AppSession = GuestSession | AdminSession;

interface PersistedSessionState {
  session?: AppSession | null;
  guest?: GuestProfile | null;
  token?: string | null;
}

interface SessionState {
  session: AppSession | null;
  guest: GuestProfile | null;
  isAdmin: boolean;
  token: string | null;
  selectGuest: (guest: GuestProfile) => Promise<void>;
  loginAdmin: (passcode: string, displayName?: string) => Promise<void>;
  clearSession: () => void;
  clearGuest: () => void;
}

const EMPTY_SESSION_STATE = {
  session: null,
  guest: null,
  isAdmin: false,
  token: null,
} satisfies Pick<SessionState, "session" | "guest" | "isAdmin" | "token">;

function guestSessionState(guest: GuestProfile, token: string) {
  const session: GuestSession = { role: "guest", guest };

  return {
    session,
    guest,
    isAdmin: false,
    token,
  };
}

function adminSessionState(displayName: string, token: string) {
  return {
    session: { role: "admin", displayName } satisfies AdminSession,
    guest: null,
    isAdmin: true,
    token,
  };
}

function deriveGuest(session: AppSession | null): GuestProfile | null {
  return session?.role === "guest" ? session.guest : null;
}

function migrateSessionState(persisted: unknown): Partial<SessionState> {
  const state = persisted as PersistedSessionState | null;
  const session = state?.session ?? null;
  const token = state?.token ?? null;

  if (session) {
    return {
      session,
      guest: deriveGuest(session),
      isAdmin: session.role === "admin",
      token,
    };
  }

  if (state?.guest) {
    return { ...guestSessionState(state.guest, token ?? ""), token };
  }

  return EMPTY_SESSION_STATE;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...EMPTY_SESSION_STATE,

      selectGuest: async (guest) => {
        const token = await loginGuest(guest.id);
        set(guestSessionState(guest, token));
      },

      loginAdmin: async (passcode, displayName = "Admin") => {
        const token = await loginAdminRequest(passcode);
        set(adminSessionState(displayName, token));
      },

      clearSession: () => set(EMPTY_SESSION_STATE),

      clearGuest: () => set(EMPTY_SESSION_STATE),
    }),
    {
      name: "kikis-paradise-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ session: state.session, token: state.token }),
      merge: (persisted, current) => ({
        ...current,
        ...migrateSessionState(persisted),
      }),
    }
  )
);
