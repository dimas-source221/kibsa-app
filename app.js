import { db, auth, googleProvider } from './firebase-config.js';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ======================================
// KONSTANTA
// ======================================
const ADMIN_EMAIL = 'dimndot@gmail.com';

// ======================================
// STATE
// ======================================
let isAdmin = false;
let currentUser = null;
let editingPosterId = null;
let editingMaterialId = null;
let postersData = {};
let materialsData = {};
let currentSlideIndex = 0;
let currentMaterial = null;
let studentName = '';

// ======================================
// MODAL TENTANG KIBSA (Fungsi Global)
// ======================================
window.openTentangModal = () => {
    const modal = document.getElementById('tentangModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeTentangModal = () => {
    const modal = document.getElementById('tentangModal');
    if (modal) modal.classList.add('hidden');
};

document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // ELEMENT REFERENCES (Dengan toleransi ID)
    // ======================================
    // Auth UI
    const loginBtn = document.getElementById('loginBtn') || document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('logout-btn');
    const adminBadge = document.getElementById('admin-badge');

    // Poster UI
    const addPosterBtn = document.getElementById('add-poster-btn');
    const posterModal = document.getElementById('admin-poster-modal');
    const posterForm = document.getElementById('poster-form');
    const posterCancelBtn = document.getElementById('poster-cancel-btn');
    const posterGrid = document.getElementById('poster-grid');
    const posterModalTitle = document.getElementById('poster-modal-title');
    const posterSubmitBtn = document.getElementById('poster-submit-btn');

    // Material UI
    const addMaterialBtn = document.getElementById('add-material-btn');
    const materialModal = document.getElementById('admin-material-modal');
    const materialForm = document.getElementById('material-form');
    const materialCancelBtn = document.getElementById('mat-cancel-btn');
    const materialGrid = document.getElementById('material-grid');
    const materialModalTitle = document.getElementById('material-modal-title');
    const materialSubmitBtn = document.getElementById('mat-submit-btn');

    // Slide Viewer UI
    const slideViewerModal = document.getElementById('slide-viewer-modal');
    const closeSlideBtn = document.getElementById('close-slide-btn');
    const slideViewerTitle = document.getElementById('slide-viewer-title');
    const mascotContainer = document.getElementById('mascot-container');
    const mascotImg = document.getElementById('mascot-img');
    const mascotSpeech = document.getElementById('mascot-speech');
    const slideContent = document.getElementById('slide-content');
    const prevBtn = document.getElementById('prev-slide-btn');
    const nextBtn = document.getElementById('next-slide-btn');

    // Student Name Modal
    const studentNameModal = document.getElementById('student-name-modal');
    const studentNameForm = document.getElementById('student-name-form');
    const studentNameInput = document.getElementById('student-name-input');
    const studentNameCancelBtn = document.getElementById('student-name-cancel');

    // ======================================
    // AUTH STATE LISTENER
    // ======================================
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            // --- KUNCI KEAMANAN HANYA UNTUK DIMAS ---
            if (user.email !== 'dimndot@gmail.com') {
                await signOut(auth); // Langsung keluarkan akun yang bukan emailmu
                alert("Maaf, akses ini khusus untuk Admin KIBSA.");
                return; // Hentikan sistem admin
            }
            // ----------------------------------------

            isAdmin = true;
            // Show admin UI (dengan perlindungan anti-error)
            if (loginBtn) loginBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
            if (adminBadge) {
                adminBadge.classList.remove('hidden');
                adminBadge.innerHTML = `
                    <span class="flex items-center gap-2">
                        <img src="${user.photoURL || ''}" onerror="this.style.display='none'" class="w-7 h-7 rounded-full border-2 border-green-400 object-cover" id="admin-avatar"/>
                        <span class="text-sm font-bold text-green-700">${user.displayName || 'Admin'}</span>
                        <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">ADMIN</span>
                    </span>
                `;
            }
            if (addPosterBtn) addPosterBtn.classList.remove('hidden');
            if (addMaterialBtn) addMaterialBtn.classList.remove('hidden');
        } else {
            isAdmin = false;
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            if (adminBadge) adminBadge.classList.add('hidden');
            if (addPosterBtn) addPosterBtn.classList.add('hidden');
            if (addMaterialBtn) addMaterialBtn.classList.add('hidden');
        }
        renderPosters();
        renderMaterials();
    });

    // ======================================
    // AUTH HANDLERS — exposed globally for onclick attributes
    // ======================================
    window.handleAdminLogin = async () => {
        console.log('[KIBSA] handleAdminLogin() called');
        try {
            if (loginBtn) {
                loginBtn.innerText = 'Memuat...';
                loginBtn.disabled = true;
            }
            const result = await signInWithPopup(auth, googleProvider);
            console.log('[KIBSA] Signed in as:', result.user.email);
            if (result.user.email !== ADMIN_EMAIL) {
                await signOut(auth);
                alert('Akses ditolak. Akun ini tidak terdaftar sebagai admin KIBSA.');
            }
        } catch (error) {
            console.error('[KIBSA] Login error:', error.code, error.message);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert('Login gagal: ' + error.message);
            }
        } finally {
            if (loginBtn) {
                loginBtn.innerText = 'Login Admin';
                loginBtn.disabled = false;
            }
        }
    };

    window.handleAdminLogout = async () => {
        console.log('[KIBSA] handleAdminLogout() called');
        if (confirm('Apakah Anda yakin ingin keluar dari mode Admin?')) {
            await signOut(auth);
            console.log('[KIBSA] Signed out');
        }
    };
    // ======================================
    // LOGI SISWA (MASUK & TAMPILAN PROFIL)
    // ======================================
    window.openStudentLogin = () => {
        if (studentNameModal) {
            studentNameModal.dataset.pendingId = ''; // Buka tanpa materi spesifik
            studentNameModal.classList.remove('hidden');
        }
    };

    window.updateStudentUI = () => {
        const savedId = localStorage.getItem('kibsa_student_id');
        const savedName = localStorage.getItem('kibsa_student_name');
        const badge = document.getElementById('student-badge');
        const btn = document.getElementById('student-login-btn');
        const nameDisp = document.getElementById('student-name-display');
        const idDisp = document.getElementById('student-id-display');

        if (savedId && savedName) {
            studentName = savedName; // update global
            if (badge) { badge.classList.remove('hidden'); badge.classList.add('flex'); }
            if (btn) btn.classList.add('hidden');
            if (nameDisp) nameDisp.innerText = savedName;
            if (idDisp) idDisp.innerText = 'ID: ' + savedId;
        }
    };

    // Jalankan pengecekan saat pertama web dimuat
    updateStudentUI();

    // ======================================
    // MODAL HANDLERS
    // ======================================
    if (addPosterBtn) {
        addPosterBtn.addEventListener('click', () => {
            editingPosterId = null;
            if (posterForm) posterForm.reset();
            if (posterModalTitle) posterModalTitle.innerText = 'Tambah Poster Baru';
            if (posterModal) posterModal.classList.remove('hidden');
        });
    }

    if (posterCancelBtn) {
        posterCancelBtn.addEventListener('click', () => posterModal.classList.add('hidden'));
    }

    if (addMaterialBtn) {
        addMaterialBtn.addEventListener('click', () => {
            editingMaterialId = null;
            if (materialForm) materialForm.reset();
            if (materialModalTitle) materialModalTitle.innerText = 'Tambah Materi Slide';
            if (materialModal) materialModal.classList.remove('hidden');
        });
    }

    if (materialCancelBtn) {
        materialCancelBtn.addEventListener('click', () => materialModal.classList.add('hidden'));
    }

    if (closeSlideBtn) {
        closeSlideBtn.addEventListener('click', () => {
            if (slideViewerModal) slideViewerModal.classList.add('hidden');
            currentMaterial = null;
            currentSlideIndex = 0;
        });
    }

    // ======================================
    // STUDENT NAME PROMPT
    // ======================================
    window.openSlide = (id) => {
        const material = materialsData[id];
        if (!material) return;

        if (!studentName && studentNameModal) {
            // Show name prompt first
            studentNameModal.classList.remove('hidden');
            studentNameModal.dataset.pendingId = id;
        } else {
            _launchSlide(id);
        }
    };

    if (studentNameForm) {
        studentNameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = studentNameInput ? studentNameInput.value.trim() : '';
            if (!name) return;

            const submitBtn = studentNameForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Membuat ID...';
            submitBtn.disabled = true;

            try {
                // Cek apakah siswa sudah punya ID di perangkat ini
                let savedId = localStorage.getItem('kibsa_student_id');
                let savedName = localStorage.getItem('kibsa_student_name');

                // Jika nama berbeda atau belum punya ID, buat ID baru
                if (!savedId || savedName !== name) {
                    // 1. Dapatkan tanggal hari ini (DDMMYY)
                    const now = new Date();
                    const d = String(now.getDate()).padStart(2, '0');
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const y = String(now.getFullYear()).slice(-2);
                    const dateStr = `${d}${m}${y}`;

                    // 2. Hitung jumlah siswa di database untuk nomor urut
                    const studentsSnap = await getDocs(collection(db, "students"));
                    const urutan = String(studentsSnap.size + 1).padStart(2, '0'); // Pendaftar ke-1 jadi "01", ke-8 jadi "08"

                    // 3. Gabungkan jadi ID (contoh: 08300826)
                    savedId = `${urutan}${dateStr}`;

                    // 4. Simpan ke database Firebase dan memori laptop/HP siswa
                    await addDoc(collection(db, "students"), {
                        nama: name,
                        id_siswa: savedId,
                        tanggal_daftar: new Date().toISOString()
                    });

                    localStorage.setItem('kibsa_student_id', savedId);
                    localStorage.setItem('kibsa_student_name', name);

                    alert(`Selamat datang, ${name}!\nID Belajarmu adalah: ${savedId}\n(Harap diingat atau dicatat ya!)`);
                }

                studentName = name;
                studentNameModal.classList.add('hidden');

                updateStudentUI();

                const pendingId = studentNameModal.dataset.pendingId;
                if (pendingId) _launchSlide(pendingId);

            } catch (error) {
                console.error("Gagal membuat ID:", error);
                alert("Terjadi kesalahan sistem saat membuat ID.");
            } finally {
                submitBtn.innerText = 'Mulai Belajar';
                submitBtn.disabled = false;
            }
        });
    }

    if (studentNameCancelBtn) {
        studentNameCancelBtn.addEventListener('click', () => {
            studentNameModal.classList.add('hidden');
        });
    }

    function _launchSlide(id) {
        currentMaterial = materialsData[id];
        currentSlideIndex = 0;
        if (slideViewerTitle) slideViewerTitle.innerText = currentMaterial.judul_topik;
        if (slideViewerModal) slideViewerModal.classList.remove('hidden');
        renderSlide();
    }

    // ======================================
    // SLIDE VIEWER RENDERER
    // ======================================
    function renderSlide() {
        if (!currentMaterial) return;

        if (mascotContainer) mascotContainer.classList.remove('hidden');
        const mascotMap = { 'Kiko': '🐢', 'Bimo': '🐻', 'Lala': '🐰' };

        if (mascotImg) {
            mascotImg.innerHTML = `<span class="text-4xl">${mascotMap[currentMaterial.karakter_maskot] || '😊'}</span>`;
        }

        if (mascotSpeech) {
            mascotSpeech.innerHTML = `<span class="font-bold text-indigo-700">Halo${studentName ? ', ' + studentName : ''}! Aku ${currentMaterial.karakter_maskot}!</span><br>Ayo belajar <em>${currentMaterial.matpel}</em> bareng!`;
        }

        let kontenData = [];
        let latihanData = [];
        try { kontenData = JSON.parse(currentMaterial.konten_slide || '[]'); } catch (e) { }
        try { latihanData = JSON.parse(currentMaterial.latihan_soal || '[]'); } catch (e) { }

        const totalPages = 1 + kontenData.length + (latihanData.length > 0 ? 1 : 0) + (currentMaterial.otak_hebat ? 1 : 0);

        if (prevBtn) prevBtn.disabled = currentSlideIndex === 0;
        if (nextBtn) nextBtn.disabled = currentSlideIndex === totalPages - 1;

        const slidePageInfo = document.getElementById('slide-page-info');
        if (slidePageInfo) slidePageInfo.innerText = `${currentSlideIndex + 1} / ${totalPages}`;

        let contentHtml = '';

        if (currentSlideIndex === 0) {
            // Tujuan Belajar
            contentHtml = `
                <div class="text-center py-10 px-6">
                    <div class="text-5xl mb-4">🎯</div>
                    <h2 class="text-2xl md:text-3xl font-extrabold text-slate-800 mb-6">Tujuan Belajar Hari Ini</h2>
                    <div class="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-2xl inline-block text-left max-w-2xl mx-auto shadow-sm">
                        <p class="text-lg text-slate-700 font-medium leading-relaxed">${(currentMaterial.tujuan_belajar || '').replace(/\n/g, '<br>')}</p>
                    </div>
                    <p class="mt-6 text-slate-400 text-sm">Tekan <strong>Selanjutnya</strong> untuk mulai! 🚀</p>
                </div>`;
        } else if (currentSlideIndex <= kontenData.length) {
            // Konten Slide
            const slide = kontenData[currentSlideIndex - 1];
            contentHtml = `
                <div class="py-8 px-6 max-w-4xl mx-auto w-full">
                    <h3 class="text-2xl font-bold text-slate-800 mb-4">${slide.judul || 'Materi'}</h3>
                    <p class="text-lg text-slate-700 mb-6 leading-relaxed">${slide.teks || ''}</p>
                    ${slide.contoh ? `<div class="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4"><strong class="text-blue-800">💡 Contoh Sehari-hari:</strong><br><span class="text-blue-900">${slide.contoh}</span></div>` : ''}
                    ${slide.petunjuk_visual ? `<div class="bg-amber-50 p-4 rounded-xl border border-amber-200"><strong class="text-amber-800">👀 Lihat ini:</strong><br><span class="text-amber-900">${slide.petunjuk_visual}</span></div>` : ''}
                </div>`;
        } else if (currentSlideIndex === kontenData.length + 1 && latihanData.length > 0) {
            // Latihan Soal
            let soalHtml = '';
            latihanData.forEach((soal, i) => {
                const badgeMap = { 'Mudah': '🟢 Mudah', 'Sedang': '🟡 Sedang', 'Tantangan': '🔴 Tantangan' };
                const badge = badgeMap[soal.tingkat] || soal.tingkat;
                soalHtml += `
                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-4">
                        <div class="flex justify-between items-center mb-3">
                            <span class="font-bold text-slate-800">Soal ${i + 1}</span>
                            <span class="text-xs font-bold px-3 py-1 bg-slate-100 rounded-full">${badge}</span>
                        </div>
                        <p class="text-slate-700 mb-4 text-base">${soal.pertanyaan}</p>
                        <button onclick="this.nextElementSibling.classList.toggle('hidden')" class="text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-full font-semibold transition">
                            Lihat Jawaban 👁️
                        </button>
                        <div class="hidden mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                            <strong class="text-green-800">Jawaban:</strong> ${soal.kunci}<br>
                            <strong class="text-green-800">Feedback:</strong> ${soal.feedback}
                        </div>
                    </div>`;
            });
            contentHtml = `
                <div class="py-6 px-4 max-w-3xl mx-auto w-full">
                    <h2 class="text-2xl font-extrabold text-slate-800 mb-6 text-center">✏️ Latihan Soal Bertingkat</h2>
                    ${soalHtml}
                </div>`;
            if (mascotSpeech) mascotSpeech.innerHTML = `<span class="font-bold text-indigo-700">Ayo ${studentName || 'Kamu'}!</span> Jangan takut salah, yang penting semangat! 💪`;
        } else {
            // Otak Hebat
            contentHtml = `
                <div class="text-center py-10 px-4 max-w-3xl mx-auto w-full">
                    <div class="text-6xl mb-4">🧠</div>
                    <h2 class="text-3xl font-extrabold text-slate-800 mb-6">OTAK HEBAT!</h2>
                    <div class="bg-gradient-to-br from-orange-400 to-amber-500 p-8 rounded-2xl text-white shadow-lg text-left">
                        <h3 class="text-xl font-bold mb-4">🎯 Tantangan Logika</h3>
                        <p class="text-lg leading-relaxed">${currentMaterial.otak_hebat || ''}</p>
                    </div>
                </div>`;
            if (mascotSpeech) mascotSpeech.innerHTML = `<span class="font-bold text-orange-600">Wah, ${studentName || 'kamu'} sampai OTAK HEBAT!</span> Keren sekali! 🎉`;
        }

        if (slideContent) slideContent.innerHTML = contentHtml;
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentSlideIndex > 0) { currentSlideIndex--; renderSlide(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentSlideIndex++; renderSlide(); });

    // ======================================
    // REALTIME FIRESTORE LISTENERS
    // ======================================
    onSnapshot(collection(db, "posters"), (snapshot) => {
        postersData = {};
        snapshot.forEach(d => { postersData[d.id] = { id: d.id, ...d.data() }; });
        renderPosters();
    });

    onSnapshot(collection(db, "materials"), (snapshot) => {
        materialsData = {};
        snapshot.forEach(d => { materialsData[d.id] = { id: d.id, ...d.data() }; });
        renderMaterials();
    });

    // ======================================
    // RENDER POSTERS
    // ======================================
    function renderPosters() {
        if (!posterGrid) return;
        posterGrid.innerHTML = '';
        const posters = Object.values(postersData);
        if (posters.length === 0) {
            posterGrid.innerHTML = '<p class="text-slate-400 col-span-full text-center py-10">Belum ada poster. Admin dapat menambahkan poster baru.</p>';
            return;
        }

        posters.forEach(poster => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100 flex flex-col hover:shadow-xl transition-all relative';

            const adminActions = isAdmin ? `
                <div class="absolute top-2 right-2 flex gap-2 z-10">
                    <button data-id="${poster.id}" class="edit-poster-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition">✏️</button>
                    <button data-id="${poster.id}" class="delete-poster-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition">🗑️</button>
                </div>` : '';

            const regBtn = poster.registrationLink
                ? `<a href="${poster.registrationLink}" target="_blank" class="mt-3 block w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm text-center rounded-full transition shadow-sm">Daftar Sekarang →</a>` : '';

            card.innerHTML = `
                <div class="relative w-full h-48 bg-slate-200">
                    <img src="${poster.imageUrl}" alt="${poster.title}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/400x200/e2e8f0/94a3b8?text=Poster'">
                    ${adminActions}
                </div>
                <div class="p-5 flex flex-col flex-grow">
                    <span class="text-[0.65rem] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full self-start mb-3">${poster.category}</span>
                    <h3 class="text-lg font-bold text-slate-800 mb-2">${poster.title}</h3>
                    <p class="text-slate-600 text-sm flex-grow line-clamp-3">${poster.description}</p>
                    <p class="text-slate-400 text-xs font-semibold mt-3">📅 ${poster.date}</p>
                    ${regBtn}
                </div>`;
            posterGrid.appendChild(card);
        });

        if (isAdmin) {
            document.querySelectorAll('.edit-poster-btn').forEach(btn => btn.addEventListener('click', e => editPoster(e.currentTarget.dataset.id)));
            document.querySelectorAll('.delete-poster-btn').forEach(btn => btn.addEventListener('click', e => deletePoster(e.currentTarget.dataset.id)));
        }
    }

    // ======================================
    // RENDER MATERIALS
    // ======================================
    function renderMaterials() {
        if (!materialGrid) return;
        materialGrid.innerHTML = '';
        const materials = Object.values(materialsData);
        if (materials.length === 0) {
            materialGrid.innerHTML = '<p class="text-slate-400 col-span-full text-center py-10">Belum ada materi. Admin dapat menambahkan modul baru.</p>';
            return;
        }

        materials.forEach(mat => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl shadow-md p-6 border border-slate-200 flex flex-col hover:shadow-xl transition-all relative';

            const adminActions = isAdmin ? `
                <div class="absolute -top-3 -right-3 flex gap-2 z-10">
                    <button data-id="${mat.id}" class="edit-mat-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition">✏️</button>
                    <button data-id="${mat.id}" class="delete-mat-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition">🗑️</button>
                </div>` : '';

            let kontenCount = 0;
            try { kontenCount = JSON.parse(mat.konten_slide || '[]').length; } catch (e) { }
            const mascotEmoji = mat.karakter_maskot === 'Kiko' ? '🐢' : mat.karakter_maskot === 'Bimo' ? '🐻' : '🐰';

            card.innerHTML = `
                ${adminActions}
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">${mat.jenjang}</span>
                    <span class="text-2xl" title="${mat.karakter_maskot}">${mascotEmoji}</span>
                </div>
                <span class="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1 block">${mat.matpel}</span>
                <h3 class="text-xl font-bold text-slate-800 mb-2 leading-tight">${mat.judul_topik}</h3>
                <div class="bg-slate-50 p-3 rounded-lg mb-4 text-xs text-slate-600 border border-slate-100 flex-grow">
                    <strong class="text-slate-700 block mb-1">Cakupan Materi:</strong>
                    <ul class="list-disc pl-4 space-y-0.5">
                        <li>${kontenCount} Slide Cerita & Penjelasan</li>
                        <li>Latihan Bertingkat 🟢 🟡 🔴</li>
                        ${mat.otak_hebat ? '<li>Mini-Game Otak Hebat 🧠</li>' : ''}
                    </ul>
                </div>
                <div class="flex flex-col gap-2 mt-auto pt-2">
                    <button onclick="openSlide('${mat.id}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-full shadow transition text-sm">▶ Mulai Belajar Interaktif</button>
                    <a href="${mat.download_pptx_url || '#'}" target="_blank" class="w-full bg-white border-2 border-indigo-100 hover:bg-indigo-50 text-indigo-700 font-bold py-2 px-4 rounded-full transition text-sm text-center">📥 Unduh Panduan Guru (.pptx)</a>
                </div>`;
            materialGrid.appendChild(card);
        });

        if (isAdmin) {
            document.querySelectorAll('.edit-mat-btn').forEach(btn => btn.addEventListener('click', e => editMaterial(e.currentTarget.dataset.id)));
            document.querySelectorAll('.delete-mat-btn').forEach(btn => btn.addEventListener('click', e => deleteMaterial(e.currentTarget.dataset.id)));
        }
    }

    // ======================================
    // CRUD: POSTERS
    // ======================================
    window.editPoster = function (id) {
        const p = postersData[id];
        if (!p) return;
        editingPosterId = id;
        if (document.getElementById('poster-title')) document.getElementById('poster-title').value = p.title || '';
        if (document.getElementById('poster-category')) document.getElementById('poster-category').value = p.category || '';
        if (document.getElementById('poster-link')) document.getElementById('poster-link').value = p.registrationLink || '';
        if (document.getElementById('poster-date')) document.getElementById('poster-date').value = p.date || '';
        if (document.getElementById('poster-description')) document.getElementById('poster-description').value = p.description || '';
        if (document.getElementById('poster-image-url')) document.getElementById('poster-image-url').value = p.imageUrl || '';
        if (posterModalTitle) posterModalTitle.innerText = 'Edit Poster';
        if (posterModal) posterModal.classList.remove('hidden');
    };

    window.deletePoster = async function (id) {
        if (!confirm('Hapus poster ini dari database?')) return;
        try { await deleteDoc(doc(db, "posters", id)); }
        catch (e) { alert('Gagal menghapus: ' + e.message); }
    };

    if (posterForm) {
        posterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (posterSubmitBtn) {
                posterSubmitBtn.disabled = true;
                posterSubmitBtn.innerText = 'Menyimpan...';
            }
            try {
                const data = {
                    title: document.getElementById('poster-title') ? document.getElementById('poster-title').value : '',
                    category: document.getElementById('poster-category') ? document.getElementById('poster-category').value : '',
                    registrationLink: document.getElementById('poster-link') ? document.getElementById('poster-link').value : '',
                    date: document.getElementById('poster-date') ? document.getElementById('poster-date').value : '',
                    description: document.getElementById('poster-description') ? document.getElementById('poster-description').value : '',
                    imageUrl: document.getElementById('poster-image-url') ? document.getElementById('poster-image-url').value : '',
                };
                if (editingPosterId) {
                    await updateDoc(doc(db, "posters", editingPosterId), data);
                } else {
                    await addDoc(collection(db, "posters"), data);
                }
                if (posterModal) posterModal.classList.add('hidden');
                posterForm.reset();
                editingPosterId = null;
            } catch (e) { alert('Error: ' + e.message); }
            finally {
                if (posterSubmitBtn) {
                    posterSubmitBtn.disabled = false;
                    posterSubmitBtn.innerText = 'Simpan Poster';
                }
            }
        });
    }

    // ======================================
    // CRUD: MATERIALS
    // ======================================
    window.editMaterial = function (id) {
        const m = materialsData[id];
        if (!m) return;
        editingMaterialId = id;
        if (document.getElementById('mat-jenjang')) document.getElementById('mat-jenjang').value = m.jenjang || '';
        if (document.getElementById('mat-matpel')) document.getElementById('mat-matpel').value = m.matpel || '';
        if (document.getElementById('mat-judul')) document.getElementById('mat-judul').value = m.judul_topik || '';
        if (document.getElementById('mat-tujuan')) document.getElementById('mat-tujuan').value = m.tujuan_belajar || '';
        if (document.getElementById('mat-karakter')) document.getElementById('mat-karakter').value = m.karakter_maskot || '';
        if (document.getElementById('mat-konten')) document.getElementById('mat-konten').value = m.konten_slide || '[]';
        if (document.getElementById('mat-latihan')) document.getElementById('mat-latihan').value = m.latihan_soal || '[]';
        if (document.getElementById('mat-otakhebat')) document.getElementById('mat-otakhebat').value = m.otak_hebat || '';
        if (document.getElementById('mat-download')) document.getElementById('mat-download').value = m.download_pptx_url || '';
        if (materialModalTitle) materialModalTitle.innerText = 'Edit Materi';
        if (materialModal) materialModal.classList.remove('hidden');
    };

    window.deleteMaterial = async function (id) {
        if (!confirm('Hapus materi ini dari database?')) return;
        try { await deleteDoc(doc(db, "materials", id)); }
        catch (e) { alert('Gagal menghapus: ' + e.message); }
    };

    if (materialForm) {
        materialForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (materialSubmitBtn) {
                materialSubmitBtn.disabled = true;
                materialSubmitBtn.innerText = 'Menyimpan...';
            }
            try {
                const kontenVal = document.getElementById('mat-konten') ? document.getElementById('mat-konten').value : '';
                const latihanVal = document.getElementById('mat-latihan') ? document.getElementById('mat-latihan').value : '';
                try { JSON.parse(kontenVal || '[]'); } catch (e) { throw new Error('Format JSON Konten Slide tidak valid.'); }
                try { JSON.parse(latihanVal || '[]'); } catch (e) { throw new Error('Format JSON Latihan Soal tidak valid.'); }

                const data = {
                    jenjang: document.getElementById('mat-jenjang') ? document.getElementById('mat-jenjang').value : '',
                    matpel: document.getElementById('mat-matpel') ? document.getElementById('mat-matpel').value : '',
                    judul_topik: document.getElementById('mat-judul') ? document.getElementById('mat-judul').value : '',
                    tujuan_belajar: document.getElementById('mat-tujuan') ? document.getElementById('mat-tujuan').value : '',
                    karakter_maskot: document.getElementById('mat-karakter') ? document.getElementById('mat-karakter').value : '',
                    konten_slide: kontenVal || '[]',
                    latihan_soal: latihanVal || '[]',
                    otak_hebat: document.getElementById('mat-otakhebat') ? document.getElementById('mat-otakhebat').value : '',
                    download_pptx_url: document.getElementById('mat-download') ? document.getElementById('mat-download').value : ''
                };

                if (editingMaterialId) {
                    await updateDoc(doc(db, "materials", editingMaterialId), data);
                } else {
                    await addDoc(collection(db, "materials"), data);
                }
                if (materialModal) materialModal.classList.add('hidden');
                materialForm.reset();
                editingMaterialId = null;
            } catch (e) { alert('Error: ' + e.message); }
            finally {
                if (materialSubmitBtn) {
                    materialSubmitBtn.disabled = false;
                    materialSubmitBtn.innerText = 'Simpan Materi';
                }
            }
        });
    }
});