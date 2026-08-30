import { db, auth, googleProvider } from './firebase-config.js';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ======================================
// KONSTANTA
// ======================================
const ADMIN_EMAIL = 'dimndot@gmail.com';

// [BARU] POIN 3: Daftar 6 kelas & 5 mapel tetap, dipakai untuk render kotak kelas & modal mapel
const KELAS_LIST = ['Kelas 1 SD', 'Kelas 2 SD', 'Kelas 3 SD', 'Kelas 4 SD', 'Kelas 5 SD', 'Kelas 6 SD'];
const MAPEL_LIST = [
    { nama: 'Bahasa Indonesia', icon: '📖', otakHebatInfo: 'Menyusun Paragraf, Detektif Kata, & Teka-Teki Silang Teks' },
    { nama: 'Matematika', icon: '🔢', otakHebatInfo: 'Otak Hebat (Numerik, Logika, Memori, Spasial)' },
    { nama: 'IPAS', icon: '🌱', otakHebatInfo: 'Simulasi Rantai Makanan, Tebak Ekosistem, & Puzzle Organ Tubuh/Peta' },
    { nama: 'Bahasa Inggris', icon: '🔤', otakHebatInfo: 'Word Scramble, Listening/Flashcard Memory Game' },
    { nama: 'Pendidikan Pancasila', icon: '🇮🇩', otakHebatInfo: 'Studi Kasus Moral/Keputusan Sikap & Peta Budaya Nusantara' },
];

// ======================================
// STATE
// ======================================
let isAdmin = false;
let currentUser = null;
let editingPosterId = null;
let editingMaterialId = null;
let postersData = {};
let materialsData = {};
let portalsData = {}; // [BARU] POIN 4: data Portal Terkait
let editingPortalId = null;
let currentSlideIndex = 0;
let currentMaterial = null;
let currentLevelSection = null; // [BARU] 'materi' | 'latihan' | 'otakhebat' — bagian level yang sedang dibuka
let studentName = '';
let activeKelas = null;   // [BARU] kelas yang sedang dipilih di modal mapel
let activeMapel = null;   // [BARU] mapel yang sedang dibuka di modal level

// [BARU] POIN 4: state carousel poster
let carouselIndex = 0;
let carouselTimer = null;

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

// ======================================
// [BARU] POIN 5: KONVERTER LINK GOOGLE DRIVE -> DIRECT IMAGE STREAM
// ======================================
function convertGoogleDriveLink(url) {
    if (!url) return url;
    url = url.trim();
    try {
        // Format umum: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
        let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
        // Format alternatif: https://drive.google.com/open?id=FILE_ID
        match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
        // Sudah dalam format direct stream / bukan link Drive -> biarkan apa adanya
        return url;
    } catch (e) {
        return url;
    }
}
window.convertGoogleDriveLink = convertGoogleDriveLink;

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
    const posterImageUrlInput = document.getElementById('poster-image-url');

    // [BARU] POIN 4: Portal Terkait UI
    const addPortalBtn = document.getElementById('add-portal-btn');
    const portalModal = document.getElementById('admin-portal-modal');
    const portalForm = document.getElementById('portal-form');
    const portalCancelBtn = document.getElementById('portal-cancel-btn');
    const portalGrid = document.getElementById('portal-grid');
    const portalModalTitle = document.getElementById('portal-modal-title');
    const portalSubmitBtn = document.getElementById('portal-submit-btn');

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

    // [BARU] POIN 3: Kelas & Mapel & Level modal UI
    const kelasGrid = document.getElementById('kelas-grid');
    const mapelModal = document.getElementById('mapel-modal');
    const mapelModalTitle = document.getElementById('mapel-modal-title');
    const mapelList = document.getElementById('mapel-list');
    const levelModal = document.getElementById('level-modal');
    const levelModalTitle = document.getElementById('level-modal-title');
    const levelModalSub = document.getElementById('level-modal-sub');
    const levelList = document.getElementById('level-list');

    // [BARU] POIN 4: Carousel UI
    const carouselTrack = document.getElementById('poster-carousel-track');
    const carouselDots = document.getElementById('carousel-dots');

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
            if (addPortalBtn) addPortalBtn.classList.remove('hidden');
        } else {
            isAdmin = false;
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            if (adminBadge) adminBadge.classList.add('hidden');
            if (addPosterBtn) addPosterBtn.classList.add('hidden');
            if (addMaterialBtn) addMaterialBtn.classList.add('hidden');
            if (addPortalBtn) addPortalBtn.classList.add('hidden');
        }
        renderPosters();
        renderMaterials();
        renderPortals(); // [BARU] POIN 4
        renderCarousel(); // [BARU] POIN 4
    });

    // ======================================
    // AUTH HANDLERS — exposed globally for onclick attributes
    // ======================================
    window.handleAdminLogin = async () => {
        try {
            if (loginBtn) {
                loginBtn.innerText = 'Memuat...';
                loginBtn.disabled = true;
            }
            const result = await signInWithPopup(auth, googleProvider);
            if (result.user.email !== ADMIN_EMAIL) {
                await signOut(auth);
                alert('Akses ditolak. Akun ini tidak terdaftar sebagai admin KIBSA.');
            }
        } catch (error) {
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
        if (confirm('Apakah Anda yakin ingin keluar dari mode Admin?')) {
            await signOut(auth);
        }
    };

    // ======================================
    // LOGIN SISWA (MASUK & TAMPILAN PROFIL)
    // ======================================
    window.openStudentLogin = () => {
        if (studentNameModal) {
            studentNameModal.dataset.pendingId = '';
            studentNameModal.dataset.pendingSection = '';
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
            studentName = savedName;
            if (badge) { badge.classList.remove('hidden'); badge.classList.add('flex'); }
            if (btn) btn.classList.add('hidden');
            if (nameDisp) nameDisp.innerText = savedName;
            if (idDisp) idDisp.innerText = 'ID: ' + savedId;
        }
    };

    updateStudentUI();

    // ======================================
    // [BARU] POIN 3: PROGRES LEVEL BERANTAI (disimpan di localStorage per siswa)
    // ======================================
    function progressKey() {
        const sid = localStorage.getItem('kibsa_student_id') || 'guest';
        return `kibsa_progress_${sid}`;
    }

    function getAllProgress() {
        try { return JSON.parse(localStorage.getItem(progressKey()) || '{}'); }
        catch (e) { return {}; }
    }

    function getMapelKey(jenjang, matpel) {
        return `${jenjang}__${matpel}`;
    }

    // Ambil status level 1/2/3 untuk 1 mapel di 1 kelas
    function getMapelProgress(jenjang, matpel) {
        const all = getAllProgress();
        const key = getMapelKey(jenjang, matpel);
        return all[key] || { level1: false, level2: false, level3: false };
    }

    function markLevelComplete(jenjang, matpel, levelNum) {
        const all = getAllProgress();
        const key = getMapelKey(jenjang, matpel);
        if (!all[key]) all[key] = { level1: false, level2: false, level3: false };
        all[key][`level${levelNum}`] = true;
        localStorage.setItem(progressKey(), JSON.stringify(all));
    }

    // ======================================
    // [BARU] POIN 3: RENDER 6 KOTAK KELAS
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
            box.addEventListener('click', () => openKelasModal(kelas));
            kelasGrid.appendChild(box);
        });
    }

    // Buka modal pemilihan mapel untuk 1 kelas
    window.openKelasModal = (kelas) => {
        activeKelas = kelas;
        if (mapelModalTitle) mapelModalTitle.innerText = kelas;
        if (mapelList) {
            mapelList.innerHTML = '';
            MAPEL_LIST.forEach(m => {
                const item = document.createElement('button');
                item.className = 'flex items-center gap-3 p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 transition text-left';
                item.innerHTML = `
                    <span class="text-3xl">${m.icon}</span>
                    <span class="font-bold text-slate-700">${m.nama}</span>
                `;
                item.addEventListener('click', () => {
                    if (mapelModal) mapelModal.classList.add('hidden');
                    openLevelModal(kelas, m.nama);
                });
                mapelList.appendChild(item);
            });
        }
        if (mapelModal) mapelModal.classList.remove('hidden');
    };
    window.closeMapelModal = () => { if (mapelModal) mapelModal.classList.add('hidden'); };

    // Cari materi Firebase yang cocok dengan kelas + mapel (dipakai sbg sumber Level 1/2/3)
    function findMaterialFor(kelas, matpel) {
        return Object.values(materialsData).find(m => m.jenjang === kelas && m.matpel === matpel) || null;
    }

    // Buka modal Level Berantai (Materi -> Latihan -> Otak Hebat)
    window.openLevelModal = (kelas, matpel) => {
        activeKelas = kelas;
        activeMapel = matpel;
        const mapelInfo = MAPEL_LIST.find(m => m.nama === matpel);
        const material = findMaterialFor(kelas, matpel);
        const progress = getMapelProgress(kelas, matpel);

        if (levelModalTitle) levelModalTitle.innerText = `${matpel} — ${kelas}`;
        if (levelModalSub) levelModalSub.innerText = material ? (material.tujuan_belajar || '') : 'Materi untuk mapel ini belum tersedia.';

        const level2Unlocked = progress.level1;
        const level3Unlocked = progress.level2;

        const levels = [
            { num: 1, title: 'Materi', desc: 'Pelajari konsep dasar lewat penjelasan bertahap.', unlocked: true, section: 'materi' },
            { num: 2, title: 'Latihan Soal', desc: 'Uji pemahamanmu lewat soal bertingkat 🟢🟡🔴.', unlocked: level2Unlocked, section: 'latihan' },
            { num: 3, title: 'Otak Hebat', desc: mapelInfo ? mapelInfo.otakHebatInfo : 'Tantangan akhir.', unlocked: level3Unlocked, section: 'otakhebat' },
        ];

        if (levelList) {
            levelList.innerHTML = '';
            if (!material) {
                levelList.innerHTML = '<p class="text-slate-400 text-center py-6">Materi belum tersedia untuk mapel ini. Nantikan update dari admin ya!</p>';
            } else {
                levels.forEach(lv => {
                    const card = document.createElement('div');
                    card.className = `level-card ${lv.unlocked ? 'level-unlocked bg-white' : 'level-locked bg-slate-100'} border-2 ${lv.unlocked ? 'border-indigo-200' : 'border-slate-200'} rounded-xl p-4 flex items-center justify-between`;
                    card.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">${lv.unlocked ? '🟢' : '🔒'}</span>
                            <div>
                                <p class="font-bold text-slate-800">Level ${lv.num}: ${lv.title}</p>
                                <p class="text-xs text-slate-500">${lv.desc}</p>
                            </div>
                        </div>
                    `;
                    if (lv.unlocked) {
                        card.addEventListener('click', () => {
                            if (levelModal) levelModal.classList.add('hidden');
                            window.openSlide(material.id, lv.section);
                        });
                    }
                    levelList.appendChild(card);
                });
            }
        }
        if (levelModal) levelModal.classList.remove('hidden');
    };
    window.closeLevelModal = () => { if (levelModal) levelModal.classList.add('hidden'); };

    // ======================================
    // [BARU] POIN 4: CAROUSEL POSTER AUTO-PLAY
    // ======================================
    function renderCarousel() {
        if (!carouselTrack) return;
        const posters = Object.values(postersData);
        carouselTrack.innerHTML = '';
        if (carouselDots) carouselDots.innerHTML = '';
        if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }

        if (posters.length === 0) {
            carouselTrack.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 font-semibold">Belum ada poster untuk ditampilkan.</div>';
            return;
        }

        posters.forEach((p, i) => {
            // [DIUBAH] POIN 1: gambar ditampilkan penuh (object-fit: contain) di atas
            // latar blur dari gambar yang sama, supaya tidak ada crop tajam maupun
            // area kosong polos di sisi gambar yang rasio-nya beda dari container.
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.innerHTML = `
                <img src="${p.imageUrl}" alt="" aria-hidden="true" class="carousel-slide-bg" onerror="this.style.display='none'">
                <img src="${p.imageUrl}" alt="${p.title}" class="carousel-slide-img" onerror="this.src='https://placehold.co/800x400/e2e8f0/94a3b8?text=Poster'">
                <div class="absolute bottom-0 left-0 right-0 z-[2] bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p class="text-white font-bold text-sm md:text-lg">${p.title}</p>
                </div>
            `;
            carouselTrack.appendChild(slide);

            if (carouselDots) {
                const dot = document.createElement('div');
                dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
                dot.addEventListener('click', () => goToSlide(i));
                carouselDots.appendChild(dot);
            }
        });

        carouselIndex = 0;
        updateCarouselPosition();

        // Auto-play berkala setiap 4 detik
        if (posters.length > 1) {
            carouselTimer = setInterval(() => {
                carouselIndex = (carouselIndex + 1) % posters.length;
                updateCarouselPosition();
            }, 4000);
        }
    }

    function goToSlide(i) {
        carouselIndex = i;
        updateCarouselPosition();
    }

    function updateCarouselPosition() {
        if (!carouselTrack) return;
        carouselTrack.style.transform = `translateX(-${carouselIndex * 100}%)`;
        if (carouselDots) {
            Array.from(carouselDots.children).forEach((d, i) => {
                d.classList.toggle('active', i === carouselIndex);
            });
        }
    }

    // ======================================
    // MODAL HANDLERS
    // ======================================
    if (addPosterBtn) {
        addPosterBtn.addEventListener('click', () => {
            editingPosterId = null;
            if (posterForm) posterForm.reset();
            if (posterModalTitle) posterModalTitle.innerText = 'Tambah Event / Pengumuman';
            if (posterModal) posterModal.classList.remove('hidden');
        });
    }

    if (posterCancelBtn) {
        posterCancelBtn.addEventListener('click', () => posterModal.classList.add('hidden'));
    }

    // [BARU] POIN 5: Konversi otomatis link Google Drive saat admin keluar dari input URL gambar
    if (posterImageUrlInput) {
        posterImageUrlInput.addEventListener('blur', () => {
            posterImageUrlInput.value = convertGoogleDriveLink(posterImageUrlInput.value);
        });
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
            currentLevelSection = null;
        });
    }

    // ======================================
    // STUDENT NAME PROMPT
    // ======================================
    // [DIUBAH] POIN 3: openSlide sekarang menerima parameter section ('materi'|'latihan'|'otakhebat')
    window.openSlide = (id, section) => {
        const material = materialsData[id];
        if (!material) return;

        if (!studentName && studentNameModal) {
            studentNameModal.classList.remove('hidden');
            studentNameModal.dataset.pendingId = id;
            studentNameModal.dataset.pendingSection = section || '';
        } else {
            _launchSlide(id, section);
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
                let savedId = localStorage.getItem('kibsa_student_id');
                let savedName = localStorage.getItem('kibsa_student_name');

                if (!savedId || savedName !== name) {
                    const now = new Date();
                    const d = String(now.getDate()).padStart(2, '0');
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const y = String(now.getFullYear()).slice(-2);
                    const dateStr = `${d}${m}${y}`;

                    const studentsSnap = await getDocs(collection(db, "students"));
                    const urutan = String(studentsSnap.size + 1).padStart(2, '0');

                    savedId = `${urutan}${dateStr}`;

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
                const pendingSection = studentNameModal.dataset.pendingSection;
                if (pendingId) _launchSlide(pendingId, pendingSection);

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

    // [DIUBAH] POIN 3: _launchSlide menerima section awal & mengarahkan currentSlideIndex ke bagian tsb
    function _launchSlide(id, section) {
        currentMaterial = materialsData[id];
        currentLevelSection = section || null;
        currentSlideIndex = 0;

        // Hitung index awal berdasarkan section yang diminta (langsung loncat ke Level terkait)
        if (currentMaterial) {
            let kontenData = [];
            try { kontenData = JSON.parse(currentMaterial.konten_slide || '[]'); } catch (e) { }
            if (section === 'latihan') {
                currentSlideIndex = kontenData.length + 1; // langsung ke halaman latihan
            } else if (section === 'otakhebat') {
                let latihanData = [];
                try { latihanData = JSON.parse(currentMaterial.latihan_soal || '[]'); } catch (e) { }
                currentSlideIndex = kontenData.length + (latihanData.length > 0 ? 2 : 1);
            }
        }

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
            // Konten Slide (Level 1: Materi)
            const slide = kontenData[currentSlideIndex - 1];
            contentHtml = `
                <div class="py-8 px-6 max-w-4xl mx-auto w-full">
                    <h3 class="text-2xl font-bold text-slate-800 mb-4">${slide.judul || 'Materi'}</h3>
                    <p class="text-lg text-slate-700 mb-6 leading-relaxed">${slide.teks || ''}</p>
                    ${slide.contoh ? `<div class="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4"><strong class="text-blue-800">💡 Contoh Sehari-hari:</strong><br><span class="text-blue-900">${slide.contoh}</span></div>` : ''}
                    ${slide.petunjuk_visual ? `<div class="bg-amber-50 p-4 rounded-xl border border-amber-200"><strong class="text-amber-800">👀 Lihat ini:</strong><br><span class="text-amber-900">${slide.petunjuk_visual}</span></div>` : ''}
                </div>`;
            // [BARU] POIN 3: Level 1 selesai begitu mencapai slide konten terakhir -> buka kunci Level 2
            if (currentSlideIndex === kontenData.length && activeKelas && activeMapel) {
                markLevelComplete(activeKelas, activeMapel, 1);
            }
        } else if (currentSlideIndex === kontenData.length + 1 && latihanData.length > 0) {
            // Latihan Soal (Level 2)
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
            // [BARU] POIN 3: Level 2 selesai saat halaman latihan dibuka penuh -> buka kunci Level 3
            if (activeKelas && activeMapel) markLevelComplete(activeKelas, activeMapel, 2);
        } else {
            // Otak Hebat (Level 3)
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
            // [BARU] POIN 3: Level 3 selesai
            if (activeKelas && activeMapel) markLevelComplete(activeKelas, activeMapel, 3);
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
        renderCarousel(); // [BARU] POIN 4: sinkronkan carousel tiap data poster berubah
    });

    onSnapshot(collection(db, "materials"), (snapshot) => {
        materialsData = {};
        snapshot.forEach(d => { materialsData[d.id] = { id: d.id, ...d.data() }; });
        renderMaterials();
    });

    // [BARU] POIN 4: listener realtime untuk koleksi "portals"
    onSnapshot(collection(db, "portals"), (snapshot) => {
        portalsData = {};
        snapshot.forEach(d => { portalsData[d.id] = { id: d.id, ...d.data() }; });
        renderPortals();
    });

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
            card.className = 'bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100 flex flex-col hover:shadow-xl transition-all relative';

            const adminActions = isAdmin ? `
                <div class="absolute top-2 right-2 flex gap-2 z-10">
                    <button data-id="${poster.id}" class="edit-poster-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition">✏️</button>
                    <button data-id="${poster.id}" class="delete-poster-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition">🗑️</button>
                </div>` : '';

            const regBtn = poster.registrationLink
                ? `<a href="${poster.registrationLink}" target="_blank" class="mt-3 block w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm text-center rounded-full transition shadow-sm">Daftar Sekarang →</a>` : '';

            // [DIUBAH] POIN 2: tinggi area gambar diperbesar (h-48 -> h-64) + object-contain
            // dengan latar netral, agar poster Portrait (1024x1536) atau Landscape (1536x1024)
            // sama-sama tampil proporsional tanpa terpotong parah. Judul & tanggal diperkecil.
            card.innerHTML = `
                <div class="relative w-full h-64 bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img src="${poster.imageUrl}" alt="${poster.title}" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/400x200/e2e8f0/94a3b8?text=Poster'">
                    ${adminActions}
                </div>
                <div class="p-5 flex flex-col flex-grow">
                    <span class="text-[0.65rem] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full self-start mb-3">${poster.category}</span>
                    <h3 class="text-base font-bold text-slate-800 mb-2 leading-snug">${poster.title}</h3>
                    <p class="text-slate-600 text-sm flex-grow line-clamp-3">${poster.description}</p>
                    <p class="text-slate-400 text-[0.7rem] font-semibold mt-3">📅 ${poster.date}</p>
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
    // RENDER MATERIALS (grid tersembunyi, dipakai sistem Level di belakang layar)
    // ======================================
    function renderMaterials() {
        if (!materialGrid) return;
        materialGrid.innerHTML = '';
        const materials = Object.values(materialsData);

        materials.forEach(mat => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl shadow-md p-6 border border-slate-200 flex flex-col hover:shadow-xl transition-all relative';

            const adminActions = isAdmin ? `
                <div class="absolute -top-3 -right-3 flex gap-2 z-10">
                    <button data-id="${mat.id}" class="edit-mat-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition">✏️</button>
                    <button data-id="${mat.id}" class="delete-mat-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition">🗑️</button>
                </div>` : '';

            card.innerHTML = `
                ${adminActions}
                <span class="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">${mat.jenjang}</span>
                <span class="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-2 mb-1 block">${mat.matpel}</span>
                <h3 class="text-xl font-bold text-slate-800 mb-2 leading-tight">${mat.judul_topik}</h3>
            `;
            materialGrid.appendChild(card);
        });

        // [BARU] POIN 3: setiap kali data materi berubah, refresh kotak kelas
        renderKelasBoxes();

        if (isAdmin) {
            document.querySelectorAll('.edit-mat-btn').forEach(btn => btn.addEventListener('click', e => editMaterial(e.currentTarget.dataset.id)));
            document.querySelectorAll('.delete-mat-btn').forEach(btn => btn.addEventListener('click', e => deleteMaterial(e.currentTarget.dataset.id)));
        }
    }

    // ======================================
    // [BARU] POIN 4: RENDER & CRUD PORTAL TERKAIT
    // ======================================
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
                    <span class="text-3xl">🔗</span>
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

    if (addPortalBtn) {
        addPortalBtn.addEventListener('click', () => {
            editingPortalId = null;
            if (portalForm) portalForm.reset();
            if (portalModalTitle) portalModalTitle.innerText = 'Tambah Portal Terkait';
            if (portalModal) portalModal.classList.remove('hidden');
        });
    }

    if (portalCancelBtn) {
        portalCancelBtn.addEventListener('click', () => portalModal.classList.add('hidden'));
    }

    if (portalForm) {
        portalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (portalSubmitBtn) {
                portalSubmitBtn.disabled = true;
                portalSubmitBtn.innerText = 'Menyimpan...';
            }
            try {
                const data = {
                    nama: document.getElementById('portal-nama') ? document.getElementById('portal-nama').value : '',
                    url: document.getElementById('portal-url') ? document.getElementById('portal-url').value : '',
                };
                await addDoc(collection(db, "portals"), data);
                if (portalModal) portalModal.classList.add('hidden');
                portalForm.reset();
                editingPortalId = null;
            } catch (e) { alert('Error: ' + e.message); }
            finally {
                if (portalSubmitBtn) {
                    portalSubmitBtn.disabled = false;
                    portalSubmitBtn.innerText = 'Simpan';
                }
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
        if (document.getElementById('poster-title')) document.getElementById('poster-title').value = p.title || '';
        if (document.getElementById('poster-category')) document.getElementById('poster-category').value = p.category || '';
        if (document.getElementById('poster-link')) document.getElementById('poster-link').value = p.registrationLink || '';
        if (document.getElementById('poster-date')) document.getElementById('poster-date').value = p.date || '';
        if (document.getElementById('poster-description')) document.getElementById('poster-description').value = p.description || '';
        if (document.getElementById('poster-image-url')) document.getElementById('poster-image-url').value = p.imageUrl || '';
        if (posterModalTitle) posterModalTitle.innerText = 'Edit Event / Pengumuman';
        if (posterModal) posterModal.classList.remove('hidden');
    };

    window.deletePoster = async function (id) {
        if (!confirm('Hapus event ini dari database?')) return;
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
                // [BARU] POIN 5: pastikan link Drive dikonversi lagi sebelum disimpan (jaga-jaga kalau blur tidak sempat terpicu)
                const rawImageUrl = document.getElementById('poster-image-url') ? document.getElementById('poster-image-url').value : '';
                const data = {
                    title: document.getElementById('poster-title') ? document.getElementById('poster-title').value : '',
                    category: document.getElementById('poster-category') ? document.getElementById('poster-category').value : '',
                    registrationLink: document.getElementById('poster-link') ? document.getElementById('poster-link').value : '',
                    date: document.getElementById('poster-date') ? document.getElementById('poster-date').value : '',
                    description: document.getElementById('poster-description') ? document.getElementById('poster-description').value : '',
                    imageUrl: convertGoogleDriveLink(rawImageUrl),
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
                    posterSubmitBtn.innerText = 'Simpan';
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

    // [BARU] POIN 3: render kotak kelas begitu halaman siap (sebelum data Firebase datang pun kotak tetap tampil)
    renderKelasBoxes();
    renderPortals(); // [BARU] POIN 4: hindari grid kosong sebelum listener Firestore aktif
});