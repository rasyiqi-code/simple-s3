/* ----------------------------------------------------
   DASHBOARD ADMIN LOGIC (VANILLA JS)
   Machine-to-Machine API Integration & Local State
---------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE APLIKASI ---
  let adminToken = sessionStorage.getItem('admin_token') || '';
  let activeTab = 'explorer';
  let filesData = [];
  let keysData = [];
  let bucketsData = [];

  // --- ELEMENT DOM ---
  const loginOverlay = document.getElementById('login-overlay');
  const loginForm = document.getElementById('login-form');
  const masterKeyInput = document.getElementById('master-key');
  const loginError = document.getElementById('login-error');

  const dashboardContainer = document.getElementById('dashboard-container');
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const logoutBtn = document.getElementById('logout-btn');

  // Elements Tab Explorer
  const filesList = document.getElementById('files-list');
  const searchFiles = document.getElementById('search-files');
  const refreshFilesBtn = document.getElementById('refresh-files-btn');
  const storageStatValue = document.querySelector('.stat-value');

  // Elements Tab Buckets
  const bucketsGrid = document.getElementById('buckets-grid');
  const openCreateBucketModalBtn = document.getElementById('open-create-bucket-modal');
  const createBucketModal = document.getElementById('create-bucket-modal');
  const createBucketForm = document.getElementById('create-bucket-form');
  const bucketNameInput = document.getElementById('bucket-name');
  const bucketDescriptionInput = document.getElementById('bucket-description');

  // Elements Tab API Keys
  const keysList = document.getElementById('keys-list');
  const openCreateKeyModalBtn = document.getElementById('open-create-key-modal');
  const createKeyModal = document.getElementById('create-key-modal');
  const createKeyForm = document.getElementById('create-key-form');
  const keyNameInput = document.getElementById('key-name');
  const keyBucketSelect = document.getElementById('key-bucket');

  // Elements Tab Audit Logs
  const logsList = document.getElementById('logs-list');
  const refreshLogsBtn = document.getElementById('refresh-logs-btn');

  const toast = document.getElementById('toast');

  // --- SISTEM NOTIFIKASI TOAST ---
  function showToast(message, type = 'success') {
    toast.className = `toast ${type}`;
    toast.innerHTML = type === 'success'
      ? `<i class="fa-solid fa-circle-check"></i> ${message}`
      : `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;

    toast.style.display = 'flex';
    setTimeout(() => { toast.style.display = 'none'; }, 3500);
  }

  // --- KONEKSI API ADMIN ---
  async function fetchAPI(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers['x-admin-key'] = adminToken;

    const cfg = { method, headers };
    if (body) cfg.body = JSON.stringify(body);

    try {
      const response = await fetch(endpoint, cfg);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan sistem');
      return data;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    }
  }

  // --- LOGIN & AUTHENTICATION FLOW ---
  function initAuth() {
    if (adminToken) {
      showDashboard();
    } else {
      loginOverlay.classList.remove('hidden');
      dashboardContainer.classList.add('hidden');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const masterKey = masterKeyInput.value.trim();
    loginError.textContent = '';

    try {
      const response = await fetchAPI('/api/admin/login', 'POST', { masterKey });
      if (response.success) {
        adminToken = masterKey;
        sessionStorage.setItem('admin_token', adminToken);
        showDashboard();
        showToast('Login berhasil. Selamat datang!');
      }
    } catch (err) {
      loginError.textContent = err.message || 'Gagal login';
    }
  });

  logoutBtn.addEventListener('click', () => {
    adminToken = '';
    sessionStorage.removeItem('admin_token');
    loginOverlay.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
    masterKeyInput.value = '';
    showToast('Berhasil keluar sistem');
  });

  function showDashboard() {
    loginOverlay.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    switchTab(activeTab);
  }

  // --- MANAJEMEN TAB NAVIGASI ---
  const tabConfig = {
    buckets:  { title: 'Buckets', subtitle: 'Kelola wadah penyimpanan. Setiap API Key terikat ke satu bucket.' },
    explorer: { title: 'File Explorer', subtitle: 'Kelola dan pantau seluruh aset media yang terunggah secara aman.' },
    apikeys:  { title: 'API Keys', subtitle: 'Kelola kunci akses dinamis untuk integrasi aplikasi web klien.' },
    logs:     { title: 'Audit Logs', subtitle: 'Pantau seluruh rekaman aktivitas transfer data secara real-time.' },
  };

  const tabLoaders = {
    buckets:  loadBuckets,
    explorer: loadFiles,
    apikeys:  loadKeys,
    logs:     loadLogs,
  };

  function switchTab(tabName) {
    activeTab = tabName;

    navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-tab') === tabName));
    tabContents.forEach(content => content.classList.toggle('active-tab', content.id === `tab-${tabName}`));

    const cfg = tabConfig[tabName];
    if (cfg) {
      pageTitle.textContent = cfg.title;
      pageSubtitle.textContent = cfg.subtitle;
    }

    if (tabLoaders[tabName]) tabLoaders[tabName]();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
  });

  // =============================================
  // TAB: BUCKETS
  // =============================================

  async function loadBuckets() {
    bucketsGrid.innerHTML = '<div class="bucket-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat bucket...</div>';

    try {
      const response = await fetchAPI('/api/admin/buckets');
      if (response.success) {
        bucketsData = response.data;
        renderBuckets(bucketsData);
      }
    } catch {
      bucketsGrid.innerHTML = '<div class="bucket-loading">Gagal memuat bucket dari server.</div>';
    }
  }

  function renderBuckets(buckets) {
    if (buckets.length === 0) {
      bucketsGrid.innerHTML = `
        <div class="bucket-empty">
          <i class="fa-solid fa-database"></i>
          <p>Belum ada bucket yang dibuat.</p>
          <p style="font-size:0.85rem;opacity:0.6">Klik "Buat Bucket Baru" untuk mulai.</p>
        </div>
      `;
      return;
    }

    bucketsGrid.innerHTML = '';
    buckets.forEach(bucket => {
      const card = document.createElement('div');
      card.className = 'bucket-card glass';

      const createdDate = new Date(bucket.created_at).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
      });

      card.innerHTML = `
        <div class="bucket-card-icon"><i class="fa-solid fa-database"></i></div>
        <div class="bucket-card-body">
          <h4 class="bucket-card-name">${escapeHTML(bucket.name)}</h4>
          <p class="bucket-card-desc">${escapeHTML(bucket.description || '—')}</p>
          <span class="bucket-card-meta"><i class="fa-regular fa-calendar"></i> ${createdDate}</span>
        </div>
        <div class="bucket-card-actions">
          <button class="icon-btn copy-path-btn" data-name="${bucket.name}" title="Salin path bucket">
            <i class="fa-solid fa-link"></i>
          </button>
          <button class="icon-btn icon-btn-danger delete-bucket-btn" data-name="${bucket.name}" title="Hapus bucket">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      card.querySelector('.copy-path-btn').addEventListener('click', (e) => {
        const name = e.currentTarget.getAttribute('data-name');
        const url = `${window.location.origin}/file/${name}/`;
        navigator.clipboard.writeText(url)
          .then(() => showToast(`Path bucket "${name}" disalin!`))
          .catch(() => showToast('Gagal menyalin', 'error'));
      });

      card.querySelector('.delete-bucket-btn').addEventListener('click', async (e) => {
        const name = e.currentTarget.getAttribute('data-name');
        if (confirm(`Hapus bucket "${name}"?\n\nSEMUA file di dalamnya akan ikut terhapus permanen dan tidak bisa dipulihkan.`)) {
          try {
            const result = await fetchAPI(`/api/admin/buckets/${name}`, 'DELETE');
            if (result.success) {
              showToast(`Bucket "${name}" berhasil dihapus`);
              loadBuckets();
            }
          } catch {}
        }
      });

      bucketsGrid.appendChild(card);
    });
  }

  // Modal Buat Bucket
  openCreateBucketModalBtn.addEventListener('click', () => {
    createBucketModal.classList.add('active');
    bucketNameInput.value = '';
    bucketDescriptionInput.value = '';
    bucketNameInput.focus();
  });

  createBucketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = bucketNameInput.value.trim().toLowerCase();
    const description = bucketDescriptionInput.value.trim();

    try {
      const response = await fetchAPI('/api/admin/buckets', 'POST', { name, description });
      if (response.success) {
        closeModalById('create-bucket-modal');
        showToast(`Bucket "${name}" berhasil dibuat!`);
        loadBuckets();
      }
    } catch {}
  });

  // =============================================
  // TAB: FILE EXPLORER
  // =============================================

  async function loadFiles() {
    filesList.innerHTML = `
      <tr><td colspan="7" class="text-center loading-state">
        <i class="fa-solid fa-spinner fa-spin"></i> Memuat berkas...
      </td></tr>
    `;

    try {
      const response = await fetchAPI('/api/admin/files');
      if (response.success) {
        filesData = response.data;
        renderFiles(filesData);
        calculateDiskUsage(filesData, response.maxStorageGb || 200);
      }
    } catch {
      filesList.innerHTML = `
        <tr><td colspan="7" class="text-center error-msg" style="padding:40px">
          Gagal memuat data berkas dari server.
        </td></tr>
      `;
    }
  }

  function renderFiles(files) {
    if (files.length === 0) {
      filesList.innerHTML = `
        <tr><td colspan="7" class="text-center loading-state">
          <i class="fa-solid fa-folder-open" style="font-size:2rem;display:block;margin-bottom:10px"></i>
          Belum ada berkas yang diunggah.
        </td></tr>
      `;
      return;
    }

    filesList.innerHTML = '';
    files.forEach(file => {
      const tr = document.createElement('tr');

      let iconClass = 'fa-file';
      if (file.mime_type.startsWith('image/')) iconClass = 'fa-file-image';
      else if (file.mime_type.startsWith('video/')) iconClass = 'fa-file-video';
      else if (file.mime_type.includes('pdf')) iconClass = 'fa-file-pdf';
      else if (file.mime_type.includes('zip')) iconClass = 'fa-file-zipper';

      const formattedSize = formatBytes(file.size);
      const uploadDate = new Date(file.uploaded_at).toLocaleString('id-ID');
      const bucket = file.bucket_name || 'default';
      const fileUrl = `/file/${bucket}/${file.filename}`;

      tr.innerHTML = `
        <td>
          <div class="file-name-cell">
            <i class="fa-solid ${iconClass} file-icon"></i>
            <span>${escapeHTML(file.original_name)}</span>
          </div>
        </td>
        <td><span class="badge badge-bucket"><i class="fa-solid fa-database"></i> ${escapeHTML(bucket)}</span></td>
        <td>
          <a href="${fileUrl}" target="_blank" class="code-token">${file.filename}</a>
        </td>
        <td>${formattedSize}</td>
        <td><span class="badge" style="background:rgba(255,255,255,0.05);color:var(--text-muted)">${file.mime_type}</span></td>
        <td>${uploadDate}</td>
        <td class="text-right">
          <div class="actions-cell">
            <button class="icon-btn copy-url-btn" data-url="${fileUrl}" title="Salin URL Berkas">
              <i class="fa-solid fa-link"></i>
            </button>
            <button class="icon-btn icon-btn-danger delete-file-btn" data-filename="${file.filename}" title="Hapus Berkas">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.copy-url-btn').addEventListener('click', (e) => {
        const relativeUrl = e.currentTarget.getAttribute('data-url');
        navigator.clipboard.writeText(window.location.origin + relativeUrl)
          .then(() => showToast('URL berkas berhasil disalin ke clipboard!'))
          .catch(() => showToast('Gagal menyalin URL', 'error'));
      });

      tr.querySelector('.delete-file-btn').addEventListener('click', async (e) => {
        const filename = e.currentTarget.getAttribute('data-filename');
        if (confirm(`Hapus berkas "${filename}" secara permanen?`)) {
          try {
            const result = await fetchAPI(`/api/admin/files/${filename}`, 'DELETE');
            if (result.success) {
              showToast('Berkas berhasil dihapus');
              loadFiles();
            }
          } catch {}
        }
      });

      filesList.appendChild(tr);
    });
  }

  searchFiles.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = filesData.filter(f =>
      f.original_name.toLowerCase().includes(query) ||
      f.filename.toLowerCase().includes(query) ||
      (f.bucket_name || '').toLowerCase().includes(query)
    );
    renderFiles(filtered);
  });

  refreshFilesBtn.addEventListener('click', loadFiles);

  function calculateDiskUsage(files, maxStorageGb = 200) {
    const totalBytesUsed = files.reduce((acc, f) => acc + f.size, 0);
    const bytesInGB = maxStorageGb * 1024 * 1024 * 1024;
    const percentageUsed = (totalBytesUsed / bytesInGB) * 100;

    storageStatValue.innerHTML = `
      ${formatBytes(totalBytesUsed)} / ${maxStorageGb} GB
      <span style="font-size:0.75rem;display:block;color:var(--text-muted);font-weight:normal;margin-top:4px">
        Terpakai ~${percentageUsed.toFixed(4)}%
      </span>
    `;
  }

  // =============================================
  // TAB: API KEYS
  // =============================================

  async function loadKeys() {
    keysList.innerHTML = `
      <tr><td colspan="6" class="text-center loading-state">
        <i class="fa-solid fa-spinner fa-spin"></i> Memuat API Key...
      </td></tr>
    `;

    try {
      const response = await fetchAPI('/api/admin/keys');
      if (response.success) {
        keysData = response.data;
        renderKeys(keysData);
      }
    } catch {
      keysList.innerHTML = `
        <tr><td colspan="6" class="text-center error-msg" style="padding:40px">
          Gagal memuat daftar API Key dari server.
        </td></tr>
      `;
    }
  }

  function renderKeys(keys) {
    if (keys.length === 0) {
      keysList.innerHTML = `
        <tr><td colspan="6" class="text-center loading-state">
          <i class="fa-solid fa-key" style="font-size:2rem;display:block;margin-bottom:10px"></i>
          Belum ada API Key dinamis yang dibuat.
        </td></tr>
      `;
      return;
    }

    keysList.innerHTML = '';
    keys.forEach(key => {
      const tr = document.createElement('tr');
      const createDate = new Date(key.created_at).toLocaleString('id-ID');
      const bucketLabel = key.bucket_name
        ? `<span class="badge badge-bucket"><i class="fa-solid fa-database"></i> ${escapeHTML(key.bucket_name)}</span>`
        : `<span class="badge" style="opacity:0.4">—</span>`;

      tr.innerHTML = `
        <td><strong>${escapeHTML(key.name)}</strong></td>
        <td>${bucketLabel}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <code class="code-token api-key-text" data-reveal="false" data-raw="${key.key_value}">
              ${obfuscateKey(key.key_value)}
            </code>
            <button class="icon-btn toggle-key-visibility" title="Tampilkan/Sembunyikan API Key">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="icon-btn copy-key-btn" data-key="${key.key_value}" title="Salin API Key">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </td>
        <td><span class="badge badge-active">${key.status}</span></td>
        <td>${createDate}</td>
        <td class="text-right">
          <button class="icon-btn icon-btn-danger delete-key-btn" data-id="${key.id}" title="Hapus API Key">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      const keyCell = tr.querySelector('.api-key-text');
      const toggleBtn = tr.querySelector('.toggle-key-visibility');

      toggleBtn.addEventListener('click', () => {
        const isRevealed = keyCell.getAttribute('data-reveal') === 'true';
        if (isRevealed) {
          keyCell.textContent = obfuscateKey(keyCell.getAttribute('data-raw'));
          keyCell.setAttribute('data-reveal', 'false');
          toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        } else {
          keyCell.textContent = keyCell.getAttribute('data-raw');
          keyCell.setAttribute('data-reveal', 'true');
          toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        }
      });

      tr.querySelector('.copy-key-btn').addEventListener('click', (e) => {
        const rawKey = e.currentTarget.getAttribute('data-key');
        navigator.clipboard.writeText(rawKey)
          .then(() => showToast('API Key disalin ke clipboard!'))
          .catch(() => showToast('Gagal menyalin key', 'error'));
      });

      tr.querySelector('.delete-key-btn').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('Hapus API Key ini? Aplikasi yang menggunakannya tidak bisa upload lagi.')) {
          try {
            const result = await fetchAPI(`/api/admin/keys/${id}`, 'DELETE');
            if (result.success) {
              showToast('API Key berhasil dihapus secara permanen');
              loadKeys();
            }
          } catch {}
        }
      });

      keysList.appendChild(tr);
    });
  }

  // Modal Buat API Key — populate dropdown bucket saat dibuka
  openCreateKeyModalBtn.addEventListener('click', async () => {
    // Refresh daftar bucket untuk dropdown
    keyBucketSelect.innerHTML = '<option value="" disabled selected>Memuat bucket...</option>';
    createKeyModal.classList.add('active');
    keyNameInput.value = '';

    try {
      const response = await fetchAPI('/api/admin/buckets');
      if (response.success && response.data.length > 0) {
        keyBucketSelect.innerHTML = '<option value="" disabled selected>-- Pilih Bucket --</option>';
        response.data.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.name;
          opt.textContent = b.name + (b.description ? ` — ${b.description}` : '');
          keyBucketSelect.appendChild(opt);
        });
      } else {
        keyBucketSelect.innerHTML = '<option value="" disabled selected>Belum ada bucket — buat bucket dulu</option>';
      }
    } catch {
      keyBucketSelect.innerHTML = '<option value="" disabled selected>Gagal memuat bucket</option>';
    }

    keyNameInput.focus();
  });

  createKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = keyNameInput.value.trim();
    const bucket_name = keyBucketSelect.value;

    if (!bucket_name) {
      showToast('Pilih bucket terlebih dahulu', 'error');
      return;
    }

    try {
      const response = await fetchAPI('/api/admin/keys', 'POST', { name, bucket_name });
      if (response.success) {
        closeModalById('create-key-modal');
        showToast('API Key baru berhasil dibuat!');
        loadKeys();

        alert(`✅ API Key Berhasil Dibuat!\n\nNama: ${response.data.name}\nBucket: ${response.data.bucketName}\nToken: ${response.data.keyValue}\n\n⚠️ PENTING: Salin token ini sekarang. Token tidak bisa ditampilkan secara utuh lagi setelah Anda menutup pesan ini.`);
      }
    } catch {}
  });

  // =============================================
  // TAB: AUDIT LOGS
  // =============================================

  async function loadLogs() {
    logsList.innerHTML = `
      <tr><td colspan="4" class="text-center loading-state">
        <i class="fa-solid fa-spinner fa-spin"></i> Memuat log audit...
      </td></tr>
    `;

    try {
      const response = await fetchAPI('/api/admin/logs');
      if (response.success) renderLogs(response.data);
    } catch {
      logsList.innerHTML = `
        <tr><td colspan="4" class="text-center error-msg" style="padding:40px">
          Gagal memuat log audit dari server.
        </td></tr>
      `;
    }
  }

  function renderLogs(logs) {
    if (logs.length === 0) {
      logsList.innerHTML = `
        <tr><td colspan="4" class="text-center loading-state">
          <i class="fa-solid fa-clock-rotate-left" style="font-size:2rem;display:block;margin-bottom:10px"></i>
          Belum ada log aktivitas keamanan yang tercatat.
        </td></tr>
      `;
      return;
    }

    logsList.innerHTML = '';
    logs.forEach(log => {
      const tr = document.createElement('tr');
      const logDate = new Date(log.timestamp).toLocaleString('id-ID');

      let badgeClass = 'badge-upload-single';
      if (log.action === 'UPLOAD_MULTIPLE') badgeClass = 'badge-upload-multiple';
      else if (log.action === 'DELETE_FILE') badgeClass = 'badge-delete-file';

      tr.innerHTML = `
        <td>${logDate}</td>
        <td><strong>${escapeHTML(log.api_key_name)}</strong></td>
        <td><span class="badge ${badgeClass}">${log.action}</span></td>
        <td>${escapeHTML(log.details)}</td>
      `;

      logsList.appendChild(tr);
    });
  }

  refreshLogsBtn.addEventListener('click', loadLogs);

  // =============================================
  // SISTEM MODAL UNIVERSAL
  // =============================================

  function closeModalById(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  // Close modal via tombol close (data-modal attribute)
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-modal');
      if (modalId) closeModalById(modalId);
    });
  });

  // Close modal klik di luar area modal
  [createBucketModal, createKeyModal].forEach(modal => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // =============================================
  // FUNGSI UTILS
  // =============================================

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  function obfuscateKey(key) {
    if (key.length <= 10) return '••••••••';
    return key.substring(0, 6) + '••••••••' + key.substring(key.length - 4);
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Jalankan autentikasi di awal load
  initAuth();
});
