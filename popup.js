// content.js
let previouslyBlockedElements = new Set();

function hideContent() {
    chrome.storage.sync.get('blockedKeywords', (data) => {
        const blockedKeywords = new Set((data.blockedKeywords || []).map(kw => kw.toLowerCase()));
        
        if (blockedKeywords.size > 0) {
            // Clear previous blocks
            previouslyBlockedElements.forEach(element => {
                if (element && document.contains(element)) {
                    element.classList.remove('blocked-video');
                }
            });
            previouslyBlockedElements.clear();

            // Channel selectors
            const channelSelectors = [
                'ytd-channel-renderer',           // Channel search results
                'ytd-grid-channel-renderer',      // Channel grid items
                'ytd-compact-channel-renderer',   // Sidebar channels
                'ytd-guide-entry-renderer',       // Sidebar subscriptions
                'ytd-mini-channel-renderer'       // Mini channel cards
            ].join(', ');

            // Content selectors
            const contentSelectors = [
                'ytd-rich-item-renderer',
                'ytd-video-renderer',
                'ytd-compact-video-renderer',
                'ytd-grid-video-renderer',
                'ytd-playlist-renderer',
                'ytd-reel-item-renderer',
                'ytd-shelf-renderer',
                'ytd-horizontal-card-list-renderer',
                'ytd-rich-grid-row',
                'ytd-compact-playlist-renderer',
                'ytd-grid-playlist-renderer',
                'ytd-comment-renderer',
                'ytd-comment-thread-renderer'
            ].join(', ');

            // Block channels
            const channelElements = document.querySelectorAll(channelSelectors);
            channelElements.forEach(element => {
                const channelName = element.querySelector('#channel-title, #channel-name, .ytd-channel-name, #text')?.textContent.toLowerCase() || '';
                
                if (Array.from(blockedKeywords).some(keyword => 
                    channelName.includes(keyword) || 
                    channelName.startsWith(keyword) || 
                    channelName.endsWith(keyword)
                )) {
                    element.classList.add('blocked-video');
                    previouslyBlockedElements.add(element);
                }
            });

            // Block content
            const contentElements = document.querySelectorAll(contentSelectors);
            contentElements.forEach(element => {
                const channelName = element.querySelector('#channel-name, .ytd-channel-name, #owner-text')?.textContent.toLowerCase() || '';
                const title = element.querySelector('#video-title, #title')?.textContent.toLowerCase() || '';
                const description = element.querySelector('#description-text, #description')?.textContent.toLowerCase() || '';
                const metadata = element.querySelector('#metadata, #meta')?.textContent.toLowerCase() || '';

                const allText = `${channelName} ${title} ${description} ${metadata}`.toLowerCase();

                if (Array.from(blockedKeywords).some(keyword => allText.includes(keyword))) {
                    element.classList.add('blocked-video');
                    previouslyBlockedElements.add(element);
                }
            });
        }
    });
}

// CSS for blocked content
const style = document.createElement('style');
style.textContent = `
    .blocked-video {
        display: none !important;
    }
`;
document.head.appendChild(style);

// Initial check and observer setup
hideContent();
const observer = new MutationObserver(() => requestAnimationFrame(hideContent));
observer.observe(document.body, { childList: true, subtree: true });

// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const keywordInput = document.getElementById('keywordInput');
    const blockBtn = document.getElementById('blockBtn');
    const keywordList = document.getElementById('keywordList');

    function addKeyword() {
        const keyword = keywordInput.value.trim();
        
        if (keyword) {
            chrome.storage.sync.get('blockedKeywords', (data) => {
                let keywords = data.blockedKeywords || [];
                const lowercaseKeyword = keyword.toLowerCase();
                
                // Check if keyword already exists (case-insensitive)
                if (!keywords.some(k => k.toLowerCase() === lowercaseKeyword)) {
                    keywords.push(keyword);
                    chrome.storage.sync.set({ blockedKeywords: keywords }, () => {
                        updateKeywordList();
                        keywordInput.value = '';
                        
                        // Refresh active YouTube tabs
                        chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
                            tabs.forEach(tab => chrome.tabs.reload(tab.id));
                        });
                    });
                }
            });
        }
    }

    function updateKeywordList() {
        chrome.storage.sync.get('blockedKeywords', (data) => {
            const keywords = data.blockedKeywords || [];
            keywordList.innerHTML = '';
            
            keywords.forEach((keyword) => {
                const li = document.createElement('li');
                li.className = 'keyword-item';
                
                const text = document.createElement('span');
                text.textContent = keyword;
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = '-';
                removeBtn.onclick = () => removeKeyword(keyword);
                
                li.appendChild(text);
                li.appendChild(removeBtn);
                keywordList.appendChild(li);
            });
        });
    }

    function removeKeyword(keyword) {
        chrome.storage.sync.get('blockedKeywords', (data) => {
            let keywords = data.blockedKeywords || [];
            keywords = keywords.filter(k => k !== keyword);
            
            chrome.storage.sync.set({ blockedKeywords: keywords }, () => {
                updateKeywordList();
                // Refresh active YouTube tabs
                chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
                    tabs.forEach(tab => chrome.tabs.reload(tab.id));
                });
            });
        });
    }

    // Event listeners
    blockBtn.addEventListener('click', addKeyword);
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addKeyword();
        }
    });

    // Initial load
    updateKeywordList();
});