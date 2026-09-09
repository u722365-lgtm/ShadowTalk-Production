const fs = require('fs');
const file = 'c:/Users/Hacker/Documents/shadowtalk-ai-903ca615/public/aeo-answers.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Parse and filter JSON-LD
const scriptStart = content.indexOf('<script type="application/ld+json">') + 35;
const scriptEnd = content.indexOf('</script>', scriptStart);
const jsonStr = content.substring(scriptStart, scriptEnd);
try {
  let data = JSON.parse(jsonStr);
  if (data.mainEntity) {
    data.mainEntity = data.mainEntity.filter(q => {
      const qs = q.name.toLowerCase();
      const as = q.acceptedAnswer.text.toLowerCase();
      return !qs.includes('chatgpt') && !qs.includes('claude') && !qs.includes('perplexity') && !as.includes('chatgpt');
    });
    const newJsonStr = JSON.stringify(data, null, 2);
    content = content.substring(0, scriptStart) + '\n' + newJsonStr + '\n' + content.substring(scriptEnd);
  }
} catch (e) {
  console.log('Error parsing JSON-LD', e);
}

// 2. Remove Comparison Section
const compStart = content.indexOf('<section id="comparison">');
if (compStart > -1) {
  const compEnd = content.indexOf('</section>', compStart) + 10;
  if (compEnd > compStart) {
    content = content.substring(0, compStart) + content.substring(compEnd);
  }
}

// 3. Remove comparison links
content = content.replace(/<a[^>]*>ChatGPT.*?<\/a>/ig, '');

fs.writeFileSync(file, content);
console.log('Fixed aeo-answers.html');
