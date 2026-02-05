const cheerio = require('cheerio');

/**
 * Cleans the ERP HTML response to retain only essential data.
 * @param {string} html - The raw HTML from ERP.
 * @param {string} sessionId - Current user session ID.
 * @returns {string} - Cleaned, minified HTML.
 */
function cleanHTML(html, sessionId) {
    const $ = cheerio.load(html);

    // 1. Ultra-Aggressive stripping for 2G (Keep images initially to filter them)
    $('script, style, video, audio, iframe, link, noscript, svg, object, embed, canvas').remove();
    $('header, footer, nav, aside, .sidebar, .ads, .popup, .modal, .share-buttons, .social, comment').remove();

    // 2. Filter images: Keep only captchas or essential ones
    $('img').each(function () {
        const src = $(this).attr('src') || '';
        const id = $(this).attr('id') || '';
        const isCaptcha = src.toLowerCase().includes('captcha') ||
            src.toLowerCase().includes('get-captcha') ||
            id.toLowerCase().includes('captcha');

        if (!isCaptcha) {
            $(this).remove();
        } else {
            // Simplify it: remove complex attributes but keep essentials
            $(this).attr('alt', 'CAPTCHA Image');
        }
    });

    // 3. Keep only structural data tags
    const mainContent = $('main, #content, .content, #main-content, .container, body');
    let cleanedBody = mainContent.length ? mainContent.html() : $('body').html();

    const $clean = cheerio.load(cleanedBody || '');

    // 4. Keep essential attributes for logic
    $clean('*').each(function () {
        const allowed = ['href', 'src', 'action', 'method', 'name', 'id', 'value', 'type', 'alt', 'style', 'class'];
        const attrs = this.attribs;
        Object.keys(attrs).forEach(attr => {
            if (!allowed.includes(attr)) $clean(this).removeAttr(attr);
        });
    });

    // 5. Force proxy on all interactions
    $clean('a').each(function () {
        const href = $clean(this).attr('href');
        if (href && !href.startsWith('java') && !href.startsWith('#')) {
            $clean(this).attr('href', `/proxy?url=${encodeURIComponent(href)}&sessionId=${sessionId}`);
        }
    });

    $clean('img').each(function () {
        let src = $clean(this).attr('src');
        if (src) {
            // Convert relative to absolute if needed
            if (!src.startsWith('http')) {
                const base = 'https://gietuerp.in';
                src = base + (src.startsWith('/') ? '' : '/') + src;
            }
            $clean(this).attr('src', `/proxy?url=${encodeURIComponent(src)}&sessionId=${sessionId}`);
            // Add styles manually via the style attribute since we just stripped it (or use class if we know the template will have it)
            $clean(this).attr('class', 'captcha-img');
            $clean(this).attr('style', 'min-height: 50px; min-width: 150px; background: #eee;'); // Placeholder size
        }
    });

    $clean('form').each(function () {
        let action = $clean(this).attr('action') || '/';

        // Ensure action is absolute for the proxy field
        if (!action.startsWith('http')) {
            const base = 'https://gietuerp.in';
            action = base + (action.startsWith('/') ? '' : '/') + action;
        }

        $clean(this).attr('action', '/proxy');
        $clean(this).attr('method', 'POST'); // Force POST for proxy predictability
        $clean(this).prepend(`<input type="hidden" name="url" value="${action}">`);
        $clean(this).prepend(`<input type="hidden" name="sessionId" value="${sessionId}">`);
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: sans-serif; font-size: 14px; line-height: 1.2; padding: 10px; color: #000; background: #fff; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
        input, select, textarea { width: 100%; padding: 8px; margin: 4px 0; border: 1px solid #999; }
        button, input[type="submit"] { background: #000; color: #fff; border: none; padding: 10px; width: 100%; }
        .captcha-box { background: #eee; padding: 10px; text-align: center; font-weight: bold; }
        .captcha-img { display: block; margin: 10px auto; max-width: 100%; border: 1px solid #ccc; background: #fff; }
    </style>
</head>
<body>${$clean.html()}</body>
</html>`.trim();
}

module.exports = { cleanHTML };
