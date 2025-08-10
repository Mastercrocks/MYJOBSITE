# 🚀 Automated Job Scraping Deployment Guide

## Overview
Your job site now includes a comprehensive automated job scraping system that continuously finds fresh entry-level and college student positions from multiple sources:

- **Indeed**: Entry-level corporate positions
- **LinkedIn**: Professional network opportunities  
- **ZipRecruiter**: Diverse job marketplace
- **Google Jobs**: Aggregated job listings

## 🎯 Key Features

### Automated Scraping
- **Frequency**: Every 2 hours for continuous updates
- **Daily Comprehensive**: Full scrape at 6 AM daily
- **Target Audience**: Entry-level, college students, recent graduates
- **Smart Filtering**: Removes duplicates, filters by recency and relevance

### API Endpoints
- `GET /api/fresh` - Get fresh scraped + API jobs (primary endpoint)
- `GET /api/scraped-jobs` - Get only scraped jobs with filtering
- `POST /api/scrape-now` - Manually trigger scraping
- `GET /api/scraping/stats` - View scraping statistics

## 🛠 Railway Deployment Setup

### 1. Environment Variables
Add these environment variables in your Railway dashboard:

```bash
# Enable automated scraping (REQUIRED)
ENABLE_AUTO_SCRAPING=true

# Optional: Customize scraping behavior
MAX_JOBS_PER_SOURCE=50
SCRAPING_DELAY_MS=2000
TARGET_KEYWORDS=entry level,college,graduate,intern,junior,trainee

# Optional: Rate limiting
RATE_LIMIT_ENABLED=true
REQUESTS_PER_MINUTE=30
```

### 2. Deployment Commands
Your `package.json` already includes the necessary start script. Railway will automatically:
1. Install dependencies with `npm install`
2. Start the server with `npm start`
3. Initialize the job scraping scheduler

### 3. First Deploy Test
After deployment:

1. **Check Status**: Visit `/api/scraping/stats` to see scraping status
2. **Manual Test**: POST to `/api/scrape-now` to trigger immediate scraping
3. **View Results**: Visit `/api/fresh` to see aggregated job data
4. **Test Frontend**: Visit `/jobs.html` to see jobs displayed

## 📊 How It Works

### Scraping Process
1. **Scheduler starts** with the server (when ENABLE_AUTO_SCRAPING=true)
2. **Every 2 hours**: Quick scrape for new postings
3. **Daily at 6 AM**: Comprehensive scrape across all sources (LinkedIn, Indeed, ZipRecruiter, Google Jobs)
4. **Data processing**: Remove duplicates, filter for entry-level positions
5. **Storage**: Save to `data/scraped_jobs.json`

### Frontend Integration
The jobs page (`/jobs.html`) now:
- **Primary**: Uses `/api/fresh` for combined scraped + API jobs
- **Fallback**: Falls back to Indeed API if no scraped jobs
- **Stats Display**: Shows job sources and counts
- **Auto-refresh**: Users see fresh data automatically

### Smart Filtering
Jobs are filtered for college students by:
- **Keywords**: "entry level", "college", "graduate", "intern", "junior"
- **Experience**: 0-2 years preferred
- **Recency**: Posted within last 30 days
- **Company variety**: No single company dominates results

## 🔧 Monitoring & Maintenance

### View Scraping Stats
```bash
curl https://your-app.railway.app/api/scraping/stats
```

### Manual Scraping Trigger
```bash
curl -X POST https://your-app.railway.app/api/scrape-now
```

### Check Fresh Jobs
```bash
curl "https://your-app.railway.app/api/fresh?limit=10"
```

## 🚨 Troubleshooting

### No Jobs Appearing
1. Check `/api/scraping/stats` for errors
2. Verify `ENABLE_AUTO_SCRAPING=true` in Railway env vars
3. Check Railway logs for scraping errors
4. Try manual trigger with `/api/scrape-now`

### Rate Limiting Issues
- System includes built-in delays and retry logic
- Reduce `MAX_JOBS_PER_SOURCE` if needed
- Increase `SCRAPING_DELAY_MS` for more conservative scraping

### Performance Optimization
- Jobs are cached and updated incrementally
- Old jobs (30+ days) are automatically cleaned up
- System handles up to 1000+ jobs efficiently

## 🎉 Success Metrics

Once deployed, you should see:
- **Continuous Job Flow**: New jobs every 2 hours
- **Diverse Sources**: Jobs from Indeed, LinkedIn, Craigslist
- **Relevant Content**: Entry-level positions for college students  
- **Fresh Data**: Recent postings within 30 days
- **Smart Display**: Source statistics and job counts

## 📈 Next Steps

1. **Deploy to Railway** with environment variables
2. **Monitor first 24 hours** of scraping activity
3. **Customize keywords** based on your target audience
4. **Scale up** `MAX_JOBS_PER_SOURCE` once stable
5. **Add more job boards** as needed (Monster, ZipRecruiter, etc.)

Your job site now automatically aggregates hundreds of relevant entry-level positions without manual intervention! 🚀
