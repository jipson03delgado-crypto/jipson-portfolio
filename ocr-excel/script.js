// OCR-to-Excel: Con soporte completo para PDF e Imagen
// Usamos PDF.js para renderizar PDFs y Tesseract.js para OCR

// Configurar worker de PDF.js desde CDN
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/';

document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a elementos del DOM ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const processingArea = document.getElementById('processing-area');
    const imagePreview = document.getElementById('image-preview');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const changeImageBtn = document.getElementById('change-image-btn');
    const progressContainer = document.getElementById('progress-container');
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    const resultArea = document.getElementById('result-area');
    const editableTable = document.getElementById('editable-table');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
    const clearBtn = document.getElementById('clear-btn');
    const pdfPageNav = document.getElementById('pdf-page-nav');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageIndicator = document.getElementById('page-indicator');
    const previewTitle = document.getElementById('preview-title');

    // --- Estado interno ---
    let pdfDocument = null;
    let currentPage = 1;
    let totalPages = 0;
    let currentFileType = null; // 'image' | 'pdf'

    // ─── 1. Drag & Drop / File Input ───────────────────────────────────────
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
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

    // ─── 2. Determinar tipo de archivo y procesar ──────────────────────────
    function handleFile(file) {
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');

        if (!isPDF && !isImage) {
            alert('Por favor, selecciona únicamente archivos PDF o imágenes (PNG, JPG, JPEG).');
            return;
        }

        currentFileType = isPDF ? 'pdf' : 'image';
        dropZone.classList.add('hidden');
        processingArea.classList.remove('hidden');
        resultArea.classList.add('hidden');
        editableTable.innerHTML = '';

        if (isPDF) {
            processPDF(file);
        } else {
            processImage(file);
        }
    }

    // ─── 3. Procesamiento de IMAGEN ────────────────────────────────────────
    function processImage(file) {
        previewTitle.textContent = 'Imagen Cargada';
        pdfPageNav.classList.add('hidden');
        pdfCanvas.classList.add('hidden');
        imagePreview.classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            runOCR(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    // ─── 4. Procesamiento de PDF ───────────────────────────────────────────
    async function processPDF(file) {
        previewTitle.textContent = 'PDF Cargado';
        imagePreview.classList.add('hidden');
        pdfCanvas.classList.remove('hidden');
        pdfPageNav.classList.remove('hidden');

        setStatus('Cargando PDF...', 5);

        // Configurar worker de PDF.js
        const pdfjsLib = await import(PDFJS_CDN + 'pdf.min.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.mjs';

        const arrayBuffer = await file.arrayBuffer();
        pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        totalPages = pdfDocument.numPages;
        currentPage = 1;

        updatePageNav();
        await renderAndOCRPage(currentPage);
    }

    // Renderizar una página del PDF en canvas y luego pasar a OCR
    async function renderAndOCRPage(pageNum) {
        setStatus(`Renderizando página ${pageNum} de ${totalPages}...`, 15);

        const page = await pdfDocument.getPage(pageNum);
        const scale = 2.5; // Mayor escala = mejor resolución para OCR
        const viewport = page.getViewport({ scale });

        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        const ctx = pdfCanvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convertir canvas a imagen para Tesseract
        const dataUrl = pdfCanvas.toDataURL('image/png');
        await runOCR(dataUrl);
    }

    // Navegación entre páginas del PDF
    prevPageBtn.addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            updatePageNav();
            resultArea.classList.add('hidden');
            progressContainer.classList.remove('hidden');
            await renderAndOCRPage(currentPage);
        }
    });

    nextPageBtn.addEventListener('click', async () => {
        if (currentPage < totalPages) {
            currentPage++;
            updatePageNav();
            resultArea.classList.add('hidden');
            progressContainer.classList.remove('hidden');
            await renderAndOCRPage(currentPage);
        }
    });

    function updatePageNav() {
        pageIndicator.textContent = `Pág. ${currentPage} / ${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    // ─── 5. Motor Tesseract OCR ────────────────────────────────────────────
    async function runOCR(imageSrc) {
        setStatus('Iniciando motor de IA (Tesseract)...', 10);
        progressContainer.classList.remove('hidden');

        try {
            const worker = await Tesseract.createWorker('spa');
            setStatus('Analizando contenido de la página...', 30);

            const result = await worker.recognize(imageSrc, {}, {
                onProgress: (p) => {
                    if (p.status === 'recognizing text') {
                        const pct = Math.round(30 + (p.progress * 60));
                        setStatus(`Reconociendo texto: ${Math.round(p.progress * 100)}%`, pct);
                    }
                }
            });

            setStatus('Estructurando tabla...', 95);
            buildTableFromText(result.data.text);

            await worker.terminate();

            setStatus('¡Listo!', 100);
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                resultArea.classList.remove('hidden');
            }, 400);

        } catch (error) {
            console.error('Error OCR:', error);
            statusText.textContent = '❌ Error al procesar. Intenta con otro archivo.';
            alert('Hubo un error al procesar el archivo. Asegúrate de que el texto sea legible.');
        }
    }

    // ─── 6. Construir tabla HTML editable desde texto OCR ─────────────────
    function buildTableFromText(rawText) {
        editableTable.innerHTML = '';

        const lines = rawText
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 1);

        if (lines.length === 0) {
            editableTable.innerHTML = '<tr><td contenteditable="true">No se detectó texto. Intenta con una imagen de mayor resolución o un PDF con texto seleccionable.</td></tr>';
            return;
        }

        // Detectar columnas por separaciones de 2+ espacios o tabuladores
        const tableData = lines.map(line => {
            const cleaned = line.replace(/\s{2,}/g, '\t');
            return cleaned.split('\t').map(cell => cell.trim()).filter((_, i, arr) => arr.length === 1 || true);
        });

        let maxCols = Math.max(...tableData.map(r => r.length));
        if (maxCols < 1) maxCols = 1;

        // Encabezados editables
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let i = 0; i < maxCols; i++) {
            const th = document.createElement('th');
            th.textContent = `Columna ${i + 1}`;
            th.setAttribute('contenteditable', 'true');
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        editableTable.appendChild(thead);

        // Filas editables
        const tbody = document.createElement('tbody');
        tableData.forEach(rowCells => {
            const tr = document.createElement('tr');
            for (let i = 0; i < maxCols; i++) {
                const td = document.createElement('td');
                td.textContent = rowCells[i] !== undefined ? rowCells[i] : '';
                td.setAttribute('contenteditable', 'true');
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
        editableTable.appendChild(tbody);
    }

    // ─── 7. Exportar a Excel (CSV) ─────────────────────────────────────────
    exportCsvBtn.addEventListener('click', () => {
        const rows = Array.from(editableTable.querySelectorAll('tr'));
        const csvContent = rows.map(tr =>
            Array.from(tr.querySelectorAll('th, td'))
                .map(cell => `"${cell.textContent.trim().replace(/"/g, '""')}"`)
                .join(';')
        ).join('\r\n');

        // BOM UTF-8 para que Excel respete tildes y ñ
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `datos_extraidos_pag${currentPage}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ─── 8. Copiar tabla al portapapeles (lista para pegar en Excel) ───────
    copyClipboardBtn.addEventListener('click', () => {
        const rows = Array.from(editableTable.querySelectorAll('tr'));
        const tabContent = rows.map(tr =>
            Array.from(tr.querySelectorAll('th, td'))
                .map(cell => cell.textContent.trim())
                .join('\t')
        ).join('\n');

        navigator.clipboard.writeText(tabContent).then(() => {
            const orig = copyClipboardBtn.textContent;
            copyClipboardBtn.textContent = '¡Copiado!';
            copyClipboardBtn.style.cssText = 'background-color: #10b981; color: #fff;';
            setTimeout(() => {
                copyClipboardBtn.textContent = orig;
                copyClipboardBtn.style.cssText = '';
            }, 2000);
        }).catch(() => alert('No se pudo copiar. Selecciona la tabla manualmente.'));
    });

    // ─── 9. Utilidades ─────────────────────────────────────────────────────
    function setStatus(msg, pct) {
        statusText.textContent = msg;
        progressBar.style.width = `${pct}%`;
    }

    function resetTool() {
        fileInput.value = '';
        imagePreview.src = '';
        pdfDocument = null;
        currentPage = 1;
        totalPages = 0;
        currentFileType = null;
        dropZone.classList.remove('hidden');
        processingArea.classList.add('hidden');
        resultArea.classList.add('hidden');
        pdfPageNav.classList.add('hidden');
        pdfCanvas.classList.add('hidden');
        pdfCanvas.width = 0;
        pdfCanvas.height = 0;
        imagePreview.classList.remove('hidden');
        progressBar.style.width = '0%';
        editableTable.innerHTML = '';
    }
});
