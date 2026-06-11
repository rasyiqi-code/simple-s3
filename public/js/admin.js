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

  // Elements Tab API Keys
  const keysList = document.getElementById('keys-list');
  const openCreateKeyModalBtn = document.getElementById('open-create-key-modal');
  const createKeyModal = document.getElementById('create-key-modal');
  const createKeyForm = document.getElementById('create-key-form');
  const keyNameInput = document.getElementById('key-name');
  const closeModalBtns = document.querySelectorAll('.close-modal-btn');

  // Elements Tab Audit Logs
  const logsList = document.getElementById('logs-list');
  const refreshLogsBtn = document.getElementById('refresh-logs-btn');

  // Toast
  const toast = document.getElementById('toast');

  // --- SISTEM NOTIFIKASI TOAST ---
  function showToast(message, type = 'success') {
    toast.className = `toast ${type}`;
    toast.innerHTML = type === 'success' 
      ? `<i class="fa-solid fa-circle-check"></i> ${message}`
      : `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
    
    toast.style.display = 'flex';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  // --- KONEKSI API ADMIN ---
  async function fetchAPI(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      headers['x-admin-key'] = adminToken;
    }

    const config = { method, headers };
    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan sistem');
      }
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
  function switchTab(tabName) {
    activeTab = tabName;
    
    // Update active class on nav buttons
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update active tab content
    tabContents.forEach(content => {
      if (content.getAttribute('id') === `tab-${tabName}`) {
        content.classList.add('active-tab');
      } else {
        content.classList.remove('active-tab');
      }
    });

    // Update titles
    if (tabName === 'explorer') {
      pageTitle.textContent = 'File Explorer';
      pageSubtitle.textContent = 'Kelola dan pantau seluruh aset media yang terunggah secara aman';
      loadFiles();
    } else if (tabName === 'apikeys') {
      pageTitle.textContent = 'API Keys';
      pageSubtitle.textContent = 'Kelola kunci akses dinamis untuk integrasi aplikasi web klien';
      loadKeys();
    } else if (tabName === 'logs') {
      pageTitle.textContent = 'Audit Logs';
      pageSubtitle.textContent = 'Pantau seluruh rekaman aktivitas transfer data secara real-time';
      loadLogs();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.getAttribute('data-tab'));
    });
  });

  // --- LOGIKA TAB: FILE EXPLORER ---
  async function loadFiles() {
    filesList.innerHTML = `
      <tr>
        <td colspan="6" class="text-center loading-state">
          <i class="fa-solid fa-spinner fa-spin"></i> Memuat berkas...
        </td>
      </tr>
    `;

    try {
      const response = await fetchAPI('/api/admin/files');
      if (response.success) {
        filesData = response.data;
        renderFiles(filesData);
        calculateDiskUsage(filesData);
      }
    } catch (err) {
      filesList.innerHTML = `
        <tr>
          <td colspan="6" class="text-center error-msg" style="padding: 40px;">
            Gagal memuat data berkas dari server.
          </td>
        </tr>
      `;
    }
  }

  function renderFiles(files) {
    if (files.length === 0) {
      filesList.innerHTML = `
        <tr>
          <td colspan="6" class="text-center loading-state">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
            Belum ada berkas yang diunggah.
          </td>
        </tr>
      `;
      return;
    }

    filesList.innerHTML = '';
    files.forEach(file => {
      const tr = document.createElement('tr');
      
      // Deteksi ikon berdasarkan mime-type
      let iconClass = 'fa-file';
      if (file.mime_type.startsWith('image/')) iconClass = 'fa-file-image';
      else if (file.mime_type.startsWith('video/')) iconClass = 'fa-file-video';
      else if (file.mime_type.includes('pdf')) iconClass = 'fa-file-pdf';
      else if (file.mime_type.includes('zip')) iconClass = 'fa-file-zipper';

      // Format Ukuran File
      const formattedSize = formatBytes(file.size);
      
      // Format Tanggal
      const uploadDate = new Date(file.uploaded_at).toLocaleString('id-ID');

      tr.innerHTML = `
        <td>
          <div class="file-name-cell">
            <i class="fa-solid ${iconClass} file-icon"></i>
            <span>${escapeHTML(file.original_name)}</span>
          </div>
        </td>
        <td>
          <a href="/file/${file.filename}" target="_blank" class="code-token">${file.filename}</a>
        </td>
        <td>${formattedSize}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">${file.mime_type}</span></td>
        <td>${uploadDate}</td>
        <td class="text-right">
          <div class="actions-cell">
            <button class="icon-btn copy-url-btn" data-url="/file/${file.filename}" title="Salin URL Berkas">
              <i class="fa-solid fa-link"></i>
            </button>
            <button class="icon-btn icon-btn-danger delete-file-btn" data-filename="${file.filename}" title="Hapus Berkas">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      // Event listener copy URL berkas
      tr.querySelector('.copy-url-btn').addEventListener('click', (e) => {
        const relativeUrl = e.currentTarget.getAttribute('data-url');
        const absoluteUrl = window.location.origin + relativeUrl;
        
        navigator.clipboard.writeText(absoluteUrl)
          .then(() => showToast('URL berkas berhasil disalin ke clipboard!'))
          .catch(() => showToast('Gagal menyalin URL', 'error'));
      });

      // Event listener hapus berkas
      tr.querySelector('.delete-file-btn').addEventListener('click', async (e) => {
        const filename = e.currentTarget.getAttribute('data-filename');
        
        if (confirm(`Apakah Anda yakin ingin menghapus berkas "${filename}" secara permanen dari penyimpanan VPS?`)) {
          try {
            const result = await fetchAPI(`/api/admin/files/${filename}`, 'DELETE');
            if (result.success) {
              showToast('Berkas berhasil dihapus');
              loadFiles();
            }
          } catch (err) {}
        }
      });

      filesList.appendChild(tr);
    });
  }

  // Live filter pencarian berkas
  searchFiles.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filteredFiles = filesData.filter(file => 
      file.original_name.toLowerCase().includes(query) || 
      file.filename.toLowerCase().includes(query)
    );
    renderFiles(filteredFiles);
  });

  refreshFilesBtn.addEventListener('click', loadFiles);

  // Perhitungan dinamis kapasitas VPS
  function calculateDiskUsage(files) {
    const totalBytesUsed = files.reduce((acc, file) => acc + file.size, 0);
    const totalGB = 200; // Kapasitas VPS
    const bytesInGB = totalGB * 1024 * 1024 * 1024;
    const percentageUsed = (totalBytesUsed / bytesInGB) * 100;
    
    storageStatValue.innerHTML = `
      ${formatBytes(totalBytesUsed)} / 200 GB
      <span style="font-size: 0.75rem; display: block; color: var(--text-muted); font-weight: normal; margin-top: 4px;">
        Terpakai ~${percentageUsed.toFixed(4)}%
      </span>
    `;
  }

  // --- LOGIKA TAB: API KEYS ---
  async function loadKeys() {
    keysList.innerHTML = `
      <tr>
        <td colspan="5" class="text-center loading-state">
          <i class="fa-solid fa-spinner fa-spin"></i> Memuat API Key...
        </td>
      </tr>
    `;

    try {
      const response = await fetchAPI('/api/admin/keys');
      if (response.success) {
        keysData = response.data;
        renderKeys(keysData);
      }
    } catch (err) {
      keysList.innerHTML = `
        <tr>
          <td colspan="5" class="text-center error-msg" style="padding: 40px;">
            Gagal memuat daftar API Key dari server.
          </td>
        </tr>
      `;
    }
  }

  function renderKeys(keys) {
    if (keys.length === 0) {
      keysList.innerHTML = `
        <tr>
          <td colspan="5" class="text-center loading-state">
            <i class="fa-solid fa-key" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
            Belum ada API Key dinamis yang dibuat.
          </td>
        </tr>
      `;
      return;
    }

    keysList.innerHTML = '';
    keys.forEach(key => {
      const tr = document.createElement('tr');
      const createDate = new Date(key.created_at).toLocaleString('id-ID');

      tr.innerHTML = `
        <td><strong>${escapeHTML(key.name)}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
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

      // Event listener Tampilkan/Sembunyikan Key
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

      // Event listener copy API Key
      tr.querySelector('.copy-key-btn').addEventListener('click', (e) => {
        const rawKey = e.currentTarget.getAttribute('data-key');
        navigator.clipboard.writeText(rawKey)
          .then(() => showToast('API Key disalin ke clipboard!'))
          .catch(() => showToast('Gagal menyalin key', 'error'));
      });

      // Event listener hapus API Key
      tr.querySelector('.delete-key-btn').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('Apakah Anda yakin ingin menghapus API Key ini? Aplikasi web klien yang menggunakan key ini tidak akan bisa mengunggah file lagi.')) {
          try {
            const result = await fetchAPI(`/api/admin/keys/${id}`, 'DELETE');
            if (result.success) {
              showToast('API Key berhasil dihapus secara permanen');
              loadKeys();
            }
          } catch (err) {}
        }
      });

      keysList.appendChild(tr);
    });
  }

  // --- SISTEM MODAL (CREATE KEY) ---
  openCreateKeyModalBtn.addEventListener('click', () => {
    createKeyModal.classList.add('active');
    keyNameInput.value = '';
    keyNameInput.focus();
  });

  function closeModal() {
    createKeyModal.classList.remove('active');
  }

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Close modal click outside
  createKeyModal.addEventListener('click', (e) => {
    if (e.target === createKeyModal) {
      closeModal();
    }
  });

  createKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = keyNameInput.value.trim();

    try {
      const response = await fetchAPI('/api/admin/keys', 'POST', { name });
      if (response.success) {
        closeModal();
        showToast('API Key baru berhasil dibuat!');
        loadKeys();
        
        // Munculkan prompt dialog untuk mengizinkan pengguna langsung menyalin key baru
        alert(`API Key Berhasil Dibuat!\n\nNama: ${response.data.name}\nToken: ${response.data.keyValue}\n\n*PENTING: Salin token di atas sekarang karena token ini tidak dapat ditampilkan secara utuh lagi setelah Anda menutup pesan ini demi alasan keamanan.`);
      }
    } catch (err) {}
  });

  // --- FUNGSI FORMATTING & UTILS ---
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function obfuscateKey(key) {
    if (key.length <= 10) return '••••••••';
    return key.substring(0, 6) + '••••••••' + key.substring(key.length - 4);
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // --- LOGIKA TAB: AUDIT LOGS ---
  async function loadLogs() {
    logsList.innerHTML = `
      <tr>
        <td colspan="4" class="text-center loading-state">
          <i class="fa-solid fa-spinner fa-spin"></i> Memuat log audit...
        </td>
      </tr>
    `;

    try {
      const response = await fetchAPI('/api/admin/logs');
      if (response.success) {
        renderLogs(response.data);
      }
    } catch (err) {
      logsList.innerHTML = `
        <tr>
          <td colspan="4" class="text-center error-msg" style="padding: 40px;">
            Gagal memuat log audit dari server.
          </td>
        </tr>
      `;
    }
  }

  function renderLogs(logs) {
    if (logs.length === 0) {
      logsList.innerHTML = `
        <tr>
          <td colspan="4" class="text-center loading-state">
            <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
            Belum ada log aktivitas keamanan yang tercatat.
          </td>
        </tr>
      `;
      return;
    }

    logsList.innerHTML = '';
    logs.forEach(log => {
      const tr = document.createElement('tr');
      const logDate = new Date(log.timestamp).toLocaleString('id-ID');
      
      // Pilih kelas warna badge berdasarkan aksi
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

  // Jalankan autentikasi di awal load
  initAuth();
});
