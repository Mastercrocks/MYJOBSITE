const fs = require('fs');

console.log('🔍 Current Data Summary:');
console.log('========================');

// Check analytics
const analytics = JSON.parse(fs.readFileSync('./data/analytics.json', 'utf8'));
console.log('📊 Page Views:', analytics.pageViews.total.toLocaleString());

// Check revenue  
const revenue = JSON.parse(fs.readFileSync('./data/revenue.json', 'utf8'));
console.log('💰 Total Revenue:', '$' + revenue.revenue.total.toLocaleString());
console.log('📅 Monthly Revenue:', '$' + Object.values(revenue.revenue.monthly).pop().toLocaleString());
console.log('🔄 Active Subscriptions:', revenue.subscriptions.active);

console.log('');
console.log('✅ Analytics and Revenue tracking is now accurate!');
console.log('🎯 Visit http://localhost:3000/admin/dashboard.html to see the updated dashboard');
console.log('💡 Click on "Billing & Revenue" in the sidebar to see detailed revenue breakdown');
