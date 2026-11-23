/* Serial, optimistic writes: never silently overwrite a newer device's document. */
(function(root) {
  class CloudStore {
    constructor({client, userId, row, onStatus = () => {}, draftStorage}) {
      Object.assign(this, {client, userId, onStatus, draftStorage});
      this.revision = row.revision;
      this.value = row.payload === null ? null : JSON.stringify(row.payload);
      this.saved = this.value;
      this.pending = null;
      this.running = null;
      this.error = null;
      this.draftKey = 'guilt-trip-draft:' + userId;
      let raw = null;
      try { raw = draftStorage?.getItem(this.draftKey); } catch {}
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.value !== this.saved) {
          this.value = draft.value;
          this.pending = draft.value;
          if (draft.revision !== this.revision) this.error = new Error('Another tab or device has newer changes. Download this tab’s data, then reload the saved version.');
        } else this.removeDraft();
      }
    }
    getItem(key) { return key === 'unfuck-day-v2' ? this.value : null; }
    setItem(key, value) {
      if (key !== 'unfuck-day-v2' || value === this.value) return;
      this.value = value;
      this.pending = value;
      this.keepDraft();
      this.flush().catch(() => {});
    }
    keepDraft() {
      try { this.draftStorage?.setItem(this.draftKey, JSON.stringify({revision:this.revision, value:this.value})); }
      catch { this.onStatus('Changes are held in this tab only until saved. Keep it open.'); }
    }
    get dirty() { return this.pending !== null || !!this.running; }
    async flush() {
      if (this.error) throw this.error;
      if (this.running) return this.running;
      this.running = this.drain();
      try { await this.running; } finally { this.running = null; }
    }
    async drain() {
      while (this.pending !== null) {
        const snapshot = this.pending;
        this.onStatus('Saving…');
        try {
          const {data,error} = await this.client.from('habit_accounts')
            .update({payload:JSON.parse(snapshot)})
            .eq('user_id',this.userId).eq('revision',this.revision)
            .select('revision').maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('Another tab or device has newer changes. Download this tab’s data, then reload the saved version.');
          this.revision = data.revision;
          this.saved = snapshot;
          if (this.pending === snapshot) this.pending = null;
          if (this.pending === null) this.removeDraft();
          else this.keepDraft();
        } catch(error) {
          this.error = error;
          this.keepDraft();
          this.onStatus('Not saved online. Keep this tab open. ' + error.message, true);
          throw error;
        }
      }
      this.onStatus('Saved to your account');
    }
    async retry() { this.error = null; return this.flush(); }
    removeDraft() { try { this.draftStorage?.removeItem(this.draftKey); } catch {} }
    discardDraft() { this.removeDraft(); }
  }
  root.GuiltCloudStore = CloudStore;
  if (typeof module !== 'undefined') module.exports = CloudStore;
})(typeof window !== 'undefined' ? window : globalThis);
