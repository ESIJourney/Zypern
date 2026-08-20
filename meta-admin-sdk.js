/**
 * @ohm/meta-admin-sdk
 * Sovereign Meta-Admin, Visual Page & Universal Canva Editor with Direct GitHub GitOps Sync
 *
 * Capabilities:
 * - 100% Comprehensive Coverage: Every text leaf, paragraph, heading, list item, badge, table cell,
 *   and pricing/condition block is fully contenteditable.
 * - Robust Event Handling: Direct button click listeners (no delegation bubbling issues)
 * - Safe Canva Targeting: Excludes document root wrappers (body, .wrap, main) from being mistakenly treated as canva boxes
 * - Intelligent Sub-Canva: List items, table rows, paragraphs inside cards
 * - Auto-reflow (no empty gaps; sibling blocks smoothly collapse upwards)
 * - Duplicate & Insert Below: Duplicated parent canva or sub-row is inserted cleanly right beneath
 * - Delete: Direct deletion with auto-reordering
 * - Reorder: ⬆️ / ⬇️ (smart sibling re-ordering that skips meta-admin toolbars)
 * - Cache-Busting Direct GitHub GitOps Sync (Auto-Commit & Auto-Push with SHA verification)
 */

(function (window, document) {
  'use strict';

  class MetaAdminSDK {
    constructor(options = {}) {
      this.config = {
        apiEndpoint: 'https://offlinehumanmode.com/exitstrategy-api',
        githubTokenStorageKey: 'meta_admin_gh_token',
        authStorageKey: 'meta_admin_auth_token',
        userStorageKey: 'meta_admin_user',
        repoOwner: 'ESIJourney',
        repoName: 'Zypern',
        branch: 'main',
        filePath: window.location.pathname.split('/').filter(Boolean).pop() || 'journey.html',
        
        // Parent Canva / Card Containers (Explicitly scoped, never root containers)
        canvaSelectors: [
          '.card',
          '.pricing-card',
          '.outcome-card',
          '.timeline-item',
          '.target-box',
          '.partner-card',
          '.faq-item',
          '.testimonial-card',
          '.dd-card',
          '.pricing-note',
          '.cards-grid > div',
          '.dd-grid > div'
        ],

        // Sub-Canva Elements (Individual Rows, Bullets, Rules, Table Rows)
        subCanvaSelectors: [
          'ul > li',
          'ol > li',
          '.pricing-features li',
          'table tbody tr'
        ],

        ...options
      };

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
      return localStorage.getItem(this.config.authStorageKey);
    }

    getGitHubToken() {
      return localStorage.getItem(this.config.githubTokenStorageKey);
    }

    getUser() {
      try {
        return JSON.parse(localStorage.getItem(this.config.userStorageKey) || '{}');
      } catch (e) {
        return {};
      }
    }

    isAuthenticated() {
      return Boolean(this.getGitHubToken() || this.getAuthToken());
    }

    injectUI() {
      if (document.getElementById('meta-admin-sdk-root')) return;

      const host = document.createElement('div');
      host.id = 'meta-admin-sdk-root';
      host.innerHTML = `
        <style>
          #meta-admin-cog-btn {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 999999;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(212, 175, 55, 0.4);
            color: #fef08a;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            transition: all 0.25s ease;
          }
          #meta-admin-cog-btn:hover {
            transform: rotate(30deg) scale(1.08);
            border-color: #fbbf24;
            background: rgba(15, 23, 42, 0.95);
          }
          #meta-admin-modal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 9999999;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(6px);
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .meta-admin-card {
            background: #0f172a;
            border: 1px solid rgba(212, 175, 55, 0.35);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 440px;
            color: #f8fafc;
            box-shadow: 0 20px 40px rgba(0,0,0,0.7);
          }
          .meta-admin-input {
            width: 100%;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 12px;
            color: #fff;
            font-size: 14px;
            margin-bottom: 12px;
            box-sizing: border-box;
          }
          .meta-admin-input:focus {
            outline: none;
            border-color: #eab308;
            background: rgba(255,255,255,0.1);
          }
          .meta-admin-btn {
            background: linear-gradient(135deg, #eab308, #ca8a04);
            color: #0f172a;
            font-weight: 700;
            border: none;
            border-radius: 8px;
            padding: 10px 16px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
          }
          .meta-admin-btn:hover {
            opacity: 0.92;
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
            outline-offset: 2px !important;
            cursor: text !important;
          }
          .meta-admin-editable-highlight:hover {
            background: rgba(234, 179, 8, 0.12) !important;
          }
          .meta-admin-canva-box {
            position: relative;
            outline: 2px solid rgba(56, 189, 248, 0.7) !important;
            outline-offset: 4px !important;
            transition: all 0.2s ease;
          }
          .meta-admin-sub-canva {
            position: relative;
            outline: 1.5px dashed rgba(245, 158, 11, 0.7) !important;
            outline-offset: 2px !important;
            margin-top: 3px;
            margin-bottom: 3px;
            transition: all 0.2s ease;
          }
          .meta-admin-canva-tools {
            position: absolute;
            top: -34px;
            right: 8px;
            z-index: 10000;
            display: flex;
            gap: 4px;
            background: #090d16;
            border: 1px solid #38bdf8;
            border-radius: 6px;
            padding: 3px 6px;
            box-shadow: 0 6px 16px rgba(0,0,0,0.7);
            user-select: none;
          }
          .meta-admin-sub-tools {
            position: absolute;
            right: 0px;
            top: -24px;
            z-index: 10005;
            display: none;
            gap: 2px;
            background: #090d16;
            border: 1px solid #f59e0b;
            border-radius: 4px;
            padding: 2px 4px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.7);
            user-select: none;
          }
          .meta-admin-sub-canva:hover .meta-admin-sub-tools,
          .meta-admin-sub-canva:focus-within .meta-admin-sub-tools {
            display: flex;
          }
          .meta-admin-tool-btn {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            padding: 3px 6px;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            transition: all 0.15s ease;
          }
          .meta-admin-tool-btn:hover {
            background: #38bdf8;
            color: #0f172a;
          }
          .meta-admin-tool-btn.sub-btn {
            color: #fbbf24;
            border-color: rgba(245, 158, 11, 0.4);
            font-size: 10px;
            padding: 2px 5px;
          }
          .meta-admin-tool-btn.sub-btn:hover {
            background: #fbbf24;
            color: #0f172a;
          }
          .meta-admin-tool-btn.danger {
            color: #f87171;
            border-color: rgba(248, 113, 113, 0.4);
          }
          .meta-admin-tool-btn.danger:hover {
            background: #ef4444;
            color: #fff;
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
          <span style="font-size: 13px; color: #fef08a; font-weight: 600;">✏️ Universal Edit-Modus aktiv</span>
          <button id="meta-admin-float-cancel" class="meta-admin-btn secondary" style="padding: 5px 12px; font-size: 12px;">Abbrechen</button>
          <button id="meta-admin-float-save" class="meta-admin-btn" style="background: #22c55e; color: #fff; padding: 5px 14px; font-size: 12px;">✓ Sync to GitHub</button>
        </div>

        <!-- Main Modal / Login & Control -->
        <div id="meta-admin-modal">
          <div class="meta-admin-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0; color: #fef08a; font-size: 1.25rem;">🛠️ Meta-Admin &amp; Canva Editor</h3>
              <button id="meta-admin-modal-x" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div id="meta-admin-auth-view" style="display: none;">
              <p style="font-size: 0.88rem; color: #94a3b8; margin-top: 0;">
                Melde dich mit deinem OHM / CRM Admin-Konto an oder hinterlege dein GitHub PAT Token für direkten GitOps-Push.
              </p>
              <label style="font-size: 12px; color: #cbd5e1; display: block; margin-bottom: 4px;">GitHub PAT Token:</label>
              <input type="password" id="meta-admin-pat" class="meta-admin-input" placeholder="ghp_..." />
              
              <div style="margin: 12px 0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
                <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 8px;">— oder via CRM-Passwort —</span>
                <label style="font-size: 12px; color: #cbd5e1; display: block; margin-bottom: 4px;">E-Mail (Admin)</label>
                <input type="email" id="meta-admin-email" class="meta-admin-input" placeholder="admin@exitstrategy.cc" />
                <label style="font-size: 12px; color: #cbd5e1; display: block; margin-bottom: 4px;">Passwort</label>
                <input type="password" id="meta-admin-password" class="meta-admin-input" placeholder="••••••••" />
              </div>

              <div id="meta-admin-login-error" style="color: #f87171; font-size: 12px; margin-bottom: 10px; display: none;"></div>

              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
                <button id="meta-admin-login-btn" class="meta-admin-btn" style="width: 100%;">Anmelden &amp; Freischalten</button>
              </div>
            </div>

            <div id="meta-admin-control-view" style="display: none;">
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <span style="font-size: 12px; color: #94a3b8; display: block;">Eingeloggt als Exitstrategy Member:</span>
                <strong id="meta-admin-user-label" style="color: #38bdf8; font-size: 13.5px;">admin</strong>
              </div>

              <p style="font-size: 0.88rem; color: #cbd5e1; margin-bottom: 12px; line-height: 1.5;">
                ✓ <strong>Texte &amp; Paragraphen:</strong> Direkt anklicken und editieren.<br>
                ✓ <strong>Canva-Boxen:</strong> Mit <strong>[+ Canva duplizieren]</strong> duplizieren, mit <strong>[⬆️]</strong> / <strong>[⬇️]</strong> verschieben oder mit <strong>[🗑️ Löschen]</strong> entfernen.<br>
                ✓ <strong>Sub-Canva (Listen &amp; Zeilen):</strong> Mit <strong>[➕ Zeile]</strong> darunter einfügen oder mit <strong>[✕]</strong> löschen.
              </p>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="meta-admin-start-edit-btn" class="meta-admin-btn" style="width: 100%;">✏️ Seite jetzt bearbeiten</button>
                <button id="meta-admin-logout-btn" class="meta-admin-btn secondary" style="width: 100%;">Abmelden / Token ändern</button>
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
          userLabel.textContent = u.email || (this.getGitHubToken() ? 'Michi (Exitstrategy LLC)' : 'Meta-Admin');
        } else {
          authView.style.display = 'block';
          controlView.style.display = 'none';
          patInput.value = this.getGitHubToken() || '';
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
          localStorage.setItem(this.config.userStorageKey, JSON.stringify({ email: email || 'Michi (Exitstrategy LLC)' }));
          refreshViewState();
          return;
        }

        if (!email || !password) {
          errBox.textContent = 'Bitte GitHub PAT Token oder E-Mail und Passwort eingeben.';
          errBox.style.display = 'block';
          return;
        }

        loginBtn.textContent = 'Prüfe Zugang…';
        try {
          const resp = await fetch(`${this.config.apiEndpoint}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });

          const data = await resp.json();
          if (!resp.ok) throw new Error(data.message || 'Login fehlgeschlagen');

          const token = data.accessToken || data.token || (data.chooseTenant && data.chooseTenant.length ? 'multi-tenant-pending' : '');
          if (!token) throw new Error('Unbekannte Anmeldeantwort');

          localStorage.setItem(this.config.authStorageKey, token);
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

    makeElementEditable(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
      if (el.closest('#meta-admin-sdk-root') || el.closest('script, style, svg, pre, code')) return;
      if (el.classList.contains('meta-admin-canva-tools') || el.classList.contains('meta-admin-sub-tools')) return;

      el.setAttribute('contenteditable', 'true');
      el.classList.add('meta-admin-editable-highlight');
      if (!this.originalContent.has(el)) {
        this.originalContent.set(el, el.innerHTML);
      }
    }

    enableInlineEditing() {
      if (!this.isAuthenticated()) {
        document.getElementById('meta-admin-modal').style.display = 'flex';
        return;
      }

      this.isEditing = true;
      document.getElementById('meta-admin-floating-bar').style.display = 'flex';

      // 1. Universal Text In-Place Editing
      const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, strong, em, b, i, li, th, td, label, div, button.btn');
      allElements.forEach(el => {
        if (el.closest('#meta-admin-sdk-root') || el.closest('script, style, svg, pre, code')) return;
        
        // Leaf nodes or direct text containers
        const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
        const isTextTag = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','STRONG','EM','B','I','LI','TH','TD','LABEL'].includes(el.tagName);
        const isLeafDiv = el.tagName === 'DIV' && (el.children.length === 0 || hasDirectText);

        if (isTextTag || isLeafDiv) {
          this.makeElementEditable(el);
        }
      });

      // 2. Parent Canva Boxes
      this.config.canvaSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(box => {
          if (!box.closest('#meta-admin-sdk-root') && !['BODY', 'HTML', 'MAIN'].includes(box.tagName) && !box.classList.contains('wrap') && !box.classList.contains('container')) {
            this.attachCanvaTools(box);
          }
        });
      });

      // 3. Sub-Canva Elements
      this.config.subCanvaSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(subEl => {
          if (!subEl.closest('#meta-admin-sdk-root')) {
            this.attachSubCanvaTools(subEl);
          }
        });
      });
    }

    attachCanvaTools(box) {
      if (box.dataset.metaAdminCanva) return;
      box.dataset.metaAdminCanva = 'true';
      box.classList.add('meta-admin-canva-box');

      const tools = document.createElement('div');
      tools.className = 'meta-admin-canva-tools';
      tools.setAttribute('contenteditable', 'false');
      
      const btnDup = document.createElement('button');
      btnDup.className = 'meta-admin-tool-btn';
      btnDup.title = 'Dieses Canva-Paket duplizieren';
      btnDup.textContent = '+ Canva duplizieren';

      const btnUp = document.createElement('button');
      btnUp.className = 'meta-admin-tool-btn';
      btnUp.title = 'Nach oben verschieben';
      btnUp.textContent = '⬆️';

      const btnDown = document.createElement('button');
      btnDown.className = 'meta-admin-tool-btn';
      btnDown.title = 'Nach unten verschieben';
      btnDown.textContent = '⬇️';

      const btnDel = document.createElement('button');
      btnDel.className = 'meta-admin-tool-btn danger';
      btnDel.title = 'Dieses Canva-Paket löschen';
      btnDel.textContent = '🗑️ Löschen';

      btnDup.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const clone = box.cloneNode(true);
        clone.querySelectorAll('.meta-admin-canva-tools, .meta-admin-sub-tools').forEach(t => t.remove());
        delete clone.dataset.metaAdminCanva;
        clone.querySelectorAll('[data-meta-admin-sub]').forEach(s => delete s.dataset.metaAdminSub);
        clone.classList.remove('meta-admin-canva-box');

        box.parentNode.insertBefore(clone, box.nextSibling);
        this.attachCanvaTools(clone);

        // Attach sub tools and editability inside clone
        this.config.subCanvaSelectors.forEach(sel => {
          clone.querySelectorAll(sel).forEach(s => this.attachSubCanvaTools(s));
        });
        clone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, strong, em, b, i, li, th, td, label, div').forEach(el => {
          const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
          if (['H1','H2','H3','H4','H5','H6','P','SPAN','A','STRONG','EM','B','I','LI','TH','TD','LABEL'].includes(el.tagName) || (el.tagName === 'DIV' && (el.children.length === 0 || hasDirectText))) {
            this.makeElementEditable(el);
          }
        });
      };

      btnUp.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let prev = box.previousElementSibling;
        while (prev && (prev.classList.contains('meta-admin-canva-tools') || prev.id === 'meta-admin-sdk-root')) {
          prev = prev.previousElementSibling;
        }
        if (prev && prev.parentNode === box.parentNode) {
          box.parentNode.insertBefore(box, prev);
        }
      };

      btnDown.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let next = box.nextElementSibling;
        while (next && (next.classList.contains('meta-admin-canva-tools') || next.id === 'meta-admin-sdk-root')) {
          next = next.nextElementSibling;
        }
        if (next && next.parentNode === box.parentNode) {
          box.parentNode.insertBefore(next, box);
        }
      };

      btnDel.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Möchtest du dieses gesamte Canva-Paket wirklich löschen?')) {
          box.remove();
        }
      };

      tools.appendChild(btnDup);
      tools.appendChild(btnUp);
      tools.appendChild(btnDown);
      tools.appendChild(btnDel);

      box.appendChild(tools);
    }

    attachSubCanvaTools(subEl) {
      if (subEl.dataset.metaAdminSub) return;
      subEl.dataset.metaAdminSub = 'true';
      subEl.classList.add('meta-admin-sub-canva');

      // Make sure content inside is editable
      this.makeElementEditable(subEl);
      subEl.querySelectorAll('span, a, strong, em, b, i').forEach(child => this.makeElementEditable(child));

      const tools = document.createElement('div');
      tools.className = 'meta-admin-sub-tools';
      tools.setAttribute('contenteditable', 'false');
      
      const btnDup = document.createElement('button');
      btnDup.className = 'meta-admin-tool-btn sub-btn';
      btnDup.title = 'Diese Zeile darunter duplizieren';
      btnDup.textContent = '➕ Zeile';

      const btnUp = document.createElement('button');
      btnUp.className = 'meta-admin-tool-btn sub-btn';
      btnUp.title = 'Nach oben';
      btnUp.textContent = '▲';

      const btnDown = document.createElement('button');
      btnDown.className = 'meta-admin-tool-btn sub-btn';
      btnDown.title = 'Nach unten';
      btnDown.textContent = '▼';

      const btnDel = document.createElement('button');
      btnDel.className = 'meta-admin-tool-btn sub-btn danger';
      btnDel.title = 'Diese Zeile entfernen';
      btnDel.textContent = '✕';

      btnDup.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clone = subEl.cloneNode(true);
        const oldTools = clone.querySelector('.meta-admin-sub-tools');
        if (oldTools) oldTools.remove();
        delete clone.dataset.metaAdminSub;
        clone.classList.remove('meta-admin-sub-canva');

        subEl.parentNode.insertBefore(clone, subEl.nextSibling);
        this.attachSubCanvaTools(clone);
      };

      btnUp.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let prev = subEl.previousElementSibling;
        while (prev && prev.classList.contains('meta-admin-sub-tools')) {
          prev = prev.previousElementSibling;
        }
        if (prev && prev.parentNode === subEl.parentNode) {
          subEl.parentNode.insertBefore(subEl, prev);
        }
      };

      btnDown.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let next = subEl.nextElementSibling;
        while (next && next.classList.contains('meta-admin-sub-tools')) {
          next = next.nextElementSibling;
        }
        if (next && next.parentNode === subEl.parentNode) {
          subEl.parentNode.insertBefore(next, subEl);
        }
      };

      btnDel.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        subEl.remove();
      };

      tools.appendChild(btnDup);
      tools.appendChild(btnUp);
      tools.appendChild(btnDown);
      tools.appendChild(btnDel);

      subEl.appendChild(tools);
    }

    disableInlineEditing() {
      this.isEditing = false;
      const floatBar = document.getElementById('meta-admin-floating-bar');
      if (floatBar) floatBar.style.display = 'none';

      const candidates = document.querySelectorAll('.meta-admin-editable-highlight');
      candidates.forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('meta-admin-editable-highlight');
      });

      document.querySelectorAll('.meta-admin-canva-tools, .meta-admin-sub-tools').forEach(t => t.remove());
      document.querySelectorAll('.meta-admin-canva-box').forEach(b => {
        delete b.dataset.metaAdminCanva;
        b.classList.remove('meta-admin-canva-box');
      });
      document.querySelectorAll('.meta-admin-sub-canva').forEach(s => {
        delete s.dataset.metaAdminSub;
        s.classList.remove('meta-admin-sub-canva');
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
      clone.querySelectorAll('.meta-admin-canva-tools, .meta-admin-sub-tools').forEach(t => t.remove());
      clone.querySelectorAll('.meta-admin-canva-box, .meta-admin-sub-canva').forEach(b => {
        delete b.dataset.metaAdminCanva;
        delete b.dataset.metaAdminSub;
        b.classList.remove('meta-admin-canva-box');
        b.classList.remove('meta-admin-sub-canva');
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
        const filePath = window.location.pathname.split('/').filter(Boolean).pop() || this.config.filePath || 'journey.html';
        const apiUrl = `https://api.github.com/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${filePath}`;
        
        // Always fetch fresh SHA bypassing browser cache
        const getRes = await fetch(apiUrl + `?ref=${this.config.branch}&_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!getRes.ok) {
          const getErr = await getRes.json().catch(() => ({}));
          throw new Error('Konnte Datei von GitHub nicht abrufen (HTTP ' + getRes.status + '): ' + (getErr.message || ''));
        }
        
        const getData = await getRes.json();
        const sha = getData.sha;

        const encoder = new TextEncoder();
        const data = encoder.encode(fullHtml);
        let binary = '';
        const bytes = new Uint8Array(data);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `meta-admin: Update ${filePath} by ${this.getUser().email || 'Michi (Exitstrategy LLC)'} (${new Date().toLocaleString('de-DE')})`,
            content: b64,
            sha: sha,
            branch: this.config.branch
          })
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.message || 'GitHub Sync fehlgeschlagen (HTTP ' + putRes.status + ')');
        }

        alert('✓ Erfolgreich auf GitHub & live synchronisiert!');
      } catch (err) {
        alert('Fehler beim Synchronisieren: ' + err.message);
        document.getElementById('meta-admin-modal').style.display = 'flex';
      }
    }
  }

  window.MetaAdminSDK = MetaAdminSDK;

  // Auto-boot if included as standalone script
  if (typeof window !== 'undefined') {
    window.metaAdmin = new MetaAdminSDK();
  }
})(window, document);
