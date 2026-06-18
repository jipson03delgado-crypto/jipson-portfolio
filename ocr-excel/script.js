// OCR-to-Excel Javascript Logic
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const processingArea = document.getElementById('processing-area');
    const imagePreview = document.getElementById('image-preview');
    const changeImageBtn = document.getElementById('change-image-btn');
    const progressContainer = document.getElementById('progress-container');
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    const resultArea = document.getElementById('result-area');
    const editableTable = document.getElementById('editable-table');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
    const clearBtn = document.getElementById('clear-btn');

    // 1. Drag & Drop Upload Events
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processSelectedImage(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            processSelectedImage(files[0]);
        }
    });

    changeImageBtn.addEventListener('click', resetTool);
    clearBtn.addEventListener('click', resetTool);

    function processSelectedImage(file) {
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecciona únicamente archivos de imagen (PNG, JPG, JPEG).');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            dropZone.classList.add('hidden');
            processingArea.classList.remove('hidden');
            
            // Start OCR process
            runOCR(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    // 2. Tesseract OCR Engine Implementation
    async function runOCR(imageSrc) {
        statusText.textContent = 'Cargando motor de IA (Tesseract)...';
        progressBar.style.width = '10%';
        resultArea.classList.add('hidden');
        progressContainer.classList.remove('hidden');

        try {
            // Initialize Worker for Spanish (spa)
            const worker = await Tesseract.createWorker('spa');
            
            statusText.textContent = 'Analizando imagen y estructurando celdas...';
            progressBar.style.width = '30%';

            // Perform OCR Recognition
            const result = await worker.recognize(imageSrc, {}, {
                // Read progress updates
                onProgress: (p) => {
                    if (p.status === 'recognizing text') {
                        const progressPercent = Math.round(30 + (p.progress * 60));
                        progressBar.style.width = `${progressPercent}%`;
                        statusText.textContent = `Reconociendo caracteres: ${Math.round(p.progress * 100)}%`;
                    }
                }
            });

            progressBar.style.width = '95%';
            statusText.textContent = 'Procesando formato de tabla...';

            // Extract words and structure them
            const textOutput = result.data.text;
            
            // Build editable HTML table from OCR raw text
            buildTableFromText(textOutput);
            
            // Clean up Worker
            await worker.terminate();

            // Finish and show results
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                resultArea.classList.remove('hidden');
            }, 500);

        } catch (error) {
            console.error('Error durante el reconocimiento OCR:', error);
            statusText.textContent = 'Error al procesar la imagen.';
            alert('Hubo un error al procesar tu imagen. Por favor, asegúrate de que sea una imagen válida con texto legible.');
        }
    }

    // 3. Text-to-Table Parser Logic
    function buildTableFromText(rawText) {
        // Clean old table
        editableTable.innerHTML = '';

        const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length === 0) {
            // Fallback empty data
            editableTable.innerHTML = '<tr><td contenteditable="true">No se detectó texto. Intenta con otra imagen.</td></tr>';
            return;
        }

        // We split columns by 2 or more spaces, or tabs
        const tableData = lines.map(line => {
            // Replace multiple spaces with a tab to split easily
            const cleanedLine = line.replace(/\s{2,}/g, '\t');
            return cleanedLine.split('\t').map(cell => cell.trim());
        });

        // Determine max columns
        let maxCols = 0;
        tableData.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

        // Build Table Header (thead)
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let i = 0; i < maxCols; i++) {
            const th = document.createElement('th');
            th.textContent = `Columna ${i + 1}`;
            th.setAttribute('contenteditable', 'true'); // Headers are also editable!
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        editableTable.appendChild(thead);

        // Build Table Body (tbody)
        const tbody = document.createElement('tbody');
        tableData.forEach(rowCells => {
            const tr = document.createElement('tr');
            
            for (let i = 0; i < maxCols; i++) {
                const td = document.createElement('td');
                td.textContent = rowCells[i] || ''; // Empty if row is shorter
                td.setAttribute('contenteditable', 'true');
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
        editableTable.appendChild(tbody);
    }

    // 4. Excel (CSV) Export Handler
    exportCsvBtn.addEventListener('click', () => {
        const rows = Array.from(editableTable.querySelectorAll('tr'));
        
        const csvContent = rows.map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td'));
            return cells.map(cell => {
                // Escape quotes and wrap in quotes to prevent delimiter collision
                let text = cell.textContent.trim().replace(/"/g, '""');
                return `"${text}"`;
            }).join(';'); // Semicolon is standard separator for Spanish Excel
        }).join('\r\n');

        // Add UTF-8 Byte Order Mark (BOM) so Excel respects accents/ñ in Spanish
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'datos_extraidos.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 5. Copy Clipboard Handler (Tab separated format ready to paste in Excel)
    copyClipboardBtn.addEventListener('click', () => {
        const rows = Array.from(editableTable.querySelectorAll('tr'));
        const tabContent = rows.map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td'));
            return cells.map(cell => cell.textContent.trim()).join('\t');
        }).join('\n');

        navigator.clipboard.writeText(tabContent).then(() => {
            const originalText = copyClipboardBtn.textContent;
            copyClipboardBtn.textContent = '¡Copiado!';
            copyClipboardBtn.style.backgroundColor = '#10b981';
            copyClipboardBtn.style.color = '#fff';

            setTimeout(() => {
                copyClipboardBtn.textContent = originalText;
                copyClipboardBtn.style.backgroundColor = '';
                copyClipboardBtn.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Error al copiar al portapapeles:', err);
            alert('No se pudo copiar automáticamente. Por favor, selecciona y copia la tabla manualmente.');
        });
    });

    // 6. Reset Tool State
    function resetTool() {
        fileInput.value = '';
        imagePreview.src = '';
        dropZone.classList.remove('hidden');
        processingArea.classList.add('hidden');
        resultArea.classList.add('hidden');
        progressBar.style.width = '0%';
        editableTable.innerHTML = '';
    }
});
