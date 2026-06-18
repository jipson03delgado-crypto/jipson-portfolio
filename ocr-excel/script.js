const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/';

document.addEventListener('DOMContentLoaded', () => {
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

    let pdfDocument   = null;
    let currentPage   = 1;
    let totalPages    = 0;
    let currentFileType = null;
    let currentImageUrl = null;

    let tesseractWorker = null;
    let workerReady     = false;
    let workerLoadProgress = 0;
    let workerLoadStatus = '';
    let pdfjsLib        = null;
    let pdfReady        = false;
    let pdfPreloadPromise = null;

    const ESTIMATED_ENGINE_MB = 20;

    async function initWorker() {
        try {
            updateDropZoneHint('⚙️ Preparando motor de IA en segundo plano...');
            tesseractWorker = await Tesseract.createWorker({
                logger: (m) => {
                    if (m.status && typeof m.progress === 'number') {
                        workerLoadProgress = m.progress;
                        workerLoadStatus = m.status;
                        if (m.status.includes('loading') || m.status.includes('initializing') || m.status.includes('download')) {
                            const pct = Math.round(m.progress * 100);
                            const remainingMB = Math.max(0, ESTIMATED_ENGINE_MB * (1 - m.progress));
                            updateDropZoneHint(`⚙️ ${m.status} ${pct}% · faltan ${remainingMB.toFixed(1)} MB`);
                        }
                    }
                }
            });
            await tesseractWorker.loadLanguage('spa+eng');
            await tesseractWorker.initialize('spa+eng');
            workerReady = true;
            updateDropZoneHint('✅ Motor listo. Cargando lector de PDF...');
            preloadPDFjs();
        } catch (err) {
            console.error('Error al inicializar worker:', err);
            updateDropZoneHint('⚠️ Recarga la página si el motor no responde.');
        }
    }

    async function preloadPDFjs() {
        if (pdfPreloadPromise) return pdfPreloadPromise;
        pdfPreloadPromise = (async () => {
            try {
                updateDropZoneHint('⚙️ Precargando lector de PDF...');
                /* @vite-ignore */
                pdfjsLib = await import(/* @vite-ignore */ PDFJS_CDN + 'pdf.min.mjs');
                pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.mjs';
                pdfReady = true;
                if (workerReady) {
                    updateDropZoneHint('✅ Motor de IA y PDF listos. Arrastra tu PDF o imagen aquí.');
                }
            } catch (err) {
                console.error('Error al precargar PDF.js:', err);
                updateDropZoneHint('⚠️ No se pudo pre-cargar PDF.js. El PDF cargará al momento.');
                pdfPreloadPromise = null;
            }
        })();
        return pdfPreloadPromise;
    }

    function updateDropZoneHint(msg) {
        if (dropZoneHint) dropZoneHint.textContent = msg;
    }

    initWorker();

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

    function processImage(file) {
        previewTitle.textContent = 'Imagen Cargada';
        pdfPageNav.classList.add('hidden');
        pdfCanvas.classList.add('hidden');
        imagePreview.classList.remove('hidden');
        if (currentImageUrl) {
            URL.revokeObjectURL(currentImageUrl);
            currentImageUrl = null;
        }
        currentImageUrl = URL.createObjectURL(file);
        imagePreview.src = currentImageUrl;
        imagePreview.onload = async () => {
            const resizedSrc = await getResizedImageDataUrl(currentImageUrl, 1400);
            runOCR(resizedSrc);
        };
    }

    async function getResizedImageDataUrl(src, maxSize = 1000) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'low';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = (error) => reject(error);
            img.src = src;
        });
    }

    async function processPDF(file) {
        previewTitle.textContent = 'PDF Cargado';
        imagePreview.classList.add('hidden');
        pdfCanvas.classList.remove('hidden');
        pdfPageNav.classList.remove('hidden');
        setStatus('Cargando PDF...', 5);

        if (!pdfReady) {
            setStatus('Cargando PDF.js en segundo plano...', 10);
            await preloadPDFjs();
        }

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
        const initialViewport = page.getViewport({ scale: 1.0 });
        const maxSize = 1400;
        const scale   = Math.min(maxSize / initialViewport.width, maxSize / initialViewport.height, 1);
        const viewport = page.getViewport({ scale });
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

    async function runOCR(imageSrc) {
        progressContainer.classList.remove('hidden');

        if (!workerReady) {
            setStatus('⏳ Descargando motor de IA...', 5);
            await waitForWorker();
        }

        setStatus('Analizando imagen...', 20);

        try {
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
                if (workerReady) {
                    clearInterval(check);
                    resolve();
                    return;
                }

                const remainingMB = Math.max(0, ESTIMATED_ENGINE_MB * (1 - workerLoadProgress));
                const pct = Math.round(workerLoadProgress * 100);
                const statusMsg = workerLoadStatus || 'Descargando motor de IA';
                setStatus(`⏳ ${statusMsg} ${pct}% · faltan ${remainingMB.toFixed(1)} MB`, Math.max(5, pct));
            }, 200);
        });
    }

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

    function setStatus(msg, pct) {
        statusText.textContent = msg;
        progressBar.style.width = `${pct}%`;
    }

    function resetTool() {
        fileInput.value = '';
        if (currentImageUrl) {
            URL.revokeObjectURL(currentImageUrl);
            currentImageUrl = null;
        }
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
