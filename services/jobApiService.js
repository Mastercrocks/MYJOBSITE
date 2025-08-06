const axios = require('axios');
const { pool } = require('../config/database');

class JobApiService {
  constructor() {
    this.zipRecruiterBaseUrl = 'https://api.ziprecruiter.com/jobs/v1';
    this.indeedBaseUrl = 'https://api.indeed.com/ads/apisearch';
    this.adzunaBaseUrl = 'https://api.adzuna.com/v1/api/jobs';
    this.rapidApiBaseUrl = 'https://jsearch.p.rapidapi.com';
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

      const response = await axios.get(`${this.zipRecruiterBaseUrl}`, {
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

  // Indeed Job Search (using their API)
  async searchIndeedJobs(params = {}) {
    try {
      const {
        q = 'software developer',
        l = 'remote',
        radius = 25,
        limit = 20,
        start = 0
      } = params;

      const response = await axios.get(`${this.indeedBaseUrl}`, {
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

  // JSearch (RapidAPI) - Alternative job search
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

    // Add Indeed if you have API access
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

      // Remove duplicates and sort by date
      return this.deduplicateJobs(allJobs);
    } catch (error) {
      console.error('Error aggregating jobs:', error);
      return [];
    }
  }

  // Normalize job data from different sources
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
      url: job