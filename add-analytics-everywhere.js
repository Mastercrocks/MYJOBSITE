const fs = require('fs').promises;
const path = require('path');

async function addAnalyticsToAllPages() {
    console.log('🔧 Adding Google Analytics to all HTML pages...');
    
    const analyticsCode = `    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-P5ETS8QMP7"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-P5ETS8QMP7');
    </script>
    `;
    
    try {
        // Get all HTML files in Public directory
        const publicDir = path.join(__dirname, 'Public');
        const files = await fs.readdir(publicDir, { recursive: true });
        
        const htmlFiles = files
            .filter(file => file.endsWith('.html'))
            .filter(file => !file.includes('admin/')) // Skip admin pages
            .map(file => path.join(publicDir, file));
        
        console.log(`📄 Found ${htmlFiles.length} HTML files to update...`);
        
        let updatedCount = 0;
        
        for (const filePath of htmlFiles) {
            try {
                let content = await fs.readFile(filePath, 'utf8');
                
                // Skip if already has analytics
                if (content.includes('G-P5ETS8QMP7')) {
                    console.log(`   ✅ ${path.basename(filePath)} - Already has analytics`);
                    continue;
                }
                
                // Find the <head> tag and add analytics after it
                if (content.includes('<head>')) {
                    const headIndex = content.indexOf('<head>') + '<head>'.length;
                    const beforeHead = content.substring(0, headIndex);
                    const afterHead = content.substring(headIndex);
                    
                    // Insert analytics code at the beginning of head
                    content = beforeHead + '\n' + analyticsCode + afterHead;
                    
                    await fs.writeFile(filePath, content);
                    updatedCount++;
                    console.log(`   ✅ ${path.basename(filePath)} - Added analytics`);
                } else {
                    console.log(`   ⚠️  ${path.basename(filePath)} - No <head> tag found`);
                }
                
            } catch (error) {
                console.log(`   ❌ ${path.basename(filePath)} - Error: ${error.message}`);
            }
        }
        
        console.log(`\n🎉 SUCCESS! Added Google Analytics to ${updatedCount} pages`);
        console.log('📊 All pages will now track visitors properly');
        
    } catch (error) {
        console.error('❌ Error updating pages:', error);
    }
}

addAnalyticsToAllPages();
