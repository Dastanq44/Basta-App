// Push notifications interface (skeleton). Reminders with quiet hours, frequency caps,
// and user controls are implemented in Phase 4 (see TASKS T-050). Registration/scheduling
// is server-driven; the client registers a token and handles deep-links.

export interface PushService {
  registerForPush(): Promise<string | null>;
  unregister(): Promise<void>;
}

export const push: PushService = {
  async registerForPush() {
    return null;
  },
  async unregister() {},
};
