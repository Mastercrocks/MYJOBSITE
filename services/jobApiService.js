const axios = require('axios');
const { pool } = require('../Config/database');

class JobApiService {
  constructor() {
    this.indeedBaseUrl = 'https://api.indeed.com/jobs'; // replace with actual URL
    this.adzunaBaseUrl = 'https://api.adzuna.com/v1/api/jobs'; // replace with actual URL
    this.rapidApiBaseUrl = 'https://jsearch.p.rapidapi.com'; // RapidAPI base URL
  }

  // ZipRecruiter Job Search
  async searchZipRecruiterJobs(params = {}) {
    try {
      const {
        search = 'software developer',
        location = 'remote',
        radius_miles = 25,
        days_ago = 30,
        jobs_per_page = 20,
        page = 1
      } = params;

      const response = await axios.get('https://api.ziprecruiter.com/jobs', {
        params: {
          search,
          location,
          radius_miles,
          days_ago,
          jobs_per_page,
          page,
          api_key: process.env.ZIPRECRUITER_API_KEY
        }
      });

      return this.normalizeZipRecruiterJobs(response.data.jobs || []);
    } catch (error) {
      console.error('ZipRecruiter API Error:', error.message);
      return [];
    }
  }

  // Indeed Job Search
  async searchIndeedJobs(params = {}) {
    try {
      const {
        q = 'software developer',
        l = 'remote',
        radius = 25,
        limit = 20,
        start = 0
      } = params;

      const response = await axios.get(this.indeedBaseUrl, {
        params: {
          publisher: process.env.INDEED_PUBLISHER_ID,
          q,
          l,
          radius,
          limit,
          start,
          format: 'json',
          v: '2'
        }
      });

      return this.normalizeIndeedJobs(response.data.results || []);
    } catch (error) {
      console.error('Indeed API Error:', error.message);
      return [];
    }
  }

  // Adzuna Job Search
  async searchAdzunaJobs(params = {}) {
    try {
      const {
        what = 'software developer',
        where = 'remote',
        results_per_page = 20,
        page = 1,
        country = 'us'
      } = params;

      const response = await axios.get(`${this.adzunaBaseUrl}/${country}/search/${page}`, {
        params: {
          app_id: process.env.ADZUNA_APP_ID,
          app_key: process.env.ADZUNA_APP_KEY,
          what,
          where,
          results_per_page
        }
      });

      return this.normalizeAdzunaJobs(response.data.results || []);
    } catch (error) {
      console.error('Adzuna API Error:', error.message);
      return [];
    }
  }

  // JSearch (RapidAPI) Job Search
  async searchJSearchJobs(params = {}) {
    try {
      const {
        query = 'software developer',
        page = 1,
        num_pages = 1,
        date_posted = 'month',
        remote_jobs_only = false
      } = params;

      const response = await axios.get(`${this.rapidApiBaseUrl}/search`, {
        params: {
          query,
          page,
          num_pages,
          date_posted,
          remote_jobs_only
        },
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });

      return this.normalizeJSearchJobs(response.data.data || []);
    } catch (error) {
      console.error('JSearch API Error:', error.message);
      return [];
    }
  }

  // Aggregate jobs from all sources
  async aggregateJobs(searchParams = {}) {
    console.log('Fetching jobs from multiple sources...');

    const promises = [
      this.searchZipRecruiterJobs(searchParams),
      this.searchAdzunaJobs(searchParams),
      this.searchJSearchJobs(searchParams)
    ];

    if (process.env.INDEED_PUBLISHER_ID) {
      promises.push(this.searchIndeedJobs(searchParams));
    }

    try {
      const results = await Promise.allSettled(promises);
      const allJobs = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value);
        } else {
          console.error(`Job source ${index} failed:`, result.reason);
        }
      });

      return this.deduplicateJobs(allJobs);
    } catch (error) {
      console.error('Error aggregating jobs:', error);
      return [];
    }
  }

  // Normalizers for each API's job data
  normalizeZipRecruiterJobs(jobs) {
    return jobs.map(job => ({
      id: `zr_${job.id}`,
      title: job.name,
      company: job.hiring_company?.name || 'Company Name Not Available',
      location: job.location,
      description: job.snippet,
      url: job.url,
      salary: job.salary_max_annual ? `$${job.salary_min_annual} - $${job.salary_max_annual}` : null,
      posted_date: job.posted_time,
      source: 'ZipRecruiter',
      job_type: job.category?.name || 'Full-time',
      remote: job.location?.toLowerCase().includes('remote')
    }));
  }

  normalizeIndeedJobs(jobs) {
    return jobs.map(job => ({
      id: `indeed_${job.jobkey}`,
      title: job.jobtitle,
      company: job.company,
      location: `${job.city}, ${job.state}`,
      description: job.snippet,
      url: job.url,
      salary: job.formattedSalary || null,
      posted_date: job.date,
      source: 'Indeed',
      job_type: job.formattedRelativeTime?.includes('full') ? 'Full-time' : 'Unknown',
      remote: job.jobtitle?.toLowerCase().includes('remote') || job.snippet?.toLowerCase().includes('remote')
    }));
  }

  normalizeAdzunaJobs(jobs) {
    return jobs.map(job => ({
      id: `adzuna_${job.id}`,
      title: job.title,
      company: job.company?.display_name || 'Company Not Listed',
      location: `${job.location.display_name}`,
      description: job.description,
      url: job.redirect_url,
      salary: job.salary_max ? `${Math.round(job.salary_min)} - ${Math.round(job.salary_max)}` : null,
      posted_date: job.created,
      source: 'Adzuna',
      job_type: job.contract_type || 'Full-time',
      remote: job.title?.toLowerCase().includes('remote') || job.location?.display_name?.toLowerCase().includes('remote')
    }));
  }

  normalizeJSearchJobs(jobs) {
    return jobs.map(job => ({
      id: `jsearch_${job.job_id}`,
      title: job.job_title,
      company: job.employer_name,
      location: `${job.job_city}, ${job.job_state}`,
      description: job.job_description,
      url: job.job_apply_link,
      salary: job.job_salary || null,
      posted_date: job.job_posted_at_datetime_utc,
      source: 'JSearch',
      job_type: job.job_employment_type || 'Full-time',
      remote: job.job_is_remote
    }));
  }

  // Remove duplicate jobs by title + company
  deduplicateJobs(jobs) {
    const seen = new Set();
    const unique = [];

    for (const job of jobs) {
      const key = `${job.title.toLowerCase()}_${job.company.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique.sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date));
  }

  // Save external jobs to your database
  async saveExternalJobs(jobs) {
    try {
      for (const job of jobs) {
        await pool.execute(`
          INSERT IGNORE INTO external_jobs 
          (external_id, title, company, location, description, url, salary, posted_date, source, job_type, is_remote)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          job.id,
          job.title,
          job.company,
          job.location,
          job.description,
          job.url,
          job.salary,
          job.posted_date,
          job.source,
          job.job_type,
          job.remote
        ]);
      }
      console.log(`Saved ${jobs.length} external jobs to database`);
    } catch (error) {
      console.error('Error saving external jobs:', error);
    }
  }
}

module.exports = new JobApiService();
