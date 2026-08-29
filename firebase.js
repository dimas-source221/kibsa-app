import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// 1. Inisialisasi Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Variabel state
let isAdmin = false;
let editingPosterId = null;
let editingMaterialId = null;
let postersData = {};
let materialsData = {};
let currentSlideIndex = 0;
let currentMaterial = null;

document.addEventListener("DOMContentLoaded", () => {
    const adminBtn = document.getElementById('admin-btn');
    
    // UI Posters
    const addPosterBtn = document.getElementById('add-poster-btn');
    const posterModal = document.getElementById('admin-poster-modal');
    const posterForm = document.getElementById('poster-form');
    const posterCancelBtn = document.getElementById('poster-cancel-btn');
    const posterGrid = document.getElementById('poster-grid');
    const posterModalTitle = document.getElementById('poster-modal-title');
    const posterSubmitBtn = document.getElementById('poster-submit-btn');

    // UI Materials
    const addMaterialBtn = document.getElementById('add-material-btn');
    const materialModal = document.getElementById('admin-material-modal');
    const materialForm = document.getElementById('material-form');
    const materialCancelBtn = document.getElementById('mat-cancel-btn');
    const materialGrid = document.getElementById('material-grid');
    const materialModalTitle = document.getElementById('material-modal-title');
    const materialSubmitBtn = document.getElementById('mat-submit-btn');

    // UI Slide Viewer
    const slideViewerModal = document.getElementById('slide-viewer-modal');
    const closeSlideBtn = document.getElementById('close-slide-btn');
    const slideViewerTitle = document.getElementById('slide-viewer-title');
    const mascotContainer = document.getElementById('mascot-container');
    const mascotImg = document.getElementById('mascot-img');
    const mascotSpeech = document.getElementById('mascot-speech');
    const slideContent = document.getElementById('slide-content');
    const slideNav = document.getElementById('slide-nav');
    const prevBtn = document.getElementById('prev-slide-btn');
    const nextBtn = document.getElementById('next-slide-btn');

    // --- TOGGLE ADMIN MODE ---
    adminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isAdmin = !isAdmin;
        adminBtn.classList.toggle('bg-slate-700');
        adminBtn.classList.toggle('bg-green-600');
        adminBtn.innerText = isAdmin ? 'Keluar Admin' : 'Admin';
        
        if (isAdmin) {
            addPosterBtn.classList.remove('hidden');
            addMaterialBtn.classList.remove('hidden');
        } else {
            addPosterBtn.classList.add('hidden');
            addMaterialBtn.classList.add('hidden');
        }
        renderPosters(); 
        renderMaterials();
    });

    // --- MODAL HANDLERS ---
    addPosterBtn.addEventListener('click', () => {
        editingPosterId = null;
        posterForm.reset();
        posterModalTitle.innerText = 'Tambah Poster Baru';
        document.getElementById('poster-image-help').innerText = 'Wajib upload gambar baru.';
        posterModal.classList.remove('hidden');
    });

    posterCancelBtn.addEventListener('click', () => {
        posterModal.classList.add('hidden');
    });

    addMaterialBtn.addEventListener('click', () => {
        editingMaterialId = null;
        materialForm.reset();
        materialModalTitle.innerText = 'Tambah Materi Slide';
        materialModal.classList.remove('hidden');
    });

    materialCancelBtn.addEventListener('click', () => {
        materialModal.classList.add('hidden');
    });

    closeSlideBtn.addEventListener('click', () => {
        slideViewerModal.classList.add('hidden');
        currentMaterial = null;
        currentSlideIndex = 0;
    });

    // --- SLIDE VIEWER GLOBAL FUNCTION ---
    window.openSlide = (id) => {
        const material = materialsData[id];
        if (!material) return;
        currentMaterial = material;
        currentSlideIndex = 0;
        
        slideViewerTitle.innerText = material.judul_topik;
        slideViewerModal.classList.remove('hidden');
        renderSlide();
    };

    function renderSlide() {
        if (!currentMaterial) return;

        // Reset mascot
        mascotContainer.classList.remove('hidden');
        
        // Define mascot images based on character
        const mascotMap = {
            'Kiko': '🐢', // placeholder emoji for turtle/kiko
            'Bimo': '🐻', // placeholder emoji for bear/bimo
            'Lala': '🐰'  // placeholder emoji for bunny/lala
        };
        
        mascotImg.innerHTML = `<span class="text-4xl">${mascotMap[currentMaterial.karakter_maskot] || '😊'}</span>`;
        mascotSpeech.innerHTML = `<span class="font-bold text-indigo-700">Halo, aku ${currentMaterial.karakter_maskot}!</span> Ayo belajar ${currentMaterial.matpel} bareng!`;

        let totalPages = 1; // Tujuan Belajar
        let kontenData = [];
        try {
            kontenData = JSON.parse(currentMaterial.konten_slide || '[]');
        } catch (e) {
            kontenData = [];
        }
        
        let latihanData = [];
        try {
            latihanData = JSON.parse(currentMaterial.latihan_soal || '[]');
        } catch(e) {
            latihanData = [];
        }

        totalPages += kontenData.length;
        if (latihanData.length > 0) totalPages += 1; // Latihan page
        if (currentMaterial.otak_hebat) totalPages += 1; // Otak hebat page

        // Navigation state
        prevBtn.disabled = currentSlideIndex === 0;
        nextBtn.disabled = currentSlideIndex === totalPages - 1;

        // Content Rendering
        let contentHtml = '';
        let currentIndex = currentSlideIndex;

        if (currentIndex === 0) {
            // Intro / Tujuan
            contentHtml = `
                <div class="text-center py-10 px-4">
                    <h2 class="text-3xl font-extrabold text-slate-800 mb-6">Tujuan Belajar Kita Hari Ini</h2>
                    <div class="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-xl inline-block text-left max-w-2xl mx-auto shadow-sm">
                        <p class="text-lg text-slate-700 font-medium leading-relaxed">${currentMaterial.tujuan_belajar.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        } else if (currentIndex <= kontenData.length) {
            // Konten Slides
            const slide = kontenData[currentIndex - 1];
            contentHtml = `
                <div class="py-8 px-6 max-w-4xl mx-auto">
                    <h3 class="text-2xl font-bold text-slate-800 mb-4">${slide.judul || 'Materi'}</h3>
                    <p class="text-lg text-slate-700 mb-6 leading-relaxed">${slide.teks || ''}</p>
                    ${slide.contoh ? `<div class="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4"><strong class="text-blue-800">💡 Contoh:</strong><br><span class="text-blue-900">${slide.contoh}</span></div>` : ''}
                    ${slide.petunjuk_visual ? `<div class="bg-amber-50 p-4 rounded-lg border border-amber-200"><strong class="text-amber-800">👀 Lihat ini:</strong><br><span class="text-amber-900">${slide.petunjuk_visual}</span></div>` : ''}
                </div>
            `;
        } else if (currentIndex === kontenData.length + 1 && latihanData.length > 0) {
            // Latihan Soal
            let soalHtml = '';
            latihanData.forEach((soal, i) => {
                let badge = '';
                if (soal.tingkat === 'Mudah') badge = '🟢 Mudah';
                else if (soal.tingkat === 'Sedang') badge = '🟡 Sedang';
                else if (soal.tingkat === 'Tantangan') badge = '🔴 Tantangan';
                
                soalHtml += `
                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-bold text-slate-800">Soal ${i + 1}</span>
                            <span class="text-xs font-bold px-2 py-1 bg-slate-100 rounded-full">${badge}</span>
                        </div>
                        <p class="text-slate-700 mb-4">${soal.pertanyaan}</p>
                        <button onclick="alert('Jawaban: ${soal.kunci}\\n\\nFeedback: ${soal.feedback}')" class="text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded font-semibold transition">Lihat Jawaban</button>
                    </div>
                `;
            });
            contentHtml = `
                <div class="py-6 px-4 max-w-3xl mx-auto">
                    <h2 class="text-2xl font-extrabold text-slate-800 mb-6 text-center">Latihan Soal Bertingkat</h2>
                    ${soalHtml}
                </div>
            `;
            mascotSpeech.innerHTML = `<span class="font-bold text-indigo-700">Ayo uji kemampuanmu!</span> Jangan takut salah, kita belajar bersama.`;
        } else {
            // Otak Hebat
            contentHtml = `
                <div class="text-center py-10 px-4 max-w-3xl mx-auto">
                    <h2 class="text-3xl font-extrabold text-slate-800 mb-4">🧠 OTAK HEBAT</h2>
                    <div class="bg-gradient-to-r from-orange-400 to-amber-500 p-8 rounded-2xl text-white shadow-lg">
                        <h3 class="text-xl font-bold mb-4">Tantangan Logika / Mini-Game</h3>
                        <p class="text-lg leading-relaxed">${currentMaterial.otak_hebat}</p>
                    </div>
                </div>
            `;
            mascotSpeech.innerHTML = `<span class="font-bold text-indigo-700">Wah, waktunya main OTAK HEBAT!</span> Tunjukkan kehebatanmu!`;
        }

        slideContent.innerHTML = contentHtml;
    }

    prevBtn.addEventListener('click', () => {
        if (currentSlideIndex > 0) {
            currentSlideIndex--;
            renderSlide();
        }
    });

    nextBtn.addEventListener('click', () => {
        currentSlideIndex++;
        renderSlide();
    });

    // --- FETCH DATA (Real-time) ---
    onSnapshot(collection(db, "posters"), (snapshot) => {
        postersData = {};
        snapshot.forEach(doc => {
            postersData[doc.id] = { id: doc.id, ...doc.data() };
        });
        renderPosters();
    });

    onSnapshot(collection(db, "materials"), (snapshot) => {
        materialsData = {};
        snapshot.forEach(doc => {
            materialsData[doc.id] = { id: doc.id, ...doc.data() };
        });
        renderMaterials();
    });

    // --- RENDER POSTERS ---
    function renderPosters() {
        if (!posterGrid) return;
        posterGrid.innerHTML = '';
        const posters = Object.values(postersData);
        
        if (posters.length === 0) {
            posterGrid.innerHTML = '<p class="text-slate-500 col-span-full">Belum ada poster. Aktifkan mode Admin untuk menambahkan.</p>';
            return;
        }

        posters.forEach(poster => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100 flex flex-col hover:shadow-xl transition-all relative';
            
            let adminActions = '';
            if (isAdmin) {
                adminActions = `
                    <div class="absolute top-2 right-2 flex gap-2 z-10">
                        <button data-id="${poster.id}" class="edit-poster-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition" title="Edit">✏️</button>
                        <button data-id="${poster.id}" class="delete-poster-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition" title="Hapus">🗑️</button>
                    </div>
                `;
            }

            const regBtn = poster.registrationLink 
                ? `<a href="${poster.registrationLink}" target="_blank" class="mt-4 block w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm text-center rounded-full transition-colors shadow-sm">Daftar Sekarang</a>` 
                : '';

            card.innerHTML = `
                <div class="relative w-full h-48 bg-slate-200">
                    <img src="${poster.imageUrl}" alt="${poster.title}" class="w-full h-full object-cover">
                    ${adminActions}
                </div>
                <div class="p-5 flex flex-col flex-grow">
                    <span class="text-[0.65rem] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full self-start mb-3">${poster.category}</span>
                    <h3 class="text-lg font-bold text-slate-800 mb-2">${poster.title}</h3>
                    <p class="text-slate-600 text-sm flex-grow line-clamp-3">${poster.description}</p>
                    <p class="text-slate-400 text-xs font-semibold mt-3 mb-1">📅 ${poster.date}</p>
                    ${regBtn}
                </div>
            `;
            posterGrid.appendChild(card);
        });

        if (isAdmin) {
            document.querySelectorAll('.edit-poster-btn').forEach(btn => btn.addEventListener('click', (e) => editPoster(e.currentTarget.getAttribute('data-id'))));
            document.querySelectorAll('.delete-poster-btn').forEach(btn => btn.addEventListener('click', (e) => deletePoster(e.currentTarget.getAttribute('data-id'))));
        }
    }

    // --- RENDER MATERIALS ---
    function renderMaterials() {
        if (!materialGrid) return;
        materialGrid.innerHTML = '';
        const materials = Object.values(materialsData);
        
        if (materials.length === 0) {
            materialGrid.innerHTML = '<p class="text-slate-500 col-span-full">Belum ada materi. Aktifkan mode Admin untuk menambahkan.</p>';
            return;
        }

        materials.forEach(mat => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl shadow-md p-6 border border-slate-200 flex flex-col hover:shadow-xl transition-all relative';
            
            let adminActions = '';
            if (isAdmin) {
                adminActions = `
                    <div class="absolute -top-3 -right-3 flex gap-2 z-10">
                        <button data-id="${mat.id}" class="edit-mat-btn bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-yellow-500 transition" title="Edit">✏️</button>
                        <button data-id="${mat.id}" class="delete-mat-btn bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow hover:bg-red-600 transition" title="Hapus">🗑️</button>
                    </div>
                `;
            }

            // Extract topics overview
            let kontenCount = 0;
            try { kontenCount = JSON.parse(mat.konten_slide || '[]').length; } catch(e){}

            card.innerHTML = `
                ${adminActions}
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">${mat.jenjang}</span>
                    <span class="text-2xl" title="Maskot: ${mat.karakter_maskot}">${mat.karakter_maskot === 'Kiko' ? '🐢' : mat.karakter_maskot === 'Bimo' ? '🐻' : '🐰'}</span>
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
                    <button onclick="openSlide('${mat.id}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-full shadow transition text-sm flex items-center justify-center gap-2">
                        ▶ Mulai Belajar Interaktif
                    </button>
                    <a href="${mat.download_pptx_url || '#'}" target="_blank" class="w-full bg-white border-2 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700 font-bold py-2 px-4 rounded-full transition text-sm text-center">
                        📥 Unduh Panduan Guru (.pptx)
                    </a>
                </div>
            `;
            materialGrid.appendChild(card);
        });

        if (isAdmin) {
            document.querySelectorAll('.edit-mat-btn').forEach(btn => btn.addEventListener('click', (e) => editMaterial(e.currentTarget.getAttribute('data-id'))));
            document.querySelectorAll('.delete-mat-btn').forEach(btn => btn.addEventListener('click', (e) => deleteMaterial(e.currentTarget.getAttribute('data-id'))));
        }
    }

    // --- CRUD POSTERS ---
    function editPoster(id) {
        const poster = postersData[id];
        if(!poster) return;
        editingPosterId = id;
        
        document.getElementById('poster-title').value = poster.title;
        document.getElementById('poster-category').value = poster.category;
        document.getElementById('poster-link').value = poster.registrationLink || '';
        document.getElementById('poster-date').value = poster.date;
        document.getElementById('poster-description').value = poster.description;
        document.getElementById('poster-image-help').innerText = 'Biarkan kosong jika tidak ingin mengubah gambar.';
        
        posterModalTitle.innerText = 'Edit Poster';
        posterModal.classList.remove('hidden');
    }

    async function deletePoster(id) {
        if(!confirm('Apakah Anda yakin ingin menghapus poster ini beserta gambarnya?')) return;
        try {
            if (postersData[id].imagePath) {
                await deleteObject(ref(storage, postersData[id].imagePath));
            }
            await deleteDoc(doc(db, "posters", id));
        } catch (error) {
            console.error(error);
            alert('Gagal menghapus poster.');
        }
    }

    posterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        posterSubmitBtn.disabled = true;
        posterSubmitBtn.innerText = 'Menyimpan...';

        try {
            const title = document.getElementById('poster-title').value;
            const category = document.getElementById('poster-category').value;
            const registrationLink = document.getElementById('poster-link').value;
            const date = document.getElementById('poster-date').value;
            const description = document.getElementById('poster-description').value;
            const file = document.getElementById('poster-image').files[0];

            let imageUrl = '';
            let imagePath = '';

            if (editingPosterId) {
                const current = postersData[editingPosterId];
                imageUrl = current.imageUrl;
                imagePath = current.imagePath;

                if (file) {
                    if (current.imagePath) {
                        try { await deleteObject(ref(storage, current.imagePath)); } catch(e) {}
                    }
                    imagePath = 'posters/' + Date.now() + '_' + file.name;
                    const newImgRef = ref(storage, imagePath);
                    await uploadBytes(newImgRef, file);
                    imageUrl = await getDownloadURL(newImgRef);
                }

                await updateDoc(doc(db, "posters", editingPosterId), {
                    title, category, registrationLink, date, description, imageUrl, imagePath
                });
            } else {
                if (!file) {
                    alert('Harap unggah gambar poster!');
                    posterSubmitBtn.disabled = false;
                    posterSubmitBtn.innerText = 'Simpan Poster';
                    return;
                }
                
                imagePath = 'posters/' + Date.now() + '_' + file.name;
                const imgRef = ref(storage, imagePath);
                await uploadBytes(imgRef, file);
                imageUrl = await getDownloadURL(imgRef);

                await addDoc(collection(db, "posters"), {
                    title, category, registrationLink, date, description, imageUrl, imagePath
                });
            }

            posterModal.classList.add('hidden');
            posterForm.reset();
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan.');
        } finally {
            posterSubmitBtn.disabled = false;
            posterSubmitBtn.innerText = 'Simpan Poster';
        }
    });

    // --- CRUD MATERIALS ---
    function editMaterial(id) {
        const mat = materialsData[id];
        if(!mat) return;
        editingMaterialId = id;
        
        document.getElementById('mat-jenjang').value = mat.jenjang;
        document.getElementById('mat-matpel').value = mat.matpel;
        document.getElementById('mat-judul').value = mat.judul_topik;
        document.getElementById('mat-tujuan').value = mat.tujuan_belajar;
        document.getElementById('mat-karakter').value = mat.karakter_maskot;
        document.getElementById('mat-konten').value = mat.konten_slide || '[]';
        document.getElementById('mat-latihan').value = mat.latihan_soal || '[]';
        document.getElementById('mat-otakhebat').value = mat.otak_hebat || '';
        document.getElementById('mat-download').value = mat.download_pptx_url || '';
        
        materialModalTitle.innerText = 'Edit Materi';
        materialModal.classList.remove('hidden');
    }

    async function deleteMaterial(id) {
        if(!confirm('Apakah Anda yakin ingin menghapus materi ini?')) return;
        try {
            await deleteDoc(doc(db, "materials", id));
        } catch (error) {
            console.error(error);
            alert('Gagal menghapus materi.');
        }
    }

    materialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        materialSubmitBtn.disabled = true;
        materialSubmitBtn.innerText = 'Menyimpan...';

        try {
            // Validate JSON
            const kontenVal = document.getElementById('mat-konten').value;
            const latihanVal = document.getElementById('mat-latihan').value;
            
            try { JSON.parse(kontenVal || '[]'); } catch(e) { throw new Error('Format JSON pada array Konten Slide tidak valid.'); }
            try { JSON.parse(latihanVal || '[]'); } catch(e) { throw new Error('Format JSON pada array Latihan Soal tidak valid.'); }

            const data = {
                jenjang: document.getElementById('mat-jenjang').value,
                matpel: document.getElementById('mat-matpel').value,
                judul_topik: document.getElementById('mat-judul').value,
                tujuan_belajar: document.getElementById('mat-tujuan').value,
                karakter_maskot: document.getElementById('mat-karakter').value,
                konten_slide: kontenVal || '[]',
                latihan_soal: latihanVal || '[]',
                otak_hebat: document.getElementById('mat-otakhebat').value,
                download_pptx_url: document.getElementById('mat-download').value
            };

            if (editingMaterialId) {
                await updateDoc(doc(db, "materials", editingMaterialId), data);
            } else {
                await addDoc(collection(db, "materials"), data);
            }

            materialModal.classList.add('hidden');
            materialForm.reset();
        } catch (error) {
            console.error(error);
            alert('Error: ' + error.message);
        } finally {
            materialSubmitBtn.disabled = false;
            materialSubmitBtn.innerText = 'Simpan Materi';
        }
    });
});
