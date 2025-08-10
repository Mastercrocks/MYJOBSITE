// Schema Generator for Job Postings
class SchemaGenerator {
    static generateJobPostingSchema(job) {
        return {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": job.title,
            "description": job.description,
            "identifier": {
                "@type": "PropertyValue",
                "name": "TalentSync Job ID",
                "value": job.id
            },
            "datePosted": job.createdAt,
            "validThrough": job.validThrough || this.calculateValidThrough(job.createdAt),
            "employmentType": this.mapEmploymentType(job.type),
            "hiringOrganization": {
                "@type": "Organization",
                "name": job.companyName,
                "sameAs": job.companyWebsite || "https://your-domain.com",
                "logo": job.companyLogo || "https://your-domain.com/assets/default-company-logo.png"
            },
            "jobLocation": {
                "@type": "Place",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": job.location?.street || "",
                    "addressLocality": job.location?.city || job.location,
                    "addressRegion": job.location?.state || "",
                    "postalCode": job.location?.zipCode || "",
                    "addressCountry": job.location?.country || "US"
                }
            },
            "baseSalary": job.salary ? {
                "@type": "MonetaryAmount",
                "currency": "USD",
                "value": {
                    "@type": "QuantitativeValue",
                    "minValue": job.salary.min,
                    "maxValue": job.salary.max,
                    "unitText": job.salary.period || "YEAR"
                }
            } : undefined,
            "jobBenefits": job.benefits || [],
            "qualifications": job.requirements || job.qualifications || "",
            "responsibilities": job.responsibilities || "",
            "workHours": job.workHours || "Full-time",
            "industry": job.industry || "",
            "occupationalCategory": job.category || "",
            "url": `https://your-domain.com/jobs/${job.id}`,
            "applicationContact": {
                "@type": "ContactPoint",
                "contactType": "HR Department",
                "email": job.applicationEmail || "jobs@your-domain.com"
            }
        };
    }

    static mapEmploymentType(type) {
        const typeMapping = {
            'full-time': 'FULL_TIME',
            'part-time': 'PART_TIME',
            'contract': 'CONTRACTOR',
            'temporary': 'TEMPORARY',
            'internship': 'INTERN',
            'freelance': 'CONTRACTOR'
        };
        return typeMapping[type?.toLowerCase()] || 'FULL_TIME';
    }

    static calculateValidThrough(createdAt) {
        const created = new Date(createdAt);
        const validThrough = new Date(created);
        validThrough.setDate(created.getDate() + 30); // 30 days validity
        return validThrough.toISOString();
    }

    static injectJobSchema(job) {
        const schema = this.generateJobPostingSchema(job);
        const scriptTag = document.createElement('script');
        scriptTag.type = 'application/ld+json';
        scriptTag.textContent = JSON.stringify(schema, null, 2);
        document.head.appendChild(scriptTag);
    }
}

// Make it globally available
window.SchemaGenerator = SchemaGenerator;