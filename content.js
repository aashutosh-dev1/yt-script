// Store state
let previouslyBlockedElements = new Set();
let isInitialized = false;

// Wrap functionality in try-catch blocks
async function hideContent() {
    try {
        const data = await chrome.storage.sync.get('blockedKeywords').catch(() => ({ blockedKeywords: [] }));
        const blockedKeywords = new Set((data.blockedKeywords || []).map(kw => kw.toLowerCase()));
        
        if (blockedKeywords.size > 0) {
            // Clear previous blocks safely
            for (const element of previouslyBlockedElements) {
                try {
                    if (element && document.contains(element)) {
                        element.classList.remove('blocked-video');
                    }
                } catch (e) {
                    console.warn('Error clearing element:', e);
                }
            }
            previouslyBlockedElements.clear();

            // Channel selectors
            const channelSelectors = [
                'ytd-channel-renderer',
                'ytd-grid-channel-renderer',
                'ytd-compact-channel-renderer',
                'ytd-guide-entry-renderer',
                'ytd-mini-channel-renderer'
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

            // Process elements with error handling
            function processElements(elements, isChannel = false) {
                elements.forEach(element => {
                    try {
                        if (!element || !document.contains(element)) return;

                        let shouldBlock = false;
                        if (isChannel) {
                            const channelName = element.querySelector('#channel-title, #channel-name, .ytd-channel-name, #text')?.textContent?.toLowerCase() || '';
                            shouldBlock = Array.from(blockedKeywords).some(keyword => 
                                channelName.includes(keyword) || 
                                channelName.startsWith(keyword) || 
                                channelName.endsWith(keyword)
                            );
                        } else {
                            const channelName = element.querySelector('#channel-name, .ytd-channel-name, #owner-text')?.textContent?.toLowerCase() || '';
                            const title = element.querySelector('#video-title, #title')?.textContent?.toLowerCase() || '';
                            const description = element.querySelector('#description-text, #description')?.textContent?.toLowerCase() || '';
                            const metadata = element.querySelector('#metadata, #meta')?.textContent?.toLowerCase() || '';

                            const allText = `${channelName} ${title} ${description} ${metadata}`.toLowerCase();
                            shouldBlock = Array.from(blockedKeywords).some(keyword => allText.includes(keyword));
                        }

                        if (shouldBlock) {
                            element.classList.add('blocked-video');
                            previouslyBlockedElements.add(element);
                        }
                    } catch (e) {
                        console.warn('Error processing element:', e);
                    }
                });
            }

            // Process channels and content
            try {
                const channelElements = document.querySelectorAll(channelSelectors);
                processElements(channelElements, true);
            } catch (e) {
                console.warn('Error processing channels:', e);
            }

            try {
                const contentElements = document.querySelectorAll(contentSelectors);
                processElements(contentElements, false);
            } catch (e) {
                console.warn('Error processing content:', e);
            }
        }
    } catch (e) {
        console.warn('Error in hideContent:', e);
        // If we get an extension context invalidated error, remove our observers
        if (e.message.includes('Extension context invalidated')) {
            cleanup();
        }
    }
}

// Cleanup function
function cleanup() {
    try {
        if (observer) {
            observer.disconnect();
        }
        // Remove any remaining blocked elements
        previouslyBlockedElements.forEach(element => {
            try {
                if (element && document.contains(element)) {
                    element.classList.remove('blocked-video');
                }
            } catch (e) {
                console.warn('Error cleaning up element:', e);
            }
        });
        previouslyBlockedElements.clear();
    } catch (e) {
        console.warn('Error in cleanup:', e);
    }
}

// Initialize with error handling
async function initialize() {
    if (isInitialized) return;
    
    try {
        // Add CSS
        const style = document.createElement('style');
        style.textContent = `
            .blocked-video {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        // Initial content check
        await hideContent();

        // Set up observer with error handling
        const observer = new MutationObserver(() => {
            requestAnimationFrame(() => {
                try {
                    hideContent();
                } catch (e) {
                    console.warn('Error in observer callback:', e);
                    if (e.message.includes('Extension context invalidated')) {
                        cleanup();
                    }
                }
            });
        });

        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });

        isInitialized = true;

        // Clean up when the extension is reloaded or updated
        window.addEventListener('unload', cleanup);
    } catch (e) {
        console.warn('Error in initialization:', e);
    }
}

// Start initialization
initialize();