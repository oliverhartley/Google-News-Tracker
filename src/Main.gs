/**
 * Main.gs
 * Entry point for Google News Tracker.
 */

/**
 * Setup function to initialize properties.
 * Run this once manually.
 */
function setupApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Gemini API Setup', 'Please enter your Gemini API Key:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() == ui.Button.OK) {
    const key = response.getResponseText();
    setScriptProperty('GEMINI_API_KEY', key);
    ui.alert('API Key saved successfully.');
  }
}

/**
 * Main function to fetch and process Workspace updates.
 */
function fetchWorkspaceUpdates() {
  const FEED_URL = 'https://workspaceupdates.googleblog.com/feeds/posts/default?alt=rss';
  processFeed(FEED_URL, 'GWS');
}

/**
 * Main function to fetch and process GCP updates.
 */
function fetchGCPUpdates() {
  const FEED_URL = 'https://cloudblog.withgoogle.com/rss';
  processFeed(FEED_URL, 'GCP');
}

/**
 * Common logic to process a feed.
 * @param {string} url Feed URL.
 * @param {string} type 'GWS' or 'GCP'.
 */
/**
 * Common logic to process a feed.
 * @param {string} url Feed URL.
 * @param {string} type 'GWS' or 'GCP'.
 */
function processFeed(url, type) {
  console.log(`Starting process for ${type}...`);
  const ss = getSpreadsheet();
  ensureSheetStructure(ss);
  
  // 1. Fetch and Parse RSS/Atom
  const xml = UrlFetchApp.fetch(url).getContentText();
  const document = XmlService.parse(xml);
  const root = document.getRootElement();
  const rootName = root.getName();
  
  let items = [];
  let parser = null;

  if (rootName === 'rss') {
    console.log('Detected RSS feed.');
    const channel = root.getChild('channel');
    if (channel) {
      items = channel.getChildren('item');
      parser = parseRssItem;
    }
  } else if (rootName === 'feed') {
    console.log('Detected Atom feed.');
    const atom = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    items = root.getChildren('entry', atom);
    parser = (item) => parseAtomItem(item, atom);
  } else {
    console.error(`Unknown feed format: ${rootName}`);
    return;
  }
  
  console.log(`Found ${items.length} items in feed.`);
  
  // 2. Filter Items
  const sheetNames = SHEET_NAMES[type];
  const existingLinks = [
    ...getExistingLinks(sheetNames.STAGING),
    ...getExistingLinks(sheetNames.SENT)
  ];
  
  const newItems = [];
  
  items.forEach(item => {
    try {
      const data = parser(item);
      
      // Filter: Last 2 weeks
      if (!isWithinLastNDays(data.date, 14)) return;
      
      // Filter: Duplicates
      if (existingLinks.includes(data.link)) return;
      
      newItems.push(data);
    } catch (e) {
      console.warn('Error parsing item:', e);
    }
  });
  
  console.log(`Filtered down to ${newItems.length} new items.`);
  if (newItems.length === 0) return;
  
  // 3. Analyze with Gemini
  const processedItems = newItems.map(item => {
    const analysis = analyzeNewsItem(item.title, item.content, type);
    return { ...item, ...analysis };
  });
  
  // 4. Save to Staging Sheet
  saveNewsToStaging(sheetNames.STAGING, processedItems);
  
  // 5. Group by Section and Create Docs
  const grouped = {};
  processedItems.forEach(item => {
    const key = item.section || 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });
  
  const docLinks = [];
  
  for (const section in grouped) {
    const sectionItems = grouped[section];
    const docContent = generateDocContent(sectionItems, `${type} - ${section}`);
    
    // Create Doc
    const doc = DocumentApp.create(docContent.docTitle);
    doc.getBody().setText(docContent.body);
    doc.saveAndClose();
    
    docLinks.push({
      topic: section,
      url: doc.getUrl()
    });
    
    console.log(`Created Doc for ${section}: ${doc.getUrl()}`);
  }
  
  // 6. Save Doc Links to Youtube Sheet
  saveToYoutubeSheet(sheetNames.YOUTUBE, docLinks);
  
  console.log(`Completed ${type} update.`);
}

/**
 * Parses an RSS item.
 */
function parseRssItem(item) {
  const link = item.getChildText('link');
  const pubDate = parseDate(item.getChildText('pubDate'));
  const title = item.getChildText('title');
  const description = stripHtml(item.getChildText('description'));
  
  return {
    title: title,
    link: link,
    date: pubDate,
    content: description
  };
}

/**
 * Parses an Atom entry.
 */
function parseAtomItem(entry, atomNs) {
  const title = entry.getChildText('title', atomNs);
  const published = entry.getChildText('published', atomNs) || entry.getChildText('updated', atomNs);
  const date = parseDate(published);
  
  // Link is an attribute href
  const links = entry.getChildren('link', atomNs);
  let link = '';
  // Prefer alternate link
  for (const l of links) {
    if (l.getAttribute('rel').getValue() === 'alternate') {
      link = l.getAttribute('href').getValue();
      break;
    }
  }
  if (!link && links.length > 0) link = links[0].getAttribute('href').getValue();
  
  const content = stripHtml(entry.getChildText('content', atomNs) || entry.getChildText('summary', atomNs));
  
  return {
    title: title,
    link: link,
    date: date,
    content: content
  };
}

/**
 * Moves processed news to archive.
 */
function moveNewsToSent() {
  moveRowsToArchive(SHEET_NAMES.GWS.STAGING, SHEET_NAMES.GWS.SENT);
}

function moveGCPToSent() {
  moveRowsToArchive(SHEET_NAMES.GCP.STAGING, SHEET_NAMES.GCP.SENT);
}
