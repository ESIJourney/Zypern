/**
 * @ohm/meta-admin-sdk - Universal In-Browser Meta-Admin & Visual Inline Editor
 * Compact floating cog (top-right) with OHM SSO Admin Login and GitHub Auto-Sync.
 */

(function(global) {
  'use strict';

  const DEFAULT_CONFIG = {
    repoOwner: 'ESIJourney',
    repoName: 'Zypern',
    branch: 'main',
    filePath: window.location.pathname.endsWith('journey2.html') ? 'journey2.html' : 'journey.html',
    apiEndpoint: 'https://offlinehumanmode.com/exitstrategy-api',
    authStorageKey: 'esi_crm_token',
    userStorageKey: 'esi_crm_user',
    githubTokenStorageKey: 'esi_github_pat',
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

    getUser() {
      try {
        return JSON.parse(localStorage.getItem(this.config.userStorageKey) || '{}');
      } catch (e) {
        return {};
      }
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
          #meta-admin-cog-btn {
            position: fixed;
            top: 18px;
            right: 18px;
            z-index: 999999;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(212, 175, 55, 0.4);
            color: #fef08a;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            transition: all 0.25s ease;
            font-size: 18px;
          }
          #meta-admin-cog-btn:hover {
            transform: rotate(30deg) scale(1.1);
            background: rgba(15, 23, 42, 0.98);
            border-color: rgba(212, 175, 55, 0.9);
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
          }
          #meta-admin-modal {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.75);
            backdrop-filter: blur(6px);
            z-index: 1000000;
            display: none;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .meta-admin-card {
            background: #0f172a;
            border: 1px solid rgba(212, 175, 55, 0.4);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 420px;
            color: #fff;
            box-shadow: 0 25px 50px rgba(0,0,0,0.8);
          }
          .meta-admin-input {
            width: 100%;
            box-sizing: border-box;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 10px 12px;
            color: #fff;
            font-size: 13.5px;
            margin-bottom: 12px;
          }
          .meta-admin-input:focus {
            outline: none;
            border-color: #eab308;
          }
          .meta-admin-btn {
            background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
            color: #0f172a;
            border: none;
            border-radius: 8px;
            padding: 9px 16px;
            font-weight: 700;
            font-size: 13.5px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .meta-admin-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(234, 179, 8, 0.3);
          }
          .meta-admin-btn.secondary {
            background: rgba(255,255,255,0.08);
            color: #cbd5e1;
            border: 1px solid rgba(255,255,255,0.15);
          }
          .meta-admin-btn.secondary:hover {
            background: rgba(255,255,255,0.15);
          }
          .meta-admin-editable-highlight {
            outline: 2px dashed #eab308 !important;
            outline-offset: 3px !important;
            cursor: text !important;
          }
          .meta-admin-editable-highlight:hover {
            background: rgba(234, 179, 8, 0.12) !important;
          }
          #meta-admin-floating-bar {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(212, 175, 55, 0.5);
            border-radius: 50px;
            padding: 8px 18px;
            display: none;
            align-items: center;
            gap: 12px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.6);
            font-family: sans-serif;
            color: #fff;
          }
        </style>

        <!-- Compact Cog Top-Right -->
        <button id="meta-admin-cog-btn" title="Meta-Admin &amp; Editor">⚙️</button>

        <!-- Floating Live Save Bar (visible only during active edit) -->
        <div id="meta-admin-floating-bar">
          <span style="font-size: 13px; color: #fef08a; font-weight: 600;">✏️ Edit-Modus aktiv</span>
          <button id="meta-admin-float-cancel" class="meta-admin-btn secondary" style="padding: 5px 12px; font-size: 12px;">Abbrechen</button>
          <button id="meta-admin-float-save" class="meta-admin-btn" style="background: #22c55e; color: #fff; padding: 5px 14px; font-size: 12px;">✓ Sync to GitHub</button>
        </div>

        <!-- Main Modal / Login & Control -->
        <div id="meta-admin-modal">
          <div class="meta-admin-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0; color: #fef08a; font-size: 1.25rem;">🛠️ Meta-Admin</h3>
              <button id="meta-admin-modal-x" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div id="meta-admin-auth-view" style="display: none;">
              <p style="font-size: 0.88rem; color: #94a3b8; margin-top: 0;">
                Melde dich mit deinem OHM / CRM Admin-Konto an oder hinterlege dein GitHub Token.
              </p>
              <label style="font-size: 12px; color: #cbd5e1; display: block; margin-bottom: 4px;">E-Mail (Admin)</label>
              <input type="email" id="meta-admin-email" class="meta-admin-input" placeholder="admin@offlinehumanmode.com" />
              <label style="font-size: 12px; color: #cbd5e1; display: block; margin-bottom: 4px;">Passwort</label>
              <input type="password" id="meta-admin-password" class="meta-admin-input" placeholder="••••••••" />
              
              <div style="margin: 12px 0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
                <label style="font-size: 12px; color: #cbd5e1; display: block; margin-bottom: 4px;">GitHub PAT (Optional für direkten Commit):</label>
                <input type="password" id="meta-admin-pat" class="meta-admin-input" placeholder="ghp_..." />
              </div>

              <div id="meta-admin-login-error" style="color: #f87171; font-size: 12px; margin-bottom: 10px; display: none;"></div>

              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
                <button id="meta-admin-login-btn" class="meta-admin-btn" style="width: 100%;">Anmelden &amp; Freischalten</button>
              </div>
            </div>

            <div id="meta-admin-control-view" style="display: none;">
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <span style="font-size: 12px; color: #94a3b8; display: block;">Eingeloggt als Admin:</span>
                <strong id="meta-admin-user-label" style="color: #38bdf8; font-size: 13.5px;">admin</strong>
              </div>

              <p style="font-size: 0.88rem; color: #cbd5e1; margin-bottom: 18px;">
                Klicke auf <strong>"Seite jetzt bearbeiten"</strong>, um Texte direkt auf der Seite anzupassen und anschließend auf GitHub zu synchronisieren.
              </p>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="meta-admin-start-edit-btn" class="meta-admin-btn" style="width: 100%;">✏️ Seite jetzt bearbeiten</button>
                <button id="meta-admin-logout-btn" class="meta-admin-btn secondary" style="width: 100%;">Abmelden</button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(host);
      this.bindEvents();
    }

    bindEvents() {
      const cogBtn = document.getElementById('meta-admin-cog-btn');
      const modal = document.getElementById('meta-admin-modal');
      const closeBtn = document.getElementById('meta-admin-modal-x');
      const authView = document.getElementById('meta-admin-auth-view');
      const controlView = document.getElementById('meta-admin-control-view');
      const userLabel = document.getElementById('meta-admin-user-label');
      const loginBtn = document.getElementById('meta-admin-login-btn');
      const logoutBtn = document.getElementById('meta-admin-logout-btn');
      const startEditBtn = document.getElementById('meta-admin-start-edit-btn');
      const floatCancel = document.getElementById('meta-admin-float-cancel');
      const floatSave = document.getElementById('meta-admin-float-save');
      const patInput = document.getElementById('meta-admin-pat');
      const errBox = document.getElementById('meta-admin-login-error');

      const refreshViewState = () => {
        if (this.isAuthenticated()) {
          authView.style.display = 'none';
          controlView.style.display = 'block';
          const u = this.getUser();
          userLabel.textContent = u.email || 'Meta-Admin';
        } else {
          authView.style.display = 'block';
          controlView.style.display = 'none';
          patInput.value = this.getGitHubToken();
        }
      };

      cogBtn.addEventListener('click', () => {
        refreshViewState();
        modal.style.display = 'flex';
      });

      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });

      loginBtn.addEventListener('click', async () => {
        errBox.style.display = 'none';
        const email = document.getElementById('meta-admin-email').value.trim();
        const password = document.getElementById('meta-admin-password').value.trim();
        const pat = patInput.value.trim();

        if (pat) {
          localStorage.setItem(this.config.githubTokenStorageKey, pat);
          localStorage.setItem(this.config.userStorageKey, JSON.stringify({ email: email || 'GitHub Admin' }));
          refreshViewState();
          return;
        }

        if (!email || !password) {
          errBox.textContent = 'Bitte E-Mail und Passwort eingeben.';
          errBox.style.display = 'block';
          return;
        }

        loginBtn.textContent = 'Prüfe Zugang…';
        try {
          const resp = await fetch(`${this.config.apiEndpoint}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, tenant: 'exitstrategy' })
          });

          const data = await resp.json();
          if (!resp.ok) throw new Error(data.message || 'Login fehlgeschlagen');

          localStorage.setItem(this.config.authStorageKey, data.accessToken || data.token);
          localStorage.setItem(this.config.userStorageKey, JSON.stringify({ email }));
          loginBtn.textContent = 'Anmelden & Freischalten';
          refreshViewState();
        } catch (err) {
          loginBtn.textContent = 'Anmelden & Freischalten';
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        }
      });

      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem(this.config.authStorageKey);
        localStorage.removeItem(this.config.userStorageKey);
        localStorage.removeItem(this.config.githubTokenStorageKey);
        this.disableInlineEditing();
        refreshViewState();
      });

      startEditBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        this.enableInlineEditing();
      });

      floatCancel.addEventListener('click', () => {
        this.disableInlineEditing();
      });

      floatSave.addEventListener('click', () => {
        this.syncToGitHub();
      });
    }

    enableInlineEditing() {
      if (!this.isAuthenticated()) {
        document.getElementById('meta-admin-modal').style.display = 'flex';
        return;
      }

      this.isEditing = true;
      document.getElementById('meta-admin-floating-bar').style.display = 'flex';

      const candidates = document.querySelectorAll(this.config.allowedTags.join(','));
      candidates.forEach(el => {
        if (el.closest('#meta-admin-sdk-root') || el.closest('script, style, svg, pre, code')) return;
        if (el.children.length > 0 && ['DIV', 'SECTION', 'MAIN', 'ARTICLE'].includes(el.tagName)) return;

        el.setAttribute('contenteditable', 'true');
        el.classList.add('meta-admin-editable-highlight');
        if (!this.originalContent.has(el)) {
          this.originalContent.set(el, el.innerHTML);
        }
      });
    }

    disableInlineEditing() {
      this.isEditing = false;
      document.getElementById('meta-admin-floating-bar').style.display = 'none';

      const candidates = document.querySelectorAll('.meta-admin-editable-highlight');
      candidates.forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('meta-admin-editable-highlight');
      });
    }

    async syncToGitHub() {
      this.disableInlineEditing();

      const clone = document.documentElement.cloneNode(true);
      const sdkRoot = clone.querySelector('#meta-admin-sdk-root');
      if (sdkRoot) sdkRoot.remove();

      clone.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('meta-admin-editable-highlight');
      });

      const fullHtml = '<!DOCTYPE html>\n' + clone.outerHTML;
      const token = this.getGitHubToken();

      if (!token) {
        // Direct commit via backend gitops
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
            alert('✓ Erfolgreich synchronisiert und live aktualisiert!');
            return;
          }
        } catch (e) {}

        alert('Bitte hinterlege in den Meta-Admin-Einstellungen (Zahnrad) dein GitHub PAT Token für den direkten Push.');
        document.getElementById('meta-admin-modal').style.display = 'flex';
        return;
      }

      try {
        const apiUrl = `https://api.github.com/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${this.config.filePath}`;
        
        const getRes = await fetch(apiUrl + `?ref=${this.config.branch}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!getRes.ok) throw new Error('Konnte Datei-SHA von GitHub nicht abrufen.');
        const getData = await getRes.json();
        const sha = getData.sha;

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

        alert('✓ Änderungen wurden erfolgreich auf GitHub gespeichert und bereitgestellt.');
      } catch (err) {
        console.error('MetaAdminSDK Sync Error:', err);
        alert('Fehler beim Synchronisieren: ' + err.message);
      }
    }
  }

  global.MetaAdminSDK = MetaAdminSDK;

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      if (!window.__metaAdminInstance) {
        window.__metaAdminInstance = new MetaAdminSDK();
      }
    });
  }
})(typeof window !== 'undefined' ? window : this);
