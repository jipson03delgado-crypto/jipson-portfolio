document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('theme-icon-moon');
    const sunIcon = document.getElementById('theme-icon-sun');
    const bodyElement = document.body;

    // Check for saved theme preference, otherwise default to dark-theme
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

    // 2. Mobile Nav Menu Logic
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileDrawer = document.querySelector('.mobile-drawer');

    mobileMenuBtn.addEventListener('click', () => {
        mobileDrawer.classList.toggle('open');
        // Toggle menu icon between burger and close state
        const isOpen = mobileDrawer.classList.contains('open');
        mobileMenuBtn.innerHTML = isOpen 
            ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>`;
    });

    // Close mobile drawer when clicking on any link
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileDrawer.classList.remove('open');
            mobileMenuBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>`;
        });
    });

    // 3. Interactive Skills Filter Logic
    const filterButtons = document.querySelectorAll('.filter-btn');
    const skillCards = document.querySelectorAll('.skill-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and add to clicked
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');

            skillCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                // Add fade out animation state
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

    // 4. Scroll Reveal Animations using IntersectionObserver
    const revealSections = document.querySelectorAll('.scroll-reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Trigger only once
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealSections.forEach(section => {
        revealObserver.observe(section);
    });

    // 5. Contact Form Simulation
    const contactForm = document.getElementById('contact-form');
    const formToast = document.getElementById('form-toast');

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        
        // Visual sending state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        submitBtn.style.opacity = '0.7';

        // Simulate network latency (1.5 seconds)
        setTimeout(() => {
            // Success state
            submitBtn.textContent = '¡Enviado!';
            submitBtn.style.backgroundColor = '#10b981';
            
            // Show toast
            formToast.classList.remove('hidden');
            
            // Reset form
            contactForm.reset();

            // Revert button state after 3 seconds
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.style.backgroundColor = '';
                
                // Hide toast with transition
                formToast.classList.add('hidden');
            }, 3000);
        }, 1500);
    });

    // 6. Print CV (PDF generation fallback)
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
