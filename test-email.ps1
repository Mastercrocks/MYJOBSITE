# PowerShell Email Test Script
# Test the email marketing system directly

Write-Host "🧪 TESTING EMAIL MARKETING SYSTEM" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Test the API endpoint
try {
    Write-Host "`n📨 Sending test email campaign..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/test-auto-campaign" -Method POST -ContentType "application/json" -Body "{}"
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   📊 Emails sent: $($response.result.sent)" -ForegroundColor White
    Write-Host "   ❌ Failed: $($response.result.failed)" -ForegroundColor White
    Write-Host "   📧 Check your email: jamesen9@gmail.com" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Make sure server is running: node server.js" -ForegroundColor Yellow
}

Write-Host "`n📋 WHAT TO CHECK IN YOUR EMAIL:" -ForegroundColor Cyan
Write-Host "• Subject: '🚀 New Job Alert: Test Job Position at Test Company'" -ForegroundColor White
Write-Host "• From: 'TalentSync Job Alerts'" -ForegroundColor White
Write-Host "• Professional HTML template with job details" -ForegroundColor White
Write-Host "• Apply Now button and company branding" -ForegroundColor White
Write-Host "• Check spam folder if not in inbox" -ForegroundColor Yellow
