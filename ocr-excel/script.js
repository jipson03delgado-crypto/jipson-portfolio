// OCR-to-Excel: Con soporte completo para PDF e Imagen
// OPTIMIZADO: Worker precargado al inicio y reutilizado en cada proceso

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const dropZone        = document.getElementById('drop-zone');
    const fileInput       = document.getElementById('file-input');
    const processingArea  = document.getElementById('processing-area');
    const imagePreview    = document.getElementById('image-preview');
    const pdfCanvas       = document.getElementById('pdf-canvas');
    const changeImageBtn  = document.getElementById('change-image-btn');
    const progressContainer = document.getElementById('progress-container');
    const statusText      = document.getElementById('status-text');
    const progressBar     = document.getElementById('progress-bar');
    const resultArea      = document.getElementById('result-area');
    const editableTable   = document.getElementById('editable-table');
    const exportCsvBtn    = document.getElementById('export-csv-btn');
    const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
    const clearBtn        = document.getElementById('clear-btn');
    const pdfPageNav      = document.getElementById('pdf-page-nav');
    const prevPageBtn     = document.getElementById('prev-page-btn');
    const nextPageBtn     = document.getElementById('next-page-btn');
    const pageIndicator   = document.getElementById('page-indicator');
    const previewTitle    = document.getElementById('preview-title');
    const dropZoneHint    = document.getElementById('drop-zone-hint');

    // --- Estado interno ---
    let pdfDocument   = null;
    let currentPage   = 1;
    let totalPages    = 0;
    let currentFileType = null;

    // ── OPTIMIZACIÓN CLAVE: Worker precargado ────────────────────────────────
    // Se inicia en el fondo apenas carga la página para que cuando el usuario
    // suba su archivo, el motor ya esté listo y no tenga que esperar.
    let tesseractWorker = null;
    let workerReady     = false;

    async function initWorker() {
        try {
            updateDropZoneHint('⚙️ Preparando motor de IA en segundo plano...');
            tesseractWorker = await Tesseract.createWorker('spa+eng');
            workerReady = true;
            updateDropZoneHint('✅ Motor listo. Arrastra tu PDF o imagen aquí.');
        } catch (err) {
            console.error('Error al inicializar worker:', err);
            updateDropZoneHint('⚠️ Recarga la página si el motor no responde.');
        }
    }

    function updateDropZoneHint(msg) {
        if (dropZoneHint) dropZoneHint.textContent = msg;
    }

    // Precarga inmediata
    initWorker();

    // ── 1. Drag & Drop / File Input ──────────────────────────────────────────
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
    changeImageBtn.addEventListener('click', resetTool);
    clearBtn.addEventListener('click', resetTool);

    // ── 2. Detectar tipo de archivo ──────────────────────────────────────────
    function handleFile(file) {
        const isPDF  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        if (!isPDF && !isImage) {
            alert('Por favor, selecciona un PDF o imagen (PNG, JPG, JPEG).');
            return;
        }
        currentFileType = isPDF ? 'pdf' : 'image';
        dropZone.classList.add('hidden');
        processingArea.classList.remove('hidden');
        resultArea.classList.add('hidden');
        editableTable.innerHTML = '';
        isPDF ? processPDF(file) : processImage(file);
    }

    // ── 3. Procesar Imagen ───────────────────────────────────────────────────
    function processImage(file) {
        previewTitle.textContent = 'Imagen Cargada';
        pdfPageNav.classList.add('hidden');
        pdfCanvas.classList.add('hidden');
        imagePreview.classList.remove('hidden');
        const reader = new FileReader();
        reader.onload = (e) => { imagePreview.src = e.target.result; runOCR(e.target.result); };
        reader.readAsDataURL(file);
    }

    // ── 4. Procesar PDF ──────────────────────────────────────────────────────
    async function processPDF(file) {
        previewTitle.textContent = 'PDF Cargado';
        imagePreview.classList.add('hidden');
        pdfCanvas.classList.remove('hidden');
        pdfPageNav.classList.remove('hidden');
        setStatus('Cargando PDF...', 5);

        /* @vite-ignore */
        const pdfjsLib = await import(/* @vite-ignore */ PDFJS_CDN + 'pdf.min.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.mjs';

        const arrayBuffer = await file.arrayBuffer();
        pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        totalPages  = pdfDocument.numPages;
        currentPage = 1;
        updatePageNav();
        await renderAndOCRPage(currentPage);
    }

    async function renderAndOCRPage(pageNum) {
        setStatus(`Renderizando página ${pageNum} de ${totalPages}...`, 15);
        const page     = await pdfDocument.getPage(pageNum);
        // Escala 2.0 — buen balance entre velocidad y calidad
        const viewport = page.getViewport({ scale: 2.0 });
        pdfCanvas.width  = viewport.width;
        pdfCanvas.height = viewport.height;
        await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;
        await runOCR(pdfCanvas.toDataURL('image/png'));
    }

    prevPageBtn.addEventListener('click', async () => {
        if (currentPage > 1) { currentPage--; updatePageNav(); resultArea.classList.add('hidden'); progressContainer.classList.remove('hidden'); await renderAndOCRPage(currentPage); }
    });
    nextPageBtn.addEventListener('click', async () => {
        if (currentPage < totalPages) { currentPage++; updatePageNav(); resultArea.classList.add('hidden'); progressContainer.classList.remove('hidden'); await renderAndOCRPage(currentPage); }
    });
    function updatePageNav() {
        pageIndicator.textContent = `Pág. ${currentPage} / ${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    // ── 5. OCR reutilizando el worker precargado ─────────────────────────────
    async function runOCR(imageSrc) {
        progressContainer.classList.remove('hidden');

        // Si el worker aún no está listo (descargando), esperar
        if (!workerReady) {
            setStatus('⏳ Descargando motor de IA por primera vez (~20MB)...', 5);
            await waitForWorker();
        }

        setStatus('Analizando imagen...', 20);

        try {
            // REUTILIZA el worker ya cargado — mucho más rápido
            const result = await tesseractWorker.recognize(imageSrc, {}, {
                onProgress: (p) => {
                    if (p.status === 'recognizing text') {
                        const pct = Math.round(20 + (p.progress * 75));
                        setStatus(`Reconociendo texto: ${Math.round(p.progress * 100)}%`, pct);
                    }
                }
            });

            setStatus('Estructurando tabla...', 97);
            buildTableFromText(result.data.text);
            setStatus('¡Listo!', 100);

            setTimeout(() => {
                progressContainer.classList.add('hidden');
                resultArea.classList.remove('hidden');
            }, 350);

        } catch (err) {
            console.error('Error OCR:', err);
            statusText.textContent = '❌ Error al procesar. Intenta con otro archivo.';
        }
    }

    function waitForWorker() {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (workerReady) { clearInterval(check); resolve(); }
            }, 300);
        });
    }

    // ── 6. Texto OCR → Tabla HTML editable ───────────────────────────────────
    function buildTableFromText(rawText) {
        editableTable.innerHTML = '';
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 1);
        if (lines.length === 0) {
            editableTable.innerHTML = '<tr><td contenteditable="true">No se detectó texto. Usa una imagen de mayor resolución.</td></tr>';
            return;
        }
        const tableData = lines.map(line => line.replace(/\s{2,}/g, '\t').split('\t').map(c => c.trim()));
        const maxCols   = Math.max(...tableData.map(r => r.length), 1);

        const thead = document.createElement('thead');
        const hRow  = document.createElement('tr');
        for (let i = 0; i < maxCols; i++) {
            const th = document.createElement('th');
            th.textContent = `Columna ${i + 1}`;
            th.setAttribute('contenteditable', 'true');
            hRow.appendChild(th);
        }
        thead.appendChild(hRow);
        editableTable.appendChild(thead);

        const tbody = document.createElement('tbody');
        tableData.forEach(cells => {
            const tr = document.createElement('tr');
            for (let i = 0; i < maxCols; i++) {
                const td = document.createElement('td');
                td.textContent = cells[i] ?? '';
                td.setAttribute('contenteditable', 'true');
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
        editableTable.appendChild(tbody);
    }

    // ── 7. Exportar CSV / Copiar ──────────────────────────────────────────────
    exportCsvBtn.addEventListener('click', () => {
        const rows = Array.from(editableTable.querySelectorAll('tr'));
        const csv  = rows.map(tr =>
            Array.from(tr.querySelectorAll('th,td'))
                .map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`)
                .join(';')
        ).join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `datos_pag${currentPage}.csv`; a.style.display = 'none';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    copyClipboardBtn.addEventListener('click', () => {
        const rows = Array.from(editableTable.querySelectorAll('tr'));
        const text = rows.map(tr => Array.from(tr.querySelectorAll('th,td')).map(c => c.textContent.trim()).join('\t')).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const orig = copyClipboardBtn.textContent;
            copyClipboardBtn.textContent = '¡Copiado!';
            copyClipboardBtn.style.cssText = 'background:#10b981;color:#fff;';
            setTimeout(() => { copyClipboardBtn.textContent = orig; copyClipboardBtn.style.cssText = ''; }, 2000);
        }).catch(() => alert('Selecciona y copia la tabla manualmente.'));
    });

    // ── 8. Utilidades ─────────────────────────────────────────────────────────
    function setStatus(msg, pct) {
        statusText.textContent = msg;
        progressBar.style.width = `${pct}%`;
    }

    function resetTool() {
        fileInput.value = '';
        imagePreview.src = '';
        pdfDocument = null;
        currentPage = 1; totalPages = 0; currentFileType = null;
        dropZone.classList.remove('hidden');
        processingArea.classList.add('hidden');
        resultArea.classList.add('hidden');
        pdfPageNav.classList.add('hidden');
        pdfCanvas.classList.add('hidden');
        pdfCanvas.width = 0; pdfCanvas.height = 0;
        imagePreview.classList.remove('hidden');
        progressBar.style.width = '0%';
        editableTable.innerHTML = '';
    }
});
