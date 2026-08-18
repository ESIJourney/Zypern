/**
 * @ohm/meta-admin-sdk - Universal In-Browser Meta-Admin & Visual Inline Editor
 * Provides an inline-editing overlay, OHM SSO authentication, and GitHub API Auto-Sync.
 */

(function(global) {
  'use strict';

  const DEFAULT_CONFIG = {
    repoOwner: 'ESIJourney',
    repoName: 'Zypern',
    branch: 'main',
    filePath: 'journey.html',
    apiEndpoint: '/exitstrategy-api',
    authStorageKey: 'esi_crm_token',
    githubTokenStorageKey: 'esi_github_pat',
    ssoLoginUrl: '/crm/crm.html',
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'span', 'strong', 'em', 'b', 'i', 'figcaption', 'div']
  };

  class MetaAdminSDK {
    constructor(userConfig = {}) {
      this.config = Object.assign({}, DEFAULT_CONFIG, userConfig);
      this.isEditing = false;
      this.activeElement = null;
      this.originalContent = new Map();
      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.injectUI());
      } else {
        this.injectUI();
      }
    }

    getAuthToken() {
      return localStorage.getItem(this.config.authStorageKey) || '';
    }

    getGitHubToken() {
      return localStorage.getItem(this.config.githubTokenStorageKey) || '';
    }

    isAuthenticated() {
      return !!(this.getAuthToken() || this.getGitHubToken());
    }

    injectUI() {
      if (document.getElementById('meta-admin-sdk-root')) return;

      const host = document.createElement('div');
      host.id = 'meta-admin-sdk-root';
      host.innerHTML = `
        <style>
          #meta-admin-sdk-bar {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(212, 175, 55, 0.4);
            border-radius: 50px;
            padding: 8px 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            color: #ffffff;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          #meta-admin-sdk-bar:hover {
            border-color: rgba(212, 175, 55, 0.8);
            box-shadow: 0 14px 30px rgba(0,0,0,0.6);
          }
          .meta-admin-btn {
            background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
            color: #0f172a;
            border: none;
            border-radius: 999px;
            padding: 6px 14px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: transform 0.15s ease, opacity 0.15s ease;
          }
          .meta-admin-btn:hover {
            transform: scale(1.04);
          }
          .meta-admin-btn.secondary {
            background: rgba(255,255,255,0.1);
            color: #f1f5f9;
            border: 1px solid rgba(255,255,255,0.2);
          }
          .meta-admin-status {
            font-size: 12px;
            color: #94a3b8;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .meta-admin-editable-highlight {
            outline: 2px dashed #eab308 !important;
            outline-offset: 3px !important;
            cursor: text !important;
            position: relative;
          }
          .meta-admin-editable-highlight:hover {
            background: rgba(234, 179, 8, 0.12) !important;
          }
          #meta-admin-modal {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.75);
            z-index: 1000000;
            display: none;
            align-items: center;
            justify-content: center;
          }
          .meta-admin-modal-card {
            background: #0f172a;
            border: 1px solid rgba(212, 175, 55, 0.4);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 440px;
            color: #fff;
            box-shadow: 0 20px 40px rgba(0,0,0,0.7);
          }
        </style>

        <div id="meta-admin-sdk-bar">
          <span style="font-size: 15px;">🛠️</span>
          <span id="meta-admin-label" style="font-weight: 600; font-size: 13px; color: #fef08a;">Meta-Admin</span>
          <span id="meta-admin-status-text" class="meta-admin-status">Bereit</span>
          <button id="meta-admin-toggle-btn" class="meta-admin-btn">Editieren</button>
          <button id="meta-admin-save-btn" class="meta-admin-btn" style="display: none; background: #22c55e; color:#fff;">✓ Sync to GitHub</button>
          <button id="meta-admin-settings-btn" class="meta-admin-btn secondary" style="padding: 6px 8px;" title="Einstellungen">⚙️</button>
        </div>

        <div id="meta-admin-modal">
          <div class="meta-admin-modal-card">
            <h3 style="margin-top:0; color:#fef08a; font-size: 1.2rem;">⚙️ Meta-Admin &amp; GitHub Sync</h3>
            <p style="font-size: 0.85rem; color:#94a3b8; line-height: 1.5;">
              Gib dein GitHub Personal Access Token (PAT) ein oder nutze den OHM-SSO-Login für automatische Repo-Syncs.
            </p>
            <div style="margin: 15px 0;">
              <label style="font-size: 12px; color:#cbd5e1; display:block; margin-bottom: 4px;">GitHub PAT (repo permission):</label>
              <input type="password" id="meta-admin-pat-input" style="width:100%; box-sizing:border-box; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:10px; color:#fff;" placeholder="ghp_..."/>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button id="meta-admin-modal-close" class="meta-admin-btn secondary">Abbrechen</button>
              <button id="meta-admin-modal-save" class="meta-admin-btn">Speichern</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(host);
      this.bindEvents();
    }

    bindEvents() {
      const toggleBtn = document.getElementById('meta-admin-toggle-btn');
      const saveBtn = document.getElementById('meta-admin-save-btn');
      const settingsBtn = document.getElementById('meta-admin-settings-btn');
      const modal = document.getElementById('meta-admin-modal');
      const modalClose = document.getElementById('meta-admin-modal-close');
      const modalSave = document.getElementById('meta-admin-modal-save');
      const patInput = document.getElementById('meta-admin-pat-input');

      toggleBtn.addEventListener('click', () => this.toggleEditMode());
      saveBtn.addEventListener('click', () => this.syncToGitHub());

      settingsBtn.addEventListener('click', () => {
        patInput.value = this.getGitHubToken();
        modal.style.display = 'flex';
      });

      modalClose.addEventListener('click', () => {
        modal.style.display = 'none';
      });

      modalSave.addEventListener('click', () => {
        const val = patInput.value.trim();
        if (val) {
          localStorage.setItem(this.config.githubTokenStorageKey, val);
          this.setStatus('GitHub Token gespeichert');
        } else {
          localStorage.removeItem(this.config.githubTokenStorageKey);
          this.setStatus('Token entfernt');
        }
        modal.style.display = 'none';
      });
    }

    setStatus(text) {
      const el = document.getElementById('meta-admin-status-text');
      if (el) el.textContent = text;
    }

    toggleEditMode() {
      this.isEditing = !this.isEditing;
      const toggleBtn = document.getElementById('meta-admin-toggle-btn');
      const saveBtn = document.getElementById('meta-admin-save-btn');

      if (this.isEditing) {
        toggleBtn.textContent = 'Abbrechen';
        toggleBtn.classList.add('secondary');
        saveBtn.style.display = 'flex';
        this.enableInlineEditing();
        this.setStatus('Bearbeitungsmodus aktiv');
      } else {
        toggleBtn.textContent = 'Editieren';
        toggleBtn.classList.remove('secondary');
        saveBtn.style.display = 'none';
        this.disableInlineEditing();
        this.setStatus('Bereit');
      }
    }

    enableInlineEditing() {
      const candidates = document.querySelectorAll(this.config.allowedTags.join(','));
      candidates.forEach((el, index) => {
        if (el.closest('#meta-admin-sdk-root') || el.closest('script, style, svg, pre, code')) return;
        // Don't edit container divs with deep complex layouts
        if (el.children.length > 0 && ['DIV', 'SECTION', 'MAIN', 'ARTICLE'].includes(el.tagName)) return;

        el.setAttribute('contenteditable', 'true');
        el.classList.add('meta-admin-editable-highlight');
        if (!this.originalContent.has(el)) {
          this.originalContent.set(el, el.innerHTML);
        }
      });
    }

    disableInlineEditing() {
      const candidates = document.querySelectorAll('.meta-admin-editable-highlight');
      candidates.forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('meta-admin-editable-highlight');
      });
    }

    async syncToGitHub() {
      this.setStatus('Pushe zu GitHub…');
      this.disableInlineEditing();

      // Clean cloned HTML string
      const clone = document.documentElement.cloneNode(true);
      const sdkRoot = clone.querySelector('#meta-admin-sdk-root');
      if (sdkRoot) sdkRoot.remove();

      // Remove contenteditable remnants
      clone.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('meta-admin-editable-highlight');
      });

      const fullHtml = '<!DOCTYPE html>\n' + clone.outerHTML;
      const token = this.getGitHubToken();

      if (!token) {
        // Fallback to backend API
        try {
          const resp = await fetch(`${this.config.apiEndpoint}/meta-admin/direct-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.getAuthToken()}`
            },
            body: JSON.stringify({
              filePath: this.config.filePath,
              content: fullHtml,
              message: `meta-admin: Inline-Update via MetaAdminSDK (${new Date().toLocaleString('de-DE')})`
            })
          });

          if (resp.ok) {
            this.setStatus('✓ Erfolgreich synchronisiert!');
            this.isEditing = false;
            document.getElementById('meta-admin-save-btn').style.display = 'none';
            document.getElementById('meta-admin-toggle-btn').textContent = 'Editieren';
            document.getElementById('meta-admin-toggle-btn').classList.remove('secondary');
            return;
          }
        } catch (e) {
          // Continue to GitHub API error notice
        }

        // If no token, prompt user
        document.getElementById('meta-admin-modal').style.display = 'flex';
        this.setStatus('GitHub Token erforderlich');
        return;
      }

      try {
        // GitHub API direct commit
        const apiUrl = `https://api.github.com/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${this.config.filePath}`;
        
        // 1. Get current file SHA
        const getRes = await fetch(apiUrl + `?ref=${this.config.branch}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!getRes.ok) throw new Error('Konnte Datei-SHA von GitHub nicht abrufen.');
        const getData = await getRes.json();
        const sha = getData.sha;

        // 2. Put updated content
        const encoder = new TextEncoder();
        const data = encoder.encode(fullHtml);
        let binary = '';
        const bytes = new Uint8Array(data);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64Content = btoa(binary);

        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message: `meta-admin: Inline-Update via MetaAdminSDK (${new Date().toLocaleString('de-DE')})`,
            content: b64Content,
            sha: sha,
            branch: this.config.branch
          })
        });

        if (!putRes.ok) {
          const errData = await putRes.json();
          throw new Error(errData.message || 'GitHub Commit fehlgeschlagen.');
        }

        this.setStatus('✓ Live auf GitHub gepusht!');
        this.isEditing = false;
        document.getElementById('meta-admin-save-btn').style.display = 'none';
        document.getElementById('meta-admin-toggle-btn').textContent = 'Editieren';
        document.getElementById('meta-admin-toggle-btn').classList.remove('secondary');
        alert('Änderungen wurden erfolgreich auf GitHub gespeichert und werden bereitgestellt.');
      } catch (err) {
        console.error('MetaAdminSDK Sync Error:', err);
        this.setStatus('Fehler beim Sync');
        alert('Fehler beim Synchronisieren: ' + err.message);
      }
    }
  }

  // Export
  global.MetaAdminSDK = MetaAdminSDK;

  // Auto-initialize if data-auto-init attribute is present or on DOM load
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      if (!window.__metaAdminInstance) {
        window.__metaAdminInstance = new MetaAdminSDK();
      }
    });
  }
})(typeof window !== 'undefined' ? window : this);
