// SEO Utility Functions
class SEOUtils {
    // Update page title dynamically
    static updatePageTitle(title) {
        document.title = `${title} - TalentSync`;
        
        // Update Open Graph title
        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.content = `${title} - TalentSync`;
        }
    }

    // Update meta description
    static updateMetaDescription(description) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.content = description;
        }
        
        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) {
            ogDesc.content = description;
        }
    }

    // Generate structured data for job listings page
    static generateJobListSchema(jobs) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Job Listings",
            "description": "Latest job opportunities available on TalentSync",
            "numberOfItems": jobs.length,
            "itemListElement": jobs.map((job, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "item": {
                    "@type": "JobPosting",
                    "title": job.title,
                    "description": job.description,
                    "url": `https://your-domain.com/jobs/${job.id}`,
                    "hiringOrganization": {
                        "@type": "Organization",
                        "name": job.companyName
                    },
                    "jobLocation": {
                        "@type": "Place",
                        "address": job.location
                    }
                }
            }))
        };

        this.injectSchema(schema);
    }

    // Inject schema into page
    static injectSchema(schema) {
        const existingScript = document.querySelector('script[data-schema="dynamic"]');
        if (existingScript) {
            existingScript.remove();
        }

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-schema', 'dynamic');
        script.textContent = JSON.stringify(schema, null, 2);
        document.head.appendChild(script);
    }

    // Generate breadcrumb schema
    static generateBreadcrumbSchema(breadcrumbs) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": breadcrumbs.map((crumb, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": crumb.name,
                "item": crumb.url ? `https://your-domain.com${crumb.url}` : undefined
            }))
        };

        this.injectSchema(schema);
    }

    // Lazy load images for performance
    static initLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // Track Core Web Vitals for SEO
    static trackWebVitals() {
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.log('LCP:', entry.startTime);
            }
        }).observe({entryTypes: ['largest-contentful-paint']});

        // First Input Delay
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.log('FID:', entry.processingStart - entry.startTime);
            }
        }).observe({entryTypes: ['first-input']});

        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    console.log('CLS:', entry.value);
                }
            }
        }).observe({entryTypes: ['layout-shift']});
    }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    SEOUtils.initLazyLoading();
    SEOUtils.trackWebVitals();
});

// Make globally available
window.SEOUtils = SEOUtils;