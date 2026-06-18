document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('theme-icon-moon');
    const sunIcon = document.getElementById('theme-icon-sun');
    const bodyElement = document.body;

    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    bodyElement.className = savedTheme;
    updateThemeIcons(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        if (bodyElement.classList.contains('dark-theme')) {
            bodyElement.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('theme', 'light-theme');
            updateThemeIcons('light-theme');
        } else {
            bodyElement.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('theme', 'dark-theme');
            updateThemeIcons('dark-theme');
        }
    });

    function updateThemeIcons(theme) {
        if (theme === 'light-theme') {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
    }

    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileDrawer = document.querySelector('.mobile-drawer');

    mobileMenuBtn.addEventListener('click', () => {
        mobileDrawer.classList.toggle('open');
        const isOpen = mobileDrawer.classList.contains('open');
        mobileMenuBtn.innerHTML = isOpen 
            ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>`;
    });

    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileDrawer.classList.remove('open');
            mobileMenuBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>`;
        });
    });

    const filterButtons = document.querySelectorAll('.filter-btn');
    const skillCards = document.querySelectorAll('.skill-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');

            skillCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                card.style.opacity = '0';
                card.style.transform = 'scale(0.95)';
                
                setTimeout(() => {
                    if (filterValue === 'all' || category === filterValue) {
                        card.classList.remove('hide');
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1)';
                        }, 50);
                    } else {
                        card.classList.add('hide');
                    }
                }, 200);
            });
        });
    });

    const revealSections = document.querySelectorAll('.scroll-reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealSections.forEach(section => {
        revealObserver.observe(section);
    });

    const contactForm = document.getElementById('contact-form');
    const formToast = document.getElementById('form-toast');

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        submitBtn.style.opacity = '0.7';

        setTimeout(() => {
            submitBtn.textContent = '¡Enviado!';
            submitBtn.style.backgroundColor = '#10b981';
            
            formToast.classList.remove('hidden');
            
            contactForm.reset();

            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.style.backgroundColor = '';
                
                formToast.classList.add('hidden');
            }, 3000);
        }, 1500);
    });

    const printCvBtn = document.getElementById('print-cv');
    const printCvMobileBtn = document.getElementById('print-cv-mobile');
    const printCvBottomBtn = document.getElementById('download-cv-btn');

    const triggerPrint = () => {
        window.print();
    };

    if (printCvBtn) printCvBtn.addEventListener('click', triggerPrint);
    if (printCvMobileBtn) printCvMobileBtn.addEventListener('click', triggerPrint);
    if (printCvBottomBtn) printCvBottomBtn.addEventListener('click', triggerPrint);
});
