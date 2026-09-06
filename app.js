import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc,
    getDocs, setDoc, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// [DIUBAH] POIN 8A: Google Sign-In (signInWithPopup/googleProvider) DIHAPUS TOTAL.
// Autentikasi sekarang murni Email/Password.

// ======================================
// KONSTANTA
// ======================================
// [DIUBAH] POIN 8E: admin ditentukan lewat email khusus ini, bukan lagi via akun Google pribadi
const ADMIN_EMAIL = 'kibsaportalbelajar@gmail.com';
const ADMIN_USERNAME = 'KIBSA';

const KELAS_LIST = ['Kelas 1 SD', 'Kelas 2 SD', 'Kelas 3 SD', 'Kelas 4 SD', 'Kelas 5 SD', 'Kelas 6 SD'];

// [DIUBAH] POIN 2: IPAS dipisah jadi IPA & IPS tersendiri, tanpa Otak Hebat/Level
const MAPEL_LIST = [
    { nama: 'Bahasa Indonesia', icon: '📖' },
    { nama: 'IPA', icon: '🔬' },
    { nama: 'IPS', icon: '🌍' },
    { nama: 'Bahasa Inggris', icon: '🔤' },
    { nama: 'Matematika', icon: '🔢' },
    { nama: 'Pendidikan Pancasila', icon: '🇮🇩' },
];

// ======================================
// STATE
// ======================================
let currentUser = null;      // objek Firebase Auth user
let currentProfile = null;   // dokumen Firestore /users/{uid} (berisi role, kibsaId, dst)
let isAdmin = false;

let editingPosterId = null;
let editingPortalId = null;
let editingMitraId = null;
let editingMaterialId = null;

let postersData = {};
let materialsData = {};
let portalsData = {};
let mitraData = {}; // [BARU] POIN 6

let activeKelas = null;
let activeMapel = null;

let carouselIndex = 0;
let carouselTimer = null;

let authMode = 'login'; // 'login' | 'register'
let pendingAction = null; // aksi tertunda yang menunggu login (mis. buka mapel modal)

// ======================================
// MODAL TENTANG KIBSA
// ======================================
window.openTentangModal = () => document.getElementById('tentangModal')?.classList.remove('hidden');
window.closeTentangModal = () => document.getElementById('tentangModal')?.classList.add('hidden');

// ======================================
// KONVERTER LINK GOOGLE DRIVE -> DIRECT IMAGE STREAM
// ======================================
function convertGoogleDriveLink(url) {
    if (!url) return url;
    url = url.trim();
    try {
        let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
        match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
        return url;
    } catch (e) { return url; }
}
window.convertGoogleDriveLink = convertGoogleDriveLink;

// ======================================
// [BARU] POIN 8D: GENERATOR KIBSA ID
// Format: [Urutan 3 digit][Tanggal Daftar DDMMYY][Tanggal Lahir DDMMYY]
// ======================================
function toDDMMYY(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = String(dateObj.getFullYear()).slice(-2);
    return `${d}${m}${y}`;
}

async function generateKibsaId(birthDateStr) {
    // birthDateStr datang dari <input type="date"> => format "YYYY-MM-DD"
    const usersSnap = await getDocs(collection(db, "users"));
    const urutan = String(usersSnap.size + 1).padStart(3, '0');
    const regDate = toDDMMYY(new Date());
    const [by, bm, bd] = birthDateStr.split('-');
    const birthDDMMYY = `${bd}${bm}${by.slice(-2)}`;
    return `${urutan}${regDate}${birthDDMMYY}`;
}

document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // ELEMENT REFERENCES
    // ======================================
    // [DIUBAH] POIN 8A: satu set tombol auth untuk semua orang
    const authOpenBtn = document.getElementById('auth-open-btn');
    const authLogoutBtn = document.getElementById('auth-logout-btn');
    const userBadge = document.getElementById('user-badge');
    const userNameDisplay = document.getElementById('user-name-display');
    const userRoleDisplay = document.getElementById('user-role-display');

    const authModal = document.getElementById('auth-modal');
    const authTabLogin = document.getElementById('auth-tab-login');
    const authTabRegister = document.getElementById('auth-tab-register');
    const authGateNote = document.getElementById('auth-gate-note');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const registerSubmitBtn = document.getElementById('register-submit-btn');

    // Poster (Info & Event)
    const addPosterBtn = document.getElementById('add-poster-btn');
    const posterModal = document.getElementById('admin-poster-modal');
    const posterForm = document.getElementById('poster-form');
    const posterCancelBtn = document.getElementById('poster-cancel-btn');
    const posterGrid = document.getElementById('poster-grid');
    const posterModalTitle = document.getElementById('poster-modal-title');
    const posterSubmitBtn = document.getElementById('poster-submit-btn');
    const posterImageUrlInput = document.getElementById('poster-image-url');
    const posterDetailModal = document.getElementById('poster-detail-modal');

    // Portal Terkait
    const addPortalBtn = document.getElementById('add-portal-btn');
    const portalModal = document.getElementById('admin-portal-modal');
    const portalForm = document.getElementById('portal-form');
    const portalCancelBtn = document.getElementById('portal-cancel-btn');
    const portalGrid = document.getElementById('portal-grid');
    const portalModalTitle = document.getElementById('portal-modal-title');
    const portalSubmitBtn = document.getElementById('portal-submit-btn');

    // [BARU] POIN 6: Mitra Kolaborasi
    const addMitraBtn = document.getElementById('add-mitra-btn');
    const mitraModal = document.getElementById('admin-mitra-modal');
    const mitraForm = document.getElementById('mitra-form');
    const mitraCancelBtn = document.getElementById('mitra-cancel-btn');
    const mitraGrid = document.getElementById('mitra-grid');
    const mitraModalTitle = document.getElementById('mitra-modal-title');
    const mitraSubmitBtn = document.getElementById('mitra-submit-btn');
    const mitraImageUrlInput = document.getElementById('mitra-image-url');
    const mitraDetailModal = document.getElementById('mitra-detail-modal');

    // Materi (admin)
    const addMaterialBtn = document.getElementById('add-material-btn');
    const materialModal = document.getElementById('admin-material-modal');
    const materialForm = document.getElementById('material-form');
    const materialCancelBtn = document.getElementById('mat-cancel-btn');
    const materialModalTitle = document.getElementById('material-modal-title');
    const materialSubmitBtn = document.getElementById('mat-submit-btn');
    const matAngkaSelect = document.getElementById('mat-angka');

    // Kelas & Mapel & Materi (siswa)
    const kelasGrid = document.getElementById('kelas-grid');
    const mapelModal = document.getElementById('mapel-modal');
    const mapelModalTitle = document.getElementById('mapel-modal-title');
    const mapelList = document.getElementById('mapel-list');
    const materiListModal = document.getElementById('materi-list-modal');
    const materiListTitle = document.getElementById('materi-list-title');
    const materiList = document.getElementById('materi-list');

    // Carousel
    const carouselTrack = document.getElementById('poster-carousel-track');
    const carouselDots = document.getElementById('carousel-dots');
    const carouselCaption = document.getElementById('carousel-caption');

    // ======================================
    // Isi dropdown "Angka Materi" 1-20
    // ======================================
    if (matAngkaSelect) {
        for (let i = 1; i <= 20; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = i;
            matAngkaSelect.appendChild(opt);
        }
    }

    // ======================================
    // [BARU] POIN 8: AUTH STATE LISTENER (Email/Password + Firestore profile)
    // ======================================
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            // Ambil profil dari Firestore /users/{uid}
            try {
                const usersSnap = await getDocs(collection(db, "users"));
                let profileDoc = null;
                usersSnap.forEach(d => { if (d.id === user.uid) profileDoc = { id: d.id, ...d.data() }; });
                currentProfile = profileDoc;
            } catch (e) {
                console.error('Gagal memuat profil pengguna:', e);
                currentProfile = null;
            }

            isAdmin = !!(currentProfile && currentProfile.role === 'admin');

            if (authOpenBtn) authOpenBtn.classList.add('hidden');
            if (authLogoutBtn) authLogoutBtn.classList.remove('hidden');
            if (userBadge) {
                userBadge.classList.remove('hidden');
                userBadge.classList.add('flex');
                if (userNameDisplay) userNameDisplay.innerText = currentProfile ? (isAdmin ? ADMIN_USERNAME : currentProfile.namaLengkap) : (user.email || '');
                if (userRoleDisplay) userRoleDisplay.innerText = isAdmin ? 'ADMIN' : (currentProfile ? `ID: ${currentProfile.kibsaId}` : '');
            }

            if (addPosterBtn) addPosterBtn.classList.toggle('hidden', !isAdmin);
            if (addPortalBtn) addPortalBtn.classList.toggle('hidden', !isAdmin);
            if (addMitraBtn) addMitraBtn.classList.toggle('hidden', !isAdmin);
            if (addMaterialBtn) addMaterialBtn.classList.toggle('hidden', !isAdmin);

            closeAuthModalInternal();

            // Jika ada aksi tertunda (mis. buka kelas) sebelum login, lanjutkan sekarang
            if (pendingAction) {
                const action = pendingAction;
                pendingAction = null;
                action();
            }
        } else {
            currentProfile = null;
            isAdmin = false;
            if (authOpenBtn) authOpenBtn.classList.remove('hidden');
            if (authLogoutBtn) authLogoutBtn.classList.add('hidden');
            if (userBadge) { userBadge.classList.add('hidden'); userBadge.classList.remove('flex'); }
            if (addPosterBtn) addPosterBtn.classList.add('hidden');
            if (addPortalBtn) addPortalBtn.classList.add('hidden');
            if (addMitraBtn) addMitraBtn.classList.add('hidden');
            if (addMaterialBtn) addMaterialBtn.classList.add('hidden');
        }
        renderPosters();
        renderMaterialsHidden();
        renderPortals();
        renderMitra(); // [BARU] POIN 6
        renderCarousel();
    });

    // ======================================
    // [BARU] POIN 8: MODAL AUTH — buka/tutup & ganti tab
    // ======================================
    window.openAuthModal = (gate) => {
        if (authModal) authModal.classList.remove('hidden');
        if (authGateNote) authGateNote.classList.toggle('hidden', !gate);
    };
    function closeAuthModalInternal() {
        if (authModal) authModal.classList.add('hidden');
        if (authGateNote) authGateNote.classList.add('hidden');
        if (loginForm) loginForm.reset();
        if (registerForm) registerForm.reset();
    }
    window.closeAuthModal = closeAuthModalInternal;

    window.switchAuthTab = (mode) => {
        authMode = mode;
        if (mode === 'login') {
            authTabLogin?.classList.add('auth-tab-active');
            authTabRegister?.classList.remove('auth-tab-active');
            loginForm?.classList.remove('hidden');
            registerForm?.classList.add('hidden');
        } else {
            authTabRegister?.classList.add('auth-tab-active');
            authTabLogin?.classList.remove('auth-tab-active');
            registerForm?.classList.remove('hidden');
            loginForm?.classList.add('hidden');
        }
    };

    // Dipanggil oleh bagian yang butuh login (mis. buka kelas) — akan membuka modal
    // dengan catatan "gate" dan menyimpan aksi untuk dilanjutkan setelah login sukses.
    function requireAuth(actionFn) {
        if (currentUser) {
            actionFn();
        } else {
            pendingAction = actionFn;
            switchAuthTab('login');
            openAuthModal(true);
        }
    }

    // ======================================
    // FORM LOGIN (Email/Password)
    // ======================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            if (loginSubmitBtn) { loginSubmitBtn.disabled = true; loginSubmitBtn.innerText = 'Memuat...'; }
            try {
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged akan menutup modal & melanjutkan pendingAction
            } catch (err) {
                alert('Login gagal: ' + (err.message || err.code));
            } finally {
                if (loginSubmitBtn) { loginSubmitBtn.disabled = false; loginSubmitBtn.innerText = 'Masuk'; }
            }
        });
    }

    // ======================================
    // FORM DAFTAR (Registrasi + Generate KIBSA ID + Role Assignment)
    // ======================================
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nama = document.getElementById('reg-nama').value.trim();
            const tglLahir = document.getElementById('reg-tgl-lahir').value; // YYYY-MM-DD
            const gender = document.getElementById('reg-gender').value;
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;

            if (registerSubmitBtn) { registerSubmitBtn.disabled = true; registerSubmitBtn.innerText = 'Mendaftarkan...'; }
            try {
                // [BARU] POIN 8D: hitung KIBSA ID SEBELUM membuat akun (pakai jumlah user saat ini)
                const kibsaId = await generateKibsaId(tglLahir);

                // [BARU] POIN 8E: tentukan role berdasarkan email pendaftar
                const role = (email.toLowerCase() === ADMIN_EMAIL) ? 'admin' : 'student';

                const cred = await createUserWithEmailAndPassword(auth, email, password);

                await setDoc(doc(db, "users", cred.user.uid), {
                    namaLengkap: nama,
                    tanggalLahir: tglLahir,
                    jenisKelamin: gender,
                    email: email,
                    kibsaId: kibsaId,
                    role: role,
                    username: role === 'admin' ? ADMIN_USERNAME : nama,
                    createdAt: new Date().toISOString(),
                });

                alert(`Selamat datang, ${nama}!\nID KIBSA kamu: ${kibsaId}\n(Harap diingat atau dicatat ya!)`);
                // onAuthStateChanged akan mengambil profil & menutup modal otomatis
            } catch (err) {
                alert('Pendaftaran gagal: ' + (err.message || err.code));
            } finally {
                if (registerSubmitBtn) { registerSubmitBtn.disabled = false; registerSubmitBtn.innerText = 'Daftar & Buat ID KIBSA'; }
            }
        });
    }

    window.handleLogout = async () => {
        if (confirm('Apakah kamu yakin ingin keluar?')) {
            await signOut(auth);
        }
    };

    // ======================================
    // RENDER 6 KOTAK KELAS
    // ======================================
    function renderKelasBoxes() {
        if (!kelasGrid) return;
        kelasGrid.innerHTML = '';
        const kelasColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400'];
        KELAS_LIST.forEach((kelas, i) => {
            const nomor = kelas.match(/\d/)[0];
            const box = document.createElement('div');
            box.className = 'kelas-box bg-white rounded-2xl shadow-md hover:shadow-xl border border-slate-100 flex flex-col items-center p-4 cursor-pointer';
            box.innerHTML = `
                <div class="${kelasColors[i]} w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-black mb-3 shadow">${nomor}</div>
                <p class="font-bold text-slate-700 text-sm text-center">Kelas ${nomor} SD</p>
                <button class="mt-3 w-full text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-2 rounded-full transition">Masuk Kelas</button>
            `;
            // [DIUBAH] POIN 8B: akses materi wajib login — kalau belum, arahkan ke modal Masuk/Daftar
            box.addEventListener('click', () => requireAuth(() => openKelasModal(kelas)));
            kelasGrid.appendChild(box);
        });
    }

    window.openKelasModal = (kelas) => {
        activeKelas = kelas;
        if (mapelModalTitle) mapelModalTitle.innerText = kelas;
        if (mapelList) {
            mapelList.innerHTML = '';
            MAPEL_LIST.forEach(m => {
                const item = document.createElement('button');
                item.className = 'flex items-center gap-3 p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 transition text-left';
                item.innerHTML = `<span class="text-3xl">${m.icon}</span><span class="font-bold text-slate-700">${m.nama}</span>`;
                item.addEventListener('click', () => {
                    if (mapelModal) mapelModal.classList.add('hidden');
                    openMateriListModal(kelas, m.nama);
                });
                mapelList.appendChild(item);
            });
        }
        if (mapelModal) mapelModal.classList.remove('hidden');
    };
    window.closeMapelModal = () => mapelModal?.classList.add('hidden');

    // ======================================
    // [DIUBAH] POIN 2: MODAL "Materi & Pembahasan" — daftar materi per mapel,
    // MENGGANTIKAN sistem Level Berantai (Level 1/2/3) sepenuhnya.
    // ======================================
    function findMaterialsFor(kelas, matpel) {
        return Object.values(materialsData)
            .filter(m => m.jenjang === kelas && m.matpel === matpel)
            .sort((a, b) => Number(a.angka) - Number(b.angka));
    }

    window.openMateriListModal = (kelas, matpel) => {
        activeKelas = kelas;
        activeMapel = matpel;
        const materials = findMaterialsFor(kelas, matpel);

        if (materiListTitle) materiListTitle.innerText = `${matpel} — ${kelas}`;
        if (materiList) {
            materiList.innerHTML = '';
            if (materials.length === 0) {
                materiList.innerHTML = '<p class="text-slate-400 text-center py-6">Materi untuk mapel ini belum tersedia. Nantikan update dari admin ya!</p>';
            } else {
                materials.forEach(mat => {
                    const row = document.createElement('div');
                    row.className = 'materi-item bg-white border-2 border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-3';
                    const adminActions = isAdmin ? `
                        <div class="flex gap-2 flex-shrink-0">
                            <button data-id="${mat.id}" class="edit-mat-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition text-sm">✏️</button>
                            <button data-id="${mat.id}" class="delete-mat-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition text-sm">🗑️</button>
                        </div>` : '';
                    row.innerHTML = `
                        <div class="flex items-center gap-3 min-w-0" data-open-slide="${mat.id}">
                            <span class="text-2xl">📄</span>
                            <p class="font-bold text-slate-800 truncate">${mat.angka}. ${mat.judul}</p>
                        </div>
                        ${adminActions}
                    `;
                    row.querySelector('[data-open-slide]').addEventListener('click', () => {
                        window.open(mat.slideLink, '_blank', 'noopener');
                    });
                    materiList.appendChild(row);
                });
            }
        }
        if (materiListModal) materiListModal.classList.remove('hidden');

        if (isAdmin) {
            materiList.querySelectorAll('.edit-mat-btn').forEach(btn =>
                btn.addEventListener('click', e => { e.stopPropagation(); editMaterial(e.currentTarget.dataset.id); }));
            materiList.querySelectorAll('.delete-mat-btn').forEach(btn =>
                btn.addEventListener('click', e => { e.stopPropagation(); deleteMaterial(e.currentTarget.dataset.id); }));
        }
    };
    window.closeMateriListModal = () => materiListModal?.classList.add('hidden');

    // ======================================
    // CAROUSEL POSTER AUTO-PLAY
    // ======================================
    function renderCarousel() {
        if (!carouselTrack) return;
        const posters = Object.values(postersData);
        carouselTrack.innerHTML = '';
        if (carouselDots) carouselDots.innerHTML = '';
        if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }

        if (posters.length === 0) {
            carouselTrack.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 font-semibold">Belum ada poster untuk ditampilkan.</div>';
            if (carouselCaption) carouselCaption.innerText = '';
            return;
        }

        posters.forEach((p) => {
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.innerHTML = `
                <img src="${p.imageUrl}" alt="" aria-hidden="true" class="carousel-slide-bg" onerror="this.style.display='none'">
                <img src="${p.imageUrl}" alt="${p.title}" class="carousel-slide-img" onerror="this.src='https://placehold.co/800x400/e2e8f0/94a3b8?text=Poster'">
            `;
            carouselTrack.appendChild(slide);
        });

        posters.forEach((p, i) => {
            if (carouselDots) {
                const dot = document.createElement('div');
                dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
                dot.addEventListener('click', () => goToSlide(i));
                carouselDots.appendChild(dot);
            }
        });

        carouselIndex = 0;
        updateCarouselPosition(posters);

        if (posters.length > 1) {
            carouselTimer = setInterval(() => {
                carouselIndex = (carouselIndex + 1) % posters.length;
                updateCarouselPosition(posters);
            }, 4000);
        }
    }

    function goToSlide(i) {
        carouselIndex = i;
        updateCarouselPosition(Object.values(postersData));
    }

    function updateCarouselPosition(posters) {
        if (!carouselTrack) return;
        carouselTrack.style.transform = `translateX(-${carouselIndex * 100}%)`;
        if (carouselDots) {
            Array.from(carouselDots.children).forEach((d, i) => d.classList.toggle('active', i === carouselIndex));
        }
        if (carouselCaption && posters && posters[carouselIndex]) {
            carouselCaption.innerText = posters[carouselIndex].title || '';
        }
    }

    // ======================================
    // MODAL HANDLERS: EVENT (POSTER)
    // ======================================
    if (addPosterBtn) {
        addPosterBtn.addEventListener('click', () => {
            editingPosterId = null;
            posterForm?.reset();
            if (posterModalTitle) posterModalTitle.innerText = 'Tambah Event / Pengumuman';
            posterModal?.classList.remove('hidden');
        });
    }
    if (posterCancelBtn) posterCancelBtn.addEventListener('click', () => posterModal.classList.add('hidden'));
    if (posterImageUrlInput) {
        posterImageUrlInput.addEventListener('blur', () => {
            posterImageUrlInput.value = convertGoogleDriveLink(posterImageUrlInput.value);
        });
    }

    // ======================================
    // MODAL HANDLERS: PORTAL
    // ======================================
    if (addPortalBtn) {
        addPortalBtn.addEventListener('click', () => {
            editingPortalId = null;
            portalForm?.reset();
            if (portalModalTitle) portalModalTitle.innerText = 'Tambah Portal Terkait';
            portalModal?.classList.remove('hidden');
        });
    }
    if (portalCancelBtn) portalCancelBtn.addEventListener('click', () => portalModal.classList.add('hidden'));

    // ======================================
    // [BARU] POIN 6: MODAL HANDLERS: MITRA KOLABORASI
    // ======================================
    if (addMitraBtn) {
        addMitraBtn.addEventListener('click', () => {
            editingMitraId = null;
            mitraForm?.reset();
            if (mitraModalTitle) mitraModalTitle.innerText = 'Tambah Mitra Kolaborasi';
            mitraModal?.classList.remove('hidden');
        });
    }
    if (mitraCancelBtn) mitraCancelBtn.addEventListener('click', () => mitraModal.classList.add('hidden'));
    if (mitraImageUrlInput) {
        mitraImageUrlInput.addEventListener('blur', () => {
            mitraImageUrlInput.value = convertGoogleDriveLink(mitraImageUrlInput.value);
        });
    }

    if (mitraForm) {
        mitraForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (mitraSubmitBtn) { mitraSubmitBtn.disabled = true; mitraSubmitBtn.innerText = 'Menyimpan...'; }
            try {
                const rawUrl = document.getElementById('mitra-image-url').value;
                const data = {
                    judul: document.getElementById('mitra-judul').value,
                    imageUrl: convertGoogleDriveLink(rawUrl),
                    date: document.getElementById('mitra-date').value,
                    description: document.getElementById('mitra-desc').value,
                };
                if (editingMitraId) {
                    await updateDoc(doc(db, "mitra", editingMitraId), data);
                } else {
                    await addDoc(collection(db, "mitra"), data);
                }
                mitraModal?.classList.add('hidden');
                mitraForm.reset();
                editingMitraId = null;
            } catch (e) { alert('Error: ' + e.message); }
            finally {
                if (mitraSubmitBtn) { mitraSubmitBtn.disabled = false; mitraSubmitBtn.innerText = 'Simpan'; }
            }
        });
    }

    window.editMitra = function (id) {
        const m = mitraData[id];
        if (!m) return;
        editingMitraId = id;
        document.getElementById('mitra-judul').value = m.judul || '';
        document.getElementById('mitra-image-url').value = m.imageUrl || '';
        document.getElementById('mitra-date').value = m.date || '';
        document.getElementById('mitra-desc').value = m.description || '';
        if (mitraModalTitle) mitraModalTitle.innerText = 'Edit Mitra Kolaborasi';
        mitraModal?.classList.remove('hidden');
    };
    window.deleteMitra = async function (id) {
        if (!confirm('Hapus mitra ini dari daftar?')) return;
        try { await deleteDoc(doc(db, "mitra", id)); }
        catch (e) { alert('Gagal menghapus: ' + e.message); }
    };

    window.openMitraDetail = function (id) {
        const m = mitraData[id];
        if (!m || !mitraDetailModal) return;
        document.getElementById('mitra-detail-img').src = m.imageUrl || '';
        document.getElementById('mitra-detail-title').innerText = m.judul || '';
        document.getElementById('mitra-detail-date').innerText = '📅 ' + (m.date || '');
        document.getElementById('mitra-detail-description').innerText = m.description || '';
        mitraDetailModal.classList.remove('hidden');
    };
    window.closeMitraDetail = () => mitraDetailModal?.classList.add('hidden');

    function renderMitra() {
        if (!mitraGrid) return;
        mitraGrid.innerHTML = '';
        const items = Object.values(mitraData);
        if (items.length === 0) {
            mitraGrid.innerHTML = '<p class="text-slate-400 col-span-full text-center py-10">Belum ada mitra kolaborasi. Admin dapat menambahkan yang baru.</p>';
            return;
        }
        items.forEach(m => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100 flex flex-col hover:shadow-xl transition-all relative';
            const adminActions = isAdmin ? `
                <div class="absolute top-2 right-2 flex gap-2 z-10">
                    <button data-id="${m.id}" class="edit-mitra-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition">✏️</button>
                    <button data-id="${m.id}" class="delete-mitra-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition">🗑️</button>
                </div>` : '';
            card.innerHTML = `
                <div class="relative w-full mitra-card-img bg-slate-100 flex-shrink-0 overflow-hidden">
                    <img src="${m.imageUrl}" alt="${m.judul}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/500x400/e2e8f0/94a3b8?text=Mitra'">
                    ${adminActions}
                </div>
                <div class="p-4 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <h3 class="text-base font-bold text-slate-800 truncate">${m.judul}</h3>
                        <p class="text-slate-400 text-[0.7rem] font-semibold">📅 ${m.date}</p>
                    </div>
                    <button data-id="${m.id}" class="view-mitra-detail-btn flex-shrink-0 text-[0.7rem] font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 px-3 py-1.5 rounded-full transition">+ Lihat Detail</button>
                </div>`;
            mitraGrid.appendChild(card);
        });

        mitraGrid.querySelectorAll('.view-mitra-detail-btn').forEach(btn =>
            btn.addEventListener('click', e => openMitraDetail(e.currentTarget.dataset.id)));
        if (isAdmin) {
            mitraGrid.querySelectorAll('.edit-mitra-btn').forEach(btn =>
                btn.addEventListener('click', e => editMitra(e.currentTarget.dataset.id)));
            mitraGrid.querySelectorAll('.delete-mitra-btn').forEach(btn =>
                btn.addEventListener('click', e => deleteMitra(e.currentTarget.dataset.id)));
        }
    }

    // ======================================
    // MODAL HANDLERS: MATERI (Admin)
    // ======================================
    if (addMaterialBtn) {
        addMaterialBtn.addEventListener('click', () => {
            editingMaterialId = null;
            materialForm?.reset();
            if (materialModalTitle) materialModalTitle.innerText = 'Tambah Materi & Pembahasan';
            materialModal?.classList.remove('hidden');
        });
    }
    if (materialCancelBtn) materialCancelBtn.addEventListener('click', () => materialModal.classList.add('hidden'));

    // ======================================
    // REALTIME FIRESTORE LISTENERS
    // ======================================
    onSnapshot(collection(db, "posters"), (snapshot) => {
        postersData = {};
        snapshot.forEach(d => { postersData[d.id] = { id: d.id, ...d.data() }; });
        renderPosters();
        renderCarousel();
    });

    onSnapshot(collection(db, "materials"), (snapshot) => {
        materialsData = {};
        snapshot.forEach(d => { materialsData[d.id] = { id: d.id, ...d.data() }; });
        renderMaterialsHidden();
        // Jika modal daftar materi sedang terbuka, refresh isinya
        if (materiListModal && !materiListModal.classList.contains('hidden') && activeKelas && activeMapel) {
            openMateriListModal(activeKelas, activeMapel);
        }
    });

    onSnapshot(collection(db, "portals"), (snapshot) => {
        portalsData = {};
        snapshot.forEach(d => { portalsData[d.id] = { id: d.id, ...d.data() }; });
        renderPortals();
    });

    // [BARU] POIN 6: listener realtime untuk koleksi "mitra"
    onSnapshot(collection(db, "mitra"), (snapshot) => {
        mitraData = {};
        snapshot.forEach(d => { mitraData[d.id] = { id: d.id, ...d.data() }; });
        renderMitra();
    });

    // ======================================
    // MODAL DETAIL EVENT/POSTER
    // ======================================
    window.openPosterDetail = function (id) {
        const poster = postersData[id];
        if (!poster || !posterDetailModal) return;
        document.getElementById('poster-detail-img').src = poster.imageUrl || '';
        document.getElementById('poster-detail-category').innerText = poster.category || 'Tanpa Kategori';
        document.getElementById('poster-detail-title').innerText = poster.title || '';
        document.getElementById('poster-detail-date').innerText = '📅 ' + (poster.date || '');
        document.getElementById('poster-detail-description').innerText = poster.description || '';
        const linkEl = document.getElementById('poster-detail-link');
        if (poster.registrationLink) { linkEl.href = poster.registrationLink; linkEl.classList.remove('hidden'); }
        else { linkEl.classList.add('hidden'); }
        posterDetailModal.classList.remove('hidden');
    };
    window.closePosterDetail = function () { posterDetailModal?.classList.add('hidden'); };

    // ======================================
    // RENDER POSTERS (Kartu Info & Event)
    // ======================================
    function renderPosters() {
        if (!posterGrid) return;
        posterGrid.innerHTML = '';
        const posters = Object.values(postersData);
        if (posters.length === 0) {
            posterGrid.innerHTML = '<p class="text-slate-400 col-span-full text-center py-10">Belum ada event/pengumuman. Admin dapat menambahkan yang baru.</p>';
            return;
        }
        posters.forEach(poster => {
            const card = document.createElement('div');
            const adminActions = isAdmin ? `
                <div class="absolute top-2 right-2 flex gap-2 z-10">
                    <button data-id="${poster.id}" class="edit-poster-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition">✏️</button>
                    <button data-id="${poster.id}" class="delete-poster-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition">🗑️</button>
                </div>` : '';
            card.className = 'bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100 flex flex-col hover:shadow-xl transition-all relative h-[22rem]';
            card.innerHTML = `
                <div class="relative w-full h-72 bg-slate-100 flex-shrink-0 overflow-hidden">
                    <img src="${poster.imageUrl}" alt="${poster.title}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/400x500/e2e8f0/94a3b8?text=Poster'">
                    ${adminActions}
                </div>
                <div class="p-3 flex items-center justify-between gap-2 flex-grow min-h-0">
                    <div class="min-w-0">
                        <h3 class="text-sm font-bold text-slate-800 truncate">${poster.title}</h3>
                        <p class="text-slate-400 text-[0.65rem] font-semibold">📅 ${poster.date}</p>
                    </div>
                    <button data-id="${poster.id}" class="view-detail-btn flex-shrink-0 text-[0.7rem] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition">+ Lihat Detail</button>
                </div>`;
            posterGrid.appendChild(card);
        });

        document.querySelectorAll('.view-detail-btn').forEach(btn =>
            btn.addEventListener('click', e => openPosterDetail(e.currentTarget.dataset.id)));
        if (isAdmin) {
            document.querySelectorAll('.edit-poster-btn').forEach(btn => btn.addEventListener('click', e => editPoster(e.currentTarget.dataset.id)));
            document.querySelectorAll('.delete-poster-btn').forEach(btn => btn.addEventListener('click', e => deletePoster(e.currentTarget.dataset.id)));
        }
    }

    // ======================================
    // RENDER MATERI (tersembunyi, sumber data untuk modal Materi & Pembahasan)
    // ======================================
    function renderMaterialsHidden() {
        renderKelasBoxes();
    }

    // ======================================
    // RENDER & CRUD PORTAL TERKAIT
    // ======================================
    // [BARU] POIN 5: ikon tematik sederhana berdasarkan kata kunci nama portal
    function pickPortalIcon(nama) {
        const n = (nama || '').toLowerCase();
        if (n.includes('game') || n.includes('main')) return '🎮';
        if (n.includes('skill') || n.includes('kursus') || n.includes('kelas')) return '🎓';
        if (n.includes('guru')) return '🧑‍🏫';
        if (n.includes('baca') || n.includes('buku') || n.includes('pustaka')) return '📚';
        if (n.includes('musik') || n.includes('lagu')) return '🎵';
        if (n.includes('coding') || n.includes('kode') || n.includes('program')) return '💻';
        return '🔗';
    }

    function renderPortals() {
        if (!portalGrid) return;
        portalGrid.innerHTML = '';
        const portals = Object.values(portalsData);
        if (portals.length === 0) {
            portalGrid.innerHTML = '<p class="text-slate-400 col-span-full text-center py-6">Belum ada portal terkait.</p>';
            return;
        }
        portals.forEach(portal => {
            const wrap = document.createElement('div');
            wrap.className = 'relative';
            const deleteBtn = isAdmin
                ? `<button data-id="${portal.id}" class="delete-portal-btn absolute -top-2 -right-2 z-10 bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition text-xs">🗑️</button>`
                : '';
            wrap.innerHTML = `
                ${deleteBtn}
                <a href="${portal.url}" target="_blank" rel="noopener noreferrer"
                    class="portal-card flex flex-col items-center justify-center text-center gap-2 bg-white border-2 border-teal-100 hover:border-teal-400 rounded-2xl shadow-sm p-5 h-full">
                    <span class="text-3xl">${pickPortalIcon(portal.nama)}</span>
                    <span class="font-bold text-slate-700 text-sm">${portal.nama}</span>
                </a>
            `;
            portalGrid.appendChild(wrap);
        });
        if (isAdmin) {
            document.querySelectorAll('.delete-portal-btn').forEach(btn =>
                btn.addEventListener('click', e => deletePortal(e.currentTarget.dataset.id)));
        }
    }

    window.deletePortal = async function (id) {
        if (!confirm('Hapus portal ini dari daftar?')) return;
        try { await deleteDoc(doc(db, "portals", id)); }
        catch (e) { alert('Gagal menghapus: ' + e.message); }
    };

    if (portalForm) {
        portalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (portalSubmitBtn) { portalSubmitBtn.disabled = true; portalSubmitBtn.innerText = 'Menyimpan...'; }
            try {
                const data = {
                    nama: document.getElementById('portal-nama').value,
                    url: document.getElementById('portal-url').value,
                };
                await addDoc(collection(db, "portals"), data);
                portalModal?.classList.add('hidden');
                portalForm.reset();
                editingPortalId = null;
            } catch (e) { alert('Error: ' + e.message); }
            finally {
                if (portalSubmitBtn) { portalSubmitBtn.disabled = false; portalSubmitBtn.innerText = 'Simpan'; }
            }
        });
    }

    // ======================================
    // CRUD: POSTERS / EVENT
    // ======================================
    window.editPoster = function (id) {
        const p = postersData[id];
        if (!p) return;
        editingPosterId = id;
        document.getElementById('poster-title').value = p.title || '';
        document.getElementById('poster-category').value = p.category || '';
        document.getElementById('poster-link').value = p.registrationLink || '';
        document.getElementById('poster-date').value = p.date || '';
        document.getElementById('poster-description').value = p.description || '';
        document.getElementById('poster-image-url').value = p.imageUrl || '';
        if (posterModalTitle) posterModalTitle.innerText = 'Edit Event / Pengumuman';
        posterModal?.classList.remove('hidden');
    };
    window.deletePoster = async function (id) {
        if (!confirm('Hapus event ini dari database?')) return;
        try { await deleteDoc(doc(db, "posters", id)); }
        catch (e) { alert('Gagal menghapus: ' + e.message); }
    };

    if (posterForm) {
        posterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (posterSubmitBtn) { posterSubmitBtn.disabled = true; posterSubmitBtn.innerText = 'Menyimpan...'; }
            try {
                const rawImageUrl = document.getElementById('poster-image-url').value;
                const data = {
                    title: document.getElementById('poster-title').value,
                    category: document.getElementById('poster-category').value,
                    registrationLink: document.getElementById('poster-link').value,
                    date: document.getElementById('poster-date').value,
                    description: document.getElementById('poster-description').value,
                    imageUrl: convertGoogleDriveLink(rawImageUrl),
                };
                if (editingPosterId) await updateDoc(doc(db, "posters", editingPosterId), data);
                else await addDoc(collection(db, "posters"), data);
                posterModal?.classList.add('hidden');
                posterForm.reset();
                editingPosterId = null;
            } catch (e) { alert('Error: ' + e.message); }
            finally {
                if (posterSubmitBtn) { posterSubmitBtn.disabled = false; posterSubmitBtn.innerText = 'Simpan'; }
            }
        });
    }

    // ======================================
    // CRUD: MATERIALS [DIUBAH] POIN 3: field baru (angka, judul, slideLink)
    // ======================================
    window.editMaterial = function (id) {
        const m = materialsData[id];
        if (!m) return;
        editingMaterialId = id;
        document.getElementById('mat-jenjang').value = m.jenjang || '';
        document.getElementById('mat-matpel').value = m.matpel || '';
        document.getElementById('mat-angka').value = m.angka || '1';
        document.getElementById('mat-judul').value = m.judul || '';
        document.getElementById('mat-slide-link').value = m.slideLink || '';
        if (materialModalTitle) materialModalTitle.innerText = 'Edit Materi & Pembahasan';
        materialModal?.classList.remove('hidden');
        // Tutup modal daftar materi sementara supaya form edit terlihat jelas
        materiListModal?.classList.add('hidden');
    };
    window.deleteMaterial = async function (id) {
        if (!confirm('Hapus materi ini dari database?')) return;
        try { await deleteDoc(doc(db, "materials", id)); }
        catch (e) { alert('Gagal menghapus: ' + e.message); }
    };

    if (materialForm) {
        materialForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (materialSubmitBtn) { materialSubmitBtn.disabled = true; materialSubmitBtn.innerText = 'Menyimpan...'; }
            try {
                const data = {
                    jenjang: document.getElementById('mat-jenjang').value,
                    matpel: document.getElementById('mat-matpel').value,
                    angka: document.getElementById('mat-angka').value,
                    judul: document.getElementById('mat-judul').value,
                    slideLink: document.getElementById('mat-slide-link').value,
                };
                if (editingMaterialId) await updateDoc(doc(db, "materials", editingMaterialId), data);
                else await addDoc(collection(db, "materials"), data);
                materialModal?.classList.add('hidden');
                materialForm.reset();
                editingMaterialId = null;
            } catch (e) { alert('Error: ' + e.message); }
            finally {
                if (materialSubmitBtn) { materialSubmitBtn.disabled = false; materialSubmitBtn.innerText = 'Simpan Materi'; }
            }
        });
    }

    // Render awal (sebelum data Firestore datang) agar UI tidak kosong total
    renderKelasBoxes();
    renderPortals();
    renderMitra();
});
