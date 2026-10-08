pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const pageIndicator = document.getElementById('page-indicator');
let pageFlip = null;
let pdfDoc = null;
let currentScale = 1.5; // Escala inicial

// Nombre exacto del archivo PDF en el repositorio
const pdfFileName = 'cuento.pdf';

// Generador de efecto de sonido de página (Papel pasando) usando Web Audio API
function playPageFlipSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);

        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        // Ignorar si el navegador bloquea audio sin interacción previa
    }
}

// Cargar automáticamente el PDF al iniciar la página
window.addEventListener('DOMContentLoaded', () => {
    loadPDFFromFile(pdfFileName);
});

async function loadPDFFromFile(url) {
    loading.style.display = 'block';
    bookContainer.style.display = 'none';

    try {
        const loadingTask = pdfjsLib.getDocument(url);
        pdfDoc = await loadingTask.promise;
        await renderBook(currentScale);
    } catch (error) {
        console.error('Error al cargar el PDF:', error);
        loading.innerText = 'No se pudo cargar el cuento. Verifica que el archivo esté en el repositorio.';
    }
}

async function renderBook(scale) {
    bookContainer.innerHTML = '';
    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    const totalPages = pdfDoc.numPages;
    const firstPage = await pdfDoc.getPage(1);
    const viewportInfo = firstPage.getViewport({ scale: scale });
    const pageWidth = viewportInfo.width;
    const pageHeight = viewportInfo.height;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.setAttribute('data-page-num', pageNum);
        pageDiv.appendChild(canvas);
        
        bookContainer.appendChild(pageDiv);
    }

    bookContainer.style.display = 'block';
    
    pageFlip = new St.PageFlip(bookContainer, {
        width: pageWidth,
        height: pageHeight,
        size: "stretch",
        minWidth: 300,
        maxWidth: pageWidth * 1.5,
        minHeight: 400,
        maxHeight: pageHeight * 1.5,
        showCover: true,
        maxShadowOpacity: 0.5,
        usePortrait: true
    });

    const pages = document.querySelectorAll('.page');
    pageFlip.loadFromHTML(pages);
    
    // Eventos de cambio de página
    pageFlip.on('flip', (e) => {
        playPageFlipSound();
        updatePageIndicator(e.data + 1);
    });

    updatePageIndicator(1);
    loading.style.display = 'none';
}

function updatePageIndicator(pageNum) {
    if (pdfDoc) {
        pageIndicator.innerText = `Página ${pageNum} / ${pdfDoc.numPages}`;
    }
}

// Botones de Navegación
document.getElementById('prev-btn').addEventListener('click', () => {
    if (pageFlip) pageFlip.flipPrev();
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (pageFlip) pageFlip.flipNext();
});

// Control de Zoom (Agrandar / Achicar texto y vista para baja visión)
document.getElementById('zoom-in').addEventListener('click', () => {
    if (currentScale < 2.2) {
        currentScale += 0.25;
        renderBook(currentScale);
    }
});

document.getElementById('zoom-out').addEventListener('click', () => {
    if (currentScale > 1.0) {
        currentScale -= 0.25;
        renderBook(currentScale);
    }
});

// Lectura en voz alta para alumnos con baja visión (Sintetizador web)
document.getElementById('speak-btn').addEventListener('click', async () => {
    if (!pdfDoc || !pageFlip) return;
    
    const currentPageIndex = pageFlip.getCurrentPageIndex();
    // Extraer texto de la página actual utilizando PDF.js
    const page = await pdfDoc.getPage(currentPageIndex + 1);
    const textContent = await page.getTextContent();
    const textItems = textContent.items.map(item => item.str).join(' ');

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Detener lectura previa si la hay
        if (!textItems.trim()) {
            alert('Esta página no contiene texto seleccionable para leer en voz alta.');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(textItems);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9; // Velocidad un poco más pausada para niños
        window.speechSynthesis.speak(utterance);
    } else {
        alert('Tu navegador no soporta la lectura en voz alta.');
    }
});
